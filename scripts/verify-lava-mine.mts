/**
 * 용암동굴 적용 결과 검증 (읽기 전용): 재로드 → 사후조건 감사 → after.png + result.json.
 * 실행: npx tsx scripts/verify-lava-mine.mts
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "pngjs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { BAND, BAND_BODY, CEIL, LAVA, RAIL, isFloorTile } from "./lib/lavaMineRepair.mts";
import type { GameMap, Project } from "../src/project/types.ts";

const OUT = path.resolve("output/evidence/lava-mine-apply");
fs.mkdirSync(OUT, { recursive: true });
const T = 16, COLS = 30;
const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const config = { url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY!, projectId: "rpg-zzu-showcase" };
const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("로드 실패 — 유효성 깨짐 잔존");
const map = project.maps["map_sc_dungeon_lava"]!;
const W = map.width, H = map.height;
const at = (x: number, y: number) => y * W + x;

// 사후조건 감사 (변경 없음)
let unanchored = 0, directBorder = 0, badFace = 0;
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const t = map.lowerTiles[at(x, y)]!;
  if (BAND_BODY.has(t)) {
    if (!(y > 0 && BAND.has(map.lowerTiles[at(x, y - 1)]!))) unanchored += 1;
    if (y > 1 && BAND.has(map.lowerTiles[at(x, y - 2)]!)) badFace += 1;
    if (y < H - 1 && !isFloorTile(map.lowerTiles[at(x, y + 1)]!) && !LAVA.has(map.lowerTiles[at(x, y + 1)]!)) badFace += 1;
  }
  if (BAND.has(t) && !(y > 0 && (CEIL.has(map.lowerTiles[at(x, y - 1)]!) || BAND.has(map.lowerTiles[at(x, y - 1)]!)))) unanchored += 1;
  if (y < H - 1 && CEIL.has(t) && isFloorTile(map.lowerTiles[at(x, y + 1)]!) && x >= 2 && x < W - 2) directBorder += 1;
}
const OPENS: Record<number, readonly string[]> = {
  114: ["S"], 144: ["N", "S"], 174: ["N"], 115: ["E"], 116: ["E", "W"], 117: ["W"],
  54: ["S", "E"], 55: ["S", "W"], 84: ["N", "E"], 85: ["N", "W"],
};
const railAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && RAIL.has(map.upperTiles[at(x, y)]!);
const openAt = (x: number, y: number, d: string) => railAt(x, y) && (OPENS[map.upperTiles[at(x, y)]!] ?? []).includes(d);
let dangling = 0, oneWay = 0;
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const o = OPENS[map.upperTiles[at(x, y)]!];
  if (!o) continue;
  for (const dir of o) {
    const [dx, dy] = dir === "E" ? [1, 0] : dir === "W" ? [-1, 0] : dir === "S" ? [0, 1] : [0, -1];
    const back = dir === "E" ? "W" : dir === "W" ? "E" : dir === "S" ? "N" : "S";
    if (!railAt(x + dx, y + dy)) dangling += 1;
    else if (!openAt(x + dx, y + dy, back)) oneWay += 1;
  }
}
// 이벤트·트룹 검증
const troopIds = new Set(Object.values(project.database.troops).map((t) => (t as { id: string }).id));
const eventIssues: string[] = [];
for (const ev of map.events ?? []) {
  const i = at(ev.x, ev.y);
  if (!isFloorTile(map.lowerTiles[i]!) || map.upperTiles[i]! !== -1) eventIssues.push(`${ev.id} 위치 (${ev.x},${ev.y})`);
  const cmd = ev.pages?.[0]?.commands?.find((c) => c.kind === "battleProcessing") as { troopId?: string } | undefined;
  if (cmd?.troopId && !troopIds.has(cmd.troopId)) eventIssues.push(`${ev.id} 트룹 부재 ${cmd.troopId}`);
}
const audit = {
  unanchoredWallFaces: unanchored, directFloorCeilingBorders: directBorder, nonUniformWallFaces: badFace,
  railDanglingOpenings: dangling, railOneWayBreaks: oneWay,
  eventCount: (map.events ?? []).length, eventIssues,
};
console.log("[감사]", JSON.stringify(audit));

// 렌더
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
function renderMap(project: Project, map: GameMap, file: string): void {
  const scale = 3;
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 24; png.data[i + 1] = 22; png.data[i + 2] = 28; png.data[i + 3] = 255; }
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0), sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T, sh = q?.sh ?? T;
    for (let y = 0; y < sh * scale; y += 1) for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x, dx = x * T * scale, dy = y * T * scale;
    const tset = project.tilesets[map.tilesetId];
    const comp = tset ? chipsetQuarterComposition(map, tset, x, y) : null;
    if (comp) {
      blit(comp.underlayTile ?? map.lowerTiles[i]!, dx, dy);
      for (const s of comp.sources) blit(s.tile, dx + s.offsetX * scale, dy + s.offsetY * scale, { sx: s.offsetX, sy: s.offsetY, sw: 8, sh: 8 });
    } else if (map.lowerTiles[i]! >= 0) blit(map.lowerTiles[i]!, dx, dy);
    if (map.upperTiles[i]! >= 0) blit(map.upperTiles[i]!, dx, dy);
  }
  for (const ev of map.events ?? []) {
    const px = ev.x * T * scale, py = ev.y * T * scale;
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 6; x += 1) {
      const di = ((py + y) * png.width + (px + T * scale - 8 + x)) * 4;
      if (di < 0 || di + 3 >= png.data.length) continue;
      png.data[di] = 255; png.data[di + 1] = 60; png.data[di + 2] = 200; png.data[di + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(png));
  console.log("  rendered", file);
}
renderMap(project, map, "after.png");
const hash = crypto.createHash("sha256").update(JSON.stringify([map.lowerTiles, map.upperTiles, (map.events ?? []).map((e) => [e.id, e.x, e.y])])).digest("hex").slice(0, 16);
fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({
  projectId: config.projectId, mapId: map.id, verifiedAt: new Date().toISOString(),
  hash, audit,
  events: (map.events ?? []).map((e) => ({ id: e.id, x: e.x, y: e.y, troop: (e.pages?.[0]?.commands?.find((c) => c.kind === "battleProcessing") as { troopId?: string } | undefined)?.troopId })),
}, null, 2));
console.log("[완료] hash:", hash, "→", OUT);
if (unanchored || directBorder || badFace || dangling || oneWay || eventIssues.length) process.exit(1);
