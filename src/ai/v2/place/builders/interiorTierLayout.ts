// 크기 단(대형·초대형) 건물의 문 뒤에 모델이 방이 모자란 칸 배치를 보냈을 때 — 모델의 배치를 본채의 큰 방(본당·홀)으로 그대로 두고,
// 그 단의 구성(handInterior/tierPlan.ts)이 가진 나머지 방을 그 둘레에 붙이고, 딸린 맵(지하 묘·종탑…)을 지어 계단으로 잇는다.
//
// 왜(2026-11-17 r8 실모델 «갈매나루 대성당», Opus 5.5 medium): 모델은 hints.door 와 함께 늘 제 배치(24×22, 방 셋)를 보냈고, 빌더는 배치를 그대로 깔고
// «배치 없이 다시 부르라» 는 알림만 붙였다 — 모델은 다시 부르지 않았고 초대형 구성(방 열하나, 지하 묘 · 종탑 맵)은 한 번도 서지 않았다.
// 모델이 따라야 하는 알림은 기본값이 아니다. 여기서는 되돌려 보내지 않고, 모델의 설계를 버리지도 않는다:
//   · 모델의 배치(벽 · 문 · 방 이름표 · 랜드마크 · 기물 · 입구)는 쓴 그대로 둔다 — 붙이는 방은 그 바깥 벽 고리 밖에만 선다.
//   · 구성의 방 가운데 모델의 방이 이미 맡은 쓰임(같은 쓰임 낱말의 방 · 계단 방)은 붙이지 않는다.
//   · 붙인 방은 그 칩셋의 방 견본(구성 표가 고르는 것과 같은 견본)으로 채우고 모델의 바깥 벽에 문을 하나 내어 잇는다.
//   · 구성의 딸린 맵(지하 · 위층 · 탑)은 구성대로 짓고 계단끼리 잇는다 — 모델의 계단 방이 이미 다른 맵으로 이어져 있으면 그 길을 쓴다(둘을 만들지 않는다).
// 결과 글은 무엇을 어디에 붙였는지 · 문이 어디인지를 영어로 적는다(모델이 꾸미거나 바꿀 수 있게). 하나라도 못 하면 undefined — 부르는 쪽이 배치 그대로 깐다.
import type { HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomTemplates } from "@/editor/handInterior/templates";
import { kitInteriorKinds, tierProgramFor, tierTableOf, tierTemplatePicker, type TierMapPlan, type TierProgram, type TierRoom } from "@/editor/handInterior/tierPlan";
import { hashText, mixHash } from "@/editor/handInterior/vignettes";
import type { GameMap } from "@/project/types";
import type { BuildRun, PlaceBuildResult, PlaceSpec } from "../../shared/types";
import { layoutGiven, type InteriorLayout } from "../interiorLayout";
import { swapUnknownWords } from "../unknownWords";
import { buildFromLayout } from "./interiorLayoutBuild";
import { exteriorWall, type ExteriorLook } from "./interiorExterior";
import { buildTierMap, tierMapCtx, type BuiltTierMap, type TierState } from "./interiorTier";

export interface TierAroundAsk {
  readonly tilesetId: string; readonly roomSpec: HandInteriorSpec; readonly outside: ExteriorLook;
  readonly varietyKey: string; readonly mapId: string | undefined;
  /** 다른 표(지시문 카드의 v5 등) — 그 표의 낱말을 이 표의 가장 가까운 조각으로 바꿀 때 쓴다. */
  readonly others?: readonly HandInteriorSpec[];
  /** 앞서 이 장소를 이렇게 지었으면 그 딸린 맵 id(다시 지어도 같은 맵에). */
  readonly prev?: TierState;
}

/** 키운 배치를 장소 기록의 명세로 — 다음 고침이 모델이 보는 맵의 좌표로 닿게. 키우지 않았으면 그대로. */
export function adoptGrownLayout(spec: PlaceSpec, result: PlaceBuildResult): PlaceSpec {
  const grown = (result.state as { around?: { layout?: unknown } } | undefined)?.around?.layout;
  return result.ok && grown ? { ...spec, layout: grown as never } : spec;
}

type Pt = [number, number];
type AnyObj = Record<string, unknown>;
/** 배치의 목록 하나를 느슨한 칸 목록으로(배치 형식의 읽기 전용 타입을 이 파일에서 한 번에 푼다). */
const list = <T = AnyObj>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
interface Annex { id: string; kind: string; template: string; x0: number; y0: number; x1: number; y1: number; floor: string; wall: string; side: "N" | "E" | "W"; doorAt: Pt; items: AnyObj[]; wallItems: AnyObj[]; ko: string }

/** 방 종류 → 사람이 읽는 영어 이름(결과 글). 모르는 종류는 종류 낱말 그대로(t_ 머리는 뗀다). */
const KIND_EN: Readonly<Record<string, string>> = {
  chapel: "side chapel", study: "vestry / office", bedroom: "bedroom", t_sanctuary: "sanctuary", t_vault: "treasury", t_stair: "tower stair",
  t_downstair: "stair down", t_corridor: "corridor", t_belfry: "belfry", t_crypt: "crypt", cellar: "cellar", library: "library", storeroom: "storeroom",
  kitchen: "kitchen", t_refectory: "refectory", t_dorm: "dormitory", t_court: "courtyard", t_throne: "throne hall", guard_room: "guard room", t_armoury: "armoury",
};
const en = (kind: string) => KIND_EN[kind] ?? kind.replace(/^t_/u, "").replace(/_/gu, " ");

