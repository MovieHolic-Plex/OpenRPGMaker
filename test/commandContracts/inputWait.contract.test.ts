// test/commandContracts/inputWait.contract.test.ts
// G1 계약: inputWait (스펙 §5.1 행).
//
// 실측 메모:
// - variableId 가 있으면 resume 숫자를 변수에 저장하고, 없으면 입력값을 무시한다.
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("inputWait 계약", () => {
  it("정상 효과: 입력 키 코드를 variableId 에 저장한다", () => {
    const result = runCommandContract([{ kind: "inputWait", variableId: "var_key" }], {
      answers: [13],
    });

    expect(result.pauses).toEqual([{ kind: "inputWait", variableId: "var_key" }]);
    expect(result.session.variables.var_key).toBe(13);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("경계: variableId 가 없으면 경고 없이 입력값을 무시하고 진행한다", () => {
    const result = runCommandContract([
      { kind: "inputWait" },
      { kind: "setSwitch", switchId: "after_input_wait", value: true },
    ], { answers: [27] });

    expect(result.pauses).toEqual([{ kind: "inputWait", variableId: undefined }]);
    expect(result.session.variables).toEqual({});
    expect(result.session.switches.after_input_wait).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("answers 소진/undefined resume 은 variableId 에 0 을 저장한다", () => {
    const result = runCommandContract([{ kind: "inputWait", variableId: "var_key_default" }]);

    expect(result.session.variables.var_key_default).toBe(0);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const commands: Command[] = [{ kind: "inputWait", variableId: "var_key_roundtrip" }];

    const original = runCommandContract(commands, { answers: [32] });
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, { answers: [32] });

    expect(restored.session).toEqual(original.session);
    expect(restored.pauses).toEqual(original.pauses);
  });

  it("pause 의미론: blocking — pause 가 정확히 1회, kind=inputWait", () => {
    const result = runCommandContract([{ kind: "inputWait" }]);

    expect(result.pauses).toHaveLength(1);
    expect(result.pauses[0]?.kind).toBe("inputWait");
    expect(result.finished).toBe(true);
  });
});
