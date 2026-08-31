// editor/panels/aiContextMeter.ts
// 컴포저 액션 행의 컨텍스트 게이지 + 그 팝오버(맥락 패널).
//
// 왜 있는가 (실측): 압축 엔진(ai/contextCompaction.ts)은 처음부터 다 있었지만 화면에 아무것도
// 없었다. 사용자가 압축을 알 수 있는 유일한 경로는 `대화 압축: 152000 -> 61000 토큰` 상태줄이
// **지나가는 순간**을 보는 것뿐이고, 남은 여유를 묻거나 미리 압축할 방법은 없었다.
//
// 게이지 숫자는 세션이 계산한다(AssistantSession.getContextUsage) — 자동 압축 임계와 같은
// 입력이다. UI 가 자기 방식으로 다시 세면 "62% 인데 왜 압축했지" 가 된다.
//
// 높이 계약: 이 게이지는 고정 28px 액션 행에 살고, 팝오버는 흐름 밖(absolute)이다.
// "바 높이 = f(textarea 줄 수)" 불변식(aiComposer.ts 주석)을 건드리지 않는다.

import { formatSessionUsage, formatTokenCount, type SessionUsageTotals } from "@/ai/sessionUsage";
import type { ContextUsage } from "@/ai/contextCompaction";
import { el } from "@/util/dom";

export interface AiContextSnapshot {
  /** 세션이 아직 없으면 null — 게이지는 "대화 없음" 을 보여준다. */
  readonly usage: ContextUsage | null;
  readonly totals: SessionUsageTotals;
  readonly summary: string | null;
  readonly canUndoCompaction: boolean;
  /** 턴 진행 중에는 압축/되돌리기를 막는다(요약 콜이 진행 중 요청과 겹친다). */
  readonly busy: boolean;
}

export interface AiContextMeterHandle {
  readonly button: HTMLButtonElement;
  readonly popover: HTMLElement;
  /** 스냅샷을 다시 읽어 게이지 라벨과 팝오버 내용을 갱신한다. */
  readonly refresh: () => void;
}

/** 0..1 비율 → 0..100 정수 퍼센트(1 초과는 100 으로 붙이지 않고 그대로 넘긴다). */
export function contextUsagePercent(usage: ContextUsage): number {
  return Math.round(usage.ratio * 100);
}

/**
 * 게이지 톤 — 임계를 넘었으면 warn, 임계의 80% 를 넘었으면 near, 아니면 idle.
 * 임계(창 - 예비분)를 기준으로 삼는다: 사용자가 궁금한 것은 "창이 얼마 남았나" 가 아니라
 * "언제 자동 압축이 도는가" 다.
 */
export function contextUsageTone(usage: ContextUsage): "idle" | "near" | "warn" {
  if (usage.overThreshold) return "warn";
  if (usage.thresholdTokens > 0 && usage.contextTokens >= usage.thresholdTokens * 0.8) return "near";
  return "idle";
}

export function formatContextMeterLabel(usage: ContextUsage | null): string {
  if (!usage) return "맥락 —";
  return `맥락 ${contextUsagePercent(usage)}%`;
}

function usageDetailLines(usage: ContextUsage): string[] {
  const lines = [
    `${formatTokenCount(usage.contextTokens)} / ${formatTokenCount(usage.contextWindow)} 토큰 (${contextUsagePercent(usage)}%)`,
    `자동 압축 임계 ${formatTokenCount(usage.thresholdTokens)} 토큰${usage.overThreshold ? " — 이미 넘었습니다" : ""}`,
  ];
  // 추정과 과금이 다르면 둘 다 보여준다 — 임계 판정은 큰 쪽을 쓴다(resolveThresholdContextTokens).
  if (usage.usageTokens > 0 && usage.usageTokens !== usage.estimateTokens) {
    lines.push(`로컬 추정 ${formatTokenCount(usage.estimateTokens)} · 공급자 과금 ${formatTokenCount(usage.usageTokens)}`);
  } else {
    lines.push(`로컬 추정 ${formatTokenCount(usage.estimateTokens)} 토큰 (과금 계량 없음)`);
  }
  return lines;
}

