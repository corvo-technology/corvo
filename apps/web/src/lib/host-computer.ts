import type { CorvoDesktop } from "@corvo/contracts";
import { t } from "@lingui/core/macro";

/**
 * Saves where bots run through the desktop app. Resolves `false` when the person declines the
 * native confirmation that local access needs, so nothing is saved.
 */
export async function chooseHostComputer(
  desktop: CorvoDesktop | undefined,
  choice: "docker" | "this-mac",
): Promise<boolean> {
  if (!desktop?.computer?.managesHostChoice) {
    throw new Error(t`Local computer access requires the latest desktop app.`);
  }
  if (choice === "this-mac") return desktop.computer.requestAccess();
  await desktop.computer.revokeAccess();
  return true;
}

const DECLINED_KEY = "corvo.hostComputerDeclined";

/** Whether the person already said not now to allowing this computer, so it is not asked again at once. */
export function hostComputerDeclined(): boolean {
  try {
    return window.localStorage.getItem(DECLINED_KEY) === "1";
  } catch {
    return false;
  }
}

export function declineHostComputer(): void {
  try {
    window.localStorage.setItem(DECLINED_KEY, "1");
  } catch {
    /* Without storage the question simply returns next time. */
  }
}
