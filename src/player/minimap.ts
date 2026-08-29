import type { GameEvent, GameMap, MapMinimapSetting } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { store } from "@/project/store";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { eventBodyRect } from "@/project/eventFootprintQuery";

export type MinimapCorner = NonNullable<MapMinimapSetting["corner"]>;

export type MinimapRuntimeState = {
  mapId: string;
  setting: MapMinimapSetting;
  scale: number;
  canvas: HTMLCanvasElement;
  dot: HTMLElement;
  root: HTMLElement;
  hidden: boolean;
};

const SUPPRESS_TEST_IDS = [
  "dialogue-box",
  "battle-scene",
  "title-screen",
  "game-over-screen",
  "main-menu",
  "status-menu",
  "shop-scene",
  "inn-scene",
  "chest-scene",
  "ending-screen",
] as const;

function isSuppressed(host: HTMLElement | null): boolean {
  if (!host) return true;
  return SUPPRESS_TEST_IDS.some(
    (id) => host.querySelector(`[data-testid='${id}']`) !== null || document.querySelector(`[data-testid='${id}']`) !== null,
  );
}

function effectiveScale(map: GameMap, setting: MapMinimapSetting): number {
  if (setting.scale !== undefined) return clamp(setting.scale, 0.08, 0.5);
  const denom = Math.max(map.width * map.tileSize, map.height * map.tileSize, 1);
  return clamp(96 / denom, 0.08, 0.35);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function cornerClass(corner: MinimapCorner): string {
  switch (corner) {
    case "topLeft":
      return "is-top-left";
    case "bottomRight":
      return "is-bottom-right";
    case "bottomLeft":
      return "is-bottom-left";
    case "topRight":
    default:
      return "is-top-right";
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function renderMinimapTexture(
  canvas: HTMLCanvasElement,
  map: GameMap,
  tileset: { id: string; tilesPerRow: number; tileSize: number; image: { type: string; id: string } },
  showEvents: boolean,
): Promise<void> {
  const url = resolveTilesetUrl(tileset);
  if (!url) return;
  const image = await loadImage(url);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = map.width * map.tileSize;
  canvas.height = map.height * map.tileSize;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawLayer(ctx, image, map, tileset, map.lowerTiles);
  drawLayer(ctx, image, map, tileset, map.upperTiles);
  if (showEvents) drawEventMarkers(ctx, map);
}

function resolveTilesetUrl(tileset: { id: string; image: { type: string; id: string } }): string | null {
  try {
    const project = store.getCurrent();
    const def = project.tilesets[tileset.id];
    if (def) return tilesetImageUrl(def);
  } catch {
  }
  if (tileset.image.type === "bundled") {
    return `/${tileset.image.id}`;
  }
  return store.getCurrent().assets.uploaded[tileset.image.id]?.dataUrl ?? null;
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  map: GameMap,
  tileset: { tilesPerRow: number; tileSize: number },
  tiles: readonly number[],
): void {
  const tpr = tileset.tilesPerRow;
  const ts = tileset.tileSize;
  for (let i = 0; i < tiles.length; i += 1) {
    const tile = tiles[i] ?? -1;
    if (tile < 0) continue;
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    const sx = (tile % tpr) * ts;
    const sy = Math.floor(tile / tpr) * ts;
    ctx.drawImage(img, sx, sy, ts, ts, x * ts, y * ts, ts, ts);
  }
}

/**
 * 미니맵 이벤트 표식의 픽셀 사각. **몸 사각**을 덮고 안쪽으로 inset 만큼 좁힌다.
 *
 * 앵커 한 칸만 찍으면 3x3 골렘이 지도에서 1x1 로 보여, 길을 막는 몸집을 지도로 판단할 수
 * 없다. 1x1 이벤트는 몸 사각이 앵커 한 칸이라 예전과 같은 사각이 나온다(항등).
 */
export function minimapEventMarkerRect(
  event: GameEvent,
  tileSize: number
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  const rect = eventBodyRect(event);
  const inset = Math.max(1, Math.floor(tileSize * 0.2));
  return {
    x: rect.left * tileSize + inset,
    y: rect.top * tileSize + inset,
    w: (rect.right - rect.left + 1) * tileSize - inset * 2,
    h: (rect.bottom - rect.top + 1) * tileSize - inset * 2,
  };
}

function drawEventMarkers(ctx: CanvasRenderingContext2D, map: GameMap): void {
  for (const ev of map.events) {
    const { x, y, w, h } = minimapEventMarkerRect(ev, map.tileSize);
    ctx.fillStyle = "rgba(255,0,122,0.95)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }
}

export function shouldShowMinimap(map: GameMap | undefined): boolean {
  return Boolean(map?.minimap?.enabled);
}

export function resolveMinimapScale(map: GameMap): number {
  const st = map.minimap;
  if (!st) return 0;
  return effectiveScale(map, st);
}

export async function createMinimap(
  host: HTMLElement,
  map: GameMap,
  session: PlaySession,
): Promise<MinimapRuntimeState | null> {
  const setting = map.minimap;
  if (!setting?.enabled) return null;
  const project = store.getCurrent();
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return null;

  const scale = effectiveScale(map, setting);
  const root = document.createElement("div");
  root.className = `minimap-root ${cornerClass(setting.corner ?? "topRight")}`;
  root.dataset.testid = "minimap-root";
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", `${map.name} 미니맵`);

  const frame = document.createElement("div");
  frame.className = "minimap-frame";

  const canvas = document.createElement("canvas");
  canvas.className = "minimap-canvas";
  canvas.dataset.testid = "minimap-canvas";

  const dot = document.createElement("div");
  dot.className = "minimap-dot";
  dot.dataset.testid = "minimap-dot";

  frame.append(canvas, dot);
  root.append(frame);

  const label = document.createElement("div");
  label.className = "minimap-label";
  label.textContent = map.name;
  root.append(label);

  host.append(root);

  const showEvents = setting.showEvents ?? true;
  await renderMinimapTexture(canvas, map, tileset as unknown as Parameters<typeof renderMinimapTexture>[2], showEvents);

  const displayW = Math.max(1, Math.round(canvas.width * scale));
  const displayH = Math.max(1, Math.round(canvas.height * scale));
  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;
  frame.style.width = `${displayW}px`;
  frame.style.height = `${displayH}px`;

  const state: MinimapRuntimeState = {
    mapId: map.id,
    setting,
    scale,
    canvas,
    dot,
    root,
    hidden: false,
  };

  syncMinimapPosition(state, session.x, session.y, map);

  return state;
}

export function syncMinimapPosition(
  state: MinimapRuntimeState,
  tileX: number,
  tileY: number,
  map: GameMap,
): void {
  const ts = map.tileSize;
  const px = tileX * ts * state.scale;
  const py = tileY * ts * state.scale;
  const dotSize = 5;
  state.dot.style.left = `${px - dotSize / 2}px`;
  state.dot.style.top = `${py - dotSize / 2}px`;
}

export function syncMinimapVisibility(
  state: MinimapRuntimeState,
  host: HTMLElement | null,
  userHidden: boolean,
): boolean {
  const suppressed = isSuppressed(host);
  const hidden = suppressed || userHidden;
  state.hidden = hidden;
  state.root.hidden = hidden;
  state.root.style.display = hidden ? "none" : "";
  return hidden;
}

export function destroyMinimap(state: MinimapRuntimeState | null): void {
  if (!state) return;
  state.root.remove();
}

export function minimapSuppressedForTest(host: HTMLElement | null): boolean {
  return isSuppressed(host);
}
