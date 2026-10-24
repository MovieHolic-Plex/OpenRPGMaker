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

/** 문짝(문 타일 그림)이 왼쪽 경첩으로 접히며 어두운 문간이 드러난다. 위 칸도 문이면 두 칸 높이로 연다. */
async function swingDoorOpen(scene: PlaySceneContext, project: Project, map: GameMap, bottom: Cell): Promise<void> {
  const size = mapTileSize(map);
  const s = size / 16;
  const cells: Cell[] = [bottom];
  if (doorTileAt(project, map, bottom.x, bottom.y - 1)) cells.unshift({ x: bottom.x, y: bottom.y - 1 });
  const tileset = project.tilesets[map.tilesetId];
  const resolver = (scene as unknown as { resolveTilesetTexture?: (t: NonNullable<typeof tileset>) => string }).resolveTilesetTexture;
  const textureKey = tileset ? resolver?.(tileset) ?? tilesetTextureKey(tileset) : "";
  const depth = rowDepth(bottom.y, size) + FX_DEPTH_BUMP;
  const inset = Math.round(2 * s);
  const objects: Phaser.GameObjects.GameObject[] = [];
  const panels: { image: Phaser.GameObjects.Image; left: number }[] = [];
  cells.forEach((c, i) => {
    const top = i === 0 ? inset : 0;
    const left = c.x * size + inset;
    const width = size - inset * 2;
    const dark = scene.add.rectangle(left, c.y * size + top, width, size - top, 0x120c08).setOrigin(0, 0).setDepth(depth);
    objects.push(dark);
    const door = doorTileAt(project, map, c.x, c.y);
    if (door && textureKey && scene.textures.exists(textureKey)) {
      const image = scene.add.image(c.x * size, c.y * size, textureKey, `tile_${door.tile}`).setOrigin(0, 0).setDepth(depth + 0.01);
      image.setCrop(inset, top, width, size - top);
      panels.push({ image, left });
      objects.push(image);
    }
  });
  // 플레이어가 문 칸 위에 서 있으면 문간 그림 앞에 남게 한다.
  const playerDepth = scene.player?.depth;
  if (scene.player && cells.some((c) => c.x === scene.tileX && c.y === scene.tileY)) scene.player.setDepth(depth + 0.1);
  for (const scaleX of [0.7, 0.42, 0.18]) {
    for (const { image, left } of panels) {
      image.setScale(scaleX, 1);
      // 크롭은 프레임 좌표다 — 배율을 걸면 크롭 시작점(inset)도 줄어드니 왼쪽 문틀에 붙게 되돌린다.
      image.x = left - inset * scaleX;
      image.setTint(scaleX > 0.5 ? 0xffffff : 0xb8b0a8);
    }
    await sleep(scene, DOOR_FRAME_MS);
  }
  await sleep(scene, 60);
  // 이동(페이드) 뒤 맵이 바뀌면 함께 치운다. 같은 맵 이동이면 바로 치운다.
  scene.time.delayedCall(700, () => {
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
    const speed = (spec.kind === "sparkle" ? 9 : 7 + (i % 3) * 2) * s;
    const w = spec.kind === "straw" ? 3 * s : spec.kind === "splinter" ? 2 * s : 1 * s;
    const h = spec.kind === "straw" ? 1 * s : spec.kind === "splinter" ? 1 * s : 1 * s;
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
  scene.time.delayedCall(700, () => g.destroy());
}

export async function playContainerFx(scene: PlaySceneContext, style: ContainerStyle, cell: Cell): Promise<void> {
  const spec = CONTAINER_FX[style];
  playSe(spec.se);
  shakeCell(scene, cell, spec.shakePx, spec.shakes);
  if (spec.lid) await liftLid(scene, cell);
  burstParticles(scene, cell, style);
}

/** 찾은 것이 칸 위로 떠오른다 — 「+ 이름」 글자와 반짝임. */
export function playLootPopup(scene: PlaySceneContext, cell: Cell, text: string, color: string, se: string): void {
  playSe(se);
  const size = mapTileSize(scene.map);
  const s = size / 16;
  const x = cell.x * size + size / 2;
  const y = cell.y * size - 2 * s;
  const label = scene.add.text(x, y, text, {
    fontFamily: "Galmuri11, 'Noto Sans KR', sans-serif", fontSize: `${Math.round(8 * s)}px`, color, stroke: "#1a1008", strokeThickness: Math.max(2, Math.round(2 * s)),
  }).setOrigin(0.5, 1).setDepth(rowDepth(cell.y + 2, size) + 1).setResolution(4);
  label.setAlpha(0);
  scene.tweens.add({ targets: label, alpha: 1, y: y - 6 * s, duration: 220, ease: "Quad.easeOut" });
  scene.tweens.add({ targets: label, alpha: 0, y: y - 12 * s, delay: 900, duration: 320, onComplete: () => label.destroy() });
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
