// editor/mapBackgroundPreviewState.ts
//
// 맵 배경 **미리보기** 표시 상태.
//
// 왜 토글이 필요한가: 빈 하위 칸의 체커는 "여기 바닥이 없다" 를 눈에 보이게 하는 의도된 신호이고
// 사용자가 유지를 요구했다(2026-08-27). 그래서 캔버스는 기본값에서 배경을 그리지 않는다 —
// 그 신호를 덮으면 결함이 안 보인다. 저작자가 배경을 눈으로 확인하고 싶을 때만 이 토글로 켜고,
// 켠 동안에도 체커를 **옅게** 남겨 두 신호가 같이 읽히게 한다.
//
// 상태는 `localStorage` 에 남는다 — 다시 열어도 같은 화면이다. 캔버스는 이 모듈을 구독해
// 다시 그린다(구독이 없으면 토글이 아무 일도 안 한다: 씬은 에디터 상태만 본다).

/** 미리보기가 켜져 있는 동안의 저장 키. 값은 "1" 또는 없음. */
export const MAP_BACKGROUND_PREVIEW_STORAGE_KEY = "oprn:map-background-preview";

type Listener = (enabled: boolean) => void;

function readStoredEnabled(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let enabled = readStoredEnabled();
const listeners = new Set<Listener>();

export function mapBackgroundPreviewEnabled(): boolean {
  return enabled;
}

export function subscribeMapBackgroundPreview(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMapBackgroundPreview(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  try {
    if (typeof localStorage !== "undefined") {
      if (next) localStorage.setItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY, "1");
      else localStorage.removeItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY);
    }
  } catch {
    // 저장 실패는 세션 상태만으로 계속 동작한다.
  }
  for (const listener of listeners) listener(enabled);
}

export function toggleMapBackgroundPreview(): void {
  setMapBackgroundPreview(!enabled);
}

/** 테스트 전용 — 모듈 상태와 저장값을 함께 초기화한다. */
export function resetMapBackgroundPreviewForTests(): void {
  enabled = false;
  listeners.clear();
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY);
  } catch {
    // 저장소가 없는 환경(노드)에서는 세션 상태만 초기화한다.
  }
}
