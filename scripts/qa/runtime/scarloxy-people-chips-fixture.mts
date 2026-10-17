// scarloxy-people-chips.scenario.mjs 픽스처 생성기 — 실물 AI 도구(place_npc)로 ScarloxyPeople1~13 걷기 칩 전 칩(90칸)을 35칸씩 세 판(--part 0|1|2)으로 5줄×7칸 격자에 세운다(칸 사이 3타일 — 스프라이트 1.5타일 폭이 겹치지 않게).
//
//   npx vite-node --script scripts/qa/runtime/scarloxy-people-chips-fixture.mts --out tmp/scarloxy-people-chips.json --part 0
//   npx vite-node --script scripts/qa/runtime/scarloxy-people-chips-fixture.mts --out tmp/scarloxy-people-chips-mix.json --part mix   (갤러리 4 합성 22종(시트 11~13) + 기존 칩 13종을 섞어 35칸 — 새 칩이 기존 칩 사이에서 어색한지 보는 판)
//   npx vite-node --script scripts/qa/runtime/scarloxy-people-chips-fixture.mts --out tmp/scarloxy-people-chips-2.json --part 1   (압축 직렬화 ~67MB: 들여쓴 114MB 는 Playwright 파이프 상한 100MB 를 넘어 브라우저가 죽는다)
//
// 무엇을 보는가: 번들 시트 tex_oprn_charset_scarloxy_people1~13 의 90칸이 출하 플레이어에서 NPC 그림으로 그려지는지(정지 격자(판마다 35칸), 둘은 배회). 새 프로젝트(createBlankProject) 기준.
import { writeFileSync } from "node:fs";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";

import roster from "@/assets/scarloxyPeopleCharsets.json";

const CHARS = (roster as { characters: { name: string; sheet: number; index: number }[] }).characters;
const ROWS_Y = [1, 3, 5, 11, 13];   // 시작 (10,8) 가로 줄은 비워 둔다
const COLS_X = [1, 4, 7, 10, 13, 16, 19];
const PART_SIZE = ROWS_Y.length * COLS_X.length;   // 35

function parseArgs(argv: readonly string[]): { out: string; part: number | "mix" } {
  let out: string | null = null;
  let part: number | "mix" = 0;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") out = argv[++i] ?? null;
    else if (argv[i] === "--part") { const v = argv[++i] ?? "0"; part = v === "mix" ? "mix" : Number(v); }
  }
  if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/scarloxy-people-chips-fixture.mts --out <경로.json> [--part 0|1|2|mix]");
  return { out, part };
}

const { out, part } = parseArgs(process.argv.slice(2));
const project = createBlankProject();
project.meta.title = `ScarloxyPeople1-13 chips QA (part ${part})`;
const ctx = { project };
const mapId = ctx.project.startMapId;
type Placement = { id: string; name: string; sheet: number; index: number; x: number; y: number; walker: boolean };
const NEW_FIRST_SHEET = 11;   // 갤러리 4 합성 22종 = 시트 11~13
const pick = (c: { name: string; sheet: number; index: number }) => ({ name: c.name, sheet: c.sheet, index: c.index });
let slice: { name: string; sheet: number; index: number }[];
let walkA: { name: string; sheet: number; index: number };
let walkB: { name: string; sheet: number; index: number };
if (part === "mix") {
  const fresh = CHARS.filter((c) => c.sheet >= NEW_FIRST_SHEET).map(pick);   // 22
  const old = CHARS.filter((c) => c.sheet < NEW_FIRST_SHEET);
  const olds = Array.from({ length: PART_SIZE - fresh.length }, (_, i) => pick(old[Math.floor((i * old.length) / (PART_SIZE - fresh.length))]!));   // 13, 기존 68칸에서 고르게
  const all = [...fresh, ...olds];
  slice = Array.from({ length: PART_SIZE }, (_, i) => all[(i * 8) % PART_SIZE]!);   // 8 과 35 는 서로소 — 새 칩과 기존 칩이 격자에 고르게 섞인다
  walkA = fresh[4]!;
  walkB = olds[5]!;
} else {
  slice = CHARS.slice(part * PART_SIZE, (part + 1) * PART_SIZE).map(pick);
  walkA = CHARS[part * PART_SIZE + 4]!;
  walkB = CHARS[Math.min(CHARS.length - 1, part * PART_SIZE + 30)]!;
}
const PLACEMENTS: Placement[] = [
  ...slice.map((c, i) => ({ id: `ev_sp_${i}`, name: c.name, sheet: c.sheet, index: c.index, x: COLS_X[i % COLS_X.length]!, y: ROWS_Y[Math.floor(i / COLS_X.length)]!, walker: false })),
  { id: "ev_walk_a", name: walkA.name, sheet: walkA.sheet, index: walkA.index, x: 5, y: 8, walker: true },
  { id: "ev_walk_b", name: walkB.name, sheet: walkB.sheet, index: walkB.index, x: 15, y: 8, walker: true },
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
