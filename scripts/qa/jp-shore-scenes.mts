// jp_city 물가 장면(2026-10-20 현대 타일 개선판) — 실제 도구(compose_jp_region)로 계곡(23)·항구(28)·해안(29)을 지어
// 맵 객체 통째를 tiledata/jp-city/qa/modern-tiles/<지역>.json 에 저장하고, 번들 시트로 1배 PNG 를 그린다.
//   bun scripts/qa/jp-shore-scenes.mts [--out-png /home/main/claude-viz/modern-tiles-proto/baked] [--seed 1]
// 저장한 맵은 scripts/qa/runtime/modern-tiles.capture.mjs(출하 player.html 경로) 가 그대로 읽는다.
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { createNewProjectSeed } from "../../src/editor/genrePacks.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { blankFillTileFor } from "../../src/project/defaults/defaultMaps.ts";
import { jpRegionById } from "../../src/editor/jpCity/japaneseRegionsCatalog.ts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT_JSON = "tiledata/jp-city/qa/modern-tiles";
const OUT_PNG = arg("out-png", "/home/main/claude-viz/modern-tiles-proto/baked");
const seed = Number(arg("seed", "1"));
fs.mkdirSync(OUT_JSON, { recursive: true }); fs.mkdirSync(OUT_PNG, { recursive: true });
const SCENES: [string, string, string][] = [["gorge_waterfall_trail", "gorge", "mt-jp-gorge"], ["fishing_harbor_market", "harbor", "mt-jp-harbor"], ["coastal_seaside_road", "coast", "mt-jp-coast"]];
for (const [rid, short, mapId] of SCENES) {
  const region = jpRegionById(rid)!;
  const p = createNewProjectSeed("adventure-jrpg", "t") as Project; ensureBundledTilesets(p);
  const ctx = { project: p };
  const id = p.startMapId;
  const [W, H] = region.size;
  { const m = p.maps[id]!, kit = p.tilesets.jp_city!; m.tilesetId = kit.id; m.tileSize = kit.tileSize; m.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit)); }
  runTool(ctx, "resize_map", { mapId: id, width: W, height: H }); { const kit = p.tilesets.jp_city!; p.maps[id]!.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit)); }
  const res = runTool(ctx, "compose_jp_region", { mapId: id, region: rid, seed, replace: true }) as { ok: boolean; summary: string; warnings?: string[]; data?: Record<string, unknown> };
  const m = structuredClone(ctx.project.maps[id]!);
  m.id = mapId; m.name = `jp ${short} (modern-tiles)`; m.events = [];
  fs.writeFileSync(`${OUT_JSON}/${short}.json`, JSON.stringify(m) + "\n");
  fs.writeFileSync(`${OUT_PNG}/jp-${short}-1x.png`, renderMapPng({ ...ctx.project, startMapId: "__none__" }, ctx.project.maps[id]!).png);
  const v = (res.data?.violations as string[] | undefined) ?? [];
  console.log(rid, res.ok ? "ok" : "FAIL", `stamped:${res.data?.stamped}`, `shoreCells:${res.data?.shoreCells}`, `violations:${v.length}`, v.join("; "), (res.warnings ?? []).join(" | "));
}
