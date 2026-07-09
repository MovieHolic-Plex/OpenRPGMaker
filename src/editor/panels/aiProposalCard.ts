// editor/panels/aiProposalCard.ts
// 제안 카드 렌더 + 수락/거부/메타데이터 즉시저장. 패널 클로저 밖 의존성은 deps로 주입.

import {
  proposalApprovalWarnings,
  type ProposedCall,
  type TurnResult,
} from "@/ai/assistantSession";
import { loadAiConfig } from "@/ai/llmClient";
import { focusAcceptedAgentChanges } from "@/editor/agentFocus";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { drawTransferFallback, drawTransferMapPreview } from "@/editor/panels/eventEditor/transferMapPreview";
import { commitChangeset, summarizeChanges } from "@/editor/tools";
import { currentAgentEditorIdentity } from "@/project/editorIdentity";
import { combineDiffs, recordProjectCommitFireAndForget, resetManualProjectCommitBaseline } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import {
  callsWithVocabularyEdits,
  hasVocabularyEdits,
  renderVocabularyCardList,
  vocabularyCardsData,
  type VocabularyCardEdit,
} from "./aiChatRenderers";
import {
  collectPendingBuilds,
  proposalAcceptButtonLabel,
  rebindPendingBuildArgs,
  runPendingBuilds,
  type PendingBuildOutcome,
} from "./aiProposalFusion";
import {
  enforceProposalDependencies,
  proposalDependencyIndexes,
  proposalHumanSummaryLine,
  proposalSummaryLines,
  proposalTechnicalDetailLines,
  reassembleSelectedProposalProject,
} from "./aiProposalSummary";
import {
  aiHistoryLabel,
  confirmRuleApproval,
  currentHistoryMapId,
  EMPTY_PROPOSAL_NOTICE_DISMISS_MS,
  hasDestructiveCall,
  proposalPreviewMapId,
  renderEmptyProposalNotice,
  type ChatController,
} from "./aiChatPanelHelpers";

export type AiMessageBadgeState = "proposal" | "applied" | "discarded" | "reverted";

const AI_MESSAGE_BADGE_LABELS: Record<AiMessageBadgeState, string> = {
  proposal: "제안",
  applied: "적용됨",
  discarded: "폐기됨",
  reverted: "되돌려짐",
};

export function setAssistantMessageBadge(bubble: HTMLElement | null, state: AiMessageBadgeState): void {
  if (!bubble) return;
  bubble.querySelector(".ai-msg-badge")?.remove();
  bubble.classList.remove("is-proposal", "is-applied", "is-discarded", "is-reverted");
  bubble.classList.add(`is-${state}`);
  const badge = el("span", {
    class: `ai-msg-badge is-${state}`,
    text: AI_MESSAGE_BADGE_LABELS[state],
    dataset: { testid: `ai-msg-badge-${state}` },
  });
  bubble.prepend(badge);
}

export function renderProposalMapThumbnail(project: Project, mapId: string, kind: "before" | "after"): HTMLElement {
  const map = project.maps[mapId];
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.className = "ai-proposal-thumb-canvas";
  const wrap = el("div", {
    class: "ai-proposal-thumb",
    attrs: { role: "img", "aria-label": `${kind === "before" ? "현재" : "초안"} 미니맵` },
    dataset: { testid: `ai-proposal-thumb-${kind}` },
    children: [
      el("span", { class: "ai-proposal-thumb-label", text: kind === "before" ? "현재" : "초안" }),
      canvas,
    ],
  });
  if (!map || typeof canvas.getContext !== "function") {
    wrap.dataset.fallback = "true";
    return wrap;
  }
  const zoom = Math.min(1, 104 / Math.max(map.width * map.tileSize, map.height * map.tileSize, 1));
  const selection = { x: -1, y: -1, zoom };
  void drawTransferMapPreview({ canvas, project, mapId, selection, isCurrent: () => canvas.isConnected }).catch(() => {
    drawTransferFallback({ canvas, map, selection });
  });
  return wrap;
}

