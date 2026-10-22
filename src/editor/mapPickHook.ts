// src/editor/mapPickHook.ts
/**
 * 맵 칸 한 번 고르기 — 다음 왼쪽 클릭 한 번을 붓·이벤트 도구보다 먼저 가로챈다(EditScene pointerdown).
 * 공방 「한 번에 만들기」가 새 캐릭터를 NPC 로 놓을 때 쓴다: 「맵에 놓기」 → 맵을 누르면 그 칸에 선다. Esc 로 그만둔다.
 */
export type MapPickHandler = (mapId: string, x: number, y: number) => boolean;

/**
 * 고르는 동안 커서 칸에 띄울 그림(캐릭터 칩 한 칸). 없으면 칸 고르기만 한다.
 * 전에는 붓의 바닥 칸 미리 보기가 그대로 따라다녀 「캐릭터를 놓는데 풀 칸이 보인다」였다(2026-10-23 UX 검수).
 */
export type MapPickGhost = {
  readonly url: string;
  /** 시트 크기(화소) */
  readonly sheet: { readonly width: number; readonly height: number };
  /** 보일 칸(화소) — 발이 칸 아래쪽에 닿게 칸 가운데 아래에 맞춘다 */
  readonly frame: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly label: string;
};

let handler: MapPickHandler | null = null;
let onCancel: (() => void) | null = null;
let ghost: MapPickGhost | null = null;
let ghostEl: HTMLElement | null = null;

function removeGhost(): void {
  ghostEl?.remove();
  ghostEl = null;
  ghost = null;
}

function onKey(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !handler) return;
  cancelMapPick();
}

/** 다음 맵 클릭 한 번을 받는다. handler 가 true 를 돌려주면 끝, false 면 계속 기다린다. */
export function armMapPick(next: MapPickHandler, cancelled?: () => void, preview?: MapPickGhost): void {
  cancelMapPick();
  handler = next;
  ghost = preview ?? null;
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
  removeGhost();
  cancelled?.();
}

/** 고르는 중 그림이 있으면 true — EditScene 은 그때 바닥 칸 미리 보기를 그리지 않는다. */
export function hasMapPickGhost(): boolean {
  return handler !== null && ghost !== null;
}

/**
 * EditScene 이 커서 칸이 바뀔 때 부른다: 그 칸의 화면 사각(null = 맵 밖)에 그림을 놓는다.
 * 칸 폭에 맞춰 같은 배율로 키우고, 발(그림 아래)이 칸 아래에 닿게 둔다.
 */
export function placeMapPickGhost(cell: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null): void {
  if (!handler || !ghost) return;
  if (!cell) { if (ghostEl) ghostEl.hidden = true; return; }
  if (!ghostEl) {
    ghostEl = document.createElement("div");
    ghostEl.className = "map-pick-ghost";
    ghostEl.dataset.testid = "map-pick-ghost";
    ghostEl.setAttribute("aria-hidden", "true");
    ghostEl.title = ghost.label;
    document.body.append(ghostEl);
  }
  const k = cell.width / 16;
  const w = ghost.frame.width * k, h = ghost.frame.height * k;
  const style = ghostEl.style;
  ghostEl.hidden = false;
  style.left = `${Math.round(cell.x + cell.width / 2 - w / 2)}px`;
  style.top = `${Math.round(cell.y + cell.height - h)}px`;
  style.width = `${Math.round(w)}px`;
  style.height = `${Math.round(h)}px`;
  style.backgroundImage = `url("${ghost.url}")`;
  style.backgroundSize = `${ghost.sheet.width * k}px ${ghost.sheet.height * k}px`;
  style.backgroundPosition = `${-ghost.frame.x * k}px ${-ghost.frame.y * k}px`;
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
    removeGhost();
  }
  return true;
}
