/** 둥근 띠 끝·둥근 귀 풀숲 배치(정본 — 감독 결정 I4 W2·W3). 모든 쇼케이스가 이 파일을 import 해 같은 마스크 규칙으로 놓는다.
 *  그림은 레시피 정본 함수가 굽는다: 벼랑 띠 끝 = wild_mountain.add_round_face(→ <앞면>_rnd<마스크>),
 *  풀숲 귀 = wild_tall.add_round_tall(→ <풀><v>r<바닥><귀 비트> · <풀>_fringe_s_<a|b|ab> · <풀>_fringe_<e|w>_v<n>[_<a|b|ab>]).
 *
 *  시트 접근은 RoundSheet 하나로 받는다 — kitlib Kit 은 kitSheet(k), 다른 쇼케이스는 id·name·group 세 함수를 넘긴다.
 *  맵은 { W, H, map: { lowerTiles, upperTiles } } 면 된다(kitlib Field · showcase.mts Field 둘 다 맞는다). 칸 번호를 직접 고쳐 쓴다.
 *
 *  부르는 순서(맵마다): shape·join(계단·굴 자리)·faceVary(덩이 변형) → roundFace → … 풀숲·잎끝을 다 깐 뒤 save 직전 roundTall.
 *  사선 계단(열마다 한 줄 물러나는 앞면)은 떼지 않는다 — 엔진 모양 그대로 이웃 열과 이어 두면 열린 끝만 둥글어져 띠가 흘러내린다.
 *  열마다 떼면(옛 stepCut) 한 칸 폭 기둥이 알약 바위로 따로 서서 띠가 끊겼다(w195 시험). */

export const N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128;
/** 8비트 마스크 → 엔진 47 정규형(곁 두 변이 이어진 대각만 남긴다). */
export const canon = (m8: number) => {
  let m = m8 & 15;
  for (const [sides, diag] of [[N | E, NE], [S | E, SE], [S | W, SW], [N | W, NW]]) if ((m & sides) === sides && m8 & diag) m |= diag;
  return m;
};

export interface RoundSheet {
  id(name: string): number;
  name(id: number): string | undefined;
  group(grp: string): { variantMap: Record<string, number>; memberTileIds?: number[] };
}
export interface RoundField { W: number; H: number; map: { lowerTiles: number[]; upperTiles: number[] } }

/** kitlib Kit → RoundSheet. */
export const kitSheet = (k: { id(n: string): number; names: Record<number, string>; g(n: string): any }): RoundSheet =>
  ({ id: (n) => k.id(n), name: (i) => k.names[i], group: (g) => k.g(g) });

const inF = (f: RoundField, x: number, y: number) => x >= 0 && y >= 0 && x < f.W && y < f.H;
const maskAt = (s: RoundSheet, f: RoundField, grp: string, x: number, y: number): number | undefined => {
  const vm = s.group(grp).variantMap, t = f.map.lowerTiles[y * f.W + x];
  const raw = Object.keys(vm).find((m) => vm[m] === t);
  return raw === undefined ? undefined : canon(Number(raw));
};

/** 둥근 띠 끝 마스크(wild_mountain.ROUND_MASKS 와 같은 10개): 옆이 열린 앞면 윗칸(어깨)·아랫칸(발끝). */
export const ROUND_MASKS = [S | W, S | W | SW, S | E, S | E | SE, S, N | E, N | E | NE, N | W, N | W | NW, N];

/** 앞면 그룹 grp 의 칸 중 마스크가 ROUND_MASKS 인 칸을 <pre>_rnd<마스크> 로 바꾼다(pre = 레시피 add_round_face 에 준 접두).
 *  join·remask·faceVary 를 다 한 뒤 마지막에 부른다(바꾼 칸은 그룹 변형 표에 없다). 바꾼 칸 수를 돌려준다. */
