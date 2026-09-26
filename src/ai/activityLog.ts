// AI 활동 로그 — 채팅/영역 작업/타일셋 분석 등 AI가 할 때마다 로컬 링버퍼 + (가능하면) project storage에 남긴다.
// 대화 기록(conversationStore)과 분리: 턴 단위 진단 페이로드(툴 args·결과·uiEvents)를 유지한다.
import type { AuditEntry } from "@/ai/assistantSession";
import {
  enqueueRemoteWrite,
  flushRemoteOutbox,
  registerRemoteOutboxSender,
  remoteOutboxStats,
  scheduleRemoteOutboxBootFlush,
} from "@/project/remoteOutbox";
import { projectRepository } from "@/project/persistence/repository";
import { randomUuid } from "@/util/id";
import { AI_ACTIVITY_DISK_ENDPOINT } from "./activityLogEndpoint";
import { aiActivityRunId } from "./activityRunId";
import type { AiActivityDiagnostics, AiActivityDiagnosticKind, AiActivityIndex, AiActivityLogInput, AiActivityLogRecord, AiActivityToolCall, RegionActivityLogLike } from "./activityLogTypes";
import { isUsableToolReason, preferRicherActivityRecord } from "./toolReason";
import type { AiUiEvent } from "./uiEventTypes";
export type { AiActivityChannel, AiActivityDiagnostics, AiActivityDiagnosticKind, AiActivityIndex, AiActivityLogInput, AiActivityLogRecord, AiActivityResult, AiActivityToolCall, RegionActivityLogLike } from "./activityLogTypes";

const STORAGE_KEY = "oprn:ai-activity-logs";
const MAX_LOGS = 100;
const MAX_TEXT = 4000;
const MAX_ARGS_JSON = 12_000;
const MAX_KEEPALIVE_BYTES = 60 * 1024;
/**
 * 한 행이 담을 수 있는 audit/toolCalls 의 직렬화 예산(바이트).
 *
 * 예전에는 칸수 상한(audit 200칸 / toolCalls 80개)이었다. 그게 실제로 데이터를 버렸다 —
 * 실측 2026-08-30, "니 추천대로" 턴은 audit 정확히 200칸으로 잘려 **첫 칸이 이미 턴 중간의
 * `tools:escalated`** 였다(사람 발언과 플래너 결정이 사라졌다). 툴도 114회 중 67개만 남았다.
 * 칸수는 내용량과 무관하므로, 짧은 상태줄 수백 개는 통과시키고 긴 턴의 머리는 버린다.
 * 예산으로 바꾸면 «담을 수 있는 만큼» 담고, 못 담은 양은 truncated 로 드러난다.
 */
const AUDIT_BUDGET_BYTES = 384 * 1024;
const TOOL_CALL_BUDGET_BYTES = 128 * 1024;
/** 프론트 액션은 한 건이 작다(수백 바이트) — 개수로 잘라도 머리를 버리지 않는다. */
const MAX_UI_ACTIONS = 400;
/** 예산 절단 시 앞쪽(사람 발언·플래너 결정)에 남겨 두는 몫. */
const HEAD_RESERVE_RATIO = 0.25;
/** 진단 한 줄에 붙일 issue 개수. 앞 몇 건이 거의 항상 원인이고, 다 붙이면 요약이 로그가 된다. */
const DIAGNOSTIC_ISSUE_LIMIT = 3;

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

