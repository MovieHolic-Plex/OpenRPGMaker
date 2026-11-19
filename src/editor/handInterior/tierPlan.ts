// 크기 단(중형·대형·초대형 공간) — 칩셋 사양의 건물 구성 표(`tiers`)를 방 사각형으로 푼다.
// 오너 2026-11-15: 「방1칸짜리를 '소형공간' 이라 치고, '중형공간', '대형공간', '초대형공간' 이렇게도 만들긴해야함.」
// 소형 = 방 견본 하나. 그 위 단은 방 견본 여럿을 «어느 방의 어느 쪽에 붙는가»로 적은 평면이다(가운데 홀 + 양옆만이 아니라 ㄱ자·긴 복도·안뜰 둘레·뒤로 겹친 채).
// 방 크기는 고른 견본이 정하므로(게임 열쇠가 벌을 고른다) 평면은 좌표가 아니라 붙는 자리로 적고, 여기서 사각형으로 푼다 — 그 사각형을 방 짓기 도구의
// layout.placed(rooms.ts composeHandInteriorRooms: 칸막이 1칸 · 문 틈 · 방별 바닥/벽면)가 그대로 받는다. 새 배치기를 옆에 두지 않는다.
import type { HandInteriorConnect, HandInteriorExit } from "./rooms";
import { hashText, mixHash } from "./vignettes";
// 버들항 집 안의 크기 단 구성 표 — scripts/content/beodeul-interiors/rooms.mts 가 tiers.mts 에서 굽는다.
import beodeulTiers from "@/assets/beodeulInteriorTiers.json";

export type TierName = "medium" | "large" | "xlarge";
/** at = "<쪽>:<기준 방>:<맞춤>[:<밀기>]" — 쪽 N·E·S·W, 맞춤 start(위·왼 끝)·center·end(아래·오른 끝), 밀기 = 맞춤 축으로 더 옮길 칸. 첫 방은 at 없음. */
export interface TierRoom {
  readonly id: string;
  /** 방 종류. "$main" = 그 장소의 방 종류(약방·무기점처럼 구성은 같고 주인 방만 다른 건물). */
  readonly kind: string;
  /** 견본을 못박는다(복도·큰 홀·계단참처럼 그 자리에 그 견본이어야 할 때). 없으면 그 종류의 벌을 게임 열쇠가 고른다. */
  readonly template?: string;
  readonly at?: string;
  /** 기준 방과 문으로 잇지 않는다(벽만 맞댄다). */
  readonly closed?: boolean;
  /** 기준 방과의 칸막이를 걷어 한 공간으로 튼다(복도와 홀). */
  readonly open?: boolean;
}
export interface TierMapPlan {
  readonly id: string; readonly ko: string;
  readonly rooms: readonly TierRoom[];
  /** at 으로 생기는 연결 말고 더 낼 문. */
  readonly connect?: readonly (readonly [string, string])[];
  /** 남쪽 바깥문이 나는 방(없으면 다른 맵에서 계단·문으로만 들어온다 — exit 폭 0). */
  readonly exit?: string;
}
/** 맵 사이 길: from·to = "<맵 id>/<방 id>/<기물 id>" — 그 방에 놓인 그 기물(계단·문)의 앞 칸끼리 잇는다. */
export interface TierLink { readonly from: string; readonly to: string }
export interface TierProgram {
  readonly tier: TierName; readonly ko: string;
  /** 이 구성이 맡는 장소의 방 종류(문이 달린 집 킷의 interior 태그 첫 방 · 장소 이름이 가리키는 종류). */
  readonly serves: readonly string[];
  /** 이 갈래(킷 태그 cat:)의 집에만 — 성 본채는 성읍 건물에만, 세관은 항구 건물에만. 없으면 어느 갈래든. */
  readonly cats?: readonly string[];
  /** 본채 평면의 벌들 — 게임 열쇠가 하나를 고른다(같은 건물도 게임마다 모양이 다르다). */
  readonly shapes: readonly TierMapPlan[];
  /** 본채에 딸린 다른 맵(위층·지하·탑·별채)과 그 길. 초대형은 여러 장이다. */
  readonly maps?: readonly TierMapPlan[];
  readonly links?: readonly TierLink[];
}
export interface TierTable {
  readonly programs: Readonly<Record<string, TierProgram>>;
  /** 집 킷의 interior 태그가 방 목록이 아니라 구성 이름일 때(interior:tavern) 그 이름 → 방 종류. */
  readonly kitPrograms?: Readonly<Record<string, string>>;
  /** 방 사이 문: 가로 칸막이(door)·세로 칸막이(sidedoor)의 나무 것·돌 것. */
  readonly doors?: { readonly door?: { readonly wood?: string; readonly stone?: string }; readonly sidedoor?: { readonly wood?: string; readonly stone?: string; readonly log?: string } };
}
const TABLES: Readonly<Record<string, TierTable>> = { beodeul_city: beodeulTiers as unknown as TierTable };
/** 그 칩셋의 크기 단 구성 표(없으면 그 칩셋은 한 방짜리만 짓는다). */
export function tierTableOf(tilesetId: string | undefined): TierTable | undefined { return tilesetId ? TABLES[tilesetId] : undefined; }

