// 방 견본 — 제작자 예제 맵을 방 단위로 자른 것(scripts/content/interior-templates/extract.mts 가 굽는다).
// 집 한 채를 베끼는 대신, layout.ts 가 새로 짠 방 사각형마다 같은 종류 견본의 가구 한 벌을 옮겨 심는다.
// 옮겨 심기: 방 크기가 견본과 다르면 가구마다 가까운 벽에 붙여(왼쪽 반은 왼쪽 벽 기준, 오른쪽 반은 오른쪽 벽 기준, 위·아래도 같다)
// 거리를 지킨다. 벽 가구·걸이는 늘 북쪽 벽 줄에 남는다. 심은 뒤 조립기로 오류·막힘을 검사해 걸리는 가구는 뺀다(tools 쪽).
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

/** 견본 가구를 방 (x0,y0,w,h) 에 옮긴 절대 좌표 목록. 결과 검사는 부르는 쪽이 한다. */
export function placeTemplateItems(t: InteriorRoomTemplate, room: { x0: number; y0: number; w: number; h: number }, S: HandInteriorSpec): InteriorTemplateItem[] {
  const dw = room.w - t.w, dh = room.h - t.h;
  const box = (it: InteriorTemplateItem): [number, number, number, number] => {
    if (it.t === "l") { const xs = it.cells!.map((c) => c[0]), ys = it.cells!.map((c) => c[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1]; }
    if (it.t === "o") { const o = S.objects[it.id]; return [it.x, it.y, o?.w ?? 1, Math.max(1, o?.h ?? 1)]; }
    if (it.t === "t" || it.t === "d") return [it.x, it.y, it.w ?? 1, it.h ?? 1];
    return [it.x, it.y, 1, 1];
  };
  const topRow = (it: InteriorTemplateItem) => it.t === "o" && ["wall", "hang", "door", "sidedoor"].includes(S.objects[it.id]?.kind ?? "");
  // 붙어 있는 가구(식탁+의자, 침대+협탁, 탁상 물건+가구)는 한 덩이로 움직인다 — 덩이마다 가까운 벽을 기준으로.
  const n = t.items.length, parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const boxes = t.items.map(box);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const [ax, ay, aw, ah] = boxes[i]!, [bx, by, bw, bh] = boxes[j]!;
    // 1칸 띄운 것까지 붙은 것으로 본다(goods 는 가구 윗면 줄까지)
    const reach = t.items[i]!.t === "g" || t.items[j]!.t === "g" ? 2 : 1;
    if (ax <= bx + bw - 1 + reach && bx <= ax + aw - 1 + reach && ay <= by + bh - 1 + reach && by <= ay + ah - 1 + reach) parent[find(i)] = find(j);
  }
  const shift = new Map<number, [number, number]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (shift.has(root)) continue;
    const members = t.items.map((_, k) => k).filter((k) => find(k) === root);
    const x0 = Math.min(...members.map((k) => boxes[k]![0])), x1 = Math.max(...members.map((k) => boxes[k]![0] + boxes[k]![2]));
    const y0 = Math.min(...members.map((k) => boxes[k]![1])), y1 = Math.max(...members.map((k) => boxes[k]![1] + boxes[k]![3]));
    const pinTop = members.some((k) => topRow(t.items[k]!));
    shift.set(root, [(x0 + x1) / 2 > t.w / 2 ? dw : 0, pinTop ? 0 : ((y0 + y1) / 2 > t.h / 2 ? dh : 0)]);
  }
  return t.items.map((it, i) => {
    const [sx, sy] = shift.get(find(i))!;
    if (it.t === "l") return { ...it, cells: it.cells!.map(([x, y]) => [x + sx + room.x0, y + sy + room.y0] as [number, number]) };
    return { ...it, x: it.x + sx + room.x0, y: it.y + sy + room.y0 };
  });
}
