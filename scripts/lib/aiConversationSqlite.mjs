// AI 대화의 로컬 SQLite 미러(dev 편의용 정본 사본).
//
// 왜 존재하는가: 대화의 Supabase 저장은 **턴이 끝날 때 1회**(aiChatPanel 의 persistConversation)
// 뿐이고, localStorage 는 50건 링버퍼다. 그래서 응답 대기 중 새로고침/탭 종료가 그 턴을 통째로
// 지운다. 이 파일은 감사 항목이 생기는 즉시 append 되는 로컬 로그를 담당한다 —
// 실시간(SQLite) + 턴 종료(Supabase) 이중 기록의 앞쪽 절반이다.
//
// 계약:
//   - append-only. 같은 entry_id 재전송은 무해하다(INSERT OR IGNORE + 기존 seq 반환).
//   - seq 는 서버가 대화별로 매긴다(클라이언트 카운터를 신뢰하지 않는다 — 턴/세션 경계에서
//     어긋나면 순서가 조용히 뒤섞인다).
//   - 스키마 생성은 열 때마다 idempotent 하게 수행한다.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** dev 미러 DB 기본 경로(gitignore 된 output/ 아래). */
export function defaultConversationDbPath(cwd = process.cwd()) {
  return join(cwd, "output", "ai-conversations.sqlite");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id TEXT PRIMARY KEY,
  project_context_key TEXT,
  model TEXT,
  title TEXT,
  first_at TEXT NOT NULL,
  last_at TEXT NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS conversation_entries (
  entry_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT,
  tool_name TEXT,
  payload_json TEXT NOT NULL,
  UNIQUE (conversation_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_conversation_entries_conv_seq
  ON conversation_entries (conversation_id, seq);
`;

/** DB 를 열고 스키마를 보장한다. 호출자가 close 책임을 갖는다. */
export function openConversationDb(path = defaultConversationDbPath()) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // dev 서버가 쓰는 동안 CLI 가 읽는다 — WAL 이어야 읽기가 쓰기를 막지 않는다.
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

/** 사용자 발화 꼬리의 [컨텍스트] 블록을 제외한 제목. 목록에서 읽히는 건 앞부분뿐이다. */
function deriveTitle(text) {
  const head = String(text ?? "").split("\n\n[컨텍스트]")[0] ?? "";
  return head.replace(/\s+/gu, " ").trim().slice(0, 200);
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} required`);
  return value;
}

/**
 * 감사 항목 1건 append.
 *
 * @returns {{ seq: number, inserted: boolean }} 재전송(중복 entry_id)이면 inserted=false 이고
 *   seq 는 처음 기록된 값이다.
 */
export function appendConversationEntry(db, input) {
  const conversationId = requireString(input?.conversationId, "conversationId");
  const entryId = requireString(input?.entryId, "entryId");
  const kind = requireString(input?.kind, "kind");
  const at = typeof input?.at === "string" && input.at ? input.at : new Date().toISOString();
  const text = typeof input?.text === "string" ? input.text : "";
  const toolName = typeof input?.toolName === "string" ? input.toolName : null;
  const payloadJson = JSON.stringify(input?.payload ?? { kind, text, at });
  const projectContextKey = typeof input?.projectContextKey === "string" ? input.projectContextKey : null;
  const model = typeof input?.model === "string" ? input.model : null;

  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db
      .prepare("SELECT seq FROM conversation_entries WHERE entry_id = ?")
      .get(entryId);
    if (existing) {
      db.exec("COMMIT");
      return { seq: Number(existing.seq), inserted: false };
    }
    const next = db
      .prepare("SELECT COALESCE(MAX(seq), -1) + 1 AS seq FROM conversation_entries WHERE conversation_id = ?")
      .get(conversationId);
    const seq = Number(next?.seq ?? 0);
    db.prepare(
      `INSERT INTO conversation_entries
         (entry_id, conversation_id, seq, at, kind, text, tool_name, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(entryId, conversationId, seq, at, kind, text, toolName, payloadJson);

    // 제목은 첫 사용자 발화에서만 정한다 — 이후 턴이 제목을 갈아치우면 목록에서 대화를 못 찾는다.
    db.prepare(
      `INSERT INTO conversations
         (conversation_id, project_context_key, model, title, first_at, last_at, entry_count)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT (conversation_id) DO UPDATE SET
         project_context_key = COALESCE(excluded.project_context_key, conversations.project_context_key),
         model = COALESCE(excluded.model, conversations.model),
         title = CASE
           WHEN conversations.title IS NULL OR conversations.title = '' THEN excluded.title
           ELSE conversations.title
         END,
         last_at = excluded.last_at,
         entry_count = conversations.entry_count + 1`,
    ).run(
      conversationId,
      projectContextKey,
      model,
      kind === "user" ? deriveTitle(text) : null,
      at,
      at,
    );
    db.exec("COMMIT");
    return { seq, inserted: true };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** 최근 대화 요약 목록(본문 제외). */
export function listConversations(db, limit = 20) {
  const n = Math.max(1, Math.min(500, Math.floor(limit)));
  return db
    .prepare(
      `SELECT conversation_id, title, model, project_context_key, first_at, last_at, entry_count
         FROM conversations
        ORDER BY last_at DESC
        LIMIT ?`,
    )
    .all(n);
}

/** 대화 1건의 감사 항목 전체(기록 순서). */
export function readConversationEntries(db, conversationId) {
  return db
    .prepare(
      `SELECT seq, at, kind, text, tool_name, payload_json
         FROM conversation_entries
        WHERE conversation_id = ?
        ORDER BY seq ASC`,
    )
    .all(conversationId);
}
