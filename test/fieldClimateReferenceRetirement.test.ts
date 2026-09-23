// A new category id replaces the old one only while the old one is an exact shipped copy; edits are kept.
import { describe, expect, it, vi } from "vitest";
import { referenceRevision, type TilesetReferenceCategory } from "@/project/tilesetReferences";
import { createBlankProject } from "@/project/defaults";
import { ensureFieldRouteReferences } from "@/project/defaults/sharedFieldRouteReferences";
import { ensureClimateVillageReferences } from "@/project/defaults/climateVillages";
import fields from "@/assets/sharedFieldRouteReferences.json";
import climates from "@/assets/sharedClimateVillageReferences.json";
import type { TilesetDef } from "@/project/types";

const recorded = vi.hoisted(() => ({ field: [] as { id: string; revision: string }[], climate: [] as { id: string; revision: string }[] }));
vi.mock("../tiledata/field-routes/previous-reference.json", () => ({ default: recorded.field }));
vi.mock("../tiledata/climate-villages/previous-reference.json", () => ({ default: recorded.climate }));

describe.each([
  ["field", "forest_harmony_snow", fields, ensureFieldRouteReferences],
  ["climate", "forest_harmony_snow", climates, ensureClimateVillageReferences],
] as const)("%s guidance revisions", (kind, tilesetId, shipped, ensure) => {
  const current = (shipped as unknown as Record<string, TilesetReferenceCategory>)[tilesetId]!;
  const older = (edit: string): TilesetReferenceCategory => {
    const category = structuredClone(current);
    category.id = current.id.replace(/-v\d+$/, "-v1");
    category.documents[0]!.markdown += edit;
    return category;
  };

  it("retires an unedited older copy and keeps an edited one", () => {
    const shippedOld = older(""), editedOld = older("\n작성자가 고친 줄");
    recorded[kind].splice(0, Infinity, { id: shippedOld.id, revision: referenceRevision(shippedOld) });
    for (const old of [shippedOld, editedOld]) {
      const tileset: TilesetDef = createBlankProject().tilesets[tilesetId]!;
      tileset.referenceDocuments = [...tileset.referenceDocuments!.filter(c => c.id !== current.id), structuredClone(old)];
      expect(ensure(tileset)).toBe(true);
      const ids = tileset.referenceDocuments!.map(c => c.id);
      expect(ids.filter(id => id === current.id)).toHaveLength(1);
      expect(ids.includes(old.id)).toBe(old === editedOld);
      expect(ensure(tileset)).toBe(false);
    }
  });
});
