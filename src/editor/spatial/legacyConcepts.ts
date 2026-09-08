import { assertNever, checkedDocument, own } from "@/project/spatial/domain";
import { choice, list, text } from "@/project/spatial/guardValues";
import { CONCEPT_FLOOR_MATERIALS, CONCEPT_WALL_MATERIALS, type ConceptBundleRecord, type ConceptPlaceRecord } from "@/project/types/conceptBundle";
import type { Project } from "@/project/types";
import type { SpaceDesign, SpatialAuthoringDocument, SpatialDesignReference } from "@/project/spatial/types";
import { CONCEPT_FLOOR_TILES, type ConceptRoomLayout } from "../conceptBundleResolve";
import { ToolError } from "../tools/types";
import { PLACE_ALIASES } from "../interiorPlaceAliases";

/** Read-only compatibility projection. The receipt supplies aliases, never archived source data. */
export function canonicalConceptSource(project: Project, query: string, tilesetId?: string): SpatialDesignReference | undefined {
  const document = checkedDocument(project.spatialAuthoring, project);
  const facilities = Object.values(document.library.places).filter(place => place.kind === "facility");
  // Opaque identity is authoritative; the atlas qualifier scopes discovery, not exact IDs.
  const direct = facilities.find(place => place.id === query);
  if (direct) return { kind: "place", id: direct.id };
  const aliases = document.legacyImport.mapping.filter(entry => entry.target.kind === "place").map(entry => ({
    id: entry.target.id, tuple: list(JSON.parse(entry.sourceKey), "legacyImport.sourceKey", text),
  }));
  const candidates = facilities.filter(place => {
    if (!tilesetId) return true;
    const rooms = roomsOf(document, { kind: "place", id: place.id });
    // Current canonical rooms own eligibility; only empty imports need receipt scope.
    return rooms.length ? rooms.every(room => room.space.tilesetId === tilesetId)
      : aliases.some(alias => alias.id === place.id && alias.tuple[0] === tilesetId);
  });
  const exact = candidates.filter(place => place.name === query || place.tags.includes(query));
  const mapped = aliases.filter(alias => (!tilesetId || alias.tuple[0] === tilesetId)
    && (alias.tuple[1] === query || alias.tuple[3] === query)).map(alias => alias.id);
  const matches = exact.length ? exact : candidates.filter(place => mapped.includes(place.id));
  if (matches.length > 1) throw new ToolError("Ambiguous canonical facility; use its exact spatial id", { code: "spatial-ambiguous" });
  const design = matches[0];
  return design ? { kind: "place", id: design.id } : undefined;
}
type Room = { readonly space: SpaceDesign; readonly id: string; readonly x: number; readonly y: number; readonly level: number };
const layouts = new WeakMap<ConceptBundleRecord, readonly Room[]>();
function alias(document: SpatialAuthoringDocument, ref: SpatialDesignReference): string {
  const entry = document.legacyImport.mapping.find(entry => entry.target.kind === ref.kind && entry.target.id === ref.id);
  if (!entry) return ref.id;
  return list(JSON.parse(entry.sourceKey), "legacyImport.sourceKey", text)[3] ?? ref.id;
}
function roomsOf(document: SpatialAuthoringDocument, root: SpatialDesignReference): readonly Room[] {
  const pending = [{ source: root, x: 0, y: 0, level: 0, path: [root.id] }];
  const rooms: Room[] = [];
  for (const item of pending) {
    switch (item.source.kind) {
      case "place": {
        const place = own(document.library.places, item.source.id);
        for (const child of place.children) pending.push({ source: child.source, x: item.x + child.x, y: item.y + child.y,
          level: item.level + child.level, path: [...item.path, child.id] });
        break;
      }
      case "space": {
        const space = own(document.library.spaces, item.source.id);
        // Opaque root/slot IDs form a tuple: a slash inside one ID is not a path boundary.
        rooms.push({ space, id: JSON.stringify(item.path), x: item.x, y: item.y, level: Math.max(1, item.level) });
        break;
      }
      case "object": case "region": case "world": throw new ToolError("Not an interior facility", { code: "spatial-kind" });
      default: assertNever(item.source.kind);
    }
  }
  return rooms;
}
export function canonicalConceptBundles(project: Project, tilesetId: string): readonly ConceptBundleRecord[] {
  const document = checkedDocument(project.spatialAuthoring, project);
  return Object.values(document.library.places).filter(place => place.kind === "facility").flatMap(place => {
    const rooms = roomsOf(document, { kind: "place", id: place.id });
    if (rooms.some(room => room.space.tilesetId !== tilesetId || room.space.environment !== "interior")) return [];
    const places: ConceptPlaceRecord[] = rooms.map(room => ({ id: room.id, label: room.space.name,
      role: room.space.environment === "interior" ? room.space.role : "room", shape: room.space.shape,
      floor: choice(CONCEPT_FLOOR_MATERIALS)(room.space.floor, `${room.space.id}.floor`), level: room.level,
    }));
    const bundle: ConceptBundleRecord = { id: alias(document, { kind: "place", id: place.id }), label: place.name,
      facilities: [{ id: alias(document, { kind: "place", id: place.id }), label: place.name, placeIds: places.map(room => room.id),
        layout: place.layout === "double-row" ? "double-row" : "row" }], places,
      things: rooms.flatMap(room => room.space.objectSlots.flatMap(slot => {
        const object = own(document.library.objects, slot.objectDesignId);
        if (object.graphic.tilesetId !== tilesetId) throw new ToolError("Cross-atlas interior requires preview_spatial_build", { code: "spatial-atlas" });
        return Array.from({ length: slot.quantity }, (_, index) => ({ id: `${room.id}/${slot.id}/${index}`, label: object.name,
          objectId: object.graphic.kitId, placeIds: [room.id], chips: [...slot.chipOverrides ?? object.chips], required: slot.required }));
      })),
    };
    layouts.set(bundle, rooms);
    return [bundle];
  });
}
/** Exact dimensions/positions remain canonical instead of rounding back to legacy s/m/l sizes. */
export function canonicalConceptLayout(bundle: ConceptBundleRecord, level?: number): ConceptRoomLayout | undefined {
  const source = layouts.get(bundle);
  if (!source) return undefined;
  const selected = source.filter(room => level === undefined || room.level === level);
  if (!selected.length) throw new ToolError("Canonical facility has no rooms on the requested floor", { code: "spatial-empty" });
  const dx = Math.max(0, 2 - Math.min(...selected.map(room => room.x)));
  const dy = Math.max(0, 3 - Math.min(...selected.map(room => room.y)));
  const rooms = selected.map(room => ({ id: room.id, placeId: room.id,
    role: room.space.environment === "interior" ? room.space.role : "room" as const,
    theme: room.space.tags[0] ?? room.space.name, x: room.x + dx, y: room.y + dy, w: room.space.width, h: room.space.height, shape: room.space.shape,
    floorTile: floorTile(room.space.floor),
  }));
  const entrance = rooms.find(room => room.role === "entrance") ?? rooms[rooms.length - 1];
  if (!entrance) throw new ToolError("Canonical facility is empty", { code: "spatial-empty" });
  const wall = selected[0]?.space.wall;
  if (selected.some(room => room.space.wall !== wall)) throw new ToolError("Mixed wall materials require preview_spatial_build", { code: "spatial-material" });
  return { width: Math.max(...rooms.map(room => room.x + room.w)) + 2,
    height: Math.max(...rooms.map(room => room.y + room.h)) + 2,
    door: { x: entrance.x + Math.floor(entrance.w / 2), y: entrance.y + entrance.h - 1 }, rooms,
    innerDoors: rooms.filter(room => room !== entrance).map(room => ({ x: room.x + Math.floor(room.w / 2), y: room.y + room.h })),
    wallMaterial: choice(CONCEPT_WALL_MATERIALS)(wall, "wall"),
  };
}
function floorTile(material: string): number {
  return CONCEPT_FLOOR_TILES[choice(CONCEPT_FLOOR_MATERIALS)(material, "floor")];
}

