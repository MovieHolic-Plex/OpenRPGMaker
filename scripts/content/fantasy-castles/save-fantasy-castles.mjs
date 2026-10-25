// fantasy_castles 맵(tiledata/fantasy-castles/maps/*.json, fc_build.py 산출)을 버리는 샌드박스 SQLite 프로젝트 폴더에 저장 → 다시 열어
// 재로드가 같은지 증명 → 엔진 통행(isPassable)이 구운 walk 와 맞는지, 엔진 canMove 너비 우선 탐색이 맵마다의 경로(routes.json)를 잇는지 센다.
//   node scripts/content/fantasy-castles/save-fantasy-castles.mjs
// 저장 폴더: FC_SAVE_DIR (기본 /tmp/oprn-fantasy-castles-sandbox — 정본 프로젝트가 아니다). 타일셋 그림은 그 폴더의 업로드 자산이다(번들 아님).
// 증거: tiledata/fantasy-castles/storage-proof.json, FC_EXPORT_RELOADED=<경로> 면 재로드한 프로젝트 JSON 도 쓴다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../../ontology-ts-loader.mjs";

const DATA = process.env.FC_DATA || "tiledata/fantasy-castles";
const dir = process.env.FC_SAVE_DIR || path.join(os.tmpdir(), "oprn-fantasy-castles-sandbox");
const TILESET_ID = "fantasy_castles";
const ASSET_ID = "fc_sandbox_sheet";
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const def = readJson(`${DATA}/build/fantasyCastlesTileset.json`);
const sheetBytes = fs.readFileSync(`${DATA}/build/fantasy-castles-chipset.png`);
const srcMaps = fs.readdirSync(`${DATA}/maps`).filter((f) => f.endsWith(".json")).sort().map((f) => readJson(`${DATA}/maps/${f}`));
const routes = fs.existsSync(`${DATA}/routes.json`) ? readJson(`${DATA}/routes.json`) : {};
const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };

function sandboxTileset(imageAssetId) {
  const { textureKey: _texture, ...rest } = def;
  return { ...structuredClone(rest), image: { type: "uploaded", id: imageAssetId }, kind: "custom" };
}

function bfs(api, project, map, start, blocked) {
  const key = (x, y) => y * map.width + x;
  const seen = new Uint8Array(map.width * map.height), prev = new Int32Array(map.width * map.height).fill(-1);
  const q = [start];
  seen[key(...start)] = 1;
  for (let i = 0; i < q.length; i += 1) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen[key(nx, ny)]) continue;
      if (blocked?.(nx, ny) || !api.canMove(project, map, x, y, nx, ny)) continue;
      seen[key(nx, ny)] = 1; prev[key(nx, ny)] = key(x, y); q.push([nx, ny]);
    }
  }
  return { seen, prev };
}

function pathTo(prev, width, to) {
  const out = [];
  for (let k = to[1] * width + to[0]; k >= 0; k = prev[k]) out.push([k % width, Math.floor(k / width)]);
  return out.reverse();
}

function checkWalk(api, project, map, walk) {
  const diff = [];
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    if (api.isPassable(project, map, x, y) !== (walk[y][x] === "O")) diff.push([x, y, walk[y][x]]);
  }
  return { cells: map.width * map.height, walkable: walk.join("").split("O").length - 1, mismatch: diff.length, samples: diff.slice(0, 10) };
}

function inBoxes(boxes) {
  return (x, y) => (boxes || []).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
}

function checkRoutes(api, project, map, walk) {
  const spec = routes[map.id];
  if (!spec) return { declared: false };
  const out = { declared: true, routes: [] };
  for (const r of spec.routes) {
    const legs = [];
    let ok = true;
    const steps = [];
    for (let i = 0; i + 1 < r.points.length; i += 1) {
      const a = r.points[i], b = r.points[i + 1];
      const startOk = walk[a[1]]?.[a[0]] === "O", endOk = walk[b[1]]?.[b[0]] === "O";
      const { seen, prev } = bfs(api, project, map, a, inBoxes(r.avoid));
      const reached = !!seen[b[1] * map.width + b[0]];
      const leg = { from: a, to: b, fromWalkable: startOk, toWalkable: endOk, reached };
      if (reached) { const p = pathTo(prev, map.width, b); leg.steps = p.length - 1; steps.push(...(steps.length ? p.slice(1) : p)); }
      legs.push(leg);
      ok = ok && startOk && endOk && reached;
    }
    out.routes.push({ name: r.name, ok, avoid: r.avoid || [], legs, steps: steps.length - 1, path: steps });
    must(ok, `${map.id}: 경로 「${r.name}」 이 끊겼다 ${JSON.stringify(legs.filter((l) => !l.reached || !l.fromWalkable || !l.toWalkable).map((l) => [l.from, l.to]))}`);
  }
  for (const n of spec.negative || []) {
    const { seen } = bfs(api, project, map, n.from, inBoxes(n.avoid));
    const reached = !!seen[n.to[1] * map.width + n.to[0]];
    out.routes.push({ name: n.name, negative: true, ok: !reached, from: n.from, to: n.to, avoid: n.avoid || [] });
    must(!reached, `${map.id}: 막혀야 할 「${n.name}」 이 열렸다`);
  }
  const all = bfs(api, project, map, spec.routes[0].points[0]);
  const walkable = walk.join("").split("O").length - 1;
  out.reachFromStart = { walkable, reached: all.seen.reduce((s, v) => s + v, 0) };
  return out;
}

fs.rmSync(dir, { recursive: true, force: true });

