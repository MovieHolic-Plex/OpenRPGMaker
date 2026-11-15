// 길목 꼴 탐침(모델 없음): 조수 동사 make_game 으로 이웃 구성이 다른 세계 넷(+ 이웃 없는 길목 둘)을 지어, 길목마다 꼴 · 이웃과 실제로 이어지는지 · 걷는 칸이 모두 닿는지를 잰다.
//   bun scripts/qa/assistant-v2/routeShapeProbe.mts <outDir> --theme mountain|spirit [--keys a,b] [--worlds chain,branch,cross,tee,alone]
// 세계(장소 여덟까지): chain 마을–길목–마을 사슬 · branch 막다른 가지와 던전 둘 · cross 네거리와 던전 달린 길 · tee 세 갈래 둘 · alone 이웃 없는 길목 둘.
// 손으로 놓는 것 없음(write_blueprint → make_game, alone 은 장소 빌더). 꼴은 연결 자료가 정한다 — 이 탐침은 갈래(theme)만 적는다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs.ts";
import { V2Session } from "../../../src/ai/v2/turn/session.ts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { isRoadGround } from "../../../src/ai/v2/place/surface.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const out = argv[0] ?? "qa-runs/v2scratch/route-shapes";
const opt = (name: string, d: string): string => { const i = argv.indexOf(`--${name}`); return i >= 0 ? String(argv[i + 1]) : d; };
const theme = opt("theme", "mountain");
const keys = opt("keys", "amber,cobalt").split(",");
const only = opt("worlds", "chain,branch,cross,tee,alone").split(",");
process.env.OPRN_V2_MAKE_GAME = "1";
fs.mkdirSync(out, { recursive: true });

type Side = "north" | "south" | "east" | "west";
type P = { key: string; kind: "village" | "route" | "dungeon"; from?: string; side?: Side; dungeonType?: string };
const V = (key: string, from?: string, side?: Side): P => ({ key, kind: "village", ...(from ? { from } : {}), ...(side ? { side } : {}) });
const R = (key: string, from: string, side: Side): P => ({ key, kind: "route", from, side });
const D = (key: string, from: string, dungeonType: string): P => ({ key, kind: "dungeon", from, dungeonType });
const WORLDS: Record<string, P[]> = {
  chain: [V("v0"), R("r1", "v0", "north"), V("v1", "r1", "north"), R("r2", "v0", "east"), R("r3", "r2", "east"), V("v2", "r3", "east")],
  branch: [V("v0"), R("r1", "v0", "east"), D("d1", "r1", "cave"), R("r2", "v0", "south"), R("r3", "r2", "south"), R("r4", "v0", "west"), D("d2", "r4", "temple")],
  cross: [V("v0"), R("r1", "v0", "north"), V("v1", "r1", "north"), V("v2", "r1", "east"), R("r2", "r1", "west"), R("r3", "v0", "south"), R("r4", "r3", "south"), D("d1", "r3", "catacomb")],
  tee: [V("v0"), R("r1", "v0", "north"), V("v1", "r1", "north"), R("r2", "r1", "east"), V("v2", "r2", "east"), R("r3", "r2", "south"), R("r4", "v0", "west"), V("v3", "r4", "west")],
};
const NAME: Record<string, string> = { v0: "버들 마을", v1: "윗마을", v2: "건넛마을", v3: "서쪽 마을", r1: "첫째 길목", r2: "둘째 길목", r3: "셋째 길목", r4: "넷째 길목", r5: "다섯째 길목", d1: "옛 굴", d2: "잊힌 신전" };
const KINDS: readonly { kind: string; who?: string }[] = [{ kind: "talk", who: "촌장 하르" }, { kind: "find" }, { kind: "choice", who: "떠돌이 상인 미라" }, { kind: "puzzle" }, { kind: "battle", who: "문지기 그림자" }, { kind: "find" }];
// 청사진의 종류 칸: 한 종류는 두 번까지라(청사진 관문) 마을·길목 종류를 번갈아 적는다 — 길목의 갈래는 make_game 명세(theme)가 정한다.
const bpKind = (q: P, all: readonly P[]): string => {
  const nth = all.filter((x) => x.kind === q.kind).indexOf(q);
  return q.kind === "village" ? ["village", "port", "swamp-village"][nth % 3]! : q.kind === "route" ? ["mountain-trail", "spirit-forest"][nth % 2]! : q.dungeonType!;
};
const OPP: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };

