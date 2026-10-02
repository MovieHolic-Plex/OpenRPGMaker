// 조선 칩셋 맵(tiledata/joseon-village/maps/*.json, build-joseon-tileset.py 산출)을 임시 정본 폴더(SQLite)에 저장 → 다시 열어 재로드가 같은지 증명 →
// 엔진 통행(isPassable/canMove)·오토타일 마스크가 구운 정답과 맞는지 센다.
//   node scripts/content/save-joseon-baram.mjs [맵id ...]          (기본: maps/ 의 모든 맵)
// 저장 폴더: JOSEON_SAVE_DIR (기본 /tmp/oprn-joseon-baram-proof — 사용자의 실제 프로젝트 폴더가 아니다). LegacyDb/Supabase 에는 쓰지 않는다.
// 증거: tiledata/joseon-village/storage-proof.json
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";

const DATA = "tiledata/joseon-village";
const dir = process.env.JOSEON_SAVE_DIR || path.join(os.tmpdir(), "oprn-joseon-baram-proof");
const want = process.argv.slice(2);
const files = fs.readdirSync(`${DATA}/maps`).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).filter((id) => !want.length || want.includes(id));
assert(files.length, "no maps in " + DATA + "/maps");
const srcMaps = files.map((id) => JSON.parse(fs.readFileSync(`${DATA}/maps/${id}.json`, "utf8")));
const allowedMismatch = fs.existsSync(`${DATA}/expected-mismatch.json`) ? JSON.parse(fs.readFileSync(`${DATA}/expected-mismatch.json`, "utf8")) : {};
const equiv = JSON.parse(fs.readFileSync(`${DATA}/autotile-equiv.json`, "utf8"));
const DIRS = { up: "up", right: "right", down: "down", left: "left" };
const LINES = ["어서 오시게. 큰길 건너 강을 따라 올라가면 방앗간이 있네.", "양반댁 대문은 늘 닫혀 있지. 사랑채에는 훈장님이 계시네.", "다리 위에서 보는 강이 제일 곱지.",
  "논에 물을 대려면 연못 쪽 도랑을 열어야 하오.", "주막 평상에서 국밥이나 한 그릇 하시구려.", "장승 앞을 지나거든 허리를 숙이게."];

const NPC_SHEET = "tex_easyrpg_charset_actor1";

function checkWalk(api, p, map, src) {
  let same = 0; const diff = [];
  for (let y = 0; y < src.height; y += 1) for (let x = 0; x < src.width; x += 1) {
    const a = api.isPassable(p, map, x, y), b = src.walk[y][x] === "1";
    if (a === b) same += 1; else diff.push([x, y, b]);
  }
  return { cells: src.width * src.height, same, mismatch: diff.length, samples: diff.slice(0, 10), walkable: src.walk.join("").split("1").length - 1 };
}

