/**
 * 설계도 검사 + 확정(bp_fit.py 이식). 설계도가 이긴다: '.' 칸은 그림이 뭘 그렸든 투명, X 칸은 불투명(빈 구멍은 이웃 색),
 * 입구는 위 검정 + 아래 원본 문. 검사는 칸 칠함·칸 비움·입구 유지·입구 경계·가짜 문·접근칸 도달·갇힌 마당·지붕/앞벽 구역·처마선.
 * 판정 키(한글 문장)는 bp_fit.py 와 같다 — 두 검사기의 결과를 그대로 대조할 수 있게.
 */
import type { BuildingBlueprint, ReferenceLayout, StyleKit } from "./blueprintTypes.ts";
import {
  boxes, createNearest, createRaster, dilateCross, label, lum, medianTrunc, nearestSource, resizeBilinear,
  type Raster, type Rgb,
} from "./raster.ts";

export interface BlueprintDoor { readonly x: number; readonly y: number; readonly front: readonly [number, number] }

export interface EffectiveBlueprint {
  readonly w: number;
  readonly h: number;
  /** 그림이 설계도 위로 솟아 늘린 머리 줄 수(굴뚝·첨탑). */
  readonly headExtra: number;
  readonly map: readonly string[];
  readonly passmap: readonly string[];
  readonly layers: readonly string[];
  readonly doors: readonly BlueprintDoor[];
}

export interface BlueprintFitResult {
  readonly pass: boolean;
  readonly checks: Readonly<Record<string, boolean>>;
  readonly snapped: number;
  readonly badFill: readonly [number, number, number][];
  readonly badEmpty: readonly [number, number, number][];
  readonly doorLum: number;
  readonly gateLum: number;
  readonly fakes: readonly [number, number, number, number][];
  readonly doorOver: number;
  readonly zone: {
    readonly roofInR: number; readonly roofInW: number; readonly eaveCells: number; readonly eaveOffN: number;
  } | null;
  readonly reached: number;
  readonly yardUnreached: number;
  readonly headExtra: number;
  readonly headClippedTop: boolean;
  readonly outlineFolded: number;
  readonly paletteDE: number;
  /** 확정 그림(설계도 칸 × 16px, 머리 줄 포함). */
  readonly art: Raster;
  readonly effective: EffectiveBlueprint;
}

const E = 3;   // 설계도 위로 더 보는 머리 칸 수

/** 설계도를 잔디밭 가운데 두고(사방 margin 칸) 맵 아래 가운데에서 BFS. X·D 만 막힘. */
function reachable(pm: readonly string[], starts: readonly (readonly [number, number])[], margin = 3): Set<string> {
  const H = pm.length, W = pm[0]!.length, MW = W + 2 * margin, MH = H + 2 * margin;
  const ok = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < MW && y < MH
    && !(x >= margin && x < margin + W && y >= margin && y < margin + H && "XD".includes(pm[y - margin]![x - margin]!));
  const seen = new Set([`${MW >> 1},${MH - 1}`]);
  const q: [number, number][] = [[MW >> 1, MH - 1]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = `${x + dx},${y + dy}`;
      if (!seen.has(k) && ok(x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); }
    }
  }
  return new Set(starts.filter(([sx, sy]) => seen.has(`${sx + margin},${sy + margin}`)).map(([sx, sy]) => `${sx},${sy}`));
}

const same = (a: Rgb, r: number, g: number, b: number): boolean => a[0] === r && a[1] === g && a[2] === b;
const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;

