// 깎아지른 면(relief.style "sheer", styles.ts sheer.faceRows)의 뒤 패스 — renderRelief 가 높이를 faceRows 배로 들어 기하(윗면·벽 화소)를 만든 뒤
// 그 화소에 조각(sheerArt.ts)을 입힌다. 다른 양식은 이 패스를 지나지 않는다(그림이 예전과 한 바이트도 다르지 않다).
//
// 순서: 빈 곳(0 단 = 하늘, 투명) → 앞면(열마다 판을 읽되 4px 계단으로 묶는다) → 옆으로 도는 면(윤곽을 따라 좁아진다) → 윗면 테 →
// 낭떠러지 밑(빈 곳 위로 떨어지는 그늘) → 땅에 드리운 그늘 → 사다리·덩굴 → 구름다리.
// 명암은 곱하지 않는다 — 바위 색 줄(art.rock) 안에서 단을 옮긴다. 풀 테 화소는 옮기지 않는다(2026-11-16 감독 결정).
import type { SheerArt } from "./sheerArt";
import type { ReliefArtPatch, ReliefSlope } from "./render";

const T = 16;

export interface SheerSurface {
  readonly rgba: Uint8ClampedArray;
  readonly kind: Int8Array;
  readonly lev: Int8Array;
  readonly dep: Int16Array;
  readonly run: Int16Array;
  readonly src: Int32Array;
  readonly fl: Float32Array;
  readonly ssl: Int16Array;
  readonly edge: Uint8Array;
  readonly mpy: Int32Array;
  /** 맵 화소 높이(창 격자, faceRows 배) — 행 우선 PW 폭 */
  readonly hf: Float32Array;
  readonly PW: number;
  readonly SH: number;
  readonly pad: number;
  /** 창 굽기의 원점(px). 무늬는 절대 좌표로 읽는다. */
  readonly ox: number;
  readonly oy: number;
  /** 창의 칸 원점 */
  readonly cx0: number;
  readonly cy0: number;
  /** 단 하나의 화면 px(16 × faceRows) */
  readonly levelPx: number;
  readonly underDeck: Uint8Array;
  /** 다리 판 밑면(벽 2줄) — 면 · 낭떠러지 그늘을 얹지 않는다 */
  readonly deckUnder: Uint8Array;
  readonly bridge: ArrayLike<number> | undefined;
  /** 그리는 높이(창 격자, faceRows 배) */
  readonly h: readonly (readonly number[])[];
  /** 창 격자 폭(칸) */
  readonly W: number;
  /** 세로 이동 칸(walk.ts 10 줄사다리 · 11 덩굴) — 맵 전체 좌표, lo·hi 는 이미 faceRows 배 */
  readonly climbs: readonly ReliefSlope[];
  /** 폭포(relief.falls) — 맵 전체 좌표. 칸 x..x+w-1 · y 의 남쪽 면 한 띠 */
  readonly falls?: readonly { readonly x: number; readonly y: number; readonly w: number }[];
}

const h32 = (a: number, b: number, c: number) => { let v = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f); v ^= v >>> 15; v = Math.imul(v, 0x2c1b3c6d); return (v ^ (v >>> 13)) >>> 0; };
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** 바위 색 줄 안에서 단 옮기기. 줄에 없는 색(풀 테 · 이끼)은 그대로 둔다. */
function rockShifter(art: SheerArt): (rgb: number, s: number) => number {
  const index = new Map<number, number>();
  art.rock.forEach(([r, g, b], k) => index.set((r << 16) | (g << 8) | b, k));
  return (rgb, s) => {
    if (!s) return rgb;
    const k = index.get(rgb);
    if (k === undefined) return rgb;
    const [r, g, b] = art.rock[Math.max(0, Math.min(art.rock.length - 1, k + s))]!;
    return (r << 16) | (g << 8) | b;
  };
}
/** 조각 화소(알파 0 이면 -1). */
function at(p: ReliefArtPatch, x: number, y: number): number {
  const q = (mod(y, p.h) * p.w + mod(x, p.w)) * 4;
  return p.rgba[q + 3]! ? (p.rgba[q]! << 16) | (p.rgba[q + 1]! << 8) | p.rgba[q + 2]! : -1;
}
/**
 * 면 판의 줄: v = 윗면 가장자리에서 내려온 줄(묶은 값), n = 면 높이(px), fromBottom = 면 발치까지 남은 줄. 판 높이 ph(48 또는 96).
 * 윗테(0~15) → 몸통(48 판 16~31 · 96 판 16~79, 되풀이) → 밑동(마지막 16줄, 발치에 붙인다).
 */
