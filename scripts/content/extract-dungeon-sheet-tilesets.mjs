#!/usr/bin/env node
// 던전 재칠 시트 타일셋(oprn_dungeon_*)을 easyrpg_chipset_dungeon 과의 차이만 남겨 뽑는다 → src/assets/dungeonSheetTilesets.json
//
// 던전 장소 문서(rpg-dungeons-*)는 oprn_dungeon_cave·stone·desert·sea·lair 로 그렸는데, 이 타일셋들은 장소 내려받기에만 있어 새
// 프로젝트에서 create_map·던전 파이프라인이 「타일셋을 찾을 수 없습니다」로 막혔다(2026-09-25 조수 시험). 칸 번호가 원본 던전 칩셋과
// 같으니(scripts/content/build-rpg-dungeon-sheets.py 가 칸 그대로 다시 칠함) 원본 정의 + 그림 + 뒤쪽 30칸(계단·보물상자 이식) + 몇 칸의
// 통행 차이만 들고 다닌다. 쓰는 곳: src/project/defaults/dungeonSheetTilesets.ts.
// 재생성(내려받기 갱신 뒤): node scripts/content/extract-dungeon-sheet-tilesets.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = resolve(ROOT, "public/assets/region-references");
const sheets = new Map();
for (const file of readdirSync(DIR).filter((name) => name.startsWith("dungeon-") && name.endsWith(".oprn.json"))) {
  const project = JSON.parse(readFileSync(resolve(DIR, file), "utf8"));
  for (const tileset of Object.values(project.tilesets)) {
    if (tileset.id.startsWith("oprn_dungeon_") && !sheets.has(tileset.id)) sheets.set(tileset.id, tileset);
  }
}
// The base rules come from any sheet's first 480 cells where the sheets agree; overrides record where each differs from
// the majority, so the loader rebuilds each sheet from the project's own easyrpg_chipset_dungeon plus these few cells.
const ids = [...sheets.keys()].sort();
const cellKey = (tileset, tile) => JSON.stringify([tileset.passability[tile], tileset.priority[tile], tileset.terrain[tile], tileset.tileMeta?.[tile] ?? null]);
const out = {};
for (const id of ids) {
  const tileset = sheets.get(id);
  const overrides = {};
  for (let tile = 0; tile < 480; tile += 1) {
    const votes = new Map();
    for (const other of sheets.values()) votes.set(cellKey(other, tile), (votes.get(cellKey(other, tile)) ?? 0) + 1);
    const majority = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (cellKey(tileset, tile) !== majority) {
      overrides[tile] = { passability: tileset.passability[tile], priority: tileset.priority[tile], terrain: tileset.terrain[tile], tileMeta: tileset.tileMeta?.[tile] };
    }
  }
  const tail = [];
  for (let tile = 480; tile < tileset.count; tile += 1) {
    tail.push({ passability: tileset.passability[tile], priority: tileset.priority[tile], terrain: tileset.terrain[tile], tileMeta: tileset.tileMeta?.[tile] ?? { label: "", description: "" } });
  }
  out[id] = { id, name: tileset.name, image: tileset.image, count: tileset.count, tileGrafts: tileset.tileGrafts ?? [], overrides, tail };
}
// `common` = the rules all sheets share on cells 0..479 (majority), applied before each sheet's overrides. Labels come from
// the project's own easyrpg_chipset_dungeon, so user-edited names survive.
const common = { passability: [], priority: [], terrain: [] };
for (let tile = 0; tile < 480; tile += 1) {
  const votes = new Map();
  for (const other of sheets.values()) {
    const key = JSON.stringify([other.passability[tile], other.priority[tile], other.terrain[tile]]);
    votes.set(key, (votes.get(key) ?? 0) + 1);
  }
  const [passability, priority, terrain] = JSON.parse([...votes.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  common.passability.push(passability); common.priority.push(priority); common.terrain.push(terrain);
}
writeFileSync(resolve(ROOT, "src/assets/dungeonSheetTilesets.json"), `${JSON.stringify({ sheets: out, common })}\n`);
console.log(ids.map((id) => `${id}: overrides ${Object.keys(out[id].overrides).length}, tail ${out[id].tail.length}, grafts ${out[id].tileGrafts.length}`).join("\n"));
