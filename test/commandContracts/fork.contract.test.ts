import { describe, expect, it } from "vitest";
import type { Command, Project, EventPage, EventPageCondition, GameEvent, Condition } from "@/project/types";
import { roundtripCommands, runCommandContract, CONTRACT_EVENT_ID } from "./harness";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { freshBlankProject } from "../support/blankProject";
import type { MonsterInstance } from "@/project/session";
import { isolateTimers } from "../mergedTeardown";

describe("addLight.contract", () => {
  isolateTimers();
  describe("addLight 계약", () => {
    it("같은 id의 광원을 교체하고 값 범위를 정규화한다", () => {
      const result = runCommandContract([
        { kind: "addLight", source: { id: "lamp", at: { x: 1, y: 2 }, radius: 3, intensity: 0.5 } },
        { kind: "addLight", source: { id: "lamp", at: "player", radius: 4, intensity: 2, flicker: true } },
      ]);

      expect(result.session.lighting).toEqual({
        ambient: 0,
        sources: [{ id: "lamp", at: "player", radius: 4, intensity: 1, flicker: true }],
      });
      expect(result.pauses).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 player/event/position anchor가 보존된다", () => {
      const commands: Command[] = [
        { kind: "addLight", source: { id: "flashlight", at: "player", radius: 5, intensity: 1 } },
        { kind: "addLight", source: { id: "eventLamp", at: { eventId: "ev_contract" }, radius: 2 } },
        { kind: "addLight", source: { id: "floor", at: { x: 3, y: 4 }, radius: 1.5, color: "#ffaa66" } },
      ];

      expect(roundtripCommands(commands)).toEqual(commands);
    });
  });
});

