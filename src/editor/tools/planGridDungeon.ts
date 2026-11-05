// editor/tools/planGridDungeon.ts
// 도면 코드(ai/planGrid.ts) → 칸 배치 던전(dungeonKit/bboxFloor.ts BboxDungeonLayout). 도안 칸 = 맵 칸(늘리지 않는다) — 구역·통로 칸을 그대로 방으로 옮기고,
// 그림이 모르는 던전 규칙(벽 앞면 4줄·문·입구 계단·보스 앞방·방 채움·적)은 여기서 채우며, 바꾼 것은 notes 에 하나씩 남긴다(ultrabrain AMEND 2026-11-05).
import type { PlanGrid } from "@/ai/planGrid";
import { BBOX_CELLS_PER_PIECE, type BboxDungeonLayout, type BboxPiece } from "../dungeonKit/bboxFloor";

export interface PlanDungeonResult {
  readonly layout: BboxDungeonLayout;
  readonly notes: string[];
  /** 칩셋에 맞는 조각이 없어 놓지 못한 도안 물건(맵 칸) — 조수가 generate_missing_object 로 만든다. */
  readonly missing: { name: string; x: number; y: number; w: number; h: number }[];
  /** 도안 칸 → 맵 칸(행마다 내림). 측정이 같은 자리를 비교한다. */
  readonly rowMap: number[];
  readonly dx: number;
}

const MAX_W = 80, MAX_H = 70, TOP = 4;
type Reg = { id: string; zone: number; cells: Set<number>; purpose: string; name: string };

/** 도안 물건 이름 → 칩셋 조각 이름(앞의 것이 먼저). 맞는 낱말이 없으면 놓지 못한 물건으로 남는다. */
const PIECE_WORDS: readonly [RegExp, readonly string[]][] = [
  [/왕좌|옥좌|throne/iu, ["throne", "demon throne"]],
  [/관|석관|사르코|sarcoph|coffin/iu, ["pharaoh sarcophagus", "sarcophagus ns", "coffin"]],
  [/제단|altar/iu, ["altar stone", "altar", "altar cult"]],
  [/아누비스|자칼|jackal/iu, ["jackal statue"]],
  [/석상|조각상|동상|statue|idol|우상/iu, ["statue head", "scarab statue", "sunken idol", "frozen warrior"]],
  [/오벨리스크|obelisk/iu, ["obelisk"]],
  [/분수|fountain/iu, ["sunken idol", "mosaic medallion 5x5"]],
  [/책장|서가|책|library|book/iu, ["bookshelf", "bookshelf tall"]],
  [/독서대|lectern/iu, ["lectern"]],
  [/갑옷|무기|armor|weapon|armory|무기고/iu, ["armor stand", "rack 32"]],
  [/횃불|torch/iu, ["torch wall"]],
  [/화로|brazier|불꽃|fire/iu, ["brazier", "cave brazier", "void brazier"]],
  [/촛대|촛불|candle/iu, ["candelabra", "iron candelabra", "candles"]],
  [/기둥|pillar|column/iu, ["column temple", "column cata", "column sewer"]],
  [/깃발|배너|banner/iu, ["royal banner", "banner cult"]],
  [/카펫|양탄자|carpet|rug/iu, ["carpet runner 3w", "carpet runner"]],
  [/상자|궤짝|crate/iu, ["crate", "crate stack"]],
  [/통|barrel/iu, ["barrel"]],
  [/항아리|단지|urn|pot|jar/iu, ["niche urn", "bucket"]],
  [/보물|금화|금|gold|treasure/iu, ["gold pile"]],
  [/뼈|해골|skull|bone/iu, ["skulls", "bone heap", "bones"]],
  [/잔해|돌무더기|rubble|바위|rock/iu, ["rubble heap", "rubble temple", "rubble"]],
  [/모래|sand/iu, ["sand pit"]],
  [/함정|가시|trap|spike/iu, ["spike small", "spike wide"]],
  [/바닥.?무늬|메달|문양|mosaic|medallion|마법진|rune|circle/iu, ["mosaic medallion 5x5", "tower rune", "teleport circle"]],
  [/수정|crystal/iu, ["crystal pedestal", "ice crystal"]],
  [/버섯|mushroom/iu, ["glow mushroom", "mushroom ring"]],
  [/우물|well/iu, ["sunken idol"]],
  [/침대|bed/iu, ["straw bed", "catacombs straw bed"]],
  [/탁자|식탁|테이블|table|desk/iu, ["anvil table"]],
  [/쇠사슬|사슬|chain/iu, ["chains", "hanging chain"]],
  [/창문|창|window|스테인드|장미창/iu, ["tower window lit"]],
  [/석판|묘비|tomb|slab/iu, ["tomb slab"]],
  [/포탈|portal|문.?문|gate/iu, ["portal gate"]],
  [/종|bell/iu, ["iron candelabra"]],
];
const FILL_FLOOR = ["brazier", "column temple", "barrel", "crate", "rubble", "candles"] as const;
const FILL_WALL = ["torch wall", "banner cult", "royal banner", "niche urn", "chains"] as const;

