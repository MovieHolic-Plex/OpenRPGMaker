// editor/panels/aiWorkStrip.ts
// 조수가 한 일을 캔버스 하단 가로 띠에 카드로 쌓는다(방향 G, 2026-09-17).
//
// 대화 창에는 말풍선과 질문만 남긴다. 도구 활동·단계·변경 카드(전→후)·되돌리기는 전부 이 띠로 온다.
// 띠는 토스트 스택과 같은 좌하단 앵커를 쓴다 — 오래된 카드가 왼쪽, 최신 카드가 오른쪽(조수 창 옆).
// 카드 하나를 펼치면 나머지는 썸네일 칩으로 줄어들고, 머리 알약으로 띠 전체를 접을 수 있다.
//
// DOM 계약(테스트·e2e):
//  - `ai-work-strip`            띠 루트(document.body 직속, 카드가 없으면 hidden).
//  - `ai-work-strip-toggle`     머리 알약 「조수가 한 일 N」 — 띠 접기/펼치기.
//  - `ai-work-card`             카드. dataset.state = running | done | failed.
//  - `ai-work-card-stop`        진행 중 카드의 「■ 중지」.
//  - `ai-work-card-locate`      완료 카드의 「맵에서 보기」.
//  - `ai-work-card-undo`        완료 카드의 「이 작업만 되돌리기」.
//  - 진행 중 도구 행(`ai-activity-live`)과 완료 행(`ai-tool-entry`)은 카드의 단계 목록에 들어간다.

import { changePreviewRegion, renderChangePreviewCard, renderChangeThumb, type ChangePreviewInput } from "@/editor/panels/aiChangePreview";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { el } from "@/util/dom";

/** 동시에 보여 줄 카드 수. 넘치면 오래된 것부터 「+N」 뒤로 숨긴다. */
export const AI_WORK_STRIP_MAX_VISIBLE = 5;

export interface AiWorkCardFinish {
  readonly ok: boolean;
  /** 실패·중단 사유 한 줄. */
  readonly message?: string;
}

export interface AiWorkCard {
  recordActivity?(event: import("@/ai/piAgent/protocol").PiAgentEvent): void;
  readonly root: HTMLElement;
  /** 진행 중 도구 행이 머무는 자리(카드 접힘 상태에서도 보인다). */
  readonly live: HTMLElement;
  /** 완료된 도구 행 목록(펼친 카드에서 보인다). */
  readonly steps: HTMLElement;
  setTitle(title: string): void;
  /**
   * 지금 하는 일 한 문장(패널 상태 문장과 같은 것). 머리 줄의 상태 칸은 90px 라 「작업 중…」 으로
   * 잘려 「검수하는 중」 같은 문장이 어디에도 보이지 않았다 — 카드가 전문을 보여 준다.
   */
  setStatusLine?(text: string): void;
  /** 진행률. total 이 없으면 무한 진행 막대. */
  setProgress(done: number, total?: number | null): void;
  /** 조회성 성공 도구는 행을 남기지 않고 개수만 센다. */
  noteReadOnly(): void;
  /** 쓰기·실패 행을 단계 목록에 붙인다. */
  appendStep(entry: HTMLElement): void;
  /** 변경 카드(전→후·명세·되돌리기)를 이 작업에 붙인다. 카드 그림은 펼칠 때 그린다. */
  attachChange(preview: ChangePreviewInput): void;
  /** 이미 그려진 요소(팀 보드 등)를 펼친 보기에 붙인다. 카드는 비어 있지 않은 것으로 친다. */
  attachElement(element: HTMLElement): void;
  finish(result: AiWorkCardFinish): void;
  /** 이 카드가 사용자에게 보여 줄 게 없으면(조회만·변경 없음) 띠에서 뺀다. */
  discardIfEmpty(): boolean;
}

interface CardState {
  readonly root: HTMLElement;
  readonly title: HTMLElement;
  readonly meta: HTMLElement;
  readonly thumb: HTMLElement;
  readonly live: HTMLElement;
  readonly steps: HTMLElement;
  readonly stepCount: HTMLElement;
  readonly bar: HTMLElement;
  readonly barFill: HTMLElement;
  readonly actions: HTMLElement;
  readonly detail: HTMLElement;
  readonly changeHost: HTMLElement;
  readonly extrasHost: HTMLElement;
  readonly stepsHead: HTMLElement;
  state: "running" | "done" | "failed";
  readCount: number;
  writeCount: number;
  preview: ChangePreviewInput | null;
  readonly extras: HTMLElement[];
  detailRendered: boolean;
  open: boolean;
}

