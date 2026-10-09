import { renderTilesetAiWorkspaceAtlas, type TilesetAiAtlasFilter, type TilesetAiAtlasZoom } from "@/editor/panels/tilesetAiWorkspaceAtlas";
import {
  containTilesetAiWorkspaceTab,
  prepareTilesetAiWorkspace,
  releaseTilesetAiWorkspace,
  rememberTilesetAiWorkspaceFocus,
  restoreTilesetAiWorkspaceFocus,
} from "@/editor/panels/tilesetAiWorkspaceAccessibility";
import { renderTilesetAiWorkspaceConversation } from "@/editor/panels/tilesetAiWorkspaceConversation";
import {
  answerTilesetAiQuestion,
  applyConfirmedTilesetAiKnowledge,
  conversationSnapshot,
  selectTilesetAiQuestion,
  skipTilesetAiQuestion,
  type TilesetAiConversationSnapshot,
} from "@/editor/tilesetAiConversationSession";
import { runTilesetAiReview, tilesetAiReviewState } from "@/editor/tilesetAiNativeReviewSession";
import { proposalsForAiReview, type TilesetAiReviewState } from "@/editor/tilesetAiNativeReviewModel";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { tilesetImageUrl, tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { clearChildren, el } from "@/util/dom";

export type TilesetAiWorkspaceStep = "analyze" | "questions" | "summary";

let activeHost: HTMLElement | null = null;
let activeTilesetId: string | null = null;
let manualStep: TilesetAiWorkspaceStep | null = null;
let atlasFilter: TilesetAiAtlasFilter = "all";
let atlasZoom: TilesetAiAtlasZoom = 3;
let onProjectChange: (() => void) | null = null;
let returnFocus: HTMLElement | null = null;
let returnFocusTestId: string | null = null;

export function openTilesetAiWorkspace(tilesetId: string, projectChanged?: () => void): void {
  closeTilesetAiWorkspace();
  activeTilesetId = tilesetId;
  manualStep = null;
  onProjectChange = projectChanged ?? null;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  returnFocusTestId = returnFocus?.dataset.testid ?? null;
  activeHost = el("div", {
    class: "tileset-ai-workspace-host",
    dataset: { testid: "tileset-ai-workspace-host" },
    on: { click: (event) => { if (event.target === activeHost) closeTilesetAiWorkspace(); } },
  });
  document.body.append(activeHost);
  prepareTilesetAiWorkspace(activeHost);
  document.addEventListener("keydown", handleWorkspaceKeydown);
  renderActiveWorkspace();
  const tileset = currentTileset();
  if (tileset && tilesetAiReviewState(tileset).status === "idle") void runTilesetAiReview(tileset, renderActiveWorkspace);
}

export function closeTilesetAiWorkspace(): void {
  document.removeEventListener("keydown", handleWorkspaceKeydown);
  releaseTilesetAiWorkspace();
  activeHost?.remove();
  activeHost = null;
  activeTilesetId = null;
  onProjectChange = null;
  const focusTarget = returnFocus;
  returnFocus = null;
  const currentTarget = focusTarget?.isConnected ? focusTarget : findDocumentTestId(returnFocusTestId);
  returnFocusTestId = null;
  currentTarget?.focus();
}

export function isTilesetAiWorkspaceOpen(): boolean {
  return activeHost !== null;
}

export function naturalTilesetAiWorkspaceStep(state: TilesetAiReviewState): TilesetAiWorkspaceStep {
  switch (state.status) {
    case "idle":
      return "analyze";
    case "analyzing":
    case "error":
    case "offline":
      return state.previousProposals.length > 0 ? "questions" : "analyze";
    case "partial":
    case "ready":
    case "saved":
    case "saving":
    case "stale":
      return pendingCount(state) > 0 ? "questions" : "summary";
  }
}

function pendingCount(state: TilesetAiReviewState): number {
  return proposalsForAiReview(state).filter((proposal) => proposal.status === "pending").length;
}

function renderActiveWorkspace(): void {
  if (!activeHost) return;
  const tileset = currentTileset();
  if (!tileset) {
    closeTilesetAiWorkspace();
    return;
  }
  const snapshot = conversationSnapshot(tileset);
  const state = snapshot.state;
  const busy = state.status === "analyzing" || state.status === "saving";
  const step = manualStep ?? naturalTilesetAiWorkspaceStep(state);
  rememberTilesetAiWorkspaceFocus(activeHost);
  clearChildren(activeHost);
  activeHost.append(el("section", {
    class: "tileset-ai-workspace",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "tileset-ai-workspace-title",
      tabindex: "-1",
    },
    dataset: { state: state.status, step, testid: "tileset-ai-workspace" },
    children: [
      renderWorkspaceHeader(tileset),
      renderStepper(step, snapshot),
      el("div", {
        class: "tileset-ai-workspace-body",
        children: [renderStepBody(step, tileset, snapshot, busy)],
      }),
      renderWorkspaceFooter(step, tileset, snapshot, busy),
    ],
  }));
  if (step === "questions" && !snapshot.current && snapshot.turns.length > 0) scrollConversationToLatest(activeHost);
  restoreTilesetAiWorkspaceFocus(activeHost);
}

