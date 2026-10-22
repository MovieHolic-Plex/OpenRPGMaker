// 던전 배치 문법 — 사각 방+통로(compose.layoutDungeon) 말고 마스크 문법 둘과 액체 파기(2026-10-14 던전 종류 확장).
//   · layoutMaze  : 격자 노드 + 갈림길 미로(깊이 우선 + 고리), 막다른 길 보물·위쪽 보스 방·아래 입구 방
//   · layoutBlob  : 불규칙한 동굴 방(타원+잡음) + 굽은 넓은 통로 + 호수(액체) — 동굴·화산
//   · carveSewer  : 사각 방 배치 위에 수로·저수조를 판다(양옆 보행로가 남는다)
// 모두 Grid(바닥·방 번호·액체·다리)를 만들고, 벽 두께 규칙·연결은 grid.settle 이 고정점까지 맞춘다.
import { DungeonComposeError } from "./errors";
import type { DungeonLayout, DungeonRoomKind, DungeonSpec, PlacedCorridor, PlacedRoom } from "./types";
import { Grid, carveDisc, edgeDistance, rng, smooth, vnoise, type Rect } from "./grid";
import type { GrammarInfo } from "./grammar";

const MARGIN = 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

const sizeIndex = (spec: DungeonSpec): number => {
  const area = spec.width && spec.height ? spec.width * spec.height : 0;
  if (area) return area < 2400 ? 0 : area < 4800 ? 1 : 2;
  return spec.size === "small" ? 0 : spec.size === "large" ? 2 : 1;
};

// ---------------------------------------------------------------- 미궁(미로)

/**
 * thin = true 는 「얇은 칸막이 미로」(몬스터 키트의 유적 돌담 ru_pb 용): 통로 폭 2·칸막이 1칸. 벽 앞면 3줄·천장 띠가 필요 없어 위 여백도 줄인다.
 * 기본(thin = false)은 버들항용 폭 3 통로 + 두꺼운 벽이며 출력은 이전과 같다.
 */
