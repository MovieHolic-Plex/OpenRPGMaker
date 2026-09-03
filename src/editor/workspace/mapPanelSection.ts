// editor/workspace/mapPanelSection.ts
// 좌측 도크 「맵」 섹션의 접힘 상태 — 헤더(mapList.ts)가 바꾸고 레이아웃(editor.ts)이 읽는다.
//
// 왜 별 모듈인가: 접힘은 두 곳이 같은 답을 알아야 한다. 헤더는 aria-expanded 와 갈매기 방향을
// 그려야 하고, 도크 레이아웃은 `--map-tree-height` 를 헤더 한 줄로 줄여야 한다. mapList 가
// editor.ts 를 import 하면 순환이 생기고(editor.ts 가 레지스트리를 거쳐 mapList 를 그린다),
// editor.ts 가 mapList 의 내부 변수를 읽는 것은 소유 경계를 깬다. 그래서 상태는 여기 하나다.
//
// 저장은 localStorage 한 키. 접힘은 사용자의 작업 공간 선택이라 새로고침 뒤에도 남아야 한다
// (`collapsedMapIds` 와 같은 이유, mapList.ts).

const STORAGE_KEY = "oprn:map-panel-collapsed";

let collapsed = load();
const listeners = new Set<() => void>();

function load(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persist(): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (collapsed) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota / private mode — 세션 안에서만 유지 */
  }
}

export function isMapPanelCollapsed(): boolean {
  return collapsed;
}

export function setMapPanelCollapsed(next: boolean): void {
  if (next === collapsed) return;
  collapsed = next;
  persist();
  for (const listener of [...listeners]) listener();
}

export function toggleMapPanelCollapsed(): boolean {
  setMapPanelCollapsed(!collapsed);
  return collapsed;
}

export function subscribeMapPanel(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetMapPanelSectionForTests(): void {
  collapsed = false;
  listeners.clear();
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
