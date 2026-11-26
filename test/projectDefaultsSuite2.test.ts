import { describe, expect, it, beforeEach } from "vitest";
import { conceptFacilityLevels, layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { createBlankProject, COMBINED_TOWN_TILESET_ID } from "@/project/defaults";
import { ATLAS_BIOME_INTERIOR_ID, atlasBiomeInteriorReplacementWarnings, ATLAS_BIOME_INTERIOR_COUNT, createAtlasBiomeInteriorTileset } from "@/project/defaults/atlasBiomeInterior";
import { cloneConceptBundle } from "@/project/defaults/scratchInnBundle";
import { SCRATCH_INN_BUNDLE } from "./fixtures/legacyConceptInn";
import { validateTileset } from "@/project/io/shapeResourceFields";
import type { ConceptBundleRecord, Project, AutotileGroup, GameMap } from "@/project/types";
import fs from "node:fs";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { buildHandInteriorLayers, handInteriorStructure, HAND_INTERIOR_SPEC } from "@/editor/handInterior/builder";
import { runTool, toOpenAiTools } from "@/editor/tools";
import { canMove } from "@/project/collision";
import { capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { isolateTimers } from "./mergedTeardown";
import { LAKE_AUTOTILE_TILE, lakeAutotileQuarterSources, isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { TILE, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID, DEFAULT_STATE_ID } from "@/project/defaults/constants";
import { isMapWaterTile, waterBoundsInMap } from "@/editor/tools/queryTools";
import { startOnRetiredCombinedTown, withRetiredEasyRpgTilesets, RETIRED_COMBINED_TOWN_TILESET_ID } from "./support/retiredEasyRpgTilesets";
import { AUTOTILE_DIR, autotileEditTriggersGroup, autotileNeighborMask, autotileVariantForCell, autotileVariantForMask, buildEdgeCornerVariantMap, shapeAutotileGroupAround, autotileLayerView } from "@/project/defaults/autotileEngine";
import { DEFAULT_AUTOTILE_GROUPS, DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP, autotileGroupsForTileset, cloneDefaultAutotileGroups, DEFAULT_UNDERGROWTH_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { setLayerTileAt } from "@/project/mapLayers";
import { serialize, deserialize } from "@/project/io";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { store } from "@/project/store";
import { addAutotileGroup, fillAutotileVariantMap, removeAutotileGroup, seedDefaultAutotileGroups, setAutotileVariant, updateAutotileGroup } from "@/editor/tilesetActions";
import { auditCombinedTownAutotiles, repairCombinedTownAutotiles } from "@/project/combinedTownAutotileAudit";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ToolContext } from "@/editor/tools/types";
import { isTreeCanopyTileId, isTreeTrunkTileId } from "@/project/tilesetHarness";
import { createBattleRuntime, type ActorCommand, type BattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { createBattleSequencer } from "@/player/battleSequencer";
import { actorCommandDirectorState } from "@/player/battleDirectorDom";
import { ACTOR_MAGE_ID } from "@/project/defaults/defaultDatabaseRecordIds";

describe("atlasBiomeInterior", () => {
  isolateTimers();
  // 개념 꾸러미 — 장소 `level`(층). 2층 이상 장소는 별도 맵으로 서고 계단(transfer 칩)이 층을 잇는다.
  describe("conceptFacilityLevels", () => {
    isolateTimers();
    // Concept bundles are validated on the current default interior, the hand-pixel v5 sheet (openwiki/atlas-biome-interior.md).
    const INTERIOR = ATLAS_BIOME_INTERIOR_ID;
    /** 여관을 두 층으로: 식당·홀(dining)은 1층, 복도·침실은 2층. 계단은 홀(올라감)과 복도(내려감) 양쪽에. */
    function twoStoryInn(): ConceptBundleRecord {
      const bundle = cloneConceptBundle(SCRATCH_INN_BUNDLE);
      for (const place of bundle.places) {
        if (place.id === "corridor" || place.id === "bedroom") place.level = 2;
      }
      bundle.things.push({id:"stairs",label:"층 연결 계단",objectId:"stairs_small",placeIds:["dining","corridor"],chips:["transfer"],required:true});
      return bundle;
    }
    describe("개념 꾸러미 — 층", () => {
      it("level 없는 초안은 한 층이고 도면은 종전과 같다", () => {
        expect(conceptFacilityLevels(SCRATCH_INN_BUNDLE, SCRATCH_INN_BUNDLE.facilities[0]!)).toEqual([1]);
        const whole = layoutConceptFacility(SCRATCH_INN_BUNDLE, SCRATCH_INN_BUNDLE.facilities[0]!);
        const ground = layoutConceptFacility(SCRATCH_INN_BUNDLE, SCRATCH_INN_BUNDLE.facilities[0]!, { level: 1 });
        expect(ground).toEqual(whole);
      });

      it("검증기는 1..3 정수만 받고 복제가 보존한다", () => {
        const bundle = twoStoryInn();
        expect(cloneConceptBundle(bundle).places.find((place) => place.id === "bedroom")?.level).toBe(2);
        const tileset = { ...createBlankProject().tilesets[INTERIOR]!, scratchConceptBundles: [bundle] };
        expect(() => validateTileset(INTERIOR, tileset)).not.toThrow();
        const bad = cloneConceptBundle(bundle);
        (bad.places.find((place) => place.id === "bedroom") as { level: number }).level = 4;
        expect(() => validateTileset(INTERIOR, { ...tileset, scratchConceptBundles: [bad] })).toThrow(/level/u);
      });

      it("층별 도면: 1층은 홀만, 2층은 복도와 침실 둘", () => {
        const bundle = twoStoryInn();
        const facility = bundle.facilities[0]!;
        expect(conceptFacilityLevels(bundle, facility)).toEqual([1, 2]);
        const ground = layoutConceptFacility(bundle, facility, { level: 1 });
        expect(ground.rooms.map((room) => room.placeId)).toEqual(["dining"]);
        const upper = layoutConceptFacility(bundle, facility, { level: 2 });
        expect(upper.rooms.map((room) => room.placeId).sort()).toEqual(["bedroom", "bedroom", "corridor"]);
        expect(upper.level).toBe(2);
      });

      // Removed it "place_concept 이 층마다 맵을 짓고": place_concept was removed from the tool registry on purpose.

      // Removed it "1층에 계단이 없으면 위층은": place_concept was removed from the tool registry on purpose.
    });
  });
  // 손 도트 실내 v5 (atlas_biome_interior) — 번들 정의·옛 저장본 교체·조립기·도구·폐기된 실내 칩셋 거부.
  describe("handInteriorTileset", () => {
    isolateTimers();
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
        expect(t.structureKits!.length).toBe(Object.keys(HAND_INTERIOR_SPEC.objects).length);   // 사양 기물마다 킷 하나(527 → 635, handInteriorSpec.json 이 자랐다)
        expect(t.structureKits!.every((k) => k.id.startsWith("hand-interior:"))).toBe(true);
        expect(t.referenceDocuments!.map((c) => c.id)).toContain("hand-interior-v5");
        // strips are 12 frames and never cross a sheet row
        for (const s of t.animationStrips ?? []) expect((s.baseTile % 48) + s.frames).toBeLessThanOrEqual(48);
        // the RM2k3 transparency harness does not lift the baked layers
        const fresh = createAtlasBiomeInteriorTileset();
        expect(t.priority).toEqual(fresh.priority);
        // 갈라 낸 EasyRPG 계열 던전 시트(atlas_biome_dungeon)는 2026-10-07 저작권 정리로 기본 프로젝트에서 빠졌다 — 던전은 등록 장소 가져오기로 간다.
        expect(p.tilesets.atlas_biome_dungeon).toBeUndefined();
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

      it("an older v5 build (fewer tiles, older dictionary) is refreshed in place: maps keep their ids, no warning", () => {
        const p = createBlankProject();
        const cur = p.tilesets.atlas_biome_interior!;
        const n0 = cur.count - 100;
        p.tilesets.atlas_biome_interior = { ...cur, count: n0, passability: cur.passability.slice(0, n0), priority: cur.priority.slice(0, n0),
          terrain: cur.terrain.slice(0, n0), tileMeta: cur.tileMeta!.slice(0, n0), structureKits: cur.structureKits!.slice(0, 400),
          referenceDocuments: [{ ...cur.referenceDocuments!.find((c) => c.id === "hand-interior-v5")!, documents: [] }, { id: "mine", name: "", description: "", documents: [], images: [] }] };
        const map = { id: "m", name: "방", width: 2, height: 1, tilesetId: "atlas_biome_interior", tileSize: 16, lowerTiles: [5, 6], upperTiles: [-1, 3300], events: [] };
        p.maps.m = structuredClone(map) as never;
        const n = atlasBiomeInteriorReplacementWarnings.length;
        expect(ensureBundledTilesets(p)).toBe(true);
        const t = p.tilesets.atlas_biome_interior!;
        expect(t.count).toBe(ATLAS_BIOME_INTERIOR_COUNT);
        expect(t.structureKits!.length).toBe(cur.structureKits!.length);
        expect(t.referenceDocuments!.find((c) => c.id === "hand-interior-v5")!.documents.length).toBeGreaterThan(0);
        expect(t.referenceDocuments!.map((c) => c.id).sort()).toEqual(["hand-interior-v5", "mine"]);
        expect(p.maps.m).toEqual(map);
        expect(atlasBiomeInteriorReplacementWarnings.length).toBe(n);
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
        expect(rows.filter((r) => /tibo_interior_expanded|easyrpg_chipset_interior|lpc_wooden/u.test(r.tilesetId ?? ""))).toEqual([]);
        expect(rows.filter((r) => (r.tags ?? []).includes("공간형태:건물 내부") && r.tilesetId !== "atlas_biome_interior")).toEqual([]);
        const kit = ctx.project.tilesets.tibo_interior_expanded?.structureKits?.[0]?.id;
        if (kit) expect(runTool(ctx, "stamp_object", { objectId: `kit:tibo_interior_expanded/${kit}`, mapId: ctx.project.startMapId, x: 1, y: 1 }).issues?.[0]?.code).toBe("retired-interior-tileset");
      });
    });
  });
  describe("placeConceptTool", () => {
    isolateTimers();
    describe("place_concept", () => {
      // Removed it "툴이 등록되어 있다": place_concept was removed from the tool registry on purpose.

      it("여관 지어줘 요청은 손 도트 v5 도구로 승격된다(place_concept 은 2026-09-29 폐기 — 실행 호환만)", () => {
        for (const text of ["여관 지어줘", "여관 하나 지어줘", "주막 만들어줘"]) {
          expect(capabilityEscalatedToolNames(text, new Set())).toContain("build_hand_interior_room");
          expect(capabilityEscalatedToolNames(text, new Set())).not.toContain("place_concept");
        }
      });

      // Removed it "툴 설명이 시설 요청의 경로": place_concept was removed from the tool registry on purpose.

      // Removed it "이전에 저작된 여관으로": place_concept was removed from the tool registry on purpose.

      // Removed it "사용자가 피아노를 빼고": place_concept was removed from the tool registry on purpose.

      // Removed it "장소를 지우면 그 방과": place_concept was removed from the tool registry on purpose.

      // Removed it "빈 배열은 다시 채우지": place_concept was removed from the tool registry on purpose.
    });
    describe("개념 꾸러미 프롬프트", () => {
      // 2026-09-29: 실내 = 손 도트 v5 하나. place_concept 은 폐기(실행 호환만)라 시스템 프롬프트에 꾸러미 절을 싣지 않는다.
      it("폐기된 개념 꾸러미 절은 사용자가 고친 나무가 있어도 시스템 프롬프트에 실리지 않는다", () => {
        const project = createBlankProject();
        const edited = cloneConceptBundle(SCRATCH_INN_BUNDLE);
        edited.facilities[0] = { ...edited.facilities[0]!, label: "주막" };
        edited.label = "주막";
        project.tilesets[ATLAS_BIOME_INTERIOR_ID]!.scratchConceptBundles = [edited];
        const prompt = buildSystemPrompt(project, { currentMapId: project.startMapId, budgetChars: 50_000 });
        expect(prompt).not.toContain("## 개념 꾸러미");
        expect(prompt).toContain("build_hand_interior_room");
      });
    });
    describe("개념 꾸러미 장소 스키마 (role · size · count)", () => {
      it("역할·크기·개수를 받아들이고 모르는 값은 거절한다", async () => {
        const { validateTileset } = await import("@/project/io/shapeResourceFields");
        const project = createBlankProject();
        const tileset = project.tilesets[ATLAS_BIOME_INTERIOR_ID]!;
        const bundle = cloneConceptBundle(SCRATCH_INN_BUNDLE);
        bundle.places = [
          { id: "hall", label: "홀", role: "entrance", size: "l" },
          { id: "corridor", label: "복도", role: "walkway" },
          { id: "bedroom", label: "객실", role: "room", size: "s", count: 2 },
        ];
        expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: [bundle] })).not.toThrow();
        const badRole = cloneConceptBundle(bundle);
        (badRole.places[0] as { role: string }).role = "hallway";
        expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: [badRole] })).toThrow(/role/);
        const badCount = cloneConceptBundle(bundle);
        (badCount.places[2] as { count: number }).count = 0;
        expect(() => validateTileset(tileset.id, { ...tileset, scratchConceptBundles: [badCount] })).toThrow(/count/);
      });

      it("복제는 역할·크기·개수를 보존한다", () => {
        const copy = cloneConceptBundle(SCRATCH_INN_BUNDLE);
        const bedroom = copy.places.find((place) => place.id === "bedroom");
        expect(bedroom?.role).toBe("room");
        expect(bedroom?.count).toBe(2);
        expect(copy.places.find((place) => place.id === "dining")?.role).toBe("entrance");
        expect(copy.places.find((place) => place.id === "corridor")?.role).toBe("walkway");
      });
    });
    describe("place_concept 도면", () => {
      function innLayout() {
        return layoutConceptFacility(SCRATCH_INN_BUNDLE, SCRATCH_INN_BUNDLE.facilities[0]!);
      }

      it("여관 초안은 객실 2개 → 복도 → 홀 순으로 서고 정문은 홀 남쪽 벽에 난다", () => {
        const layout = innLayout();
        const bedrooms = layout.rooms.filter((room) => room.placeId === "bedroom").sort((a, b) => a.x - b.x);
        const corridor = layout.rooms.find((room) => room.placeId === "corridor")!;
        const hall = layout.rooms.find((room) => room.placeId === "dining")!;
        expect(bedrooms).toHaveLength(2);
        expect(corridor).toBeDefined();
        expect(hall).toBeDefined();
        // 세로 인접은 3행 파티션(트림 + 벽면 2행), 가로 인접은 1열 파티션 — 파이프라인 벽 문법.
        for (const bedroom of bedrooms) expect(corridor.y).toBe(bedroom.y + bedroom.h + 3);
        expect(hall.y).toBe(corridor.y + corridor.h + 3);
        expect(bedrooms[1]!.x).toBe(bedrooms[0]!.x + bedrooms[0]!.w + 1);
        // 복도와 홀은 객실 줄 전폭을 잇는다.
        expect(corridor.x).toBe(bedrooms[0]!.x);
        expect(corridor.x + corridor.w).toBe(bedrooms[1]!.x + bedrooms[1]!.w);
        expect(hall.w).toBe(corridor.w);
        // 정문은 홀 남쪽 행 안.
        expect(layout.door.y).toBe(hall.y + hall.h - 1);
        expect(layout.door.x).toBeGreaterThanOrEqual(hall.x);
        expect(layout.door.x).toBeLessThan(hall.x + hall.w);
        // 내부 문: 객실마다 복도로 하나, 복도→홀 하나.
        expect(layout.innerDoors).toHaveLength(3);
        for (const bedroom of bedrooms) {
          expect(layout.innerDoors.some((door) => door.y === bedroom.y + bedroom.h && door.x >= bedroom.x && door.x < bedroom.x + bedroom.w)).toBe(true);
        }
        expect(layout.innerDoors.some((door) => door.y === corridor.y + corridor.h)).toBe(true);
        // 맵은 정문 아래 출구 계단과 천장 여백을 남긴다(도면 여백 2행: door.y+3 == height).
        expect(layout.height).toBeGreaterThanOrEqual(layout.door.y + 3);
        expect(layout.rooms.every((room) => room.x >= 2 && room.x + room.w <= layout.width - 1)).toBe(true);
      });

      it("역할이 없는 옛 나무는 복도 라벨로 복도를 알아보고 복도가 정문을 품는다", () => {
        const legacy = cloneConceptBundle(SCRATCH_INN_BUNDLE);
        legacy.places = legacy.places.map(({ id, label }) => ({ id, label }));
        const layout = layoutConceptFacility(legacy, legacy.facilities[0]!);
        const corridor = layout.rooms.find((room) => room.placeId === "corridor")!;
        expect(layout.door.y).toBe(corridor.y + corridor.h - 1);
        expect(layout.rooms.filter((room) => room.placeId === "bedroom")).toHaveLength(1);
        expect(layout.rooms.filter((room) => room.placeId === "dining")).toHaveLength(1);
      });

      it("식당(홀)을 지우면 복도가 정문을 품고 객실은 그대로 복도 위에 선다", () => {
        const edited = cloneConceptBundle(SCRATCH_INN_BUNDLE);
        edited.places = edited.places.filter((place) => place.id !== "dining");
        edited.facilities[0] = { ...edited.facilities[0]!, placeIds: ["bedroom", "corridor"] };
        const layout = layoutConceptFacility(edited, edited.facilities[0]!);
        const corridor = layout.rooms.find((room) => room.placeId === "corridor")!;
        expect(layout.rooms.find((room) => room.placeId === "dining")).toBeUndefined();
        expect(layout.door.y).toBe(corridor.y + corridor.h - 1);
        expect(layout.innerDoors).toHaveLength(2);
      });

      // Removed it "시공된 여관은 문에서 모든 방에": place_concept was removed from the tool registry on purpose.
    });
  });
});

