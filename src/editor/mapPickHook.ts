// src/editor/mapPickHook.ts
/**
 * 맵 칸 한 번 고르기 — 다음 왼쪽 클릭 한 번을 붓·이벤트 도구보다 먼저 가로챈다(EditScene pointerdown).
 * 공방 「한 번에 만들기」가 새 캐릭터를 NPC 로 놓을 때 쓴다: 「맵에 놓기」 → 맵을 누르면 그 칸에 선다. Esc 로 그만둔다.
 */
export type MapPickHandler = (mapId: string, x: number, y: number) => boolean;

let handler: MapPickHandler | null = null;
let onCancel: (() => void) | null = null;

function onKey(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !handler) return;
  cancelMapPick();
}

/** 다음 맵 클릭 한 번을 받는다. handler 가 true 를 돌려주면 끝, false 면 계속 기다린다. */
export function armMapPick(next: MapPickHandler, cancelled?: () => void): void {
  cancelMapPick();
  handler = next;
  onCancel = cancelled ?? null;
  window.addEventListener("keydown", onKey, true);
  document.body.classList.add("is-map-picking");
}

export function cancelMapPick(): void {
  const cancelled = handler ? onCancel : null;
  handler = null;
  onCancel = null;
  window.removeEventListener("keydown", onKey, true);
  document.body.classList.remove("is-map-picking");
  cancelled?.();
}

export function isMapPickArmed(): boolean {
  return handler !== null;
}

/** EditScene 이 부른다 — 받았으면 true(붓·이벤트 도구는 이 클릭을 쓰지 않는다). */
export function consumeMapPick(mapId: string, x: number, y: number): boolean {
  if (!handler) return false;
  const current = handler;
  if (!current(mapId, x, y)) return true;
  if (handler === current) {
    handler = null;
    onCancel = null;
    window.removeEventListener("keydown", onKey, true);
    document.body.classList.remove("is-map-picking");
  }
  return true;
}
