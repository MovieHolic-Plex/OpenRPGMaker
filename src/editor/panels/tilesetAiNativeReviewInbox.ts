import {
  acceptHighConfidenceReview,
  acceptOneReviewProposal,
  activateTilesetAiReview,
  openReviewProposalCorrection,
  runTilesetAiReview,
  skipOneReviewProposal,
  updateReviewProposalFeedback,
} from "@/editor/tilesetAiNativeReviewSession";
import {
  aiReviewBuckets,
  proposalsForAiReview,
  summaryForAiReview,
  type TilesetAiReviewProposal,
  type TilesetAiReviewState,
} from "@/editor/tilesetAiNativeReviewModel";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

/** Immutable report presentation. No live session, image lookup, answer or apply handler. */
export function renderCapturedTilesetProposal(
  proposal: TilesetAiReviewProposal,
  selected: boolean,
  onSelect: (selected: boolean) => void,
): HTMLElement {
  const choice = el("input", { attrs: { type: "checkbox", "aria-label": proposal.name }, dataset: { proposalId: proposal.id } });
  choice.checked = selected;
  choice.addEventListener("change", () => onSelect(choice.checked));
  return el("article", { class: "ai-jobs-review-proposal", children: [
    el("label", { children: [choice, el("strong", { text: proposal.name }), el("span", { text: `${Math.round(proposal.confidence * 100)}%` })] }),
    el("p", { text: proposal.description || templateLabel(proposal) }),
    el("p", { text: `타일 ${proposal.tileIds.join(", ")} · ${templateLabel(proposal)}` }),
    el("details", { children: [el("summary", { text: "판단 근거" }), el("p", { text: proposal.evidence })] }),
  ] });
}

export function renderTilesetAiReviewInbox(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const state = activateTilesetAiReview(tileset);
  const buckets = aiReviewBuckets(state);
  const proposals = proposalsForAiReview(state).filter((proposal) => proposal.status === "pending");
  const busy = state.status === "analyzing" || state.status === "saving";
  return el("section", {
    class: `tileset-ai-review-inbox state-${state.status}`,
    dataset: { state: state.status, testid: "tileset-ai-review-inbox" },
    attrs: { "aria-busy": String(busy) },
    children: [
      el("header", {
        class: "tileset-ai-review-header",
        children: [
          el("div", {
            children: [
              el("span", { class: "tileset-ai-review-eyebrow", text: "AI FIRST" }),
              el("h3", { text: "AI 타일 지식" }),
              el("p", { text: "AI가 먼저 그림판 전체를 읽습니다. 확실한 것은 한 번에 적용하고, 애매한 것만 의견을 보태세요." }),
            ],
          }),
          ...(state.status === "idle" ? [] : [analysisButton(tileset, rerender, "다시 분석", busy)]),
        ],
      }),
      renderStateMessage(state, tileset, rerender),
      ...(proposals.length > 0 ? [
        el("div", {
          class: "tileset-ai-review-stats",
          attrs: { "aria-label": "AI 제안 신뢰도 요약" },
          children: [
            stat("확실함", buckets.high.length, "high"),
            stat("확인 필요", buckets.uncertain.length, "uncertain"),
            stat("낮은 확신", buckets.low.length, "low"),
          ],
        }),
        ...(buckets.high.length > 0 && state.status !== "stale" && !busy ? [el("button", {
          class: "database-footer-button primary tileset-ai-review-batch",
          text: `확실한 ${buckets.high.length}개 모두 적용`,
          attrs: { type: "button", ...(busy ? { disabled: "true" } : {}) },
          dataset: { testid: "tileset-ai-review-accept-high" },
          on: { click: () => { acceptHighConfidenceReview(tileset); rerender(); } },
        })] : []),
        el("div", {
          class: "tileset-ai-review-list",
          children: [...buckets.uncertain, ...buckets.low, ...buckets.high]
            .map((proposal) => renderProposalCard(tileset, proposal, state, rerender)),
        }),
      ] : []),
    ],
  });
}

function renderStateMessage(state: TilesetAiReviewState, tileset: TilesetDef, rerender: () => void): HTMLElement {
  if (state.status === "idle") {
    return el("div", {
      class: "tileset-ai-review-empty",
      children: [
        el("strong", { text: "그림판을 직접 분류하지 마세요" }),
        el("p", { text: "오토타일, 가구, 나무 레이어, 방향 통행, 반복 패턴을 AI가 먼저 묶고 근거를 제안합니다." }),
        analysisButton(tileset, rerender, "AI로 전체 분석", false),
      ],
    });
  }
  if (state.status === "analyzing") {
    return status("타일 그림판 이미지와 기존 지식을 함께 읽는 중입니다…", "working");
  }
  if (state.status === "offline" || state.status === "error") {
    return el("div", {
      class: `tileset-ai-review-status ${state.status}`,
      attrs: { role: "status" },
      dataset: { testid: "tileset-ai-review-status" },
      children: [
        el("strong", { text: state.status === "offline" ? "AI 연결이 필요합니다" : "분석을 마치지 못했습니다" }),
        el("span", { text: state.message }),
        ...(state.previousSummary ? [el("small", { text: `마지막 결과: ${state.previousSummary}` })] : []),
        analysisButton(tileset, rerender, "다시 시도", false),
      ],
    });
  }
  if (state.status === "stale") {
    return status("타일 그림판이 분석 이후 바뀌었습니다. 적용 전에 다시 분석해 주세요.", "warning");
  }
  const pending = proposalsForAiReview(state).filter((proposal) => proposal.status === "pending").length;
  const message = state.status === "saved" ? `${state.message} 남은 제안 ${pending}개.` : `${summaryForAiReview(state)} · 검토할 제안 ${pending}개`;
  return status(message, state.status === "partial" ? "warning" : "ready");
}

