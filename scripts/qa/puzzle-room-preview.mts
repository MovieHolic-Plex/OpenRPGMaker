/**
 * 퍼즐 방 정지 그림 미리보기 — 빈 프로젝트에 프리셋을 지어 네 층을 손 도트 실내 시트로 합성한다(브라우저 없음).
 * 이벤트 그림(투명이 아닌 것)은 그리지 않는다 — 실제 화면 확인은 jrpg-puzzle-play.mts(출하 플레이어).
 *
 *   ./node_modules/.bin/vite-node --script scripts/qa/puzzle-room-preview.mts -- --only id,id [--out dir] [--scale 2]
 * 결과: <out>/<id>.png, <id>.json(풀이 분석·playtest 절차)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { runTool } from "@/editor/tools/toolRunner";
import { PUZZLE_PRESET_CATALOG } from "@/editor/tools/puzzleAuthoringTools";
import { createBlankProject } from "@/project/defaults";

const argv = process.argv.slice(2);
const arg = (f: string): string | undefined => (argv.indexOf(f) >= 0 ? argv[argv.indexOf(f) + 1] : undefined);
const ONLY = arg("--only")?.split(",").filter(Boolean);
const OUT = path.resolve(arg("--out") ?? "/tmp/pr4/preview");
const SCALE = Number(arg("--scale") ?? 2);
fs.mkdirSync(OUT, { recursive: true });

const ctx = { project: createBlankProject() };
const jobs: Record<string, unknown>[] = [];
for (const preset of PUZZLE_PRESET_CATALOG.filter((p) => !ONLY || ONLY.includes(p.id))) {
  const mapId = `map_pv_${preset.id}`;
  runTool(ctx, "create_map", { id: mapId, name: preset.title, width: 20, height: 15, tilesetId: "atlas_biome_interior" });
  const res = runTool(ctx, "author_map_puzzle", { mapId, presetId: preset.id, puzzleId: preset.id });
  const d = (res.data ?? {}) as { solvability?: unknown; playtest?: unknown; events?: unknown };
  fs.writeFileSync(path.join(OUT, `${preset.id}.json`), JSON.stringify({ ok: res.ok, summary: res.summary, solvability: d.solvability, playtest: d.playtest, events: d.events }, null, 1));
  console.log(preset.id, res.ok ? "ok" : "FAIL", res.summary.slice(0, 300));
  if (!res.ok) continue;
  const m = ctx.project.maps[mapId]!;
  jobs.push({
    out: path.join(OUT, `${preset.id}.png`),
    width: m.width,
    height: m.height,
    lowerTiles: m.lowerTiles,
    lowerOverlayTiles: m.lowerOverlayTiles,
    upperTiles: m.upperTiles,
    upperOverlayTiles: m.upperOverlayTiles,
    scale: SCALE,
    marks: m.events.filter((e) => e.pages?.[0]?.graphic && !("transparent" in e.pages[0].graphic && e.pages[0].graphic.transparent)).map((e) => ({ x: e.x, y: e.y })),
  });
}
execFileSync("python3", ["scripts/content/hand-interior/render_layers.py"], { input: JSON.stringify(jobs), stdio: ["pipe", "inherit", "inherit"] });
