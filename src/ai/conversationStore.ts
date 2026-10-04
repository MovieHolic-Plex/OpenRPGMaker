import { deleteTerminalRunCheckpointsForConversation } from "./runCheckpointStore";
import type { AuditEntry } from "@/ai/assistantSession";
import {
  AI_RECORD_STORES,
  clearAiRecords,
  aiRecordBackendKind,
  mutateScopedAiRecord,
  isScopedAiRecordDeleted,
  readAiRecord,
  readAllAiRecords,
  registerAiRecordDbResetHook,
  registerConversationSummaryProjector,
  queryConversationSummaries,
  conversationSummaryMapIds,
} from "@/ai/aiRecordDb";
import { isConversationTurnContext } from "@/ai/conversationTurnContext";
import { conversationTranscriptCompacted, indexConversationMaps, isConversationMapIndex, type ConversationMapIndex } from "@/ai/mapConversationStore";
import { enqueueRemoteWrite, registerRemoteOutboxSender } from "@/project/remoteOutbox";
import type { ProjectIdentity } from "@/project/store";
import { projectRepository } from "@/project/persistence/repository";
import type { ConversationInput } from "@/project/persistence/types";
import type { Project } from "@/project/types";

export interface ConversationRecord { id: string; title: string; model: string; savedAt: number; entries: AuditEntry[]; projectContextKey?: string; mapIndex?: ConversationMapIndex; }
export interface ConversationSummary { id: string; title: string; model: string; savedAt: number; turnCount: number; projectContextKey?: string; /** 마지막 조수(없으면 사용자) 발화 80자 — 목록에서 고를 근거(데크 2026-09-03). */ readonly preview?: string; }
/**
 * 저장 결과 — `saveConversation` 은 **던지지 않는다.**
 * - `ok`: 이 세션에서 다시 읽을 수 있게 저장됐다(메모리 폴백 포함). false 면 IndexedDB 쓰기가 실패해 어디에도 없다.
 * - `durable`: IndexedDB 에 남았다 — 새로 고침 뒤에도 있다. IndexedDB 가 없거나 열기에 실패한 세션은 false.
 * - `evicted`: compatibility field, always 0; the archive has no count-based eviction.
 */
export interface ConversationSaveOutcome { readonly ok: boolean; readonly durable: boolean; readonly evicted: number; }

/**
 * 예전 정본이던 localStorage 키. 지금은 **읽어서 IndexedDB 로 옮기고 지우는** 이관 전용이다.
 * e2e 시드·QA 스크립트가 이 키로 대화를 심어도 첫 접근에 이관되어 그대로 복원된다.
 */
export const LEGACY_CONVERSATION_STORAGE_KEY = "oprn:ai-conversations";
const STORE = AI_RECORD_STORES.conversations;
/** Recent-list limit only; never a retention limit. */
export const CONVERSATION_MAX_RECORDS = 50;
const TITLE_LIMIT = 40;

// ── 저장 예산(글자 수) ─────────────────────────────────────────────────────────────
// 실측 결함(2026-09-03): 조수를 쓰다 「오류: Failed to execute 'setItem' on 'Storage': Setting the
// value of 'oprn:ai-conversations' exceeded the quota.」 가 말풍선으로 떴고 그 턴이 끊겼다. 원인은
// 세 겹이었다. (1) 툴콜 인자(맵 셀 배열·이벤트 본문)를 상한 없이 저장했고, (2) 같은 인자가 assistant
// 항목(`toolCalls[].args` 문자열)과 tool 항목(`args` 객체)에 **두 번** 들어가며, (3) 대화 50건을
// 매 툴콜마다 localStorage 한 키에 통째로 다시 썼다. (3) 은 IndexedDB 로 옮겨 없앴다(aiRecordDb).
// (1)(2) 의 압축은 남긴다 — 원격 미러(project storage)와 복원 렌더가 매 툴콜마다 수 MB 를 다룰 이유가 없고,
// 대화 기록의 소비자는 복원 화면(툴 상세 <pre>)과 export 뿐이며 진단 원문은 활동 로그(12,000)가 든다.
/** 툴콜 인자 한 건이 저장될 때의 상한(직렬화 글자 수). 넘으면 `{ _truncated, preview }` 로 바꾼다. */
export const CONVERSATION_ARGS_MAX_CHARS = 2_000;
/** 대화 한 건의 entries 직렬화 상한. 넘으면 머리(첫 발화·계획)와 꼬리(최근)를 남기고 가운데를 접는다. */
export const CONVERSATION_RECORD_MAX_CHARS = 200_000;
/** 가운데를 접었음을 남기는 status 항목의 구조 토큰(복원 화면·모델 주입은 status 를 무시한다). */
export const CONVERSATION_TRIM_MARKER = "[conversation-trimmed]";
/** 접을 때 머리에 남겨 두는 몫 — 활동 로그의 HEAD_RESERVE_RATIO 와 같은 이유(첫 발화가 사라지면 맥락이 없다). */
const TRIM_HEAD_RESERVE_RATIO = 0.25;

function getLegacyStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAuditEntry(value: unknown): value is AuditEntry {
  if (!isObject(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "user":
      return typeof value.text === "string" && (value.context === undefined || isConversationTurnContext(value.context));
    case "assistant":
      return typeof value.text === "string" && (value.toolCalls === undefined ||
        (Array.isArray(value.toolCalls) && value.toolCalls.every(call => isObject(call) && typeof call.name === "string" && typeof call.args === "string")));
    case "status": // 상태 전이/턴 수명주기 기록(결함 ⑬).
      return typeof value.text === "string";
    case "tool":
      return (
        typeof value.name === "string" &&
        isObject(value.args) &&
        typeof value.ok === "boolean" &&
        typeof value.summary === "string" &&
        (value.issues === undefined || isStringArray(value.issues)) &&
        (value.reason === undefined || typeof value.reason === "string")
      );
    default:
      return false;
  }
}

export function isConversationRecord(value: unknown): value is ConversationRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.model === "string" &&
    typeof value.savedAt === "number" && Number.isFinite(value.savedAt) &&
    (value.projectContextKey === undefined || typeof value.projectContextKey === "string") &&
    Array.isArray(value.entries) &&
    value.entries.every(isAuditEntry)
  );
}

// ── 압축 ──────────────────────────────────────────────────────────────────────────

function jsonLength(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

/** 직렬화 길이(따옴표 포함)가 `max` 안에 들도록 자르고 말줄임 한 글자를 붙인다 — JSON 미리보기는 따옴표가 많아 이스케이프로 불어난다. */
function clipForJson(text: string, max: number): string {
  let preview = text.slice(0, max);
  while (preview.length > 0 && JSON.stringify(preview).length > max) {
    preview = preview.slice(0, Math.max(0, Math.floor((preview.length * max) / JSON.stringify(preview).length) - 1));
  }
  return `${preview}…`;
}

function compactArgs(args: Record<string, unknown>): Record<string, unknown> {
  try {
    const raw = JSON.stringify(args);
    if (raw === undefined || raw.length <= CONVERSATION_ARGS_MAX_CHARS) return args;
    return { _truncated: true, preview: clipForJson(raw, CONVERSATION_ARGS_MAX_CHARS) };
  } catch {
    return { _unserializable: true };
  }
}

function compactEntry(entry: AuditEntry): AuditEntry {
  if (entry.kind === "tool") {
    const args = compactArgs(entry.args);
    return args === entry.args ? entry : { ...entry, args };
  }
  if (entry.kind === "assistant" && entry.toolCalls?.some((call) => call.args.length > CONVERSATION_ARGS_MAX_CHARS)) {
    return {
      ...entry,
      toolCalls: entry.toolCalls.map((call) =>
        call.args.length <= CONVERSATION_ARGS_MAX_CHARS ? call : { ...call, args: `${call.args.slice(0, CONVERSATION_ARGS_MAX_CHARS)}…` },
      ),
    };
  }
  return entry;
}

function trimMarkerEntry(dropped: number): AuditEntry {
  return { kind: "status", text: `${CONVERSATION_TRIM_MARKER} 저장 용량으로 가운데 ${dropped}개 항목을 생략했습니다`, at: new Date().toISOString() };
}

function parseTrimmedCount(text: string): number {
  const match = /(\d+)개/u.exec(text.slice(CONVERSATION_TRIM_MARKER.length));
  return match ? Number(match[1]) : 0;
}

/**
 * entries 를 레코드 예산 안으로 접는다. 뒤(최근)부터 채우고 남은 몫으로 앞(첫 발화)을 되살려 가운데를
 * 버린다. 이미 들어 있던 표식은 걷어 누적치만 이어받으므로 매 툴콜마다 다시 저장돼도 표식은 하나다.
 */
function fitEntriesToBudget(entries: readonly AuditEntry[]): AuditEntry[] {
  let previouslyDropped = 0;
  let markerIndex = -1;
  const rows: AuditEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === "status" && entry.text.startsWith(CONVERSATION_TRIM_MARKER)) {
      previouslyDropped += parseTrimmedCount(entry.text);
      if (markerIndex < 0) markerIndex = rows.length;
      continue;
    }
    rows.push(compactEntry(entry));
  }
  const budget = CONVERSATION_RECORD_MAX_CHARS - (previouslyDropped > 0 ? jsonLength(trimMarkerEntry(previouslyDropped)) + 1 : 0);
  // 빠른 길: 매 툴콜마다 저장하므로, 예산 안이면 항목별 크기를 재지 않는다(직렬화 1회).
  if (jsonLength(rows) <= budget) {
    if (previouslyDropped === 0) return rows;
    const seam = Math.min(Math.max(markerIndex, 0), rows.length);
    return [...rows.slice(0, seam), trimMarkerEntry(previouslyDropped), ...rows.slice(seam)];
  }

  const sizes = rows.map((row) => jsonLength(row) + 1);
  const tailBudget = budget - Math.floor(budget * TRIM_HEAD_RESERVE_RATIO);
  let used = 0;
  let tailStart = rows.length;
  while (tailStart > 0) {
    const size = sizes[tailStart - 1] as number;
    // 마지막 항목은 홀로 예산을 넘겨도 남긴다 — 최근 항목이 없는 대화는 이어갈 근거가 없다.
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
  const dropped = previouslyDropped + (tailStart - headEnd);
  return [...rows.slice(0, headEnd), trimMarkerEntry(dropped), ...rows.slice(tailStart)];
}

