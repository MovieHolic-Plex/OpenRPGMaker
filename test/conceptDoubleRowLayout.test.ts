import { describe, expect, it } from "vitest";
import { layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { layoutConceptFacilityDoubleRow } from "@/editor/conceptLayoutDoubleRow";
import type { ConceptBundleRecord, ConceptFacilityRecord } from "@/project/types/conceptBundle";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

function ctx(): ToolContext {
  return { project: createBlankProject() };
}

const DOUBLE_PLAN = {
  layout: "double-row",
  places: [
    { id: "bedroom", label: "객실", role: "room", size: "s", count: 2, zone: "north" },
    { id: "kitchen", label: "주방", role: "room", size: "s", zone: "south" },
    { id: "storage", label: "창고", role: "room", size: "s", zone: "south" },
    { id: "corridor", label: "복도", role: "walkway" },
    { id: "hall", label: "홀", role: "entrance", size: "l" },
  ],
  things: [
    { objectId: "bed_h", placeIds: ["bedroom"], chips: ["block", "event", "sleep"], required: true },
    { objectId: "stove", placeIds: ["kitchen"], chips: ["block", "event"], required: true },
    { objectId: "barrel", placeIds: ["storage"], chips: ["block"] },
    { objectId: "counter", placeIds: ["hall"], chips: ["block", "event"], required: true },
    { objectId: "table_chairs", placeIds: ["hall"], chips: ["block"] },
    { objectId: "window", placeIds: ["bedroom", "hall"], chips: ["wall"] },
  ],
} as const;

type Rooms = { roomId: string; placeId: string; role: string; x: number; y: number; w: number; h: number }[];

describe("place_concept double-row 도면", () => {
  it("모르는 layout 은 invalid-plan 으로 거절한다", () => {
    const result = runTool(ctx(), "place_concept", {
      query: "여관",
      mapId: "map_inn_spiral",
      plan: { layout: "spiral", places: [{ id: "hall", role: "entrance" }], things: [] },
    }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.some((issue) => issue.code === "invalid-plan" && /layout/.test(issue.message))).toBe(true);
  });

  it("double-row 는 복도 북쪽과 남쪽에 방이 서고, 같은 장소의 row 도면보다 좁다", () => {
    const rowCtx = ctx();
    const doubleCtx = ctx();
    const row = runTool(rowCtx, "place_concept", {
      query: "여관",
      mapId: "map_inn_row",
      seed: 7,
      plan: { ...DOUBLE_PLAN, layout: "row" },
    }, { dryRun: false });
    const doubled = runTool(doubleCtx, "place_concept", {
      query: "여관",
      mapId: "map_inn_double",
      seed: 7,
      plan: DOUBLE_PLAN,
    }, { dryRun: false });
    expect(row.ok, row.summary).toBe(true);
    expect(doubled.ok, doubled.summary).toBe(true);
    const rooms = (doubled.data as { rooms: Rooms }).rooms;
    const corridor = rooms.find((room) => room.role === "walkway");
    expect(corridor, "복도가 없다").toBeDefined();
    expect(rooms.some((room) => room.role === "room" && room.y + room.h <= corridor!.y), "복도 북쪽 방 없음").toBe(true);
    expect(rooms.some((room) => room.role === "room" && room.y >= corridor!.y + corridor!.h), "복도 남쪽 방 없음").toBe(true);
    const rowMap = rowCtx.project.maps.map_inn_row!;
    const doubleMap = doubleCtx.project.maps.map_inn_double!;
    expect(doubleMap.width, `double ${doubleMap.width} vs row ${rowMap.width}`).toBeLessThan(rowMap.width);
    const unplaced = [...(doubled.warnings ?? []), ...(doubled.diff?.warnings ?? [])].filter((line) => line.includes("자리 없음"));
    expect(unplaced, unplaced.join(" / ")).toEqual([]);
  });

  it("BUILTIN에 없는 장소는 theme이 placeId 그대로, 복도는 corridor다", () => {
    const bundle: ConceptBundleRecord = {
      id: "t",
      label: "T",
      facilities: [{ id: "f", label: "F", placeIds: ["living", "corridor"] }],
      places: [
        { id: "living", label: "거실", role: "room", size: "m" },
        { id: "corridor", label: "복도", role: "walkway" },
      ],
      things: [],
    };
    const facility: ConceptFacilityRecord = bundle.facilities[0]!;
    for (const layout of [layoutConceptFacility(bundle, facility), layoutConceptFacilityDoubleRow(bundle, facility)]) {
      const living = layout.rooms.find((room) => room.placeId === "living")!;
      const walkway = layout.rooms.find((room) => room.role === "walkway")!;
      expect(living.theme).toBe("living");
      expect(walkway.theme).toBe("corridor");
    }
  });
});


describe("row/double-row legacy walkway contract", () => {
  it.each([
    [{ id: "passage", label: "Hall" }, "walkway"],
    [{ id: "passage", label: "corridor" }, "walkway"],
    [{ id: "corridor", label: "연결" }, "walkway"],
    [{ id: "hall", label: "홀" }, "room"],
    [{ id: "hall", label: "Hall", role: "entrance" }, "entrance"],
    [{ id: "hall", label: "Hall", role: "room" }, "room"],
  ] as const)("%j resolves to %s in both layouts", (place, role) => {
    const bundle: ConceptBundleRecord = {
      id: "test", label: "Test", facilities: [{ id: "f", label: "F", placeIds: [place.id] }],
      places: [{ ...place }], things: [],
    };
    for (const layout of [layoutConceptFacility(bundle, bundle.facilities[0]!), layoutConceptFacilityDoubleRow(bundle, bundle.facilities[0]!)]) {
      expect(layout.rooms.find((room) => room.placeId === place.id)?.role).toBe(role);
    }
  });
});
