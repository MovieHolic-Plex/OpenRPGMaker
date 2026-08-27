// OpenAI Codex(ChatGPT) 브라우저 루프백 PKCE 로그인 — omp 의 loginOpenAICodex 대응.
//
// 이 저장소는 Codex 로그인을 디바이스 코드로만 포팅했었다. 그래서 1455 가 비어 있어도
// 사용자는 매번 코드를 손으로 옮겨 적어야 했다. omp 는 브라우저 흐름을 주력으로 쓰고
// 디바이스 흐름은 1455 를 못 잡을 때의 대체로 둔다 — 이 파일이 그 주력 경로다.
//
// node:/Bun API 를 쓰지 않는다(소켓은 scripts/lib/oauth/loopbackCallbackServer.mjs 담당).

import {
  CODEX_CLIENT_ID,
  CODEX_DEVICE_VERIFICATION_URL,
  type CodexDeviceAuthorization,
} from "./codexDeviceOAuth.ts";

export const CODEX_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
export const CODEX_BROWSER_CALLBACK_PORT = 1455;
export const CODEX_BROWSER_CALLBACK_PATH = "/auth/callback";
/**
 * OpenAI 허용목록에 등록된 유일한 루프백 redirect_uri. 포트를 바꾸거나 127.0.0.1 로
 * 바꿔 적으면 인가 자체는 통과해도 토큰 교환이 403 으로 끊긴다 — 그래서 상수다.
 */
export const CODEX_BROWSER_REDIRECT_URI =
  `http://localhost:${CODEX_BROWSER_CALLBACK_PORT}${CODEX_BROWSER_CALLBACK_PATH}`;
export const CODEX_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "api.connectors.read",
  "api.connectors.invoke",
] as const;
/** 우리가 빌려 쓰는 client_id 의 짝(Codex CLI). omp 는 자기 식별자로 "pi" 를 보낸다. */
export const CODEX_DEFAULT_ORIGINATOR = "codex_cli_rs";

const PKCE_VERIFIER_BYTES = 96;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export async function generatePkcePair(): Promise<PkcePair> {
  const verifierBytes = new Uint8Array(PKCE_VERIFIER_BYTES);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64Url(verifierBytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export interface BuildCodexAuthorizationUrlOptions {
  state: string;
  redirectUri: string;
  codeChallenge: string;
  originator?: string;
}

export function buildCodexAuthorizationUrl({
  state,
  redirectUri,
  codeChallenge,
  originator,
}: BuildCodexAuthorizationUrlOptions): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CODEX_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: CODEX_SCOPES.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    // 이 둘이 빠지면 조직 선택이 없는 토큰이 와서 chatgpt_account_id 추출이 깨진다.
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: originator?.trim() || CODEX_DEFAULT_ORIGINATOR,
  });
  return `${CODEX_AUTHORIZE_URL}?${params.toString()}`;
}

export interface CallbackServerHandle {
  port: number;
  redirectUri: string;
  waitForCode: Promise<{ code: string; state: string }>;
  close: () => void;
}

export interface BeginCodexLoginDeps {
  openCallbackServer: (options: {
    preferredPort: number;
    callbackPath: string;
    expectedState: string;
    allowPortFallback: boolean;
    signal?: AbortSignal;
  }) => Promise<CallbackServerHandle>;
  startDeviceAuthorization: () => Promise<CodexDeviceAuthorization>;
  state?: string;
  originator?: string;
  signal?: AbortSignal;
}

export interface CodexBrowserLoginStart {
  mode: "browser";
  verificationUrl: string;
  userCode: "";
  instructions: string;
  codeVerifier: string;
  redirectUri: string;
  waitForCode: Promise<{ code: string; state: string }>;
  close: () => void;
}

export interface CodexDeviceLoginStart {
  mode: "device";
  verificationUrl: string;
  userCode: string;
  instructions: string;
  device: CodexDeviceAuthorization;
}

export type CodexLoginStart = CodexBrowserLoginStart | CodexDeviceLoginStart;

function isPortUnavailable(cause: unknown): boolean {
  const code = (cause as { code?: unknown } | null)?.code;
  if (code === "EADDRINUSE") return true;
  return cause instanceof Error && cause.message.includes("EADDRINUSE");
}

const PORT_BUSY_INSTRUCTIONS =
  `1455 포트를 다른 프로그램이 쓰고 있어 브라우저 자동 완료를 쓸 수 없습니다. `
  + `OpenAI 는 http://localhost:1455/auth/callback 만 허용하므로 다른 포트로 옮길 수 없어 `
  + `코드 입력 방식으로 진행합니다.`;

async function startDeviceMode(
  startDeviceAuthorization: BeginCodexLoginDeps["startDeviceAuthorization"],
  instructions: string,
): Promise<CodexDeviceLoginStart> {
  const device = await startDeviceAuthorization();
  return {
    mode: "device",
    verificationUrl: device.verificationUrl || CODEX_DEVICE_VERIFICATION_URL,
    userCode: device.userCode,
    instructions,
    device,
  };
}

export async function beginCodexLogin(deps: BeginCodexLoginDeps): Promise<CodexLoginStart> {
  const state = deps.state ?? crypto.randomUUID();
  const pkce = await generatePkcePair();

  let handle: CallbackServerHandle;
  try {
    handle = await deps.openCallbackServer({
      preferredPort: CODEX_BROWSER_CALLBACK_PORT,
      callbackPath: CODEX_BROWSER_CALLBACK_PATH,
      expectedState: state,
      allowPortFallback: false,
      signal: deps.signal,
    });
  } catch (cause) {
    if (!isPortUnavailable(cause)) throw cause;
    return startDeviceMode(deps.startDeviceAuthorization, PORT_BUSY_INSTRUCTIONS);
  }

  // 폴백 금지를 서버가 지키지 않았다면 교환이 403 이 된다. 조용히 실패하지 않고 대체 경로로 간다.
  if (handle.port !== CODEX_BROWSER_CALLBACK_PORT) {
    handle.close();
    return startDeviceMode(deps.startDeviceAuthorization, PORT_BUSY_INSTRUCTIONS);
  }

  return {
    mode: "browser",
    verificationUrl: buildCodexAuthorizationUrl({
      state,
      redirectUri: CODEX_BROWSER_REDIRECT_URI,
      codeChallenge: pkce.challenge,
      originator: deps.originator,
    }),
    userCode: "",
    instructions: "브라우저에서 ChatGPT 로 로그인하면 자동으로 완료됩니다.",
    codeVerifier: pkce.verifier,
    redirectUri: CODEX_BROWSER_REDIRECT_URI,
    waitForCode: handle.waitForCode,
    close: handle.close,
  };
}
