// 출구·길 맞춤 재기(모델 없음): 바깥 맵끼리 잇는 출구(다른 바깥 맵으로 가는 이동 이벤트)가 길 위에 있는지, 장소의 길 그물과 이어지는지,
// 가장자리 출구가 길 폭을 다 덮는지, 넘어온 사람이 길 위 안쪽 칸에 안쪽을 보고 서는지, 연결 하나에 출구가 하나인지 센다. 길이 없는 맵의 출구는 따로 센다.
// 빌더·잇기 수정 전/후를 같은 판으로 비교할 때 쓴다. 길 판정은 칩셋 표면 선언(src/project/tilesetSurface.ts) 그대로다.
//   bun scripts/qa/assistant-v2/exitProbe.mts <project.json|run-dir>... [--maps] [--json <out.json>]
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { ROAD_EXIT_MAX_WIDTH } from "../../../src/ai/v2/place/edgeExitRoads.ts";
import { edgeRoadMouths, roadNetwork } from "../../../src/ai/v2/place/roadMouths.ts";
import { isRoadGround } from "../../../src/ai/v2/place/surface.ts";
import { WORLDS } from "../../../src/ai/v2/place/world.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const jsonAt = argv.indexOf("--json");
const perMap = argv.includes("--maps");
const inputs = argv.filter((a, i) => !a.startsWith("--") && (jsonAt < 0 || i !== jsonAt + 1));

type Transfer = { mapId: string; x: number; y: number; direction?: string };
function transfers(node: unknown, out: Transfer[] = []): Transfer[] {
  if (Array.isArray(node)) node.forEach((n) => transfers(n, out));
  else if (node && typeof node === "object") {
    const r = node as Record<string, unknown>;
    if (r.kind === "transfer" && typeof r.mapId === "string") out.push(r as unknown as Transfer);
    for (const v of Object.values(r)) if (v && typeof v === "object") transfers(v, out);
  }
  return out;
}
/** 바깥 맵인가 — 실내·던전 표시가 없고, 세계 장소 종류의 이름이면 그 종류가 바깥인지(worldProbe 판), 아니면 600칸 이상(구성기의 방은 표시가 없지만 작다). */
function outdoor(map: GameMap): boolean {
  if (map.mapRole === "interior" || map.mapRole === "dungeon" || (map as { climate?: { mode?: string } }).climate?.mode === "indoor") return false;
  const kind = WORLDS.find((w) => w.tilesetId === map.tilesetId)?.kinds.find((k) => k.ko === map.name.replace(/ 둘$/u, ""));
  return kind ? !kind.indoor : map.width * map.height >= 600;
}

const KEYS = ["maps", "exits", "roadless", "onRoad", "joined", "edgeExits", "fullWidth", "arrivals", "arriveRoad", "arriveInside", "arriveFacing", "links", "oneExit"] as const;
type Tally = Record<(typeof KEYS)[number], number>;
const zero = (): Tally => Object.fromEntries(KEYS.map((k) => [k, 0])) as Tally;
const line = (t: Tally): string =>
  `바깥 맵 ${t.maps} · 출구 ${t.exits}(길 없는 맵 ${t.roadless}) · 길 위 ${t.onRoad} · 길 그물에 이어짐 ${t.joined} · 가장자리 출구 ${t.edgeExits} 가운데 길 폭 전체 ${t.fullWidth}`
  + ` · 도착 ${t.arrivals}: 길 위 ${t.arriveRoad} · 가장자리 줄 안쪽 ${t.arriveInside} · 안쪽을 봄 ${t.arriveFacing} · 연결 ${t.links} 가운데 출구 하나 ${t.oneExit}`;

