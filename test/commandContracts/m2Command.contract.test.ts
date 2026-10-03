import { describe, expect, it } from "vitest";
import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import { newCommand } from "@/editor/eventCommandFactory";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import {
  M2_PERSISTED_BEHAVIOR_IDS,
  commandRuntimeSupport,
  m2CommandRuntimeClassification,
} from "@/project/eventCommands/runtimeSupport";
import type { Command, M2CommandFields } from "@/project/types";
import type { ContractRunOptions, ContractRunResult } from "./harness";
import { CONTRACT_EVENT_ID, runCommandContract } from "./harness";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type MapSemanticContract = {
  readonly command: M2Command;
  readonly verify: (result: ContractRunResult) => void;
  readonly options?: ContractRunOptions;
};

const MAP_FULL_CONTRACTS: readonly MapSemanticContract[] = [
  contract("m2-022-change-actor-name", { target: "actor_hero", value: "CONTRACT HERO" }, (result) => {
    expect(result.session.actorNames?.actor_hero).toBe("CONTRACT HERO");
  }),
  contract("m2-040-set-event-location", { target: CONTRACT_EVENT_ID, mapId: "map_blank_start", x: 8, y: 7 }, (result) => {
    expect(result.session.eventLocations?.[CONTRACT_EVENT_ID]).toMatchObject({ mapId: "map_blank_start", x: 8, y: 7 });
    expect(result.pauses).toContainEqual({ kind: "relocateEvents", eventIds: [CONTRACT_EVENT_ID] });
  }),
  contract("m2-041-swap-event-location", { eventA: CONTRACT_EVENT_ID, eventB: "event_other" }, (result) => {
    expect(result.session.eventLocations?.[CONTRACT_EVENT_ID]).toMatchObject({ x: 5, y: 6 });
    expect(result.session.eventLocations?.event_other).toMatchObject({ x: 1, y: 1 });
    expect(result.pauses).toContainEqual({ kind: "relocateEvents", eventIds: [CONTRACT_EVENT_ID, "event_other"] });
  }, { mutateProject: (project) => {
    project.maps[project.startMapId].events.push({ id: "event_other", x: 5, y: 6, trigger: { kind: "action" }, commands: [] });
  } }),
  contract("m2-042-get-terrain-id", { variableId: "terrain_result", x: 2, y: 3 }, (result) => {
    expect(result.session.variables.terrain_result).toBe(9);
  }, { mutateProject: (project) => {
    const map = project.maps[project.startMapId];
    map.lowerTiles[3 * map.width + 2] = 0;
    const tileset = project.tilesets[map.tilesetId];
    tileset.tileMeta ??= [];
    tileset.tileMeta[0] = { ...tileset.tileMeta[0], terrainTag: 9 };
  } }),
  contract("m2-043-get-event-id", { variableId: "event_result", x: 1, y: 1 }, (result) => {
    expect(result.session.variables.event_result).toBe(1);
  }),
  contract("m2-044-hide-screen", {}, (result) => expect(result.session.m2Runtime?.screen.hidden).toBe(true)),
  contract("m2-045-show-screen", {}, (result) => expect(result.session.m2Runtime?.screen.hidden).toBe(false)),
  contract("m2-078-open-menu-screen", {}, pauseContract("openMenuScreen")),
  contract("m2-093-open-load-menu", {}, pauseContract("openLoadMenu")),
  contract("m2-205-pathfind-move", { target: "this-event", x: 8, y: 7, speed: 3, wait: false }, (result) => {
    expect(result.pauses).toContainEqual({ kind: "pathfindMove", target: "this-event", x: 8, y: 7, speed: 3, wait: false });
  }),
  contract("m2-206-wait-until", { condition: "switchOn", target: "condition_ready", value: "", timeoutMs: 100 }, (result) => {
    expect(result.pauses).toEqual([{ kind: "wait", ms: 50, allowParallelEvents: true }, { kind: "wait", ms: 50, allowParallelEvents: true }]);
    expect(result.session.flags["m2-wait:switchOn:condition_ready"]).toBe(false);
  }),
  contract("m2-210-sound-layer", { channel: "ambient", resourceId: "ambient_contract", volume: 63, fadeMs: 400 }, (result) => {
    expect(result.pauses).toContainEqual({ kind: "playAudio", channel: "ambient", resourceId: "ambient_contract", loop: true, volume: 63, fadeInMs: 400 });
    expect(result.session.audio?.ambient).toMatchObject({ resourceId: "ambient_contract", loop: true, volume: 63, fadeInMs: 400 });
  }),
  contract("m2-014-change-parameters", { target: "actor_hero", parameter: "attack", operation: "add", value: 5, valueSource: "number", valueVariableId: "" }, (result) => {
    expect(result.session.m2Runtime?.actors.actor_hero?.parameters).toBe(5);
  }),
  contract("m2-019-change-state", { target: "actor_hero", operation: "add", value: "poison" }, (result) => {
    expect(result.session.actorStateIds?.actor_hero).toEqual(["poison"]);
  }),
  contract("m2-021-damage-processing", { target: "actor_hero", operation: "add", value: 7, valueSource: "number", valueVariableId: "" }, (result) => {
    expect(result.session.m2Runtime?.actors.actor_hero?.damage).toBe(7);
  }),
  contract("m2-024-change-actor-graphic", { target: "actor_hero", value: "hero_alt" }, (result) => {
    expect(result.session.m2Runtime?.actors.actor_hero?.characterGraphic).toBe("hero_alt");
  }),
  contract("m2-046-tint-screen", { value: "warm" }, (result) => {
    expect(result.session.m2Runtime?.screen.tint).toBe("warm");
  }),
  contract("m2-047-flash-screen", { color: "red", value: "red", durationMs: 120 }, pauseContract("flashScreen")),
  contract("m2-048-shake-screen", { intensity: 4, value: 4, durationMs: 160 }, pauseContract("shakeScreen")),
  contract("m2-049-scroll-map", { direction: "right", distance: 3, speed: 4, wait: "true", mode: "return" }, pauseContract("scrollMap")),
  contract("m2-050-set-weather-effects", { value: "rain", transitionMs: 0, durationMs: 0 }, pauseContract("setWeather")),
  contract("m2-052-move-picture", { pictureId: "pic1", resourceId: "portrait", x: 8, y: 9, durationMs: 0 }, (result) => {
    expect(result.session.pictures?.pic1).toEqual({ pictureId: "pic1", resourceId: "portrait", x: 8, y: 9, durationMs: 0 });
  }),
  contract("m2-058-wait-for-all-movement", {}, pauseContract("waitForAllMovement")),
  contract("m2-059-stop-all-movement", {}, pauseContract("stopAllMovement")),
  contract("m2-086-erase-event", {}, pauseContract("eraseEvent")),
  contract("m2-091-change-actor-class", { target: "actor_hero", value: "class_mage" }, (result) => {
    expect(result.session.m2Runtime?.actors.actor_hero?.classId).toBe("class_mage");
  }),
  contract("m2-092-change-battle-commands", { target: "actor_hero", operation: "add", value: "cmd_item", slots: "" }, (result) => {
    // 더하기는 지금 메뉴(직업 명령) 위에서 한다 — 이미 있는 명령은 겹치지 않고, 공격이 사라지지 않는다.
    const commands = result.session.actorBattleCommands?.actor_hero ?? [];
    expect(commands).toContain("cmd_item");
    expect(commands).toContain("cmd_attack");
    expect(commands.filter((id) => id === "cmd_item")).toHaveLength(1);
  }),
  contract("m2-201-camera-control", { mode: "panTo", target: "screen", x: 3, y: 4, zoom: 1, durationMs: 300 }, pauseContract("cameraControl")),
  contract("m2-203-spawn-event", { templateEventId: "guard", eventId: "guard_spawn", mapId: "map_blank", templateMapId: "map_blank", x: 6, y: 7 }, (result) => {
    expect(result.session.spawnedEvents?.guard_spawn).toMatchObject({ templateEventId: "guard", x: 6, y: 7 });
  }),
  contract("m2-204-remove-event", { eventId: "guard_spawn", mapId: "map_blank" }, (result) => {
    expect(result.session.flags["event-removed:guard_spawn"]).toBe(true);
  }),
  // 2026-09-27 이후 full 로 올라온 명령들(먼 배경·화면 효과·필드 키트·연출) — 2026-10-02 계약 보강.
  contract("m2-069-change-parallax-back", { resourceId: "", flowPercent: 40, flowDurationMs: 0 }, (result) => {
    expect(result.session.m2Runtime?.map.parallax_flow).toMatchObject({ mapId: "map_blank_start", value: "40|0" });
  }),
  contract("m2-202-screen-effect", { effect: "letterbox", value: "", durationMs: 300 }, (result) => {
    expect(result.session.m2Runtime?.screenEffects).toContainEqual(expect.objectContaining({ effect: "letterbox", durationMs: 300 }));
  }),
  contract("m2-219-key-poll", { dirVariableId: "dir", confirmSwitchId: "ok", cancelSwitchId: "", dashSwitchId: "" }, (result) => {
    // 입력이 없는 순간을 읽으면 방향은 0, 확인 스위치는 꺼진다 — 이전 값이 남지 않는다.
    expect(result.session.variables.dir).toBe(0);
    expect(result.session.switches.ok).toBe(false);
  }, { mutateSession: (session) => { session.variables.dir = 7; session.switches.ok = true; } }),
  contract("m2-220-timed-choice", { prompt: "", options: "싸운다\n도망친다", timeLimitMs: 2000, resultVariableId: "pick" }, (result) => {
    expect(result.pauses).toContainEqual(expect.objectContaining({ kind: "timedChoice", options: ["싸운다", "도망친다"], timeLimitMs: 2000 }));
  }),
  contract("m2-221-quick-time-event", { mode: "sequence", keys: "z", windowMs: 1200, resultVariableId: "", resultSwitchId: "" }, (result) => {
    expect(result.pauses).toContainEqual(expect.objectContaining({ kind: "quickTimeEvent", mode: "sequence", keys: ["z"], windowMs: 1200 }));
  }),
  contract("m2-222-high-score", { scoreId: "score", action: "submit", valueVariableId: "pts", resultVariableId: "rank", recordSwitchId: "rec" }, (result) => {
    expect(result.session.highScores?.score).toBe(42);
    expect(result.session.switches.rec).toBe(true);
  }, { mutateSession: (session) => { session.variables.pts = 42; } }),
  contract("m2-223-teleport-menu", { prompt: "어디로 갈까요?", resultVariableId: "", transfer: true }, (result) => {
    expect(result.pauses).toContainEqual(expect.objectContaining({ kind: "teleportMenu", prompt: "어디로 갈까요?", transfer: true }));
  }),
  contract("m2-224-particle-effect", { preset: "sparkle", target: "this-event", eventId: "", x: 0, y: 0, durationMs: 1200, wait: false }, (result) => {
    expect(result.pauses).toContainEqual(expect.objectContaining({ kind: "particleEffect", preset: "sparkle", target: { kind: "event", eventId: CONTRACT_EVENT_ID } }));
  }),
  contract("m2-225-sprite-look", { target: "this-event", eventId: "", reset: false, pose: "fallen", tint: "keep", tintHex: "", tintFill: "keep", flip: "keep", afterimage: "keep", angle: "", opacity: "" }, (result) => {
    expect(result.pauses).toContainEqual(expect.objectContaining({ kind: "spriteLook", target: { kind: "event", eventId: CONTRACT_EVENT_ID } }));
  }),
];

