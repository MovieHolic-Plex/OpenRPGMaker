import { describe, expect, it } from "vitest";
import {
  mapEdgeDragTarget,
  mapEdgeGrowAxes,
  mapEdgeGrowCursor,
  NO_MAP_EDGE_SIDES,
} from "@/editor/mapEdgeGrow";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";

// 계약(2026-09-25): 테두리 호버는 안내(띠·커서)만, 크기는 띠에서 시작한 드래그가 넘은 칸 수로만 바뀐다.
// 이 파일은 순수 판정만 본다 — 호버 경로에는 이제 크기를 바꾸는 함수 자체가 없다.

const ts = 32;

describe("mapEdgeGrowAxes", () => {
  it("맵 안과 띠 밖은 null", () => {
    expect(mapEdgeGrowAxes({ worldX: 10, worldY: 10, mapWidthPx: 320, mapHeightPx: 320, zoom: 1 })).toBeNull();
    expect(mapEdgeGrowAxes({ worldX: -200, worldY: 10, mapWidthPx: 320, mapHeightPx: 320, zoom: 1 })).toBeNull();
  });

  it("오른쪽 띠와 왼쪽 위 모서리", () => {
    expect(mapEdgeGrowAxes({ worldX: 330, worldY: 10, mapWidthPx: 320, mapHeightPx: 320, zoom: 1 }))
      .toEqual({ left: false, right: true, up: false, down: false });
    expect(mapEdgeGrowAxes({ worldX: -5, worldY: -5, mapWidthPx: 320, mapHeightPx: 320, zoom: 1 }))
      .toEqual({ left: true, right: false, up: true, down: false });
  });
});

describe("mapEdgeGrowCursor", () => {
  it("변은 ew/ns, 모서리는 대각선", () => {
    expect(mapEdgeGrowCursor(null)).toBe("");
    expect(mapEdgeGrowCursor({ left: false, right: true, up: false, down: false })).toBe("ew-resize");
    expect(mapEdgeGrowCursor({ left: false, right: false, up: true, down: false })).toBe("ns-resize");
    expect(mapEdgeGrowCursor({ left: true, right: false, up: true, down: false })).toBe("nwse-resize");
    expect(mapEdgeGrowCursor({ left: false, right: true, up: true, down: false })).toBe("nesw-resize");
  });
});

describe("mapEdgeDragTarget", () => {
  const right = { left: false, right: true, up: false, down: false };
  const leftUp = { left: true, right: false, up: true, down: false };

  it("띠를 누른 자리(반 칸 미만)에서는 늘지 않는다", () => {
    const t = mapEdgeDragTarget({ axes: right, added: NO_MAP_EDGE_SIDES, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 10 * ts + 10, worldY: 5 });
    expect(t).toMatchObject({ left: 0, right: 0, up: 0, down: 0, clamped: false });
  });

  it("넘은 거리를 칸으로 반올림한다", () => {
    const t = mapEdgeDragTarget({ axes: right, added: NO_MAP_EDGE_SIDES, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 10 * ts + 3 * ts + 20, worldY: 5 });
    expect(t.right).toBe(4);
  });

  it("잡은 축 밖으로 끌어도 다른 변은 그대로다", () => {
    const t = mapEdgeDragTarget({ axes: right, added: NO_MAP_EDGE_SIDES, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 12 * ts, worldY: 30 * ts });
    expect(t).toMatchObject({ right: 2, down: 0, up: 0, left: 0 });
  });

  it("왼쪽·위는 밀린 내용·카메라를 기준으로 재므로 늘린 뒤에도 값이 흔들리지 않는다", () => {
    // 처음: 원래 테두리(0,0)에서 왼쪽 위로 3칸.
    const first = mapEdgeDragTarget({ axes: leftUp, added: NO_MAP_EDGE_SIDES, originWidth: 10, originHeight: 10, tileSize: ts, worldX: -3 * ts, worldY: -3 * ts });
    expect(first).toMatchObject({ left: 3, up: 3 });
    // 3칸 밀린 뒤: 카메라도 3칸 옮겼으므로 같은 화면 점의 월드 좌표는 (0,0).
    const again = mapEdgeDragTarget({ axes: leftUp, added: first, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 0, worldY: 0 });
    expect(again).toMatchObject({ left: 3, up: 3 });
  });

  it("되돌아 끌면 줄지만 원래 크기 아래로는 내려가지 않는다", () => {
    const added = { left: 0, right: 5, up: 0, down: 0 };
    const back = mapEdgeDragTarget({ axes: right, added, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 11 * ts, worldY: 5 });
    expect(back.right).toBe(1);
    const inside = mapEdgeDragTarget({ axes: right, added, originWidth: 10, originHeight: 10, tileSize: ts, worldX: 2 * ts, worldY: 5 });
    expect(inside.right).toBe(0);
  });

  it("상한에서 깎고 clamped 를 알린다", () => {
    const origin = MAX_TOOL_MAP_DIMENSION - 2;
    const t = mapEdgeDragTarget({ axes: right, added: NO_MAP_EDGE_SIDES, originWidth: origin, originHeight: 10, tileSize: ts, worldX: (origin + 9) * ts, worldY: 5 });
    expect(t.right).toBe(2);
    expect(t.clamped).toBe(true);
  });
});
