import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createComposerElements, type ComposerElements } from "@/editor/panels/aiComposer";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { AUTONOMY_LEVELS, type AutonomyLevel } from "@/ai/autonomyLevels";
import { contextUsagePercent, contextUsageTone, createAiContextMeter, formatContextMeterLabel, type AiContextSnapshot } from "@/editor/panels/aiContextMeter";
import type { ContextUsage } from "@/ai/contextCompaction";
import { EMPTY_SESSION_USAGE, addSessionUsage } from "@/ai/sessionUsage";
import type { AuditEntry } from "@/ai/assistantSession";
import * as conversations from "@/ai/conversationStore";
import { clearConversations, CONVERSATION_TRIM_MARKER, deriveTitle, listConversations, saveConversation, type ConversationRecord, type ConversationSummary } from "@/ai/conversationStore";
import { resetAiRecordDbForTest } from "@/ai/aiRecordDb";
import { AI_HISTORY_ARCHIVE_PAGE_SIZE, closeAiConversationHistoryModal, filterConversationsByTitle, openAiConversationHistoryModal, sortConversationsForScope, whenAiConversationHistoryModalSettled } from "@/editor/panels/aiConversationHistoryModal";
import { createConversationLogHost } from "@/editor/panels/aiConversationLog";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { RESTORED_TRANSCRIPT_MARKER, isRestoredTranscriptMessage, restoredTranscriptMessage, serializeAuditTranscript } from "@/ai/conversationReplay";
import { isolateTimers } from "./mergedTeardown";
import { listChangeItems, revertChangeItem } from "@/editor/panels/aiChangeSummaryCard";
import { creationCardModel, eventAppearanceId, firstPlayedMusic, firstSpokenLine } from "@/editor/panels/aiCreationCards";
import { runTool } from "@/editor/tools";
import type { GameEvent, Project, EnemyRecord, ItemRecord, GameMap } from "@/project/types";
import { DECK_ICON_NAMES, deckIcon } from "@/editor/panels/aiDeckIcons";
import { createDeckRail, deckStateOfTone } from "@/editor/panels/aiDeckRail";
import { findEntityMentions, renderEntityMentionStrip, type EntityMention } from "@/editor/panels/aiEntityMentions";
import { mergeHarnessTimeline } from "@/editor/panels/aiHarnessModal";
import { AI_INSTRUCTIONS_MAX_CHARS } from "@/ai/projectInstructions";
import { closeAiInstructionsModal, openAiInstructionsModal } from "@/editor/panels/aiInstructionsModal";
import { getMapEditHistoryMarker, getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createLaneGhostSink } from "@/editor/panels/aiLaneGhost";
import { createLaneManager } from "@/editor/panels/aiLaneManager";
import { diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import { clearAgentGhostPreview, getAgentGhostDraftMap, getAgentGhostPreviewState, setAgentGhostDraftMapProvider } from "@/editor/agentGhostPreview";
import { chipWindow, regionFromToolCall, renderMapChip } from "@/editor/panels/aiMapChip";
import { clampPanelSize, clampPanelSizeToViewport, loadPanelBarSize, PANEL_SIZE_LIMITS, savePanelBarSize, savePanelSize, stepAiFontSize } from "@/editor/panels/aiPanelLayout";

describe("aiComposerDeck", () => {
  isolateTimers();
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

    it("턴·토큰 줄은 비어 있으면 숨고, 값이 있으면 입력창 밖 메타 줄에 보인다", () => {
      const { shell } = render();
      // #4899: 사용량 줄은 칩 줄(actions) 밖, 명령 바의 메타 줄로 옮겨졌다.
      expect(findByTestId(shell.actions as unknown as FakeElement, "ai-composer-spend")).toBeNull();
      const chip = findByTestId(shell.commandBar as unknown as FakeElement, "ai-composer-spend");
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
});

// 지시줄 자율성 셀렉트 — 컴포저 단위 계약: 값 어휘·초기값·콜백·외부 동기화.
// 추론 강도 셀렉트는 없다: 레벨 프리셋이 추론을 정한다(src/ai/autonomyLevels.ts).
describe("aiComposerEffort", () => {
  isolateTimers();
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
      // 셀렉트들은 액션 행이 아니라 「작업 설정」 팝오버(commandBar 안)에 산다(public baseline 0d4f13e7c8).
      const select = (shell.commandBar as unknown as FakeElement).querySelector('[data-testid="ai-composer-apply-mode"]');
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
      // 셀렉트들은 액션 행이 아니라 「작업 설정」 팝오버(commandBar 안)에 산다(public baseline 0d4f13e7c8).
      const selects = (shell.commandBar as unknown as FakeElement).querySelectorAll('[data-testid="ai-composer-autonomy"]');
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

    it("셀렉트는 작업 설정 팝오버에 있고, 액션 행 lead 는 그 토글만 갖고, 팝오버 기계를 건드리지 않는다", () => {
      // 자율성 셀렉트는 「작업 설정」 팝오버로 옮겨졌다(public baseline 0d4f13e7c8) — lead 에는 여는 토글이 남는다.
      const shell = render();
      const actions = shell.actions as unknown as FakeElement;
      const lead = actions.querySelector(".ai-composer-actions-lead");
      expect(lead?.querySelector('[data-testid="ai-composer-settings"]')).toBeTruthy();
      const popover = (shell.commandBar as unknown as FakeElement).querySelector('[data-testid="ai-composer-settings-popover"]');
      expect(popover?.contains(shell.autonomySelect)).toBe(true);
      expect(shell.openKind()).toBeNull();
    });
  });
});

// test/aiContextMeter.test.ts
// 맥락 게이지 — 라벨/톤 계산과 팝오버가 스냅샷을 그대로 비추는지.
//
// 톤 기준은 **자동 압축 임계** 다(모델 창이 아니다): 사용자가 궁금한 것은 "창이 얼마 남았나"
// 가 아니라 "언제 자동으로 압축이 도는가" 이기 때문이다. 게이지가 창 기준으로 세면 임계를
// 넘어 압축이 돌아도 게이지는 한가하게 보인다.
describe("aiContextMeter", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  function usage(overrides: Partial<ContextUsage> = {}): ContextUsage {
    return {
      estimateTokens: 40_000,
      usageTokens: 0,
      contextTokens: 40_000,
      contextWindow: 128_000,
      reserveTokens: 16_384,
      thresholdTokens: 111_616,
      ratio: 40_000 / 128_000,
      overThreshold: false,
      ...overrides,
    };
  }
  function snapshot(overrides: Partial<AiContextSnapshot> = {}): AiContextSnapshot {
    return {
      usage: usage(),
      totals: EMPTY_SESSION_USAGE,
      summary: null,
      canUndoCompaction: false,
      busy: false,
      ...overrides,
    };
  }
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  describe("게이지 숫자와 톤", () => {
    it("Given 비율 When 퍼센트 Then 정수로 반올림한다", () => {
      expect(contextUsagePercent(usage({ ratio: 0.6249 }))).toBe(62);
      expect(contextUsagePercent(usage({ ratio: 0 }))).toBe(0);
    });

    it("Given 임계 미만 When 톤 Then idle", () => {
      expect(contextUsageTone(usage({ contextTokens: 40_000 }))).toBe("idle");
    });

    it("Given 임계의 80% 이상 When 톤 Then near", () => {
      expect(contextUsageTone(usage({ contextTokens: Math.ceil(111_616 * 0.8) }))).toBe("near");
    });

    it("Given 임계 초과 When 톤 Then warn", () => {
      expect(contextUsageTone(usage({ contextTokens: 120_000, overThreshold: true }))).toBe("warn");
    });

    it("Given 세션 없음 When 라벨 Then 0% 라고 거짓말하지 않고 무엇의 칸인지 말한다(C-71)", () => {
      // C-71(92a6aba61e): 줄표 자리표시 대신 「맥락 사용량」. 숫자 0% 를 지어내지 않는 계약은 그대로다.
      expect(formatContextMeterLabel(null)).toBe("맥락 사용량");
      expect(formatContextMeterLabel(usage({ ratio: 0.31 }))).toBe("맥락 31%");
    });
  });
  describe("팝오버 내용", () => {
    it("Given 세션 없음 When 렌더 Then 압축 버튼이 잠기고 안내 문장이 온다", () => {
      const meter = createAiContextMeter({
        read: () => snapshot({ usage: null }),
        onCompact: () => undefined,
        onUndoCompaction: () => undefined,
        onToggle: () => undefined,
      });
      const popover = meter.popover as unknown as FakeElement;

      expect((meter.button as unknown as FakeElement).textContent).toBe("맥락 사용량");
      expect(findByTestId(popover, "ai-context-headline")!.textContent).toBe("아직 대화가 없습니다");
      expect((findByTestId(popover, "ai-context-compact") as unknown as { disabled: boolean }).disabled).toBe(true);
      expect(findByTestId(popover, "ai-context-usage")!.textContent).toBe("아직 요청 없음");
    });

    it("Given 사용량과 요약이 있는 스냅샷 When 갱신 Then 토큰·임계·모델별 집계가 보인다", () => {
      let current = snapshot({
        usage: usage({ usageTokens: 52_000, contextTokens: 52_000, ratio: 52_000 / 128_000 }),
        totals: addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 52_000, completion_tokens: 900 }),
        summary: "## Goal\n마을 정비",
      });
      const meter = createAiContextMeter({
        read: () => current,
        onCompact: () => undefined,
        onUndoCompaction: () => undefined,
        onToggle: () => undefined,
      });
      const popover = meter.popover as unknown as FakeElement;

      expect((meter.button as unknown as FakeElement).textContent).toBe("맥락 41%");
      expect((meter.button as unknown as FakeElement).dataset.tone).toBe("idle");
      const detail = findByTestId(popover, "ai-context-detail")!.textContent;
      expect(detail).toContain("52,000 / 128,000 토큰");
      expect(detail).toContain("자동 압축 임계 111,616 토큰");
      expect(findByTestId(popover, "ai-context-usage")!.textContent).toBe("호출 1회 · 입력 52,000 · 출력 900");
      expect(findByTestId(popover, "ai-context-models")!.textContent).toContain("gpt-x");
      // 요약 원문은 접힌 채 존재한다 — 토글로만 펼친다.
      const body = findByTestId(popover, "ai-context-summary-body")!;
      expect(body.hidden).toBe(true);
      expect(body.textContent).toContain("마을 정비");
      (findByTestId(popover, "ai-context-summary-toggle") as unknown as HTMLElement).click();
      expect(body.hidden).toBe(false);

      // 임계를 넘기면 톤이 경고로 바뀐다.
      current = snapshot({ usage: usage({ contextTokens: 120_000, ratio: 120_000 / 128_000, overThreshold: true }) });
      meter.refresh();
      expect((meter.button as unknown as FakeElement).dataset.tone).toBe("warn");
      expect(findByTestId(popover, "ai-context-detail")!.textContent).toContain("이미 넘었습니다");
    });

    it("Given 턴 진행 중 When 갱신 Then 압축·되돌리기 둘 다 잠긴다(요약 콜이 진행 중 요청과 겹친다)", () => {
      const meter = createAiContextMeter({
        read: () => snapshot({ busy: true, canUndoCompaction: true }),
        onCompact: () => undefined,
        onUndoCompaction: () => undefined,
        onToggle: () => undefined,
      });
      const popover = meter.popover as unknown as FakeElement;

      expect((findByTestId(popover, "ai-context-compact") as unknown as { disabled: boolean }).disabled).toBe(true);
      expect((findByTestId(popover, "ai-context-compact-undo") as unknown as { disabled: boolean }).disabled).toBe(true);
    });

    it("Given 되돌릴 압축이 없음 When 갱신 Then 되돌리기 버튼 자체를 숨긴다", () => {
      const meter = createAiContextMeter({
        read: () => snapshot(),
        onCompact: () => undefined,
        onUndoCompaction: () => undefined,
        onToggle: () => undefined,
      });

      expect(findByTestId(meter.popover as unknown as FakeElement, "ai-context-compact-undo")!.hidden).toBe(true);
    });

    it("Given 버튼 클릭 When 콜백 Then 압축·되돌리기·열기 신호가 각각 나간다", () => {
      const calls: string[] = [];
      const meter = createAiContextMeter({
        read: () => snapshot({ canUndoCompaction: true }),
        onCompact: () => calls.push("compact"),
        onUndoCompaction: () => calls.push("undo"),
        onToggle: () => calls.push("toggle"),
      });
      const popover = meter.popover as unknown as FakeElement;

      (meter.button as unknown as HTMLElement).click();
      (findByTestId(popover, "ai-context-compact") as unknown as HTMLElement).click();
      (findByTestId(popover, "ai-context-compact-undo") as unknown as HTMLElement).click();

      expect(calls).toEqual(["toggle", "compact", "undo"]);
    });
  });
});

