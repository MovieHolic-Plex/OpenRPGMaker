import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  assignShards,
  findFilterCollisions,
  isVitestTestFile,
  listVitestTestFiles,
  MIN_FILE_SEC,
  medianSec,
  mergeTimingRuns,
  planVitestShard,
} from "./vitestShardPlan.mjs";

// 결정적 의사 난수 — 시험이 우연에 기대지 않게 한다.
function makeSuite(size, seed = 7) {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const files = [];
  const table = {};
  for (let i = 0; i < size; i += 1) {
    const file = `test/f${String(i).padStart(4, "0")}.test.ts`;
    files.push(file);
    // 긴 꼬리: 대부분 짧고 소수가 아주 길다(실측 분포와 같은 모양).
    if (i % 10 !== 9) table[file] = { sec: Math.round(next() ** 4 * 400 * 10) / 10, n: 1 };
  }
  return { files, table };
}

test("모든 파일이 정확히 한 샤드에 들어간다 (합집합 = 전체, 중복 0)", () => {
  const { files, table } = makeSuite(500);
  const { shards } = assignShards(files, table, 16);
  const all = shards.flatMap((shard) => shard.files);
  assert.equal(all.length, files.length);
  assert.deepEqual([...new Set(all)].sort(), [...files].sort());
});

test("같은 입력이면 입력 순서와 무관하게 같은 배정이다", () => {
  const { files, table } = makeSuite(300);
  const first = assignShards(files, table, 16);
  const shuffled = [...files].reverse();
  assert.deepEqual(assignShards(shuffled, table, 16), first);
  assert.deepEqual(assignShards(files, table, 16), first);
});

test("가장 큰 샤드는 목록 배정 한계(평균 + (1 - 1/m) × 가장 긴 파일) 안이다", () => {
  const { files, table } = makeSuite(800);
  const count = 16;
  const { shards, medianSec: median } = assignShards(files, table, count);
  const cost = (file) => Math.max(table[file]?.sec ?? median, MIN_FILE_SEC);
  const total = files.reduce((sum, file) => sum + cost(file), 0);
  const longest = Math.max(...files.map(cost));
  const max = Math.max(...shards.map((shard) => shard.sec));
  // 그레이엄의 목록 배정 한계: 가장 마지막에 들어간 파일은 그 시점 가장 가벼운 샤드(<= 평균) 에 붙어
  // max <= total/m + (1 - 1/m) * longest. LPT 는 이보다 더 좋다.
  const bound = total / count + (1 - 1 / count) * longest;
  assert.ok(max <= bound + 1e-9, `max ${max} > bound ${bound}`);
  // 샤드 합은 비용 합과 같다(배정이 비용을 잃거나 늘리지 않는다).
  assert.ok(Math.abs(shards.reduce((sum, shard) => sum + shard.sec, 0) - total) < 1e-6);
});

test("표에 없는 파일은 중앙값으로 계산하고 개수를 센다", () => {
  const table = { "test/a.test.ts": { sec: 2 }, "test/b.test.ts": { sec: 10 }, "test/c.test.ts": { sec: 30 } };
  assert.equal(medianSec(table), 10);
  const plan = assignShards(["test/a.test.ts", "test/b.test.ts", "test/new.test.ts"], table, 2);
  assert.equal(plan.unknown, 1);
  assert.equal(plan.medianSec, 10);
  // b(10)와 new(중앙값 10)가 서로 다른 샤드로 갈라지고 a(2)가 한쪽에 붙는다.
  assert.deepEqual(plan.shards.map((shard) => shard.sec).sort((x, y) => x - y), [10, 12]);
});

test("0초로 잰 파일이 한 샤드에 몰리지 않는다", () => {
  const files = Array.from({ length: 160 }, (_, i) => `test/z${String(i).padStart(3, "0")}.test.ts`);
  const table = Object.fromEntries(files.map((file) => [file, { sec: 0, n: 1 }]));
  const counts = assignShards(files, table, 16).shards.map((shard) => shard.files.length);
  assert.deepEqual(counts, Array(16).fill(10));
});

test("샤드 수가 1이면 전체가 한 샤드이고, 잘못된 수는 던진다", () => {
  const { files, table } = makeSuite(20);
  assert.deepEqual(assignShards(files, table, 1).shards[0].files, [...files].sort());
  assert.throws(() => assignShards(files, table, 0));
  assert.throws(() => assignShards(files, table, 2.5));
});

