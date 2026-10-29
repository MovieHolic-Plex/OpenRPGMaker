// player/playSceneFieldFx.ts
// 필드 상호작용 연출 — 문 열기, 수납 뒤지기(뚜껑·흔들림·파편·소리), 찾은 것 떠오르기, 뒤진 흔적.
//
// 데이터(종류별 소리·흔들림·파편·흔적)는 project/containerFx.ts 가 갖고, 여기서는 그대로 그린다.
// 그림은 전부 절차 그림(사각형·그래픽)과 칸에 이미 그려진 타일 이미지 흔들기다 — 새 그림 자산이 필요 없다.
//  - 문: 이동(transfer) 직전 문 칸이 타일셋의 닫힘/열림 키트 짝(project/kitDoors.ts, 예 1×2 던전 문)이면 그 문 자신의 그림으로
//    닫힘 → 열림을 문 전체(키트 크기)에 걸쳐 바꾸고, 열린 그림을 세션에 남긴다. 이미 열린 키트 문이면 연출하지 않는다.
//    키트 짝이 없으면 문짝이 경첩 쪽으로 접히며 어두운 문간이 드러나고 문 소리가 난다.
//    문 이벤트가 문 캐릭터 시트(RPG Maker 관례: 방향 줄 = 닫힘→열림)를 쓰면 그 프레임을 넘긴다.
//  - 수납: showAnimation 의 `fx:container:<종류>` · `fx:popup:…` · `fx:door-open`.
//  - 흔적: `interaction: { kind: "container", searched: true }` 페이지가 켜진 칸 위에 그린다(syncContainerSearchedMarks).
import type Phaser from "phaser";
import { playSoundEffect } from "@/player/audio";
import { characterDepth, characterSpriteY } from "@/player/characterDepth";
import { applyDoorCue, DOOR_OPEN_SE } from "@/player/playSceneDoorway";
import { applyMapOverrides, rootYSortTileImagesAt } from "@/player/playSceneMapRuntime";
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
import { findKitDoor, type KitDoorMatch } from "@/project/kitDoors";
import { runtimeEventViewById, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { getMapTile, setMapTileOverride } from "@/project/session";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import type { GameMap, Project } from "@/project/types";
import { tilesetTextureKey } from "@/editor/tilesetImage";

type Cell = { readonly x: number; readonly y: number };

const FX_DEPTH_BUMP = 0.4;
const DOOR_FRAME_MS = 70;
/** 문이 열리기 시작하고 이만큼 뒤에 이동(페이드)을 시작한다 — 나머지 문짝 접힘은 페이드와 겹쳐 흐른다.
 *  예전엔 다 열릴 때까지(약 0.6초) 주인공이 멈춰 서 있어 문 앞에서 「버벅인다」고 느껴졌다(2026-10-24 사용자). */
const DOOR_LEAD_MS = 160;

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

// 여닫는 문짝만(이름표에 「문」·door). 성문·관문·통로·문틀·창살(걷어 올린 성문)·계단·사다리·동굴 입구·아치처럼
// 여닫는 문짝 그림이 없는 출구는 뺀다 — 성문을 걸어 나가는데 문 열리는 연출이 나던 것을 막는다(2026-10-24 사용자).
const SWING_DOOR = /(?<![창주성대관])문(?![양자서장제구화턱틀패루])|door/i;
const NOT_SWING = /성문|관문|gate|portcullis|창살|걷어|올린|raised|통로|passage|입구|entrance|출구|exit|동굴|cave|굴|계단|stair|사다리|ladder|구멍|hole|열린|open|arch|아치|포털|portal|뚜껑/i;

function doorTileAt(project: Project, map: GameMap, x: number, y: number): { tile: number } | null {
  for (const entry of cellTiles(project, map, x, y)) {
    if (SWING_DOOR.test(entry.label) && !NOT_SWING.test(entry.label)) return { tile: entry.tile };
  }
  return null;
}

// ───────────────────────── 문 열기 ─────────────────────────

/** 문 이벤트 그림이 문 캐릭터 시트인가(RPG Maker 관례 「!Door」 등). 성문(gate) 시트는 문짝이 아니다. */
function isDoorCharset(spriteId: string): boolean {
  return /door|(?<![성관])문(?!루)/i.test(spriteId) && !/gate|성문|관문/i.test(spriteId);
}

/** 맵마다 미리 정해 두는 문 연출 — 이벤트 id → 열 문짝(칸·잘라 둔 프레임). 맵을 그릴 때 한 번 만든다. */
type DoorPanel = { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly frame: string };
type DoorPlan = { readonly kind: "charset" } | { readonly kind: "tile"; readonly bottom: Cell; readonly textureKey: string; readonly panels: readonly DoorPanel[] };
const doorPlans = new WeakMap<GameMap, { readonly key: string; readonly plans: Map<string, DoorPlan | null> }>();

function walkCommands(commands: readonly unknown[] | undefined, visit: (command: { kind?: string; [key: string]: unknown }) => void): void {
  for (const raw of commands ?? []) {
    const command = raw as { kind?: string; [key: string]: unknown };
    visit(command);
    for (const key of ["then", "else", "commands", "body"]) {
      const nested = command[key];
      if (Array.isArray(nested)) walkCommands(nested, visit);
    }
  }
}

/** 다른 맵으로 옮기는 transfer 를 가진 이벤트(문 연출 후보). door:false 뿐이면 뺀다. */
function transferEventIds(map: GameMap): string[] {
  const ids: string[] = [];
  for (const event of map.events) {
    let wants = false;
    for (const page of event.pages ?? []) walkCommands(page.commands as unknown[], (c) => {
      if (c.kind === "transfer" && c.mapId !== map.id && c.door !== false) wants = true;
    });
    if (wants) ids.push(event.id);
  }
  return ids;
}

function tilesetTextureKeyFor(scene: PlaySceneContext, project: Project, map: GameMap): string {
  const tileset = project.tilesets[map.tilesetId];
  // 메서드로 부른다(this 가 필요하다).
  const host = scene as unknown as { resolveTilesetTexture?(t: NonNullable<typeof tileset>): string };
  const key = tileset ? host.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset) : "";
  // renderTiles 컨텍스트의 textures 는 선택이다(RenderTilesSceneContext) — 없으면 문 연출 텍스처도 없다.
  return key && scene.textures?.exists(key) ? key : "";
}

