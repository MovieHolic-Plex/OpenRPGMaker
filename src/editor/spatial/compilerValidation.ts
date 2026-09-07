import { isPassableLanding } from "@/project/collision";
import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import type { SpatialCompiledBinding } from "@/project/spatial/types";
import type { GameMap, Project } from "@/project/types";
import { sha256HexTextSync } from "@/util/sha256";
import { buildConceptEvents } from "../interiorConceptEvents";
import { containsPoint, objectPorts } from "./compileObjects";
import { SpatialCompileError, type SpatialCompileContext, type SpatialRasterProposal } from "./compilerTypes";

/** Digest is scoped to owned pixels/stacks/events, never to a projection's overlapping extent. */
export function spatialRasterDigest(map: GameMap, binding: Pick<SpatialCompiledBinding, "rect" | "ports"> & { readonly eventIds: readonly string[] }): string {
  const cells = [];
  for (let y = binding.rect.y; y < binding.rect.y + binding.rect.height; y++) {
    for (let x = binding.rect.x; x < binding.rect.x + binding.rect.width; x++) {
      const i = y * map.width + x;
      cells.push([map.lowerTiles[i], map.upperTiles[i], map.lowerTileStacks?.[i] ?? [], map.upperTileStacks?.[i] ?? []]);
    }
  }
  return sha256HexTextSync(JSON.stringify({ tilesetId: map.tilesetId, rect: binding.rect, cells,
    events: map.events.filter(event => binding.eventIds.includes(event.id)), ports: binding.ports },
  (_key, value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value));
}

/** Reject replacement of unmanaged content or stale generated content, even on a detached proposal. */
export function requireSpaceOwnership(context: SpatialCompileContext, raster: SpatialRasterProposal): void {
  const previous = context.project.maps[raster.map.id];
  if (!previous) return;
  const binding = context.occurrence.bindings.find(binding => binding.mapId === previous.id && isOwnedSpatialBinding(binding));
  if (!binding || !isOwnedSpatialBinding(binding) || binding.rect.x !== 0 || binding.rect.y !== 0
    || binding.rect.width !== previous.width || binding.rect.height !== previous.height
    || previous.events.some(event => !binding.eventIds.includes(event.id))
    || spatialRasterDigest(previous, binding) !== binding.contentDigest) throw new SpatialCompileError("ownership", previous.id);
}

export function validateRasterAccess(project: Project, raster: SpatialRasterProposal): void {
  const { map, entry } = raster;
  if (!isPassableLanding(project, map, entry.x, entry.y)) throw new SpatialCompileError("entry", `${map.id}@${entry.x},${entry.y}`);
  const reached = computeReachableCells(project, map, entry.x, entry.y);
  const ports = [...raster.ports, ...raster.objects.flatMap(objectPorts)];
  for (const port of ports) {
    if (!containsPoint(raster.rect, port) || !isPassableLanding(project, map, port.x, port.y)
      || !reached.has(`${port.x},${port.y}`)) throw new SpatialCompileError("port", `${port.portId}@${port.x},${port.y}`);
  }
  for (const object of raster.objects) {
    if (!containsPoint(raster.rect, object.rect) || !containsPoint(raster.rect, {
      x: object.rect.x + object.rect.width - 1, y: object.rect.y + object.rect.height - 1,
    })) throw new SpatialCompileError("clipped", object.occurrence.id);
    for (const cell of object.placement.cells) {
      const tile = cell.layer === "lower" ? map.lowerTiles[cell.y * map.width + cell.x] : map.upperTiles[cell.y * map.width + cell.x];
      if (tile !== cell.tile) throw new SpatialCompileError("raster", `${object.occurrence.id}@${cell.x},${cell.y}`);
    }
    if (object.placement.required && !isAdjacentOrOn(reached, object.placement.anchor.x, object.placement.anchor.y)) {
      throw new SpatialCompileError("required", object.occurrence.id);
    }
  }
}

/** Existing chip backend, one concrete object per call for identity independent of repetition gaps. */
export function compileObjectEvents(raster: SpatialRasterProposal): void {
  for (const object of raster.objects) {
    const { placement } = object;
    if (placement.chips.includes("transfer")) throw new SpatialCompileError("connection", `${object.occurrence.id}: transfer requires the connection compiler`);
    const result = buildConceptEvents(raster.map, [placement], { door: raster.entry });
    if (result.warnings.length) throw new SpatialCompileError("required", object.occurrence.id);
    for (const event of result.events) {
      if (event.x !== placement.anchor.x || event.y !== placement.anchor.y) throw new SpatialCompileError("blocked", `${object.occurrence.id}: event anchor occupied`);
    }
    raster.map.events.push(...result.events);
  }
}
