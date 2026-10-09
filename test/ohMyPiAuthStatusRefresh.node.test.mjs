import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

// 저장소 경로는 aiAuthRuntime 로드 시점에 정해진다 — 사용자의 ~/.oprn 을 절대 건드리지 않도록 먼저 격리한다.
const dir = mkdtempSync(join(tmpdir(), "oprn-auth-status-refresh-"));
process.env.OPRN_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");
process.env.OPRN_OH_MY_PI_TEST_STUB = "1";
delete process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL;

const { createOhMyPiAdapters } = await import("../scripts/lib/ohMyPiPiAi.mjs");
const runtime = await import("../scripts/lib/aiAuthRuntime.ts");

const ANTIGRAVITY = "google-antigravity";
const CODEX = "openai-codex";
const expired = (extra = {}) => ({ access: "old", refresh: "r", expires: Date.now() - 1000, projectId: "proj-test", ...extra });

describe("/auth/status revives an expired-but-refreshable login", () => {
  after(() => {
    delete process.env.OPRN_OH_MY_PI_TEST_STUB;
    delete process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL;
    rmSync(dir, { recursive: true, force: true });
  });

  it("status refreshes an expired token instead of reporting 「로그인 필요」", async () => {
    const adapters = await createOhMyPiAdapters();
    const seeded = await adapters.seedOAuth(ANTIGRAVITY, expired());
    assert.equal(seeded.connected, false, "precondition: stored token is expired");

    const before = runtime.authRefreshStatsForTests().attempts;
    const status = await adapters.status(ANTIGRAVITY);
    assert.equal(status.connected, true);
    assert.equal(runtime.authRefreshStatsForTests().attempts, before + 1);

    // A fresh token is not refreshed again.
    assert.equal((await adapters.status(ANTIGRAVITY)).connected, true);
    assert.equal(runtime.authRefreshStatsForTests().attempts, before + 1);
  });

  // 2026-09-24: 만료 1분 전 토큰을 Pi 실행에 고정으로 넘겨 실행이 0:56 에 「OAuth token expired before request」로 실패했다.
  it("request keys are refreshed ahead of expiry so a long run does not outlive its token", async () => {
    const adapters = await createOhMyPiAdapters();
    await adapters.seedOAuth(ANTIGRAVITY, { access: "soon", refresh: "r", expires: Date.now() + 60_000, projectId: "proj-test" });
    const before = runtime.authRefreshStatsForTests().attempts;
    assert.equal(JSON.parse(String(await runtime.resolveRequestApiKey(ANTIGRAVITY))).token, "stub-refreshed");
    assert.equal(runtime.authRefreshStatsForTests().attempts, before + 1);

    // 넉넉히 남은 토큰은 갱신하지 않는다.
    await adapters.seedOAuth(ANTIGRAVITY, { access: "fresh", refresh: "r", expires: Date.now() + runtime.REQUEST_KEY_MIN_LIFETIME_MS + 60_000, projectId: "proj-test" });
    assert.equal(JSON.parse(String(await runtime.resolveRequestApiKey(ANTIGRAVITY))).token, "fresh");
    assert.equal(runtime.authRefreshStatsForTests().attempts, before + 1);

    // 조기 갱신이 실패해도 아직 살아 있는 토큰으로 진행한다.
    await adapters.seedOAuth(ANTIGRAVITY, { access: "soon2", refresh: "r", expires: Date.now() + 60_000, projectId: "proj-test" });
    process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL = "1";
    try {
      assert.equal(JSON.parse(String(await runtime.resolveRequestApiKey(ANTIGRAVITY))).token, "soon2");
    } finally {
      delete process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL;
      await adapters.refresh(ANTIGRAVITY); // 백오프를 지워 다음 시험에 새지 않게 한다.
    }
  });

  it("concurrent status polls and requests share one refresh (single-flight)", async () => {
    const adapters = await createOhMyPiAdapters();
    await adapters.seedOAuth(ANTIGRAVITY, expired());
    const before = runtime.authRefreshStatsForTests().attempts;
    const results = await Promise.all([
      adapters.status(ANTIGRAVITY),
      adapters.status(ANTIGRAVITY),
      adapters.refresh(ANTIGRAVITY),
      runtime.resolveRequestApiKey(ANTIGRAVITY),
    ]);
    assert.equal(runtime.authRefreshStatsForTests().attempts, before + 1);
    assert.equal(results[0].connected, true);
    assert.equal(results[1].connected, true);
    assert.equal(JSON.parse(String(results[3])).token, "stub-refreshed");
  });

  it("a failed refresh backs off: polls inside the window do not call the provider again", async () => {
    const adapters = await createOhMyPiAdapters();
    await adapters.seedOAuth(CODEX, expired());
    process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL = "1";
    try {
      const before = runtime.authRefreshStatsForTests().attempts;
      const first = await adapters.status(CODEX);
      assert.equal(first.connected, false);
      assert.match(String(first.refreshError), /stub refresh failed/);
      for (let i = 0; i < 5; i += 1) {
        const polled = await adapters.status(CODEX);
        assert.equal(polled.connected, false);
        assert.ok(polled.refreshRetryAt >= Date.now() + runtime.AUTO_REFRESH_BACKOFF_BASE_MS - 5_000);
      }
      assert.equal(runtime.authRefreshStatsForTests().attempts, before + 1, "backoff must hold further automatic attempts");

      // An explicit refresh (user action) still tries, and success clears the backoff.
      delete process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL;
      const manual = await adapters.refresh(CODEX);
      assert.equal(manual.connected, true);
      assert.equal(runtime.authRefreshStatsForTests().failures[CODEX], undefined);
    } finally {
      delete process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL;
    }
  });

  it("backoff grows exponentially and is capped", async () => {
    const adapters = await createOhMyPiAdapters();
    await adapters.seedOAuth(CODEX, expired());
    process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL = "1";
    try {
      const delays = [];
      for (let i = 0; i < 7; i += 1) {
        const startedAt = Date.now();
        await assert.rejects(() => adapters.refresh(CODEX), /stub refresh failed/);
        delays.push(runtime.authRefreshStatsForTests().failures[CODEX].retryAt - startedAt);
      }
      const base = runtime.AUTO_REFRESH_BACKOFF_BASE_MS;
      for (let i = 0; i < 4; i += 1) assert.ok(Math.abs(delays[i] - base * 2 ** i) < 1_000, `delay ${i} = ${delays[i]}`);
      assert.ok(delays[6] <= runtime.AUTO_REFRESH_BACKOFF_MAX_MS + 1_000);
      assert.ok(delays[6] >= runtime.AUTO_REFRESH_BACKOFF_MAX_MS - 1_000);
    } finally {
      delete process.env.OPRN_OH_MY_PI_TEST_REFRESH_FAIL;
    }
  });

  it("a login without a refresh token (or without an Antigravity project) is not auto-refreshed", async () => {
    const adapters = await createOhMyPiAdapters();
    await adapters.seedOAuth(ANTIGRAVITY, expired({ projectId: undefined }));
    const before = runtime.authRefreshStatsForTests().attempts;
    assert.equal((await adapters.status(ANTIGRAVITY)).connected, false);
    assert.equal(runtime.authRefreshStatsForTests().attempts, before);
  });
});
