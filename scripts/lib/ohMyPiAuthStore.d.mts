// scripts/lib/ohMyPiAuthStore.mjs 의 타입 선언. TS 호출자(scripts/lib/aiAuthRuntime.ts)가 쓴다.

export type OhMyPiAuthRow =
  | { readonly kind: "apiKey"; readonly apiKey: string; readonly source?: string }
  | {
    readonly kind: "oauth"; readonly access: string; readonly refresh: string; readonly expires: number;
    readonly enterpriseUrl?: string; readonly projectId?: string; readonly email?: string; readonly accountId?: string;
    readonly apiEndpoint?: string; readonly orgId?: string; readonly orgName?: string; readonly authorizedAt?: number;
    readonly source?: string;
  };

export type OhMyPiOAuthCredentials = {
  readonly access?: string; readonly refresh?: string; readonly expires?: number;
  readonly enterpriseUrl?: string; readonly projectId?: string; readonly email?: string; readonly accountId?: string;
  readonly apiEndpoint?: string; readonly orgId?: string; readonly orgName?: string; readonly authorizedAt?: number;
};

export type OhMyPiPublicStatus =
  | { readonly connected: false; readonly provider: string }
  | { readonly connected: boolean; readonly provider: string; readonly authKind: "apiKey" }
  | { readonly connected: boolean; readonly provider: string; readonly authKind: "oauth"; readonly planType?: string; readonly expired: boolean };

export interface OhMyPiAuthStore {
  readonly path: string;
  has(provider: string): boolean;
  get(provider: string): OhMyPiAuthRow | undefined;
  setApiKey(provider: string, apiKey: string): void;
  remove(provider: string): boolean;
  adoptionDeclined(provider: string): boolean;
  envScan(): "allow" | "deny" | "ask";
  setEnvScan(decision: "allow" | "deny"): "allow" | "deny";
  setOAuth(provider: string, creds: OhMyPiOAuthCredentials, options?: { readonly source?: string }): void;
  clear(provider: string): boolean;
  isExpired(provider: string): boolean;
  publicStatus(provider: string): OhMyPiPublicStatus;
}

export function defaultHomeOhMyPiAuthPath(): string;
export function legacyHomeOhMyPiAuthPath(): string;
export function defaultOhMyPiAuthPath(): string;
export function resolveLegacyOhMyPiAuthPath(filePath: string): string | undefined;
export function createOhMyPiAuthStore(filePath?: string, options?: { readonly legacyPath?: string | null; readonly log?: (message: string) => void }): OhMyPiAuthStore;
export const ohMyPiAuthStore: OhMyPiAuthStore;