function goToStep(step: TilesetAiWorkspaceStep): void {
  manualStep = step;
  renderActiveWorkspace();
}

function rerunAnalysis(tileset: TilesetDef): void {
  manualStep = null;
  void runTilesetAiReview(tileset, renderActiveWorkspace);
}

function renderStepBody(
  step: TilesetAiWorkspaceStep,
  tileset: TilesetDef,
  snapshot: TilesetAiConversationSnapshot,
  busy: boolean,
): HTMLElement {
  if (step === "analyze") return renderAnalyzeStep(tileset, snapshot.state.status);
  if (step === "questions") {
    return el("div", {
      class: "tileset-ai-workspace-split",
      children: [
        renderTilesetAiWorkspaceAtlas({
          filter: atlasFilter,
          onFilter: (filter) => { atlasFilter = filter; renderActiveWorkspace(); },
          onQuestion: (proposalId) => { selectTilesetAiQuestion(tileset, proposalId); renderActiveWorkspace(); },
          onZoom: (zoom) => { atlasZoom = zoom; renderActiveWorkspace(); },
          snapshot,
          tileset,
          zoom: atlasZoom,
        }),
        renderTilesetAiWorkspaceConversation({
          busy,
          onAnswer: (answer) => answerTilesetAiQuestion(tileset, answer, renderActiveWorkspace),
          onDiscard: () => { skipTilesetAiQuestion(tileset); renderActiveWorkspace(); },
          onGoSummary: () => goToStep("summary"),
          snapshot,
          tileset,
        }),
      ],
    });
  }
  return renderSummaryStep(tileset, snapshot);
}

function renderWorkspaceHeader(tileset: TilesetDef): HTMLElement {
  return el("header", {
    class: "tileset-ai-workspace-header",
    children: [
      el("div", {
        class: "tileset-ai-workspace-title",
        children: [
          el("span", { class: "tileset-ai-workspace-mark", text: "AI", attrs: { "aria-hidden": "true" } }),
          el("div", {
            children: [
              el("h2", { text: "AI 타일셋 작업실", attrs: { id: "tileset-ai-workspace-title" } }),
              el("p", { text: `${tileset.name} · 확실한 건 자동으로 골라두고, 애매한 것만 물어봅니다.` }),
            ],
          }),
        ],
      }),
      el("button", {
        class: "tileset-ai-workspace-close",
        text: "×",
        attrs: { type: "button", "aria-label": "AI 타일셋 작업실 닫기" },
        dataset: { testid: "tileset-ai-workspace-close" },
        on: { click: closeTilesetAiWorkspace },
      }),
    ],
  });
}

function renderStepper(step: TilesetAiWorkspaceStep, snapshot: TilesetAiConversationSnapshot): HTMLElement {
  const answered = countAnswered(snapshot);
  const remaining = countPendingProposals(snapshot);
  const total = answered + remaining;
  const stages: readonly { readonly id: TilesetAiWorkspaceStep; readonly label: string }[] = [
    { id: "analyze", label: "전체 분석" },
    { id: "questions", label: `확인 질문 ${total > 0 ? `${answered}/${total}` : ""}`.trim() },
    { id: "summary", label: "적용" },
  ];
  return el("nav", {
    class: "tileset-ai-workspace-stepper",
    attrs: { "aria-label": "작업 단계" },
    children: stages.map((stage, index) => el("button", {
      class: `tileset-ai-step ${stage.id === step ? "current" : stageDone(stage.id, step) ? "done" : ""}`,
      attrs: { type: "button", ...(stage.id === step ? { "aria-current": "step" } : {}) },
      dataset: { testid: `tileset-ai-workspace-step-${stage.id}` },
      children: [
        el("i", { text: stageDone(stage.id, step) ? "✓" : String(index + 1), attrs: { "aria-hidden": "true" } }),
        el("span", { text: stage.label }),
      ],
      on: { click: () => { if (stage.id !== step) goToStep(stage.id); } },
    })),
  });
}

