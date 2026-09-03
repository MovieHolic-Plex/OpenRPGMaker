import type { AuditEntry } from "@/ai/assistantSession";
import { isConversationTurnContext } from "@/ai/conversationTurnContext";
import { enqueueRemoteWrite, registerRemoteOutboxSender } from "@/project/remoteOutbox";
import type { ProjectIdentity } from "@/project/store";
import { recordSupabaseConversation, type SupabaseConversationInput } from "@/project/supabaseProjectSync";
import type { Project } from "@/project/types";

export interface ConversationRecord { id: string; title: string; model: string; savedAt: number; entries: AuditEntry[]; projectContextKey?: string; }
export interface ConversationSummary { id: string; title: string; model: string; savedAt: number; turnCount: number; projectContextKey?: string; /** 마지막 조수(없으면 사용자) 발화 80자 — 목록에서 고를 근거(데크 2026-09-03). */ readonly preview?: string; }
/**
 * 저장 결과 — `saveConversation` 은 **던지지 않는다.** `ok:false` 는 최신 1건으로 줄여도 이 브라우저에
 * 한 글자도 못 남겼다는 뜻이고(저장 공간 고갈·프라이빗 모드), `evicted` 는 자리를 내주려 밀어낸
 * 이전 대화 수다. 저장소가 없는 환경(Node)은 남길 곳이 없을 뿐 실패가 아니므로 `ok:true`.
 */
export interface ConversationSaveOutcome { readonly ok: boolean; readonly evicted: number; }

const STORAGE_KEY = "oprn:ai-conversations";
const MAX_CONVERSATIONS = 50;
const TITLE_LIMIT = 40;

// ── 저장 예산(글자 수) ─────────────────────────────────────────────────────────────
// 실측 결함(2026-09-03): 조수를 쓰다 「오류: Failed to execute 'setItem' on 'Storage': Setting the
// value of 'oprn:ai-conversations' exceeded the quota.」 가 말풍선으로 떴고 그 턴이 끊겼다. 원인은
// 세 겹이다. (1) 툴콜 인자(맵 셀 배열·이벤트 본문)를 상한 없이 저장했고, (2) 같은 인자가 assistant
// 항목(`toolCalls[].args` 문자열)과 tool 항목(`args` 객체)에 **두 번** 들어가며, (3) 대화 50건을
// 매 툴콜마다 통째로 다시 써서 오리진 한도를 넘는 순간 예외가 툴콜 스트리밍 핸들러
// (aiTurnRunner 의 tool_call 분기)와 finally 양쪽에서 터졌다.
//
// localStorage 는 오리진당 약 5MB 이고 Firefox/Safari 는 UTF-16 기준으로 약 260만 글자다. 이 키는
// 활동 로그(`oprn:ai-activity-logs`, 스스로 절반씩 줄임)·원격 outbox(150만 글자 예산)와 그 공간을
// 나눠 쓰므로 여기 예산은 그보다 작게 잡는다. 인자 미리보기는 활동 로그(12,000)보다 짧다 — 대화
// 기록의 소비자는 복원 화면(툴 상세 <pre>)과 export 뿐이고, 진단 원문은 활동 로그가 든다.
/** 툴콜 인자 한 건이 저장될 때의 상한(직렬화 글자 수). 넘으면 `{ _truncated, preview }` 로 바꾼다. */
export const CONVERSATION_ARGS_MAX_CHARS = 2_000;
/** 대화 한 건의 entries 직렬화 상한. 넘으면 머리(첫 발화·계획)와 꼬리(최근)를 남기고 가운데를 접는다. */
export const CONVERSATION_RECORD_MAX_CHARS = 200_000;
/** 이 키 전체의 직렬화 상한. 최신부터 담고 넘치는 오래된 대화는 밀어낸다(50건 상한과 별개). */
export const CONVERSATION_STORE_MAX_CHARS = 1_000_000;
/** 가운데를 접었음을 남기는 status 항목의 구조 토큰(복원 화면·모델 주입은 status 를 무시한다). */
export const CONVERSATION_TRIM_MARKER = "[conversation-trimmed]";
/** 접을 때 머리에 남겨 두는 몫 — 활동 로그의 HEAD_RESERVE_RATIO 와 같은 이유(첫 발화가 사라지면 맥락이 없다). */
const TRIM_HEAD_RESERVE_RATIO = 0.25;