const BATTLE_FULL_CONTRACTS: readonly {
  readonly command: M2Command;
  readonly expected: ReturnType<typeof parseM2BattleCommand>;
}[] = [
  {
    command: persistedM2("m2-098-change-enemy-hp", { target: "enemy_1", operation: "remove", value: 9 }),
    expected: { kind: "changeEnemyHp", target: "enemy_1", operation: "remove", value: 9 },
  },
  {
    command: persistedM2("m2-099-change-enemy-mp", { target: "enemy_1", operation: "remove", value: 4 }),
    expected: { kind: "changeEnemyMp", target: "enemy_1", operation: "remove", value: 4 },
  },
  {
    command: persistedM2("m2-100-change-enemy-state", { target: "enemy_1", operation: "add", value: "poison" }),
    expected: { kind: "changeEnemyState", target: "enemy_1", operation: "add", stateId: "poison" },
  },
  {
    command: persistedM2("m2-101-enemy-encounter", { target: "enemy_hidden" }),
    expected: { kind: "enemyEncounter", target: "enemy_hidden" },
  },
  {
    command: persistedM2("m2-102-change-battleback", { resourceId: "battleback_cave" }),
    expected: { kind: "changeBattleback", resourceId: "battleback_cave" },
  },
  {
    command: persistedM2("m2-103-show-animation", { target: "enemy_1", animationId: "anim_fire" }),
    expected: { kind: "showAnimation", target: "enemy_1", animationId: "anim_fire" },
  },
  {
    command: persistedM2("m2-104-battle-events", { target: "page_rage" }),
    expected: { kind: "battleEvents", target: "page_rage" },
  },
  { command: persistedM2("m2-105-abort-battle", {}), expected: { kind: "abortBattle" } },
  {
    command: persistedM2("m2-218-move-enemy", { target: "enemy-1", x: 80, y: 100, durationMs: 400 }),
    expected: { kind: "moveEnemy", target: "enemy-1", x: 80, y: 100, durationMs: 400 },
  },
  {
    command: persistedM2("m2-106-call-common-event", { commonEventId: "common_heal" }),
    expected: { kind: "callCommonEvent", commonEventId: "common_heal" },
  },
  { command: persistedM2("m2-107-force-escape", {}), expected: { kind: "forceEscape" } },
  {
    command: persistedM2("m2-108-action-times", { target: "actor_hero", value: 2 }),
    expected: { kind: "actionTimes", target: "actor_hero", amount: 2 },
  },
];