await withTsModule("electron/local-store/store.ts", "fc-store.mjs", async (store) => {
  let s = await store.initLocalProjectStore({ projectDir: dir });
  const ref = await s.putAsset(new Uint8Array(sheetBytes), { mime: "image/png", extension: "png", originalName: "fantasy-castles-chipset.png", kind: "tileset" });
  const project = await withTsModule("scripts/content/fantasy-castles/fc-entry.ts", "fc-build-project.mjs", async (api) => {
    const p = api.createBlankProject();
    p.meta = { ...p.meta, title: "판타지 성채 샌드박스 (버리는 사본)" };
    p.assets.uploaded[ASSET_ID] = { id: ASSET_ID, name: "판타지 성채 칩셋(관문 전 샌드박스)", kind: "tileset", ref,
      meta: { tileSize: 16, width: def.tilesPerRow * 16, height: Math.ceil(def.count / def.tilesPerRow) * 16 } };
    p.tilesets[TILESET_ID] = sandboxTileset(ASSET_ID);
    for (const m of srcMaps) p.maps[m.map.id] = structuredClone(m.map);
    const first = srcMaps[0].map, start = routes[first.id]?.routes?.[0]?.points?.[0];
    p.startMapId = first.id;
    if (start) p.startPos = { x: start[0], y: start[1] };
    const before = JSON.stringify(p.tilesets[TILESET_ID]);
    const probe = structuredClone(p);
    api.ensureBundledTilesets(probe);
    const after = probe.tilesets[TILESET_ID];
    const flipped = [];
    for (let i = 0; i < def.count; i += 1) {
      if (after.priority[i] !== def.priority[i] || after.passability[i].up !== def.passability[i].up) flipped.push(i);
    }
    p.__loadNormalizer = { tilesetChanged: before !== JSON.stringify(after), cellsChanged: flipped.length, samples: flipped.slice(0, 20) };
    return p;
  });
  const normalizer = project.__loadNormalizer;
  delete project.__loadNormalizer;
  const before = s.loadSnapshot();
  const saved = await s.saveSerialized(JSON.stringify(project), before?.sha256 ?? null);
  assert.equal(saved.kind, "saved");
  const projectId = s.projectId;
  s.close();
  s = await store.openLocalProjectStore({ projectDir: dir });
  const snap = s.loadSnapshot();
  const reloaded = JSON.parse(JSON.stringify(snap.project));
  const assetBack = Buffer.from(await s.assetBytes(ref.sha256));
  s.close();
  if (process.env.FC_EXPORT_RELOADED) fs.writeFileSync(process.env.FC_EXPORT_RELOADED, JSON.stringify(reloaded));
  must(isDeepStrictEqual(reloaded.tilesets[TILESET_ID], project.tilesets[TILESET_ID]), "재로드한 타일셋이 저장한 것과 다르다");
  for (const m of srcMaps) must(isDeepStrictEqual(reloaded.maps[m.map.id], project.maps[m.map.id]), "재로드한 맵이 다르다: " + m.map.id);
  must(assetBack.equals(sheetBytes), "재로드한 시트 그림 바이트가 다르다");
  const engine = {};
  await withTsModule("scripts/content/fantasy-castles/fc-entry.ts", "fc-engine.mjs", async (api) => {
    for (const m of srcMaps) {
      const map = reloaded.maps[m.map.id];
      const walk = checkWalk(api, reloaded, map, m.walk);
      must(walk.mismatch === 0, `${map.id}: 엔진 통행과 walk 불일치 ${walk.mismatch}`);
      engine[map.id] = { walk, routes: checkRoutes(api, reloaded, map, m.walk) };
    }
  });
  const proof = {
    note: "버리는 샌드박스 SQLite 폴더(정본 프로젝트 아님). 타일셋 그림은 업로드 자산 — 번들·공용 DB·스토어에 넣지 않았다(3/4 관문 미통과).",
    projectDir: dir, projectId, revision: snap.revision, sha256: snap.sha256, saved: saved.kind, reopened: true,
    sheetAsset: ref, tileset: { id: TILESET_ID, count: def.count, tilesPerRow: def.tilesPerRow, kits: def.structureKits.length },
    reloadEqual: { tileset: isDeepStrictEqual(reloaded.tilesets[TILESET_ID], project.tilesets[TILESET_ID]),
      maps: Object.fromEntries(srcMaps.map((m) => [m.map.id, isDeepStrictEqual(reloaded.maps[m.map.id], project.maps[m.map.id])])), sheetBytes: assetBack.equals(sheetBytes) },
    editorLoadNormalizer: normalizer,
    engine, failures,
  };
  fs.writeFileSync(`${DATA}/storage-proof.json`, JSON.stringify(proof, (k, v) => (k === "path" ? undefined : v), 1) + "\n");
  if (process.env.FC_ROUTE_PATHS) fs.writeFileSync(process.env.FC_ROUTE_PATHS, JSON.stringify(Object.fromEntries(Object.entries(engine).map(([id, e]) => [id, (e.routes.routes || []).filter((r) => r.path).map((r) => ({ name: r.name, path: r.path }))]))));
  console.log(JSON.stringify({ projectId, dir, normalizer, maps: Object.fromEntries(Object.entries(engine).map(([id, e]) => [id, { walkMismatch: e.walk.mismatch, routes: (e.routes.routes || []).map((r) => `${r.name}:${r.ok ? "ok" : "FAIL"}${r.steps ? "(" + r.steps + ")" : ""}`), reach: e.routes.reachFromStart }])), failures }, null, 1));
});
if (failures.length) { console.log("FAIL", failures.length); process.exit(1); }
