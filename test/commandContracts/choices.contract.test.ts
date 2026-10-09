// test/commandContracts/choices.contract.test.ts
// G1 계약: choices (스펙 §5.1 행).
//
// 실측 메모 (§10.1):
// - 빈 options 도 경고 없이 choices pause 를 발생시킨 뒤 다음 명령으로 진행한다.
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

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
