// project/mapLoop.ts
// 가장자리가 반대편으로 이어지는 맵(RPG 쯔꾸르의 「맵 루프」). 꿈 세계·끝없는 숲·반복 복도 장르의 기본기다.
//
// 왜 (2026-09-24 꿈 세계 도그푸딩): 기획의 「가장자리가 반대편으로 이어지는 반복 맵」을 조수는 가장자리 한가운데
// 네 칸에 투명 touch 이동 이벤트를 두는 것으로 흉내 냈다 — 그 네 칸 밖 가장자리는 그냥 벽이고, 이동마다 화면이
// 암전됐다. 에디터에 루프 속성 자체가 없었다.
//
// 모양: 걸음이 루프 축의 가장자리를 넘으면 맵 밖 한 칸까지 걸어 나간 뒤 반대편 같은 줄로 옮겨 선다.
import type { GameMap } from "./types";

export type MapLoop = "horizontal" | "vertical" | "both";
export const MAP_LOOP_VALUES: readonly MapLoop[] = ["horizontal", "vertical", "both"];

export function isMapLoop(value: unknown): value is MapLoop {
  return typeof value === "string" && (MAP_LOOP_VALUES as readonly string[]).includes(value);
}

export function mapLoopsX(map: Pick<GameMap, "loop">): boolean {
  return map.loop === "horizontal" || map.loop === "both";
}

export function mapLoopsY(map: Pick<GameMap, "loop">): boolean {
  return map.loop === "vertical" || map.loop === "both";
}

/**
 * (x,y) 에서 (dx,dy) 로 걷는 걸음이 루프 가장자리를 넘는가 — 넘으면 넘은 뒤 설 칸(반대편), 아니면 null.
 * 루프가 아닌 축으로 맵 밖에 나가는 걸음은 null(평소처럼 막힌다).
 */
export function loopStepTarget(
  map: Pick<GameMap, "loop" | "width" | "height">,
  x: number, y: number, dx: number, dy: number,
): { x: number; y: number } | null {
  if (!map.loop) return null;
  const nx = x + dx, ny = y + dy;
  const outX = nx < 0 || nx >= map.width;
  const outY = ny < 0 || ny >= map.height;
  if (!outX && !outY) return null;
  if (outX && !mapLoopsX(map)) return null;
  if (outY && !mapLoopsY(map)) return null;
  return { x: wrap(nx, map.width), y: wrap(ny, map.height) };
}

/** 맵 밖 좌표를 루프 축에서만 안으로 접는다. 루프 아닌 축은 그대로. */
export function wrapLoopPosition(map: Pick<GameMap, "loop" | "width" | "height">, x: number, y: number): { x: number; y: number } {
  return { x: mapLoopsX(map) ? wrap(x, map.width) : x, y: mapLoopsY(map) ? wrap(y, map.height) : y };
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export function mapLoopLabel(loop: MapLoop | undefined): string {
  return loop === "horizontal" ? "좌우 반복" : loop === "vertical" ? "상하 반복" : loop === "both" ? "사방 반복" : "반복 없음";
}
