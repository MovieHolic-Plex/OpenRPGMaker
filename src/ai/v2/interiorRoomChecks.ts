// 실내 칸 배치(벽 우선 형식)의 방 검사 — 요청 물건(required)·바닥 재질·물건 다양성·감방 앞. 함수는 재고 이름만 붙인다(가구를 고르지 않는다).
//
// 왜(2026-10-31 bbox 실험 이식):
// - required: agent/bbox-chipsets-2 4판(scripts/experiments/bbox-chipsets/sketch.py required_check) — 요청이 이름 댄 물건(마법약 교실의 «솥»)을
//   모델이 작업대 위 덧그림(발밑 없는 조각)으로만 놓아 판정자가 «솥이 없다»고 읽었다. 서 있는 조각으로 보이게 한다.
// - 바닥: 같은 줄기 3판(floors.mts) — 방마다 한 바닥 + 쓰임 있는 하위 구역 하나, 외톨이 한 칸 바닥 금지, 다다미는 통짜 돗자리(tatami.ts).
// - 다양성·감방 앞: agent/bbox-walls-2 5~7판(scripts/experiments/bbox-walls-7/lay.mts) — 한 방에 같은 조각 5번 이상(의자·창처럼 되풀이가
//   자연스러운 것 제외)과 같은 용도 방 셋 이상에 같은 조각, 문살 없이 열린 감방을 알린다(알림만, 거절하지 않는다).
// 모델이 받는 글은 모두 영어다.
import type { HandInteriorSpec } from "@/editor/handInterior/builder";
import { tatamiSizes, tatamiTiling, isTatamiFloor } from "@/editor/handInterior/tatami";

export interface RequiredEntry { readonly ask: string; readonly ids?: readonly string[]; readonly missing?: string }
export interface RequiredResult { readonly ask: string; readonly ok: boolean; readonly why?: string }

const STOP = new Set("a an the of for with and or in on at to from by as is are be where which who that this those these each area areas room rooms space front back side corner zone place single combined".split(" "));
const words = (s: string): string[] => (s.toLowerCase().match(/[a-z]+|[가-힣]+/gu) ?? []).filter((w) => !STOP.has(w) && w.length >= (/[가-힣]/u.test(w) ? 1 : 3));
const textOf = (S: HandInteriorSpec, id: string): string => {
  const o = S.objects[id] as (HandInteriorSpec["objects"][string] & { ko?: string; tags?: readonly string[]; desc?: string }) | undefined;
  return `${id} ${o?.ko ?? ""} ${(o?.tags ?? []).join(" ")}`.toLowerCase();
};
/** 서 있는 조각(발밑 한 칸 이상인 바닥·벽 붙이) 또는 벽걸이 — 바닥 무늬와 발밑 없는 덧그림(h 0)은 아니다. */
const standing = (S: HandInteriorSpec, id: string): boolean => { const o = S.objects[id]; return !!o && (o.kind === "hang" || ((o.kind === "floor" || o.kind === "wall") && (o.h ?? 0) >= 1)); };
/** 발밑 없는 덧그림(다른 조각 위에 겹쳐 그리는 것 — 작업대 위 솥 김). 밟는 바닥 무늬(깔개)는 아니다. */
const overlay = (S: HandInteriorSpec, id: string): boolean => { const o = S.objects[id]; return !!o && (o.kind === "floor" || o.kind === "wall") && (o.h ?? 0) < 1; };
const base = (id: string) => id.replace(/ \d+x\d+$/u, "");

/**
 * 요청 물건 목록 검사. 모델이 layout.required 에 {ask, ids} 또는 {ask, missing} 을 쓴다.
 * 걸리는 것: 놓지 않은 id, 낱말이 덧그림으로만 보이는 것(서 있는 조각이 있으면 이름을 댄다), 맞는 조각이 있는데 «missing».
 */
