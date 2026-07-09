// test/commandContracts/timer.contract.test.ts
// G1 계약: timer (스펙 §5.2 행).
//
// 실측 메모 (§10.1):
// - timer set/start/stop 은 모두 timer pause 를 1회 발생시킨다.
// - set 은 seconds 기본값 0을 쓰고, start 는 seconds 가 있을 때만 세션 timer 값을 갱신한다.
//   stop 은 현재 인터프리터 계층에서는 세션 값을 지우지 않고 플레이어 계층에 pause 를 넘긴다.
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

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
