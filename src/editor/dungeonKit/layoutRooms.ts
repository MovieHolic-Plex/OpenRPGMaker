// 방+통로 배치 문법(rooms) — 방 목록 → 사각 방·통로 배치. 칩셋을 모른다(2026-10-15 compose.ts 에서 옮김, 출력 불변).
import { rng, WALL_ROWS } from "./grid";
import { DungeonComposeError } from "./errors";
import { planMine, planSewer, planTemple } from "./grammar";
import type { DungeonDir, DungeonLayout, DungeonLayoutFamily, DungeonRoomInput, DungeonRoomKind, DungeonSpec, PlacedCorridor, PlacedRoom, Rect } from "./types";
import { DUNGEON_DIRS } from "./types";

const DEFAULT_SIZE: Record<DungeonRoomKind, [number, number]> = {
  // 2026-10-23: 큰 방을 한 단 줄였다 — 홀·보스방이 맨바닥 넓은 방으로 읽혔다(VQA 「빈 바닥 15% 초과」). 빈 바닥은 메우지 않고 줄인다.
  entrance: [10, 6], hall: [13, 8], crypt: [11, 7], cell: [10, 6], shrine: [11, 8], boss: [13, 9], storage: [9, 6], vault: [9, 6],
  channel: [28, 11], cistern: [13, 10], pump: [10, 8], cavern: [14, 9], lake: [14, 9], grotto: [10, 8], forge: [11, 8], nave: [17, 19],
  junction: [9, 7], stope: [14, 8], depot: [11, 8], library: [11, 8],
};
const MARGIN = 2;


const inter = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** 방이 차지하는 칸: 바닥 + 위 벽 앞면 3줄 + 그 위 천장 한 줄 + 양옆·아래 천장 한 칸(띠). 두 방의 자리는 이 상자끼리 겹치지 않아야 한다. */
// 2026-10-23 assistant-dungeons-2: 옆 띠 1칸·아래 띠 0칸으로 줄였다 — 방 사이 검은 허공이 맵의 50~60%였다(VQA 「화면 절반이 허공」).
// 옆으로 두 방은 천장 2칸(fixThickness 가 1칸 틈은 메운다), 위아래는 벽 앞면 3줄 + 천장 1줄 = 4칸이면 된다.
const roomFootprint = (r: Rect): Rect => ({ x: r.x - 1, y: r.y - WALL_ROWS - 1, w: r.w + 2, h: r.h + WALL_ROWS + 1 });
/** 통로: 바닥 + 가로 통로는 위 벽 앞면 3줄·천장 1줄, 세로 통로는 양옆 천장 한 칸. */
const corridorFootprint = (c: PlacedCorridor): Rect => c.dir === "N" || c.dir === "S"
  ? { x: c.rect.x - 1, y: c.rect.y, w: c.rect.w + 2, h: c.rect.h }
  : { x: c.rect.x, y: c.rect.y - WALL_ROWS - 1, w: c.rect.w, h: c.rect.h + WALL_ROWS + 2 };
const opposite = (d: DungeonDir): DungeonDir => (d === "N" ? "S" : d === "S" ? "N" : d === "W" ? "E" : "W");

// ---------- 0. 방 구성(방 목록이 없을 때) ----------

/** 배치 가족: 주면 그것, 아니면 시드로 linear·hub·loop 중 하나(같은 요청 두 번이 같은 뼈대가 되지 않게 — 시드는 맵 수·이름에서 온다). */
export function layoutFamilyOf(spec: DungeonSpec): DungeonLayoutFamily {
  if (spec.layout) return spec.layout;
  const fams: DungeonLayoutFamily[] = ["linear", "hub", "loop"];
  return fams[Math.abs((spec.seed ?? 7) * 2654435761 >>> 7) % 3]!;
}

