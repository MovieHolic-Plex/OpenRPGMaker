// chest-open.scenario.mjs 가 쓰는 픽스처 생성기 — 시작 지점 바로 위에 place_chest 보물상자를 놓는다.
//
//   npx vite-node --script scripts/qa/runtime/chest-open-fixture.mts --out /tmp/chest-open.json
//
// 왜 도구를 직접 호출하는가: 검증 대상은 **AI 조수가 place_chest 로 놓는 실물**이다. 손으로 JSON 을
// 적으면 도구가 바뀌어도 QA 는 옛 모양을 계속 통과시킨다. 기준 픽스처는 editor-authored-demo-v3
// (시작맵 map_lantern_village 30x30, 시작 (14,18), 시작 소지금 0, 플레이어 캐릭셋 정상 렌더).
import { readFileSync, writeFileSync } from "node:fs";
import { getTool } from "@/editor/tools/toolRegistry";
import { deserialize, serializePretty } from "@/project/io";

export const CHEST_FIXTURE_SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
export const CHEST_EVENT_ID = "ev_chest_qa";
export const CHEST_GOLD = 50;
export const CHEST_ITEM_ID = "item_potion";
/** 시작 (14,18) 의 북쪽 한 칸 — 플레이어가 위를 보고 조사한다. */
export const CHEST_POS = { x: 14, y: 17 } as const;

function parseArgs(argv: readonly string[]): { out: string } {
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") out = argv[++i] ?? null;
  }
  if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/chest-open-fixture.mts --out <경로.json>");
  return { out };
}

const { out } = parseArgs(process.argv.slice(2));
const project = deserialize(readFileSync(CHEST_FIXTURE_SOURCE, "utf8"));
const tool = getTool("place_chest");
if (!tool) throw new Error("place_chest 도구가 등록되어 있지 않다");
const result = tool.run(project, {
  mapId: project.startMapId,
  x: CHEST_POS.x,
  y: CHEST_POS.y,
  id: CHEST_EVENT_ID,
  contents: { itemId: CHEST_ITEM_ID, gold: CHEST_GOLD },
});
const placed = result.data as { x: number; y: number; adjusted: boolean };
if (placed.adjusted || placed.x !== CHEST_POS.x || placed.y !== CHEST_POS.y) {
  throw new Error(`상자가 요청 좌표에 놓이지 않았다: (${placed.x},${placed.y}) adjusted=${placed.adjusted}`);
}
writeFileSync(out, serializePretty(project), "utf8");
console.log(`픽스처: ${out}`);
console.log(`  ${result.summary}`);
if (result.warnings?.length) console.log(`  경고: ${result.warnings.join(" / ")}`);
