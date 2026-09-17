// 커밋된 플레이어 번들 ↔ tokens.css 드리프트 검사.
// 핵심은 **정규화**다: 미니파이어가 0.92→.92, 120ms→.12s 로 바꾸므로 원문 비교를 하면
// 실측 26건이 전부 거짓 양성이 된다. 거짓 양성이 많은 게이트는 곧 꺼진다.
import { describe, expect, it } from "vitest";
import { compareBundleTokens, normalizeValue, parseTokens } from "../scripts/check-player-bundle-tokens.mjs";

describe("normalizeValue — 미니파이어 표기 접기", () => {
  it("선행 0 생략을 편다", () => {
    expect(normalizeValue("rgba(15, 23, 42, .08)")).toBe(normalizeValue("rgba(15, 23, 42, 0.08)"));
  });
  it("ms 와 s 를 같게 본다", () => {
    expect(normalizeValue(".12s ease")).toBe(normalizeValue("120ms ease"));
    expect(normalizeValue(".16s ease")).toBe(normalizeValue("160ms ease"));
  });
  it("후행 0 을 접는다", () => {
    expect(normalizeValue("rgba(15, 23, 42, 0.40)")).toBe(normalizeValue("rgba(15,23,42,.4)"));
  });
  it("의미가 다르면 다르게 본다", () => {
    expect(normalizeValue("0 0 0 2px rgba(74, 87, 214, 0.45)"))
      .not.toBe(normalizeValue("0 0 0 4px rgba(108, 121, 242, .55)"));
    expect(normalizeValue("#4A57D6")).not.toBe(normalizeValue("#000000"));
  });
});

describe("compareBundleTokens", () => {
  it("번들에 없는 토큰을 잡는다", () => {
    const r = compareBundleTokens({
      bundleCss: ":root{--a:1px}",
      tokensCss: ":root{--a:1px;--b:2px}",
    });
    expect(r.missing).toEqual(["--b"]);
    expect(r.mismatched).toHaveLength(0);
  });

  it("서식만 다른 값은 통과시킨다", () => {
    const r = compareBundleTokens({
      bundleCss: ":root{--bg:rgba(15,23,42,.08);--t:.12s ease}",
      tokensCss: ":root{--bg:rgba(15, 23, 42, 0.08);--t:120ms ease}",
    });
    expect(r.missing).toHaveLength(0);
    expect(r.mismatched).toHaveLength(0);
  });

  it("실제로 값이 다르면 잡는다", () => {
    const r = compareBundleTokens({
      bundleCss: ":root{--accent:#000000}",
      tokensCss: ":root{--accent:#4A57D6}",
    });
    expect(r.mismatched).toHaveLength(1);
    expect(r.mismatched[0].token).toBe("--accent");
  });
});

describe("parseTokens", () => {
  it("선언을 토큰 맵으로 읽는다", () => {
    expect(parseTokens(":root{--a:1px;--b:rgba(0,0,0,.5)}")).toEqual({ "--a": "1px", "--b": "rgba(0,0,0,.5)" });
  });
});
