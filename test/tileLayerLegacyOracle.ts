// Frozen tile pipeline from origin/main at task start. Do not optimize: differential oracle.
import { mapTileSize } from "@/project/tileGeometry";

import { chipsetAnimationKey } from "@/assets/bundled";
import {
  supportsChipsetQuarterComposition,
  tilesetAnimationKeyForTile,
  tilesetTextureKey,
} from "@/editor/tilesetImage";
import { tileBackingTile } from "@/editor/tileLayerPolicy";
import {
  MAP_BACKGROUND_LAYER_DEPTH,
  OVERLAY_LAYER_DEPTH_OFFSET,
  SHADOW_LAYER_DEPTH_OFFSET,
} from "@/player/characterDepth";
import { isPanoramaWindowTile } from "@/project/defaults/chipsetMapping";
import { animationKeyForTile } from "@/project/defaults/chipsetAnimation";
import {
  isLakeAutotileTile,
  lakeAutotileQuarterSources,
  type LakeAutotileQuarter,
} from "@/project/defaults/lakeAutotile";
import {
  chipsetQuarterComposition,
  type ChipsetQuarterComposition,
} from "@/project/defaults/terrainQuarterAutotile";
import { withWorldCoastRenderPass } from "@/project/defaults/worldCoastMapping";

import { tileStackAt, topTileInStack } from "@/project/mapOverlayTiles";
import { layerTileAt, shadowAt } from "@/project/mapLayers";

import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";

import { isAlwaysAboveCharacterUpperTile, mapUpperTileDepth } from "@/player/characterDepth";
// ★ 수관은 upperTileLayer(고정 250k). 솔리드 가구(×)는 root display list + y-sort.
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";

import { renderFarmOverlays } from "@/player/playSceneFarming";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";

import { resetCullableTiles, trackCullableTile } from "@/player/playSceneTileCulling";
import { bumpPerfCounter, type RuntimePerfCounters } from "@/player/runtimePerfCounters";

interface RenderedTileImage {
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
  destroy?(removeFromDisplayList?: boolean): void;
  /** 화면 밖 컬링용. Phaser GameObject 는 모두 갖지만 테스트 스텁은 생략한다. */
  visible?: boolean;
  setVisible?(value: boolean): unknown;
}

/** root display list 에 올린 솔리드 upper 가구 — container removeAll 대상이 아니라 직접 destroy. */
const rootYSortTiles = new WeakMap<object, RenderedTileImage[]>();

/**
 * 마지막으로 타일 계층을 그린 입력의 서명. 같으면 renderTiles 는 타일을 다시 만들지 않고
 * 이벤트 계층만 다시 그린다.
 *
 * 왜: refreshRuntimeSurfaces 가 인터프리터 스텝마다 renderTiles 를 부른다. 30×30 맵도 한 번에
 * 타일 GameObject 1,824 개, 100×100 이면 1~2만 개를 파괴·재생성했다(실측 15.9~26ms/호출).
 * 대화 한 번에 6번, 100ms 병렬 이벤트가 있으면 초당 8번이었다 — 프레임이 통째로 빠지고
 * 화면이 멈칫한다. 타일이 실제로 바뀐 스텝(changeTile·맵 이동·밭 갈이)만 다시 그리면 된다.
 *
 * 서명은 renderTiles 가 읽는 **모든** 입력을 담는다: 맵 객체·타일셋·텍스처 키(정체성),
 * 하/상층 타일 배열(내용 해시 — applyMapOverrides 가 제자리에서 바꾼다), 밭·설치물·공간
 * 배치(JSON), 작물 자료(정체성). tileStackAt 은 현재 빈 스택만 돌려주므로 입력이 아니다.
 */
interface TileLayerSignature {
  readonly map: object;
  readonly tileset: object | undefined;
  readonly textureKey: string;
  readonly tilesHash: number;
  readonly overlays: string;
  readonly crops: unknown;
}

const tileLayerSignatures = new WeakMap<object, TileLayerSignature>();