describe("aiConversation", () => {
  isolateTimers();
  // test/aiConversationHistoryModal.test.ts
  // 저장된 대화 목록 모달 — 정렬/검색 순수 함수 + 맵 필터/열기/삭제/페이지/복구.
  describe("aiConversationHistoryModal", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const KNOWN_MAPS = [
      { id: "map_a", name: "광장" },
      { id: "map_b", name: "숲길" },
    ] as const;
    function installMemoryStorage(): void {
      const values = new Map<string, string>();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: {
          get length() {
            return values.size;
          },
          clear: () => values.clear(),
          getItem: (key: string) => values.get(key) ?? null,
          key: (index: number) => Array.from(values.keys())[index] ?? null,
          removeItem: (key: string) => void values.delete(key),
          setItem: (key: string, value: string) => void values.set(key, String(value)),
        },
      });
    }
    function summary(id: string, savedAt: number, projectContextKey?: string): ConversationSummary {
      return {
        id,
        title: `대화 ${id}`,
        model: "m",
        savedAt,
        turnCount: 1,
        ...(projectContextKey === undefined ? {} : { projectContextKey }),
      };
    }
    function mapContext(mapId: string, mapName = mapId): NonNullable<Extract<AuditEntry, { kind: "user" }>["context"]> {
      return { mapId, mapName, mapWidth: 20, mapHeight: 15 };
    }
    function record(
      id: string,
      savedAt: number,
      scope?: string,
      text = `지시 ${id}`,
      mapId: string | null = "map_a",
    ): ConversationRecord {
      const entries: AuditEntry[] = [{
        kind: "user",
        text,
        ...(mapId ? { context: mapContext(mapId, mapId === "map_a" ? "광장" : mapId === "map_b" ? "숲길" : mapId) } : {}),
      }];
      return {
        id,
        title: deriveTitle(entries),
        model: "m",
        savedAt,
        entries,
        ...(scope === undefined ? {} : { projectContextKey: scope }),
      };
    }
    function openModal(
      overrides: Partial<Parameters<typeof openAiConversationHistoryModal>[0]> = {},
    ): FakeElement {
      const onOpen = overrides.onOpen ?? (() => undefined);
      return openAiConversationHistoryModal({
        scopeKey: "mine",
        currentConversationId: "none",
        currentMapId: "map_a",
        knownMaps: KNOWN_MAPS,
        ...overrides,
        onOpen,
      }) as unknown as FakeElement;
    }
    function click(root: FakeElement, testId: string): void {
      const node = findByTestId(root, testId);
      expect(node, testId).not.toBeNull();
      (node as unknown as HTMLElement).click();
    }
    function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((done) => { resolve = done; });
      return { promise, resolve };
    }
    beforeEach(async () => {
      installMemoryStorage();
      resetAiRecordDbForTest();
      await clearConversations();
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      closeAiConversationHistoryModal();
      restoreDom?.();
      restoreDom = null;
      if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
      else Reflect.deleteProperty(globalThis, "localStorage");
      vi.restoreAllMocks();
    });
    describe("sortConversationsForScope", () => {
      it("Given 내 프로젝트와 남의 프로젝트가 섞임 When 정렬 Then 내 것이 먼저, 그 안에서 최근 순", () => {
        const sorted = sortConversationsForScope(
          [summary("old-mine", 100, "mine"), summary("foreign", 900, "other"), summary("new-mine", 500, "mine")],
          "mine",
        );

        expect(sorted.map((row) => row.id)).toEqual(["new-mine", "old-mine", "foreign"]);
      });

      it("Given 스코프 미기록 대화 When 정렬 Then 남의 것과 같은 뒤쪽으로 간다(내 것으로 위장하지 않는다)", () => {
        const sorted = sortConversationsForScope([summary("unscoped", 900), summary("mine", 100, "mine")], "mine");

        expect(sorted.map((row) => row.id)).toEqual(["mine", "unscoped"]);
      });
    });
    describe("filterConversationsByTitle", () => {
      const rows = [summary("a", 1), summary("B", 2)];

      it("Given 빈 검색어 When 필터 Then 전부 남는다", () => {
        expect(filterConversationsByTitle(rows, "   ")).toHaveLength(2);
      });

      it("Given 대소문자 다른 부분 문자열 When 필터 Then 대소문자를 무시하고 찾는다", () => {
        expect(filterConversationsByTitle(rows, "b").map((row) => row.id)).toEqual(["B"]);
      });

      it("Given 없는 제목 When 필터 Then 빈 목록", () => {
        expect(filterConversationsByTitle(rows, "없음")).toHaveLength(0);
      });
    });
    describe("모달 렌더", () => {
      it("Given 저장된 대화 2건 When 열기 Then 현재-맵 필터가 켜지고 행 2개가 최근 순으로 렌더된다", async () => {
        await saveConversation(record("old", 1_000, "mine", "오래된 지시"));
        await saveConversation(record("new", 2_000, "mine", "최근 지시"));

        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-filter-current")!.getAttribute("aria-pressed")).toBe("true");
        const list = findByTestId(backdrop, "ai-history-list")!;
        const rows = list.querySelectorAll("[data-testid=ai-history-row]");
        expect(rows).toHaveLength(2);
        expect(rows[0]!.textContent).toContain("최근 지시");
      });

      it("Given 저장된 대화 없음 When 열기 Then 빈 상태가 오고 전역 부재를 주장하지 않는다", async () => {
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-empty")!.textContent).not.toMatch(/어디에도|anywhere/i);
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(0);
      });

      it("Given 행 클릭 When 열기 Then 기록 전체(record)가 호출자에게 전달되고 모달이 닫힌다", async () => {
        await saveConversation(record("target", 1_000, "mine", "우물을 놔줘"));
        const opened: ConversationRecord[] = [];
        const backdrop = openModal({ onOpen: (row) => opened.push(row) });
        await whenAiConversationHistoryModalSettled();

        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();

        expect(opened).toHaveLength(1);
        expect(opened[0]!.id).toBe("target");
        expect(opened[0]!.entries[0]).toMatchObject({ kind: "user", text: "우물을 놔줘" });
        expect(backdrop.parentElement).toBeNull();
      });

      it("Given 지금 열려 있는 대화 When 렌더 Then 「현재」로 표시하고 클릭을 무시한다", async () => {
        await saveConversation(record("current", 1_000, "mine"));
        const opened: ConversationRecord[] = [];
        const backdrop = openModal({
          currentConversationId: "current",
          onOpen: (row) => opened.push(row),
        });
        await whenAiConversationHistoryModalSettled();

        const open = findByTestId(backdrop, "ai-history-open")!;
        expect(open.getAttribute("aria-disabled")).toBe("true");
        expect(open.textContent).toContain("현재");
        (open as unknown as HTMLElement).click();
        await whenAiConversationHistoryModalSettled();
        expect(opened).toHaveLength(0);
      });

      it.each([new Error("ARCHIVE_READ_FAILURE"), null])("keeps a failed archive open recoverable after listing: %s", async (failure) => {
        const target = record("read-failure", 1_000, "mine", "READ_FAILURE_TARGET");
        await saveConversation(target);
        const onOpen = vi.fn();
        const backdrop = openModal({ currentConversationId: "active-conversation", onOpen });
        await whenAiConversationHistoryModalSettled();
        const open = findByTestId(backdrop, "ai-history-open")!;
        expect(open).not.toBeNull();
        // Listing succeeds; only the subsequent full-record read fails once.
        vi.spyOn(conversations, "loadConversationForScope").mockRejectedValueOnce(failure);

        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).not.toBeNull();
        const status = findByTestId(backdrop, "ai-history-recover-status")!;
        expect(status.dataset.state).toBe("error");
        expect(status.hidden).toBe(false);
        expect(status.textContent?.trim().length).toBeGreaterThan(0);
        if (failure instanceof Error) expect(status.textContent).toContain(failure.message);
        expect(findByTestId(backdrop, "ai-history-open")).toBe(open);
        expect(findByTestId(backdrop, "ai-history-recover")!.disabled).toBe(false);

        // The same control retries the real store read without dismissing the error first.
        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: target.id, entries: target.entries }));
        expect(backdrop.parentElement).toBeNull();
      });

      it("reports a record removed after listing without adopting or silently losing it", async () => {
        await saveConversation(record("removed-after-list", 1_000, "mine"));
        const onOpen = vi.fn();
        const backdrop = openModal({ currentConversationId: "active-conversation", onOpen });
        await whenAiConversationHistoryModalSettled();
        await conversations.deleteConversationForScope("removed-after-list", "mine");

        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).not.toBeNull();
        const status = findByTestId(backdrop, "ai-history-recover-status")!;
        expect(status.dataset.state).toBe("error");
        expect(status.hidden).toBe(false);
        expect(status.textContent?.trim().length).toBeGreaterThan(0);
        expect(findByTestId(backdrop, "ai-history-open")).toBeNull();
        expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-recover")!.disabled).toBe(false);
      });

      it.each(["close", "replace"] as const)("suppresses a late archive read failure after modal %s", async (boundary) => {
        await saveConversation(record("late-failure", 1_000, "mine"));
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        let rejectLoad!: (reason: Error) => void;
        const load = new Promise<ConversationRecord | null>((_resolve, reject) => { rejectLoad = reject; });
        const read = vi.spyOn(conversations, "loadConversationForScope").mockReturnValueOnce(load);
        click(backdrop, "ai-history-open");
        expect(read).toHaveBeenCalledWith("late-failure", "mine");
        const replacement = boundary === "replace" ? openModal({ scopeKey: "other", onOpen }) : null;
        if (boundary === "close") closeAiConversationHistoryModal();
        rejectLoad(new Error("STALE_ARCHIVE_READ_FAILURE"));
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).toBeNull();
        for (const root of replacement ? [backdrop, replacement] : [backdrop]) {
          const status = findByTestId(root, "ai-history-recover-status")!;
          expect(status.dataset.state).toBe("idle");
          expect(status.hidden).toBe(true);
          expect(status.textContent).not.toContain("STALE_ARCHIVE_READ_FAILURE");
        }
        if (replacement) expect(replacement.parentElement).not.toBeNull();
      });

      it("Given 다른 프로젝트의 대화 When 모든 필터 Then 나열되지 않는다", async () => {
        await saveConversation(record("foreign", 1_000, "other"));
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-all");
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(0);
        expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
      });

      it("Given 삭제 클릭 When 목록 갱신 Then 저장소에서도 지워진다", async () => {
        await saveConversation(record("doomed", 1_000, "mine"));
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();

        click(backdrop, "ai-history-delete");
        await whenAiConversationHistoryModalSettled();

        expect(await listConversations()).toHaveLength(0);
        expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
      });

      it("Given 검색어 입력 When 목록 갱신 Then 제목이 맞는 행만 남는다", async () => {
        await saveConversation(record("a", 1_000, "mine", "우물 배치"));
        await saveConversation(record("b", 2_000, "mine", "상점 배치"));
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        const search = findByTestId(backdrop, "ai-history-search") as unknown as HTMLInputElement & FakeElement;

        search.value = "우물";
        search.dispatchEvent(new Event("input"));
        await whenAiConversationHistoryModalSettled();

        const rows = findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]");
        expect(rows).toHaveLength(1);
        expect(rows[0]!.textContent).toContain("우물");
      });

      it("Given A 기원과 B 대상 대화 When 현재 맵 A Then 둘 다 전체 대화로 보이고 B 전용은 숨는다", async () => {
        await saveConversation(record("origin-a", 1_000, "mine", "광장 우물", "map_a"));
        await saveConversation({
          ...record("target-a", 2_000, "mine", "숲에서 광장을 칠함", "map_b"),
          entries: [
            { kind: "user", text: "숲에서 광장을 칠함", context: mapContext("map_b", "숲길") },
            { kind: "tool", name: "paint_tiles", args: { mapId: "map_a" }, ok: true, summary: "painted A" },
          ],
        });
        await saveConversation(record("only-b", 3_000, "mine", "숲길만", "map_b"));

        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        const rows = findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]");
        const text = [...rows].map((row) => row.textContent ?? "").join("\n");
        expect(text).toContain("광장 우물");
        expect(text).toContain("숲에서 광장을 칠함");
        expect(text).not.toContain("숲길만");
      });

      it("Given 맵 필드 없는 대화 When 출처 없음 Then 그것만 보이고 삭제된 맵 id 는 선택 가능하다", async () => {
        await saveConversation(record("unknown", 1_000, "mine", "옛 기록", null));
        await saveConversation(record("gone", 2_000, "mine", "허물어진 다리", "map_gone"));

        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-unknown");
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("옛 기록");
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain("허물어진 다리");

        click(backdrop, "ai-history-filter-all");
        await whenAiConversationHistoryModalSettled();
        const gone = backdrop.querySelector('[data-map-id="map_gone"]');
        expect(gone).not.toBeNull();
        (gone as unknown as HTMLElement).click();
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("허물어진 다리");
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain("옛 기록");
      });

      it("selects an older deleted map from the complete 201-record archive before paging", async () => {
        const target = record("old-deleted-map", 1, "mine", "OLDER_DELETED_MAP", "map_gone");
        expect((await saveConversation(target)).ok).toBe(true);
        for (let index = 0; index < 200; index += 1) {
          expect((await saveConversation(record(`new-a-${index}`, 1_000 + index, "mine"))).ok).toBe(true);
        }
        expect((await conversations.queryConversationArchive({ projectContextKey: "mine" })).total).toBe(201);
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-filter-current")!.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(
          AI_HISTORY_ARCHIVE_PAGE_SIZE,
        );
        const gone = backdrop.querySelector('[data-map-id="map_gone"]');
        expect(gone).not.toBeNull();
        (gone as unknown as HTMLElement).click();
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(1);
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("OLDER_DELETED_MAP");
        expect(onOpen).not.toHaveBeenCalled();
        click(backdrop, "ai-history-open");
        await whenAiConversationHistoryModalSettled();
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: target.id, entries: target.entries }));
      });

      it("Given 페이지 크기보다 많은 기록 When 더 보기 Then 다음 페이지가 붙는다", async () => {
        for (let index = 0; index < AI_HISTORY_ARCHIVE_PAGE_SIZE + 1; index += 1) {
          await saveConversation(record(`page-${index}`, 1_000 + index, "mine", `페이지 ${index}`));
        }
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(
          AI_HISTORY_ARCHIVE_PAGE_SIZE,
        );
        click(backdrop, "ai-history-load-more");
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(
          AI_HISTORY_ARCHIVE_PAGE_SIZE + 1,
        );
      });

      it("Given 압축·일부 출처 When 렌더 Then 표시가 붙는다", async () => {
        await saveConversation({
          ...record("partial", 1_000, "mine", "일부 출처"),
          entries: [
            { kind: "user", text: "일부 출처", context: mapContext("map_a", "광장") },
            { kind: "status", text: CONVERSATION_TRIM_MARKER },
            { kind: "assistant", text: "잘린 인자", toolCalls: [{ name: "paint_tiles", args: "{not-json" }] },
          ],
        });
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-compacted")).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-attribution")?.dataset.attribution).toBe("partial");
      });

      it("Given 복구 실패 When 가져오기 Then error 상태이고 목록을 성공으로 바꾸지 않는다", async () => {
        const hydrate = vi.spyOn(conversations, "hydrateConversationArchive").mockRejectedValue(new Error("transport down"));
        const backdrop = openModal();
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-recover");
        await whenAiConversationHistoryModalSettled();
        const status = findByTestId(backdrop, "ai-history-recover-status")!;
        expect(status.dataset.state).toBe("error");
        expect(status.textContent).toContain("transport down");
        expect(hydrate).toHaveBeenCalledWith(expect.objectContaining({ projectContextKey: "mine" }));
      });

      it("Given 닫힌 모달 When 늦은 열기 응답 Then onOpen 을 부르지 않는다", async () => {
        await saveConversation(record("late", 1_000, "mine", "늦은 열기"));
        let resolveLoad: ((value: ConversationRecord | null) => void) | undefined;
        vi.spyOn(conversations, "loadConversationForScope").mockImplementation(
          () => new Promise((resolve) => {
            resolveLoad = resolve;
          }),
        );
        const opened: ConversationRecord[] = [];
        const backdrop = openModal({ onOpen: (row) => opened.push(row) });
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-open");
        closeAiConversationHistoryModal();
        resolveLoad?.(record("late", 1_000, "mine", "늦은 열기"));
        await whenAiConversationHistoryModalSettled();
        expect(opened).toHaveLength(0);
      });

      it("Given 필터 전환 When 목록만 바뀜 Then onOpen 은 호출되지 않는다", async () => {
        await saveConversation(record("keep", 1_000, "mine"));
        const opened: ConversationRecord[] = [];
        const backdrop = openModal({ onOpen: (row) => opened.push(row) });
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-all");
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-unknown");
        await whenAiConversationHistoryModalSettled();
        expect(opened).toHaveLength(0);
        expect(findByTestId(backdrop, "ai-history-modal")).not.toBeNull();
      });

      it("Given an unscoped retained record When the legacy view is opened Then the transcript is readable without adopting it", async () => {
        // Break: every modal filter queries the captured project scope, so projectContextKey-less
        // records stay in the archive but cannot be selected or read.
        const legacyUser = "LEGACY_UNSCOPED_USER";
        const legacyAssist = "LEGACY_UNSCOPED_ASSIST";
        await saveConversation({
          id: "legacy-unscoped",
          title: legacyUser,
          model: "m",
          savedAt: 500,
          entries: [
            { kind: "user", text: legacyUser, context: { mapId: "map_a", mapName: "옛 광장", mapWidth: 20, mapHeight: 15 } },
            { kind: "assistant", text: legacyAssist },
          ],
        });
        await saveConversation(record("mine-now", 2_000, "mine", "CURRENT_PROJECT_TURN"));
        const onOpen = vi.fn();
        const hydrate = vi.spyOn(conversations, "hydrateConversationArchive");
        const backdrop = openModal({ currentConversationId: "active-now", onOpen });
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain(legacyUser);
        click(backdrop, "ai-history-filter-all");
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain(legacyUser);

        click(backdrop, "ai-history-filter-legacy");
        await whenAiConversationHistoryModalSettled();

        expect(findByTestId(backdrop, "ai-history-filter-legacy")!.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(backdrop, "ai-history-filter-all")!.getAttribute("aria-pressed")).toBe("false");
        const list = findByTestId(backdrop, "ai-history-list")!;
        expect(list.textContent).toContain(legacyUser);
        expect(list.textContent).not.toContain("CURRENT_PROJECT_TURN");
        expect(list.textContent).toContain("map_a");
        expect(list.textContent).not.toContain("광장");
        expect(findByTestId(backdrop, "ai-history-open")).toBeNull();
        expect(findByTestId(backdrop, "ai-history-delete")).toBeNull();
        expect(findByTestId(backdrop, "ai-history-recover")!.hidden).toBe(true);
        expect(hydrate).not.toHaveBeenCalled();

        click(backdrop, "ai-history-legacy-inspect");
        await whenAiConversationHistoryModalSettled();
        const body = findByTestId(backdrop, "ai-history-legacy-body")!;
        expect(body.textContent).toContain(legacyUser);
        expect(body.textContent).toContain(legacyAssist);
        expect(onOpen).not.toHaveBeenCalled();
        expect((await conversations.loadConversation("legacy-unscoped"))?.projectContextKey).toBeUndefined();
        expect(backdrop.parentElement).not.toBeNull();
      });

      it.each(["open", "delete"] as const)("blocks stale scoped %s during a deferred legacy transition", async (action) => {
        const target = record("transition-target", 1_000, "mine");
        await saveConversation(target);
        await saveConversation(record("transition-legacy", 500));
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        const staleAction = findByTestId(backdrop, `ai-history-${action}`)!;
        expect(staleAction).not.toBeNull();
        const legacyResult = await conversations.queryConversationArchive({ projectContextKey: null });
        const query = deferred<typeof legacyResult>();
        const queried = vi.spyOn(conversations, "queryConversationArchive").mockReturnValueOnce(query.promise);
        const read = vi.spyOn(conversations, "loadConversationForScope");
        const remove = vi.spyOn(conversations, "deleteConversationForScope");

        click(backdrop, "ai-history-filter-legacy");
        const pendingActions = backdrop.querySelectorAll("[data-testid=ai-history-open], [data-testid=ai-history-delete]");
        // Retained controls must also reject invocation, even after they leave the DOM.
        (staleAction as unknown as HTMLElement).click();
        query.resolve(legacyResult);
        await whenAiConversationHistoryModalSettled();

        expect.soft(pendingActions).toHaveLength(0);
        expect.soft(read).not.toHaveBeenCalled();
        expect.soft(remove).not.toHaveBeenCalled();
        expect.soft(onOpen).not.toHaveBeenCalled();
        expect.soft(await conversations.loadConversation(target.id)).toMatchObject(target);
        expect(backdrop.parentElement).not.toBeNull();
        expect(queried).toHaveBeenCalledWith(expect.objectContaining({ projectContextKey: null }));
        expect(findByTestId(backdrop, "ai-history-filter-legacy")!.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(backdrop, "ai-history-legacy-inspect")).not.toBeNull();
      });

      it.each([false, true])("invalidates pending scoped Open on legacy transition (return to scoped: %s)", async (returnToScoped) => {
        const target = record("transition-pending-open", 1_000, "mine");
        await saveConversation(target);
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        const load = deferred<ConversationRecord | null>();
        const read = vi.spyOn(conversations, "loadConversationForScope").mockReturnValueOnce(load.promise);
        const legacyResult = await conversations.queryConversationArchive({ projectContextKey: null });
        const query = deferred<typeof legacyResult>();
        const queried = vi.spyOn(conversations, "queryConversationArchive").mockReturnValueOnce(query.promise);

        click(backdrop, "ai-history-open");
        click(backdrop, "ai-history-filter-legacy");
        if (returnToScoped) click(backdrop, "ai-history-filter-all");
        query.resolve(legacyResult);
        load.resolve(target);
        await whenAiConversationHistoryModalSettled();

        expect(read).toHaveBeenCalledWith(target.id, "mine");
        expect(queried).toHaveBeenCalledWith(expect.objectContaining({ projectContextKey: null }));
        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-recover-status")!.dataset.state).toBe("idle");
        if (returnToScoped) {
          // A fresh scoped invocation still works after the abandoned read completes.
          click(backdrop, "ai-history-open");
          await whenAiConversationHistoryModalSettled();
          expect(onOpen).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: target.id }));
          expect(backdrop.parentElement).toBeNull();
        }
      });

      it("keeps a failed legacy inspect recoverable without adopting", async () => {
        await saveConversation({
          id: "legacy-retry",
          title: "LEGACY_RETRY_USER",
          model: "m",
          savedAt: 500,
          entries: [
            { kind: "user", text: "LEGACY_RETRY_USER" },
            { kind: "assistant", text: "LEGACY_RETRY_ASSIST" },
          ],
        });
        const onOpen = vi.fn();
        const backdrop = openModal({ currentConversationId: "active-now", onOpen });
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-legacy");
        await whenAiConversationHistoryModalSettled();
        vi.spyOn(conversations, "loadConversationForScope").mockRejectedValueOnce(new Error("LEGACY_READ_FAILURE"));

        click(backdrop, "ai-history-legacy-inspect");
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(backdrop.parentElement).not.toBeNull();
        expect(findByTestId(backdrop, "ai-history-legacy-body")).toBeNull();
        const status = findByTestId(backdrop, "ai-history-recover-status")!;
        expect(status.dataset.state).toBe("error");
        expect(status.textContent).toContain("LEGACY_READ_FAILURE");
        expect(findByTestId(backdrop, "ai-history-recover")!.hidden).toBe(true);

        click(backdrop, "ai-history-legacy-inspect");
        await whenAiConversationHistoryModalSettled();
        expect(findByTestId(backdrop, "ai-history-legacy-body")!.textContent).toContain("LEGACY_RETRY_ASSIST");
        expect(onOpen).not.toHaveBeenCalled();
        expect((await conversations.loadConversation("legacy-retry"))?.projectContextKey).toBeUndefined();
      });

      it("does not paint a late legacy inspect onto the current-project list", async () => {
        await saveConversation({
          id: "legacy-stale",
          title: "LEGACY_STALE_USER",
          model: "m",
          savedAt: 500,
          entries: [{ kind: "user", text: "LEGACY_STALE_USER" }, { kind: "assistant", text: "LEGACY_STALE_ASSIST" }],
        });
        await saveConversation(record("mine-now", 2_000, "mine", "CURRENT_PROJECT_TURN"));
        const onOpen = vi.fn();
        const backdrop = openModal({ onOpen });
        await whenAiConversationHistoryModalSettled();
        click(backdrop, "ai-history-filter-legacy");
        await whenAiConversationHistoryModalSettled();
        let resolveLoad: ((value: ConversationRecord | null) => void) | undefined;
        vi.spyOn(conversations, "loadConversationForScope").mockImplementationOnce(
          () => new Promise((resolve) => { resolveLoad = resolve; }),
        );
        click(backdrop, "ai-history-legacy-inspect");
        click(backdrop, "ai-history-filter-all");
        resolveLoad?.({
          id: "legacy-stale",
          title: "LEGACY_STALE_USER",
          model: "m",
          savedAt: 500,
          entries: [{ kind: "user", text: "LEGACY_STALE_USER" }, { kind: "assistant", text: "LEGACY_STALE_ASSIST" }],
        });
        await whenAiConversationHistoryModalSettled();

        expect(onOpen).not.toHaveBeenCalled();
        expect(findByTestId(backdrop, "ai-history-legacy-body")).toBeNull();
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("CURRENT_PROJECT_TURN");
        expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain("LEGACY_STALE_USER");
      });
    });
  });
  describe("aiConversationLog", () => {
    isolateTimers();
    function makeLog(): {
      readonly log: HTMLElement;
      readonly host: ReturnType<typeof createConversationLogHost>;
    } {
      const log = document.createElement("div");
      const host = createConversationLogHost({
        log,
        removeStartScreen: () => undefined,
      });
      return { log, host };
    }
    describe("conversation log command rows", () => {
      let restoreDom: (() => void) | null = null;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      it("records a user+assistant turn as two command rows and zero chat bubbles", () => {
        // Break: appendConversationBubble still assigns ai-chat-bubble / ai-chat-user.
        const { log, host } = makeLog();

        host.renderConversationEntry({ kind: "user", text: "호수 만들어줘" });
        host.renderConversationEntry({ kind: "assistant", text: "초안입니다." });

        expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(2);
        expect(log.querySelectorAll(".ai-chat-user")).toHaveLength(0);
        expect(log.querySelectorAll(".ai-chat-assistant")).toHaveLength(0);
        expect(findByTestId(log as unknown as FakeElement, "ai-command-row-user")?.textContent).toContain("호수 만들어줘");
        expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toContain("초안입니다.");
      });

      it("prefixes each human-log row with @>", () => {
        // Break: the row is emitted without an @> prefix node.
        const { log, host } = makeLog();

        host.appendBubble("user", "길 깔아줘");
        host.appendBubble("system", "오류: 키 없음");

        const prefixes = log.querySelectorAll(".ai-command-prefix");
        expect(prefixes).toHaveLength(2);
        expect(prefixes[0]?.textContent).toBe("@>");
        expect(prefixes[1]?.textContent).toBe("@>");
      });

      it("streams tokens into the last command row in place", () => {
        // Break: each stream token creates another ai-command-row instead of mutating the last body.
        const { log, host } = makeLog();

        const streamed = host.appendBubble("assistant", "");
        streamed.textContent = `${streamed.textContent ?? ""}헬`;
        streamed.textContent = `${streamed.textContent ?? ""}로`;

        expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(1);
        expect(streamed.textContent).toBe("헬로");
        expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toBe("헬로");
      });

      it("keeps markdown rendering inside the command row", () => {
        // Break: assistant markdown is rendered as a sibling bubble, not inside the row.
        const { log, host } = makeLog();

        host.appendBubble("assistant", "**초안**입니다");

        const row = log.querySelector("[data-testid=ai-command-row]");
        expect(row?.querySelector(".md")).toBeTruthy();
        expect(row?.querySelector("strong")?.textContent).toBe("초안");
      });

      it("tool lines leave the log entirely — they are handed to the work sink (방향 G)", () => {
        // Break: appendToolLine attaches ai-tool-activity to the command row again.
        const log = document.createElement("div");
        const received: HTMLElement[] = [];
        const host = createConversationLogHost({
          log,
          removeStartScreen: () => undefined,
          workSink: {
            appendToolEntry: (entry) => void received.push(entry),
            noteReadOnlyTool: () => undefined,
            appendCard: () => undefined,
          },
        });

        host.appendBubble("user", "길 깔아줘");
        const entry = host.appendToolLine("paint_road", { ok: true, summary: "길을 그렸습니다" }, undefined, { live: true });

        expect(entry).not.toBeNull();
        expect(received).toEqual([entry]);
        expect(findByTestId(log as unknown as FakeElement, "ai-tool-activity")).toBeNull();
        expect(findByTestId(log as unknown as FakeElement, "ai-tool-entry")).toBeNull();
        expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(1);
      });

      it("attaches a tile grid to the last command row instead of a bubble", () => {
        // Break: appendTileGrid still wraps the grid in ai-chat-bubble.
        const { log, host } = makeLog();

        host.appendBubble("assistant", "격자");
        host.appendTileGrid({
          // New projects no longer carry the EasyRPG combined_town sheet (2026-10-07 purge); use the default tileset.
          tilesetId: DEFAULT_TILESET_ID,
          x: 0,
          y: 0,
          w: 1,
          h: 1,
          lower: [[0]],
          upper: [[-1]],
        });

        const grid = findByTestId(log as unknown as FakeElement, "ai-bubble-tile-grid");
        const row = log.querySelector("[data-testid=ai-command-row]");
        expect(grid).toBeTruthy();
        expect(grid?.className).not.toContain("ai-chat-bubble");
        expect(row?.contains(grid as unknown as Node)).toBe(true);
      });
    });
    describe("작업 행 — 한국어 라벨 · 조회는 개수만 · 복원 경로 표시 (데크 2026-09-03 → 띠 2026-09-17)", () => {
      let restoreDom: (() => void) | null = null;
      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      function makeHost(renderChip?: Parameters<typeof createConversationLogHost>[0]["renderChip"]) {
        const log = document.createElement("div");
        const entries: Array<{ entry: HTMLElement; live: boolean; name: string }> = [];
        const reads: Array<{ name: string; live: boolean }> = [];
        const host = createConversationLogHost({
          log,
          removeStartScreen: () => undefined,
          workSink: {
            appendToolEntry: (entry, meta) => void entries.push({ entry, live: meta.live, name: meta.name }),
            noteReadOnlyTool: (name, live) => void reads.push({ name, live }),
            appendCard: () => undefined,
          },
          ...(renderChip ? { renderChip } : {}),
        });
        return { log, host, entries, reads };
      }

      it("라이브 행은 한국어 라벨 + 요약 + 상태이고, 함수 이름은 title 로 내려간다", () => {
        // Break: 행이 `✓ place_npc …` 한 줄 텍스트로 돌아가거나 라벨이 함수 이름 그대로다.
        const { host, entries } = makeHost();
        host.appendBubble("user", "상인 세워줘");
        host.appendToolLine("place_npc", { ok: true, summary: "상인 「두리」 (27,15)" }, { x: 27, y: 15 }, { live: true });
        const entry = entries[0]?.entry as unknown as FakeElement | undefined;
        expect(entry?.dataset.testid).toBe("ai-tool-entry");
        expect(entry?.querySelector(".ai-act-label")?.textContent).toBe("NPC 배치");
        expect(entry?.querySelector(".ai-act-sum")?.textContent).toBe("상인 「두리」 (27,15)");
        expect(entry?.querySelector(".ai-act-status")).not.toBeNull();
        expect(entry?.getAttribute("title")).toContain("place_npc");
        expect(entry?.textContent).not.toContain("place_npc");
      });

      it("조회 툴(get_*)은 행 없이 개수만 알리고, 쓰기 툴만 행이 된다", () => {
        // Break: 조회가 단계 행으로 남아 카드가 「작업 3단계」 로 부푼다.
        const { host, entries, reads } = makeHost();
        host.appendBubble("user", "우물 놓고 상인 세워줘");
        expect(host.appendToolLine("get_map_region", { ok: true, summary: "60×45" }, { x: 0, y: 0, w: 60, h: 45 }, { live: true })).toBeNull();
        host.appendToolLine("stamp_structure", { ok: true, summary: "우물 1" }, { x: 24, y: 11 }, { live: true });
        host.appendToolLine("place_npc", { ok: true, summary: "상인 2" }, { x: 22, y: 14 }, { live: true });
        expect(reads).toEqual([{ name: "get_map_region", live: true }]);
        expect(entries.map((item) => item.name)).toEqual(["stamp_structure", "place_npc"]);
        expect(entries.every((item) => item.live)).toBe(true);
      });

      it("복원 경로(live 아님)는 live=false 로 표시돼 띠가 걸러낼 수 있다", () => {
        // Break: 복원된 대화의 툴콜이 이번 세션의 작업 카드로 쌓인다.
        const { host, entries, reads } = makeHost();
        host.appendBubble("user", "맵 좀 봐줘");
        host.appendToolLine("get_map_region", { ok: true, summary: "60×45" });
        host.appendToolLine("show_map_region", { ok: true, summary: "보임" });
        host.appendToolLine("paint_road", { ok: true, summary: "길 3칸" });
        expect(reads.map((item) => item.live)).toEqual([false, false]);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.live).toBe(false);
      });

      it("renderChip 이 주어지면 행 앞에 맵 칩을 꽂고, null 이면 아이콘 칩", () => {
        // Break: 칩 훅이 무시되어 모든 행이 아이콘으로만 남는다.
        const chip = document.createElement("span");
        chip.className = "ai-act-chip";
        chip.dataset.testid = "fake-chip";
        const { host, entries } = makeHost((name) => (name === "place_npc" ? chip : null));
        host.appendBubble("user", "상인");
        host.appendToolLine("place_npc", { ok: true, summary: "상인 1" }, { x: 1, y: 1 }, { live: true });
        host.appendToolLine("configure_game_systems", { ok: true, summary: "설정" }, {}, { live: true });
        expect(findByTestId(entries[0]!.entry as unknown as FakeElement, "fake-chip")).toBe(chip);
        expect(entries[1]?.entry.querySelector(".ai-act-chip")?.className).toContain("is-icon");
      });
    });
  });
  // test/aiConversationReplay.test.ts
  // "이전 대화 이어가기" 가 모델 쪽에서도 참이 되게 하는 직렬화의 계약.
  //
  // 잠그는 것 셋:
  //  1. status 항목은 버린다(턴 수명주기 진단은 다음 턴 모델에게 소음이다).
  //  2. 상한을 넘으면 **꼬리**를 남긴다 — 앞을 남기면 "방금 무엇을 하던 중" 이 사라진다.
  //  3. 주입 메시지는 role "user" + 마커로 시작한다(압축 요약과 같은 안전 지대. tool_calls 짝을
  //     재구성하면 Gemini/Cloud Code Assist 에서 400 이다).
  describe("aiConversationReplay", () => {
    isolateTimers();
    const ENTRIES: readonly AuditEntry[] = [
      { kind: "user", text: "마을 입구에 우물을 놔줘" },
      { kind: "status", text: "tools:exposed=40" },
      { kind: "tool", name: "place_structure", args: { id: "well" }, ok: true, summary: "우물 1개 배치" },
      { kind: "assistant", text: "우물을 놨습니다." },
      { kind: "tool", name: "edit_tile", args: {}, ok: false, summary: "범위를 벗어났습니다" },
    ];
    describe("serializeAuditTranscript", () => {
      it("Given 사용자·조수·툴·상태가 섞인 기록 When 직렬화 Then 상태만 빠지고 나머지는 순서대로 남는다", () => {
        const lines = serializeAuditTranscript(ENTRIES).split("\n");

        expect(lines).toEqual([
          "[사용자] 마을 입구에 우물을 놔줘",
          "[툴 성공] place_structure: 우물 1개 배치",
          "[조수] 우물을 놨습니다.",
          "[툴 실패] edit_tile: 범위를 벗어났습니다",
        ]);
        expect(serializeAuditTranscript(ENTRIES)).not.toContain("tools:exposed");
      });

      it("Given 빈 기록 When 직렬화 Then 빈 문자열이다(주입할 것이 없다는 신호)", () => {
        expect(serializeAuditTranscript([])).toBe("");
        expect(serializeAuditTranscript([{ kind: "status", text: "x" }])).toBe("");
      });

      it("Given 공백만 있는 발화 When 직렬화 Then 줄을 만들지 않는다", () => {
        expect(serializeAuditTranscript([{ kind: "user", text: "   " }, { kind: "assistant", text: "\n" }])).toBe("");
      });

      it("Given 상한을 넘는 기록 When 직렬화 Then 최근 줄이 남고 생략 머리글이 붙는다", () => {
        const many: AuditEntry[] = Array.from({ length: 40 }, (_unused, index) => ({
          kind: "user" as const,
          text: `${index}번째 지시 ${"가".repeat(20)}`,
        }));

        const output = serializeAuditTranscript(many, 300);

        expect(output.startsWith("[앞부분 ")).toBe(true);
        expect(output).toContain("39번째 지시");
        expect(output).not.toContain("0번째 지시");
        expect(output.length).toBeLessThanOrEqual(300 + "[앞부분 00줄 생략 — 오래된 기록]\n".length);
      });

      it("Given 아주 긴 툴 요약 When 직렬화 Then 요약 1건이 200자에서 잘린다", () => {
        const output = serializeAuditTranscript([
          { kind: "tool", name: "t", args: {}, ok: true, summary: "가".repeat(500) },
        ]);

        expect(output).toContain("…");
        expect(output.length).toBeLessThan(300);
      });
    });
    describe("restoredTranscriptMessage", () => {
      it("Given 직렬화된 기록 When 메시지 생성 Then user 역할 + 마커 + 재실행 금지 문구를 담는다", () => {
        const message = restoredTranscriptMessage("[사용자] 우물");

        expect(message.role).toBe("user");
        expect(String(message.content).startsWith(RESTORED_TRANSCRIPT_MARKER)).toBe(true);
        expect(String(message.content)).toContain("다시 실행하지 마라");
        expect(String(message.content)).toContain("[사용자] 우물");
        expect(isRestoredTranscriptMessage(message)).toBe(true);
      });

      it("Given 평범한 사용자 메시지 When 판정 Then 복원 메시지가 아니다", () => {
        expect(isRestoredTranscriptMessage({ role: "user", content: "우물 놔줘" })).toBe(false);
        expect(isRestoredTranscriptMessage({ role: "system", content: RESTORED_TRANSCRIPT_MARKER })).toBe(false);
      });
    });
  });
});