export function layoutMaze(spec: DungeonSpec, thin = false): DungeonLayout & { grid: Grid } {
  const seed = spec.seed ?? 7;
  const random = rng(seed * 2654435761 + 11);
  const si = sizeIndex(spec);
  const N = thin ? 2 : 3;                                // 노드(통로) 폭
  const nx = thin ? (spec.width ? clamp((spec.width - 4) / 3, 6, 20) : [7, 10, 14][si]!) : spec.width ? clamp((spec.width - 6) / 6 + 1, 6, 16) : [6, 8, 11][si]!;
  const ny = thin ? (spec.height ? clamp((spec.height - 8) / 3, 5, 14) : [5, 7, 9][si]!) : spec.height ? clamp((spec.height - 28) / 7 + 2, 3, 6) : [3, 4, 5][si]!;
  const PX = thin ? 3 : 6, PY = thin ? 3 : 7;
  const ox = MARGIN + 1, oy = MARGIN + (thin ? 2 : 4);
  const mazeBottom = oy + (ny - 1) * PY + N;            // 마지막 노드 줄 바닥 아래 경계(배타)
  const ENT_W = thin ? 9 : 11, ENT_H = thin ? 5 : 6;
  const entY = mazeBottom + (PY - N);
  const W = ox + (nx - 1) * PX + N + MARGIN + 1;
  const H = entY + ENT_H + MARGIN + 1;
  const g = new Grid(W, H);

  // 보스 방 = 노드 3×2 덩어리(위쪽 두 줄)
  const bx = 1 + Math.floor(random() * Math.max(1, nx - 4));
  const inRegion = (i: number, j: number) => i >= bx && i < bx + 3 && j >= 0 && j < 2;
  const key = (i: number, j: number) => j * nx + i;
  const links = new Set<string>();
  const lk = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const neighbors = (i: number, j: number): [number, number][] => ([[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as [number, number][])
    .filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < ny && !inRegion(a, b));
  const startI = Math.floor(nx / 2), startJ = ny - 1;
  // 깊이 우선(긴 굽이길)
  const seen = new Set<number>([key(startI, startJ)]);
  const stack: [number, number][] = [[startI, startJ]];
  while (stack.length) {
    const [i, j] = stack[stack.length - 1]!;
    const next = neighbors(i, j).filter(([a, b]) => !seen.has(key(a, b)));
    if (!next.length) { stack.pop(); continue; }
    const [a, b] = next[Math.floor(random() * next.length)]!;
    links.add(lk(key(i, j), key(a, b))); seen.add(key(a, b)); stack.push([a, b]);
  }
  // 고리: 막다른 길 일부를 이웃에 잇는다
  const degree = (i: number, j: number) => neighbors(i, j).filter(([a, b]) => links.has(lk(key(i, j), key(a, b)))).length;
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
    if (inRegion(i, j) || degree(i, j) !== 1 || random() > 0.28) continue;
    const cand = neighbors(i, j).filter(([a, b]) => !links.has(lk(key(i, j), key(a, b))));
    if (cand.length) { const [a, b] = cand[Math.floor(random() * cand.length)]!; links.add(lk(key(i, j), key(a, b))); }
  }
  // 입구에서 거리
  const dist = new Map<number, number>([[key(startI, startJ), 0]]);
  const queue: [number, number][] = [[startI, startJ]];
  for (let qi = 0; qi < queue.length; qi += 1) {
    const [i, j] = queue[qi]!;
    for (const [a, b] of neighbors(i, j)) if (links.has(lk(key(i, j), key(a, b))) && !dist.has(key(a, b))) { dist.set(key(a, b), dist.get(key(i, j))! + 1); queue.push([a, b]); }
  }
  // 보스 방 붙일 곳: 보스 덩어리와 이웃한 노드 중 입구에서 가장 먼 것
  let bossLink: { from: [number, number]; to: [number, number] } | null = null;
  let bestD = -1;
  for (let j = 0; j < 2; j += 1) for (let i = bx; i < bx + 3; i += 1) {
    for (const [a, b] of ([[i + 1, j], [i - 1, j], [i, j + 1]] as [number, number][])) {
      if (a < 0 || b < 0 || a >= nx || b >= ny || inRegion(a, b)) continue;
      const d = dist.get(key(a, b)) ?? -1;
      if (d > bestD || (d === bestD && random() < 0.5)) { bestD = d; bossLink = { from: [a, b], to: [i, j] }; }
    }
  }
  if (!bossLink) throw new DungeonComposeError("미궁 보스 방을 붙일 자리가 없다 — 미궁이 너무 작다.", "layout-failed");
  // 보물 방: 막다른 길 중 입구에서 가장 먼 노드(보스 연결 노드 제외)
  let vault: [number, number] | null = null; let vd = -1;
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
    if (inRegion(i, j) || (i === bossLink.from[0] && j === bossLink.from[1]) || (i === startI && j === startJ)) continue;
    if (degree(i, j) !== 1) continue;
    const d = dist.get(key(i, j)) ?? -1;
    if (d > vd) { vd = d; vault = [i, j]; }
  }

  // ---- 칠하기 ----
  const nodeRect = (i: number, j: number): Rect => ({ x: ox + i * PX, y: oy + j * PY, w: N, h: N });
  const linkRect = (i: number, j: number, a: number, b: number): Rect => (a !== i
    ? { x: ox + Math.min(i, a) * PX + N, y: oy + j * PY, w: PX - N, h: N }
    : { x: ox + i * PX, y: oy + Math.min(j, b) * PY + N, w: N, h: PY - N });
  const rooms: PlacedRoom[] = [];
  const corridors: PlacedCorridor[] = [];
  // 방 0 = 입구(아래), 1 = 보스, 2 = 보물
  const entX = nodeRect(startI, startJ).x + Math.floor(N / 2) - Math.floor(ENT_W / 2);
  const entrance: PlacedRoom = { id: "entrance", kind: "entrance", x: entX, y: entY, w: ENT_W, h: ENT_H, from: null, dir: null, depth: 0 };
  const region: Rect = { x: ox + bx * PX, y: oy, w: 2 * PX + N, h: PY + N };
  const boss: PlacedRoom = { id: "boss", kind: "boss", ...region, from: "entrance", dir: "N", depth: 1 + bestD };
  rooms.push(entrance, boss);
  if (vault) rooms.push({ id: "vault", kind: "vault", ...nodeRect(vault[0], vault[1]), from: "entrance", dir: "N", depth: 1 + vd });
  const paint = (r: Rect, room: number) => { for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) { g.floor[g.idx(x, y)] = 1; g.roomAt[g.idx(x, y)] = room; } };
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) if (!inRegion(i, j)) paint(nodeRect(i, j), -1);
  for (const l of links) {
    const [ka, kb] = l.split("-").map(Number) as [number, number];
    const i = ka % nx, j = Math.floor(ka / nx), a = kb % nx, b = Math.floor(kb / nx);
    paint(linkRect(i, j, a, b), -1);
  }
  paint(region, 1);
  if (vault) paint(nodeRect(vault[0], vault[1]), 2);
  paint(entrance, 0);
  const entLink: Rect = { x: nodeRect(startI, startJ).x, y: mazeBottom, w: N, h: PY - N };
  paint(entLink, -1);
  corridors.push({ a: "entrance", b: "maze", dir: "N", rect: entLink });
  // 보스 연결
  const [fi, fj] = bossLink.from, [ti, tj] = bossLink.to;
  const bl = linkRect(fi, fj, ti, tj);
  // 보스 덩어리 안쪽 칸은 이미 칠했다 — 연결 칸만 칠하면 된다
  paint(bl, -1);
  corridors.push({ a: "maze", b: "boss", dir: ti !== fi ? (ti > fi ? "E" : "W") : "N", rect: bl });
  if (vault) {
    const near = neighbors(vault[0], vault[1]).find(([a, b]) => links.has(lk(key(vault![0], vault![1]), key(a, b))));
    if (near) corridors.push({ a: "maze", b: "vault", dir: near[0] !== vault[0] ? (near[0] > vault[0] ? "W" : "E") : "S", rect: linkRect(vault[0], vault[1], near[0], near[1]) });
  }
  return { rooms, corridors, width: W, height: H, notes: [], grid: g, ...(thin ? { thin: true } : {}) };
}

// ---------------------------------------------------------------- 동굴·화산(불규칙)

interface Chamber { cx: number; cy: number; rx: number; ry: number; kind: DungeonRoomKind; index: number }

