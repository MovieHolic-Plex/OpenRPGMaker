/**
 * 던전 테마별 자연 맵 3종 — 용암 / 석재 / 얼음.
 * 레이아웃은 src/project/defaults/dungeonThemedLayouts.ts 공유.
 * 실행: npx tsx scripts/build-dungeon-themed-maps.mts
 */
import fs from "node:fs";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import {
  buildDungeonThemeMap,
  countUpperDecorations,
  canReachDungeonLandmarks,
  DUNGEON_TILESET_ID,
  type DungeonTheme,
} from "../src/project/defaults/dungeonThemedLayouts.ts";
import { ensureTilesetHarnesses } from "../src/project/tilesetHarness.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-dungeon-example";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/
/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const config = { url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY!, projectId: PROJECT_ID };

const project: Project = createEmptyToolProject("던전 테마 맵");
project.meta.title = "던전 테마 맵 — 용암/석재/얼음";
ensureTilesetHarnesses(project);

const THEMES: { theme: DungeonTheme; id: string; name: string; dump: string }[] = [
  { theme: "lava", id: "map_lava", name: "용암 동굴", dump: "output/map-lava.json" },
  { theme: "stone", id: "map_stone", name: "석재 홀", dump: "output/map-stone.json" },
  { theme: "ice", id: "map_ice", name: "얼음 동굴", dump: "output/map-ice.json" },
];

fs.mkdirSync("output", { recursive: true });
const builtMaps = THEMES.map((m) => {
  const built = buildDungeonThemeMap(m.theme);
  if (!canReachDungeonLandmarks(built)) throw new Error(`landmarks not reachable: ${m.theme}`);
  const decor = countUpperDecorations(built.grid);
  if (decor < 18) throw new Error(`too sparse upper decor (${decor}) on ${m.theme}`);
  project.maps[m.id] = {
    id: m.id,
    name: m.name,
    width: built.width,
    height: built.height,
    tilesetId: DUNGEON_TILESET_ID,
    tileSize: 16,
    lowerTiles: built.grid.lower,
    upperTiles: built.grid.upper,
    events: [],
  };
  fs.writeFileSync(m.dump, JSON.stringify({ width: built.width, height: built.height, lowerTiles: built.grid.lower, upperTiles: built.grid.upper, decor, landmarks: built.landmarks }));
  console.log("[map]", m.id, m.name, "decor", decor, "->", m.dump);
  return { ...m, built };
});

project.startMapId = builtMaps[0]!.id;
project.startPos = builtMaps[0]!.built.start;
project.mapTree = { mapId: builtMaps[0]!.id, children: builtMaps.slice(1).map((m) => ({ mapId: m.id, children: [] })) };

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved);
const verify = await loadProjectFromSupabase(config);
console.log("[verify]", verify?.meta?.title, "maps:", THEMES.filter((m) => verify?.maps[m.id]).length, "/", THEMES.length);
if (!THEMES.every((m) => verify?.maps[m.id]?.width === builtMaps[0]!.built.width)) throw new Error("verify failed");
console.log("[done]");
