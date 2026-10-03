// 높이 경사로의 실제 공용 렌더러를 확대해 확인하는 그림. 게임 콘텐츠 저장·테스트 스위트 실행이 아니다.
// node_modules/.bin/esbuild scripts/capture/render-relief-slope.mts --bundle --platform=node --format=esm --packages=external --outfile=.vite-cache/relief-slope-render.mjs
// node .vite-cache/relief-slope-render.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { effectiveHeights, renderRelief } from "../../src/project/relief/render";
import { reliefPaintsCell, reliefRenderOptions } from "../../src/project/relief/screen";
import { gridFromRelief, type ReliefData } from "../../src/project/relief/types";
import { reliefSlopes } from "../../src/project/relief/walk";

const out = "verify-shots/relief-slope-fix";
mkdirSync(out, { recursive: true });
const observations = [];
for (const height of [1, 2, 3, 4]) {
  const width = 10, rows = 15;
  const relief: ReliefData = { width, height: rows, levels: new Array(width * rows).fill(0), ramps: new Array(width * rows).fill(0) };
  for (let y = 3; y < 8; y++) for (let x = 1; x < width - 1; x++) relief.levels[y * width + x] = height;
  for (let y = 8; y < 8 + height + 1; y++) for (const x of [3, 4, 5, 6]) relief.ramps![y * width + x] = 1;
  const r = renderRelief(effectiveHeights(gridFromRelief(relief)), reliefRenderOptions(relief));
  const scale = 4, image = new PNG({ width: r.PW * scale, height: r.SH * scale });
  for (let i = 0; i < r.rgba.length / 4; i++) for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
    const target = ((Math.floor(i / r.PW) * scale + dy) * image.width + (i % r.PW) * scale + dx) * 4;
    image.data.set(r.rgba.subarray(i * 4, i * 4 + 4), target);
  }
  writeFileSync(`${out}/engine-${height}-levels.png`, PNG.sync.write(image));
  observations.push({ height, slopes: reliefSlopes(relief), rendererOwnsSlope: reliefPaintsCell(relief, 4, 8) });
}
writeFileSync(`${out}/engine-observations.json`, JSON.stringify(observations, null, 2) + "\n");
console.log(JSON.stringify({ out, observations }));
