// 이벤트 편집기 맨 아래 「한 줄 고치기」(목업 v2). 조수 창 대신 한 줄에 적고 Enter 하면
// 미리보기·확인 없이 이 이벤트가 바로 바뀐다. 바뀐 카드는 2.5초 노란 테두리, 위에 「무엇이 바뀌었나」 한 줄,
// 옆에 되돌리기(남은 단계 수). 못 알아들으면 아무것도 바꾸지 않고 이유 한 줄만 남긴다.
//
// 범위는 지금 연 이벤트 하나(모든 페이지)의 명령이다. 조수 초안(`deferApply`)이 그 밖을 건드리면 통째로 버린다.
// 적용은 페이지마다 명령 기록(commandToolbarHistory)을 거치므로 Ctrl+Z 와 같은 기록에 쌓인다.
import { discardAiAssistantProposal, getAiAssistantStatus, sendAiAssistantMessage, abortAiAssistantTurn } from "@/editor/aiAssistantBridge";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { jsonEqual } from "@/util/structuralJson";
import { countCommandDiff, diffCommandLists, hasCommandDiffChanges, type CommandDiffRow } from "./commandDiff";
import { viewLevelHintFor, type ViewLevelSignal } from "./viewLevelHint";

export const EVENT_EDIT_HIGHLIGHT_MS = 2500;

export interface EventEditPageChange {
  readonly pageId: string;
  readonly before: readonly Command[];
  readonly after: readonly Command[];
}

interface EditStep {
  readonly changes: readonly EventEditPageChange[];
  readonly summary: string;
}

interface LineState {
  steps: EditStep[];
  status: { text: string; kind: "ok" | "fail" | "busy" | "hint" | "" };
  draft: string;
  busy: boolean;
  changed: Map<string, Set<string>>;
  changedAt: number;
  undoCount: number;
}

const states = new Map<string, LineState>();
let statesProject = "";
let liveInput: HTMLInputElement | null = null;
let liveSetStatus: ((text: string, kind: LineState["status"]["kind"]) => void) | null = null;
const undoListeners = new Set<(eventKey: string, count: number) => void>();

function keyOf(mapId: MapId, eventId: string): string {
  const identity = store.getProjectIdentity();
  const project = `${identity.kind}:${identity.id}`;
  if (project !== statesProject) {
    states.clear();
    statesProject = project;
  }
  return `${mapId}:${eventId}`;
}

function stateOf(key: string): LineState {
  let state = states.get(key);
  if (!state) {
    state = { steps: [], status: { text: "", kind: "" }, draft: "", busy: false, changed: new Map(), changedAt: 0, undoCount: 0 };
    states.set(key, state);
  }
  return state;
}

/** 말로 고친 것을 되돌린 횟수(이 이벤트). 신호 기반 「보통」 제안이 듣는다. */
export function onEventEditLineUndo(listener: (eventKey: string, count: number) => void): () => void {
  undoListeners.add(listener);
  return () => undoListeners.delete(listener);
}

/** 이 페이지에서 방금 바뀐 맨 위 명령 경로(JSON). 2.5초가 지나면 빈 집합. */
export function eventEditLineChangedPaths(mapId: MapId, eventId: string, pageId: string, now = Date.now()): ReadonlySet<string> {
  const state = states.get(keyOf(mapId, eventId));
  if (!state || now - state.changedAt > EVENT_EDIT_HIGHLIGHT_MS) return new Set();
  return state.changed.get(pageId) ?? new Set();
}

/** 우클릭 「AI 로 이벤트 …」 같은 입구가 열린 편집기의 입력칸으로 초점을 준다. */
export function focusEventEditLine(): boolean {
  if (!liveInput?.isConnected) return false;
  liveInput.focus();
  return true;
}

/** 막히는 신호 하나. 보기 제안이 나오면(쉬움·보통, 14일 안 처음) 열린 편집기의 요약줄 자리에 한 줄 띄운다. */
export function noteViewLevelSignal(signal: ViewLevelSignal): boolean {
  if (!liveInput?.isConnected || !liveSetStatus) return false;
  const hint = viewLevelHintFor(signal);
  if (!hint) return false;
  liveSetStatus(hint, "hint");
  return true;
}

export function resetEventEditLineForTest(): void {
  states.clear();
  statesProject = "";
  liveInput = null;
  liveSetStatus = null;
  undoListeners.clear();
}

