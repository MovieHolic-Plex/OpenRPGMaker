// editor/panels/aiRunTimeline.ts
// 조수 실행 이벤트 → 작업 스트림 상태(순수, DOM 없음). 목업 v4(qa1124, 오너 승인 2026-11-24)의 재료다.
//
// 지어내지 않는다: 진행률·단계 짐작·설명 문장은 만들지 않는다. 보이는 것은 실행기가 보낸 것뿐이다 —
// 도구 호출(이름표 + 원래 이름 + 실제 인자 요약 + 결과 요약 원문 + 걸린 시간), 모델이 실제로 쓴 글(올 때만),
// 모델의 할 일 목록 그대로, 팀 일꾼(agent_spawn)과 그 맵, 맵 변경의 바뀐 칸 수, 실제 시공 기록의 실제/재생 시간.
import type { PiMapDelta } from "@/ai/piAgent/mapDelta";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { isQuietTool, isStageStatus, plannedStepsFromTodoArgs } from "./aiLiveStatus";
import { toolLabel } from "./aiToolLabels";

export type TimelineLaneRole = "solo" | "orchestrator" | "builder" | "reviewer";
export type TimelineState = "running" | "done" | "failed";

export interface TimelineLane {
  readonly id: string;
  readonly role: TimelineLaneRole;
  readonly title: string;
  readonly rawName: string;
  readonly mapId: string | null;
  readonly mapName: string | null;
  readonly hue: number;
  state: TimelineState;
  /** 모델이 실제로 쓴 글 — 본문 스트림(delta text)과 말(assistant). 오지 않으면 빈 문자열. */
  text: string;
  summary?: string;
}

export interface TimelineRow {
  readonly key: string;
  readonly laneId: string;
  readonly kind: "tool" | "stage";
  readonly label: string;
  readonly name?: string;
  readonly args?: string;
  readonly startedAt: number;
  state: TimelineState;
  result?: string;
  durationMs?: number;
  mapId?: string;
  changedCells?: number;
  /** 실제 시공 기록이 있는 도구 — 기록이 잰 실제 시간. */
  realMs?: number;
  readonly quiet: boolean;
}

export interface TimelineTodo {
  readonly id: string;
  readonly text: string;
  state: "open" | "now" | "done" | "dropped" | "blocked";
}

export interface TimelineSnapshot {
  readonly team: boolean;
  readonly lanes: readonly TimelineLane[];
  readonly rows: readonly TimelineRow[];
  readonly todos: readonly TimelineTodo[];
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly outcome: { readonly ok: boolean; readonly stoppedEarly?: string; readonly changedMaps: number; readonly tools: number } | null;
  /** 맵 → 지금 그 맵을 쥔 조수 id(팀 일꾼이 끝나면 풀린다). */
  readonly mapOwners: Readonly<Record<string, string>>;
}

const ROLE_TITLE: Record<Exclude<TimelineLaneRole, "solo">, string> = { orchestrator: "팀장", builder: "시공", reviewer: "검수" };
const ARG_LIMIT = 160;
const VALUE_LIMIT = 40;
const TEXT_LIMIT = 600;
const SKIP_ARG_KEYS = new Set(["todoId", "reason", "description"]);

function scalar(value: unknown): string | null {
  if (typeof value === "string") { const t = value.replace(/\s+/gu, " ").trim(); return t ? (t.length > VALUE_LIMIT ? `${t.slice(0, VALUE_LIMIT)}…` : t) : null; }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "예" : "아니오";
  return null;
}

/**
 * 실제 인자를 한 줄로 — `name: 바닷가 포구 · theme: coast · width×height: 44×36 · items: 3개`.
 * 값은 바꾸지 않고 줄이기만 한다(긴 글은 자르고, 배열은 개수, 객체는 그 안의 짧은 값만).
 */
export function summarizeToolArgs(args: unknown): string {
  if (!args || typeof args !== "object" || Array.isArray(args)) return scalar(args) ?? "";
  const record = args as Record<string, unknown>;
  const parts: string[] = [];
  const w = record.width ?? record.w, h = record.height ?? record.h;
  const sized = typeof w === "number" && typeof h === "number";
  if (sized) parts.push(`${"width" in record ? "width×height" : "w×h"}: ${w}×${h}`);
  for (const [key, value] of Object.entries(record)) {
    if (SKIP_ARG_KEYS.has(key) || (sized && ["width", "height", "w", "h"].includes(key))) continue;
    const plain = scalar(value);
    if (plain !== null) { parts.push(`${key}: ${plain}`); continue; }
    if (Array.isArray(value)) { parts.push(`${key}: ${value.length}개`); continue; }
    if (value && typeof value === "object") {
      const inner = Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scalar(v)] as const).filter(([, v]) => v !== null).slice(0, 2);
      parts.push(inner.length ? `${key}: {${inner.map(([k, v]) => `${k}: ${v}`).join(", ")}}` : `${key}: {…}`);
    }
  }
  const line = parts.join(" · ");
  return line.length > ARG_LIMIT ? `${line.slice(0, ARG_LIMIT)}…` : line;
}

