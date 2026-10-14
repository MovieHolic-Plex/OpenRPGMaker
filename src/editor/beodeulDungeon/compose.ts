// 버들항 던전 시공기(author_beodeul_dungeon) 순수 계산 — 방 목록 → 타일 배열 + 앵커. 프로젝트를 건드리지 않는다.
//
// 왜(2026-10-14, 사용자 스크린샷 · field-enemy fe1): 던전 층을 시킨 Argon 조수가 참고문서의 「키트를 stamp_object 로 한 개씩 찍는다」를 따라
// 112번 stamp_object + 67번 paint_tiles(호출당 평균 4초·3초)를 절대 좌표로 불렀고, 25분 시간 초과 시점의 맵은 횃불·화로·통·상자·기둥이
// 허공에 뜨고 벽 조각이 바닥 한가운데 서고 상자 이벤트가 천장 칸에 놓인 상태였다. 좌표를 모델이 계산하는 한 이 결함은 줄이는 것이지 없어지지 않는다.
// 이 시공기는 「방 목록(종류·크기·어느 방에서 어느 쪽으로)」만 받고 바닥 마스크 → 천장·벽 앞면 → 장식을 마스크에서 **유도**한다.
//
// 2판(2026-10-14 적대 QA, 같은 날): 1판 출력은 받침은 맞았지만 그림이 나빴다 —
//   · 천장을 테두리 없는 허공 한 칸으로만 깔아 바닥이 검은 허공에 그대로 잘렸다(앞 턱·옆벽 없음, 종이 오린 방) → 천장 오토타일
//     `beodeul_dungeon_ceiling`(변형 던전 렌더와 같은 벽 두께 띠, bake_dungeon_ceiling.py)로 바닥·벽과 닿는 쪽마다 띠를 두른다
//   · 방이 가로 한 줄로만 이어졌다(99×28) → 동서남북 네 쪽 + 화면 비(가로:세로 ≈ 4:3)에 가까운 자리를 고르고, 이웃 방 사이에 고리 통로를 하나 더 낸다
//   · 같은 종류 방이 판박이였다 → 크기 흔들기·모서리 모따기·감방 칸막이, 장식은 종류별 가중 무작위·모둠·벽 사이 간격 흔들기
//   · 계단·아치가 벽 끝(마구리) 칸에 반쯤 걸렸다 → 양옆이 같은 줄 벽인 칸에만
//   · 벽 앞면 위에 천장이 한 줄도 없는 「떠 있는 벽 토막」이 생길 수 있었다 → 배치 간격 규칙 + 검사(stranded-wall)
//   · 서사 앵커가 없었다 → 입구(올라가는 계단)·보스방(입구에서 가장 먼 방)·보물 방·잠긴 문 자리(gate)를 결과로 돌려준다
import { checkGroundSupportForStamp, groundSupportIssues, kitSupportKind } from "@/project/groundSupport";
import type { AutotileGroup, GameMap, StructureKitDef, TilesetDef } from "@/project/types";
import { DungeonComposeError } from "./errors";
import { Grid, WALL_ROWS, hash01, rng, settle, vnoise } from "./grid";
import { addCrossings, carveSewer, layoutBlob, layoutMaze } from "./layouts";
import { DUNGEON_ROOM_KINDS, DUNGEON_TYPES, PROFILES, planMine, planSewer, planTemple, type DungeonRoomKind, type DungeonType } from "./profiles";
import { dressTyped, type DressCtx } from "./dress";

export { DUNGEON_ROOM_KINDS, DUNGEON_TYPES, DungeonComposeError };
export type { DungeonRoomKind, DungeonType };
export type DungeonDir = "N" | "S" | "W" | "E";
export const DUNGEON_DIRS: readonly DungeonDir[] = ["N", "S", "W", "E"];
/** 옛 style 인자(catacomb|castle) — type 의 앞 두 값과 같다. */
export const DUNGEON_STYLES = ["catacomb", "castle"] as const;
export type DungeonStyle = (typeof DUNGEON_STYLES)[number];
export const DUNGEON_SIZES = ["small", "medium", "large"] as const;
export type DungeonSize = (typeof DUNGEON_SIZES)[number];

export interface DungeonRoomInput {
  readonly id?: string;
  readonly kind?: DungeonRoomKind;
  /** 바닥 가로·세로(벽 앞면 3줄은 따로 위에 붙는다). 생략하면 종류별 기본에 시드로 ±1~2 흔든다. */
  readonly w?: number;
  readonly h?: number;
  /** 이 방이 이어지는 앞 방 id(기본: 바로 앞 방). */
  readonly from?: string;
  /** 앞 방의 어느 쪽 문에서 뻗나. 생략하면 층 모양(화면 비)에 맞는 쪽을 고른다. 자리가 막히면 다른 쪽으로 옮긴다. */
  readonly dir?: DungeonDir;
  /** 통로 길이(칸)와 앞 방 가운데에서의 옆 어긋남(칸) — 지정하면 그 값만 시도한다(대칭 신전·곧은 갱도). */
  readonly len?: number;
  readonly shift?: number;
}

export interface DungeonSpec {
  /** 방 목록. 생략하면 size(기본 medium)로 방 구성을 정한다(입구 → … → 보스방, 곁방 갈래). */
  readonly rooms?: readonly DungeonRoomInput[];
  /** 던전 종류. 생략하면 style(옛 인자) → catacomb. */
  readonly type?: DungeonType;
  readonly style?: DungeonStyle;
  readonly seed?: number;
  readonly size?: DungeonSize;
  /** 맵 가로·세로 바람(칸). 방 구성을 정할 때 방 수·크기를 이 넓이에 맞추고, 배치가 이 비율에 가깝게 자란다. */
  readonly width?: number;
  readonly height?: number;
}

interface Rect { x: number; y: number; w: number; h: number }
export interface PlacedRoom extends Rect { id: string; kind: DungeonRoomKind; from: string | null; dir: DungeonDir | null; depth: number }
export interface PlacedCorridor { a: string; b: string; dir: DungeonDir; rect: Rect; loop?: boolean }

const DEFAULT_SIZE: Record<DungeonRoomKind, [number, number]> = {
  entrance: [11, 7], hall: [15, 9], crypt: [12, 8], cell: [12, 7], shrine: [11, 8], boss: [15, 10], storage: [9, 6], vault: [9, 6],
  channel: [28, 11], cistern: [13, 10], pump: [10, 8], cavern: [14, 9], lake: [14, 9], grotto: [10, 8], forge: [11, 8], nave: [17, 19],
  junction: [9, 7], stope: [14, 8], depot: [11, 8],
};
const MARGIN = 2;

const K = {
  ceiling: "bd-pick-aqueduct-sewer-ceiling",
  stairsUp: "bd-pick-aqueduct-sewer-stairs-up-face", stairsDown: "bd-pick-temple-ruins-stairs-down",
  torch: "bd-pick-aqueduct-sewer-torch-wall", banner: "bd-pick-aqueduct-sewer-banner-cult", chains: "bd-pick-aqueduct-sewer-chains",
  nicheSkull: "bd-pick-castle-catacombs-niche-skull", nicheUrn: "bd-pick-castle-catacombs-niche-urn", nicheShroud: "bd-pick-castle-catacombs-niche-shroud",
  archBars: "bd-pick-aqueduct-sewer-arch-bars", archDark: "bd-pick-aqueduct-sewer-arch-dark",
  column: "bd-pick-castle-catacombs-column-cata", columnBroken: "bd-pick-aqueduct-sewer-column-sewer-broken", fallenColumn: "bd-pick-aqueduct-sewer-fallen-column",
  brazier: "bd-pick-aqueduct-sewer-brazier", crate: "bd-pick-aqueduct-sewer-crate",
  crateStack: "bd-pick-aqueduct-sewer-crate-stack", barrel: "bd-pick-aqueduct-sewer-barrel", bucket: "bd-pick-aqueduct-sewer-bucket",
  coffin: "bd-pick-aqueduct-sewer-coffin", candles: "bd-pick-aqueduct-sewer-candles", altar: "bd-pick-castle-catacombs-altar-stone",
  altarCult: "bd-pick-aqueduct-sewer-altar-cult",
  strawBed: "bd-pick-castle-catacombs-straw-bed", skulls: "bd-pick-aqueduct-sewer-skulls", boneHeap: "bd-pick-aqueduct-sewer-bone-heap",
  bones: "bd-pick-aqueduct-sewer-bones", rubble: "bd-pick-aqueduct-sewer-rubble", rubbleCastle: "bd-pick-castle-catacombs-rubble",
  grate: "bd-pick-aqueduct-sewer-grate-floor", ironMaiden: "bd-pick-castle-catacombs-iron-maiden", rack: "bd-pick-castle-catacombs-rack-32",
  anvilTable: "bd-pick-castle-catacombs-anvil-table", lantern: "bd-pick-aqueduct-sewer-lantern-post",
  floorBone: "bd-pick-aqueduct-sewer-floor-bone", floorCell: "bd-pick-castle-catacombs-floor-cell",
} as const;
/** 천장 오토타일(bake_dungeon_ceiling.py). 없는 옛 사본이면 테두리 없는 허공 한 칸으로 물러선다. */
export const DUNGEON_CEILING_GROUPS = ["beodeul_dungeon_ceiling", "beodeul_dungeon_ceiling_b"] as const;


