// ct-vehicle-mode7 시나리오 픽스처 — 비행 시점 모드7(system.vehicles[비행선].flightView)을 편집기 도구(runTool)로만 저작한다 (2026-10-15, FF6급 감사 #31).
//   QA_FLIGHT_VIEW=mode7|flat node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/ct-vehicle-mode7-fixture.mts > project.json
// 64×48 맵 한가운데(32,24)에 비행선, 호수·판석 길·나무 줄로 원근이 보이게 땅을 나눈다. flat 이면 flightView 를 주지 않는다(기준 그림·프레임 시간 비교용).
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const view = process.env.QA_FLIGHT_VIEW === "flat" ? "flat" : "mode7";
const project = createBlankProject();
project.meta.title = "CT vehicle mode7 contract";
delete project.system.opening;
const ctx = { project };
const startMapId = project.startMapId;
function call(name: string, args: Record<string, unknown>): void {
  const result = runTool(ctx, name, args);
  if (!result.ok) { console.error(`${name}: ${result.summary}`); process.exit(1); }
}
const rect = (x0: number, y0: number, x1: number, y1: number) => {
  const cells: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) cells.push({ x, y });
  return cells;
};
const paint = (tile: number, cells: { x: number; y: number }[]) => call("paint_tiles", { mapId: startMapId, layer: "1", mode: "cells", tile, cells });
call("resize_map", { mapId: startMapId, width: 64, height: 48 });
call("set_start_position", { mapId: startMapId, x: 31, y: 24 });
paint(8, rect(4, 4, 20, 14));
paint(8, rect(44, 30, 60, 44));
paint(759, rect(0, 20, 63, 20));
paint(759, rect(0, 28, 63, 28));
paint(759, rect(28, 0, 28, 47));
paint(759, rect(36, 0, 36, 47));
for (const y of [8, 12, 16, 32, 36, 40]) paint(534, rect(0, y, 63, y).filter((cell) => cell.x % 3 !== 0));
call("place_vehicle", { vehicle: "airship", mapId: startMapId, x: 32, y: 24, ...(view === "mode7" ? { flightView: "mode7" } : {}) });
const bad = runTool(ctx, "place_vehicle", { vehicle: "airship", mapId: startMapId, x: 32, y: 24, flightView: "oblique" });
if (bad.ok) { console.error("unknown flightView must be rejected"); process.exit(1); }
const unknown = runTool(ctx, "place_vehicle", { vehicle: "airship", mapId: startMapId, x: 32, y: 24, tilt: 30 });
if (unknown.ok) { console.error("unknown key must be rejected"); process.exit(1); }
const reloaded = deserialize(serialize(ctx.project));
const airship = reloaded.system.vehicles?.find((entry) => entry.id === "airship");
if (!airship || (airship.flightView === "mode7") !== (view === "mode7")) { console.error(`flightView did not survive reload: ${JSON.stringify(airship)}`); process.exit(1); }
process.stdout.write(serialize(ctx.project));
