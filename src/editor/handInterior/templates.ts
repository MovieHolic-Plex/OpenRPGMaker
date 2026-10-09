// 방 견본 — 제작자 예제 맵을 방 단위로 자른 것(scripts/content/interior-templates/extract.mts 가 굽는다).
// 집 한 채를 베끼는 대신, layout.ts 가 새로 짠 방 사각형마다 같은 종류 견본의 가구 한 벌을 옮겨 심는다.
// 옮겨 심기: 붙은 가구는 덩이로 묶어 같이 옮긴다. 벽에 붙은 덩이는 그 벽에 붙인 채로, 떨어진 덩이는 방 안 비율 자리로.
// 벽 가구·걸이는 늘 북쪽 벽 줄에 남는다. 심을 때 덩이마다 자리 후보를 차례로 검사한다(furnish.ts).
import data from "@/assets/interiorRoomTemplates.json";
import type { HandInteriorSpec } from "./builder";

export interface InteriorTemplateItem {
  /** o 가구 · t 탁자 자동 타일 · g 탁상 물건 · l 줄(깔개 등) · d 단 */
  readonly t: "o" | "t" | "g" | "l" | "d";
  readonly id: string;
  readonly x: number; readonly y: number;
  readonly w?: number; readonly h?: number;
  readonly cells?: readonly (readonly [number, number])[];
}
export interface InteriorRoomTemplate {
  readonly id: string; readonly map: string; readonly building: string; readonly kind: string;
  /** 방 칸(벽면 두 줄 포함)의 바깥 상자. mask 가 있으면 네모가 아닌 방('.' = 방 칸). */
  readonly w: number; readonly h: number; readonly mask?: readonly string[];
  readonly floor: string; readonly wall: string;
  items: InteriorTemplateItem[];
}
interface TemplateData {
  readonly templates: Readonly<Record<string, readonly InteriorRoomTemplate[]>>;
  /** 칩셋 → 건물 → 예제 맵별 방 종류 목록(방 구성표). */
  readonly programs: Readonly<Record<string, Readonly<Record<string, readonly { readonly map: string; readonly kinds: readonly string[] }[]>>>>;
}
const D = data as unknown as TemplateData;

export function roomTemplates(tilesetId: string): readonly InteriorRoomTemplate[] { return D.templates[tilesetId] ?? []; }
export function roomPrograms(tilesetId: string) { return D.programs[tilesetId] ?? {}; }

/** 예제 맵 key 또는 건물 id → 방 종류 목록. */
export function programKinds(tilesetId: string, program: string): { map: string; kinds: readonly string[] } | undefined {
  const P = roomPrograms(tilesetId);
  for (const list of Object.values(P)) { const hit = list.find((m) => m.map === program); if (hit) return hit; }
  return P[program]?.[0];
}

/**
 * 견본 화풍 묶음 — 한 건물 안에서 섞으면 어색한 것끼리 나눈다(2026-10-08: 대장간 침실에 엘프 궁정 침실(잎 벽·하프)이 들어왔다).
 * 손 도트 v5 예제 맵 → 묶음. 없는 맵(일본 집 등)은 한 묶음.
 */
const V5_STYLE: Record<string, string> = {
  bakery: "town", pharmacy: "town", fish: "town", butcher: "town", smithy: "town", scholar: "town", tailor: "town", tavern: "town", inn: "town",
  hobbit: "town", narshe: "town", zozo: "town", stable: "town",
  manor_1f: "noble", manor_2f: "noble", chapel: "noble", throne: "noble", opera: "noble", casino: "noble", mead: "noble",
  elf: "fantasy", dwarf: "fantasy", tower: "fantasy", magitek: "fantasy", mine: "fantasy", dungeon: "fantasy",
};
export function templateStyle(t: Pick<InteriorRoomTemplate, "map">): string { return V5_STYLE[t.map] ?? "any"; }

/** 종류가 같은 견본들(크기 가까운 순). style 을 주면 그 화풍 묶음을 먼저(없으면 전부). */
export function templatesOfKind(tilesetId: string, kind: string, near?: { w: number; h: number }, style?: string): InteriorRoomTemplate[] {
  const all = roomTemplates(tilesetId).filter((t) => t.kind === kind);
  const same = style ? all.filter((t) => templateStyle(t) === style) : all;
  const list = same.length ? same : all;
  return near ? [...list].sort((a, b) => Math.abs(a.w - near.w) + Math.abs(a.h - near.h) - (Math.abs(b.w - near.w) + Math.abs(b.h - near.h))) : [...list];
}

