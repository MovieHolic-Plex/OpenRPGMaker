/**
 * 타일 그림 문 열고 닫기 — 「화면 효과」 doorOpen / doorClose 의 렌더러(`@/project/eventCommands/doorAnimation`).
 *
 * 문 그림은 칩셋 타일이라 프레임이 없다. 그래서 문 칸의 타일을 그대로 복사한 «문짝» 이미지를 그 자리에 겹쳐 움직인다:
 *  - 문짝 뒤에 안쪽 색 판(엘리베이터 = 불 켜진 승강기 칸, 여닫이 = 어두운 안)을 깐다.
 *  - slide: 가운데에서 갈라져 양쪽 벽 속으로 들어간다(벽 밖으로 삐져나온 부분은 잘라 낸다).
 *  - swing: 경첩 쪽으로 접혀(가로로 줄어) 위에서 본 안쪽으로 열린 문이 된다. hinge both = 두 짝이 가운데에서 갈라져 양쪽으로 접힌다.
 *  - shutter: 문짝이 위로 말려 올라가 문틀 윗변 속으로 사라진다.
 * fit:"art" 문(조수 도구가 적은 문, mapDoorKinds)은 문틀 두께를 그림에서 잰다(measureDoorLeaves) — 유리·나무판의 주된 색이 차지한 사각형이 문짝,
 * 두 짝 사이 가장 다른 세로줄(문설주)이 가르는 선이다.
 * 이동 문(transfer)도 여기로 연다(openMapDoorForTransfer) — 맵에 적힌 문, 없으면 그림에서 추론한 자동문·미닫이·셔터·두 짝 문(sceneMapDoors).
 * 원래 문 그림(상층 솔리드 타일)은 겹침이 있는 동안 알파 0 으로 숨긴다 — 안 숨기면 그 그림의 줄 depth 가 안에 선 인물을 가린다.
 *
 * 한 번 열거나 닫은 문의 겹침은 그 맵에 있는 동안 남는다(닫힌 겹침은 원래 그림과 똑같이 보인다) — 닫힌 문짝 뒤에 들어간 인물이
 * 원래 그림과 같은 depth 로 다시 비치지 않게 한다. 맵을 떠나면 걷힌다.
 *
 * depth(문 아래 줄 바닥 y = base):
 *   안쪽 판  base - 0.5  < 문 그림 줄에 들어선 인물(base) <  문짝 base + 0.5  <  문 앞 칸 인물(base + 칸).
 * 그래서 승강기에 들어선 인물은 닫히는 문짝 뒤로 가려지고, 문 앞에 선 인물은 문 위에 그려진다.
 */
import type Phaser from "phaser";
import { characterDepth, characterSpriteX } from "@/player/characterDepth";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { DOOR_DEFAULT_MS, doorInteriorOf, doorKey, type MapDoorDef, type RuntimeDoorState } from "@/project/eventCommands/doorAnimation";
import { playAudioCommand } from "@/player/audio";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { layerTileAt } from "@/project/mapLayers";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import { DOOR_KIND_SOUNDS, inferMapDoor, mapDoorAt } from "@/project/mapDoorKinds";
import type { GameMap, Project, TilesetDef } from "@/project/types";

type PanelPiece = {
  readonly image: Phaser.GameObjects.Image;
  /** 닫혔을 때 이 조각(타일)의 월드 왼쪽 x. */
  readonly baseX: number;
  /** slide: 왼쪽/오른쪽 문짝. swing 은 하나(left). */
  readonly side: "left" | "right";
  /** 이 조각이 닫혔을 때 그리는 월드 가로 구간(문짝 구멍 안의 그 타일 몫). */
  readonly srcL: number;
  readonly srcR: number;
  /** 세로 잘라 내기(타일 안 좌표). */
  readonly cropY: number;
  readonly cropH: number;
  /** 닫혔을 때 이 조각(타일)의 월드 위쪽 y(셔터가 말려 올라갈 때). */
  readonly baseY: number;
};

type DoorView = {
  readonly key: string;
  readonly mapId: string;
  readonly state: RuntimeDoorState;
  readonly interior: Phaser.GameObjects.Rectangle;
  readonly interiorGlow?: Phaser.GameObjects.Rectangle;
  readonly pieces: PanelPiece[];
  /** 문틀 — 움직이지 않는 둘레(층 표시등·벽). 원래 그림을 숨기므로 그 몫을 따로 그린다. */
  readonly frames: Phaser.GameObjects.Image[];
  /** 문짝 구멍(월드 픽셀). */
  readonly hole: { readonly l: number; readonly r: number; readonly t: number; readonly b: number };
  /** 숨긴 원래 타일의 프레임 이름(문 칸 안). */
  readonly artFrames: ReadonlySet<string>;
  readonly textureKey: string;
  t: number;
  target: boolean;
  from: number;
  startedAt: number;
  durationMs: number;
  hidden: Set<Phaser.GameObjects.GameObject>;
};

