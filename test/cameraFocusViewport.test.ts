// 조수 채팅 독은 캔버스 위에 떠 있는 유리 카드다(.ai-chat-panel.chat-dock-glass, inset 12px auto auto 12px,
// width clamp(360px,38vw,520px)). 캔버스 전체 중앙에 대상을 맞추면 그 카드 뒤로 들어간다.
// 여기서 검증하는 것은 "가림을 뺀 실제 보이는 사각형" 기하학뿐 — Phaser/DOM 없이 순수 계산이다.

import { describe, expect, it } from "vitest";
import {
  cameraLookAtForTarget,
  filterAssistantOverlayRects,
  mergeNearbyRects,
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

  it("600×500 캔버스에서도 실제 카드 뒤가 아닌 오른쪽 영역에 대상을 놓는다", () => {
    const canvas: CanvasRect = { x: 0, y: 0, width: 600, height: 500 };
    const card: CanvasRect = { x: 12, y: 12, width: 360, height: 460 };
    const unoccluded = unoccludedCanvasRect(canvas, [card]);
    const canvasCenterX = canvas.x + canvas.width / 2;
    const canvasCenterY = canvas.y + canvas.height / 2;

    const containsCanvasCenter =
      canvasCenterX >= unoccluded.x &&
      canvasCenterX < unoccluded.x + unoccluded.width &&
      canvasCenterY >= unoccluded.y &&
      canvasCenterY < unoccluded.y + unoccluded.height;
    expect(containsCanvasCenter).toBe(false);
    expect(unoccluded.x).toBeGreaterThanOrEqual(372);

    const targetWorldX = 1000;
    const targetWorldY = 800;
    const zoom = 2;
    const lookAt = cameraLookAtForTarget({ targetWorldX, targetWorldY, canvas, unoccluded, zoom });
    const targetScreenX = canvasCenterX + (targetWorldX - lookAt.x) * zoom;
    const targetScreenY = canvasCenterY + (targetWorldY - lookAt.y) * zoom;
    expect(targetScreenX).toBeCloseTo(unoccluded.x + unoccluded.width / 2, 10);
    expect(targetScreenY).toBeCloseTo(unoccluded.y + unoccluded.height / 2, 10);

    const targetIsBehindCard =
      targetScreenX >= card.x &&
      targetScreenX < card.x + card.width &&
      targetScreenY >= card.y &&
      targetScreenY < card.y + card.height;
    expect(targetIsBehindCard).toBe(false);
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

describe("filterAssistantOverlayRects", () => {
  it("캔버스 전체를 덮는 inset:0 패널은 버린다 — 투명 호스트라 가림이 아니다", () => {
    expect(filterAssistantOverlayRects(CANVAS, [CANVAS])).toEqual([]);
  });

  it("입력줄·기록 카드는 남긴다", () => {
    const bar: CanvasRect = { x: 480, y: 580, width: 640, height: 110 };
    const log: CanvasRect = { x: 480, y: 160, width: 640, height: 400 };
    expect(filterAssistantOverlayRects(CANVAS, [CANVAS, bar, log])).toEqual([bar, log]);
  });
});

describe("mergeNearbyRects + 캡슐 가림", () => {
  it("오른쪽 아래 입력줄과 그 위 기록 카드를 한 덩어리로 합쳐 오른쪽을 깎는다", () => {
    const bar: CanvasRect = { x: 481, y: 576, width: 640, height: 110 };
    const log: CanvasRect = { x: 481, y: 160, width: 640, height: 400 };
    const merged = mergeNearbyRects([bar, log]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({ x: 481, y: 160, width: 640, height: 526 });

    const unoccluded = unoccludedCanvasRect(CANVAS, merged);
    expect(unoccluded.x).toBe(0);
    expect(unoccluded.width).toBe(481);
    expect(unoccluded.height).toBe(700);
  });

  it("오른쪽 아래 캡슐+기록이 캔버스 높이의 60%를 못 넘어도 오른쪽을 깎는다", () => {
    const canvas: CanvasRect = { x: 0, y: 0, width: 1613, height: 957 };
    const bar: CanvasRect = { x: 961, y: 835, width: 640, height: 110 };
    const log: CanvasRect = { x: 961, y: 535, width: 640, height: 280 };
    const unoccluded = unoccludedCanvasRect(canvas, mergeNearbyRects([bar, log]));
    expect(unoccluded.x).toBe(0);
    expect(unoccluded.width).toBe(961);
    expect(unoccluded.height).toBe(957);
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
