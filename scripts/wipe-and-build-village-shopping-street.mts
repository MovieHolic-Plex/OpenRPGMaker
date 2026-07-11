/**
 * 프로젝트 맵 전부 제거 후 build_village 알고리즘 기반 「마을과 상점가」 한 장 설치·저장.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildVillageShoppingStreetProject,
  VILLAGE_SHOPPING_STREET_MAP_ID,
} from "../src/project/defaults/villageShoppingStreetBuild.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { collectMapIdsInTree } from "../src/editor/mapTreeActions.ts";

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

try {
  const existing = await loadProjectFromSupabase(config);
  console.log("[before] title:", existing?.meta?.title);
  console.log("[before] maps:", existing ? Object.keys(existing.maps) : null);
  console.log("[before] tree:", existing ? [...collectMapIdsInTree(existing.mapTree)] : null);
} catch (err) {
  console.warn("[before] load failed, will overwrite:", err);
}

const built = buildVillageShoppingStreetProject({ seed: 11, houses: 6 });
const project = built.project;
const map = project.maps[VILLAGE_SHOPPING_STREET_MAP_ID];
if (!map) throw new Error("map missing after build");

console.log("[build] village:", built.villageSummary);
console.log("[build] houses:", built.housesBuilt, "shops:", built.shopEvents);
console.log("[build] size:", map.width, "x", map.height);
console.log("[build] maps:", Object.keys(project.maps));
console.log("[build] tree:", built.mapTreeIds);
console.log("[build] start:", project.startMapId, project.startPos);
console.log("[build] warnings:", built.warnings);
console.log(
  "[build] events:",
  map.events.map((e) => `${e.id}@${e.x},${e.y}`).join(" | "),
);

const woodFloor = map.lowerTiles.filter((t) => t === 222).length;
const fenceTiles = map.upperTiles.filter((t) =>
  [378, 379, 380, 408, 409, 410, 438, 439].includes(t),
).length;
const rails = map.upperTiles.filter((t) => t === 468 || t === 469 || t === 470).length;
console.log("[tiles] woodFloor", woodFloor, "fence", fenceTiles, "rails", rails);

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved);

const verify = await loadProjectFromSupabase(config);
const vMaps = verify ? Object.keys(verify.maps) : [];
const vMap = verify?.maps[VILLAGE_SHOPPING_STREET_MAP_ID];
const shops = vMap?.events.filter((e) => e.id.startsWith("ev_shop_")).length ?? 0;
const report = {
  ok: Boolean(
    verify
      && vMaps.length === 1
      && vMaps[0] === VILLAGE_SHOPPING_STREET_MAP_ID
      && vMap
      && shops >= 3
      && built.housesBuilt >= 4,
  ),
  title: verify?.meta?.title,
  maps: vMaps,
  tree: verify ? [...collectMapIdsInTree(verify.mapTree)] : [],
  startMapId: verify?.startMapId,
  startPos: verify?.startPos,
  size: vMap ? { w: vMap.width, h: vMap.height } : null,
  housesBuilt: built.housesBuilt,
  shops,
  woodFloor,
  fenceTiles,
  rails,
  villageSummary: built.villageSummary,
  warnings: built.warnings,
  saved,
};

const outDir = path.join("output", "evidence", "village-shopping-street");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log("[verify]", JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
console.log("[done] 새로고침 → 「마을과 상점가」 1맵 (build_village 배치 + 동쪽 상점가)");
