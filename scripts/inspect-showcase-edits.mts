/**
 * 쇼케이스 프로젝트 사용자 수정 분석 — 원격(rpg-zzu-showcase) vs 빌드 백업 diff.
 * - 맵 추가/삭제 목록, 맵별 변경 셀 수
 * - 수정된 맵 + 용암 던전 현재 상태 렌더 PNG
 * 실행: npx tsx scripts/inspect-showcase-edits.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import type { GameMap, Project } from "../src/project/types.ts";

const OUT = path.resolve("output/evidence/showcase-edits");
fs.mkdirSync(OUT, { recursive: true });
const T = 16;
const COLS = 30;

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const remote = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: "rpg-zzu-showcase",
});
if (!remote) throw new Error("원격 로드 실패");
const local: Project = JSON.parse(fs.readFileSync("output/evidence/showcase-project/project.json", "utf8"));

const remoteIds = new Set(Object.keys(remote.maps));
const localIds = new Set(Object.keys(local.maps));
console.log("== 맵 목록 변화 ==");
for (const id of localIds) if (!remoteIds.has(id)) console.log("  삭제:", id, "—", local.maps[id]!.name);
for (const id of remoteIds) if (!localIds.has(id)) console.log("  추가:", id, "—", remote.maps[id]!.name);

console.log("\n== 타일 변경 (공통 맵) ==");
const changed: string[] = [];
for (const id of remoteIds) {
  if (!localIds.has(id)) continue;
  const a = local.maps[id]!;
  const b = remote.maps[id]!;
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`  ${id}: 크기 변경 ${a.width}×${a.height} → ${b.width}×${b.height}`);
    changed.push(id);
    continue;
  }
  let lowerDiff = 0, upperDiff = 0;
  for (let i = 0; i < a.lowerTiles.length; i += 1) {
    if (a.lowerTiles[i] !== b.lowerTiles[i]) lowerDiff += 1;
    if (a.upperTiles[i] !== b.upperTiles[i]) upperDiff += 1;
  }
  const evA = (a.events ?? []).length, evB = (b.events ?? []).length;
  if (lowerDiff || upperDiff || evA !== evB) {
    console.log(`  ${id} (${b.name}): lower ${lowerDiff}칸, upper ${upperDiff}칸, 이벤트 ${evA}→${evB}`);
    changed.push(id);
  }
}
if (changed.length === 0) console.log("  (없음)");

// 용암 던전 타일 히스토그램 (사용자 개편 후 어휘 파악)
const lava = remote.maps["map_sc_dungeon_lava"];
if (lava) {
  const hist = (arr: readonly number[]): string => {
    const h = new Map<number, number>();
    for (const t of arr) h.set(t, (h.get(t) ?? 0) + 1);
    return [...h.entries()].sort((x, y) => y[1] - x[1]).slice(0, 20)
      .map(([t, n]) => `${t}×${n}`).join(" ");
  };
  console.log("\n== 용암 던전 현재 어휘 ==");
  console.log("  lower:", hist(lava.lowerTiles));
  console.log("  upper:", hist(lava.upperTiles));
}

// 렌더
const CHIPS: Record<string, PNG> = {
  easyrpg_chipset_combined_town: PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png")),
  easyrpg_chipset_interior: PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png")),
  easyrpg_chipset_dungeon: PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png")),
};

function renderMap(project: Project, map: GameMap, file: string): void {
  const chip = CHIPS[map.tilesetId];
  if (!chip) { console.log("  [skip render]", map.id, map.tilesetId); return; }
  const tileset = project.tilesets[map.tilesetId];
  const scale = map.width >= 40 ? 2 : 3;
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 24; png.data[i + 1] = 22; png.data[i + 2] = 28; png.data[i + 3] = 255;
  }
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0);
    const sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T;
    const sh = q?.sh ?? T;
    for (let y = 0; y < sh * scale; y += 1) for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x;
    const dx = x * T * scale, dy = y * T * scale;
    const composition = tileset ? chipsetQuarterComposition(map, tileset, x, y) : null;
    if (composition) {
      blit(composition.underlayTile ?? map.lowerTiles[i]!, dx, dy);
      for (const src of composition.sources) {
        blit(src.tile, dx + src.offsetX * scale, dy + src.offsetY * scale, { sx: src.offsetX, sy: src.offsetY, sw: 8, sh: 8 });
      }
    } else if (map.lowerTiles[i]! >= 0) blit(map.lowerTiles[i]!, dx, dy);
    if (map.upperTiles[i]! >= 0) blit(map.upperTiles[i]!, dx, dy);
  }
  for (const ev of map.events ?? []) {
    const px = ev.x * T * scale, py = ev.y * T * scale;
    const s = Math.max(4, 2 * scale);
    for (let y = 0; y < s; y += 1) for (let x = 0; x < s; x += 1) {
      const di = ((py + y) * png.width + (px + (T * scale - s) + x)) * 4;
      if (di < 0 || di + 3 >= png.data.length) continue;
      png.data[di] = 255; png.data[di + 1] = 140; png.data[di + 2] = 0; png.data[di + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(png));
  console.log("  rendered", file);
}

console.log("\n== 렌더 ==");
for (const id of changed) {
  const map = remote.maps[id];
  if (map) renderMap(remote, map, `${id}.remote.png`);
}
if (lava && !changed.includes("map_sc_dungeon_lava")) renderMap(remote, lava, "map_sc_dungeon_lava.remote.png");
fs.writeFileSync(path.join(OUT, "remote-project.json"), JSON.stringify(remote));
console.log("원격 백업: output/evidence/showcase-edits/remote-project.json");
