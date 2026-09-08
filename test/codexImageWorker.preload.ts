// Test-only interception: exercise the real worker/runtime without provider calls.
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  if (String(input) !== "https://chatgpt.com/backend-api/codex/images/generations") {
    throw new Error("Unexpected upstream URL in Codex image worker test");
  }
  return originalFetch(process.env.CODEX_IMAGE_TEST_UPSTREAM!, init);
}) as typeof fetch;
