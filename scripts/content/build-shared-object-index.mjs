#!/usr/bin/env node
// 공용 오브젝트 목록의 「장소 안 킷」 색인 → src/assets/sharedObjectIndex.json
//
// 새 프로젝트의 번들 타일셋에 없는 구조 킷(생성 건물 외형 fft-*, 성채 항구의 나룻배·부두·포대 등)은 등록 장소 안에만 있다.
// 목록은 동기로 보여야 하므로 이름·크기만 색인하고, 찍을 때(stamp_object) 그 장소 원본을 불러 킷을 읽는다.
// 재생성: node scripts/content/build-shared-object-index.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
// (reference id, tileset id in its source, kit id filter). Bundled tilesets' own kits are listed live from the project.
const SOURCES = [
  { referenceId: "forest-fantasy-town-104x96", file: "src/project/regionReferences/forest-fantasy-town.json", keep: (kit) => kit.id.startsWith("fft-") },
  { referenceId: "castle-courtyard", file: "public/assets/region-references/castle-courtyard.oprn.json", keep: () => true },
];
const entries = [];
for (const source of SOURCES) {
  const data = read(source.file);
  const tilesets = data.tileset ? { [data.tileset.id]: data.tileset } : data.tilesets;
  for (const tileset of Object.values(tilesets)) {
    for (const kit of tileset.structureKits ?? []) {
      if (kit.kind !== "section" || !source.keep(kit)) continue;
      entries.push({ id: `refkit:${source.referenceId}/${kit.id}`, name: kit.name || kit.id, width: kit.width, height: kit.height,
        tilesetId: tileset.id, referenceId: source.referenceId, kitId: kit.id });
    }
  }
}
writeFileSync(resolve(ROOT, "src/assets/sharedObjectIndex.json"), `${JSON.stringify({ refKits: entries }, null, 1)}\n`);
console.log(`${entries.length} reference kits`);
