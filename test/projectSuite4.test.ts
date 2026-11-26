import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { THIS_EVENT_MOVE_TARGET, buildEventTargetCatalog, canonicalMoveTargetValue, matchEventTargets, moveTargetIssueMessage, moveTargetPromptSection, resolveMoveTarget } from "@/project/eventTargetCatalog";
import { buildEventAssistPrompt, parseAndValidate } from "@/ai/eventCommandAssist";
import { createBlankProject } from "@/project/defaults";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, Project, ProjectFactions, SkillChoreographyRecord } from "@/project/types";
import { DEFAULT_ENEMY_FACTION_ID, factionAggression, factionColor, factionName, factionStance, isHittableByFaction, isProtectedFromNpcs, normalizeProjectFactions, PLAYER_FACTION_ID, resolveFactionTable, stanceBarColor, willAttackOnSight } from "@/project/factions";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";
import { PROJECT_NAME_URL_PARAM, PROJECT_URL_PARAM, readProjectFromUrl, syncProjectToUrl } from "@/project/projectUrl";
import { resolve, join } from "node:path";
import { formatLastOpenedTime } from "@/project/recentProjectTime";
import { containsPath, validateRecentFolder } from "../electron/main/projectFolderPath";
import { filterRecentProjects, upsertRecentProject, withoutRecentProject } from "../electron/shared/recentProjects";
import type { RecentProjectEntry } from "../electron/shared/start";
import { recordById } from "@/project/recordById";
import { FACE_IMAGE_SIZE, RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { RESOURCE_PROFILE_SPECS, validateResourceDimensions } from "@/project/resourceProfiles";
import { resolveRetroClassChoreography, resolveSkillChoreography, retroChoreographyIdForClone } from "@/assets/retroSkillCatalog";
import { normalizeSkillChoreographyRecord } from "@/project/skillChoreographyRecords";
import { findNpcGraphicMatches, queryNpcGraphics } from "@/assets/charsetQuery";
import { friendshipShortName } from "@/project/friendship";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { ROMANCE_TITLE_SUBTITLE } from "@/project/romancePreset";
import { BuildingBudget, DEFAULT_FILLER, fillerOf, placeableRoles, programArg, type SettlementDecl } from "@/project/settlementProgram";
import { ensureSharedCharacters, installSharedCharacters, sharedCharacterSemantics } from "@/project/sharedCharacters";
import { listCharacterSprites, exportCharacterGraphics } from "@/project/characterGraphics";
import { sharedCharacterGraphicsProject, validateSharedCharacterGraphics } from "@/project/sharedCharacterGraphics";
import type { SharedContentLibrary, SharedContentSnapshot } from "@/project/sharedContentSchema";
import { dedupeSharedContent, inflateSharedContentResponse } from "../src/project/sharedContentDedup";
import { mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { encodedSharedContent, publishSharedContent, readSharedContent, readSharedContentForEditor, readSharedContentPreview, readSharedReferenceImage, sharedContentEtag, encodedSharedContentWithRevision } from "../scripts/lib/sharedContentSqlite";
import { isSharedReferenceImage } from "@/project/bundledReferenceImagePath";
import { validateTilesetReferences } from "@/project/tilesetReferences";
import { EventEmitter } from "node:events";
import type Phaser from "phaser";
import { createSharedAnimatedTile } from "@/editor/sharedTileAnimation";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadSharedTileReferences, type SharedTileReferenceSnapshot } from "@/project/sharedTileReferences";
import { sharedTileReferencesMiddleware, encodedSharedTileReferences, readSharedTileReferences } from "../scripts/lib/sharedTileReferencesSqlite";
import { proposeHaggle, resolveHaggleReserve } from "@/project/haggle";
import { clampShopReputation, generateShopkeeperCustomers, reputationAfterVerdict } from "@/project/shopkeeper";

describe("projectSuite4", () => {
  isolateTimers();
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
});

describe("projectUrl", () => {
  isolateTimers();
  afterEach(() => {
    // jsdom / node: reset location search via history when available
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", "/");
    }
  });
  describe("projectUrl", () => {
    it("reads project and name from the query string", () => {
      expect(readProjectFromUrl("?project=rpg-zzu-editor-demo-village&name=%EC%97%90%EB%94%94%ED%84%B0%20%EB%8D%B0%EB%AA%A8%20%EB%A7%88%EC%9D%84")).toEqual({
        projectId: "rpg-zzu-editor-demo-village",
        projectName: "에디터 데모 마을",
      });
    });

    it("accepts legacy projectId param", () => {
      expect(readProjectFromUrl("?projectId=legacy-id")).toEqual({
        projectId: "legacy-id",
        projectName: null,
      });
    });

    it("prefers project over projectId when both are set", () => {
      expect(readProjectFromUrl("?project=new-id&projectId=old-id").projectId).toBe("new-id");
    });

    it("writes project and name into the address bar", () => {
      if (typeof window === "undefined" || !window.history?.replaceState) return;
      syncProjectToUrl({
        projectId: "rpg-zzu-editor-demo-village",
        projectName: "에디터 데모 마을",
      });
      const params = new URLSearchParams(window.location.search);
      expect(params.get(PROJECT_URL_PARAM)).toBe("rpg-zzu-editor-demo-village");
      expect(params.get(PROJECT_NAME_URL_PARAM)).toBe("에디터 데모 마을");
      expect(params.get("projectId")).toBeNull();
    });

    it("clears project params when projectId is empty", () => {
      if (typeof window === "undefined" || !window.history?.replaceState) return;
      syncProjectToUrl({ projectId: "keep-me", projectName: "이름" });
      syncProjectToUrl({ projectId: null });
      const params = new URLSearchParams(window.location.search);
      expect(params.get(PROJECT_URL_PARAM)).toBeNull();
      expect(params.get(PROJECT_NAME_URL_PARAM)).toBeNull();
    });
  });
});