describe("autotile", () => {
  isolateTimers();
  describe("autotile", () => {
    isolateTimers();
    type TileGrid = readonly (readonly number[])[];
    function mapFromRows(rows: TileGrid): { readonly width: number; readonly height: number; readonly lowerTiles: readonly number[] } {
      return {
        width: rows[0]?.length ?? 0,
        height: rows.length,
        lowerTiles: rows.flat(),
      };
    }
    describe("animated water autotile", () => {
      it("uses animated water body quarters when surrounded", () => {
        const water = LAKE_AUTOTILE_TILE.BODY;
        const map = mapFromRows([
          [water, water, water],
          [water, water, water],
          [water, water, water],
        ]);

        expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
          LAKE_AUTOTILE_TILE.BODY,
          LAKE_AUTOTILE_TILE.BODY,
          LAKE_AUTOTILE_TILE.BODY,
          LAKE_AUTOTILE_TILE.BODY,
        ]);
      });

      it("treats map bounds as land for water edges", () => {
        const water = LAKE_AUTOTILE_TILE.BODY;
        const map = mapFromRows([[water, water]]);

        expect(lakeAutotileQuarterSources(map, 0, 0).map((part) => part.tile)).toEqual([
          LAKE_AUTOTILE_TILE.OUTER_CORNER,
          LAKE_AUTOTILE_TILE.EDGE_NORTH,
          LAKE_AUTOTILE_TILE.OUTER_CORNER,
          LAKE_AUTOTILE_TILE.EDGE_SOUTH,
        ]);
      });
    });
  });
  describe("mapRegionWaterAndCompact", () => {
    isolateTimers();
    // toolResultForModel is private — exercise via compact behavior through session isn't easy;
    // water detection and get_map_region data.water are the public contract.

    describe("isMapWaterTile / waterBoundsInMap", () => {
      it("treats lake autotile and TILE.WATER as water", () => {
        expect(isMapWaterTile(TILE.WATER)).toBe(true);
        // body tile from lake set if exported
        const body = (LAKE_AUTOTILE_TILE as { BODY?: number }).BODY ?? (LAKE_AUTOTILE_TILE as unknown as number);
        if (typeof body === "number") {
          expect(isMapWaterTile(body)).toBe(true);
        }
      });

      it("get_map_region returns water.bounds for lake tiles", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId]!;
        // paint a small water blob using TILE.WATER
        for (let y = 5; y < 9; y += 1) {
          for (let x = 6; x < 11; x += 1) {
            map.lowerTiles[y * map.width + x] = TILE.WATER;
          }
        }
        const result = runTool({ project }, "get_map_region", {
          mapId,
          x: 0,
          y: 0,
          w: map.width,
          h: map.height,
        });
        expect(result.ok).toBe(true);
        const data = result.data as {
          water: { cellCount: number; bounds: { x: number; y: number; w: number; h: number } | null };
          grid: string[];
        };
        expect(data.water.cellCount).toBe(4 * 5);
        expect(data.water.bounds).toEqual({ x: 6, y: 5, w: 5, h: 4 });
        // grid uses ~
        expect(data.grid[5]!.slice(6, 11)).toBe("~~~~~");
        expect(result.summary).toContain("물");
      });

      it("uses the active tileset rather than foreign water/tree numbers", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const tileset = structuredClone(project.tilesets[map.tilesetId]);
        tileset.id = "custom-interior";
        tileset.image = { type: "uploaded", id: "custom-atlas" };
        tileset.tileMeta = [];
        tileset.tileGroups = [];
        tileset.palettePresets = [];
        project.tilesets[tileset.id] = tileset;
        map.tilesetId = tileset.id;
        map.lowerTiles.fill(TILE.WATER);
        map.upperTiles.fill(TILE.EMPTY);
        map.upperTiles[0] = TILE.TREE;
        const query = () => runTool({ project }, "get_map_region", { mapId: map.id, x: 0, y: 0, w: 2, h: 1 });
        const unrelated = query().data as { water: { cellCount: number }; grid: string[] };
        expect(unrelated.water.cellCount).toBe(0);
        expect(unrelated.grid[0]).not.toMatch(/[~T]/);
        tileset.tileMeta[TILE.WATER] = { label: "water", description: "", role: "water", source: "user" };
        const explicit = query().data as { water: { cellCount: number }; grid: string[] };
        expect(explicit.water.cellCount).toBe(2);
        expect(explicit.grid[0]).toBe("~~");
      });

      it("waterBoundsInMap matches painted water rectangle", () => {
        // TILE.WATER is a combined-town chip id; without a tileset argument only a combined-town map reads it as water.
        const project = startOnRetiredCombinedTown(createBlankProject());
        const map = project.maps[project.startMapId]!;
        map.lowerTiles[3 * map.width + 4] = TILE.WATER;
        map.lowerTiles[3 * map.width + 5] = TILE.WATER;
        const b = waterBoundsInMap(map, 0, 0, map.width, map.height);
        expect(b).toEqual({ cellCount: 2, x: 4, y: 3, w: 2, h: 1 });
      });
    });
    describe("show_map_region size cap", () => {
      // Complete coverage is exempt (see wholeMapCoverageRender.test.ts); the cap still
      // stops the roaming it was added for, which is oversized *partial* slices.
      it("clamps huge partial requests to 24×24 on a large map", () => {
        const project = createBlankProject();
        const big = createBlankMap("big", 60, 60);
        big.id = "map_big";
        project.maps[big.id] = big;
        const result = runTool({ project }, "show_map_region", {
          mapId: big.id,
          x: 4,
          y: 4,
          w: 80,
          h: 80,
        });
        expect(result.ok).toBe(true);
        const data = result.data as { w: number; h: number };
        expect(data.w).toBe(24);
        expect(data.h).toBe(24);
        expect((result.warnings ?? []).some((w: string) => w.includes("잘랐"))).toBe(true);
      });
    });
    describe("custom atlas semantics", () => {
      it("uses authored water metadata rather than colliding default atlas numbers", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const tileset = structuredClone(project.tilesets[map.tilesetId]!);
        tileset.id = "custom-semantic-atlas";
        tileset.image = { type: "uploaded", id: "custom-semantic-image" };
        tileset.tileMeta = [];
        tileset.palettePresets = [];
        tileset.tileGroups = [];
        tileset.tileMeta[0] = { label: "grass", description: "", tags: ["grass"] };
        tileset.tileMeta[425] = { label: "water", description: "", tags: ["water"] };
        project.tilesets[tileset.id] = tileset;
        map.tilesetId = tileset.id;
        map.events = [];
        map.lowerTiles.fill(0);
        map.upperTiles.fill(TILE.EMPTY);
        map.lowerTiles[map.width + 1] = 425;
        const result = runTool({ project }, "get_map_region", { mapId: map.id, x: 0, y: 0, w: 3, h: 3 });
        expect(result.ok).toBe(true);
        const data = result.data as { grid: string[]; water: { cellCount: number; bounds: unknown } };
        expect(data.water).toMatchObject({ cellCount: 1, bounds: { x: 1, y: 1, w: 1, h: 1 } });
        expect(data.grid[1][1]).toBe("~");
        expect(data.grid[0]).not.toContain("~");
        expect(waterBoundsInMap(map, 0, 0, 3, 3)).toBeNull();
        expect(waterBoundsInMap(map, 0, 0, 3, 3, tileset)?.cellCount).toBe(1);
      });
    });
  });
});

