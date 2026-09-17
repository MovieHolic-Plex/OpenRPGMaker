// 지시줄 자율성 셀렉트 — 컴포저 단위 계약: 값 어휘·초기값·콜백·외부 동기화.
// 추론 강도 셀렉트는 없다: 레벨 프리셋이 추론을 정한다(src/ai/autonomyLevels.ts).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTONOMY_LEVELS, type AutonomyLevel } from "@/ai/autonomyLevels";
import {
  createComposerElements,
  type ComposerElements,
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
  readonly onAutonomy?: (level: AutonomyLevel) => void;
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
      onAutonomyChange: extra.onAutonomy ?? (() => undefined),
    },
  });
}

describe("aiComposer 자율성 셀렉트", () => {
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("effortChips 를 주지 않으면 셀렉트를 만들지 않는다", () => {
    // Break: 옵션 없이 셀렉트가 생겨 콜백 없는 컨트롤이 행을 차지한다.
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
    expect((shell.actions as unknown as FakeElement).querySelector('[data-testid="ai-composer-autonomy"]')).toBeNull();
  });

  it("적용 정책은 자율성과 별도로 다섯 모드를 제공한다", () => {
    const shell = render();
    const select = (shell.actions as unknown as FakeElement).querySelector('[data-testid="ai-composer-apply-mode"]');
    expect(select?.querySelectorAll("option").map(option => option.getAttribute("value"))).toEqual(["yolo", "auto", "default", "review", "step"]);
    expect(select?.value).toBe("default");
  });

  it("자율성 선택지는 다이얼 전체를 한국어 라벨로 그린다", () => {
    // Break: 읽기 전용이 목록에서 빠지면 ask 레일을 부를 수단이 UI 에서 사라진다.
    const shell = render();
    const autonomyOptions = shell.autonomySelect?.querySelectorAll("option") ?? [];
    expect([...autonomyOptions].map((node) => node.getAttribute("value"))).toEqual(
      AUTONOMY_LEVELS.map((level) => level.id),
    );
    expect([...autonomyOptions].map((node) => node.textContent)).toEqual(
      AUTONOMY_LEVELS.map((level) => level.label),
    );
    expect([...autonomyOptions].map((node) => node.getAttribute("value"))).toContain("readonly");
  });

  it("추론 강도 셀렉트를 그리지 않는다", () => {
    // Break: 수동 override 가 남으면 다이얼이 저장한 프리셋 값과 갈라진다.
    const shell = render();
    const selects = (shell.actions as unknown as FakeElement).querySelectorAll('[data-testid="ai-composer-autonomy"]');
    expect([...selects].length).toBe(1);
  });

  it("초기값을 그리고 change 가 콜백을 부른다", () => {
    const picked: AutonomyLevel[] = [];
    const shell = render({ autonomy: "autonomous", onAutonomy: (level) => picked.push(level) });
    expect(shell.autonomySelect?.value).toBe("autonomous");
    if (!shell.autonomySelect) throw new Error("autonomy select missing");
    shell.autonomySelect.value = "readonly";
    shell.autonomySelect.dispatchEvent(new Event("change"));
    expect(picked).toEqual(["readonly"]);
  });

  it("알 수 없는 값은 콜백 없이 표시를 되돌린다", () => {
    // Break: 검증 없이 통과시키면 저장소에 레벨 아닌 문자열이 들어가 유도가 balanced 로 무너진다.
    const picked: AutonomyLevel[] = [];
    const shell = render({ autonomy: "balanced", onAutonomy: (level) => picked.push(level) });
    if (!shell.autonomySelect) throw new Error("autonomy select missing");
    shell.autonomySelect.value = "turbo";
    shell.autonomySelect.dispatchEvent(new Event("change"));
    expect(picked).toEqual([]);
    expect(shell.autonomySelect.value).toBe("balanced");
  });

  it("syncEffort 가 셀렉트 표시를 고친다", () => {
    // Break: 설정 모달에서 바꾼 뒤 컴포저 표시만 옛값이라 거짓을 보여준다.
    const shell = render({ autonomy: "balanced" });
    shell.syncEffort("max");
    expect(shell.autonomySelect?.value).toBe("max");
  });

  it("셀렉트는 액션 행 lead 에 있고 팝오버 기계를 건드리지 않는다", () => {
    const shell = render();
    const actions = shell.actions as unknown as FakeElement;
    const lead = actions.querySelector(".ai-composer-actions-lead");
    expect(lead?.contains(shell.autonomySelect)).toBe(true);
    expect(shell.openKind()).toBeNull();
  });
});
