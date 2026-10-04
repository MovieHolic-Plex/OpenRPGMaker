// 높이 지형(map.relief)의 게임 화면. 절벽 띠·들린 타일 depth·벽면 장식·캐릭터 들림을 한곳에서 정한다.
//
// depth 규칙 — 맵 줄 Y 의 모든 것은 그 줄에 발을 둔 same 캐릭터(200k + (Y+1)·칸) **바로 밑**에 모인다:
//   윗면 띠(-0.5) < 들린 하층 타일(-0.4) < 들린 그림자(-0.38) < 들린 ○ 상층(-0.35) < 벽 띠(-0.3) < 벽면 장식(-0.29) < 캐릭터(0)
// 그래서 줄 Y 의 절벽(윗면·벽)은 북쪽 줄(Y-1 이하) 캐릭터를 가리고, 그 줄과 남쪽 줄 캐릭터에게는 가려진다.
//
// 캐릭터 들림은 **그리는 프레임에만** 얹는다(scene postupdate 에서 올리고 render 에서 되돌림). sprite.y 는 접지선에 남으므로
// depth·타일 역산(Math.floor(sprite.y / 칸))·트윈·넉백 절대 좌표가 그대로 맞고, 카메라는 들린 위치를 따른다
// (Phaser Systems: postupdate → render{depthSort → 카메라 preRender → 그리기} → render 이벤트).
import { characterDepth } from "@/player/characterDepth";
import { PLAYER_SHADOW_KEY } from "@/player/characterHopRuntime";
import { asReliefTextures, buildReliefStripTextures, reliefFieldOf, removeReliefTextures, type ReliefTextureManager } from "@/player/reliefStrips";
import { cellLift, footLift } from "@/project/relief/screen";
import { mapTileSize } from "@/project/tileGeometry";
import type { GameMap } from "@/project/types";
import type { ReliefGroundSurface } from "@/project/relief/render";

export const RELIEF_TOP_DEPTH = -0.5;
export const RELIEF_LIFTED_LOWER_DEPTH = -0.4;
export const RELIEF_LIFTED_SHADOW_DEPTH = -0.38;
export const RELIEF_LIFTED_UPPER_DEPTH = -0.35;
export const RELIEF_WALL_DEPTH = -0.3;
export const RELIEF_WALL_DECOR_DEPTH = -0.29;

/** 줄 Y 의 절벽·들린 타일 depth. offset 은 위 RELIEF_*_DEPTH 중 하나(+ 같은 칸 쌓기 순서용 작은 값). */
export function reliefRowDepth(row: number, tileSize: number, offset: number): number {
  return characterDepth("same", (row + 1) * tileSize) + offset;
}

/** 칸 (x, y) 에 선 것을 올릴 월드 px. relief 가 없거나 평지면 0. */
export function reliefLiftPx(map: Pick<GameMap, "relief">, x: number, y: number, tileSize: number): number {
  const field = reliefFieldOf(map.relief);
  return field ? cellLift(field, x, y) * tileSize : 0;
}

/**
 * 가장 위로 튀어나온 칸이 월드 y=0 위로 몇 px 올라가는가. 카메라 경계를 그만큼 위로 넓혀야
 * 북쪽 끝 고지대가 잘리지 않는다.
 */
export function reliefTopOverhangPx(map: Pick<GameMap, "relief">, tileSize: number): number {
  const field = reliefFieldOf(map.relief);
  if (!field) return 0;
  let overhang = 0;
  for (let y = 0; y < field.height; y++) for (let x = 0; x < field.width; x++) overhang = Math.max(overhang, cellLift(field, x, y) - y);
  return overhang * tileSize;
}

interface ReliefImage {
  setOrigin(x: number, y: number): unknown;
  setDepth(depth: number): unknown;
  setScale?(value: number): unknown;
}