describe("recentProjects", () => {
  isolateTimers();
  const older: RecentProjectEntry = { projectDir: "/Games/Old", title: "모험 2", lastOpenedAt: "2026-11-15T12:00:00Z", updatedAt: "2026-11-19T12:00:00Z" };
  const newer: RecentProjectEntry = { projectDir: "/Games/New", title: "모험 10", lastOpenedAt: "2026-11-17T12:00:00Z" };
  const copy: RecentProjectEntry = { projectDir: "/Games/New 사본", title: "모험 10", lastOpenedAt: null };
  const missing: RecentProjectEntry = { projectDir: "/Moved/RPG", title: "사라진 게임", lastOpenedAt: "invalid", hiddenReason: "missing" };
  describe("최근 프로젝트 목록", () => {
    it("이름과 경로를 검색하고 한글 정규화와 대소문자 차이를 허용한다", () => {
      const entries = [older, newer, copy, missing];
      expect(filterRecentProjects(entries, "  모험 2 ".normalize("NFD"), "opened")).toEqual([older]);
      expect(filterRecentProjects(entries, "/games/NEW", "opened")).toEqual([newer, copy]);
      expect(filterRecentProjects(entries, "moved", "opened")).toEqual([missing]);
    });

    it("편집 시각 대신 마지막으로 연 시각으로 정렬하고 열기 기록이 없는 사본도 남긴다", () => {
      const entries = [older, copy, newer, missing];
      expect(filterRecentProjects(entries, "", "opened")).toEqual([newer, older, copy, missing]);
      expect(filterRecentProjects(entries, "모험", "name")).toEqual([older, copy, newer]);
      expect(entries).toEqual([older, copy, newer, missing]);
    });

    it("마지막으로 연 시각은 오래된 날짜도 한국어 상대 시각으로 표시한다", () => {
      const now = Date.parse("2026-11-19T12:00:00Z");
      expect(formatLastOpenedTime("2026-11-19T10:00:00Z", "ko", now)).toBe("2시간 전");
      expect(formatLastOpenedTime("2026-11-18T12:00:00Z", "ko", now)).toBe("어제");
      expect(formatLastOpenedTime("2026-09-19T12:00:00Z", "ko", now)).toBe("2개월 전");
      expect(formatLastOpenedTime(null, "ko", now)).toBe("");
    });

    it("같은 경로를 다시 열면 앞으로 옮기고 제거는 지정 경로에만 적용한다", () => {
      const entries = [newer, older];
      const reopened = { ...older, title: "새 제목", lastOpenedAt: "2026-11-19T13:00:00Z" };
      expect(upsertRecentProject(entries, reopened, 2)).toEqual([reopened, newer]);
      expect(upsertRecentProject(entries, copy, 2)).toEqual([copy, newer]);
      expect(withoutRecentProject([newer, copy, missing], missing.projectDir)).toEqual([newer, copy]);
      expect(withoutRecentProject(entries, missing.projectDir)).toEqual(entries);
      expect(entries).toEqual([newer, older]);
    });
  });
  describe("최근 프로젝트 폴더 검증", () => {
    const dir = resolve("games", "project");
    const another = resolve("games", "another");
    const recent = [{ projectDir: dir }];

    it("정확히 같은 최근 경로이며 프로젝트 검사에 통과한 폴더만 허용한다", () => {
      expect(validateRecentFolder(dir, recent, () => dir)).toBe(dir);
      expect(validateRecentFolder(dir, recent, () => null)).toBeNull();
      expect(validateRecentFolder(dir, recent, () => another)).toBeNull();
    });

    it("등록되지 않은 경로, 상대 경로, 우회 경로와 루트는 파일을 검사하기 전에 거절한다", () => {
      const inspect = vi.fn(() => dir);
      const root = resolve("/");
      for (const path of [another, "games/project", dir + "/../project", dir + "\0suffix", root, {}]) {
        const entries = path === another || typeof path !== "string" ? recent : [{ projectDir: path }];
        expect(validateRecentFolder(path, entries, inspect)).toBeNull();
      }
      expect(inspect).not.toHaveBeenCalled();
    });

    it("폴더 포함 관계는 이름 접두어가 아닌 경로 요소를 비교한다", () => {
      expect(containsPath(dir, resolve(dir, "nested"))).toBe(true);
      expect(containsPath(dir, dir)).toBe(true);
      expect(containsPath(dir, dir + " 사본")).toBe(false);
      expect(containsPath(dir, another)).toBe(false);
    });
  });
});

describe("recordById", () => {
  isolateTimers();
  describe("recordById", () => {
    it("answers like Array.find by id, including after in-place edits", () => {
      const list = [{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "a", v: 3 }];
      expect(recordById(list, "a")).toBe(list[0]);
      expect(recordById(list, "b")?.v).toBe(2);
      expect(recordById(list, "zz")).toBeUndefined();
      list[1] = { id: "c", v: 4 };
      expect(recordById(list, "b")).toBeUndefined();
      expect(recordById(list, "c")?.v).toBe(4);
      list.push({ id: "d", v: 5 });
      expect(recordById(list, "d")?.v).toBe(5);
      list.unshift({ id: "d", v: 6 });
      expect(recordById(list, "d")).toBe(list.find((r) => r.id === "d"));
      expect(recordById(list, "a")).toBe(list.find((r) => r.id === "a"));
    });
  });
});

describe("resourceProfiles", () => {
  isolateTimers();
  describe("RM2K3 resource profiles", () => {
    it("records slicing ontology for every resource profile kind", () => {
      for (const spec of RESOURCE_PROFILE_SPECS) {
        expect(spec.slicing).toBe(RESOURCE_SLICING[spec.kind]);
        if (spec.slicing.kind === "grid") {
          expect(spec.tileWidth).toBe(spec.slicing.cellWidth);
          expect(spec.tileHeight).toBe(spec.slicing.cellHeight);
        }
      }
    });

    it("records fixed pixel split units for grid-sliced RPG resources", () => {
      expect(RESOURCE_SLICING.chipset).toMatchObject({
        kind: "grid",
        unit: "tile",
        cellWidth: 16,
        cellHeight: 16,
        columns: 30,
        rows: 16,
        count: 480,
        sheetWidth: 480,
        sheetHeight: 256,
        subcell: { unit: "quarter-tile", cellWidth: 8, cellHeight: 8 },
      });
      expect(RESOURCE_SLICING.charset).toMatchObject({
        kind: "grid",
        unit: "charset-frame",
        cellWidth: 24,
        cellHeight: 32,
        columns: 12,
        rows: 8,
        count: 96,
      });
      expect(RESOURCE_SLICING.battleWeapon).toMatchObject({
        kind: "grid",
        unit: "battle-weapon",
        cellWidth: 64,
        cellHeight: 64,
        columns: 3,
        rows: 8,
        count: 24,
        sheetWidth: 192,
        sheetHeight: 512,
      });
      // battleWeapon 과 같은 3x8 이다. 이 선언이 없으면 imageSpec 이 expectedWidth/Height 를
      // 못 만들고, 런타임이 144x384 를 전제하는데도 아무 48 배수 시트가 import 를 통과한다.
      expect(RESOURCE_SLICING.battleCharset).toMatchObject({
        kind: "grid",
        unit: "battle-character",
        cellWidth: 48,
        cellHeight: 48,
        columns: 3,
        rows: 8,
        count: 24,
        sheetWidth: 144,
        sheetHeight: 384,
      });
    });

    it("accepts a 144x384 battle charset as 48x48 frames", () => {
      const result = validateResourceDimensions("battleCharset", 144, 384);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tilesPerRow).toBe(3);
        expect(result.tileCount).toBe(24);
      }
    });

    it("rejects a battle charset that is not 144x384", () => {
      // Break caught: battleCharset was the only grid resource without a declared sheet size,
      // so a 144x192 sheet imported cleanly and then rendered wrong — battleFieldDom sizes the
      // background as (frame*3)x(frame*8) and cannot adapt. chipset/charset/battleWeapon all
      // already pin their sheet size; this closes the gap.
      const result = validateResourceDimensions("battleCharset", 144, 192);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe("전투 캐릭터셋: 144x384 크기가 필요합니다. 현재 144x192입니다.");
    });

    it("accepts a 480x256 chipset as 16x16 tiles", () => {
      const result = validateResourceDimensions("chipset", 480, 256);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tilesPerRow).toBe(30);
        expect(result.tileCount).toBe(480);
      }
    });

    it("accepts a 288x256 charset as 24x32 frames", () => {
      const result = validateResourceDimensions("charset", 288, 256);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tilesPerRow).toBe(12);
        expect(result.tileCount).toBe(96);
      }
    });

    it("rejects a 320x240 chipset with an actionable message", () => {
      const result = validateResourceDimensions("chipset", 320, 240);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe("칩셋: 480x256 크기가 필요합니다. 현재 320x240입니다.");
    });

    it("treats a faceset as one whole 48x48 image", () => {
      expect(RESOURCE_SLICING.faceset).toEqual({ kind: "whole-image", unit: "image" });
      expect(FACE_IMAGE_SIZE).toBe(48);

      const result = validateResourceDimensions("faceset", FACE_IMAGE_SIZE, FACE_IMAGE_SIZE);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tileCount).toBe(1);
        expect(result.tilesPerRow).toBe(1);
      }
    });

    it("still accepts the legacy 48-multiple square sheets left on disk", () => {
      const sheet = validateResourceDimensions("faceset", 192, 192);
      expect(sheet.ok).toBe(true);
      if (sheet.ok) {
        expect(sheet.tilesPerRow).toBe(4);
        expect(sheet.tileCount).toBe(16);
      }
    });

    it("rejects a faceset that is neither a 48x48 face nor a 48-multiple square", () => {
      const result = validateResourceDimensions("faceset", 96, 48);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe("얼굴 그래픽: 48x48 얼굴 한 장이 필요합니다. 현재 96x48입니다.");
    });
  });
});

