import { describe, expect, it } from "vitest";
import { faceCellSuffix, planFacesetSheetSplit } from "@/assets/facesetSheetSlicing";

describe("planFacesetSheetSplit", () => {
  it("192×192 시트는 48px 낱장 16장으로 나눌 계획을 낸다", () => {
    expect(planFacesetSheetSplit(192, 192)).toEqual({ columns: 4, rows: 4, count: 16, cellSize: 48 });
  });

  it("96×96 시트는 4장으로 나눈다", () => {
    expect(planFacesetSheetSplit(96, 96)).toEqual({ columns: 2, rows: 2, count: 4, cellSize: 48 });
  });

  it("이미 낱장인 48×48 은 나눌 것이 없다", () => {
    expect(planFacesetSheetSplit(48, 48)).toBeNull();
  });

  it("비정사각 낱장 아트는 나누지 않는다", () => {
    expect(planFacesetSheetSplit(48, 96)).toBeNull();
    expect(planFacesetSheetSplit(240, 48)).toBeNull();
  });

  it("48 배수가 아닌 정사각형은 시트가 아니다", () => {
    expect(planFacesetSheetSplit(200, 200)).toBeNull();
  });

  it("유효하지 않은 크기는 나누지 않는다", () => {
    expect(planFacesetSheetSplit(Number.NaN, 192)).toBeNull();
    expect(planFacesetSheetSplit(0, 0)).toBeNull();
  });

  it("칸 번호는 파일 이름 규약대로 두 자리다", () => {
    expect(faceCellSuffix(0)).toBe("00");
    expect(faceCellSuffix(7)).toBe("07");
    expect(faceCellSuffix(15)).toBe("15");
  });
});
