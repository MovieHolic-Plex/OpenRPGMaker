// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { runSurfaceChecks } from "../scripts/check-css-surfaces.mjs";

const ROOT = resolve(process.cwd(), "test/fixtures/css-surfaces/gate");
const registry = JSON.parse(readFileSync(resolve(ROOT, "registry.json"), "utf8"));

function run() {
  return runSurfaceChecks({ stylesRoot: resolve(ROOT, "styles"), srcRoot: resolve(ROOT, "src"), registry, entries: [resolve(ROOT, "styles/index.css")] });
}
const by = (rule: string) => run().violations.filter((v) => v.rule === rule);

describe("check-css-surfaces", () => {
  it("R1 언레이어 규칙을 잡는다", () => {
    expect(by("R1")).toEqual([expect.objectContaining({ file: "index.css", line: 5, message: expect.stringContaining(".unlayered-leak") })]);
  });
  it("R2 표면 밖 접두어를 잡는다 (alpha 시트가 bt- 를 건드림)", () => {
    expect(by("R2")).toEqual([expect.objectContaining({ surface: "alpha", file: "alpha/a.css", line: 2 })]);
  });
  it("R3 표면별 !important 를 센다", () => {
    expect(run().counts.alpha.important).toBe(1);
    expect(run().counts.beta.important).toBe(0);
  });
  it("R4 폴백 없는 미정의 변수만 잡는다 (--nope2 는 폴백이 토큰으로 떨어져 통과, --bt-tone 은 같은 표면 정의)", () => {
    expect(by("R4")).toEqual([expect.objectContaining({ file: "alpha/a.css", message: expect.stringContaining("--nope") })]);
    expect(by("R4")).toHaveLength(1);
  });
  it("R5 TS 에 없는 클래스만 요구하는 규칙을 잡고, 동적 접두어(bt-)는 살려 둔다", () => {
    const r5 = by("R5").map((v) => v.message).sort();
    expect(r5).toEqual([expect.stringContaining(".al-ghost"), expect.stringContaining(".unlayered-leak")]);
  });
  it("R6 순서 주석을 잡는다", () => {
    expect(by("R6")).toEqual([expect.objectContaining({ file: "alpha/index.css", line: 1 })]);
  });
});
