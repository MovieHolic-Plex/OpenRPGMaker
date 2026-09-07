import type { GameMap, Project, TilesetDef } from "@/project/types";

/** Shared authored visual projection. Dialogue and record metadata are text evidence. */
export function mapVisualContent(map: GameMap) {
  return { width: map.width, height: map.height, tileSize: map.tileSize, tilesetId: map.tilesetId,
    lowerTiles: map.lowerTiles, upperTiles: map.upperTiles,
    lowerTileStacks: map.lowerTileStacks, upperTileStacks: map.upperTileStacks,
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
 * The shipped tile preview and runtime have no map-background rendering contract.
 * Even a current tile image cannot prove a background or its removal/scrolling.
 * Keep this refusal until a real background-capable surface supplies owned evidence.
 */
export function mapVisualEvidenceUnavailable(map: GameMap, before?: GameMap): string | null {
  if (map.background === undefined && before?.background === undefined) return null;
  return `map-background-rendering-unavailable: map ${map.id}; show_map_region renders tiles, not map.background or its scrolling; no approval`;
}