// test/commandContracts/breakLoop.contract.test.ts
// G1 계약: breakLoop (스펙 §5.2 loop/breakLoop 행).
//
// 실측 메모 (§3 이탈 프로토콜):
// - §5 표 초안은 "루프 밖 breakLoop → warn + no-op"이라 했으나, 실제 구현(stack.ts breakLoop)은
//   루프 프레임을 찾을 때까지 스택을 전부 pop 하므로 "경고 없이 이벤트 전체 종료"다.
//   RM2003(EasyRPG RPG_RT) 의 Break Loop 도 짝이 되는 End Loop 가 없으면 리스트 끝으로
//   점프(=이벤트 종료)하므로 명백한 버그로 볼 수 없다 → 코드 유지, ⚠ 판정 보류로 보고서에 기록.
//   이 파일의 케이스 2는 실측 동작을 고정한다.
describe("breakLoop.contract", () => {
  isolateTimers();
  // 카운터가 limit 에 도달하면 breakLoop 로 탈출하고, 루프 뒤 명령으로 계속 진행하는 프로그램.
  function counterLoopProgram(counterId: string, afterId: string, limit: number): Command[] {
    return [
      { kind: "setVariable", variableId: counterId, op: "=", value: 0 },
      {
        kind: "loop",
        body: [
          { kind: "setVariable", variableId: counterId, op: "+=", value: 1 },
          {
            kind: "fork",
            condition: { kind: "variable", variableId: counterId, op: ">=", value: limit },
            then: [{ kind: "breakLoop" }],
          },
        ],
      },
      { kind: "setVariable", variableId: afterId, op: "=", value: 99 },
    ];
  }
  describe("breakLoop 계약", () => {
    it("정상 효과: 최근접 루프를 탈출하고 루프 다음 명령이 실행된다 (정확히 N회 반복)", () => {
      const result = runCommandContract(counterLoopProgram("counter", "after", 3));

      expect(result.session.variables.counter).toBe(3);
      expect(result.session.variables.after).toBe(99);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("중첩 루프: 안쪽 breakLoop 는 안쪽 루프만 탈출하고 바깥 루프는 계속 돈다", () => {
      const commands: Command[] = [
        { kind: "setVariable", variableId: "outer", op: "=", value: 0 },
        {
          kind: "loop",
          body: [
            { kind: "setVariable", variableId: "outer", op: "+=", value: 1 },
            // 안쪽 루프는 즉시 탈출 — 바깥 루프에 영향이 없어야 한다.
            {
              kind: "loop",
              body: [
                { kind: "setVariable", variableId: "inner", op: "+=", value: 1 },
                { kind: "breakLoop" },
              ],
            },
            {
              kind: "fork",
              condition: { kind: "variable", variableId: "outer", op: ">=", value: 2 },
              then: [{ kind: "breakLoop" }],
            },
          ],
        },
        { kind: "setVariable", variableId: "after", op: "=", value: 1 },
      ];

      const result = runCommandContract(commands);

      expect(result.session.variables.outer).toBe(2);
      expect(result.session.variables.inner).toBe(2); // 바깥 반복마다 1회씩
      expect(result.session.variables.after).toBe(1);
      expect(result.finished).toBe(true);
    });

    it("경계(루프 밖 breakLoop): 한 번 경고하고 다음 명령으로 진행한다", () => {
      const result = runCommandContract([
        { kind: "setVariable", variableId: "before", op: "=", value: 1 },
        { kind: "breakLoop" },
        { kind: "setVariable", variableId: "after", op: "=", value: 2 },
      ]);

      // Malformed authored data must not destroy the event stack or stall on the
      // same instruction. Warn once, skip the invalid command, and keep going.
      expect(result.session.variables.before).toBe(1);
      expect(result.session.variables.after).toBe(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("breakLoop");
      expect(result.finished).toBe(true);
    });

    it("무한루프 방지: breakLoop 없는 루프는 하네스 maxSteps 안전핀이 실패시킨다", () => {
      const commands: Command[] = [
        { kind: "loop", body: [{ kind: "wait", ms: 1 }] },
      ];
      expect(() => runCommandContract(commands, { maxSteps: 20 })).toThrow(/maxSteps/);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const program = counterLoopProgram("var_loop_counter", "var_loop_after", 4);
      const registerVariables = (project: { variables: { id: string; name: string }[] }) => {
        project.variables.push(
          { id: "var_loop_counter", name: "계약 카운터" },
          { id: "var_loop_after", name: "계약 이후" }
        );
      };

      const original = runCommandContract(program);
      const restored = runCommandContract(roundtripCommands(program, registerVariables));

      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
      expect(original.session.variables.var_loop_counter).toBe(4);
    });

    it("pause 의미론: loop/breakLoop 는 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract(counterLoopProgram("counter", "after", 5));

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/callCommonEvent.contract.test.ts
// G1 계약: callCommonEvent (스펙 §5.2 행).
//
// 실측 메모:
// - 런타임은 project.commonEvents 가 아니라 session.commonEvents 로 복사된 명령을 실행한다.
// - 없는 id 와 재귀 한도는 [interpreter] warn 후 현재 프레임 다음 명령으로 진행한다.
describe("callCommonEvent.contract", () => {
  isolateTimers();
  const COMMON_EVENT_ID = "ce_contract";
  function seedCommonEvent(commands: Command[] = [{ kind: "setSwitch", switchId: "common_called", value: true }]) {
    return (session: PlaySessionLike) => {
      session.commonEvents = [{ id: COMMON_EVENT_ID, commands }];
    };
  }
  function registerCommonEvent(project: Project): void {
    project.commonEvents.push({ id: COMMON_EVENT_ID, name: "Contract Common", trigger: "none", commands: [] });
  }
  describe("callCommonEvent 계약", () => {
    it("정상 효과: 공통 이벤트 프레임을 push 하고 완료 후 호출자 다음 명령으로 복귀한다", () => {
      const result = runCommandContract(
        [
          { kind: "callCommonEvent", commonEventId: COMMON_EVENT_ID },
          { kind: "setSwitch", switchId: "after_common", value: true },
        ],
        { mutateSession: seedCommonEvent() }
      );

      expect(result.session.switches.common_called).toBe(true);
      expect(result.session.switches.after_common).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 commonEventId 는 warn 후 다음 명령으로 진행한다", () => {
      const result = runCommandContract([
        { kind: "callCommonEvent", commonEventId: "ce_missing_contract" },
        { kind: "setSwitch", switchId: "after_missing_common", value: true },
      ]);

      expect(result.session.switches.after_missing_common).toBe(true);
      expect(result.warnings.some((message) => message.includes("[interpreter]"))).toBe(true);
      expect(result.warnings.some((message) => message.includes("공통 이벤트 없음"))).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("재귀 한도: 자기 자신을 호출하는 common event 는 warn 후 호출자 흐름을 계속한다", () => {
      const result = runCommandContract(
        [
          { kind: "callCommonEvent", commonEventId: COMMON_EVENT_ID },
          { kind: "setSwitch", switchId: "after_common_recursion", value: true },
        ],
        {
          mutateSession: seedCommonEvent([{ kind: "callCommonEvent", commonEventId: COMMON_EVENT_ID }]),
        }
      );

      expect(result.session.switches.after_common_recursion).toBe(true);
      expect(result.warnings.some((message) => message.includes("common event recursion limit"))).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: 등록된 commonEventId 는 serialize→deserialize 후 같은 결과를 낸다", () => {
      const commands: Command[] = [{ kind: "callCommonEvent", commonEventId: COMMON_EVENT_ID }];

      const original = runCommandContract(commands, { mutateSession: seedCommonEvent() });
      const restoredCommands = roundtripCommands(commands, registerCommonEvent);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { mutateSession: seedCommonEvent() });

      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual([]);
    });

    it("pause 의미론: callCommonEvent 자체는 non-blocking — 호출된 명령도 non-blocking 이면 pause 가 없다", () => {
      const result = runCommandContract([{ kind: "callCommonEvent", commonEventId: COMMON_EVENT_ID }], {
        mutateSession: seedCommonEvent(),
      });

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/callMapEvent.contract.test.ts
// G1 계약: callMapEvent (스펙 §5.2 행).
//
// 실측 메모:
// - 현재 맵의 이벤트를 찾아 활성 page commands 를 실행한다.
// - pages 가 없거나 활성 page 가 없으면 top-level event.commands 로 폴백한다.
// - 없는 eventId 와 재귀 한도는 [interpreter] warn 후 호출자 다음 명령으로 진행한다.
describe("callMapEvent.contract", () => {
  isolateTimers();
  function page(id: string, conditions: readonly EventPageCondition[], commands: readonly Command[]): EventPage {
    return {
      id,
      name: id,
      conditions: [...conditions],
      graphic: { transparent: true },
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [...commands],
    };
  }
  function event(id: string, commands: readonly Command[], pages?: readonly EventPage[]): GameEvent {
    return {
      id,
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [...commands],
      ...(pages ? { pages: [...pages] } : {}),
    };
  }
  function addMapEvent(project: Project, mapEvent: GameEvent): void {
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("contract project must have start map");
    map.events.push(mapEvent);
  }
  describe("callMapEvent 계약", () => {
    it("정상 효과: 활성 page commands 를 실행하고 호출자 다음 명령으로 복귀한다", () => {
      const result = runCommandContract(
        [
          { kind: "callMapEvent", eventId: "ev_paged_contract" },
          { kind: "setSwitch", switchId: "after_map_event", value: true },
        ],
        {
          mutateProject: (project) => {
            addMapEvent(project, event(
              "ev_paged_contract",
              [{ kind: "setSwitch", switchId: "map_event_top_level", value: true }],
              [
                page("page_base", [], [{ kind: "setSwitch", switchId: "map_event_base_page", value: true }]),
                page(
                  "page_active",
                  [{ kind: "switch", switchId: "sw_page_active", value: true }],
                  [{ kind: "setSwitch", switchId: "map_event_active_page", value: true }]
                ),
              ]
            ));
          },
          mutateSession: (session) => {
            session.switches.sw_page_active = true;
          },
        }
      );

      expect(result.session.switches.map_event_active_page).toBe(true);
      expect(result.session.switches.map_event_base_page).toBeUndefined();
      expect(result.session.switches.map_event_top_level).toBeUndefined();
      expect(result.session.switches.after_map_event).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("페이지 폴백: 활성 page 가 없으면 top-level commands 를 실행한다", () => {
      const result = runCommandContract([{ kind: "callMapEvent", eventId: "ev_page_fallback" }], {
        mutateProject: (project) => {
          addMapEvent(project, event(
            "ev_page_fallback",
            [{ kind: "setSwitch", switchId: "map_event_fallback", value: true }],
            [
              page(
                "page_unmet",
                [{ kind: "switch", switchId: "sw_page_unmet", value: true }],
                [{ kind: "setSwitch", switchId: "map_event_unmet_page", value: true }]
              ),
            ]
          ));
        },
      });

      expect(result.session.switches.map_event_fallback).toBe(true);
      expect(result.session.switches.map_event_unmet_page).toBeUndefined();
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 eventId 는 warn 후 다음 명령으로 진행한다", () => {
      const result = runCommandContract([
        { kind: "callMapEvent", eventId: "ev_missing_contract" },
        { kind: "setSwitch", switchId: "after_missing_map_event", value: true },
      ]);

      expect(result.session.switches.after_missing_map_event).toBe(true);
      expect(result.warnings.some((message) => message.includes("[interpreter]"))).toBe(true);
      expect(result.warnings.some((message) => message.includes("맵 이벤트 없음"))).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("재귀 한도: 자기 자신을 호출하는 map event 는 warn 후 호출자 흐름을 계속한다", () => {
      const result = runCommandContract(
        [
          { kind: "callMapEvent", eventId: "ev_map_recursive" },
          { kind: "setSwitch", switchId: "after_map_recursion", value: true },
        ],
        {
          mutateProject: (project) => {
            addMapEvent(project, event("ev_map_recursive", [{ kind: "callMapEvent", eventId: "ev_map_recursive" }]));
          },
        }
      );

      expect(result.session.switches.after_map_recursion).toBe(true);
      expect(result.warnings.some((message) => message.includes("map event recursion limit"))).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 호출 결과가 같다", () => {
      const commands: Command[] = [{ kind: "callMapEvent", eventId: "ev_map_roundtrip" }];
      const mutateProject = (project: Project) => {
        addMapEvent(project, event("ev_map_roundtrip", [{ kind: "setSwitch", switchId: "map_roundtrip_called", value: true }]));
      };

      const original = runCommandContract(commands, { mutateProject });
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { mutateProject });

      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual([]);
    });

    it("pause 의미론: callMapEvent 자체는 non-blocking — 호출된 명령도 non-blocking 이면 pause 가 없다", () => {
      const result = runCommandContract([{ kind: "callMapEvent", eventId: "ev_map_pause" }], {
        mutateProject: (project) => {
          addMapEvent(project, event("ev_map_pause", [{ kind: "setSwitch", switchId: "map_pause_called", value: true }]));
        },
      });

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/changeFace.contract.test.ts
// G1 계약: changeFace (스펙 §5.1 행).
//
// 실측 메모:
// - 런타임은 resourceId 존재 여부를 검증하지 않는다. 빈 resourceId 는 face 상태를 지우고,
//   truthy resourceId 는 프로젝트 리소스 등록 여부와 무관하게 이후 text pause 에 전달된다.
describe("changeFace.contract", () => {
  isolateTimers();
  // 얼굴 한 칸 = 파일 한 장. 시트 id + 칸 번호 짝은 없어졌고 낱장 얼굴 리소스 id 하나만 남는다.
  const FACE_COMMAND: Extract<Command, { kind: "changeFace" }> = {
    kind: "changeFace",
    resourceId: "easyrpg-faceset-actor1-01",
    position: "left",
    flipHorizontally: false,
  };
  describe("changeFace 계약", () => {
    it("정상 효과: 이후 text pause 의 face 상태를 변경한다", () => {
      const result = runCommandContract([FACE_COMMAND, { kind: "text", body: "face" }]);

      expect(result.pauses).toEqual([
        expect.objectContaining({
          kind: "text",
          body: "face",
          face: {
            resourceId: "easyrpg-faceset-actor1-01",
            position: "left",
            flipHorizontally: false,
          },
        }),
      ]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 resourceId 도 경고 없이 그대로 face 상태로 전달된다 — 실측 고정", () => {
      const result = runCommandContract([
        { ...FACE_COMMAND, resourceId: "missing-face-resource" },
        { kind: "text", body: "missing" },
      ]);

      expect(result.pauses[0]).toMatchObject({
        kind: "text",
        face: { resourceId: "missing-face-resource" },
      });
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: 빈 resourceId 는 현재 face 상태를 지우고 text 는 face 없이 진행된다", () => {
      const result = runCommandContract([
        FACE_COMMAND,
        { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false },
        { kind: "text", body: "cleared" },
      ]);

      expect(result.pauses).toEqual([
        expect.objectContaining({ kind: "text", body: "cleared", face: undefined }),
      ]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 text pause 의 face 가 같다", () => {
      const commands: Command[] = [FACE_COMMAND, { kind: "text", body: "roundtrip" }];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.pauses).toEqual(original.pauses);
      expect(restored.session).toEqual(original.session);
    });

    it("pause 의미론: changeFace 자체는 non-blocking — 단독 실행 시 pause 가 없다", () => {
      const result = runCommandContract([FACE_COMMAND]);

      expect(result.pauses).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/changeFriendship.contract.test.ts
// G1 계약: changeFriendship (Phase 11b NPC 호감도 커맨드).
describe("changeFriendship.contract", () => {
  isolateTimers();
  describe("changeFriendship 계약", () => {
    it("정상 효과: 명시 npcKey의 호감도를 증감하고 0..1000으로 클램프한다", () => {
      const result = runCommandContract([
        { kind: "changeFriendship", npcKey: "ev_farmer", delta: 1100 },
        { kind: "changeFriendship", npcKey: "ev_farmer", delta: -1200 },
        { kind: "changeFriendship", npcKey: "ev_farmer", delta: 25 },
      ]);

      expect(result.session.friendship).toEqual({ ev_farmer: 25 });
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("self fallback: npcKey 생략 시 characterId를 사용한다", () => {
      const result = runCommandContract([{ kind: "changeFriendship", delta: 40 }], {
        mutateProject: (project) => {
          const event = project.maps[project.startMapId]?.events.find((entry) => entry.id === CONTRACT_EVENT_ID);
          if (event) event.characterId = CONTRACT_EVENT_ID;
        },
      });

      expect(result.session.friendship?.[CONTRACT_EVENT_ID]).toBe(40);
      expect(result.finished).toBe(true);
    });

    it("self without characterId: 세션을 변경하지 않는다", () => {
      const result = runCommandContract([{ kind: "changeFriendship", delta: 40 }]);

      expect(result.session.friendship).toBeUndefined();
      expect(result.finished).toBe(true);
    });

    it("이벤트 컨텍스트 없음: npcKey도 currentEventId도 없으면 세션을 변경하지 않는다", () => {
      const result = runCommandContract([{ kind: "changeFriendship", delta: 40 }], { currentEventId: null });

      expect(result.session.friendship).toBeUndefined();
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const commands: Command[] = [{ kind: "changeFriendship", npcKey: "ev_farmer", delta: 80 }];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
    });

    it("pause 의미론: changeFriendship 은 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract([{ kind: "changeFriendship", npcKey: "ev_farmer", delta: 1 }]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/changeLifeSkillExp.contract.test.ts
// 계약: changeLifeSkillExp (생활 스킬 XP). system.skillSystem.enabled 옵트인 게이트를 포함한다.
describe("changeLifeSkillExp.contract", () => {
  isolateTimers();
  const SKILL_ID = "skill_farming";
  const REWARD_SWITCH = "sw_farming_lv2";
  function enableSkillSystem(project: Project): void {
    project.system.skillSystem = { enabled: true };
    project.database.lifeSkills = [
      {
        id: SKILL_ID,
        name: "농사",
        skillType: "farming",
        maxLevel: 10,
        levelUpRewards: [{ level: 2, switchId: REWARD_SWITCH }],
      },
    ];
    project.switches.push({ id: REWARD_SWITCH, name: "농사 레벨 2" });
  }
  function withSkillsButDisabled(project: Project): void {
    enableSkillSystem(project);
    delete project.system.skillSystem;
  }
  describe("changeLifeSkillExp 계약", () => {
    it("정상 효과: XP 를 누적하고 레벨을 갱신한다", () => {
      const result = runCommandContract(
        [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 100 }],
        { mutateProject: enableSkillSystem }
      );

      expect(result.session.lifeSkills?.[SKILL_ID]).toEqual({ xp: 100, level: 2 });
      expect(result.finished).toBe(true);
    });

    it("레벨업 보상 스위치가 켜진다", () => {
      const result = runCommandContract(
        [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 250 }],
        { mutateProject: enableSkillSystem }
      );

      expect(result.session.switches[REWARD_SWITCH]).toBe(true);
    });

    it("XP 는 0 미만으로 내려가지 않는다", () => {
      const result = runCommandContract(
        [
          { kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "=", amount: 50 },
          { kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "-=", amount: 999 },
        ],
        { mutateProject: enableSkillSystem }
      );

      expect(result.session.lifeSkills?.[SKILL_ID]).toEqual({ xp: 0, level: 1 });
    });

    // 회귀: 게이트를 읽는 코드가 없어 "opt-in" 문서와 달리 항상 동작했다.
    it("옵트인 게이트: skillSystem 이 꺼져 있으면 세션을 변경하지 않는다", () => {
      const result = runCommandContract(
        [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 100 }],
        { mutateProject: withSkillsButDisabled }
      );

      expect(result.session.lifeSkills?.[SKILL_ID]).toBeUndefined();
      expect(result.session.switches[REWARD_SWITCH]).not.toBe(true);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const commands: Command[] = [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 120 }];

      const original = runCommandContract(commands, { mutateProject: enableSkillSystem });
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { mutateProject: enableSkillSystem });

      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
    });

    it("pause 의미론: non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract(
        [{ kind: "changeLifeSkillExp", skillId: SKILL_ID, op: "+=", amount: 1 }],
        { mutateProject: enableSkillSystem }
      );

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/choices.contract.test.ts
// G1 계약: choices (스펙 §5.1 행).
//
// 실측 메모 (§10.1):
// - 빈 options 도 경고 없이 choices pause 를 발생시킨 뒤 다음 명령으로 진행한다.
describe("choices.contract", () => {
  isolateTimers();
  function choiceCommand(prefix: string): Extract<Command, { kind: "choices" }> {
    return {
      kind: "choices",
      prompt: "pick",
      options: [
        { text: "A", branch: [{ kind: "setSwitch", switchId: `${prefix}_a`, value: true }] },
        { text: "B", branch: [{ kind: "setSwitch", switchId: `${prefix}_b`, value: true }] },
        { text: "C", branch: [{ kind: "setSwitch", switchId: `${prefix}_c`, value: true }] },
      ],
    };
  }
  function registerChoiceSwitches(project: Project, prefix: string): void {
    project.switches.push(
      { id: `${prefix}_a`, name: "choice A" },
      { id: `${prefix}_b`, name: "choice B" },
      { id: `${prefix}_c`, name: "choice C" }
    );
  }
  describe("choices 계약", () => {
    it.each([
      [0, "a"],
      [1, "b"],
      [2, "c"],
    ] as const)("정상 효과: 선택 인덱스 %i 의 branch 만 실행한다", (answer, selected) => {
      const result = runCommandContract([choiceCommand("choice")], { answers: [answer] });

      expect(result.session.switches[`choice_${selected}`]).toBe(true);
      for (const key of ["a", "b", "c"]) {
        if (key !== selected) expect(result.session.switches[`choice_${key}`]).toBeUndefined();
      }
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: 빈 options 는 무경고 choices pause 후 다음 명령으로 진행한다", () => {
      const result = runCommandContract([
        { kind: "choices", prompt: "empty", options: [] },
        { kind: "setSwitch", switchId: "after_empty_choices", value: true },
      ]);

      expect(result.pauses).toEqual([
        expect.objectContaining({ kind: "choices", prompt: "empty", options: [] }),
      ]);
      expect(result.session.switches.after_empty_choices).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 선택 branch 결과가 같다", () => {
      const commands: Command[] = [choiceCommand("choice_roundtrip")];
      const register = (project: Project) => registerChoiceSwitches(project, "choice_roundtrip");

      const original = runCommandContract(commands, { answers: [2] });
      const restoredCommands = roundtripCommands(commands, register);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { answers: [2] });

      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual(original.pauses);
    });

    it("pause 의미론: blocking — pause 가 정확히 1회, kind=choices", () => {
      const result = runCommandContract([choiceCommand("pause_choice")], { answers: [1] });

      expect(result.pauses).toHaveLength(1);
      expect(result.pauses[0]?.kind).toBe("choices");
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/displayTextSettings.contract.test.ts
// G1 계약: displayTextSettings (스펙 §5.1 행).
//
// 실측 메모:
// - session.messageWindowSettings 를 갱신하고 이후 text/choices/inputNumber pause 에 전달된다.
describe("displayTextSettings.contract", () => {
  isolateTimers();
  const SETTINGS: Extract<Command, { kind: "displayTextSettings" }> = {
    kind: "displayTextSettings",
    format: "transparent",
    position: "center",
    preventObscuringPlayer: false,
    allowEventMovementDuringWait: true,
  };
  describe("displayTextSettings 계약", () => {
    it("정상 효과: 세션 messageWindowSettings 를 갱신하고 이후 text pause 에 반영한다", () => {
      const result = runCommandContract([SETTINGS, { kind: "text", body: "settings" }]);

      expect(result.session.messageWindowSettings).toEqual({
        format: "transparent",
        position: "center",
        preventObscuringPlayer: false,
        allowEventMovementDuringWait: true,
      });
      expect(result.pauses).toEqual([
        expect.objectContaining({ kind: "text", body: "settings", settings: result.session.messageWindowSettings }),
      ]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("경계: 모든 boolean 옵션 false 조합도 경고 없이 적용된다", () => {
      const result = runCommandContract([
        {
          kind: "displayTextSettings",
          format: "normal",
          position: "bottom",
          preventObscuringPlayer: false,
          allowEventMovementDuringWait: false,
        },
        { kind: "text", body: "bottom" },
      ]);

      expect(result.pauses[0]).toMatchObject({
        kind: "text",
        settings: {
          format: "normal",
          position: "bottom",
          preventObscuringPlayer: false,
          allowEventMovementDuringWait: false,
        },
      });
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("연쇄: 갱신된 settings 가 choices 와 inputNumber pause 에도 전달된다", () => {
      const result = runCommandContract(
        [
          SETTINGS,
          { kind: "choices", options: [{ text: "go", branch: [] }] },
          { kind: "inputNumber", variableId: "var_after_settings", digits: 2 },
        ],
        { answers: [0, 12] }
      );

      expect(result.pauses[0]).toMatchObject({ kind: "choices", settings: result.session.messageWindowSettings });
      expect(result.pauses[1]).toMatchObject({ kind: "inputNumber", settings: result.session.messageWindowSettings });
      expect(result.session.variables.var_after_settings).toBe(12);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 settings 와 pause 가 같다", () => {
      const commands: Command[] = [SETTINGS, { kind: "text", body: "roundtrip settings" }];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual(original.pauses);
    });

    it("pause 의미론: displayTextSettings 자체는 non-blocking — 단독 실행 시 pause 가 없다", () => {
      const result = runCommandContract([SETTINGS]);

      expect(result.pauses).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/enterHeroName.contract.test.ts
// G1 계약: enterHeroName (스펙 §5.1 행 — "actorId의 이름 변경, maxLength 준수").
//
// 실측 메모 (§3 이탈 프로토콜):
// - §5 표 초안은 "없는 actor → warn + 스킵"이라 했으나, 실제 구현(commandCatalog.ts)은 actor 를
//   찾지 못해도 경고 없이 currentName="" 으로 pause 를 발생시키고, 입력된 이름을 세션 오버라이드
//   (session.actorNames)에 그대로 기록한다(크래시 없음). 케이스 2는 실측 동작을 고정하고,
//   차이는 보고서 "표 대조 결과"에 기록한다.
// - 이름 반영은 프로젝트 DB 가 아니라 세션 오버라이드(actorNames)다(저장 데이터 원복 유지).
// - maxLength 는 clampMaxLength 로 1~12 범위로 강제된다(코드포인트 기준 절단).
describe("enterHeroName.contract", () => {
  isolateTimers();
  function validActor(): { actorId: string; name: string } {
    const project = freshBlankProject();
    const actor = project.database.actors[0];
    if (!actor) throw new Error("blank project 에 actor 가 있어야 한다");
    return { actorId: actor.id, name: actor.name };
  }
  describe("enterHeroName 계약", () => {
    it("정상 효과: DB 이름을 currentName 으로 노출하고, 입력을 maxLength 로 잘라 세션 오버라이드에 기록한다", () => {
      const { actorId, name } = validActor();
      const commands: Command[] = [
        { kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true },
      ];

      const result = runCommandContract(commands, { answers: ["가나다라마바사아"] });

      expect(result.pauses).toEqual([
        { kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true, currentName: name },
      ]);
      // 8자 입력 → maxLength 6 으로 절단.
      expect(result.session.actorNames?.[actorId]).toBe("가나다라마바");
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 actor 여도 크래시 없이 currentName=\"\" 으로 진행된다 — 실측: 경고 없음(§5 표 초안은 warn+스킵)", () => {
      const result = runCommandContract(
        [
          { kind: "enterHeroName", actorId: "actor_missing", maxLength: 6, showInitialName: false },
          { kind: "setSwitch", switchId: "after_name", value: true },
        ],
        { answers: ["무명"] }
      );

      expect(result.pauses[0]).toMatchObject({ kind: "enterHeroName", currentName: "" });
      expect(result.session.switches.after_name).toBe(true);
      expect(result.finished).toBe(true);
      // 실측 고정: DB 검증/경고 없이 미지의 actorId 에도 오버라이드가 기록된다.
      expect(result.warnings).toEqual([]);
      expect(result.session.actorNames?.actor_missing).toBe("무명");
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const { actorId } = validActor();
      const commands: Command[] = [
        { kind: "enterHeroName", actorId, maxLength: 8, showInitialName: false },
      ];

      const original = runCommandContract(commands, { answers: ["새이름"] });
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { answers: ["새이름"] });

      expect(restored.session).toEqual(original.session);
      expect(original.session.actorNames?.[actorId]).toBe("새이름");
    });

    it("pause 의미론: blocking — pause 가 정확히 1회, kind=enterHeroName", () => {
      const { actorId } = validActor();
      const result = runCommandContract(
        [{ kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true }],
        { answers: ["임시"] }
      );

      expect(result.pauses).toHaveLength(1);
      expect(result.pauses[0]?.kind).toBe("enterHeroName");
      expect(result.finished).toBe(true);
    });

    it("빈 입력(취소/공백)은 이름 오버라이드를 만들지 않는다", () => {
      const { actorId } = validActor();
      const command: Command = { kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true };

      const dismissed = runCommandContract([command]); // answers 없음 → undefined 로 진행
      expect(dismissed.session.actorNames).toBeUndefined();
      expect(dismissed.finished).toBe(true);

      const whitespace = runCommandContract([command], { answers: ["   "] });
      expect(whitespace.session.actorNames).toBeUndefined();
      expect(whitespace.finished).toBe(true);
    });
  });
});

// test/commandContracts/evolveMonster.contract.test.ts
// G1 계약: evolveMonster (Phase 9b 몬스터 진화 커맨드).
describe("evolveMonster.contract", () => {
  isolateTimers();
  function monster(instanceId = "monster_1", level = 7): MonsterInstance {
    return {
      instanceId,
      speciesId: "species_wild_slime",
      level,
      exp: 0,
      ivs: { hp: 0, atk: 0, def: 0, spd: 0 },
      friendship: 70,
      caughtAt: { mapId: "map_blank", x: 1, y: 1 },
      currentHp: 10,
      skillIds: ["skill_default"],
    };
  }
  function seedMonster(level = 7) {
    return (session: PlaySessionLike): void => {
      session.monsterInstances = { monster_1: monster("monster_1", level) };
      session.monsterParty = ["monster_1"];
      session.monsterBox = [];
    };
  }
  function requireItemEvolution(project: Project): void {
    const species = project.database.monsterSpecies?.find((record) => record.id === "species_wild_slime");
    if (!species) throw new Error("missing wild slime species");
    species.evolutions = [{ toSpeciesId: "species_king_slime", requires: { itemId: "item_capture_orb" } }];
  }
  function command(): Command {
    return {
      kind: "evolveMonster",
      instanceId: "monster_1",
      toSpeciesId: "species_king_slime",
      successBranch: [{ kind: "setFlag", flag: "evolve_success", value: true }],
      failureBranch: [{ kind: "setFlag", flag: "evolve_failure", value: true }],
    };
  }
  describe("evolveMonster 계약", () => {
    it("정상 효과: 조건을 만족하면 species를 바꾸고 성공 분기를 실행한다", () => {
      const result = runCommandContract([command()], { mutateSession: seedMonster(7) });

      expect(result.session.monsterInstances?.monster_1?.speciesId).toBe("species_king_slime");
      expect(result.session.flags.evolveMonsterSuccess).toBe(true);
      expect(result.session.flags.evolve_success).toBe(true);
      expect(result.session.flags.evolve_failure).toBeUndefined();
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("아이템 진화: 성공 시 요구 아이템을 1개 소모한다", () => {
      const result = runCommandContract([command()], {
        mutateProject: requireItemEvolution,
        mutateSession: (session) => {
          seedMonster(3)(session);
          session.inventory.item_capture_orb = 1;
        },
      });

      expect(result.session.monsterInstances?.monster_1?.speciesId).toBe("species_king_slime");
      // Item transitions keep inventory sparse: consuming the last unit removes the key.
      expect(result.session.inventory).not.toHaveProperty("item_capture_orb");
      expect(result.session.flags.evolve_success).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("조건 미충족: 실패 분기를 실행하고 species를 유지한다", () => {
      const result = runCommandContract([command()], {
        mutateProject: requireItemEvolution,
        mutateSession: seedMonster(3),
      });

      expect(result.session.monsterInstances?.monster_1?.speciesId).toBe("species_wild_slime");
      expect(result.session.flags.evolveMonsterSuccess).toBe(false);
      expect(result.session.flags.evolve_failure).toBe(true);
      expect(result.session.flags.evolve_success).toBeUndefined();
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
      const commands = [command()];
      const original = runCommandContract(commands, { mutateSession: seedMonster(7) });
      const restoredCommands = roundtripCommands(commands);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, { mutateSession: seedMonster(7) });

      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
    });

    it("pause 의미론: evolveMonster 는 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract([command()], { mutateSession: seedMonster(7) });

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/fork.contract.test.ts
// G1 계약: fork (스펙 §5.2 행).
//
// 실측 메모 (§10.1):
// - 결측 참조는 경고가 아니라 기본값 평가다. switch=false, variable=0, selfSwitch=false,
//   actor/item absent, gold=0, timer=0 이 조건 평가에 사용된다.
describe("fork.contract", () => {
  isolateTimers();
  type MutateSession = NonNullable<Parameters<typeof runCommandContract>[1]>["mutateSession"];
  function forkProgram(condition: Condition, prefix: string): Command[] {
    return [
      {
        kind: "fork",
        condition,
        then: [{ kind: "setSwitch", switchId: `${prefix}_then`, value: true }],
        else: [{ kind: "setSwitch", switchId: `${prefix}_else`, value: true }],
      },
    ];
  }
  function expectBranch(
    condition: Condition,
    expected: "then" | "else",
    mutateSession?: MutateSession,
    mutateProject?: (project: Project) => void,
  ): void {
    const result = runCommandContract(forkProgram(condition, "branch"), { mutateSession, mutateProject });

    expect(result.session.switches[`branch_${expected}`]).toBe(true);
    expect(result.session.switches[`branch_${expected === "then" ? "else" : "then"}`]).toBeUndefined();
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  }
  function registerForkRoundtripRefs(project: Project): void {
    project.switches.push(
      { id: "sw_roundtrip_condition", name: "condition" },
      { id: "fork_roundtrip_then", name: "then" },
      { id: "fork_roundtrip_else", name: "else" }
    );
    project.variables.push({ id: "var_roundtrip_condition", name: "condition variable" });
  }
  describe("fork 계약", () => {
    const trueCases: readonly [string, Condition, MutateSession][] = [
      ["switch", { kind: "switch", switchId: "sw_gate", value: true }, (session) => { session.switches.sw_gate = true; }],
      ["variable", { kind: "variable", variableId: "var_gate", op: ">=", value: 3 }, (session) => { session.variables.var_gate = 3; }],
      ["selfSwitch", { kind: "selfSwitch", key: "A", value: true }, (session) => { session.selfSwitches = { [CONTRACT_EVENT_ID]: { A: true } }; }],
      ["actor", { kind: "actor", actorId: "actor_gate", present: true }, (session) => { session.partyActorIds = ["actor_gate"]; }],
      ["item", { kind: "item", itemId: "item_gate", present: true }, (session) => { session.inventory.item_gate = 1; }],
      ["gold", { kind: "gold", op: ">=", amount: 50 }, (session) => { session.gold = 50; }],
      ["timer", { kind: "timer", timerId: "timer1", seconds: 10 }, (session) => { session.timers.timer1 = 10; }],
    ];

    it.each(trueCases)(
      "정상 효과(true): %s 조건이 참이면 then branch 만 실행한다",
      (_label, condition, mutateSession) => {
        expectBranch(condition, "then", mutateSession);
      }
    );

    const falseCases: readonly [string, Condition][] = [
      ["switch", { kind: "switch", switchId: "sw_gate", value: true }],
      ["variable", { kind: "variable", variableId: "var_gate", op: ">", value: 3 }],
      ["selfSwitch", { kind: "selfSwitch", key: "B", value: true }],
      ["actor", { kind: "actor", actorId: "actor_gate", present: true }],
      ["item", { kind: "item", itemId: "item_gate", present: true }],
      ["gold", { kind: "gold", op: ">", amount: 0 }],
      ["timer", { kind: "timer", timerId: "timer2", seconds: -1 }],
    ];

    it.each(falseCases)(
      "정상 효과(false): %s 조건이 거짓이면 else branch 만 실행한다",
      (_label, condition) => {
        expectBranch(condition, "else");
      }
    );

    it("결측 참조: 기본값 평가를 고정한다(var==0은 참)", () => {
      const trueByDefault: readonly Condition[] = [
        { kind: "switch", switchId: "missing_switch", value: false },
        { kind: "variable", variableId: "missing_variable", op: "==", value: 0 },
        { kind: "selfSwitch", key: "C", value: false },
        { kind: "actor", actorId: "missing_actor", present: false },
        { kind: "item", itemId: "missing_item", present: false },
        { kind: "gold", op: "==", amount: 0 },
        { kind: "timer", timerId: "timer1", seconds: 0 },
      ];

      for (const condition of trueByDefault) {
        expectBranch(condition, "then");
      }
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 branch 결과가 같다", () => {
      const commands: Command[] = [
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "sw_roundtrip_condition", value: true },
          then: [{ kind: "setSwitch", switchId: "fork_roundtrip_then", value: true }],
          else: [{ kind: "setSwitch", switchId: "fork_roundtrip_else", value: true }],
        },
      ];
      const original = runCommandContract(commands, {
        mutateSession: (session) => {
          session.switches.sw_roundtrip_condition = true;
        },
      });
      const restoredCommands = roundtripCommands(commands, registerForkRoundtripRefs);
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands, {
        mutateSession: (session) => {
          session.switches.sw_roundtrip_condition = true;
        },
      });

      expect(restored.session).toEqual(original.session);
      expect(restored.pauses).toEqual([]);
    });

    it("pause 의미론: fork 자체는 non-blocking — branch 가 non-blocking 이면 pause 가 없다", () => {
      const result = runCommandContract(forkProgram({ kind: "gold", op: ">=", amount: 0 }, "pause_fork"));

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });

    // 종전 이 파일은 16종 중 10종만 덮었다. 나머지 6종(timePhase/season/npcActivity/
    // friendshipAtLeast/battleResult/run)은 evalCondition 단위로만 증명돼 있어서, 실제
    // 인터프리터 drain 을 통과하는 then/else 선택이 고정돼 있지 않았다. 조건 종류가
    // 늘어날 때 fork 분기에서만 조용히 빠지는 것을 막는다.
    const stateCases: readonly [string, Condition, MutateSession][] = [
      [
        "timePhase",
        { kind: "timePhase", phase: "day" },
        (session) => { session.gameTime = { minute: 0, hour: 12, day: 1, season: "spring", year: 1 }; },
      ],
      [
        "season",
        { kind: "season", season: "summer" },
        (session) => { session.gameTime = { minute: 0, hour: 12, day: 1, season: "summer", year: 1 }; },
      ],
      [
        "npcActivity",
        { kind: "npcActivity", activity: "work" },
        (session) => { session.npcActivities = { [CONTRACT_EVENT_ID]: "work" }; },
      ],
      [
        "friendshipAtLeast",
        { kind: "friendshipAtLeast", npcKey: "npc_fork_gate", value: 20 },
        (session) => { session.friendship = { npc_fork_gate: 20 }; },
      ],
      [
        "relationshipAtLeast",
        { kind: "relationshipAtLeast", npcKey: "npc_fork_gate", state: "dating" },
        (session) => { session.relationships = { npc_fork_gate: "engaged" }; },
      ],
      [
        "battleResult",
        { kind: "battleResult", result: "victory" },
        (session) => { session.battleResult = "victory"; },
      ],
      [
        "run",
        { kind: "run", query: "active", value: true },
        (session) => {
          session.roguelikeRun = {
            version: 1,
            runId: "fork-contract-run",
            seed: 1,
            floor: 1,
            status: "active",
            flags: {},
            roomResetCounts: {},
            roomEventGenerationKeys: {},
          };
        },
      ],
    ];

    it.each(stateCases)(
      "세션 상태 조건(true): %s 조건이 참이면 then branch 만 실행한다",
      (_label, condition, mutateSession) => {
        expectBranch(condition, "then", mutateSession);
      }
    );

    it.each(stateCases)(
      "세션 상태 조건(false): %s 조건이 상태 없이 거짓이면 else branch 만 실행한다",
      (_label, condition) => {
        expectBranch(condition, "else");
      }
    );

    // 빈 npcKey 는 호스트 이벤트의 characterId 로 해석된다(resolveSocialKey). 이 경로가
    // 끊기면 「비우면 이 이벤트」 저작이 조용히 항상 거짓이 된다.
    it("friendshipAtLeast: 빈 npcKey 는 호스트 이벤트의 characterId 로 해석된다", () => {
      expectBranch(
        { kind: "friendshipAtLeast", value: 30 },
        "then",
        (session) => { session.friendship = { character_fork_host: 30 }; },
        (project) => {
          const event = project.maps[project.startMapId].events.find((entry) => entry.id === CONTRACT_EVENT_ID);
          if (event) event.characterId = "character_fork_host";
        },
      );
    });

    it("복합 조건: all/any/not 이 then/else 분기를 올바르게 고른다", () => {
      expectBranch(
        {
          kind: "all",
          conditions: [
            { kind: "switch", switchId: "sw_gate", value: true },
            { kind: "gold", op: ">=", amount: 10 },
          ],
        },
        "then",
        (session) => {
          session.switches.sw_gate = true;
          session.gold = 10;
        },
      );
      expectBranch(
        {
          kind: "any",
          conditions: [
            { kind: "switch", switchId: "sw_gate", value: true },
            { kind: "gold", op: ">=", amount: 999 },
          ],
        },
        "then",
        (session) => {
          session.switches.sw_gate = true;
          session.gold = 0;
        },
      );
      expectBranch(
        { kind: "not", condition: { kind: "switch", switchId: "sw_gate", value: true } },
        "then",
      );
      expectBranch(
        {
          kind: "all",
          conditions: [
            { kind: "switch", switchId: "sw_gate", value: true },
            { kind: "gold", op: ">=", amount: 10 },
          ],
        },
        "else",
        (session) => {
          session.switches.sw_gate = true;
          session.gold = 0;
        },
      );
    });

  });
});

// test/commandContracts/fuseMonsters.contract.test.ts
// 계약: fuseMonsters (system.monsterFusions 표로 두 개체 → 결과 종 한 마리).
describe("fuseMonsters.contract", () => {
  isolateTimers();
  function withTable(project: Project): void {
    project.system.monsterFusions = [{ speciesA: "species_wild_slime", speciesB: "species_cave_bat", resultSpeciesId: "species_king_slime" }];
  }
  function seedPair(session: PlaySessionLike): void {
    const make = (instanceId: string, speciesId: string, level: number): MonsterInstance => ({ instanceId, speciesId, level, exp: 0, friendship: 70, caughtAt: { mapId: "m", x: 0, y: 0 } });
    session.monsterInstances = { monster_1: make("monster_1", "species_cave_bat", 6), monster_2: make("monster_2", "species_wild_slime", 10) };
    session.monsterParty = ["monster_1", "monster_2"];
    session.monsterBox = [];
  }
  describe("fuseMonsters 계약", () => {
    it("정상 효과: 두 재료가 사라지고 결과 종이 평균 레벨로 생긴다", () => {
      const result = runCommandContract([{ kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" }], { mutateProject: withTable, mutateSession: seedPair });
      const instances = Object.values(result.session.monsterInstances ?? {});
      expect(instances.map((entry) => [entry.speciesId, entry.level])).toEqual([["species_king_slime", 8]]);
      expect(result.session.flags.fuseMonstersSuccess).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("표에 없는 조합이면 재료를 지키고 실패한다", () => {
      const result = runCommandContract([{ kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" }], { mutateSession: seedPair });
      expect(Object.keys(result.session.monsterInstances ?? {}).sort()).toEqual(["monster_1", "monster_2"]);
      expect(result.session.flags.fuseMonstersSuccess).toBe(false);
    });

    it("결측 참조: 없는 개체는 크래시 없이 실패한다", () => {
      const result = runCommandContract([{ kind: "fuseMonsters", instanceIdA: "monster_x", instanceIdB: "monster_y" }], { mutateProject: withTable });
      expect(result.session.flags.fuseMonstersSuccess).toBe(false);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성 · pause 없음", () => {
      const commands: Command[] = [{ kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" }];
      expect(roundtripCommands(commands, withTable)).toEqual(commands);
      expect(runCommandContract(commands, { mutateProject: withTable, mutateSession: seedPair }).pauses).toEqual([]);
    });
  });
});

// test/commandContracts/getFriendship.contract.test.ts
// G1 계약: getFriendship (Phase 11b 호감도→변수 브리지 커맨드).
describe("getFriendship.contract", () => {
  isolateTimers();
  function registerVariable(project: Project, id: string): void {
    project.variables.push({ id, name: id });
  }
  describe("getFriendship 계약", () => {
    it("정상 효과: 명시 npcKey의 호감도를 일반 변수에 기록한다", () => {
      const result = runCommandContract([
        { kind: "changeFriendship", npcKey: "ev_farmer", delta: 80 },
        { kind: "getFriendship", npcKey: "ev_farmer", variableId: "var_friendship" },
      ]);

      expect(result.session.variables.var_friendship).toBe(80);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("self fallback: npcKey 생략 시 characterId 호감도를 읽는다", () => {
      const result = runCommandContract([
        { kind: "changeFriendship", delta: 45 },
        { kind: "getFriendship", variableId: "var_self_friendship" },
      ], {
        mutateProject: (project) => {
          const event = project.maps[project.startMapId]?.events.find((entry) => entry.id === CONTRACT_EVENT_ID);
          if (event) event.characterId = CONTRACT_EVENT_ID;
        },
      });

      expect(result.session.friendship?.[CONTRACT_EVENT_ID]).toBe(45);
      expect(result.session.variables.var_self_friendship).toBe(45);
      expect(result.finished).toBe(true);
    });

    it("이벤트 컨텍스트 없음: 읽을 npcKey가 없으면 0을 기록한다", () => {
      const result = runCommandContract([{ kind: "getFriendship", variableId: "var_none" }], { currentEventId: null });

      expect(result.session.variables.var_none).toBe(0);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: 등록된 variableId 는 serialize→deserialize 후 같은 결과를 낸다", () => {
      const commands: Command[] = [
        { kind: "changeFriendship", npcKey: "ev_farmer", delta: 120 },
        { kind: "getFriendship", npcKey: "ev_farmer", variableId: "var_friendship_roundtrip" },
      ];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands, (project) => registerVariable(project, "var_friendship_roundtrip"));
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
      expect(restored.finished).toBe(true);
    });

    it("pause 의미론: getFriendship 은 non-blocking — pause 가 발생하지 않는다", () => {
      const result = runCommandContract([{ kind: "getFriendship", npcKey: "ev_farmer", variableId: "var_pause_contract" }]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

// test/commandContracts/gotoLabel.contract.test.ts
// G1 계약: gotoLabel (스펙 §5.2 label/gotoLabel 행).
//
// 실측 메모:
// - 없는 label 은 [interpreter] warn 후 다음 명령으로 진행한다.
describe("gotoLabel.contract", () => {
  isolateTimers();
  describe("gotoLabel 계약", () => {
    it("정상 효과: 같은 프레임의 label 로 점프하고 중간 명령을 건너뛴다", () => {
      const result = runCommandContract([
        { kind: "setSwitch", switchId: "before_goto", value: true },
        { kind: "gotoLabel", name: "target" },
        { kind: "setSwitch", switchId: "skipped_by_goto", value: true },
        { kind: "label", name: "target" },
        { kind: "setSwitch", switchId: "after_goto", value: true },
      ]);

      expect(result.session.switches.before_goto).toBe(true);
      expect(result.session.switches.skipped_by_goto).toBeUndefined();
      expect(result.session.switches.after_goto).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("결측 참조: 없는 label 은 warn 후 다음 명령으로 진행한다", () => {
      const result = runCommandContract([
        { kind: "gotoLabel", name: "missing_target" },
        { kind: "setSwitch", switchId: "after_missing_goto", value: true },
      ]);

      expect(result.session.switches.after_missing_goto).toBe(true);
      expect(result.warnings.some((message) => message.includes("[interpreter]"))).toBe(true);
      expect(result.warnings.some((message) => message.includes("라벨을 찾을 수 없음"))).toBe(true);
      expect(result.finished).toBe(true);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 점프 결과가 같다", () => {
      const commands: Command[] = [
        { kind: "gotoLabel", name: "roundtrip_target" },
        { kind: "setSwitch", switchId: "goto_roundtrip_skipped", value: true },
        { kind: "label", name: "roundtrip_target" },
        { kind: "setSwitch", switchId: "goto_roundtrip_after", value: true },
      ];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands, (project) => {
        project.switches.push(
          { id: "goto_roundtrip_skipped", name: "skipped" },
          { id: "goto_roundtrip_after", name: "after" }
        );
      });
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
    });

    it("pause 의미론: gotoLabel 은 non-blocking — 대상 branch 가 non-blocking 이면 pause 가 없다", () => {
      const result = runCommandContract([
        { kind: "gotoLabel", name: "pause_target" },
        { kind: "text", body: "skipped" },
        { kind: "label", name: "pause_target" },
      ]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});
