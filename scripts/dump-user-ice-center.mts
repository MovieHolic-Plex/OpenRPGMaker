/** 사용자 수정 map_g_ice_grand 중앙부 타일 덤프. */
import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const p = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: "rpg-zzu-dungeon-theme-gallery",
});
const map = p!.maps["map_g_ice_grand"]!;
const W = map.width;
console.log("== 중앙 산맥 (x 14-38, y 7-19) ==");
for (let y = 7; y <= 19; y += 1) {
  let row = "";
  for (let x = 14; x <= 38; x += 1) row += String(map.lowerTiles[y * W + x]).padStart(4);
  console.log(String(y).padStart(2), row);
}
console.log("== upper 동일 영역 ==");
for (let y = 7; y <= 19; y += 1) {
  let row = "";
  for (let x = 14; x <= 38; x += 1) row += String(map.upperTiles[y * W + x]).padStart(4);
  console.log(String(y).padStart(2), row);
}
