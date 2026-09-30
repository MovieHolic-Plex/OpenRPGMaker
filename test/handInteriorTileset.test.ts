// 손 도트 실내 v5 (atlas_biome_interior) — 번들 정의·옛 저장본 교체·조립기·도구·폐기된 실내 칩셋 거부.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { atlasBiomeInteriorReplacementWarnings, ATLAS_BIOME_INTERIOR_COUNT, createAtlasBiomeInteriorTileset } from "@/project/defaults/atlasBiomeInterior";
import { buildHandInteriorLayers, handInteriorStructure, HAND_INTERIOR_SPEC } from "@/editor/handInterior/builder";
import { runTool, toOpenAiTools } from "@/editor/tools";
import { canMove } from "@/project/collision";
import type { Project } from "@/project/types";

const examples = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5-maps/maps.json", "utf8"));
const checkJson = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5-maps/check.json", "utf8"));
const check = Array.isArray(checkJson) ? checkJson : checkJson.maps;

describe("atlas_biome_interior = hand-pixel v5", () => {
  it("a new project is born with the v5 sheet, its guidance and the split-off dungeon tileset", () => {
    const p = createBlankProject();
    const t = p.tilesets.atlas_biome_interior!;
    expect(t.family).toBe("oprn-atlas");
    expect(t.count).toBe(ATLAS_BIOME_INTERIOR_COUNT);
    expect(t.tilesPerRow).toBe(48);
    expect(t.structureKits!.length).toBe(381);
    expect(t.structureKits!.every((k) => k.id.startsWith("hand-interior:"))).toBe(true);
    expect(t.referenceDocuments!.map((c) => c.id)).toContain("hand-interior-v5");
    // strips are 12 frames and never cross a sheet row
    for (const s of t.animationStrips ?? []) expect((s.baseTile % 48) + s.frames).toBeLessThanOrEqual(48);
    // the RM2k3 transparency harness does not lift the baked layers
    const fresh = createAtlasBiomeInteriorTileset();
    expect(t.priority).toEqual(fresh.priority);
    const d = p.tilesets.atlas_biome_dungeon!;
    expect(d.family).toBe("oprn-atlas");
    expect(d.count).toBe(1140);
  });

  it("an older save's Tibo-numbered definition is replaced whole; maps drawn with it stay and a warning is left", () => {
    const p = createBlankProject();
    p.tilesets.atlas_biome_interior = { ...p.tilesets.atlas_biome_interior!, count: 3300, tilesPerRow: 30,
      structureKits: [{ id: "tibo-bed", kind: "section", name: "옛", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [700] }], learnedFrom: "atlas-interior" } as never],
      referenceDocuments: [{ id: "atlas-interior-guide-v1", name: "", description: "", documents: [], images: [] }, { id: "mine", name: "", description: "", documents: [], images: [] }] };
    const old = { id: "old", name: "옛", width: 2, height: 1, tilesetId: "atlas_biome_interior", tileSize: 16, lowerTiles: [5, 6], upperTiles: [-1, -1], events: [] };
    p.maps.old = structuredClone(old) as never;
    const n = atlasBiomeInteriorReplacementWarnings.length;
    expect(ensureBundledTilesets(p)).toBe(true);
    const t = p.tilesets.atlas_biome_interior!;
    expect(t.count).toBe(ATLAS_BIOME_INTERIOR_COUNT);
    expect(t.structureKits!.some((k) => k.id === "tibo-bed")).toBe(false);
    expect(t.referenceDocuments!.map((c) => c.id).sort()).toEqual(["hand-interior-v5", "mine"]);
    expect(p.maps.old).toEqual(old);
    expect(atlasBiomeInteriorReplacementWarnings.length).toBe(n + 1);
    expect(atlasBiomeInteriorReplacementWarnings.at(-1)).toContain("old");
    // idempotent: a current definition is left alone
    const again = structuredClone(p.tilesets.atlas_biome_interior);
    ensureBundledTilesets(p);
    expect(p.tilesets.atlas_biome_interior).toEqual(again);
    expect(atlasBiomeInteriorReplacementWarnings.length).toBe(n + 1);
  });

  it("the builder's structure layer equals the bundled example maps (the room2.render rule)", () => {
    const t = createAtlasBiomeInteriorTileset();
    for (const plan of examples.plans) {
      const m = examples.maps[plan.id];
      const zones = plan.zones.map(([x0, y0, x1, y1, floor, wall]: [number, number, number, number, string | null, string | null]) => ({ x0, y0, x1, y1, floor: floor ?? undefined, wall: wall ?? undefined }));
      const { lower } = handInteriorStructure({ plan: plan.plan, floor: plan.floor, wall: plan.wall, zones, ceiling: plan.ceil });
      // window light and rugs the original drew over a wall are baked into the example only (창 빛 · 벽 위 깔개)
      const diff = lower.filter((tile, i) => tile !== m.lowerTiles[i] && !/창 빛|벽 위 깔개/u.test(String(t.tileMeta![m.lowerTiles[i]]!.label)));
      expect(diff, plan.key).toEqual([]);
    }
  });

  it("every example map is walkable from its entrance to its stairs with the runtime move rule", () => {
    const p = createBlankProject() as Project;
    p.maps = examples.maps;
    for (const plan of examples.plans) {
      const m = p.maps[plan.id]!;
      const seen = new Set([`${plan.entry[0]},${plan.entry[1]}`]); const q = [plan.entry as [number, number]];
      while (q.length) { const [x, y] = q.pop()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const X = x + dx, Y = y + dy; if (!seen.has(`${X},${Y}`) && canMove(p, m, x, y, X, Y)) { seen.add(`${X},${Y}`); q.push([X, Y]); } } }
      expect(seen.size, plan.key).toBeGreaterThan(40);
      // the engine reaches exactly the cells the build checker reached (a rug over a wall would open a hole)
      expect(seen.size, plan.key).toBe(check.find((c: { map: string }) => c.map === plan.key).reachable);
      for (const e of m.events) expect(seen.has(`${e.x},${e.y}`), `${plan.key} ${e.x},${e.y}`).toBe(true);
    }
    const manor = p.maps["hand-manor-1f"]!;
    expect(manor.events.map((e) => (e.pages![0]!.commands[0] as { mapId: string }).mapId)).toEqual(["hand-manor-2f", "hand-manor-2f", "hand-manor-2f"]);
  });

  it("the builder catches the broken inputs with codes and coordinates", () => {
    const t = createAtlasBiomeInteriorTileset();
    const plan = ["#########", "#.......#", "#.......#", "#.......#", "#.......#", "####.####"];
    const ok = buildHandInteriorLayers({ plan, floor: "plank", wall: "plaster", objects: [{ id: "bread shelf", x: 2, y: 3 }, { id: "picture", x: 5, y: 1 }], tables: [{ style: "dining", x: 5, y: 3, w: 2, h: 1 }], goods: [{ id: "bell", x: 5, y: 3 }] }, t);
    expect(ok.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(ok.unreachedFloor).toEqual([]);
    const codes = (input: Parameters<typeof buildHandInteriorLayers>[0]) => buildHandInteriorLayers(input, t).issues.map((i) => i.code);
    expect(codes({ plan, floor: "plank", wall: "plaster", objects: [{ id: "picture", x: 4, y: 4 }] })).toContain("hang-not-on-face");
    expect(codes({ plan, floor: "plank", wall: "plaster", objects: [{ id: "bread shelf", x: 4, y: 4 }] })).toContain("wall-piece-needs-face");
    expect(codes({ plan, floor: "plank", wall: "plaster", objects: [{ id: "stairs up wood", x: 3, y: 4 }] })).toContain("stairs-not-at-wall");
    expect(codes({ plan, floor: "plank", wall: "plaster", goods: [{ id: "bell", x: 4, y: 4 }] })).toContain("goods-needs-surface");
    expect(codes({ plan, floor: "plank", wall: "plaster", objects: [{ id: "barrel", x: 4, y: 4 }, { id: "crate", x: 4, y: 4 }] })).toContain("overlap");
    expect(codes({ plan, floor: "plank", wall: "plaster", objects: [{ id: "barrel", x: 4, y: 5 }] })).toContain("no-entrance");
    expect(codes({ plan, floor: "plank", wall: "plaster", objects: [{ id: "barrel", x: 4, y: 4 }] })).toContain("unreached-floor");
    // a walkable rug over a wall cell is an error: the engine would let the player walk through that wall
    expect(codes({ plan, floor: "plank", wall: "plaster", lines: [{ id: Object.keys(HAND_INTERIOR_SPEC.lines).find((k) => HAND_INTERIOR_SPEC.lines[k]!.kind === "flat")!, cells: [{ x: 3, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 1 }] }] })).toContain("not-on-floor");
  });
});