function stageDone(candidate: TilesetAiWorkspaceStep, current: TilesetAiWorkspaceStep): boolean {
  if (candidate === "analyze") return current !== "analyze";
  if (candidate === "questions") return current === "summary";
  return false;
}

function countAnswered(snapshot: TilesetAiConversationSnapshot): number {
  return snapshot.turns.filter((turn) => turn.tone === "answer").length;
}

function countPendingProposals(snapshot: TilesetAiConversationSnapshot): number {
  return pendingCount(snapshot.state);
}

function renderAnalyzeStep(tileset: TilesetDef, status: string): HTMLElement {
  const panels: readonly { readonly body: string; readonly title: string }[] = [
    {
      body: "타일셋 그림 전체를 AI가 읽고 길·가구·나무·물 같은 반복 묶음을 찾습니다. 확실한 묶음은 자동으로 골라두고, 애매한 것만 2단계에서 질문합니다.",
      title: "무슨 일이 일어나나요",
    },
    {
      body: "AI가 골라둔 묶음은 이 단계에서는 프로젝트에 들어가지 않습니다. 3단계에서 최종 목록을 확인하고 ‘적용’을 눌러야 반영됩니다. 반영 후에도 실행 취소로 되돌릴 수 있습니다.",
      title: "안전장치",
    },
    {
      body: "질문은 보기에서 고르거나 직접 쓸 수 있습니다. 사람이 직접 확정해 둔 타일 지식은 AI가 건드리지 않습니다.",
      title: "질문에 답하는 방법",
    },
  ];
  return el("div", {
    class: "tileset-ai-workspace-analyze",
    dataset: { testid: "tileset-ai-workspace-analyze" },
    children: [
      el("div", {
        class: "tileset-ai-analyze-visual",
        dataset: { testid: "tileset-ai-workspace-analyze-visual" },
        children: [
          el("img", {
            attrs: { alt: `${tileset.name} 전체 타일셋`, src: tilesetImageUrl(tileset) },
          }),
          el("span", { class: "tileset-ai-analyze-scan", attrs: { "aria-hidden": "true" } }),
        ],
      }),
      el("div", {
        class: "tileset-ai-analyze-copy",
        children: [
          el("h3", { text: analyzeHeadline(status) }),
          el("ul", {
            children: panels.map((panel) => el("li", {
              children: [
                el("strong", { text: panel.title }),
                el("p", { text: panel.body }),
              ],
            })),
          }),
          renderAnalyzeStatus(status),
        ],
      }),
    ],
  });
}

function analyzeHeadline(status: string): string {
  if (status === "analyzing") return "AI가 타일셋 전체를 읽고 있습니다…";
  if (status === "offline") return "AI 연결이 필요합니다";
  if (status === "error") return "분석에 실패했습니다";
  return "타일셋 전체를 한 번에 분석합니다";
}

function renderAnalyzeStatus(status: string): HTMLElement {
  if (status === "analyzing") {
    return el("div", {
      class: "tileset-ai-analyze-progress",
      dataset: { testid: "tileset-ai-workspace-analyze-progress" },
      children: [
        el("span", { class: "tileset-ai-analyze-spinner", attrs: { "aria-hidden": "true" } }),
        el("span", { text: "그림을 보고 패턴을 찾는 중… 잠시만 기다려 주세요." }),
      ],
    });
  }
  if (status === "offline") {
    // 예전에는 "AI 설정에서 확인하세요"라고 글로만 안내하고 정작 AI 설정을 여는 길이
    // 이 창 어디에도 없었다 — 모달 두 겹 뒤에 있어서 막다른 골목이었다.
    return el("div", {
      class: "tileset-ai-analyze-progress offline",
      children: [
        el("span", { text: "AI 연결을 마치면 바로 분석할 수 있습니다." }),
        el("button", {
          class: "tileset-ai-open-settings",
          text: "AI 설정 열기",
          attrs: { type: "button" },
          dataset: { testid: "tileset-ai-open-settings" },
          on: { click: () => { openAiSettingsModal(); } },
        }),
      ],
    });
  }
  if (status === "error") {
    return el("div", {
      class: "tileset-ai-analyze-progress error",
      children: [el("span", { text: "아래 ‘다시 전체 분석’으로 다시 시도할 수 있습니다." })],
    });
  }
  return el("div", {
    class: "tileset-ai-analyze-progress",
    children: [el("span", { text: "분석이 끝나면 자동으로 확인 질문 단계로 넘어갑니다." })],
  });
}