/**
 * 동굴·화산: 방 덩이를 여러 번 흔들어 놓고, 잘라 낸 맵에서 허공(바닥·벽 앞면이 아닌 칸)이 가장 적은 판을 고른다(2026-10-23 assistant-dungeons-2).
 * 한 판만 놓으면 방이 상자 안에 흩어져 잘라도 맵의 55~60%가 검은 허공이었다.
 */
export function layoutBlob(spec: DungeonSpec, profile: GrammarInfo): DungeonLayout & { grid: Grid } {
  let best: { layout: DungeonLayout & { grid: Grid }; score: number } | null = null;
  let lastError: unknown = null;
  for (let salt = 0; salt < 32; salt += 1) {
    let layout: DungeonLayout & { grid: Grid };
    try { layout = layoutBlobOnce(spec, profile, salt); } catch (error) { lastError = error; continue; }
    const score = blobVoidScore(layout.grid);
    if (!best || score < best.score - 1e-9) best = { layout, score };
  }
  if (!best) throw lastError;
  return best.layout;
}

/**
 * 덩이 판 점수(작을수록 좋다): 잘라 낸 판(바닥 상자+둘레 2칸) 안의 허공 비율 + 플레이어 카메라(20×15) 창 중 가장 나쁜 허공 비율의 절반.
 * 전체 판 비율만 보면 잘라 낸 뒤 한 구석이 90% 허공인 판을 골랐다(2026-10-23 dg2-r1 고블린 굴) — 실제로 보이는 창을 같이 잰다.
 */
function blobVoidScore(g: Grid): number {
  let x0 = g.W, y0 = g.H, x1 = -1, y1 = -1;
  for (let y = 0; y < g.H; y += 1) for (let x = 0; x < g.W; x += 1) if (g.floor[g.idx(x, y)]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return 1;
  x0 = Math.max(0, x0 - 2); x1 = Math.min(g.W - 1, x1 + 2); y0 = Math.max(0, y0 - 5); y1 = Math.min(g.H - 1, y1 + 2);
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const used = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const gx = x + x0, gy = y + y0;
    // 바닥, 그 위 벽 앞면 3줄, 바닥에 닿는 테두리는 허공이 아니다
    let u = 0;
    for (let dy = -1; dy <= 3 && !u; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (dy <= 1 || dx === 0) { const X = gx + dx, Y = gy + dy; if (g.inb(X, Y) && g.floor[g.idx(X, Y)]) { u = 1; break; } }
    }
    used[y * W + x] = u;
  }
  let voids = 0;
  for (let i = 0; i < used.length; i += 1) if (!used[i]) voids += 1;
  const SW = Math.min(20, W), SH = Math.min(15, H);
  let worst = 0;
  const seen = new Set<number>();
  for (let cy = 0; cy < H; cy += 2) for (let cx = 0; cx < W; cx += 2) {
    if (!g.floor[g.idx(cx + x0, cy + y0)]) continue;
    const sx = Math.max(0, Math.min(W - SW, cx - (SW >> 1))), sy = Math.max(0, Math.min(H - SH, cy - (SH >> 1)));
    if (seen.has(sy * W + sx)) continue;
    seen.add(sy * W + sx);
    let v = 0;
    for (let y = sy; y < sy + SH; y += 1) for (let x = sx; x < sx + SW; x += 1) if (!used[y * W + x]) v += 1;
    worst = Math.max(worst, v / (SW * SH));
  }
  return voids / (W * H) + worst;
}