export interface ReliefLayerOptions {
  readonly ground?: ReliefGroundSurface;
  readonly tileSize: number;
  /** 벽면 장식을 그릴 타일셋 텍스처. 없으면 장식을 건너뛴다. */
  readonly wallDecor: { readonly textureKey: string; readonly frame: (tile: number) => string } | null;
}

export interface ReliefRenderScene<TImage extends ReliefImage> {
  readonly map: GameMap;
  readonly textures?: Partial<ReliefTextureManager>;
  readonly add: { image(x: number, y: number, texture: string, frame?: string | number): TImage };
}

const hostTextures = new WeakMap<object, readonly string[]>();

/**
 * 절벽 띠(줄마다 윗면·벽 두 장)와 벽면 장식을 root 표시 목록에 올린다. 만든 GameObject 는 onCreated 로
 * 넘겨 호출자가 타일과 같이 파괴한다. 텍스처는 host 마다 기억했다가 다음 호출·{@link clearReliefTextures} 에서 버린다.
 */
export function renderReliefLayer<TImage extends ReliefImage>(
  scene: ReliefRenderScene<TImage>,
  host: object,
  options: ReliefLayerOptions,
  onCreated: (image: TImage) => void,
): void {
  clearReliefTextures(scene, host);
  const map = scene.map, relief = map.relief, textures = asReliefTextures(scene.textures);
  const { tileSize, wallDecor } = options;
  if (!relief || !reliefFieldOf(relief) || !textures || typeof document === "undefined") return;
  const built = buildReliefStripTextures(textures, relief, tileSize, { ground: options.ground });
  hostTextures.set(host, built.textureKeys);
  for (const frame of built.frames) {
    const image = scene.add.image(frame.x, frame.y, frame.textureKey, frame.frame);
    image.setOrigin(0, 0);
    image.setScale?.(frame.scale);
    image.setDepth(reliefRowDepth(frame.row, tileSize, frame.part === "under" ? RELIEF_TOP_DEPTH : RELIEF_WALL_DEPTH));
    onCreated(image);
  }
  if (!wallDecor) return;
  for (const decor of relief.wallDecor ?? []) {
    const top = decor.y * tileSize - reliefLiftPx(map, decor.x, decor.y, tileSize);
    const image = scene.add.image(decor.x * tileSize, top + decor.row * tileSize, wallDecor.textureKey, wallDecor.frame(decor.tile));
    image.setOrigin(0, 0);
    image.setDepth(reliefRowDepth(decor.y, tileSize, RELIEF_WALL_DECOR_DEPTH));
    onCreated(image);
  }
}

export function clearReliefTextures(scene: { readonly textures?: Partial<ReliefTextureManager> }, host: object): void {
  const keys = hostTextures.get(host);
  const textures = asReliefTextures(scene.textures);
  if (keys && textures) removeReliefTextures(textures, keys);
  hostTextures.delete(host);
}

interface LiftableSprite {
  x: number;
  y: number;
  readonly depth?: number;
  readonly active?: boolean;
  setDepth?(depth: number): unknown;
}

const isLiftable = (value: object): value is LiftableSprite =>
  typeof (value as { x?: unknown }).x === "number" && typeof (value as { y?: unknown }).y === "number";

/** same 캐릭터 띠(200k) 밑 = below 우선순위. 들린 칸에서는 그 줄 윗면 타일 위로 올려야 보인다. */
const SAME_PRIORITY_DEPTH = characterDepth("same", 0);
const ABOVE_PRIORITY_DEPTH = characterDepth("above", 0);

interface ReliefLiftScene {
  readonly map: GameMap;
  readonly player?: LiftableSprite;
  readonly eventSprites: Map<string, LiftableSprite>;
  readonly followerSprites: Map<string, LiftableSprite>;
  /** 체공 그림자 — 런타임에는 Phaser 이미지라 x·y 가 있다. 타입(ShadowImage)엔 없으니 쓸 때 확인한다. */
  readonly characterShadows?: Map<string, object>;
  readonly events: { on(event: string, fn: () => void): unknown; off(event: string, fn: () => void): unknown; once(event: string, fn: () => void): unknown };
}

