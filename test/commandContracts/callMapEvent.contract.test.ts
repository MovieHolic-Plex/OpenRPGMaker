// test/commandContracts/callMapEvent.contract.test.ts
// G1 계약: callMapEvent (스펙 §5.2 행).
//
// 실측 메모:
// - 현재 맵의 이벤트를 찾아 활성 page commands 를 실행한다.
// - pages 가 없거나 활성 page 가 없으면 top-level event.commands 로 폴백한다.
// - 없는 eventId 와 재귀 한도는 [interpreter] warn 후 호출자 다음 명령으로 진행한다.
import { describe, expect, it } from "vitest";
import type { Command, EventPage, EventPageCondition, GameEvent, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

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
