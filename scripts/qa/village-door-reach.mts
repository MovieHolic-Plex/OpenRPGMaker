// 마을의 건물 문·이벤트가 시작 칸(큰길이 드는 입구)에서 걸어 닿는지 센다 — 그림도 프로젝트 사본도 쓰지 않는다(숫자만 찍는다).
// 사용: bun scripts/qa/village-door-reach.mts [--salts 6] [--json 파일]
//   1) 실모델 확인 빌드 r5 «물레방아가 멈춘 날» 의 기록된 마을 요청(조수가 자리를 준 강가 마을 — 언덕 위 탑집 문이 갇혔다)을 씨앗을 바꿔 가며 다시 짓는다(첫 씨앗이 그 판의 것).
//   2) 탐침의 요청 열 가지(자동 배치)를 소금마다, 게임 열쇠 없이 한 번 · 열쇠를 주어 한 번(그 게임의 기물이 더 놓인다) 짓는다.
// 닿는지는 엔진의 걸음(canMove — 통행·단·경사로)으로 입구에서 번져 본다. 문 = 놓인 건물의 문 앞 칸(buildingEntrances). 이벤트 = 그 칸이나 이웃 칸.
import fs from "node:fs";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { canMove, isPassable } from "../../src/project/collision.ts";
import { buildingEntrances } from "../../src/ai/v2/place/entrances.ts";
import { villageArgs } from "../../src/ai/v2/place/builders/village.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const SALTS = Math.max(1, Number(arg("salts", "6")));
const R5: any = { type: "village", name: "물레강 마을", theme: "river", size: "medium", hints: { kind: "mill-hamlet", water: "river", landform: "flat", houseCount: 5, roofs: "red", terrainSeed: 44829,
  layout: { gather: { x: 17, y: 30 }, landmark: { x: 18, y: 6 }, anchor: { x: 24, y: 28 }, work: { x: 15, y: 22 }, houses: [{ x: 24, y: 20, kind: "medium" }, { x: 32, y: 22, kind: "small" }, { x: 32, y: 32, kind: "large" }, { x: 22, y: 38, kind: "small" }, { x: 30, y: 42, kind: "medium" }],
    fields: [{ x: 17, y: 44 }, { x: 26, y: 45 }], orchards: [{ x: 34, y: 38 }], pastures: [{ x: 30, y: 5 }], forests: [{ x: 36, y: 28 }, { x: 14, y: 12 }], props: [{ x: 20, y: 26 }, { x: 14, y: 33 }], exits: ["east"] }, width: 38, height: 48 } };
const R5_KEY = JSON.stringify(["project", "154683ba-d3cf-4df7-93d2-14f4960debac"]);
const CASES: any[] = [
  { n: 1, spec: { name: "버들 마을", theme: "river", size: "medium" }, seed: 7 },
  { n: 2, spec: { name: "언덕 마을", theme: "river", features: ["hillside"], size: "medium" }, landform: "hill", seed: 11 },
  { n: 3, spec: { name: "산골 마을", theme: "river", features: ["highland", "scatter"], size: "small" }, landform: "slope", seed: 23 },
  { n: 4, spec: { name: "갈매기 포구", theme: "coast", size: "medium" }, seed: 5 },
  { n: 5, spec: { name: "다랑이 마을", theme: "river", features: ["terraces"], size: "large" }, landform: "terraces", seed: 31 },
  { n: 6, spec: { name: "설산 마을", theme: "snow", features: ["hillside"], size: "medium" }, landform: "slope", seed: 13 },
  { n: 7, spec: { name: "모래 우물", theme: "desert", size: "medium" }, landform: "hill", seed: 17 },
  { n: 8, spec: { name: "갈대 늪 마을", theme: "swamp", size: "medium" }, seed: 19 },
  { n: 9, spec: { name: "장터 마을", theme: "river", features: ["plaza"], size: "large" }, seed: 41 },
  { n: 10, spec: { name: "들판 농가", theme: "river", features: ["scatter", "no river"], size: "small" }, settle: "low", seed: 3 },
];
const base = createBlankProject() as any; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);