export function requiredCheck(raw: unknown, placed: readonly string[], S: HandInteriorSpec): { problems: string[]; results: RequiredResult[] } {
  const problems: string[] = [], results: RequiredResult[] = [];
  if (!Array.isArray(raw)) return { problems, results };
  const have = new Set(placed.flatMap((id) => [id, base(id)]));
  const all = Object.keys(S.objects).filter((id) => S.objects[id]!.kind !== "door" && S.objects[id]!.kind !== "sidedoor");
  for (const r of raw as RequiredEntry[]) {
    if (!r || typeof r.ask !== "string" || !r.ask.trim()) continue;
    const ask = r.ask.trim().slice(0, 60);
    const ws = words(ask);
    const ids = (Array.isArray(r.ids) ? r.ids : []).filter((i): i is string => typeof i === "string" && i !== "");
    if (ids.length) {
      const nope = ids.filter((i) => !have.has(i) && !have.has(base(i)));
      if (nope.length) { const why = `lists ${nope.map((i) => `"${i}"`).join(", ")} but they are not placed`; problems.push(`required "${ask}" ${why} — place them in objects/wall_items, sized and positioned for this use, or list the ids you did place.`); results.push({ ask, ok: false, why }); continue; }
      const listed = ids.map(base).filter((i) => S.objects[i]);
      const shownOnlyBy = ws.find((w) => listed.some((i) => overlay(S, i) && textOf(S, i).includes(w)) && !listed.some((i) => standing(S, i) && textOf(S, i).includes(w)));
      if (shownOnlyBy) {
        const alt = all.filter((i) => standing(S, i) && textOf(S, i).includes(shownOnlyBy)).slice(0, 6);
        if (alt.length) {
          const why = `shows "${shownOnlyBy}" only through an overlay (${listed.filter((i) => overlay(S, i)).map((i) => `"${i}"`).join(", ")})`;
          problems.push(`required "${ask}" ${why}: an overlay is drawn over another piece and mostly hidden by it, so the player does not see a ${shownOnlyBy}. Place a standing piece that shows it, e.g. ${alt.map((i) => `"${i}"`).join(", ")} (find_pieces lists them with their size).`);
          results.push({ ask, ok: false, why }); continue;
        }
      }
      results.push({ ask, ok: true }); continue;
    }
    if (typeof r.missing === "string" && r.missing.trim()) {
      const hits = all.filter((i) => standing(S, i) && ws.some((w) => w.length >= 3 && textOf(S, i).includes(w))).slice(0, 6);
      if (hits.length) { const why = "marked missing, but the chipset has matching pieces"; problems.push(`required "${ask}" is ${why} (e.g. ${hits.map((i) => `"${i}"`).join(", ")}) — look at them with find_pieces and place a fitting one, or say in "missing" why none of them fits.`); results.push({ ask, ok: false, why }); }
      else results.push({ ask, ok: true, why: `missing: ${r.missing.slice(0, 80)}` });
      continue;
    }
    problems.push(`required "${ask}" has neither "ids" (the pieces you placed for it) nor "missing" (why no piece fits).`);
    results.push({ ask, ok: false, why: "no ids" });
  }
  return { problems, results };
}

export interface FloorRoom { readonly id: string; readonly floorCells: readonly number[]; readonly jo?: unknown }
/**
 * 바닥 검사. floorAt(i) = 그 칸의 최종 바닥 id(바닥 칸이 아니면 null). 다다미 바닥은 통짜 돗자리로 깔려야 하고(못 깔면 고칠 말),
 * 방이 jo(돗자리 장수)를 말하면 다다미 칸 수 = 2 × jo. 외톨이 한 칸 바닥(네 이웃 중 바닥 둘 이상이 모두 다른 재질)은 고칠 말,
 * 한 방에 바닥 재질 셋 이상은 알림.
 */