const inter = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** 방이 차지하는 칸: 바닥 + 위 벽 앞면 3줄 + 그 위 천장 한 줄 + 양옆·아래 천장 한 칸(띠). 두 방의 자리는 이 상자끼리 겹치지 않아야 한다. */
const roomFootprint = (r: Rect): Rect => ({ x: r.x - 2, y: r.y - WALL_ROWS - 1, w: r.w + 4, h: r.h + WALL_ROWS + 2 });
/** 통로: 바닥 + 가로 통로는 위 벽 앞면 3줄·천장 1줄, 세로 통로는 양옆 천장 한 칸. */
const corridorFootprint = (c: PlacedCorridor): Rect => c.dir === "N" || c.dir === "S"
  ? { x: c.rect.x - 1, y: c.rect.y, w: c.rect.w + 2, h: c.rect.h }
  : { x: c.rect.x, y: c.rect.y - WALL_ROWS - 1, w: c.rect.w, h: c.rect.h + WALL_ROWS + 2 };
const opposite = (d: DungeonDir): DungeonDir => (d === "N" ? "S" : d === "S" ? "N" : d === "W" ? "E" : "W");

// ---------- 0. 방 구성(방 목록이 없을 때) ----------

/** size·바라는 넓이 → 방 목록. 입구 → 큰 홀 → 갈래(묘실·감방·창고·제단) → 보스방, 보물 방은 보스방 곁. */
export function planDungeonRooms(spec: DungeonSpec): DungeonRoomInput[] {
  const type = spec.type ?? spec.style ?? "catacomb";
  if (type === "sewer") return planSewer(spec);
  if (type === "temple") return planTemple(spec);
  if (type === "mine") return planMine(spec);
  const random = rng((spec.seed ?? 7) * 7919 + 13);
  const area = spec.width && spec.height ? spec.width * spec.height : 0;
  const bySize = { small: 4, medium: 6, large: 9 } as const;
  let n: number = bySize[spec.size ?? "medium"];
  if (area) n = Math.max(3, Math.min(11, Math.round(area / 260)));
  const pool: DungeonRoomKind[] = ["crypt", "cell", "storage", "hall", "shrine", "crypt", "cell", "hall", "storage"];
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  const rooms: DungeonRoomInput[] = [{ id: "entrance", kind: "entrance" }, { id: "hall", kind: "hall" }];
  const middle = Math.max(0, n - (n >= 5 ? 4 : 3));
  for (let i = 0; i < middle; i += 1) {
    const kind = pool[i % pool.length]!;
    // 갈래: 셋째 방부터 절반쯤은 큰 홀에서 따로 뻗는다(한 줄 사슬이 아니라 나무 모양).
    const from = i > 0 && random() < 0.45 ? "hall" : undefined;
    rooms.push({ id: `${kind}${i + 1}`, kind, ...(from ? { from } : {}) });
  }
  rooms.push({ id: "boss", kind: "boss" });
  if (n >= 5) rooms.push({ id: "vault", kind: "vault", from: "boss" });
  return rooms.slice(0, Math.max(n, 2));
}

// ---------- 1. 방 배치 ----------

export interface DungeonLayout { rooms: PlacedRoom[]; corridors: PlacedCorridor[]; width: number; height: number; notes: string[]; grid?: Grid }

export function layoutDungeon(spec: DungeonSpec): DungeonLayout {
  const inputs = spec.rooms?.length ? spec.rooms : planDungeonRooms(spec);
  if (inputs.length < 1) throw new DungeonComposeError("rooms 에 방이 하나 이상 있어야 한다.", "invalid-args");
  if (inputs.length > 12) throw new DungeonComposeError("방은 12개까지다 — 한 층을 둘로 나눠라.", "invalid-args");
  const random = rng((spec.seed ?? 7) * 2654435761 + 1);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
  const aspect = spec.width && spec.height ? spec.width / spec.height : 1.35;
  const placed: PlacedRoom[] = [];
  const corridors: PlacedCorridor[] = [];
  const layoutNotes: string[] = [];
  const used = new Map<string, Set<DungeonDir>>();
  const ids = new Set<string>();
  const jitter = (base: number, spread: number) => base + Math.floor(random() * (spread * 2 + 1)) - spread;
  inputs.forEach((input, index) => {
    const kind: DungeonRoomKind = input.kind ?? (index === 0 ? "entrance" : "hall");
    const [dw, dh] = DEFAULT_SIZE[kind];
    const w = clamp(input.w ?? jitter(dw, input.shift !== undefined ? 0 : 2), 6, 40), h = clamp(input.h ?? jitter(dh, input.shift !== undefined ? 0 : 1), 5, 22);
    let id = (input.id ?? `${kind}${index + 1}`).trim() || `${kind}${index + 1}`;
    while (ids.has(id)) id = `${id}_${index + 1}`;
    ids.add(id);
    if (index === 0) {
      placed.push({ id, kind, x: 0, y: 0, w, h, from: null, dir: null, depth: 0 });
      used.set(id, new Set());
      return;
    }
    // from 이 없으면 바로 앞 방이 먼저지만, 층이 한쪽으로만 길어지면 그 앞 두 방에도 붙여 본다(점수에 작은 벌점) — 사슬이 뱀처럼 늘어지지 않게.
    let parents: PlacedRoom[];
    if (input.from) {
      const p = placed.find((room) => room.id === input.from) ?? [...placed].reverse().find((room) => room.kind === input.from);
      if (!p) throw new DungeonComposeError(`방 ${id} 의 from '${input.from}' 가 앞에 나온 방 id 가 아니다(앞 방: ${placed.map((r) => r.id).join(", ")}).`, "invalid-args");
      parents = [p];
    } else parents = placed.slice(-3).reverse().filter((p, k) => k === 0 || (p.kind !== "boss" && p.kind !== "vault"));
    type Best = { room: PlacedRoom; corridor: PlacedCorridor; score: number; parent: PlacedRoom };
    const search = (list: readonly PlacedRoom[], strict = true): Best | null => {
    let best: Best | null = null;
    for (const [rank, parent] of list.entries()) {
    const taken = used.get(parent.id)!;
    const dirs = (input.dir ? [input.dir, ...DUNGEON_DIRS.filter((d) => d !== input.dir)] : [...DUNGEON_DIRS]).filter((d) => !taken.has(d));
    for (const dir of dirs) {
      for (const shift of strict && input.shift !== undefined ? [input.shift] : [0, 2, -2, 4, -4, 6, -6, 9, -9]) {
        // 세로 통로는 5칸이 먼저(벽 앞면 3줄 위에 천장 두 줄 — 한 줄이면 두 방 사이 벽이 실선처럼 얇다), 가로 통로는 4칸.
        for (const len of strict && input.len ? [input.len] : dir === "N" || dir === "S" ? [5, 6, 4] : [4, 5, 3, 6]) {
          const attempt = attemptPlace(parent, { id, kind, w, h }, dir, shift, len);
          if (!attempt) continue;
          if (clashes(attempt.room, attempt.corridor, parent.id, placed, corridors)) continue;
          // 점수: 바람 비율에 가까운 작은 바깥 상자 + 시드 흔들기. 주어진 dir 은 크게 앞선다.
          const box = boundsOf([...placed, attempt.room]);
          const ratio = box.w / Math.max(1, box.h);
          let score = box.w * box.h * (1 + Math.abs(Math.log(ratio / aspect)) * 1.6) + random() * 60 + Math.abs(shift) * 3 + Math.abs(len - (dir === "N" || dir === "S" ? 5 : 4)) * 6;
          score *= 1 + rank * 0.18;
          if (input.dir && dir === input.dir) score -= 1e6;
          if (!best || score < best.score) best = { ...attempt, score, parent };
          break;
        }
      }
    }
    }
    return best;
    };
    let chosen = search(parents);
    if (!chosen && (input.shift !== undefined || input.len)) { chosen = search(parents, false); if (chosen) layoutNotes.push(`방 ${id}: 지정한 len/shift 로는 자리가 없어 가까운 값으로 옮겼다.`); }
    if (!chosen) {
      // 바란 방에 자리가 없으면(네 쪽이 다 쓰였거나 겹침) 다른 방에 붙이고 알린다 — 층 전체를 거부하는 것보다 낫다.
      chosen = search(placed.filter((p) => !parents.includes(p) && p.kind !== "vault"));
      if (chosen) layoutNotes.push(`방 ${id}: ${parents.map((p) => p.id).join("/")} 에 이을 자리가 없어 ${chosen.parent.id} 에 이었다.`);
    }
    if (!chosen) throw new DungeonComposeError(`방 ${id} 를 이을 자리가 없다(모든 방의 네 쪽 문이 다 쓰였거나 다른 방과 겹친다). 방 수·크기를 줄여라.`, "layout-failed");
    const parent = chosen.parent;
    used.get(parent.id)!.add(chosen.corridor.dir);
    placed.push({ ...chosen.room, from: parent.id, dir: chosen.corridor.dir, depth: parent.depth + 1 });
    used.set(id, new Set<DungeonDir>([opposite(chosen.corridor.dir)]));
    corridors.push({ ...chosen.corridor, a: parent.id });
  });
  // 고리 통로: 부모·자식이 아닌 두 방이 나란히 가까우면 하나(큰 층은 둘) 더 잇는다 — 막다른 사슬만 있는 층을 피한다.
  const wantLoops = placed.length >= 7 ? 2 : placed.length >= 4 ? 1 : 0;
  let loops = 0;
  const pairs: [PlacedRoom, PlacedRoom][] = [];
  for (let i = 0; i < placed.length; i += 1) for (let j = i + 1; j < placed.length; j += 1) {
    const a = placed[i]!, b = placed[j]!;
    if (a.from === b.id || b.from === a.id) continue;
    if (a.kind === "vault" || b.kind === "vault" || a.kind === "boss" || b.kind === "boss") continue;   // 보스·보물은 한 길로만
    pairs.push([a, b]);
  }
  pairs.sort(() => random() - 0.5);
  for (const [a, b] of pairs) {
    if (loops >= wantLoops) break;
    const c = loopCorridor(a, b, used);
    if (!c) continue;
    if (placed.some((r) => r.id !== a.id && r.id !== b.id && (inter(corridorFootprint(c), roomFootprint(r)))) || corridors.some((o) => inter(corridorFootprint(c), corridorFootprint(o)))) continue;
    corridors.push(c);
    used.get(a.id)!.add(c.dir); used.get(b.id)!.add(opposite(c.dir));
    loops += 1;
  }
  // 좌표를 0 기준 바깥 여백 MARGIN 으로 옮기고 맵 크기를 정한다(맨 위는 벽 앞면 3줄 + 천장 띠 한 줄까지).
  const box = boundsOf(placed, corridors);
  const dx = MARGIN - box.x, dy = MARGIN - box.y;
  const move = <T extends Rect>(r: T): T => ({ ...r, x: r.x + dx, y: r.y + dy });
  return {
    rooms: placed.map(move),
    corridors: corridors.map((c) => ({ ...c, rect: move(c.rect) })),
    width: box.w + MARGIN * 2,
    height: box.h + MARGIN * 2,
    notes: layoutNotes,
  };
}