/**
 * 모델의 방이 맡은 쓰임 — 본채 방(role main · 입구가 여는 방)을 뺀 방마다 하나씩: 방 id · purpose 낱말 가운데 칩셋 방 표의 종류 낱말(kinds 의 열쇠 · ko · 별칭).
 * 낱말 목록을 손으로 두지 않는다: 칩셋 사양이 준다. 계단(오르내림)은 방 선언(stairs)과 놓인 계단 조각으로 본다.
 */
function coveredKinds(L: InteriorLayout, S: HandInteriorSpec): { stairsDown: boolean; stairsUp: boolean; kinds: Map<string, number> } {
  const kinds = new Map<string, number>();
  let stairsDown = false, stairsUp = false;
  const table = Object.entries(S.rooms?.kinds ?? {}) as [string, { ko: string; alias: readonly string[] }][];
  const entranceAbove = (r: { at?: Pt }) => Array.isArray(r.at) && r.at[0] === L.entrance.x;
  for (const r of list<{ id?: string; purpose?: string; role?: string; stairs?: string; at?: Pt }>(L.rooms)) {
    if (r?.stairs === "down") stairsDown = true;
    if (r?.stairs === "up") stairsUp = true;
    if (r?.role === "main" || (!r?.role && entranceAbove(r))) continue;
    const text = `${r?.id ?? ""} ${r?.purpose ?? ""}`.toLowerCase();
    const hit = table.find(([k, def]) => [k, def.ko, ...(def.alias ?? [])].some((w) => !!w && String(w).length >= 2 && text.includes(String(w).toLowerCase())));
    if (hit) kinds.set(hit[0], (kinds.get(hit[0]) ?? 0) + 1);
  }
  for (const o of [...list(L.objects), ...list(L.wall_items)]) {
    const d = typeof o?.id === "string" ? S.objects[o.id] : undefined;
    if (d?.stairs === "down") stairsDown = true;
    if (d?.stairs === "up") stairsUp = true;
  }
  return { stairsDown, stairsUp, kinds };
}

/** 모델의 바깥 벽 고리가 사각형이면 그 상자. 사각형이 아니면 undefined(둘레에 붙일 자리를 셈하지 않는다 — 부르는 쪽이 배치 그대로 깐다). */
function ringBox(L: InteriorLayout): { x0: number; y0: number; x1: number; y1: number } | undefined {
  const path = (L.outer_wall?.path ?? []) as Pt[];
  if (path.length < 4) return undefined;
  const xs = path.map((p) => p[0]), ys = path.map((p) => p[1]);
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  return path.every((p) => (p[0] === box.x0 || p[0] === box.x1) && (p[1] === box.y0 || p[1] === box.y1)) ? box : undefined;
}

/** 붙일 방(구성의 본채 평면 가운데 모델이 맡지 않은 것) — 계단 방은 딸린 맵이 있을 때만, 바깥문 방(현관 복도)은 빼고. */
function annexRooms(program: TierProgram, shape: TierMapPlan, covered: ReturnType<typeof coveredKinds>, mainKind: string): TierRoom[] {
  const linkRooms = new Set((program.links ?? []).map((l) => l.from.split("/")[1]));
  return shape.rooms.filter((r, i) => {
    if (i === 0 || r.id === shape.exit) return false;                        // 현관 복도 · 첫 방(본채의 앞) — 모델의 입구가 맡는다
    const kind = r.kind === "$main" ? mainKind : r.kind;
    if (kind === "t_corridor") return true;      // 복도는 붙인 방끼리 잇는다(본당 뒤 회랑) — 아무 방도 잇지 않으면 아래 «닿는 방» 셈이 뺀다
    if (kind === "t_nave" || kind === "t_nave_open" || kind === "t_court" || kind === "t_stairhall") return false;   // 본채의 큰 방 = 모델의 배치
    if (kind === "t_downstair") return !covered.stairsDown && linkRooms.has(r.id);
    if (kind === "t_stair") return linkRooms.has(r.id);
    const left = covered.kinds.get(kind) ?? 0;
    if (left > 0) { covered.kinds.set(kind, left - 1); return false; }
    return true;
  });
}

/**
 * 모델의 배치(벽 우선 형식, 사각형 고리)에 구성의 방을 붙여 한 배치로 깐다. 딸린 맵은 구성대로 짓고 계단으로 잇는다.
 * 못 하면 undefined(고리가 사각형이 아니다 · 붙일 자리가 없다 · 짓기가 거절했다) — 부르는 쪽이 배치 그대로 깔고 단을 알린다.
 */
