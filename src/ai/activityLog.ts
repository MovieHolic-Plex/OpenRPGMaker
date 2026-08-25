// AI 활동 로그 — 채팅/영역 작업/타일셋 분석 등 AI가 할 때마다 로컬 링버퍼 + (가능하면) Supabase에 남긴다.
// 대화 기록(conversationStore)과 분리: 턴 단위 진단 페이로드(툴 args·결과·uiEvents)를 유지한다.
import type { AuditEntry } from "@/ai/assistantSession";
import { recordSupabaseAiActivityLog } from "@/project/supabaseProjectSync";
import { randomUuid } from "@/util/id";
import { AI_ACTIVITY_DISK_ENDPOINT } from "./activityLogEndpoint";
import type { AiActivityDiagnostics, AiActivityDiagnosticKind, AiActivityLogInput, AiActivityLogRecord, AiActivityToolCall, RegionActivityLogLike } from "./activityLogTypes";
export type { AiActivityChannel, AiActivityDiagnostics, AiActivityDiagnosticKind, AiActivityLogInput, AiActivityLogRecord, AiActivityResult, AiActivityToolCall, RegionActivityLogLike } from "./activityLogTypes";

const STORAGE_KEY = "oprn:ai-activity-logs";
const MAX_LOGS = 100;
const MAX_TEXT = 4000;
const MAX_ARGS_JSON = 12_000;
const MAX_KEEPALIVE_BYTES = 60 * 1024;

function getStorage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clipText(text: string, max = MAX_TEXT): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function clipArgs(args: Record<string, unknown>): Record<string, unknown> {
  try {
    const raw = JSON.stringify(args);
    if (raw.length <= MAX_ARGS_JSON) return args;
    return { _truncated: true, preview: clipText(raw, MAX_ARGS_JSON) };
  } catch {
    return { _unserializable: true };
  }
}

function sanitizeAudit(entries: readonly AuditEntry[]): AuditEntry[] {
  return entries.slice(-200).map((entry) => {
    if (entry.kind === "user" || entry.kind === "assistant" || entry.kind === "status") {
      return { ...entry, text: clipText(entry.text) };
    }
    return {
      ...entry,
      summary: clipText(entry.summary),
      args: clipArgs(entry.args),
      issues: entry.issues?.slice(0, 20).map((issue) => clipText(issue, 500)),
    };
  });
}

function sanitizeToolCalls(calls: readonly AiActivityToolCall[]): AiActivityToolCall[] {
  return calls.slice(0, 80).map((call) => ({
    name: call.name,
    args: clipArgs(call.args ?? {}),
    ...(call.ok === undefined ? {} : { ok: call.ok }),
    ...(call.summary === undefined ? {} : { summary: clipText(call.summary) }),
    ...(call.softConfirm === undefined ? {} : { softConfirm: call.softConfirm }),
    ...(call.construction === undefined ? {} : { construction: call.construction }),
  }));
}

export function deriveAiActivityDiagnostics(
  input: Pick<AiActivityLogInput, "result" | "toolCalls" | "audit">,
): AiActivityDiagnostics {
  const kinds = new Set<AiActivityDiagnosticKind>();
  const messages: string[] = [];
  const failedTools = new Set<string>();

  if (!input.result.ok) {
    kinds.add("turn-error");
    messages.push(
      clipText(
        input.result.error ?? `턴 실패: ${input.result.stoppedReason ?? "unknown"}`,
        500,
      ),
    );
  }
  for (const call of input.toolCalls ?? []) {
    if (call.ok !== false) continue;
    kinds.add("tool-failure");
    failedTools.add(call.name);
    if (call.name === "complete_work_item" || call.name === "skip_work_item")
      kinds.add("work-plan");
    messages.push(
      clipText(`${call.name}: ${call.summary ?? "도구 호출 실패"}`, 500),
    );
  }
  for (const entry of input.audit ?? []) {
    if (entry.kind === "tool" && entry.ok === false) {
      kinds.add("tool-failure");
      failedTools.add(entry.name);
      if (entry.name === "complete_work_item" || entry.name === "skip_work_item")
        kinds.add("work-plan");
      if (!messages.some((message) => message.startsWith(`${entry.name}:`))) {
        messages.push(clipText(`${entry.name}: ${entry.summary}`, 500));
      }
      continue;
    }
    if (entry.kind !== "status") continue;
    if (/planner:(?:parse-fail|error)|폴백 계획/u.test(entry.text)) {
      kinds.add("planner-fallback");
      messages.push(clipText(entry.text, 500));
    }
    if (/의도 확인\(/u.test(entry.text)) {
      kinds.add("intent-clarification");
      messages.push(clipText(entry.text, 500));
    }
    if (/^(?:WorkPlan|완료 게이트).*?(?:실패|거부)/iu.test(entry.text)) {
      kinds.add("work-plan");
      messages.push(clipText(entry.text, 500));
    }
  }

  const uniqueMessages = [...new Set(messages)].slice(0, 20);
  const severity =
    kinds.has("turn-error") || kinds.has("tool-failure")
      ? "error"
      : kinds.size > 0
        ? "warning"
        : "ok";
  return {
    severity,
    kinds: [...kinds],
    messages: uniqueMessages,
    failedTools: [...failedTools],
  };
}

function isActivityRecord(value: unknown): value is AiActivityLogRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.at === "string" &&
    typeof value.channel === "string" &&
    typeof value.instruction === "string" &&
    isObject(value.result) &&
    typeof value.result.ok === "boolean" &&
    Array.isArray(value.toolCalls) &&
    Array.isArray(value.audit)
  );
}

