// editor/eventAiQueue/eventAiQueueView.ts
// 작업함의 화면 세 조각: 맵 칸 위 번호 핀, 칸 옆 한 줄 입력창, 캔버스 오른쪽의 작업함.
//
// 흐름: 우클릭 → 「AI로 여기에 이벤트」 → 칸 옆 입력창에 한 줄 → Enter → 곧바로 다음 칸.
// 결과를 기다리지 않는다. 끝난 것은 작업함 맨 위로 올라오고, 사람이 J/K 로 훑으며 Enter 로 배치한다.
//
// 핀은 DOM 이다(mapLocationLayer 와 같은 이유 — 번호 글자와 접근성을 Phaser 텍스처로 다시 만들
// 이유가 없다). 좌표는 반드시 카메라 해석기(resolveRegionClientRect)로 바꾼다. 팬·줌 때마다
// EditScene 이 repositionEventAiQueuePins() 를 불러 노드는 두고 좌표만 고쳐 쓴다.

import { editorState } from "@/editor/editorState";
import { resolveRegionClientRect } from "@/editor/regionClientRect";
import { editorMapTileSize } from "@/editor/mapGeometry";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import {
  EVENT_AI_QUEUE_MAX_CONCURRENCY,
  eventAiQueue,
  watchEventAiQueueProject,
  type EventAiJob,
  type EventAiJobState,
} from "./eventAiQueue";

const STATE_LABEL: Readonly<Record<EventAiJobState, string>> = {
  queued: "대기",
  running: "만드는 중",
  ready: "확인 대기",
  failed: "막힘",
  placed: "배치됨",
};

/** 사람이 먼저 봐야 하는 순서 — 막힘·확인이 위, 끝난 것은 아래. */
const STATE_ORDER: Readonly<Record<EventAiJobState, number>> = { failed: 0, ready: 1, running: 2, queued: 3, placed: 4 };

const PROMPT_EXAMPLES: readonly { readonly label: string; readonly prompt: string }[] = [
  { label: "보물상자", prompt: "열면 회복약 2개를 주고, 이미 열었으면 «비어 있다»고 말한다" },
  { label: "주민 대사", prompt: "마을 소문을 한 줄 말하는 주민" },
  { label: "표지판", prompt: "«북쪽: 숲 / 동쪽: 항구» 라고 적힌 표지판" },
  { label: "한 번만 대화", prompt: "처음 말 걸면 인사하고, 두 번째부터는 «또 왔군» 이라고만 말하는 노인" },
];

let pinLayer: HTMLElement | null = null;
let tray: HTMLElement | null = null;
let popover: HTMLElement | null = null;
let selectedJobId: number | null = null;
let lastPrompt = PROMPT_EXAMPLES[0]!.prompt;
let unsubscribe: (() => void) | null = null;
let unsubscribeEditor: (() => void) | null = null;
let trayCollapsed = false;

function canvasHost(): HTMLElement | null {
  const host = document.querySelector<HTMLElement>('[data-testid="edit-canvas"]');
  if (!host) return null;
  if (typeof getComputedStyle === "function" && getComputedStyle(host).position === "static") host.style.position = "relative";
  return host;
}

function currentMapId(): MapId | null {
  return editorState.get().currentMapId;
}

function cellRect(x: number, y: number, layer: HTMLElement): { left: number; top: number; size: number } {
  const client = resolveRegionClientRect({ x, y, width: 1, height: 1 });
  const bounds = layer.getBoundingClientRect?.();
  if (client && bounds) return { left: client.x - bounds.left, top: client.y - bounds.top, size: client.width };
  const size = editorMapTileSize() * (editorState.get().zoom ?? 1);
  return { left: x * size, top: y * size, size };
}

function ensurePinLayer(): HTMLElement | null {
  if (pinLayer?.isConnected) return pinLayer;
  const host = canvasHost();
  if (!host) return null;
  pinLayer = el("div", { class: "event-ai-pin-layer", attrs: { "aria-hidden": "true" }, dataset: { testid: "event-ai-pin-layer" } });
  host.append(pinLayer);
  return pinLayer;
}

