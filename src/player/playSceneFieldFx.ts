// player/playSceneFieldFx.ts
// 필드 상호작용 연출 — 문 열기, 수납 뒤지기(뚜껑·흔들림·파편·소리), 찾은 것 떠오르기, 뒤진 흔적.
//
// 데이터(종류별 소리·흔들림·파편·흔적)는 project/containerFx.ts 가 갖고, 여기서는 그대로 그린다.
// 그림은 전부 절차 그림(사각형·그래픽)과 칸에 이미 그려진 타일 이미지 흔들기다 — 새 그림 자산이 필요 없다.
//  - 문: 이동(transfer) 직전 문 칸이면 문짝이 경첩 쪽으로 접히며 어두운 문간이 드러나고 문 소리가 난다.
//    문 이벤트가 문 캐릭터 시트(RPG Maker 관례: 방향 줄 = 닫힘→열림)를 쓰면 그 프레임을 넘긴다.
//  - 수납: showAnimation 의 `fx:container:<종류>` · `fx:popup:…` · `fx:door-open`.
//  - 흔적: `interaction: { kind: "container", searched: true }` 페이지가 켜진 칸 위에 그린다(syncContainerSearchedMarks).
import type Phaser from "phaser";
import { playSoundEffect } from "@/player/audio";
import { characterDepth, characterSpriteY } from "@/player/characterDepth";
import { applyDoorCue, DOOR_OPEN_SE } from "@/player/playSceneDoorway";
import { rootYSortTileImagesAt } from "@/player/playSceneMapRuntime";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  CONTAINER_FX,
  containerStyleForLabel,
  fieldFxDurationMs,
  isContainerStyle,
  POPUP_GOLD_SE,
  POPUP_ITEM_SE,
  type ContainerSearchedMark,
  type ContainerStyle,
  type FieldFx,
} from "@/project/containerFx";
import { runtimeEventViewById, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import type { GameMap, Project } from "@/project/types";
import { tilesetTextureKey } from "@/editor/tilesetImage";

type Cell = { readonly x: number; readonly y: number };

const FX_DEPTH_BUMP = 0.4;
const DOOR_FRAME_MS = 90;

function rowDepth(y: number, size: number): number {
  return characterDepth("same", characterSpriteY(y, size));
}

function sleep(scene: PlaySceneContext, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(Math.max(0, ms), resolve));
}

function playSe(id: string): void {
  playSoundEffect(id, store.getCurrent());
}

// ───────────────────────── 타일 이름표 ─────────────────────────

const LAYER_KEYS = ["upperOverlayTiles", "upperTiles", "lowerOverlayTiles", "lowerTiles"] as const;

function tileLabel(project: Project, map: GameMap, tile: number): string {
  if (tile < 0) return "";
  const meta = (project.tilesets[map.tilesetId] as { tileMeta?: unknown } | undefined)?.tileMeta;
  const m = Array.isArray(meta) ? meta[tile] : meta && typeof meta === "object" ? (meta as Record<string, unknown>)[String(tile)] : undefined;
  const entry = m as { label?: string; tags?: readonly string[] } | undefined;
  return `${entry?.label ?? ""} ${(entry?.tags ?? []).join(" ")}`.trim();
}

/** 칸의 타일들(위 층부터) 과 이름표. */
function cellTiles(project: Project, map: GameMap, x: number, y: number): { tile: number; label: string; layer: (typeof LAYER_KEYS)[number] }[] {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return [];
  const index = y * map.width + x;
  const out: { tile: number; label: string; layer: (typeof LAYER_KEYS)[number] }[] = [];
  for (const layer of LAYER_KEYS) {
    const tile = (map[layer] as ArrayLike<number> | undefined)?.[index] ?? -1;
    if (tile >= 0) out.push({ tile, label: tileLabel(project, map, tile), layer });
  }
  return out;
}

// 여닫는 문짝만. 계단·사다리·구멍·통로·문틀·성문 통로처럼 여닫지 않는 출구는 뺀다.
const SWING_DOOR = /(?<![창주성대])문(?![양자서장제구화턱틀패])|door|gate|셔터|창살/i;
const NOT_SWING = /계단|stair|사다리|ladder|구멍|hole|통로|passage|열린|open|arch|아치|포털|portal|뚜껑/i;

