// 칩셋 PNG 에서 타일을 직접 합성해 장면 이미지를 만든다.
//
// 왜 이 방식인가: 에디터의 store 를 브라우저에서 조작해 칠하는 방식을 세 번 시도했는데 rect 가
// 렌더에 반영되지 않는 일이 반복됐다(타이밍 또는 불변 스냅샷 문제로 보인다). 장면을 직접 합성하면
// 결정적이고, 무엇보다 이 보고서의 목적 — "저작한 라벨이 실제 그림과 맞는지 눈으로 본다" — 에는
// 오히려 더 낫다. 에디터가 개입하지 않으므로 보이는 것이 곧 칩셋 픽셀이다.
//
// 타일 선택은 무작위가 아니다. 내가 저작한 role 로 고른다: water 로 못을 파고, wall 로 벽을 세우고,
// roof 를 얹고, door 를 달고, 소품을 늘어놓는다. 라벨이 맞으면 장면이 맞물리고 틀리면 어그러진다.
//
// 사용: node scripts/compose-chipset-scenes.mjs --out .omo/evidence/showcase

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const outDir = val("--out", ".omo/evidence/showcase");

const TILE = 16;
const COLS = 30;
const SCALE = 3;
const KEY = { r: 255, g: 103, b: 139, tol: 14 };

const picks = JSON.parse(fs.readFileSync(".omo/evidence/scene-picks.json", "utf8"));
const SHEETS = [
  { key: "retro_dungeon", ko: "레트로 던전" },
  { key: "retro_exterior", ko: "레트로 외부" },
  { key: "retro_house", ko: "레트로 주택" },
  { key: "retro_world", ko: "레트로 월드맵" },
  { key: "ship", ko: "배" },
  { key: "world", ko: "월드맵" },
];

// 실제 앱이 쓰는 파일은 *-transparent.png 다 (scripts/gen-chipset-strips.mts 의 SHEETS 와 같은 경로).
const SHEET_PATH = {
  retro_dungeon: "public/assets/easyrpg-chipset-retro-dungeon-transparent.png",
  retro_exterior: "public/assets/easyrpg-chipset-retro-exterior-transparent.png",
  retro_house: "public/assets/easyrpg-chipset-retro-house-transparent.png",
  retro_world: "public/assets/easyrpg-chipset-retro-world-transparent.png",
  ship: "public/assets/easyrpg-chipset-ship-transparent.png",
  world: "public/assets/easyrpg-chipset-world-transparent.png",
};

function loadSheet(key) {
  return PNG.sync.read(fs.readFileSync(SHEET_PATH[key]));
}

/** 타일 하나를 목적지에 그린다. 컬러키는 건너뛰어 아래 타일이 비치게 한다. */
function blit(dst, src, tileIndex, tx, ty) {
  const sx = (tileIndex % COLS) * TILE;
  const sy = Math.floor(tileIndex / COLS) * TILE;
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const so = ((sy + y) * src.width + (sx + x)) * 4;
      const a = src.data[so + 3];
      const r = src.data[so], g = src.data[so + 1], b = src.data[so + 2];
      if (a < 8) continue;
      if (Math.abs(r - KEY.r) < KEY.tol && Math.abs(g - KEY.g) < KEY.tol && Math.abs(b - KEY.b) < KEY.tol) continue;
      const dx = tx * TILE + x, dy = ty * TILE + y;
      if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
      const dof = (dy * dst.width + dx) * 4;
      dst.data[dof] = r; dst.data[dof + 1] = g; dst.data[dof + 2] = b; dst.data[dof + 3] = 255;
    }
  }
}

function upscale(png, n) {
  const out = new PNG({ width: png.width * n, height: png.height * n });
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const so = (Math.floor(y / n) * png.width + Math.floor(x / n)) * 4;
      const dof = (y * out.width + x) * 4;
      out.data[dof] = png.data[so]; out.data[dof + 1] = png.data[so + 1];
      out.data[dof + 2] = png.data[so + 2]; out.data[dof + 3] = png.data[so + 3];
    }
  }
  return out;
}

function scene(w, h) { const p = new PNG({ width: w * TILE, height: h * TILE }); p.data.fill(0); return p; }

const made = [];
function save(png, name, caption, meta) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, PNG.sync.write(upscale(png, SCALE)));
  made.push({ file: path.resolve(file), name, caption, ...meta });
  console.log(`  ${name} — ${caption}`);
}

fs.mkdirSync(outDir, { recursive: true });

