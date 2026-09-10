// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fingerprint, runSurfaceChecks } from "../scripts/check-css-surfaces.mjs";

const ROOT = resolve(process.cwd(), "test/fixtures/css-surfaces/gate");
const registry = JSON.parse(readFileSync(resolve(ROOT, "registry.json"), "utf8"));

function run() {
  return runSurfaceChecks({ stylesRoot: resolve(ROOT, "styles"), srcRoot: resolve(ROOT, "src"), registry, entries: [resolve(ROOT, "styles/index.css")] });
}
const by = (rule: string) => run().violations.filter((v) => v.rule === rule);

describe("check-css-surfaces", () => {
  it("R1 언레이어 규칙을 (file, sel) 당 한 번만 잡는다 — 선언이 둘이어도 위반은 하나", () => {
    const unlayered = by("R1").filter((v) => v.message.startsWith("언레이어"));
    expect(unlayered).toEqual([expect.objectContaining({ file: "index.css", line: 5, sel: ".unlayered-leak", message: expect.stringContaining(".unlayered-leak") })]);
    expect(run().counts.alpha.unlayered).toBe(0);
    expect(run().counts.beta.unlayered).toBe(0);
    expect(run().counts.unassigned.unlayered).toBe(1);
  });
  it("허브 깊이 1 위반을 표면별 hubs 로 센다 (alpha/nested.css 가 진입 시트가 아닌데 @import)", () => {
    const hubs = by("R1").filter((v) => v.message.includes("허브 깊이"));
    expect(hubs).toEqual([expect.objectContaining({ surface: "alpha", file: "alpha/nested.css" })]);
    expect(run().counts.alpha.hubs).toBe(1);
    expect(run().counts.beta.hubs).toBe(0);
    expect(run().counts.unassigned.hubs).toBe(0);
  });
  it("R2 표면 밖 접두어를 잡는다 (alpha 시트가 bt- 를 건드림); 상태 낱말은 정확히 일치할 때만 허용", () => {
    expect(by("R2")).toEqual([
      expect.objectContaining({ surface: "alpha", file: "alpha/a.css", line: 2, detail: "bt-row" }),
      expect.objectContaining({ surface: "alpha", file: "alpha/a.css", line: 4, detail: "selected-tile" }),
    ]);
  });
  it("R3 표면별 !important 를 센다", () => {
    expect(run().counts.alpha.important).toBe(1);
    expect(run().counts.beta.important).toBe(0);
  });
  it("R4 폴백 없는 미정의 변수만 잡는다 (--nope2 는 폴백이 토큰으로 떨어져 통과, --bt-tone 은 같은 표면 정의)", () => {
    expect(by("R4")).toEqual([expect.objectContaining({ file: "alpha/a.css", detail: "--nope", message: expect.stringContaining("--nope") })]);
    expect(by("R4")).toHaveLength(1);
  });
  it("R5 TS 에 없는 클래스만 요구하는 규칙을 잡고, 동적 접두어(bt-)는 살려 둔다", () => {
    const r5 = by("R5").map((v) => v.message).sort();
    expect(r5).toEqual([expect.stringContaining(".al-ghost"), expect.stringContaining(".al-nested"), expect.stringContaining(".unlayered-leak")]);
  });
  it("R6 순서 주석을 잡는다", () => {
    expect(by("R6")).toEqual([expect.objectContaining({ file: "alpha/index.css", line: 1, detail: "/* 반드시 beta 뒤에 와야 이긴다 */" })]);
  });
  it("지문은 줄 번호를 넣지 않고 rule|file|sel|detail 로 만들어 기준선 왕복이 안정적이다", () => {
    const r2 = by("R2")[0];
    expect(fingerprint(r2)).toBe("R2|alpha/a.css|.al-card .bt-row|bt-row");
    expect(fingerprint(r2)).not.toContain(`|${r2.line}|`);
    const known = new Set(run().violations.map(fingerprint));
    expect(run().violations.every((v) => known.has(fingerprint(v)))).toBe(true);
  });
});
