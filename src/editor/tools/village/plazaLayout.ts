/** Shared pure plaza geometry for village construction and settlement entry ports. */
import { mulberry32, type Rng } from "@/util/rng";
import type { VillageLayoutPresetRecord } from "@/project/types/village";
import type { PlazaLayout } from "../villagePlan";
import type { Plaza, Rect, SettlementLayout } from "./constants";
export const PLAZA_WIDTH = 8;
export const PLAZA_HEIGHT = 6;
export const HOUSE_MARGIN = 2;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function villagePlaza(
  area: Rect,
  layout: PlazaLayout = "center",
  settlement: SettlementLayout = "plaza-ring",
  rng?: Rng,
): Plaza {
  // 광장 크기: settlement에 따라 가변 (고정 8×6만 쓰지 않음)
  let pw = PLAZA_WIDTH;
  let ph = PLAZA_HEIGHT;
  if (settlement === "street-grid") {
    pw = 6;
    ph = 6;
  } else if (settlement === "clusters") {
    pw = 10 + (rng ? Math.floor(rng() * 3) : 1);
    ph = 7 + (rng ? Math.floor(rng() * 2) : 1);
  } else if (rng) {
    pw = 7 + Math.floor(rng() * 4); // 7~10
    ph = 5 + Math.floor(rng() * 3); // 5~7
  }
  // 대형 맵(72+)은 광장도 면적에 맞게 키운다 — 100×100에 8×6 광장은 존재감이 없다 (2026-07-17).
  if (area.w >= 72 && area.h >= 72) {
    pw = 12 + (rng ? Math.floor(rng() * 3) : 1);
    ph = 8 + (rng ? Math.floor(rng() * 2) : 1);
  }
  pw = Math.min(pw, Math.max(4, area.w - 10));
  ph = Math.min(ph, Math.max(4, area.h - 10));

  let x = area.x + Math.floor(area.w / 2) - Math.floor(pw / 2);
  let y = area.y + Math.floor(area.h / 2) - Math.floor(ph / 2);
  const margin = HOUSE_MARGIN + 2;
  if (layout === "north") y = area.y + margin + Math.floor(area.h * 0.22);
  if (layout === "south") y = area.y + area.h - margin - ph - Math.floor(area.h * 0.18);
  if (layout === "west") x = area.x + margin + Math.floor(area.w * 0.18);
  if (layout === "east") x = area.x + area.w - margin - pw - Math.floor(area.w * 0.18);
  // clusters: 광장을 약간 비틀어 대칭 깨기
  if (settlement === "clusters" && rng) {
    x += Math.floor((rng() - 0.5) * 4);
    y += Math.floor((rng() - 0.5) * 3);
  }
  x = clamp(x, area.x + margin, area.x + area.w - margin - pw);
  y = clamp(y, area.y + margin, area.y + area.h - margin - ph);
  return {
    rect: { x, y, w: pw, h: ph },
    centerRow: y + Math.floor(ph / 2),
    centerX: x + Math.floor(pw / 2),
  };
}


/** No material/catalog imports: the geography editor also loads this pure geometry. */
export function villagePresetPlaza(area: Rect, preset: VillageLayoutPresetRecord | undefined, seed: number): Plaza {
  const layout = ["center", "north", "south", "west", "east"].includes(preset?.plazaLayout ?? "") ? preset!.plazaLayout as PlazaLayout : undefined;
  const settlement = ["plaza-ring", "street-grid", "clusters"].includes(preset?.settlementLayout ?? "") ? preset!.settlementLayout as SettlementLayout : undefined;
  return villagePlaza(area, layout, settlement, mulberry32(seed));
}
