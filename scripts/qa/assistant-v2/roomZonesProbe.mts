// room_zones 검사 손 시험 — 모델 없이 설계 방 하나를 make_place 로 짓고, 구역 기록(design-area 이름표)과 할 일 검사 결과를 찍는다.
//   bun scripts/qa/assistant-v2/roomZonesProbe.mts <snapshot.json> [outDir]
// 설계는 roomParts.ts SHAPE_EXAMPLES(구역 칸 포함)에서 가져온다. 사람·조사 이벤트를 하나씩 더하며 판정이 어떻게 바뀌는지 본다.
import fs from "node:fs";
import { loadHeadlessProject } from "../../../src/headless/index.ts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { SHAPE_EXAMPLES } from "../../../src/ai/v2/roomParts.ts";
import { runTodoCheck } from "../../../src/ai/v2/todo/checks.ts";
import { renderMapPng } from "../../qa-game/render.mts";

const [snap, out = "/tmp/room-zones-probe"] = process.argv.slice(2);
if (!snap) { console.error("usage: roomZonesProbe.mts <snapshot.json> [outDir]"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
let seed = 7; Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
for (const ex of SHAPE_EXAMPLES.filter((e) => ["U", "two-room", "L"].includes(e.shape))) {
  const project = loadHeadlessProject(fs.readFileSync(snap, "utf8"));
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env = { ctx, request: { task: "서재를 지어 줘", provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", checkpoint: async () => {} } as unknown as PiAssistantV2Env;
  const tools = createV2Tools(env, new V2Session());
  const call = async (name: string, args: unknown) => { const r = await tools.find((t) => t.name === name)!.execute("p", args); return JSON.parse((r.content[0] as { text: string }).text); };
  const name = `시험 서재 ${ex.shape}`;
  const made = await call("make_place", { type: "interior", name, zones: ex.zones });
  const mapId = made.mapIds?.[0];
  console.log(`\n== ${ex.shape}: ok=${made.ok} map=${mapId} zones=${JSON.stringify(made.zones ?? [])}`);
  if (!mapId) { console.log(made.summary); continue; }
  const m = env.ctx.project.maps[mapId]!;
  for (const l of m.locations ?? []) console.log("  loc", l.name, l.x, l.y, l.w, l.h, (l.tags ?? []).join("|"));
  const check = () => runTodoCheck(env.ctx.project, { kind: "room_zones", map: name }, { refs: { mapIds: [mapId] } });
  console.log("  check0", JSON.stringify(check()));
  // 구역마다 조사 지점 하나씩
  for (const l of (m.locations ?? []).filter((l) => (l.tags ?? []).includes("design-area"))) {
    const at = (l.tags ?? []).find((t) => t.startsWith("focal-at:"))?.slice(9).split(",").map(Number);
    const p = at ? { x: at[0]!, y: at[1]! + at[3]! } : { x: l.x + 1, y: l.y + 1 };
    const r = await call("add_event", { event: { kind: "trigger", when: "talk", mapId, at: p, beats: [{ do: "say", text: `${l.name}을 살펴본다.` }] } });
    console.log("  add_event", l.name, r.ok, String(r.summary).slice(0, 120));
  }
  console.log("  check1", JSON.stringify(check()));
  fs.writeFileSync(`${out}/${ex.shape}.png`, renderMapPng(env.ctx.project, env.ctx.project.maps[mapId]!, 2).png);
}
