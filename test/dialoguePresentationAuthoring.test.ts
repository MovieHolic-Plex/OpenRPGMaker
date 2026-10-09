// 「말투·연출」 저작 UI 를 지킨다 — 승격된 자리와, 프리뷰가 **언제** 연출을 재생하는지.
//
// 이 값은 스키마가 이미 갖고 있었고 에디터도 이미 저작하게 해 줬지만 접힌 「고급 옵션」
// 안에 있어서 아무도 쓰지 않았다. 이제 이 값이 창 등장 곡선·글자 속도·화면 연출을
// 고르므로 문장 쓰는 자리에 나와 있어야 한다. 되접히면 기능이 다시 안 보이게 죽는다.
//
// 그리고 재생 시점이 더 미묘하다. 프리뷰는 본문 한 글자마다 통째로 다시 그려지므로,
// 진입 연출을 늘 재생하면 창이 타자마다 튀어 **글을 쓸 수 없다.** 연출이 바뀐 순간에만
// 재생해야 한다. 둘 다 화면으로만 보면 놓치기 쉬워 여기서 못 박는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCoreCommandBody } from "@/editor/panels/eventEditor/commandBodyCore";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ctx(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand,
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

function textForm(cmd: Extract<Command, { kind: "text" }>, replaceCommand = vi.fn()) {
  const root = renderWithFakeDom(() => renderCoreCommandBody(ctx(replaceCommand), cmd)!) as FakeElement;
  const select = findByTestId(root, "event-command-text-emotion") as FakeElement;
  const body = findByTestId(root, "event-command-text-body") as FakeElement;
  const window = () => findByTestId(root, "ecp-message-window") as FakeElement | null;
  return { root, select, body, window, replaceCommand };
}

describe("「말투·연출」 저작", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("고급 옵션 밖에 상시 노출된다", () => {
    const { root, select } = textForm({ kind: "text", speaker: "미나", body: "안녕" });
    const field = findByTestId(root, "event-command-text-presentation") as FakeElement | null;
    expect(field, "「말투·연출」 필드가 없다").not.toBeNull();
    const advanced = findByTestId(root, "event-command-text-advanced") as FakeElement;
    expect(
      advanced.contains(field),
      "「말투·연출」이 접힌 고급 옵션 안으로 돌아갔다 — 기능이 다시 안 보이게 죽는다."
    ).toBe(false);
    expect(advanced.contains(select), "감정 선택이 고급 옵션 안에 남아 있다").toBe(false);
    // 접힌 자리에는 자동 넘김만 남는다.
    expect(advanced.textContent).toContain("자동 넘김");
    expect(advanced.textContent).not.toContain("말투");
  });

  it("창을 열 때는 정착 상태로 그린다", () => {
    // 편집창을 열었을 뿐인데 창이 튀면 무엇이 바뀐 신호인지 알 수 없다.
    const { window } = textForm({ kind: "text", body: "안녕", emotion: "happy" });
    expect(window()?.dataset.dialogueEmotion).toBe("happy");
    expect(window()?.dataset.dialoguePhase).toBeUndefined();
  });

  it("연출을 고른 순간에만 프리뷰가 진입을 재생한다", () => {
    const { select, body, window, replaceCommand } = textForm({ kind: "text", body: "안녕" });
    expect(window()?.dataset.dialogueEmotion).toBe("neutral");

    select.value = "happy";
    select.dispatchEvent(new Event("change"));
    const replayed = window();
    expect(replayed?.dataset.dialogueEmotion).toBe("happy");
    expect(replayed?.dataset.dialoguePhase, "연출을 바꿨는데 프리뷰가 재생하지 않는다").toBe("enter");

    // 같은 연출로 본문만 이어 쓰면 재생하지 않는다. 재생하면 타자마다 창이 튀어
    // 글을 쓸 수 없다 — 프리뷰가 매 입력마다 통째로 다시 그려지기 때문이다.
    body.value = "안녕하세요";
    body.dispatchEvent(new Event("input"));
    const typed = window();
    expect(typed?.dataset.dialogueEmotion).toBe("happy");
    expect(typed?.dataset.dialoguePhase, "타자마다 진입 연출이 재생된다 — 글을 쓸 수 없다.").toBeUndefined();

    // 값 형식은 그대로다: neutral 은 필드를 아예 남기지 않는다.
    expect(replaceCommand).toHaveBeenLastCalledWith([0], {
      kind: "text",
      speaker: undefined,
      body: "안녕하세요",
      emotion: "happy",
    });
    select.value = "neutral";
    select.dispatchEvent(new Event("change"));
    expect(replaceCommand).toHaveBeenLastCalledWith([0], {
      kind: "text",
      speaker: undefined,
      body: "안녕하세요",
    });
  });

  it("움직임을 끈 자리도 프리뷰가 알아본다", () => {
    // motion off 는 CSS 가 읽는 게이트다. 프리뷰가 이 값을 안 심으면
    // reduced-motion 안전망이 프리뷰에만 안 걸린다.
    const { window } = textForm({ kind: "text", body: "안녕", emotion: "angry" });
    expect(window()?.dataset.dialogueMotion).toBe("on");
  });
});
