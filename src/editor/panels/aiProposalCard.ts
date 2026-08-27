// editor/panels/aiProposalCard.ts
// 제안 카드 렌더 + 수락/거부. 패널 클로저 밖 의존성은 deps로 주입.

import {
  proposalApprovalWarnings,
  type ProposedCall,
  type TurnResult,
} from "@/ai/assistantSession";
import { loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { drawTransferFallback, drawTransferMapPreview } from "@/editor/panels/eventEditor/transferMapPreview";
import { summarizeChanges } from "@/editor/tools";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { getInlineProposalActions, setInlineProposalActions, type InlineProposalActions } from "@/editor/proposalInlineApproval";
import {
  formatLayoutValidationSummary,
  layoutValidationBlocking,
  validateLayoutPlacement,
} from "@/project/lint/layoutPlacementValidate";
import { combineDiffs } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { ensureGuestIdentityForAiSurface } from "@/editor/teamWorkflowUi";
import { getEditorChrome } from "@/editor/editorUiMode";
import { sanitizeUserFacingToolId } from "@/editor/uiCopy";
import {
  callsWithVocabularyEdits,
  hasVocabularyEdits,
  renderVocabularyCardList,
  type VocabularyCardEdit,
} from "./aiChatRenderers";
import { resolveProposalPresentation, type ProposalPresentationMode } from "./aiProposalModal";
import type { ChatDock } from "@/editor/chatDock";
import {
  collectVocabSoftConfirms,
  markSoftVocabApprovalsOnProject,
  proposalAcceptButtonLabel,
  proposalAcceptWithMaterialButtonLabel,
} from "./aiProposalFusion";
import { clearProposalPin, refreshProposalPinAccept, replaceProposalPin } from "./aiProposalPin";
import {
  enforceProposalDependencies,
  proposalDecisionTitle,
  proposalDetailsToggleLabel,
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
  showConfirm,
  type ChatController,
} from "./aiChatPanelHelpers";

export type AiMessageBadgeState = "proposal" | "applied" | "discarded" | "reverted";

/**
 * 제안 카드 내 자동 승인 체크박스 토글.
 * 사용자가 설정 모달을 찾아가지 않고도 결정 시점에 바로 앞으로의 자동 적용 여부를 전환할 수 있게 한다.
 */
export function renderAutoApproveToggle(options: {
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
}): HTMLElement {
  const checkbox = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "ai-proposal-auto-approve-input" },
    on: {
      change: (event) => {
        const target = event.target as HTMLInputElement | null;
        options.onChange(target ? target.checked : false);
      },
    },
  }) as HTMLInputElement;
  checkbox.checked = options.checked;

  const labelSpan = el("span", {
    class: "ai-proposal-auto-approve-label",
    text: "앞으로 자동 적용",
  });

  return el("label", {
    class: "ai-proposal-auto-approve",
    dataset: { testid: "ai-proposal-auto-approve" },
    attrs: {
      title: "켜면 안전한 변경은 검토 없이 바로 적용됩니다. 파괴적 변경과 재료 합의는 계속 승인을 요구합니다.",
    },
    children: [checkbox, labelSpan],
  });
}

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