export function planToDungeon(g: PlanGrid, theme: "catacomb" | "castle" | "temple", cat: readonly BboxPiece[]): PlanDungeonResult {
  const notes: string[] = [], missing: PlanDungeonResult["missing"] = [];
  const byName = new Map(cat.map((p) => [p.name, p] as const));
  const { cols, rows, code } = g;
  const N = cols * rows;
  // ── 1. 도안 칸: 열린 칸 = 물·구덩이 아닌 구역 + 길 + 물·구덩이 구역(위험) ──
  const open = new Uint8Array(N), hazard = new Uint8Array(N);
  for (let k = 0; k < N; k += 1) {
    const z = g.zone[k]! >= 0 ? code.zones[g.zone[k]!]! : null;
    if (g.path[k] || z) open[k] = 1;
    if (z && (z.kind === "water" || z.kind === "pit") && !g.path[k]) hazard[k] = z.kind === "pit" ? 3 : 1;
  }
  // ── 2. 세로 틈 1~3줄을 4줄로: 틈이 있는 행 경계마다 같은 줄을 늘린다(모든 층·물건에 같은 변환 — AMEND c) ──
  const extra = new Array<number>(rows + 1).fill(0);
  for (let x = 0; x < cols; x += 1) {
    let last = -1;
    for (let y = 0; y < rows; y += 1) {
      if (!open[y * cols + x]) continue;
      if (last >= 0 && y - last - 1 >= 1 && y - last - 1 <= 3) { const gap = y - last - 1; extra[y] = Math.max(extra[y]!, 4 - gap); }
      last = y;
    }
  }
  const rowMap: number[] = [];
  let acc = TOP;
  for (let y = 0; y < rows; y += 1) { acc += extra[y]!; rowMap.push(acc + y); }
  let H = rowMap[rows - 1]! + 2;
  if (H > MAX_H) {
    // 넘치면 가장 작은 틈부터 메워(위아래 구역을 잇고) 늘린 줄을 되돌린다
    const order = extra.map((e, y) => ({ e, y })).filter((v) => v.e > 0).sort((a, b) => a.e - b.e);
    for (const { y } of order) {
      if (H <= MAX_H) break;
      for (let x = 0; x < cols; x += 1) {
        let up = y - 1; while (up >= 0 && !open[up * cols + x]) up -= 1;
        if (up < 0 || !open[y * cols + x] || y - up - 1 > 3) continue;
        for (let yy = up + 1; yy < y; yy += 1) open[yy * cols + x] = 1;
      }
      notes.push(`row ${y}: filled a thin wall gap instead of widening it (map would exceed ${MAX_H} rows)`);
      extra[y] = 0;
      acc = TOP; rowMap.length = 0;
      for (let yy = 0; yy < rows; yy += 1) { acc += extra[yy]!; rowMap.push(acc + yy); }
      H = rowMap[rows - 1]! + 2;
    }
  }
  const dx = 1, W = Math.min(MAX_W, cols + 2);
  H = Math.min(MAX_H, Math.max(16, H));
  const at = (x: number, y: number) => ({ x: x + dx, y: rowMap[y]! });
  const M = W * H, idx = (x: number, y: number) => y * W + x;
  // 늘린 줄은 위 줄 칸을 이어 받는다(같은 구역 안이면 열린 칸, 아니면 막힌 칸)
  const owner = new Int16Array(M).fill(-1), haz = new Uint8Array(M), pathM = new Uint8Array(M);
  const zoneAt = (k: number) => (g.path[k] && (g.zone[k]! < 0 || ["water", "pit", "corridor"].includes(code.zones[g.zone[k]!]!.kind)) ? -2 : g.zone[k]!);
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < cols; x += 1) {
    const k = y * cols + x; if (!open[k]) continue;
    const p = at(x, y); if (p.y >= H - 1 || p.x >= W - 1) continue;
    const z = zoneAt(k);
    const span = y > 0 && open[(y - 1) * cols + x] ? rowMap[y]! - rowMap[y - 1]! : 1;
    for (let s = 0; s < span; s += 1) { const m = idx(p.x, p.y - s); owner[m] = z; haz[m] = hazard[k]!; pathM[m] = g.path[k]!; }
  }
  // ── 3. 구역 → 방(같은 구역의 이어진 덩이마다 하나), 길만 있는 칸 덩이 → 통로 방 ──
  const regs: Reg[] = [];
  const regOf = new Int16Array(M).fill(-1);
  const seen = new Uint8Array(M);
  for (let m = 0; m < M; m += 1) {
    if (seen[m] || owner[m] === -1) continue;
    const z = owner[m]!;
    const q = [m]; seen[m] = 1;
    const cells = new Set<number>();
    while (q.length) {
      const c = q.pop()!; cells.add(c);
      const x = c % W, y = (c - x) / W;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = idx(nx, ny); if (!seen[n] && owner[n] === z) { seen[n] = 1; q.push(n); }
      }
    }
    if (cells.size < 2) { for (const c of cells) owner[c] = -1; continue; }
    const zone = z >= 0 ? code.zones[z]! : null;
    const id = zone ? `${zone.id}${regs.filter((r) => r.zone === z).length ? regs.filter((r) => r.zone === z).length + 1 : ""}` : `P${regs.filter((r) => r.zone === -2).length + 1}`;
    for (const c of cells) regOf[c] = regs.length;
    regs.push({ id, zone: z, cells, purpose: "other", name: zone?.name ?? "통로" });
  }
  // 위험(물·구덩이)만 있는 방은 이웃 방에 붙인다 — 혼자면 걸을 칸이 없다
  for (const r of regs) {
    if (![...r.cells].every((c) => haz[c])) continue;
    const nb = new Map<number, number>();
    for (const c of r.cells) { const x = c % W, y = (c - x) / W; for (const n of [idx(x + 1, y), idx(x - 1, y), idx(x, y + 1), idx(x, y - 1)]) { const o = regOf[n]!; if (o >= 0 && regs[o] !== r) nb.set(o, (nb.get(o) ?? 0) + 1); } }
    const best = [...nb].sort((a, b) => b[1] - a[1])[0];
    const into = best ? regs[best[0]]! : null;
    if (into && ![...into.cells].every((c) => haz[c])) { for (const c of r.cells) { into.cells.add(c); regOf[c] = regs.indexOf(into); } r.cells.clear(); notes.push(`${r.name}: hazard-only zone merged into ${into.name}`); }
    else { // 물 섬 고리: 가장자리 한 줄을 마른 바닥으로
      for (const c of r.cells) { const x = c % W, y = (c - x) / W; if ([idx(x + 1, y), idx(x - 1, y), idx(x, y + 1), idx(x, y - 1)].some((n) => regOf[n] !== regOf[c])) haz[c] = 0; }
      notes.push(`${r.name}: water-only room got a dry rim`);
    }
  }
  const thinFix = () => {
    for (let pass = 0; pass < 400; pass += 1) {
      let fixed = false;
      for (let x = 0; x < W && !fixed; x += 1) {
        let last = -1;
        for (let y = 0; y < H && !fixed; y += 1) {
          const m = idx(x, y), r = regOf[m]!;
          if (r < 0 || !regs[r]!.cells.has(m)) continue;
          const gap = last >= 0 ? y - last - 1 : 0;
          if (gap >= 1 && gap <= 3) {
            const up = regs[regOf[idx(x, last)]!]!, low = regs[r]!;
            const drop = up === low ? up : low.cells.size >= up.cells.size ? low : up; const c = drop === low && up !== low ? m : idx(x, last); drop.cells.delete(c); regOf[c] = -1;
            fixed = true;
          }
          last = y;
        }
      }
      if (!fixed) { if (pass) notes.push(`trimmed or joined ${pass} cell(s) so every wall above an open area is 4 rows thick`); break; }
    }
    };
  thinFix();
  const compsOf = (cells: Set<number>) => {
    const out: number[][] = [], seenC = new Set<number>();
    for (const s of cells) {
      if (seenC.has(s)) continue;
      const q = [s]; seenC.add(s);
      for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W; for (const n of [idx(x + 1, y), idx(x - 1, y), idx(x, y + 1), idx(x, y - 1)]) if (cells.has(n) && !seenC.has(n) && Math.abs((n % W) - x) <= 1) { seenC.add(n); q.push(n); } }
      out.push(q);
    }
    return out.sort((a, b) => b.length - a.length);
  };
  for (const r of regs) for (const frag of compsOf(r.cells).slice(1)) for (const c of frag) { r.cells.delete(c); regOf[c] = -1; }
  const contact = (r: Reg) => {
    const n = new Map<Reg, number>();
    for (const c of r.cells) { const x = c % W, y = (c - x) / W; for (const k of [idx(x + 1, y), idx(x - 1, y), idx(x, y + 1), idx(x, y - 1)]) { const o = regOf[k]!; if (o >= 0 && regs[o] !== r && regs[o]!.cells.has(k)) n.set(regs[o]!, (n.get(regs[o]!) ?? 0) + 1); } }
    return n;
  };
  let merged = 0;
  for (const r of regs) {
    const z = r.zone >= 0 ? code.zones[r.zone]! : null;
    if (!r.cells.size || !z || !(z.kind === "landmark" || z.kind === "stairs")) continue;
    const into = [...contact(r)].filter(([o]) => o.cells.size && o.zone !== -2).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!into) continue;
    for (const c of r.cells) { into.cells.add(c); regOf[c] = regs.indexOf(into); }
    r.cells.clear(); merged += 1;
    notes.push(`${r.name} drawn inside ${into.name} — kept as part of that room`);
  }
  for (const r of [...regs].sort((a, b) => a.cells.size - b.cells.size)) {
    if (!r.cells.size || r.cells.size >= (r.zone === -2 ? 10 : 6)) continue;
    const touch = contact(r);
    const into = [...touch].filter(([o]) => o.cells.size).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (into) { for (const c of r.cells) { into.cells.add(c); regOf[c] = regs.indexOf(into); } r.cells.clear(); merged += 1; }
  }
  if (merged) notes.push(`merged ${merged} tiny path stub(s) into the room they touch`);
  thinFix();
  const live = regs.filter((r) => r.cells.size);
  // ── 4. 맞닿음 → 문, 방 그래프 ──
  const edges = new Map<string, { a: Reg; b: Reg; at: [number, number] }>();
  for (let m = 0; m < M; m += 1) {
    const r = regOf[m]!; if (r < 0 || !regs[r]!.cells.has(m)) continue;
    const x = m % W, y = (m - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x, y + 1]] as const) {
      if (nx >= W || ny >= H) continue;
      const o = regOf[idx(nx, ny)]!; if (o < 0 || o === r || !regs[o]!.cells.has(idx(nx, ny))) continue;
      const a = regs[r]!, b = regs[o]!, key = [a.id, b.id].sort().join("|");
      if (!edges.has(key) && !haz[m]) edges.set(key, { a, b, at: [x, y] });
    }
  }
  const nbrs = (r: Reg) => [...edges.values()].filter((e) => e.a === r || e.b === r).map((e) => (e.a === r ? e.b : e.a));
  // ── 5. 목적: 입구 = 입구 칸에 가장 가까운 방, 보스 = 왕좌·제단 방(없으면 입구에서 가장 먼 방), 보스 앞방 = 입구→보스 길의 마지막 방 ──
  const rooms = live.filter((r) => r.zone !== -2);
  const pool = rooms.length >= 3 ? rooms : live;
  const ent = code.entrance ? at(code.entrance.x, Math.min(rows - 1, code.entrance.y)) : { x: W >> 1, y: H - 2 };
  const dist2 = (r: Reg) => Math.min(...[...r.cells].map((c) => (c % W - ent.x) ** 2 + (Math.floor(c / W) - ent.y) ** 2));
  const entrance = [...pool].sort((a, b) => dist2(a) - dist2(b))[0]!;
  const hops = new Map<Reg, number>([[entrance, 0]]), parent = new Map<Reg, Reg>();
  for (let q = [entrance]; q.length;) { const r = q.shift()!; for (const n of nbrs(r)) if (!hops.has(n)) { hops.set(n, hops.get(r)! + 1); parent.set(n, r); q.push(n); } }
  const objIn = (r: Reg, re: RegExp) => code.objects.some((o) => re.test(o.name) && r.cells.has(idx(at(o.x, o.y).x, at(o.x, o.y).y)));
  const zoneText = (r: Reg) => (r.zone >= 0 ? `${code.zones[r.zone]!.name} ${code.zones[r.zone]!.contains.join(" ")}` : "");
  const BOSS = /왕좌|옥좌|보스|파라오|제단|사당|성소|throne|boss|altar|sanctum/iu;
  const bossCands = pool.filter((r) => r !== entrance && (BOSS.test(zoneText(r)) || objIn(r, BOSS)));
  const far = (r: Reg) => hops.get(r) ?? -1;
  const deep = (rs: Reg[]) => rs.filter((r) => far(r) >= 2);
  const gated = (r: Reg) => nbrs(r).some((n) => n !== entrance);
  const bossPool0 = deep(bossCands).length ? deep(bossCands) : deep(pool).length ? deep(pool) : bossCands.length ? bossCands : pool.filter((r) => r !== entrance);
  const bossPool = bossPool0.filter(gated).length ? bossPool0.filter(gated) : pool.filter((r) => r !== entrance && gated(r));
  let boss = bossPool.sort((a, b) => far(b) - far(a) || b.cells.size - a.cells.size)[0];
  if (!boss) boss = pool[pool.length - 1]!;
  let ante = parent.get(boss) ?? nbrs(boss)[0];
  if (!ante || ante === entrance) {
    // 보스 앞방이 없거나 입구면 보스 방과 맞닿은 통로·방 중 입구 아닌 것
    ante = nbrs(boss).find((r) => r !== entrance) ?? ante;
  }
  entrance.purpose = "entrance"; boss.purpose = "boss";
  if (ante && ante !== entrance) ante.purpose = "antechamber";
  else notes.push("no room between the entrance and the boss room — the antechamber rule cannot be met");
  // 보스 방의 다른 문은 닫는다: 맞닿은 칸을 벽으로(AMEND a)
  for (const n of nbrs(boss)) {
    if (n === ante) continue;
    const key = [boss.id, n.id].sort().join("|"); edges.delete(key);
    const small = n.cells.size < boss.cells.size ? n : boss;
    const other = small === n ? boss : n;
    for (const c of [...small.cells]) { const x = c % W, y = (c - x) / W; if ([idx(x + 1, y), idx(x - 1, y), idx(x, y + 1), idx(x, y - 1)].some((k) => other.cells.has(k))) { small.cells.delete(c); regOf[c] = -1; } }
    notes.push(`closed the link ${n.name} ↔ ${boss.name} so the boss room is entered only through ${ante?.name ?? "?"}`);
  }
  // 닫으며 새로 생긴 맞닿음(두 칸 떨어져 다시 닿는 곳)을 다시 센다
  {
    const reach = new Set<Reg>([entrance]);
    for (let q = [entrance]; q.length;) { const r = q.pop()!; for (const [o] of contact(r)) if (!reach.has(o)) { reach.add(o); q.push(o); } }
    const cut = live.filter((r) => r.cells.size && !reach.has(r));
    for (const r of cut) { for (const c of r.cells) regOf[c] = -1; r.cells.clear(); }
    if (cut.length) notes.push(`dropped ${cut.length} area(s) not connected to the entrance: ${cut.map((r) => r.name).join(", ")}`);
  }
  const rest = pool.filter((r) => r.purpose === "other").sort((a, b) => b.cells.size - a.cells.size);
  const take = (re: RegExp, purpose: string) => { const r = rest.find((v) => v.purpose === "other" && (re.test(zoneText(v)) || objIn(v, re))) ?? rest.find((v) => v.purpose === "other"); if (r) r.purpose = purpose; else notes.push(`no room left for purpose ${purpose}`); };
  take(/보물|금|보고|treasure|vault|gold/iu, "treasure");
  take(/수수께끼|함정|퍼즐|레버|puzzle|trap|lever|모래/iu, "puzzle");
  take(/경비|병사|막사|guard|barrack|무기/iu, "guard");
  thinFix();
  if (ante && ante !== entrance) {
    let sealed = 0;
    for (let guard = 0; guard < 80; guard += 1) {
      const start = [...entrance.cells][0];
      if (start === undefined) break;
      const seenB = new Uint8Array(M); seenB[start] = 1;
      let leak = -1;
      for (let q = [start]; q.length && leak < 0;) {
        const c = q.pop()!, x = c % W;
        for (const n of [c + 1, c - 1, c + W, c - W]) {
          if (n < 0 || n >= M || Math.abs((n % W) - x) > 1 || seenB[n] || regOf[n]! < 0 || !regs[regOf[n]!]!.cells.has(n) || ante.cells.has(n)) continue;
          if (boss.cells.has(n)) { if (!boss.cells.has(c)) { leak = c; break; } }
          seenB[n] = 1; q.push(n);
        }
      }
      if (leak < 0) break;
      regs[regOf[leak]!]!.cells.delete(leak); regOf[leak] = -1; sealed += 1;
    }
    if (sealed) notes.push(`sealed ${sealed} cell(s) so the boss room opens only onto ${ante.name}`);
    thinFix();
  }
  {
    const isOpenC = (c: number) => regOf[c]! >= 0 && regs[regOf[c]!]!.cells.has(c);
    const start = [...entrance.cells].find((c) => !haz[c]);
    const reach = new Uint8Array(M);
    if (start !== undefined) for (let q = [start], h = (reach[start] = 1, 0); h < q.length; h += 1) { const c = q[h]!, x = c % W; for (const n of [c + 1, c - 1, c + W, c - W]) if (n >= 0 && n < M && Math.abs((n % W) - x) <= 1 && !reach[n] && isOpenC(n) && !haz[n]) { reach[n] = 1; q.push(n); } }
    let bridged = 0;
    for (const r of regs.filter((v) => v.cells.size)) {
      if ([...r.cells].some((c) => reach[c] && !haz[c])) continue;
      const prev = new Int32Array(M).fill(-1);
      const q = [...r.cells].filter((c) => !haz[c]); for (const c of q) prev[c] = c;
      let hit = -1;
      for (let h = 0; h < q.length && hit < 0; h += 1) { const c = q[h]!, x = c % W; for (const n of [c + 1, c - 1, c + W, c - W]) { if (n < 0 || n >= M || Math.abs((n % W) - x) > 1 || prev[n] >= 0 || !isOpenC(n)) continue; prev[n] = c; if (reach[n] && !haz[n]) { hit = n; break; } q.push(n); } }
      for (let c = hit; c >= 0 && prev[c] !== c; c = prev[c]!) if (haz[c]) { haz[c] = 0; bridged += 1; }
    }
    if (bridged) notes.push(`laid ${bridged} dry cell(s) across water so every room can be reached`);
  }
  // ── 6. 방 사각형(행마다 토막) ──
  const rectsOf = (cells: Set<number>) => {
    const out: { x: number; y: number; w: number; h: number }[] = [];
    const ys = [...new Set([...cells].map((c) => Math.floor(c / W)))].sort((a, b) => a - b);
    for (const y of ys) {
      const xs = [...cells].filter((c) => Math.floor(c / W) === y).map((c) => c % W).sort((a, b) => a - b);
      let s = xs[0]!;
      for (let i = 1; i <= xs.length; i += 1) if (i === xs.length || xs[i] !== xs[i - 1]! + 1) { out.push({ x: s, y, w: xs[i - 1]! - s + 1, h: 1 }); s = xs[i]!; }
    }
    // 같은 x·w 로 이어진 토막을 세로로 합친다
    const merged: typeof out = [];
    for (const r of out) { const up = merged.find((m) => m.x === r.x && m.w === r.w && m.y + m.h === r.y); if (up) up.h += 1; else merged.push({ ...r }); }
    return merged;
  };
  const finalRegs = live.filter((r) => r.cells.size >= 2);
  const doors = [...edges.values()].filter((e) => finalRegs.includes(e.a) && finalRegs.includes(e.b) && e.a.cells.has(idx(e.at[0], e.at[1])) && [[1, 0], [0, 1], [-1, 0], [0, -1]].some(([u, v]) => e.b.cells.has(idx(e.at[0] + u!, e.at[1] + v!)))).map((e) => ({ x: e.at[0], y: e.at[1], connects: [e.a.id, e.b.id] as [string, string] }));
  // 맞닿은 칸 쌍마다 문이 근처(4칸)에 있어야 한다 — 긴 맞닿음은 4칸마다 문을 더 둔다
  for (let m = 0; m < M; m += 1) {
    const r = regOf[m]!; if (r < 0 || !regs[r]!.cells.has(m)) continue;
    const x = m % W, y = (m - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x, y + 1]] as const) {
      if (nx >= W || ny >= H) continue;
      const o = regOf[idx(nx, ny)]!; if (o < 0 || o === r || !regs[o]!.cells.has(idx(nx, ny))) continue;
      if (!finalRegs.includes(regs[r]!) || !finalRegs.includes(regs[o]!)) continue;
      const a = regs[r]!.id, b = regs[o]!.id;
      if (!doors.some((d) => d.connects.includes(a) && d.connects.includes(b) && Math.abs(d.x - x) + Math.abs(d.y - y) <= 4)) doors.push({ x, y, connects: [a, b] });
    }
  }
  // ── 7. 조각: 도안 물건 → 칩셋 조각, 방마다 랜드마크 + 채움, 입구 계단 ──
  const openAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && regOf[idx(x, y)]! >= 0 && regs[regOf[idx(x, y)]!]!.cells.has(idx(x, y));
  const walkAt = (x: number, y: number) => openAt(x, y) && !haz[idx(x, y)];
  const faceAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !openAt(x, y) && [1, 2, 3].some((d) => openAt(x, y + d));
  const used = new Set<number>();
  const objects: { id: string; x: number; y: number }[] = [];
  const landmark = new Map<Reg, { id: string; x: number; y: number }>();
  const fits = (p: BboxPiece, x: number, y: number): boolean => {
    for (let ddy = 0; ddy < p.h; ddy += 1) for (let ddx = 0; ddx < p.w; ddx += 1) {
      const X = x + ddx, Y = y + ddy, bottom = ddy === p.h - 1;
      if (X < 0 || Y < 0 || X >= W || Y >= H || used.has(idx(X, Y))) return false;
      if (p.place === "wall") { if (!faceAt(X, Y) || (bottom && !(faceAt(X, Y + 1) || walkAt(X, Y + 1)))) return false; }
      else if (p.place === "decal") { if (!walkAt(X, Y)) return false; }
      else if (bottom ? !walkAt(X, Y) : !(walkAt(X, Y) || faceAt(X, Y))) return false;
    }
    // 바닥 조각은 걷는 칸을 막는다 — 바로 옆 칸 중 하나는 걷는 칸으로 남긴다
    if (p.place === "floor") { const by = y + p.h - 1; if (!walkAt(x - 1, by) && !walkAt(x + p.w, by) && !walkAt(x, by + 1) && !walkAt(x, by - 1)) return false; }
    if (p.place === "floor" && cutsWalk(p, x, y)) return false;
    return true;
  };
  const blocked = new Set<number>();
  const reachCount = (extra: readonly number[]) => {
    const start = [...entrance.cells].find((c) => !haz[c] && !blocked.has(c) && !extra.includes(c));
    if (start === undefined) return 0;
    const seenW = new Uint8Array(M); seenW[start] = 1; let n = 0;
    for (let q = [start]; q.length;) { const c = q.pop()!; n += 1; const x = c % W; for (const k of [c + 1, c - 1, c + W, c - W]) if (k >= 0 && k < M && Math.abs((k % W) - x) <= 1 && !seenW[k] && walkAt(k % W, Math.floor(k / W)) && !blocked.has(k) && !extra.includes(k)) { seenW[k] = 1; q.push(k); } }
    return n;
  };
  let reachNow = -1;
  const cutsWalk = (p: BboxPiece, x: number, y: number) => {
    if (reachNow < 0) reachNow = reachCount([]);
    const base: number[] = []; for (let d = 0; d < p.w; d += 1) { const k = idx(x + d, y + p.h - 1); if (walkAt(x + d, y + p.h - 1) && !blocked.has(k)) base.push(k); }
    return reachCount(base) < reachNow - base.length;
  };
  const put = (p: BboxPiece, x: number, y: number, room?: Reg) => {
    for (let ddy = 0; ddy < p.h; ddy += 1) for (let ddx = 0; ddx < p.w; ddx += 1) used.add(idx(x + ddx, y + ddy));
    if (p.place === "floor") { for (let d = 0; d < p.w; d += 1) if (walkAt(x + d, y + p.h - 1)) blocked.add(idx(x + d, y + p.h - 1)); reachNow = -1; }
    // 문 칸 둘레는 비운다(조각이 문을 막지 않게)
    const o = { id: p.name, x, y };
    if (room && !landmark.has(room)) landmark.set(room, o); else objects.push(o);
  };
  for (const d of doors) for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) used.add(idx(d.x + a, d.y + b));
  const near = (x0: number, y0: number, p: BboxPiece, ok: (x: number, y: number) => boolean): [number, number] | null => {
    for (let r = 0; r <= 4; r += 1) for (let ddy = -r; ddy <= r; ddy += 1) for (let ddx = -r; ddx <= r; ddx += 1) {
      if (Math.max(Math.abs(ddx), Math.abs(ddy)) !== r) continue;
      if (fits(p, x0 + ddx, y0 + ddy) && ok(x0 + ddx, y0 + ddy)) return [x0 + ddx, y0 + ddy];
    }
    return null;
  };
  const roomOfCell = (x: number, y: number) => { const r = regOf[idx(x, y)]!; return r >= 0 ? regs[r]! : undefined; };
  // 입구 계단: 입구 방 맨 윗줄 칸 위 두 줄(벽 앞면)
  const up = byName.get("stairs up");
  const northEdge = [...entrance.cells].filter((c) => !haz[c] && !openAt(c % W, Math.floor(c / W) - 1)).map((c) => ({ x: c % W, y: Math.floor(c / W) }))
    .sort((a, b) => a.y - b.y || Math.abs(a.x - ent.x) - Math.abs(b.x - ent.x));
  const doorNear = (x: number, y: number) => doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
  const upAt = up ? northEdge.find((c) => !doorNear(c.x, c.y) && fits(up, c.x, c.y - 2)) ?? northEdge.find((c) => fits(up, c.x, c.y - 2)) : undefined;
  if (up && upAt) { for (let d = 0; d < 2; d += 1) used.add(idx(upAt.x, upAt.y - 2 + d)); used.add(idx(upAt.x, upAt.y)); objects.push({ id: "stairs up", x: upAt.x, y: upAt.y - 2 }); }
  else notes.push("could not place the entrance stairs on the entrance room's north wall");
  // 도안 물건(큰 것 먼저)
  const objs = [...code.objects].sort((a, b) => b.w * b.h - a.w * a.h);
  for (const o of objs) {
    const pos = at(Math.min(cols - 1, o.x), Math.min(rows - 1, o.y));
    const rule = PIECE_WORDS.find(([re]) => re.test(o.name));
    const room = roomOfCell(pos.x, Math.min(H - 1, pos.y + Math.max(0, o.h - 1))) ?? roomOfCell(pos.x, pos.y);
    if (!rule) { missing.push({ name: o.name, x: pos.x, y: pos.y, w: o.w, h: o.h }); continue; }
    let done = false;
    for (const name of rule[1]) {
      const p = byName.get(name); if (!p) continue;
      const spot = near(pos.x, pos.y + Math.max(0, o.h - p.h), p, (x, y) => !room || roomOfCell(x, p.place === "wall" ? y + p.h : y + p.h - 1) === room);
      if (spot) { put(p, spot[0], spot[1], room); done = true; break; }
    }
    if (!done) notes.push(`plan object «${o.name}» had no free fitting spot`);
  }
  // 방마다 랜드마크·채움(한 조각 / 24 걷는 칸, 최소 2)
  for (const r of finalRegs) {
    const walk = [...r.cells].filter((c) => !haz[c]).length;
    const need = Math.max(2, Math.ceil(walk / BBOX_CELLS_PER_PIECE));
    const have = () => [...landmark.entries()].filter(([k]) => k === r).length + objects.filter((o) => { const p = byName.get(o.id)!; for (let d = 0; d < p.w; d += 1) for (const yy of [o.y + p.h - 1, o.y + p.h]) if (r.cells.has(idx(o.x + d, yy))) return true; return false; }).length;
    const ys = [...r.cells].map((c) => Math.floor(c / W)), y0 = Math.min(...ys);
    let tries = 0, added = 0;
    const cand = [...r.cells].sort((a, b) => (a * 7919) % 104729 - (b * 7919) % 104729);
    while (have() < need && tries < 4) {
      tries += 1;
      for (const name of tries % 2 ? FILL_WALL : FILL_FLOOR) {
        if (have() >= need) break;
        const p = byName.get(name); if (!p) continue;
        const spot = cand.map((c) => [c % W, Math.floor(c / W)] as const).map(([x, y]) => (p.place === "wall" ? [x, y0 - p.h] as const : [x, y - p.h + 1] as const)).find(([x, y]) => fits(p, x, y) && (p.place !== "wall" || r.cells.has(idx(x, y + p.h))));
        if (spot) { put(p, spot[0], spot[1], r); added += 1; }
      }
    }
    const grate = byName.get("grate floor");
    for (const c of cand) {
      if (have() >= need || !grate) break;
      const x = c % W, y = Math.floor(c / W);
      if (fits(grate, x, y)) { put(grate, x, y, r); added += 1; }
    }
    if (added) notes.push(`${r.name}: added ${added} filler piece(s) (one per ${BBOX_CELLS_PER_PIECE} cells rule)`);
  }
  // ── 8. 적·보스·상자 ──
  const solid = new Set<number>();
  for (const o of [...objects, ...landmark.values()]) { const p = byName.get(o.id)!; if (p.place === "floor") for (let d = 0; d < p.w; d += 1) solid.add(idx(o.x + d, o.y + p.h - 1)); }
  const reachable = new Uint8Array(M);
  {
    const st = objects.find((o) => o.id === "stairs up");
    const s0 = st ? idx(st.x, st.y + 2) : [...entrance.cells].find((c) => !haz[c]);
    if (s0 !== undefined) for (let q = [s0], h = (reachable[s0] = 1, 0); h < q.length; h += 1) { const c = q[h]!, x = c % W; for (const n of [c + 1, c - 1, c + W, c - W]) if (n >= 0 && n < M && Math.abs((n % W) - x) <= 1 && !reachable[n] && walkAt(n % W, Math.floor(n / W)) && !solid.has(n)) { reachable[n] = 1; q.push(n); } }
  }
  const free = (r: Reg) => [...r.cells].filter((c) => !haz[c] && !used.has(c) && reachable[c]).map((c) => ({ x: c % W, y: Math.floor(c / W) }));
  const bossFree = free(boss);
  const bossAt = bossFree.sort((a, b) => a.y - b.y)[Math.floor(bossFree.length / 3)];
  if (bossAt) used.add(idx(bossAt.x, bossAt.y));
  const enemies: { x: number; y: number }[] = [];
  const foeRooms = finalRegs.filter((r) => r !== boss && r !== entrance).sort((a, b) => (a.purpose === "guard" ? -1 : 0) - (b.purpose === "guard" ? -1 : 0) || b.cells.size - a.cells.size);
  const needFoes = Math.max(2, finalRegs.length - 3);
  for (let i = 0; enemies.length < needFoes && i < foeRooms.length * 2; i += 1) {
    const r = foeRooms[i % foeRooms.length]!; const f = free(r); const c = f[Math.floor(f.length / 2) + (i >= foeRooms.length ? 1 : 0)];
    if (c) { enemies.push(c); used.add(idx(c.x, c.y)); }
  }
  const chests = finalRegs.filter((r) => r.purpose === "treasure").flatMap((r) => { const f = free(r); const c = f[f.length - 1]; if (c) used.add(idx(c.x, c.y)); return c ? [c] : []; });
  const layout: BboxDungeonLayout = {
    name: code.zones[0]?.name ?? "dungeon", theme, map: { w: W, h: H },
    rooms: finalRegs.map((r) => ({ id: r.id, purpose: r.purpose, rects: rectsOf(r.cells), ...(landmark.get(r) ? { landmark: landmark.get(r)! } : {}), note: r.name })),
    corridors: [], doors,
    hazards: [...Array(M).keys()].filter((m) => haz[m] && regOf[m]! >= 0 && regs[regOf[m]!]!.cells.has(m)).map((m) => ({ kind: haz[m] === 3 ? "pit" as const : "water" as const, x: m % W, y: Math.floor(m / W), w: 1, h: 1 })),
    bridges: [], objects, chests, enemies, ...(bossAt ? { boss: bossAt } : {}),
  };
  return { layout, notes, missing, rowMap, dx };
}
