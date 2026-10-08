// 우리가 포팅한 OAuth 코드가 **실제 제공자 엔드포인트**와 말이 통하는지 확인한다.
// Bun 없이 (node + vite-node) 돌아야 한다는 것이 이 스크립트의 두 번째 주장이다.
//
// 실행: npx vite-node --script scripts/verify-ported-oauth-live.mts [--refresh] [--from-codex-cli]
//
// 기본(--refresh 없음)은 **부작용이 없다**: Codex 디바이스 인가를 실제로 시작해 user_code 를
// 받아오는 것까지만 한다(승인하지 않으면 아무 자격도 만들어지지 않는다).
// `--refresh` 는 저장된 Codex refresh 토큰을 실제로 교환한다 — OpenAI 는 교환 시 refresh 토큰을
// 회전시키므로 **새 자격을 프로젝트 저장소에 다시 써야 한다**. 그러지 않으면 다음 호출이 이미
// 폐기된 토큰을 들고 간다.
//
// 토큰 값은 어떤 경로로도 출력하지 않는다. 길이·만료·불리언만 찍는다.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  pollCodexDeviceAuthorization,
  refreshCodexToken,
  startCodexDeviceAuthorization,
} from "../src/ai/oauth/codexDeviceOAuth";
import { createOhMyPiAuthStore, defaultOhMyPiAuthPath } from "./lib/ohMyPiAuthStore.mjs";
import { configureOAuthClients } from "../src/ai/oauth/clientConfig.ts";
import { readOAuthClientsFromPiAi } from "./lib/oauthClients.mjs";

// 남의 앱 OAuth 클라이언트 값은 저장소에 없다 — 설치된 참조 구현에서 읽는다(src/ai/oauth/clientConfig.ts).
configureOAuthClients(readOAuthClientsFromPiAi());

const wantsRefresh = process.argv.includes("--refresh");
/** 실제 승인까지 기다린다. 사용자가 브라우저에서 코드를 넣어야 끝난다. */
const wantsLogin = process.argv.includes("--login");
/** 프로젝트 저장소의 사본이 회전으로 죽었을 때, Codex CLI 가 들고 있는 현재 토큰으로 확인한다. */
const preferCodexCli = process.argv.includes("--from-codex-cli");

function readCodexCliRefreshToken(): { source: string; refresh: string } | null {
  const codexPath = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");
  try {
    const tokens = JSON.parse(readFileSync(codexPath, "utf8"))?.tokens;
    const refresh = typeof tokens?.refresh_token === "string" ? tokens.refresh_token : "";
    return refresh ? { source: codexPath, refresh } : null;
  } catch {
    return null;
  }
}

function readStoredRefreshToken(): { source: string; refresh: string } | null {
  if (preferCodexCli && !wantsLogin) return readCodexCliRefreshToken();
  const store = createOhMyPiAuthStore(defaultOhMyPiAuthPath());
  const row = store.get("openai-codex");
  if (row?.kind === "oauth" && typeof row.refresh === "string" && row.refresh.length > 0) {
    return { source: defaultOhMyPiAuthPath(), refresh: row.refresh };
  }
  return readCodexCliRefreshToken();
}

console.log(`runtime: node ${process.version} (bun not used)`);
console.log(`bun executable reachable: ${existsSync(join(homedir(), ".bun", "bin", "bun")) ? "installed on this machine" : "absent"} (unused by this script)`);

const device = await startCodexDeviceAuthorization({});
console.log("--- live device authorization (no side effects, nothing approved) ---");
console.log(`ok: ${Boolean(device.deviceAuthId && device.userCode)}`);
console.log(`verificationUrl: ${device.verificationUrl}`);
console.log(`userCode.length: ${device.userCode.length}`);
console.log(`userCode.shape: ${device.userCode.replace(/[A-Z0-9]/gu, "X")}`);
console.log(`deviceAuthId.length: ${device.deviceAuthId.length}`);
console.log(`pollIntervalMs: ${device.pollIntervalMs}`);

if (wantsLogin) {
  console.log("--- waiting for approval: open the URL above and enter the code ---");
  console.log(`ENTER THIS CODE: ${device.userCode}`);
  const credentials = await pollCodexDeviceAuthorization(device);
  const loginStore = createOhMyPiAuthStore(defaultOhMyPiAuthPath());
  loginStore.setOAuth("openai-codex", credentials);
  console.log("--- login completed through our own ported device flow ---");
  console.log(`ok: ${Boolean(credentials.access && credentials.refresh)}`);
  console.log(`access.length: ${credentials.access.length}`);
  console.log(`refresh.length: ${credentials.refresh.length}`);
  console.log(`expiresInSeconds: ${Math.round((credentials.expires - Date.now()) / 1000)}`);
  console.log(`accountId.present: ${Boolean(credentials.accountId)}`);
  console.log(`planType: ${credentials.orgName ?? "(none)"}`);
  console.log(`persistedTo: ${defaultOhMyPiAuthPath()}`);
}

if (!wantsRefresh) {
  console.log("--- refresh skipped (pass --refresh to exchange the stored token) ---");
  process.exit(0);
}

const stored = readStoredRefreshToken();
if (!stored) {
  console.error("no stored Codex refresh token found — run the editor login first");
  process.exit(1);
}
console.log("--- live refresh through our own ported code ---");
console.log(`refreshTokenSource: ${stored.source}`);

const refreshed = await refreshCodexToken({ refreshToken: stored.refresh });
const store = createOhMyPiAuthStore(defaultOhMyPiAuthPath());
const previous = store.get("openai-codex");
store.setOAuth("openai-codex", { ...(previous ?? {}), ...refreshed });

console.log(`ok: ${Boolean(refreshed.access)}`);
console.log(`access.length: ${refreshed.access.length}`);
console.log(`refresh.length: ${refreshed.refresh.length}`);
console.log(`refreshTokenRotated: ${refreshed.refresh !== stored.refresh}`);
console.log(`expiresInSeconds: ${Math.round((refreshed.expires - Date.now()) / 1000)}`);
console.log(`expiresInFuture: ${refreshed.expires > Date.now()}`);
console.log(`accountId.present: ${Boolean(refreshed.accountId)}`);
console.log(`email.domain: ${refreshed.email ? `@${refreshed.email.split("@")[1]}` : "(none)"}`);
console.log(`rotatedCredentialPersistedTo: ${defaultOhMyPiAuthPath()}`);
