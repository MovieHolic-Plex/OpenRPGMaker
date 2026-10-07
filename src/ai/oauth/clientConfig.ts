// 다른 회사 앱의 공개 OAuth 클라이언트 값 — Antigravity 데스크톱 앱의 client id·secret, Codex CLI 의 client id.
//
// 설치형 앱의 client_secret 은 OAuth 규격상 비밀이 아니지만(RFC 8252 §8.5), 남의 앱 자격이라
// 공개 저장소(OpenRPGMaker)에 우리 손으로 적지 않는다(2026-10-08 사용자 결정). 값은 실행 환경이 넣는다:
//   1. 환경변수 OPRN_ANTIGRAVITY_CLIENT_ID · OPRN_ANTIGRAVITY_CLIENT_SECRET · OPRN_CODEX_CLIENT_ID
//   2. configureOAuthClients() — Node 진입점이 설치된 참조 구현(@oh-my-pi/pi-ai)에서 읽어 넣는다
//      (scripts/lib/oauthClients.mjs, aiAuthRuntime.ts).
//   3. 빌드 주입 __OPRN_OAUTH_CLIENTS__ — 배포용 Electron 메인(scripts/build-electron.mjs)
// 이 모듈은 node:* 를 쓰지 않는다 — 형제 모듈들과 같이 브라우저/Node/테스트에서 동일하게 돈다.

export type OAuthClientKey = "antigravityClientId" | "antigravityClientSecret" | "codexClientId";
export type OAuthClients = Record<OAuthClientKey, string>;

declare const __OPRN_OAUTH_CLIENTS__: Partial<OAuthClients> | undefined;

const ENV_NAMES: Record<OAuthClientKey, string> = {
  antigravityClientId: "OPRN_ANTIGRAVITY_CLIENT_ID",
  antigravityClientSecret: "OPRN_ANTIGRAVITY_CLIENT_SECRET",
  codexClientId: "OPRN_CODEX_CLIENT_ID",
};

let configured: Partial<OAuthClients> = {};

/** Node 진입점·테스트가 값을 넣는다. 빈 문자열은 넣지 않은 것으로 본다. */
export function configureOAuthClients(clients: Partial<OAuthClients>): void {
  configured = { ...configured };
  for (const key of Object.keys(ENV_NAMES) as OAuthClientKey[]) {
    const value = clients[key]?.trim();
    if (value) configured[key] = value;
  }
}

function fromEnv(key: OAuthClientKey): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[ENV_NAMES[key]]?.trim() || undefined;
}

function fromBuild(key: OAuthClientKey): string | undefined {
  // define 이 없는 번들(vite·vitest·tsx)에서는 이 식별자가 선언되지 않는다 — typeof 로만 읽는다.
  return typeof __OPRN_OAUTH_CLIENTS__ === "undefined" ? undefined : __OPRN_OAUTH_CLIENTS__?.[key]?.trim() || undefined;
}

/** 로그인·갱신 요청을 만들 때 부른다. 값이 없으면 어느 설정이 빠졌는지 말하며 던진다. */
export function oauthClient(key: OAuthClientKey): string {
  const value = fromEnv(key) ?? configured[key] ?? fromBuild(key);
  if (!value) {
    throw new Error(
      `${ENV_NAMES[key]} 가 설정되지 않았다 — 환경변수로 넣거나, @oh-my-pi/pi-ai 가 설치된 Node 에서 실행해야 한다(scripts/lib/oauthClients.mjs).`,
    );
  }
  return value;
}
