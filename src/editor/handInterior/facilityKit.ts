// 시설 84곳(facilityVenues*.ts)을 짧게 적는 도구 - 2026-10-18 21:17 사용자 「왜 방을 사각형으로만 만드냐 … 교육·의료·상점·음식점·오락·주거·공공·교통·숙박·일본 전통·기타 시설 다 만들어」.
// 방 안 가구는 줄(rows)·격자(grid)·벽 줄(wall)·걸이 줄(hang)·책상 열(desks)로 적고, 칸 크기는 공용 방 스펙(modernCityRoomSpec.json)에서 읽는다.
// 겹침·방 밖은 furnish.ts 가 거른다. 평면은 rows 의 `~` 표지가 만든다: `~` 는 그 줄에서 남는 너비를 채우는 건물 밖(void)이라
// 줄마다 방 너비 합이 다르면 ㄱ·ㅜ·ㄷ·계단형 외곽이 된다 - 사각형으로 두지 않는다.
import spec from "@/assets/modernCityRoomSpec.json";
import type { InteriorRoomTemplate, InteriorTemplateItem } from "./templates";
import type { ModernProgramVariation } from "./modernPresets";
import { o, seatedTable, t, type Venue } from "./venueKit";

// 번들 JSON(모양 고정)에서 칸 크기만 읽는다 - 이름 붙인 형으로 한 번만 단언한다.
interface SpecShape { objects: Record<string, { w: number; h: number }> }
const OBJ = (spec as unknown as SpecShape).objects;
/** `m:xxx` 는 `mci-xxx`. */
export const id = (s: string): string => (s.startsWith("m:") ? `mci-${s.slice(2)}` : s);
const sizeOf = (s: string): { w: number; h: number } => { const q = OBJ[id(s)]; return { w: q?.w ?? 1, h: Math.max(1, q?.h ?? 1) }; };

export const F = { oak: "mci-wood-oak", dark: "mci-wood-dark", carpet: "mci-carpet-office", stone: "mci-stone-lobby", vinyl: "mci-vinyl-store", hosp: "mci-vinyl-hospital", tile: "mci-tile-concourse", conc: "mci-concrete", small: "mci-tile-small" } as const;
export const W = { office: "mci-wall-office", lobby: "mci-wall-lobby", store: "mci-wall-store", home: "mci-wall-home", hosp: "mci-wall-hospital", brick: "mci-wall-brick", tile: "mci-wall-tile", metal: "mci-wall-metal" } as const;

export interface RoomSpec {
  /** 북쪽 벽 걸이(y 0) - 앞에서부터 한 칸씩 띄워 늘어놓는다. */
  readonly hang?: readonly string[];
  /** 북쪽 벽 가구(y 2) - 앞에서부터 늘어놓는다, `_` 는 두 칸 빈 자리. */
  readonly wall?: readonly string[];
  /** [y, 가구 목록, 시작 x = 1, 간격 = 1] */
  readonly rows?: readonly (readonly [number, readonly string[], number?, number?])[];
  /** [가구, x0, y0, 열, 행, x 걸음 = 폭 + 1, y 걸음 = 높이 + 1] */
  readonly grid?: readonly (readonly [string, number, number, number, number, number?, number?])[];
  readonly at?: readonly (readonly [string, number, number])[];
  /** [탁자 줄, 의자 바탕 id, x, y, w, h] - 네 면 의자 */
  readonly seat?: readonly (readonly [string, string, number, number, number, number])[];
  /** [x0, y0, 열, 행, x 걸음 = 3, y 걸음 = 3] 학생 책상(2×1)과 아래 두 의자 */
  readonly desks?: readonly (readonly [number, number, number, number, number?, number?])[];
  /** 아래 두 모서리 화분 */
  readonly pl?: boolean;
}

export type FRoom = Venue["rooms"][number];

export function room(kind: string, w: number, h: number, floor: string, wall: string, s: RoomSpec = {}): FRoom {
  const items: InteriorTemplateItem[] = [];
  let x = 1;
  for (const k of s.hang ?? []) { items.push(o(id(k), x, 0)); x += sizeOf(k).w + 1; }
  x = 0;
  for (const k of s.wall ?? []) { if (k === "_") { x += 2; continue; } items.push(o(id(k), x, 2)); x += sizeOf(k).w; }
  for (const [y, list, x0 = 1, gap = 1] of s.rows ?? []) {
    let cx = x0;
    for (const k of list) { if (k === "_") { cx += 2; continue; } items.push(o(id(k), cx, y)); cx += sizeOf(k).w + gap; }
  }
  for (const [k, x0, y0, cols, rws, sx, sy] of s.grid ?? []) {
    const z = sizeOf(k);
    for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) items.push(o(id(k), x0 + i * (sx ?? z.w + 1), y0 + j * (sy ?? z.h + 1)));
  }
  for (const [x0, y0, cols, rws, sx = 3, sy = 3] of s.desks ?? []) {
    for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) {
      const dx = x0 + i * sx, dy = y0 + j * sy;
      items.push(t("mci-t-wood", dx, dy, 2, 1), o("mci-chair-wood-n", dx, dy + 1), o("mci-chair-wood-n", dx + 1, dy + 1));
    }
  }
  for (const [tb, ch, tx, ty, tw, th] of s.seat ?? []) items.push(...seatedTable(tb, id(ch), tx, ty, tw, th));
  for (const [k, ax, ay] of s.at ?? []) items.push(o(id(k), ax, ay));
  if (s.pl) items.push(o("mci-plant-tall", 0, h - 1), o("mci-plant-tall", w - 1, h - 1));
  return { kind, w, h, floor, wall, items };
}

