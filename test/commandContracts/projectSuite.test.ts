import { describe, expect, it, vi } from "vitest";
import { EMOTE_DEFAULT_DURATION_MS, EMOTE_MAX_DURATION_MS } from "@/project/emotes";
import type { StepResult } from "@/player/interpreter/types";
import type { Command } from "@/project/types";
import { CONTRACT_EVENT_ID, roundtripCommands, runCommandContract, createContractSession } from "./harness";
import { effectiveFactionStance } from "@/project/factionRuntime";
import { createInterpreter } from "@/player/interpreter";
import { freshBlankProject } from "../support/blankProject";
import { PLAYER_FACTION_ID, resolveFactionTable } from "@/project/factions";
import { DEFAULT_MONSTER_EXP_CURVE, MONSTER_PARTY_MAX } from "@/project/monsterCollection";
import { totalExpForLevel } from "@/project/actorModel";
import type { MonsterInstance } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { isolateTimers } from "../mergedTeardown";

// test/commandContracts/showEmote.contract.test.ts
// G1 계약: showEmote (정수리 이모트).
//
// 실측 메모: 이모트는 씬 표면 명령이라 인터프리터가 pause 로 넘기고 씬이 즉시 재개한다
// (showAnimation 의 wait:false 와 같은 등급). 세션 상태를 바꾸지 않으므로 계약은
// "어떤 단계를 어떤 값으로 넘기는가" 와 "저장 왕복" 에 걸린다.
describe("showEmote.contract", () => {
  isolateTimers();
  describe("showEmote 계약", () => {
    it("정상 효과: 이모트 단계를 넘기고 세션 상태는 건드리지 않는다", () => {
      const result = runCommandContract([
        { kind: "showEmote", target: "player", emote: "heart", durationMs: 900 },
        { kind: "setSwitch", switchId: "after_emote", value: true },
      ]);

      expect(result.session.switches.after_emote).toBe(true);
      expect(result.session.selfSwitches).toBeUndefined();
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: 표시 시간이 없으면 기본값, 범위를 넘으면 상한으로 잘린다", () => {
      const stepOf = (command: Command): Extract<StepResult, { kind: "showEmote" }> => {
        const emoteStep = runCommandContract([command]).pauses.find((step) => step.kind === "showEmote");
        expect(emoteStep, "showEmote 단계가 흘러나와야 한다").toBeDefined();
        return emoteStep as Extract<StepResult, { kind: "showEmote" }>;
      };

      expect(stepOf({ kind: "showEmote", target: "player", emote: "smile" }).durationMs).toBe(
        EMOTE_DEFAULT_DURATION_MS
      );
      expect(
        stepOf({ kind: "showEmote", target: "player", emote: "smile", durationMs: 10_000_000 }).durationMs
      ).toBe(EMOTE_MAX_DURATION_MS);
    });

    it("대상 규약: 빈 eventId 는 실행 중인 이벤트를 뜻하고 그대로 씬에 전달된다", () => {
      const result = runCommandContract([{ kind: "showEmote", target: { eventId: "" }, emote: "question" }]);
      const emoteStep = result.pauses.find((step) => step.kind === "showEmote");

      expect(emoteStep).toMatchObject({ target: { eventId: "" }, emote: "question" });
      expect(CONTRACT_EVENT_ID).toBeTruthy();
      expect(result.finished).toBe(true);
    });

    it("저장 왕복: target·emote·durationMs 가 보존된다", () => {
      const commands: Command[] = [
        { kind: "showEmote", target: "player", emote: "music", durationMs: 700 },
        { kind: "showEmote", target: { eventId: "ev_partner" }, emote: "anger" },
      ];

      expect(roundtripCommands(commands, (project) => {
        project.maps[project.startMapId].events.push({
          id: "ev_partner",
          x: 1,
          y: 0,
          trigger: { kind: "action" },
          commands: [],
        });
      })).toEqual(commands);
    });
  });
});

