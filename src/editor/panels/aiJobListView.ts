// editor/panels/aiJobListView.ts
// 「작업 목록」 화면 — 한 행 = 번호 · 종류 · 한 줄 요약 · 맵 좌표 · 상태(글자) · 그 자리 버튼.
// 입구는 셋이고 모두 같은 목록을 연다: 지도 아래 상태 줄의 「작업 N개」 · 접힌 레일의 개수 배지 · 열린 도크 위쪽의 「작업 N」 버튼.
//
// 렉 방지 계약(aiJobList.ts 와 한 쌍):
//  - 닫힌 동안 이 모듈은 행을 만들지도 구독하지도 않는다(요약만 입구 버튼이 읽는다).
//  - 열려 있을 때 행은 키(JobRow.key)로 보관한다. 갱신은 **바뀐 행의 바뀐 칸만** 고친다(textContent·dataset 비교) — 이벤트마다 목록을 다시 만들지 않는다.
//    행 순서는 이동이 필요할 때만 insertBefore 한다. 한 프레임에 한 번(aiJobList 의 프레임 묶음) 도착한다.
//  - 열릴 때 위치를 한 번 읽는다. 이후 갱신은 레이아웃 읽기가 없다(강제 레이아웃 금지). 창 크기가 바뀔 때만 다시 읽는다.
//
// 접근성: 목록은 role="list", 행은 listitem. 행의 본 버튼은 ↑↓ Home End 로 옮겨 다닌다(로빙 tabindex). 상태는 색이 아니라 글자(「일하는 중」「내 차례」…)로 말한다.

import { el } from "@/util/dom";
import { canStopRow, locateRow, stopRow, reviewButtons } from "./aiJobActions";
import { subscribeJobRows, type JobKind, type JobRow, subscribeJobSummary } from "./aiJobList";
import { PRESENCE_LABEL, type JobSummary } from "./aiPresence";
import { openEventAiJob } from "@/editor/eventAiQueue/eventAiQueueView";

export const KIND_LABEL: Readonly<Record<JobKind, string>> = {
  chat: "대화",
  team: "팀",
  drag: "드래그",
  region: "영역 작업",
  background: "다른 맵",
  stamp: "바로 깔기",
  event: "이벤트",
};

interface RowRefs {
  readonly node: HTMLElement;
  readonly main: HTMLButtonElement;
  readonly no: HTMLElement;
  readonly kind: HTMLElement;
  readonly title: HTMLElement;
  readonly action: HTMLElement;
  readonly map: HTMLElement;
  readonly coords: HTMLElement;
  readonly state: HTMLElement;
  readonly acts: HTMLElement;
  row: JobRow;
  actsSig: string;
}

const refs = new Map<string, RowRefs>();
let root: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let headCount: HTMLElement | null = null;
let emptyEl: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;
let opener: HTMLElement | null = null;
let open = false;
const openListeners = new Set<(open: boolean) => void>();

function coordsText(row: JobRow): string {
  if (!row.where) return "";
  const { x, y, w, h } = row.where;
  return w <= 1 && h <= 1 ? `(${x},${y})` : `(${x},${y}) ${w}×${h}`;
}

/** 상태를 글자로. 정수·좌표는 번역이 필요 없는 조각이다. */
function stateLabel(row: JobRow): string {
  return PRESENCE_LABEL[row.state];
}

