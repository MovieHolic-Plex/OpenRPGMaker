import { assert, requireArray, requireNumber, requireRecord, requireString } from "../io/guards";
import type { TilesetDef } from "../types";

function integer(path: string, value: unknown, minimum: number): number {
  const parsed = requireNumber(path, value);
  assert(Number.isSafeInteger(parsed) && parsed >= minimum, `${path}: expected integer >= ${minimum}`);
  return parsed;
}

/** The ordinary legacy loader retains kits without parsing their geometry. All authored
 * kits are selected by this importer, so validate them before selection or live resolution.
 * Validation never repairs the authoritative kit or substitutes a builtin for it.
 */
export function validateLegacyImportKits(tilesetId: string, tileset: Pick<TilesetDef, "structureKits" | "count">): void {
  if (tileset.structureKits === undefined) return;
  for (const [index, value] of requireArray(`tileset ${tilesetId}.structureKits`, tileset.structureKits).entries()) {
    const entryPath = `tileset ${tilesetId}.structureKits[${index}]`;
    const kit = requireRecord(entryPath, value);
    const id = requireString(`${entryPath}.id`, kit.id);
    const path = JSON.stringify([tilesetId, "", "object", id]);
    const kind = requireString(`${path}.kind`, kit.kind);
    assert(kind === "section" || kind === "house", `${path}.kind: unknown kit kind ${kind}`);
    switch (kind) {
      case "section": {
        const width = integer(`${path}.width`, kit.width, 1);
        const height = integer(`${path}.height`, kit.height, 1);
        const rows = requireArray(`${path}.rows`, kit.rows);
        assert(rows.length === height, `${path}.rows: row count must equal height`);
        for (const [y, value] of rows.entries()) {
          const rowPath = `${path}.rows[${y}]`;
          const row = requireRecord(rowPath, value);
          for (const layer of ["tiles", "upperTiles"] as const) {
            if (layer === "upperTiles" && row[layer] === undefined) continue;
            const cells = requireArray(`${rowPath}.${layer}`, row[layer]);
            assert(cells.length === width, `${rowPath}.${layer}: cell count must equal width`);
            for (const [x, value] of cells.entries()) {
              const cellPath = `${rowPath}.${layer}[${x}]`;
              const tile = integer(cellPath, value, -1);
              assert(tile < tileset.count, `${cellPath}: outside atlas`);
            }
          }
        }
        break;
      }
      case "house": {
        requireString(`${path}.houseKitId`, kit.houseKitId);
        for (const [index, value] of requireArray(`${path}.wings`, kit.wings).entries()) {
          const wingPath = `${path}.wings[${index}]`;
          const wing = requireRecord(wingPath, value);
          for (const axis of ["x", "y"] as const) integer(`${wingPath}.${axis}`, wing[axis], Number.MIN_SAFE_INTEGER);
          for (const axis of ["w", "h"] as const) integer(`${wingPath}.${axis}`, wing[axis], 1);
        }
        if (kit.stories !== undefined) {
          const stories = integer(`${path}.stories`, kit.stories, 1);
          assert(stories <= 3, `${path}.stories: expected 1, 2 or 3`);
        }
        break;
      }
      default: kind satisfies never;
    }
  }
}
