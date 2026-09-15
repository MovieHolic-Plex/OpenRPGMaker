import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  createOhMyPiAuthStore,
  defaultHomeOhMyPiAuthPath,
  defaultOhMyPiAuthPath,
  legacyHomeOhMyPiAuthPath,
  resolveLegacyOhMyPiAuthPath,
} from "../scripts/lib/ohMyPiAuthStore.mjs";

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

// 2026-09 제품명 스윕: 자격 파일이 ~/.rpg-zzu 에서 ~/.oprn 으로 옮겨졌다. 로그인한 사용자를
// 다시 로그인시키지 않으려고 첫 읽기에서 옛 파일을 새 자리로 **한 번 복사**한다(옛 파일은 남긴다).
describe("oh-my-pi auth store — 옛 ~/.rpg-zzu 파일 입양", () => {
  let dir;
  const legacyDoc = { version: 1, providers: { "openai-codex": { kind: "apiKey", apiKey: "sk-legacy" } }, declined: {} };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "oprn-oh-my-pi-legacy-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("기본 경로는 ~/.oprn 이고, 환경 변수 OPRN_OH_MY_PI_AUTH_PATH 가 있으면 그것이 이긴다", () => {
    assert.equal(defaultHomeOhMyPiAuthPath().endsWith(join(".oprn", "oh-my-pi-auth.json")), true);
    assert.equal(legacyHomeOhMyPiAuthPath().endsWith(join(".rpg-zzu", "oh-my-pi-auth.json")), true);
    const previous = process.env.OPRN_OH_MY_PI_AUTH_PATH;
    process.env.OPRN_OH_MY_PI_AUTH_PATH = join(dir, "override.json");
    try {
      assert.equal(defaultOhMyPiAuthPath(), join(dir, "override.json"));
      // 명시적으로 지정한 파일에는 옛 홈 파일을 끌어오지 않는다.
      assert.equal(resolveLegacyOhMyPiAuthPath(defaultOhMyPiAuthPath()), undefined);
    } finally {
      if (previous === undefined) delete process.env.OPRN_OH_MY_PI_AUTH_PATH;
      else process.env.OPRN_OH_MY_PI_AUTH_PATH = previous;
    }
    assert.equal(resolveLegacyOhMyPiAuthPath(defaultHomeOhMyPiAuthPath()), legacyHomeOhMyPiAuthPath());
  });

  it("새 파일이 없고 옛 파일이 있으면 첫 읽기에서 복사하고 옛 파일은 남기며 한 번만 알린다", () => {
    const legacyPath = join(dir, "old", "oh-my-pi-auth.json");
    const nextPath = join(dir, "new", "oh-my-pi-auth.json");
    const legacyStore = createOhMyPiAuthStore(legacyPath, { legacyPath: null });
    legacyStore.setApiKey("openai-codex", "sk-legacy");
    const logs = [];
    const store = createOhMyPiAuthStore(nextPath, { legacyPath, log: (message) => logs.push(message) });

    assert.equal(existsSync(nextPath), false);
    assert.equal(store.has("openai-codex"), true);
    assert.equal(store.get("openai-codex").apiKey, "sk-legacy");
    assert.equal(existsSync(nextPath), true);
    assert.equal(existsSync(legacyPath), true);
    assert.equal(readFileSync(nextPath, "utf8"), readFileSync(legacyPath, "utf8"));
    store.has("openai-codex");
    store.publicStatus("openai-codex");
    assert.equal(logs.length, 1);
    assert.match(logs[0], /oh-my-pi-auth\.json/);
  });

  it("새 파일이 이미 있으면 옛 파일을 보지 않는다", () => {
    const legacyPath = join(dir, "old.json");
    const nextPath = join(dir, "new.json");
    writeFileSync(legacyPath, `${JSON.stringify(legacyDoc)}\n`);
    createOhMyPiAuthStore(nextPath, { legacyPath: null }).setApiKey("groq", "gsk-new");
    const logs = [];
    const store = createOhMyPiAuthStore(nextPath, { legacyPath, log: (message) => logs.push(message) });
    assert.equal(store.has("openai-codex"), false);
    assert.equal(store.has("groq"), true);
    assert.equal(logs.length, 0);
  });

  it("둘 다 없으면 읽기만으로는 파일을 만들지 않고 조용하다", () => {
    const logs = [];
    const store = createOhMyPiAuthStore(join(dir, "new.json"), { legacyPath: join(dir, "old.json"), log: (message) => logs.push(message) });
    assert.equal(store.has("groq"), false);
    assert.equal(existsSync(join(dir, "new.json")), false);
    assert.equal(logs.length, 0);
  });

  it("쓰기 경로도 먼저 입양한다 — 옛 자격 위에 새 자격을 덧쓰지, 옛 자격을 지우지 않는다", () => {
    const legacyPath = join(dir, "old.json");
    const nextPath = join(dir, "new.json");
    writeFileSync(legacyPath, `${JSON.stringify(legacyDoc)}\n`);
    const store = createOhMyPiAuthStore(nextPath, { legacyPath, log: () => {} });
    store.setApiKey("groq", "gsk-new");
    assert.equal(store.has("openai-codex"), true);
    assert.equal(store.has("groq"), true);
  });
});