type Transfer = { mapId: string; x: number; y: number };
function transfers(node: unknown, acc: Transfer[] = []): Transfer[] {
  if (Array.isArray(node)) node.forEach((n) => transfers(n, acc));
  else if (node && typeof node === "object") {
    const r = node as Record<string, unknown>;
    if (r.kind === "transfer" && typeof r.mapId === "string") acc.push(r as unknown as Transfer);
    for (const v of Object.values(r)) if (v && typeof v === "object") transfers(v, acc);
  }
  return acc;
}
const gatesTo = (from: GameMap, toId: string) => from.events.flatMap((e) => { const t = transfers([e.pages ?? [], (e as { commands?: unknown }).commands ?? []]).find((q) => q.mapId === toId); return t ? [{ x: e.x, y: e.y, t }] : []; });
function flood(p: Project, map: GameMap, from: { x: number; y: number }): Set<number> {
  const W = map.width, seen = new Set<number>([from.y * W + from.x]), q = [from.y * W + from.x];
  for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, k = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= map.height || seen.has(k) || !canMove(p, map, x, y, nx, ny)) continue; seen.add(k); q.push(k); } }
  return seen;
}

let offSide = 0;
type Row = { id: string; key: string; world: string; route: string; size: string; shape: string; variant: string; hero: string; neighbours: string; linked: string; linksOk: boolean; islands: number; whole: boolean; side: string; warn: string };
const rows: Row[] = [];
const measure = (p: Project, map: GameMap, state: Record<string, unknown>, id: string, key: string, world: string, route: string, neigh: { name: string; kind: string; mapId?: string; side?: Side }[], warn: string) => {
  const entry = state.entry as { x: number; y: number };
  const seen = flood(p, map, entry);
  let lost = 0; for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (!seen.has(y * map.width + x) && isPassable(p, map, x, y)) lost += 1;
  const notes: string[] = []; let ok = true;
  for (const n of neigh) {
    const other = n.mapId ? p.maps[n.mapId] : undefined;
    if (!other) { notes.push(`${n.name}: 맵 없음`); ok = false; continue; }
    const go = gatesTo(map, other.id), back = gatesTo(other, map.id);
    const reach = go.filter((g) => seen.has(g.y * map.width + g.x)).length;
    if (n.kind === "dungeon") {
      const gate = state.dungeonGate as { x: number; y: number } | undefined;
      const atGate = !!gate && go.some((g) => Math.max(Math.abs(g.x - gate.x), Math.abs(g.y - gate.y)) <= 2)   // 갱구 킷의 문 칸은 낸 칸에서 한두 칸 비켜 설 수 있다;
      const good = go.length > 0 && back.length > 0 && reach === go.length && atGate;
      if (!good) ok = false;
      notes.push(`${n.name}(던전): 입구 ${go.length} · 닿음 ${reach} · 길목이 낸 자리 ${atGate ? "맞음" : `아님(낸 자리 ${gate ? `${gate.x},${gate.y}` : "없음"} · 입구 ${go.map((g) => `${g.x},${g.y}`).join(" ")})`} · 돌아오는 이동 ${back.length}`);
    } else {
      const road = go.filter((g) => isRoadGround(p, map, g.x, g.y)).length, land = go.filter((g) => isRoadGround(p, other, g.t.x, g.t.y)).length;
      const onSide = go.filter((g) => n.side === "north" ? g.y === 0 : n.side === "south" ? g.y === map.height - 1 : n.side === "west" ? g.x === 0 : g.x === map.width - 1).length;
      const good = go.length > 0 && back.length > 0 && road === go.length && land === go.length && reach === go.length;   // 청한 변과 다른 변으로 이어진 것은 따로 적는다(마을 쪽에 그 변의 길 어귀가 없을 때 잇기가 다른 변을 쓴다)
      if (onSide !== go.length) offSide += 1;
      if (!good) ok = false;
      notes.push(`${n.name}(${n.kind} ${n.side}): 이동 칸 ${go.length} · 그 변 위 ${onSide} · 길 칸 ${road} · 닿음 ${reach} · 도착이 길 ${land} · 돌아오는 이동 ${back.length}`);
    }
  }
  fs.writeFileSync(path.join(out, `${id}.png`), renderMapPng(p, map).png);
  const row: Row = { id, key, world, route, size: `${map.width}x${map.height}`, shape: String(state.shape ?? "?"), variant: String(state.variant ?? ""), hero: String(state.hero ?? ""), neighbours: neigh.map((n) => `${n.kind}${n.side ? `:${n.side}` : ""}`).join(" ") || "없음",
    linked: notes.join(" / "), linksOk: ok, islands: lost, whole: lost === 0, side: String(state.side ?? ""), warn };
  rows.push(row);
  console.log(`${ok && lost === 0 ? "ok  " : "FAIL"} ${id} ${row.size} 꼴 ${row.shape} · ${row.variant} [${row.hero}] 이웃 ${row.neighbours} · 닿지 않는 걷는 칸 ${lost} · 곁가지 ${row.side}${warn ? ` · ${warn.slice(0, 160)}` : ""}`);
  for (const n of notes) console.log(`       ${n}`);
};