const views = new WeakMap<object, Map<string, DoorView>>();

const SLIDE_INTERIOR = 0x8f8676;
const SLIDE_INTERIOR_GLOW = 0xd8cdb4;
const SWING_INTERIOR = 0x2a2521;

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function textureKeyFor(scene: PlaySceneContext, tileset: TilesetDef): string {
  const resolver = (scene as unknown as { resolveTilesetTexture?: (t: TilesetDef) => string }).resolveTilesetTexture;
  return resolver ? resolver.call(scene, tileset) : "";
}

/**
 * 문 칸의 문짝 그림이 될 타일. 지나다니는 문간(interior none)은 바닥(1층)을 뺀 2·3·4층 —
 * 문짝이 접히면 그 밑 바닥이 보인다. 벽에 박힌 문은 상층(3·4층)에 그림이 있으면 그것만, 없으면 하층(1·2층).
 */
function doorArtLayers(scene: PlaySceneContext, state: RuntimeDoorState): readonly (1 | 2 | 3 | 4)[] {
  const map = scene.map;
  if (doorInteriorOf(state) === "none") return [2, 3, 4];
  for (let y = state.y; y < state.y + state.h; y++) for (let x = state.x; x < state.x + state.w; x++) {
    const i = y * map.width + x;
    if (layerTileAt(map, 3, i) >= 0 || layerTileAt(map, 4, i) >= 0) return [3, 4];
  }
  return [1, 2];
}

type Leaves = { readonly frame: { l: number; r: number; t: number; b: number }; readonly split?: number };
const leafCache = new Map<string, Leaves | null>();

/**
 * 문 그림(문 칸들, 네 층 겹친 그림)에서 문짝 사각형을 잰다 — 16px 그림 픽셀 기준 문틀 두께와 두 짝을 가르는 선.
 * 가운데 띠의 주된 색(유리·나무판)을 고르고, 그 색이 30% 넘게 차지한 세로줄·가로줄의 가장 긴 덩이(3px 이하 틈은 잇는다)를 문짝으로 본다.
 * 반사 점·손잡이·문살(얇은 줄)은 틈으로 잇고, 문틀·벽·간판처럼 다른 색 띠는 밖으로 남는다. 못 재면 null(문 칸 전체가 문짝).
 */
function measureDoorLeaves(scene: PlaySceneContext, textureKey: string, map: GameMap, state: RuntimeDoorState): Leaves | null {
  const tiles: number[] = [];
  for (let y = state.y; y < state.y + state.h; y++) for (let x = state.x; x < state.x + state.w; x++) {
    const i = y * map.width + x;
    for (const layer of [1, 2, 3, 4] as const) tiles.push(layerTileAt(map, layer, i));
  }
  const cacheKey = `${textureKey}|${state.w}x${state.h}|${tiles.join(",")}`;
  if (leafCache.has(cacheKey)) return leafCache.get(cacheKey)!;
  let result: Leaves | null = null;
  try {
    const W = state.w * 16, H = state.h * 16;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const texture = scene.textures.get(textureKey);
    if (ctx && texture) {
      ctx.imageSmoothingEnabled = false;
      let k = 0;
      for (let cy = 0; cy < state.h; cy++) for (let cx = 0; cx < state.w; cx++) {
        for (let layer = 0; layer < 4; layer++) {
          const tile = tiles[k++]!;
          if (tile < 0 || !texture.has(`tile_${tile}`)) continue;
          const f = texture.get(`tile_${tile}`) as Phaser.Textures.Frame;
          ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, cx * 16, cy * 16, 16, 16);
        }
      }
      result = leavesFromPixels(ctx.getImageData(0, 0, W, H).data, W, H, state.w >= 2 || state.style === "slide");
    }
  } catch { result = null; }
  leafCache.set(cacheKey, result);
  return result;
}