export type ProposalMessageState = {
  readonly calls: readonly ProposedCall[];
  readonly assistantBubble: HTMLElement | null;
  readonly summary: string;
};

export interface ProposalHostApi {
  pendingProposalMessage: ProposalMessageState | null;
  lastAppliedProposalMessage: ProposalMessageState | null;
  renderProposal: (result: TurnResult, extraWarnings?: readonly string[], assistantBubble?: HTMLElement | null) => void;
  acceptProposal: (calls: readonly ProposedCall[], selectedState?: readonly boolean[], hasEdits?: boolean) => void;
  rejectProposal: () => void;
  applyMetadataKeepSession: (calls: readonly ProposedCall[]) => void;
}

export function createProposalHost(options: {
  readonly proposalHost: HTMLElement;
  readonly proposalNoticeHost: HTMLElement;
  readonly proposalModalCount: HTMLElement;
  readonly proposalPill: HTMLButtonElement;
  readonly openProposalModal: () => void;
  readonly closeProposalModal: () => void;
  readonly controller: ChatController;
  readonly appendBubble: (role: "user" | "assistant" | "tool" | "system", text: string) => HTMLElement;
  readonly setStatus: (text: string, record?: boolean) => void;
}): ProposalHostApi {
  const {
    proposalHost,
    proposalNoticeHost,
    proposalModalCount,
    proposalPill,
    openProposalModal,
    closeProposalModal,
    controller,
    appendBubble,
    setStatus,
  } = options;

  let pendingProposalMessage: ProposalMessageState | null = null;
  let lastAppliedProposalMessage: ProposalMessageState | null = null;

  const applyAcceptedProposal = (
    calls: readonly ProposedCall[],
    selected: readonly boolean[],
    selectedCalls: readonly ProposedCall[],
    hasEdits: boolean
  ): void => {
    const session = controller.session;
    if (!session) return;
    const before = store.getCurrent();
    const fullAccept = selectedCalls.length === calls.length && !hasEdits;
    const reassembled = fullAccept
      ? null
      : reassembleSelectedProposalProject(session.baselineProject, calls, selected);
    if (reassembled && !reassembled.ok) {
      setStatus("적용 실패");
      toast(`적용 실패: ${reassembled.message}`, "error");
      return;
    }
    let proposed = reassembled?.ok ? reassembled.project : session.getProposedProject();

    // 승인+시공 융합(§2.1.3)
    const pendingSelections = collectPendingBuilds(calls, selected);
    let fusionOutcomes: PendingBuildOutcome[] = [];
    if (pendingSelections.length > 0) {
      const selectedPosition = (callIndex: number): number => {
        let position = -1;
        for (let index = 0; index <= callIndex; index += 1) if (selected[index]) position += 1;
        return position;
      };
      const builds = pendingSelections.map(({ callIndex, pending }) => {
        const call = calls[callIndex];
        const originalCards = vocabularyCardsData(call)?.cards ?? null;
        const committedResult = reassembled?.ok ? reassembled.results[selectedPosition(callIndex)] : null;
        const committedCards = committedResult
          ? vocabularyCardsData({ name: call.name, result: committedResult })?.cards ?? null
          : originalCards;
        return { pending, args: rebindPendingBuildArgs(pending, originalCards, committedCards) };
      });
      const fused = runPendingBuilds(proposed, builds);
      proposed = fused.project;
      fusionOutcomes = fused.outcomes;
      for (const outcome of fusionOutcomes.filter((entry) => !entry.result.ok)) {
        appendBubble("system", `⚠️ 시공 실패 — ${outcome.pending.label}: ${outcome.result.summary}`);
        toast(`시공 실패: ${outcome.pending.label}`, "error");
      }
    }
    const fusionApplied = fusionOutcomes.filter((entry) => entry.result.ok);

    const commit = commitChangeset(proposed, store.getCurrent());
    if (!commit.ok) {
      setStatus("적용 실패");
      const issue = commit.issues.find((entry) => entry.severity === "error");
      toast(`적용 실패: ${issue?.message ?? "무결성 오류"}`, "error");
      return;
    }
    clearAgentGhostPreview();
    recordProjectSnapshot(aiHistoryLabel(selectedCalls), currentHistoryMapId());
    store.replace(proposed);
    focusAcceptedAgentChanges(before, proposed);
    const actualDiff = reassembled?.ok
      ? combineDiffs([...reassembled.results, ...fusionApplied.map((entry) => entry.result)].map((result) => result.diff))
      : summarizeChanges(before, proposed);
    recordProjectCommitFireAndForget({
      project: proposed,
      identity: currentAgentEditorIdentity(loadAiConfig().model),
      reviewStatus: "approved",
      summary: aiHistoryLabel(selectedCalls),
      diff: actualDiff,
      toolNames: [...selectedCalls.map((call) => call.name), ...fusionApplied.map((entry) => entry.pending.tool)],
    });
    resetManualProjectCommitBaseline(proposed);
    proposalHost.replaceChildren();
    closeProposalModal();
    setStatus("적용됨");
    const messageState = pendingProposalMessage;
    setAssistantMessageBadge(messageState?.assistantBubble ?? null, "applied");
    lastAppliedProposalMessage = messageState
      ? { ...messageState, calls: selectedCalls, summary: proposalHumanSummaryLine(selectedCalls) }
      : { calls: selectedCalls, assistantBubble: null, summary: proposalHumanSummaryLine(selectedCalls) };
    pendingProposalMessage = null;
    appendBubble("system", `변경 ${selectedCalls.length}건을 프로젝트에 적용했습니다.`);
    for (const outcome of fusionApplied) {
      appendBubble("system", `🏗 승인하고 시공 — ${outcome.result.summary}`);
    }
    toast(fusionApplied.length > 0 ? "어휘를 승인하고 바로 시공했습니다." : "AI 변경안을 적용했습니다.", "ok");
    controller.session?.rebaseProject(store.getCurrent());
  };

  const acceptProposal = (calls: readonly ProposedCall[], selectedState?: readonly boolean[], hasEdits = false): void => {
    const session = controller.session;
    if (!session) return;
    const selected = selectedState ? enforceProposalDependencies(selectedState, proposalDependencyIndexes(calls)) : calls.map(() => true);
    const selectedCalls = calls.filter((_, index) => selected[index]);
    if (selectedCalls.length === 0) return;
    const warnings = proposalApprovalWarnings(selectedCalls);
    const decision = confirmRuleApproval(warnings);
    if (decision !== true) {
      void decision.then((confirmed) => {
        if (confirmed) applyAcceptedProposal(calls, selected, selectedCalls, hasEdits);
      });
      return;
    }
    applyAcceptedProposal(calls, selected, selectedCalls, hasEdits);
  };

  const rejectProposal = (): void => {
    proposalHost.replaceChildren();
    closeProposalModal();
    clearAgentGhostPreview();
    setStatus("제안 거부됨");
    setAssistantMessageBadge(pendingProposalMessage?.assistantBubble ?? null, "discarded");
    pendingProposalMessage = null;
    appendBubble("system", "제안을 거부하고 초안을 폐기했습니다.");
    controller.session?.rebaseProject(store.getCurrent());
  };

  const applyMetadataKeepSession = (calls: readonly ProposedCall[]): void => {
    const session = controller.session;
    if (!session) return;
    const proposed = session.getProposedProject();
    const commit = commitChangeset(proposed, store.getCurrent());
    if (!commit.ok) {
      setStatus("저장 실패");
      const issue = commit.issues.find((entry) => entry.severity === "error");
      toast(`저장 실패: ${issue?.message ?? "무결성 오류"}`, "error");
      return;
    }
    const before = store.getCurrent();
    recordProjectSnapshot(aiHistoryLabel(calls), currentHistoryMapId());
    store.replace(proposed);
    focusAcceptedAgentChanges(before, proposed);
    recordProjectCommitFireAndForget({
      project: proposed,
      identity: currentAgentEditorIdentity(loadAiConfig().model),
      reviewStatus: "approved",
      summary: aiHistoryLabel(calls),
      diff: combineDiffs(calls.map((call) => call.result.diff)),
      toolNames: calls.map((call) => call.name),
    });
    resetManualProjectCommitBaseline(proposed);
    setStatus("저장됨");
    appendBubble("system", `타일 지식 ${calls.length}건 저장됨 (Ctrl+Z로 복구 가능)`);
  };

  const renderProposal = (result: TurnResult, extraWarnings: readonly string[] = [], assistantBubble: HTMLElement | null = null): void => {
    proposalHost.replaceChildren();
    proposalHost.classList.remove("is-sticky-empty");
    const lines = proposalSummaryLines(result.proposedCalls, extraWarnings);
    if (result.proposedCalls.length === 0 && lines.length === 0) return;

    if (result.proposedCalls.length === 0) {
      closeProposalModal();
      appendBubble("system", ["변경 제안 없음(0건) — 완성도 린트:", ...lines].join("\n"));
      const notice = renderEmptyProposalNotice(lines, () => notice.remove());
      proposalNoticeHost.append(notice);
      if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
        window.setTimeout(() => notice.remove(), EMPTY_PROPOSAL_NOTICE_DISMISS_MS);
      }
      return;
    }

    const warnings = proposalApprovalWarnings(result.proposedCalls);
    const beforeProject = store.getCurrent();
    const afterProject = controller.session?.getProposedProject() ?? beforeProject;
    const previewMapId = proposalPreviewMapId(result.proposedCalls, beforeProject, afterProject);
    const dependencies = proposalDependencyIndexes(result.proposedCalls);
    let selected = result.proposedCalls.map(() => true);
    const itemRows: HTMLElement[] = [];
    let acceptButton: HTMLButtonElement | null = null;

    const refreshSelectionUi = (): void => {
      selected = enforceProposalDependencies(selected, dependencies);
      itemRows.forEach((row, index) => {
        const checkbox = row.querySelector("input") as HTMLInputElement | null;
        const note = row.querySelector(".ai-proposal-item-note") as HTMLElement | null;
        const blockedBy = dependencies[index]?.filter((dependency) => !selected[dependency]) ?? [];
        if (checkbox) {
          checkbox.checked = selected[index] === true;
          checkbox.disabled = blockedBy.length > 0;
          checkbox.setAttribute("aria-disabled", String(blockedBy.length > 0));
        }
        if (note) {
          note.textContent = blockedBy.length > 0 ? `상위 항목 ${blockedBy.map((dependency) => dependency + 1).join(", ")} 제외로 함께 제외됨` : "";
          note.hidden = blockedBy.length === 0;
        }
        row.classList[blockedBy.length > 0 || !selected[index] ? "add" : "remove"]("is-excluded");
      });
      if (acceptButton) {
        const count = selected.filter(Boolean).length;
        acceptButton.disabled = count === 0;
        const hasPending = result.proposedCalls.some((call, index) => selected[index] === true && (call.pendingBuilds?.length ?? 0) > 0);
        acceptButton.textContent = proposalAcceptButtonLabel(hasPending, count, result.proposedCalls.length);
      }
    };

    const vocabEditsByCall = new Map<number, Map<number, VocabularyCardEdit>>();
    const itemElements: HTMLElement[] = [];
    let vocabCardNumber = 1;
    result.proposedCalls.forEach((call, index) => {
      const checkbox = el("input", {
        attrs: { type: "checkbox", "aria-label": `${index + 1}번 변경 포함` },
        dataset: { testid: `ai-proposal-item-${index + 1}` },
      }) as HTMLInputElement;
      checkbox.checked = true;
      checkbox.addEventListener("change", () => {
        selected[index] = checkbox.checked;
        if (!checkbox.checked) {
          for (let candidate = 0; candidate < selected.length; candidate += 1) {
            if (dependencies[candidate]?.includes(index)) selected[candidate] = false;
          }
        }
        refreshSelectionUi();
      });
      const row = el("label", {
        class: "ai-proposal-item",
        children: [
          checkbox,
          el("span", { class: "ai-proposal-item-main", text: call.summary || call.name }),
          el("span", { class: "ai-proposal-item-note", attrs: { hidden: "" } }),
        ],
      });
      itemRows.push(row);
      itemElements.push(row);
      const cards = renderVocabularyCardList(beforeProject, call, vocabCardNumber, (cardIndex, field, value) => {
        const edits = vocabEditsByCall.get(index) ?? new Map<number, VocabularyCardEdit>();
        vocabEditsByCall.set(index, edits);
        const entry = edits.get(cardIndex) ?? {};
        entry[field] = value;
        edits.set(cardIndex, entry);
      });
      if (cards) {
        vocabCardNumber += cards.count;
        itemElements.push(cards.element);
      }
    });

    const card = el("div", {
      class: `ai-proposal-card${hasDestructiveCall(result.proposedCalls) ? " is-destructive" : ""}`,
      dataset: { testid: "ai-proposal-card" },
      children: [
        el("div", { class: "ai-proposal-title", text: `변경 제안 (${result.proposedCalls.length}건)` }),
        ...warnings.map((warning) => el("div", {
          class: "ai-proposal-warning",
          text: warning,
          dataset: { testid: "ai-proposal-warning" },
        })),
        el("div", {
          class: "ai-proposal-summary",
          dataset: { testid: "ai-proposal-summary" },
          children: lines.map((line) => el("div", { class: "ai-proposal-line", text: line })),
        }),
        ...(previewMapId
          ? [el("div", {
              class: "ai-proposal-thumbs",
              children: [
                renderProposalMapThumbnail(beforeProject, previewMapId, "before"),
                renderProposalMapThumbnail(afterProject, previewMapId, "after"),
              ],
            })]
          : []),
        el("div", { class: "ai-proposal-items", children: itemElements }),
        el("details", {
          class: "ai-proposal-technical",
          children: [
            el("summary", { text: "기술 상세" }),
            el("div", {
              class: "ai-proposal-lines",
              children: proposalTechnicalDetailLines(result.proposedCalls).map((line) => el("div", { class: "ai-proposal-line", text: line })),
            }),
          ],
        }),
        el("div", {
          class: "ai-proposal-actions",
          children: [
            (acceptButton = el("button", {
              class: "ai-assistant-action ai-proposal-accept",
              text: "수락해서 적용",
              attrs: { type: "button" },
              dataset: { testid: "ai-proposal-accept" },
              on: {
                click: () =>
                  acceptProposal(
                    callsWithVocabularyEdits(result.proposedCalls, vocabEditsByCall),
                    selected,
                    hasVocabularyEdits(vocabEditsByCall)
                  ),
              },
            }) as HTMLButtonElement),
            el("button", {
              class: "ai-assistant-action ai-proposal-reject",
              text: "거부(초안 폐기)",
              attrs: { type: "button" },
              dataset: { testid: "ai-proposal-reject" },
              on: { click: () => rejectProposal() },
            }),
          ],
        }),
      ],
    });
    pendingProposalMessage = { calls: result.proposedCalls, assistantBubble, summary: proposalHumanSummaryLine(result.proposedCalls) };
    setAssistantMessageBadge(assistantBubble, "proposal");
    refreshSelectionUi();
    proposalHost.append(card);
    proposalModalCount.textContent = `${result.proposedCalls.length}건`;
    proposalPill.textContent = `📋 변경 제안 ${result.proposedCalls.length}건 대기 — 검토`;
    openProposalModal();
  };

  return {
    get pendingProposalMessage() {
      return pendingProposalMessage;
    },
    set pendingProposalMessage(value) {
      pendingProposalMessage = value;
    },
    get lastAppliedProposalMessage() {
      return lastAppliedProposalMessage;
    },
    set lastAppliedProposalMessage(value) {
      lastAppliedProposalMessage = value;
    },
    renderProposal,
    acceptProposal,
    rejectProposal,
    applyMetadataKeepSession,
  };
}