function readLocal(): AiActivityLogRecord[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter(isActivityRecord)
          .map((record) =>
            record.diagnostics
              ? record
              : { ...record, diagnostics: deriveAiActivityDiagnostics(record) },
          )
      : [];
  } catch {
    return [];
  }
}

function writeLocal(records: readonly AiActivityLogRecord[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_LOGS)));
  } catch {
    // QuotaExceeded 등 — 절반 버리고 재시도.
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, Math.floor(MAX_LOGS / 2))));
    } catch {
      /* ignore */
    }
  }
}

export function listAiActivityLogs(limit = MAX_LOGS): readonly AiActivityLogRecord[] {
  const n = Math.max(1, Math.min(MAX_LOGS, Math.floor(limit)));
  return readLocal().slice(0, n);
}

export function getLatestAiActivityLog(): AiActivityLogRecord | null {
  return readLocal()[0] ?? null;
}

export function getAiActivityLog(id: string): AiActivityLogRecord | null {
  return readLocal().find((row) => row.id === id) ?? null;
}

export function clearAiActivityLogs(): void {
  getStorage()?.removeItem(STORAGE_KEY);
  publishActivityLogApi();
}

export function serializeAiActivityLog(record: AiActivityLogRecord): string {
  return JSON.stringify(record, null, 2);
}

export function serializeAiActivityLogs(limit = 20): string {
  return JSON.stringify(listAiActivityLogs(limit), null, 2);
}

/** 입력 → 로컬 저장 레코드 (원격 전송 전 정규화). */
export function buildAiActivityLogRecord(input: AiActivityLogInput): AiActivityLogRecord {
  const toolCalls = sanitizeToolCalls(input.toolCalls ?? []);
  const audit = sanitizeAudit(input.audit ?? []);
  return {
    id: input.id ?? randomUuid(),
    at: input.at ?? new Date().toISOString(),
    channel: input.channel,
    ...(input.projectContextKey ? { projectContextKey: input.projectContextKey } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.liteModel ? { liteModel: input.liteModel } : {}),
    instruction: clipText(input.instruction, 2000),
    ...(input.mapId ? { mapId: input.mapId } : {}),
    ...(input.mapName ? { mapName: input.mapName } : {}),
    ...(input.region ? { region: input.region } : {}),
    result: {
      ok: input.result.ok,
      ...(input.result.applied === undefined ? {} : { applied: input.result.applied }),
      ...(input.result.error ? { error: clipText(input.result.error, 1500) } : {}),
      ...(input.result.stoppedReason ? { stoppedReason: input.result.stoppedReason } : {}),
      ...(input.result.changedCells === undefined ? {} : { changedCells: input.result.changedCells }),
      ...(input.result.changedEvents === undefined ? {} : { changedEvents: input.result.changedEvents }),
      ...(input.result.clippedCells === undefined ? {} : { clippedCells: input.result.clippedCells }),
      ...(input.result.proposedCalls === undefined ? {} : { proposedCalls: input.result.proposedCalls }),
      ...(input.result.assistantText
        ? { assistantText: clipText(input.result.assistantText, 2000) }
        : {}),
    },
    toolCalls,
    audit,
    diagnostics: deriveAiActivityDiagnostics({ result: input.result, toolCalls, audit }),
    ...(input.uiEvents ? { uiEvents: input.uiEvents.slice(-120) } : {}),
  };
}

/**
 * AI 활동 1건 기록.
 * - 항상 로컬 localStorage 링버퍼에 저장
 * - Supabase 설정이 있으면 원격에도 best-effort (전용 테이블 없으면 ai_analysis_runs 폴백)
 * - DEV: Vite 미러 엔드포인트로 디스크 기록 (output/ai-activity/)
 */
