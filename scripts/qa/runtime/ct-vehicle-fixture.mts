// ct-vehicle 시나리오 픽스처 — 탈것(소형선·비행선)을 편집기 도구(runTool)로만 저작한다.
//   node node_modules/vite-node/vite-node.mjs --script scripts/qa/runtime/ct-vehicle-fixture.mts > project.json
// 시작 맵(20×15, 시작 10,8)에 파티 2명 + fromParty.
//   호수: (2..7, 2..6) 번들 버들항 물 칸(8번, 칸 이름표 water) — **기본값 그대로**. 버들항은 지형 태그를 주지 않으므로
//   배의 통행은 칸 이름표 water 로 정해진다(vehicleCanEnter). 물 규칙을 여기서 손대지 않는 것이 기본값 검증이다.
//   (2026-10-15: 새 프로젝트 기본 칩셋이 숲마을 → 버들항이 되면서 옛 픽스처의 물 0번·벽 42번이 다른 그림이 됐다.)
//   소형선: (7,4) 호수 오른쪽 끝. 주인공은 (8,4) 에서 왼쪽을 보고 탄다.
//   벽: x=13 세로 한 줄(타일 42, 통행 불가). 비행선은 (11,10) 돌바닥(타일 270, 태그 4 = terrain_stone)에 서 있고,
//   그 지형만 airshipLand 를 끈다(upsert_database_utility) — 착륙 거절 칸.
//   착륙장: (16,10) 보통 잔디(태그 0, 지형 기록 없음) — 걸을 수 있는 보통 땅은 착륙할 수 있다.
// 엔진 계약 픽스처이며 데모 콘텐츠로 출하하거나 원격에 저장하지 않는다.
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

export const WATER_TILE = 8;
export const WALL_TILE = 408;
export const NO_LANDING_TILE = 759;

const project = createBlankProject();
project.meta.title = "CT vehicle contract";
// 새 프로젝트는 기본 오프닝(글·그림 컷)을 갖는다 — 컷이 도는 동안 입력이 잠겨 beat 의 첫 확인 키가 사라졌다. 이 계약은 필드만 본다.
delete project.system.opening;
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
call("set_tile_rules", { tilesetId, entries: [{ tile: NO_LANDING_TILE, terrainTag: 4 }] });
call("upsert_database_utility", {
  collection: "terrains",
  record: {
    id: "terrain_stone", name: "돌", damage: 0, encounterRatePercent: 50, characterDisplay: "normal",
    vehiclePassage: { boat: false, ship: false, airshipLand: false },
  },
});
call("paint_tiles", {
  mapId: startMapId, layer: "1", mode: "cells", tile: WATER_TILE,
  cells: Array.from({ length: 30 }, (_, i) => ({ x: 2 + (i % 6), y: 2 + Math.floor(i / 6) })),
});
call("paint_tiles", {
  mapId: startMapId, layer: "1", mode: "cells", tile: WALL_TILE,
  cells: Array.from({ length: 15 }, (_, y) => ({ x: 13, y })),
});
call("paint_tiles", { mapId: startMapId, layer: "1", mode: "cells", tile: NO_LANDING_TILE, cells: [{ x: 11, y: 10 }] });
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
  if (at(x, y) !== WATER_TILE || !reloaded.tilesets[tilesetId]!.tileMeta?.[at(x, y)]?.tags?.includes("water")) failures.push(`lake cell (${x},${y}) = tile ${at(x, y)} tag ${tagAt(x, y)}`);
}
if (tagAt(8, 4) !== 0) failures.push(`shore (8,4) must be plain ground, tag ${tagAt(8, 4)}`);
if (at(13, 5) !== WALL_TILE) failures.push(`wall not painted: ${at(13, 5)}`);
if (at(11, 10) !== NO_LANDING_TILE) failures.push(`no-landing tile not painted: ${at(11, 10)}`);
if (tagAt(16, 10) !== 0 || tagAt(11, 10) !== 4) failures.push(`landing tags: pad ${tagAt(16, 10)} start ${tagAt(11, 10)}`);
if (reloaded.database.terrains?.[0]?.id !== "terrain_water" || reloaded.database.terrains[0].vehiclePassage.boat !== true) failures.push(`default terrain 1 must be water: ${JSON.stringify(reloaded.database.terrains?.[0])}`);
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
process.stdout.write(json);