function panelRow(v: number, fromBottom: number, ph: number): number {
  if (fromBottom < 16) return ph - 1 - fromBottom;
  if (v < 16) return v;
  return 16 + mod(v - 16, ph === 48 ? 16 : 64);
}

export function paintSheer(s: SheerSurface, art: SheerArt): void {
  const { rgba, kind, lev, dep, run, src, fl, ssl, edge, mpy, PW, SH, pad, ox, oy, levelPx } = s;
  const N = PW * SH, shift = rockShifter(art);
  const put = (i: number, rgb: number) => { const o = i * 4; rgba[o] = rgb >> 16; rgba[o + 1] = (rgb >> 8) & 255; rgba[o + 2] = rgb & 255; rgba[o + 3] = 255; };
  const isVoid = (i: number) => kind[i] === -1 || (kind[i] === 0 && lev[i] === 0 && fl[i]! < 1e-6 && !ssl[i]);
  const isTop = (i: number, c: number) => kind[i] === 0 && Math.abs(fl[i]! - c) <= 0.3 && !ssl[i];
  const low = (i: number, c: number) => kind[i] === -1 || (kind[i] === 0 && fl[i]! < c - 0.5);
  // 1) 빈 곳: 0 단(하늘)은 투명 — 맵 배경이 비친다
  const voidPx = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (isVoid(i) || s.underDeck[i] && lev[i] === 0) { voidPx[i] = 1; rgba[i * 4 + 3] = 0; }
  // 2) 앞면: 열마다 판을 읽는다. 가장자리 화소 줄은 4px 계단으로 묶어(바위 덩이가 열마다 찢기지 않게) 판 세로 원점을 정한다.
  const top = (i: number) => ((i / PW) | 0) - dep[i]!;
  // 엽 끝 조각: 열마다 윗면(풀)이 끝나고 바위가 시작하는 줄
  const lobeEdge = (p: ReliefArtPatch | undefined) => p ? Array.from({ length: p.w }, (_, x) => { for (let y = 0; y < p.h; y++) { const v = at(p, x, y); if (v >= 0 && !(((v >> 8) & 255) > (v >> 16) + 12 && ((v >> 8) & 255) > (v & 255))) return y; } return p.h; }) : [];
  const lobe48 = art.lobe, lobe96 = art.lobe96, e48 = lobeEdge(lobe48), e96 = lobeEdge(lobe96);
  const faceAt = (j: number, c: number) => kind[j] === 1 && lev[j] === c && !ssl[j] && !s.underDeck[j] && !s.deckUnder[j];
  const dark = (v: number) => v >= 0 && 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) < 46;
  const lobePx = (col: number, r: number, n: number, rise: number): number => {
    if (rise >= 2 && lobe96 && col < 32) { const rr = e96[col]! + r; return rr < lobe96.h ? at(lobe96, col, rr) : -1; }
    if (!lobe48) return -1;
    const rr = e48[col]! + (r >= n - 12 ? 48 + (r - (n - 12)) : r < 36 ? r : 12 + mod(r - 36, 24));
    return rr < lobe48.h ? at(lobe48, col, rr) : -1;
  };
  const panelPx = (j: number) => { const x = j % PW, yy = (j / PW) | 0, dd = dep[j]!, nn = run[j]!, cc = lev[j]!, ps = Math.max(1, Math.round(nn / levelPx)) === 1 ? art.face48 : art.face96;
    const pn = ps[h32(Math.floor((x + ox) / 64), cc, 11) % ps.length]!; return at(pn, x + ox, panelRow(dd, nn - 1 - dd, pn.h)); void yy; };
  /** 면 화소 i 가 엽 끝 32px 안이면 그 조각 화소(아니면 -1). 면이 맵 끝·다른 면에서 끊긴 곳은 엽 끝이 아니다. */
  const lobeAt = (i: number, sx: number, sy: number, d: number, n: number, c: number, ax: number): number => {
    if (!lobe48 && !lobe96) return -1;
    const rise = Math.max(1, Math.round(n / levelPx)), row = sy * PW;
    for (const dir of [1, -1] as const) {
      let k = 0; while (k < 32 && faceAt(row + sx + dir * (k + 1), c) && sx + dir * (k + 1) >= 0 && sx + dir * (k + 1) < PW) k++;
      if (k >= 32) continue;
      const beyond = sx + dir * (k + 1); if (beyond < 0 || beyond >= PW || kind[row + beyond] === 1) continue;
      // 반대쪽도 32px 안에서 끝나면(아주 좁은 면) 가까운 쪽만
      const col = dir > 0 ? 63 - k : k, din = 31 - k;
      let use = lobePx(col, d, n, rise);
      if (use < 0) return -1;
      if (din <= 9) {
        // 이음: 여기서 조각 안쪽 끝까지 사이에 어두운 틈이 있어야 조각을 쓴다(틈을 따라 이음이 구불거린다)
        let ok = false;
        for (let q = 0; q <= din && !ok; q++) { const xx = sx - dir * (din - q); if (xx < 0 || xx >= PW || !faceAt(row + xx, c)) { ok = true; break; } if (dark(panelPx(row + xx)) || dark(lobePx(dir > 0 ? 63 - (k + din - q) : k + din - q, d, n, rise))) ok = true; }
        if (!ok) return -1;
      }
      void ax; return use;
    }
    return -1;
  };
  for (let i = 0; i < N; i++) {
    if (kind[i] !== 1 || ssl[i] || s.underDeck[i] || s.deckUnder[i]) continue;
    const sx = i % PW, sy = (i / PW) | 0, d = dep[i]!, n = run[i]!, c = lev[i]!, ax = sx + ox;
    const rise = Math.max(1, Math.round(n / levelPx)), panels = rise === 1 ? art.face48 : art.face96;
    const panel = panels[h32(Math.floor(ax / 64), c, 11) % panels.length]!;
    const same = (x: number) => x >= 0 && x < PW && kind[sy * PW + x] === 1 && lev[sy * PW + x] === c && !ssl[sy * PW + x];
    // 가장자리 기울기가 2열에 1px 보다 가파르면 판 세로 원점을 4px 계단으로 묶는다 — 바위 덩이가 열마다 찢기지 않게(윗테 6줄은 가장자리에 붙인 채)
    const ta = same(sx - 2) ? top(sy * PW + sx - 2) : sy - d, tb = same(sx + 2) ? top(sy * PW + sx + 2) : sy - d;
    const q = Math.abs(tb - ta) > 2 ? mod(sy - d + oy, 4) : 0, v = d < 6 ? d : d + q;
    let rgb = at(panel, ax, panelRow(v, n - 1 - d, panel.h));
    // 엽 끝(면이 동·서로 돌아 끝나는 32px): 엽 끝 조각의 바위를 읽는다. 판과 만나는 이음은 가장 가까운 어두운 틈을 따라 구불거린다.
    const lobe = lobeAt(i, sx, sy, d, n, c, ax);
    if (lobe >= 0) rgb = lobe;
    if (rgb < 0) continue;
    // 도는 면: 가장자리가 오른쪽으로 오르면(／ 남동을 봄) 어둡게, 내려가면(＼ 남서) 밝게. 면이 끝나는 쪽(엽 끝)도 그 쪽으로.
    const tl = same(sx - 6) ? top(sy * PW + sx - 6) : null, tr = same(sx + 6) ? top(sy * PW + sx + 6) : null, t0 = sy - d;
    let turn = 0;
    if (tl !== null && tr !== null) { const g = tr - tl; turn = g <= -8 ? -2 : g <= -3 ? -1 : g >= 3 ? 1 : 0; }
    else if (tr === null && tl !== null) turn = t0 - tl < -2 ? -2 : -1;
    else if (tl === null && tr !== null) turn = 1;
    rgb = shift(rgb, turn);
    put(i, rgb);
  }
  // 3) 동·서 가장자리: 옆면 띠를 세우지 않는다 — 면은 엽 끝 조각(32px)으로만 돌아 끝난다(승인 화면). 가장자리마다 옆면 띠를 세우면 단마다 좁은 기둥이
  //    계단처럼 쌓이고 둥근 끝 옆에 곧은 띠가 붙어 보였다(2026-11-16 감독 검토). 동쪽 가장자리는 아래 땅에 그늘만 드리운다(6 단계).
  const eastEdge: number[] = [];
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx + 1 < PW; sx++) {
    const i = sy * PW + sx; if (kind[i] !== 0 || ssl[i] || voidPx[i] || !(fl[i]! > 0.5)) continue;
    if (s.bridge && (s.bridge[src[i]!] ?? 0) > 0) continue;
    if (low(i + 1, fl[i]!)) eastEdge.push(i);
  }
  // 4) 윗면 테: 앞면이 없는 가장자리(북 · 동 · 서) 안쪽 16px 에 테 조각을 얹는다. 둥근 곳은 가장 가까운 가장자리의 거리로 잇는다.
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < PW; sx++) {
    const i = sy * PW + sx; if (kind[i] !== 0 || ssl[i] || voidPx[i] || !(fl[i]! > 0.5)) continue;
    const c = fl[i]!;
    const open = (j: number) => kind[j] !== 1 && !isTop(j, c);
    let dn = 99, dw = 99, de = 99;
    for (let r = 1; r <= 8; r++) { if (sy - r < 0) break; const j = i - r * PW; if (open(j)) { dn = r - 1; break; } if (!isTop(j, c)) break; }
    for (let r = 1; r <= 8; r++) { if (sx - r < 0) break; const j = i - r; if (open(j)) { dw = r - 1; break; } if (!isTop(j, c)) break; }
    for (let r = 1; r <= 8; r++) { if (sx + r >= PW) break; const j = i + r; if (open(j)) { de = r - 1; break; } if (!isTop(j, c)) break; }
    const m = Math.min(dn, dw, de); if (m >= 8) continue;
    const ax = sx + ox, ay = sy + oy;
    const rgb = m === dn ? at(art.rim, mod(ax, 16), dn) : m === dw ? at(art.rim, 16 + dw, mod(ay, 16)) : at(art.rim, 47 - de, mod(ay, 16));
    if (rgb >= 0) { put(i, rgb); edge[i] = 1; }
  }
  // 5) 낭떠러지 밑: 면 발치 아래가 빈 곳이면 그늘로 떨어지는 바위를 48줄 — 32줄부터는 자리 해시로 뚫어 하늘이 비친다
  for (let i = 0; i < N; i++) {
    if (kind[i] !== 1 || ssl[i] || s.deckUnder[i] || dep[i] !== run[i]! - 1) continue;
    const sx = i % PW, sy = (i / PW) | 0, ax = sx + ox;
    if (sy + 1 >= SH || !voidPx[i + PW]) continue;
    for (let r = 0; r < 48 && sy + 1 + r < SH; r++) {
      const j = i + (r + 1) * PW; if (!voidPx[j]) break;
      if (r >= 32 && h32(ax, sy + r + oy, 5) % 16 < r - 31) continue;
      const rgb = at(art.drop, ax, r); if (rgb < 0) continue;
      put(j, rgb); kind[j] = 1; lev[j] = lev[i]!; src[j] = src[i]!; dep[j] = dep[i]! + 1 + r; run[j] = run[i]!; voidPx[j] = 0;
    }
  }
  // 6) 땅에 드리운 그늘: 면 발치 바로 아래 · 동쪽 가장자리의 동쪽 — 빛이 북서라 남·동으로. 윤곽을 따라간다(화소마다 잰다).
  const shade = new Float32Array(N).fill(1);
  for (let i = 0; i < N; i++) {
    if (kind[i] !== 1 || dep[i] !== run[i]! - 1) continue;
    for (let r = 1; r <= 10; r++) { const j = i + r * PW; if (j >= N || kind[j] !== 0 || voidPx[j] || ssl[j]) break; shade[j] = Math.min(shade[j]!, 0.6 + 0.04 * r); }
  }
  // 동쪽 가장자리: 아래 땅에 드리운 그늘(빛이 북서) — 최대 10px
  for (const i of eastEdge) {
    const sx = i % PW, sy = (i / PW) | 0, c = fl[i]!;
    for (let r = 1; r <= 10 && sx + r < PW; r++) { const j = sy * PW + sx + r; if (kind[j] !== 0 || voidPx[j] || ssl[j] || fl[j]! > c - 0.5) break; shade[j] = Math.min(shade[j]!, 0.64 + 0.035 * r); }
  }
  for (let i = 0; i < N; i++) if (shade[i]! < 1) { const o = i * 4; rgba[o] *= shade[i]!; rgba[o + 1] *= shade[i]!; rgba[o + 2] *= shade[i]!; }
  // 7) 사다리 · 덩굴: 머리 16줄은 고원 윗면, 몸통은 면(주기 32), 끝 16줄은 면 발치에 닿는다.
  for (const c of s.climbs) {
    const piece = c.climb === 11 ? art.vine : art.ladder;
    const n = Math.round((c.hi - c.lo) * T);
    for (let col = c.x; col < c.x + c.w; col++) {
      const x0 = (col - s.cx0) * T - (piece.w - T) / 2, edgeY = (c.y - s.cy0) * T + pad - c.hi * T;
      for (let r = -16; r < n + 2; r++) {
        const y = edgeY + r; if (y < 0 || y >= SH) continue;
        const row = r < 0 ? 16 + r : r >= n - 14 ? Math.min(63, 48 + (r - (n - 14))) : 16 + mod(r, 32);
        for (let k = 0; k < piece.w; k++) {
          const x = x0 + k; if (x < 0 || x >= PW) continue;
          const rgb = at(piece, k, row); if (rgb < 0) continue;
          const j = y * PW + x; if (voidPx[j]) continue;
          put(j, rgb); if (kind[j] === 0) edge[j] = 1;
        }
      }
    }
  }
  // 7b) 폭포: 그린 턱(조각 4~15줄)과 물보라(48~63줄)는 조각 그대로, 물기둥은 코드로 짠 흰 줄(주기 32). 양옆은 곧은 세로 금 —
  //     바위를 따라 깎으면 톱니로 읽혔다(2026-11-16 목표 화면 남은 흠). 물기둥 폭 = 칸 폭 − 양옆 2px.
  if (art.falls && s.falls?.length) paintFalls(s, art, put);
  // 8) 구름다리: 다리 판 칸(walk.ts 9)의 동서 줄마다 양끝 말뚝 + 가운데 판(되풀이). 걷는 판(조각 18~37줄)의 가운데를 다리 칸 가운데에.
  const b = s.bridge;
  if (b) {
    const W = s.W, H = s.h.length;
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        if (!(b[y * W + x]! > 0)) { x++; continue; }
        let e = x; while (e + 1 < W && b[y * W + e + 1]! > 0) e++;
        const deckTop = y * T + pad - (s.h[y]![x] ?? 0) * T, left = x * T - 14, right = (e + 1) * T + 14;
        for (let r = 0; r < art.bridge.h; r++) {
          const sy = deckTop - 20 + r; if (sy < 0 || sy >= SH) continue;
          for (let sx = Math.max(0, left); sx < Math.min(PW, right); sx++) {
            const col = sx - left < 32 ? sx - left : right - sx <= 32 ? 48 + (32 - (right - sx)) : 32 + mod(sx - x * T, 16);
            const rgb = at(art.bridge, col, r); if (rgb < 0) continue;
            const j = sy * PW + sx;
            put(j, rgb);
            if (voidPx[j]) { voidPx[j] = 0; kind[j] = 1; src[j] = y * W + Math.max(x, Math.min(e, (sx / T) | 0)); lev[j] = 0; }
          }
        }
        x = e + 1;
      }
    }
  }
}

