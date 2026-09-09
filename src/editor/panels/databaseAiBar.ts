// editor/panels/databaseAiBar.ts
// 데이터베이스 창 헤더 아래 「AI 어시스턴트」 바.
//
// 왜 다시 만들었나(2026-09-03 실측): 예전 바는 메시지를 채팅 세션에 던지고 토스트 한 줄
// (「채팅 패널에서 제안을 확인하세요」)만 남겼다. 그런데 DB 창은 모달이라 채팅 패널이 **뒤에
// 가려진다**. AI 는 실제로 tune_enemy 를 실행해 몬스터 HP 를 64→300 으로 바꿨는데 화면에는
// 아무 흔적이 없었다 — 「작동하는지도 불분명하다」는 평가가 정확히 이 지점이다.
//
// 지금은 같은 채팅 세션을 쓰되(aiAssistantBridge), 그 턴의 진행 단계·도구 결과·답변을 **바 안에**
// 그린다. 브리지는 턴이 끝날 때 결과를 돌려주므로, 도는 동안은 status/audit 스냅샷을 짧게
// 폴링해 도구 요약을 제자리에 흘린다. 승인 게이트는 없다(approvalPolicy) — 쓰기는 즉시
// 적용되고 복구는 되돌리기다. 그래서 완료 상태는 되돌리기 버튼을 같이 내놓는다.
//
// 제안 칩은 범용 문장 4개(맵 연결·이벤트 흐름…)가 아니라 **지금 보는 탭과 선택 레코드**로
// 만든다. DB 창 안에서 맵 동선을 물어볼 사람은 없다.

