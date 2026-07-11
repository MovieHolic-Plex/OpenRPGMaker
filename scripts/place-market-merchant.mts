/**
 * 마켓 공터 10×10을 프로젝트에 복원(기존 맵 유지)하고 (4,4)에 상점 NPC 배치.
 * 타일 배치는 직전 실측 스냅샷 기준.
 */
import fs from "node:fs";
import { createBlankMap } from "../src/project/defaults/defaultMaps.ts";
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
  if (result.warnings?.length) console.log("  warnings:", result.warnings.join(" | "));
  return result;
}

// 사용자 페인팅 실측 (10×10)
const LOWER: number[][] = [
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 240, 240, 168, 169, 170, 240],
  [240, 240, 240, 240, 240, 240, 222, 222, 173, 240],
  [240, 240, 240, 240, 240, 240, 222, 222, 173, 240],
  [240, 222, 222, 222, 222, 222, 222, 222, 173, 240],
  [240, 222, 222, 222, 222, 222, 222, 222, 173, 240],
  [240, 222, 193, 222, 222, 222, 222, 222, 173, 240],
  [240, 223, 223, 223, 223, 223, 223, 223, 223, 240],
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
  [240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
];
const UPPER: number[][] = [
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, 268, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1, -1, 144, -1, -1],
  [-1, -1, -1, -1, -1, -1, -1, 204, 237, -1],
  [268, -1, -1, 237, -1, -1, -1, -1, -1, -1],
  [-1, -1, -1, 234, 235, 236, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  [268, -1, -1, -1, -1, -1, -1, -1, 349, -1],
  [-1, 468, 469, 469, 469, 469, 469, 469, 470, -1],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
];

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("project load failed");

const mapId = "map_market_reference";
const tilesetId = project.maps[project.startMapId]?.tilesetId
  ?? Object.keys(project.tilesets)[0]
  ?? "ts_combined_town";

// 기존 마켓 맵이 있으면 덮어쓰고, 없으면 생성
let map = project.maps[mapId];
if (!map) {
  map = createBlankMap("마켓 공터 10x10", 10, 10, tilesetId);
  map.id = mapId;
  project.maps[mapId] = map;
  // mapTree에 형제로 추가 (호수 마을 유지)
  if (project.mapTree && !JSON.stringify(project.mapTree).includes(mapId)) {
    const root = project.mapTree;
    if (root.mapId && Array.isArray(root.children)) {
      root.children.push({ mapId, children: [] });
    } else {
      project.mapTree = {
        mapId: project.startMapId,
        children: [{ mapId, children: [] }],
      };
    }
  }
  console.log("[map] created", mapId, "tileset", tilesetId);
} else {
  map.width = 10;
  map.height = 10;
  map.name = "마켓 공터 10x10";
  console.log("[map] reuse", mapId);
}

map.lowerTiles = LOWER.flat();
map.upperTiles = UPPER.flat().map((t) => (t < 0 ? -1 : t));
map.events = map.events.filter((e) => e.id !== "ev_market_merchant" && e.name !== "장터 상인");

const ctx: { project: Project } = { project };
runOk(ctx, "place_npc", {
  mapId,
  x: 4,
  y: 4,
  name: "장터 상인",
  id: "ev_market_merchant",
  graphic: { query: "상인" },
  movement: "fixed",
  pages: [
    {
      lines: [
        "어서 오세요! 장터에 오신 걸 환영합니다.",
        "여행에 쓸 물약을 팔고 있어요. 필요하면 말해 주세요.",
      ],
      commands: [
        {
          kind: "shop",
          itemIds: [
            "item_potion",
            "item_hi_potion",
            "item_ether",
            "item_antidote",
            "item_wake_herb",
            "item_panacea",
          ],
          allowSell: true,
          quantityMode: "select",
          shopType: "normal",
          messageType: "welcome",
        },
      ],
    },
  ],
});

// runTool은 draft를 ctx.project에 커밋하므로, 이후 작업·저장은 반드시 ctx.project 기준.
const out = ctx.project;
const outMap = out.maps[mapId]!;
out.startMapId = mapId;
out.startPos = { x: 4, y: 6 };
out.meta.title = out.meta?.title?.includes("호수")
  ? "호수 마을 + 마켓 장터 상인"
  : "마켓 장터 상인";

const merchant = outMap.events.find((e) => e.id === "ev_market_merchant");
console.log("[merchant]", merchant?.x, merchant?.y, "cmds", merchant?.pages?.[0]?.commands?.map((c) => c.kind));
console.log("[maps]", Object.keys(out.maps).join(", "), "events", outMap.events.length);

const saved = await saveProjectToSupabase(out, config);
console.log("[saved]", saved);

const verify = await loadProjectFromSupabase(config);
const vMap = verify?.maps[mapId];
const vEv = vMap?.events.find((e) => e.id === "ev_market_merchant");
console.log(
  "[verify] title=",
  verify?.meta?.title,
  "mapCount=",
  Object.keys(verify?.maps ?? {}).length,
  "merchant=",
  vEv ? `(${vEv.x},${vEv.y})` : null,
  "start=",
  verify?.startPos,
  "startMap=",
  verify?.startMapId,
);
console.log("[done] 에디터 새로고침 → 마켓 공터, (4,6)에서 상인 대화");