/** 순수 계산(시험용으로 따로 둔다): RGBA 화소 → 문틀 두께·가르는 선. */
export function leavesFromPixels(data: Uint8ClampedArray, W: number, H: number, split: boolean): Leaves | null {
  const at = (x: number, y: number) => (y * W + x) * 4;
  const counts = new Map<number, number>();
  for (let y = Math.floor(H * 0.35); y < Math.floor(H * 0.9); y++) for (let x = Math.floor(W * 0.15); x < Math.floor(W * 0.85); x++) {
    const i = at(x, y);
    if (data[i + 3]! < 128) continue;
    const q = ((data[i]! >> 3) << 10) | ((data[i + 1]! >> 3) << 5) | (data[i + 2]! >> 3);
    counts.set(q, (counts.get(q) ?? 0) + 1);
  }
  let best = -1, bestN = 0;
  for (const [q, n] of counts) if (n > bestN) { best = q; bestN = n; }
  if (best < 0) return null;
  const seed = [((best >> 10) << 3) + 4, (((best >> 5) & 31) << 3) + 4, ((best & 31) << 3) + 4] as const;
  const sim = (x: number, y: number) => {
    const i = at(x, y);
    return data[i + 3]! >= 128 && Math.abs(data[i]! - seed[0]) + Math.abs(data[i + 1]! - seed[1]) + Math.abs(data[i + 2]! - seed[2]) < 60;
  };
  const longestRun = (values: readonly number[], gap: number): [number, number] | null => {
    const runs: [number, number][] = [];
    values.forEach((v, i) => {
      if (v <= 0.3) return;
      const last = runs[runs.length - 1];
      if (last && i - last[1] <= gap + 1) last[1] = i; else runs.push([i, i]);
    });
    return runs.length ? runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a)) : null;
  };
  const y0 = Math.floor(H * 0.3), y1 = Math.floor(H * 0.95);
  const colFrac = Array.from({ length: W }, (_, x) => { let n = 0; for (let y = y0; y < y1; y++) if (sim(x, y)) n++; return n / Math.max(1, y1 - y0); });
  const cols = longestRun(colFrac, 3);
  if (!cols) return null;
  const [l, r] = cols;
  const rowFrac = Array.from({ length: H }, (_, y) => { let n = 0; for (let x = l; x <= r; x++) if (sim(x, y)) n++; return n / (r - l + 1); });
  const rows = longestRun(rowFrac, 3);
  if (!rows) return null;
  const [t, b] = rows;
  if (r - l + 1 < 4 || b - t + 1 < 4) return null;
  let mid: number | undefined;
  if (split) {
    // 두 짝 사이: 가운데 40% 안에서 문짝 색이 가장 적은 세로줄(문설주·맞닿은 틈).
    const from = Math.round(l + (r - l) * 0.3), to = Math.round(l + (r - l) * 0.7);
    let low = Infinity;
    for (let x = from; x <= to; x++) if (colFrac[x]! < low) { low = colFrac[x]!; mid = x + 0.5; }
    const typical = colFrac.slice(l, r + 1).sort((a, c) => a - c)[Math.floor((r - l) / 2)]!;
    if (mid === undefined || low > typical * 0.6) mid = (l + r + 1) / 2;
  }
  return { frame: { l, r: W - 1 - r, t, b: H - 1 - b }, ...(mid !== undefined ? { split: mid } : {}) };
}

