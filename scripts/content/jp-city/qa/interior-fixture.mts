// 일본 집 실내(interior.mjs 가 지은 맵)를 시작 맵으로 하는 출하 플레이어 시험 프로젝트 — 2층 단독주택 1층(현관)에서 시작.
// 걷는 길은 손으로 적지 않는다: 예제 JSON 의 방 범위(rooms)마다 엔진 canMove BFS 로 길을 구해 --paths 에 쓴다(평면이 바뀌어도 probe 가 따라간다).
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/interior-fixture.mts --out <경로.json> --paths <길.json>
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serializePretty } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";
import { canMove } from "@/project/collision";

let out: string | null = null, pathsOut: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === "--out") out = process.argv[++i] ?? null;
  else if (process.argv[i] === "--paths") pathsOut = process.argv[++i] ?? null;
}
if (!out || !pathsOut) throw new Error("사용법: --out <경로.json> --paths <길.json>");
const project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
project.tilesets.jp_city = createJpCityTileset();
const FILES = { "jp-city-house-1f": "house-1f", "jp-city-house-2f": "house-2f", "jp-city-apartment-1k": "apartment-1k" } as const;
type Ex = { start: [number, number]; links?: { x: number; y: number; toMapId: string; toX: number; toY: number }[]; rooms: { room: string; x0: number; y0: number; x1: number; y1: number }[] };
const ex: Record<string, Ex> = {};
for (const [id, f] of Object.entries(FILES)) {
  const m = JSON.parse(readFileSync(`scripts/content/jp-city/maps/out/interior-${f}.map.json`, "utf8"));
  project.maps[m.id] = m;
  project.mapTree = { ...project.mapTree, children: [...(project.mapTree?.children ?? []), { mapId: m.id, children: [] }] } as typeof project.mapTree;
  ex[id] = JSON.parse(readFileSync(`tiledata/jp-city/interior/examples/${f}.json`, "utf8"));
}
const F1 = "jp-city-house-1f", F2 = "jp-city-house-2f", APT = "jp-city-apartment-1k";
project.startMapId = F1;
project.startPos = { x: ex[F1]!.start[0], y: ex[F1]!.start[1] };
writeFileSync(out, serializePretty(project), "utf8");

type Step = [string, number, number];
const DIRS: [string, number, number][] = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
/** from 에서 닿는 칸 중 goal 칸들 → pick 이 고른 칸까지 최단 길. 이동 칸(links)은 마지막 칸이 아니면 밟지 않는다. */
function route(mapId: string, from: [number, number], goal: (x: number, y: number) => boolean, pick: (x: number, y: number) => number = () => 0): Step[] | null {
  const map = project.maps[mapId]!; const W = map.width, H = map.height;
  const s = from[1] * W + from[0];
  const links = new Set((ex[mapId]!.links ?? []).map((l) => l.y * W + l.x));
  const prev = new Map<number, [number, string]>([[s, [-1, ""]]]);
  const q = [s]; let best = -1, bestScore = Infinity;
  while (q.length) {
    const c = q.shift()!; const x = c % W, y = (c - x) / W;
    if (c !== s && goal(x, y)) { const sc = pick(x, y); if (sc < bestScore) { bestScore = sc; best = c; } }
    if (links.has(c) && c !== s) continue;
    for (const [d, dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(n) || !canMove(project, map, x, y, nx, ny)) continue;
      prev.set(n, [c, d]); q.push(n);
    }
  }
  if (best < 0) return null;
  const steps: Step[] = []; let k = best;
  while (prev.get(k)![0] !== -1) { const [p, d] = prev.get(k)!; steps.unshift([d, k % W, Math.floor(k / W)]); k = p; }
  return steps;
}
const ROOM = (mapId: string, room: string) => ex[mapId]!.rooms.find((z) => z.room === room)!;
const legs: { label: string; map: string; steps: Step[] | null; transfer?: { to: string; at: [number, number] } }[] = [];
let at: [number, number] = ex[F1]!.start;
const leg = (label: string, map: string, room: string) => {
  // 방 안 칸 중 방 한가운데에 가장 가까운 칸까지(문턱 한 칸에서 멈추지 않게).
  const r = ROOM(map, room); const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const steps = route(map, at, (x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && !(ex[map]!.links ?? []).some((l) => l.x === x && l.y === y), (x, y) => Math.abs(x - cx) + Math.abs(y - cy));
  legs.push({ label, map, steps });
  if (steps?.length) at = [steps.at(-1)![1], steps.at(-1)![2]];
};
for (const [room, ko] of [["washitsu", "화실"], ["ldk", "LDK"], ["kitchen", "부엌"], ["dressing", "탈의실"], ["bath", "욕실"], ["toilet", "화장실"]] as const) leg(`1층 → ${ko}`, F1, room);
const up = ex[F1]!.links![0]!;
const toUp = route(F1, at, (x, y) => x === up.x && y === up.y);
legs.push({ label: `1층 → 계단 발칸 (${up.x},${up.y}) 밟기 → 2층`, map: F1, steps: toUp, transfer: { to: F2, at: [up.toX, up.toY] } });
at = [up.toX, up.toY];
for (const [room, ko] of [["kids", "아이방"], ["toilet", "화장실"], ["bedroom", "부부 침실"]] as const) leg(`2층 → ${ko}`, F2, room);
const down = ex[F2]!.links![0]!;
const toDown = route(F2, at, (x, y) => (ex[F2]!.links ?? []).some((l) => l.x === x && l.y === y));
legs.push({ label: `2층 → 계단통 아랫줄 밟기 → 1층`, map: F2, steps: toDown, transfer: { to: F1, at: [down.toX, down.toY] } });
at = ex[APT]!.start;
for (const [room, ko] of [["kitchen", "부엌"], ["unitbath", "유닛 배스"], ["oneroom", "방"]] as const) leg(`원룸 → ${ko}`, APT, room);
const missing = legs.filter((l) => !l.steps?.length).map((l) => l.label);
writeFileSync(pathsOut, JSON.stringify({ start: { map: F1, at: ex[F1]!.start }, aptStart: ex[APT]!.start, legs }, null, 1));
console.log(`픽스처: ${out} · 길 ${legs.length}개${missing.length ? ` · 길 없음: ${missing.join(", ")}` : ""}`);
if (missing.length) process.exit(3);
