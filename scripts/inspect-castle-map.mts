import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { tileLabelForIndex } from "../src/project/defaults/chipsetMapping.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const p = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
if (!p) throw new Error("no project");

const map = p.maps.map_castle_keep;
if (!map) throw new Error("no castle map");

const freq = new Map<number, number>();
for (const t of map.lowerTiles) freq.set(t, (freq.get(t) ?? 0) + 1);
const nonGrass = [...freq.entries()].filter(([t]) => t !== 240 && t !== 270 && t !== 300 && t !== 330).sort((a, b) => b[1] - a[1]);

console.log("map", map.id, map.width, "x", map.height);
console.log(
  "non-grass tiles:",
  nonGrass.map(([t, n]) => `${t}(${tileLabelForIndex(t) || "?"}):${n}`).join(" | "),
);

// Find clusters of roof corners / unusual tiles that might be round towers
const interesting = new Set(nonGrass.map(([t]) => t));
const cells: { x: number; y: number; t: number }[] = [];
for (let y = 0; y < map.height; y += 1) {
  for (let x = 0; x < map.width; x += 1) {
    const t = map.lowerTiles[y * map.width + x]!;
    if (interesting.has(t)) cells.push({ x, y, t });
  }
}
const minX = Math.min(...cells.map((c) => c.x));
const minY = Math.min(...cells.map((c) => c.y));
const maxX = Math.max(...cells.map((c) => c.x));
const maxY = Math.max(...cells.map((c) => c.y));

// Full ASCII of structure bbox
const glyph = (t: number): string => {
  if (t === 21) return "T";
  if (t === 51) return "M";
  if (t === 81) return "B";
  if ([18, 20, 108, 110].includes(t)) return "c";
  if ([19, 109].includes(t)) return "-";
  if ([48, 78].includes(t)) return "|";
  if ([49, 50, 79, 80].includes(t)) return "#";
  if (t === 423 || t === 424 || t === 425 || t === 394) return "~"; // sand
  if (t === 140 || t === 141 || t === 142 || t === 143) return "O"; // maybe round?
  if (t >= 246 && t <= 341) return "S";
  if (t === 240 || t === 270) return ".";
  return String.fromCharCode(65 + (t % 26)); // letter for other
};

console.log("\nbbox", { minX, minY, maxX, maxY });
console.log("glyph: TMB wall  c-|# roof  ~ sand  O tile140s  . grass  letter=other");
for (let y = minY; y <= maxY; y += 1) {
  let row = "";
  for (let x = minX; x <= maxX; x += 1) {
    row += glyph(map.lowerTiles[y * map.width + x]!);
  }
  console.log(String(y).padStart(2, "0") + " " + row);
}

// Corner regions for "round tower" inspection (NW NE SW SE of outer bbox)
const corners = [
  { name: "NW", x0: minX, y0: minY, x1: minX + 6, y1: minY + 6 },
  { name: "NE", x0: maxX - 6, y0: minY, x1: maxX, y1: minY + 6 },
  { name: "SW", x0: minX, y0: maxY - 6, x1: minX + 6, y1: maxY },
  { name: "SE", x0: maxX - 6, y0: maxY - 6, x1: maxX, y1: maxY },
];
for (const c of corners) {
  const local = new Map<number, number>();
  for (let y = c.y0; y <= c.y1; y += 1) {
    for (let x = c.x0; x <= c.x1; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const t = map.lowerTiles[y * map.width + x]!;
      local.set(t, (local.get(t) ?? 0) + 1);
    }
  }
  console.log(
    "\ncorner",
    c.name,
    [...local.entries()]
      .filter(([t]) => t !== 240)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t}:${n}`)
      .join(" "),
  );
}
