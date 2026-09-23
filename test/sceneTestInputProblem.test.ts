import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isSceneTestInput, sceneTestInputProblem } from "@/testing/sceneTestRunner";

// run_scene_test 입력 거부 문구가 「어느 스텝·어느 필드·무엇이 허용되는지」 를 짚어야 모델이 한 번에 고친다.
// 실측(run5.log)은 같은 뭉뚱그린 문구로 4번 연속 거부됐다. 도구 인자 원문은 로그에 없어서
// 아래 잘못된 모양들은 모델이 흔히 틀리는 형태를 **가정**한 것이다.
function input(steps: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { mapId: "map_start", start: { x: 1, y: 1 }, steps, ...extra };
}

const CASES: readonly { readonly name: string; readonly value: unknown; readonly says: readonly (string | RegExp)[] }[] = [
  { name: "좌표를 문자열로", value: input([{ kind: "move", to: { x: "3", y: 4 } }]),
    says: ["steps[0] (move)", "to.x", "0 이상의 정수", "\"3\""] },
  { name: "move 에 dir 와 to 를 같이", value: input([{ kind: "wait", ticks: 10 }, { kind: "move", dir: "up", to: { x: 3, y: 4 } }]),
    says: ["steps[1] (move)", "dir", "to", "하나만"] },
  { name: "move 에 dir·to 둘 다 없음", value: input([{ kind: "move" }]),
    says: ["steps[0] (move)", "dir", "to"] },
  { name: "없는 kind", value: input([{ kind: "talk", eventId: "npc" }]),
    says: ["steps[0]", "'talk'", "interact", "choose", "present"] },
  { name: "kind 누락", value: input([{ eventId: "npc" }]),
    says: ["steps[0]", "kind"] },
  { name: "expect 에 value 필드", value: input([{ kind: "expect", endingReached: "ending_a", value: true }]),
    says: ["steps[0] (expect)", "unexpected field(s): value", "endingReached"] },
  { name: "expect 에 검사가 없음", value: input([{ kind: "expect" }]),
    says: ["steps[0] (expect)", "playerAt", "endingReached"] },
  { name: "endingReached 를 불리언으로", value: input([{ kind: "expect", endingReached: true }]),
    says: ["steps[0] (expect)", "endingReached", "엔딩 id"] },
  { name: "set 에 switches 대신 switch", value: input([{ kind: "set", switch: "sw_a" }]),
    says: ["steps[0] (set)", "unexpected field(s): switch", "switches"] },
  { name: "choose index 를 문자열로", value: input([{ kind: "choose", index: "1" }]),
    says: ["steps[0] (choose)", "index", "정수"] },
  { name: "choose 의 index 누락", value: input([{ kind: "choose", option: 1 }]),
    says: ["steps[0] (choose)", "index"] },
  { name: "wait ticks 누락", value: input([{ kind: "wait", ms: 500 }]),
    says: ["steps[0] (wait)", "ticks"] },
  { name: "present 에 item", value: input([{ kind: "present", item: "item_a" }]),
    says: ["steps[0] (present)", "unexpected field(s): item", "itemId"] },
  { name: "시작 좌표 문자열", value: input([], { start: { x: "24", y: 33 } }),
    says: ["start.x", "0 이상의 정수"] },
  { name: "steps 가 배열이 아님", value: input([], { steps: { kind: "wait", ticks: 1 } }),
    says: ["steps", "배열"] },
  { name: "최상위 오타", value: input([], { startPos: { x: 1, y: 1 } }),
    says: ["unexpected field(s): startPos"] },
];

describe("run_scene_test 입력 거부 문구", () => {
  for (const entry of CASES) {
    it(`${entry.name} → 스텝·필드·허용값을 짚는다`, () => {
      expect(isSceneTestInput(entry.value)).toBe(false);
      const problem = sceneTestInputProblem(entry.value);
      expect(problem).not.toBeNull();
      for (const needle of entry.says) {
        if (typeof needle === "string") expect(problem).toContain(needle);
        else expect(problem).toMatch(needle);
      }
    });
  }

  it("도구 거부 요약에 같은 문구가 실린다", () => {
    const project = createBlankProject();
    const result = runTool({ project }, "run_scene_test", input([{ kind: "move", dir: "up", to: { x: 3, y: 4 } }], { mapId: project.startMapId }) as never);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("steps[0] (move)");
    expect(result.summary).toContain("하나만");
  });

  it("올바른 입력은 문제 없음이고 isSceneTestInput 과 판정이 같다", () => {
    const valid = input([
      { kind: "set", mapId: "map_start", x: 2, y: 3, facing: "up", switches: ["a"], inventory: { item_a: 1 } },
      { kind: "move", dir: "left" }, { kind: "move", to: { x: 1, y: 1 } }, { kind: "walk", to: { x: 2, y: 2 }, adjacent: true },
      { kind: "interact", eventId: "npc" }, { kind: "choose", index: -1 }, { kind: "present", itemId: "item_a" }, { kind: "present" },
      { kind: "wait", ticks: 0 }, { kind: "face", dir: "down" },
      { kind: "expect", endingReached: "ending_a", inventoryCount: { item_a: 1 }, playerAt: { x: 1, y: 1 } },
    ]);
    expect(sceneTestInputProblem(valid)).toBeNull();
    expect(isSceneTestInput(valid)).toBe(true);
  });
});