/** 종류마다 가운데 방들 후보(앞이 자주 나온다). 보스방·보물 방·입구는 따로. */
const MIDDLE_POOL: Partial<Record<string, DungeonRoomKind[]>> = {
  catacomb: ["crypt", "cell", "storage", "hall", "shrine", "crypt", "cell", "hall", "storage"],
  // 성·요새: 대전(hall)·병영 창고(storage)·감옥(cell)·예배당(shrine). 묘실은 드물게.
  castle: ["hall", "storage", "cell", "shrine", "hall", "storage", "crypt", "cell", "hall"],
  // 피라미드: 열주 홀·석관 묘실·제물 방·보물 창고
  pyramid: ["hall", "crypt", "shrine", "storage", "crypt", "hall", "shrine", "crypt", "storage"],
  // 마법탑 한 층(층을 쌓지 않을 때): 서고·연구실(창고)·마법진 방(제단)
  tower: ["library", "storage", "shrine", "library", "hall", "storage", "library", "shrine", "hall"],
};

/** size·바라는 넓이 → 방 목록. 배치 가족(linear·hub·loop)이 뼈대를 정한다 — 입구 → … → 보스방, 보물 방은 보스방 곁. */
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
  const pool: DungeonRoomKind[] = [...(MIDDLE_POOL[type] ?? MIDDLE_POOL.catacomb!)];
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  const fam = layoutFamilyOf(spec);
  const hubKind: DungeonRoomKind = type === "tower" ? "library" : "hall";
  const rooms: DungeonRoomInput[] = [{ id: "entrance", kind: "entrance" }];
  const middle = Math.max(0, n - (n >= 5 ? 3 : 2));
  if (fam === "hub") {
    // 바퀴살: 입구 → 큰 가운데 방 → 사방 갈래(보스방도 가운데 방에서). 가운데 방은 한 단 크게.
    rooms.push({ id: "hub", kind: hubKind, w: 15 + Math.floor(random() * 3), h: 10 + Math.floor(random() * 2) });
    for (let i = 0; i < Math.max(0, middle - 1); i += 1) { const kind = pool[i % pool.length]!; rooms.push({ id: `${kind}${i + 1}`, kind, from: "hub" }); }
    rooms.push({ id: "boss", kind: "boss", from: "hub" });
  } else {
    // 사슬(linear): 앞 방에 곧장 잇는다. 고리(loop): 같은 사슬이지만 배치가 고리 통로를 둘·셋 더 낸다(layoutOnce).
    let prev = "entrance";
    for (let i = 0; i < middle; i += 1) {
      const kind = i === 0 ? hubKind : pool[i % pool.length]!;
      const id = i === 0 ? "hall" : `${kind}${i + 1}`;
      // linear 도 곁방 하나는 둔다(줄 끝 막다른 곁방 = 보물·함정 자리) — 셋째 방.
      const from = fam === "linear" && i === 2 && middle > 3 ? "hall" : prev;
      rooms.push({ id, kind, from });
      if (from === prev) prev = id;
    }
    rooms.push({ id: "boss", kind: "boss", from: prev });
  }
  if (n >= 5) rooms.push({ id: "vault", kind: "vault", from: "boss" });
  return rooms.slice(0, Math.max(n, 2));
}

// ---------- 1. 방 배치 ----------


/**
 * 같은 방 목록을 배치 흔들기만 바꿔 64번 놓고, 허공(방·통로·벽 앞면이 아닌 칸) + 가장 나쁜 카메라 창 허공이 가장 적은 배치를 고른다(2026-10-23 assistant-dungeons-2).
 * 한 번만 놓으면 십자·사슬 모양이 되어 사분면이 통째로 검은 허공이었다. 결정적이다(같은 시드 = 같은 배치).
 */
