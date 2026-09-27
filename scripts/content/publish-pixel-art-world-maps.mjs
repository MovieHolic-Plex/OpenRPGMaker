// Publish the 51 Pixel Art World maps (scripts/content/paw-maps) to the host shared-content SQLite (공용 DB)
// in the editor's native model: tilesets → objects (tileGroups + structureKits) → places.
//
// 에디터 맵은 타일셋 하나만 쓴다(GameMap.tilesetId). 그래서 맵을 네 무리(외부·가정·시설·특수)로 나누고 무리마다
// 합본 타일셋 하나를 둔다. 합본은 맵이 쓴 원본 PAW 시트를 통째 블록으로 싣는다(칸 번호 = 블록 첫 칸 + 원본 칸 번호).
// 원본 시트가 이미 공용 PAW 타일셋으로 있으면 그 타일셋의 통행·층·칸 설명을 그대로 가져오고 참조를 남긴다.
// 가구·소품은 오브젝트(구조 킷 + 타일 그룹, 미리보기·위층 배치)로, 맵은 장소(root → 층 장소 → 구획 킷)로 올린다.
//
// Input: output/paw-maps-pack.json (gitignored; `python3 scripts/content/paw-maps/pack.py` builds it from the
// user's own PAW downloads, so no pixels live in Git). Writes tiledata/pixel-art-world/maps-shared-library-proof.json.
// Usage: node scripts/content/publish-pixel-art-world-maps.mjs [--dry]
import fs from "node:fs";
import crypto from "node:crypto";
import { withTsModule } from "../ontology-ts-loader.mjs";

const LIBRARY_ID = "pixel-art-world-maps-51-local";
const DRY = process.argv.includes("--dry");
const pack = JSON.parse(fs.readFileSync("output/paw-maps-pack.json", "utf8"));
const blocked = { up: false, down: false, left: false, right: false };
const open = { up: true, down: true, left: true, right: true };
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

const lib = { version: 1, projectDefaults: true, roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, previews: {}, regions: {},
  sourceProjectId: LIBRARY_ID };
const counts = { tilesets: 0, tiles: 0, sharedSheets: 0, objects: 0, places: 0 };

