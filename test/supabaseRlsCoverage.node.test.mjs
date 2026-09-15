// Phase 8 RLS 커버리지 계약 — 등록된 마이그레이션이 만드는 rpg_zzu 테이블은
// auth RLS 마이그레이션에서 RLS 활성 + 4개 동작(SELECT/INSERT/UPDATE/DELETE) 정책을 가져야 한다.
//
// 왜 필요한가(실측): DRAFT_20260706_auth_rls.sql 은 0709(ai_activity_logs) · 0713(ai_conversations,
// user_skills) 보다 먼저 작성돼 세 테이블이 ENABLE ROW LEVEL SECURITY 목록에서 빠져 있었다.
// 초안의 마지막 REVOKE 는 anon 만 막으므로, RLS 가 없는 테이블은 로그인이 붙는 순간
// 아무 authenticated 사용자에게 남의 프로젝트 대화 전문/툴 호출 로그가 열린다.
// 새 테이블이 조용히 같은 구멍을 만들지 못하게 이 테스트가 파일을 파싱해서 막는다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { SUPABASE_MIGRATIONS } from "../scripts/lib/supabase-database-ops.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION_DIR = path.join(ROOT, "supabase", "migrations");
const AUTH_RLS_FILE = "DRAFT_20260706_auth_rls.sql";
const VERBS = ["SELECT", "INSERT", "UPDATE", "DELETE"];

/**
 * anon 에게 권한을 주는 레거시 마이그레이션. 초안 컷오버 이전에 이미 적용됐고
 * 적용기가 sha256 을 기록하므로 파일을 고칠 수 없다 — 새 파일은 이 목록에 추가하지 말고
 * anon GRANT 없이 작성한다.
 */
const LEGACY_ANON_GRANT_FILES = new Set([
  "20260625000000_rpg_zzu_sync.sql",
  "20260701000000_map_edit_locks.sql",
  "20260709000000_ai_activity_logs.sql",
  "20260713000000_ai_conversations_user_skills.sql",
]);

function readMigration(file) {
  return readFileSync(path.join(MIGRATION_DIR, file), "utf8");
}

function executableSql(file) {
  return readMigration(file).replace(/--[^\n]*/gu, "");
}

function createdOprnTables() {
  const tables = new Set();
  for (const { file } of SUPABASE_MIGRATIONS) {
    for (const match of readMigration(file).matchAll(/create table (?:if not exists )?rpg_zzu\.(\w+)/giu)) {
      tables.add(match[1]);
    }
  }
  return tables;
}

function rlsEnabledTables(sql) {
  const tables = new Set();
  for (const match of sql.matchAll(/alter table rpg_zzu\.(\w+)\s+enable row level security/giu)) {
    tables.add(match[1]);
  }
  return tables;
}

function policyVerbsByTable(sql) {
  const verbs = new Map();
  for (const match of sql.matchAll(/create policy \w+ on rpg_zzu\.(\w+)\s+for (\w+)/giu)) {
    const table = match[1];
    if (!verbs.has(table)) verbs.set(table, new Set());
    verbs.get(table).add(match[2].toUpperCase());
  }
  return verbs;
}

test("auth RLS 마이그레이션이 모든 rpg_zzu 테이블에 RLS 를 켠다", () => {
  const sql = readMigration(AUTH_RLS_FILE);
  const enabled = rlsEnabledTables(sql);
  const missing = [...createdOprnTables()].filter((table) => !enabled.has(table)).sort();
  assert.deepEqual(missing, [], `RLS 미적용 테이블: ${missing.join(", ")}`);
});

test("auth RLS 마이그레이션이 테이블마다 4개 동작 정책을 갖춘다", () => {
  const sql = readMigration(AUTH_RLS_FILE);
  const verbs = policyVerbsByTable(sql);
  const gaps = [];
  for (const table of [...createdOprnTables()].sort()) {
    const covered = verbs.get(table) ?? new Set();
    const missing = VERBS.filter((verb) => !covered.has(verb));
    if (missing.length > 0) gaps.push(`${table}: ${missing.join("/")}`);
  }
  assert.deepEqual(gaps, [], `정책 누락: ${gaps.join(" | ")}`);
});

test("초안 컷오버 이후 새 마이그레이션은 anon 에게 권한을 주지 않는다", () => {
  const offenders = SUPABASE_MIGRATIONS.filter(({ file }) => {
    if (LEGACY_ANON_GRANT_FILES.has(file)) return false;
    return /\bgrant\b[^;]*\banon\b/isu.test(executableSql(file));
  }).map(({ file }) => file);
  assert.deepEqual(offenders, [], `anon 에게 GRANT 하는 신규 마이그레이션: ${offenders.join(", ")}`);
});
