// editor/tools/village/cliffGrammar.ts
// 남향 절벽 문법 — 「비취 대계곡」(regionReferences/emerald-basin.json) 손배치 절벽에서 뽑은 규칙(2026-09-27).
// 참고 맵의 절벽은 전부 남쪽을 향한 벽이다. 북·서·동 쪽 벽은 이 시점에서 보이지 않아 타일이 없다.
//
// 벽 하나는 칸 경계 e(=x 좌표)마다 두 선으로 정한다: 윗선 lip(e)(대지와 벽의 경계 행), 발선 foot(e)(벽과 땅의 경계 행).
// 칸 열 x 는 왼쪽 경계 x·오른쪽 경계 x+1 의 두 선 기울기(-1·0·+1)로 타일 기둥이 정해진다.
//   윗줄: 평평 139(선 위 칸) · 「\」 18 · 「/」 19      몸통: 평평 172 · 「\」 231 · 「/」 232
//   발줄: 평평 202(선 위 칸) · 「\」 48 · 「/」 49      벽 끝: 왼쪽 몸통 171, 오른쪽 발 203
// 윗선이 기울면 발선도 같은 쪽으로 기운다(참고 맵에 231 위 49, 232 위 48 같은 짝이 없다).
// 벽 끝은 윗선을 평평하게 두고 발선을 끌어올려 땅에 묻는다 — 왼쪽 139/171/48, 오른쪽 139/172/49 → 139/203.

export const CLIFF_TILE = {
  grassNE: 18,
  grassNW: 19,
  grassSW: 48,
  grassSE: 49,
  lip: 139,
  capLeftFace: 171,
  face: 172,
  foot: 202,
  capRightFoot: 203,
  downBody: 231,
  upBody: 232,
  stairs: 374,
} as const;

export type WallCellRole = "lip" | "lipDown" | "lipUp" | "body" | "foot" | "footDown" | "footUp";

export interface WallCell {
  readonly x: number;
  readonly y: number;
  readonly tile: number;
  readonly role: WallCellRole;
}

export interface WallLines {
  /** 경계 e = xa…xb 의 윗선 행(길이 xb-xa+1). */
  readonly lip: readonly number[];
  readonly foot: readonly number[];
}

export interface WallSpec {
  readonly xa: number;
  readonly xb: number;
  /** 경계마다의 대지 남쪽 끝 행(요구치). 45° 를 넘는 곳은 깎아서 맞춘다. */
  readonly rawLip: readonly number[];
  /** 윗선 아래 벽 칸 수(평평한 열의 172 줄 수 + 1). 참고 맵 1단 = 2. */
  readonly height: number;
  readonly exposedLeft: boolean;
  readonly exposedRight: boolean;
}

/** 이웃 경계와 한 줄까지만 다르게 깎고, 「\」 바로 옆 「/」(남쪽 뾰족 끝)를 평평한 열로 무디게 한다 — 참고 맵에 18|19 짝이 없다. */
export function erodeToSlope1(values: readonly number[]): number[] {
  const out = values.slice();
  for (let pass = 0; pass < out.length; pass += 1) {
    for (let i = 1; i < out.length; i += 1) out[i] = Math.min(out[i]!, out[i - 1]! + 1);
    for (let i = out.length - 2; i >= 0; i -= 1) out[i] = Math.min(out[i]!, out[i + 1]! + 1);
    let changed = false;
    for (let i = 1; i < out.length - 1; i += 1) {
      if (out[i]! > out[i - 1]! && out[i]! > out[i + 1]!) { out[i] = Math.max(out[i - 1]!, out[i + 1]!); changed = true; }
    }
    if (!changed) break;
  }
  return out;
}

