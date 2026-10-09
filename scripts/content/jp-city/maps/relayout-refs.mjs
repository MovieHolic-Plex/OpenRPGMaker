// jp_city 시트를 48열 → 96열로 다시 놓은 뒤(2026-10-08) 이미 게시된 장소 내려받기·스냅숏의 jp_city 타일셋 사본에 새 열 수를 적는다.
// 칸 번호는 그대로라 맵 칸은 손대지 않는다. 장소 가져오기(regionReferenceImport sameImage)가 열 수까지 같아야 같은 그림으로 보기 때문에 필요하다.
//   node scripts/content/jp-city/maps/relayout-refs.mjs [--dry]
import fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const TPR = JSON.parse(fs.readFileSync(join(ROOT, "src/assets/jpCitySheet.json"), "utf8")).tilesPerRow;
const OLD = [48];
const dry = process.argv.includes("--dry");
let files = 0, sets = 0;
const fix = (ts) => { if (ts && ts.id === "jp_city" && OLD.includes(ts.tilesPerRow)) { ts.tilesPerRow = TPR; sets++; return true; } return false; };
for (const [dir, re] of [["public/assets/region-references", /^jp-city-.*\.oprn\.json$/], ["src/project/regionReferences", /^jp-city-.*\.json$/]]) {
  for (const f of fs.readdirSync(join(ROOT, dir)).filter((n) => re.test(n))) {
    const p = join(ROOT, dir, f); const j = JSON.parse(fs.readFileSync(p, "utf8"));
    let hit = false;
    if (j.tilesets) for (const ts of Object.values(j.tilesets)) hit = fix(ts) || hit;
    if (j.tileset) hit = fix(j.tileset) || hit;
    if (hit) { files++; if (!dry) fs.writeFileSync(p, JSON.stringify(j)); }
  }
}
console.log(JSON.stringify({ tilesPerRow: TPR, files, tilesets: sets, dry }));
