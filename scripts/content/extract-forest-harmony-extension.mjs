#!/usr/bin/env node
// 숲마을 원본 시트(2550칸) 뒤에 붙는 공용 이식 칸 2550~2759 를 한 파일로 뽑는다 → src/assets/forestHarmonyVillageExtension.json
//
// 등록 장소 문서(다양한 마을·컨셉 마을·필드·판타지 외관)는 2550~2729(굽이숲 수관·절벽·계단·폭포·다리·배·말뚝·생활 소품)와
// 2730~2759(판타지 폐성 조각)를 쓴다. 이 칸들은 장소마다 같은 이식(tileGrafts)이라, 새 프로젝트와 옛 프로젝트의 forest_harmony
// 가 처음부터 같은 번호를 갖게 defaults/forestHarmonyExtension.ts 가 이 파일을 붙인다.
//
// 원본: 다양한 마을 최신판(너울목, 2550~2729)과 판타지 폐성(2730~2759)의 projectDownload. 두 장소의 이식은 겹치는 칸에서 같다.
// 재생성: node scripts/content/extract-forest-harmony-extension.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (name) => JSON.parse(readFileSync(resolve(ROOT, "public/assets/region-references", name), "utf8")).tilesets.forest_harmony;
const village = read("nuleolmok-harbor-town.oprn.json");
const fantasy = read("fantasy-ruined-castle.oprn.json");
const START = 2550;
const COUNT = Math.max(village.count, fantasy.count);

const sourceFor = (tile) => (tile < village.count ? village : fantasy);
const graftByTarget = new Map();
for (const tileset of [village, fantasy]) {
  for (const graft of tileset.tileGrafts ?? []) {
    if (graft.targetTile < START) continue;
    const previous = graftByTarget.get(graft.targetTile);
    if (previous && (previous.sourceChipset !== graft.sourceChipset || previous.sourceTile !== graft.sourceTile)) {
      throw new Error(`graft conflict at ${graft.targetTile}`);
    }
    graftByTarget.set(graft.targetTile, { targetTile: graft.targetTile, sourceChipset: graft.sourceChipset, sourceTile: graft.sourceTile });
  }
}
const slots = [];
for (let tile = START; tile < COUNT; tile += 1) {
  const source = sourceFor(tile);
  slots.push({
    passability: source.passability[tile],
    priority: source.priority[tile],
    terrain: source.terrain[tile],
    tileMeta: source.tileMeta?.[tile] ?? { label: "", description: "" },
  });
}
const grove = village.autotileGroups.find((group) => group.id === "forest_harmony_grove_47");
const harbor = village.tileGroups.find((group) => group.id === "harbor-kit");
const out = {
  start: START,
  count: COUNT,
  grafts: [...graftByTarget.values()].sort((a, b) => a.targetTile - b.targetTile),
  slots,
  autotileGroups: [grove],
  tileGroups: [harbor],
  structureKits: village.structureKits ?? [],
};
writeFileSync(resolve(ROOT, "src/assets/forestHarmonyVillageExtension.json"), `${JSON.stringify(out)}\n`);
console.log(`start ${START} count ${COUNT} grafts ${out.grafts.length} kits ${out.structureKits.length}`);
