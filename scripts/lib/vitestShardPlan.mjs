// scripts/lib/vitestShardPlan.mjs
// vitest 파일 샤드를 «파일 개수 해시» 가 아니라 **측정한 시간** 으로 나눈다.
//
// 왜 필요한가 (실측 2026-11-24, ci-full run 45328461701): vitest `--shard i/16` 은 경로 해시로 나눠
// 샤드마다 파일은 192~196개로 같지만 파일 시간 합은 2,558~5,709초(68~137분)로 벌어졌다. 가장 느린
// 샤드가 판 전체를 정한다. `.omo/test-timings.json` 의 측정값으로 LPT(오래 걸리는 파일부터 가장 가벼운
// 샤드에 넣기)를 하면 같은 16샤드에서 가장 느린 샤드가 줄어든다.
//
// 이 모듈은 **순수 부분** 이다 — 파일 목록·배정·표 병합. 실행은 verify-gates.mjs 가 한다.
// CLI 는 그대로 `--shard i/n` 이다. 표가 없거나 계획이 안전하지 않으면 호출자가 `--shard=` 로 물러난다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const TIMINGS_FILE = ".omo/test-timings.json";

// 파일 하나가 샤드에 드는 최소 비용(초). 측정값이 0.0 인 파일(전체의 약 1/4)이 «가장 가벼운 샤드» 한 곳에
// 전부 쌓이지 않게 한다 — 워커가 파일을 여는 비용은 0 이 아니다. 중앙값(약 6초)보다 훨씬 작아 배정을 흔들지 않는다.
export const MIN_FILE_SEC = 1;

/**
 * vitest.config.ts 의 `include`/`exclude` 와 같은 규칙. 설정을 고치면 여기도 고친다(시험이 어긋남을 잡는다).
 *   include: test/**\/*.test.ts
 *   exclude: lakeVillageRebuildFinal, *.bun.test.ts, *.quarantine.test.ts, *.browser.test.ts
 *            + vitest 기본(node_modules·dist·cypress·점 폴더)
 */
export function isVitestTestFile(relPath) {
  if (!relPath.startsWith("test/") || !relPath.endsWith(".test.ts")) return false;
  if (relPath === "test/lakeVillageRebuildFinal.test.ts") return false;
  return !/\.(bun|quarantine|browser)\.test\.ts$/u.test(relPath);
}