function renderProposalCard(
  tileset: TilesetDef,
  proposal: TilesetAiReviewProposal,
  state: TilesetAiReviewState,
  rerender: () => void,
): HTMLElement {
  const blocked = state.status === "stale" || state.status === "saving";
  const confidence = Math.round(proposal.confidence * 100);
  const feedback = el("input", {
    value: proposal.feedback,
    attrs: { type: "text", placeholder: "예: 윗부분은 상위 레이어예요", "aria-label": `${proposal.name}에 의견 추가` },
  });
  feedback.addEventListener("input", () => updateReviewProposalFeedback(tileset, proposal.id, feedback.value));
  feedback.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void runTilesetAiReview(tileset, rerender);
  });
  return el("article", {
    class: `tileset-ai-review-card confidence-${confidence >= 85 ? "high" : confidence >= 50 ? "uncertain" : "low"}`,
    dataset: { confidence: String(confidence), testid: `tileset-ai-review-card-${proposal.id}` },
    children: [
      el("div", {
        class: "tileset-ai-review-card-main",
        children: [
          renderTileStrip(tileset, proposal.tileIds),
          el("div", {
            class: "tileset-ai-review-card-copy",
            children: [
              el("div", {
                class: "tileset-ai-review-card-title",
                children: [el("strong", { text: proposal.name }), el("span", { text: `${confidence}%` })],
              }),
              el("p", { text: proposal.description || templateLabel(proposal) }),
              el("small", { text: `${proposal.tileIds.length}칸 · ${templateLabel(proposal)}` }),
            ],
          }),
        ],
      }),
      el("details", {
        class: "tileset-ai-review-why",
        children: [el("summary", { text: "왜 이렇게 봤나요?" }), el("p", { text: proposal.evidence })],
      }),
      el("label", {
        class: "tileset-ai-review-feedback",
        children: [
          el("span", { text: "AI에게 의견 보태기" }),
          feedback,
          el("small", { text: "의견은 다시 분석할 때 반영됩니다." }),
          el("button", {
            class: "database-footer-button",
            text: "의견 반영해 다시 분석",
            attrs: { type: "button" },
            dataset: { testid: `tileset-ai-review-feedback-submit-${proposal.id}` },
            on: { click: () => { void runTilesetAiReview(tileset, rerender); } },
          }),
        ],
      }),
      el("div", {
        class: "tileset-ai-review-card-actions",
        children: [
          el("button", {
            class: "database-footer-button primary",
            text: "맞음",
            attrs: { type: "button", ...(blocked ? { disabled: "true" } : {}) },
            dataset: { testid: `tileset-ai-review-confirm-${proposal.id}` },
            on: { click: () => { acceptOneReviewProposal(tileset, proposal.id); rerender(); } },
          }),
          el("button", {
            class: "database-footer-button",
            text: "수정",
            attrs: { type: "button" },
            dataset: { testid: `tileset-ai-review-edit-${proposal.id}` },
            on: { click: () => { openReviewProposalCorrection(tileset, proposal.id); rerender(); } },
          }),
          el("button", {
            class: "database-footer-button subtle",
            text: "모름 · 건너뛰기",
            attrs: { type: "button" },
            dataset: { testid: `tileset-ai-review-skip-${proposal.id}` },
            on: { click: () => { skipOneReviewProposal(tileset, proposal.id); rerender(); } },
          }),
        ],
      }),
    ],
  });
}

function analysisButton(tileset: TilesetDef, rerender: () => void, text: string, disabled: boolean): HTMLButtonElement {
  return el("button", {
    class: "database-footer-button primary tileset-ai-review-analyze",
    text,
    attrs: { type: "button", ...(disabled ? { disabled: "true" } : {}) },
    dataset: { testid: "tileset-ai-review-analyze" },
    on: { click: () => { void runTilesetAiReview(tileset, rerender); } },
  });
}

function renderTileStrip(tileset: TilesetDef, tileIds: readonly number[]): HTMLElement {
  return el("div", {
    class: "tileset-ai-review-tiles",
    attrs: { "aria-label": `타일 ${tileIds.join(", ")}` },
    children: tileIds.slice(0, 6).map((tile) => el("span", {
      class: "tileset-ai-review-tile",
      attrs: { style: tilesetTileBackgroundStyle(tileset, tile, "var(--ai-review-tile-size)"), title: `${tile}번 타일` },
    })),
  });
}

function stat(label: string, count: number, tone: string): HTMLElement {
  return el("div", { class: `tone-${tone}`, children: [el("strong", { text: String(count) }), el("span", { text: label })] });
}

function status(message: string, tone: string): HTMLElement {
  return el("div", {
    class: `tileset-ai-review-status ${tone}`,
    text: message,
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "tileset-ai-review-status" },
  });
}

function templateLabel(proposal: TilesetAiReviewProposal): string {
  const labels: Record<TilesetAiReviewProposal["template"], string> = {
    desk: "가구 · 책상",
    "one-way-path": "방향 통행 길",
    "repeatable-cliff-2x3": "반복 절벽 2×3",
    tree: "레이어 나무",
    "water-atlas-9x9": "물 아틀라스 9×9",
    "water-autotile-3x3": "물 오토타일 3×3",
  };
  return labels[proposal.template];
}