function compactRecord(record: ConversationRecord): ConversationRecord & { mapIndex: ConversationMapIndex } {
  const previous = isConversationMapIndex(record.mapIndex) ? record.mapIndex : undefined;
  return { ...record, mapIndex: indexConversationMaps(record.entries, previous), entries: fitEntriesToBudget(record.entries) };
}

// ── 레거시 이관 ──────────────────────────────────────────────────────────────────

let legacyMigration: Promise<void> | null = null;
registerAiRecordDbResetHook(() => {
  legacyMigration = null;
  writeFailureWarned = false;
});

/**
 * 옛 localStorage 키의 대화를 IndexedDB 로 옮기고 키를 지운다. 세션당 한 번이지만, 쓰기가 실패하면
 * 키를 남겨 두고 다음 접근에서 다시 시도한다 — 이관 실패로 대화를 잃지 않는다.
 * 같은 id 가 이미 있으면 savedAt 이 더 큰 쪽을 남긴다(e2e 시드가 매 부팅 같은 레코드를 다시 심는다).
 */
function ensureLegacyMigrated(): Promise<void> {
  if (legacyMigration) return legacyMigration;
  legacyMigration = (async () => {
    const storage = getLegacyStorage();
    const raw = storage?.getItem(LEGACY_CONVERSATION_STORAGE_KEY);
    if (!storage || !raw) return;
    let legacy: ConversationRecord[] = [];
    try {
      const parsed: unknown = JSON.parse(raw);
      legacy = Array.isArray(parsed) ? parsed.filter(isConversationRecord) : [];
    } catch {
      legacy = [];
    }
    if (legacy.length > 0) {
      for (const record of legacy) await persistLocalConversation(compactRecord(record));
    }
    storage.removeItem(LEGACY_CONVERSATION_STORAGE_KEY);
  })().catch((error: unknown) => {
    legacyMigration = null;
    throw error;
  });
  return legacyMigration;
}

async function readAll(): Promise<ConversationRecord[]> {
  await ensureLegacyMigrated();
  const records = await readAllAiRecords<ConversationRecord>(STORE);
  return records.filter(isConversationRecord).sort((left, right) => right.savedAt - left.savedAt || left.id.localeCompare(right.id));
}

/** Exact stored JSON-shaped content, including own undefined fields and nested provenance.
 * Unsupported structured-clone objects fail closed instead of comparing as empty JSON.
 */
function sameStoredValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!isObject(left) || !isObject(right) || Array.isArray(left) !== Array.isArray(right)) return false;
  const supported = (value: object) => Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
  if (!supported(left) || !supported(right)) return false;
  const keys = Reflect.ownKeys(left);
  return keys.length === Reflect.ownKeys(right).length && keys.every(key => Object.hasOwn(right, key)
    && sameStoredValue(Reflect.get(left, key), Reflect.get(right, key)));
}

async function persistLocalConversation(record: ConversationRecord & { mapIndex: ConversationMapIndex }, options: {
  readonly requireCurrent?: () => void; readonly replaceEqual?: boolean; readonly recoveryBaseline?: ConversationRecord | null;
} = {}) {
  return mutateScopedAiRecord<ConversationRecord>({ store: STORE, id: record.id, scope: record.projectContextKey ?? null, replaceEqual: options.replaceEqual,
    admit: current => {
      options.requireCurrent?.();
      return options.recoveryBaseline === undefined || sameStoredValue(current, options.recoveryBaseline);
    },
  }, current => {
    const prior = current && isConversationMapIndex(current.mapIndex) ? current.mapIndex : undefined;
    const viewedMapIds = [...new Set([...record.mapIndex.viewedMapIds, ...(prior?.viewedMapIds ?? [])])].sort();
    const targetMapIds = [...new Set([...record.mapIndex.targetMapIds, ...(prior?.targetMapIds ?? [])])].sort();
    const mapAttribution = viewedMapIds.length + targetMapIds.length === 0 ? "unknown"
      : record.mapIndex.mapAttribution === "complete" && (!prior || prior.mapAttribution === "complete") ? "complete" : "partial";
    return { ...record, mapIndex: { viewedMapIds, targetMapIds, mapAttribution } };
  });
}

let writeFailureWarned = false;

registerRemoteOutboxSender("ai-conversation", async (payload) => {
  if (!isObject(payload) || typeof payload.conversationId !== "string" || typeof payload.title !== "string"
    || typeof payload.model !== "string" || typeof payload.savedAt !== "number" || !Array.isArray(payload.entries)
    || !payload.entries.every(isAuditEntry)) throw new Error("Invalid conversation outbox payload");
  const scope = typeof payload.projectContextKey === "string" ? payload.projectContextKey : null;
  const destination = typeof payload.destinationProjectId === "string" ? payload.destinationProjectId
    : scope?.startsWith("remote:") ? scope.slice(7) : null;
  if (!destination) throw new Error("Conversation outbox has no originating destination");
  if (await isScopedAiRecordDeleted(payload.conversationId, scope)) return;
  const local = await loadConversationForScope(payload.conversationId, scope);
  if (local && local.savedAt > payload.savedAt) return;
  // Equal milliseconds can contain a later local save; retry that snapshot, not the queued copy.
  const snapshot = local?.savedAt === payload.savedAt ? local
    : { title: payload.title, model: payload.model, entries: payload.entries };
  const result = await projectRepository().ai.recordConversation({ conversationId: payload.conversationId, title: snapshot.title,
    model: snapshot.model, entries: snapshot.entries, savedAt: payload.savedAt, destinationProjectId: destination,
    ...(scope === null ? {} : { projectContextKey: scope }) });
  if (result.kind === "not-configured") throw new Error("project storage not configured");
});

// ── 공개 API (모두 비동기, 던지지 않는다) ──────────────────────────────────────────────

export async function saveConversation(record: ConversationRecord): Promise<ConversationSaveOutcome> {
  // Freeze origin before the first await, even when a retired session saves after project switching.
  const config = projectRepository().currentTarget();
  const destinationProjectId = record.projectContextKey?.startsWith("remote:")
    ? record.projectContextKey.slice(7) : config?.projectId ?? null;
  let compacted: ConversationRecord & { mapIndex: ConversationMapIndex };
  let outcome: ConversationSaveOutcome;
  try {
    compacted = compactRecord(record);
    await ensureLegacyMigrated();
    const result = await persistLocalConversation(compacted, { replaceEqual: true });
    if (!result.written) return { ok: true, durable: result.backend === "indexeddb", evicted: 0 };
    writeFailureWarned = false;
    outcome = { ok: true, durable: result.backend === "indexeddb", evicted: 0 };
  } catch (error) {
    if (!writeFailureWarned) {
      writeFailureWarned = true;
      console.warn("[ai-conversation] 대화 기록을 이 브라우저에 저장하지 못했습니다. 이번 대화는 메모리에만 남습니다:", error);
    }
    return { ok: false, durable: false, evicted: 0 };
  }
  // 원격 미러도 로컬과 **같은 압축본**을 받는다 — 정본이 하나여야 하고, 매 툴콜마다 수 MB 를 보내지 않는다.
  const remoteInput: ConversationInput = {
    conversationId: compacted.id,
    destinationProjectId,
    title: compacted.title,
    model: compacted.model,
    ...(compacted.projectContextKey ? { projectContextKey: compacted.projectContextKey } : {}),
    entries: compacted.entries,
    savedAt: compacted.savedAt,
  };
  // Payload carries only the destination id, never credentials. Retry cannot adopt the current project.
  void projectRepository().ai.recordConversation(remoteInput, config).catch((error: unknown) => {
    console.error("[ai-conversation] Project storage mirror failed:", error);
    enqueueRemoteWrite({ id: compacted.id, kind: "ai-conversation", payload: remoteInput, error });
  });
  return outcome;
}

