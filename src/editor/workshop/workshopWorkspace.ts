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
import { getWorkshopSession, type WorkshopSession } from "./workshopSession";
import { QUEUE_MAX_LIMIT, workshopQueue } from "./queue/workshopQueue";
import { retryText } from "./queue/jobModel";
import { etaMinutes, ITEM_STATE_LABELS, itemState, latestRound, roundProgress, type ItemState } from "./workshopStatus";
import { isWorkshopPickBaked } from "./workshopBake";
import { craftBar, generatorStage, workshopEmblem } from "./workshopArt";
import { WORKSHOP_GENERATORS } from "./generators";

type Filter = ItemState | "all";
const FILTERS: Filter[] = ["choose", "drawing", "stopped", "picked", "all"];

let host: HTMLElement | null = null;
let session: WorkshopSession | null = null;
let unsubscribe: (() => void) | null = null;
let unsubscribeQueue: (() => void) | null = null;
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
  // 작업 줄 판이 열려 있으면 알약으로 접는다 — 1280 에서 판이 공방의 「한 장 고르기」 후보를 가렸다(2026-10-21 VQA). 머리 「작업 줄」로 다시 연다.
  void import("./queue/queueDock").then(({ collapseWorkshopQueue }) => collapseWorkshopQueue(true));
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
  unsubscribeQueue = workshopQueue().subscribe(() => render(false));
  void workshopQueue().ensure().then(() => render(false));
  render(true);
}

export function closeWorkshop(): void {
  if (host) void import("./queue/queueDock").then(({ collapseWorkshopQueue }) => collapseWorkshopQueue(false));
  closeGenWorkspace();
  document.removeEventListener("keydown", onKeydown);
  unsubscribe?.();
  unsubscribe = null;
  unsubscribeQueue?.();
  unsubscribeQueue = null;
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
    return only === "all" || shownState(s, item) === only;
  });
}

/**
 * 물건 목록의 상태 — 작업 줄이 그 물건을 멈춰 두었거나(계정 한도·연결 끊김·직접 멈춤) 계정 대기로 붙잡고 있으면 「멈춤」으로 읽는다.
 * 판만 보면 「그리는 중」이라 작업 줄(멈춤)과 어긋났다(2026-10-21 VQA).
 */
function shownState(s: WorkshopSession, item: WorkshopItem): ItemState {
  const view = workshopQueue().itemView(s.harnessId, item.key);
  if (view) {
    if (view.holding || view.state === "paused" || view.state === "failed") return "stopped";
    if (view.state === "queued" || view.state === "reference" || view.state === "drawing" || view.state === "review") return "drawing";
    if (view.state === "ready" || view.state === "installing") return "choose";
  }
  const state = itemState(item.key, s.rounds, s.picks);
  // 작업 줄에 없는 판(빼거나 그만둔 작업)은 그리고 있지도, 이어서 그리지도 않는다 — 「그리는 중」·「잠시 멈춤」으로 세면
  // 작업 줄(그리는 중 0 · 멈춤 1)과 어긋났다. 그 판에 그림이 한 장도 없으면 「고를 차례」도 아니다(오른쪽에 고를 것이 없다,
  // 2026-10-22 VQA) — 고른 적이 있으면 「고름」, 없으면 「아직」(다시 그리기 단추가 보인다).
  if ((state === "drawing" || state === "stopped" || state === "choose") && (!view || view.state === "cancelled")) {
    const round = latestRound(item.key, s.rounds);
    if (state === "choose" && round?.runs.some((run) => run.grid)) return state;
    return s.picks.some((p) => p.itemKey === item.key) ? "picked" : "idle";
  }
  return state;
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
        class: "workshop-filter" + (id === s.harnessId ? " is-active" : "") + (id !== "interior-props" && mapName ? " is-map" : ""),
        attrs: { type: "button", "aria-pressed": String(id === s.harnessId), ...(id !== "interior-props" && mapName ? { title: mapName } : {}) }, dataset: { testid: `workshop-target-${id}` },
        // 칩셋 이름은 데이터라 번역하지 않는 조각으로 따로 둔다(번역기가 이름 속 「·」로 문장을 쪼개지 않게)
        children: id === "interior-props" ? ["실내 가구"] : mapName ? [el("span", { text: "지금 맵 칩셋" }), " ", el("span", { text: mapName, attrs: { translate: "no" } })] : ["맵 물건"],
        on: { click: () => { if (id !== s.harnessId) void openWorkshop(id); } },
      })),
    ],
  });
}

function signature(s: WorkshopSession): string {
  return JSON.stringify([filter, query, selectedKey, showForm, view, s.picks.map((p) => `${p.itemKey}|${p.roundId}|${p.letter}`), s.defs.length,
    s.rounds.map((r) => [r.id, r.runs.map((run) => [run.status, run.attempt, run.verdict?.verdict, run.grid?.cells.length])]), s.engine.status(),
    queueSummary(),
    // 고른 물건의 진행(20칸) — 진행 막대가 장이 끝날 때만이 아니라 그리는 동안에도 차오르게
    selectedKey ? Math.round((workshopQueue().itemView(s.harnessId, selectedKey)?.progress ?? 0) * 20) : 0]);
}

