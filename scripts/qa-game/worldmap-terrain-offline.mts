// 모델 없이 세계 지형 도구 사슬을 끝까지 돌린다(빌드는 호스트 키트를 프로세스 안에서 부른다). 사용:
//   bun scripts/qa-game/worldmap-terrain-offline.mts <출력폴더> [테마]
// 읽기 → 틀린 작업(마을을 바다로) 실패 문장 → 새 세계 지도(대륙 가르기·섬) → 같은 지도에 숲 더하기(작업 누적).
// 출력: map-1.png · map-2.png · read.txt · tool-results.json · project.json
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "../../src/project/defaults";
import { serialize } from "../../src/project/io";
import { runTool } from "../../src/editor/tools/toolRunner";
import { prepareTool } from "../../src/editor/tools/asyncToolRunner";
import { setWorldmapBuilder } from "../../src/editor/worldmap/worldmapBuild";
import { worldTerrainImages } from "../../src/editor/tools/worldTerrainTools";
import { buildWorldmap } from "../lib/worldmapBuild.mjs";
import type { MapId } from "../../src/project/types";

const [outDir, theme = "fantasy"] = process.argv.slice(2);
if (!outDir) throw new Error("usage: worldmap-terrain-offline.mts <outDir> [theme]");
mkdirSync(outDir, { recursive: true });
setWorldmapBuilder(buildWorldmap);
const ctx = { project: createBlankProject() };
const log: unknown[] = [];
async function call(name: string, args: Record<string, unknown>, expectFail = false): Promise<Record<string, any>> {
  const t = Date.now();
  await prepareTool(name, args, ctx.project);
  const result = runTool(ctx, name, args, { dryRun: false });
  log.push({ name, ok: result.ok, seconds: (Date.now() - t) / 1000, summary: result.summary, warnings: result.warnings });
  console.log(`${name} ok=${result.ok} ${((Date.now() - t) / 1000).toFixed(1)}s — ${result.summary.split("\n")[0]}`);
  if (result.ok === expectFail) throw new Error(`${name}: 기대와 다름 — ${result.summary}`);
  return (result.ok ? result.data : { error: result.summary }) as Record<string, any>;
}
const save = (file: string, name: string) => {
  const image = worldTerrainImages(name)[0];
  if (image) writeFileSync(join(outDir, file), Buffer.from(image.dataUrl.split(",")[1]!, "base64"));
};

const read = await call("read_world_terrain", { theme });
writeFileSync(join(outDir, "read.txt"), `${read.ascii}\n\n${read.places.join("\n")}\n`);
save("read.png", "read_world_terrain");

// 틀린 작업: 첫 장소를 통째로 바다로 덮는다 → 읽을 수 있는 실패 문장이 돌아와야 한다.
const first = String(read.places[0]).match(/^(.+?)\(.*?\) (\d+),(\d+) (\d+)×(\d+)/)!;
const [fx, fy, fw, fh] = [Number(first[2]), Number(first[3]), Number(first[4]), Number(first[5])];
const bad = await call("edit_world_terrain", {
  theme, preview: true,
  ops: [{ op: "sea", poly: [[fx - 2, fy - 2], [fx + fw + 2, fy - 2], [fx + fw + 2, fy + fh + 2], [fx - 2, fy + fh + 2]] }],
}, true);
console.log("  실패 문장:", String(bad.error).split("\n").slice(0, 3).join(" / "));

const ops1 = [
  { op: "sea", poly: [[58, 30], [80, 29], [80, 32], [58, 33]], note: "동대륙 가르기" },
  { op: "sea", poly: [[86, 29], [94, 28], [94, 32], [86, 32]] },
  { op: "island", x: 91, y: 62, rx: 3, ry: 2, ground: "jungle" },
];
const made = await call("edit_world_terrain", { theme, name: "갈라진 세계", ops: ops1 });
save("map-1.png", "edit_world_terrain");
const mapId = made.mapId as MapId;
const map = ctx.project.maps[mapId]!;
const tileset = ctx.project.tilesets[map.tilesetId]!;
const open = tileset.passability.filter(p => p.up).length;
console.log(`  맵 ${mapId} ${map.width}×${map.height} 타일셋 ${tileset.id} 통행 열린 칸 ${open}/${tileset.count} 장소 ${map.locations?.length} 작업 ${map.worldmapSource?.ops.length}`);

const added = await call("edit_world_terrain", { mapId, ops: [{ op: "forest", poly: [[20, 50], [30, 50], [30, 58], [20, 58]], kind: "conifer", density: 0.7 }] });
save("map-2.png", "edit_world_terrain");
console.log(`  누적 작업 ${ctx.project.maps[mapId]!.worldmapSource?.ops.length} (기대 ${ops1.length + 1}), created=${added.created}`);

writeFileSync(join(outDir, "project.json"), serialize(ctx.project));
writeFileSync(join(outDir, "tool-results.json"), JSON.stringify(log, null, 2));