/**
 * 맵을 그릴 때 부른다(renderEvents). 문 이벤트마다 문짝 칸·화소 상자·잘라 둔 프레임을 미리 정해 둔다 —
 * 예전엔 이동하는 순간 getPixel 을 칸당 수백 번 불러(매번 1×1 캔버스 그리기+읽기) 문 열 때 화면이 멈칫했다.
 * 같은 맵·같은 텍스처면 다시 만들지 않는다.
 */
export function prepareDoorFx(scene: PlaySceneContext): void {
  const project = store.getCurrent();
  const map = scene.map;
  if (!map) return;
  // 문 이벤트가 없는 맵은 텍스처를 풀지 않는다 — 타일 재구축 한 번에 텍스처 해석은 한 번이어야 한다(mapEntryTilePass).
  // 명령 훑기(transferEventIds)는 예전처럼 캐시가 빗나갈 때만 한다 — 처음 보는 맵만 문 유무를 먼저 본다.
  const noDoorsKey = `none|${map.events.length}`;
  const cached = doorPlans.get(map);
  if (cached?.key === noDoorsKey) return;
  const firstIds = cached ? null : transferEventIds(map);
  if (firstIds?.length === 0) { doorPlans.set(map, { key: noDoorsKey, plans: new Map() }); return; }
  const textureKey = tilesetTextureKeyFor(scene, project, map);
  const key = `${textureKey}|${map.events.length}`;
  if (cached?.key === key) return;
  const transferIds = firstIds ?? transferEventIds(map);
  if (transferIds.length === 0) { doorPlans.set(map, { key: noDoorsKey, plans: new Map() }); return; }
  const plans = new Map<string, DoorPlan | null>();
  doorPlans.set(map, { key, plans });
  const size = mapTileSize(map);
  for (const id of transferIds) {
    const event = map.events.find((e) => e.id === id)!;
    const view = runtimeEventViewById(project, map, scene.session, scene.eventPositions, id);
    if (view && !view.transparent && isDoorCharset(view.sprite?.id ?? "")) { plans.set(id, { kind: "charset" }); continue; }
    plans.set(id, textureKey ? tileDoorPlan(scene, project, map, { x: event.x, y: event.y }, textureKey, size) : null);
  }
}

