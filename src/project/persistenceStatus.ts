import {
  supabaseProjectConfigDraftWithSource,
  type SupabaseProjectConfigSource,
  type SupabaseProjectEnv,
} from "./supabaseProjectConfig";

export type DbPersistenceDisabledReason = "dev-showcase" | "load-failed" | "shared-demo";

export type DbPersistenceStatus =
  | { readonly kind: "disabled"; readonly reason: DbPersistenceDisabledReason }
  | {
      readonly kind: "not-configured";
      readonly missing: readonly DbConfigField[];
      readonly projectId: string;
      readonly source: SupabaseProjectConfigSource;
    }
  | { readonly kind: "ready"; readonly projectId: string; readonly source: SupabaseProjectConfigSource; readonly url: string };

export type DbConfigField = "url" | "anonKey";

export type DbPersistenceStatusInput = {
  readonly disabledReason: DbPersistenceDisabledReason | null;
  readonly env?: SupabaseProjectEnv;
};

export function dbPersistenceStatus(input: DbPersistenceStatusInput): DbPersistenceStatus {
  if (input.disabledReason) return { kind: "disabled", reason: input.disabledReason };
  const draft = supabaseProjectConfigDraftWithSource(input.env);
  const url = draft.url;
  const anonKey = draft.anonKey;
  const projectId = draft.projectId;
  const source = draft.source;
  const missing: DbConfigField[] = [];
  if (!url) missing.push("url");
  if (!anonKey) missing.push("anonKey");
  if (missing.length > 0) return { kind: "not-configured", missing, projectId, source };
  return { kind: "ready", projectId, source, url: url.replace(/\/$/, "") };
}
