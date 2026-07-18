// 실내 오두막: tile_query 라벨 ↔ place_props material 일치, 상점 NPC 중복 방지.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { TILE } from "@/project/defaults/constants";

function interiorHutContext(): ToolContext {
  const project = createBlankProject();
  const mapId = "map_rp_hut_v1";
  const w = 10;
  const h = 9;
  const size = w * h;
  project.maps[mapId] = {
    id: mapId,
    name: "연습 · 오두막 (10×9)",
    width: w,
    height: h,
    tilesetId: INTERIOR_ROOM_TILESET_ID,
    tileSize: 16,
    lowerTiles: new Array(size).fill(72),
    upperTiles: new Array(size).fill(TILE.EMPTY),
    events: [],
  };
  project.startMapId = mapId;
  return { project };
}

describe("interior shop NPC + table material path", () => {
  it("tile_query labels for start interior map resolve with place_props 사각 탁자", () => {
    const ctx = interiorHutContext();
    const labels = runTool(ctx, "tile_query", { ask: "labels", query: "탁자" }, { dryRun: true });
    expect(labels.ok, labels.summary).toBe(true);
    const data = labels.data as { tilesetId: string; labels: { label: string }[] };
    expect(data.tilesetId).toBe(INTERIOR_ROOM_TILESET_ID);
    const tableLabel = data.labels.find((l) => l.label.includes("사각") || l.label.includes("긴 탁자") || l.label.includes("원형"))?.label;
    expect(tableLabel, JSON.stringify(data.labels.slice(0, 8))).toBeTruthy();

    const place = runTool(
      ctx,
      "place_props",
      {
        mapId: "map_rp_hut_v1",
        area: { x: 2, y: 4, w: 5, h: 2 },
        material: tableLabel!,
        count: 1,
      },
      { dryRun: false },
    );
    expect(place.ok, place.summary).toBe(true);
  });

  it("places 사각 탁자 on interior wood floor (not outdoor grass-only footprint)", () => {
    const ctx = interiorHutContext();
    const place = runTool(
      ctx,
      "place_props",
      {
        mapId: "map_rp_hut_v1",
        area: { x: 2, y: 4, w: 5, h: 2 },
        material: "사각 탁자",
        count: 1,
      },
      { dryRun: false },
    );
    expect(place.ok, place.summary).toBe(true);
    const map = ctx.project.maps["map_rp_hut_v1"]!;
    expect(map.upperTiles.includes(328)).toBe(true);
    expect(place.summary).toMatch(/1\/1|1개/);
  });

  it("rejects combined-town table labels on interior map", () => {
    const ctx = interiorHutContext();
    const place = runTool(
      ctx,
      "place_props",
      {
        mapId: "map_rp_hut_v1",
        area: { x: 2, y: 4, w: 5, h: 2 },
        material: "가로 탁자 중",
        count: 1,
      },
      { dryRun: false },
    );
    expect(place.ok).toBe(false);
    expect(place.summary).toMatch(/라벨|찾지 못했|material/i);
  });

  it("merges nearby shop NPCs even when the second call uses a different explicit id", () => {
    const ctx = interiorHutContext();
    const mapId = "map_rp_hut_v1";
    const first = runTool(
      ctx,
      "place_npc",
      {
        mapId,
        x: 4,
        y: 5,
        id: "npc_shopkeeper_1",
        name: "상점 주인",
        pages: [{ lines: ["어서 오세요!"] }],
      },
      { dryRun: false },
    );
    expect(first.ok, first.summary).toBe(true);

    const second = runTool(
      ctx,
      "place_npc",
      {
        mapId,
        x: 4,
        y: 4,
        id: "npc_merchant_v1",
        name: "상인",
        graphic: { query: "merchant" },
        pages: [{ text: "어서 오세요!", conditions: [] }],
      },
      { dryRun: false },
    );
    expect(second.ok, second.summary).toBe(true);
    const data = second.data as { eventId: string; reused?: boolean };
    expect(data.eventId).toBe("npc_shopkeeper_1");
    expect(data.reused).toBe(true);
    expect(ctx.project.maps[mapId]!.events).toHaveLength(1);
  });

  it("allows a second distinct NPC when ids are explicit", () => {
    const ctx = interiorHutContext();
    const mapId = "map_rp_hut_v1";
    runTool(ctx, "place_npc", {
      mapId, x: 2, y: 4, id: "npc_a", name: "갑", pages: [{ lines: ["a"] }],
    }, { dryRun: false });
    const second = runTool(ctx, "place_npc", {
      mapId, x: 3, y: 4, id: "npc_b", name: "을", pages: [{ lines: ["b"] }],
    }, { dryRun: false });
    expect(second.ok, second.summary).toBe(true);
    expect(ctx.project.maps[mapId]!.events).toHaveLength(2);
  });
});
