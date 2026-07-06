import type { AuditEntry } from "@/ai/assistantSession";

export interface ConversationRecord { id: string; title: string; model: string; savedAt: number; entries: AuditEntry[]; }
export interface ConversationSummary { id: string; title: string; model: string; savedAt: number; turnCount: number; }

const STORAGE_KEY = "rpg-zzu:ai-conversations";
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
      return typeof value.text === "string";
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
        (value.issues === undefined || isStringArray(value.issues))
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

export function saveConversation(record: ConversationRecord): void {
  writeConversations([record, ...readConversations().filter((conversation) => conversation.id !== record.id)]);
}

export function listConversations(): ConversationSummary[] {
  return readConversations().map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    model: conversation.model,
    savedAt: conversation.savedAt,
    turnCount: conversation.entries.filter((entry) => entry.kind === "user").length,
  }));
}

export function loadConversation(id: string): ConversationRecord | null {
  return readConversations().find((conversation) => conversation.id === id) ?? null;
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
    const title = entry.text.trim();
    if (title.length > 0) return title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT)}...` : title;
  }
  return "(빈 대화)";
}
