export function transcriptIsNearEnd(
  element: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">,
): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 80;
}

export function transcriptCanSnapAfterFrame(
  element: Pick<HTMLElement, "scrollTop"> | null,
  queuedElement: Pick<HTMLElement, "scrollTop">,
  queuedScrollTop: number,
): boolean {
  return element === queuedElement && queuedElement.scrollTop === queuedScrollTop;
}

export function transcriptMovedDown(previousScrollTop: number | null, scrollTop: number): boolean {
  return previousScrollTop !== null && scrollTop >= previousScrollTop;
}

/** The newest message is the person's own and was not there before: they just sent it. */
export function ownMessageJustSent(
  previousNewestId: string | null,
  messages: readonly { id: string; role: string }[],
): boolean {
  const newest = messages.at(-1);
  return previousNewestId !== null && newest?.role === "user" && newest.id !== previousNewestId;
}

/**
 * Whether a press inside the transcript is the reader taking over the scroll (the scrollbar, a
 * text selection). Pressing a control in a message, such as an answer to a question, is not.
 */
export function pressTakesScroll(target: EventTarget | null): boolean {
  return !(
    target instanceof Element &&
    target.closest("button, a, input, textarea, select, [role='button']")
  );
}
