import { describe, expect, it } from "vitest";
import { DOOR_CLOSE_SE_POOL, DOOR_OPEN_SE_POOL } from "@/assets/seThemeVariants";
import { HOUSE_DOOR_CHARSET_TEXTURE } from "@/editor/houseInteriors";
import { INTERIOR_ROOM_TILESET_ID as INTERIOR_HOUSE_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { TOOL_CATEGORIES } from "@/editor/panels/toolBrowserModal";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { snapshotProjectMaps, wipeAttemptMaps } from "@/editor/tools/villageBuilder";
import { exteriorFootprintArea } from "@/editor/tools/village/interiors";
import { buildTerrainConstraintMasks } from "@/editor/tools/villageTerrainPass";
import { inferRequirementsFromQuery } from "@/editor/tools/villageRequirements";
import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import { allTools, getTool } from "@/editor/tools/toolRegistry";
import type { ToolContext } from "@/editor/tools/types";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { MapTreeNode } from "@/project/types";

interface VillageHouseData {
  readonly index: number;
  readonly kitId: string;
  readonly stories: 1 | 2 | 3;
  readonly templateId: string;
  readonly doorAt: { readonly x: number; readonly y: number };
  readonly front: { readonly x: number; readonly y: number };
  readonly ownerName: string;
  readonly interiorMapId?: string;
  readonly doorEventId?: string;
  readonly exitEventId?: string;
  readonly entry?: { readonly x: number; readonly y: number };
  readonly exit?: { readonly x: number; readonly y: number };
  readonly returnTo?: { readonly x: number; readonly y: number };
}

interface VillageData {
  readonly mapId: string;
  readonly bounds?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly housesBuilt: number;
  readonly fencesEnabled?: boolean;
  readonly fencedHouses?: number;
  readonly fenceTiles?: number;
  readonly pathStyle?: string;
  readonly theme?: string;
  readonly planId?: string;
  readonly decorEnabled?: boolean;
  readonly decorPlaced?: number;
  readonly doorsConnected: number;
  readonly doorsIntact: number;
  readonly roadComponents: number;
  readonly npcCount: number;
  readonly interiorCount: number;
  readonly doorEventCount: number;
  readonly houses: readonly VillageHouseData[];
}

interface VillageSnapshot {
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
  readonly events: readonly { readonly id: string; readonly x: number; readonly y: number; readonly commandKinds: readonly string[] }[];
  readonly mapIds: readonly string[];
  readonly mapTree: string;
}

function villageData(value: unknown): VillageData {
  if (!isVillageData(value)) throw new Error(`build_village data shape mismatch: ${JSON.stringify(value)}`);
  return value;
}

function isVillageData(value: unknown): value is VillageData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return typeof Reflect.get(value, "mapId") === "string"
    && typeof Reflect.get(value, "housesBuilt") === "number"
    && typeof Reflect.get(value, "doorsConnected") === "number"
    && typeof Reflect.get(value, "doorsIntact") === "number"
    && typeof Reflect.get(value, "roadComponents") === "number"
    && typeof Reflect.get(value, "npcCount") === "number"
    && typeof Reflect.get(value, "interiorCount") === "number"
    && typeof Reflect.get(value, "doorEventCount") === "number"
    && Array.isArray(Reflect.get(value, "houses"));
}

function buildVillage(seed: number): { readonly context: ToolContext; readonly data: VillageData; readonly snapshot: VillageSnapshot } {
  const context: ToolContext = { project: createEmptyToolProject("마을 테스트") };
  const result = runTool(context, "build_village", { seed });
  expect(result.ok, result.summary).toBe(true);
  const data = villageData(result.data);
  const map = context.project.maps[data.mapId];
  expect(map, data.mapId).toBeTruthy();
  return {
    context,
    data,
    snapshot: {
      lowerTiles: [...map.lowerTiles],
      upperTiles: [...map.upperTiles],
      events: map.events.map((event) => ({
        id: event.id,
        x: event.x,
        y: event.y,
        commandKinds: event.pages?.[0]?.commands.map((command) => command.kind) ?? event.commands.map((command) => command.kind),
      })),
      mapIds: Object.keys(context.project.maps).sort(),
      mapTree: JSON.stringify(context.project.mapTree),
    },
  };
}

