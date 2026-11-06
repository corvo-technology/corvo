/**
 * Runs one task at a time per key, lets a few wait, and turns the rest away. Used so a stranger
 * who sends many voice notes cannot pile transcription work up on the owner's computer.
 */
export function createKeyedGate(options: { maxWaiting: number }) {
  const state = new Map<string, { running: boolean; waiting: Array<() => void> }>();

  async function acquire(key: string): Promise<boolean> {
    let entry = state.get(key);
    if (!entry) {
      entry = { running: false, waiting: [] };
      state.set(key, entry);
    }
    if (!entry.running) {
      entry.running = true;
      return true;
    }
    if (entry.waiting.length >= options.maxWaiting) return false;
    const current = entry;
    await new Promise<void>((resume) => current.waiting.push(resume));
    return true;
  }

  function release(key: string) {
    const entry = state.get(key);
    if (!entry) return;
    const next = entry.waiting.shift();
    if (next) {
      // The slot passes straight to the next waiter.
      next();
      return;
    }
    entry.running = false;
    state.delete(key);
  }

  return {
    /** The task's result, or "full" when it was turned away without running. */
    async run<T>(key: string, task: () => Promise<T>): Promise<T | "full"> {
      if (!(await acquire(key))) return "full";
      try {
        return await task();
      } finally {
        release(key);
      }
    },
  };
}
