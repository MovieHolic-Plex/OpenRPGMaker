// 몬스터 원정의 길·필드·던전 맵과 그 참고 견본을 PNG 로 나란히 남긴다(사람이 자연스러운지 보는 용도).
// 실행: node_modules/.bin/vite-node --script scripts/qa/monster-map-render.mts -- <출력 폴더> [mapSeed...]
// 남기는 것: tpl-<견본>.png(견본 그대로) · s<씨앗>-<맵 id>.png(생성본, 이벤트 칸은 분홍 테두리) · render.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import templateData from "@/project/examples/monsterExpedition/mapTemplates.json" with { type: "json" };
import { renderMapPng } from "../qa-game/render.mts";
import type { GameMap, Project } from "@/project/types";

const args = process.argv.slice(2).filter(a => a !== "--");
const out = args[0] ?? "monster-map-render";
const seeds = (args.slice(1).length ? args.slice(1) : ["0"]).map(Number);
mkdirSync(out, { recursive: true });
const templates = templateData as unknown as Record<string, { width: number; height: number; lower: number[]; upper: number[]; tilesetId: string }>;
const indexFile = path.join(out, "render.json");
const index: Record<string, unknown>[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as Record<string, unknown>[]).filter(row => !seeds.includes(row.seed as number)) : [];
const drawn = new Set<string>();
for (const seed of seeds) {
  const { project, manifest } = createMonsterExpedition({ mapSeed: seed }) as unknown as { project: Project; manifest: { maps: { id: string; role: string; template: string }[] } };
  for (const m of manifest.maps.filter(x => x.role === "field" || x.role === "dungeon")) {
    const map = project.maps[m.id]!;
    const file = `s${seed}-${m.id}.png`;
    writeFileSync(path.join(out, file), renderMapPng(project, map, 2).png);
    const t = templates[m.template];
    if (t && !drawn.has(m.template)) {
      drawn.add(m.template);
      const tm = { ...map, id: `tpl`, width: t.width, height: t.height, lowerTiles: [...t.lower], upperTiles: [...t.upper], events: [] } as GameMap;
      writeFileSync(path.join(out, `tpl-${m.template.replace("/", "_")}.png`), renderMapPng(project, tm, 2).png);
    }
    index.push({ seed, id: m.id, name: map.name, template: m.template, file, tpl: `tpl-${m.template.replace("/", "_")}.png`, w: map.width, h: map.height,
      events: map.events.filter(e => !e.id.includes("_edge_")).map(e => [e.x, e.y]) });
  }
}
writeFileSync(indexFile, JSON.stringify(index, null, 1));
console.log(`rendered ${index.length} maps -> ${out}`);
