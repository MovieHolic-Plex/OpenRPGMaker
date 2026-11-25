import assert from "node:assert/strict";
import test from "node:test";
import { blameFailures, groupByPr, issueBody, prComment } from "./ci-full-blame.mjs";
import { buildGraph } from "./lib/testImportGraph.mjs";

const sources = new Map([
  ["src/core.ts", "export const core = 1;"],
  ["src/feature.ts", 'import { core } from "./core";'],
  ["src/typesOnly.ts", 'import type { core } from "./core";'],
  ["test/feature.test.ts", 'import "../src/feature";'],
  ["test/types.test.ts", 'import "../src/typesOnly";'],
]);
const { forward } = buildGraph(sources, sources.keys());
const commits = [
  { sha: "a".repeat(40), pr: "10", subject: "core (#10)", changed: ["src/core.ts"] },
  { sha: "b".repeat(40), pr: "11", subject: "docs (#11)", changed: ["docs/x.md"] },
  { sha: "c".repeat(40), pr: "12", subject: "feature (#12)", changed: ["src/feature.ts", "test/feature.test.ts"] },
];

test("blameFailures ranks PRs that touched the closest runtime dependency first and ignores type-only edges", () => {
  const rows = blameFailures(["test/feature.test.ts", "test/types.test.ts"], commits, forward);
  assert.deepEqual(rows[0].candidates.map((candidate) => [candidate.pr, candidate.distance]), [["12", 0], ["10", 2]]);
  assert.deepEqual(rows[0].candidates[0].touched, ["test/feature.test.ts", "src/feature.ts"]);
  assert.deepEqual(rows[1].candidates, [], "type-only import is not a runtime dependency");
  const capped = blameFailures(["test/feature.test.ts"], commits, forward, 1);
  assert.equal(capped[0].candidates.length, 1);
  assert.equal(capped[0].more, 1);
});

test("groupByPr gathers every failing test a PR was blamed for, and bodies carry the per-run marker", () => {
  const rows = blameFailures(["test/feature.test.ts"], commits, forward);
  const prs = groupByPr(rows);
  assert.deepEqual(prs.map((entry) => entry.pr), ["10", "12"]);
  const diff = { candidate: { id: 99, url: "u", headSha: "f".repeat(40) }, baseline: { id: 98, url: "v", headSha: "e".repeat(40) } };
  assert.match(prComment(prs[1], diff, "#5"), /^<!-- ci-full-blame:99 -->\n/u);
  assert.match(issueBody(rows, diff), /`test\/feature\.test\.ts` \| #12 \(0\), #10 \(2\)/u);
  assert.match(issueBody([{ test: "test/x.test.ts", candidates: [], more: 0 }], diff), /후보 없음/u);
});
