import type { AuditEntry } from "@/ai/assistantSession";
import { isConversationTurnContext } from "@/ai/conversationTurnContext";
import { enqueueRemoteWrite, registerRemoteOutboxSender } from "@/project/remoteOutbox";
import type { ProjectIdentity } from "@/project/store";
import { recordSupabaseConversation, type SupabaseConversationInput } from "@/project/supabaseProjectSync";
import type { Project } from "@/project/types";

export interface ConversationRecord { id: string; title: string; model: string; savedAt: number; entries: AuditEntry[]; projectContextKey?: string; }
export interface ConversationSummary { id: string; title: string; model: string; savedAt: number; turnCount: number; projectContextKey?: string; }

const STORAGE_KEY = "oprn:ai-conversations";
const MAX_CONVERSATIONS = 50;
const TITLE_LIMIT = 40;

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

function writeConversations(records: readonly ConversationRecord[]): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_CONVERSATIONS)));
}

registerRemoteOutboxSender("ai-conversation", async (payload) => {
  const result = await recordSupabaseConversation(payload as SupabaseConversationInput);
  if (result.kind === "not-configured") throw new Error("supabase not configured");
});

export function saveConversation(record: ConversationRecord): void {
  writeConversations([record, ...readConversations().filter((conversation) => conversation.id !== record.id)]);
  const remoteInput: SupabaseConversationInput = {
    conversationId: record.id,
    title: record.title,
    model: record.model,
    ...(record.projectContextKey ? { projectContextKey: record.projectContextKey } : {}),
    entries: record.entries,
    savedAt: record.savedAt,
  };
  // 로컬은 50건 링버퍼라 전송 성공/실패와 무관하게 자리를 밀어낸다. 실패를 조용히 무시하면
  // 원격이 죽은 동안의 대화가 근거 없이 사라지므로, 실패분은 outbox 에 보존하고 나중에 재전송한다.
  void recordSupabaseConversation(remoteInput).catch((error: unknown) => {
    console.error("[ai-conversation] Supabase mirror failed:", error);
    enqueueRemoteWrite({ id: record.id, kind: "ai-conversation", payload: remoteInput, error });
  });
}

/** 제목 부분일치 검색(대소문자 무시) — 시작 화면 대화 목록용. */
export function searchConversations(query: string): ConversationSummary[] {
  const needle = query.trim().toLowerCase();
  const all = listConversations();
  if (!needle) return all;
  return all.filter((conversation) => conversation.title.toLowerCase().includes(needle));
}

export function listConversations(): ConversationSummary[] {
  return readConversations().map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    model: conversation.model,
    savedAt: conversation.savedAt,
    turnCount: conversation.entries.filter((entry) => entry.kind === "user").length,
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
