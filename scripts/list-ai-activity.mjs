#!/usr/bin/env node
// 최근 AI 활동 로그 조회 — 디스크(output/ai-activity/) 우선, 필요하면 Supabase.
//
// 사용법:
//   node scripts/list-ai-activity.mjs [limit] [--failed] [--issues] [--tools] [--remote]
//     --failed  실패한 턴만 (result.ok === false 또는 ok:false 툴콜 존재)
//     --issues  실패 + 플래너 폴백·의도 재질문·WorkPlan 거부 경고까지
//     --tools   실패 툴콜의 이름·요약·이슈까지 펼쳐 본다 (툴콜링 실패 원인 분류용)
//     --remote  Supabase 도 함께 조회 (기본은 디스크만 — 로컬 QA 가 대부분)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildAiActivityUrls, loadSupabaseEnvironment } from "./lib/supabase-database-ops.mjs";

const DIR = join(process.cwd(), "output", "ai-activity");

async function listRemote(env, limit) {
  const url = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.VITE_SUPABASE_ANON_KEY || "";
  const projectId = env.VITE_SUPABASE_PROJECT_ID || "";
  if (!url || !key || !projectId) return { error: "no supabase env or project id" };
  const urls = buildAiActivityUrls({ url, projectId }, limit);
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Accept-Profile": "rpg_zzu",
  };
  let primary = [];
  try {
    const r = await fetch(
      urls.primary,
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
      urls.fallback,
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
      // 예전 미러는 요약에 diagnostics 가 없다 — 그런 행은 개별 레코드에서 보강한다.
      return {
        rows: rows.map((row) => (
          row.ok === undefined || row.diagnostics === undefined
            ? summarize(readRecord(row.id)) ?? row
            : row
        )),
      };
    } catch {
      /* fall through to per-file scan */
    }
  }
  const ids = readdirSync(DIR)
    .filter((f) => f.endsWith(".json") && f !== "index.json" && f !== "latest.json")
    .map((f) => f.replace(/\.json$/, ""));
  const rows = ids.map((id) => summarize(readRecord(id))).filter(Boolean);
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { rows };
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
  const diagnostics = record.diagnostics ?? deriveDiagnostics(record);
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
    diagnostics,
  };
}

function deriveDiagnostics(record) {
  const kinds = new Set();
  const messages = [];
  const failedTools = new Set();
  if (record.result?.ok === false) {
    kinds.add("turn-error");
    messages.push(record.result.error ?? `턴 실패: ${record.result.stoppedReason ?? "unknown"}`);
  }
  for (const call of record.toolCalls ?? []) {
    if (call.ok !== false) continue;
    kinds.add("tool-failure");
    failedTools.add(call.name ?? "?");
    if (call.name === "complete_work_item" || call.name === "skip_work_item") kinds.add("work-plan");
    messages.push(`${call.name ?? "?"}: ${call.summary ?? "도구 호출 실패"}`);
  }
  for (const entry of record.audit ?? []) {
    if (entry.kind === "tool" && entry.ok === false) {
      kinds.add("tool-failure");
      failedTools.add(entry.name ?? "?");
      if (entry.name === "complete_work_item" || entry.name === "skip_work_item") kinds.add("work-plan");
      continue;
    }
    if (entry.kind !== "status") continue;
    const text = entry.text ?? "";
    let matched = false;
    if (/planner:(?:parse-fail|error)|폴백 계획/u.test(text)) { kinds.add("planner-fallback"); matched = true; }
    if (/의도 확인\(/u.test(text)) { kinds.add("intent-clarification"); matched = true; }
    if (/^(?:WorkPlan|완료 게이트).*?(?:실패|거부)/iu.test(text)) { kinds.add("work-plan"); matched = true; }
    if (matched) messages.push(text);
  }
  const severity = kinds.has("turn-error") || kinds.has("tool-failure") ? "error" : kinds.size > 0 ? "warning" : "ok";
  return { severity, kinds: [...kinds], messages: [...new Set(messages)].slice(0, 20), failedTools: [...failedTools] };
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
const onlyIssues = args.includes("--issues");
const withTools = args.includes("--tools");
const withRemote = args.includes("--remote");

const disk = listDisk(limit);
let rows = disk.rows;
if (onlyFailed) rows = rows.filter((row) => row.ok === false || (row.failedTools ?? []).length > 0);
if (onlyIssues) rows = rows.filter((row) => row.diagnostics?.severity !== "ok");
rows = rows.slice(0, limit);
if (withTools) rows = rows.map((row) => ({ ...row, failures: failedToolDetail(row.id) }));

const out = {
  disk: { dir: DIR, count: rows.length, ...(disk.error ? { error: disk.error } : {}), rows },
};
if (withRemote) out.remote = await listRemote(loadSupabaseEnvironment(), limit);
console.log(JSON.stringify(out, null, 2));