describe("retroChoreographyProjectRecordOverride", () => {
  isolateTimers();
  // 새라의 용기사 기술(skill_dragoon_*)은 id 자체가 계약 연출이라 프로젝트 연출 레코드를 붙여도 카엘 검 시트가 그려졌다.
  const lance = normalizeSkillChoreographyRecord({
    id: "chor_test_lance", name: "창", motion: "dash-strike",
    layers: [{ sheet: "valkyrie_thrust", anchor: "target" }],
  }) as SkillChoreographyRecord;
  describe("project choreography record named by a contract-id skill", () => {
    it("keeps the contract when no project record is named", () => {
      expect(resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance" }, [lance])?.id).toBe("skill_dragoon_sweeping_lance");
      expect(resolveRetroClassChoreography({ id: "skill_dragoon_sweeping_lance" }, [lance])?.layers.map((l) => l.key)).toContain("hero_whirl");
    });

    it("lets the named project record win over the skill's own contract", () => {
      const resolved = resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: lance.id }, [lance]);
      expect(resolved?.origin).toBe("project");
      expect(resolved?.id).toBe(lance.id);
      const layers = resolveRetroClassChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: lance.id }, [lance])!.layers.map((l) => l.key);
      expect(layers).toContain("valkyrie_thrust");
      expect(layers).not.toContain("hero_whirl");
    });

    it("falls back to the contract when the named record does not exist", () => {
      expect(resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: "chor_missing" }, [lance])?.id).toBe("skill_dragoon_sweeping_lance");
      expect(resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: lance.id }, undefined)?.id).toBe("skill_dragoon_sweeping_lance");
    });

    it("a copy of a contract-id skill keeps the named project record", () => {
      expect(retroChoreographyIdForClone({ id: "skill_dragoon_jump", retroChoreographyId: lance.id })).toBe(lance.id);
      expect(retroChoreographyIdForClone({ id: "skill_dragoon_jump" })).toBe("skill_dragoon_jump");
    });

    it("still keeps an own contract ahead of another contract id", () => {
      expect(resolveRetroClassChoreography({ id: "skill_ranger_snipe", retroChoreographyId: "skill_gunner_snipe" })?.id).toBe("skill_ranger_snipe");
    });
  });
});

describe("rm2003DatabaseUtilityRecords", () => {
  isolateTimers();
  describe("RM2003 database utility records", () => {
    it("ships first-class elements, terrains, and global battle commands", () => {
      const project = createBlankProject();
      const database = project.database;

      expect(database.elements?.[0]).toMatchObject({
        id: "sword",
        // 새 프로젝트 기본 속성 이름은 한국어다(#4985, qa1124 항목 8-1). id 와 칸 순서는 그대로다.
        name: "검",
        kind: "physical",
        rateLabels: ["A", "B", "C", "D", "E"],
        damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 },
      });
      expect(database.elements?.map((element) => element.name)).toEqual([
        "검",
        "창",
        "타격",
        "활",
        "화염",
        "빙결",
        "번개",
        "물",
        "대지",
        "바람",
        "신성",
        "암흑",
        "공격력",
        "방어력",
        "지력",
        "민첩",
        "흡수",
        // 풀 속성은 몬스터 18타입 작업(#2603)이 기존 칸 뒤에 덧붙였다.
        "풀",
      ]);
      // 순서 = 타일셋 지형 태그 − 1 (chipsetMapping.TERRAIN_TAG: 1 물, 2 모래, 3 눈, 4 돌).
      expect(database.terrains?.map((terrain) => terrain.id)).toEqual(["terrain_water", "terrain_sand", "terrain_snow", "terrain_stone"]);
      expect(database.terrains?.[0]).toMatchObject({
        id: "terrain_water",
        name: "물",
        damage: 0,
        encounterRatePercent: 100,
        vehiclePassage: { boat: true, ship: true, airshipLand: false },
      });
      expect(database.battleCommands?.map((command) => command.name)).toEqual(["공격", "스킬", "방어", "아이템"]);
    });

    it("normalizes malformed utility records into RPG2003-safe defaults", () => {
      const project = createBlankProject();
      // Retain unrelated reference targets while corrupting the utility row under test.
      if (!project.database.elements) throw new Error("Fixture needs element records");
      project.database.elements = project.database.elements.filter((element) => element.id !== "fire");
      const rawProject = JSON.parse(serialize(project)) as Record<string, unknown>;
      const rawDatabase = rawProject.database as Record<string, unknown>;
      rawDatabase.elements = [{ id: "fire", name: "Fire", kind: "nonsense", rateLabels: ["weak"], damageMultipliers: { A: 250, B: 125, E: -100 } }, ...project.database.elements];
      rawDatabase.terrains = [{ id: "terrain_bad", name: "Bad", damage: -9, encounterRatePercent: 999 }];
      rawDatabase.battleCommands = [{ id: "cmd_bad", name: "", kind: "bogus" }];

      const normalized = deserialize(JSON.stringify(rawProject)).database;

      expect(normalized.elements?.[0]).toMatchObject({
        id: "fire",
        name: "Fire",
        kind: "magical",
        rateLabels: ["A", "B", "C", "D", "E"],
        damageMultipliers: { A: 250, B: 125, C: 100, D: 50, E: -100 },
      });
      expect(normalized.terrains?.[0]).toMatchObject({
        id: "terrain_bad",
        name: "Bad",
        damage: 0,
        encounterRatePercent: 500,
      });
      expect(normalized.battleCommands?.[0]).toMatchObject({
        id: "cmd_bad",
        name: "명령",
        kind: "attack",
      });
    });
  });
});

