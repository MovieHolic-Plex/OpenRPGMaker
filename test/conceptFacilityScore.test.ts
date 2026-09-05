import { describe, expect, it } from "vitest";
import { scoreConceptFacility } from "@/editor/conceptFacilityScore";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import type { GameMap } from "@/project/types";

function ctx(): ToolContext {
  return { project: createBlankProject() };
}

type PlaceResult = {
  rooms: { roomId: string; placeId: string; role: string; x: number; y: number; w: number; h: number; mapId?: string }[];
  door: { x: number; y: number };
  floors: { level: number; mapId: string }[];
  review?: { score: number; copiedTemplate: boolean; checks: { id: string; pass: boolean }[] };
};

function warningsOf(result: { warnings?: string[]; diff?: { warnings?: string[] } }): string[] {
  return [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])];
}

function overlayOf(map: GameMap): ConceptFacilityScoreOverlay | undefined {
  const stamped = map.roomHarnessPlan as { plan?: { concept?: ConceptFacilityScoreOverlay } } | undefined;
  return stamped?.plan?.concept;
}

type ConceptFacilityScoreOverlay = {
  rooms: Record<string, { placeLabel: string; things: { objectId: string; chips: string[]; required: boolean }[] }>;
};

describe("scoreConceptFacility", () => {
  it("침실에 침대가 없으면 bedroom-has-sleep-bed 가 실패한다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", {
      query: "여관",
      mapId: "map_inn_no_bed",
      seed: 7,
      plan: {
        places: [
          { id: "bedroom", label: "객실", role: "room", size: "m" },
          { id: "hall", label: "홀", role: "entrance", size: "l" },
        ],
        things: [
          { objectId: "window", placeIds: ["bedroom"], chips: ["wall"] },
          { objectId: "table_chairs", placeIds: ["hall"], chips: ["block"] },
        ],
      },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as PlaceResult;
    const map = context.project.maps.map_inn_no_bed as GameMap;
    const review = scoreConceptFacility({
      map,
      rooms: data.rooms.filter(room => room.mapId === undefined || room.mapId === map.id),
      door: data.door,
      warnings: warningsOf(result),
      overlay: overlayOf(map),
    });
    expect(review.checks.find((check) => check.id === "bedroom-has-sleep-bed")?.pass).toBe(false);
    expect(review.checks.find((check) => check.id === "entrance-has-counter")?.pass).toBe(false);
  });

  it("초안 여관은 도달·침대·카운터·자리없음을 통과하고, plan 생략은 template-copy 실패다", () => {
    const context = ctx();
    const result = runTool(context, "place_concept", { query: "여관", mapId: "map_inn_score", seed: 7 }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as PlaceResult;
    const map = context.project.maps.map_inn_score as GameMap;
    const review = scoreConceptFacility({
      map,
      rooms: data.rooms.filter(room => room.mapId === undefined || room.mapId === map.id),
      door: data.door,
      warnings: warningsOf(result),
      levels: data.floors.map((floor) => floor.level),
      overlay: overlayOf(map),
      template: {
        places: [
          { id: "bedroom", count: 2, size: "m", role: "room" },
          { id: "corridor", role: "walkway" },
          { id: "dining", size: "l", role: "entrance" },
        ],
        things: [{ objectId: "bed_h" }],
      },
    });
    expect(review.checks.find((check) => check.id === "reach-all-rooms")?.pass).toBe(true);
    expect(review.checks.find((check) => check.id === "bedroom-has-sleep-bed")?.pass).toBe(true);
    expect(review.checks.find((check) => check.id === "entrance-has-counter")?.pass).toBe(true);
    expect(review.checks.find((check) => check.id === "required-unplaced")?.pass).toBe(true);
    expect(review.checks.find((check) => check.id === "template-copy")?.pass).toBe(false);
  });

  it("place_concept 결과에 review 가 실린다", () => {
    const result = runTool(ctx(), "place_concept", { query: "여관", mapId: "map_inn_review", seed: 7 }, { dryRun: false });
    expect(result.ok).toBe(true);
    const data = result.data as PlaceResult;
    expect(data.review?.checks.some((check) => check.id === "reach-all-rooms")).toBe(true);
  });
});
