// 『첫사랑』 오프닝 몽타주 배경 — 게임 맵 그 자체를 1:1(16px 칸)로 굽는다(새 그림 생성 없음).
//
// 사용자 2026-10-25(C 안): 애니 오프닝풍 몽타주 — 벚꽃 거리, 지하철, 사무실, 노을 옥상. 그림은 게임 안의 같은 맵이어야
// 플레이 화면과 화풍이 갈리지 않는다. 인물·표식 이벤트는 지우고 굽는다(배우는 오프닝 레이어로 따로 걷는다).
//
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/first-love/bake_opening_backdrops.mts
//   → public/assets/first-love/opening/*.png (FIRST_LOVE_OPENING_BACKDROPS 의 crop 그대로)
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { renderMapPng } from "../../qa-game/render.mts";
import { createFlagshipDemoProject } from "../../../src/project/flagship/index.ts";
import { FIRST_LOVE_OPENING_BACKDROPS } from "../../../src/assets/firstLoveOpeningBackdrops.ts";

const OUT = "public/assets/first-love/opening";
const { project } = createFlagshipDemoProject("first-love");
project.startMapId = "__opening_bake__";

const cache = new Map<string, PNG>();
function render(mapId: string): PNG {
  const hit = cache.get(mapId);
  if (hit) return hit;
  const map = project.maps[mapId];
  if (!map) throw new Error(`맵 없음: ${mapId}`);
  const { png, note } = renderMapPng(project, { ...map, events: [] }, 1);
  if (note) throw new Error(`${mapId}: ${note}`);
  const image = PNG.sync.read(png);
  cache.set(mapId, image);
  return image;
}

fs.mkdirSync(OUT, { recursive: true });
for (const backdrop of FIRST_LOVE_OPENING_BACKDROPS) {
  const source = render(backdrop.mapId);
  const { x, y, width, height } = backdrop.crop;
  if (x < 0 || y < 0 || x + width > source.width || y + height > source.height) throw new Error(`${backdrop.id}: 자르기 ${x},${y} ${width}×${height} 가 맵 ${source.width}×${source.height} 밖`);
  const out = new PNG({ width, height });
  PNG.bitblt(source, out, x, y, width, height, 0, 0);
  const file = path.join(OUT, backdrop.fileName);
  fs.writeFileSync(file, PNG.sync.write(out));
  console.log(`${backdrop.id}: ${backdrop.mapId} (${x},${y}) ${width}×${height} → ${file}`);
}
