// Preload with node --import for scoped QA, including Vitest worker processes.
// No environment URL/key is trusted; even redirects from loopback are rejected.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)) {
    throw new Error(`Local-only spatial QA blocked network access to ${url.hostname}`);
  }
  return nativeFetch(input, { ...init, redirect: "error" });
};
