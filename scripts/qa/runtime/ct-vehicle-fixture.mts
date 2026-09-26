// ct-vehicle 시나리오 픽스처 — 탈것(소형선·비행선)을 편집기 도구(runTool)로만 저작한다.
//   node node_modules/vite-node/vite-node.mjs --script scripts/qa/runtime/ct-vehicle-fixture.mts > project.json
// 시작 맵(20×15, 시작 10,8)에 파티 2명 + fromParty.
//   호수: (2..7, 2..6) 물 오토타일 0 — 지형 태그 3(terrain_water: boat/ship 허용), 걸어서는 못 들어간다.
//   기본 forest_harmony 의 물(0,1,2,30,31,32)은 태그 1(= terrain_grassland, 배 불가)이라 여기서 3 으로 바꾼다.
//   소형선: (7,4) 호수 오른쪽 끝. 주인공은 (8,4) 에서 왼쪽을 보고 탄다.
//   벽: x=13 세로 한 줄(타일 42, 통행 불가). 비행선은 (11,10) 잔디(태그 0, 착륙 불가)에 선다.
//   착륙장: (16,10) 타일 270 — 지형 태그 1(terrain_grassland: airshipLand 허용).
// 엔진 계약 픽스처이며 데모 콘텐츠로 출하하거나 원격에 저장하지 않는다.
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

export const WATER_TILE = 0;
// 물은 오토타일이라 칠하면 이웃에 맞춰 같은 무리로 바뀐다 — query_tiles role "water" 전체(실측 0,1,2,30,31,32)에 규칙을 준다.
const WATER_MEMBERS = [0, 1, 2, 30, 31, 32];
export const WALL_TILE = 42;
export const LANDING_TILE = 270;

const project = createBlankProject();
project.meta.title = "CT vehicle contract";
const ctx = { project };
const startMapId = project.startMapId;
const tilesetId = project.maps[startMapId]!.tilesetId;

function call(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    console.error(`${name}: ${result.summary}`);
    process.exit(1);
  }
  return (result.data ?? {}) as Record<string, unknown>;
}

call("set_party", { scope: "start", actorIds: ["actor_hero", "actor_guardian"] });
call("configure_companion_rules", { fromParty: true });
call("set_tile_rules", {
  tilesetId,
  entries: [
    ...WATER_MEMBERS.map((tile) => ({ tile, passable: false, terrainTag: 3 })),
    { tile: LANDING_TILE, terrainTag: 1 },
  ],
});
call("paint_tiles", {
  mapId: startMapId, layer: "1", mode: "cells", tile: WATER_TILE,
  cells: Array.from({ length: 30 }, (_, i) => ({ x: 2 + (i % 6), y: 2 + Math.floor(i / 6) })),
});
call("paint_tiles", {
  mapId: startMapId, layer: "1", mode: "cells", tile: WALL_TILE,
  cells: Array.from({ length: 15 }, (_, y) => ({ x: 13, y })),
});
call("paint_tiles", { mapId: startMapId, layer: "1", mode: "cells", tile: LANDING_TILE, cells: [{ x: 16, y: 10 }] });
call("place_vehicle", { vehicle: "boat", mapId: startMapId, x: 7, y: 4 });
call("place_vehicle", { vehicle: "airship", mapId: startMapId, x: 11, y: 10 });

const json = serialize(ctx.project);
const reloaded = deserialize(json);
const map = reloaded.maps[startMapId]!;
const at = (x: number, y: number): number => map.lowerTiles[y * map.width + x]!;
const tagAt = (x: number, y: number): number => reloaded.tilesets[tilesetId]!.terrain[at(x, y)] ?? 0;
const failures: string[] = [];
if (reloaded.system.vehicles?.length !== 2) failures.push(`system.vehicles did not survive reload: ${JSON.stringify(reloaded.system.vehicles)}`);
for (let y = 2; y <= 6; y += 1) for (let x = 2; x <= 7; x += 1) {
  if (!WATER_MEMBERS.includes(at(x, y)) || tagAt(x, y) !== 3) failures.push(`lake cell (${x},${y}) = tile ${at(x, y)} tag ${tagAt(x, y)}`);
}
if (tagAt(8, 4) !== 0) failures.push(`shore (8,4) must be plain ground, tag ${tagAt(8, 4)}`);
if (at(13, 5) !== WALL_TILE) failures.push(`wall not painted: ${at(13, 5)}`);
if (at(16, 10) !== LANDING_TILE) failures.push(`landing pad not painted: ${at(16, 10)}`);
if (tagAt(16, 10) !== 1 || tagAt(11, 10) !== 0) failures.push(`landing tags: pad ${tagAt(16, 10)} start ${tagAt(11, 10)}`);
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
process.stdout.write(json);
