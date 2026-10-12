import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

const {
  defaultOAuthClientsSettingsPath,
  readOAuthClientsFromPiAi,
  readOAuthClientsFromSettings,
  readQuotedAuthField,
} = await import("../scripts/lib/oauthClients.mjs");
const { configureOAuthClients, oauthClient } = await import("../src/ai/oauth/clientConfig.ts");
const { buildAntigravityAuthorizationUrl, CALLBACK_PATH, CALLBACK_PORT } = await import("../src/ai/oauth/antigravityOAuth.ts");

const savedEnv = {
  OPRN_ANTIGRAVITY_CLIENT_ID: process.env.OPRN_ANTIGRAVITY_CLIENT_ID,
  OPRN_ANTIGRAVITY_CLIENT_SECRET: process.env.OPRN_ANTIGRAVITY_CLIENT_SECRET,
  OPRN_CODEX_CLIENT_ID: process.env.OPRN_CODEX_CLIENT_ID,
  OPRN_OAUTH_CLIENTS_FILE: process.env.OPRN_OAUTH_CLIENTS_FILE,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("OAuth 클라이언트 출처", () => {
  after(() => restoreEnv());

  it("KDL 필드는 base64 와 평문을 구분하고 값은 로그에 필요한 만큼만 쓴다", () => {
    const text = [
      'client-id "ZmFrZS1pZA==" encoding="base64"',
      'client-secret "c2VjcmV0" encoding="base64"',
      'client-id "app_plain"',
    ].join("\n");
    assert.equal(readQuotedAuthField(text, "client-id"), "fake-id");
    assert.equal(readQuotedAuthField(text, "client-secret"), "secret");
    assert.equal(readQuotedAuthField('client-id "app_plain"\n', "client-id"), "app_plain");
    assert.equal(readQuotedAuthField(text, "missing"), undefined);
  });

  it("설정 파일이 없으면 빈 객체고, 잘못된 JSON 도 빈 객체다", () => {
    delete process.env.OPRN_OAUTH_CLIENTS_FILE;
    const missing = defaultOAuthClientsSettingsPath({ OPRN_OAUTH_CLIENTS_FILE: join(tmpdir(), "no-such-oauth-clients.json") });
    assert.equal(missing.endsWith("no-such-oauth-clients.json"), true);
    assert.deepEqual(readOAuthClientsFromSettings({ OPRN_OAUTH_CLIENTS_FILE: missing }), {});

    const dir = mkdtempSync(join(tmpdir(), "oauth-bad-"));
    const file = join(dir, "oauth-clients.json");
    writeFileSync(file, "{");
    try {
      assert.deepEqual(readOAuthClientsFromSettings({ OPRN_OAUTH_CLIENTS_FILE: file }), {});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("설정 파일의 비어 있지 않은 값만 읽고 패키지 값 위에 덮어 인가 URL 을 만든다", () => {
    delete process.env.OPRN_ANTIGRAVITY_CLIENT_ID;
    delete process.env.OPRN_ANTIGRAVITY_CLIENT_SECRET;
    delete process.env.OPRN_CODEX_CLIENT_ID;
    assert.throws(() => oauthClient("codexClientId"), /OPRN_CODEX_CLIENT_ID/);
    assert.throws(() => oauthClient("codexClientId"), /oauth-clients\.json/);

    const dir = mkdtempSync(join(tmpdir(), "oauth-ok-"));
    const file = join(dir, "oauth-clients.json");
    writeFileSync(file, JSON.stringify({
      antigravityClientId: "owner.apps.googleusercontent.com",
      antigravityClientSecret: "owner-secret",
      codexClientId: "  ",
      ignored: "nope",
    }));
    try {
      const fromFile = readOAuthClientsFromSettings({ OPRN_OAUTH_CLIENTS_FILE: file });
      assert.deepEqual(fromFile, {
        antigravityClientId: "owner.apps.googleusercontent.com",
        antigravityClientSecret: "owner-secret",
      });
      configureOAuthClients({ codexClientId: "from-package" });
      configureOAuthClients(fromFile);
      assert.equal(oauthClient("codexClientId"), "from-package");
      const redirectUri = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`;
      const url = new URL(buildAntigravityAuthorizationUrl({ state: "state-1", redirectUri }));
      assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
      assert.equal(url.searchParams.get("client_id"), "owner.apps.googleusercontent.com");
      assert.equal(url.searchParams.get("redirect_uri"), redirectUri);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("설치된 패키지에서 Antigravity·Codex 클라이언트를 읽되 값 전체는 찍지 않는다", () => {
    const clients = readOAuthClientsFromPiAi();
    const id = clients.antigravityClientId ?? "";
    const secret = clients.antigravityClientSecret ?? "";
    const codex = clients.codexClientId ?? "";
    assert.equal(id.endsWith(".apps.googleusercontent.com"), true, `antigravity id suffix missing (len=${id.length})`);
    assert.equal(secret.startsWith("GOCSPX-"), true, `antigravity secret prefix missing (len=${secret.length})`);
    assert.equal(codex.startsWith("app_"), true, `codex id prefix missing (len=${codex.length})`);
    assert.equal(secret.length > 8, true, `antigravity secret too short (len=${secret.length})`);
  });
});
