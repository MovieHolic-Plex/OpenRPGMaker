import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createOhMyPiAdapters, stopOhMyPiWorker } from "../scripts/lib/ohMyPiPiAi.mjs";

describe("oh-my-pi live login (real GitHub device OAuth)", () => {
  const dir = mkdtempSync(join(tmpdir(), "rpgzzu-oh-my-pi-live-"));

  before(() => {
    stopOhMyPiWorker();
    delete process.env.RPG_ZZU_OH_MY_PI_TEST_STUB;
    process.env.RPG_ZZU_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");
  });

  after(() => {
    stopOhMyPiWorker();
    rmSync(dir, { recursive: true, force: true });
  });

  it("github-copilot 로그인이 GitHub device URL 과 코드를 돌려준다", { timeout: 25_000 }, async () => {
    const adapters = await createOhMyPiAdapters();
    const login = await adapters.login("github-copilot", {});
    assert.match(String(login.verificationUrl), /github\.com/i);
    assert.ok(String(login.userCode).length >= 4, `userCode=${login.userCode}`);
  });

  it("openai-codex 로그인이 device 변형을 타고 ChatGPT 코드를 돌려준다", { timeout: 25_000 }, async () => {
    // pi-ai 의 `openai-codex` 정의는 paste-code 브라우저 흐름이라 이 화면에서 완결되지 않는다.
    // 어댑터가 `openai-codex-device` 로 갈아타는지 — verificationUrl + userCode 로 확인한다.
    const adapters = await createOhMyPiAdapters();
    const login = await adapters.login("openai-codex", {});
    assert.match(String(login.verificationUrl), /openai\.com/i);
    assert.ok(String(login.userCode).length >= 4, `userCode=${login.userCode}`);
  });
});