/** 이벤트 칸 또는 바로 윗칸(벽에 그린 문짝)에 문 타일이 있으면 그 문짝 계획. */
function tileDoorPlan(scene: PlaySceneContext, project: Project, map: GameMap, at: Cell, textureKey: string, size: number): DoorPlan | null {
  const bottom = [at, { x: at.x, y: at.y - 1 }].find((c) => doorTileAt(project, map, c.x, c.y));
  if (!bottom) return null;
  const panels: DoorPanel[] = [];
  for (const piece of doorPieces(scene, project, map, bottom, textureKey, size)) {
    const frame = panelFrame(scene, textureKey, piece.tile, piece.box);
    if (frame) panels.push({ x: piece.cell.x * size + piece.box.x, y: piece.cell.y * size + piece.box.y, w: piece.box.w, h: piece.box.h, frame });
  }
  return panels.length ? { kind: "tile", bottom, textureKey, panels } : null;
}

/**
 * 문 여는 연출 — 이동 직전에 부른다. 반환: 연출을 했는가.
 *  - mode "auto"(기본): 그 이벤트가 문 캐릭터 시트이거나, 이벤트 칸·바로 윗칸에 여닫는 문 타일이 있을 때만.
 *    성문·통로·맵 가장자리·계단·동굴 입구는 연출 없이 곧장 넘어간다.
 *  - mode "on"(transfer.door:true): 위 규칙으로 못 찾아도 주인공이 바라보는 칸·선 칸의 문 타일까지 찾아 연다.
 * silent = 다른 장르 문 소리가 이미 났다(몬스터 장르).
 */
export async function playDoorOpenBeforeTransfer(
  scene: PlaySceneContext,
  eventId: string | undefined,
  options: { readonly silent?: boolean; readonly mode?: "auto" | "on" } = {},
): Promise<boolean> {
  const project = store.getCurrent();
  const map = scene.map;
  // 키트 문(닫힘/열림 짝): 그 문 자신의 그림으로 연다. 이벤트가 먼저 연 문(열림)이면 연출을 겹치지 않는다.
  const kit = kitDoorForTransfer(scene, project, eventId, options.mode);
  if (kit) {
    if (kit.state === "open") return false;
    if (!options.silent) playSe(DOOR_OPEN_SE);
    await Promise.race([openKitDoor(scene, kit, "transfer"), sleep(scene, DOOR_LEAD_MS)]);
    return true;
  }
  prepareDoorFx(scene);
  let plan = eventId ? doorPlans.get(map)?.plans.get(eventId) ?? null : null;
  if (!plan && options.mode === "on") {
    const view = eventId ? runtimeEventViewById(project, map, scene.session, scene.eventPositions, eventId) : undefined;
    if (view && !view.transparent && /door|문|gate/i.test(view.sprite?.id ?? "")) plan = { kind: "charset" };
    else {
      const facing = scene.session.playerFacing ?? "down";
      const d = facing === "up" ? [0, -1] : facing === "down" ? [0, 1] : facing === "left" ? [-1, 0] : [1, 0];
      const textureKey = tilesetTextureKeyFor(scene, project, map);
      for (const c of [...(view ? [{ x: view.x, y: view.y }] : []), { x: scene.tileX + d[0]!, y: scene.tileY + d[1]! }, { x: scene.tileX, y: scene.tileY }]) {
        plan = textureKey ? tileDoorPlan(scene, project, map, c, textureKey, mapTileSize(map)) : null;
        if (plan) break;
      }
    }
  }
  if (!plan) return false;
  let animation: Promise<void>;
  if (plan.kind === "charset") {
    const target = eventId!;
    animation = (async () => {
      for (const frame of [1, 2, 3]) {
        applyDoorCue(scene as unknown as Parameters<typeof applyDoorCue>[0], { kind: "doorCue", target, frame, ms: DOOR_FRAME_MS, ...(frame === 1 && !options.silent ? { se: DOOR_OPEN_SE } : {}) }, playSe);
        await sleep(scene, DOOR_FRAME_MS);
      }
    })();
  } else {
    if (!options.silent) playSe(DOOR_OPEN_SE);
    animation = swingDoorOpen(scene, plan);
  }
  await Promise.race([animation, sleep(scene, DOOR_LEAD_MS)]);
  return true;
}