function boundsOf(rooms: readonly Rect[], corridors: readonly PlacedCorridor[] = []): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const take = (r: Rect, north: number) => { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y - north); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); };
  for (const r of rooms) take(r, WALL_ROWS + 1);
  for (const c of corridors) take(c.rect, c.dir === "E" || c.dir === "W" ? WALL_ROWS + 1 : 0);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function clashes(room: Rect, corridor: PlacedCorridor, parentId: string, placed: readonly PlacedRoom[], corridors: readonly PlacedCorridor[]): boolean {
  const roomFp = roomFootprint(room), corFp = corridorFootprint(corridor);
  return placed.some((other) => other.id !== parentId && (inter(roomFp, roomFootprint(other)) || inter(corFp, roomFootprint(other))))
    || corridors.some((c) => inter(roomFp, corridorFootprint(c)) || inter(corFp, corridorFootprint(c)));
}

/** 앞 방(parent) 의 dir 쪽으로 len 칸 통로를 내고 그 끝에 방을 단다. 세로 통로는 4칸 이상(벽 앞면 3줄 + 천장 1줄이 통로 옆에 선다). */
function attemptPlace(parent: Rect, child: { id: string; kind: DungeonRoomKind; w: number; h: number }, dir: DungeonDir, shift: number, len: number):
  { room: PlacedRoom; corridor: PlacedCorridor } | null {
  const { w, h } = child;
  const base = { ...child, from: null, dir: null, depth: 0 };
  if (dir === "N" || dir === "S") {
    if (len < 4) return null;
    const x = parent.x + Math.floor(parent.w / 2) - Math.floor(w / 2) + shift;
    const y = dir === "N" ? parent.y - len - h : parent.y + parent.h + len;
    // 통로 입구 양옆에 벽이 3칸(좁은 방은 2칸) 이상 남게 — 방 모서리에 1칸짜리 벽 토막이 서지 않게.
    let lo = Math.max(parent.x + 3, x + 3), hi = Math.min(parent.x + parent.w - 3, x + w - 3);
    if (hi - lo < 2) { lo = Math.max(parent.x + 2, x + 2); hi = Math.min(parent.x + parent.w - 2, x + w - 2); }
    const span = hi - lo, cw = Math.min(3, span);
    if (cw < 2) return null;
    const cx = lo + Math.floor((span - cw) / 2);
    const cy = dir === "N" ? y + h : parent.y + parent.h;
    return { room: { ...base, x, y }, corridor: { a: "", b: child.id, dir, rect: { x: cx, y: cy, w: cw, h: len } } };
  }
  const y = parent.y + Math.floor(parent.h / 2) - Math.floor(h / 2) + shift;
  // 가로 통로 바닥은 두 방의 바닥 줄 안에 든다(맨 윗줄은 벽 앞면과 이어지게 비켜 둔다).
  const lo = Math.max(parent.y + 1, y + 1), hi = Math.min(parent.y + parent.h - 1, y + h - 1);
  const span = hi - lo, ch = Math.min(3, span);
  if (ch < 2) return null;
  const cy = lo + Math.floor((span - ch) / 2);
  if (dir === "W") {
    const x = parent.x - len - w;
    return { room: { ...base, x, y }, corridor: { a: "", b: child.id, dir, rect: { x: x + w, y: cy, w: len, h: ch } } };
  }
  const x = parent.x + parent.w + len;
  return { room: { ...base, x, y }, corridor: { a: "", b: child.id, dir, rect: { x: parent.x + parent.w, y: cy, w: len, h: ch } } };
}

/** 이미 놓인 두 방 사이 곧은 고리 통로(쓰지 않은 쪽 문끼리, 길이 3~8). */
function loopCorridor(a: PlacedRoom, b: PlacedRoom, used: Map<string, Set<DungeonDir>>): PlacedCorridor | null {
  const free = (r: PlacedRoom, d: DungeonDir) => !used.get(r.id)!.has(d);
  // 가로: a 가 왼쪽
  for (const [l, r] of [[a, b], [b, a]] as const) {
    const gap = r.x - (l.x + l.w);
    if (gap >= 3 && gap <= 8 && free(l, "E") && free(r, "W")) {
      const lo = Math.max(l.y + 1, r.y + 1), hi = Math.min(l.y + l.h - 1, r.y + r.h - 1);
      if (hi - lo >= 3) {
        const cy = lo + Math.floor((hi - lo - 3) / 2);
        return { a: l.id, b: r.id, dir: "E", rect: { x: l.x + l.w, y: cy, w: gap, h: 3 }, loop: true };
      }
    }
    const vgap = r.y - (l.y + l.h);
    if (vgap >= 4 && vgap <= 8 && free(l, "S") && free(r, "N")) {
      const lo = Math.max(l.x + 3, r.x + 3), hi = Math.min(l.x + l.w - 3, r.x + r.w - 3);
      if (hi - lo >= 3) {
        const cx = lo + Math.floor((hi - lo - 3) / 2);
        return { a: l.id, b: r.id, dir: "S", rect: { x: cx, y: l.y + l.h, w: 3, h: vgap }, loop: true };
      }
    }
  }
  return null;
}

// ---------- 2. 타일 ----------

export interface DungeonCompose {
  readonly type: DungeonType;
  readonly width: number;
  readonly height: number;
  readonly lower: number[];
  readonly upper: number[];
  readonly rooms: PlacedRoom[];
  readonly corridors: PlacedCorridor[];
  readonly entrance: { x: number; y: number };
  readonly stairsUp: { x: number; y: number; front: { x: number; y: number } } | null;
  readonly stairsDown: { x: number; y: number } | null;
  /** 서사 앵커: 보스방(입구에서 가장 깊은 방 또는 kind boss)·보물 방·잠긴 문 자리(보스·보물 방으로 들어가는 통로 한가운데 칸). */
  readonly anchors: { boss: string | null; treasure: string | null; gate: { x: number; y: number; to: string } | null };
  readonly spots: Record<string, { x: number; y: number }[]>;
  readonly picture: string[];
  readonly liquid: { readonly kind: "water" | "lava" | null; readonly cells: number; readonly bridges: number };
  readonly counts: Record<string, number>;
  readonly warnings: string[];
}

