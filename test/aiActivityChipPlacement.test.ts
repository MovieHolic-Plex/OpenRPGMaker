import { describe, expect, it } from "vitest";
import {
  CHIP_CORNER_INSET,
  placeAiActivityChip,
} from "@/editor/aiActivityChipPlacement";

const viewport = { width: 400, height: 300 };
const chip = { width: 80, height: 24 };
const region = { x: 10, y: 8, width: 6, height: 4 };

describe("placeAiActivityChip", () => {
  it("카메라 좌표를 반영해 영역 위 중앙에 배치한다", () => {
    expect(placeAiActivityChip({
      region,
      camera: { scrollX: 32, scrollY: 16, zoom: 1.5 },
      viewport,
      chip,
    })).toEqual({ left: 224, top: 136, mode: "above", anchored: true });
  });

  it("카메라 스크롤과 줌이 바뀌면 정확히 함께 이동한다", () => {
    expect(placeAiActivityChip({
      region,
      camera: { scrollX: 56, scrollY: 20, zoom: 1.25 },
      viewport,
      chip,
    })).toEqual({ left: 150, top: 103, mode: "above", anchored: true });
  });

  it("영역 위 공간이 없으면 영역 아래에 배치한다", () => {
    expect(placeAiActivityChip({
      region: { x: 4, y: 0, width: 4, height: 2 },
      camera: { scrollX: 0, scrollY: 0, zoom: 1 },
      viewport,
      chip,
    })).toEqual({ left: 56, top: 40, mode: "below", anchored: true });
  });

  it("영역 위와 아래가 모두 넘치면 영역 안쪽에 배치한다", () => {
    expect(placeAiActivityChip({
      region: { x: 4, y: 0, width: 4, height: 8 },
      camera: { scrollX: 0, scrollY: 0, zoom: 1 },
      viewport: { width: 400, height: 128 },
      chip,
    })).toEqual({ left: 56, top: 8, mode: "inside", anchored: true });
  });

  it("오른쪽 가장자리에서 칩 전체가 뷰포트 안에 있도록 제한한다", () => {
    const placement = placeAiActivityChip({
      region: { x: 23, y: 8, width: 2, height: 2 },
      camera: { scrollX: 0, scrollY: 0, zoom: 1 },
      viewport,
      chip,
    });

    expect(placement).toEqual({ left: 320, top: 96, mode: "above", anchored: true });
    expect(placement.left + chip.width).toBeLessThanOrEqual(viewport.width);
  });

  it("영역이 없으면 캔버스 모서리 기본 위치를 반환한다", () => {
    expect(placeAiActivityChip({
      region: null,
      camera: { scrollX: 0, scrollY: 0, zoom: 1 },
      viewport,
      chip,
    })).toEqual({
      left: CHIP_CORNER_INSET,
      top: CHIP_CORNER_INSET,
      mode: "corner",
      anchored: false,
    });
  });

  it("줌이 0인 초기 카메라는 줌 1로 계산한다", () => {
    const placement = placeAiActivityChip({
      region: { x: 2, y: 4, width: 2, height: 2 },
      camera: { scrollX: 0, scrollY: 0, zoom: 0 },
      viewport,
      chip,
    });

    expect(placement).toEqual({ left: 8, top: 32, mode: "above", anchored: true });
    expect(Number.isNaN(placement.left)).toBe(false);
    expect(Number.isNaN(placement.top)).toBe(false);
  });

  it("칩이 뷰포트보다 크면 해당 축을 0으로 제한한다", () => {
    expect(placeAiActivityChip({
      region: { x: 2, y: 0, width: 2, height: 2 },
      camera: { scrollX: 0, scrollY: 0, zoom: 1 },
      viewport: { width: 40, height: 20 },
      chip: { width: 80, height: 24 },
    })).toEqual({ left: 0, top: 0, mode: "inside", anchored: true });
  });
});
