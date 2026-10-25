import type { GameMap, Project, TilesetDef } from "@/project/types";

/** Shared authored visual projection. Dialogue and record metadata are text evidence. */
export function mapVisualContent(map: GameMap) {
  return { width: map.width, height: map.height, tileSize: map.tileSize, tilesetId: map.tilesetId,
    lowerTiles: map.lowerTiles, upperTiles: map.upperTiles,
    ...(map.relief ? { relief: map.relief } : {}),
    lowerTileStacks: map.lowerTileStacks, upperTileStacks: map.upperTileStacks,
    // MZ 2·4층·그림자도 그려지는 칸이다 — 있을 때만 싣는다(옛 맵의 투영·비교 문자열은 그대로).
    ...(map.lowerOverlayTiles ? { lowerOverlayTiles: map.lowerOverlayTiles } : {}),
    ...(map.upperOverlayTiles ? { upperOverlayTiles: map.upperOverlayTiles } : {}),
    ...(map.shadowBits ? { shadowBits: map.shadowBits } : {}),
    background: map.background,
    events: map.events.map(event => ({ id: event.id, x: event.x, y: event.y, sprite: event.sprite,
      pages: event.pages?.map(page => ({ graphic: page.graphic, priority: page.priority, footprint: page.footprint })) })) };
}

/**
 * Inputs consumed by show_map_region / toolImageRenderer for a tileset atlas.
 * tileSize + tilesPerRow select source rects; image + grafts (+ uploaded bytes) feed tilesetImageUrl.
 * Name, passability, terrain, kind, and other authored metadata stay out of this projection.
 */
export function tilesetVisualContent(tileset: TilesetDef | undefined, assets?: Project["assets"]) {
  if (!tileset) return null;
  const uploaded = tileset.image.type === "uploaded"
    ? assets?.uploaded[tileset.image.id]?.dataUrl ?? null
    : null;
  return {
    tileSize: tileset.tileSize,
    tilesPerRow: tileset.tilesPerRow,
    image: tileset.image,
    count: tileset.count,
    tileGrafts: tileset.tileGrafts ?? [],
    uploaded,
  };
}

/** Map cells plus the used tileset render identity for one project revision. */
export function mapVisualRenderContent(project: Project, map: GameMap) {
  return {
    map: mapVisualContent(map),
    tileset: tilesetVisualContent(project.tilesets[map.tilesetId], project.assets),
  };
}

/**
 * True when the map's rendered appearance may have changed between revisions.
 * Covers map visual fields and used-tileset render dependencies; unused tilesets
 * and nonvisual tileset metadata do not flip this for a map.
 */
export function requiresVisualReview(before: Project | undefined, after: Project, mapId: string): boolean {
  const afterMap = after.maps[mapId];
  if (!afterMap) return false;
  const beforeMap = before?.maps[mapId];
  if (!before || !beforeMap) return true;
  return JSON.stringify(mapVisualRenderContent(before, beforeMap))
    !== JSON.stringify(mapVisualRenderContent(after, afterMap));
}

/**
 * 그림 증거를 못 만드는 맵이면 이유를, 만들 수 있으면 null 을 돌려준다.
 *
 * 예전(2026-09)에는 미리보기·검수 그림이 타일만 그려 `map.background` 가 있는 맵을 통째로 거부했다 — 그래서 배경을 깐 맵은
 * show_map_region 그림도, 전체 맵 검수도 받을 수 없었다(2026-10-22 파노라마 조수 시험: 조수가 깐 하늘·바다를 눈으로 확인 못 함).
 * 이제 두 표면 모두 배경을 첫 프레임 정지 화면으로 빈 칸 뒤에 그리고(mapBackgroundPreview.ts), 라벨에 「스크롤 없음」을 적는다.
 * 스크롤·카메라 따라가기의 움직임은 여전히 그림으로 증명되지 않는다 — 그건 플레이 영상의 몫이다.
 */
export function mapVisualEvidenceUnavailable(_map: GameMap, _before?: GameMap): string | null {
  return null;
}