export interface TemplateCluster {
  /** t.items 의 번호 */
  readonly members: readonly number[];
  /** 견본 좌표의 바깥 상자 [x0, y0, x1(제외), y1(제외)] */
  readonly box: readonly [number, number, number, number];
  /** 벽 가구·걸이·문이 섞인 덩이 — 북쪽 벽 줄을 떠나지 않는다. */
  readonly pinTop: boolean;
  /** 막는 칸 수(큰 덩이부터 심는다) */
  readonly area: number;
  /** 덩이 안에서 서로 붙은 쌍(t.items 번호) */
  readonly links: readonly (readonly [number, number])[];
}

/** 견본 좌표의 [x, y, w, h] */
export function itemBox(it: InteriorTemplateItem, S: HandInteriorSpec): [number, number, number, number] {
  if (it.t === "l") { const xs = it.cells!.map((c) => c[0]), ys = it.cells!.map((c) => c[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1]; }
  if (it.t === "o") { const o = S.objects[it.id]; return [it.x, it.y, o?.w ?? 1, Math.max(1, o?.h ?? 1)]; }
  if (it.t === "t" || it.t === "d") return [it.x, it.y, it.w ?? 1, it.h ?? 1];
  return [it.x, it.y, 1, 1];
}

/** 가구가 막는 칸 수(탁상 물건·줄은 0) — 덩이 안 몸통 고르기. */
export function itemArea(it: InteriorTemplateItem, S: HandInteriorSpec): number {
  if (it.t === "g" || it.t === "l") return 0;
  const [, , w, h] = itemBox(it, S);
  return w * h;
}

/** 붙어 있는 가구(식탁+의자, 침대+협탁, 탁상 물건+가구)는 한 덩이 — 같이 옮긴다. */
export function templateClusters(t: InteriorRoomTemplate, S: HandInteriorSpec): TemplateCluster[] {
  const n = t.items.length, parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const boxes = t.items.map((it) => itemBox(it, S));
  const links: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const [ax, ay, aw, ah] = boxes[i]!, [bx, by, bw, bh] = boxes[j]!;
    // 1칸 띄운 것까지 붙은 것으로 본다(goods 는 가구 윗면 줄까지)
    const reach = t.items[i]!.t === "g" || t.items[j]!.t === "g" ? 2 : 1;
    if (ax <= bx + bw - 1 + reach && bx <= ax + aw - 1 + reach && ay <= by + bh - 1 + reach && by <= ay + ah - 1 + reach) { parent[find(i)] = find(j); links.push([i, j]); }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  const topRow = (it: InteriorTemplateItem) => it.t === "o" && ["wall", "hang", "door", "sidedoor"].includes(S.objects[it.id]?.kind ?? "");
  return [...groups.values()].map((members) => {
    const x0 = Math.min(...members.map((k) => boxes[k]![0])), x1 = Math.max(...members.map((k) => boxes[k]![0] + boxes[k]![2]));
    const y0 = Math.min(...members.map((k) => boxes[k]![1])), y1 = Math.max(...members.map((k) => boxes[k]![1] + boxes[k]![3]));
    const area = members.reduce((s, k) => s + itemArea(t.items[k]!, S), 0);
    const set = new Set(members);
    return { members, box: [x0, y0, x1, y1] as const, pinTop: members.some((k) => topRow(t.items[k]!)), area, links: links.filter(([p]) => set.has(p)) };
  });
}

/**
 * 방 크기가 견본과 다를 때 덩이를 어디로 옮겨 볼지(앞쪽이 먼저). 2026-10-09: 「반쪽에 따라 통째로 dw 만큼」 옮기던 방식은
 * 줄어든 방에서 덩이끼리 겹치고 방 밖으로 나가, 검사에 걸린 조각만 빠져 식탁 없는 의자·반쪽 부엌이 남았다.
 *  1) 벽에 붙은 덩이(1칸 이내)는 그 벽에 붙인 채로, 벽에서 떨어진 덩이는 방 안 상대 위치(비율)를 지킨다.
 *  2) 안 되면 다른 기준(왼·오른 벽, 위·아래 벽, 비율)과 1~3칸 비켜 놓기. 방 밖으로 나가는 자리는 빼고 준다.
 * 견본 세로가 2줄 이하(일본 현관 토방처럼 벽면 없는 띠)면 방 아래쪽에 붙인다.
 */
export function clusterShifts(t: InteriorRoomTemplate, c: TemplateCluster, w: number, h: number): [number, number][] {
  const [bx0, by0, bx1, by1] = c.box, bw = bx1 - bx0, bh = by1 - by0;
  if (bw > w || bh > h) return [];
  const dw = w - t.w, dh = h - t.h;
  const lgap = bx0, rgap = t.w - bx1;
  const prop = (c0: number, c1: number, from: number, to: number, off = 0) => Math.round(((c0 + c1) / 2 - off) * (to - off) / Math.max(1, from - off) + off - (c0 + c1) / 2);
  const xs = [lgap <= 1 && lgap <= rgap ? 0 : rgap <= 1 ? dw : prop(bx0, bx1, t.w, w), 0, dw, prop(bx0, bx1, t.w, w)];
  const strip = t.h <= 2;
  const tgap = by0 - 2, bgap = t.h - by1;
  const ys = c.pinTop ? [0] : strip ? [dh] : [tgap <= 1 && tgap <= bgap ? 0 : bgap <= 1 ? dh : prop(by0, by1, t.h, h, 2), 0, dh, prop(by0, by1, t.h, h, 2)];
  const out: [number, number][] = [];
  const seen = new Set<string>();
  const add = (sx: number, sy: number) => {
    sx = Math.min(w - bx1, Math.max(-bx0, sx));
    sy = c.pinTop ? Math.min(0, h - by1) : Math.min(h - by1, Math.max((strip ? 0 : Math.min(2, by0)) - by0, sy));
    if (bx0 + sx < 0 || bx1 + sx > w || by0 + sy < 0 || by1 + sy > h) return;
    const k = `${sx},${sy}`; if (!seen.has(k)) { seen.add(k); out.push([sx, sy]); }
  };
  add(xs[0]!, ys[0]!);
  for (const sx of xs) for (const sy of ys) add(sx, sy);
  for (let d = 1; d <= 3; d++) for (const [ex, ey] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, d], [d, -d], [-d, -d]] as const) add(xs[0]! + ex, ys[0]! + ey);
  return out;
}