interface RenderedEventSprite extends RenderedTileImage {
  readonly y: number;
  readonly active?: boolean;
  readonly alpha?: number;
  readonly blendMode?: number | string;
  readonly isTinted?: boolean;
  readonly flipX?: boolean;
  readonly flipY?: boolean;
  readonly rotation?: number;
  readonly texture?: { readonly key: string };
  readonly anims?: { readonly isPlaying: boolean };
  readonly width?: number;
  readonly height?: number;
  play(key: string): this;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  setScale(value: number): void;
  destroy(): void;
}

interface RenderTilesSceneContext<
  TImage extends RenderedTileImage,
  TSprite extends RenderedEventSprite,
> {
  readonly map: PlaySceneContext["map"];
  readonly session: PlaySceneContext["session"];
  readonly eventPositions: PlaySceneContext["eventPositions"];
  readonly tileLayer: {
    removeAll(removeChildren?: boolean): void;
    add(image: TImage | TSprite | unknown): unknown;
  };
  /**
   * ★ 수관 등 always-above upper 전용. 솔리드 가구(×)는 root에 y-sort 로 올린다.
   * 없으면 tileLayer 로 폴백(레거시 테스트).
   */
  readonly upperTileLayer?: {
    removeAll(removeChildren?: boolean): void;
    add(image: TImage | TSprite | unknown): unknown;
  };
  /** optional host identity for WeakMap tracking of root y-sort tiles */
  readonly sceneHost?: object;
  /** 재생성 계수기(선택). 최소 컨텍스트 테스트 스텁은 생략한다. */
  readonly perfCounters?: RuntimePerfCounters;
  /** 체공 그림자 풀. 이벤트 스프라이트를 파괴할 때 같이 비워야 고아 그림자가 남지 않는다. */
  characterShadows?: Map<string, import("@/player/characterShadow").ShadowImage>;
  readonly eventSprites: {
    values(): IterableIterator<TSprite>;
    entries(): IterableIterator<[string, TSprite]>;
    get(eventId: string): TSprite | undefined;
    delete(eventId: string): boolean;
    clear(): void;
    set(eventId: string, marker: TSprite): unknown;
  };
  readonly textures?: { get?(key: string): unknown };
  readonly children?: { list: unknown[]; queueDepthSort(): void };
  readonly tweens?: { getTweens?(): readonly TweenTargetSource[] };
  readonly eventGraphicPatternOverrides?: Map<string, number>;
  /** 걷는 중인 NPC 의 보간 위치를 알기 위한 무버 풀(선택). */
  readonly autonomousNPCs?: { get(eventId: string): AutonomousMover | undefined };
  readonly runtimeDom: Pick<
    PlaySceneContext["runtimeDom"],
    "clearEventMarkers" | "upsertEventMarker" | "syncMissingResourceError"
  >;
  readonly missingResources: Set<string>;
  readonly add: {
    image(x: number, y: number, texture: string, frame?: string | number): TImage;
    sprite(x: number, y: number, texture: string, frame?: string | number): TSprite;
    rectangle?(x: number, y: number, width: number, height: number, fillColor?: number, fillAlpha?: number): RenderedTileImage;
    text?(x: number, y: number, text: string, style?: Record<string, string>): RenderedTileImage;
  };
  readonly resolveTilesetTexture?: (tileset: TilesetDef) => string;
  runEvent(eventId: string): Promise<void>;
  syncRuntimeState(): void;
}

export function legacyRenderTiles<
  TImage extends RenderedTileImage,
  TSprite extends RenderedEventSprite,