function createView(scene: PlaySceneContext, key: string, state: RuntimeDoorState): DoorView | null {
  const map = scene.map;
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset || !scene.add?.image) return null;
  const textureKey = textureKeyFor(scene, tileset);
  if (!textureKey || !scene.textures?.exists?.(textureKey)) return null;
  const S = mapTileSize(map);
  const left = state.x * S, top = state.y * S, width = state.w * S, height = state.h * S;
  // 그림 픽셀(16) 기준 문틀 두께를 맵 칸 크기로 늘린다. fit:"art" 이고 적힌 두께가 없으면 그림에서 잰다.
  const measured = !state.frame && state.fit === "art" ? measureDoorLeaves(scene, textureKey, map, state) : null;
  const px = S / 16, f = state.frame ?? measured?.frame ?? { l: 0, r: 0, t: 0, b: 0 };
  const hole = { l: left + f.l * px, r: left + width - f.r * px, t: top + f.t * px, b: top + height - f.b * px };
  const base = characterDepth("same", (state.y + state.h) * S);
  const slide = state.style === "slide";
  // 두 짝으로 갈라지는 문: 미닫이(자동문)·두 짝 여닫이. 셔터·외짝 여닫이는 한 장.
  const halvesSplit = slide || (state.style === "swing" && state.hinge === "both");
  const kind = doorInteriorOf(state);
  const holeW = Math.max(1, hole.r - hole.l), holeH = Math.max(1, hole.b - hole.t);
  const interior = scene.add.rectangle(hole.l, hole.t, holeW, holeH, kind === "lit" ? SLIDE_INTERIOR : SWING_INTERIOR, kind === "none" ? 0 : 1).setOrigin(0, 0).setDepth(base - 0.5);
  // 승강기 칸 안쪽 뒷벽의 밝은 판 — 문이 열리면 불 켜진 칸이 보인다.
  const interiorGlow = kind === "lit"
    ? scene.add.rectangle(hole.l + 2, hole.t + 2, Math.max(1, holeW - 4), Math.max(1, holeH - Math.round(S * 0.6)), SLIDE_INTERIOR_GLOW, 0.85).setOrigin(0, 0).setDepth(base - 0.45)
    : undefined;
  const layers = doorArtLayers(scene, state);
  const pieces: PanelPiece[] = [];
  const frames: Phaser.GameObjects.Image[] = [];
  const artFrames = new Set<string>();
  const mid = measured?.split !== undefined ? left + measured.split * px : (hole.l + hole.r) / 2;
  for (let y = state.y; y < state.y + state.h; y++) for (let x = state.x; x < state.x + state.w; x++) {
    const i = y * map.width + x;
    const tx = x * S, ty = y * S;
    for (const layer of layers) {
      const tile = layerTileAt(map, layer, i);
      if (tile < 0) continue;
      const frame = `tile_${tile}`;
      // 겹침이 대신 그리는 원래 그림은 숨긴다(바닥 1층은 안쪽 판이 덮거나 그대로 보여야 하므로 숨기지 않는다).
      if (layer >= 2) artFrames.add(frame);
      // 바닥에 깔린 문(2층 이하)과 사람이 지나다니는 문간(interior none)은 바닥 높이 — 지나가는 사람 위에 문짝·문설주가
      // 그려져 몸이 잘려 보이지 않게(VQA r4: 회상 복도 문). 벽에 박힌 문(승강기·철문)은 문 줄 인물 위(닫히면 안의 사람을 가린다).
      const depth = layer <= 2 || kind === "none" ? 1 + layer * 0.001 : base + 0.5 + layer * 0.001;
      // 문틀: 타일에서 구멍 밖 띠(위·아래·왼·오른)를 제자리에 그린다.
      const bands: [number, number, number, number][] = [
        [tx, ty, tx + S, Math.min(ty + S, hole.t)],
        [tx, Math.max(ty, hole.b), tx + S, ty + S],
        [tx, Math.max(ty, hole.t), Math.min(tx + S, hole.l), Math.min(ty + S, hole.b)],
        [Math.max(tx, hole.r), Math.max(ty, hole.t), tx + S, Math.min(ty + S, hole.b)],
      ];
      if (layer >= 2) for (const [x0, y0, x1, y1] of bands) {
        if (x1 - x0 <= 0 || y1 - y0 <= 0) continue;
        frames.push(scene.add.image(tx, ty, textureKey, frame).setOrigin(0, 0).setDepth(depth).setCrop(x0 - tx, y0 - ty, x1 - x0, y1 - y0));
      }
      const cropY = Math.max(0, hole.t - ty), cropB = Math.min(S, hole.b - ty);
      if (cropB - cropY <= 0) continue;
      const inL = Math.max(tx, hole.l), inR = Math.min(tx + S, hole.r);
      if (inR - inL <= 0) continue;
      const halves: ["left" | "right", number, number][] = halvesSplit
        ? ([["left", inL, Math.min(inR, mid)], ["right", Math.max(inL, mid), inR]] as ["left" | "right", number, number][]).filter(([, a, b]) => b - a > 0)
        : [["left", inL, inR]];
      for (const [side, srcL, srcR] of halves) {
        const image = scene.add.image(tx, ty, textureKey, frame).setOrigin(0, 0).setDepth(depth + 0.0001);
        pieces.push({ image, baseX: tx, baseY: ty, side, srcL, srcR, cropY, cropH: cropB - cropY });
      }
    }
  }
  return {
    key, mapId: map.id, state, interior, interiorGlow, pieces, frames, hole, artFrames, textureKey,
    t: 0, target: state.open, from: 0, startedAt: scene.time?.now ?? 0,
    durationMs: Math.max(1, state.durationMs || DOOR_DEFAULT_MS), hidden: new Set(),
  };
}

