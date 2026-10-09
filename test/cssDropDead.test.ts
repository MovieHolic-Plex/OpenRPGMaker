// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { indexDeclarations } from "../scripts/css-flatten.mjs";
import { dropDeadRules, dropDeadSource, normSel } from "../scripts/css-drop-dead.mjs";

const ROOT = resolve(process.cwd(), "test/fixtures/css-surfaces/gate/styles");
const WS = resolve(process.cwd(), "test/fixtures/css-surfaces/drop-dead");

describe("css-drop-dead", () => {
  it("죽은 선택자의 규칙을 지우고 산 규칙은 남긴다", () => {
    const out = dropDeadRules(resolve(ROOT, "alpha/a.css"), new Set([".al-ghost"]));
    expect(out).not.toContain(".al-ghost");
    expect(out).toContain(".al-card");
    expect(out).toContain(".al-card .bt-row");
  });
  it("선택자 목록 중 일부만 죽었으면 그 선택자만 목록에서 뺀다", () => {
    const src = ".a,\n.b { margin: 0; }\n.c { padding: 0; }\n";
    const stats = { removed: [], skipped: [] };
    expect(dropDeadSource(src, new Set([".b"]), { stats })).toBe(".a { margin: 0; }\n.c { padding: 0; }\n");
    expect(stats.removed).toEqual([{ sel: ".b", line: 1, action: "remove-from-list" }]);
    // 목록 전부가 죽으면 규칙을 통째로 지운다
    expect(dropDeadSource(src, new Set([".a", ".b"]))).toBe(".c { padding: 0; }\n");
  });
  it("선택자 정규화는 게이트(indexDeclarations)와 같다 — 공백만 접고 소문자로 바꾸지 않는다", () => {
    const abs = resolve(WS, "ws.css");
    const gate = indexDeclarations([{ file: abs, depth: 0, layer: null, copy: 1 }], WS).map((d) => d.sel);
    const raw: string[] = [];
    postcss.parse(readFileSync(abs, "utf8")).walkRules((r) => raw.push(...r.selectors));
    expect(raw.map(normSel)).toEqual(gate);
    expect(gate).toEqual([".a > .b", '[data-x="A B"]', ".c", ".d"]);
    // 게이트가 낸 정규화된 선택자로 원문의 규칙을 찾는다
    const out = dropDeadRules(abs, new Set([".a > .b", '[data-x="A B"]']));
    expect(out).toBe(".c,\n.d { margin: 0; }\n");
  });
  it("@keyframes 안과 중첩 규칙은 건드리지 않고 건너뛴 이유를 남긴다", () => {
    const src = [
      "@keyframes spin { from { opacity: 0; } .x { opacity: 1; } }",
      "@-webkit-keyframes spin { .x { opacity: 1; } }",
      ".p { color: red; .x { color: blue; } }",
      ".x { color: green; }",
      "",
    ].join("\n");
    const stats = { removed: [], skipped: [] };
    const out = dropDeadSource(src, new Set([".x"]), { stats });
    expect(out).toBe([
      "@keyframes spin { from { opacity: 0; } .x { opacity: 1; } }",
      "@-webkit-keyframes spin { .x { opacity: 1; } }",
      ".p { color: red; .x { color: blue; } }",
      "",
    ].join("\n"));
    expect(stats.removed).toEqual([{ sel: ".x", line: 4, action: "remove-rule" }]);
    expect(stats.skipped.map((s) => s.reason)).toEqual(["inside @keyframes", "inside @-webkit-keyframes", "nested rule"]);
  });
  it("BOM 과 건드리지 않은 서식을 그대로 둔다", () => {
    const src = "﻿/* head */\n.a {\n  color: red;\n}\n\n\n.dead   {\n\tcolor: blue;\n}\n.b { margin:0 }\n";
    const out = dropDeadSource(src, new Set([".dead"]));
    expect(out.startsWith("﻿/* head */\n.a {\n  color: red;\n}\n")).toBe(true);
    expect(out).not.toContain(".dead");
    expect(out).toContain(".b { margin:0 }\n");
    // 죽은 선택자가 없으면 원문 그대로다
    expect(dropDeadSource(src, new Set([".zzz"]))).toBe(src);
  });
  it("규칙을 지워 @media 가 비면 @media 도 지우고, @layer·@import 는 비어도 남긴다", () => {
    const src = "@import \"x.css\";\n@media (max-width: 700px) {\n  .dead { color: red; }\n}\n@layer a {\n  .dead { color: red; }\n}\n.k { color: red; } /* k */\n.dead { color: blue; } /* 설명 */\n";
    const out = dropDeadSource(src, new Set([".dead"]));
    expect(out).not.toContain("@media");
    expect(out).not.toContain(".dead");
    expect(out).not.toContain("설명");
    expect(out).toContain("@import \"x.css\";");
    expect(out).toContain("@layer a {");
    expect(out).toContain(".k { color: red; } /* k */");
  });
});
