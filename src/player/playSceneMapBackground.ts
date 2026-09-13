import type Phaser from "phaser";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { MAP_BACKGROUND_LAYER_DEPTH } from "@/player/characterDepth";
import { ensureSceneImageTexture } from "@/player/playSceneImageTexture";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";

/**
 * 맵 배경(패럴랙스) 레이어 — RM2K3 「배경」 탭의 `map.background`.
 *
 * 계약 넷:
 * 1. **하층 타일 아래**다({@link MAP_BACKGROUND_LAYER_DEPTH}). 비어 있는 칸이 뚫린 창이고,
 *    타일이 깔린 칸은 배경을 가린다 — 「절벽 뒤로 먼 풍경이 보인다」가 이 순서에서 나온다.
 * 2. **화면 고정**이다. 카메라를 따라 흐르지 않고 자기 속도로만 움직인다(RM2K3 배경에는
 *    「맵에 맞춰 스크롤」 플래그가 없다). 그래서 `scrollFactor 0`.
 * 3. 스크롤 속도 단위는 **논리 프레임당 px** 다 — 60Hz 기준이라 `scrollX 2` 는 초당 120px.
 * 4. 그림은 무한 반복이다. 640×480 파노라마가 320×240 뷰포트를 타일처럼 덮는다.
 *
 * 존재하는 RM2K3 저작 필드를 그대로 쓴다: `imageId`(리소스 id 또는 URL), `scrollX`, `scrollY`.
 */

/** RM2K3 스크롤 속도는 프레임당 px — 논리 프레임은 60Hz 다(`playSceneMovement`). */
export const BACKGROUND_FRAMES_PER_SECOND = 60;
const TEXTURE_PREFIX = "__rpg_zzu_map_background_";

export type MapBackgroundLayout = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * `scrollFactor 0` 객체가 어떤 줌에서도 뷰포트를 **정확히** 덮는 배치.
 *
 * 유도: Phaser 는 화면 고정 객체를 `screen(p) = (p - halfSize)·zoom + halfSize` 로 그린다
 * (반폭 `halfSize`, 원점이 객체 좌상단). 좌상단이 화면 0 이려면 `x = halfSize·(1 - 1/zoom)`,
 * 뷰포트를 다 덮으려면 크기가 `뷰포트 / zoom` 이어야 한다. 이 보정이 없으면 배경은 배율이
 * 1 이 아닐 때 화면 한가운데만 덮고 가장자리에 맵 배경색이 드러난다.
 */
export function mapBackgroundLayout(camera: {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}): MapBackgroundLayout {
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const width = camera.width || PLAY_RESOLUTION.width;
  const height = camera.height || PLAY_RESOLUTION.height;
  return {
    x: (width / 2) * (1 - 1 / zoom),
    y: (height / 2) * (1 - 1 / zoom),
    width: Math.ceil(width / zoom),
    height: Math.ceil(height / zoom),
  };
}

/** 이번 프레임의 스크롤 진행. `speed` 는 프레임당 px 이므로 초당 `speed × 60` px 다. */
export function advanceMapBackgroundScroll(position: number, speed: number, deltaMs: number): number {
  if (!Number.isFinite(speed) || speed === 0 || !Number.isFinite(position)) return position;
  return position + speed * (Math.max(0, deltaMs) / 1000) * BACKGROUND_FRAMES_PER_SECOND;
}

export function mapBackgroundTextureKey(imageId: string): string {
  return `${TEXTURE_PREFIX}${imageId.replace(/[^a-z0-9_-]/gi, "_")}`;
}

/**
 * 지금 이 맵에 그릴 배경 그림 id. 이벤트 명령 「먼 배경 변경」(m2-069)이 그 맵에 대해 기록돼
 * 있으면 그쪽이 이긴다 — 명령은 세션이 아니라 **맵의** 배경을 바꾼다.
 *
 * `mapId` 가 빈 기록(이 명령이 맵을 적기 전에 저장된 세이브)은 모든 맵에 적용한다. 값을 못
 * 읽어 배경이 통째로 사라지는 것보다 낫다.
 */
export function resolveMapBackgroundImageId(scene: Pick<PlaySceneContext, "map" | "session">): string {
  const override = scene.session?.m2Runtime?.map?.["parallax_override"];
  const overrideId = (override?.value ?? "").trim();
  const overrideMapId = (override?.mapId ?? "").trim();
  if (overrideId && (overrideMapId === "" || overrideMapId === scene.map?.id)) return overrideId;
  return (scene.map?.background?.imageId ?? "").trim();
}

/**
 * 현재 맵의 배경을 레이어에 반영한다. 맵을 실을 때(`loadMap`)마다 부르고, 그림이 아직
 * 안 실렸으면 로드를 걸어 두었다가 완료되면 그때 붙인다. 배경 저작이 없으면 감춘다.
 */
