// ct-vehicle-walkers 시나리오 픽스처 — 걷는 탈것 셋(초코보·광산 수레·뗏목)을 편집기 도구(runTool)로만 저작한다 (2026-10-15, FF6급 감사 #28).
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/ct-vehicle-walkers-fixture.mts > project.json
// 시작 맵(20×15, 시작 10,8, 바닥 잔디 737). 새 도트 없음 — 기존 Animal·Vehicles 걷기 칩을 쓴다.
//   초코보: (2,2) 에 서 있다. (4..6, 1..3) 는 나무·덤불 3×3(통행 불가, 칸 이름표 tree) — 걷는 사람은 막히고 초코보는 지난다. (8,2) 는 호수 한 칸(물 8번)이라 초코보도 못 간다.
//   광산 수레: (2,10) 에 서 있다. y=10, x=2..12 가 레일 칸(판석 759 + 지형 terrain_rail 의 vehiclePassage.cart) — 수레는 레일에서만 달린다.
//   뗏목: (16,5) 에 서 있다. x=16, y=1..13 은 강(물 9번 + 지형 terrain_river raft 참). (17,5) 는 바다(물 10번 + terrain_sea raft 거짓 — 뗏목은 바다에 못 나간다).
// 엔진 계약 픽스처이며 데모 콘텐츠로 출하하거나 원격에 저장하지 않는다.
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const WATER = 8;
const RIVER = 9;
const SEA = 10;
const TREE = 534;
const RAIL = 759;

const project = createBlankProject();
project.meta.title = "CT vehicle walkers contract";
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
const rect = (x0: number, y0: number, x1: number, y1: number) => {
  const cells: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) cells.push({ x, y });
  return cells;
};
const paint = (tile: number, cells: { x: number; y: number }[]) => call("paint_tiles", { mapId: startMapId, layer: "1", mode: "cells", tile, cells });
const terrain = (id: string, name: string, passage: Record<string, boolean>) => call("upsert_database_utility", {
  collection: "terrains",
  record: { id, name, damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: false, ...passage } },
});

call("set_party", { scope: "start", actorIds: ["actor_hero"] });
terrain("terrain_rail", "광산 레일", { cart: true, airshipLand: true });
terrain("terrain_river", "강", { boat: true, raft: true });
terrain("terrain_sea", "바다", { boat: true, ship: true, raft: false });
const tags = () => ctx.project.database.terrains!.map((t) => t.id);
const tagOf = (id: string) => tags().indexOf(id) + 1;
call("set_tile_rules", { tilesetId, entries: [
  { tile: RAIL, terrainTag: tagOf("terrain_rail") },
  { tile: RIVER, terrainTag: tagOf("terrain_river") },
  { tile: SEA, terrainTag: tagOf("terrain_sea") },
] });
paint(TREE, rect(4, 1, 6, 3));
paint(WATER, [{ x: 8, y: 2 }]);
paint(RAIL, rect(2, 10, 12, 10));
paint(RIVER, rect(16, 1, 16, 13));
paint(SEA, [{ x: 17, y: 5 }]);
call("place_vehicle", { vehicle: "chocobo", mapId: startMapId, x: 2, y: 2 });
call("place_vehicle", { vehicle: "cart", mapId: startMapId, x: 2, y: 10 });
call("place_vehicle", { vehicle: "raft", mapId: startMapId, x: 16, y: 5 });

// 규칙 위반 경고·모르는 인자 거절이 실제로 동작하는지 같이 본다.
const failures: string[] = [];
const bad = runTool(ctx, "place_vehicle", { vehicle: "cart", mapId: startMapId, x: 5, y: 5 });
if (!bad.ok || !(bad.diff?.warnings ?? []).some((w) => w.includes("레일"))) failures.push(`cart off rail must warn: ${JSON.stringify(bad.diff?.warnings)}`);
call("place_vehicle", { vehicle: "cart", mapId: startMapId, x: 2, y: 10 });
const unknown = runTool(ctx, "place_vehicle", { vehicle: "cart", mapId: startMapId, x: 2, y: 10, speed: 9 });
if (unknown.ok) failures.push("unknown key `speed` must be rejected");

const json = serialize(ctx.project);
const reloaded = deserialize(json);
const map = reloaded.maps[startMapId]!;
const at = (x: number, y: number): number => map.lowerTiles[y * map.width + x]!;
if (reloaded.system.vehicles?.length !== 3) failures.push(`system.vehicles did not survive reload: ${JSON.stringify(reloaded.system.vehicles)}`);
if (at(5, 2) !== TREE || at(8, 2) !== WATER || at(7, 10) !== RAIL || at(16, 7) !== RIVER || at(17, 5) !== SEA) failures.push("tiles not painted as designed");
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
process.stdout.write(json);