describe("build_village", () => {
  it("빈 프로젝트에서 seed만으로 50x50 마을을 완성한다", () => {
    const { context, data } = buildVillage(7);
    const map = context.project.maps[data.mapId];
    expect(map.width).toBe(50);
    expect(map.height).toBe(50);
    expect(data.housesBuilt).toBe(8);
    expect(data.doorsConnected).toBe(8);
    expect(data.roadComponents).toBe(1);
    expect(data.npcCount).toBe(10);
    expect(data.interiorCount).toBe(8);
    expect(data.doorEventCount).toBe(8);
    expect(data.fencesEnabled).toBe(true);
    expect(data.fencedHouses).toBe(8);
    expect((data.fenceTiles ?? 0) > 0).toBe(true);
    expect(data.fenceTiles ?? 0).toBeLessThanOrEqual(data.housesBuilt * 8);
    expect(data.pathStyle).toBe("sand");
    expect(data.decorEnabled).toBe(true);
    expect((data.decorPlaced ?? 0) > 0).toBe(true);
    // 문 외형은 Object1 문 이벤트가 담당한다 — 문 타일(116/146)은 한 칸도 깔지 않는다.
    expect(map.lowerTiles.filter((tile) => tile === 146)).toHaveLength(0);
    expect(map.lowerTiles.filter((tile) => tile === 116)).toHaveLength(0);
    // 문 칸 무결성: 진입로가 집을 관통해 문을 덮으면 doorsIntact 가 줄어든다 (회귀 방지).
    expect(data.doorsIntact).toBe(8);
    // 울타리 타일(상단 오버레이)이 실제 배치됐는지.
    const fenceTiles = new Set([378, 379, 380, 408, 409, 410, 438, 439]);
    expect(map.upperTiles.some((tile) => fenceTiles.has(tile))).toBe(true);

    const sand = new Set([424, 394, 454, 423, 425, 393, 395, 453, 455, 456]);
    const dirt = new Set([421, 391, 451, 420, 422, 390, 392, 450, 452, 360, 362, 300]);
    const road = new Set([...sand, ...dirt]);
    const edgeHasRoad = (cells: readonly number[]) => cells.some((index) => road.has(map.lowerTiles[index] ?? -1));
    expect(edgeHasRoad(Array.from({ length: map.width }, (_, x) => x))).toBe(true);
    expect(edgeHasRoad(Array.from({ length: map.width }, (_, x) => (map.height - 1) * map.width + x))).toBe(true);
    expect(edgeHasRoad(Array.from({ length: map.height }, (_, y) => y * map.width))).toBe(true);
    expect(edgeHasRoad(Array.from({ length: map.height }, (_, y) => y * map.width + map.width - 1))).toBe(true);

    expect(map.layoutPlan?.kind).toBe("village-harness-natural-v2");
    const houseRegions = map.layoutPlan?.regions.filter((region) => region.role === "house") ?? [];
    expect(houseRegions).toHaveLength(8);
    expect(new Set(houseRegions.map((region) => region.shape)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(houseRegions.map((region) => region.kitId)).size).toBeGreaterThanOrEqual(3);
    expect(houseRegions.filter((region) => region.tags?.some((tag) => tag === "2f" || tag === "3f"))).not.toHaveLength(0);

    const windows = new Set([85, 87]);
    let adjacentWindowPairs = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const index = y * map.width + x;
        if (!windows.has(map.upperTiles[index] ?? -1)) continue;
        if (x + 1 < map.width && windows.has(map.upperTiles[index + 1] ?? -1)) adjacentWindowPairs += 1;
        if (y + 1 < map.height && windows.has(map.upperTiles[index + map.width] ?? -1)) adjacentWindowPairs += 1;
      }
    }
    expect(adjacentWindowPairs).toBe(0);

    const villagers = map.events.filter((event) => event.id.startsWith("ev_village_"));
    expect(villagers.every((event) => (event.schedule?.length ?? 0) >= 3)).toBe(true);
    expect(new Set(villagers.flatMap((event) => event.schedule?.map((entry) => entry.activity) ?? [])).size).toBeGreaterThanOrEqual(6);
    expect(new Set(villagers.map((event) => event.pages?.[0]?.movement.type)).size).toBe(2);
    expect(map.upperTiles.some((tile) => tile === 260)).toBe(true);
    expect(map.upperTiles.some((tile) => tile === 262)).toBe(true);

    const evaluated = runTool(context, "evaluate_village_look", { mapId: data.mapId });
    expect(evaluated.ok, evaluated.summary).toBe(true);
    const natural = (evaluated.data as {
      metrics: {
        exitRoads: number;
        adjacentWindowPairs: number;
        orphanDoorTiles: number;
        houseShapeKinds: number;
        houseKitKinds: number;
        multiStoryHouses: number;
        scheduledNpcs: number;
        npcActivityKinds: number;
        npcMovementKinds: number;
        treeKinds: number;
        propTileKinds: number;
        longestStraightRoadRun: number;
        interiorTreeCells: number;
      };
    }).metrics;
    expect(natural).toMatchObject({
      exitRoads: 4,
      adjacentWindowPairs: 0,
      orphanDoorTiles: 0,
      multiStoryHouses: expect.any(Number),
      scheduledNpcs: 10,
      npcMovementKinds: 2,
      treeKinds: 2,
    });
    expect(natural.houseShapeKinds).toBeGreaterThanOrEqual(4);
    expect(natural.houseKitKinds).toBeGreaterThanOrEqual(3);
    expect(natural.multiStoryHouses).toBeGreaterThanOrEqual(1);
    expect(natural.npcActivityKinds).toBeGreaterThanOrEqual(6);
    expect(natural.propTileKinds).toBeGreaterThanOrEqual(6);
    expect(natural.longestStraightRoadRun).toBeLessThanOrEqual(Math.floor(map.width * 0.5));
    expect(natural.interiorTreeCells).toBeGreaterThanOrEqual(24);
  });

  it("pathStyle:dirt 로 흙길을 쓸 수 있다", () => {
    const context: ToolContext = { project: createEmptyToolProject("마을 흙길") };
    const result = runTool(context, "build_village", { seed: 7, pathStyle: "dirt", decor: false });
    expect(result.ok, result.summary).toBe(true);
    const data = villageData(result.data);
    expect(data.pathStyle).toBe("dirt");
    expect(data.doorsConnected).toBe(8);
    expect(data.roadComponents).toBe(1);
  });

  it("theme/housePlans 의도를 받아 집 수와 키트에 반영한다", () => {
    const context: ToolContext = { project: createEmptyToolProject("의도 마을") };
    const result = runTool(context, "build_village", {
      seed: 3,
      theme: "강가 어촌 장터",
      housePlans: [
        { kitId: "bright-plaster", yard: ["fruit_box", "bench_h"] },
        { kitId: "blue-stone", yard: ["mailbox", "flowers"] },
        { kitId: "bright-plaster", yard: ["wood_box"] },
        { kitId: "blue-stone", yard: ["firewood", "pot"] },
      ],
      npcs: [{ name: "어부", lines: ["파도가 잔잔하다."] }],
    });
    expect(result.ok, result.summary).toBe(true);
    const data = villageData(result.data);
    expect(data.housesBuilt).toBe(4);
    expect(data.pathStyle).toBe("sand");
    expect(data.theme).toBe("강가 어촌 장터");
    const kits = data.houses.map((house) => house.kitId);
    expect(kits).toEqual(["bright-plaster", "blue-stone", "bright-plaster", "blue-stone"]);
    expect(data.houses[0]?.ownerName).toBe("어부");
  });

  it("강촌마을 쿼리는 강+숲 필수 스펙을 뽑고 맵에 수역·나무를 깐다", () => {
    const context: ToolContext = { project: createEmptyToolProject("강촌") };
    const planned = runTool(context, "plan_village", {
      theme: "강촌마을",
      seed: 9,
      houses: [
        { kitId: "blue-stone", yard: ["mailbox"] },
        { kitId: "bright-plaster", yard: ["flowers"] },
        { kitId: "blue-stone", yard: ["pot"] },
        { kitId: "bright-plaster", yard: ["jar"] },
      ],
    });
    expect(planned.ok, planned.summary).toBe(true);
    const plan = (planned.data as { plan: { requirements: { landmarks: string[]; mustExist: string[] } } }).plan;
    expect(plan.requirements.landmarks).toEqual(expect.arrayContaining(["river", "forest"]));
    expect(plan.requirements.mustExist.some((line) => line.includes("강"))).toBe(true);
    expect(plan.requirements.mustExist.some((line) => line.includes("숲"))).toBe(true);

    const built = runTool(context, "build_village", {
      planId: (planned.data as { planId: string }).planId,
    });
    expect(built.ok, built.summary).toBe(true);
    const data = villageData(built.data);
    const map = context.project.maps[data.mapId];
    const waterish = map.lowerTiles.filter((tile) => tile === 120 || tile === 150 || tile === 180 || tile === 210 || (tile >= 0 && tile <= 210 && [0, 30, 60, 90, 120, 150, 180, 210].includes(tile % 30 === 0 ? tile : -1))).length;
    // 수역 타일이 의미 있게 깔렸는지(오토타일 변형 포함) — evaluate 메트릭으로 재판정
    const look = runTool(context, "evaluate_village_look", {
      mapId: data.mapId,
      planId: (planned.data as { planId: string }).planId,
    });
    expect(look.ok, look.summary).toBe(true);
    const report = look.data as {
      ok: boolean;
      metrics: { waterCells: number; treeCells: number };
      requirementsMet?: { kind: string; ok: boolean }[];
    };
    expect(report.metrics.waterCells).toBeGreaterThanOrEqual(30);
    expect(report.metrics.treeCells).toBeGreaterThanOrEqual(20);
    expect(report.requirementsMet?.find((r) => r.kind === "river")?.ok).toBe(true);
    expect(report.requirementsMet?.find((r) => r.kind === "forest")?.ok).toBe(true);
    void waterish;
  });

  it("run_village_session 이 멀티턴 체크리스트로 강촌을 시공하고 2×2 나무를 심는다", () => {
    const context: ToolContext = { project: createEmptyToolProject("세션 강촌") };
    const result = runTool(context, "run_village_session", {
      theme: "강촌마을",
      query: "강촌마을",
      seed: 77,
      width: 50,
      height: 50,
      mapName: "강촌마을",
      roadWidth: 3,
      settlementLayout: "street-grid",
      budgetTurns: 14,
      houses: [
        { kitId: "blue-stone", yard: ["mailbox", "flowers"] },
        { kitId: "bright-plaster", yard: ["firewood", "pot"] },
        { kitId: "blue-stone", yard: ["jar"] },
        { kitId: "bright-plaster", yard: ["wood_box"] },
      ],
      npcs: [{ name: "촌장", lines: ["강이 맑다."] }],
    });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      ok: boolean;
      mapId: string;
      sessionId: string;
      status: string;
      evaluation?: { ok: boolean; metrics: { tree2x2Clusters: number; waterCells: number; treeCells: number } };
      session: { checklist: { id: string; status: string }[] };
    };
    expect(data.mapId).toBeTruthy();
    expect(data.status).toBe("complete");
    expect(data.session.checklist.find((c) => c.id === "forest_big")?.status).toBe("done");
    const map = context.project.maps[data.mapId];
    expect(map).toBeTruthy();
    const look = runTool(context, "evaluate_village_look", {
      mapId: data.mapId,
      planId: (runTool(context, "get_village_session", { sessionId: data.sessionId }).data as { planId: string }).planId,
    });
    expect(look.ok, look.summary).toBe(true);
    const report = look.data as { metrics: { tree2x2Clusters: number; waterCells: number }; ok: boolean };
    expect(report.metrics.waterCells).toBeGreaterThanOrEqual(30);
    expect(report.metrics.tree2x2Clusters).toBeGreaterThanOrEqual(3);

    const assets = runTool(context, "list_village_tree_assets", {});
    expect(assets.ok).toBe(true);
    expect(JSON.stringify(assets.data)).toContain("broadleaf-tree-2x2");
  });

  it("run_village_pipeline 이 plan→build→spec→look 을 돌린다", () => {
    const context: ToolContext = { project: createEmptyToolProject("파이프라인 마을") };
    const result = runTool(context, "run_village_pipeline", {
      maxAttempts: 2,
      theme: "강가 어촌 장터",
      pathStyle: "sand",
      yardStyle: "market",
      plazaStyle: "market",
      plazaLayout: "south",
      seed: 5,
      houses: [
        { kitId: "bright-plaster", yard: ["fruit_box", "bench_h"] },
        { kitId: "blue-stone", yard: ["mailbox", "flowers"] },
        { kitId: "bright-plaster", yard: ["wood_box"] },
        { kitId: "blue-stone", yard: ["sign", "jar"] },
      ],
      npcs: [{ name: "어부", lines: ["파도."] }],
    });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      ok: boolean;
      mapId: string;
      planId: string;
      evaluation: { ok: boolean; score: number; feedbackForLlm: string };
      build: { housesBuilt: number };
    };
    expect(data.mapId).toBeTruthy();
    expect(data.planId).toBeTruthy();
    expect(data.build.housesBuilt).toBe(4);
    expect(data.evaluation.feedbackForLlm).toContain("[village_gate]");
    expect(context.project.maps[data.mapId]).toBeTruthy();
  });

  it("plan_village → build_village(planId) → critique_village 3층 흐름", () => {
    const context: ToolContext = { project: createEmptyToolProject("계획 마을") };
    const planned = runTool(context, "plan_village", {
      theme: "강가 어촌 장터",
      pathStyle: "sand",
      yardStyle: "market",
      plazaStyle: "market",
      plazaLayout: "south",
      edgeTrees: "conifer",
      seed: 11,
      houses: [
        { kitId: "bright-plaster", yard: ["fruit_box", "bench_h"], ownerName: "어부" },
        { kitId: "blue-stone", yard: ["mailbox", "flowers"], ownerName: "포구지기" },
        { kitId: "bright-plaster", yard: ["wood_box", "pot"] },
        { kitId: "blue-stone", yard: ["sign", "jar"] },
      ],
      npcs: [
        { name: "어부", lines: ["그물이 무겁다."] },
        { name: "장사꾼", lines: ["모래길이 발에 좋다."] },
      ],
    });
    expect(planned.ok, planned.summary).toBe(true);
    const planData = planned.data as { planId: string; plan: { summary: string; pathStyle: string }; previewSummary: string };
    expect(planData.planId).toBeTruthy();
    expect(planData.plan.pathStyle).toBe("sand");
    expect(planData.previewSummary).toContain("어촌");

    const built = runTool(context, "build_village", { planId: planData.planId });
    expect(built.ok, built.summary).toBe(true);
    const data = villageData(built.data);
    expect(data.housesBuilt).toBe(4);
    expect(data.pathStyle).toBe("sand");
    expect(data.planId).toBe(planData.planId);
    const critique = (built.data as { critique?: { ok: boolean } }).critique;
    expect(critique).toBeTruthy();

    const crit = runTool(context, "critique_village", {
      mapId: data.mapId,
      doorFronts: data.houses.map((house) => house.front),
    });
    expect(crit.ok, crit.summary).toBe(true);
    expect((crit.data as { ok: boolean }).ok).toBe(true);
  });

  it("fences:false면 울타리를 깔지 않는다", () => {
    const context: ToolContext = { project: createEmptyToolProject("마을 울타리 없음") };
    const result = runTool(context, "build_village", { seed: 7, fences: false });
    expect(result.ok, result.summary).toBe(true);
    const data = villageData(result.data);
    const map = context.project.maps[data.mapId];
    expect(data.fencesEnabled).toBe(false);
    expect(data.fencedHouses).toBe(0);
    const fenceTiles = new Set([378, 379, 380, 408, 409, 410, 438, 439]);
    expect(map.upperTiles.some((tile) => fenceTiles.has(tile))).toBe(false);
  });

  it("기본 시드에서도 문 8개가 전부 온전하다 (진입로 관통 회귀)", () => {
    const { context, data } = buildVillage(1);
    const map = context.project.maps[data.mapId];
    expect(data.doorsIntact).toBe(8);
    // 문 칸마다 Object1 문 이벤트가 서 있고, 문 타일은 어디에도 없다.
    expect(map.lowerTiles.filter((tile) => tile === 146 || tile === 116)).toHaveLength(0);
    for (const house of data.houses) {
      const door = map.events.find((event) => event.id === house.doorEventId);
      expect(door, JSON.stringify(house.doorAt)).toBeTruthy();
      expect(door?.pages?.[0]?.graphic.sprite?.id).toBe(HOUSE_DOOR_CHARSET_TEXTURE);
    }
    expect(data.doorsConnected).toBe(8);
    expect(data.roadComponents).toBe(1);
  });

  it("같은 seed는 타일과 이벤트 좌표가 같고 다른 seed는 하위 타일이 달라진다", () => {
    const first = buildVillage(7).snapshot;
    const second = buildVillage(7).snapshot;
    const different = buildVillage(8).snapshot;

    expect(second.lowerTiles).toEqual(first.lowerTiles);
    expect(second.upperTiles).toEqual(first.upperTiles);
    expect(second.events).toEqual(first.events);
    expect(second.mapIds).toEqual(first.mapIds);
    expect(second.mapTree).toEqual(first.mapTree);
    expect(different.lowerTiles).not.toEqual(first.lowerTiles);
  });

  it("NPC 그래픽을 주민형 후보에서 다양하게 순환 배정하고 같은 seed에서 고정한다", () => {
    const first = buildVillage(7);
    const second = buildVillage(7);
    const firstKeys = villageNpcGraphicKeys(first.context, first.data.mapId);
    const secondKeys = villageNpcGraphicKeys(second.context, second.data.mapId);
    expect(secondKeys).toEqual(firstKeys);
    expect(new Set(firstKeys).size).toBeGreaterThan(4);
    expect(new Set(firstKeys.map((key) => key.split(":")[0])).size).toBeGreaterThanOrEqual(4);
    expect(firstKeys.every((key) => /^tex_easyrpg_charset_people[1-5]:/.test(key))).toBe(true);

    const entries = firstKeys.map((key) => {
      const [textureKey, indexText] = key.split(":");
      return findCharsetSemantic(textureKey ?? "", Number(indexText));
    });
    expect(new Set(entries.map((entry) => entry?.gender).filter(Boolean))).toEqual(new Set(["male", "female"]));
    expect(new Set(entries.map((entry) => entry?.age).filter(Boolean)).size).toBeGreaterThanOrEqual(3);
  });

  it("집 8채에 Object1 문 이벤트와 자식 내부 맵을 생성한다", () => {
    const { context, data } = buildVillage(7);
    const map = context.project.maps[data.mapId];
    const childIds = treeChildIds(context.project.mapTree, data.mapId);
    expect(data.houses).toHaveLength(8);
    const openIds = new Set<string>();
    for (const house of data.houses) {
      expect(house.interiorMapId).toBeTruthy();
      expect(house.doorEventId).toBeTruthy();
      expect(house.exitEventId).toBeTruthy();
      expect(childIds).toContain(house.interiorMapId);
      const door = map.events.find((event) => event.id === house.doorEventId);
      expect(door?.x).toBe(house.doorAt.x);
      expect(door?.y).toBe(house.doorAt.y);
      // 열린 문 기본값: 문 스프라이트는 below 장식, 전이는 문 앞 발판이 맡는다.
      expect(door?.pages?.[0]?.trigger.kind).toBe("playerTouch");
      expect(door?.pages?.[0]?.priority).toBe("below");
      expect(door?.pages?.[0]?.graphic.sprite?.id).toBe(HOUSE_DOOR_CHARSET_TEXTURE);
      expect(door?.pages?.[0]?.commands.map((command) => command.kind)).toEqual([
        "playAudio",
        "setEventGraphicPattern",
        "wait",
        "setEventGraphicPattern",
        "wait",
        "setEventGraphicPattern",
        "wait",
        "transfer",
      ]);
      const openCmd = door?.pages?.[0]?.commands[0];
      expect(openCmd).toMatchObject({ kind: "playAudio", loop: false });
      const openId = (openCmd as { resourceId: string }).resourceId;
      expect(DOOR_OPEN_SE_POOL).toContain(openId);
      const interior = context.project.maps[house.interiorMapId as string];
      expect(interior.name.startsWith(`${house.ownerName}의 집 내부`)).toBe(true);
      expect(interior.tilesetId).toBe(INTERIOR_HOUSE_TILESET_ID);
      // villager-room-v1 규모(천장 정본 v2: +1행 + 수평 벽 3행): cottage-l 20×20, cottage 20×21, mansion 24×25
      expect([20, 24]).toContain(interior.width);
      expect([20, 21, 25]).toContain(interior.height); // 20 = cottage-l·2층, 21 = cottage2/3, 25 = mansion
      expect(house.entry).toBeTruthy();
      expect(house.exit).toBeTruthy();
      expect(door?.pages?.[0]?.commands.at(-1)).toMatchObject({
        kind: "transfer",
        mapId: house.interiorMapId,
        x: house.entry!.x,
        y: house.entry!.y,
      });
      const exit = interior.events.find((event) => event.id === house.exitEventId);
      expect(exit?.x).toBe(house.exit!.x);
      expect(exit?.y).toBe(house.exit!.y);
      expect(exit?.pages?.[0]?.trigger.kind).toBe("playerTouch");
      expect(exit?.pages?.[0]?.commands.map((command) => command.kind)).toEqual(["playAudio", "transfer"]);
      expect(exit?.pages?.[0]?.commands[0]).toMatchObject({ kind: "playAudio", loop: false });
      const closeId = (exit?.pages?.[0]?.commands[0] as { resourceId: string }).resourceId;
      expect(DOOR_CLOSE_SE_POOL).toContain(closeId);
      expect(DOOR_OPEN_SE_POOL.indexOf(openId as (typeof DOOR_OPEN_SE_POOL)[number])).toBe(
        DOOR_CLOSE_SE_POOL.indexOf(closeId as (typeof DOOR_CLOSE_SE_POOL)[number]),
      );
      expect(exit?.pages?.[0]?.commands[1]).toEqual({ kind: "transfer", mapId: data.mapId, x: house.front.x, y: house.front.y, fade: "black" });
      // 문 이벤트는 front가 아니라 doorAt에만 둔다 (NPC 등은 front 가능)
      expect(map.events.some((event) => event.id === house.doorEventId && event.x === house.front.x && event.y === house.front.y)).toBe(false);
      openIds.add(openId);
    }
    expect(openIds.size).toBeGreaterThan(1);
  });

  
  it("대로·진입로가 집 footprint 내부를 침범하지 않는다", () => {
    for (const seed of [1, 7, 42, 77]) {
      const { context, data } = buildVillage(seed);
      const map = context.project.maps[data.mapId];
      const sand = new Set([424, 394, 454, 423, 425, 393, 395, 453, 455, 456]);
      const dirt = new Set([421, 391, 451, 420, 422, 390, 392, 450, 452, 360, 362, 300]);
      const road = new Set([...sand, ...dirt]);
      for (const house of data.houses) {
        // doorAt 주변 외곽은 길일 수 있으나, door 위 집 몸통(bbox 내부 비-문 칸)에 길이 있으면 안 된다.
        // build data에 bbox가 없으므로 맵에서 문 주변 집 타일을 스캔: 문 위 2칸 이상 북쪽 벽 영역에서 road 금지.
        const door = house.doorAt;
        let roadHits = 0;
        // 문 열 위쪽(집 내부 방향) 3x4 스캔 — 문 자체 제외
        for (let dy = -4; dy <= -1; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            const x = door.x + dx;
            const y = door.y + dy;
            if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
            if (x === door.x && (y === door.y || y === door.y - 1)) continue; // 문 타일
            const lower = map.lowerTiles[y * map.width + x] ?? -1;
            const upper = map.upperTiles[y * map.width + x] ?? -1;
            // 지붕/벽 upper가 있는 칸에 길이 있으면 침범
            if (upper >= 0 && road.has(lower)) roadHits += 1;
          }
        }
        expect(roadHits, `seed=${seed} house=${house.ownerName} door=(${door.x},${door.y})`).toBe(0);
      }
      // 문 연결은 유지
      expect(data.doorsConnected).toBe(data.housesBuilt);
      expect(data.roadComponents).toBe(1);
    }
  });

