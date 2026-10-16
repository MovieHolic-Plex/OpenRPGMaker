// scarloxy-people-chips.scenario.mjs 픽스처 생성기 — 실물 AI 도구(place_npc)로 ScarloxyPeople1~3 걷기 칩 전 칩을 시작 지점 아래에 3줄로 세운다.
//
//   npx vite-node --script scripts/qa/runtime/scarloxy-people-chips-fixture.mts --out tmp/scarloxy-people-chips.json   (압축 직렬화 ~67MB: 들여쓴 114MB 는 Playwright 파이프 상한 100MB 를 넘어 브라우저가 죽는다)
//
// 무엇을 보는가: 번들 시트 tex_oprn_charset_scarloxy_people1~3 의 21칸이 출하 플레이어에서 NPC 그림으로 그려지는지(정지 줄 세우기 3줄, 둘은 배회). 새 프로젝트(createBlankProject) 기준.
import { writeFileSync } from "node:fs";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";

import roster from "@/assets/scarloxyPeopleCharsets.json";

const CHARS = (roster as { characters: { name: string; sheet: number; index: number }[] }).characters;
const LINEUP_Y0 = 9;
const LINEUP_X0 = 6;

function parseArgs(argv: readonly string[]): { out: string } {
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === "--out") out = argv[++i] ?? null;
  if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/scarloxy-people-chips-fixture.mts --out <경로.json>");
  return { out };
}

const { out } = parseArgs(process.argv.slice(2));
const project = createBlankProject();
project.meta.title = "ScarloxyPeople1-3 chips QA";
const ctx = { project };
const mapId = ctx.project.startMapId;
const PLACEMENTS = [
  ...CHARS.map((c, i) => ({ id: `ev_sp_${i}`, name: c.name, sheet: c.sheet, index: c.index, x: LINEUP_X0 + (i % 8), y: LINEUP_Y0 + Math.floor(i / 8), walker: false })),
  { id: "ev_walk_a", name: CHARS[4]!.name, sheet: CHARS[4]!.sheet, index: CHARS[4]!.index, x: 7, y: 6, walker: true },
  { id: "ev_walk_b", name: CHARS[CHARS.length - 1]!.name, sheet: CHARS[CHARS.length - 1]!.sheet, index: CHARS[CHARS.length - 1]!.index, x: 13, y: 6, walker: true },
];
for (const { id, name, sheet, index, x, y, walker } of PLACEMENTS) {
  const result = runTool(ctx, "place_npc", {
    mapId, id, name, x, y,
    graphic: { textureKey: `tex_oprn_charset_scarloxy_people${sheet}`, characterIndex: index },
    movement: walker ? "random" : "fixed",
    pages: [{ lines: [`${name} — ScarloxyPeople${sheet} #${index}`] }],
  });
  if (!result.ok) throw new Error(`place_npc ${id} 실패: ${result.summary}`);
  const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === id);
  if (!event) throw new Error(`${id} 이벤트가 없다`);
  if (event.x !== x || event.y !== y) console.log(`  (주의) ${id} 요청 ${x},${y} → 실제 ${event.x},${event.y} (도구가 비킴)`);
  const graphic = event.pages?.[0]?.graphic as { sprite?: { id?: string } } | undefined;
  console.log(`  ${id} ${name} (${x},${y}) ${walker ? "배회" : "고정"} graphic=${JSON.stringify(graphic?.sprite)}`);
}
writeFileSync(out, serialize(ctx.project), "utf8");
console.log(`픽스처: ${out}`);
