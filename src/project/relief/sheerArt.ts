// 깎아지른 면(relief.style "sheer")의 조각 — 렌더러가 열마다 읽는 앞면 판 · 옆면 · 윗면 테 · 낭떠러지 밑 · 오르내리는 장치.
// 규격: assistant-fable-runs/terrain-pilot/PIECES.md(그리는 쪽과 같이 본다). 그린 조각은 오너 면제 절차로만 굽는다 —
// 굽기 전까지 저장소는 코드로 만든 자리 표시 조각(placeholderSheerArt: 색 줄 몇 개의 단색 덩이)을 쓴다. 조각을 바꿔도 칸·걷기는 같다.
import type { ReliefArtPatch } from "./render";

export interface SheerArt {
  /** 단 차 1(48px) 앞면 판, 64×48. 윗테 0~15 · 몸통 16~31 · 밑동 32~47. */
  readonly face48: readonly ReliefArtPatch[];
  /** 단 차 2 이상 앞면 판, 64×96. 윗테 0~15 · 몸통 16~79(세로 주기 64) · 밑동 80~95. */
  readonly face96: readonly ReliefArtPatch[];
  /** 옆면 32×96: 0~15열 서쪽으로 도는 면(빛), 16~31열 동쪽(그늘). 줄은 앞면과 같이 읽는다. */
  readonly side: ReliefArtPatch;
  /** 윗면 테 48×16: 0~15 북 · 16~31 서 · 32~47 동. */
  readonly rim: ReliefArtPatch;
  /** 낭떠러지 밑 64×48(아래로 갈수록 투명). */
  readonly drop: ReliefArtPatch;
  /** 줄사다리 32×64 · 오르는 덩굴 16×64: 0~15 머리(고원 위) · 16~47 되풀이 · 48~63 끝. */
  readonly ladder: ReliefArtPatch;
  readonly vine: ReliefArtPatch;
  /** 깎은 돌계단: 단 차 1 = 32×80, 단 차 2 = 32×160(2칸 폭 북향 계단의 화면 사각형 그대로). */
  readonly stairs: Readonly<Record<number, ReliefArtPatch>>;
  /** 구름다리 80×48: 0~31 왼 말뚝 · 32~47 가운데(되풀이) · 48~79 오른 말뚝, 걷는 판 18~37줄. */
  readonly bridge: ReliefArtPatch;
  /** 면 명암을 옮길 바위 색 줄(어둠 → 밝음). 이 줄에 든 색만 한두 단 옮긴다 — 풀 테는 옮기지 않는다. */
  readonly rock: readonly (readonly [number, number, number])[];
}

type Rgb = readonly [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// 지형 시범 색 줄(terrain-pilot/draw/ramps.json)에서 몇 개만 — 자리 표시라 색 수를 적게.
const ROCK = ["#1b1524", "#2e202e", "#3d3028", "#58493c", "#6e5b49", "#816a56", "#8a745c", "#9e8b64", "#b8a07a", "#d2c09a"].map(hex);
const DARK = ["#0e0a12", "#14101c", "#1b1724", "#2e202e"].map(hex);
const GRASS = ["#264d2c", "#366324", "#4b8232", "#618c3b", "#8bb14e", "#afda5e"].map(hex);
const WOOD = ["#3a2412", "#5e3b1c", "#86592c", "#b07c3e"].map(hex);
const STONE = ["#3b3a3f", "#5a5860", "#7c7a80", "#a4a2a6"].map(hex);
const LEAF = ["#1f3d1c", "#2f5e26", "#46863a", "#6cae4e"].map(hex);

function patch(w: number, h: number, at: (x: number, y: number) => Rgb | null): ReliefArtPatch {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = at(x, y); if (!c) continue;
    const o = (y * w + x) * 4; rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
  }
  return { w, h, rgba };
}
const mix = (a: number, b: number) => { let v = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); v ^= v >>> 13; v = Math.imul(v, 0x27d4eb2d); return (v ^ (v >>> 15)) >>> 0; };

/** 바위 덩어리 자리 표시: 세로로 선 단색 덩이(폭 8~16, 높이 16~32)가 엇갈리고, 덩이 윗줄은 밝고 오른쪽 아래 틈은 어둡다. 64 폭 되풀이. */
function rockBody(x: number, y: number, seed: number, period: number): Rgb {
  const cols = [0, 11, 22, 36, 47, 56, 64], k = cols.findIndex((c, i) => x >= c && x < cols[i + 1]!);
  const x0 = cols[k]!, x1 = cols[k + 1]!, hgt = 16 + (mix(k, seed) % 3) * 8, off = mix(k, seed + 7) % hgt;
  const yy = (((y + off) % period) + period) % period, j = Math.floor(yy / hgt), v = yy - j * hgt;
  if (x === x1 - 1 || v === hgt - 1) return ROCK[1]!;
  if (v === 0 || v === 1) return ROCK[7]!;
  const tone = 4 + (mix(k * 31 + j, seed) % 3);
  return x - x0 >= x1 - x0 - 3 ? ROCK[tone - 2]! : ROCK[tone]!;
}
function lipRow(x: number, y: number): Rgb | null {
  if (y <= 1) return GRASS[3]!;
  if (y <= 3) return GRASS[5 - ((x >> 2) & 1)]!;
  if (y === 4 && (x * 7) % 5 < 2) return GRASS[2]!;
  return y === 4 || y === 5 ? ROCK[1]! : null;
}
function footShade(c: Rgb, fromBottom: number): Rgb {
  if (fromBottom < 4) return DARK[fromBottom < 2 ? 0 : 1]!;
  if (fromBottom < 10) { const k = ROCK.findIndex((r) => r === c); return ROCK[Math.max(0, k - 2)] ?? ROCK[1]!; }
  return c;
}
function facePanel(h: number, seed: number): ReliefArtPatch {
  const period = h === 48 ? 16 : 64;
  return patch(64, h, (x, y) => {
    const lip = lipRow(x, y); if (lip) return lip;
    const body = rockBody(x, y < 16 ? y : 16 + ((y - 16) % period), seed, 96);
    return footShade(body, h - 1 - y);
  });
}

