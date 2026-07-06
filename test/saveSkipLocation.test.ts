// 저장 스킵 모드 판별(도그푸딩 결함 ⑩) — 배너 노출 판단 근거.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function isSaveSkippedAt(search: string): Promise<boolean> {
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search },
    localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  });
  vi.resetModules();
  const { isSaveSkippedLocation } = await import("@/project/devProjectPersistence");
  return isSaveSkippedLocation();
}

describe("isSaveSkippedLocation", () => {
  it("blankProject/freshProject 위치에서 true", async () => {
    expect(await isSaveSkippedAt("?blankProject=1")).toBe(true);
    expect(await isSaveSkippedAt("?freshProject=1")).toBe(true);
  });

  it("devProject(로컬 저장)·일반 위치에서 false", async () => {
    expect(await isSaveSkippedAt("?devProject=1&logCabinShowcase=1")).toBe(false);
    expect(await isSaveSkippedAt("")).toBe(false);
  });
});
