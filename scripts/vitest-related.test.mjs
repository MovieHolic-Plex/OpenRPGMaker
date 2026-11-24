import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  applyBudget, findDirectImporters, findLiteralReferences, importCandidates, isSafetyNet, isVitestFile, literalKeys, parseSpecifiers, selectRelated,
} from "./vitest-related.mjs";

test("isVitestFile follows the vitest.config.ts include/exclude", () => {
  assert.equal(isVitestFile("test/a.test.ts"), true);
  assert.equal(isVitestFile("test/sub/dir/a.test.ts"), true);
  for (const path of ["test/a.bun.test.ts", "test/a.quarantine.test.ts", "test/a.browser.test.ts", "test/lakeVillageRebuildFinal.test.ts",
    "test/a.test.mjs", "test/helpers.ts", "src/a.test.ts", "scripts/a.test.ts"]) assert.equal(isVitestFile(path), false, path);
});

test("isSafetyNet matches the config/gate files and not ordinary sources", () => {
  for (const path of ["package.json", "package-lock.json", "vitest.config.ts", "vitest.live.config.ts", "tsconfig.json", "tsconfig.electron.json",
    "scripts/run-vitest.mjs", "scripts/verify-gates.mjs", "scripts/lib/ciOnlyTests.mjs", ".github/workflows/ci-fast.yml",
    ".github/workflows/ci-related-tests.yml", "test/setupVitest.ts", "test/helpers/dom.ts", "test/support/x.ts", ".omo/gates-baseline.json"]) {
    assert.equal(isSafetyNet(path), true, path);
  }
  for (const path of ["src/package.json", "scripts/other.mjs", ".github/workflows/parity.yml", "test/setupLocal.test.mjs", "test/a.test.ts"]) {
    assert.equal(isSafetyNet(path), false, path);
  }
});

test("parseSpecifiers reads static, dynamic, require and vi.mock specifiers", () => {
  const source = [
    'import { a } from "../src/a";',
    "import type { B } from '@/b';",
    'import "./side";',
    'export * from "./re";',
    'import {\n  c,\n  d,\n} from "../src/multi";',
    'const x = await import("../src/dyn");',
    'const y = require("../src/req");',
    'vi.mock("@/mocked", () => ({}));',
    "const z = await import(`../src/${name}`);",
    'import pkg from "vitest";',
  ].join("\n");
  assert.deepEqual(parseSpecifiers(source).sort(), ["./re", "./side", "../src/a", "../src/dyn", "../src/multi", "../src/req", "@/b", "@/mocked", "vitest"].sort());
});

test("importCandidates resolves relative, alias, extension swap and index files; bare packages resolve to nothing", () => {
  const relative = importCandidates("test/ai/x.test.ts", "../../src/ai/tool");
  assert.ok(relative.includes("src/ai/tool.ts") && relative.includes("src/ai/tool.mts") && relative.includes("src/ai/tool.js") && relative.includes("src/ai/tool/index.ts"));
  assert.ok(importCandidates("test/x.test.ts", "@/ai/tool").includes("src/ai/tool.ts"));
  assert.ok(importCandidates("test/x.test.ts", "../src/ai/tool.js").includes("src/ai/tool.ts"));
  assert.ok(importCandidates("test/x.test.ts", "../src/data/items.json").includes("src/data/items.json"));
  assert.ok(importCandidates("test/x.test.ts", "../src/data/items.json?raw").includes("src/data/items.json"));
  assert.deepEqual(importCandidates("test/x.test.ts", "vitest"), []);
  assert.deepEqual(importCandidates("test/x.test.ts", "node:fs"), []);
});

