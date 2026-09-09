// editor/panels/aiProposalCard.ts
// 턴이 만든 변경을 즉시 적용하고 결과를 로그에 남긴다. 승인 카드([이 맵에 넣기]·[취소]),
// 항목 선택 체크박스, [앞으로 자동 적용] 토글, 검토 모달/핀은 없다 — 복구는 되돌리기다
// (근거는 @/ai/approvalPolicy 머리말). 패널 클로저 밖 의존성은 deps로 주입.

import {
  type ProposedCall,
  type TurnResult,
} from "@/ai/assistantSession";
import { loadAiConfig } from "@/ai/llmClient";
import { stripContextFooter } from "@/ai/contextFooter";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { drawTransferFallback, drawTransferMapPreview } from "@/editor/panels/eventEditor/transferMapPreview";
import { summarizeChanges } from "@/editor/tools";
import { commitGateNotice } from "@/ai/aiGateNotice";
import { reviewOverInsertion } from "@/ai/overInsertionReview";
import { showAiGateNotice } from "@/editor/ui/aiGateModal";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import {
  formatLayoutValidationSummary,
  validateLayoutPlacement,
} from "@/project/lint/layoutPlacementValidate";
import type { LintIssue } from "@/project/lint/projectLint";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { ensureGuestIdentityForAiSurface } from "@/editor/teamWorkflowUi";
import { getEditorChrome } from "@/editor/editorUiMode";
import { sanitizeUserFacingToolId } from "@/editor/uiCopy";
import {
  collectVocabSoftConfirms,
} from "./aiProposalFusion";
import {
  proposalHumanSummaryLine,
  proposalSummaryLines,
} from "./aiProposalSummary";
import {
  aiHistoryLabel,
  currentHistoryMapId,
  EMPTY_PROPOSAL_NOTICE_DISMISS_MS,
  proposalPreviewMapId,
  renderEmptyProposalNotice,
  type ChatController,
} from "./aiChatPanelHelpers";

export type AiMessageBadgeState = "applied" | "reverted";

const AI_MESSAGE_BADGE_LABELS: Record<AiMessageBadgeState, string> = {
  applied: "적용됨",
  reverted: "되돌려짐",
};

export function setAssistantMessageBadge(bubble: HTMLElement | null, state: AiMessageBadgeState): void {
  if (!bubble) return;
  bubble.querySelector(".ai-msg-badge")?.remove();
  bubble.classList.remove("is-applied", "is-reverted");
  bubble.classList.add(`is-${state}`);
  const badge = el("span", {
    class: `ai-msg-badge is-${state}`,
    text: AI_MESSAGE_BADGE_LABELS[state],
    dataset: { testid: `ai-msg-badge-${state}` },
  });
  bubble.prepend(badge);
}

