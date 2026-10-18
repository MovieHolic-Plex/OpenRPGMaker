// 몬스터 수집(에메랄드 결) 오프닝 애니메틱의 배경 그림을 실제 캠페인 맵에서 굽는다.
//
// 사용자 반려(c-1792294716295, 2026-10-18): 오프닝이 빈 크림색 바탕 위 정지 박사 반신상 6장이었다.
// 오프닝 샷(src/project/emeraldMonsterOpening.ts)은 별빛섬 캠페인의 실제 타일 맵을 배경으로 깔고 그 위에서
// 캐릭터 칩·몬스터 그림이 움직인다. 배경은 이벤트(인물·표식)를 지운 맵을 1:1(16px 타일) 그대로 잘라 쓴다 — 늘리거나 줄이지 않는다.
//
//   bun scripts/content/monsters/bake_opening_backdrops.mts            # public/assets/emerald-monster/opening/*.png
//   bun scripts/content/monsters/bake_opening_backdrops.mts --full DIR # 잘라 쓰기 전 맵 전체 그림(자리 고르기용)
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { renderMapPng } from "../../qa-game/render.mts";
import { createMonsterExpedition } from "../../../src/project/examples/monsterExpedition/index.ts";
import { EMERALD_OPENING_BACKDROPS } from "../../../src/assets/emeraldOpeningBackdrops.ts";

const OUT = "public/assets/emerald-monster/opening";

const { project } = createMonsterExpedition();
// 시작 위치 표식을 그리지 않게 시작 맵을 비운다(이 프로젝트는 굽기에만 쓴다).
project.startMapId = "__opening_bake__";

function render(mapId: string): PNG {
  const map = project.maps[mapId];
  if (!map) throw new Error(`맵 없음: ${mapId}`);
  const { png, note } = renderMapPng(project, { ...map, events: [] }, 1);
  if (note) throw new Error(`${mapId}: ${note}`);
  return PNG.sync.read(png);
}

const fullIndex = process.argv.indexOf("--full");
if (fullIndex >= 0) {
  const dir = process.argv[fullIndex + 1] ?? "/tmp/opening-maps";
  fs.mkdirSync(dir, { recursive: true });
  for (const mapId of new Set(EMERALD_OPENING_BACKDROPS.map((b) => b.mapId))) {
    fs.writeFileSync(path.join(dir, `${mapId}.png`), PNG.sync.write(render(mapId)));
    console.log(`${dir}/${mapId}.png`);
  }
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
for (const backdrop of EMERALD_OPENING_BACKDROPS) {
  const source = render(backdrop.mapId);
  const { x, y, width, height } = backdrop.crop;
  if (x + width > source.width || y + height > source.height) throw new Error(`${backdrop.id}: 자르기 ${x},${y} ${width}×${height} 가 맵 ${source.width}×${source.height} 밖`);
  const out = new PNG({ width, height });
  PNG.bitblt(source, out, x, y, width, height, 0, 0);
  const file = path.join(OUT, backdrop.fileName);
  fs.writeFileSync(file, PNG.sync.write(out));
  console.log(`${backdrop.id}: ${backdrop.mapId} (${x},${y}) ${width}×${height} → ${file}`);
}
