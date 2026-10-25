// 거리 건물 문 앞이 큰길에서 걸어서 닿지 않으면 compose 가 경고하고 link_jp_city_interior 가 거부한다.
// 2026-10-25 시타마치(shotengai seed 11, 40×28): 남쪽 줄 건물 문 넷이 맵 끝 뒷골목에 갇혀 실내에 들어갈 수 없었다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";

function street() {
  const project = createBlankProject();
  project.tilesets[JP_CITY_ID] = createJpCityTileset();
  const hub = createStarterMap();
  Object.assign(hub, { id: "hub", name: "상점가", tilesetId: JP_CITY_ID, width: 40, height: 28 });
  hub.lowerTiles = new Array(40 * 28).fill(blankFillTileFor(JP_CITY_ID));
  hub.upperTiles = new Array(40 * 28).fill(-1);
  project.maps.hub = hub;
  const ctx = { project, assistantRun: false };
  const composed = runTool(ctx, "compose_jp_city_street", { mapId: "hub", style: "shotengai", seed: 11, replace: true }, { dryRun: false });
  expect(composed.ok, composed.summary).toBe(true);
  const room = runTool(ctx, "build_hand_interior_room", { mapId: "room", name: "빵집", tileset: "modern_city", replace: true, layout: { program: "mc_bakery_cafe", seed: 7, furnish: true } }, { dryRun: false });
  expect(room.ok, room.summary).toBe(true);
  return { ctx, composed };
}

describe("jp_city 거리 문 닿음", () => {
  it("compose 가 큰길에서 닿지 않는 문을 경고하고 이름표에 적는다", () => {
    const { ctx, composed } = street();
    expect(JSON.stringify(composed)).toMatch(/걸어서 닿지 않는 건물 문/u);
    const dead = (ctx.project.maps.hub!.locations ?? []).filter((l) => (l.note ?? "").includes("닿지 않음"));
    expect(dead.length).toBeGreaterThan(0);
  });

  it("link_jp_city_interior 는 닿지 않는 문을 거부하고 닿는 문은 잇는다", () => {
    const { ctx } = street();
    const notes = (ctx.project.maps.hub!.locations ?? []).filter((l) => (l.tags ?? []).includes("jp-building")).map((l) => l.note ?? "");
    const doorOf = (note: string) => { const m = /문 \((\d+),(\d+)\)/u.exec(note)!; return { x: Number(m[1]), y: Number(m[2]) }; };
    const dead = notes.find((n) => n.includes("닿지 않음"))!;
    const live = notes.find((n) => !n.includes("닿지 않음"))!;
    const refused = runTool(ctx, "link_jp_city_interior", { mapId: "hub", door: doorOf(dead), interiorMapId: "room" }, { dryRun: false });
    expect(refused.ok).toBe(false);
    expect(JSON.stringify(refused.issues)).toMatch(/door-unreachable|닿지 않는다/u);
    const linked = runTool(ctx, "link_jp_city_interior", { mapId: "hub", door: doorOf(live), interiorMapId: "room" }, { dryRun: false });
    expect(linked.ok, linked.summary).toBe(true);
  });
});
