// editor/panels/databaseAiBar.ts
// 데이터베이스 창 안의 「AI 어시스턴트」 검토 오버레이.
//
// 왜 오버레이인가(2026-09-03 → 2026-09-15): 예전 바는 헤더 아래 인라인 줄이었고 결과를 도구 요약
// 문장 목록으로만 남겼다. 무엇이 어떻게 바뀌는지(HP 64 → 300)는 그 문장에 없었고, 쓰기는 이미
// 적용된 뒤라 되돌리기가 유일한 복구였다. 지금은 DB 창 **안**을 덮는 오버레이가 레코드 카드
// (databaseAiChangeCards)로 before → after 를 보이고, 사용자가 「적용」을 눌러야 커밋된다.
// 3층 모달이 아니라 창 안 오버레이인 이유: 모달을 쌓으면 Escape·포커스 스택이 꼬이고,
// 「이동 →」이 뒤 레코드 뷰를 갱신하는 동작이 창 전환이 되어 버린다.
//
// 엔진은 그대로 채팅 세션(aiAssistantBridge)이다. 달라진 것은 `deferApply` 로 턴을 보내고,
// 브리지가 돌려준 초안(`pendingProposal`)을 여기서 검토·적용·폐기한다는 것뿐이다.
// 초안을 돌려주지 않는 호출자(MCP·구 경로)에게는 종전대로 「이미 적용됨 + 되돌리기」로 보인다.
//
// 제안 칩은 범용 문장 4개(맵 연결·이벤트 흐름…)가 아니라 **지금 보는 탭과 선택 레코드**로
// 만든다. DB 창 안에서 맵 동선을 물어볼 사람은 없다.