function doorTileAt(project: Project, map: GameMap, x: number, y: number): { tile: number } | null {
  for (const entry of cellTiles(project, map, x, y)) {
    if (SWING_DOOR.test(entry.label) && !NOT_SWING.test(entry.label)) return { tile: entry.tile };
  }
  return null;
}

// ───────────────────────── 문 열기 ─────────────────────────

/**
 * 문 여는 연출 — 이동 직전에 부른다. 문 칸을 찾지 못하면 아무것도 하지 않고 곧장 끝난다(연출 없는 이동).
 * 찾는 순서: 실행 중 이벤트 칸 → 그 위 칸(벽에 그린 문짝) → 주인공이 바라보는 칸.
 * silent = 다른 장르 문 소리가 이미 났다(몬스터 장르).
 */
export async function playDoorOpenBeforeTransfer(scene: PlaySceneContext, eventId: string | undefined, options: { readonly silent?: boolean } = {}): Promise<boolean> {
  const project = store.getCurrent();
  const map = scene.map;
  const view = eventId ? runtimeEventViewById(project, map, scene.session, scene.eventPositions, eventId) : undefined;
  // 문 캐릭터 시트를 쓰는 문 이벤트: 방향 줄 프레임을 넘긴다.
  const spriteId = view?.sprite?.id ?? "";
  if (view && !view.transparent && /door|문|gate/i.test(spriteId)) {
    for (const frame of [1, 2, 3]) {
      applyDoorCue(scene as unknown as Parameters<typeof applyDoorCue>[0], { kind: "doorCue", target: view.event.id, frame, ms: DOOR_FRAME_MS, ...(frame === 1 && !options.silent ? { se: DOOR_OPEN_SE } : {}) }, playSe);
      await sleep(scene, DOOR_FRAME_MS);
    }
    return true;
  }
  const facing = scene.session.playerFacing ?? "down";
  const d = facing === "up" ? [0, -1] : facing === "down" ? [0, 1] : facing === "left" ? [-1, 0] : [1, 0];
  const candidates: Cell[] = [];
  if (view) candidates.push({ x: view.x, y: view.y }, { x: view.x, y: view.y - 1 });
  candidates.push({ x: scene.tileX + d[0]!, y: scene.tileY + d[1]! }, { x: scene.tileX, y: scene.tileY });
  const cell = candidates.find((c) => doorTileAt(project, map, c.x, c.y));
  if (!cell) return false;
  if (!options.silent) playSe(DOOR_OPEN_SE);
  await swingDoorOpen(scene, project, map, cell);
  return true;
}

type DoorBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
const doorBoxCache = new Map<string, DoorBox | null>();

/**
 * 문 타일 안에서 문짝이 차지하는 사각형(px, 프레임 좌표). 같은 줄 옆 칸(벽)과 다른 화소의 테두리 상자다 —
 * 문 타일은 대개 벽 무늬 위에 문짝을 그린 것이라 벽과 같은 화소를 빼면 문짝만 남는다. 옆 벽이 없으면 null.
 */
function doorPanelBox(scene: PlaySceneContext, textureKey: string, doorTile: number, wallTile: number | null, size: number): DoorBox | null {
  if (wallTile === null || wallTile === doorTile) return null;
  const key = `${textureKey}|${doorTile}|${wallTile}`;
  if (doorBoxCache.has(key)) return doorBoxCache.get(key)!;
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = scene.textures.getPixel(x, y, textureKey, `tile_${doorTile}`);
      const b = scene.textures.getPixel(x, y, textureKey, `tile_${wallTile}`);
      if (!a || a.alpha < 128) continue;
      const diff = !b || b.alpha < 128 ? 255 : Math.abs(a.red - b.red) + Math.abs(a.green - b.green) + Math.abs(a.blue - b.blue);
      if (diff < 60) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  const box = maxX >= minX && maxY >= minY && (maxX - minX + 1) >= 4 && (maxY - minY + 1) >= 4
    ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
  doorBoxCache.set(key, box);
  return box;
}

