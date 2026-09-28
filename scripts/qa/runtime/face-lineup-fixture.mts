// face-lineup.scenario.mjs 픽스처 생성기 — 실물 AI 도구(place_npc·make_villager)로 시작 지점 둘레에 NPC 를 놓는다.
//
//   npx vite-node --script scripts/qa/runtime/face-lineup-fixture.mts --out tmp/face-lineup.json
//
// 무엇을 보는가(2026-09-28 얼굴 짝 교정): 조수가 얼굴을 생략하면 걷기 그림의 짝이, 틀린 얼굴을 넘기면 짝으로 교정된
// 얼굴이, 원본에 얼굴이 없던 그림에는 생성 도트 얼굴이 대화창에 떠야 한다. 손으로 JSON 을 적지 않는다 —
// 도구가 바뀌면 QA 도 같이 바뀌어야 한다. 기준 픽스처는 chest-open 과 같은 editor-authored-demo-v3(시작 14,18).
import { readFileSync, writeFileSync } from "node:fs";
import { runTool } from "@/editor/tools/toolRunner";
import { deserialize, serializePretty } from "@/project/io";

export const FACE_LINEUP_SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
/** 시작 (14,18) 둘레 네 칸 + 한 칸 오른쪽 위. 시나리오가 이 순서로 말을 건다. */
export const FACE_LINEUP = [
  { id: "ev_face_merchant", name: "상인", x: 15, y: 18, dir: "right", tool: "place_npc",
    graphic: { textureKey: "tex_easyrpg_charset_people4", characterIndex: 5 }, expect: "generated-faceset-missing-people-05", note: "원본 얼굴 없음 → 생성 도트 얼굴(자동)" },
  { id: "ev_face_elder", name: "촌장", x: 13, y: 18, dir: "left", tool: "place_npc",
    graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 6 }, face: { resourceId: "easyrpg-faceset-monster-00" },
    expect: "easyrpg-faceset-people1-06", note: "조수가 슬라임 얼굴을 넘김 → 짝으로 교정" },
  { id: "ev_face_ninja", name: "닌자 소녀", x: 14, y: 17, dir: "up", tool: "make_villager",
    graphic: { textureKey: "tex_easyrpg_charset_people2", characterIndex: 4 }, expect: "generated-faceset-missing-people-00", note: "근사 해제 칸 → 생성 도트 얼굴" },
  { id: "ev_face_trainer", name: "트레이너", x: 14, y: 19, dir: "down", tool: "place_npc",
    graphic: { textureKey: "tex_scarloxy_charset_people1", characterIndex: 0 }, expect: "generated-faceset-missing-scarloxy-00", note: "Scarloxy → 생성 도트 얼굴" },
] as const;

function parseArgs(argv: readonly string[]): { out: string } {
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === "--out") out = argv[++i] ?? null;
  if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/face-lineup-fixture.mts --out <경로.json>");
  return { out };
}

const { out } = parseArgs(process.argv.slice(2));
const ctx = { project: deserialize(readFileSync(FACE_LINEUP_SOURCE, "utf8")) };
const mapId = ctx.project.startMapId;
for (const npc of FACE_LINEUP) {
  const spot = npc.tool === "make_villager" ? { home: { x: npc.x, y: npc.y } } : { x: npc.x, y: npc.y };
  const result = runTool(ctx, npc.tool, {
    mapId, id: npc.id, name: npc.name, ...spot, graphic: npc.graphic, movement: "fixed",
    ...("face" in npc ? { face: npc.face } : {}),
    ...(npc.tool === "make_villager" ? { dialogue: [{ text: `${npc.name}: ${npc.note}` }] } : { pages: [{ lines: [npc.note] }] }),
  });
  if (!result.ok) throw new Error(`${npc.tool} ${npc.id} 실패: ${result.summary}`);
  const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === npc.id);
  if (!event || event.x !== npc.x || event.y !== npc.y) throw new Error(`${npc.id} 가 요청 좌표에 놓이지 않았다: ${event?.x},${event?.y}`);
  const face = (event.pages ?? []).flatMap((page) => page.commands).find((command) => command.kind === "changeFace");
  const actual = face && face.kind === "changeFace" ? face.resourceId : null;
  if (actual !== npc.expect) throw new Error(`${npc.id} 얼굴 ${actual} ≠ 기대 ${npc.expect}`);
  console.log(`  ${npc.id}: ${actual}  (${npc.note})`);
}
writeFileSync(out, serializePretty(ctx.project), "utf8");
console.log(`픽스처: ${out}`);