export function layoutDungeon(spec: DungeonSpec): DungeonLayout {
  const inputs = spec.rooms?.length ? spec.rooms : planDungeonRooms(spec);
  if (inputs.length < 1) throw new DungeonComposeError("rooms 에 방이 하나 이상 있어야 한다.", "invalid-args");
  if (inputs.length > 12) throw new DungeonComposeError("방은 12개까지다 — 한 층을 둘로 나눠라.", "invalid-args");
  let best: { layout: DungeonLayout; score: number } | null = null;
  let lastError: unknown = null;
  for (let salt = 0; salt < 64; salt += 1) {
    let layout: DungeonLayout;
    try { layout = layoutOnce(spec, inputs, salt); } catch (error) { lastError = error; continue; }
    const score = voidScore(layout);
    if (!best || score < best.score - 1e-9) best = { layout, score };
  }
  if (!best) throw lastError;
  return best.layout;
}

/** 배치의 허공 비율: 바깥 상자 중 방·통로 바닥과 그 북쪽 벽 앞면 3줄이 아닌 칸. */
function voidScore(layout: DungeonLayout): number {
  const W = layout.width, H = layout.height;
  const occ = new Uint8Array(W * H);
  const mark = (r: Rect, north: number) => { for (let y = r.y - north; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (x >= 0 && y >= 0 && x < W && y < H) occ[y * W + x] = 1; };
  for (const r of layout.rooms) mark(r, WALL_ROWS);
  for (const c of layout.corridors) mark(c.rect, c.dir === "E" || c.dir === "W" ? WALL_ROWS : 0);
  let n = 0; for (let i = 0; i < occ.length; i += 1) n += occ[i]!;
  // 플레이어 카메라(20×15, 맵 경계로 당김) 중 가장 나쁜 창의 허공 비율도 더한다 — 전체 비율만 보면 ㄱ자 판 구석 창이 57% 허공인 판을 골랐다
  // (2026-10-23 dg2-r3 레버 던전·지하 묘지).
  const SW = Math.min(20, W), SH = Math.min(15, H);
  let worst = 0;
  const seen = new Set<number>();
  for (const r of layout.rooms) for (let cy = r.y; cy < r.y + r.h; cy += 2) for (let cx = r.x; cx < r.x + r.w; cx += 2) {
    const sx = Math.max(0, Math.min(W - SW, cx - (SW >> 1))), sy = Math.max(0, Math.min(H - SH, cy - (SH >> 1)));
    if (seen.has(sy * W + sx)) continue;
    seen.add(sy * W + sx);
    let v = 0;
    for (let y = sy; y < sy + SH; y += 1) for (let x = sx; x < sx + SW; x += 1) if (!occ[y * W + x]) v += 1;
    worst = Math.max(worst, v / (SW * SH));
  }
  return 1 - n / (W * H) + worst;
}

function layoutOnce(spec: DungeonSpec, inputs: readonly DungeonRoomInput[], salt: number): DungeonLayout {
  const random = rng((spec.seed ?? 7) * 2654435761 + 1 + salt * 7919);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
  const aspect = spec.width && spec.height ? spec.width / spec.height : 1.35;
  const placed: PlacedRoom[] = [];
  const corridors: PlacedCorridor[] = [];
  const layoutNotes: string[] = [];
  const used = new Map<string, Set<DungeonDir>>();
  const ids = new Set<string>();
  const jitter = (base: number, spread: number) => base + Math.floor(random() * (spread * 2 + 1)) - spread;
  const wallStair = spec.entryStair === undefined || spec.entryStair === "up" || spec.entryStair === "door";
  inputs.forEach((input, index) => {
    const kind: DungeonRoomKind = input.kind ?? (index === 0 ? "entrance" : "hall");
    const [dw, dh] = DEFAULT_SIZE[kind];
    const w = clamp(input.w ?? jitter(dw, input.shift !== undefined ? 0 : 2), 6, 40), h = clamp(input.h ?? jitter(dh, input.shift !== undefined ? 0 : 1), 5, 22);
    let id = (input.id ?? `${kind}${index + 1}`).trim() || `${kind}${index + 1}`;
    while (ids.has(id)) id = `${id}_${index + 1}`;
    ids.add(id);
    if (index === 0) {
      placed.push({ id, kind, x: 0, y: 0, w, h, from: null, dir: null, depth: 0, ...(input.shape ? { shape: input.shape } : {}) });
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
    // 입구 방 북벽은 계단·문(바깥 출구) 자리다 — 북쪽 통로가 벽을 가르면 계단 놓을 평평한 벽이 사라졌다(2026-10-23 배치 64판에서 지하 묘지 2층).
    // 방 목록이 북쪽을 직접 바란 경우(신전 현관→본당)만 허용한다.
    const keepNorth = rank >= 0 && parent.kind === "entrance" && parent.depth === 0 && wallStair && input.dir !== "N";
    const dirs = (input.dir ? [input.dir, ...DUNGEON_DIRS.filter((d) => d !== input.dir)] : [...DUNGEON_DIRS]).filter((d) => !taken.has(d) && !(keepNorth && d === "N"));
    for (const dir of dirs) {
      for (const shift of strict && input.shift !== undefined ? [input.shift] : [0, 2, -2, 4, -4, 6, -6, 9, -9]) {
        // 세로 통로는 5칸이 먼저(벽 앞면 3줄 위에 천장 두 줄 — 한 줄이면 두 방 사이 벽이 실선처럼 얇다), 가로 통로는 4칸.
        for (const len of strict && input.len ? [input.len] : dir === "N" || dir === "S" ? [4, 5] : [2, 3, 4]) {
          const attempt = attemptPlace(parent, { id, kind, w, h }, dir, shift, len);
          if (!attempt) continue;
          if (clashes(attempt.room, attempt.corridor, parent.id, placed, corridors)) continue;
          // 점수: 바람 비율에 가까운 작은 바깥 상자 + 시드 흔들기. 주어진 dir 은 크게 앞선다.
          const box = boundsOf([...placed, attempt.room]);
          const ratio = box.w / Math.max(1, box.h);
          let score = box.w * box.h * (1 + Math.abs(Math.log(ratio / aspect)) * 1.6) + random() * 60 + Math.abs(shift) * 3 + Math.abs(len - (dir === "N" || dir === "S" ? 4 : 2)) * 6;
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
    // 둥근 탑 링 방: 링 키트의 남쪽 통로(bd-dg-tower-pass-s)가 가운데 두 칸이다 — 세로 통로를 그 두 칸에 맞춘다.
    if (input.shape === "ring" && chosen.corridor.dir === "N") {
      chosen.corridor = { ...chosen.corridor, rect: { ...chosen.corridor.rect, x: chosen.room.x + Math.floor(chosen.room.w / 2) - 1, w: 2 } };
    }
    used.get(parent.id)!.add(chosen.corridor.dir);
    placed.push({ ...chosen.room, from: parent.id, dir: chosen.corridor.dir, depth: parent.depth + 1, ...(input.shape ? { shape: input.shape } : {}) });
    used.set(id, new Set<DungeonDir>([opposite(chosen.corridor.dir)]));
    corridors.push({ ...chosen.corridor, a: parent.id });
  });
  // 고리 통로: 부모·자식이 아닌 두 방이 나란히 가까우면 하나(큰 층은 둘) 더 잇는다 — 막다른 사슬만 있는 층을 피한다.
  // 배치 가족: linear 는 고리 없음(한 길), loop 는 고리 둘·셋(지름길로 돌아온다), hub 는 바퀴살 사이 하나.
  const fam = spec.rooms?.length ? null : layoutFamilyOf(spec);
  const wantLoops = fam === "linear" ? 0 : fam === "loop" ? (placed.length >= 6 ? 3 : 2) : placed.length >= 7 ? 2 : placed.length >= 4 ? 1 : 0;
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
    if (gap >= 2 && gap <= 8 && free(l, "E") && free(r, "W")) {
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