>(scene: RenderTilesSceneContext<TImage, TSprite>): void {
  const host = rootYSortHost(scene);
  const signature = tileLayerSignature(scene);
  const previous = tileLayerSignatures.get(host);
  if (previous && sameTileLayerSignature(previous, signature)) {
    // 타일 입력이 그대로다 — 이벤트 계층만 다시 그린다(페이지 조건·위치·그래픽 변화는 여기 있다).
    bumpPerfCounter(scene, "tileRebuildsSkipped");
    return;
    return;
  }
  tileLayerSignatures.set(host, signature);
  bumpPerfCounter(scene, "tileRebuilds");
  scene.tileLayer.removeAll(true);
  scene.upperTileLayer?.removeAll(true);
  clearRootYSortTiles(scene);
  resetCullableTiles(host);
  const map = scene.map;
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) {
    return;
    return;
  }
  // 칸 판정(해안 그룹)의 내용 비교를 이 동기 그리기 동안 타일셋마다 한 번만 한다.
  withWorldCoastRenderPass(() => {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const index = y * map.width + x;
        renderEmptyCellCover(scene, x, y, index);
        renderTile(scene, tileset, x, y, map.lowerTiles[index], "lower");
        for (const tile of tileStackAt(map, "lower", index)) renderTile(scene, tileset, x, y, tile, "lower");
        renderRawTile(scene, tileset, x, y, layerTileAt(map, 2, index), "lower", OVERLAY_LAYER_DEPTH_OFFSET);
        renderShadow(scene, x, y, shadowAt(map, index));
        renderTile(scene, tileset, x, y, map.upperTiles[index], "upper");
        for (const tile of tileStackAt(map, "upper", index)) renderTile(scene, tileset, x, y, tile, "upper");
        renderRawTile(scene, tileset, x, y, layerTileAt(map, 4, index), "upper", OVERLAY_LAYER_DEPTH_OFFSET);
      }
    }
  });
  renderFarmOverlays(scene, store.getCurrent().database.crops ?? []);
  renderPlaceableOverlays(scene);

}

function tileLayerSignature<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
): TileLayerSignature {
  const project = store.getCurrent();
  const map = scene.map;
  const tileset = project.tilesets[map.tilesetId];
  const session = scene.session;
  return {
    map,
    tileset,
    textureKey: tileset ? scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset) : "",
    tilesHash: hashTiles(
      map.width,
      map.height,
      map.lowerTiles,
      map.upperTiles,
      map.lowerOverlayTiles ?? [],
      map.upperOverlayTiles ?? [],
      map.shadowBits ?? [],
    ),
    overlays: JSON.stringify([
      session.farmPlots?.[map.id] ?? null,
      session.placeables ?? null,
      session.farmBuildingPlacements ?? null,
      session.homeDecorationPlacements ?? null,
    ]),
    crops: project.database.crops,
  };
}

function sameTileLayerSignature(left: TileLayerSignature, right: TileLayerSignature): boolean {
  return (
    left.map === right.map
    && left.tileset === right.tileset
    && left.textureKey === right.textureKey
    && left.tilesHash === right.tilesHash
    && left.overlays === right.overlays
    && left.crops === right.crops
  );
}

function hashTiles(width: number, height: number, ...layers: readonly (readonly number[])[]): number {
  let hash = 0x811c9dc5;
  const mix = (value: number): void => {
    hash ^= value & 0xffff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= value >>> 16;
    hash = Math.imul(hash, 0x01000193);
  };
  mix(width);
  mix(height);
  for (const layer of layers) {
    mix(layer.length);
    for (let index = 0; index < layer.length; index += 1) mix(layer[index] ?? -1);
  }
  return hash >>> 0;
}

function tileTargetLayer<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  layer: "lower" | "upper",
  alwaysAboveCharacter = false,
): { add(image: TImage | TSprite | unknown): unknown } {
  // ★ 수관만 고정 upper 컨테이너. 솔리드 upper 가구는 root(y-sort) — container 자식 depth 가 무시된다.
  if (layer === "upper" && alwaysAboveCharacter && scene.upperTileLayer) return scene.upperTileLayer;
  return scene.tileLayer;
}

function applyTileDepth(
  tileSize: number,
  image: RenderedTileImage,
  tileset: TilesetDef,
  tile: number,
  y: number,
  layer: "lower" | "upper",
  depthOffset = 0,
): void {
  if (layer !== "upper") {
    // lower 컨테이너 안 정렬: 같은 셀 스택 순서를 안정화.
    image.setDepth(y * 2 + depthOffset);
    return;
  }
  image.setDepth(mapUpperTileDepth(tileset, tile, y, tileSize) + depthOffset);
}

function rootYSortHost<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
): object {
  return scene.sceneHost ?? scene;
}

function clearRootYSortTiles<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
): void {
  const host = rootYSortHost(scene);
  const tiles = rootYSortTiles.get(host);
  if (!tiles) return;
  for (const tile of tiles) tile.destroy?.(true);
  rootYSortTiles.delete(host);
}

