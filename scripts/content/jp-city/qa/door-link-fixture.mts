// 거리 건물 문 ↔ 실내 잇기(link_jp_city_interior) 출하 플레이어 시험 프로젝트.
// 상가 거리 예제 맵(maps/out/shopstreet.map.json)의 건물 문마다 실내 장소를 **조수 도구 그대로** 잇고,
// 들어가기(문 앞 한 걸음 위) → 실내 도착 칸 → 실내 출입구까지 엔진 canMove BFS 길 → 거리 도착 칸을 --paths 에 쓴다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/door-link-fixture.mts --out <경로.json> --paths <길.json> [--links <links.json>]
// links.json = [{ "building": "A2", "place": "jp-city-konbini-…", "name": "편의점 안" }] — 없으면 아래 기본(이미 있는 집 장소 둘).
import { readFileSync, writeFileSync } from "node:fs";
import { serializePretty } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";
import { canMove } from "@/project/collision";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { preloadRegionReferenceScene, setRegionReferenceDownloadLoader } from "@/project/regionReferenceImport";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, MapId } from "@/project/types";

let out: string | null = null, pathsOut: string | null = null, linksPath: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === "--out") out = process.argv[++i] ?? null;
  else if (process.argv[i] === "--paths") pathsOut = process.argv[++i] ?? null;
  else if (process.argv[i] === "--links") linksPath = process.argv[++i] ?? null;
}
if (!out || !pathsOut) throw new Error("사용법: --out <경로.json> --paths <길.json> [--links <links.json>]");
type Link = { building: string; place: string; name?: string };
const LINKS: Link[] = linksPath ? JSON.parse(readFileSync(linksPath, "utf8")) : [
  { building: "E1", place: "jp-city-apartment-1k-12x13", name: "맨션 1K" },
  { building: "A1a", place: "jp-city-house-interior-21x15", name: "가게 딸린 집" },
];

setRegionReferenceDownloadLoader(async (url: string) => JSON.parse(readFileSync(`public${url}`, "utf8")));
const plan = JSON.parse(readFileSync("scripts/content/jp-city/maps/out/shopstreet.plan.json", "utf8")) as { start: [number, number]; doors: { b: string; x: number; y: number }[] };
const street = JSON.parse(readFileSync("scripts/content/jp-city/maps/out/shopstreet.map.json", "utf8")) as GameMap;
const project = createEmptyToolProject("jp-door-link");
project.tilesets.jp_city = createJpCityTileset();
project.maps[street.id] = street;
project.mapTree = { mapId: street.id as MapId, children: [] };
project.startMapId = street.id as MapId;
project.startPos = { x: plan.start[0], y: plan.start[1] };
const ctx: ToolContext = { project, currentMapId: street.id, approvedTilesetFamilies: ["oprn-jp"] };

type Step = [string, number, number];
const DIRS: [string, number, number][] = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
function route(map: GameMap, from: { x: number; y: number }, goals: { x: number; y: number }[]): Step[] | null {
  const W = map.width, H = map.height, s = from.y * W + from.x;
  const goal = new Set(goals.map((g) => g.y * W + g.x));
  const pads = new Set((map.events ?? []).map((e) => e.y * W + e.x));
  const prev = new Map<number, [number, string]>([[s, [-1, ""]]]);
  const q = [s];
  while (q.length) {
    const c = q.shift()!, x = c % W, y = (c - x) / W;
    if (goal.has(c)) {
      const steps: Step[] = []; let k = c;
      while (prev.get(k)![0] !== -1) { const [p, d] = prev.get(k)!; steps.unshift([d, k % W, Math.floor(k / W)]); k = p; }
      return steps;
    }
    if (c !== s && pads.has(c)) continue; // 다른 발판은 밟지 않는다
    for (const [d, dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(n) || !canMove(ctx.project, map, x, y, nx, ny)) continue;
      prev.set(n, [c, d]); q.push(n);
    }
  }
  return null;
}

function farthest(map: GameMap, from: { x: number; y: number }): { x: number; y: number } {
  const W = map.width, H = map.height, s = from.y * W + from.x;
  const pads = new Set((map.events ?? []).map((e) => e.y * W + e.x));
  const seen = new Set([s]); let q = [s], last = s;
  while (q.length) {
    const next: number[] = [];
    for (const c of q) {
      last = c; const x = c % W, y = (c - x) / W;
      for (const [, dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, n = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || pads.has(n) || !canMove(ctx.project, map, x, y, nx, ny)) continue;
        seen.add(n); next.push(n);
      }
    }
    q = next;
  }
  return { x: last % W, y: Math.floor(last / W) };
}

const legs: unknown[] = [];
const report: string[] = [];
for (const link of LINKS) {
  const doors = plan.doors.filter((d) => d.b === link.building).sort((a, b) => a.x - b.x);
  if (!doors.length) throw new Error(`건물 ${link.building} 의 문이 plan 에 없다`);
  await preloadRegionReferenceScene(link.place);
  const res = runTool(ctx, "link_jp_city_interior", { mapId: street.id, door: { x: doors[0]!.x, y: doors[0]!.y }, width: doors.length, place: link.place, ...(link.name ? { name: link.name } : {}) });
  if (!res.ok) throw new Error(`${link.building} → ${link.place}: ${JSON.stringify(res.issues)}`);
  report.push(res.summary ?? "");
  const data = res.data as { fronts: { x: number; y: number }[]; interiorMapId: string; entryLanding: { x: number; y: number }; exitCells: { x: number; y: number }[]; exitLanding: { x: number; y: number } };
  const interior = ctx.project.maps[data.interiorMapId]!;
  const front = data.fronts[Math.floor((data.fronts.length - 1) / 2)]!;
  // 실내를 실제로 돌아다닌다: 도착 칸에서 가장 먼 칸까지 갔다가 출입구로 나온다.
  const far = farthest(interior, data.entryLanding);
  const tour = route(interior, data.entryLanding, [far]) ?? [];
  const inside = route(interior, far, data.exitCells);
  if (!inside) throw new Error(`${data.interiorMapId}: (${far.x},${far.y}) → 출입구 길이 없다`);
  legs.push({
    label: `${link.building} → ${interior.name}`, street: street.id, interior: data.interiorMapId,
    startAt: [data.exitLanding.x, data.exitLanding.y], enter: ["up", front.x, front.y], entryAt: [data.entryLanding.x, data.entryLanding.y],
    tourSteps: tour, exitSteps: inside, exitAt: [data.exitLanding.x, data.exitLanding.y],
  });
}
// 출하 플레이어가 쓰는 칩셋만 남긴다(빈 도구 프로젝트는 번들 칩셋 수십 개 — 135MB 라 브라우저가 죽었다).
const used = new Set(Object.values(ctx.project.maps).map((m) => m.tilesetId as string));
ctx.project.tilesets = Object.fromEntries(Object.entries(ctx.project.tilesets).filter(([id]) => used.has(id))) as typeof ctx.project.tilesets;
writeFileSync(out, serializePretty(ctx.project), "utf8");
writeFileSync(pathsOut, JSON.stringify({ legs, report }, null, 1), "utf8");
console.log(report.join("\n"));
