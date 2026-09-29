// editor/tools/cityForm.ts
// 도시 형태 자(순수 계층). 타일 태그(road/sand/plaza/bridge/water…)와 map.structurePlacements 만 읽는다 — 특정 타일셋 id 에 묶이지 않는다.
// 조수의 마감 전 자기 점검(check_city_form 툴)과 시험 측정(scripts/content/lib/beodeul-metrics.ts)이 같은 계산을 쓴다.
//
// 이론 근거(요약은 tiledata/beodeul-city/tile-laying-theory.md):
//  - 공간 구문론(space syntax): 축선(axial line, 곧은 통로의 최대 연속)과 그 연결 그래프의 깊이 → 막다른 골목·격리 구역을 좌표로 뽑는다.
//  - Chen 2008 / Townscaper: 곧은 관통로 없는 깨진 격자 → 45 칸 넘는 직선·간격 균일도(CV)·꺾인 길 칸을 잰다.
//  - Lynch: 결절점(node = 광장)·랜드마크(구역 킷)·경계(운하)가 있는가.
//  - WFC/모델 합성: 이웃 제약은 전역 반복을 못 막는다 → 같은 블록 이웃·과사용을 따로 센다.
import type { GameMap, Project, StructureKitDef, TilesetDef } from "@/project/types";

const PAVED = ["road", "plaza", "bridge", "stair", "gate", "pier", "sand"];
const DISTRICT_KIT = /^bd-(castle|estate|forum|cathedral|windmill|harbour|harbour-west|river-bridge)$/;
const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

type Pt = [number, number];
interface Line { id: number; orient: "h" | "v"; cells: number[]; len: number; from: Pt; to: Pt }

export interface CityFormReport {
  /** 막다른 길: 끝이 아무 데도 이어지지 않는 길 (좌표는 끝 칸). */
  deadEnds: { at: Pt; kind: "cell" | "street"; width: number }[];
  lines: { count: number; longStraight: { orient: "h" | "v"; from: Pt; to: Pt; len: number }[]; longestLen: number };
  /** 축선 그래프 — 깊이가 클수록 도심에서 멀다(통합도 지표의 대리). */
  graph: { meanDepth: number; maxDepth: number; components: number; isolated: { from: Pt; to: Pt; len: number }[] };
  /** 평행한 긴 길(≥20)의 간격 변동계수. 낮을수록 바둑판. */
  spacing: { vGaps: number[]; hGaps: number[]; cv: number | null };
  /** 양쪽 방향으로 5칸 이하만 곧은 길 칸 = 휘거나 대각선인 길. */
  bentStreetCells: number;
  canal: { cells: number; orient: "h" | "v" | null; bends: number; straightShare: number | null; straight: boolean };
  nodes: { at: Pt; cells: number }[];
  landmarks: string[];
  blocks: { count: number; distinct: number; neighbourRepeats: { id: string; a: Pt; b: Pt }[]; overused: { id: string; n: number }[] };
}

function tagsOf(ts: TilesetDef, t: number): readonly string[] {
  return (ts.tileMeta?.[t]?.tags ?? []) as readonly string[];
}