describe("aiCreationCards", () => {
  isolateTimers();
  function run(project: Project, tool: string, args: Record<string, unknown>): Project {
    const ctx = { project };
    const result = runTool(ctx, tool, args);
    if (!result.ok) throw new Error(`${tool}: ${result.summary}`);
    return ctx.project;
  }
  describe("creation card models", () => {
    it("reads an equipment item's key stats and type from the record the tool wrote", () => {
      const before = createBlankProject();
      const after = run(before, "upsert_item", { item: { id: "item_flame_sword", name: "불꽃검", type: "weapon", price: 300, equipmentProfile: { statBonuses: { attack: 12, defense: 0, mind: 3, agility: 0 } } } });
      const item = listChangeItems(before, after).find((entry) => entry.id === "item_flame_sword")!;
      const model = creationCardModel(after, item)!;
      expect(model.title).toBe("불꽃검");
      expect(model.kindLine).toBe("장비 · 무기");
      expect(model.stats).toBe("공격 +12 · 마력 +3 · 300G");
    });

    it("gives a monster its HP/attack line", () => {
      const before = createBlankProject();
      const after = run(before, "upsert_enemy", { enemy: { id: "enemy_boss", name: "어둠 군주", monsterResourceId: "generated-enemy-slime-01", stats: { maxHp: 900, maxMp: 50, attack: 40, defense: 22, mind: 30, agility: 18 } } });
      const item = listChangeItems(before, after).find((entry) => entry.kind === "enemy" && entry.id === "enemy_boss")!;
      expect(creationCardModel(after, item)!.stats).toMatch(/^HP 900 · 공격 40 · 방어 22/u);
    });

    it("marks an item whose icon is a type stand-in, and clears the mark once a fitting icon is set", () => {
      const before = createBlankProject();
      const after = run(before, "upsert_item", { item: { id: "item_lunchbox", name: "나그네 도시락", type: "medicine" } });
      const item = listChangeItems(before, after).find((entry) => entry.id === "item_lunchbox")!;
      expect(creationCardModel(after, item)!.placeholderArt).toBe(true);
      const fixed = run(after, "upsert_item", { item: { id: "item_lunchbox", iconResourceId: "cc0-jetrel-bread" } });
      expect(creationCardModel(fixed, item)!.placeholderArt).toBeUndefined();
      const tea = run(before, "upsert_item", { item: { id: "item_tea", name: "달빛 차", type: "medicine" } });
      expect(creationCardModel(tea, listChangeItems(before, tea).find((entry) => entry.id === "item_tea")!)!.placeholderArt).toBeUndefined();
    });
  });
  describe("battle music change", () => {
    it("lists the project battle track as a music item and reverts only it", () => {
      const before = createBlankProject();
      const after = { ...before, system: { ...before.system, battleBgmResourceId: "cc0-bgm-boss-test" } } as Project;
      const items = listChangeItems(before, after);
      const music = items.find((entry) => entry.kind === "music")!;
      expect(music).toMatchObject({ id: "battleBgmResourceId", change: "modified", label: "전투 음악" });
      const reverted = revertChangeItem(after, before, music);
      expect(reverted.system.battleBgmResourceId).toBe(before.system.battleBgmResourceId);
    });
  });
  describe("firstSpokenLine", () => {
    it("finds the first text line inside nested choices, with its speaker", () => {
      const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
        { kind: "choices", options: [{ text: "네", branch: [{ kind: "text", speaker: "상인", body: "\n어서 오세요!\n둘째 줄" }] }] },
      ] }] } as unknown as GameEvent;
      expect(firstSpokenLine(event)).toEqual({ speaker: "상인", text: "어서 오세요!" });
    });
  });
  describe("firstPlayedMusic", () => {
    it("finds the boss track an event plays as background music, ignoring sound effects", () => {
      const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
        { kind: "playAudio", resourceId: "cc0-se-roar", loop: false },
        { kind: "playAudio", resourceId: "cc0-bgm-boss", loop: true },
      ] }] } as unknown as GameEvent;
      expect(firstPlayedMusic(event)).toBe("cc0-bgm-boss");
    });

    it("finds the appearance an assistant-made character event wears, so the card can follow its generated chip", () => {
      const before = createBlankProject();
      const placed = run(before, "make_villager", { mapId: before.startMapId, id: "ev_smith", name: "무기점 주인 도르간", home: { x: 3, y: 3 }, dialogue: [{ text: "어서 오게." }] });
      const linked = run(placed, "generate_walk_chip", { name: "도르간", description: "dwarf weapon-shop owner with a sword", events: [{ mapId: before.startMapId, eventId: "ev_smith" }] });
      const item = listChangeItems(before, linked).find((entry) => entry.kind === "event" && entry.id === "ev_smith")!;
      const appearanceId = linked.database.characterAppearances!.find((app) => app.name === "도르간")!.id;
      expect(eventAppearanceId(linked, item)).toBe(appearanceId);
      expect(eventAppearanceId(placed, item)).toBeUndefined();
    });
  });
});

