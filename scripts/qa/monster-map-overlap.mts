// 몬스터 원정(build_monster_game create)이 만든 맵이 참고 견본(mapTemplates.json)과 얼마나 겹치는지, 걸어서 닿는지 잰다.
// 실행: node_modules/.bin/vite-node --script scripts/qa/monster-map-overlap.mts -- <출력.json> [variant...]
// 출력: 맵마다 가장 닮은 견본·겹침, 입구에서 모든 이동 문·사람 이벤트에 닿는지, 분류별 요약.
import { writeFileSync } from "node:fs";
import { createMonsterExpedition, type ExpeditionOptions } from "@/project/examples/monsterExpedition";
import templateData from "@/project/examples/monsterExpedition/mapTemplates.json" with { type: "json" };
import { maxTemplateOverlap, type OverlapGrid } from "@/project/mapTemplateOverlap";
import { canMove, isPassableLanding } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";

/** 길 출구 가장자리 칸마다 이동 이벤트가 있는가(test/monsterExpeditionRoadExits.test.ts 와 같은 판정, 빈칸 수만 센다). */
function roadExitGaps(project: Project, manifest: { maps: { id: string; role: string }[]; links: { from: string; to: string; eventId: string; source: { x: number; y: number } }[] }): string[] {
  const role = new Map(manifest.maps.map(m => [m.id, m.role]));
  const isTransfer = (e: GameEvent) => JSON.stringify(e.pages ?? e.commands).includes('"kind":"transfer"');
  const gaps: string[] = [];
  for (const link of manifest.links) {
    if (role.get(link.from) === "interior" || /_(house|center|mart|gym)(_2f)?$/.test(link.to)) continue;
    const map = project.maps[link.from]!;
    const { x, y } = link.source;
    const dist = { N: y, S: map.height - 1 - y, W: x, E: map.width - 1 - x };
    const [side, near] = Object.entries(dist).sort((a, b) => a[1] - b[1])[0]! as ["N" | "S" | "W" | "E", number];
    if (near > 4) continue;
    const toEdge = (p: { x: number; y: number }) => (side === "N" ? p.y : side === "S" ? map.height - 1 - p.y : side === "W" ? p.x : map.width - 1 - p.x);
    const out = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[side];
    const queue = [{ x, y }], seen = new Set([`${x},${y}`]);
    for (let n = 0; n < queue.length; n++) {
      const p = queue[n]!;
      if (toEdge(p) === 0) {
        let cover: GameEvent | undefined;
        for (let k = 0; k <= near && !cover; k++) cover = map.events.find(e => e.x === p.x - out[0]! * k && e.y === p.y - out[1]! * k && isTransfer(e));
        if (!cover) gaps.push(`${link.from}->${link.to} ${p.x},${p.y}`);
      }
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (q.x < 0 || q.y < 0 || q.x >= map.width || q.y >= map.height || seen.has(`${q.x},${q.y}`) || toEdge(q) > near) continue;
        if (isPassableLanding(project, map, q.x, q.y) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(`${q.x},${q.y}`); queue.push(q); }
      }
    }
  }
  return gaps;
}

const templates = templateData as unknown as Record<string, OverlapGrid>;
const VARIANTS: Record<string, ExpeditionOptions> = {
  default: {}, desert: { startTheme: "desert" }, snow: { startTheme: "snow" }, coast: { startTheme: "coast" }, volcano: { startTheme: "volcano" },
  gym3: { gymCount: 3 }, layoutB: { startLayout: { size: "large", streets: "loop", pond: true, seed: 7 } },
  seed1: { mapSeed: 1 }, seed2: { mapSeed: 2 }, seed3: { mapSeed: 3 },
} as Record<string, ExpeditionOptions>;

const args = process.argv.slice(2).filter(a => a !== "--");
const out = args[0] ?? "monster-map-overlap.json";
const wanted = args.slice(1).length ? args.slice(1) : Object.keys(VARIANTS);

function reach(project: Project, map: GameMap, entry: { x: number; y: number }) {
  const key = (x: number, y: number) => `${x},${y}`;
  const solid = new Set(map.events.filter(e => e.pages?.[0]?.overlapForbidden).map(e => key(e.x, e.y)));
  const seen = new Set([key(entry.x, entry.y)]);
  const queue = [entry];
  for (let n = 0; n < queue.length; n++) {
    const p = queue[n]!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!seen.has(key(q.x, q.y)) && !solid.has(key(q.x, q.y)) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(key(q.x, q.y)); queue.push(q); }
    }
  }
  const unreachable: string[] = [];
  for (const e of map.events) {
    const touch = e.pages?.[0]?.trigger?.kind === "auto";
    if (touch) continue;
    const ok = seen.has(key(e.x, e.y)) || [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => seen.has(key(e.x + dx!, e.y + dy!)));
    if (!ok) unreachable.push(e.id);
  }
  return { reached: seen.size, unreachable };
}

const rows: Record<string, unknown>[] = [];
for (const variant of wanted) {
  const options = VARIANTS[variant] ?? (/^seed(\d+)$/.test(variant) ? { mapSeed: Number(variant.slice(4)) } as ExpeditionOptions : undefined);
  if (!options) throw Error(`unknown variant ${variant}`);
  const started = Date.now();
  const { project, manifest } = createMonsterExpedition(options) as unknown as { project: Project; manifest: { maps: { id: string; role: string; template: string; entry: { x: number; y: number } }[]; links: { from: string; to: string; eventId: string; source: { x: number; y: number } }[] } };
  const gaps = roadExitGaps(project, manifest);
  for (const m of manifest.maps) {
    const map = project.maps[m.id];
    if (!map) continue;
    const hit = maxTemplateOverlap({ width: map.width, height: map.height, lower: map.lowerTiles, tilesetId: map.tilesetId }, templates);
    const r = reach(project, map, m.entry);
    rows.push({ variant, id: m.id, name: map.name, role: m.role, template: m.template, w: map.width, h: map.height,
      best: hit?.key ?? null, overlap: hit ? Math.round(hit.overlap * 1000) / 10 : null, dx: hit?.dx, dy: hit?.dy, flip: hit?.flip,
      reached: r.reached, unreachable: r.unreachable });
  }
  const mine = rows.filter(r => r.variant === variant);
  const fd = mine.filter(r => r.role === "field" || r.role === "dungeon");
  const ov = (r: Record<string, unknown>) => (r.overlap as number) ?? 0;
  console.log(`${variant}: maps ${mine.length} | >=95% ${mine.filter(r => ov(r) >= 95).length} | field+dungeon ${fd.length} max ${Math.max(...fd.map(ov))} mean ${(fd.reduce((s, r) => s + ov(r), 0) / fd.length).toFixed(1)} >=40% ${fd.filter(r => ov(r) >= 40).length} | unreachable events ${mine.reduce((s, r) => s + (r.unreachable as string[]).length, 0)} (field+dungeon ${fd.reduce((s, r) => s + (r.unreachable as string[]).length, 0)}) | road-exit gaps ${gaps.length}${gaps.length ? " " + gaps.slice(0, 4).join("; ") : ""} | ${Date.now() - started}ms`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`wrote ${rows.length} rows -> ${out}`);
