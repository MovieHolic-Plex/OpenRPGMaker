/** Single-client execution authority. Retained drafts and persistence receipts are not leases. */
export class RunOperation {
  private readonly controller = new AbortController();
  private unlink: (() => void) | undefined;
  readonly signal = this.controller.signal;

  constructor(signal?: AbortSignal) {
    if (signal) {
      const abort = () => this.retire();
      signal.addEventListener("abort", abort, { once: true });
      this.unlink = () => signal.removeEventListener("abort", abort);
      if (signal.aborted) this.retire();
    }
  }

  retire(): void {
    this.unlink?.();
    this.unlink = undefined;
    this.controller.abort();
  }

  assertCurrent(): void { this.signal.throwIfAborted(); }

  /** Cancellation releases the caller; an uncooperative producer never blocks its successor. */
  async wait<T>(work: Promise<T>): Promise<T> {
    let abort = () => {};
    try {
      const cancelled = new Promise<never>((_, reject) => {
        abort = () => reject(this.signal.reason);
        this.signal.addEventListener("abort", abort, { once: true });
        if (this.signal.aborted) abort();
      });
      const result = await Promise.race([work, cancelled]);
      this.assertCurrent();
      return result;
    } finally { this.signal.removeEventListener("abort", abort); }
  }
}
