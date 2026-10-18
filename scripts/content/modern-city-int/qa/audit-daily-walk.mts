// 일상 21공간 통행 감사 - 2026-10-19 사용자 「집같은 작은 공간은 통행 안되는 곳도 많은거같음」.
// 공간마다 조수 도구 그대로(build_hand_interior_room) 짓고, 정문 칸에서 런타임 이동 판정(canMove, 방향 비트 포함)으로 BFS 한다.
//   실패 조건: 갇힌 칸(걸을 수 있는데 정문에서 못 가는 칸) · 걸음 칸이 하나도 닿지 않는 방 · 막힌 칸막이 문(문 칸 또는 양쪽 앞 칸) · 닿지 못하는 계단.
//   통학 전동차는 modern_city 견본이 아니라 jp_city 손 도트 견본(program "train-car")을 그대로 쓴다 - 그 맵도 같은 감사로 본다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/audit-daily-walk.mts [--seeds 1,2] [--json out.json] [prog ...]
import { writeFileSync } from "node:fs";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { canMove, isPassable } from "@/project/collision";
import { DAILY_VENUE_PROGRAMS } from "@/editor/handInterior/dailyVenues";
import { JP_CITY_ID } from "@/project/defaults/jpCity";
import roomSpec from "@/assets/modernCityRoomSpec.json";
import jpRoomSpec from "@/assets/jpInteriorSpec.json";

const spec: Record<string, Record<string, { w: number; h: number }>> = { modern_city: roomSpec.objects, [JP_CITY_ID]: jpRoomSpec.objects };

interface Pt { x: number; y: number }
interface RoomRect { id: string; x0: number; y0: number; x1: number; y1: number }
interface Opening extends Pt { a: string; b: string; kind: "h" | "v"; open: boolean }
interface Travel extends Pt { label: string }

const num = (v: unknown): number => { if (typeof v !== "number") throw new Error(`숫자가 아니다: ${String(v)}`); return v; };
const str = (v: unknown): string => { if (typeof v !== "string") throw new Error(`문자열이 아니다: ${String(v)}`); return v; };
const rec = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== "object") throw new Error("객체가 아니다"); return Object.fromEntries(Object.entries(v)); };
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const argv = process.argv.slice(2);
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const seeds = (flag("--seeds") ?? "1").split(",").map(Number);
const jsonOut = flag("--json");
const named = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const DAILY_TRAIN = "train-car";
const programs = named.length ? named : [...Object.keys(DAILY_VENUE_PROGRAMS).filter((p) => p !== "mc_elevator_car"), "mc_department_store", "mc_parking", DAILY_TRAIN];
const tilesetOf = (program: string) => (program === DAILY_TRAIN ? JP_CITY_ID : "modern_city");

const project = createEmptyToolProject("mci");
const out: Record<string, unknown> = {};
let failed = 0;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

