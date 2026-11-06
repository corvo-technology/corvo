/**
 * Linked WhatsApp numbers speak an unofficial protocol, so a hosted deployment must choose it.
 * The desktop app's own engine always has it: that is the owner's own computer and the owner's
 * own numbers.
 */
export function linkedWhatsAppEnabled(input: {
  desktopStackToken?: string | undefined;
  operatorSwitch?: boolean | undefined;
}): boolean {
  return Boolean(input.desktopStackToken) || input.operatorSwitch === true;
}