/** 맨 위 명령 경로 중 바뀐 것(지운 줄은 그 뒤 줄 자리). */
export function changedTopLevelPaths(before: readonly Command[], after: readonly Command[]): Set<string> {
  const rows = diffCommandLists(before, after);
  const changed = new Set<string>();
  let afterIndex = 0;
  for (const row of rows) {
    if (row.status === "remove") {
      changed.add(JSON.stringify([Math.min(afterIndex, Math.max(0, after.length - 1))]));
      continue;
    }
    if (row.status !== "keep" || hasCommandDiffChanges([row])) changed.add(JSON.stringify([afterIndex]));
    afterIndex += 1;
  }
  return changed;
}

function fieldOf(value: object | undefined, key: string): unknown {
  return value === undefined ? undefined : (value as unknown as Record<string, unknown>)[key];
}

function eventOf(project: Project, mapId: MapId, eventId: string): GameEvent | undefined {
  return project.maps[mapId]?.events.find((event) => event.id === eventId);
}

/**
 * 초안이 이 이벤트의 페이지 명령만 바꿨는지. 바꿨으면 페이지별 변경, 아니면 이유.
 * 이벤트 밖(다른 이벤트·맵·자료집)이나 이 이벤트의 명령 아닌 칸(그림·조건)이 바뀌면 거절한다.
 */
export function eventOnlyCommandChanges(
  before: Project, after: Project, mapId: MapId, eventId: string,
): { ok: true; changes: EventEditPageChange[] } | { ok: false; reason: string } {
  const outside = "이 이벤트 밖까지 바꾸려 해서 하나도 바꾸지 않았어요.";
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === "maps") continue;
    if (!jsonEqual(fieldOf(before, key), fieldOf(after, key))) return { ok: false, reason: outside };
  }
  for (const id of new Set([...Object.keys(before.maps), ...Object.keys(after.maps)])) {
    const oldMap = before.maps[id];
    const newMap = after.maps[id];
    if (id !== mapId) {
      if (!jsonEqual(oldMap, newMap)) return { ok: false, reason: outside };
      continue;
    }
    if (!oldMap || !newMap) return { ok: false, reason: outside };
    for (const field of new Set([...Object.keys(oldMap), ...Object.keys(newMap)])) {
      if (field === "events") continue;
      if (!jsonEqual(fieldOf(oldMap, field), fieldOf(newMap, field))) return { ok: false, reason: outside };
    }
    if (oldMap.events.length !== newMap.events.length) return { ok: false, reason: outside };
    for (let index = 0; index < oldMap.events.length; index += 1) {
      const a = oldMap.events[index]!;
      const b = newMap.events[index]!;
      if (a.id !== b.id) return { ok: false, reason: outside };
      if (a.id !== eventId && !jsonEqual(a, b)) return { ok: false, reason: outside };
    }
  }
  const oldEvent = eventOf(before, mapId, eventId);
  const newEvent = eventOf(after, mapId, eventId);
  if (!oldEvent || !newEvent) return { ok: false, reason: "고칠 이벤트를 찾지 못했어요." };
  const { pages: oldPages = [], ...oldRest } = oldEvent;
  const { pages: newPages = [], ...newRest } = newEvent;
  const shape = "명령 말고 이벤트 설정(모습·조건·페이지)까지 바꾸려 해서 하나도 바꾸지 않았어요.";
  if (!jsonEqual(oldRest, newRest) || oldPages.length !== newPages.length) return { ok: false, reason: shape };
  const changes: EventEditPageChange[] = [];
  for (let index = 0; index < oldPages.length; index += 1) {
    const { commands: oldCommands, ...oldPage } = oldPages[index]!;
    const { commands: newCommands, ...newPage } = newPages[index]!;
    if (!jsonEqual(oldPage, newPage)) return { ok: false, reason: shape };
    if (!jsonEqual(oldCommands, newCommands)) changes.push({ pageId: oldPages[index]!.id, before: oldCommands, after: newCommands });
  }
  return { ok: true, changes };
}

function pageLabel(pages: readonly EventPage[], pageId: string): string {
  const index = pages.findIndex((page) => page.id === pageId);
  const name = pages[index]?.name?.trim();
  return name || `${index + 1}페이지`;
}