export interface PlacedTierRoom { readonly id: string; readonly kind: string; readonly template: string; readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number; readonly floor?: string; readonly wall?: string }
export interface PlacedTierMap { readonly rooms: PlacedTierRoom[]; readonly connect: HandInteriorConnect[]; readonly exit: HandInteriorExit; readonly width: number; readonly height: number }
export interface TierTemplate { readonly id: string; readonly kind?: string; readonly w: number; readonly h: number; readonly floor?: string; readonly wall?: string }

export class TierPlanError extends Error {}

const STONE = /rubble|grey|stone|slumw|brick|rock/u;

/**
 * 평면 한 장을 방 사각형으로. pick(방) = 그 방에 쓸 견본(크기·바닥·벽면). doors = 사양에 있는 문 기물 id(가로 칸막이 door · 세로 칸막이 sidedoor, 나무·돌).
 * 겹치면 맞춤 축으로 조금씩 밀어 본다(견본 크기가 벌마다 달라 한두 칸 어긋날 수 있다). 그래도 안 되면 TierPlanError — 표를 고친다(시험이 모든 구성 × 열쇠를 돈다).
 */
export function placeTierMap(plan: TierMapPlan, pick: (room: TierRoom) => TierTemplate | undefined, doors: { door?: { wood?: string; stone?: string }; sidedoor?: { wood?: string; stone?: string; log?: string } } = {}): PlacedTierMap {
  type R = { id: string; kind: string; template: string; x0: number; y0: number; x1: number; y1: number; floor?: string; wall?: string };
  const done = new Map<string, R>();
  const connect: HandInteriorConnect[] = [];
  const doorFor = (a: R, b: R, side: string): string | undefined => {
    const vertical = side === "N" || side === "S";   // 위·아래 방 = 가로 칸막이의 문
    const lower = vertical ? (a.y0 > b.y0 ? a : b) : a;
    const stone = STONE.test(lower.wall ?? "") || (!vertical && STONE.test(b.wall ?? ""));
    const set = vertical ? doors.door : doors.sidedoor;
    // 옆 칸막이의 끝머리는 그 벽의 재질: 통나무 벽이면 통나무 마구리.
    if (!stone && !vertical && (/^log/u.test(a.wall ?? "") || /^log/u.test(b.wall ?? "")) && doors.sidedoor?.log) return doors.sidedoor.log;
    return stone ? set?.stone ?? set?.wood : set?.wood ?? set?.stone;
  };
  for (const room of plan.rooms) {
    const t = pick(room);
    if (!t) throw new TierPlanError(`${plan.id}: 방 ${room.id}(${room.kind}) 의 견본이 없다`);
    const make = (x0: number, y0: number): R => ({ id: room.id, kind: t.kind ?? room.kind, template: t.id, x0, y0, x1: x0 + t.w - 1, y1: y0 + t.h - 1, ...(t.floor ? { floor: t.floor } : {}), ...(t.wall ? { wall: t.wall } : {}) });
    if (!room.at) { if (done.size) throw new TierPlanError(`${plan.id}: 방 ${room.id} 에 at 이 없다(첫 방만 없어도 된다)`); done.set(room.id, make(0, 0)); continue; }
    const [side, refId, align = "start", pushRaw] = room.at.split(":");
    const ref = done.get(refId ?? "");
    if (!ref || !side || !"NESW".includes(side)) throw new TierPlanError(`${plan.id}: 방 ${room.id} 의 at "${room.at}" — 쪽(N·E·S·W)과 먼저 놓인 방 id 를 적는다`);
    const push = Number(pushRaw ?? 0) || 0;
    const along = (lo: number, hi: number, size: number) => (align === "end" ? hi - size + 1 : align === "center" ? lo + Math.floor((hi - lo + 1 - size) / 2) : lo) + push;
    const base = side === "E" ? make(ref.x1 + 2, along(ref.y0, ref.y1, t.h)) : side === "W" ? make(ref.x0 - 1 - t.w, along(ref.y0, ref.y1, t.h))
      : side === "S" ? make(along(ref.x0, ref.x1, t.w), ref.y1 + 2) : make(along(ref.x0, ref.x1, t.w), ref.y0 - 1 - t.h);
    let placed: R | undefined;
    for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8, 10, -10]) {
      const r = side === "E" || side === "W" ? make(base.x0, base.y0 + d) : make(base.x0 + d, base.y0);
      // 문을 낼 겹침이 있어야 한다: 좌우 방은 벽면 두 줄 아래로 한 줄 이상, 위아래 방은 한 열 이상.
      const overlap = side === "E" || side === "W" ? Math.min(r.y1, ref.y1) - Math.max(r.y0, ref.y0) + 1 - 2 : Math.min(r.x1, ref.x1) - Math.max(r.x0, ref.x0) + 1;
      if (!hits0(r, ref, done) && (room.closed || overlap >= 1)) { placed = r; break; }
    }
    if (!placed) throw new TierPlanError(`${plan.id}: 방 ${room.id} 를 ${refId} 의 ${side} 쪽에 놓을 자리가 없다(다른 방과 겹친다)`);
    done.set(room.id, placed);
    if (!room.closed) { const door = room.open ? undefined : doorFor(placed, ref, side); connect.push({ a: refId!, b: room.id, ...(room.open ? { open: true } : {}), ...(door ? { door } : {}) }); }
  }
  for (const [a, b] of plan.connect ?? []) {
    const A = done.get(a), B = done.get(b);
    if (!A || !B) throw new TierPlanError(`${plan.id}: connect ${a}–${b} 의 방이 없다`);
    const side = A.y1 < B.y0 || B.y1 < A.y0 ? "S" : "E";
    const door = doorFor(side === "S" ? A : (A.x0 < B.x0 ? B : A), side === "S" ? B : (A.x0 < B.x0 ? A : B), side);
    connect.push({ a, b, ...(door ? { door } : {}) });
  }
  const rs = [...done.values()];
  const dx = 1 - Math.min(...rs.map((r) => r.x0)), dy = 1 - Math.min(...rs.map((r) => r.y0));
  const rooms = rs.map((r) => ({ ...r, x0: r.x0 + dx, x1: r.x1 + dx, y0: r.y0 + dy, y1: r.y1 + dy }));
  const bottom = Math.max(...rooms.map((r) => r.y1));
  const exitRoom = plan.exit ? rooms.find((r) => r.id === plan.exit) : undefined;
  if (plan.exit && !exitRoom) throw new TierPlanError(`${plan.id}: exit 방 ${plan.exit} 이 없다`);
  if (exitRoom && exitRoom.y1 !== bottom) throw new TierPlanError(`${plan.id}: 바깥문 방 ${plan.exit} 이 맨 아래에 닿지 않는다(다른 방이 ${bottom - exitRoom.y1}줄 더 내려간다) — 옆방을 end 로 맞추거나 위로 붙인다`);
  const exit: HandInteriorExit = exitRoom ? { room: exitRoom.id } : { room: rooms.find((r) => r.y1 === bottom)!.id, width: 0 };
  return { rooms, connect, exit, width: Math.max(...rooms.map((r) => r.x1)) + 2, height: bottom + 2 };
}

