// 렌더 규칙과 3/4 시점이 무엇을 바꿨는지 글로 돌려준다 — AI 가 고쳐 쓸 근거
import { effectiveHeights, renderRelief } from "./render";
import { RELIEF_MAX_LEVEL, type HeightGrid } from "./types";

type Box = [number, number, number, number];
export interface ReliefHiddenRegion { rect: Box; cells: number; floor: number; southWall: number }
export interface ReliefCheck { text: string; cut: number; hidden: number; hiddenRegions: ReliefHiddenRegion[] }

export function checkRelief(h: HeightGrid): ReliefCheck {
  const e = effectiveHeights(h), r = renderRelief(e), H = h.length, W = h[0].length;
  const regions = (cells: [number, number][]) => {
    const set = new Set(cells.map(([x, y]) => y * W + x)), out: { rect: Box; cells: number }[] = [];
    for (const k of set) {
      const q = [k], box: Box = [W, H, 0, 0];
      let n = 0;
      set.delete(k);
      while (q.length) {
        const c = q.pop()!, x = c % W, y = (c / W) | 0;
        n++;
        box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
        for (const d of [1, -1, W, -W]) { const j = c + d; if (set.has(j) && Math.abs((j % W) - x) <= 1) { set.delete(j); q.push(j); } }
      }
      out.push({ rect: box, cells: n });
    }
    return out.sort((a, b) => b.cells - a.cells);
  };
  const cut: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (h[y][x] !== e[y][x]) cut.push([x, y]);
  const hid = regions(r.hidden).map((g) => {
    const [a, b, c, d] = g.rect;
    let hi = 0, lo = RELIEF_MAX_LEVEL;
    for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) lo = Math.min(lo, e[y][x]);
    for (let y = d + 1; y <= Math.min(H - 1, d + 4); y++) for (let x = a; x <= c; x++) hi = Math.max(hi, e[y][x]);
    return { ...g, floor: lo, southWall: hi };
  });
  const cnt: Record<number, number> = {};
  for (const row of e) for (const v of row) cnt[v] = (cnt[v] || 0) + 1;
  const lines = [`${W}×${H}칸, 단별 칸 수 ${JSON.stringify(cnt)}`,
    `규칙에 깎인 칸 ${cut.length}` + (cut.length ? ` — 큰 곳: ${regions(cut).slice(0, 4).map((g) => JSON.stringify(g.rect) + " " + g.cells + "칸").join(", ")}` : ""),
    `가려져 안 보이는 칸 ${r.hidden.length}` + (hid.length ? ` — ${hid.slice(0, 5).map((g) => `${JSON.stringify(g.rect)} ${g.cells}칸 (바닥 ${g.floor}단, 바로 남쪽 ${g.southWall}단)`).join("; ")}` : "")];
  // 일직선 벽: 같은 줄에서 같은 높이차로 끊김 없이 이어진 벽 — 길면 자로 그은 듯 인공적으로 보인다
  const straight: { row: number; x: [number, number]; len: number; n: boolean }[] = [];
  for (const dir of [1, -1]) for (let y = 0; y + 1 < H; y++) {
    let run = 0, x0 = 0;
    const edge = (x: number) => x < W && dir * (e[y][x] - e[y + 1][x]) > 0;
    for (let x = 0; x <= W; x++) {
      const ok = edge(x) && (run === 0 || (e[y][x] === e[y][x - 1] && e[y + 1][x] === e[y + 1][x - 1]));
      if (ok) { if (!run) x0 = x; run++; }
      else { if (run >= 12) straight.push({ row: y, x: [x0, x0 + run - 1], len: run, n: dir < 0 }); run = 0; if (edge(x)) { run = 1; x0 = x; } }
    }
  }
  straight.sort((a, b) => b.len - a.len);
  lines.push(`일직선 벽(12칸 이상) ${straight.length}개` + (straight.length ? ` — ${straight.slice(0, 4).map((g) => `y=${g.row}${g.n ? "(북향)" : ""} x${g.x[0]}~${g.x[1]} ${g.len}칸`).join(", ")} (자로 그은 듯 보임 → rough 나 휘어진 path 로 깨라)` : ""));
  if (hid.some((g) => g.cells >= 6)) lines.push("제안: 가려진 구역을 보이게 하려면 그 남쪽을 낮추거나(rect mode min), 골짜기 폭을 깊이보다 넓히거나, 방향을 남북으로 돌린다.");
  return { text: lines.join("\n"), cut: cut.length, hidden: r.hidden.length, hiddenRegions: hid };
}

export const reliefMatrixText = (h: HeightGrid) => h.map((r) => r.map((v) => v.toString(36)).join("")).join("\n");