describe("aiDeckIcons", () => {
  isolateTimers();
  describe("aiDeckIcons — 데크 아이콘 빌더", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("아이콘은 currentColor stroke 의 svg 이고 이름을 data-icon 으로 든다", () => {
      // Break: 아이콘이 텍스트 글리프(☰·🕒)로 돌아가거나 stroke/fill 계약이 깨진다.
      const icon = deckIcon("plus");
      expect(icon.tagName.toLowerCase()).toBe("svg");
      expect(icon.getAttribute("data-icon")).toBe("plus");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("stroke")).toBe("currentColor");
      expect(icon.getAttribute("fill")).toBe("none");
      expect(icon.getAttribute("stroke-width")).toBe("1.75");
      expect(icon.getAttribute("width")).toBe("18");
      expect(icon.getAttribute("class")).toContain("ai-deck-icon");
    });

    it("크기 옵션은 width/height 를 함께 바꾼다", () => {
      // Break: size 가 width 에만 적용되거나 무시된다.
      const icon = deckIcon("clock", { size: 15 });
      expect(icon.getAttribute("width")).toBe("15");
      expect(icon.getAttribute("height")).toBe("15");
    });

    it("모든 이름에 그림(path/circle/rect) 이 하나 이상 있다", () => {
      // Break: 사전에 이름만 있고 경로가 비어 빈 사각형이 그려진다.
      for (const name of DECK_ICON_NAMES) {
        const icon = deckIcon(name);
        expect(icon.childNodes.length, name).toBeGreaterThan(0);
      }
    });
  });
});

