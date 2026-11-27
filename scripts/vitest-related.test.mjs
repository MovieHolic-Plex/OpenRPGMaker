import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  applyBudget, findDirectImporters, findLiteralReferences, importCandidates, isSafetyNet, isVitestFile, literalKeys, parseSpecifiers, planChunks, selectRelated,
} from "./vitest-related.mjs";
import { buildGraph } from "./lib/testImportGraph.mjs";

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
  // 미루는 것은 import-graph 단계뿐이다(바뀐 시험·직접 import·문자열은 늘 담는다).
  const candidates = [
    { file: "test/imp-big.test.ts", tier: "import-graph", reasons: [] },
    { file: "test/imp-small.test.ts", tier: "direct-import", reasons: [] },
    { file: "test/changed.test.ts", tier: "changed-test", reasons: [] },
    { file: "test/lit.test.ts", tier: "string-literal", reasons: [] },
    { file: "test/huge.test.ts", tier: "import-graph", reasons: [] },
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

  // 직접 import 한 시험은 상한을 혼자 넘어도 담는다.
  const direct = applyBudget([{ file: "test/huge.test.ts", tier: "direct-import", reasons: [] }], timings, options);
  assert.deepEqual(direct.selected.map((entry) => entry.file), ["test/huge.test.ts"]);
  assert.deepEqual(direct.skipped, []);
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

test("selectRelated reaches deeper importers through the runtime graph, nearest first, and goes wide past the threshold", () => {
  const sources = new Map([
    ["src/leaf.ts", "export const x = 1;"],
    ["src/mid.ts", 'import { x } from "./leaf";'],
    ["src/typeonly.ts", 'import type { x } from "./leaf";'],
    ["test/near.test.ts", 'import "../src/leaf";'],
    ["test/far.test.ts", 'import "../src/mid";'],
    ["test/types.test.ts", 'import "../src/typeonly";'],
  ]);
  const { reverse } = buildGraph(sources, sources.keys());
  const testSources = new Map([...sources].filter(([path]) => path.startsWith("test/")));
  const narrow = selectRelated({ changed: ["src/leaf.ts"], testSources, exists: () => true, reverseGraph: reverse });
  assert.equal(narrow.mode, "narrow");
  assert.deepEqual(narrow.selected.map((entry) => [entry.file, entry.tier]), [["test/far.test.ts", "import-graph"], ["test/near.test.ts", "direct-import"]]);
  assert.equal(narrow.chunks.length, 1);
  // 빠듯한 상한에서는 먼 것(깊이 2)부터 미룬다.
  const tight = selectRelated({ changed: ["src/leaf.ts"], testSources, exists: () => true, reverseGraph: reverse, options: { budgetSeconds: 30, startupSeconds: 0, perFileSeconds: 20, workers: 1, chunks: 1 } });
  assert.deepEqual(tight.selected.map((entry) => entry.file), ["test/near.test.ts"]);
  assert.deepEqual(tight.skipped.map((entry) => entry.file), ["test/far.test.ts"]);
  const wide = selectRelated({ changed: ["src/leaf.ts"], testSources, exists: () => true, reverseGraph: reverse, options: { wideTests: 1, wideChunks: 2, budgetSeconds: 1 } });
  assert.equal(wide.mode, "wide");
  assert.deepEqual(wide.chunks.map((chunk) => chunk.files.length).sort(), [1, 1]);
  assert.deepEqual(wide.skipped, []);
});

test("selectRelated opens enough chunks for the must-run tiers (up to mustChunks) so no chunk is planned past the budget", () => {
  // #5283: 직접 import 104개가 wideChunks 12 에 막혀 조각 하나가 예상 819초이었다.
  const n = 24;
  const sources = new Map([["src/hub.ts", "export const x = 1;"], ...Array.from({ length: n }, (_, i) => [`test/t${i}.test.ts`, 'import "../src/hub";'])]);
  const testSources = new Map([...sources].filter(([path]) => path.startsWith("test/")));
  const options = { budgetSeconds: 100, startupSeconds: 0, perFileSeconds: 0, factor: 1, workers: 1, chunks: 2, wideChunks: 3, mustChunks: 12, defaultSeconds: 50 };
  const result = selectRelated({ changed: ["src/hub.ts"], testSources, exists: () => true, options });
  assert.equal(result.mode, "narrow");
  assert.equal(result.selected.length, n);
  // 24 × 50초 = 1,200초 / 상한 100초 = 12 조각, 조각마다 2파일·100초.
  assert.equal(result.chunks.length, 12);
  assert.ok(result.chunks.every((chunk) => chunk.estWallSeconds <= options.budgetSeconds));
  // mustChunks 개로도 넘치면(#5293: 직접 import 505개) 좀은 상자로는 어떻게 나눠도 끊긴다 — 넓은 모드(긴 상자)로 올린다.
  const overflow = selectRelated({ changed: ["src/hub.ts"], testSources, exists: () => true, options: { ...options, mustChunks: 5, wideBudgetSeconds: 300 } });
  assert.equal(overflow.mode, "wide");
  assert.match(overflow.wideReasons.join(" "), /늘 담는 시험 예상 1200초 > 조각 5개 여유 500초/u);
  // 넓은 모드 조각 수 = max(wideChunks 3, 비용 1200 / 상한 300) = 4, 조각마다 300초.
  assert.equal(overflow.chunks.length, 4);
  assert.ok(overflow.chunks.every((chunk) => chunk.estWallSeconds <= 300));
});

test("planChunks spreads files by cost (LPT) deterministically", () => {
  const entries = [["a", 100], ["b", 60], ["c", 50], ["d", 10]].map(([name, sec]) => ({ file: `test/${name}.test.ts`, sec }));
  const chunks = planChunks(entries, 2, { perFileSeconds: 0, factor: 1, workers: 1, startupSeconds: 0 });
  assert.deepEqual(chunks.map((chunk) => chunk.files), [["test/a.test.ts", "test/d.test.ts"], ["test/b.test.ts", "test/c.test.ts"]]);
  assert.deepEqual(chunks.map((chunk) => chunk.estWallSeconds), [110, 110]);
  // 한 파일은 여러 워커로 쪼개지지 않으므로 조각 예상 시간은 가장 큰 파일 비용 아래로 내려가지 않는다.
  const multi = planChunks([{ file: "test/huge.test.ts", sec: 300 }], 1, { perFileSeconds: 10, factor: 1, workers: 3, startupSeconds: 20 });
  assert.equal(multi[0].estWallSeconds, 330);
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
    put("src/mid.ts", 'import "./a";\nexport const mid = 1;\n');
    put("test/c.test.ts", 'import "../src/mid";\n');
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

test("a hub path sends the PR to the wide mode regardless of reach (WIDE_HUBS)", () => {
  const result = selectRelated({ changed: ["src/ai/variation/decks.ts"], testSources: new Map([["test/x.test.ts", 'import "../src/ai/variation/decks";']]), exists: () => true });
  assert.equal(result.mode, "wide");
  assert.match(result.wideReasons.join(" "), /허브 파일 1개/u);
  const narrow = selectRelated({ changed: ["src/util/other.ts"], testSources: new Map(), exists: () => true });
  assert.equal(narrow.mode, "narrow");
});