function destroyView(view: DoorView): void {
  view.interior.destroy();
  view.interiorGlow?.destroy();
  for (const piece of view.pieces) piece.image.destroy();
  for (const frame of view.frames) frame.destroy();
  for (const obj of view.hidden) (obj as unknown as { setAlpha?(a: number): void }).setAlpha?.(1);
  view.hidden.clear();
}

/** 원래 문 그림(상층 타일)을 숨긴다 — 타일 창이 다시 그리면 새 이미지가 생기므로 매 프레임 다시 본다. */
function hideOriginalArt(scene: PlaySceneContext, view: DoorView): void {
  if (!view.artFrames.size) return;
  const S = mapTileSize(scene.map);
  const x0 = view.state.x * S, y0 = view.state.y * S, x1 = x0 + view.state.w * S, y1 = y0 + view.state.h * S;
  const own = new Set<unknown>([...view.pieces.map((p) => p.image), ...view.frames]);
  const lists: unknown[][] = [];
  const rootList = (scene.children as unknown as { list?: unknown[] } | undefined)?.list;
  if (rootList) lists.push(rootList);
  const tl = (scene.tileLayer as unknown as { list?: unknown[] } | undefined)?.list;
  if (tl) lists.push(tl);
  const ul = (scene.upperTileLayer as unknown as { list?: unknown[] } | undefined)?.list;
  if (ul) lists.push(ul);
  for (const list of lists) for (const obj of list) {
    if (own.has(obj)) continue;
    const img = obj as { type?: string; x?: number; y?: number; texture?: { key?: string }; frame?: { name?: string }; alpha?: number; setAlpha?(a: number): void };
    if (img.type !== "Image" && img.type !== "Sprite") continue;
    if (img.texture?.key !== view.textureKey || !img.frame?.name || !view.artFrames.has(String(img.frame.name))) continue;
    if (typeof img.x !== "number" || typeof img.y !== "number" || img.x < x0 || img.x >= x1 || img.y < y0 || img.y >= y1) continue;
    // visible 은 타일 컬링이 매 경계마다 다시 켠다 — 알파로 숨긴다.
    if (img.alpha !== 0) img.setAlpha?.(0);
    view.hidden.add(obj as Phaser.GameObjects.GameObject);
  }
}

function applyPose(_scene: PlaySceneContext, view: DoorView): void {
  const p = ease(view.t);
  const { l, r } = view.hole;
  view.interior.setVisible(view.t > 0);
  view.interiorGlow?.setVisible(view.t > 0);
  if (view.state.style === "slide") {
    // 두 문짝이 가운데에서 갈라져 구멍 양옆 문틀 속으로 들어간다(구멍 밖으로 나간 몫은 잘라 낸다).
    const d = p * ((r - l) / 2);
    for (const piece of view.pieces) {
      const left = piece.side === "left";
      const nx = left ? piece.baseX - d : piece.baseX + d;
      const worldL = left ? Math.max(piece.srcL - d, l) : piece.srcL + d;
      const worldR = left ? piece.srcR - d : Math.min(piece.srcR + d, r);
      if (worldR - worldL <= 0.01) { piece.image.setVisible(false); continue; }
      piece.image.setVisible(true);
      piece.image.setPosition(nx, piece.image.y);
      piece.image.setCrop(worldL - nx, piece.cropY, worldR - worldL, piece.cropH);
    }
    return;
  }
  if (view.state.style === "shutter") {
    // 셔터: 문짝이 위로 말려 올라가 구멍 윗변 속으로 사라진다(구멍 위로 나간 몫은 잘라 낸다). 위로 갈수록 살짝 어두워진다.
    const { t, b } = view.hole;
    const d = p * (b - t);
    const shade = Math.round(255 - 50 * p);
    for (const piece of view.pieces) {
      const ny = piece.baseY - d;
      const worldT = Math.max(piece.baseY + piece.cropY - d, t);
      const worldB = piece.baseY + piece.cropY + piece.cropH - d;
      if (worldB - worldT <= 0.01) { piece.image.setVisible(false); continue; }
      piece.image.setVisible(true);
      piece.image.setPosition(piece.baseX, ny);
      piece.image.setCrop(piece.srcL - piece.baseX, worldT - ny, piece.srcR - piece.srcL, worldB - worldT);
      piece.image.setTint?.((shade << 16) | (shade << 8) | shade);
    }
    return;
  }
  // swing: 경첩 쪽으로 접힌다. 다 열린 문은 원래 폭의 15% 띠로 남는다(위에서 본 열린 문짝). 두 짝(both)은 왼짝은 왼쪽, 오른짝은 오른쪽 경첩.
  const s = 1 - 0.85 * p;
  const shade = Math.round(255 - 70 * p);
  const tint = (shade << 16) | (shade << 8) | shade;
  for (const piece of view.pieces) {
    const hinge = view.state.hinge === "both" ? (piece.side === "left" ? l : r) : view.state.hinge === "right" ? r : l;
    piece.image.setVisible(true);
    piece.image.setPosition(hinge + (piece.baseX - hinge) * s, piece.image.y);
    piece.image.setScale(s, 1);
    piece.image.setCrop(piece.srcL - piece.baseX, piece.cropY, piece.srcR - piece.srcL, piece.cropH);
    piece.image.setTint?.(tint);
  }
}

