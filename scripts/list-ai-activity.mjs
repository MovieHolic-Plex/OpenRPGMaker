#!/usr/bin/env node
// 최근 AI 활동 로그 조회 — 디스크(output/ai-activity/) 우선, 필요하면 Supabase.
//
// 사용법:
//   node scripts/list-ai-activity.mjs [limit] [--failed] [--tools] [--remote]
//     --failed  실패한 턴만 (result.ok === false 또는 ok:false 툴콜 존재)
//     --tools   실패 툴콜의 이름·요약·이슈까지 펼쳐 본다 (툴콜링 실패 원인 분류용)
//     --remote  Supabase 도 함께 조회 (기본은 디스크만 — 로컬 QA 가 대부분)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "output", "ai-activity");

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function listRemote(env, limit) {
  const url = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) return { error: "no supabase env" };
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Accept-Profile": "rpg_zzu",
  };
  let primary = [];
  try {
    const r = await fetch(
      `${url}/rest/v1/ai_activity_logs?select=log_id,channel,instruction,map_id,created_at&order=created_at.desc&limit=${limit}`,
      { headers },
    );
    if (r.ok) primary = await r.json();
    else primary = { status: r.status, body: await r.text() };
  } catch (e) {
    primary = { error: String(e) };
  }
  let fallback = [];
  try {
    const r = await fetch(
      `${url}/rest/v1/ai_analysis_runs?tileset_id=eq.__ai_activity__&select=run_id,prompt_context_json,created_at&order=created_at.desc&limit=${limit}`,
      { headers },
    );
    if (r.ok) {
      const rows = await r.json();
      fallback = rows.map((row) => ({
        log_id: row.run_id,
        channel: row.prompt_context_json?.channel,
        instruction: row.prompt_context_json?.instruction,
        map_id: row.prompt_context_json?.mapId,
        created_at: row.created_at,
        source: "fallback",
      }));
    } else {
      fallback = { status: r.status, body: await r.text() };
    }
  } catch (e) {
    fallback = { error: String(e) };
  }
  return { primary, fallback };
}

/** 디스크 요약 목록. index.json 이 없거나 깨졌으면 개별 레코드에서 직접 요약을 만든다. */
function listDisk(limit) {
  if (!existsSync(DIR)) {
    return {
      error: `${DIR} 없음 — dev 서버(npm run dev)로 AI 턴을 한 번 돌려야 미러가 생긴다.`,
      rows: [],
    };
  }
  const indexPath = join(DIR, "index.json");
  if (existsSync(indexPath)) {
    try {
      const rows = JSON.parse(readFileSync(indexPath, "utf8"));
      // 예전 미러는 요약에 ok/failedTools 가 없다 — 그런 행은 레코드에서 보강한다.
      return { rows: rows.map((row) => (row.ok === undefined ? summarize(readRecord(row.id)) ?? row : row)) };
    } catch {
      /* fall through to per-file scan */
    }
  }
  const ids = readdirSync(DIR)
    .filter((f) => f.endsWith(".json") && f !== "index.json" && f !== "latest.json")
    .map((f) => f.replace(/\.json$/, ""));
  const rows = ids.map((id) => summarize(readRecord(id))).filter(Boolean);
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { rows: rows.slice(0, limit) };
}

function readRecord(id) {
  if (typeof id !== "string") return null;
  const path = join(DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function summarize(record) {
  if (!record) return null;
  const failedTools = (record.toolCalls ?? []).filter((call) => call.ok === false).map((call) => call.name ?? "?");
  return {
    id: record.id,
    at: record.at,
    channel: record.channel,
    ok: record.result?.ok !== false,
    instruction: record.instruction ?? "",
    ...(record.result?.error ? { error: record.result.error } : {}),
    ...(record.result?.stoppedReason ? { stoppedReason: record.result.stoppedReason } : {}),
    toolCalls: (record.toolCalls ?? []).length,
    ...(failedTools.length > 0 ? { failedTools } : {}),
  };
}

/** 실패 툴콜의 실제 사유 — args·summary·issues 까지. 실패 유형 분류가 목적이다. */
function failedToolDetail(id) {
  const record = readRecord(id);
  if (!record) return [];
  const fromAudit = (record.audit ?? []).filter((entry) => entry.kind === "tool" && entry.ok === false);
  const source = fromAudit.length > 0 ? fromAudit : (record.toolCalls ?? []).filter((call) => call.ok === false);
  return source.map((entry) => ({
    name: entry.name,
    summary: entry.summary,
    issues: entry.issues ?? [],
    args: entry.args,
  }));
}

const args = process.argv.slice(2);
const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);
const onlyFailed = args.includes("--failed");
const withTools = args.includes("--tools");
const withRemote = args.includes("--remote");

const disk = listDisk(limit);
let rows = disk.rows;
if (onlyFailed) rows = rows.filter((row) => row.ok === false || (row.failedTools ?? []).length > 0);
rows = rows.slice(0, limit);
if (withTools) rows = rows.map((row) => ({ ...row, failures: failedToolDetail(row.id) }));

const out = {
  disk: { dir: DIR, count: rows.length, ...(disk.error ? { error: disk.error } : {}), rows },
};
if (withRemote) out.remote = await listRemote(loadEnvLocal(), limit);
console.log(JSON.stringify(out, null, 2));
