// stair-qa.scenario.mjs 가 쓰는 픽스처 생성기 — 실물 buildConceptEvents 로 계단을 굽는다.
//
//   npx vite-node --script scripts/qa/runtime/stair-qa-fixture.mts --out /tmp/stair-qa.json
//   node scripts/runtime-qa.mjs --scenario stair-qa --project /tmp/stair-qa.json
//
// 검증 대상:
//  1. 가로 3칸 계단(141/111/171)의 세 칸에 전부 이동(transfer) 이벤트가 달린다.
//  2. 1칸 계단(474) 칩이 캐릭터 위에 뜨지 않고 아래에 그려진다(depth).
import { writeFileSync } from "node:fs";
import { createEmptyRoomMap } from "@/editor/interiorRoomPipeline";
import { buildConceptEvents } from "@/editor/interiorConceptEvents";
import type { ConceptPlacement } from "@/editor/interiorConceptCompose";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serializePretty } from "@/project/io";
import { readFileSync } from "node:fs";

export const STAIR_QA_SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";

function parseArgs(argv: readonly string[]): { out: string } {
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") out = argv[++i] ?? null;
  }
  if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/stair-qa-fixture.mts --out <경로.json>");
  return { out };
}

const { out } = parseArgs(process.argv.slice(2));
const project = deserialize(readFileSync(STAIR_QA_SOURCE, "utf8"));

// --- 3칸 계단 맵 ---
const W = 12, H = 12;
const map3 = createEmptyRoomMap({ mapId: "map_stair3_qa", name: "계단QA·3칸", width: W, height: H, wings: [{ x: 1, y: 1, w: 10, h: 10 }], door: { x: 6, y: 10 }, theme: "corridor", seed: 7 });
const cells3 = [
  { x: 4, y: 5, layer: "lower" as const, tile: 141 },
  { x: 5, y: 5, layer: "lower" as const, tile: 111 },
  { x: 6, y: 5, layer: "lower" as const, tile: 171 },
];
for (const c of cells3) map3.lowerTiles[c.y * W + c.x] = c.tile;
const placement3 = { objectId: "stairs_horizontal", thingId: "main_stair", label: "돌계단", roomId: "corridor", anchor: { x: 5, y: 5 }, cells: cells3, chips: ["pass", "transfer"], required: true } as ConceptPlacement;
const built3 = buildConceptEvents(map3, [placement3], { door: { x: 6, y: 10 }, transferTarget: { mapId: "map_stair1_qa", x: 6, y: 6 } });
map3.events = [...(map3.events ?? []), ...built3.events];

// --- 1칸 계단 맵 ---
const map1 = createEmptyRoomMap({ mapId: "map_stair1_qa", name: "계단QA·1칸", width: W, height: H, wings: [{ x: 1, y: 1, w: 10, h: 10 }], door: { x: 6, y: 10 }, theme: "corridor", seed: 7 });
map1.lowerTiles[5 * W + 5] = 72;
map1.upperTiles[5 * W + 5] = 474;
const placement1 = { objectId: "stairs_down", thingId: "down_stair", label: "아래층 계단", roomId: "corridor", anchor: { x: 5, y: 5 }, cells: [{ x: 5, y: 5, layer: "upper", tile: 474 }], chips: ["pass", "event"], required: true } as ConceptPlacement;
const built1 = buildConceptEvents(map1, [placement1], { door: { x: 6, y: 10 } });
map1.events = [...(map1.events ?? []), ...built1.events];

(project as any).maps[map3.id] = map3;
(project as any).maps[map1.id] = map1;
project.startMapId = map3.id;
(project as any).startPos = { x: 5, y: 7 };

const transferCount = built3.events.filter((e) => (e.pages?.[0]?.commands ?? []).some((c: any) => c.kind === "transfer")).length;
if (transferCount !== 3) throw new Error(`3칸 계단 전이 ${transferCount}개 — 3개여야 한다`);
writeFileSync(out, serializePretty(project));
console.log(`stair-qa fixture: 3-wide transfers=${transferCount}, 1-wide events=${built1.events.length} -> ${out}`);