export type Category = "교육시설" | "의료시설" | "상점" | "음식점" | "오락시설" | "주거시설" | "공공시설" | "교통시설" | "숙박시설" | "일본 전통시설" | "기타 시설";

export interface FacilitySpec {
  readonly cat: Category;
  readonly p: string;
  readonly map: string;
  readonly ko: string;
  /** 외곽 모양 태그(L자형·ㄷ자형·ㅗ자형·계단형·중정형…) */
  readonly shape: string;
  readonly entrance: string;
  /** 줄 배치(북→남, 서→동). `~` 는 남는 너비를 채우는 건물 밖. */
  readonly rows: readonly (readonly string[])[];
  readonly rooms: readonly FRoom[];
  readonly hubs?: readonly string[];
  readonly above?: readonly (readonly [string, string])[];
  readonly left?: readonly (readonly [string, string])[];
}
export interface FacilityVenue extends Venue { readonly cat: Category; readonly ko: string; readonly shape: string }

const ALT_F: Record<string, string> = { [F.oak]: F.dark, [F.dark]: F.carpet, [F.carpet]: F.small, [F.stone]: F.tile, [F.vinyl]: F.small, [F.hosp]: F.tile, [F.tile]: F.stone, [F.conc]: F.tile, [F.small]: F.vinyl };
const ALT_W: Record<string, string> = { [W.office]: W.home, [W.lobby]: W.store, [W.store]: W.tile, [W.home]: W.brick, [W.hosp]: W.tile, [W.brick]: W.office, [W.tile]: W.store, [W.metal]: W.office };

/** `~` 를 void:N 으로 푼다 - 방 줄(~ 없는 줄) 가운데 가장 넓은 줄이 건물 너비, ~ 가 있는 줄은 남는 너비를 ~ 끼리 나눠 채운다. */
function resolveRows(rows: readonly (readonly string[])[], rooms: readonly FRoom[]): string[][] {
  const wOf = new Map(rooms.map((r) => [r.kind, r.w]));
  const natural = (row: readonly string[]) => row.filter((k) => k !== "~").reduce((s, k) => s + (wOf.get(k) ?? 0) + 1, 0) - 1;
  const full = rows.filter((r) => !r.includes("~"));
  if (!full.length) throw new Error(`rows 에 ~ 없는 줄이 없다: ${rows.map((r) => r.join(",")).join(" / ")}`);
  const W0 = Math.max(...full.map(natural));
  return rows.map((row) => {
    const n = row.filter((k) => k === "~").length;
    if (!n) return [...row];
    const total = W0 + 1 - row.filter((k) => k !== "~").reduce((s, k) => s + (wOf.get(k) ?? 0) + 1, 0);
    if (total < n) throw new Error(`~ 자리가 모자란다(${total}): ${row.join(",")} (건물 너비 ${W0})`);
    let left = total;
    return row.map((k, i) => {
      if (k !== "~") return k;
      const idx = row.slice(0, i).filter((q) => q === "~").length;
      const g = idx === n - 1 ? left : Math.floor(total / n);
      left -= g;
      return `void:${g}`;
    });
  });
}

export function facility(s: FacilitySpec): FacilityVenue {
  // seed 변주용 바닥·벽면 묶음 둘 - 한 번 바꾼 것, 두 번 바꾼 것.
  const once = (r: FRoom): readonly [string, string] => [ALT_F[r.floor] ?? r.floor, ALT_W[r.wall] ?? r.wall];
  const twice = (r: FRoom): readonly [string, string] => { const [f, w] = once(r); return [ALT_F[f] ?? f, ALT_W[w] ?? w]; };
  const palettes = [once, twice].map((pick) => Object.fromEntries(s.rooms.map((r) => [r.kind, pick(r)] as const)));
  const variation: ModernProgramVariation = {
    entrance: s.entrance,
    rows: resolveRows(s.rows, s.rooms),
    hubs: s.hubs ?? [s.entrance],
    ...(s.above ? { above: s.above } : {}),
    ...(s.left ? { left: s.left } : {}),
    palettes,
  };
  return { program: s.p, map: s.map, aliases: [s.ko], variation, rooms: s.rooms, cat: s.cat, ko: s.ko, shape: s.shape };
}

export function facilityExports(list: readonly FacilityVenue[]) {
  const templates: InteriorRoomTemplate[] = list.flatMap((v) => v.rooms.map((r, i) => ({ ...r, id: `${v.map}:${r.kind}#${i}`, map: v.map, building: v.program, items: [...r.items] })));
  const programs: Record<string, readonly { readonly map: string; readonly kinds: readonly string[] }[]> =
    Object.fromEntries(list.map((v) => [v.program, [v.map, ...(v.aliases ?? [])].map((map) => ({ map, kinds: v.rooms.map((r) => r.kind) }))]));
  const variation: Record<string, ModernProgramVariation> = Object.fromEntries(list.map((v) => [v.program, v.variation]));
  return { templates, programs, variation };
}
