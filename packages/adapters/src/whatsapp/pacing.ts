import type { WhatsAppLinkClient } from "./client.js";

/** How long the typing indicator shows per character of the reply, before jitter. */
export const TYPING_MS_PER_CHAR = 40;
export const MIN_TYPING_MS = 1_000;
export const MAX_TYPING_MS = 8_000;
/** Up to this fraction is added to the delay at random, so replies do not tick like a clock. */
export const TYPING_JITTER = 0.3;
/** A number sends at most this many replies in any minute. */
export const MAX_SENDS_PER_MINUTE = 20;
/** The window incoming work is counted over. */
export const WINDOW_MS = 10 * 60_000;
/** Runs one person can start on a number within a window. */
export const SENDER_RUNS_PER_WINDOW = 6;
/** Runs everyone together can start on a number within a window. */
export const NUMBER_RUNS_PER_WINDOW = 60;

export interface PacerOptions {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface Pacer {
  /** Shows typing, waits like a person would, and holds a reply that would go over the minute's limit. */
  beforeSend(
    numberId: string,
    client: Pick<WhatsAppLinkClient, "setTyping">,
    chatId: string,
    text: string,
  ): Promise<void>;
  /** False once a sender or a number has started too much work in the window. Dropped ones are not counted. */
  allowIncoming(numberId: string, senderId: string): boolean;
}

/** Keeps only the timestamps newer than `since`. */
function recent(stamps: number[] | undefined, since: number): number[] {
  return (stamps ?? []).filter((at) => at > since);
}

/**
 * A number that answers in zero seconds, all day, to everyone looks like automation, and
 * automation gets numbers banned. This paces replies and bounds what strangers can start.
 */
export function createPacer(options: PacerOptions = {}): Pacer {
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const random = options.random ?? Math.random;
  const sends = new Map<string, number[]>();
  const senderRuns = new Map<string, number[]>();
  const numberRuns = new Map<string, number[]>();

  return {
    async beforeSend(numberId, client, chatId, text) {
      const minuteAgo = now() - 60_000;
      const sent = recent(sends.get(numberId), minuteAgo);
      const oldest = sent[0];
      if (sent.length >= MAX_SENDS_PER_MINUTE && oldest !== undefined) {
        await sleep(Math.max(1, oldest + 60_000 - now()));
      }
      const wanted = text.length * TYPING_MS_PER_CHAR * (1 + random() * TYPING_JITTER);
      const delay = Math.min(MAX_TYPING_MS, Math.max(MIN_TYPING_MS, Math.round(wanted)));
      await client.setTyping(chatId, true);
      try {
        await sleep(delay);
      } finally {
        await client.setTyping(chatId, false);
      }
      sends.set(numberId, [...recent(sends.get(numberId), now() - 60_000), now()]);
    },

    allowIncoming(numberId, senderId) {
      const since = now() - WINDOW_MS;
      const senderKey = `${numberId}:${senderId}`;
      const bySender = recent(senderRuns.get(senderKey), since);
      const byNumber = recent(numberRuns.get(numberId), since);
      senderRuns.set(senderKey, bySender);
      numberRuns.set(numberId, byNumber);
      if (bySender.length >= SENDER_RUNS_PER_WINDOW || byNumber.length >= NUMBER_RUNS_PER_WINDOW) {
        return false;
      }
      bySender.push(now());
      byNumber.push(now());
      return true;
    },
  };
}
