import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateFastChecks } from "../scripts/merge-pr.mjs";

const check = (name, overrides = {}) => ({ name, status: "completed", conclusion: "success", ...overrides });
const fixed = [check("fast"), check("fast-static")];
const shards = Array.from({ length: 4 }, (_, index) => check(`fast-parity (${index + 1}/4)`));

test("accepts all four shards and ignores unrelated checks", () => {
  assert.deepEqual(evaluateFastChecks([...fixed, ...shards, check("ci-full", { conclusion: "failure" })]), {
    missing: [], pending: [], failed: [],
  });
});

test("waits for missing fixed checks and for parity to appear", () => {
  assert.deepEqual(evaluateFastChecks(fixed).missing, ["fast-parity"]);
  assert.deepEqual(evaluateFastChecks([fixed[0], ...shards]).missing, ["fast-static"]);
});

test("uses the shard total in the name and counts each shard once", () => {
  const one = check("fast-parity (1/2)");
  const two = check("fast-parity (2/2)");
  assert.deepEqual(evaluateFastChecks([...fixed, one, one]).missing, ["fast-parity (1/2 확인됨)"]);
  assert.deepEqual(evaluateFastChecks([...fixed, one, two]).missing, []);
});

test("waits when shard names are malformed or declare an incomplete second total", () => {
  assert.ok(evaluateFastChecks([...fixed, ...shards, check("fast-parity (5/4)")]).missing.length);
  assert.ok(evaluateFastChecks([...fixed, ...shards, check("fast-parity (1/2)")]).missing.length);
});

test("waits for an incomplete shard and reports failed or cancelled shards", () => {
  const queued = { ...shards[0], status: "queued", conclusion: null };
  const failed = { ...shards[1], conclusion: "failure" };
  const cancelled = { ...shards[2], conclusion: "cancelled" };
  assert.deepEqual(evaluateFastChecks([...fixed, queued, failed, cancelled, shards[3]]), {
    missing: [], pending: [queued], failed: [failed, cancelled],
  });
});

test("uses the latest run for each shard on the same SHA", () => {
  const old = { ...shards[0], started_at: "2026-11-19T00:00:00Z" };
  const latest = { ...shards[0], started_at: "2026-11-19T00:01:00Z", conclusion: "failure" };
  assert.deepEqual(evaluateFastChecks([...fixed, latest, old, ...shards.slice(1)]).failed, [latest]);
});