/** 같은 층 좌우 칸에서 문이 아닌 벽 타일. */
function neighbourWallTile(project: Project, map: GameMap, cell: Cell, layer: (typeof LAYER_KEYS)[number]): number | null {
  for (const dx of [-1, 1]) {
    const x = cell.x + dx;
    if (x < 0 || x >= map.width) continue;
    const tile = (map[layer] as ArrayLike<number> | undefined)?.[cell.y * map.width + x] ?? -1;
    if (tile < 0) continue;
    if (doorTileAt(project, map, x, cell.y)) continue;
    return tile;
  }
  return null;
}

/** 문짝 조각 하나 — 칸, 그 칸 타일, 프레임 안 사각형. */
type DoorPiece = { readonly cell: Cell; readonly tile: number; readonly box: DoorBox };

/** 타일 프레임의 일부를 새 프레임으로 잘라 둔다(setCrop 대신 — 배율을 걸면 경첩 쪽으로 자연히 접힌다). */
function panelFrame(scene: PlaySceneContext, textureKey: string, tile: number, box: DoorBox): string | null {
  const name = `__door_${tile}_${box.x}_${box.y}_${box.w}_${box.h}`;
  const texture = scene.textures.get(textureKey);
  if (texture.has(name)) return name;
  const base = texture.get(`tile_${tile}`) as Phaser.Textures.Frame | undefined;
  if (!base || base.name !== `tile_${tile}`) return null;
  texture.add(name, base.sourceIndex, base.cutX + box.x, base.cutY + box.y, box.w, box.h);
  return name;
}

/** 아래 문 칸에서 위로 이어진 문짝(윗칸 그림이 문 이름표가 아니어도 문짝 화소가 아래 문과 이어지면 문이다). */
function doorPieces(scene: PlaySceneContext, project: Project, map: GameMap, bottom: Cell, textureKey: string, size: number): DoorPiece[] {
  const pieces: DoorPiece[] = [];
  const door = doorTileAt(project, map, bottom.x, bottom.y);
  if (!door) return pieces;
  const layer = cellTiles(project, map, bottom.x, bottom.y).find((t) => t.tile === door.tile)?.layer ?? "upperTiles";
  const inset = Math.round(2 * size / 16);
  const box = doorPanelBox(scene, textureKey, door.tile, neighbourWallTile(project, map, bottom, layer), size)
    ?? { x: inset, y: inset, w: size - inset * 2, h: size - inset };
  pieces.push({ cell: bottom, tile: door.tile, box });
  let below = box;
  for (let up = 1; up <= 2; up++) {
    const cell = { x: bottom.x, y: bottom.y - up };
    const tile = (map[layer] as ArrayLike<number> | undefined)?.[cell.y * map.width + cell.x] ?? -1;
    if (cell.y < 0 || tile < 0 || below.y > 1) break;
    const found = doorPanelBox(scene, textureKey, tile, neighbourWallTile(project, map, cell, layer), size);
    if (!found || found.y + found.h < size - 1) break;
    const left = Math.max(found.x, box.x), right = Math.min(found.x + found.w, box.x + box.w);
    if (right - left < box.w * 0.5) break;
    below = { x: box.x, y: found.y, w: box.w, h: size - found.y };
    pieces.unshift({ cell, tile, box: below });
  }
  return pieces;
}

