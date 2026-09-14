import type { DesignNode } from "./domain";
import type { SpatialComposition, SpatialKind, SpatialPoint } from "./types";

export const COMPOSITION_KINDS: Readonly<Record<SpatialKind, readonly SpatialKind[]>> = {
  object: [], space: ["object", "space", "place"], place: ["object", "space", "place"],
  region: ["object", "space", "place"], world: ["object", "space", "place", "region"],
};
export function compositionOf(node: DesignNode): SpatialComposition | undefined {
  return node.kind === "object" ? undefined : node.design.composition;
}
export function paintComposition(composition: SpatialComposition, point: SpatialPoint, layer: "lower" | "upper", tile: number | null): SpatialComposition {
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 0 || point.y < 0 || point.x >= composition.width || point.y >= composition.height) return composition;
  const tiles = composition.tiles.filter(cell => cell.layer !== layer || cell.x !== point.x || cell.y !== point.y);
  return { ...composition, tiles: tile === null ? tiles : [...tiles, { ...point, layer, tile }] };
}
