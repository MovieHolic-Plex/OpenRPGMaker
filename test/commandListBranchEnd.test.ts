/** @vitest-environment happy-dom */
// 명령 목록은 「선택 끝」「분기 끝」 마커 행을 두지 않는다(2026-09-03 제안서 §6·§8).
// 들여쓰기와 분기 머리 행이 구조를 말하고, 끝 행은 정보 없이 세로 공간만 썼다.
import { describe, expect, it } from "vitest";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import type { Command } from "@/project/types";

const noop = (): void => {};
const actions: CommandListActions = {
  addCommand: noop,
  insertCommand: noop,
  replaceCommand: noop,
  deleteCommand: noop,
  moveCommand: noop,
  moveCommandTo: noop,
};

const COMMANDS: Command[] = [
  {
    kind: "choices",
    prompt: "무엇을 하겠나?",
    options: [
      { text: "판다", branch: [{ kind: "changeGold", op: "+=", amount: 120 }] },
      { text: "산다", branch: [] },
    ],
  },
  {
    kind: "fork",
    condition: { kind: "switch", switchId: "sw_1", value: true },
    then: [{ kind: "text", body: "맞을 때" }],
    else: [{ kind: "text", body: "아닐 때" }],
  },
  { kind: "wait", ms: 300 },
];

describe("명령 목록의 분기 끝 행", () => {
  it("끝 마커 행이 없고 분기 머리·명령·빈 분기 행은 그대로다", () => {
    const host = document.createElement("div");
    document.body.append(host);
    renderCommandList(host, COMMANDS, [], actions);
    const markers = Array.from(host.querySelectorAll<HTMLElement>(".cmd-line-marker")).map((node) => node.textContent?.trim() ?? "");
    expect(markers.some((text) => /끝$/.test(text))).toBe(false);
    expect(markers.filter((text) => text.length > 0).length).toBeGreaterThanOrEqual(3);
    expect(host.querySelectorAll('[data-testid="event-command-changeGold"]').length).toBe(1);
    expect(host.querySelectorAll('[data-testid="event-command-text"]').length).toBe(2);
    expect(host.querySelector('[data-testid^="event-command-branch-empty-"]')).not.toBeNull();
    host.remove();
  });
});