// 연애 시뮬레이션 두 번째 측정 수리(2026-10-16) — 미실행(이 세션은 테스트·게이트 금지). 기대값은 qa-runs 실측과 같은 방향이다.
describe("romanceFix3", () => {
  isolateTimers();
  describe("romance fix 3", () => {
    it("일반 질의(villager)도 Modern 연애 칩을 사람으로 센다", () => {
      // 이 경우는 「Modern 칩이 사람 후보에 든다」를 본다 — 순위가 아니다. scarloxy 사람 시트가 늘어(#2335 뒤 OPRN 사람 칩 추가)
      // 사람 칩이 100 장을 넘어(queryNpcGraphics 는 최대 100 으로 자른다) 후보 전체(findNpcGraphicMatches)에서 찾는다.
      const keys = findNpcGraphicMatches("villager").map((match) => match.entry.textureKey);
      expect(keys.some((key) => key.startsWith("tex_oprn_charset_modern"))).toBe(true);
    });

    it("HUD 이름은 호칭 꼬리를 뗀다", () => {
      expect(friendshipShortName("한서연 선배")).toBe("한서연");
      expect(friendshipShortName("선생님")).toBe("선생님");
      expect(friendshipShortName("차도현")).toBe("차도현");
    });

    it("관계 중심 게임만 호감 메뉴를 쓴다", () => {
      expect(usesRelationshipMenu({ system: { genreLock: { preset: "romance" } } } as never)).toBe(true);
      expect(usesRelationshipMenu({ system: {} } as never)).toBe(false);
    });

    it("연애 기본 타이틀 부제는 모험 문구가 아니다", () => {
      expect(ROMANCE_TITLE_SUBTITLE).not.toMatch(/ADVENTURE|모험/u);
    });
  });
});

// 정착지 목적표 계약(settlementProgram.ts) — 구성기가 묻는 건물 예산: 역할이 먼저, 채움 집은 선언한 수만큼, 그 뒤에는 아무것도 주지 않는다.
describe("settlementProgram", () => {
  isolateTimers();
  const DECL: SettlementDecl = {
    roles: {
      home: { ko: "집", kits: ["house-a", "house-b"], anyKit: true },
      shop: { ko: "가게", kits: ["shop-front", "shop-small"], room: "shop" },
      keep: { ko: "성", kits: ["keep"], room: "hall" },
    },
    kinds: {
      town: { roles: ["shop", "home"] },
      capital: { roles: ["keep", "shop", "home"], filler: 5, landmark: "keep" },
    },
  };
  const any = () => true;
  const first = (kits: readonly string[]) => kits[0]!;
  describe("정착지 목적표 — 건물 예산", () => {
    it("역할을 차례대로 먼저 주고, 채움 집은 선언한 수(없으면 기본 2)만큼만 준다", () => {
      const budget = new BuildingBudget(DECL, "town", { roles: [{ id: "s", role: "shop" }, { id: "h", role: "home", label: "나지라의 집" }] });
      expect(budget.total).toBe(2 + DEFAULT_FILLER);
      expect(budget.next(any, ["plain"], first)).toEqual({ kit: "shop-front", need: { id: "s", role: "shop" } });
      expect(budget.next(any, ["plain"], first)?.need?.id).toBe("h");
      expect(budget.next(any, ["plain"], first)).toEqual({ kit: "plain" });
      expect(budget.next(any, ["plain"], first)).toEqual({ kit: "plain" });
      expect(budget.open).toBe(false);
      expect(budget.next(any, ["plain"], first)).toBeUndefined();
    });

    it("역할의 얼굴 키트가 그 자리에 안 맞으면 대안 키트, 그것도 안 맞으면 그 자리는 채움 집이 받고 역할은 다음 자리를 기다린다", () => {
      const budget = new BuildingBudget(DECL, "town", { roles: [{ id: "s", role: "shop" }], filler: 1 });
      expect(budget.next((kit) => kit !== "shop-front", ["plain"], first)?.kit).toBe("shop-small");
      const tight = new BuildingBudget(DECL, "town", { roles: [{ id: "s", role: "shop" }], filler: 1 });
      expect(tight.next((kit) => kit === "plain", ["plain"], first)).toEqual({ kit: "plain" });
      expect(tight.wants("shop")).toBe(true);
      expect(tight.next((kit) => kit === "plain", ["plain"], first)).toBeUndefined();
      expect(tight.unplaced().map((need) => need.id)).toEqual(["s"]);
    });

    it("그 종류가 선언하지 않은 역할은 처음부터 빠지고, 종류가 선언한 채움 수를 쓴다", () => {
      const program = { roles: [{ id: "k", role: "keep" }, { id: "s", role: "shop" }] };
      expect(placeableRoles(DECL, "town", program).map((need) => need.id)).toEqual(["s"]);
      expect(fillerOf(DECL, "capital", program)).toBe(5);
      expect(fillerOf(DECL, "capital", { ...program, filler: 0 })).toBe(0);
    });

    it("구성기가 스스로 정한 자리는 claim·fill 로 예산에서 뗀다", () => {
      const budget = new BuildingBudget(DECL, "capital", { roles: [{ id: "landmark", role: "keep" }, { id: "s", role: "shop" }], filler: 1 });
      expect(budget.claim(["keep"])?.id).toBe("landmark");
      expect(budget.claim(["keep"])).toBeUndefined();
      expect(budget.claim()?.id).toBe("s");
      expect(budget.fill()).toBe(true);
      expect(budget.fill()).toBe(false);
      expect(budget.open).toBe(false);
    });

    it("도구 인자: 모르는 역할·겹친 id 는 던지고, 없으면 undefined", () => {
      expect(programArg(undefined, DECL)).toBeUndefined();
      expect(programArg({ roles: [{ id: "a", role: "home", label: " 미라의 집 " }], filler: 3 }, DECL)).toEqual({ roles: [{ id: "a", role: "home", label: "미라의 집" }], filler: 3 });
      expect(() => programArg({ roles: [{ id: "a", role: "castle" }] }, DECL)).toThrow(/role must be one of/u);
      expect(() => programArg({ roles: [{ id: "a", role: "home" }, { id: "a", role: "shop" }] }, DECL)).toThrow(/repeated/u);
    });
  });
});