export async function recordAiActivity(input: AiActivityLogInput): Promise<AiActivityLogRecord> {
  const base = buildAiActivityLogRecord(input);
  const existing = readLocal().filter((row) => row.id !== base.id);
  writeLocal([base, ...existing]);
  publishActivityLogApi(base);
  await mirrorActivityToDisk(base);

  let persisted: AiActivityLogRecord["persisted"] = "local";
  try {
    const remote = await recordSupabaseAiActivityLog({
      logId: base.id,
      channel: base.channel,
      instruction: base.instruction,
      mapId: base.mapId,
      payload: base,
    });
    if (remote.kind === "saved") persisted = "both";
    else if (remote.kind === "not-configured") persisted = "local";
  } catch {
    persisted = "failed-remote";
  }

  const finalRecord: AiActivityLogRecord = { ...base, persisted };
  writeLocal([finalRecord, ...readLocal().filter((row) => row.id !== finalRecord.id)]);
  publishActivityLogApi(finalRecord);
  await mirrorActivityToDisk(finalRecord);
  return finalRecord;
}

/**
 * 에이전트/디스크 조회용 — Vite dev 미들웨어에 best-effort POST.
 *
 * 404/500 은 fetch 가 throw 하지 않는다. 예전 코드는 catch 만 두고 응답 상태를 안 봤기 때문에
 * 경로가 어긋난 뒤에도 "성공한 것처럼" 조용히 지나갔다. DEV 에서는 한 번 경고해서 다시 숨지 못하게 한다.
 */
let mirrorWarned = false;

export function buildAiActivityMirrorRequest(record: AiActivityLogRecord): {
  readonly body: string;
  readonly keepalive: boolean;
} {
  const body = JSON.stringify(record);
  // Fetch keepalive payloads are capped at 64 KiB. Hostile turns with many tool calls exceed it,
  // and Chromium leaves those requests pending until page teardown. Use a normal request for large logs.
  const bytes = new TextEncoder().encode(body).byteLength;
  return { body, keepalive: bytes <= MAX_KEEPALIVE_BYTES };
}

async function mirrorActivityToDisk(record: AiActivityLogRecord): Promise<void> {
  if (!import.meta.env.DEV || typeof fetch === "undefined") return;
  try {
    const request = buildAiActivityMirrorRequest(record);
    const res = await fetch(AI_ACTIVITY_DISK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request.body,
      keepalive: request.keepalive,
    });
    if (!res.ok) warnMirrorFailure(`${res.status} ${res.statusText}`);
  } catch (error) {
    // 프로덕션/미들웨어 없음은 정상 경로다 — DEV 에서만 알린다.
    warnMirrorFailure(error instanceof Error ? error.message : String(error));
  }
}

function warnMirrorFailure(reason: string): void {
  if (mirrorWarned) return;
  mirrorWarned = true;
  if (!import.meta.env.DEV) return;
  console.warn(
    `[ai-activity] 디스크 미러 실패 (${AI_ACTIVITY_DISK_ENDPOINT}: ${reason}) — output/ai-activity/ 가 갱신되지 않는다.`,
  );
}

export async function recordAiActivityFromRegionLog(
  log: RegionActivityLogLike,
  extras?: { readonly projectContextKey?: string; readonly model?: string; readonly liteModel?: string },
): Promise<AiActivityLogRecord> {
  return recordAiActivity({
    channel: "region",
    instruction: log.instruction,
    projectContextKey: extras?.projectContextKey,
    model: extras?.model,
    liteModel: extras?.liteModel,
    mapId: log.mapId,
    mapName: log.mapName,
    region: log.region,
    result: {
      ok: log.result.ok,
      applied: log.result.applied,
      error: log.result.error,
      stoppedReason: log.result.stoppedReason,
      changedCells: log.result.changedCells,
      changedEvents: log.result.changedEvents,
      clippedCells: log.result.clippedCells,
      proposedCalls: log.result.proposedCalls,
      assistantText: log.result.assistantText,
    },
    toolCalls: log.toolCalls.map((call) => ({
      name: call.name,
      args: call.args,
      ok: call.ok,
      summary: call.summary,
      ...(call.softConfirm === undefined ? {} : { softConfirm: call.softConfirm }),
      ...(call.construction === undefined ? {} : { construction: call.construction }),
    })),
    audit: log.audit,
    uiEvents: log.uiEvents,
    at: log.exportedAt,
  });
}

function publishActivityLogApi(latest?: AiActivityLogRecord): void {
  if (typeof window === "undefined") return;
  window.__oprnAiActivityLog = latest ?? getLatestAiActivityLog();
  window.__oprnListAiActivityLogs = (limit?: number) => listAiActivityLogs(limit);
  window.__oprnGetAiActivityLog = (id: string) => getAiActivityLog(id);
  window.__oprnClearAiActivityLogs = () => clearAiActivityLogs();
  window.__oprnExportAiActivityLogs = (limit?: number) => serializeAiActivityLogs(limit);
}

// 모듈 로드 시 window API 바인딩 (DEV 콘솔 즉시 사용).
publishActivityLogApi();
