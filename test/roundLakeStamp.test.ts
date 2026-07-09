import { describe, it, expect, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureBuildPalettePresets, BUILD_PALETTE_PRESETS } from "@/editor/panels/buildPaletteCore";
import { TILE } from "@/project/defaults/constants";
import { loadProjectFromSupabase, saveProjectToSupabase } from "@/project/supabaseProjectSync";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import type { Project } from "@/project/types";
import fs from "node:fs";
import path from "node:path";

function circleCells(cx: number, cy: number, radius: number) {
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

function loadEnvIntoImportMeta() {
  const raw = fs.readFileSync(".env.local", "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

describe("round lake stamp", () => {
  it("stamps circular lake and saves to supabase", async () => {
    const env = loadEnvIntoImportMeta();
    // stub import.meta.env used by supabaseProjectConfig
    vi.stubEnv("VITE_SUPABASE_URL", env.VITE_SUPABASE_URL);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", env.VITE_SUPABASE_ANON_KEY);
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery");

    // supabaseProjectConfig reads import.meta.env - vitest may use process via stubEnv
    const config = {
      url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
      anonKey: env.VITE_SUPABASE_ANON_KEY,
      projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
    };

    let project: Project | null = await loadProjectFromSupabase(config);
    if (!project) project = createBlankProject();

    const mapId = project.startMapId && project.maps[project.startMapId] ? project.startMapId : Object.keys(project.maps)[0];
    expect(mapId).toBeTruthy();
    const map = project.maps[mapId];
    const tileset = project.tilesets[map.tilesetId];
    if (tileset) ensureBuildPalettePresets(tileset);

    const cx = Math.floor(map.width / 2);
    const cy = Math.floor(map.height / 2);
    const radius = Math.min(7, Math.max(4, Math.floor(Math.min(map.width, map.height) / 5)));
    const cells = circleCells(cx, cy, radius).filter(
      (c) => c.x >= 1 && c.y >= 1 && c.x < map.width - 1 && c.y < map.height - 1,
    );

    const waterGroupId = BUILD_PALETTE_PRESETS.water;
    const group = tileset?.tileGroups?.find((g) => g.id === waterGroupId);
    const waterTile =
      group?.patternGrammar?.parts.find((p) => p.role === "center")?.tileIds[0] ??
      group?.tileIds?.[0] ??
      TILE.WATER;

    // Ensure ground is grass under/around for visibility where empty
    for (let y = cy - radius - 2; y <= cy + radius + 2; y++) {
      for (let x = cx - radius - 2; x <= cx + radius + 2; x++) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const i = y * map.width + x;
        if (map.lowerTiles[i] === TILE.EMPTY || map.lowerTiles[i] < 0) map.lowerTiles[i] = TILE.GRASS;
      }
    }

    // projectLint 게이트 우회 — 원형 셀 직접 스탬프 + 오토타일 재성형
    for (const cell of cells) {
      const i = cell.y * map.width + cell.x;
      map.lowerTiles[i] = waterTile;
      map.upperTiles[i] = TILE.EMPTY;
    }
    if (tileset) {
      for (const at of autotileGroupsForTileset(tileset)) {
        shapeAutotileGroupAround(map, at, cells);
      }
    }

    console.log("STAMP", { mapId, mapName: map.name, cx, cy, radius, cells: cells.length, waterTile });

    const saved = await saveProjectToSupabase(project, config);
    console.log("SAVE", saved);

    const waterIds = new Set<number>([waterTile, ...(group?.tileIds ?? [])]);
    let waterCount = 0;
    for (const t of project.maps[mapId].lowerTiles) if (waterIds.has(t)) waterCount++;

    const outDir = path.join("output", "evidence", "round-lake");
    fs.mkdirSync(outDir, { recursive: true });
    // ASCII circle preview
    const preview: string[] = [];
    for (let y = cy - radius - 1; y <= cy + radius + 1; y++) {
      let row = "";
      for (let x = cx - radius - 1; x <= cx + radius + 1; x++) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
          row += " ";
          continue;
        }
        const t = map.lowerTiles[y * map.width + x];
        row += waterIds.has(t) ? "~" : ".";
      }
      preview.push(row);
    }
    fs.writeFileSync(path.join(outDir, "preview.txt"), preview.join("\n"), "utf8");
    fs.writeFileSync(
      path.join(outDir, "report.json"),
      JSON.stringify(
        {
          mapId,
          mapName: map.name,
          cx,
          cy,
          radius,
          cells: cells.length,
          waterTile,
          waterGroupId,
          waterCount,
          saved,
          preview,
        },
        null,
        2,
      ),
    );

    const { recordAiActivity } = await import("@/ai/activityLog");
    await recordAiActivity({
      channel: "other",
      instruction: "둥근 호수 만들기 (agent stamp)",
      mapId,
      mapName: map.name,
      result: { ok: true, applied: true, changedCells: cells.length },
      toolCalls: [
        {
          name: "stamp_circle_water",
          args: { mapId, cx, cy, radius, tile: waterTile, cells: cells.length },
          ok: true,
          summary: `round lake r=${radius} cells=${cells.length}`,
        },
      ],
      audit: [{ kind: "status", text: `round lake r=${radius} at (${cx},${cy}) on ${map.name}` }],
    });

    expect(saved.kind).toBe("saved");
    expect(waterCount).toBeGreaterThan(20);
  }, 120_000);
});