/** 맵 변경이 건드린 칸 수(층이 여럿이어도 한 칸은 한 번). 층 전체를 보낸 변경은 그 층의 모든 칸이다. */
export function changedCellCount(deltas: readonly PiMapDelta[]): number {
  let total = 0;
  for (const delta of deltas) {
    const cells = new Set<number>();
    for (const layer of delta.layers ?? []) {
      if (layer.full) for (let i = 0; i < layer.full.length; i++) cells.add(i);
      for (const cell of layer.cells ?? []) cells.add(cell.i);
      for (const stack of layer.stacks ?? []) cells.add(stack.i);
    }
    total += cells.size;
  }
  return total;
}

export interface RunTimeline {
  apply(event: PiAgentEvent, at?: number): void;
  finish(ok: boolean, at?: number): void;
  snapshot(): TimelineSnapshot;
}

export function createRunTimeline(options: { readonly now?: () => number; readonly team?: boolean; readonly mapName?: (mapId: string) => string | undefined } = {}): RunTimeline {
  const now = options.now ?? (() => Date.now());
  const startedAt = now();
  const lanes = new Map<string, TimelineLane>();
  const rows: TimelineRow[] = [];
  const running = new Map<string, TimelineRow>();
  const todos: TimelineTodo[] = [];
  const owners: Record<string, string> = {};
  const changedMaps = new Set<string>();
  let team = options.team === true;
  let lastEnded: TimelineRow | null = null;
  let finishedAt: number | null = null;
  let outcome: TimelineSnapshot["outcome"] = null;
  const roleCount: Record<string, number> = {};

  const rootLane = (): TimelineLane => {
    const id = "root";
    let lane = lanes.get(id);
    if (!lane) {
      lane = team
        ? { id, role: "orchestrator", title: "팀장", rawName: "orchestrator", mapId: null, mapName: null, hue: lanes.size, state: "running", text: "" }
        : { id, role: "solo", title: "조수", rawName: "assistant", mapId: null, mapName: null, hue: lanes.size, state: "running", text: "" };
      lanes.set(id, lane);
    }
    return lane;
  };

  const todoById = (task: unknown): TimelineTodo | undefined => {
    if (typeof task !== "string" || !task.trim()) return todos.find((t) => t.state === "now");
    const key = task.trim();
    return todos.find((t) => t.id === key) ?? todos.find((t) => t.text === key);
  };

  const applyTodo = (args: unknown): void => {
    const plan = plannedStepsFromTodoArgs(args);
    if (plan) {
      if (plan.op === "init") todos.length = 0;
      for (const text of plan.items) todos.push({ id: `t${todos.length + 1}`, text, state: "open" });
      return;
    }
    const p = (args ?? {}) as { op?: unknown; task?: unknown };
    const item = todoById(p.task);
    if (!item) return;
    if (p.op === "start") { for (const t of todos) if (t.state === "now") t.state = "open"; item.state = "now"; }
    else if (p.op === "done") item.state = "done";
    else if (p.op === "drop") item.state = "dropped";
    else if (p.op === "block") item.state = "blocked";
  };

  const apply = (raw: PiAgentEvent, at = raw.at ?? now()): void => {
    if (finishedAt !== null) return;
    let event = raw;
    let laneId = "root";
    while (event.type === "agent_event") { laneId = event.agentId; event = event.event; }
    if (event.type === "team_start") { team = true; const lane = lanes.get("root"); if (!lane) rootLane(); return; }
    if (event.type === "agent_spawn") {
      const role: TimelineLaneRole = event.role === "orchestrator" ? "orchestrator" : event.role === "reviewer" ? "reviewer" : "builder";
      roleCount[role] = (roleCount[role] ?? 0) + 1;
      const title = event.label?.trim() || `${ROLE_TITLE[role as Exclude<TimelineLaneRole, "solo">]} ${roleCount[role]}`;
      lanes.set(event.agentId, { id: event.agentId, role, title, rawName: event.agentId, mapId: event.mapId, mapName: event.mapName ?? (event.mapId ? options.mapName?.(event.mapId) ?? null : null), hue: lanes.size, state: "running", text: "" });
      if (event.mapId) owners[event.mapId] = event.agentId;
      return;
    }
    if (event.type === "agent_done") {
      const lane = lanes.get(event.agentId);
      if (lane) { lane.state = event.ok ? "done" : "failed"; lane.summary = event.summary; if (lane.mapId && owners[lane.mapId] === lane.id) delete owners[lane.mapId]; }
      for (const [key, row] of running) if (row.laneId === event.agentId) { row.state = event.ok ? "done" : "failed"; row.durationMs ??= at - row.startedAt; running.delete(key); }
      return;
    }
    const lane = lanes.get(laneId) ?? (laneId === "root" ? rootLane() : null);
    if (!lane) return;
    if (event.type === "delta") { if (event.kind === "text") lane.text = `${lane.text}${event.text}`.slice(-TEXT_LIMIT); return; }
    if (event.type === "assistant") { if (event.text.trim()) lane.text = event.text.trim().slice(-TEXT_LIMIT); return; }
    if (event.type === "tool_start") {
      if (event.name === "todo") { applyTodo(event.args); return; }
      const mapId = event.args && typeof event.args === "object" && typeof (event.args as { mapId?: unknown }).mapId === "string" ? (event.args as { mapId: string }).mapId : lane.mapId ?? undefined;
      const row: TimelineRow = { key: `${laneId}:${event.id}`, laneId, kind: "tool", label: toolLabel(event.name), name: event.name, args: summarizeToolArgs(event.args), startedAt: at, state: "running", quiet: isQuietTool(event.name), ...(mapId ? { mapId } : {}) };
      running.set(row.key, row);
      rows.push(row);
      return;
    }
    if (event.type === "tool_end") {
      const row = running.get(`${laneId}:${event.id}`);
      if (!row) return;
      running.delete(row.key);
      row.state = event.ok ? "done" : "failed";
      row.durationMs = event.durationMs ?? Math.max(0, at - row.startedAt);
      if (event.summary.trim()) row.result = event.summary.trim();
      lastEnded = row;
      return;
    }
    if (event.type === "map_delta") {
      const live = event.maps.filter((m: PiMapDelta) => !m.removed);
      for (const m of live) changedMaps.add(m.mapId);
      // 순서 계약: tool_end 다음에 그 도구의 map_delta 가 온다(piAgentRuntime). 바로 앞에 끝난 도구에 붙인다.
      if (lastEnded && lastEnded.laneId === laneId && lastEnded.changedCells === undefined) {
        lastEnded.changedCells = changedCellCount(live);
        lastEnded.mapId ??= live[0]?.mapId;
      }
      return;
    }
    if (event.type === "checkpoint") {
      const real = (event.constructionLogs ?? []).find((log) => !log.synthetic && !log.truncated && log.steps.length);
      if (real && lastEnded && lastEnded.laneId === laneId) lastEnded.realMs = real.elapsedMs;
      return;
    }
    if (event.type === "execution_status" && isStageStatus(event.name) && event.summary.trim()) {
      rows.push({ key: `${laneId}:s${rows.length}`, laneId, kind: "stage", label: event.summary.trim().slice(0, 140), startedAt: at, state: event.ok === false ? "failed" : "done", quiet: false });
      return;
    }
    if (event.type === "done") {
      const tools = rows.filter((r) => r.kind === "tool").length;
      outcome = { ok: !event.stoppedEarly, ...(event.stoppedEarly ? { stoppedEarly: event.stoppedEarly } : {}), changedMaps: changedMaps.size, tools };
    }
  };

  return {
    apply,
    finish(ok, at = now()) {
      if (finishedAt !== null) return;
      finishedAt = at;
      for (const row of running.values()) { row.state = ok ? "done" : "failed"; row.durationMs ??= at - row.startedAt; }
      running.clear();
      for (const lane of lanes.values()) if (lane.state === "running") lane.state = ok ? "done" : "failed";
      for (const key of Object.keys(owners)) delete owners[key];
      if (!outcome) outcome = { ok, changedMaps: changedMaps.size, tools: rows.filter((r) => r.kind === "tool").length };
      else if (!ok) outcome = { ...outcome, ok: false };
    },
    snapshot() {
      return { team, lanes: [...lanes.values()], rows, todos, startedAt, finishedAt, outcome, mapOwners: { ...owners } };
    },
  };
}