export function syncMapBackgroundLayer(scene: PlaySceneContext): void {
  const layer = scene.mapBackgroundLayer;
  const imageId = resolveMapBackgroundImageId(scene);
  if (!imageId) {
    layer?.setVisible(false);
    scene.mapBackgroundAppliedId = "";
    scene.mapBackgroundPendingId = undefined;
    return;
  }
  if (layer && scene.mapBackgroundAppliedId === imageId) {
    layoutMapBackground(scene, layer);
    return;
  }
  const textureKey = mapBackgroundTextureKey(imageId);
  // 이미 실린 그림(맵을 오갈 때 흔하다)은 약속을 거치지 않고 그 자리에서 붙인다.
  if (scene.textures.exists(textureKey)) {
    applyMapBackgroundTexture(scene, textureKey, imageId);
    return;
  }
  const url = resolveAssetResourceUrl(imageId, { project: store.getCurrent() });
  if (!url) {
    // 저작 경고다 — 배경 그림 id 는 로드 게이트의 리소스 검사 대상이 아니다.
    console.warn(`[player] map background not found: ${imageId}`);
    layer?.setVisible(false);
    // 실패도 «정착» 이다 — 정착으로 적지 않으면 매 프레임 다시 시도한다.
    scene.mapBackgroundAppliedId = imageId;
    scene.mapBackgroundPendingId = undefined;
    return;
  }
  // 같은 그림의 로드가 이미 떠 있으면 다시 걸지 않는다(같은 키를 두 번 큐에 넣으면 로더가 거부한다).
  if (scene.mapBackgroundPendingId === imageId) return;
  const requestedMap = scene.map;
  const token = (scene.mapBackgroundToken ?? 0) + 1;
  scene.mapBackgroundToken = token;
  scene.mapBackgroundPendingId = imageId;
  void ensureSceneImageTexture(scene, textureKey, url).then((key) => {
    // 그사이 맵이 바뀌었거나 배경이 교체됐으면 이 결과는 버린다.
    if (scene.mapBackgroundToken !== token || scene.map !== requestedMap) return;
    scene.mapBackgroundPendingId = undefined;
    if (!key) {
      scene.mapBackgroundAppliedId = imageId;
      layer?.setVisible(false);
      return;
    }
    applyMapBackgroundTexture(scene, key, imageId);
  });
}

function applyMapBackgroundTexture(scene: PlaySceneContext, textureKey: string, imageId: string): void {
  const target = scene.mapBackgroundLayer ?? createMapBackgroundLayer(scene, textureKey);
  if (scene.mapBackgroundLayer) target.setTexture(textureKey);
  scene.mapBackgroundLayer = target;
  scene.mapBackgroundAppliedId = imageId;
  // 그림이 바뀌면 스크롤 위상도 처음부터다 — 이전 배경의 오프셋을 물려받으면
  // 같은 저작인데 맵을 다시 실을 때마다 화면이 달라진다.
  target.setTilePosition(0, 0);
  layoutMapBackground(scene, target);
}

/** 매 프레임: 배경 해석이 바뀌었으면 다시 걸고, 화면 고정 배치를 맞추고, 속도만큼 민다. */
export function updateMapBackground(scene: PlaySceneContext, deltaMs: number): void {
  // 이벤트 명령 「먼 배경 변경」 은 맵을 다시 싣지 않고 배경을 바꾼다 — 해석 결과가 달라지면
  // 그 자리에서 다시 건다. 진행 중·실패로 정착한 id 는 여기서 걸리지 않으므로 매 프레임 재시도가 없다.
  const imageId = resolveMapBackgroundImageId(scene);
  if (imageId !== scene.mapBackgroundAppliedId && imageId !== scene.mapBackgroundPendingId) {
    syncMapBackgroundLayer(scene);
  }
  const layer = scene.mapBackgroundLayer;
  if (!layer || !layer.visible) return;
  const background = scene.map?.background;
  if (!background) return;
  layoutMapBackground(scene, layer);
  layer.tilePositionX = advanceMapBackgroundScroll(layer.tilePositionX, background.scrollX ?? 0, deltaMs);
  layer.tilePositionY = advanceMapBackgroundScroll(layer.tilePositionY, background.scrollY ?? 0, deltaMs);
}

function createMapBackgroundLayer(scene: PlaySceneContext, textureKey: string): Phaser.GameObjects.TileSprite {
  const layer = scene.add.tileSprite(0, 0, PLAY_RESOLUTION.width, PLAY_RESOLUTION.height, textureKey);
  layer.setOrigin(0, 0);
  layer.setScrollFactor(0);
  layer.setDepth(MAP_BACKGROUND_LAYER_DEPTH);
  return layer;
}

function layoutMapBackground(scene: PlaySceneContext, layer: Phaser.GameObjects.TileSprite): void {
  const layout = mapBackgroundLayout(scene.cameras.main);
  // setSize 는 내부 채움 텍스처를 다시 그린다 — 배율·뷰포트가 실제로 바뀔 때만 부른다.
  if (layer.width !== layout.width || layer.height !== layout.height) {
    layer.setSize(layout.width, layout.height);
  }
  layer.setPosition(layout.x, layout.y);
  layer.setVisible(true);
}