describe("sharedCharacters", () => {
  isolateTimers();
  const id = 'shared_charset_actor_0123456789abcdef01234567';
  function library(): SharedContentLibrary {
    return { version:1, projectDefaults:true, roots:[], places:{}, tilesets:{}, maps:{}, previews:{}, sourceProjectId:'fixture',
      assets:{[id]:{id, kind:'charset', name:'청록 배달원', dataUrl:'data:image/png;base64,iVBORw0KGgo=', meta:{width:288,height:256,frameWidth:24,frameHeight:32,frames:96}}},
      characters:{[id]:{assetId:id,characterIndex:0, description:{label:'청록 배달원',role:'배달원',appearance:'청록 바람막이를 입은 사람',attributes:{clothing:'청록 바람막이'},tags:['배달']},
        source:{candidateId:'fixture/person',base:'Actor1:0',inspected:{},acceptance:{decision:'accept'}}}} };
  }
  function install(value = library()) { installSharedCharacters({revision:'fixture',libraries:{kept:value}}); }
  function project(): Project { return {assets:{uploaded:{}}, resourceProfiles:[],charsetLabels:[]} as unknown as Project; }
  afterEach(() => installSharedCharacters({revision:'empty',libraries:{}}));
  describe('Human-kept shared character catalog', () => {
    it('adds the same single usable character to new and existing projects without guessing age', () => {
      install();
      const fresh=project(), existing=project();
      existing.assets.uploaded.other={id:'other',name:'저자 그림',kind:'picture',dataUrl:'data:image/png;base64,AA==',meta:{}};
      for (const value of [fresh,existing]) {
        expect(ensureSharedCharacters(value)).toBe(true);
        expect(listCharacterSprites(value).filter(sprite=>sprite.textureKey===id)).toHaveLength(1);
        expect(value.resourceProfiles[0]?.characterSlots?.[0]?.graphicAttributes?.age).toBeUndefined();
        expect(ensureSharedCharacters(value)).toBe(false);
      }
      expect(existing.assets.uploaded.other?.name).toBe('저자 그림');
    });
    it('preserves author labels, face choices and existing pixels on reload', () => {
      install(); const value=project(); ensureSharedCharacters(value);
      const asset=value.assets.uploaded[id]!;
      value.charsetLabels![0]={...value.charsetLabels![0]!,label:'우리 프로젝트의 이름',origin:'user'};
      const slot=value.resourceProfiles[0]!.characterSlots![0]!;
      slot.status='mapped'; slot.faceResourceId='easyrpg-faceset-actor1-00'; slot.graphicAttributes={age:'노년'};
      expect(ensureSharedCharacters(value)).toBe(false);
      expect(value.assets.uploaded[id]).toBe(asset);
      expect(value.charsetLabels![0]?.label).toBe('우리 프로젝트의 이름');
      expect(slot.faceResourceId).toBe('easyrpg-faceset-actor1-00');
      expect(slot.graphicAttributes.age).toBe('노년');
    });
    it('exposes name, clothing and role to NPC discovery as uploaded graphics', () => {
      install();
      for (const query of ['청록 배달원','청록 바람막이','배달원']) {
        const result=queryNpcGraphics(query,50).find(match=>match.entry.textureKey===id);
        expect(result?.entry.spriteType).toBe('uploaded');
      }
      const value=library(); value.characters![id]!.description.attributes!.age='청년'; install(value);
      expect(sharedCharacterSemantics()[0]?.age).toBe('youth');
    });
    it('withdraws discovery while retaining project pixels and keeping the remaining face catalog readable', () => {
      install(); const value=project(); ensureSharedCharacters(value);
      const document=exportCharacterGraphics(sharedCharacterGraphicsProject());
      const pixels=value.assets.uploaded[id];
      installSharedCharacters({revision:'withdrawn',libraries:{}});
      expect(queryNpcGraphics('청록 배달원',50).some(match=>match.entry.textureKey===id)).toBe(false);
      expect(ensureSharedCharacters(value)).toBe(false);
      expect(value.assets.uploaded[id]).toBe(pixels);
      expect(validateSharedCharacterGraphics(document).mappings.some(row=>row.textureKey===id)).toBe(false);
    });
    it.each([
      ['고양이형 갑각 짐승', '바위 지대의 필드 몬스터'],
      ['붉은 갑피를 가진 소 계열 사족 마수', '근거리 돌진'],
      ['닭 계열의 언데드 조류 몬스터', '묘지 길목'],
    ])('classifies the authored species rather than requiring an exact tag: %s', (kind, role) => {
      const value = library(), description = value.characters![id]!.description;
      description.attributes = {kind}; description.role = role; install(value);
      expect(sharedCharacterSemantics()[0]?.tags).toContain('몬스터');
      expect(queryNpcGraphics('monster', 100).some(match => match.entry.textureKey === id)).toBe(true);
      expect(queryNpcGraphics('people', 100).some(match => match.entry.textureKey === id)).toBe(false);
      const p = project(); ensureSharedCharacters(p);
      expect(p.charsetLabels![0]?.tags).toContain('몬스터');
    });
    it('does not classify a human hunter by a monster word in their role or clothes', () => {
      const value = library(), description = value.characters![id]!.description;
      description.attributes = {kind:'사람',clothing:'몬스터 문양 재킷'};
      description.role = '몬스터 사냥꾼'; install(value);
      expect(sharedCharacterSemantics()[0]?.tags).not.toContain('몬스터');
      expect(queryNpcGraphics('monster', 100).some(match => match.entry.textureKey === id)).toBe(false);
    });
    it('does not index absent traits or a removed feather as visible features', () => {
      const value = library(), description = value.characters![id]!.description;
      description.attributes = {kind:'몬스터',hair:'청록 비늘; 긴 털과 갈기 없음',clothing:'옷 없음; 별도 갑피 없이 이마의 작은 황금빛 표식'};
      description.appearance = '청록 몸과 황금빛 표식. 원본의 깃털과 큰 무기는 제거했다.';
      install(value);
      for (const query of ['깃털','갈기','갑피','옷']) {
        expect(queryNpcGraphics(query,100).some(match => match.entry.textureKey === id)).toBe(false);
      }
      expect(queryNpcGraphics('황금빛 표식',100).some(match => match.entry.textureKey === id)).toBe(true);
      expect(description.appearance).toContain('깃털');
    });
  });
});

