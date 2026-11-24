import { describe, expect, it, beforeEach } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject, createBlankProject as createBlankDefaultProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyGenrePreset } from "@/project/genrePresets";
import { tilesetFamily } from "@/project/tilesetFamily";
import { getTool } from "@/editor/tools/toolRegistry";
import { removedMapIds } from "@/ai/approvalPolicy";
import { withRetiredEasyRpgTilesets, startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { advanceFieldSpawns, createFieldSpawnRuntime, fieldSpawnAliveCount, materializeFieldSpawnEvents, resolveFieldSpawnVictory } from "@/player/fieldSpawns";
import { eligibleEncounterEntries, pickWeightedEncounterTroop } from "@/player/encounters";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";
import { startSession } from "@/project/session";
import { mulberry32 } from "@/util/rng";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createPhase8bHuntingFixture, HUNTING_PROMOTED_CLASS_ID, HUNTING_PROMOTION_SWITCH_ID, phase8bPromotionEvent } from "./fixtures/huntingPhase8bFixture";
import type { ToolResult } from "@/editor/tools/types";
import type { EventPage } from "@/project/types";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { isolateTimers } from "./mergedTeardown";

// 재료 실패 힌트가 실패한 라벨을 다시 추천하던 순환(「"돌바닥" 없음 → 비슷한 라벨: "돌바닥"」) 을 끊는다.
// 2026-09-03 적대적 리뷰 01·05·14 — 조수가 같은 라벨로 재시도하다 잘못된 툴로 우회했다.
describe("materialHintFillable", () => {
  isolateTimers();
  // 재료 라벨(돌바닥·물·모래·흙길·목골 석벽 집 벽·탁자)은 합본 마을 칩셋 어휘다 — 정리 전 빈 프로젝트처럼 합본 마을 맵에서 잰다.
  const blankCombinedTownProject = () => withRetiredCombinedTownMaps(createBlankProject());
  const MAP_ID = "map_blank_start";
  describe("면 채우기 재료 힌트", () => {
    it("있는 라벨이지만 채울 수 없는 재료(돌바닥)는 이유와 채울 수 있는 재료를 준다", () => {
      const tileset = blankCombinedTownProject().tilesets[COMBINED_TOWN_TILESET_ID];
      const result = resolveMaterialByLabel(tileset, "돌바닥", { preferGroup: true, preferRoles: ["water", "terrain"], requireAutotileGroup: true });
      expect(result.status).toBe("missing");
      if (result.status !== "missing") return;
      expect(result.message).toContain("면 채우기 재료가 아닙니다");
      const labels = result.suggestions.map((suggestion) => suggestion.label);
      expect(labels).not.toContain("돌바닥");
      expect(labels.some((label) => /물|모래|흙길/u.test(label)), labels.join(",")).toBe(true);
    });

    it("fill_region 실패 문구는 실패한 라벨을 다시 추천하지 않고 채울 수 있는 재료를 든다", () => {
      const ctx: ToolContext = { project: blankCombinedTownProject() };
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 3, h: 3 }, material: "돌바닥" });
      expect(result.ok).toBe(false);
      expect(result.summary).not.toMatch(/비슷한 라벨[^:]*: "돌바닥"/u);
      expect(result.summary).toContain("채울 수 있는 재료");
      expect(result.summary).toMatch(/"물"|"모래"|"흙길"/u);
    });

    // qa-game mystery-3: 벽 재료로 fill_region 을 같은 인자로 11번 재시도했다 — 어느 도구로 갈지 알려 준다.
    it("벽 재료는 build_wall·build_hand_interior_room 으로, 가구는 place_props 로 보낸다", () => {
      const ctx: ToolContext = { project: blankCombinedTownProject() };
      const wall = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 3, h: 3 }, material: "목골 석벽 집 벽 확장" });
      expect(wall.ok).toBe(false);
      expect(wall.summary).toContain("build_wall");
      // place_concept 는 레지스트리에서 빠졌다 — 실내 전체는 build_hand_interior_room 으로 보낸다(tileVocabulary.notFillableRoute).
      expect(wall.summary).toContain("build_hand_interior_room");
      const table = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 3, h: 3 }, material: "탁자(가로)" });
      expect(table.ok).toBe(false);
      expect(table.summary).toMatch(/place_props|build_wall/u);
    });
  });
});

