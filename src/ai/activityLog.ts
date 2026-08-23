// AI 활동 로그 — 채팅/영역 작업/타일셋 분석 등 AI가 할 때마다 로컬 링버퍼 + (가능하면) Supabase에 남긴다.
// 대화 기록(conversationStore)과 분리: 턴 단위 진단 페이로드(툴 args·결과·uiEvents)를 유지한다.
import type { AuditEntry } from "@/ai/assistantSession";
import { recordSupabaseAiActivityLog } from "@/project/supabaseProjectSync";
import { randomUuid } from "@/util/id";
import type { AiActivityLogInput, AiActivityLogRecord, AiActivityToolCall, RegionActivityLogLike } from "./activityLogTypes";
export type { AiActivityChannel, AiActivityLogInput, AiActivityLogRecord, AiActivityResult, AiActivityToolCall, RegionActivityLogLike } from "./activityLogTypes";

const STORAGE_KEY = "oprn:ai-activity-logs";
const MAX_LOGS = 100;
const MAX_TEXT = 4000;
const MAX_ARGS_JSON = 12_000;

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
    return Array.isArray(parsed) ? parsed.filter(isActivityRecord) : [];
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
    toolCalls: sanitizeToolCalls(input.toolCalls ?? []),
    audit: sanitizeAudit(input.audit ?? []),
    ...(input.uiEvents ? { uiEvents: input.uiEvents.slice(-120) } : {}),
  };
}

/**
 * AI 활동 1건 기록.
 * - 항상 로컬 localStorage 링버퍼에 저장
 * - Supabase 설정이 있으면 원격에도 best-effort (전용 테이블 없으면 ai_analysis_runs 폴백)
 * - DEV: Vite `/__oprn/ai-activity` 로 디스크 미러 (output/ai-activity/)
 */
export async function recordAiActivity(input: AiActivityLogInput): Promise<AiActivityLogRecord> {
  const base = buildAiActivityLogRecord(input);
  const existing = readLocal().filter((row) => row.id !== base.id);
  writeLocal([base, ...existing]);
  publishActivityLogApi(base);
  void mirrorActivityToDisk(base);

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
  void mirrorActivityToDisk(finalRecord);
  return finalRecord;
}

/** 에이전트/디스크 조회용 — Vite dev 미들웨어에 best-effort POST. */
async function mirrorActivityToDisk(record: AiActivityLogRecord): Promise<void> {
  if (typeof fetch === "undefined") return;
  try {
    await fetch("/__oprn/ai-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      // keepalive: 페이지 이탈 시에도 한 번 더 시도.
      keepalive: true,
    });
  } catch {
    /* ignore — 프로덕션/미들웨어 없음 */
  }
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