describe("aiDeckRail", () => {
  isolateTimers();
  describe("aiDeckRail — 데크 상태 레일", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("이름은 「조수」 이고 헤더·얼굴 클래스는 되살리지 않는다", () => {
      // Break: 레일이 .ai-chat-header / .ai-director-* 이름을 다시 쓰면 aiPanelChrome 계약과 충돌한다.
      // 이름은 조수 하나다 — e9d308b43a 가 「AI」 에서 「조수」 로 바꿨다(머리·레일·접기 버튼이 같은 이름).
      const rail = createDeckRail();
      expect(rail.root.dataset.testid).toBe("ai-deck-rail");
      expect(rail.root.querySelector(".ai-deck-rail-name")?.textContent).toBe("조수");
      expect(rail.root.querySelector(".ai-chat-header")).toBeNull();
      expect(rail.root.querySelector(".ai-director-name")).toBeNull();
      expect(rail.root.querySelector(".ai-director-face")).toBeNull();
    });

    it("맵 맥락은 setContext 로 바뀌고 없으면 비운다", () => {
      // Break: 맵 이름이 갱신되지 않거나 null 에 「null」 글자가 남는다.
      const rail = createDeckRail();
      rail.setContext("시장 마을");
      expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("시장 마을");
      rail.setContext(null);
      expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("");
    });

    it("상태는 data-ai-state 하나로 점과 문장 톤이 함께 움직인다", () => {
      // Break: 점 클래스만 바뀌고 dataset 이 안 바뀌면 CSS 헤어라인·알약이 어긋난다.
      const rail = createDeckRail();
      expect(rail.root.dataset.aiState).toBe("idle");
      rail.setState("run");
      expect(rail.root.dataset.aiState).toBe("run");
      const dot = rail.root.querySelector(".ai-deck-rail-dot");
      expect(dot?.dataset.aiState).toBe("run");
      rail.setState("attention");
      expect(rail.root.dataset.aiState).toBe("attention");
      expect(dot?.dataset.aiState).toBe("attention");
    });

    it("액션 슬롯은 비어 있고 상태 슬롯은 기존 ai-status 를 받을 자리다", () => {
      // Break: 레일이 버튼을 스스로 만들면 컴포저와 두 벌이 된다 — 슬롯만 제공해야 한다.
      const rail = createDeckRail();
      expect(rail.actions.childNodes.length).toBe(0);
      const status = document.createElement("span");
      status.dataset.testid = "ai-status";
      rail.statusSlot.append(status);
      expect(rail.root.querySelector("[data-testid='ai-status']")).toBe(status);
    });

    it("상태 톤(idle/running/ok/error) → 데크 상태 사상 — 확인 필요는 톤이 아니라 패널이 직접 setState 한다", () => {
      // Break: 새 톤이 idle 로 조용히 떨어져 진행·확인 필요가 회색으로 보인다.
      expect(deckStateOfTone("idle")).toBe("idle");
      expect(deckStateOfTone("running")).toBe("run");
      expect(deckStateOfTone("ok")).toBe("done");
      expect(deckStateOfTone("error")).toBe("error");
    });
  });
});