function layoutBlobOnce(spec: DungeonSpec, profile: GrammarInfo, salt: number): DungeonLayout & { grid: Grid } {
  const seed = spec.seed ?? 7;
  const random = rng(seed * 40503 + 17 + salt * 7717);
  const si = sizeIndex(spec);
  const [dw, dh] = [[56, 44], [88, 62], [112, 78]][si]! as [number, number];   // small 은 방 3개짜리 작은 굴(2026-10-22 「작은 동굴」이 64×49 로 나오던 것)
  const W = spec.width ? clamp(spec.width, 48, 200) : dw;
  const H = spec.height ? clamp(spec.height, 40, 150) : dh;
  const g = new Grid(W, H);
  const wantN = spec.roomCount ? clamp(spec.roomCount, 2, 14) : spec.width && spec.height ? clamp((W * H) / 640, 4, 14) : [3, 7, 10][si]!;
  const ENT_W = 13, ENT_H = 6;
  const entX = Math.floor(W / 2) - 6, entY = H - MARGIN - 1 - ENT_H;
  const entrance: Rect = { x: entX, y: entY, w: ENT_W, h: ENT_H };

  // ---- 방 자리(타원) ----
  const chambers: Chamber[] = [];
  const yLo = MARGIN + 6, yHi = entY + 2;
  // 덩이로 모은다: 새 방은 이미 놓은 방(첫 방은 입구 굴) 곁에 2~5칸 틈을 두고 붙는다 — 상자 안 아무 데나 흩으면 방 사이가 검은 허공이었다.
  const seedNode = { cx: entX + 6, cy: entY - 4, rx: 4, ry: 3 };
  // 방마다 후보 자리 여럿 중 덩이 바깥 상자가 가장 덜 커지는 자리를 고른다(방+통로 문법의 점수와 같은 생각) — 한 자리만 뽑으면 덩이가 사방으로 뻗어
  // 한 화면이 90% 허공인 구석이 생겼다(2026-10-23 dg2-r1 고블린 굴).
  const box = () => {
    let x0 = entX, x1 = entX + ENT_W, y0 = entY, y1 = entY + ENT_H;
    for (const c of chambers) { x0 = Math.min(x0, c.cx - c.rx); x1 = Math.max(x1, c.cx + c.rx); y0 = Math.min(y0, c.cy - c.ry - 4); y1 = Math.max(y1, c.cy + c.ry); }
    return { x0, x1, y0, y1 };
  };
  for (let round = 0; round < 40 && chambers.length < wantN; round += 1) {
    const rx = 5 + Math.floor(random() * 4);
    const ry = Math.max(4, Math.round(rx * (0.62 + random() * 0.22)));
    let best: { cx: number; cy: number; score: number } | null = null;
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const pool = chambers.length ? chambers : [seedNode];
      const a = pool[Math.floor(random() * pool.length)]!;
      const th = chambers.length ? random() * Math.PI * 2 : -Math.PI * (0.2 + random() * 0.6);
      const gap = 1 + random() * 2.5;
      const cx = Math.round(a.cx + Math.cos(th) * (a.rx + rx + gap));
      const cy = Math.round(a.cy + Math.sin(th) * (a.ry + ry + gap + 1));
      if (cx - rx < MARGIN + 3 || cx + rx > W - MARGIN - 4 || cy - ry < yLo) continue;
      if (cy + ry > yHi + 2) continue;
      if (chambers.some((c) => ((cx - c.cx) / (rx + c.rx + 1.5)) ** 2 + ((cy - c.cy) / (ry + c.ry + 2.5)) ** 2 < 1)) continue;
      if (((cx - (entX + 6)) / (rx + 9)) ** 2 + ((cy - (entY + 2)) / (ry + 8)) ** 2 < 1) continue;
      const b = box();
      const area = (Math.max(b.x1, cx + rx) - Math.min(b.x0, cx - rx)) * (Math.max(b.y1, cy + ry) - Math.min(b.y0, cy - ry - 4));
      const score = area + random() * 30;
      if (!best || score < best.score) best = { cx, cy, score };
    }
    if (best) chambers.push({ cx: best.cx, cy: best.cy, rx, ry, kind: "cavern", index: chambers.length + 1 });
  }
  if (chambers.length < 2) throw new DungeonComposeError("동굴 방을 놓을 자리가 없다 — 맵 크기를 키워라.", "layout-failed");
  // ---- 연결: 입구 → 가장 가까운 방 → 최소 신장 트리(+ 고리) ----
  const ent = { cx: entX + 6, cy: entY - 4 };
  type Node = { cx: number; cy: number; ci: number };
  const nodes: Node[] = [{ cx: ent.cx, cy: ent.cy, ci: -1 }, ...chambers.map((c, ci) => ({ cx: c.cx, cy: c.cy, ci }))];
  const inTree = new Set<number>([0]);
  const edges: [number, number][] = [];
  while (inTree.size < nodes.length) {
    let best: [number, number] | null = null; let bd = Infinity;
    for (const a of inTree) for (let b = 0; b < nodes.length; b += 1) {
      if (inTree.has(b)) continue;
      const d = Math.hypot(nodes[a]!.cx - nodes[b]!.cx, (nodes[a]!.cy - nodes[b]!.cy) * 1.4);
      if (d < bd) { bd = d; best = [a, b]; }
    }
    if (!best) break;
    edges.push(best); inTree.add(best[1]);
  }
  const depth = new Array<number>(nodes.length).fill(0);
  for (const [a, b] of edges) depth[b] = depth[a]! + 1;
  const wantLoops = chambers.length >= 8 ? 2 : chambers.length >= 5 ? 1 : 0;
  let loops = 0;
  const loopPairs: [number, number][] = [];
  for (let a = 1; a < nodes.length; a += 1) for (let b = a + 1; b < nodes.length; b += 1) if (!edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) loopPairs.push([a, b]);
  loopPairs.sort((p, q) => Math.hypot(nodes[p[0]]!.cx - nodes[p[1]]!.cx, nodes[p[0]]!.cy - nodes[p[1]]!.cy) - Math.hypot(nodes[q[0]]!.cx - nodes[q[1]]!.cx, nodes[q[0]]!.cy - nodes[q[1]]!.cy));
  for (const [a, b] of loopPairs) { if (loops >= wantLoops) break; if (depth[a]! >= 1 && Math.abs(depth[a]! - depth[b]!) >= 1) { edges.push([a, b]); loops += 1; } }

  // ---- 역할 ----
  const byDepth = [...chambers].sort((a, b) => depth[b.index]! - depth[a.index]!);
  const boss = byDepth[0]!;
  boss.kind = "boss"; boss.rx = Math.max(boss.rx, 7); boss.ry = Math.max(boss.ry, 5);   // 8×6 반지름은 제단 하나 말고 맨바닥인 큰 방이었다(2026-10-23 dg2-r1 VQA)
  const vault = spec.vault === false ? undefined : byDepth.find((c) => c !== boss && edges.filter(([a, b]) => a === c.index || b === c.index).length <= 1) ?? byDepth[1];
  if (vault && vault !== boss) { vault.kind = "vault"; vault.rx = Math.min(vault.rx, 6); vault.ry = Math.min(vault.ry, 5); }
  const rest = chambers.filter((c) => c.kind === "cavern");
  // 소굴(lair)은 사는 굴이라 호수 대신 마른 바닥(야영지)을 남긴다.
  const lakeWant = profile.liquid && !spec.lair ? (profile.id === "volcano" ? (si === 2 ? 2 : 1) : si === 0 ? 1 : si === 1 ? 2 : 3) : 0;
  // 작은 판에서 반지름 6 이상 방이 하나도 없어도 액체 종류(화산·동굴)는 못이 하나는 있어야 한다 — 그 땐 가장 큰 방을 쓴다.
  const bySize = [...rest].sort((a, b) => b.rx * b.ry - a.rx * a.ry);
  const lakeCands = bySize.filter((c) => c.rx >= 6).length ? bySize.filter((c) => c.rx >= 6) : bySize;
  // 화산 용암 못은 한 단 작게(10×7 둘이 붙어 맵 가운데가 용암 한 덩이가 됐다 — 2026-10-23), 그 사이를 흐르는 줄기가 잇는다.
  const lakeR = profile.id === "volcano" ? [8, 6] : [10, 7];
  for (const c of lakeCands.slice(0, lakeWant)) { c.kind = "lake"; c.rx = Math.max(c.rx, lakeR[0]!); c.ry = Math.max(c.ry, lakeR[1]!); }
  const others = rest.filter((c) => c.kind === "cavern");
  if (profile.id === "volcano" && others[0]) others[0].kind = "forge";
  others.filter((c) => c.kind === "cavern").forEach((c, i) => { if (i % 2 === 1) c.kind = "grotto"; });

  // ---- 칠하기: 통로 먼저, 방은 그 위 ----
  const stubTop = entY - 4;
  for (let y = stubTop; y < entY; y += 1) for (let x = entX + 5; x < entX + 8; x += 1) { g.floor[g.idx(x, y)] = 1; }
  const passage = (a: Node, b: Node) => {
    const len = Math.hypot(b.cx - a.cx, b.cy - a.cy);
    const steps = Math.ceil(len * 1.5);
    const nxv = -(b.cy - a.cy) / len, nyv = (b.cx - a.cx) / len;
    const amp = Math.min(7, len * 0.22);
    const phase = random() * 100;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const wob = (vnoise(t * len, phase, 6, seed) - 0.5) * 2 * amp * Math.sin(Math.PI * t);
      const x = a.cx + (b.cx - a.cx) * t + nxv * wob, y = a.cy + (b.cy - a.cy) * t + nyv * wob;
      carveDisc(g, x, y, 1.6 + vnoise(x, y, 5, seed + 3) * 0.9, -1);
    }
  };
  for (const [a, b] of edges) passage(nodes[a]!, nodes[b]!);
  chambers.forEach((c) => {
    for (let y = c.cy - c.ry - 2; y <= c.cy + c.ry + 2; y += 1) for (let x = c.cx - c.rx - 2; x <= c.cx + c.rx + 2; x += 1) {
      if (!g.inb(x, y) || y < MARGIN + 4 || x < MARGIN || x >= W - MARGIN || y >= H - MARGIN) continue;
      const d = ((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2;
      const wob = (vnoise(x, y, 4.5, seed + c.index * 13) - 0.5) * 0.85;
      if (d < 1 + wob) { g.floor[g.idx(x, y)] = 1; g.roomAt[g.idx(x, y)] = c.index; }
    }
  });
  // 입구 굴: 자연 동굴이라 네모가 아니다 — 가운데 심(위쪽 가운데 줄·통로 목)은 남기고 둘레를 잡음 타원으로 깎는다.
  {
    const ecx = entX + (ENT_W - 1) / 2, ecy = entY + (ENT_H - 1) / 2;
    for (let y = entY - 1; y < entY + ENT_H + 1; y += 1) for (let x = entX - 1; x < entX + ENT_W + 1; x += 1) {
      const core = Math.abs(x - ecx) <= 3 && y >= entY && y < entY + ENT_H - 1;
      const d = ((x - ecx) / (ENT_W / 2 + 0.6)) ** 2 + ((y - ecy) / (ENT_H / 2 + 0.6)) ** 2;
      if (core || d < 1 + (vnoise(x, y, 3.5, seed + 991) - 0.5) * 0.6) { g.floor[g.idx(x, y)] = 1; g.roomAt[g.idx(x, y)] = 0; }
    }
  }
  // 가장자리 안쪽으로 강제
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (x < MARGIN || y < MARGIN + 4 || x >= W - MARGIN || y >= H - MARGIN) { g.floor[g.idx(x, y)] = 0; g.roomAt[g.idx(x, y)] = -1; }
  smooth(g, 2, (x, y) => x >= entX - 2 && x < entX + ENT_W + 2 && y >= stubTop - 1 && y < entY + ENT_H + 2);
  // 입구 굴 북쪽 벽(계단·출구 자리)은 지킨다: 옆 방이 입구 곁까지 내려오면(허공을 줄이려고 허용) 옆으로 가는 통로가 이 벽을 뚫어
  // 계단 놓을 평평한 벽이 사라졌다. 목(stub) 세 칸만 뚫린 채로 둔다.
  for (let y = entY - 4; y < entY - 1; y += 1) for (let x = entX - 1; x < entX + ENT_W + 1; x += 1) {
    if (x >= entX + 5 && x < entX + 8) continue;
    g.floor[g.idx(x, y)] = 0; g.roomAt[g.idx(x, y)] = -1;
  }
  fillWallIslands(g, 30);

  // ---- 액체(호수·용암 못): 방 안쪽, 가장자리 두 칸은 걸을 수 있게 ----
  if (profile.liquid) {
    const ed = edgeDistance(g, 7);
    for (const c of chambers) {
      if (c.kind !== "lake") continue;
      let count = 0;
      for (let y = c.cy - c.ry; y <= c.cy + c.ry; y += 1) for (let x = c.cx - c.rx; x <= c.cx + c.rx; x += 1) {
        if (!g.inb(x, y) || g.roomAt[g.idx(x, y)] !== c.index) continue;
        if (ed[g.idx(x, y)]! < 2) continue;
        if (profile.liquid === "lava") {
          // 용암 못은 흔들리는 타원 덩이(흔들림 ≤0.15) — 방 바닥을 가장자리 2칸만 남기고 다 채우면 둥근 네모 「용암 도장」으로 읽혔다(2026-10-23 dg2-r1 VQA).
          const d = ((x - c.cx) / Math.max(2.5, c.rx - 1.5)) ** 2 + ((y - c.cy) / Math.max(2, c.ry - 1.2)) ** 2;
          if (d > 1 + (vnoise(x, y, 2.5, seed + c.index * 7) - 0.5) * 0.3) continue;
        } else if (vnoise(x, y, 5, seed + c.index * 7) < 0.22) continue;
        g.liquid[g.idx(x, y)] = 1; count += 1;
      }
      if (!count) c.kind = "cavern";
    }
    // 큰 방에 작은 못 하나씩(화산은 용암 웅덩이가 더 많다)
    // 화산은 작은 웅덩이를 두지 않는다 — 용암 못·줄기로 충분하고, 작은 웅덩이는 가장자리 그림이 없어 「네모 용암 도장」으로 읽혔다(2026-10-23 dg2-r1 VQA).
    const pools = profile.id === "volcano" ? 0 : spec.lair ? 0 : 0.3;
    for (const c of chambers) {
      if (c.kind !== "cavern" && c.kind !== "grotto") continue;
      if (c.rx < 6 || random() > pools) continue;
      const cells: number[] = [];
      for (let y = c.cy - 2; y <= c.cy + 2; y += 1) for (let x = c.cx - 3; x <= c.cx + 3; x += 1) {
        if (!g.inb(x, y) || g.roomAt[g.idx(x, y)] !== c.index || ed[g.idx(x, y)]! < 3) continue;
        if (((x - c.cx) / 3) ** 2 + ((y - c.cy) / 2) ** 2 + (vnoise(x, y, 3, seed + c.index) - 0.5) * 0.3 < 1) cells.push(g.idx(x, y));
      }
      // 너무 작은 웅덩이(2×1 같은 네모 조각)는 두지 않는다 — 「사각 용암 칸」으로 읽혔다(2026-10-23).
      if (cells.length >= 10) for (const i of cells) g.liquid[i] = 1;
    }
    // 용암 못 가장자리가 계단처럼 각져 보이던 것을 다듬는다(용암은 가장자리 그림이 없어 모양이 곧 가장자리다): 이웃 8칸 다수결 두 번. 물(호수)은 운하 오토타일이 테두리를 그리니 건드리지 않는다.
    if (profile.liquid === "lava") for (let pass = 0; pass < 2; pass += 1) {
      const next = g.liquid.slice();
      for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
        const i = g.idx(x, y);
        if (!g.floor[i] || ed[i]! < 2) continue;
        let n = 0; for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((dx || dy) && g.liquid[g.idx(x + dx, y + dy)]) n += 1;
        if (g.liquid[i] && n <= 3) next[i] = 0; else if (!g.liquid[i] && n >= 5) next[i] = 1;
      }
      g.liquid.set(next);
    }
    // 흐르는 용암(2026-10-22 VQA 「흐르는 용암인데 고인 못 셋뿐」): 용암 못에서 가장 먼 일반 방까지 굽이치는 폭 2 용암 줄기를 판다.
    // 통로를 가로지르면 settle 이 가장 짧은 곳에 다리를 놓는다. 입구 방·보스방·보물 방·문 앞은 건드리지 않는다.
    if (profile.id === "volcano") {
      const ban = new Set(chambers.filter((c) => c.kind === "boss" || c.kind === "vault").map((c) => c.index));
      const lakes = chambers.filter((c) => c.kind === "lake");
      const plain = chambers.filter((c) => c.kind === "cavern" || c.kind === "grotto" || c.kind === "lake");
      /** a→b 줄기: 금지 방·입구를 피해 바닥을 따라가는 최단 길(BFS) — 방 안(가장자리 2칸 안쪽)은 폭 2, 통로는 폭 1(settle 이 다리를 놓는다). */
      const tryStream = (a: Chamber, b: Chamber): boolean => {
        const s0 = g.idx(a.cx, a.cy), t0 = g.idx(b.cx, b.cy);
        const okCell = (i: number) => g.floor[i] && g.roomAt[i] !== 0 && !ban.has(g.roomAt[i]!) && ((i / g.W) | 0) < entY - 6;
        if (!okCell(s0) || !okCell(t0)) return false;
        // 가중 최단 길(칸 비용 1~4, 잡음): 그냥 BFS 는 자로 그은 직선 줄기가 됐다(2026-10-23 VQA). 비용 바구니 큐로 굽이치게 한다.
        const prev = new Int32Array(g.W * g.H).fill(-2); prev[s0] = -1;
        const dist = new Int32Array(g.W * g.H).fill(1 << 30); dist[s0] = 0;
        const buckets: number[][] = [[s0]];
        for (let d = 0; d < buckets.length && prev[t0] === -2; d += 1) {
          for (const c of buckets[d] ?? []) {
            if (dist[c] !== d) continue;
            const x = c % g.W, y = (c / g.W) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
              if (!g.inb(x + dx, y + dy)) continue;
              const n = g.idx(x + dx, y + dy);
              if (!okCell(n)) continue;
              const nd = d + 1 + Math.floor(vnoise(x + dx, y + dy, 2.5, seed + 77) * 9);
              if (nd >= dist[n]!) continue;
              dist[n] = nd; prev[n] = c; (buckets[nd] ??= []).push(n);
            }
          }
        }
        if (prev[t0] === -2) return false;
        const path: number[] = [];
        for (let c = t0; c >= 0; c = prev[c]!) path.push(c);
        if (path.length < 10) return false;
        // 못 안을 지나는 줄기는 보이지 않는다 — 새로 용암이 되는 칸이 8칸 이상인 줄기만 쓴다(2026-10-23: 붙은 못 둘 사이 줄기가 못에 묻혔다).
        if (path.filter((c) => !g.liquid[c]).length < 8) return false;
        for (const c of path) {
          g.liquid[c] = 1;   // 좁은 목에서 길이 끊기면 settle 이 다리를 놓는다
          if (ed[c]! >= 2 && g.roomAt[c]! > 0) { const r = c + 1; if (ed[r]! >= 2) g.liquid[r] = 1; }
        }
        return true;
      };
      const pairs: [Chamber, Chamber][] = [];
      for (const a of lakes.length ? lakes : plain) for (const b of plain) if (a !== b) pairs.push([a, b]);
      // 못끼리 먼저, 그다음 먼 방부터 — 가까운 방을 고르면 줄기가 못 가장자리에 묻혀 보이지 않았다(2026-10-23).
      pairs.sort((p, q) => Number(q[1].kind === "lake") - Number(p[1].kind === "lake") || Math.hypot(q[1].cx - q[0].cx, q[1].cy - q[0].cy) - Math.hypot(p[1].cx - p[0].cx, p[1].cy - p[0].cy));
      // 줄기 둘(작은 판은 하나): 못에서 먼 방들로 흘러 나간다.
      let streams = 0;
      for (const [a, b] of pairs) { if (streams >= (si === 0 ? 1 : 2)) break; if (tryStream(a, b)) streams += 1; }
    }
  }
  // 문 앞 칸은 액체가 아니다
  const rooms: PlacedRoom[] = [{ id: "entrance", kind: "entrance", ...entrance, from: null, dir: null, depth: 0 }];
  const kindCount: Partial<Record<DungeonRoomKind, number>> = {};
  const idOf = new Map<number, string>();
  for (const c of chambers) {
    kindCount[c.kind] = (kindCount[c.kind] ?? 0) + 1;
    const id = c.kind === "boss" ? "boss" : c.kind === "vault" ? "vault" : `${c.kind}${kindCount[c.kind]}`;
    idOf.set(c.index, id);
  }
  for (const c of chambers) {
    // 부모 = 트리에서 이 방으로 들어오는 간선의 앞쪽
    const e = edges.find(([, b]) => b === c.index);
    const from = e ? (e[0] === 0 ? "entrance" : idOf.get(e[0])!) : "entrance";
    rooms.push({ id: idOf.get(c.index)!, kind: c.kind, x: c.cx - c.rx, y: c.cy - c.ry, w: c.rx * 2 + 1, h: c.ry * 2 + 1, from, dir: null, depth: depth[c.index]! });
  }
  const corridors: PlacedCorridor[] = [{ a: "entrance", b: "cave", dir: "N", rect: { x: entX + 5, y: stubTop, w: 3, h: 4 } }];
  return cropToContent({ rooms, corridors, width: W, height: H, notes: [], grid: g });
}

