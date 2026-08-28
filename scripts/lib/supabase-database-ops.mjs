import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const MIGRATION_DIR = path.join("supabase", "migrations");

export const SUPABASE_MIGRATIONS = Object.freeze([
  migration("20260625000000_rpg_zzu_sync.sql", [
    relation("rpg_zzu", "projects"),
    relation("rpg_zzu", "project_commits"),
    relation("rpg_zzu", "project_changes"),
    relation("rpg_zzu", "maps"),
    relation("rpg_zzu", "tilesets"),
    relation("rpg_zzu", "terrain_templates"),
    relation("rpg_zzu", "sync_verification_runs"),
    relation("rpg_zzu", "ai_analysis_runs"),
  ]),
  migration("20260701000000_map_edit_locks.sql", [relation("rpg_zzu", "map_edit_locks")]),
  migration("20260706000000_commit_identity.sql", [relation("rpg_zzu", "project_commits", [
    "summary",
    "review_status",
    "author_id",
    "author_label",
    "author_kind",
    "agent_name",
  ])]),
  migration("20260709000000_ai_activity_logs.sql", [relation("rpg_zzu", "ai_activity_logs")]),
  migration("20260713000000_ai_conversations_user_skills.sql", [
    relation("rpg_zzu", "ai_conversations"),
    relation("rpg_zzu", "user_skills"),
  ]),
  migration("20260814000000_benchmark_runs.sql", [relation("public", "benchmark_runs")]),
  migration("20260827000000_ai_log_anon_delete_revoke.sql", [
    revoked("rpg_zzu", "ai_activity_logs", "anon", "DELETE"),
    revoked("rpg_zzu", "ai_conversations", "anon", "DELETE"),
    revoked("rpg_zzu", "ai_analysis_runs", "anon", "DELETE"),
  ]),
  migration("20260829000000_ai_activity_run_id.sql", [
    relation("rpg_zzu", "ai_activity_logs", ["run_id"]),
  ]),
  migration("20260829000001_anon_privilege_tighten.sql", [
    revoked("rpg_zzu", "projects", "anon", "DELETE"),
    revoked("rpg_zzu", "project_commits", "anon", "DELETE"),
    revoked("rpg_zzu", "project_changes", "anon", "DELETE"),
    revoked("rpg_zzu", "terrain_templates", "anon", "DELETE"),
    revoked("rpg_zzu", "sync_verification_runs", "anon", "DELETE"),
    revoked("rpg_zzu", "user_skills", "anon", "DELETE"),
    revoked("rpg_zzu", "project_commits", "anon", "UPDATE"),
    revoked("rpg_zzu", "project_changes", "anon", "UPDATE"),
  ]),
]);

export const DEFAULT_AI_PROBE_IDS = Object.freeze({
  activityId: "00000000-0000-4000-8000-00000000a101",
  conversationId: "schema-probe-conversation",
});

function grantKey(schema, table, role, privilege) {
  return `${schema}.${table}.${role}.${String(privilege).toUpperCase()}`;
}

function relation(schema, table, columns = []) {
  return Object.freeze({ kind: "relation", schema, table, columns: Object.freeze(columns) });
}

function revoked(schema, table, role, privilege) {
  return Object.freeze({ kind: "revoked-privilege", schema, table, role, privilege, columns: Object.freeze([]) });
}

function migration(file, contracts) {
  return Object.freeze({ file, contracts: Object.freeze(contracts) });
}

export function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    values[match[1]] = value;
  }
  return values;
}

export function loadSupabaseEnvironment(root = process.cwd(), processValues = process.env) {
  const values = {};
  for (const name of [".env", ".env.local"]) {
    const file = path.join(root, name);
    if (existsSync(file)) Object.assign(values, parseEnv(readFileSync(file, "utf8")));
  }
  for (const [key, value] of Object.entries(processValues)) {
    if (value !== undefined && value !== "") values[key] = value;
  }
  return values;
}

export function listUntrackedMigrationFiles(root = process.cwd()) {
  const directory = path.join(root, MIGRATION_DIR);
  const tracked = new Set(SUPABASE_MIGRATIONS.map((entry) => entry.file));
  return readdirSync(directory)
    .filter((file) => file.endsWith(".sql") && !file.startsWith("DRAFT_") && !tracked.has(file))
    .sort();
}