for (const key of keys) for (const world of only) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: key };
  if (world === "alone") {
    // 이웃 없는 길목: 장소 빌더를 바로(make_place 가 부르는 것과 같다) — 변을 적지 않는다.
    const run = createBuildRun(ctx);
    for (const n of [1, 2]) {
      const spec: PlaceSpec = { type: "route" as PlaceSpec["type"], name: `홀로 선 길목 ${n}`, theme, variety: `${key}|alone` };
      const res = builderFor(spec)!.build(run, spec);
      const map = ctx.project.maps[res.mapIds[0] ?? ""];
      if (!res.ok || !map) { console.log(`FAIL ${theme}-${key}-alone-${n} ${res.summary.slice(0, 200)}`); rows.push({ id: `${theme}-${key}-alone-${n}`, key, world, route: `a${n}`, size: "", shape: "?", variant: "", hero: "", neighbours: "없음", linked: res.summary.slice(0, 200), linksOk: false, islands: -1, whole: false, side: "", warn: "" }); continue; }
      measure(ctx.project, map, (res.state ?? {}) as Record<string, unknown>, `${theme}-${key}-alone-${n}`, key, world, `a${n}`, [], res.warnings.join(" | "));
    }
    continue;
  }
  const places = WORLDS[world]; if (!places) continue;
  const session = new V2Session();
  const env: PiAssistantV2Env = {
    ctx, request: { task: "버들항을 배경으로, 길목을 지나 마을과 던전을 잇는 모험 게임 하나 만들어 줘.", provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","route-shape-${theme}-${key}-${world}"]` } as never,
    emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }), render: async () => "", checkpoint: async () => {},
  };
  const tools = createV2Tools(env, session);
  const call = async (name: string, args: unknown): Promise<Record<string, unknown>> => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) return { ok: false, summary: `no tool ${name}` };
    const res = await tool.execute(`c-${name}`, args);
    const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}";
    try { return JSON.parse(text) as Record<string, unknown>; } catch { return { ok: false, summary: text.slice(0, 300) }; }
  };
  const names = places.map((p) => NAME[p.key]!);
  const steps = [0, 1, 2, 3, 4, 5].map((i) => {
    const kind = KINDS[i]!, place = names[Math.min(names.length - 1, i)]!;
    return { id: `s${i + 1}`, ...kind, place, event: kind.who ?? (kind.kind === "puzzle" ? `${place}의 번호 자물쇠` : `${place}의 단서 ${i + 1}`),
      action: `${place}에서 ${kind.kind === "battle" ? "문지기와 싸워 이긴다" : kind.kind === "puzzle" ? "번호를 맞춘다" : "단서를 찾는다"}`, ...(i ? { needs: `단서 ${i}` } : {}), gives: i === 5 ? "엔딩" : `단서 ${i + 1}`, feeling: "호기심" };
  });
  const bp = await call("write_blueprint", { title: `길목 꼴 시험 ${world}`, genre: "모험", playerGoal: "길목을 지나 마지막 장소까지 가자.", places: places.map((q) => ({ name: NAME[q.key], kind: bpKind(q, places) })), steps, ending: { name: "끝", how: "마지막 단서를 찾았다.", feeling: "안도" } });
  const game = { title: `길목 꼴 시험 ${world}`, places: places.map((p) => ({ key: p.key,
    spec: p.kind === "village" ? { type: "village", name: NAME[p.key] } : p.kind === "route" ? { type: "route", name: NAME[p.key], theme } : { type: "dungeon", name: NAME[p.key], theme: p.dungeonType },
    ...(p.from ? { from: p.from } : {}), ...(p.side ? { side: p.side } : {}) })) };
  const made = await call("make_game", { game });
  console.log(`\n== ${theme} ${key} ${world}: blueprint=${bp.ok} make_game=${made.ok}${bp.ok ? "" : ` ${String(bp.summary).slice(0, 300)}`}${made.ok ? "" : ` ${String(made.summary).slice(0, 300)}`}`);
  for (const line of [...((made.places as string[] | undefined) ?? []), ...((made.links as string[] | undefined) ?? [])]) console.log(`   · ${line.slice(0, 240)}`);
  const p: Project = ctx.project;
  const mapOf = (k: string): GameMap | undefined => Object.values(p.maps).find((m) => m.name === NAME[k]);
  for (const pl of places.filter((q) => q.kind === "route")) {
    const map = mapOf(pl.key);
    const id = `${theme}-${key}-${world}-${pl.key}`;
    if (!map) { console.log(`FAIL ${id} 맵 없음`); rows.push({ id, key, world, route: pl.key, size: "", shape: "?", variant: "", hero: "", neighbours: "", linked: "맵 없음", linksOk: false, islands: -1, whole: false, side: "", warn: "" }); continue; }
    const state = (session.places.get(map.id)?.result.state ?? {}) as Record<string, unknown>;
    const neigh = [{ p: places.find((q) => q.key === pl.from)!, side: OPP[pl.side!] }, ...places.filter((q) => q.from === pl.key).map((q) => ({ p: q, side: q.side }))]
      .map(({ p: q, side }) => ({ name: NAME[q.key]!, kind: q.kind, mapId: mapOf(q.key)?.id ?? Object.values(p.maps).find((m) => m.name.startsWith(NAME[q.key]!))?.id, ...(q.kind === "dungeon" ? {} : { side: side as Side }) }));
    measure(p, map, state, id, key, world, pl.key, neigh, "");
  }
  // 시작 칸에서 이동을 따라 걸어 닿는 장소
  const seenMaps = new Set<string>(), queue: { mapId: string; x: number; y: number }[] = [{ mapId: p.startMapId, x: p.startPos.x, y: p.startPos.y }], done = new Set<string>();
  while (queue.length) {
    const s = queue.pop()!, map = p.maps[s.mapId]; if (!map || done.has(`${s.mapId}:${s.x},${s.y}`)) continue; done.add(`${s.mapId}:${s.x},${s.y}`); seenMaps.add(map.id);
    for (const c of flood(p, map, s)) { const x = c % map.width, y = (c - x) / map.width; for (const e of map.events) if (e.x === x && e.y === y) for (const t of transfers([e.pages ?? [], (e as { commands?: unknown }).commands ?? []])) if (t.mapId !== map.id && !done.has(`${t.mapId}:${t.x},${t.y}`)) queue.push({ mapId: t.mapId, x: t.x, y: t.y }); }
  }
  const got = places.filter((q) => { const m = mapOf(q.key) ?? Object.values(p.maps).find((mm) => mm.name.startsWith(NAME[q.key]!)); return !!m && seenMaps.has(m.id); });
  console.log(`   걸어서 닿는 장소 ${got.length}/${places.length}${got.length === places.length ? "" : ` — 못 닿음: ${places.filter((q) => !got.includes(q)).map((q) => NAME[q.key]).join(" · ")}`}`);
}
fs.writeFileSync(path.join(out, `table-${theme}.json`), JSON.stringify(rows, null, 1));
const count = new Map<string, number>(); for (const r of rows) count.set(r.shape, (count.get(r.shape) ?? 0) + 1);
const n = rows.length, top = Math.max(0, ...count.values());
console.log(`\nSUMMARY ${theme} ${n}장: 꼴 ${[...count].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(" ")} · 가장 많은 꼴 ${top}/${n}${top * 4 > n ? " (1/4 넘음)" : ""} · 이웃과 이어짐 ${rows.filter((r) => r.linksOk).length}/${n} · 걷는 칸 모두 닿음 ${rows.filter((r) => r.whole).length}/${n} · 청한 변이 아닌 변으로 이어진 연결 ${offSide} · 맵 꼴 ${[...new Set(rows.map((r) => r.size))].join(" ")}`);
