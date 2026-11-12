// 조수 v2 «이야기의 물건 · 문» 탐침(모델 없음) — 명세 은행 파일 하나에서 청사진 · 장소 짓기 · 경로 짓기만 실제 동사로 다시 돌리고(끝맺음 단계까지),
// 단계마다 «무엇을 조사하는가»(그 칸의 그림 · 서서 누르는 칸 · 밟는 칸인가)와 맵 사이 문(문 그림 위인가 · 문 앞이 비었나 · 도착 칸 앞에 돌아가는 문이 있나)을 적는다.
//   bun scripts/qa/assistant-v2/storyOnPlaceProbe.mts <명세.json> <결과 폴더> [--no-finish]
// 결과: <결과>/facts.json · facts.txt · maps/<맵 이름>.png(1배, 빨강 = 단계 이벤트 · 파랑 = 이동 칸 · 노랑 = 도착 칸) · project.json.
// 명세 은행 재생(specBank.mts run)은 턴 전체를 돌리고 10분쯤 걸린다 — 이 탐침은 한 판에 1분 안이라 빌더를 고치는 동안 쓴다. 문서: openwiki/assistant-v2.md 「이야기의 물건은 그 장소의 그림이다」.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs.ts";
import { V2Session } from "../../../src/ai/v2/turn/session.ts";
import { runFinishAutoBuild } from "../../../src/ai/v2/finish/index.ts";
import { worldById, worldKind } from "../../../src/ai/v2/place/world.ts";
import { isEntranceArt } from "../../../src/ai/v2/place/entrances.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { GameEvent, GameMap, Project } from "../../../src/project/types.ts";

const [specFile, outDir] = process.argv.slice(2);
if (!specFile || !outDir) { console.error("storyOnPlaceProbe <명세.json> <결과 폴더> [--no-finish]"); process.exit(2); }
const finish = !process.argv.includes("--no-finish");
type SpecCall = { n: string; a: unknown; ok: boolean };
const spec = JSON.parse(fs.readFileSync(specFile, "utf8")) as { id: string; request: string; projectKey: string; title: string; salts: Record<string, number>; turns: { task: string; calls: SpecCall[] }[] };
fs.mkdirSync(path.join(outDir, "maps"), { recursive: true });
process.env.OPRN_V2_ADVISOR = "0";
process.env.OPRN_V2_VQA = "0";

// 같은 명세 = 같은 맵: 난수는 고정하고, 장소 소금(세션의 `salt: Math.floor(Math.random()…)` 줄)에는 그때의 소금을 돌려준다.
let seed = 20261112;
const rng = (): number => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const saltQueue: string[] = [];
Math.random = () => {
  if (saltQueue.length && /sessionHooks/u.test(String(new Error().stack ?? ""))) { const name = saltQueue.shift()!; return ((spec.salts[name] ?? 1) + 0.5) / 1_000_000; }
  return rng();
};
globalThis.fetch = (async () => { throw new Error("탐침: 네트워크 없음"); }) as unknown as typeof fetch;

const calls = spec.turns[0]!.calls;
const lastOk = (name: string, before = calls.length): SpecCall | undefined => calls.slice(0, before).filter((c) => c.n === name && c.ok).at(-1);
const placesAt = calls.findIndex((c) => c.n === "build_places" || c.n === "build_world");
const blueprint = lastOk("write_blueprint", placesAt < 0 ? calls.length : placesAt) ?? lastOk("write_blueprint");
if (!blueprint) { console.error(`${spec.id}: write_blueprint 호출이 없다`); process.exit(2); }
const pathCalls = calls.filter((c) => c.n === "build_blueprint_path" && c.ok);

