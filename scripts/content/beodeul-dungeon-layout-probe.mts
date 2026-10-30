// 던전 배치 결함 셈(2026-10-29): bun scripts/content/beodeul-dungeon-layout-probe.mts cave 1-24  [TESTDIR=bake_cave.py --test-out 폴더]
// 동굴 배치 결함 셈: 일렬(같은 계열 셋이 같은 간격), 바닥 한가운데 외톨이, 방별 밀도 편차.
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { composeDungeon } from "@/editor/dungeonKit/beodeul/compose";
import fs from "node:fs";
const ts: any = createBeodeulCityTileset();
if (process.env.TESTDIR) {
  const T = JSON.parse(fs.readFileSync(process.env.TESTDIR + "/beodeulCityTileset.json", "utf8"));
  ts.count = JSON.parse(fs.readFileSync(process.env.TESTDIR + "/beodeulCitySheet.json", "utf8")).count;
  for (const k of ["passability", "priority", "terrain", "tileMeta", "animationStrips"]) ts[k] = T[k];
  const have = new Set(ts.structureKits.map((k: any) => k.id)); for (const k of T.structureKits) if (!have.has(k.id)) ts.structureKits.push(k);
}
const type = (process.argv[2] ?? "cave") as any;
const seeds = (process.argv[3] ?? "1-24").split("-").map(Number);
const ROCK = /stalagmite|rock-pillar|rubble-cave|boulder|crystal|broken-pillar|mushroom-patch/;
const DEBRIS = /bones|skull|rubble|pebble|glow-moss|glow-mushroom/;
let rows = 0, lone = 0, maps = 0, props = 0, spread = 0, errs = 0; const ex: string[] = [];
for (let seed = seeds[0]!; seed <= seeds[1]!; seed += 1) for (const size of ["small", "medium", "large"] as const) {
  let c; try { c = composeDungeon(ts, { type, seed, size }); } catch { errs += 1; continue; }
  maps += 1;
  const W = c.width, walk = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < c.height && "o.=".includes(c.picture[y]![x]!);
  const P = (c.placed ?? []).filter((p) => !/torch|vines|stalactite/.test(p.id));
  props += P.length;
  // 일렬: 같은 계열 물건 덩이(서로 2칸 이내로 이어짐) 중 셋 이상이고 한쪽 폭 1칸 이하·다른 쪽 4칸 이상인 것 = 띠·줄.
  const fam = (id: string) => /stalagmite|rock-pillar|broken-pillar|boulder|crystal-cluster/.test(id) ? "rock" : /glow-mush|glow-moss/.test(id) ? "glow" : /bone|skull/.test(id) ? "bone" : null;
  for (const f of ["rock", "glow", "bone"]) {
    const g = P.filter((p) => fam(p.id) === f); const seen = new Set<number>();
    g.forEach((_, i0) => {
      if (seen.has(i0)) return; const comp = [i0]; seen.add(i0);
      for (let k = 0; k < comp.length; k += 1) g.forEach((q, j) => { const a = g[comp[k]!]!; if (!seen.has(j) && Math.max(Math.abs(q.x - a.x), Math.abs(q.y - a.y)) <= 2) { seen.add(j); comp.push(j); } });
      if (comp.length < 3) return;
      const xs = comp.map((j) => g[j]!.x), ys = comp.map((j) => g[j]!.y);
      const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
      if (f !== "bone" && Math.min(bw, bh) <= 2 && Math.max(bw, bh) >= 5 && Math.max(bw, bh) / (Math.min(bw, bh) + 1) >= 2) { rows += 1; if (ex.length < 16) ex.push(`row ${f} ${type}-${seed}-${size} @${Math.min(...xs)},${Math.min(...ys)} n${comp.length} ${bw}x${bh}`); }
    });
  }
  // 외톨이: 부스러기 아닌 서는 물건, 둘레 2칸에 벽·물·다른 물건 없음
  for (const p of P) {
    if (DEBRIS.test(p.id)) continue;
    let ok = true;
    for (let dy = -2; dy <= 3 && ok; dy += 1) for (let dx = -2; dx <= 3; dx += 1) {
      const X = p.x + dx, Y = p.y + dy;
      if (!walk(X, Y)) { ok = false; break; }
      if (P.some((q) => q !== p && q.x === X && q.y === Y)) { ok = false; break; }
    }
    if (ok) { lone += 1; if (ex.length < 24) ex.push(`lone ${type}-${seed}-${size} @${p.x},${p.y} ${p.id}`); }
  }
  // 밀도: 넓이 40 이상 방의 물건/바닥 칸, 최대/최소
  const dens = c.rooms.filter((r) => r.w * r.h >= 40).map((r) => P.filter((p) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h).length / (r.w * r.h));
  if (dens.length >= 2) { const mx = Math.max(...dens), mn = Math.min(...dens); if (mn === 0 || mx / mn > 4) spread += 1; }
}
console.log(JSON.stringify({ type, maps, errs, propsPerMap: +(props / maps).toFixed(1), rows, lone, densitySpread: spread }));
console.log(ex.join("\n"));
