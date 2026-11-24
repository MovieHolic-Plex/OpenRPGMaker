import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { databaseReferenceMessage, farmBuildingTypeReferenceMessage, homeDecorationTypeReferenceMessage } from "@/editor/databaseReferences";
import { applyMapDeletion, collectMapDeletionImpact } from "@/project/mapDeletion";
import { repairProjectReferences, collectProjectReferenceIssues, validateProjectReferences } from "@/project/io/references";
import { store } from "@/project/store";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project, Command, EventPage, GameEvent, HomeDecorationTypeRecord } from "@/project/types";
import { onlyEventPageCommandsChanged } from "@/ai/eventCommandScope";
import { checkSmallTaskScope, smallTaskScopeAllowsTool, type SmallTaskScope } from "@/ai/smallTaskScope";
import { normalizeEquipmentRecord, normalizeItemRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { discardEventDraft, projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { setLayerTileAt, setShadowAt } from "@/project/mapLayers";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { normalizeLifeSkillRecord } from "@/project/skillModel";
import { isolateTimers } from "./mergedTeardown";

describe("p2ReferenceLifecycle", () => {
  isolateTimers();
  describe("P2 reference repair and map deletion", () => {
    beforeEach(() => store.replace(p2LifeProject()));

    it("reports exact fishing/forage map impact and cascades only matching definitions", () => {
      // Break caught: deleting a map leaves invisible P2 definitions or removes unrelated areas.
      const project = p2LifeProject();
      const source = project.maps[project.startMapId]!;
      project.maps.map_delete = { ...structuredClone(source), id: "map_delete", name: "Delete me", events: [] };
      project.mapTree.children.push({ mapId: "map_delete", children: [] });
      project.system.fishing!.spots.push({
        id: "spot_delete", mapId: "map_delete", area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ fishId: "fish_trout", weight: 1 }],
      });
      project.system.seasonalForage!.areas.push({
        id: "area_delete", mapId: "map_delete", area: { x: 0, y: 0, w: 2, h: 2 }, dailySpawnCount: 1, maxActive: 1,
        despawnAfterDays: 1, entries: [{ id: "berry_delete", itemId: "item_berry", weight: 1 }],
      });

      expect(collectMapDeletionImpact(project, "map_delete")).toMatchObject({
        fishingSpotCount: 1,
        fishingSpotIds: ["spot_delete"],
        forageAreaCount: 1,
        forageAreaIds: ["area_delete"],
      });
      applyMapDeletion(project, "map_delete");
      expect(project.system.fishing?.spots.map((row) => row.id)).toEqual(["spot_pond"]);
      expect(project.system.seasonalForage?.areas.map((row) => row.id)).toEqual(["area_farm"]);
    });

    it("repairs dangling child references without weakening museum reward conditions", () => {
      // Break caught: load repair leaves dead catch/forage rows or changes an AND reward condition into an easier one.
      const project = p2LifeProject();
      project.database.fishSpecies![0]!.itemId = "missing_item";
      project.system.seasonalForage!.areas[0]!.entries.push({ id: "stale", itemId: "missing_item", weight: 1 });
      project.system.museum!.rewards.push({ id: "stale_reward", requiredItemIds: ["missing_item"], reward: { gold: 1 } });

      repairProjectReferences(project);
      expect(project.database.fishSpecies).toEqual([]);
      expect(project.system.fishing?.spots).toEqual([]);
      expect(project.system.seasonalForage?.areas[0]?.entries.map((row) => row.id)).toEqual(["berry"]);
      expect(project.system.museum?.rewards.map((row) => row.id)).toEqual(["museum_first"]);
    });

    it("blocks editor item deletion for every P2 authoring owner", () => {
      const project = store.getCurrent();
      project.system.sellPrices = [];
      project.system.shipping = { enabled: false, allowedItemIds: [] };
      store.replace(project);
      expect(databaseReferenceMessage("items", "item_trout")).toMatch(/물감|물고기|박물관/);

      project.database.fishSpecies = [];
      project.system.fishing = { enabled: false, spots: [] };
      project.system.museum = { enabled: false, eligibleItemIds: [], rewards: [] };
      store.replace(project);
      expect(databaseReferenceMessage("items", "item_berry")).toMatch(/채집|도감/);

      project.system.seasonalForage = { enabled: false, areas: [] };
      project.system.collections = { enabled: true, trackedItemIds: ["item_reward"] };
      store.replace(project);
      expect(databaseReferenceMessage("items", "item_reward")).toContain("수집 도감");
    });
  });
});