function renderPins(): void {
  const layer = ensurePinLayer();
  if (!layer) return;
  const mapId = currentMapId();
  const jobs = eventAiQueue.list().filter((job) => job.mapId === mapId && job.state !== "placed");
  layer.replaceChildren(...jobs.map((job) => el("span", {
    class: "event-ai-pin" + (job.id === selectedJobId ? " is-selected" : ""),
    text: String(job.id),
    dataset: { state: job.state, jobId: String(job.id), x: String(job.x), y: String(job.y), testid: "event-ai-pin" },
  })));
  repositionEventAiQueuePins();
}

/** 카메라가 움직이면 EditScene 이 부른다. 노드는 그대로, 좌표만. */
export function repositionEventAiQueuePins(): void {
  const layer = pinLayer;
  if (!layer?.isConnected) return;
  for (const pin of layer.querySelectorAll<HTMLElement>(".event-ai-pin")) {
    const rect = cellRect(Number(pin.dataset.x), Number(pin.dataset.y), layer);
    pin.style.left = rect.left + "px";
    pin.style.top = rect.top + "px";
    pin.style.width = rect.size + "px";
    pin.style.height = rect.size + "px";
  }
  if (popover?.isConnected) placePopover(popover);
}

function sortedJobs(): EventAiJob[] {
  return [...eventAiQueue.list()].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.id - b.id);
}

function selectJob(id: number | null, focus = false): void {
  selectedJobId = id;
  renderTray();
  renderPins();
  if (focus && id !== null) tray?.querySelector<HTMLElement>('[data-job-id="' + id + '"]')?.focus();
}

function nextAttentionJob(): EventAiJob | undefined {
  return sortedJobs().find((job) => job.state === "ready" || job.state === "failed");
}

function actOnSelected(action: "place" | "discard" | "retry"): void {
  const job = selectedJobId === null ? undefined : eventAiQueue.get(selectedJobId);
  if (!job) return;
  if (action === "place") {
    if (!eventAiQueue.place(job.id)) return;
  } else if (action === "discard") eventAiQueue.discard(job.id);
  else eventAiQueue.retry(job.id);
  selectedJobId = nextAttentionJob()?.id ?? (action === "place" ? job.id : null);
  renderTray();
  renderPins();
  if (selectedJobId !== null) tray?.querySelector<HTMLElement>('[data-job-id="' + selectedJobId + '"]')?.focus();
}

function jobDetail(job: EventAiJob): HTMLElement {
  const where = "(" + job.x + "," + job.y + ")";
  const header = el("div", {
    class: "event-ai-card-head",
    children: [
      el("strong", { text: job.id + ". " + (job.draft?.title ?? "새 이벤트") }),
      el("span", { text: where + " · " + STATE_LABEL[job.state] }),
    ],
  });
  const prompt = el("p", { class: "event-ai-card-prompt", text: "«" + job.prompt + "»" });
  const body: HTMLElement[] = [header, prompt];
  if ((job.state === "ready" || job.state === "placed") && job.draft) {
    body.push(el("ol", {
      class: "event-ai-card-pages",
      attrs: { "aria-label": "페이지" },
      children: job.draft.pages.map((page, index) => el("li", {
        children: [
          el("span", { class: "event-ai-card-page-name", text: (index + 1) + " " + page.name }),
          el("span", {
            class: "event-ai-card-page-meta",
            text: [page.graphicLabel, page.triggerLabel, page.conditionLabel, "명령 " + page.commandCount + "개"].filter(Boolean).join(" · "),
          }),
        ],
      })),
    }));
  }
  if (job.state === "failed" && job.error) {
    body.push(el("p", { class: "event-ai-card-error", attrs: { role: "alert" }, text: job.error }));
  }
  if (job.state === "running" || job.state === "queued") {
    body.push(el("p", { class: "event-ai-card-stage", text: job.stage }));
  }
  const actions = el("div", { class: "event-ai-card-actions" });
  const button = (label: string, testid: string, onClick: () => void, primary = false, kbd?: string): HTMLButtonElement => el("button", {
    class: "event-ai-btn" + (primary ? " is-primary" : ""),
    attrs: { type: "button" },
    dataset: { testid },
    children: [label, ...(kbd ? [el("kbd", { text: kbd })] : [])],
    on: { click: onClick },
  }) as HTMLButtonElement;
  if (job.state === "ready") {
    actions.append(
      button("배치", "event-ai-place", () => actOnSelected("place"), true, "Enter"),
      button("다시", "event-ai-retry", () => actOnSelected("retry")),
      el("span", { class: "event-ai-spacer" }),
      button("버리기", "event-ai-discard", () => actOnSelected("discard"), false, "X"),
    );
  } else if (job.state === "failed") {
    actions.append(
      button("다시 만들기", "event-ai-retry", () => actOnSelected("retry"), true),
      el("span", { class: "event-ai-spacer" }),
      button("버리기", "event-ai-discard", () => actOnSelected("discard"), false, "X"),
    );
  } else if (job.state === "placed") {
    actions.append(el("span", { class: "event-ai-card-note", text: "저장됨 · Ctrl+Z 로 이 이벤트만 되돌리기" }));
  } else {
    actions.append(el("span", { class: "event-ai-spacer" }), button("취소", "event-ai-discard", () => actOnSelected("discard")));
  }
  body.push(actions);
  return el("section", { class: "event-ai-card", attrs: { "aria-label": "선택한 작업" }, dataset: { testid: "event-ai-card" }, children: body });
}