/** 입구에서 엔진 걸음으로 닿는 칸. */
function reach(project: any, map: any, from: { x: number; y: number }): Uint8Array {
  const W = map.width, H = map.height, seen = new Uint8Array(W * H), q: number[] = [];
  for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]] as const) { const x = from.x + dx, y = from.y + dy; if (x >= 0 && y >= 0 && x < W && y < H && isPassable(project, map, x, y) && !seen[y * W + x]) { seen[y * W + x] = 1; q.push(y * W + x); if (!dx && !dy) break; } }
  for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
      if (canMove(project, map, x, y, nx, ny)) { seen[ny * W + nx] = 1; q.push(ny * W + nx); } } }
  return seen;
}
function count(project: any, map: any, from: { x: number; y: number }) {
  const W = map.width, seen = reach(project, map, from);
  const doors = buildingEntrances(project, map);
  const lostDoors = doors.filter((d) => !seen[d.front.y * W + d.front.x]).map((d) => `${d.kit}@(${d.front.x},${d.front.y})`);
  const events = (map.events ?? []) as { id: string; x: number; y: number }[];
  const lostEvents = events.filter((e) => ![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const x = e.x + dx!, y = e.y + dy!; return x >= 0 && y >= 0 && x < W && y < map.height && seen[y * W + x]; })).map((e) => `${e.id}@(${e.x},${e.y})`);
  return { doors: doors.length, lostDoors, events: events.length, lostEvents };
}
const rows: any[] = [];
const add = (group: string, name: string, r: ReturnType<typeof count> | null, note = "") => { rows.push({ group, name, ...(r ?? { doors: 0, lostDoors: [], events: 0, lostEvents: [] }), note }); if (!r || r.lostDoors.length || r.lostEvents.length) console.log(`  ${group} ${name}: ${r ? `못 닿는 문 ${r.lostDoors.join(" ")} · 못 닿는 이벤트 ${r.lostEvents.join(" ")}` : note}`); };

// r5: 조수의 마을 도구가 받은 인자 그대로(villageArgs) + 씨앗을 고정해서 — 자리를 준 마을은 make_place 가 씨앗을 주지 않아 부를 때마다 달라진다(그 판은 52002).
for (let k = 0; k < SALTS * 2; k += 1) {
  const seed = (52002 + k * 7919) % 100000;
  const ctx: any = { project: JSON.parse(baseJson), assistantRun: true, lookKey: R5_KEY };
  const { args: a0 } = villageArgs(R5);
  const r: any = runTool(ctx, "author_beodeul_town", { ...a0, name: R5.name, seed });
  if (!r.ok) { add("r5", `seed ${seed}`, null, `FAIL ${String(r.summary).slice(0, 120)}`); continue; }
  add("r5", `seed ${seed}`, count(ctx.project, ctx.project.maps[r.data.mapId], r.data.entrance));
}
for (const key of ["", "game-alpha"]) for (let salt = 0; salt < SALTS; salt += 1) for (const c of CASES) {
  const { args: a0 } = villageArgs({ type: "village", ...c.spec } as any);
  const ctx: any = { project: JSON.parse(baseJson), ...(key ? { assistantRun: true, lookKey: key } : {}) };
  const r: any = runTool(ctx, "author_beodeul_town", { ...a0, ...(c.landform ? { landform: c.landform } : {}), seed: c.seed + salt, id: `v${c.n}`, name: c.spec.name });
  const group = key ? "auto+key" : "auto", name = `#${c.n} seed ${c.seed + salt}`;
  if (!r.ok) { add(group, name, null, `FAIL ${String(r.summary).slice(0, 120)}`); continue; }
  const d = r.data; add(group, name, count(ctx.project, ctx.project.maps[d.mapId], d.entrance));
}
const sum = (g: string) => { const rs = rows.filter((r) => r.group === g); return { villages: rs.length, doors: rs.reduce((s, r) => s + r.doors, 0), lostDoors: rs.reduce((s, r) => s + r.lostDoors.length, 0), villagesWithLostDoor: rs.filter((r) => r.lostDoors.length).length, events: rs.reduce((s, r) => s + r.events, 0), lostEvents: rs.reduce((s, r) => s + r.lostEvents.length, 0), failed: rs.filter((r) => r.note).length }; };
const total = { r5: sum("r5"), auto: sum("auto"), "auto+key": sum("auto+key") };
for (const [g, t] of Object.entries(total)) console.log(`${g}: 마을 ${t.villages} · 문 ${t.doors} · 못 닿는 문 ${t.lostDoors}(마을 ${t.villagesWithLostDoor}) · 이벤트 ${t.events} · 못 닿는 이벤트 ${t.lostEvents} · 짓기 실패 ${t.failed}`);
console.log(`합계: 못 닿는 문 ${Object.values(total).reduce((s, t) => s + t.lostDoors, 0)} · 못 닿는 이벤트 ${Object.values(total).reduce((s, t) => s + t.lostEvents, 0)}`);
if (arg("json", "")) fs.writeFileSync(arg("json", ""), JSON.stringify({ total, rows }, null, 1));
