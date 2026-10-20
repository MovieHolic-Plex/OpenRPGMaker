// 『폴른 스타』 오프닝·타이틀 배경을 게임 안 실제 맵에서 굽는다.
//
// 감사 1차(2026-10-20, ~/claude-viz/fallen-star-audit-1.html): 오프닝이 생성 페인팅 스틸 위에 2배 칩을 얹은 것이었고
// 그림과 자막이 맞지 않았다. 이제 배경은 게임이 실제로 쓰는 버들항·실내 v5 손 도트 맵을 이벤트 없이 1:1 로 자른다.
// 밤 컷은 달빛 색으로 누르는 것만 한다(늘리거나 줄이지 않는다, 새 화소를 그리지 않는다).
//
//   npx tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/flagship/bake_fallen_star_backdrops.mts
//   ... --project .omo/fs/v2.json   # 이미 지은 프로젝트 JSON 에서 굽기(빠르다)
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { renderMapPng } from "../../qa-game/render.mts";
import { deserialize } from "../../../src/project/io";
import { createChronoBellFlagshipDemo } from "../../../src/project/flagship/chronoBell";
import { FALLEN_STAR_BACKDROPS, type FallenStarBackdropGrade } from "../../../src/assets/fallenStarOpeningBackdrops";

const OUT = "public/assets/fallen-star/opening";

const projectArg = process.argv.indexOf("--project");
const project = projectArg >= 0
  ? deserialize(fs.readFileSync(process.argv[projectArg + 1]!, "utf8"))
  : createChronoBellFlagshipDemo().project;
project.startMapId = "__opening_bake__";

const rendered = new Map<string, PNG>();
function render(mapId: string): PNG {
  const hit = rendered.get(mapId);
  if (hit) return hit;
  const map = project.maps[mapId];
  if (!map) throw new Error(`맵 없음: ${mapId}`);
  const { png, note } = renderMapPng(project, { ...map, events: [] }, 1);
  if (note) throw new Error(`${mapId}: ${note}`);
  const out = PNG.sync.read(png);
  rendered.set(mapId, out);
  return out;
}

/** 밤: 푸른 달빛, 어두운 곳은 더 깊게. 촛불: 실내를 낮추고 따뜻하게. 색 수는 원본 팔레트를 따라 줄어들 뿐 새 무늬는 없다. */
function grade(png: PNG, kind: FallenStarBackdropGrade): void {
  if (kind === "day") return;
  const d = png.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    if (kind === "night") {
      d[i] = Math.round(r * 0.26 + l * 0.08);
      d[i + 1] = Math.round(g * 0.32 + l * 0.12);
      d[i + 2] = Math.round(b * 0.5 + l * 0.26 + 14);
    } else {
      d[i] = Math.round(r * 0.62 + l * 0.08);
      d[i + 1] = Math.round(g * 0.5 + l * 0.06);
      d[i + 2] = Math.round(b * 0.46 + l * 0.08 + 6);
    }
  }
}

fs.mkdirSync(OUT, { recursive: true });
for (const backdrop of FALLEN_STAR_BACKDROPS) {
  const source = render(backdrop.mapId);
  const { x, y, width, height } = backdrop.crop;
  if (x + width > source.width || y + height > source.height) throw new Error(`${backdrop.id}: 자르기 ${x},${y} ${width}×${height} 가 맵 ${source.width}×${source.height} 밖`);
  const out = new PNG({ width, height });
  PNG.bitblt(source, out, x, y, width, height, 0, 0);
  grade(out, backdrop.grade);
  const file = path.join(OUT, backdrop.fileName);
  fs.writeFileSync(file, PNG.sync.write(out));
  console.log(`${backdrop.id}: ${backdrop.mapId} (${x},${y}) ${width}×${height} ${backdrop.grade} → ${file}`);
}
