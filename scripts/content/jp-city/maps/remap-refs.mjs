#!/usr/bin/env node
// jp_city 장소 내려받기(public/assets/region-references/jp-city-*.oprn.json)와 스냅숏(src/project/regionReferences/jp-city-*.json)의
// 칸 번호를 「그 맵을 만든 굽기의 pins.json」 → 지금 pins.json 으로 자리 키를 따라 옮기고, 들고 있는 jp_city 타일셋 사본을 지금 정의로 바꾼다.
//
// 왜: pins.json 은 「앞 번호 불변」이어야 하는데 2026-10-14~18 굽기 여러 번(#2899 에서 11,329칸)이 낡은 pins.json 으로 구워져 번호가 밀렸다.
// 그 전에 게시한 장소 32곳은 옛 번호를 그대로 들고 있어 지금 시트로 그리면 건물·바닥이 엉뚱한 칸으로 나온다(가져오기도 열 수 48 사본이라 깨진다).
//
//   node scripts/content/jp-city/maps/remap-refs.mjs --from 0d4f13e7c8 [--dry] [--only koban,ramen]
//   --from  = 그 장소들을 구울 때의 pins.json 이 들어 있는 커밋(git show <rev>:tiledata/jp-city/pins.json).
// 지금 pins.json 에 없는 자리 키(키트에서 뺀 칸)를 쓰는 장소는 옮기지 않고 실패로 알린다 — 그런 장소는 생성기(maps/*.mjs --publish)로 다시 짓는다.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..", "..");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const FROM = arg("--from");
if (!FROM && !process.argv.includes("--retile-only")) { console.error("--from <rev> 가 필요하다"); process.exit(2); }
const DRY = process.argv.includes("--dry");
const ONLY = arg("--only") ? new Set(arg("--only").split(",")) : null;
const RETILE_ONLY = process.argv.includes("--retile-only");                  // 번호는 그대로, 타일셋 사본만 지금 정의로(방금 생성기로 다시 지은 장소)

if (!process.env.REMAP_UNDER_TSX) {
  const r = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit", cwd: ROOT, env: { ...process.env, REMAP_UNDER_TSX: "1" } });
  process.exit(r.status ?? 1);
}

const { createJpCityTileset } = await import(join(ROOT, "src/project/defaults/jpCity.ts"));
const TS = createJpCityTileset();
const { readPinCells, buildIdRemap } = await import(join(HERE, "pinRemap.mjs"));
const nowCells = readPinCells(ROOT);
const remap = buildIdRemap(RETILE_ONLY ? nowCells : readPinCells(ROOT, FROM), nowCells);
const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"];

/** 맵 칸 번호를 옮긴다. 옮길 수 없는 번호가 있으면 그 목록을 돌려주고 맵은 건드리지 않는다. */
function remapMap(map) {
  const lost = new Map(); let moved = 0;
  const next = {};
  for (const L of LAYERS) {
    if (!Array.isArray(map[L])) continue;
    next[L] = map[L].map((t) => {
      if (t == null || t < 0) return t;
      const n = remap.to(t);
      if (n === undefined) { lost.set(t, remap.keyOf(t) ?? "?"); return t; }
      if (n !== t) moved++;
      return n;
    });
  }
  if (lost.size) return { lost };
  Object.assign(map, next);
  return { moved };
}

const slim = { id: TS.id, image: TS.image, tileSize: TS.tileSize, tilesPerRow: TS.tilesPerRow, count: TS.count, passability: TS.passability, priority: TS.priority, terrain: TS.terrain };
const out = []; let fail = 0;
for (const f of fs.readdirSync(join(ROOT, "public/assets/region-references")).filter((n) => /^jp-city-.*\.oprn\.json$/.test(n))) {
  const name = f.slice("jp-city-".length, -".oprn.json".length);
  if (ONLY && !ONLY.has(name)) continue;
  const pPath = join(ROOT, "public/assets/region-references", f);
  const sPath = join(ROOT, "src/project/regionReferences", `jp-city-${name}.json`);
  const proj = JSON.parse(fs.readFileSync(pPath, "utf8"));
  const snap = fs.existsSync(sPath) ? JSON.parse(fs.readFileSync(sPath, "utf8")) : null;
  const maps = Array.isArray(proj.maps) ? proj.maps : Object.values(proj.maps);
  const res = maps.map((m) => ({ id: m.id, ...remapMap(m) }));
  const lost = res.filter((r) => r.lost);
  if (lost.length) {
    fail++;
    out.push({ name, ok: false, lost: lost.map((r) => ({ map: r.id, cells: [...r.lost].slice(0, 12) })) });
    continue;
  }
  // 칸 이름표(tileMeta)는 뺀 사본: 가져오기는 이름표 없는 사본을 받는다(regionReferenceImport completeTileset). 넣으면 파일 하나가 13MB 가 된다.
  const { tileMeta: _drop, ...rest } = structuredClone(TS);
  proj.tilesets = { ...proj.tilesets, jp_city: rest };
  let snapMoved = 0;
  if (snap) {
    const r = remapMap(snap.map);
    if (r.lost) { fail++; out.push({ name, ok: false, snapshotLost: [...r.lost].slice(0, 12) }); continue; }
    snapMoved = r.moved; snap.tileset = slim;
  }
  out.push({ name, ok: true, maps: res.map((r) => `${r.id}:${r.moved}`), snapshotMoved: snapMoved });
  if (!DRY) {
    fs.writeFileSync(pPath, JSON.stringify(proj));
    if (snap) fs.writeFileSync(sPath, JSON.stringify(snap));
  }
}
console.log(JSON.stringify({ from: FROM, dry: DRY, files: out.length, failed: fail, out }, null, 1));
if (fail) process.exitCode = 3;
