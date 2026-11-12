// 자리 낱말 × 테마 표(모델 없음): 테마 맵마다 조수가 실제로 쓰는 자리 낱말(「한쪽」「구석」「북쪽 벽」「창가」「탁자 옆」…)을
// resolveWhere 로 풀고, 고른 칸이 그 말대로인지를 칩셋이 적어 둔 것(역할·꼬리표·방 키트)으로 따로 판정한다.
//   ok 말대로 · wrong 말과 다른 칸(가구를 벽으로 · 다른 물건을 그 물건으로) · miss 그 물건이 맵에 있는데 못 찾음 · none 기본 자리로 감 · n/a 그 맵에 없는 것
// 판정과 따로, 고른 칸이 계단 곁·앉는 가구 곁인지와 가구의 하나뿐인 앞 칸을 막는지도 센다.
//   bun scripts/qa/assistant-v2/whereMatrix.mts <outDir> --bank <명세 은행 결과 폴더>   저장된 판의 자리 낱말 호출을 그 판의 맵에서 낱말만으로 다시 푼다(아래 bankWords)
//   bun scripts/qa/assistant-v2/whereMatrix.mts <outDir> [테마,테마…]     (WHERE_IMPL=<다른 where.ts 경로> 로 옛 구현을 같은 판정으로 잰다)     문서 openwiki/assistant-v2.md 「자리 낱말도 적힌 것으로」
import fs from "node:fs";
import { isPassable } from "../../../src/project/collision.ts";
import { labelHasWord, labelNames } from "../../../src/project/labelWords.ts";
import { tilesetSurface } from "../../../src/project/tilesetSurface.ts";
import { roomSpecOf } from "../../../src/editor/handInterior/builder.ts";
import { tileLabel } from "../../../src/ai/v2/place/cells.ts";
import { reachableCells } from "../../../src/ai/v2/judge/eventReach.ts";
import { declaredDoorCells } from "../../../src/ai/v2/place/entrances.ts";
import { roadCells } from "../../../src/ai/v2/place/surface.ts";
import type { Footprint, resolveWhere as ResolveWhere } from "../../../src/ai/v2/place/where.ts";
import { sources, type Src } from "./themeSources.mts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
const SEAT_TAGS = new Set(["의자", "걸상", "벤치", "스툴", "탁자", "식탁", "chair", "stool", "bench", "table"]);
const WINDOW_TAGS = new Set(["창", "창문", "전망창", "window", "窓"]);