/** 열린 칸 둘레로 맵을 줄인다 — 동굴은 정해진 상자 안에 흩어 놓으므로 빈 허공이 크다. 위쪽은 벽 앞면 3줄 + 천장 띠 + 여백이 남게. */
function cropToContent(layout: DungeonLayout & { grid: Grid }): DungeonLayout & { grid: Grid } {
  const g = layout.grid;
  let x0 = g.W, y0 = g.H, x1 = -1, y1 = -1;
  for (let y = 0; y < g.H; y += 1) for (let x = 0; x < g.W; x += 1) if (g.floor[g.idx(x, y)]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return layout;
  const nx0 = Math.max(0, x0 - MARGIN - 1), ny0 = y0 - (MARGIN + 4), nx1 = Math.min(g.W - 1, x1 + MARGIN + 1), ny1 = Math.min(g.H - 1, y1 + MARGIN + 1);
  const W = nx1 - nx0 + 1, H = ny1 - ny0 + 1;
  const out = new Grid(W, H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const sx = x + nx0, sy = y + ny0;
    if (sy < 0 || !g.inb(sx, sy)) continue;
    const si = g.idx(sx, sy), di = out.idx(x, y);
    out.floor[di] = g.floor[si]!; out.roomAt[di] = g.roomAt[si]!; out.liquid[di] = g.liquid[si]!; out.bridge[di] = g.bridge[si]!; out.protect[di] = g.protect[si]!;
  }
  const mv = <T extends Rect>(r: T): T => ({ ...r, x: r.x - nx0, y: r.y - ny0 });
  return { ...layout, rooms: layout.rooms.map(mv), corridors: layout.corridors.map((c) => ({ ...c, rect: mv(c.rect) })), width: W, height: H, grid: out };
}

// ---------------------------------------------------------------- 하수도: 사각 방 위에 수로

/** 수로 방(channel)은 가로로 물길을 파고 양옆에 3줄 보행로를 남긴다. 저수조(cistern)는 안쪽을 파고 가운데 섬을 남긴다. */
export function carveSewer(g: Grid, rooms: readonly PlacedRoom[], seed: number): void {
  rooms.forEach((r, ri) => {
    if (r.kind === "channel") {
      // 방 양끝 두 칸은 보행로로 남긴다 — 물이 옆벽에 바로 닿으면 팔레트 경계 경고(물↔벽)가 난다.
      for (let x = r.x + 2; x < r.x + r.w - 2; x += 1) {
        const top = r.y + 3 + (vnoise(x, 1, 5, seed + ri) > 0.66 ? 1 : 0);
        const bot = r.y + r.h - 4 - (vnoise(x, 9, 5, seed + ri + 3) > 0.66 ? 1 : 0);
        for (let y = top; y <= bot; y += 1) {
          const i = g.idx(x, y);
          if (!g.floor[i] || g.roomAt[i] !== ri || g.protect[i]) continue;
          g.liquid[i] = 1;
        }
      }
    } else if (r.kind === "cistern") {
      const x0 = r.x + 3, x1 = r.x + r.w - 4, y0 = r.y + 3, y1 = r.y + r.h - 4;
      const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2;
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
        const i = g.idx(x, y);
        if (!g.floor[i] || g.roomAt[i] !== ri || g.protect[i]) continue;
        const island = Math.abs(x - cxm) <= 1.2 && Math.abs(y - cym) <= 0.6;
        if (!island) g.liquid[i] = 1;
      }
    }
  });
}

