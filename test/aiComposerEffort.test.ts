// 지시줄 effort 셀렉트 — 컴포저 단위 계약: 값 어휘·초기값·콜백·외부 동기화.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTONOMY_LEVELS, type AutonomyLevel } from "@/ai/autonomyLevels";
import {
  COMPOSER_REASONING_OPTIONS,
  createComposerElements,
  type ComposerElements,
  type ComposerReasoningEffort,
} from "@/editor/panels/aiComposer";
import { FakeElement, installFakeDom } from "./fakeDom";

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
  readonly autonomy?: AutonomyLevel;
  readonly reasoning?: ComposerReasoningEffort;
  readonly onAutonomy?: (level: AutonomyLevel) => void;
  readonly onReasoning?: (effort: ComposerReasoningEffort) => void;
} = {}): ComposerElements {
  const input = document.createElement("textarea");
  return createComposerElements({
    input,
    collapseButton: button("ai-collapse"),
    sendButton: button("ai-send"),
    abortButton: button("ai-abort"),
    undoAppliedButton: button("ai-composer-undo"),
    contextChips: div("ai-context-chips"),
    composerChips: div("ai-composer-chips"),
    nextSteps: div("ai-next-steps"),
    queueIndicator: div("ai-pending-queue"),
    statusGroup: div("ai-status-group"),
    onNewChat: () => undefined,
    effortChips: {
      initialAutonomy: extra.autonomy ?? "balanced",
      initialReasoning: extra.reasoning ?? "low",
      onAutonomyChange: extra.onAutonomy ?? (() => undefined),
      onReasoningChange: extra.onReasoning ?? (() => undefined),
    },
  });
}

describe("aiComposer effort 셀렉트", () => {
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("effortChips 를 주지 않으면 셀렉트를 만들지 않는다", () => {
    // Break: 옵션 없이 셀렉트가 생겨 콜백 없는 컨트롤이 행을 차지한다(모드 세그먼트와 같은 규약).
    const input = document.createElement("textarea");
    const shell = createComposerElements({
      input,
      collapseButton: button("ai-collapse"),
      sendButton: button("ai-send"),
      abortButton: button("ai-abort"),
      undoAppliedButton: button("ai-composer-undo"),
      contextChips: div("ai-context-chips"),
      composerChips: div("ai-composer-chips"),
      nextSteps: div("ai-next-steps"),
      queueIndicator: div("ai-pending-queue"),
      statusGroup: div("ai-status-group"),
      onNewChat: () => undefined,
    });
    expect(shell.autonomySelect).toBeNull();
    expect(shell.reasoningSelect).toBeNull();
    expect((shell.actions as unknown as FakeElement).querySelector(".ai-composer-effort-select")).toBeNull();
  });

  it("자율성 선택지는 4단계 한국어 라벨, 추론 선택지는 설정 모달과 같은 값·라벨이다", () => {
    const shell = render();
    const autonomyOptions = shell.autonomySelect?.querySelectorAll("option") ?? [];
    expect([...autonomyOptions].map((node) => node.getAttribute("value"))).toEqual(
      AUTONOMY_LEVELS.map((level) => level.id),
    );
    expect([...autonomyOptions].map((node) => node.textContent)).toEqual(
      AUTONOMY_LEVELS.map((level) => level.label),
    );
    const reasoningOptions = shell.reasoningSelect?.querySelectorAll("option") ?? [];
    expect([...reasoningOptions].map((node) => node.getAttribute("value"))).toEqual(
      COMPOSER_REASONING_OPTIONS.map((option) => option.id),
    );
    expect([...reasoningOptions].map((node) => node.textContent)).toEqual(
      COMPOSER_REASONING_OPTIONS.map((option) => option.label),
    );
  });

  it("초기값을 그리고 change 가 해당 콜백만 부른다", () => {
    const picked: AutonomyLevel[] = [];
    const pickedEffort: ComposerReasoningEffort[] = [];
    const shell = render({
      autonomy: "autonomous",
      reasoning: "high",
      onAutonomy: (level) => picked.push(level),
      onReasoning: (effort) => pickedEffort.push(effort),
    });
    expect(shell.autonomySelect?.value).toBe("autonomous");
    expect(shell.reasoningSelect?.value).toBe("high");
    if (!shell.autonomySelect || !shell.reasoningSelect) throw new Error("effort selects missing");
    shell.autonomySelect.value = "max";
    shell.autonomySelect.dispatchEvent(new Event("change"));
    expect(picked).toEqual(["max"]);
    expect(pickedEffort).toEqual([]);
    shell.reasoningSelect.value = "off";
    shell.reasoningSelect.dispatchEvent(new Event("change"));
    expect(pickedEffort).toEqual(["off"]);
    expect(picked).toEqual(["max"]);
  });

  it("syncEffort 가 두 셀렉트를 함께 고친다", () => {
    // Break: 설정 모달에서 바꾼 뒤 컴포저 표시만 옛값이라 거짓을 보여준다.
    const shell = render({ autonomy: "balanced", reasoning: "low" });
    shell.syncEffort("max", "high");
    expect(shell.autonomySelect?.value).toBe("max");
    expect(shell.reasoningSelect?.value).toBe("high");
  });

  it("셀렉트는 액션 행 lead 에 있고 팝오버 기계를 건드리지 않는다", () => {
    const shell = render();
    const actions = shell.actions as unknown as FakeElement;
    const lead = actions.querySelector(".ai-composer-actions-lead");
    expect(lead?.contains(shell.autonomySelect)).toBe(true);
    expect(lead?.contains(shell.reasoningSelect)).toBe(true);
    expect(shell.openKind()).toBeNull();
  });
});
