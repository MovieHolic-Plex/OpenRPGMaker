// Publish the fields between villages and the outdoor places (tiledata/rpg-outdoors) under 장소 from the reloaded canonical export. No host writes.
// Usage: node scripts/content/prepare-field-routes-regions.mjs output/evidence/field-routes/reloaded.json
import fs from "node:fs";
import assert from "node:assert/strict";
const [input] = process.argv.slice(2);
if (!input) throw Error("Usage: prepare-field-routes-regions.mjs reloaded-project.json");
const project = JSON.parse(fs.readFileSync(input));
const c = JSON.parse(fs.readFileSync("tiledata/field-routes/catalog.json"));
const proof = JSON.parse(fs.readFileSync("tiledata/field-routes/storage-proof.json"));
const references = JSON.parse(fs.readFileSync("src/assets/sharedFieldRouteReferences.json"));
const SHEET = { forest_harmony: "/assets/forest-harmony/chipset.png", ...Object.fromEntries(["snow", "volcano", "desert", "autumn"].map((k) => [`forest_harmony_${k}`, `/assets/climate-villages/${k}-chipset.png`])) };
const entries = [], snapshotMaps = {}, snapshotTilesets = {};
for (const plan of c.plans) {
  const map = project.maps[plan.id];
  assert.deepEqual(map.lowerTiles, c.maps[plan.id].lowerTiles, plan.id);
  assert.deepEqual(map.upperTiles, c.maps[plan.id].upperTiles, plan.id);
  const tileset = project.tilesets[map.tilesetId];
  const exported = structuredClone(project);
  exported.meta.title = plan.name;
  exported.maps = { [map.id]: map };
  exported.mapTree = { mapId: map.id, children: [] };
  exported.startMapId = map.id;
  exported.startPos = { x: plan.entry[0], y: plan.entry[1] };
  // Only the guidance about these parts travels with the download (the full forest_harmony shelf is ~9MB).
  const KEEP = /^(field-routes-|climate-|diverse-villages|concept-villages)/;
  exported.tilesets = { [tileset.id]: { ...tileset, referenceDocuments: (tileset.referenceDocuments ?? []).filter((k) => KEEP.test(k.id)) } };
  fs.writeFileSync(`public/assets/region-references/${plan.id}.oprn.json`, JSON.stringify(exported) + "\n");
  fs.copyFileSync(`tiledata/field-routes/images/${plan.id}.png`, `public/assets/region-references/${plan.id}.png`);
  snapshotMaps[map.id] = map;
  // readRegionReference only reads walkability/priority/terrain and the sheet identity.
  const { id, image, tileSize, tilesPerRow, count, passability, priority, terrain } = tileset;
  snapshotTilesets[id] = { id, image, tileSize, tilesPerRow, count, passability, priority, terrain };
  const category = references[map.tilesetId];
  const kinds = [...new Set((plan.edits ?? []).map((e) => e.kind).filter((k) => k !== "desert-plant"))];
  entries.push({
    id: `${plan.id}-${map.width}x${map.height}`,
    name: plan.name,
    kind: "completed-place",
    placeKind: "natural",
    revision: 4,
    x: 0,
    y: 0,
    width: map.width,
    height: map.height,
    tilesetId: map.tilesetId,
    preview: `/assets/region-references/${plan.id}.png`,
    tilesetPreview: SHEET[map.tilesetId],
    projectDownload: `/assets/region-references/${plan.id}.oprn.json`,
    sourceProjectId: proof.projectId,
    sourceMapId: map.id,
    snapshotProjectId: `oprn-place-${plan.id}-v1`,
    rules: [
      plan.note + ".",
      "마을 사이 필드: " + plan.exits.map((e) => `${{ west: "서", east: "동", north: "북", south: "남" }[e.side]}쪽 출구 (${e.x},${e.y}) → ${e.meets}`).join(", ") + ".",
      plan.from
        ? `숲마을 필드 「${plan.from}」과 칸 번호가 같은 기후 시트(${map.tilesetId})로 옮겼다. 기후 편집: ${kinds.join(", ") || "없음(시트만)"}.`
        : "숲마을 「다양한 마을」 타일셋(이식 2550~2729 포함)에 그렸다. 내려받기의 tileGrafts와 통행 정보를 함께 쓴다.",
      `첫 출구에서 모든 출구·계단 끝·다리 끝${plan.cave ? "·동굴 앞" : ""}${plan.freezePond !== undefined ? "·얼음판" : ""}까지 런타임 이동 규칙으로 닿는 것을 확인했다.`,
      "숲 수관 속은 잎으로 채운 깊이 변형을 쓴다: 8방향이 모두 수관인 칸은 2칸 안에 빈 땅이 있으면 얕은 속(2568·2597~2601), 없으면 깊은 속(2602~2607).",
      `공용 AI 문서 「${category.name}」에 필드 규칙·전체 배열·사용 타일 사전이 있다.`,
    ],
    limitations: "지형 참고 사례. 출구는 어느 마을로 이어지는지만 적었고 문 이동·NPC·이벤트는 포함하지 않는다. 자동 생성 프리셋이 아니다.",
  });
}
// The outdoor places of tiledata/rpg-outdoors (towns, sacred places, scenes, fields, the great valley, the world map)
// travel in the same canonical project and snapshot file.
const outdoors = JSON.parse(fs.readFileSync("tiledata/rpg-outdoors/catalog.json"));
SHEET.oprn_world_keyed = "/assets/easyrpg-chipset-world.png";
const SIDE = { west: "서", east: "동", north: "북", south: "남" };
const SETTLEMENT = new Set(["towns", "scenes"]);
const TOWNISH = new Set(["outdoor-desert-oasis-city", "outdoor-snow-fortress", "outdoor-nomad-camp"]);
for (const plan of outdoors.plans) {
  const map = project.maps[plan.id];
  assert(map, plan.id + " missing from the reload");
  assert.deepEqual(map.lowerTiles, outdoors.maps[plan.id].lowerTiles, plan.id);
  assert.deepEqual(map.upperTiles, outdoors.maps[plan.id].upperTiles, plan.id);
  const tileset = project.tilesets[map.tilesetId];
  const world = map.tilesetId === "oprn_world_keyed";
  const exported = structuredClone(project);
  exported.meta.title = plan.name;
  exported.maps = { [map.id]: map };
  exported.mapTree = { mapId: map.id, children: [] };
  exported.startMapId = map.id;
  const entry = plan.entry ?? [Math.floor(map.width / 2), Math.floor(map.height / 2)];
  exported.startPos = { x: entry[0], y: entry[1] };
  // Outdoor downloads carry only the field/outdoor guidance (not the 3MB village shelves).
  const KEEP = /^(field-routes-|rpg-outdoors-|climate-)/;
  exported.tilesets = { [tileset.id]: { ...tileset, referenceDocuments: (tileset.referenceDocuments ?? []).filter((k) => KEEP.test(k.id)) } };
  fs.writeFileSync(`public/assets/region-references/${plan.id}.oprn.json`, JSON.stringify(exported) + "\n");
  fs.copyFileSync(`tiledata/rpg-outdoors/images/${plan.id}.png`, `public/assets/region-references/${plan.id}.png`);
  snapshotMaps[map.id] = map;
  const { id, image, tileSize, tilesPerRow, count, passability, priority, terrain, transparentColor } = tileset;
  snapshotTilesets[id] = { id, image, tileSize, tilesPerRow, count, passability, priority, terrain, ...(transparentColor ? { transparentColor } : {}) };
  const category = references[world ? "easyrpg_chipset_world" : map.tilesetId];
  const docOf = (suffix) => category.documents.find((d) => d.id === plan.id + suffix)?.name;
  const rulesDoc = docOf(""), rowsDoc = docOf("-rows-0");
  assert(rulesDoc && rowsDoc, plan.id + " has no AI documents in " + category.id);
  const spots = plan.bareTreeSpots ?? [];
  entries.push({
    id: `${plan.id}-${map.width}x${map.height}`,
    name: plan.name,
    kind: "completed-place",
    placeKind: SETTLEMENT.has(plan.category) || TOWNISH.has(plan.id) ? "settlement" : "natural",
    revision: 1,
    x: 0,
    y: 0,
    width: map.width,
    height: map.height,
    tilesetId: map.tilesetId,
    preview: `/assets/region-references/${plan.id}.png`,
    tilesetPreview: SHEET[map.tilesetId],
    projectDownload: `/assets/region-references/${plan.id}.oprn.json`,
    sourceProjectId: proof.projectId,
    sourceMapId: map.id,
    snapshotProjectId: `oprn-place-${plan.id}-v1`,
    rules: [
      plan.note + ".",
      world
        ? `월드맵: 장소 아이콘 ${plan.places?.length ?? 0}곳을 흙길로 잇는다. 바다 해안(harness-world-coast-v1-sea)·지형 오토타일(harness-world-v2-terrain-*)은 8방향 이웃으로 고른다.`
        : "출구: " + plan.exits.map((e) => `${SIDE[e.side]}쪽 (${e.x},${e.y}) → ${e.meets}`).join(", ") + ".",
      world
        ? "EasyRPG 월드 칩셋의 아이콘 바탕은 분홍(#ff678b)이다. 내려받기의 oprn_world_keyed 는 그 색을 투명색으로 지정한 사본이다. 기본 easyrpg_chipset_world 에 옮기면 아이콘 둘레가 분홍으로 보인다."
        : `${map.tilesetId === "forest_harmony" ? "숲마을 「다양한 마을」 타일셋(이식 2550~2729)" : `기후 시트 ${map.tilesetId}`}에 그렸다. 지형과 배치만 있다.`,
      world ? "모든 장소가 흙길로 서로 닿는 것을 확인했다." : "입구에서 모든 출구와 집 문 앞까지 런타임 이동 규칙으로 닿는 것을 확인했다.",
      "채우기: 풀·꽃·덤불·바위는 덩이로만 두고 흩뿌리지 않는다. 주인 없는 소품은 두지 않는다. 모래·눈·재·가을 땅에는 키큰 풀을 깔지 않는다.",
      ...(spots.length ? [`잎 없는 나무 자리 ${spots.length}곳(1×2)을 비워 두었다: ${spots.map(([x, y]) => `(${x},${y})`).join(" ")}.`] : []),
      ...(plan.bareGroves?.groves ? [`잎 달린 나무 없이 잎 없는 나무 덩이 ${plan.bareGroves.groves}개(나무 ${plan.bareGroves.trees}그루, 2880~3029, bare-trees:*)를 세웠다.`] : []),
      `공용 AI 문서 「${category.name}」의 「${rulesDoc}」에 쓸 타일 번호·그룹·금지 사항이, 「${rowsDoc}」부터 전체 배열이 있다.`,
    ],
    limitations: "지형·배치 참고 사례. 문 이동·NPC·이벤트는 포함하지 않는다. 자동 생성 프리셋이 아니다.",
  });
}
fs.writeFileSync("src/project/regionReferences/field-routes.json", JSON.stringify({ maps: snapshotMaps, tilesets: snapshotTilesets }) + "\n");
fs.writeFileSync("src/project/fieldRoutePlaceReferences.ts", "// Generated by scripts/content/prepare-field-routes-regions.mjs from a canonical reload.\n// Fields between villages and outdoor places under 장소; snapshots in regionReferences/field-routes.json.\nexport const FIELD_ROUTE_PLACE_REFERENCES = " + JSON.stringify(entries, null, 2) + " as const;\n");
console.log({ places: entries.map((e) => e.id), snapshotBytes: fs.statSync("src/project/regionReferences/field-routes.json").size });