/** 칩셋이 적어 둔 것으로 만든 칸 표 — 판정자. 고치는 코드(place/where.ts)와 따로 센다. */
function judgeOf(project: any, map: any) {
  const ts = project.tilesets[map.tilesetId];
  const meta = (ts?.tileMeta ?? []) as ({ label?: string; role?: string; tags?: string[] } | undefined)[];
  const spec: any = roomSpecOf(ts);
  const wallT = new Set<number>(), buildT = new Set<number>(), stairT = new Set<number>(tilesetSurface(ts).stairs), seatT = new Set<number>(), winT = new Set<number>();
  meta.forEach((m, t) => {
    if (!m) return;
    if (m.role === "wall" || m.tags?.includes("벽")) wallT.add(t);
    if (m.role === "building" || m.role === "wall" || m.role === "roof") buildT.add(t);
    if (m.tags?.some((tag) => SEAT_TAGS.has(tag))) seatT.add(t);
    if (["창", "창문", "window"].some((w) => labelNames(m.label ?? "", w)) || ((m.role === "wall" || m.role === "terrain") && m.tags?.some((tag) => WINDOW_TAGS.has(tag)))) winT.add(t);
  });
  // 입구를 적어 둔 구조 키트(건물 한 채)의 그림 타일 — 역할을 안 적는 칩셋(버들항·조선)의 건물. 입구 없는 키트는 가구·소품 묶음이다.
  for (const kit of ((ts?.structureKits ?? []) as any[]).filter((k) => (k.parts ?? []).some((pt: any) => pt.kind === "entrance"))) for (const row of kit.rows ?? []) for (const t of [...(row.tiles ?? []), ...(row.upperTiles ?? [])]) {
    if (typeof t === "number" && t >= 0 && meta[t] && (meta[t] as any).passage !== "passable" && meta[t]!.role !== "terrain" && meta[t]!.role !== "empty") buildT.add(t);
  }
  if (spec) {
    for (const wl of Object.values(spec.walls ?? {}) as any[]) for (const t of wl.tiles ?? []) wallT.add(t);
    for (const c of Object.values(spec.ceilings ?? {}) as any[]) for (const t of c ?? []) wallT.add(t);
    wallT.add(spec.void); wallT.add(spec.blank);
    for (const [id, o] of Object.entries(spec.objects ?? {}) as [string, any][]) {
      const into = o.stairs ? stairT : o.use?.includes("sit") ? seatT : o.category === "window" || (o.kind === "hang" && /\bwindow\b/u.test(id)) ? winT : undefined;
      if (into) for (const c of o.cells) if (c[2] >= 0) into.add(c[2]);
    }
    for (const tb of Object.values(spec.tables ?? {}) as any[]) for (const piece of Object.values(tb.pieces ?? {}) as any[]) for (const c of piece) if (c[2] >= 0) seatT.add(c[2]);
  }
  wallT.delete(-1);
  const w = map.width, h = map.height;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const has = (set: Set<number>, x: number, y: number, layers: readonly string[] = LAYERS) => inside(x, y) && layers.some((k) => set.has(map[k]?.[y * w + x] ?? -1));
  const upperObj = (x: number, y: number) => (map.upperTiles?.[y * w + x] ?? -1) >= 0 || (map.upperOverlayTiles?.[y * w + x] ?? -1) >= 0;
  const indoor = map.climate?.mode === "indoor" || (map.locations ?? []).some((l: any) => (l.tags ?? []).includes("hand-layout-room"));
  /** 벽 = 맵 밖(실내) · 물건 없이 막힌 칸 · 물건이 걸려 있어도 바닥층이 벽 타일인 칸 · 건물 그림 칸. */
  const wall = (x: number, y: number) => !inside(x, y) ? indoor : !isPassable(project, map, x, y) && (!upperObj(x, y) || has(wallT, x, y, ["lowerTiles", "lowerOverlayTiles"]) || has(buildT, x, y));
  const reach = reachableCells(project, map);
  const win = (x: number, y: number) => has(winT, x, y);
  /** 창 곁 = 옆 칸이 창이거나, 제 줄·옆 줄 위로 벽면 두 줄 안에 창. */
  const byWindow = (x: number, y: number) => win(x - 1, y) || win(x + 1, y) || [-1, 0, 1].some((dx) => win(x + dx, y - 1) || (wall(x + dx, y - 1) && (win(x + dx, y - 2) || (wall(x + dx, y - 2) && win(x + dx, y - 3)))));
  return { indoor, wall, win, byWindow, reach, inside, upperObj, stair: (x: number, y: number) => has(stairT, x, y), seat: (x: number, y: number) => has(seatT, x, y) };
}

type V = "ok" | "wrong" | "miss" | "none" | "n/a";
interface Row { theme: string; kind: string; indoor: boolean; who: string; word: string; v: V; cell: string; how: string; detail: string; stairs: boolean; seat: boolean; blocks: boolean }

const WHO: Record<string, Footprint | undefined> = { person: undefined, obj1: { w: 1, foot: 1, over: 0 }, obj2: { w: 2, foot: 1, over: 1 } };
const WALL_CASES: [string, string, string[]][] = [
  ["side", "한쪽", ["person", "obj1", "obj2"]], ["corner", "구석", ["person", "obj1"]], ["wallN", "북쪽 벽", ["person", "obj2"]],
  ["wallW", "서쪽 벽", ["person"]], ["wallE", "동쪽 벽", ["person"]], ["window", "창가", ["person", "obj1"]],
];
/** 「X 옆」: [자리 낱말, 그 물건을 가리키는 낱말들]. 조수가 실제로 쓴 꼴(assistant-fable-runs 의 where 1509개)에서. */
const NEAR_CASES: [string, string[]][] = [
  ["탁자 옆", ["탁자", "식탁", "테이블", "table"]], ["침대 옆", ["침대", "bed"]], ["책장 옆", ["책장", "서가", "bookshelf"]], ["카운터 앞", ["카운터", "계산대", "counter"]],
  ["벽난로 앞", ["벽난로", "난로", "fireplace"]], ["계단 옆", ["계단", "stair", "stairs"]], ["우물 옆", ["우물", "well"]], ["술통 옆", ["술통", "barrel", "keg"]],
  ["표지판 옆", ["표지판", "팻말", "이정표", "안내판", "signpost", "sign"]], ["분수 옆", ["분수", "fountain"]], ["화덕 옆", ["화덕", "레인지", "오븐", "stove"]],
  ["상자 옆", ["상자"]], ["책상 옆", ["책상"]], ["책 옆", ["책"]], ["나무 옆", ["나무"]], ["문 옆", ["문"]], ["의자 옆", ["의자"]], ["바 옆", ["카운터", "counter"]], ["길 옆", ["길"]],
];
/** 칩셋이 적어 둔 것으로 판정하는 낱말 — 길(표면 계약) · 문(건물 입구·방 키트 문) · 계단. */
const DECLARED: Record<string, "road" | "door" | "stairs"> = { "길 옆": "road", "문 옆": "door", "계단 옆": "stairs" };

