#!/usr/bin/env node
// 원격 커밋 로그 조회 — Supabase `project_commits` + `project_changes.patch_json`.
//
// 사용법:
//   node scripts/list-project-commits.mjs [limit] [--edits] [--origin <o>] [--map <id>] [--json]
//     --edits   커밋마다 그 안의 편집 행위 기록을 펼친다 (기본은 건수만)
//     --origin  human | ai | tool | system — 그 origin 의 편집이 있는 커밋만
//     --map     그 맵을 건드린 편집이 있는 커밋만
//     --json    표 대신 원본 JSON (에이전트·스크립트용)
//
// 왜 이 CLI 가 필요한가 (2026-08-29 관측성 감사):
// `project_changes.patch_json` 은 첫 마이그레이션부터 쓰이고 있었지만 **읽는 코드가 0개**였다.
// 쓰기만 하는 컬럼은 감사에 쓸 수 없다 — 사고가 났을 때 SQL 을 즉석에서 짜야 하고,
// 그러면 아무도 안 본다. 편집 행위 기록을 그 컬럼에 실은 이상 읽는 경로가 같이 있어야 한다.
//
// 채널 분리: `npm run ai:log` 는 AI 턴(프롬프트·툴콜), `npm run edit:log` 는 라이브 세션의
// 편집 행위(디스크 미러), 이 스크립트는 **저장된 것**. 앞의 둘은 새로고침·워크트리 교체에
// 끊기지만 이건 DB 에 남는다.
import { loadSupabaseEnvironment } from "./lib/supabase-database-ops.mjs";
import { describeEdit, pad, stampOf } from "./lib/terminal-table.mjs";

const args = process.argv.slice(2);

function flagValue(name) {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? "") : "";
}

const consumed = new Set();
for (const name of ["limit", "origin", "map"]) {
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

/** 프록시 모드에서는 VITE_SUPABASE_URL 이 상대 경로다 — 노드는 절대 URL 이 필요하다. */
function remoteBaseUrl(env) {
  for (const candidate of [env.SUPABASE_UPSTREAM_URL, env.SUPABASE_URL, env.VITE_SUPABASE_URL]) {
    const url = (candidate || "").trim().replace(/\/$/, "");
    if (/^https?:\/\//.test(url)) return url;
  }
  return "";
}

const env = loadSupabaseEnvironment();
const base = remoteBaseUrl(env);
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
const projectId = env.VITE_SUPABASE_PROJECT_ID || "";
if (!base || !key || !projectId) {
  console.log("Supabase 환경이 없다 — .env 의 VITE_SUPABASE_URL / ANON_KEY / VITE_SUPABASE_PROJECT_ID 를 확인하라.");
  console.log("로컬 세션 편집만 보려면 `npm run edit:log`(디스크 미러) 를 쓴다.");
  process.exit(0);
}

// project_changes 에는 project_id 가 없다(commit_id FK 로만 매달린다) — PostgREST 임베딩으로
// 커밋 쪽에서 필터하고 변경 row 를 끌어온다.
const query = new URLSearchParams({
  project_id: `eq.${projectId}`,
  select: "commit_id,summary,review_status,author_kind,author_label,agent_name,created_at,project_changes(patch_json)",
  order: "created_at.desc",
  limit: String(limit),
});
const url = `${base}/rest/v1/project_commits?${query.toString()}`;

let rows;
try {
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Accept-Profile": "rpg_zzu" },
  });
  if (!response.ok) {
    console.log(`조회 실패: ${response.status} ${response.statusText}`);
    console.log(await response.text());
    process.exit(1);
  }
  rows = await response.json();
} catch (error) {
  console.log(`조회 실패: ${String(error)}`);
  process.exit(1);
}

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
