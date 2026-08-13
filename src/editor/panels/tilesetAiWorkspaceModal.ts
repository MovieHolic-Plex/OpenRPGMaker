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
} from "@/editor/tilesetAiConversationSession";
import { aiReviewBuckets, proposalsForAiReview } from "@/editor/tilesetAiNativeReviewModel";
import { runTilesetAiReview, tilesetAiReviewState } from "@/editor/tilesetAiNativeReviewSession";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

let activeHost: HTMLElement | null = null;
let activeTilesetId: string | null = null;
let atlasFilter: TilesetAiAtlasFilter = "all";
let atlasZoom: TilesetAiAtlasZoom = 3;
let onProjectChange: (() => void) | null = null;
let returnFocus: HTMLElement | null = null;
let returnFocusTestId: string | null = null;

export function openTilesetAiWorkspace(tilesetId: string, projectChanged?: () => void): void {
  closeTilesetAiWorkspace();
  activeTilesetId = tilesetId;
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
  window.addEventListener("resize", handleWorkspaceResize);
  renderActiveWorkspace();
  const tileset = currentTileset();
  if (tileset && tilesetAiReviewState(tileset).status === "idle") void runTilesetAiReview(tileset, renderActiveWorkspace);
}

export function closeTilesetAiWorkspace(): void {
  document.removeEventListener("keydown", handleWorkspaceKeydown);
  window.removeEventListener("resize", handleWorkspaceResize);
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

function renderActiveWorkspace(): void {
  if (!activeHost) return;
  const tileset = currentTileset();
  if (!tileset) {
    closeTilesetAiWorkspace();
    return;
  }
  const snapshot = conversationSnapshot(tileset);
  const proposals = proposalsForAiReview(snapshot.state);
  const buckets = aiReviewBuckets(snapshot.state);
  const confirmed = proposals.filter((proposal) => proposal.status === "accepted").length;
  const busy = snapshot.state.status === "analyzing" || snapshot.state.status === "saving";
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
    dataset: { state: snapshot.state.status, testid: "tileset-ai-workspace" },
    children: [
      renderWorkspaceHeader(tileset, confirmed, buckets.uncertain.length, buckets.low.length),
      el("div", {
        class: "tileset-ai-workspace-body",
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
            snapshot,
            tileset,
          }),
        ],
      }),
      renderWorkspaceFooter(tileset, confirmed, busy),
    ],
  }));
  if (!snapshot.current && snapshot.turns.length > 0) scrollConversationToLatest(activeHost);
  restoreTilesetAiWorkspaceFocus(activeHost);
}

function renderWorkspaceHeader(tileset: TilesetDef, confirmed: number, questions: number, unclassified: number): HTMLElement {
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
              el("p", { text: `${tileset.name} · 전체를 먼저 읽고, 애매한 부분만 질문합니다.` }),
            ],
          }),
        ],
      }),
      el("div", {
        class: "tileset-ai-workspace-meta",
        children: [
          el("span", { class: "tileset-ai-workspace-draft", text: "대화형 분석 · 아직 적용되지 않음" }),
          el("span", { text: `확정 ${confirmed}` }),
          el("span", { text: `질문 ${questions}` }),
          el("span", { text: `미분류 ${unclassified}` }),
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

function renderWorkspaceFooter(tileset: TilesetDef, confirmed: number, busy: boolean): HTMLElement {
  const state = tilesetAiReviewState(tileset);
  const current = conversationSnapshot(tileset).current;
  const alreadyApplied = state.status === "saved";
  const cannotApply = confirmed === 0 || busy || state.status === "stale" || alreadyApplied;
  return el("footer", {
    class: "tileset-ai-workspace-footer",
    children: [
      el("div", {
        class: "tileset-ai-workspace-footer-left",
        children: [
          el("button", {
            class: "database-footer-button",
            text: "질문 건너뛰기",
            attrs: { type: "button", ...(!current || busy ? { disabled: "true" } : {}) },
            dataset: { testid: "tileset-ai-workspace-skip" },
            on: { click: () => { skipTilesetAiQuestion(tileset); renderActiveWorkspace(); } },
          }),
          el("button", {
            class: "database-footer-button",
            text: "다시 전체 분석",
            attrs: { type: "button", ...(busy ? { disabled: "true" } : {}) },
            dataset: { testid: "tileset-ai-workspace-reanalyze" },
            on: { click: () => { void runTilesetAiReview(tileset, renderActiveWorkspace); } },
          }),
        ],
      }),
      el("span", {
        class: `tileset-ai-workspace-status ${state.status}`,
        text: workspaceStatusText(state.status, confirmed),
        attrs: { role: "status", "aria-live": "polite", tabindex: "-1" },
        dataset: { testid: "tileset-ai-workspace-status" },
      }),
      el("button", {
        class: "database-footer-button primary tileset-ai-workspace-apply",
        text: alreadyApplied ? `${confirmed}개 적용됨` : `확정된 ${confirmed}개 적용`,
        attrs: { type: "button", ...(cannotApply ? { disabled: "true" } : {}) },
        dataset: { testid: "tileset-ai-workspace-apply" },
        on: { click: () => {
          const applied = applyConfirmedTilesetAiKnowledge(tileset);
          if (applied > 0) onProjectChange?.();
          renderActiveWorkspace();
        } },
      }),
    ],
  });
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

function handleWorkspaceResize(): void {
  if (!activeHost || activeHost.querySelector(".tileset-ai-question-card")) return;
  scrollConversationToLatest(activeHost);
}
