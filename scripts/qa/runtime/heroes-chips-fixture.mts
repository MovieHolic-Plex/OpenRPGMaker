// heroes-chips.scenario.mjs 픽스처 생성기 — 실물 AI 도구(place_npc)로 Heroes1 걷기 칩 8종을 시작 지점 근처에 세운다.
//
//   npx vite-node --script scripts/qa/runtime/heroes-chips-fixture.mts --out tmp/heroes-chips.json   (압축 직렬화 ~67MB: 들여쓴 114MB 는 Playwright 파이프 상한 100MB 를 넘어 브라우저가 죽는다)
//
// 무엇을 보는가(2026-10-16 pick-6 채택 8종 설치): 번들 시트 tex_oprn_charset_heroes1 의 칸 0~7 이 출하 플레이어에서
// NPC 그림으로 그려지고(정지 줄 세우기), 둘은 배회하며 걷기 프레임이 실제로 돌아야 한다.
// 기준 픽스처는 새 프로젝트(createBlankProject, 20×15·시작 10,8·기본 칩셋 beodeul_city) — 새 프로젝트에서 칩이 보이는지의 증거를 겸한다. 손으로 JSON 을 적지 않는다.
// (옛 editor-authored-demo-v3 는 combined_town 칩셋 그림이 삭제돼 2026-10-16 현재 플레이어 부팅이 멈춘다 — 기준으로 쓰지 않는다.)
import { writeFileSync } from "node:fs";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";

const NAMES = ["양서 기사", "원시 전사 소녀", "마법사 소녀", "고철 로봇", "도적 정찰병", "연보라 마법사", "노장군", "무대 가수"] as const;
const LINEUP_Y = 11;
const LINEUP_X0 = 6;

function parseArgs(argv: readonly string[]): { out: string } {
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === "--out") out = argv[++i] ?? null;
  if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/heroes-chips-fixture.mts --out <경로.json>");
  return { out };
}

const { out } = parseArgs(process.argv.slice(2));
const project = createBlankProject();
project.meta.title = "Heroes1 chips QA";
const ctx = { project };
const mapId = ctx.project.startMapId;
/** 줄 세우기 8명(칸 0~7, 정면 고정) + 배회 2명(칸 3 로봇·칸 4 정찰병 사본, 시작 둘레). */
const PLACEMENTS = [
  ...NAMES.map((name, index) => ({ id: `ev_hero_${index}`, name, index, x: LINEUP_X0 + index, y: LINEUP_Y, walker: false })),
  { id: "ev_walk_3", name: NAMES[3], index: 3, x: 7, y: 8, walker: true },
  { id: "ev_walk_4", name: NAMES[4], index: 4, x: 13, y: 8, walker: true },
];
for (const { id, name, index, x, y, walker } of PLACEMENTS) {
  const result = runTool(ctx, "place_npc", {
    mapId, id, name, x, y,
    graphic: { textureKey: "tex_oprn_charset_heroes1", characterIndex: index },
    movement: walker ? "random" : "fixed",
    pages: [{ lines: [`${name} — Heroes1 #${index}`] }],
  });
  if (!result.ok) throw new Error(`place_npc ${id} 실패: ${result.summary}`);
  const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === id);
  if (!event || event.x !== x || event.y !== y) throw new Error(`${id} 가 요청 좌표에 놓이지 않았다: ${event?.x},${event?.y}`);
  const graphic = event.pages?.[0]?.graphic as { sprite?: { id?: string } } | undefined;
  console.log(`  ${id} ${name} (${x},${y}) ${walker ? "배회" : "고정"} graphic=${JSON.stringify(graphic?.sprite)}`);
}
writeFileSync(out, serialize(ctx.project), "utf8");
console.log(`픽스처: ${out}`);
