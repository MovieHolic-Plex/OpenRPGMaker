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
  refreshed?: boolean;
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
  seedOAuth(provider: string, creds: OhMyPiOAuthSeed): Promise<OhMyPiAuthStatus>;
  complete(provider: string, body: Record<string, unknown>): Promise<OhMyPiCompletionResult>;
}

export function createOhMyPiAdapters(): Promise<OhMyPiAdapters>;
export function stopOhMyPiWorker(): void;