function renderSummaryStep(tileset: TilesetDef, snapshot: TilesetAiConversationSnapshot): HTMLElement {
  const confirmed = snapshot.confirmed;
  const counts = proposalStatusCounts(snapshot);
  const applied = snapshot.state.status === "saved";
  return el("div", {
    class: "tileset-ai-workspace-summary",
    dataset: { testid: "tileset-ai-workspace-summary" },
    children: [
      el("h3", {
        text: applied ? "적용이 완료되었습니다" : `반영할 묶음 ${confirmed.length}개`,
      }),
      el("p", {
        class: "tileset-ai-summary-sub",
        text: applied
          ? "반영된 내용은 타일셋 편집기에서 바로 확인할 수 있습니다. 필요하면 실행 취소로 되돌리세요."
          : "아래 목록이 프로젝트에 반영됩니다. 묶음 이름·칸 수·통행 규칙이 타일 그룹으로 기록되고, 실행 취소로 되돌릴 수 있습니다.",
      }),
      renderSummaryList(confirmed, tileset),
      el("div", {
        class: "tileset-ai-summary-counts",
        dataset: { testid: "tileset-ai-workspace-summary-counts" },
        children: [
          el("span", { text: `확정 ${counts.accepted}` }),
          el("span", { text: `남은 질문 ${counts.pending}` }),
          el("span", { text: `버림 ${counts.skipped}` }),
        ],
      }),
    ],
  });
}

function renderSummaryList(
  confirmed: readonly TilesetAiConversationSnapshot["confirmed"][number][],
  tileset: TilesetDef,
): HTMLElement {
  if (confirmed.length === 0) {
    return el("p", {
      class: "tileset-ai-summary-empty",
      text: "확정된 묶음이 없습니다. 2단계에서 질문에 답하거나, 확신이 낮은 제안을 버리면 이곳에 목록이 채워집니다.",
    });
  }
  return el("ul", {
    class: "tileset-ai-summary-list",
    children: confirmed.map((proposal) => el("li", {
      dataset: { testid: `tileset-ai-summary-item-${proposal.id}` },
      children: [
        el("span", {
          class: "tileset-ai-summary-thumb",
          attrs: { "aria-hidden": "true", style: tilesetTileBackgroundStyle(tileset, proposal.tileIds[0] ?? 0, 40) },
        }),
        el("div", {
          class: "tileset-ai-summary-item-copy",
          children: [
            el("span", { class: "tileset-ai-summary-name", text: proposal.name }),
            el("span", {
              class: "tileset-ai-summary-meta",
              text: `${proposal.tileIds.length}칸 · ${templateLabel(proposal.template)} · 신뢰도 ${Math.round(proposal.confidence * 100)}%`,
            }),
          ],
        }),
      ],
    })),
  });
}

function templateLabel(template: string): string {
  const labels: Record<string, string> = {
    desk: "가구",
    "one-way-path": "한 방향 길",
    "repeatable-cliff-2x3": "반복 절벽",
    tree: "나무",
    "water-atlas-9x9": "물 아틀라스",
    "water-autotile-3x3": "물 오토타일",
  };
  return labels[template] ?? template;
}

function proposalStatusCounts(snapshot: TilesetAiConversationSnapshot): {
  accepted: number; pending: number; skipped: number;
} {
  let accepted = 0;
  let pending = 0;
  let skipped = 0;
  for (const proposal of proposalsForAiReview(snapshot.state)) {
    if (proposal.status === "accepted") accepted += 1;
    else if (proposal.status === "pending") pending += 1;
    else skipped += 1;
  }
  return { accepted, pending, skipped };
}

function renderWorkspaceFooter(
  step: TilesetAiWorkspaceStep,
  tileset: TilesetDef,
  snapshot: TilesetAiConversationSnapshot,
  busy: boolean,
): HTMLElement {
  const state = tilesetAiReviewState(tileset);
  const confirmed = snapshot.confirmed.length;
  const alreadyApplied = state.status === "saved";
  const cannotApply = confirmed === 0 || busy || state.status === "stale" || alreadyApplied;
  const ready = !busy && (state.status === "partial" || state.status === "ready" || state.status === "saved"
    || state.status === "saving" || state.status === "stale");
  return el("footer", {
    class: "tileset-ai-workspace-footer",
    children: [
      el("div", {
        class: "tileset-ai-workspace-footer-left",
        children: footerLeftChildren(step, busy, tileset),
      }),
      el("span", {
        class: `tileset-ai-workspace-status ${state.status}`,
        text: workspaceStatusText(state.status, confirmed),
        attrs: { role: "status", "aria-live": "polite", tabindex: "-1" },
        dataset: { testid: "tileset-ai-workspace-status" },
      }),
      el("div", {
        class: "tileset-ai-workspace-footer-right",
        children: footerRightChildren(step, busy, ready, confirmed, cannotApply, alreadyApplied, tileset),
      }),
    ],
  });
}

