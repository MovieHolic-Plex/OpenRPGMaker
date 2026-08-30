import { describe, expect, it } from "vitest";
import { planCameraFocus, type CameraFocusTarget, type VisibleTileRect } from "@/editor/editorCameraFocus";

const MAP = { width: 40, height: 30 };
// 화면에 20×15 타일이 보인다: x 10..29, y 5..19.
const VIEW: VisibleTileRect = { x: 10, y: 5, width: 20, height: 15 };

function target(patch: Partial<CameraFocusTarget> = {}): CameraFocusTarget {
  return { mapId: "m1", tileX: 0, tileY: 0, ...patch };
}

describe("planCameraFocus — 기존 동작(사용자가 직접 누른 이동)", () => {
  it("onlyIfOffscreen 이 없으면 화면 안이어도 그 타일 중심으로 간다", () => {
    expect(planCameraFocus(target({ tileX: 15, tileY: 10 }), MAP, VIEW)).toEqual({ centerTileX: 15.5, centerTileY: 10.5 });
  });

  it("1×1 대상은 타일의 정확한 중심(+0.5)을 돌려준다", () => {
    expect(planCameraFocus(target({ tileX: 3, tileY: 5 }), MAP, VIEW)).toEqual({ centerTileX: 3.5, centerTileY: 5.5 });
  });

  it("맵 밖 타일은 거부한다", () => {
    expect(planCameraFocus(target({ tileX: -1, tileY: 3 }), MAP, VIEW)).toBeNull();
    expect(planCameraFocus(target({ tileX: 40, tileY: 3 }), MAP, VIEW)).toBeNull();
    expect(planCameraFocus(target({ tileX: 3, tileY: 30 }), MAP, VIEW)).toBeNull();
  });

  it("맵 마지막 타일의 중심(39.5)은 통과한다 — 판정은 내림한 중심으로 한다", () => {
    expect(planCameraFocus(target({ tileX: 39, tileY: 29 }), MAP, VIEW)).toEqual({
      centerTileX: 39.5,
      centerTileY: 29.5,
    });
  });

  it("빈 맵은 갈 곳이 없다", () => {
    expect(planCameraFocus(target({ tileX: 0, tileY: 0 }), { width: 0, height: 0 }, VIEW)).toBeNull();
  });

  it("소수 좌표도 잘라서 받는다 — 여기서 새로 거부하면 조용히 이동이 사라진다", () => {
    expect(planCameraFocus(target({ tileX: 12.7, tileY: 8.2 }), MAP, VIEW)).toEqual({
      centerTileX: 12.5,
      centerTileY: 8.5,
    });
  });

  it("bounds 를 주면 그 정확한 중심으로 간다 — 짝수 크기에서 내림하면 반 타일이 밀린다", () => {
    const plan = planCameraFocus(target({ bounds: { x: 4, y: 4, width: 6, height: 8 } }), MAP, VIEW);
    expect(plan).toEqual({ centerTileX: 7, centerTileY: 8 });
  });

  it("홀수 크기 bounds 의 중심은 타일 중앙(.5)이다", () => {
    const plan = planCameraFocus(target({ bounds: { x: 0, y: 0, width: 5, height: 5 } }), MAP, VIEW);
    expect(plan).toEqual({ centerTileX: 2.5, centerTileY: 2.5 });
  });
});