let stripEl: HTMLElement | null = null;
let headToggle: HTMLElement | null = null;
let headCount: HTMLElement | null = null;
let overflowChip: HTMLElement | null = null;
let cardsHost: HTMLElement | null = null;
let cards: CardState[] = [];
let folded = false;
let showAll = false;
let seq = 0;
let anchorListenerInstalled = false;

/** 띠의 왼쪽 끝은 캔버스 왼쪽(좌패널 오른쪽)이다 — 패널 폭은 도크 레이아웃이 정하므로 CSS 상수로 못 박지 않고 잰다. */
function syncAnchor(): void {
  if (!stripEl) return;
  const canvas = document.querySelector<HTMLElement>('[data-testid="edit-canvas"]');
  const rect = typeof canvas?.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
  if (rect && rect.width > 0) stripEl.style.setProperty("--ai-work-strip-left", `${Math.round(rect.left)}px`);
}

function ensureStrip(): HTMLElement {
  if (stripEl && stripEl.parentNode === document.body) return stripEl;
  cards = [];
  headCount = el("span", { class: "ai-work-strip-count", text: "0" });
  headToggle = el("button", {
    class: "ai-work-strip-toggle",
    attrs: { type: "button", "aria-expanded": "true", title: "조수가 한 일 접기/펼치기" },
    dataset: { testid: "ai-work-strip-toggle" },
    children: [
      el("span", { class: "ai-work-strip-toggle-label", text: "조수가 한 일" }),
      headCount,
      el("span", { class: "ai-work-strip-toggle-chevron", attrs: { "aria-hidden": "true" }, text: "⌄" }),
    ],
    on: {
      click: () => {
        folded = !folded;
        applyLayout();
      },
    },
  });
  overflowChip = el("button", {
    class: "ai-work-strip-overflow",
    attrs: { type: "button", title: "숨긴 카드 모두 보기" },
    dataset: { testid: "ai-work-strip-overflow" },
    text: "+0",
    on: {
      click: () => {
        showAll = !showAll;
        applyLayout();
      },
    },
  });
  cardsHost = el("div", { class: "ai-work-strip-cards", dataset: { testid: "ai-work-strip-cards" } });
  stripEl = el("aside", {
    class: "ai-work-strip",
    attrs: { "aria-label": "조수가 한 일" },
    dataset: { testid: "ai-work-strip" },
    children: [headToggle, overflowChip, cardsHost],
  });
  stripEl.hidden = true;
  document.body.append(stripEl);
  if (!anchorListenerInstalled && typeof window !== "undefined" && typeof window.addEventListener === "function") {
    anchorListenerInstalled = true;
    window.addEventListener("resize", syncAnchor);
  }
  return stripEl;
}

/** 가시 카드·펼침·접힘·오버플로를 한 번에 계산한다. 상태 변화는 전부 여기로 모인다. */
function applyLayout(): void {
  if (!stripEl || !cardsHost || !headToggle || !headCount || !overflowChip) return;
  stripEl.hidden = cards.length === 0;
  // 토스트를 띠 위로 올리는 CSS 가 body:has() 대신 이 클래스를 본다.
  document.body.classList.toggle("has-ai-work-strip", !stripEl.hidden);
  syncAnchor();
  stripEl.classList.toggle("is-folded", folded);
  headToggle.setAttribute("aria-expanded", String(!folded));
  headCount.textContent = String(cards.length);
  const running = cards.some((card) => card.state === "running");
  stripEl.classList.toggle("is-running", running);

  const hiddenCount = showAll ? 0 : Math.max(0, cards.length - AI_WORK_STRIP_MAX_VISIBLE);
  overflowChip.hidden = hiddenCount === 0 && !showAll;
  overflowChip.textContent = showAll ? "접기" : `+${hiddenCount}`;
  const opened = cards.find((card) => card.open) ?? null;
  stripEl.classList.toggle("has-open", opened !== null);
  cards.forEach((card, index) => {
    card.root.hidden = index < hiddenCount;
    card.root.classList.toggle("is-open", card === opened);
    card.root.classList.toggle("is-mini", opened !== null && card !== opened);
    card.root.setAttribute("aria-expanded", String(card === opened));
  });
  if (opened && !opened.detailRendered) renderDetail(opened);
}

/** 펼친 보기 채우기 — 변경 카드는 캔버스 두 장을 그리므로 펼칠 때 한 번만 만든다. 단계 목록은 항상 DOM 에 있다. */
function renderDetail(card: CardState): void {
  card.detailRendered = true;
  card.changeHost.replaceChildren(...(card.preview ? [renderChangePreviewCard(card.preview)] : []));
  card.extrasHost.replaceChildren(...card.extras);
  card.stepsHead.textContent = card.writeCount > 0
    ? `작업 ${card.writeCount}단계`
    : (card.readCount > 0 ? `조회 ${card.readCount}건` : "단계 없음");
}