// ───────────────────────── 키트 문(닫힘/열림 짝) ─────────────────────────

/** 세션의 changeTile 덮어쓰기까지 본 칸 읽기로 키트 문을 찾는다(이벤트가 이미 연 문은 열림). */
function runtimeKitDoor(scene: PlaySceneContext, project: Project, at: Cell): KitDoorMatch | null {
  const map = scene.map;
  return findKitDoor(project, map, at, (layer, index) => getMapTile(scene.session, map.id, layer, map, index) ?? -1);
}

/** 이동 이벤트의 키트 문: 이벤트 칸(또는 바로 윗칸). door:true 면 주인공이 바라보는 칸·선 칸까지. */
function kitDoorForTransfer(scene: PlaySceneContext, project: Project, eventId: string | undefined, mode: "auto" | "on" | undefined): KitDoorMatch | null {
  const view = eventId ? runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId) : undefined;
  const cells: Cell[] = view ? [{ x: view.x, y: view.y }] : [];
  if (mode === "on") {
    const facing = scene.session.playerFacing ?? "down";
    const d = facing === "up" ? [0, -1] : facing === "down" ? [0, 1] : facing === "left" ? [-1, 0] : [1, 0];
    cells.push({ x: scene.tileX + d[0]!, y: scene.tileY + d[1]! }, { x: scene.tileX, y: scene.tileY });
  }
  for (const cell of cells) {
    const kit = runtimeKitDoor(scene, project, cell);
    if (kit) return kit;
  }
  return null;
}

/** 열림 단계(닫힌 그림이 걷히고 열린 그림이 드러난다). 칸 그림이라 계단식으로 끊어 바꾼다. */
const KIT_DOOR_STEPS = [0.34, 0.67, 1] as const;

/**
 * 키트 문을 그 문 자신의 그림으로 연다 — 문 전체(키트 크기, 예 1×2)에 닫힌 그림을 덮고 열린 그림으로 바꿔 간다.
 * 끝나면 열린 그림을 세션 덮어쓰기로 남긴다(다시 와도 열려 있다). why: "transfer" 면 페이드와 겹쳐 흐르니 덮개를 조금 더 남긴다.
 */
