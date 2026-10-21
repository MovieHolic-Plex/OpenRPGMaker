// src/editor/workshop/workshopWorkspace.ts
/**
 * 공방 「물건·가구」 큰 화면 — tilesetAiWorkspaceModal 처럼 document.body 위 오버레이.
 * 머리: 넣을 곳(실내 가구 = 손 도트 실내 칩셋 · 지금 맵 칩셋) 전환. 실행기는 interior-props·map-objects 그대로다.
 * 왼쪽: 내가 만든 물건 목록(고를 차례·그리는 중·고름·전체 + 찾기, 새로 만들기). 오른쪽: 판 화면(workshopRoundView).
 * 번들 기물 다시 그리기 목록은 2026-10-21 에 뺐다 — 판·고른 것이 저장된 번들 기물만 계속 보인다(옛 기록 보존).
 * 화면을 닫아도 엔진은 계속 돈다. 다시 그리기는 세션 변경 알림 때 서명(signature)이 바뀐 경우에만 — 깜빡임 방지.
 */
import "@/styles/database/workshop/index.css";
import type { WorkshopItem } from "@/harnesses/_core/workshop/types";
import { clearChildren, el } from "@/util/dom";
import { closeGenWorkspace, isGenWorkspaceOpen } from "./genWorkspace";
import { currentDrawTarget, OBJECT_WORKSHOP_HARNESSES } from "./mapObjectTarget";
import { renderItemForm } from "./workshopItemForm";
import { renderRoundView, type RoundViewState } from "./workshopRoundView";
import { getWorkshopSession, saveConcurrency, type WorkshopSession } from "./workshopSession";
import { etaMinutes, ITEM_STATE_LABELS, itemState, latestRound, roundProgress, type ItemState } from "./workshopStatus";
import { isWorkshopPickBaked } from "./workshopBake";

type Filter = ItemState | "all";
const FILTERS: Filter[] = ["choose", "drawing", "picked", "all"];

let host: HTMLElement | null = null;
let session: WorkshopSession | null = null;
let unsubscribe: (() => void) | null = null;
let filter: Filter = "choose";
let query = "";
let selectedKey: string | null = null;
let showForm = false;
/** 새 기물 폼에 미리 채울 값(조수의 「없는 타일」 카드가 연 경우) */
let formDraft: { title: string; description: string } | null = null;
let lastSignature = "";
const view: RoundViewState = { selected: 0, zoom: "fit", rejectFor: null };

/** 물건 화면이나 생성기 화면(genWorkspace) 중 하나라도 열려 있는가 — 왼쪽 막대가 같은 단추로 닫는다. */
export function isWorkshopOpen(): boolean {
  return host !== null || isGenWorkspaceOpen();
}

export type OpenWorkshopOptions = { readonly newItem?: { readonly title: string; readonly description: string } };

export async function openWorkshop(harnessId: string, options: OpenWorkshopOptions = {}): Promise<void> {
  closeWorkshop();
  if (options.newItem) {
    showForm = true;
    formDraft = { ...options.newItem };
  }
  host = el("div", {
    class: "workshop-host", dataset: { testid: "workshop-host" },
    on: { click: (event) => { if (event.target === host) closeWorkshop(); } },
  });
  if (typeof document !== "undefined") {
    if (document.querySelector('[data-testid="left-activity-bar"]')) host.style.left = "48px";
    if (document.querySelector('[data-testid="oprn-menu-bar"]')) host.style.top = "48px";
  }
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
  // 처음 쓰는 사람에게는 빈 목록 대신 「무엇을 만들까요」 폼부터 보여 준다
  if (visibleItems(opened, "all").length === 0) showForm = true;
  unsubscribe = opened.subscribe(() => render(false));
  render(true);
}

export function closeWorkshop(): void {
  closeGenWorkspace();
  document.removeEventListener("keydown", onKeydown);
  unsubscribe?.();
  unsubscribe = null;
  host?.remove();
  host = null;
  session = null;
  lastSignature = "";
  formDraft = null;
}

/** 내가 만든 물건 + 판·고른 것이 남아 있는 번들 기물(옛 다시 그리기 기록). 손대지 않은 번들 기물 목록은 보이지 않는다. */
function ownItems(s: WorkshopSession): WorkshopItem[] {
  return s.items().filter((item) => item.isNew || s.rounds.some((round) => round.itemKey === item.key) || s.picks.some((pick) => pick.itemKey === item.key));
}

function visibleItems(s: WorkshopSession, only: Filter = filter): WorkshopItem[] {
  const needle = query.trim().toLowerCase();
  return ownItems(s).filter((item) => {
    if (needle && !`${item.title} ${item.key} ${item.category}`.toLowerCase().includes(needle)) return false;
    return only === "all" || itemState(item.key, s.rounds, s.picks) === only;
  });
}

/** 넣을 곳 전환 — 실내 가구(손 도트 실내 칩셋) · 지금 맵 칩셋. 지금 맵이 16px 일반 칩셋일 때만 둘째가 보인다. */
function targetSwitch(s: WorkshopSession): HTMLElement {
  const target = currentDrawTarget();
  const mapName = target.harnessId === "map-objects" ? target.name : null;
  const options = OBJECT_WORKSHOP_HARNESSES.filter((id) => id === "interior-props" || mapName !== null || s.harnessId === id);
  return el("div", {
    class: "workshop-target", attrs: { role: "group", "aria-label": "넣을 곳" },
    children: [
      el("span", { class: "workshop-item-meta", text: "넣을 곳" }),
      ...options.map((id) => el("button", {
        class: "workshop-filter" + (id === s.harnessId ? " is-active" : ""),
        attrs: { type: "button", "aria-pressed": String(id === s.harnessId) }, dataset: { testid: `workshop-target-${id}` },
        // 칩셋 이름은 데이터라 번역하지 않는 조각으로 따로 둔다(번역기가 이름 속 「·」로 문장을 쪼개지 않게)
        children: id === "interior-props" ? ["실내 가구"] : mapName ? [el("span", { text: "지금 맵 칩셋" }), " ", el("span", { text: mapName, attrs: { translate: "no" } })] : ["맵 물건"],
        on: { click: () => { if (id !== s.harnessId) void openWorkshop(id); } },
      })),
    ],
  });
}

