// editor/panels/eventEditor/aiAssist.ts
// 이벤트 편집기 명령 목록 위의 AI 작성 패널. 목록 자리에서 초안을 검토한 뒤 한 번에 적용한다.
// LLM 설정은 loadAiConfig 재사용.
//
// 왜 「삽입」이 아니라 「고치기」인가 —
// 예전 계약은 "새 명령 배열을 받아 선택 뒤에 끼워 넣기" 하나였다. 그래서 (1) 고치기·지우기·
// 순서 바꾸기를 표현할 수 없었고, (2) 사용자가 "이미 열었으면 비어있다고 하게 고쳐" 라고 쓰면
// 모델이 페이지를 다시 써서 돌려주는데 앱이 그걸 끝에 덧붙여 이벤트가 두 번 실행됐고,
// (3) 명령 개수만큼 insertCommand 를 불러 되돌리기 스냅샷이 그만큼 쌓여
// "되돌리려면 ↶" 안내가 거짓이었다(8개 넣으면 ↶ 8번).
// 지금은 항상 "고친 뒤 최종 목록"을 만들어 목록과 대조해 보여주고, 적용은 replaceAll 한 번이다.
//
// 스토어 갱신 때마다 에디터 본문이 통째로 재렌더되므로, 입력 초안/펼침 상태/초안 diff 는
// 모듈 레벨 캐시(이벤트+페이지 키)로 보존해 재렌더 후 복원한다.