function reach(api, p, map, start) {
  const seen = new Set([start.join(",")]); const q = [start];
  for (let i = 0; i < q.length; i += 1) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + "," + ny;
      if (seen.has(k) || !api.canMove(p, map, x, y, nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

function checkReach(api, p, map, src) {
  const seen = reach(api, p, map, src.start), at = (x, y) => seen.has(x + "," + y);
  const miss = { doorFront: [], doorStep: [], passageFront: [], passageBehind: [], people: [] };
  for (const d of src.doors) {
    if (!at(d.x, d.y)) miss.doorFront.push([d.x, d.y, d.piece]);
    if (d.step && !at(d.step[0], d.step[1])) miss.doorStep.push([d.step[0], d.step[1], d.piece]);
  }
  for (const g of src.passages) {
    for (const c of g.cols) {
      if (!at(c, g.front)) miss.passageFront.push([c, g.front, g.piece]);
      if (g.behind >= 0 && api.isPassable(p, map, c, g.behind) && !at(c, g.behind)) miss.passageBehind.push([c, g.behind, g.piece]);
    }
  }
  for (const n of src.people) if (!at(n.x, n.y)) miss.people.push([n.x, n.y]);
  // negative control: a wall cell of every door's building (row above the step) must stay blocked
  const gatePieces = new Set(src.passages.map((g) => g.piece));
  const wallOpen = src.doors.filter((d) => d.step && !gatePieces.has(d.piece) && api.canMove(p, map, d.step[0], d.step[1] - 1, d.step[0], d.step[1] - 2)).length;
  const walkableTotal = src.walk.join("").split("1").length - 1;
  return { start: src.start, reachable: seen.size, walkable: walkableTotal, missed: miss, missedCount: Object.values(miss).reduce((a, b) => a + b.length, 0), wallAboveDoorOpen: wallOpen };
}

function checkMasks(api, p, map, ts) {
  const view = api.autotileLayerView(map, 1), out = [];
  for (const g of ts.autotileGroups) {
    const eq = equiv[g.id] || {}, members = new Set(g.memberTileIds);
    let cells = 0, mismatch = 0; const samples = [];
    for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
      const t = map.lowerTiles[y * map.width + x];
      if (!members.has(t)) continue;
      cells += 1;
      const v = api.autotileVariantForCell(view, g, x, y);
      if ((eq[v] ?? v) !== (eq[t] ?? t)) { mismatch += 1; if (samples.length < 12) samples.push([x, y]); }
    }
    out.push({ group: g.id, cells, mismatch, edgeConnects: g.edgeConnects === true, samples });
  }
  return out;
}

let verify = null;
const project = await withTsModule("scripts/content/lib/joseon-baram-entry.ts", "joseon-save.mjs", async (api) => {
  const p = api.createBlankProject();
  api.ensureBundledTilesets(p);
  const ts = p.tilesets[api.JOSEON_BARAM_ID];
  assert(ts, "blank project lacks joseon_baram (bundled.ts / defaultAssets.ts)");
  assert.equal(api.tilesetFamily(p, ts.id), "oprn-joseon");
  assert.equal(ts.passability.length, ts.count);
  assert.equal(ts.tileMeta.length, ts.count);
  // 참고문서: 프로젝트 저장 검증기(validateTilesetReferences)를 통과하고, 그림은 /assets 경로뿐이며(바이트 0), 파일이 실제로 있다.
  api.validateTilesetReferences(ts.referenceDocuments);
  const refImages = ts.referenceDocuments.flatMap(c => c.images);
  assert(ts.referenceDocuments.length >= 6 && refImages.length > 0, "참고문서 용도 6개 이상");
  for (const img of refImages) {
    assert(api.isBundledReferenceImage(img.dataUrl), `번들 경로가 아닌 그림: ${img.name}`);
    assert(fs.existsSync(path.join("public", img.dataUrl)), `그림 파일 없음: ${img.dataUrl}`);
  }
  console.log(`references ok: ${ts.referenceDocuments.length} categories, ${ts.referenceDocuments.reduce((n, c) => n + c.documents.length, 0)} docs, ${refImages.length} images (paths only)`);
  // 기존 프로젝트 보강: 타일셋이 없거나, 옛(칸이 적은) 사본이거나, 참고문서·부품이 비었을 때 ensureBundledTilesets 가 번들 것으로 채우는가
  const fresh = api.createJoseonBaramTileset();
  const ensureProof = {};
  {
    const q = structuredClone(p); delete q.tilesets[ts.id]; api.ensureBundledTilesets(q);
    ensureProof.missingTilesetRestored = isDeepStrictEqual(q.tilesets[ts.id], fresh);
    const o = structuredClone(p), t = o.tilesets[ts.id], n = t.count - 160;
    t.count = n; t.passability.length = n; t.priority.length = n; t.terrain.length = n; t.tileMeta.length = n; t.structureKits = t.structureKits.slice(0, 5); t.referenceDocuments = [];
    api.ensureBundledTilesets(o);
    ensureProof.oldShortCopyRestored = o.tilesets[ts.id].count === fresh.count && isDeepStrictEqual(o.tilesets[ts.id].passability, fresh.passability) && isDeepStrictEqual(o.tilesets[ts.id].structureKits, fresh.structureKits);
    const r = structuredClone(p); r.tilesets[ts.id].referenceDocuments = []; r.tilesets[ts.id].structureKits.push({ id: "author-kit", kind: "section", width: 1, height: 1, rows: [{ tiles: [0], upperTiles: [-1] }], learnedFrom: "user" });
    r.tilesets[ts.id].structureKits = r.tilesets[ts.id].structureKits.filter((k) => k.id !== "jb-well");
    api.ensureBundledTilesets(r);
    ensureProof.sameCountReferencesRestored = isDeepStrictEqual(r.tilesets[ts.id].referenceDocuments, fresh.referenceDocuments);
    ensureProof.sameCountKitMergedAuthorKept = r.tilesets[ts.id].structureKits.some((k) => k.id === "author-kit") && r.tilesets[ts.id].structureKits.some((k) => k.id === "jb-well");
    const again = structuredClone(r); ensureProof.idempotent = api.ensureBundledTilesets(again) === false || isDeepStrictEqual(again, r);
    for (const [k, v] of Object.entries(ensureProof)) assert(v, "ensure 증명 실패: " + k);
  }
  p.maps = {}; p.mapTree = { mapId: srcMaps[0].id, children: [] };
  const checks = {};
  for (const src of srcMaps) {
    const events = src.people.map((n, i) => ({
      id: `ev_${src.id}_npc_${i + 1}`, name: `${src.name} 주민 ${i + 1}`, placementRole: "npc", x: n.x, y: n.y, trigger: { kind: "action" }, commands: [],
      pages: [{ id: `ev_${src.id}_npc_${i + 1}_p`, name: "주민", conditions: [],
        graphic: { sprite: { type: "bundled", id: NPC_SHEET }, direction: DIRS[n.dir], pattern: api.charsetFrameIndex({ characterIndex: n.char, direction: DIRS[n.dir], pattern: n.frame }) },
        trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", speaker: "마을 사람", body: LINES[i % LINES.length] }] }],
    }));
    p.maps[src.id] = { id: src.id, name: src.name, width: src.width, height: src.height, tilesetId: ts.id, tileSize: 16, lowerTiles: src.lowerTiles, upperTiles: src.upperTiles, events };
    if (src.id !== srcMaps[0].id) p.mapTree.children.push({ mapId: src.id, children: [] });
    const map = p.maps[src.id];
    checks[src.id] = { walk: checkWalk(api, p, map, src), reach: checkReach(api, p, map, src), masks: checkMasks(api, p, map, ts) };
  }
  p.startMapId = srcMaps[0].id; p.startPos = { x: srcMaps[0].start[0], y: srcMaps[0].start[1] };
  p.meta.title = "조선 칩셋 증명 프로젝트 (임시)";
  verify = checks; verify.__ensure = ensureProof; delete checks.__ensure;
  verify = { ...checks, __ensure: ensureProof };
  for (const [mid, c] of Object.entries(checks).filter(([k]) => k !== "__ensure")) {
    assert.equal(c.walk.mismatch, 0, `${mid}: 엔진 통행이 구운 정답과 다르다`);
    assert.equal(c.reach.missedCount, 0, `${mid}: 도달하지 못하는 문 앞·디딤돌·통로·주민 칸이 있다: ${JSON.stringify(c.reach.missed)}`);
    assert.equal(c.reach.wallAboveDoorOpen, 0, `${mid}: 문 위 벽이 열려 있다`);
    for (const m of c.masks) {
      const max = allowedMismatch[mid]?.[m.group]?.max ?? 0;
      assert(m.mismatch <= max, `${mid}: ${m.group} 마스크 불일치 ${m.mismatch} > 허용 ${max}: ${JSON.stringify(m.samples)}`);
    }
  }
  return JSON.parse(JSON.stringify(p));
});

await withTsModule("electron/local-store/store.ts", "joseon-store.mjs", async (api) => {
  let s = await api.initLocalProjectStore({ projectDir: dir }), id;
  try {
    const before = s.loadSnapshot();
    id = s.info().projectId;
    const r = await s.saveSerialized(JSON.stringify(project), before?.sha256 ?? null);
    assert.equal(r.kind, "saved");
  } finally { s.close(); }
  s = await api.openLocalProjectStore({ projectDir: dir });
  try {
    const a = s.loadSnapshot();
    const reloaded = JSON.parse(JSON.stringify(a.project));
    // 전체 프로젝트 deepEqual 은 맵·타일셋 밖의 저장소 정규화(예: database.actors[*].characterIndex 0 → 생략)에 걸릴 수 있다.
    // 증명 대상인 맵·타일셋은 엄격하게, 그 밖은 첫 차이 경로를 증거에 남긴다.
    const walkDiff = (x, y, p) => { if (isDeepStrictEqual(x, y)) return null; if (x && y && typeof x === "object" && typeof y === "object") { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) { const r = walkDiff(x[k], y[k], p + "." + k); if (r) return r; } return null; } return p + ": " + JSON.stringify(x)?.slice(0, 60) + " != " + JSON.stringify(y)?.slice(0, 60); };
    const strip = (pr) => ({ ...pr, maps: undefined, tilesets: undefined });
    const outsideDiff = walkDiff(strip(reloaded), strip(project), "project");
    const projectEqual = isDeepStrictEqual(reloaded, project);
    const ts = reloaded.tilesets.joseon_baram;
    for (const m of srcMaps) assert(isDeepStrictEqual(reloaded.maps[m.id], project.maps[m.id]), "map differs: " + m.id);
    assert(isDeepStrictEqual(ts, project.tilesets.joseon_baram));
    // re-run the walk check on the RELOADED project through the engine
    const again = {};
    await withTsModule("scripts/content/lib/joseon-baram-entry.ts", "joseon-reload.mjs", async (eng) => {
      for (const src of srcMaps) again[src.id] = checkWalk(eng, reloaded, reloaded.maps[src.id], src);
    });
    const proof = { projectId: id, projectDir: dir, note: "임시 증명 폴더(사용자의 실제 프로젝트 아님)", revision: a.revision, sha256: a.sha256, saved: true, reopened: true,
      deepEqual: { project: projectEqual, maps: true, tileset: true }, outsideMapsAndTilesetsFirstDiff: outsideDiff,
      tileset: { id: ts.id, family: ts.family, count: ts.count, tilesPerRow: ts.tilesPerRow, image: ts.image, structureKits: ts.structureKits.length,
        tileGroups: ts.tileGroups.length, autotileGroups: ts.autotileGroups.map((g) => g.id),
        referenceDocuments: (ts.referenceDocuments || []).map((d) => ({ id: d.id, docs: d.documents.length, images: d.images.length })) },
      maps: Object.fromEntries(srcMaps.map((m) => { const mm = reloaded.maps[m.id]; return [m.id, { size: [mm.width, mm.height], lower: mm.lowerTiles.filter((t) => t >= 0).length,
        upper: mm.upperTiles.filter((t) => t >= 0).length, npcs: mm.events.length }]; })),
      engineChecks: Object.fromEntries(Object.entries(verify).filter(([k]) => k !== "__ensure")), existingProjectEnsure: verify.__ensure, walkAfterReload: again };
    fs.writeFileSync(`${DATA}/storage-proof.json`, JSON.stringify(proof, null, 1) + "\n");
    console.log(JSON.stringify({ projectId: id, dir, revision: a.revision, sha256: a.sha256, tileset: proof.tileset.count,
      ensure: verify.__ensure, checks: Object.fromEntries(Object.entries(verify).filter(([k]) => k !== "__ensure").map(([k, v]) => [k, { walkMismatch: v.walk.mismatch, reachable: `${v.reach.reachable}/${v.reach.walkable}`, missed: v.reach.missedCount,
        masks: v.masks.map((m) => `${m.group}:${m.mismatch}/${m.cells}`) }])), walkAfterReload: again }));
  } finally { s.close(); }
});
