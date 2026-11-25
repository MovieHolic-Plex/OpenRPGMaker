import { describe, expect, it, beforeEach } from "vitest";
import { bindSeedHouseInteriorPlan } from "@/editor/interiorConceptPlan";
import { createBlankProject } from "@/project/defaults";
import { SCRATCH_HOUSE_BUNDLE, SCRATCH_LIBRARY_BUNDLE } from "@/project/defaults/conceptFacilityTemplates";
import { withRetiredEasyRpgTilesets, retiredEasyRpgTileset, startOnRetiredCombinedTown, RETIRED_COMBINED_TOWN_TILESET_ID } from "./support/retiredEasyRpgTilesets";
import { withEnvironment } from "@/editor/panels/spatialSpaceDraft";
import { createEmptyRoomMap, applyInteriorRoomLayer, floorMaskFromPlan } from "@/editor/interiorRoomPipeline";
import { interiorActivityEntries } from "@/editor/interiorActivityEntries";
import { deserialize, serialize } from "@/project/io";
import { spatialId, own } from "@/project/spatial/domain";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { spaceLayout } from "@/editor/spatial/spaceLayout";
import { buildHouseInteriorPlan } from "@/editor/houseInteriors";
import { fixtureDocument, spaceCompilerFixture, reinstantiateSpace, spaceDesign, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { PIRATE_ISLES_ID, createPirateIslesTileset } from "@/project/defaults/pirateIsles";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import { runTool, type ToolContext } from "@/editor/tools";
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";
import spec from "../tiledata/pirate-isles/objects/spec.json";
import ask from "../tiledata/pirate-isles/objects/ask.json";
import { pickNpcGraphic } from "@/assets/charsetQuery";
import { bundledTileSemantics, searchResources } from "@/assets/resourceSearch";
import { resolveGraphic } from "@/editor/tools/eventCompile";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { defaultTilesets } from "@/project/defaults/defaultAssets";
import { DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsDungeon";
import { resolveMaterialByLabel, isTrustedGroupSource } from "@/project/tileVocabulary";
import { POKEMON_OVERWORLD_PRESET, pokemonPresetGroupIds, pokemonPresetRole, pokemonPresetRoleLabels } from "@/project/defaults/pokemonChipsetPreset";
import { CHIPSET_TILE_GROUPS, describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { COMBINED_TOWN_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsCombinedTown";
import { COMBINED_TOWN_TILESET_ID, TILE, DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { getTool } from "@/editor/tools/toolRegistry";
import { defaultOutdoorTilesetId } from "@/project/defaults/outdoorTileset";
import { isRetiredEasyRpgTileset } from "@/project/retiredEasyRpgTilesets";
import { bundledChipsetTileSize, bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { buildHandInteriorLayers, floorLayX, HAND_INTERIOR_SPECS, roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { compileRoomKit, installRoomKit, kitHandObjects, parseRoomKitDraft, roomKitAssetId, roomKitPicksProblem, rpgMakerAutotileSheet, rpgMakerBlockPicks, savedRoomKitPicks, type RoomKitPicks } from "@/project/roomKit";
import { createWizardingWorldTileset } from "@/project/defaults/wizardingWorld";
import { isolateTimers } from "./mergedTeardown";

describe("openInteriorZones", () => {
  isolateTimers();
  function zoned() {
    return reinstantiateSpace(spaceCompilerFixture(), space => ({ ...space, environment: "interior", role: "entrance",
      zones: [{ id: spatialId("sleep"), name: "침상", x: 0, y: 0, width: 6, height: 5, floor: "stone" },
        { id: spatialId("living"), name: "생활", x: 0, y: 5, width: 16, height: 7, floor: "wood" }],
      objectSlots: space.objectSlots.filter(s => s.id === "beds").map(s => ({ ...s, zoneId: spatialId("sleep") })),
    }));
  }
  describe("activity zones share one interior shell", () => {
    it("leaves wide openings to reachability checks while preserving narrow doorway reservations", () => {
      const mask=Array.from({length:36},(_,i)=>Math.floor(i/6)<3), full=Array(36).fill(true);
      expect(interiorActivityEntries(mask,full,6,6,true)).toEqual([]);
      expect(interiorActivityEntries(mask,full,6,6,false)).toHaveLength(6);
      const door=mask.map((v,i)=>v || i===3*6+2);
      expect(interiorActivityEntries(mask,door,6,6,true)).toEqual([{x:2,y:2,dx:0,dy:-1}]);
    });
    it("preserves zones in an interior draft and clears assignments when converting outdoors", () => {
      const project=zoned(), source=own(fixtureDocument(project).library.spaces,spaceDesign);
      expect(withEnvironment(source,"interior")).toEqual(source);
      expect(withEnvironment(source,"outdoor").objectSlots.every(slot=>slot.zoneId===undefined)).toBe(true);
    });
    it("opens touching activities only when requested, keeping old gapless partitions", () => {
      const plan={...buildHouseInteriorPlan({mapId:"home",name:"home",seed:7,scale:"cottage2",program:"dwelling"}),width:11,height:12,openPlan:true,door:{x:7,y:9},innerDoors:[],rooms:[{id:"bed",theme:"bedroom",x:2,y:4,w:4,h:2},{id:"cook",theme:"kitchen",x:6,y:4,w:3,h:2},{id:"living",theme:"dining",x:2,y:6,w:7,h:4}]};
      const open=applyInteriorRoomLayer(createEmptyRoomMap(plan),plan,"walls").map;
      const closedPlan={...plan,openPlan:false};
      const closed=applyInteriorRoomLayer(createEmptyRoomMap(closedPlan),closedPlan,"walls").map;
      expect(open.lowerTiles[5*open.width+5]).toBe(72);
      expect(closed.lowerTiles[5*closed.width+5]).not.toBe(72);
    });
    it.each(["cream", "gold-brick", "stone-brick"].flatMap(wall => ["bookshelf", "cabinet", "stone_hearth_lit", "stone_hearth_unlit"].map(kitId => ({wall,kitId}))))("overlaps $kitId with $wall using its frozen graphic identity", ({wall,kitId}) => {
      const project=spaceCompilerFixture(), doc=fixtureDocument(project);
      const object=doc.library.objects["bed-design"]!;
      project.spatialAuthoring={...doc,library:{...doc.library,objects:{...doc.library.objects,
        "bed-design":{...object,graphic:{...object.graphic,kitId}}}}};
      const input=reinstantiateSpace(project,space=>({...space,wall,objectSlots:[{...space.objectSlots[0]!,quantity:1}]}));
      const built=compileSpatialOccurrence(input,{occurrenceId:spaceRoot});
      const child=Object.values(fixtureDocument(built).occurrences).find(o=>o.parentId===spaceRoot)!;
      expect(child.bindings[0]!.rect.y).toBe(["bookshelf", "cabinet"].includes(kitId) ? 3 : 2); // Hearth: two wall rows; bookshelf: one.
      expect(child.bindings[0]!.rect.height).toBe(kitId === "cabinet" ? 2 : 3);
      expect(deserialize(serialize(built)).spatialAuthoring).toEqual(built.spatialAuthoring);
    });
    it("round-trips live and frozen zones, paints different floors without a partition", () => {
      const project = deserialize(serialize(zoned()));
      const source = own(fixtureDocument(project).library.spaces, spaceDesign);
      expect(source.environment === "interior" && source.zones?.length).toBe(2);
      const {map, floor} = spaceLayout(project, source, {mapId:"zoned", seed:7});
      expect(map.lowerTiles[8 * map.width + 4]).toBe(12);
      expect(map.lowerTiles[9 * map.width + 4]).toBe(72);
      expect(floor[8 * map.width + 4] && floor[9 * map.width + 4]).toBe(true);
      const proposal = compileSpatialOccurrence(project, {occurrenceId:spaceRoot});
      const doc = fixtureDocument(proposal);
      const children = Object.values(doc.occurrences).filter(o => o.parentId === spaceRoot);
      expect(children).toHaveLength(2);
      for (const child of children) {
        const rect = child.bindings[0]!.rect;
        expect(rect.x).toBeGreaterThanOrEqual(2); expect(rect.x + rect.width).toBeLessThanOrEqual(8);
        expect(rect.y).toBeGreaterThanOrEqual(4); expect(rect.y + rect.height).toBeLessThanOrEqual(9);
      }
      expect(deserialize(serialize(proposal)).spatialAuthoring).toEqual(proposal.spatialAuthoring);
    });
    it.each(["overlap", "outside", "unknown"])("rejects %s zone inputs rather than silently moving furniture", fault => {
      const project = zoned();
      const raw = JSON.parse(serialize(project));
      const space = raw.spatialAuthoring.library.spaces[spaceDesign];
      if (fault === "overlap") space.zones[1].y = 4;
      if (fault === "outside") space.zones[0].x = -1;
      if (fault === "unknown") space.objectSlots[0].zoneId = "missing";
      expect(() => deserialize(JSON.stringify(raw))).toThrow();
    });
    it("uses one small common table for meals and study in a tiny generated home", () => {
      const plan=buildHouseInteriorPlan({mapId:"home",name:"home",seed:7,scale:"cottage3",program:"study"});
      // 새 프로젝트에는 꾸러미 초안도 EasyRPG 실내 칩셋도 없다(초안 폐기 2026-09-18, 저작권 정리 2026-10-07) — 서재·민가 초안을 직접 심는다.
      const project=withRetiredEasyRpgTilesets(createBlankProject());
      project.tilesets.easyrpg_chipset_interior!.scratchConceptBundles=[structuredClone(SCRATCH_HOUSE_BUNDLE),structuredClone(SCRATCH_LIBRARY_BUNDLE)];
      const bound=bindSeedHouseInteriorPlan(plan,project,"study");
      const tables=Object.values(bound.concept!.rooms).flatMap(r=>r.things).filter(t=>["home_table","table_chairs","dining_table","reading_table","study_desk"].includes(t.objectId));
      expect(tables).toHaveLength(1); expect(tables[0]!.objectId).toBe("home_table");
      expect(bound.width * bound.height).toBeLessThan(220);
    });
    it("defaults small domestic houses to continuous floor, preserving private/public programs", () => {
      const args = {mapId:"home",name:"home",seed:7,scale:"cottage-l" as const};
      const home = buildHouseInteriorPlan({...args,program:"dwelling"});
      expect(home.innerDoors).toEqual([]);
      const mask = floorMaskFromPlan(home);
      expect(mask[8 * home.width + 4] && mask[9 * home.width + 4]).toBe(true);
      expect(buildHouseInteriorPlan({...args,program:"inn"}).innerDoors!.length).toBeGreaterThan(0);
    });
  });
});

// pirate_isles 이야기 기물 2종(pi-note · pi-logbook-stand, 시트 1240~1242): 새 사본이 킷·참고문서를 갖고 칸 표가 선언(막힘·★·바닥 그림)과 같은지,
// 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 이식 칸이 있는 옛 사본은 test/themeBundleLocalTail.test.ts 가 본다.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/pirate-isles/pi_story.py → pi_bake.py, 목록 tiledata/pirate-isles/objects/spec.json).
describe("pirateIslesStoryObjects", () => {
  isolateTimers();
  type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][]; words: string[] };
  const ITEMS = spec.items as Item[];
  const kitId = (id: string) => `pi-${id}`;
  const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
  const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
  const FIRST = 1240;   // 이 묶음이 덧붙기 전 시트 끝

  describe("pirate_isles 이야기 기물", () => {
    it("새 사본은 2종 킷과 참고문서를 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸·바닥 그림)", () => {
      const ts = createPirateIslesTileset();
      const kits = own(ts.structureKits);
      expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => kitId(item.id)));
      let next = FIRST;
      for (const item of ITEMS) {
        const kit = kits.find((k) => k.id === kitId(item.id))!;
        expect([kit.width, kit.height]).toEqual([item.w, item.h]);
        expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
        expect(kit.ai?.tags).toEqual(expect.arrayContaining([...item.words, item.place]));
        kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
          expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 1240 부터
          const blocked = item.block.some(([bx, by]) => bx === x && by === y);
          expect(ts.passability[tile]!.up).toBe(!blocked);
          expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
        }));
      }
      expect(next).toBe(ts.count);
      expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "pi-props-objects"))).toBe(true);
    });

    it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
      const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
      const sheet = read("public/assets/pirate-isles/pirate-isles-chipset.png");
      const ts = createPirateIslesTileset();
      for (const item of ITEMS) {
        const piece = read(`tiledata/pirate-isles/objects/pieces/${item.src}`);
        expect([piece.width, piece.height]).toEqual([item.w * 16, item.h * 16]);
        const kit = own(ts.structureKits).find((k) => k.id === kitId(item.id))!;
        kit.rows.forEach((row, cy) => (row.upperTiles ?? []).forEach((tile, cx) => {
          const sx = (tile % ts.tilesPerRow) * 16, sy = Math.floor(tile / ts.tilesPerRow) * 16;
          for (let y = 0; y < 16; y += 1) {
            const a = ((sy + y) * sheet.width + sx) * 4, b = ((cy * 16 + y) * piece.width + cx * 16) * 4;
            expect(Buffer.compare(sheet.data.subarray(a, a + 64), piece.data.subarray(b, b + 64))).toBe(0);
          }
        }));
      }
    });

    it("게임이 바란 낱말이 그 킷을 첫째로 짚는다", () => {
      const project = createBlankProject() as Project;
      const ts = project.tilesets[PIRATE_ISLES_ID]!;
      for (const [id, words] of Object.entries(ask.items)) for (const word of words) expect([word, existingMatches(project, ts, word)[0]?.id]).toEqual([word, kitId(id)]);
    });

    it("실제 놓기 도구로 놓으면 막힌 칸만 막힌다", () => {
      const ctx = { project: createBlankProject() as Project, currentMapId: "dock", assistantRun: true };
      expect(runTool(ctx, "create_map", { id: "dock", name: "모래밭", width: 20, height: 15, tilesetId: PIRATE_ISLES_ID }).ok).toBe(true);
      const stamp = (id: string, x: number, y: number) => runTool(ctx, "stamp_tileset_object", { mapId: "dock", objectId: kitId(id), base: { x, y } }).ok;
      expect([stamp("logbook-stand", 3, 6), stamp("note", 8, 6)]).toEqual([true, true]);
      const walk = (x: number, y: number) => isPassable(ctx.project, ctx.project.maps.dock!, x, y);
      // 항해 일지 1×2 는 발밑(통)만 막히고 윗칸(책)은 사람 위에 그려지는 걸음 칸, 쪽지·지도 조각은 밟고 지나간다
      expect([walk(3, 6), walk(3, 5), walk(8, 6)]).toEqual([false, true, true]);
    });
  });
});

