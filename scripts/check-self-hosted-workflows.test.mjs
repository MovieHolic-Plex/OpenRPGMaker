import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";
import { FORK_GUARD, PENDING, checkWorkflow, hasForkGuard, isAllowedRunsOn, jobsOf, runsOnValues } from "./check-self-hosted-workflows.mjs";

const fast = ["self-hosted", "linux", "x64", "mdc2", "mdc2-fast"];
const heavy = ["self-hosted", "linux", "x64", "mdc2", "mdc2-heavy"];
const workflowDir = new URL("../.github/workflows/", import.meta.url);
const workflowSource = (name) => readFileSync(new URL(`${name}.yml`, workflowDir), "utf8");

test("every workflow in the repository passes the self-hosted contract", () => {
  for (const file of readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name))) {
    assert.deepEqual(checkWorkflow(file, readFileSync(new URL(file, workflowDir), "utf8")).violations, [], file);
  }
});

test("Linux jobs run on mdc2 labels, heavy jobs on mdc2-heavy, and only the listed jobs stay hosted", () => {
  for (const [workflow, jobs] of Object.entries({
    "ci-fast": { fast, "fast-parity": fast, "fast-static": fast },
    "ci-full": { static: heavy, tests: heavy },
    "ci-vitest-files": { vitest: heavy },
    "security-audit": { audit: fast },
    "mac-onboarding": { "launcher-and-private-setup": fast },
    parity: {
      "editor-player-parity": fast, "unit-tests": fast, build: fast, e2e: fast,
      "ax-gates": fast, "css-gates": fast, "surface-gates": fast,
    },
  })) {
    const runners = Object.fromEntries(runsOnValues(workflowSource(workflow)).map(({ job, value }) => [job, value]));
    assert.deepEqual(runners, jobs, workflow);
  }
  assert.deepEqual(
    Object.fromEntries(Object.entries(PENDING).map(([file, jobs]) => [file, Object.keys(jobs)])),
    {
      "desktop-release.yml": ["packages"],
    },
  );
});

test("ci-full vitest shards are capped on mdc2", () => {
  const tests = load(workflowSource("ci-full")).jobs.tests;
  assert.equal(tests.strategy["max-parallel"], 3);
  assert.equal(tests.strategy.matrix.shard.length, 16);
});

test("desktop-release uses trusted triggers, and publishes only after upload and asset verification", () => {
  const workflow = load(workflowSource("desktop-release"));
  assert.deepEqual(Object.keys(workflow.on).sort(), ["release", "schedule", "workflow_dispatch"]);
  assert.deepEqual(workflow.on.release.types, ["published"]);
  assert.deepEqual(workflow.on.schedule, [{ cron: "*/30 * * * *" }]);
  const packages = workflow.jobs.packages;
  assert.match(packages.if, /github\.repository == 'MovieHolic-Plex\/OpenRPGMaker'/);
  const upload = packages.steps.findIndex(({ run }) => run?.includes("gh release upload"));
  const publish = packages.steps.findIndex(({ run }) => run?.includes("-F draft=false"));
  assert.ok(upload >= 0 && publish > upload);
  assert.match(packages.steps[publish].run, /if \[\[ -n "\$bad" \]\]; then[\s\S]*exit 1[\s\S]*-F draft=false/);
  assert.match(packages.steps[publish].if, /steps\.preflight\.outputs\.draft == 'true'/);
});

test("allows self-hosted mdc2 and win11 label lists", () => {
  assert.equal(isAllowedRunsOn(fast), true);
  assert.equal(isAllowedRunsOn(heavy), true);
  assert.equal(isAllowedRunsOn(["self-hosted", "Windows", "X64", "win11"]), true);
});

test("rejects hosted labels, expressions, and incomplete self-hosted lists", () => {
  for (const value of [
    "ubuntu-latest", ["windows-latest"], "macos-14", ["self-hosted", "linux", "mdc2", "ubuntu-latest"],
    "self-hosted", ["self-hosted", "linux", "x64"], ["linux", "mdc2"], ["self-hosted", "windows", "mdc2"], [],
    "${{ github.event_name != 'pull_request_target' && fromJSON('[\"self-hosted\",\"linux\",\"mdc2\"]') || 'ubuntu-latest' }}",
  ]) {
    assert.equal(isAllowedRunsOn(value), false, JSON.stringify(value));
  }
});

test("accepts the fork guard alone, wrapped, folded, or with a parenthesised extra condition", () => {
  assert.equal(hasForkGuard(FORK_GUARD), true);
  assert.equal(hasForkGuard("${{ " + FORK_GUARD + " }}"), true);
  assert.equal(hasForkGuard(FORK_GUARD.replaceAll(" && ", " &&\n   ")), true);
  assert.equal(hasForkGuard(`${FORK_GUARD} && (github.repository == 'a/b' || github.event_name == 'schedule')`), true);
});

test("rejects missing guards and conditions that can bypass the guard", () => {
  for (const condition of [
    undefined,
    "always()",
    FORK_GUARD.replace("github.event_name != 'pull_request_target' && ", ""),
    `${FORK_GUARD} || always()`,
    `${FORK_GUARD} && always()`,
    `${FORK_GUARD} && (always()) || (always())`,
    `always() || ${FORK_GUARD}`,
    `${FORK_GUARD} && (github.ref == ')') || (true)`,
  ]) {
    assert.equal(hasForkGuard(condition), false, String(condition));
  }
});

test("rejects pull_request_target and workflow_run triggers, and unguarded jobs", () => {
  const source = (on, condition) => `on: ${on}
jobs:
  build:
    if: ${condition}
    runs-on: [self-hosted, linux, x64, mdc2]
    steps: []
`;
  assert.deepEqual(checkWorkflow("x.yml", source("[pull_request]", JSON.stringify(FORK_GUARD))).violations, []);
  assert.equal(checkWorkflow("x.yml", source("[pull_request_target]", JSON.stringify(FORK_GUARD))).violations.length, 1);
  assert.equal(checkWorkflow("x.yml", source("[workflow_run]", JSON.stringify(FORK_GUARD))).violations.length, 1);
  assert.equal(checkWorkflow("x.yml", source("[push]", "always()")).violations.length, 1);
  const [{ condition }] = jobsOf(source("[push]", JSON.stringify(FORK_GUARD)));
  assert.equal(condition, FORK_GUARD);
});