/** 「무엇이 바뀌었나」 한 줄: 무엇을 · 어디(페이지). 조수의 마지막 말이 짧으면 그것을 앞에 쓴다. */
export function editStepSummary(changes: readonly EventEditPageChange[], pages: readonly EventPage[], assistantText?: string): string {
  const rows: CommandDiffRow[] = changes.flatMap((change) => diffCommandLists(change.before, change.after));
  const counts = countCommandDiff(rows, new Set());
  const parts: string[] = [];
  if (counts.changed > 0) parts.push(`${counts.changed}줄 고침`);
  if (counts.added > 0) parts.push(`${counts.added}줄 더함`);
  if (counts.removed > 0) parts.push(`${counts.removed}줄 지움`);
  const where = changes.map((change) => pageLabel(pages, change.pageId)).join(" · ");
  const said = assistantText?.replace(/\s+/gu, " ").trim().split(/(?<=[.!?。])\s/u)[0] ?? "";
  const head = said && said.length <= 60 ? said : parts.join(" · ");
  return [head, where].filter(Boolean).join(" · ");
}

export interface EventEditLineOptions {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly activePageId: string;
  readonly pages: readonly EventPage[];
  /** 페이지마다 명령 기록을 거쳐 바꾼다(Ctrl+Z 와 같은 기록). */
  readonly applyPage: (pageId: string, commands: readonly Command[]) => void;
  readonly undoPage: (pageId: string) => void;
}

function livePageCommands(mapId: MapId, eventId: string, pageId: string): readonly Command[] | undefined {
  return eventOf(store.getCurrent(), mapId, eventId)?.pages?.find((page) => page.id === pageId)?.commands;
}

/** Ctrl+Z 로 이미 되돌린 단계는 기록에서 뺀다 — 단계의 결과가 지금 명령과 같아야 산 단계다. */
function pruneUndoneSteps(state: LineState, mapId: MapId, eventId: string): void {
  while (state.steps.length > 0) {
    const last = state.steps[state.steps.length - 1]!;
    const alive = last.changes.every((change) => jsonEqual(livePageCommands(mapId, eventId, change.pageId), change.after));
    if (alive) return;
    state.steps.pop();
  }
}

function eventName(mapId: MapId, eventId: string): string {
  return eventOf(store.getCurrent(), mapId, eventId)?.name?.trim() || eventId;
}

function promptFor(options: EventEditLineOptions, text: string): string {
  const pages = options.pages.map((page, index) => `${index + 1}「${page.name?.trim() || `페이지 ${index + 1}`}」(pageId ${page.id})`).join(", ");
  const active = options.pages.findIndex((page) => page.id === options.activePageId) + 1;
  return [
    `[이벤트 편집기 한 줄 고치기] 지금 연 이벤트: 「${eventName(options.mapId, options.eventId)}」 (mapId ${options.mapId}, eventId ${options.eventId}).`,
    `페이지: ${pages}. 사용자가 보고 있는 페이지: ${active}.`,
    "이 이벤트의 페이지 명령만 고친다. 다른 이벤트·맵·자료집과 이 이벤트의 모습·조건은 바꾸지 않는다. 요청이 여러 페이지에 걸리면 해당 페이지를 모두 고친다.",
    `요청: ${text}`,
  ].join("\n");
}

