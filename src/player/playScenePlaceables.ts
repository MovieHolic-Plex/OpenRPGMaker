import { mapTileSize } from "@/project/tileGeometry";
/**
 * 세션 설치물(바위·나무 등) 오버레이 렌더.
 *
 * 설치물은 맵 타일이 아니라 세션 상태다(`session.placeables`) — 캐면 사라져야 하므로
 * `lowerTiles` 에 새길 수 없다. 그런데 렌더 경로가 없어서 **곡괭이로 캘 수는 있지만 화면에는
 * 아무것도 없는** 상태였다. 밭 오버레이(`renderFarmOverlays`)는 `farmPlots` 가 있는 맵에서만
 * 도므로 광산처럼 밭이 없는 맵은 그 경로로 그려지지 않는다.
 *
 * 그래픽이 없는 종류는 **그리지 않는다.** 상자(`kind: "chest"`)는 이미 이벤트로 저작하는
 * 관행이라, 여기서 회색 사각형을 얹으면 기존 프로젝트에 유령 상자가 겹쳐 보인다.
 *
 * 나무(`kind: "tree"`)는 기본 합본 마을 칩셋의 `TILE.TREE`(290) — 실측 한 칸 작은 나무 그림 —
 * 을 쓴다. 바위/보석 캐릭셋 마커로 대체하지 않는다.
 */
