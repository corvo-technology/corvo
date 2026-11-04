import type { WikiChange } from "@corvo/contracts";
import { useCallback, useEffect, useState } from "react";
import { decideWikiChange, getWikiChange } from "../../lib/wiki";
import { WikiChangeCard } from "../wiki-views";

/**
 * The card for a change the wiki kept from this conversation. The message only names the change;
 * its state, and what the reader may see of its source, is asked of the server each time.
 */
export function WikiChangeBlock({ changeId }: { changeId: string }) {
  const [change, setChange] = useState<WikiChange | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setChange(await getWikiChange(changeId));
    } catch {
      setChange(null);
    }
  }, [changeId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!change) return null;
  return (
    <WikiChangeCard
      change={change}
      busy={busy}
      onDecide={(decision) => {
        if (busy) return;
        setBusy(true);
        void decideWikiChange(changeId, decision)
          .then(setChange)
          // Someone may have answered first: show what the server says now.
          .catch(load)
          .finally(() => setBusy(false));
      }}
      // The router loads only when a page is opened, so a conversation does not pull it in.
      onOpenPage={(title) =>
        void import("expo-router").then(({ router }) =>
          router.push({ pathname: "/wiki-page", params: { title } }),
        )
      }
    />
  );
}
