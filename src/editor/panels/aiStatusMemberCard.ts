// editor/panels/aiStatusMemberCard.ts
// 지도 위 시공 배지·지도 아래 상태 줄 칩을 눌렀을 때 뜨는 작업 상세 카드 — 「이 조수가 무엇을 맡았고, 지금 뭘 하고, 어디까지 했나」.
//
// 왜(2026-10-18 · 2026-11-28 보강):
//  - 한눈에 볼 수 있는 요약(임무·지금·최근 단계)을 유지하면서, 더 알고 싶은 사용자는
//    각 단계를 눌러 도구 이름·인자·결과 원문을 펼치거나 「자세히」 전환으로 전체 과정(최대 30단계)·조수 메모·할 일 계획을 볼 수 있다.
//  - 팀 보드(teamActivity·backgroundBoards)에 이미 있는 기록·작업 그림을 그대로 읽는다 — 새 관측을 만들지 않는다.
//
// DOM 계약: `ai-status-pop-head` · `ai-status-pop-task-card` · `ai-status-pop-now-banner` · `ai-status-pop-note` ·
// `ai-status-pop-stats` · `ai-status-pop-media` · `ai-status-pop-timeline`.

import type { ActivityEntry, ActivityTrace } from "@/ai/activityTrace";
import { currentTeamActivity } from "@/ai/piAgent/teamActivity";
import { formatToolArgs, type TeamBoardAgent } from "@/ai/piAgent/teamBoardState";
import { narrateAiActivity } from "@/editor/aiActivityNarration";
import { formatEditorDate } from "@/i18n";
import { el } from "@/util/dom";
import { activityEntryIndex } from "./aiActivityIndex";
import { createActivityMedia } from "./aiActivityMedia";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
import { plannedStepsFromTodoArgs } from "./aiLiveStatus";
import { boardForPresence, isActive, PRESENCE_LABEL, type Presence } from "./aiPresence";
import { teamObservation } from "./aiTeamObservation";

/** 기본(간단) 보기에서 펼치는 최근 단계 수. */
const BRIEF_TIMELINE_LIMIT = 8;
/** 「자세히」 보기에서 펼치는 최근 단계 수. */
const DETAIL_TIMELINE_LIMIT = 30;
/** 임무 문장이 이 길이를 넘으면 3줄로 접고 「전문 보기」를 붙인다. */
const TASK_COLLAPSE_CHARS = 150;
/** 조수 메모가 이 길이를 넘으면 접기/펼치기를 붙인다. */
const NOTE_COLLAPSE_CHARS = 140;

interface RichStep {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly toolName?: string;
  readonly argsText?: string;
  readonly resultText?: string;
  readonly at?: number;
  readonly ms?: number;
  readonly step?: number;
  readonly failed: boolean;
  readonly running: boolean;
}

const COORDINATION_RUNNING: Readonly<Record<string, string>> = {
  assign_map_agent: "조수에게 맵 작업을 배정하는 중",
  assign_task_agent: "조수에게 작업을 배정하는 중",
  wait_agents: "배정한 조수의 완료를 기다리는 중",
  check_agents: "조수들의 진행 상황을 확인하는 중",
  review_map: "맵 검수를 맡기는 중",
  finish: "팀 결과를 정리하는 중",
};

