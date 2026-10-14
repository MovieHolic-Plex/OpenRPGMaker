// modern_city 거리 구성기 QA — compose_modern_city_street 도구 그대로 지어 칸 배열 JSON 으로(render_map.py 로 그림).
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/compose-street.mts OUT.json [W H seed …]
import { writeFileSync } from "node:fs";
import { COMPOSE_MODERN_CITY_STREET_TOOL } from "@/editor/tools/modernCityTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createModernCityTileset } from "@/project/defaults/modernCity";
import { composedLayoutMapIds } from "@/ai/piAgent/layoutQuality";
const [out, ...rest] = process.argv.slice(2);
const sizes: [number, number, number][] = [];
for (let i = 0; i + 2 < rest.length; i += 3) sizes.push([Number(rest[i]), Number(rest[i + 1]), Number(rest[i + 2])]);
if (!sizes.length) sizes.push([60, 48, 0], [60, 48, 1], [60, 48, 2], [80, 60, 3], [48, 36, 4], [90, 72, 5]);
const project = createEmptyToolProject("mcs");
project.tilesets.modern_city = createModernCityTileset();
const maps: Record<string, unknown> = {};
let bad = 0;
for (const [W, H, seed] of sizes) {
  const id = `mcs-${W}x${H}-s${seed}`;
  const walk = project.tilesets.modern_city.tileGroups!.find((g) => g.id === "mc:sidewalk")!.tileIds[0]!;
  project.maps[id] = { id, name: id, width: W, height: H, tilesetId: "modern_city", tileSize: 16, lowerTiles: new Array(W * H).fill(walk), upperTiles: new Array(W * H).fill(-1), events: [] } as never;
  try {
    const r = COMPOSE_MODERN_CITY_STREET_TOOL.run(project, { mapId: id, seed });
    const m = project.maps[id]!;
    maps[id] = { width: W, height: H, lower: m.lowerTiles, lower2: m.lowerOverlayTiles ?? [], upper: m.upperTiles, upper2: m.upperOverlayTiles ?? [], data: r.data };
    console.log(`OK   ${id}: ${r.summary.slice(0, 400)}`);
  } catch (e) { bad++; console.log(`FAIL ${id}: ${(e as Error).message}`); }
}
// 거리 맵은 배치 품질 권고(빈 바닥)에서 빠져야 한다 — composed-layout 이름표.
const skipped = new Set(composedLayoutMapIds(project));
for (const id of Object.keys(maps)) if (!skipped.has(id)) { bad++; console.log(`FAIL ${id}: composed-layout 이름표 없음 — 배치 품질 권고가 거리를 실내로 덮게 시킨다`); }
writeFileSync(out!, JSON.stringify({ maps }));
process.exitCode = bad;
