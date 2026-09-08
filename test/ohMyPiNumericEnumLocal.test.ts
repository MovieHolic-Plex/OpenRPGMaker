import { describe, expect, it } from "vitest";
import { getTool } from "../src/editor/tools/toolRegistry";
import { normalizeArgsForSchema, validateArgs } from "../src/editor/tools/jsonSchema";
import { parseAuthorHouseRequest } from "../src/editor/construction/parseHouseRequest";
import { parseInteriorPlan } from "../src/editor/roomHarness/interiorKit";

const house = { kitId: "blue-stone", wings: [{ x: 1, y: 1, w: 6, h: 11 }], door: true };
const interior = { mapId: "offline-interior", width: 16, height: 13, seed: 1,
  wings: [{ x: 1, y: 1, w: 12, h: 10 }], door: { x: 6, y: 10 } };
const placements = [
  { name: "author_house single", tool: "author_house",
    args: (stories: unknown) => ({ kind: "single", mapId: "offline", ...house, stories }),
    parse(args: Record<string, unknown>) {
      const result = parseAuthorHouseRequest(args);
      if (result.kind !== "single") throw new Error("Expected single house");
      return result.stories;
    } },
  { name: "author_house houses[]", tool: "author_house",
    args: (stories: unknown) => ({ kind: "lots", mapId: "offline", houses: [{ ...house, yard: [], stories }] }),
    parse(args: Record<string, unknown>) {
      const result = parseAuthorHouseRequest(args);
      if (result.kind !== "lots") throw new Error("Expected house lots");
      return result.houses[0].stories;
    } },
  ...["start_interior_room_session", "run_interior_room_pipeline"].map(tool => ({
    name: `${tool} exterior`, tool,
    args: (stories: unknown) => ({ ...interior, exterior: { stories } }),
    parse: (args: Record<string, unknown>) => parseInteriorPlan(args).exterior!.stories,
  })),
];

describe("numeric enum transport leaves shipped local normalization and parsers strict", () => {
  for (const placement of placements) {
    it(`${placement.name} accepts all numeric members and existing string-to-number normalization`, () => {
      const schema = getTool(placement.tool)!.parameters;
      for (const value of [1, 2, 3, "2"]) {
        const args = placement.args(value);
        const before = JSON.stringify(args);
        const normalized = normalizeArgsForSchema(schema, args) as Record<string, unknown>;
        expect(validateArgs(schema, normalized)).toEqual([]);
        expect(placement.parse(normalized)).toBe(Number(value));
        expect(JSON.stringify(args)).toBe(before);
      }
    });
    it(`${placement.name} rejects invalid members via its actual parser, not a shallow leaf mock`, () => {
      for (const value of [0, 4, 1.5, "4", true, null]) {
        const normalized = normalizeArgsForSchema(getTool(placement.tool)!.parameters, placement.args(value)) as Record<string, unknown>;
        expect(() => placement.parse(normalized)).toThrow(expect.objectContaining({ code: "invalid-args" }));
      }
    });
  }

  it("sparse neighborhood membership remains [4,8], never a range allowing 6", () => {
    const schema = getTool("upsert_autotile_group")!.parameters;
    const groupSchema = schema.properties!.group;
    for (const value of [4, 8, "4", "8"]) {
      const normalized = normalizeArgsForSchema(schema, { tilesetId: "offline", group: {
        name: "offline", memberTileIds: [1], variantMap: { "0": 1 }, neighborhood: value,
      } }) as { group: Record<string, unknown> };
      expect(normalized.group.neighborhood).toBe(Number(value));
      expect(validateArgs(groupSchema, normalized.group)).toEqual([]);
    }
    for (const value of [6, "6", 1.5, true, null]) {
      const normalized = normalizeArgsForSchema(groupSchema, {
        name: "offline", memberTileIds: [1], variantMap: { "0": 1 }, neighborhood: value,
      });
      expect(validateArgs(groupSchema, normalized).length).toBeGreaterThan(0);
    }
    expect(groupSchema.properties!.neighborhood.enum).toEqual([4, 8]);
  });

  it("moving protobuf strings into the LOCAL schema would break valid normalized arguments", () => {
    const canonical = getTool("author_house")!.parameters;
    const corrupted = { ...canonical, properties: { ...canonical.properties,
      stories: { ...canonical.properties!.stories, enum: ["1", "2", "3"] },
    } };
    for (const value of [2, "2"]) {
      const args = normalizeArgsForSchema(canonical, { kind: "single", mapId: "offline", ...house, stories: value });
      expect(validateArgs(canonical, args)).toEqual([]);
      expect(validateArgs(corrupted, args).length).toBeGreaterThan(0);
    }
    expect(canonical.properties!.stories.enum).toEqual([1, 2, 3]);
  });
});
