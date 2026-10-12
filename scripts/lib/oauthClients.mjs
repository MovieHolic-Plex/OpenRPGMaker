// 다른 회사 앱의 공개 OAuth 클라이언트 값을 저장소에 적지 않는다(src/ai/oauth/clientConfig.ts).
// 읽는 곳:
//   1. 설치된 @oh-my-pi/pi-catalog 의 KDL (18.9 이후 Antigravity client id/secret 의 실제 위치)
//   2. 설치된 @oh-my-pi/pi-ai 소스의 옛 `const CLIENT_ID = decode("...")` (그 파일이 남아 있을 때)
// KDL 이 있으면 KDL 이 이긴다. 둘 다 없으면 빈 객체를 돌려주고, 쓰는 쪽이 어느 값이 없는지 말하며 던진다.
// 소유자 설정 파일(~/.oprn/oauth-clients.json 또는 OPRN_OAUTH_CLIENTS_FILE)은 readOAuthClientsFromSettings.
//
// import.meta.url 은 함수 안에서만 읽는다 — Electron 메인 CJS 번들에서는 비어 있다(build-electron.mjs 검사).
// 그 번들은 빌드 때 이 함수로 읽은 값을 __OPRN_OAUTH_CLIENTS__ 로 주입받는다.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";

const decodeBase64 = (value) => Buffer.from(value, "base64").toString("utf8");

const SETTINGS_KEYS = ["antigravityClientId", "antigravityClientSecret", "codexClientId", "xaiClientId"];

/** 소유자 설정 파일. 환경 변수 OPRN_OAUTH_CLIENTS_FILE 이 있으면 그 경로다. */
export function defaultOAuthClientsSettingsPath(env = process.env) {
  const override = env.OPRN_OAUTH_CLIENTS_FILE?.trim();
  if (override) return override;
  return path.join(homedir(), ".oprn", "oauth-clients.json");
}

/**
 * KDL 한 줄의 `field "value"` 를 읽는다. `encoding="base64"` 가 같은 지정에 있으면 디코드한다.
 * @param {string} text
 * @param {string} field
 * @returns {string | undefined}
 */
export function readQuotedAuthField(text, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`(?:^|[\\s{])${escaped}\\s+"([^"]+)"(\\s+encoding="base64")?`, "m"));
  if (!match?.[1]) return undefined;
  return match[2] ? decodeBase64(match[1]) : match[1];
}

function packageRoot(name) {
  try {
    const candidates = createRequire(import.meta.url).resolve.paths(name) ?? [];
    const folder = name.split("/").join(path.sep);
    return candidates
      .map((dir) => path.join(dir, folder))
      .find((dir) => existsSync(path.join(dir, "package.json")));
  } catch {
    return undefined;
  }
}

function readFile(root, relative) {
  if (!root) return "";
  try {
    return readFileSync(path.join(root, relative), "utf8");
  } catch {
    return "";
  }
}

/** @returns {Partial<import("../../src/ai/oauth/clientConfig.ts").OAuthClients>} */
export function readOAuthClientsFromPiAi() {
  const piAi = packageRoot("@oh-my-pi/pi-ai");
  const catalog = packageRoot("@oh-my-pi/pi-catalog");
  const antigravityTs = readFile(piAi, "src/registry/oauth/google-antigravity.ts");
  const codexTs = readFile(piAi, "src/registry/oauth/openai-codex.ts");
  const antigravityKdl = readFile(catalog, "src/compat/rules/auth/google-antigravity.kdl");
  const codexKdl = readFile(catalog, "src/compat/rules/auth/openai-codex.kdl");
  const xaiKdl = readFile(catalog, "src/compat/rules/auth/xai-oauth.kdl");

  const encoded = (name) => antigravityTs.match(new RegExp(`const ${name} = decode\\(\\s*"([A-Za-z0-9+/=]+)"`))?.[1];
  const tsId = encoded("CLIENT_ID");
  const tsSecret = encoded("CLIENT_SECRET");
  const tsCodex = codexTs.match(/const CLIENT_ID = "([^"]+)"/)?.[1];

  const kdlId = antigravityKdl ? readQuotedAuthField(antigravityKdl, "client-id") : undefined;
  const kdlSecret = antigravityKdl ? readQuotedAuthField(antigravityKdl, "client-secret") : undefined;
  const kdlCodex = codexKdl ? readQuotedAuthField(codexKdl, "client-id") : undefined;
  const kdlXai = xaiKdl ? readQuotedAuthField(xaiKdl, "client-id") : undefined;

  const id = kdlId || (tsId ? decodeBase64(tsId) : undefined);
  const secret = kdlSecret || (tsSecret ? decodeBase64(tsSecret) : undefined);
  const codexId = kdlCodex || tsCodex;
  return {
    ...(id ? { antigravityClientId: id } : {}),
    ...(secret ? { antigravityClientSecret: secret } : {}),
    ...(codexId ? { codexClientId: codexId } : {}),
    ...(kdlXai ? { xaiClientId: kdlXai } : {}),
  };
}

/**
 * 소유자 JSON. 키는 antigravityClientId, antigravityClientSecret, codexClientId, xaiClientId.
 * 파일이 없거나 JSON 이 아니면 빈 객체. 값은 로그에 남기지 않는다.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Partial<import("../../src/ai/oauth/clientConfig.ts").OAuthClients>}
 */
export function readOAuthClientsFromSettings(env = process.env) {
  const file = defaultOAuthClientsSettingsPath(env);
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    /** @type {Record<string, string>} */
    const out = {};
    for (const key of SETTINGS_KEYS) {
      const value = typeof parsed[key] === "string" ? parsed[key].trim() : "";
      if (value) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}
