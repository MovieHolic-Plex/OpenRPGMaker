import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/check-css-budget.mjs", import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "css-budget-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const styles = join(root, "src/styles");
  mkdirSync(styles, { recursive: true });
  writeFileSync(join(styles, "base.css"), ".base { display: block; }\n");
  const run = (...args) => {
    const result = spawnSync(process.execPath, [script, "--json", ...args], {
      cwd: root, encoding: "utf8", timeout: 10_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    return { status: result.status, report: JSON.parse(result.stdout) };
  };
  assert.equal(run("--save-baseline").status, 0);
  return { root, styles, run };
}

test("adding a scoped stylesheet is informational and preserves the baseline", (t) => {
  const { root, styles, run } = fixture(t);
  const baseline = join(root, ".omo/css-budget-baseline.json");
  const before = readFileSync(baseline, "utf8");
  writeFileSync(join(styles, "feature.css"), ".feature { display: grid; }\n");
  const { status, report } = run();
  assert.equal(status, 0);
  assert.equal(report.metrics.cssFileCount, 2);
  assert.deepEqual(report.details.cssFileList, ["src/styles/base.css", "src/styles/feature.css"]);
  assert.deepEqual(report.regressions, []);
  assert.deepEqual(report.improvements, []);
  assert.equal(readFileSync(baseline, "utf8"), before);
});

test("removing a stylesheet is not counted as a quality improvement", (t) => {
  const { styles, run } = fixture(t);
  rmSync(join(styles, "base.css"));
  const { status, report } = run();
  assert.equal(status, 0);
  assert.equal(report.metrics.cssFileCount, 0);
  assert.deepEqual(report.improvements, []);
});

for (const [metric, css] of [
  ["hexLiterals", ".feature { color: #ff0000; }"],
  ["important", ".feature { display: grid !important; }"],
  ["undefinedVars", ".feature { color: var(--missing); }"],
  ["globalRootFiles", ":root { --feature-color: currentColor; }"],
]) {
  test(`a new stylesheet still fails for increased ${metric}`, (t) => {
    const { styles, run } = fixture(t);
    writeFileSync(join(styles, "feature.css"), css);
    const { status, report } = run();
    assert.equal(status, 1);
    assert.equal(report.metrics.cssFileCount, 2);
    assert.deepEqual(report.regressions.map((entry) => entry.metric), [metric]);
    assert.equal(report.regressions[0].delta, 1);
    assert.ok(report.regressions[0].offenders.length > 0);
  });
}
