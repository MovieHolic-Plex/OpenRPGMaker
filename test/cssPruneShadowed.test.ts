// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { flattenImports, indexDeclarations } from "../scripts/css-flatten.mjs";
import { findShadowed, findShadowedPairs, pruneFile, pruneSource } from "../scripts/css-prune-shadowed.mjs";

const ROOT = resolve(process.cwd(), "test/fixtures/css-surfaces/prune");

describe("css-prune-shadowed", () => {
  const decls = indexDeclarations(flattenImports(resolve(ROOT, "index.css")), ROOT);
  it("같은 선택자·속성·조건의 앞 선언만 가려진 것으로 본다", () => {
    const shadowed = findShadowed(decls);
    expect(shadowed.map((d) => `${d.file}:${d.line} ${d.sel} ${d.prop}`)).toEqual(["a.css:1 .k color"]);
    // :hover 와 @media 는 조건이 달라 남고, .z 는 앞이 !important 라 뒤의 일반 선언에 가려지지 않는다
  });
  it("가려진 선언마다 그것을 가린 가장 가까운 뒤 선언을 짝지어 준다", () => {
    const pairs = findShadowedPairs(decls);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].loser).toMatchObject({ file: "a.css", line: 1, prop: "color", value: "red" });
    expect(pairs[0].winner).toMatchObject({ file: "b.css", line: 1, prop: "color", value: "black" });
  });
  it("선언을 지우고 빈 규칙을 정리한다", () => {
    const out = pruneFile(resolve(ROOT, "a.css"), [{ line: 1, prop: "color" }]);
    expect(out).toContain(".k { margin: 0; }");
    expect(out).not.toContain("color: red");
    // 건드리지 않은 줄은 그대로다
    expect(out).toContain(".k:hover { color: blue; }");
    expect(out).toContain("@media (max-width: 700px) { .k { color: green; } }");
  });
  it("규칙이 비면 규칙을, 그래서 @media 가 비면 @media 도 지운다", () => {
    const out = pruneFile(resolve(ROOT, "a.css"), [{ line: 2, prop: "color" }, { line: 3, prop: "color" }]);
    expect(out).not.toContain(".k:hover");
    expect(out).not.toContain("@media");
    expect(out).toContain(".k { color: red; margin: 0; }");
    expect(out).toContain(".z { padding: 1px !important; }");
  });
  it("한 줄에 같은 속성이 여럿이면 값·!important 까지 맞는 것만, 앞에서부터 지운다", () => {
    const src = ".k { color: red !important; color: blue; color: green; }\n";
    const stats = { removed: [], skipped: [] };
    const out = pruneSource(src, [{ line: 1, prop: "color", value: "blue", imp: false }], { stats, keepFallbacks: false });
    expect(out).toBe(".k { color: red !important; color: green; }\n");
    expect(stats.removed).toHaveLength(1);
  });
  it("같은 규칙 안에서 다른 값으로 다시 선언된 앞 선언은 폴백이라 기본으로 남긴다", () => {
    const src = ".k {\n  height: 100vh;\n  height: 100dvh;\n  color: red;\n  color: red;\n}\n";
    const stats = { removed: [], skipped: [] };
    const targets = [{ line: 2, prop: "height", value: "100vh" }, { line: 4, prop: "color", value: "red" }];
    // 폴백은 남고, 값이 같은 순수 중복은 지워진다
    expect(pruneSource(src, targets, { stats })).toBe(".k {\n  height: 100vh;\n  height: 100dvh;\n  color: red;\n}\n");
    expect(stats.skipped.map((s) => s.reason)).toEqual([expect.stringContaining("fallback")]);
    expect(stats.removed).toHaveLength(1);
    // keepFallbacks: false 면 폴백도 지운다
    expect(pruneSource(src, targets, { keepFallbacks: false })).toBe(".k {\n  height: 100dvh;\n  color: red;\n}\n");
  });
  it("선택자 목록 규칙은 모든 선택자가 가려졌을 때만 지운다", () => {
    const src = ".a, .b { color: red; }\n.a { color: blue; }\n";
    const stats = { removed: [], skipped: [] };
    // .a 만 가려졌다 — 같은 선언이 .b 에도 쓰이므로 남겨야 한다
    let out = pruneSource(src, [{ line: 1, prop: "color", sel: ".a" }], { stats });
    expect(out).toBe(src);
    expect(stats.skipped).toHaveLength(1);
    // .a 와 .b 가 모두 가려지면 지운다 — 규칙도 빈다
    out = pruneSource(src, [{ line: 1, prop: "color", sel: ".a" }, { line: 1, prop: "color", sel: ".b" }]);
    expect(out).toBe(".a { color: blue; }\n");
  });
  it("같은 줄에 붙은 뒤 주석은 선언과 함께 지우고, 다음 줄 주석은 남긴다", () => {
    const src = ":root {\n  /* 배경 */\n  --a: 1;    /* 본문 */\n  --b: 2; /* 탭 */\n  /* 다음 */\n  --c: 3;\n}\n";
    const out = pruneSource(src, [{ line: 3, prop: "--a" }, { line: 4, prop: "--b" }]);
    expect(out).toBe(":root {\n  /* 배경 */\n  /* 다음 */\n  --c: 3;\n}\n");
  });
  it("건드리지 않은 소스는 BOM 까지 그대로 돌려준다", () => {
    const src = "﻿.k {\n  color: red;\n}\n\n/* c */\n.z{margin:0}";
    expect(pruneSource(src, [])).toBe(src);
  });
  it("숫자만 넘기면 거부한다 — 한 줄에는 여러 선언이 있을 수 있다", () => {
    expect(() => pruneSource(".k { a: 1; }", [1] as unknown as { line: number; prop: string }[])).toThrow(TypeError);
  });
});
