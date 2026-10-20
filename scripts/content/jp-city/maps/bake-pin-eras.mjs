#!/usr/bin/env node
// 사용자 프로젝트용 jp_city 칸 번호 복구 표를 굽는다 → src/assets/jpCityPinEras.json
//   node scripts/content/jp-city/maps/bake-pin-eras.mjs [--check]
//
// 2026-10-14~18 굽기 여섯 번이 낡은 pins.json 으로 구워져 칸 번호가 밀렸다(openwiki/jp-city.md 「칸 번호 밀림 사고」).
// 그 사이에 그린 맵은 그 판의 번호를 들고 있다. 판마다 「그 판 번호 → 지금 번호」를 자리 키로 이어(pinRemap.mjs — remap-refs.mjs 와 같은 로직)
// 바뀐 번호만 구간 [옛 시작, 새 시작, 길이] 으로 적는다. 지금 표에 자리 키가 없는 번호는 lost 로 적는다(복구가 그대로 두고 알린다).
// --check: 파일이 지금 pins.json 과 맞는지만 본다(다르면 exit 1).
import fs from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { buildIdRemap, readPinCells } from "./pinRemap.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..", "..");
const OUT = join(ROOT, "src/assets/jpCityPinEras.json");

/**
 * 지금과 번호가 다른 판. revs = 그 판 번호가 담긴 pins.json 커밋들(덧붙이기만 한 굽기는 같은 판 — 합친다),
 * since/until = 그 판이 저장소에 있던 때(커밋 시각, KST). 실측표: `git log origin/main -- tiledata/jp-city/pins.json` 을 커밋마다
 * 지금 pins.json 과 견줘 「옮겨지는 번호 수」가 같은 구간끼리 묶었다(4c8c1dfaa1~4cce8998bc 는 지금과 같은 번호라 판이 아니다).
 */
const ERAS = [
  { id: "2026-10-09", revs: ["0d4f13e7c8", "3e9c8ab161", "95d11925f2", "a6f57c8c75", "f4c8347e3b", "23c07dc643", "d847e06c01", "324155cd2c", "a4dbe8186f", "d1e786da2d"],
    since: "2026-10-09 14:50", until: "2026-10-14 15:38", label: "10월 9일~14일 오후" },
  { id: "2026-10-14a", revs: ["fbe80f3a09"], since: "2026-10-14 15:38", until: "2026-10-14 15:53", label: "10월 14일 15:38~15:53" },
  { id: "2026-10-14b", revs: ["f8a7d06c67"], since: "2026-10-14 15:53", until: "2026-10-18 12:00", label: "10월 14일 오후~18일 정오" },
  { id: "2026-10-18a", revs: ["275fc20d7c"], since: "2026-10-18 12:00", until: "2026-10-18 15:11", label: "10월 18일 12:00~15:11" },
  { id: "2026-10-18b", revs: ["1e5a3f1fb5"], since: "2026-10-18 15:11", until: "2026-10-18 15:48", label: "10월 18일 15:11~15:48" },
  { id: "2026-10-18c", revs: ["9cba5ea57f"], since: "2026-10-18 20:28", until: "2026-10-18 23:47", label: "10월 18일 20:28~23:47" },
];

/** 같은 판의 여러 커밋 표를 합친다. 같은 자리 키가 다른 번호거나 같은 번호가 다른 자리 키면 같은 판이 아니다 — 멈춘다. */
function mergedCells(revs) {
  const cells = {}; const owner = new Map();
  for (const rev of revs) {
    for (const [k, v] of Object.entries(readPinCells(ROOT, rev))) {
      if (k in cells && cells[k] !== v) throw new Error(`${rev}: ${k} 가 ${cells[k]} → ${v} — 같은 판이 아니다`);
      if (owner.has(v) && owner.get(v) !== k) throw new Error(`${rev}: 번호 ${v} 주인이 ${owner.get(v)} → ${k} — 같은 판이 아니다`);
      cells[k] = v; owner.set(v, k);
    }
  }
  return cells;
}