async function openKitDoor(scene: PlaySceneContext, kit: KitDoorMatch, why: "transfer" | "event"): Promise<void> {
  const project = store.getCurrent();
  const map = scene.map;
  const textureKey = tilesetTextureKeyFor(scene, project, map);
  const size = mapTileSize(map);
  const bottomY = kit.origin.y + kit.pair.height - 1;
  const depth = rowDepth(bottomY, size) + FX_DEPTH_BUMP;
  const closing: Phaser.GameObjects.Image[] = [];
  const opening: Phaser.GameObjects.Image[] = [];
  const objects: Phaser.GameObjects.GameObject[] = [];
  const frameOk = (tile: number) => tile >= 0 && !!textureKey && scene.textures.get(textureKey).has(`tile_${tile}`);
  if (textureKey) {
    kit.pair.closed.forEach((closedCell, i) => {
      const openCell = kit.pair.open[i]!;
      const x = (kit.origin.x + closedCell.dx) * size, y = (kit.origin.y + closedCell.dy) * size;
      if (closedCell.lower === openCell.lower && closedCell.upper === openCell.upper) return;
      const index = (kit.origin.y + closedCell.dy) * map.width + (kit.origin.x + closedCell.dx);
      // 칸을 층 순서대로 다시 쌓는다: 아래층(바뀌면 닫힘→열림) 위에 위층(바뀌면 닫힘→열림). 키트가 비운 층은 맵 그림 그대로.
      let order = 0;
      for (const layer of ["lower", "upper"] as const) {
        const before = layer === "lower" ? closedCell.lower : closedCell.upper;
        const after = layer === "lower" ? openCell.lower : openCell.upper;
        const shown = before >= 0 ? before : getMapTile(scene.session, map.id, layer, map, index) ?? -1;
        const add = (tile: number, alpha: number) => {
          const image = scene.add.image(x, y, textureKey, `tile_${tile}`).setOrigin(0, 0).setDepth(depth + order++ * 0.001).setAlpha(alpha);
          objects.push(image);
          return image;
        };
        if (before === after) { if (frameOk(shown)) add(shown, 1); continue; }
        if (frameOk(before)) closing.push(add(before, 1));
        if (frameOk(after)) opening.push(add(after, 0));
      }
    });
  }
  const playerDepth = scene.player?.depth;
  const onDoor = scene.player && scene.tileX >= kit.origin.x && scene.tileX < kit.origin.x + kit.pair.width && scene.tileY >= kit.origin.y && scene.tileY <= bottomY;
  if (onDoor) scene.player!.setDepth(depth + 0.1);
  for (const t of KIT_DOOR_STEPS) {
    for (const image of closing) image.setAlpha(1 - t);
    for (const image of opening) image.setAlpha(t);
    await sleep(scene, DOOR_FRAME_MS);
  }
  // 열린 그림을 남긴다(이벤트의 changeTile 과 같은 값 — 다시 들어와도 열려 있다).
  for (const change of kit.changes) {
    setMapTileOverride(scene.session, map.id, change.layer, change.y * map.width + change.x, change.open);
  }
  if (scene.map === map) applyMapOverrides(scene);
  scene.time.delayedCall(why === "transfer" ? 900 : 120, () => {
    for (const object of objects) object.destroy();
    if (scene.player && playerDepth !== undefined && scene.player.active) scene.player.setDepth(Math.max(scene.player.depth, playerDepth));
  });
}

type DoorBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
const doorBoxCache = new Map<string, DoorBox | null>();

/** 타일 프레임 하나의 화소 — 프레임마다 한 번만 작은 캔버스에 그려 읽는다(getPixel 은 화소마다 그리고 읽어 느렸다). */
const framePixelCache = new Map<string, { readonly data: Uint8ClampedArray; readonly w: number } | null>();
function framePixels(scene: PlaySceneContext, textureKey: string, frameName: string): ((x: number, y: number) => readonly [number, number, number, number] | null) | null {
  const cacheKey = `${textureKey}|${frameName}`;
  let pixels = framePixelCache.get(cacheKey);
  if (pixels === undefined) {
    pixels = null;
    const frame = scene.textures.get(textureKey).get(frameName) as Phaser.Textures.Frame | undefined;
    if (frame && frame.name === frameName) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
          pixels = { data: ctx.getImageData(0, 0, frame.cutWidth, frame.cutHeight).data, w: frame.cutWidth };
        }
      } catch { pixels = null; }
    }
    framePixelCache.set(cacheKey, pixels);
  }
  if (!pixels) return null;
  const { data, w } = pixels;
  return (x, y) => {
    if (x < 0 || y < 0 || x >= w) return null;
    const i = (y * w + x) * 4;
    return i + 3 < data.length ? [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!] : null;
  };
}