function cardMetaText(card: CardState): string {
  const parts: string[] = [];
  if (card.preview?.chips?.length) parts.push(card.preview.chips.slice(0, 3).join(" · "));
  else if (card.writeCount > 0) parts.push(`작업 ${card.writeCount}단계`);
  if (card.readCount > 0 && card.writeCount === 0 && !card.preview) parts.push(`조회 ${card.readCount}건`);
  return parts.join(" · ");
}

/** 동작 버튼 라벨 — 접힌 카드(146px)엔 짧게, 펼친 카드엔 온전히. CSS 가 둘 중 하나만 보인다. */
function actionLabel(short: string, full: string): HTMLElement[] {
  return [
    el("span", { class: "ai-work-card-action-short", text: short }),
    el("span", { class: "ai-work-card-action-full", text: full }),
  ];
}

function toggleOpen(card: CardState): void {
  const next = !card.open;
  for (const other of cards) other.open = false;
  card.open = next;
  applyLayout();
}

function removeCard(card: CardState): void {
  card.root.remove();
  cards = cards.filter((candidate) => candidate !== card);
  applyLayout();
}

export function beginAiWorkCard(input: { readonly title: string; readonly onStop?: () => void }): AiWorkCard {
  const strip = ensureStrip();
  seq += 1;
  const title = el("div", { class: "ai-work-card-title", text: input.title || "작업 중", attrs: { title: input.title } });
  const meta = el("div", { class: "ai-work-card-meta", dataset: { testid: "ai-work-card-meta" } });
  const thumb = el("div", { class: "ai-work-card-thumb", attrs: { "aria-hidden": "true" } });
  const live = el("div", { class: "ai-work-card-live" });
  const steps = el("div", { class: "ai-work-card-steps", dataset: { testid: "ai-work-card-steps" } });
  const stepCount = el("span", { class: "ai-work-card-step-count", dataset: { testid: "ai-work-card-step-count" } });
  const barFill = el("i", { class: "ai-work-card-bar-fill" });
  const bar = el("div", {
    class: "ai-work-card-bar is-indeterminate",
    attrs: { role: "progressbar", "aria-label": "작업 진행" },
    children: [barFill],
  });
  const actions = el("div", { class: "ai-work-card-actions" });
  const changeHost = el("div", { class: "ai-work-card-change" });
  const extrasHost = el("div", { class: "ai-work-card-extras" });
  const stepsHead = el("div", { class: "ai-work-card-steps-head" });
  const detail = el("div", {
    class: "ai-work-card-detail",
    dataset: { testid: "ai-work-card-detail" },
    children: [changeHost, extrasHost, stepsHead, steps],
  });
  const body = el("div", {
    class: "ai-work-card-body",
    children: [
      el("div", { class: "ai-work-card-head", children: [thumb, el("div", { class: "ai-work-card-text", children: [title, meta] })] }),
      live,
      bar,
      el("div", { class: "ai-work-card-foot", children: [stepCount, actions] }),
    ],
  });
  const root = el("article", {
    class: "ai-work-card",
    dataset: { testid: "ai-work-card", state: "running", workId: String(seq) },
    attrs: { "aria-expanded": "false", tabindex: "0" },
    children: [body, detail],
  });
  const card: CardState = {
    root, title, meta, thumb, live, steps, stepCount, bar, barFill, actions, detail, changeHost, extrasHost, stepsHead,
    state: "running", readCount: 0, writeCount: 0, preview: null, extras: [], detailRendered: false, open: false,
  };
  // 카드 본문 클릭 = 펼치기. 버튼·링크 클릭은 각자 일이다.
  body.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("button, a, details, summary")) return;
    toggleOpen(card);
  });
  root.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    if (event.target !== root) return;
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      toggleOpen(card);
    }
  });
  if (input.onStop) {
    const onStop = input.onStop;
    actions.append(el("button", {
      class: "ai-work-card-action ai-work-card-stop",
      attrs: { type: "button", title: "이 작업을 중지합니다" },
      dataset: { testid: "ai-work-card-stop" },
      text: "■ 중지",
      on: { click: () => onStop() },
    }));
  }
  thumb.append(el("span", { class: "ai-work-card-spinner ai-deck-spin", attrs: { "aria-hidden": "true" } }));

  const refreshStepCount = (): void => {
    stepCount.textContent = card.writeCount > 0 ? `${card.writeCount}단계` : (card.readCount > 0 ? `조회 ${card.readCount}` : "");
    meta.textContent = cardMetaText(card);
  };

  cards.push(card);
  cardsHost?.append(root);
  // 새 카드가 오면 「+N」 뒤에 숨긴 것들은 그대로 두고, 펼친 카드는 닫는다 — 새 일이 주인공이다.
  for (const other of cards) other.open = false;
  showAll = false;
  folded = false;
  applyLayout();
  void strip;

  return {
    root,
    live,
    steps,
    setTitle: (next) => {
      title.textContent = next || title.textContent;
      title.setAttribute("title", next);
    },
    setProgress: (done, total) => {
      if (typeof total === "number" && total > 0) {
        bar.classList.remove("is-indeterminate");
        const ratio = Math.max(0, Math.min(1, done / total));
        barFill.style.width = `${Math.round(ratio * 100)}%`;
        bar.setAttribute("aria-valuenow", String(done));
        bar.setAttribute("aria-valuemax", String(total));
      } else {
        bar.classList.add("is-indeterminate");
        barFill.style.width = "";
      }
    },
    noteReadOnly: () => {
      card.readCount += 1;
      refreshStepCount();
    },
    appendStep: (entry) => {
      card.writeCount += 1;
      steps.append(entry);
      refreshStepCount();
      if (card.open) applyLayout();
    },
    attachChange: (preview) => {
      card.preview = preview;
      card.detailRendered = false;
      thumb.replaceChildren(renderChangeThumb(preview, 108));
      if (preview.title) {
        title.textContent = preview.title;
        title.setAttribute("title", preview.title);
      }
      refreshStepCount();
      // 완료 카드의 두 동작 — 「맵에서 보기」「이 작업만 되돌리기」.
      actions.replaceChildren();
      const region = changePreviewRegion(preview.before, preview.after, preview.mapId);
      if (region) {
        actions.append(el("button", {
          class: "ai-work-card-action ai-work-card-locate",
          attrs: { type: "button", title: "이 변경이 있는 자리로 화면을 옮깁니다" },
          dataset: { testid: "ai-work-card-locate" },
          children: actionLabel("보기", "맵에서 보기"),
          on: {
            click: () => {
              focusEditorRegion({ mapId: preview.mapId, x: region.x, y: region.y, w: region.width, h: region.height }, { highlight: true });
            },
          },
        }));
      }
      if (preview.onUndo) {
        const onUndo = preview.onUndo;
        actions.append(el("button", {
          class: "ai-work-card-action ai-work-card-undo",
          attrs: { type: "button", title: "이 작업의 변경을 되돌립니다" },
          dataset: { testid: "ai-work-card-undo" },
          children: actionLabel("되돌리기", "이 작업만 되돌리기"),
          on: {
            click: () => {
              onUndo();
              root.classList.add("is-undone");
              root.dataset.undone = "true";
            },
          },
        }));
      }
      if (card.open) renderDetail(card);
    },
    attachElement: (element) => {
      card.extras.push(element);
      card.detailRendered = false;
      if (card.open) renderDetail(card);
      else applyLayout();
    },
    finish: (result) => {
      card.state = result.ok ? "done" : "failed";
      root.dataset.state = card.state;
      live.replaceChildren();
      bar.remove();
      actions.querySelector(".ai-work-card-stop")?.remove();
      if (!card.preview) thumb.replaceChildren(el("span", { class: `ai-work-card-mark is-${card.state}`, text: result.ok ? "✓" : "✗" }));
      if (result.message) {
        meta.textContent = result.message;
        meta.setAttribute("title", result.message);
      } else refreshStepCount();
      applyLayout();
    },
    discardIfEmpty: () => {
      if (card.preview || card.extras.length > 0 || card.writeCount > 0 || card.state === "failed") return false;
      removeCard(card);
      return true;
    },
  };
}

/** 띠 루트(없으면 null). 테스트·e2e 가 카드를 찾는 진입점. */
export function getAiWorkStripElement(): HTMLElement | null {
  return stripEl && stripEl.parentNode === document.body ? stripEl : null;
}

export function aiWorkCardCount(): number {
  return cards.length;
}

/** 테스트 헬퍼: 띠와 카드를 모두 비운다. */
export function resetAiWorkStripForTest(): void {
  stripEl?.remove();
  stripEl = null;
  document.body?.classList.remove("has-ai-work-strip");
  headToggle = null;
  headCount = null;
  overflowChip = null;
  cardsHost = null;
  cards = [];
  folded = false;
  showAll = false;
  seq = 0;
}
