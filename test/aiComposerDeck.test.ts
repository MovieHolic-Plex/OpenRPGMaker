import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createComposerElements, type ComposerElements, type ComposerMode } from "@/editor/panels/aiComposer";
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
  readonly onMode?: (mode: ComposerMode) => void;
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
    ...(extra.onMode ? { modeChips: { initial: "do", onChange: extra.onMode } } : {}),
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

  it("모드 세그먼트는 지시/질문/계획 셋이고 클릭이 onChange 와 aria-checked 를 함께 바꾼다", () => {
    // Break: 옵션 클릭이 콜백만 부르고 표시 상태를 안 바꾸거나, setMode 가 표시만 바꾸고 dataset 을 안 바꾼다.
    const picked: ComposerMode[] = [];
    const { shell } = render({ onMode: (mode) => picked.push(mode) });
    const segment = shell.modeSegment;
    expect(segment).not.toBeNull();
    const options = segment?.querySelectorAll(".ai-composer-mode-option") ?? [];
    expect([...options].map((node) => node.textContent)).toEqual(["지시", "질문", "계획"]);
    expect(options[0]?.getAttribute("aria-checked")).toBe("true");
    (options[1] as unknown as FakeElement).click();
    expect(picked).toEqual(["ask"]);
    expect(options[1]?.getAttribute("aria-checked")).toBe("true");
    expect(options[0]?.getAttribute("aria-checked")).toBe("false");
    expect(segment?.dataset.mode).toBe("ask");
    shell.setMode("plan");
    expect(segment?.dataset.mode).toBe("plan");
    expect(options[2]?.getAttribute("aria-checked")).toBe("true");
  });

  it("모드 옵션을 주지 않으면 세그먼트를 만들지 않는다", () => {
    // Break: 옵션 없이도 세그먼트가 생겨 콜백 없는 라디오가 행을 차지한다.
    const { shell } = render();
    expect(shell.modeSegment).toBeNull();
    expect((shell.actions as unknown as FakeElement).querySelector(".ai-composer-mode")).toBeNull();
  });

  it("모델 칩은 라벨을 보이고 null 이면 숨는다", () => {
    // Break: 라벨이 없을 때 「null」 이 찍히거나 칩이 자리를 먹는다.
    const { shell } = render({ modelLabel: "Gemini 3.7 Flash" });
    const chip = findByTestId(shell.actions as unknown as FakeElement, "ai-composer-model");
    expect(chip?.textContent).toBe("Gemini 3.7 Flash");
    expect(chip?.hidden).toBe(false);
    shell.setModelLabel(null);
    expect(chip?.hidden).toBe(true);
    expect(chip?.textContent).toBe("");
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
