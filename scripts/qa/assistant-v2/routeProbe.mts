// 길목(통행 지역) 탐침(모델 없음): 길 도구·조수 빌더로 씨앗 여러 개를 지어 1배 PNG 와 닿는 길 표를 쓴다.
//   bun scripts/qa/assistant-v2/routeProbe.mts <outDir> --mode wild|forest|place [--theme mountain|spirit] [--seeds 1-20] [--keys a,b,c] [--size medium] [--feature bridge] [--exits west,east] [--one-game]
//   · wild   = author_wild_route 를 바로(지금 main 의 «마을 사이 길»; --theme 를 주면 같은 크기·같은 씨앗의 새 길목), forest = author_forest_route(조수가 직접 부르는 숲길)
//   · place  = 조수 빌더(make_place 가 부르는 것과 같은 builderFor(spec).build) — 손으로 놓는 것 없음
// 표(table.json · 표준 출력): 맵마다 가장자리 둘이 길로 이어지는가 · 걷는 칸이 모두 닿는가 · 짜임·주인공 볼거리.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";

const argv = process.argv.slice(2);
const out = argv[0] ?? "qa-runs/v2scratch/routes";
const opt = (name: string, d: string): string => { const i = argv.indexOf(`--${name}`); return i >= 0 ? String(argv[i + 1]) : d; };
const mode = opt("mode", "place");
const theme = opt("theme", "mountain");
const size = opt("size", "medium");
const feature = opt("feature", "");
const exitsOpt = opt("exits", "south,north").split(",");
const themed = argv.includes("--theme");
const [s0, s1] = opt("seeds", "1-20").split("-").map(Number);
const seeds = Array.from({ length: (s1 ?? s0!) - s0! + 1 }, (_, i) => s0! + i);
const keys = opt("keys", "").split(",").filter(Boolean);
fs.mkdirSync(out, { recursive: true });

type Row = { id: string; seed: number; key: string; ok: boolean; map: string; size: string; walk: number; reached: number; islands: number; exitsJoined: boolean; edgeRoad: string; variant: string; layout: string; hero: string; side: string; kits: number; free: number; warn: string; relief: string; single: number; repeat: number; kitMax: number; forest: number };

/** 걷는 칸 덩이들 — 첫 칸(들어오는 가장자리)에서 닿는 칸 수와 닿지 않는 덩이 수. */
function reach(project: Project, map: GameMap, from: { x: number; y: number }): { walk: number; reached: number; islands: number; seen: Set<number> } {
  const W = map.width, H = map.height;
  const flood = (sx: number, sy: number, seen: Set<number>): number => {
    const q = [sy * W + sx]; seen.add(q[0]!); let n = 0;
    for (let h = 0; h < q.length; h += 1) {
      const c = q[h]!, x = c % W, y = (c - x) / W; n += 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || !canMove(project, map, x, y, nx, ny)) continue;
        seen.add(k); q.push(k);
      }
    }
    return n;
  };
  const seen = new Set<number>();
  const reached = isPassable(project, map, from.x, from.y) ? flood(from.x, from.y, seen) : 0;
  let walk = reached, islands = 0;
  const all = new Set(seen);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (all.has(y * W + x) || !isPassable(project, map, x, y)) continue;
    walk += flood(x, y, all); islands += 1;
  }
  return { walk, reached, islands, seen };
}

