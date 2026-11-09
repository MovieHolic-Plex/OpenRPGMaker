// format.ts storeMonsterSheetCellProblems 로 monsterSheets16.ts 의 확장 시트 칸 채움을 검사한다 (monster-all-20, 테스트 아님).
// usage: bun scripts/content/fallen-monster16/check_cells.mts [rid ...]
import { storeMonsterSheetCellProblems } from "../../../src/assetStore/format";
import { FS_MONSTER_SHEETS_16 } from "../../../src/project/flagship/fallen/monsterSheets16";
import { PNG } from "pngjs";
const only = new Set(process.argv.slice(2));
const blobs = new Map<string, { width: number; height: number; data: Uint8Array }>();
const assets: Record<string, any> = {};
for (const s of FS_MONSTER_SHEETS_16) {
  if (only.size && !only.has(s.resourceId)) continue;
  const png = PNG.sync.read(Buffer.from(s.sheet.split(",")[1], "base64"));
  blobs.set(s.resourceId, { width: png.width, height: png.height, data: new Uint8Array(png.data) });
  assets[s.resourceId + "-sheet"] = { kind: "picture", blob: s.resourceId };
  assets[s.resourceId] = { kind: "monster", name: s.name, meta: { pixelEnemySheet: { sheetResourceId: s.resourceId + "-sheet", cell: s.cell, grid: s.grid, missingCells: (s as any).missingCells } } };
}
const problems = storeMonsterSheetCellProblems({ content: { assets } } as any, (sha) => blobs.get(sha) ?? null);
const grids = FS_MONSTER_SHEETS_16.filter((s) => !only.size || only.has(s.resourceId)).map((s) => `${s.resourceId}:${s.grid}${(s as any).missingCells ? " missing" + JSON.stringify((s as any).missingCells) : ""}`);
console.log(JSON.stringify({ checked: grids.length, grids, problems }, null, 1));
process.exit(problems.length ? 1 : 0);
