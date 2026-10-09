#!/usr/bin/env node
// Saved commit diagnostics: --project-dir <folder> [--limit n] [--edits] [--origin kind] [--map id] [--json].
import { openProjectLogReader, projectDirArgument } from "./lib/project-log-reader.mjs";
import { describeEdit, pad, stampOf } from "./lib/terminal-table.mjs";

const args = process.argv.slice(2);

function flagValue(name) {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? "") : "";
}

const consumed = new Set();
for (const name of ["limit", "origin", "map", "project-dir"]) {
  const at = args.indexOf(`--${name}`);
  if (at >= 0) {
    consumed.add(at);
    consumed.add(at + 1);
  }
}
const positional = args.filter((value, index) => !consumed.has(index) && !value.startsWith("--"));
const limitRaw = flagValue("limit") || positional.find((value) => /^\d+$/.test(value)) || "20";
const limit = Math.max(1, Math.min(100, Number(limitRaw) || 20));
const origin = flagValue("origin");
const mapId = flagValue("map");
const withEdits = args.includes("--edits");
const asJson = args.includes("--json");

const db = openProjectLogReader(projectDirArgument(args));
let rows; let projectId;
try {
  projectId = db.prepare("SELECT value FROM meta WHERE key='project_id'").get()?.value;
  rows = db.prepare(`SELECT * FROM commits ORDER BY created_at DESC LIMIT ?`).all(limit).map(row => ({
    ...row, project_changes: db.prepare('SELECT patch_json FROM changes WHERE commit_id=?').all(row.commit_id)
      .map(change => ({ patch_json: change.patch_json ? JSON.parse(change.patch_json) : null })),
  }));
} finally { db.close(); }

function normalize(row) {
  const patch = row.project_changes?.[0]?.patch_json ?? {};
  const edits = Array.isArray(patch.edits) ? patch.edits : [];
  return {
    commitId: row.commit_id,
    at: row.created_at,
    summary: row.summary ?? "",
    reviewStatus: row.review_status ?? "",
    author: row.agent_name || row.author_label || row.author_kind || "",
    authorKind: row.author_kind ?? "",
    toolNames: patch.toolNames ?? [],
    diff: patch.diff ?? null,
    edits,
    editsOmitted: patch.editsOmitted ?? 0,
  };
}

let commits = rows.map(normalize);
if (origin) commits = commits.filter((commit) => commit.edits.some((edit) => (edit.origin ?? "human") === origin));
if (mapId) commits = commits.filter((commit) => commit.edits.some((edit) => edit.mapId === mapId));

if (asJson) {
  console.log(JSON.stringify({ projectId, count: commits.length, commits }, null, 2));
  process.exit(0);
}

if (commits.length === 0) {
  console.log(`조건에 맞는 커밋이 없다 (project=${projectId}, 최근 ${limit}건 조회).`);
  if (origin || mapId) console.log(`필터: ${[origin && `origin=${origin}`, mapId && `map=${mapId}`].filter(Boolean).join(" ")}`);
  process.exit(0);
}

console.log(`project=${projectId} — 커밋 ${commits.length}건 (최신순)`);
console.log(`${pad("시각", 15)}  ${pad("작성자", 14)}  ${pad("요약", 46)}  행위`);
for (const commit of commits) {
  // 행위 기록이 없는 커밋은 `-` 다. 이 축이 붙기 전의 커밋이거나, 저장 경계 밖에서
  // 만들어진 커밋이다 — 0 으로 쓰면 "편집이 없었다" 로 읽힌다.
  const count = commit.edits.length === 0 && commit.editsOmitted === 0
    ? "-"
    : `${commit.edits.length}${commit.editsOmitted > 0 ? ` (+${commit.editsOmitted} 생략)` : ""}`;
  console.log(
    `${pad(stampOf(commit.at), 15)}  ${pad(commit.author, 14)}  ${pad(commit.summary, 46)}  ${count}`,
  );
  if (!withEdits) continue;
  for (const edit of commit.edits) {
    console.log(`    ${pad(stampOf(edit.at).slice(6), 9)} ${describeEdit(edit)}`);
  }
  if (commit.edits.length > 0) console.log("");
}
