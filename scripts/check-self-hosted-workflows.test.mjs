import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";
import { isAllowedRunsOn, runsOnValues } from "./check-self-hosted-workflows.mjs";

const labels = '["self-hosted","linux","x64","mdc2"]';
const targetCheck = "github.event_name != 'pull_request_target'";
const sameRepo = "github.event.pull_request.head.repo.full_name == github.repository";
const forkCheck = `github.event_name != 'pull_request' || ${sameRepo}`;
const safeExpression = "${{ " + `${targetCheck} && (${forkCheck}) && fromJSON('${labels}') || 'ubuntu-latest' }}`;

const fastRunner = safeExpression.replace(labels, labels.replace('"mdc2"', '"mdc2","mdc2-fast"'));
const heavyRunner = fastRunner.replace("mdc2-fast", "mdc2-heavy");
const workflowSource = (name) => readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8");

test("heavy Linux CI runs on GitHub-hosted runners and only light or release jobs stay on mdc2", () => {
  const hosted = "ubuntu-latest";
  for (const [workflow, jobs] of Object.entries({
    "ci-fast": { fast: hosted, "fast-parity": hosted, "fast-static": hosted },
    "ci-full": { static: hosted, tests: hosted },
    "ci-vitest-files": { vitest: hosted },
    "security-audit": { audit: fastRunner },
    parity: {
      "editor-player-parity": hosted, "unit-tests": hosted,
      build: hosted, e2e: hosted, "ax-gates": hosted,
      "css-gates": hosted, "surface-gates": hosted,
    },
  })) {
    const runners = Object.fromEntries(runsOnValues(workflowSource(workflow)).map(({ job, value }) => [job, value]));
    assert.deepEqual(runners, jobs, workflow);
  }
});

test("desktop-release uses trusted triggers, and publishes only after upload and asset verification", () => {
  const workflow = load(workflowSource("desktop-release"));
  assert.deepEqual(Object.keys(workflow.on).sort(), ["release", "schedule", "workflow_dispatch"]);
  assert.deepEqual(workflow.on.release.types, ["published"]);
  assert.deepEqual(workflow.on.schedule, [{ cron: "*/30 * * * *" }]);
  const packages = workflow.jobs.packages;
  assert.equal(packages["runs-on"], heavyRunner);
  assert.match(packages.if, /github\.repository == 'MovieHolic-Plex\/OpenRPGMaker'/);
  const upload = packages.steps.findIndex(({ run }) => run?.includes("gh release upload"));
  const publish = packages.steps.findIndex(({ run }) => run?.includes("-F draft=false"));
  assert.ok(upload >= 0 && publish > upload);
  assert.match(packages.steps[publish].run, /if \[\[ -n "\$bad" \]\]; then[\s\S]*exit 1[\s\S]*-F draft=false/);
  assert.match(packages.steps[publish].if, /steps\.preflight\.outputs\.draft == 'true'/);
});

test("allows hosted runner labels in scalar, flow sequence, and block sequence forms", () => {
  const entries = runsOnValues(`jobs:
  linux:
    runs-on: ubuntu-22.04 # pinned image
  windows:
    runs-on: ["windows-latest"]
  mac:
    runs-on:
      - 'macos-latest'
  reusable:
    uses: ./.github/workflows/reusable.yml
`);
  assert.deepEqual(entries.map(({ job }) => job), ["linux", "windows", "mac"]);
  for (const { job, value } of entries) assert.equal(isAllowedRunsOn(value), true, job);
});

test("rejects bare self-hosted labels and raw lists including hosted or mdc2 labels", () => {
  const entries = runsOnValues(`jobs:
  bare: { "runs-on": Self-Hosted }
  flow:
    runs-on: [self-hosted, linux, x64, mdc2]
  block:
    runs-on:
      - ubuntu-latest
      - self-hosted
`);
  assert.deepEqual(entries.map(({ job }) => job), ["bare", "flow", "block"]);
  for (const { job, value } of entries) assert.equal(isAllowedRunsOn(value), false, job);
});

test("allows the guarded mdc2 and mdc2-heavy expressions", () => {
  assert.equal(isAllowedRunsOn(safeExpression), true);
  const heavy = labels.replace('"mdc2"', '"mdc2", "mdc2-heavy"');
  assert.equal(isAllowedRunsOn(safeExpression.replace(labels, heavy)), true);
});

test("allows folded YAML, extra whitespace, and swapped equality operands", () => {
  const expression = safeExpression.replace(sameRepo, "github.repository   ==   github.event.pull_request.head.repo.full_name");
  const folded = expression.replaceAll(" && ", " &&\n      ");
  const [{ value }] = runsOnValues(`jobs:\n  folded:\n    runs-on: >-\n      ${folded}\n`);
  assert.equal(isAllowedRunsOn(value), true);
});

test("rejects expressions missing the fork check or using OR to bypass it", () => {
  assert.equal(isAllowedRunsOn(safeExpression.replace(`(${forkCheck}) && `, "")), false);
  assert.equal(isAllowedRunsOn(safeExpression.replace(`(${forkCheck}) &&`, `(${forkCheck}) ||`)), false);
});

test("rejects expressions without a hosted fallback", () => {
  assert.equal(isAllowedRunsOn(safeExpression.replace(" || 'ubuntu-latest'", "")), false);
  assert.equal(isAllowedRunsOn(safeExpression.replace("'ubuntu-latest'", "'mdc2'")), false);
});

test("rejects pull_request_target workflows that can select self-hosted", () => {
  const unsafe = safeExpression.replace(targetCheck, "github.event_name == 'pull_request_target'");
  const entries = runsOnValues(`on: [pull_request, pull_request_target]
jobs:
  safe:
    runs-on: ${safeExpression}
  unsafe:
    runs-on: ${unsafe}
`);
  assert.deepEqual(entries.map(({ value }) => isAllowedRunsOn(value)), [true, false]);
  assert.equal(isAllowedRunsOn(safeExpression.replace(`${targetCheck} && `, "")), false);
});

test("requires a single expression and a JSON array with self-hosted and mdc2", () => {
  assert.equal(isAllowedRunsOn(`${safeExpression} trailing text`), false);
  assert.equal(isAllowedRunsOn(safeExpression.replace(labels, '["self-hosted","linux"]')), false);
  assert.equal(isAllowedRunsOn(safeExpression.replace(labels, '["mdc2","linux"]')), false);
  assert.equal(isAllowedRunsOn(safeExpression.replace(labels, '["self-hosted","mdc2",]')), false);
  assert.equal(isAllowedRunsOn([safeExpression]), false);
});
