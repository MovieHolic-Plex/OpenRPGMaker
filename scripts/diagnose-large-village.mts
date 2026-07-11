import fs from "node:fs";
import path from "node:path";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { isMapWaterTile } from "../src/editor/tools/queryTools.ts";

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

const p = await loadProjectFromSupabase(config);
if (!p) throw new Error("no project");
const map = p.maps.map_large_river_market_village ?? Object.values(p.maps)[0];
if (!map) throw new Error("no map");

const lines: string[] = [];
const log = (s: string) => {
  lines.push(s);
  console.log(s);
};

log(`title=${p.meta.title}`);
log(`maps=${Object.keys(p.maps).join(",")}`);
log(`size=${map.width}x${map.height} start=${JSON.stringify(p.startPos)}`);
log(`events=${map.events.length}`);

const byPrefix: Record<string, number> = {};
for (const e of map.events) {
  const k = e.id.replace(/_\d+$/, "").slice(0, 28);
  byPrefix[k] = (byPrefix[k] ?? 0) + 1;
}
log(`eventKinds=${JSON.stringify(byPrefix)}`);

let water = 0;
let grass = 0;
let upperOcc = 0;
let door = 0;
for (let i = 0; i < map.lowerTiles.length; i += 1) {
  const t = map.lowerTiles[i] ?? -1;
  if (isMapWaterTile(t)) water += 1;
  if (t === 270 || t === 240) grass += 1;
  if (t === 116 || t === 146) door += 1;
  if ((map.upperTiles[i] ?? -1) >= 0) upperOcc += 1;
}
log(`tiles water=${water} grass=${grass} upperOcc=${upperOcc} doorCells=${door}`);

function ch(x: number, y: number): string {
  const i = y * map.width + x;
  const L = map.lowerTiles[i] ?? -1;
  const U = map.upperTiles[i] ?? -1;
  if (isMapWaterTile(L)) return "~";
  if (U === 234 || U === 235 || U === 236) return "T";
  if (U >= 378 && U <= 439) return "F";
  if (L === 116 || L === 146) return "D";
  if (L !== 270 && L !== 240 && L !== -1) return "#";
  return ".";
}

log("--- center 40..72 x 40..72 (. grass # terrain ~ water T table F fence D door) ---");
for (let y = 40; y <= 72; y += 1) {
  let row = "";
  for (let x = 40; x <= 72; x += 1) row += ch(x, y);
  log(`${String(y).padStart(2, "0")} ${row}`);
}

log("--- west strip x0-20 y45-60 ---");
for (let y = 45; y <= 60; y += 1) {
  let row = "";
  for (let x = 0; x <= 20; x += 1) row += ch(x, y);
  log(row);
}

log("--- NE lake x58-95 y6-40 step2 ---");
for (let y = 6; y <= 40; y += 2) {
  let row = "";
  for (let x = 58; x <= 95; x += 1) row += ch(x, y);
  log(`${String(y).padStart(2, "0")} ${row}`);
}

log("--- key events ---");
for (const e of map.events) {
  if (
    e.id.includes("mkt")
    || e.id.includes("fisher")
    || e.id.includes("shop")
    || e.id.startsWith("ev_townsfolk_")
  ) {
    if (e.id.startsWith("ev_townsfolk_")) continue;
    log(`${e.id} @${e.x},${e.y} ${e.pages[0]?.name ?? ""}`);
  }
}
const folk = map.events.filter((e) => e.id.startsWith("ev_townsfolk_")).length;
log(`townsfolk=${folk}`);

// failure analysis notes
log("--- root-cause notes ---");
log("1) build_village first: houses/paths in full 100x100 with terrain masks (river/lake/forest/market).");
log("2) Then OVERWROTE more water rects on west/south AND NE circle lake — can wipe houses/roads under water.");
log("3) Then paint_road polylines with high naturalness — roads ignore house footprints, can cut yards.");
log("4) Market stamped at fixed (54,44) regardless of actual plaza coords from build_village.");
log("5) topUpNpcs grid-scatters 50 sprites on any passable cell — noise, not authored placement.");
log("6) report.json only stored counts (ok:true) — no layout QA, no screenshots.");

const outDir = path.join("output", "evidence", "large-river-market-village");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "diagnose.txt"), lines.join("\n"), "utf8");
fs.writeFileSync(
  path.join(outDir, "diagnose-meta.json"),
  JSON.stringify({ water, grass, upperOcc, door, folk, events: map.events.length, start: p.startPos }, null, 2),
  "utf8",
);
log(`[wrote] ${outDir}/diagnose.txt`);