const project0 = createBlankProject();
(project0 as { meta: { title?: string } }).meta.title = spec.title;
const ctx: ToolContext = { project: project0, currentMapId: project0.startMapId, assistantRun: true };
const session = new V2Session();
const task = spec.turns[0]!.task || spec.request;
const env: PiAssistantV2Env = {
  ctx, request: { task, provider: "openai-compat:opencodex", mapIds: [], project: project0, projectKey: spec.projectKey } as never,
  emit: () => {}, record: () => {},
  sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }),
  render: async () => "", checkpoint: async () => {},
};
const tools = createV2Tools(env, session);
const log: string[] = [];
const say = (line: string): void => { log.push(line); console.log(line); };
const call = async (name: string, args: unknown): Promise<Record<string, unknown>> => {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { ok: false, summary: `no tool ${name}` };
  const res = await tool.execute(`c-${name}`, args);
  const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}";
  try { return JSON.parse(text.split("\n[청사진 진행]")[0]!) as Record<string, unknown>; } catch { return { ok: false, summary: text.slice(0, 600) }; }
};

// 1) 청사진 — 지금 규칙이 한두 번 돌려보내면 같은 것을 다시 보낸다(제품이 두 번 뒤에는 메워서 받는다).
let bp: Record<string, unknown> = {};
for (let i = 0; i < 4 && !ctx.project.gameBlueprint; i++) bp = await call("write_blueprint", blueprint.a);
say(`== ${spec.id} write_blueprint ok=${String(bp.ok)} ${ctx.project.gameBlueprint ? "" : String(bp.summary).slice(0, 300)}`);
// 2) 장소 — 바깥 먼저, 실내 나중(세션의 짓는 차례)으로 소금을 건다.
{
  const world = worldById(ctx.project.gameBlueprint?.setting);
  const listed = ctx.project.gameBlueprint?.places ?? [];
  const indoor = (p: { kind: string }) => !!(world && worldKind(world, p.kind)?.indoor);
  saltQueue.push(...listed.filter((p) => !indoor(p)).map((p) => p.name), ...listed.filter(indoor).map((p) => p.name));
}
const built = await call(tools.some((t) => t.name === "build_places") ? "build_places" : "build_world", {});
saltQueue.length = 0;
say(`build_places ok=${String(built.ok)}`);
for (const line of (built.links as string[] | undefined) ?? []) say(`  · ${line.slice(0, 260)}`);
{ const shown = /Things drawn[^]*?\.(?= |$)/u.exec(String(built.summary ?? ""))?.[0]; if (shown) say(`  ${shown.slice(0, 1600)}`); }
// 3) 경로 — 그때 보낸 대사 그대로. 지금 규칙이 한 번 돌려보내면 같은 것을 한 번 더.
for (const [i, c] of pathCalls.entries()) {
  let res = await call("build_blueprint_path", c.a);
  if (res.ok === false) { say(`build_blueprint_path #${i + 1} bounced: ${String(res.summary).slice(0, 700)}`); res = await call("build_blueprint_path", c.a); }
  say(`build_blueprint_path #${i + 1} ok=${String(res.ok)} ${String(res.summary).slice(0, 1800)}`);
  for (const gap of (res.missingArt as string[] | undefined) ?? []) say(`  gap ${gap}`);
}
// 3b) 사람 놓기 — 그때 보낸 그대로(맵 id 만 이름으로 지금 것에 맞춘다). 곁가지 사람이 건물 뒤에 서는지 본다.
for (const c of spec.turns.flatMap((t) => t.calls).filter((x) => x.n === "add_people" && x.ok)) {
  let text = JSON.stringify(c.a ?? {});
  for (const [old, names] of Object.entries((spec as unknown as { maps?: Record<string, string[]> }).maps ?? {})) {
    const now = Object.values(ctx.project.maps).find((m) => names.includes(m.name ?? ""));
    if (now && now.id !== old) text = text.split(old).join(now.id);
  }
  const res = await call("add_people", JSON.parse(text));
  say(`add_people ok=${String(res.ok)} ${String(res.summary).slice(0, 500)}`);
}
// 4) 끝맺음 자동 단계(제품 순서 그대로).
if (finish) { try { await runFinishAutoBuild(env, session); } catch (e) { say(`finish ERR ${(e as Error).message.slice(0, 300)}`); } }

