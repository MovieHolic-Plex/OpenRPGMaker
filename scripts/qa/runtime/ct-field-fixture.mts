// ct-field 시나리오 픽스처 — 크로노 트리거식 필드 기능을 편집기 도구(runTool)로만 저작한다.
//   node node_modules/vite-node/vite-node.mjs --script scripts/qa/runtime/ct-field-fixture.mts > project.json
// 시작 맵(20×15, 시작 10,8)에 파티 3명 + fromParty, 턱 칸 (4,4)(아래로만), 선두 교대 이벤트 (15,8),
// 시간의 문 (시작 맵 ↔ 과거 맵). 엔진 계약 픽스처이며 데모 콘텐츠로 출하하거나 원격에 저장하지 않는다.
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

export const LEDGE_TILE = 6;
export const LEDGE_CELL = { x: 4, y: 4 } as const;
export const LEAD_EVENT_ID = "ev_ct_lead_mage";
export const LEAD_EVENT_CELL = { x: 15, y: 8 } as const;
export const PAST_MAP_ID = "map_ct_past";

const project = createBlankProject();
project.meta.title = "CT field contract";
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

call("set_party", { scope: "start", actorIds: ["actor_hero", "actor_guardian", "actor_mage"] });
call("configure_companion_rules", { fromParty: true });
call("set_tile_rules", { tilesetId, entries: [{ tile: LEDGE_TILE, ledge: "down" }] });
call("paint_tiles", { mapId: startMapId, layer: "1", mode: "cells", tile: LEDGE_TILE, cells: [LEDGE_CELL] });
call("upsert_event", {
  mapId: startMapId,
  event: {
    id: LEAD_EVENT_ID,
    x: LEAD_EVENT_CELL.x,
    y: LEAD_EVENT_CELL.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: `${LEAD_EVENT_ID}_page`,
      name: "선두 교대",
      conditions: [],
      graphic: { transparent: true },
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "changeParty", actorId: "actor_mage", action: "lead" }],
    }],
  },
});
call("create_map", { id: PAST_MAP_ID, name: "과거", width: 12, height: 10, tilesetId });
call("create_time_gate", { a: { mapId: startMapId, x: 17, y: 12 }, b: { mapId: PAST_MAP_ID, x: 6, y: 5 }, name: "시간의 문" });

const json = serialize(ctx.project);
const reloaded = deserialize(json);
if (reloaded.tilesets[tilesetId]?.ledgeDirections?.[String(LEDGE_TILE)] !== "down") {
  console.error("ledgeDirections did not survive serialize/deserialize");
  process.exit(1);
}
if (reloaded.maps[startMapId]!.lowerTiles[LEDGE_CELL.y * reloaded.maps[startMapId]!.width + LEDGE_CELL.x] !== LEDGE_TILE) {
  console.error("ledge tile was not painted at the ledge cell");
  process.exit(1);
}
process.stdout.write(json);
