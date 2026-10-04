// 조선 칩셋 맵(tiledata/joseon-village/maps/*.json, build-joseon-tileset.py 산출)을 임시 정본 폴더(SQLite)에 저장 → 다시 열어 재로드가 같은지 증명 →
// 엔진 통행(isPassable/canMove)·오토타일 마스크가 구운 정답과 맞는지 센다.
//   node scripts/content/save-joseon-baram.mjs [맵id ...]          (기본: maps/ 의 모든 맵)
// 저장 폴더: JOSEON_SAVE_DIR (기본 /tmp/oprn-joseon-baram-proof — 사용자의 실제 프로젝트 폴더가 아니다). LegacyDb/Supabase 에는 쓰지 않는다.
// 증거: tiledata/joseon-village/storage-proof.json
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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

// 새 맵을 처음 합칠 때는 JOSEON_REPORT_ONLY=1 로 실패를 멈춤 없이 전부 보고받는다(저장·재로드 증명은 그대로 이어진다)
const REPORT_ONLY = process.env.JOSEON_REPORT_ONLY === "1";
function must(cond, msg) { if (cond) return; if (REPORT_ONLY) console.log("FAIL", msg); else assert.fail(msg); }

const NPC_SHEET = "tex_easyrpg_charset_actor1";

function checkWalk(api, p, map, src) {
  let same = 0; const diff = [];
  for (let y = 0; y < src.height; y += 1) for (let x = 0; x < src.width; x += 1) {
    const a = api.isPassable(p, map, x, y), b = src.walk[y][x] === "1";
    if (a === b) same += 1; else diff.push([x, y, b]);
  }
  return { cells: src.width * src.height, same, mismatch: diff.length, samples: diff.slice(0, 10), walkable: src.walk.join("").split("1").length - 1 };
}