describe("autotileEngine", () => {
  isolateTimers();
  describe("autotileEngine", () => {
    isolateTimers();
    type MapView = { width: number; height: number; lowerTiles: number[] };
    function mapFromRows(rows: readonly (readonly number[])[]): MapView {
      return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
    }
    function at(map: MapView, x: number, y: number): number {
      return map.lowerTiles[y * map.width + x];
    }
    // 단순 대칭 오토타일 그룹: 몸통 0, 변/모서리 10~18.
    const SIMPLE_TILES = {
      body: 10,
      edgeN: 11,
      edgeS: 12,
      edgeW: 13,
      edgeE: 14,
      cornerNW: 15,
      cornerNE: 16,
      cornerSW: 17,
      cornerSE: 18,
    } as const;
    const SIMPLE_MEMBERS = [SIMPLE_TILES.body, 11, 12, 13, 14, 15, 16, 17, 18];
    const SIMPLE_GROUP: AutotileGroup = {
      id: "simple",
      name: "simple",
      neighborhood: 4,
      memberTileIds: SIMPLE_MEMBERS,
      variantMap: buildEdgeCornerVariantMap(SIMPLE_TILES),
    };
    describe("autotile bitmask engine", () => {
      it("계산한 4방향 비트마스크가 방향 비트와 일치한다", () => {
        // 중앙(1,1)만 멤버, 동/남 이웃만 멤버 → E|S 비트.
        const map = mapFromRows([
          [99, 99, 99],
          [99, 10, 10],
          [99, 10, 99],
        ]);
        const members = new Set(SIMPLE_MEMBERS);
        const mask = autotileNeighborMask(map, 1, 1, (t) => members.has(t), 4);
        expect(mask).toBe(AUTOTILE_DIR.E | AUTOTILE_DIR.S);
      });

      it("8방향에서 대각선 이웃 비트를 포함한다", () => {
        const map = mapFromRows([
          [10, 99, 99],
          [99, 10, 99],
          [99, 99, 99],
        ]);
        const members = new Set(SIMPLE_MEMBERS);
        const mask = autotileNeighborMask(map, 1, 1, (t) => members.has(t), 8);
        expect(mask & AUTOTILE_DIR.NW).toBe(AUTOTILE_DIR.NW);
        expect(mask & AUTOTILE_DIR.N).toBe(0);
      });

      it("variantMap 은 몸통/변/모서리 16종을 모두 매핑한다", () => {
        const variantMap = buildEdgeCornerVariantMap(SIMPLE_TILES);
        expect(Object.keys(variantMap)).toHaveLength(16);
        // 이웃 전무 → 좌상 모서리, 사방 연결 → 몸통.
        expect(variantMap[String(0)]).toBe(SIMPLE_TILES.cornerNW);
        const all = AUTOTILE_DIR.N | AUTOTILE_DIR.E | AUTOTILE_DIR.S | AUTOTILE_DIR.W;
        expect(variantMap[String(all)]).toBe(SIMPLE_TILES.body);
      });

      it("autotileVariantForMask 가 마스크로 타일을 조회한다", () => {
        // 북쪽만 없음 → 북쪽 변.
        const mask = AUTOTILE_DIR.E | AUTOTILE_DIR.S | AUTOTILE_DIR.W;
        expect(autotileVariantForMask(SIMPLE_GROUP, mask)).toBe(SIMPLE_TILES.edgeN);
      });

      it("autotileVariantForCell 은 멤버가 아닌 셀에는 undefined 를 반환한다", () => {
        const map = mapFromRows([[99]]);
        expect(autotileVariantForCell(map, SIMPLE_GROUP, 0, 0)).toBeUndefined();
      });

      it("shapeAutotileGroupAround 가 2x2 블록을 4모서리로 만든다", () => {
        const map = mapFromRows([
          [10, 10],
          [10, 10],
        ]);
        shapeAutotileGroupAround(map, SIMPLE_GROUP, [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ]);
        expect(at(map, 0, 0)).toBe(SIMPLE_TILES.cornerNW);
        expect(at(map, 1, 0)).toBe(SIMPLE_TILES.cornerNE);
        expect(at(map, 0, 1)).toBe(SIMPLE_TILES.cornerSW);
        expect(at(map, 1, 1)).toBe(SIMPLE_TILES.cornerSE);
      });

      it("edgeConnects 그룹은 맵 밖을 이어진 이웃으로 본다(MZ) — 가장자리를 채운 칸은 몸통으로 남는다", () => {
        const rows = [
          [10, 10],
          [10, 10],
        ];
        const points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
        const mz = mapFromRows(rows);
        shapeAutotileGroupAround(mz, { ...SIMPLE_GROUP, edgeConnects: true }, points);
        expect(mz.lowerTiles).toEqual([SIMPLE_TILES.body, SIMPLE_TILES.body, SIMPLE_TILES.body, SIMPLE_TILES.body]);
        expect(autotileNeighborMask(mapFromRows([[10]]), 0, 0, (t) => t === 10, 4, true)).toBe(15);
        // 기존 그룹(생략)은 그대로 — 맵 밖 = 끊김.
        expect(autotileNeighborMask(mapFromRows([[10]]), 0, 0, (t) => t === 10, 4)).toBe(0);
      });

      it("variantMap 에 매핑이 없으면 타일을 바꾸지 않는다", () => {
        const partial: AutotileGroup = { id: "p", name: "p", memberTileIds: [10], variantMap: {} };
        const map = mapFromRows([[10]]);
        shapeAutotileGroupAround(map, partial, [{ x: 0, y: 0 }]);
        expect(at(map, 0, 0)).toBe(10);
      });
    });
    describe("autotile trigger", () => {
      it("다음/이전 타일이 트리거 집합에 있으면 참", () => {
        expect(autotileEditTriggersGroup(SIMPLE_GROUP, undefined, 10)).toBe(true);
        expect(autotileEditTriggersGroup(SIMPLE_GROUP, 10, 99)).toBe(true);
        expect(autotileEditTriggersGroup(SIMPLE_GROUP, undefined, 99)).toBe(false);
      });

      it("모래 기본 그룹은 물 편집으로도 트리거된다", () => {
        expect(autotileEditTriggersGroup(DEFAULT_SAND_AUTOTILE_GROUP, undefined, TILE.WATER)).toBe(true);
      });
    });
    describe("built-in default groups reproduce legacy road/sand behavior", () => {
      it("흙길 2x2 → 4모서리", () => {
        const map = mapFromRows([
          [TILE.PATH, TILE.PATH],
          [TILE.PATH, TILE.PATH],
        ]);
        shapeAutotileGroupAround(map, DEFAULT_ROAD_AUTOTILE_GROUP, [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ]);
        expect(at(map, 0, 0)).toBe(DIRT_ROAD_TILE.CORNER_NORTH_WEST);
        expect(at(map, 1, 0)).toBe(DIRT_ROAD_TILE.CORNER_NORTH_EAST);
        expect(at(map, 0, 1)).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_WEST);
        expect(at(map, 1, 1)).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_EAST);
      });

      it("모래는 인접 물을 연결된 이웃으로 취급한다", () => {
        // 중앙 모래의 서쪽 열이 전부 물, 나머지는 모래 → 물이 연결로 취급되어 8방 전부 연결 = 몸통.
        const map = mapFromRows([
          [TILE.WATER, TILE.SAND, TILE.SAND],
          [TILE.WATER, TILE.SAND, TILE.SAND],
          [TILE.WATER, TILE.SAND, TILE.SAND],
        ]);
        expect(autotileVariantForCell(map, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.BODY);
        // 물을 비멤버(잔디)로 바꾸면 서쪽 연결이 끊겨 서쪽 변이 된다.
        const landMap = mapFromRows([
          [TILE.GRASS, TILE.SAND, TILE.SAND],
          [TILE.GRASS, TILE.SAND, TILE.SAND],
          [TILE.GRASS, TILE.SAND, TILE.SAND],
        ]);
        expect(autotileVariantForCell(landMap, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.EDGE_WEST);
      });

      it("외딴 1칸 모래/흙길은 외딴 점 타일이 되고, 외딴 점을 칠하면 그대로 유지된다", () => {
        const map = mapFromRows([
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
          [TILE.GRASS, TILE.SAND, TILE.GRASS],
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
        ]);
        expect(autotileVariantForCell(map, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.ISOLATED);
        const roadMap = mapFromRows([
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
          [TILE.GRASS, DIRT_ROAD_TILE.BODY, TILE.GRASS],
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
        ]);
        expect(autotileVariantForCell(roadMap, DEFAULT_ROAD_AUTOTILE_GROUP, 1, 1)).toBe(DIRT_ROAD_TILE.ISOLATED);
        // "363을 깔면 알아서 오토타일" 요건: 외딴 점 타일 자체를 칠해도 성형 후 그대로.
        const dotMap = mapFromRows([
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
          [TILE.GRASS, SAND_TILE.ISOLATED, TILE.GRASS],
          [TILE.GRASS, TILE.GRASS, TILE.GRASS],
        ]);
        shapeAutotileGroupAround(dotMap, DEFAULT_SAND_AUTOTILE_GROUP, [{ x: 1, y: 1 }]);
        expect(at(dotMap, 1, 1)).toBe(SAND_TILE.ISOLATED);
      });

      it("십자 교차로의 오목 코너 4칸은 합성 오목 타일이 된다", () => {
        // 3칸 폭 십자: 가로 rows 3~5, 세로 cols 3~5 (9x9).
        const S = TILE.SAND;
        const grid: number[][] = Array.from({ length: 9 }, () => Array<number>(9).fill(TILE.GRASS));
        for (let x = 0; x < 9; x++) for (let y = 3; y <= 5; y++) grid[y][x] = S;
        for (let y = 0; y < 9; y++) for (let x = 3; x <= 5; x++) grid[y][x] = S;
        const map = mapFromRows(grid);
        const points: { x: number; y: number }[] = [];
        for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (at(map, x, y) === S) points.push({ x, y });
        shapeAutotileGroupAround(map, DEFAULT_SAND_AUTOTILE_GROUP, points);
        // 오목 4칸: 4방 모래 + 대각 1곳 잔디.
        for (const [x, y] of [[3, 3], [5, 3], [3, 5], [5, 5]] as const) {
          expect(at(map, x, y), `(${x},${y})`).toBe(SAND_TILE.INNER_CORNER);
        }
        // 교차 중심은 대각까지 전부 모래 → 몸통 유지.
        expect(at(map, 4, 4)).toBe(SAND_TILE.BODY);
        // 팔 끝 볼록 모서리는 기존 9-슬라이스 유지.
        expect(at(map, 3, 0)).toBe(SAND_TILE.CORNER_NORTH_WEST);
        expect(at(map, 5, 0)).toBe(SAND_TILE.CORNER_NORTH_EAST);
      });

      it("대각에 접한 셀만 편집해도 이웃 몸통이 오목 코너로 재성형된다(8방 재검사)", () => {
        const grid: number[][] = Array.from({ length: 5 }, () => Array<number>(5).fill(SAND_TILE.BODY));
        const map = mapFromRows(grid);
        // (0,0)을 잔디로 바꾼 편집 — 대각 이웃 (1,1)은 몸통에서 오목 코너로 바뀌어야 한다.
        map.lowerTiles[0] = TILE.GRASS;
        shapeAutotileGroupAround(map, DEFAULT_SAND_AUTOTILE_GROUP, [{ x: 0, y: 0 }]);
        expect(at(map, 1, 1)).toBe(SAND_TILE.INNER_CORNER);
      });

      it("autotileGroupsForTileset 는 기본 Combined Town에서만 내장 그룹으로 폴백한다", () => {
        // 내장 그룹 수가 늘어도 깨지지 않게 파생값으로 대조 (2026-07-17: 4→11종).
        expect(autotileGroupsForTileset(undefined)).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length);
        // 합본 마을·던전 칩셋은 2026-10-07 저작권 정리로 새 프로젝트에서 빠졌다 — 그 칩셋을 들고 있는 옛 저장본을 재현한다.
        const project = withRetiredEasyRpgTilesets(createBlankProject());
        expect(autotileGroupsForTileset(project.tilesets[COMBINED_TOWN_TILESET_ID])).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length);
        // 던전은 내장 Combined Town 그룹으로 폴백하지 않고 자기 시드 그룹만 노출한다.
        const dungeonGroups = autotileGroupsForTileset(project.tilesets.easyrpg_chipset_dungeon);
        expect(dungeonGroups.every((group) => group.id.startsWith("harness-dungeon-v1-terrain-"))).toBe(true);
        expect(dungeonGroups.some((group) => group.id.startsWith("builtin_"))).toBe(false);
        // 병합 폴백: 흙길만 덮는 사용자 그룹이 영속돼 있어도 내장 모래 그룹은 살아있어야 한다.
        const withCustomRoad = structuredClone(project.tilesets[COMBINED_TOWN_TILESET_ID]!);
        withCustomRoad.autotileGroups = [
          { id: "custom_road", name: "커스텀 흙길", neighborhood: 8, memberTileIds: [DIRT_ROAD_TILE.BODY], variantMap: {} },
        ];
        const merged = autotileGroupsForTileset(withCustomRoad);
        expect(merged.map((group) => group.id)).toEqual([
          "custom_road",
          ...DEFAULT_AUTOTILE_GROUPS.filter((group) => group.id !== "builtin_dirt_road").map((group) => group.id),
        ]);
        const cloned = cloneDefaultAutotileGroups();
        expect(cloned).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length);
        expect(cloned[0]?.memberTileIds).not.toBe(DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
      });
    });
  });
  // 오토타일이 칠한 층 배열에서 모양을 잡는다(MZ 4층 — 2층 풀 장식 A2). 설계: docs/superpowers/plans/2026-09-25-mz-layers-assistant.md Task 3
  describe("autotileLayerView", () => {
    isolateTimers();
    const TILES = { body: 10, edgeN: 11, edgeS: 12, edgeW: 13, edgeE: 14, cornerNW: 15, cornerNE: 16, cornerSW: 17, cornerSE: 18 } as const;
    const GROUP: AutotileGroup = {
      id: "grass-deco",
      name: "풀 장식",
      neighborhood: 4,
      memberTileIds: [10, 11, 12, 13, 14, 15, 16, 17, 18],
      variantMap: buildEdgeCornerVariantMap(TILES),
    };
    function blankMap(width = 5, height = 5): GameMap {
      return {
        id: "m", name: "m", width, height, tilesetId: "t", tileSize: 16,
        lowerTiles: new Array<number>(width * height).fill(10), upperTiles: new Array<number>(width * height).fill(-1), events: [],
      } as GameMap;
    }
    describe("autotileLayerView", () => {
      it("2층에 칠한 멤버는 2층 이웃 기준으로 모양이 잡히고 1층은 그대로다", () => {
        const map = blankMap();
        const lowerBefore = map.lowerTiles.slice();
        // 2층 가운데 가로 3칸 띠 (1..3, 2) — 1층은 전부 같은 그룹 몸통(10)이라 1층 이웃을 보면 모두 몸통이 된다.
        const points = [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }];
        for (const p of points) setLayerTileAt(map, 2, p.y * map.width + p.x, TILES.body);
        shapeAutotileGroupAround(autotileLayerView(map, 2), GROUP, points);
        const row = [1, 2, 3].map((x) => map.lowerOverlayTiles![2 * map.width + x]);
        // 위아래가 비었으므로 몸통이 아니라 가장자리/모서리다(2층 이웃 기준).
        expect(row).toEqual([TILES.cornerNW, TILES.edgeN, TILES.cornerNE]);
        expect(map.lowerTiles).toEqual(lowerBefore);
      });

      it("1층 뷰는 lowerTiles, 3층 뷰는 upperTiles 를 그대로 빌려준다", () => {
        const map = blankMap();
        expect(autotileLayerView(map, 1).lowerTiles).toBe(map.lowerTiles);
        expect(autotileLayerView(map, 3).lowerTiles).toBe(map.upperTiles);
      });

      it("2·4층 칸이 없는 옛 맵에서는 모양 잡기가 새 키를 만들지 않는다", () => {
        const map = blankMap();
        for (const layer of [2, 4] as const) {
          shapeAutotileGroupAround(autotileLayerView(map, layer), GROUP, [{ x: 2, y: 2 }]);
        }
        expect("lowerOverlayTiles" in map).toBe(false);
        expect("upperOverlayTiles" in map).toBe(false);
      });
    });
  });
});

