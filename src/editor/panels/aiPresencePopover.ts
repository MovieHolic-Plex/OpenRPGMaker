// editor/panels/aiPresencePopover.ts
// 조수 작업 상세 팝오버(.ai-status-pop) 단일 제어기 — 지도 위 「#N 시공 · …」 이름표와 지도 아래 상태 줄 칩이 함께 쓴다.
//
// 왜 공용인가:
//  - 오른쪽 도크가 열려 있을 때는 상태 줄(aiStatusBar)이 스스로 접힌다(conversationCardCovers).
//    그 상태에서도 지도 위 이름표(aiMapPresence)를 클릭하면 지금 무엇을 하고 있는지 그 자리에서 볼 수 있어야 한다.
//  - 두 표면이 같은 팝오버 하나를 공유하면 동시에 두 창이 겹치지 않고, 닫혀 있는 동안에는 구독·타이머 비용이 0 이다.

import { editorState } from "@/editor/editorState";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { selectEditorMap } from "@/editor/mapSelection";
import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";
import { reviewButtons } from "./aiJobActions";
import { currentPresences, isActive, stopPresence, subscribeAiPresence, type Presence } from "./aiPresence";
import { createStatusMemberCard, presenceInTeamRun } from "./aiStatusMemberCard";

export type PresencePopoverSource = "bar" | "map";
export type PresencePopoverPlacement = "above" | "auto";

export interface OpenPresencePopoverOptions {
  readonly source: PresencePopoverSource;
  readonly placement?: PresencePopoverPlacement;
  /** placement="above" 일 때 바닥 기준으로 삼는 바 요소(없으면 anchor 기준). */
  readonly barEl?: HTMLElement | null;
}

const GAP = 10;
const EDGE = 8;

type OpenListener = (state: { readonly id: string | null; readonly source: PresencePopoverSource | null }) => void;

const listeners = new Set<OpenListener>();
let pop: HTMLElement | null = null;
let card: ReturnType<typeof createStatusMemberCard> | null = null;
let openId: string | null = null;
let openSource: PresencePopoverSource | null = null;
let openPlacement: PresencePopoverPlacement = "auto";
let openAnchor: HTMLElement | null = null;
let openBar: HTMLElement | null = null;
let lastPresence: Presence | null = null;
let openMapId: string | null = null;
let offPresence: (() => void) | null = null;
let offEditor: (() => void) | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let docBound = false;

function notify(): void {
  const snapshot = { id: openId, source: openSource };
  for (const listener of [...listeners]) listener(snapshot);
}

function ensurePop(): HTMLElement {
  if (pop?.isConnected) return pop;
  card ??= createStatusMemberCard({
    onViewChange: (detail) => {
      if (pop) pop.dataset.detail = String(detail);
      if (lastPresence) {
        renderPop(lastPresence);
        repositionPresencePopover();
      }
    },
  });
  pop = el("div", {
    class: "ai-status-pop",
    dataset: { testid: "ai-status-pop", detail: String(card.isDetailMode()) },
    attrs: { role: "dialog", "aria-label": "조수 작업 상세", hidden: "" },
  });
  document.body.append(pop);
  return pop;
}

function locate(presence: Presence): void {
  if (!presence.mapId) return;
  if (presence.region) {
    focusEditorRegion(
      { mapId: presence.mapId, x: presence.region.x, y: presence.region.y, w: presence.region.width, h: presence.region.height },
      { highlight: true },
    );
  } else {
    selectEditorMap(presence.mapId, { checkoutForEditing: false });
  }
}

function renderPop(presence: Presence): void {
  const node = ensurePop();
  lastPresence = presence;
  node.dataset.tone = String(presence.tone);
  node.dataset.state = presence.state;
  node.dataset.detail = String(card!.isDetailMode());
  const actions: HTMLElement[] = [
    ...(presence.source === "chat" ? [el("button", {
      class: "ai-status-btn is-primary",
      attrs: { type: "button", title: "오른쪽 패널에서 이 조수의 전체 기록과 후속 요청 창을 엽니다" },
      dataset: { testid: "ai-status-detail" },
      children: [el("span", { text: "조수 상세 패널 열기" }), deckIcon("chevron-right", { size: 15 })],
      on: { click: () => {
        closePresencePopover();
        window.dispatchEvent(new CustomEvent("oprn:ai-open-team", { detail: { id: presence.id, agentId: presence.id } }));
      } },
    })] : []),
    ...reviewButtons(presence, closePresencePopover),
    ...(presence.mapId ? [el("button", {
      class: "ai-status-btn",
      attrs: { type: "button" },
      dataset: { testid: "ai-status-locate" },
      children: [deckIcon("map", { size: 15 }), el("span", { text: presence.mapId !== editorState.get().currentMapId ? "그 맵으로 이동" : "지도에서 보기" })],
      on: { click: () => locate(presence) },
    })] : []),
    ...(isActive(presence) ? [el("button", {
      class: "ai-status-btn is-stop",
      attrs: { type: "button", title: presenceInTeamRun(presence) ? "팀 실행 전체를 멈춥니다" : "이 작업을 멈춥니다" },
      dataset: { testid: "ai-status-pop-stop" },
      children: [deckIcon("stop", { size: 15 }), el("span", { text: presenceInTeamRun(presence) ? "팀 멈춤" : "멈춤" })],
      on: { click: () => { stopPresence(presence); closePresencePopover(); } },
    })] : []),
  ];
  node.replaceChildren(...card!.render(presence, actions, closePresencePopover));
}

