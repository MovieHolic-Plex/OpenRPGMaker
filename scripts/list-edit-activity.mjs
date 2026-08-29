#!/usr/bin/env node
// 최근 편집 행위 로그 조회 — 디스크 미러(output/edit-activity/) 를 읽는다.
//
// 사용법:
//   node scripts/list-edit-activity.mjs [--limit N] [--scope <scope>] [--map <id>] [--json]
//     --limit  건수 (기본 20). `--limit 50` 또는 위치 인자 `50` 둘 다 받는다.
//     --scope  map | database | system | assets | project
//     --map    특정 맵의 편집만
//     --json   표 대신 원본 JSON (에이전트·스크립트용)
//
// 왜 CLI 가 필요한가: 편집 행위는 브라우저 링버퍼와 localStorage 에 산다 — 새로고침하면
// 세션 관찰이 끊기고, 에이전트는 브라우저 콘솔에 손이 닿지 않는다. dev 서버의
// `/__oprn/edit-activity` 미들웨어가 같은 엔트리를 디스크로 흘리므로, 이 스크립트가
// "방금 사용자가 뭘 했나" 를 재구성하는 유일한 무브라우저 경로다.
// AI 턴 로그(`npm run ai:log`)와 채널이 분리돼 있다 — 편집은 분당 수십 건이라 섞으면 AI 턴이 묻힌다.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { clockOf, pad } from "./lib/terminal-table.mjs";

const DIR = join(process.cwd(), "output", "edit-activity");
const INDEX_PATH = join(DIR, "index.json");
const JSONL_PATH = join(DIR, "edits.jsonl");

const args = process.argv.slice(2);

/** `--key value` 형태 1개 읽기. */
function flagValue(name) {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? "") : "";
}

// `--limit 50` 의 값이 위치 인자로 오해되지 않게 소비한 인덱스를 제외한다.
const consumed = new Set();
for (const name of ["limit", "scope", "map"]) {
  const at = args.indexOf(`--${name}`);
  if (at >= 0) {
    consumed.add(at);
    consumed.add(at + 1);
  }
}
const positional = args.filter((value, index) => !consumed.has(index) && !value.startsWith("--"));
const limitRaw = flagValue("limit") || positional.find((value) => /^\d+$/.test(value)) || "20";
const limit = Math.max(1, Number(limitRaw) || 20);
const scope = flagValue("scope");
const mapId = flagValue("map");
const asJson = args.includes("--json");

/**
 * 요약 목록. index.json 이 정본이고(미들웨어가 최신순으로 유지) 없거나 깨졌으면
 * edits.jsonl 을 직접 훑는다 — jsonl 은 append-only 라 미들웨어가 index 쓰기에 실패한
 * 상황에서도 살아 있다.
 */
function readRows() {
  if (existsSync(INDEX_PATH)) {
    try {
      const rows = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
      if (Array.isArray(rows)) return rows;
    } catch {
      /* jsonl 폴백으로 내려간다 */
    }
  }
  if (!existsSync(JSONL_PATH)) return [];
  const rows = [];
  for (const line of readFileSync(JSONL_PATH, "utf8").split("\n")) {
    const text = line.trim();
    if (text.length === 0) continue;
    try {
      rows.push(JSON.parse(text));
    } catch {
      /* 잘린 마지막 줄은 버린다 */
    }
  }
  // jsonl 은 오래된 것부터라 최신순으로 뒤집는다. 같은 seq 의 병합 갱신은 마지막 것만 남긴다.
  rows.reverse();
  const seen = new Set();
  return rows.filter((row) => {
    if (row.seq === undefined) return true;
    if (seen.has(row.seq)) return false;
    seen.add(row.seq);
    return true;
  });
}

if (!existsSync(DIR)) {
  console.log(`편집 행위 로그가 아직 없다: ${DIR}`);
  console.log("dev 서버(npm run dev)나 preview 로 편집기를 열고 편집을 한 번 하면 미러가 생긴다.");
  console.log("미러를 끈 상태면 .env 의 VITE_EDIT_ACTIVITY_DISK_MIRROR 를 확인하라(0/false 면 꺼짐).");
  process.exit(0);
}

let rows = readRows();
if (scope) rows = rows.filter((row) => row.scope === scope);
if (mapId) rows = rows.filter((row) => row.mapId === mapId);
rows = rows.slice(0, limit);

if (asJson) {
  console.log(JSON.stringify({ dir: DIR, count: rows.length, rows }, null, 2));
  process.exit(0);
}

if (rows.length === 0) {
  console.log(`조건에 맞는 편집 기록이 없다 (${DIR}).`);
  if (scope || mapId) console.log(`필터: ${[scope && `scope=${scope}`, mapId && `map=${mapId}`].filter(Boolean).join(" ")}`);
  process.exit(0);
}

console.log(`${DIR} — ${rows.length}건 (최신순)`);
console.log(`${pad("시각", 8)}  ${pad("스코프", 8)}  ${pad("라벨", 44)}  ${pad("맵", 16)}  셀`);
for (const row of rows) {
  const label = row.label ?? `(라벨 없음)`;
  const merged = row.mergedCount > 1 ? ` ×${row.mergedCount}` : "";
  const origin = row.origin && row.origin !== "human" ? ` (${row.origin})` : "";
  const cells = row.cellCount === undefined ? "" : String(row.cellCount);
  console.log(
    `${pad(clockOf(row.at), 8)}  ${pad(row.scope, 8)}  ${pad(`${label}${merged}${origin}`, 44)}  ${pad(row.mapId ?? "", 16)}  ${cells}`,
  );
}
