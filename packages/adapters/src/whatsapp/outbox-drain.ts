import { WHATSAPP_THREAD_PREFIX } from "./link-surface.js";

/**
 * The replies to a linked WhatsApp number are sent by the process that holds its socket. The
 * worker leaves those rows alone, so this loop sends them, a moment after they are queued.
 */
export function createWhatsAppOutboxDrain(options: {
  /** Sends the pending rows that match the scope. */
  drain(scope: { onlyThreadPrefix: string }): Promise<void>;
  everyMs?: number;
  onError?: (error: unknown) => void;
}): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    options
      .drain({ onlyThreadPrefix: WHATSAPP_THREAD_PREFIX })
      .catch((error: unknown) => options.onError?.(error))
      .finally(() => {
        running = false;
      });
  }, options.everyMs ?? 1_500);
  return () => clearInterval(timer);
}
