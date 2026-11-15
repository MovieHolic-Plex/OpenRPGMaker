// 물 전/후 탐침(모델 없음): 같은 마을·포구 요청을 진짜 v2 빌더(builderFor → author_beodeul_town)로 짓고 1배 그림·프로젝트·도달 수치를 남긴다.
//
//   bun scripts/content/beodeul-water/waterVillages.mts <결과 폴더> [--tag after] [--only river,hill] [--key ashvale] [--salt 4242] [--no-look] [--cell x,y] [--play]
//
// 요청 다섯: river(강가 마을) · hill(언덕 마을, 강이 단을 넘는다) · coast(포구) · lake(못가 마을 — 도안 칸 지도) · dry(강 없는 마을, 우묵한 곳의 작은 못).
// --cell x,y 는 그 칸의 네 층 칸 번호와 이름표를 찍는다(물가 결함 찾기).
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { computeReachableCells } from "../../../src/project/lint/reachability.ts";
import { layerTileAt } from "../../../src/project/mapLayers.ts";
import { serialize } from "../../../src/project/io.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const out = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--")));
if (!out) throw new Error("waterVillages.mts <결과 폴더> [--tag after] [--only river,hill] [--key ashvale] [--salt 4242] [--no-look]");
const tag = opt("tag", "after"), salt = Number(opt("salt", "4242")), only = opt("only", "").split(",").filter(Boolean);
const key = JSON.stringify(["project", `variety-${opt("key", "ashvale")}`]);
const cell = opt("cell", "").split(",").filter(Boolean).map(Number);
fs.mkdirSync(out, { recursive: true });
// 못가 마을의 도안 칸 지도(0 땅 · 1 윗단 · o 못) — 도안을 읽은 조수가 보내는 것과 같은 꼴
const LAKE = ["11111111111111", "11111111111111", "00000000000000", "00000000000000", "000000000ooo00", "00000000ooooo0", "0000000oooooo0", "0000000ooooo00", "00000000ooo000", "00000000000000", "00000000000000", "00000000000000"];
const REQUESTS: Record<string, { type: string; name: string; task: string; hints: Record<string, unknown> }> = {
  river: { type: "village", name: "버들 마을", task: "강가에 작은 마을을 만들어 줘", hints: {} },
  hill: { type: "village", name: "언덕 마을", task: "언덕 위 마을, 강이 언덕을 타고 내려온다", hints: { landform: "terraces", tiers: 2 } },
  coast: { type: "village", name: "갈매기 포구", task: "바닷가에 포구 마을을 만들어 줘", hints: { theme: "coast" } },
  lake: { type: "village", name: "못가 마을", task: "호숫가 마을을 만들어 줘", hints: { terrainMap: LAKE } },
  dry: { type: "village", name: "들판 마을", task: "강 없는 들판 마을을 만들어 줘", hints: { water: "none" } },
};
const rows: Record<string, unknown>[] = [];
for (const [id, req] of Object.entries(REQUESTS)) {
  if (only.length && !only.includes(id)) continue;
  const project = createBlankProject();
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, ...(argv.includes("--no-look") ? {} : { lookKey: key }) } as ToolContext;
  const run = createBuildRun(ctx);
  const spec = { type: req.type, name: req.name, salt, variety: `${key}|${req.task}`, ...(Object.keys(req.hints).length ? { hints: req.hints } : {}) } as unknown as PlaceSpec;
  const builder = builderFor(spec);
  if (!builder) { console.log(`${id}: 빌더 없음`); rows.push({ id, ok: false }); continue; }
  let res: { ok: boolean; summary: string; mapIds: readonly string[]; entrance?: { mapId: string; x: number; y: number } | null };
  try {
    // 도안 칸 지도(terrainMap)는 장소 명세의 힌트가 아니라 도구 인자다 — 그 요청은 같은 실행 문맥(게임 열쇠)으로 마을 도구를 바로 부른다
    if (req.hints.terrainMap) { const r = run.call("author_beodeul_town", { theme: "river", name: req.name, id: `water_${id}`, seed: salt % 1000, terrainMap: req.hints.terrainMap, water: "none" }); res = { ok: r.ok, summary: r.summary, mapIds: r.ok ? [String((r.data as { mapId: string }).mapId)] : [] }; }
    else res = builder.build(run, spec);
  } catch (e) { console.log(`${id}: 예외 ${(e as Error).message.slice(0, 300)}`); rows.push({ id, ok: false }); continue; }
  const map = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
  if (!res.ok || !map) { console.log(`${id}: 짓기 실패 — ${res.summary.slice(0, 300)}`); rows.push({ id, ok: false }); continue; }
  fs.writeFileSync(path.join(out, `${tag}-${id}.png`), renderMapPng(ctx.project, map).png);
  fs.writeFileSync(path.join(out, `${tag}-${id}.project.json`), JSON.stringify({ project: ctx.project, mapId: map.id, entrance: res.entrance && res.entrance.mapId === map.id ? res.entrance : null }));
  const tileset = ctx.project.tilesets[map.tilesetId]!;
  // --play: 그 맵을 시작 맵으로 한 프로젝트(물가의 걷는 칸에서 시작)를 남긴다 — 출하 플레이어에서 물결·깊이 띠·폭포를 본다(scripts/qa/runtime/beodeul-water.scenario.mjs)
  if (argv.includes("--play")) {
    const canal = new Set(tileset.autotileGroups?.find((g) => g.id === "beodeul_canal_lake_47")?.memberTileIds ?? []);
    const wetAt = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && canal.has(map.lowerTiles[y * map.width + x]!);
    const falls = new Set((map.relief?.wallDecor ?? []).map((d) => d.y * map.width + d.x));
    const spots: { x: number; y: number; s: number; fall: boolean }[] = [];
    for (let y = 2; y < map.height - 2; y += 1) for (let x = 2; x < map.width - 2; x += 1) {
      if (!isPassable(ctx.project, map, x, y) || wetAt(x, y)) continue;
      let wet = 0, fall = false;
      for (let dy = -4; dy <= 4; dy += 1) for (let dx = -6; dx <= 6; dx += 1) { if (wetAt(x + dx, y + dy)) wet += 1; if (falls.has((y + dy) * map.width + x + dx)) fall = true; }
      if (wet >= 12) spots.push({ x, y, s: wet + (fall ? 200 : 0), fall });
    }
    spots.sort((a, b) => b.s - a.s);
    const picks = [spots[0], spots.find((p) => !p.fall && Math.abs(p.x - spots[0]!.x) + Math.abs(p.y - spots[0]!.y) > 12)].filter((p) => !!p);
    if (picks.length) {
      const play = structuredClone(ctx.project) as typeof ctx.project;
      play.startMapId = map.id; play.startPos = { x: picks[0]!.x, y: picks[0]!.y };
      for (const mid of Object.keys(play.maps)) if (mid !== map.id) delete play.maps[mid];
      play.mapTree = { mapId: map.id, children: [] } as never;
      for (const tid of Object.keys(play.tilesets)) if (tid !== map.tilesetId) delete play.tilesets[tid];
      fs.writeFileSync(path.join(out, `${tag}-${id}.play.json`), serialize(play as never));
      fs.writeFileSync(path.join(out, `${tag}-${id}.spots.json`), JSON.stringify({ mapId: map.id, spots: picks.map((p) => ({ x: p!.x, y: p!.y, fall: p!.fall })) }));
    }
  }
  let walk = 0; for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (isPassable(ctx.project, map, x, y)) walk += 1;
  const start = res.entrance && res.entrance.mapId === map.id ? res.entrance : { x: ctx.project.startPos.x, y: ctx.project.startPos.y };
  const reach = computeReachableCells(ctx.project, map, start.x, start.y).size;
  const row = { id, ok: true, size: `${map.width}x${map.height}`, walk, reach, look: tileset.look ?? null, summary: res.summary.slice(0, 400) };
  rows.push(row);
  console.log(`${id} ${row.size} 걷는 칸 ${walk} 닿는 칸 ${reach} look ${JSON.stringify(tileset.look ?? null)}`);
  if (cell.length === 2) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    const x = cell[0]! + dx, y = cell[1]! + dy, c = y * map.width + x;
    const layers = ([1, 2, 3, 4] as const).map((L) => { const t = layerTileAt(map, L, c); const g = (tileset.tileGrafts ?? []).find((v) => v.targetTile === t); return t < 0 ? "-" : `${t}${g ? `<${g.sourceChipset.replace("tex_", "")}#${g.sourceTile}>` : ""}${tileset.tileMeta?.[t]?.label ? `(${tileset.tileMeta[t]!.label})` : ""}`; });
    console.log(`  (${x},${y}) ${layers.join(" | ")}`);
  }
}
fs.writeFileSync(path.join(out, `${tag}-report.json`), JSON.stringify({ tag, salt, key, rows }, null, 1));