export function composeDungeon(ts: TilesetDef, spec: DungeonSpec): DungeonCompose {
  const type: DungeonType = spec.type ?? spec.style ?? "catacomb";
  const profile = PROFILES[type];
  const specT: DungeonSpec = { ...spec, type };
  const layout = profile.grammar === "maze" ? layoutMaze(specT) : profile.grammar === "blob" ? layoutBlob(specT, profile) : layoutDungeon(specT);
  const seed = spec.seed ?? 7;
  const random = rng(seed);
  const kits = new Map<string, StructureKitDef>((ts.structureKits ?? []).map((kit) => [kit.id, kit]));
  const kit = (id: string): StructureKitDef => {
    const found = kits.get(id);
    if (!found) throw new DungeonComposeError(`이 프로젝트의 버들항 타일셋에 던전 키트 ${id} 가 없다 — 버들항 장소 조각(beodeul-picks-dungeon)이 들어 있는 타일셋이 필요하다.`, "kit-missing");
    return found;
  };
  const hasKit = (id: string) => kits.has(id);
  const { width: W, height: H, rooms, corridors } = layout;
  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const lower = new Array<number>(W * H).fill(-1);
  const upper = new Array<number>(W * H).fill(-1);
  const g = layout.grid ?? new Grid(W, H);
  const floorMask = g.floor;
  const roomAt = g.roomAt;
  const liquid = g.liquid;
  const bridge = g.bridge;
  const warnings: string[] = [...layout.notes];
  if (layout.grid && spec.rooms?.length) warnings.push(`${profile.label} 은 방 목록(rooms)을 받지 않는다 — 방은 코드가 정한다(rooms 무시). 방 수·크기는 size·width·height 로 고른다.`);
  if (!layout.grid) {
    const odd = [...new Set(rooms.filter((r) => !profile.roomKinds.includes(r.kind)).map((r) => r.kind))];
    if (odd.length) warnings.push(`방 종류 ${odd.join("·")} 은(는) ${profile.label}(${type}) 에 맞는 종류가 아니다 — 그 방은 장식이 비어 있다. ${type} 의 방 종류: ${profile.roomKinds.join(" ")}.`);
  }

  // ---- 바닥 마스크: 통로 → 방(방 모양 흔들기: 모따기·감방 칸막이) ----
  const markRect = (r: Rect, roomIndex: number, v = 1) => {
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (!inb(x, y)) continue;
      floorMask[idx(x, y)] = v; roomAt[idx(x, y)] = v ? roomIndex : -1;
      if (!v) { liquid[idx(x, y)] = 0; bridge[idx(x, y)] = 0; }
    }
  };
  if (!layout.grid) {
    for (const c of corridors) markRect(c.rect, -1);
    rooms.forEach((room, i) => markRect(room, i));
  }
  // 통로가 방에 닿는 문 칸(방 안쪽 첫 칸 + 한 칸 더) — 모따기·칸막이·물건이 막지 않는다.
  const doorstep = g.protect;
  for (const c of corridors) {
    const r = c.rect;
    const mark = (x: number, y: number) => { if (inb(x, y)) doorstep[idx(x, y)] = 1; };
    for (let k = -1; k <= 2; k += 1) {
      if (c.dir === "N" || c.dir === "S") for (let x = r.x - 1; x <= r.x + r.w; x += 1) { mark(x, r.y - 1 - k); mark(x, r.y + r.h + k); }
      else for (let y = r.y - 1; y <= r.y + r.h; y += 1) { mark(r.x - 1 - k, y); mark(r.x + r.w + k, y); }
    }
  }
  /** 열린 칸(걷는 바닥 + 액체 + 다리) — 천장·벽 앞면이 이것에서 유도된다. */
  const isFloor = (x: number, y: number) => inb(x, y) && floorMask[idx(x, y)] === 1;
  /** 걸을 수 있는 바닥(액체 아님, 다리 포함). 장식·방 안 칸 고르기는 이것만 본다. */
  const isWalk = (x: number, y: number) => inb(x, y) && floorMask[idx(x, y)] === 1 && liquid[idx(x, y)] === 0;
  const notchable = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) if (!inb(x, y) || doorstep[idx(x, y)]) return false;
    return true;
  };
  const partitions: { room: string; x: number; y: number; h: number }[] = [];
  (layout.grid ? [] : rooms).forEach((r, i) => {
    const rs = rng(seed * 31 + i * 977 + 5);
    // 모서리 모따기: 큰 방의 모서리 한두 곳을 1~2칸 깎는다(벽이 한 단 앞으로 나온다). 같은 종류 방이 판박이가 되지 않게.
    if (r.w >= 10 && r.h >= 7 && r.kind !== "cell") {
      const corners: [number, number, boolean][] = [[r.x, r.y, true], [r.x + r.w, r.y, true], [r.x, r.y + r.h, false], [r.x + r.w, r.y + r.h, false]];
      let cut = 0;
      for (const [cx, , top] of corners.sort(() => rs() - 0.5)) {
        if (cut >= (r.w >= 14 ? 2 : 1) || rs() < 0.35) continue;
        const nw = rs() < 0.5 ? 1 : 2, nh = top ? 1 + (rs() < 0.4 ? 1 : 0) : 1;
        const x0 = cx === r.x ? r.x : r.x + r.w - nw, y0 = top ? r.y : r.y + r.h - nh;
        if (!notchable(x0 - 1, y0 - 1, nw + 2, nh + 2)) continue;
        markRect({ x: x0, y: y0, w: nw, h: nh }, -1, 0);
        cut += 1;
      }
    }
    // 감방: 북쪽 벽에 붙은 칸막이(천장 1칸 폭, 3줄)로 폭 3 감방을 나눈다 — 칸막이는 벽 앞면 3줄로 선다.
    if (r.kind === "cell" && r.w >= 9 && r.h >= 6) {
      for (let x = r.x + 3; x < r.x + r.w - 2; x += 4) {
        if (!notchable(x, r.y, 1, 3)) continue;
        markRect({ x, y: r.y, w: 1, h: 3 }, -1, 0);
        partitions.push({ room: r.id, x, y: r.y, h: 3 });
      }
    }
  });

  // ---- 액체(수로·저수조) + 벽 두께·연결 정리: 물·용암은 걸을 수 없는 열린 칸, 갈라진 바닥은 다리로 잇는다. ----
  let bridgeCount = 0;
  const entranceStart = ((): number => {
    const e = rooms[0]!;
    for (let r = 0; r < 12; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      const x = e.x + Math.floor(e.w / 2) + dx, y = e.y + e.h - 2 + dy;
      if (g.walk(x, y)) return idx(x, y);
    }
    throw new DungeonComposeError("입구 방에 걸을 수 있는 바닥이 없다.", "no-entrance");
  })();
  if (type === "sewer") carveSewer(g, rooms, seed);
  if (profile.liquid || layout.grid) {
    const st = settle(g, entranceStart, rng(seed * 313 + 7));
    bridgeCount += st.bridges;
    if (st.removed) warnings.push(`닿지 않는 바닥 ${st.removed}칸을 막았다(액체로 갈라져 다리를 놓을 수 없는 조각).`);
  }
  if (type === "sewer") bridgeCount += addCrossings(g, rooms, seed);

  // ---- 벽 앞면 = 바닥 북쪽 변 위 세 줄(위에 천장이 한 줄 이상 남게). 둘이면 두 줄. ----
  const wallB = new Int8Array(W * H).fill(-1);
  const wallH = new Int8Array(W * H).fill(0);
  const stranded: string[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!isFloor(x, y) || isFloor(x, y - 1)) continue;
    let run = 0;
    while (y - 1 - run >= 0 && !isFloor(x, y - 1 - run) && run < WALL_ROWS + 1) run += 1;
    const h = Math.min(WALL_ROWS, run >= WALL_ROWS + 1 ? WALL_ROWS : run - 1);
    if (h < 2) { stranded.push(`(${x},${y})`); continue; }
    for (let b = 0; b < h; b += 1) { wallB[idx(x, y - 1 - b)] = b; wallH[idx(x, y - 1 - b)] = h; }
  }
  if (stranded.length) throw new DungeonComposeError(`시공기 내부 오류(stranded-wall): 벽 앞면 위에 천장이 남지 않는 칸 ${stranded.length}곳 ${stranded.slice(0, 4).join(" ")} — 방 사이 세로 간격이 4칸보다 좁다.`, "stranded-wall");
  const isWall = (x: number, y: number) => inb(x, y) && wallB[idx(x, y)]! >= 0;
  const face = profile.face;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const b = wallB[idx(x, y)]!;
    if (b < 0) continue;
    const h = wallH[idx(x, y)]!;
    const rows = kit(h >= 3 ? face.h3 : face.h2).rows;
    const row = rows[(h >= 3 ? 3 : 2) - 1 - b]!.tiles;
    const left = x > 0 && wallB[idx(x - 1, y)] === b, right = x + 1 < W && wallB[idx(x + 1, y)] === b;
    lower[idx(x, y)] = left && right ? row[1]! : !left && right ? row[0]! : left && !right ? row[2]! : row[1]!;
  }

  // ---- 천장: 바닥·벽이 아닌 칸. 오토타일 47 모양(벽 두께 띠), 결 두 가지를 칸마다 섞는다. ----
  const groups = DUNGEON_CEILING_GROUPS.map((id) => (ts.autotileGroups ?? []).find((g) => g.id === id)).filter((g): g is AutotileGroup => !!g);
  const voidTile = kit(K.ceiling).rows[1]!.tiles[1]!;
  const isOpen = (x: number, y: number) => inb(x, y) && (floorMask[idx(x, y)] === 1 || wallB[idx(x, y)]! >= 0);
  let rimmed = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (isOpen(x, y)) continue;
    if (!groups.length) { lower[idx(x, y)] = voidTile; continue; }
    let m = 0;
    const bits: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
    for (const [dx, dy, bit] of bits) if (!isOpen(x + dx, y + dy)) m |= bit;
    const g = groups[groups.length > 1 && hash01(x, y, seed) < 0.5 ? 1 : 0]!;
    lower[idx(x, y)] = g.variantMap[String(m)] ?? voidTile;
    if (m !== 255) rimmed += 1;
  }
  if (!groups.length) warnings.push("이 타일셋 사본에 천장 테두리 오토타일(beodeul_dungeon_ceiling)이 없어 천장을 테두리 없는 허공으로 깔았다 — 프로젝트를 다시 열면 번들 꼬리가 붙는다.");

  // ---- 바닥 칸: 종류별 바닥 키트(2×2·3×3 무늬) + 잡음 덩이 변형 + 칸마다 흩뿌림 + 물가 바닥. 액체·다리는 따로 칠한다. ----
  const fl = profile.floor;
  const tileOf = (id: string, x: number, y: number): number => { const rows = kit(id).rows; return rows[y % rows.length]!.tiles[x % rows[0]!.tiles.length]!; };
  const nearLiquid = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (inb(x + dx, y + dy) && (liquid[idx(x + dx, y + dy)] || bridge[idx(x + dx, y + dy)])) return true;
    return false;
  };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!isWalk(x, y) || bridge[idx(x, y)]) continue;
    const ri = roomAt[idx(x, y)]!;
    const r = ri >= 0 ? rooms[ri]! : null;
    let id: string = fl.base;
    const byKind = r ? fl.byKind?.[r.kind] : undefined;
    if (r?.kind === "cell" && hasKit(K.floorCell) && y < r.y + 3) id = K.floorCell;
    else if (byKind && hasKit(byKind)) id = byKind;
    else {
      for (const [k, p] of fl.patches.entries()) if (hasKit(p.kit) && vnoise(x, y, p.scale ?? 4, seed * 11 + k * 37) > p.at) id = p.kit;
      for (const [k, sc] of (fl.scatter ?? []).entries()) if (sc.p > 0 && hasKit(sc.kit) && hash01(x, y, seed * 17 + k) < sc.p) id = sc.kit;
    }
    if (fl.shore && hasKit(fl.shore) && nearLiquid(x, y) && hash01(x, y, seed + 71) < 0.8) id = fl.shore;
    lower[idx(x, y)] = tileOf(id, x, y);
  }
  // 광산: 갱도 한가운데 줄을 널판 선로 바닥으로(입구·갈림 방은 가로지르는 줄, 그 밖 방은 통로 구간만). 선로 그림이 따로 없어 널판 바닥이 임시다.
  if (type === "mine" && hasKit("bd-pick-aqueduct-sewer-floor-plank")) {
    const plank = "bd-pick-aqueduct-sewer-floor-plank";
    const paintRow = (y: number, x0: number, x1: number) => { for (let x = x0; x < x1; x += 1) if (isWalk(x, y) && !bridge[idx(x, y)]) lower[idx(x, y)] = tileOf(plank, x, y); };
    for (const c of corridors) {
      if (c.dir !== "E" && c.dir !== "W") continue;
      const ty = c.rect.y + Math.floor(c.rect.h / 2);
      paintRow(ty, c.rect.x, c.rect.x + c.rect.w);
      for (const id of [c.a, c.b]) { const rm = rooms.find((q) => q.id === id); if (rm && (rm.kind === "junction" || rm.kind === "entrance")) paintRow(rm.y + Math.floor(rm.h / 2), rm.x, rm.x + rm.w); }
    }
  }
  // 액체: 물은 운하 오토타일(돌 둑 테두리), 용암은 용암 키트 무늬. 다리 칸 밑도 같은 액체로 이어 보이게 마스크에 센다.
  const liqLike = (x: number, y: number) => inb(x, y) && (liquid[idx(x, y)] === 1 || bridge[idx(x, y)] === 1);
  const canal = (ts.autotileGroups ?? []).find((a) => a.id === "beodeul_canal_lake_47");
  const LAVA_KIT = "bd-pick-volcano-cave-lava-strip";
  let liquidCells = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!liquid[idx(x, y)] || !isFloor(x, y)) continue;
    liquidCells += 1;
    if (profile.liquid === "lava") { lower[idx(x, y)] = tileOf(LAVA_KIT, x, y); continue; }
    let m = 0;
    const bits: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
    for (const [dx, dy, bit] of bits) if (liqLike(x + dx, y + dy)) m |= bit;
    lower[idx(x, y)] = canal?.variantMap[String(m)] ?? canal?.variantMap["255"] ?? voidTile;
  }
  if (liquidCells && profile.liquid === "water" && !canal) warnings.push("이 타일셋 사본에 물 오토타일(beodeul_canal_lake_47)이 없어 물이 그려지지 않았다.");
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!bridge[idx(x, y)]) continue;
    const ew = (isWalk(x - 1, y) || bridge[idx(x - 1, y)]) && (isWalk(x + 1, y) || bridge[idx(x + 1, y)]);
    lower[idx(x, y)] = kit(ew ? "bd-pick-aqueduct-sewer-bridge-ew-stone" : "bd-pick-aqueduct-sewer-bridge-ns-stone").rows[0]!.tiles[0]!;
  }

  // ---- 장식 ----
  const pseudo = { id: "compose", name: "compose", width: W, height: H, tilesetId: ts.id, events: [], lowerTiles: lower, upperTiles: upper } as unknown as GameMap;
  const counts: Record<string, number> = {};
  const blocked = new Uint8Array(W * H);
  const passTile = (tile: number) => { const pass = ts.passability[tile]; return !!pass && Object.values(pass).some(Boolean); };
  const stand = (x: number, y: number) => isFloor(x, y) && !blocked[idx(x, y)] && passTile(lower[idx(x, y)]!) && (upper[idx(x, y)]! < 0 || passTile(upper[idx(x, y)]!));
  // 입구 칸과 문 칸들 — 물건 하나를 놓을 때마다 여기서 모두 닿는지 본다(줄째 비워 두는 대신 길만 지킨다: 큰 홀 가운데가 비지 않게).
  const keyCells: [number, number][] = [];
  for (const c of corridors) keyCells.push([c.rect.x + Math.floor(c.rect.w / 2), c.rect.y + Math.floor(c.rect.h / 2)]);
  rooms.forEach((r, ri) => {
    // 방 대표 칸 = 방 아랫변 가운데에 가장 가까운 걸을 수 있는 칸(호수·수로 방은 가운데가 물이다)
    const tx = r.x + Math.floor(r.w / 2), ty = r.y + r.h - 1;
    let best: [number, number] | null = null; let bd = Infinity;
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (!isWalk(x, y) || bridge[idx(x, y)] || roomAt[idx(x, y)] !== ri) continue;
      const d = Math.abs(x - tx) + Math.abs(y - ty);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) keyCells.push(best);
  });
  const connected = (): boolean => {
    const start = keyCells.find(([x, y]) => stand(x, y));
    if (!start) return false;
    const seen = new Uint8Array(W * H);
    const stack: [number, number][] = [start]; seen[idx(start[0], start[1])] = 1;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (!stand(nx, ny) || seen[idx(nx, ny)]) continue;
        seen[idx(nx, ny)] = 1; stack.push([nx, ny]);
      }
    }
    // 방마다: 그 방 바닥 중 걸을 수 있는 칸이 하나라도 닿았나 + 모든 문 칸이 닿았나
    for (const [x, y] of keyCells) if (stand(x, y) && !seen[idx(x, y)]) return false;
    return rooms.every((r, ri) => { for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (roomAt[idx(x, y)] === ri && seen[idx(x, y)]) return true; return false; });
  };
  const put = (kitId: string, x: number, y: number, opts: { label?: string; free?: boolean; liquidOk?: boolean } = {}): boolean => {
    if (!hasKit(kitId)) return false;
    const def = kit(kitId);
    if (x < 0 || y < 0 || x + def.width > W || y + def.height > H) return false;
    if (checkGroundSupportForStamp(pseudo, ts, def, x, y)) return false;
    const ownSupport = kitSupportKind(def) === null;   // 던전 테마 밖 키트(광산 골짜기 등)는 groundSupport 가 안 본다 — 같은 규칙을 여기서 직접
    const cells: { x: number; y: number; lo: number; up: number }[] = [];
    for (let dy = 0; dy < def.height; dy += 1) for (let dx = 0; dx < def.width; dx += 1) {
      const row = def.rows[dy]!;
      const lo = row.tiles[dx] ?? -1, up = row.upperTiles?.[dx] ?? -1;
      if (lo < 0 && up < 0) continue;
      const X = x + dx, Y = y + dy;
      // 물·용암·다리 위에는 아무것도 놓지 않는다(액체는 걸을 수 없는 칸, 다리는 길이다)
      if (inb(X, Y) && (liquid[idx(X, Y)] || bridge[idx(X, Y)]) && !opts.liquidOk) return false;
      if (ownSupport && up >= 0) {
        const bottom = dy === def.height - 1;
        if (bottom ? !isWalk(X, Y) : !(isWalk(X, Y) || isWall(X, Y))) return false;
      }
      if (upper[idx(X, Y)]! >= 0 || blocked[idx(X, Y)]) return false;
      if (doorstep[idx(X, Y)] && isFloor(X, Y)) return false;
      cells.push({ x: X, y: Y, lo, up });
    }
    if (!cells.length) return false;
    const before = cells.map((c) => [lower[idx(c.x, c.y)]!, upper[idx(c.x, c.y)]!] as const);
    for (const c of cells) {
      if (c.lo >= 0) lower[idx(c.x, c.y)] = c.lo;
      if (c.up >= 0) upper[idx(c.x, c.y)] = c.up;
    }
    // 길을 막는 물건이면 되돌린다(바닥 위 걸을 수 없는 칸이 새로 생긴 경우만 검사).
    const blocks = cells.some((c) => isFloor(c.x, c.y) && !passTile(c.up >= 0 ? c.up : c.lo));
    if (blocks && !opts.free && !connected()) {
      cells.forEach((c, i) => { lower[idx(c.x, c.y)] = before[i]![0]; upper[idx(c.x, c.y)] = before[i]![1]; });
      return false;
    }
    const label = opts.label ?? kitId.replace(/^bd-pick-/, "");
    counts[label] = (counts[label] ?? 0) + 1;
    return true;
  };
  const putAny = (kitId: string, cands: readonly (readonly [number, number])[], opts?: { label?: string }): [number, number] | null => {
    for (const [x, y] of cands) if (put(kitId, x, y, opts)) return [x, y];
    return null;
  };
  const weighted = <T,>(rs: () => number, list: readonly (readonly [T, number])[]): T => {
    const total = list.reduce((a, [, w]) => a + w, 0);
    let r = rs() * total;
    for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
    return list[list.length - 1]![0];
  };
  const shuffle = <T,>(rs: () => number, list: readonly T[]): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(rs() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
    return out;
  };

  /** 방의 북쪽 벽 가운데 줄(b=1) 칸 중 양옆도 같은 줄 벽인 칸(벽 끝 마구리 칸에는 걸지 않는다). */
  const wallSlots = (r: PlacedRoom): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = [];
    for (let x = r.x - 1; x <= r.x + r.w; x += 1) {
      // 이 칸의 벽 가운데 줄 = 그 열 바닥 첫 칸 위 둘째 줄
      let fy = -1;
      for (let y = r.y; y < r.y + r.h; y += 1) if (isWalk(x, y) && !bridge[idx(x, y)] && roomAt[idx(x, y)] === rooms.indexOf(r)) { fy = y; break; }
      if (fy < 0) continue;
      const y = fy - 2;
      if (!isWall(x, y) || wallB[idx(x, y)] !== 1) continue;
      if (wallB[idx(x - 1, y)] !== 1 || wallB[idx(x + 1, y)] !== 1) continue;
      if (doorstep[idx(x, fy)]) continue;
      out.push({ x, y });
    }
    return out;
  };
  /** 방 바닥 칸(벽에서 inset 칸 안쪽). */
  const floorCells = (r: PlacedRoom, inset = 0): [number, number][] => {
    const out: [number, number][] = [];
    const ri = rooms.indexOf(r);
    for (let y = r.y + inset; y < r.y + r.h - inset; y += 1) for (let x = r.x + inset; x < r.x + r.w - inset; x += 1) if (isWalk(x, y) && !bridge[idx(x, y)] && roomAt[idx(x, y)] === ri) out.push([x, y]);
    return out;
  };
  /** 벽(또는 천장)에 붙은 바닥 칸 — 잡동사니는 가장자리·구석에 모인다. 구석(두 쪽이 막힌 칸)이 앞에 온다. */
  const edgeCells = (r: PlacedRoom, rs: () => number): [number, number][] => {
    const cells = floorCells(r).filter(([x, y]) => !isWalk(x - 1, y) || !isWalk(x + 1, y) || !isWalk(x, y - 1) || !isWalk(x, y + 1));
    const closed = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isWalk(x + dx!, y + dy!)).length;
    return shuffle(rs, cells).sort((a, b) => closed(b[0], b[1]) - closed(a[0], a[1]));
  };
  /** 벽걸이를 간격을 흔들어 건다(최소 간격 2, 평균 gap). */
  const hangAlong = (slots: { x: number; y: number }[], rs: () => number, gap: number, pick: () => string, max = 99): number => {
    let n = 0, next = slots[0] ? slots[0].x + 1 + Math.floor(rs() * gap) : 0;
    for (const s of slots) {
      if (n >= max) break;
      if (s.x < next) continue;
      if (upper[idx(s.x - 1, s.y)]! >= 0 || upper[idx(s.x + 1, s.y)]! >= 0) continue;   // 이미 건 물건 바로 옆에는 걸지 않는다
      if (put(pick(), s.x, s.y)) { n += 1; next = s.x + 2 + Math.floor(rs() * gap); }
    }
    return n;
  };
  /** 잡동사니 한 모둠: 기준 칸 둘레 반지름 2 안에 n 개. */
  const cluster = (rs: () => number, cx: number, cy: number, n: number, kinds: readonly (readonly [string, number])[]) => {
    const around: [number, number][] = [];
    const home = inb(cx, cy) ? roomAt[idx(cx, cy)]! : -1;
    // 모둠은 기준 칸과 같은 방 안에만(통로로 넘치지 않게)
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (inb(cx + dx, cy + dy) && roomAt[idx(cx + dx, cy + dy)] === home) around.push([cx + dx, cy + dy]);
    let placed = 0;
    for (const [x, y] of shuffle(rs, around).sort((a, b) => Math.abs(a[0] - cx) + Math.abs(a[1] - cy) - Math.abs(b[0] - cx) - Math.abs(b[1] - cy))) {
      if (placed >= n) break;
      if (rs() < 0.35) continue;
      if (put(weighted(rs, kinds), x, y)) placed += 1;
    }
  };
  const litter: readonly (readonly [string, number])[] = [[K.bones, 3], [K.rubble, 3], [K.skulls, 1], [K.rubbleCastle, 1]];

  // 서사 앵커: 보스방 = kind boss(없으면 입구에서 가장 깊은 방), 보물 방 = kind vault.
  const bossRoom = rooms.find((r) => r.kind === "boss") ?? (rooms.length > 2 ? [...rooms].filter((r) => r.kind !== "vault" && r.kind !== "entrance").sort((a, b) => b.depth - a.depth)[0] ?? null : null);
  const vaultRoom = rooms.find((r) => r.kind === "vault") ?? null;

  const ctx: DressCtx = {
    W, H, rooms, corridors, seed, grid: !!layout.grid, hasKit, kit, put, putAny, weighted, shuffle, wallSlots, floorCells, edgeCells, hangAlong, cluster,
    isFloor, isWalk, isWall, idx, inb, wallB, roomAt, liquid, bridge, upper, lower, blocked, doorstep, counts, litter,
  };
  let stairsUp: DungeonCompose["stairsUp"] = null;
  let stairsDown: DungeonCompose["stairsDown"] = null;

  rooms.forEach((r, i) => {
    const rs = rng(seed * 7 + i * 101 + 3);
    const slots = wallSlots(r);
    const cx = r.x + Math.floor(r.w / 2);
    const centerFirst = [...slots].sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx) || a.x - b.x);
    const torch = () => K.torch;
    // 올라가는 계단: 북쪽 벽 아래 두 줄(양옆이 벽인 칸, 가운데 쪽). 앞 칸 = 방 맨 윗줄 바닥. 모든 종류 공통.
    // 계단 칸 양옆 두 칸까지 같은 높이 벽(벽 끝 마구리·계단 옆 단차에 반쯤 걸리지 않게), 가운데에 가까운 칸.
    let s: { x: number; y: number } | null = null;
    if (r.kind === "entrance") {
      const flat = (q: { x: number; y: number }) => [-2, -1, 1, 2].every((d) => wallB[idx(q.x + d, q.y)] === 1 && wallB[idx(q.x + d, q.y + 1)] === 0);
      s = centerFirst.find(flat) ?? centerFirst.find((q) => wallB[idx(q.x - 1, q.y + 1)] === 0 && wallB[idx(q.x + 1, q.y + 1)] === 0) ?? null;
      if (s) {
        const def = kit(K.stairsUp);
        for (let dy = 0; dy < def.height; dy += 1) lower[idx(s.x, s.y + dy)] = def.rows[dy]!.tiles[0]!;
        stairsUp = { x: s.x, y: s.y + 1, front: { x: s.x, y: s.y + 2 } };
        blocked[idx(s.x, s.y + 2)] = 1;
        counts["stairs-up"] = 1;
      } else warnings.push("입구 방 북쪽 벽에 올라가는 계단을 놓을 평평한 벽이 없다.");
    }
    if (type !== "catacomb" && type !== "castle" && dressTyped(ctx, type, r, rs, s, slots, centerFirst)) return;
    switch (r.kind) {
      case "entrance": {
        const rest = slots.filter((q) => !s || Math.abs(q.x - s.x) > 1);
        // 계단 양옆 횃불 한 쌍(입구 표지) + 나머지 벽은 드문드문
        if (s) { put(K.torch, s.x - 2, s.y); put(K.torch, s.x + 2, s.y); }
        hangAlong(rest, rs, 4, torch, 2);
        const e = edgeCells(r, rs);
        cluster(rs, e[0]?.[0] ?? r.x + 1, e[0]?.[1] ?? r.y + 1, 3, [[K.crate, 2], [K.barrel, 2], [K.crateStack, 1], [K.bucket, 1]]);
        put(K.brazier, r.x + 1 + Math.floor(rs() * 2), r.y + r.h - 2);
        put(K.brazier, r.x + r.w - 2 - Math.floor(rs() * 2), r.y + r.h - 2);
        for (const [x, y] of e.slice(3, 7)) if (rs() < 0.6) put(weighted(rs, litter), x, y);
        break;
      }
      case "hall": {
        // 큰 홀: 기둥 두 줄(간격 흔들기, 몇 개는 부러진 기둥) 또는 쓰러진 기둥이 있는 폐허 홀
        const ruined = rs() < 0.35;
        const rowsY = r.h >= 8 ? [r.y + 2, r.y + r.h - 2] : [r.y + Math.floor(r.h / 2)];
        let x = r.x + 2 + Math.floor(rs() * 2);
        while (x < r.x + r.w - 2) {
          for (const y of rowsY) {
            const k = ruined && rs() < 0.45 ? K.columnBroken : K.column;
            put(k, x, y - 1);
          }
          x += 3 + Math.floor(rs() * 2);
        }
        if (ruined) { const f = shuffle(rs, floorCells(r, 2))[0]; if (f) put(K.fallenColumn, f[0], f[1]); }
        hangAlong(slots, rs, 4, () => (rs() < 0.75 ? K.torch : K.banner));
        if (rs() < 0.5) { const a = centerFirst.find((q) => isWall(q.x + 2, q.y) && wallB[idx(q.x + 2, q.y)] === 1); if (a) put(rs() < 0.5 ? K.archDark : K.archBars, a.x, a.y); }
        const e = edgeCells(r, rs);
        for (let c = 0; c < 2 + Math.floor(rs() * 2); c += 1) { const p = e[c * 5]; if (p) cluster(rs, p[0], p[1], 2 + Math.floor(rs() * 2), litter); }
        break;
      }
      case "crypt": {
        // 묘실: 벽감 줄(종류 섞고 군데군데 비움) + 관 줄(빈자리 흔들기) + 구석 뼈 더미·촛불
        const niches = [K.nicheSkull, K.nicheUrn, K.nicheShroud];
        for (const s of slots) if (rs() < 0.55) put(niches[Math.floor(rs() * 3)]!, s.x, s.y);
        hangAlong(slots, rs, 5, torch, 2);
        // 관: 3칸 간격 격자 자리를 섞어 넓이에 맞는 수만큼(줄이 반듯하되 군데군데 빈다)
        const want = Math.max(2, Math.round((r.w * r.h) / 22));
        const grid: [number, number][] = [];
        for (let y = r.y + 2; y < r.y + r.h - 1; y += 3) for (let x = r.x + 1; x < r.x + r.w - 2; x += 3) grid.push([x, y]);
        let coffins = 0;
        for (const [x, y] of shuffle(rs, grid)) {
          if (coffins >= want) break;
          if (put(K.coffin, x, y - 1)) { coffins += 1; if (rs() < 0.35) put(K.candles, x + 2, y); }
        }
        const e = edgeCells(r, rs);
        if (e[0]) put(K.boneHeap, e[0][0], e[0][1] - 1);
        for (const [x, y] of e.slice(1, 9)) if (rs() < 0.5) put(weighted(rs, [[K.skulls, 2], [K.bones, 3], [K.candles, 1]]), x, y);
        break;
      }
      case "cell": {
        // 감방: 칸막이로 나뉜 칸마다 짚 침상·양동이·사슬(칸마다 다르게), 앞쪽 복도에 간수 탁자·고문대
        const ps = partitions.filter((p) => p.room === r.id).map((p) => p.x);
        const bounds = [r.x - 1, ...ps, r.x + r.w];
        for (let k = 0; k + 1 < bounds.length; k += 1) {
          const x0 = bounds[k]! + 1, x1 = bounds[k + 1]! - 1;
          if (x1 < x0) continue;
          const xs = Array.from({ length: x1 - x0 + 1 }, (_, j) => x0 + j);
          put(K.strawBed, xs[Math.floor(rs() * xs.length)]!, r.y + (rs() < 0.5 ? 0 : 1));
          if (rs() < 0.6) put(K.bucket, xs[Math.floor(rs() * xs.length)]!, r.y + 2);
          if (rs() < 0.4) put(weighted(rs, litter), xs[Math.floor(rs() * xs.length)]!, r.y + 2);
          const wall = slots.filter((s) => s.x >= x0 && s.x <= x1);
          if (wall.length && rs() < 0.8) put(K.chains, wall[Math.floor(rs() * wall.length)]!.x, wall[0]!.y);
        }
        const front = floorCells(r).filter(([, y]) => y >= r.y + 4);
        const f = shuffle(rs, front);
        if (f[0]) put(rs() < 0.5 ? K.anvilTable : K.rack, f[0][0], f[0][1] - 1);
        if (f[1] && rs() < 0.5) put(K.ironMaiden, f[1][0], f[1][1] - 1);
        if (f[2]) put(K.brazier, f[2][0], f[2][1]);
        break;
      }
      case "shrine":
      case "boss": {
        const isBoss = r.kind === "boss";
        // 제단은 북쪽 벽 앞 가운데, 깃발은 제단 양옆 대칭(서사 축), 그 밖 벽은 흔들기
        const ax = cx - 1;
        const altar = putAny(isBoss || rs() < 0.5 ? K.altar : K.altarCult, [0, 1, -1, 2, -2].map((d) => [ax + d, r.y] as [number, number]));
        if (altar) {
          for (const d of [2, 3]) { const l = slots.find((s) => s.x === altar[0] - d), rr = slots.find((s) => s.x === altar[0] + 1 + d); if (l && rr) { if (put(K.banner, l.x, l.y)) put(K.banner, rr.x, rr.y); break; } }
          put(K.candles, altar[0] - 1, altar[1] + 1); put(K.candles, altar[0] + 2, altar[1] + 1);
          put(K.brazier, altar[0] - 2, altar[1] + 2); put(K.brazier, altar[0] + 3, altar[1] + 2);
        }
        hangAlong(slots, rs, 3, torch);
        if (isBoss) {
          // 보스방: 기둥이 바닥 가운데를 둘러싸고(싸울 자리는 비운다) 구석에 뼈 더미
          const ys = [r.y + 2, r.y + r.h - 2];
          for (const y of ys) for (const x of [r.x + 2, r.x + r.w - 3]) put(K.column, x, y - 1);
          const e = edgeCells(r, rs);
          if (e[0]) put(K.boneHeap, e[0][0], e[0][1] - 1);
          for (const [x, y] of e.slice(1, 8)) if (rs() < 0.55) put(weighted(rs, [[K.skulls, 2], [K.bones, 2], [K.rubble, 1]]), x, y);
        } else {
          for (const [x, y] of edgeCells(r, rs).slice(0, 5)) if (rs() < 0.5) put(weighted(rs, [[K.candles, 2], [K.skulls, 1], [K.bones, 1]]), x, y);
        }
        break;
      }
      case "storage": {
        // 창고: 벽을 따라 상자·통 모둠 2~3개(모둠마다 섞임), 가운데는 지나다니게
        const e = edgeCells(r, rs);
        const n = 2 + Math.floor(rs() * 2);
        for (let c = 0; c < n; c += 1) { const p = e[c * 4]; if (p) cluster(rs, p[0], p[1], 3 + Math.floor(rs() * 2), [[K.crate, 3], [K.barrel, 3], [K.crateStack, 2], [K.bucket, 1]]); }
        hangAlong(slots, rs, 4, torch, 2);
        if (rs() < 0.6) { const f = shuffle(rs, floorCells(r, 1))[0]; if (f) put(K.lantern, f[0], f[1] - 1); }
        break;
      }
      case "vault": {
        // 보물 방: 벽감 항아리, 가운데 제단, 상자 모둠, 촛불
        for (const s of centerFirst.slice(0, 4)) if (rs() < 0.7) put(K.nicheUrn, s.x, s.y);
        hangAlong(slots, rs, 3, torch, 2);
        const altar = putAny(K.altar, [0, 1, -1].map((d) => [cx - 1 + d, r.y + 1] as [number, number]));
        if (altar) { put(K.candles, altar[0] - 1, altar[1] + 1); put(K.candles, altar[0] + 2, altar[1] + 1); }
        const e = edgeCells(r, rs);
        if (e[0]) cluster(rs, e[0][0], e[0][1], 3, [[K.crate, 2], [K.crateStack, 1], [K.barrel, 1]]);
        break;
      }
    }
  });
  // 통로: 가로 통로 벽에 횃불 하나(가끔), 바닥에 배수 창살·뼈 조금
  (layout.grid ? [] : corridors).forEach((c, i) => {
    const rs = rng(seed * 13 + i * 71 + 9);
    const r = c.rect;
    if ((c.dir === "E" || c.dir === "W") && r.w >= 4 && rs() < 0.6) {
      const x = r.x + 1 + Math.floor(rs() * (r.w - 2));
      if (wallB[idx(x, r.y - 2)] === 1 && wallB[idx(x - 1, r.y - 2)] === 1 && wallB[idx(x + 1, r.y - 2)] === 1) put(K.torch, x, r.y - 2);
    }
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (doorstep[idx(x, y)]) continue;
      const v = hash01(x, y, seed + i);
      if (v < 0.05) put(K.grate, x, y, { free: true });
      else if (v < 0.09) put(weighted(rs, litter), x, y);
    }
  });

  // 내려가는 계단: 보스방(없으면 가장 깊은 방) 안쪽 구석 쪽 바닥 칸.
  const deepRoom = bossRoom ?? (rooms.length > 1 ? rooms[rooms.length - 1]! : null);
  if (deepRoom) {
    const def = kit(K.stairsDown);
    // 바닥 한가운데 쪽(여덟 이웃이 모두 바닥, 벽 바로 밑 줄 제외)에서 들어온 문과 가장 먼 칸 — 벽에 붙으면 벽으로 들어가는 계단처럼 보인다.
    const doors = corridors.filter((c) => c.a === deepRoom.id || c.b === deepRoom.id).map((c) => [c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2] as const);
    const inset = deepRoom.w >= 8 && deepRoom.h >= 7 ? 2 : 1;
    const cands = floorCells(deepRoom, inset).filter(([x, y]) => !blocked[idx(x, y)] && upper[idx(x, y)]! < 0 && !doorstep[idx(x, y)] && y > deepRoom.y + 1
      && [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => isWalk(x + dx, y + dy) && !bridge[idx(x + dx, y + dy)] && upper[idx(x + dx, y + dy)]! < 0)));
    const doorDist = (x: number, y: number) => Math.min(...doors.map(([dx, dy]) => Math.abs(dx - x) + Math.abs(dy - y)), 99);
    const far = cands.sort((a, b) => doorDist(b[0], b[1]) - doorDist(a[0], a[1]));
    for (const [x, y] of far) {
      const was = lower[idx(x, y)]!;
      lower[idx(x, y)] = def.rows[0]!.tiles[0]!;
      blocked[idx(x, y)] = 1;
      if (!connected()) { lower[idx(x, y)] = was; blocked[idx(x, y)] = 0; continue; }
      stairsDown = { x, y };          // 계단 칸은 이벤트 자리로 비워 둔다(blocked 유지 — spots 에 들지 않게)
      counts["stairs-down"] = 1;
      break;
    }
  }

  // ---- 검사 1: 같은 규칙(groundSupport)으로 자기 결과를 본다. 어긋나면 맵을 만들지 않는다.
  const own = groundSupportIssues(pseudo, ts, { events: false }).filter((i) => i.severity === "error");
  if (own.length) throw new DungeonComposeError(`시공기 내부 오류: 받침 없는 물체 ${own.length}건 — ${own[0]!.message}`, "support-violation");

  // ---- 검사 2: 입구에서 모든 방·통로 바닥이 걸어서 닿는지.
  const entranceGuess = { x: rooms[0]!.x + Math.floor(rooms[0]!.w / 2), y: rooms[0]!.y + rooms[0]!.h - 2 };
  const findStand = (x0: number, y0: number): [number, number] => {
    for (let r = 0; r < 8; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (stand(x0 + dx, y0 + dy)) return [x0 + dx, y0 + dy];
    throw new DungeonComposeError("입구 방에 설 수 있는 바닥이 없다.", "no-entrance");
  };
  const startCell = findStand(entranceGuess.x, entranceGuess.y);
  const seen = new Uint8Array(W * H);
  const queue: [number, number][] = [startCell]; seen[idx(startCell[0], startCell[1])] = 1;
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (!stand(nx, ny) || seen[idx(nx, ny)]) continue;
      seen[idx(nx, ny)] = 1; queue.push([nx, ny]);
    }
  }
  const unreachable = rooms.filter((r) => !floorCells(r).some(([x, y]) => seen[idx(x, y)]));
  if (unreachable.length) throw new DungeonComposeError(`시공기 내부 오류: 입구에서 걸어 닿지 않는 방 ${unreachable.map((r) => r.id).join(", ")}`, "unreachable");
  const sd = stairsDown as { x: number; y: number } | null;
  if (sd && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[idx(sd.x + dx!, sd.y + dy!)])) throw new DungeonComposeError("시공기 내부 오류: 내려가는 계단에 닿지 않는다", "unreachable");
  const su = stairsUp as DungeonCompose["stairsUp"];
  if (su && !seen[idx(su.front.x, su.front.y)] && ![[1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => seen[idx(su.front.x + dx!, su.front.y + dy!)])) throw new DungeonComposeError("시공기 내부 오류: 올라가는 계단 앞에 닿지 않는다", "unreachable");

  // ---- 잠긴 문 자리: 보물 방(없으면 보스방)으로 들어가는 통로 가운데 칸 ----
  const gateRoom = vaultRoom ?? bossRoom;
  const gateCorridor = gateRoom ? corridors.find((c) => c.b === gateRoom.id && !c.loop) : null;
  const gate = gateCorridor && gateRoom ? (() => {
    const r = gateCorridor.rect;
    const x = r.x + Math.floor(r.w / 2), y = r.y + Math.floor(r.h / 2);
    return stand(x, y) && seen[idx(x, y)] ? { x, y, to: gateRoom.id } : null;
  })() : null;

  // 이벤트·적을 둘 만한 빈 바닥 칸(방마다) — 위층 그림이 없고 네 이웃도 걸을 수 있고 입구에서 닿는 칸, 방 가운데에서 가까운 순.
  const spots: Record<string, { x: number; y: number }[]> = {};
  for (const r of rooms) {
    const ccx = r.x + (r.w - 1) / 2, ccy = r.y + (r.h - 1) / 2;
    const cells: { x: number; y: number; d: number }[] = [];
    for (const [x, y] of floorCells(r, 1)) {
      if (upper[idx(x, y)]! >= 0 || blocked[idx(x, y)] || !seen[idx(x, y)] || doorstep[idx(x, y)]) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([ox, oy]) => stand(x + ox!, y + oy!))) continue;
      cells.push({ x, y, d: Math.abs(x - ccx) + Math.abs(y - ccy) });
    }
    cells.sort((a, b) => a.d - b.d);
    const picked: { x: number; y: number }[] = [];
    for (const c of cells) { if (picked.every((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) >= 3)) picked.push({ x: c.x, y: c.y }); if (picked.length >= 6) break; }
    spots[r.id] = picked;
  }

  void rimmed;
  void random;
  const picture = drawPicture(W, H, isFloor, isWall, upper, liquid, bridge);
  return {
    type, liquid: { kind: profile.liquid ?? null, cells: liquidCells, bridges: bridgeCount },
    width: W, height: H, lower, upper, rooms, corridors, entrance: { x: startCell[0], y: startCell[1] }, stairsUp: su, stairsDown: sd,
    anchors: { boss: bossRoom?.id ?? null, treasure: vaultRoom?.id ?? null, gate }, spots, picture, counts, warnings,
  };
}

function drawPicture(W: number, H: number, isFloor: (x: number, y: number) => boolean, isWall: (x: number, y: number) => boolean, upper: readonly number[], liquid: Uint8Array, bridge: Uint8Array): string[] {
  const rows: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let line = "";
    for (let x = 0; x < W; x += 1) line += upper[y * W + x]! >= 0 ? "o" : liquid[y * W + x] ? "~" : bridge[y * W + x] ? "=" : isFloor(x, y) ? "." : isWall(x, y) ? "W" : "#";
    rows.push(line);
  }
  return rows;
}
