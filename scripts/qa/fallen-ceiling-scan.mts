// 천장 칸에 바닥 칸 스캔 — 픽스처(JSON) 각 맵에서 (1) 이벤트 없는 고립 통행 성분(방 밖에 깔린 바닥 값 칸)과
// (2) 천장/벽 하부 위에 얹힌 바닥 태그 위층 칸을 센다. 0 이어야 한다. 사용: tsx scripts/qa/fallen-ceiling-scan.mts <fixture.json>
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
let bad = 0;
for (const [mid, m] of Object.entries<any>(d.maps)) {
  const W = m.width, H = m.height, ts = d.tilesets[m.tilesetId];
  const P = ts.passability, TM = ts.tileMeta, low: number[] = m.lowerTiles;
  const tags = (t: number): string[] => (t >= 0 && TM[t]?.tags) || [];
  const pas = (i: number): boolean => low[i]! >= 0 && Object.values(P[low[i]!]).every(Boolean);
  const evAt = new Set<number>((m.events ?? []).map((e: any) => e.y * W + e.x));
  const seen = new Uint8Array(W * H);
  const comps: number[][] = [];
  for (let s = 0; s < W * H; s++) {
    if (!pas(s) || seen[s]) continue;
    const q = [s]; seen[s] = 1; const cells: number[] = [];
    while (q.length) {
      const i = q.pop()!; cells.push(i); const x = i % W, y = (i / W) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const)
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && pas(ny * W + nx) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push(ny * W + nx); }
    }
    comps.push(cells);
  }
  const main = comps.reduce((a, c) => (c.length > a.length ? c : a), [] as number[]);
  const orphans = comps.filter((c) => c !== main && !c.some((i) => evAt.has(i)));
  const upperOnCeil: string[] = [];
  for (const k of ["upperTiles", "lowerOverlayTiles", "upperOverlayTiles"]) for (let i = 0; i < W * H; i++) {
    const t = m[k]?.[i] ?? -1;
    if (t >= 0 && tags(t).includes("floor") && (tags(low[i]!).includes("ceiling") || low[i] === 1)) upperOnCeil.push(`${k}@${i % W},${(i / W) | 0}`);
  }
  const n = orphans.reduce((a, c) => a + c.length, 0) + upperOnCeil.length;
  bad += n;
  console.log(`${mid}: orphanComps=${orphans.length} cells=${orphans.reduce((a, c) => a + c.length, 0)} upperOnCeiling=${upperOnCeil.length}`);
  for (const c of orphans) console.log(`  orphan ${c.length} cells at ${c[0]! % W},${(c[0]! / W) | 0}`);
}
console.log(bad ? `FAIL ${bad}` : "OK 0");
process.exit(bad ? 1 : 0);
