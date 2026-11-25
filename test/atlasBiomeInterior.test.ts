import { describe, expect, it } from "vitest";
import { conceptFacilityLevels, layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { createBlankProject } from "@/project/defaults";
import { ATLAS_BIOME_INTERIOR_ID, atlasBiomeInteriorReplacementWarnings, ATLAS_BIOME_INTERIOR_COUNT, createAtlasBiomeInteriorTileset } from "@/project/defaults/atlasBiomeInterior";
import { cloneConceptBundle } from "@/project/defaults/scratchInnBundle";
import { SCRATCH_INN_BUNDLE } from "./fixtures/legacyConceptInn";
import { validateTileset } from "@/project/io/shapeResourceFields";
import type { ConceptBundleRecord, Project } from "@/project/types";
import fs from "node:fs";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { buildHandInteriorLayers, handInteriorStructure, HAND_INTERIOR_SPEC } from "@/editor/handInterior/builder";
import { runTool, toOpenAiTools } from "@/editor/tools";
import { canMove } from "@/project/collision";
import { capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { isolateTimers } from "./mergedTeardown";

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