import {
  abortAiAssistantTurn,
  openAiAssistantPanel,
  sendAiAssistantMessage,
  type AiBridgeAuditEntry,
  type AiBridgeStatus,
  type AiBridgeTurnResult,
} from "@/editor/aiAssistantBridge";
import { pendingHistoryLabels, undoMapEdit } from "@/editor/mapEditHistory";
import { databaseTabLabel, TAB_GROUPS, type DatabaseTab } from "@/editor/panels/database";
import { buildSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { bindJobView, readJobResult } from "@/editor/aiJobs/jobViewBinding";
import { getJobClient } from "@/editor/aiJobs/jobClient";
import { jobOriginLink } from "@/editor/aiJobs/jobOriginLink";

export type DatabaseAiRecordRef = { readonly name: string; readonly id: string };

export interface DatabaseAiBarContext {
  readonly tab: DatabaseTab;
  /** 세션 선택 레코드(없으면 뷰가 기본 선택하는 첫 레코드). 레코드 탭이 아니면 null. */
  readonly record: DatabaseAiRecordRef | null;
}

export type DatabaseAiSuggestion = {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
};

export type DatabaseAiTurnPhase = "thinking" | "working" | "done" | "error";

export interface DatabaseAiTurnSummary {
  readonly phase: DatabaseAiTurnPhase;
  readonly statusText: string;
  /** 쓰기 툴 요약(실패 포함, 「실패 — 」 접두어). */
  readonly tools: readonly string[];
  /** 실제로 적용된 쓰기 툴 수. 되돌리기 버튼의 근거. */
  readonly changed: number;
  readonly answer: string;
}

export interface DatabaseAiBarDeps {
  readonly send?: (text: string) => Promise<AiBridgeTurnResult>;
  readonly status?: () => AiBridgeStatus;
  readonly audit?: () => readonly AiBridgeAuditEntry[];
  readonly abort?: () => void;
  readonly openPanel?: () => boolean;
  readonly undo?: () => boolean;
  readonly undoLabel?: () => string | null;
  /** 폴링 스케줄러. 취소 함수를 돌려준다. 테스트가 손으로 돌릴 수 있게 주입한다. */
  readonly schedule?: (fn: () => void, ms: number) => () => void;
}

export interface DatabaseAiBarOptions {
  readonly context: () => DatabaseAiBarContext;
  readonly deps?: DatabaseAiBarDeps;
}

export interface DatabaseAiBarHandle {
  /** `section.database-ai-bar` — 처음엔 hidden. */
  readonly element: HTMLElement;
  /** 헤더에 놓는 토글 버튼(aria-expanded 가 바의 열림 상태를 말한다). */
  readonly toggle: HTMLButtonElement;
  readonly setOpen: (open: boolean) => void;
  /** 탭·선택이 바뀌었을 때 자리 표시·제안 칩을 다시 계산한다. */
  readonly refreshContext: () => void;
  readonly dispose: () => void;
}

/** 레코드 이름을 프롬프트에 넣을 때 쓰는 표기. */
function recordName(record: DatabaseAiRecordRef): string {
  return record.name || "(이름 없음)";
}

function groupSlugOf(tab: DatabaseTab): string | null {
  return TAB_GROUPS.find((group) => group.tabs.includes(tab))?.slug ?? null;
}

// 그룹마다 「이 자리에서만 나올 수 있는」 밸런스 문장 하나.
const GROUP_BALANCE: Readonly<Record<string, DatabaseAiSuggestion>> = {
  party: { id: "balance", label: "성장 밸런스", prompt: "주인공·직업·스킬의 성장 곡선이 서로 맞는지 점검하고 어긋난 값을 고쳐줘" },
  monster: { id: "balance", label: "난이도 맞추기", prompt: "선택한 몬스터를 중반 난이도에 맞춰 스탯과 보상을 조정해줘" },
  battle: { id: "balance", label: "상태·속성 점검", prompt: "속성 상성표와 상태 효과 중 쓰이지 않거나 과한 것을 찾아줘" },
  life: { id: "balance", label: "생활 루프 점검", prompt: "농사·제작·채집 데이터의 보상 순환이 막히는 곳을 찾아줘" },
  world: { id: "balance", label: "세계 규칙 점검", prompt: "생성 규칙과 타일셋 설정에서 서로 충돌하는 값을 찾아줘" },
  system: { id: "balance", label: "스위치·변수 정리", prompt: "쓰이지 않는 스위치·변수와 이름이 모호한 것을 찾아줘" },
};

const PROJECT_SUGGESTION: DatabaseAiSuggestion = {
  id: "project",
  label: "다음 할 일",
  prompt: "이 프로젝트의 전체 제작 상태와 다음 우선순위를 점검해줘",
};

/** 지금 보는 탭·선택 레코드에 맞춘 제안 문장(최대 4개). 누르면 입력만 채운다. */
export function databaseAiSuggestions(context: DatabaseAiBarContext): readonly DatabaseAiSuggestion[] {
  const tabLabel = databaseTabLabel(context.tab);
  const list: DatabaseAiSuggestion[] = [];
  if (context.record) {
    const name = recordName(context.record);
    list.push(
      { id: "tune", label: "선택 레코드 다듬기", prompt: `선택한 「${name}」의 수치와 설명을 다듬어줘. 무엇을 왜 바꿨는지도 알려줘` },
      { id: "similar", label: "비슷한 것 하나 더", prompt: `「${name}」과 어울리는 새 ${tabLabel} 레코드 하나를 만들어줘` },
    );
  }
  const group = groupSlugOf(context.tab);
  const balance = group ? GROUP_BALANCE[group] : undefined;
  if (balance) list.push(balance);
  else list.push(PROJECT_SUGGESTION);
  list.push({
    id: "review",
    label: "이 탭 점검",
    prompt: `지금 보고 있는 ${tabLabel} 데이터에서 어긋난 값이나 빠진 연결을 찾아줘`,
  });
  return list.slice(0, 4);
}

/**
 * 채팅 파이프라인이 읽는 한 줄 컨텍스트 풋터. buildSpec 정규식과 호환되는 형식이라 바꾸지
 * 않는다 — 탭 라벨(몬스터/아이템…)과 "DB" 가 INTENT_KEYWORDS 의 db/battle 강키워드라 도구
 * 노출도 함께 보장된다.
 */
export function databaseAiContextFooter(context: DatabaseAiBarContext): string {
  const record = context.record ? `, 선택 레코드: ${recordName(context.record)}(${context.record.id})` : "";
  return `[컨텍스트] 에디터 전체 요청 · 현재 화면: 데이터베이스 DB 탭 ${databaseTabLabel(context.tab)}${record}`;
}

/** 답변 본문의 마크다운 강조·코드 표시를 걷어낸다 — 바 안에서는 평문으로 읽는다. */
function plainAnswer(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .trim();
}

/** 감사 항목(브리지 audit)을 단계·도구 요약·마지막 답변으로 접는다. */
export function summarizeDatabaseAiTurn(
  entries: readonly AiBridgeAuditEntry[],
  options: { readonly busy: boolean; readonly error?: string },
): DatabaseAiTurnSummary {
  // 읽기 툴(도구 탐색·조회)은 화면을 바꾸지 않으므로 「바꾼 것」에서 뺀다. 실패한 호출은
  // 보여 주되 세지 않는다 — 「바꾼 것 3개」라 해 놓고 하나는 실패였으면 숫자가 거짓이다.
  const toolEntries = entries.filter((entry) => entry.kind === "tool" && entry.mode !== "read");
  const tools = toolEntries.map((entry) => {
    const summary = entry.summary || entry.name || "도구 실행";
    return entry.ok === false ? `실패 — ${summary}` : summary;
  });
  const changed = toolEntries.filter((entry) => entry.ok !== false).length;
  let answer = "";
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.kind === "assistant" && entry.text?.trim()) {
      answer = plainAnswer(entry.text);
      break;
    }
  }
  if (options.error) {
    return { phase: "error", statusText: `실패 — ${options.error}`, tools, changed, answer };
  }
  if (options.busy) {
    return changed > 0
      ? { phase: "working", statusText: `적용 중 · 바꾼 것 ${changed}개`, tools, changed, answer }
      : { phase: "thinking", statusText: "생각하는 중…", tools, changed, answer };
  }
  if (changed > 0) {
    return { phase: "done", statusText: `완료 · 바꾼 것 ${changed}개 — 화면에 바로 반영됐어요`, tools, changed, answer };
  }
  if (tools.length > 0) {
    return { phase: "done", statusText: "끝났지만 적용된 변경은 없어요 — 아래 실패 내용을 확인하세요", tools, changed, answer };
  }
  return {
    phase: "done",
    statusText: answer ? "답변했어요 · 데이터 변경 없음" : "끝났지만 답이 비어 있어요 — 채팅 패널에서 확인하세요",
    tools,
    changed,
    answer,
  };
}