const PREVIEW_LIMIT = 80;

/** 마지막 조수 발화, 없으면 마지막 사용자 발화. 80자를 넘으면 잘라 … 를 붙인다. */
export function conversationPreview(entries: readonly AuditEntry[]): string | null {
  const pick = (kind: "assistant" | "user"): string | null => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry && entry.kind === kind && entry.text.trim().length > 0) {
        // 마크다운 강조 표식(** * `)은 미리보기 한 줄에서는 소음이다.
        return entry.text.replace(/[*`_]{1,2}/gu, "").replace(/\s+/gu, " ").trim();
      }
    }
    return null;
  };
  const text = pick("assistant") ?? pick("user");
  if (text === null) return null;
  return text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}…` : text;
}

function toSummary(conversation: ConversationRecord): ConversationSummary {
  const preview = conversationPreview(conversation.entries);
  return {
    id: conversation.id,
    title: conversation.title,
    model: conversation.model,
    savedAt: conversation.savedAt,
    turnCount: conversation.entries.filter((entry) => entry.kind === "user").length,
    ...(preview === null ? {} : { preview }),
    ...(conversation.projectContextKey ? { projectContextKey: conversation.projectContextKey } : {}),
  };
}

/** 최근 저장 순 요약 목록. 저장소 오류는 빈 목록으로 삼킨다(호출자는 UI 라 던져서 얻을 것이 없다). */
export async function listConversations(): Promise<ConversationSummary[]> {
  try {
    await ensureLegacyMigrated();
    return (await queryConversationSummaries<ConversationArchiveSummary>({ offset: 0, limit: CONVERSATION_MAX_RECORDS })).records.map(row => ({
      id: row.id, title: row.title, model: row.model, savedAt: row.savedAt, turnCount: row.turnCount,
      ...(row.preview === undefined ? {} : { preview: row.preview }),
      ...(row.projectContextKey ? { projectContextKey: row.projectContextKey } : {}),
    }));
  } catch (error) {
    console.warn("[ai-conversation] 대화 목록을 읽지 못했습니다:", error);
    return [];
  }
}

/** 제목 부분일치 검색(대소문자 무시) — 대화 기록 모달용. */
export async function searchConversations(query: string): Promise<ConversationSummary[]> {
  const needle = query.trim().toLowerCase();
  const all = await listConversations();
  if (!needle) return all;
  return all.filter((conversation) => conversation.title.toLowerCase().includes(needle));
}

export async function loadConversation(id: string): Promise<ConversationRecord | null> {
  try {
    await ensureLegacyMigrated();
    const record = await readAiRecord<ConversationRecord>(STORE, id);
    return isConversationRecord(record) ? record : null;
  } catch (error) {
    console.warn("[ai-conversation] 대화를 읽지 못했습니다:", error);
    return null;
  }
}

export async function loadLatestConversation(): Promise<ConversationRecord | null> {
  try {
    await ensureLegacyMigrated();
    const latest = (await queryConversationSummaries<ConversationArchiveSummary>({ offset: 0, limit: 1 })).records[0];
    return latest ? loadConversation(latest.id) : null;
  } catch {
    return null;
  }
}

/**
 * **이 프로젝트 범위**의 최신 대화.
 *
 * 왜 따로 있는가 (실측): 부팅 자동 복원이 `loadLatestConversation()`(전역 최신) 하나를 집어
 * 스코프가 다르면 복원을 포기했다. 두 프로젝트를 번갈아 열면 다른 프로젝트의 대화가 더 최근이라
 * **내 프로젝트의 대화가 그대로 있는데도 매번 빈 새 대화로 시작**했다 — 사용자가 ＋를 누르지도
 * 않았는데 새 세션이 강요되는 것으로 보인다. savedAt 최댓값을 고른다.
 */
export async function loadLatestConversationForScope(scopeKey: string): Promise<ConversationRecord | null> {
  try {
    await ensureLegacyMigrated();
    const latest = (await queryConversationSummaries<ConversationArchiveSummary>({ scope: scopeKey, offset: 0, limit: 1 })).records[0];
    return latest ? loadConversationForScope(latest.id, scopeKey) : null;
  } catch {
    return null;
  }
}

/**
 * 대화 저장/복원 범위. 원격 프로젝트는 durable row id를 쓰고, durable row가 없는 로컬 세션은
 * 새로고침 뒤에도 재구성 가능한 프로젝트 모양(제목 + 시작 맵)을 쓴다. 로컬 세션의 런타임 identity
 * id는 별도로 프로젝트 전환 감지에만 사용한다.
 */
export function conversationScopeKey(identity: ProjectIdentity, project: Pick<Project, "meta" | "startMapId">): string {
  if (identity.kind === "remote") return `remote:${identity.id}`;
  const title = project.meta.title.trim() || "(untitled)";
  return `local:${title}::${project.startMapId}`;
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await ensureLegacyMigrated();
    const record = await loadConversation(id);
    if (record) await deleteConversationForScope(id, record.projectContextKey ?? null);
  } catch (error) {
    console.warn("[ai-conversation] 대화를 지우지 못했습니다:", error);
  }
}

export async function clearConversations(): Promise<void> {
  try {
    await ensureLegacyMigrated();
    getLegacyStorage()?.removeItem(LEGACY_CONVERSATION_STORAGE_KEY);
    legacyMigration = Promise.resolve();
    const conversations = await readAll();
    await clearAiRecords(STORE);
    for (const record of conversations) if (record.projectContextKey) {
      await deleteTerminalRunCheckpointsForConversation(record.id, record.projectContextKey);
    }
  } catch (error) {
    console.warn("[ai-conversation] 대화 기록을 비우지 못했습니다:", error);
  }
}

export interface ConversationArchiveSummary extends ConversationSummary, ConversationMapIndex {
  readonly mapIds: readonly string[];
  readonly transcriptCompacted: boolean;
}

export interface ConversationArchiveQuery {
  /** null explicitly selects legacy unscoped history, never the current project. */
  readonly projectContextKey: string | null;
  readonly mapId?: string;
  readonly unknownOnly?: boolean;
  readonly query?: string;
  readonly offset?: number;
  readonly limit?: number;
  readonly signal?: AbortSignal;
}

/** Full archive queries reject storage errors, unlike the compatibility recent-list API. */
export async function queryConversationArchive(options: ConversationArchiveQuery): Promise<{
  readonly records: readonly ConversationArchiveSummary[]; readonly total: number; readonly hasMore: boolean; readonly durable: boolean;
}> {
  await ensureLegacyMigrated();
  const needle = options.query?.trim().toLowerCase();
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const limit = Math.max(1, Math.floor(options.limit ?? 50));
  return queryConversationSummaries<ConversationArchiveSummary>({ scope: options.projectContextKey, mapId: options.mapId,
    unknownOnly: options.unknownOnly, offset, limit, signal: options.signal,
    ...(needle || options.mapId && options.unknownOnly ? { matches: (row: ConversationArchiveSummary) =>
      (!options.unknownOnly || row.mapAttribution === "unknown")
      && (!needle || `${row.title}\n${row.preview ?? ""}`.toLowerCase().includes(needle)) } : {}),
  });
}

export async function listConversationArchiveMapIds(projectContextKey: string): Promise<string[]> {
  await ensureLegacyMigrated();
  return conversationSummaryMapIds(projectContextKey);
}

export async function loadConversationForScope(id: string, projectContextKey: string | null): Promise<ConversationRecord | null> {
  await ensureLegacyMigrated();
  const record = await readAiRecord<ConversationRecord>(STORE, id);
  return isConversationRecord(record) && (record.projectContextKey ?? null) === projectContextKey ? record : null;
}

/** Whole-conversation deletion is browser-local; it does not delete the remote mirror. */
export async function deleteConversationForScope(id: string, projectContextKey: string | null): Promise<{ readonly durable: boolean }> {
  await ensureLegacyMigrated();
  const result = await mutateScopedAiRecord<ConversationRecord>({ store: STORE, id, scope: projectContextKey }, null);
  if (result.written && projectContextKey) await deleteTerminalRunCheckpointsForConversation(id, projectContextKey);
  return { durable: result.backend === "indexeddb" };
}

export interface ConversationArchiveHydrationOptions {
  readonly projectContextKey: string;
  readonly signal?: AbortSignal;
  /** Capture the editor identity at open; return false on project switch or modal close. */
  readonly isCurrent?: () => boolean;
}

/** Explicit, local-only recovery. Imported rows never call saveConversation or mirror back remotely. */
export async function hydrateConversationArchive(options: ConversationArchiveHydrationOptions): Promise<{
  readonly imported: number; readonly skipped: number; readonly rejected: number; readonly durable: boolean;
}> {
  const captured = projectRepository().currentTarget();
  if (!captured) throw new Error("Conversation recovery is not configured");
  const config = { ...captured, projectId: options.projectContextKey.startsWith("remote:")
    ? options.projectContextKey.slice(7) : captured.projectId };
  const requireCurrent = () => {
    options.signal?.throwIfAborted();
    if (options.isCurrent && !options.isCurrent()) throw new DOMException("Conversation scope changed", "AbortError");
  };
  requireCurrent();
  await ensureLegacyMigrated();
  // One value snapshot for the whole operation, before the first network request.
  // Memory reads return aliases, so retaining the returned objects would lose the veto.
  const baseline = new Map((await readAll()).map(record => [record.id, structuredClone(record)]));
  let imported = 0;
  let skipped = 0;
  let rejected = 0;
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    requireCurrent();
    const rows = await projectRepository().ai.listConversations({ offset, limit: pageSize, includeEntries: true,
      projectContextKey: options.projectContextKey, signal: options.signal }, config);
    requireCurrent();
    for (const row of rows) {
      const candidate = { id: row.conversation_id, title: row.title, model: row.model,
        projectContextKey: row.project_context_key, entries: row.entries_json,
        savedAt: typeof row.saved_at === "string" ? Date.parse(row.saved_at) : NaN };
      if (row.project_id !== config.projectId || candidate.projectContextKey !== options.projectContextKey || !isConversationRecord(candidate) || !candidate.id) {
        rejected++;
        continue;
      }
      requireCurrent();
      const result = await persistLocalConversation(compactRecord(candidate), { requireCurrent,
        recoveryBaseline: baseline.get(candidate.id) ?? null });
      if (result.written) imported++; else skipped++;
    }
    if (rows.length < pageSize) break;
  }
  requireCurrent();
  return { imported, skipped, rejected, durable: await aiRecordBackendKind() === "indexeddb" };
}

