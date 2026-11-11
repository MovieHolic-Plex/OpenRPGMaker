// 강호의 철련 오프닝·타이틀 판 — 구운 맵을 1배로 그린다. 새 화소 없음.
//   node node_modules/vite-node/dist/cli.mjs --script scripts/content/iron-lotus-plates.mts dist/demos/iron-lotus.project.json
import fs from "node:fs";
import { PNG } from "pngjs";
import { loadProjectFile } from "../qa-game/check.mts";
import { renderMapPng } from "../qa-game/render.mts";

const [file] = process.argv.slice(2);
if (!file) throw new Error("usage: iron-lotus-plates.mts <iron-lotus.project.json>");
const { project } = loadProjectFile(file);
const outDir = "public/assets/iron-lotus/plates";
fs.mkdirSync(outDir, { recursive: true });

function crop(mapId: string, name: string, ox: number, oy: number, width: number, height: number): void {
  const map = project.maps[mapId];
  if (!map) throw new Error(`맵이 없다: ${mapId}`);
  const { png } = renderMapPng(project, { ...map, events: [] }, 1);
  const src = PNG.sync.read(png);
  const out = new PNG({ width, height });
  for (let row = 0; row < height; row += 1) {
    const y = oy + row;
    if (y < 0 || y >= src.height) continue;
    const x0 = Math.max(0, ox);
    const x1 = Math.min(src.width, ox + width);
    if (x1 <= x0) continue;
    src.data.copy(out.data, (row * width + (x0 - ox)) * 4, (y * src.width + x0) * 4, (y * src.width + x1) * 4);
  }
  const target = `${outDir}/${name}.png`;
  fs.writeFileSync(target, PNG.sync.write(out));
  console.log(target, `${width}×${height}`, mapId);
}

crop("il_hub", "town", 10 * 16, 14 * 16, 528, 297);
crop("il_grove", "grove", 6 * 16, 8 * 16, 528, 297);
crop("il_temple", "temple", 8 * 16, 8 * 16, 528, 297);