/** 요구 윗선 → 실제 윗선·발선. 드러난 끝은 윗선을 평평하게 두고 벽 높이를 1 까지 줄인다. */
export function planWallLines(spec: WallSpec): WallLines {
  const n = spec.xb - spec.xa;
  const d = Math.max(1, spec.height);
  let lip = erodeToSlope1(spec.rawLip);
  const flatten = (from: number, to: number, value: number) => {
    for (let i = Math.max(0, from); i <= Math.min(n, to); i += 1) lip[i] = value;
  };
  // 벽 끝은 윗선이 평평하다. 왼쪽은 171 열 다음에 평평한 열이 하나 더 있어야 하고(참고 맵 x61–63 y24–28: 139/171/48 · 139/172/172/48 · 18…),
  // 오른쪽은 49 열과 203 열이 평평하다(x16–17 y53–55).
  const capL = Math.max(2, d - 1);
  if (spec.exposedLeft) flatten(0, capL, lip[0]!);
  if (spec.exposedRight) flatten(n - d, n, lip[n]!);
  lip = erodeToSlope1(lip);
  if (spec.exposedLeft) flatten(0, capL, Math.min(...lip.slice(0, capL + 1)));
  if (spec.exposedRight) flatten(n - d, n, Math.min(...lip.slice(Math.max(0, n - d))));
  const foot = lip.map((l, i) => {
    let h = d;
    if (spec.exposedLeft) h = Math.min(h, 1 + i);
    if (spec.exposedRight) h = Math.min(h, Math.max(1, n - i));
    return l + h;
  });
  return { lip, foot };
}

/** 열 하나의 타일 기둥. 윗선이 기울면 발선도 같은 쪽으로 기울어야 한다. */
export function wallColumn(
  x: number,
  lipL: number,
  lipR: number,
  footL: number,
  footR: number,
  capLeft: boolean,
  capRight: boolean,
): WallCell[] {
  const dl = lipR - lipL, df = footR - footL;
  if (Math.abs(dl) > 1 || Math.abs(df) > 1) throw new Error(`cliff column ${x}: slope over 45° (lip ${dl}, foot ${df})`);
  if (dl !== 0 && df !== dl) throw new Error(`cliff column ${x}: lip slope ${dl} needs matching foot slope, got ${df}`);
  const cells: WallCell[] = [];
  const topRow = dl === 0 ? lipL - 1 : Math.min(lipL, lipR);
  const topTile = dl === 0 ? CLIFF_TILE.lip : dl > 0 ? CLIFF_TILE.grassNE : CLIFF_TILE.grassNW;
  cells.push({ x, y: topRow, tile: topTile, role: dl === 0 ? "lip" : dl > 0 ? "lipDown" : "lipUp" });
  const footRow = df === 0 ? footL - 1 : Math.min(footL, footR);
  if (footRow <= topRow) throw new Error(`cliff column ${x}: wall too short`);
  const bodyTile = dl > 0 ? CLIFF_TILE.downBody : dl < 0 ? CLIFF_TILE.upBody : capLeft ? CLIFF_TILE.capLeftFace : CLIFF_TILE.face;
  for (let y = topRow + 1; y < footRow; y += 1) cells.push({ x, y, tile: bodyTile, role: "body" });
  const footTile = df > 0 ? CLIFF_TILE.grassSW : df < 0 ? CLIFF_TILE.grassSE : capRight ? CLIFF_TILE.capRightFoot : CLIFF_TILE.foot;
  cells.push({ x, y: footRow, tile: footTile, role: df === 0 ? "foot" : df > 0 ? "footDown" : "footUp" });
  return cells;
}

/** 벽 전체 — 열마다 wallColumn. */
export function buildWall(spec: WallSpec): { lines: WallLines; cells: WallCell[] } {
  const lines = planWallLines(spec);
  const cells: WallCell[] = [];
  for (let i = 0; i < spec.xb - spec.xa; i += 1) {
    cells.push(...wallColumn(
      spec.xa + i,
      lines.lip[i]!, lines.lip[i + 1]!, lines.foot[i]!, lines.foot[i + 1]!,
      spec.exposedLeft && i === 0,
      spec.exposedRight && i === spec.xb - spec.xa - 1,
    ));
  }
  return { lines, cells };
}