// 2026-09-27 배치 매칭 전수 조사의 회귀 못. 이름·재료와 다른 그림을 조용히 고르던 경로를 하나씩 막는다.
describe("placementMatchingAudit", () => {
  isolateTimers();
  const slot = (graphic: ReturnType<typeof resolveGraphic>) => ({
    sheet: graphic.sprite?.id,
    index: decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex,
  });
  describe("charset 검색은 낱말 하나만 맞는 칸을 고르지 않는다", () => {
    it("「고양이 석상」은 살아 있는 고양이가 아니다", () => {
      expect(pickNpcGraphic("고양이 석상")).toBeNull();
    });
    it("한 글자 질의는 다른 낱말 속 글자에 걸리지 않는다", () => {
      expect(pickNpcGraphic("용")?.label).not.toBe("청년 용사");
      expect(pickNpcGraphic("돌")?.label).not.toBe("동양풍 떠돌이 검객");
    });
    it("사물 이벤트 「큰 나무」는 나무 문 그림을 받지 않는다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const res = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_big_tree", name: "큰 나무", x: 2, y: 2, trigger: { kind: "action" }, commands: [{ kind: "text", body: "오래된 나무다." }] } });
      expect(res.ok, res.summary).toBe(true);
      const page = ctx.project.maps[ctx.project.startMapId]!.events.find((entry) => entry.id === "ev_big_tree")!.pages![0]!;
      expect(page.graphic.sprite?.id).not.toBe("tex_easyrpg_charset_object1");
    });
    it("「강철 문」은 나무 문이 아니다", () => {
      expect(pickNpcGraphic("강철 문")?.label ?? "").not.toMatch(/나무/u);
    });
    it("맵에 왕이 이미 있어도 「왕」은 여왕으로 바뀌지 않는다", () => {
      const king = pickNpcGraphic("왕")!;
      const again = pickNpcGraphic("왕", { avoidKeys: new Set([`${king.textureKey}#${king.characterIndex}`]) });
      expect(again?.label).toBe("왕");
    });
    it("textureKey 자리의 라벨은 칸까지 찾는다(보물상자 ≠ 나무 문)", () => {
      expect(slot(resolveGraphic({ textureKey: "보물 상자" }))).toEqual({ sheet: "tex_easyrpg_charset_object1", index: 6 });
    });
  });
  describe("못 찾은 그림은 거절한다", () => {
    it("place_trap graphic.query 미매칭은 주민 그림이 아니라 오류", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const res = runTool(ctx, "place_trap", { mapId: ctx.project.startMapId, at: { x: 3, y: 3 }, trigger: "touch", graphic: { query: "가시덫" } });
      expect(res.ok).toBe(false);
      expect(res.issues?.[0]?.code).toBe("graphic-not-found");
    });
    // object2#2 는 「원형 바닥 판」, object2#7 은 「광산 수레」다(원본 대조) — 금고 보관 상자는 실패 대신 빨간 상자(object1#6)로 선다.
    it("이름이 「철제 금고」인 보관 상자는 금고 칩이 없으면 빨간 상자로 선다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const res = runTool(ctx, "place_storage_chest", { mapId: ctx.project.startMapId, x: 4, y: 4, name: "철제 금고" });
      expect(res.ok, res.summary).toBe(true);
      const event = ctx.project.maps[ctx.project.startMapId]!.events.find((entry) => entry.name === "철제 금고" || entry.pages?.[0]?.name === "철제 금고");
      expect(slot(event!.pages![0]!.graphic)).toEqual({ sheet: "tex_easyrpg_charset_object1", index: 6 });
    });
  });
  describe("재료 이름은 수식어를 버리고 풀리지 않는다", () => {
    // 합본 마을은 2026-10-07 저작권 정리로 기본 타일셋에서 빠졌다 — 옛 저장본의 정의로 시험한다.
    const town = retiredEasyRpgTileset("easyrpg_chipset_combined_town");
    it("「황금 나무 상자」는 나무 상자로 자동 시공되지 않는다", () => {
      const hit = resolveMaterialByLabel(town, "황금 나무 상자", { preferGroup: true, preferRoles: ["prop", "terrain"] });
      expect(hit.status === "approved" && "tileId" in hit ? hit.tileId : undefined).not.toBe(237);
    });
    it("「우편함 없는 제단」은 우편함이 아니다", () => {
      const hit = resolveMaterialByLabel(town, "우편함 없는 제단", { preferGroup: true });
      expect(hit.status).toBe("missing");
    });
  });
  describe("타일 라벨은 그 시트의 그림을 말한다", () => {
    const tilesets = defaultTilesets();
    // 「표 없는 번들 시트(opengameart_castle)」·「숲마을(forest_harmony) 라벨 상속」 사례는 은퇴 — 두 시트가 2026-10-07 저작권 정리로 삭제됐다.
    it("tileMeta 에 설명 없는 칸이 있어도 타일 검색이 죽지 않는다", () => {
      for (const id of ["forest_harmony", "forest_harmony_snow", "atlas_biome_jungle"]) {
        expect(() => searchResources("tile", "나무", { tileset: tilesets[id] })).not.toThrow();
      }
    });
    it("던전 시트: 441~443 은 마법진, 444·445·474·475 는 계단, 446 은 석주, 447 은 왕좌, 118 은 수정", () => {
      const label = (index: number) => DUNGEON_TILE_SEMANTICS.find((entry) => entry.index === index)?.label ?? "";
      expect(label(441)).toMatch(/마법진/u);
      expect(label(27)).toMatch(/마법진/u);
      for (const stairs of [444, 445, 474, 475]) expect(label(stairs)).toMatch(/계단/u);
      expect(label(446)).toMatch(/기둥/u);
      expect(label(447)).toMatch(/왕좌/u);
      expect(label(118)).toMatch(/수정/u);
      expect(label(117)).toMatch(/레일/u);
    });
    // 배·레트로 외부/집 시트 라벨은 은퇴 — 그 시트들이 2026-10-07 저작권 정리로 삭제됐다. 옛 저장본이 들고 있는 월드·실내 정의만 남겨 본다.
    it("사용자 확정(2026-09-28): 옛 저장본 월드·실내 시트 라벨", () => {
      const at = (id: string, tile: number) => bundledTileSemantics(retiredEasyRpgTileset(id)).find((entry) => entry.index === tile)?.label ?? "";
      expect(at("easyrpg_chipset_retro_world", 444)).toMatch(/올라가는 계단/u);
      expect(at("easyrpg_chipset_retro_world", 475)).toMatch(/내려가는 계단/u);
      expect(at("easyrpg_chipset_world", 282)).toMatch(/바위/u);
      expect(at("easyrpg_chipset_interior", 357)).toMatch(/피아노 좌/u);
    });
  });
  describe("list_resources(kind:tile) 은 그 맵의 타일셋에서 찾는다", () => {
    it("숲마을 시작 맵이면 숲마을 타일셋을 본다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const res = runTool(ctx, "list_resources", { kind: "tile", query: "나무", mapId: ctx.project.startMapId });
      expect(res.ok, res.summary).toBe(true);
    });
  });
});

