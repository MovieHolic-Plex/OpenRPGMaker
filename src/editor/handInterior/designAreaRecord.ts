// 모델이 설계한 방의 구역(design.areas)을 맵 이름표(map.locations)로 남긴다 — 기록만 한다(가구를 고르거나 옮기지 않는다).
//
// 왜(2026-10-30 mapvqa ③): 판정자는 «한 칸짜리 방, 조사할 곳 없음, 같은 서가·식탁 줄 반복»을 졌다고, «서로 다른 구역을 오가는 방»을 이겼다고 봤다.
// 할 일 고리의 검사 room_zones(src/ai/v2/todo/checks.ts)는 맵 데이터만 읽는다 — 그래서 빌더가 모델의 구역·초점과 실제로 놓인 자리를 여기 적어 둔다.
//  - 구역 이름표: tags [design-area, room:<방 id>, focal:<칩셋 기물 id>, focal-at:x,y,w,h | focal-missing, (area-unplaced)], 상자 = 그 구역 묶음이 실제로 놓인 자리.
//  - 방 이름표 덧붙임: objs:<id>*<n>;… (놓인 기물 수) · same-groups:<n> (기물 구성이 같은 묶음이 가장 많이 겹친 수).
import type { DesignRoomReport, PlacedDesignGroup, RoomDesign } from "./designRoom";
import { resolveDesignItem } from "./designRoom";
import type { HandInteriorSpec } from "./builder";

export const DESIGN_AREA_TAG = "design-area";

export interface DesignAreaDraft { name: string; x: number; y: number; w: number; h: number; note: string; tags: string[] }
interface RoomBox { readonly id: string; readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[\s_·\-()]+/gu, "").trim();
/** 의자 방향 꼬리(N·S·E·W)를 뗀 기물 이름 — 「chair N」 와 「chair S」 는 같은 기물. */
const base = (id: string) => id.replace(/ [NSEW]$/u, "");

/** 이 기물이 초점 id 와 같은 기물인가. */
function sameItem(id: string, focal: string): boolean {
  const a = norm(base(id)), b = norm(base(focal));
  return !!b && (a === b || a.startsWith(b) || b.startsWith(a));
}

type Box = readonly [number, number, number, number];
function union(boxes: readonly Box[]): Box | undefined {
  if (!boxes.length) return undefined;
  return [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
}

/** 놓인 기물 구성 서명(정렬한 id 목록, 의자 방향 무시). */
const signature = (g: PlacedDesignGroup) => g.items.map((it) => base(it.id)).sort().join("+");

/** 방 이름표에 덧붙일 기록(놓인 기물 수·같은 구성 묶음 수). */
export function roomPieceTags(report: DesignRoomReport): string[] {
  const counts = new Map<string, number>();
  for (const g of report.groups ?? []) for (const it of g.items) counts.set(base(it.id), (counts.get(base(it.id)) ?? 0) + 1);
  const sigs = new Map<string, number>();
  for (const g of report.groups ?? []) if (g.items.length >= 2) sigs.set(signature(g), (sigs.get(signature(g)) ?? 0) + 1);
  const objs = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([id, n]) => `${id}*${n}`).join(";");
  return [...(objs ? [`objs:${objs}`] : []), `same-groups:${Math.max(0, ...sigs.values())}`];
}