export function floorChecks(W: number, H: number, floorAt: (i: number) => string | null, rooms: readonly FloorRoom[], S: HandInteriorSpec): { problems: string[]; notes: string[]; islands: number; tatamiMats: number } {
  const problems: string[] = [], notes: string[] = [];
  let tatamiMats = 0;
  for (const r of rooms) {
    const count = new Map<string, number>();
    for (const i of r.floorCells) { const f = floorAt(i); if (f) count.set(f, (count.get(f) ?? 0) + 1); }
    const kinds = [...count].sort((a, b) => b[1] - a[1]);
    if (kinds.length > 2) notes.push(`room "${r.id}" uses ${kinds.length} floor materials (${kinds.map(([k, n]) => `${k} ${n}`).join(", ")}) — keep one main floor plus at most one sub-zone with a purpose (an entry, kitchen tiles, a wet area).`);
    for (const [f] of kinds) {
      if (!isTatamiFloor(f, S.floors[f])) continue;
      const cells = new Set(r.floorCells.filter((i) => floorAt(i) === f));
      const xs = [...cells].map((i) => i % W), ys = [...cells].map((i) => Math.floor(i / W));
      const box = `${Math.max(...xs) - Math.min(...xs) + 1}x${Math.max(...ys) - Math.min(...ys) + 1} cells from (${Math.min(...xs)},${Math.min(...ys)})`;
      const jo = r.jo;
      if (jo !== undefined && (typeof jo !== "number" || cells.size !== 2 * jo)) {
        problems.push(`room "${r.id}" says ${String(jo)} jo but its tatami floor is ${cells.size} cells (${box}); one jo is one 1x2-cell mat, so ${String(jo)} jo needs ${typeof jo === "number" ? 2 * jo : "2 x jo"} floor cells${typeof jo === "number" && tatamiSizes(2 * jo) ? ` (${tatamiSizes(2 * jo)})` : ""}. Fixed call: move the room's walls so its tatami floor (below the 2 face rows) is that size, or change "jo" to ${cells.size % 2 ? "a size that fits an even floor" : cells.size / 2}.`);
        continue;
      }
      const mats = tatamiTiling(cells, W);
      if (!mats) problems.push(`room "${r.id}": its tatami floor (${cells.size} cells, ${box}) cannot be laid with whole mats (each mat is 1x2 cells, laid along the walls, no point where four mat corners meet). Make the tatami floor an even rectangle such as 4x3 (6 jo), 4x4 (8 jo), 4x6 or 6x4 (12 jo) floor cells, or give that room another floor.`);
      else tatamiMats += mats.length;
    }
  }
  let islands = 0; const where: string[] = [];
  for (let i = 0; i < W * H; i++) {
    const f = floorAt(i); if (!f) continue;
    const x = i % W, y = (i - x) / W;
    const n = ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const).map(([a, b]) => (a >= 0 && b >= 0 && a < W && b < H ? floorAt(b * W + a) : null)).filter((v): v is string => !!v);
    if (n.length >= 2 && n.every((v) => v !== f)) { islands++; if (where.length < 6) where.push(`(${x},${y}) ${f}`); }
  }
  if (islands) problems.push(`${islands} single-cell floor island${islands === 1 ? "" : "s"} — a lone cell of a different floor (${where.join(", ")}). Widen that floor zone to a real area or merge the cell into the floor around it.`);
  return { problems, notes, islands, tatamiMats };
}

/** 되풀이가 자연스러운 조각(줄 지은 의자·창·촛대·감방 침상·책장…). */
const REPEAT_OK = /chair|stool|bench|pew|seat|candle|sconce|torch|lantern|lamp|window|column|pillar|bars|gate|cot|straw|plant|fern|potted|bunk|bed|book|shelf|bookcase|stack|desk|table|dining|work|crate|barrel|sack|counter/u;
const GENERIC = /window|sconce|torch|candle|chair|stool|bench|gate|locked door|bars|doormat|lamp|lantern/u;
const famOf = (id: string) => /^([a-z-]+) \d+x\d+$/u.exec(id)?.[1] ?? id;

