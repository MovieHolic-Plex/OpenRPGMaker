/**
 * 실내 타일 시공용 빈 맵 하네스.
 * easyrpg_chipset_interior 타일셋 + interior harness groups 를 붙인 뒤
 * 바닥만 깔린 빈 방을 Supabase 에 저장한다.
 */
import fs from "node:fs";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { INTERIOR_HOUSE_TILE, INTERIOR_HOUSE_TILESET_ID } from "../src/editor/interiorStructureStamp.ts";
import { ensureTilesetHarnesses } from "../src/project/tilesetHarness.ts";
import { INTERIOR_HARNESS_PREFIX } from "../src/project/tilesetHarness/themePacks.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

const MAP_ID = "map_interior_blank";
const MAP_NAME = "실내 공터 (타일 하네스)";
const MAP_W = 20;
const MAP_H = 15;
const FLOOR_TILE = INTERIOR_HOUSE_TILE.FLOOR;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

const project: Project = createEmptyToolProject("실내 타일 하네스");
project.meta.title = "실내 타일 하네스 — 빈 방";
ensureTilesetHarnesses(project);

if (!project.tilesets[INTERIOR_HOUSE_TILESET_ID]) {
  throw new Error(`interior tileset missing: ${INTERIOR_HOUSE_TILESET_ID}`);
}

const size = MAP_W * MAP_H;
project.maps[MAP_ID] = {
  id: MAP_ID,
  name: MAP_NAME,
  width: MAP_W,
  height: MAP_H,
  tilesetId: INTERIOR_HOUSE_TILESET_ID,
  tileSize: 16,
  lowerTiles: new Array<number>(size).fill(FLOOR_TILE),
  upperTiles: new Array<number>(size).fill(-1),
  events: [],
};
project.startMapId = MAP_ID;
project.startPos = { x: Math.floor(MAP_W / 2), y: Math.floor(MAP_H / 2) };
project.mapTree = { mapId: MAP_ID, children: [] };

const tileset = project.tilesets[INTERIOR_HOUSE_TILESET_ID]!;
const harnessGroups = (tileset.tileGroups ?? []).filter((group) => group.id.startsWith(INTERIOR_HARNESS_PREFIX));
console.log("[map]", MAP_ID, `${MAP_W}x${MAP_H}`, "tileset", INTERIOR_HOUSE_TILESET_ID, "floor", FLOOR_TILE);
console.log("[harness]", harnessGroups.map((group) => `${group.id} (${group.tileIds.length})`).join(" | "));

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved);

const verify = await loadProjectFromSupabase(config);
const map = verify?.maps[MAP_ID];
const verifyTileset = verify?.tilesets[INTERIOR_HOUSE_TILESET_ID];
const verifyGroups = (verifyTileset?.tileGroups ?? []).filter((group) => group.id.startsWith(INTERIOR_HARNESS_PREFIX));
console.log(
  "[verify]",
  verify?.meta?.title,
  map ? `${map.width}x${map.height}` : null,
  "tileset",
  map?.tilesetId,
  "start",
  verify?.startPos,
  "harnessGroups",
  verifyGroups.length,
);
if (!map || map.tilesetId !== INTERIOR_HOUSE_TILESET_ID || verifyGroups.length === 0) {
  throw new Error("interior blank map harness verify failed");
}
console.log("[done] 에디터 새로고침 후 실내 타일 깔기");
