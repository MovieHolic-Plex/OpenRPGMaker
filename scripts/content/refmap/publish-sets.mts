// REFMAP 세트(_work/<세트>: preset.json + maps/*.json)를 호스트 공용 DB 에 세트마다 라이브러리 하나로 올린다.
// 타일셋(원본 시트를 MV 프리셋으로 구운 합본) → 오브젝트(프리셋 물체 킷 + 맵에서 떼어 낸 집 킷) → 장소(root → 층 장소 → 구획 킷).
// 원본 그림은 저장소에 없다(로컬 사본만 읽는다). 저장소 프리셋은 gen-presets.mts 가 preset.json 에서 만든다.
//
//   bun scripts/content/refmap/publish-sets.mts [--dry] [세트…]
// 결과 증거: tiledata/refmap/<세트>-proof.json, 그림은 _work/<세트>/out/publish/.
import fs from "node:fs";
import path from "node:path";
import { withTsModule } from "../../ontology-ts-loader.mjs";
import { MV_PACK_PRESETS } from "../../../src/project/rpgmakerMv/packs/index.ts";
import { blank, blit, convertSpec, encodePng, loadSet, readMapSpecs, REFMAP_ROOT, render, sha, shrink, T, toPng, type Converted, type LoadedSet, type MapSpec } from "./lib.mts";
import { exampleDoc, exampleImage, placesDoc, rulesDoc } from "./assistantDocs.mts";

/** 조수 참고문서 예시로 쓸 맵. 없으면 가장 작은 맵 하나. 실내는 방 하나짜리와 칸막이 있는 집 둘. */
const EXAMPLES: Record<string, readonly string[]> = { "refmap-interior": ["refmap_poor_rental", "refmap_old_couple_cottage"] };

const DRY = process.argv.includes("--dry");
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sets = (wanted.length ? wanted : fs.readdirSync(path.join(REFMAP_ROOT, "_work")))
  .filter((id) => fs.existsSync(path.join(REFMAP_ROOT, "_work", id, "preset.json")));

/** 2층의 A3(지붕·벽) 덩이 + 그 위 3·4층 칸 = 집 오브젝트. */
function houses(set: LoadedSet, m: Converted) {
  const a3 = new Set<number>();
  for (const [tile, cell] of set.built.layout.cells) if (cell.part === "A3") a3.add(tile);
  const { width: w, height: h } = m;
  const isA3 = m.lowerOverlayTiles.map((t) => a3.has(t));
  const seen = new Array<boolean>(w * h).fill(false);
  const out: { x: number; y: number; w: number; h: number; tiles: number[][]; upper: number[][] }[] = [];
  for (let i = 0; i < w * h; i += 1) {
    if (!isA3[i] || seen[i]) continue;
    const q = [i]; seen[i] = true;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (q.length) {
      const c = q.pop()!, cx = c % w, cy = Math.floor(c / w);
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
        const n = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && isA3[n] && !seen[n]) { seen[n] = true; q.push(n); }
      }
    }
    const top = y0 > 0 && [...Array(x1 - x0 + 1).keys()].some((k) => m.upperTiles[(y0 - 1) * w + x0 + k]! >= 0) ? y0 - 1 : y0;
    const tiles: number[][] = [], upper: number[][] = [];
    for (let y = top; y <= y1; y += 1) {
      tiles.push([]); upper.push([]);
      for (let x = x0; x <= x1; x += 1) {
        const c = y * w + x;
        tiles.at(-1)!.push(isA3[c] ? m.lowerOverlayTiles[c]! : -1);
        upper.at(-1)!.push(m.upperTiles[c]! >= 0 ? m.upperTiles[c]! : m.upperOverlayTiles[c]!);
      }
    }
    if (x1 - x0 + 1 >= 3 && y1 - top + 1 >= 3) out.push({ x: x0, y: top, w: x1 - x0 + 1, h: y1 - top + 1, tiles, upper });
  }
  return out;
}

