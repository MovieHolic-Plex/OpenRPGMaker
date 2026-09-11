import { describe, expect, it } from "vitest";
import { getTool, runTool, type ToolContext } from "@/editor/tools";
import { isDestructiveOutcome } from "@/ai/approvalPolicy";
import { reviewOverInsertion } from "@/ai/overInsertionReview";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { ProposedCall } from "@/ai/assistantSession";
import type { ToolResult } from "@/editor/tools";
import { completedHouseProject } from "./fixtures/completedHouse";

const MAP_ID = "clear_map_target";

function context(): ToolContext {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", {
    id: MAP_ID, name: "Clear fixture", width: 12, height: 10, border: "wall", bgm: { mode: "none" },
  });
  expect(created.ok, JSON.stringify(created.issues)).toBe(true);
  return ctx;
}

function paintSomething(ctx: ToolContext): void {
  const painted = runTool(ctx, "paint_tiles", {
    mapId: MAP_ID, layer: "lower", mode: "rect",
    from: { x: 2, y: 2 }, to: { x: 5, y: 5 }, tile: TILE.PATH,
  });
  expect(painted.ok, JSON.stringify(painted.issues)).toBe(true);
}

describe("clear_map", () => {
  it("is a registered write tool in the map domain", () => {
    const tool = getTool("clear_map");
    expect(tool).toBeDefined();
    expect(tool?.mode).toBe("write");
    expect(tool?.domains).toContain("map");
  });

  it("clears every cell to grass by default and drops tile stacks", () => {
    const ctx = context();
    paintSomething(ctx);
    const map = ctx.project.maps[MAP_ID];
    if (!map) throw new Error("Missing fixture map");
    map.lowerTileStacks = { [2 * map.width + 2]: [TILE.PATH, TILE.PATH] };
    map.upperTiles[3 * map.width + 3] = 199;

    const result = runTool(ctx, "clear_map", { mapId: MAP_ID, confirmDestroy: true });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const after = ctx.project.maps[MAP_ID];
    if (!after) throw new Error("Missing cleared map");
    expect(after.lowerTiles.every((tile) => tile === TILE.GRASS)).toBe(true);
    expect(after.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
    expect(after.lowerTileStacks ?? {}).toEqual({});
    expect(after.upperTileStacks ?? {}).toEqual({});
  });

  it("fill empty leaves a true void instead of ground", () => {
    const ctx = context();
    paintSomething(ctx);
    const result = runTool(ctx, "clear_map", { mapId: MAP_ID, fill: "empty", confirmDestroy: true });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const after = ctx.project.maps[MAP_ID];
    if (!after) throw new Error("Missing cleared map");
    expect(after.lowerTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
    expect(after.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
  });

  it("refuses without confirmDestroy and changes nothing", () => {
    const ctx = context();
    paintSomething(ctx);
    const before = structuredClone(ctx.project);
    const result = runTool(ctx, "clear_map", { mapId: MAP_ID });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-args");
    expect(ctx.project).toEqual(before);
  });

  it("keeps events by default and warns with their ids", () => {
    const ctx = context();
    const placed = runTool(ctx, "place_npc", {
      mapId: MAP_ID, x: 6, y: 6, name: "잔류 주민", pages: [{ lines: ["남아 있는다"] }],
    });
    expect(placed.ok, JSON.stringify(placed.issues)).toBe(true);
    const result = runTool(ctx, "clear_map", { mapId: MAP_ID, confirmDestroy: true });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const after = ctx.project.maps[MAP_ID];
    expect(after?.events).toHaveLength(1);
    // 쓰기 툴의 warnings 는 diff 로 전달된다(toolRunner 가 exec.warnings 를 diff.warnings 에 합친다).
    expect(result.diff?.warnings.join(" ")).toContain("남겨둠");
  });

  it("removes every event when asked and reports the removal in the diff", () => {
    const ctx = context();
    const placed = runTool(ctx, "place_npc", {
      mapId: MAP_ID, x: 6, y: 6, name: "철거 주민", pages: [{ lines: ["곧 사라진다"] }],
    });
    expect(placed.ok, JSON.stringify(placed.issues)).toBe(true);
    const result = runTool(ctx, "clear_map", { mapId: MAP_ID, events: "remove", confirmDestroy: true });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.maps[MAP_ID]?.events).toHaveLength(0);
    expect(result.diff?.eventsRemoved).toBe(1);
  });

  it("keeps the start cell walkable on an empty fill and warns", () => {
    const ctx = context();
    ctx.project.startMapId = MAP_ID;
    ctx.project.startPos = { x: 5, y: 5 };
    const result = runTool(ctx, "clear_map", { mapId: MAP_ID, fill: "empty", confirmDestroy: true });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const after = ctx.project.maps[MAP_ID];
    if (!after) throw new Error("Missing cleared map");
    expect(after.lowerTiles[5 * after.width + 5]).not.toBe(TILE.EMPTY);
    expect(result.diff?.warnings.join(" ")).toContain("시작 위치");
  });

  it("refuses to erase a recorded house and changes nothing", () => {
    const ctx = { project: completedHouseProject() };
    const before = structuredClone(ctx.project);
    const result = runTool(ctx, "clear_map", { mapId: ctx.project.startMapId, confirmDestroy: true });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(ctx.project).toEqual(before);
  });

  it("is a destructive outcome and forces the over-insertion review modal path", () => {
    expect(isDestructiveOutcome("clear_map", { mapId: MAP_ID, confirmDestroy: true }, undefined)).toBe(true);
    const result: ToolResult = { ok: true, summary: "clear_map" };
    const call: ProposedCall = { name: "clear_map", args: {}, summary: "clear", result, destructive: true };
    const review = reviewOverInsertion({ calls: [call], beforeMapCount: 1, afterMapCount: 1 });
    expect(review.needsReview).toBe(true);
    expect(review.destructive).toBe(true);
  });
});
