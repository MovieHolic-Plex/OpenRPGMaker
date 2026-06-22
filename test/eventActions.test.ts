// test/eventActions.test.ts
// 이벤트 명령 경로 탐색/조작 로직 검증(순수).
// eventActions.ts의 resolveList와 동일 로직을 여기서 재현하여 검증.

import { describe, it, expect } from "vitest";
import type { Command } from "@/project/types";

type TextCommand = Extract<Command, { kind: "text" }>;
type SetFlagCommand = Extract<Command, { kind: "setFlag" }>;

// eventActions의 resolveList와 동일 로직(모듈 export가 아니므로 복제).
function resolveList(commands: Command[], path: number[]): Command[] | null {
  let list: Command[] = commands;
  for (let i = 0; i < path.length - 1; i += 2) {
    const cmdIdx = path[i];
    const optIdx = path[i + 1];
    const cmd = list[cmdIdx];
    if (!cmd || cmd.kind !== "choices") return null;
    const opt = cmd.options[optIdx];
    if (!opt) return null;
    list = opt.branch;
  }
  return list;
}

function getCommand(commands: Command[], path: number[]): Command | null {
  const lastIdx = path[path.length - 1];
  const container = path.slice(0, -1);
  const list = container.length === 0 ? commands : resolveList(commands, container);
  if (!list) return null;
  return list[lastIdx] ?? null;
}

function expectTextCommand(command: Command | null): TextCommand {
  if (command?.kind === "text") return command;
  const actual = command?.kind ?? "null";
  throw new Error(`expected command text, got ${actual}`);
}

function expectSetFlagCommand(command: Command | null): SetFlagCommand {
  if (command?.kind === "setFlag") return command;
  const actual = command?.kind ?? "null";
  throw new Error(`expected command setFlag, got ${actual}`);
}

describe("명령 경로 탐색", () => {
  it("루트 명령을 찾는다", () => {
    const cmds: Command[] = [
      { kind: "text", body: "A" },
      { kind: "text", body: "B" },
    ];
    expect(getCommand(cmds, [0])?.kind).toBe("text");
    expect(expectTextCommand(getCommand(cmds, [1])).body).toBe("B");
  });

  it("choices의 branch 안으로 들어간다", () => {
    const cmds: Command[] = [
      {
        kind: "choices",
        prompt: "p",
        options: [
          {
            text: "o1",
            branch: [
              { kind: "text", body: "inside1" },
              { kind: "setFlag", flag: "f", value: true },
            ],
          },
          { text: "o2", branch: [{ kind: "text", body: "inside2" }] },
        ],
      },
    ];
    // path [0, 0, 0] = choices[0].options[0].branch[0]
    expect(expectTextCommand(getCommand(cmds, [0, 0, 0])).body).toBe("inside1");
    expect(expectSetFlagCommand(getCommand(cmds, [0, 0, 1])).flag).toBe("f");
    expect(expectTextCommand(getCommand(cmds, [0, 1, 0])).body).toBe("inside2");
  });

  it("choices가 아닌 곳에서 branch 진입 시 null", () => {
    const cmds: Command[] = [{ kind: "text", body: "x" }];
    expect(getCommand(cmds, [0, 0, 0])).toBeNull();
  });

  it("존재하지 않는 인덱스는 null", () => {
    const cmds: Command[] = [{ kind: "text", body: "x" }];
    expect(getCommand(cmds, [5])).toBeNull();
  });
});

describe("중첩 choices (깊은 재귀)", () => {
  it("choices 안의 choices 안의 명령까지 찾는다", () => {
    const cmds: Command[] = [
      {
        kind: "choices",
        options: [
          {
            text: "a",
            branch: [
              {
                kind: "choices",
                options: [
                  {
                    text: "a1",
                    branch: [{ kind: "text", body: "deep" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    // path: choices[0].opt0.branch[0] = 또 choices → 그 choices.opt0.branch[0]
    // [0,0,0, 0,0] = choices0 → opt0 → branch[0](choices) → opt0 → branch[0]
    expect(expectTextCommand(getCommand(cmds, [0, 0, 0, 0, 0])).body).toBe("deep");
  });
});