describe("aiEntityMentions", () => {
  isolateTimers();
  describe("findEntityMentions", () => {
    it("finds an enemy and an item mentioned in one sentence, in text order", () => {
      const project = createBlankProject();
      project.database.enemies = [
        {
          id: "enemy_goblin",
          name: "고블린",
        } as EnemyRecord,
      ];
      project.database.items = [
        {
          id: "item_potion",
          name: "체력 물약",
        } as ItemRecord,
      ];

      const mentions = findEntityMentions(
        "상점에서 체력 물약을 사고 숲에서 고블린을 처치했다.",
        project
      );

      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({
        collection: "items",
        id: "item_potion",
        name: "체력 물약",
        record: project.database.items[0],
      });
      expect(mentions[1]).toEqual({
        collection: "enemies",
        id: "enemy_goblin",
        name: "고블린",
        record: project.database.enemies[0],
      });
    });

    it("returns [] for text mentioning nothing, and [] for empty text", () => {
      const project = createBlankProject();
      project.database.enemies = [
        {
          id: "enemy_slime",
          name: "슬라임",
        } as EnemyRecord,
      ];

      expect(findEntityMentions("아무것도 일치하지 않는 문장입니다.", project)).toEqual([]);
      expect(findEntityMentions("", project)).toEqual([]);
      expect(findEntityMentions("   ", project)).toEqual([]);
    });

    it("prefers the longer name: a project with enemies named '슬라임' and '슬라임 왕' and text '슬라임 왕이 나타났다' yields exactly one mention, '슬라임 왕'", () => {
      const project = createBlankProject();
      project.database.enemies = [
        {
          id: "enemy_slime",
          name: "슬라임",
        } as EnemyRecord,
        {
          id: "enemy_king_slime",
          name: "슬라임 왕",
        } as EnemyRecord,
      ];

      const mentions = findEntityMentions("슬라임 왕이 나타났다", project);
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.name).toBe("슬라임 왕");
      expect(mentions[0]?.id).toBe("enemy_king_slime");
    });

    it("honours the limit argument", () => {
      const project = createBlankProject();
      project.database.items = [
        { id: "item_1", name: "사과 물약" } as ItemRecord,
        { id: "item_2", name: "바나나 물약" } as ItemRecord,
        { id: "item_3", name: "포도 물약" } as ItemRecord,
      ];

      const text = "사과 물약, 바나나 물약, 포도 물약 중 하나를 고르세요.";
      const mentions = findEntityMentions(text, project, 2);
      expect(mentions).toHaveLength(2);
      expect(mentions.map((m) => m.name)).toEqual(["사과 물약", "바나나 물약"]);
    });
  });
  describe("renderEntityMentionStrip", () => {
    let restoreFakeDom: (() => void) | undefined;

    afterEach(() => {
      restoreFakeDom?.();
      restoreFakeDom = undefined;
    });

    it("returns null for [] and, for two mentions, produces a container with testid ai-mention-strip holding two chips whose names match", () => {
      restoreFakeDom = installFakeDom();
      const project = createBlankProject();

      expect(renderEntityMentionStrip([], project)).toBeNull();

      const mentions: EntityMention[] = [
        {
          collection: "enemies",
          id: "enemy_1",
          name: "불도깨비",
          record: { id: "enemy_1", name: "불도깨비" } as EnemyRecord,
        },
        {
          collection: "items",
          id: "item_1",
          name: "마나 포션",
          record: { id: "item_1", name: "마나 포션" } as ItemRecord,
        },
      ];

      const node = renderWithFakeDom(() =>
        renderEntityMentionStrip(mentions, project)!
      ) as FakeElement;

      expect(node).not.toBeNull();
      expect(node.dataset.testid).toBe("ai-mention-strip");
      expect(node.getAttribute("role")).toBe("list");
      expect(node.getAttribute("aria-label")).toBe("언급된 자료");

      const chip1 = findByTestId(node, "ai-mention-enemies-enemy_1");
      const chip2 = findByTestId(node, "ai-mention-items-item_1");

      expect(chip1).not.toBeNull();
      expect(chip2).not.toBeNull();

      expect(chip1?.getAttribute("role")).toBe("listitem");
      expect(chip1?.getAttribute("title")).toBe("불도깨비");
      expect(chip1?.querySelector(".ai-mention-name")?.textContent).toBe("불도깨비");

      expect(chip2?.getAttribute("role")).toBe("listitem");
      expect(chip2?.getAttribute("title")).toBe("마나 포션");
      expect(chip2?.querySelector(".ai-mention-name")?.textContent).toBe("마나 포션");
    });
  });
  // 라이브 턴에서 실측한 오탐(2026-08-26): 기본 프로젝트에는 "map", "ale", "egg", "bell",
  // "bone", "coal" 같은 짧은 순수 ASCII 아이템 이름이 수십 개 있다. 부분 문자열 포함만으로
  // 매칭하면 어시스턴트가 "현재 맵: 이슬 장터 마을 (mapvillage30_100x100)" 이라고 말하는
  // 순간 아이템 "map" 썸네일이 붙는다 — 실제로 브라우저에서 붙는 것을 확인했다.
  // 단어 경계가 없다는 근거는 **한글에만** 해당하므로, ASCII 이름은 경계를 요구한다.
  describe("짧은 ASCII 이름 오탐", () => {
    function projectWithNames(itemNames: string[], enemyNames: string[] = []) {
      const project = createBlankProject();
      project.database.items = itemNames.map((name, i) => ({ id: `item_ascii_${i}`, name }) as ItemRecord);
      project.database.enemies = enemyNames.map((name, i) => ({ id: `enemy_ascii_${i}`, name }) as EnemyRecord);
      return project;
    }

    it('맵 id 문자열 안의 "map" 은 아이템 map 으로 보지 않는다', () => {
      const project = projectWithNames(["map"]);

      expect(findEntityMentions("현재 맵: 이슬 장터 마을 (mapvillage30_100x100)", project)).toEqual([]);
    });

    it("다른 영어 단어에 숨은 짧은 이름도 잡지 않는다", () => {
      const project = projectWithNames(["ale", "egg", "bell", "bone"]);

      const found = findEntityMentions("The female scale bellows; bones remain. eggplant.", project);

      expect(found.map((m) => m.name)).toEqual([]);
    });

    it("독립된 단어로 나오면 ASCII 이름도 정상 매칭한다", () => {
      const project = projectWithNames(["map", "ale"]);

      const found = findEntityMentions("상자에 map 과 ale 을 넣었습니다.", project);

      expect(found.map((m) => m.name).sort()).toEqual(["ale", "map"]);
    });

    it("한글 이름은 그대로 부분 문자열로 매칭한다(경계가 없으므로)", () => {
      const project = projectWithNames([], ["슬라임"]);

      expect(findEntityMentions("슬라임을 광장에 두었습니다.", project).map((m) => m.name)).toEqual(["슬라임"]);
    });
  });
});