/** 문짝(문 타일 그림)이 왼쪽 경첩으로 접히며 어두운 문간이 드러난다. 위로 이어진 문짝 칸도 같이 연다. */
async function swingDoorOpen(scene: PlaySceneContext, project: Project, map: GameMap, bottom: Cell): Promise<void> {
  const size = mapTileSize(map);
  const tileset = project.tilesets[map.tilesetId];
  // 메서드로 부른다(this 가 필요하다).
  const host = scene as unknown as { resolveTilesetTexture?(t: NonNullable<typeof tileset>): string };
  const textureKey = tileset ? host.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset) : "";
  if (!textureKey || !scene.textures.exists(textureKey)) return;
  const depth = rowDepth(bottom.y, size) + FX_DEPTH_BUMP;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const panels: Phaser.GameObjects.Image[] = [];
  for (const piece of doorPieces(scene, project, map, bottom, textureKey, size)) {
    const x = piece.cell.x * size + piece.box.x, y = piece.cell.y * size + piece.box.y;
    objects.push(scene.add.rectangle(x, y, piece.box.w, piece.box.h, 0x120c08).setOrigin(0, 0).setDepth(depth));
    const frame = panelFrame(scene, textureKey, piece.tile, piece.box);
    if (!frame) continue;
    const image = scene.add.image(x, y, textureKey, frame).setOrigin(0, 0).setDepth(depth + 0.01);
    panels.push(image);
    objects.push(image);
  }
  // 플레이어가 문 칸 위에 서 있으면 문간 그림 앞에 남게 한다.
  const playerDepth = scene.player?.depth;
  if (scene.player && scene.tileX === bottom.x && scene.tileY === bottom.y) scene.player.setDepth(depth + 0.1);
  for (const scaleX of [0.8, 0.58, 0.36, 0.16]) {
    for (const image of panels) {
      image.setScale(scaleX, 1);
      image.setTint(scaleX > 0.5 ? 0xffffff : scaleX > 0.3 ? 0xc8beb4 : 0x9a9088);
    }
    await sleep(scene, DOOR_FRAME_MS + 20);
  }
  await sleep(scene, 160);
  // 페이드 뒤 맵이 바뀌면 그대로 사라진다. 같은 맵 이동이면 곧 치운다.
  scene.time.delayedCall(900, () => {
    for (const object of objects) object.destroy();
    if (scene.player && playerDepth !== undefined && scene.player.active) scene.player.setDepth(Math.max(scene.player.depth, playerDepth));
  });
}

// ───────────────────────── 수납 연출 ─────────────────────────

function eventCell(scene: PlaySceneContext, eventId: string | undefined): Cell | undefined {
  if (!eventId) return undefined;
  const view = runtimeEventViewById(store.getCurrent(), scene.map, scene.session, scene.eventPositions, eventId);
  return view ? { x: view.x, y: view.y } : undefined;
}

/** 이 칸 수납의 종류: 페이지 interaction.style → 이벤트 이름 → 타일 이름표. */
export function containerStyleAt(scene: PlaySceneContext, cell: Cell, eventId?: string): ContainerStyle {
  const project = store.getCurrent();
  const view = eventId ? runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId) : undefined;
  const style = view?.page?.interaction?.style;
  if (isContainerStyle(style)) return style;
  const label = `${view?.event.name ?? ""} ${cellTiles(project, scene.map, cell.x, cell.y).map((t) => t.label).join(" ")}`;
  return containerStyleForLabel(label);
}

/** 칸의 가구 이미지를 흔든다(같은 칸 + 같은 이름의 윗칸). 개별 이미지가 없으면 흔들지 않는다. */
function shakeCell(scene: PlaySceneContext, cell: Cell, px: number, count: number): void {
  if (px <= 0 || count <= 0) return;
  const size = mapTileSize(scene.map);
  const images = [...rootYSortTileImagesAt(scene, cell.x, cell.y, size), ...rootYSortTileImagesAt(scene, cell.x, cell.y - 1, size)];
  const amp = Math.max(1, Math.round(px * size / 16));
  for (const image of images) {
    const baseX = image.x;
    scene.tweens.add({
      targets: image, x: baseX + amp, duration: 45, yoyo: true, repeat: count - 1, ease: "Sine.easeInOut",
      onComplete: () => { image.x = baseX; },
      onStop: () => { image.x = baseX; },
    });
  }
}