for (const g of pack.groups) {
  const tilesetId = `shared_paw51_${g.key}`, imageId = `${tilesetId}_image`;
  const tiles = g.tiles;
  const sheetDoc = g.sheets.map((s) => `| ${s.sheet} | ${s.firstTile} | ${s.width}×${s.height} | ${s.sharedTileset ? `\`${s.sharedTileset}\`` : "새 시트"} |`).join("\n");
  const tileset = {
    id: tilesetId, name: `Pixel Art World · 맵51 ${g.name}`, kind: "custom", family: "pixel-art-world",
    image: { type: "uploaded", id: imageId }, tileSize: 32, tilesPerRow: g.cols, count: g.count,
    passability: tiles.map((t) => t.passability ?? (t.passage === "solid" ? blocked : open)),
    priority: tiles.map((t) => t.priority ?? t.layer),
    terrain: Array(g.count).fill(0),
    tileMeta: tiles.map((t) => ({ ...(t.meta ?? {}), label: t.meta?.label && t.meta.label !== "미검토" ? `${t.label} · ${t.meta.label}` : t.label,
      description: t.meta?.description ? `${t.description}. ${t.meta.description}` : t.description,
      defaultLayer: t.meta?.defaultLayer ?? t.layer, passage: t.passage, source: t.source })),
    tileGroups: [], autotileGroups: g.autotiles.map((a) => ({ id: a.id, name: a.name, neighborhood: 8, memberTileIds: a.memberTileIds, variantMap: a.variantMap })),
    structureKits: [],
    referenceDocuments: [{ id: `${tilesetId}-sheets`, name: "원본 시트와 칸 번호", description: "합본 안 원본 PAW 시트 블록 위치와 같은 공용 타일셋",
      documents: [{ id: "sheets", name: "원본 시트.md", markdown:
        `# ${tileset_name(g)}\n\n원본 시트를 통째 블록으로 싣는다. 합본 칸 번호 = 첫 칸 + 원본 칸의 (행 × ${g.cols}) + 열.\n` +
        `공용 타일셋이 있는 시트는 그 타일셋의 통행·층·칸 설명을 그대로 쓴다.\n` +
        `${g.pieces.firstRow}행부터 ${g.pieces.count}칸은 격자에 맞지 않는 원본 조각(문·가구·합성, 32px 로 자름)이다.\n\n` +
        `| 원본 시트 | 첫 칸 | 크기(칸) | 같은 공용 타일셋 |\n|---|---|---|---|\n${sheetDoc}\n` }], images: [] }],
  };
  lib.tilesets[tilesetId] = tileset;
  lib.assets[imageId] = { id: imageId, name: tileset.name, kind: "chipset", dataUrl: g.atlas,
    meta: { tileSize: 32, width: g.width, height: g.height, frameWidth: 32, frameHeight: 32, frames: g.count } };
  counts.tilesets += 1; counts.tiles += g.count; counts.sharedSheets += g.sheets.filter((s) => s.sharedTileset).length;

  // 오브젝트: 맵에 찍힌 가구·소품·건물 하나하나 (그림이 같으면 하나)
  const objKit = {};
  for (const o of g.objects) {
    const kitId = `shared_paw51_obj_${o.id}`;
    const role = o.kind === "build" ? "building" : "prop";
    const hintLine = o.hint?.code ? `원본 맵 ${o.hint.map}:${o.hint.line} \`${o.hint.code}\`` : "";
    const description = `${o.name}. ${o.width}×${o.height}칸, 위층에 찍는다. 쓰인 맵 ${o.maps.length}곳(${o.uses}번).`;
    tileset.structureKits.push({ id: kitId, kind: "section", name: o.name, width: o.width, height: o.height, tileSize: 32,
      rows: o.upper.map((row) => ({ tiles: row.map(() => -1), upperTiles: row })), learnedFrom: "db-authored",
      ai: { description, placementRules: "아래층 바닥은 그대로 두고 위층에만 찍는다. 빈 칸(-1)은 원래 칸을 남긴다.",
        role, repeatability: "fixed", layerHome: "upper", tags: ["paw51", `원본:${o.source}`, `종류:${o.kind}`], origin: "ai" } });
    tileset.tileGroups.push({ id: `paw51-${o.id}`, name: o.name, role, defaultLayer: "upper", layerHome: "upper",
      tileIds: [...new Set(o.upper.flat().filter((i) => i >= 0))], description: `${description} ${hintLine}`.trim(),
      placementRules: "위층 오브젝트. 같은 모양 그대로 찍는다.", source: "imported", origin: "ai", confidence: "high",
      previewMap: { width: o.width, height: o.height, lowerTiles: Array(o.width * o.height).fill(-1), upperTiles: o.upper.flat() } });
    lib.previews[kitId] = o.preview;
    objKit[o.id] = { kitId, name: o.name };
    counts.objects += 1;
  }

  // 장소: 맵 하나 = root 장소 → 층 장소(구획 킷 = 아래층 + 위층) + 전체 맵(위층 겹침 포함)
  for (const m of g.maps) {
    const slug = m.id.replace(/[^a-z0-9]+/g, "_");
    const floor = `shared_floor_paw51_${slug}`, root = `shared_paw51_${slug}`, kit = `raster_paw51_${slug}`;
    const w = m.width, h = m.height;
    tileset.structureKits.push({ id: kit, name: m.name, kind: "section", width: w, height: h, tileSize: 32,
      rows: Array.from({ length: h }, (_, y) => ({ tiles: m.lowerTiles.slice(y * w, (y + 1) * w), upperTiles: m.placeUpperTiles.slice(y * w, (y + 1) * w) })),
      learnedFrom: "db-authored",
      ai: { description: `${m.name} 완성 맵 (${w}×${h}). ${m.note}`, placementRules: "통째로 쓰는 장소 구획. 오브젝트 목록은 장소 참고문서에 있다.",
        role: m.kind === "interior" ? "building" : "terrain", repeatability: "fixed", layerHome: "perCell", tags: ["paw51", "장소"], origin: "ai" } });
    lib.maps[floor] = { id: floor, name: m.name, width: w, height: h, tileSize: 32, tilesetId,
      lowerTiles: m.lowerTiles, upperTiles: m.upperTiles,
      ...(Object.keys(m.upperTileStacks).length ? { upperTileStacks: Object.fromEntries(Object.entries(m.upperTileStacks).map(([k, v]) => [Number(k), v])) } : {}),
      events: [] };
    const placed = m.objects.map((p) => `| ${objKit[p.object].name} | \`${objKit[p.object].kitId}\` | ${p.x}, ${p.y} |`).join("\n");
    const tags = ["그림체:Pixel Art World", ...m.tags, `용도:${m.usage}`];
    const head = { name: m.name, revision: 1, tags, provenance: { origin: "ai", sourceId: m.id }, kind: "facility", layout: "manual",
      referenceDocuments: [{ id: `paw51-${slug}`, name: "구성 메모", description: m.note || m.name,
        documents: [
          { id: "note", name: "구성.md", markdown: `# ${m.name}\n\n${m.note}\n\n타일셋: \`${tilesetId}\`\n사용 시트: ${m.sheets.join(", ")}\n` },
          { id: "objects", name: "배치 오브젝트.md", markdown: `# 배치 오브젝트 (${m.objects.length})\n\n위층에 찍힌 오브젝트와 왼쪽 위 칸 좌표. 킷은 \`${tilesetId}\` 의 구조 킷이다.\n\n| 이름 | 킷 | x, y |\n|---|---|---|\n${placed}\n` },
        ], images: [] }] };
    lib.places[floor] = { id: floor, ...head, children: [], connections: [],
      ports: [{ x: m.port.x, y: m.port.y, id: `entry-${slug}`, name: "입구" }], exterior: { tilesetId, kitId: kit } };
    lib.places[root] = { id: root, ...head, children: [{ id: `child-${slug}`, source: { kind: "place", id: floor }, x: 0, y: 0, level: 1 }],
      ports: [], connections: [] };
    lib.roots.push(root);
    lib.previews[floor] = lib.previews[root] = m.preview;
    counts.places += 1;
  }
}
function tileset_name(g) { return `Pixel Art World · 맵51 ${g.name}`; }