import { eventCommandGateNotice } from "@/ai/aiGateNotice";
import { consumeEventAiDockOpen } from "./aiDockOpenRequest";
import { sendAiAssistantMessage, getAiAssistantStatus, abortAiAssistantTurn } from "@/editor/aiAssistantBridge";
import { checkEventCommandScope } from "@/ai/eventCommandScope";
import { resolveAssistScope } from "@/ai/eventCommandAssist";
import { loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { resolveCommandAtPath } from "@/editor/eventCommandPaths";
import { isAiConfigReady } from "@/editor/panels/aiChatPanelHelpers";
import { store } from "@/project/store";
import type { Command, EventPage, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { openEventCommandEditDialog } from "./commandEditDialog";
import { renderEditorIcon } from "./editorIcons";
import { auxCompositeKey } from "./auxOpenController";
import { commandSummaryParts } from "./commandSummary";
import {
  applyCommandDiff,
  diffCommandLists,
  hasCommandDiffChanges,
  type CommandDiffRow,
} from "./commandDiff";
import { renderStagedDiff, stagedDiffSummary } from "./stagedDiffView";

export interface EventAiAssistOptions {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
  // 현재 선택 커맨드 조회용 커맨드 리스트 루트(.cmd-item.selected 탐색).
  readonly cmdList: HTMLElement;
  // Lazy command views can supply the editor's native selection without list rows.
  readonly selectionPath?: () => readonly number[] | undefined;
  // 저작 명령과 같은 스크롤 영역에서 초안을 보여 준다.
  readonly stagedHost: HTMLElement;
  // 초안 갱신 뒤 저작 표면의 상태를 동기화한다.
  readonly refreshListVisibility: (reviewing: boolean) => void;
  // 목록 전체를 되돌리기 한 칸으로 교체(commandToolbarHistory.replaceAll).
  readonly replaceAll: (commands: readonly Command[]) => void;
  // 테스트 주입용 설정 로더(생략 시 loadAiConfig).
  readonly loadConfig?: () => AiConfig;
}

type StatusKind = "" | "error" | "busy";

type StagedDraft = {
  readonly rows: readonly CommandDiffRow[];
  readonly excluded: Set<string>;
  /** Exact command list used to compute the diff; apply must rebase if it changed. */
  readonly baseCommands: readonly Command[];
};

// 재렌더를 살아남는 패널 상태(이벤트+페이지 단위).
type PanelState = {
  open: boolean;
  draft: string;
  staged: StagedDraft | null;
  status: string;
  statusKind: StatusKind;
  // 마지막 초안을 목록에 반영했고 그 뒤로 입력을 고치지 않았다. 칩이 「반영됨」을 말하는 근거.
  appliedCommands: readonly Command[] | null;
};

const panelStates = new Map<string, PanelState>();
let panelStatesProjectKey = "";
let currentSelectionTeardown: (() => void) | null = null;
let panelInstanceId = 0;
let activeRequest: { key: string; cancelled: boolean; startedAt: number } | null = null;
function stopEventRequest(): void {
  if (!activeRequest) return;
  activeRequest.cancelled = true;
  abortAiAssistantTurn();
}
// 생성이 끝나는 시점의 **살아 있는** 도크. 스토어 갱신 한 번이면 에디터 본문을 통째로 다시
// 그리므로, 요청을 보낸 렌더의 DOM 은 이미 문서에서 떨어져 나간 노드일 수 있다. 그때 자기 클로저의
// stagedHost 에 그리면 화면엔 아무것도 안 나온다 — 목록은 초안이 있다고 숨고, 초안은 없는 상태.
let liveDock: {
  key: string;
  root: HTMLDetailsElement;
  /** 이 도크를 펼치고 입력창으로 초점을 준다. 자기 페이지 키를 스스로 알고 있다. */
  open: () => boolean;
  collapseOnEscape: () => boolean;
  renderStaged: () => void;
  setStatus: (text: string, kind?: StatusKind) => void;
  setGenerating: (busy: boolean) => void;
} | null = null;

/** 이벤트 에디터가 닫히면 분리된 DOM 클로저를 더는 완료 대상으로 보지 않는다. */
export function clearEventAiLiveDock(): void {
  stopEventRequest();
  liveDock = null;
  currentSelectionTeardown?.();
  currentSelectionTeardown = null;
}

/**
 * 이미 열려 있는 편집기의 AI 도크를 지금 펼치고 입력창으로 초점을 준다.
 *
 * 예약(`aiDockOpenRequest`)은 **아직 그려지지 않은** 도크용이라 여기서는 쓸 수 없다. 대신
 * 살아 있는 도크가 자기 자신을 여는 클로저(`liveDock.open`)를 부른다 — 그 도크가 자기 페이지
 * 키를 이미 알고 있으므로, 전역 `editorState.selectedEventPageId` 로 키를 **재구성하지 않는다**.
 * 재구성하면 다른 이벤트의 페이지가 선택돼 있을 때(예: A 를 최소화한 채 B 를 복사한 뒤 A 로
 * 돌아오는 경우) 엉뚱한 키를 만져 아무 일도 일어나지 않는다.
 *
 * 호출자는 편집기를 **먼저 복원**하고 나서 이 함수를 불러야 한다. 최소화된 편집기의 도크는
 * `isConnected` 가 true 인 채 `hidden` 부모 아래에 있어서, 복원 전에 부르면 보이지 않는
 * 곳에서 초점을 뺏는다.
 */
export function focusEventAiDockInOpenEditor(): boolean {
  const dock = liveDock;
  if (!dock) return false;
  return dock.open();
}
/** 이벤트 편집기의 Escape 처리에서 입력 및 초안 행의 접기를 위임한다. */
export function collapseFocusedEventAiAssist(): boolean {
  return liveDock?.collapseOnEscape() ?? false;
}

const TARGET_NAME_MAX = 18;

// 예시는 입력을 채우기만 한다 — 누른 즉시 LLM 을 호출하면 의도와 다른 초안에 돈을 쓴다.
const PROMPT_EXAMPLES: readonly { readonly label: string; readonly prompt: string }[] = [
  {
    label: "보물상자",
    prompt: "열면 회복약 2개를 주고 이 이벤트 기억 A를 켠다. 이미 열었으면 «비어 있다»고 말한다.",
  },
  {
    label: "말 거는 NPC",
    prompt: "인사하고 마을 소문을 한 줄 말한 뒤, 계속 물어볼지 «네/아니오»로 묻는다.",
  },
  {
    label: "문 통과",
    prompt: "«문이 열렸다»고 말한 다음 여관 안으로 장소를 옮긴다.",
  },
];

// 명령이 이미 있는 페이지에서는 「고치기」 예시가 더 쓸모 있다 — 고정 3개는 늘 "새로 만들기"였다.
const EDIT_EXAMPLES: readonly { readonly label: string; readonly prompt: string }[] = [
  { label: "한 번만", prompt: "이미 한 번 실행했으면 다시 실행되지 않게 고쳐 줘." },
  { label: "대사 다듬기", prompt: "대사를 더 짧고 자연스럽게 다듬어 줘. 내용은 그대로." },
  { label: "조건 붙이기", prompt: "보상을 주기 전에 조건 검사를 붙여 줘." },
];

function stateKeyOf(mapId: MapId, eventId: string, pageId: string): { projectKey: string; key: string } {
  const identity = store.getProjectIdentity();
  const projectKey = `${identity.kind}:${identity.id}`;
  return { projectKey, key: `${projectKey}:${auxCompositeKey(mapId, eventId, pageId)}` };
}

function stateOf(projectKey: string, key: string): PanelState {
  // Prompt text is private to the loaded project. Keep only the current project's
  // entries so a long editing session cannot grow this module cache without bound.
  if (panelStatesProjectKey !== projectKey) {
    panelStates.clear();
    panelStatesProjectKey = projectKey;
  }
  const existing = panelStates.get(key);
  if (existing) return existing;
  const fresh: PanelState = { open: false, draft: "", staged: null, status: "", statusKind: "", appliedCommands: null };
  panelStates.set(key, fresh);
  return fresh;
}

/**
 * 이 페이지에 적용 대기 중인 AI 초안이 있는가.
 */
export function hasEventAiStagedDraft(mapId: MapId, eventId: string, pageId: string): boolean {
  return eventAiStagedCommands(mapId, eventId, pageId) !== null;
}

/** 배지·번호가 적용 전 초안 결과를 기준으로 말할 수 있도록 후보 명령 목록을 계산한다. */
export function eventAiStagedCommands(mapId: MapId, eventId: string, pageId: string): Command[] | null {
  const { projectKey, key } = stateKeyOf(mapId, eventId, pageId);
  if (panelStatesProjectKey !== projectKey) return null;
  const staged = panelStates.get(key)?.staged;
  return staged ? applyCommandDiff(staged.rows, staged.excluded) : null;
}

// 칩 배지는 한국어만 쓴다. 예전에는 `busy`/`error`/`ready`/`draft` 영문 기계 토큰이
// 한국어 UI 위에 그대로 노출됐다.
function chipStatusOf(state: PanelState): { text: string; kind: string; quiet: boolean } {
  if (state.statusKind === "busy") return { text: "생성 중", kind: "busy", quiet: false };
  if (state.statusKind === "error") return { text: "오류", kind: "error", quiet: false };
  if (state.staged) {
    return { text: stagedDiffSummary(state.staged.rows, state.staged.excluded), kind: "ready", quiet: false };
  }
  // 반영 직후 입력이 그대로 남아 있다고 「작성 중」이라 말하면 거짓이다 — 방금 한 일을 말한다.
  if (state.appliedCommands) return { text: "반영됨", kind: "applied", quiet: false };
  if (state.draft.trim().length > 0) return { text: "작성 중", kind: "idle", quiet: false };
  return { text: "", kind: "idle", quiet: true };
}

export function renderEventAiAssist(options: EventAiAssistOptions): HTMLDetailsElement {
  const { mapId, eventId, page, cmdList, stagedHost, refreshListVisibility, replaceAll } = options;
  const { projectKey, key } = stateKeyOf(mapId, eventId, page.id);
  const state = stateOf(projectKey, key);
  if (state.appliedCommands && JSON.stringify(state.appliedCommands) !== JSON.stringify(page.commands)) {
    state.appliedCommands = null;
    state.status = "";
  }
  // 우클릭 「AI 로 이벤트 …」가 남긴 예약을 여기서 **한 번만** 소비한다. 소비하면 예약이 사라져
  // 이후 재렌더는 기본값(닫힘)으로 돌아가고, 사용자가 접은 도크를 렌더가 도로 펼치지 않는다.
  // `state.open` 을 세우는 이유: 이 값이 다음 렌더의 초기값이라, 예약을 지우면서 열어 두지
  // 않으면 두 번째 렌더에서 곧바로 닫힌다.
  const openedByRequest = consumeEventAiDockOpen(mapId, eventId);
  if (openedByRequest) state.open = true;
  const scope = resolveAssistScope(page);
  const instanceId = ++panelInstanceId;
  const inputId = `event-ai-input-${instanceId}`;
  const panelId = `event-ai-panel-${instanceId}`;
  const resultTitleId = `event-ai-result-title-${instanceId}`;

  const root = el("details", {
    class: "ai-event-assist",
    attrs: { id: panelId },
    dataset: { testid: "ai-event-assist" },
  }) as HTMLDetailsElement;
  root.open = state.open;

  const input = el("textarea", {
    class: "ai-event-input",
    attrs: {
      id: inputId,
      rows: "2",
      placeholder: "예: 말을 걸면 ‘안녕하세요’라고 말하고 스위치 1번을 켜요",
    },
    dataset: { testid: "ai-event-input" },
  });
  input.value = state.draft;

  const status = el("div", {
    class: "ai-event-status",
    text: state.status,
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "ai-event-status" },
  });
  const elapsed = el("span", { class: "ai-event-elapsed" });
  const updateElapsed = (): void => {
    if (activeRequest?.key === key) {
      elapsed.textContent = `${Math.floor((performance.now() - activeRequest.startedAt) / 1000)}초`;
    }
  };

  const chip = chipStatusOf(state);
  const chipStatus = el("span", {
    class: "event-aux-chip-status",
    text: chip.text,
    dataset: { testid: "ai-event-chip-status", kind: chip.kind },
    attrs: chip.quiet ? { "aria-hidden": "true" } : {},
  });
  if (chip.quiet) chipStatus.hidden = true;

  const refreshChip = (): void => {
    const next = chipStatusOf(state);
    chipStatus.textContent = next.text;
    chipStatus.dataset.kind = next.kind;
    chipStatus.hidden = next.quiet;
    if (next.quiet) chipStatus.setAttribute("aria-hidden", "true");
    else chipStatus.removeAttribute("aria-hidden");
  };

  let renderedStatus = state.status;
  const setStatus = (text: string, kind: StatusKind = ""): void => {
    state.status = text;
    state.statusKind = kind;
    if (renderedStatus !== text) {
      renderedStatus = text;
      status.textContent = text;
    }
    if (kind === "busy") updateElapsed();
    const className = `ai-event-status${kind ? ` ${kind}` : ""}`;
    if (status.className !== className) status.className = className;
    refreshChip();
  };

  // 재렌더 시 기존 statusKind 클래스 복원.
  if (state.statusKind) status.className = `ai-event-status ${state.statusKind}`;

  // ── 무엇을 하게 되는지 표시 ───────────────────────────────────────────────
  // "page" 는 목록을 고치는 것이고, "append"(너무 긴 페이지)는 뒤에 새로 붙이는 것이다.
  // 선택 상태는 스토어 갱신 없이 클래스만 바뀌므로 목록 클릭·패널 열기 때마다 다시 읽는다.
  const target = el("span", {
    class: "ai-event-target",
    dataset: { testid: "ai-event-target" },
  });
  const refreshTarget = (): void => {
    if (scope === "page") {
      target.textContent = page.commands.length > 0
        ? "이 페이지의 명령 목록을 고칩니다"
        : "이 페이지의 명령 목록을 만듭니다";
      return;
    }
    const name = selectedCommandName(cmdList, page.commands, options.selectionPath);
    target.textContent = name
      ? `페이지가 길어 「${name}」 다음에 새로 넣기만 합니다`
      : "페이지가 길어 맨 아래에 새로 넣기만 합니다";
  };
  refreshTarget();
  currentSelectionTeardown?.();
  const Observer = globalThis.MutationObserver;
  if (Observer) {
    const observer = new Observer(refreshTarget);
    observer.observe(cmdList, { attributeFilter: ["class"], attributes: true, subtree: true });
    currentSelectionTeardown = () => observer.disconnect();
  }

  input.addEventListener("input", () => {
    state.draft = input.value;
    const wasApplied = state.appliedCommands !== null;
    state.appliedCommands = null;
    // 사용자가 고치는 중이면 지난 오류는 유효하지 않다. 예전에는 «생성할 내용을
    // 입력하세요» 가 입력을 다 쓴 뒤에도 빨간 글씨로 남아 있었다.
    if (state.statusKind === "error" || wasApplied) setStatus("");
    else refreshChip();
  });

  // ── 초안(목록 자리에 겹쳐 보이는 diff) ────────────────────────────────────

  const applyBtn = button("적용", "ai-event-apply", "primary");
  const cancelBtn = button("취소", "ai-event-discard");
  const resultMeta = el("span", { class: "ai-event-result-meta", dataset: { testid: "ai-event-result-meta" } });
  const resultTitle = el("h4", {
    class: "ai-event-result-title",
    text: "명령 초안",
    attrs: { id: resultTitleId },
    dataset: { testid: "ai-event-result-title" },
  });
  const resultSection = el("section", {
    class: "ai-event-result",
    attrs: { role: "region", "aria-labelledby": resultTitleId },
    dataset: { testid: "ai-event-result" },
    children: [resultTitle, resultMeta],
  });
  const previewActions = el("div", { class: "ai-event-preview-actions", children: [cancelBtn, applyBtn] });
  const syncReviewVisibility = (): void => {
    const reviewing = root.open && state.staged !== null;
    stagedHost.hidden = !reviewing;
    refreshListVisibility(reviewing);
  };
  const renderStaged = (): void => {
    const focus = document.activeElement;
    const focusedTestId = focus instanceof HTMLElement && stagedHost.contains(focus) ? focus.dataset.testid : undefined;
    stagedHost.replaceChildren();
    const staged = state.staged;
    resultSection.hidden = !staged;
    previewActions.hidden = !staged;
    if (!staged) {
      applyBtn.disabled = true;
      cancelBtn.disabled = true;
      refreshGenerateLabel();
      refreshChip();
      syncReviewVisibility();
      return;
    }
    stagedHost.append(renderStagedDiff({
      rows: staged.rows,
      excluded: staged.excluded,
      onEdit: (row) => {
        const initial = applyCommandDiff([row], staged.excluded)[0];
        if (!initial) return;
        openEventCommandEditDialog({
          title: "AI 초안 명령 수정", initial, lockKind: true,
          onApply: edited => {
            if (state.staged !== staged) return;
            const rebase = (rows: readonly CommandDiffRow[]): CommandDiffRow[] => rows.map(child => ({
              ...child, id: `${row.id}/edited/${child.id}`, depth: row.depth + child.depth,
              branches: child.branches.map(branch => ({ ...branch, rows: rebase(branch.rows) })),
            }));
            const replacement = rebase(diffCommandLists(row.before ? [row.before] : [], [edited]));
            const replace = (rows: readonly CommandDiffRow[]): CommandDiffRow[] => rows.flatMap(child =>
              child.id === row.id ? replacement : [{ ...child, branches: child.branches.map(branch => ({ ...branch, rows: replace(branch.rows) })) }]);
            state.staged = { ...staged, rows: replace(staged.rows) };
            renderStaged();
          },
        });
      },
      onToggle: (id) => {
        if (staged.excluded.has(id)) staged.excluded.delete(id);
        else staged.excluded.add(id);
        renderStaged();
      },
    }));
    syncDraftActions();
    resultMeta.textContent = hasCommandDiffChanges(staged.rows, staged.excluded)
      ? "빼고 싶은 변경은 해당 줄에서 「빼기」를 누르세요."
      : "적용할 변경이 없어요.";
    refreshGenerateLabel();
    refreshChip();
    syncReviewVisibility();
    if (focusedTestId) {
      Array.from(stagedHost.querySelectorAll<HTMLElement>("button")).find(button =>
        button.dataset.testid === focusedTestId)?.focus({ preventScroll: true });
    }
  };

  const generateLabel = el("span", {
    class: "ai-event-generate-label",
    text: state.staged ? "다시 만들기" : "초안 만들기",
  });
  const generateSpinner = el("span", { class: "ai-event-spinner", attrs: { "aria-hidden": "true" } });
  const generateBtn = el("button", {
    class: "ai-event-btn ai-event-generate",
    attrs: { type: "button", "aria-keyshortcuts": "Control+Enter Meta+Enter" },
    dataset: { testid: "ai-event-generate" },
    children: [generateLabel, el("kbd", { class: "ai-event-kbd", text: "Ctrl+Enter", attrs: { "aria-hidden": "true" } })],
  }) as HTMLButtonElement;
  // 초안이 생기면 같은 버튼이 「다시 만들기」가 된다. 예전엔 렌더 시점에만 정해져 생성 뒤에도
  // 「초안 만들기」로 남았다.
  const refreshGenerateLabel = (): void => {
    generateLabel.textContent = state.staged ? "다시 만들기" : "초안 만들기";
    generateBtn.classList.toggle("primary", !state.staged);
  };
  const stopBtn = button("중단", "ai-event-stop");
  const progressIndicator = el("span", { class: "ai-event-progress", children: [generateSpinner, elapsed] });
  progressIndicator.hidden = true;
  stopBtn.hidden = true;
  stopBtn.addEventListener("click", stopEventRequest);
  const syncDraftActions = (): void => {
    const staged = state.staged;
    const busy = generateBtn.disabled;
    applyBtn.disabled = busy || !staged || !hasCommandDiffChanges(staged.rows, staged.excluded);
    cancelBtn.disabled = busy || !staged;
    stagedHost.inert = busy;
  };
  const setGenerating = (busy: boolean): void => {
    stopBtn.hidden = !busy;
    generateBtn.disabled = busy;
    generateBtn.setAttribute("aria-busy", String(busy));
    progressIndicator.hidden = !busy;
    root.classList.toggle("is-generating", busy);
    if (busy) updateElapsed();
    syncDraftActions();
  };

  const generate = async (): Promise<void> => {
    if (generateBtn.disabled) return;
    const prompt = input.value.trim();
    if (!prompt) {
      setStatus("무엇을 하는 이벤트인지 한 줄 적어 주세요.", "error");
      input.focus();
      return;
    }
    const config = (options.loadConfig ?? loadAiConfig)();
    if (!isAiConfigReady(config)) {
      setStatus(
        config.authMode === "chatgpt"
          ? "AI 설정에서 ChatGPT 연결과 모델을 확인하세요."
          : "AI 설정에서 연결 방식(구독 로그인 또는 API 키)을 완료하세요.",
        "error"
      );
      return;
    }
    if (activeRequest || getAiAssistantStatus().turnBusy) {
      setStatus("조수의 진행 중인 작업을 먼저 마무리하세요.", "error");
      return;
    }
    const request = { key, cancelled: false, startedAt: performance.now() };
    activeRequest = request;
    const progress = setInterval(() => {
      if (request.cancelled || liveDock?.key !== key) return;
      const status = getAiAssistantStatus();
      const step = status.turnBusy && status.lastStatus !== "대기" ? status.lastStatus : "";
      // The shared status line can already include the chat timer.
      liveDock.setStatus(step.replace(/(?: · | )\d+초(?= · |$)/u, "") || "명령 초안을 만들고 있어요…", "busy");
    }, 250);
    setGenerating(true);
    state.appliedCommands = null;
    setStatus("명령 초안을 만들고 있어요…", "busy");
    try {
      const beforeCommands = JSON.stringify(page.commands);
      const selection = selectedCommandPath(cmdList, options.selectionPath);
      const target = { mapId, eventId, pageId: page.id, selection,
        selectionLabel: selectedCommandName(cmdList, page.commands, options.selectionPath) ?? undefined,
        mode: scope === "append" ? "append" as const : "edit" as const };
      const response = await sendAiAssistantMessage(prompt, { deferApply: true, eventCommandScope: target });
      if (request.cancelled) throw new Error("중단했습니다.");
      if (!response.ok) throw new Error(response.error ?? "조수 실행에 실패했습니다.");
      const proposal = response.pendingProposal;
      if (!proposal && response.runOutcome?.execution === "response-final" && response.runOutcome.delivery === "no-change" && response.lastAssistantText) {
        state.staged = null;
        state.status = response.lastAssistantText;
        state.statusKind = "";
        const activeDock = liveDock && liveDock.key === key ? liveDock : null;
        activeDock?.setStatus(state.status);
        activeDock?.renderStaged();
        return;
      }
      if (!proposal) throw new Error(response.lastAssistantText || "조수가 검토할 명령 초안을 만들지 못했습니다.");
      const scopeCheck = checkEventCommandScope(proposal.before, proposal.after, target);
      if (!scopeCheck.ok) throw new Error(scopeCheck.reason);
      const generatedPage = proposal.after.maps[mapId]?.events.find(entry => entry.id === eventId)?.pages?.find(entry => entry.id === page.id);
      if (!generatedPage) throw new Error("초안에서 대상 페이지를 찾을 수 없습니다.");
      const livePage = store.getCurrent().maps[mapId]?.events
        .find((entry) => entry.id === eventId)
        ?.pages?.find((entry) => entry.id === page.id);
      if (!livePage || JSON.stringify(livePage.commands) !== beforeCommands) {
        state.staged = null;
        state.status = "명령 목록이 생성 중에 바뀌었어요. 현재 목록으로 다시 만들어 주세요.";
        state.statusKind = "error";
        const activeDock = liveDock && liveDock.key === key ? liveDock : null;
        activeDock?.setStatus(state.status, "error");
        activeDock?.renderStaged();
        return;
      }
      const liveBefore = livePage.commands;
      // 모델 출력이 "page" 면 그게 곧 최종 목록이고, "append" 면 기존 목록에 끼워 최종 목록을 만든다.
      // 어느 쪽이든 아래 diff 는 같은 일을 한다 — 무엇이 달라지는지 목록 위에 그린다.
      const after = generatedPage.commands;
      const rows = diffCommandLists(liveBefore, after);
      state.staged = {
        rows,
        excluded: new Set<string>(),
        baseCommands: structuredClone(liveBefore),
      };
      state.status = hasCommandDiffChanges(rows)
        ? ""
        : "바뀌는 것이 없었어요. 요청을 더 구체적으로 적어 보세요.";
      state.statusKind = "";
      const settled = liveDock && liveDock.key === key ? liveDock : null;
      // 페이지 전환·에디터 닫기 뒤에는 맞는 도크가 없다. 상태만 보존하고 분리된 DOM 은 그리지 않는다.
      settled?.setStatus(state.status);
      settled?.renderStaged();
    } catch (cause) {
      // 검증기 원문(kind/필드 이름)은 원인 추적에 필요하니 버리지 않고, 사용자가 다음에
      // 무엇을 할지 아는 한 줄을 앞에 붙인다.
      const detail = cause instanceof Error ? cause.message : String(cause);
      const notice = eventCommandGateNotice({ message: detail, scope, commandCount: page.commands.length });
      state.status = request.cancelled ? "명령 만들기를 중단했어요."
        : [notice.title, ...notice.reasons, notice.nextSteps[0]].join("\n");
      state.statusKind = request.cancelled ? "" : "error";
      const activeDock = liveDock && liveDock.key === key ? liveDock : null;
      activeDock?.setStatus(state.status, state.statusKind);
    } finally {
      clearInterval(progress);
      if (activeRequest === request) activeRequest = null;
      // 자기 클로저의 버튼과 **살아 있는 도크의 버튼**을 모두 푼다. 생성 중 스토어가 갱신되면
      // 이 클로저의 버튼은 문서에서 떨어져 나간 옛 도크 것이고, 새 도크는 `statusKind === "busy"`
      // 를 보고 자기 버튼을 잠갔다. 상태 쓰기는 재렌더를 부르지 않으므로 여기서 직접 풀지 않으면
      // 사용자가 다시 생성할 방법이 영구히 없어진다.
      setGenerating(false);
      const active = liveDock && liveDock.key === key ? liveDock : null;
      if (active) active.setGenerating(false);
    }
  };

  generateBtn.addEventListener("click", () => void generate());
  input.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void generate();
    }
  });

  applyBtn.addEventListener("click", () => {
    const staged = state.staged;
    if (applyBtn.disabled || !staged) return;
    const livePage = store.getCurrent().maps[mapId]?.events
      .find((entry) => entry.id === eventId)
      ?.pages?.find((entry) => entry.id === page.id);
    if (!livePage || JSON.stringify(livePage.commands) !== JSON.stringify(staged.baseCommands)) {
      state.staged = null;
      setStatus("초안을 만든 뒤 명령 목록이 바뀌었어요. 현재 목록으로 다시 만들어 주세요.", "error");
      renderStaged();
      return;
    }
    const commands = applyCommandDiff(staged.rows, staged.excluded);
    const summary = stagedDiffSummary(staged.rows, staged.excluded);
    // 명령 목록 전체를 교체해 되돌리기 한 칸으로 기록한다.
    try {
      replaceAll(commands);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      state.status = `변경 내용을 적용하지 못했어요. — ${detail}`;
      state.statusKind = "error";
      if (liveDock?.key === key) liveDock.setStatus(state.status, "error");
      return;
    }
    state.staged = null;
    state.appliedCommands = commands;
    const appliedStatus = `${summary} 반영했어요. 되돌리려면 툴바의 ↶ 되돌리기 한 번.`;
    state.status = appliedStatus;
    state.statusKind = "";
    // replaceAll 이 스토어를 갱신하면 이 클로저의 도크는 문서에서 떨어진다.
    // 패널은 접지 않고, 살아 있는 도크에 반영 상태를 그린 뒤 입력으로 초점을 돌린다.
    const dock = liveDock?.key === key ? liveDock : null;
    if (dock) {
      dock.setStatus(appliedStatus);
      dock.renderStaged();
      dock.root.querySelector<HTMLButtonElement>('[data-testid="ai-event-generate"]')?.focus({ preventScroll: true });
    }
  });

  cancelBtn.addEventListener("click", () => {
    state.staged = null;
    setStatus("초안을 버렸어요.");
    generateBtn.focus({ preventScroll: true });
    renderStaged();
  });

  const exampleSource = page.commands.length > 0 ? EDIT_EXAMPLES : PROMPT_EXAMPLES;
  const examples = el("div", {
    class: "ai-event-examples",
    attrs: { role: "group", "aria-label": "예시 문장" },
    dataset: { testid: "ai-event-examples" },
    children: exampleSource.map((example, index) => el("button", {
      class: "ai-event-example",
      text: example.label,
      attrs: { type: "button", title: example.prompt },
      dataset: { testid: `ai-event-example-${index}` },
      on: {
        click: () => {
          input.value = example.prompt;
          input.dispatchEvent(new Event("input"));
          input.focus();
          input.setSelectionRange(example.prompt.length, example.prompt.length);
        },
      },
    })),
  });

  const toggleButton = (): HTMLElement | null =>
    root.closest(".event-contents-fieldset")?.querySelector<HTMLElement>('[data-testid="event-command-quick-ai"]') ?? null;

  root.addEventListener("toggle", () => {
    if (!root.isConnected) return;
    state.open = root.open;
    syncReviewVisibility();
    if (!root.open) {
      if (activeRequest?.key === key) stopEventRequest();
      // The native disclosure has just hidden the focused input or summary.
      if (root.contains(document.activeElement) || stagedHost.contains(document.activeElement)
        || document.activeElement === document.body) {
        toggleButton()?.focus({ preventScroll: true });
      }
      return;
    }
    refreshTarget();
    if (document.activeElement === toggleButton() || root.contains(document.activeElement)) input.focus();
  });

  root.append(
    el("summary", {
      class: "ai-event-assist-summary event-aux-chip-summary",
      dataset: { testid: "ai-event-assist-summary" },
      children: [
        el("span", { class: "event-aux-chip-icon", attrs: { "aria-hidden": "true" }, children: [renderEditorIcon("spark")] }),
        el("span", { class: "event-aux-chip-label", text: "조수로 명령 만들기" }),
        chipStatus,
        el("span", { class: "ai-event-caret", attrs: { "aria-hidden": "true" }, children: [renderEditorIcon("caret")] }),
      ],
    }),
    el("div", {
      class: "ai-event-assist-body",
      children: [
        el("label", {
          class: "ai-event-prompt-label",
          text: "어떤 명령을 만들까요?",
          attrs: { for: inputId },
          dataset: { testid: "ai-event-prompt-label" },
        }),
        input,
        el("div", { class: "ai-event-hintrow", children: [examples, target] }),
        el("div", { class: "ai-event-generate-row", children: [generateBtn, stopBtn, previewActions] }),
        el("div", { class: "ai-event-feedback", children: [progressIndicator, status] }),
        resultSection,
      ],
    })
  );
  renderStaged();
  // 생성 중에 본문이 다시 그려진 경우 새 도크도 「생성 중」을 이어받는다 — 안 그러면 버튼이
  // 다시 활성돼 같은 원으로 둘째 호출을 또 넣을 수 있다.
  if (state.statusKind === "busy") setGenerating(true);
  liveDock = {
    key,
    root,
    open: () => {
      if (!root.isConnected) return false;
      // `state.open` 을 함께 세운다. `details.open` 만 켜면 `toggle` 이벤트에 기대게 되는데
      // 그 이벤트는 비동기로 큐에 걸린다 — 그 사이 재렌더가 아직 false 인 state.open 을 보고
      // 닫힌 도크를 그리면 "눌렀는데 잠깐 열렸다 닫힌다"가 된다.
      state.open = true;
      root.open = true;
      try {
        input.focus();
      } catch {
        // headless DOM 에서 focus 미지원은 펼침 자체를 막지 않는다.
      }
      return true;
    },
    collapseOnEscape: () => {
      const focused = document.activeElement;
      if (!root.open || !root.isConnected || !focused
        || (!root.contains(focused) && !stagedHost.contains(focused) && focused !== toggleButton())) return false;
      state.open = false;
      root.open = false;
      toggleButton()?.focus({ preventScroll: true });
      return true;
    },
    renderStaged,
    setStatus,
    setGenerating,
  };
  if (openedByRequest) {
    // 이 함수가 돌려준 root 는 호출자(content.ts)가 곧 append 한다. 지금은 아직 문서 밖이라
    // focus 가 먹지 않으므로, 연결된 다음 마이크로태스크에서 입력창으로 옮긴다 — 우클릭으로
    // 들어온 사용자가 곧바로 문장을 칠 수 있어야 이 지름길이 지름길이다.
    queueMicrotask(() => {
      if (!root.isConnected) return;
      input.focus();
    });
  }
  return root;
}

