// AI 활동 로그 — 채팅/영역 작업/타일셋 분석 등 AI가 할 때마다 로컬 링버퍼 + (가능하면) Supabase에 남긴다.
// 대화 기록(conversationStore)과 분리: 턴 단위 진단 페이로드(툴 args·결과·uiEvents)를 유지한다.
import type { AuditEntry } from "@/ai/assistantSession";
import {
  enqueueRemoteWrite,
  flushRemoteOutbox,
  registerRemoteOutboxSender,
  remoteOutboxStats,
  scheduleRemoteOutboxBootFlush,
} from "@/project/remoteOutbox";
import { recordSupabaseAiActivityLog } from "@/project/supabaseProjectSync";
import { randomUuid } from "@/util/id";
import { AI_ACTIVITY_DISK_ENDPOINT } from "./activityLogEndpoint";
import { aiActivityRunId } from "./activityRunId";
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
    runId: input.runId ?? aiActivityRunId(),
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

/** 원격 upsert 1건 — outbox 재시도와 첫 시도가 정확히 같은 요청을 쓰게 한다. */
function aiActivityRemoteInput(record: AiActivityLogRecord) {
  return {
    logId: record.id,
    ...(record.runId ? { runId: record.runId } : {}),
    channel: record.channel,
    instruction: record.instruction,
    ...(record.mapId ? { mapId: record.mapId } : {}),
    payload: record,
  };
}

registerRemoteOutboxSender("ai-activity", async (payload) => {
  const result = await recordSupabaseAiActivityLog(payload as ReturnType<typeof aiActivityRemoteInput>);
  // 미설정은 "보냈다"로 볼 수 없다 — 큐에 남겨서 설정이 붙은 뒤에 밀어 넣는다.
  if (result.kind === "not-configured") throw new Error("supabase not configured");
});

/**
 * AI 활동 1건 기록.
 * - 항상 로컬 localStorage 링버퍼에 저장 (표시용 캐시)
 * - Supabase 설정이 있으면 원격에 저장하고, 실패하면 outbox 에 남겨 나중에 재전송
 * - Vite 미러 엔드포인트로 디스크 기록 (output/ai-activity/) — 미들웨어가 있을 때만
 */
export async function recordAiActivity(input: AiActivityLogInput): Promise<AiActivityLogRecord> {
  const base = buildAiActivityLogRecord(input);
  const existing = readLocal().filter((row) => row.id !== base.id);
  writeLocal([base, ...existing]);
  publishActivityLogApi(base);
  await mirrorActivityToDisk(base);

  let persisted: AiActivityLogRecord["persisted"] = "local";
  const remoteInput = aiActivityRemoteInput(base);
  try {
    const remote = await recordSupabaseAiActivityLog(remoteInput);
    if (remote.kind === "saved") persisted = "both";
    else if (remote.kind === "not-configured") persisted = "local";
  } catch (error) {
    // 링버퍼는 성공/실패와 무관하게 100건에서 밀어내므로, 실패분은 별도 큐에 보존해야 한다.
    persisted = "failed-remote";
    enqueueRemoteWrite({ id: base.id, kind: "ai-activity", payload: remoteInput, error });
  }

  // 원격이 살아 있는 걸 방금 확인한 시점이 재전송에 가장 좋은 순간이다.
  if (persisted === "both") void flushRemoteOutbox().catch(() => undefined);

  const finalRecord: AiActivityLogRecord = { ...base, persisted };
  writeLocal([finalRecord, ...readLocal().filter((row) => row.id !== finalRecord.id)]);
  publishActivityLogApi(finalRecord);
  await mirrorActivityToDisk(finalRecord);
  return finalRecord;
}

/**
 * 에이전트/디스크 조회용 — Vite 미들웨어에 best-effort POST.
 *
 * 404/500 은 fetch 가 throw 하지 않는다. 예전 코드는 catch 만 두고 응답 상태를 안 봤기 때문에
 * 경로가 어긋난 뒤에도 "성공한 것처럼" 조용히 지나갔다. 한 번 경고해서 다시 숨지 못하게 한다.
 */
let mirrorWarned = false;

/**
 * 미러 활성 상태. 예전에는 `!import.meta.env.DEV` 가드였는데, 그 값은 프로덕션 빌드에서 정적
 * false 라 **Vite 가 POST 를 함수째로 tree-shake** 했다. `npm start`(= vite preview)는 dist 를
 * 서빙하므로 미들웨어(configurePreviewServer)는 살아 있는데 두드릴 손이 없어져서, 2026-08-28
 * 05:50 이후 디스크 미러가 무증상으로 죽어 있었다(사용자가 실제로 친 지시가 디스크에 0건).
 * 진단도 틀렸었다 — 404 로 떨어진 게 아니라 요청이 나간 적이 없다.
 *
 * 그래서 정적 가드를 버리고 **한 번 찔러보고 실패하면 끈다**. dev·preview 는 그대로 동작하고,
 * 미들웨어가 없는 진짜 배포에서는 페이지당 실패 1회 + 경고 1회로 끝난다.
 * `VITE_AI_ACTIVITY_DISK_MIRROR=0` 으로 빌드하면 정적 false 라 다시 완전히 제거된다(명시적 옵트아웃).
 */
type MirrorState = "unknown" | "enabled" | "disabled";

function initialMirrorState(): MirrorState {
  const flag = import.meta.env.VITE_AI_ACTIVITY_DISK_MIRROR;
  if (flag === "0" || flag === "false") return "disabled";
  if (flag === "1" || flag === "true") return "enabled";
  return "unknown";
}

let mirrorState: MirrorState = initialMirrorState();

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
  if (mirrorState === "disabled" || typeof fetch === "undefined") return;
  try {
    const request = buildAiActivityMirrorRequest(record);
    const res = await fetch(AI_ACTIVITY_DISK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request.body,
      keepalive: request.keepalive,
    });
    if (res.ok) {
      mirrorState = "enabled";
      return;
    }
    disableMirror(`${res.status} ${res.statusText}`);
  } catch (error) {
    disableMirror(error instanceof Error ? error.message : String(error));
  }
}

/**
 * 미들웨어가 없는 환경(진짜 배포)에서는 첫 실패로 끈다. 명시적으로 켜 둔 경우
 * (VITE_AI_ACTIVITY_DISK_MIRROR=1)는 끄지 않는다 — 켜라고 했는데 안 되는 건 알려야 할 고장이다.
 */
function disableMirror(reason: string): void {
  if (mirrorState !== "enabled") mirrorState = "disabled";
  warnMirrorFailure(reason);
}

function warnMirrorFailure(reason: string): void {
  if (mirrorWarned) return;
  mirrorWarned = true;
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
  // 런 식별자와 outbox 상태는 하네스/QA 가 밖에서 읽어야 한다 — 디스크 미러 없이
  // "내 런의 최신 턴"을 DB 에 물으려면 런 값이 브라우저 밖으로 나와야 하기 때문이다.
  window.__oprnAiActivityRunId = () => aiActivityRunId();
  window.__oprnRemoteOutbox = () => remoteOutboxStats();
  window.__oprnFlushRemoteOutbox = () => flushRemoteOutbox({ force: true });
}

// 모듈 로드 시 window API 바인딩 (DEV 콘솔 즉시 사용).
publishActivityLogApi();
// 지난 세션에서 못 보낸 게 있으면 부팅 뒤에 한 번 밀어 넣는다(부팅 경로는 붙잡지 않는다).
scheduleRemoteOutboxBootFlush();