/** before→after 타일 변경 bbox(+pad). 목업 썸네일 crop 용. 이벤트 위치 변경도 bbox에 합산한다. */
export function computeMapTileChangeBounds(before: Project, after: Project, mapId: string, pad = 2): ProposalMapCrop | null {
  const base = before.maps[mapId];
  const next = after.maps[mapId];
  if (!base || !next || base.width !== next.width || base.height !== next.height) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number): void => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (let y = 0; y < base.height; y += 1) {
    for (let x = 0; x < base.width; x += 1) {
      const i = y * base.width + x;
      if (base.lowerTiles[i] !== next.lowerTiles[i] || base.upperTiles[i] !== next.upperTiles[i]) {
        grow(x, y);
      }
    }
  }
  // 이벤트 전용 제안(NPC 배치·이동 등)도 썸네일 크롭이 나오도록 이벤트 좌표 diff를 합산한다.
  const beforeEvents = new Map(base.events.map((event) => [event.id, event]));
  const afterEvents = new Map(next.events.map((event) => [event.id, event]));
  for (const [id, event] of afterEvents) {
    const beforeEvent = beforeEvents.get(id);
    if (!beforeEvent || beforeEvent.x !== event.x || beforeEvent.y !== event.y) {
      grow(event.x, event.y);
    }
  }
  for (const [id, event] of beforeEvents) {
    if (!afterEvents.has(id)) grow(event.x, event.y);
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
  if (!map) {
    // 신규 생성 맵: before에 원본이 없어 before/after 비교가 불가하다 — 플레이스홀더 카드.
    const placeholder = el("div", {
      class: "ai-proposal-thumb ai-proposal-thumb-new-map",
      dataset: { testid: "ai-proposal-thumb-new-map" },
      children: [el("span", { class: "ai-proposal-thumb-label", text: "새 맵" })],
    });
    return placeholder;
  }
  const wrap = el("div", {
    class: "ai-proposal-thumb",
    attrs: { role: "img", "aria-label": `${kind === "before" ? "지금" : "적용 후"} 미니맵` },
    dataset: { testid: `ai-proposal-thumb-${kind}` },
    children: [
      el("span", { class: "ai-proposal-thumb-label", text: kind === "before" ? "지금" : "적용 후" }),
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
    sliceCtx.strokeStyle = kind === "after" ? "#4A57D6" : "#5B6472";
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

export interface ProposalAppliedResult {
  readonly mapId: MapId;
  readonly instruction: string;
  readonly summary: string;
}

export interface ProposalHostApi {
  pendingProposalMessage: ProposalMessageState | null;
  lastAppliedProposalMessage: ProposalMessageState | null;
  renderProposal: (
    result: TurnResult,
    extraWarnings?: readonly string[],
    assistantBubble?: HTMLElement | null,
    presentation?: ProposalPresentationMode,
  ) => void;
  acceptProposal: (calls: readonly ProposedCall[], selectedState?: readonly boolean[], hasEdits?: boolean, approveMaterials?: boolean) => void;
  rejectProposal: () => void;
  /** 이 호스트가 마지막으로 등록한 인라인 승인 actions가 여전히 현재 슬롯이면(CAS) 해제한다. */
  clearInlineActionsIfMine: () => void;
}

export function createProposalHost(options: {
  readonly proposalHost: HTMLElement;
  readonly pinHost: HTMLElement;
  readonly proposalNoticeHost: HTMLElement;
  readonly proposalModalCount: HTMLElement;
  readonly proposalPill: HTMLButtonElement;
  readonly proposalModalBody: HTMLElement;
  readonly getChatDock: () => ChatDock;
  readonly openProposalModal: (mode?: ProposalPresentationMode) => void;
  readonly closeProposalModal: () => void;
  readonly controller: ChatController;
  readonly appendBubble: (role: "user" | "assistant" | "tool" | "system", text: string) => HTMLElement;
  readonly setStatus: (text: string, record?: boolean) => void;
  readonly onApplied?: (result: ProposalAppliedResult) => void;
  /** 제안 적용/거부 직후 — AI 자동 펼침 패널을 다시 접을 때 사용. */
  readonly onProposalSettled?: () => void;
}): ProposalHostApi {
  const {
    proposalHost,
    pinHost,
    proposalNoticeHost,
    proposalModalCount,
    proposalPill,
    proposalModalBody,
    getChatDock,
    openProposalModal,
    closeProposalModal,
    controller,
    appendBubble,
    setStatus,
    onApplied,
    onProposalSettled,
  } = options;

  const mountProposalHost = (target: HTMLElement): void => {
    if (proposalHost.parentElement === target) return;
    proposalHost.remove();
    target.append(proposalHost);
  };

  const clearDecisionSurface = (): void => {
    proposalHost.replaceChildren();
    proposalHost.classList.remove("is-sticky-empty");
    clearProposalPin(pinHost);
    mountProposalHost(proposalModalBody);
    closeProposalModal();
  };

  let pendingProposalMessage: ProposalMessageState | null = null;
  let lastAppliedProposalMessage: ProposalMessageState | null = null;
  // 이 호스트가 마지막으로 setInlineProposalActions에 넘긴 객체 참조 — CAS 해제용(전역 슬롯 경합 방지).
  let myInlineActions: InlineProposalActions | null = null;
  const clearInlineActionsIfMine = (): void => {
    if (getInlineProposalActions() === myInlineActions) setInlineProposalActions(null);
    myInlineActions = null;
  };

  const applyAcceptedProposal = async (
    calls: readonly ProposedCall[],
    selected: readonly boolean[],
    selectedCalls: readonly ProposedCall[],
    hasEdits: boolean,
    approveMaterials = false,
  ): Promise<void> => {
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

    // soft-confirm 재료 합의는 옵션: approveMaterials=true 일 때만 origin:user.
    const softList = collectVocabSoftConfirms(calls, selected);
    const softMarked = approveMaterials
      ? markSoftVocabApprovalsOnProject(proposed, calls, selected)
      : 0;

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

    // 커밋 게이트 검증 → undo 스냅샷 → store.replace → await 커밋 로그는
    // 공유 적용 함수(applyProposedProject)가 수행한다 — 마일스톤 자동 적용과 같은 경로.
    const completionMapId = proposalPreviewMapId(selectedCalls, before, proposed)
      ?? currentHistoryMapId()
      ?? proposed.startMapId;
    const completionInstruction = instruction.split("\n\n[컨텍스트]")[0]?.trim() ?? instruction.trim();
    const completionSummary = proposalHumanSummaryLine(selectedCalls);
    clearAgentGhostPreview();
    const actualDiff = reassembled?.ok
      ? combineDiffs(reassembled.results.map((result) => result.diff))
      : summarizeChanges(before, proposed);
    const applied = await applyProposedProject(proposed, {
      source: "agent",
      agentName: loadAiConfig().model,
      summary: aiHistoryLabel(selectedCalls),
      toolNames: selectedCalls.map((call) => call.name),
      diff: actualDiff,
      snapshotLabel: aiHistoryLabel(selectedCalls),
      snapshotMapId: currentHistoryMapId(),
      resetProject: selectedCalls.some((call) => call.name === "reset_project"),
    });
    if (!applied.ok) {
      setStatus("적용 실패");
      toast(`적용 실패: ${applied.issue ?? "무결성 오류"}`, "error");
      return;
    }
    clearDecisionSurface();
    setStatus("대기");
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
    if (completionMapId && proposed.maps[completionMapId]) {
      onApplied?.({
        mapId: completionMapId,
        instruction: completionInstruction,
        summary: completionSummary,
      });
    }
    onProposalSettled?.();
  };

  const acceptProposal = (
    calls: readonly ProposedCall[],
    selectedState?: readonly boolean[],
    hasEdits = false,
    approveMaterials = false,
  ): void => {
    clearInlineActionsIfMine();
    const session = controller.session;
    if (!session) return;
    const selected = selectedState ? enforceProposalDependencies(selectedState, proposalDependencyIndexes(calls)) : calls.map(() => true);
    const selectedCalls = calls.filter((_, index) => selected[index]);
    if (selectedCalls.length === 0) return;
    const warnings = proposalApprovalWarnings(selectedCalls);
    const hasDestructive = selectedCalls.some((c) => c.destructive || c.name === "clear_region" || c.name === "remove_event" || c.name === "remove_map" || c.name === "delete_tile_group" || c.name === "reset_project");
    if (hasDestructive) {
      const plainToolNames = getEditorChrome().jargonStyle === "plain";
      const summary = selectedCalls
        .map((c) => `• ${plainToolNames ? sanitizeUserFacingToolId(c.summary || c.name) : c.summary || c.name}`)
        .join("\n");
      const msg = `파괴적 작업이 포함되어 있습니다 — 아래 내역을 확인하세요:\n${summary}\n\n체크박스는 기본 해제 상태입니다. 적용하려면 직접 체크 후 [확인 후 적용]을 누르세요.`;
      void showConfirm({ title: "파괴적 변경 — 3단 확인", message: msg, confirmLabel: "확인 후 적용" }).then((ok: boolean) => {
        if (ok) void applyAcceptedProposal(calls, selected, selectedCalls, hasEdits, approveMaterials);
      });
      return;
    }
    const decision = confirmRuleApproval(warnings);
    if (decision !== true) {
      void decision.then((confirmed) => {
        if (confirmed) void applyAcceptedProposal(calls, selected, selectedCalls, hasEdits, approveMaterials);
      });
      return;
    }
    void applyAcceptedProposal(calls, selected, selectedCalls, hasEdits, approveMaterials);
  };

  const rejectProposal = (): void => {
    clearInlineActionsIfMine();
    clearDecisionSurface();
    clearAgentGhostPreview();
    setStatus("제안 거부됨");
    setAssistantMessageBadge(pendingProposalMessage?.assistantBubble ?? null, "discarded");
    pendingProposalMessage = null;
    appendBubble("system", "제안을 거부하고 초안을 폐기했습니다.");
    controller.session?.rebaseProject(store.getCurrent());
    onProposalSettled?.();
  };

  const renderProposal = (
    result: TurnResult,
    extraWarnings: readonly string[] = [],
    assistantBubble: HTMLElement | null = null,
    requestedPresentation: ProposalPresentationMode = "modal",
  ): void => {
    const presentation = resolveProposalPresentation(requestedPresentation, getChatDock());
    const plainToolNames = getEditorChrome().jargonStyle === "plain";
    const userFacingToolText = (text: string): string =>
      plainToolNames ? sanitizeUserFacingToolId(text) : text;
    const lines = proposalSummaryLines(result.proposedCalls, extraWarnings).map(userFacingToolText);
    // 제안·경고 모두 없는 턴(순수 채팅 응답)은 기존 대기 카드를 건드리지 않는다.
    // 예전에는 여기서 replaceChildren 후 early return 해서 모달 헤더(N건)만 남고
    // 본문이 빈 껍데기로 남는 버그가 있었다(큐 연속 전송·후속 질문 시 재현).
    if (result.proposedCalls.length === 0 && lines.length === 0) return;

    clearDecisionSurface();

    if (result.proposedCalls.length === 0) {
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
        refreshProposalPinAccept(pinHost, count, result.proposedCalls.length);
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
          el("span", {
            class: "ai-proposal-item-main",
            text: userFacingToolText(call.summary || call.name),
          }),
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

    const humanSummary = proposalHumanSummaryLine(result.proposedCalls);
    const decisionTitle = proposalDecisionTitle(result.proposedCalls, result.assistantText);
    const dumpLines = lines.filter((line) => line !== humanSummary);
    const technicalLines = plainToolNames
      ? result.proposedCalls.map((call) => {
          const flag = call.destructive ? "⚠️ 파괴적 " : "";
          return `${flag}${sanitizeUserFacingToolId(call.name)} — ${userFacingToolText(call.summary)}`;
        })
      : proposalTechnicalDetailLines(result.proposedCalls);
    const dumpChildren: HTMLElement[] = [
      ...warnings.map((warning) => el("div", {
        class: "ai-proposal-warning",
        text: warning,
        dataset: { testid: "ai-proposal-warning" },
      })),
      ...dumpLines.map((line) => el("div", {
        class: "ai-proposal-warning",
        text: line,
        dataset: { testid: "ai-proposal-warning" },
      })),
      el("div", { class: "ai-proposal-items", children: itemElements }),
      ...(softConfirms.length > 0
        ? [el("div", {
            class: "ai-proposal-soft-vocab",
            dataset: { testid: "ai-proposal-soft-vocab" },
            children: [
              el("div", { class: "ai-proposal-soft-vocab-title", text: "배치 초안 + 미합의 재료" }),
              ...softConfirms.map((soft) => el("div", {
                class: "ai-proposal-soft-vocab-row",
                text: `${soft.name} (${soft.role}) · 타일 ${soft.tileIds.slice(0, 4).join(",")}${soft.tileIds.length > 4 ? "…" : ""}`,
              })),
              el("div", {
                class: "ai-proposal-soft-vocab-hint",
                text: "[이 맵에 넣기]는 배치만 반영합니다. [맵 적용 + 재료 합의]를 눌러야 재료가 origin:user로 영구 합의됩니다.",
              }),
            ],
          })]
        : []),
      ...(softConfirms.length > 0
        ? [el("button", {
            class: "ai-assistant-action ai-proposal-accept-materials",
            text: proposalAcceptWithMaterialButtonLabel(result.proposedCalls.length, result.proposedCalls.length),
            attrs: { type: "button" },
            dataset: { testid: "ai-proposal-accept-materials" },
            on: {
              click: () =>
                acceptProposal(
                  callsWithVocabularyEdits(result.proposedCalls, vocabEditsByCall),
                  selected,
                  hasVocabularyEdits(vocabEditsByCall),
                  true,
                ),
            },
          })]
        : []),
      el("div", {
        class: "ai-proposal-lines",
        dataset: { testid: "ai-proposal-technical-lines" },
        children: technicalLines.map((line) => el("div", { class: "ai-proposal-line", text: line })),
      }),
    ];
    const card = el("div", {
      class: `ai-proposal-card${hasDestructiveCall(result.proposedCalls) ? " is-destructive" : ""}`,
      dataset: { testid: "ai-proposal-card" },
      children: [
        el("div", { class: "ai-proposal-title", dataset: { testid: "ai-proposal-title" }, text: decisionTitle }),
        el("div", {
          class: "ai-proposal-summary",
          dataset: { testid: "ai-proposal-summary" },
          text: humanSummary,
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
        el("div", {
          class: "ai-proposal-actions",
          children: [
            renderAutoApproveToggle({
              checked: loadAiConfig().autoApprove === true,
              onChange: (next) => {
                saveAiConfig({ ...loadAiConfig(), autoApprove: next });
              },
            }),
            (acceptButton = el("button", {
              class: "ai-assistant-action ai-proposal-accept",
              text: proposalAcceptButtonLabel(result.proposedCalls.length, result.proposedCalls.length),
              attrs: { type: "button" },
              dataset: { testid: "ai-proposal-accept" },
              on: {
                click: () =>
                  acceptProposal(
                    callsWithVocabularyEdits(result.proposedCalls, vocabEditsByCall),
                    selected,
                    hasVocabularyEdits(vocabEditsByCall),
                    false,
                  ),
              },
            }) as HTMLButtonElement),
            (rejectButton = el("button", {
              class: "ai-assistant-action ai-proposal-reject",
              text: "취소",
              attrs: { type: "button" },
              dataset: { testid: "ai-proposal-reject" },
              on: { click: () => rejectProposal() },
            }) as HTMLButtonElement),
          ],
        }),
        el("details", {
          class: "ai-proposal-details",
          dataset: { testid: "ai-proposal-details" },
          children: [
            el("summary", {
              class: "ai-proposal-details-toggle",
              dataset: { testid: "ai-proposal-details-toggle" },
              text: proposalDetailsToggleLabel(result.proposedCalls.length),
            }),
            ...dumpChildren,
          ],
        }),
      ],
    });
    proposalCardEl = card;
    const modalTitle = proposalModalCount.parentElement?.querySelector(".ai-proposal-modal-title");
    if (modalTitle) modalTitle.textContent = decisionTitle;
    pendingProposalMessage = { calls: result.proposedCalls, assistantBubble, summary: humanSummary };
    setAssistantMessageBadge(assistantBubble, "proposal");
    if (presentation !== "inline") {
      replaceProposalPin(
        pinHost,
        {
          summary: humanSummary,
          selectedCount: result.proposedCalls.length,
          total: result.proposedCalls.length,
        },
        {
          onAccept: () => acceptProposal(
            callsWithVocabularyEdits(result.proposedCalls, vocabEditsByCall),
            selected,
            hasVocabularyEdits(vocabEditsByCall),
            false,
          ),
          onReject: () => rejectProposal(),
        },
      );
    }
    refreshSelectionUi();
    // 인라인 승인(캔버스 고스트 마커) — 카드의 실제 버튼 경로를 그대로 태운다.
    myInlineActions = {
      accept: () => { if (acceptButton && !acceptButton.disabled) acceptButton.click(); },
      reject: () => rejectButton?.click(),
      presentation: presentation === "canvas" ? "canvas-first" : "default",
      summary: humanSummary,
      focusCard: () => {
        if (presentation === "inline") {
          const focusInline = (): void => proposalCardEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
          if (typeof requestAnimationFrame === "function") requestAnimationFrame(focusInline);
          else focusInline();
          return;
        }
        mountProposalHost(proposalModalBody);
        openProposalModal("modal");
        const focus = (): void => proposalCardEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(focus);
        else focus();
      },
    };
    setInlineProposalActions(myInlineActions);
    if (presentation === "inline") mountProposalHost(pinHost);
    else mountProposalHost(proposalModalBody);
    proposalHost.append(card);
    proposalModalCount.textContent = `${result.proposedCalls.length}건`;
    proposalPill.textContent = presentation === "canvas"
      ? `맵에서 변경 ${result.proposedCalls.length}건 검토 중 — 전체 보기`
      : `변경 제안 ${result.proposedCalls.length}건 대기 — 검토`;
    if (presentation === "inline") closeProposalModal();
    else openProposalModal(presentation);
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
  };
}