import {
  abortAiAssistantTurn,
  applyAiAssistantProposal,
  discardAiAssistantProposal,
  getAiAssistantAudit,
  getAiAssistantStatus,
  openAiAssistantPanel,
  sendAiAssistantMessage,
  type AiBridgeAuditEntry,
  type AiBridgePendingProposal,
  type AiBridgeSendOptions,
  type AiBridgeStatus,
  type AiBridgeTurnResult,
} from "@/editor/aiAssistantBridge";
import type { RunOutcome } from "@/ai/runOutcome";
import { pendingHistoryLabels, undoMapEdit } from "@/editor/mapEditHistory";
import { databaseTabLabel, TAB_GROUPS, type DatabaseTab } from "@/editor/panels/database";
import { describeDatabaseChanges, renderDatabaseChangeCards } from "@/editor/panels/databaseAiChangeCards";
import { buildSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";
import { diffDatabaseRecords, type DatabaseRecordChange } from "@/project/databaseRecordDiff";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { sourceTextOf } from "@/i18n/domTranslator";

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

export type DatabaseAiTurnPhase = "thinking" | "working" | "review" | "done" | "error";

export interface DatabaseAiTurnSummary {
  readonly phase: DatabaseAiTurnPhase;
  readonly statusText: string;
  /** 쓰기 툴 요약(실패 포함, 「실패 — 」 접두어). */
  readonly tools: readonly string[];
  /** 이 턴이 **실행한** 쓰기 툴 수(실패 제외). 적용됐다는 뜻이 아니다 — 그건 `applied`. */
  readonly changed: number;
  readonly answer: string;
  /**
   * 프로젝트에 실제로 반영됐는가. 되돌리기 버튼의 유일한 근거.
   * 검토 게이트(deferApply) 턴은 쓰기 툴이 돌았어도 턴 종료 시점에는 언제나 false 다 — 적용은 「적용」 단추가 한다.
   * 실측(2026-09-15 라이브): 도구 3개가 돌고 턴이 max-tool-calls 로 끝나 초안이 검수 미완료로 버려졌는데,
   * 예전 판정(쓰기 툴 개수 > 0 → "반영됐어요")은 저장소가 그대로인데 반영됐다고 말했다.
   */
  readonly applied: boolean;
}

/** 변경이 담긴 초안이 왜 검토로 넘어오지 않았는지 — 세션이 준 결과로 사람 말 한 줄. */
function droppedDraftReason(outcome: RunOutcome | null | undefined, lastStatus: string | undefined): string {
  switch (outcome?.execution) {
    case "budget-exhausted": return "툴 호출 예산이 다 떨어져서 검수까지 가지 못했어요";
    case "awaiting-user": return "AI 가 묻는 것이 있어요 — 채팅 패널에서 답해 주세요";
    case "cancelled": return "중단됐어요";
    case "blocked":
    case "failed": return lastStatus?.trim() || "세션이 초안을 승인하지 않았어요";
    default: return lastStatus?.trim() || "세션이 초안을 넘기지 않았어요";
  }
}

export interface DatabaseAiBarDeps {
  readonly send?: (text: string, options?: AiBridgeSendOptions) => Promise<AiBridgeTurnResult>;
  readonly status?: () => AiBridgeStatus;
  readonly audit?: () => readonly AiBridgeAuditEntry[];
  readonly abort?: () => void;
  readonly openPanel?: () => boolean;
  readonly undo?: () => boolean;
  readonly undoLabel?: () => string | null;
  /** 검토한 초안을 커밋한다. 실패 사유 한 줄(성공은 null). */
  readonly apply?: () => Promise<string | null>;
  readonly discard?: () => void;
  /** 「이동 →」 — 그 레코드의 탭·선택으로 점프. 없으면 카드에 단추를 그리지 않는다. */
  readonly navigate?: (collection: string, recordId: string) => void;
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
  /** 헤더에 놓는 토글 버튼(aria-expanded 가 오버레이의 열림 상태를 말한다). */
  readonly toggle: HTMLButtonElement;
  readonly setOpen: (open: boolean) => void;
  /** 탭·선택이 바뀌었을 때 자리 표시·제안 칩을 다시 계산한다. */
  readonly refreshContext: () => void;
  readonly dispose: () => void;
}

const POLL_MS = 400;

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

/** 답변 본문의 마크다운 강조·코드 표시를 걷어낸다 — 오버레이 안에서는 평문으로 읽는다. */
function plainAnswer(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .trim();
}

/** 감사 항목(브리지 audit)을 단계·도구 요약·마지막 답변으로 접는다. */
export function summarizeDatabaseAiTurn(
  entries: readonly AiBridgeAuditEntry[],
  options: {
    readonly busy: boolean;
    readonly error?: string;
    readonly pending?: { readonly summary: string };
    /**
     * 검토 게이트로 보낸 턴. 초안이 오지 않았으면 쓰기 툴이 돌았어도 **적용되지 않은 것**이다.
     * 사유는 세션 결과(runOutcome)에서 가져온다. 이 필드가 없는 호출자(MCP·구 경로)는 즉시 적용 세계다.
     */
    readonly deferred?: { readonly outcome: RunOutcome | null | undefined; readonly lastStatus?: string };
  },
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
    return { phase: "error", statusText: `실패 — ${options.error}`, tools, changed, answer, applied: false };
  }
  if (options.busy) {
    return changed > 0
      ? { phase: "working", statusText: `초안 작성 중 · 바꾼 것 ${changed}개`, tools, changed, answer, applied: false }
      : { phase: "thinking", statusText: "생각하는 중…", tools, changed, answer, applied: false };
  }
  // 검토 대기: 아직 프로젝트는 그대로다. 이 문장이 카드 목록 위에서 「무엇이 걸려 있나」를 말한다.
  if (options.pending) {
    return {
      phase: "review",
      statusText: `검토 대기 · ${options.pending.summary} — 아직 프로젝트에 적용되지 않았습니다`,
      tools,
      changed,
      answer,
      applied: false,
    };
  }
  // 검토 게이트 턴인데 초안이 안 왔다: 세션이 즉시 적용하지 않았으므로(deferApply) 프로젝트는 그대로다.
  // 쓰기 툴이 돌았다고 "반영됐다"고 보고하는 것이 이 표면이 없애려던 바로 그 거짓말이다(실측 2026-09-15).
  if (options.deferred) {
    if (changed > 0) {
      return {
        phase: "error",
        statusText: `검토할 초안이 넘어오지 않았어요 — ${droppedDraftReason(options.deferred.outcome, options.deferred.lastStatus)}. 프로젝트는 그대로입니다`,
        tools, changed, answer, applied: false,
      };
    }
    if (tools.length > 0) {
      return { phase: "done", statusText: "끝났지만 적용할 변경이 없어요 — 아래 실패 내용을 확인하세요", tools, changed, answer, applied: false };
    }
    return {
      phase: "done",
      statusText: answer ? "답변했어요 · 데이터 변경 없음" : "끝났지만 답이 비어 있어요 — 채팅 패널에서 확인하세요",
      tools, changed, answer, applied: false,
    };
  }
  // 즉시 적용 세계(deferApply 없는 호출자): 쓰기 툴이 성공했으면 그 자리에서 적용된 것이다.
  if (changed > 0) {
    return { phase: "done", statusText: `완료 · 바꾼 것 ${changed}개 — 화면에 바로 반영됐어요`, tools, changed, answer, applied: true };
  }
  if (tools.length > 0) {
    return { phase: "done", statusText: "끝났지만 적용된 변경은 없어요 — 아래 실패 내용을 확인하세요", tools, changed, answer, applied: false };
  }
  return {
    phase: "done",
    statusText: answer ? "답변했어요 · 데이터 변경 없음" : "끝났지만 답이 비어 있어요 — 채팅 패널에서 확인하세요",
    tools,
    changed,
    answer,
    applied: false,
  };
}

