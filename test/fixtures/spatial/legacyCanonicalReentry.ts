import { convertLegacySpatialSnapshot, legacySpatialId } from "../../../src/project/spatial/legacyImport";
import type { ObjectDesign, PlaceDesign, SpatialLibrary } from "../../../src/project/spatial/types";
import { sha256HexTextSync } from "../../../src/util/sha256";
import { customLegacyKit } from "./legacyImportMatrix";
import { malformedKits, regressionRaw } from "./legacyImportRegressions";

export const canonicalKitFaults = [
  ...malformedKits,
  { fault: "fractional height", kit: { ...customLegacyKit, height: 1.25 }, field: "height" },
  { fault: "missing lower cells", kit: { ...customLegacyKit, rows: [{ upperTiles: [405] }] }, field: "rows[0].tiles" },
];
export const liveGraphicOwners = ["object", "exterior"] as const;

/** Canonical edits replace the imported library; live owners are absent from its receipt. */
export function canonicalGraphicRaw(owner: typeof liveGraphicOwners[number], kit: Readonly<Record<string, unknown>>) {
  const valid = regressionRaw({});
  const converted = convertLegacySpatialSnapshot(JSON.stringify(valid)).raw;
  const tilesetId = "easyrpg_chipset_interior";
  const id = legacySpatialId(["user", owner]);
  const base = { id, name: "Edited live owner", revision: 7, tags: [], provenance: { origin: "user" as const } };
  const graphic = { tilesetId, kitId: "clock" };
  const object: ObjectDesign = { ...base, graphic, anchors: [], chips: ["custom", "event"] };
  const place: PlaceDesign = { ...base, kind: "facility", layout: "manual", exterior: graphic, children: [], ports: [], connections: [] };
  const library: SpatialLibrary = { objects: {}, spaces: {}, places: {}, regions: {}, worlds: {} };
  const selected = (() => {
    switch (owner) {
      case "object": return { ...library, objects: { [id]: object } };
      case "exterior": return { ...library, places: { [id]: place } };
      default: return owner satisfies never;
    }
  })();
  return { ...converted, tilesets: { ...valid.tilesets, [tilesetId]: { ...valid.tilesets[tilesetId], structureKits: [kit] } }, spatialAuthoring: { ...converted.spatialAuthoring, library: selected } };
}

/** Retired malformed live data and an opaque malformed historical archive are not selected. */
export function retiredGraphicRaw() {
  const canonical = canonicalGraphicRaw("object", { ...customLegacyKit, width: -1 });
  const object = Object.values(canonical.spatialAuthoring.library.objects)[0];
  if (!object) throw new TypeError("Missing fixture object");
  const occurrenceId = legacySpatialId(["frozen", "clock"]);
  const source = { kind: "object" as const, id: object.id, revision: object.revision };
  const json = '{ "tilesets": { "historical": { "structureKits": [{ "width": -1 }] } } }\n';
  const sha256 = sha256HexTextSync(json);
  return { ...canonical, spatialAuthoring: { ...canonical.spatialAuthoring,
    library: { objects: {}, spaces: {}, places: {}, regions: {}, worlds: {} },
    occurrences: { [occurrenceId]: {
      id: occurrenceId, kind: "object" as const, parentId: null, source, x: 0, y: 0, level: 1, seed: 7, generatorVersion: "1", bindings: [],
      snapshot: { root: source, library: canonical.spatialAuthoring.library, ports: [], kitCells: {
        [object.id]: { ...object.graphic, width: 1, height: 1, cells: [{ x: 0, y: 0, layer: "lower" as const, tile: 72 }] },
      } },
    } }, rootOccurrenceIds: [occurrenceId],
    legacyImport: { ...canonical.spatialAuthoring.legacyImport, sourceHash: sha256, backup: { encoding: "raw-json" as const, json, sha256 } },
  } };
}
