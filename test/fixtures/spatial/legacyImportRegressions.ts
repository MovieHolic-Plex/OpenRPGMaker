import type { ConceptBundleRecord, HouseStructureKitDef } from "../../../src/project/types";
import { customLegacyKit, customLegacyRaw } from "./legacyImportMatrix";

export const collisionBundle: ConceptBundleRecord = {
  id: "empty-collision", label: "Collision bundle",
  facilities: [{ id: "room", label: "Empty facility", placeIds: [] }],
  places: [{ id: "room", label: "Unselected room", size: "m", role: "room", floor: "mat" }],
  things: [{ id: "clock", label: "Unselected clock", objectId: "clock", placeIds: ["room"], chips: ["event"], required: true }],
};
export const legacyHouseKit: HouseStructureKitDef = {
  id: "clock", kind: "house", houseKitId: "brick", learnedFrom: "db-authored",
  wings: [{ x: -2, y: 0, w: 4, h: 3 }], stories: 2, windows: { spacing: 2 },
};
export const malformedKits: readonly { readonly fault: string; readonly kit: Readonly<Record<string, unknown>>; readonly field: string }[] = [
  { fault: "negative width", kit: { ...customLegacyKit, width: -1 }, field: "width" },
  { fault: "zero height", kit: { ...customLegacyKit, height: 0 }, field: "height" },
  { fault: "fractional width", kit: { ...customLegacyKit, width: 1.5 }, field: "width" },
  { fault: "missing rows", kit: { ...customLegacyKit, rows: undefined }, field: "rows" },
  { fault: "row count mismatch", kit: { ...customLegacyKit, height: 2 }, field: "rows" },
  { fault: "lower row width mismatch", kit: { ...customLegacyKit, rows: [{ tiles: [] }] }, field: "rows[0].tiles" },
  { fault: "upper row width mismatch", kit: { ...customLegacyKit, rows: [{ tiles: [72], upperTiles: [405, 405] }] }, field: "rows[0].upperTiles" },
  { fault: "lower cell outside atlas", kit: { ...customLegacyKit, rows: [{ tiles: [999999] }] }, field: "rows[0].tiles[0]" },
  { fault: "upper cell outside atlas", kit: { ...customLegacyKit, rows: [{ tiles: [72], upperTiles: [999999] }] }, field: "rows[0].upperTiles[0]" },
  { fault: "cell below empty sentinel", kit: { ...customLegacyKit, rows: [{ tiles: [-2] }] }, field: "rows[0].tiles[0]" },
  { fault: "fractional cell", kit: { ...customLegacyKit, rows: [{ tiles: [1.5] }] }, field: "rows[0].tiles[0]" },
  { fault: "unknown kit kind", kit: { ...customLegacyKit, kind: "spiral" }, field: "kind" },
  { fault: "negative house wing", kit: { ...legacyHouseKit, wings: [{ x: 0, y: 0, w: -1, h: 3 }] }, field: "wings[0].w" },
  { fault: "fractional house origin", kit: { ...legacyHouseKit, wings: [{ x: 0.5, y: 0, w: 4, h: 3 }] }, field: "wings[0].x" },
  { fault: "missing house wings", kit: { ...legacyHouseKit, wings: undefined }, field: "wings" },
  { fault: "invalid house stories", kit: { ...legacyHouseKit, stories: 4 }, field: "stories" },
];
export function regressionRaw(overrides: Readonly<Record<string, unknown>>) {
  const raw = customLegacyRaw();
  const tilesetId = "easyrpg_chipset_interior";
  return { ...raw, tilesets: { ...raw.tilesets, [tilesetId]: { ...raw.tilesets[tilesetId], ...overrides } } };
}
