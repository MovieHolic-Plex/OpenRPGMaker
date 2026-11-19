/** Bounds the whole request, including reading the response body. */
export async function withRequestTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  ms: number,
  parent?: AbortSignal,
): Promise<T> {
  parent?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), ms);
  const interrupted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
  });
  try {
    return await Promise.race([interrupted, request(controller.signal)]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
  }
}
