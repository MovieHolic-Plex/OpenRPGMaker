#!/usr/bin/env node
// AI activity: local disk mirror and explicitly selected SQLite project.
// --project-dir <folder> [--run <id>] [limit] [--failed] [--issues] [--tools]
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { openProjectLogReader, projectDirArgument } from "./lib/project-log-reader.mjs";

const DIR = join(process.cwd(), "output", "ai-activity");

function listProject(projectDir, limit, runId) {
  const db = openProjectLogReader(projectDir);
  try {
    const query = `SELECT log_id, run_id, channel, instruction, map_id, payload_json, created_at FROM ai_activity_logs
      ${runId ? 'WHERE run_id = ?' : ''} ORDER BY created_at DESC LIMIT ?`;
    return db.prepare(query).all(...(runId ? [runId, limit] : [limit])).map(row => ({
      ...row, payload_json: row.payload_json ? JSON.parse(row.payload_json) : null,
    }));
  } finally { db.close(); }
}

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
    ...(record.result?.recap
      ? {
          elapsedMs: record.result.recap.elapsedMs,
          promptTokens: record.result.recap.promptTokens,
          completionTokens: record.result.recap.completionTokens,
          llmCalls: record.result.recap.llmCalls,
        }
      : {}),
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
const runIdIndex = args.indexOf("--run");
const runId = runIdIndex >= 0 ? (args[runIdIndex + 1] ?? "") : "";
// `--run <id>` 의 값이 숫자로 오해되지 않게 limit 탐색에서 제외한다.
const positional = args.filter((value, index) => index !== runIdIndex && index !== runIdIndex + 1);
const limit = Math.max(1, Math.min(1000, Number(positional.find((a) => /^\d+$/.test(a)) ?? 10)));
const onlyFailed = args.includes("--failed");
const onlyIssues = args.includes("--issues");
const withTools = args.includes("--tools");
// 런 필터는 선택한 프로젝트의 기록에 적용한다.
const projectDir = projectDirArgument(args);
if (args.includes("--remote")) throw new Error("Use --project-dir <folder> for stored AI activity");
if (runId && !projectDir) throw new Error("--run requires --project-dir or OPRN_PROJECT_DIR");

const disk = listDisk(limit);
let rows = disk.rows;
if (onlyFailed) rows = rows.filter((row) => row.ok === false || (row.failedTools ?? []).length > 0);
if (onlyIssues) rows = rows.filter((row) => row.diagnostics?.severity !== "ok");
rows = rows.slice(0, limit);
if (withTools) rows = rows.map((row) => ({ ...row, failures: failedToolDetail(row.id) }));

const out = {
  disk: { dir: DIR, count: rows.length, ...(disk.error ? { error: disk.error } : {}), rows },
};
if (projectDir) out.project = { projectDir, rows: listProject(projectDir, limit, runId) };
console.log(JSON.stringify(out, null, 2));
