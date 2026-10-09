// Companion cache for oh-my-pi providers. Tokens/keys stay on the machine, never in the browser.
// Path: $OPRN_OH_MY_PI_AUTH_PATH or ~/.oprn/oh-my-pi-auth.json. The normal source of
// an existing OMP login is ~/.omp/agent/agent.db; this file caches the adopted row.
//
// 2026-09 제품명 스윕 전에는 ~/.oprn/oh-my-pi-auth.json 이었다. 로그인한 사용자를 다시
// 로그인시키지 않으려고, 새 파일이 없고 옛 파일이 있으면 **첫 읽기에서 한 번 복사**한다.
// 옛 파일은 지우지 않는다(이전 릴리스로 되돌려도 자격이 살아 있어야 한다). 환경 변수로
// 경로를 명시한 경우에는 옛 홈 파일을 끌어오지 않는다 — 그 파일은 사용자가 고른 것이다.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { applyLegacyEnvAliases } from "./oprnEnv.mjs";

applyLegacyEnvAliases();

const AUTH_FILE_NAME = "oh-my-pi-auth.json";

/** 환경 변수가 없을 때의 기본 위치. */
export function defaultHomeOhMyPiAuthPath() {
  return join(homedir(), ".oprn", AUTH_FILE_NAME);
}

/** 개명 전 위치 — 읽기 입양 전용. 새로 쓰는 코드는 이 경로에 쓰지 않는다. */
export function legacyHomeOhMyPiAuthPath() {
  return join(homedir(), ".rpg-zzu", AUTH_FILE_NAME);
}

export function defaultOhMyPiAuthPath() {
  return process.env.OPRN_OH_MY_PI_AUTH_PATH || defaultHomeOhMyPiAuthPath();
}

/** 기본 홈 경로일 때만 옛 홈 파일을 입양 후보로 삼는다. 명시 경로(env·테스트)에는 후보가 없다. */
export function resolveLegacyOhMyPiAuthPath(filePath) {
  return filePath === defaultHomeOhMyPiAuthPath() ? legacyHomeOhMyPiAuthPath() : undefined;
}

function defaultLog(message) {
  process.stderr.write(`${message}\n`);
}

/** 새 파일이 없고 옛 파일이 있을 때만 복사한다. 복사했으면 true. */
function adoptLegacyAuthFile(filePath, legacyPath, log) {
  if (!legacyPath || existsSync(filePath) || !existsSync(legacyPath)) return false;
  mkdirSync(dirname(filePath), { recursive: true });
  copyFileSync(legacyPath, filePath);
  log(`[oprn] 제공자 자격 파일을 ${legacyPath} 에서 ${filePath} 로 복사했습니다. 옛 파일은 남겨 둡니다.`);
  return true;
}

function emptyDoc() {
  return { version: 1, providers: {}, declined: {}, envScan: "ask" };
}

function readDoc(path) {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!raw || typeof raw !== "object") return emptyDoc();
    const providers = raw.providers && typeof raw.providers === "object" ? raw.providers : {};
    const declined = raw.declined && typeof raw.declined === "object" ? raw.declined : {};
    const envScan = raw.envScan === "allow" || raw.envScan === "deny" ? raw.envScan : "ask";
    return { version: 1, providers, declined, envScan };
  } catch {
    return emptyDoc();
  }
}

function writeDoc(path, doc) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

/**
 * @param {string} [filePath]
 * @param {{ legacyPath?: string | null; log?: (message: string) => void }} [options]
 *   legacyPath — 입양할 옛 파일. 생략하면 기본 홈 경로일 때만 옛 홈 파일, null 이면 입양 안 함.
 */
export function createOhMyPiAuthStore(filePath = defaultOhMyPiAuthPath(), options = {}) {
  const legacyPath = "legacyPath" in options ? (options.legacyPath ?? undefined) : resolveLegacyOhMyPiAuthPath(filePath);
  const log = options.log ?? defaultLog;
  let adoptionAttempted = false;
  const load = () => {
    if (!adoptionAttempted) {
      adoptionAttempted = true;
      try {
        adoptLegacyAuthFile(filePath, legacyPath, log);
      } catch (error) {
        log(`[oprn] 옛 자격 파일(${legacyPath})을 ${filePath} 로 복사하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return readDoc(filePath);
  };
  const save = (doc) => writeDoc(filePath, doc);

  return {
    path: filePath,
    has(provider) {
      return Boolean(load().providers[provider]);
    },
    get(provider) {
      const row = load().providers[provider];
      return row && typeof row === "object" ? row : undefined;
    },
    setApiKey(provider, apiKey) {
      const doc = load();
      doc.providers[provider] = { kind: "apiKey", apiKey: String(apiKey) };
      delete doc.declined[provider];
      save(doc);
    },
    /**
     * 자격을 지운다. 로그인이 아니라 **사용자가 연결을 끊은 것**이므로 자동 채용
     * (`~/.codex/auth.json` 입양)을 함께 막는다 — 그러지 않으면 다음 상태 조회에서
     * 같은 자격이 되살아나 연결 해제가 눈속임이 된다.
     */
    remove(provider) {
      const doc = load();
      const existed = Boolean(doc.providers[provider]);
      delete doc.providers[provider];
      doc.declined[provider] = true;
      save(doc);
      return existed;
    },
    /** 사용자가 이 제공자의 연결을 끊었는가 — 디스크 자격 자동 채용을 막는 표시다. */
    adoptionDeclined(provider) {
      return Boolean(load().declined[provider]);
    },
    /** 환경 변수 키를 봐도 되는가. 기본은 ask — 동의 전에는 읽지 않는다. */
    envScan() {
      const value = load().envScan;
      return value === "allow" || value === "deny" ? value : "ask";
    },
    setEnvScan(decision) {
      if (decision !== "allow" && decision !== "deny") throw new Error("env scan decision");
      const doc = load();
      doc.envScan = decision;
      save(doc);
      return decision;
    },
    setOAuth(provider, creds, options = {}) {
      const doc = load();
      delete doc.declined[provider];
      doc.providers[provider] = {
        kind: "oauth",
        access: String(creds.access ?? ""),
        refresh: String(creds.refresh ?? ""),
        expires: Number(creds.expires) || 0,
        enterpriseUrl: creds.enterpriseUrl,
        projectId: creds.projectId,
        email: creds.email,
        accountId: creds.accountId,
        apiEndpoint: creds.apiEndpoint,
        orgId: creds.orgId,
        orgName: creds.orgName,
        authorizedAt: creds.authorizedAt,
        ...(typeof options.source === "string" && options.source ? { source: options.source } : {}),
      };
      save(doc);
    },
    /** Delete a credential without recording an explicit user disconnect. */
    clear(provider) {
      const doc = load();
      const existed = Boolean(doc.providers[provider]);
      delete doc.providers[provider];
      save(doc);
      return existed;
    },
    isExpired(provider) {
      const row = this.get(provider);
      if (!row || row.kind !== "oauth") return false;
      return Date.now() >= Number(row.expires || 0);
    },
    publicStatus(provider) {
      const row = this.get(provider);
      if (!row) return { connected: false, provider };
      if (row.kind === "apiKey") return { connected: Boolean(row.apiKey), provider, authKind: "apiKey" };
      const expired = Date.now() >= Number(row.expires || 0);
      return {
        connected: !expired && Boolean(row.access || row.refresh),
        provider,
        authKind: "oauth",
        planType: row.orgName,
        expired,
      };
    },
  };
}

export const ohMyPiAuthStore = createOhMyPiAuthStore();
