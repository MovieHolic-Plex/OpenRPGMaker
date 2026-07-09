import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { ensureBuildPalettePresets, BUILD_PALETTE_PRESETS } from "@/editor/panels/buildPaletteCore";
import { TILE } from "@/project/defaults/constants";
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

function runOk(ctx: { project: Project }, name: string, args: Record<string, unknown>): void {
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    throw new Error(`${name} failed: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
  }
}

/** runTool 은 성공 시 ctx.project 를 draft 로 교체한다 — 항상 ctx.project 를 쓴다. */
function p(ctx: { project: Project }): Project {
  return ctx.project;
}

describe("lake village two maps rebuild", () => {
  it("clears maps and builds a 2-map village with circular lakes", async () => {
    const env = loadEnv();
    vi.stubEnv("VITE_SUPABASE_URL", env.VITE_SUPABASE_URL);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", env.VITE_SUPABASE_ANON_KEY);
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery");

    const config = {
      url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
      anonKey: env.VITE_SUPABASE_ANON_KEY,
      projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
    };

    // 1) 완전 초기화 — 기존 맵/실내맵 전부 폐기
    const blank = createBlankProject();
    blank.meta.title = "호수 마을";
    // blank may already have a starter map — wipe maps/tree and rebuild exactly 2
    blank.maps = {};
    blank.mapTree = { mapId: "", children: [] };
    blank.startMapId = "";

    const ctx = { project: blank };
    // ensure tileset harness for water/trees after first map creation
    const logs: string[] = [];

    // 2) 맵 1: 호수 마을 (50×50) — 서쪽 마을 + 동쪽 원형 호수
    runOk(ctx, "create_map", { id: "map_lake_village", name: "호수 마을", width: 50, height: 50 });
    logs.push("create map_lake_village 50x50");

    const tilesetId = p(ctx).maps.map_lake_village.tilesetId;
    ensureBuildPalettePresets(p(ctx).tilesets[tilesetId]);

    // 마을 본체 (내부 맵 안 만듦 → 맵 2개 유지)
    runOk(ctx, "build_village", {
      mapId: "map_lake_village",
      bounds: { x: 1, y: 1, w: 36, h: 48 },
      houses: 6,
      seed: 42,
      interior: false,
      doorEvent: false,
      npcs: [
        { name: "촌장", lines: ["호수 마을에 온 걸 환영하네.", "동쪽 호수는 우리 자랑거리야."] },
        { name: "어부", lines: ["아침에 호수에서 물고기를 잡지.", "물결이 잔잔한 날이면 최고야."] },
        { name: "상인", lines: ["광장에서 과일을 팔고 있어요.", "호수 쪽 산책로도 추천해요!"] },
      ],
    });
    logs.push("build_village 6 houses, no interiors");

    // 동쪽 원형 호수
    runOk(ctx, "fill_region", {
      mapId: "map_lake_village",
      rect: { x: 37, y: 16, w: 12, h: 12 },
      tileVocabId: BUILD_PALETTE_PRESETS.water,
      layer: "lower",
      shape: "circle",
    });
    logs.push("circle lake on village east");

    // 호수 주변 나무
    runOk(ctx, "place_props", {
      mapId: "map_lake_village",
      area: { x: 36, y: 14, w: 13, h: 16 },
      propVocabId: BUILD_PALETTE_PRESETS.tree,
      count: 10,
      naturalness: 0.55,
      seed: 7,
    });
    logs.push("trees around lake");

    // 마을↔호수 산책 길 (직선 흙길)
    runOk(ctx, "paint_road", {
      mapId: "map_lake_village",
      style: "dirt",
      points: [{ x: 34, y: 22 }, { x: 38, y: 22 }],
      naturalness: 0,
    });
    logs.push("path to lake");

    // 3) 맵 2: 호숫가 공원 — 중앙 원형 호수 + 소공원
    runOk(ctx, "create_map", { id: "map_lakeside_park", name: "호숫가 공원", width: 40, height: 40 });
    logs.push("create map_lakeside_park 40x40");

    runOk(ctx, "fill_region", {
      mapId: "map_lakeside_park",
      rect: { x: 12, y: 12, w: 16, h: 16 },
      tileVocabId: BUILD_PALETTE_PRESETS.water,
      layer: "lower",
      shape: "circle",
    });
    logs.push("circle lake park center");

    // 호수 둘레 길 (대략 링)
    runOk(ctx, "paint_road", {
      mapId: "map_lakeside_park",
      style: "dirt",
      points: [
        { x: 10, y: 10 },
        { x: 29, y: 10 },
        { x: 29, y: 29 },
        { x: 10, y: 29 },
        { x: 10, y: 10 },
      ],
      naturalness: 0.2,
    });
    logs.push("park ring path");

    runOk(ctx, "place_props", {
      mapId: "map_lakeside_park",
      area: { x: 4, y: 4, w: 32, h: 32 },
      propVocabId: BUILD_PALETTE_PRESETS.tree,
      count: 18,
      naturalness: 0.6,
      seed: 11,
    });
    logs.push("park trees");

    runOk(ctx, "place_npc", {
      mapId: "map_lakeside_park",
      x: 20,
      y: 9,
      name: "산책객",
      graphic: { query: "villager" },
      pages: [{ lines: ["호숫가 바람이 시원하네.", "마을은 서쪽으로 가면 돼."] }],
    });

    runOk(ctx, "place_npc", {
      mapId: "map_lakeside_park",
      x: 11,
      y: 20,
      name: "화가",
      graphic: { query: "villager" },
      pages: [{ lines: ["이 호수를 그림으로 남기고 있어."] }],
    });
    logs.push("park NPCs");

    // 맵 연결: create_transfer_pair if available, else simple transfer NPCs
    const transfer = runTool(ctx, "create_transfer_pair", {
      a: { mapId: "map_lake_village", x: 48, y: 22 },
      b: { mapId: "map_lakeside_park", x: 2, y: 20 },
    });
    if (!transfer.ok) {
      runOk(ctx, "place_npc", {
        mapId: "map_lake_village",
        x: 48,
        y: 22,
        name: "공원 안내",
        pages: [{ lines: ["호숫가 공원 쪽이야."] }],
      });
      runOk(ctx, "place_npc", {
        mapId: "map_lakeside_park",
        x: 1,
        y: 20,
        name: "마을 안내",
        pages: [{ lines: ["호수 마을로 돌아가는 길이야."] }],
      });
      logs.push("transfer pair failed, placed guides: " + transfer.summary);
    } else {
      logs.push("create_transfer_pair ok");
    }

    // 시작점
    const project = p(ctx);
    project.meta.title = "호수 마을";
    project.startMapId = "map_lake_village";
    project.startPos = { x: 18, y: 24 };
    project.mapTree = {
      mapId: "map_lake_village",
      children: [{ mapId: "map_lakeside_park", children: [] }],
    };

    // 맵은 정확히 2개
    const mapIds = Object.keys(project.maps);
    expect(mapIds.sort()).toEqual(["map_lake_village", "map_lakeside_park"].sort());

    const waterId = BUILD_PALETTE_PRESETS.water;
    const countLakeish = (mapId: string): number => {
      const map = project.maps[mapId];
      const group = project.tilesets[map.tilesetId].tileGroups?.find((g) => g.id === waterId);
      const ids = new Set(group?.tileIds ?? [TILE.WATER]);
      let n = 0;
      for (const t of map.lowerTiles) if (ids.has(t)) n += 1;
      return n;
    };
    const villageWater = countLakeish("map_lake_village");
    const parkWater = countLakeish("map_lakeside_park");
    expect(villageWater).toBeGreaterThan(50);
    expect(villageWater).toBeLessThan(12 * 12); // not full rect
    expect(parkWater).toBeGreaterThan(80);
    expect(parkWater).toBeLessThan(16 * 16);

    const saved = await saveProjectToSupabase(project, config);
    expect(saved.kind).toBe("saved");

    await recordAiActivity({
      channel: "other",
      instruction: "맵 전부 삭제 후 맵 2개로 호수 마을 꾸미기",
      result: { ok: true, applied: true, changedCells: villageWater + parkWater },
      toolCalls: logs.map((summary) => ({ name: "compose", args: {}, ok: true, summary })),
      audit: [{ kind: "status", text: logs.join(" | ") }],
    });

    const outDir = path.join("output", "evidence", "lake-village-two-maps");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "report.json"),
      JSON.stringify(
        {
          title: project.meta.title,
          maps: mapIds.map((id) => ({
            id,
            name: project.maps[id].name,
            w: project.maps[id].width,
            h: project.maps[id].height,
            events: project.maps[id].events.length,
            water: countLakeish(id),
          })),
          start: { mapId: project.startMapId, pos: project.startPos },
          logs,
          saved,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ maps: mapIds, villageWater, parkWater, events: {
      village: project.maps.map_lake_village.events.length,
      park: project.maps.map_lakeside_park.events.length,
    }, saved }, null, 2));
  }, 180_000);
});
