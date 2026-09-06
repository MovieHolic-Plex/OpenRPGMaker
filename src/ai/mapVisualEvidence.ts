import type { GameMap } from "@/project/types";

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
 * The shipped tile preview and runtime have no map-background rendering contract.
 * Even a current tile image cannot prove a background or its removal/scrolling.
 * Keep this refusal until a real background-capable surface supplies owned evidence.
 */
export function mapVisualEvidenceUnavailable(map: GameMap, before?: GameMap): string | null {
  if (map.background === undefined && before?.background === undefined) return null;
  return `map-background-rendering-unavailable: map ${map.id}; show_map_region renders tiles, not map.background or its scrolling; no approval`;
}
