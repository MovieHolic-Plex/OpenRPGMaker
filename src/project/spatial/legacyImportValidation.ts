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
    // "house" 는 제거된 파라메트릭 집 킷의 잔재 — 구 저장 데이터에 남아 있을 수 있다.
    // 인터트 레코드로 용인한다(오브젝트 등록·래스터화 대상이 아니라 검증할 형상도 없다).
    if (kind === "house") continue;
    assert(kind === "section", `${path}.kind: unknown kit kind ${kind}`);
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
  }
}
