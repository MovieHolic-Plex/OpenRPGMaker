import { resizeMap } from "@/editor/actions";
import { recordCoalescedSnapshot } from "@/editor/mapEditHistory";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

// 맵 테두리 드래그로 크기 늘리기.
//
// 왜 드래그인가(2026-09-25 사용자 신고 「가장자리에 호버하면 맵이 커진다」): 첫 구현(28a3c0397)은
// 테두리 밖 띠에 포인터가 **머물기만** 해도 170ms 마다 한 칸씩 키웠다. 캔버스 밖으로 나가려고
// 가장자리를 지나가거나 맵 끝 칸을 칠하려고 근처에 커서를 두기만 해도 맵이 몰래 자랐다.
// 이제 호버는 주황 띠와 크기 조절 커서만 보여 주고, 크기는 그 띠에서 **좌클릭을 누른 채 끌 때만**
// 바뀐다. 한 번의 드래그는 되돌리기 한 단계다.

/** 맵 테두리 바깥, 화면 픽셀. 이 안에서 누르면 테두리 드래그가 시작된다. */
export const MAP_EDGE_GROW_BAND_PX = 56;

export type MapEdgeGrowAxes = {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
};

/** 변마다 원래 크기에 **더한** 칸 수. 드래그 한 번 안에서 0 미만으로 내려가지 않는다. */
export type MapEdgeSides = {
  readonly left: number;
  readonly right: number;
  readonly up: number;
  readonly down: number;
};

export const NO_MAP_EDGE_SIDES: MapEdgeSides = { left: 0, right: 0, up: 0, down: 0 };

export function mapEdgeGrowAxes(input: {
  readonly worldX: number;
  readonly worldY: number;
  readonly mapWidthPx: number;
  readonly mapHeightPx: number;
  readonly zoom: number;
}): MapEdgeGrowAxes | null {
  const zoom = input.zoom > 0 ? input.zoom : 1;
  const band = MAP_EDGE_GROW_BAND_PX / zoom;
  const { worldX, worldY, mapWidthPx, mapHeightPx } = input;
  if (mapWidthPx <= 0 || mapHeightPx <= 0) return null;
  const nearX = worldX >= -band && worldX <= mapWidthPx + band;
  const nearY = worldY >= -band && worldY <= mapHeightPx + band;
  if (!nearX || !nearY) return null;
  const left = worldX < 0;
  const right = worldX >= mapWidthPx;
  const up = worldY < 0;
  const down = worldY >= mapHeightPx;
  if (!left && !right && !up && !down) return null;
  return { left, right, up, down };
}

/** 띠 방향에 맞는 CSS 커서. 모서리는 대각선. */
export function mapEdgeGrowCursor(axes: MapEdgeGrowAxes | null): string {
  if (!axes) return "";
  const horizontal = axes.left || axes.right;
  const vertical = axes.up || axes.down;
  if (horizontal && vertical) {
    // 왼쪽 위·오른쪽 아래는 ↖↘, 나머지 두 모서리는 ↗↙.
    return (axes.left && axes.up) || (axes.right && axes.down) ? "nwse-resize" : "nesw-resize";
  }
  return horizontal ? "ew-resize" : "ns-resize";
}

/**
 * 드래그 중 포인터가 원래 테두리를 몇 칸 넘었는지. 반 칸을 넘으면 한 칸으로 친다.
 *
 * 좌표는 **현재** 맵 기준 월드 픽셀이다. 왼쪽·위로 늘리면 내용이 밀리고 카메라도 같은 만큼
 * 스크롤하므로 포인터의 월드 좌표가 `added * tileSize` 만큼 함께 움직인다. 그래서 원래 테두리를
 * `added.left * tileSize` 에 두고 재면 값이 프레임마다 흔들리지 않는다.
 * 드래그 시작 때 잡은 축 밖의 변은 늘리지 않는다 — 오른쪽 띠에서 잡고 위로 끌어도 높이는 그대로다.
 */