export function roundFace(s: RoundSheet, f: RoundField, grp: string, pre: string, plateauGroups: string[]): number {
  // I5: 윗면·옆벽에 붙은 어깨는 열린 끝이 아니다. shade 뒤의 속 변형도 포함한다.
  const plateau = new Set(plateauGroups.flatMap((g) => {
    const q = s.group(g); return [...Object.values(q.variantMap), ...(q.memberTileIds ?? [])];
  }));
  const high = (x: number, y: number) => inF(f, x, y) && plateau.has(f.map.lowerTiles[y * f.W + x]);
  let n = 0;
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    const m = maskAt(s, f, grp, x, y); if (m === undefined || !ROUND_MASKS.includes(m)) continue;
    // 옆벽 바로 아래 어깨는 원래 모서리로 잇는다. 오목 모서리는 옆 고원에서 떼지 않는다.
    if (!(m & N) && high(x, y - 1)) continue;
    if ((!(m & W) && high(x - 1, y)) || (!(m & E) && high(x + 1, y))) continue;
    f.map.lowerTiles[y * f.W + x] = s.id(`${pre}_rnd${m}`); n++;
  }
  return n;
}

/** 옆 잎끝 벌 고르기(칸 해시) — 같은 빗살이 세로로 줄 서지 않게(I4 W6). */
const fringeVar = (x: number, y: number) => ((Math.imul(x, 374761393) ^ Math.imul(y + 7, 668265263)) >>> 13) % 2;

/** 키 큰 풀 덩이 바깥 귀를 둥글게(I3 Z5 · I4 W2 정본): 풀숲 칸(이름이 tallRe, 예 /^tall\d$/ — 이름 끝 숫자가 v)의 곁 두 변이 다 풀숲 밖인 귀를
 *  <base><v>r<바닥><귀 비트>(1 왼위·2 오른위·4 왼아래·8 오른아래)로 바꾸고, 위층 잎끝 <base>_fringe_<s|e|w> 는
 *  남쪽은 귀에 닿은 끝을 자른 <base>_fringe_s_<a|b|ab>, 옆은 두 벌 중 하나 <base>_fringe_<e|w>_v<n>(귀에 닿으면 _<a|b|ab>)으로 바꾼다.
 *  맵 밖은 풀숲으로 본다(덩이가 맵 밖으로 이어진다). gnd(x, y) = 그 칸 바닥 글자(레시피 grounds 와 같은 글자). 잎끝을 다 깐 뒤 save 직전에 부른다. */
export function roundTall(s: RoundSheet, f: RoundField, tallRe: RegExp, base: string, gnd: (x: number, y: number) => string) {
  const nm = (x: number, y: number) => s.name(f.map.lowerTiles[y * f.W + x]) ?? "";
  const isTall = (x: number, y: number) => !inF(f, x, y) || tallRe.test(nm(x, y));
  const bitsAt = new Map<string, number>();
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    if (!tallRe.test(nm(x, y))) continue;
    const n = !isTall(x, y - 1), s_ = !isTall(x, y + 1), w = !isTall(x - 1, y), e = !isTall(x + 1, y);
    const b = (n && w ? 1 : 0) | (n && e ? 2 : 0) | (s_ && w ? 4 : 0) | (s_ && e ? 8 : 0);
    if (b) bitsAt.set(`${x},${y}`, b);
  }
  const fr = new RegExp(`^${base}_fringe_([sew])$`);
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    const ui = f.map.upperTiles[y * f.W + x]; if (ui === -1) continue;
    const m = fr.exec(s.name(ui) ?? ""); if (!m) continue;
    const sd = m[1], [tx, ty] = sd === "s" ? [x, y - 1] : sd === "e" ? [x - 1, y] : [x + 1, y];
    const b = bitsAt.get(`${tx},${ty}`) ?? 0;
    const a = sd === "s" ? b & 4 : sd === "e" ? b & 2 : b & 1, bb = sd === "s" ? b & 8 : sd === "e" ? b & 8 : b & 4;
    const trim = (a ? "a" : "") + (bb ? "b" : "");
    const head = sd === "s" ? `${base}_fringe_s` : `${base}_fringe_${sd}_v${fringeVar(x, y)}`;
    if (sd !== "s" || trim) f.map.upperTiles[y * f.W + x] = s.id(trim ? `${head}_${trim}` : head);
  }
  for (const [c, b] of bitsAt) {
    const [x, y] = c.split(",").map(Number);
    f.map.lowerTiles[y * f.W + x] = s.id(`${nm(x, y)}r${gnd(x, y)}${b}`);
  }
}