function footerLeftChildren(
  step: TilesetAiWorkspaceStep,
  busy: boolean,
  tileset: TilesetDef,
): readonly HTMLElement[] {
  const children: HTMLElement[] = [];
  if (step !== "analyze" && !busy) {
    children.push(el("button", {
      class: "database-footer-button",
      text: "← 이전",
      attrs: { type: "button" },
      dataset: { testid: "tileset-ai-workspace-back" },
      on: { click: () => { goToStep(step === "summary" ? "questions" : "analyze"); } },
    }));
  }
  if (!busy && step !== "summary") {
    children.push(el("button", {
      class: "database-footer-button",
      text: "다시 전체 분석",
      attrs: { type: "button" },
      dataset: { testid: "tileset-ai-workspace-reanalyze" },
      on: { click: () => { rerunAnalysis(tileset); } },
    }));
  }
  return children;
}

function footerRightChildren(
  step: TilesetAiWorkspaceStep,
  busy: boolean,
  ready: boolean,
  confirmed: number,
  cannotApply: boolean,
  alreadyApplied: boolean,
  tileset: TilesetDef,
): readonly HTMLElement[] {
  const children: HTMLElement[] = [];
  if (step === "questions" && !busy) {
    children.push(el("button", {
      class: "database-footer-button",
      text: "3단계로 →",
      attrs: { type: "button" },
      dataset: { testid: "tileset-ai-workspace-to-summary" },
      on: { click: () => { goToStep("summary"); } },
    }));
  }
  if (step === "analyze" && ready) {
    children.push(el("button", {
      class: "database-footer-button primary",
      text: "다음 단계 →",
      attrs: { type: "button" },
      dataset: { testid: "tileset-ai-workspace-next-step" },
      on: { click: () => { goToStep("questions"); } },
    }));
  }
  if (step === "summary") {
    children.push(el("button", {
      class: "database-footer-button primary tileset-ai-workspace-apply",
      text: alreadyApplied ? `${confirmed}개 적용됨` : `확정된 ${confirmed}개 적용`,
      attrs: { type: "button", ...(cannotApply ? { disabled: "true" } : {}) },
      dataset: { testid: "tileset-ai-workspace-apply" },
      on: { click: () => {
        const appliedCount = applyConfirmedTilesetAiKnowledge(tileset);
        if (appliedCount > 0) onProjectChange?.();
        renderActiveWorkspace();
      } },
    }));
  }
  return children;
}

function workspaceStatusText(status: string, confirmed: number): string {
  if (status === "analyzing") return "AI가 타일셋과 답변을 분석하고 있습니다.";
  if (status === "error") return "분석에 실패했습니다. 답변은 그대로 남아 있습니다.";
  if (status === "offline") return "AI 연결을 확인해 주세요.";
  if (status === "stale") return "타일셋이 변경되어 다시 분석해야 합니다.";
  if (status === "saved") return "확정된 지식을 프로젝트에 적용했습니다.";
  return confirmed > 0 ? `${confirmed}개 묶음이 적용을 기다리고 있습니다.` : "아직 프로젝트에 변경을 적용하지 않았습니다.";
}

function currentTileset(): TilesetDef | null {
  if (!activeTilesetId) return null;
  return store.getCurrent().tilesets[activeTilesetId] ?? null;
}

function scrollConversationToLatest(host: HTMLElement): void {
  const scroll = host.querySelector<HTMLElement>(".tileset-ai-conversation-scroll");
  if (!scroll) return;
  requestAnimationFrame(() => {
    scroll.scrollTop = scroll.scrollHeight;
  });
}

function findDocumentTestId(testId: string | null): HTMLElement | null {
  if (!testId) return null;
  return Array.from(document.querySelectorAll<HTMLElement>("[data-testid]"))
    .find((element) => element.dataset.testid === testId) ?? null;
}

function handleWorkspaceKeydown(event: KeyboardEvent): void {
  if (!activeHost) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeTilesetAiWorkspace();
    return;
  }
  if (event.key !== "Tab") return;
  containTilesetAiWorkspaceTab(activeHost, event);
}