// ── 아이콘(레일 규격: 22×22 · stroke currentColor 1.8) ─────────────────────
const ICONS: Readonly<Record<"sparkle" | "close" | "send" | "undo" | "check" | "chat" | "discard", readonly SvgNodeSpec[]>> = {
  sparkle: [
    { tag: "path", attrs: { d: "M11 3l1.7 4.6L17.3 9.3 12.7 11 11 15.6 9.3 11 4.7 9.3 9.3 7.6z" } },
    { tag: "path", attrs: { d: "M17.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" } },
  ],
  close: [{ tag: "path", attrs: { d: "M6 6l10 10M16 6L6 16" } }],
  send: [{ tag: "path", attrs: { d: "M4 11h13M12 6l5 5-5 5" } }],
  undo: [{ tag: "path", attrs: { d: "M8 7L4 11l4 4M4 11h9a4 4 0 0 1 0 8h-2" } }],
  check: [{ tag: "path", attrs: { d: "M5 11.5l4 4 8-9" } }],
  chat: [{ tag: "path", attrs: { d: "M4 5h14v9H9l-4 3v-3H4z" } }],
  discard: [{ tag: "path", attrs: { d: "M5 7h12M9 7V5h4v2M7 7l1 11h6l1-11" } }],
};

function icon(name: keyof typeof ICONS, className = "database-ai-icon"): SVGSVGElement {
  const svg = buildSvgIcon(ICONS[name]);
  svg.setAttribute("class", className);
  return svg;
}