/** 테스트용: 이 페이지의 초안 상태를 비운다. */
export function resetEventAiStagedForTest(): void {
  panelStates.clear();
  panelStatesProjectKey = "";
  clearEventAiLiveDock();
}

// 현재 선택된 커맨드의 경로(.cmd-item.selected → data-cmd-path). 없으면 null.
function selectedCommandPath(cmdList: HTMLElement, selectionPath?: () => readonly number[] | undefined): number[] | null {
  if (selectionPath) {
    const path = selectionPath();
    return path ? [...path] : null;
  }
  const selected = cmdList.querySelector<HTMLElement>(".cmd-item.selected");
  const raw = selected?.dataset.cmdPath;
  if (!raw) return null;
  try {
    const path = JSON.parse(raw) as unknown;
    return Array.isArray(path) && path.every((part) => Number.isInteger(part)) ? (path as number[]) : null;
  } catch {
    return null;
  }
}

function selectedCommandName(cmdList: HTMLElement, commands: Command[], selectionPath?: () => readonly number[] | undefined): string | null {
  const path = selectedCommandPath(cmdList, selectionPath);
  return path ? commandNameAtPath(commands, path) : null;
}

// 라벨용 짧은 명령 이름. 프롬프트의 "사용자가 고른 명령" 표기에도 같은 문구를 쓴다.
function commandNameAtPath(commands: Command[], path: readonly number[]): string | null {
  const command = resolveCommandAtPath(commands, path);
  if (!command) return null;
  const parts = commandSummaryParts(command);
  const name = parts
    .map((part) => ("text" in part ? part.text : ""))
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!name) return null;
  return name.length > TARGET_NAME_MAX ? `${name.slice(0, TARGET_NAME_MAX)}…` : name;
}

function button(text: string, testid: string, variant?: "primary"): HTMLButtonElement {
  return el("button", {
    class: `ai-event-btn${variant ? ` ${variant}` : ""}`,
    text,
    attrs: { type: "button" },
    dataset: { testid },
  }) as HTMLButtonElement;
}