/**
 * 문 타일 안에서 문짝이 차지하는 사각형(px, 프레임 좌표). 같은 줄 옆 칸(벽)과 다른 화소의 테두리 상자다 —
 * 문 타일은 대개 벽 무늬 위에 문짝을 그린 것이라 벽과 같은 화소를 빼면 문짝만 남는다. 옆 벽이 없으면 null.
 */
function doorPanelBox(scene: PlaySceneContext, textureKey: string, doorTile: number, wallTile: number | null, size: number): DoorBox | null {
  if (wallTile === null || wallTile === doorTile) return null;
  const key = `${textureKey}|${doorTile}|${wallTile}`;
  if (doorBoxCache.has(key)) return doorBoxCache.get(key)!;
  const door = framePixels(scene, textureKey, `tile_${doorTile}`);
  const wall = framePixels(scene, textureKey, `tile_${wallTile}`);
  let box: DoorBox | null = null;
  if (door) {
    let minX = size, minY = size, maxX = -1, maxY = -1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const a = door(x, y);
        if (!a || a[3] < 128) continue;
        const b = wall?.(x, y);
        const diff = !b || b[3] < 128 ? 255 : Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        if (diff < 60) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    box = maxX >= minX && maxY >= minY && (maxX - minX + 1) >= 4 && (maxY - minY + 1) >= 4
      ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
  }
  doorBoxCache.set(key, box);
  return box;
}

/**
 * 좌우 칸에서 문이 아닌 벽 타일 — 같은 층을 먼저, 없으면 그 아래 층들. 문짝을 위층에 얹고 벽은 아래층에 깐 칩셋(버들항)은
 * 같은 층 이웃이 비어 문짝 상자를 못 재고 1칸 기본 상자로 떨어졌다(2026-10-30 사용자 「왜 1×1 이냐」).
 */
