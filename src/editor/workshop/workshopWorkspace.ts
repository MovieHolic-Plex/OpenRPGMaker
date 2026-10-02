// src/editor/workshop/workshopWorkspace.ts
/**
 * 공방 큰 화면 — tilesetAiWorkspaceModal 처럼 document.body 위 오버레이.
 * 왼쪽: 기물 목록(고를 차례·그리는 중·고름·전체 + 검색, 새 기물). 오른쪽: 판 화면(workshopRoundView).
 * 화면을 닫아도 엔진은 계속 돈다. 다시 그리기는 세션 변경 알림 때 서명(signature)이 바뀐 경우에만 — 깜빡임 방지.
 */
import "@/styles/database/workshop/index.css";
import type { WorkshopItem } from "@/harnesses/_core/workshop/types";
import { clearChildren, el } from "@/util/dom";
import { renderItemForm } from "./workshopItemForm";
import { renderRoundView, type RoundViewState } from "./workshopRoundView";
import { getWorkshopSession, saveConcurrency, type WorkshopSession } from "./workshopSession";
import { etaMinutes, ITEM_STATE_LABELS, itemState, type ItemState } from "./workshopStatus";

type Filter = ItemState | "all";
const FILTERS: Filter[] = ["choose", "drawing", "picked", "all"];

let host: HTMLElement | null = null;
let session: WorkshopSession | null = null;
let unsubscribe: (() => void) | null = null;
let filter: Filter = "choose";
let query = "";
let selectedKey: string | null = null;
let showForm = false;
let lastSignature = "";
const view: RoundViewState = { selected: 0, zoom: "fit", rejectFor: null };

export function isWorkshopOpen(): boolean {
  return host !== null;
}

export async function openWorkshop(harnessId: string): Promise<void> {
  closeWorkshop();
  host = el("div", {
    class: "workshop-host", dataset: { testid: "workshop-host" },
    on: { click: (event) => { if (event.target === host) closeWorkshop(); } },
  });
  host.append(el("div", { class: "workshop-loading", text: "공방을 여는 중…" }));
  const myHost = host;
  document.body.append(myHost);
  document.addEventListener("keydown", onKeydown);
  let opened: WorkshopSession;
  try {
    opened = await getWorkshopSession(harnessId);
  } catch (error) {
    if (host !== myHost) return; // 기다리는 동안 닫혔거나 다시 열렸다 — 지금 화면을 건드리지 않는다
    clearChildren(myHost);
    myHost.append(el("div", { class: "workshop-loading", text: `공방을 열지 못했습니다: ${(error as Error).message}` }));
    return;
  }
  if (host !== myHost) return;
  session = opened;
  unsubscribe = opened.subscribe(() => render(false));
  render(true);
}

export function closeWorkshop(): void {
  document.removeEventListener("keydown", onKeydown);
  unsubscribe?.();
  unsubscribe = null;
  host?.remove();
  host = null;
  session = null;
  lastSignature = "";
}

function visibleItems(s: WorkshopSession): WorkshopItem[] {
  const needle = query.trim().toLowerCase();
  return s.items().filter((item) => {
    if (needle && !`${item.title} ${item.key} ${item.category}`.toLowerCase().includes(needle)) return false;
    return filter === "all" || itemState(item.key, s.rounds, s.picks) === filter;
  });
}

function signature(s: WorkshopSession): string {
  return JSON.stringify([filter, query, selectedKey, showForm, view, s.picks.map((p) => `${p.itemKey}|${p.roundId}|${p.letter}`), s.defs.length,
    s.rounds.map((r) => [r.id, r.runs.map((run) => [run.status, run.attempt, run.verdict?.verdict, run.grid?.cells.length])]), s.engine.status()]);
}