const { resolveWhere } = (await import(process.env.WHERE_IMPL ?? "../../../src/ai/v2/place/where.ts")) as { resolveWhere: typeof ResolveWhere };
const out = process.argv[2]!;
const bankDir = process.argv[3] === "--bank" ? process.argv[4] : undefined;
const only = bankDir ? undefined : process.argv[3]?.split(",");
fs.mkdirSync(out, { recursive: true });
const rows: Row[] = [];

/**
 * 저장된 판(명세 은행)의 자리 낱말 호출 — 모델이 실제로 쓴 낱말을 그 판의 맵에서 낱말만으로 푼다.
 * 왜: 은행 재생은 모델이 낱말과 같이 준 칸(at)을 그대로 써서 낱말 풀이를 거의 안 거친다(107건 가운데 62건). 여기서는 at 을 버린다.
 * 맵은 은행 결과 폴더(specBank.mts run·ab 의 <게임>/project.json — 다 지은 뒤의 맵)에서 이름으로 찾고, 그 호출이 세운 사람은 제 칸을 비운 것으로 친다.
 * 낱말이 자유로워(「광장 한쪽」「연못 옆 정원」) 말대로인지는 판정하지 않는다 — 고른 칸·기본 자리로 감·계단 곁·가구의 하나뿐인 앞 칸을 적어 두 구현을 대조한다.
 */
function bankWords(dir: string): void {
  const PLACING: Record<string, string> = { add_people: "person", add_event: "person", move_event: "person", add_boss_encounter: "person", place_object: "obj1", draw_object: "obj1" };
  const bank = new URL("../../../harness-data/assistant-capability/spec-bank/", import.meta.url).pathname;
  for (const file of fs.readdirSync(bank).filter((f) => f.endsWith(".json")).sort()) {
    const spec = JSON.parse(fs.readFileSync(`${bank}${file}`, "utf8")) as { id: string; maps: Record<string, string[]>; turns: { calls: { n: string; a?: any }[] }[] };
    const asks: { tool: string; mapId: string; word: string; name?: string; hadAt: boolean }[] = [];
    for (const turn of spec.turns) for (const call of turn.calls) {
      if (!PLACING[call.n] || !call.a) continue;
      for (const item of [call.a, ...(Array.isArray(call.a.people) ? call.a.people : [])]) {
        if (typeof item?.where !== "string" || !item.where.trim() || /^\d+\s*,\s*\d+$/u.test(item.where)) continue;
        asks.push({ tool: call.n, mapId: String(item.mapId ?? call.a.mapId ?? ""), word: item.where, ...(typeof item.name === "string" ? { name: item.name } : {}), hadAt: !!item.at && !(item.at.x === 0 && item.at.y === 0) });
      }
    }
    const projectFile = `${dir}/${spec.id}/project.json`;
    if (!asks.length || !fs.existsSync(projectFile)) continue;
    const raw = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    const project = raw.project ?? raw;
    const judges = new Map<string, ReturnType<typeof judgeOf>>();
    for (const ask of asks) {
      const names = spec.maps[ask.mapId] ?? [];
      const map = (Object.values(project.maps) as any[]).find((m) => names.includes(m.name));
      if (!map) { rows.push({ theme: spec.id, kind: names[0] ?? ask.mapId.slice(0, 12), indoor: false, who: PLACING[ask.tool]!, word: ask.word, v: "n/a", cell: "-", how: "", detail: "map not in the replayed game", stairs: false, seat: false, blocks: false }); continue; }
      const J = judges.get(map.id) ?? judgeOf(project, map);
      judges.set(map.id, J);
      const own = ask.name ? map.events.find((e: any) => e.name === ask.name)?.id : undefined;
      const fp = WHO[PLACING[ask.tool]!];
      const r = resolveWhere(project, map, ask.word, { ...(fp ? { footprint: fp } : {}), ...(own ? { exceptId: own } : {}) }) as any;
      const cells = (r.cells ?? [r.cell]) as { x: number; y: number }[];
      const around = cells.flatMap((c) => [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => ({ x: c.x + dx!, y: c.y + dy! }))).filter((n) => J.inside(n.x, n.y));
      rows.push({ theme: spec.id, kind: String(map.name), indoor: J.indoor, who: PLACING[ask.tool]!, word: ask.word, v: r.fallback ? "none" : "ok", cell: `${r.cell.x},${r.cell.y}`, how: String(r.how ?? ""),
        detail: `${ask.tool}${ask.hadAt ? " · the model also gave a cell" : ""}${r.note ? ` · ${String(r.note).slice(0, 90)}` : ""}`, stairs: around.some((n) => J.stair(n.x, n.y)), seat: around.some((n) => J.seat(n.x, n.y)), blocks: false });
    }
    console.log(`${spec.id} ${asks.length} where words`);
  }
  fs.writeFileSync(`${out}/where-bank.json`, JSON.stringify(rows, null, 1));
  console.log(`저장된 판의 자리 낱말 ${rows.length}건 · 기본 자리로 감 ${rows.filter((r) => r.v === "none").length} · 맵 없음 ${rows.filter((r) => r.v === "n/a").length} · 계단 곁 ${rows.filter((r) => r.stairs).length} · 앉는 가구 곁 ${rows.filter((r) => r.seat).length}`);
}