// ── auto 문: 사람이 다가오면 저절로 ─────────────────────────────────

const AUTO_CLOSE_DELAY_MS = 500;
const autoLastSeen = new WeakMap<object, Map<string, number>>();
/** 장면이 마지막으로 auto 문을 본 맵 — 맵에 막 들어온 첫 프레임에 이미 문간에 선 사람(방금 들어온 주인공)은 열린 채로 시작한다. */
const autoMap = new WeakMap<object, string>();

/** 문 칸과 그 위·아래 두 줄(문간으로 오는 길) — 여기 누가 서 있으면 문이 열린다. 한 걸음 앞에서 열리기 시작해야 걸어 들어갈 때 다 열려 있다. */
// 자동문(미닫이)은 두 줄 앞에서, 여닫이는 한 줄 앞에서 — 여닫이 앞에 두 줄 떨어져 서서 이야기하는 사람 때문에 문이 열린 채 남지 않게.
function occupiesApproach(door: MapDoorDef, x: number, y: number): boolean {
  const rows = door.style === "slide" ? 2 : 1;
  return x >= door.x && x < door.x + door.w && y >= door.y - rows && y < door.y + door.h + rows;
}

function someoneNear(scene: PlaySceneContext, door: MapDoorDef): boolean {
  if (scene.player?.visible !== false && occupiesApproach(door, scene.tileX, scene.tileY)) return true;
  for (const [id, pos] of Object.entries(scene.eventPositions ?? {})) {
    const sprite = scene.eventSprites?.get(id) as { visible?: boolean; alpha?: number } | undefined;
    if (!sprite || sprite.visible === false || (sprite.alpha ?? 1) <= 0.05) continue;
    if (occupiesApproach(door, pos.x, pos.y)) return true;
  }
  return false;
}

function playerNear(scene: PlaySceneContext, door: MapDoorDef): boolean {
  return scene.player?.visible !== false && occupiesApproach(door, scene.tileX, scene.tileY);
}

function playSe(id: string | undefined): void {
  if (id) playAudioCommand({ resourceId: id, loop: false }, store.getCurrent());
}

/** 다른 맵으로 가는 이동 이벤트인가(문 연출을 끈 door:false 는 뺀다). */
function transfersOut(event: GameMap["events"][number], mapId: string): boolean {
  const walk = (commands: readonly unknown[] | undefined): boolean => (commands ?? []).some((raw) => {
    const c = raw as { kind?: string; mapId?: string; door?: boolean; [key: string]: unknown };
    if (c.kind === "transfer" && c.mapId !== mapId && c.door !== false) return true;
    return ["then", "else", "commands", "body"].some((k) => Array.isArray(c[k]) && walk(c[k] as unknown[]));
  });
  return (event.pages ?? []).some((page) => walk(page.commands as unknown[]));
}

const inferredDoors = new WeakMap<GameMap, { readonly key: string; readonly doors: readonly MapDoorDef[] }>();

/**
 * 이 맵의 문 — 적힌 map.doors 에, 정의 없는 이동 문의 그림에서 추론한 문(mapDoorKinds.inferMapDoor)을 더한다.
 * 추론은 옛 연출이 틀리는 종류(자동문·미닫이·셔터·두 짝 문)만 더한다 — 외짝 여닫이·열림 그림 짝(키트) 문은 playSceneFieldFx 가 연다.
 * 맵·이벤트 수가 같으면 다시 추론하지 않는다.
 */
export function sceneMapDoors(scene: Pick<PlaySceneContext, "map">, project: Project = store.getCurrent()): readonly MapDoorDef[] {
  const map = scene.map;
  if (!map) return [];
  const authored = map.doors ?? [];
  const key = `${map.events.length}|${authored.length}|${map.tilesetId}`;
  const cached = inferredDoors.get(map);
  if (cached?.key === key) return cached.doors;
  const doors: MapDoorDef[] = [...authored];
  for (const event of map.events) {
    if (!transfersOut(event, map.id)) continue;
    const cell = { x: event.x, y: event.y };
    if (mapDoorAt(doors, cell)) continue;
    const inferred = inferMapDoor(project, map, cell);
    if (!inferred?.def || inferred.kind === "swing") continue;
    doors.push(inferred.def);
  }
  inferredDoors.set(map, { key, doors });
  return doors;
}

