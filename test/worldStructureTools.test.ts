import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { runTool } from "@/editor/tools/toolRunner";
import { canMove } from "@/project/collision";
import { deserialize, serialize } from "@/project/io";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { WORLD_BRIDGE_DESCRIPTIONS } from "@/project/defaults/worldStructureRules";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness/themePacks";

function fixture() {
  const project = createBlankProject();
  const map = createBlankMap("World authoring", 64, 56, "easyrpg_chipset_world");
  map.id = "world";
  map.lowerTiles.fill(240);
  map.upperTiles.fill(-1);
  project.maps = { world: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 1, y: 1 };
  return { project };
}

const tiers = [
  { x: 8, y: 5, width: 27, height: 26, stairX: 12 },
  { x: 12, y: 8, width: 18, height: 16, stairX: 26 },
  { x: 16, y: 11, width: 9, height: 7, stairX: 19 },
];

describe("World structure tools", () => {
  it("builds a continuous north-south bridge without changing another map's tileset", () => {
    // Given a five-cell river and a second map sharing the source tileset.
    const ctx = fixture();
    const before = structuredClone(ctx.project.tilesets);
    for (let y = 6; y <= 10; y++) ctx.project.maps.world.lowerTiles[y * 64 + 8] = 120;
    ctx.project.maps.other = createBlankMap("Other", 8, 8, "easyrpg_chipset_world");
    // When the registered tool crosses it.
    const result = runTool(ctx, "author_world_bridge", { mapId: "world", x: 8, y: 6, length: 5, orientation: "vertical" });
    // Then its deck and both landings work, and unrelated runtime flags stay unchanged.
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const map = ctx.project.maps.world;
    expect(ctx.project.tilesets[map.tilesetId].transparentColor).toBe("#ff678b");
    for (let y = 6; y <= 10; y++) {
      expect(map.upperTiles[y * 64 + 8]).toBe(472);
      expect(canMove(ctx.project, map, 8, y - 1, 8, y)).toBe(true);
      expect(canMove(ctx.project, map, 8, y, 9, y)).toBe(false);
    }
    expect(canMove(ctx.project, map, 8, 10, 8, 11)).toBe(true);
    expect(ctx.project.tilesets.easyrpg_chipset_world).toEqual(before.easyrpg_chipset_world);
    const reloaded = deserialize(serialize(ctx.project));
    ensureBundledTilesets(reloaded);
    expect(canMove(reloaded, reloaded.maps.world, 8, 10, 8, 11)).toBe(true);
  });

  it("builds three independently gated mountain tiers with save/load stable passage", () => {
    const ctx = fixture();
    const result = runTool(ctx, "author_world_mountain", { mapId: "world", surface: "snow", tiers });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(result.data).toMatchObject({ tiers: 3, entry: { x: 12, y: 33 } });
    const project = deserialize(serialize(ctx.project));
    const map = project.maps.world;
    for (const tier of tiers) {
      const y = tier.y + tier.height - 1;
      expect(map.lowerTiles[(y + 1) * 64 + tier.stairX]).toBe(374);
      expect(canMove(project, map, tier.stairX, y + 3, tier.stairX, y + 2)).toBe(true);
      expect(canMove(project, map, tier.stairX, y + 1, tier.stairX + 1, y + 1)).toBe(false);
    }
  });

  it("discovers both construction tools through the existing tool finder", () => {
    const ctx = fixture();
    for (const name of ["author_world_bridge", "author_world_mountain"]) {
      expect(runTool(ctx, "find_tools", { query: name, limit: 1 }).data).toMatchObject({ matches: [expect.objectContaining({ name })] });
    }
  });

  it.each(["span", "short-a", "short-b"])("builds a horizontal %s crossing with closed support and creek edges", style => {
    const ctx = fixture(), length = style === "span" ? 5 : 1;
    for (let x = 8; x < 8 + length; x++) for (let y = 6; y <= 7; y++) ctx.project.maps.world.lowerTiles[y * 64 + x] = 120;
    const result = runTool(ctx, "author_world_bridge", { mapId: "world", x: 8, y: 6, length, orientation: "horizontal", style });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const map = ctx.project.maps.world;
    expect(canMove(ctx.project, map, 7, 6, 8, 6)).toBe(true);
    expect(canMove(ctx.project, map, 7 + length, 6, 8 + length, 6)).toBe(true);
    expect(canMove(ctx.project, map, 8, 6, 8, 7)).toBe(false);
    if (style === "span") expect(map.upperTiles[7 * 64 + 8]).toBe(473);
  });

  it("does not commit a dry-run or leave a private tileset behind", () => {
    const ctx = fixture(), before = serialize(ctx.project);
    const result = runTool(ctx, "author_world_mountain", { mapId: "world", surface: "grass", tiers }, { dryRun: true });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(serialize(ctx.project)).toBe(before);
  });

  it.each([
    { tiers: [{ ...tiers[0], x: 60, stairX: 63 }], code: "out-of-bounds" },
    { tiers: [tiers[0], { ...tiers[1], x: 7, stairX: 15 }], code: "tier-overlap" },
    { tiers: [{ ...tiers[0], stairX: 8 }], code: "invalid-args" },
    { tiers: [{ ...tiers[0], frontOffsets: [0] }], code: "invalid-args" },
    { tiers: [], code: "invalid-args" },
  ])("rejects malformed or overlapping mountain geometry atomically: $code", ({ tiers, code }) => {
    const ctx = fixture(), before = serialize(ctx.project);
    const result = runTool(ctx, "author_world_mountain", { mapId: "world", surface: "grass", tiers });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0].code).toBe(code);
    expect(serialize(ctx.project)).toBe(before);
  });

  it.each(["prop", "water", "locked", "graft", "other-chipset"])("protects %s from mountain construction", conflict => {
    const ctx = fixture(), map = ctx.project.maps.world, ts = ctx.project.tilesets[map.tilesetId];
    if (conflict === "prop") map.upperTiles[10 * 64 + 15] = 262;
    if (conflict === "water") map.lowerTiles[10 * 64 + 15] = 120;
    if (conflict === "locked") {
      ts.tileMeta ??= [];
      ts.tileMeta[374] = { ...ts.tileMeta[374], userLocked: true };
      ts.passability[374] = { up: false, down: false, left: false, right: false };
    }
    if (conflict === "graft") ts.tileGrafts = [{ targetTile: 172, sourceChipset: ts.image.id, sourceTile: 262 }];
    if (conflict === "other-chipset") ts.image = { type: "bundled", id: "tex_easyrpg_chipset_dungeon" };
    const before = serialize(ctx.project);
    const result = runTool(ctx, "author_world_mountain", { mapId: "world", surface: "grass", tiers });
    expect(result.ok).toBe(false);
    expect(serialize(ctx.project)).toBe(before);
  });

  it("requires actual water and both landings for a bridge", () => {
    const ctx = fixture(), before = serialize(ctx.project);
    const result = runTool(ctx, "author_world_bridge", { mapId: "world", x: 8, y: 6, length: 5, orientation: "vertical" });
    expect(result.issues?.[0].code).toBe("bridge-needs-water");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("migrates exactly known bundled bridge descriptions but not authored descriptions", () => {
    const ctx = fixture(), ts = ctx.project.tilesets.easyrpg_chipset_world;
    const legacy = "World 세로 석조 다리의 아래쪽 턱·마감 조각. 반복 몸통 472의 끝에 맞춰 쓴다. 412·442를 일렬로 반복하는 자동 조립은 없다. 물 위 접속과 통행을 별도 검증한다.";
    ts.tileMeta ??= [];
    ts.tileMeta[442] = { ...ts.tileMeta[442], source: "bundled-default", userLocked: false, description: legacy };
    ts.tileMeta[412] = { ...ts.tileMeta[412], source: "user", description: "나만의 다리" };
    applyEasyRpgThemeMetadataPacks(ts);
    // Shipped-copy equality is the migration contract, not a wording assertion.
    expect(ts.tileMeta[442].description).toBe(WORLD_BRIDGE_DESCRIPTIONS[442]);
    expect(ts.tileMeta[412].description).toBe("나만의 다리");
  });
});