describe("m2Command persisted semantic contracts", () => {
  it.each(MAP_FULL_CONTRACTS)("executes $command.commandId in map and common runtimes", ({ command, verify, options }) => {
    // Given: a persisted M2 command classified full in map and common contexts.
    expect(m2CommandRuntimeClassification(command.commandId).supportByContext).toMatchObject({
      map: "runtime-full",
      common: "runtime-full",
    });

    // When: the real interpreter drains the persisted command.
    const direct = runCommandContract([command], options);
    const common = runCommandContract([{ kind: "callCommonEvent", commonEventId: "common_contract" }], {
      ...options,
      mutateProject: (project) => {
        options?.mutateProject?.(project);
        project.commonEvents.push({ id: "common_contract", name: "Contract", trigger: "none", commands: [command] });
      },
      mutateSession: (session) => {
        options?.mutateSession?.(session);
        // The shipping interpreter resolves calls from the session's event snapshot.
        session.commonEvents = [{ id: "common_contract", commands: [command] }];
      },
    });
    for (const result of [direct, common]) {
      expect(result.finished).toBe(true);
      expect(result.warnings.filter((warning) => warning.startsWith("[interpreter]"))).toEqual([]);
      verify(result);
    }
  });

  it.each(BATTLE_FULL_CONTRACTS)("parses $command.commandId into its battle effect", ({ command, expected }) => {
    // Given: a persisted M2 command classified full only for troop execution.
    expect(m2CommandRuntimeClassification(command.commandId).supportByContext).toEqual({
      map: "runtime-partial",
      common: "runtime-partial",
      troop: "runtime-full",
    });

    // When: the battle boundary parses the persisted payload.
    const parsed = parseM2BattleCommand(command);

    // Then: the exact independently authored battle effect is produced.
    expect(parsed).toEqual(expected);
  });

  it("distinguishes picker-native aliases from persisted m2Command behavior", () => {
    // Given: Show Text is a picker alias whose persisted M2 payload has no native text semantics.
    const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.id === "m2-001-show-text");
    if (!entry?.existingKind) throw new Error("Missing Show Text native alias");
    const pickerCommand = newCommand(entry.existingKind);
    const persistedCommand = persistedM2(entry.id, {});

    // When: picker conversion and persisted support are evaluated separately.
    const result = runCommandContract([persistedCommand]);

    // Then: picker conversion is native, while persisted execution is explicitly partial and recorded safely.
    expect(pickerCommand.kind).toBe("text");
    expect(commandRuntimeSupport(persistedCommand)).toBe("runtime-partial");
    expect(commandRuntimeSupport(persistedCommand, "map")).toBe("runtime-partial");
    expect(result.pauses).toEqual([]);
    expect(result.session.m2Runtime?.fallbacks.map((fallback) => fallback.commandId)).toContain(entry.id);
  });

  it.each(M2_PERSISTED_BEHAVIOR_IDS.nativeAlias)("proves picker and persisted paths for %s", (commandId) => {
    // Given: an explicitly classified native-alias catalog row.
    const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.id === commandId);
    if (!entry?.existingKind) throw new Error(`Missing native alias catalog row: ${commandId}`);
    const persistedCommand = persistedM2(commandId, {});

    // When: picker conversion and persisted interpreter execution are exercised independently.
    const pickerCommand = newCommand(entry.existingKind);
    const persistedResult = runCommandContract([persistedCommand]);

    // Then: conversion stays native and persisted execution has an explicit, non-inherited context contract.
    expect(pickerCommand.kind).toBe(entry.existingKind);
    // 배지 정직성(2026-08-20): 컨텍스트 없는 판정은 세 컨텍스트 중 최저(보수)다.
    // m2-002 는 map/common full 이지만 troop partial 이므로 무컨텍스트 값도 partial 이다.
    expect(commandRuntimeSupport(persistedCommand)).toBe("runtime-partial");
    expect(commandRuntimeSupport(persistedCommand, "map")).toBe(
      commandId === "m2-002-display-text-settings" ? "runtime-full" : "runtime-partial"
    );
    expect(commandRuntimeSupport(persistedCommand, "troop")).toBe("runtime-partial");
    expect(persistedResult.finished).toBe(true);
    expect(persistedResult.warnings).toEqual([]);
  });

  it("has a semantic contract for every behavior-full ID in a runtime-full context", () => {
    // Given: independent map/common and troop semantic contract tables.
    const contractIds = [...MAP_FULL_CONTRACTS, ...BATTLE_FULL_CONTRACTS].map((entry) => entry.command.commandId);
    const runtimeFullBehaviorIds = M2_COMMAND_CATALOG
      .map((entry) => m2CommandRuntimeClassification(entry.id))
    .filter(
      (classification) =>
        classification.behaviorClass === "full" &&
        Object.values(classification.supportByContext).some((support) => support === "runtime-full")
    )
    .map((classification) => classification.commandId);

    // When/Then: every behavior-full command with at least one full execution context has
    // an independently observed effect in that context. Context-partial commands are not
    // falsely treated as map-runtime contracts.
    expect(new Set(contractIds)).toEqual(new Set(runtimeFullBehaviorIds));
  });
});

function persistedM2(commandId: string, fields: M2CommandFields): M2Command {
  return { kind: "m2Command", commandId, fields };
}

function contract(commandId: string, fields: M2CommandFields, verify: MapSemanticContract["verify"], options?: ContractRunOptions): MapSemanticContract {
  return { command: persistedM2(commandId, fields), verify, options };
}

function pauseContract(kind: string): MapSemanticContract["verify"] {
  return (result) => expect(result.pauses.map((pause) => pause.kind)).toContain(kind);
}