function syncAutoDoors(scene: PlaySceneContext, now: number): void {
  const doors = scene.map ? sceneMapDoors(scene) : undefined;
  if (!doors?.some((d) => d.auto) || !scene.session) return;
  const runtime = ensureM2Runtime(scene.session);
  let seen = autoLastSeen.get(scene);
  if (!seen) { seen = new Map(); autoLastSeen.set(scene, seen); }
  const entering = autoMap.get(scene) !== scene.map.id;
  if (entering) { autoMap.set(scene, scene.map.id); seen.clear(); }
  for (const door of doors) {
    if (!door.auto) continue;
    const key = doorKey(scene.map.id, door.x, door.y);
    const current = runtime.screen.doors?.[key];
    const near = someoneNear(scene, door);
    if (near) seen.set(key, now);
    const wantOpen = near || now - (seen.get(key) ?? -Infinity) < AUTO_CLOSE_DELAY_MS;
    if ((current?.open ?? false) === wantOpen) continue;
    if (!current && !wantOpen) continue;
    // 막 들어온 맵에서 이미 문간에 서 있으면 소리 없이 열린 채로(들어온 문이 등 뒤에서 다시 열리지 않게).
    const snap = entering && !current;
    runtime.screen.doors = { ...(runtime.screen.doors ?? {}), [key]: { ...door, mapId: scene.map.id, open: wantOpen, durationMs: snap ? 1 : DOOR_DEFAULT_MS } };
    if (snap) continue;
    playSe(wantOpen ? door.openSe : door.closeSe);
    // 입점 차임은 주인공이 열 때만(지나가는 행인이 열 때마다 울리지 않게).
    if (wantOpen && door.chimeSe && playerNear(scene, door)) playSe(door.chimeSe);
  }
}

/** 문 종류의 기본 여는 소리(정의에 openSe 가 없을 때). */
function defaultOpenSe(door: MapDoorDef): string {
  if (door.style === "shutter") return DOOR_KIND_SOUNDS.shutterOpen;
  if (door.style === "slide") return door.auto ? DOOR_KIND_SOUNDS.autoOpen : DOOR_KIND_SOUNDS.slideOpen;
  return DOOR_KIND_SOUNDS.swingOpen;
}

/** 이동 직전 문 열기 길이(ms) — 이동 페이드와 겹쳐 흐른다. */
const TRANSFER_OPEN_MS = { slide: 380, swing: 420, shutter: 620 } as const;

/**
 * 이동(transfer) 이벤트가 지나는 맵 문(적힌 것 또는 추론한 것) — 이벤트 칸이 문 사각형 안이거나 문 바로 아래 줄이면 그 문.
 * cells 는 이벤트 칸(그리고 door:true 면 주인공이 보는 칸·선 칸). 없으면 null.
 */
export function mapDoorForCells(scene: PlaySceneContext, cells: readonly { x: number; y: number }[]): MapDoorDef | null {
  const doors = sceneMapDoors(scene);
  if (!doors.length) return null;
  for (const cell of cells) {
    const door = mapDoorAt(doors, cell);
    if (door) return door;
  }
  return null;
}

/**
 * 맵 문을 지금 연다(이동 직전). 이미 열려 있으면(다가가서 열린 자동문) 아무것도 하지 않고 false.
 * silent = 다른 장르 문 소리가 이미 났다. 열린 문은 이 맵에 있는 동안 남는다(자동문은 아무도 없으면 닫힌다).
 */
export function openMapDoorNow(scene: PlaySceneContext, door: MapDoorDef, options: { readonly silent?: boolean } = {}): boolean {
  if (!scene.session || !scene.map) return false;
  const runtime = ensureM2Runtime(scene.session);
  const key = doorKey(scene.map.id, door.x, door.y);
  if (runtime.screen.doors?.[key]?.open) return false;
  runtime.screen.doors = { ...(runtime.screen.doors ?? {}), [key]: { ...door, mapId: scene.map.id, open: true, durationMs: TRANSFER_OPEN_MS[door.style] } };
  if (door.auto) autoLastSeen.get(scene)?.set(key, scene.time?.now ?? 0);
  if (!options.silent) {
    playSe(door.openSe ?? defaultOpenSe(door));
    if (door.chimeSe) playSe(door.chimeSe);
  }
  return true;
}

