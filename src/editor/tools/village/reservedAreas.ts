import type { Rect } from "./constants";

/** Leave planned water and house yards empty without painting placeholder tiles. */
export function unreservedAreas(areas: readonly Rect[], reserved: readonly Rect[]): Rect[] {
  let remaining = [...areas];
  for (const cut of reserved) {
    remaining = remaining.flatMap(area => {
      const left = Math.max(area.x, cut.x), top = Math.max(area.y, cut.y);
      const right = Math.min(area.x + area.w, cut.x + cut.w);
      const bottom = Math.min(area.y + area.h, cut.y + cut.h);
      if (left >= right || top >= bottom) return [area];
      return [
        { x: area.x, y: area.y, w: area.w, h: top - area.y },
        { x: area.x, y: bottom, w: area.w, h: area.y + area.h - bottom },
        { x: area.x, y: top, w: left - area.x, h: bottom - top },
        { x: right, y: top, w: area.x + area.w - right, h: bottom - top },
      ].filter(rect => rect.w > 0 && rect.h > 0);
    });
  }
  return remaining;
}