describe("changeFactionStance.contract", () => {
  isolateTimers();
  describe("changeFactionStance 계약", () => {
    it("절대 설정과 증감이 같은 세션 오버레이에 누적된다", () => {
      const result = runCommandContract([
        { kind: "changeFactionStance", a: "guard", b: PLAYER_FACTION_ID, op: "=", value: 1 },
        { kind: "changeFactionStance", a: "guard", b: PLAYER_FACTION_ID, op: "-=", value: 2 },
      ], {
        mutateProject: (project) => {
          project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
        },
      });
      const table = resolveFactionTable({ defs: [{ id: "guard", name: "경비병" }], relations: [] });
      expect(effectiveFactionStance(table, result.session.factionStanceOverrides, "guard", PLAYER_FACTION_ID)).toBe(-1);
      expect(result.finished).toBe(true);
      expect(result.pauses).toEqual([]);
    });

    it("범위를 벗어난 값은 -2..2로 클램프한다", () => {
      const result = runCommandContract([
        { kind: "changeFactionStance", a: "enemy", b: PLAYER_FACTION_ID, op: "=", value: 99 },
      ]);
      const table = resolveFactionTable(undefined);
      expect(effectiveFactionStance(table, result.session.factionStanceOverrides, "enemy", PLAYER_FACTION_ID)).toBe(2);
    });

    it("invalidates live target selection immediately after changing a stance", () => {
      const onFactionStanceChanged = vi.fn();
      const project = freshBlankProject();
      project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
      const session = createContractSession(project);
      const interpreter = createInterpreter([
        { kind: "changeFactionStance", a: "guard", b: PLAYER_FACTION_ID, op: "=", value: -1 },
      ], session, project, { onFactionStanceChanged });

      expect(interpreter.start()).toEqual({ kind: "done" });
      expect(onFactionStanceChanged).toHaveBeenCalledTimes(1);
    });

    it("serialize→deserialize 왕복에서 명령 셰이프가 보존된다", () => {
      const commands: Command[] = [
        { kind: "changeFactionStance", a: "guard", b: PLAYER_FACTION_ID, op: "+=", value: 0.25 },
      ];
      expect(roundtripCommands(commands, (project) => {
        project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
      })).toEqual(commands);
    });
  });
});

