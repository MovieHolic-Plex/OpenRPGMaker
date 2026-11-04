// 『폴른 스타』 오프닝 「왕도의 밤 거리」 컷 그림 — 구운 프로젝트의 왕도(fs_hub)를 1배 그대로 그린다(사람·이벤트 표식 없이). 새 화소 없음.
// 마을을 고치면(fallen/worldPass 간판·공방·이정표) 다시 굽고 이 스크립트로 그림을 다시 뽑는다 — 「마을이 바뀌면 오프닝도 바뀌어야함」(사용자 2026-11-04).
//   node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/content/fallen-star-opening-town-street.mts <chrono-bell.project.json>
import fs from "node:fs";
import { PNG } from "pngjs";
import { loadProjectFile } from "../qa-game/check.mts";
import { renderMapPng } from "../qa-game/render.mts";
import { FS_OPENING_STREET_CROP } from "../../src/assets/fallenStarOpeningBackdrops";

const [file] = process.argv.slice(2);
if (!file) throw new Error("usage: fallen-star-opening-town-street.mts <chrono-bell.project.json>");
const { project } = loadProjectFile(file);
const hub = project.maps.fs_hub;
if (!hub) throw new Error("fs_hub 이 없다");
const { png } = renderMapPng(project, { ...hub, events: [] }, 1);
const src = PNG.sync.read(png);
const { x, y, width, height } = FS_OPENING_STREET_CROP;
const out = new PNG({ width, height });
for (let row = 0; row < height; row += 1) {
  src.data.copy(out.data, row * width * 4, ((y + row) * src.width + x) * 4, ((y + row) * src.width + x + width) * 4);
}
const target = "public/assets/fallen-star/opening/art/town-street.png";
fs.writeFileSync(target, PNG.sync.write(out));
console.log(target, `${width}×${height}`, `from fs_hub px (${x},${y})`);