// 몬스터 수집 칩셋 계열 분리(2026-10-06 사용자 결정 「칩셋의 연속성」 + 톤 A).
// 밝은 monster_*, 에메랄드풍 emerald_monster_*, 버들항은 서로 다른 계열이라 한 게임에 섞이지 않는다.
describe("monsterKitFamily", () => {
  isolateTimers();
  beforeEach(() => resetMapEditHistory());
  function monsterProject() {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    return project;
  }
  describe("몬스터 칩셋 계열", () => {
    it("밝은 킷·에메랄드 재채색·버들항은 서로 다른 계열이다", () => {
      const project = createBlankProject();
      expect(tilesetFamily(project, "monster_overworld")).toBe("oprn-monster");
      expect(tilesetFamily(project, "monster_rooms")).toBe("oprn-monster");
      expect(tilesetFamily(project, "emerald_monster_overworld")).toBe("oprn-monster-emerald");
      expect(tilesetFamily(project, DEFAULT_TILESET_ID)).toBe("oprn-atlas");
    });

    it("몬스터 수집 새 프로젝트는 몬스터 풀밭에서 시작한다", () => {
      const start = monsterProject().maps.map_blank_start!;
      expect(start.tilesetId).toBe("monster_overworld");
      expect(start.tileSize).toBe(16);
    });

    it("손댄 시작 맵은 장르를 바꿔도 칩셋이 그대로다", () => {
      const project = createBlankProject();
      project.maps.map_blank_start!.lowerTiles[4] = 1;
      applyGenrePreset(project, "monster-collect");
      expect(project.maps.map_blank_start!.tilesetId).toBe(DEFAULT_TILESET_ID);
    });

    it("조수는 몬스터 맵에서 같은 계열의 실내 시트로는 새 맵을 만들고, 에메랄드·버들항으로는 못 만든다", () => {
      const ctx: ToolContext = { project: monsterProject(), currentMapId: "map_blank_start", assistantRun: true };
      const create = (id: string, tilesetId: string) =>
        runTool(ctx, "create_map", { id, name: id, width: 20, height: 15, tilesetId }, { dryRun: false });
      expect(create("map_room", "monster_rooms").ok).toBe(true);
      for (const [id, tilesetId] of [["map_emerald", "emerald_monster_overworld"], ["map_town", DEFAULT_TILESET_ID]] as const) {
        const result = create(id, tilesetId);
        expect(result.ok, tilesetId).toBe(false);
        expect(ctx.project.maps[id], tilesetId).toBeUndefined();
      }
    });

    it("폐기 EasyRPG 칩셋 거부는 같은 계열 몬스터 시트를 대안으로 알려 준다", () => {
      // 거부 경로는 폐기 칩셋 정의를 아직 들고 있는 옛 저장본에서 탄다 — 정리 뒤 새 프로젝트에는 그 정의가 없어 「타일셋 없음」으로 먼저 끝난다.
      const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(monsterProject()), currentMapId: "map_blank_start", assistantRun: true };
      const result = runTool(ctx, "create_map", { id: "map_cave", name: "동굴", width: 20, height: 15, tilesetId: "easyrpg_chipset_dungeon" }, { dryRun: false });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.message).toContain("monster_dungeon");
    });

    it("build_monster_game 은 사람이 고른 출연진을 까는 도구라 캐릭터 선택 검사 대상이 아니다", () => {
      expect(getTool("build_monster_game")?.placesCuratedCast).toBe(true);
    });

    it("빈 시작 맵을 캠페인으로 갈아 끼우는 것은 맵 소실이 아니다 — 칠한 맵은 여전히 소실", () => {
      const before = monsterProject();
      const after = structuredClone(before);
      delete after.maps.map_blank_start;
      expect(removedMapIds(before, after)).toEqual([]);
      before.maps.map_blank_start!.lowerTiles[3] = 4;
      expect(removedMapIds(before, after)).toEqual(["map_blank_start"]);
    });
  });
});