export function buildTierAroundLayout(run: BuildRun, spec: PlaceSpec, ask: TierAroundAsk): PlaceBuildResult | undefined {
  const S = ask.roomSpec, tid = ask.tilesetId;
  if (!layoutGiven(spec.layout) || !(spec.layout as InteriorLayout).outer_wall) return undefined;
  const table = tierTableOf(tid); const o = ask.outside;
  if (!table || !o.tier || o.tier === "small") return undefined;
  // 낱말은 먼저 이 표의 것으로 바꾼다(검사 · 짓기와 같은 바꾸기 — 바꾼 것은 buildFromLayout 이 다시 세어 알린다).
  const L0 = swapUnknownWords(spec.layout as InteriorLayout, S, ask.others ?? []).layout;
  const box = ringBox(L0);
  if (!box || box.x0 !== 0 || box.y0 !== 0 || box.y1 !== L0.map.h - 1 || box.x1 !== L0.map.w - 1) return undefined;
  const covered = coveredKinds(L0, S);
  const tags = o.kit ? run.ctx.project.tilesets[o.tileset]?.structureKits?.find((k) => k.id === o.kit)?.ai?.tags ?? [] : [];
  const kitKinds = kitInteriorKinds(table, tags);
  const found = tierProgramFor(table, o.tier, kitKinds, ask.varietyKey, o.cat);
  if (!found) return undefined;
  const { id: programId, program } = found;
  const mc = tierMapCtx({ tilesetId: tid, roomSpec: S, outside: o, mainKind: program.serves[0]!, varietyKey: ask.varietyKey }, spec, program, table);
  const shapeIx = mixHash(hashText(`${ask.varietyKey}|shape|${programId}`)) % program.shapes.length;
  const shape = program.shapes[shapeIx]!;
  const want = annexRooms(program, shape, covered, mc.mainKind);
  const pick = tierTemplatePicker(mc.templates, mc.mainKind, `${ask.varietyKey}|${shape.id}|around`);
  const tpl = new Map(roomTemplates(tid).map((t) => [t.id, t] as const));

  // ---- 붙일 자리: 모델의 동 · 서 바깥 벽(세로 벽 — 벽면이 없어 모델의 벽 기물이 걸리지 않는다) 바깥에 위에서부터 쌓는다. ----
  // 북쪽에 붙이면 모델의 북벽(창 · 장미창이 걸린 벽)이 안벽이 되어 그 기물이 빠진다(2026-11-17 첫 시도: 창 여덟이 빠졌다). 남쪽은 입구 줄이다.
  // 문은 모델 쪽 그 줄이 바닥이고 칸막이 · 기물이 막지 않는 줄에(세로 벽 문은 세 줄 — 위 두 줄은 벽면).
  const W0 = L0.map.w, H0 = L0.map.h;
  const occ = new Set<string>();
  // 바닥에 서는 벽붙이(고해소 · 책장 — kind wall)도 칸을 차지한다(2026-11-17 r9t: 고해소 앞에 문을 내어 붙인 방이 닿지 않았다). 걸이(hang)는 벽면에만 걸린다.
  for (const q2 of [...list(L0.objects), ...list(L0.wall_items).filter((w) => S.objects[String(w.id)]?.kind === "wall"), ...(L0.landmark ? [L0.landmark as unknown as AnyObj] : [])]) {
    const d = S.objects[String(q2.id)]; if (!d || d.kind === "flat") continue;
    const rep = q2.repeat as AnyObj | undefined; const n = Math.max(1, Number(rep?.count ?? 1) || 1);
    for (let k = 0; k < n; k++) for (let yy = 0; yy < Math.max(1, d.h); yy++) for (let xx = 0; xx < Math.max(1, d.w); xx++) occ.add(`${Number(q2.x) + xx + k * (Number(rep?.dx ?? 0) || 0)},${Number(q2.y) + yy + k * (Number(rep?.dy ?? 0) || 0)}`);
  }
  const partitionCells = new Set<string>();
  for (const w of list<{ path?: Pt[] }>(L0.walls)) {
    const p = w.path ?? [];
    for (let k = 0; k + 1 < p.length; k++) { const [ax, ay] = p[k]!, [bx, by] = p[k + 1]!; const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let s2 = 0; s2 <= n; s2++) partitionCells.add(`${ax + s2 * Math.sign(bx - ax)},${ay + s2 * Math.sign(by - ay)}`); }
  }
  // 모델 안쪽 칸이 바닥인가(벽면 두 줄 · 칸막이가 아니다) — 칸막이 바로 아래 두 줄은 벽면이다.
  const floorAt = (x: number, y: number) => x > 0 && y > 0 && x < W0 - 1 && y < H0 - 1 && !partitionCells.has(`${x},${y}`) && y >= 3 && !partitionCells.has(`${x},${y - 1}`) && !partitionCells.has(`${x},${y - 2}`);
  // 견본 기물(문 · 깔개 빼고)이 서는 칸 — 붙인 방의 문 바로 안쪽 칸이 거기면 그 줄에 문을 내지 않는다(계단을 막거나 빼지 않게).
  const itemCells = (t: { id: string }, x0: number, y0: number) => {
    const out = new Set<string>();
    for (const it of tpl.get(t.id)?.items ?? []) {
      const d = it.t === "o" ? S.objects[it.id] : undefined; if (!d || d.kind === "door" || d.kind === "sidedoor" || d.kind === "flat") continue;
      for (let yy = 0; yy < Math.max(1, d.h); yy++) for (let xx = 0; xx < Math.max(1, d.w); xx++) out.add(`${x0 + it.x + xx},${y0 + it.y + yy}`);
    }
    return out;
  };
  const stack = { E: 1, W: 1 };
  const placedRooms: { room: TierRoom; side: "E" | "W"; x0: number; y0: number; x1: number; y1: number; door: Pt; t: NonNullable<ReturnType<typeof pick>> }[] = [];
  // 다른 맵으로 잇는 계단 방이 먼저(딸린 맵이 그 계단으로 이어진다), 그다음 구성 순서.
  const linkRooms = new Set((program.links ?? []).map((l) => l.from.split("/")[1]));
  const order = [...want.filter((r) => linkRooms.has(r.id)), ...want.filter((r) => !linkRooms.has(r.id))];
  for (const r of order) {
    const t = pick(r); if (!t) continue;
    for (const side of ["E", "W"] as const) {
      const y0 = stack[side], y1 = y0 + t.h - 1;
      if (y1 > H0 - 2) continue;
      // 맵은 60칸까지 — 이 방을 이쪽에 두면 넘으면 다른 쪽(또는 다음 방)
      const sideW = (sd: "E" | "W") => Math.max(0, ...placedRooms.filter((p2) => p2.side === sd).map((p2) => p2.t.w + 1), ...(sd === side ? [t.w + 1] : []));
      if (W0 + sideW("E") + sideW("W") > 60) continue;
      const x = side === "E" ? W0 - 1 : 0, inner = side === "E" ? x - 1 : x + 1, inner2 = side === "E" ? x - 2 : x + 2;
      const ax0 = side === "E" ? W0 : -t.w, own = itemCells(t, ax0, y0), annexIn = side === "E" ? W0 : -1;
      let door: Pt | undefined;
      for (let y = y1; y >= y0 + 2 && !door; y--) if (floorAt(inner, y) && !occ.has(`${inner},${y}`) && !occ.has(`${inner2},${y}`) && !own.has(`${annexIn},${y}`) && [1, 2].every((k) => !partitionCells.has(`${inner},${y - k}`))) door = [x, y];
      if (!door) continue;
      stack[side] = y1 + 2;
      placedRooms.push({ room: r, side, x0: side === "E" ? W0 : -t.w, y0, x1: side === "E" ? W0 + t.w - 1 : -1, y1, door, t });
      break;
    }
  }
  // 둘째 줄: 첫 줄에 못 선 방은 붙인 방 바깥(동쪽 방의 동쪽 · 서쪽 방의 서쪽)에 붙이고 그 방과 문으로 잇는다 — 방끼리는 벽 한 칸을 사이에 둔다.
  const clear = (x0: number, y0: number, x1: number, y1: number) => y0 >= 1 && y1 <= H0 - 2 && x0 >= -60 && x1 <= 120
    && !(x1 >= -1 && x0 <= W0) && placedRooms.every((q2) => x1 + 2 <= q2.x0 || q2.x1 + 2 <= x0 || y1 + 2 <= q2.y0 || q2.y1 + 2 <= y0);
  const spanW = (extra: { x0: number; x1: number }[]) => { const xs = [...placedRooms, ...extra]; const lo = Math.min(0, ...xs.map((q2) => q2.x0 - 1)), hi = Math.max(W0 - 1, ...xs.map((q2) => q2.x1 + 1)); return hi - lo + 1; };
  for (const r of order) {
    if (placedRooms.some((q2) => q2.room.id === r.id)) continue;
    const t = pick(r); if (!t) continue;
    let done = false;
    for (const a of [...placedRooms]) {
      if (done) break;
      const x0 = a.side === "E" ? a.x1 + 2 : a.x0 - 1 - t.w, x1 = x0 + t.w - 1;
      if (spanW([{ x0, x1 }]) > 60) continue;
      const aCells = itemCells(a.t, a.x0, a.y0);
      for (let y0 = Math.max(1, a.y0 - t.h + 3); y0 <= a.y1 - 2 && !done; y0++) {
        const y1 = y0 + t.h - 1;
        if (!clear(x0, y0, x1, y1)) continue;
        const nCells = itemCells(t, x0, y0);
        const wallX = a.side === "E" ? a.x1 + 1 : a.x0 - 1, aSide = a.side === "E" ? a.x1 : a.x0, nSide = a.side === "E" ? x0 : x1;
        for (let y = Math.min(a.y1, y1); y >= Math.max(a.y0 + 2, y0 + 2); y--) {
          if (aCells.has(`${aSide},${y}`) || nCells.has(`${nSide},${y}`)) continue;
          placedRooms.push({ room: r, side: a.side, x0, y0, x1, y1, door: [wallX, y], t }); done = true; break;
        }
      }
    }
  }
  if (!placedRooms.length) return undefined;
  const dx = Math.max(0, 1 - Math.min(0, ...placedRooms.map((p2) => p2.x0))), dy = 0;
  const westW = dx, eastW = Math.max(0, Math.max(...placedRooms.map((p2) => p2.x1)) + 2 - W0);
  const W = W0 + westW + eastW, Hh = H0;
  if (W > 60) return undefined;
  const annex: (Annex & { daises: AnyObj[] })[] = placedRooms.map((p2) => {
    const full = tpl.get(p2.t.id)!, x0 = p2.x0 + dx, y0 = p2.y0 + dy;
    // 견본의 문 · 문 깔개는 뺀다(문은 모델 벽 쪽에 낸다). 창은 방 윗벽이 맵 맨 윗줄(바깥 고리)일 때만 — 쌓인 방 사이 벽은 안벽이다.
    // 새 문 바로 안쪽 칸(드나드는 칸)을 덮는 견본 기물도 뺀다.
    const doorIn: Pt = [p2.side === "E" ? p2.door[0] + 1 : p2.door[0] - 1, p2.door[1]];   // 이 방 쪽 문 앞 칸(첫 줄이면 모델 벽 밖 · 둘째 줄이면 앞 방과의 벽 밖)
    const blocksDoor = (it: { id: string; x: number; y: number }) => { const d = S.objects[it.id]!; if (d.stairs) return false; const ax = p2.x0 + it.x, ay = p2.y0 + it.y; return doorIn[0] >= ax && doorIn[0] < ax + Math.max(1, d.w) && doorIn[1] >= ay && doorIn[1] < ay + Math.max(1, d.h); };
    const items = full.items.filter((it) => it.t === "o" && S.objects[it.id] && !["door", "sidedoor"].includes(S.objects[it.id]!.kind) && it.id !== "door mat"
      && !(/window|stained glass/u.test(it.id) && p2.y0 > 1) && !blocksDoor(it));
    const ko = en(p2.t.kind ?? p2.room.kind);
    return { id: `${p2.room.id}_annex`, kind: p2.t.kind ?? p2.room.kind, template: p2.t.id, x0, y0, x1: p2.x1 + dx, y1: p2.y1 + dy, floor: p2.t.floor ?? full.floor, wall: exteriorWall(S, o, p2.t.wall ?? full.wall) ?? full.wall, side: p2.side, doorAt: [p2.door[0] + dx, p2.door[1] + dy], ko,
      items: items.filter((it) => !["wall", "hang"].includes(S.objects[it.id]!.kind)).map((it) => ({ id: it.id, x: x0 + it.x, y: y0 + it.y, purpose: `${ko} (added)` })),
      wallItems: items.filter((it) => ["wall", "hang"].includes(S.objects[it.id]!.kind)).map((it) => ({ id: it.id, x: x0 + it.x, y: y0 + it.y })),
      daises: full.items.filter((it) => it.t === "d" && S.daises?.[it.id]).map((it) => ({ id: it.id, x: x0 + it.x, y: y0 + it.y, w: it.w ?? 1, h: it.h ?? 1 })) };
  });
  const hall = { id: "__hall" };
  const annexOf = new Map(annex.map((a) => [a.id.replace(/_annex$/u, ""), a] as const));

  // ---- 칸: 방 칸 · 벽 덩이(방 둘레 한 칸 + 갇힌 빈칸) · 바깥. 고리 = 바깥에 닿는 벽 칸, 칸막이 = 나머지 벽 칸. ----
  const roomAt = (x: number, y: number): string | undefined => {
    if (x >= dx + 1 && x <= dx + W0 - 2 && y >= dy + 1 && y <= dy + H0 - 2) return hall.id;   // 모델의 고리 안(칸막이 포함 — 모델의 벽은 아래에서 그대로 쓴다)
    for (const a of annex) if (x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1) return a.id.replace(/_annex$/u, "");
    return undefined;
  };
  const isRoom = (x: number, y: number) => roomAt(x, y) !== undefined;
  const solid = Array.from({ length: Hh }, (_, y) => Array.from({ length: W }, (_, x) => {
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (isRoom(x + a, y + b)) return true;
    return false;
  }));
  // 바깥 = 맵 가장자리에서 벽 덩이가 아닌 칸으로 번진 곳. 갇힌 빈칸은 벽 덩이로 친다.
  const outside = Array.from({ length: Hh }, () => new Array<boolean>(W).fill(false));
  const q: Pt[] = [];
  const seed = (x: number, y: number) => { if (x < 0 || y < 0 || x >= W || y >= Hh || outside[y]![x] || solid[y]![x]) return; outside[y]![x] = true; q.push([x, y]); };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, Hh - 1); }
  for (let y = 0; y < Hh; y++) { seed(0, y); seed(W - 1, y); }
  while (q.length) { const [x, y] = q.pop()!; seed(x + 1, y); seed(x - 1, y); seed(x, y + 1); seed(x, y - 1); }
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (!outside[y]![x]) solid[y]![x] = true;
  const ring = traceRing(solid);
  if (!ring) return undefined;
  const onRing = (x: number, y: number) => solid[y]?.[x] && !isRoom(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, b]) => { const X = x + a!, Y = y + b!; return X < 0 || Y < 0 || X >= W || Y >= Hh || outside[Y]![X]; });
  const L = L0 as InteriorLayout & AnyObj;
  const sh = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
  const shObj = (q2: AnyObj): AnyObj => ({ ...q2, x: Number(q2.x) + dx, y: Number(q2.y) + dy });
  // 모델의 칸막이 끝이 제 바깥 고리 칸 위에 있으면(맵 가장자리라 검사가 넘겼다) 한 칸 당겨 고리에 맞닿게 한다 — 합친 맵에서는 그 칸 밖이 바깥일 수 있다.
  const onOldRing = (p: Pt) => p[0] <= 0 || p[1] <= 0 || p[0] >= W0 - 1 || p[1] >= H0 - 1;
  const trimEnd = (path: Pt[]): Pt[] => {
    const out = path.map((p) => [p[0], p[1]] as Pt);
    for (const [end, nb] of [[0, 1], [out.length - 1, out.length - 2]] as const) {
      const a = out[end], b = out[nb]; if (!a || !b || !onOldRing(a)) continue;
      const step: Pt = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
      if (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) >= 1) out[end] = [a[0] + step[0], a[1] + step[1]];
    }
    return out;
  };
  // 모델의 칸막이 칸(옮긴 좌표) — 그 칸은 모델의 벽 그대로 둔다.
  const modelWall = new Set<string>();
  for (const w of list<{ path?: Pt[]; thickness?: number }>(L.walls)) {
    const p = trimEnd(w.path ?? []).map(sh);   // 당긴 끝 — 옛 고리 칸은 새 칸막이(w_plan)가 맡아 모델의 벽 끝이 거기 닿는다
    for (let k = 0; k + 1 < p.length; k++) { const [ax, ay] = p[k]!, [bx, by] = p[k + 1]!; const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let s2 = 0; s2 <= n; s2++) for (let t = 0; t < (w.thickness === 2 ? 2 : 1); t++) modelWall.add(`${ax + s2 * Math.sign(bx - ax) + (by !== ay ? t : 0)},${ay + s2 * Math.sign(by - ay) + (bx !== ax ? t : 0)}`); }
  }
  const part = (x: number, y: number) => !!solid[y]?.[x] && !isRoom(x, y) && !onRing(x, y) && !modelWall.has(`${x},${y}`);
  // 칸막이: 가로로 이어진 칸(2칸 이상)과 세로로 이어진 칸(2칸 이상) — 양 끝을 한 칸씩 늘려 다른 벽에 닿게. 어느 줄에도 안 든 칸은 한 칸 벽.
  const inRun = new Set<string>();
  const runs: { path: Pt[]; horiz: boolean; cells: Pt[] }[] = [];
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (part(x, y) && !part(x - 1, y)) { let x1 = x; while (part(x1 + 1, y)) x1++; if (x1 > x) { const cells: Pt[] = []; for (let c = x; c <= x1; c++) { cells.push([c, y]); inRun.add(`${c},${y}`); } runs.push({ path: [[x, y], [x1, y]], horiz: true, cells }); } }
  for (let x = 0; x < W; x++) for (let y = 0; y < Hh; y++) if (part(x, y) && !part(x, y - 1)) { let y1 = y; while (part(x, y1 + 1)) y1++; if (y1 > y) { const cells: Pt[] = []; for (let c = y; c <= y1; c++) { cells.push([x, c]); inRun.add(`${x},${c}`); } runs.push({ path: [[x, y], [x, y1]], horiz: false, cells }); } }
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (part(x, y) && !inRun.has(`${x},${y}`)) runs.push({ path: [[x, y], [x, y]], horiz: true, cells: [[x, y]] });
  const materialBelow = (x: number, y: number) => { const r = roomAt(x, y + 1) ?? roomAt(x, y + 2); const a = r && r !== hall.id ? annexOf.get(r) : undefined; return a?.wall ?? L0.outer_wall!.material; };
  const walls: AnyObj[] = [
    ...list(L.walls).map((w) => ({ ...w, path: trimEnd((w.path ?? []) as Pt[]).map(sh) })),
    ...runs.map((r, k) => ({ id: `w_plan_${k}`, material: r.horiz ? materialBelow(r.cells[0]![0], r.cells[0]![1]) : L0.outer_wall!.material, thickness: 1, path: r.path, ...(r.cells.length === 1 ? { stub: true } : {}) })),
  ];
  const wallIdAt = (x: number, y: number, horiz?: boolean) => runs.findIndex((r) => (horiz === undefined || r.horiz === horiz || r.cells.length === 1) && r.cells.some(([cx, cy]) => cx === x && cy === y));
  // 문: 붙인 방마다 모델의 옆 바깥 벽(이제 칸막이)에 하나 — 위에서 고른 칸(세로 벽 문은 세 줄, 맨 아래 줄이 문 칸).
  const doors: AnyObj[] = [...list(L.doors).map(shObj)];
  for (const a of annex) {
    const id = wallIdAt(a.doorAt[0], a.doorAt[1], false);
    if (id >= 0) doors.push({ wall: `w_plan_${id}`, x: a.doorAt[0], y: a.doorAt[1], purpose: `door to the ${a.ko}` });
  }
  const north = 0, east = eastW, west = westW;
  const rooms: AnyObj[] = [
    ...list(L.rooms).map((r) => ({ ...r, at: sh(r.at as Pt) })),
    ...annex.map((a) => ({ id: a.id, at: [Math.floor((a.x0 + a.x1) / 2), a.y1], floor: a.floor, purpose: `${a.ko} (added — ${o.tier} plan)`, role: "side" })),
  ];
  const merged: AnyObj = {
    ...L,
    map: { w: W, h: Hh },
    outer_wall: { ...L0.outer_wall!, path: ring },
    walls, doors, rooms,
    entrance: { x: L0.entrance.x + dx, y: L0.entrance.y + dy },
    ...(L.landmark ? { landmark: shObj(L.landmark as unknown as AnyObj) } : {}),
    objects: [...list(L.objects).map(shObj), ...annex.flatMap((a) => a.items)],
    wall_items: [...list(L.wall_items).map(shObj), ...annex.flatMap((a) => a.wallItems)],
    daises: [...list(L.daises).map(shObj), ...annex.flatMap((a) => a.daises)],
    ...(Array.isArray(L.carpets) ? { carpets: (L.carpets as AnyObj[]).map(shObj) } : {}),
    ...(Array.isArray(L.floor_zones) ? { floor_zones: (L.floor_zones as AnyObj[]).map(shObj) } : {}),
    ...(Array.isArray(L.rails) ? { rails: (L.rails as AnyObj[]).map((r) => ({ ...r, path: ((r.path ?? []) as Pt[]).map(sh) })) } : {}),
  };
  // 붙인 방의 견본 기물은 견본 좌표 그대로 — 검사가 걸리는 것(벽면에 안 닿는 벽 기물 · 겹침)은 짓기가 빼고 알린다. 고치기 횟수는 쓰지 않는다(left 0).
  const mainSpec: PlaceSpec = { ...spec, layout: merged as never, hints: { ...(spec.hints ?? {}), layoutRepairsLeft: 0 } };
  const laid = buildFromLayout(run, mainSpec, S, tid, ask.mapId, o, ask.others ?? []);
  if (!laid.ok) return undefined;
  const mainId = laid.mapIds[0]!;

  // ---- 딸린 맵: 구성대로 짓고 계단끼리 잇는다. 모델이 이 맵의 계단을 이미 다른 맵에 이었으면 그 맵이 그 계단의 맵이다(둘을 만들지 않는다). ----
  const project = () => run.ctx.project;
  const mainMap = (): GameMap => project().maps[mainId]!;
  const stairsOn = (map: GameMap, dir: "down" | "up") => {
    const decl = (map.locations ?? []).find((l) => (l.tags ?? []).includes("interior-layout") && (l.tags ?? []).includes("decl"));
    let objs: { id: string; x: number; y: number; w: number }[] = [];
    try { objs = (JSON.parse(String(decl?.note ?? "{}")).objects ?? []) as typeof objs; } catch { objs = []; }
    return objs.filter((q) => S.objects[q.id]?.stairs === dir);
  };
  const linkedFrom = (x: number, y: number, w: number) => (mainMap().events ?? []).flatMap((e) => (e.x >= x && e.x < x + Math.max(1, w) && (e.y === y || e.y === y + 1) ? transfersOf(e) : []))
    .find((t) => t.mapId !== mainId && project().maps[t.mapId]);
  const built = new Map<string, BuiltTierMap>();
  const reused: string[] = [], missing: string[] = [], linksAdded: string[] = [];
  for (const m of program.maps ?? []) {
    const link = (program.links ?? []).find((l) => l.to.startsWith(`${m.id}/`));
    const fromRoom = link?.from.split("/")[1];
    const fromPiece = link?.from.split("/")[2];
    const dir: "down" | "up" = fromPiece && S.objects[fromPiece]?.stairs === "down" ? "down" : "up";
    // 본채 쪽 계단: 붙인 방에 놓인 그 계단, 아니면 모델의 같은 쪽 계단(아래로 가는 맵이면 모델의 «stairs down»).
    const ann = annex.find((a) => a.id === `${fromRoom}_annex`);
    const mainStair = (() => {
      const all = stairsOn(mainMap(), dir);
      if (ann) { const inAnn = all.find((q) => q.x >= ann.x0 && q.x <= ann.x1 && q.y >= ann.y0 && q.y <= ann.y1); if (inAnn) return inAnn; }
      return all.find((q) => !annex.some((a) => q.x >= a.x0 && q.x <= a.x1 && q.y >= a.y0 && q.y <= a.y1));
    })();
    if (!mainStair) { missing.push(`${m.ko} — no ${dir === "down" ? "stairs down" : "stairs up"} in the main map to reach it`); continue; }
    // 청사진이 이 장소에서 내려가는 장소(던전 · 굴, from = 이 장소)를 두었으면 그 장소가 이 계단의 아래다 — 구성의 지하 맵을 따로 짓지 않는다.
    // 모델이 이 계단을 이미 다른 맵에 이었으면 그 길을 쓴다(먼저 본다 — 다시 지을 때 이어 둔 지하 묘지가 그대로 남는다).
    const already = linkedFrom(mainStair.x, mainStair.y, mainStair.w);
    // 청사진이 이 장소에서 내려가는 장소(던전 · 굴, from = 이 장소 — make_place 가 hints.placeBelow 로 넘긴다)를 두었으면 그 장소가 이 계단의 아래다.
    const below = dir === "down" && !already ? String(spec.hints?.placeBelow ?? "") : "";
    if (below) { reused.push(`the way down — your blueprint's «${below}» is reached from this place: link your stairs down at (${mainStair.x},${mainStair.y}) to it with create_transfer_pair once it is built (no second ${en(m.rooms[0]?.kind ?? m.id)} added)`); continue; }
    if (already) { reused.push(`${en(m.rooms[0]?.kind ?? m.id)} — your stairs at (${mainStair.x},${mainStair.y}) already lead to ${project().maps[already.mapId]?.name ?? already.mapId} (${already.mapId}); kept that link, no second ${dir === "down" ? "way down" : "way up"} added`); continue; }
    const got = buildTierMap(run, mc, m, ask.prev?.maps[m.id] && project().maps[ask.prev.maps[m.id]!] ? ask.prev.maps[m.id] : undefined, `${spec.name} · ${m.ko}`);
    if (typeof got === "string") { missing.push(`${m.ko} — ${got}`); continue; }
    built.set(m.id, got);
    const toPiece = link?.to.split("/")[2] ?? "spiral stairs";
    const far = got.rb.objects.find((q) => q.id === toPiece) ?? got.rb.objects.find((q) => !!S.objects[q.id]?.stairs);
    if (!far) { missing.push(`${m.ko} — its stairs were not placed`); continue; }
    // 잇기는 모델이 쓰는 도구 그대로(create_transfer_pair — 계단 그림 칸에 트리거, 앞 칸에 도착). 그 이벤트는 다시 깔아도 맵에 남는다.
    const pair = run.call("create_transfer_pair", { a: { mapId: mainId, x: mainStair.x, y: mainStair.y }, b: { mapId: got.mapId, x: far.x, y: far.y } });
    if (!pair.ok) { missing.push(`${m.ko} — stairs link: ${String(pair.summary ?? "").slice(0, 160)}`); continue; }
    linksAdded.push(`${en(m.rooms[0]?.kind ?? m.id)} map «${spec.name} · ${m.ko}» (${got.mapId}) — reached by the ${dir === "down" ? "stairs down" : "stairs up"} at (${mainStair.x},${mainStair.y})`);
  }
  const rooms0 = ((spec.layout as InteriorLayout).rooms ?? []).length;
  const roomsNow = rooms0 + annex.length + [...built.values()].reduce((n, b) => n + b.rb.rooms.length, 0);
  const tier: TierState = { program: programId, shape: shapeIx, maps: { main: mainId, ...Object.fromEntries([...built].map(([k, b]) => [k, b.mapId])) } };
  const mapIds = [mainId, ...[...built.values()].map((b) => b.mapId)];
  const added = annex.map((a) => `${a.ko} at (${a.x0},${a.y0})–(${a.x1},${a.y1}), door (${a.doorAt[0]},${a.doorAt[1]})`);
  const head = `${spec.name}: the building outside is ${o.tier}${o.kit ? ` (${o.kit})` : ""}, so your layout is laid as its main hall and the ${o.tier} plan is built around it — ${roomsNow} rooms on ${mapIds.length} map(s). `
    + `Your rooms, walls, doors, landmark and pieces are unchanged; every coordinate moved by (+${dx},+${dy}) because rooms were added ${[north ? "north" : "", east ? "east" : "", west ? "west" : ""].filter(Boolean).join(" and ")} of your outer wall (the entrance is now (${L0.entrance.x + dx},${L0.entrance.y + dy})). `
    + `Added rooms (furnished from this chipset's room samples — dress or change them with review_layout or edit_place layoutPatch): ${added.join("; ")}.`
    + `${linksAdded.length ? ` Added maps: ${linksAdded.join("; ")}.` : ""}${reused.length ? ` Kept: ${reused.join("; ")}.` : ""}${missing.length ? ` Not added: ${missing.join("; ")}.` : ""}`;
  // 기록의 명세는 합친 배치다(make_place/edit_place 가 adoptGrownLayout 으로 바꾼다) — 고침(review_layout · layoutPatch)이 모델이 보는 그림의 좌표로 닿는다.
  const state = { ...(laid.state as Record<string, unknown>), tier, around: { dx, dy, annex: annex.map((a) => ({ id: a.id, kind: a.kind, template: a.template })), layout: merged } };
  return { ...laid, mapIds, summary: `${head} ${laid.summary}`, warnings: [...laid.warnings], missingArt: [...laid.missingArt, ...missing], state };
}

