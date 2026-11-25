import { describe, expect, it, beforeAll } from "vitest";
import { evalCondition, type MonsterInstance } from "@/project/session";
import type { Command, Project, M2CommandFields } from "@/project/types";
import { CONTRACT_EVENT_ID, roundtripCommands, runCommandContract, type ContractRunOptions, type ContractRunResult, createContractSession } from "./harness";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { CUTSCENE_LOCK_FLAG, CUTSCENE_SKIPPABLE_FLAG } from "@/player/cutsceneControl";
import { preloadScriptEngine } from "@/player/script/engine";
import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import { newCommand } from "@/editor/eventCommandFactory";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { M2_PERSISTED_BEHAVIOR_IDS, commandRuntimeSupport, m2CommandRuntimeClassification, commandRuntimeSupportDescriptor } from "@/project/eventCommands/runtimeSupport";
import { ownTileset, freshBlankProject } from "../support/blankProject";
import { HIDE_SHOW_SCREEN_FADE_MS } from "@/player/interpreter/screenEffectPlan";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { projectLint } from "@/project/lint/projectLint";
import { isolateTimers } from "../mergedTeardown";

// test/commandContracts/setSelfSwitch.contract.test.ts
// G1 계약: setSelfSwitch (스펙 §5.2 setFlag/setSwitch/setSelfSwitch/setVariable 행).
//
// 실측 메모 (§3 이탈 프로토콜):
// - 셀프 스위치는 "현재 실행 중인 이벤트"(interpreter options.currentEventId) 기준으로
//   session.selfSwitches[eventId][key] 에 기록된다.
// - 이벤트 컨텍스트가 없으면(공통 이벤트 단독 실행 등) 경고 없이 조용한 no-op 이다.
//   §5 표 초안은 이 경계의 기대를 명시하지 않았다 → 실측 결과를 계약으로 고정하고 보고서에 기록.
describe("setSelfSwitch.contract", () => {
  isolateTimers();
  describe("setSelfSwitch 계약", () => {
    it("정상 효과: 현재 이벤트의 셀프 스위치 키를 설정하고, 키(A~D)는 독립적이며 덮어쓸 수 있다", () => {
      const commands: Command[] = [
        { kind: "setSelfSwitch", key: "A", value: true },
        { kind: "setSelfSwitch", key: "B", value: true },
        { kind: "setSelfSwitch", key: "B", value: false }, // 같은 키 덮어쓰기
      ];

      const result = runCommandContract(commands);

      expect(result.session.selfSwitches?.[CONTRACT_EVENT_ID]).toEqual({ A: true, B: false });
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
      // selfSwitch 조건 평가와의 연동(페이지 전환 판정 기준과 동일한 evalCondition 경로).
      expect(
        evalCondition(result.session, { kind: "selfSwitch", key: "A", value: true }, CONTRACT_EVENT_ID)
      ).toBe(true);
      // 다른 이벤트에서는 이 셀프 스위치가 보이지 않는다.
      expect(
        evalCondition(result.session, { kind: "selfSwitch", key: "A", value: true }, "ev_other")
      ).toBe(false);
    });

    it("같은 이벤트 안에서 setSelfSwitch → fork(selfSwitch) 분기가 즉시 반영된다", () => {
      const commands: Command[] = [
        { kind: "setSelfSwitch", key: "A", value: true },
        {
          kind: "fork",
          condition: { kind: "selfSwitch", key: "A", value: true },
          then: [{ kind: "setSwitch", switchId: "door_open", value: true }],
          else: [{ kind: "setSwitch", switchId: "door_closed", value: true }],
        },
      ];

      const result = runCommandContract(commands);

      expect(result.session.switches.door_open).toBe(true);
      expect(result.session.switches.door_closed).toBeUndefined();
      expect(result.finished).toBe(true);
    });

    it("결측 컨텍스트: 이벤트 컨텍스트 없이 실행되면 경고 없이 no-op 으로 진행된다 (실측 고정)", () => {
      const result = runCommandContract(
        [
          { kind: "setSelfSwitch", key: "A", value: true },
          { kind: "setSwitch", switchId: "after_self", value: true },
        ],
        { currentEventId: null }
      );

      // 크래시 없이 다음 명령까지 진행하되, 셀프 스위치는 기록되지 않는다.
      expect(result.session.selfSwitches).toBeUndefined();
      expect(result.session.switches.after_self).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const commands: Command[] = [
        { kind: "setSelfSwitch", key: "A", value: true },
        { kind: "setSelfSwitch", key: "D", value: true },
      ];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
      expect(restored.session.selfSwitches?.[CONTRACT_EVENT_ID]).toEqual({ A: true, D: true });
    });

    it("pause 의미론: setSelfSwitch 는 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract([{ kind: "setSelfSwitch", key: "C", value: true }]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/setSwitch.contract.test.ts
// G1 계약: setSwitch (스펙 §5.2 setFlag/setSwitch/setSelfSwitch/setVariable 행).
//
// 실측 메모:
// - 런타임은 switchId 존재 여부를 검증하지 않고 session.switches 에 값을 쓴다.
// - setFlag 는 이번 웨이브의 16개 파일/화이트리스트 목표 밖에 남겨두되, legacy flags 쓰기
//   동작은 이 파일에서 함께 고정한다.
// - value 확장: boolean | "toggle" | { kind:"var", id } (0=OFF, 비0=ON).
describe("setSwitch.contract", () => {
  isolateTimers();
  function registerSwitch(project: Project, id: string): void {
    project.switches.push({ id, name: id });
  }
  describe("setSwitch 계약", () => {
    it("정상 효과: switch 값을 설정하고 같은 id 를 덮어쓸 수 있다", () => {
      const result = runCommandContract([
        { kind: "setSwitch", switchId: "sw_contract", value: true },
        { kind: "setSwitch", switchId: "sw_contract", value: false },
      ]);

      expect(result.session.switches.sw_contract).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 등록되지 않은 switchId 도 경고 없이 생성된다", () => {
      const result = runCommandContract([
        { kind: "setSwitch", switchId: "sw_missing_runtime", value: true },
        { kind: "setSwitch", switchId: "sw_missing_runtime", value: false },
      ]);

      expect(result.session.switches.sw_missing_runtime).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("legacy setFlag: flags 값을 설정하고 덮어쓴다", () => {
      const result = runCommandContract([
        { kind: "setFlag", flag: "legacy_flag_contract", value: true },
        { kind: "setFlag", flag: "legacy_flag_contract", value: false },
      ]);

      expect(result.session.flags.legacy_flag_contract).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: 등록된 switchId 는 serialize→deserialize 후 같은 결과를 낸다", () => {
      const commands: Command[] = [{ kind: "setSwitch", switchId: "sw_roundtrip_contract", value: true }];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands, (project) => registerSwitch(project, "sw_roundtrip_contract"));
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
    });

    it("pause 의미론: setSwitch 는 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract([{ kind: "setSwitch", switchId: "sw_pause_contract", value: true }]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("전환: 현재 스위치 값을 반전한다", () => {
      const result = runCommandContract([
        { kind: "setSwitch", switchId: "sw_toggle_contract", value: true },
        { kind: "setSwitch", switchId: "sw_toggle_contract", value: "toggle" },
        { kind: "setSwitch", switchId: "sw_toggle_contract", value: "toggle" },
      ]);

      // true → toggle(false) → toggle(true)
      expect(result.session.switches.sw_toggle_contract).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("변수 값: 0이면 OFF, 비0이면 ON", () => {
      const off = runCommandContract([
        { kind: "setVariable", variableId: "var_switch_src", op: "=", value: 0 },
        { kind: "setSwitch", switchId: "sw_from_var", value: { kind: "var", id: "var_switch_src" } },
      ]);
      expect(off.session.switches.sw_from_var).toBe(false);

      const on = runCommandContract([
        { kind: "setVariable", variableId: "var_switch_src", op: "=", value: 3 },
        { kind: "setSwitch", switchId: "sw_from_var", value: { kind: "var", id: "var_switch_src" } },
      ]);
      expect(on.session.switches.sw_from_var).toBe(true);
      expect(on.warnings).toEqual([]);
      expect(on.finished).toBe(true);
    });

    it("왕복 동일성: toggle/var 값도 serialize→deserialize 후 같다", () => {
      const commands: Command[] = [
        { kind: "setSwitch", switchId: "sw_roundtrip_toggle", value: "toggle" },
        { kind: "setSwitch", switchId: "sw_roundtrip_var", value: { kind: "var", id: "var_roundtrip" } },
      ];
      const mutate = (project: Project) => {
        registerSwitch(project, "sw_roundtrip_toggle");
        registerSwitch(project, "sw_roundtrip_var");
        project.variables.push({ id: "var_roundtrip", name: "var_roundtrip" });
      };
      const restored = roundtripCommands(commands, mutate);
      expect(restored).toEqual(commands);
    });
  });
});

// test/commandContracts/setVariable.contract.test.ts
// G1 계약: setVariable (스펙 §5.2 setFlag/setSwitch/setSelfSwitch/setVariable 행).
//
// 실측 메모 (§10.1):
// - 런타임은 variableId 존재 여부를 검증하지 않고 session.variables 에 값을 쓴다.
// - /= 는 Math.floor(cur / value) 이며, value=0 일 때 기존 값을 유지한다.
describe("setVariable.contract", () => {
  isolateTimers();
  function registerVariables(project: Project, ...ids: string[]): void {
    project.variables.push(...ids.map((id) => ({ id, name: id })));
  }
  describe("setVariable 계약", () => {
    it("정상 효과: = += -= *= /= 5종 연산자를 순서대로 적용하고 /= 는 Math.floor 한다", () => {
      const result = runCommandContract([
        { kind: "setVariable", variableId: "var_calc", op: "=", value: 7 },
        { kind: "setVariable", variableId: "var_calc", op: "+=", value: 5 },
        { kind: "setVariable", variableId: "var_calc", op: "-=", value: 2 },
        { kind: "setVariable", variableId: "var_calc", op: "*=", value: 3 },
        { kind: "setVariable", variableId: "var_calc", op: "/=", value: 4 },
      ]);

      expect(result.session.variables.var_calc).toBe(7); // floor(((7 + 5 - 2) * 3) / 4)
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: /= 0 은 기존 값을 유지한다", () => {
      const result = runCommandContract([
        { kind: "setVariable", variableId: "var_div_zero", op: "=", value: 9 },
        { kind: "setVariable", variableId: "var_div_zero", op: "/=", value: 0 },
      ]);

      expect(result.session.variables.var_div_zero).toBe(9);
      expect(result.warnings).toEqual(["[session] 변수 'var_div_zero' 0으로 나누기 무시됨"]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 등록되지 않은 variableId 도 경고 없이 생성된다", () => {
      const result = runCommandContract([
        { kind: "setVariable", variableId: "var_missing_runtime", op: "+=", value: 4 },
      ]);

      expect(result.session.variables.var_missing_runtime).toBe(4);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: 등록된 target/operand variableId 는 serialize→deserialize 후 같은 결과를 낸다", () => {
      const commands: Command[] = [
        { kind: "setVariable", variableId: "var_operand_source", op: "=", value: 6 },
        { kind: "setVariable", variableId: "var_operand_target", op: "=", value: 1 },
        { kind: "setVariable", variableId: "var_operand_target", op: "+=", value: { kind: "var", id: "var_operand_source" } },
      ];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands, (project) => {
        registerVariables(project, "var_operand_source", "var_operand_target");
      });
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
      expect(restored.session.variables.var_operand_target).toBe(7);
    });

    it("pause 의미론: setVariable 은 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract([{ kind: "setVariable", variableId: "var_pause_contract", op: "=", value: 1 }]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

describe("setWeather.contract", () => {
  isolateTimers();
  describe("setWeather 계약", () => {
    it("세션 화면 날씨를 정규화하고 플레이어 계층 setWeather step을 낸다", () => {
      const result = runCommandContract([
        { kind: "setWeather", weather: "storm", intensity: 0.75, transitionMs: 240 },
      ]);

      expect(result.session.m2Runtime?.screen.weather).toBe("storm,0.75");
      expect(result.pauses).toEqual([
        { kind: "setWeather", weather: "storm", intensity: 0.75, transitionMs: 240 },
      ]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 fog/none shape가 보존된다", () => {
      const commands: Command[] = [
        { kind: "setWeather", weather: "fog", intensity: 0.4, transitionMs: 160 },
        { kind: "setWeather", weather: "none", intensity: 0 },
      ];

      expect(roundtripCommands(commands)).toEqual(commands);
    });
  });
});

describe("showAnimation.contract", () => {
  isolateTimers();
  describe("showAnimation 계약", () => {
    it("대상/animationId/wait를 플레이어 계층 showAnimation step으로 넘긴다", () => {
      const result = runCommandContract([
        { kind: "showAnimation", target: { eventId: "ev_contract" }, animationId: "anim_hit", wait: true },
      ]);

      expect(result.pauses).toEqual([
        { kind: "showAnimation", target: { eventId: "ev_contract" }, animationId: "anim_hit", wait: true },
      ]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: player/event/position target shape가 보존된다", () => {
      const commands: Command[] = [
        { kind: "showAnimation", target: "player", animationId: "anim_hit" },
        { kind: "showAnimation", target: { eventId: "ev_contract" }, animationId: "anim_sword", wait: true },
        { kind: "showAnimation", target: { x: 3, y: 4 }, animationId: "anim_magic" },
      ];

      expect(roundtripCommands(commands)).toEqual(commands);
    });
  });
});

// test/commandContracts/text.contract.test.ts
// G1 계약: text (스펙 §5.1 행).
//
// 실측 메모:
// - text 는 항상 text pause 를 1회 발생시킨다. 빈 body 도 스킵되지 않는다.
// - pause payload 는 speaker/body 와 함께 현재 face/messageWindowSettings 상태를 전달한다.
describe("text.contract", () => {
  isolateTimers();
  describe("text 계약", () => {
    it("정상 효과: speaker/body 를 text pause 로 전달하고 끝까지 진행한다", () => {
      const result = runCommandContract([{ kind: "text", speaker: "Guide", body: "Hello" }]);

      expect(result.pauses).toEqual([
        expect.objectContaining({ kind: "text", speaker: "Guide", body: "Hello" }),
      ]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: 빈 body 여도 경고 없이 text pause 가 발생한다", () => {
      const result = runCommandContract([{ kind: "text", body: "" }]);

      expect(result.pauses).toEqual([expect.objectContaining({ kind: "text", body: "" })]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("연쇄: displayTextSettings/changeFace 상태가 이후 text pause 에 반영된다", () => {
      const commands: Command[] = [
        {
          kind: "displayTextSettings",
          format: "transparent",
          position: "top",
          preventObscuringPlayer: false,
          allowEventMovementDuringWait: true,
        },
        {
          kind: "changeFace",
          resourceId: "easyrpg-faceset-actor1-02",
          position: "right",
          flipHorizontally: true,
        },
        { kind: "text", body: "configured" },
      ];

      const result = runCommandContract(commands);

      expect(result.pauses).toMatchObject([
        {
          kind: "text",
          body: "configured",
          face: {
            resourceId: "easyrpg-faceset-actor1-02",
            position: "right",
            flipHorizontally: true,
          },
          settings: {
            format: "transparent",
            position: "top",
            preventObscuringPlayer: false,
            allowEventMovementDuringWait: true,
          },
        },
      ]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 pause 와 최종 세션이 같다", () => {
      const commands: Command[] = [{ kind: "text", speaker: "Round", body: "trip" }];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.pauses).toEqual(original.pauses);
      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
    });

    it("pause 의미론: blocking — pause 가 정확히 1회, kind=text", () => {
      const result = runCommandContract([{ kind: "text", body: "pause" }]);

      expect(result.pauses).toHaveLength(1);
      expect(result.pauses[0]?.kind).toBe("text");
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/timer.contract.test.ts
// G1 계약: timer (스펙 §5.2 행).
//
// 실측 메모 (§10.1):
// - timer set/start/stop 은 모두 timer pause 를 1회 발생시킨다.
// - set 은 seconds 기본값 0을 쓰고, start 는 seconds 가 있을 때만 세션 timer 값을 갱신한다.
//   stop 은 현재 인터프리터 계층에서는 세션 값을 지우지 않고 플레이어 계층에 pause 를 넘긴다.
describe("timer.contract", () => {
  isolateTimers();
  describe("timer 계약", () => {
    it("정상 효과: set/start/stop 상태 전이와 pause payload 를 고정한다", () => {
      const result = runCommandContract([
        { kind: "timer", action: "set", seconds: 30, timerId: "timer1" },
        { kind: "timer", action: "start", seconds: 60, timerId: "timer2" },
        { kind: "timer", action: "stop", timerId: "timer1" },
      ]);

      expect(result.session.timers.timer1).toBe(30);
      expect(result.session.timers.timer2).toBe(60);
      expect(result.pauses).toEqual([
        { kind: "timer", action: "set", seconds: 30, timerId: "timer1" },
        { kind: "timer", action: "start", seconds: 60, timerId: "timer2" },
        { kind: "timer", action: "stop", timerId: "timer1" },
      ]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: timerId 생략과 seconds 생략은 기본 동작으로 경고 없이 진행된다", () => {
      const result = runCommandContract([
        { kind: "timer", action: "set" },
        { kind: "timer", action: "start", timerId: "timer2" },
      ]);

      expect(result.session.timers.timer1).toBe(0);
      expect(result.session.timers.timer2).toBeUndefined();
      expect(result.pauses).toEqual([
        { kind: "timer", action: "set", seconds: undefined, timerId: "timer1" },
        { kind: "timer", action: "start", seconds: undefined, timerId: "timer2" },
      ]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("timer Condition 연동: set 후 fork(timer) 가 남은 초를 평가한다", () => {
      const result = runCommandContract([
        { kind: "timer", action: "set", seconds: 10, timerId: "timer1" },
        {
          kind: "fork",
          condition: { kind: "timer", timerId: "timer1", seconds: 10 },
          then: [{ kind: "setSwitch", switchId: "timer_ready", value: true }],
          else: [{ kind: "setSwitch", switchId: "timer_not_ready", value: true }],
        },
      ]);

      expect(result.session.switches.timer_ready).toBe(true);
      expect(result.session.switches.timer_not_ready).toBeUndefined();
      expect(result.pauses.map((pause) => pause.kind)).toEqual(["timer"]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 timer 상태와 pause 가 같다", () => {
      const commands: Command[] = [{ kind: "timer", action: "set", seconds: 45, timerId: "timer2" }];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual(original.pauses);
    });

    it("pause 의미론: timer 는 blocking handoff — 단일 명령당 pause 가 정확히 1회", () => {
      const result = runCommandContract([{ kind: "timer", action: "start", seconds: 5, timerId: "timer1" }]);

      expect(result.pauses).toHaveLength(1);
      expect(result.pauses[0]?.kind).toBe("timer");
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/tradeMonster.contract.test.ts
// 계약: tradeMonster (내줄 종 한 마리 → 받을 종).
describe("tradeMonster.contract", () => {
  isolateTimers();
  function seedBat(session: PlaySessionLike): void {
    const bat: MonsterInstance = { instanceId: "monster_1", speciesId: "species_cave_bat", level: 8, exp: 0, friendship: 70, caughtAt: { mapId: "m", x: 0, y: 0 } };
    session.monsterInstances = { monster_1: bat };
    session.monsterParty = ["monster_1"];
    session.monsterBox = [];
  }
  describe("tradeMonster 계약", () => {
    it("정상 효과: 내준 종이 사라지고 받은 종이 같은 레벨로 들어온다", () => {
      const result = runCommandContract([{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem" }], { mutateSession: seedBat });
      const instances = Object.values(result.session.monsterInstances ?? {});
      expect(instances.map((entry) => [entry.speciesId, entry.level])).toEqual([["species_stone_golem", 8]]);
      expect(result.session.flags.tradeMonsterSuccess).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 내줄 종이 없거나 받을 종이 없으면 아무것도 바꾸지 않는다", () => {
      const noOffer = runCommandContract([{ kind: "tradeMonster", fromSpeciesId: "species_wild_slime", toSpeciesId: "species_stone_golem" }], { mutateSession: seedBat });
      expect(Object.keys(noOffer.session.monsterInstances ?? {})).toEqual(["monster_1"]);
      expect(noOffer.session.flags.tradeMonsterSuccess).toBe(false);
      const missing = runCommandContract([{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_missing" }], { mutateSession: seedBat });
      expect(Object.keys(missing.session.monsterInstances ?? {})).toEqual(["monster_1"]);
      expect(missing.finished).toBe(true);
    });

    it("왕복 동일성 · pause 없음", () => {
      const commands: Command[] = [{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem", level: 4 }];
      expect(roundtripCommands(commands)).toEqual(commands);
      expect(runCommandContract(commands, { mutateSession: seedBat }).pauses).toEqual([]);
    });
  });
});

// test/commandContracts/wait.contract.test.ts
// G1 계약: wait (스펙 §5.2 행).
//
// 실측 메모 (§10.1):
// - wait 는 0/음수/거대값을 클램프하지 않고 항상 wait pause 를 발생시킨다.
describe("wait.contract", () => {
  isolateTimers();
  describe("wait 계약", () => {
    it("정상 효과: ms 값을 wait pause 로 전달하고 resume 후 다음 명령으로 진행한다", () => {
      const result = runCommandContract([
        { kind: "wait", ms: 250 },
        { kind: "setSwitch", switchId: "after_wait", value: true },
      ]);

      expect(result.pauses).toEqual([{ kind: "wait", ms: 250 }]);
      expect(result.session.switches.after_wait).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: 0/음수/거대값도 클램프 없이 각각 pause 된다", () => {
      const result = runCommandContract([
        { kind: "wait", ms: 0 },
        { kind: "wait", ms: -100 },
        { kind: "wait", ms: 1_000_000 },
      ]);

      expect(result.pauses).toEqual([
        { kind: "wait", ms: 0 },
        { kind: "wait", ms: -100 },
        { kind: "wait", ms: 1_000_000 },
      ]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 pause 와 세션이 같다", () => {
      const commands: Command[] = [{ kind: "wait", ms: 123 }];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.pauses).toEqual(original.pauses);
      expect(restored.session).toEqual(original.session);
    });

    it("pause 의미론: blocking — pause 가 정확히 1회, kind=wait", () => {
      const result = runCommandContract([{ kind: "wait", ms: 1 }]);

      expect(result.pauses).toHaveLength(1);
      expect(result.pauses[0]?.kind).toBe("wait");
      expect(result.finished).toBe(true);
    });

    it("variableId 가 있으면 세션 변수 값(ms)으로 wait pause 한다", () => {
      const variableId = "var_wait_ms";
      const result = runCommandContract(
        [
          { kind: "setVariable", variableId, op: "=", value: 750 },
          { kind: "wait", ms: 1, variableId },
          { kind: "setSwitch", switchId: "after_var_wait", value: true },
        ],
        {}
      );

      expect(result.pauses).toEqual([{ kind: "wait", ms: 750 }]);
      expect(result.session.switches.after_var_wait).toBe(true);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/cutsceneControl.contract.test.ts
// 계약: cutsceneControl.
describe("cutsceneControl.contract", () => {
  isolateTimers();
  describe("cutsceneControl 계약", () => {
    it("begin은 입력 잠금과 스킵 가능 상태를 세션에 기록한다", () => {
      const result = runCommandContract([{ kind: "cutsceneControl", mode: "begin", skippable: true }]);

      expect(result.session.flags[CUTSCENE_LOCK_FLAG]).toBe(true);
      expect(result.session.flags[CUTSCENE_SKIPPABLE_FLAG]).toBe(true);
      expect(result.session.m2Runtime?.cutscene.lockPlayer).toBe(true);
      expect(result.session.m2Runtime?.cutscene.skippable).toBe(true);
      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("end는 입력 잠금과 컷신 owner 플래그를 해제한다", () => {
      const result = runCommandContract([
        { kind: "cutsceneControl", mode: "begin", skippable: true },
        { kind: "cutsceneControl", mode: "end" },
      ]);

      expect(result.session.flags[CUTSCENE_LOCK_FLAG]).toBeUndefined();
      expect(result.session.flags[CUTSCENE_SKIPPABLE_FLAG]).toBeUndefined();
      expect(Object.keys(result.session.flags).some((key) => key.startsWith("cutscene:owner:"))).toBe(false);
      expect(result.session.m2Runtime?.cutscene.lockPlayer).toBe(false);
      expect(result.session.m2Runtime?.cutscene.skippable).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 세션 결과가 같다", () => {
      const commands: Command[] = [
        { kind: "cutsceneControl", mode: "begin", skippable: true },
        { kind: "cutsceneControl", mode: "end" },
      ];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
    });

    it("pause 의미론: cutsceneControl 은 non-blocking 이다", () => {
      const result = runCommandContract([{ kind: "cutsceneControl", mode: "begin" }]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/script.contract.test.ts
// 계약: script (TypeScript 를 컴파일한 JS 를 QuickJS 샌드박스에서 실행).
//
// 실측 메모:
// - 동기 game 호출(setSwitch·addGold…)은 같은 명령의 효과를 그대로 낸다.
// - await 하는 호출은 보통 명령으로 바뀌어 자식 프레임으로 돈다 — text/choices/wait pause 가 그대로 보인다.
// - 오류는 게임을 멈추지 않는다: "[Script error] …" 글 한 번 뒤 다음 명령으로 진행한다.
// - 컴파일 결과(compiled)가 비면 아무 일 없이 지나간다. 소스만 있고 compiled 가 없으면 오류 글.
// 컴파일러는 여기서 부르지 않는다(손으로 쓴 JS) — 컴파일 계약은 test/scriptCompile.test.ts.
describe("script.contract", () => {
  isolateTimers();
  function script(compiled: string, extra: Partial<Extract<Command, { kind: "script" }>> = {}): Command {
    return { kind: "script", source: "// ts", compiled, ...extra };
  }
  beforeAll(async () => {
    await preloadScriptEngine();
  });
  describe("script 계약", () => {
    it("정상 효과: 동기 호출은 즉시 세션을 바꾸고 다음 명령으로 진행한다", () => {
      const result = runCommandContract([
        script(`game.setSwitch("door", true); game.addGold(30); game.setVar("v", game.gold() + 1);`),
        { kind: "setSwitch", switchId: "after", value: true },
      ]);
      expect(result.session.switches).toMatchObject({ door: true, after: true });
      expect(result.session.gold).toBe(30);
      expect(result.session.variables.v).toBe(31);
      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("pause 의미론: await 호출은 text·choices·wait pause 로 보이고 선택 결과가 스크립트로 돌아온다", () => {
      const result = runCommandContract(
        [script(`await game.showMessage("Pull which lever?"); const pick = await game.showChoices(["left", "right"]); game.setVar("pick", pick); await game.wait(60);`)],
        { answers: [undefined, 1] }
      );
      expect(result.pauses.map((pause) => pause.kind)).toEqual(["text", "choices", "wait"]);
      expect(result.pauses[0]).toMatchObject({ kind: "text", body: "Pull which lever?" });
      expect(result.pauses[2]).toMatchObject({ kind: "wait", ms: 1000 });
      expect(result.session.variables.pick).toBe(1);
      expect(result.session.variables.__script_result).toBeUndefined();
      expect(result.finished).toBe(true);
    });

    it("경계: 빈 compiled 는 지나가고, 컴파일 안 된 소스는 오류 글 뒤 진행한다", () => {
      const empty = runCommandContract([{ kind: "script", source: "", compiled: "" }]);
      expect(empty.pauses).toEqual([]);
      expect(empty.finished).toBe(true);

      const uncompiled = runCommandContract([{ kind: "script", source: "game.addGold(1)", compiled: "" }]);
      expect(uncompiled.pauses).toHaveLength(1);
      expect(uncompiled.pauses[0]).toMatchObject({ kind: "text" });
      expect(String((uncompiled.pauses[0] as { body?: string }).body)).toContain("[Script error]");
      expect(uncompiled.finished).toBe(true);
    });

    it("오류는 게임을 멈추지 않는다: 예외 → 오류 글 → 다음 명령", () => {
      const result = runCommandContract([
        script(`game.setSwitch("before", true); throw new Error("boom");`),
        { kind: "setSwitch", switchId: "after", value: true },
      ]);
      expect(result.session.switches).toMatchObject({ before: true, after: true });
      expect(result.pauses).toHaveLength(1);
      expect(String((result.pauses[0] as { body?: string }).body)).toContain("boom");
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후에도 같은 결과", () => {
      const commands: Command[] = [
        script(`game.addVar("count", 2); await game.showMessage("n=" + game.getVar("count"));`, {
          name: "counter",
          summary: "변수 더하기 · 대사",
          effects: { reads: [{ kind: "variable", id: "count" }], writes: [{ kind: "variable", id: "count" }], calls: [], dynamic: [] },
          sourceHash: "0123456789abcdef",
          apiVersion: 1,
        }),
      ];
      const restored = roundtripCommands(commands);
      expect(restored).toEqual(commands);
      const original = runCommandContract(commands);
      const replay = runCommandContract(restored);
      expect(replay.pauses).toEqual(original.pauses);
      expect(replay.session.variables).toEqual(original.session.variables);
    });
  });
});

describe("m2Command.contract", () => {
  isolateTimers();
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
      const tileset = ownTileset(project, map.tilesetId);
      tileset.tileMeta ??= [];
      tileset.tileMeta[0] = { ...tileset.tileMeta[0], terrainTag: 9 };
    } }),
    contract("m2-043-get-event-id", { variableId: "event_result", x: 1, y: 1 }, (result) => {
      expect(result.session.variables.event_result).toBe(1);
    }),
    contract("m2-044-hide-screen", {}, (result) => {
      expect(result.session.m2Runtime?.screen.hidden).toBe(true);
      expect(result.pauses).toContainEqual({ kind: "wait", ms: HIDE_SHOW_SCREEN_FADE_MS });
    }),
    contract("m2-045-show-screen", {}, (result) => {
      expect(result.session.m2Runtime?.screen.hidden).toBe(false);
      expect(result.pauses).toContainEqual({ kind: "wait", ms: HIDE_SHOW_SCREEN_FADE_MS });
    }),
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
    // 승강기 타기·일지 한 줄(Fallen Star 1.22, #3509)도 맵 문맥 full 명령이다.
    contract("m2-226-lift-ride", { mode: "depart", direction: "up", distance: 5, durationMs: 3000, x: 2, y: 3, width: 2, depth: 2, se: "", wait: true }, (result) => {
      expect(result.pauses).toContainEqual(expect.objectContaining({ kind: "liftRide" }));
    }),
    contract("m2-227-journal-line", { action: "write", lineId: "oath", writer: "리아", date: "1일", text: "별이 떨어졌다." }, (result) => {
      expect(result.session.storyJournal).toContainEqual(expect.objectContaining({ id: "oath", text: "별이 떨어졌다.", state: "normal" }));
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
});

describe("playMovie.contract", () => {
  isolateTimers();
  describe("playMovie interpreter handoff contract", () => {
    it.each([true, false])("preserves wait=%s and blocks the sentinel until the host resumes", (wait) => {
      const project = freshBlankProject();
      const session = createContractSession(project);
      const command: Command = { kind: "playMovie", resourceId: "movie_contract", wait, skippable: false };
      const interpreter = createInterpreter([command, { kind: "setFlag", flag: "after", value: true }], session, project);
      expect(interpreter.start()).toEqual(command);
      expect(session.flags.after).toBeUndefined();
      expect(interpreter.resume()).toEqual({ kind: "done" });
      expect(session.flags.after).toBe(true);
      expect(commandRuntimeSupportDescriptor(command, "troop")).toMatchObject({ reasonCode: "not-executed-in-context" });
    });

    it("retains an empty resource and explicit playback options through project roundtrip", () => {
      const command: Command = { kind: "playMovie", resourceId: "", wait: false, skippable: false };
      expect(roundtripCommands([command])).toEqual([command]);
    });

    it("roundtrips a registered movie and still forwards its non-default playback controls", () => {
      const command: Command = { kind: "playMovie", resourceId: "movie_contract", wait: false, skippable: false };
      const restored = roundtripCommands([command], (project) => {
        project.assets.uploaded.movie_contract = {
          id: "movie_contract", name: "Contract movie", kind: "picture",
          dataUrl: "data:video/webm;base64,GkXfo0AgQoaBAULygQRC", meta: {},
        };
      });
      expect(restored).toEqual([command]);
      const project = freshBlankProject();
      const interpreter = createInterpreter(restored, createContractSession(project), project);
      expect(interpreter.start()).toEqual(command);
    });
  });
});

describe("openCraftShop.contract", () => {
  isolateTimers();
  function craftProject(): Project {
    const project = freshBlankProject();
    project.database.items.push(
      { ...project.database.items[0]!, id: "ore", name: "광석" },
      { ...project.database.items[0]!, id: "ingot", name: "주괴" },
    );
    project.system.craftRecipes = [
      { id: "smelt", name: "제련", ingredients: [{ itemId: "ore", count: 2 }], outputItemId: "ingot", outputCount: 1, goldCost: 5 },
      { id: "big", name: "큰 제련", ingredients: [{ itemId: "ore", count: 9 }], outputItemId: "ingot", outputCount: 3 },
    ];
    return project;
  }
  const shop = (extra: Partial<Extract<Command, { kind: "openCraftShop" }>> = {}): Command => ({ kind: "openCraftShop", ...extra });
  function asShop(step: StepResult): Extract<StepResult, { kind: "craftShop" }> {
    if (step.kind !== "craftShop") throw new Error(`expected craftShop, got ${step.kind}`);
    return step;
  }
  describe("openCraftShop interpreter contract", () => {
    it("lists every recipe with counts, disables the unaffordable one, crafts, reopens with a notice and leaves to the next command", () => {
      const project = craftProject();
      const session = createContractSession(project);
      session.inventory = { ore: 4 };
      session.gold = 7;
      const interp = createInterpreter([shop(), { kind: "setFlag", flag: "after", value: true }], session, project);

      const first = asShop(interp.start());
      expect(first.rows.map((row) => [row.recipeId, row.disabledReason ?? null])).toEqual([["smelt", null], ["big", "재료 부족: 광석 5"]]);
      // 재료 줄은 아이템의 아이콘(iconResourceId → imageResourceId)도 싣는다(144b3c68f7 이후 craftShop.ts) — 복제한 기본 아이템의 아이콘이 따라온다.
      const oreItem = project.database.items.find((item) => item.id === "ore")!;
      const iconResourceId = oreItem.iconResourceId ?? oreItem.imageResourceId;
      expect(first.rows[0]!.ingredients).toEqual([{ itemId: "ore", name: "광석", need: 2, have: 4, ...(iconResourceId ? { iconResourceId } : {}) }]);
      expect(first.notice).toBeUndefined();

      const second = asShop(interp.resume("smelt"));
      expect(session.inventory).toMatchObject({ ore: 2, ingot: 1 });
      expect(session.gold).toBe(2);
      expect(second.notice).toEqual({ ok: true, text: "「주괴」를 받았다." });
      expect(second.rows[0]!.disabledReason).toBe("3G 부족");

      const third = asShop(interp.resume("smelt"));
      expect(third.notice?.ok).toBe(false);
      expect(session.inventory).toMatchObject({ ore: 2, ingot: 1 });
      expect(session.flags.after).toBeUndefined();

      expect(interp.resume(undefined)).toEqual({ kind: "done" });
      expect(session.flags.after).toBe(true);
    });

    it("reports how many times each recipe fits and crafts a quantity step in one pick without touching the session while counting", () => {
      const project = craftProject();
      const session = createContractSession(project);
      session.inventory = { ore: 7 };
      session.gold = 100;
      const interp = createInterpreter([shop()], session, project);
      const first = asShop(interp.start());
      expect(first.rows.map((row) => [row.recipeId, row.maxCrafts, row.owned])).toEqual([["smelt", 3, 0], ["big", 0, 0]]);
      expect(session.inventory).toEqual({ ore: 7 });
      expect(session.gold).toBe(100);

      const second = asShop(interp.resume(["smelt", "2"]));
      expect(session.inventory).toMatchObject({ ore: 3, ingot: 2 });
      expect(session.gold).toBe(90);
      expect(second.notice).toEqual({ ok: true, text: "「주괴 2개」를 받았다." });
      expect(second.rows[0]!.maxCrafts).toBe(1);

      const third = asShop(interp.resume(["smelt", "5"]));
      expect(session.inventory).toMatchObject({ ore: 1, ingot: 3 });
      expect(third.notice?.ok).toBe(true);
    });

    it("shows only the named recipes and refuses an id outside that list", () => {
      const project = craftProject();
      const session = createContractSession(project);
      session.inventory = { ore: 20 };
      const interp = createInterpreter([shop({ recipeIds: ["big"] })], session, project);
      expect(asShop(interp.start()).rows.map((row) => row.recipeId)).toEqual(["big"]);
      expect(asShop(interp.resume("smelt")).notice?.ok).toBe(false);
      expect(session.inventory.ore).toBe(20);
    });

    it("passes through without a window when no recipe can be shown", () => {
      const project = freshBlankProject();
      const session = createContractSession(project);
      const interp = createInterpreter([shop(), { kind: "setFlag", flag: "after", value: true }], session, project);
      expect(interp.start()).toEqual({ kind: "done" });
      expect(session.flags.after).toBe(true);
    });

    it("survives project roundtrip", () => {
      const command = shop({ recipeIds: ["recipe_contract"], title: "공방", speaker: "니나" });
      expect(roundtripCommands([command])).toEqual([command]);
    });

    it("is an error in project lint when the list is empty or names a missing recipe", () => {
      const project = craftProject();
      const map = Object.values(project.maps)[0]!;
      map.events.push({ id: "ev_bad", name: "bad", x: 1, y: 1, trigger: { kind: "action" }, commands: [shop({ recipeIds: [] }), shop({ recipeIds: ["ghost"] })], pages: [] });
      const codes = projectLint(project, { skipRoundtrip: true }).filter((issue) => issue.code.startsWith("openCraftShop")).map((issue) => [issue.severity, issue.code]);
      expect(codes).toEqual([["error", "openCraftShop.empty"], ["error", "openCraftShop.unknown-recipe"], ["error", "openCraftShop.empty"]]);
    });
  });
});