// test/pokemonChipsetPreset.test.ts
// 배치 5 — 포켓몬풍 칩셋 큐레이션 프리셋 계약 테스트.
// 고정하는 것: (1) 프리셋 role→group id 가 전부 실재하는 번들(bundled-default) 하네스 그룹을 가리키고
// isTrustedGroupSource 로 승인 취급된다 (2) 키큰 풀(DARK_GRASS)은 통행 가능한 별도 시맨틱이다
// (3) 신규 tall-grass 그룹으로 "잔디 맵 + 흙길 + 키큰풀 구역" 한 장면을 실제로 조립할 수 있다.
describe("pokemonChipsetPreset", () => {
  isolateTimers();
  const MAP_ID = "map_blank_start";
  function defaultTilesetOf(): TilesetDef {
    return withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
  }
  describe("포켓몬풍 오버월드 프리셋 — role 노출", () => {
    it("잔디·키큰풀·흙길·물·나무·꽃·마을건물 role 을 한국어 라벨과 함께 노출한다", () => {
      const roles = POKEMON_OVERWORLD_PRESET.roles.map((entry) => entry.role);
      expect(roles).toEqual([
        "grass_field",
        "tall_grass",
        "dirt_route",
        "water",
        "trees",
        "flowers",
        "village_buildings",
      ]);
      for (const entry of POKEMON_OVERWORLD_PRESET.roles) {
        expect(entry.label.length, entry.role).toBeGreaterThan(0);
        expect(entry.summary.length, entry.role).toBeGreaterThan(0);
        expect(entry.groupIds.length, entry.role).toBeGreaterThan(0);
        expect(entry.tools.length, entry.role).toBeGreaterThan(0);
      }
      // 한국어 라벨(사람이 읽는) 부여 확인.
      expect(pokemonPresetRole("tall_grass")?.label).toContain("키큰 풀");
      expect(pokemonPresetRoleLabels().find((r) => r.role === "grass_field")?.label).toBe("잔디 벌판");
      expect(POKEMON_OVERWORLD_PRESET.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
    });

    it("참조하는 group id 는 전부 실재하는 bundled-default 하네스 그룹이고 승인 취급된다", () => {
      const tileset = defaultTilesetOf();
      const byId = new Map((tileset.tileGroups ?? []).map((group) => [group.id, group]));
      for (const groupId of pokemonPresetGroupIds()) {
        const group = byId.get(groupId);
        expect(group, `그룹 미존재: ${groupId}`).toBeDefined();
        expect(group!.source, groupId).toBe("bundled-default");
        // 번들 그룹은 isTrustedGroupSource=true 라 시공 프리미티브가 soft-confirm 없이 소비한다.
        expect(isTrustedGroupSource(group!), groupId).toBe(true);
      }
    });

    it("키큰 풀 role 은 신규 tall-grass 그룹을, 마을건물 role 은 벽/지붕/문 그룹을 가리킨다", () => {
      expect(pokemonPresetRole("tall_grass")?.groupIds).toEqual([`${COMBINED_TOWN_HARNESS_PREFIX}tall-grass-autotile`]);
      const village = pokemonPresetRole("village_buildings");
      expect(village?.groupIds).toEqual(expect.arrayContaining([
        `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`,
        `${COMBINED_TOWN_HARNESS_PREFIX}roof-body`,
        `${COMBINED_TOWN_HARNESS_PREFIX}roof-overlays`,
        `${COMBINED_TOWN_HARNESS_PREFIX}doors`,
      ]));
      expect(village?.tools).toEqual(expect.arrayContaining(["build_wall", "build_roof", "place_door"]));
    });
  });
  describe("키큰 풀(DARK_GRASS) 시맨틱 — 통행 가능 유지", () => {
    it("describeChipsetTile 이 DARK_GRASS 대역을 tall_grass/통행가능/하위로 분류한다", () => {
      for (const index of CHIPSET_TILE_GROUPS.tallGrass) {
        const tile = describeChipsetTile(index);
        expect(tile.key, `tile ${index}`).toBe("tall_grass");
        expect(tile.usage, `tile ${index}`).toBe("terrain");
        expect(tile.passage, `tile ${index}`).toBe("passable"); // 인카운터는 별도 배선, 타일은 통행 가능.
        expect(tile.layer, `tile ${index}`).toBe("lower");
        expect(tile.terrainTag, `tile ${index}`).toBe(0); // NORMAL — 잔디와 동일.
        expect(tile.tags).toContain("encounter");
      }
      // 대표 DARK_GRASS 타일.
      expect(describeChipsetTile(TILE.DARK_GRASS).key).toBe("tall_grass");
    });

    it("검색 시맨틱에 키큰 풀/인카운터 태그가 통행 가능으로 등록된다", () => {
      const entry = COMBINED_TOWN_TILE_SEMANTICS.find((e) => e.index === TILE.DARK_GRASS);
      expect(entry).toBeDefined();
      expect(entry!.passage).toBe("passable");
      expect(entry!.label).toBe("키큰 풀");
      expect(entry!.tags).toEqual(expect.arrayContaining(["인카운터", "tall grass"]));
    });
  });
  describe("헤드리스 장면 조립 — 잔디 맵 + 흙길 + 키큰풀 구역", () => {
    it("프리셋 material 라벨로 fill_region 을 태워 잔디/흙길/키큰풀을 실제 배치한다", () => {
      // 프리셋은 합본 마을 칩셋용이다 — 그 칩셋 위의 시작 맵에 장면을 조립한다.
      const ctx: ToolContext = { project: startOnRetiredCombinedTown(createBlankProject()) };

      // 1) 잔디 벌판으로 맵 전체 바닥을 깐다.
      const grass = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 0, y: 0, w: 20, h: 15 }, material: "잔디" });
      expect(grass.ok, grass.summary).toBe(true);
      // 번들 시드라 목업 확인 대기(soft) 경고가 붙지 않는다.
      expect((grass.diff?.warnings ?? []).some((w) => w.includes("목업 확인 대기")), "grass").toBe(false);

      // 2) 가로 흙길 루트(3칸 폭 — 가운데 줄은 오토타일 바디).
      const dirt = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 0, y: 7, w: 20, h: 3 }, material: "흙길" });
      expect(dirt.ok, dirt.summary).toBe(true);

      // 3) 키큰 풀 구역(인카운터 풀숲).
      const tall = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 5, h: 3 }, material: "키큰 풀" });
      expect(tall.ok, tall.summary).toBe(true);
      expect((tall.diff?.warnings ?? []).some((w) => w.includes("목업 확인 대기")), "tall").toBe(false);

      const map = ctx.project.maps[MAP_ID];
      const at = (x: number, y: number) => map.lowerTiles[y * map.width + x];

      // Auto-connect selects the interior variant, not the palette's representative tile.
      expect(at(4, 3)).toBe(304);
      expect(CHIPSET_TILE_GROUPS.tallGrass).toContain(at(4, 3));
      expect(isPassable(ctx.project, map, 4, 3)).toBe(true);

      // 흙길 루트: 가운데 줄(내부 칸)은 오토타일 바디 타일.
      expect(CHIPSET_TILE_GROUPS.dirtRoadBody as readonly number[]).toContain(at(10, 8));

      // 잔디 벌판이 남은 곳: 기본 잔디.
      expect(at(18, 13)).toBe(TILE.GRASS);
    });
  });
});

