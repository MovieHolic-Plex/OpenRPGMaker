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

// 각 케이스는 window 를 새로 스텁하고 `vi.resetModules()` 뒤에 대상 모듈을 다시 적재한다.
// 즉 케이스마다 모듈 그래프를 처음부터 변환하는 비용이 붙는다(빈 머신에서도 케이스당 수 초).
// 그 비용은 제품 지연이 아니라 테스트 러너의 재적재 비용이라, 기본 15s testTimeout 을
// 넘겨 잡는다 — 안 그러면 머신이 바쁠 때 제품과 무관하게 빨개진다.
const MODULE_RELOAD_BUDGET_MS = 60_000;

describe("isSaveSkippedLocation", () => {
  it("blankProject/freshProject 위치에서 true", async () => {
    expect(await isSaveSkippedAt("?blankProject=1")).toBe(true);
    expect(await isSaveSkippedAt("?freshProject=1")).toBe(true);
  }, MODULE_RELOAD_BUDGET_MS);

  it("devProject(로컬 저장)·일반 위치에서 false", async () => {
    expect(await isSaveSkippedAt("?devProject=1&logCabinShowcase=1")).toBe(false);
    expect(await isSaveSkippedAt("")).toBe(false);
  }, MODULE_RELOAD_BUDGET_MS);
});
