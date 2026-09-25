// Register the climate interior row (tiles 1980..2009) and the barn row (2010..2039, baked by bake-climate-interior-tiles.py) on the bundled Tibo
// tileset definition src/assets/tiboRecoveredTileset.json: count, walkability, layer, labels and tile groups.
// Existing projects grow to the new count through extendTiboInteriorDefaults (cells past their old count only).
// Idempotent. Usage: node scripts/content/register-climate-interior-tiles.mjs
import fs from "node:fs";

const FILE = "src/assets/tiboRecoveredTileset.json";
const t = JSON.parse(fs.readFileSync(FILE, "utf8"));
const FIRST = 1980, COUNT = 2040;
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
const prop = (label, tags, description) => ({ role: "object", tags: [label, ...tags, "헛간", "실내"], label, source: "bundled-default", passage: "solid", confidence: "high", description, defaultLayer: "upper", repeatability: "unique" });
[2010, 2011, 2012].forEach((n) => { cells[n] = [floor("짚 깔린 흙바닥", ["straw", "짚", "마구간", "헛간"], "마구간 칸 안에 두껍게 깐 짚. 세 변형을 섞어 깐다"), open]; });
[2013, 2014, 2015].forEach((n) => { cells[n] = [floor("짚 흩어진 흙바닥", ["straw", "짚", "마구간", "헛간"], "짚 칸의 가장자리·통로로 흘러나온 짚. 짙은 짚 둘레를 들쭉날쭉하게 두른다"), open]; });
["북쪽 끝", "가운데", "남쪽 끝 기둥"].forEach((p, i) => { cells[2016 + i] = [prop(`마구간 칸막이 ${p}`, ["stall partition", "칸막이", "마구간", "판자"], "남북으로 세우는 판자 칸막이. 북쪽 끝은 벽 앞 첫 바닥 줄, 가운데를 늘이고, 남쪽 끝 기둥으로 닫는다"), solid]; });
["왼쪽 위", "오른쪽 위", "왼쪽 아래", "오른쪽 아래"].forEach((p, i) => {
  cells[2019 + i] = [prop(`건초 더미 ${p}`, ["hay", "건초", "마구간"], "2×2 건초 더미. 마구간 곁에 둔다"), solid];
  cells[2023 + i] = [prop(`말(오른쪽 보기) ${p}`, ["horse", "말", "가축"], "2×2 서 있는 말. 마구간 칸 안 짚 위에 둔다(EasyRPG CharSet/Animal CC0)"), solid];
  cells[2027 + i] = [prop(`말(왼쪽 보기) ${p}`, ["horse", "말", "가축"], "2×2 서 있는 말. 마구간 칸 안 짚 위에 둔다(EasyRPG CharSet/Animal CC0)"), solid];
  cells[2031 + i] = [prop(`젖소(오른쪽 보기) ${p}`, ["cow", "소", "가축"], "2×2 서 있는 젖소. 마구간 칸 안 짚 위에 둔다(EasyRPG CharSet/Animal CC0)"), solid];
});
const UPPER = new Set(Array.from({ length: 19 }, (_, i) => 2016 + i));
for (let n = FIRST; n < COUNT; n++) {
  const [meta, pass] = cells[n] ?? [{ label: "", source: "bundled-default", description: "", defaultLayer: "upper" }, open];
  t.terrain[n] = 0;
  t.priority[n] = cells[n] && !UPPER.has(n) ? "lower" : "upper";
  t.passability[n] = pass;
  t.tileMeta[n] = meta;
}
t.count = COUNT;
const groups = [
  { id: "climate-interior-wall-log", name: "통나무 벽(설원)", tileIds: [1980, 1981, 1982, 1983, 1984, 1985], role: "wall", description: "설원 오두막 실내 벽면. 윗줄 1980~1982, 아랫줄 1983~1985(왼끝·가운데·오른끝). interiorRoomPipeline wallMaterial \"log\"." },
  { id: "climate-interior-wall-sandstone", name: "사암 벽(사막)", tileIds: [1986, 1987, 1988, 1989, 1990, 1991], role: "wall", description: "사막 집 실내 벽면. 윗줄 1986~1988, 아랫줄 1989~1991. wallMaterial \"sandstone\"." },
  { id: "climate-interior-wall-basalt", name: "현무암 벽(화산)", tileIds: [1992, 1993, 1994, 1995, 1996, 1997], role: "wall", description: "화산 마을 집·대장간 실내 벽면. 윗줄 1992~1994, 아랫줄 1995~1997. wallMaterial \"basalt\"." },
  { id: "climate-interior-floor", name: "기후 실내 바닥", tileIds: [1998, 1999], role: "terrain", description: "현무암 바닥 1998(화산), 사암 바닥 1999(사막)." },
  { id: "barn-straw", name: "짚 깔린 흙바닥(마구간)", tileIds: [2010, 2011, 2012, 2013, 2014, 2015], role: "terrain", description: "짙은 짚 2010~2012를 칸 안에 섞어 깔고, 둘레·통로에 흩어진 짚 2013~2015를 들쭉날쭉하게 두른다. 네모 판으로 깔지 않는다." },
  { id: "barn-stall-partition", name: "마구간 칸막이", tileIds: [2016, 2017, 2018], role: "object", description: "남북으로 한 칸 폭. 2016 북쪽 끝(벽·먹이통 옆 첫 바닥 줄) → 2017 가운데 반복 → 2018 남쪽 끝 기둥. upper 층, 막힘." },
  { id: "barn-animals", name: "헛간 가축·건초", tileIds: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034], role: "object", description: "2×2 조각(윗줄 둘, 아랫줄 둘): 건초 더미 2019~2022, 말(오른쪽) 2023~2026, 말(왼쪽) 2027~2030, 젖소(오른쪽) 2031~2034. 가축은 칸막이 사이 짚 위에만." },
  { id: "climate-interior-fur-rug", name: "흰 모피 깔개(설원)", tileIds: [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008], role: "terrain", description: "3×3 조각(짚 돗자리 108~170과 같은 배치). 가운데 2004를 늘려 넓힌다." },
];
for (const g of groups) {
  const full = { ...g, source: "bundled-default", confidence: "high", defaultLayer: g.role === "object" ? "upper" : "lower", placementRules: g.description };
  const i = t.tileGroups.findIndex((x) => x.id === g.id);
  if (i >= 0) t.tileGroups[i] = full; else t.tileGroups.push(full);
}
fs.writeFileSync(FILE, JSON.stringify(t, null, 2) + "\n");
console.log({ count: t.count, groups: groups.length });