// 폐기된 EasyRPG 계열 칩셋 차단(2026-10-06 사용자 결정 「대체품이 생기기 전까지 막고」 + 「등록 장소는 조수 추천 목록에」).
// 실행기(toolRunner.rejectRetiredEasyRpgMaps)는 조수 실행(ctx.assistantRun)에서만 새 맵·칩셋 변경을 막는다.
describe("retiredEasyRpgTilesets", () => {
  isolateTimers();
  const START = "map_blank_start";
  function assistant(project = createBlankProject()): ToolContext {
    return { project, currentMapId: START, assistantRun: true };
  }
  function createMap(ctx: ToolContext, tilesetId: string, id = "map_x") {
    return runTool(ctx, "create_map", { id, name: "새 맵", width: 20, height: 15, tilesetId }, { dryRun: false });
  }
  /**
   * 숲마을(forest_harmony) 정의를 아직 들고 있는 옛 저장본. 숲마을 그림·정의는 2026-10-07 저작권 정리로 지워 되살릴 원본이 없다 —
   * 숲마을은 합본 마을 재칠(family "easyrpg")이었으므로 합본 마을 정의를 그 id 로 들인다. 판정은 id 와 계보로만 한다.
   */
  function withOldForestVillage(project = createBlankProject()) {
    project.tilesets.forest_harmony = { ...retiredEasyRpgTileset(RETIRED_COMBINED_TOWN_TILESET_ID), id: "forest_harmony", name: "숲마을" };
    return project;
  }
  beforeEach(() => {
    resetMapEditHistory();
  });
  describe("폐기 판정", () => {
    it("EasyRPG 계보는 폐기, 손 도트 실내·버들항·월드맵은 아니다", () => {
      const project = createBlankProject();
      for (const id of ["forest_harmony", "forest_harmony_snow", "easyrpg_chipset_dungeon", "atlas_biome_dungeon", "tibo_interior_expanded", "oprn_dungeon_stone"]) {
        expect(isRetiredEasyRpgTileset(project, id), id).toBe(true);
      }
      for (const id of ["atlas_biome_interior", DEFAULT_TILESET_ID, "easyrpg_chipset_world", "atlas_biome_world", "joseon_baram"]) {
        expect(isRetiredEasyRpgTileset(project, id), id).toBe(false);
      }
    });
  });
  describe("조수 실행 차단", () => {
    it.each(["forest_harmony", "easyrpg_chipset_dungeon", "atlas_biome_dungeon"])("%s 로 새 맵 → 거부, 장소 가져오기 안내", (tilesetId) => {
      const ctx = assistant();
      const result = createMap(ctx, tilesetId);
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("retired-easyrpg-tileset");
      expect(result.issues?.[0]?.message).toContain("import_region_reference");
      expect(ctx.project.maps.map_x).toBeUndefined();
    });

    it("손 도트 실내·버들항 새 맵은 통과", () => {
      const ctx = assistant();
      expect(createMap(ctx, "atlas_biome_interior", "map_in").ok).toBe(true);
      expect(createMap(ctx, DEFAULT_TILESET_ID, "map_town").ok).toBe(true);
    });

    it("이미 숲마을 칩셋으로 깐 맵은 조수도 계속 고친다", () => {
      const human: ToolContext = { project: withOldForestVillage(), currentMapId: START };
      expect(createMap(human, "forest_harmony", "map_forest").ok).toBe(true);
      const ctx: ToolContext = { project: human.project, currentMapId: "map_forest", assistantRun: true };
      const result = runTool(ctx, "set_map_properties", { mapId: "map_forest", name: "옛 숲" }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.map_forest?.name).toBe("옛 숲");
    });

    it("조수 표시가 없는 실행(편집기 UI·스크립트)은 그대로", () => {
      const ctx: ToolContext = { project: withOldForestVillage(), currentMapId: START };
      expect(createMap(ctx, "forest_harmony").ok).toBe(true);
    });

    it("EasyRPG 생성기는 조수에게 숨기고 실행은 남긴다", () => {
      // run_dungeon_room_pipeline·start_dungeon_room_session 은 레지스트리에서 일부러 뺐다(#3641 이 그 호출 사례를 은퇴) — 남은 생성기만 본다.
      for (const name of ["generate_map"]) {
        const tool = getTool(name);
        expect(tool?.deprecated, name).toBe(true);
        expect(tool?.supersededBy, name).toBe("import_region_reference");
      }
    });
  });
  describe("기본 칩셋이 숲마을로 새지 않는다", () => {
    it("버들항 프로젝트에 실내 맵이 있어도 야외 기본은 버들항", () => {
      const ctx: ToolContext = { project: createBlankProject(), currentMapId: START };
      expect(createMap(ctx, "atlas_biome_interior", "map_in").ok).toBe(true);
      expect(defaultOutdoorTilesetId(ctx.project)).toBe(DEFAULT_TILESET_ID);
    });

    it("build_world 의 마을·던전·실내 자리는 모두 버들항", () => {
      const ctx = assistant();
      const result = runTool(ctx, "build_world", {
        plan: {
          nodes: [
            { mapId: "map_town", role: "town", label: "마을", width: 20, height: 16 },
            { mapId: "map_cave", role: "dungeon", label: "동굴", width: 20, height: 16 },
          ],
          edges: [{ from: { mapId: "map_town", exit: { side: "east" } }, to: { mapId: "map_cave", entry: { side: "west" } } }],
        },
      }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.map_town?.tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(ctx.project.maps.map_cave?.tilesetId).toBe(DEFAULT_TILESET_ID);
    });
  });
});

// 방 짓기 역할표 만들기(src/project/roomKit.ts) — 사용자가 고른 바닥·벽면·천장 칸으로 변형 칸과 사양을 만들고,
// 그 칩셋으로 ㄱ자 방이 지어지는가. 위키: openwiki/atlas-biome-interior.md 「역할표」.
describe("roomKit", () => {
  isolateTimers();
  const T = 16, COLS = 8, ROWS = 4;
  /** 칸마다 다른 단색 시트(칸 번호 = 빨강 값). */
  function sheet() {
    const data = new Uint8ClampedArray(COLS * T * ROWS * T * 4);
    for (let y = 0; y < ROWS * T; y++) for (let x = 0; x < COLS * T; x++) {
      const i = (y * COLS * T + x) * 4, id = Math.floor(y / T) * COLS + Math.floor(x / T);
      data[i] = id * 7; data[i + 1] = 120; data[i + 2] = 80; data[i + 3] = 255;
    }
    return { width: COLS * T, height: ROWS * T, data };
  }
  const picks: RoomKitPicks = { floor: [[0, 1], [8, 9]], wall: [[2, 3, 4], [10, 11, 12]], ceiling: 5 };
  const tileset = (): TilesetDef => ({
    id: "my_upload", name: "올린 칩셋", image: { type: "uploaded", id: "up_1" }, tileSize: T, tilesPerRow: COLS, count: COLS * ROWS,
    passability: Array.from({ length: COLS * ROWS }, () => ({ up: true, down: true, left: true, right: true })),
    priority: Array.from({ length: COLS * ROWS }, () => "lower" as const), terrain: Array.from({ length: COLS * ROWS }, () => 0),
  } as unknown as TilesetDef);
  describe("roomKit 역할표 만들기", () => {
    it("고른 칸 모양을 검사한다", () => {
      expect(roomKitPicksProblem(picks, 32)).toBeNull();
      expect(roomKitPicksProblem({ ...picks, wall: [[2, 3], [10]] }, 32)).toMatch(/같은 길이/);
      expect(roomKitPicksProblem({ ...picks, ceiling: 99 }, 32)).toMatch(/없는 칸/);
    });

    it("변형 칸 = 바닥 칸×그림자 4 + 벽면 칸×서쪽 2 + 천장 32 + 바깥 1", () => {
      const c = compileRoomKit(sheet(), T, picks);
      expect(c.roles.length).toBe(4 * 4 + 6 * 2 + 32 + 1);
      expect(c.sheet.width).toBe(16 * T);
      // 그림자 없는 바닥 칸은 고른 칸 그대로, 벽 밑 그늘 칸은 윗줄이 더 어둡다.
      expect(c.sheet.data[0]).toBe(0);
      const shaded = c.sheet.data.subarray(T * 4, T * 4 + 4); // 둘째 칸(그림자 1) 왼쪽 위 픽셀
      expect(shaded[1]).toBeLessThan(120);
    });

    it("설치하면 칩셋 끝 뒤 새 줄에 이식하고 사양이 그 칸을 가리킨다 — ㄱ자 방이 지어진다", () => {
      const c = compileRoomKit(sheet(), T, picks);
      const project = { tilesets: { my_upload: tileset() }, assets: { uploaded: {} as Record<string, unknown> } };
      const id = roomKitAssetId(T, "data:image/png;base64,AAAA");
      installRoomKit(project, "my_upload", c, { id, dataUrl: "data:image/png;base64,AAAA" }, picks);
      const ts = project.tilesets.my_upload;
      expect(project.assets.uploaded[id]).toBeTruthy();
      expect((project.assets.uploaded[id] as { generatedBy?: string }).generatedBy).toBeUndefined();
      expect(ts.tileGrafts![0]!.targetTile).toBe(32);
      expect(ts.count).toBe(32 + c.roles.length);
      expect(savedRoomKitPicks(ts)).toEqual(picks);
      const spec = roomSpecOf(ts) as HandInteriorSpec;
      const plan = ["##########", "#....#####", "#....#####", "#........#", "#........#", "####..####"];
      const layers = buildHandInteriorLayers({ plan, floor: "floor", wall: "wall" }, ts, spec);
      expect(layers.issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(layers.lowerTiles.every((t) => t >= 32 && t < ts.count)).toBe(true);
      expect(layers.unreachedFloor).toEqual([]);
    });

    it("변형 시트 id 로 칸 크기·줄 칸 수를 안다(스토어 사본 id 포함)", () => {
      expect(bundledChipsetTileSize("roomkit_32_abcd1234_x")).toBe(32);
      expect(bundledChipsetTilesPerRow("roomkit_32_abcd1234_x")).toBe(16);
      expect(bundledChipsetTileSize("store_my_pack__roomkit_48_abcd1234_x")).toBe(48);
    });

    it("픽셀 창 칸(RPG Maker 오토타일 가운데)도 읽는다", () => {
      const c = compileRoomKit(sheet(), T, { ...picks, ceiling: { px: 8, py: 8 } });
      // 천장 바깥 칸(마지막) = 칸 0·1·8·9 의 경계에 걸친 창 — 왼쪽 위 화소는 칸 0(빨강 0)
      const last = c.roles.length - 1, ox = (last % 16) * T, oy = Math.floor(last / 16) * T;
      expect(c.sheet.data[(oy * 16 * T + ox) * 4]).toBe(0);
      expect(c.sheet.data[(oy * 16 * T + ox + 15) * 4]).toBe(7);
      expect(roomKitPicksProblem({ ...picks, ceiling: { px: 120, py: 0 } }, 32, { width: 128, height: 64, tileSize: 16 })).toMatch(/없는 칸/);
    });

    it("RPG Maker A2·A4 시트를 칸 수로 알아보고 블록 가운데를 뗀다", () => {
      expect(rpgMakerAutotileSheet(16, 15)).toBe("A4");
      expect(rpgMakerAutotileSheet(16, 12)).toBe("A2");
      expect(rpgMakerAutotileSheet(8, 16)).toBeNull();
      expect(rpgMakerBlockPicks("A4", 3, 4, 48)).toEqual({ wallTop: { px: 2 * 48 + 24, py: 3 * 48 }, wallBottom: { px: 2 * 48 + 24, py: 4 * 48 } });
      expect(rpgMakerBlockPicks("A4", 5, 6, 48)).toEqual({ surface: { px: 4 * 48 + 24, py: 5 * 48 + 48 + 24 } });
      expect(rpgMakerBlockPicks("A2", 1, 2, 16)).toEqual({ surface: { px: 8, py: 16 + 8 } });
    });

    it("AI 초안 답(코드 울타리·뒷말 포함)을 고른 칸으로 바꾼다", () => {
      const text = '```json\n{"floor":{"col":1,"row":0,"w":2,"h":1},"wallTop":{"col":2,"row":1,"w":2},"wallBottom":{"col":2,"row":2,"w":2},"ceiling":{"col":5,"row":3},"reason":"a {brace} b"}\n``` 끝';
      const got = parseRoomKitDraft(text, COLS, ROWS);
      expect(typeof got).toBe("object");
      if (typeof got === "string") return;
      expect(got.picks).toEqual({ floor: [[1, 2]], wall: [[10, 11], [18, 19]], ceiling: 29 });
      expect(got.reason).toBe("a {brace} b");
      expect(parseRoomKitDraft('{"floor":{"col":99,"row":0}}', COLS, ROWS)).toMatch(/시트 밖|빠졌/);
    });

    it("조립 부품 → 방 짓기 가구(마법 학교: 벽난로 = 벽 가구, 침대 = 바닥 가구)", () => {
      const objs = kitHandObjects(createWizardingWorldTileset());
      expect(objs["wz-furn-fireplace"]).toMatchObject({ kind: "wall", w: 3, h: 2 });
      expect(objs["wz-dorm-bed-green"]).toMatchObject({ kind: "floor", w: 2, h: 3 });
      expect(objs["wz-castle-wall-n"]).toBeUndefined();
    });

    it("마법 학교 번들 역할표로 ㄱ자 방을 짓는다", () => {
      const ts = createWizardingWorldTileset();
      expect(ts.roomKit).toEqual({ builtin: "wizarding_world" });
      const spec = roomSpecOf(ts) as HandInteriorSpec;
      expect(spec).toBe(HAND_INTERIOR_SPECS.wizarding_world);
      const plan = ["##########", "#....#####", "#....#####", "#....#####", "#....#####", "#........#", "#........#", "#........#", "####..####"];
      const layers = buildHandInteriorLayers({ plan, floor: "castle-floor-flag", wall: "castle" }, ts, { ...spec, objects: kitHandObjects(ts) as never });
      expect(layers.issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(layers.lowerTiles.every((t) => t > 0 && t < ts.count)).toBe(true);
      expect(layers.unreachedFloor).toEqual([]);
    });

    it("줄 밀기 rowShift 는 jp ikit.lay_x 와 같은 값(murmur fmix32)", () => {
      const fd = { cols: 8, lay: "rowShift" };
      expect(Array.from({ length: 12 }, (_, y) => floorLayX(fd, 0, y))).toEqual([7, 6, 7, 5, 5, 0, 4, 3, 3, 0, 4, 3]);
      expect(floorLayX({ cols: 8 }, 5, 3)).toBe(5);
    });
  });
});
