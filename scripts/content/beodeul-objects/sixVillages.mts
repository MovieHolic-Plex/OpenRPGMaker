// 새 종류 기물이 마을에 놓이는지(모델 없음): 같은 마을 요청을 게임 열쇠 여섯으로 진짜 v2 빌더(builderFor → author_beodeul_town)로 짓고,
// 놓인 새 기물(몇 개·어떤 킷)·걷는 칸·입구에서 닿는 칸을 적는다. 1배 그림도 남긴다. 문 앞 도달·찍기 실패는 scripts/qa/beodeul-village-forms-probe.mts --key 로 잰다.
//
//   bun scripts/content/beodeul-objects/sixVillages.mts <결과 폴더> [--tag after] [--theme river|coast] [--salt N]
//
// 열쇠·요청·씨앗은 scripts/content/beodeul-variety/sixSeeds.mts 와 같다(같은 여섯 마을) — 고치기 전 체크아웃에서 그 스크립트로 뽑은 그림과 나란히 본다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { computeReachableCells } from "../../../src/project/lint/reachability.ts";
import { layerTileAt } from "../../../src/project/mapLayers.ts";
import catalog from "../../../tiledata/beodeul-objects/catalog.json";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const out = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--")));
if (!out) throw new Error("sixVillages.mts <결과 폴더> [--tag after] [--theme river|coast] [--salt N]");
const tag = opt("tag", "after"), theme = opt("theme", "river"), salt = Number(opt("salt", "4242"));
fs.mkdirSync(out, { recursive: true });
const GAMES = ["ashvale", "moonharbor", "thornkeep", "reedwater", "saltmere", "oakhollow"].map((name) => JSON.stringify(["project", `variety-${name}`]));
const REQUEST: Record<string, { name: string; task: string; hints: Record<string, unknown> }> = {
  river: { name: "버들 마을", task: "강가에 작은 마을을 만들어 줘", hints: {} },
  coast: { name: "갈매기 포구", task: "바닷가에 포구 마을을 만들어 줘", hints: { theme: "coast" } },
};
// 새 종류 = 변형이 아닌 bd-obj 킷 가운데 이야기 기물 16종 뒤에 온 것
const NEW = (catalog.items as { kit: string; variantOf?: string; name: string }[]).filter((it, i) => i >= 16 && !it.variantOf);
const req = REQUEST[theme]!;
const rows: Record<string, unknown>[] = [];
for (const [n, key] of GAMES.entries()) {
  const project = createBlankProject();
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: key } as ToolContext;
  const run = createBuildRun(ctx);
  const spec = { type: "village", name: req.name, salt, variety: `${key}|${req.task}`, ...(Object.keys(req.hints).length ? { hints: req.hints } : {}) } as PlaceSpec;
  const res = builderFor(spec)!.build(run, spec);
  const map = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
  if (!res.ok || !map) { console.log(`${n} ${key}: 짓기 실패 — ${res.summary.slice(0, 200)}`); rows.push({ n, key, ok: false }); continue; }
  fs.writeFileSync(path.join(out, `${tag}-${theme}-${n}.png`), renderMapPng(ctx.project, map).png);
  const tileset = ctx.project.tilesets[map.tilesetId]!;
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, k] as const));
  const placed: { kit: string; name: string; x: number; y: number }[] = [];
  for (const it of NEW) {
    const kit = kits.get(it.kit); if (!kit) continue;
    const cells = kit.rows.flatMap((row, dy) => (row.upperTiles ?? []).map((t, dx) => ({ dx, dy, t })).filter((c) => c.t >= 0));
    for (let y = 0; y + kit.height <= map.height; y += 1) for (let x = 0; x + kit.width <= map.width; x += 1)
      if (cells.every((c) => layerTileAt(map, 3, (y + c.dy) * map.width + x + c.dx) === c.t)) placed.push({ kit: it.kit, name: it.name, x, y });
  }
  let walk = 0; for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (isPassable(ctx.project, map, x, y)) walk += 1;
  const start = res.entrance && res.entrance.mapId === map.id ? res.entrance : { x: ctx.project.startPos.x, y: ctx.project.startPos.y };
  const reach = computeReachableCells(ctx.project, map, start.x, start.y).size;
  const kinds = [...new Set(placed.map((p) => p.kit))];
  const row = { n, key, ok: true, size: `${map.width}x${map.height}`, walk, reach, newObjects: placed.length, newKinds: kinds.length, placed };
  rows.push(row);
  console.log(`${n} ${key} ${row.size} 새 기물 ${placed.length}개(${kinds.length}종) · 걷는 칸 ${walk} 닿는 칸 ${reach}`);
}
fs.writeFileSync(path.join(out, `${tag}-${theme}-objects.json`), JSON.stringify({ tag, theme, salt, request: req, rows }, null, 1));
const ok = rows.filter((r) => r.ok) as { newObjects: number; placed: { kit: string }[] }[];
const all = new Set(ok.flatMap((r) => r.placed.map((p) => p.kit)));
const shared = [...all].filter((k) => ok.every((r) => r.placed.some((p) => p.kit === k)));
console.log(`여섯 마을 — 새 기물 ${ok.reduce((a, r) => a + r.newObjects, 0)}개 · 쓰인 종류 ${all.size} · 여섯 모두에 나온 종류 ${shared.length}(${shared.map((k) => k.replace("bd-obj-", "")).join(", ")})`);
