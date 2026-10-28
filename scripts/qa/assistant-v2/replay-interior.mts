// 실제 판의 장소 동사(make_place·edit_place·dress_room·move_object·stamp_object)를 모델 없이 지금 코드로 다시 돌려 그림을 찍는다.
//   bun scripts/qa/assistant-v2/replay-interior.mts <runDir> <outDir> [--turn 1] [--scale 2] [--tag now]
// runDir = ~/z-project/assistant-whole-game/suite/runs/<묶음>/<모델>/<장르> (session/snapshots/NNN-before.json · session/turns/NNN.json).
// 같은 인자를 고치기 전/후 코드로 돌려 전/후 그림을 비교한다(make_place 의 무작위 salt 는 Math.random 을 고정해 같게 만든다).
import fs from "node:fs";
import path from "node:path";
import { loadHeadlessProject } from "../../../src/headless/index.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { measureInteriorBareFloor } from "../../../src/editor/handInterior/bareFloor.ts";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const [runDir, out] = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--")));
if (!runDir || !out) { console.error("usage: replay-interior.mts <runDir> <outDir> [--turn 1] [--scale 2] [--tag now]"); process.exit(2); }
const turn = opt("turn", "1").padStart(3, "0");
const scale = Number(opt("scale", "2"));
const tag = opt("tag", "now");
const PLACE_VERBS = new Set(["make_place", "edit_place", "dress_room", "move_object", "stamp_object"]);
const SKIP = new Set(["ask_user", "inspect", "playtest", "look", "find_tools", "read_assistant_skill"]);
const all = argv.includes("--all");

// make_place 는 salt 를 Math.random 으로 뽑는다 — 고정해 전/후가 같은 배치에서 출발하게.
let seed = Number(opt("seed", "12345"));
Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };

fs.mkdirSync(out, { recursive: true });
const snapshotText = fs.readFileSync(path.join(runDir, "session/snapshots", `${turn}-before.json`), "utf8");
const turnRec = JSON.parse(fs.readFileSync(path.join(runDir, "session/turns", `${turn}.json`), "utf8")) as { input: string; toolArgs?: { name: string; args: Record<string, unknown> }[]; toolCalls?: { name: string; ok: boolean; summary: string }[] };
// --find-salt N: 원래 판의 첫 make_place 와 같은 맵 크기(W×H)가 나오는 seed 를 N 개까지 찾는다(전/후를 원래 판과 같은 배치에서 비교하려고).
if (argv.includes("--find-salt")) {
  const want = /(\d+)×(\d+) \(/u.exec(turnRec.toolCalls?.find((c) => c.name === "make_place" && c.ok)?.summary ?? "");
  if (!want) { console.log("원래 make_place 크기를 못 읽었다"); process.exit(1); }
  for (let s0 = 1; s0 <= Number(opt("find-salt", "40")); s0++) {
    seed = s0;
    const p = loadHeadlessProject(snapshotText);
    const c: ToolContext = { project: p, currentMapId: p.startMapId, assistantRun: true };
    const ts = createV2Tools({ ctx: c, request: { task: turnRec.input, provider: "local-cli:claude", mapIds: [], project: p } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", checkpoint: async () => {} }, new V2Session());
    for (const call of turnRec.toolArgs ?? []) {
      if (call.name !== "write_blueprint" && call.name !== "make_place") continue;
      try { await ts.find((t) => t.name === call.name)!.execute("f", call.args); } catch { /* */ }
      if (call.name === "make_place") break;
    }
    const m = c.project.maps[c.currentMapId ?? p.startMapId]!;
    console.log(`seed ${s0}: ${m.width}x${m.height}${m.width === Number(want[1]) && m.height === Number(want[2]) ? "  <== 원래와 같은 크기" : ""}`);
  }
  process.exit(0);
}
const project = loadHeadlessProject(snapshotText);
const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
const session = new V2Session();
const env: PiAssistantV2Env = {
  ctx, request: { task: turnRec.input, provider: "local-cli:claude", mapIds: [], project } as never,
  emit: () => {}, record: () => {},
  sideChat: async () => JSON.stringify({ score: 7, majors: [] }),
  checkpoint: async () => {},
};
const tools = createV2Tools(env, session);
const touched = new Set<string>();
const log: string[] = [];
let i = 0;
for (const call of turnRec.toolArgs ?? []) {
  if (SKIP.has(call.name) || (!all && !PLACE_VERBS.has(call.name) && call.name !== "write_blueprint")) continue;
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) { log.push(`-- ${call.name} (이 실행에 없는 도구 — 건너뜀)`); continue; }
  let res: Awaited<ReturnType<typeof tool.execute>>;
  try { res = await tool.execute(`r${++i}`, call.args); } catch (e) { log.push(`-- ${call.name} 실패: ${String((e as Error).message).slice(0, 200)}`); continue; }
  const textPart = res.content.find((c) => c.type === "text") as { text: string } | undefined;
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(textPart?.text ?? "{}"); } catch { parsed = { summary: textPart?.text }; }
  for (const m of (parsed.mapIds as string[] | undefined) ?? []) touched.add(m);
  const mapId = (call.args as { mapId?: string; patch?: { mapId?: string } }).mapId ?? (call.args as { patch?: { mapId?: string } }).patch?.mapId;
  if (mapId) touched.add(mapId);
  if (call.name === "make_place") touched.add(ctx.currentMapId ?? project.startMapId);
  log.push(`-- ${call.name} ${JSON.stringify(call.args).slice(0, 200)}\n   ok=${parsed.ok} ${String(parsed.summary ?? "").slice(0, 400)}`);
  // --every: 동사마다 그 맵을 찍는다(<tag>-<번호>-<동사>-<맵>.png).
  if (argv.includes("--every") && mapId ? ctx.project.maps[mapId] : argv.includes("--every") && ctx.project.maps[ctx.currentMapId ?? project.startMapId]) {
    const m = ctx.project.maps[mapId ?? ctx.currentMapId ?? project.startMapId]!;
    fs.writeFileSync(path.join(out, `${tag}-${String(i).padStart(2, "0")}-${call.name}-${m.id}.png`), renderMapPng(ctx.project, m, scale).png);
  }
}
for (const mapId of touched) {
  const map = ctx.project.maps[mapId];
  if (!map) continue;
  fs.writeFileSync(path.join(out, `${tag}-${mapId}.png`), renderMapPng(ctx.project, map, scale).png);
  const bare = measureInteriorBareFloor(ctx.project, map);
  log.push(`== ${mapId} ${map.name} ${map.width}x${map.height} bare=${bare?.pct ?? "-"}%`);
}
fs.writeFileSync(path.join(out, `${tag}-log.txt`), log.join("\n"));
fs.writeFileSync(path.join(out, `${tag}-project.json`), JSON.stringify({ maps: Object.fromEntries([...touched].map((m) => [m, ctx.project.maps[m]])) }));
console.log(log.join("\n"));