export function deriveTitle(entries: readonly AuditEntry[]): string {
  for (const entry of entries) {
    if (entry.kind !== "user") continue;
    // `[컨텍스트] 현재 맵: …` 는 패널이 붙이는 기계 생성 footer 다(aiChatPanel 의 contextFooter).
    // 제목에 그대로 들어가면 목록의 모든 줄이 같은 맵 이름으로 시작해 사람이 대화를 못 가른다
    // (실측 2026-08-30, 이전 대화 모달: "동굴 입구에 표지판을 세워줘 [컨텍스트] 현재 맵: 이슬 …").
    const title = (entry.text.split("\n\n[컨텍스트]")[0] ?? entry.text).trim();
    if (title.length > 0) return title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT)}...` : title;
  }
  return "(빈 대화)";
}

// Pure projection registration has no I/O. Saves, recovery, old API seeding and
// deletion update this summary in the SAME IDB transaction as the transcript.
registerConversationSummaryProjector(value => {
  if (!isConversationRecord(value)) return null;
  const index = isConversationMapIndex(value.mapIndex) ? value.mapIndex : indexConversationMaps(value.entries);
  return { ...toSummary(value), ...(value.projectContextKey === undefined ? {} : { projectContextKey: value.projectContextKey }), ...index, mapIds: [...new Set([...index.viewedMapIds, ...index.targetMapIds])].sort(),
    transcriptCompacted: conversationTranscriptCompacted(value.entries) };
});
