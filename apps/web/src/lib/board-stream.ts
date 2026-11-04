import type { BoardEvent } from "@corvo/contracts";
import { isRetryableError, retryDelayMs } from "@corvo/core";

/**
 * Follow the board signal: connect, hand over every frame, and connect again after a failure that
 * is worth retrying. Returns a function that stops it.
 */
export function followBoard(options: {
  subscribe: (signal: AbortSignal) => Promise<AsyncIterable<BoardEvent>>;
  /** Runs after each connection is made, before its first frame. */
  onOpen?: () => Promise<void> | void;
  onEvent: (event: BoardEvent) => Promise<void> | void;
  onError?: (error: unknown) => void;
}): () => void {
  let active = true;
  let controller: AbortController | undefined;
  let cancelRetry: (() => void) | undefined;
  void (async () => {
    while (active) {
      controller = new AbortController();
      let failure: unknown;
      try {
        const stream = await options.subscribe(controller.signal);
        if (!active) return;
        await options.onOpen?.();
        if (!active) return;
        for await (const event of stream) {
          if (!active) return;
          await options.onEvent(event);
        }
      } catch (cause) {
        failure = cause;
        if (active) options.onError?.(cause);
      } finally {
        controller.abort();
      }
      if (!active || !isRetryableError(failure)) return;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, retryDelayMs(failure, 1_000));
        cancelRetry = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      cancelRetry = undefined;
    }
  })();
  return () => {
    active = false;
    controller?.abort();
    cancelRetry?.();
  };
}