/** 새 방이 기준 방 말고 다른 방과 닿거나(칸막이 1칸 미만) 겹치는가. 기준 방과는 정확히 1칸 떨어져 있다. */
function hits0(r: { x0: number; y0: number; x1: number; y1: number }, ref: { id: string }, done: ReadonlyMap<string, { id: string; x0: number; y0: number; x1: number; y1: number }>): boolean {
  for (const q of done.values()) {
    if (q.id === ref.id) { if (r.x0 <= q.x1 && q.x0 <= r.x1 && r.y0 <= q.y1 && q.y0 <= r.y1) return true; continue; }
    if (r.x0 <= q.x1 + 1 && q.x0 <= r.x1 + 1 && r.y0 <= q.y1 + 1 && q.y0 <= r.y1 + 1) return true;
  }
  return false;
}

/** 집 킷 태그 `interior:<방+방…|구성 이름>` → 방 종류 목록. */
export function kitInteriorKinds(table: TierTable | undefined, tags: readonly string[]): string[] {
  const v = tags.find((t) => t.startsWith("interior:"))?.slice(9);
  if (!v) return [];
  return v.split("+").map((k) => table?.kitPrograms?.[k] ?? k);
}

/**
 * 이 집의 구성: 단(tier)은 문이 달린 집 킷의 것 그대로. 무엇의 집인가는 종류 후보(kinds — 앞이 먼저)에서 그 단에 구성이 있는 첫 종류.
 * 그 종류를 맡는 구성이 여럿이면 게임 열쇠가 고른다. 없으면 undefined(한 방짜리로 짓는다).
 */
