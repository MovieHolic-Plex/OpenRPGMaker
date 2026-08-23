import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import { createOhMyPiAuthStore } from "../scripts/lib/ohMyPiAuthStore.mjs";

describe("oh-my-pi auth store", () => {
  let dir;
  let store;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rpgzzu-oh-my-pi-"));
    store = createOhMyPiAuthStore(join(dir, "auth.json"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("API 키를 디스크에 두고 다시 읽는다", () => {
    assert.equal(store.has("groq"), false);
    store.setApiKey("groq", "gsk-test");
    assert.equal(store.has("groq"), true);
    const row = store.get("groq");
    assert.equal(row.kind, "apiKey");
    assert.equal(row.apiKey, "gsk-test");
  });

  it("만료된 OAuth 행을 가리킨다", () => {
    store.setOAuth("anthropic", {
      access: "a",
      refresh: "r",
      expires: Date.now() - 1000,
    });
    assert.equal(store.isExpired("anthropic"), true);
    store.setOAuth("anthropic", {
      access: "a",
      refresh: "r",
      expires: Date.now() + 60_000,
    });
    assert.equal(store.isExpired("anthropic"), false);
  });

  it("자격을 지우면 연결이 끊기고 자동 채용도 막힌다", () => {
    store.setApiKey("groq", "gsk-wrong");

    assert.equal(store.remove("groq"), true);
    assert.equal(store.has("groq"), false);
    assert.equal(store.publicStatus("groq").connected, false);
    // 사용자가 끊은 연결은 다시 채용하지 않는다 — 이 표시가 없으면 ~/.codex/auth.json
    // 입양이 해제를 되살린다.
    assert.equal(store.adoptionDeclined("groq"), true);
    // 지울 항이 없었다는 사실을 숨기지 않는다.
    assert.equal(store.remove("openai"), false);
  });

  it("다시 로그인하면 자동 채용 차단을 거둔다", () => {
    store.setOAuth("openai-codex", { access: "a", refresh: "r", expires: Date.now() + 60_000 });
    store.remove("openai-codex");
    assert.equal(store.adoptionDeclined("openai-codex"), true);

    store.setOAuth("openai-codex", { access: "a2", refresh: "r2", expires: Date.now() + 60_000 });
    assert.equal(store.adoptionDeclined("openai-codex"), false);
    assert.equal(store.publicStatus("openai-codex").connected, true);
  });

  it("시크릿을 JSON 그대로 보관하되 브라우저용 상태에는 넣지 않는다", () => {
    store.setApiKey("openai", "sk-secret");
    const publicStatus = store.publicStatus("openai");
    assert.equal(publicStatus.connected, true);
    assert.equal("apiKey" in publicStatus, false);
    assert.equal(JSON.stringify(publicStatus).includes("sk-secret"), false);
  });
});
