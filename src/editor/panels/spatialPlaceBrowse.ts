// 장소 갤러리의 둘러보기: 호버는 그림을 크게 보여주고, 빠른 재클릭은 상세 모달이다.
// 셸은 클릭마다 카드를 다시 만들기 때문에 dblclick 은 첫 클릭의 재렌더에 끊긴다.
// 그래서 더블클릭은 카드 id 와 시각으로 판정한다.

import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { classifyPlaceCard } from "@/editor/panels/spatialPlaceClassification";
import { cardSubtitle, spatialSourceLabel } from "@/editor/panels/spatialFeedback";
import { placeDraftTarget, placeFromProject } from "@/editor/panels/spatialPlaceDraft";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { designUsage, usageSummary } from "@/editor/panels/spatialUsage";
import { reviewedPlaceSummary } from "@/project/defaults/spatial/reviewedPlaceIndex";
import { isTopModal, registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { spatialThumbSrc } from "@/editor/panels/spatialCardThumbs";
import { el } from "@/util/dom";

const DOUBLE_CLICK_MS = 450;
const HOVER_DELAY_MS = 70;

export type PlaceBrowseActions = {
  readonly onEdit?: () => void;
  readonly resolveBuild: () => (() => void) | undefined;
};

type ZoomBox = { readonly w: number; readonly h: number };

const HOVER_BOX: ZoomBox = { w: 360, h: 248 };
const DETAIL_BOX: ZoomBox = { w: 640, h: 420 };

const cards = new Map<string, SpatialGalleryCard>();
let lastActivation: { id: string; at: number } | null = null;
let editorTimer: ReturnType<typeof setTimeout> | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let hoverHideTimer: ReturnType<typeof setTimeout> | null = null;
let hoverEl: HTMLElement | null = null;
let hoverAnchor: HTMLElement | null = null;
let pointer = { x: 0, y: 0, known: false };
let pointerTracked = false;
let detailOpen = false;
let closeDetail: (() => void) | null = null;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function consumePlaceActivation(cardId: string): "detail" | "select" {
  const at = now();
  const quick = lastActivation !== null && lastActivation.id === cardId && at - lastActivation.at < DOUBLE_CLICK_MS;
  lastActivation = { id: cardId, at };
  return quick ? "detail" : "select";
}

export function cancelPlaceEditorEntry(): void {
  if (editorTimer === null) return;
  clearTimeout(editorTimer);
  editorTimer = null;
}

/** 이미 선택된 카드를 한 번 더 누르면 편집기로 들어간다. 그 전에 한 번 더 누르면 상세가 이긴다. */
export function armPlaceEditorEntry(run: () => void): void {
  cancelPlaceEditorEntry();
  editorTimer = setTimeout(() => {
    editorTimer = null;
    run();
  }, DOUBLE_CLICK_MS);
}

function trackPointer(): void {
  if (pointerTracked || typeof document === "undefined") return;
  pointerTracked = true;
  document.addEventListener("pointermove", (event) => {
    pointer = { x: event.clientX, y: event.clientY, known: true };
    if (!hoverEl || detailOpen) return;
    if (pointerInsideHover(event.clientX, event.clientY) || pointerInsideAnchor(event.clientX, event.clientY)) {
      cancelHoverHide();
      return;
    }
    if (hoverHideTimer === null) scheduleHoverHide();
  }, { passive: true });
}

export function bindPlaceCardBrowse(button: HTMLElement, card: SpatialGalleryCard): void {
  trackPointer();
  cards.set(card.id, card);
  button.classList.add("is-zoomable");
  button.dataset.placeZoom = card.id;
  button.removeAttribute("title");
  button.addEventListener("pointerenter", (event) => {
    if (event instanceof PointerEvent && pointerInsideHover(event.clientX, event.clientY)) return;
    cancelHoverHide();
    scheduleHover(button, card);
  });
  button.addEventListener("pointerleave", () => {
    clearHoverTimer();
    scheduleHoverHide();
  });
}

export function hidePlaceHover(): void {
  clearHoverTimer();
  cancelHoverHide();
  hoverAnchor?.classList.remove("is-previewing");
  hoverAnchor?.removeAttribute("aria-describedby");
  hoverAnchor = null;
  hoverEl?.remove();
  hoverEl = null;
}

function pointerInsideHover(x: number, y: number): boolean {
  return pointInElement(hoverEl, x, y);
}

function pointerInsideAnchor(x: number, y: number): boolean {
  return pointInElement(hoverAnchor, x, y);
}

function pointInElement(node: HTMLElement | null, x: number, y: number): boolean {
  if (!node?.isConnected) return false;
  const rect = node.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function scheduleHoverHide(): void {
  cancelHoverHide();
  hoverHideTimer = setTimeout(() => {
    hoverHideTimer = null;
    if (pointerInsideHover(pointer.x, pointer.y)) return;
    hidePlaceHover();
  }, 140);
}

function cancelHoverHide(): void {
  if (hoverHideTimer === null) return;
  clearTimeout(hoverHideTimer);
  hoverHideTimer = null;
}

/** 갤러리가 다시 그려진 뒤, 포인터 아래 카드면 확대 패널을 이어 붙인다. */
export function retargetPlaceHover(): void {
  if (detailOpen || !pointer.known || typeof document === "undefined") return;
  if (pointerInsideHover(pointer.x, pointer.y)) return;
  const hit = document.elementFromPoint(pointer.x, pointer.y);
  const button = hit instanceof Element ? hit.closest("[data-place-zoom]") : null;
  if (!(button instanceof HTMLElement)) {
    hidePlaceHover();
    return;
  }
  const card = cards.get(button.dataset.placeZoom ?? "");
  if (!card) return;
  showHover(button, card);
}

export function openPlaceDetail(card: SpatialGalleryCard, actions: PlaceBrowseActions): void {
  hidePlaceHover();
  closeDetail?.();
  const host = overlayHost();
  if (!host) return;
  detailOpen = true;
  const titleId = "spatial-place-detail-title";
  const openerId = card.id;
  let closed = false;
  const backdrop = el("div", {
    class: "spatial-place-detail-backdrop",
    dataset: { testid: "spatial-place-detail" },
  });
  const close = (): void => {
    if (closed) return;
    closed = true;
    detailOpen = false;
    if (closeDetail === close) closeDetail = null;
    unregisterModal(backdrop);
    backdrop.remove();
    const opener = document.querySelector(`[data-testid="${cssEscape(`spatial-card-${openerId}`)}"]`);
    if (opener instanceof HTMLElement) opener.focus();
  };
  closeDetail = close;
  const dialog = el("div", {
    class: "spatial-place-detail",
    attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, tabindex: "-1" },
    dataset: { testid: "spatial-place-detail-dialog" },
  });
  dialog.append(
    detailStage(card),
    detailCopy(card, titleId, actions, close),
  );
  backdrop.append(dialog);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  dialog.addEventListener("keydown", (event) => trapTab(event, dialog, backdrop));
  registerModal(backdrop, close);
  host.append(backdrop);
  dialog.focus();
}

function scheduleHover(button: HTMLElement, card: SpatialGalleryCard): void {
  if (detailOpen) return;
  clearHoverTimer();
  hoverTimer = setTimeout(() => {
    hoverTimer = null;
    if (!button.isConnected) return;
    showHover(button, card);
  }, HOVER_DELAY_MS);
}

function clearHoverTimer(): void {
  if (hoverTimer === null) return;
  clearTimeout(hoverTimer);
  hoverTimer = null;
}

function showHover(button: HTMLElement, card: SpatialGalleryCard): void {
  if (detailOpen || !button.isConnected) return;
  if (hoverAnchor === button && hoverEl?.isConnected) {
    placeHover(hoverEl, button.getBoundingClientRect());
    return;
  }
  hidePlaceHover();
  const host = document.body;
  hoverAnchor = button;
  button.classList.add("is-previewing");
  const panel = el("div", {
    class: "spatial-place-hover",
    attrs: { id: "spatial-place-hover-tip", role: "tooltip" },
    dataset: { testid: "spatial-place-hover" },
  });
  button.setAttribute("aria-describedby", "spatial-place-hover-tip");
  const stage = el("div", { class: "spatial-place-zoom-stage", dataset: { zoom: "hover" } });
  mountZoom(stage, button, HOVER_BOX);
  const subtitle = cardSubtitle(card);
  panel.append(
    stage,
    el("div", { class: "spatial-place-hover-copy", children: [
      el("strong", { class: "spatial-place-hover-name", text: card.name }),
      ...(subtitle ? [el("span", { class: "spatial-place-hover-sub", text: subtitle })] : []),
      el("span", { class: "spatial-place-hover-hint", text: "두 번 클릭하면 자세히 봅니다" }),
    ] }),
  );
  host.append(panel);
  hoverEl = panel;
  placeHover(panel, button.getBoundingClientRect());
}

function placeHover(panel: HTMLElement, rect: DOMRect): void {
  const margin = 12;
  const width = panel.offsetWidth || HOVER_BOX.w;
  const height = panel.offsetHeight || HOVER_BOX.h + 72;
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  let left = rect.right + margin;
  if (left + width > viewW - margin) left = rect.left - margin - width;
  if (left < margin) left = Math.max(margin, Math.min(rect.left, viewW - width - margin));
  let top = rect.top;
  if (top + height > viewH - margin) top = viewH - height - margin;
  if (top < margin) top = margin;
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function detailStage(card: SpatialGalleryCard): HTMLElement {
  const stage = el("div", { class: "spatial-place-zoom-stage is-detail", dataset: { zoom: "detail" } });
  const button = document.querySelector(`[data-place-zoom="${cssEscape(card.id)}"]`);
  if (button instanceof HTMLElement) mountZoom(stage, button, DETAIL_BOX);
  else stage.append(el("p", { class: "spatial-place-zoom-empty", text: "미리보기 그림이 없습니다" }));
  return stage;
}

function detailCopy(card: SpatialGalleryCard, titleId: string, actions: PlaceBrowseActions, close: () => void): HTMLElement {
  const subtitle = cardSubtitle(card);
  const build = actions.resolveBuild();
  const facts = placeFacts(card);
  return el("div", { class: "spatial-place-detail-copy", children: [
    el("div", { class: "spatial-place-detail-head", children: [
      el("h2", { class: "spatial-place-detail-title", attrs: { id: titleId }, text: card.name }),
      el("button", {
        class: "spatial-place-detail-close",
        text: "닫기",
        attrs: { type: "button", "aria-label": "자세히 보기 닫기" },
        dataset: { testid: "spatial-place-detail-close" },
        on: { click: () => close() },
      }),
    ] }),
    ...(subtitle ? [el("p", { class: "spatial-place-detail-sub", text: subtitle })] : []),
    el("dl", {
      class: "spatial-place-detail-facts",
      children: facts.flatMap((fact) => [
        el("dt", { text: fact.label }),
        el("dd", { text: fact.value }),
      ]),
    }),
    el("div", { class: "spatial-place-detail-actions", children: [
      ...(build ? [el("button", {
        class: "spatial-action is-primary",
        text: "맵에 놓기",
        attrs: { type: "button" },
        dataset: { testid: "spatial-place-detail-build" },
        on: { click: () => { close(); build(); } },
      })] : []),
      ...(actions.onEdit ? [el("button", {
        class: "spatial-action",
        text: "편집",
        attrs: { type: "button" },
        dataset: { testid: "spatial-place-detail-edit" },
        on: { click: () => { close(); actions.onEdit?.(); } },
      })] : []),
      el("button", {
        class: "spatial-action",
        text: "닫기",
        attrs: { type: "button" },
        dataset: { testid: "spatial-place-detail-dismiss" },
        on: { click: () => close() },
      }),
    ] }),
  ] });
}

type Fact = { readonly label: string; readonly value: string };

function placeFacts(card: SpatialGalleryCard): readonly Fact[] {
  const classified = classifyPlaceCard(card);
  const project = visibleAuthoringProject();
  const usage = card.canonicalSource ? usageSummary(designUsage(project, card.canonicalSource.id)) : null;
  const place = placeFromProject(project, placeDraftTarget(card));
  const reviewed = card.reviewedPlaceId ? reviewedPlaceSummary(card.reviewedPlaceId) : undefined;
  const extra = (reviewed?.tags ?? place?.tags ?? []).filter((tag) => !tag.startsWith("그림체:") && !tag.startsWith("장소유형:") && !tag.startsWith("공간형태:") && !tag.startsWith("용도:"));
  const facts: Fact[] = [
    { label: "그림체", value: classified.style },
    { label: "유형", value: classified.category },
    { label: "공간", value: classified.environment },
    { label: "용도", value: classified.purposes.length > 0 ? classified.purposes.join(", ") : "지정 없음" },
    { label: "출처", value: spatialSourceLabel(card) },
  ];
  if (usage) facts.push({ label: "쓰임", value: usage });
  if (place) {
    facts.push({ label: "구성", value: `포함 ${place.children.length} · 출입구 ${place.ports.length} · 연결 ${place.connections.length}` });
  }
  if (extra.length > 0) facts.push({ label: "특징", value: extra.slice(0, 6).join(" · ") });
  if (card.missingSource) facts.push({ label: "원본", value: "없음" });
  return facts;
}

function thumbWaiting(button: HTMLElement): boolean {
  if (button.querySelector('[data-thumb="pending"]')) return true;
  return [...button.querySelectorAll("img")].some((node) => node instanceof HTMLImageElement && !node.complete);
}

function mountZoom(stage: HTMLElement, button: HTMLElement, box: ZoomBox): void {
  const visual = cloneThumb(button);
  if (!visual) {
    const waiting = thumbWaiting(button);
    stage.append(el("p", {
      class: "spatial-place-zoom-empty",
      text: waiting ? "그림을 준비하고 있습니다" : "미리보기 그림이 없습니다",
    }));
    if (waiting) retryZoom(stage, button, box, 0);
    return;
  }
  fitZoom(stage, visual, box);
}

function retryZoom(stage: HTMLElement, button: HTMLElement, box: ZoomBox, attempt: number): void {
  if (!stage.isConnected) return;
  setTimeout(() => {
    if (!stage.isConnected) return;
    const visual = cloneThumb(button);
    if (!visual) {
      if (attempt < 16 && thumbWaiting(button)) retryZoom(stage, button, box, attempt + 1);
      else stage.replaceChildren(el("p", { class: "spatial-place-zoom-empty", text: "미리보기 그림이 없습니다" }));
      return;
    }
    stage.replaceChildren();
    fitZoom(stage, visual, box);
  }, 60);
}

function fitZoom(stage: HTMLElement, visual: HTMLElement, box: ZoomBox): void {
  const arts = visual.matches(".spatial-place-zoom-art")
    ? [visual]
    : [...visual.querySelectorAll<HTMLElement>(".spatial-place-zoom-art")];
  if (arts.length === 0) {
    stage.append(visual);
    return;
  }
  const sizes = arts.map(intrinsicSize);
  const width = Math.max(1, ...sizes.map((size) => size.w));
  const height = Math.max(1, sizes.reduce((sum, size) => sum + size.h, 0));
  const scale = Math.min(box.w / width, box.h / height);
  arts.forEach((art, index) => {
    const size = sizes[index];
    if (!size) return;
    art.style.width = `${Math.max(1, Math.round(size.w * scale))}px`;
    art.style.height = `${Math.max(1, Math.round(size.h * scale))}px`;
  });
  stage.append(visual);
  stage.style.height = `${Math.round(Math.min(box.h, height * scale))}px`;
}

function intrinsicSize(node: HTMLElement): { readonly w: number; readonly h: number } {
  if (node instanceof HTMLCanvasElement) return { w: node.width, h: node.height };
  if (node instanceof HTMLImageElement) return { w: Math.max(node.naturalWidth, 1), h: Math.max(node.naturalHeight, 1) };
  return { w: 1, h: 1 };
}

function cloneThumb(button: HTMLElement): HTMLElement | null {
  const thumb = button.querySelector(".spatial-card-thumb");
  if (!(thumb instanceof HTMLElement)) return null;
  const pieces = [...thumb.querySelectorAll("canvas, img")].flatMap((node) => {
    const cloned = cloneArt(node);
    return cloned ? [cloned] : [];
  });
  const error = thumb.querySelector(".spatial-place-preview-error");
  if (pieces.length === 0) {
    const src = spatialThumbSrc(button.dataset.placeZoom ?? "");
    if (src) return cloneArt(Object.assign(document.createElement("img"), { src }));
    if (error instanceof HTMLElement && error.textContent) {
      return el("p", { class: "spatial-place-zoom-empty", text: error.textContent });
    }
    return null;
  }
  if (pieces.length === 1) return pieces[0] ?? null;
  return el("div", { class: "spatial-place-zoom-stack", children: pieces });
}

function cloneArt(node: Element): HTMLElement | null {
  if (node instanceof HTMLCanvasElement) {
    if (node.width < 1 || node.height < 1) return null;
    const copy = document.createElement("canvas");
    copy.width = node.width;
    copy.height = node.height;
    copy.className = "spatial-place-zoom-art";
    const ctx = copy.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(node, 0, 0);
    return copy;
  }
  if (node instanceof HTMLImageElement) {
    const src = node.currentSrc || node.src;
    if (!src) return null;
    const copy = document.createElement("img");
    copy.className = "spatial-place-zoom-art";
    copy.alt = "";
    copy.draggable = false;
    copy.src = src;
    return copy;
  }
  return null;
}

function overlayHost(): HTMLElement | null {
  // 자료집 본문은 카드 클릭마다 replaceChildren 으로 비운다. 상세를 그 안에 두면
  // 두 번째 클릭의 새로 그리기가 방금 연 확대 창을 지운다.
  return document.body;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function trapTab(event: KeyboardEvent, dialog: HTMLElement, backdrop: HTMLElement): void {
  if (event.key !== "Tab" || event.defaultPrevented || !isTopModal(backdrop)) return;
  const stops = [...dialog.querySelectorAll<HTMLElement>("button, [href], input, select, textarea")].filter((node) => !node.hasAttribute("disabled"));
  const first = stops[0] ?? dialog;
  const last = stops[stops.length - 1] ?? dialog;
  if (document.activeElement === dialog || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}