export function migrationPlan(migrations, appliedChecksums, contractStates) {
  return migrations.map((entry) => {
    const state = contractStates[entry.file];
    if (appliedChecksums.has(entry.file)) {
      if (state !== "complete") throw new Error(`${entry.file} schema drift detected after migration was recorded`);
      return { ...entry, action: "skip" };
    }
    if (state === "complete") return { ...entry, action: "baseline" };
    if (state === "missing") return { ...entry, action: "apply" };
    if (state === "partial") {
      throw new Error(`${entry.file} is partially applied; refusing to replay migration SQL`);
    }
    throw new Error(`No schema contract state was provided for ${entry.file}`);
  });
}

export function catalogMigrationStates(migrations, columnRows, grantRows = []) {
  const catalog = new Map();
  for (const row of columnRows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!catalog.has(key)) catalog.set(key, new Set());
    catalog.get(key).add(row.column_name);
  }
  const grants = new Set(grantRows.map((row) => grantKey(row.table_schema, row.table_name, row.grantee, row.privilege_type)));
  return Object.fromEntries(migrations.map((entry) => {
    const contractStates = entry.contracts.map((contract) => {
      if (contract.kind === "revoked-privilege") {
        return grants.has(grantKey(contract.schema, contract.table, contract.role, contract.privilege)) ? "missing" : "complete";
      }
      const columns = catalog.get(`${contract.schema}.${contract.table}`);
      if (!columns) return "missing";
      return contract.columns.every((column) => columns.has(column)) ? "complete" : "partial";
    });
    const state = contractStates.every((value) => value === "complete")
      ? "complete"
      : contractStates.every((value) => value === "missing")
        ? "missing"
        : "partial";
    return [entry.file, state];
  }));
}

/**
 * AI 활동 로그 조회 URL. `options.runId` 를 주면 그 런의 턴만 본다 — 같은 project_id 를
 * 여러 워크트리·탭이 공유하므로 필터 없는 최신 정렬은 옆 런의 턴을 준다.
 * 폴백 테이블(ai_analysis_runs)에는 런 정보가 없어서 run 필터가 있으면 폴백 URL 은 null 이다.
 */
export function buildAiActivityUrls(config, limit, options = {}) {
  const base = config.url.replace(/\/$/, "");
  const count = Math.max(1, Math.min(100, Math.floor(limit)));
  const runId = options.runId ? String(options.runId) : "";
  const primary = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    // run_id 는 20260829000000 이후에만 있다 — 필터를 걸 때만 select 에 넣어 미적용 DB 에서
    // 목록이 통째로 400 나지 않게 한다.
    select: runId
      ? "log_id,run_id,channel,instruction,map_id,created_at"
      : "log_id,channel,instruction,map_id,created_at",
    order: "created_at.desc",
    limit: String(count),
    ...(runId ? { run_id: `eq.${runId}` } : {}),
  });
  const fallback = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    tileset_id: "eq.__ai_activity__",
    select: "run_id,prompt_context_json,created_at",
    order: "created_at.desc",
    limit: String(count),
  });
  return {
    primary: `${base}/rest/v1/ai_activity_logs?${primary.toString()}`,
    fallback: runId ? null : `${base}/rest/v1/ai_analysis_runs?${fallback.toString()}`,
  };
}

export async function probeSupabaseSchema(config, fetchImplementation = fetch) {
  const states = {};
  const details = {};
  for (const entry of SUPABASE_MIGRATIONS) {
    const contractStates = [];
    for (const contract of entry.contracts.filter((item) => item.kind === "relation")) {
      const state = await probeContract(config, contract, fetchImplementation);
      contractStates.push(state);
      details[`${contract.schema}.${contract.table}`] = state;
    }
    states[entry.file] = contractStates.every((state) => state === "complete")
      ? "complete"
      : contractStates.every((state) => state === "missing")
        ? "missing"
        : "partial";
  }
  return { states, details };
}

async function probeContract(config, contract, fetchImplementation) {
  const base = config.url.replace(/\/$/, "");
  const params = new URLSearchParams({
    select: contract.columns.length > 0 ? contract.columns.join(",") : "*",
    limit: "0",
  });
  const headers = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    Accept: "application/json",
    "Accept-Profile": contract.schema,
  };
  const response = await fetchImplementation(`${base}/rest/v1/${contract.table}?${params.toString()}`, { headers });
  if (response.ok) return "complete";
  const body = await response.text();
  if (response.status === 404 || body.includes("PGRST205")) return "missing";
  if (response.status === 400 && (body.includes("PGRST204") || contract.columns.length > 0)) return "partial";
  throw new Error(`Supabase schema probe failed for ${contract.schema}.${contract.table}: HTTP ${response.status}`);
}