const summary = { id: LIBRARY_ID, ...counts, placeRecords: Object.keys(lib.places).length,
  tilesetIds: Object.keys(lib.tilesets), atlasSha: Object.fromEntries(pack.groups.map((g) => [g.key, g.atlasSha])),
  rebuildMaxChannelDiff: pack.rebuildMaxChannelDiff ?? null,
  maps: Object.fromEntries(pack.groups.flatMap((g) => g.maps.map((m) => [m.id, `${m.width}×${m.height} · shared_paw51_${g.key}`]))),
  bytes: JSON.stringify(lib).length };
if (DRY) { console.log(JSON.stringify({ ...summary, maps: undefined }, null, 1)); process.exit(0); }

await withTsModule("scripts/lib/sharedContentSqlite.ts", "publish-paw-maps.mjs", async (api) => {
  const { DatabaseSync } = await import("node:sqlite");
  const file = api.sharedContentFile();
  const snapshot = (db) => Object.fromEntries(db.prepare("SELECT id, revision, payload FROM content_libraries").all().map((r) => [r.id, { revision: r.revision, sha: sha(r.payload) }]));
  let db = new DatabaseSync(file, { readOnly: true });
  const before = snapshot(db);
  const expected = before[LIBRARY_ID]?.revision ?? null;
  db.close();
  // 게시 전 사본 (되돌리기용)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = file.replace(/[^/]+$/, `backups/shared-content-before-paw51-native-${stamp}.sqlite`);
  fs.mkdirSync(backup.replace(/[^/]+$/, ""), { recursive: true });
  db = new DatabaseSync(file, { readOnly: true }); db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`); db.close();
  const receipt = api.publishSharedContent(LIBRARY_ID, lib, expected);
  const again = api.readSharedContent().libraries[LIBRARY_ID];
  const reloaded = JSON.stringify(again) === JSON.stringify(lib);
  if (!reloaded) throw new Error("reloaded library differs from the published one");
  db = new DatabaseSync(file, { readOnly: true });
  const after = snapshot(db); db.close();
  const others = Object.keys(before).filter((id) => id !== LIBRARY_ID);
  const changedOthers = others.filter((id) => JSON.stringify(before[id]) !== JSON.stringify(after[id]));
  if (changedOthers.length) throw new Error(`other libraries changed: ${changedOthers.join(", ")}`);
  const proof = { ...summary, file: receipt.file, revision: receipt.revision, reloaded, backup,
    otherLibraries: others.length, otherLibrariesUnchanged: true, publishedAt: new Date().toISOString() };
  fs.writeFileSync("tiledata/pixel-art-world/maps-shared-library-proof.json", JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify({ id: LIBRARY_ID, revision: receipt.revision, ...counts, bytes: summary.bytes, reloaded, otherLibraries: others.length, backup }));
});
