// test/commandContracts/callCommonEvent.contract.test.ts
// G1 계약: callCommonEvent (스펙 §5.2 행).
//
// 실측 메모:
// - 런타임은 project.commonEvents 가 아니라 session.commonEvents 로 복사된 명령을 실행한다.
// - 없는 id 와 재귀 한도는 [interpreter] warn 후 현재 프레임 다음 명령으로 진행한다.
import { describe, expect, it } from "vitest";
import type { PlaySessionLike } from "@/player/types";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

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