export function analyzeCityForm(project: Project, map: GameMap): CityFormReport {
  const ts = project.tilesets[map.tilesetId];
  if (!ts) throw new Error(`타일셋 없음: ${map.tilesetId}`);
  const W = map.width, H = map.height;
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const kits = new Map<string, StructureKitDef>((ts.structureKits ?? []).map((k) => [k.id, k]));
  const placements = map.structurePlacements ?? [];

  // ---- 칸 분류 ----
  const kindCache = new Map<number, readonly string[]>();
  const kinds = (t: number) => { let v = kindCache.get(t); if (!v) { v = tagsOf(ts, t); kindCache.set(t, v); } return v; };
  const paved = (x: number, y: number) => {
    if (!inMap(x, y)) return false;
    const up = map.upperTiles[idx(x, y)]!;
    if (up >= 0) { const uk = kinds(up); if (uk.includes("prop") || uk.includes("building") || uk.includes("tree")) return false; }
    const k = kinds(map.lowerTiles[idx(x, y)]!);
    return PAVED.some((p) => k.includes(p));
  };
  const water = (x: number, y: number) => inMap(x, y) && kinds(map.lowerTiles[idx(x, y)]!).includes("water");
  // 킷이 스스로 가진 칸(구운 골목·뜰) — 저작한 길이 아니다
  const kitOwned = new Set<number>();
  for (const p of placements) {
    if (/^bd-ground-/.test(p.kitId)) continue;
    const k = kits.get(p.kitId); if (!k) continue;
    for (let j = 0; j < k.height; j += 1) for (let i = 0; i < k.width; i += 1) {
      const t = k.rows[j]?.tiles[i] ?? -1; const x = p.x + i, y = p.y + j;
      if (t >= 0 && inMap(x, y) && map.lowerTiles[idx(x, y)] === t) kitOwned.add(idx(x, y));
    }
  }
  const doorFronts = new Set<number>();
  for (const p of placements) for (const part of kits.get(p.kitId)?.parts ?? []) if (part.kind === "entrance") {
    const fx = p.x + part.dx, fy = p.y + part.dy + part.h; if (inMap(fx, fy)) doorFronts.add(idx(fx, fy));
  }
  const isStreet = (x: number, y: number) => paved(x, y) && kinds(map.lowerTiles[idx(x, y)]!).some((k) => k === "road" || k === "sand" || k === "bridge");

  // ---- 막다른 길 ----
  const deadEnds: CityFormReport["deadEnds"] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!paved(x, y) || doorFronts.has(idx(x, y)) || kitOwned.has(idx(x, y))) continue;
    const k = kinds(map.lowerTiles[idx(x, y)]!);
    if (!k.includes("road") && !k.includes("sand")) continue;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
    if (N4.filter(([dx, dy]) => paved(x + dx, y + dy)).length <= 1) deadEnds.push({ at: [x, y], kind: "cell", width: 1 });
  }
  const isRoadFree = (x: number, y: number) => isStreet(x, y) && !kitOwned.has(idx(x, y));
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const px = Math.abs(dy), py = Math.abs(dx); // 끝 줄 진행 방향(수직)
    const seen = new Set<number>();
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (seen.has(idx(x, y)) || !isRoadFree(x, y) || paved(x + dx, y + dy) || !paved(x - dx, y - dy)) continue;
      const run: Pt[] = []; let cx = x, cy = y;
      while (inMap(cx, cy) && isRoadFree(cx, cy) && !paved(cx + dx, cy + dy) && paved(cx - dx, cy - dy)) { run.push([cx, cy]); seen.add(idx(cx, cy)); cx += px; cy += py; }
      if (run.length < 2 || run.length > 3) continue;
      const [ax, ay] = run[0]!, [bx, by] = run[run.length - 1]!;
      if (paved(ax - px, ay - py) || paved(bx + px, by + py)) continue;
      if (run.some(([rx, ry]) => !inMap(rx + dx, ry + dy) || doorFronts.has(idx(rx, ry)) || water(rx + dx, ry + dy))) continue;
      deadEnds.push({ at: run[0]!, kind: "street", width: run.length });
    }
  }

  // ---- 축선(곧은 최대 연속) ----
  const lines: Line[] = [];
  const cellLines = new Map<number, number[]>();
  const runsOf = (orient: "h" | "v") => {
    const outer = orient === "h" ? H : W, inner = orient === "h" ? W : H;
    const raw: { fixed: number; a: number; b: number }[] = [];
    for (let o = 0; o < outer; o += 1) { let s = -1;
      for (let i = 0; i <= inner; i += 1) {
        const on = i < inner && (orient === "h" ? isStreet(i, o) : isStreet(o, i));
        if (on && s < 0) s = i;
        if (!on && s >= 0) { if (i - s >= 3) raw.push({ fixed: o, a: s, b: i - 1 }); s = -1; }
      } }
    // 옆 줄에서 거의 같은 범위로 겹치는 평행 연속을 한 축선(넓은 길)으로 묶는다
    const parent = raw.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
    for (let i = 0; i < raw.length; i += 1) for (let j = i + 1; j < raw.length; j += 1) {
      const p = raw[i]!, q = raw[j]!; if (q.fixed - p.fixed > 4) break;
      if (q.fixed === p.fixed) continue;
      const ov = Math.min(p.b, q.b) - Math.max(p.a, q.a) + 1;
      if (ov >= 0.7 * Math.min(p.b - p.a + 1, q.b - q.a + 1)) parent[find(j)] = find(i);
    }
    const groups = new Map<number, typeof raw>();
    raw.forEach((r, i) => { const g = groups.get(find(i)); if (g) g.push(r); else groups.set(find(i), [r]); });
    for (const g of groups.values()) {
      const a = Math.min(...g.map((r) => r.a)), b = Math.max(...g.map((r) => r.b));
      const id = lines.length; const cells: number[] = [];
      for (const r of g) for (let i = r.a; i <= r.b; i += 1) cells.push(orient === "h" ? idx(i, r.fixed) : idx(r.fixed, i));
      const mid = Math.round((Math.min(...g.map((r) => r.fixed)) + Math.max(...g.map((r) => r.fixed))) / 2);
      lines.push({ id, orient, cells, len: b - a + 1, from: orient === "h" ? [a, mid] : [mid, a], to: orient === "h" ? [b, mid] : [mid, b] });
      for (const c of cells) { const l = cellLines.get(c); if (l) l.push(id); else cellLines.set(c, [id]); }
    }
  };
  runsOf("h"); runsOf("v");
  const adj: Set<number>[] = lines.map(() => new Set<number>());
  const link = (a: number[] | undefined, b: number[] | undefined) => { if (!a || !b) return; for (const p of a) for (const q of b) if (p !== q) { adj[p]!.add(q); adj[q]!.add(p); } };
  for (const [c, ids] of cellLines) {
    const x = c % W, y = (c - x) / W; link(ids, ids);
    for (const [dx, dy] of N4) if (inMap(x + dx, y + dy)) link(ids, cellLines.get(idx(x + dx, y + dy)));
  }
  // 가장 긴 축선에서 폭 우선 — 깊이
  let meanDepth = 0, maxDepth = 0; const compOf = new Array<number>(lines.length).fill(-1); let comps = 0;
  const compSizes: number[][] = [];
  for (let s = 0; s < lines.length; s += 1) if (compOf[s]! < 0) {
    const q = [s]; compOf[s] = comps; const members = [s];
    while (q.length) { const a = q.pop()!; for (const b of adj[a]!) if (compOf[b]! < 0) { compOf[b] = comps; q.push(b); members.push(b); } }
    compSizes.push(members); comps += 1;
  }
  const main = compSizes.reduce<number[]>((best, m) => (m.reduce((n, i) => n + lines[i]!.len, 0) > best.reduce((n, i) => n + lines[i]!.len, 0) ? m : best), []);
  if (main.length) {
    const root = main.reduce((b, i) => (lines[i]!.len > lines[b]!.len ? i : b), main[0]!);
    const depth = new Map<number, number>([[root, 0]]); const q = [root];
    for (let h = 0; h < q.length; h += 1) for (const b of adj[q[h]!]!) if (!depth.has(b)) { depth.set(b, depth.get(q[h]!)! + 1); q.push(b); }
    const ds = [...depth.values()]; meanDepth = +(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(2); maxDepth = Math.max(...ds);
  }
  const isolated = compSizes.filter((m) => m !== main).map((m) => m.reduce((b, i) => (lines[i]!.len > lines[b]!.len ? i : b), m[0]!))
    .map((i) => ({ from: lines[i]!.from, to: lines[i]!.to, len: lines[i]!.len })).filter((l) => l.len >= 6);
  const longStraight = lines.filter((l) => l.len >= 45).map((l) => ({ orient: l.orient, from: l.from, to: l.to, len: l.len }));

  // ---- 평행 긴 길의 간격 ----
  const gapsOf = (orient: "h" | "v") => {
    const pos = lines.filter((l) => l.orient === orient && l.len >= 20).map((l) => (orient === "h" ? l.from[1] : l.from[0])).sort((a, b) => a - b);
    const merged: number[] = []; for (const p of pos) if (!merged.length || p - merged[merged.length - 1]! > 3) merged.push(p);
    return merged.slice(1).map((p, i) => p - merged[i]!);
  };
  const vGaps = gapsOf("v"), hGaps = gapsOf("h");
  const all = [...vGaps, ...hGaps];
  const cv = all.length >= 2 ? +(Math.sqrt(all.reduce((s, g) => s + (g - all.reduce((a, b) => a + b, 0) / all.length) ** 2, 0) / all.length) / (all.reduce((a, b) => a + b, 0) / all.length)).toFixed(3) : null;

  // ---- 휘어진 길 칸 ----
  let bent = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!isStreet(x, y)) continue;
    let hx = 1, vy = 1;
    for (let i = x - 1; i >= 0 && isStreet(i, y) && hx <= 6; i -= 1) hx += 1;
    for (let i = x + 1; i < W && isStreet(i, y) && hx <= 6; i += 1) hx += 1;
    for (let j = y - 1; j >= 0 && isStreet(x, j) && vy <= 6; j -= 1) vy += 1;
    for (let j = y + 1; j < H && isStreet(x, j) && vy <= 6; j += 1) vy += 1;
    if (hx <= 5 && vy <= 5 && hx + vy > 2) bent += 1;
  }

  // ---- 운하(가장 긴 좁은 물줄기)의 굽이 ----
  const canal = (() => {
    const cells = (() => { let n = 0; for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (water(x, y)) n += 1; return n; })();
    const centres = (orient: "h" | "v") => {
      const out: number[] = []; const outer = orient === "v" ? H : W, inner = orient === "v" ? W : H;
      for (let o = 0; o < outer; o += 1) { let n = 0, sum = 0;
        for (let i = 0; i < inner; i += 1) if (orient === "v" ? water(i, o) : water(o, i)) { n += 1; sum += i; }
        if (n > 0 && n <= 8) out.push(sum / n); }
      return out;
    };
    const cv2 = centres("v"), ch = centres("h");
    const orient: "h" | "v" | null = Math.max(cv2.length, ch.length) < 12 ? null : cv2.length >= ch.length ? "v" : "h";
    if (!orient) return { cells, orient, bends: 0, straightShare: null, straight: false };
    const c = orient === "v" ? cv2 : ch;
    const mode = [...c].sort((a, b) => a - b)[Math.floor(c.length / 2)]!;
    const straightShare = +(c.filter((v) => Math.abs(v - mode) <= 1.5).length / c.length).toFixed(3);
    // 굽이: 중심선이 3칸 이상 움직인 방향이 바뀐 횟수
    let bends = 0, dir = 0, anchor = c[0]!;
    for (const v of c) { if (Math.abs(v - anchor) >= 3) { const d = Math.sign(v - anchor); if (dir !== 0 && d !== dir) bends += 1; dir = d; anchor = v; } }
    return { cells, orient, bends, straightShare, straight: straightShare >= 0.85 };
  })();

  // ---- 결절점(광장) ----
  const nodes: CityFormReport["nodes"] = [];
  { const seen = new Set<number>(); const plaza = (x: number, y: number) => inMap(x, y) && kinds(map.lowerTiles[idx(x, y)]!).includes("plaza");
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (plaza(x, y) && !seen.has(idx(x, y))) {
      const q: Pt[] = [[x, y]]; seen.add(idx(x, y)); let n = 0, sx = 0, sy = 0;
      while (q.length) { const [cx, cy] = q.pop()!; n += 1; sx += cx; sy += cy; for (const [dx, dy] of N4) if (plaza(cx + dx, cy + dy) && !seen.has(idx(cx + dx, cy + dy))) { seen.add(idx(cx + dx, cy + dy)); q.push([cx + dx, cy + dy]); } }
      if (n >= 24) nodes.push({ at: [Math.round(sx / n), Math.round(sy / n)], cells: n });
    } }
  const landmarks = [...new Set(placements.map((p) => p.kitId).filter((id) => DISTRICT_KIT.test(id)))];

  // ---- 블록 반복 ----
  const blocks = placements.filter((p) => p.kitId.startsWith("bd-block-"));
  const neighbourRepeats: CityFormReport["blocks"]["neighbourRepeats"] = [];
  for (let i = 0; i < blocks.length; i += 1) for (let j = i + 1; j < blocks.length; j += 1) {
    const p = blocks[i]!, q = blocks[j]!; if (p.kitId !== q.kitId) continue;
    const gx = Math.max(q.x - (p.x + p.w), p.x - (q.x + q.w)), gy = Math.max(q.y - (p.y + p.h), p.y - (q.y + q.h));
    if ((gx < 0 && gy <= 20) || (gy < 0 && gx <= 20)) neighbourRepeats.push({ id: p.kitId, a: [p.x, p.y], b: [q.x, q.y] });
  }
  const uses: Record<string, number> = {}; for (const b of blocks) uses[b.kitId] = (uses[b.kitId] ?? 0) + 1;

  return {
    deadEnds, lines: { count: lines.length, longStraight, longestLen: Math.max(0, ...lines.map((l) => l.len)) },
    graph: { meanDepth, maxDepth, components: comps, isolated }, spacing: { vGaps, hGaps, cv }, bentStreetCells: bent, canal, nodes, landmarks,
    blocks: { count: blocks.length, distinct: Object.keys(uses).length, neighbourRepeats, overused: Object.entries(uses).filter(([, n]) => n > 2).map(([id, n]) => ({ id, n })) },
  };
}