describe("autotileGroups", () => {
  isolateTimers();
  describe("autotileGroupPersistence", () => {
    isolateTimers();
    function firstTilesetId(project: Project): string {
      // 새 프로젝트의 첫 타일셋(버들항, 2026-10-07 저작권 정리 뒤 기본값)은 오토타일 그룹을 들고 태어난다 —
      // 이 시험은 「그룹이 없는 타일셋」에서 시작하는 일반 동작을 보므로 그룹 없는 첫 타일셋을 고른다.
      const id = Object.keys(project.tilesets).find((key) => !project.tilesets[key]?.autotileGroups?.length);
      if (!id) throw new Error("no tileset without autotile groups in blank project");
      return id;
    }
    function canonicalProject(): Project {
      const project = createBlankProject();
      // Text-only titleGraphic is omitted by system normalization. Keep that
      // unrelated migration out of the autotile byte-stability precondition.
      project.system = normalizeSystemRecords(project.system);
      return project;
    }
    beforeEach(() => {
      store.replace(canonicalProject());
    });
    describe("오토타일 그룹 직렬화 왕복", () => {
      it("구버전(오토타일 필드 없음) 프로젝트가 그대로 로드된다", () => {
        const project = canonicalProject();
        // 기본 프로젝트에는 autotileGroups 가 없다 → optional 필드이므로 왕복 무손실.
        const restored = deserialize(serialize(project));
        expect(serialize(restored)).toBe(serialize(project));
        const tilesetId = firstTilesetId(restored);
        expect(restored.tilesets[tilesetId].autotileGroups).toBeUndefined();
      });

      it("오토타일 그룹이 있는 프로젝트가 왕복 후 보존된다", () => {
        const tilesetId = firstTilesetId(store.getCurrent());
        const groupId = addAutotileGroup(tilesetId, "임포트 길");
        expect(groupId).not.toBeNull();
        fillAutotileVariantMap(tilesetId, groupId!, {
          body: 100,
          edgeN: 101,
          edgeS: 102,
          edgeW: 103,
          edgeE: 104,
          cornerNW: 105,
          cornerNE: 106,
          cornerSW: 107,
          cornerSE: 108,
        });
        updateAutotileGroup(tilesetId, groupId!, { memberTileIds: [100, 101, 102, 103, 104, 105, 106, 107, 108] });

        const before = store.getCurrent();
        const restored = deserialize(serialize(before));
        expect(serialize(restored)).toBe(serialize(before));

        const group = restored.tilesets[tilesetId].autotileGroups?.[0];
        expect(group?.name).toBe("임포트 길");
        expect(Object.keys(group?.variantMap ?? {})).toHaveLength(16);
        expect(group?.variantMap[String(0)]).toBe(105); // 이웃 전무 → 북서 모서리
      });
    });
    describe("오토타일 그룹 뮤테이션", () => {
      it("그룹 추가/기본값 시드/삭제가 동작한다", () => {
        const tilesetId = firstTilesetId(store.getCurrent());

        seedDefaultAutotileGroups(tilesetId);
        expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toEqual(DEFAULT_AUTOTILE_GROUPS);

        const groupId = addAutotileGroup(tilesetId, "추가");
        expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length + 1);

        removeAutotileGroup(tilesetId, groupId!);
        expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toEqual(DEFAULT_AUTOTILE_GROUPS);
      });

      it("단일 비트마스크 항목 편집과 제거", () => {
        const tilesetId = firstTilesetId(store.getCurrent());
        const groupId = addAutotileGroup(tilesetId, "그룹")!;

        setAutotileVariant(tilesetId, groupId, 5, 42);
        expect(store.getCurrent().tilesets[tilesetId].autotileGroups?.[0].variantMap[String(5)]).toBe(42);

        setAutotileVariant(tilesetId, groupId, 5, null);
        expect(store.getCurrent().tilesets[tilesetId].autotileGroups?.[0].variantMap[String(5)]).toBeUndefined();
      });

      it("마지막 그룹을 지우면 autotileGroups 필드가 제거된다", () => {
        const tilesetId = firstTilesetId(store.getCurrent());
        const groupId = addAutotileGroup(tilesetId, "그룹")!;
        removeAutotileGroup(tilesetId, groupId);
        expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toBeUndefined();
      });
    });
  });
  describe("combinedTownAutotileAudit", () => {
    isolateTimers();
    function fixture(group: AutotileGroup, tiles: readonly number[]): Project {
      const project = startOnRetiredCombinedTown(createBlankProject());
      project.meta = { ...project.meta, title: "audit fixture" };
      const map = project.maps[project.startMapId]!;
      map.width = tiles.length;
      map.height = 1;
      map.lowerTiles = [...tiles];
      map.upperTiles = tiles.map(() => 0);
      project.tilesets[map.tilesetId] = { ...project.tilesets[map.tilesetId]!, autotileGroups: [group] };
      return project;
    }
    describe("combined-town autotile audit", () => {
      const group = DEFAULT_AUTOTILE_GROUPS[0]!;
      const isolated = group.variantMap["0"]!;
      const connectedEast = group.variantMap["2"]!;
      const connectedWest = group.variantMap["8"]!;

      it("accepts canonical variants", () => {
        const report = auditCombinedTownAutotiles(fixture(group, [connectedEast, connectedWest]), "fixture");
        expect(report.findings).toEqual([]);
        expect(report.memberCells).toBe(2);
      });

      it("reports an incorrect boundary variant with coordinates", () => {
        const wrong = group.memberTileIds.find((tile) => tile !== isolated)!;
        const report = auditCombinedTownAutotiles(fixture(group, [wrong]), "fixture");
        expect(report.findings).toEqual([
          expect.objectContaining({ x: 0, y: 0, actual: wrong, expected: isolated, reason: "stale-variant" }),
        ]);
      });

      it("does not mutate the audited project", () => {
        const project = fixture(group, [isolated]);
        const before = structuredClone(project);
        auditCombinedTownAutotiles(project, "fixture");
        expect(project).toEqual(before);
      });

      it("excludes lake and base grass outside effective groups", () => {
        const report = auditCombinedTownAutotiles(fixture(group, [0, 240]), "fixture");
        expect(report.memberCells).toBe(0);
        expect(report.findings).toEqual([]);
      });

      it("merges a custom group with non-overlapping built-ins", () => {
        const project = startOnRetiredCombinedTown(createBlankProject());
        const map = project.maps[project.startMapId]!;
        project.tilesets[map.tilesetId] = { ...project.tilesets[map.tilesetId]!, autotileGroups: [group] };
        const report = auditCombinedTownAutotiles(project, "fixture");
        expect(report.effectiveGroupIds.length).toBe(DEFAULT_AUTOTILE_GROUPS.length);
      });

      it("repairs every stale member variant deterministically", () => {
        const wrong = group.memberTileIds.find((tile) => tile !== isolated)!;
        const project = fixture(group, [wrong]);
        const original = structuredClone(project);
        const repaired = repairCombinedTownAutotiles(project);
        expect(auditCombinedTownAutotiles(repaired, "fixture").findings).toEqual([]);
        expect(project).toEqual(original);
        expect(repairCombinedTownAutotiles(repaired)).toEqual(repaired);
      });
    });
  });
  describe("forestFloorMix", () => {
    isolateTimers();
    const UNDERGROWTH = new Set<number>(DEFAULT_UNDERGROWTH_AUTOTILE_GROUP.memberTileIds);
    const TRUNKS = new Set([290, 291, 292, 293]);
    const CANOPIES = new Set([260, 261, 262, 263]);
    const BUSHES = new Set([288, 289]);
    /** 1×1 풀 — 키큰 풀 오토타일 조각 + 잔디 변형. 한 칸만 쓰면 네모로 뜬다. */
    const ONE_BY_ONE_GRASS = new Set([
      243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335,
      270, 271, 272, 300, 301, 302, 330,
    ]);
    function setup() {
      // 밑동 290~293·수관 260~263 은 옛 combined_town 칸 번호다 — 2026-10-07 정리 뒤 기본 칩셋(beodeul_city)이 아니므로 그 시트를 명시해 만든다.
      const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(createEmptyToolProject("숲 바닥 혼합")) };
      const made = runTool(ctx, "create_map", { name: "숲", width: 30, height: 30, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID });
      const mapId = (made.data as { mapId: string }).mapId;
      return { ctx, mapId };
    }
    type Area = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
    function snapshot(map: GameMap, area: Area): { trunks: number; canopies: number; bushes: number } {
      let trunks = 0;
      let canopies = 0;
      let bushes = 0;
      for (let y = area.y; y < area.y + area.h; y += 1) {
        for (let x = area.x; x < area.x + area.w; x += 1) {
          const i = y * map.width + x;
          const lower = map.lowerTiles[i] ?? 0;
          const upper = map.upperTiles[i] ?? 0;
          if (TRUNKS.has(upper) || TRUNKS.has(lower) || isTreeTrunkTileId(upper) || isTreeTrunkTileId(lower)) trunks += 1;
          if (CANOPIES.has(upper) || isTreeCanopyTileId(upper)) canopies += 1;
          if (BUSHES.has(upper) || BUSHES.has(lower)) bushes += 1;
        }
      }
      return { trunks, canopies, bushes };
    }
    function counts(map: GameMap, area: Area) {
      let undergrowth = 0;
      let water = 0;
      let waterOnTrunk = 0;
      let waterOnBush = 0;
      let cells = 0;
      for (let y = area.y; y < area.y + area.h; y += 1) {
        for (let x = area.x; x < area.x + area.w; x += 1) {
          cells += 1;
          const i = y * map.width + x;
          const lower = map.lowerTiles[i] ?? 0;
          const upper = map.upperTiles[i] ?? 0;
          if (UNDERGROWTH.has(lower)) undergrowth += 1;
          if (isLakeAutotileTile(lower)) {
            water += 1;
            if (TRUNKS.has(upper) || TRUNKS.has(lower) || isTreeTrunkTileId(lower) || isTreeTrunkTileId(upper)) {
              waterOnTrunk += 1;
            }
            if (BUSHES.has(upper) || BUSHES.has(lower)) waterOnBush += 1;
          }
        }
      }
      return { undergrowth, water, waterOnTrunk, waterOnBush, cells };
    }
    describe("forest floor mix", () => {
      it("dense 합성: 짙은 수풀이 드물게 깔리고 수관·밑동·덤불이 살아남는다", () => {
        const { ctx, mapId } = setup();
        const area = { x: 2, y: 2, w: 20, h: 20 };
        const result = runTool(ctx, "place_props", {
          mapId, area, material: "침엽수", density: "dense", seed: 7,
        });
        expect(result.ok, result.summary).toBe(true);
        const map = ctx.project.maps[mapId]!;
        const c = counts(map, area);
        expect(c.undergrowth).toBeGreaterThan(0);
        expect(c.undergrowth).toBeLessThan(c.cells * 0.35);
        expect(c.water).toBeLessThanOrEqual(8);
        expect(c.waterOnTrunk).toBe(0);
        expect(c.waterOnBush).toBe(0);
        const s = snapshot(map, area);
        expect(s.trunks).toBeGreaterThan(0);
        expect(s.canopies).toBeGreaterThan(0);
        expect(s.bushes).toBeGreaterThan(0);
      });

      it("tone 칠하기: 1×1 풀(키큰 풀·잔디 변형)을 lower에 쓰지 않는다", () => {
        const { ctx, mapId } = setup();
        const area = { x: 2, y: 2, w: 20, h: 20 };
        const result = runTool(ctx, "place_props", {
          mapId, area, material: "침엽수", density: "dense", seed: 7,
        });
        expect(result.ok, result.summary).toBe(true);
        const map = ctx.project.maps[mapId]!;
        for (let y = area.y; y < area.y + area.h; y += 1) {
          for (let x = area.x; x < area.x + area.w; x += 1) {
            const lower = map.lowerTiles[y * map.width + x] ?? 0;
            expect(ONE_BY_ONE_GRASS.has(lower), `${x},${y}=${lower}`).toBe(false);
          }
        }
      });

      it("impassable 합성: 물웅덩이가 밑동·덤불을 덮지 않는다", () => {
        const { ctx, mapId } = setup();
        const area = { x: 2, y: 2, w: 20, h: 20 };
        const result = runTool(ctx, "place_props", {
          mapId, area, material: "활엽수", density: "impassable", seed: 11,
        });
        expect(result.ok, result.summary).toBe(true);
        const map = ctx.project.maps[mapId]!;
        const c = counts(map, area);
        expect(c.undergrowth).toBeGreaterThan(0);
        expect(c.waterOnTrunk).toBe(0);
        expect(c.waterOnBush).toBe(0);
        const s = snapshot(map, area);
        expect(s.trunks).toBeGreaterThan(0);
        expect(s.canopies).toBeGreaterThan(0);
        expect(s.bushes).toBeGreaterThan(0);
      });
    });
  });
});