export function fitBlueprintCandidate(rawIn: Raster, bp: BuildingBlueprint, kit: StyleKit, ref: ReferenceLayout): BlueprintFitResult {
  const T = kit.tile, K = ref.scale, [ox, oy] = ref.origin;
  const m = bp.map, H = m.length, W = m[0]!.length, PH = H * T, PW = W * T;
  const raw = resizeBilinear(rawIn, ref.width, ref.height);
  const CW = raw.width, CH = raw.height;
  // 자홍 위에 합성 → RGB, 배경 판정
  const A = new Int32Array(CW * CH * 3), bg = new Uint8Array(CW * CH);
  for (let i = 0; i < CW * CH; i++) {
    const al = raw.data[i * 4 + 3]! / 255;
    const r = Math.round(raw.data[i * 4]! * al + 255 * (1 - al));
    const g = Math.round(raw.data[i * 4 + 1]! * al);
    const b = Math.round(raw.data[i * 4 + 2]! * al + 255 * (1 - al));
    A[i * 3] = r; A[i * 3 + 1] = g; A[i * 3 + 2] = b;
    bg[i] = r > 170 && b > 170 && g < 110 ? 1 : 0;
  }
  // 칸 좌표 (py, px) ← 기준 이미지의 K×K 블록 중앙값. 캔버스 밖은 배경.
  const sampleBlock = (cy: number, cx: number, out: number[]): boolean => {
    let fg = true;
    const vs: number[][] = [[], [], []];
    for (let dy = 0; dy < K; dy++) {
      for (let dx = 0; dx < K; dx++) {
        const y = cy + dy, x = cx + dx;
        if (y < 0 || x < 0 || y >= CH || x >= CW) { fg = false; vs[0]!.push(255); vs[1]!.push(0); vs[2]!.push(255); continue; }
        const i = y * CW + x;
        if (bg[i]) fg = false;
        vs[0]!.push(A[i * 3]!); vs[1]!.push(A[i * 3 + 1]!); vs[2]!.push(A[i * 3 + 2]!);
      }
    }
    out[0] = medianTrunc(vs[0]!); out[1] = medianTrunc(vs[1]!); out[2] = medianTrunc(vs[2]!);
    return fg;
  };
  const sampleRegion = (topY: number, rows: number): { samp: Int32Array; fg: Uint8Array } => {
    const samp = new Int32Array(rows * PW * 3), fg = new Uint8Array(rows * PW), px: number[] = [0, 0, 0];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < PW; x++) {
        fg[y * PW + x] = sampleBlock(topY + y * K, ox + x * K, px) ? 1 : 0;
        samp.set(px, (y * PW + x) * 3);
      }
    }
    return { samp, fg };
  };
  const { samp, fg } = sampleRegion(oy, PH);
  const N = PH * PW;
  const cellOf = (i: number): [number, number] => { const x = i % PW; return [Math.floor(x / T), Math.floor((i - x) / PW / T)]; };
  const cellMask = (pred: (x: number, y: number) => boolean): Uint8Array => {
    const out = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const [cx, cy] = cellOf(i); out[i] = pred(cx, cy) ? 1 : 0; }
    return out;
  };
  const isSolid = (x: number, y: number): boolean => "XDGA".includes(m[y]![x]!);
  const topb = Array.from({ length: W }, (_, x) => { for (let y = 0; y < H; y++) if (isSolid(x, y)) return y; return H; });
  const isSky = (x: number, y: number): boolean => m[y]![x] === "." && y < topb[x]!;
  const isHead = (x: number, y: number): boolean => m[y]![x] === "*";
  // 칸 칠함 비율
  const cov = new Float64Array(W * H);
  for (let i = 0; i < N; i++) if (fg[i]) { const [cx, cy] = cellOf(i); cov[cy * W + cx]! += 1 / (T * T); }
  const badFill: [number, number, number][] = [], badEmpty: [number, number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = cov[y * W + x]!;
      if (isSolid(x, y) && c < 0.9) badFill.push([x, y, round(c, 2)]);
      if (!isSolid(x, y) && !isHead(x, y) && !isSky(x, y) && c > 0.1) badEmpty.push([x, y, round(c, 2)]);
    }
  }
  const L = new Float64Array(N);
  for (let i = 0; i < N; i++) L[i] = lum(samp[i * 3]!, samp[i * 3 + 1]!, samp[i * 3 + 2]!);
  const dpx = cellMask((x, y) => m[y]![x] === "D"), gpx = cellMask((x, y) => m[y]![x] === "G");
  const meanWhere = (mask: Uint8Array): number => { let s = 0, n = 0; for (let i = 0; i < N; i++) if (mask[i]) { s += L[i]!; n++; } return n ? s / n : 0; };
  const doorLum = meanWhere(dpx), hasGate = gpx.some(Boolean), gateLum = hasGate ? meanWhere(gpx) : 0;
  // 가짜 문: 입구 칸 밖의 어두운 덩어리(문 크기 이상)
  const near = dilateCross(dpx.map((v, i) => v | gpx[i]!), PW, PH, 3);
  const dark = new Uint8Array(N);
  for (let i = 0; i < N; i++) dark[i] = L[i]! < 22 && fg[i] && !near[i] ? 1 : 0;
  const dl = label(dark, PW, PH);
  const fakes: [number, number, number, number][] = [];
  boxes(dl.labels, dl.count, PW).forEach(([bx0, by0, bx1, by1], k) => {
    const w = bx1 - bx0, h = by1 - by0;
    if (!(w >= 9 && w <= 40 && h >= 16 && h >= 0.9 * w)) return;
    let n = 0;
    for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) if (dl.labels[y * PW + x] === k + 1) n++;
    if (n / (w * h) >= 0.7) fakes.push([Math.floor(bx0 / T), Math.floor(by0 / T), w, h]);
  });
  // 입구: 세로로 이어진 D 칸의 맨 아래가 이벤트 칸, 그 아래가 접근칸
  const doors: BlueprintDoor[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (m[y]![x] === "D" && !(y + 1 < H && m[y + 1]![x] === "D")) doors.push({ x, y, front: [x, y + 1] });
  }
  const frontsOk = doors.filter((d) => d.front[1] >= H || m[d.front[1]]![d.front[0]] === ".").length;
  const reached = reachable(m, doors.map((d) => d.front)).size;
  const yard: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y]![x] === ".") yard.push([x, y]);
  const yardUnreached = yard.length - reachable(m, yard).size;
  // 팔레트 잠금(Lab 최근접) + 지붕 명암 맞춤
  const pal = kit.palette, nearest = createNearest(pal);
  const lk = new Int32Array(samp);
  let dSum = 0, dN = 0;
  for (let i = 0; i < N; i++) {
    if (!fg[i]) continue;
    const r = nearest(samp[i * 3]!, samp[i * 3 + 1]!, samp[i * 3 + 2]!), c = pal[r.index]!;
    lk[i * 3] = c[0]; lk[i * 3 + 1] = c[1]; lk[i * 3 + 2] = c[2];
    dSum += Math.sqrt(r.d2); dN++;
  }
  toneRoof(lk, samp, fg, kit);
  // 입구 경계: 입구 칸과 이어진 순검정이 입구 칸 밖으로 번진 폭
  const black = pal.reduce((a, c) => (lum(...c) < lum(...a) ? c : a));
  const blk = new Uint8Array(N);
  for (let i = 0; i < N; i++) blk[i] = fg[i] && same(black, lk[i * 3]!, lk[i * 3 + 1]!, lk[i * 3 + 2]!) ? 1 : 0;
  const lbk = label(blk, PW, PH);
  const dcell = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) dcell[y * W + x] = m[y]![x] === "D" ? 1 : 0;
  const dgroups = label(dcell, W, H);
  const spill = new Uint8Array(N);
  let doorOver = 0;
  for (let gi = 1; gi <= dgroups.count; gi++) {
    const gp = cellMask((x, y) => dgroups.labels[y * W + x] === gi);
    const ids = new Set<number>();
    let gx0 = Infinity, gx1 = -1, gy0 = Infinity;
    for (let i = 0; i < N; i++) {
      if (!gp[i]) continue;
      const x = i % PW, y = (i - x) / PW;
      gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gy0 = Math.min(gy0, y);
      if (blk[i] && lbk.labels[i]) ids.add(lbk.labels[i]!);
    }
    const around = dilateCross(gp, PW, PH, 8);
    let sx0 = Infinity, sx1 = -1, sy0 = Infinity, any = false;
    for (let i = 0; i < N; i++) {
      if (!around[i] || gp[i] || !ids.has(lbk.labels[i]!)) continue;
      const x = i % PW, y = (i - x) / PW;
      spill[i] = 1; any = true;
      sx0 = Math.min(sx0, x); sx1 = Math.max(sx1, x); sy0 = Math.min(sy0, y);
    }
    if (any) doorOver = Math.max(doorOver, gx0 - sx0, sx1 - gx1, gy0 - sy0, 0);
  }
  // 지붕/앞벽 구역과 처마선
  const z = bp.zones;
  let zone: BlueprintFitResult["zone"] = null;
  if (z) {
    const isRoof = new Uint8Array(N);
    for (let i = 0; i < N; i++) isRoof[i] = fg[i] && kit.roofColors.some((c) => same(c, lk[i * 3]!, lk[i * 3 + 1]!, lk[i * 3 + 2]!)) ? 1 : 0;
    const rf = new Float64Array(W * H);
    for (let i = 0; i < N; i++) if (isRoof[i]) { const [cx, cy] = cellOf(i); rf[cy * W + cx]! += 1 / (T * T); }
    let rs = 0, rn = 0, ws = 0, wn = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (z[y]![x] === "R") { rs += rf[y * W + x]!; rn++; }
      if (z[y]![x] === "W") { ws += rf[y * W + x]!; wn++; }
    }
    let eaveCells = 0, eaveOffN = 0;
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
      if (z[y - 1]![x] !== "R" || z[y]![x] !== "W") continue;
      const w0 = Math.max(0, y * T - 12), w1 = Math.min(PH, y * T + 12);
      let rows = 0;
      for (let yy = w0; yy < w1; yy++) {
        let s = 0;
        for (let xx = x * T; xx < (x + 1) * T; xx++) s += isRoof[yy * PW + xx]!;
        if (s / T >= 0.5) rows++;
      }
      eaveCells++;
      if (Math.abs(rows - (y * T - w0)) > 4) eaveOffN++;
    }
    zone = { roofInR: round(rn ? rs / rn : 0, 2), roofInW: round(wn ? ws / wn : 0, 2), eaveCells, eaveOffN };
  }
  const hardFill = badFill.filter((c) => c[2] < 0.8), hardEmpty = badEmpty.filter((c) => c[2] > 0.2);
  const checks: Record<string, boolean> = {
    "모양 일치(20% 넘게 빈 X 칸 없음)": hardFill.length === 0,
    "모양 일치(20% 넘게 칠한 . 칸 없음)": hardEmpty.length === 0,
    "입구 유지": doorLum <= 45,
    "가짜 문 없음": fakes.length === 0,
    "접근칸이 땅": frontsOk === doors.length,
    "접근칸 도달": reached === doors.length,
    "빈 땅 전부 도달(갇힌 마당 없음)": yardUnreached === 0,
    ...(hasGate ? { "성문 통로 어두움": gateLum <= 70 } : {}),
    "입구 경계 일치(검정이 입구 칸 밖으로 4도트 이상 번지지 않음)": doorOver <= 3,
    ...(zone ? {
      "지붕 구역이 지붕(평균 ≥0.6)": zone.roofInR >= 0.6,
      "앞벽 구역에 지붕 없음(평균 ≤0.12)": zone.roofInW <= 0.12,
      "처마선이 파란 선에(±4도트, 칸 90% 이상)": zone.eaveOffN <= 0.1 * zone.eaveCells,
    } : {}),
  };
  // ── 확정: 설계도대로 ──
  const spx = cellMask(isSolid);
  const fill = new Int32Array(lk);
  const copyFrom = (dst: number, src: number): void => { fill[dst * 3] = fill[src * 3]!; fill[dst * 3 + 1] = fill[src * 3 + 1]!; fill[dst * 3 + 2] = fill[src * 3 + 2]!; };
  const painted = spx.map((v, i) => v & fg[i]!);
  if (spx.some((v, i) => v && !fg[i])) {                 // X칸 안 빈 픽셀은 가장 가까운 칠한 픽셀 색으로
    const idx = nearestSource(painted, PW, PH);
    for (let i = 0; i < N; i++) if (spx[i] && !fg[i] && idx[i]! >= 0) { fill[i * 3] = lk[idx[i]! * 3]!; fill[i * 3 + 1] = lk[idx[i]! * 3 + 1]!; fill[i * 3 + 2] = lk[idx[i]! * 3 + 2]!; }
  }
  if (spill.some(Boolean)) {                              // 입구 밖으로 번진 검정은 가장 가까운 벽 픽셀 색으로
    const idx = nearestSource(painted.map((v, i) => v & (spill[i]! ^ 1) & (blk[i]! ^ 1)), PW, PH);
    for (let i = 0; i < N; i++) if (spill[i] && idx[i]! >= 0) copyFrom(i, idx[i]!);
  }
  let art = createRaster(PW, PH);
  const setArt = (i: number, r: number, g: number, b: number): void => { art.data[i * 4] = r; art.data[i * 4 + 1] = g; art.data[i * 4 + 2] = b; art.data[i * 4 + 3] = 255; };
  for (let i = 0; i < N; i++) if (spx[i]) setArt(i, fill[i * 3]!, fill[i * 3 + 1]!, fill[i * 3 + 2]!);
  // 옆 윤곽 접기: 몸통이 1도트 넓게 그려져 바깥 윤곽이 칸 밖으로 잘리면 그 윤곽색을 가장자리 픽셀에 얹는다
  let outlineFolded = 0;
  const px3: number[] = [0, 0, 0];
  for (const [dx, xi] of [[-1, 0], [PW, PW - 1]] as const) {
    for (let y = 0; y < PH; y++) {
      const cfg = sampleBlock(oy + y * K, ox + dx * K, px3);
      const i = y * PW + xi;
      if (!cfg || !spx[i] || lum(px3[0]!, px3[1]!, px3[2]!) >= 70) continue;
      if (lum(art.data[i * 4]!, art.data[i * 4 + 1]!, art.data[i * 4 + 2]!) >= 70) {
        const c = pal[nearest(px3[0]!, px3[1]!, px3[2]!).index]!;
        setArt(i, c[0], c[1], c[2]); outlineFolded++;
      }
    }
  }
  // 머리 공간: 설계도 위로 E칸까지 더 본다. 몸통과 8방향으로 이어진 그림만 남기고, 위로 넘친 만큼 칸을 늘린다.
  const ER = E * T;
  const ext = sampleRegion(oy - ER * K, ER);
  const le = new Int32Array(ext.samp);
  for (let i = 0; i < ER * PW; i++) if (ext.fg[i]) { const c = pal[nearest(ext.samp[i * 3]!, ext.samp[i * 3 + 1]!, ext.samp[i * 3 + 2]!).index]!; le.set(c, i * 3); }
  const hl = cellMask((x, y) => isHead(x, y) || isSky(x, y));
  const comb = new Uint8Array((ER + PH) * PW), body = new Uint8Array((ER + PH) * PW);
  comb.set(ext.fg, 0);
  for (let i = 0; i < N; i++) { comb[ER * PW + i] = fg[i] && (spx[i] || hl[i]) ? 1 : 0; body[ER * PW + i] = painted[i]!; }
  const lh = label(comb, PW, ER + PH, true);
  const bodyIds = new Set<number>();
  for (let i = 0; i < body.length; i++) if (body[i] && lh.labels[i]) bodyIds.add(lh.labels[i]!);
  const keep = (i: number): boolean => !body[i] && bodyIds.has(lh.labels[i]!);
  let minRow = -1;
  for (let i = 0; i < ER * PW && minRow < 0; i++) if (keep(i)) minRow = Math.floor(i / PW);
  const headExtra = minRow >= 0 ? Math.ceil((ER - minRow) / T) : 0;
  let headClippedTop = false;
  for (let x = 0; x < PW; x++) if (keep(x)) headClippedTop = true;
  for (let i = 0; i < N; i++) if (hl[i] && keep(ER * PW + i)) setArt(i, lk[i * 3]!, lk[i * 3 + 1]!, lk[i * 3 + 2]!);
  if (headExtra) {
    const grown = createRaster(PW, PH + headExtra * T);
    grown.data.set(art.data, headExtra * T * PW * 4);
    const from = ER - headExtra * T;
    for (let y = 0; y < headExtra * T; y++) for (let x = 0; x < PW; x++) {
      const si = (from + y) * PW + x;
      if (!keep(si)) continue;
      const di = (y * PW + x) * 4;
      grown.data[di] = le[si * 3]!; grown.data[di + 1] = le[si * 3 + 1]!; grown.data[di + 2] = le[si * 3 + 2]!; grown.data[di + 3] = 255;
    }
    art = grown;
  }
  // 입구: 이어진 D 칸 중 맨 아래 = 원본 문, 그 위 = 완전 검정
  const paintCell = (cx: number, cy: number, tile: Uint8Array | null): void => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const di = ((cy * T + y) * PW + cx * T + x) * 4;
      if (tile) art.data.set(tile.subarray((y * T + x) * 4, (y * T + x) * 4 + 4), di);
      else art.data.set([0, 0, 0, 255], di);
    }
  };
  for (const d of doors) {
    paintCell(d.x, d.y + headExtra, kit.doorTile);
    for (let yy = d.y - 1; yy >= 0 && m[yy]![d.x] === "D"; yy--) paintCell(d.x, yy + headExtra, null);
  }
  // 실제 설계도: 늘린 머리 줄 + 그림이 올라온 하늘 칸을 '*' 로
  const cellHas = (cy: number, cx: number): boolean => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (art.data[((cy * T + y) * PW + cx * T + x) * 4 + 3]) return true;
    return false;
  };
  const meff = [
    ...Array.from({ length: headExtra }, () => "*".repeat(W)),
    ...m.map((row, y) => [...row].map((c, x) => (isSky(x, y) && cellHas(y + headExtra, x) ? "*" : c)).join("")),
  ];
  const effective: EffectiveBlueprint = {
    w: W,
    h: H + headExtra,
    headExtra,
    map: meff,
    passmap: meff.map((row) => [...row].map((c) => ("XD".includes(c) ? "X" : ".")).join("")),
    layers: meff.map((row) => [...row].map((c) => ("A*".includes(c) ? "U" : "XDG".includes(c) ? "L" : "-")).join("")),
    doors: doors.map((d) => ({ x: d.x, y: d.y + headExtra, front: [d.front[0], d.front[1] + headExtra] as const })),
  };
  return {
    pass: Object.values(checks).every(Boolean),
    checks,
    snapped: badFill.length + badEmpty.length,
    badFill, badEmpty,
    doorLum: round(doorLum, 1), gateLum: round(gateLum, 1),
    fakes, doorOver, zone, reached, yardUnreached,
    headExtra, headClippedTop, outlineFolded,
    paletteDE: round(dN ? dSum / dN : 0, 1),
    art, effective,
  };
}

