// @vitest-environment happy-dom
// test/loopBreakWarningBranches.test.ts
//
// fork 1레벨만 보던 구형 walkHasBreak 는 choices/shop/battle 분기 안의 breakLoop 를
// 못 찾아 거짓 「무한 반복」 경고를 냈다. 전 분기 열거(eventCommandBranches)로 전환한
// 회귀 계약이다.
import { describe, expect, it } from "vitest";
import { loopBody } from "@/editor/panels/eventEditor/commandBodyLoop";
import { installFakeDom } from "./fakeDom";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";

const context: CommandEditContext = {
  path: [0],
  actions: {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: () => {},
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  },
};

function noBreakVisible(body: Command[]): boolean {
  installFakeDom();
  const root = loopBody(context, { kind: "loop", body });
  const warning = root.querySelector('[data-testid="event-loop-no-break-warning"]') as HTMLElement | null;
  return warning ? !warning.hidden : false;
}

describe("loop break warning across branches", () => {
  it("sees breakLoop inside a choices branch", () => {
    const body: Command[] = [{
      kind: "choices",
      prompt: "?",
      options: [{ text: "가", branch: [{ kind: "breakLoop" }] }],
      cancelBehavior: "disallow",
    }];
    expect(noBreakVisible(body)).toBe(false);
  });

  it("sees breakLoop inside a fork else branch", () => {
    const body: Command[] = [{
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_x", value: true },
      then: [{ kind: "text", body: "참" }],
      else: [{ kind: "breakLoop" }],
    }];
    expect(noBreakVisible(body)).toBe(false);
  });

  it("still warns when no branch escapes", () => {
    const body: Command[] = [{
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_x", value: true },
      then: [{ kind: "text", body: "참" }],
    }];
    expect(noBreakVisible(body)).toBe(true);
  });
});