export function createAiContextMeter(options: {
  readonly read: () => AiContextSnapshot;
  readonly onCompact: () => void;
  readonly onUndoCompaction: () => void;
  /** 게이지를 누르면 팝오버를 열고 닫는다 — 배타 팝오버 관리는 컴포저 셸이 한다. */
  readonly onToggle: () => void;
}): AiContextMeterHandle {
  const button = el("button", {
    class: "ai-composer-menu-btn ai-context-meter",
    text: "맥락 —",
    attrs: {
      type: "button",
      title: "대화 맥락 사용량 — 누르면 압축·사용량을 봅니다",
      "aria-label": "대화 맥락 사용량",
      "aria-expanded": "false",
      "aria-haspopup": "dialog",
    },
    dataset: { testid: "ai-context-meter", tone: "idle" },
    on: { click: () => options.onToggle() },
  }) as HTMLButtonElement;

  const headline = el("div", { class: "ai-context-panel-headline", dataset: { testid: "ai-context-headline" } });
  const detail = el("div", { class: "ai-context-panel-detail", dataset: { testid: "ai-context-detail" } });
  const usageLine = el("div", { class: "ai-context-panel-usage", dataset: { testid: "ai-context-usage" } });
  const modelLines = el("div", { class: "ai-context-panel-models", dataset: { testid: "ai-context-models" } });

  const compactButton = el("button", {
    class: "ai-assistant-action ai-context-compact",
    text: "지금 압축",
    attrs: { type: "button", title: "이전 맥락을 요약 1건으로 접어 자리를 비웁니다" },
    dataset: { testid: "ai-context-compact" },
    on: { click: () => options.onCompact() },
  }) as HTMLButtonElement;

  const undoButton = el("button", {
    class: "ai-assistant-action ai-context-compact-undo",
    text: "압축 되돌리기",
    attrs: { type: "button", title: "직전 압축을 취소하고 요약 전 원문 대화로 돌아갑니다" },
    dataset: { testid: "ai-context-compact-undo" },
    on: { click: () => options.onUndoCompaction() },
  }) as HTMLButtonElement;

  const summaryBody = el("pre", {
    class: "ai-context-summary-body",
    dataset: { testid: "ai-context-summary-body" },
  });
  const summaryToggle = el("button", {
    class: "ai-context-summary-toggle",
    text: "요약 원문 보기",
    attrs: { type: "button", "aria-expanded": "false" },
    dataset: { testid: "ai-context-summary-toggle" },
    on: {
      click: () => {
        const open = summaryBody.hidden;
        summaryBody.hidden = !open;
        summaryToggle.setAttribute("aria-expanded", String(open));
        summaryToggle.textContent = open ? "요약 원문 접기" : "요약 원문 보기";
      },
    },
  }) as HTMLButtonElement;
  summaryBody.hidden = true;

  const summaryBlock = el("div", {
    class: "ai-context-summary",
    children: [summaryToggle, summaryBody],
  });

  const popover = el("div", {
    class: "ai-composer-popover ai-context-panel",
    attrs: { role: "dialog", "aria-label": "대화 맥락" },
    dataset: { testid: "ai-context-panel" },
    children: [
      headline,
      detail,
      el("div", { class: "ai-context-panel-actions", children: [compactButton, undoButton] }),
      summaryBlock,
      el("div", { class: "ai-context-panel-section-label", text: "이 대화의 사용량" }),
      usageLine,
      modelLines,
    ],
  });
  popover.hidden = true;

  const refresh = (): void => {
    const snapshot = options.read();
    const usage = snapshot.usage;
    button.textContent = formatContextMeterLabel(usage);
    button.dataset.tone = usage ? contextUsageTone(usage) : "idle";
    button.setAttribute("aria-expanded", String(!popover.hidden));
    button.setAttribute(
      "title",
      usage
        ? `맥락 ${contextUsagePercent(usage)}% · ${formatTokenCount(usage.contextTokens)}/${formatTokenCount(usage.contextWindow)} 토큰`
        : "아직 대화가 없습니다",
    );

    headline.textContent = usage
      ? `맥락 ${contextUsagePercent(usage)}%`
      : "아직 대화가 없습니다";
    detail.replaceChildren(
      ...(usage
        ? usageDetailLines(usage).map((line) => el("div", { class: "ai-context-panel-line", text: line }))
        : [el("div", { class: "ai-context-panel-line", text: "첫 지시를 보내면 사용량이 잡힙니다." })]),
    );

    const canCompact = Boolean(usage) && !snapshot.busy;
    compactButton.disabled = !canCompact;
    compactButton.setAttribute("aria-disabled", String(!canCompact));
    const canUndo = snapshot.canUndoCompaction && !snapshot.busy;
    undoButton.hidden = !snapshot.canUndoCompaction;
    undoButton.disabled = !canUndo;
    undoButton.setAttribute("aria-disabled", String(!canUndo));

    summaryBlock.hidden = snapshot.summary === null;
    summaryBody.textContent = snapshot.summary ?? "";
    if (snapshot.summary === null) {
      summaryBody.hidden = true;
      summaryToggle.setAttribute("aria-expanded", "false");
      summaryToggle.textContent = "요약 원문 보기";
    }

    usageLine.textContent = formatSessionUsage(snapshot.totals);
    modelLines.replaceChildren(
      ...snapshot.totals.byModel.map((entry) =>
        el("div", {
          class: "ai-context-panel-line",
          text: `${entry.model} — 호출 ${formatTokenCount(entry.calls)} · 입력 ${formatTokenCount(entry.promptTokens)} · 출력 ${formatTokenCount(entry.completionTokens)}`,
        }),
      ),
    );
  };

  refresh();
  return { button, popover, refresh };
}