function burstParticles(scene: PlaySceneContext, cell: Cell, style: ContainerStyle): void {
  const spec = CONTAINER_FX[style].particles;
  const size = mapTileSize(scene.map);
  const s = size / 16;
  const cx = cell.x * size + size / 2;
  const cy = cell.y * size + size * 0.45;
  const depth = rowDepth(cell.y + 1, size) + FX_DEPTH_BUMP;
  for (let i = 0; i < spec.count; i++) {
    const color = spec.colors[i % spec.colors.length]!;
    const angle = (-Math.PI / 2) + (i / spec.count - 0.5) * Math.PI * 1.3 + (Math.sin(i * 12.9898) * 0.25);
    const speed = (spec.kind === "sparkle" ? 10 : 9 + (i % 3) * 3) * s;
    const w = spec.kind === "straw" ? 4 * s : spec.kind === "splinter" ? 3 * s : 2 * s;
    const h = spec.kind === "straw" ? 1 * s : spec.kind === "splinter" ? 2 * s : 2 * s;
    const bit = scene.add.rectangle(cx, cy, Math.max(1, w), Math.max(1, h), color).setDepth(depth);
    if (spec.kind === "straw" || spec.kind === "splinter") bit.setAngle((i * 47) % 180);
    const tx = cx + Math.cos(angle) * speed;
    const peak = cy + Math.sin(angle) * speed;
    const floorY = cell.y * size + size - 1 * s + ((i % 3) - 1) * s;
    const fallsToFloor = spec.kind !== "sparkle" && spec.kind !== "dust";
    scene.tweens.add({ targets: bit, x: tx + Math.cos(angle) * speed * 0.4, duration: 420, ease: "Quad.easeOut" });
    scene.tweens.add({
      targets: bit, y: peak, duration: 160, ease: "Quad.easeOut",
      onComplete: () => {
        scene.tweens.add({
          targets: bit, y: fallsToFloor ? floorY : peak - 3 * s, alpha: fallsToFloor ? 1 : 0, duration: 260, ease: fallsToFloor ? "Quad.easeIn" : "Linear",
          onComplete: () => {
            scene.tweens.add({ targets: bit, alpha: 0, delay: fallsToFloor ? 260 : 0, duration: 220, onComplete: () => bit.destroy() });
          },
        });
      },
    });
  }
}

/** 궤짝 뚜껑이 들리는 그림 — 어두운 속이 드러나고 뚜껑 판이 위로 젖혀진다. */
async function liftLid(scene: PlaySceneContext, cell: Cell): Promise<void> {
  const size = mapTileSize(scene.map);
  const s = size / 16;
  const x0 = cell.x * size;
  const y0 = cell.y * size;
  const depth = rowDepth(cell.y, size) + FX_DEPTH_BUMP;
  const g = scene.add.graphics().setDepth(depth);
  const frames: [number, number][] = [[1, 1], [3, 3], [4, 5]];
  for (const [gap, lift] of frames) {
    g.clear();
    g.fillStyle(0x140c06, 1).fillRect(x0 + 3 * s, y0 + (6 - gap) * s, 10 * s, gap * s);
    g.fillStyle(0x7a4a22, 1).fillRect(x0 + 2 * s, y0 + (5 - gap - lift / 2) * s, 12 * s, 2 * s);
    g.fillStyle(0xb07a3e, 1).fillRect(x0 + 2 * s, y0 + (5 - gap - lift / 2) * s, 12 * s, 1 * s);
    await sleep(scene, 70);
  }
  // 뒤진 흔적(syncContainerSearchedMarks)이 그 칸에 그려질 때까지 열린 채로 둔다 — 대사 동안 뚜껑이 닫혀 보이지 않게.
  holdUntilMark(scene, cell, g);
}

const pendingLids = new WeakMap<PlaySceneContext, Map<string, Phaser.GameObjects.Graphics>>();

function holdUntilMark(scene: PlaySceneContext, cell: Cell, g: Phaser.GameObjects.Graphics): void {
  const pending = pendingLids.get(scene) ?? new Map<string, Phaser.GameObjects.Graphics>();
  pendingLids.set(scene, pending);
  const key = `${scene.map.id}|${cell.x},${cell.y}`;
  pending.get(key)?.destroy();
  pending.set(key, g);
  // 흔적 페이지가 없는 수납(저작자가 searched 페이지를 안 둔 경우)도 결국 닫힌다.
  scene.time.delayedCall(15_000, () => { if (pending.get(key) === g) { pending.delete(key); g.destroy(); } });
}