/** 작업 줄 요약(머리줄·막힘 띠가 읽는다) */
function queueSummary(): { active: number; queued: number; ready: number; limit: number; hold: string | null; holdUntil: number | null; readyKeys: string[]; waiting: string[] } {
  const snapshot = workshopQueue().snapshot();
  return {
    active: snapshot.counts.active, queued: snapshot.counts.queued, ready: snapshot.counts.ready, limit: snapshot.limit,
    hold: snapshot.hold?.reason ?? null, holdUntil: snapshot.hold?.until ?? null,
    readyKeys: snapshot.jobs.filter((view) => view.state === "ready").map((view) => `${view.job.harnessId}|${view.job.itemKey ?? ""}`),
    waiting: snapshot.jobs.filter((view) => view.state === "queued" && !view.job.roundId).map((view) => view.job.itemKey ?? ""),
  };
}

/**
 * 작업 줄 멈춤 띠 — 이유와 다시 해 볼 때까지(1초마다). 조각마다 따로 적어 화면 번역이 조각째 맞춘다.
 * 남은 때가 없던 띠는 「언제 풀리나」를 알 수 없었다(2026-10-22 VQA).
 */
function holdLine(reason: string, until: number | null): HTMLElement {
  const when = el("span", { dataset: { testid: "workshop-hold-retry" } });
  const tick = (): void => { if (until !== null) when.textContent = retryText(until - Date.now()); };
  tick();
  const line = el("p", { class: "workshop-blocked", children: [el("span", { text: "작업 줄 멈춤" }), " · ", el("span", { text: reason }), ...(until !== null ? [" · ", when] : [])] });
  if (until !== null) {
    const timer = window.setInterval(() => { if (!line.isConnected) { window.clearInterval(timer); return; } tick(); }, 1000);
  }
  return line;
}

/**
 * 「고를 차례」 칩은 이 화면의 물건을 센다. 작업 줄에서 뺀(또는 줄 밖에서 그린) 물건도 고를 수 있어 작업 줄 수보다 클 수 있다 —
 * 그때만 그 차이를 한 줄로 말한다(두 숫자가 서로 어긋나 보였다, 2026-10-22 VQA).
 */
function outsideQueueNote(s: WorkshopSession, readyKeys: readonly string[]): HTMLElement[] {
  const inQueue = new Set(readyKeys);
  const outside = visibleItems(s, "choose").filter((item) => !inQueue.has(`${s.harnessId}|${item.key}`)).length;
  if (outside <= 0) return [];
  return [el("p", { class: "workshop-outside-note", dataset: { testid: "workshop-outside-queue" }, text: `작업 줄에 없는 물건 ${outside}개도 여기서 고를 수 있어요` })];
}

const STEPS = ["무엇을 그릴지 적기", "후보 그리기", "한 장 고르기", "칩셋에 넣기", "맵에 놓기"] as const;

/** 지금 단계(1~5) — 폼·기물 상태·고른 그림이 칩셋에 들어갔는지로 정한다. 칩셋에 넣었으면 5(맵에 놓기)가 지금 할 일이다. */
function currentStep(s: WorkshopSession, item: WorkshopItem | null): number {
  if (showForm || !item) return 1;
  const state = itemState(item.key, s.rounds, s.picks);
  // 한 장도 못 그린 판(계정 한도·로그인 막힘)은 「후보 그리기」에서 멈춘다 — 고를 것이 없다.
  if (state === "idle" || state === "drawing" || state === "stopped") return 2;
  if (state === "choose") return 3;
  const pick = s.picks.find((p) => p.itemKey === item.key);
  const grid = pick ? s.rounds.find((r) => r.id === pick.roundId)?.runs.find((r) => r.letter === pick.letter)?.grid : undefined;
  return grid && isWorkshopPickBaked(item, grid) ? 5 : 4;
}

/** 줄 목록의 상태 글 — 고른 그림이 이미 칩셋에 들어갔으면 「칩셋에 넣음」. */
function queueLabel(s: WorkshopSession, item: WorkshopItem): string {
  if (queueSummary().waiting.includes(item.key)) return "줄 서는 중";
  const state = shownState(s, item);
  if (state === "picked") {
    const pick = s.picks.find((p) => p.itemKey === item.key);
    const grid = pick ? s.rounds.find((r) => r.id === pick.roundId)?.runs.find((r) => r.letter === pick.letter)?.grid : undefined;
    if (grid && isWorkshopPickBaked(item, grid)) return "칩셋에 넣음";
  }
  return ITEM_STATE_LABELS[state];
}

