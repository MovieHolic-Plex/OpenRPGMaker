// test/commandContracts/setVariable.contract.test.ts
// G1 계약: setVariable (스펙 §5.2 setFlag/setSwitch/setSelfSwitch/setVariable 행).
//
// 실측 메모 (§10.1):
// - 런타임은 variableId 존재 여부를 검증하지 않고 session.variables 에 값을 쓴다.
// - /= 는 Math.floor(cur / value) 이며, value=0 일 때 기존 값을 유지한다.
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

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
