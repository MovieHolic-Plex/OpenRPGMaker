import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { analyzeFile, countCalls, countMismatch, makeResolver, mergeGroup, primaryModule } from "./lib.mjs";
import { chooseTargets, groupFiles, words } from "./plan.mjs";

const A = `import { describe, expect, it } from "vitest";
import { alpha } from "@/mod/alpha";

describe("alpha", () => {
  it("one", () => {
    expect(alpha()).toBe(1);
  });
});
it.each([1, 2, 3])("each %i", (n) => {
  expect(n).toBeGreaterThan(0);
});
`;

const B = `import { expect, it } from "vitest";
import { alpha } from "../src/mod/alpha";
import { beta } from "@/mod/beta";

const note = \`line one
line two\`;

it("two", () => {
  expect(beta(note)).toBe(2);
  expect(alpha()).toBe(1);
});
`;

test("countCalls: it.each 는 호출 하나, describe·expect 를 센다", () => {
  assert.deepEqual(countCalls(A), { it: 2, describe: 1, expect: 2 });
  assert.deepEqual(countCalls(B), { it: 1, describe: 0, expect: 2 });
});

test("mergeGroup: import 를 합치고 중복을 없애며 파일마다 describe 로 감싼다", () => {
  const res = mergeGroup([
    { path: "test/a.test.ts", text: A },
    { path: "test/b.test.ts", text: B },
  ]);
  assert.deepEqual(res.merged, ["test/a.test.ts", "test/b.test.ts"]);
  assert.equal(countMismatch(res), null);
  assert.equal(res.after.it, 3);
  assert.equal(res.after.expect, 4);
  assert.equal(res.after.describe, 3); // 원래 1 + 감싼 2
  // alpha 는 `../src/` 경로와 `@/` 경로가 같은 모듈이므로 한 번만 가져온다.
  assert.equal(res.text.match(/import \{ alpha \}/g).length, 1);
  assert.match(res.text, /describe\("a", \(\) => \{/);
  assert.match(res.text, /describe\("b", \(\) => \{/);
  // 템플릿 리터럴 안쪽 줄은 들여쓰지 않는다 — 값이 바뀌면 단언이 달라진다.
  assert.match(res.text, /\nline two`;/);
});

test("mergeGroup: 같은 이름이 다른 출처에 묶이면 그 파일은 뺀다", () => {
  const C = `import { it, expect } from "vitest";\nimport { alpha } from "@/other/alpha";\nit("c", () => { expect(alpha()).toBe(3); });\n`;
  const res = mergeGroup([
    { path: "test/a.test.ts", text: A },
    { path: "test/c.test.ts", text: C },
  ]);
  assert.deepEqual(res.merged, ["test/a.test.ts"]);
  assert.match(res.excluded[0].reason, /import-conflict:alpha/);
});

test("mergeGroup: 부수효과 문은 beforeAll 로, 선언은 그대로", () => {
  const D = `import { it, expect, afterEach } from "vitest";
import { installFakeDom } from "./fakeDom";

installFakeDom();
const el = () => document.createElement("div");

afterEach(() => {});

it("d", () => {
  expect(el().tagName).toBe("DIV");
});
`;
  const res = mergeGroup([
    { path: "test/a.test.ts", text: A },
    { path: "test/d.test.ts", text: D },
  ]);
  assert.equal(countMismatch(res), null);
  assert.match(res.text, /beforeAll\(\(\) => \{\n\s+installFakeDom\(\);\n\s+\}\);/);
  assert.match(res.text, /import \{[^}]*beforeAll[^}]*\} from "vitest"/);
  assert.match(res.text, /const el = \(\) =>/);
});

test("mergeGroup: 최상위 vi.setConfig({ testTimeout }) 는 beforeAll 이 아니라 describe 옵션이 된다(한도는 수집 때 읽힌다)", () => {
  const T = `import { it, expect, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000 });

it("t", () => {
  expect(1).toBe(1);
});
`;
  const res = mergeGroup([
    { path: "test/a.test.ts", text: A },
    { path: "test/t.test.ts", text: T },
  ]);
  assert.equal(countMismatch(res), null);
  assert.match(res.text, /describe\("t", \{ timeout: 120000 \}, \(\) => \{/);
  assert.doesNotMatch(res.text, /setConfig/);
  assert.doesNotMatch(res.text, /beforeAll/);
  const hook = `import { it, vi } from "vitest";\nvi.setConfig({ testTimeout: 1, hookTimeout: 2 });\nit("h", () => {});\n`;
  assert.ok(analyzeFile("test/h.test.ts", hook).reasons.includes("set-config"));
});

test("analyzeFile: 모킹·최상위 await·수집 때 부르는 호출 앞의 부수효과는 합치지 않는다", () => {
  const mocked = `import { vi, it } from "vitest";\nvi.mock("@/x", () => ({}));\nit("m", () => {});\n`;
  const tla = `import { it } from "vitest";\nconst v = await Promise.resolve(1);\nit("t", () => { void v; });\n`;
  const eager = `import { it } from "vitest";\nsetup();\nconst x = build();\nit("e", () => { void x; });\n`;
  assert.deepEqual(analyzeFile("test/m.test.ts", mocked).mocks.length, 1);
  assert.ok(analyzeFile("test/t.test.ts", tla).reasons.includes("top-level-await"));
  assert.ok(analyzeFile("test/e.test.ts", eager).reasons.includes("effect-before-eager-decl"));
});

test("analyzeFile: 되돌리지 않는 가짜 타이머·전역 스텁은 합치지 않는다", () => {
  const leaky = `import { it, vi } from "vitest";\nit("a", () => { vi.useFakeTimers(); });\n`;
  const clean = `import { it, vi } from "vitest";\nit("a", () => { vi.useFakeTimers(); vi.useRealTimers(); });\n`;
  const stub = `import { it, vi } from "vitest";\nit("a", () => { vi.stubGlobal("x", 1); });\n`;
  assert.ok(analyzeFile("test/a.test.ts", leaky).reasons.includes("fake-timers-leak"));
  assert.deepEqual(analyzeFile("test/b.test.ts", clean).reasons, []);
  assert.ok(analyzeFile("test/c.test.ts", stub).reasons.includes("global-stub-leak"));
});

test("mergeGroup: teardownImport 가 있으면 describe 마다 isolateTimers() 를 맨 앞에 부른다", () => {
  const res = mergeGroup(
    [
      { path: "test/a.test.ts", text: A },
      { path: "test/b.test.ts", text: B },
    ],
    { teardownImport: "./mergedTeardown" },
  );
  assert.equal(countMismatch(res), null);
  assert.match(res.text, /import \{ isolateTimers \} from "\.\/mergedTeardown";/);
  assert.equal(res.text.match(/^  isolateTimers\(\);$/gm).length, 2);
  assert.match(res.text, /describe\("a", \(\) => \{\n  isolateTimers\(\);/);
});

test("mergeGroup: 모킹이 서로 다르면 뺀다, 같으면 한 번만 올린다", () => {
  const m1 = `import { vi, it } from "vitest";\nvi.mock("@/x", () => ({ a: 1 }));\nit("m1", () => {});\n`;
  const m2 = `import { vi, it } from "vitest";\nvi.mock("@/x", () => ({ a: 1 }));\nit("m2", () => {});\n`;
  const m3 = `import { vi, it } from "vitest";\nvi.mock("@/x", () => ({ a: 2 }));\nit("m3", () => {});\n`;
  const res = mergeGroup([
    { path: "test/m1.test.ts", text: m1 },
    { path: "test/m2.test.ts", text: m2 },
    { path: "test/m3.test.ts", text: m3 },
  ]);
  assert.deepEqual(res.merged, ["test/m1.test.ts", "test/m2.test.ts"]);
  assert.equal(res.text.match(/vi\.mock\(/g).length, 1);
});

test("mergeGroup: @vitest-environment 가 다르면 뺀다", () => {
  const dom = `// @vitest-environment happy-dom\nimport { it } from "vitest";\nit("dom", () => {});\n`;
  const res = mergeGroup([
    { path: "test/a.test.ts", text: A },
    { path: "test/dom.test.ts", text: dom },
  ]);
  assert.deepEqual(res.merged, ["test/a.test.ts"]);
  assert.match(res.excluded[0].reason, /env happy-dom/);
});

test("primaryModule: 허브를 빼고 가장 구체적인 @/ 모듈", () => {
  const info = analyzeFile("test/x.test.ts", `import { it } from "vitest";\nimport { createBlankProject } from "@/project/defaults";\nimport { f } from "@/editor/tools/deep/leaf";\nimport { g } from "@/editor/tools";\nit("x", () => {});\n`);
  assert.equal(primaryModule(info.imports), "@/editor/tools/deep/leaf");
});

test("groupFiles: 같은 폴더·환경·모듈끼리만 묶고, 대상 이름은 모듈 이름을 쓴다", () => {
  const mk = (base, primary, dir = "test", env = "node") => ({ path: `${dir}/${base}.test.ts`, dir, base, env, mockSig: "", primary, wall: 1, cases: 1 });
  const infos = [mk("fooA", "@/m/foo"), mk("fooB", "@/m/foo"), mk("fooC", "@/m/foo"), mk("other", "@/m/bar"), mk("fooD", "@/m/foo", "test/sub"), mk("fooE", "@/m/foo", "test", "happy-dom")];
  const groups = groupFiles(infos);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].files.map((f) => f.base), ["fooA", "fooB", "fooC"]);
  const [t] = chooseTargets(groups, new Set(infos.map((f) => f.path)));
  assert.equal(t.target, "test/foo.test.ts");
  assert.deepEqual(words("aiV2LookMismatch"), ["ai", "V2", "Look", "Mismatch"]);
});

test("mergeGroup + makeResolver: 재수출 경로가 달라도 같은 바인딩이면 한 번만 가져온다, 진짜 다른 것은 뺀다", () => {
  const root = mkdtempSync(join(tmpdir(), "test-merge-"));
  try {
    const put = (rel, text) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    };
    put("src/lib/impl.ts", "export function make() { return 1; }\nexport const OTHER = 2;\n");
    put("src/lib/index.ts", 'export * from "./impl";\n');
    put("src/lib/barrel.ts", 'export { make as make } from "./impl";\n');
    put("src/lib2/impl.ts", "export function make() { return 9; }\n");
    const t = (name, from) => `import { it, expect } from "vitest";\nimport { make } from "${from}";\nit("${name}", () => { expect(make()).toBeTruthy(); });\n`;
    const resolver = makeResolver(root);
    const res = mergeGroup(
      [
        { path: "test/x.test.ts", text: t("x", "@/lib") },
        { path: "test/y.test.ts", text: t("y", "@/lib/barrel") },
        { path: "test/z.test.ts", text: t("z", "@/lib2/impl") },
      ],
      { resolver },
    );
    assert.deepEqual(res.merged, ["test/x.test.ts", "test/y.test.ts"]);
    assert.equal(res.text.match(/import \{ make \}/g).length, 1);
    assert.match(res.excluded[0].reason, /import-conflict:make/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
