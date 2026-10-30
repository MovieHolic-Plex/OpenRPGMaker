// 『여덟째 자리』 오프닝·타이틀 배경 — 게임 맵을 1:1(16px 칸)로 굽는다(새 그림 생성 없음).
//   node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/content/eighth-seat/bake_opening_backdrops.mts
//   → public/assets/eighth-seat/opening/*.png
// 맵만 지으면 되므로 데모 전체가 아니라 맵 빌더만 돌린다(같은 SPECS·같은 seed 라 게임 맵과 화소가 같다).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { buildEighthSeatMaps } from "@/project/flagship/eighthSeatMaps";
import { EIGHTH_SEAT_BACKDROPS } from "@/assets/eighthSeatOpeningBackdrops";
import { renderMapPng } from "../../qa-game/render.mts";

const OUT = "public/assets/eighth-seat/opening";
const project = createBlankProject();
const exec = (name: string, args: Record<string, unknown>) => {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx as never, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`${name} failed: ${res.summary}`);
  Object.assign(project, ctx.project);
  return { data: res.data, summary: res.summary };
};
buildEighthSeatMaps(project, exec);
fs.mkdirSync(OUT, { recursive: true });
for (const b of EIGHTH_SEAT_BACKDROPS) {
  const map = project.maps[b.mapId];
  if (!map) throw new Error(`맵 없음: ${b.mapId}`);
  const { png, note } = renderMapPng(project, { ...map, events: [] }, 1);
  if (note) throw new Error(`${b.mapId}: ${note}`);
  const src = PNG.sync.read(png);
  const { x, y, width, height } = b.crop;
  if (x + width > src.width || y + height > src.height) throw new Error(`${b.id}: 자르기가 맵 ${src.width}×${src.height} 밖`);
  const out = new PNG({ width, height });
  PNG.bitblt(src, out, x, y, width, height, 0, 0);
  fs.writeFileSync(path.join(OUT, b.fileName), PNG.sync.write(out));
  console.log(`${b.id}: ${b.mapId} → ${path.join(OUT, b.fileName)}`);
}
