/**
 * QA-only subscriptions. This function is serialized into the real player document;
 * keep it self-contained. No interpreter calls, clock-driven sampling or app hooks.
 * @param {import("./runtimeQa.d.mts").RuntimeQaEventCommandOp} op
 */
export function armEventCommandObservation(op) {
  if (window.__eventCommandQa) throw new Error("An eventCommand observation is already armed");
  if (!op.observe?.length || !Number.isFinite(op.timeoutMs) || op.timeoutMs <= 0) {
    throw new Error("eventCommand requires observations and a positive timeoutMs");
  }
  const equal = (a, b) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(b);
    return keys.length === Object.keys(a).length && keys.every(key => Object.hasOwn(a, key) && equal(a[key], b[key]));
  };
  const read = spec => {
    const node = document.querySelector(spec.selector ?? '[data-testid="runtime-state-json"]');
    if (spec.source === "state") {
      if (!node?.textContent) return { missing: true };
      let value = JSON.parse(node.textContent);
      for (const key of spec.path) {
        if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) return { missing: true };
        value = value[key];
      }
      return { value };
    }
    if (spec.read === "present") return { value: Boolean(node) };
    if (!node) return { missing: true };
    if (spec.read === "attribute") return { value: node.getAttribute(spec.name) };
    if (spec.read === "property") return { value: node[spec.name] };
    return { value: node.textContent };
  };
  // Read/validate selectors and JSON before allocating listeners.
  const before = op.observe.map(read);
  if (op.event) document.querySelector(op.event.selector);
  if (op.mutation) document.querySelector(op.mutation);
  const controller = new AbortController();
  let resolveResult;
  const result = new Promise(resolve => { resolveResult = resolve; });
  const trace = { status: "armed", before, after: before, event: null, cleanup: null };
  let settled = false;
  let triggered = false;
  let eventSeen = !op.event;
  let mutationSeen = !op.mutation;
  const observer = new MutationObserver(records => {
    if (triggered && op.mutation) mutationSeen ||= records.some(record => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      return Boolean(target?.closest(op.mutation));
    });
    check();
  });
  const cleanup = () => {
    observer.disconnect();
    clearTimeout(timeout);
    if (op.event) document.removeEventListener(op.event.type, onEvent, true);
    window.removeEventListener("pagehide", onPageHide);
    controller.signal.removeEventListener("abort", onAbort);
    trace.cleanup = { observer: true, timer: true, event: true, pagehide: true, abort: true };
  };
  const finish = (status, error) => {
    if (settled) return;
    settled = true;
    trace.status = status;
    cleanup();
    resolveResult({ ...trace, ...(error ? { error } : {}) });
  };
  const check = () => {
    if (settled || !triggered) return;
    try {
      trace.after = op.observe.map(read);
      if (eventSeen && mutationSeen && trace.after.every((entry, index) => !entry.missing && equal(entry.value, op.observe[index].equals))) {
        finish("success");
      }
    } catch (error) {
      finish("error", String(error));
    }
  };
  const onEvent = event => {
    if (!triggered || !(event.target instanceof Element) || !event.target.matches(op.event.selector)) return;
    eventSeen = true;
    trace.event = { type: event.type, selector: op.event.selector };
    check();
  };
  const onAbort = () => finish("aborted", "eventCommand aborted");
  const onPageHide = () => controller.abort();
  const timeout = setTimeout(() => finish("timeout", "eventCommand observation timed out"), op.timeoutMs);
  observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  if (op.event) document.addEventListener(op.event.type, onEvent, true);
  window.addEventListener("pagehide", onPageHide);
  controller.signal.addEventListener("abort", onAbort, { once: true });
  window.__eventCommandQa = {
    result, trace,
    start: () => { triggered = true; },
    check,
    abort: () => controller.abort(),
  };
}

/**
 * The subscription is acknowledged before any real input. Result promises always
 * resolve in-page so timeout/abort during a slow input never leaks a rejection.
 * @param {import("@playwright/test").Page} page
 * @param {import("./runtimeQa.d.mts").RuntimeQaEventCommandOp} op
 */
export async function eventCommandQaOp(page, op) {
  await page.evaluate(armEventCommandObservation, op);
  try {
    await page.evaluate(() => window.__eventCommandQa.start());
    const trigger = op.trigger;
    if (trigger.kind === "key") await page.keyboard.press(trigger.key);
    else if (trigger.kind === "click") await page.locator(trigger.selector).click({ timeout: op.timeoutMs });
    else if (trigger.kind === "action") await page.evaluate(() => {
      if (typeof window.__oprnInput?.action !== "function") throw new Error("Runtime action hook is not ready");
      window.__oprnInput.action();
    });
    else if (trigger.kind !== "none") throw new Error(`Unknown eventCommand trigger: ${trigger.kind}`);
    const observation = await page.evaluate(async () => {
      window.__eventCommandQa.check();
      return await window.__eventCommandQa.result;
    });
    if (observation.status !== "success") {
      throw Object.assign(new Error(observation.error), { observation });
    }
    return observation;
  } finally {
    // Also aborts on failed input. Do not retain listeners or browser globals
    // between beats; a following operation must not inherit a previous result.
    await page.evaluate(() => {
      window.__eventCommandQa.abort();
      delete window.__eventCommandQa;
    });
  }
}
