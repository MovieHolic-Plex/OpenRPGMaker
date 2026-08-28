// scripts/lib/goto-retry.mjs
// Navigation retry for the one failure mode that is never the app's fault:
// Chromium aborting in-flight requests because the HOST network configuration changed.
//
// Chromium listens to OS network-change notifications (netlink on Linux, NLM on
// Windows). When a VPN/Tailscale interface flaps, Wi-Fi roams, DHCP renews, or a
// docker/WSL virtual NIC is (re)created, it cancels every in-flight request and the
// pending navigation rejects with `net::ERR_NETWORK_CHANGED`. The notification is
// process-global, not per-request, so a `page.goto("http://127.0.0.1:9173/")` against
// our own dev server dies too — which is why this looks absurd in a localhost-only
// e2e run. Retrying once is the correct response; it is what a browser tab would do.
//
// Kept in .mjs (with a sibling .d.mts) so the ~79 ad-hoc `scripts/*.mjs` capture
// scripts and the TS e2e helpers import the SAME function. Playwright's own
// `retries` setting only covers specs run through the test runner, so the standalone
// capture scripts need this.
//
// Deliberately NOT retried: ERR_CONNECTION_REFUSED (dev server is down — retrying
// only delays a truthful failure) and navigation timeouts (a real hang).

/** Net error codes that mean "the network stack moved under us", not "the target is broken". */
export const TRANSIENT_NAVIGATION_NET_ERRORS = Object.freeze([
  "ERR_NETWORK_CHANGED",
  "ERR_NETWORK_IO_SUSPENDED",
  "ERR_INTERNET_DISCONNECTED",
  "ERR_CONNECTION_RESET",
  "ERR_CONNECTION_ABORTED",
  "ERR_CONNECTION_CLOSED",
  "ERR_SOCKET_NOT_CONNECTED",
  "ERR_EMPTY_RESPONSE",
]);

/**
 * Does this rejection come from a host network change rather than the page?
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isTransientNavigationError(error) {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  return TRANSIENT_NAVIGATION_NET_ERRORS.some((code) => message.includes(`net::${code}`));
}

const sleepDefault = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `page.goto` that survives a host network change.
 *
 * Non-transient failures are rethrown on the first attempt, so a down dev server or a
 * genuine timeout still fails as fast as a bare `page.goto` would.
 *
 * @param {{ goto: (url: string, options?: Record<string, unknown>) => Promise<any> }} page
 * @param {string} url
 * @param {Record<string, unknown> & {
 *   attempts?: number,
 *   delayMs?: number,
 *   sleep?: (ms: number) => Promise<void>,
 *   onRetry?: (error: unknown, attempt: number) => void,
 * }} [options] retry knobs plus any `page.goto` option (waitUntil, timeout, referer)
 * @returns {Promise<any>} whatever `page.goto` resolved to
 */
export async function gotoWithRetry(page, url, options = {}) {
  const {
    attempts = 2,
    delayMs = 500,
    sleep = sleepDefault,
    onRetry,
    ...gotoOptions
  } = options;

  const budget = Math.max(1, attempts);
  let lastError;

  for (let attempt = 1; attempt <= budget; attempt += 1) {
    try {
      return await page.goto(url, gotoOptions);
    } catch (error) {
      if (!isTransientNavigationError(error)) throw error;
      lastError = error;
      if (attempt === budget) break;
      onRetry?.(error, attempt);
      await sleep(delayMs);
    }
  }

  throw lastError;
}
