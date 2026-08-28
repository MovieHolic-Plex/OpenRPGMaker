import { describe, expect, it } from "vitest";
import { tileRectToClientRect } from "@/editor/selectionOverlayAnchor";

const TILE = 16;

describe("tileRectToClientRect", () => {
  it("zoom 1 에서 캔버스 원점 + 타일 오프셋", () => {
    expect(tileRectToClientRect({
      tileRect: { x: 2, y: 3, width: 4, height: 5 },
      worldView: { x: 0, y: 0 },
      zoom: 1,
      canvasOrigin: { x: 100, y: 50 },
      tileSize: TILE,
    })).toEqual({ x: 132, y: 98, width: 64, height: 80 });
  });

  it("worldView 스크롤을 뺀다", () => {
    expect(tileRectToClientRect({
      tileRect: { x: 10, y: 10, width: 1, height: 1 },
      worldView: { x: 96, y: 32 },
      zoom: 1,
      canvasOrigin: { x: 0, y: 0 },
      tileSize: TILE,
    })).toEqual({ x: 64, y: 128, width: 16, height: 16 });
  });

  it("zoom 2 는 오프셋과 크기 양쪽에 걸린다", () => {
    expect(tileRectToClientRect({
      tileRect: { x: 4, y: 0, width: 2, height: 2 },
      worldView: { x: 32, y: 0 },
      zoom: 2,
      canvasOrigin: { x: 10, y: 20 },
      tileSize: TILE,
    })).toEqual({ x: 74, y: 20, width: 64, height: 64 });
  });

  it("영역이 뷰포트 왼쪽 위로 밀려나면 음수 좌표를 그대로 돌려준다", () => {
    const rect = tileRectToClientRect({
      tileRect: { x: 0, y: 0, width: 3, height: 3 },
      worldView: { x: 320, y: 240 },
      zoom: 1,
      canvasOrigin: { x: 0, y: 0 },
      tileSize: TILE,
    });
    expect(rect.x).toBeLessThan(0);
    expect(rect.y).toBeLessThan(0);
  });

  it("0.5 배 줌에서도 최소 1px 은 보장한다", () => {
    const rect = tileRectToClientRect({
      tileRect: { x: 0, y: 0, width: 0, height: 0 },
      worldView: { x: 0, y: 0 },
      zoom: 0.5,
      canvasOrigin: { x: 0, y: 0 },
      tileSize: TILE,
    });
    expect(rect.width).toBe(1);
    expect(rect.height).toBe(1);
  });
});
