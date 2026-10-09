// editor/mapUrlSync.ts
// 맵별 URL 동기화 + 브라우저 뒤로가기/앞으로가기 지원.
//
// - 맵 전환 시 `?map=<mapId>` 를 pushState로 기록 → 뒤로가기로 이전 맵 복귀.
// - popstate 이벤트로 히스토리 탐색 시 해당 맵으로 전환.
// - 부팅 시 URL의 `?map=` 파라미터를 읽어 해당 맵을 복원.
// - project URL 파라미터와 공존: `?project=xxx&map=yyy`

import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

const MAP_URL_PARAM = "map";

let installed = false;
let suppressPush = false;
let firstMapNav = true;

/** URL에서 map 파라미터를 읽는다. */
export function readMapFromUrl(search = browserSearch()): MapId | null {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get(MAP_URL_PARAM);
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * 맵 URL 동기화를 설치한다. 에디터 부팅 시 1회 호출.
 * - editorState 구독으로 맵 전환 시 pushState
 * - popstate 리스너로 뒤로가기/앞으로가기 시 맵 복원
 */
export function installMapUrlSync(): () => void {
  if (installed) return () => {};
  installed = true;

  // 맵 전환 → URL pushState
  const unsub = editorState.subscribe((state) => {
    if (suppressPush) return;
    const mapId = state.currentMapId;
    if (!mapId) return;
    pushMapToUrl(mapId);
  });

  // 뒤로가기/앞으로가기 → 맵 전환
  const onPopState = (): void => {
    const mapId = readMapFromUrl();
    if (!mapId) return;
    const project = store.getCurrent();
    if (!project.maps[mapId]) return;
    suppressPush = true;
    selectEditorMap(mapId);
    suppressPush = false;
  };
  window.addEventListener("popstate", onPopState);

  return () => {
    unsub();
    window.removeEventListener("popstate", onPopState);
    installed = false;
  };
}

/** 현재 URL에 map 파라미터를 기록한다.
 *  첫 맵 진입(부팅)은 replaceState — 뒤로가기가 에디터를 깔끔히 벗어나도록.
 *  이후 맵 전환은 pushState — 맵 간 뒤로/앞으로 탐색은 유지한다. */
function pushMapToUrl(mapId: MapId): void {
  if (typeof window === "undefined" || !window.history?.pushState) return;
  try {
    const url = new URL(window.location.href);
    const current = url.searchParams.get(MAP_URL_PARAM);
    if (current === mapId) return; // 동일 맵이면 스킵
    url.searchParams.set(MAP_URL_PARAM, mapId);
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (firstMapNav && typeof window.history.replaceState === "function") {
      window.history.replaceState({ mapId }, "", next);
    } else {
      window.history.pushState({ mapId }, "", next);
    }
    firstMapNav = false;
  } catch {
    /* ignore malformed location */
  }
}

/**
 * 부팅 시 URL의 map 파라미터로 맵을 복원한다.
 * 프로젝트 로드 완료 후 호출. 유효하지 않으면 startMapId로 폴백.
 */
export function restoreMapFromUrl(): boolean {
  const mapId = readMapFromUrl();
  if (!mapId) return false;
  const project = store.getCurrent();
  if (!project.maps[mapId]) return false;
  suppressPush = true;
  const ok = selectEditorMap(mapId);
  suppressPush = false;
  return ok;
}

function browserSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location?.search ?? "";
}