function reach(api, p, map, start, box) {
  const seen = new Set([start.join(",")]); const q = [start];
  for (let i = 0; i < q.length; i += 1) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + "," + ny;
      if (seen.has(k) || (box && (nx < box.x0 || nx > box.x1 || ny < box.y0 || ny > box.y1)) || !api.canMove(p, map, x, y, nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

function checkReach(api, p, map, src, waterMembers) {
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
  // 건너는 곳(다리·측면 성문·대문 통로): 조각 둘레 상자 안에서만 걸어 한쪽 끝에서 반대쪽 끝에 닿아야 한다(다른 길로 돌아가는 것은 인정하지 않는다)
  miss.crossEnd = []; miss.crossing = []; miss.front = [];
  let crossLines = 0, crossLinesBlockedEnd = 0;
  const exempt = allowedMismatch[src.id]?._crossings || [];
  const info = { exemptCrossings: [], exemptPeople: [], crossingDetail: [] };
  for (const c of src.crossings || []) {
    // 줄마다 양끝 칸이 걸을 수 있으면 조각 둘레 상자 안에서만 걸어 반대쪽 끝에 닿아야 한다(다른 길로 돌아가는 것은 인정하지 않는다).
    // 양끝 중 한쪽이 막힌 줄(기둥·벽에 닿은 가장자리 줄)은 세지 않되, 건너는 곳 하나에 건널 수 있는 줄이 하나도 없으면 실패다.
    let okLines = 0, tested = 0, edgeLines = 0;
    for (const ln of c.lines) {
      // 지도 가장자리에 붙은 문루(사냥터 북문 등): 지도 밖 한쪽 끝은 출구이므로 조각 안의 가장자리 칸을 끝으로 본다.
      const inMap = (q) => [Math.min(Math.max(q[0], 0), map.width - 1), Math.min(Math.max(q[1], 0), map.height - 1)];
      const a = inMap(c.axis === "h" ? [c.x - 1, ln] : [ln, c.y + c.h]), b = inMap(c.axis === "h" ? [c.x + c.w, ln] : [ln, c.y - 1]);
      const box = c.axis === "h" ? { x0: c.x - 1, x1: c.x + c.w, y0: c.y, y1: c.y + c.h - 1 } : { x0: c.x, x1: c.x + c.w - 1, y0: c.y - 1, y1: c.y + c.h };
      if (a[0] < 0 || a[1] < 0 || b[0] < 0 || b[1] < 0 || a[0] >= map.width || a[1] >= map.height || b[0] >= map.width || b[1] >= map.height) { edgeLines += 1; continue; }   // 지도 가장자리의 문루: 건너편이 지도 밖이다(출구 칸 도달은 exits 검사가 센다)
      crossLines += 1;
      if (!api.isPassable(p, map, a[0], a[1]) || !api.isPassable(p, map, b[0], b[1])) { crossLinesBlockedEnd += 1; continue; }
      tested += 1;
      if (reach(api, p, map, a, box).has(b.join(","))) okLines += 1;
      else miss.crossing.push([c.piece, c.axis, ln, a.join(","), b.join(",")]);
    }
    info.crossingDetail.push({ piece: c.piece, axis: c.axis, x: c.x, y: c.y, lines: c.lines.length, tested, crossed: okLines, ...(edgeLines ? { edgeGate: edgeLines } : {}) });
    if (edgeLines === c.lines.length) continue;
    if (okLines === 0) {
      const ex = exempt.find((e) => e.piece === c.piece && e.y === c.y);
      if (ex) { info.exemptCrossings.push({ piece: c.piece, x: c.x, y: c.y, why: ex.why }); miss.crossing = miss.crossing.filter((m) => !(m[0] === c.piece)); }
      else miss.crossEnd.push([c.piece, c.axis, c.x, c.y, tested ? "건널 수 없음" : "양끝이 모두 막힘"]);
    }
  }
  // 문 앞·디딤돌이 다른 조각에 덮여 닿지 못하는 맵 빌더 쪽 결함(_doors: {x,y,why}) — 사유를 적은 칸만 면제한다.
  const okDoors = allowedMismatch[src.id]?._doors || [];
  info.exemptDoors = [];
  for (const key of ["doorFront", "doorStep"]) {
    miss[key] = miss[key].filter(([dx, dy]) => { const e = okDoors.find((q) => q.x === dx && q.y === dy); if (e) info.exemptDoors.push({ kind: key, x: dx, y: dy, why: e.why }); return !e; });
  }
  const okPeople = allowedMismatch[src.id]?._people || [];
  miss.people = miss.people.filter(([px, py]) => { const e = okPeople.find((q) => q.x === px && q.y === py); if (e) info.exemptPeople.push({ x: px, y: py, why: e.why }); return !e; });
  for (const f of src.fronts || []) for (const [fx, fy] of f.cells) if (!at(fx, fy)) miss.front.push([f.piece, fx, fy]);
  // 실내 기물 앞: 기물마다 둘레 칸 중 하나는 걸어 닿아야 한다. 벽에 걸린 것(시래기·메주·고추 걸이·족자·약초 횃대·연장대)은 닿을 필요가 없다.
  miss.itemFront = []; info.itemFronts = { total: 0, reached: 0, wallHung: [] };
  for (const f of src.itemFronts || []) {
    info.itemFronts.total += 1;
    if (f.cells.some(([cx, cy]) => at(cx, cy))) { info.itemFronts.reached += 1; continue; }
    if (/^(in|pal)_(hang_|jokja|herb_hang|tool_rack)/.test(f.piece)) { info.itemFronts.wallHung.push([f.piece, f.x, f.y]); continue; }
    miss.itemFront.push([f.piece, f.x, f.y]);
  }
  // negative control: a wall cell of every door's building (row above the step) must stay blocked
  const gatePieces = new Set(src.passages.map((g) => g.piece));
  const wallOpen = src.doors.filter((d) => d.step && !gatePieces.has(d.piece) && api.canMove(p, map, d.step[0], d.step[1] - 1, d.step[0], d.step[1] - 2)).length;
  const walkableTotal = src.walk.join("").split("1").length - 1;
  const waterTiles = new Set(waterMembers || []);
  let waterOpenBare = 0, waterUnderObject = 0;
  for (let i = 0; i < map.lowerTiles.length; i += 1) if (waterTiles.has(map.lowerTiles[i])) {
    const x = i % map.width, y = Math.floor(i / map.width), pass = api.isPassable(p, map, x, y);
    if (map.upperTiles[i] < 0) { if (pass) waterOpenBare += 1; } else if (pass) waterUnderObject += 1;
  }
  const unreachComponents = (() => { // 닿지 못하는 칸의 덩어리(4방향) 수와 가장 큰 덩어리 — 보고용
    const left = new Set(unreachAll.map((c) => c.join(","))), sizes = [];
    for (const k of [...left]) { if (!left.has(k)) continue; const q = [k]; left.delete(k); let n = 0;
      for (let i = 0; i < q.length; i += 1) { n += 1; const [x, y] = q[i].split(",").map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nk = (x + dx) + "," + (y + dy); if (left.has(nk)) { left.delete(nk); q.push(nk); } } }
      sizes.push(n); }
    return { count: sizes.length, largest: Math.max(0, ...sizes) };
  })();
  return { crossLines, crossLinesBlockedEnd, ...info, fullReach: { strict: !!src.reachAll, walkable: walkableTotal, reachable: walkableTotal - unreachAll.length, unreachable: unreachAll.length, components: unreachComponents, exempt: okUnreach.length, samples: unreachAll.slice(0, 12) }, crossings: (src.crossings || []).length, fronts: (src.fronts || []).length, waterOpenBare, waterUnderObject, start: src.start, reachable: seen.size, walkable: walkableTotal, missed: miss, missedCount: Object.values(miss).reduce((a, b) => a + b.length, 0), wallAboveDoorOpen: wallOpen };
}

const MASK_SAMPLES = Number(process.env.JOSEON_MASK_SAMPLES || 12);
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
      if ((eq[v] ?? v) !== (eq[t] ?? t)) { mismatch += 1; if (samples.length < MASK_SAMPLES) samples.push(process.env.JOSEON_MASK_DETAIL ? [x, y, t, v] : [x, y]); }
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
  assert(ts.referenceDocuments.length >= 9 && refImages.length > 0, "참고문서 용도 9개 이상(마을 6 + 사냥터·동굴 + 실내 키트 + 궁 내부)");
  for (const id of ["joseon-baram-field-cave", "joseon-baram-interior", "joseon-baram-palace"]) assert(ts.referenceDocuments.some((cat) => cat.id === id), "새 용도 없음: " + id);
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
    // 이전 배포본(칸 13,632 · 열 64 · 참고문서 6용도)을 저장해 둔 프로젝트가 새 번들로 올라오는 길: 칸·열·표·새 참고문서 용도 3개가 생기고, 앞 칸의 표는 동결 장부와 해시가 같으며, 저자 부품·저자 문서는 남는다.
    const frozen = JSON.parse(fs.readFileSync(`${DATA}/frozen-layout.json`, "utf8")), nOld = frozen.waves.at(-1).total;
    const stable = (v) => Array.isArray(v) ? "[" + v.map(stable).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}" : JSON.stringify(v);
    const prefixSha = (t) => crypto.createHash("sha256").update(stable([t.passability.slice(0, nOld), t.priority.slice(0, nOld), t.terrain.slice(0, nOld), t.tileMeta.slice(0, nOld)])).digest("hex");
    const inRange = (n) => n < nOld;
    const pre = structuredClone(p).tilesets[ts.id];
    pre.count = nOld; pre.tilesPerRow = frozen.tilesPerRow;
    for (const k of ["passability", "priority", "terrain", "tileMeta"]) pre[k] = pre[k].slice(0, nOld);
    pre.tileGroups = pre.tileGroups.filter((g) => g.tileIds.every(inRange));
    pre.structureKits = pre.structureKits.filter((k) => k.rows.every((r) => [...(r.tiles ?? []), ...(r.upperTiles ?? [])].every((n) => n < nOld)));
    pre.autotileGroups = pre.autotileGroups.filter((a) => a.memberTileIds.every(inRange) && a.connectTileIds.every(inRange));
    pre.referenceDocuments = pre.referenceDocuments.slice(0, 6);
    pre.structureKits.push({ id: "author-kit", kind: "section", width: 1, height: 1, rows: [{ tiles: [0], upperTiles: [-1] }], learnedFrom: "user" });
    pre.referenceDocuments.push({ id: "author-ref", name: "내 메모", description: "저자 용도", documents: [{ id: "author-doc", name: "메모", markdown: "x" }], images: [] });
    const preSha = prefixSha(pre);
    const up = structuredClone(p); up.tilesets[ts.id] = pre; api.ensureBundledTilesets(up);
    const after = up.tilesets[ts.id];
    ensureProof.prevReleaseOldPrefixMatchesLedger = preSha === frozen.digest.meta;
    ensureProof.prevReleaseUpgraded = after.count === fresh.count && after.tilesPerRow === fresh.tilesPerRow && after.passability.length === fresh.count && prefixSha(after) === frozen.digest.meta;
    ensureProof.prevReleaseNewReferences = ["joseon-baram-field-cave", "joseon-baram-interior", "joseon-baram-palace"].every((id) => after.referenceDocuments.some((cat) => cat.id === id)) && after.referenceDocuments.length === fresh.referenceDocuments.length + 1;
    ensureProof.prevReleaseAuthorKept = after.structureKits.some((k) => k.id === "author-kit") && after.referenceDocuments.some((cat) => cat.id === "author-ref" && cat.documents[0].markdown === "x");
    const again2 = structuredClone(up); ensureProof.prevReleaseIdempotent = api.ensureBundledTilesets(again2) === false || isDeepStrictEqual(again2, up);
    ensureProof.bundledPrefixMatchesLedger = prefixSha(ts) === frozen.digest.meta;
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
    const waterMembers = ts.autotileGroups.filter((g) => ts.tileGroups.some((tg) => tg.role === "water" && tg.tileIds.some((t) => g.memberTileIds.includes(t)))).flatMap((g) => g.memberTileIds);
    checks[src.id] = { walk: checkWalk(api, p, map, src), reach: checkReach(api, p, map, src, waterMembers), masks: checkMasks(api, p, map, ts) };
  }
  p.startMapId = srcMaps[0].id; p.startPos = { x: srcMaps[0].start[0], y: srcMaps[0].start[1] };
  p.meta.title = "조선 칩셋 증명 프로젝트 (임시)";
  verify = checks; verify.__ensure = ensureProof; delete checks.__ensure;
  verify = { ...checks, __ensure: ensureProof };
  for (const [mid, c] of Object.entries(checks).filter(([k]) => k !== "__ensure")) {
    must(c.walk.mismatch === 0, `${mid}: 엔진 통행이 구운 정답과 다르다 ${c.walk.mismatch}칸 ${JSON.stringify(c.walk.samples)}`);
    must(c.reach.missedCount === 0, `${mid}: 도달하지 못하는 문 앞·디딤돌·통로·건너는 곳·주민 칸이 있다: ${JSON.stringify(c.reach.missed)}`);
    must(c.reach.wallAboveDoorOpen === 0, `${mid}: 문 위 벽이 열려 있다`);
    must(c.reach.waterOpenBare === 0, `${mid}: 물 위에 아무것도 없는 걷는 칸이 ${c.reach.waterOpenBare}개`);
    for (const m of c.masks) {
      const max = allowedMismatch[mid]?.[m.group]?.max ?? 0;
      must(m.mismatch <= max, `${mid}: ${m.group} 마스크 불일치 ${m.mismatch} > 허용 ${max}: ${JSON.stringify(m.samples)}`);
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
    // 장소 카드 준비(prepare-joseon-regions.mjs)가 읽을 재로드본. 저장소가 돌려준 프로젝트 그대로다.
    if (process.env.JOSEON_EXPORT_RELOADED) fs.writeFileSync(process.env.JOSEON_EXPORT_RELOADED, JSON.stringify(reloaded));
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
