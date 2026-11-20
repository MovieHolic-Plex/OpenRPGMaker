import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isAllowedRunsOn, runsOnValues } from "./check-self-hosted-workflows.mjs";

const labels = '["self-hosted","linux","x64","mdc2"]';
const targetCheck = "github.event_name != 'pull_request_target'";
const sameRepo = "github.event.pull_request.head.repo.full_name == github.repository";
const forkCheck = `github.event_name != 'pull_request' || ${sameRepo}`;
const safeExpression = "${{ " + `${targetCheck} && (${forkCheck}) && fromJSON('${labels}') || 'ubuntu-latest' }}`;

test("ci-fast routes only parity to mdc2-fast for trusted runs", () => {
  const source = readFileSync(new URL("../.github/workflows/ci-fast.yml", import.meta.url), "utf8");
  const runners = Object.fromEntries(runsOnValues(source).map(({ job, value }) => [job, value]));
  const fastLabels = '["self-hosted","linux","x64","mdc2","mdc2-fast"]';
  assert.deepEqual(runners, {
    fast: "ubuntu-latest",
    "fast-parity": safeExpression.replace(labels, fastLabels),
    "fast-static": "ubuntu-latest",
  });
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