it("interior:false면 내부 맵과 문 이벤트를 만들지 않는다", () => {
    const context: ToolContext = { project: createEmptyToolProject("외장만 마을") };
    const result = runTool(context, "build_village", { seed: 7, interior: false });
    expect(result.ok, result.summary).toBe(true);
    const data = villageData(result.data);
    const map = context.project.maps[data.mapId];
    expect(data.housesBuilt).toBe(8);
    expect(data.interiorCount).toBe(0);
    expect(data.doorEventCount).toBe(0);
    expect(Object.values(context.project.maps).filter((candidate) => candidate.tilesetId === INTERIOR_HOUSE_TILESET_ID)).toHaveLength(0);
    expect(map.events.some((event) => event.id.startsWith("ev_house_door_"))).toBe(false);
    expect(map.lowerTiles.filter((tile) => tile === 146)).toHaveLength(8);
  });

  it("내부 맵 삭제 시 외부 문 transfer dangling 참조가 정리된다", () => {
    const { context, data } = buildVillage(7);
    const firstHouse = data.houses[0];
    expect(firstHouse?.interiorMapId).toBeTruthy();
    if (!firstHouse?.interiorMapId) throw new Error("first house interior missing");
    const removedMapId = firstHouse.interiorMapId as string;
    const result = runTool(context, "remove_map", { mapId: removedMapId });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps[removedMapId]).toBeUndefined();
    const map = context.project.maps[data.mapId];
    const door = map.events.find((event) => event.id === firstHouse.doorEventId);
    expect(door?.pages?.[0]?.commands.some((command) => command.kind === "transfer" && command.mapId === removedMapId)).toBe(false);
    expect(() => deserialize(serialize(context.project))).not.toThrow();
  });

  it("하네싱 창문을 상위 레이어에 배치한다", () => {
    const { context, data } = buildVillage(7);
    const map = context.project.maps[data.mapId];
    expect(map.upperTiles.some((tile) => tile === 85 || tile === 87)).toBe(true);
  });

  it("기존 20x20 맵에는 한 채를 시공하고 최소 크기 미만인 19x19 맵은 거부한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { id: "map_20", name: "기존 20", width: 20, height: 20 }).ok).toBe(true);
    const built = runTool(context, "build_village", { mapId: "map_20", houses: 1, seed: 7, interior: false });
    expect(built.ok, built.summary).toBe(true);
    expect(villageData(built.data).housesBuilt).toBe(1);

    expect(runTool(context, "create_map", { id: "map_19", name: "기존 19", width: 19, height: 19 }).ok).toBe(true);
    const rejected = runTool(context, "build_village", { mapId: "map_19", houses: 1, seed: 7, interior: false });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.code).toBe("map-too-small");
  });

  it("bounds 지정 시 기존 맵의 해당 영역 안에 광장·집·NPC를 배치한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { id: "map_60", name: "기존 60", width: 60, height: 60 }).ok).toBe(true);
    const bounds = { x: 10, y: 8, w: 36, h: 36 };
    const result = runTool(context, "build_village", { mapId: "map_60", bounds, seed: 7, interior: false });
    expect(result.ok, result.summary).toBe(true);
    const data = villageData(result.data);
    expect(data.bounds).toEqual(bounds);
    // 폭 2~3 길·평행 오프셋 이후에도 문 연결은 유지 (성분 수는 레이아웃에 따라 1 이상)
    expect(data.roadComponents).toBeGreaterThanOrEqual(1);
    expect(data.doorsConnected).toBe(data.housesBuilt);
    expect(data.houses.every((house) => pointInRect(house.doorAt, bounds) && pointInRect(house.front, bounds))).toBe(true);
    const map = context.project.maps[data.mapId];
    expect(map.events.filter((event) => event.id.startsWith("ev_village_")).every((event) => pointInRect(event, bounds))).toBe(true);
  });

  it("레지스트리에 등록되고(deprecated) runTool 경로로 실행된다", () => {
    expect(allTools().map((tool) => tool.name)).toContain("build_village");
    const tool = getTool("build_village");
    expect(tool?.deprecated).toBe(true);
    expect(tool?.supersededBy).toBe("author_village");
    expect(TOOL_CATEGORIES.flatMap((category) => category.tools.map((t) => t.name))).not.toContain("build_village");

    const context: ToolContext = { project: createEmptyToolProject("레지스트리 테스트") };
    const result = runTool(context, "build_village", { seed: 13 });
    expect(result.ok, result.summary).toBe(true);
    expect(villageData(result.data).roadComponents).toBe(1);
  });
});

