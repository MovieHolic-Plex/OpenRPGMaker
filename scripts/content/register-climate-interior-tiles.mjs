// Register the climate interior row (tiles 1980..2009, baked by bake-climate-interior-tiles.py) on the bundled Tibo
// tileset definition src/assets/tiboRecoveredTileset.json: count, walkability, layer, labels and tile groups.
// Existing projects grow to the new count through extendTiboInteriorDefaults (cells past their old count only).
// Idempotent. Usage: node scripts/content/register-climate-interior-tiles.mjs
import fs from "node:fs";

const FILE = "src/assets/tiboRecoveredTileset.json";
const t = JSON.parse(fs.readFileSync(FILE, "utf8"));
const FIRST = 1980, COUNT = 2010;
const solid = { up: false, down: false, left: false, right: false }, open = { up: true, down: true, left: true, right: true };
const wall = (label, tags) => ({ role: "wall", tags: [label, ...tags, "벽", "실내"], label, source: "bundled-default", passage: "solid", confidence: "high", description: "", defaultLayer: "lower", repeatability: "repeat" });
const floor = (label, tags, description = "") => ({ role: "terrain", tags: [label, ...tags, "바닥", "실내"], label, source: "bundled-default", passage: "passable", confidence: "high", terrainTag: 0, description, defaultLayer: "lower", repeatability: "repeat" });
const cells = {};
const face = (start, name, tags) => {
  const parts = ["왼끝", "가운데", "오른끝"];
  parts.forEach((p, i) => { cells[start + i] = [wall(`${name} 윗줄 ${p}`, tags), solid]; cells[start + 3 + i] = [wall(`${name} 아랫줄 ${p}`, tags), solid]; });
};
face(1980, "통나무 벽", ["log wall", "통나무", "설원", "오두막"]);
face(1986, "사암 벽", ["sandstone wall", "사암", "사막", "흙벽돌"]);
face(1992, "현무암 벽", ["basalt wall", "현무암", "화산", "검은 돌"]);
cells[1998] = [floor("현무암 바닥", ["basalt floor", "화산", "검은 돌"], "화산 마을 집·대장간의 어두운 돌바닥"), open];
cells[1999] = [floor("사암 바닥", ["sandstone floor", "사막", "모래빛"], "사막 마을 집의 모래빛 돌바닥"), open];
["왼쪽 위", "위", "오른쪽 위", "왼쪽", "가운데", "오른쪽", "왼쪽 아래", "아래", "오른쪽 아래"].forEach((p, i) => {
  cells[2000 + i] = [floor(`흰 모피 깔개 ${p}`, ["fur rug", "모피", "설원", "깔개"], "3×3 흰 모피 깔개. 블록 단위로 깐다"), open];
});
for (let n = FIRST; n < COUNT; n++) {
  const [meta, pass] = cells[n] ?? [{ label: "", source: "bundled-default", description: "", defaultLayer: "upper" }, open];
  t.terrain[n] = 0;
  t.priority[n] = cells[n] ? "lower" : "upper";
  t.passability[n] = pass;
  t.tileMeta[n] = meta;
}
t.count = COUNT;
const groups = [
  { id: "climate-interior-wall-log", name: "통나무 벽(설원)", tileIds: [1980, 1981, 1982, 1983, 1984, 1985], role: "wall", description: "설원 오두막 실내 벽면. 윗줄 1980~1982, 아랫줄 1983~1985(왼끝·가운데·오른끝). interiorRoomPipeline wallMaterial \"log\"." },
  { id: "climate-interior-wall-sandstone", name: "사암 벽(사막)", tileIds: [1986, 1987, 1988, 1989, 1990, 1991], role: "wall", description: "사막 집 실내 벽면. 윗줄 1986~1988, 아랫줄 1989~1991. wallMaterial \"sandstone\"." },
  { id: "climate-interior-wall-basalt", name: "현무암 벽(화산)", tileIds: [1992, 1993, 1994, 1995, 1996, 1997], role: "wall", description: "화산 마을 집·대장간 실내 벽면. 윗줄 1992~1994, 아랫줄 1995~1997. wallMaterial \"basalt\"." },
  { id: "climate-interior-floor", name: "기후 실내 바닥", tileIds: [1998, 1999], role: "terrain", description: "현무암 바닥 1998(화산), 사암 바닥 1999(사막)." },
  { id: "climate-interior-fur-rug", name: "흰 모피 깔개(설원)", tileIds: [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008], role: "terrain", description: "3×3 조각(짚 돗자리 108~170과 같은 배치). 가운데 2004를 늘려 넓힌다." },
];
for (const g of groups) {
  const full = { ...g, source: "bundled-default", confidence: "high", defaultLayer: "lower", placementRules: g.description };
  const i = t.tileGroups.findIndex((x) => x.id === g.id);
  if (i >= 0) t.tileGroups[i] = full; else t.tileGroups.push(full);
}
fs.writeFileSync(FILE, JSON.stringify(t, null, 2) + "\n");
console.log({ count: t.count, groups: groups.length });
