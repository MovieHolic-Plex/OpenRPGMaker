// test/commandContracts/setDifficulty.contract.test.ts
// 계약: setDifficulty (system.difficulties 의 id 로 세션 난이도를 바꾼다).
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

function withDifficulties(project: Project): void {
  project.system.difficulties = [{ id: "easy", name: "쉬움" }, { id: "hard", name: "어려움", enemyHpRate: 2 }];
}

describe("setDifficulty 계약", () => {
  it("정상 효과: 목록에 있는 난이도로 바꾼다", () => {
    const result = runCommandContract([{ kind: "setDifficulty", difficultyId: "hard" }], { mutateProject: withDifficulties });
    expect(result.session.difficultyId).toBe("hard");
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 없는 난이도 id 는 무시하고 다음 명령을 실행한다", () => {
    const result = runCommandContract([
      { kind: "setDifficulty", difficultyId: "missing" },
      { kind: "setSwitch", switchId: "after_difficulty", value: true },
    ], { mutateProject: withDifficulties });
    expect(result.session.difficultyId).toBeUndefined();
    expect(result.session.switches.after_difficulty).toBe(true);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후에도 같은 명령이다", () => {
    const commands: Command[] = [{ kind: "setDifficulty", difficultyId: "hard" }];
    expect(roundtripCommands(commands, withDifficulties)).toEqual(commands);
  });

  it("pause 의미론: non-blocking", () => {
    const result = runCommandContract([{ kind: "setDifficulty", difficultyId: "easy" }], { mutateProject: withDifficulties });
    expect(result.pauses).toEqual([]);
  });
});
