/**
 * 하네스(wood-floor-deck / table / wood-box / timber-post-rail)로 장터 부스 맵을 만들고
 * mapTree 고아를 수리한 뒤 Supabase에 저장한다.
 */
import fs from "node:fs";
import { repairMapTreeOrphans, collectMapIdsInTree } from "../src/project/mapTree.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { ensureTilesetHarnesses } from "../src/project/tilesetHarness.ts";
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

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

const loaded = await loadProjectFromSupabase(config);
if (!loaded) throw new Error("project load failed");

const ctx: { project: Project } = { project: loaded };
ensureTilesetHarnesses(ctx.project);

// 트리 진단 (수리 전)
console.log("[before] maps", Object.keys(ctx.project.maps));
console.log("[before] mapTree", JSON.stringify(ctx.project.mapTree));
console.log("[before] inTree", [...collectMapIdsInTree(ctx.project.mapTree)]);

const mapId = "map_market_stall_harness";
// 재실행 시 기존 동명 맵 제거 후 create_map
if (ctx.project.maps[mapId]) {
  // delete_map tool이 있으면 사용, 없으면 수동
  try {
    runOk(ctx, "delete_map", { mapId });
  } catch {
    delete ctx.project.maps[mapId];
    console.log("[map] manual remove", mapId);
  }
}

runOk(ctx, "create_map", {
  id: mapId,
  name: "장터 부스 (하네스)",
  width: 16,
  height: 12,
  border: "none",
});

// 1) 나무 바닥 데크 — harness wood-floor-deck 대표 바디 222
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "lower",
  mode: "rect",
  tile: 222,
  from: { x: 2, y: 3 },
  to: { x: 13, y: 8 },
});

// 2) 목조 난간 — timber-post-rail 바디 223 (하단 가로)
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "lower",
  mode: "rect",
  tile: 223,
  from: { x: 2, y: 9 },
  to: { x: 13, y: 9 },
});
// 좌우 기둥 193
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "lower",
  mode: "cells",
  tile: 193,
  cells: [
    { x: 2, y: 8 },
    { x: 13, y: 8 },
  ],
});

// 3) 가로 탁자 카운터 — table-horizontal 234|235|236 (상위 자동 라우팅)
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 234,
  cells: [{ x: 5, y: 5 }],
});
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 235,
  cells: [
    { x: 6, y: 5 },
    { x: 7, y: 5 },
    { x: 8, y: 5 },
  ],
});
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 236,
  cells: [{ x: 9, y: 5 }],
});

// 4) 세로 탁자 사이드 부스
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 144,
  cells: [{ x: 11, y: 4 }],
});
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 174,
  cells: [{ x: 11, y: 5 }],
});
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 204,
  cells: [{ x: 11, y: 6 }],
});

// 5) 나무 상자 — wood-box 하네스 타일 237 (place_props는 미승인 시 soft-skip 될 수 있어 paint로 확정)
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 237,
  cells: [
    { x: 4, y: 4 },
    { x: 12, y: 4 },
  ],
});

// 6) 장작 — house-yard 349 (레일 위가 아니라 데크 안쪽)
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 349,
  cells: [{ x: 12, y: 7 }],
});

// 6b) 장터 레일(상위) market-rail-upper: 468|469*|470 — 마켓 공터 y=8 금본
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 468,
  cells: [{ x: 2, y: 10 }],
});
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "rect",
  tile: 469,
  from: { x: 3, y: 10 },
  to: { x: 12, y: 10 },
});
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 470,
  cells: [{ x: 13, y: 10 }],
});

// 6c) 돌단/석판 stone-step-slab 268 — 마켓 공터 (0,4) 금본
runOk(ctx, "paint_tiles", {
  mapId,
  layer: "upper",
  mode: "cells",
  tile: 268,
  cells: [
    { x: 1, y: 5 },
    { x: 1, y: 8 },
    { x: 14, y: 5 },
  ],
});

// 7) 상인 — 카운터 북측 (7,4)
runOk(ctx, "place_npc", {
  mapId,
  x: 7,
  y: 4,
  name: "장터 상인",
  id: "ev_stall_merchant",
  graphic: { query: "상인" },
  movement: "fixed",
  pages: [
    {
      lines: [
        "어서 오세요! 하네스 장터 부스입니다.",
        "물약이 필요하시면 말씀하세요.",
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

const out = ctx.project;
const treeFixed = repairMapTreeOrphans(out);
console.log("[repairMapTreeOrphans]", treeFixed);
console.log("[after] mapTree", JSON.stringify(out.mapTree));
console.log("[after] inTree", [...collectMapIdsInTree(out.mapTree)]);
console.log("[after] maps", Object.keys(out.maps).length, Object.keys(out.maps));

// 하네스 그룹 존재 확인 (맵 타일셋 기준)
const tsId = out.maps[mapId]?.tilesetId ?? "";
const ts = out.tilesets[tsId];
const deck = ts?.tileGroups?.find((g) => g.id.endsWith("wood-floor-deck"));
const rail = ts?.tileGroups?.find((g) => g.id.endsWith("timber-post-rail"));
console.log("[harness] tileset", tsId, "groups", ts?.tileGroups?.length);
console.log("[harness] wood-floor-deck", deck?.name, deck?.tileIds?.length);
console.log("[harness] timber-post-rail", rail?.name, rail?.tileIds?.length);
// 저장 직전 한 번 더 시드 (신규 그룹 영속)
ensureTilesetHarnesses(out);

out.startMapId = mapId;
out.startPos = { x: 7, y: 7 };
out.meta.title = "장터 부스 하네스 데모";

const map = out.maps[mapId]!;
console.log("[map] events", map.events.map((e) => `${e.id}@${e.x},${e.y}`));
console.log("[map] sample L(7,4)=", map.lowerTiles[4 * map.width + 7], "U(7,5)=", map.upperTiles[5 * map.width + 7]);

const saved = await saveProjectToSupabase(out, config);
console.log("[saved]", saved);

const verify = await loadProjectFromSupabase(config);
const vTree = verify ? collectMapIdsInTree(verify.mapTree) : new Set();
console.log(
  "[verify] title=",
  verify?.meta?.title,
  "maps=",
  Object.keys(verify?.maps ?? {}).length,
  "treeIds=",
  [...vTree],
  "start=",
  verify?.startMapId,
  verify?.startPos,
  "merchant=",
  verify?.maps[mapId]?.events?.find((e) => e.id === "ev_stall_merchant")
    ? "yes"
    : "no",
);
console.log("[done] 새로고침 → 맵 트리에 여러 맵 + 장터 부스 (하네스)");