describe("p2SpatialReferenceIntegrity", () => {
  isolateTimers();
  afterEach(() => store.replace(createBlankProject()));
  describe("P2 spatial project reference integrity", () => {
    it("reports definition FKs, placement FKs, bounds, duplicates, and footprint collisions with exact paths", () => {
      // Break caught: shape-valid spatial rows can still point at deleted project records or overlap after authoring edits.
      const project = spatialReferenceProject();
      const itemId = project.database.items[0]!.id;
      project.database.farmBuildingTypes = [
        buildingType("shed", itemId),
        buildingType("shed", itemId),
        {
          ...buildingType("broken_shed", "missing_item"),
          allowedMapIds: ["missing_map"],
          levels: [{ ...buildingType("broken_shed", itemId).levels[0]!, graphicResourceId: "missing_resource" }],
        },
      ];
      project.database.homeDecorationTypes = [
        decorationType("table", itemId),
        decorationType("table", itemId),
        { ...decorationType("broken_table", "missing_item"), graphicResourceId: "missing_resource", allowedMapIds: ["missing_map"] },
      ];
      project.session.farmBuildingPlacements = [
        buildingPlacement(project, "shed_ok", "shed", 2, 2),
        buildingPlacement(project, "shed_ok", "shed", 6, 2),
        buildingPlacement(project, "shed_missing", "missing_type", 8, 2),
        { ...buildingPlacement(project, "shed_level", "shed", 8, 3), level: 2 },
        { ...buildingPlacement(project, "shed_map", "shed", 8, 4), mapId: "missing_map" },
        buildingPlacement(project, "shed_oob", "shed", project.maps[project.startMapId]!.width - 1, 5),
      ];
      project.session.homeDecorationPlacements = [
        decorationPlacement(project, "table_collision", "table", 2, 2),
        decorationPlacement(project, "table_missing", "missing_type", 8, 6),
        { ...decorationPlacement(project, "table_orientation", "table", 8, 7), orientation: "up" },
      ];

      const issues = collectProjectReferenceIssues(project);
      expect(issues).toEqual(expect.arrayContaining([
        "database.farmBuildingTypes[1].id duplicates database.farmBuildingTypes[0].id: shed",
        "database.farmBuildingTypes[2].levels[0].graphicResourceId does not exist: missing_resource",
        "database.farmBuildingTypes[2].allowedMapIds[0] does not exist: missing_map",
        "database.homeDecorationTypes[1].id duplicates database.homeDecorationTypes[0].id: table",
        "database.homeDecorationTypes[2].placementItemId does not exist: missing_item",
        "database.homeDecorationTypes[2].graphicResourceId does not exist: missing_resource",
        "database.homeDecorationTypes[2].allowedMapIds[0] does not exist: missing_map",
        "session.farmBuildingPlacements[1].instanceId duplicates session.farmBuildingPlacements[0].instanceId: shed_ok",
        "session.farmBuildingPlacements[2].typeId does not exist: missing_type",
        "session.farmBuildingPlacements[3].level does not exist on farmBuildingType shed: 2",
        "session.farmBuildingPlacements[4].mapId does not exist: missing_map",
        `session.farmBuildingPlacements[5].footprint is out of bounds for map ${project.startMapId}`,
        "session.homeDecorationPlacements[0].footprint overlaps another spatial placement",
        "session.homeDecorationPlacements[1].typeId does not exist: missing_type",
        "session.homeDecorationPlacements[2].orientation is not allowed by homeDecorationType table: up",
      ]));
      expect(() => validateProjectReferences(project)).toThrow(/database\.farmBuildingTypes\[1\]\.id/);
    });

    it("repairs invalid definitions and cascades their placements without inventing replacements", () => {
      // Break caught: repair retains orphaned layouts or silently substitutes another definition/item.
      const project = spatialReferenceProject();
      const itemId = project.database.items[0]!.id;
      project.database.farmBuildingTypes = [
        buildingType("shed", itemId),
        buildingType("shed", itemId),
        buildingType("broken", "missing_item"),
      ];
      project.database.homeDecorationTypes = [
        decorationType("table", itemId),
        decorationType("bad", "missing_item"),
      ];
      project.session.farmBuildingPlacements = [
        buildingPlacement(project, "keep_shed", "shed", 2, 2),
        buildingPlacement(project, "overlap_shed", "shed", 2, 2),
        buildingPlacement(project, "bad_shed", "broken", 6, 2),
      ];
      project.session.homeDecorationPlacements = [
        decorationPlacement(project, "overlap_table", "table", 2, 2),
        decorationPlacement(project, "keep_table", "table", 7, 2),
        decorationPlacement(project, "bad_table", "bad", 8, 2),
      ];

      repairProjectReferences(project);

      expect(project.database.farmBuildingTypes?.map((row) => row.id)).toEqual(["shed"]);
      expect(project.database.homeDecorationTypes?.map((row) => row.id)).toEqual(["table"]);
      expect(project.session.farmBuildingPlacements?.map((row) => row.instanceId)).toEqual(["keep_shed"]);
      expect(project.session.homeDecorationPlacements?.map((row) => row.instanceId)).toEqual(["keep_table"]);
      expect(() => validateProjectReferences(project)).not.toThrow();
    });

    it("includes authored spatial placements in map deletion impact and cascades only that map", () => {
      // Break caught: deleting a map leaves general structures/decor with dangling mapIds and no confirmation count.
      const project = spatialReferenceProject();
      const itemId = project.database.items[0]!.id;
      const target = addMap(project, "map_homestead");
      project.database.farmBuildingTypes = [{ ...buildingType("shed", itemId), allowedMapIds: [project.startMapId, target.id] }];
      project.database.homeDecorationTypes = [{ ...decorationType("table", itemId), allowedMapIds: [project.startMapId, target.id] }];
      project.session.farmBuildingPlacements = [
        buildingPlacementOn(target, "shed_target", "shed", 2, 2),
        buildingPlacement(project, "shed_keep", "shed", 2, 2),
      ];
      project.session.homeDecorationPlacements = [
        decorationPlacementOn(target, "table_target", "table", 6, 2),
        decorationPlacement(project, "table_keep", "table", 6, 2),
      ];

      const impact = collectMapDeletionImpact(project, target.id);
      expect(impact?.farmBuildingPlacementIds).toEqual(["shed_target"]);
      expect(impact?.farmBuildingPlacementCount).toBe(1);
      expect(impact?.homeDecorationPlacementIds).toEqual(["table_target"]);
      expect(impact?.homeDecorationPlacementCount).toBe(1);

      applyMapDeletion(project, target.id);
      expect(project.session.farmBuildingPlacements?.map((row) => row.instanceId)).toEqual(["shed_keep"]);
      expect(project.session.homeDecorationPlacements?.map((row) => row.instanceId)).toEqual(["table_keep"]);
      expect(project.database.farmBuildingTypes?.[0]?.allowedMapIds).toEqual([project.startMapId]);
      expect(project.database.homeDecorationTypes?.[0]?.allowedMapIds).toEqual([project.startMapId]);
      expect(() => validateProjectReferences(project)).not.toThrow();
    });

    it("guards item and definition deletion while authored spatial rows reference them", () => {
      // Break caught: structured spatial editor deletes an item/type and leaves an immediately dangling row.
      const project = spatialReferenceProject();
      const itemId = project.database.items[0]!.id;
      project.database.farmBuildingTypes = [buildingType("shed", itemId)];
      project.database.homeDecorationTypes = [decorationType("table", itemId)];
      project.session.farmBuildingPlacements = [buildingPlacement(project, "shed_1", "shed", 2, 2)];
      project.session.homeDecorationPlacements = [decorationPlacement(project, "table_1", "table", 6, 2)];
      store.replace(project);

      expect(databaseReferenceMessage("items", itemId)).toMatch(/건물|장식/);
      expect(farmBuildingTypeReferenceMessage("shed")).toMatch(/shed_1/);
      expect(homeDecorationTypeReferenceMessage("table")).toMatch(/table_1/);
    });
  });
  function spatialReferenceProject(): Project { return createBlankProject(); }
  function buildingType(id: string, itemId: string) {
    return {
      id,
      name: id,
      levels: [{
        level: 1,
        footprint: { width: 2, height: 2 },
        capacity: 4,
        cost: { items: [{ itemId, count: 1 }] },
        graphicResourceId: "easyrpg-picture-cloud",
      }],
    };
  }
  function decorationType(id: string, itemId: string) {
    return {
      id,
      name: id,
      placementItemId: itemId,
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
      allowedOrientations: ["down", "left"] as const,
      graphicResourceId: "easyrpg-picture-cloud",
    };
  }
  function buildingPlacement(project: Project, instanceId: string, typeId: string, x: number, y: number) {
    return buildingPlacementOn(project.maps[project.startMapId]!, instanceId, typeId, x, y);
  }
  function buildingPlacementOn(map: GameMap, instanceId: string, typeId: string, x: number, y: number) {
    return { instanceId, typeId, level: 1, mapId: map.id, x, y, orientation: "down" as const };
  }
  function decorationPlacement(project: Project, instanceId: string, typeId: string, x: number, y: number) {
    return decorationPlacementOn(project.maps[project.startMapId]!, instanceId, typeId, x, y);
  }
  function decorationPlacementOn(map: GameMap, instanceId: string, typeId: string, x: number, y: number) {
    return { instanceId, typeId, mapId: map.id, x, y, orientation: "down" as const };
  }
  function addMap(project: Project, id: string): GameMap {
    const map = structuredClone(project.maps[project.startMapId]!);
    map.id = id;
    map.name = id;
    map.events = [];
    project.maps[id] = map;
    project.mapTree.children.push({ mapId: id, children: [] });
    return map;
  }
});