export function mapEdgeDragTarget(input: {
  readonly axes: MapEdgeGrowAxes;
  readonly added: MapEdgeSides;
  readonly originWidth: number;
  readonly originHeight: number;
  readonly tileSize: number;
  readonly worldX: number;
  readonly worldY: number;
}): MapEdgeSides & { readonly clamped: boolean } {
  const { axes, added, originWidth, originHeight, worldX, worldY } = input;
  const ts = input.tileSize > 0 ? input.tileSize : 1;
  const originLeftPx = added.left * ts;
  const originTopPx = added.up * ts;
  const past = (px: number): number => Math.max(0, Math.round(px / ts));
  let left = axes.left ? past(originLeftPx - worldX) : 0;
  let right = axes.right ? past(worldX - (originLeftPx + originWidth * ts)) : 0;
  let up = axes.up ? past(originTopPx - worldY) : 0;
  let down = axes.down ? past(worldY - (originTopPx + originHeight * ts)) : 0;
  // 상한은 한 곳(mapSizeLimits)의 숫자다. 넘치는 만큼 깎는다 — 거부하면 상한 직전에서 끌던 손이 멈춰 버린다.
  const roomW = Math.max(0, MAX_TOOL_MAP_DIMENSION - originWidth);
  const roomH = Math.max(0, MAX_TOOL_MAP_DIMENSION - originHeight);
  // clamped 는 상한 토스트를 드래그당 한 번만 띄우려고 드래그 쪽이 읽는다.
  const clamped = left + right > roomW || up + down > roomH;
  if (left + right > roomW) {
    const overflow = left + right - roomW;
    if (left > 0) left = Math.max(0, left - overflow);
    else right = Math.max(0, right - overflow);
  }
  if (up + down > roomH) {
    const overflow = up + down - roomH;
    if (up > 0) up = Math.max(0, up - overflow);
    else down = Math.max(0, down - overflow);
  }
  return { left, right, up, down, clamped };
}

/**
 * 맵을 `from` 에서 `to` 로 맞춘다. 반환값은 카메라가 따라가야 할 칸 수(왼쪽·위 변의 차이)다.
 *
 * 줄이는 쪽을 먼저 한다. 왼쪽·위를 줄일 때는 내용을 먼저 당긴 뒤 자르고, 늘릴 때는 먼저 키운 뒤
 * 민다 — 순서가 바뀌면 원래 칸이 잘려 나간다. 줄이는 대상은 이 드래그에서 새로 생긴 칸뿐이다
 * (`to` 는 0 아래로 내려가지 않는다). 드래그 중에는 칠하기가 꺼져 있으므로 그 칸에 저작 내용은 없다.
 *
 * `historyKey` 는 드래그마다 새 값이어야 한다. 같은 키를 다시 쓰면 바로 앞 드래그와 한 단계로 묶여
 * 되돌리기가 두 번의 드래그를 한꺼번에 지운다.
 */
export function applyMapEdgeDrag(
  mapId: MapId,
  from: MapEdgeSides,
  to: MapEdgeSides,
  historyKey: string
): { readonly dx: number; readonly dy: number } | null {
  const map = store.getCurrent().maps[mapId];
  if (!map) return null;
  const dLeft = to.left - from.left;
  const dRight = to.right - from.right;
  const dUp = to.up - from.up;
  const dDown = to.down - from.down;
  if (dLeft === 0 && dRight === 0 && dUp === 0 && dDown === 0) return null;
  recordCoalescedSnapshot(historyKey, "맵 크기", mapId);
  const shrinkLeft = Math.min(0, dLeft);
  const shrinkUp = Math.min(0, dUp);
  const shrinkW = shrinkLeft + Math.min(0, dRight);
  const shrinkH = shrinkUp + Math.min(0, dDown);
  if (shrinkLeft !== 0 || shrinkUp !== 0) shiftMapContent(mapId, { dx: shrinkLeft, dy: shrinkUp });
  if (shrinkW !== 0 || shrinkH !== 0) {
    const cur = store.getCurrent().maps[mapId];
    if (cur) resizeMap(mapId, cur.width + shrinkW, cur.height + shrinkH);
  }
  const growLeft = Math.max(0, dLeft);
  const growUp = Math.max(0, dUp);
  const growW = growLeft + Math.max(0, dRight);
  const growH = growUp + Math.max(0, dDown);
  if (growW !== 0 || growH !== 0) {
    const cur = store.getCurrent().maps[mapId];
    if (cur) resizeMap(mapId, cur.width + growW, cur.height + growH);
  }
  if (growLeft !== 0 || growUp !== 0) shiftMapContent(mapId, { dx: growLeft, dy: growUp });
  return { dx: dLeft, dy: dUp };
}
