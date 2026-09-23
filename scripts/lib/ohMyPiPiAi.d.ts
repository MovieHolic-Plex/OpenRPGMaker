// Type surface for ohMyPiPiAi.mjs (plain ESM JS). Consumers (vite.config.ts) import
// these names instead of deriving them from the factory's return type.

export interface OhMyPiProviderSummary {
  id: string;
  label: string;
  authKind: string;
  defaultModel: string;
  hasLogin: boolean;
  hasRefresh: boolean;
}

export interface OhMyPiAuthStatus {
  connected: boolean;
  provider: string;
  planType?: string;
  env?: boolean;
  /** 환경 변수 키를 봐도 되는지. ask 이면 아직 묻지 않았다. */
  envScan?: "ask" | "allow" | "deny";
  refreshed?: boolean;
  /** `/auth/status` 가 만료 토큰 갱신을 시작했지만 응답 전에 끝나지 않았다 — 다음 조회가 결과를 본다. */
  refreshing?: boolean;
  /** 자동 갱신이 실패한 이유. `refreshRetryAt`(epoch ms) 전에는 자동으로 다시 시도하지 않는다. */
  refreshError?: string;
  refreshRetryAt?: number;
  /** `/auth/logout` 이 지울 항이 실제로 있었는가. */
  removed?: boolean;
}

export interface OhMyPiLoginResult extends OhMyPiAuthStatus {
  verificationUrl: string;
  userCode: string;
  instructions?: string;
  needsApiKey?: boolean;
}

/** Non-streaming completions carry `completion`; streaming ones carry `chunks`. */
export interface OhMyPiCompletionResult {
  stream: boolean;
  completion?: unknown;
  chunks?: unknown[];
}

export interface OhMyPiOAuthSeed {
  access: string;
  refresh: string;
  expires: number;
}

/** Provider-agnostic auth + completion surface backed by the @oh-my-pi/pi-ai worker. */
export interface OhMyPiAdapters {
  listProviders(): Promise<OhMyPiProviderSummary[]>;
  status(provider: string): Promise<OhMyPiAuthStatus>;
  login(provider: string, body?: { apiKey?: string }): Promise<OhMyPiLoginResult>;
  saveKey(provider: string, apiKey: string): Promise<OhMyPiAuthStatus>;
  refresh(provider: string): Promise<OhMyPiAuthStatus>;
  logout(provider: string): Promise<OhMyPiAuthStatus>;
  seedOAuth(provider: string, creds: OhMyPiOAuthSeed): Promise<OhMyPiAuthStatus>;
  complete(provider: string, body: Record<string, unknown>): Promise<OhMyPiCompletionResult>;
  /** Pi 에이전트 실행. `ndjson` 은 워커의 진행 스트림(줄 = 이벤트)이다. */
  runAgent(provider: string, body: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<{ stream: true; ndjson: ReadableStream<Uint8Array> | null }>;
}

export function createOhMyPiAdapters(): Promise<OhMyPiAdapters>;
export function stopOhMyPiWorker(): void;
/** 개발 중 코드가 바뀌었을 때 호출한다 — 다음 요청이 워커를 새 코드로 다시 띄운다. */
export function markOhMyPiWorkerStale(): void;