function defaultSchedule(fn: () => void, ms: number): () => void {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
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
  const readStatus = deps.status ?? getAiAssistantStatus;
  const readAudit = deps.audit ?? getAiAssistantAudit;
  const abort = deps.abort ?? abortAiAssistantTurn;
  const openPanel = deps.openPanel ?? openAiAssistantPanel;
  const undo = deps.undo ?? undoMapEdit;
  const undoLabel = deps.undoLabel ?? (() => pendingHistoryLabels().undo);
  const applyProposal = deps.apply ?? applyAiAssistantProposal;
  const discardProposal = deps.discard ?? discardAiAssistantProposal;
  const navigate = deps.navigate;
  const schedule = deps.schedule ?? defaultSchedule;

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
    attrs: { type: "button", title: "AI 어시스턴트 닫기", "aria-label": "데이터베이스 AI 어시스턴트 닫기" },
    dataset: { testid: "database-ai-close" },
    children: [icon("close")],
  }) as HTMLButtonElement;
  const composer = el("div", {
    class: "database-ai-composer",
    children: [input, runButton],
  });

  // 현재 위치 칩 — AI 에게 무엇이 전달되는지 보인다(숨은 컨텍스트가 아니다).
  const contextChip = el("span", { class: "database-ai-context", dataset: { testid: "database-ai-context" } });
  const suggestions = el("div", {
    class: "database-ai-suggestions",
    attrs: { role: "group", "aria-label": "제안 문장" },
  });
  const contextRow = el("div", { class: "database-ai-context-row", children: [contextChip, suggestions] });

  // ── 턴 영역: 요청 원문 · 상태줄 · 도구 결과 · 카드 · 답변 · 행동 ──────────
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
  const cardsHost = el("div", {
    class: "database-ai-cards-host",
    dataset: { testid: "database-ai-cards-host" },
  });
  cardsHost.hidden = true;
  const answer = el("div", { class: "database-ai-turn-answer", dataset: { testid: "database-ai-turn-answer" } });
  const abortButton = el("button", {
    class: "database-ai-turn-action",
    attrs: { type: "button" },
    dataset: { testid: "database-ai-turn-abort" },
    text: "중단",
  }) as HTMLButtonElement;
  const discardButton = el("button", {
    class: "database-ai-turn-action is-discard",
    attrs: { type: "button", title: "이 변경을 적용하지 않고 버립니다" },
    dataset: { testid: "database-ai-turn-discard" },
    children: [icon("discard"), el("span", { class: "database-ai-turn-action-label", text: "버리기" })],
  }) as HTMLButtonElement;
  const applyButton = el("button", {
    class: "database-ai-turn-action is-apply",
    attrs: { type: "button", title: "검토한 변경을 프로젝트에 적용합니다" },
    dataset: { testid: "database-ai-turn-apply" },
    children: [icon("check"), el("span", { class: "database-ai-turn-action-label", text: "적용" })],
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
  const actions = el("div", {
    class: "database-ai-turn-actions",
    children: [abortButton, undoButton, chatButton, clearButton, discardButton, applyButton],
  });
  const turn = el("section", {
    class: "database-ai-turn",
    attrs: { "aria-label": "AI 진행 상황" },
    dataset: { testid: "database-ai-turn" },
    children: [request, status, tools, cardsHost, answer, actions],
  });
  turn.hidden = true;

  const heading = el("div", {
    class: "database-ai-head",
    children: [
      el("span", { class: "database-ai-mark", attrs: { "aria-hidden": "true" }, children: [icon("sparkle")] }),
      // 단추와 같은 이름 — 「AI 어시스턴트」를 눌러 열어 놀고 다른 이름을 마주하게 하지 않는다.
      el("span", { class: "database-ai-head-title", text: "AI 어시스턴트" }),
      el("span", { class: "database-ai-head-spacer" }),
      closeButton,
    ],
  });
  const panel = el("div", {
    class: "database-ai-panel",
    attrs: { role: "dialog", "aria-label": "데이터베이스 AI 어시스턴트" },
    dataset: { testid: "database-ai-panel" },
    children: [heading, composer, contextRow, turn],
  });
  const bar = el("section", {
    class: "database-ai-bar",
    attrs: { "aria-label": "에디터 AI 어시스턴트" },
    dataset: { testid: "database-ai-bar" },
    children: [panel],
  });
  bar.hidden = true;

  let cancelPoll: (() => void) | null = null;
  let busy = false;
  let lastToolCount = 0;
  let pendingChanges: readonly DatabaseRecordChange[] = [];
  let pendingSummary: string | null = null;

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

  const paintCards = (proposal: AiBridgePendingProposal | null): void => {
    if (!proposal) {
      pendingChanges = [];
      pendingSummary = null;
      cardsHost.replaceChildren();
      cardsHost.hidden = true;
      return;
    }
    pendingChanges = diffDatabaseRecords(proposal.before, proposal.after);
    pendingSummary = describeDatabaseChanges(pendingChanges);
    cardsHost.replaceChildren(renderDatabaseChangeCards(pendingChanges, {
      before: proposal.before,
      after: proposal.after,
      ...(navigate ? { onNavigate: (change: DatabaseRecordChange) => {
        navigate(change.collection, change.id);
        setOpen(false);
        toast(`「${change.name}」으로 이동했어요 — AI 검토는 그대로 있습니다`, "info");
      } } : {}),
    }));
    cardsHost.hidden = pendingChanges.length === 0;
  };

  let paintedPhase: DatabaseAiTurnPhase | null = null;
  const paintSummary = (summary: DatabaseAiTurnSummary): void => {
    // 폴링마다 같은 문장을 다시 쓰면 role=status 가 400ms 마다 재낭독한다 — 바뀔 때만 쓴다.
    if (status.dataset.phase !== summary.phase) status.dataset.phase = summary.phase;
    if (sourceTextOf(statusText) !== summary.statusText) statusText.textContent = summary.statusText;
    if (paintedPhase !== summary.phase) {
      paintedPhase = summary.phase;
      statusIcon.replaceChildren(summary.phase === "done" || summary.phase === "review"
        ? icon("check")
        : el("span", { class: "database-ai-spinner" }));
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
    const reviewing = summary.phase === "review";
    const finished = summary.phase === "done" || summary.phase === "error";
    abortButton.hidden = finished || reviewing;
    clearButton.hidden = !finished;
    chatButton.hidden = !finished;
    applyButton.hidden = !reviewing;
    discardButton.hidden = !reviewing;
    if (reviewing) {
      const labelHost = applyButton.querySelector(".database-ai-turn-action-label");
      if (labelHost) labelHost.textContent = pendingChanges.length > 0 ? `적용 ${pendingChanges.length}건` : "적용";
    }
    // 되돌리기는 **이미 적용된** 변경에만 붙는다 — 쓰기 툴이 돌았다는 것과 적용됐다는 것은 다른 사실이다.
    const label = finished && summary.applied ? undoLabel() : null;
    undoButton.hidden = !label;
    if (label) {
      const labelHost = undoButton.querySelector(".database-ai-turn-action-label");
      if (labelHost) labelHost.textContent = `되돌리기: ${label}`;
      undoButton.title = `방금 AI 가 적용한 「${label}」을 되돌립니다`;
    }
    composer.hidden = reviewing;
    contextRow.hidden = reviewing;
  };

  const setBusy = (next: boolean): void => {
    busy = next;
    runButton.disabled = next;
    runButton.setAttribute("aria-busy", String(next));
    bar.classList.toggle("is-busy", next);
  };

  const runRequest = (): void => {
    if (busy) return;
    if (pendingSummary !== null) {
      toast("검토 중인 변경을 적용하거나 버린 뒤에 다시 요청하세요", "info");
      return;
    }
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
    paintCards(null);
    setBusy(true);
    // 브리지 audit 은 세션 누적이다 — 이 턴의 시작 지점을 잡아 그 뒤만 그린다.
    const startIndex = readAudit().length;
    const sliceAudit = (entries: readonly AiBridgeAuditEntry[]): readonly AiBridgeAuditEntry[] =>
      entries.slice(Math.min(startIndex, entries.length));
    paintSummary(summarizeDatabaseAiTurn([], { busy: true }));
    let settled = false;
    const poll = (): void => {
      cancelPoll = null;
      if (settled) return;
      const entries = sliceAudit(readAudit());
      // 약속이 살아 있는 동안은 이 턴이 진행 중이다. 패널이 아직 바쁘지 않은데 우리 항목도
      // 없다면 채팅 패널이 앞선 턴이 끝나길 기다리는 중이다(브리지 send 의 waitUntilIdle).
      const summary = summarizeDatabaseAiTurn(entries, { busy: true });
      paintSummary(
        !readStatus().turnBusy && entries.length === 0
          ? { ...summary, statusText: "채팅 패널의 앞선 작업이 끝나길 기다리는 중…" }
          : summary,
      );
      cancelPoll = schedule(poll, POLL_MS);
    };
    cancelPoll = schedule(poll, POLL_MS);
    void send(message, { deferApply: true })
      .then((result) => {
        settled = true;
        stopPolling();
        const entries = result.audit.length > 0 ? sliceAudit(result.audit) : sliceAudit(readAudit());
        const withAnswer = result.lastAssistantText && !entries.some((entry) => entry.kind === "assistant" && entry.text?.trim())
          ? [...entries, { kind: "assistant", text: result.lastAssistantText }]
          : entries;
        paintCards(result.pendingProposal ?? null);
        paintSummary(summarizeDatabaseAiTurn(withAnswer, {
          busy: false,
          ...(result.ok ? {} : { error: result.error || "알 수 없는 오류" }),
          ...(pendingSummary !== null ? { pending: { summary: pendingSummary } } : {}),
          // 이 표면은 항상 deferApply 로 보낸다 — 초안이 없으믄 적용도 없다.
          deferred: { outcome: result.runOutcome, lastStatus: result.status.lastStatus },
        }));
        setBusy(false);
      })
      .catch((cause: unknown) => {
        settled = true;
        stopPolling();
        paintCards(null);
        paintSummary(summarizeDatabaseAiTurn([], { busy: false, error: cause instanceof Error ? cause.message : String(cause) }));
        setBusy(false);
      });
  };

  runButton.addEventListener("click", runRequest);
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    // Escape 는 오버레이만 접는다 — 예전엔 문서 층의 모달 스택이 받아 데이터베이스 창 전체가 닫혔다.
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
    abort();
    statusText.textContent = "중단하는 중…";
  });
  applyButton.addEventListener("click", () => {
    if (applyButton.disabled) return;
    applyButton.disabled = true;
    statusText.textContent = "적용하는 중…";
    void Promise.resolve(applyProposal())
      .then((error) => {
        applyButton.disabled = false;
        if (error) {
          status.dataset.phase = "error";
          statusText.textContent = `적용 실패 — ${error}`;
          return;
        }
        const count = pendingChanges.length;
        paintCards(null);
        paintSummary(summarizeDatabaseAiTurn([], { busy: false }));
        status.dataset.phase = "done";
        statusText.textContent = `적용됐어요 · 레코드 ${count}건 — 화면에 바로 반영됩니다`;
        const label = undoLabel();
        undoButton.hidden = !label;
        if (label) {
          const labelHost = undoButton.querySelector(".database-ai-turn-action-label");
          if (labelHost) labelHost.textContent = `되돌리기: ${label}`;
        }
        toast(`AI 변경 ${count}건을 적용했어요`, "ok");
      })
      .catch((cause: unknown) => {
        applyButton.disabled = false;
        status.dataset.phase = "error";
        statusText.textContent = `적용 실패 — ${cause instanceof Error ? cause.message : String(cause)}`;
      });
  });
  discardButton.addEventListener("click", () => {
    const count = pendingChanges.length;
    discardProposal();
    paintCards(null);
    paintSummary(summarizeDatabaseAiTurn([], { busy: false }));
    status.dataset.phase = "done";
    statusText.textContent = `버렸어요 · 레코드 ${count}건 — 프로젝트는 그대로입니다`;
    input.focus();
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
    paintCards(null);
    composer.hidden = false;
    contextRow.hidden = false;
    input.focus();
  });

  const setOpen = (open: boolean): void => {
    bar.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.title = open ? "AI 어시스턴트 닫기" : "AI 어시스턴트 열기";
    if (open) {
      // 오버레이는 헤더와 발 단추 사이를 덮는다. 둘 다 도크·최대화·좁은 폭에서 높이가 바뀌므로
      // 상수로 박지 않고 열 때마다 실측한다. 발 단추(닫기·지금 저장)를 덮지 않는 이유는 두 가지다:
      // 그 줄은 같은 z 층에서 오버레이 위에 그려져 결정 단추를 쟘리고(1440×900 실측: 푸터 835→887 ·
      // 적용 817→845), 검토 중에도 창을 닫거나 저장할 길은 열려 있어야 한다.
      const header = bar.previousElementSibling;
      const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0;
      const footer = bar.parentElement?.querySelector(".database-modal-footer");
      const footerHeight = footer instanceof HTMLElement ? footer.offsetHeight : 0;
      bar.style.setProperty("--database-ai-top", `${headerHeight}px`);
      bar.style.setProperty("--database-ai-bottom", `${footerHeight}px`);
      refreshContext();
      if (pendingSummary === null) input.focus();
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
      stopPolling();
    },
  };
}
