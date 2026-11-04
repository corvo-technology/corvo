import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { boardMoveNotice, deliverBoardNotice } from "../../lib/board-notifications";
import { followBoard } from "../../lib/board-stream";
import { requestBrowserNotificationPermission } from "../../lib/browser-notifications";
import { rpc } from "../../lib/rpc";
import { useBuiltinStatusLabels } from "../../lib/ticket-status";

/**
 * Tell the person, outside the app window, when an agent moves a card to review or done. The
 * board and the Team screen already update live while the window is in front.
 */
export function useBoardNotifications(enabled: boolean): void {
  const { t } = useLingui();
  const builtin = useBuiltinStatusLabels();
  const navigate = useNavigate();
  // The stream outlives renders, so it reads the latest of these through a ref.
  const title = (name: string, ref: string, status: string) => t`${name} moved ${ref} to ${status}`;
  const latest = useRef({ title, builtin, navigate });
  latest.current = { title, builtin, navigate };

  useEffect(() => {
    if (!enabled || typeof Notification === "undefined") return;
    const seen = new Set<string>();
    const attempt = (event: Parameters<typeof boardMoveNotice>[0]) => {
      const notice = boardMoveNotice(event, latest.current.builtin);
      if (!notice) return "discarded" as const;
      return deliverBoardNotice(notice, {
        pageVisible: document.visibilityState === "visible",
        windowFocused: document.hasFocus(),
        permission: Notification.permission,
        seen,
        key: event.createdAt,
        show: ({ name, ref, status, body, tag }) => {
          const title = latest.current.title(name, ref, status);
          const shown = new Notification(title, { body, tag });
          shown.onclick = () => {
            window.focus();
            latest.current.navigate("/app/board");
            shown.close();
          };
        },
      });
    };
    return followBoard({
      subscribe: (signal) => rpc.boards.subscribe(undefined, { signal }),
      onEvent: async (event) => {
        if (attempt(event) !== "pending") return;
        await requestBrowserNotificationPermission();
        attempt(event);
      },
    });
  }, [enabled]);
}
