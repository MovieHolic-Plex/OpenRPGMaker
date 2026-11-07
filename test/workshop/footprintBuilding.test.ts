// 건물 판정은 머리 낱말만 본다 — 「빵가게 간판」「창고 상자」는 물건이라 공방에서 그린다(2026-11-07 agent-custom-tiles).
import { describe, expect, it } from "vitest";
import { decideFootprint, isBuildingName } from "@/harnesses/_core/workshop/footprint";

describe("건물 이름 판정", () => {
  it("가게·창고 낱말이 앞에 붙은 물건은 건물이 아니다", () => {
    for (const name of ["빵가게 간판", "창고 상자", "대장간 모루", "tavern sign", "warehouse crate"]) {
      expect(isBuildingName(name), name).toBe(false);
      expect(decideFootprint(name, name).building, name).toBe(false);
    }
  });
  it("머리 낱말이 건물이면 그대로 건물이다", () => {
    for (const name of ["시계탑", "고양이 집", "작은 여관", "stone tower"]) expect(isBuildingName(name), name).toBe(true);
  });
});
