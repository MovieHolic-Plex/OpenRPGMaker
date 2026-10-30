// 미궁(미로)도 조수 설계대로(2026-10-30 「미로형 던전이 설계를 무시하는 경로 고치기」).
// 설계의 방(역할·크기·자리·물·높이)을 격자 노드 덩어리로 놓고, 남은 노드를 갈림길 미로로 판다. 입구는 설계한 쪽(남·북·서·동) 바깥에 붙는다.
// 함수가 고르는 것은 미로의 굽이(시드)뿐 — 방 수·자리·입구 쪽은 설계 그대로, 겹치면 가까운 빈 자리로 옮기고 「고침:」으로 알린다.
// 방끼리 잇는 길(links)은 미궁에서는 갈림길이 대신한다: 방마다 문 수 = 그 방에 걸린 길 수(1~3). 보스·보물 방은 막다른 방(문 하나).
import { DungeonComposeError } from "./errors";
import type { DungeonLayout, DungeonSpec, PlacedCorridor, PlacedRoom } from "./types";
import { Grid, rng, type Rect } from "./grid";
import type { GrammarInfo } from "./grammar";
import { KIND, bfsDepth, cropToContent, normalizeDesign, type DungeonDesign, type NRoom } from "./designLayout";

const MARGIN = 2;
const N = 3, PX = 6, PY = 7;
const ENT_W = 11, ENT_H = 6;
const clampI = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

/** 방 크기 → 노드 덩어리(가로×세로). 노드 하나 = 3×3 바닥, 이웃 노드 사이 칸까지 덩어리 바닥이 된다. */
function blockOf(r: NRoom): [number, number] {
  if (r.role === "boss") return r.rx >= 9 ? [4, 3] : [3, 2];
  if (r.rx >= 9) return [4, 3];
  if (r.rx >= 7) return [3, 2];
  if (r.rx >= 5) return [2, 2];
  return r.role === "treasure" ? [1, 1] : [2, 1];
}

