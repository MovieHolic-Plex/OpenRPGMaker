import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

// 실제 제공자 엔드포인트를 친다. stub 모드를 끄고, 저장소 경로는 import 보다 먼저 정한다
// (aiAuthRuntime 이 로드 시점에 저장소를 만든다).
const dir = mkdtempSync(join(tmpdir(), "rpgzzu-auth-live-"));
delete process.env.RPG_ZZU_OH_MY_PI_TEST_STUB;
process.env.RPG_ZZU_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");

const { createOhMyPiAdapters, stopOhMyPiWorker } = await import("../scripts/lib/ohMyPiPiAi.mjs");
const { cancelProviderLogin } = await import("../scripts/lib/aiAuthRuntime.ts");

describe("포팅한 OAuth 라이브 로그인 (실제 제공자 엔드포인트)", () => {
  after(() => {
    // 대기 중인 로그인을 반드시 끊는다: Antigravity 는 고정 포트 51121 을 잡고 있어서
    // 남겨두면 다음 실행이 EADDRINUSE 로 죽는다.
    cancelProviderLogin("openai-codex");
    cancelProviderLogin("google-antigravity");
    stopOhMyPiWorker();
    rmSync(dir, { recursive: true, force: true });
  });

  it("openai-codex 로그인이 우리 device 흐름으로 실제 ChatGPT 코드를 받아온다", { timeout: 25_000 }, async () => {
    const adapters = await createOhMyPiAdapters();
    const login = await adapters.login("openai-codex", {});

    assert.equal(login.verificationUrl, "https://auth.openai.com/codex/device");
    assert.match(String(login.userCode), /^[A-Z0-9-]{4,}$/, `userCode=${login.userCode}`);
    assert.match(String(login.instructions), /Enter code/);
  });

  it("google-antigravity 로그인이 우리 인가 URL 과 루프백 리다이렉트를 만든다", async () => {
    const adapters = await createOhMyPiAdapters();
    const login = await adapters.login("google-antigravity", {});
    const url = new URL(String(login.verificationUrl));

    assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    // 포트는 51121 선호지만 점유돼 있으면 대체 포트로 붙는다(이 머신은 docker-proxy 가 잡고 있다).
    // 계약은 "루프백 + /oauth-callback" 이고 그 포트가 실제 대기 포트라는 점이다.
    assert.match(
      String(url.searchParams.get("redirect_uri")),
      /^http:\/\/localhost:\d+\/oauth-callback$/,
      `redirect_uri=${url.searchParams.get("redirect_uri")}`,
    );
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.match(String(url.searchParams.get("client_id")), /\.apps\.googleusercontent\.com$/);
    assert.ok(String(url.searchParams.get("state")).length >= 8, "state must be unguessable");
    for (const scope of ["cloud-platform", "userinfo.email", "cclog", "experimentsandconfigs"]) {
      assert.match(String(url.searchParams.get("scope")), new RegExp(scope));
    }
  });

  it("같은 제공자로 다시 로그인해도 고정 포트가 충돌하지 않는다", async () => {
    const adapters = await createOhMyPiAdapters();
    const first = await adapters.login("google-antigravity", {});
    const second = await adapters.login("google-antigravity", {});

    assert.notEqual(
      new URL(String(first.verificationUrl)).searchParams.get("state"),
      new URL(String(second.verificationUrl)).searchParams.get("state"),
    );
    assert.equal((await adapters.status("google-antigravity")).connected, false);
  });
});