export async function verifyAiPersistence(config, fetchImplementation = fetch, ids = {}) {
  const activityId = ids.activityId ?? DEFAULT_AI_PROBE_IDS.activityId;
  const conversationId = ids.conversationId ?? DEFAULT_AI_PROBE_IDS.conversationId;
  const base = config.url.replace(/\/$/, "");
  const readHeaders = supabaseHeaders(config, "read");
  const writeHeaders = supabaseHeaders(config, "write");
  let activityInserted = false;
  let conversationInserted = false;
  let completed = false;
  let probeRetained = false;
  try {
    await expectResponse(fetchImplementation(`${base}/rest/v1/ai_activity_logs?on_conflict=log_id`, {
      method: "POST",
      headers: { ...writeHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        log_id: activityId,
        project_id: config.projectId,
        channel: "schema-verification",
        instruction: "Supabase AI persistence verification",
        map_id: null,
        payload_json: { kind: "schema-verification" },
      }),
    }), "insert ai_activity_logs probe");
    activityInserted = true;

    await expectResponse(fetchImplementation(`${base}/rest/v1/ai_conversations?on_conflict=conversation_id`, {
      method: "POST",
      headers: { ...writeHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        conversation_id: conversationId,
        project_id: config.projectId,
        title: "Supabase schema verification",
        model: "database-preflight",
        project_context_key: null,
        entries_json: [],
        saved_at: new Date().toISOString(),
      }),
    }), "insert ai_conversations probe");
    conversationInserted = true;

    const activityParams = new URLSearchParams({
      project_id: `eq.${config.projectId}`,
      log_id: `eq.${activityId}`,
      select: "log_id",
      limit: "1",
    });
    const conversationParams = new URLSearchParams({
      project_id: `eq.${config.projectId}`,
      conversation_id: `eq.${conversationId}`,
      select: "conversation_id",
      limit: "1",
    });
    const activityRows = await readRows(fetchImplementation(`${base}/rest/v1/ai_activity_logs?${activityParams}`, {
      headers: readHeaders,
    }), "reload ai_activity_logs probe");
    const conversationRows = await readRows(fetchImplementation(`${base}/rest/v1/ai_conversations?${conversationParams}`, {
      headers: readHeaders,
    }), "reload ai_conversations probe");
    if (activityRows.length === 0 || conversationRows.length === 0) {
      throw new Error("Supabase AI persistence probe was inserted but could not be reloaded");
    }
    completed = true;
    return {
      activityId,
      conversationId,
      activityReloaded: true,
      conversationReloaded: true,
      get probeRetained() {
        return probeRetained;
      },
    };
  } finally {
    const cleanup = [];
    if (activityInserted) {
      const params = new URLSearchParams({ project_id: `eq.${config.projectId}`, log_id: `eq.${activityId}` });
      cleanup.push(deleteProbeRow(fetchImplementation(`${base}/rest/v1/ai_activity_logs?${params}`, {
        method: "DELETE",
        headers: writeHeaders,
      }), "remove ai_activity_logs probe"));
    }
    if (conversationInserted) {
      const params = new URLSearchParams({
        project_id: `eq.${config.projectId}`,
        conversation_id: `eq.${conversationId}`,
      });
      cleanup.push(deleteProbeRow(fetchImplementation(`${base}/rest/v1/ai_conversations?${params}`, {
        method: "DELETE",
        headers: writeHeaders,
      }), "remove ai_conversations probe"));
    }
    const results = await Promise.allSettled(cleanup);
    if (results.some((result) => result.status === "fulfilled" && result.value === "denied")) probeRetained = true;
    if (completed) {
      const cleanupFailure = results.find((result) => result.status === "rejected");
      if (cleanupFailure?.status === "rejected") throw cleanupFailure.reason;
    }
  }
}

function supabaseHeaders(config, mode) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    [mode === "write" ? "Content-Profile" : "Accept-Profile"]: "rpg_zzu",
  };
}

/**
 * anon 은 AI 로그·대화 테이블의 DELETE 권한이 없다(20260827 마이그레이션). 그 경우 프로브 행은
 * 고정 id 로 남고 다음 실행이 upsert 로 덮으므로 실패가 아니다 — 관리자 경로가 정리한다.
 */
async function deleteProbeRow(responsePromise, operation) {
globalThis.response = await responsePromise;
  if (response.ok) return "removed";
  if (response.status === 401 || response.status === 403) return "denied";
  throw new Error(`${operation} failed: HTTP ${response.status} ${await response.text()}`);
}

async function expectResponse(responsePromise, operation) {
  const response = await responsePromise;
  if (!response.ok) throw new Error(`${operation} failed: HTTP ${response.status} ${await response.text()}`);
  return response;
}

async function readRows(responsePromise, operation) {
  const response = await expectResponse(responsePromise, operation);
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}