const nowCells = readPinCells(ROOT);
let nowCount = 0;
for (const v of Object.values(nowCells)) if (v + 1 > nowCount) nowCount = v + 1;
/** 시트 칸마다 RGBA 바이트 해시. 다 투명한 칸은 null(그림이 없어 같다고 할 수 없다). */
function cellHashes(png, tilesPerRow, tile = 16) {
  const rows = Math.floor(png.height / tile); const out = [];
  for (let id = 0; id < rows * tilesPerRow; id++) {
    const x0 = (id % tilesPerRow) * tile, y0 = Math.floor(id / tilesPerRow) * tile;
    const h = createHash("sha1"); let opaque = false;
    for (let y = 0; y < tile; y++) {
      const off = ((y0 + y) * png.width + x0) * 4;
      const row = png.data.subarray(off, off + tile * 4);
      for (let i = 3; i < row.length; i += 4) if (row[i] !== 0) { opaque = true; break; }
      h.update(row);
    }
    out.push(opaque ? h.digest("hex") : null);
  }
  return out;
}
function sheetAt(rev) {
  const meta = rev === null ? JSON.parse(fs.readFileSync(join(ROOT, "src/assets/jpCitySheet.json"), "utf8"))
    : JSON.parse(spawnSync("git", ["show", `${rev}:src/assets/jpCitySheet.json`], { cwd: ROOT, encoding: "utf8" }).stdout);
  const bytes = rev === null ? fs.readFileSync(join(ROOT, "public/assets/jp-city/jp-city-chipset.png"))
    : spawnSync("git", ["show", `${rev}:public/assets/jp-city/jp-city-chipset.png`], { cwd: ROOT, maxBuffer: 1 << 30 }).stdout;
  return cellHashes(PNG.sync.read(bytes), meta.tilesPerRow);
}

const nowHashes = sheetAt(null);
const nowKeyOf = new Map(Object.entries(nowCells).map(([k, v]) => [v, k]));
const byHash = new Map();
for (let id = 0; id < nowHashes.length; id++) { const h = nowHashes[id]; if (h) { const list = byHash.get(h) ?? []; list.push(id); byHash.set(h, list); } }
const kitOf = (key) => (key ?? "").split("/").slice(0, -1).join("/");

const eras = ERAS.map((era) => {
  const remap = buildIdRemap(mergedCells(era.revs), nowCells);
  const eraHashes = sheetAt(era.revs.at(-1));
  const to = new Map(); const lost = []; let pixelMatched = 0;
  for (let t = 0; t < remap.oldCount; t++) {
    const n = remap.to(t);
    if (n !== undefined) { if (n !== t) to.set(t, n); continue; }
    // 지금 표에 자리 키가 없는 칸(그 판 뒤에 키트에서 빠지거나 이름이 바뀐 칸): 그 판 시트의 그림과 화소가 똑같은 지금 칸이 있으면 그리로.
    // 같은 그림이 여럿이면 같은 키트 칸, 없으면 가장 앞 번호. 화소가 같은 칸이 없으면 lost 로 남긴다(복구가 그대로 두고 알린다).
    const same = byHash.get(eraHashes[t] ?? "") ?? [];
    if (same.length === 0) { lost.push(t); continue; }
    const kit = kitOf(remap.keyOf(t));
    const pick = same.find((id) => kitOf(nowKeyOf.get(id)) === kit) ?? same[0];
    pixelMatched++;
    if (pick !== t) to.set(t, pick);
  }
  const runs = [];
  for (const [t, n] of [...to].sort((a, b) => a[0] - b[0])) {
    const last = runs[runs.length - 1];
    if (last && last[0] + last[2] === t && last[1] + last[2] === n) last[2]++;
    else runs.push([t, n, 1]);
  }
  return { ...era, oldCount: remap.oldCount, moved: to.size, pixelMatched, runs, lost };
});
const body = JSON.stringify({ nowCount, eras }) + "\n";
if (process.argv.includes("--check")) {
  const ok = fs.existsSync(OUT) && fs.readFileSync(OUT, "utf8") === body;
  console.log(ok ? "jpCityPinEras.json 최신" : "jpCityPinEras.json 이 pins.json 과 다르다 — bake-pin-eras.mjs 를 다시 돌려라");
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(OUT, body);
for (const e of eras) console.log(`${e.id} ${e.revs.at(-1)} 옛 ${e.oldCount}칸 · 옮김 ${e.moved} · 구간 ${e.runs.length} · 화소로 찾음 ${e.pixelMatched} · 잃음 ${e.lost.length}`);
console.log(`→ ${OUT} ${(body.length / 1024).toFixed(0)}KB`);