function jsonBytes(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 예산 안에 들어가는 만큼을 **뒤에서부터** 담고, 담긴 것과 버린 개수를 함께 돌려준다.
 * 뒤가 최신이고 결과에 가까우므로 잘릴 때는 앞을 버린다 — 다만 버렸다는 사실은 남긴다.
 */
/**
 * 예산 안에서 «양 끝» 을 남긴다 — 뒤(결과 쪽)부터 채우고, 잘렸으면 남은 몫으로 앞(사람 발언·
 * 플래너 결정)을 되살린다. 버리는 건 가운데이고, 몇 칸인지는 `truncated` 가 말한다.
 *
 * 왜 뒤만 남기지 않는가: 이 작업의 출발점이 «머리가 잘린 행» 이었다(실측 13:23:48 턴은 audit 첫
 * 칸이 이미 턴 중간의 `tools:escalated` — 사람 발언과 플래너 결정이 사라졌다). 상한을 칸수에서
 * 바이트로 바꾸기만 하고 뒤만 남기면 같은 실패가 극단 턴에 그대로 남는다.
 */
function fitWithinBudget<T>(rows: readonly T[], budget: number): { kept: T[]; dropped: number } {
  const sizes = rows.map((row) => jsonBytes(row) + 1);
  if (sizes.reduce((sum, size) => sum + size, 0) <= budget) return { kept: [...rows], dropped: 0 };

  const tailBudget = budget - Math.floor(budget * HEAD_RESERVE_RATIO);
  let used = 0;
  let tailStart = rows.length;
  while (tailStart > 0) {
    const size = sizes[tailStart - 1] as number;
    // 마지막 칸은 홀로 예산을 넘겨도 남긴다 — 결과 없는 행은 읽을 값이 없다.
    if (used + size > tailBudget && tailStart < rows.length) break;
    used += size;
    tailStart -= 1;
  }

  let headEnd = 0;
  while (headEnd < tailStart) {
    const size = sizes[headEnd] as number;
    if (used + size > budget) break;
    used += size;
    headEnd += 1;
  }

  const kept = [...rows.slice(0, headEnd), ...rows.slice(tailStart)];
  return { kept, dropped: rows.length - kept.length };
}

function sanitizeAuditEntry(entry: AuditEntry): AuditEntry {
  if (entry.kind === "user" || entry.kind === "assistant" || entry.kind === "status") {
    return { ...entry, text: clipText(entry.text) };
  }
  return {
    ...entry,
    summary: clipText(entry.summary),
    args: clipArgs(entry.args),
    issues: entry.issues?.slice(0, 20).map((issue) => clipText(issue, 500)),
    ...(isUsableToolReason(entry.reason) ? { reason: clipText(entry.reason, 500) } : {}),
  };
}

function sanitizeAudit(entries: readonly AuditEntry[]): { kept: AuditEntry[]; dropped: number } {
  return fitWithinBudget(entries.map(sanitizeAuditEntry), AUDIT_BUDGET_BYTES);
}

function sanitizeToolCalls(calls: readonly AiActivityToolCall[]): { kept: AiActivityToolCall[]; dropped: number } {
  const normalized = calls.map((call) => ({
    name: call.name,
    args: clipArgs(call.args ?? {}),
    ...(call.ok === undefined ? {} : { ok: call.ok }),
    ...(call.summary === undefined ? {} : { summary: clipText(call.summary) }),
    ...(isUsableToolReason(call.reason) ? { reason: clipText(call.reason, 500) } : {}),
    ...(call.softConfirm === undefined ? {} : { softConfirm: call.softConfirm }),
    ...(call.construction === undefined ? {} : { construction: call.construction }),
  }));
  return fitWithinBudget(normalized, TOOL_CALL_BUDGET_BYTES);
}

/**
 * audit 상태줄에 박힌 `commit=<uuid>` 를 구조적으로 꺼낸다(마일스톤 적용 기록).
 *
 * 정규식이 남아 있는 이유: 커밋 id 는 상태줄 텍스트에만 실린다. 원천을 구조화하는 것이 옳지만
 * 그건 assistantSession 의 상태줄 계약을 바꾸는 일이라 이 작업 범위 밖이다. 대신 «긁는 곳» 을
 * 한 군데로 모아서, 기록되는 순간 `result.commitIds` / `index.commitIds` 로 구조화한다 —
 * 예전에는 조회하는 사람이 매번 169KB payload 를 받아 직접 긁었다.
 */
export function extractCommitIdsFromAudit(entries: readonly AuditEntry[]): string[] {
  return extractCommitIds(entries);
}

function extractCommitIds(entries: readonly AuditEntry[]): string[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== "status") continue;
    for (const match of entry.text.matchAll(/commit=([0-9a-f]{8}-[0-9a-f-]{27,})/gu)) {
      const id = match[1];
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

/** payload 안을 뒤지지 않고 SQL 로 찾기 위한 평탄 색인. */
function buildActivityIndex(input: {
  readonly toolCalls: readonly AiActivityToolCall[];
  readonly audit: readonly AuditEntry[];
  readonly uiActions: readonly AiUiEvent[];
  readonly mapId?: string;
  readonly commitIds: readonly string[];
}): AiActivityIndex {
  const toolNames = new Set<string>();
  const failedToolNames = new Set<string>();
  for (const call of input.toolCalls) {
    toolNames.add(call.name);
    if (call.ok === false) failedToolNames.add(call.name);
  }
  const userTexts: string[] = [];
  const reasons: string[] = [];
  const mapIds = new Set<string>();
  if (input.mapId) mapIds.add(input.mapId);
  for (const call of input.toolCalls) {
    if (isUsableToolReason(call.reason)) reasons.push(clipText(call.reason, 200));
  }
  for (const event of input.uiActions) {
    if (isUsableToolReason(event.reason)) reasons.push(clipText(event.reason, 200));
  }
  for (const entry of input.audit) {
    if (entry.kind === "tool") {
      toolNames.add(entry.name);
      if (entry.ok === false) failedToolNames.add(entry.name);
      if (isUsableToolReason(entry.reason)) reasons.push(clipText(entry.reason, 200));
      const mapId = entry.args?.mapId;
      if (typeof mapId === "string" && mapId) mapIds.add(mapId);
      continue;
    }
    // 기계 footer 를 뗀 사람 문장만 색인한다 — 붙이면 모든 행이 같은 맵 이름으로 시작한다.
    if (entry.kind === "user") userTexts.push(clipText((entry.text.split("\n\n[컨텍스트]")[0] ?? entry.text).trim(), 200));
  }
  return {
    toolNames: [...toolNames],
    failedToolNames: [...failedToolNames],
    uiActions: [...new Set(input.uiActions.map((event) => event.action))],
    commitIds: [...input.commitIds],
    mapIds: [...mapIds],
    userTexts: userTexts.slice(-20),
    reasons: [...new Set(reasons)].slice(-40),
  };
}

export function deriveAiActivityDiagnostics(
  input: Pick<AiActivityLogInput, "result" | "toolCalls" | "audit">,
): AiActivityDiagnostics {
  const kinds = new Set<AiActivityDiagnosticKind>();
  const messages: string[] = [];
  const failedTools = new Set<string>();

  // 실패한 도구의 검증/lint issue 를 도구 이름으로 찾아 둔다.
  //
  // 왜 필요한가 (2026-08-29 실측) — `toolRunner` 의 커밋 거부 summary 는 어느 lint 가 터졌든
  // `'<tool>' 커밋 거부(무결성 오류)` 로 **고정**이다. 그 한 줄만 진단에 실리면 진단력이 0 이라,
  // `run_interior_room_pipeline` 실패 3건의 원인(`시작 위치가 통행 불가 타일입니다: (10, 12)`)을
  // 알아내려고 코드를 역추적해야 했다. 정작 그 메시지는 `audit[].issues` 에 이미 있었다.
  //
  // toolCalls 쪽은 issues 를 싣지 않으므로(sanitizeToolCalls) audit 에서 끌어온다. 그리고
  // 아래 audit 루프는 "같은 도구 이름으로 이미 메시지가 있으면" 건너뛰기 때문에, toolCalls 가
  // 먼저 밋밋한 한 줄을 넣으면 issue 가 붙은 줄은 영원히 안 들어갔다.
  const issuesByTool = new Map<string, readonly string[]>();
  for (const entry of input.audit ?? []) {
    if (entry.kind !== "tool" || entry.ok !== false) continue;
    if (!entry.issues || entry.issues.length === 0) continue;
    if (!issuesByTool.has(entry.name)) issuesByTool.set(entry.name, entry.issues);
  }
  const toolFailureMessage = (name: string, summary: string): string => {
    const base = clipText(`${name}: ${summary}`, 500);
    // 커밋 거부 요약이 첫 위반 사유를 싣게 된 뒤(toolRunner.commitRejectionSummary)로는 같은 문장을
    // 두 번 적지 않는다 — 요약에 이미 들어간 이슈는 뺀다.
    const issues = issuesByTool.get(name)?.filter((issue) => !summary.includes(issue.split("\n")[0] ?? issue));
    if (!issues || issues.length === 0) return base;
    // summary 와 별도로 클립한다 — 한 예산으로 합치면 긴 summary 가 issue 를 밀어낸다.
    const head = issues.slice(0, DIAGNOSTIC_ISSUE_LIMIT);
    const rest = issues.length - head.length;
    return `${base} — ${clipText(head.join(" / "), 400)}${rest > 0 ? ` (+${rest}건)` : ""}`;
  };

  // 진행 중(pending)인 턴은 실패가 아니다 — 아직 끝나지 않았을 뿐이다.
  // 예전에는 `pending:true` 행에도 `turn-error` + "턴 실패: unknown" + `severity:"error"` 가 붙어,
  // 살아 있는 워커가 실패로 집계됐다(사용자 QA 원장 LOG-004, docs/qa/saesol-three-hour-ai-authoring.md:135-142).
  // 사람이 읽는 요약(activityLogText 의 "진행 중")과 진단이 같은 판단을 하게 맞춘다.
  if (!input.result.ok && !input.result.pending) {
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
    messages.push(toolFailureMessage(call.name, call.summary ?? "도구 호출 실패"));
  }
  for (const entry of input.audit ?? []) {
    if (entry.kind === "tool" && entry.ok === false) {
      kinds.add("tool-failure");
      failedTools.add(entry.name);
      if (entry.name === "complete_work_item" || entry.name === "skip_work_item")
        kinds.add("work-plan");
      if (!messages.some((message) => message.startsWith(`${entry.name}:`))) {
        messages.push(toolFailureMessage(entry.name, entry.summary));
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
    // 이 브랜치 이전에 저장된 행에는 diagnostics/index 가 없다. 읽는 쪽이 매번 방어하지 않도록
    // 여기서 채워 준다 — 없는 채로 흘리면 하네스 타임라인이 undefined 를 타고 죽는다.
    return Array.isArray(parsed)
      ? parsed
          .filter(isActivityRecord)
          .map((record) => ({
            ...record,
            diagnostics: record.diagnostics ?? deriveAiActivityDiagnostics(record),
            index:
              record.index ??
              buildActivityIndex({
                toolCalls: record.toolCalls,
                audit: record.audit,
                uiActions: record.uiActions ?? [],
                commitIds: record.result.commitIds ?? extractCommitIds(record.audit),
                ...(record.mapId ? { mapId: record.mapId } : {}),
              }),
          }))
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
  const tools = sanitizeToolCalls(input.toolCalls ?? []);
  const audits = sanitizeAudit(input.audit ?? []);
  const toolCalls = tools.kept;
  const audit = audits.kept;
  const allUiActions = input.uiActions ?? [];
  const uiActions = allUiActions.slice(-MAX_UI_ACTIONS);
  const truncated = {
    ...(audits.dropped > 0 ? { audit: audits.dropped } : {}),
    ...(tools.dropped > 0 ? { toolCalls: tools.dropped } : {}),
    ...(allUiActions.length > uiActions.length ? { uiActions: allUiActions.length - uiActions.length } : {}),
  };
  // 색인·커밋 id 는 «절단 전» 전체에서 만든다. 이름 목록은 중복 제거된 짧은 배열이라 비용이 거의
  // 없는데, 절단된 행에서 만들면 가운데로 버려진 툴·액션은 조회로 아예 못 찾는다 —
  // payload 를 못 찾는 게 이 작업이 고치려는 구멍이다.
  const allAudit = input.audit ?? [];
  const allToolCalls = input.toolCalls ?? [];
  const commitIds = input.result.commitIds ?? extractCommitIds(allAudit);
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
      ...(input.result.runOutcome ? { runOutcome: input.result.runOutcome } : {}),
      ...(input.result.recap ? { recap: input.result.recap } : {}),
      ok: input.result.ok,
      ...(input.result.applied === undefined ? {} : { applied: input.result.applied }),
      ...(input.result.error ? { error: clipText(input.result.error, 1500) } : {}),
      ...(input.result.stoppedReason ? { stoppedReason: input.result.stoppedReason } : {}),
      ...(input.result.changedCells === undefined ? {} : { changedCells: input.result.changedCells }),
      ...(input.result.changedEvents === undefined ? {} : { changedEvents: input.result.changedEvents }),
      ...(input.result.clippedCells === undefined ? {} : { clippedCells: input.result.clippedCells }),
      ...(input.result.proposedCalls === undefined ? {} : { proposedCalls: input.result.proposedCalls }),
      ...(input.result.appliedCalls === undefined ? {} : { appliedCalls: input.result.appliedCalls }),
      ...(input.result.assistantText
        ? { assistantText: clipText(input.result.assistantText, 2000) }
        : {}),
      ...(input.result.pending ? { pending: true } : {}),
      ...(input.result.applyMode ? { applyMode: input.result.applyMode } : {}),
      ...(input.result.orphaned ? { orphaned: true } : {}),
      ...(commitIds.length > 0 ? { commitIds } : {}),
    },
    toolCalls,
    audit,
    // 진단도 절단 전으로 뽑는다 — 가운데로 버려진 실패는 «없던 일» 이 아니다.
    diagnostics: deriveAiActivityDiagnostics({ result: input.result, toolCalls: allToolCalls, audit: allAudit }),
    index: buildActivityIndex({
      toolCalls: allToolCalls,
      audit: allAudit,
      uiActions: allUiActions,
      commitIds,
      ...(input.mapId ? { mapId: input.mapId } : {}),
    }),
    ...(input.uiEvents ? { uiEvents: input.uiEvents.slice(-120) } : {}),
    ...(uiActions.length > 0 ? { uiActions } : {}),
    ...(input.timing ? { timing: input.timing } : {}),
    ...(Object.keys(truncated).length > 0 ? { truncated } : {}),
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
  const result = await projectRepository().ai.recordActivity(payload as ReturnType<typeof aiActivityRemoteInput>);
  // 미설정은 "보냈다"로 볼 수 없다 — 큐에 남겨서 설정이 붙은 뒤에 밀어 넣는다.
  if (result.kind === "not-configured") throw new Error("원격 저장소에 연결되어 있지 않습니다");
});

/**
 * AI 활동 1건 기록.
 * - 항상 로컬 localStorage 링버퍼에 저장 (표시용 캐시)
 * - project storage 설정이 있으면 원격에 저장하고, 실패하면 outbox 에 남겨 나중에 재전송
 * - Vite 미러 엔드포인트로 디스크 기록 (output/ai-activity/) — 미들웨어가 있을 때만
 * - 같은 id 의 시작/중간/종료 기록은 직렬화한다. 빈 pending 시작 행이 풍부한 행을
 *   덮어쓰지 않는다(2026-09-02: 검토 턴이 tile_erase 를 남기고도 로그는 빈 pending 만).
 */
let persistTail: Promise<void> = Promise.resolve();

export async function recordAiActivity(input: AiActivityLogInput): Promise<AiActivityLogRecord> {
  const run = persistTail.then(() => persistAiActivityNow(input));
  persistTail = run.then(() => undefined, () => undefined);
  return run;
}

export { preferRicherActivityRecord };

async function persistAiActivityNow(input: AiActivityLogInput): Promise<AiActivityLogRecord> {
  const incoming = buildAiActivityLogRecord(input);
  const existingRow = readLocal().find((row) => row.id === incoming.id);
  const base = preferRicherActivityRecord(existingRow, incoming);
  const existing = readLocal().filter((row) => row.id !== base.id);
  writeLocal([base, ...existing]);
  publishActivityLogApi(base);
  await mirrorActivityToDisk(base);

  let persisted: AiActivityLogRecord["persisted"] = "local";
  const remoteInput = aiActivityRemoteInput(base);
  try {
    const remote = await projectRepository().ai.recordActivity(remoteInput);
    if (remote.kind === "saved") persisted = "both";
    else if (remote.kind === "not-configured") persisted = "local";
  } catch (error) {
    // 링버퍼는 성공/실패와 무관하게 100건에서 밀어내므로, 실패분은 별도 큐에 보존해야 한다.
    persisted = "failed-remote";
    enqueueRemoteWrite({ id: base.id, kind: "ai-activity", payload: remoteInput, error });
  }

  // 원격이 살아 있는 걸 방금 확인한 시점이 재전송에 가장 좋은 순간이다.
  if (persisted === "both") void flushRemoteOutbox().catch(() => undefined);
  if (persisted === "local") warnLocalOnlyOnce();

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

/**
 * 기록이 어디까지 갔는지. 하네스 모달이 「로컬 전용」 배지를 그리는 근거다.
 *
 * 왜 필요한가 (실측 2026-08-30): 워크트리 53개 중 19개에 `.env.local` 이 없어 project storage 가 미설정
 * 이었고, 표본을 열어 보니 `output/ai-activity/` 도 0개였다. 즉 그 세션들의 AI 기록은 브라우저
 * localStorage 100건 링버퍼에만 있었고, 링버퍼가 밀어내는 순간 영구히 사라졌다. 그런데 화면에는
 * 아무 표시도 없어서 «남는 줄 알고» 계속 썼다. 조용한 유실이 가장 나쁘다.
 */
export function aiActivityPersistenceState(): { readonly remote: boolean; readonly diskMirror: boolean } {
  return { remote: projectRepository().currentTarget() !== null, diskMirror: mirrorState !== "disabled" };
}

let localOnlyWarned = false;

function warnLocalOnlyOnce(): void {
  if (localOnlyWarned) return;
  const state = aiActivityPersistenceState();
  if (state.remote || state.diskMirror) return;
  localOnlyWarned = true;
  console.warn(
    "[ai-activity] 프로젝트 저장소도 디스크 미러도 없다 — AI 기록이 이 탭의 localStorage 링버퍼" +
      `(${MAX_LOGS}건)에만 남고, 넘치면 사라진다. 프로젝트 폴더·팀 호스트 연결이나 dev/preview 디스크 미러를 확인할 것.`,
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
      ...(isUsableToolReason(call.reason) ? { reason: call.reason } : {}),
      ...(call.softConfirm === undefined ? {} : { softConfirm: call.softConfirm }),
      ...(call.construction === undefined ? {} : { construction: call.construction }),
    })),
    audit: log.audit,
    uiEvents: log.uiEvents,
    at: log.exportedAt,
  });
}

/**
 * 턴 밖에서 일어난 프론트 액션 묶음 1행. 턴 «안» 의 액션은 그 턴 행의 `uiActions` 에도 실린다 —
 * 중복은 의도한 것이다. 턴 행은 사람이 읽는 서사이고, 이 행들은 빠짐없는 스트림이다.
 *
 * instruction 에 액션 이름을 이어 붙이는 이유: 그 컬럼이 DB 의 유일한 평문 검색 축이고
 * (`instruction=ilike.*turn-rewind*`), 목록 조회에서 payload 를 열지 않고도 무슨 일인지 읽힌다.
 */
export async function recordAiUiActionBatch(
  events: readonly AiUiEvent[],
  extras?: { readonly projectContextKey?: string; readonly mapId?: string },
): Promise<AiActivityLogRecord | null> {
  if (events.length === 0) return null;
  const names = [...new Set(events.map((event) => event.action))];
  return await recordAiActivity({
    channel: "ui",
    instruction: `[ui] ${names.join(", ")}`,
    ...(extras?.projectContextKey ? { projectContextKey: extras.projectContextKey } : {}),
    ...(extras?.mapId ? { mapId: extras.mapId } : {}),
    result: { ok: true },
    uiActions: events,
    at: events[0]?.at,
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
