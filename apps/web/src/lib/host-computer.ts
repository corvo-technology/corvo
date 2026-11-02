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