function treeChildIds(root: MapTreeNode, parentId: string): string[] {
  const node = findTreeNode(root, parentId);
  return node?.children.map((child) => child.mapId) ?? [];
}

function villageNpcGraphicKeys(context: ToolContext, mapId: string): string[] {
  const map = context.project.maps[mapId];
  return map.events
    .filter((event) => event.id.startsWith("ev_village_"))
    .map((event) => {
      const graphic = event.pages?.[0]?.graphic;
      const textureKey = graphic?.sprite?.id ?? "";
      const characterIndex = decodeCharsetFrameIndex(graphic?.pattern ?? 0).characterIndex;
      return `${textureKey}:${characterIndex}`;
    });
}

function findTreeNode(node: MapTreeNode, mapId: string): MapTreeNode | null {
  if (node.mapId === mapId) return node;
  for (const child of node.children) {
    const found = findTreeNode(child, mapId);
    if (found) return found;
  }
  return null;
}

function pointInRect(point: { readonly x: number; readonly y: number }, rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.w && point.y < rect.y + rect.h;
}


describe("build_village housePlans contract", () => {
  it("forces housePlans[0].templateId=l and owner/program onto interiors", () => {
    const ctx = { project: createEmptyToolProject() };
    const result = runTool(ctx, "build_village", {
      name: "계약 마을",
      width: 48,
      height: 48,
      seed: 77,
      interior: true,
      doorEvent: true,
      fences: false,
      decor: false,
      housePlans: [
        { kitId: "blue-stone", templateId: "l", ownerName: "촌장 로안", program: "manor", yard: ["mailbox"] },
        { kitId: "amber-wood", yard: ["pot"] },
        { kitId: "slate-wood", yard: ["jar"] },
        { kitId: "bright-plaster", yard: ["flowers"] },
      ],
      npcs: [
        { name: "다른사람", lines: ["인덱스 휴리스틱이면 이 이름이 쓰임"] },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      houses?: Array<{ templateId?: string; kitId?: string; ownerName?: string; interiorMapId?: string; interiorScale?: string; interiorProgram?: string }>;
    };
    expect(data.houses?.[0]?.templateId).toBe("l");
    expect(data.houses?.[0]?.kitId).toBe("blue-stone");
    expect(data.houses?.[0]?.ownerName).toBe("촌장 로안");
    expect(data.houses?.[0]?.interiorScale).toBe("cottage-l");
    expect(data.houses?.[0]?.interiorProgram).toBe("manor");
    const interiorId = data.houses?.[0]?.interiorMapId;
    expect(interiorId).toBeTruthy();
    const interior = ctx.project.maps[interiorId!];
    expect(interior.width).toBe(20);
    expect(interior.height).toBe(20);
    expect(interior.name).toContain("촌장 로안");
  });

  it("hard-fails when forced templateId cannot place", () => {
    const ctx = { project: createEmptyToolProject() };
    // tiny map with 4 houses all forced to impossible template id
    let threw = false;
    try {
      runTool(ctx, "build_village", {
        name: "실패 마을",
        width: 36,
        height: 36,
        seed: 1,
        interior: false,
        doorEvent: false,
        fences: false,
        decor: false,
        housePlans: [
          { kitId: "blue-stone", templateId: "no-such-template" },
          { kitId: "blue-stone", templateId: "no-such-template" },
          { kitId: "blue-stone", templateId: "no-such-template" },
          { kitId: "blue-stone", templateId: "no-such-template" },
        ],
      });
    } catch (error) {
      threw = true;
      expect(String(error)).toMatch(/templateId|house-template|배치 실패|invalid/i);
    }
    // ToolError may be returned as result.ok false depending on runner — accept either
    if (!threw) {
      const result = runTool(ctx, "build_village", {
        name: "실패 마을2",
        width: 36,
        height: 36,
        seed: 1,
        interior: false,
        doorEvent: false,
        fences: false,
        decor: false,
        housePlans: [
          { kitId: "blue-stone", templateId: "no-such-template" },
          { kitId: "blue-stone", templateId: "no-such-template" },
          { kitId: "blue-stone", templateId: "no-such-template" },
          { kitId: "blue-stone", templateId: "no-such-template" },
        ],
      });
      expect(result.ok).toBe(false);
    }
  });

  it("파이프라인 재시도 정리가 기존 무관 맵을 보존한다 (스냅샷 와이프)", () => {
    const ctx: ToolContext = { project: createEmptyToolProject("보존 마을") };
    const made = runTool(ctx, "create_map", { name: "기존 던전", width: 20, height: 15 });
    expect(made.ok, made.summary).toBe(true);
    const keepId = (made.data as { mapId: string }).mapId;
    const keepStart = ctx.project.startMapId;

    // 스냅샷 → 마을 시공(실내 포함) → 와이프: 시공분만 사라지고 기존 맵·시작점은 복원
    const baseline = snapshotProjectMaps(ctx.project);
    const built = runTool(ctx, "build_village", { seed: 7 });
    expect(built.ok, built.summary).toBe(true);
    expect(Object.keys(ctx.project.maps).length).toBeGreaterThan(baseline.mapIds.size);
    wipeAttemptMaps(ctx.project, baseline);
    expect(new Set(Object.keys(ctx.project.maps))).toEqual(new Set([...baseline.mapIds]));
    expect(ctx.project.maps[keepId]).toBeTruthy();
    expect(ctx.project.startMapId).toBe(keepStart);

    // 통합: run_village_pipeline(maxAttempts 2)을 돌려도 기존 맵이 살아 있다
    const result = runTool(ctx, "run_village_pipeline", {
      maxAttempts: 2,
      theme: "강가 어촌 장터",
      pathStyle: "sand",
      seed: 5,
      houses: [
        { kitId: "bright-plaster", yard: ["fruit_box"] },
        { kitId: "blue-stone", yard: ["mailbox"] },
        { kitId: "bright-plaster", yard: ["wood_box"] },
        { kitId: "blue-stone", yard: ["sign"] },
      ],
      npcs: [{ name: "어부", lines: ["파도."] }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[keepId]).toBeTruthy();
    expect(ctx.project.maps[keepId]!.name).toBe("기존 던전");
  });

  it("강+호수 테마에서 집이 물 마스크 셀 위에 배치되지 않는다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject("호수 강촌") };
    const theme = "강과 호수가 있는 마을";
    const result = runTool(ctx, "build_village", { theme, seed: 3 });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { mapId: string; housesBuilt: number };
    const map = ctx.project.maps[data.mapId]!;
    expect(data.housesBuilt).toBeGreaterThanOrEqual(4);

    // 시공에 쓰인 것과 동일한 결정론 마스크를 재계산해 집 필지와 대조
    const masks = buildTerrainConstraintMasks(map, inferRequirementsFromQuery(theme));
    const houseRegions = (map.layoutPlan?.regions ?? []).filter((region) => region.role === "house");
    expect(houseRegions.length).toBe(data.housesBuilt);
    for (const region of houseRegions) {
      for (let y = region.y; y < region.y + region.h; y += 1) {
        for (let x = region.x; x < region.x + region.w; x += 1) {
          const role = masks.roles[y * map.width + x];
          expect(role === "water", `집(${region.x},${region.y})이 (${x},${y}) 물 셀 침범`).toBe(false);
        }
      }
    }
  });

  it("길·울타리·나무가 지붕 용마루 행(bbox.y-1)을 침범하지 않는다", () => {
    const sand = new Set<number>(CHIPSET_TILE_GROUPS.sandGround);
    const fenceTiles = new Set<number>([378, 379, 380, 408, 409, 410, 438, 439]);
    const treeTiles = new Set<number>([260, 261, 262, 263, 290, 291, 292, 293]);
    for (const args of [
      { theme: "강과 호수가 있는 마을", seed: 3 },
      { seed: 7 },
    ]) {
      const ctx: ToolContext = { project: createEmptyToolProject(`용마루 ${args.seed}`) };
      const result = runTool(ctx, "build_village", args);
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as { mapId: string; ridgeInvaded: number };
      expect(data.ridgeInvaded, `seed=${args.seed} 감사 ridgeInvaded`).toBe(0);
      const map = ctx.project.maps[data.mapId]!;
      const regions = (map.layoutPlan?.regions ?? []).filter((region) => region.role === "house");
      expect(regions.length).toBeGreaterThan(0);
      for (const region of regions) {
        const y = region.y - 1;
        if (y < 0) continue;
        for (let x = region.x; x < region.x + region.w; x += 1) {
          const i = y * map.width + x;
          const lower = map.lowerTiles[i] ?? -1;
          const upper = map.upperTiles[i] ?? -1;
          expect(sand.has(lower), `seed=${args.seed} 용마루 행 (${x},${y}) 길 침범 lower=${lower}`).toBe(false);
          expect(fenceTiles.has(upper), `seed=${args.seed} 용마루 행 (${x},${y}) 울타리 침범 upper=${upper}`).toBe(false);
          expect(treeTiles.has(upper), `seed=${args.seed} 용마루 행 (${x},${y}) 나무 침범 upper=${upper}`).toBe(false);
        }
      }
    }
  });

  it("pathStyle:stone 은 포석(129 블록) 오토타일로 성형된 돌길을 깔고 불변식을 지킨다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject("석조 마을") };
    const result = runTool(ctx, "build_village", { seed: 5, pathStyle: "stone" });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      mapId: string;
      housesBuilt: number;
      doorsConnected: number;
      roadComponents: number;
      ridgeInvaded: number;
    };
    expect(data.doorsConnected).toBe(data.housesBuilt);
    expect(data.roadComponents).toBe(1);
    expect(data.ridgeInvaded).toBe(0);
    const map = ctx.project.maps[data.mapId]!;
    const cobble = new Set([129, 131, 159, 160, 161, 189, 190, 191, 219, 220, 221]);
    const cobbleCells = map.lowerTiles.filter((tile) => cobble.has(tile)).length;
    expect(cobbleCells, "포석 칸 수").toBeGreaterThanOrEqual(60);
    // 오토타일 성형 검증 — 몸통(190)만이 아니라 가장자리/모서리 변형이 실제로 배치됨.
    const edgeCells = map.lowerTiles.filter((tile) => cobble.has(tile) && tile !== 190).length;
    expect(edgeCells, "포석 가장자리 성형").toBeGreaterThanOrEqual(20);
    // 밴 타일 미사용
    const banned = map.lowerTiles.filter((tile) => tile === 411 || tile === 412 || tile === 413 || tile === 443).length;
    expect(banned, "밴 타일(411/412/413/443)").toBe(0);
  });

  it("길 시공 훅: bounds 밖으로 길이 새지 않는다 (침범 롤백 재시도)", () => {
    const ctx: ToolContext = { project: createEmptyToolProject("침범 훅") };
    const bounds = { x: 10, y: 10, w: 40, h: 40 };
    const result = runTool(ctx, "build_village", { seed: 7, width: 64, height: 64, bounds, interior: false });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { mapId: string };
    const map = ctx.project.maps[data.mapId]!;
    const roadTiles = new Set<number>([...CHIPSET_TILE_GROUPS.sandGround]);
    let leaks = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!roadTiles.has(map.lowerTiles[y * map.width + x] ?? -1)) continue;
        if (x < bounds.x || y < bounds.y || x >= bounds.x + bounds.w || y >= bounds.y + bounds.h) leaks += 1;
      }
    }
    expect(leaks, "bounds 밖 길 칸").toBe(0);
  });

  it("문이 0개인 맵은 layoutPlan 없이도 evaluate 구조 게이트에서 떨어진다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject("빈 평가") };
    const made = runTool(ctx, "create_map", { name: "빈 맵", width: 30, height: 30 });
    const mapId = (made.data as { mapId: string }).mapId;
    const look = runTool(ctx, "evaluate_village_look", { mapId });
    expect(look.ok, look.summary).toBe(true);
    const report = look.data as { ok: boolean; issues: string[] };
    expect(report.ok).toBe(false);
    // F3: doorFronts 0 → 통과가 아니라 실패
    expect(report.issues.some((issue) => issue.includes("문 앞 좌표"))).toBe(true);
    // F2: layoutPlan.kind 없는 맵에도 타일 실측 검사(출구 길)가 실행된다
    expect(report.issues.some((issue) => issue.includes("4방향"))).toBe(true);
  });
});