describe("sharedContent", () => {
  isolateTimers();
  describe("sharedContentDedup", () => {
    isolateTimers();
    const long = (seed: string) => `${seed}:`.repeat(600);
    function snapshotWith(...strings: string[]): SharedContentSnapshot {
      return {
        revision: "r1",
        libraries: { a: { version: 1, roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, sourceProjectId: "p", previews: Object.fromEntries(strings.map((s, i) => [`k${i}`, s])) } },
      } as unknown as SharedContentSnapshot;
    }
    describe("shared content transport dedup", () => {
      it("puts a repeated long string on the wire once and restores identical values", () => {
        const original = snapshotWith(long("x"), long("x"), long("y"), "short", "short");
        const deduped = dedupeSharedContent(original)!;
        expect(deduped.strings).toEqual([long("x")]);
        const wire = JSON.stringify(deduped);
        expect(wire.split(long("x")).length - 1).toBe(1);
        expect(inflateSharedContentResponse(JSON.parse(wire))).toEqual(original);
      });

      it("keeps key order and leaves a snapshot without repeats alone", () => {
        expect(dedupeSharedContent(snapshotWith(long("x"), long("y")))).toBeNull();
        const original = snapshotWith(long("x"), long("x"));
        const restored = inflateSharedContentResponse(JSON.parse(JSON.stringify(dedupeSharedContent(original))));
        expect(Object.keys(restored.libraries.a!.previews)).toEqual(["k0", "k1"]);
      });

      it("refuses to dedup when a real string could be mistaken for a marker", () => {
        expect(dedupeSharedContent(snapshotWith(long("x"), long("x"), "\u0000S0"))).toBeNull();
      });

      it("passes an old-format response through untouched", () => {
        const old = snapshotWith(long("x"), long("x"));
        expect(inflateSharedContentResponse(JSON.parse(JSON.stringify(old)))).toEqual(old);
      });
    });
  });
  describe("sharedContentSqlite", () => {
    isolateTimers();
    const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const hashLibrary = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    function library(projectDefaults: boolean): SharedContentLibrary {
      const reference = [{ id: "study", name: "study", description: "", documents: [], images: [{ id: "a", name: "a", caption: "", dataUrl: PIXEL }] }];
      const tileset = { id: "shared_room", referenceDocuments: reference, structureKits: [{ id: "kit", referenceDocuments: structuredClone(reference) }] };
      return { version: 1, ...(projectDefaults ? { projectDefaults: true } : {}), roots: [], places: {}, tilesets: { shared_room: tileset } as unknown as SharedContentLibrary["tilesets"], assets: {}, maps: {}, sourceProjectId: "test", previews: { shared_room: PIXEL } };
    }
    let directory: string;
    let file: string;
    beforeEach(() => {
      directory = mkdtempSync(join(tmpdir(), "oprn-shared-content-"));
      file = join(directory, "shared-content.sqlite");
      publishSharedContent("catalog", library(false), null, file);
      publishSharedContent("defaults", library(true), null, file);
    });
    afterEach(() => rmSync(directory, { recursive: true, force: true }));
    describe("editor shared-content snapshot", () => {
      it("serves only projectDefaults libraries for the boot scope, with the full-catalog revision", () => {
        const boot = readSharedContentForEditor("defaults", file);
        expect(Object.keys(boot.libraries)).toEqual(["defaults"]);
        expect(boot.revision).toBe(readSharedContentForEditor("all", file).revision);
        expect(boot.revision).toBe(readSharedContent(file).revision);
      });

      it("replaces inline previews with an address that returns the same bytes", () => {
        const url = readSharedContentForEditor("all", file).libraries.catalog!.previews.shared_room!;
        expect(url.startsWith("data:")).toBe(false);
        const params = new URL(url, "http://host").searchParams;
        const found = readSharedContentPreview(params.get("library")!, params.get("kind")!, params.get("id")!, file);
        expect(found?.mime).toBe("image/png");
        expect(found?.bytes.equals(Buffer.from(PIXEL.slice(PIXEL.indexOf(",") + 1), "base64"))).toBe(true);
      });

      it("keeps the publishing reader byte-exact and rejects unknown preview requests", () => {
        expect(readSharedContent(file).libraries.catalog!.previews.shared_room).toBe(PIXEL);
        expect(readSharedContent(file).libraries.defaults!.tilesets.shared_room!.referenceDocuments![0]!.images[0]!.dataUrl).toBe(PIXEL);
        expect(readSharedContentPreview("catalog", "place", "missing", file)).toBeNull();
        expect(readSharedContentPreview("catalog", "tileset", "shared_room", file)).toBeNull();
      });

      it("carries the byte SHA-256 of every default image so HTTP editors need not hash them", () => {
        publishSharedContent("defaults", { ...library(true), assets: { shared_room_image: { id: "shared_room_image", name: "room", kind: "tileset", dataUrl: PIXEL, meta: {} } } as unknown as SharedContentLibrary["assets"] }, hashLibrary(readSharedContent(file).libraries.defaults), file);
        const boot = readSharedContentForEditor("defaults", file);
        expect(boot.assetBytesSha256).toEqual({ shared_room_image: createHash("sha256").update(Buffer.from(PIXEL.slice(PIXEL.indexOf(",") + 1), "base64")).digest("hex") });
      });
    });
    describe("shared tileset reference images", () => {
      it("replaces inline tileset and kit reference images with one address that serves the same bytes", () => {
        const tileset = readSharedContentForEditor("defaults", file).libraries.defaults!.tilesets.shared_room!;
        const address = tileset.referenceDocuments![0]!.images[0]!.dataUrl;
        expect(isSharedReferenceImage(address)).toBe(true);
        expect(tileset.structureKits![0]!.referenceDocuments![0]!.images[0]!.dataUrl).toBe(address);
        expect(() => validateTilesetReferences(tileset.referenceDocuments)).not.toThrow();
        const found = readSharedReferenceImage(address, file);
        expect(found?.mime).toBe("image/png");
        expect(found?.bytes.equals(Buffer.from(PIXEL.slice(PIXEL.indexOf(",") + 1), "base64"))).toBe(true);
      });

      it("serves an address from a library outside the requested scope and rejects unknown or malformed ones", () => {
        const address = readSharedContentForEditor("all", file).libraries.catalog!.tilesets.shared_room!.referenceDocuments![0]!.images[0]!.dataUrl;
        expect(readSharedReferenceImage(address, file)).not.toBeNull();
        expect(readSharedReferenceImage(address.replace(/-\d+\.png$/, "-1.png"), file)).toBeNull();
        expect(readSharedReferenceImage("/__oprn/shared-content/image/../x.png", file)).toBeNull();
      });
    });
    describe("encoded editor response", () => {
      it("decodes to the editor snapshot and is rebuilt after a library is republished", () => {
        const first = encodedSharedContent("defaults", file);
        expect(JSON.parse(gunzipSync(first).toString())).toEqual(readSharedContentForEditor("defaults", file));
        expect(encodedSharedContent("defaults", file)).toBe(first);
        const old = readSharedContent(file).libraries.defaults!;
        publishSharedContent("defaults", { ...library(true), roots: [], sourceProjectId: "changed" }, hashLibrary(old), file);
        const second = encodedSharedContent("defaults", file);
        expect(second).not.toBe(first);
        expect(JSON.parse(gunzipSync(second).toString()).libraries.defaults.sourceProjectId).toBe("changed");
      });

      it("splits the catalog so defaults + rest is the whole, all sharing one revision", () => {
        const defaults = readSharedContentForEditor("defaults", file);
        const rest = readSharedContentForEditor("rest", file);
        const all = readSharedContentForEditor("all", file);
        expect(Object.keys(defaults.libraries)).toEqual(["defaults"]);
        expect(Object.keys(rest.libraries)).toEqual(["catalog"]);
        expect({ ...defaults.libraries, ...rest.libraries }).toEqual(all.libraries);
        expect(new Set([defaults.revision, rest.revision, all.revision]).size).toBe(1);
      });

      it("changes the scope ETag exactly when a library is republished", () => {
        const before = sharedContentEtag("all", encodedSharedContentWithRevision("all", file).revision);
        expect(sharedContentEtag("all", encodedSharedContentWithRevision("all", file).revision)).toBe(before);
        expect(sharedContentEtag("rest", encodedSharedContentWithRevision("rest", file).revision)).not.toBe(before);
        const old = readSharedContent(file).libraries.catalog!;
        publishSharedContent("catalog", { ...library(false), sourceProjectId: "moved" }, hashLibrary(old), file);
        expect(sharedContentEtag("all", encodedSharedContentWithRevision("all", file).revision)).not.toBe(before);
      });
    });
  });
});

