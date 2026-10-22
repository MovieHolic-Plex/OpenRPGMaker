// 던전 맵 공간 측정(2026-10-23 assistant-dungeons-2): 검은 허공(천장)·맨바닥·가장 큰 빈 직사각형.
// 「공간이 남으면 맵이 너무 큰 것이다」 — 빈 칸은 메우지 않고 줄인다. 이 측정은 그 판단의 자다(옛 set-tool space 와 같은 뜻).
//   voidPct    : 천장(검은 허공) 칸 / 전체
//   bareFloorPct: 걸을 수 있는 바닥 중 8 이웃까지 물건·이벤트가 없는 칸 / 전체
//   maxBareRect: 물건·이벤트 없는 걸을 수 있는 바닥으로만 된 직사각형(짧은 변 ≥ 3) 중 가장 넓은 것
//   worstScreenVoidPct: 플레이어 카메라(걸을 수 있는 칸 중심, 맵 경계로 당긴 20×15) 창의 깊은 허공 비율 최댓값
import type { GameMap, Project } from "../../../src/project/types.ts";

export interface SpaceMeasure { w: number; h: number; voidPct: number; bareFloorPct: number; maxBareRect: { w: number; h: number; x: number; y: number; area: number }; worstScreenVoidPct: number; worstScreenAt: { x: number; y: number }; meanScreenVoidPct: number }

export function measureSpace(project: Project, map: GameMap): SpaceMeasure {
  const ts = project.tilesets[map.tilesetId]!;
  const ceil = new Set<number>();
  for (const g of ts.autotileGroups ?? []) if (/ceiling/.test(g.id)) for (const v of Object.values(g.variantMap ?? {})) ceil.add(Number(v));
  const W = map.width, H = map.height, N = W * H;
  const pass = (t: number) => { const p = ts.passability?.[t]; return !!p && Object.values(p).some(Boolean); };
  const ev = new Set(map.events.map((e) => e.y * W + e.x));
  const isVoid = new Uint8Array(N), empty = new Uint8Array(N), walk = new Uint8Array(N);
  for (let i = 0; i < N; i += 1) {
    const lo = map.lowerTiles[i]!, up = map.upperTiles?.[i] ?? -1;
    if (lo < 0 || ceil.has(lo)) { isVoid[i] = 2; continue; }
    if (pass(lo) && (up < 0 || pass(up))) { walk[i] = 1; if (up < 0 && !ev.has(i)) empty[i] = 1; }
  }
  // 깊은 허공 = 여덟 이웃도 모두 천장인 칸(바닥·벽에 닿는 천장 테두리 띠는 벽 윗면으로 읽힌다 — 허공이 아니다).
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    if (isVoid[i] !== 2) continue;
    let deep = true;
    for (let dy = -1; dy <= 1 && deep; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; if (!isVoid[Y * W + X]) { deep = false; break; } }
    isVoid[i] = deep ? 1 : 3;
  }
  for (let i = 0; i < N; i += 1) isVoid[i] = isVoid[i] === 1 ? 1 : 0;
  let bare = 0, voids = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    if (isVoid[i]) voids += 1;
    if (!empty[i]) continue;
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (walk[j] && !empty[j]) { ok = false; break; } }
    if (ok) bare += 1;
  }
  // 가장 큰 빈 직사각형(짧은 변 ≥ 3): 막대 높이 + 단조 스택
  let best = { w: 0, h: 0, x: 0, y: 0, area: 0 };
  const hgt = new Int32Array(W);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) hgt[x] = empty[y * W + x] ? hgt[x]! + 1 : 0;
    for (let x = 0; x < W; x += 1) {
      let minH = 1 << 30;
      for (let x2 = x; x2 < W && hgt[x2]! > 0; x2 += 1) {
        minH = Math.min(minH, hgt[x2]!);
        const w = x2 - x + 1, area = w * minH;
        if (Math.min(w, minH) >= 3 && area > best.area) best = { w, h: minH, x, y: y - minH + 1, area };
      }
    }
  }
  // 화면 창은 플레이어가 실제로 보는 창이다: 걸을 수 있는 칸을 가운데 두고 맵 경계에 맞춰 당긴 20×15 카메라.
  const SW = Math.min(20, W), SH = Math.min(15, H);
  let worst = 0, sum = 0, n = 0;
  let worstAt = { x: 0, y: 0 };
  const seen = new Set<number>();
  for (let cy = 0; cy < H; cy += 1) for (let cx = 0; cx < W; cx += 1) {
    if (!walk[cy * W + cx]) continue;
    const x0 = Math.max(0, Math.min(W - SW, cx - (SW >> 1))), y0 = Math.max(0, Math.min(H - SH, cy - (SH >> 1)));
    const key = y0 * W + x0;
    if (seen.has(key)) continue;
    seen.add(key);
    let v = 0;
    for (let y = y0; y < y0 + SH; y += 1) for (let x = x0; x < x0 + SW; x += 1) if (isVoid[y * W + x]) v += 1;
    const p = v / (SW * SH); if (p > worst) worstAt = { x: x0, y: y0 }; worst = Math.max(worst, p); sum += p; n += 1;
  }
  const r = (v: number) => Math.round(v * 1000) / 10;
  return { w: W, h: H, voidPct: r(voids / N), bareFloorPct: r(bare / N), maxBareRect: best, worstScreenVoidPct: r(worst), worstScreenAt: worstAt, meanScreenVoidPct: r(n ? sum / n : 0) };
}