function trackRootYSortTile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  image: TImage,
): void {
  const host = rootYSortHost(scene);
  const tiles = rootYSortTiles.get(host) ?? [];
  tiles.push(image);
  rootYSortTiles.set(host, tiles);
}

function placeMapTileImage<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  image: TImage,
  tileset: TilesetDef,
  tile: number,
  x: number,
  y: number,
  layer: "lower" | "upper",
  depthOffset = 0,
): void {
  const alwaysAbove = layer === "upper" && isAlwaysAboveCharacterUpperTile(tileset, tile);
  bumpPerfCounter(scene, "tileObjectsCreated");
  image.setOrigin(0, 0);
  applyTileDepth(mapTileSize(scene.map), image, tileset, tile, y, layer, depthOffset);
  // 화면 밖 타일은 카메라가 타일 경계를 넘을 때 숨긴다(playSceneTileCulling 주석 참고).
  trackCullableTile(rootYSortHost(scene), image, x, y);
  if (layer === "upper" && !alwaysAbove) {
    // root display list — same-priority 캐릭터와 y-sort.
    trackRootYSortTile(scene, image);
    return;
  }
  tileTargetLayer(scene, layer, alwaysAbove).add(image);
}

function renderEmptyCellCover<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  x: number,
  y: number,
  index: number,
): void {
  const map = scene.map;
  // 하층이 비어 있는가? 배열 뚜기(stack)에 타일이 있으면 채워진 것이다.
  const lower = topTileInStack(map, "lower", index) ?? map.lowerTiles[index];
  if (lower >= 0) return;
  // 창 타일이 있으면 가리지 않는다 — 그가 파노라마를 보이는 법이다.
  // 상위 레이어에 놓여도(정책상 홈이 upper), 하층이 비어 있다면 같은 결과가 나야 한다.
  const upper = topTileInStack(map, "upper", index) ?? map.upperTiles[index];
  if (isPanoramaWindowTile(lower) || isPanoramaWindowTile(upper)) return;
  // 저작자가 「빈 칸에도 배경」 을 켰다 — 창 타일이 없는 칩셋(숲마을·기후 시트)은 이 길뿐이다.
  if (map.background?.showInEmptyCells === true && (map.background.imageId || map.background.layers?.length)) return;
  const size = mapTileSize(map);
  if (typeof scene.add.rectangle !== "function") return;
  const cover = scene.add.rectangle(x * size, y * size, size, size, 0x000000);
  cover.setOrigin(0, 0);
  // 배경(-100k) 위, 하층 타일(0) 아래. 이 범위 안에서만 가린다.
  cover.setDepth(MAP_BACKGROUND_LAYER_DEPTH + 1);
  scene.tileLayer.add(cover);
  trackCullableTile(rootYSortHost(scene), cover, x, y);
}

function renderTile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number,
  layer: "lower" | "upper",
): void {
  if (tile < 0) return;
  const textureKey = scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset);
  // 호수 쿼터 렌더 — 물 블록 배치가 동일한 실내 타일 그림판도 포함.
  if (supportsChipsetQuarterComposition(tileset) && isLakeAutotileTile(tile, tileset)) {
    renderLakeAutotile(scene, tileset, textureKey, x, y, layer);
    return;
  }
  if (layer === "lower" && supportsChipsetQuarterComposition(tileset)) {
    const composition = chipsetQuarterComposition(scene.map, tileset, x, y);
    if (composition) {
      renderTerrainQuarter(scene, tileset, textureKey, x, y, composition, layer);
      return;
    }
  }
  // lower 투명 칩: 정책이 정한 받침을 먼저 깔아 투명 픽셀이 검게 보이지 않게 한다.
  // 받침은 정책(tileLayerPolicy)이 정한다 — 합본 마을 밑동뿐 아니라 혼합 칩셋(위 반쪽 밑동·숲 나무 띠)과
  // 사용자가 받침을 확정한 커스텀 칩셋도 같은 답을 받는다. 규칙이 없으면 null 이라 그 밖은 전과 같다.
  const backingTile = layer === "lower" ? tileBackingTile(tileset, tile) : null;
  if (backingTile !== null) {
    const backing = scene.add.image(x * mapTileSize(scene.map), y * mapTileSize(scene.map), textureKey, `tile_${backingTile}`);
    placeMapTileImage(scene, backing, tileset, backingTile, x, y, layer);
  }
  renderRawTile(scene, tileset, x, y, tile, layer, 0);
}