function getStorage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
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
      return typeof value.text === "string";
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

function isConversationRecord(value: unknown): value is ConversationRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.model === "string" &&
    typeof value.savedAt === "number" &&
    (value.projectContextKey === undefined || typeof value.projectContextKey === "string") &&
    Array.isArray(value.entries) &&
    value.entries.every(isAuditEntry)
  );
}

function readConversations(): ConversationRecord[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isConversationRecord) : [];
  } catch {
    return [];
  }
}

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
  // 빠른 길: 매 툴콜마다 50건을 다시 쓰므로, 예산 안이면 항목별 크기를 재지 않는다(직렬화 1회).
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

function compactRecord(record: ConversationRecord): ConversationRecord {
  return { ...record, entries: fitEntriesToBudget(record.entries) };
}

/** 최신부터 저장소 예산 안에 담는다. 첫 레코드(지금 저장하는 대화)는 홀로 넘어도 남긴다. */
function fitRecordsToBudget(records: readonly ConversationRecord[]): { kept: ConversationRecord[]; evicted: number } {
  const kept: ConversationRecord[] = [];
  let used = 2; // 배열 괄호
  for (const record of records) {
    const size = jsonLength(record) + 1;
    if (kept.length > 0 && used + size > CONVERSATION_STORE_MAX_CHARS) break;
    kept.push(record);
    used += size;
  }
  return { kept, evicted: records.length - kept.length };
}

// 완전 실패 경고는 실패가 이어지는 동안 한 번만 — 매 툴콜마다 저장하므로 그대로 두면 콘솔이 같은 줄로 덮인다.
let storageFailureWarned = false;

interface WriteOutcome extends ConversationSaveOutcome { readonly stored: readonly ConversationRecord[]; }

/**
 * 모든 레코드를 압축해(레거시로 부풀린 것 포함) 예산 안에 담고 쓴다. 브라우저가 그래도 거절하면
 * (다른 키가 공간을 먹었을 때) 절반씩 줄여 재시도하고, 최신 1건도 못 쓰면 경고만 남긴다. **던지지 않는다.**
 */
function writeConversations(records: readonly ConversationRecord[]): WriteOutcome {
  const compacted = records.slice(0, MAX_CONVERSATIONS).map(compactRecord);
  const storage = getStorage();
  if (!storage) return { ok: true, evicted: 0, stored: compacted };
  const fitted = fitRecordsToBudget(compacted);
  let attempt = fitted.kept;
  let evicted = fitted.evicted;
  let lastError: unknown = null;
  for (;;) {
    try {
      // 빈 배열도 써야 한다 — 마지막 대화를 지운 뒤 저장소에 옛 값이 남으면 삭제가 되돌아온다.
      storage.setItem(STORAGE_KEY, JSON.stringify(attempt));
      storageFailureWarned = false;
      return { ok: true, evicted, stored: attempt };
    } catch (error) {
      lastError = error;
      if (attempt.length <= 1) break;
      const next = attempt.slice(0, Math.max(1, Math.floor(attempt.length / 2)));
      evicted += attempt.length - next.length;
      attempt = next;
    }
  }
  if (!storageFailureWarned) {
    storageFailureWarned = true;
    console.warn(
      "[ai-conversation] 이 브라우저의 저장 공간이 가득 차 대화 기록을 저장하지 못했습니다(최신 1건으로 줄여도 실패). 이번 대화는 메모리에만 남습니다.",
      lastError,
    );
  }
  return { ok: false, evicted, stored: compacted };
}

