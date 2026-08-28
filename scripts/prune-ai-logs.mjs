#!/usr/bin/env node
// AI 로그 보존정책 — N일보다 오래된 ai_activity_logs / ai_conversations 행을 지운다.
//
// 왜 필요한가(실측 2026-08-29): 로컬 링버퍼는 활동로그 100 / 대화 50 에서 알아서 잘리는데
// DB 는 상한이 없다. 5일에 12,735행 페이스라 방치하면 계속 누적된다. 게다가 그 대부분이
// e2e 픽스처가 찍은 고정 문자열이다(dungeon-example 2,566턴 · house-template-gallery 2,553턴).
//
// service_role 키가 필요하다 — 20260827/20260829 마이그레이션이 anon 에서 DELETE 를 회수했다.
// anon 키로 돌리면 PostgREST 가 조용히 0행을 지우므로, 아래에서 키 종류를 먼저 검사한다.
//
// 사용법:
//   node scripts/prune-ai-logs.mjs --days 30 [--dry-run] [--project <id>] [--table activity|conversations|both]
//   npm run db:prune-ai-logs -- --days 30 --dry-run
import { loadSupabaseEnvironment } from "./lib/supabase-database-ops.mjs";

const SCHEMA = "rpg_zzu";
const TABLES = {
  activity: { name: "ai_activity_logs", timeColumn: "created_at", idColumn: "log_id" },
  conversations: { name: "ai_conversations", timeColumn: "saved_at", idColumn: "conversation_id" },
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const value = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const rawDays = value("--days") ?? "30";
  const days = Number(rawDays);
  if (!Number.isFinite(days) || days < 1) {
    throw new Error(`--days 는 1 이상의 숫자여야 한다 (받은 값: ${rawDays})`);
  }
  const table = value("--table") ?? "both";
  if (!["activity", "conversations", "both"].includes(table)) {
    throw new Error(`--table 은 activity|conversations|both 중 하나여야 한다 (받은 값: ${table})`);
  }
  return {
    days,
    table,
    dryRun: args.includes("--dry-run"),
    projectId: value("--project"),
  };
}

/**
 * service_role 키인지 확인한다. Supabase JWT 의 payload 에 role 이 들어 있다.
 * 형식이 JWT 가 아니면(자체 발급 PostgREST 키 등) 판별 불가로 두고 경고만 한다.
 */
function keyRole(key) {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function baseUrl(env) {
  // 프록시 모드(VITE_SUPABASE_URL=/supabase)에서도 스크립트는 노드에서 직접 붙어야 하므로
  // 절대 URL 을 요구한다. SUPABASE_UPSTREAM_URL 이 그 값이다(vite.config.ts 와 같은 규약).
  const candidates = [env.SUPABASE_UPSTREAM_URL, env.SUPABASE_URL, env.VITE_SUPABASE_URL];
  for (const candidate of candidates) {
    const url = (candidate ?? "").trim().replace(/\/$/, "");
    if (/^https?:\/\//.test(url)) return url;
  }
  return "";
}

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Accept-Profile": SCHEMA,
    "Content-Profile": SCHEMA,
    ...extra,
  };
}

/** 지울 대상 건수. created_at 인덱스가 덮는 단일 범위 조건이라 count 가 싸다. */
async function countOlderThan(url, key, table, cutoff, projectId) {
  const params = new URLSearchParams({ select: table.idColumn, [table.timeColumn]: `lt.${cutoff}` });
  if (projectId) params.set("project_id", `eq.${projectId}`);
  const response = await fetch(`${url}/rest/v1/${table.name}?${params.toString()}`, {
    headers: headers(key, { Prefer: "count=exact", Range: "0-0", "Range-Unit": "items" }),
  });
  if (!response.ok) {
    throw new Error(`count 실패 ${table.name}: ${response.status} ${await response.text()}`);
  }
  const range = response.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

async function deleteOlderThan(url, key, table, cutoff, projectId) {
  const params = new URLSearchParams({ [table.timeColumn]: `lt.${cutoff}` });
  if (projectId) params.set("project_id", `eq.${projectId}`);
  const response = await fetch(`${url}/rest/v1/${table.name}?${params.toString()}`, {
    method: "DELETE",
    headers: headers(key, { Prefer: "count=exact", "Range-Unit": "items" }),
  });
  if (!response.ok) {
    throw new Error(`DELETE 실패 ${table.name}: ${response.status} ${await response.text()}`);
  }
  const range = response.headers.get("content-range") ?? "";
  const deleted = Number(range.split("/")[0]?.split("-")[1]);
  return Number.isFinite(deleted) ? deleted + 1 : null;
}

const options = parseArgs(process.argv);
const env = loadSupabaseEnvironment();
const url = baseUrl(env);
const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!url) {
  console.error("절대 URL 이 없다 — SUPABASE_UPSTREAM_URL 또는 VITE_SUPABASE_URL 을 절대 URL 로 설정하라.");
  process.exit(1);
}
if (!key) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY 가 없다. anon 은 이 두 테이블에서 DELETE 권한이 회수됐으므로\n" +
      "(20260827000000 / 20260829000001) service_role 키가 필요하다. .env.local 에 넣어라.",
  );
  process.exit(1);
}
const role = keyRole(key);
if (role && role !== "service_role") {
  console.error(`SUPABASE_SERVICE_ROLE_KEY 의 role 이 "${role}" 이다 — service_role 키가 필요하다.`);
  process.exit(1);
}
if (!role) {
  console.warn("[prune-ai-logs] 키 형식이 JWT 가 아니라 role 을 확인할 수 없다 — 권한 부족이면 0행이 지워진다.");
}

const cutoff = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString();
const targets = options.table === "both" ? ["activity", "conversations"] : [options.table];

console.log(
  `[prune-ai-logs] ${options.dryRun ? "DRY-RUN " : ""}cutoff=${cutoff} (${options.days}일)` +
    `${options.projectId ? ` project=${options.projectId}` : " 전체 프로젝트"}`,
);

let exitCode = 0;
for (const name of targets) {
  const table = TABLES[name];
  try {
    const count = await countOlderThan(url, key, table, cutoff, options.projectId);
    if (options.dryRun) {
      console.log(`  ${table.name}: 대상 ${count ?? "?"}행 (dry-run — 지우지 않음)`);
      continue;
    }
    if (count === 0) {
      console.log(`  ${table.name}: 대상 0행`);
      continue;
    }
    const deleted = await deleteOlderThan(url, key, table, cutoff, options.projectId);
    console.log(`  ${table.name}: 대상 ${count ?? "?"}행 → 삭제 ${deleted ?? "?"}행`);
  } catch (error) {
    exitCode = 1;
    console.error(`  ${table.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(exitCode);
