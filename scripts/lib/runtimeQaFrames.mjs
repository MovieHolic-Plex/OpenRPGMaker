// Native-frame transport only. No Vite server, renderer or filesystem imports.
export function validateFrameRequest(request) {
  if (!request || !Number.isSafeInteger(request.frames) || request.frames < 1 || request.frames > 600
    || !Number.isSafeInteger(request.deltaMs) || request.deltaMs < 1 || request.deltaMs > 1000) {
    throw new RangeError("QA frames require 1..600 frames and 1..1000 integer milliseconds per frame");
  }
}

export async function pauseRuntimeFrames(page) {
  await page.evaluate(() => {
    if (!window.__oprnQaFrames) throw new Error("QA frame instrumentation is absent");
    window.__oprnQaFrames.pause();
  });
}

export async function resumeRuntimeFrames(page) {
  await page.evaluate(() => {
    if (!window.__oprnQaFrames) throw new Error("QA frame instrumentation is absent");
    window.__oprnQaFrames.resume();
  });
}

/** Prearm exact batch completion before optional native input. The engine emits
 * synchronously after postrender and TimeStep.frame; no polling/settling delay.
 * Trigger/frame failures remain failures and always revoke the observation.
 */
export async function performObservedFrames(page, request, trigger = async () => {}, timeoutMs = 10_000) {
  validateFrameRequest(request);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) throw new RangeError("Invalid frame observation timeout");
  const pending = await page.evaluateHandle(([timeout, request]) => {
    const control = window.__oprnQaFrames;
    if (!control) throw new Error("QA frame instrumentation is absent");
    const before = control.readState();
    if (!before.canStep) throw new Error("Game must be under exclusive QA frame control");
    const sequence = before.sequence + 1;
    let cancel;
    const promise = new Promise((resolveReceipt) => {
      const finish = (value) => {
        clearTimeout(deadline);
        window.removeEventListener("oprn:qa-frames", observed);
        resolveReceipt(value);
      };
      const observed = (event) => {
        if (event.detail.sequence !== sequence || window.__oprnQaFrames !== control) return;
        finish({ receipt: event.detail, state: window.__oprnDebug?.readState() ?? null });
      };
      const deadline = setTimeout(() => finish({ error: `Missing QA frame receipt ${sequence}` }), timeout);
      cancel = () => finish({ error: "QA frame observation cancelled" });
      window.addEventListener("oprn:qa-frames", observed);
    });
    return { promise, control, request, cancel: () => cancel() };
  }, [timeoutMs, request]);
  const failures = [];
  let result;
  try {
    await trigger();
    const returned = await pending.evaluate((entry) => entry.control.step(entry.request));
    result = await pending.evaluate((entry) => entry.promise);
    if (result.error) throw new Error(result.error);
    if (result.receipt.sequence !== returned.sequence || result.receipt.frames !== request.frames
      || result.receipt.endFrame - result.receipt.startFrame !== request.frames) {
      throw new Error("QA frame receipt does not match the requested batch");
    }
  } catch (error) {
    failures.push(error);
  }
  try { await pending.evaluate((entry) => entry.cancel()); } catch (error) { failures.push(error); }
  try { await pending.dispose(); } catch (error) { failures.push(error); }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "QA frame action and cleanup failed");
  return result;
}
