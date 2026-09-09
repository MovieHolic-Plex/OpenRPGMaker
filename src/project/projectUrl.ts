/**
 * 에디터 URL ↔ Supabase project 식별자 동기화.
 *
 * - `?project=<projectId>`  : 로드 대상 (정본)
 * - `?name=<title>`         : 사람이 읽는 제목 (공유/북마크용, 로드에는 불필요)
 *
 * 예: /?project=oprn-editor-demo-village&name=%EC%97%90%EB%94%94%ED%84%B0%20%EB%8D%B0%EB%AA%A8%20%EB%A7%88%EC%9D%84
 */

export const PROJECT_URL_PARAM = "project";
export const PROJECT_NAME_URL_PARAM = "name";

/** 구 북마크 호환 — projectId 도 읽는다 (쓰기에는 project 만 사용). */
const LEGACY_PROJECT_ID_PARAM = "projectId";

export type ProjectUrlState = {
  readonly projectId: string | null;
  readonly projectName: string | null;
};

export function readProjectFromUrl(search = browserSearch()): ProjectUrlState {
  try {
    const params = new URLSearchParams(search);
    const projectId =
      clean(params.get(PROJECT_URL_PARAM)) ??
      clean(params.get(LEGACY_PROJECT_ID_PARAM));
    const projectName = clean(params.get(PROJECT_NAME_URL_PARAM));
    return { projectId, projectName };
  } catch {
    return { projectId: null, projectName: null };
  }
}

/**
 * 주소창에 project / name 을 반영한다 (history.replaceState).
 * projectId 가 비면 project·name 파라미터를 제거한다.
 */
export function syncProjectToUrl(input: {
  readonly projectId: string | null | undefined;
  readonly projectName?: string | null | undefined;
  /** A verified showcase save-copy must reload its remote target, not the seed. */
  readonly clearDevProject?: boolean;
}): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    const id = clean(input.projectId ?? null);
    const name = clean(input.projectName ?? null);
    if (id) {
      if (input.clearDevProject) {
        for (const key of ["devProject", "freshProject", "blankProject"]) url.searchParams.delete(key);
      }
      url.searchParams.set(PROJECT_URL_PARAM, id);
      url.searchParams.delete(LEGACY_PROJECT_ID_PARAM);
      if (name) url.searchParams.set(PROJECT_NAME_URL_PARAM, name);
      else url.searchParams.delete(PROJECT_NAME_URL_PARAM);
    } else {
      url.searchParams.delete(PROJECT_URL_PARAM);
      url.searchParams.delete(LEGACY_PROJECT_ID_PARAM);
      url.searchParams.delete(PROJECT_NAME_URL_PARAM);
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      window.history.replaceState(window.history.state, "", next);
    }
  } catch {
    /* ignore malformed location */
  }
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function browserSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location?.search ?? "";
}