/** Match legacy room aliases using the receipt, without treating opaque IDs as encoded data. */
export function canonicalRoomAlias(project: Project, query: string, tilesetId: string): SpaceDesign | undefined {
  const document = checkedDocument(project.spatialAuthoring, project);
  const spaces = Object.values(document.library.spaces);
  // Exact IDs include layout contexts; the binder retains explicit atlas rejection.
  const direct = spaces.find(space => space.id === query);
  if (direct) return direct;
  const receipt = document.legacyImport.mapping.filter(entry => entry.target.kind === "space").map(entry => ({
    id: entry.target.id, tuple: list(JSON.parse(entry.sourceKey), "legacyImport.sourceKey", text),
  }));
  const mappedIds = new Set(receipt.map(entry => entry.id));
  // Unmapped legacy layout copies are exact-ID-only, never replacements for deleted originals.
  const candidates = spaces.filter(space => space.tilesetId === tilesetId
    && (space.provenance.origin !== "legacy" || mappedIds.has(space.id)));
  const alias = PLACE_ALIASES[query];
  const qualifiedIds = new Set(receipt.filter(entry => alias && entry.tuple[0] === tilesetId
    && entry.tuple[1] === alias[0] && entry.tuple[3] === alias[1]).map(entry => entry.id));
  const preferred = candidates.filter(space => qualifiedIds.has(space.id));
  const aliasIds = new Set(receipt.filter(entry => entry.tuple[0] === tilesetId && entry.tuple[3] === query).map(entry => entry.id));
  // Shorthand selects historical originals, but cannot hide native name/tag collisions.
  const matches = candidates.filter(space => preferred.length
    ? qualifiedIds.has(space.id) || (space.provenance.origin !== "legacy" && (space.name === query || space.tags.includes(query)))
    : space.name === query || space.tags.includes(query) || aliasIds.has(space.id));
  if (matches.length > 1) throw new ToolError("Ambiguous canonical room; use its exact spatial id", { code: "spatial-ambiguous" });
  return matches[0];
}