function renderTray(): void {
  if (!tray) return;
  const jobs = sortedJobs();
  const counts = eventAiQueue.counts();
  if (jobs.length === 0) {
    tray.hidden = true;
    return;
  }
  tray.hidden = false;
  tray.classList.toggle("is-collapsed", trayCollapsed);
  if (selectedJobId !== null && !eventAiQueue.get(selectedJobId)) selectedJobId = null;
  if (selectedJobId === null) selectedJobId = nextAttentionJob()?.id ?? null;
  const selected = selectedJobId === null ? undefined : eventAiQueue.get(selectedJobId);

  const countLine = el("div", {
    class: "event-ai-counts",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "event-ai-counts" },
    children: (["failed", "ready", "running", "queued", "placed"] as const).map((state) => el("span", {
      class: "event-ai-count",
      dataset: { state },
      text: STATE_LABEL[state] + " " + counts[state],
    })),
  });
  const concurrency = el("input", {
    attrs: { type: "range", min: "1", max: String(EVENT_AI_QUEUE_MAX_CONCURRENCY), "aria-label": "동시 실행 수" },
    value: eventAiQueue.settings.concurrency,
    dataset: { testid: "event-ai-concurrency" },
    on: { input: (event) => eventAiQueue.setConcurrency(Number((event.target as HTMLInputElement).value)) },
  }) as HTMLInputElement;
  const auto = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-ai-autoplace" },
    on: { change: (event) => eventAiQueue.setAutoPlace((event.target as HTMLInputElement).checked) },
  }) as HTMLInputElement;
  auto.checked = eventAiQueue.settings.autoPlace;

  const header = el("div", {
    class: "event-ai-tray-head",
    children: [
      el("h2", { text: "AI 작업함" }),
      el("span", { class: "event-ai-tray-total", text: "전체 " + jobs.length }),
      el("button", {
        class: "event-ai-icon-btn",
        attrs: { type: "button", "aria-expanded": String(!trayCollapsed), "aria-label": trayCollapsed ? "작업함 펼치기" : "작업함 접기" },
        dataset: { testid: "event-ai-tray-toggle" },
        text: trayCollapsed ? "▸" : "▾",
        on: { click: () => { trayCollapsed = !trayCollapsed; renderTray(); } },
      }),
    ],
  });
  const settings = el("div", {
    class: "event-ai-settings",
    children: [
      el("label", { children: ["동시 " + eventAiQueue.settings.concurrency, concurrency] }),
      el("label", { children: [auto, "검사 통과 시 바로 배치"] }),
    ],
  });
  const list = el("div", {
    class: "event-ai-list",
    attrs: { role: "listbox", "aria-label": "작업 목록" },
    dataset: { testid: "event-ai-list" },
    children: jobs.map((job) => el("button", {
      class: "event-ai-job" + (job.id === selectedJobId ? " is-selected" : ""),
      attrs: { type: "button", role: "option", "aria-selected": String(job.id === selectedJobId) },
      dataset: { jobId: String(job.id), state: job.state, testid: "event-ai-job" },
      children: [
        el("span", { class: "event-ai-job-no", dataset: { state: job.state }, text: String(job.id) }),
        el("span", { class: "event-ai-job-title", text: (job.draft?.title ?? job.prompt) + " · " + job.x + "," + job.y }),
        el("span", { class: "event-ai-job-state", text: STATE_LABEL[job.state] }),
      ],
      // 다시 그리면 눌린 단추가 문서에서 빠져 초점이 body 로 샌다 — 새 단추로 초점을 옮겨야 J/K/Enter 가 이어진다.
      on: { click: () => selectJob(job.id, true) },
    })),
  });
  const footer = el("div", {
    class: "event-ai-tray-foot",
    children: [
      el("button", {
        class: "event-ai-btn is-primary",
        attrs: { type: "button", ...(counts.ready === 0 ? { disabled: "true" } : {}) },
        dataset: { testid: "event-ai-place-all" },
        text: "확인 대기 " + counts.ready + "개 모두 배치",
        on: { click: () => { const placed = eventAiQueue.placeAllReady(); if (placed > 0) toast("AI 이벤트 " + placed + "개를 배치했어요", "ok"); } },
      }),
      counts.placed > 0 ? el("button", {
        class: "event-ai-btn",
        attrs: { type: "button" },
        dataset: { testid: "event-ai-clear-placed" },
        text: "배치된 것 치우기",
        on: { click: () => eventAiQueue.clearPlaced() },
      }) : el("span"),
      el("span", { class: "event-ai-keys", text: "J K 이동 · Enter 배치 · X 버리기" }),
    ],
  });
  tray.replaceChildren(header, ...(trayCollapsed ? [countLine] : [countLine, settings, list, ...(selected ? [jobDetail(selected)] : []), footer]));
}