/** 조수에게 돌려줄 짧은 문장: 고칠 것을 좌표와 함께. */
export function cityFormAdvice(r: CityFormReport): string[] {
  const out: string[] = [];
  const at = (p: Pt) => `(${p[0]},${p[1]})`;
  if (r.deadEnds.length) out.push(`막다른 길 ${r.deadEnds.length}곳: ${r.deadEnds.slice(0, 8).map((d) => `${at(d.at)}${d.kind === "street" ? ` 폭${d.width}` : ""}`).join(" ")} — 다른 길·광장·문 앞·물가 잔교에 잇거나 지운다`);
  for (const l of r.lines.longStraight) out.push(`곧은 길 ${l.len}칸 ${at(l.from)}→${at(l.to)} — 한 곳 이상 꺾거나 옆으로 어긋나게 한다`);
  if (r.canal.orient && r.canal.straight) out.push(`운하가 곧다(중심선 ${Math.round((r.canal.straightShare ?? 0) * 100)}% 같은 자리) — 굽이를 만든다`);
  if (r.blocks.neighbourRepeats.length) out.push(`같은 블록 이웃 ${r.blocks.neighbourRepeats.length}쌍: ${r.blocks.neighbourRepeats.slice(0, 6).map((n) => `${n.id}${at(n.a)}~${at(n.b)}`).join(" ")} — 한쪽을 다른 종류나 -b/-c 변형으로 바꾼다`);
  if (r.blocks.overused.length) out.push(`블록 ${r.blocks.overused.map((o) => `${o.id}×${o.n}`).join(" ")} 3번 이상 — 두 번까지만`);
  if (r.graph.isolated.length) out.push(`길망에서 떨어진 길 ${r.graph.isolated.length}개: ${r.graph.isolated.slice(0, 5).map((l) => `${at(l.from)}→${at(l.to)}`).join(" ")}`);
  if (r.spacing.cv !== null && r.spacing.cv < 0.15 && r.spacing.vGaps.length + r.spacing.hGaps.length >= 4) out.push(`평행 대로 간격이 거의 같다(변동 ${r.spacing.cv}) — 바둑판처럼 보인다. 간격을 달리하거나 한 줄을 어긋나게`);
  if (!r.nodes.length) out.push("광장(결절점)이 없다 — 24칸 이상 광장 하나는 필요");
  return out;
}