describe("exterior footprint area (wing-union)", () => {
  it("rect-large 8x7 union matches bbox 56", () => {
    expect(exteriorFootprintArea("rect-large", { w: 8, h: 7 })).toBe(56);
  });

  it("l 6x8 bbox 48 unions to 42", () => {
    expect(exteriorFootprintArea("l", { w: 6, h: 8 })).toBe(42);
  });

  it("t-hall 8x10 bbox 80 unions to 60", () => {
    expect(exteriorFootprintArea("t-hall", { w: 8, h: 10 })).toBe(60);
  });

  it("unknown template id falls back to bbox area", () => {
    expect(exteriorFootprintArea("custom-db-authored", { w: 9, h: 5 })).toBe(45);
  });

  it("housePlans t-hall shop interior scale is cottage3 from union 60 not mansion bbox 80", () => {
    const ctx = { project: createEmptyToolProject() };
    const result = runTool(ctx, "build_village", {
      name: "T홀 상점 마을",
      width: 48,
      height: 48,
      seed: 77,
      interior: true,
      doorEvent: true,
      fences: false,
      decor: false,
      housePlans: [
        { kitId: "blue-stone", templateId: "t-hall", program: "shop" },
        { kitId: "amber-wood", yard: ["pot"] },
        { kitId: "slate-wood", yard: ["jar"] },
        { kitId: "bright-plaster", yard: ["flowers"] },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      houses?: Array<{ templateId?: string; interiorScale?: string; interiorProgram?: string }>;
    };
    expect(data.houses?.[0]?.templateId).toBe("t-hall");
    expect(data.houses?.[0]?.interiorProgram).toBe("shop");
    expect(data.houses?.[0]?.interiorScale).toBe("cottage3");
  });
});