test("vitest.config.ts 의 include/exclude 와 같은 파일만 고른다", () => {
  assert.equal(isVitestTestFile("test/a.test.ts"), true);
  assert.equal(isVitestTestFile("test/sub/dir/a.test.ts"), true);
  assert.equal(isVitestTestFile("test/lakeVillageRebuildFinal.test.ts"), false);
  assert.equal(isVitestTestFile("test/a.bun.test.ts"), false);
  assert.equal(isVitestTestFile("test/a.quarantine.test.ts"), false);
  assert.equal(isVitestTestFile("test/a.browser.test.ts"), false);
  assert.equal(isVitestTestFile("test/a.test.mjs"), false);
  assert.equal(isVitestTestFile("src/a.test.ts"), false);
});

test("listVitestTestFiles 는 디스크의 test/ 를 정렬해 돌려주고 제외 규칙을 지킨다", () => {
  const root = mkdtempSync(join(tmpdir(), "shard-plan-"));
  try {
    for (const rel of ["test/b.test.ts", "test/a.test.ts", "test/deep/c.test.ts", "test/x.bun.test.ts", "test/node_modules/y.test.ts", "test/.hidden/z.test.ts", "test/lakeVillageRebuildFinal.test.ts", "test/readme.md"]) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), "");
    }
    assert.deepEqual(listVitestTestFiles(root), ["test/a.test.ts", "test/b.test.ts", "test/deep/c.test.ts"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("경로가 다른 경로의 부분 문자열이면 충돌로 잡는다 (vitest 필터는 부분 문자열이다)", () => {
  assert.deepEqual(findFilterCollisions(["test/a.test.ts", "test/b.test.ts"]), []);
  assert.deepEqual(findFilterCollisions(["test/a.test.ts", "test/x/test/a.test.ts"]), [["test/a.test.ts", "test/x/test/a.test.ts"]]);
  assert.equal(findFilterCollisions(["test/A.test.ts", "test/sub/test/a.test.ts"]).length, 1);
});

test("planVitestShard: 표가 없거나 깨졌으면 파일 목록 없이 이유만 돌려준다 (해시 폴백)", () => {
  const root = mkdtempSync(join(tmpdir(), "shard-plan-"));
  try {
    mkdirSync(join(root, "test"));
    writeFileSync(join(root, "test/a.test.ts"), "");
    assert.equal(planVitestShard({ root, index: 1, count: 2 }).files, null);
    mkdirSync(join(root, ".omo"));
    writeFileSync(join(root, ".omo/test-timings.json"), "{ not json");
    assert.equal(planVitestShard({ root, index: 1, count: 2 }).files, null);
    writeFileSync(join(root, ".omo/test-timings.json"), JSON.stringify({ version: 1, files: { "test/a.test.ts": { sec: 3, n: 1 } } }));
    // 파일 1개를 2샤드로 나누면 샤드 2는 비는데, 빈 목록은 «전체 실행» 이 되므로 폴백이어야 한다.
    assert.deepEqual(planVitestShard({ root, index: 1, count: 2 }).files, ["test/a.test.ts"]);
    assert.equal(planVitestShard({ root, index: 2, count: 2 }).files, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("mergeTimingRuns: 통과한 회차만 평균하고, 통과가 없는 파일은 실패 회차 값을 쓴다", () => {
  const entry = (name, sec, status) => ({ name, startTime: 1000, endTime: 1000 + sec * 1000, status });
  const run1 = [entry("/w/OpenRPGMaker/test/a.test.ts", 10, "passed"), entry("/w/OpenRPGMaker/test/b.test.ts", 100, "failed"), entry("/w/OpenRPGMaker/test/c.test.ts", 4, "passed")];
  const run2 = [entry("/w/OpenRPGMaker/test/a.test.ts", 20, "passed"), entry("/w/OpenRPGMaker/test/b.test.ts", 300, "failed"), entry("/w/OpenRPGMaker/test/c.test.ts", 900, "failed")];
  assert.deepEqual(mergeTimingRuns([run1, run2]), {
    "test/a.test.ts": { sec: 15, n: 2 },
    "test/b.test.ts": { sec: 200, n: 2 },
    "test/c.test.ts": { sec: 4, n: 1 },
  });
});
