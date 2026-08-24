import { readProjectFromUrl } from "./projectUrl";
import { resolveBrowserSupabaseUrl } from "./supabaseProxyPath";

export const DEFAULT_SUPABASE_PROJECT_ID = "rpg-zzu-house-template-gallery";

const STORAGE_KEY = "oprn:supabase-project-config";
const SELECTED_PROJECT_STORAGE_KEY = "oprn:supabase-selected-project";

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
  const url = resolveBrowserSupabaseUrl(draft.url, {
    pageProtocol: typeof window === "undefined" ? undefined : window.location?.protocol,
  });
  return { anonKey: draft.anonKey, projectId: draft.projectId, url };
}

export function supabaseProjectConfigDraft(env: SupabaseProjectEnv = import.meta.env): SupabaseProjectConfigDraft {
  const draft = supabaseProjectConfigDraftWithSource(env);
  return { anonKey: draft.anonKey, projectId: draft.projectId, url: draft.url };
}

export function supabaseProjectConfigDraftWithSource(
  env: SupabaseProjectEnv = import.meta.env,
): SupabaseProjectConfigDraftWithSource {
  const stored = loadStoredSupabaseProjectConfig();
  const storedSelection = loadStoredSupabaseSelectedProjectId();
  const envDraft = supabaseProjectConfigDraftFromEnv(env);
  // custom 은 URL/Anon 중 하나라도 있을 때만 “의도적 사용자 설정”으로 본다.
  // (빈 custom + 기본 projectId 만 남은 캐시가 env 프리필을 막던 회귀 방지)
  const customActive = stored.source === "custom" && (stored.url.length > 0 || stored.anonKey.length > 0);
  const deploymentConfigured = envDraft.url.length > 0 && envDraft.anonKey.length > 0;
  const url = deploymentConfigured
    ? envDraft.url
    : customActive && stored.url
      ? stored.url
      : envDraft.url || stored.url;
  const anonKey = deploymentConfigured
    ? envDraft.anonKey
    : customActive && stored.anonKey
      ? stored.anonKey
      : envDraft.anonKey || stored.anonKey;
  // URL ?project= 가 있으면 로드 대상을 그쪽으로 고정 (공유 링크 / 북마크).
  const urlProjectId = readProjectFromUrl().projectId;
  const projectId =
    urlProjectId
      ? urlProjectId
      : storedSelection
        ? storedSelection
        : customActive && stored.projectId
          ? stored.projectId
          : envDraft.projectId || stored.projectId || DEFAULT_SUPABASE_PROJECT_ID;
  const source: SupabaseProjectConfigSource = deploymentConfigured
    ? "env"
    : customActive
      ? "custom"
      : envDraft.url && envDraft.anonKey
      ? "env"
      : stored.url || stored.anonKey
        ? "legacy"
        : envDraft.url || envDraft.anonKey
          ? "env"
          : "legacy";
  return { anonKey, projectId, source, url };
}

/** 브라우저의 레거시 custom 설정과 작업 선택을 지우고 배포 기본값으로 돌아간다. */
export function resetSupabaseProjectConfigToEnv(env: SupabaseProjectEnv = import.meta.env): SupabaseProjectConfigDraftWithSource {
  clearSupabaseProjectConfigDraft();
  clearSupabaseSelectedProjectId();
  return supabaseProjectConfigDraftWithSource(env);
}

export function saveSupabaseProjectConfigDraft(draft: SupabaseProjectConfigDraft): void {
  browserStorage()?.setItem(STORAGE_KEY, JSON.stringify({ ...normalizeSupabaseProjectConfigDraft(draft), source: "custom" }));
}

export function clearSupabaseProjectConfigDraft(): void {
  browserStorage()?.removeItem(STORAGE_KEY);
}

/** Remember only which work the user selected; deployment credentials never pass through this path. */
export function saveSupabaseSelectedProjectId(projectId: string): void {
  const normalized = projectId.trim();
  if (!normalized) {
    clearSupabaseSelectedProjectId();
    return;
  }
  browserStorage()?.setItem(SELECTED_PROJECT_STORAGE_KEY, normalized);
}

export function clearSupabaseSelectedProjectId(): void {
  browserStorage()?.removeItem(SELECTED_PROJECT_STORAGE_KEY);
}

export function hasStoredSupabaseProjectSelection(): boolean {
  if (loadStoredSupabaseSelectedProjectId()) return true;
  const legacy = loadStoredSupabaseProjectConfig();
  return Boolean(legacy.projectId && (legacy.url || legacy.anonKey));
}

function normalizeSupabaseProjectConfigDraft(draft: SupabaseProjectConfigDraft): SupabaseProjectConfigDraft {
  return {
    anonKey: draft.anonKey.trim(),
    projectId: draft.projectId.trim() || DEFAULT_SUPABASE_PROJECT_ID,
    url: draft.url.trim().replace(/\/$/, ""),
  };
}

function supabaseProjectConfigDraftFromEnv(env: SupabaseProjectEnv): SupabaseProjectConfigDraft {
  // projectId 기본값은 병합 단계에서만 적용한다 — env에 키가 없을 때 legacy 저장값을 덮지 않기 위함.
  return {
    anonKey: env.VITE_SUPABASE_ANON_KEY?.trim() || "",
    projectId: env.VITE_SUPABASE_PROJECT_ID?.trim() || "",
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

function loadStoredSupabaseSelectedProjectId(): string {
  return browserStorage()?.getItem(SELECTED_PROJECT_STORAGE_KEY)?.trim() || "";
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