test("findDirectImporters selects only direct importers (depth 1)", () => {
  const sources = new Map([
    ["test/a.test.ts", 'import { f } from "../src/leaf";'],
    ["test/b.test.ts", 'import { g } from "@/mid";'], // mid 가 leaf 를 import 해도 깊이 2 라 고르지 않는다
    ["test/c.test.ts", 'import { h } from "../src/dir";'], // index 파일
    ["test/d.test.ts", 'import { i } from "../src/leaf.js";'],
    ["test/e.test.ts", 'import { j } from "vitest";'],
  ]);
  const hits = findDirectImporters(sources, ["src/leaf.ts", "src/dir/index.ts"]);
  assert.deepEqual([...hits.keys()].sort(), ["test/a.test.ts", "test/c.test.ts", "test/d.test.ts"]);
  assert.deepEqual(hits.get("test/c.test.ts"), ["src/dir/index.ts"]);
});

test("literalKeys indexes the last path segment and parent/segment of string literals", () => {
  const keys = literalKeys('readFileSync(join(root, "public/assets/ui/panel.png")); const n = \'tiles.json\'; const t = `a/${x}/sheet.css`;');
  assert.ok(keys.has("panel.png") && keys.has("ui/panel.png") && keys.has("tiles.json") && keys.has("sheet.css"));
});

test("findLiteralReferences matches distinctive names by basename and generic names only with the parent folder", () => {
  const sources = new Map([
    ["test/a.test.ts", 'readFileSync("public/assets/ui/panel-frame.png")'],
    ["test/b.test.ts", 'const f = "index.json";'],
    ["test/c.test.ts", 'const f = "harness-data/jp-city/index.json";'],
    ["test/d.test.ts", 'const f = "unrelated.png";'],
  ]);
  const hits = findLiteralReferences(sources, ["public/assets/ui/panel-frame.png", "harness-data/jp-city/index.json"]);
  assert.deepEqual([...hits.keys()].sort(), ["test/a.test.ts", "test/c.test.ts"]);
});

test("applyBudget keeps priority tiers first, then cheapest, and reports skipped files deterministically", () => {
  const candidates = [
    { file: "test/imp-big.test.ts", tier: "direct-import", reasons: [] },
    { file: "test/imp-small.test.ts", tier: "direct-import", reasons: [] },
    { file: "test/changed.test.ts", tier: "changed-test", reasons: [] },
    { file: "test/lit.test.ts", tier: "string-literal", reasons: [] },
    { file: "test/huge.test.ts", tier: "direct-import", reasons: [] },
  ];
  const timings = {
    "test/imp-big.test.ts": { sec: 80 }, "test/imp-small.test.ts": { sec: 10 }, "test/changed.test.ts": { sec: 50 },
    "test/lit.test.ts": { sec: 5 }, "test/huge.test.ts": { sec: 500 },
  };
  // factor 1, 1 워커, 상한 150초: 50 + 10 + 80 = 140 까지 담고, 5 는 상한을 넘기지 않아 담긴다(145), 500 은 단독으로 넘는다.
  const options = { budgetSeconds: 150, workers: 1, factor: 1, startupSeconds: 0, perFileSeconds: 0 };
  const first = applyBudget(candidates, timings, options);
  assert.deepEqual(first.selected.map((entry) => entry.file), ["test/changed.test.ts", "test/imp-big.test.ts", "test/imp-small.test.ts", "test/lit.test.ts"]);
  assert.deepEqual(first.skipped.map((entry) => entry.file), ["test/huge.test.ts"]);
  assert.equal(first.sumSeconds, 145);
  assert.equal(first.estWallSeconds, 145);
  assert.deepEqual(applyBudget([...candidates].reverse(), timings, options), first);

  // 상한이 빠듯하면 낮은 우선순위(string-literal)와 비싼 것부터 미룬다.
  const tight = applyBudget(candidates, timings, { budgetSeconds: 70, workers: 1, factor: 1, startupSeconds: 0, perFileSeconds: 0 });
  assert.deepEqual(tight.selected.map((entry) => entry.file), ["test/changed.test.ts", "test/imp-small.test.ts", "test/lit.test.ts"]);
  assert.deepEqual(tight.skipped.map((entry) => entry.file), ["test/huge.test.ts", "test/imp-big.test.ts"]);
});

