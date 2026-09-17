// storage-savepoint 시나리오용 픽스처 — 실물 도구로 굽는다:
//   npx vite-node --script scripts/qa/runtime/storage-savepoint-fixture.mts --out /tmp/storage-savepoint.json
// 시작 (14,18) 북쪽 한 줄: 세이브 (13,17) · 보관함 (14,17) · 보물상자 (15,17).
import { readFileSync, writeFileSync } from "node:fs";
import { getTool } from "@/editor/tools/toolRegistry";
import { deserialize, serializePretty } from "@/project/io";

export const STORAGE_FIXTURE_SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
export const STORAGE_EVENT_ID = "ev_storage_qa";
export const SAVEPOINT_EVENT_ID = "ev_save_qa";
export const CHEST_EVENT_ID = "ev_chest_compare_qa";
export const STORAGE_POS = { x: 14, y: 17 } as const;
export const SAVEPOINT_POS = { x: 13, y: 17 } as const;
export const CHEST_POS = { x: 15, y: 17 } as const;

function parseArgs(argv: readonly string[]): { out: string } {
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") out = argv[++i] ?? null;
  }
  if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/storage-savepoint-fixture.mts --out <경로.json>");
  return { out };
}

const { out } = parseArgs(process.argv.slice(2));
const project = deserialize(readFileSync(STORAGE_FIXTURE_SOURCE, "utf8"));
const storageTool = getTool("place_storage_chest");
const saveTool = getTool("place_savepoint");
const chestTool = getTool("place_chest");
if (!storageTool || !saveTool || !chestTool) throw new Error("place_storage_chest/place_savepoint/place_chest 도구 등록 확인");
const r1 = storageTool.run(project, {
  mapId: project.startMapId,
  x: STORAGE_POS.x,
  y: STORAGE_POS.y,
  id: STORAGE_EVENT_ID,
  name: "보관함",
});
const r2 = saveTool.run(project, {
  mapId: project.startMapId,
  x: SAVEPOINT_POS.x,
  y: SAVEPOINT_POS.y,
  id: SAVEPOINT_EVENT_ID,
  name: "세이브 크리스탈",
});
const itemId = project.database.items[0]?.id ?? "item_potion";
const r3 = chestTool.run(project, {
  mapId: project.startMapId,
  x: CHEST_POS.x,
  y: CHEST_POS.y,
  id: CHEST_EVENT_ID,
  contents: { itemId, gold: 10 },
});
const d1 = r1.data as { x: number; y: number; adjusted: boolean };
const d2 = r2.data as { x: number; y: number; adjusted: boolean };
const d3 = r3.data as { x: number; y: number; adjusted: boolean };
if (d1.adjusted || d1.x !== STORAGE_POS.x || d1.y !== STORAGE_POS.y) {
  throw new Error(`보관함이 요청 좌표에 놓이지 않았다: (${d1.x},${d1.y}) adjusted=${d1.adjusted}`);
}
if (d2.adjusted || d2.x !== SAVEPOINT_POS.x || d2.y !== SAVEPOINT_POS.y) {
  throw new Error(`세이브포인트가 요청 좌표에 놓이지 않았다: (${d2.x},${d2.y}) adjusted=${d2.adjusted}`);
}
if (d3.adjusted || d3.x !== CHEST_POS.x || d3.y !== CHEST_POS.y) {
  throw new Error(`보물상자가 요청 좌표에 놓이지 않았다: (${d3.x},${d3.y}) adjusted=${d3.adjusted}`);
}
writeFileSync(out, serializePretty(project), "utf8");
console.log(`픽스처: ${out}`);
console.log(`  ${r1.summary}`);
console.log(`  ${r2.summary}`);
console.log(`  ${r3.summary}`);