function oneMap(s: Src): void {
  const project = s.project, map = project.maps[s.mapId];
  const J = judgeOf(project, map);
  const labels = (x: number, y: number) => LAYERS.map((k) => tileLabel(project, map, map[k]?.[y * map.width + x])).filter(Boolean);
  const flags = (cells: { x: number; y: number }[]) => {
    const mine = new Set(cells.map((c) => c.y * map.width + c.x));
    const around = cells.flatMap((c) => [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => ({ x: c.x + dx!, y: c.y + dy! }))).filter((n) => J.inside(n.x, n.y) && !mine.has(n.y * map.width + n.x));
    // 곁의 가구 칸(벽 아님)이 다른 쪽으로는 닿을 칸이 없으면 이 자리가 그 가구의 하나뿐인 앞 칸이다.
    const blocks = around.some((n) => J.upperObj(n.x, n.y) && !J.wall(n.x, n.y) && ![[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
      const mx = n.x + dx!, my = n.y + dy!;
      return J.inside(mx, my) && !mine.has(my * map.width + mx) && !!J.reach?.[my * map.width + mx] && !J.upperObj(mx, my);
    }));
    return { stairs: around.some((n) => J.stair(n.x, n.y)), seat: around.some((n) => J.seat(n.x, n.y)), blocks };
  };
  const rec = (who: string, word: string, r: any, v: V, detail: string) => {
    const cells = (r.cells ?? [r.cell]) as { x: number; y: number }[];
    rows.push({ theme: s.theme, kind: s.kind, indoor: J.indoor, who, word, v, cell: `${r.cell.x},${r.cell.y}`, how: String(r.how ?? ""), detail, ...(r.fallback ? { stairs: false, seat: false, blocks: false } : flags(cells)) });
  };
  let anyWindow = false;
  for (let y = 0; y < map.height && !anyWindow; y++) for (let x = 0; x < map.width && !anyWindow; x++) if (J.reach?.[y * map.width + x] && J.byWindow(x, y)) anyWindow = true;

  for (const [id, word, whos] of WALL_CASES) for (const who of whos) {
    const fp = WHO[who];
    const r = resolveWhere(project, map, word, fp ? { footprint: fp } : {});
    if (r.fallback) { rec(who, word, r, id === "window" && !anyWindow ? "n/a" : "none", r.note ?? ""); continue; }
    const feet = (r.cells ?? [r.cell]) as { x: number; y: number }[];
    const topY = fp ? r.cell.y - fp.foot - fp.over + 1 : r.cell.y;
    const N = feet.some((c) => J.wall(c.x, topY - 1) || (!!fp && fp.over > 0 && J.wall(c.x, r.cell.y - fp.foot)));
    const W = feet.some((c) => J.wall(c.x - 1, c.y)), E = feet.some((c) => J.wall(c.x + 1, c.y)), S = feet.some((c) => J.wall(c.x, c.y + 1));
    const sides = `${N ? "N" : ""}${W ? "W" : ""}${E ? "E" : ""}${S ? "S" : ""}` || "-";
    let v: V;
    if (id === "side") v = N || W || E || S ? "ok" : "wrong";
    else if (id === "corner") v = (W || E) && (N || S) ? "ok" : "wrong";
    else if (id === "wallN") v = N ? "ok" : "wrong";
    else if (id === "wallW") v = W ? "ok" : "wrong";
    else if (id === "wallE") v = E ? "ok" : "wrong";
    else v = feet.some((c) => J.byWindow(c.x, c.y)) ? "ok" : anyWindow ? "miss" : /창/u.test(String(r.how)) ? "wrong" : "n/a";
    const beside = v === "wrong" ? ` 곁: ${[[0, -1], [-1, 0], [1, 0], [0, 1]].map(([dx, dy]) => labels(r.cell.x + dx!, r.cell.y + dy!).at(-1) ?? "·").join(" | ").slice(0, 120)}` : "";
    rec(who, word, r, v, `벽 ${sides}${beside}`);
  }

  const roads = roadCells(project, map), doors = declaredDoorCells(project, map);
  const stairCells: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (J.stair(x, y)) stairCells.push({ x, y });
  const within = (c: { x: number; y: number }, cells: { x: number; y: number }[], d: number) => cells.some((o) => Math.max(Math.abs(o.x - c.x), Math.abs(o.y - c.y)) <= d);
  for (const [word, names] of NEAR_CASES) {
    const kind = DECLARED[word];
    let exists = kind === "road" ? roads.size > 0 : kind === "door" ? doors.length > 0 : kind === "stairs" ? stairCells.length > 0 : false;
    for (let i = 0; i < map.width * map.height && !exists; i++) if (labels(i % map.width, Math.floor(i / map.width)).some((l) => names.some((n) => labelHasWord(l, n)))) exists = true;
    const r = resolveWhere(project, map, word, {});
    if (r.fallback || !r.anchor) { rec("person", word, r, exists ? "miss" : "n/a", r.note ?? ""); continue; }
    // 무엇 곁에 섰다고 보고했나 — 「이름표(x,y) 옆」 의 이름표.
    const said = String(r.how ?? "").replace(/\(\d+,\d+\) (옆|앞|뒤|근처)$/u, "");
    const c = r.cell as { x: number; y: number };
    const byDeclared = kind === "road" ? !roads.has(c.y * map.width + c.x) && [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => roads.has((c.y + dy!) * map.width + c.x + dx!))
      : kind === "door" ? within(c, doors, 2) : kind === "stairs" ? within(c, stairCells, 2) : false;
    const ok = byDeclared || names.some((n) => labelHasWord(said, n));
    rec("person", word, r, ok ? "ok" : "wrong", said.slice(0, 70));
  }
}