// ── 아이콘(레일 규격: 22×22 · stroke currentColor 1.8) ─────────────────────
const ICONS: Readonly<Record<"sparkle" | "close" | "send" | "undo" | "check" | "chat", readonly SvgNodeSpec[]>> = {
  sparkle: [
    { tag: "path", attrs: { d: "M11 3l1.7 4.6L17.3 9.3 12.7 11 11 15.6 9.3 11 4.7 9.3 9.3 7.6z" } },
    { tag: "path", attrs: { d: "M17.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" } },
  ],
  close: [{ tag: "path", attrs: { d: "M6 6l10 10M16 6L6 16" } }],
  send: [{ tag: "path", attrs: { d: "M4 11h13M12 6l5 5-5 5" } }],
  undo: [{ tag: "path", attrs: { d: "M8 7L4 11l4 4M4 11h9a4 4 0 0 1 0 8h-2" } }],
  check: [{ tag: "path", attrs: { d: "M5 11.5l4 4 8-9" } }],
  chat: [{ tag: "path", attrs: { d: "M4 5h14v9H9l-4 3v-3H4z" } }],
};

function icon(name: keyof typeof ICONS, className = "database-ai-icon"): SVGSVGElement {
  const svg = buildSvgIcon(ICONS[name]);
  svg.setAttribute("class", className);
  return svg;
}

/** 답변 평문을 문단·목록으로 나눈다. `- ` 로 시작하는 연속 줄은 목록이다. */
function renderAnswer(host: HTMLElement, text: string): void {
  host.replaceChildren();
  const lines = text.split(/\r?\n/u);
  let list: HTMLUListElement | null = null;
  let paragraph: string[] = [];
  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    host.append(el("p", { text: paragraph.join(" ") }));
    paragraph = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/u.exec(line);
    if (bullet) {
      flushParagraph();
      if (!list) {
        list = el("ul");
        host.append(list);
      }
      list.append(el("li", { text: bullet[1] ?? "" }));
      continue;
    }
    list = null;
    if (!line) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
}

