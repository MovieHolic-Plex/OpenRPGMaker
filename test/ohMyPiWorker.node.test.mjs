import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

// 저장소는 aiAuthRuntime **모듈 로드 시점**에 만들어진다. 그래서 경로 env 는 import 보다 먼저
// 정해져야 한다 — static import 는 모듈 본문보다 먼저 평가되므로 동적 import 를 쓴다.
const dir = mkdtempSync(join(tmpdir(), "rpgzzu-auth-w-"));
process.env.RPG_ZZU_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");
process.env.RPG_ZZU_OH_MY_PI_TEST_STUB = "1";

const { createOhMyPiAdapters, stopOhMyPiWorker } = await import("../scripts/lib/ohMyPiPiAi.mjs");

const ANTIGRAVITY = "google-antigravity";
const CODEX = "openai-codex";

describe("인증은 Node, 완성만 Bun 워커", () => {
  after(() => {
    stopOhMyPiWorker();
    delete process.env.RPG_ZZU_OH_MY_PI_TEST_STUB;
    rmSync(dir, { recursive: true, force: true });
  });

  it("제공자는 Antigravity·Codex 둘뿐이고 둘 다 구독 로그인이다", async () => {
    const adapters = await createOhMyPiAdapters();
    const providers = await adapters.listProviders();

    assert.deepEqual(providers.map((row) => row.id), [ANTIGRAVITY, CODEX]);
    for (const row of providers) {
      assert.equal(row.authKind, "oauth", `${row.id} authKind`);
      assert.equal(row.hasLogin, true, `${row.id} hasLogin`);
      assert.equal(row.hasRefresh, true, `${row.id} hasRefresh`);
    }
  });

  it("두 제공자 모두 로그인 URL 을 돌려주고, API 키 저장은 거절한다", async () => {
    const adapters = await createOhMyPiAdapters();
    for (const provider of [ANTIGRAVITY, CODEX]) {
      const login = await adapters.login(provider, {});
      assert.equal(login.provider, provider);
      assert.ok(String(login.verificationUrl).length > 0, `${provider} verificationUrl`);

      // 구독 로그인 전용이므로 키를 받는 경로가 있으면 안 된다 — 붙여넣은 키로 연결된 척하다
      // 매 턴 401 이 되는 구멍이 거기서 생겼다.
      await assert.rejects(() => adapters.saveKey(provider, "sk-nope"), /API 키/);
    }
  });

  it("갱신은 저장된 자격을 새 값으로 바꾸고, 해제는 워커까지 닿는다", async () => {
    const adapters = await createOhMyPiAdapters();
    for (const provider of [ANTIGRAVITY, CODEX]) {
      await adapters.seedOAuth(provider, {
        access: "old",
        refresh: "r",
        expires: Date.now() - 1000,
        projectId: "proj-test",
      });

      const refreshed = await adapters.refresh(provider);
      assert.equal(refreshed.connected, true, `${provider} refreshed connected`);
      assert.equal(refreshed.refreshed, true, `${provider} refreshed flag`);

      const loggedOut = await adapters.logout(provider);
      assert.equal(loggedOut.connected, false, `${provider} logged out`);
      assert.equal(loggedOut.removed, true, `${provider} removed`);
      assert.equal((await adapters.status(provider)).connected, false, `${provider} status after logout`);
    }
  });

  it("모르는 제공자는 상태·로그인·갱신 모두 400 으로 거절한다", async () => {
    const adapters = await createOhMyPiAdapters();
    for (const call of [
      () => adapters.status("zai"),
      () => adapters.login("zai", {}),
      () => adapters.refresh("zai"),
    ]) {
      await assert.rejects(async () => call(), (error) => {
        assert.equal(error.status, 400);
        assert.match(String(error.message), /zai/);
        return true;
      });
    }
  });

  it("완성 요청은 고른 제공자 그대로 워커를 탄다", async () => {
    const adapters = await createOhMyPiAdapters();
    const completion = await adapters.complete(ANTIGRAVITY, {
      model: "gemini-3.7-flash",
      messages: [{ role: "user", content: "hi" }],
    });

    assert.equal(completion.completion.provider, ANTIGRAVITY);
    assert.equal(completion.completion.choices[0].message.content, `stub:${ANTIGRAVITY}`);
  });

  it("이미지 요청은 /image 워커와 generateImage 어댑터를 탄다", async () => {
    const adapters = await createOhMyPiAdapters();
    await adapters.seedOAuth(ANTIGRAVITY, {
      access: "image-access",
      refresh: "image-refresh",
      expires: Date.now() + 60_000,
      projectId: "image-project",
    });

    const image = await adapters.generateImage(ANTIGRAVITY, {
      model: "gemini-3.1-flash-image",
      prompt: "슬라임",
    });

    assert.equal(image.provider, ANTIGRAVITY);
    assert.equal(image.model, "gemini-3.1-flash-image");
    assert.equal(image.mimeType, "image/png");
    assert.match(image.base64, /^[A-Za-z0-9+/]+=*$/u);
  });
});