export function tierProgramFor(table: TierTable | undefined, tier: string | undefined, kinds: readonly string[], key: string, cat?: string): { id: string; program: TierProgram } | undefined {
  if (!table || !tier) return undefined;
  // 그 단에 그 종류의 구성이 없으면 한 단씩 내려 본다(초대형 킷의 살림집 → 대형 저택, 큰 등대 → 중형 망루). 소형까지 내려가면 한 방짜리.
  const down = ["xlarge", "large", "medium"];
  for (const t of down.slice(Math.max(0, down.indexOf(tier)))) {
    if (!down.includes(tier)) break;
    for (const kind of kinds) {
      const ids = Object.entries(table.programs).filter(([, p]) => p.tier === t && p.serves.includes(kind) && (!p.cats || (!!cat && p.cats.includes(cat)))).map(([id]) => id).sort();
      if (ids.length) { const id = ids[mixHash(hashText(`${key}|tier|${kind}`)) % ids.length]!; return { id, program: table.programs[id]! }; }
    }
  }
  return undefined;
}

/** 방마다 견본 고르기 — 못박은 견본이면 그것, 아니면 그 종류의 벌 가운데 게임 열쇠가 고른 것(한 건물 안에서 같은 벌을 되풀이하지 않는다). */
export function tierTemplatePicker<T extends TierTemplate>(templates: readonly T[], mainKind: string, key: string, prefix = "authored-bd-"): (room: TierRoom) => T | undefined {
  const used = new Set<string>();
  return (room) => {
    if (room.template) return templates.find((t) => t.id === `${prefix}${room.template}` || t.id === room.template);
    const kind = room.kind === "$main" ? mainKind : room.kind;
    const pool = templates.filter((t) => t.kind === kind).sort((a, b) => a.id.localeCompare(b.id));
    if (!pool.length) return undefined;
    const start = mixHash(hashText(`${key}|${room.id}|${kind}`)) % pool.length;
    for (let i = 0; i < pool.length; i++) { const t = pool[(start + i) % pool.length]!; if (!used.has(t.id)) { used.add(t.id); return t; } }
    return pool[start];
  };
}
