import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent, Project } from "@/project/types";

// compile_puzzle kind:"password" — 작은 일 셋째 묶음(password-safe)에서 드러난 셋:
// 선택지 암호의 맞는 글자가 늘 첫 칸이었다 · 0 으로 시작하는 숫자 암호가 숫자 입력이 아니라 선택지로 갔다 · 그림 없는 칸의 장치가 아무 알림 없이 투명했다.

function compile(answer: string, prepare?: (project: Project) => void) {
  const project = createBlankProject();
  prepare?.(project);
  const result = getTool("compile_puzzle")!.run(project, { mapId: project.startMapId, puzzleId: "safe", kind: "password", at: { x: 6, y: 2 }, name: "금고", answer, onSolve: { message: "열렸다." } });
  const event = project.maps[project.startMapId]!.events.find((entry) => entry.id === "ev_safe_password") as GameEvent;
  return { project, result, event, commands: event.pages![0]!.commands as Command[] };
}

type Choices = Extract<Command, { kind: "choices" }>;
/** 자리마다 (보기 글자들, 맞는 글자의 자리). 맞는 가지만 다음 자리로 이어진다. */
function steps(commands: readonly Command[]): { options: string[]; correct: number }[] {
  const ask = commands.find((command): command is Choices => command.kind === "choices");
  if (!ask) return [];
  const correct = ask.options.findIndex((option) => !option.branch.some((command) => command.kind === "text" && command.body === "암호가 틀렸다."));
  return [{ options: ask.options.map((option) => option.text), correct }, ...steps(ask.options[correct]!.branch)];
}

describe("compile_puzzle password", () => {
  it("선택지 암호: 자리마다 보기 다섯에 맞는 글자가 한 번 있고, 맞는 글자가 늘 첫 칸은 아니다", () => {
    for (const answer of ["BELL", "가나다", "a1Z", "MOON"]) {
      const asked = steps(compile(answer).commands);
      expect(asked.map((step) => step.options[step.correct]).join("")).toBe(answer);
      for (const step of asked) {
        expect(step.options).toHaveLength(5);
        expect(new Set(step.options).size).toBe(5);
      }
    }
    // 네 글자 암호 넷 가운데 첫 칸만 눌러 열리는 것은 없다.
    expect(["BELL", "MOON", "STAR", "가나다라"].filter((answer) => steps(compile(answer).commands).every((step) => step.correct === 0))).toEqual([]);
  });

  it("보기는 맞는 글자와 같은 종류다 — 영문 암호에 숫자를 섞지 않는다", () => {
    for (const step of steps(compile("BELL").commands)) expect(step.options.join("")).toMatch(/^[A-Z]{5}$/u);
    for (const step of steps(compile("가나다").commands)) expect(step.options.join("")).toMatch(/^[가-힣]{5}$/u);
  });

  it("다시 지어도 보기 차례가 같다", () => {
    expect(steps(compile("BELL").commands)).toEqual(steps(compile("BELL").commands));
  });

  it("0 으로 시작하는 숫자 암호도 숫자 입력으로 받는다(자리 수 그대로)", () => {
    const { commands } = compile("0427");
    expect(commands.find((command) => command.kind === "inputNumber")).toMatchObject({ digits: 4 });
    expect(commands.find((command) => command.kind === "fork")).toMatchObject({ condition: { kind: "variable", op: "==", value: 427 } });
    expect(commands.some((command) => command.kind === "choices")).toBe(false);
  });

  it("그 칸에 물건 타일이 없으면 가까이서 반짝이게 하고 영어로 알린다 — 물건 타일 위면 조용하다", () => {
    const bare = compile("1234");
    expect(bare.event.pages![0]!.nearSparkle).toEqual({ radius: 2 });
    expect(bare.result.warnings).toEqual([expect.stringMatching(/has no picture.*stamp_object/u)]);
    const onProp = compile("1234", (project) => { const map = project.maps[project.startMapId]!; map.upperTiles[2 * map.width + 6] = 5; });
    expect(onProp.event.pages![0]!.nearSparkle).toBeUndefined();
    expect(onProp.result.warnings).toBeUndefined();
  });
});
