import { mulberry32 } from "@/util/rng";
import type { Point, Rect } from "./constants";
import { ToolError } from "../types";

export interface RiverVillagePlan {
  readonly bounds: Rect;
  readonly cells: readonly Point[];
  readonly westRoad: readonly Point[];
  readonly eastRoad: readonly Point[];
  readonly crossing: readonly Point[];
  readonly bridge: readonly Point[];
  readonly crossingY: number;
}

/** One reserved silhouette, shared by plots, roads, vegetation and the final painter.
 * Width comes from the project's world-generation rules, not a second water default.
 * Current implementation is a north–south river; existing water is never overwritten. */
export function planVillageRiver(area: Rect, seed: number, width: number): RiverVillagePlan {
  if (area.w < 40 || area.h < 28 || width < 2 || width > area.w - 32) {
    throw new ToolError("강변 마을은 40×28 이상과 강 양쪽의 주거 공간이 필요합니다. 영역을 넓히거나 강 폭을 줄여 주세요.", { code: "village-river-capacity" });
  }
  const rng = mulberry32(seed ^ 0x72697665);
  const amplitude = Math.min(3, Math.max(1, Math.floor((area.w - width - 32) / 4)));
  const phase = rng() * Math.PI * 2;
  const centre = area.x + Math.floor(area.w / 2) + Math.round((rng() - 0.5) * 2);
  const cells: Point[] = [], westRoad: Point[] = [], eastRoad: Point[] = [];
  const rows: { left: number; right: number }[] = [];
  for (let dy = 0; dy < area.h; dy++) {
    const t = dy / (area.h - 1);
    const cx = centre + Math.round(amplitude * Math.sin(t * Math.PI * 1.5 + phase));
    const left = cx - Math.floor(width / 2);
    const right = left + width - 1;
    const y = area.y + dy;
    rows.push({ left, right });
    for (let x = left; x <= right; x++) cells.push({ x, y });
    westRoad.push({ x: left - 3, y });
    eastRoad.push({ x: right + 3, y });
  }
  // Prefer a short, straight crossing near (but not fixed at) the centre.
  const desiredY = area.h * (0.42 + rng() * 0.16);
  let bridgeRow = Math.floor(desiredY), best = Infinity;
  for (let dy = Math.floor(area.h * 0.3); dy < Math.floor(area.h * 0.7); dy++) {
    const row = rows[dy]!, next = rows[dy + 1]!;
    const cost = Math.max(row.right, next.right) - Math.min(row.left, next.left)
      + Math.abs(row.left - next.left) * 4 + Math.abs(dy - desiredY) * 0.2;
    if (cost < best) { best = cost; bridgeRow = dy; }
  }
  const crossing: Point[] = [], bridge: Point[] = [];
  const left = Math.min(rows[bridgeRow]!.left, rows[bridgeRow + 1]!.left);
  const right = Math.max(rows[bridgeRow]!.right, rows[bridgeRow + 1]!.right);
  for (let dy = bridgeRow; dy <= bridgeRow + 1; dy++) {
    for (let x = left - 3; x <= right + 4; x++) {
      const p = { x, y: area.y + dy };
      crossing.push(p);
      if (x >= rows[dy]!.left && x <= rows[dy]!.right) bridge.push(p);
    }
  }
  const minX = Math.min(...rows.map(row => row.left)), maxX = Math.max(...rows.map(row => row.right));
  return { bounds: { x: minX, y: area.y, w: maxX - minX + 1, h: area.h }, cells,
    westRoad, eastRoad, crossing, bridge, crossingY: area.y + bridgeRow };
}
