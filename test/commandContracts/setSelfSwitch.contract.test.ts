// test/commandContracts/setSelfSwitch.contract.test.ts
// G1 계약: setSelfSwitch (스펙 §5.2 setFlag/setSwitch/setSelfSwitch/setVariable 행).
//
// 실측 메모 (§3 이탈 프로토콜):
// - 셀프 스위치는 "현재 실행 중인 이벤트"(interpreter options.currentEventId) 기준으로
//   session.selfSwitches[eventId][key] 에 기록된다.
// - 이벤트 컨텍스트가 없으면(공통 이벤트 단독 실행 등) 경고 없이 조용한 no-op 이다.
//   §5 표 초안은 이 경계의 기대를 명시하지 않았다 → 실측 결과를 계약으로 고정하고 보고서에 기록.
import { describe, expect, it } from "vitest";
import { evalCondition } from "@/project/session";
import type { Command } from "@/project/types";
import { CONTRACT_EVENT_ID, roundtripCommands, runCommandContract } from "./harness";

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