// 하네스 타임라인 병합 — 사람이 누른 것과 모델이 한 것이 한 줄기로 흘러야 한다.
//
// 왜 필요한가: 「압축을 누른 직후 턴이 깨졌다」, 「도크를 바꾸자 답장이 사라졌다」류는 두 스트림을
// 따로 보면 절대 안 보인다. 그리고 병합에는 조용한 함정이 하나 있다 — audit 항목 중 `at` 이 없는
// 것들(초기 상태줄)을 빈 문자열로 정렬하면 전부 맨 앞으로 몰려 «순서가 거짓» 이 된다.
describe("aiHarnessTimelineMerge", () => {
  isolateTimers();
  const audit: readonly AuditEntry[] = [
    { kind: "user", text: "석상 좀 고쳐줘", at: "2026-08-30T04:00:00.000Z" },
    { kind: "status", text: "phase:plan" }, // at 없음 — 직전 시각을 물려받아야 한다
    { kind: "tool", name: "set_event", args: {}, ok: true, summary: "이벤트 1건", at: "2026-08-30T04:00:10.000Z" },
  ];
  describe("mergeHarnessTimeline", () => {
    it("interleaves front actions with audit entries by time", () => {
      const merged = mergeHarnessTimeline(audit, [
        { at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" },
        { at: "2026-08-30T04:00:20.000Z", seq: 2, surface: "panel", action: "turn-rewind" },
      ]);
      expect(
        merged.map((row) => (row.kind === "ui" ? `ui:${row.event.action}` : `audit:${row.entry.kind}`)),
      ).toEqual([
        "audit:user",
        "audit:status", // at 없는 칸이 사용자 발언 뒤에 그대로 남는다
        "ui:context-compact",
        "audit:tool",
        "ui:turn-rewind",
      ]);
    });

    it("puts the audit entry first when the timestamps tie", () => {
      // 액션의 결과가 그 액션보다 앞서 보이면 인과가 뒤집힌다.
      const merged = mergeHarnessTimeline(
        [{ kind: "status", text: "압축 완료", at: "2026-08-30T04:00:05.000Z" }],
        [{ at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" }],
      );
      expect(merged.map((row) => row.kind)).toEqual(["audit", "ui"]);
    });

    it("returns audit alone when nothing was pressed", () => {
      expect(mergeHarnessTimeline(audit, [])).toHaveLength(audit.length);
      expect(mergeHarnessTimeline([], [])).toHaveLength(0);
    });
  });
});

// test/aiInstructionsModal.test.ts
// 감독 지침 편집 모달 — 저장이 **프로젝트에** 들어가고, 되돌리기 스냅샷을 남기고,
// 세션에 알려 주는지.
//
// 프로젝트에 저장하는 이유(localStorage 가 아닌): 지침은 그 게임의 성질이지 이 브라우저의
// 설정이 아니다. 프로젝트를 옮기면 규칙도 따라가야 한다.
describe("aiInstructionsModal", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  function open(saved: string[]): FakeElement {
    return openAiInstructionsModal({ onSaved: (value) => saved.push(value) }) as unknown as FakeElement;
  }
  function typeInto(backdrop: FakeElement, value: string): void {
    const input = findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement & FakeElement;
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }
  function save(backdrop: FakeElement): void {
    (findByTestId(backdrop, "ai-instructions-save") as unknown as HTMLElement).click();
  }
  beforeEach(() => {
    store.replace(createBlankProject());
    // 히스토리는 모듈 전역이다 — 리셋하지 않으면 앞 케이스가 남긴 동일 서명 스냅샷 때문에
    // pushSnapshot 의 중복 제거가 이번 케이스의 스냅샷을 삼킨다.
    resetMapEditHistory();
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    closeAiInstructionsModal();
    restoreDom?.();
    restoreDom = null;
    vi.restoreAllMocks();
  });
  describe("감독 지침 모달", () => {
    it("Given 지침 없는 프로젝트 When 열기 Then 빈 입력과 0자 카운터", () => {
      const backdrop = open([]);

      expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("");
      expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`0 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
    });

    it("Given 이미 저장된 지침 When 열기 Then 그 값이 실려 온다", () => {
      store.update((draft) => {
        draft.aiInstructions = "4방향 이동만 쓴다.";
      });

      const backdrop = open([]);

      expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("4방향 이동만 쓴다.");
    });

    it("Given 지침 입력 When 저장 Then 프로젝트에 남고 onSaved 로 알리고 모달이 닫힌다", () => {
      const saved: string[] = [];
      const backdrop = open(saved);

      typeInto(backdrop, "  타일셋 B 는 쓰지 마라.\r\n ");
      save(backdrop);

      expect(store.getCurrent().aiInstructions).toBe("타일셋 B 는 쓰지 마라.");
      expect(saved).toEqual(["타일셋 B 는 쓰지 마라."]);
      expect(backdrop.parentElement).toBeNull();
    });

    it("Given 지침 편집 When 저장 Then 되돌리기 스냅샷이 남는다(다른 프로젝트 편집과 동일)", () => {
      const before = getMapEditHistoryMarker();
      const backdrop = open([]);

      typeInto(backdrop, "전투는 턴제다.");
      save(backdrop);

      expect(getMapEditHistoryMarker()).toBeGreaterThan(before);
      expect(getMapEditHistoryState().canUndo).toBe(true);
    });

    it("Given 저장된 지침을 비움 When 저장 Then 필드가 제거된다(빈 문자열을 남기지 않는다)", () => {
      store.update((draft) => {
        draft.aiInstructions = "지울 규칙";
      });
      const saved: string[] = [];
      const backdrop = open(saved);

      typeInto(backdrop, "   ");
      save(backdrop);

      expect("aiInstructions" in store.getCurrent()).toBe(false);
      expect(saved).toEqual([""]);
    });

    it("Given 값을 바꾸지 않고 저장 When 클릭 Then 스냅샷도 onSaved 도 없다(빈 편집은 편집이 아니다)", () => {
      const before = getMapEditHistoryMarker();
      const saved: string[] = [];
      const backdrop = open(saved);

      save(backdrop);

      expect(getMapEditHistoryMarker()).toBe(before);
      expect(saved).toEqual([]);
      expect(backdrop.parentElement).toBeNull();
    });

    it("Given 상한 초과 입력 When 저장 Then 상한에서 잘려 저장된다", () => {
      const backdrop = open([]);

      typeInto(backdrop, "가".repeat(AI_INSTRUCTIONS_MAX_CHARS + 200));
      save(backdrop);

      expect(store.getCurrent().aiInstructions).toHaveLength(AI_INSTRUCTIONS_MAX_CHARS);
    });

    it("Given 입력 중 When 글자 수 변화 Then 카운터가 따라온다", () => {
      const backdrop = open([]);

      typeInto(backdrop, "다섯글자");

      expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`4 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
    });

    it("Given 닫기 버튼 When 클릭 Then 저장 없이 닫힌다", () => {
      const backdrop = open([]);

      typeInto(backdrop, "저장하지 않을 값");
      (findByTestId(backdrop, "ai-instructions-close") as unknown as HTMLElement).click();

      expect(backdrop.parentElement).toBeNull();
      expect(store.getCurrent().aiInstructions).toBeUndefined();
    });
  });
});

// 레인 고스트 — 살아 있는 레인 전부를 한 장의 초안으로 겹쳐 캔버스 시공 표시에 넣는다.
describe("aiLaneGhost", () => {
  isolateTimers();
  function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
  function seed(): Project {
    const ctx = { project: createBlankProject() };
    for (const [id, name] of [["map_east", "동쪽"], ["map_west", "서쪽"]] as const) {
      const result = runTool(ctx, "create_map", { id, name, width: 20, height: 16 });
      if (!result.ok) throw new Error(result.summary);
    }
    return ctx.project;
  }
  function paint(project: Project, mapId: string, x: number, y: number): Project {
    const next = clone(project);
    const map = next.maps[mapId] as GameMap;
    map.lowerTiles[y * map.width + x] = 7;
    return next;
  }
  function fakeTimers() {
    const queued: Array<() => void> = [];
    return {
      setTimeoutFn: (handler: () => void) => { queued.push(handler); return queued.length as unknown as ReturnType<typeof setTimeout>; },
      clearTimeoutFn: () => undefined,
      tick: () => { const pending = [...queued]; queued.length = 0; for (const handler of pending) handler(); },
    };
  }
  beforeEach(() => {
    resetMapEditHistory();
    clearAgentGhostPreview();
    setAgentGhostDraftMapProvider(null);
    store.replace(seed());
  });
  describe("createLaneGhostSink", () => {
    it("두 레인의 증분이 서로 다른 맵에 겹쳐 쌓이고, 한 레인을 내리면 그 맵만 사라진다", () => {
      const base = store.getCurrent();
      const timers = fakeTimers();
      const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
      sink.start("a", base);
      sink.start("b", base);
      const eastDraft = paint(base, "map_east", 3, 4);
      sink.handleEvent("a", { type: "map_delta", maps: diffMapsForDelta(base.maps, eastDraft.maps) });
      const westDraft = paint(base, "map_west", 1, 1);
      sink.handleEvent("b", { type: "map_delta", maps: diffMapsForDelta(base.maps, westDraft.maps) });
      timers.tick();
      const mapIds = getAgentGhostPreviewState().previews.map((preview) => preview.mapId).sort();
      expect(mapIds).toEqual(["map_east", "map_west"]);
      expect(getAgentGhostDraftMap("map_east")).toBeTruthy();

      sink.drop("a");
      expect(getAgentGhostPreviewState().previews.map((preview) => preview.mapId)).toEqual(["map_west"]);
      expect(getAgentGhostDraftMap("map_east")).toBeUndefined();

      sink.drop("b");
      expect(getAgentGhostPreviewState().previews).toHaveLength(0);
      sink.dispose();
    });

    it("결과가 오면 초안을 결과 프로젝트로 확정하고, 검토 대기 동안 고스트가 남는다", () => {
      const base = store.getCurrent();
      const timers = fakeTimers();
      const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
      sink.start("a", base);
      sink.finish("a", paint(base, "map_east", 5, 5), ["map_east"]);
      expect(getAgentGhostPreviewState().previews.map((preview) => preview.mapId)).toEqual(["map_east"]);
      sink.dispose();
      expect(getAgentGhostPreviewState().previews).toHaveLength(0);
    });

    it("레인 B 의 결과 프로젝트(와이어를 건너온 새 객체)는 B 의 묶음 맵만 확정한다 — A 의 초안을 덮지 않는다", () => {
      const base = store.getCurrent();
      const timers = fakeTimers();
      const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
      sink.start("a", base);
      sink.start("b", base);
      sink.handleEvent("a", { type: "map_delta", maps: diffMapsForDelta(base.maps, paint(base, "map_east", 3, 4).maps) });
      timers.tick();
      // B 의 결과: 모든 맵이 복제된 새 객체이고 서쪽만 실제로 바뀌었다.
      const resultB = clone(paint(base, "map_west", 1, 1));
      sink.finish("b", resultB, ["map_west"]);
      const mapIds = getAgentGhostPreviewState().previews.map((preview) => preview.mapId).sort();
      expect(mapIds).toEqual(["map_east", "map_west"]);
      sink.dispose();
    });

    it("매니저에 꽂으면 시작·증분·완료·적용이 그대로 고스트로 이어진다", async () => {
      const timers = fakeTimers();
      const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
      const runner = async (request: PiAgentRequest, options: { onEvent?: (event: PiAgentEvent) => void }): Promise<PiAgentDoneEvent> => {
        const draft = paint(request.project, "map_east", 2, 2);
        options.onEvent?.({ type: "map_delta", maps: diffMapsForDelta(request.project.maps, draft.maps) });
        return { type: "done", project: draft, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps.map_east"] };
      };
      const manager = createLaneManager({ ghost: sink, runAgent: runner });
      manager.add({ id: "lane_a", label: "동쪽", mapIds: ["map_east"], agentLabel: "시공A", provider: "google-antigravity", model: "gemini-3.7-flash", instruction: "칠한다" });
      await manager.start("lane_a");
      expect(manager.get("lane_a")?.status).toBe("review");
      expect(getAgentGhostPreviewState().previews.map((preview) => preview.mapId)).toEqual(["map_east"]);
      manager.discard("lane_a");
      expect(getAgentGhostPreviewState().previews).toHaveLength(0);
      manager.dispose();
    });
  });
});

describe("aiMapChip", () => {
  isolateTimers();
  const ok = { ok: true, summary: "" } as const;
  describe("aiMapChip — 툴 호출에서 맵 자리를 읽는다", () => {
    it("인자의 x/y 한 칸, x/y/w/h 사각형, rect 객체를 영역으로 읽는다", () => {
      // Break: 인자 모양 하나가 빠지면 그 툴의 행이 빈 아이콘 칩으로 떨어진다.
      expect(regionFromToolCall({ x: 3, y: 4 }, ok)).toEqual({ x: 3, y: 4, width: 1, height: 1 });
      expect(regionFromToolCall({ x: 2, y: 2, w: 4, h: 6 }, ok)).toEqual({ x: 2, y: 2, width: 4, height: 6 });
      expect(regionFromToolCall({ rect: { x: 1, y: 2, w: 5, h: 3 } }, ok)).toEqual({ x: 1, y: 2, width: 5, height: 3 });
      expect(regionFromToolCall({ region: { x: 1, y: 2, width: 5, height: 3 } }, ok)).toEqual({ x: 1, y: 2, width: 5, height: 3 });
    });

    it("인자에 없으면 결과 data 의 좌표·영역을 본다", () => {
      // Break: 결과 좌표(예: 빈 자리 찾기)가 무시되어 조회 툴 행에 칩이 없다.
      expect(regionFromToolCall({}, { ...ok, data: { x: 7, y: 8 } })).toEqual({ x: 7, y: 8, width: 1, height: 1 });
      expect(regionFromToolCall(undefined, { ...ok, data: { region: { x: 0, y: 1, width: 2, height: 2 } } }))
        .toEqual({ x: 0, y: 1, width: 2, height: 2 });
    });

    it("좌표가 없거나 유효하지 않으면 null", () => {
      // Break: NaN·음수·문자열 좌표를 영역으로 만들어 렌더러가 던진다.
      expect(regionFromToolCall({ name: "두리" }, ok)).toBeNull();
      expect(regionFromToolCall({ x: "3", y: 4 }, ok)).toBeNull();
      expect(regionFromToolCall({ x: -1, y: 4 }, ok)).toBeNull();
      expect(regionFromToolCall({ x: 1, y: 1, w: 0, h: 2 }, ok)).toBeNull();
    });

    it("칩 창은 영역을 가운데 두고 최소 7×5 로 넓힌 뒤 맵 안으로 자른다", () => {
      // Break: 한 칸 영역을 그대로 그려 46×32 칩에 타일 하나가 뭉개져 보이거나, 맵 밖을 그리려 한다.
      expect(chipWindow({ x: 10, y: 10, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 7, y: 8, width: 7, height: 5 });
      expect(chipWindow({ x: 0, y: 0, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 0, y: 0, width: 7, height: 5 });
      expect(chipWindow({ x: 58, y: 44, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 53, y: 40, width: 7, height: 5 });
      // 큰 영역은 그대로 두고 여백 1칸만 더한다.
      expect(chipWindow({ x: 10, y: 10, width: 20, height: 12 }, { width: 60, height: 45 })).toEqual({ x: 9, y: 9, width: 22, height: 14 });
    });
  });
  describe("renderMapChip", () => {
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("맵이 있으면 캔버스를 비동기로 붙이고 핀을 찍는다", async () => {
      // Break: 렌더러 결과를 버리거나 핀이 없어 어디가 바뀌었는지 알 수 없다.
      const project = createBlankProject();
      const mapId = project.startMapId;
      const canvas = document.createElement("canvas");
      const chip = renderMapChip({
        project,
        mapId,
        region: { x: 3, y: 3, width: 1, height: 1 },
        renderShot: () => Promise.resolve(canvas),
      });
      expect(chip.className).toContain("ai-act-chip");
      await Promise.resolve();
      await Promise.resolve();
      expect((chip as unknown as FakeElement).childNodes).toContain(canvas);
      expect(chip.querySelector(".ai-act-pin")).not.toBeNull();
      expect(chip.dataset.region).toBe("3,3 1×1");
    });

    it("렌더가 실패하면 아이콘 칩으로 남고 예외를 밖으로 내지 않는다", async () => {
      // Break: 타일셋 로드 실패가 로그 렌더 전체를 죽인다.
      const project = createBlankProject();
      const chip = renderMapChip({
        project,
        mapId: project.startMapId,
        region: { x: 0, y: 0, width: 1, height: 1 },
        renderShot: () => Promise.reject(new Error("no tileset")),
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(chip.querySelector("canvas")).toBeNull();
      expect(chip.className).toContain("is-icon");
    });

    it("맵이 없으면 아이콘 칩", () => {
      const project = createBlankProject();
      const chip = renderMapChip({ project, mapId: "nope", region: { x: 0, y: 0, width: 1, height: 1 } });
      expect(chip.className).toContain("is-icon");
    });
  });
});

// aiPanelLayoutResponsive.test.ts
// 컴포저 캡슐 폭 저장 + 뷰포트 반응형 클램프 계약.
// 2026-08-31: 도크가 float 하나가 되면서 per-dock 키(oprn:ai-panel-size:<dock>) 3종이
// 캡슐 폭 하나로 합쳐졌다. 낡은 float 키는 최초 1회만 읽어 사용자 폭을 물려받는다.
// vitest 환경은 "node" — 돔 대신 storage(globalThis.localStorage)만 스텁한다.
describe("aiPanelLayoutResponsive", () => {
  isolateTimers();
  let storage: Map<string, string>;
  function installFakeLocalStorage(): void {
    storage = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, String(value)),
        removeItem: (key: string) => void storage.delete(key),
        clear: () => storage.clear(),
      },
    });
  }
  beforeEach(() => {
    installFakeLocalStorage();
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  describe("clampPanelSizeToViewport", () => {
    it("작은 뷰포트에서는 폭/높이를 뷰포트의 90%로 상한을 잡는다", () => {
      // 900x900 (한계 내) → 800x700 뷰포트: width=round(800*0.9)=720, height=round(700*0.9)=630
      expect(clampPanelSizeToViewport({ width: 900, height: 900 }, { width: 800, height: 700 })).toEqual({
        width: 720,
        height: 630,
      });
    });

    it("아무리 작은 뷰포트라도 minWidth/minHeight 아래로 내려가지 않는다", () => {
      expect(clampPanelSizeToViewport({ width: 900, height: 900 }, { width: 200, height: 200 })).toEqual({
        width: PANEL_SIZE_LIMITS.minWidth,
        height: PANEL_SIZE_LIMITS.minHeight,
      });
    });

    it("비유효 뷰포트(0/NaN)는 뷰포트 상한 없이 clampPanelSize와 같다", () => {
      const size = { width: 500, height: 600 };
      expect(clampPanelSizeToViewport(size, { width: 0, height: NaN })).toEqual(clampPanelSize(size));
    });
  });
  describe("캡슐 폭 저장/복원", () => {
    it("저장한 폭을 그대로 왕복하고, 저장이 없으면 null 이다", () => {
      expect(loadPanelBarSize()).toBeNull();
      savePanelBarSize({ width: 560, height: 880 });
      expect(loadPanelBarSize()).toEqual({ width: 560, height: 880 });
    });

    it("낡은 float 도크 키를 물려받는다 — 도크 삭제로 사용자 폭을 잃지 않는다", () => {
      storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 620, height: 700 }));
      expect(loadPanelBarSize()).toEqual({ width: 620, height: 700 });
    });

    it("새 키가 있으면 낡은 float 키보다 우선한다", () => {
      storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 620, height: 700 }));
      savePanelSize({ width: 480, height: 640 });
      expect(loadPanelBarSize()).toEqual({ width: 480, height: 640 });
    });

    it("삭제된 glass/side 키는 더 이상 읽지 않는다", () => {
      storage.set("oprn:ai-panel-size:glass", JSON.stringify({ width: 400, height: 700 }));
      storage.set("oprn:ai-panel-size:side", JSON.stringify({ width: 560, height: 880 }));
      expect(loadPanelBarSize()).toBeNull();
    });

    it("저장된 쓰레기 값은 예외 없이 null을 돌려준다", () => {
      storage.set("oprn:ai-panel-size", '{"width":"wide"}');
      expect(loadPanelBarSize()).toBeNull();
    });
  });
  describe("글자 크기 스테퍼", () => {
    it("작게↔보통↔크게에서 끝은 더 나가지 않는다", () => {
      expect(stepAiFontSize("normal", 1)).toBe("large");
      expect(stepAiFontSize("large", 1)).toBe("large");
      expect(stepAiFontSize("small", -1)).toBe("small");
      expect(stepAiFontSize("large", -1)).toBe("normal");
    });
  });
});