/** 덩이를 (sx, sy) 만큼 옮겨 방 (x0,y0) 기준 절대 좌표로. */
export function shiftItems(t: InteriorRoomTemplate, c: TemplateCluster, sx: number, sy: number, room: { x0: number; y0: number }): InteriorTemplateItem[] {
  return c.members.map((k) => {
    const it = t.items[k]!;
    if (it.t === "l") return { ...it, cells: it.cells!.map(([x, y]) => [x + sx + room.x0, y + sy + room.y0] as [number, number]) };
    return { ...it, x: it.x + sx + room.x0, y: it.y + sy + room.y0 };
  });
}

/** 견본 가구를 방 (x0,y0,w,h) 에 옮긴 절대 좌표 목록(덩이마다 첫 후보 자리). 결과 검사는 부르는 쪽이 한다(furnish.ts). */
export function placeTemplateItems(t: InteriorRoomTemplate, room: { x0: number; y0: number; w: number; h: number }, S: HandInteriorSpec): InteriorTemplateItem[] {
  return templateClusters(t, S).flatMap((c) => { const s = clusterShifts(t, c, room.w, room.h)[0]; return s ? shiftItems(t, c, s[0], s[1], room) : []; });
}

/** 방 크기에 맞는 견본 — 지금 견본이 들어가면 그대로, 아니면 같은 종류·화풍에서 들어가는 것 중 가장 큰 것, 그래도 없으면 가장 덜 넘치는 것. */
export function fittingTemplate(tilesetId: string, current: InteriorRoomTemplate, w: number, h: number): InteriorRoomTemplate {
  if (current.w <= w && current.h <= h) return current;
  const pool = templatesOfKind(tilesetId, current.kind, undefined, templateStyle(current));
  const fit = pool.filter((t) => t.w <= w && t.h <= h).sort((a, b) => b.w * b.h - a.w * a.h);
  if (fit[0]) return fit[0];
  const over = (t: InteriorRoomTemplate) => Math.max(0, t.w - w) + Math.max(0, t.h - h);
  return [current, ...pool].sort((a, b) => over(a) - over(b))[0]!;
}
