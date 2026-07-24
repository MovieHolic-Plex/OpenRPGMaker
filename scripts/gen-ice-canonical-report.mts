/** Generates a visual report directly from the shared canonical ice module. */
import fs from "node:fs";
import path from "node:path";
import {
  canonicalIceRidgeColumns,
  ICE_DIAGONAL_TILES,
  stampCanonicalIceRidge,
  validateIceDiagonalTerrain,
} from "../src/project/defaults/iceDiagonalTerrain.ts";

const width = 12;
const height = 9;
const stamped = stampCanonicalIceRidge(
  { width, height, lower: new Array<number>(width * height).fill(67) },
  { x: 0, y: 0 },
);
if (!stamped.ok) throw new Error(JSON.stringify(stamped.issues));
const issues = validateIceDiagonalTerrain({ width, height, lower: stamped.lower });
if (issues.length > 0) throw new Error(JSON.stringify(issues));

const colors: Record<number, string> = {
  [ICE_DIAGONAL_TILES.left.cap]: "#ff9f43",
  [ICE_DIAGONAL_TILES.left.body]: "#ffd166",
  [ICE_DIAGONAL_TILES.left.base]: "#ef476f",
  [ICE_DIAGONAL_TILES.right.cap]: "#55c2ff",
  [ICE_DIAGONAL_TILES.right.body]: "#6c8cff",
  [ICE_DIAGONAL_TILES.right.base]: "#9b5de5",
  67: "#e8f7ff",
};
const cell = 58;
const cells = stamped.lower.map((tile, index) => {
  const x = index % width;
  const y = Math.floor(index / width);
  return `<g transform="translate(${x * cell} ${y * cell})"><rect width="${cell - 3}" height="${cell - 3}" rx="8" fill="${colors[tile] ?? "#222"}"/><text x="${(cell - 3) / 2}" y="34" text-anchor="middle" font-size="16" font-family="ui-monospace,monospace" fill="#10151d">${tile}</text></g>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width * cell} ${height * cell}">${cells}</svg>`;
const columns = canonicalIceRidgeColumns(0, 0)
  .map((column) => `<tr><td>${column.x}</td><td>${column.topY}</td><td>${column.bottomY}</td><td>${column.face}</td></tr>`)
  .join("");
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>얼음 던전 정본 보고서</title><style>body{margin:auto;max-width:1100px;padding:32px;background:#0d1420;color:#eaf5ff;font:15px/1.6 system-ui}h1{font-size:30px}.hero{background:#142338;border:1px solid #31506d;border-radius:18px;padding:22px}.map{display:block;width:100%;image-rendering:pixelated}code{color:#7dd3fc}table{border-collapse:collapse;margin-top:18px}td,th{padding:7px 12px;border:1px solid #31506d;text-align:left}</style></head><body><h1>얼음 던전 정본</h1><section class="hero"><p><code>map_g_ice_grand</code>에서 추출한 12열 능선을 공용 모듈로 재생성한 결과입니다. 검증 위반: <b>0</b>.</p><div class="map">${svg}</div></section><table><thead><tr><th>x</th><th>topY</th><th>bottomY</th><th>face</th></tr></thead><tbody>${columns}</tbody></table></body></html>`;
const output = path.resolve("output/html/ice-canonical-report/index.html");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(output);