describe("assistant tools: v5 only", () => {
  it("build_hand_interior_room makes a new atlas_biome_interior map; errors leave no map", () => {
    const ctx = { project: createBlankProject() };
    const r = runTool(ctx, "build_hand_interior_room", { mapId: "shop", name: "가게", plan: ["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "###.###"], floor: "plank", wall: "plaster",
      objects: [{ id: "bread shelf", x: 1, y: 3 }], tables: [{ style: "counter", x: 3, y: 4, w: 2, h: 1 }], goods: [{ id: "cashbox", x: 3, y: 4 }] });
    expect(r.ok, r.summary).toBe(true);
    const m = ctx.project.maps.shop!;
    expect(m.tilesetId).toBe("atlas_biome_interior");
    expect(m.upperOverlayTiles!.some((t) => t >= 0)).toBe(true);
    const bad = runTool(ctx, "build_hand_interior_room", { mapId: "bad", plan: ["#####", "#...#", "#...#", "##.##"], floor: "plank", wall: "plaster", objects: [{ id: "picture", x: 2, y: 2 }] });
    expect(bad.ok).toBe(false);
    expect(ctx.project.maps.bad).toBeUndefined();
  });

  it("a new interior map on a retired interior chipset is rejected; retired chipsets and old interior tools are not visible", () => {
    const ctx = { project: createBlankProject() };
    for (const tilesetId of ["tibo_interior_expanded", "easyrpg_chipset_interior", "opengameart_lpc_wooden_furniture"]) {
      const r = runTool(ctx, "create_map", { name: "여관", width: 12, height: 10, tilesetId });
      expect(r.ok, tilesetId).toBe(false);
      expect(r.issues?.[0]?.code).toBe("retired-interior-tileset");
    }
    const refs = runTool(ctx, "list_tileset_references", {});
    const ids = (refs.data as { tilesets: { tilesetId: string }[] }).tilesets.map((t) => t.tilesetId);
    expect(ids).toContain("atlas_biome_interior");
    expect(ids).not.toContain("tibo_interior_expanded");
    expect(ids).not.toContain("easyrpg_chipset_interior");
    expect(runTool(ctx, "list_tileset_references", { tilesetId: "tibo_interior_expanded" }).ok).toBe(false);
    const names = toOpenAiTools().map((t) => t.function.name);
    expect(names).toContain("build_hand_interior_room");
    for (const old of ["place_concept", "get_concept_facility", "start_interior_room_session", "run_interior_room_pipeline", "furnish_interior_space"]) expect(names).not.toContain(old);
    // no shared place or object on a retired interior chipset, and no interior place off the v5 chipset
    const rows: { id: string; tilesetId?: string; tags?: string[] }[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = (runTool(ctx, "list_spatial_designs", { limit: 200, offset }).data as { shared: { rows: typeof rows; nextOffset?: number } }).shared;
      rows.push(...page.rows); if (page.nextOffset === undefined) break;
    }
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.filter((r) => /tibo_interior_expanded|easyrpg_chipset_interior|lpc_wooden/u.test(r.tilesetId ?? ""))).toEqual([]);
    expect(rows.filter((r) => (r.tags ?? []).includes("공간형태:건물 내부") && r.tilesetId !== "atlas_biome_interior")).toEqual([]);
    const tiboInterior = runTool(ctx, "import_region_reference", { id: "reviewed:shared_authored-map_five_more_1_20260921" });
    expect(tiboInterior.ok).toBe(false);
    expect(tiboInterior.issues?.[0]?.code).toBe("retired-interior-tileset");
    const kit = ctx.project.tilesets.tibo_interior_expanded?.structureKits?.[0]?.id;
    if (kit) expect(runTool(ctx, "stamp_object", { objectId: `kit:tibo_interior_expanded/${kit}`, mapId: ctx.project.startMapId, x: 1, y: 1 }).issues?.[0]?.code).toBe("retired-interior-tileset");
  });
});