export type ProposalMapCrop = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/** before→after 타일 변경 bbox(+pad). 변경 카드 썸네일 crop 용. 이벤트 위치 변경도 bbox에 합산한다. */
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
  showLabel = true,
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
    class: `ai-proposal-thumb is-${kind}`,
    attrs: { role: "img", "aria-label": `${kind === "before" ? "지금" : "적용 후"} 미니맵` },
    dataset: { testid: `ai-proposal-thumb-${kind}` },
    children: [
      ...(showLabel
        ? [el("span", { class: "ai-proposal-thumb-label", text: kind === "before" ? "지금" : "적용 후" })]
        : []),
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

export type ProposalApplyOutcome = "applied" | "rejected";

export interface ProposalHostApi {
  pendingProposalMessage: ProposalMessageState | null;
  lastAppliedProposalMessage: ProposalMessageState | null;
  /** 변경 0건 턴의 안내(완성도 린트 경고 포함) — 적용할 것이 없을 때만 부른다. */
  noteNoChanges: (result: TurnResult, extraWarnings?: readonly string[]) => void;
  /** applied=반영됨, rejected=게이트 반려 — 호출자가 상태·정산을 가르기 위해 둘을 구분한다. 확인 팝업이 없으므로 취소 분기는 없다. */
  applyProposal: (calls: readonly ProposedCall[], assistantBubble?: HTMLElement | null) => Promise<ProposalApplyOutcome>;
}

export function createProposalHost(options: {
  readonly proposalNoticeHost: HTMLElement;
  readonly controller: ChatController;
  readonly appendBubble: (role: "user" | "assistant" | "tool" | "system", text: string) => HTMLElement;
  readonly setStatus: (text: string, record?: boolean) => void;
  readonly onApplied?: (result: ProposalAppliedResult) => void;
  /** 적용 직후 — AI 자동 펼침 패널을 다시 접을 때 사용. */
  readonly onProposalSettled?: () => void;
}): ProposalHostApi {
  const {
    proposalNoticeHost,
    controller,
    appendBubble,
    setStatus,
    onApplied,
    onProposalSettled,
  } = options;

  let pendingProposalMessage: ProposalMessageState | null = null;
  let lastAppliedProposalMessage: ProposalMessageState | null = null;
  const applyingCalls = new WeakSet<readonly ProposedCall[]>();

  const applyProposal = async (
    calls: readonly ProposedCall[],
    assistantBubble: HTMLElement | null = null,
  ): Promise<ProposalApplyOutcome> => {
    const session = controller.session;
    if (!session || calls.length === 0) return "rejected";
    if (!session.isDraftReviewApproved()) {
      appendBubble("system", "독립 검수가 승인되지 않았거나 초안이 바뀌어 적용하지 않았습니다.");
      setStatus("검수 미완료");
      return "rejected";
    }
    const operation = session.getRunOperation();
    const ownsApply = () => controller.session === session && session.getRunOperation() === operation && !operation.signal.aborted;
    if (!ownsApply() || applyingCalls.has(calls) || lastAppliedProposalMessage?.calls === calls) return "rejected";
    applyingCalls.add(calls);
    ensureGuestIdentityForAiSurface();
    const before = store.getCurrent();
    const base = session.getProposalBase();
    const proposed = session.getProposedProject();
    // 과삽입 검토는 기록만 남기고 적용은 멈추지 않는다 — 파괴·대량 변경도 바로 적용하고
    // 복구는 되돌리기다(2026-09: 변경 확인 팝업을 띄우지 않는 정책). 취소 분기는 없다.
    const review = reviewOverInsertion({
      calls,
      beforeMapCount: Object.keys(before.maps).length,
      afterMapCount: Object.keys(proposed.maps).length,
    });
    if (review.needsReview) {
      appendBubble(
        "system",
        `대량 변경 ${calls.length}건을 확인 없이 적용합니다 — ${review.reasons.join(" · ")} · 되돌리려면 [되돌리기](Ctrl+Z).`,
      );
    }
    const humanSummary = proposalHumanSummaryLine(calls);
    pendingProposalMessage = { calls, assistantBubble, summary: humanSummary };
    // 재료(어휘) 합의는 검수 전 세션이 초안에 새긴다(reviewCurrentDraft) — 승인 뒤에
    // 후보를 고치면 검수 대상과 적용 대상이 갈라진다(R2). 여기는 합의 건수만 세어 알린다.
    // 되돌리면 배치와 함께 합의도 원복된다(단일 undo 경계).
    const softList = collectVocabSoftConfirms(calls);
    const softMarked = softList.length;

    // 배치 검증은 진단이다. 적용을 막지도, AI 가 깐 타일을 옮기거나 지우지도 않는다.
    const lastUser = [...(controller.session?.getAuditEntries() ?? [])].reverse().find((entry) => entry.kind === "user");
    // 지시문은 **사용자 발화만** 쓴다. `[컨텍스트] 현재 맵: 숲 입구 …` footer 가 섞이면 맵 이름이
    // 나무 지시로 오인돼 배치 검증이 헛돌았다(assistantSession 의 의도 스캔과 같은 처리).
    const instruction = stripContextFooter(lastUser && lastUser.kind === "user" ? lastUser.text : "");
    // 영역작업(AI) 뒤의 검증게이트 배제(2026-08-30): 예전에는 여기서 repairLayoutPlacement 로
    // AI 배치를 옮기고 지운 뒤, 남은 error 로 적용 전체를 반려했다. 그 결과 사용자에게는
    // "아무것도 안 됐다" 또는 "깐 게 사라졌다" 만 남았다. 이제 사실만 계산해 적용 후 알린다.
    // 진단기가 예외를 던져도 적용은 진행한다 — 검증기 사고는 AI 작업물을 볼모로 잡을 이유가 아니다.
    let layoutIssues: readonly LintIssue[] = [];
    try {
      layoutIssues = validateLayoutPlacement(proposed, {
        mapId: currentHistoryMapId() ?? undefined,
        instruction,
        toolNames: calls.map((call) => call.name),
      });
    } catch (cause) {
      console.warn("[aiProposal] 배치 진단에 실패했지만 적용은 진행합니다:", cause);
    }
    const applyProject = proposed;

    // 커밋 게이트 검증 → undo 스냅샷 → store.replace → await 커밋 로그는
    // 공유 적용 함수(applyProposedProject)가 수행한다 — 마일스톤 자동 적용과 같은 경로.
    const completionMapId = proposalPreviewMapId(calls, before, applyProject)
      ?? currentHistoryMapId()
      ?? applyProject.startMapId;
    const completionInstruction = instruction.trim();
    clearAgentGhostPreview();
    await session.prepareCheckpointApply();
    if (!ownsApply()) return "rejected";
    const applied = await applyProposedProject(applyProject, {
      base,
      operation,
      onApplied: applied => {
        if (controller.session !== session || session.getRunOperation() !== operation) return;
        session.recordAppliedMutation(applied);
      },
      baseline: session.getDraftBaseline(),
      source: "agent",
      agentName: loadAiConfig().model,
      summary: aiHistoryLabel(calls),
      toolNames: calls.map((call) => call.name),
      diff: summarizeChanges(before, applyProject),
      snapshotLabel: aiHistoryLabel(calls),
      snapshotMapId: currentHistoryMapId(),
      resetProject: calls.some((call) => call.name === "reset_project"),
      reason: calls.map((call) => call.reason).filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" · ") || `AI 제안 적용: ${aiHistoryLabel(calls)}`,
    });
    if (!ownsApply()) return applied.ok ? "applied" : "rejected";
    if (!applied.ok) {
      if (applied.reason === "stale-baseline") session.refreshAcceptance(store.getCurrent());
      session.recordApplyRejected(undefined, applied.reason);
      setStatus("적용 실패");
      toast(`적용 실패: ${applied.issue ?? "무결성 오류"}`, "error");
      if (applied.reason === "stale-base") {
        appendBubble("system", applied.issue ?? "기준 프로젝트가 변경되었습니다. 최신 편집을 기준으로 다시 요청해주세요.");
        return "rejected";
      }
      // 예전에는 이 게이트만 채팅에 아무 기록도 남기지 않았다 — 토스트가 사라지면 흔적이 없다.
      appendBubble("system", `무결성 검사에 막혀 적용하지 않았습니다: ${applied.issue ?? "무결성 오류"}`);
      showAiGateNotice(commitGateNotice(applied.issues ?? (applied.issue ? [applied.issue] : [])));
      return "rejected";
    }
    session.recordAppliedProject(applied);
    if (!ownsApply()) return "applied";
    setStatus("대기");
    setAssistantMessageBadge(assistantBubble, "applied");
    lastAppliedProposalMessage = pendingProposalMessage;
    pendingProposalMessage = null;
    appendBubble("system", `변경 ${calls.length}건을 프로젝트에 적용했습니다. 되돌리려면 [되돌리기](Ctrl+Z).`);
    if (applied.wikiWarning) appendBubble("system", `게임 변경은 적용됐지만 위키 진행 기록은 갱신하지 못했습니다: ${applied.wikiWarning}`);
    // 배치 진단은 숨기지 않고 남긴다 — 타일은 이미 깔렸고, 마음에 안 들면 되돌리기가 답이다.
    if (layoutIssues.length > 0) {
      appendBubble("system", `배치 진단: ${formatLayoutValidationSummary(layoutIssues)}`);
    }
    if (softMarked > 0) {
      appendBubble("system", `재료 ${softMarked}건 합의: ${softList.map((entry) => entry.name).join(", ")}`);
    }
    toast("AI 변경안을 적용했습니다.", "ok");
    session.rebaseProject(store.getCurrent());
    if (completionMapId && applyProject.maps[completionMapId]) {
      onApplied?.({
        mapId: completionMapId,
        instruction: completionInstruction,
        summary: humanSummary,
      });
    }
    onProposalSettled?.();
    return "applied";
  };

  const noteNoChanges = (result: TurnResult, extraWarnings: readonly string[] = []): void => {
    if (result.proposedCalls.length > 0 || (result.appliedCalls?.length ?? 0) > 0) return;
    const plainToolNames = getEditorChrome().jargonStyle === "plain";
    const lines = proposalSummaryLines(result.proposedCalls, extraWarnings)
      .map((line) => (plainToolNames ? sanitizeUserFacingToolId(line) : line));
    if (lines.length === 0) return;
    appendBubble("system", ["변경 제안 없음(0건) — 완성도 린트:", ...lines].join("\n"));
    const notice = renderEmptyProposalNotice(lines, () => notice.remove());
    proposalNoticeHost.append(notice);
    if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
      window.setTimeout(() => notice.remove(), EMPTY_PROPOSAL_NOTICE_DISMISS_MS);
    }
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
    noteNoChanges,
    applyProposal,
  };
}
