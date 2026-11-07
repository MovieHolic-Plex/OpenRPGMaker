// test/releaseAssets.test.ts
// 릴리스 자산 계약 — «자산이 0개인 릴리스가 latest 가 되던» 사고(v0.408.0, 2026-11-07)의
// 판정을 순수 함수로 고정한다. 이 검사가 느슨해지면 순서를 뒤집어도 워크플로가 발행해 버린다.
import { describe, expect, it } from "vitest";
import { checkDesktopAssets, highestReleaseTag, requiredDesktopAssets } from "../scripts/lib/releaseAssets.mjs";

const full = (version: string, size = 1_100_000_000) =>
  requiredDesktopAssets(version).map((name) => ({ name, size }));

describe("requiredDesktopAssets", () => {
  it("README 가 버전 없이 부르는 이름 3개와 버전 이름 3개를 요구한다", () => {
    expect(requiredDesktopAssets("0.408.0")).toEqual([
      "OPRN.Studio-windows.exe",
      "OPRN.Studio-windows.zip",
      "OPRN.Studio-linux.AppImage",
      "OPRN.Studio.0.408.0.exe",
      "OPRN.Studio-0.408.0-win.zip",
      "OPRN.Studio-0.408.0.AppImage",
    ]);
  });

  it("v 접두어를 받아들인다", () => {
    expect(requiredDesktopAssets("v0.408.0")).toEqual(requiredDesktopAssets("0.408.0"));
  });

  it("X.Y.Z 가 아니면 던진다 — 잘못된 이름으로 검사하지 않게", () => {
    expect(() => requiredDesktopAssets("0.408")).toThrow(/X\.Y\.Z/);
    expect(() => requiredDesktopAssets("")).toThrow(/X\.Y\.Z/);
  });
});

describe("checkDesktopAssets", () => {
  it("자산이 0개인 릴리스는 불통과 — 이것이 v0.408.0 이 latest 가 된 상태다", () => {
    const result = checkDesktopAssets("0.408.0", []);
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(6);
    expect(result.empty).toEqual([]);
  });

  it("이름이 다 맞고 크기가 있으면 통과", () => {
    expect(checkDesktopAssets("0.408.0", full("0.408.0"))).toEqual({ ok: true, missing: [], empty: [] });
  });

  it("크기 0 인 자산(업로드 미완료·starter)은 불통과", () => {
    const assets = full("0.408.0");
    assets[0] = { name: "OPRN.Studio-windows.exe", size: 0, state: "starter" };
    const result = checkDesktopAssets("0.408.0", assets);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.empty).toEqual(["OPRN.Studio-windows.exe"]);
  });

  it("하나만 빠져도 불통과하고 그 이름을 지목한다", () => {
    const assets = full("0.408.0").filter((asset) => asset.name !== "OPRN.Studio-linux.AppImage");
    const result = checkDesktopAssets("0.408.0", assets);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["OPRN.Studio-linux.AppImage"]);
  });

  it("옛 버전 이름만 있으면(다른 릴리스 자산) 이 버전은 불통과", () => {
    const result = checkDesktopAssets("0.408.0", full("0.407.0"));
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(3);
  });
});

describe("highestReleaseTag", () => {
  it("숫자 세 자리로 비교한다 — v0.9.0 < v0.10.0", () => {
    expect(highestReleaseTag(["v0.9.0", "v0.10.0", "v0.408.0"])).toBe("v0.408.0");
    expect(highestReleaseTag(["v0.9.0", "v0.10.0"])).toBe("v0.10.0");
  });

  it("릴리스 태그가 아니면 건너뛴다", () => {
    expect(highestReleaseTag(["nightly", "v0.1.0-rc1", "v0.2.0"])).toBe("v0.2.0");
  });

  it("하나도 없으면 null — 이때는 latest 를 건드리지 않는다", () => {
    expect(highestReleaseTag([])).toBeNull();
  });
});