/** 설계 방 하나의 구역 이름표들. 구역 칸이 없으면 빈 목록(검사가 «구역 기록 없음»으로 짚는다). */
export function designAreaDrafts(room: RoomBox, design: RoomDesign, report: DesignRoomReport, S: HandInteriorSpec): DesignAreaDraft[] {
  const areas = Array.isArray(design.areas) ? design.areas.slice(0, 6) : [];
  const groups = report.groups ?? [];
  const out: DesignAreaDraft[] = [];
  for (const a of areas) {
    if (!a || typeof a !== "object") continue;
    const name = String(a.name ?? "").trim().slice(0, 40) || `구역 ${out.length + 1}`;
    const focalRaw = String(a.focal ?? "").trim();
    const focal = (focalRaw && resolveDesignItem(focalRaw, S)?.id) || focalRaw;
    const mine = groups.filter((g) => g.area && norm(g.area) === norm(name));
    const hit = (list: readonly PlacedDesignGroup[]) => list.flatMap((g) => g.items).find((it) => focal && sameItem(it.id, focal));
    const focalItem = hit(mine) ?? hit(groups);
    const rect = union(mine.flatMap((g) => g.items.map((it) => it.box))) ?? (focalItem ? focalItem.box : undefined);
    const tags = [DESIGN_AREA_TAG, `room:${room.id}`, `focal:${focal || "(없음)"}`];
    if (focalItem) { const b = focalItem.box; tags.push(`focal-at:${b[0]},${b[1]},${b[2] - b[0]},${b[3] - b[1]}`); } else tags.push("focal-missing");
    if (!mine.length) tags.push("area-unplaced");
    // 구역 상자: 놓인 묶음 둘레 한 칸(방 안으로 자름). 놓인 것이 없으면 방 전체.
    const r = rect ?? [room.x0, room.y0, room.x1 + 1, room.y1 + 1];
    const x0 = Math.max(room.x0, r[0] - 1), y0 = Math.max(room.y0, r[1] - 1), x1 = Math.min(room.x1 + 1, r[2] + 1), y1 = Math.min(room.y1 + 1, r[3] + 1);
    const note = `${String(a.purpose ?? "").trim()} — 초점 ${focalRaw || "없음"} — 오는 이유: ${String(a.visit ?? "").trim()}`.slice(0, 240);
    out.push({ name, x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0), note, tags });
  }
  return out;
}

// ───────────── 방 그래프 기록(2026-10-30 2회차) ─────────────
// 모델이 선언한 방 그래프(방·연결·입구·계단·랜드마크)와 실제로 놓인 자리를 맵 이름표로 남긴다 — 할 일 검사 room_graph(todo/checks.ts)가 읽는다.
//  - 선언 이름표 하나: tags [room-graph, decl], note = 선언 JSON.
//  - 방마다 이름표: tags [room-graph, room:<id>, landmark:<id>, landmark-at:x,y,w,h | landmark-missing, stairs:<up|down>, stairs-at:x,y,w,h | stairs-missing], 상자 = 방 사각형.
export const ROOM_GRAPH_TAG = "room-graph";
export interface RoomGraphDecl {
  readonly rooms: readonly { readonly id: string; readonly name: string; readonly role?: string; readonly stairs?: string; readonly landmark?: string }[];
  readonly connections: readonly { readonly a: string; readonly b: string; readonly type: string }[];
  readonly entrance: string;
}

export function roomGraphDrafts(map: { width: number; height: number }, decl: RoomGraphDecl, rooms: readonly RoomBox[], reports: Readonly<Record<string, DesignRoomReport>>, S: HandInteriorSpec): DesignAreaDraft[] {
  const out: DesignAreaDraft[] = [{ name: "room graph", x: 0, y: 0, w: map.width, h: map.height, note: JSON.stringify(decl).slice(0, 4000), tags: [ROOM_GRAPH_TAG, "decl"] }];
  for (const d of decl.rooms) {
    const r = rooms.find((q) => q.id === d.id);
    if (!r) continue;
    const items = (reports[d.id]?.groups ?? []).flatMap((g) => g.items);
    const tags = [ROOM_GRAPH_TAG, `room:${d.id}`, ...(d.role ? [`role:${d.role}`] : [])];
    if (d.landmark) {
      const want = resolveDesignItem(d.landmark, S)?.id ?? d.landmark;
      const hit = items.find((it) => sameItem(it.id, want));
      tags.push(`landmark:${want}`, hit ? `landmark-at:${hit.box[0]},${hit.box[1]},${hit.box[2] - hit.box[0]},${hit.box[3] - hit.box[1]}` : "landmark-missing");
    }
    if (d.stairs) {
      const hit = items.find((it) => !!S.objects[it.id]?.stairs);
      tags.push(`stairs:${d.stairs}`, hit ? `stairs-at:${hit.box[0]},${hit.box[1]},${hit.box[2] - hit.box[0]},${hit.box[3] - hit.box[1]}` : "stairs-missing");
    }
    out.push({ name: d.name || d.id, x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1, note: `declared room ${d.id}`, tags });
  }
  return out;
}
