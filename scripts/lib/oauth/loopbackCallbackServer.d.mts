// scripts/lib/oauth/loopbackCallbackServer.mjs 의 타입 선언(그 파일 JSDoc 과 같다).

export type OAuthCallbackServerOptions = {
  readonly preferredPort?: number;
  readonly callbackPath?: string;
  readonly expectedState?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly allowPortFallback?: boolean;
};

export type OAuthCallbackServer = {
  readonly port: number;
  readonly hosts: string[];
  readonly redirectUri: string;
  readonly waitForCode: Promise<{ code: string; state: string }>;
  readonly close: () => void;
};

export function startOAuthCallbackServer(options?: OAuthCallbackServerOptions): Promise<OAuthCallbackServer>;

export const OAUTH_CALLBACK_DEFAULTS: Readonly<{ port: number; callbackPath: string; timeoutMs: number; hostname: string }>;