/** 스프라이트 접지점(원점 0.5, 1)이 선 곳의 들림 px. 걷는 중이면 두 칸 사이를 보간한다. */
export function spriteReliefLiftPx(map: GameMap | undefined, sprite: { readonly x: number; readonly y: number }): number {
  // 맵이 아직 없는 씬(시험용 가짜 포함)은 들림이 없다
  if (!map) return 0;
  const field = reliefFieldOf(map.relief);
  if (!field) return 0;
  const size = mapTileSize(map);
  return footLift(field, sprite.x / size, sprite.y / size) * size;
}

/** 그리는 동안만 캐릭터를 들림만큼 올린다. 씬 create 에서 한 번 부른다. */
export function installReliefSpriteLift(scene: ReliefLiftScene): void {
  const lifted: { sprite: LiftableSprite; px: number; depth: number | null }[] = [];
  // 바닥 띠는 칸의 남쪽 끝 depth를 쓴다. 이동 중의 연속 y depth를 그대로 쓰면
  // 자기 발이 놓인 바닥까지 몸 위에 그려진다. 그리는 동안만 같은 칸의 띠 위로 정렬한다.
  const lift = (sprite: LiftableSprite | undefined, px: number, row: number) => {
    if (!sprite || sprite.active === false) return;
    let depth: number | null = null;
    if (typeof sprite.depth === "number" && sprite.depth < ABOVE_PRIORITY_DEPTH && sprite.setDepth) {
      depth = sprite.depth;
      const size = mapTileSize(scene.map);
      const fraction = Math.max(0, Math.min(1, sprite.y / size - row));
      const offset = depth < SAME_PRIORITY_DEPTH ? RELIEF_LIFTED_UPPER_DEPTH + 0.01 : 0;
      sprite.setDepth(reliefRowDepth(row, size, offset + fraction * 0.001));
    }
    sprite.y -= px;
    lifted.push({ sprite, px, depth });
  };
  const restore = () => {
    for (const { sprite, px, depth } of lifted) {
      sprite.y += px;
      if (depth !== null) sprite.setDepth?.(depth);
    }
    lifted.length = 0;
  };
  const apply = () => {
    // 그리지 않은 프레임(씬이 보이지 않음)이 있어도 들림이 쌓이지 않게 먼저 되돌린다.
    restore();
    if (!reliefFieldOf(scene.map.relief)) return;
    const size = mapTileSize(scene.map);
    const ownerLift = new Map<string, { px: number; row: number }>();
    const own = (key: string, sprite: LiftableSprite | undefined) => {
      if (!sprite) return;
      // 발이 칸 경계에 있으면 직전 바닥에 속한다. round는 다음 바닥에 들어가도 반 걸음 동안 이전 줄에 남는다.
      const px = spriteReliefLiftPx(scene.map, sprite), row = Math.ceil(sprite.y / size - 1e-6) - 1;
      ownerLift.set(key, { px, row });
      lift(sprite, px, row);
    };
    own(PLAYER_SHADOW_KEY, scene.player);
    for (const [id, sprite] of scene.eventSprites) own(id, sprite);
    for (const [id, sprite] of scene.followerSprites) own(`follower:${id}`, sprite);
    for (const [key, shadow] of scene.characterShadows ?? []) {
      const owner = ownerLift.get(key);
      if (owner && isLiftable(shadow)) lift(shadow, owner.px, owner.row);
    }
  };
  scene.events.on("postupdate", apply);
  scene.events.on("render", restore);
  const detach = () => {
    restore();
    scene.events.off("postupdate", apply);
    scene.events.off("render", restore);
  };
  scene.events.once("shutdown", detach);
  scene.events.once("destroy", detach);
}