describe("sharedTile", () => {
  isolateTimers();
  describe("sharedTileAnimation", () => {
    isolateTimers();
    class Tile extends EventEmitter {
      texture: { key: string };
      frame: { name: string };
      visible = true;
      active = true;
      destroyed = false;
      animation = "";
      constructor(readonly x: number, readonly y: number, texture: string, frame: string) {
        super();
        this.texture = { key: texture };
        this.frame = { name: frame };
      }
      setVisible(value: boolean) { this.visible = value; return this; }
      setTexture(texture: string, frame: string) {
        this.texture = { key: texture };
        this.frame = { name: frame };
        return this;
      }
      play(animation: string) { this.animation = animation; return this; }
      destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.emit("destroy");
        this.removeAllListeners();
      }
    }
    function fixture() {
      const drivers: Tile[] = [];
      const scene = { add: {
        sprite: (x: number, y: number, texture: string, frame: string) => {
          const tile = new Tile(x, y, texture, frame);
          drivers.push(tile);
          return tile;
        },
        image: (x: number, y: number, texture: string, frame: string) => new Tile(x, y, texture, frame),
      } } as unknown as Phaser.Scene;
      const create = (animation = "water", texture = "atlas") =>
        createSharedAnimatedTile(scene, 8, 16, texture, "first", animation) as unknown as Tile;
      return { drivers, create };
    }
    describe("shared editor tile animations", () => {
      it("shares a clock, synchronizes newly added tiles, and releases it after the last tile", () => {
        const { drivers, create } = fixture();
        const images = Array.from({ length: 1000 }, () => create());
        expect(drivers).toHaveLength(1);
        const driver = drivers[0]!;
        expect(driver.visible).toBe(false);
        expect(images[0]).toMatchObject({ x: 8, y: 16, visible: true });
        driver.setTexture("atlas", "next");
        driver.emit("animationupdate");
        expect(images.every(image => image.frame.name === "next")).toBe(true);
        const added = create();
        expect(added.frame.name).toBe("next");
        for (const image of images) image.destroy();
        expect(driver.destroyed).toBe(false);
        added.destroy();
        expect(driver.destroyed).toBe(true);
        create();
        expect(drivers).toHaveLength(2);
      });

      it("isolates different strips and scenes, and tolerates driver-first scene shutdown", () => {
        const first = fixture();
        const second = fixture();
        const a = first.create();
        const b = first.create("uploaded-water", "uploaded-atlas");
        const c = second.create();
        first.drivers[0]!.destroy();
        a.destroy();
        expect(first.drivers[1]!.destroyed).toBe(false);
        expect(second.drivers[0]!.destroyed).toBe(false);
        b.destroy();
        c.destroy();
        expect(first.drivers[1]!.destroyed).toBe(true);
        expect(second.drivers[0]!.destroyed).toBe(true);
      });
    });
  });
  describe("sharedTileReferencesMiddleware", () => {
    isolateTimers();
    const MISSING = "/tmp/oprn-shared-tile-references-missing.sqlite";
    function respond(url: string, headers: Record<string, string> = {}) {
      const chunks: Buffer[] = [];
      let status = 0;
      let responseHeaders: Record<string, unknown> = {};
      const req = { url, method: "GET", headers } as IncomingMessage;
      const res = {
        writeHead(code: number, nextHeaders?: Record<string, unknown>) {
          status = code;
          responseHeaders = nextHeaders ?? {};
          return res;
        },
        end(body?: Buffer | string) {
          if (body) chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
        },
      } as unknown as ServerResponse;
      return { req, res, done: () => ({ status, headers: responseHeaders, body: Buffer.concat(chunks).toString("utf8") }) };
    }
    describe("shared tile reference fetch", () => {
      const previous = process.env.OPRN_SHARED_CONTENT_SQLITE;

      afterEach(() => {
        if (previous === undefined) delete process.env.OPRN_SHARED_CONTENT_SQLITE;
        else process.env.OPRN_SHARED_CONTENT_SQLITE = previous;
      });

      it("returns JSON instead of the SPA html fallback when the catalog file is absent", () => {
        process.env.OPRN_SHARED_CONTENT_SQLITE = MISSING;
        const call = respond("/__oprn/shared-tile-references", { "accept-encoding": "identity" });
        let forwarded = false;
        sharedTileReferencesMiddleware(call.req, call.res, () => { forwarded = true; });
        const result = call.done();
        expect(forwarded).toBe(false);
        expect(result.status).toBe(200);
        expect(String(result.headers["content-type"])).toContain("application/json");
        expect(JSON.parse(result.body)).toEqual({ revision: "", entries: [] });
      });

      it("rejects an html body before parsing it as tile references", async () => {
        const previousWindow = (globalThis as { window?: unknown }).window;
        const previousFetch = globalThis.fetch;
        (globalThis as { window?: unknown }).window = {};
        globalThis.fetch = vi.fn(async () => new Response("<!doctype html><html></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        })) as typeof fetch;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        try {
          expect(await loadSharedTileReferences()).toBe(false);
          expect(warn.mock.calls.some((call) => String(call[0]).includes("공용 타일 참고문서"))).toBe(true);
        } finally {
          (globalThis as { window?: unknown }).window = previousWindow;
          globalThis.fetch = previousFetch;
          warn.mockRestore();
        }
      });
    });
  });
  describe("sharedTileReferencesSqlite", () => {
    isolateTimers();
    const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const hashLibrary = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const bytes = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
    function library(sourceProjectId = "test"): SharedContentLibrary {
      const reference = [{ id: "study", name: "study", description: "", documents: [], images: [{ id: "a", name: "a", caption: "", dataUrl: PIXEL }] }];
      const tileset = {
        id: "shared_room", name: "room", kind: "custom", tileSize: 16, tilesPerRow: 1, count: 1,
        image: { type: "uploaded", id: "shared_room_image" }, passability: [], priority: [], terrain: [],
        referenceDocuments: reference, structureKits: [{ id: "shared_kit", referenceDocuments: structuredClone(reference) }],
      };
      const map = { id: "shared_region", name: "r", width: 1, height: 1, tilesetId: "shared_room", lowerTiles: [0], upperTiles: [-1], events: [] };
      const region = { id: "shared_region", name: "r", kind: "completed-map", regionKind: "settlement", revision: 1, width: 1, height: 1, tilesetId: "shared_room",
        preview: PIXEL, sourceProjectId: "p", sourceMapId: "m", snapshotProjectId: "s", rules: [], limitations: "" };
      return {
        version: 1, roots: [], places: {}, sourceProjectId, previews: {},
        tilesets: { shared_room: tileset } as unknown as SharedContentLibrary["tilesets"],
        assets: { shared_room_image: { id: "shared_room_image", name: "room", kind: "tileset", dataUrl: PIXEL, meta: {} } } as unknown as SharedContentLibrary["assets"],
        maps: { shared_region: map } as unknown as SharedContentLibrary["maps"],
        regions: { shared_region: region } as unknown as SharedContentLibrary["regions"],
      };
    }
    let directory: string;
    let file: string;
    beforeEach(() => {
      directory = mkdtempSync(join(tmpdir(), "oprn-shared-tile-refs-"));
      file = join(directory, "shared-content.sqlite");
      publishSharedContent("catalog", library(), null, file);
    });
    afterEach(() => rmSync(directory, { recursive: true, force: true }));
    const decode = (gzip: Buffer) => JSON.parse(gunzipSync(gzip).toString()) as SharedTileReferenceSnapshot;
    describe("editor shared tile references", () => {
      it("sends catalog-owned tilesets, sheets and documents as library references and region previews as host addresses", () => {
        const snapshot = decode(encodedSharedTileReferences(file));
        const entry = snapshot.entries.find(item => item.id === "shared_room")! as unknown as Record<string, unknown>;
        // 참고문서·구조 킷·타일셋·그림은 공용 카탈로그에 같은 글로 있다 — 라이브러리 id 만 온다.
        expect(entry.library).toBe("catalog");
        expect(entry.documents).toBeUndefined();
        expect(entry.kits).toBeUndefined();
        expect(snapshot.spatial!.tilesets.shared_room).toEqual({ $library: "catalog" });
        expect(snapshot.spatial!.assets.shared_room_image).toEqual({ $library: "catalog" });
        expect(entry.dataUrlSha256).toBe(createHash("sha256").update(PIXEL).digest("hex"));
        const preview = new URL(snapshot.spatial!.regions[0]!.preview, "http://host").searchParams;
        expect(readSharedContentPreview(preview.get("library")!, preview.get("kind")!, preview.get("id")!, file)?.bytes.equals(bytes(PIXEL))).toBe(true);
      });

      it("links reference images to host addresses that serve the same bytes", () => {
        const snapshot = readSharedTileReferences(file, { linkImages: true });
        const entry = snapshot.entries.find(item => item.id === "shared_room")!;
        const address = entry.documents[0]!.images[0]!.dataUrl;
        expect(isSharedReferenceImage(address)).toBe(true);
        expect(entry.kits![0]!.referenceDocuments![0]!.images[0]!.dataUrl).toBe(address);
        expect(readSharedReferenceImage(address, file)?.bytes.equals(bytes(PIXEL))).toBe(true);
        expect(snapshot.spatial!.assets.shared_room_image!.dataUrl).toBe(PIXEL);
      });

      it("keeps the worker reader byte-exact", () => {
        const snapshot = readSharedTileReferences(file);
        expect(snapshot.entries[0]!.documents[0]!.images[0]!.dataUrl).toBe(PIXEL);
        expect(snapshot.spatial!.regions[0]!.preview).toBe(PIXEL);
      });

      it("reuses the encoded response until a library is republished", () => {
        const first = encodedSharedTileReferences(file);
        expect(encodedSharedTileReferences(file)).toBe(first);
        publishSharedContent("catalog", library("changed"), hashLibrary(readSharedContent(file).libraries.catalog), file);
        const second = encodedSharedTileReferences(file);
        expect(second).not.toBe(first);
        expect(decode(second).revision).not.toBe(decode(first).revision);
      });
    });
  });
});