/** 경과 시간 「12초」·「1분 05초」 — 상태 줄의 시계와 카드의 시계·소요 시간이 같은 표기를 쓴다. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, "0")}초`;
}

function formatLastActivity(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 3) return "방금 활동";
  if (seconds < 60) return `${seconds}초 전 활동`;
  return `${Math.floor(seconds / 60)}분 전 활동`;
}

function took(ms: number | undefined): string {
  if (ms === undefined || ms < 100) return "";
  return ms < 10_000 ? `${(ms / 1000).toFixed(1)}초` : formatElapsed(ms);
}

function roleOf(presence: Presence, agent: TeamBoardAgent | undefined): { label: string; icon: DeckIconName } {
  if (agent?.role === "orchestrator") return { label: agent.kindLabel || "팀장", icon: "flag" };
  if (agent?.role === "reviewer" || presence.readsOnly) return { label: agent?.kindLabel || "검수", icon: "shield" };
  if (agent) return { label: agent.kindLabel || "시공", icon: /장식|정원|숲/.test(agent.roleLabel) ? "tree" : "house" };
  if (presence.source === "region") return { label: "영역", icon: "selection" };
  return { label: "조수", icon: "user" };
}

function scopeLabel(presence: Presence): string {
  const map = presence.mapName ?? "프로젝트 전체";
  if (!presence.region) return map;
  const { x, y, width, height } = presence.region;
  return `${map} (${x},${y}) ${width}×${height}`;
}

function describeEntry(entry: ActivityEntry, scope: string): string {
  if (entry.kind === "tool") {
    if (entry.status === "info") return entry.summary;
    if (entry.status === "running" && COORDINATION_RUNNING[entry.name]) return COORDINATION_RUNNING[entry.name]!;
    const input = entry.input as { args?: Record<string, unknown> } | undefined;
    return narrateAiActivity({
      toolName: entry.name,
      args: input?.args,
      mapName: scope,
      done: entry.status === "ok" || entry.status === "error",
      ok: entry.status === "ok",
      summary: entry.status === "running" ? undefined : entry.summary,
    }).action;
  }
  if (entry.kind === "assistant") {
    const text = ((entry.output as { text?: string } | undefined)?.text ?? entry.summary ?? "").replace(/\s+/gu, " ").trim();
    return text ? `“${text.length > 140 ? `${text.slice(0, 139)}…` : text}”` : "조수의 중간 보고를 받았어요";
  }
  return entry.summary;
}

function extractActorEntries(trace: ActivityTrace | undefined, agent: TeamBoardAgent | undefined): readonly ActivityEntry[] {
  if (!trace) return [];
  const raw = agent ? (activityEntryIndex(trace).byActor.get(agent.agentId) ?? []) : trace.entries;
  return raw.filter(entry => entry.name !== "connection.heartbeat" && entry.name !== "map.image.delivered");
}

function buildRichSteps(
  entries: readonly ActivityEntry[],
  scope: string,
  detailMode: boolean,
): { readonly steps: readonly RichStep[]; readonly total: number; readonly activeTool: RichStep | null } {
  const receiptOrder = (a: ActivityEntry, b: ActivityEntry) => (a.endedAt ?? a.at) - (b.endedAt ?? b.at);
  const allowedKinds = detailMode
    ? new Set(["tool", "agent_spawn", "agent_done", "review", "status", "error", "assistant"])
    : new Set(["tool", "agent_spawn", "agent_done", "review", "status", "error"]);
  const major = entries.filter(entry => allowedKinds.has(entry.kind)).sort(receiptOrder);
  const limit = detailMode ? DETAIL_TIMELINE_LIMIT : BRIEF_TIMELINE_LIMIT;
  const first = Math.max(0, major.length - limit);
  let toolNo = major.slice(0, first).filter(entry => entry.kind === "tool").length;
  const steps: RichStep[] = major.slice(first).map((entry) => {
    const isTool = entry.kind === "tool";
    const step = isTool ? ++toolNo : undefined;
    const ms = entry.durationMs ?? (entry.endedAt !== undefined ? entry.endedAt - entry.at : undefined);
    const inputArgs = isTool ? (entry.input as { args?: unknown } | undefined)?.args : undefined;
    const argsText = isTool && inputArgs !== undefined ? formatToolArgs(inputArgs, 220) : "";
    const label = describeEntry(entry, scope);
    const rawSummary = (entry.summary ?? "").replace(/\s+/gu, " ").trim();
    const resultText = rawSummary && rawSummary !== label && rawSummary !== "실행 중" ? rawSummary : "";
    return {
      id: entry.id,
      kind: entry.kind,
      label,
      ...(isTool ? { toolName: entry.name } : {}),
      ...(argsText ? { argsText } : {}),
      ...(resultText ? { resultText } : {}),
      at: entry.endedAt ?? entry.at,
      ...(ms !== undefined ? { ms } : {}),
      ...(step !== undefined ? { step } : {}),
      failed: entry.status === "error",
      running: isTool && entry.status === "running",
    };
  });
  const activeTool = [...steps].reverse().find(step => step.running) ?? null;
  return { steps, total: major.length, activeTool };
}

function extractPlannedTodos(entries: readonly ActivityEntry[]): readonly string[] {
  const items: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== "tool" || entry.name !== "todo") continue;
    const args = (entry.input as { args?: unknown } | undefined)?.args;
    const parsed = plannedStepsFromTodoArgs(args);
    if (!parsed) continue;
    if (parsed.op === "init") items.length = 0;
    items.push(...parsed.items);
  }
  return items;
}

/** 이 조수가 함께 도는 팀 실행의 일인가 — 그렇다면 오른쪽 도크의 조수 상세에 같은 행이 있다. */
export function presenceInTeamRun(presence: Presence): boolean {
  return presence.source === "chat" && currentTeamActivity()?.mode === "team";
}

