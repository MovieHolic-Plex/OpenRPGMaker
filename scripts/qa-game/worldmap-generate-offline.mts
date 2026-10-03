// 모델 없이 「새 대륙 구조」 도구 사슬만 빠르게: 생성 미리보기(20조각) → 같은 구조로 저장 빌드 → 작업 덧붙이기(배치 번호 유지).
//   bun scripts/qa-game/worldmap-generate-offline.mts <출력폴더> [테마] [style] [count]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "../../src/project/defaults";
import { runTool } from "../../src/editor/tools/toolRunner";
import { prepareTool } from "../../src/editor/tools/asyncToolRunner";
import { setWorldmapBuilder } from "../../src/editor/worldmap/worldmapBuild";
import { worldTerrainImages } from "../../src/editor/tools/worldTerrainTools";
import { buildWorldmap } from "../lib/worldmapBuild.mjs";
import { serialize } from "../../src/project/io";
import type { MapId } from "../../src/project/types";

const [outDir, theme = "fantasy", style = "shards", count = "20"] = process.argv.slice(2);
if (!outDir) throw new Error("usage: worldmap-generate-offline.mts <outDir> [theme] [style] [count]");
mkdirSync(outDir, { recursive: true });
setWorldmapBuilder(buildWorldmap);
const ctx = { project: createBlankProject() };
async function call(name: string, args: Record<string, unknown>): Promise<Record<string, any>> {
  const t = Date.now();
  await prepareTool(name, args, ctx.project);
  const result = runTool(ctx, name, args, { dryRun: false });
  console.log(`${name} ok=${result.ok} ${((Date.now() - t) / 1000).toFixed(1)}s — ${result.summary.split("\n")[0]}`);
  if (!result.ok) throw new Error(result.summary);
  return result.data as Record<string, any>;
}
const save = (file: string, name: string) => {
  const image = worldTerrainImages(name)[0];
  if (image) writeFileSync(join(outDir, file), Buffer.from(image.dataUrl.split(",")[1]!, "base64"));
};
const ops = [{ op: "continents", style, count: Number(count), seed: 2 }];
const pv = await call("edit_world_terrain", { theme, base: "generate", preview: true, ops });
save("preview.png", "edit_world_terrain");
console.log("  layout", JSON.stringify(pv.layout).slice(0, 300));
const made = await call("edit_world_terrain", { theme, base: "generate", ops, name: "새 구조" });
save("map.png", "edit_world_terrain");
const mapId = made.mapId as MapId;
const src = ctx.project.maps[mapId]!.worldmapSource!;
console.log(`  저장: base=${src.base} fitSalt=${src.fitSalt} ops=${src.ops.length} 장소=${ctx.project.maps[mapId]!.locations?.length}`);
const read = await call("read_world_terrain", { mapId });
writeFileSync(join(outDir, "read.txt"), `${read.ascii}\n\n${(read.layout?.regions ?? []).join("\n")}\n\n${read.places.join("\n")}\n`);
const more = await call("edit_world_terrain", { mapId, preview: true, ops: [{ op: "forest", poly: [[10, 10], [30, 10], [30, 30], [10, 30]], density: .7 }] });
console.log(`  덧붙임 미리보기: 배치 ${more.layout?.salt} (저장 ${src.fitSalt}) 작업 ${more.ops.length}`);

// 런타임 확인용(scripts/qa/runtime/worldmap-generate.scenario.mjs): 수도 곁, 오른쪽 두 칸이 열린 칸에서 시작한다.
{
  const m = ctx.project.maps[mapId]!;
  const ts = ctx.project.tilesets[m.tilesetId]!;
  const capital = m.locations!.find(l => l.tags?.includes("capital")) ?? m.locations![0]!;
  const openAt = (x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height && ts.passability[y * m.width + x]!.up;
  let start: { x: number; y: number } | null = null;
  for (let r = 1; r < 8 && !start; r += 1) {
    for (let y = capital.y - r; y <= capital.y + capital.h - 1 + r && !start; y += 1) {
      for (let x = capital.x - r; x <= capital.x + capital.w - 1 + r && !start; x += 1) {
        if (openAt(x, y) && openAt(x + 1, y) && openAt(x + 2, y)) start = { x, y };
      }
    }
  }
  ctx.project.startMapId = mapId;
  ctx.project.startPos = start!;
  console.log(`  시작 ${mapId} ${start!.x},${start!.y} (수도 ${capital.name} ${capital.x},${capital.y})`);
  // 프로젝트 JSON 은 수십 MB(번들 자산 포함) — 커밋하지 않는다.
  writeFileSync(join(outDir, "project.json"), serialize(ctx.project));
  writeFileSync(join(outDir, "start.json"), JSON.stringify({ mapId, ...start! }));
}