const rows: Row[] = [];
// --one-game: 씨앗 스무 개를 한 게임(한 프로젝트) 안에서 차례로 짓는다 — 그 게임이 이미 쓴 가짓수를 피하는지 본다.
const oneGame = argv.includes("--one-game");
let shared: ReturnType<typeof createBlankProject> | undefined;
for (const key of keys.length ? keys : [""]) for (const seed of seeds) {
  const id = `${mode}${mode === "place" || (mode === "wild" && themed) ? `-${theme}` : ""}${key ? `-${key}` : ""}-s${String(seed).padStart(2, "0")}`;
  const project = oneGame && shared ? shared : createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true, ...(key ? { lookKey: key } : {}) };
  const run = createBuildRun(ctx);
  let mapId = "", entry: { x: number; y: number } | undefined, exit: { x: number; y: number } | undefined, warn = "", ok = false;
  let variant = "", layout = "", hero = "", side = "", free = 0, relief = "", single = 0, repeat = 0, kitMax = 0;
  const take = (d: { relief?: string; pathSteps?: { single: number; repeat: number }; kitMax?: number }) => { relief = d.relief ?? ""; single = d.pathSteps?.single ?? 0; repeat = d.pathSteps?.repeat ?? 0; kitMax = d.kitMax ?? 0; };
  try {
    if (mode === "wild") {
      const W = 28, H = 36;
      run.call("create_map", { id: "map_route", name: "길", width: W, height: H, tilesetId: "beodeul_city" });
      entry = { x: 14, y: H - 1 }; exit = { x: 14, y: 0 };
      const r = themed ? run.call("author_wild_route", { mapId: "map_route", theme, sides: ["south", "north"], seed }) : run.call("author_wild_route", { mapId: "map_route", exits: [entry, exit], seed });
      if (themed) { take((r.data ?? {}) as never); const d = (r.data ?? {}) as { entry?: { x: number; y: number }; exit?: { x: number; y: number }; variant?: string; layout?: string; hero?: string; side?: string }; entry = d.entry ?? entry; exit = d.exit ?? exit; variant = d.variant ?? ""; layout = d.layout ?? ""; hero = d.hero ?? ""; side = d.side ?? ""; }
      ok = r.ok; mapId = "map_route"; warn = [r.ok ? "" : r.summary, ...(r.warnings ?? [])].join(" | ");
    } else if (mode === "forest") {
      run.call("create_map", { id: "map_from", name: "마을", width: 30, height: 24, tilesetId: "beodeul_city" });
      const r = run.call("author_forest_route", { fromMapId: "map_from", side: "north", count: 2, seed });
      ok = r.ok; warn = [r.ok ? "" : r.summary].join(" | ");
      const m = ((r.data as { maps?: { mapId: string; entry: { x: number; y: number }; exit: { x: number; y: number } | null }[] } | undefined)?.maps ?? [])[0];
      if (m) { mapId = m.mapId; entry = m.entry; exit = m.exit ?? undefined; }
    } else {
      const spec: PlaceSpec = { type: "route" as PlaceSpec["type"], name: `길목 ${seed}`, theme, size: size as PlaceSpec["size"], salt: seed, variety: `${key || "probe"}|route-probe${oneGame ? "" : `-${seed}`}`, exits: exitsOpt as PlaceSpec["exits"], ...(feature ? { features: [feature] } : {}) };
      const builder = builderFor(spec);
      if (!builder) throw new Error("route 빌더가 없다");
      const res = builder.build(run, spec);
      ok = res.ok; mapId = res.mapIds[0] ?? ""; warn = [res.ok ? "" : res.summary, ...res.warnings].join(" | ");
      const st = (res.state ?? {}) as { entry?: { x: number; y: number }; exit?: { x: number; y: number }; variant?: string; layout?: string; hero?: string; side?: string; freeSpots?: unknown[] };
      entry = st.entry ?? (res.entrance ? { x: res.entrance.x, y: res.entrance.y } : undefined); exit = st.exit;
      take((res.state ?? {}) as never);
      variant = st.variant ?? ""; layout = st.layout ?? ""; hero = st.hero ?? ""; side = st.side ?? ""; free = st.freeSpots?.length ?? 0;
    }
  } catch (e) { warn = `ERR ${(e as Error).stack?.slice(0, 400)}`; }
  if (oneGame) shared = ctx.project;
  const map = ctx.project.maps[mapId];
  if (!map || !entry) { rows.push({ id, seed, key, ok: false, map: mapId, size: "", walk: 0, reached: 0, islands: 0, exitsJoined: false, edgeRoad: "", variant, layout, hero, side, kits: 0, free, warn, relief, single, repeat, kitMax, forest: 0 }); console.log(`== ${id} FAIL ${warn.slice(0, 300)}`); continue; }
  fs.writeFileSync(path.join(out, `${id}.png`), renderMapPng(ctx.project, map).png);
  const r = reach(ctx.project, map, entry);
  const exitsJoined = !!exit && r.seen.has(exit.y * map.width + exit.x);
  const edge = (c: { x: number; y: number } | undefined) => !c ? "-" : c.y === 0 ? "N" : c.y === map.height - 1 ? "S" : c.x === 0 ? "W" : c.x === map.width - 1 ? "E" : "안";
  const kits = (map.structurePlacements ?? []).length;
  // 폭포 뒤 길: 물 장막 밑 여섯 칸을 막으면 건너편에 닿지 않아야 한다(돌아가는 길이 없다)
  if (hero === "rainbow-falls") {
    const at = ((ctx.project.maps[mapId]?.locations ?? []).find((l) => (l.tags ?? []).includes("route-variant")) ?? { x: 0, y: 0 }) as { x: number; y: number };
    const W = map.width, wall = new Set<number>(); for (const y of [at.y + 3, at.y + 4]) for (let i = 2; i <= 4; i += 1) wall.add(y * W + at.x + i);
    const q = [entry.y * W + entry.x], got = new Set(q);
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= map.height || got.has(k) || wall.has(k) || !canMove(ctx.project, map, x, y, nx, ny)) continue; got.add(k); q.push(k); } }
    warn = `${warn} | 폭포 ${exit && got.has(exit.y * W + exit.x) ? "돌아가는 길 있음(FAIL)" : "뒤로만 지나간다"}`;
  }
  let forest = 0;
  { let shut = 0; for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (!isPassable(ctx.project, map, x, y)) shut += 1; forest = Math.round((shut / (map.width * map.height)) * 100); }
  rows.push({ relief, single, repeat, kitMax, forest, id, seed, key, ok, map: mapId, size: `${map.width}x${map.height}`, walk: r.walk, reached: r.reached, islands: r.islands, exitsJoined, edgeRoad: `${edge(entry)}→${edge(exit)}`, variant, layout, hero, side, kits, free, warn: warn.replace(/^[ |]+|[ |]+$/gu, "") });
  if (process.env.DUMP_KITS) fs.writeFileSync(path.join(out, `${id}.kits.json`), JSON.stringify((map.structurePlacements ?? []).map((p) => p.kitId)));
  console.log(`== ${id} ${ok ? "ok" : "FAIL"} ${map.width}x${map.height} 걷는 칸 ${r.walk} · 닿음 ${r.reached} · 섬 ${r.islands} · 출구 ${exitsJoined ? "이어짐" : "끊김"} ${edge(entry)}→${edge(exit)} · ${variant || "-"} [${layout || "-"} / ${hero || "-"} / ${side || "-"}] 빈 자리 ${free} 기물 ${kits}${warn ? ` · ${warn.slice(0, 200)}` : ""}`);
  console.log(`       단 ${relief || "-"} · 길 계단: 한 칸짜리 ${single} · 같은 계단 이어짐 ${repeat} · 같은 기물 최다 ${kitMax} · 막힌 칸(숲·물·벼랑) ${forest}%`);
}
fs.writeFileSync(path.join(out, `table-${mode}${mode === "place" ? `-${theme}` : ""}.json`), JSON.stringify(rows, null, 1));
const n = rows.length, joined = rows.filter((r) => r.exitsJoined).length, whole = rows.filter((r) => r.walk > 0 && r.walk === r.reached).length;
const count = (f: (r: Row) => string) => { const m = new Map<string, number>(); for (const r of rows) m.set(f(r), (m.get(f(r)) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k || "-"}×${v}`).join(" "); };
console.log(`SUMMARY2 ${mode} ${n}장: 단의 꼴 ${count((r) => r.relief)} · 한 칸짜리 계단이 있는 맵 ${rows.filter((r) => r.single > 0).length} · 같은 계단 이어짐 최다 ${Math.max(0, ...rows.map((r) => r.repeat))} · 같은 기물 최다 ${Math.max(0, ...rows.map((r) => r.kitMax))} · 막힌 칸 비율 최소 ${Math.min(...rows.map((r) => r.forest))}% 가운데 ${[...rows.map((r) => r.forest)].sort((a, b) => a - b)[Math.floor(n / 2)]}%`);
console.log(`SUMMARY ${mode} ${n}장: 가장자리 이어짐 ${joined}/${n} · 걷는 칸 모두 닿음 ${whole}/${n} · 짜임 ${count((r) => r.layout)} · 볼거리 ${count((r) => r.hero)}`);