import { characterDepth, characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { resolveEventSpriteTexture, resolveSpatialGraphicTexture } from "@/player/eventSpriteResources";
import { resolvePlaceableOverlayGraphic } from "@/player/placeableOverlayGraphics";
import { resolveForageAt } from "@/project/seasonalForage";
import type { GameTime } from "@/project/gameTime";
import type { PlaceableObjectState } from "@/project/placeables";
import { isSpatialFootprint, orientedFootprint } from "@/project/spatialPlacements";
import { store } from "@/project/store";
import type { FarmBuildingPlacement, HomeDecorationPlacement, Project, SpatialFootprint } from "@/project/types";

export {
  PLACEABLE_OVERLAY_TEXTURE_KEYS,
  PLACEABLE_TREE_GRAPHIC,
  resolvePlaceableOverlayGraphic,
} from "@/player/placeableOverlayGraphics";

type OverlayGameObject = {
  setOrigin?(x: number, y: number): void;
  setDepth?(depth: number): void;
  setDisplaySize?(width: number, height: number): void;
};

// 스텁 씬으로도 돌아가야 하므로 새 멤버는 전부 optional 이고, 없으면 조기 이탈한다.
type PlaceableOverlayScene = {
  readonly map: { readonly tileSize?: number; readonly id: string; readonly width?: number; readonly height?: number };
  readonly session: {
    readonly gameTime?: GameTime;
    readonly placeables?: Record<string, PlaceableObjectState>;
    readonly farmBuildingPlacements?: Record<string, FarmBuildingPlacement>;
    readonly homeDecorationPlacements?: Record<string, HomeDecorationPlacement>;
  };
  readonly missingResources?: Set<string>;
  readonly tileLayer: { add(object: unknown): unknown };
  readonly add: {
    sprite?: (x: number, y: number, texture: string, frame?: string | number) => OverlayGameObject;
  };
};

export function renderPlaceableOverlays(scene: PlaceableOverlayScene): void {
  if (typeof scene.add.sprite !== "function") return;
  const project = store.getCurrent();
  renderSpatialPlacements(scene, project);
  syncForageWarnings(scene);
  for (const placeable of Object.values(scene.session.placeables ?? {})) {
    if (placeable.mapId !== scene.map.id) continue;
    if (isOutsideMap(scene.map, placeable.x, placeable.y)) continue;
    const generated = Boolean(placeable.forageSpawn);
    if (generated) {
      const target = resolveForageAt(project, scene.session, placeable.mapId, placeable.x, placeable.y);
      if (!target.ok && (target.reason === "expired" || target.reason === "disabled")) continue;
    }
    // Forage entries have no authored graphic field: use a bundled pickup marker.
    const graphic = resolvePlaceableOverlayGraphic(generated ? "gem" : placeable.kind);
    if (!graphic) continue;
    const resolved =
      typeof graphic.frame === "number"
        ? resolveEventSpriteTexture(project, graphic.texture, graphic.frame)
        : null;
    const worldY = characterSpriteY(placeable.y, mapTileSize(scene.map));
    const sprite = scene.add.sprite(
      characterSpriteX(placeable.x, mapTileSize(scene.map)),
      worldY,
      resolved?.texture ?? graphic.texture,
      resolved?.frame ?? graphic.frame
    );
    // 캐릭터와 같은 정렬·깊이 규칙 — 플레이어가 바위/나무 앞뒤로 자연스럽게 지나간다.
    sprite.setOrigin?.(0.5, 1);
    sprite.setDepth?.(characterDepth("same", worldY));
    scene.tileLayer.add(sprite);
  }
}

/** Event-only rebuilds clear the shared warning set, but keep the tile overlays. */
export function syncForageWarnings(scene: Pick<PlaceableOverlayScene, "map" | "session" | "missingResources">): void {
  const project = store.getCurrent();
  for (const object of Object.values(scene.session.placeables ?? {})) {
    if (!object.forageSpawn || object.mapId !== scene.map.id || isOutsideMap(scene.map, object.x, object.y)) continue;
    const target = resolveForageAt(project, scene.session, object.mapId, object.x, object.y);
    if (!target.ok && (target.reason === "stale" || target.reason === "missing")) {
      scene.missingResources?.add(`forage:${object.forageSpawn.areaId}/${object.forageSpawn.entryId}`);
    }
  }
}

type SpatialSpriteSpec = {
  readonly placement: FarmBuildingPlacement | HomeDecorationPlacement;
  readonly footprint: SpatialFootprint;
  readonly resourceId: string;
};

function renderSpatialPlacements(scene: PlaceableOverlayScene, project: Project): void {
  for (const placement of Object.values(scene.session.farmBuildingPlacements ?? {})) {
    const type = project.database.farmBuildingTypes?.find((entry) => entry.id === placement.typeId);
    const level = type?.levels.find((entry) => entry.level === placement.level);
    if (placement.mapId !== scene.map.id || !level || !isSpatialFootprint(level.footprint)) continue;
    addSpatialSprite(scene, project, {
      placement, footprint: level.footprint,
      resourceId: level.orientationGraphicResourceIds?.[placement.orientation] ?? level.graphicResourceId,
    });
  }
  for (const placement of Object.values(scene.session.homeDecorationPlacements ?? {})) {
    const type = project.database.homeDecorationTypes?.find((entry) => entry.id === placement.typeId);
    if (placement.mapId !== scene.map.id || !type || !isSpatialFootprint(type.footprint)) continue;
    addSpatialSprite(scene, project, {
      placement, footprint: type.footprint,
      resourceId: type.orientationGraphicResourceIds?.[placement.orientation] ?? type.graphicResourceId,
    });
  }
}

function addSpatialSprite(scene: PlaceableOverlayScene, project: Project, spec: SpatialSpriteSpec): void {
  const { placement, footprint, resourceId } = spec;
  const size = orientedFootprint(footprint, placement.orientation);
  if (placement.x < 0 || placement.y < 0
    || (scene.map.width !== undefined && placement.x + size.width > scene.map.width)
    || (scene.map.height !== undefined && placement.y + size.height > scene.map.height)) return;
  const resolved = resolveSpatialGraphicTexture(project, resourceId);
  const sprite = scene.add.sprite?.(
    (placement.x + size.width / 2) * mapTileSize(scene.map),
    (placement.y + size.height) * mapTileSize(scene.map),
    resolved?.texture ?? resourceId,
    resolved?.frame,
  );
  if (!sprite) return;
  sprite.setOrigin?.(0.5, 1);
  sprite.setDisplaySize?.(size.width * mapTileSize(scene.map), size.height * mapTileSize(scene.map));
  sprite.setDepth?.(characterDepth("same", (placement.y + size.height) * mapTileSize(scene.map)));
  scene.tileLayer.add(sprite);
}

function isOutsideMap(map: PlaceableOverlayScene["map"], x: number, y: number): boolean {
  if (x < 0 || y < 0) return true;
  if (map.width !== undefined && x >= map.width) return true;
  return map.height !== undefined && y >= map.height;
}