function buildRow(row: JobRow): RowRefs {
  const no = el("span", { class: "ai-status-job-no", attrs: { translate: "no" } });
  const kind = el("span", { class: "ai-status-job-kind" });
  const title = el("span", { class: "ai-status-job-title", attrs: { translate: "no" } });
  const action = el("span", { class: "ai-status-job-action" });
  const map = el("span", { class: "ai-status-job-map", attrs: { translate: "no" } });
  const coords = el("span", { class: "ai-status-job-coords", attrs: { translate: "no" } });
  const state = el("span", { class: "ai-status-job-state" });
  const main = el("button", {
    class: "ai-status-job-main",
    attrs: { type: "button", tabindex: "-1" },
    dataset: { testid: "ai-job-main" },
    children: [
      no,
      el("span", { class: "ai-status-job-body", children: [
        el("span", { class: "ai-status-job-line", children: [kind, title] }),
        el("span", { class: "ai-status-job-line is-sub", children: [action, map, coords] }),
      ] }),
      state,
    ],
  }) as HTMLButtonElement;
  const acts = el("span", { class: "ai-status-job-acts" });
  const node = el("div", { class: "ai-status-job", attrs: { role: "listitem" }, dataset: { testid: "ai-job-row", jobKey: row.key }, children: [main, acts] });
  const entry: RowRefs = { node, main, no, kind, title, action, map, coords, state, acts, row, actsSig: "" };
  main.addEventListener("click", () => locateRow(entry.row));
  paint(entry, row, true);
  return entry;
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setData(node: HTMLElement, key: string, value: string): void {
  if (node.dataset[key] !== value) node.dataset[key] = value;
}

/** 행의 바뀐 칸만 고친다. 시그니처가 같으면 아무것도 하지 않는다. */
function paint(entry: RowRefs, row: JobRow, force = false): void {
  if (!force && entry.row === row) return;
  const before = entry.row;
  entry.row = row;
  if (force || before.no !== row.no) setText(entry.no, `#${row.no}`);
  setData(entry.node, "tone", String(row.tone));
  setData(entry.node, "state", row.state);
  setData(entry.node, "kind", row.kind);
  if (force || before.kind !== row.kind) setText(entry.kind, KIND_LABEL[row.kind]);
  if (force || before.title !== row.title) setText(entry.title, row.title);
  setText(entry.action, row.note && (row.state === "failed" || row.state === "review") ? `${row.action} · ${row.note}` : row.action);
  setText(entry.map, row.mapName ?? "");
  setText(entry.coords, coordsText(row));
  setText(entry.state, stateLabel(row));
  const label = `#${row.no} ${KIND_LABEL[row.kind]} ${row.title} ${stateLabel(row)}`;
  if (entry.main.getAttribute("aria-label") !== label) entry.main.setAttribute("aria-label", label);
  paintActions(entry, row);
}

/** 그 자리 버튼 — 확인(검토 입구) · 열기(이벤트) · 멈춤. 종류·상태가 바뀔 때만 다시 만든다. */
function paintActions(entry: RowRefs, row: JobRow): void {
  const sig = `${row.source.type}|${row.state}|${row.source.type === "presence" ? row.source.presence.source : ""}`;
  if (entry.actsSig === sig) return;
  entry.actsSig = sig;
  const buttons: HTMLElement[] = [];
  if (row.source.type === "presence" && row.state === "review") buttons.push(...reviewButtons(row.source.presence, () => close(true), "ai-job"));
  if (row.source.type === "event" && (row.state === "review" || row.state === "failed")) {
    const jobId = row.source.jobId;
    buttons.push(el("button", { class: "ai-status-btn is-primary", text: "열기", attrs: { type: "button" }, dataset: { testid: "ai-job-open-event" }, on: { click: () => { close(true); openEventAiJob(jobId); } } }));
  }
  if (canStopRow(row)) {
    buttons.push(el("button", { class: "ai-status-btn is-stop", text: "멈춤", attrs: { type: "button" }, dataset: { testid: "ai-job-stop" }, on: { click: () => stopRow(entry.row) } }));
  }
  entry.acts.replaceChildren(...buttons);
}

function summaryPieces(summary: JobSummary): string[] {
  const pieces = [`작업 ${summary.total}개`];
  if (summary.review > 0) pieces.push(`확인 필요 ${summary.review}`);
  if (summary.failed > 0) pieces.push(`실패 ${summary.failed}`);
  return pieces;
}

let lastHeadSig = "";
function paintHead(summary: JobSummary): void {
  if (!headCount) return;
  const sig = `${summary.total}|${summary.review}|${summary.failed}`;
  if (sig === lastHeadSig) return;
  lastHeadSig = sig;
  headCount.replaceChildren(...summaryPieces(summary).flatMap((text, i) => [...(i ? [el("i", { text: " · ", attrs: { "aria-hidden": "true" } })] : []), el("span", { text })]));
}

function applyRows(rows: readonly JobRow[]): void {
  if (!listEl || !emptyEl) return;
  const live = new Set<string>();
  let cursor: Element | null = listEl.firstElementChild;
  for (const row of rows) {
    live.add(row.key);
    let entry = refs.get(row.key);
    if (!entry) { entry = buildRow(row); refs.set(row.key, entry); } else paint(entry, row);
    if (entry.node === cursor) cursor = cursor.nextElementSibling;
    else listEl.insertBefore(entry.node, cursor);
  }
  for (const [key, entry] of refs) {
    if (live.has(key)) continue;
    // 지워지는 행에 초점이 있었으면 이웃 행으로 옮긴다 — 초점이 body 로 새면 방향키 탐색이 끊긴다.
    const hadFocus = entry.node.contains(document.activeElement);
    const next = entry.node.nextElementSibling ?? entry.node.previousElementSibling;
    entry.node.remove();
    refs.delete(key);
    if (hadFocus) next?.querySelector<HTMLElement>(".ai-status-job-main")?.focus();
  }
  emptyEl.hidden = rows.length > 0;
  syncTabStop();
}

/** 로빙 tabindex — 초점이 있는 행(없으면 첫 행)만 탭 정지점이다. */
function syncTabStop(): void {
  if (!listEl) return;
  const mains = [...listEl.querySelectorAll<HTMLButtonElement>(".ai-status-job-main")];
  const active = mains.find(main => main === document.activeElement) ?? mains.find(main => main.tabIndex === 0) ?? mains[0];
  for (const main of mains) {
    const want = main === active ? 0 : -1;
    if (main.tabIndex !== want) main.tabIndex = want;
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") { event.stopPropagation(); close(true); return; }
  const target = event.target as HTMLElement | null;
  if (!target?.classList.contains("ai-status-job-main") || !listEl) return;
  const mains = [...listEl.querySelectorAll<HTMLButtonElement>(".ai-status-job-main")];
  const index = mains.indexOf(target as HTMLButtonElement);
  let next = -1;
  if (event.key === "ArrowDown") next = Math.min(mains.length - 1, index + 1);
  else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = mains.length - 1;
  if (next < 0) return;
  event.preventDefault();
  for (const main of mains) main.tabIndex = main === mains[next] ? 0 : -1;
  mains[next]?.focus();
}

/** 열 때 한 번 위치를 읽는다. 캔버스 아래쪽 왼쪽, 상태 줄 위. */
function place(): void {
  if (!root) return;
  const canvas = document.querySelector<HTMLElement>('[data-testid="edit-canvas"]');
  const rect = canvas?.getBoundingClientRect();
  if (!rect || rect.width <= 0) return;
  const bar = document.querySelector<HTMLElement>(".ai-status-bar:not([hidden])");
  const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight - 16;
  root.style.left = `${Math.max(8, Math.round(rect.left + 16))}px`;
  root.style.bottom = `${Math.max(8, Math.round(window.innerHeight - barTop + 10))}px`;
  root.style.maxWidth = `${Math.max(280, Math.round(rect.width - 32))}px`;
}

function ensureRoot(): HTMLElement {
  if (root?.isConnected) return root;
  headCount = el("span", { class: "ai-status-jobs-count", dataset: { testid: "ai-job-head-count" } });
  listEl = el("div", { class: "ai-status-jobs-body", attrs: { role: "list", "aria-label": "AI 작업 목록" }, dataset: { testid: "ai-job-list-body" } });
  emptyEl = el("p", { class: "ai-status-jobs-empty", text: "돌고 있는 AI 작업이 없어요" });
  const closeBtn = el("button", { class: "ai-status-btn", text: "닫기", attrs: { type: "button" }, dataset: { testid: "ai-job-close" }, on: { click: () => close(true) } });
  root = el("section", {
    class: "ai-status-jobs",
    attrs: { role: "dialog", "aria-label": "작업 목록", hidden: "" },
    dataset: { testid: "ai-job-list" },
    children: [
      el("header", { children: [el("h2", { text: "작업 목록" }), headCount, el("span", { class: "ai-status-jobs-spacer" }), closeBtn] }),
      emptyEl,
      listEl,
    ],
  });
  root.addEventListener("keydown", onKeyDown);
  document.body.append(root);
  return root;
}

let summaryOff: (() => void) | null = null;
const onResize = (): void => { if (open) place(); };
const onDocPointer = (event: PointerEvent): void => {
  if (!open || !root) return;
  const target = event.target as Node | null;
  if (target && (root.contains(target) || opener?.contains(target))) return;
  // 입구 버튼(상태 줄 요약·레일 배지·도크 위 버튼)을 눌러 닫는 경우는 그 버튼의 토글이 맡는다.
  if (target instanceof Element && target.closest("[data-ai-job-entry]")) return;
  close(false);
};

export function isAiJobListOpen(): boolean {
  return open;
}

export function subscribeAiJobListOpen(listener: (open: boolean) => void): () => void {
  openListeners.add(listener);
  return () => { openListeners.delete(listener); };
}

/** 목록을 연다. 이미 열려 있으면 그대로 둔다. `from` 은 닫을 때 초점을 돌려받는 입구 버튼. */
export function openAiJobList(from?: HTMLElement | null): void {
  const node = ensureRoot();
  opener = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  if (open) return;
  open = true;
  node.hidden = false;
  place();
  unsubscribe = subscribeJobRows(applyRows);
  summaryOff = subscribeJobSummary(paintHead);
  window.addEventListener("resize", onResize);
  document.addEventListener("pointerdown", onDocPointer, true);
  for (const listener of [...openListeners]) listener(true);
  // 첫 행(없으면 닫기)로 초점을 준다 — 키보드로 열었을 때 바로 방향키가 먹는다.
  (listEl?.querySelector<HTMLElement>(".ai-status-job-main") ?? root?.querySelector<HTMLElement>("[data-testid=ai-job-close]"))?.focus();
}

export function closeAiJobList(): void {
  close(false);
}

function close(restoreFocus: boolean): void {
  if (!open || !root) return;
  open = false;
  root.hidden = true;
  unsubscribe?.(); unsubscribe = null;
  summaryOff?.(); summaryOff = null;
  window.removeEventListener("resize", onResize);
  document.removeEventListener("pointerdown", onDocPointer, true);
  // 닫으면 행을 버린다 — 닫힌 동안 DOM 비용이 0 이다.
  refs.clear();
  listEl?.replaceChildren();
  lastHeadSig = "";
  if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
  for (const listener of [...openListeners]) listener(false);
}

export function toggleAiJobList(from?: HTMLElement | null): void {
  if (open) close(true); else openAiJobList(from);
}

/** 입구 버튼 공통 — 같은 목록을 여는 한 가지 방법. */
export function markJobListEntry(button: HTMLElement): void {
  button.dataset.aiJobEntry = "1";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", String(open));
}

/** 입구 버튼의 aria-expanded 를 목록과 맞춘다. 해제 함수를 돌려준다. */
export function syncJobListEntry(button: HTMLElement): () => void {
  return subscribeAiJobListOpen(value => button.setAttribute("aria-expanded", String(value)));
}

/** 편집기를 떠날 때 — 열린 목록을 닫고 DOM 을 거둔다. */
export function disposeAiJobList(): void {
  close(false);
  root?.remove();
  root = null; listEl = null; headCount = null; emptyEl = null;
}
