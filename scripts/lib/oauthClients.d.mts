import type { OAuthClients } from "../../src/ai/oauth/clientConfig.ts";

export declare function defaultOAuthClientsSettingsPath(env?: NodeJS.ProcessEnv): string;
export declare function readQuotedAuthField(text: string, field: string): string | undefined;
export declare function readOAuthClientsFromPiAi(): Partial<OAuthClients>;
export declare function readOAuthClientsFromSettings(env?: NodeJS.ProcessEnv): Partial<OAuthClients>;