/** 단계 띠 + 그리는 동안의 진행 막대. 사람이 지금 무엇을 기다리는지·무엇을 할 차례인지 한눈에. */
function stepper(s: WorkshopSession, item: WorkshopItem | null, eta: number): HTMLElement {
  const step = currentStep(s, item);
  const stopped = !!item && !showForm && itemState(item.key, s.rounds, s.picks) === "stopped";
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
          const state = n < step ? "is-done" : n === step ? (stopped ? "is-current is-blocked" : "is-current") : "is-todo";
          return el("li", {
            class: `workshop-step ${state}`, attrs: n === step ? { "aria-current": "step" } : {},
            children: [
              el("span", { class: "workshop-step-no", text: n < step ? "✓" : n === step && stopped ? "!" : String(n), attrs: { "aria-hidden": "true" } }),
              el("span", { class: "workshop-step-label", text: label }),
              ...(n === step && stopped ? [el("span", { class: "workshop-step-flag", text: "멈춤" })] : []),
            ],
          });
        }),
      }),
      ...(progress ? [el("div", {
        class: "workshop-drawing", dataset: { testid: "workshop-drawing" },
        children: [
          // 막대는 작업 줄의 진행(장 안의 그리기·검수까지 센다) — 장 수만 세면 다 될 때까지 0 에 머물렀다
          craftBar({ value: Math.max(0.04, workshopQueue().itemView(s.harnessId, item!.key)?.progress ?? progress.done / Math.max(1, progress.total)), hot: true, label: "후보 그리기" }),
          el("span", { class: "workshop-drawing-text", text: `후보 ${progress.done}/${progress.total}장 다 그림 · 약 ${Math.max(1, eta)}분 남음. 창을 닫아도 계속 그려요.` }),
        ],
      })] : []),
    ],
  });
}

/** 고를 것이 없을 때 — 물건 무대를 보이고 다음 할 일을 말한다. */
function emptyState(): HTMLElement {
  const objectGen = WORKSHOP_GENERATORS.find((g) => g.id === "object-gen");
  return el("div", {
    class: "workshop-empty-state",
    children: [
      ...(objectGen ? [generatorStage(objectGen, "hero")] : []),
      el("p", { class: "workshop-empty", text: filter === "choose" ? "고를 차례인 물건이 없어요. 다 그리면 여기 나타나요." : "아직 만든 물건이 없어요. 「+ 새로 만들기」를 눌러 주세요." }),
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
  const queue = queueSummary();
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
          el("h2", { children: [workshopEmblem(22), el("span", { text: "공방 · 물건·가구" })] }),
          targetSwitch(s),
          el("span", {
            class: "workshop-progress", dataset: { testid: "workshop-progress" },
            // 고를 차례 수는 왼쪽 칩(이 화면의 물건)이 말한다 — 여기서 작업 줄 전체 수를 또 적으면 두 숫자가 어긋나 보였다(2026-10-22 VQA).
            text: queue.active + queue.queued > 0 ? `작업 ${queue.active}개 그리는 중 · ${queue.queued}개 줄 서는 중` : "",
          }),
          el("button", {
            class: "workshop-queue-open", text: "작업 줄", attrs: { type: "button", title: "공방 작업 줄 보기" }, dataset: { testid: "workshop-open-queue" },
            on: { click: () => { void import("./queue/queueDock").then(({ openWorkshopQueue }) => openWorkshopQueue()); } },
          }),
          el("label", {
            class: "workshop-concurrency",
            children: ["동시에", el("select", {
              dataset: { testid: "workshop-concurrency" }, attrs: { "aria-label": "동시에 도는 작업 수" },
              on: { change: (event) => { workshopQueue().setLimit(Number((event.target as HTMLSelectElement).value)); render(true); } },
              children: Array.from({ length: QUEUE_MAX_LIMIT }, (_, i) => i + 1).map((n) => el("option", { value: n, text: `${n}개`, attrs: n === queue.limit ? { selected: "" } : {} })),
            })],
          }),
          el("button", { class: "workshop-close", text: "닫기", attrs: { type: "button", "aria-label": "공방 닫기" }, on: { click: closeWorkshop } }),
        ],
      }),
      // 막힘·경고는 머리줄 밖 한 줄 띠로 — 긴 문구가 머리줄을 밀어 「닫기」가 아래로 떨어지지 않게(2026-10-21 실화면).
      ...(status.blocked || queue.hold || s.store.backend === "memory" ? [el("div", {
        class: "workshop-alert", attrs: { role: "status" }, dataset: { testid: "workshop-alert" },
        children: [
          ...(queue.hold ? [holdLine(queue.hold, queue.holdUntil)] : status.blocked ? [el("p", { class: "workshop-blocked", text: status.blocked })] : []),
          ...(s.store.backend === "memory" ? [el("p", { class: "workshop-blocked", text: "이 브라우저는 저장소를 못 열어 새로 고침하면 후보가 사라집니다." })] : []),
        ],
      })] : []),
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
              ...outsideQueueNote(s, queue.readyKeys),
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
                    dataset: { testid: "workshop-item", key: item.key, state: shownState(s, item) },
                    on: { click: () => { selectedKey = item.key; showForm = false; view.selected = 0; view.rejectFor = null; render(true); } },
                    children: [el("span", { class: "workshop-item-title", text: item.title }), el("span", { class: "workshop-item-meta", text: `${item.category} · ${queueLabel(s, item)}` })],
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
              : emptyState()],
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
