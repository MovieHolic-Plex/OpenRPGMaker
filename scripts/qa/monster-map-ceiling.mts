// 몬스터 원정 길·필드·던전 맵의 천장(큰 방 테두리·벽 면)과 오토타일 이웃이 견본 규칙대로 이어졌는지 센다.
// 실행: node_modules/.bin/vite-node --script scripts/qa/monster-map-ceiling.mts -- <출력.json> [variant...] [--seeds 0-15]
// 변형 = monster-map-overlap.mts 와 같은 일곱(default desert snow coast volcano gym3 layoutB), 변형마다 mapSeed 를 바꿔 짓는다.
// 지표(요약 한 줄): frame = 큰 방 테두리 불일치 칸(hallFrameDefects) + 동굴 테두리 불일치 칸(caveRimDefects), autotile = 오토타일 엔진을 한 번 더 돌렸을 때 바뀌는 칸, overlap = 견본 최대 겹침, unreachable = 닿지 않는 이벤트.
// 전(前) 측정: 옛 체크아웃에서 돌릴 때는 CEILING_METRIC 에 새 fieldGenerator.ts 사본 경로를 주면 지표만 그 사본에서 가져온다.
import { writeFileSync } from "node:fs";
import { createMonsterExpedition, type ExpeditionOptions } from "@/project/examples/monsterExpedition";
import templateData from "@/project/examples/monsterExpedition/mapTemplates.json" with { type: "json" };
import { maxTemplateOverlap, type OverlapGrid } from "@/project/mapTemplateOverlap";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAllAutotileGroupsAround } from "@/project/defaults/autotileEngine";
import { canMove, layeredPassability } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

const metric = (process.env.CEILING_METRIC
  ? await import(process.env.CEILING_METRIC)
  : await import("@/project/examples/monsterExpedition/fieldGenerator")) as typeof import("@/project/examples/monsterExpedition/fieldGenerator");
const { hallFrameDefects, caveRimDefects, isCaveRimCell, fieldGeneratorInternals: { learn } } = metric;

const VARIANTS: Record<string, ExpeditionOptions> = {
  default: {}, desert: { startTheme: "desert" }, snow: { startTheme: "snow" }, coast: { startTheme: "coast" }, volcano: { startTheme: "volcano" },
  gym3: { gymCount: 3 }, layoutB: { startLayout: { size: "large", streets: "loop", pond: true, seed: 7 } },
} as Record<string, ExpeditionOptions>;

const raw = process.argv.slice(2).filter(a => a !== "--");
const si = raw.indexOf("--seeds");
const seedSpec = si >= 0 ? raw.splice(si, 2)[1]! : "0-15";
const [s0, s1] = seedSpec.split("-").map(Number);
const seeds = Array.from({ length: (s1 ?? s0!) - s0! + 1 }, (_, k) => s0! + k);
const out = raw[0] ?? "monster-map-ceiling.json";
const wanted = raw.slice(1).length ? raw.slice(1) : Object.keys(VARIANTS);
const templates = templateData as unknown as Record<string, OverlapGrid & { names: Record<string, number>; upper: number[] }>;

function unreachable(project: Project, map: GameMap, entry: { x: number; y: number }): number {
  const key = (x: number, y: number) => `${x},${y}`;
  const solid = new Set(map.events.filter(e => e.pages?.[0]?.overlapForbidden).map(e => key(e.x, e.y)));
  const seen = new Set([key(entry.x, entry.y)]), queue = [entry];
  for (let n = 0; n < queue.length; n++) {
    const p = queue[n]!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!seen.has(key(q.x, q.y)) && !solid.has(key(q.x, q.y)) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(key(q.x, q.y)); queue.push(q); }
    }
  }
  return map.events.filter(e => e.pages?.[0]?.trigger?.kind !== "auto")
    .filter(e => !seen.has(key(e.x, e.y)) && ![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => seen.has(key(e.x + dx!, e.y + dy!)))).length;
}

const rows: Record<string, unknown>[] = [];
for (const variant of wanted) for (const mapSeed of seeds) {
  const started = Date.now();
  const { project, manifest } = createMonsterExpedition({ ...VARIANTS[variant]!, mapSeed }) as unknown as { project: Project; manifest: { maps: { id: string; role: string; template: string; entry: { x: number; y: number } }[] } };
  let frameSum = 0, autoSum = 0, maxOv = 0, unr = 0;
  for (const m of manifest.maps.filter(x => x.role === "field" || x.role === "dungeon")) {
    const map = project.maps[m.id]!;
    const t = templates[m.template];
    const tileset = project.tilesets[map.tilesetId]!;
    const L = t ? learn(tileset, t as never) : undefined;
    const walk = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
      const i = y * map.width + x, p = layeredPassability(tileset, [map.lowerTiles[i]!, -1, map.upperTiles[i] ?? -1, -1]);
      return p.up || p.down || p.left || p.right;
    };
    const frame = L?.frame ?? L?.rim;
    const defects = [
      ...(L?.frame ? hallFrameDefects(L.frame, map.width, map.height, map.lowerTiles) : []),
      ...(L?.rim ? caveRimDefects(L.rim, map.width, map.height, map.lowerTiles, walk) : []),
    ];
    const copy = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] } as GameMap;
    shapeAllAutotileGroupsAround(copy, autotileGroupsForTileset(project.tilesets[map.tilesetId]!), Array.from({ length: map.width * map.height }, (_, i) => ({ x: i % map.width, y: (i / map.width) | 0 })));
    const auto: { x: number; y: number; tile: number; want: number }[] = [];
    // 동굴 테두리 한 줄은 자리로 정해진 그림이라 엔진 재성형 대상이 아니다(caveRimDefects 가 따로 잔다).
    copy.lowerTiles.forEach((v, i) => { if (v !== map.lowerTiles[i] && !(L?.rim && isCaveRimCell(map.width, map.height, i % map.width, (i / map.width) | 0, walk))) auto.push({ x: i % map.width, y: (i / map.width) | 0, tile: map.lowerTiles[i]!, want: v }); });
    const hit = maxTemplateOverlap({ width: map.width, height: map.height, lower: map.lowerTiles, tilesetId: map.tilesetId }, templates);
    const ov = hit ? Math.round(hit.overlap * 1000) / 10 : 0;
    const u = unreachable(project, map, m.entry);
    frameSum += defects.length; autoSum += auto.length; maxOv = Math.max(maxOv, ov); unr += u;
    rows.push({ variant, mapSeed, id: m.id, template: m.template, w: map.width, h: map.height, frame: !!frame, frameDefects: defects.length, defects: defects.slice(0, 40), autotile: auto.length, auto: auto.slice(0, 10), overlap: ov, unreachable: u });
  }
  console.log(`${variant} seed${mapSeed}: frame ${frameSum} autotile ${autoSum} maxOverlap ${maxOv} unreachable ${unr} | ${Date.now() - started}ms`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
const sum = (k: string) => rows.reduce((s, r) => s + (r[k] as number), 0);
console.log(`TOTAL rows ${rows.length} frame ${sum("frameDefects")} autotile ${sum("autotile")} unreachable ${sum("unreachable")} maxOverlap ${Math.max(...rows.map(r => r.overlap as number))} -> ${out}`);