/** 수로 방마다 곧은 다리를 몇 개 더 놓는다(7~9칸 간격) — 물길을 건널 곳이 문 앞 한 군데뿐이면 심심하다. */
export function addCrossings(g: Grid, rooms: readonly PlacedRoom[], seed: number): number {
  const random = rng(seed * 977 + 5);
  let placed = 0;
  rooms.forEach((r, ri) => {
    if (r.kind !== "channel") return;
    for (let x = r.x + 4; x < r.x + r.w - 3; x += 7 + Math.floor(random() * 3)) {
      const run: number[] = [];
      let y = r.y;
      while (y < r.y + r.h && !(g.liquid[g.idx(x, y)] && g.roomAt[g.idx(x, y)] === ri)) y += 1;
      while (y < r.y + r.h && g.liquid[g.idx(x, y)]) { run.push(g.idx(x, y)); y += 1; }
      if (!run.length) continue;
      const above = g.walk(x, (run[0]! / g.W | 0) - 1), below = y < g.H && g.walk(x, y);
      if (!above || !below) continue;
      // 다리 옆 칸이 이미 다리면 건너뛴다
      if (run.some((i) => g.bridge[i - 1] || g.bridge[i + 1])) continue;
      for (const i of run) { g.liquid[i] = 0; g.bridge[i] = 1; }
      placed += 1;
    }
  });
  return placed;
}