export function renderEventEditLine(options: EventEditLineOptions): HTMLElement {
  const key = keyOf(options.mapId, options.eventId);
  const state = stateOf(key);
  pruneUndoneSteps(state, options.mapId, options.eventId);

  const summary = el("p", {
    class: "event-edit-line-summary",
    text: state.status.text,
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "event-edit-line-summary", kind: state.status.kind },
  });
  summary.hidden = !state.status.text;
  const input = el("input", {
    class: "event-edit-line-input",
    attrs: {
      type: "text",
      placeholder: "이 이벤트를 어떻게 고칠까요? 적고 Enter",
      "aria-label": "이 이벤트를 말로 고치기",
      enterkeyhint: "send",
    },
    dataset: { testid: "event-edit-line-input" },
  }) as HTMLInputElement;
  input.value = state.draft;
  input.disabled = state.busy;
  const undoCount = el("span", { class: "event-edit-line-undo-count", text: String(state.steps.length) });
  const undo = el("button", {
    class: "event-edit-line-undo",
    attrs: { type: "button", title: "말로 고친 것을 한 단계 되돌립니다 (Ctrl+Z)", "aria-label": `되돌리기, ${state.steps.length}단계`, "aria-keyshortcuts": "Control+z Meta+z" },
    dataset: { testid: "event-edit-line-undo" },
    children: [el("span", { class: "event-edit-line-undo-label", text: "되돌리기" }), undoCount],
  }) as HTMLButtonElement;
  undo.hidden = state.steps.length === 0;

  const setStatus = (text: string, kind: LineState["status"]["kind"]): void => {
    state.status = { text, kind };
    if (!summary.isConnected) return;
    summary.textContent = text;
    summary.dataset.kind = kind;
    summary.hidden = !text;
  };

  const run = async (): Promise<void> => {
    const text = input.value.trim();
    if (!text || state.busy) return;
    if (getAiAssistantStatus().turnBusy) {
      setStatus("조수가 다른 일을 하고 있어요. 끝난 뒤 다시 Enter 하세요.", "fail");
      return;
    }
    state.busy = true;
    state.draft = text;
    input.disabled = true;
    const started = performance.now();
    setStatus("고치는 중…", "busy");
    const ticker = setInterval(() => {
      if (state.busy) setStatus(`고치는 중… ${Math.floor((performance.now() - started) / 1000)}초`, "busy");
    }, 1000);
    try {
      const response = await sendAiAssistantMessage(promptFor(options, text), { deferApply: true });
      if (!response.ok) throw new Error(response.error || "조수를 부르지 못했어요.");
      const proposal = response.pendingProposal;
      if (!proposal) throw new Error(response.lastAssistantText?.trim() || "바꿀 곳을 찾지 못했어요. 무엇을 어디서 바꿀지 다시 말해 주세요.");
      const checked = eventOnlyCommandChanges(proposal.before, proposal.after, options.mapId, options.eventId);
      discardAiAssistantProposal();
      if (!checked.ok) throw new Error(checked.reason);
      if (checked.changes.length === 0) throw new Error("바뀌는 것이 없었어요. 무엇을 어디서 바꿀지 다시 말해 주세요.");
      for (const change of checked.changes) {
        if (!jsonEqual(livePageCommands(options.mapId, options.eventId, change.pageId), change.before)) {
          throw new Error("고치는 사이 이벤트가 바뀌었어요. 다시 Enter 하세요.");
        }
      }
      const line = editStepSummary(checked.changes, options.pages, response.lastAssistantText);
      state.steps.push({ changes: checked.changes, summary: line });
      state.changed = new Map(checked.changes.map((change) => [change.pageId, changedTopLevelPaths(change.before, change.after)]));
      state.changedAt = Date.now();
      state.draft = "";
      state.busy = false;
      setStatus(line, "ok");
      for (const change of checked.changes) options.applyPage(change.pageId, change.after);
      scheduleHighlightClear();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      setStatus(`못 고쳤어요: ${reason}`, "fail");
    } finally {
      clearInterval(ticker);
      state.busy = false;
      // 적용이 스토어를 바꾸면 본문이 다시 그려져 이 입력칸은 문서에서 떨어진다. 살아 있는 칸을 다시 연다.
      const live = liveInput?.isConnected ? liveInput : input;
      live.disabled = false;
      live.value = state.draft;
      live.focus();
    }
  };

  input.addEventListener("input", () => { state.draft = input.value; });
  input.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      void run();
    } else if (event.key === "Escape" && state.busy) {
      event.preventDefault();
      event.stopPropagation();
      abortAiAssistantTurn();
    }
  });
  undo.addEventListener("click", () => {
    pruneUndoneSteps(state, options.mapId, options.eventId);
    const step = state.steps.pop();
    if (!step) return;
    state.undoCount += 1;
    state.changed = new Map();
    setStatus(`되돌렸어요: ${step.summary}`, "ok");
    for (const change of step.changes) options.undoPage(change.pageId);
    for (const listener of [...undoListeners]) listener(key, state.undoCount);
    if (state.undoCount === 2) noteViewLevelSignal("undo-twice");
  });

  liveInput = input;
  liveSetStatus = setStatus;
  return el("div", {
    class: "event-edit-line",
    dataset: { testid: "event-edit-line" },
    children: [
      summary,
      el("div", { class: "event-edit-line-row", children: [input, undo] }),
    ],
  });
}

let highlightTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleHighlightClear(): void {
  if (highlightTimer !== null) clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => {
    highlightTimer = null;
    if (typeof document === "undefined") return;
    for (const node of document.querySelectorAll(".event-scene-card.is-changed, .cmd-item.is-line-changed")) {
      node.classList.remove("is-changed", "is-line-changed");
      node.querySelector(".event-scene-card-changed")?.remove();
    }
  }, EVENT_EDIT_HIGHLIGHT_MS);
}
