// 천장 칸 스캔 — 픽스처(JSON) 각 맵에서 «천장 구역»에 천장이 아닌 것이 보이는지 센다. 0 이어야 한다.
// 천장 구역 = 방 안(걸을 수 있는 주 성분)도, 벽면·벽 윗면도 아닌 칸: 아래층이 천장·공허 칸이거나, 이벤트 없는 고립 통행 성분(방 밖에 깔린 바닥 값 칸).
//  (1) orphan    — 방 밖에 깔린 통행 바닥 값 칸(고립 성분)
//  (2) nonCeil   — 천장 구역 칸의 어느 층이든 천장·공허 태그가 아닌 칸(바닥·소품·벽면 조각)
//  (3) light     — 칸 합성 그림의 테두리(밝은 선) 밖 화소 중앙 밝기가 DARK_MAX 를 넘는다(회색 디더 천장 = 바닥처럼 읽힘)
// 사용: tsx scripts/qa/fallen-ceiling-scan.mts <fixture.json> [mapId…]
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
const DARK_MAX = 22;
const d = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const only = new Set(process.argv.slice(3));
const bundled = readFileSync(new URL("../../src/assets/bundled.ts", import.meta.url), "utf8");
const pathOf = (key: string): string | null => new RegExp(`textureKey:"${key}",path:"([^"]+)"`).exec(bundled)?.[1] ?? null;
const imgCache = new Map<string, PNG>();
const sheet = (ts: any): PNG | null => {
  const key = ts.image?.id; if (!key) return null;
  if (!imgCache.has(key)) { const p = pathOf(key); if (!p) return null; imgCache.set(key, PNG.sync.read(readFileSync(new URL(`../../public/${p}`, import.meta.url)))); }
  return imgCache.get(key)!;
};
const CEIL = /천장|ceiling|공허|허공|void/iu;
const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"];
let bad = 0;
for (const [mid, m] of Object.entries<any>(d.maps)) {
  if (only.size && !only.has(mid)) continue;
  const W = m.width, H = m.height, ts = d.tilesets[m.tilesetId];
  const P = ts.passability, TM = ts.tileMeta, low: number[] = m.lowerTiles;
  const text = (t: number): string => { const x = TM?.[t]; return x ? `${x.label ?? ""} ${(x.tags ?? []).join(" ")}` : ""; };
  const isCeil = (t: number): boolean => CEIL.test(text(t));
  const pas = (i: number): boolean => low[i]! >= 0 && P[low[i]!] && Object.values(P[low[i]!]).every(Boolean);
  const evAt = new Set<number>((m.events ?? []).map((e: any) => e.y * W + e.x));
  const seen = new Uint8Array(W * H); const comps: number[][] = [];
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
  const img = sheet(ts), per = ts.tilesPerRow, S = ts.tileSize ?? 16;
  const nonCeil: string[] = [], light: string[] = [];
  const lightIds = new Map<number, number>(), nonIds = new Map<number, number>();
  for (let i = 0; i < W * H; i++) {
    if (!(low[i]! >= 0 && isCeil(low[i]!))) continue;
    const stack = LAYERS.map((k) => m[k]?.[i] ?? -1).filter((t: number) => t >= 0);
    for (const t of stack) if (!isCeil(t)) { nonCeil.push(`${i % W},${(i / W) | 0}#${t}`); nonIds.set(t, (nonIds.get(t) ?? 0) + 1); }
    if (!img) continue;
    // 합성(아래층부터 덮어 그림) 후 밝은 테두리 선(밝기 ≥ 60)을 뺀 화소의 중앙 밝기.
    const px = new Array(S * S).fill(0).map(() => [0, 0, 0]);
    for (const t of stack) {
      const sx = (t % per) * S, sy = Math.floor(t / per) * S;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const o = ((sy + y) * img.width + sx + x) * 4;
        if (img.data[o + 3]! > 127) px[y * S + x] = [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!];
      }
    }
    const lum = px.map(([r, g, b]) => 0.299 * r! + 0.587 * g! + 0.114 * b!).filter((v) => v < 60).sort((a, b) => a - b);
    const med = lum.length ? lum[lum.length >> 1]! : 0;
    if (med > DARK_MAX) { light.push(`${i % W},${(i / W) | 0}#${low[i]}`); lightIds.set(low[i]!, (lightIds.get(low[i]!) ?? 0) + 1); }
  }
  const nOrph = orphans.reduce((a, c) => a + c.length, 0);
  const n = nOrph + nonCeil.length + light.length;
  bad += n;
  console.log(`${mid}: orphan=${nOrph} nonCeil=${nonCeil.length} light=${light.length}`);
  for (const c of orphans) console.log(`  orphan ${c.length} cells at ${c[0]! % W},${(c[0]! / W) | 0}`);
  if (nonCeil.length) console.log(`  nonCeil ids ${[...nonIds].map(([t, k]) => `${t}×${k}(${text(t).slice(0, 30)})`).join(" ")} e.g. ${nonCeil.slice(0, 6).join(" ")}`);
  if (light.length) console.log(`  light ids ${[...lightIds].map(([t, k]) => `${t}×${k}`).join(" ")} e.g. ${light.slice(0, 6).join(" ")}`);
}
console.log(bad ? `FAIL ${bad}` : "OK 0");
process.exit(bad ? 1 : 0);