/**
 * 방 안에 홀로 남은 작은 벽 덩어리(바깥 벽과 안 이어진 막힌 칸 무리, 넓이 maxArea 이하)를 바닥으로 메운다.
 * 작은 덩어리는 벽 앞면 3줄을 다 못 세워 「벽돌 기둥 위에 검은 구멍」으로 그려졌다(2026-10-23 dg-r2 VQA 화산 동굴).
 */
export function fillWallIslands(g: Grid, maxArea: number): number {
  const seen = new Uint8Array(g.W * g.H);
  let filled = 0;
  for (let y0 = 0; y0 < g.H; y0 += 1) for (let x0 = 0; x0 < g.W; x0 += 1) {
    const i0 = g.idx(x0, y0);
    if (g.floor[i0] || seen[i0]) continue;
    const comp: number[] = [i0]; seen[i0] = 1;
    let border = false;
    for (let k = 0; k < comp.length; k += 1) {
      const i = comp[k]!, x = i % g.W, y = (i - x) / g.W;
      if (x === 0 || y === 0 || x === g.W - 1 || y === g.H - 1) border = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (!g.inb(nx, ny)) continue;
        const j = g.idx(nx, ny);
        if (g.floor[j] || seen[j]) continue;
        seen[j] = 1; comp.push(j);
      }
    }
    if (border || comp.length > maxArea) continue;
    for (const i of comp) {
      const x = i % g.W, y = (i - x) / g.W;
      let room = -1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const r = g.inb(x + dx, y + dy) ? g.roomAt[g.idx(x + dx, y + dy)]! : -1; if (r >= 0) { room = r; break; } }
      g.floor[i] = 1; g.roomAt[i] = room; filled += 1;
    }
  }
  return filled;
}
