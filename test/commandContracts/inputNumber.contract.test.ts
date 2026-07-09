// test/commandContracts/inputNumber.contract.test.ts
// G1 계약: inputNumber (스펙 §5.1 행).
//
// 실측 메모 (§10.1):
// - 없는 variableId 도 런타임에서 무경고 생성된다.
// - digits 의 저장 가능 범위(1~6)는 deserialize/editor 입력 계층에서 검증·클램프한다. 인터프리터는
//   StepResult 로 digits 를 넘기고, resume 으로 받은 숫자를 그대로 변수에 쓴다.
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

function registerVariable(project: Project, id: string): void {
  project.variables.push({ id, name: id });
}

describe("inputNumber 계약", () => {
  it("정상 효과: inputNumber pause 후 입력값을 variableId 에 저장하고 digits 를 전달한다", () => {
    const result = runCommandContract([{ kind: "inputNumber", variableId: "var_number", digits: 3 }], {
      answers: [321],
    });

    expect(result.pauses).toEqual([
      expect.objectContaining({ kind: "inputNumber", variableId: "var_number", digits: 3 }),
    ]);
    expect(result.session.variables.var_number).toBe(321);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("경계: digits 상한 6을 StepResult 에 그대로 전달한다", () => {
    const result = runCommandContract([{ kind: "inputNumber", variableId: "var_six_digits", digits: 6 }], {
      answers: [999999],
    });

    expect(result.pauses[0]).toMatchObject({ kind: "inputNumber", digits: 6 });
    expect(result.session.variables.var_six_digits).toBe(999999);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 없는 variableId 도 경고 없이 생성된다", () => {
    const result = runCommandContract([
      { kind: "inputNumber", variableId: "var_missing_runtime", digits: 2 },
      { kind: "setSwitch", switchId: "after_input_number", value: true },
    ], { answers: [42] });

    expect(result.session.variables.var_missing_runtime).toBe(42);
    expect(result.session.switches.after_input_number).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: 등록된 variableId 는 serialize→deserialize 후 같은 결과를 낸다", () => {
    const commands: Command[] = [{ kind: "inputNumber", variableId: "var_number_roundtrip", digits: 4 }];
    const register = (project: Project) => registerVariable(project, "var_number_roundtrip");

    const original = runCommandContract(commands, { answers: [1234] });
    const restoredCommands = roundtripCommands(commands, register);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, { answers: [1234] });

    expect(restored.session).toEqual(original.session);
    expect(restored.pauses).toEqual(original.pauses);
  });

  it("pause 의미론: blocking — pause 가 정확히 1회, kind=inputNumber", () => {
    const result = runCommandContract([{ kind: "inputNumber", variableId: "var_pause_number", digits: 1 }], {
      answers: [7],
    });

    expect(result.pauses).toHaveLength(1);
    expect(result.pauses[0]?.kind).toBe("inputNumber");
    expect(result.finished).toBe(true);
  });
});
