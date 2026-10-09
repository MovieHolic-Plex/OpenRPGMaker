import { retainActivityVisuals } from "./activityMediaArchive";
import type { ActivityVisualRef } from "./activityVisual";
import type { PiAgentEvent } from "./piAgent/protocol";

/** Display-independent, bounded execution receipts. Never retains a project or private thinking. */
export interface ActivityEntry {
  readonly id: string;
  readonly at: number;
  readonly endedAt?: number;
  readonly actor: string;
  readonly kind: string;
  readonly name: string;
  readonly status: "running" | "ok" | "error" | "info";
  readonly summary: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly durationMs?: number;
  readonly visuals?: readonly ActivityVisualRef[];
}
export interface ActivityTrace {
  readonly version: 1;
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly phase: string;
  readonly entries: readonly ActivityEntry[];
  readonly actors: Readonly<Record<string, string>>;
  readonly dropped: number;
  readonly bytes: number;
  readonly serial: number;
}
export const ACTIVITY_ENTRY_LIMIT = 2000;
/** 도구가 일을 끝내고 결과를 맵에 적용하는 중인 행의 요약. 화면은 이 문구로 「반영 중」을 알아본다. */
export const ACTIVITY_APPLYING_SUMMARY = "작업 끝 · 맵에 반영 중";
/** 브라우저가 적용을 끝낸 행. 워커의 tool_end(ACK 왕복 뒤)가 오면 그 결과로 덮인다. */
export const ACTIVITY_APPLIED_SUMMARY = "맵에 반영됨";
export const ACTIVITY_BYTE_LIMIT = 2_000_000;
const PAYLOAD_LIMIT = 24_000;
const SECRET_KEY = /(?:authorization|cookie|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|credential|^token$)/i;
function redact(text: string): string {
  return text.replace(/\bBearer\s+[^\s"']+/gi, "Bearer [가림]")
    .replace(/\b(?:sk-|sk_live_|ghp_|github_pat_)[\w-]{12,}/g, "[인증 정보 가림]")
    .replace(/([?&](?:key|token|api_key|access_token)=)[^&\s]+/gi, "$1[가림]");
}
export function activityText(text: string, max = 12_000): string {
  const safe = redact(text);
  return safe.length > max ? `${safe.slice(0, max)}… [${safe.length - max}자 생략]` : safe;
}
/** Bounds work as well as output size; large tile arrays/images never expand in the journal. */
export function activityPayload(value: unknown): unknown {
  let budget = PAYLOAD_LIMIT;
  const seen = new WeakSet<object>();
  const visit = (v: unknown, depth: number): unknown => {
    if (budget <= 0) return "[크기 상한으로 생략]";
    if (v === undefined || v === null || typeof v === "boolean" || typeof v === "number") return v ?? null;
    if (typeof v === "string") { const result = activityText(v, Math.max(0, Math.min(12_000, budget))); budget -= result.length; return result; }
    if (typeof v !== "object") return String(v);
    if (seen.has(v)) return "[순환 참조]";
    if (depth >= 7) return "[깊이 상한으로 생략]";
    seen.add(v);
    if (Array.isArray(v)) {
      const out = v.slice(0, 120).map(item => visit(item, depth + 1));
      if (v.length > 120) out.push(`[나머지 ${v.length - 120}개 생략]`);
      return out;
    }
    const out: Record<string, unknown> = Object.create(null);
    const pairs = Object.entries(v);
    for (const [key, item] of pairs.slice(0, 100)) {
      budget -= key.length + 8;
      if (SECRET_KEY.test(key)) out[key] = "[인증 정보 가림]";
      else if (/^(?:base64|imageData|project|systemPrompt)$/i.test(key)) out[key] = "[대용량 또는 내부 데이터 제외]";
      else out[key] = visit(item, depth + 1);
      if (budget <= 0) { out._omitted = "크기 상한으로 나머지 필드 생략"; break; }
    }
    if (pairs.length > 100) out._omittedFields = pairs.length - 100;
    return out;
  };
  return visit(value, 0);
}
export function createActivityTrace(title: string, projectId = "", at = Date.now()): ActivityTrace {
  return { version: 1, id: `activity-${at}-${Math.random().toString(36).slice(2)}`, projectId, title: activityText(title, 1000), startedAt: at, updatedAt: at, phase: "준비", entries: [], actors: {}, dropped: 0, bytes: 0, serial: 0 };
}
function size(entry: ActivityEntry): number { return JSON.stringify(entry).length; }
function put(trace: ActivityTrace, entry: ActivityEntry, replace = -1): ActivityTrace {
  const entries = trace.entries.slice();
  let bytes = trace.bytes + size(entry);
  if (replace >= 0) { bytes -= size(entries[replace]!); entries[replace] = entry; } else entries.push(entry);
  let dropped = trace.dropped;
  while (entries.length > ACTIVITY_ENTRY_LIMIT || bytes > ACTIVITY_BYTE_LIMIT) { bytes -= size(entries.shift()!); dropped++; }
  return { ...trace, entries, bytes, dropped, serial: trace.serial + 1, updatedAt: Math.max(trace.updatedAt, entry.endedAt ?? entry.at) };
}
export function activityNote(trace: ActivityTrace, name: string, summary: string, status: ActivityEntry["status"] = "info", data?: unknown, at = Date.now()): ActivityTrace {
  return put(trace, { id: `${trace.id}:${trace.serial}`, at, actor: "system", kind: "status", name, status, summary: activityText(summary), output: data === undefined ? undefined : activityPayload(data) });
}
export function activityPhase(trace: ActivityTrace, phase: string, at = Date.now()): ActivityTrace {
  if (trace.phase === phase) return trace;
  let next = trace;
  if (["완료", "적용됨", "버림", "중단", "실패", "검토 대기"].includes(phase)) {
    // Interrupted calls are not left permanently running; absence of a receipt is explicit.
    for (let i = 0; i < next.entries.length; i++) {
      const entry = next.entries[i]!;
      if (entry.status === "running") next = put(next, { ...entry, status: "info", endedAt: at, summary: `${entry.summary} · 종료 응답 없음` }, i);
    }
  }
  return { ...activityNote(next, "run.phase", phase, phase === "실패" ? "error" : "info", undefined, at), phase };
}
function lastIndex(entries: readonly ActivityEntry[], match: (entry: ActivityEntry) => boolean): number {
  for (let i = entries.length - 1; i >= 0; i--) if (match(entries[i]!)) return i;
  return -1;
}
export function recordActivityEvent(trace: ActivityTrace, event: PiAgentEvent, actor = "agent", now = Date.now()): ActivityTrace {
  const at = event.at ?? now;
  if (event.type === "agent_event") return recordActivityEvent(trace, event.event, event.agentId, at);
  if (event.type === "agent_spawn") trace = { ...trace, actors: { ...trace.actors, [event.agentId]: event.label || ({ orchestrator: "팀장", builder: "시공", reviewer: "검수" }[event.role]) } };
  const base = { id: `${trace.id}:${trace.serial}`, at, actor, kind: event.type, name: event.type, status: "info" as ActivityEntry["status"], summary: "" };
  if (event.type === "tool_start") return put(trace, { ...base, id: `${actor}:${event.id}:${trace.serial}`, kind: "tool", name: event.name, status: "running", summary: "실행 중", input: activityPayload({ callId: event.id, args: event.args }) });
  if (event.type === "tool_end") {
    const index = lastIndex(trace.entries, e => e.actor === actor && e.kind === "tool" && (e.status === "running" || e.summary === ACTIVITY_APPLIED_SUMMARY) && (e.input as { callId?: string })?.callId === event.id);
    const opened = trace.entries[index];
    return put(trace, { ...(opened ?? base), kind: "tool", name: event.name, status: event.ok ? "ok" : "error", summary: activityText(event.summary), endedAt: at, durationMs: event.durationMs ?? (opened ? Math.max(0, at - opened.at) : undefined), visuals: event.visuals?.length ? retainActivityVisuals(`${trace.id}:${actor}:${event.id}:${trace.serial}`, event.visuals) : opened?.visuals, output: activityPayload(event.result ?? { ok: event.ok, summary: event.summary, detail: "이 실행 경로에서는 결과 요약만 제공됨" }) }, index);
  }
  if (event.type === "delta" || event.type === "heartbeat") {
    // No private thinking text and no per-token rows. Retain one connection/stream receipt per actor.
    const name = event.type === "heartbeat" ? "connection.heartbeat" : "model.stream";
    const index = lastIndex(trace.entries, e => e.actor === actor && e.name === name);
    return put(trace, { ...base, id: trace.entries[index]?.id ?? base.id, name, summary: event.type === "heartbeat" ? "연결 확인" : "모델 응답 생성 중", output: { lastAt: at, count: Number((trace.entries[index]?.output as { count?: number })?.count ?? 0) + 1 } }, index);
  }
  if (event.type === "execution_status" && event.name === "checkpoint.apply" && event.ok !== false) {
    // 적용이 끝났다 — ACK 를 보내고 워커의 tool_end 가 돌아오기까지 「반영 중」으로 남기지 않는다.
    const index = lastIndex(trace.entries, e => e.actor === actor && e.kind === "tool" && e.status === "running" && e.summary === ACTIVITY_APPLYING_SUMMARY);
    if (index >= 0) trace = put(trace, { ...trace.entries[index]!, status: "ok", summary: ACTIVITY_APPLIED_SUMMARY }, index);
  }
  switch (event.type) {
    case "execution_status": return put(trace, { ...base, name: event.name, kind: "status", summary: activityText(event.summary), status: event.ok === false ? "error" : "info", output: activityPayload(event.data) });
    case "start": return put(trace, { ...base, summary: "모델 실행 시작", output: activityPayload(event) });
    case "turn": return put(trace, { ...base, summary: `모델 응답 대기 · ${event.index}번째 단계`, output: { index: event.index } });
    case "agent_spawn": return put(trace, { ...base, actor: event.agentId, summary: "작업 배정", output: activityPayload(event) });
    case "agent_done": return put(trace, { ...base, actor: event.agentId, status: event.ok ? "ok" : "error", summary: activityText(event.summary), output: activityPayload(event) });
    case "review": return put(trace, { ...base, actor: event.agentId, status: event.ok ? "ok" : "error", summary: event.ok ? "검수 통과" : `검수 지적 ${event.findings.length}건`, output: activityPayload(event) });
    case "assistant": case "team_report": return put(trace, { ...base, summary: event.type === "assistant" ? "중간 응답" : "팀 보고", output: activityPayload({ text: event.text }) });
    case "error": return put(trace, { ...base, status: "error", summary: activityText(event.message), output: activityPayload(event) });
    case "done": return put(trace, { ...base, summary: "모델 실행 종료 · 적용 여부는 별도 확인", output: activityPayload({ stats: event.stats, changedKeys: event.changedKeys }) });
    case "checkpoint": {
      // 체크포인트는 도구가 워커에서 일을 끝낸 순간에 온다. tool_end 는 브라우저가 적용하고 응답(ACK)한 뒤에야 오므로
      // 그 사이(적용 1.8~2.7초 + 왕복) 행이 「실행 중」으로 멈춰 보였다 — 여는 행을 「맵에 반영 중」으로 바꿔 둔다.
      const index = lastIndex(trace.entries, e => e.actor === actor && e.kind === "tool" && e.status === "running" && e.name === event.toolName);
      if (index >= 0) trace = put(trace, { ...trace.entries[index]!, summary: ACTIVITY_APPLYING_SUMMARY }, index);
      return put(trace, { ...base, id: `${trace.id}:${trace.serial}`, summary: activityText(event.label), output: activityPayload({ checkpointId: event.checkpointId, toolName: event.toolName }) });
    }
    case "render_request": return put(trace, { ...base, summary: `맵 그림 · ${event.toolName}`, output: activityPayload({ renderId: event.renderId, toolName: event.toolName }) });
    case "map_delta": return put(trace, { ...base, summary: `맵 ${event.maps.length}개 변경 신호`, output: activityPayload(event.maps) });
    case "team_start": return put(trace, { ...base, summary: "팀 작업 시작", output: activityPayload(event) });
    case "prompt_inspection": return put(trace, { ...base, summary: "프롬프트 점검", output: activityPayload(event.snapshot) });
  }
}