test("applyBudget divides summed time across workers but never goes below the largest single file", () => {
  const candidates = ["a", "b", "c", "d"].map((name) => ({ file: `test/${name}.test.ts`, tier: "direct-import", reasons: [] }));
  const timings = Object.fromEntries(candidates.map((entry) => [entry.file, { sec: 100 }]));
  const result = applyBudget(candidates, timings, { budgetSeconds: 200, workers: 2, factor: 1, startupSeconds: 0, perFileSeconds: 0 });
  assert.equal(result.selected.length, 4);
  assert.equal(result.estWallSeconds, 200);
  const unknown = applyBudget([candidates[0]], {}, { budgetSeconds: 200, workers: 1, factor: 1, startupSeconds: 0, perFileSeconds: 0, defaultSeconds: 7 });
  assert.equal(unknown.selected[0].sec, 7);
  assert.equal(unknown.selected[0].known, false);
});

test("selectRelated adds changed tests, direct importers and literal references; safety-net files do not widen to everything", () => {
  const testSources = new Map([
    ["test/a.test.ts", 'import "../src/a";'],
    ["test/pkg.test.ts", 'import pkg from "../package.json";'],
    ["test/other.test.ts", 'import "../src/other";'],
    ["test/lit.test.ts", 'const p = "assets/x/hero-sheet.png";'],
  ]);
  const result = selectRelated({
    changed: ["src/a.ts", "package.json", "test/new.test.ts", "test/gone.test.ts", "public/assets/x/hero-sheet.png", "docs/readme.md"],
    testSources,
    exists: (path) => path !== "test/gone.test.ts",
  });
  assert.deepEqual(result.safetyNet, ["package.json"]);
  assert.deepEqual(result.selected.map((entry) => [entry.file, entry.tier]), [
    ["test/a.test.ts", "direct-import"], ["test/lit.test.ts", "string-literal"], ["test/new.test.ts", "changed-test"], ["test/pkg.test.ts", "direct-import"],
  ]);
  assert.deepEqual(result.skipped, []);
});

test("CLI diffs base...head in a real git repo and writes the list and the nightly-deferred summary", () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), "vitest-related.mjs");
  const dir = mkdtempSync(join(tmpdir(), "vitest-related-"));
  try {
    const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, encoding: "utf8" });
    const put = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
    git("init", "-q", "-b", "main");
    put("src/a.ts", "export const a = 1;\n");
    put("src/b.ts", "export const b = 1;\n");
    put("test/a.test.ts", 'import "../src/a";\n');
    put("test/b.test.ts", 'import "@/b";\n');
    put("test/c.test.ts", 'import "../src/a";\n');
    put("test/c.browser.test.ts", 'import "../src/a";\n');
    put("test/c.bun.test.ts", 'import "../src/a";\n');
    put(".omo/test-timings.json", JSON.stringify({ version: 1, files: { "test/a.test.ts": { sec: 1 }, "test/b.test.ts": { sec: 1 }, "test/c.test.ts": { sec: 900 } } }));
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    put("src/a.ts", "export const a = 2;\n");
    put("package.json", "{}\n");
    git("add", "-A");
    git("commit", "-q", "-m", "change");
    const summary = join(dir, "summary.md");
    const list = join(dir, "list.txt");
    const output = execFileSync("node", [script, "--base", "HEAD~1", "--out", list, "--summary", summary, "--budget-seconds", "100", "--workers", "1", "--factor", "1", "--startup-seconds", "0", "--per-file-seconds", "0"], { cwd: dir, encoding: "utf8" });
    assert.equal(readFileSync(list, "utf8"), "test/a.test.ts\n");
    assert.match(output, /safety-net hit: package\.json/u);
    assert.match(readFileSync(summary, "utf8"), /nightly 로 미룸 1개/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