function resolveOpenAnchor(): HTMLElement | null {
  if (openAnchor?.isConnected) return openAnchor;
  if (!openId) return null;
  const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(openId) : openId;
  if (openSource === "map") {
    return document.querySelector<HTMLElement>(`.ai-map-region-tag[data-presence-id="${escaped}"]`);
  }
  if (openSource === "bar") {
    return document.querySelector<HTMLElement>(`.ai-status-chip[data-presence-id="${escaped}"]`);
  }
  return null;
}

export function repositionPresencePopover(): void {
  if (!openId || !pop || pop.hidden) return;
  const anchor = resolveOpenAnchor();
  if (!anchor) { closePresencePopover(); return; }
  openAnchor = anchor;
  const anchorRect = anchor.getBoundingClientRect();
  if (anchorRect.width === 0 && anchorRect.height === 0) return;
  const popWidth = pop.offsetWidth || 420;
  const popHeight = pop.offsetHeight || 280;
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;

  if (openPlacement === "above") {
    const barRect = openBar?.isConnected ? openBar.getBoundingClientRect() : anchorRect;
    const left = Math.max(EDGE, Math.min(Math.round(anchorRect.left), vw - popWidth - EDGE));
    pop.style.left = `${left}px`;
    pop.style.top = "";
    pop.style.bottom = `${Math.max(EDGE, Math.round(vh - barRect.top + GAP))}px`;
    return;
  }

  // 지도 위 이름표: 시공 중인 드래그 영역을 가리지 않도록 영역 옆(오른쪽→왼쪽)→아래→위 순으로 배치하고,
  // 열린 오른쪽 AI 도크와 아래 상태 줄은 피한다.
  const dock = document.querySelector<HTMLElement>(".ai-right-dock .ai-chat-panel:not(.is-collapsed)");
  const dockLeft = dock ? dock.getBoundingClientRect().left : Infinity;
  const maxRight = Number.isFinite(dockLeft) && dockLeft > popWidth + EDGE * 2 ? dockLeft - EDGE : vw - EDGE;
  const bar = document.querySelector<HTMLElement>(".ai-status-bar:not([hidden])");
  const barTop = bar ? bar.getBoundingClientRect().top : Infinity;
  const maxBottom = Number.isFinite(barTop) && barTop > popHeight + EDGE * 2 ? barTop - GAP : vh - EDGE;
  const clampLeft = (value: number): number => Math.max(EDGE, Math.min(Math.round(value), Math.max(EDGE, maxRight - popWidth)));
  const clampTop = (value: number): number => Math.max(EDGE, Math.min(Math.round(value), Math.max(EDGE, maxBottom - popHeight)));

  const regionEl = anchor.closest<HTMLElement>(".ai-map-region:not(.is-cornered)");
  const regionRect = regionEl ? regionEl.getBoundingClientRect() : null;
  let left: number;
  let top: number;

  if (regionRect && regionRect.width > 0 && regionRect.height > 0) {
    const rightLeft = Math.round(regionRect.right + GAP);
    const leftLeft = Math.round(regionRect.left - popWidth - GAP);
    const belowTop = Math.round(regionRect.bottom + GAP);
    const aboveTop = Math.round(regionRect.top - popHeight - GAP);
    if (rightLeft + popWidth <= maxRight) {
      left = rightLeft;
      top = clampTop(regionRect.top);
    } else if (leftLeft >= EDGE) {
      left = leftLeft;
      top = clampTop(regionRect.top);
    } else if (belowTop + popHeight <= maxBottom) {
      left = clampLeft(regionRect.left);
      top = belowTop;
    } else if (aboveTop >= EDGE) {
      left = clampLeft(regionRect.left);
      top = aboveTop;
    } else {
      left = clampLeft(anchorRect.left);
      top = clampTop(anchorRect.bottom + GAP);
    }
  } else {
    left = clampLeft(anchorRect.left);
    const belowTop = Math.round(anchorRect.bottom + GAP);
    const aboveTop = Math.round(anchorRect.top - popHeight - GAP);
    top = belowTop + popHeight <= maxBottom
      ? belowTop
      : aboveTop >= EDGE
        ? aboveTop
        : clampTop(belowTop);
  }
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.style.bottom = "";
}

