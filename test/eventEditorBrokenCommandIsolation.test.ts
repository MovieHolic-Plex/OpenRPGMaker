/** @vitest-environment happy-dom */
// 명령 하나가 렌더를 터뜨려도 이벤트 전체가 흰 화면이 되면 안 된다.
// 깨진 카드만 자리 표시자로 그리고 형제는 정상 표시한다.
import { describe, expect, it } from "vitest";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
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

const GOOD: Command = { kind: "text", speaker: "장로", body: "허허, 잘 왔네." };
// 요약기가 options.length 에서 터지는 깨진 선택지 — 가드로 못 막는未知 모양의 대리인.
const BROKEN = { kind: "choices", prompt: "???" } as unknown as Command;

describe("깨진 명령 격리", () => {
  it("스토리보드: 깨진 카드 옆에 정상 카드가 그려진다", () => {
    const host = renderStoryboard([GOOD, BROKEN, GOOD]);
    document.body.append(host);
    try {
      expect(host.querySelectorAll(".event-storyboard-card").length).toBe(3);
      const broken = host.querySelector('[data-testid="event-storyboard-broken-1"]');
      expect(broken).not.toBeNull();
      expect(broken?.textContent ?? "").toContain("표시할 수 없는 명령");
      const cards = Array.from(host.querySelectorAll(".event-storyboard-card"));
      expect(cards[0]?.textContent ?? "").toContain("허허");
      expect(cards[2]?.textContent ?? "").toContain("허허");
    } finally {
      host.remove();
    }
  });

  it("목록: 깨진 행 옆에 정상 행이 그려진다", () => {
    const host = document.createElement("div");
    document.body.append(host);
    try {
      renderCommandList(host, [GOOD, BROKEN, GOOD], [], actions);
      expect(host.querySelectorAll(".cmd-item").length).toBe(3);
      const broken = host.querySelector('[data-testid="event-command-broken-1"]');
      expect(broken).not.toBeNull();
      expect(broken?.textContent ?? "").toContain("표시할 수 없는 명령");
      expect(host.querySelectorAll('[data-testid="event-command-text"]').length).toBe(2);
    } finally {
      host.remove();
    }
  });

  it("분기 안 깨진 명령도 형제를 가리지 않는다", () => {
    const fork: Command = {
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_1", value: true },
      then: [GOOD, BROKEN],
      else: [],
    };
    const host = renderStoryboard([fork]);
    document.body.append(host);
    try {
      const cards = host.querySelectorAll(".event-storyboard-card, .event-storyboard-branch-command");
      expect(cards.length).toBeGreaterThanOrEqual(3);
      expect(host.querySelector('[data-testid^="event-storyboard-broken-"]')).not.toBeNull();
    } finally {
      host.remove();
    }
  });
});
