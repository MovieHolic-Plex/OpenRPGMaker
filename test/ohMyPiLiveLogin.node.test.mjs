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
    const adapters = await createOhMyPiAdapters({
      getCodexSession: async () => {
        throw new Error("codex should not start");
      },
    });
    const login = await adapters.login("github-copilot", {});
    assert.match(String(login.verificationUrl), /github\.com/i);
    assert.ok(String(login.userCode).length >= 4, `userCode=${login.userCode}`);
  });
});