export function syncDoors(scene: PlaySceneContext): void {
  syncAutoDoors(scene, scene.time?.now ?? 0);
  const screen = scene.session?.m2Runtime?.screen;
  let byKey = views.get(scene);
  const doors = screen?.doors;
  if (!doors && !byKey?.size) return;
  if (!byKey) { byKey = new Map(); views.set(scene, byKey); }
  const now = scene.time?.now ?? 0;
  const mapId = scene.map?.id;
  // 다른 맵의 문은 닫힌 것으로 친다(그 맵을 떠나면 문은 닫힌다).
  if (doors) for (const [key, state] of Object.entries(doors)) if (state.mapId !== mapId) delete doors[key];
  for (const [key, view] of byKey) {
    if (view.mapId !== mapId || !doors?.[key]) { destroyView(view); byKey.delete(key); }
  }
  if (!doors) return;
  for (const [key, state] of Object.entries(doors)) {
    let view = byKey.get(key);
    if (!view) {
      // 닫힌 채로 처음 보는 문도 겹침을 만든다 — 승강기 안에 선 인물을 닫힌 문짝 뒤에 숨겨 둘 수 있다(도착 연출).
      view = createView(scene, key, state) ?? undefined;
      if (!view) continue;
      byKey.set(key, view);
    }
    if (view.target !== state.open) {
      view.target = state.open; view.from = view.t; view.startedAt = now;
      view.durationMs = Math.max(1, state.durationMs || DOOR_DEFAULT_MS);
    }
    const goal = view.target ? 1 : 0;
    const k = Math.min(1, Math.max(0, (now - view.startedAt) / view.durationMs));
    view.t = view.from + (goal - view.from) * k;
    hideOriginalArt(scene, view);
    applyPose(scene, view);
    centreCabinOccupant(scene, state);
  }
  // QA 기록기(runtimeQaRun recordUntilJs)가 문이 움직이는 동안 프레임을 찍도록 열림 정도를 남긴다.
  (scene as unknown as { __doorPose?: string }).__doorPose = [...byKey.values()].map((v) => v.t.toFixed(2)).join(",");
}

/**
 * 두 칸 폭 승강기 칸(interior lit)에 혼자 선 인물은 칸 가운데로 반 칸 옮겨 그린다 — 칸 좌표는 왼쪽 칸이라
 * 문이 열리고 닫히는 동안 인물이 문짝 한쪽에 치우쳐 보였다(첫사랑 VQA r22). 둘이 타면 두 칸을 채우므로 그대로 둔다.
 * 멈춰 선 인물만 옮긴다(그림 x 가 칸 자리 그대로일 때) — 걷는 동안의 트윈은 건드리지 않는다. 논리 칸은 바뀌지 않는다.
 */
function centreCabinOccupant(scene: PlaySceneContext, door: RuntimeDoorState): void {
  if (door.w % 2 !== 0 || doorInteriorOf(door) !== "lit") return;
  const size = mapTileSize(scene.map);
  const inside = (x: number, y: number): boolean => x >= door.x && x < door.x + door.w && y >= door.y && y < door.y + door.h;
  const riders: Array<{ sprite: { x: number }; tileX: number }> = [];
  const player = scene.player as unknown as { x: number; visible?: boolean } | undefined;
  if (player && player.visible !== false && inside(scene.tileX, scene.tileY)) riders.push({ sprite: player, tileX: scene.tileX });
  for (const [id, pos] of Object.entries(scene.eventPositions ?? {})) {
    const sprite = scene.eventSprites?.get(id) as { x: number; visible?: boolean; alpha?: number } | undefined;
    if (!sprite || sprite.visible === false || (sprite.alpha ?? 1) <= 0.05 || !inside(pos.x, pos.y)) continue;
    riders.push({ sprite, tileX: pos.x });
  }
  if (riders.length !== 1) return;
  const { sprite, tileX } = riders[0]!;
  const centre = (door.x + door.w / 2) * size;
  if (Math.abs(sprite.x - characterSpriteX(tileX, size)) < 0.5) sprite.x = centre;
}

/** 열리는·닫히는 중인 문이 있는가(QA·테스트용). */
export function doorsAnimating(scene: PlaySceneContext): boolean {
  for (const view of views.get(scene)?.values() ?? []) if (view.t > 0 && view.t < 1) return true;
  return false;
}