export function layoutDesignedMaze(spec: DungeonSpec, profile: GrammarInfo, design: DungeonDesign): DungeonLayout & { grid: Grid } {
  const nd = normalizeDesign(design, profile);
  const fixes = [...nd.fixes];
  const seed = spec.seed ?? 7;
  const random = rng(seed * 2246822519 + 3);
  const rooms = nd.rooms;
  const blocks = rooms.map((r, i) => (i === 0 ? [0, 0] as [number, number] : blockOf(r)));
  // 미로 크기: 방 덩어리 넓이의 약 2.6배를 통로 노드로
  const area = blocks.slice(1).reduce((s, [w, h]) => s + w * h, 0);
  const want = Math.max(30, Math.round(area * 2.6));
  let nx = clampI(Math.sqrt(want * 1.6), 7, 16), ny = clampI(want / nx, 4, 8);
  if (spec.width) nx = clampI((spec.width - 6) / PX + 1, 6, 16);
  if (spec.height) ny = clampI((spec.height - 28) / PY + 2, 3, 8);
  const side = nd.side;
  // ---- 방 덩어리 자리: at → 노드 좌표, 겹치면(덩어리 사이 한 노드 띄움) 가장 가까운 빈 자리 ----
  const taken = new Int16Array(nx * ny).fill(-1);
  const pos: ([number, number] | null)[] = rooms.map(() => null);
  const moved: string[] = [];
  const order = rooms.map((_, i) => i).filter((i) => i > 0).sort((a, b) => Number(rooms[b]!.role === "boss") - Number(rooms[a]!.role === "boss") || blocks[b]![0] * blocks[b]![1] - blocks[a]![0] * blocks[a]![1]);
  for (const i of order) {
    let [bw, bh] = blocks[i]!;
    if (bw > nx - 2) bw = Math.max(1, nx - 2);
    if (bh > ny - 1) bh = Math.max(1, ny - 1);
    blocks[i] = [bw, bh];
    const [ax, ay] = rooms[i]!.at ?? [0.2 + random() * 0.6, 0.2 + random() * 0.6];
    const ti = clampI(ax * (nx - bw), 0, nx - bw), tj = clampI(ay * (ny - bh), 0, ny - bh);
    const fits = (pi: number, pj: number) => {
      if (pi < 0 || pj < 0 || pi + bw > nx || pj + bh > ny) return false;
      for (let j = pj - 1; j <= pj + bh; j += 1) for (let k = pi - 1; k <= pi + bw; k += 1) if (k >= 0 && j >= 0 && k < nx && j < ny && taken[j * nx + k]! >= 0) return false;
      return true;
    };
    let best: [number, number] | null = null; let bd = Infinity;
    for (let pj = 0; pj + bh <= ny; pj += 1) for (let pi = 0; pi + bw <= nx; pi += 1) {
      if (!fits(pi, pj)) continue;
      const d = (pi - ti) ** 2 + (pj - tj) ** 2;
      if (d < bd) { bd = d; best = [pi, pj]; }
    }
    if (!best) { fixes.push(`고침: 미궁에 방 ${rooms[i]!.id} 을 놓을 빈 자리가 없어 뺐다 — 방 수·크기를 줄이면 들어간다.`); continue; }
    if (bd > 2) moved.push(`${rooms[i]!.id} ${Math.round(Math.sqrt(bd))}칸`);
    pos[i] = best;
    for (let j = best[1]; j < best[1] + bh; j += 1) for (let k = best[0]; k < best[0] + bw; k += 1) taken[j * nx + k] = i;
  }
  if (moved.length) fixes.push(`고침: 미궁에서 겹치는 방을 가까운 빈 자리로 옮겼다(노드 단위) — ${moved.join(", ")}.`);
  if (rooms.some((r, i) => i > 0 && r.shape !== "blob")) fixes.push("고침: 미궁의 방은 갈림길 격자 위 네모 방이라 모양(cavern·long·shaft·ring·twin)은 크기로만 옮겼다.");
  // ---- 입구 노드: 설계한 쪽 가장자리, 입구 방 at 에 가까운 곳 ----
  const [eax, eay] = rooms[0]!.at ?? [0.5, 0.5];
  const edgeCands: [number, number][] = [];
  if (side === "south" || side === "north") for (let i = 0; i < nx; i += 1) edgeCands.push([i, side === "south" ? ny - 1 : 0]);
  else for (let j = 0; j < ny; j += 1) edgeCands.push([side === "west" ? 0 : nx - 1, j]);
  const free = (i: number, j: number) => taken[j * nx + i]! < 0;
  const start = edgeCands.filter(([i, j]) => free(i, j)).sort((a, b) => (side === "south" || side === "north" ? Math.abs(a[0] / (nx - 1) - eax) - Math.abs(b[0] / (nx - 1) - eax) : Math.abs(a[1] / (ny - 1) - eay) - Math.abs(b[1] / (ny - 1) - eay)))[0];
  if (!start) throw new DungeonComposeError(`미궁의 ${side} 쪽 가장자리가 방으로 막혀 입구를 붙일 곳이 없다 — 그 쪽 방의 at 을 안쪽으로.`, "layout-failed");
  // ---- 그래프: 빈 노드 + 방 덩어리. 깊이 우선(긴 굽이길), 보스·보물 방은 들어가기만(막다른 방) ----
  const key = (i: number, j: number) => j * nx + i;
  const nodeLinks = new Set<string>();
  const lk = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const doors: { room: number; from: [number, number]; to: [number, number] }[] = [];
  const entered = new Set<number>();
  const dead = (i: number) => rooms[i]!.role === "boss" || rooms[i]!.role === "treasure";
  const wantDoors = rooms.map((_, i) => Math.max(1, Math.min(dead(i) ? 1 : 3, nd.links.filter((l) => l.a === i || l.b === i).length)));
  const nb4 = (i: number, j: number): [number, number][] => ([[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as [number, number][]).filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < ny);
  const blockNbrs = (r: number): { inside: [number, number]; out: [number, number] }[] => {
    const [pi, pj] = pos[r]!, [bw, bh] = blocks[r]!;
    const out: { inside: [number, number]; out: [number, number] }[] = [];
    for (let j = pj; j < pj + bh; j += 1) for (let i = pi; i < pi + bw; i += 1) for (const [a, b] of nb4(i, j)) if (free(a, b)) out.push({ inside: [i, j], out: [a, b] });
    return out;
  };
  const seen = new Set<number>([key(start[0], start[1])]);
  const stack: [number, number][] = [start];
  while (stack.length) {
    const [i, j] = stack[stack.length - 1]!;
    const opts: ({ kind: "node"; to: [number, number] } | { kind: "room"; room: number; inside: [number, number] })[] = [];
    for (const [a, b] of nb4(i, j)) {
      if (free(a, b)) { if (!seen.has(key(a, b))) opts.push({ kind: "node", to: [a, b] }); }
      else { const r = taken[key(a, b)]!; if (!entered.has(r)) opts.push({ kind: "room", room: r, inside: [a, b] }); }
    }
    if (!opts.length) { stack.pop(); continue; }
    const o = opts[Math.floor(random() * opts.length)]!;
    if (o.kind === "node") { nodeLinks.add(lk(key(i, j), key(o.to[0], o.to[1]))); seen.add(key(o.to[0], o.to[1])); stack.push(o.to); continue; }
    entered.add(o.room);
    doors.push({ room: o.room, from: [i, j], to: o.inside });
    if (dead(o.room)) continue;
    // 지나는 방: 덩어리 둘레의 다른 빈 노드로 이어 간다(문 수 = 설계에서 이 방에 걸린 길 수)
    const exits = blockNbrs(o.room).filter((e) => !seen.has(key(e.out[0], e.out[1])));
    for (let k = exits.length - 1; k > 0; k -= 1) { const t = Math.floor(random() * (k + 1)); [exits[k], exits[t]] = [exits[t]!, exits[k]!]; }
    for (const e of exits.slice(0, wantDoors[o.room]! - 1)) {
      if (seen.has(key(e.out[0], e.out[1]))) continue;
      doors.push({ room: o.room, from: e.out, to: e.inside });
      seen.add(key(e.out[0], e.out[1])); stack.push(e.out);
    }
  }
  const lost = rooms.map((_, i) => i).filter((i) => i > 0 && pos[i] && !entered.has(i));
  // 미로에서 닿지 않은 방(다른 방 덩어리에 갇힘): 닿은 노드와 붙은 칸이 있으면 문을 하나 낸다
  for (const r of lost) {
    const e = blockNbrs(r).find((x) => seen.has(key(x.out[0], x.out[1])));
    if (e) { doors.push({ room: r, from: e.out, to: e.inside }); entered.add(r); fixes.push(`고침: 미궁에서 방 ${rooms[r]!.id} 에 들어가는 갈림길이 없어 가까운 길에 문을 냈다.`); }
    else { pos[r] = null; fixes.push(`고침: 미궁에서 방 ${rooms[r]!.id} 이 다른 방에 둘러싸여 닿을 길이 없어 뺐다.`); }
  }
  // 고리: 막다른 길 일부를 이웃 노드와 잇는다
  const degree = (i: number, j: number) => nb4(i, j).filter(([a, b]) => free(a, b) && nodeLinks.has(lk(key(i, j), key(a, b)))).length + doors.filter((d) => d.from[0] === i && d.from[1] === j).length;
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
    if (!free(i, j) || !seen.has(key(i, j)) || degree(i, j) !== 1 || random() > 0.28) continue;
    const cand = nb4(i, j).filter(([a, b]) => free(a, b) && seen.has(key(a, b)) && !nodeLinks.has(lk(key(i, j), key(a, b))));
    if (cand.length) { const [a, b] = cand[Math.floor(random() * cand.length)]!; nodeLinks.add(lk(key(i, j), key(a, b))); }
  }
  // ---- 칠하기 ----
  const padL = side === "west" ? ENT_W + 4 : 0, padT = side === "north" ? ENT_H + 4 : 0, padR = side === "east" ? ENT_W + 4 : 0, padB = side === "south" ? ENT_H + 4 : 0;
  const ox = MARGIN + 1 + padL, oy = MARGIN + 4 + padT;
  const gridW = (nx - 1) * PX + N, gridH = (ny - 1) * PY + N;
  const W = ox + gridW + MARGIN + 1 + padR, H = oy + gridH + MARGIN + 1 + padB;
  const g = new Grid(W, H);
  const nodeRect = (i: number, j: number): Rect => ({ x: ox + i * PX, y: oy + j * PY, w: N, h: N });
  const linkRect = (i: number, j: number, a: number, b: number): Rect => (a !== i
    ? { x: ox + Math.min(i, a) * PX + N, y: oy + j * PY, w: PX - N, h: N }
    : { x: ox + i * PX, y: oy + Math.min(j, b) * PY + N, w: N, h: PY - N });
  const blockRect = (r: number): Rect => { const [pi, pj] = pos[r]!, [bw, bh] = blocks[r]!; return { x: ox + pi * PX, y: oy + pj * PY, w: (bw - 1) * PX + N, h: (bh - 1) * PY + N }; };
  const paint = (r: Rect, room: number) => { for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) { if (!g.inb(x, y)) continue; g.floor[g.idx(x, y)] = 1; g.roomAt[g.idx(x, y)] = room; } };
  for (const k of seen) paint(nodeRect(k % nx, Math.floor(k / nx)), -1);
  for (const l of nodeLinks) { const [ka, kb] = l.split("-").map(Number) as [number, number]; paint(linkRect(ka % nx, Math.floor(ka / nx), kb % nx, Math.floor(kb / nx)), -1); }
  const placedIdx = rooms.map((_, i) => i).filter((i) => i === 0 || pos[i]);
  const roomNo = new Map(placedIdx.map((i, k) => [i, k] as const));
  for (const i of placedIdx) if (i > 0) paint(blockRect(i), roomNo.get(i)!);
  const corridors: PlacedCorridor[] = [];
  const idOf = (i: number) => (i === 0 ? "entrance" : rooms[i]!.role === "boss" ? "boss" : rooms[i]!.role === "treasure" ? "vault" : rooms[i]!.id);
  for (const d of doors) {
    if (!pos[d.room]) continue;
    const rect = linkRect(d.from[0], d.from[1], d.to[0], d.to[1]);
    paint(rect, -1);
    corridors.push({ a: "maze", b: idOf(d.room), dir: d.to[0] !== d.from[0] ? (d.to[0] > d.from[0] ? "E" : "W") : d.to[1] > d.from[1] ? "S" : "N", rect });
  }
  // 입구 방: 설계한 쪽 바깥, 시작 노드와 곧은 길
  const sr = nodeRect(start[0], start[1]);
  let ent: Rect, entLink: Rect;
  if (side === "south") { ent = { x: sr.x + 1 - Math.floor(ENT_W / 2), y: oy + gridH + (PY - N), w: ENT_W, h: ENT_H }; entLink = { x: sr.x, y: oy + gridH, w: N, h: PY - N }; }
  else if (side === "north") { ent = { x: sr.x + 1 - Math.floor(ENT_W / 2), y: MARGIN + 4, w: ENT_W, h: ENT_H }; entLink = { x: sr.x, y: ent.y + ENT_H, w: N, h: oy - (ent.y + ENT_H) }; }
  else if (side === "west") { ent = { x: MARGIN + 1, y: Math.max(MARGIN + 4, sr.y + 1 - Math.floor(ENT_H / 2)), w: ENT_W, h: ENT_H }; entLink = { x: ent.x + ENT_W, y: sr.y, w: ox - (ent.x + ENT_W), h: N }; }
  else { ent = { x: ox + gridW + 4, y: Math.max(MARGIN + 4, sr.y + 1 - Math.floor(ENT_H / 2)), w: ENT_W, h: ENT_H }; entLink = { x: ox + gridW, y: sr.y, w: 4, h: N }; }
  paint(ent, 0); paint(entLink, -1);
  corridors.unshift({ a: "entrance", b: "maze", dir: side === "south" ? "N" : side === "north" ? "S" : side === "west" ? "E" : "W", rect: entLink });
  // 물: 2×2 이상 방의 웅덩이·호수(가장자리 두 칸은 마른 바닥), 물줄기는 웅덩이로
  if (profile.liquid) for (const i of placedIdx) {
    const r = rooms[i]!; if (i === 0 || r.water === "none") continue;
    const [bw, bh] = blocks[i]!;
    if (bw < 2 || bh < 2) { fixes.push(`고침: 미궁 방 ${r.id} 이 작아 물을 두지 않았다.`); continue; }
    if (r.water === "stream") fixes.push(`고침: 미궁 방 ${r.id} 물줄기는 갈림길을 끊어 웅덩이로 지었다.`);
    const b = blockRect(i), cx = b.x + b.w / 2 - 0.5, cy = b.y + b.h / 2 - 0.5, rx = (b.w - 4) / 2 * (r.water === "lake" ? 1 : 0.6), ry = (b.h - 4) / 2 * (r.water === "lake" ? 1 : 0.6);
    for (let y = b.y + 2; y < b.y + b.h - 2; y += 1) for (let x = b.x + 2; x < b.x + b.w - 2; x += 1) if (((x - cx) / Math.max(1, rx)) ** 2 + ((y - cy) / Math.max(1, ry)) ** 2 <= 1) g.liquid[g.idx(x, y)] = 1;
  }
  // ---- 출력 ----
  const depth = bfsDepth(rooms.length, nd.links);
  const placed: PlacedRoom[] = placedIdx.map((i) => {
    const r = rooms[i]!, rect = i === 0 ? ent : blockRect(i);
    return { id: idOf(i), kind: KIND[r.role], ...rect, from: i === 0 ? null : "entrance", dir: null, depth: i === 0 ? 0 : 1 + depth[i]!, ...(r.features.length ? { features: r.features } : {}), ...(r.level ? { level: r.level } : {}) };
  });
  const seenIds = new Set<string>();
  for (const p of placed) { let id = p.id; let k = 2; while (seenIds.has(id)) id = `${p.id}${k++}`; seenIds.add(id); p.id = id; }
  if (!placed.some((p) => p.kind === "boss")) throw new DungeonComposeError("미궁에 보스 방을 놓지 못했다 — 방 수·크기를 줄여라.", "layout-failed");
  return cropToContent({ rooms: placed, corridors, width: W, height: H, notes: fixes, grid: g, entranceSide: side });
}
