import { legacyRawFixture } from "../../support/spatialLegacyImportFixture";
import type { ConceptBundleRecord, SectionStructureKitDef } from "../../../src/project/types";

export const customLegacyBundle: ConceptBundleRecord = {
  id: "bundle/\"same", label: "Custom archive bundle",
  facilities: [
    { id: "same", label: "Archive", placeIds: ["room", "hall", "corridor", "kitchen", "attic"], wall: "gold-brick", layout: "double-row" },
    { id: "other", label: "Stone annex", placeIds: ["room"], wall: "stone-brick" },
  ],
  places: [
    { id: "room", label: "Records", role: "room", size: "s", count: 2, floor: "mat", shape: "l", zone: "north" },
    { id: "hall", label: "Entrance", role: "entrance", size: "l", floor: "stone" },
    { id: "corridor", label: "Passage", size: "m" },
    { id: "kitchen", label: "South wing", role: "room", size: "m", zone: "south", shape: "alcove", floor: "plank" },
    { id: "attic", label: "Upper records", role: "room", size: "m", level: 2 },
  ],
  things: [
    { id: "clock", label: "West archive clock", objectId: "clock", placeIds: ["room", "attic"], chips: ["event", "qa-archive", "event"], required: true },
    { id: "clock-east", label: "East archive clock", objectId: "clock", placeIds: ["room"], chips: [], required: false },
  ],
};
export const customLegacyKit: SectionStructureKitDef = {
  id: "clock", kind: "section", name: "Authored clock", width: 1, height: 1,
  rows: [{ tiles: [72], upperTiles: [405] }], learnedFrom: "user-paint",
  ai: { snap: "floor", interiorRole: "decoration", description: "Authored mixed layers", placementRules: "floor" },
};
export function customLegacyRaw() {
  const raw = legacyRawFixture();
  const interior = raw.baseline.tilesets[raw.tilesetId];
  const tileset = { ...interior, scratchConceptBundles: structuredClone([customLegacyBundle]), structureKits: [structuredClone(customLegacyKit)], interiorRoomKinds: [
    { id: " room ", label: " Original label ", requiredRoles: ["decoration", "decoration", ""], suggestedModifiers: [], walkway: false },
    { id: " room ", label: "Repeated", requiredRoles: [] },
  ] };
  return { ...raw.baseline, tilesets: { ...raw.baseline.tilesets, [raw.tilesetId]: tileset, "alias/\"same": { ...structuredClone(tileset), id: "alias/\"same" } } };
}
