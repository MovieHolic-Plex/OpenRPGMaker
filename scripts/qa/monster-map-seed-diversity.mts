// 같은 요청(기본 캠페인)을 씨앗만 바꿔 지었을 때 길·필드·던전 맵끼리 얼마나 겹치는지 잰다(평행이동 ±10·좌우반전 최대 겹침).
// 실행: node_modules/.bin/vite-node --script scripts/qa/monster-map-seed-diversity.mts -- <출력.json> [씨앗 수=4]
import { writeFileSync } from "node:fs";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { templateOverlap } from "@/project/mapTemplateOverlap";
import type { Project } from "@/project/types";

const args = process.argv.slice(2).filter(a => a !== "--");
const out = args[0] ?? "monster-map-seed-diversity.json";
const n = Number(args[1] ?? 4);
const builds = Array.from({ length: n }, (_, seed) => createMonsterExpedition({ mapSeed: seed }) as unknown as { project: Project; manifest: { maps: { id: string; role: string }[] } });
const ids = builds[0]!.manifest.maps.filter(m => m.role === "field" || m.role === "dungeon").map(m => m.id);
const rows: { id: string; a: number; b: number; overlap: number }[] = [];
for (const id of ids) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
  const ma = builds[a]!.project.maps[id]!, mb = builds[b]!.project.maps[id]!;
  const grid = (m: typeof ma) => ({ width: m.width, height: m.height, lower: m.lowerTiles, tilesetId: m.tilesetId });
  rows.push({ id, a, b, overlap: Math.round(templateOverlap(grid(ma), grid(mb)).overlap * 1000) / 10 });
}
for (const id of ids) {
  const mine = rows.filter(r => r.id === id).map(r => r.overlap);
  console.log(`${id}: pairs ${mine.length} max ${Math.max(...mine)} mean ${(mine.reduce((s, v) => s + v, 0) / mine.length).toFixed(1)}`);
}
const all = rows.map(r => r.overlap);
console.log(`ALL pairs ${all.length} max ${Math.max(...all)} >=50% ${all.filter(v => v >= 50).length}`);
writeFileSync(out, JSON.stringify(rows, null, 1));
