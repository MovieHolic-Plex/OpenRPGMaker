export const DEFAULT_SUPABASE_PROJECT_ID = "rpg-zzu-house-template-gallery";

const STORAGE_KEY = "rpg-zzu:supabase-project-config";

export type SupabaseProjectConfig = {
  readonly anonKey: string;
  readonly projectId: string;
  readonly url: string;
};

export type SupabaseProjectConfigDraft = {
  readonly anonKey: string;
  readonly projectId: string;
  readonly url: string;
};

export type SupabaseProjectConfigSource = "custom" | "env" | "legacy";

export type SupabaseProjectConfigDraftWithSource = SupabaseProjectConfigDraft & {
  readonly source: SupabaseProjectConfigSource;
};

export type SupabaseProjectEnv = {
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
};

type StoredSupabaseProjectConfig = SupabaseProjectConfigDraft & {
  readonly source: "custom" | "legacy";
};

export function supabaseProjectConfig(env: SupabaseProjectEnv = import.meta.env): SupabaseProjectConfig | null {
  const draft = supabaseProjectConfigDraft(env);
  if (!draft.url || !draft.anonKey) return null;
  return { anonKey: draft.anonKey, projectId: draft.projectId, url: draft.url.replace(/\/$/, "") };
}

export function supabaseProjectConfigDraft(env: SupabaseProjectEnv = import.meta.env): SupabaseProjectConfigDraft {
  const draft = supabaseProjectConfigDraftWithSource(env);
  return { anonKey: draft.anonKey, projectId: draft.projectId, url: draft.url };
}

export function supabaseProjectConfigDraftWithSource(
  env: SupabaseProjectEnv = import.meta.env,
): SupabaseProjectConfigDraftWithSource {
  const stored = loadStoredSupabaseProjectConfig();
  const envDraft = supabaseProjectConfigDraftFromEnv(env);
  const shouldUseStored = stored.source === "custom" || !envDraft.url || !envDraft.anonKey;
  const source = shouldUseStored ? stored.source : "env";
  return {
    anonKey: shouldUseStored ? stored.anonKey || envDraft.anonKey : envDraft.anonKey,
    projectId: shouldUseStored ? stored.projectId || envDraft.projectId : envDraft.projectId,
    source,
    url: shouldUseStored ? stored.url || envDraft.url : envDraft.url,
  };
}

export function saveSupabaseProjectConfigDraft(draft: SupabaseProjectConfigDraft): void {
  browserStorage()?.setItem(STORAGE_KEY, JSON.stringify({ ...normalizeSupabaseProjectConfigDraft(draft), source: "custom" }));
}

export function clearSupabaseProjectConfigDraft(): void {
  browserStorage()?.removeItem(STORAGE_KEY);
}

function normalizeSupabaseProjectConfigDraft(draft: SupabaseProjectConfigDraft): SupabaseProjectConfigDraft {
  return {
    anonKey: draft.anonKey.trim(),
    projectId: draft.projectId.trim() || DEFAULT_SUPABASE_PROJECT_ID,
    url: draft.url.trim().replace(/\/$/, ""),
  };
}

function supabaseProjectConfigDraftFromEnv(env: SupabaseProjectEnv): SupabaseProjectConfigDraft {
  return {
    anonKey: env.VITE_SUPABASE_ANON_KEY?.trim() || "",
    projectId: env.VITE_SUPABASE_PROJECT_ID?.trim() || DEFAULT_SUPABASE_PROJECT_ID,
    url: env.VITE_SUPABASE_URL?.trim() || "",
  };
}

function loadStoredSupabaseProjectConfig(): StoredSupabaseProjectConfig {
  const raw = browserStorage()?.getItem(STORAGE_KEY);
  if (!raw) return emptySupabaseProjectConfigDraft();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return emptySupabaseProjectConfigDraft();
    const source = parsed.source === "custom" ? "custom" : "legacy";
    return {
      ...normalizeSupabaseProjectConfigDraft({
        anonKey: typeof parsed.anonKey === "string" ? parsed.anonKey : "",
        projectId: typeof parsed.projectId === "string" ? parsed.projectId : "",
        url: typeof parsed.url === "string" ? parsed.url : "",
      }),
      source,
    };
  } catch (error) {
    if (error instanceof SyntaxError) return emptySupabaseProjectConfigDraft();
    throw error;
  }
}

function emptySupabaseProjectConfigDraft(): StoredSupabaseProjectConfig {
  return { anonKey: "", projectId: "", source: "legacy", url: "" };
}

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
