import { describe, expect, it } from "vitest";
import { shuffledOptions, trivialCode } from "@/ai/v2/puzzle";
import { weakPuzzleLocks } from "@/ai/v2/puzzleChecks";
import type { Project } from "@/project/types";

// 판정 J63: 정답이 첫 보기, 1024·1234·0000 같은 번호.
function lockProject(commands: unknown[]): Project {
  return { maps: { m: { id: "m", name: "서재", width: 5, height: 5, events: [{ id: "ev_safe", name: "금고", x: 1, y: 1, pages: [{ conditions: [], trigger: { kind: "action" }, commands }] }] } } } as unknown as Project;
}

describe("weak puzzle locks (J63)", () => {
  it("treats repeated, sequential and common codes as trivial", () => {
    for (const c of ["1024", "1234", "0000", "4321", "1111"]) expect(trivialCode(c)).toBe(true);
    for (const c of ["3817", "0917", "12"]) expect(trivialCode(c)).toBe(false);
  });
  it("never puts the answer first and keeps it among the five shown options", () => {
    for (const seed of ["a", "b", "chain:0", "chain:1", "x:9"]) {
      const out = shuffledOptions(["정답", "가", "나", "다", "라", "마", "바"], "정답", seed);
      expect(out.length).toBe(5);
      expect(out.indexOf("정답")).toBeGreaterThan(0);
    }
  });
  it("flags a trivial number code and a correct-first choice, passes a fair lock", () => {
    const num = (value: number) => lockProject([{ kind: "inputNumber", variableId: "v", digits: 4 }, { kind: "fork", condition: { kind: "variable", variableId: "v", op: "==", value }, then: [{ kind: "setSwitch", switchId: "s", value: true }], else: [] }]);
    expect(weakPuzzleLocks(num(1024))).toHaveLength(1);
    expect(weakPuzzleLocks(num(3817))).toEqual([]);
    const choice = (answerAt: number) => lockProject([{ kind: "choices", options: ["봄", "여름", "가을"].map((text, i) => ({ text, branch: i === answerAt ? [{ kind: "setSwitch", switchId: "s", value: true }] : [{ kind: "showText", text: "아니다" }] })) }]);
    expect(weakPuzzleLocks(choice(0))).toHaveLength(1);
    expect(weakPuzzleLocks(choice(2))).toEqual([]);
  });
});
