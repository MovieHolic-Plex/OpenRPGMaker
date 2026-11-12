// 같은 마을 요청을 게임 여섯(프로젝트 열쇠 여섯)으로 짓는다(모델 없음) — 진짜 v2 빌더 함수(builderFor → author_beodeul_town)로.
//
//   bun scripts/content/beodeul-variety/sixSeeds.mts <결과 폴더> [--tag before|after] [--theme river|coast|temple|cave] [--salt N] [--no-look]
//   --no-look: 게임 열쇠를 넘기지 않는다 — 고르기가 없던 때와 같은 결과(여섯 장이 같은 그림)를 지금 코드로 다시 낸다.
//
// 장소 씨앗(salt)은 여섯 모두 같다 — 배치(집·길·광장·소품 자리)는 같고, 달라지는 것은 «게임마다 고른 그림» 뿐이어야 한다.
// 남기는 것: <tag>-<theme>-<n>.png(1배) · <tag>-<theme>.json — 게임마다 바닥 칸 해시 · 통행 격자 해시 · 닿는 칸 수 · 놓인 기물 킷(같은 자리의 그림 이름).
// 고치기 전 main 에서 돌리면 여섯 장이 화소까지 같다. 고친 뒤에는 통행·닿는 칸·바닥이 그대로이고 소품 그림만 다르다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { computeReachableCells } from "../../../src/project/lint/reachability.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const out = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--")));
if (!out) throw new Error("sixSeeds.mts <결과 폴더> [--tag before|after] [--theme river|coast] [--salt N]");
const tag = opt("tag", "now"), theme = opt("theme", "river"), salt = Number(opt("salt", "4242"));
fs.mkdirSync(out, { recursive: true });

export const GAMES = ["ashvale", "moonharbor", "thornkeep", "reedwater", "saltmere", "oakhollow"].map((name) => JSON.stringify(["project", `variety-${name}`]));
const REQUEST: Record<string, { name: string; task: string; hints: Record<string, unknown>; spec?: Record<string, unknown> }> = {
  river: { name: "버들 마을", task: "강가에 작은 마을을 만들어 줘", hints: {} },
  coast: { name: "갈매기 포구", task: "바닷가에 포구 마을을 만들어 줘", hints: { theme: "coast" } },
  // 던전 구성기(put)가 직접 찍는 기물 — 화로·제단·모닥불
  temple: { name: "잊힌 신전", task: "버려진 신전 던전을 만들어 줘", hints: {}, spec: { type: "dungeon", theme: "temple", size: "medium", floors: 1 } },
  cave: { name: "물안개 동굴", task: "작은 동굴을 만들어 줘", hints: {}, spec: { type: "cave", theme: "cave", size: "small", floors: 1 } },
};
const hash = (values: Iterable<number | string>): string => { let h = 0x811c9dc5; for (const v of values) for (const ch of String(v) + ",") { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };

function kitsOnMap(project: Project, map: GameMap): { kit: string; name: string; x: number; y: number }[] {
  // 놓인 기물: 그 칩셋의 소품 킷(role prop, 4×4칸 이하) 칸 행렬이 맵 위층에 그대로 있는 자리. 큰 킷 먼저, 한 칸은 한 킷에만.
  const tileset = project.tilesets[map.tilesetId]!;
  const kits = (tileset.structureKits ?? []).filter((k) => k.ai?.role === "prop" && k.width <= 4 && k.height <= 4)
    .map((k) => ({ k, cells: k.rows.flatMap((row, dy) => (row.upperTiles ?? []).map((t, dx) => ({ dx, dy, t })).filter((c) => c.t >= 0)) }))
    .filter((e) => e.cells.length).sort((a, b) => b.cells.length - a.cells.length || a.k.id.localeCompare(b.k.id));
  const at = (x: number, y: number): number[] => { const i = y * map.width + x; return [map.upperTiles[i] ?? -1, map.upperOverlayTiles?.[i] ?? -1]; };
  const claimed = new Set<number>(), found: { kit: string; name: string; x: number; y: number }[] = [];
  for (const { k, cells } of kits) for (let y = 0; y + k.height <= map.height; y++) for (let x = 0; x + k.width <= map.width; x++) {
    if (!cells.every((c) => at(x + c.dx, y + c.dy).includes(c.t) && !claimed.has((y + c.dy) * map.width + x + c.dx))) continue;
    for (const c of cells) claimed.add((y + c.dy) * map.width + x + c.dx);
    found.push({ kit: k.id, name: k.name ?? k.id, x, y });
  }
  return found.sort((a, b) => a.y - b.y || a.x - b.x);
}

const req = REQUEST[theme]!;
const rows: Record<string, unknown>[] = [];
for (const [n, key] of GAMES.entries()) {
  const project = createBlankProject();
  // lookKey: 게임 열쇠(조수 실행이 요청에 실어 오는 projectKey 와 같은 값). 이 칸을 모르는 옛 코드에서는 그냥 무시된다.
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, ...(argv.includes("--no-look") ? {} : { lookKey: key }) } as ToolContext;
  const run = createBuildRun(ctx);
  const spec = { type: "village", name: req.name, salt, variety: `${key}|${req.task}`, ...(Object.keys(req.hints).length ? { hints: req.hints } : {}), ...(req.spec ?? {}) } as PlaceSpec;
  const res = builderFor(spec)!.build(run, spec);
  const map = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
  if (!res.ok || !map) { console.log(`${n} ${key}: 짓기 실패 — ${res.summary.slice(0, 200)}`); rows.push({ n, key, ok: false, summary: res.summary }); continue; }
  const file = `${tag}-${theme}-${n}.png`;
  fs.writeFileSync(path.join(out, file), renderMapPng(ctx.project, map).png);
  const pass: number[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) pass.push(isPassable(ctx.project, map, x, y) ? 1 : 0);
  const start = res.entrance && res.entrance.mapId === map.id ? res.entrance : ctx.project.startMapId === map.id ? { x: ctx.project.startPos.x, y: ctx.project.startPos.y } : undefined;
  const reach = start ? computeReachableCells(ctx.project, map, start.x, start.y).size : -1;
  const placed = kitsOnMap(ctx.project, map);
  const row = { n, key, ok: true, file, size: `${map.width}x${map.height}`, lower: hash(map.lowerTiles), upper: hash(map.upperTiles), pass: hash(pass), walkable: pass.reduce((a, b) => a + b, 0), reach,
    events: map.events.length, props: placed.length, placed };
  rows.push(row);
  console.log(`${n} ${key} ${row.size} 바닥 ${row.lower} 위층 ${row.upper} 통행 ${row.pass}(걷는 칸 ${row.walkable}) 닿는 칸 ${reach} 소품 ${placed.length}`);
}
fs.writeFileSync(path.join(out, `${tag}-${theme}.json`), JSON.stringify({ tag, theme, salt, request: req, rows }, null, 1));
const ok = rows.filter((r) => r.ok) as { lower: string; upper: string; pass: string; reach: number }[];
const same = (k: "lower" | "upper" | "pass" | "reach") => new Set(ok.map((r) => String(r[k]))).size === 1;
console.log(`여섯 게임 — 바닥 ${same("lower") ? "같다" : "다르다"} · 통행 격자 ${same("pass") ? "같다" : "다르다"} · 닿는 칸 ${same("reach") ? "같다" : "다르다"} · 위층 그림 ${same("upper") ? "같다(여섯 장이 같은 그림)" : "다르다(소품 그림이 게임마다 다름)"}`);
