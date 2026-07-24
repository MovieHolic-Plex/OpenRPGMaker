// Type surface for codexOAuthSession.mjs (plain ESM JS). Consumers import these
// names; runtime is provided by the .mjs sibling.

export interface CodexJsonRpcResult {
  account?: {
    type?: string;
    planType?: string;
  };
  [key: string]: unknown;
}

export interface CodexAccountStatus {
  connected: boolean;
  planType?: string;
}

export interface CodexDeviceLogin {
  verificationUrl: string;
  userCode: string;
}

export interface CodexChatCompletionBody {
  stream?: boolean;
  [key: string]: unknown;
}

export interface CodexNonStreamCompletion {
  stream: false;
  completion: unknown;
}

export interface CodexStreamCompletion {
  stream: true;
  chunks: unknown[];
}

export type CodexCompletionResult = CodexNonStreamCompletion | CodexStreamCompletion;

export interface CodexSession {
  ready: () => Promise<void>;
  rpc: (method: string, params: unknown) => Promise<CodexJsonRpcResult>;
  notify: (method: string, params: unknown) => void;
  kill: () => void;
}

export function spawnCodexSession(): CodexSession;
export function accountStatus(session: CodexSession, refreshToken?: boolean): Promise<CodexAccountStatus>;
export function readChatGptToken(session: CodexSession): Promise<{ accessToken: string; accountId: string }>;
export function startDeviceLogin(session: CodexSession): Promise<CodexDeviceLogin>;
export function proxyCompletion(
  session: CodexSession,
  clientBody: CodexChatCompletionBody,
): Promise<CodexCompletionResult>;
