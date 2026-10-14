// 던전 (종류 × 어댑터) 증명 표(2026-10-15) — author_dungeon 도구를 실제로 돌려 맵 PNG(원본 해상도)와 검사 결과를 쏟는다.
//   bun scripts/content/dungeon-proof.mts <outDir> [seed ...]      (기본 시드 3 7)
// 검사: 도구 내부(받침·도달) + run_lint + check_reachability(입구→모든 방 spot) + check_terrain_access(입구→모든 spot).
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../src/project/defaults/blankProject.ts";
import { applyGenrePreset } from "../../src/project/genrePresets.ts";
import { AUTHOR_DUNGEON_TOOL } from "../../src/editor/tools/dungeonTools.ts";
import { QUERY_TOOLS } from "../../src/editor/tools/queryTools.ts";
import { TERRAIN_TOOLS } from "../../src/editor/tools/terrainTools.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { store } from "../../src/project/store.ts";

const out = process.argv[2] ?? "/tmp/dg/proof";
const seeds = process.argv.slice(3).length ? process.argv.slice(3).map(Number) : [3, 7];
fs.mkdirSync(out, { recursive: true });
const tool = (list: readonly { name: string; run: (p: never, a: never) => unknown }[], n: string) => list.find((t) => t.name === n)!;
const lintTool = tool(QUERY_TOOLS as never, "run_lint"), reachTool = tool(QUERY_TOOLS as never, "check_reachability"), accessTool = tool(TERRAIN_TOOLS as never, "check_terrain_access");

const MATRIX: { adapter: "beodeul" | "monster"; type: string; variant?: string }[] = [
  ...["catacomb", "castle", "labyrinth", "sewer", "cave", "temple", "mine", "volcano"].map((type) => ({ adapter: "beodeul" as const, type })),
  { adapter: "monster", type: "cave" }, { adapter: "monster", type: "cave", variant: "wet" }, { adapter: "monster", type: "volcano" },
  { adapter: "monster", type: "ice" }, { adapter: "monster", type: "labyrinth" }, { adapter: "monster", type: "temple" },
];
const rows: unknown[] = [];
for (const m of MATRIX) for (const seed of seeds) for (const genre of ["rpg", "pokemon"] as const) {
  if (genre === "pokemon" && !(m.adapter === "monster" || (m.type === "cave" && m.adapter === "beodeul"))) continue; // 포켓몬 프리셋은 몬스터 키트 + 비교용 버들항 동굴만
  const name = `${m.adapter}-${m.type}${m.variant ? "-" + m.variant : ""}-${genre}-${seed}`;
  const project = createBlankProject();
  applyGenrePreset(project, genre === "pokemon" ? "monster-collect" : "adventure-jrpg");
  store.loadProject?.(project);
  try {
    const t0 = performance.now();
    const res = AUTHOR_DUNGEON_TOOL.run(project, { type: m.type, ...(m.variant ? { variant: m.variant } : {}), adapter: m.adapter, genre, seed, size: genre === "pokemon" ? "small" : "medium" }) as { data: Record<string, any>; warnings?: string[] };
    const ms = Math.round(performance.now() - t0);
    const d = res.data, mapId = d.mapId as string, map = project.maps[mapId]!;
    fs.writeFileSync(path.join(out, `${name}.png`), renderMapPng(project, map).png);
    const spots: { x: number; y: number }[] = d.rooms.flatMap((r: any) => r.spots.slice(0, 2));
    const from = d.entrance as { x: number; y: number };
    const reach = (reachTool.run as any)(project, { mapId, from, targets: spots }) as { data?: any; summary: string };
    const access = (accessTool.run as any)(project, { mapId, from, targets: spots, events: false }) as { data: { reachable: boolean }; summary: string };
    const lint = (lintTool.run as any)(project, { mapId }) as { data: { counts: { errors: number; warnings: number } } };
    rows.push({ name, adapter: m.adapter, type: m.type, variant: m.variant ?? null, genre, seed, ms, w: d.width, h: d.height, rooms: d.rooms.length, tilesetId: d.tilesetId,
      toolWarnings: res.warnings ?? [], lintErrors: lint.data.counts.errors, lintWarnings: lint.data.counts.warnings, terrainAccess: access.data.reachable, accessSummary: access.summary,
      reachSummary: reach.summary, population: { wild: d.population.wildZones.length, enemies: d.population.enemies.length, chests: d.population.chests.length, boss: !!d.population.boss, gate: !!d.population.lockedGate, shortcut: !!d.population.shortcut },
      counts: d.counts, locations: map.locations?.length ?? 0 });
    console.log(name, `${d.width}x${d.height}`, `${ms}ms`, "lintE", lint.data.counts.errors, "access", access.data.reachable, "|", reach.summary);
  } catch (e) { rows.push({ name, error: (e as Error).message }); console.log(name, "ERR", (e as Error).message.slice(0, 160)); }
}
fs.writeFileSync(path.join(out, "proof.json"), JSON.stringify(rows, null, 1));
