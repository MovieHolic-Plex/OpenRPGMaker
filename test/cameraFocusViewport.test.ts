// 조수 채팅 독은 캔버스 위에 떠 있는 유리 카드다(.ai-chat-panel.chat-dock-glass, inset 12px auto auto 12px,
// width clamp(360px,38vw,520px)). 캔버스 전체 중앙에 대상을 맞추면 그 카드 뒤로 들어간다.
// 여기서 검증하는 것은 "가림을 뺀 실제 보이는 사각형" 기하학뿐 — Phaser/DOM 없이 순수 계산이다.

import { describe, expect, it } from "vitest";
import {
  cameraLookAtForTarget,
  unoccludedCanvasRect,
  visibleTileRectFromViewport,
  type CanvasRect,
} from "@/editor/cameraFocusViewport";

const CANVAS: CanvasRect = { x: 0, y: 0, width: 1133, height: 700 };
// 실측 독: 좌상단에서 12px 띄우고 폭 420, 높이 640.
const GLASS: CanvasRect = { x: 12, y: 12, width: 420, height: 640 };

describe("unoccludedCanvasRect", () => {
  it("좌측 유리 카드는 왼쪽 변만 깎는다 — 카드 오른쪽 끝(432)이 새 좌표", () => {
    expect(unoccludedCanvasRect(CANVAS, [GLASS])).toEqual({ x: 432, y: 0, width: 701, height: 700 });
  });

  it("남는 폭이 minSpanPx 아래면 그 가림은 무시한다 — 화면을 다 먹은 경우 계산이 무의미하다", () => {
    const wide: CanvasRect = { x: 0, y: 0, width: 1000, height: 700 };
    expect(unoccludedCanvasRect(CANVAS, [wide], 240)).toEqual(CANVAS);
  });

  it("가림이 없거나 캔버스와 겹치지 않으면 캔버스 그대로다", () => {
    expect(unoccludedCanvasRect(CANVAS, [])).toEqual(CANVAS);
    expect(unoccludedCanvasRect(CANVAS, [{ x: 2000, y: 0, width: 300, height: 700 }])).toEqual(CANVAS);
  });
});

describe("cameraLookAtForTarget", () => {
  it("가시 중앙과 캔버스 중앙의 차이를 줌으로 나눈 만큼 lookAt 을 옮긴다", () => {
    const unoccluded = unoccludedCanvasRect(CANVAS, [GLASS]);
    const zoom = 2;
    const targetWorldX = 1000;
    const targetWorldY = 800;
    const lookAt = cameraLookAtForTarget({ targetWorldX, targetWorldY, canvas: CANVAS, unoccluded, zoom });

    const canvasCenterX = CANVAS.x + CANVAS.width / 2;
    const canvasCenterY = CANVAS.y + CANVAS.height / 2;
    const unoccludedCenterX = unoccluded.x + unoccluded.width / 2;
    const unoccludedCenterY = unoccluded.y + unoccluded.height / 2;
    expect(lookAt.x).toBeCloseTo(targetWorldX - (unoccludedCenterX - canvasCenterX) / zoom, 10);
    expect(lookAt.y).toBeCloseTo(targetWorldY - (unoccludedCenterY - canvasCenterY) / zoom, 10);

    // 왕복 검증: 카메라 중심은 캔버스 중앙에 대응하므로 대상의 화면 좌표가 가시 중앙에 떨어져야 한다.
    expect(canvasCenterX + (targetWorldX - lookAt.x) * zoom).toBeCloseTo(unoccludedCenterX, 10);
    expect(canvasCenterY + (targetWorldY - lookAt.y) * zoom).toBeCloseTo(unoccludedCenterY, 10);
  });

  it("줌이 0 이하면 1 로 취급한다", () => {
    const unoccluded = unoccludedCanvasRect(CANVAS, [GLASS]);
    const zeroZoom = cameraLookAtForTarget({ targetWorldX: 10, targetWorldY: 20, canvas: CANVAS, unoccluded, zoom: 0 });
    const oneZoom = cameraLookAtForTarget({ targetWorldX: 10, targetWorldY: 20, canvas: CANVAS, unoccluded, zoom: 1 });
    expect(zeroZoom).toEqual(oneZoom);
  });
});

describe("visibleTileRectFromViewport", () => {
  it("부분 타일을 버리지 않고 분수 타일로 남기며 좌측 깎임을 반영한다", () => {
    const unoccluded = unoccludedCanvasRect(CANVAS, [GLASS]);
    const rect = visibleTileRectFromViewport({
      worldView: { x: 100, y: 64, width: 1133 / 2, height: 700 / 2 },
      canvas: CANVAS,
      unoccluded,
      zoom: 2,
      tileSize: 32,
    });
    expect(rect).not.toBeNull();
    // 월드 x = 100 + 432/2 = 316 → 타일 9.875, 폭 = 701/2/32 = 10.953125
    expect(rect?.x).toBeCloseTo(316 / 32, 10);
    expect(rect?.width).toBeCloseTo(701 / 2 / 32, 10);
    expect(rect?.y).toBeCloseTo(2, 10);
    expect(rect?.height).toBeCloseTo(700 / 2 / 32, 10);
  });

  it("뷰포트 크기가 비정상이면 null", () => {
    expect(
      visibleTileRectFromViewport({
        worldView: { x: 0, y: 0, width: 0, height: 300 },
        canvas: CANVAS,
        unoccluded: CANVAS,
        zoom: 1,
        tileSize: 32,
      })
    ).toBeNull();
    expect(
      visibleTileRectFromViewport({
        worldView: { x: 0, y: 0, width: Number.NaN, height: 300 },
        canvas: CANVAS,
        unoccluded: CANVAS,
        zoom: 1,
        tileSize: 32,
      })
    ).toBeNull();
  });
});