/**
 * 지붕 명암 비중 맞춤. 지붕색으로 잠긴 픽셀만, 그림의 밝기 순서는 그대로 두고 명암 단(진보라·적갈·주황·크림) 비중을
 * 화풍 기준 집 지붕에 맞춘다. 단 안의 쌍둥이 색은 원래 잠긴 쪽.
 */
function toneRoof(lk: Int32Array, samp: Int32Array, fg: Uint8Array, kit: StyleKit): void {
  const rc = kit.roofColors, share = kit.roofShare, RL = rc.map((c) => lum(...c));
  const order = rc.map((_, i) => i).sort((a, b) => RL[a]! - RL[b]! || a - b);
  const bands: number[][] = [];
  let cur = [order[0]!];
  for (const i of order.slice(1)) {
    if (RL[i]! - RL[cur[cur.length - 1]!]! > 10) { bands.push(cur); cur = [i]; } else cur.push(i);
  }
  bands.push(cur);
  const px: number[] = [];
  for (let i = 0; i < fg.length; i++) {
    if (fg[i] && rc.some((c) => same(c, lk[i * 3]!, lk[i * 3 + 1]!, lk[i * 3 + 2]!))) px.push(i);
  }
  if (px.length < 64) return;
  const L = px.map((i) => lum(samp[i * 3]!, samp[i * 3 + 1]!, samp[i * 3 + 2]!));
  const byLum = px.map((_, k) => k).sort((a, b) => L[a]! - L[b]! || a - b);
  const rank = new Float64Array(px.length);
  byLum.forEach((k, r) => { rank[k] = r / Math.max(1, px.length - 1); });
  const cut: number[] = [];
  bands.reduce((s, b) => { const t = s + b.reduce((u, j) => u + share[j]!, 0); cut.push(t); return t; }, 0);
  px.forEach((i, k) => {
    let bi = 0;
    while (bi < cut.length - 1 && cut[bi]! <= rank[k]!) bi++;
    const cols = bands[bi]!;
    if (cols.some((j) => same(rc[j]!, lk[i * 3]!, lk[i * 3 + 1]!, lk[i * 3 + 2]!))) return;
    const main = cols.reduce((a, j) => (share[j]! > share[a]! ? j : a), cols[0]!);
    lk[i * 3] = rc[main]![0]; lk[i * 3 + 1] = rc[main]![1]; lk[i * 3 + 2] = rc[main]![2];
  });
}
