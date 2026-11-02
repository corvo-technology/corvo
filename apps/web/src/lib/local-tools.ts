import { useEffect, useState } from "react";
import { desktopBridge } from "./desktop";

export type LocalTools = { claude: boolean; codex: boolean };

const NONE: LocalTools = { claude: false, codex: false };

/** Which AI command-line tools the desktop app finds on this computer; nothing in a browser. */
export function useLocalTools(): LocalTools {
  const [tools, setTools] = useState<LocalTools>(NONE);
  useEffect(() => {
    let active = true;
    desktopBridge()
      ?.tools?.detect()
      .then((found) => {
        if (active) setTools(found);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return tools;
}