let placeholder: SheerArt | null = null;
/** 코드로 만든 자리 표시 조각(단색 덩이). 그린 조각이 굽히기 전까지 이것이 쓰인다. */
export function placeholderSheerArt(): SheerArt {
  if (placeholder) return placeholder;
  const rockIndex = (c: Rgb) => ROCK.findIndex((r) => r[0] === c[0] && r[1] === c[1] && r[2] === c[2]);
  const lit = (c: Rgb, s: number): Rgb => { const k = rockIndex(c); return k < 0 ? c : ROCK[Math.max(0, Math.min(ROCK.length - 1, k + s))]!; };
  const base = facePanel(96, 5);
  const side = patch(32, 96, (x, y) => {
    const lip = lipRow(x, y); if (lip) return x < 16 || lip === ROCK[1] ? lip : GRASS[Math.max(0, GRASS.indexOf(lip) - 1)] ?? lip;
    const q = (y * 64 + (x % 16) * 4) * 4, c: Rgb = [base.rgba[q]!, base.rgba[q + 1]!, base.rgba[q + 2]!];
    return x < 16 ? lit(c, 1) : lit(c, -2);
  });
  const rim = patch(48, 16, (x, y) => {
    const d = x < 16 ? y : x < 32 ? x - 16 : 47 - x, dim = x >= 32 ? 1 : 0;
    if (d === 0) return GRASS[0]!;
    if (d <= 2) return GRASS[5 - dim]!;
    if (d <= 4 && (x + y) % 3) return GRASS[4 - dim]!;
    return null;
  });
  const drop = patch(64, 48, (x, y) => {
    if (y < 14) return ((x >> 3) + (y >> 2)) % 3 ? DARK[2]! : ROCK[1]!;
    if (y < 30) return DARK[1]!;
    return mix(x, y) % 48 > y ? DARK[0]! : null;
  });
  const ladder = patch(32, 64, (x, y) => {
    if (y < 16) return (x >= 7 && x <= 10) || (x >= 21 && x <= 24) ? (y < 2 ? WOOD[3]! : y > 8 ? null : WOOD[2]!) : null;
    if (y > 60) return null;
    if (x === 8 || x === 9 || x === 22 || x === 23) return WOOD[1]!;
    if (x >= 6 && x <= 25 && (y % 6 === 0 || y % 6 === 1)) return y % 6 ? WOOD[1]! : WOOD[3]!;
    return null;
  });
  const vine = patch(16, 64, (x, y) => {
    const cx = 7 + Math.round(2 * Math.sin(y / 5));
    if (Math.abs(x - cx) <= 1) return LEAF[x < cx ? 3 : 1]!;
    if (y % 5 === 0 && Math.abs(x - cx) <= 4) return LEAF[2]!;
    return null;
  });
  const stairs = (h: number) => patch(32, h, (x, y) => {
    if (x < 4 || x > 27) return x < 4 ? ROCK[3]! : ROCK[5]!;
    if (y < 4) return GRASS[4]!;
    const k = (y - 4) % 8;
    return k < 3 ? STONE[3 - (k === 0 ? 0 : 1)]! : k < 6 ? STONE[1]! : STONE[0]!;
  });
  const bridge = patch(80, 48, (x, y) => {
    const post = (x >= 10 && x <= 15) || (x >= 64 && x <= 69);
    if (post && (y <= 18 || (y >= 26 && y <= 46))) return x === 10 || x === 64 ? WOOD[3]! : WOOD[1]!;
    if (y === 8 || y === 38) return x >= 12 && x <= 67 ? WOOD[0]! : null;
    if (y >= 18 && y <= 37 && x >= 14 && x <= 65) return x % 4 === 0 ? WOOD[0]! : WOOD[2 + ((x >> 2) & 1)]!;
    if (y >= 38 && y <= 40 && x >= 14 && x <= 65) return DARK[2]!;
    return null;
  });
  placeholder = {
    face48: [facePanel(48, 1), facePanel(48, 2)], face96: [base, facePanel(96, 9), facePanel(96, 13)],
    side, rim, drop, ladder, vine, stairs: { 1: stairs(80), 2: stairs(160) }, bridge, rock: ROCK,
  };
  return placeholder;
}

let current: SheerArt | null = null;
/** 그린 조각 한 벌을 건다(굽힌 조각을 싣는 곳 · 확인 쪽 스크립트). null 이면 자리 표시로 돌아간다. */
export function setSheerArt(art: SheerArt | null): void { current = art; }
export function sheerArt(): SheerArt { return current ?? placeholderSheerArt(); }