describe("shopkeeper", () => {
  isolateTimers();
  describe("shopkeeper inverted haggle", () => {
    it("Given / When / Then the same day key yields the same customer queue", () => {
      const input = { shopKey: "shop_a", dayKey: "1:spring:2", itemIds: ["item_potion", "item_sword"] };
      expect(generateShopkeeperCustomers(input)).toEqual(generateShopkeeperCustomers(input));
      expect(generateShopkeeperCustomers({ ...input, itemIds: [] })).toEqual([]);
    });

    it("Given / When / Then a customer buy uses playerSells and never pays at or above list", () => {
      const reserve = resolveHaggleReserve({
        role: "playerSells",
        reference: 100,
        buyPrice: 200,
        maxDiscount: 0.25,
        itemId: "item_potion",
        merchantKey: "shop_a",
        dayKey: "1:spring:2",
        attemptIndex: 0,
      });
      expect(reserve).toBeGreaterThanOrEqual(100);
      expect(reserve).toBeLessThan(200);
      const accepted = proposeHaggle(
        {
          role: "playerSells",
          reference: 100,
          reserve,
          patience: 3,
          insultRatio: 0.6,
          buyPrice: 200,
        },
        Math.min(reserve, 199),
      );
      expect(accepted.kind).toBe("accept");
      if (accepted.kind !== "accept") return;
      expect(accepted.price).toBeLessThan(200);
    });

    it("Given / When / Then walkout lowers reputation and a sale raises it", () => {
      expect(clampShopReputation(200)).toBe(100);
      expect(reputationAfterVerdict(10, "accept")).toBe(12);
      expect(reputationAfterVerdict(10, "broken")).toBe(5);
    });
  });
});