export interface StatusMemberCardOptions {
  /** 「자세히」·단계 펼침 등 카드 내부 상태 변경으로 다시 그리기가 필요할 때 호출된다. */
  readonly onViewChange?: (detailMode: boolean) => void;
}

export function createStatusMemberCard(options: StatusMemberCardOptions = {}): {
  render(presence: Presence, actions: readonly HTMLElement[], onClose: () => void): HTMLElement[];
  isDetailMode(): boolean;
  tick(): void;
} {
  let clockNode: HTMLElement | null = null;
  let clockPresence: Presence | null = null;
  let lastActivityNode: HTMLElement | null = null;
  let lastActivityAt: number | undefined;
  // 그림은 같은 그림이면 다시 만들지 않는다 — 조수 이벤트마다 다시 그리면 읽던 그림이 깜박인다.
  let mediaNode: HTMLElement | null = null;
  let mediaId = "";
  // 사용자 펼침 상태는 실시간 스트림 갱신에도 유지한다.
  let detailMode = false;
  let taskExpanded = false;
  let noteExpanded = false;
  let ownerKey = "";
  const expandedSteps = new Set<string>();

  const clockText = (presence: Presence): string => {
    const parts: string[] = [];
    if (presence.steps > 0) parts.push(`${presence.steps}단계 진행`);
    if (presence.startedAt !== undefined && isActive(presence)) parts.push(formatElapsed(Date.now() - presence.startedAt));
    return parts.join(" · ");
  };

  function syncOwner(presence: Presence): void {
    const nextKey = presence.id === "run" ? "chat:run" : `${presence.source}:${presence.id}`;
    // 준비 구간("run") → 스폰된 에이전트 인계 시에는 사용자가 펼쳐 둔 상태를 유지한다.
    if (ownerKey && ownerKey !== nextKey && !(ownerKey === "chat:run" && presence.source === "chat")) {
      expandedSteps.clear();
      taskExpanded = false;
      noteExpanded = false;
    }
    ownerKey = nextKey;
  }

  function render(presence: Presence, actions: readonly HTMLElement[], onClose: () => void): HTMLElement[] {
    syncOwner(presence);
    const found = boardForPresence(presence);
    const agent = found?.agent;
    const role = roleOf(presence, agent);
    const working = presence.state === "working";
    const scope = agent?.mapName || agent?.mapId || presence.mapName || "프로젝트 전체";
    const actorEntries = extractActorEntries(found?.board.trace, agent);
    const observation = found ? teamObservation(agent, found.board.trace, undefined, BRIEF_TIMELINE_LIMIT) : null;
    const rich = found?.board.trace
      ? buildRichSteps(actorEntries, scope, detailMode)
      : {
          steps: [...presence.recent].reverse().map((item, idx): RichStep => ({
            id: `p:${idx}:${item.label}`,
            kind: "tool",
            label: item.label,
            step: idx + 1,
            failed: item.failed,
            running: item.running,
          })),
          total: presence.recent.length,
          activeTool: null,
        };

    const meta = el("span", { class: "ai-status-pop-clock", dataset: { testid: "ai-status-pop-clock" }, attrs: { translate: "no" }, text: clockText(presence) });
    clockNode = meta; clockPresence = presence;
    const head = el("header", { class: "ai-status-pop-head", children: [
      el("span", { class: "ai-status-pop-avatar", dataset: { tone: String(presence.tone), state: presence.state }, attrs: { "aria-hidden": "true" }, children: [
        deckIcon(role.icon, { size: 18 }),
        el("span", { class: `ai-status-pop-pulse${isActive(presence) ? " is-pulse" : ""}`, dataset: { state: presence.state } }),
      ] }),
      el("div", { class: "ai-status-pop-ident", children: [
        el("div", { class: "ai-status-pop-title", children: [
          el("strong", { text: presence.name }),
          el("span", { class: "ai-status-tag", dataset: { state: presence.state }, text: PRESENCE_LABEL[presence.state] }),
        ] }),
        el("div", { class: "ai-status-pop-meta", children: [
          el("span", { class: "ai-status-pop-role", text: `#${presence.no} · ${role.label}`, attrs: { translate: "no" } }),
          el("span", { class: "ai-status-pop-scope", text: scopeLabel(presence), attrs: { translate: "no" } }),
          meta,
        ] }),
      ] }),
      el("button", { class: "ai-status-pop-close", attrs: { type: "button", "aria-label": "닫기", title: "닫기" }, children: [deckIcon("x", { size: 15 })], on: { click: onClose } }),
    ] });

    const taskText = presence.task || "아직 배정받은 임무가 없어요";
    const taskLong = taskText.length > TASK_COLLAPSE_CHARS;
    const task = el("section", { class: "ai-status-pop-task-card", dataset: { testid: "ai-status-pop-task", expanded: String(taskExpanded || !taskLong) }, children: [
      el("div", { class: "ai-status-pop-card-head", children: [
        el("span", { class: "ai-status-pop-label", text: "배정된 임무" }),
        ...(taskLong ? [el("button", {
          class: "ai-status-pop-link",
          attrs: { type: "button", "aria-expanded": String(taskExpanded) },
          text: taskExpanded ? "접기" : "전문 보기",
          on: { click: () => { taskExpanded = !taskExpanded; options.onViewChange?.(detailMode); } },
        })] : []),
      ] }),
      el("p", { class: taskLong && !taskExpanded ? "is-clamped" : "", text: taskText, attrs: { translate: "no" } }),
    ] });

    const liveNote = working && agent?.lastKind === "text" && agent.lastLine.trim()
      ? agent.lastLine.trim()
      : "";
    const nowText = presence.note && !working
      ? `${presence.action} · ${presence.note}`
      : presence.action === "생각 중" && liveNote
        ? liveNote
        : presence.action;
    const activeToolSub = working && rich.activeTool?.toolName
      ? [rich.activeTool.toolName, rich.activeTool.argsText].filter(Boolean).join(" · ")
      : working && liveNote && nowText !== liveNote
        ? liveNote
        : "";
    const now = el("div", { class: "ai-status-pop-now-banner", dataset: { testid: "ai-status-pop-now", state: presence.state }, attrs: { role: "status" }, children: [
      working ? el("span", { class: "ai-status-spinner", attrs: { "aria-hidden": "true" } })
        : el("span", { class: "ai-status-pop-now-icon", attrs: { "aria-hidden": "true" }, children: [deckIcon(presence.state === "failed" ? "alert" : presence.state === "waiting" ? "clock" : "check", { size: 15 })] }),
      el("div", { class: "ai-status-pop-now-body", children: [
        el("div", { class: "ai-status-pop-now-main", children: [
          el("span", { class: "ai-status-pop-label", text: "지금" }),
          el("span", { class: "ai-status-pop-now-text", text: nowText }),
        ] }),
        ...(activeToolSub ? [el("span", { class: "ai-status-pop-now-sub", dataset: { testid: "ai-status-pop-now-sub" }, text: activeToolSub, attrs: { translate: "no", title: activeToolSub } })] : []),
      ] }),
    ] });

    // 조수가 중간에 남긴 계획·설명 한마디(assistant 보고문). 임무 원문과 같으면 되풀이하지 않는다.
    const reportRaw = (observation?.report ?? "").replace(/\s+/gu, " ").trim();
    const showReport = Boolean(reportRaw && reportRaw !== presence.task.trim());
    const noteLong = reportRaw.length > NOTE_COLLAPSE_CHARS;
    const noteCard = showReport ? el("section", { class: "ai-status-pop-note", dataset: { testid: "ai-status-pop-note" }, children: [
      el("div", { class: "ai-status-pop-card-head", children: [
        el("span", { class: "ai-status-pop-label", text: "조수 메모" }),
        ...(noteLong ? [el("button", {
          class: "ai-status-pop-link",
          attrs: { type: "button", "aria-expanded": String(noteExpanded) },
          text: noteExpanded ? "접기" : "더 보기",
          on: { click: () => { noteExpanded = !noteExpanded; options.onViewChange?.(detailMode); } },
        })] : []),
      ] }),
      el("p", { class: noteLong && !noteExpanded ? "is-clamped" : "", text: reportRaw, attrs: { translate: "no" } }),
    ] }) : null;

    // 진행 요약 칩: 턴 수 · 도구 호출 · 오류 · 변경 수 · 최근 활동 시각.
    const statPills: HTMLElement[] = [];
    if (agent && agent.turns > 0) statPills.push(el("span", { class: "ai-status-stat-pill", text: `${agent.turns}턴`, attrs: { translate: "no" } }));
    const toolCount = agent?.toolCalls ?? presence.steps;
    if (toolCount > 0) statPills.push(el("span", { class: "ai-status-stat-pill", text: `도구 ${toolCount}회`, attrs: { translate: "no" } }));
    if (agent && agent.toolErrors > 0) statPills.push(el("span", { class: "ai-status-stat-pill is-error", text: `오류 ${agent.toolErrors}건`, attrs: { translate: "no" } }));
    const changedCount = agent?.changedKeys.length || found?.board.changedKeys.length || found?.board.reviewChips.length || 0;
    if (changedCount > 0) statPills.push(el("span", { class: "ai-status-stat-pill is-ok", text: `변경 ${changedCount}건`, attrs: { translate: "no" } }));
    lastActivityAt = observation?.lastAt;
    lastActivityNode = null;
    if (lastActivityAt !== undefined && isActive(presence)) {
      const activityPill = el("span", {
        class: "ai-status-stat-pill is-live",
        dataset: { testid: "ai-status-pop-last-activity" },
        text: formatLastActivity(lastActivityAt),
        attrs: { translate: "no" },
      });
      lastActivityNode = activityPill;
      statPills.push(activityPill);
    }
    const statsBar = statPills.length > 0
      ? el("div", { class: "ai-status-pop-stats", dataset: { testid: "ai-status-pop-stats" }, children: statPills })
      : null;

    const media = found?.board.trace && agent ? activityEntryIndex(found.board.trace).mediaByActor.get(agent.agentId) : undefined;
    const latest = media?.at(-1);
    if (!latest) { mediaNode = null; mediaId = ""; }
    else if (latest.id !== mediaId || !mediaNode) {
      mediaId = latest.id;
      mediaNode = el("div", { class: "ai-status-pop-media", dataset: { testid: "ai-status-pop-media" }, children: [createActivityMedia([latest], "")] });
    }

    const plannedTodos = extractPlannedTodos(actorEntries);
    const doneToolCount = rich.steps.filter(step => step.kind === "tool" && !step.running && !step.failed).length;
    const remainingTodos = plannedTodos.length > 0
      ? plannedTodos.slice(Math.min(doneToolCount, plannedTodos.length)).slice(0, detailMode ? 8 : 3)
      : [];

    const rows = rich.steps.length ? rich.steps.map((step) => {
      const status = step.failed ? "error" : step.running ? "running" : "ok";
      const time = step.running
        ? "진행 중"
        : [step.at ? formatEditorDate(new Date(step.at), { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "", took(step.ms)].filter(Boolean).join(" · ");
      const hasDetail = Boolean(step.toolName || step.argsText || step.resultText);
      const isExpanded = hasDetail && (detailMode || expandedSteps.has(step.id));

      const mark = el("span", { class: "ai-status-step-mark", attrs: { "aria-label": status === "error" ? "실패" : status === "running" ? "진행 중" : "완료" }, children: [
        status === "running" ? el("span", { class: "ai-status-spinner is-small" }) : deckIcon(status === "error" ? "x" : "check", { size: 15 }),
      ] });
      const no = el("span", { class: "ai-status-step-no", text: String(step.step ?? ""), attrs: { translate: "no" } });
      const text = el("span", { class: "ai-status-step-text", text: step.label, attrs: { title: step.label } });
      const timeNode = time ? el("time", { text: time, attrs: { translate: "no" } }) : null;
      const caret = hasDetail
        ? el("span", { class: "ai-status-step-caret", text: isExpanded ? "▾" : "▸", attrs: { "aria-hidden": "true" } })
        : null;

      const detailBox = isExpanded ? el("div", { class: "ai-status-step-detail", dataset: { testid: "ai-status-step-detail" }, children: [
        ...(step.toolName ? [el("div", { class: "ai-status-step-detail-row", children: [
          el("span", { class: "ai-status-step-detail-key", text: "도구" }),
          el("code", { class: "ai-status-step-code", text: step.toolName, attrs: { translate: "no" } }),
        ] })] : []),
        ...(step.argsText ? [el("div", { class: "ai-status-step-detail-row", children: [
          el("span", { class: "ai-status-step-detail-key", text: "입력" }),
          el("span", { class: "ai-status-step-detail-val", text: step.argsText, attrs: { translate: "no" } }),
        ] })] : []),
        ...(step.resultText ? [el("div", { class: "ai-status-step-detail-row", children: [
          el("span", { class: "ai-status-step-detail-key", text: step.failed ? "오류" : "결과" }),
          el("span", { class: `ai-status-step-detail-val${step.failed ? " is-error" : ""}`, text: step.resultText, attrs: { translate: "no" } }),
        ] })] : []),
      ] }) : null;

      if (!hasDetail) {
        return el("li", { dataset: { status }, children: [
          el("div", { class: "ai-status-step-row", children: [mark, no, text, ...(timeNode ? [timeNode] : [])] }),
        ] });
      }
      const rowBtn = el("button", {
        class: "ai-status-step-row is-expandable",
        attrs: { type: "button", "aria-expanded": String(isExpanded), title: isExpanded ? "단계 상세 접기" : "도구·입력·결과 상세 보기" },
        dataset: { testid: "ai-status-step-toggle" },
        children: [mark, no, text, ...(timeNode ? [timeNode] : []), ...(caret ? [caret] : [])],
        on: { click: () => {
          if (detailMode) {
            // 자세히 모드에서 개별 행 클릭 시에도 자연스럽게 접거나 펼칠 수 있도록 자세히 모드를 유지한 채 기본으로 전환한다.
            detailMode = false;
            expandedSteps.clear();
            options.onViewChange?.(detailMode);
            return;
          }
          if (expandedSteps.has(step.id)) expandedSteps.delete(step.id);
          else expandedSteps.add(step.id);
          options.onViewChange?.(detailMode);
        } },
      });
      return el("li", { dataset: { status, expanded: String(isExpanded) }, children: [rowBtn, ...(detailBox ? [detailBox] : [])] });
    }) : [el("li", { class: "is-empty", text: working ? (liveNote || "첫 단계를 준비하고 있어요") : "기록된 단계가 없어요" })];

    const countText = rich.total > rich.steps.length
      ? `총 ${rich.total}단계 중 최근 ${rich.steps.length}단계`
      : rich.steps.length
        ? `${rich.steps.length}단계`
        : "";
    const detailToggle = el("button", {
      class: `ai-status-pop-detail-toggle${detailMode ? " is-active" : ""}`,
      attrs: {
        type: "button",
        "aria-pressed": String(detailMode),
        title: detailMode ? "핵심 단계만 간단히 보기" : "도구 이름·인자·결과와 이전 단계까지 자세히 보기",
      },
      dataset: { testid: "ai-status-pop-detail-toggle" },
      text: detailMode ? "간단히" : "자세히",
      on: { click: () => {
        detailMode = !detailMode;
        if (!detailMode) expandedSteps.clear();
        options.onViewChange?.(detailMode);
      } },
    });

    const timeline = el("section", { class: "ai-status-pop-timeline", dataset: { testid: "ai-status-pop-timeline", detail: String(detailMode) }, children: [
      el("div", { class: "ai-status-pop-section-head", children: [
        el("div", { class: "ai-status-pop-section-title", children: [
          el("span", { class: "ai-status-pop-label", text: "작업 과정" }),
          ...(countText ? [el("span", { class: "ai-status-pop-count", text: countText })] : []),
        ] }),
        detailToggle,
      ] }),
      // 최신 단계가 맨 아래 — 목록이 넘치면 진행 중인 단계가 잘리지 않게 DOM 을 뒤집고 column-reverse 로 아래에서부터 쌓는다.
      el("ol", { children: rows.reverse() }),
      ...(remainingTodos.length > 0 ? [el("div", { class: "ai-status-pop-next", dataset: { testid: "ai-status-pop-next" }, children: [
        el("span", { class: "ai-status-pop-label", text: "다음 예정" }),
        el("ul", { children: remainingTodos.map(item => el("li", { text: item, attrs: { translate: "no" } })) }),
      ] })] : []),
    ] });

    return [
      head,
      task,
      now,
      ...(noteCard ? [noteCard] : []),
      ...(statsBar ? [statsBar] : []),
      ...(mediaNode ? [mediaNode] : []),
      timeline,
      el("footer", { class: "ai-status-pop-actions", children: [...actions] }),
    ];
  }

  return {
    render,
    isDetailMode: () => detailMode,
    tick() {
      if (clockNode && clockPresence && clockNode.isConnected) {
        const text = clockText(clockPresence);
        if (clockNode.textContent !== text) clockNode.textContent = text;
      }
      if (lastActivityNode && lastActivityAt !== undefined && lastActivityNode.isConnected) {
        const text = formatLastActivity(lastActivityAt);
        if (lastActivityNode.textContent !== text) lastActivityNode.textContent = text;
      }
    },
  };
}