describe("phase8bHuntingRuntime", () => {
  isolateTimers();
  describe("Phase 8b hunting encounters", () => {
    it("selects weighted encounter entries with a fixed seeded distribution", () => {
      const rng = mulberry32(20260709);
      const counts: Record<string, number> = { a: 0, b: 0 };
      for (let index = 0; index < 4000; index += 1) {
        const troopId = pickWeightedEncounterTroop([
          { troopId: "a", weight: 1 },
          { troopId: "b", weight: 3 },
        ], rng);
        if (troopId) counts[troopId] += 1;
      }

      const ratio = counts.b / counts.a;
      expect(ratio).toBeGreaterThan(2.7);
      expect(ratio).toBeLessThan(3.3);
    });

    it("filters encounters by switch, variable, party level, and region", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      const hero = project.database.actors[0];
      if (!map || !hero) throw new Error("fixture missing");
      project.switches.push({ id: "sw_gate", name: "게이트" });
      project.variables.push({ id: "var_rank", name: "사냥 등급" });
      map.encounterTable = [
        { troopId: "troop_base", weight: 1 },
        { troopId: "troop_switch", weight: 1, conditions: { switchId: "sw_gate" } },
        { troopId: "troop_variable", weight: 1, conditions: { variableId: "var_rank", atLeast: 2 } },
        { troopId: "troop_level", weight: 1, conditions: { minPartyLevel: 5 } },
        { troopId: "troop_region", weight: 1, conditions: { region: { x: 4, y: 0, w: 3, h: 3 } } },
      ];
      const session = startSession(project, 1);
      session.partyActorIds = [hero.id];
      session.actorLevels[hero.id] = 1;

      expect(eligibleEncounterEntries(map, session, { x: 1, y: 1 }).map((entry) => entry.troopId)).toEqual(["troop_base"]);

      session.switches.sw_gate = true;
      session.variables.var_rank = 2;
      session.actorLevels[hero.id] = 5;
      expect(eligibleEncounterEntries(map, session, { x: 5, y: 1 }).map((entry) => entry.troopId)).toEqual([
        "troop_base",
        "troop_switch",
        "troop_variable",
        "troop_level",
        "troop_region",
      ]);
    });
  });
  describe("Phase 8b field spawns", () => {
    it("respects maxAlive, respawnSec, and deterministic passable-cell selection", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      const troopId = project.database.troops[0]?.id;
      if (!map || !troopId) throw new Error("fixture missing");
      map.lowerTiles[1] = TILE.WALL;
      map.fieldSpawns = [{ id: "spawn_test", troopId, area: { x: 0, y: 0, w: 4, h: 1 }, maxAlive: 2, respawnSec: 2 }];

      const state = createFieldSpawnRuntime(project, map, { x: 0, y: 0 });
      expect(materializeFieldSpawnEvents(state).map((event) => [event.x, event.y])).toEqual([[2, 0], [3, 0]]);

      const firstEventId = materializeFieldSpawnEvents(state)[0]?.id;
      expect(firstEventId).toBeDefined();
      resolveFieldSpawnVictory(state, firstEventId ?? "");
      expect(fieldSpawnAliveCount(state)).toBe(1);

      expect(advanceFieldSpawns(state, project, map, { x: 0, y: 0 }, 1000)).toBe(false);
      expect(fieldSpawnAliveCount(state)).toBe(1);
      expect(advanceFieldSpawns(state, project, map, { x: 0, y: 0 }, 1000)).toBe(true);
      expect(materializeFieldSpawnEvents(state).map((event) => [event.x, event.y])).toEqual([[3, 0], [2, 0]]);
    });

    it("does not serialize field spawn runtime state and starts fresh after load", () => {
      const project = createPhase8bHuntingFixture();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("fixture missing");
      const session = startSession(project, 1);
      const state = createFieldSpawnRuntime(project, map, { x: session.x, y: session.y });
      const firstEventId = materializeFieldSpawnEvents(state)[0]?.id;
      resolveFieldSpawnVictory(state, firstEventId ?? "");
      expect(fieldSpawnAliveCount(state)).toBe(2);

      const snapshot = createSaveSnapshot(project, session);
      expect(JSON.stringify(snapshot)).not.toContain("__field_spawn__");
      const restored = applySaveSnapshot(project, snapshot);
      const fresh = createFieldSpawnRuntime(project, map, { x: restored.x, y: restored.y });
      expect(fieldSpawnAliveCount(fresh)).toBe(3);
    });
  });
  describe("Phase 8b hunting tools and scene integration", () => {
    it("set_encounter_table and make_hunting_ground validate and write map hunting data", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const troopId = context.project.database.troops[0]?.id;
      if (!troopId) throw new Error("troop missing");

      const table = runTool(context, "set_encounter_table", {
        mapId,
        entries: [{ troopId, weight: 2, conditions: { region: { x: 0, y: 0, w: 4, h: 4 } } }],
      });
      expect(table.ok, table.summary).toBe(true);
      expect(context.project.maps[mapId]?.encounterTable).toHaveLength(1);
      expect(runTool(context, "set_encounter_table", { mapId, entries: [{ troopId: "ghost", weight: 1 }] }).ok).toBe(false);

      const hunting = runTool(context, "make_hunting_ground", {
        mapId,
        area: { x: 1, y: 1, w: 3, h: 3 },
        troopId,
        maxAlive: 2,
        respawnSec: 4,
        chase: true,
      });
      expect(hunting.ok, hunting.summary).toBe(true);
      expect(context.project.maps[mapId]?.fieldSpawns?.[0]).toMatchObject({ troopId, maxAlive: 2, respawnSec: 4, chase: true });
    });

    it("run_scene_test enters battle on field-spawn contact, removes the spawn on victory, then respawns", () => {
      const project = createPhase8bHuntingFixture();
      const result = runSceneTest(project, {
        mapId: project.startMapId,
        start: { x: 1, y: 1 },
        steps: [
          { kind: "expect", fieldSpawnCount: 3 },
          { kind: "move", dir: "right" },
          { kind: "expect", fieldSpawnCount: 2 },
          { kind: "wait", ticks: 63 },
          { kind: "expect", fieldSpawnCount: 3 },
        ],
      });

      expect(result.ok, result.failureReason).toBe(true);
      expect(result.session.battleResult).toBe("victory");
    });

    it("hunts repeatedly to level 5 and succeeds at first promotion headlessly", () => {
      const project = createPhase8bHuntingFixture();
      const map = project.maps[project.startMapId];
      const hero = project.database.actors[0];
      if (!map || !hero) throw new Error("fixture missing");
      map.events.push(phase8bPromotionEvent(hero.id));

      const steps = [
        { kind: "move" as const, dir: "right" as const },
        { kind: "wait" as const, ticks: 63 },
        { kind: "move" as const, dir: "right" as const },
        { kind: "wait" as const, ticks: 63 },
        { kind: "move" as const, dir: "right" as const },
        { kind: "wait" as const, ticks: 63 },
        { kind: "move" as const, dir: "right" as const },
        { kind: "interact" as const },
        { kind: "expect" as const, switchOn: HUNTING_PROMOTION_SWITCH_ID },
      ];
      const result = runSceneTest(project, { mapId: project.startMapId, start: { x: 1, y: 1 }, steps });

      expect(result.ok, result.failureReason).toBe(true);
      expect(result.session.actorLevels[hero.id]).toBe(5);
      expect(result.session.classOverrides[hero.id]).toBe(HUNTING_PROMOTED_CLASS_ID);
    });
  });
});

