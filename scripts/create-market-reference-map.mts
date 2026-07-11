/**
 * 현재 market 광장 레시피 예시 맵을 만들고 저장한다.
 * 사용자가 이 맵에서 원하는 장터 배치로 고치면, 그 결과를 기준으로 레시피를 맞춘다.
 *
 * 설계: 중앙은 잔디(소품 가능) + 둘레·십자 모래길. 코드 레시피(벤치/책상/꽃)를 그대로 깐다.
 */
import fs from "node:fs";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function runOk(ctx: { project: Project }, name: string, args: Record<string, unknown>) {
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    throw new Error(`${name} failed: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
  }
  console.log(`[ok] ${name}: ${result.summary}`);
  return result;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

try {
  const before = await loadProjectFromSupabase(config);
  console.log("[before] maps:", before ? Object.keys(before.maps) : null);
} catch (err) {
  console.warn("[before] load skip:", err);
}

const ctx: { project: Project } = { project: createEmptyToolProject("마켓 예시") };
ctx.project.meta.title = "마켓 예시 — 여기서 수정";

const mapId = "map_market_reference";
runOk(ctx, "create_map", {
  id: mapId,
  name: "마켓 예시 (수정용)",
  width: 40,
  height: 40,
  border: "none",
});

// 둘레 모래길 (광장 프레임) — 안쪽 잔디는 장터 소품용으로 비움
runOk(ctx, "paint_road", {
  mapId,
  style: "sand",
  points: [
    { x: 12, y: 14 },
    { x: 27, y: 14 },
  ],
  width: 2,
});
runOk(ctx, "paint_road", {
  mapId,
  style: "sand",
  points: [
    { x: 12, y: 25 },
    { x: 27, y: 25 },
  ],
  width: 2,
});
runOk(ctx, "paint_road", {
  mapId,
  style: "sand",
  points: [
    { x: 12, y: 14 },
    { x: 12, y: 25 },
  ],
  width: 2,
});
runOk(ctx, "paint_road", {
  mapId,
  style: "sand",
  points: [
    { x: 27, y: 14 },
    { x: 27, y: 25 },
  ],
  width: 2,
});
// 접근로
runOk(ctx, "paint_road", {
  mapId,
  style: "sand",
  points: [
    { x: 20, y: 6 },
    { x: 20, y: 14 },
  ],
  width: 2,
});
runOk(ctx, "paint_road", {
  mapId,
  style: "sand",
  points: [
    { x: 20, y: 25 },
    { x: 20, y: 34 },
  ],
  width: 2,
});
runOk(ctx, "paint_road", {
  mapId,
  style: "sand",
  points: [
    { x: 6, y: 19 },
    { x: 12, y: 19 },
  ],
  width: 2,
});
runOk(ctx, "paint_road", {
  mapId,
  style: "sand",
  points: [
    { x: 27, y: 19 },
    { x: 34, y: 19 },
  ],
  width: 2,
});

// 사방 집 (h≥5)
for (const house of [
  { kitId: "bright-plaster" as const, wings: [{ x: 5, y: 5, w: 6, h: 6 }] },
  { kitId: "blue-stone" as const, wings: [{ x: 29, y: 5, w: 6, h: 6 }] },
  { kitId: "bright-plaster" as const, wings: [{ x: 5, y: 28, w: 6, h: 6 }] },
  { kitId: "blue-stone" as const, wings: [{ x: 29, y: 28, w: 6, h: 6 }] },
]) {
  runOk(ctx, "build_house_kit", {
    mapId,
    kitId: house.kitId,
    wings: house.wings,
    doorEvent: false,
    interior: false,
  });
}

// 현재 market 레시피 (광장 잔디 안쪽)
const plaza = { x: 14, y: 16, w: 12, h: 8 };
runOk(ctx, "place_props", {
  mapId,
  area: plaza,
  material: "벤치",
  count: 2,
  minGap: 2,
  naturalness: 0.35,
  seed: 1,
});
runOk(ctx, "place_props", {
  mapId,
  area: plaza,
  material: "꽃",
  count: 3,
  minGap: 1,
  naturalness: 0.45,
  seed: 2,
});
runOk(ctx, "place_props", {
  mapId,
  area: plaza,
  material: "가로 탁자",
  count: 1,
  minGap: 2,
  naturalness: 0.35,
  seed: 3,
});
// 장터 분위기 힌트 (과일박스 등)
runOk(ctx, "place_props", {
  mapId,
  area: { x: 15, y: 17, w: 5, h: 4 },
  material: "과일박스",
  count: 2,
  minGap: 1,
  naturalness: 0.25,
  seed: 4,
});
runOk(ctx, "place_props", {
  mapId,
  area: { x: 21, y: 20, w: 4, h: 3 },
  material: "나무 상자",
  count: 2,
  minGap: 1,
  naturalness: 0.25,
  seed: 5,
});

runOk(ctx, "place_npc", {
  mapId,
  x: 18,
  y: 19,
  name: "장터 안내",
  graphic: { query: "상인" },
  pages: [
    {
      lines: [
        "여기는 현재 코드의 「market 광장」 예시입니다.",
        "벤치·책상·꽃·과일박스 배치를 원하는 장터 모양으로 고쳐 주세요.",
        "고치신 맵을 기준으로 market 레시피를 맞추겠습니다.",
      ],
    },
  ],
});

ctx.project.startMapId = mapId;
ctx.project.startPos = { x: 20, y: 12 };
ctx.project.mapTree = { mapId, children: [] };

const saved = await saveProjectToSupabase(ctx.project, config);
console.log("[saved]", saved);

const verify = await loadProjectFromSupabase(config);
console.log("[verify] maps", verify ? Object.keys(verify.maps) : null);
console.log("[verify] title", verify?.meta?.title);
console.log("[verify] start", verify?.startMapId, verify?.startPos);
console.log("[done] 에디터 새로고침 → 「마켓 예시 (수정용)」에서 장터를 원하는 형태로 고쳐 주세요.");
