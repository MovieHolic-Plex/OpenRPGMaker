import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createOhMyPiAdapters, stopOhMyPiWorker } from "../scripts/lib/ohMyPiPiAi.mjs";

describe("oh-my-pi bun worker", () => {
  const dir = mkdtempSync(join(tmpdir(), "rpgzzu-oh-my-pi-w-"));
  process.env.RPG_ZZU_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");
  process.env.RPG_ZZU_OH_MY_PI_TEST_STUB = "1";

  before(() => {
    stopOhMyPiWorker();
  });

  after(() => {
    stopOhMyPiWorker();
    delete process.env.RPG_ZZU_OH_MY_PI_TEST_STUB;
    rmSync(dir, { recursive: true, force: true });
  });

  it("키 저장·OAuth 로그인 URL·갱신·complete 가 고른 제공자를 탄다", async () => {
    const adapters = await createOhMyPiAdapters();
    const saved = await adapters.saveKey("groq", "gsk-worker-test");
    assert.equal(saved.connected, true);
    assert.equal(saved.provider, "groq");

    const login = await adapters.login("anthropic", {});
    assert.equal(login.provider, "anthropic");
    assert.match(String(login.verificationUrl), /anthropic/);

    await adapters.seedOAuth("github-copilot", {
      access: "old",
      refresh: "r",
      expires: Date.now() - 1000,
    });
    const refreshed = await adapters.refresh("github-copilot");
    assert.equal(refreshed.connected, true);
    assert.equal(refreshed.refreshed, true);

    const completion = await adapters.complete("groq", {
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: "hi" }],
    });
    assert.equal(completion.completion.provider, "groq");
    assert.equal(completion.completion.choices[0].message.content, "stub:groq");

    // 연결 해제는 워커까지 닿아야 한다 — 라우트만 있고 자격이 남으면 해제가 거짓말이 된다.
    const loggedOut = await adapters.logout("groq");
    assert.equal(loggedOut.connected, false);
    assert.equal(loggedOut.removed, true);
    assert.equal((await adapters.status("groq")).connected, false);

    const providers = await adapters.listProviders();
    const oauth = providers.filter((row) => row.authKind === "oauth" && row.id !== "openai-codex");
    assert.ok(oauth.length >= 10);
    for (const row of oauth) {
      assert.equal(row.hasLogin, true, `${row.id} must expose pi-ai login`);
    }
  });
});