const results: Record<string, unknown>[] = [];
for (const id of sets) {
  const preset = MV_PACK_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`${id}: 저장소 프리셋이 없다 — 먼저 gen-presets.mts`);
  const slug = id.replace(/-/g, "_");
  const tilesetId = `shared_${slug}`, assetId = `${tilesetId}_atlas`;
  const set = loadSet(id, { preset, tilesetId, assetId, optimize: true });
  const tileset = set.built.tileset as any;
  tileset.name = `${preset.name} (공용)`;
  tileset.family = "refmap";
  tileset.structureKits = [...(tileset.structureKits ?? [])];
  const libraryId = `${id}-local`;
  const lib: Record<string, any> = { version: 1, projectDefaults: true, roots: [], places: {}, tilesets: { [tilesetId]: tileset }, assets: {}, maps: {}, previews: {}, regions: {}, sourceProjectId: libraryId };
  lib.assets[assetId] = { id: assetId, name: tileset.name, kind: "chipset", dataUrl: encodePng(set.built.atlas),
    meta: { tileSize: T, frames: tileset.count, frameWidth: T, frameHeight: T, width: set.built.atlas.width, height: set.built.atlas.height,
      source: `REFMAP 원본 시트 ${preset.sheets.length}장을 MV 프리셋(${preset.id} v${preset.version})으로 구운 합본` } };
  const objectKits = tileset.structureKits.filter((k: any) => k.learnedFrom === "pack-preset");
  for (const k of objectKits) {
    const img = blank(k.width * T, k.height * T);
    k.rows.forEach((row: any, y: number) => row.upperTiles?.forEach((t: number, x: number) => blit(img, set.built.atlas, set.columns, t, x * T, y * T)));
    lib.previews[k.id] = encodePng(img);
  }
  const outDir = path.join(set.dir, "out", "publish");
  fs.mkdirSync(outDir, { recursive: true });
  const proofMaps: Record<string, unknown> = {};
  let houseCount = 0;
  const built: { spec: MapSpec; m: Converted; placeId: string }[] = [];
  for (const spec of readMapSpecs(set)) {
    const m = convertSpec(set, spec);
    if (m.warnings.length) throw new Error(`${id}/${spec.id}: ${m.warnings.join(" · ")}`);
    const full = render(set, m);
    fs.writeFileSync(path.join(outDir, `${spec.id}.png`), toPng(full));
    const w = m.width, h = m.height;
    const mslug = `${slug}_${spec.id.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
    const floor = `shared_floor_${mslug}`, root = `shared_${mslug}`, kit = `raster_${mslug}`;
    const kitLower = m.lowerTiles.map((t, i) => m.lowerOverlayTiles[i]! >= 0 ? m.lowerOverlayTiles[i]! : t);
    const kitUpper = m.upperTiles.map((t, i) => m.upperOverlayTiles[i]! >= 0 ? m.upperOverlayTiles[i]! : t);
    tileset.structureKits.push({ id: kit, name: spec.name, kind: "section", width: w, height: h, tileSize: T,
      rows: Array.from({ length: h }, (_, y) => ({ tiles: kitLower.slice(y * w, (y + 1) * w), upperTiles: kitUpper.slice(y * w, (y + 1) * w) })),
      learnedFrom: "db-authored",
      ai: { description: `${spec.name} 완성 맵 (${w}×${h}). ${spec.note}`, placementRules: "통째로 쓰는 장소 구획. 4층 원본은 층 장소 맵에 있다.",
        role: "terrain", repeatability: "fixed", layerHome: "perCell", tags: ["refmap", "장소"], origin: "ai" } });
    lib.maps[floor] = { id: floor, name: spec.name, width: w, height: h, tileSize: T, tilesetId,
      lowerTiles: m.lowerTiles, upperTiles: m.upperTiles,
      ...(m.lowerOverlayTiles.some((t) => t >= 0) ? { lowerOverlayTiles: m.lowerOverlayTiles } : {}),
      ...(m.upperOverlayTiles.some((t) => t >= 0) ? { upperOverlayTiles: m.upperOverlayTiles } : {}),
      events: [] };
    const houseRows: string[] = [];
    for (const [n, hs] of houses(set, m).entries()) {
      const hid = `shared_${slug}_house_${spec.id}_${n + 1}`;
      const name = `${spec.name} 집 ${houseRows.length + 1} (${hs.w}×${hs.h})`;
      tileset.structureKits.push({ id: hid, kind: "section", name, width: hs.w, height: hs.h, tileSize: T,
        rows: hs.tiles.map((row, y) => ({ tiles: row, upperTiles: hs.upper[y]! })), learnedFrom: "db-authored",
        ai: { description: `${name}. 지붕·벽은 오토타일 모양을 굳힌 칸(아래층), 문·창·굴뚝·간판은 위층.`,
          placementRules: "바닥 위에 통째로 찍는다. 빈 칸(-1)은 원래 칸을 남긴다. 문 앞 한 칸은 길로 비운다.",
          role: "building", repeatability: "fixed", layerHome: "perCell", tags: ["refmap", "집", `원본:${spec.id}`], origin: "ai" } });
      const img = blank(hs.w * T, hs.h * T);
      hs.tiles.forEach((row, y) => row.forEach((t, x) => blit(img, set.built.atlas, set.columns, t, x * T, y * T)));
      hs.upper.forEach((row, y) => row.forEach((t, x) => blit(img, set.built.atlas, set.columns, t, x * T, y * T)));
      lib.previews[hid] = encodePng(img);
      houseRows.push(`| ${name} | \`${hid}\` | ${hs.x}, ${hs.y} |`);
      houseCount += 1;
    }
    const placed = m.objects.map((o) => { const def = preset.objects.find((p) => p.id === o.id)!; return `| ${def.name} | \`${o.id}\` | ${o.x}, ${o.y} |`; });
    const tags = ["그림체:REFMAP", ...spec.tags, `용도:${spec.usage}`];
    const head = { name: spec.name, revision: 1, tags, provenance: { origin: "ai", sourceId: `refmap:${id}:${spec.id}` }, kind: "facility", layout: "manual",
      referenceDocuments: [{ id: `refmap-${mslug}`, name: "구성 메모", description: spec.note, documents: [
        { id: "note", name: "구성.md", markdown: `# ${spec.name}\n\n${spec.note}\n\n타일셋: \`${tilesetId}\` (${preset.pack}, ${preset.author})\n층: 1층 바닥 · 2층 겹침·지붕·벽 · 3층 물체 · 4층 물체 겹침.\n` },
        { id: "objects", name: "배치 오브젝트.md", markdown: `# 배치 오브젝트 (${placed.length})\n\n킷은 \`${tilesetId}\` 의 구조 킷이다(왼쪽 위 칸 좌표).\n\n| 이름 | 킷 | x, y |\n|---|---|---|\n${placed.join("\n") || "| (없음) | | |"}\n` +
          (houseRows.length ? `\n## 이 맵에서 떼어 낸 집 (${houseRows.length})\n\n| 이름 | 킷 | x, y |\n|---|---|---|\n${houseRows.join("\n")}\n` : "") },
      ], images: [] }] };
    const [ex, ey] = spec.entry ?? [Math.floor(w / 2), h - 1];
    lib.places[floor] = { id: floor, ...head, children: [], connections: [], ports: [{ x: ex, y: ey, id: `entry-${mslug}`, name: "입구" }], exterior: { tilesetId, kitId: kit } };
    lib.places[root] = { id: root, ...head, children: [{ id: `child-${mslug}`, source: { kind: "place", id: floor }, x: 0, y: 0, level: 1 }], ports: [], connections: [] };
    lib.roots.push(root);
    lib.previews[floor] = lib.previews[root] = encodePng(shrink(full));
    proofMaps[spec.id] = { place: root, size: `${w}×${h}`, objects: m.objects.length, houses: houseRows.length, renderSha: sha(toPng(full)) };
    built.push({ spec, m, placeId: root });
  }
  // 조수 참고문서: 규칙 · 실제 장소 예시(도시 팩용 빈 예시 블록 대신) · 장소 목록.
  const category = (tileset.referenceDocuments ?? []).find((c: any) => c.id === `mvpack-${preset.id}`);
  if (category && !built.length) {
    // 장소가 없는 세트(MZ 지면): 도시 팩용 빈 예시 블록만 빼고 규칙을 둔다.
    category.description = `${preset.pack} 재료 이름·규칙. 칠하기 전에 전부 읽는다.`;
    category.documents = category.documents.filter((d: any) => d.id !== "example");
    category.documents.splice(category.documents.findIndex((d: any) => d.id === "guide") + 1, 0, { id: "rules", name: "규칙", markdown: rulesDoc(preset.id) });
    category.images = category.images.filter((img: any) => img.id !== "example-block");
  }
  if (category && built.length) {
    const picks = (EXAMPLES[id] ?? []).map((mapId) => built.find((b) => b.spec.id === mapId)).filter((b): b is (typeof built)[number] => !!b);
    if (!picks.length) picks.push([...built].sort((a, b) => a.spec.w * a.spec.h - b.spec.w * b.spec.h)[0]!);
    category.description = `${preset.pack} 을 까는 순서·규칙·재료 이름·물체 id·완성 장소 예시와 목록. 칠하기 전에 전부 읽는다.`;
    const docs = category.documents.filter((d: any) => d.id !== "example");
    const at = docs.findIndex((d: any) => d.id === "guide") + 1;
    docs.splice(at, 0, { id: "rules", name: "규칙", markdown: rulesDoc(preset.id) });
    docs.splice(docs.findIndex((d: any) => d.id === "pack"), 0,
      ...picks.map((b, n) => ({ id: n ? `example-${n + 1}` : "example", name: `예시 ${b.spec.name}`, markdown: exampleDoc(set, b.spec, b.m, b.placeId) })),
      { id: "places", name: "장소 목록", markdown: placesDoc(built.map((b) => ({ placeId: b.placeId, spec: b.spec }))) });
    category.documents = docs;
    category.images = [...category.images.filter((img: any) => img.id !== "example-block"),
      ...picks.map((b, n) => ({ id: n ? `example-${n + 1}` : "example-block", name: `예시 ${b.spec.name} ${b.spec.w}×${b.spec.h}`,
        caption: `「예시 ${b.spec.name}」 문서의 배열을 그대로 그린 것. ${b.spec.note}`, dataUrl: exampleImage(set, b.m) }))];
  }
  const bytes = JSON.stringify(lib).length;
  if (bytes > 60 * 1024 * 1024) throw new Error(`${id}: library too large ${bytes}`);
  const summary = { id: libraryId, tileset: tilesetId, tiles: tileset.count, atlas: `${set.built.atlas.width}×${set.built.atlas.height}`,
    places: lib.roots.length, objectKits: objectKits.length, houseKits: houseCount, autotileGroups: tileset.autotileGroups?.length, bytes, maps: proofMaps };
  console.log(JSON.stringify(summary));
  if (DRY) { results.push(summary); continue; }
  await withTsModule("scripts/lib/sharedContentSqlite.ts", "publish-refmap-sets.mts", async (api: any) => {
    const { DatabaseSync } = await import("node:sqlite");
    const file = api.sharedContentFile();
    const snapshot = (db: any) => Object.fromEntries(db.prepare("SELECT id, revision, payload FROM content_libraries").all().map((r: any) => [r.id, { revision: r.revision, sha: sha(r.payload) }]));
    let db = new DatabaseSync(file, { readOnly: true });
    const before = snapshot(db);
    db.close();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path.join(path.dirname(file), "backups", `shared-content-before-${id}-${stamp}.sqlite`);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    db = new DatabaseSync(file, { readOnly: true }); db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`); db.close();
    const receipt = api.publishSharedContent(libraryId, lib, before[libraryId]?.revision ?? null);
    const reloaded = JSON.stringify(api.readSharedContent().libraries[libraryId]) === JSON.stringify(lib);
    if (!reloaded) throw new Error(`${id}: reloaded library differs`);
    db = new DatabaseSync(file, { readOnly: true });
    const after = snapshot(db); db.close();
    const others = Object.keys(before).filter((k) => k !== libraryId);
    const changed = others.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (changed.length) throw new Error(`other libraries changed: ${changed.join(", ")}`);
    const proof = { ...summary, file: receipt.file, revision: receipt.revision, reloaded, backup, otherLibraries: others.length, otherLibrariesUnchanged: true, publishedAt: new Date().toISOString() };
    fs.mkdirSync("tiledata/refmap", { recursive: true });
    fs.writeFileSync(`tiledata/refmap/${id}-proof.json`, JSON.stringify(proof, null, 2) + "\n");
    results.push(proof);
  });
}
console.log(JSON.stringify(results.map((r: any) => ({ id: r.id, revision: r.revision?.slice?.(0, 12), places: r.places, bytes: r.bytes }))));