export async function playContainerFx(scene: PlaySceneContext, style: ContainerStyle, cell: Cell): Promise<void> {
  const spec = CONTAINER_FX[style];
  playSe(spec.se);
  shakeCell(scene, cell, spec.shakePx, spec.shakes);
  if (spec.lid) await liftLid(scene, cell);
  burstParticles(scene, cell, style);
}

/** 떠오르는 글자 글꼴 — 갈무리 11(12px 격자). 격자 정수배 크기·정수 좌표·카메라 배율과 같은 해상도로만 그려야 또렷하다. */
const POPUP_FONT = '"Galmuri11 Regular", "Galmuri9", monospace';
const POPUP_FONT_PX = 12;

/** 찾은 것이 칸 위로 떠오른다 — 「+ 이름」 글자. 도트 글꼴을 화소 격자에 맞춰 그린다(소수 좌표·확대 재표본 없음). */
export function playLootPopup(scene: PlaySceneContext, cell: Cell, text: string, color: string, se: string): void {
  playSe(se);
  const size = mapTileSize(scene.map);
  const zoom = Math.max(1, Math.round(scene.cameras.main.zoom || 1));
  const cx = cell.x * size + size / 2;
  const y = Math.round(cell.y * size - 2);
  const make = (): Phaser.GameObjects.Text => {
    // 글자 텍스처는 카메라 배율과 같은 해상도(재표본 없음), 크기는 글꼴 격자 그대로(월드 px = 12 / 배율).
    const label = scene.add.text(0, y, text, {
      fontFamily: POPUP_FONT, fontSize: `${POPUP_FONT_PX}px`, color, stroke: "#1a1008", strokeThickness: 2,
    }).setResolution(zoom).setScale(1 / zoom).setOrigin(0, 1).setDepth(rowDepth(cell.y + 2, size) + 1);
    // 가운데 맞춤을 origin 0.5 로 하면 홀수 폭에서 반 화소에 걸린다 — 왼쪽 끝을 정수로 둔다.
    label.x = Math.round(cx - label.displayWidth / 2);
    return label;
  };
  const label = make();
  label.setAlpha(0);
  // 글꼴이 아직 안 내려왔으면(첫 사용) 받은 뒤 다시 그린다 — 대체 글꼴의 흐린 글자가 남지 않게.
  if (typeof document !== "undefined" && document.fonts?.check && !document.fonts.check(`${POPUP_FONT_PX}px "Galmuri11 Regular"`)) {
    void document.fonts.load(`${POPUP_FONT_PX}px "Galmuri11 Regular"`).then(() => {
      if (!label.active) return;
      label.setFontFamily(POPUP_FONT);
      label.x = Math.round(cx - label.displayWidth / 2);
    });
  }
  // 오르는 동안에도 정수 px 로만 움직인다(roundPixels 가 있어도 글자 텍스처는 소수 위치에서 흐려진다).
  const snap = (): void => { label.y = Math.round(label.y); };
  scene.tweens.add({ targets: label, alpha: 1, y: y - 6, duration: 220, ease: "Quad.easeOut", onUpdate: snap });
  scene.tweens.add({ targets: label, alpha: 0, y: y - 12, delay: 900, duration: 320, onUpdate: snap, onComplete: () => label.destroy() });
}

/** showAnimation 이 내장 연출 id 를 받으면 여기로 온다. wait 면 연출 길이만큼 기다린다. */
export async function playFieldFx(scene: PlaySceneContext, fx: FieldFx, target: Cell | undefined, currentEventId: string | undefined): Promise<void> {
  const cell = target ?? eventCell(scene, currentEventId) ?? { x: scene.tileX, y: scene.tileY };
  const done = sleep(scene, fieldFxDurationMs(fx));
  switch (fx.kind) {
    case "container":
      void playContainerFx(scene, fx.style, cell);
      break;
    case "popupItem": {
      const name = store.getCurrent().database.items?.find((item) => item.id === fx.itemId)?.name ?? fx.itemId;
      playLootPopup(scene, cell, `+ ${name}`, "#fff3c4", POPUP_ITEM_SE);
      break;
    }
    case "popupGold":
      playLootPopup(scene, cell, `+ ${fx.amount}G`, "#ffd860", POPUP_GOLD_SE);
      break;
    case "doorOpen": {
      const project = store.getCurrent();
      if (doorTileAt(project, scene.map, cell.x, cell.y)) {
        playSe(DOOR_OPEN_SE);
        void swingDoorOpen(scene, project, scene.map, cell);
      }
      break;
    }
  }
  await done;
}

