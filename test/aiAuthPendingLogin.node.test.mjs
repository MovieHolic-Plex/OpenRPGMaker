import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, it } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "oprn-pending-auth-"));
process.env.OPRN_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");
delete process.env.OPRN_OH_MY_PI_TEST_STUB;
const { startProviderLogin, cancelProviderLogin, publicProviderStatus } = await import("../scripts/lib/aiAuthRuntime.ts");
const provider = "google-antigravity";
const originalFetch = globalThis.fetch;
after(() => {
  cancelProviderLogin(provider);
  globalThis.fetch = originalFetch;
  rmSync(dir, { recursive: true, force: true });
});

it("pending login resumes, cancellation keeps late credentials from being stored", { timeout: 10000 }, async () => {
  let finishExchange;
  let exchangeStarted;
  const exchanging = new Promise(resolve => { exchangeStarted = resolve; });
  globalThis.fetch = async url => {
    if (String(url).includes("oauth2.googleapis.com/token")) {
      exchangeStarted();
      return new Promise(resolve => { finishExchange = resolve; });
    }
    return Response.json({ cloudaicompanionProject: "review-project" });
  };
  const login = await startProviderLogin(provider);
  const pending = publicProviderStatus(provider).pendingLogin;
  assert.equal(pending.verificationUrl, login.verificationUrl);
  assert.equal(pending.expiresAt, login.expiresAt);
  assert.ok(pending.expiresAt > Date.now());
  const authorization = new URL(login.verificationUrl);
  const callback = new URL(authorization.searchParams.get("redirect_uri"));
  callback.searchParams.set("state", authorization.searchParams.get("state"));
  callback.searchParams.set("code", "review-only");
  await originalFetch(callback);
  await exchanging;
  assert.equal(cancelProviderLogin(provider), true);
  assert.equal(publicProviderStatus(provider).pendingLogin, undefined);
  finishExchange(Response.json({ access_token: "mock-access", refresh_token: "mock-refresh", expires_in: 3600 }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(publicProviderStatus(provider).connected, false);
  assert.equal(publicProviderStatus(provider).lastLoginError, undefined);
});
