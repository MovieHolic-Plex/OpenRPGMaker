// test/commandContracts/wait.contract.test.ts
// G1 계약: wait (스펙 §5.2 행).
//
// 실측 메모 (§10.1):
// - wait 는 0/음수/거대값을 클램프하지 않고 항상 wait pause 를 발생시킨다.
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

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
});