// ── 재기 ─────────────────────────────────────────────────────────────────────────────────────────
const project = ctx.project as Project;
type Cell = { x: number; y: number };
const inMap = (m: GameMap, c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < m.width && c.y < m.height;
const labelAt = (m: GameMap, c: Cell): string => {
  const meta = (project.tilesets[m.tilesetId]?.tileMeta ?? []) as ({ label?: string } | null | undefined)[];
  const layers = m as unknown as Record<string, ArrayLike<number> | undefined>;
  for (const key of ["upperOverlayTiles", "upperTiles"]) { const t = layers[key]?.[c.y * m.width + c.x]; if (typeof t === "number" && t >= 0 && meta[t]?.label) return meta[t]!.label!; }
  return "";
};
const visible = (g: unknown): boolean => { const x = (g ?? {}) as { sprite?: unknown; appearanceId?: unknown; transparent?: boolean; tileId?: number }; return x.transparent !== true && (!!x.sprite || !!x.appearanceId || (typeof x.tileId === "number" && x.tileId > 0)); };
const transfersIn = (node: unknown, out: { mapId: string; x: number; y: number; direction?: string }[] = []): typeof out => {
  if (Array.isArray(node)) { for (const n of node) transfersIn(n, out); return out; }
  if (!node || typeof node !== "object") return out;
  const o = node as { kind?: string; mapId?: string; x?: number; y?: number; direction?: string };
  if (o.kind === "transfer" && typeof o.mapId === "string" && typeof o.x === "number" && typeof o.y === "number") out.push({ mapId: o.mapId, x: o.x, y: o.y, ...(o.direction ? { direction: o.direction } : {}) });
  for (const v of Object.values(o)) if (v && typeof v === "object") transfersIn(v, out);
  return out;
};
const DIR: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const reachFrom = (m: GameMap, from: Cell): Set<number> => {
  const seen = new Set<number>(), blocked = new Set(m.events.filter((e) => (e.pages ?? []).some((p) => (p.priority ?? "same") === "same") && !transfersIn(e.pages).length).map((e) => e.y * m.width + e.x));
  if (!inMap(m, from) || !isPassable(project, m, from.x, from.y)) return seen;
  const q = [from]; seen.add(from.y * m.width + from.x);
  for (let i = 0; i < q.length; i++) for (const [dx, dy] of Object.values(DIR)) {
    const n = { x: q[i]!.x + dx, y: q[i]!.y + dy }, k = n.y * m.width + n.x;
    if (!inMap(m, n) || seen.has(k) || blocked.has(k) || !isPassable(project, m, n.x, n.y)) continue;
    seen.add(k); q.push(n);
  }
  return seen;
};
const landings = new Map<string, Cell[]>();
for (const m of Object.values(project.maps)) for (const e of m.events) for (const t of transfersIn(e.pages)) landings.set(t.mapId, [...(landings.get(t.mapId) ?? []), { x: t.x, y: t.y }]);
const entryOf = (m: GameMap): Cell => (m.id === project.startMapId ? project.startPos : landings.get(m.id)?.[0]) ?? { x: 0, y: 0 };

interface ThingFact { step: string; kind: string; event: string; map: string; x: number; y: number; drawn: string; own: boolean; walkOn: boolean; standCells: number; glow: boolean; footprint?: string; verdict: string }
const things: ThingFact[] = [];
for (const step of project.gameBlueprint?.steps ?? []) {
  const m = step.built?.mapId ? project.maps[step.built.mapId] : undefined;
  const ev = m?.events.find((e) => e.id === step.built?.eventId);
  if (!m || !ev) { things.push({ step: step.id, kind: step.kind ?? "?", event: step.event, map: step.place, x: -1, y: -1, drawn: "", own: false, walkOn: false, standCells: 0, glow: false, verdict: "이벤트 없음" }); continue; }
  const pages = ev.pages ?? [];
  const own = pages.some((p) => visible(p.graphic));
  const drawn = labelAt(m, ev);
  const walkOn = pages.every((p) => (p.priority ?? "same") !== "same") && isPassable(project, m, ev.x, ev.y);
  const reach = reachFrom(m, entryOf(m));
  const fp = (pages[0] as { footprint?: { width?: number; height?: number } } | undefined)?.footprint;
  const fw = fp?.width ?? 1, fh = fp?.height ?? 1, left = ev.x - Math.floor((fw - 1) / 2), top = ev.y - (fh - 1);
  const body: Cell[] = []; for (let y = top; y <= ev.y; y++) for (let x = left; x < left + fw; x++) body.push({ x, y });
  const stand = new Set<number>();
  for (const c of body) for (const [dx, dy] of Object.values(DIR)) { const n = { x: c.x + dx, y: c.y + dy }; if (inMap(m, n) && reach.has(n.y * m.width + n.x) && !body.some((b) => b.x === n.x && b.y === n.y)) stand.add(n.y * m.width + n.x); }
  const person = step.kind === "talk" || step.kind === "choice" || step.kind === "battle";
  const verdict = person ? (own ? "사람·상대 그림" : "그림 없는 사람")
    : walkOn ? "밟는 칸(발밑)" : own ? `제 그림(이벤트 칩) · 밑그림 «${drawn || "맨바닥"}»` : drawn ? `그 장소의 그림 «${drawn}»` : "맨바닥 · 그림 없음";
  things.push({ step: step.id, kind: step.kind ?? "?", event: String(ev.name ?? step.event), map: m.name ?? m.id, x: ev.x, y: ev.y, drawn, own, walkOn, standCells: stand.size, glow: pages.some((p) => !!(p as { glow?: unknown }).glow), ...(fp ? { footprint: `${fw}×${fh}` } : {}), verdict });
}

interface DoorFact { map: string; x: number; y: number; to: string; tx: number; ty: number; art: string; edge: boolean; frontFree: boolean; arrivalAhead: string }
const doors: DoorFact[] = [];
for (const m of Object.values(project.maps)) for (const e of m.events) {
  const t = transfersIn(e.pages)[0];
  if (!t || t.mapId === m.id) continue;
  const dest = project.maps[t.mapId];
  const edge = e.x === 0 || e.y === 0 || e.x === m.width - 1 || e.y === m.height - 1;
  const art = isEntranceArt(project, m, e.x, e.y) ? "문 그림 칸" : isEntranceArt(project, m, e.x, e.y - 1) ? "문 그림 앞" : edge ? "가장자리" : "맨바닥";
  // 문 앞: 가장자리 문은 맵 안쪽 이웃, 그 밖은 네 이웃 가운데 걸을 수 있는 칸이 하나는 있어야 한다.
  const inward: Cell[] = edge ? [e.x === 0 ? { x: 1, y: e.y } : e.x === m.width - 1 ? { x: m.width - 2, y: e.y } : e.y === 0 ? { x: e.x, y: 1 } : { x: e.x, y: m.height - 2 }] : Object.values(DIR).map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy }));
  const frontFree = inward.some((c) => inMap(m, c) && isPassable(project, m, c.x, c.y) && !m.events.some((o) => o.id !== e.id && o.x === c.x && o.y === c.y && (o.pages ?? []).some((p) => (p.priority ?? "same") === "same")));
  // 도착 칸에서 «들어온 방향 그대로» 세 칸 안에 다른 맵으로 가는 문이 열린 땅 위에 있나(걸어 들어가면 되돌아간다).
  let arrivalAhead = "";
  if (dest) {
    const d = DIR[t.direction ?? ""] ?? undefined;
    for (const [dx, dy] of d ? [d] : []) for (let k = 1; k <= 3; k++) {
      const c = { x: t.x + dx * k, y: t.y + dy * k };
      if (!inMap(dest, c) || !isPassable(project, dest, c.x, c.y)) break;
      const back = dest.events.find((o) => o.x === c.x && o.y === c.y && transfersIn(o.pages).length);
      if (back) { arrivalAhead = `${k}칸 앞 (${c.x},${c.y}) → ${project.maps[transfersIn(back.pages)[0]!.mapId]?.name ?? "?"}`; break; }
    }
  }
  // 도착 칸 바로 곁(한 걸음)에 다른 맵으로 가는 칸이 열린 땅 위(맵 가장자리도 문 그림도 아닌 걷는 칸)에 있나 — 길 한가운데의 되돌아가는 칸.
  if (dest && !arrivalAhead) for (const [dx, dy] of Object.values(DIR)) {
    const c = { x: t.x + dx, y: t.y + dy };
    if (!inMap(dest, c) || !isPassable(project, dest, c.x, c.y) || c.x === 0 || c.y === 0 || c.x === dest.width - 1 || c.y === dest.height - 1) continue;
    if (isEntranceArt(project, dest, c.x, c.y) || isEntranceArt(project, dest, c.x, c.y - 1)) continue;
    const back = dest.events.find((o) => o.x === c.x && o.y === c.y && transfersIn(o.pages).some((x) => x.mapId !== dest.id));
    if (back) { arrivalAhead = `곁 (${c.x},${c.y}) 열린 땅 위 → ${project.maps[transfersIn(back.pages)[0]!.mapId]?.name ?? "?"}`; break; }
  }
  doors.push({ map: m.name ?? m.id, x: e.x, y: e.y, to: dest?.name ?? t.mapId, tx: t.x, ty: t.y, art, edge, frontFree, arrivalAhead });
}