describe("placeNpcMalformedPage", () => {
  isolateTimers();
  function runPlaceNpc(id: string, page: Record<string, unknown>): { context: ToolContext; result: ToolResult; page: EventPage | undefined } {
    const context: ToolContext = { project: createBlankProject() };
    const result = runTool(context, "place_npc", {
      mapId: context.project.startMapId,
      x: 2,
      y: 2,
      id,
      name: "리나",
      graphic: { transparent: true },
      pages: [page],
    });
    const map = context.project.maps[context.project.startMapId];
    const event = map?.events.find((entry) => entry.id === id);
    return { context, result, page: event?.pages?.[0] };
  }
  function firstIssueMessage(result: ToolResult): string {
    return result.issues?.[0]?.message ?? "";
  }
  describe("place_npc SimplePage malformed input normalization", () => {
    it("normalizes a missing command kind from the command alias", () => {
      const { result, page } = runPlaceNpc("npc_kind_alias", {
        commands: [{ command: "text", body: "어서 와." }],
      });

      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("SimplePage 정규화 경고");
      expect(result.diff?.warnings.join("\n")).toContain("pages[0].commands[0].command 문자열을 kind로 사용");
      expect(page?.commands).toContainEqual({ kind: "text", body: "어서 와." });
    });

    it("normalizes an object command kind from kind.command", () => {
      const { result, page } = runPlaceNpc("npc_kind_object_alias", {
        commands: [{ kind: { command: "text" }, body: "오늘은 장터가 조용해." }],
      });

      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("SimplePage 정규화 경고");
      expect(result.diff?.warnings.join("\n")).toContain("pages[0].commands[0].kind.command 문자열을 kind로 사용");
      expect(page?.commands).toContainEqual({ kind: "text", body: "오늘은 장터가 조용해." });
    });

    it("wraps a single conditions object into an array", () => {
      const { result, page } = runPlaceNpc("npc_single_condition", {
        conditions: { kind: "selfSwitch", key: "A", value: true },
        lines: ["비밀을 지켜줘."],
      });

      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("SimplePage 정규화 경고");
      expect(result.diff?.warnings.join("\n")).toContain("pages[0].conditions 단수 객체를 배열로 감쌌습니다");
      expect(page?.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
    });

    it("normalizes null conditions to an empty array", () => {
      const { result, page } = runPlaceNpc("npc_null_condition", {
        conditions: null,
        lines: ["조건 없는 페이지야."],
      });

      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("SimplePage 정규화 경고");
      expect(result.diff?.warnings.join("\n")).toContain("pages[0].conditions null을 빈 배열로 처리했습니다");
      expect(page?.conditions).toEqual([]);
    });
    it("normalizes empty object conditions {} to an empty array", () => {
      const { result, page } = runPlaceNpc("npc_empty_object_condition", {
        conditions: {},
        lines: ["조건 없음."],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(page?.conditions).toEqual([]);
      expect(result.diff?.warnings.join("\n") ?? "").toMatch(/빈\/없음 조건|정규화/);
    });

    it("normalizes conditions kind none to an empty array", () => {
      const { result, page } = runPlaceNpc("npc_kind_none_condition", {
        conditions: { kind: "none" },
        commands: [{ kind: "text", text: "크르르...!" }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(page?.conditions).toEqual([]);
    });

    it("normalizes LLM self-switch id aliases and boolean strings in conditions and choice commands", () => {
      const { result, page } = runPlaceNpc("npc_self_switch_aliases", {
        conditions: [{ kind: "selfSwitch", id: "A", value: "true" }],
        choices: [{
          text: "선택",
          commands: [{ kind: "setSelfSwitch", id: "A", value: "true" }],
        }],
      });

      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(page?.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
      const choices = page?.commands.find((command) => command.kind === "choices");
      expect(choices).toMatchObject({
        options: [{ branch: [{ kind: "setSelfSwitch", key: "A", value: true }] }],
      });
      const warnings = result.diff?.warnings.join("\n") ?? "";
      expect(warnings).toContain("selfSwitch.key");
      expect(warnings).toContain("boolean");
    });

    it("registers missing global switches referenced by nested choice commands", () => {
      const { context, result } = runPlaceNpc("npc_global_switch", {
        choices: [{
          text: "진실을 선택한다",
          commands: [{ kind: "setSwitch", switchId: "ending_flag", value: true }],
        }],
      });

      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(context.project.switches).toContainEqual(expect.objectContaining({ id: "ending_flag" }));
      expect(context.project.session.switches.ending_flag).toBe(false);
      expect(result.diff?.warnings.join("\n") ?? "").toContain("미등록 switchId 자동 생성: ending_flag");
    });

    it("updates an explicit event id in place without treating itself as an occupied cell", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const first = runTool(context, "place_npc", {
        mapId, x: 2, y: 2, id: "npc_in_place", name: "리나",
        graphic: { transparent: true }, pages: [{ lines: ["처음 대사"] }],
      });
      const second = runTool(context, "place_npc", {
        mapId, x: 2, y: 2, id: "npc_in_place", name: "리나",
        graphic: { transparent: true }, pages: [{ lines: ["수정 대사"] }],
      });

      expect(first.ok).toBe(true);
      expect(second.ok, JSON.stringify(second.issues)).toBe(true);
      expect(second.data).toMatchObject({ x: 2, y: 2, adjusted: false });
      expect(context.project.maps[mapId]?.events.filter((event) => event.id === "npc_in_place")).toHaveLength(1);
    });

    it("moves a transfer endpoint to a nearby usable cell when the requested doorway has no landing", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapAId = context.project.startMapId;
      expect(runTool(context, "create_map", { id: "transfer_target", name: "실내", width: 20, height: 15 }).ok).toBe(true);
      const mapA = context.project.maps[mapAId]!;
      for (let y = 4; y <= 6; y += 1) {
        for (let x = 4; x <= 6; x += 1) mapA.lowerTiles[y * mapA.width + x] = TILE.WATER;
      }

      const result = runTool(context, "create_transfer_pair", {
        a: { mapId: mapAId, x: 5, y: 5 },
        b: { mapId: "transfer_target", x: 2, y: 2 },
        fade: "black",
      });

      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(result.data).toMatchObject({ adjustedA: true, adjustedB: false });
      expect(result.diff?.warnings.join("\n") ?? "").toContain("출입구 A 위치 자동 조정");
    });

    it("returns a model-friendly error when command kind is an unrecoverable object", () => {
      const { result } = runPlaceNpc("npc_bad_kind_object", {
        commands: [{ kind: { value: "text" }, body: "안녕" }],
      });

      expect(result.ok).toBe(false);
      const message = firstIssueMessage(result);
      expect(message).toContain("필드: pages[0].commands[0].kind");
      expect(message).toContain("기대 타입: string");
      expect(message).toContain("실제 타입: object");
      expect(message).toContain("최소 예시:");
    });

    it("returns a model-friendly error when conditions is not iterable or an object", () => {
      const { result } = runPlaceNpc("npc_bad_conditions", {
        conditions: "sw_ready",
        lines: ["조건이 잘못됐어."],
      });

      expect(result.ok).toBe(false);
      const message = firstIssueMessage(result);
      expect(message).toContain("필드: pages[0].conditions");
      expect(message).toContain("기대 타입: array<EventPageCondition> 또는 EventPageCondition object");
      expect(message).toContain("실제 타입: string");
      expect(message).toContain("최소 예시:");
    });

    it("live 2026-08-25: changeGold without op defaults to += so quest reward pages persist", () => {
      const { result, page } = runPlaceNpc("ev_mayor_lost_ring", {
        lines: ["그 반지! 정말 고맙네. 약속한 100골드네."],
        commands: [{ kind: "changeGold", amount: 100 }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(page?.commands).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "changeGold", amount: 100, op: "+=" }),
      ]));
    });

    it("live 2026-08-25: 촌장 선택지 setSwitch 페이지는 그대로 배치된다", () => {
      const { result, context } = runPlaceNpc("ev_mayor_lost_ring", {
        lines: ["여행자여, 내가 아끼던 반지를 잃어버렸네.", "마을 우물 근처에서 떨어뜨린 것 같아. 찾아오면 100골드를 주겠네."],
        choices: [
          {
            text: "찾아보겠습니다",
            commands: [
              { kind: "setSwitch", switchId: "sw_lost_ring_active", value: true },
              { kind: "text", text: "고맙네. 우물을 자세히 살펴봐 주게." },
            ],
          },
          {
            text: "지금은 어렵습니다",
            commands: [{ kind: "text", text: "마음이 바뀌면 다시 찾아오게." }],
          },
        ],
      });
      expect(result.ok, result.summary).toBe(true);
      const event = context.project.maps[context.project.startMapId]?.events.find((entry) => entry.id === "ev_mayor_lost_ring");
      expect(event).toBeTruthy();
      expect(event?.pages[0]?.name).toBe("리나");
    });

    it("더 높은 엔딩 문턱이 있으면 낮은 호감 페이지가 상승 대사를 덮지 않는다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const variableId = context.project.variables[0]!.id;
      context.project.endings = [{
        id: "ending_love", name: "고백", priority: 10,
        conditions: [{ kind: "variable", variableId, op: ">=", value: 6 }],
      }];
      const result = runTool(context, "place_npc", {
        mapId: context.project.startMapId,
        x: 4, y: 4, id: "npc_narae", name: "설나래",
        graphic: { transparent: true },
        pages: [
          { choices: [{ text: "맞장구", commands: [{ kind: "setVariable", variableId, op: "+=", value: 2 }] }] },
          {
            conditions: [{ kind: "variable", variableId, op: ">=", value: 4 }],
            choices: [{ text: "옥상으로", commands: [{ kind: "text", text: "올라가자" }] }],
          },
        ],
      }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const event = context.project.maps[context.project.startMapId]?.events.find((entry) => entry.id === "npc_narae");
      expect(event?.pages).toHaveLength(1);
      const body = JSON.stringify(event?.pages[0]?.commands);
      expect(body).toContain("+=",);
      expect(body).toContain("올라가자");
      expect(result.diff?.warnings?.join("\n") ?? "").toContain("조건 분기");
    });
  });
});

// place_props 는 소품만 산포한다 — 바닥·벽·건물 재료가 들어오면 거절하고 면 채우기 툴로 보낸다.
// 2026-09-03 적대적 리뷰 01: 「돌바닥 3x3」이 fill 실패 뒤 place_props 로 통행 불가 타일 6칸이 됐다.
describe("placePropsRejectsFloorMaterial", () => {
  isolateTimers();
  // 합본 마을 타일 번호·재료(돌벽=12, 팻말, 침엽수)를 겨냥한 시험 — 2026-10-07 저작권 정리 뒤 새 프로젝트 시작 맵은 버들항이라 옛 저장본처럼 합본 마을 위에서 시작한다.
  const createBlankProject = () => startOnRetiredCombinedTown(createBlankDefaultProject());
  const MAP_ID = "map_blank_start";
  describe("place_props 재료 역할 게이트", () => {
    it("바닥/건물 재료(돌바닥)는 소품으로 산포하지 않는다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 5, y: 4, w: 3, h: 3 }, material: "돌바닥", count: 9 });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("material-not-prop");
      expect(result.summary).toContain("fill_region");
      const map = ctx.project.maps[MAP_ID];
      for (let y = 4; y < 7; y += 1) for (let x = 5; x < 8; x += 1) expect(map.lowerTiles[y * map.width + x]).toBe(TILE.GRASS);
    });

    it("소품 재료(침엽수)는 그대로 산포한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 3, y: 3, w: 8, h: 6 }, material: "침엽수", count: 3 });
      expect(result.ok, result.summary).toBe(true);
    });
  });
});

describe("previewHouse", () => {
  isolateTimers();
  type NumberGrid = readonly (readonly number[])[];
  type PreviewHouseData = {
    readonly lower: NumberGrid;
    readonly upper: NumberGrid;
    readonly door: {
      readonly x: number;
      readonly y: number;
    };
  };
  type MapRegionData = {
    readonly grid: readonly string[];
  };
  function recordField(value: unknown, key: string): unknown {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    return Reflect.get(value, key);
  }
  function isNumberGrid(value: unknown): value is NumberGrid {
    return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((cell) => Number.isInteger(cell)));
  }
  function isDoor(value: unknown): value is PreviewHouseData["door"] {
    return Number.isInteger(recordField(value, "x")) && Number.isInteger(recordField(value, "y"));
  }
  function isPreviewHouseData(value: unknown): value is PreviewHouseData {
    return isNumberGrid(recordField(value, "lower")) && isNumberGrid(recordField(value, "upper")) && isDoor(recordField(value, "door"));
  }
  function isMapRegionData(value: unknown): value is MapRegionData {
    const grid = recordField(value, "grid");
    return Array.isArray(grid) && grid.every((row) => typeof row === "string");
  }
  describe("preview_house", () => {
    it("집 미리보기 그리드를 돌려주고 실제 맵은 바꾸지 않는다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const created = runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 20 });
      expect(created.ok, created.summary).toBe(true);

      const result = runTool(ctx, "preview_house", {
        mapId: "m1",
        origin: { x: 2, y: 2 },
        width: 6,
        height: 7,
        material: "plaster",
      });

      expect(result.ok, result.summary).toBe(true);
      if (!isPreviewHouseData(result.data)) throw new Error("preview_house data shape mismatch");
      expect(result.data.lower).toHaveLength(7);
      expect(result.data.upper).toHaveLength(7);
      for (const row of result.data.lower) expect(row).toHaveLength(6);
      for (const row of result.data.upper) expect(row).toHaveLength(6);
      expect(result.data.door).toEqual({ x: expect.any(Number), y: expect.any(Number) });
      expect([...result.data.lower.flat(), ...result.data.upper.flat()].some((tile) => tile !== TILE.EMPTY && tile !== TILE.GRASS)).toBe(true);

      const region = runTool(ctx, "get_map_region", { mapId: "m1", x: 2, y: 2, w: 6, h: 7 });
      expect(region.ok, region.summary).toBe(true);
      if (!isMapRegionData(region.data)) throw new Error("get_map_region data shape mismatch");
      expect(region.data.grid).toEqual(Array.from({ length: 7 }, () => ".".repeat(6)));
    });
  });
});
