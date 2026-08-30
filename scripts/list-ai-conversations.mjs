#!/usr/bin/env node
// 로컬 SQLite 대화 미러 열람 — `npm run chat:log [conversationId] [--limit N]`
//
// 인자 없이 실행하면 최근 대화 목록, conversation id 를 주면 그 대화의 감사 항목을 순서대로 찍는다.
// dev 서버가 쓰는 중에도 읽힌다(WAL).

import { existsSync } from "node:fs";
import {
  defaultConversationDbPath,
  listConversations,
  openConversationDb,
  readConversationEntries,
} from "./lib/aiConversationSqlite.mjs";

const args = process.argv.slice(2);
const limitIndex = args.findIndex((arg) => arg === "--limit");
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1] ?? 20) : 20;
const conversationId = args.find((arg) => !arg.startsWith("--") && arg !== String(limit));

const dbPath = defaultConversationDbPath();
if (!existsSync(dbPath)) {
  console.error(`대화 미러 DB가 없다: ${dbPath}\n에디터에서 AI 채팅을 한 번 보내면 생성된다.`);
  process.exit(1);
}

const db = openConversationDb(dbPath);
try {
  if (conversationId) {
    const entries = readConversationEntries(db, conversationId);
    if (entries.length === 0) {
      console.error(`항목 없음: ${conversationId}`);
      process.exit(1);
    }
    for (const entry of entries) {
      const head = `#${entry.seq} ${entry.at} ${entry.kind}${entry.tool_name ? `:${entry.tool_name}` : ""}`;
      console.log(`${head}\n${(entry.text ?? "").trim()}\n`);
    }
  } else {
    const rows = listConversations(db, limit);
    if (rows.length === 0) {
      console.log("기록된 대화가 없다.");
    }
    for (const row of rows) {
      console.log(
        `${row.last_at}  ${row.entry_count.toString().padStart(4)}건  ${row.conversation_id}  ${row.title ?? ""}`,
      );
    }
  }
} finally {
  db.close();
}