for (const sheet of SHEETS) {
  const src = loadSheet(sheet.key);
  const p = picks[sheet.key];
  const gi = (a, n) => (a && a[n] ? a[n].i : a && a[0] ? a[0].i : 0);
  const g0 = gi(p.ground, 0), g1 = gi(p.ground, 1), g2 = gi(p.ground, 2);
  const w0 = gi(p.water, 0), w1 = gi(p.water, 1);
  const wl = gi(p.wall, 0), wl2 = gi(p.wall, 1), wl3 = gi(p.wall, 2);
  const rf = p.roof.length ? gi(p.roof, 0) : wl2;
  const rf2 = p.roof.length > 1 ? gi(p.roof, 1) : rf;
  const dr = p.door.length ? gi(p.door, 0) : wl3;
  const props = (p.prop || []).map((e) => e.i);
  const labels = {
    ground: p.ground.slice(0, 3).map((e) => `${e.i} ${e.l}`),
    water: p.water.slice(0, 2).map((e) => `${e.i} ${e.l}`),
    wall: p.wall.slice(0, 3).map((e) => `${e.i} ${e.l}`),
    roof: p.roof.slice(0, 2).map((e) => `${e.i} ${e.l}`),
    door: p.door.slice(0, 2).map((e) => `${e.i} ${e.l}`),
    prop: p.prop.slice(0, 8).map((e) => `${e.i} ${e.l}`),
  };
  console.log(`=== ${sheet.ko} (${sheet.key}) ===`);

  // 장면 1 — 지형과 물: 바탕을 깔고 못을 파고 길을 낸다.
  {
    const W = 22, H = 14, s = scene(W, H);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) blit(s, src, g0, x, y);
    for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 8; x += 1) blit(s, src, w0, x, y);
    for (let y = 2; y <= 4; y += 1) for (let x = 2; x <= 7; x += 1) blit(s, src, w1, x, y);
    for (let x = 0; x < W; x += 1) { blit(s, src, g1, x, 8); blit(s, src, g1, x, 9); }
    for (let y = 1; y <= 5; y += 1) for (let x = 13; x <= 20; x += 1) blit(s, src, g2, x, y);
    props.slice(0, 6).forEach((t, k) => blit(s, src, t, 3 + k * 3, 11));
    save(s, `${sheet.key}-scene1.png`, `${sheet.ko} — 지형과 물 (바탕·못·길)`, { sheet: sheet.key, kind: "scene", labels });
  }

  // 장면 2 — 건축: 벽을 세우고 지붕을 얹고 문을 낸다.
  {
    const W = 22, H = 14, s = scene(W, H);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) blit(s, src, g0, x, y);
    for (let x = 3; x <= 8; x += 1) { blit(s, src, rf, x, 4); blit(s, src, rf2, x, 5); }
    for (let y = 6; y <= 9; y += 1) for (let x = 3; x <= 8; x += 1) blit(s, src, wl, x, y);
    blit(s, src, dr, 5, 9); blit(s, src, dr, 6, 9);
    for (let x = 13; x <= 18; x += 1) { blit(s, src, rf, x, 4); blit(s, src, rf2, x, 5); }
    for (let y = 6; y <= 9; y += 1) for (let x = 13; x <= 18; x += 1) blit(s, src, wl2, x, y);
    blit(s, src, dr, 15, 9); blit(s, src, dr, 16, 9);
    for (let x = 0; x < W; x += 1) blit(s, src, wl3, x, 11);
    save(s, `${sheet.key}-scene2.png`, `${sheet.ko} — 건축 (벽·지붕·문)`, { sheet: sheet.key, kind: "scene", labels });
  }

  // 장면 3 — 소품 전시: 저작한 소품을 격자로 늘어놓아 하나하나 보이게 한다.
  {
    const cols = 8, W = cols * 3 + 1, rows = Math.ceil(Math.max(props.length, 1) / cols);
    const H = rows * 3 + 1, s = scene(W, H);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) blit(s, src, g0, x, y);
    props.forEach((t, k) => blit(s, src, t, 1 + (k % cols) * 3, 1 + Math.floor(k / cols) * 3));
    save(s, `${sheet.key}-scene3.png`, `${sheet.ko} — 소품 전시 (role 로 고른 소품 ${props.length}종)`, { sheet: sheet.key, kind: "props", labels });
  }

  // 장면 4 — 시트 전체 축소도: 480칸이 실제로 어떻게 생겼는지 한눈에.
  {
    const rows = Math.ceil(480 / COLS), s = scene(COLS, rows);
    for (let i = 0; i < 480; i += 1) blit(s, src, i, i % COLS, Math.floor(i / COLS));
    save(s, `${sheet.key}-sheet.png`, `${sheet.ko} — 시트 전체 (30열 × ${rows}행)`, { sheet: sheet.key, kind: "sheet", labels });
  }
}

fs.writeFileSync(path.join(outDir, "composed.json"), JSON.stringify(made, null, 1), "utf8");
console.log(`\n합성 ${made.length}장 -> ${path.resolve(outDir)}`);