// 사람·상자: 건물 그림 바로 북쪽(지붕 뒤)인가 — 그 칸에서 남쪽 두 칸 안에 건물 키트 그림이 있다.
const buildingTiles = new Map<string, Set<number>>();
const buildingAt = (m: GameMap, c: Cell): boolean => {
  let set = buildingTiles.get(m.tilesetId);
  if (!set) {
    set = new Set<number>();
    const tileset = project.tilesets[m.tilesetId] as { structureKits?: { rows?: { tiles?: number[]; upperTiles?: number[] }[]; parts?: { kind?: string }[] }[] } | undefined;
    for (const kit of tileset?.structureKits ?? []) if (kit.parts?.some((p) => p.kind === "entrance")) for (const row of kit.rows ?? []) for (const t of [...(row.tiles ?? []), ...(row.upperTiles ?? [])]) if (t >= 0) set.add(t);
    buildingTiles.set(m.tilesetId, set);
  }
  if (!inMap(m, c)) return false;
  const layers = m as unknown as Record<string, ArrayLike<number> | undefined>;
  return ["lowerTiles", "upperTiles", "upperOverlayTiles"].some((k) => { const t = layers[k]?.[c.y * m.width + c.x]; return typeof t === "number" && t >= 0 && set!.has(t); });
};
const tucked: string[] = [];
for (const m of Object.values(project.maps)) for (const e of m.events as GameEvent[]) {
  if (transfersIn(e.pages).length || !(e.pages ?? []).some((p) => visible(p.graphic))) continue;
  // 건물 뒤 띠: 남쪽 세 칸 안에 건물, 북쪽 세 칸 안에 맵 끝·막힌 칸(사이는 걷는 칸).
  const openAt = (c: Cell): boolean => inMap(m, c) && isPassable(project, m, c.x, c.y) && !buildingAt(m, c);
  let south = 1, north = 1;
  while (south <= 3 && openAt({ x: e.x, y: e.y + south })) south += 1;
  while (north <= 3 && openAt({ x: e.x, y: e.y - north })) north += 1;
  if (!buildingAt(m, e) && south <= 3 && buildingAt(m, { x: e.x, y: e.y + south }) && north <= 3 && south + north - 1 <= 4) tucked.push(`${m.name} «${e.name ?? e.id.replace(m.id, "<map>")}» (${e.x},${e.y})`);
}