describe("battleStatusItemMessage", () => {
  isolateTimers();
  function readyBattle(options: {
    inventory: Record<string, number>;
    stateIds?: Record<string, readonly string[]>;
    vitals?: Record<string, { hp: number; mp: number }>;
    partyActorIds?: readonly string[];
  }) {
    const project = createBlankProject();
    const troopId = project.database.troops[0]?.id;
    if (!troopId) throw new Error("missing troop");
    const partyActorIds = options.partyActorIds ?? [DEFAULT_ACTOR_ID];
    const runtime = createBattleRuntime({
      project,
      troopId,
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
      rng: () => 0.5,
      party: {
        partyActorIds: [...partyActorIds],
        levels: Object.fromEntries(partyActorIds.map((id) => [id, 1])),
        experience: Object.fromEntries(partyActorIds.map((id) => [id, 0])),
        ...(options.vitals ? { vitals: options.vitals } : {}),
        ...(options.stateIds ? { stateIds: options.stateIds } : {}),
      },
      sessionState: { switches: {}, variables: {}, inventory: options.inventory },
    });
    for (let i = 0; i < 40 && runtime.snapshot().phase !== "actorCommand"; i += 1) runtime.tick(1_000);
    expect(runtime.snapshot().phase).toBe("actorCommand");
    return runtime;
  }
  function useItem(runtime: BattleRuntime, itemId: string, targetActorId?: string) {
    const command: ActorCommand = { kind: "item", itemId, targetEnemyId: "", ...(targetActorId ? { targetActorId } : {}) };
    const before = runtime.snapshot();
    runtime.performActorCommand(command);
    const after = runtime.snapshot();
    return { command, before, after, delta: after.timeline.slice(before.timeline.length) };
  }
  /** 명령 직후 메시지 창에 올라오는 줄. 적 턴까지 가지 않도록 몇 비트만 뺀다. */
  function spokenLines(runtime: BattleRuntime, command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): string[] {
    const lines: string[] = [];
    const queue: Array<() => void> = [];
    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: (state) => lines.push(...state.lines),
        onSyncView: () => {},
        onDamageFeedback: () => {},
        onResultStage: () => {},
        onSequenceBusy: () => {},
      },
      (callback) => {
        queue.push(callback);
        return queue.length;
      },
      () => {},
    );
    sequencer.runAfterActorCommand(command, before, after);
    for (let i = 0; i < 16 && queue.length > 0; i += 1) queue.shift()?.();
    sequencer.cancel();
    return lines;
  }
  describe("status-only battle medicine messages", () => {
    it("cures poison without a zero heal or an insufficient-effect line", () => {
      const runtime = readyBattle({
        inventory: { item_antidote: 1 },
        stateIds: { [DEFAULT_ACTOR_ID]: [DEFAULT_STATE_ID] },
      });
      const { command, before, after, delta } = useItem(runtime, "item_antidote", DEFAULT_ACTOR_ID);
      const own = delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);

      expect(after.actors[0]?.stateIds ?? []).not.toContain(DEFAULT_STATE_ID);
      expect(after.eventState.inventory.item_antidote ?? 0).toBe(0);
      expect(own.some((entry) => entry.kind === "stateRemoved" && entry.stateId === DEFAULT_STATE_ID)).toBe(true);
      expect(own.some((entry) => entry.kind === "healing")).toBe(false);
      expect(own.some((entry) => entry.kind === "action" && (entry.amount ?? 0) === 0)).toBe(false);

      const director = actorCommandDirectorState(command, before, after).lines.join(" ");
      expect(director).toContain("해독초");
      expect(director).toContain("사용했다");
      expect(director).not.toContain("효과가 충분하지 않았다");

      const spoken = spokenLines(runtime, command, before, after).join(" ");
      expect(spoken).toContain("해독초");
      expect(spoken).toContain("독이 풀렸다");
      expect(spoken).not.toContain("효과가 충분하지 않았다");
      expect(spoken).not.toContain("합계 0");
    });

    it("still says the effect was insufficient when the antidote cures nothing", () => {
      const runtime = readyBattle({ inventory: { item_antidote: 1 } });
      const { command, before, after, delta } = useItem(runtime, "item_antidote", DEFAULT_ACTOR_ID);
      const own = delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);

      expect(after.eventState.inventory.item_antidote ?? 0).toBe(0);
      expect(own.some((entry) => entry.kind === "stateRemoved")).toBe(false);
      expect(own.some((entry) => entry.kind === "healing")).toBe(false);
      expect(own.some((entry) => entry.kind === "action" && (entry.amount ?? 0) === 0)).toBe(true);
      expect(actorCommandDirectorState(command, before, after).lines.join(" ")).toContain("효과가 충분하지 않았다");
    });

    it("still heals a wounded ally and still reports a full-HP potion as insufficient", () => {
      const wounded = readyBattle({
        inventory: { [DEFAULT_ITEM_ID]: 1 },
        vitals: { [DEFAULT_ACTOR_ID]: { hp: 20, mp: 5 } },
      });
      const healed = useItem(wounded, DEFAULT_ITEM_ID, DEFAULT_ACTOR_ID);
      expect(healed.after.actors[0]?.hp).toBe(70);
      expect(healed.delta.some((entry) => entry.kind === "healing" && entry.resource === "hp" && (entry.amount ?? 0) > 0)).toBe(true);
      expect(actorCommandDirectorState(healed.command, healed.before, healed.after).lines.join(" ")).toMatch(/회복했다/);

      const full = readyBattle({
        inventory: { [DEFAULT_ITEM_ID]: 1 },
        vitals: { [DEFAULT_ACTOR_ID]: { hp: 9999, mp: 9999 } },
      });
      const wasted = useItem(full, DEFAULT_ITEM_ID, DEFAULT_ACTOR_ID);
      const own = wasted.delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);
      expect(wasted.after.actors[0]?.hp).toBe(wasted.after.actors[0]?.maxHp);
      expect(own.some((entry) => entry.kind === "healing")).toBe(false);
      expect(own.some((entry) => entry.kind === "action" && (entry.amount ?? 0) === 0)).toBe(true);
      expect(actorCommandDirectorState(wasted.command, wasted.before, wasted.after).lines.join(" ")).toContain("효과가 충분하지 않았다");
    });

    it("does not summarize a party cleanse as zero recovery", () => {
      const runtime = readyBattle({
        inventory: { item_gen2_party_cleanse: 1 },
        partyActorIds: [DEFAULT_ACTOR_ID, ACTOR_MAGE_ID],
        stateIds: {
          [DEFAULT_ACTOR_ID]: ["state_attack_down"],
          [ACTOR_MAGE_ID]: ["state_attack_down"],
        },
      });
      const { command, before, after, delta } = useItem(runtime, "item_gen2_party_cleanse");
      const own = delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);
      const cured = own.filter((entry) => entry.kind === "stateRemoved" && entry.stateId === "state_attack_down");

      expect(cured).toHaveLength(2);
      expect(own.some((entry) => entry.kind === "healing")).toBe(false);
      expect(after.actors.every((actor) => !actor.stateIds.includes("state_attack_down"))).toBe(true);
      expect(after.eventState.inventory.item_gen2_party_cleanse ?? 0).toBe(0);

      const spoken = spokenLines(runtime, command, before, after).join(" ");
      expect(spoken).toContain("맑은 종");
      // 같은 상태가 여럿에게서 잇달아 풀리면 한 줄로 묶일 수 있다(「주인공, 마도사의 공격 하락이 풀렸다.」) — 두 이름과 문장이 다 읽히면 된다.
      expect(spoken).toMatch(/주인공(?:, 마도사)?의 공격 하락이 풀렸다/);
      expect(spoken).toMatch(/(?:주인공, )?마도사의 공격 하락이 풀렸다/);
      expect(spoken).not.toContain("효과가 충분하지 않았다");
      expect(spoken).not.toContain("합계 0");
      expect(spoken).not.toMatch(/의 공격!/);
    });
  });
});