function render(force: boolean): void {
  if (!host || !session) return;
  const s = session;
  const next = signature(s);
  if (!force && next === lastSignature) return;
  lastSignature = next;
  const items = visibleItems(s);
  // 보이는 목록에서 빠지면(예: 「고를 차례」에서 하나 고름) 다음 것을 자동으로 연다 — 기다림 화면 겸 다음 차례
  if (!selectedKey || !items.some((item) => item.key === selectedKey)) {
    selectedKey = items[0]?.key ?? null;
    view.selected = 0;
    view.rejectFor = null;
  }
  const status = s.engine.status();
  const eta = etaMinutes(s.rounds, status.concurrency);
  const selected = s.items().find((item) => item.key === selectedKey) ?? null;
  const scrollTop = host.querySelector(".workshop-items")?.scrollTop ?? 0;
  // 입력 중이던 칸(검색·판 메모)은 다시 그리면 새 요소가 되므로 포커스와 커서를 되살린다
  const active = document.activeElement;
  const focusClass = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? (["workshop-search", "workshop-note"].find((c) => active.classList.contains(c)) ?? null) : null;
  const caret = focusClass && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
    ? { start: active.selectionStart, end: active.selectionEnd } : null;
  clearChildren(host);
  host.append(el("section", {
    class: "workshop", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "공방" }, dataset: { testid: "workshop" },
    children: [
      el("header", {
        class: "workshop-head",
        children: [
          el("h2", { text: "공방 · 손 도트 실내 기물" }),
          el("span", {
            class: "workshop-progress", dataset: { testid: "workshop-progress" },
            text: status.running + status.queued > 0 ? `그리는 중 ${status.running} · 대기 ${status.queued} · 약 ${eta}분 남음` : "쉬는 중",
          }),
          ...(status.blocked ? [el("span", { class: "workshop-blocked", text: status.blocked })] : []),
          ...(s.store.backend === "memory" ? [el("span", { class: "workshop-blocked", text: "이 브라우저는 저장소를 못 열어 새로 고침하면 후보가 사라집니다." })] : []),
          el("label", {
            class: "workshop-concurrency",
            children: ["동시에", el("select", {
              dataset: { testid: "workshop-concurrency" },
              on: { change: (event) => { const n = Number((event.target as HTMLSelectElement).value); s.engine.setConcurrency(n); saveConcurrency(n); render(true); } },
              children: [1, 2, 3, 4, 5, 6].map((n) => el("option", { value: n, text: `${n}장`, attrs: n === status.concurrency ? { selected: "" } : {} })),
            })],
          }),
          el("button", { class: "workshop-close", text: "닫기", attrs: { type: "button", "aria-label": "공방 닫기" }, on: { click: closeWorkshop } }),
        ],
      }),
      el("div", {
        class: "workshop-body",
        children: [
          el("nav", {
            class: "workshop-side",
            children: [
              el("div", {
                class: "workshop-filters", attrs: { role: "tablist" },
                children: FILTERS.map((f) => el("button", {
                  class: "workshop-filter" + (f === filter ? " is-active" : ""), attrs: { type: "button", role: "tab", "aria-selected": String(f === filter) },
                  dataset: { testid: `workshop-filter-${f}` },
                  text: `${f === "all" ? "전체" : ITEM_STATE_LABELS[f]} ${f === "all" ? s.items().length : s.items().filter((item) => itemState(item.key, s.rounds, s.picks) === f).length}`,
                  on: { click: () => { filter = f; selectedKey = null; render(true); } },
                })),
              }),
              el("input", {
                class: "workshop-search", value: query, attrs: { type: "search", placeholder: "기물 찾기", "aria-label": "기물 찾기" },
                on: { input: (event) => { query = (event.target as HTMLInputElement).value; render(true); } },
              }),
              el("button", { class: "workshop-new", text: "+ 새 기물 정의", attrs: { type: "button" }, dataset: { testid: "workshop-new-item" }, on: { click: () => { showForm = true; render(true); } } }),
              el("ul", {
                class: "workshop-items",
                children: items.map((item) => el("li", {
                  children: [el("button", {
                    class: "workshop-item" + (item.key === selectedKey ? " is-selected" : ""), attrs: { type: "button" },
                    dataset: { testid: "workshop-item", key: item.key, state: itemState(item.key, s.rounds, s.picks) },
                    on: { click: () => { selectedKey = item.key; showForm = false; view.selected = 0; view.rejectFor = null; render(true); } },
                    children: [el("span", { class: "workshop-item-title", text: item.title }), el("span", { class: "workshop-item-meta", text: `${item.category} · ${ITEM_STATE_LABELS[itemState(item.key, s.rounds, s.picks)]}` })],
                  })],
                })),
              }),
            ],
          }),
          el("main", {
            class: "workshop-main",
            children: [showForm
              ? renderItemForm(s, (key) => { showForm = false; selectedKey = key; filter = "all"; render(true); }, () => { showForm = false; render(true); })
              : selected ? renderRoundView(s, selected, view, () => render(true))
              : el("p", { class: "workshop-empty", text: filter === "choose" ? "고를 차례인 기물이 없습니다. 다 그리면 여기 나타납니다." : "기물이 없습니다." })],
          }),
        ],
      }),
    ],
  }));
  const list = host.querySelector(".workshop-items");
  if (list) list.scrollTop = scrollTop;
  if (focusClass) {
    const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`.${focusClass}`);
    if (input) {
      input.focus();
      if (caret && caret.start !== null && caret.end !== null) input.setSelectionRange(caret.start, caret.end);
    }
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (!host || !session) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
  if (event.key === "Escape") {
    if (view.rejectFor) { view.rejectFor = null; render(true); } else closeWorkshop();
    event.preventDefault();
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const items = visibleItems(session);
    const index = items.findIndex((item) => item.key === selectedKey);
    const next = items[Math.max(0, Math.min(items.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
    if (next) { selectedKey = next.key; view.selected = 0; view.rejectFor = null; render(true); }
    event.preventDefault();
    return;
  }
  // 포커스된 버튼·링크에서의 Enter 는 그 버튼이 처리한다(숨은 「고르기」가 가로채면 안 된다)
  if (event.key === "Enter" && target && (target.tagName === "BUTTON" || target.tagName === "A")) return;
  host.querySelector<HTMLElement>(`[data-key-action="${event.key.toLowerCase()}"]`)?.click();
}
