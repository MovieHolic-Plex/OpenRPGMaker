// editor/panels/aiProposalCard.ts
// 턴이 만든 변경을 즉시 적용하고 결과를 로그에 남긴다. 승인 카드([이 맵에 넣기]·[취소]),
// 항목 선택 체크박스, [앞으로 자동 적용] 토글, 검토 모달/핀은 없다 — 복구는 되돌리기다
// (근거는 @/ai/approvalPolicy 머리말). 패널 클로저 밖 의존성은 deps로 주입.

import {
  type ProposedCall,
  type TurnResult,
} from "@/ai/assistantSession";
import { loadAiConfig } from "@/ai/llmClient";
import { stripContextFooter } from "@/ai/modifyIntent";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { drawTransferFallback, drawTransferMapPreview } from "@/editor/panels/eventEditor/transferMapPreview";
import { summarizeChanges } from "@/editor/tools";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { clipMapCellsToRegion } from "@/editor/regionTask/clipToRegion";
import { reviewRegionDraft } from "@/editor/regionTask/harnessReview";
import type { TurnScope } from "@/ai/turnGuide";
import {
  formatLayoutRepairSummary,
  layoutRepairDidWork,
  repairLayoutPlacement,
} from "@/project/lint/layoutPlacementRepair";
import {
  formatLayoutValidationSummary,
  layoutValidationBlocking,
} from "@/project/lint/layoutPlacementValidate";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { ensureGuestIdentityForAiSurface } from "@/editor/teamWorkflowUi";
import { getEditorChrome } from "@/editor/editorUiMode";
import { sanitizeUserFacingToolId } from "@/editor/uiCopy";
import {
  collectVocabSoftConfirms,
  markSoftVocabApprovalsOnProject,
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

/** 이번 턴의 적용 조건 — 호출자(조수 패널)만 아는 것들. */
export interface ProposalApplyTurn {
  /** 주면 그 사각형이 이번 턴의 하드 클립 경계가 된다(선택 영역 작업). */
  readonly scope?: TurnScope | null;
  /**
   * 사용자가 실제로 입력한 지시문. 세션 감사 로그의 user 발화에는 턴 가이드가 붙어 있어
   * (sendText 가 지시 + 가이드 + footer 를 합친다) 거기서 되뽑으면 2KB 짜리 규칙문이
   * 배치 수리·작업 항목 정산의 키워드로 흘러든다. 그래서 호출자가 원문을 직접 넘긴다.
   */
  readonly instruction?: string;
}

export interface ProposalHostApi {
  pendingProposalMessage: ProposalMessageState | null;
  lastAppliedProposalMessage: ProposalMessageState | null;
  /** 변경 0건 턴의 안내(완성도 린트 경고 포함) — 적용할 것이 없을 때만 부른다. */
  noteNoChanges: (result: TurnResult, extraWarnings?: readonly string[]) => void;
  /** 실제로 적용되었을 때만 true — 호출자가 "적용됨" 로그를 붙이기 전에 이것을 기다린다. */
  applyProposal: (
    calls: readonly ProposedCall[],
    assistantBubble?: HTMLElement | null,
    turn?: ProposalApplyTurn | null,
  ) => Promise<boolean>;
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

  const applyProposal = async (
    calls: readonly ProposedCall[],
    assistantBubble: HTMLElement | null = null,
    turn: ProposalApplyTurn | null = null,
  ): Promise<boolean> => {
    const scope = turn?.scope ?? null;
    const session = controller.session;
    if (!session || calls.length === 0) return false;
    ensureGuestIdentityForAiSurface();
    const humanSummary = proposalHumanSummaryLine(calls);
    pendingProposalMessage = { calls, assistantBubble, summary: humanSummary };
    const before = store.getCurrent();
    const proposed = session.getProposedProject();
    // 재료(어휘) 합의도 AI 가 마무리한다 — 사람이 확정할 버튼이 없어졌고, 미합의로 남기면
    // 다음 턴이 같은 재료를 다시 제안한다. 되돌리면 배치와 함께 합의도 원복된다.
    const softList = collectVocabSoftConfirms(calls);
    const softMarked = markSoftVocabApprovalsOnProject(proposed, calls);

    // 배치 충돌은 사람에게 되돌리지 않는다. 물/벽 위 소품은 육지로 옮기거나 정리한다.
    //
    // 지시문은 **사용자 발화만** 쓴다. `[컨텍스트] 현재 맵: 숲 입구 …` footer 가 섞이면 맵 이름이
    // 나무 지시로 오인돼 배치 검증이 헛돌았다(assistantSession 의 의도 스캔과 같은 처리).
    // 호출자가 원문(turn.instruction)을 주면 그쪽이 정본이다 — 감사 로그의 발화에는 턴 가이드가
    // 붙어 있어 되뽑으면 규칙문 키워드가 섞인다. 폴백은 재시도·복구 경로용이다.
    const lastUser = [...(controller.session?.getAuditEntries() ?? [])].reverse().find((entry) => entry.kind === "user");
    const instruction = turn?.instruction?.trim()
      || stripContextFooter(lastUser && lastUser.kind === "user" ? lastUser.text : "");

    // ── 스코프(선택 영역) 하드 클립 ─────────────────────────────────────────────
    // 배치 수리 **앞**에 넣는다 — 클립으로 base 로 되돌린 칸을 repairLayoutPlacement 가 다시
    // 만지면 "영역 안에서만" 이 깨진다. 클립 계약상 **다른 맵은 통과**하므로 실내 신축처럼
    // 사각형 밖이 본업인 작업은 스코프가 걸려 있어도 살아남는다(clipToRegion 머리말).
    let candidate = proposed;
    let clippedCells = 0;
    if (scope) {
      const clip = clipMapCellsToRegion(before, candidate, scope.mapId, scope.region);
      candidate = clip.project;
      clippedCells = clip.clippedCells;
    }
    // 플레이 가능성 하네스: 경계 안 격리(문 없는 벽 등)를 정해진 횟수만 수리하고 나머지는
    // 경고로 남긴다. **적용을 막지 않는다** — 승인 게이트가 없는 정책(@/ai/approvalPolicy)에서
    // 하네스가 차단하면 사용자는 되돌릴 수도 없는 "아무 일도 안 일어남" 을 받는다.
    // 스코프가 없으면 검사할 사각형이 없어 건너뛴다(하네스는 region 인자를 요구한다).
    const harnessWarnings: string[] = [];
    if (scope) {
      const harness = reviewRegionDraft({
        base: before,
        draft: candidate,
        mapId: scope.mapId,
        region: scope.region,
      });
      candidate = harness.project;
      harnessWarnings.push(...harness.report.blockers);
    }

    const repaired = repairLayoutPlacement(candidate, {
      mapId: scope?.mapId ?? currentHistoryMapId() ?? undefined,
      ...(scope ? { region: scope.region } : {}),
      instruction,
      toolNames: calls.map((call) => call.name),
    });
    const layoutBlocking = layoutValidationBlocking(repaired.remaining);
    if (layoutBlocking.length > 0) {
      setStatus("배치 검증 실패");
      const summary = formatLayoutValidationSummary(repaired.remaining);
      appendBubble("system", `❌ ${summary}`);
      toast(summary, "error");
      return false;
    }
    const applyProject = repaired.project;

    // 커밋 게이트 검증 → undo 스냅샷 → store.replace → await 커밋 로그는
    // 공유 적용 함수(applyProposedProject)가 수행한다 — 마일스톤 자동 적용과 같은 경로.
    const completionMapId = proposalPreviewMapId(calls, before, applyProject)
      ?? currentHistoryMapId()
      ?? applyProject.startMapId;
    const completionInstruction = instruction.trim();
    // 행위 로그 라벨에 지시문을 남긴다 — "무엇을 시켰더니 이렇게 됐다" 가 조사의 출발점이다.
    // (영역 경로의 applyRegionProjectWithHistory 가 하던 일. 통합으로 채팅 턴도 같이 얻는다.)
    const historyLabel = aiHistoryLabel(calls, completionInstruction);
    clearAgentGhostPreview();
    const applied = await applyProposedProject(applyProject, {
      source: "agent",
      agentName: loadAiConfig().model,
      summary: historyLabel,
      toolNames: calls.map((call) => call.name),
      diff: summarizeChanges(before, applyProject),
      snapshotLabel: historyLabel,
      snapshotMapId: scope?.mapId ?? currentHistoryMapId(),
      resetProject: calls.some((call) => call.name === "reset_project"),
    });
    if (!applied.ok) {
      setStatus("적용 실패");
      toast(`적용 실패: ${applied.issue ?? "무결성 오류"}`, "error");
      return false;
    }
    setStatus("대기");
    setAssistantMessageBadge(assistantBubble, "applied");
    lastAppliedProposalMessage = pendingProposalMessage;
    pendingProposalMessage = null;
    const clipNote = clippedCells > 0 ? ` 선택 영역 밖 ${clippedCells}칸은 되돌렸습니다.` : "";
    appendBubble("system", `변경 ${calls.length}건을 프로젝트에 적용했습니다.${clipNote} 되돌리려면 [되돌리기](Ctrl+Z).`);
    if (layoutRepairDidWork(repaired.counts)) {
      appendBubble("system", formatLayoutRepairSummary(repaired.counts));
    }
    // 하네스 경고는 적용 뒤에 남긴다 — 막지 않았다는 사실을 문구로 분명히 한다.
    if (harnessWarnings.length > 0) {
      appendBubble("system", `⚠️ 플레이 가능성 경고(적용은 유지됨): ${harnessWarnings.join(" · ")}`);
    }
    // 차단하지 않는 배치 경고(예: 나무 0그루 판정)는 숨기지 않고 남긴다 — 타일은 이미 깔렸다.
    if (repaired.remaining.length > 0) {
      appendBubble("system", `⚠️ ${formatLayoutValidationSummary(repaired.remaining)}`);
    }
    if (softMarked > 0) {
      appendBubble("system", `재료 ${softMarked}건 합의: ${softList.map((entry) => entry.name).join(", ")}`);
    }
    toast("AI 변경안을 적용했습니다.", "ok");
    controller.session?.rebaseProject(store.getCurrent());
    if (completionMapId && applyProject.maps[completionMapId]) {
      onApplied?.({
        mapId: completionMapId,
        instruction: completionInstruction,
        summary: humanSummary,
      });
    }
    onProposalSettled?.();
    return true;
  };

  const noteNoChanges = (result: TurnResult, extraWarnings: readonly string[] = []): void => {
    if (result.proposedCalls.length > 0) return;
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