const rows: Record<string, unknown>[] = [], worlds: Record<string, Tally> = {}, total = zero();
for (const input of inputs) {
  const project: Project = input.endsWith(".json") ? JSON.parse(fs.readFileSync(input, "utf8")) : readProjectSqlite(path.join(input, "project"));
  const run = path.basename(input.replace(/\/project\.json$/u, ""));
  const tally = (worlds[run] ??= zero());
  const out = new Set(Object.values(project.maps).filter(outdoor).map((m) => m.id));
  for (const map of Object.values(project.maps)) {
    if (!out.has(map.id)) continue;
    const W = map.width, H = map.height;
    const onEdge = (x: number, y: number) => x === 0 || y === 0 || x === W - 1 || y === H - 1;
    const gates = map.events.flatMap((e) => { const to = transfers(e.pages ?? []).find((t) => t.mapId !== map.id && out.has(t.mapId)); return to ? [{ x: e.x, y: e.y, to }] : []; });
    if (!gates.length) continue;
    const mouths = edgeRoadMouths(project, map), network = roadNetwork(project, map);
    // 출구 = 같은 맵으로 가는, 붙어 있는 이동 칸 묶음(길 폭 사본 포함).
    const groups: (typeof gates)[] = [];
    for (const g of gates) {
      const hit = groups.find((grp) => grp[0]!.to.mapId === g.to.mapId && grp.some((c) => Math.abs(c.x - g.x) + Math.abs(c.y - g.y) === 1));
      if (hit) hit.push(g); else groups.push([g]);
    }
    const t = zero(); t.maps = 1; t.exits = groups.length;
    // 길이 한 칸도 없는 맵(정거장 갑판·늪)의 출구는 따로 센다 — 길 위에 설 수 없는 출구다.
    if (!network.size) t.roadless = groups.length;
    const notes: string[] = [];
    for (const grp of groups) {
      const keys = new Set(grp.map((g) => `${g.x},${g.y}`));
      const road = grp.every((g) => isRoadGround(project, map, g.x, g.y));
      const joined = road && grp.every((g) => network.has(g.y * W + g.x));
      const edge = grp.every((g) => onEdge(g.x, g.y));
      const mouth = mouths.find((m) => m.cells.some((c) => keys.has(`${c.x},${c.y}`)));
      // 열두 칸보다 넓은 가장자리 길(광장)은 가운데 열두 칸이 출구다 — 열두 칸을 덮었으면 전체로 센다.
      const full = edge && !!mouth && (mouth.cells.every((c) => keys.has(`${c.x},${c.y}`)) || grp.length >= ROAD_EXIT_MAX_WIDTH);
      t.onRoad += Number(road); t.joined += Number(joined); t.edgeExits += Number(edge); t.fullWidth += Number(full);
      // 넘어가서 서는 칸(상대 맵) — 길 위인가, 가장자리 줄에서 한 칸 안쪽인가, 방향이 정해졌나.
      const to = grp[0]!.to, dest = project.maps[to.mapId]!;
      const destEdge = to.x === 0 || to.y === 0 || to.x === dest.width - 1 || to.y === dest.height - 1;
      t.arrivals += 1; t.arriveRoad += Number(isRoadGround(project, dest, to.x, to.y)); t.arriveInside += Number(!destEdge); t.arriveFacing += Number(!!to.direction);
      notes.push(`→${dest.name} ${grp[0]!.x},${grp[0]!.y}×${grp.length}${road ? "" : " 길아님"}${edge && !full ? " 폭부족" : ""} 도착 ${to.x},${to.y}${to.direction ? ` ${to.direction}` : " 방향없음"}${isRoadGround(project, dest, to.x, to.y) ? "" : " 길아님"}${destEdge ? " 가장자리줄" : ""}`);
    }
    const perDest = new Map<string, number>();
    for (const grp of groups) perDest.set(grp[0]!.to.mapId, (perDest.get(grp[0]!.to.mapId) ?? 0) + 1);
    t.links = perDest.size; t.oneExit = [...perDest.values()].filter((n) => n === 1).length;
    for (const k of KEYS) { tally[k] += t[k]; total[k] += t[k]; }
    rows.push({ run, map: map.name, size: `${W}×${H}`, ...t, exitsAt: notes });
    if (perMap) console.log(`${run.padEnd(14)} ${String(map.name).padEnd(12)} ${`${W}×${H}`.padEnd(6)} ${notes.join(" | ")}`);
  }
}
for (const [run, t] of Object.entries(worlds)) console.log(`${run.padEnd(16)} ${line(t)}`);
console.log(`합계             ${line(total)}`);
if (jsonAt >= 0) fs.writeFileSync(argv[jsonAt + 1]!, JSON.stringify({ total, worlds, rows }, null, 1));
