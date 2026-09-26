#!/usr/bin/env node
// AI 턴의 단계별 벽시계 표. 디스크 미러(output/ai-activity)만 읽는다 — 원격·프로젝트 DB 는 보지 않는다.
// --last N (기본 10) [--json]
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "output", "ai-activity");

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

function readLatest() {
  const path = join(DIR, "latest.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** 미러 행을 최신순으로 모은다. list-ai-activity.mjs 와 같은 순서(index.json → 개별 파일 스캔)다. */
function listDisk() {
  if (!existsSync(DIR)) {
    return {
      error: `${DIR} 없음 — dev 서버(npm run dev)로 AI 턴을 한 번 돌려야 미러가 생긴다.`,
      records: [],
    };
  }
  const indexPath = join(DIR, "index.json");
  let records = null;
  if (existsSync(indexPath)) {
    try {
      const rows = JSON.parse(readFileSync(indexPath, "utf8"));
      // 요약(index.json)에는 timing 이 없다 — 단계는 개별 레코드에만 있으므로 항상 본체를 읽는다.
      records = rows.map((row) => readRecord(row.id)).filter(Boolean);
    } catch {
      /* fall through to per-file scan */
    }
  }
  if (!records) {
    const ids = readdirSync(DIR)
      .filter((f) => f.endsWith(".json") && f !== "index.json" && f !== "latest.json")
      .map((f) => f.replace(/\.json$/, ""));
    records = ids.map((id) => readRecord(id)).filter(Boolean);
    records.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
  // latest.json 은 index.json 보다 먼저 쓰인다(scripts/lib/activityMirror.mjs) — 그 사이에 죽으면
  // 가장 최근 턴이 요약에 없다. 방금 돈 턴을 못 보는 게 이 도구에서 제일 아픈 구멍이라 보강한다.
  const latest = readLatest();
  if (latest && !records.some((record) => record.id === latest.id)) records.unshift(latest);
  return { records };
}

function clip(text, width) {
  const value = String(text ?? "").replace(/\s+/gu, " ").trim();
  return value.length > width ? `${value.slice(0, width - 1)}…` : value;
}

const args = process.argv.slice(2);
const lastIndex = args.indexOf("--last");
const last = Math.max(1, Math.min(1000, Number(lastIndex >= 0 ? args[lastIndex + 1] : 10) || 10));
const asJson = args.includes("--json");

const disk = listDisk();
if (disk.error) {
  console.log(disk.error);
  process.exit(0);
}

// timing 없는 행은 건너뛴다 — 계측 이전의 턴과 계측을 못 붙인 경로가 0ms 로 보이면 표가 거짓말을 한다.
const rows = disk.records
  .filter((record) => record?.timing && Array.isArray(record.timing.stages))
  .slice(0, last)
  .map((record) => ({
    id: record.id,
    at: record.at,
    channel: record.channel ?? "other",
    instruction: record.instruction ?? "",
    totalMs: record.timing.totalMs,
    stages: record.timing.stages,
  }));

if (asJson) {
  console.log(JSON.stringify({ dir: DIR, count: rows.length, rows }, null, 2));
  process.exit(0);
}

if (rows.length === 0) {
  console.log(`${DIR}: timing 이 붙은 턴이 없다 — 계측이 들어간 뒤의 AI 턴을 한 번 돌려야 한다.`);
  process.exit(0);
}

console.log(
  "열: 시각 | 채널 | 지시(앞 40자) | total=턴 벽시계ms | 이어지는 칸은 단계=ms (그 턴의 기록 순서, 같은 이름은 합).",
);
for (const row of rows) {
  const stages = row.stages.map((stage) => `${stage.name}=${stage.ms}`).join(" ");
  console.log(
    `${row.at}  ${row.channel.padEnd(16)}  ${clip(row.instruction, 40).padEnd(40)}  total=${row.totalMs}  ${stages}`,
  );
}