function neighbourWallTile(project: Project, map: GameMap, cell: Cell, layer: (typeof LAYER_KEYS)[number]): number | null {
  const layers = LAYER_KEYS.slice(LAYER_KEYS.indexOf(layer));
  for (const from of layers) {
    for (const dx of [-1, 1]) {
      const x = cell.x + dx;
      if (x < 0 || x >= map.width) continue;
      const tile = (map[from] as ArrayLike<number> | undefined)?.[cell.y * map.width + x] ?? -1;
      if (tile < 0) continue;
      if (doorTileAt(project, map, x, cell.y)) continue;
      return tile;
    }
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
  // 윗칸도 같은 문(문 이름표가 붙은 같은 층 그림)이면 문짝은 두 칸 높이다 — 아래 칸 상자를 칸 꼭대기까지 올려 둘을 잇는다.
  const aboveIsDoor = (cell: Cell) => cell.y >= 0 && cellTiles(project, map, cell.x, cell.y).some((t) => t.layer === layer && SWING_DOOR.test(t.label) && !NOT_SWING.test(t.label));
  const measured = doorPanelBox(scene, textureKey, door.tile, neighbourWallTile(project, map, bottom, layer), size);
  /** 잴 수 없을 때의 기본 상자 — 윗칸도 문이면 칸 꼭대기까지(두 칸이 이어진다). */
  const fallbackBox = (cell: Cell, x: number, w: number): DoorBox => {
    const top = aboveIsDoor({ x: cell.x, y: cell.y - 1 }) ? 0 : inset;
    return { x, y: top, w, h: size - top };
  };
  const box = measured ?? fallbackBox(bottom, inset, size - inset * 2);
  pieces.push({ cell: bottom, tile: door.tile, box });
  let below = box;
  for (let up = 1; up <= 2; up++) {
    const cell = { x: bottom.x, y: bottom.y - up };
    const tile = (map[layer] as ArrayLike<number> | undefined)?.[cell.y * map.width + cell.x] ?? -1;
    if (cell.y < 0 || tile < 0 || below.y > 1) break;
    const found = doorPanelBox(scene, textureKey, tile, neighbourWallTile(project, map, cell, layer), size)
      ?? (aboveIsDoor(cell) ? fallbackBox(cell, box.x, box.w) : null);
    if (!found || found.y + found.h < size - 1) break;
    const left = Math.max(found.x, box.x), right = Math.min(found.x + found.w, box.x + box.w);
    if (right - left < box.w * 0.5) break;
    below = { x: box.x, y: found.y, w: box.w, h: size - found.y };
    pieces.unshift({ cell, tile, box: below });
  }
  return pieces;
}

/** 문짝(문 타일 그림)이 왼쪽 경첩으로 접히며 어두운 문간이 드러난다. 미리 잘라 둔 프레임만 쓴다(이 순간 화소 계산 없음). */
async function swingDoorOpen(scene: PlaySceneContext, plan: Extract<DoorPlan, { kind: "tile" }>): Promise<void> {
  if (!scene.textures.exists(plan.textureKey)) return;
  const size = mapTileSize(scene.map);
  const depth = rowDepth(plan.bottom.y, size) + FX_DEPTH_BUMP;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const panels: Phaser.GameObjects.Image[] = [];
  for (const panel of plan.panels) {
    // 어두운 문간 — Rectangle(도형 파이프라인)은 그 맵에서 처음 그릴 때 셰이더를 엮느라 한 프레임이 멈췄다.
    // 타일과 같은 이미지 파이프라인(흰 텍스처 + 색)으로 그린다.
    const doorway = scene.textures.exists("__WHITE")
      ? scene.add.image(panel.x, panel.y, "__WHITE").setOrigin(0, 0).setDisplaySize(panel.w, panel.h).setTint(0x120c08)
      : scene.add.rectangle(panel.x, panel.y, panel.w, panel.h, 0x120c08).setOrigin(0, 0);
    objects.push(doorway.setDepth(depth));
    const image = scene.add.image(panel.x, panel.y, plan.textureKey, panel.frame).setOrigin(0, 0).setDepth(depth + 0.01);
    panels.push(image);
    objects.push(image);
  }
  // 플레이어가 문 칸 위에 서 있으면 문간 그림 앞에 남게 한다.
  const playerDepth = scene.player?.depth;
  if (scene.player && scene.tileX === plan.bottom.x && scene.tileY === plan.bottom.y) scene.player.setDepth(depth + 0.1);
  for (const scaleX of [0.8, 0.58, 0.36, 0.16]) {
    for (const image of panels) {
      image.setScale(scaleX, 1);
      image.setTint(scaleX > 0.5 ? 0xffffff : scaleX > 0.3 ? 0xc8beb4 : 0x9a9088);
    }
    await sleep(scene, DOOR_FRAME_MS);
  }
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
      const kit = runtimeKitDoor(scene, project, cell);
      if (kit) {
        if (kit.state === "closed") {
          playSe(DOOR_OPEN_SE);
          await openKitDoor(scene, kit, "event");
        }
      } else if (doorTileAt(project, scene.map, cell.x, cell.y)) {
        playSe(DOOR_OPEN_SE);
        const textureKey = tilesetTextureKeyFor(scene, project, scene.map);
        const plan = textureKey ? tileDoorPlan(scene, project, scene.map, cell, textureKey, mapTileSize(scene.map)) : null;
        if (plan?.kind === "tile") void swingDoorOpen(scene, plan);
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