function onTrayKeyDown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target?.matches("input, textarea")) return;
  const jobs = sortedJobs();
  const index = jobs.findIndex((job) => job.id === selectedJobId);
  if (event.key === "j" || event.key === "k" || event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "j" || event.key === "ArrowDown" ? 1 : -1;
    const next = jobs[Math.max(0, Math.min(jobs.length - 1, index + step))];
    if (next) selectJob(next.id, true);
    return;
  }
  if (event.key === "Enter" && !target?.closest(".event-ai-card-actions, .event-ai-tray-foot, .event-ai-tray-head")) {
    event.preventDefault();
    actOnSelected("place");
    return;
  }
  if (event.key === "x" || event.key === "X" || event.key === "Delete") {
    event.preventDefault();
    actOnSelected("discard");
  }
}

function ensureTray(): HTMLElement | null {
  if (tray?.isConnected) return tray;
  const area = document.querySelector<HTMLElement>(".canvas-area");
  if (!area) return null;
  tray = el("aside", {
    class: "event-ai-tray",
    attrs: { "aria-label": "AI 작업함" },
    dataset: { testid: "event-ai-tray" },
  });
  tray.hidden = true;
  tray.addEventListener("keydown", onTrayKeyDown);
  area.append(tray);
  return tray;
}

function placePopover(node: HTMLElement): void {
  const host = canvasHost();
  const x = Number(node.dataset.x);
  const y = Number(node.dataset.y);
  const client = resolveRegionClientRect({ x, y, width: 1, height: 1 });
  const bounds = host?.getBoundingClientRect?.();
  if (!client || !bounds) return;
  const width = node.offsetWidth || 320;
  const height = node.offsetHeight || 150;
  let left = client.x - bounds.left + client.width + 8;
  if (left + width > bounds.width - 8) left = client.x - bounds.left - width - 8;
  let top = client.y - bounds.top - 12;
  top = Math.max(8, Math.min(top, bounds.height - height - 8));
  node.style.left = Math.max(8, left) + "px";
  node.style.top = top + "px";
}

export function closeEventAiPromptPopover(): void {
  if (!popover) return;
  unregisterModal(popover);
  popover.remove();
  popover = null;
  editorState.set({ pendingEventCoordinate: null });
}

