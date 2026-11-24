import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { registerCompletedHouse } from "@/editor/tools/houseProtection";
import { serialize } from "@/project/io";
import { completedHouseProject, houseMap, HOUSE_RECT, mutateProject } from "./fixtures/completedHouse";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { troopBalanceWarnings } from "@/editor/tools/troopBalanceCheck";
import { createBlankProject, TILE } from "@/project/defaults";
import type { Project, GameMap } from "@/project/types";
import { unlockCondition } from "@/editor/tools/timeGateTools";
import { expandCellsAgainstWalls, snapFlushToWall } from "@/editor/tools/wallFlush";
import { withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";
import { isolateTimers } from "./mergedTeardown";

describe("toolHouseProtection", () => {
  isolateTimers();
  function emptyContext() {
    const project = completedHouseProject();
    const map = houseMap(project);
    delete map.layoutPlan;
    map.lowerTiles.fill(240);
    map.upperTiles.fill(-1);
    return { project };
  }
  describe("completed house transaction invariant", () => {
    it.each([false, true])("rolls back maps, events and tree additions atomically (dryRun=%s)", (dryRun) => {
      const ctx = { project: completedHouseProject() };
      const before = serialize(ctx.project);
      const original = ctx.project;
      const result = mutateProject(ctx, (draft) => {
        const map = houseMap(draft);
        map.upperTiles[3 * map.width + 3] = -1;
        map.events.push({ id: "new_event", x: 1, y: 1, trigger: { kind: "action" }, commands: [] });
        draft.maps.new_map = { ...structuredClone(map), id: "new_map", events: [] };
        draft.mapTree.children.push({ mapId: "new_map", children: [] });
      }, dryRun);
      expect(result.issues?.[0]?.code).toBe("protected-house-write");
      expect(result.ok).toBe(false);
      expect(ctx.project).toBe(original);
      expect(serialize(ctx.project)).toBe(before);
    });

    it("catches tree-repair spillover into a protected house on the map a tool edits, and leaves trees on other maps alone", () => {
      // 나무 짝 보정(밑동 290 위에 수관 260)은 합본 마을 칩셋의 것이라 집 맵을 그 칩셋 위에 둔다. 기본 칩셋(버들항)에서는 보정이 돌지 않고,
      // 픽스처가 깐 TILE.GRASS(240)는 버들항에서 벽이라 create_map 이 start-position 경고만 냈다.
      const withOrphanTrunk = () => {
        const project = completedHouseProject();
        withRetiredEasyRpgTilesets(project);
        const map = houseMap(project);
        map.tilesetId = RETIRED_COMBINED_TOWN_TILESET_ID;
        map.lowerTiles[7 * map.width + 3] = 290; // repair would put a canopy on the protected upper cell (3,6)
        return { project };
      };
      // 실행기는 도구가 타일을 바꾼 맵에서만 나무를 보정한다(toolRunner — «Event/DB/name edits must not normalize trees in this or any other map»).
      // 그 맵에서 보정이 집 안으로 넘치면 쓰기 전체를 되돌린다.
      const sameMap = withOrphanTrunk();
      const before = serialize(sameMap.project);
      const blocked = mutateProject(sameMap, (draft) => {
        const map = houseMap(draft);
        map.lowerTiles[12 * map.width + 12] = 241;
      });
      expect(blocked.issues?.[0]?.code).toBe("protected-house-write");
      expect(blocked.ok).toBe(false);
      expect(serialize(sameMap.project)).toBe(before);
      // 다른 맵을 만드는 도구는 집 맵의 나무를 건드리지 않는다 — 넘칠 보정이 없으니 도구는 성공하고 집 맵의 칸은 그대로다.
      const otherMap = withOrphanTrunk();
      const house = houseMap(otherMap.project);
      const lower = [...house.lowerTiles], upper = [...house.upperTiles];
      const created = runTool(otherMap, "create_map", { id: "elsewhere", name: "Elsewhere", width: 10, height: 10 });
      expect(created.ok, created.summary).toBe(true);
      expect(otherMap.project.maps.elsewhere).toBeDefined();
      expect(houseMap(otherMap.project).lowerTiles).toEqual(lower);
      expect(houseMap(otherMap.project).upperTiles).toEqual(upper);
    });

    it("does not allow removing metadata and then destroying the house", () => {
      const ctx = { project: completedHouseProject() };
      const before = serialize(ctx.project);
      const result = mutateProject(ctx, (draft) => {
        const map = houseMap(draft);
        delete map.layoutPlan;
        map.upperTiles.fill(-1);
        map.lowerTiles.fill(240);
      });
      expect(result.issues?.[0]?.code).toBe("protected-house-write");
      expect(serialize(ctx.project)).toBe(before);
    });

    it("rejects new overlapping house geometry even with identical tile IDs", () => {
      const ctx = { project: completedHouseProject() };
      const before = serialize(ctx.project);
      const result = mutateProject(ctx, (draft) => {
        houseMap(draft).layoutPlan?.regions.push({ id: "new_house", role: "house", label: "Overlap", ...HOUSE_RECT });
      });
      expect(result.issues?.[0]?.code).toBe("house-overlap");
      expect(serialize(ctx.project)).toBe(before);
    });

    it("rejects overlap between two newly recorded houses, including only their ridge", () => {
      const ctx = emptyContext();
      const before = serialize(ctx.project);
      const result = mutateProject(ctx, (draft) => {
        houseMap(draft).layoutPlan = { version: 1, kind: "new", regions: [
          { id: "a", role: "house", label: "A", x: 2, y: 2, w: 4, h: 4 },
          { id: "b", role: "house", label: "B", x: 2, y: 6, w: 4, h: 4 },
        ] };
      });
      expect(result.issues?.[0]?.code).toBe("house-overlap");
      expect(serialize(ctx.project)).toBe(before);
    });

    it("allows unrelated edits and safe dry-run without changing the original project", () => {
      const ctx = { project: completedHouseProject() };
      const before = serialize(ctx.project);
      const args = { mapId: ctx.project.startMapId, x: 12, y: 10, w: 2, h: 2, fill: "empty" };
      expect(runTool(ctx, "clear_region", args, { dryRun: true }).ok).toBe(true);
      expect(serialize(ctx.project)).toBe(before);
      expect(runTool(ctx, "clear_region", args).ok).toBe(true);
      expect(houseMap(ctx.project).lowerTiles[10 * houseMap(ctx.project).width + 12]).toBe(-1);
    });

    // 2026-09-24 감성 스토리 r3: 집이 등록된 중복·고아 맵을 remove_map 으로 지우려 했지만 집 보호가
    // 막아 12개 unreachable 맵이 정리되지 못했다. 집 보호는 살아 있는 맵의 셀 편집을 막는다 —
    // 맵 통째 삭제는 시작맵 가드·무결성 왕복·(에디터) 맵 파괴 승인의 소관이다.
    it("집이 있는 별도 맵을 remove_map 으로 지운다", () => {
      const ctx = { project: completedHouseProject() };
      const created = runTool(ctx, "create_map", { id: "map_village", name: "마을", width: 12, height: 10 });
      expect(created.ok, created.summary).toBe(true);
      const village = ctx.project.maps.map_village!;
      registerCompletedHouse(ctx.project, village, { label: "강가 집", x: 2, y: 2, w: 5, h: 5 });

      const removed = runTool(ctx, "remove_map", { mapId: "map_village" });

      expect(removed.ok, JSON.stringify(removed.issues)).toBe(true);
      expect(ctx.project.maps.map_village).toBeUndefined();
    });
  });
});

// 몬스터 파티 게임의 트룹 밸런스 경고 기준선 — 2026-09-24 포켓몬풍 도그푸딩 pokemon-r2.
//
// 관장(스타터 Lv5 대비 과도한 몬스터 트룹)에 대해 액터 Lv1(HP 514) 기준 모의전이 「거의 위협이
// 되지 못합니다」만 뱉어 모델이 방치했고, 실제 자동 플레이는 스타터 단독파티로 그 전투에 전패해
// 마지막 목표(엔딩)가 막혔다. 경고는 스타터 기준으로 나와야 한다.
describe("troopBalanceMonster", () => {
  isolateTimers();
  function monsterCtx(): { ctx: { project: Project }; speciesIds: string[] } {
    const ctx: { project: Project } = { project: createBlankProject() };
    ctx.project.system.battleParty = "monsters";
    ctx.project.system.monsterBattleParty = true;
    ctx.project.system.monsterCollection = true;
    const speciesIds = ctx.project.database.monsterSpecies.slice(0, 3).map(entry => entry.id);
    expect(speciesIds.length).toBeGreaterThan(0);
    const starter = runTool(ctx, "give_starter_monsters", { speciesIds });
    expect(starter.ok, starter.summary).toBe(true);
    return { ctx, speciesIds };
  }
  describe("troopBalanceWarnings — 몬스터 파티 기준선", () => {
    it("스타터로 못 이기는 트룹은 액터 기준 「위협 없음」 대신 전멸 경고를 낸다", () => {
      const { ctx, speciesIds } = monsterCtx();
      const speciesId = speciesIds[0]!;
      const enemy = runTool(ctx, "upsert_enemy", {
        enemy: { id: "enemy_impossible_golem", name: "불가능 골렘", monsterResourceId: "generated-enemy-slime-01", speciesId, level: 30 },
      });
      expect(enemy.ok, enemy.summary).toBe(true);
      const troop = runTool(ctx, "upsert_troop", {
        troop: { id: "troop_impossible", name: "불가능 트레이너", enemyIds: ["enemy_impossible_golem"] },
      });
      expect(troop.ok, troop.summary).toBe(true);

      const warnings = troopBalanceWarnings(ctx.project, "troop_impossible");
      const joined = warnings.join("\n");
      expect(joined).toContain("전멸");
      expect(joined).toContain("스타터");
      // 액터 Lv1(루카·HP 514) 기준으로 돌리면 「위협 없음」이 뜨던 옛 경고가 아니어야 한다.
      expect(joined).not.toContain("루카");
      expect(joined).not.toContain("거의 위협이 되지 못합니다");
    });

    it("약한 트룹도 액터 기준으로 판단하지 않는다 — 스타터 손실 기준만 쓴다", () => {
      const { ctx, speciesIds } = monsterCtx();
      const speciesId = speciesIds[0]!;
      const enemy = runTool(ctx, "upsert_enemy", {
        enemy: { id: "enemy_tiny_slime", name: "아주 약한 슬라임", monsterResourceId: "generated-enemy-slime-01", speciesId, level: 1 },
      });
      expect(enemy.ok, enemy.summary).toBe(true);
      const troop = runTool(ctx, "upsert_troop", {
        troop: { id: "troop_tiny", name: "아주 약한 무리", enemyIds: ["enemy_tiny_slime"] },
      });
      expect(troop.ok, troop.summary).toBe(true);

      const warnings = troopBalanceWarnings(ctx.project, "troop_tiny");
      const joined = warnings.join("\n");
      // 액터 기준(Lv1 루카 HP 514)이었다면 이 트룹에도 「거의 위협이 되지 못합니다」 가 떴을 것이다.
      // 스타터(수식 HP 18) 로는 모의전 손실이 10% 를 넘므로 경고 없음이 정상 — 어떤 경우든 액터 기준 문구는 나오면 안 된다.
      expect(joined).not.toContain("루카");
      expect(joined === "" || joined.includes("스타터")).toBe(true);
    });
  });
});

// 「옥상 열쇠가 있어야 열리는 철문」: lock_door·create_time_gate 의 unlockWhen 이 아이템 조건을 받는다(「이상 없음」 옥상 철문을 손으로 짜던 것).
describe("unlockItem", () => {
  isolateTimers();
  describe("unlockWhen itemId", () => {
    it("turns {itemId} into an item page condition", () => {
      const project = createBlankProject();
      const itemId = project.database.items[0]!.id;
      expect(unlockCondition(project, { itemId }).condition).toEqual({ kind: "item", itemId, present: true });
    });
    it("rejects an unknown item and mixing with a switch", () => {
      const project = createBlankProject();
      expect(() => unlockCondition(project, { itemId: "item_no_such" })).toThrow(/item_no_such/u);
      expect(() => unlockCondition(project, { itemId: project.database.items[0]!.id, switchId: "sw_x" })).toThrow(/정확히 하나/u);
    });
  });
});

// 「밤에만 열리는 길」: lock_door·create_time_gate 의 unlockWhen 이 시간대 조건을 받는다(사냥꾼 계약 데모에서 손으로 짠 낮 막이를 대신한다).
describe("unlockTimePhase", () => {
  isolateTimers();
  describe("unlockWhen timePhase", () => {
    it("turns {timePhase} into a timePhase page condition", () => {
      const project = createBlankProject();
      const parsed = unlockCondition(project, { timePhase: "night" });
      expect(parsed.condition).toEqual({ kind: "timePhase", phase: "night" });
    });
    it("warns when the time system is off", () => {
      const project = createBlankProject();
      project.system.timeSystem = undefined;
      expect(unlockCondition(project, { timePhase: "night" }).note).toMatch(/configure_time_system/u);
      project.system.timeSystem = { enabled: true };
      expect(unlockCondition(project, { timePhase: "night" }).note).toBeUndefined();
    });
    it("rejects unknown phases and mixing with a switch", () => {
      const project = createBlankProject();
      expect(() => unlockCondition(project, { timePhase: "midnight" })).toThrow(/timePhase/u);
      expect(() => unlockCondition(project, { timePhase: "night", switchId: "sw_x" })).toThrow(/정확히 하나/u);
    });
  });
});

// test/wallFlush.test.ts
// 조수가 벽에서 1칸 띄워 놓는 버릇: 출입구는 벽·맵 끝에 붙이고, 타일 채우기는 맵 안 벽과의 틈만 메운다.
describe("wallFlush", () => {
  isolateTimers();
  // TILE.WALL·잔디는 합본 마을 칩셋의 번호·재료다 — 정리 전 빈 프로젝트처럼 합본 마을 맵에서 잰다.
  const blankCombinedTownProject = () => withRetiredCombinedTownMaps(createBlankProject());
  function ctxWithMaps(): ToolContext {
    const context: ToolContext = { project: blankCombinedTownProject() };
    const created = runTool(context, "create_map", { id: "map_b", name: "실내", width: 20, height: 15 }, { dryRun: false });
    expect(created.ok, created.summary).toBe(true);
    return context;
  }
  function paintNorthWall(map: GameMap): void {
    for (let x = 0; x < map.width; x += 1) map.lowerTiles[x] = TILE.WALL;
  }
  describe("snapFlushToWall", () => {
    it("맵 가장자리에서 1칸 안쪽 출입구를 가장자리로 당긴다", () => {
      const project = blankCombinedTownProject();
      const map = project.maps[project.startMapId]!;
      expect(snapFlushToWall(project, map, 1, 7)).toEqual({ x: 0, y: 7 });
      expect(snapFlushToWall(project, map, map.width - 2, 7)).toEqual({ x: map.width - 1, y: 7 });
      expect(snapFlushToWall(project, map, 7, 1)).toEqual({ x: 7, y: 0 });
    });

    it("이미 가장자리에 붙어 있으면 그대로 둔다", () => {
      const project = blankCombinedTownProject();
      const map = project.maps[project.startMapId]!;
      expect(snapFlushToWall(project, map, 0, 7)).toEqual({ x: 0, y: 7 });
    });

    it("방 한가운데는 당기지 않는다", () => {
      const project = blankCombinedTownProject();
      const map = project.maps[project.startMapId]!;
      expect(snapFlushToWall(project, map, 10, 7)).toEqual({ x: 10, y: 7 });
    });

    it("북벽에서 1칸 떨어진 칸을 벽 바로 앞 통행 칸으로 당긴다", () => {
      const project = blankCombinedTownProject();
      const map = project.maps[project.startMapId]!;
      paintNorthWall(map);
      expect(snapFlushToWall(project, map, 8, 2)).toEqual({ x: 8, y: 1 });
    });

    it("벽 칸 위 요청은 바로 앞 통행 칸으로 옮긴다", () => {
      const project = blankCombinedTownProject();
      const map = project.maps[project.startMapId]!;
      paintNorthWall(map);
      expect(snapFlushToWall(project, map, 8, 0)).toEqual({ x: 8, y: 1 });
    });
  });
  describe("expandCellsAgainstWalls", () => {
    it("벽과 채운 영역 사이 1칸 틈을 메운다", () => {
      const project = blankCombinedTownProject();
      const map = project.maps[project.startMapId]!;
      paintNorthWall(map);
      const filled = expandCellsAgainstWalls(project, map, [
        { x: 4, y: 2 },
        { x: 5, y: 2 },
      ]);
      expect(filled).toEqual(expect.arrayContaining([
        { x: 4, y: 2 },
        { x: 5, y: 2 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ]));
      expect(filled).toHaveLength(4);
    });

    it("맵 가장자리 1칸은 메우지 않는다", () => {
      const project = blankCombinedTownProject();
      const map = project.maps[project.startMapId]!;
      const filled = expandCellsAgainstWalls(project, map, [{ x: 5, y: 1 }]);
      expect(filled).toEqual([{ x: 5, y: 1 }]);
    });
  });
  describe("create_transfer_pair 벽 밀착", () => {
    it("1칸 안쪽 좌표를 맵 가장자리로 당긴다", () => {
      const context = ctxWithMaps();
      const result = runTool(
        context,
        "create_transfer_pair",
        { a: { mapId: context.project.startMapId, x: 1, y: 7 }, b: { mapId: "map_b", x: 2, y: 2 } },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect(result.data).toMatchObject({
        gateA: { x: 0, y: 7 },
        adjustedA: true,
      });
      const map = context.project.maps[context.project.startMapId]!;
      const gate = map.events.find((event) => event.x === 0 && event.y === 7);
      expect(gate?.pages?.[0]?.trigger).toEqual({ kind: "playerTouch" });
    });

    it("북벽 1칸 앞이 아니라 벽과 맞닿은 칸에 출입구를 놓는다", () => {
      const context = ctxWithMaps();
      const map = context.project.maps[context.project.startMapId]!;
      paintNorthWall(map);
      const result = runTool(
        context,
        "create_transfer_pair",
        { a: { mapId: map.id, x: 8, y: 2 }, b: { mapId: "map_b", x: 4, y: 4 } },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect(result.data).toMatchObject({
        gateA: { x: 8, y: 1 },
        adjustedA: true,
      });
    });
  });
  describe("fill_region 벽 밀착", () => {
    it("북벽과 1칸 틈이 있으면 그 줄을 메운다", () => {
      const context: ToolContext = { project: blankCombinedTownProject() };
      const map = context.project.maps[context.project.startMapId]!;
      paintNorthWall(map);
      context.project.startPos = { x: 10, y: 10 };
      const result = runTool(
        context,
        "fill_region",
        { mapId: map.id, rect: { x: 4, y: 2, w: 3, h: 2 }, material: "잔디" },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      const filled = Number((result.data as { filled?: number }).filled ?? 0);
      expect(filled).toBeGreaterThanOrEqual(9);
      expect(map.lowerTiles[1 * map.width + 4]).not.toBe(TILE.WALL);
      expect(map.lowerTiles[0]).toBe(TILE.WALL);
    });
  });
});
