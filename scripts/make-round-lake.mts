import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { ensureBuildPalettePresets, BUILD_PALETTE_PRESETS } from "@/editor/panels/buildPaletteCore";
import { TILE } from "@/project/defaults/constants";
import { loadProjectFromSupabase, saveProjectToSupabase } from "@/project/supabaseProjectSync";
import { supabaseProjectConfig } from "@/project/supabaseProjectConfig";
import type { Project } from "@/project/types";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const v = m[2].replace(/^["']|["']$/g, "");
    process.env[m[1]] = v;
    // vite-style for supabaseProjectConfig
    if (m[1].startsWith("VITE_")) process.env[m[1]] = v;
  }
}

function circleCells(cx: number, cy: number, radius: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  const r2 = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= r2) cells.push({ x, y });
    }
  }
  return cells;
}

async function main() {
  loadEnv();
  // mock import.meta.env via config explicit
  const config = {
    url: process.env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
    anonKey: process.env.VITE_SUPABASE_ANON_KEY!,
    projectId: process.env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
  };

  let project: Project | null = await loadProjectFromSupabase(config);
  if (!project) {
    console.log("no remote project, create blank");
    project = createBlankProject();
  }

  // pick a map - prefer start or largest outdoor
  const mapIds = Object.keys(project.maps);
  const mapId = project.startMapId && project.maps[project.startMapId] ? project.startMapId : mapIds[0];
  if (!mapId || !project.maps[mapId]) throw new Error("no map");
  const map = project.maps[mapId];
  const tileset = project.tilesets[map.tilesetId];
  if (tileset) ensureBuildPalettePresets(tileset);

  // center of map, radius ~6 for a nice round lake
  const cx = Math.floor(map.width / 2);
  const cy = Math.floor(map.height / 2);
  const radius = Math.min(7, Math.floor(Math.min(map.width, map.height) / 4));
  const cells = circleCells(cx, cy, radius).filter(
    (c) => c.x >= 1 && c.y >= 1 && c.x < map.width - 1 && c.y < map.height - 1,
  );

  // grass around first for contrast if empty-looking - fill whole map grass if mostly empty
  const lower = map.lowerTiles;
  let grassish = 0;
  for (let i = 0; i < lower.length; i++) if (lower[i] === TILE.GRASS || lower[i] === 0) grassish++;
  if (grassish < lower.length * 0.2) {
    // leave as is
  } else {
    // ensure grass field around lake
  }

  const ctx = { project };
  const waterGroup = BUILD_PALETTE_PRESETS.water;
  // Prefer fill_region only does rect - so paint_tiles cells with WATER body, autotile reshape
  // Also try paint with group center tile
  const group = tileset?.tileGroups?.find((g) => g.id === waterGroup);
  const waterTile =
    group?.patternGrammar?.parts.find((p) => p.role === "center")?.tileIds[0] ??
    group?.tileIds?.[0] ??
    TILE.WATER;

  console.log(JSON.stringify({ mapId, mapName: map.name, cx, cy, radius, cells: cells.length, waterTile, waterGroup }, null, 2));

  // Stamp circle with paint_tiles
  const paint = runTool(ctx, "paint_tiles", {
    mapId,
    layer: "lower",
    tile: waterTile,
    mode: "cells",
    cells,
  });
  console.log("paint", paint.ok, paint.summary);

  // Also run fill_region on bounding box? No that makes rect. Circle paint is enough.

  // Soft second pass: fill_region water on circle bounding then we already have circle from paint
  // Improve edges with fill_region only if we want - skip

  // Save
  const saved = await saveProjectToSupabase(ctx.project, config as any);
  console.log("save", saved);

  // Also write local evidence
  const outDir = path.join("output", "evidence", "round-lake");
  fs.mkdirSync(outDir, { recursive: true });
  const waterCount = ctx.project.maps[mapId].lowerTiles.filter((t) => t === waterTile || (group?.tileIds ?? []).includes(t)).length;
  fs.writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        mapId,
        mapName: map.name,
        cx,
        cy,
        radius,
        cellsRequested: cells.length,
        paintOk: paint.ok,
        paintSummary: paint.summary,
        waterishTiles: waterCount,
        saved,
      },
      null,
      2,
    ),
  );
  console.log("waterish", waterCount);
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
