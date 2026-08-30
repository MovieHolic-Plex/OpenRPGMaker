// scripts/lib/aiConversationSqlite.mjs 의 타입 경계. vite.config.ts 와 테스트가 이 선언으로 읽는다.
// 입력은 전부 optional 이다 — HTTP 본문(JSON.parse 결과)이 그대로 들어오는 시스템 경계이고,
// 필수 필드 검증은 writer 가 런타임에 한다(그래서 400 으로 떨어진다).

export interface ConversationAppendInput {
  conversationId?: string;
  entryId?: string;
  kind?: string;
  at?: string;
  text?: string;
  toolName?: string | null;
  projectContextKey?: string | null;
  model?: string | null;
  payload?: unknown;
}

export interface ConversationSummaryRow {
  conversation_id: string;
  title: string | null;
  model: string | null;
  project_context_key: string | null;
  first_at: string;
  last_at: string;
  entry_count: number;
}

export interface ConversationEntryRow {
  seq: number;
  at: string;
  kind: string;
  text: string | null;
  tool_name: string | null;
  payload_json: string;
}

/** node:sqlite DatabaseSync 핸들 — 호출자는 close 만 알면 된다. */
export interface ConversationDbHandle {
  close(): void;
}

export function defaultConversationDbPath(cwd?: string): string;
export function openConversationDb(path?: string): ConversationDbHandle;
export function appendConversationEntry(
  db: ConversationDbHandle,
  input: ConversationAppendInput,
): { seq: number; inserted: boolean };
export function listConversations(db: ConversationDbHandle, limit?: number): ConversationSummaryRow[];
export function readConversationEntries(
  db: ConversationDbHandle,
  conversationId: string,
): ConversationEntryRow[];
