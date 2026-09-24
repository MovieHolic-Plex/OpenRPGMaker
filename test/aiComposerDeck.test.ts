import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createComposerElements, type ComposerElements } from "@/editor/panels/aiComposer";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

function button(testid: string): HTMLButtonElement {
  const node = document.createElement("button");
  node.dataset.testid = testid;
  return node;
}

function div(cls: string): HTMLElement {
  const node = document.createElement("div");
  node.className = cls;
  return node;
}

function render(extra: {
  readonly isInside?: (target: Node) => boolean;
  readonly modelLabel?: string | null;
} = {}): { readonly shell: ComposerElements; readonly input: HTMLTextAreaElement; readonly collapse: HTMLButtonElement } {
  const input = document.createElement("textarea");
  input.dataset.testid = "ai-input";
  const collapse = button("ai-collapse");
  const shell = createComposerElements({
    input,
    collapseButton: collapse,
    sendButton: button("ai-send"),
    abortButton: button("ai-abort"),
    undoAppliedButton: button("ai-composer-undo"),
    contextChips: div("ai-context-chips"),
    composerChips: div("ai-composer-chips"),
    nextSteps: div("ai-next-steps"),
    queueIndicator: div("ai-pending-queue"),
    statusGroup: div("ai-status-group"),
    contextMeterButton: button("ai-context-meter"),
    contextMeterPopover: div("ai-context-panel"),
    onNewChat: () => undefined,
    onOpenConversations: () => undefined,
    preferenceContent: div("ai-preference-settings"),
    ...(extra.isInside ? { isInside: extra.isInside } : {}),
    ...(extra.modelLabel !== undefined ? { modelLabel: extra.modelLabel } : {}),
  });
  return { shell, input, collapse };
}

describe("aiComposer — 데크 컴포저", () => {
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("레일용 버튼(새 대화·이전 대화·더보기·성향·맥락·접기)은 만들되 액션 행에 넣지 않는다", () => {
    // Break: 버튼이 다시 액션 행에 들어가면 레일과 두 벌이 되거나, 반환값이 비어 레일이 빈 슬롯이 된다.
    const { shell, collapse } = render();
    const actions = shell.actions as unknown as FakeElement;
    for (const testid of ["ai-new-chat", "ai-open-conversations", "ai-command-menu-toggle", "ai-preference-toggle", "ai-context-meter", "ai-collapse"]) {
      expect(findByTestId(actions, testid), `${testid} 는 행 밖`).toBeNull();
    }
    expect(shell.newChatButton.dataset.testid).toBe("ai-new-chat");
    expect(shell.conversationsButton?.dataset.testid).toBe("ai-open-conversations");
    expect(findByTestId(shell.conversationsButton as unknown as FakeElement, "ai-map-history-open")).not.toBeNull();
    expect(shell.menuToggle.dataset.testid).toBe("ai-command-menu-toggle");
    expect(shell.preferenceToggle?.dataset.testid).toBe("ai-preference-toggle");
    expect(collapse.parentElement).toBeNull();
  });

  it("레일 버튼은 글리프가 아니라 SVG 아이콘 + aria-label 이다", () => {
    // Break: 텍스트 글리프(+ 🕒 ☰ ⌾)로 돌아간다.
    const { shell } = render();
    const hasSvg = (node: HTMLElement | null): boolean =>
      [...(node?.childNodes ?? [])].some((child) => (child as { tagName?: string }).tagName?.toLowerCase() === "svg");
    for (const node of [shell.newChatButton, shell.conversationsButton, shell.menuToggle, shell.preferenceToggle]) {
      expect(hasSvg(node), node?.dataset.testid).toBe(true);
      expect((node?.getAttribute("aria-label") ?? "").length).toBeGreaterThan(0);
    }
    expect(shell.newChatButton.textContent).toBe("");
  });

  it("키 힌트 글자는 행에서 사라지고 입력창 title 로 간다", () => {
    // Break: 156px 힌트가 다시 액션 행을 점유한다.
    const { shell, input } = render();
    expect((shell.commandBar as unknown as FakeElement).querySelector(".ai-composer-hint")).toBeNull();
    expect(input.getAttribute("title")).toContain("Enter");
  });

  it("모드 세그먼트를 아예 만들지 않는다 — 지시줄 컨트롤은 자율성 다이얼 하나다", () => {
    // Break: 세그먼트가 남으면 같은 노브(질문=readOnly, 계획=planOnly)를 두 컨트롤이 만지고,
    // 둘이 어긋날 때 어느 쪽이 이기는지 사용자가 알 수 없다.
    const { shell } = render();
    const actions = shell.actions as unknown as FakeElement;
    expect(actions.querySelector(".ai-composer-mode")).toBeNull();
    expect(actions.querySelector(".ai-composer-mode-option")).toBeNull();
  });

  it("모델명은 입력줄에 두지 않는다", () => {
    const { shell } = render({ modelLabel: "Gemini 3.7 Flash" });
    const actions = shell.actions as unknown as FakeElement;
    expect(findByTestId(actions, "ai-composer-model")).toBeNull();
  });

  it("턴·토큰 줄은 비어 있으면 숨고, 값이 있으면 입력줄에 보인다", () => {
    const { shell } = render();
    const chip = findByTestId(shell.actions as unknown as FakeElement, "ai-composer-spend");
    expect(chip?.hidden).toBe(true);
    shell.setSpend("3턴 · 12,400토큰");
    expect(chip?.hidden).toBe(false);
    expect(chip?.textContent).toBe("3턴 · 12,400토큰");
    shell.setSpend(null);
    expect(chip?.hidden).toBe(true);
  });

  it("바깥 클릭 판정은 isInside 가 정한다 — 데크 안(레일)의 클릭은 메뉴를 닫지 않는다", () => {
    // Break: containment 가 commandBar 로 고정돼 레일의 ⋯ 를 두 번 누르면 닫히고 곧 다시 열린다.
    const outside = document.createElement("div");
    let inside = true;
    const { shell } = render({ isInside: () => inside });
    shell.openPopover("menu");
    expect(shell.openKind()).toBe("menu");
    (outside as unknown as FakeElement).dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(shell.openKind()).toBe("menu");
    inside = false;
    (outside as unknown as FakeElement).dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(shell.openKind()).toBeNull();
  });
});
