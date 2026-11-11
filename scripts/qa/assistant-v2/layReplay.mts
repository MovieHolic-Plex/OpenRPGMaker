// 「이 장소를 깔아 줘」 판의 도구 호출을 모델 없이 지금 코드로 다시 돌린다 — 거절 수·«다음 호출 강제»에 막힌 수·처음 세 번의 장소 호출 안에 깔렸는지를 센다.
//   bun scripts/qa/assistant-v2/layReplay.mts <runRoot> <outDir> [--only a,b] [--render] [--verbose]
// runRoot = map-vqa 깔기 판 폴더(jobs/<id>/before.json.gz · session/turns/NNN.json — toolArgs·toolCalls). 문서 openwiki/harnesses/assistant-capability.md.
// 도구 층은 실제 턴과 같다(createV2Tools → withTodoLoop: 인자 검사·거절 글·다음 호출·할 일 자동 확인). 실행기의 «다음 호출 강제»(SoftToolRequirement)는
// 여기서 흉내 낸다: 강제가 걸린 채 다른 도구(todo 제외)를 부르면 실행하지 않는다. 기록의 호출은 옛 응답에 대한 모델의 반응이라, 고친 코드에서는 앞 호출이
// 통과한 뒤의 호출이 겹칠 수 있다 — 옛 강제 때문에 부른 호출(기록에서 «Not executed: call the X» 바로 다음의 X)은 지금 코드가 강제하지 않으면 건너뛴다.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs.ts";
import { withTodoLoop } from "../../../src/ai/v2/loop/todoTools.ts";
import { V2Session } from "../../../src/ai/v2/turn/session.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { isBareTileMap } from "../../../src/ai/v2/blankStart.ts";
import { isMonsterRequestTurn } from "../../../src/ai/piAgent/monsterGameRequest.ts";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string, d = "") => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const [runRoot, out] = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1] === "--only"));
if (!runRoot || !out) { console.error("usage: layReplay.mts <runRoot> <outDir> [--only a,b] [--render] [--verbose]"); process.exit(2); }
const only = opt("only") ? new Set(opt("only").split(",")) : undefined;
fs.mkdirSync(out, { recursive: true });

/** 장소를 까는 호출 — «처음 세 번 안에 깔렸나» 를 세는 단위. */
const PLACE_CALLS = new Set(["make_place", "edit_place", "review_layout", "build_places", "author_forest_route", "create_map", "make_game"]);
type Rec = { name: string; args: Record<string, unknown> };
type Old = { name: string; ok: boolean; summary?: string; modelText?: string };

/** 시작 칸에서 걸어 닿는 칸 수(4방향). */
function reachFrom(project: Project, map: GameMap, sx: number, sy: number): number {
  if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height || !isPassable(project, map, sx, sy)) return 0;
  const seen = new Uint8Array(map.width * map.height); seen[sy * map.width + sx] = 1;
  const q = [sy * map.width + sx]; let n = 0;
  while (q.length) {
    const i = q.pop()!; n++;
    const x = i % map.width, y = (i - x) / map.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + dx, Y = y + dy, j = Y * map.width + X;
      if (X < 0 || Y < 0 || X >= map.width || Y >= map.height || seen[j] || !isPassable(project, map, X, Y)) continue;
      seen[j] = 1; q.push(j);
    }
  }
  return n;
}
/** 시작이 깔린 장소 위의 걷는 칸이고 그 맵 걷는 칸의 절반 넘게 닿는가. */
function startState(project: Project): { laid: boolean; note: string } {
  const map = project.maps[project.startMapId];
  if (!map) return { laid: false, note: "no start map" };
  if (isBareTileMap(map)) return { laid: false, note: `start on the blank map ${map.id}` };
  let walk = 0;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) walk++;
  const reach = reachFrom(project, map, project.startPos.x, project.startPos.y);
  if (!reach) return { laid: false, note: `start (${project.startPos.x},${project.startPos.y}) on ${map.name} is not walkable` };
  if (reach * 2 < walk) return { laid: false, note: `start (${project.startPos.x},${project.startPos.y}) reaches ${reach}/${walk} walkable cells` };
  return { laid: true, note: `${map.name} ${map.width}x${map.height} start (${project.startPos.x},${project.startPos.y}) reach ${reach}/${walk}` };
}