describe("planCameraFocus — onlyIfOffscreen(조수 자동 이동)", () => {
  it("여유까지 포함해 화면 안에 다 들어와 있으면 움직이지 않는다", () => {
    const plan = planCameraFocus(
      target({ bounds: { x: 14, y: 8, width: 4, height: 4 }, onlyIfOffscreen: true }),
      MAP,
      VIEW
    );
    expect(plan).toBeNull();
  });

  it("화면 밖이면 중심으로 데려간다", () => {
    const plan = planCameraFocus(
      target({ bounds: { x: 32, y: 22, width: 4, height: 4 }, onlyIfOffscreen: true }),
      MAP,
      VIEW
    );
    expect(plan).toEqual({ centerTileX: 34, centerTileY: 24 });
  });

  it("경계에 1칸 여유 없이 걸쳐 있으면 데려간다 — 잘려 보이는 것은 보이는 게 아니다", () => {
    // y 5..19 가 보이는데 대상이 y=5 부터다: 위쪽 여유가 없다.
    const plan = planCameraFocus(
      target({ bounds: { x: 14, y: 5, width: 4, height: 4 }, onlyIfOffscreen: true }),
      MAP,
      VIEW
    );
    expect(plan).toEqual({ centerTileX: 16, centerTileY: 7 });
  });

  it("분수 타일 하나만큼 안쪽에 있으면 화면 밖이 아니다 — 부분 타일 때문에 판정이 뒤집히지 않는다", () => {
    const fractionalView: VisibleTileRect = { x: 9.875, y: 4.4, width: 20.95, height: 15.6 };
    const plan = planCameraFocus(
      target({ bounds: { x: 12, y: 7, width: 4, height: 4 }, onlyIfOffscreen: true }),
      MAP,
      fractionalView
    );
    expect(plan).toBeNull();
  });

  it("화면보다 큰 대상은 중심이 화면 중앙부에 있으면 이미 보고 있는 것으로 친다", () => {
    // 화면 중앙부는 x 15..25, y 8.75..16.25. 40×30 전체 변경의 중심은 (20,15) 로 그 안이다.
    const plan = planCameraFocus(
      target({ bounds: { x: 0, y: 0, width: 40, height: 30 }, onlyIfOffscreen: true }),
      MAP,
      VIEW
    );
    expect(plan).toBeNull();
  });

  it("화면보다 큰 대상이라도 중심이 화면 중앙부를 벗어나면 데려간다", () => {
    const narrowView: VisibleTileRect = { x: 0, y: 0, width: 6, height: 6 };
    const plan = planCameraFocus(
      target({ bounds: { x: 20, y: 20, width: 10, height: 10 }, onlyIfOffscreen: true }),
      MAP,
      narrowView
    );
    expect(plan).toEqual({ centerTileX: 25, centerTileY: 25 });
  });

  it("보이는 사각형을 모르면 조수 자동 이동은 포기한다 — 화면을 함부로 빼앗지 않는다", () => {
    const plan = planCameraFocus(
      target({ bounds: { x: 14, y: 8, width: 4, height: 4 }, onlyIfOffscreen: true }),
      MAP,
      null
    );
    expect(plan).toBeNull();
  });

  it("사용자가 직접 누른 이동은 뷰포트를 몰라도 그냥 간다", () => {
    const plan = planCameraFocus(target({ bounds: { x: 14, y: 8, width: 4, height: 4 } }), MAP, null);
    expect(plan).toEqual({ centerTileX: 16, centerTileY: 10 });
  });

  it("bounds 없이 타일 한 점만 줘도 화면 안이면 움직이지 않는다", () => {
    expect(planCameraFocus(target({ tileX: 20, tileY: 12, onlyIfOffscreen: true }), MAP, VIEW)).toBeNull();
    expect(planCameraFocus(target({ tileX: 2, tileY: 2, onlyIfOffscreen: true }), MAP, VIEW)).toEqual({
      centerTileX: 2.5,
      centerTileY: 2.5,
    });
  });
});

describe("planCameraFocus — 줌 맞추기(fit)", () => {
  const ZOOM_LEVELS = [1, 2, 3, 4, 6, 8];

  it("화면보다 큰 대상은 줌을 낮춰 제안한다", () => {
    const plan = planCameraFocus(
      target({ bounds: { x: 0, y: 0, width: 40, height: 40 }, onlyIfOffscreen: true }),
      { width: 60, height: 60 },
      { x: 0, y: 0, width: 20, height: 12 },
      1,
      { currentZoom: 2, zoomLevels: ZOOM_LEVELS }
    );
    expect(plan).toEqual({ centerTileX: 20, centerTileY: 20, zoom: 1 });
  });

  it("이미 들어오는 크기면 줌을 건드리지 않는다", () => {
    const plan = planCameraFocus(
      target({ bounds: { x: 0, y: 0, width: 40, height: 40 } }),
      { width: 60, height: 60 },
      { x: 0, y: 0, width: 60, height: 60 },
      1,
      { currentZoom: 2, zoomLevels: ZOOM_LEVELS }
    );
    expect(plan).toEqual({ centerTileX: 20, centerTileY: 20 });
  });

  it("줌을 제안할 때는 '이미 보고 있다' 판정보다 제안이 앞선다", () => {
    // 중심이 화면 중앙부에 있어 예전 규칙이면 null 이지만, 줌을 낮추면 다 담을 수 있으므로 계획을 낸다.
    const plan = planCameraFocus(
      target({ bounds: { x: 10, y: 10, width: 20, height: 20 }, onlyIfOffscreen: true }),
      { width: 60, height: 60 },
      { x: 10, y: 10, width: 20, height: 20 },
      1,
      { currentZoom: 4, zoomLevels: ZOOM_LEVELS }
    );
    expect(plan).toEqual({ centerTileX: 20, centerTileY: 20, zoom: 3 });
  });

  it("현재 줌이 이미 가장 낮으면 제안할 줌이 없다", () => {
    const plan = planCameraFocus(
      target({ bounds: { x: 0, y: 0, width: 40, height: 40 }, onlyIfOffscreen: true }),
      { width: 60, height: 60 },
      { x: 0, y: 0, width: 20, height: 12 },
      1,
      { currentZoom: 1, zoomLevels: ZOOM_LEVELS }
    );
    expect(plan).toEqual({ centerTileX: 20, centerTileY: 20 });
  });
});