export function createDatabaseAiBar(options: DatabaseAiBarOptions): DatabaseAiBarHandle {
  const deps = options.deps ?? {};
  const send = deps.send ?? sendAiAssistantMessage;
  const abort = deps.abort ?? abortAiAssistantTurn;
  const openPanel = deps.openPanel ?? openAiAssistantPanel;
  const undo = deps.undo ?? undoMapEdit;
  const undoLabel = deps.undoLabel ?? (() => pendingHistoryLabels().undo);

  const toggle = el("button", {
    class: "database-ai-toggle",
    attrs: { type: "button", title: "AI 어시스턴트 열기", "aria-label": "에디터 AI 어시스턴트 열기", "aria-expanded": "false" },
    dataset: { testid: "database-ai-toggle" },
    children: [icon("sparkle", "database-modal-icon"), "AI 어시스턴트"],
  }) as HTMLButtonElement;

  const input = el("input", {
    class: "database-ai-input",
    attrs: { type: "text", "aria-label": "AI에게 보낼 요청", autocomplete: "off" },
    dataset: { testid: "database-ai-input" },
  }) as HTMLInputElement;
  const runButton = el("button", {
    class: "database-ai-run",
    attrs: { type: "button", title: "AI에게 전달 (Enter)", "aria-label": "AI에게 요청 전달" },
    dataset: { testid: "database-ai-run" },
    children: [el("span", { class: "database-ai-run-label", text: "보내기" }), icon("send")],
  }) as HTMLButtonElement;
  const closeButton = el("button", {
    class: "database-ai-close",
    attrs: { type: "button", title: "AI 바 닫기", "aria-label": "데이터베이스 AI 바 닫기" },
    dataset: { testid: "database-ai-close" },
    children: [icon("close")],
  }) as HTMLButtonElement;
  const composer = el("div", {
    class: "database-ai-composer",
    children: [
      el("span", { class: "database-ai-mark", attrs: { "aria-hidden": "true" }, children: [icon("sparkle")] }),
      input,
      runButton,
      closeButton,
    ],
  });

  // 현재 위치 칩 — AI 에게 무엇이 전달되는지 보인다(숨은 컨텍스트가 아니다).
  const contextChip = el("span", { class: "database-ai-context", dataset: { testid: "database-ai-context" } });
  const suggestions = el("div", {
    class: "database-ai-suggestions",
    attrs: { role: "group", "aria-label": "제안 문장" },
  });
  const contextRow = el("div", { class: "database-ai-context-row", children: [contextChip, suggestions] });

  // ── 턴 영역: 요청 원문 · 상태줄 · 도구 결과 · 답변 · 행동 ──────────────────
  const request = el("blockquote", { class: "database-ai-turn-request", dataset: { testid: "database-ai-turn-request" } });
  const statusIcon = el("span", { class: "database-ai-turn-status-icon", attrs: { "aria-hidden": "true" } });
  const statusText = el("span", { class: "database-ai-turn-status-text" });
  const status = el("div", {
    class: "database-ai-turn-status",
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "database-ai-turn-status", phase: "thinking" },
    children: [statusIcon, statusText],
  });
  const tools = el("ul", {
    class: "database-ai-turn-tools",
    attrs: { "aria-label": "바꾼 것" },
    dataset: { testid: "database-ai-turn-tools" },
  });
  const answer = el("div", { class: "database-ai-turn-answer", dataset: { testid: "database-ai-turn-answer" } });
  const abortButton = el("button", {
    class: "database-ai-turn-action",
    attrs: { type: "button" },
    dataset: { testid: "database-ai-turn-abort" },
    text: "중단",
  }) as HTMLButtonElement;
  const undoButton = el("button", {
    class: "database-ai-turn-action",
    attrs: { type: "button" },
    dataset: { testid: "database-ai-turn-undo" },
    children: [icon("undo"), el("span", { class: "database-ai-turn-action-label" })],
  }) as HTMLButtonElement;
  const chatButton = el("button", {
    class: "database-ai-turn-action",
    attrs: { type: "button", title: "같은 대화를 채팅 패널에서 이어갑니다(데이터베이스 창을 닫으면 보입니다)" },
    dataset: { testid: "database-ai-turn-chat" },
    children: [icon("chat"), el("span", { class: "database-ai-turn-action-label", text: "채팅에서 이어가기" })],
  }) as HTMLButtonElement;
  const clearButton = el("button", {
    class: "database-ai-turn-action",
    attrs: { type: "button" },
    dataset: { testid: "database-ai-turn-clear" },
    text: "지우기",
  }) as HTMLButtonElement;
  const actions = el("div", { class: "database-ai-turn-actions", children: [abortButton, undoButton, chatButton, clearButton] });
  const turn = el("section", {
    class: "database-ai-turn",
    attrs: { "aria-label": "AI 진행 상황" },
    dataset: { testid: "database-ai-turn" },
    children: [request, status, tools, answer, actions],
  });
  turn.hidden = true;

  const bar = el("section", {
    class: "database-ai-bar",
    attrs: { "aria-label": "에디터 AI 어시스턴트" },
    dataset: { testid: "database-ai-bar" },
    children: [composer, contextRow, turn],
  });
  bar.hidden = true;

  let cancelPoll: (() => void) | null = null;
  let busy = false;
  let lastToolCount = 0;
  let ownedJobId: string | null = null;
  let unbindJob: (() => void) | null = null;
  let requestEpoch = 0;

  const stopPolling = (): void => {
    cancelPoll?.();
    cancelPoll = null;
  };

  const refreshContext = (): void => {
    const context = options.context();
    const tabLabel = databaseTabLabel(context.tab);
    const where = context.record ? `${tabLabel} › ${recordName(context.record)}` : tabLabel;
    contextChip.replaceChildren(
      el("span", { class: "database-ai-context-label", text: "지금 보는 곳" }),
      el("span", { class: "database-ai-context-where", text: where }),
    );
    contextChip.title = "요청과 함께 AI 에게 전달되는 현재 화면 정보";
    input.placeholder = context.record
      ? `${tabLabel} 탭에 관해 요청하세요 · 예) 「${recordName(context.record)}」을 중반 난이도로`
      : `${tabLabel} 탭에 관해 요청하거나 물어보세요`;
    suggestions.replaceChildren(
      ...databaseAiSuggestions(context).map((suggestion) => el("button", {
        class: "database-ai-suggestion",
        text: suggestion.label,
        attrs: { type: "button", title: suggestion.prompt },
        dataset: { testid: `database-ai-suggestion-${suggestion.id}` },
        on: {
          click: () => {
            input.value = suggestion.prompt;
            input.focus();
          },
        },
      })),
    );
  };

  let paintedPhase: DatabaseAiTurnPhase | null = null;
  const paintSummary = (summary: DatabaseAiTurnSummary): void => {
    // 폴링마다 같은 문장을 다시 쓰면 role=status 가 400ms 마다 재낭독한다 — 바뀔 때만 쓴다.
    if (status.dataset.phase !== summary.phase) status.dataset.phase = summary.phase;
    if (statusText.textContent !== summary.statusText) statusText.textContent = summary.statusText;
    if (paintedPhase !== summary.phase) {
      paintedPhase = summary.phase;
      statusIcon.replaceChildren(summary.phase === "done" ? icon("check") : el("span", { class: "database-ai-spinner" }));
    }
    statusIcon.hidden = summary.phase === "error";
    if (summary.tools.length !== lastToolCount) {
      tools.replaceChildren(...summary.tools.map((text) => el("li", {
        text,
        ...(text.startsWith("실패 — ") ? { dataset: { failed: "true" } } : {}),
      })));
      lastToolCount = summary.tools.length;
    }
    tools.hidden = summary.tools.length === 0;
    if (summary.answer) renderAnswer(answer, summary.answer);
    else answer.replaceChildren();
    answer.hidden = !summary.answer;
    const finished = summary.phase === "done" || summary.phase === "error";
    abortButton.hidden = finished;
    clearButton.hidden = !finished;
    chatButton.hidden = !finished;
    const label = finished && summary.changed > 0 ? undoLabel() : null;
    undoButton.hidden = !label;
    if (label) {
      const labelHost = undoButton.querySelector(".database-ai-turn-action-label");
      if (labelHost) labelHost.textContent = `되돌리기: ${label}`;
      undoButton.title = `방금 AI 가 적용한 「${label}」을 되돌립니다`;
    }
  };

  const setBusy = (next: boolean): void => {
    busy = next;
    runButton.disabled = next;
    runButton.setAttribute("aria-busy", String(next));
    bar.classList.toggle("is-busy", next);
  };

  const runRequest = (): void => {
    if (busy) return;
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    const context = options.context();
    const message = `${text}\n\n${databaseAiContextFooter(context)}`;
    if (typeof window !== "undefined") {
      window.__oprnDbAiLastRequest = { message, at: new Date().toISOString() };
    }
    input.value = "";
    request.textContent = text;
    turn.hidden = false;
    lastToolCount = -1;
    setBusy(true);
    paintSummary(summarizeDatabaseAiTurn([], { busy: true }));
    unbindJob?.();
    unbindJob = null;
    ownedJobId = null;
    const epoch = ++requestEpoch;
    void send(message)
      .then((result) => {
        if (epoch !== requestEpoch) return;
        if (result.jobId) {
          const ownedId = result.jobId;
          ownedJobId = ownedId;
          request.textContent = text;
          paintSummary(summarizeDatabaseAiTurn([], { busy: true }));
          unbindJob = bindJobView(ownedId, job => {
            if (epoch !== requestEpoch || ownedJobId !== ownedId || job.id !== ownedId) return;
            if (job.generation === "succeeded") {
              unbindJob?.();
              unbindJob = null;
              const capturedSha = job.resultRef?.sha256;
              void readJobResult(job).then(payload => {
                if (epoch !== requestEpoch || ownedJobId !== ownedId) return;
                const live = getJobClient().jobs.get(ownedId);
                if (!capturedSha || live?.resultRef?.sha256 !== capturedSha) return;
                const answer = typeof payload?.payload.assistantText === "string" ? payload.payload.assistantText : result.lastAssistantText;
                const jobAudit = Array.isArray(payload?.payload.audit) ? payload.payload.audit as AiBridgeAuditEntry[] : [];
                const withAnswer = answer && !jobAudit.some((entry) => entry.kind === "assistant" && entry.text?.trim())
                  ? [...jobAudit, { kind: "assistant", text: answer }]
                  : jobAudit;
                paintSummary(summarizeDatabaseAiTurn(withAnswer, { busy: false }));
                setBusy(false);
                if (!status.querySelector('[data-testid="ai-job-origin"]')) {
                  status.append(jobOriginLink(ownedId, runButton));
                }
              }).catch((cause: unknown) => {
                if (epoch !== requestEpoch || ownedJobId !== ownedId) return;
                paintSummary(summarizeDatabaseAiTurn([], {
                  busy: false,
                  error: cause instanceof Error ? cause.message : String(cause),
                }));
                setBusy(false);
              });
            } else if (job.generation === "failed" || job.generation === "cancelled" || job.generation === "interrupted") {
              unbindJob?.();
              unbindJob = null;
              if (epoch !== requestEpoch || ownedJobId !== ownedId) return;
              paintSummary(summarizeDatabaseAiTurn([], {
                busy: false,
                error: job.generation === "cancelled" ? "취소됨" : job.generation === "interrupted" ? "중단됨" : "실패",
              }));
              setBusy(false);
            }
          });
          return;
        }
        paintSummary(summarizeDatabaseAiTurn([], { busy: false, error: result.ok ? undefined : result.error || "알 수 없는 오류" }));
        setBusy(false);
      })
      .catch((cause: unknown) => {
        if (epoch !== requestEpoch) return;
        paintSummary(summarizeDatabaseAiTurn([], { busy: false, error: cause instanceof Error ? cause.message : String(cause) }));
        setBusy(false);
      });
  };

  runButton.addEventListener("click", runRequest);
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    // Escape 는 바만 접는다 — 예전엔 문서 층의 모달 스택이 받아 데이터베이스 창 전체가 닫혔다.
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      toggle.focus();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    runRequest();
  });
  input.addEventListener("focus", refreshContext);
  abortButton.addEventListener("click", () => {
    if (ownedJobId) void getJobClient().cancel(ownedJobId);
    else abort();
    statusText.textContent = "중단하는 중…";
  });
  undoButton.addEventListener("click", () => {
    const label = undoLabel();
    if (!undo()) {
      toast("되돌릴 작업이 없습니다", "info");
      undoButton.hidden = true;
      return;
    }
    toast(label ? `되돌렸습니다 — ${label}` : "되돌렸습니다", "ok");
    status.dataset.phase = "done";
    statusText.textContent = label ? `「${label}」을 되돌렸어요` : "되돌렸어요";
    undoButton.hidden = true;
  });
  chatButton.addEventListener("click", () => {
    if (!openPanel()) toast("채팅 패널을 열 수 없습니다", "error");
    else toast("채팅 패널을 펼쳤어요 — 데이터베이스 창을 닫으면 보입니다", "info");
  });
  clearButton.addEventListener("click", () => {
    turn.hidden = true;
    request.textContent = "";
    tools.replaceChildren();
    answer.replaceChildren();
    input.focus();
  });

  const setOpen = (open: boolean): void => {
    bar.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.title = open ? "AI 어시스턴트 닫기" : "AI 어시스턴트 열기";
    if (open) {
      refreshContext();
      input.focus();
    }
  };
  // hidden 은 lib.dom 에서 string | boolean 이다("until-found"). 숨어 있으면 연다.
  toggle.addEventListener("click", () => setOpen(Boolean(bar.hidden)));
  closeButton.addEventListener("click", () => setOpen(false));

  refreshContext();

  return {
    element: bar,
    toggle,
    setOpen,
    refreshContext,
    dispose: () => {
      requestEpoch += 1;
      unbindJob?.();
      unbindJob = null;
      ownedJobId = null;
      stopPolling();
    },
  };
}