// ───────────────────────── 뒤진 흔적 ─────────────────────────

const markLayers = new WeakMap<PlaySceneContext, { mapId: string; marks: Map<string, Phaser.GameObjects.Graphics> }>();

function drawMark(g: Phaser.GameObjects.Graphics, mark: ContainerSearchedMark, x0: number, y0: number, s: number): void {
  const px = (x: number, y: number, w: number, h: number, color: number, alpha = 1) => g.fillStyle(color, alpha).fillRect(x0 + x * s, y0 + y * s, w * s, h * s);
  switch (mark) {
    case "lid-open":
      px(3, 4, 10, 3, 0x140c06);
      px(2, 1, 12, 2, 0x7a4a22);
      px(2, 1, 12, 1, 0xb07a3e);
      break;
    case "pried":
      px(4, 5, 7, 1, 0x1a1008);
      px(10, 4, 3, 1, 0x1a1008);
      px(12, 14, 3, 1, 0xc8915a);
      px(2, 15, 2, 1, 0x9a6634);
      px(13, 12, 1, 1, 0xd8a870);
      break;
    case "lid-off":
      px(4, 2, 8, 2, 0x140c06, 0.85);
      px(12, 12, 4, 3, 0x7a5028);
      px(12, 12, 4, 1, 0xb07a44);
      break;
    case "spill":
      px(1, 14, 3, 1, 0xe6c86a);
      px(4, 15, 2, 1, 0xc9a85a);
      px(11, 15, 3, 1, 0xe6c86a);
      px(13, 13, 2, 1, 0xf2e2b0);
      px(7, 15, 2, 1, 0xd8b860);
      break;
    case "drawer":
      px(4, 9, 8, 1, 0x140c06);
      px(4, 10, 8, 2, 0x8a5a30);
      px(4, 10, 8, 1, 0xb88250);
      break;
  }
}

/**
 * 뒤진 수납 칸 위에 흔적을 그린다. 이벤트 계층을 다시 그릴 때마다 부른다 — 「이미 뒤짐」 페이지
 * (`interaction.kind === "container" && searched`)가 켜진 이벤트만 그리고, 꺼지면 지운다. 맵이 바뀌면 모두 지운다.
 */
export function syncContainerSearchedMarks(scene: PlaySceneContext): void {
  if (typeof scene.add?.graphics !== "function") return;
  let layer = markLayers.get(scene);
  if (!layer || layer.mapId !== scene.map.id) {
    for (const g of layer?.marks.values() ?? []) g.destroy();
    for (const g of pendingLids.get(scene)?.values() ?? []) g.destroy();
    pendingLids.get(scene)?.clear();
    layer = { mapId: scene.map.id, marks: new Map() };
    markLayers.set(scene, layer);
  }
  const size = mapTileSize(scene.map);
  const s = size / 16;
  const keep = new Set<string>();
  for (const view of runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)) {
    const interaction = view.page?.interaction;
    if (interaction?.kind !== "container" || interaction.searched !== true) continue;
    const style = isContainerStyle(interaction.style) ? interaction.style : containerStyleForLabel(view.event.name);
    const key = `${view.event.id}|${view.x},${view.y}|${style}`;
    keep.add(key);
    const lidKey = `${scene.map.id}|${view.x},${view.y}`;
    const lid = pendingLids.get(scene)?.get(lidKey);
    if (lid) { lid.destroy(); pendingLids.get(scene)!.delete(lidKey); }
    if (layer.marks.get(key)?.active) continue;
    const g = scene.add.graphics().setDepth(rowDepth(view.y, size) + 0.2);
    drawMark(g, CONTAINER_FX[style].mark, view.x * size, view.y * size, s);
    layer.marks.set(key, g);
  }
  for (const [key, g] of layer.marks) {
    if (keep.has(key)) continue;
    g.destroy();
    layer.marks.delete(key);
  }
}