registerRemoteOutboxSender("ai-conversation", async (payload) => {
  const result = await recordSupabaseConversation(payload as SupabaseConversationInput);
  if (result.kind === "not-configured") throw new Error("supabase not configured");
});

export function saveConversation(record: ConversationRecord): ConversationSaveOutcome {
  const written = writeConversations([record, ...readConversations().filter((conversation) => conversation.id !== record.id)]);
  // 원격 미러도 로컬과 **같은 압축본**을 받는다 — 정본이 하나여야 하고, 매 툴콜마다 수 MB 를 보내지 않는다.
  const stored = written.stored[0] ?? compactRecord(record);
  const remoteInput: SupabaseConversationInput = {
    conversationId: stored.id,
    title: stored.title,
    model: stored.model,
    ...(stored.projectContextKey ? { projectContextKey: stored.projectContextKey } : {}),
    entries: stored.entries,
    savedAt: stored.savedAt,
  };
  // 로컬은 50건 링버퍼라 전송 성공/실패와 무관하게 자리를 밀어낸다. 실패를 조용히 무시하면
  // 원격이 죽은 동안의 대화가 근거 없이 사라지므로, 실패분은 outbox 에 보존하고 나중에 재전송한다.
  void recordSupabaseConversation(remoteInput).catch((error: unknown) => {
    console.error("[ai-conversation] Supabase mirror failed:", error);
    enqueueRemoteWrite({ id: stored.id, kind: "ai-conversation", payload: remoteInput, error });
  });
  return { ok: written.ok, evicted: written.evicted };
}

/** 제목 부분일치 검색(대소문자 무시) — 시작 화면 대화 목록용. */
export function searchConversations(query: string): ConversationSummary[] {
  const needle = query.trim().toLowerCase();
  const all = listConversations();
  if (!needle) return all;
  return all.filter((conversation) => conversation.title.toLowerCase().includes(needle));
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

export function listConversations(): ConversationSummary[] {
  return readConversations().map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    model: conversation.model,
    savedAt: conversation.savedAt,
    turnCount: conversation.entries.filter((entry) => entry.kind === "user").length,
    ...(conversationPreview(conversation.entries) === null ? {} : { preview: conversationPreview(conversation.entries) ?? "" }),
    ...(conversation.projectContextKey ? { projectContextKey: conversation.projectContextKey } : {}),
  }));
}

export function loadConversation(id: string): ConversationRecord | null {
  return readConversations().find((conversation) => conversation.id === id) ?? null;
}

export function loadLatestConversation(): ConversationRecord | null {
  return readConversations()[0] ?? null;
}

/**
 * **이 프로젝트 범위**의 최신 대화.
 *
 * 왜 따로 있는가 (실측): 부팅 자동 복원이 `loadLatestConversation()`(전역 최신) 하나를 집어
 * 스코프가 다르면 복원을 포기했다. 두 프로젝트를 번갈아 열면 다른 프로젝트의 대화가 더 최근이라
 * **내 프로젝트의 대화가 그대로 있는데도 매번 빈 새 대화로 시작**했다 — 사용자가 ＋를 누르지도
 * 않았는데 새 세션이 강요되는 것으로 보인다. 저장 배열은 최신이 앞이지만(saveConversation 이
 * prepend) 원격 미러/수동 병합으로 순서가 흐트러질 수 있어 savedAt 으로 최댓값을 고른다.
 */
export function loadLatestConversationForScope(scopeKey: string): ConversationRecord | null {
  let latest: ConversationRecord | null = null;
  for (const conversation of readConversations()) {
    if (conversation.projectContextKey !== scopeKey) continue;
    if (!latest || conversation.savedAt > latest.savedAt) latest = conversation;
  }
  return latest;
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

export function deleteConversation(id: string): void {
  writeConversations(readConversations().filter((conversation) => conversation.id !== id));
}

export function clearConversations(): void {
  getStorage()?.removeItem(STORAGE_KEY);
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