function renderRawTile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number,
  layer: "lower" | "upper",
  depthOffset: number,
): void {
  if (tile < 0) return;
  const textureKey = scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset);
  const baseAnimationKey = tilesetAnimationKeyForTile(tileset, tile);
  const animationKey = baseAnimationKey ? chipsetAnimationKey(textureKey, baseAnimationKey) : null;
  const size = mapTileSize(scene.map);
  const image = animationKey
    ? scene.add.sprite(x * size, y * size, textureKey, `tile_${tile}`).play(animationKey)
    : scene.add.image(x * size, y * size, textureKey, `tile_${tile}`);
  placeMapTileImage(scene, image, tileset, tile, x, y, layer, depthOffset);
}

function renderShadow<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  x: number,
  y: number,
  bits: number,
): void {
  if (bits === 0 || typeof scene.add.rectangle !== "function") return;
  const size = mapTileSize(scene.map);
  const half = size / 2;
  for (let quarter = 0; quarter < 4; quarter += 1) {
    if (!(bits & (1 << quarter))) continue;
    const rect = scene.add.rectangle(x * size + (quarter % 2) * half, y * size + Math.floor(quarter / 2) * half, half, half, 0x000000, 0.5);
    rect.setOrigin(0, 0);
    rect.setDepth(y * 2 + SHADOW_LAYER_DEPTH_OFFSET);
    scene.tileLayer.add(rect);
    trackCullableTile(rootYSortHost(scene), rect, x, y);
  }
}

function renderLakeAutotile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  textureKey: string,
  x: number,
  y: number,
  layer: "lower" | "upper",
): void {
  for (const part of lakeAutotileQuarterSources(scene.map, x, y, tileset)) {
    const animationKey = quarterAnimationKey(textureKey, part.tile, part.quarter);
    const frameName = quarterFrameName(part.tile, part.quarter);
    const image = animationKey
      ? scene.add.sprite(x * mapTileSize(scene.map) + part.offsetX, y * mapTileSize(scene.map) + part.offsetY, textureKey, frameName).play(animationKey)
      : scene.add.image(x * mapTileSize(scene.map) + part.offsetX, y * mapTileSize(scene.map) + part.offsetY, textureKey, frameName);
    // 쿼터 소스는 맵 셀 좌표 기준 depth 를 공유한다.
    placeMapTileImage(scene, image, tileset, part.tile, x, y, layer);
  }
}

function renderTerrainQuarter<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  textureKey: string,
  x: number,
  y: number,
  composition: ChipsetQuarterComposition,
  layer: "lower" | "upper",
): void {
  if (composition.underlayTile !== undefined) {
    const underlay = scene.add.image(x * mapTileSize(scene.map), y * mapTileSize(scene.map), textureKey, `tile_${composition.underlayTile}`);
    placeMapTileImage(scene, underlay, tileset, composition.underlayTile, x, y, layer);
  }
  for (const part of composition.sources) {
    const image = scene.add.image(
      x * mapTileSize(scene.map) + part.offsetX,
      y * mapTileSize(scene.map) + part.offsetY,
      textureKey,
      `tile_${part.tile}_${part.quarter}`
    );
    placeMapTileImage(scene, image, tileset, part.tile, x, y, layer);
  }
}

function quarterFrameName(tile: number, quarter: LakeAutotileQuarter): string {
  return `tile_${tile}_${quarter}`;
}

function quarterAnimationKey(textureKey: string, tile: number, quarter: LakeAutotileQuarter): string | null {
  const animationKey = animationKeyForTile(tile);
  return animationKey ? chipsetAnimationKey(textureKey, `${animationKey}_${quarter}`) : null;
}
interface TweenTargetSource { readonly targets?: readonly object[] | null; readonly data?: readonly unknown[] | null; }