/** 우클릭 메뉴의 「AI로 여기에 이벤트」. 칸 옆에 한 줄 입력창을 띄운다. */
export function openEventAiPromptPopover(mapId: MapId, x: number, y: number): void {
  closeEventAiPromptPopover();
  const host = canvasHost();
  if (!host) return;
  mountEventAiQueueView();
  const map = store.getCurrent().maps[mapId];
  if (!map) return;
  const input = el("input", {
    class: "event-ai-prompt-input",
    attrs: { type: "text", "aria-label": "(" + x + "," + y + ") 이벤트 설명", maxlength: "400", placeholder: "무엇을 하는 이벤트인지 한 줄로" },
    value: lastPrompt,
    dataset: { testid: "event-ai-prompt-input" },
  }) as HTMLInputElement;
  const status = el("p", { class: "event-ai-prompt-status", attrs: { role: "alert" }, dataset: { testid: "event-ai-prompt-status" } });
  const submit = (): void => {
    const prompt = input.value.trim();
    if (!prompt) {
      status.textContent = "무엇을 하는 이벤트인지 한 줄 적어 주세요.";
      return;
    }
    if (!eventAiQueue.configReady()) {
      status.textContent = "AI 설정에서 연결과 모델을 먼저 확인하세요.";
      return;
    }
    const job = eventAiQueue.enqueue(mapId, x, y, prompt);
    if (!job) {
      status.textContent = "이 칸에는 이미 이벤트나 작업이 있어요.";
      return;
    }
    lastPrompt = prompt;
    closeEventAiPromptPopover();
    toast("(" + x + "," + y + ") 작업 " + job.id + "번을 맡겼어요. 다른 칸을 계속 누르세요.", "info");
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });
  const chips = el("div", {
    class: "event-ai-prompt-chips",
    attrs: { role: "group", "aria-label": "예시" },
    children: PROMPT_EXAMPLES.map((example) => el("button", {
      class: "event-ai-chip",
      attrs: { type: "button", title: example.prompt },
      text: example.label,
      on: { click: () => { input.value = example.prompt; status.textContent = ""; input.focus(); input.select(); } },
    })),
  });
  popover = el("div", {
    class: "event-ai-prompt",
    attrs: { role: "dialog", "aria-label": "(" + x + "," + y + ")에 AI 이벤트" },
    dataset: { testid: "event-ai-prompt", x: String(x), y: String(y) },
    children: [
      el("div", {
        class: "event-ai-prompt-head",
        children: [
          el("strong", { text: "(" + x + "," + y + ")에 이벤트" }),
          el("span", { text: "Enter 맡기고 계속 · Esc" }),
        ],
      }),
      input,
      chips,
      status,
      el("div", {
        class: "event-ai-prompt-actions",
        children: [
          el("span", { class: "event-ai-prompt-note", text: "만드는 동안 다른 칸에 계속 부탁할 수 있어요" }),
          el("button", { class: "event-ai-btn is-primary", attrs: { type: "button" }, dataset: { testid: "event-ai-prompt-submit" }, text: "맡기기", on: { click: submit } }),
        ],
      }),
    ],
  });
  host.append(popover);
  placePopover(popover);
  editorState.set({ pendingEventCoordinate: { mapId, x, y } });
  registerModal(popover, closeEventAiPromptPopover);
  input.focus();
  input.select();
}

/** 편집기 부팅에서 부른다. 두 번 불러도 한 번만 붙는다. */
export function mountEventAiQueueView(): void {
  watchEventAiQueueProject();
  ensureTray();
  ensurePinLayer();
  if (!unsubscribe) {
    unsubscribe = eventAiQueue.subscribe(() => {
      renderTray();
      renderPins();
    });
  }
  if (!unsubscribeEditor) {
    let lastMap = currentMapId();
    unsubscribeEditor = editorState.subscribe((state) => {
      if (state.currentMapId === lastMap) return;
      lastMap = state.currentMapId;
      closeEventAiPromptPopover();
      renderPins();
    });
  }
  renderTray();
  renderPins();
}

export function unmountEventAiQueueView(): void {
  closeEventAiPromptPopover();
  unsubscribe?.();
  unsubscribe = null;
  unsubscribeEditor?.();
  unsubscribeEditor = null;
  tray?.remove();
  tray = null;
  pinLayer?.remove();
  pinLayer = null;
}