// 바깥 맵의 한 칸 주머니 — 걷는 칸인데 걸어 나갈 이웃이 하나뿐인 칸(소품 사이에 낀 칸).
const pockets: string[] = [];
// 방인가 — 실내 기후이거나, 청사진이 그 장소를 그 세계의 실내 종류로 적었다(구성기 방은 실내 기후가 아닐 수 있다).
const roomNames = ((): Set<string> => {
  const world = worldById(project.gameBlueprint?.setting);
  return new Set((project.gameBlueprint?.places ?? []).filter((p) => !!(world && worldKind(world, p.kind)?.indoor)).map((p) => p.name));
})();
for (const m of Object.values(project.maps)) {
  if ((m as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor" || roomNames.has(m.name ?? "")) continue;
  for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) {
    if (!isPassable(project, m, x, y)) continue;
    if (Object.values(DIR).filter(([dx, dy]) => isPassable(project, m, x + dx, y + dy)).length <= 1) pockets.push(`${m.name}(${x},${y})`);
  }
}
say(`\n── 바깥 맵의 한 칸 주머니 ${pockets.length} ── ${pockets.slice(0, 12).join(" ")}`);
say("\n── 단계가 쓰게 하는 것 ──");
for (const t of things) say(`${t.step} ${t.kind} «${t.event}» @${t.map}(${t.x},${t.y}) — ${t.verdict}${t.footprint ? ` · 몸 ${t.footprint}` : ""} · 서서 누르는 칸 ${t.standCells}${t.glow ? " · 늘 빛남" : ""}`);
say("\n── 맵 사이 문 ──");
for (const d of doors) say(`${d.map}(${d.x},${d.y}) → ${d.to}(${d.tx},${d.ty}) — ${d.art}${d.frontFree ? "" : " · 문 앞 막힘"}${d.arrivalAhead ? ` · 도착 ${d.arrivalAhead}` : ""}`);
say(`\n── 지붕 뒤에 선 사람·상자 ${tucked.length} ──`);
for (const t of tucked) say(t);
const flow = (project.gameBlueprint?.steps ?? []).map((step) => {
  const ev = step.built?.mapId ? project.maps[step.built.mapId]?.events.find((e) => e.id === step.built?.eventId) : undefined;
  const text = JSON.stringify(ev?.pages ?? []);
  return `${step.id}${/"callMapEvent"/u.test(text) ? "→(부름)" : ""}${/"triggerEnding"/u.test(text) ? "⟶엔딩" : ""}`;
}).join(" ");
say(`\n흐름: ${flow}`);
const thingSteps = things.filter((t) => t.kind === "find" || t.kind === "puzzle");
const summary = {
  thingSteps: thingSteps.length,
  onPlaceArt: thingSteps.filter((t) => !t.walkOn && !t.own && !!t.drawn).length,
  ownChip: thingSteps.filter((t) => t.own).length,
  walkOn: thingSteps.filter((t) => t.walkOn).length,
  bare: thingSteps.filter((t) => !t.walkOn && !t.own && !t.drawn).length,
  doors: doors.length, doorsOnBareFloor: doors.filter((d) => d.art === "맨바닥").length, doorsFrontBlocked: doors.filter((d) => !d.frontFree).length, arrivalsFacingReturn: doors.filter((d) => d.arrivalAhead).length,
  tucked: tucked.length, pockets: pockets.length,
};
say(`요약: ${JSON.stringify(summary)}`);

// ── 그림 ─────────────────────────────────────────────────────────────────────────────────────────
const TS = 16;
const box = (png: PNG, c: Cell, rgb: [number, number, number]): void => {
  for (let i = 0; i < TS; i++) for (const [px, py] of [[c.x * TS + i, c.y * TS], [c.x * TS + i, c.y * TS + TS - 1], [c.x * TS, c.y * TS + i], [c.x * TS + TS - 1, c.y * TS + i]] as const) {
    if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
    const k = (py * png.width + px) * 4; png.data[k] = rgb[0]; png.data[k + 1] = rgb[1]; png.data[k + 2] = rgb[2]; png.data[k + 3] = 255;
  }
};
for (const m of Object.values(project.maps)) {
  const plain = renderMapPng(project, m).png;
  const name = String(m.name ?? m.id).replace(/[\\/\s]+/gu, "_");
  fs.writeFileSync(path.join(outDir, "maps", `${name}.png`), plain);
  const png = PNG.sync.read(plain);
  for (const d of doors.filter((x) => x.map === (m.name ?? m.id))) box(png, d, [40, 120, 255]);
  for (const cs of [landings.get(m.id) ?? []]) for (const c of cs) box(png, c, [255, 220, 0]);
  for (const t of things.filter((x) => x.map === (m.name ?? m.id))) box(png, t, [255, 40, 40]);
  fs.writeFileSync(path.join(outDir, "maps", `${name}.marks.png`), PNG.sync.write(png));
}
fs.writeFileSync(path.join(outDir, "facts.json"), JSON.stringify({ id: spec.id, summary, things, doors, tucked, pockets, flow }, null, 1));
fs.writeFileSync(path.join(outDir, "facts.txt"), `${log.join("\n")}\n`);
fs.writeFileSync(path.join(outDir, "project.json"), JSON.stringify(project));
process.exit(0);