if (bankDir) { bankWords(bankDir); process.exit(0); }

for await (const s of sources(only ? (t) => only.includes(t) : undefined)) {
  if ("error" in s) { console.log(`build failed ${s.theme}/${s.kind}: ${s.error}`); continue; }
  const t0 = Date.now();
  oneMap(s);
  console.log(`${s.theme}/${s.kind} ${Date.now() - t0}ms`);
}

fs.writeFileSync(`${out}/where-${only?.[0] ?? "all"}.json`, JSON.stringify(rows, null, 1));
const count = (f: (r: Row) => boolean) => rows.filter(f).length;
for (const word of [...WALL_CASES.map((c) => c[1]), ...NEAR_CASES.map((c) => c[0])]) {
  const of = (v: V) => count((r) => r.word === word && r.v === v);
  console.log(`${word.padEnd(8)} ok ${of("ok")} wrong ${of("wrong")} miss ${of("miss")} none ${of("none")} n/a ${of("n/a")}`);
}
console.log(`계단 곁 ${count((r) => r.stairs)} · 앉는 가구 곁 ${count((r) => r.seat)} · 가구의 하나뿐인 앞 칸 ${count((r) => r.blocks)} · 전체 ${rows.length}`);
for (const r of rows.filter((x) => x.v === "wrong" || x.v === "miss")) console.log(`${r.v.padEnd(5)} ${`${r.theme}/${r.kind}`.padEnd(28)} ${r.who.padEnd(6)} ${r.word.padEnd(7)} (${r.cell}) ${r.how.slice(0, 50)} — ${r.detail}`);