function signature(s: WorkshopSession): string {
  return JSON.stringify([filter, query, selectedKey, showForm, view, s.picks.map((p) => `${p.itemKey}|${p.roundId}|${p.letter}`), s.defs.length,
    s.rounds.map((r) => [r.id, r.runs.map((run) => [run.status, run.attempt, run.verdict?.verdict, run.grid?.cells.length])]), s.engine.status()]);
}

const STEPS = ["무엇을 그릴지 적기", "후보 그리기", "한 장 고르기", "칩셋에 넣기"] as const;

/** 지금 단계(1~4, 다 했으면 5) — 폼·기물 상태·고른 그림이 칩셋에 들어갔는지로 정한다. */
function currentStep(s: WorkshopSession, item: WorkshopItem | null): number {
  if (showForm || !item) return 1;
  const state = itemState(item.key, s.rounds, s.picks);
  if (state === "idle" || state === "drawing") return 2;
  if (state === "choose") return 3;
  const pick = s.picks.find((p) => p.itemKey === item.key);
  const grid = pick ? s.rounds.find((r) => r.id === pick.roundId)?.runs.find((r) => r.letter === pick.letter)?.grid : undefined;
  return grid && isWorkshopPickBaked(item, grid) ? 5 : 4;
}

/** 단계 띠 + 그리는 동안의 진행 막대. 사람이 지금 무엇을 기다리는지·무엇을 할 차례인지 한눈에. */
function stepper(s: WorkshopSession, item: WorkshopItem | null, eta: number): HTMLElement {
  const step = currentStep(s, item);
  const round = item && !showForm ? latestRound(item.key, s.rounds) : null;
  const drawing = item && !showForm && itemState(item.key, s.rounds, s.picks) === "drawing" && round;
  const progress = drawing ? roundProgress(drawing) : null;
  return el("div", {
    class: "workshop-stepper-wrap",
    children: [
      el("ol", {
        class: "workshop-stepper", attrs: { "aria-label": "만드는 순서" }, dataset: { testid: "workshop-stepper", step: String(step) },
        children: STEPS.map((label, index) => {
          const n = index + 1;
          const state = n < step ? "is-done" : n === step ? "is-current" : "is-todo";
          return el("li", {
            class: `workshop-step ${state}`, attrs: n === step ? { "aria-current": "step" } : {},
            children: [el("span", { class: "workshop-step-no", text: n < step ? "✓" : String(n), attrs: { "aria-hidden": "true" } }), el("span", { class: "workshop-step-label", text: label })],
          });
        }),
      }),
      ...(progress ? [el("div", {
        class: "workshop-drawing", dataset: { testid: "workshop-drawing" },
        children: [
          el("div", {
            class: "workshop-bar", attrs: { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(progress.total), "aria-valuenow": String(progress.done), "aria-label": "후보 그리기" },
            children: [el("span", { attrs: { style: `width: ${Math.max(6, Math.round((progress.done / Math.max(1, progress.total)) * 100))}%` } })],
          }),
          el("span", { class: "workshop-drawing-text", text: `후보 ${progress.done}/${progress.total}장 다 그림 · 약 ${Math.max(1, eta)}분 남음. 창을 닫아도 계속 그려요.` }),
        ],
      })] : []),
    ],
  });
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
    class: "workshop",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": "공방", style: "max-width: calc(100% - 24px); max-height: calc(100% - 24px);" },
    dataset: { testid: "workshop" },
    children: [
      el("header", {
        class: "workshop-head",
        children: [
          el("h2", { text: "공방 · 물건·가구" }),
          targetSwitch(s),
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
                  text: `${f === "all" ? "전체" : ITEM_STATE_LABELS[f]} ${visibleItems(s, f).length}`,
                  on: { click: () => { filter = f; selectedKey = null; render(true); } },
                })),
              }),
              el("input", {
                class: "workshop-search", value: query, attrs: { type: "search", placeholder: "찾기", "aria-label": "찾기" },
                on: { input: (event) => { query = (event.target as HTMLInputElement).value; render(true); } },
              }),
              el("button", { class: "workshop-new", text: "+ 새로 만들기", attrs: { type: "button" }, dataset: { testid: "workshop-new-item" }, on: { click: () => { showForm = true; render(true); } } }),
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
            children: [stepper(s, showForm ? null : selected, eta), showForm
              ? renderItemForm(s, (key) => { showForm = false; formDraft = null; selectedKey = key; filter = "all"; render(true); }, () => { showForm = false; formDraft = null; render(true); }, formDraft ?? undefined)
              : selected ? renderRoundView(s, selected, view, () => render(true), closeWorkshop)
              : el("p", { class: "workshop-empty", text: filter === "choose" ? "고를 차례인 물건이 없어요. 다 그리면 여기 나타나요." : "아직 만든 물건이 없어요. 「+ 새로 만들기」를 눌러 주세요." })],
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
  const typing = !!target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
  // 글 쓰는 중에도 Esc 는 닫기(또는 반려 입력 취소)로 통한다. 나머지 키는 입력창의 것이다.
  if (typing && event.key !== "Escape") return;
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
