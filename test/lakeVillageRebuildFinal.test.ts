import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { BUILD_PALETTE_GROUP_IDS, ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { TILE } from "@/project/defaults/constants";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { isSandTile } from "@/project/defaults/sandAutotile";
import { saveProjectToSupabase } from "@/project/supabaseProjectSync";
import { recordAiActivity } from "@/ai/activityLog";
import {
  layoutValidationBlocking,
  validateLayoutPlacement,
} from "@/project/lint/layoutPlacementValidate";
import type { Project } from "@/project/types";

/**
 * 에디터 노출 툴만으로 “중앙 호수 + 모래길 마을” 구성.
 * 공정: 맵 → 호수 → 모래길 → 집 → 나무/소품 → NPC → 저장
 * (paint_road 가 upper 를 비우므로 나무는 길·집 뒤)
 */
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
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

const TREE_IDS = new Set([260, 290, 261, 291, 262, 263, 292, 293]);
const MAP_ID = "map_lake_village";

describe("natural lake village (editor tools only)", () => {
  it("builds a lake-centered village with sand paths via editor tools only", async () => {
    const env = loadEnv();
    vi.stubEnv("VITE_SUPABASE_URL", env.VITE_SUPABASE_URL);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", env.VITE_SUPABASE_ANON_KEY);
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery");

    const config = {
      url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
      anonKey: env.VITE_SUPABASE_ANON_KEY,
      projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
    };

    // ── 0. 완전 새 blank 프로젝트 (원격 기존 맵/내부맵 무시, 최종 save 가 통째 교체) ──
    const blank = createBlankProject();
    blank.meta.title = "호수 마을";
    blank.maps = {};
    blank.mapTree = { mapId: "", children: [] };
    blank.startMapId = "";
    const ctx = { project: blank };
    const logs: string[] = ["full project rebuild from empty maps{}"];

    // ── 1. 맵 (빈 프로젝트에서 신규 생성) ──
    logs.push(runOk(ctx, "create_map", { id: MAP_ID, name: "호수 마을", width: 52, height: 52 }));
    ensureBuildPaletteTileGroups(p(ctx).tilesets[p(ctx).maps[MAP_ID].tilesetId]);

    // ── 2. 중앙 원형 호수 ──
    const lake = { x: 18, y: 18, w: 16, h: 16 };
    logs.push(
      runOk(ctx, "fill_region", {
        mapId: MAP_ID,
        rect: lake,
        material: "물",
        layer: "lower",
        shape: "circle",
      }),
    );

    // ── 3. 모래 산책로: 호수 링 + 방사 길 + 작은 광장 ──
    // 호수 바로 바깥 링 (자연스러운 약간의 흔들림)
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: MAP_ID,
        style: "sand",
        points: [
          { x: 16, y: 16 },
          { x: 35, y: 16 },
          { x: 35, y: 35 },
          { x: 16, y: 35 },
          { x: 16, y: 16 },
        ],
        naturalness: 0.22,
        seed: 101,
      }),
    );
    // 남쪽 진입로 (시작 위치 ↔ 링)
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: MAP_ID,
        style: "sand",
        points: [
          { x: 26, y: 48 },
          { x: 26, y: 35 },
        ],
        naturalness: 0.18,
        seed: 102,
      }),
    );
    // 북쪽 집 연결
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: MAP_ID,
        style: "sand",
        points: [
          { x: 24, y: 11 },
          { x: 24, y: 16 },
        ],
        naturalness: 0.12,
        seed: 103,
      }),
    );
    // 동·서 가로 연결
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: MAP_ID,
        style: "sand",
        points: [
          { x: 8, y: 26 },
          { x: 16, y: 26 },
        ],
        naturalness: 0.15,
        seed: 104,
      }),
    );
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: MAP_ID,
        style: "sand",
        points: [
          { x: 35, y: 26 },
          { x: 44, y: 26 },
        ],
        naturalness: 0.15,
        seed: 105,
      }),
    );
    // 남서·남동 주거지 가지
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: MAP_ID,
        style: "sand",
        points: [
          { x: 10, y: 40 },
          { x: 16, y: 35 },
        ],
        naturalness: 0.2,
        seed: 106,
      }),
    );
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: MAP_ID,
        style: "sand",
        points: [
          { x: 40, y: 40 },
          { x: 35, y: 35 },
        ],
        naturalness: 0.2,
        seed: 107,
      }),
    );
    // 북동 가지
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: MAP_ID,
        style: "sand",
        points: [
          { x: 40, y: 10 },
          { x: 35, y: 16 },
        ],
        naturalness: 0.18,
        seed: 108,
      }),
    );
    // 북서 가지
    logs.push(
      runOk(ctx, "paint_road", {
        mapId: MAP_ID,
        style: "sand",
        points: [
          { x: 10, y: 10 },
          { x: 16, y: 16 },
        ],
        naturalness: 0.18,
        seed: 109,
      }),
    );

    // ── 4. 호수 주변 집 (문 남향 → 문 앞이 모래/잔디로 트이게) ──
    type HouseSpec = {
      kitId: "blue-stone" | "bright-plaster";
      wings: readonly { x: number; y: number; w: number; h: number }[];
      ownerName: string;
      interior?: boolean;
    };
    const houses: readonly HouseSpec[] = [
      // 북쪽 — 촌장 큰 집
      {
        kitId: "blue-stone",
        wings: [{ x: 20, y: 3, w: 10, h: 7 }],
        ownerName: "촌장",
        interior: true,
      },
      // 북동 — ㄱ자
      {
        kitId: "bright-plaster",
        wings: [
          { x: 36, y: 3, w: 9, h: 6 },
          { x: 40, y: 6, w: 5, h: 7 },
        ],
        ownerName: "어부",
      },
      // 동 — 작은 집
      {
        kitId: "blue-stone",
        wings: [{ x: 40, y: 18, w: 7, h: 6 }],
        ownerName: "상인",
      },
      // 남동
      {
        kitId: "bright-plaster",
        wings: [{ x: 38, y: 38, w: 8, h: 6 }],
        ownerName: "목수",
      },
      // 남 — 광장 쪽 작은 집 2채
      {
        kitId: "blue-stone",
        wings: [{ x: 14, y: 38, w: 7, h: 6 }],
        ownerName: "농부",
      },
      {
        kitId: "bright-plaster",
        wings: [{ x: 28, y: 39, w: 6, h: 6 }],
        ownerName: "아이엄마",
      },
      // 서
      {
        kitId: "bright-plaster",
        wings: [{ x: 3, y: 18, w: 7, h: 7 }],
        ownerName: "약초꾼",
      },
      // 북서 — ㄷ자 느낌 (두 날개)
      {
        kitId: "blue-stone",
        wings: [
          { x: 3, y: 3, w: 8, h: 6 },
          { x: 3, y: 6, w: 4, h: 6 },
        ],
        ownerName: "수호",
      },
    ];

    for (const house of houses) {
      logs.push(
        runOk(ctx, "author_house", {
          kind: "single",
          mapId: MAP_ID,
          kitId: house.kitId,
          wings: house.wings,
          door: true,
          interior: house.interior === true ? "linked-interior" : "exterior-only",
          ownerName: house.ownerName,
          yard: [],
        }),
      );
    }

    // ── 5. 나무·소품 (물·모래·집 upper 점유 칸은 툴이 스킵) ──
    // material 라벨 계약(그룹 id 금지): 가로/세로 벤치, 마당, 묘지, 탁자·과일박스 등
    const CONIFER = "침엽수";
    const BROADLEAF = "활엽수";
    const BENCH_H = "벤치";
    const BENCH_V = "세로 의자";
    const FLOWERS = "꽃";
    const YARD = "장작 더미";
    const CEMETERY = "묘비";
    const TABLE_H = "가로 탁자";
    const FRUIT = "과일박스";
    const WOOD_BOX = "나무 상자";
    const MAGIC = "마법진";
    const FREE_CHAIR = "의자";

    // 숲: minGap 0 + 좁은 영역에 많이 넣어 캐노피가 맞닿게.
    // (넓은 띠에 소수만 뿌리면 띄엄띄엄 보여 "숲 아님")
    // 북서·북동·남서·남동 네 덩어리
    for (const [area, coniferCount, broadCount, seed] of [
      [{ x: 1, y: 1, w: 14, h: 12 }, 28, 10, 301],
      [{ x: 37, y: 1, w: 14, h: 12 }, 26, 10, 302],
      [{ x: 1, y: 38, w: 12, h: 12 }, 22, 8, 303],
      [{ x: 38, y: 38, w: 12, h: 12 }, 22, 8, 304],
    ] as const) {
      logs.push(
        runOk(ctx, "place_props", {
          mapId: MAP_ID,
          area,
          material: CONIFER,
          count: coniferCount,
          naturalness: 0.9,
          minGap: 0,
          seed,
        }),
      );
      logs.push(
        runOk(ctx, "place_props", {
          mapId: MAP_ID,
          area,
          material: BROADLEAF,
          count: broadCount,
          naturalness: 0.88,
          minGap: 0,
          seed: seed + 10,
        }),
      );
    }
    // 물가 쪽은 조금 성기게
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 14, y: 14, w: 24, h: 24 },
        material: CONIFER,
        count: 14,
        naturalness: 0.65,
        minGap: 0,
        seed: 201,
      }),
    );

    // 집 앞 마당: 장작·우편함·화분·항아리 (문 쪽 남측 잔디)
    for (const [area, count, seed] of [
      [{ x: 20, y: 10, w: 10, h: 3 }, 3, 401], // 촌장 집 앞
      [{ x: 36, y: 10, w: 8, h: 3 }, 2, 402], // 어부
      [{ x: 40, y: 24, w: 7, h: 3 }, 2, 403], // 상인
      [{ x: 38, y: 44, w: 8, h: 3 }, 2, 404], // 목수
      [{ x: 14, y: 44, w: 7, h: 3 }, 2, 405], // 농부
      [{ x: 28, y: 45, w: 6, h: 3 }, 2, 406], // 아이엄마
      [{ x: 3, y: 25, w: 7, h: 3 }, 2, 407], // 약초꾼
      [{ x: 3, y: 12, w: 8, h: 3 }, 2, 408], // 수호
    ] as const) {
      logs.push(
        runOk(ctx, "place_props", {
          mapId: MAP_ID,
          area,
          material: YARD,
          count,
          naturalness: 0.4,
          minGap: 1,
          seed,
        }),
      );
    }

    // 남쪽 광장: 가로 벤치 + 세로 의자 + 탁자 + 꽃 + 과일박스
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 20, y: 36, w: 12, h: 6 },
        material: BENCH_H,
        count: 3,
        naturalness: 0.35,
        minGap: 2,
        seed: 220,
      }),
    );
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 22, y: 36, w: 8, h: 6 },
        material: BENCH_V,
        count: 2,
        naturalness: 0.3,
        minGap: 2,
        seed: 221,
      }),
    );
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 24, y: 36, w: 6, h: 4 },
        material: TABLE_H,
        count: 1,
        naturalness: 0.2,
        minGap: 1,
        seed: 222,
      }),
    );
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 24, y: 36, w: 6, h: 4 },
        material: FREE_CHAIR,
        count: 2,
        naturalness: 0.3,
        minGap: 1,
        seed: 223,
      }),
    );
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 18, y: 36, w: 16, h: 8 },
        material: FLOWERS,
        count: 8,
        naturalness: 0.55,
        minGap: 1,
        seed: 224,
      }),
    );
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 30, y: 36, w: 6, h: 4 },
        material: FRUIT,
        count: 1,
        naturalness: 0.25,
        minGap: 1,
        seed: 225,
      }),
    );
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 18, y: 37, w: 4, h: 4 },
        material: WOOD_BOX,
        count: 2,
        naturalness: 0.3,
        minGap: 1,
        seed: 226,
      }),
    );

    // 묘지: 집과 멀리 — 남서 맵 가장자리 (집 날개와 분리)
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 1, y: 46, w: 10, h: 5 },
        material: CEMETERY,
        count: 5,
        naturalness: 0.45,
        minGap: 1,
        seed: 230,
      }),
    );
    // 호수 서쪽 숲 가장자리 마법진 1
    logs.push(
      runOk(ctx, "place_props", {
        mapId: MAP_ID,
        area: { x: 12, y: 20, w: 4, h: 4 },
        material: MAGIC,
        count: 1,
        naturalness: 0.2,
        minGap: 0,
        seed: 231,
      }),
    );

    // ── 6. 주민 ──
    const villagers: readonly {
      name: string;
      x: number;
      y: number;
      graphic: { query: string };
      lines: string[];
      movement?: "fixed" | "random";
    }[] = [
      {
        name: "촌장",
        x: 24,
        y: 12,
        graphic: { query: "old man" },
        lines: ["이 마을은 호수를 중심에 두고 자랐지. 모래길을 따라 한 바퀴 돌아보게."],
      },
      {
        name: "어부",
        x: 36,
        y: 14,
        graphic: { query: "villager" },
        lines: ["아침엔 호수 쪽에서 안개가 피어올라. 물고기는 서쪽이 잘 잡혀."],
        movement: "random",
      },
      {
        name: "상인",
        x: 38,
        y: 26,
        graphic: { query: "people" },
        lines: ["동쪽 길 끝에 내 가게 자리가 있지. 여행자님, 뭔가 필요하면 말하게."],
      },
      {
        name: "아이",
        x: 26,
        y: 37,
        graphic: { query: "people" },
        lines: ["모래길이 미끄러워! 호수엔 들어가지 마, 엄마가 혼내."],
        movement: "random",
      },
      {
        name: "약초꾼",
        x: 12,
        y: 24,
        graphic: { query: "old woman" },
        lines: ["숲 가장자리에 약초가 나. 나무는 물 위엔 심지 말라고 당부해 뒀어."],
      },
    ];

    for (const npc of villagers) {
      logs.push(
        runOk(ctx, "place_npc", {
          mapId: MAP_ID,
          x: npc.x,
          y: npc.y,
          name: npc.name,
          graphic: npc.graphic,
          movement: npc.movement ?? "fixed",
          pages: [{ lines: npc.lines }],
        }),
      );
    }

    // ── 프로젝트 메타 ──
    const project = p(ctx);
    project.meta.title = "호수 마을";
    project.startMapId = MAP_ID;
    project.startPos = { x: 26, y: 46 };
    // mapTree: 마을 + 자동 생성된 내부 맵
    const interiorIds = Object.keys(project.maps).filter((id) => id !== MAP_ID);
    project.mapTree = {
      mapId: MAP_ID,
      children: interiorIds.map((mapId) => ({ mapId, children: [] })),
    };

    const layoutIssues = validateLayoutPlacement(project, {
      mapId: MAP_ID,
      instruction: "호수 중앙 원형, 주변에 나무, 모래길 마을",
      toolNames: ["fill_region", "place_props", "paint_road", "build_house_kit", "place_npc"],
    });
    expect(layoutValidationBlocking(layoutIssues), JSON.stringify(layoutIssues)).toEqual([]);

    const map = project.maps[MAP_ID];
    let water = 0;
    let trees = 0;
    let sand = 0;
    let treesOnWater = 0;
    let treesOnSand = 0;
    let conifer = 0;
    let broadleaf = 0;
    let benchHTiles = 0;
    let benchVPairs = 0;
    let yardTiles = 0;
    let cemeteryTiles = 0;
    let tableTiles = 0;
    let fruitTiles = 0;
    let magicTiles = 0;
    let verticalBrokenBench = 0;
    let forestStackCells = 0;
    const YARD_IDS = new Set([349, 350, 351, 352]);
    const CEMETERY_IDS = new Set([323, 353, 383]);
    for (let i = 0; i < map.lowerTiles.length; i += 1) {
      const lower = map.lowerTiles[i];
      const upper = map.upperTiles[i];
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      if (isLakeAutotileTile(lower)) {
        water += 1;
        if (upper !== TILE.EMPTY && upper >= 0) treesOnWater += 1;
      }
      if (TREE_IDS.has(upper) || TREE_IDS.has(lower)) trees += 1;
      if (upper === 260 || lower === 290) conifer += 1;
      if (upper === 262 || upper === 263 || lower === 292 || lower === 293) broadleaf += 1;
      if (upper === 327 || upper === 328) benchHTiles += 1;
      if (upper === 358 && y + 1 < map.height && map.upperTiles[(y + 1) * map.width + x] === 388) {
        benchVPairs += 1;
      }
      if (YARD_IDS.has(upper)) yardTiles += 1;
      if (CEMETERY_IDS.has(upper)) cemeteryTiles += 1;
      if (upper === 234 || upper === 235 || upper === 236) tableTiles += 1;
      if (upper === 202 || upper === 203) fruitTiles += 1;
      if (upper === 231) magicTiles += 1;
      // 숲 겹침: 같은 칸에 lower 밑동 + upper 수관
      if ((lower === 290 || lower === 291 || lower === 292 || lower === 293)
        && (upper === 260 || upper === 261 || upper === 262 || upper === 263)) {
        forestStackCells += 1;
      }
      // 가로 벤치 좌/우 반쪽이 위아래로 붙으면 안 됨
      if (y + 1 < map.height && upper === 327 && map.upperTiles[(y + 1) * map.width + x] === 328) {
        verticalBrokenBench += 1;
      }
      if (isSandTile(lower)) {
        sand += 1;
        if (TREE_IDS.has(upper)) treesOnSand += 1;
      }
    }

    const houseCount = houses.length;
    const npcCount = villagers.length;
    const eventCount = map.events.length;

    expect(treesOnWater).toBe(0);
    expect(treesOnSand).toBe(0);
    expect(verticalBrokenBench, "bench halves must not stack vertically").toBe(0);
    expect(broadleaf, "2x2 broadleaf trees should be present").toBeGreaterThan(0);
    expect(conifer).toBeGreaterThan(0);
    expect(benchHTiles, "horizontal bench 327|328").toBeGreaterThan(0);
    expect(benchVPairs, "vertical chair 358|388 pairs").toBeGreaterThan(0);
    expect(yardTiles, "house-yard props 349-352").toBeGreaterThan(0);
    expect(cemeteryTiles, "cemetery props far from houses").toBeGreaterThan(0);
    expect(tableTiles, "horizontal table").toBeGreaterThan(0);
    // 숲: 밑동 간 최근접이 1칸(인접) 이하여야 빽빽한 캐노피
    const bottoms: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const l = map.lowerTiles[y * map.width + x];
        if (l === 290 || l === 292 || l === 293) bottoms.push({ x, y });
      }
    }
    let minCheb = 99;
    for (let i = 0; i < bottoms.length; i += 1) {
      for (let j = i + 1; j < bottoms.length; j += 1) {
        const d = Math.max(Math.abs(bottoms[i].x - bottoms[j].x), Math.abs(bottoms[i].y - bottoms[j].y));
        if (d < minCheb) minCheb = d;
      }
    }
    expect(minCheb, "forest trunks should touch or nearly touch (minGap 0)").toBeLessThanOrEqual(1);
    expect(forestStackCells, "canopy upper over trunk lower on same cell").toBeGreaterThan(0);
    expect(water).toBeGreaterThan(80);
    expect(water).toBeLessThan(220);
    expect(trees).toBeGreaterThan(40);
    expect(sand).toBeGreaterThan(80);
    expect(eventCount).toBeGreaterThanOrEqual(npcCount);

    const saved = await saveProjectToSupabase(project, config);
    expect(saved.kind).toBe("saved");

    await recordAiActivity({
      channel: "other",
      instruction: "에디터 툴만으로 중앙 호수 자연 마을(모래길+비전 소품 하네스) 재구성",
      result: { ok: true, applied: true, changedCells: water + sand + trees + yardTiles + cemeteryTiles },
      toolCalls: logs.map((summary) => ({ name: "compose", args: {}, ok: true, summary })),
      audit: [{ kind: "status", text: logs.join(" | ") }],
    });

    const report = {
      title: project.meta.title,
      approach: "editor-tools-only + vision harness props",
      tools: [
        "create_map",
        "fill_region(shape=circle)",
        "paint_road(style=sand)",
        "build_house_kit",
        "place_props(tree/bench/yard/cemetery/table)",
        "place_npc",
      ],
      roadStyle: "sand",
      map: {
        id: MAP_ID,
        size: "52x52",
        water,
        trees,
        conifer,
        broadleaf,
        forestStackCells,
        benchHTiles,
        benchVPairs,
        yardTiles,
        cemeteryTiles,
        tableTiles,
        fruitTiles,
        magicTiles,
        sand,
        treesOnWater,
        treesOnSand,
        verticalBrokenBench,
        houses: houseCount,
        npcs: npcCount,
        events: eventCount,
        interiors: interiorIds.length,
      },
      start: { mapId: project.startMapId, pos: project.startPos },
      layoutIssues,
      saved,
      logs,
    };
    const outDir = path.join("output", "evidence", "lake-rebuild-final");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }, 180_000);
});