/** `root` 아래 test/ 를 훑어 vitest 가 수집할 파일을 정렬해서 돌려준다(저장소 상대 경로, `/` 구분). */
export function listVitestTestFiles(root = process.cwd()) {
  const found = [];
  const walk = (relDir) => {
    for (const entry of readdirSync(join(root, relDir), { withFileTypes: true })) {
      const rel = `${relDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "cypress" || entry.name.startsWith(".")) continue;
        walk(rel);
      } else if (isVitestTestFile(rel)) found.push(rel);
    }
  };
  if (existsSync(join(root, "test"))) walk("test");
  return found.sort();
}

/** 표(`files`)의 초 값 중앙값. 표에 없는 새 파일의 추정치다. 값이 없으면 `MIN_FILE_SEC`. */
export function medianSec(table) {
  const values = Object.values(table ?? {}).map((entry) => entry.sec).filter(Number.isFinite).sort((a, b) => a - b);
  if (values.length === 0) return MIN_FILE_SEC;
  const mid = values.length >> 1;
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

/**
 * 파일을 `count` 개 샤드에 LPT 로 배정한다. 같은 입력이면 항상 같은 결과다(판정에 시계·난수 없음).
 *
 * 정렬: 비용 내림차순, 같으면 경로 오름차순. 배정: 현재 합이 가장 작은 샤드(같으면 파일 수가 적은 쪽,
 * 그래도 같으면 번호가 작은 쪽). 표에 없는 파일의 비용은 표의 중앙값이다.
 *
 * @param {readonly string[]} files 중복 없는 파일 경로
 * @param {Record<string, {sec: number}>} table `.omo/test-timings.json` 의 `files`
 * @param {number} count 샤드 수
 * @returns {{ shards: { files: string[], sec: number }[], medianSec: number, unknown: number }}
 *   `shards[i]` 가 샤드 i+1 이다. 각 `files` 는 경로순이다.
 */
export function assignShards(files, table, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`샤드 수는 1 이상의 정수여야 한다: ${count}`);
  const fallback = medianSec(table);
  let unknown = 0;
  const costOf = (file) => {
    const sec = table?.[file]?.sec;
    if (!Number.isFinite(sec)) {
      unknown += 1;
      return Math.max(fallback, MIN_FILE_SEC);
    }
    return Math.max(sec, MIN_FILE_SEC);
  };
  const items = [...new Set(files)].map((file) => ({ file, cost: costOf(file) }));
  items.sort((a, b) => b.cost - a.cost || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const shards = Array.from({ length: count }, () => ({ files: [], sec: 0 }));
  for (const { file, cost } of items) {
    let best = shards[0];
    for (const shard of shards) {
      if (shard.sec < best.sec || (shard.sec === best.sec && shard.files.length < best.files.length)) best = shard;
    }
    best.files.push(file);
    best.sec += cost;
  }
  for (const shard of shards) shard.files.sort();
  return { shards, medianSec: fallback, unknown };
}

/**
 * vitest 는 파일 인자를 «경로 부분 문자열(대소문자 무시)» 필터로 읽는다. 어떤 파일 경로가 다른 파일 경로를
 * 부분 문자열로 품으면 앞의 필터가 뒤 파일까지 불러와 샤드가 겹친다. 그런 쌍을 `[짧은 것, 긴 것]` 으로 돌려준다.
 * 지금 트리에서는 0쌍이어야 하고, 생기면 호출자가 해시 샤드로 물러난다.
 */
export function findFilterCollisions(files) {
  const lower = files.map((file) => file.toLowerCase());
  const pairs = [];
  for (let i = 0; i < files.length; i += 1) {
    for (let j = 0; j < files.length; j += 1) {
      if (i !== j && lower[j].includes(lower[i])) pairs.push([files[i], files[j]]);
    }
  }
  return pairs;
}

/** `.omo/test-timings.json` 을 읽는다. 없거나 깨졌으면 `null` — 호출자는 해시 샤드로 물러난다. */
export function loadTimings(path) {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed?.version !== 1 || typeof parsed.files !== "object" || parsed.files === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * `--shard index/count` 의 파일 목록을 시간 균형으로 계산한다. 쓸 수 없으면 `{ files: null, reason }`.
 * 폴백은 호출자가 지금까지처럼 vitest 의 `--shard=` 해시 분할을 쓴다(느리지만 합집합·중복 없음이 vitest 보증).
 */
export function planVitestShard({ root = process.cwd(), index, count, timingsPath = join(root, TIMINGS_FILE) }) {
  const timings = loadTimings(timingsPath);
  if (!timings) return { files: null, reason: `${TIMINGS_FILE} 없음 또는 형식 불일치` };
  const all = listVitestTestFiles(root);
  if (all.length === 0) return { files: null, reason: "test/ 에서 시험 파일을 찾지 못함" };
  const collisions = findFilterCollisions(all);
  if (collisions.length > 0) return { files: null, reason: `경로가 다른 경로의 부분 문자열인 쌍 ${collisions.length}개 (예: ${collisions[0].join(" ⊂ ")})` };
  const plan = assignShards(all, timings.files, count);
  const shard = plan.shards[index - 1];
  // 빈 목록을 vitest 에 넘기면 «필터 없음» = 전체 스위트가 돈다. 절대 넘기지 않는다.
  if (!shard || shard.files.length === 0) return { files: null, reason: `샤드 ${index}/${count} 에 배정된 파일이 없음` };
  return { files: shard.files, sec: shard.sec, total: all.length, unknown: plan.unknown, medianSec: plan.medianSec, loads: plan.shards.map((s) => s.sec) };
}

// ---- 표 생성 (scripts/update-test-timings.mjs 가 쓴다) ------------------------------------------------

/** verify-gates 의 testsGate 와 같은 정규화: 절대 경로 → `test/...`. */
export function normalizeTestPath(name) {
  const slashed = String(name ?? "").split("\\").join("/");
  const index = slashed.indexOf("/test/");
  return index >= 0 ? slashed.slice(index + 1) : slashed;
}

/**
 * 여러 회차의 vitest JSON `testResults` 를 파일별 평균 초로 합친다.
 * 통과한 회차가 있으면 그 값만 평균한다(실패·시간 초과 회차는 값이 부풀거나 잘려 있다). 통과한 회차가 하나도 없는 파일은
 * 실패 회차 값으로 평균한다 — 계속 빨간 파일도 시간을 먹으므로 표에서 빼면 중앙값으로 과소평가된다.
 *
 * @param {readonly (readonly {name: string, startTime: number, endTime: number, status: string}[])[]} runs
 *   회차마다 그 회차 모든 샤드의 `testResults` 를 이어 붙인 배열
 * @returns {Record<string, {sec: number, n: number}>} 경로순, 초는 소수 첫째 자리
 */
export function mergeTimingRuns(runs) {
  const perFile = new Map();
  for (const results of runs) {
    for (const entry of results) {
      const sec = (entry.endTime - entry.startTime) / 1000;
      if (!Number.isFinite(sec) || sec < 0) continue;
      const file = normalizeTestPath(entry.name);
      const slot = perFile.get(file) ?? { passed: [], other: [] };
      (entry.status === "passed" ? slot.passed : slot.other).push(sec);
      perFile.set(file, slot);
    }
  }
  const files = {};
  for (const file of [...perFile.keys()].sort()) {
    const { passed, other } = perFile.get(file);
    const used = passed.length > 0 ? passed : other;
    const mean = used.reduce((sum, sec) => sum + sec, 0) / used.length;
    files[file] = { sec: Math.round(mean * 10) / 10, n: used.length };
  }
  return files;
}
