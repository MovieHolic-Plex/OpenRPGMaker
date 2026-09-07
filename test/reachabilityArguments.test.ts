import { describe, expect, it } from "vitest";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { validateArgs } from "@/editor/tools/jsonSchema";
import { COORD_SCHEMA } from "@/editor/tools/schemaShapes";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

const mapId = "map_blank_start";
const validArgs = { mapId, from: { x: 10, y: 8 }, targets: [{ x: 11, y: 8 }] };
// Recorded wire114: no target coordinates, not an artifact reachability finding.
const wire114 = { mapId, from: { x: 10, y: 8 }, targets: [{ newMapName: "지하실", mapId }] };

const malformedPoints: Array<[string, unknown]> = [
  ["missing both coordinates", {}],
  ["missing x", { y: 8 }],
  ["missing y", { x: 10 }],
  ["fractional x", { x: 10.5, y: 8 }],
  ["fractional y", { x: 10, y: 8.5 }],
  ["NaN", { x: Number.NaN, y: 8 }],
  ["positive infinity", { x: 10, y: Number.POSITIVE_INFINITY }],
  ["negative infinity", { x: Number.NEGATIVE_INFINITY, y: 8 }],
  ["null coordinate", { x: null, y: 8 }],
  ["boolean coordinate", { x: 10, y: true }],
  ["nonnumeric string", { x: "cell", y: 8 }],
  ["fractional numeric string", { x: "10.5", y: 8 }],
  ["nested object coordinate", { x: { x: 10 }, y: 8 }],
  ["nested array coordinate", { x: 10, y: [8] }],
  ["null point", null],
  ["empty array point", []],
  ["multiple object array point", [{ x: 10, y: 8 }, { x: 11, y: 8 }]],
  ["nested malformed array point", [[{}]]],
];

describe("reachability coordinate argument boundary", () => {
  it("rejects wire114 before artifact evidence and permits a valid retry through real history", () => {
    const ctx = { project: createBlankProject() };
    const before = JSON.stringify(ctx.project);
    const history = new ToolVerificationEvidence();
    history.requireTools(["check_reachability"]);
    const bad = runTool(ctx, "check_reachability", wire114);
    expect(bad.ok).toBe(false);
    expect(bad.data).toBeUndefined();
    expect(bad.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
    history.observe("check_reachability", wire114, bad);
    expect(history.passed("check_reachability")).toBe(false);
    const good = runTool(ctx, "check_reachability", validArgs);
    expect(good).toMatchObject({ ok: true, data: { reachable: true, unreachable: [] } });
    history.observe("check_reachability", validArgs, good);
    expect(history.passed("check_reachability")).toBe(true);
    expect(history.problems()).toEqual([]);
    expect(JSON.stringify(ctx.project)).toBe(before);
  });

  it.each(malformedPoints)("the existing coordinate validator rejects %s", (_label, point) => {
    expect(validateArgs(COORD_SCHEMA, point).length).toBeGreaterThan(0);
  });

  describe.each(["from", "targets"] as const)("%s", field => {
    it.each(malformedPoints)("rejects %s without producing a verdict or changing the project", (_label, point) => {
      const ctx = { project: createBlankProject() };
      const before = JSON.stringify(ctx.project);
      const args = { ...validArgs, [field]: field === "from" ? point : [validArgs.targets[0], point] };
      const result = runTool(ctx, "check_reachability", args);
      expect(result.ok).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
      expect(JSON.stringify(ctx.project)).toBe(before);
    });
  });

  it.each([
    validArgs,
    { ...validArgs, targets: [] },
    { mapId, from: { x: "10", y: "8" }, targets: [{ x: "11", y: "8" }] },
    { mapId, from: [{ x: 10, y: 8 }], targets: [[{ x: 11, y: 8 }]] },
    { mapId, from: '{"x":10,"y":8}', targets: '[{"x":11,"y":8}]' },
    { mapId, from: { point: { x: 10, y: 8 } }, targets: [{ at: { x: 11, y: 8 } }] },
    { ...validArgs, targets: [{ x: 11, y: 8, mapId, label: "destination" }] },
  ])("preserves supported coordinate normalization and open object fields: %j", args => {
    const result = runTool({ project: createBlankProject() }, "check_reachability", args);
    expect(result).toMatchObject({ ok: true, data: { reachable: true, unreachable: [] } });
  });

  it("preserves a genuine unreachable verdict across a different valid passing query", () => {
    const ctx = { project: createBlankProject() };
    const map = ctx.project.maps[mapId];
    if (!map) throw new Error("Missing fixture map");
    // An impassable strip separates two valid, in-bounds ground points.
    for (let y = 0; y < map.height; y += 1) {
      map.lowerTiles[y * map.width + 13] = 342;
      map.upperTiles[y * map.width + 13] = -1;
    }
    const args = { ...validArgs, targets: [{ x: 15, y: 8 }] };
    const failed = runTool(ctx, "check_reachability", args);
    expect(failed).toMatchObject({ ok: true, data: { reachable: false, unreachable: args.targets } });
    const history = new ToolVerificationEvidence();
    history.observe("check_reachability", args, failed);
    const passed = runTool(ctx, "check_reachability", validArgs);
    expect(passed).toMatchObject({ ok: true, data: { reachable: true } });
    history.observe("check_reachability", validArgs, passed);
    expect(history.passed("check_reachability")).toBe(false);
  });
});
