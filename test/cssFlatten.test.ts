// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { flattenImports, indexDeclarations, lastCompound, specificity } from "../scripts/css-flatten.mjs";

const ROOT = resolve(process.cwd(), "test/fixtures/css-surfaces/flat");

describe("css-flatten", () => {
  it("평탄화 순서와 import 레이어를 기록한다", () => {
    const order = flattenImports(resolve(ROOT, "entry.css"));
    expect(order.map((o) => [o.file, o.layer])).toEqual([
      [resolve(ROOT, "entry.css"), null],
      [resolve(ROOT, "a.css"), "one"],
      [resolve(ROOT, "b.css"), null],
    ]);
  });
  it("선언에 파일·줄·레이어·@media·!important 를 붙인다", () => {
    const decls = indexDeclarations(flattenImports(resolve(ROOT, "entry.css")), ROOT);
    const x = decls.filter((d) => d.sel === ".x");
    expect(x).toHaveLength(2);
    expect(x[0]).toMatchObject({ file: "a.css", line: 1, layer: "one", at: "", prop: "color", value: "blue", imp: false });
    expect(x[1]).toMatchObject({ layer: "one", at: "@media (max-width: 700px)", imp: true });
    const y = decls.find((d) => d.prop === "margin");
    expect(y).toMatchObject({ file: "b.css", layer: "two" });
    const plain = decls.find((d) => d.sel === ".plain");
    expect(plain?.layer).toBeNull();
    // 진입 시트 자신의 규칙은 import 뒤에 온다
    expect(plain!.seq).toBeGreaterThan(y!.seq);
  });
  it("특이도와 마지막 복합 선택자", () => {
    expect(specificity(".y#id:hover > b::before")).toBe(10000 + 200 + 2);
    expect(lastCompound(".a .b:hover > .c.d::after")).toBe(".c.d");
  });
});
