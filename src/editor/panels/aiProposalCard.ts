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
import { getInlineProposalActions, setInlineProposalActions, type InlineProposalActions } from "@/editor/proposalInlineApproval";
import { currentAgentEditorIdentity } from "@/project/editorIdentity";
import {
  formatLayoutValidationSummary,
  layoutValidationBlocking,
  validateLayoutPlacement,
} from "@/project/lint/layoutPlacementValidate";
import { combineDiffs, recordProjectCommitFireAndForget, resetManualProjectCommitBaseline } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { ensureGuestIdentityForAiSurface } from "@/editor/teamWorkflowUi";
import {
  callsWithVocabularyEdits,
  hasVocabularyEdits,
  renderVocabularyCardList,
  type VocabularyCardEdit,
} from "./aiChatRenderers";
import {
  collectVocabSoftConfirms,
  markSoftVocabApprovalsOnProject,
  proposalAcceptButtonLabel,
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

export type ProposalMapCrop = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/** before→after 타일 변경 bbox(+pad). 목업 썸네일 crop 용. */
export function computeMapTileChangeBounds(before: Project, after: Project, mapId: string, pad = 2): ProposalMapCrop | null {
  const base = before.maps[mapId];
  const next = after.maps[mapId];
  if (!base || !next || base.width !== next.width || base.height !== next.height) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < base.height; y += 1) {
    for (let x = 0; x < base.width; x += 1) {
      const i = y * base.width + x;
      if (base.lowerTiles[i] !== next.lowerTiles[i] || base.upperTiles[i] !== next.upperTiles[i]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!Number.isFinite(minX)) return null;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(base.width - 1, maxX + pad);
  const y1 = Math.min(base.height - 1, maxY + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function renderProposalMapThumbnail(
  project: Project,
  mapId: string,
  kind: "before" | "after",
  crop: ProposalMapCrop | null = null,
): HTMLElement {
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
  const fullZoom = Math.min(1, 104 / Math.max(map.width * map.tileSize, map.height * map.tileSize, 1));
  const selection = { x: -1, y: -1, zoom: fullZoom };
  const finishCrop = (): void => {
    if (!crop || crop.w < 1 || crop.h < 1) return;
    const tile = map.tileSize;
    const sx = crop.x * tile;
    const sy = crop.y * tile;
    const sw = crop.w * tile;
    const sh = crop.h * tile;
    if (sw <= 0 || sh <= 0 || canvas.width < sx + sw || canvas.height < sy + sh) return;
    const slice = document.createElement("canvas");
    slice.width = sw;
    slice.height = sh;
    const sliceCtx = slice.getContext("2d");
    if (!sliceCtx) return;
    sliceCtx.imageSmoothingEnabled = false;
    sliceCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    // 변경 영역 강조
    sliceCtx.strokeStyle = kind === "after" ? "#7aa2ff" : "#94a3b8";
    sliceCtx.lineWidth = Math.max(2, Math.floor(tile / 8));
    sliceCtx.strokeRect(1, 1, sw - 2, sh - 2);
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(slice, 0, 0);
    const zoom = Math.min(1.5, 140 / Math.max(sw, sh, 1));
    canvas.style.width = `${Math.max(48, sw * zoom)}px`;
    canvas.style.height = `${Math.max(48, sh * zoom)}px`;
    wrap.dataset.crop = `${crop.x},${crop.y},${crop.w}x${crop.h}`;
  };
  void drawTransferMapPreview({ canvas, project, mapId, selection, isCurrent: () => canvas.isConnected })
    .then(() => {
      if (!canvas.isConnected) return;
      finishCrop();
    })
    .catch(() => {
      drawTransferFallback({ canvas, map, selection });
      finishCrop();
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
  /** 이 호스트가 마지막으로 등록한 인라인 승인 actions가 여전히 현재 슬롯이면(CAS) 해제한다. */
  clearInlineActionsIfMine: () => void;
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
  // 이 호스트가 마지막으로 setInlineProposalActions에 넘긴 객체 참조 — CAS 해제용(전역 슬롯 경합 방지).
  let myInlineActions: InlineProposalActions | null = null;
  const clearInlineActionsIfMine = (): void => {
    if (getInlineProposalActions() === myInlineActions) setInlineProposalActions(null);
    myInlineActions = null;
  };

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
    const proposed = reassembled?.ok ? reassembled.project : session.getProposedProject();

    // soft-confirm 재료 합의(origin:user) — 목업 수락과 동시에 다음 시공부터 바로 씀.
    const softMarked = markSoftVocabApprovalsOnProject(proposed, calls, selected);
    const softList = collectVocabSoftConfirms(calls, selected);

    // 배치 후 검증: 물 위 나무, 나무 짝, 지시 대비 나무 누락 등
    const lastUser = [...(controller.session?.getAuditEntries() ?? [])].reverse().find((entry) => entry.kind === "user");
    const instruction = lastUser && lastUser.kind === "user" ? lastUser.text : "";
    const layoutIssues = validateLayoutPlacement(proposed, {
      mapId: currentHistoryMapId() ?? undefined,
      instruction,
      toolNames: selectedCalls.map((call) => call.name),
    });
    const layoutBlocking = layoutValidationBlocking(layoutIssues);
    if (layoutBlocking.length > 0) {
      setStatus("배치 검증 실패");
      const summary = formatLayoutValidationSummary(layoutIssues);
      appendBubble("system", `❌ ${summary}`);
      toast(summary, "error");
      return;
    }

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
      ? combineDiffs(reassembled.results.map((result) => result.diff))
      : summarizeChanges(before, proposed);
    recordProjectCommitFireAndForget({
      project: proposed,
      identity: currentAgentEditorIdentity(loadAiConfig().model),
      reviewStatus: "approved",
      summary: aiHistoryLabel(selectedCalls),
      diff: actualDiff,
      toolNames: selectedCalls.map((call) => call.name),
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
    if (softMarked > 0) {
      appendBubble("system", `재료 ${softMarked}건 합의: ${softList.map((entry) => entry.name).join(", ")}`);
    }
    toast(
      softMarked > 0
        ? "배치를 적용하고 재료를 합의했습니다."
        : "AI 변경안을 적용했습니다.",
      "ok",
    );
    controller.session?.rebaseProject(store.getCurrent());
  };

  const acceptProposal = (calls: readonly ProposedCall[], selectedState?: readonly boolean[], hasEdits = false): void => {
    clearInlineActionsIfMine();
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
    clearInlineActionsIfMine();
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

    ensureGuestIdentityForAiSurface();
    const warnings = proposalApprovalWarnings(result.proposedCalls);
    const softConfirms = collectVocabSoftConfirms(result.proposedCalls);
    const beforeProject = store.getCurrent();
    const afterProject = controller.session?.getProposedProject() ?? beforeProject;
    const previewMapId = proposalPreviewMapId(result.proposedCalls, beforeProject, afterProject);
    const mapCrop = previewMapId ? computeMapTileChangeBounds(beforeProject, afterProject, previewMapId) : null;
    const dependencies = proposalDependencyIndexes(result.proposedCalls);
    let selected = result.proposedCalls.map(() => true);
    const itemRows: HTMLElement[] = [];
    let acceptButton: HTMLButtonElement | null = null;
    let rejectButton: HTMLButtonElement | null = null;
    let proposalCardEl: HTMLElement | null = null;

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
        acceptButton.textContent = proposalAcceptButtonLabel(count, result.proposedCalls.length);
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
                renderProposalMapThumbnail(beforeProject, previewMapId, "before", mapCrop),
                renderProposalMapThumbnail(afterProject, previewMapId, "after", mapCrop),
              ],
            })]
          : []),
        ...(softConfirms.length > 0
          ? [el("div", {
              class: "ai-proposal-soft-vocab",
              dataset: { testid: "ai-proposal-soft-vocab" },
              children: [
                el("div", { class: "ai-proposal-soft-vocab-title", text: "이렇게 재료·배치를 쓸까요?" }),
                ...softConfirms.map((soft) => el("div", {
                  class: "ai-proposal-soft-vocab-row",
                  text: `${soft.name} (${soft.role}) · 타일 ${soft.tileIds.slice(0, 4).join(",")}${soft.tileIds.length > 4 ? "…" : ""}`,
                })),
                el("div", { class: "ai-proposal-soft-vocab-hint", text: "위 맵 미리보기를 보고 [이대로 적용]을 누르면 배치와 재료 합의가 함께 끝납니다." }),
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
              text: "이대로 적용",
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
            (rejectButton = el("button", {
              class: "ai-assistant-action ai-proposal-reject",
              text: "거부(초안 폐기)",
              attrs: { type: "button" },
              dataset: { testid: "ai-proposal-reject" },
              on: { click: () => rejectProposal() },
            }) as HTMLButtonElement),
          ],
        }),
      ],
    });
    proposalCardEl = card;
    pendingProposalMessage = { calls: result.proposedCalls, assistantBubble, summary: proposalHumanSummaryLine(result.proposedCalls) };
    setAssistantMessageBadge(assistantBubble, "proposal");
    refreshSelectionUi();
    // 인라인 승인(캔버스 고스트 마커) — 카드의 실제 버튼 경로를 그대로 태운다.
    myInlineActions = {
      accept: () => { if (acceptButton && !acceptButton.disabled) acceptButton.click(); },
      reject: () => rejectButton?.click(),
      focusCard: () => {
        proposalCardEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      },
    };
    setInlineProposalActions(myInlineActions);
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
    clearInlineActionsIfMine,
    applyMetadataKeepSession,
  };
}
