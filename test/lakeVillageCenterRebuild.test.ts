import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { BUILD_PALETTE_GROUP_IDS, ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { TILE } from "@/project/defaults/constants";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { saveProjectToSupabase } from "@/project/supabaseProjectSync";
import { recordAiActivity } from "@/ai/activityLog";
import type { Project } from "@/project/types";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function runOk(ctx: { project: Project }, name: string, args: Record<string, unknown>): string {
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    throw new Error(`${name} failed: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
  }
  return result.summary;
}

function p(ctx: { project: Project }): Project {
  return ctx.project;
}

function placeTreesAroundLake(
  ctx: { project: Project },
  mapId: string,
  lake: { x: number; y: number; w: number; h: number },
  ring: number,
  count: number,
  seed: number,
): string {
  const area = {
    x: Math.max(1, lake.x - ring),
    y: Math.max(1, lake.y - ring),
    w: lake.w + ring * 2,
    h: lake.h + ring * 2,
  };
  return runOk(ctx, "place_props", {
    mapId,
    area,
    material: "침엽수",
    count,
    naturalness: 0.55,
    minGap: 1,
    seed,
  });
}

function stampCornerHouse(
  ctx: { project: Project },
  mapId: string,
  x: number,
  y: number,
  kitId: "blue-stone" | "bright-plaster",
): string {
  return runOk(ctx, "build_house_kit", {
    mapId,
    kitId,
    wings: [{ x, y, w: 7, h: 6 }],
    doorEvent: false,
    interior: false,
  });
}

describe("center lake village rebuild", () => {
  it("wipes maps, center circle lakes, trees around only", async () => {
    const env = loadEnv();
    vi.stubEnv("VITE_SUPABASE_URL", env.VITE_SUPABASE_URL);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", env.VITE_SUPABASE_ANON_KEY);
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery");

    const config = {
      url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
      anonKey: env.VITE_SUPABASE_ANON_KEY,
      projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
    };

    const blank = createBlankProject();
    blank.meta.title = "호수 마을";
    blank.maps = {};
    blank.mapTree = { mapId: "", children: [] };
    blank.startMapId = "";
    const ctx = { project: blank };
    const logs: string[] = [];

    // ── 맵 1: 50×50 — 중앙 호수 → 주변 나무 → 모서리 집 ──
    logs.push(runOk(ctx, "create_map", { id: "map_lake_village", name: "호수 마을", width: 50, height: 50 }));
    ensureBuildPaletteTileGroups(p(ctx).tilesets[p(ctx).maps.map_lake_village.tilesetId]);

    // 맵 중앙 원형 호수
    const villageLake = { x: 19, y: 19, w: 12, h: 12 };
    logs.push(
      runOk(ctx, "fill_region", {
        mapId: "map_lake_village",
        rect: villageLake,
        material: "물",
        layer: "lower",
        shape: "circle",
      }),
    );

    // 호수 주변 나무 (물 칸은 place_props가 스킵)
    logs.push(placeTreesAroundLake(ctx, "map_lake_village", villageLake, 5, 32, 3));

    // 모서리에 집 4채 (호수와 거리 둠)
    logs.push(stampCornerHouse(ctx, "map_lake_village", 2, 2, "blue-stone"));
    logs.push(stampCornerHouse(ctx, "map_lake_village", 41, 2, "bright-plaster"));
    logs.push(stampCornerHouse(ctx, "map_lake_village", 2, 41, "bright-plaster"));
    logs.push(stampCornerHouse(ctx, "map_lake_village", 41, 41, "blue-stone"));

    // 집 → 호수 가장자리 길
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: "map_lake_village",
        style: "dirt",
        points: [
          { x: 9, y: 8 },
          { x: 18, y: 18 },
        ],
        naturalness: 0.2,
      }),
    );
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: "map_lake_village",
        style: "dirt",
        points: [
          { x: 40, y: 8 },
          { x: 31, y: 18 },
        ],
        naturalness: 0.2,
      }),
    );

    logs.push(
      runOk(ctx, "place_npc", {
        mapId: "map_lake_village",
        x: 10,
        y: 10,
        name: "촌장",
        pages: [{ lines: ["호수는 마을 한가운데 있지.", "나무는 물가 둘레에만 심었네."] }],
      }),
    );
    logs.push(
      runOk(ctx, "place_npc", {
        mapId: "map_lake_village",
        x: 31,
        y: 20,
        name: "어부",
        pages: [{ lines: ["물 위에는 나무를 안 심는다네."] }],
      }),
    );

    // ── 맵 2: 공원 40×40 — 중앙 호수 + 주변 나무 ──
    logs.push(runOk(ctx, "create_map", { id: "map_lakeside_park", name: "호숫가 공원", width: 40, height: 40 }));
    const parkLake = { x: 12, y: 12, w: 16, h: 16 };
    logs.push(
      runOk(ctx, "fill_region", {
        mapId: "map_lakeside_park",
        rect: parkLake,
        material: "물",
        layer: "lower",
        shape: "circle",
      }),
    );
    logs.push(placeTreesAroundLake(ctx, "map_lakeside_park", parkLake, 5, 40, 11));
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: "map_lakeside_park",
        style: "dirt",
        points: [
          { x: 8, y: 8 },
          { x: 31, y: 8 },
          { x: 31, y: 31 },
          { x: 8, y: 31 },
          { x: 8, y: 8 },
        ],
        naturalness: 0.1,
      }),
    );
    logs.push(
      runOk(ctx, "place_npc", {
        mapId: "map_lakeside_park",
        x: 20,
        y: 7,
        name: "산책객",
        pages: [{ lines: ["가운데 호수, 둘레는 나무 숲."] }],
      }),
    );

    const transfer = runTool(ctx, "create_transfer_pair", {
      a: { mapId: "map_lake_village", x: 48, y: 24 },
      b: { mapId: "map_lakeside_park", x: 2, y: 20 },
    });
    logs.push(transfer.ok ? "transfer ok" : `transfer: ${transfer.summary}`);

    const project = p(ctx);
    project.meta.title = "호수 마을";
    project.startMapId = "map_lake_village";
    project.startPos = { x: 12, y: 12 };
    project.mapTree = {
      mapId: "map_lake_village",
      children: [{ mapId: "map_lakeside_park", children: [] }],
    };

    const mapIds = Object.keys(project.maps);
    expect(mapIds.sort()).toEqual(["map_lake_village", "map_lakeside_park"].sort());

    const assertNoTreesOnWater = (mapId: string): { water: number; upperOnWater: number } => {
      const map = project.maps[mapId];
      let water = 0;
      let upperOnWater = 0;
      for (let i = 0; i < map.lowerTiles.length; i += 1) {
        if (!isLakeAutotileTile(map.lowerTiles[i])) continue;
        water += 1;
        if (map.upperTiles[i] !== TILE.EMPTY) upperOnWater += 1;
      }
      expect(upperOnWater, `${mapId} props on water`).toBe(0);
      return { water, upperOnWater };
    };

    const v = assertNoTreesOnWater("map_lake_village");
    const park = assertNoTreesOnWater("map_lakeside_park");
    expect(v.water).toBeGreaterThan(50);
    expect(v.water).toBeLessThan(12 * 12);
    expect(park.water).toBeGreaterThan(80);
    expect(park.water).toBeLessThan(16 * 16);

    // 호수 주변(링)에는 나무가 일부 있어야 함
    const countTreesNearLake = (mapId: string, lake: { x: number; y: number; w: number; h: number }, ring: number): number => {
      const map = project.maps[mapId];
      let n = 0;
      const x0 = lake.x - ring;
      const y0 = lake.y - ring;
      const x1 = lake.x + lake.w + ring;
      const y1 = lake.y + lake.h + ring;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
          const i = y * map.width + x;
          if (isLakeAutotileTile(map.lowerTiles[i])) continue;
          if (map.upperTiles[i] !== TILE.EMPTY) n += 1;
        }
      }
      return n;
    };
    expect(countTreesNearLake("map_lake_village", villageLake, 5)).toBeGreaterThan(5);
    expect(countTreesNearLake("map_lakeside_park", parkLake, 5)).toBeGreaterThan(5);

    const saved = await saveProjectToSupabase(project, config);
    expect(saved.kind).toBe("saved");

    await recordAiActivity({
      channel: "other",
      instruction: "맵 전부 삭제 후 중앙 호수+주변 나무 재배치",
      result: { ok: true, applied: true, changedCells: v.water + park.water },
      toolCalls: logs.map((summary) => ({ name: "compose", args: {}, ok: true, summary })),
      audit: [{ kind: "status", text: logs.join(" | ") }],
    });

    const report = {
      title: project.meta.title,
      maps: mapIds.map((id) => ({
        id,
        name: project.maps[id].name,
        w: project.maps[id].width,
        h: project.maps[id].height,
        events: project.maps[id].events.length,
        water: id === "map_lake_village" ? v.water : park.water,
        treesNearLake: id === "map_lake_village"
          ? countTreesNearLake(id, villageLake, 5)
          : countTreesNearLake(id, parkLake, 5),
      })),
      start: { mapId: project.startMapId, pos: project.startPos },
      noTreesOnWater: true,
      saved,
      logs,
    };
    const outDir = path.join("output", "evidence", "lake-center-rebuild");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }, 180_000);
});