for (const program of programs) for (const seed of seeds) {
  const mapId = `${program}-s${seed}`;
  const tileset = tilesetOf(program);
  const r = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset, mapId, name: program, layout: { program, seed } } as never);
  const m = project.maps[mapId];
  if (!m || !r.data || typeof r.data !== "object") { failed++; console.log(`FAIL ${mapId} 지어지지 않았다 ${JSON.stringify(r).slice(0, 300)}`); continue; }
  const data = rec(r.data);
  const layout = data.layout && typeof data.layout === "object" ? rec(data.layout) : {};
  const rooms: RoomRect[] = list(layout.rooms).map((v) => { const o = rec(v); return { id: str(o.id), x0: num(o.x0), y0: num(o.y0), x1: num(o.x1), y1: num(o.y1) }; });
  const openings: Opening[] = list(data.openings).map((v) => { const o = rec(v); return { a: str(o.a), b: str(o.b), x: num(o.x), y: num(o.y), kind: o.kind === "v" ? "v" : "h", open: o.open === true }; });
  const travel: Travel[] = list(data.travel).map((v) => { const o = rec(v); return { label: str(o.label), x: num(o.x), y: num(o.y) }; });
  const entrance: Pt[] = list(data.entrance).map((v) => { const o = rec(v); return { x: num(o.x), y: num(o.y) }; });
  // 막힌 칸을 덮는 기물 이름(발 디딘 줄 w×h) - 어느 가구를 옮길지 바로 보이게.
  const placed = list(data.rebuild && typeof data.rebuild === "object" ? rec(data.rebuild).objects : []).map((v) => rec(v));
  const who = (x: number, y: number) => {
    const hit = placed.find((o) => { const d = spec[tileset]![str(o.id)]; return d && x >= num(o.x) && x < num(o.x) + d.w && y >= num(o.y) && y < num(o.y) + Math.max(1, d.h); });
    if (!hit) return "?";
    const ox = num(hit.x), oy = num(hit.y), rm = rooms.find((r) => ox >= r.x0 && ox <= r.x1 && oy >= r.y0 && oy <= r.y1);
    return `${str(hit.id)}@${ox},${oy}${rm ? ` [${rm.id} ${ox - rm.x0},${oy - rm.y0} of ${rm.x1 - rm.x0 + 1}w]` : ""}`;
  };

  const key = (x: number, y: number) => y * m.width + x;
  const pass = (x: number, y: number) => isPassable(project, m, x, y);
  const seen = new Set<number>();
  const q: Pt[] = entrance.filter((p) => pass(p.x, p.y));
  for (const p of q) seen.add(key(p.x, p.y));
  while (q.length) {
    const p = q.pop()!;
    for (const [dx, dy] of DIRS) {
      const nx = p.x + dx, ny = p.y + dy;
      if (!seen.has(key(nx, ny)) && pass(nx, ny) && canMove(project, m, p.x, p.y, nx, ny)) { seen.add(key(nx, ny)); q.push({ x: nx, y: ny }); }
    }
  }
  const reached = (x: number, y: number) => seen.has(key(x, y));
  const problems: string[] = [];
  let walk = 0;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (pass(x, y)) walk++;
  const bare = (x: number, y: number) => { const i = key(x, y); return (m.lowerOverlayTiles?.[i] ?? -1) < 0 && (m.upperTiles[i] ?? -1) < 0 && (m.upperOverlayTiles?.[i] ?? -1) < 0; };
  const tight: string[] = [];
  for (const room of rooms) {
    const trapped: string[] = [], ghost: string[] = []; let hit = 0, open = 0;
    // 벽면 두 줄(y0, y0+1)은 벽 그림이라 빼고 바닥 줄만 본다.
    for (let y = room.y0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) {
      if (!pass(x, y)) { if (y >= room.y0 + 2 && bare(x, y)) ghost.push(`(${x},${y})`); continue; }
      open++;
      if (reached(x, y)) hit++; else trapped.push(`(${x},${y})`);
    }
    if (!hit) problems.push(`방 ${room.id}: 정문에서 닿는 칸이 없다 (걸음 칸 ${open})`);
    else if (trapped.length) problems.push(`방 ${room.id}: 갇힌 칸 ${trapped.length} ${trapped.slice(0, 8).join(" ")}`);
    if (ghost.length) problems.push(`방 ${room.id}: 빈 바닥인데 막힌 칸 ${ghost.length} ${ghost.slice(0, 8).join(" ")}`);
    const floorRows = (room.x1 - room.x0 + 1) * Math.max(1, room.y1 - room.y0 - 1);
    tight.push(`${room.id} ${Math.round((hit / floorRows) * 100)}%`);
  }
  for (const op of openings) {
    // 문 칸 + 양쪽으로 곧게 두 칸(문 앞 접근 칸)이 모두 정문에서 닿아야 한다 - 문 바로 앞에 가구가 붙으면 실패.
    // 트인 아치(open·span)는 칸막이를 따라 이어진 틈 칸 가운데 한 줄이라도 곧게 지나가면 된다. 세로 옆문(3줄 틈)은 통로 줄 하나만 본다 - 위 두 줄은 칸막이 끝 벽면.
    const [ax, ay] = op.kind === "h" ? [0, 1] : [1, 0];
    const gaps: Pt[] = [{ x: op.x, y: op.y }];
    if (op.kind === "h" || op.open) for (const s of [-1, 1]) for (let k = 1; ; k++) {
      const p = { x: op.x + ay * s * k, y: op.y + ax * s * k };
      if (!pass(p.x, p.y)) break;
      gaps.push(p);
    }
    const lanes = gaps.map((g0) => [-2, -1, 0, 1, 2].map((d) => ({ x: g0.x + ax * d, y: g0.y + ay * d })));
    const clear = lanes.filter((lane) => lane.every((p) => reached(p.x, p.y)));
    if (!clear.length) {
      const blocked = lanes[0]!.filter((p) => !reached(p.x, p.y));
      problems.push(`문 ${op.a}↔${op.b} @(${op.x},${op.y}) 틈 ${gaps.length}칸: 문 앞 두 칸 막힘 ${blocked.map((p) => `(${p.x},${p.y}) ${who(p.x, p.y)}`).join(" ")}`);
    }
  }
  for (const tr of travel) {
    const near = [{ x: tr.x, y: tr.y }, ...DIRS.map(([dx, dy]) => ({ x: tr.x + dx, y: tr.y + dy }))];
    if (!near.some((p) => reached(p.x, p.y))) problems.push(`계단 ${tr.label}: 닿는 앞 칸이 없다`);
  }
  if (seen.size < walk) {
    const loose: string[] = [];
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (pass(x, y) && !reached(x, y)) loose.push(`(${x},${y})`);
    problems.push(`맵 전체 갇힌 칸 ${loose.length}: ${loose.slice(0, 10).join(" ")}`);
  }
  if (problems.length) failed++;
  console.log(`${problems.length ? "FAIL" : "OK  "} ${mapId} ${m.width}x${m.height} 방 ${rooms.length} 문 ${openings.length} 계단 ${travel.length} 걸음 ${seen.size}/${walk}${problems.map((p) => `\n   ${p}`).join("")}`);
  if (argv.includes("--rooms")) console.log(`   방별 걸음 비율: ${tight.join(" · ")}`);
  out[mapId] = { tileset, width: m.width, height: m.height, lower: m.lowerTiles, lower2: m.lowerOverlayTiles ?? [], upper: m.upperTiles, upper2: m.upperOverlayTiles ?? [],
    reached: [...seen], walk, objects: placed.length, problems, warnings: r.warnings ?? [] };
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ maps: out }));
console.log(`${programs.length * seeds.length - failed}/${programs.length * seeds.length} 통과`);
process.exitCode = failed ? 1 : 0;
