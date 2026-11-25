import { describe, expect, it } from "vitest";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { THIS_EVENT_MOVE_TARGET, buildEventTargetCatalog, canonicalMoveTargetValue, matchEventTargets, moveTargetIssueMessage, moveTargetPromptSection, resolveMoveTarget } from "@/project/eventTargetCatalog";
import { buildEventAssistPrompt, parseAndValidate } from "@/ai/eventCommandAssist";
import { createBlankProject } from "@/project/defaults";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, Project, ProjectFactions } from "@/project/types";
import { DEFAULT_ENEMY_FACTION_ID, factionAggression, factionColor, factionName, factionStance, isHittableByFaction, isProtectedFromNpcs, normalizeProjectFactions, PLAYER_FACTION_ID, resolveFactionTable, stanceBarColor, willAttackOnSight } from "@/project/factions";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";

// test/moveRouteEventTarget.test.ts
//
// OPRN-OUT-012 — moveEvent 「누구를」 대상의 공용 카탈로그·해석기.
//
// 재현된 결함: 조수가 `{"kind":"moveEvent","eventId":"this"}` 를 내면 검증을 전부 통과하고
// 저장돼, 스튜디오에는 «이동 경로 설정 this (없음)» 으로 보이고 테스트 플레이에서는
// 대상 NPC 가 움직이지 않았다(runtime 은 "this" 라는 이름의 이벤트를 찾다 실패한다).
//
// 이 파일이 못 박는 것:
//  1. 카탈로그가 현재 맵 이벤트를 이름+정본 id 로 열거하고 특수값 둘을 정확히 말한다.
//  2. 해석기가 `this`·이름 같은 비정본 값을 정본값으로 옮기고, 못 옮기면 실행 가능한 오류를 낸다.
//  3. 조수 출력 검증이 적용 **전에** 그 오류를 내서 자가수정 루프가 고칠 수 있다.
//  4. 테스트 플레이(런타임)에서 정본 id 는 대상 이벤트를 실제로 움직이고 `this` 는 못 움직인다.
describe("moveRouteEventTarget", () => {
  isolateTimers();
  function pageNamed(name: string): EventPage {
    return {
      id: `pg_${name}`,
      name,
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function eventNamed(id: string, name: string, x: number, y: number): GameEvent {
    return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [pageNamed(name)] };
  }
  /** 문지기 / 상인 / 이름이 겹치는 경비 둘이 있는 맵. */
  function projectWithEvents(): Project {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.events = [
      eventNamed("ev_npc_gate", "문지기", 3, 4),
      eventNamed("ev_npc_merchant", "상인", 8, 2),
      eventNamed("ev_npc_guard_a", "경비", 1, 1),
      eventNamed("ev_npc_guard_b", "경비", 9, 9),
    ];
    store.replace(project);
    return project;
  }
  describe("이벤트 대상 카탈로그", () => {
    it("현재 맵 이벤트를 이름과 정본 id 로 함께 열거한다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(catalog.entries.map((entry) => entry.id)).toEqual([
        "ev_npc_gate",
        "ev_npc_merchant",
        "ev_npc_guard_a",
        "ev_npc_guard_b",
      ]);
      expect(catalog.entries[0].name).toBe("문지기");
    });

    it("이름이 겹치는 이벤트는 좌표로 구분되는 라벨을 갖는다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const guards = catalog.entries.filter((entry) => entry.name === "경비");
      expect(guards).toHaveLength(2);
      expect(guards[0].label).not.toBe(guards[1].label);
      expect(guards[0].label).toContain("경비");
      expect(guards[0].label).toContain("1");
      // 겹치지 않는 이름은 꾸미지 않는다.
      expect(catalog.entries[0].label).toBe("문지기");
    });

    it("특수값 둘의 저장 형태를 그대로 유지한다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(THIS_EVENT_MOVE_TARGET).toBe("");
      expect(resolveMoveTarget("", catalog)).toMatchObject({ kind: "this", storedValue: "" });
      expect(resolveMoveTarget(PLAYER_MOVE_TARGET, catalog)).toMatchObject({
        kind: "player",
        storedValue: PLAYER_MOVE_TARGET,
      });
    });

    it("정본 id 는 항목과 함께 해석된다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const resolved = resolveMoveTarget("ev_npc_merchant", catalog);
      expect(resolved.kind).toBe("event");
      if (resolved.kind !== "event") throw new Error("expected event target");
      expect(resolved.entry.name).toBe("상인");
      expect(resolved.storedValue).toBe("ev_npc_merchant");
    });

    it("«this» 같은 비정본 낱말을 이 이벤트 특수값으로 옮긴다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      for (const alias of ["this", "This", " self ", "@this"]) {
        expect(resolveMoveTarget(alias, catalog), alias).toMatchObject({ kind: "this", storedValue: "" });
        expect(canonicalMoveTargetValue(alias, catalog), alias).toBe("");
      }
      for (const alias of ["player", "주인공", "@Player"]) {
        expect(canonicalMoveTargetValue(alias, catalog), alias).toBe(PLAYER_MOVE_TARGET);
      }
    });

    it("유일한 표시 이름은 정본 id 로 옮기고, 겹치는 이름은 모호로 반려한다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(canonicalMoveTargetValue("문지기", catalog)).toBe("ev_npc_gate");
      const ambiguous = resolveMoveTarget("경비", catalog);
      expect(ambiguous.kind).toBe("unresolved");
      if (ambiguous.kind !== "unresolved") throw new Error("expected unresolved");
      expect(ambiguous.reason).toBe("ambiguous");
      expect(ambiguous.candidates.map((entry) => entry.id)).toEqual(["ev_npc_guard_a", "ev_npc_guard_b"]);
      expect(canonicalMoveTargetValue("경비", catalog)).toBeNull();
    });

    it("다른 맵의 이벤트 id 는 남의 맵임을 지목한다(이동 경로는 현재 맵만 움직인다)", () => {
      const project = projectWithEvents();
      project.maps.map_far = {
        ...project.maps[project.startMapId],
        id: "map_far",
        name: "먼 마을",
        events: [eventNamed("ev_npc_far", "뱃사공", 2, 2)],
      };
      store.replace(project);
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const resolved = resolveMoveTarget("ev_npc_far", catalog);
      expect(resolved.kind).toBe("unresolved");
      if (resolved.kind !== "unresolved") throw new Error("expected unresolved");
      expect(resolved.reason).toBe("foreignMap");
      expect(moveTargetIssueMessage("ev_npc_far", catalog)).toContain("먼 마을");
    });

    it.each(["self", "player", "문지기"])("does not reinterpret the foreign ID %s as a local alias or name", (id) => {
      const project = projectWithEvents();
      project.maps.map_far = {
        ...project.maps[project.startMapId], id: "map_far", name: "Far map",
        events: [eventNamed(id, "Foreign event", 2, 2)],
      };
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(resolveMoveTarget(id, catalog)).toMatchObject({
        kind: "unresolved", reason: "foreignMap", storedValue: id, foreign: { id, mapId: "map_far" },
      });
      expect(canonicalMoveTargetValue(id, catalog)).toBeNull();
      const parsed = parseAndValidate(project, JSON.stringify([
        { kind: "moveEvent", eventId: id, route: { moves: [], repeat: false } },
      ]), { mapId: project.startMapId });
      expect(parsed.ok).toBe(false);

      project.maps[project.startMapId].events.push(eventNamed(id, "Local exact ID", 1, 2));
      expect(resolveMoveTarget(id, buildEventTargetCatalog(project, project.startMapId))).toMatchObject({
        kind: "event", storedValue: id, entry: { id, name: "Local exact ID" },
      });
    });

    it("모르는 값은 실행 가능한 진단 문구를 낸다 — 특수값 둘과 후보 id 를 함께 말한다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const message = moveTargetIssueMessage("ev_ghost", catalog);
      expect(message).toContain("ev_ghost");
      expect(message).toContain(PLAYER_MOVE_TARGET);
      expect(message).toContain("ev_npc_gate");
    });

    it("검색은 표시 이름과 id 를 모두 맞춘다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(matchEventTargets(catalog, "상인").map((entry) => entry.id)).toEqual(["ev_npc_merchant"]);
      expect(matchEventTargets(catalog, "guard_b").map((entry) => entry.id)).toEqual(["ev_npc_guard_b"]);
      expect(matchEventTargets(catalog, "").map((entry) => entry.id)).toHaveLength(4);
      expect(matchEventTargets(catalog, "없는것")).toEqual([]);
    });

    it("프롬프트 절이 특수값 둘과 현재 맵 이벤트 목록을 함께 싣는다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const section = moveTargetPromptSection(catalog);
      expect(section).toContain(PLAYER_MOVE_TARGET);
      expect(section).toContain("ev_npc_gate");
      expect(section).toContain("문지기");
      // 실제로 났던 오작동을 이름으로 금지한다.
      expect(section).toContain("this");
    });
  });
  describe("조수 moveEvent 대상 검증", () => {
    it("프롬프트에 이동 대상 프로토콜 절이 들어간다", () => {
      const project = projectWithEvents();
      const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId });
      expect(prompt).toContain("ev_npc_gate");
      expect(prompt).toContain(PLAYER_MOVE_TARGET);
    });

    it("«this» 대상을 적용 전에 이 이벤트 특수값으로 정본화한다", () => {
      const project = projectWithEvents();
      const result = parseAndValidate(
        project,
        JSON.stringify([{ kind: "moveEvent", eventId: "this", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } }]),
        { mapId: project.startMapId },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join(" / "));
      expect((result.commands[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe("");
    });

    it("이름으로 지목한 대상을 정본 id 로 옮긴다", () => {
      const project = projectWithEvents();
      const result = parseAndValidate(
        project,
        JSON.stringify([{ kind: "moveEvent", eventId: "상인", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } }]),
        { mapId: project.startMapId },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join(" / "));
      expect((result.commands[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe("ev_npc_merchant");
    });

    it("해석 불가 대상은 자가수정 루프가 읽을 오류로 반려한다", () => {
      const project = projectWithEvents();
      const result = parseAndValidate(
        project,
        JSON.stringify([{ kind: "moveEvent", eventId: "ev_does_not_exist", route: { moves: [], repeat: false } }]),
        { mapId: project.startMapId },
      );
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unresolved target must be rejected");
      expect(result.errors.join(" ")).toContain("moveEvent");
      expect(result.errors.join(" ")).toContain("ev_does_not_exist");
      expect(result.errors.join(" ")).toContain("ev_npc_gate");
    });

    it("중첩 분기 안의 대상도 검사한다", () => {
      const project = projectWithEvents();
      const nested = parseAndValidate(
        project,
        JSON.stringify([
          {
            kind: "fork",
            condition: { kind: "selfSwitch", key: "A", value: true },
            then: [{ kind: "moveEvent", eventId: "this", route: { moves: [], repeat: false } }],
          },
        ]),
        { mapId: project.startMapId },
      );
      expect(nested.ok).toBe(true);
      if (!nested.ok) throw new Error(nested.errors.join(" / "));
      const fork = nested.commands[0] as Extract<Command, { kind: "fork" }>;
      expect((fork.then[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe("");
    });

    it("주인공 특수값은 그대로 통과한다", () => {
      const project = projectWithEvents();
      const result = parseAndValidate(
        project,
        JSON.stringify([
          { kind: "moveEvent", eventId: PLAYER_MOVE_TARGET, route: { moves: [{ kind: "move", dir: "up" }], repeat: false } },
        ]),
        { mapId: project.startMapId },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join(" / "));
      expect((result.commands[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe(PLAYER_MOVE_TARGET);
    });
  });
  describe("테스트 플레이에서의 이동 대상", () => {
    function moverScene(project: Project) {
      const map = project.maps[project.startMapId];
      return {
        map,
        session: startSession(project),
        eventPositions: initialRuntimeEventPositions(map.events),
        autonomousNPCs: new Map(),
      };
    }

    it("정본 id 는 그 이벤트를 실제로 움직인다", () => {
      const project = projectWithEvents();
      const scene = moverScene(project);
      registerAutonomousMover(scene, "ev_npc_merchant", [{ kind: "move", dir: "up" }], false);
      expect(scene.autonomousNPCs.has("ev_npc_merchant")).toBe(true);
    });

    it("«this» 는 어떤 이벤트도 움직이지 않는다 — 이 결함이 보고된 증상이다", () => {
      const project = projectWithEvents();
      const scene = moverScene(project);
      registerAutonomousMover(scene, "this", [{ kind: "move", dir: "up" }], false);
      expect(scene.autonomousNPCs.size).toBe(0);
    });

    it("정본화를 거친 조수 출력은 테스트 플레이에서 대상을 움직인다", () => {
      const project = projectWithEvents();
      const parsed = parseAndValidate(
        project,
        JSON.stringify([
          { kind: "moveEvent", eventId: "상인", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } },
        ]),
        { mapId: project.startMapId },
      );
      if (!parsed.ok) throw new Error(parsed.errors.join(" / "));
      const command = parsed.commands[0] as Extract<Command, { kind: "moveEvent" }>;
      const scene = moverScene(project);
      registerAutonomousMover(scene, command.eventId, command.route.moves, command.route.repeat);
      expect(scene.autonomousNPCs.has("ev_npc_merchant")).toBe(true);
    });
  });
});

describe("factionStance", () => {
  isolateTimers();
  const TWO_SIDES: ProjectFactions = {
    defs: [
      { id: "bandit", name: "산적", color: "#b3543f" },
      { id: "guard", name: "경비병", color: "#4f7fc0" },
    ],
    relations: [{ a: "bandit", b: "guard", stance: -1 }],
  };
  describe("faction stance table", () => {
    it("keeps legacy behaviour when no factions are authored", () => {
      const table = resolveFactionTable(undefined);
      expect(factionStance(table, PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID)).toBe(-1);
      expect(factionStance(table, DEFAULT_ENEMY_FACTION_ID, DEFAULT_ENEMY_FACTION_ID)).toBe(2);
    });

    it("defaults unauthored pairs to neutral and same faction to ally", () => {
      const table = resolveFactionTable(TWO_SIDES);
      expect(factionStance(table, "bandit", "guard")).toBe(-1);
      expect(factionStance(table, "bandit", "bandit")).toBe(2);
      expect(factionStance(table, PLAYER_FACTION_ID, "bandit")).toBe(0);
      expect(factionStance(table, PLAYER_FACTION_ID, "guard")).toBe(0);
    });

    it("takes the more hostile direction when the authored pair disagrees", () => {
      const table = resolveFactionTable({
        defs: TWO_SIDES.defs,
        relations: [{ a: "bandit", b: "guard", stance: 1 }],
      });
      // 저작은 대칭으로 쓰지만, 행렬 자체는 방향성이라 한쪽만 적대로 손댄 데이터도 적대로 읽어야 한다.
      const asymmetric = resolveFactionTable(TWO_SIDES);
      asymmetric.stances[asymmetric.ids.indexOf("guard") * asymmetric.size + asymmetric.ids.indexOf("bandit")] = 2;
      expect(factionStance(table, "bandit", "guard")).toBe(1);
      expect(factionStance(asymmetric, "bandit", "guard")).toBe(-1);
      expect(factionStance(asymmetric, "guard", "bandit")).toBe(-1);
    });

    it("keeps the more hostile stance when the same pair is authored twice in either order", () => {
      const hostile = { a: "guard", b: "bandit", stance: -2 } as const;
      const allied = { a: "bandit", b: "guard", stance: 2 } as const;
      const rowOrders = [[hostile, allied], [allied, hostile]];

      expect(rowOrders.map((relations) => (
        factionStance(resolveFactionTable({ defs: TWO_SIDES.defs, relations }), "guard", "bandit")
      ))).toEqual([-2, -2]);
    });

    it("falls back to the reserved enemy faction for unknown ids", () => {
      const table = resolveFactionTable(TWO_SIDES);
      expect(factionStance(table, PLAYER_FACTION_ID, "typo_faction")).toBe(-1);
      expect(factionStance(table, "typo_faction", "other_typo")).toBe(2);
      expect(factionAggression(table, "typo_faction")).toBe(1);
    });

    it("lets authored defs override reserved faction metadata without adding a slot", () => {
      const table = resolveFactionTable({
        defs: [{ id: DEFAULT_ENEMY_FACTION_ID, name: "야수", color: "#123456", aggression: 2 }],
        relations: [],
      });
      expect(table.size).toBe(2);
      expect(factionName(table, DEFAULT_ENEMY_FACTION_ID)).toBe("야수");
      expect(factionColor(table, DEFAULT_ENEMY_FACTION_ID)).toBe("#123456");
      expect(factionAggression(table, DEFAULT_ENEMY_FACTION_ID)).toBe(2);
      expect(factionStance(table, PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID)).toBe(-1);
    });

    it("clamps stance and aggression out of range", () => {
      const table = resolveFactionTable({
        defs: [{ id: "cult", name: "교단", aggression: 9 as never }],
        relations: [{ a: "cult", b: PLAYER_FACTION_ID, stance: -9 as never }],
      });
      expect(factionAggression(table, "cult")).toBe(3);
      expect(factionStance(table, "cult", PLAYER_FACTION_ID)).toBe(-2);
    });

    it("resolves the protectedFromNpcs flag per faction", () => {
      const table = resolveFactionTable({
        defs: [{ id: "villager", name: "주민", protectedFromNpcs: true }, ...TWO_SIDES.defs],
        relations: [],
      });
      expect(isProtectedFromNpcs(table, "villager")).toBe(true);
      expect(isProtectedFromNpcs(table, "bandit")).toBe(false);
      expect(isProtectedFromNpcs(table, undefined)).toBe(false);
    });
  });
  describe("willAttackOnSight", () => {
    it("gates each aggression level exactly", () => {
      expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 0))).toEqual([false, false, false, false, false]);
      expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 1))).toEqual([true, true, false, false, false]);
      expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 2))).toEqual([true, true, true, false, false]);
      expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 3))).toEqual([true, true, true, true, true]);
    });
  });
  describe("faction readability helpers", () => {
    it("splits hostile, neutral, and friendly bar colors", () => {
      const hostile = stanceBarColor(-1);
      const neutral = stanceBarColor(0);
      const friendly = stanceBarColor(2);
      expect(new Set([hostile, neutral, friendly]).size).toBe(3);
      expect(stanceBarColor(0.25)).toBe(neutral);
      expect(stanceBarColor(-0.25)).toBe(neutral);
      expect(stanceBarColor(-2)).toBe(hostile);
      expect(stanceBarColor(1)).toBe(friendly);
    });

    it("exempts friendly stances from stray projectiles", () => {
      expect([-2, -1, 0].map(isHittableByFaction as never)).toEqual([true, true, true]);
      expect([1, 2].map(isHittableByFaction as never)).toEqual([false, false]);
    });
  });
  describe("normalizeProjectFactions", () => {
    it("drops empty ids, duplicate ids, and relations to unknown factions", () => {
      const normalized = normalizeProjectFactions({
        defs: [
          { id: "", name: "빈 id" },
          { id: "guard", name: "경비병" },
          { id: "guard", name: "중복" },
        ],
        relations: [
          { a: "guard", b: PLAYER_FACTION_ID, stance: 1 },
          { a: "guard", b: "ghost", stance: -1 },
        ],
      });
      expect(normalized?.defs.map((def) => def.id)).toEqual(["guard"]);
      expect(normalized?.relations).toEqual([{ a: "guard", b: PLAYER_FACTION_ID, stance: 1 }]);
    });

    it("returns undefined for empty input so blank projects stay field-free", () => {
      expect(normalizeProjectFactions(undefined)).toBeUndefined();
      expect(normalizeProjectFactions({ defs: [], relations: [] })).toBeUndefined();
    });

    it("falls back to the id when a name is missing", () => {
      const normalized = normalizeProjectFactions({ defs: [{ id: "cult", name: "" }], relations: [] });
      expect(normalized?.defs[0]?.name).toBe("cult");
    });
  });
  describe("project persistence", () => {
    it("survives a serialize/deserialize roundtrip without a schema bump", () => {
      const project = createBlankProject();
      const version = project.version;
      project.factions = TWO_SIDES;
      const restored = deserialize(serialize(project));
      expect(restored.version).toBe(version);
      expect(restored.factions).toEqual(TWO_SIDES);
      expect(factionStance(resolveFactionTable(restored.factions), "bandit", "guard")).toBe(-1);
    });

    it("preserves an explicitly authored default aggression across normalization and persistence", () => {
      const project = createBlankProject();
      project.factions = {
        defs: [{ id: "guard", name: "경비병", aggression: 1 }],
        relations: [],
      };
      const restored = deserialize(serialize(project));

      expect(restored.factions).toEqual(project.factions);
      expect(restored.factions?.defs[0]?.aggression).toBe(1);
    });

    it("normalizes malformed authored data on load instead of trusting it", () => {
      const project = createBlankProject();
      project.factions = {
        defs: [{ id: "guard", name: "경비병" }],
        relations: [{ a: "guard", b: "ghost", stance: -1 }],
      };
      const restored = deserialize(serialize(project));
      expect(restored.factions?.relations).toEqual([]);
    });

    it("round-trips opt-in kill reputation while absence stays field-free", () => {
      const project = createBlankProject();
      project.factions = { ...TWO_SIDES, playerKillReputation: {} };
      expect(deserialize(serialize(project)).factions?.playerKillReputation).toEqual({});
      expect(deserialize(serialize(createBlankProject())).factions).toBeUndefined();
    });

    it("rejects negative authored reputation weights", () => {
      const project = createBlankProject();
      project.factions = {
        ...TWO_SIDES,
        playerKillReputation: { weight: -0.5 },
      };
      expect(() => deserialize(serialize(project))).toThrow(/playerKillReputation\.weight/u);
    });

    it("keeps a blank project free of the field", () => {
      expect(createBlankProject().factions).toBeUndefined();
      expect(deserialize(serialize(createBlankProject())).factions).toBeUndefined();
    });
  });
});