const rows: Record<string, unknown>[] = [];
for (const job of fs.readdirSync(path.join(runRoot, "jobs")).sort()) {
  if (only && !only.has(job)) continue;
  const dir = path.join(runRoot, "jobs", job);
  const turnsDir = path.join(dir, "session/turns");
  if (!fs.existsSync(turnsDir) || !fs.existsSync(path.join(dir, "before.json.gz"))) continue;
  // make_place 의 무작위 salt 를 고정한다 — 전/후가 같은 배치에서 출발하게.
  let seed = 12345;
  Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
  // before.json.gz 는 타일셋을 뺀 사본이다(턴 전 = 새 빈 프로젝트) — 타일셋은 새 빈 프로젝트의 것을 쓴다.
  const slim = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, "before.json.gz"))).toString("utf8")) as Partial<Project>;
  const project = { ...createBlankProject(), ...slim } as Project;
  const turns = fs.readdirSync(turnsDir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(turnsDir, f), "utf8")) as { input: string; toolArgs?: Rec[]; toolCalls?: Old[] });
  const task = turns[0]?.input ?? "";
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: isMonsterRequestTurn(task) };
  const session = new V2Session();
  let pref: string | undefined;
  const env = {
    ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never,
    emit: () => {}, record: () => {},
    sideChat: async () => JSON.stringify({ score: 7, majors: [] }),
    checkpoint: async () => {},
    preferToolNextTurn: (toolName: string) => { pref = toolName; },
    clearToolPreference: () => { pref = undefined; },
  } as unknown as PiAssistantV2Env;
  const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  const log: string[] = [`# ${job} — ${task}`];
  let refusals = 0, placeRefusals = 0, blocked = 0, skippedForced = 0, missing = 0, placeCalls = 0, n = 0;
  let within3: { laid: boolean; note: string } | undefined;
  const firstRefusal: string[] = [];
  const oldStats = { refusals: 0, placeRefusals: 0, blocked: 0 };
  // 기록의 맵 id → 재생의 맵 id. 새 맵의 id 는 판마다 다르다 — 같은 호출이 양쪽에서 성공했으면 결과에 나온 id 를 차례로 짝지어, 뒤 호출의 인자를 옮긴다.
  const idMap = new Map<string, string>();
  const mapIdsIn = (text: string) => [...new Set(text.match(/map_[0-9a-f]{8}-[0-9a-f-]{27}(?:_r\d+)?/gu) ?? [])];
  const remap = (args: Record<string, unknown>): Record<string, unknown> => {
    if (!idMap.size) return args;
    let json = JSON.stringify(args);
    for (const [from, to] of idMap) json = json.split(from).join(to);
    return JSON.parse(json) as Record<string, unknown>;
  };
  for (const turn of turns) {
    const calls = turn.toolArgs ?? [], olds = turn.toolCalls ?? [];
    for (let k = 0; k < calls.length; k++) {
      const call = calls[k]!, old = olds[k];
      const oldText = String(old?.modelText || old?.summary || "");
      const oldBlocked = /Not executed: call the `(\w+)`/u.exec(oldText)?.[1];
      if (old && !old.ok && call.name !== "todo") { if (oldBlocked) oldStats.blocked++; else { oldStats.refusals++; if (PLACE_CALLS.has(call.name)) oldStats.placeRefusals++; } }
      // 옛 강제 때문에 부른 호출: 바로 앞 기록이 «X 를 불러라» 로 막혔고 이 호출이 X 인데, 지금은 강제가 없다.
      const prevForced = k > 0 ? /Not executed: call the `(\w+)`/u.exec(String(olds[k - 1]?.modelText || olds[k - 1]?.summary || ""))?.[1] : undefined;
      if (prevForced && prevForced === call.name && pref !== call.name) { skippedForced++; log.push(`-- ${k} ${call.name} (old forced call — skipped: nothing forces it now)`); continue; }
      if (pref && call.name !== pref && call.name !== "todo") { blocked++; log.push(`-- ${k} ${call.name} BLOCKED by the pending «${pref}» preference`); continue; }
      const tool = tools.find((t) => t.name === call.name);
      const args = remap(call.args);
      if (!tool) { missing++; log.push(`-- ${k} ${call.name} (not in this run's tools — skipped)`); continue; }
      let body = "";
      const run1 = async () => {
        try { const res = await tool.execute(`r${++n}`, args); return res.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n"); }
        catch (e) { return JSON.stringify({ ok: false, summary: String((e as Error).message) }); }
      };
      body = await run1();
      // 숲길 지시서(prompt/forestBrief.ts)는 세션마다 다르다 — 기록의 설계는 그 판의 지시서를 따른 것이라 여기서는 걸릴 수 있다. 감싸개가 받아 줄 때까지(두 번) 같은 호출을 다시 보낸다.
      for (let again = 0; again < 2 && old?.ok && /ignores the route brief|matches a previous route/u.test(body); again++) body = await run1();
      let failed = false;
      try { const j = JSON.parse(body.split("\n")[0]!) as { ok?: boolean; notFailure?: boolean }; failed = j.ok === false && j.notFailure !== true; } catch { failed = /^\s*(Rejected:|\[Argument check|\[Repeated call)/u.test(body) || /"ok":false/u.test(body.slice(0, 40)); }
      if (!failed && old?.ok) { const was = mapIdsIn(oldText).filter((id) => !JSON.stringify(call.args).includes(id)), now = mapIdsIn(body).filter((id) => !JSON.stringify(args).includes(id)); if (was.length === now.length) was.forEach((id, i) => { if (id !== now[i]) idMap.set(id, now[i]!); }); }
      if (failed && call.name !== "todo") { refusals++; if (PLACE_CALLS.has(call.name)) placeRefusals++; if (firstRefusal.length < 1) firstRefusal.push(`${call.name}: ${body.slice(0, 700)}`); }
      log.push(`-- ${k} ${call.name} ${failed ? "REFUSED" : "ok"}${old ? ` (was ${old.ok ? "ok" : oldBlocked ? "blocked" : "refused"})` : ""}\n   ${body.slice(0, flag("verbose") ? 3000 : 500).replace(/\n/gu, "\n   ")}`);
      if (PLACE_CALLS.has(call.name)) { placeCalls++; if (placeCalls === 3) within3 = startState(ctx.project); }
    }
  }
  if (!within3) within3 = startState(ctx.project);
  const end = startState(ctx.project);
  const p = ctx.project;
  const maps = Object.values(p.maps).map((m) => `${m.name} ${m.width}x${m.height}${isBareTileMap(m) ? " (blank)" : ""}${m.id === p.startMapId ? " *start" : ""}`);
  const blankLeft = Object.values(p.maps).some((m) => isBareTileMap(m));
  log.push(`== recorded: refusals ${oldStats.refusals} (place calls ${oldStats.placeRefusals}) blocked ${oldStats.blocked} | replay: refusals ${refusals} (place calls ${placeRefusals}) blocked ${blocked} skipped-forced ${skippedForced} missing-tool ${missing}`);
  log.push(`== within 3 place calls: ${within3.laid ? "LAID" : "not laid"} — ${within3.note}`);
  log.push(`== end: ${end.laid ? "LAID" : "not laid"} — ${end.note} · maps: ${maps.join(" | ")}`);
  fs.writeFileSync(path.join(out, `${job}.log`), log.join("\n"));
  if (flag("render")) for (const m of Object.values(p.maps)) fs.writeFileSync(path.join(out, `${job}--${(m.name ?? m.id).replace(/[^\p{L}\p{N}]+/gu, "_")}-${m.id.slice(-4)}.png`), renderMapPng(p, m).png);
  rows.push({ job, oldRefusals: oldStats.refusals, oldPlaceRefusals: oldStats.placeRefusals, oldBlocked: oldStats.blocked, refusals, placeRefusals, blocked, skippedForced, laidIn3: within3.laid, laidEnd: end.laid, blankLeft, start: `${p.startMapId}(${p.startPos.x},${p.startPos.y})`, note: end.note, maps, firstRefusal: firstRefusal[0] ?? "" });
  console.log(`${job.padEnd(22)} place-call refusals ${String(oldStats.placeRefusals).padStart(2)}→${String(placeRefusals).padStart(2)} · all refusals ${String(oldStats.refusals).padStart(2)}→${String(refusals).padStart(2)} · blocked ${String(oldStats.blocked).padStart(2)}→${String(blocked).padStart(2)} · in3 ${within3.laid ? "LAID" : "----"} · end ${end.laid ? "LAID" : "----"}${blankLeft ? " · blank map left" : ""} · ${end.note}`);
}
const sum = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
const total = { jobs: rows.length, recordedPlaceRefusals: sum("oldPlaceRefusals"), recordedRefusals: sum("oldRefusals"), recordedBlocked: sum("oldBlocked"), placeRefusals: sum("placeRefusals"), refusals: sum("refusals"), blocked: sum("blocked"), laidIn3: rows.filter((r) => r.laidIn3).length, laidEnd: rows.filter((r) => r.laidEnd).length, blankLeft: rows.filter((r) => r.blankLeft).length };
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify({ total, rows }, null, 1));
console.log(`\nTOTAL ${JSON.stringify(total)}`);