/** 이벤트의 이동 명령들(맵 id · 칸). */
function transfersOf(e: GameMap["events"][number]): { mapId: string; x: number; y: number }[] {
  const out: { mapId: string; x: number; y: number }[] = [];
  for (const page of e.pages ?? []) for (const c of (page.commands ?? []) as readonly AnyObj[]) {
    const t = (c.kind === "transfer" ? c : undefined) as { mapId?: string; x?: number; y?: number } | undefined;
    if (t?.mapId) out.push({ mapId: t.mapId, x: Number(t.x), y: Number(t.y) });
  }
  return out;
}

/** 칠한 칸 덩이의 바깥 윤곽 — 꺾이는 점들(시계 방향, 처음 점으로 닫는다). 덩이가 하나가 아니거나 구멍이 있으면 undefined. */
export function traceRing(solid: boolean[][]): Pt[] | undefined {
  const H = solid.length, W = solid[0]?.length ?? 0;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && solid[y]![x]!;
  // 덩이의 바깥 칸(이웃 8칸 가운데 칠하지 않은 칸이 있는 칸)이 벽 고리다 — 그 칸들을 따라 돈다.
  const edge = (x: number, y: number) => at(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, b]) => !at(x + a!, y + b!));
  let sx = -1, sy = -1;
  for (let y = 0; y < H && sx < 0; y++) for (let x = 0; x < W; x++) if (edge(x, y)) { sx = x; sy = y; break; }
  if (sx < 0) return undefined;
  const dirs: Pt[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const pts: Pt[] = [[sx, sy]];
  let x = sx, y = sy, d = 0, guard = 0;
  do {
    // 오른손 법칙: 오른쪽 → 앞 → 왼쪽 → 뒤 순으로 다음 가장자리 칸을 찾는다(바깥이 늘 왼쪽).
    let moved = false;
    for (const turn of [3, 0, 1, 2]) {
      const nd = (d + turn) % 4; const [ax, ay] = dirs[nd]!;
      if (edge(x + ax, y + ay)) { if (nd !== d) pts.push([x, y]); d = nd; x += ax; y += ay; moved = true; break; }
    }
    if (!moved || ++guard > W * H * 4) return undefined;
  } while (x !== sx || y !== sy);
  pts.push([sx, sy]);
  // 같은 줄의 가운데 점은 지운다
  const out: Pt[] = [];
  for (const p of pts) { if (out.length >= 2) { const a = out[out.length - 2]!, b = out[out.length - 1]!; if ((a[0] === b[0] && b[0] === p[0]) || (a[1] === b[1] && b[1] === p[1])) out.pop(); } if (!out.length || out[out.length - 1]![0] !== p[0] || out[out.length - 1]![1] !== p[1]) out.push(p); }
  return out.length >= 5 ? out : undefined;
}