const onDocPointer = (event: PointerEvent): void => {
  if (!openId || !pop || pop.hidden) return;
  const target = event.target as Node | null;
  if (target && (pop.contains(target) || openAnchor?.contains(target))) return;
  if (target instanceof Element && (target.closest(".ai-status-chip") || target.closest(".ai-status-summary") || target.closest(".ai-map-region-tag"))) return;
  closePresencePopover();
};

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key === "Escape" && openId) {
    event.stopPropagation();
    closePresencePopover();
  }
};

const onResize = (): void => repositionPresencePopover();

function bindOpenLifecycle(): void {
  if (!docBound && typeof document !== "undefined" && typeof window !== "undefined") {
    docBound = true;
    document.addEventListener("pointerdown", onDocPointer, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
  }
  if (!offPresence) {
    offPresence = subscribeAiPresence(handlePresences);
  }
  if (!offEditor) {
    offEditor = editorState.subscribe(() => {
      if (openSource === "map" && openMapId && editorState.get().currentMapId !== openMapId) {
        closePresencePopover();
      }
    });
  }
  if (tickTimer === null && typeof window !== "undefined") {
    tickTimer = setInterval(() => card?.tick(), 1000);
  }
}

function unbindOpenLifecycle(): void {
  if (docBound && typeof document !== "undefined" && typeof window !== "undefined") {
    docBound = false;
    document.removeEventListener("pointerdown", onDocPointer, true);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onResize);
  }
  offPresence?.();
  offPresence = null;
  offEditor?.();
  offEditor = null;
  if (tickTimer !== null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function findMatchingPresence(presences: readonly Presence[]): Presence | undefined {
  if (!openId) return undefined;
  const direct = presences.find(item => item.id === openId);
  if (direct) return direct;
  // 준비 구간("run")에서 팝오버를 연 직후 에이전트가 생성되면 새 id 로 자연스럽게 이어받는다.
  if (openId === "run") {
    const handoff = presences.find(item => item.source === "chat" && item.drag)
      ?? presences.find(item => item.source === "chat" && !item.readsOnly);
    if (handoff) {
      openId = handoff.id;
      notify();
      return handoff;
    }
  }
  return undefined;
}

function handlePresences(presences: readonly Presence[]): void {
  if (!openId) return;
  const match = findMatchingPresence(presences);
  if (!match || (openSource === "map" && match.state === "applied")) {
    closePresencePopover();
    return;
  }
  if (match !== lastPresence) {
    renderPop(match);
    repositionPresencePopover();
  }
}

export function openPresencePopoverId(): string | null {
  return openId;
}

export function isPresencePopoverOpen(id: string): boolean {
  return openId === id;
}

export function subscribePresencePopover(listener: OpenListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function togglePresencePopover(
  id: string,
  anchor: HTMLElement,
  options: OpenPresencePopoverOptions,
): void {
  if (openId === id && openSource === options.source) {
    closePresencePopover();
    return;
  }
  const presences = currentPresences();
  const match = presences.find(item => item.id === id);
  if (!match) {
    closePresencePopover();
    return;
  }
  openId = id;
  openSource = options.source;
  openPlacement = options.placement ?? "auto";
  openAnchor = anchor;
  openBar = options.barEl ?? null;
  openMapId = editorState.get().currentMapId ?? null;
  const node = ensurePop();
  renderPop(match);
  node.hidden = false;
  bindOpenLifecycle();
  repositionPresencePopover();
  notify();
  // 오른쪽 조수 상세가 이미 펼쳐져 있으면 같은 조수로 맞춘다 — 접힌 도크를 억지로 열지는 않는다.
  if (presenceInTeamRun(match) && document.querySelector(".ai-team-sidebar:not(.is-collapsed):not([hidden])")) {
    window.dispatchEvent(new CustomEvent("oprn:ai-team-select", { detail: { id: match.id } }));
  }
}

export function closePresencePopover(): void {
  if (!openId && (!pop || pop.hidden)) return;
  openId = null;
  openSource = null;
  openAnchor = null;
  openBar = null;
  lastPresence = null;
  openMapId = null;
  if (pop) pop.hidden = true;
  unbindOpenLifecycle();
  notify();
}

export function closePresencePopoverBySource(source: PresencePopoverSource): void {
  if (openSource === source) closePresencePopover();
}

/** 테스트·언마운트 정리용 — 팝오버 DOM 과 구독을 완전히 거둔다. */
export function disposePresencePopover(): void {
  closePresencePopover();
  pop?.remove();
  pop = null;
  card = null;
}