/** 폭포 조각의 물기둥 색 줄(밝기 순) — 조각 몸통(16~47줄)에서 센다. */
function fallsRamp(p: ReliefArtPatch): number[] {
  const n = new Map<number, number>();
  for (let y = 16; y < 48; y++) for (let x = 0; x < 48; x++) { const v = at(p, x, y); if (v >= 0) n.set(v, (n.get(v) ?? 0) + 1); }
  const lum = (v: number) => 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
  // 자주 쓰인 색 다섯(물빛 바탕 · 틈 · 옅은 · 밝은 · 흰) — 드문 색(테두리 한두 점)은 뺀다
  return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v).sort((a, b) => lum(a) - lum(b));
}

function paintFalls(s: SheerSurface, art: SheerArt, put: (i: number, rgb: number) => void): void {
  const p = art.falls!, { PW, SH, pad, cx0, cy0, h } = s, ramp = fallsRamp(p);
  const [DEEP, GAP, BASE, LIGHT, WHITE] = [ramp[0]!, ramp[1] ?? ramp[0]!, ramp[2] ?? ramp[0]!, ramp[3] ?? ramp[0]!, ramp[ramp.length - 1]!];
  for (const f of s.falls!) {
    const gy = f.y - cy0, gx0 = f.x - cx0;
    if (gy < 0 || gy + 1 >= h.length || gx0 < 0 || gx0 + f.w > s.W) continue;
    const hi = h[gy]![gx0]!, lo = h[gy + 1]![gx0]!; if (hi <= lo) continue;
    const faceTop = (gy + 1) * T + pad - hi * T, n = (hi - lo) * T, bw = f.w * T - 4, left = gx0 * T + 2;
    // 물기둥 무늬(폭 bw × 32, 세로로 되풀이): 물빛 바탕 위에 흰 줄 · 옅은 줄 · 틈을 자리 해시로. 오른쪽 3px 은 그늘, 왼쪽 1px 은 밝게.
    const body = new Int32Array(bw * 32).fill(BASE);
    const streak = (x: number, w: number, y0: number, len: number, col: number) => {
      for (let i = 0; i < len; i++) { const ww = i > 1 && i < len - 2 ? w : Math.max(1, w - 1); for (let k = 0; k < ww && x + k < bw; k++) body[mod(y0 + i, 32) * bw + x + k] = col; }
    };
    const ax = f.x * T;
    for (let k = 0; k < Math.round(bw * 0.3); k++) streak(1 + h32(ax + k, 1, 301) % Math.max(1, bw - 4), 1, h32(ax + k, 2, 301) % 32, 5 + h32(ax + k, 3, 301) % 11, GAP);
    for (let k = 0; k < Math.round(bw * 0.75); k++) {
      const r = h32(ax + k, 4, 302) % 100, w = r < 14 ? 3 : r < 45 ? 2 : 1, x = 1 + h32(ax + k, 1, 302) % Math.max(1, bw - 5);
      const len = w === 1 ? 3 + h32(ax + k, 3, 302) % 7 : 8 + h32(ax + k, 3, 302) % 15, light = h32(ax + k, 5, 302) % 10 < 6;
      streak(x, w, h32(ax + k, 2, 302) % 32, len, x > bw - 6 ? (w === 1 ? BASE : LIGHT) : w > 1 ? (light ? WHITE : LIGHT) : (light ? LIGHT : BASE));
    }
    for (let y = 0; y < 32; y++) { for (let k = Math.max(0, bw - 3); k < bw; k++) body[y * bw + k] = k === bw - 1 ? DEEP : GAP; body[y * bw] = LIGHT; }
    // 조각 열: 물기둥(조각 7~40열)을 칸 폭에 맞춰 늘인다. 물보라는 그 바깥으로 6px 더.
    const col = (sx: number) => Math.max(0, Math.min(47, 7 + Math.floor(((sx - left) * 34) / bw)));
    for (let r = -12; r < n + 10; r++) {
      const sy = faceTop + r; if (sy < 0 || sy >= SH) continue;
      const crest = r < 0, spray = r >= n - 6;
      for (let sx = left - (spray ? 6 : 0); sx < left + bw + (spray ? 6 : 0); sx++) {
        if (sx < 0 || sx >= PW) continue;
        const j = sy * PW + sx;
        let rgb: number;
        if (crest) rgb = at(p, col(sx), 16 + r);
        else if (spray) rgb = at(p, col(sx), Math.min(63, 48 + (r - (n - 6))));
        else rgb = body[mod(r, 32) * bw + (sx - left)]!;
        if (rgb < 0) continue;
        put(j, rgb); if (s.kind[j] === -1) s.kind[j] = 1;
      }
    }
  }
}