// test/commandContracts/giveMonster.contract.test.ts
// G1 계약: giveMonster (Phase 9a 몬스터 지급 커맨드).
describe("giveMonster.contract", () => {
  isolateTimers();
  function command(speciesId = "species_wild_slime", level = 4): Command {
    return { kind: "giveMonster", speciesId, level, nickname: "계약 슬라임" };
  }
  describe("giveMonster 계약", () => {
    it("정상 효과: species 인스턴스를 만들고 파티에 추가한다", () => {
      const result = runCommandContract([command()]);
      const partyId = result.session.monsterParty?.[0];

      expect(result.session.monsterParty).toHaveLength(1);
      expect(result.session.monsterBox).toEqual([]);
      expect(result.session.monsterInstances?.[partyId ?? ""]).toMatchObject({
        speciesId: "species_wild_slime",
        nickname: "계약 슬라임",
        level: 4,
        // 경험치는 누적값이라 지급 몬스터는 그 레벨의 바닥에서 시작한다(monsterCollection.giveMonster).
        exp: totalExpForLevel(freshBlankProject().database.monsterSpecies?.find((entry) => entry.id === "species_wild_slime")?.expCurve ?? DEFAULT_MONSTER_EXP_CURVE, 4),
        friendship: 70,
      });
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 speciesId 는 크래시 없이 스킵한다", () => {
      const result = runCommandContract([
        { kind: "giveMonster", speciesId: "species_missing", level: 5 },
        { kind: "setSwitch", switchId: "after_missing_species", value: true },
      ]);

      expect(result.session.monsterParty).toEqual([]);
      expect(result.session.monsterBox).toEqual([]);
      expect(result.session.monsterInstances).toEqual({});
      expect(result.session.switches.after_missing_species).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("파티가 6마리를 넘으면 보관함으로 보낸다", () => {
      const commands = Array.from({ length: MONSTER_PARTY_MAX + 1 }, () => command("species_wild_slime", 2));
      const result = runCommandContract(commands);

      expect(result.session.monsterParty).toHaveLength(MONSTER_PARTY_MAX);
      expect(result.session.monsterBox).toHaveLength(1);
      expect(Object.keys(result.session.monsterInstances ?? {})).toHaveLength(MONSTER_PARTY_MAX + 1);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const commands = [command()];
      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
    });

    it("pause 의미론: giveMonster 는 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract([command()]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/moveMonster.contract.test.ts
// G1 계약: moveMonster (Phase 9a 파티/보관함 이동 커맨드).
describe("moveMonster.contract", () => {
  isolateTimers();
  function instance(instanceId: string, speciesId = "species_wild_slime"): MonsterInstance {
    return {
      instanceId,
      speciesId,
      level: 3,
      exp: 0,
      friendship: 70,
      caughtAt: { mapId: "map_blank", x: 1, y: 1 },
    };
  }
  function seedMonsterSession(partyIds: string[], boxIds: string[]) {
    return (session: PlaySessionLike): void => {
      const ids = [...partyIds, ...boxIds];
      session.monsterInstances = Object.fromEntries(ids.map((id) => [id, instance(id)]));
      session.monsterParty = [...partyIds];
      session.monsterBox = [...boxIds];
    };
  }
  describe("moveMonster 계약", () => {
    it("정상 효과: 보관함 몬스터를 파티로 이동한다", () => {
      const result = runCommandContract(
        [{ kind: "moveMonster", instanceId: "monster_boxed", to: "party" }],
        { mutateSession: seedMonsterSession([], ["monster_boxed"]) },
      );

      expect(result.session.monsterParty).toEqual(["monster_boxed"]);
      expect(result.session.monsterBox).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("정상 효과: 파티 몬스터를 보관함으로 이동한다", () => {
      const result = runCommandContract(
        [{ kind: "moveMonster", instanceId: "monster_party", to: "box" }],
        { mutateSession: seedMonsterSession(["monster_party"], []) },
      );

      expect(result.session.monsterParty).toEqual([]);
      expect(result.session.monsterBox).toEqual(["monster_party"]);
      expect(result.finished).toBe(true);
    });

    it("파티가 가득 차면 보관함에서 파티로 이동하지 않는다", () => {
      const partyIds = Array.from({ length: MONSTER_PARTY_MAX }, (_, index) => `monster_party_${index}`);
      const result = runCommandContract(
        [{ kind: "moveMonster", instanceId: "monster_boxed", to: "party" }],
        { mutateSession: seedMonsterSession(partyIds, ["monster_boxed"]) },
      );

      expect(result.session.monsterParty).toEqual(partyIds);
      expect(result.session.monsterBox).toEqual(["monster_boxed"]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 instanceId 는 크래시 없이 스킵한다", () => {
      const result = runCommandContract([
        { kind: "moveMonster", instanceId: "monster_missing", to: "box" },
        { kind: "setSwitch", switchId: "after_missing_monster", value: true },
      ]);

      expect(result.session.monsterParty).toEqual([]);
      expect(result.session.monsterBox).toEqual([]);
      expect(result.session.monsterInstances).toEqual({});
      expect(result.session.switches.after_missing_monster).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const commands: Command[] = [{ kind: "moveMonster", instanceId: "monster_boxed", to: "party" }];
      const options = { mutateSession: seedMonsterSession([], ["monster_boxed"]) };
      const original = runCommandContract(commands, options);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, options);

      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
    });

    it("pause 의미론: moveMonster 는 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract(
        [{ kind: "moveMonster", instanceId: "monster_boxed", to: "party" }],
        { mutateSession: seedMonsterSession([], ["monster_boxed"]) },
      );

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});
