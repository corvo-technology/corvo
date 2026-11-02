import { useEffect, useState } from "react";
import { fetchAuthCapabilities } from "./auth-capabilities";

/** True when this server is the engine on the person's own computer, where nobody signs in or out. */
export function useLocalEdition(): boolean {
  const [local, setLocal] = useState(false);
  useEffect(() => {
    let active = true;
    fetchAuthCapabilities()
      .then((capabilities) => {
        if (active) setLocal(capabilities.localEdition === true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return local;
}
