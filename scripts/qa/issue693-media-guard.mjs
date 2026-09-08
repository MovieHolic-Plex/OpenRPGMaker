import { randomUUID } from "node:crypto";

/** Register DOM/error signals before the action, then await either exact outcome. */
export async function observeMediaUi(page, selector, { fresh = false, rejectOnError = false, guardFailure } = {}) {
  const token = randomUUID();
  await page.evaluate(({ selector, token, fresh, rejectOnError }) => {
    window.mediaQaSignals ??= {};
    const previous = fresh ? new Set(document.querySelectorAll(selector)) : new Set();
    const previousErrors = new Set(document.querySelectorAll('[data-testid="toast"].error'));
    window.mediaQaSignals[token] = new Promise(resolve => {
      const finish = result => { clearTimeout(deadline); observer.disconnect(); resolve(result); };
      const deadline = setTimeout(() => finish({ ok: false, reason: "ui-timeout", message: `Missing ${selector}` }), 90_000);
      const check = () => {
        const error = rejectOnError && [...document.querySelectorAll('[data-testid="toast"].error')].find(node => !previousErrors.has(node));
        if (error) return finish({ ok: false, reason: "ui-error", message: error.textContent });
        if ([...document.querySelectorAll(selector)].some(node => !previous.has(node))) finish({ ok: true });
      };
      const observer = new MutationObserver(check);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      check();
    });
  }, { selector, token, fresh, rejectOnError });
  return async () => {
    const signals = [page.evaluate(token => window.mediaQaSignals[token], token)];
    if (guardFailure) signals.push(guardFailure.then(blocked => ({
      ok: false, reason: "guard-rejected", message: `Media write guard: ${blocked.table} ${blocked.method}: ${blocked.reason}`,
    })));
    const result = await Promise.race(signals);
    if (!result.ok) throw Object.assign(new Error(result.message), { code: result.reason });
  };
}

// Validate every top-level row in the intercepted body. Diagnostics never retain
// payload bytes, arbitrary row fields, credentials or a list of IDs.
export function summarizeMediaWrite(href, method, body) {
  const url = new URL(href);
  const table = url.pathname.split("/rest/v1/")[1];
  const fail = error => ({ error });
  if (!["projects", "maps", "tilesets"].includes(table)) return fail("outside-project-save");
  const filters = url.searchParams.getAll("project_id");
  if (filters.length > 1) return fail("ambiguous-target-filter");
  const queryTarget = filters[0]?.match(/^eq\.(oprn-[a-f0-9]{10})$/)?.[1];
  if (filters.length && !queryTarget) return fail("invalid-target-filter");
  if (method === "DELETE") {
    if (table === "projects" || !queryTarget || body != null) return fail("invalid-delete");
    return { target: queryTarget, rows: 0, bodyLength: 0 };
  }
  if (method !== "POST" || typeof body !== "string") return fail("unsupported-write-shape");
  let parsed;
  try { parsed = JSON.parse(body); } catch { return fail("invalid-json"); }
  if ((table === "projects") === Array.isArray(parsed)) return fail("invalid-row-shape");
  const rows = table === "projects" ? [parsed] : parsed;
  if (!Array.isArray(rows) || rows.length === 0) return fail("empty-row-set");
  const target = rows[0]?.project_id;
  if (typeof target !== "string" || !/^oprn-[a-f0-9]{10}$/.test(target)) return fail("invalid-row-target");
  if (!rows.every(row => row !== null && typeof row === "object" && !Array.isArray(row) && row.project_id === target)) {
    return fail("mixed-or-invalid-row-targets");
  }
  if (queryTarget && queryTarget !== target) return fail("query-body-target-mismatch");
  return { target, rows: rows.length, bodyLength: body.length };
}

/** Harness-only guard. POST/DELETE always use the native browser network path. */
export async function installMediaWriteGuard(context, { report, permitRemoteCopy, getConfig, relayOrigin }) {
  let fail;
  const failure = new Promise(resolve => { fail = resolve; });
  const record = (table, method, reason, fatal = true) => {
    const blocked = { table, method, reason };
    report.blockedMutations.push(blocked);
    if (fatal) fail(blocked);
  };
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const table = url.pathname.split("/rest/v1/")[1] ?? "non-rest";
    let handled = false;
    try {
      if (method === "GET" && url.origin === relayOrigin) {
        // Workstation workaround: actual upstream bytes/status, never a fixture.
        // Keep auth/profile headers so real Supabase GETs read the same schema.
        const response = await fetch(request.url(), {
          headers: { ...await request.allHeaders(), "accept-encoding": "identity" },
          redirect: "manual", signal: AbortSignal.timeout(90_000),
        });
        const headers = Object.fromEntries(response.headers);
        // fetch decodes HTTP encodings; fulfill supplies the actual body length.
        delete headers["content-encoding"];
        delete headers["content-length"];
        delete headers["transfer-encoding"];
        const body = Buffer.from(await response.arrayBuffer());
        handled = true;
        await route.fulfill({ status: response.status, headers, body });
        return;
      }
      if (!url.pathname.includes("/rest/v1/") || ["GET", "HEAD", "OPTIONS"].includes(method)) {
        handled = true;
        await route.continue();
        return;
      }
      if (!permitRemoteCopy || !["projects", "maps", "tilesets"].includes(table)) {
        record(table, method, permitRemoteCopy ? "outside-project-save" : "remote-not-permitted", false);
        handled = true;
        await route.abort("blockedbyclient");
        return;
      }
      const raw = request.postData();
      report.bodyObservations.push({ table, available: raw !== null, bodyLength: raw?.length ?? 0 });
      // Firefox may omit large bodies: fail closed, without metadata side channels.
      if (method === "POST" && raw === null) throw new Error("request-body-unavailable");
      const summary = summarizeMediaWrite(request.url(), method, raw);
      if (summary.error) throw new Error(summary.error);
      report.bodyObservations.at(-1).rows = summary.rows;
      const config = getConfig();
      if (!config?.projectId || !config.restUrl || url.origin + url.pathname !== new URL(table, config.restUrl).href) {
        throw new Error("configuration-or-endpoint-mismatch");
      }
      if (summary.target === config.projectId || !/^oprn-[a-f0-9]{10}$/.test(summary.target)
        || (report.remoteProjectId ? summary.target !== report.remoteProjectId : table !== "projects" || method !== "POST")) {
        throw new Error("target-not-owned");
      }
      report.remoteProjectId ??= summary.target;
      handled = true;
      await route.continue();
      report.remoteWrites++;
    } catch (error) {
      record(table, method, error.message);
      if (!handled) {
        try { await route.abort("blockedbyclient"); }
        catch (abortError) { record(table, method, `abort-failed: ${abortError.message}`); }
      }
    }
  });
  return { failure };
}