describe("smallTaskScope", () => {
  isolateTimers();
  const town = "town";
  const chest = "chest";
  const pageId = "greeting";
  const dialogue = { kind: "dialogue", mapId: town, eventId: chest, pageId } as const;
  const eventPage = { ...dialogue, kind: "eventPage" } as const;
  const tile = { kind: "tileEvent", mapId: town, x: 1, y: 1, eventId: chest } as const;
  const emptyTile = { ...tile, x: 2, eventId: null } as const;
  const item = { kind: "dbEntries", entries: [{ collection: "items", id: "potion" }] } as const;
  const createItem = { ...item, create: { collection: "items", max: 1 } } as const;
  function potion(id: string, name: string) {
    return normalizeItemRecord({ id, name, price: 20 });
  }
  function event(id: string, name: string, x: number): GameEvent {
    return { id, name, x, y: 1, trigger: { kind: "action" }, commands: [] };
  }
  const seed = createBlankProject();
  const firstMap = seed.maps[seed.startMapId]!;
  const greeting: EventPage = {
    id: pageId, name: "첫 만남", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [
      { kind: "text", body: "어서 오세요.", speaker: "문지기" },
      { kind: "text", body: "오래 기다렸습니다.", speaker: "문지기" },
      { kind: "wait", ms: 120 },
      { kind: "setSelfSwitch", key: "A", value: true },
      { kind: "choices", options: [
        { text: "연다", branch: [{ kind: "text", body: "열었다." }, { kind: "wait", ms: 10 }] },
        { text: "둔다", branch: [] },
      ], cancelBranch: [] },
    ],
  };
  const base: Project = {
    ...seed, tilesets: {}, startMapId: town,
    database: { ...seed.database, items: [potion("potion", "회복약"), potion("ether", "마력약")] },
    maps: {
      [town]: {
        ...firstMap, id: town, name: "마을", width: 3, height: 3, lowerTiles: Array(9).fill(0), upperTiles: Array(9).fill(-1),
        events: [{ ...event(chest, "보물상자", 1), pages: [greeting] }, event("gate", "문지기", 0)],
      },
      woods: { ...firstMap, id: "woods", name: "숲", events: [] },
    },
  };
  const target = (p: Project) => p.maps[town]!.events[0]!;
  const page = (p: Project) => target(p).pages![0]!;
  function verify(scope: SmallTaskScope, mutate: (after: Project) => void, fixture = base) {
    const before = structuredClone(fixture);
    const after = structuredClone(before);
    mutate(after);
    const result = checkSmallTaskScope(before, after, scope);
    expect(before).toEqual(fixture);
    return result;
  }
  function rejects(scope: SmallTaskScope, mutate: (after: Project) => void, label: string, fixture = base) {
    const result = verify(scope, mutate, fixture);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("범위 검사가 변경을 통과시켰습니다.");
    expect(result.reason).toMatch(/^[가-힣]/u);
    expect(result.reason).toMatch(/\n범위 밖: /u);
    expect(result.reason).toContain(label);
    expect(result.reason).not.toMatch(/[{}]|"(mapId|commands|database)"\s*:/u);
    expect(result.violations.some(({ what }) => what.includes(label))).toBe(true);
  }
  describe("작은 일 범위 검사", () => {
    it("대사를 끼우고 지우고 고치며 선택지 문구와 분기 안 대사도 바꾼다", () => {
      expect(verify(dialogue, p => {
        const commands = page(p).commands;
        commands[0] = { ...commands[0], body: "안녕하세요." } as typeof commands[number];
        commands.splice(1, 1);
        commands.splice(3, 0, { kind: "text", body: "여기는 마을입니다." });
        const choices = commands[4];
        if (choices?.kind !== "choices") throw new Error("선택지 누락");
        choices.options[0]!.text = "상자를 연다";
        choices.options[0]!.branch.splice(0, 1, { kind: "text", body: "상자 뚜껑이 열렸다." });
        choices.cancelBranch!.push({ kind: "text", body: "마음을 바꿨다." });
      })).toEqual({ ok: true });
      expect(verify(dialogue, p => { page(p).commands.splice(0, 1); })).toEqual({ ok: true });
      expect(verify(dialogue, p => { page(p).commands.unshift({ kind: "text", speaker: "주인공", body: "잠깐만요." }); })).toEqual({ ok: true });
    });

    it("그대로인 대사를 사이에 둔 삭제와 추가를 구분한다", () => {
      expect(verify(dialogue, p => {
        const commands = page(p).commands;
        commands.splice(0, 1);
        commands.splice(1, 0, { kind: "text", speaker: "상인", body: "이쪽으로 오세요." });
      })).toEqual({ ok: true });
    });

    it("그대로인 대사 뒤에 한 줄을 추가해도 그 앞의 화자 변경을 막는다", () => {
      rejects(dialogue, p => {
        const commands = page(p).commands;
        commands[0] = { kind: "text", speaker: "상인", body: "오늘도 장사합니다." };
        commands.splice(2, 0, { kind: "text", speaker: "문지기", body: "안으로 들어오세요." });
      }, "『첫 만남』");
    });

    it("대사 외 명령의 값과 순서, 화자·얼굴, 선택지 수·조건과 페이지 설정을 지킨다", () => {
      rejects(dialogue, p => { page(p).commands.splice(2, 2, greeting.commands[3]!, greeting.commands[2]!); }, "『보물상자』");
      rejects(dialogue, p => { page(p).commands[2] = { kind: "wait", ms: 50 }; }, "『첫 만남』");
      rejects(dialogue, p => { (page(p).commands[0] as Extract<EventPage["commands"][number], { kind: "text" }>).speaker = "다른 사람"; }, "『첫 만남』");
      rejects(dialogue, p => { Object.assign(page(p).commands[0]!, { listenerBust: "다른 얼굴" }); }, "『첫 만남』");
      rejects(dialogue, p => { const command = page(p).commands[4]; if (command?.kind === "choices") command.options.pop(); }, "『첫 만남』");
      rejects(dialogue, p => { const command = page(p).commands[4]; if (command?.kind === "choices") command.options[0]!.branch.pop(); }, "『첫 만남』");
      rejects(dialogue, p => { const command = page(p).commands[4]; if (command?.kind === "choices") command.options[1]!.showWhen = { kind: "gold", op: ">=", amount: 1 }; }, "『첫 만남』");
      rejects(dialogue, p => { page(p).trigger = { kind: "auto" }; }, "『보물상자』 이벤트");
    });

    it("보물상자의 두 번째 페이지와 셀프 스위치, 대상 칸의 층을 함께 변경한다", () => {
      expect(verify(tile, p => {
        target(p).pages!.push({
          ...greeting, id: "opened", name: "열린 상자", conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [],
        });
        p.session.selfSwitches = { [chest]: { A: true } };
        setLayerTileAt(p.maps[town]!, 1, 4, 3);
        setLayerTileAt(p.maps[town]!, 2, 4, 7);
        setLayerTileAt(p.maps[town]!, 4, 4, 9);
        setShadowAt(p.maps[town]!, 4, 1);
        p.maps[town]!.upperTileStacks = { 4: [1, 2] };
      })).toEqual({ ok: true });
      const before = structuredClone(base);
      setLayerTileAt(before.maps[town]!, 2, 4, 7);
      setShadowAt(before.maps[town]!, 4, 1);
      before.session.selfSwitches = { [chest]: { A: true } };
      expect(checkSmallTaskScope(before, base, tile)).toEqual({ ok: true });
    });

    it("대상 이벤트를 삭제할 때 그 이벤트의 셀프 스위치도 지울 수 있다", () => {
      const before = structuredClone(base);
      before.session.selfSwitches = { [chest]: { A: true } };
      const after = structuredClone(before);
      after.maps[town]!.events.shift();
      delete after.session.selfSwitches;
      expect(checkSmallTaskScope(before, after, tile)).toEqual({ ok: true });
      after.maps[town]!.events.push(event("new", "다른 상자", 1));
      expect(checkSmallTaskScope(before, after, tile)).toMatchObject({ ok: false });
    });

    it("빈 대상에서는 새 이벤트 하나 또는 타일만 허용한다", () => {
      expect(verify(emptyTile, p => { p.maps[town]!.events.unshift(event("new", "표지판", 2)); })).toEqual({ ok: true });
      expect(verify(emptyTile, p => { setLayerTileAt(p.maps[town]!, 3, 5, 2); })).toEqual({ ok: true });
      rejects(emptyTile, p => { p.maps[town]!.events.push(event("new1", "표지판", 2), event("new2", "회복소", 2)); }, "『회복소』 이벤트");
      rejects(emptyTile, p => { p.maps[town]!.events.push(event("new", "표지판", 0)); }, "『표지판』 이벤트");
    });

    it("다른 이벤트·칸·맵과 자료집 변경을 차단하고 대상 이벤트의 위치를 지킨다", () => {
      rejects(tile, p => { p.maps[town]!.events[1]!.name = "장사꾼"; }, "『마을』 맵의 『문지기』 이벤트");
      rejects(tile, p => { setLayerTileAt(p.maps[town]!, 2, 5, 4); }, "『마을』 맵의 타일");
      rejects(tile, p => { p.maps[town]!.name = "북쪽 마을"; }, "『마을』 맵의 속성");
      rejects(tile, p => { p.maps.woods!.name = "북쪽 숲"; }, "『숲』 맵의 속성");
      rejects(tile, p => { p.database.items[0]!.price++; }, "아이템 『회복약』");
      rejects(tile, p => { target(p).x = 2; }, "『보물상자』 이벤트");
      rejects(tile, p => { p.session.selfSwitches = { gate: { B: true } }; }, "『문지기』 이벤트의 셀프 스위치");
      rejects(tile, p => { p.maps[town]!.events.reverse(); }, "이벤트 목록의 순서");
    });

    it("선택된 아이템 가격과 한도 내 새 아이템을 허용한다", () => {
      expect(verify(item, p => { p.database.items[0]!.price = 75; })).toEqual({ ok: true });
      expect(verify(createItem, p => { p.database.items[0]!.price = 75; p.database.items.unshift(potion("mega", "특효약")); })).toEqual({ ok: true });
    });

    it("선택한 자료 행의 동작별 필드만 허용하고 삭제 중에는 행 편집도 막는다", () => {
      const price = { ...item, entries: [{ ...item.entries[0]!, fields: ["price"] }] } as const;
      expect(verify(price, p => { p.database.items[0]!.price = 42; })).toEqual({ ok: true });
      rejects(price, p => { p.database.items[0]!.name = "새 이름"; }, "회복약");
      const remove = { kind: "dbRemove", collection: "items", id: "potion" } as const;
      expect(verify(remove, p => { p.database.items.shift(); })).toEqual({ ok: true });
      rejects(remove, p => { p.database.items[0]!.price = 42; }, "회복약");
      rejects(remove, p => { p.database.items.splice(0, 1, potion("new", "새 약")); }, "새 약");
    });

    it("새 장비 칸에 허용된 ID와 수를 각각 검사한다", () => {
      const scope = { kind: "dbEntries", entries: [], create: { collection: "equipmentSlots", max: 1, ids: ["weapon"] } } as const;
      const before = structuredClone(base);
      delete before.database.equipmentSlots;
      const save = (id: string) => ({ ...before, database: { ...before.database, equipmentSlots: [{ id, label: "무기 칸" }] } });
      expect(checkSmallTaskScope(before, save("weapon"), scope)).toEqual({ ok: true });
      expect(checkSmallTaskScope(before, save("armor"), scope)).toMatchObject({ ok: false, reason: expect.stringContaining("무기 칸") });
    });

    it.each(["명령", "스크립트", "저장된 원본"])("열린 이벤트의 중첩 %s가 쓰는 자료 행 삭제를 거절한다", source => {
      const live = structuredClone(base);
      const selected = target(live);
      const original = structuredClone(selected);
      const reference: Command = source === "스크립트"
        ? { kind: "script", source: "game.addItem('potion', 1);", compiled: "" }
        : { kind: "changeItem", itemId: "potion", op: "+=", amount: 1 };
      const branch: Command = { kind: "loop", body: [reference] };
      if (source === "저장된 원본") original.pages![0]!.commands.push(branch);
      else selected.pages![0]!.commands.push(branch);
      selected.draft = { kind: "edit", original };
      const before = projectViewWithoutEventDrafts(live);
      const after = { ...before, database: { ...before.database, items: before.database.items.slice(1) } };
      expect(checkSmallTaskScope(before, after, { kind: "dbRemove", collection: "items", id: "potion" }, live))
        .toMatchObject({ ok: false, reason: expect.stringContaining("삭제할 수 없습니다") });
    });

    it("직업에 완전히 복사된 전투 명령은 남겨 두고 카탈로그 행을 삭제한다", () => {
      const before = structuredClone(base);
      const catalog = { id: "catalog_skill", name: "특수 기술", kind: "skill", skillId: before.database.skills[0]!.id } as const;
      before.database.battleCommands = [catalog];
      before.database.classes[0]!.battleCommands = [{ ...catalog }];
      const remove = { kind: "dbRemove", collection: "battleCommands", id: catalog.id } as const;
      const after = { ...before, database: { ...before.database, battleCommands: [] } };
      expect(checkSmallTaskScope(before, after, remove)).toEqual({ ok: true });
      delete before.database.classes[0]!.battleCommands[0]!.skillId;
      expect(checkSmallTaskScope(before, after, remove)).toMatchObject({
        ok: false, reason: expect.stringContaining("삭제할 수 없습니다"),
      });
    });

    it("아이템을 가리키는 명령은 같은 ID가 붙은 상태의 삭제를 막지 않는다", () => {
      const before = structuredClone(base);
      before.database.states.push(normalizeStateRecord({ id: "potion", name: "독" }));
      page(before).commands.push({ kind: "changeItem", itemId: "potion", op: "+=", amount: 1 });
      const deleteState = { kind: "dbRemove", collection: "states", id: "potion" } as const;
      const deleteItem = { kind: "dbRemove", collection: "items", id: "potion" } as const;
      expect(verify(deleteState, p => { p.database.states.pop(); }, before)).toEqual({ ok: true });
      expect(verify(deleteItem, p => { p.database.items.shift(); }, before))
        .toMatchObject({ ok: false, reason: expect.stringContaining("삭제할 수 없습니다") });
    });

    it("소지품 명령의 itemId가 가리키는 장비의 삭제를 막는다", () => {
      const before = structuredClone(base);
      const id = "event-reward-sword";
      before.database.equipment.push(normalizeEquipmentRecord({ id, name: "보상 검" }));
      page(before).commands.push({ kind: "changeItem", itemId: id, op: "+=", amount: 1 });
      expect(verify({ kind: "dbRemove", collection: "equipment", id }, p => { p.database.equipment.pop(); }, before))
        .toMatchObject({ ok: false, reason: expect.stringContaining("삭제할 수 없습니다") });
    });

    it("생활 경험치 명령의 skillId가 가리키는 생활 스킬의 삭제를 막는다", () => {
      const before = structuredClone(base);
      const id = "event-cooking";
      before.database.lifeSkills = [normalizeLifeSkillRecord({ id, name: "요리" })];
      page(before).commands.push({ kind: "changeLifeSkillExp", skillId: id, op: "+=", amount: 1 });
      expect(verify({ kind: "dbRemove", collection: "lifeSkills", id }, p => { p.database.lifeSkills = []; }, before))
        .toMatchObject({ ok: false, reason: expect.stringContaining("삭제할 수 없습니다") });
    });

    it("스크립트 주석 속 ID는 건너뛰고 실행 코드에 있는 ID는 보호한다", () => {
      const before = structuredClone(base);
      const script = { kind: "script", source: '// game.addItem("potion", 1)', compiled: '/* "potion" */' } as const;
      page(before).commands.push(script);
      const remove = { kind: "dbRemove", collection: "items", id: "potion" } as const;
      const deleteItem = (project: Project) => { project.database.items.shift(); };
      expect(verify(remove, deleteItem, before)).toEqual({ ok: true });
      page(before).commands.push({ ...script, compiled: 'game.addItem("potion", 1);' });
      expect(verify(remove, deleteItem, before)).toMatchObject({ ok: false, reason: expect.stringContaining("삭제할 수 없습니다") });
    });

    it("취소할 수 있는 새 이벤트에 의뢰 등록을 막고, 저장된 이벤트에는 등록할 수 있다", () => {
      const live = structuredClone(base);
      const original = event("new-giver", "의뢰인", 2);
      live.maps[town]!.events.push({ ...original, draft: { kind: "new", original } });
      const before = { ...live, maps: { ...live.maps, [town]: {
        ...live.maps[town]!, events: [...base.maps[town]!.events, original],
      } } };
      const after: Project = { ...before, quests: [{
        key: "new_quest", title: "의뢰", summary: "부탁", giver: { mapId: town, eventId: original.id }, steps: [],
      }] };
      const scope = { kind: "projectArea", area: "quests", create: 1 } as const;
      expect(checkSmallTaskScope(before, after, scope, live))
        .toMatchObject({ ok: false, reason: expect.stringContaining("이벤트를 먼저 저장") });
      discardEventDraft(live, town, original.id);
      expect(live.maps[town]!.events.some(row => row.id === original.id)).toBe(false);
      expect(live.quests).toEqual(base.quests);
      live.maps[town]!.events.push(original);
      const committed = projectViewWithoutEventDrafts(live);
      expect(checkSmallTaskScope(committed, { ...committed, quests: after.quests }, scope, live)).toEqual({ ok: true });
    });

    it("다른 자료집 항목, 초과 생성, 삭제, 중복 ID와 이벤트 변경을 차단한다", () => {
      rejects(item, p => { p.database.items[1]!.price++; }, "아이템 『마력약』");
      rejects(item, p => { p.database.items.splice(0, 1); }, "아이템 『회복약』");
      rejects(createItem, p => { p.database.items.push(potion("mega", "특효약"), potion("max", "만병통치약")); }, "아이템 『만병통치약』");
      rejects(createItem, p => { p.database.items.push(potion("potion", "중복 약")); }, "아이템 목록");
      rejects(createItem, p => { p.database.items.reverse(); }, "아이템 목록의 순서");
      rejects(item, p => { page(p).commands = []; }, "『보물상자』 이벤트");
      rejects(item, p => { p.database.items[0]!.skillId = "missing-skill"; }, "아이템 『회복약』의 참조");
    });

    it.each([
      { target: "스위치", field: "switchId" },
      { target: "제작법", field: "recipeId" },
    ])("생활 스킬 보상에서 없는 $target 참조를 막고 유효한 보상을 허용한다", ({ field }) => {
      const before = structuredClone(base);
      const skill = { id: "farming", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [] } as const;
      const scope = { kind: "dbEntries", entries: [{ collection: "lifeSkills", id: skill.id }] } as const;
      const recipeId = "brew-potion";
      const switchId = before.switches[0]!.id;
      before.database.lifeSkills = [skill];
      before.system.craftRecipes = [{ id: recipeId, ingredients: [], outputItemId: "potion" }];

      expect(verify(scope, p => {
        p.database.lifeSkills = [{ ...skill, levelUpRewards: [{ level: 2, switchId, recipeId }] }];
      }, before)).toEqual({ ok: true });

      const setBrokenReward = (p: Project) => {
        p.database.lifeSkills = [{ ...skill, levelUpRewards: [{ level: 2, switchId, recipeId, [field]: "missing-reward" }] }];
      };
      const after = structuredClone(before);
      setBrokenReward(after);
      expect(collectProjectReferenceIssues(after)).toContain(`lifeSkill farming: reward ${field} does not exist: missing-reward`);
      rejects(scope, setBrokenReward, "생활 스킬 『농사』의 참조", before);
    });

    it("배치가 사용 중인 농장 건물 레벨의 삭제를 막고 이름 변경을 허용한다", () => {
      const before = createBlankProject();
      const level = { level: 1, name: "기본", footprint: { width: 2, height: 2 }, capacity: 8, graphicResourceId: "easyrpg-picture-cloud" };
      const upgraded = { ...level, level: 2, name: "확장" };
      const building = { id: "shed", name: "작업 창고", levels: [level, upgraded] };
      const scope = { kind: "dbEntries", entries: [{ collection: "farmBuildingTypes", id: building.id }] } as const;
      before.database.farmBuildingTypes = [building];
      before.session.farmBuildingPlacements = [{
        instanceId: "shed_1", typeId: building.id, level: 2, mapId: before.startMapId, x: 2, y: 2, orientation: "down",
      }];
      const withLevels = (levels: typeof building.levels): Project => ({
        ...before,
        database: { ...before.database, farmBuildingTypes: [{ ...building, levels }] },
      });

      expect(collectProjectReferenceIssues(before).filter(issue => issue.includes("farmBuilding"))).toEqual([]);
      const renamed = withLevels([level, { ...upgraded, name: "넓은 창고" }]);
      expect(checkSmallTaskScope(before, renamed, scope)).toEqual({ ok: true });

      const after = withLevels([level]);
      expect(collectProjectReferenceIssues(after)).toContain("session.farmBuildingPlacements[0].level does not exist on farmBuildingType shed: 2");
      expect(checkSmallTaskScope(before, after, scope)).toMatchObject({
        ok: false, violations: [{ what: "자료집 농장 건물 『작업 창고』의 참조" }],
      });
    });

    it("배치가 사용 중인 장식 방향을 자료집에서 제거하면 막는다", () => {
      const before = createBlankProject();
      const decoration: HomeDecorationTypeRecord = {
        id: "table", name: "나무 탁자", placementItemId: before.database.items[0]!.id,
        footprint: { width: 1, height: 1 }, blocksMovement: true,
        allowedOrientations: ["down", "left"], graphicResourceId: "easyrpg-picture-cloud",
      };
      const scope = { kind: "dbEntries", entries: [{ collection: "homeDecorationTypes", id: decoration.id }] } as const;
      before.database.homeDecorationTypes = [decoration];
      before.session.homeDecorationPlacements = [{
        instanceId: "table_1", typeId: decoration.id, mapId: before.startMapId, x: 2, y: 2, orientation: "left",
      }];

      const after: Project = {
        ...before,
        database: { ...before.database, homeDecorationTypes: [{ ...decoration, allowedOrientations: ["down"] }] },
      };
      expect(collectProjectReferenceIssues(before).filter(issue => issue.includes("homeDecoration"))).toEqual([]);
      expect(checkSmallTaskScope(before, after, scope)).toMatchObject({
        ok: false, violations: [{ what: expect.stringContaining("『나무 탁자』의 참조") }],
      });
    });

    it("키 정렬과 관계없이 같게 판정하고 기존 이벤트 페이지 가드가 명령만 허용한다", () => {
      const after = structuredClone(base);
      after.maps = { woods: after.maps.woods!, town: after.maps.town! };
      page(after).commands[0] = { body: "어서 오세요.", speaker: "문지기", kind: "text" };
      expect(checkSmallTaskScope(base, after, dialogue)).toEqual({ ok: true });
      page(after).commands = [{ kind: "wait", ms: 50 }];
      expect(onlyEventPageCommandsChanged(base, after, eventPage)).toBe(true);
      page(after).conditions = [{ kind: "selfSwitch", key: "A", value: true }];
      expect(onlyEventPageCommandsChanged(base, after, eventPage)).toBe(false);
      expect(onlyEventPageCommandsChanged(base, base, { ...eventPage, pageId: "unknown" })).toBe(false);
      rejects(eventPage, p => { p.maps[town]!.events[1]!.x = 2; }, "『문지기』 이벤트");
    });

    it("대사 스코프의 쓰기는 명령 한 줄과 대사 고치기로 한정한다", () => {
      for (const name of ["get_event", "list_dialogue", "lint_dialogue", "rewrite_dialogue", "insert_event_command", "update_event_command", "delete_event_command"]) {
        expect(smallTaskScopeAllowsTool(dialogue, name), name).toBe(true);
      }
      for (const name of ["patch_event_page", "event_command_assist", "upsert_event", "upsert_item", "invented_tool"]) {
        expect(smallTaskScopeAllowsTool(dialogue, name), name).toBe(false);
      }
    });
  });
  describe("선택 영역, 맵 속성, 새 맵과 프로젝트 항목 범위", () => {
    const region = { kind: "mapRegion", mapId: town, rect: { x: 1, y: 0, w: 2, h: 2 } } as const;
    const meta = { kind: "mapMeta", mapId: town } as const;
    const newMap = { kind: "newMap", max: 1, sourceMapId: town } as const;
    const link = (from: string, to: string) => ({
      id: "path", from: { mapId: from, x: 0, y: 0 }, to: { mapId: to, x: 0, y: 0 }, playerEnabled: true, npcEnabled: false,
    });

    it("맵 속성 범위에서 월드맵 재생성 원본을 보호한다", () => {
      const before = structuredClone(base);
      before.maps[town]!.worldmapSource = { theme: "archipelago", ops: [] };
      for (const scope of [meta, { ...meta, fields: ["worldmapSource"] }] as const) {
        rejects(scope, p => { p.maps[town]!.worldmapSource!.ops.push({ kind: "test" }); }, "속성", before);
        rejects(scope, p => { delete p.maps[town]!.worldmapSource; }, "속성", before);
        rejects(scope, p => { p.maps[town]!.worldmapSource = { theme: "archipelago", ops: [] }; }, "속성");
      }
    });

    it("선택한 영역에서만 여러 층, 그림자와 타일 더미를 바꾼다", () => {
      expect(verify(region, p => {
        const map = p.maps[town]!;
        setLayerTileAt(map, 1, 1, 3);
        setLayerTileAt(map, 2, 4, 7);
        setLayerTileAt(map, 3, 5, 8);
        setLayerTileAt(map, 4, 2, 9);
        setShadowAt(map, 4, 1);
        map.upperTileStacks = { 2: [1, 2] };
      })).toEqual({ ok: true });
      rejects(region, p => { p.maps[town]!.lowerTiles[3] = 3; }, "선택 영역 바깥 타일");
      rejects(region, p => { p.maps[town]!.upperTileStacks = { 7: [1] }; }, "타일 더미");
      rejects(region, p => { p.maps[town]!.upperTiles.push(-1); }, "타일 층 크기");
      rejects(region, p => { target(p).name = "다른 상자"; }, "보물상자");
      rejects(region, p => { p.maps[town]!.name = "다른 마을"; }, "속성");
      rejects(region, p => { p.maps.woods!.upperTiles[0] = 5; }, "숲");
      rejects({ ...region, rect: { x: 1, y: 1, w: 3, h: 1 } }, () => {}, "선택 영역");
    });

    it("통행 표를 공유하는 다른 칸까지 영향을 받으면 거절한다", () => {
      const before = structuredClone(base);
      const map = before.maps[town]!;
      const tileset = seed.tilesets[map.tilesetId]!;
      before.tilesets[map.tilesetId] = { ...tileset, passability: [
        { up: true, down: true, left: true, right: true }, { up: true, down: true, left: true, right: true },
      ] };
      before.maps.woods!.tilesetId = "foreign";
      map.upperTiles[4] = 1;
      const after = structuredClone(before);
      after.tilesets[map.tilesetId]!.passability[1]!.up = false;
      expect(checkSmallTaskScope(before, after, region)).toEqual({ ok: true });
      after.maps[town]!.upperTiles[0] = 1;
      expect(checkSmallTaskScope(before, after, region)).toMatchObject({ ok: false, reason: expect.stringContaining("타일셋") });
    });

    it("맵 속성과 조우 표, 장소, 연결, 해당 맵을 향한 시작 위치를 허용한다", () => {
      expect(verify(meta, p => {
        p.maps[town]!.name = "새 마을";
        p.maps[town]!.encounterTable = [];
        p.maps[town]!.locations = [];
        p.mapConnections = [link(town, "woods")];
        p.startPos = { x: 2, y: 1 };
      })).toEqual({ ok: true });
      rejects(meta, p => { p.maps[town]!.upperTiles[4] = 1; }, "타일");
      rejects(meta, p => { page(p).commands.pop(); }, "보물상자");
      rejects(meta, p => { p.maps[town]!.width++; }, "속성");
      rejects(meta, p => { p.startMapId = "woods"; }, "프로젝트의 다른 설정");
      rejects(meta, p => { p.mapConnections = [link("woods", "woods")]; }, "맵 연결");
    });

    it("선택 맵으로 들어오는 연결은 해당 동작이 허용할 때만 수정한다", () => {
      const before = { ...base, mapConnections: [link("woods", town)] };
      const after = { ...before, mapConnections: [{ ...before.mapConnections[0]!, npcEnabled: true }] };
      expect(checkSmallTaskScope(before, after, { ...meta, fields: [], connections: "both" })).toEqual({ ok: true });
      for (const connections of ["none", "outgoing"] as const) {
        expect(checkSmallTaskScope(before, after, { ...meta, fields: [], connections })).toMatchObject({ ok: false });
      }
      rejects({ ...meta, fields: ["name"], connections: "none" }, p => { p.maps[town]!.locations = []; }, "속성");
    });

    it("맵 크기 변경과 삭제에 필요한 변경만 각각 허용한다", () => {
      const before = { ...base, mapTree: { mapId: town, children: [{ mapId: "woods", children: [] }] } };
      const resize = { kind: "mapResize", mapId: town } as const;
      const resized = { ...before, maps: { ...before.maps, [town]: {
        ...before.maps[town]!, width: 4, lowerTiles: Array(12).fill(0), upperTiles: Array(12).fill(-1),
      } } };
      expect(checkSmallTaskScope(before, resized, resize)).toEqual({ ok: true });
      resized.maps[town].name = "다른 이름";
      expect(checkSmallTaskScope(before, resized, resize)).toMatchObject({ ok: false });

      const remove = { kind: "mapRemove", mapId: "woods" } as const;
      const removed = { ...before, maps: { [town]: before.maps[town]! }, mapTree: { mapId: town, children: [] } };
      expect(checkSmallTaskScope(before, removed, remove)).toEqual({ ok: true });
      expect(checkSmallTaskScope(before, { ...removed, mapTree: before.mapTree }, remove)).toMatchObject({ ok: false });
      expect(checkSmallTaskScope(before, { ...removed, startPos: { x: 1, y: 1 } }, remove)).toMatchObject({ ok: false });
    });

    it("가로와 세로 모두 공용 맵 크기 상한을 지킨다", () => {
      const resize = { kind: "mapResize", mapId: town } as const;
      const resized = (width: number, height: number) => verify(resize, p => {
        Object.assign(p.maps[town]!, { width, height, lowerTiles: Array(width * height).fill(0), upperTiles: Array(width * height).fill(-1) });
      });
      expect(resized(MAX_TOOL_MAP_DIMENSION, 1)).toEqual({ ok: true });
      expect(resized(MAX_TOOL_MAP_DIMENSION + 1, 1)).toMatchObject({ ok: false });
      expect(resized(1, MAX_TOOL_MAP_DIMENSION + 1)).toMatchObject({ ok: false });
    });

    it("새 맵 한 장의 목록과 지정된 출발 맵 연결만 추가한다", () => {
      const add = (p: Project) => {
        p.maps.field = { ...p.maps.woods!, id: "field", name: "들판" };
        p.mapTree.children.push({ mapId: "field", children: [] });
        p.mapConnections = [link(town, "field")];
      };
      expect(verify(newMap, add)).toEqual({ ok: true });
      rejects(newMap, p => { add(p); p.maps.other = { ...p.maps.field!, id: "other" }; }, "새 맵은 한 장");
      rejects(newMap, p => { add(p); p.mapTree.children.pop(); }, "목록 항목");
      rejects(newMap, p => { add(p); p.mapConnections = [link("woods", "field")]; }, "맵 연결");
      rejects(newMap, p => { add(p); p.maps[town]!.name = "바뀐 마을"; }, "속성");
    });

    it("지정된 프로젝트 행만 수정·삭제하고 허용된 수의 행을 추가한다", () => {
      const before = structuredClone(base);
      before.commonEvents = [
        { id: "first", name: "인사", trigger: "none", commands: [] },
        { id: "second", name: "작별", trigger: "none", commands: [] },
      ];
      const after = structuredClone(before);
      after.commonEvents.splice(0, 1, { ...before.commonEvents[0]!, id: "third", name: "환영" });
      const scope = { kind: "projectArea", area: "commonEvents", ids: ["first"], create: 1 } as const;
      expect(checkSmallTaskScope(before, after, scope)).toEqual({ ok: true });
      after.commonEvents[1]!.name = "작업 밖 인사";
      expect(checkSmallTaskScope(before, after, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("공용 이벤트") });
      rejects({ kind: "projectArea", area: "endings", create: 0 }, p => {
        p.endings = [{ id: "new", name: "여행의 끝", conditions: [], priority: 0 }];
      }, "새 항목 수");
    });

    it("시스템의 이름을 지정한 필드만 바꾼다", () => {
      const scope = { kind: "projectArea", area: "system", ids: ["title", "startGold"] } as const;
      expect(verify(scope, p => { p.meta.title = "새 게임"; p.session.gold = 80; })).toEqual({ ok: true });
      rejects(scope, p => { p.system.cameraZoom = 2; }, "게임 시스템 설정");
      rejects(scope, p => { p.meta.author = "새 저자"; }, "프로젝트 정보");
    });

    it("명시적으로 골랐을 때만 페이지 조건 변경과 자료집 행 삭제를 허용한다", () => {
      const changeCondition = (p: Project) => { page(p).conditions.push({ kind: "gold", op: ">=", amount: 1 }); };
      const scope = { ...eventPage, field: "conditions" } as const;
      expect(verify(scope, changeCondition)).toEqual({ ok: true });
      rejects(eventPage, changeCondition, "보물상자");
      rejects(scope, p => { page(p).commands.pop(); }, "보물상자");
      const erase = (p: Project) => { p.database.items.shift(); };
      expect(verify({ ...item, remove: true }, erase)).toEqual({ ok: true });
      rejects(item, erase, "회복약");
      rejects({ ...item, remove: true }, p => { p.database.items.pop(); }, "마력약");
    });
  });
});