export interface VarietyRoom { readonly id: string; readonly purpose?: string; readonly repeat?: boolean; readonly pieces: readonly string[] }
/** 다양성 알림 — 한 방에 같은 조각 5번 이상, 같은 용도 방 셋 이상에 같은 조각(같은 범주 다른 조각이 있을 때). 숫자도 낸다. */
export function varietyNotes(rooms: readonly VarietyRoom[], S: HandInteriorSpec): { notes: string[]; distinctPerRoom: number; repetition: number } {
  const notes: string[] = [];
  const catOf = (id: string) => S.objects[id]?.category;
  const altsOf = (id: string, used: ReadonlySet<string>) => { const c = catOf(id); return c ? Object.keys(S.objects).filter((o) => catOf(o) === c && o !== id && !used.has(o) && S.objects[o]!.kind === S.objects[id]!.kind && !GENERIC.test(o)).slice(0, 4) : []; };
  let n = 0, distinct = 0;
  const kindOf = (r: VarietyRoom) => (r.purpose ?? r.id).toLowerCase().split(/[\s,.;—-]+/u).find((w) => w.length > 2) ?? r.id;
  for (const r of rooms) {
    const cnt = new Map<string, number>(); for (const id of r.pieces) cnt.set(famOf(id), (cnt.get(famOf(id)) ?? 0) + 1);
    n += r.pieces.length; distinct += cnt.size;
    if (r.repeat || /\bcells?\b|guest/u.test(`${r.id} ${r.purpose ?? ""}`.toLowerCase())) continue;
    for (const [f, m] of cnt) if (m > 4 && !REPEAT_OK.test(f)) {
      const alts = altsOf(f, new Set(cnt.keys()));
      notes.push(`room "${r.id}" uses "${f}" ${m} times. Rooms collect different things over time, so the same piece stamped over and over reads as a placeholder; keep the repetition only where the use repeats (a row of chairs, cell after cell) and swap some for other pieces of the same kind${alts.length ? ` — e.g. ${alts.map((a) => `"${a}"`).join(", ")} (find_pieces("${catOf(f)}") lists them all)` : ""}.`);
    }
  }
  const byKind = new Map<string, VarietyRoom[]>(); for (const r of rooms) { const k = kindOf(r); byKind.set(k, [...(byKind.get(k) ?? []), r]); }
  for (const [k, rs] of byKind) {
    if (rs.length < 3) continue;
    const used = new Set(rs.flatMap((r) => r.pieces.map(famOf)));
    for (const id of used) {
      if (GENERIC.test(id) || !S.objects[id]) continue;
      const inRooms = rs.filter((r) => r.pieces.map(famOf).includes(id)); if (inRooms.length < 3) continue;
      const alts = altsOf(id, used); if (alts.length < 2) continue;
      notes.push(`"${id}" appears in ${inRooms.length} of the ${rs.length} "${k}" rooms (${inRooms.map((r) => `"${r.id}"`).join(", ")}). Rooms that share a use still belong to different people; give some of them a different ${catOf(id)} — e.g. ${alts.slice(0, 3).map((o) => `"${o}"`).join(", ")} (mind each one's footprint).`);
    }
  }
  return { notes, distinctPerRoom: Math.round((10 * distinct) / Math.max(1, rooms.length)) / 10, repetition: Math.round(100 * (1 - distinct / Math.max(1, n))) / 100 };
}

/** 감방인가 — 방 이름이나 쓰임에 cell/감방/감옥 칸. */
export const isPrisonCell = (r: { id: string; purpose?: string }): boolean => /\bcells?\b|prison cell|감방/u.test(`${r.id} ${r.purpose ?? ""}`.toLowerCase()) && !/corridor|guard/u.test(r.id.toLowerCase());

/** 감방 앞 알림 — 문살(가로 벽 문의 쇠창살 문짝, 또는 bars 난간)이 없는 감방. */
export function cellFrontNote(id: string): string {
  return `room "${id}" is a prison cell with an open front. A cell is shut by iron bars so the guard sees in from the corridor and the player reads it as a cell; an open doorway reads as a plain room. Put its door in a HORIZONTAL wall with "piece": "iron gate" (a gate leaf faces south, so a vertical-wall doorway cannot take one), or close its corridor side with a "bars" rail that leaves a 1-cell gap holding an "iron gate" object.`;
}
