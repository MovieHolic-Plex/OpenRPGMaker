// modern_city 다구역 실내 견본(modernVenues.ts · dailyVenues.ts)을 짧게 적는 도구.
// 견본 좌표: 0~1 줄은 벽면(걸이 hang 은 y 0), 2 줄부터 바닥(벽 가구 wall 은 y 2). seed 변주는 variation(바닥·벽면 묶음·좌우 뒤집기).
import type { InteriorRoomTemplate, InteriorTemplateItem } from "./templates";
import type { ModernProgramVariation } from "./modernPresets";

export const o = (id: string, x: number, y: number): InteriorTemplateItem => ({ t: "o", id, x, y });
export const g = (id: string, x: number, y: number): InteriorTemplateItem => ({ t: "g", id, x, y });
/** 자동 타일 탁자(mci-t-wood·mci-t-meeting·mci-t-counter) w×h. */
export const t = (id: string, x: number, y: number, w: number, h: number): InteriorTemplateItem => ({ t: "t", id, x, y, w, h });
export const row = (id: string, x0: number, step: number, n: number, y: number) => Array.from({ length: n }, (_, i) => o(id, x0 + i * step, y));

/**
 * 탁자 하나와 네 면의 의자 - 북쪽 의자는 남향(-s), 남쪽 의자는 북향(-n), 서쪽 의자는 동향(-e), 동쪽 의자는 서향(-w)으로 모두 탁자를 본다.
 * chair 는 방향 접미사 없는 바탕 id(mci-chair-wood·mci-chair-office). 탁자 w 칸마다 남북 의자, h 칸마다 동서 의자.
 */
export function seatedTable(table: string, chair: string, x: number, y: number, w: number, h: number, sides: { n?: boolean; s?: boolean; e?: boolean; w?: boolean } = { n: true, s: true, e: true, w: true }): InteriorTemplateItem[] {
  const out: InteriorTemplateItem[] = [t(table, x, y, w, h)];
  for (let k = 0; k < w; k++) {
    if (sides.n) out.push(o(`${chair}-s`, x + k, y - 1));
    if (sides.s) out.push(o(`${chair}-n`, x + k, y + h));
  }
  for (let k = 0; k < h; k++) {
    if (sides.w) out.push(o(`${chair}-e`, x - 1, y + k));
    if (sides.e) out.push(o(`${chair}-w`, x + w, y + k));
  }
  return out;
}

export interface Venue {
  readonly program: string;
  readonly map: string;
  /** 같은 방 구성을 다른 예제 맵 이름으로도 찾게(지하철역 = concourse). */
  readonly aliases?: readonly string[];
  readonly variation: ModernProgramVariation;
  readonly rooms: readonly Omit<InteriorRoomTemplate, "map" | "building" | "id">[];
}
