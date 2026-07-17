/**
 * 성 유형 쇼케이스 — 사용자가 캔버스에 찍은 문법(2층 커튼월+정면벽 깃발+돌바닥 안뜰+
 * 대계단/포탈리스+원형탑)을 학습해 여러 성 아키타입을 조립·렌더한다.
 * bun scripts/build-castle-showcase.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { paintRoofDeck, paintWallFaceRow, paintRoundTower, CASTLE_ROOF, CASTLE_WALL } from "../src/editor/castleKit.ts";
import type { GameMap } from "../src/project/types.ts";

const TILE = 16, COLS = 30;
const GRASS = 240;
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));
const OUT = path.resolve("output/evidence/castle-showcase");
fs.mkdirSync(OUT, { recursive: true });

// ── 사용자 문법 타일 ──
const FLOOR = { TL: 276, T: 277, TR: 278, L: 306, C: 307, R: 308, BL: 336, B: 337, BR: 338 };
const DECOR = {
  PENNANT: 209, DIAMOND: 208, TAPESTRY: 179,
  PORTCULLIS: 88, GATE_DARK: 359,
  STAIR_L: 111, STAIR_M: 112, STAIR_R: 113,
  WELL: 382, BRAZIER: 381, MAGIC: 231, SCROLL: 320, TORCH: 318, SLIT: 58,
  TREE_TOP: 262, TREE_TOP2: 263, TRUNK: 292, TRUNK2: 293, PINE_TOP: 260, PINE_BOT: 290,
  UNDERGROWTH: 9, BENCH_L: 327, BENCH_R: 328, POT: 352, CRATE: 203,
  RUG_RED: 179,
};

type Grid = GameMap;
function grid(w: number, h: number): Grid {
  return { width: w, height: h, lowerTiles: new Array(w * h).fill(GRASS), upperTiles: new Array(w * h).fill(0) } as unknown as GameMap;
}
const sL = (m: Grid, x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < m.width && y < m.height) m.lowerTiles[y * m.width + x] = t; };
const sU = (m: Grid, x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < m.width && y < m.height) m.upperTiles[y * m.width + x] = t; };

function floor(m: Grid, x0: number, y0: number, w: number, h: number): void {
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const l = x === 0, r = x === w - 1, t = y === 0, b = y === h - 1;
    let tile = FLOOR.C;
    if (t && l) tile = FLOOR.TL; else if (t && r) tile = FLOOR.TR; else if (t) tile = FLOOR.T;
    else if (b && l) tile = FLOOR.BL; else if (b && r) tile = FLOOR.BR; else if (b) tile = FLOOR.B;
    else if (l) tile = FLOOR.L; else if (r) tile = FLOOR.R;
    sL(m, x0 + x, y0 + y, tile);
  }
}
/** 정면 벽 상단(여장 바로 아래) 행에 걸개 깃발(상위) — step 간격. */
function hangBanners(m: Grid, x0: number, x1: number, y: number, tile = DECOR.PENNANT, step = 2): void {
  for (let x = x0; x <= x1; x += step) sU(m, x, y, tile);
}
/** 대계단(폭 w, 높이 h) — 좌 111 · 중 112 · 우 113. */
function stair(m: Grid, x0: number, y0: number, w: number, h: number): void {
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    sL(m, x0 + x, y0 + y, x === 0 ? DECOR.STAIR_L : x === w - 1 ? DECOR.STAIR_R : DECOR.STAIR_M);
  }
}
/** 성벽 한 줄(여장 데크 상 + 정면 벽 하) — 2층 커튼월. */
function curtainRow(m: Grid, x0: number, y0: number, w: number, deckH: number, faceH: number): void {
  paintRoofDeck(m, x0, y0, w, deckH);
  paintWallFaceRow(m, x0, y0 + deckH, w, faceH, { skipTop: true });
}

interface Scene { name: string; title: string; w: number; h: number; build: (m: Grid) => void; }

const scenes: Scene[] = [];

// ═══ 1. 관문 요새 (Gatehouse Keep) — 사용자 스타일 정본 ═══
scenes.push({ name: "gatehouse", title: "관문 요새", w: 34, h: 24, build: (m) => {
  const ox = 2, oy = 1, ow = 30, oh = 18;
  const deckH = 2, faceH = 3;
  // 안뜰 돌바닥
  floor(m, ox + 2, oy + deckH, ow - 4, oh - deckH - faceH - 2);
  // 북벽(윗변) 여장
  paintRoofDeck(m, ox, oy, ow, deckH);
  // 좌우 측벽
  paintRoofDeck(m, ox, oy + deckH, 2, oh - deckH - faceH);
  paintRoofDeck(m, ox + ow - 2, oy + deckH, 2, oh - deckH - faceH);
  paintWallFaceRow(m, ox, oy + oh - faceH, 2, faceH, { skipTop: true });
  paintWallFaceRow(m, ox + ow - 2, oy + oh - faceH, 2, faceH, { skipTop: true });
  // 본채 킵(북중앙)
  const kw = 10, kx = ox + Math.floor((ow - kw) / 2), ky = oy + deckH;
  paintRoofDeck(m, kx, ky, kw, 3);
  paintWallFaceRow(m, kx, ky + 3, kw, 3);
  // 킵 아치문(어두운 359) + 포탈리스
  sL(m, kx + kw / 2 - 1, ky + 5, DECOR.GATE_DARK); sL(m, kx + kw / 2, ky + 5, DECOR.GATE_DARK);
  sU(m, kx + 1, ky + 3, DECOR.TAPESTRY); sU(m, kx + kw - 2, ky + 3, DECOR.TAPESTRY);
  // 남쪽 커튼(2층) + 문 갭
  const gw = 4, gx = ox + Math.floor((ow - gw) / 2);
  const sy = oy + oh - faceH;
  const deckTop = oy + oh - faceH;
  paintRoofDeck(m, ox, deckTop - 0, gx - ox, 1); // 남 여장 얇게
  paintWallFaceRow(m, ox, sy, gx - ox, faceH, { skipTop: true });
  paintWallFaceRow(m, gx + gw, sy, ox + ow - (gx + gw), faceH, { skipTop: true });
  // 남 정면벽 깃발
  hangBanners(m, ox + 1, gx - 2, sy, DECOR.PENNANT, 2);
  hangBanners(m, gx + gw + 1, ox + ow - 2, sy, DECOR.PENNANT, 2);
  // 문 통로 + 대계단
  for (let y = deckTop; y < sy + faceH + 2; y += 1) for (let x = gx; x < gx + gw; x += 1) { sL(m, x, y, GRASS); sU(m, x, y, 0); }
  stair(m, gx, sy, gw, faceH + 1);
  sL(m, gx, deckTop, DECOR.GATE_DARK); sL(m, gx + gw - 1, deckTop, DECOR.GATE_DARK);
  sU(m, gx, deckTop, DECOR.PORTCULLIS); sU(m, gx + gw - 1, deckTop, DECOR.PORTCULLIS);
  // 모서리 원형탑 4
  paintRoundTower(m, ox + 1, oy, 6);
  paintRoundTower(m, ox + ow - 3, oy, 6);
  paintRoundTower(m, ox + 1, sy - 6, 6);
  paintRoundTower(m, ox + ow - 3, sy - 6, 6);
  // 안뜰 장식: 우물 + 화톳불 2
  sU(m, ox + 5, oy + oh - faceH - 3, DECOR.WELL);
  sU(m, ox + ow - 6, oy + oh - faceH - 3, DECOR.BRAZIER);
  sU(m, ox + 6, oy + oh - faceH - 3, DECOR.BRAZIER);
}});

// ═══ 2. 대탑 본성 (Great Keep / Donjon) ═══
scenes.push({ name: "greatkeep", title: "대탑 본성", w: 24, h: 26, build: (m) => {
  const kx = 6, ky = 2, kw = 12;
  // 다단 여장 지붕(2단)
  paintRoofDeck(m, kx - 1, ky, kw + 2, 2);
  paintRoofDeck(m, kx + 1, ky + 2, kw - 2, 2);
  // 벽 몸통 6단 + 화살구멍/창
  paintWallFaceRow(m, kx, ky + 4, kw, 8);
  for (let y = ky + 5; y < ky + 11; y += 2) { sU(m, kx + 2, y, DECOR.SLIT); sU(m, kx + kw - 3, y, DECOR.SLIT); sU(m, kx + Math.floor(kw / 2), y, DECOR.SLIT); }
  // 태피스트리 + 문
  sU(m, kx + 2, ky + 4, DECOR.TAPESTRY); sU(m, kx + kw - 3, ky + 4, DECOR.TAPESTRY);
  sL(m, kx + kw / 2 - 1, ky + 11, DECOR.GATE_DARK); sL(m, kx + kw / 2, ky + 11, DECOR.GATE_DARK);
  stair(m, kx + kw / 2 - 2, ky + 12, 4, 3);
  // 측면 부속 원형탑 2
  paintRoundTower(m, kx - 3, ky + 3, 9);
  paintRoundTower(m, kx + kw + 1, ky + 3, 9);
  // 깃발
  hangBanners(m, kx + 1, kx + kw - 2, ky + 4, DECOR.DIAMOND, 3);
}});

// ═══ 3. 동심원 성 (Concentric Castle) ═══
scenes.push({ name: "concentric", title: "동심원 성", w: 34, h: 28, build: (m) => {
  const deckH = 2, faceH = 2;
  // 외성
  const ox = 1, oy = 1, ow = 32, oh = 24;
  floor(m, ox + 1, oy + deckH, ow - 2, oh - deckH - faceH);
  paintRoofDeck(m, ox, oy, ow, deckH);
  paintRoofDeck(m, ox, oy + oh - deckH, ow, deckH);
  paintRoofDeck(m, ox, oy + deckH, 2, oh - deckH * 2);
  paintRoofDeck(m, ox + ow - 2, oy + deckH, 2, oh - deckH * 2);
  paintWallFaceRow(m, ox, oy + oh, ow, 1, { skipTop: true });
  // 외성 남문
  const g1 = ox + Math.floor(ow / 2) - 2;
  for (let x = g1; x < g1 + 4; x += 1) { sL(m, x, oy + oh - 1, GRASS); sL(m, x, oy + oh - 2, GRASS); sU(m, x, oy + oh - 2, 0); }
  stair(m, g1, oy + oh - 2, 4, 2);
  // 내성
  const ix = ox + 6, iy = oy + 5, iw = ow - 12, ih = oh - 10;
  floor(m, ix + 1, iy + deckH, iw - 2, ih - deckH - faceH);
  paintRoofDeck(m, ix, iy, iw, deckH);
  paintRoofDeck(m, ix, iy + ih - faceH, iw, faceH);
  paintRoofDeck(m, ix, iy + deckH, 2, ih - deckH - faceH);
  paintRoofDeck(m, ix + iw - 2, iy + deckH, 2, ih - deckH - faceH);
  paintWallFaceRow(m, ix, iy + ih, iw, 1, { skipTop: true });
  const g2 = ix + Math.floor(iw / 2) - 1;
  for (let x = g2; x < g2 + 2; x += 1) { sL(m, x, iy + ih - 1, GRASS); }
  // 내성 킵
  paintRoofDeck(m, ix + Math.floor(iw / 2) - 3, iy + deckH + 1, 6, 2);
  paintWallFaceRow(m, ix + Math.floor(iw / 2) - 3, iy + deckH + 3, 6, 2);
  // 코너 원형탑: 외성 4 + 내성 4
  for (const [tx, ty] of [[ox, oy], [ox + ow - 2, oy], [ox, oy + oh - 6], [ox + ow - 2, oy + oh - 6]]) paintRoundTower(m, tx as number, ty as number, 6);
  for (const [tx, ty] of [[ix, iy], [ix + iw - 2, iy]]) paintRoundTower(m, tx as number, ty as number, 5);
  // 외곽 마당 깃발/화톳불
  hangBanners(m, ox + 3, ox + ow - 4, oy + oh, DECOR.PENNANT, 3);
  sU(m, ox + 3, oy + oh - 3, DECOR.BRAZIER); sU(m, ox + ow - 4, oy + oh - 3, DECOR.BRAZIER);
}});

// ═══ 4. 궁정 알현실 (Throne Court) — 실내 장식 쇼케이스 ═══
scenes.push({ name: "throne", title: "궁정 알현실", w: 22, h: 20, build: (m) => {
  const hx = 2, hy = 2, hw = 18, hh = 15;
  // 홀 바닥
  floor(m, hx, hy, hw, hh);
  // 벽(여장 상 + 정면벽) 둘레
  paintRoofDeck(m, hx - 1, hy - 1, hw + 2, 2);
  paintWallFaceRow(m, hx - 1, hy - 1 + 2, 1, hh, { skipTop: true });
  paintWallFaceRow(m, hx + hw, hy - 1 + 2, 1, hh, { skipTop: true });
  // 옥좌 단(북중앙): 마법진 + 태피스트리 뒤 + 화톳불 좌우
  const cx = hx + Math.floor(hw / 2);
  sL(m, cx, hy + 1, DECOR.MAGIC);
  sU(m, cx - 2, hy, DECOR.TAPESTRY); sU(m, cx, hy, DECOR.TAPESTRY); sU(m, cx + 2, hy, DECOR.TAPESTRY);
  sU(m, cx - 3, hy + 1, DECOR.BRAZIER); sU(m, cx + 3, hy + 1, DECOR.BRAZIER);
  // 홀 안 진열: 무기 진열(항아리/상자)·긴 탁자 느낌으로 좌우 대칭 배치
  for (const dy2 of [4, 8]) {
    sU(m, hx + 3, hy + dy2, DECOR.POT); sU(m, hx + hw - 4, hy + dy2, DECOR.POT);
    sU(m, hx + 5, hy + dy2, DECOR.CRATE); sU(m, hx + hw - 6, hy + dy2, DECOR.CRATE);
  }
  // 벽 횃불 + 벽보
  for (let y = hy + 3; y < hy + hh - 1; y += 4) { sU(m, hx, y, DECOR.TORCH); sU(m, hx + hw - 1, y, DECOR.TORCH); }
  sU(m, hx + 2, hy, DECOR.SCROLL); sU(m, hx + hw - 3, hy, DECOR.SCROLL);
  // 남문 계단
  stair(m, cx - 1, hy + hh - 1, 3, 2);
}});

// ═══ 5. 폐성 (Ruined Castle) ═══
scenes.push({ name: "ruined", title: "폐성", w: 30, h: 22, build: (m) => {
  const ox = 2, oy = 2, ow = 24, oh = 15, deckH = 2, faceH = 3;
  // 부서진 커튼: 구간마다 랜덤 결손(결정론: (x*7+y*13)%5)
  const broken = (x: number, y: number) => ((x * 7 + y * 13) % 5) === 0;
  // 윗변
  for (let x = ox; x < ox + ow; x += 1) if (!broken(x, oy)) paintRoofDeck(m, x, oy, 1, deckH);
  // 좌우
  for (let y = oy + deckH; y < oy + oh - faceH; y += 1) {
    if (!broken(ox, y)) paintRoofDeck(m, ox, y, 2, 1);
    if (!broken(ox + ow - 2, y)) paintRoofDeck(m, ox + ow - 2, y, 2, 1);
  }
  // 남벽(정면) 일부만
  for (let x = ox; x < ox + ow; x += 1) if (!broken(x, oy + oh)) paintWallFaceRow(m, x, oy + oh - faceH, 1, faceH, { skipTop: true });
  // 무너진 킵(반쪽)
  paintRoofDeck(m, ox + 8, oy + deckH, 5, 2);
  paintWallFaceRow(m, ox + 8, oy + deckH + 2, 5, 2);
  sL(m, ox + 10, oy + deckH + 3, DECOR.GATE_DARK);
  // 무너진 원형탑(밑동만) + 온전한 것 1
  paintRoundTower(m, ox + 1, oy, 6);
  sL(m, ox + ow - 3, oy + 1, 140); sL(m, ox + ow - 2, oy + 1, 141); sL(m, ox + ow - 3, oy + 2, 142); sL(m, ox + ow - 2, oy + 2, 143); // 부러진 탑
  // 잡초·나무 침식(짙은 수풀 패치 + 나무)
  const scatter: [number, number][] = [[6, 6], [9, 9], [14, 5], [18, 8], [12, 12], [20, 6], [5, 11], [16, 11]];
  for (const [dx, dy] of scatter) {
    sL(m, ox + dx, oy + dy, DECOR.UNDERGROWTH);
    sL(m, ox + dx + 1, oy + dy, DECOR.UNDERGROWTH);
    sL(m, ox + dx, oy + dy + 1, DECOR.UNDERGROWTH);
  }
  // 나무 몇 그루(밑동 하위 + 수관 상위)
  for (const [dx, dy] of [[7, 7], [15, 6], [19, 9], [11, 11]]) {
    sL(m, ox + dx, oy + dy + 1, DECOR.TRUNK); sU(m, ox + dx, oy + dy, DECOR.TREE_TOP);
  }
  // 깨진 창 + 흩어진 상자
  sU(m, ox + 9, oy + deckH + 2, DECOR.SLIT);
  sU(m, ox + 13, oy + 10, DECOR.CRATE);
}});

// ── 렌더 ──
function render(scene: Scene, scale: number): void {
  const m = grid(scene.w, scene.h);
  scene.build(m);
  const png = new PNG({ width: scene.w * TILE * scale, height: scene.h * TILE * scale });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 40; png.data[i + 1] = 46; png.data[i + 2] = 40; png.data[i + 3] = 255; }
  const blit = (t: number, dx: number, dy: number) => {
    if (t < 0) return;
    const sx0 = (t % COLS) * TILE, sy0 = Math.floor(t / COLS) * TILE;
    for (let y = 0; y < TILE * scale; y += 1) for (let x = 0; x < TILE * scale; x += 1) {
      const sx = sx0 + Math.floor(x / scale), sy = sy0 + Math.floor(y / scale);
      const si = (sy * chip.width + sx) * 4, di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3]! === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < scene.h; y += 1) for (let x = 0; x < scene.w; x += 1) {
    const l = m.lowerTiles[y * scene.w + x]!, u = m.upperTiles[y * scene.w + x]!;
    const dx = x * TILE * scale, dy = y * TILE * scale;
    if (l >= 0) blit(l, dx, dy);
    if (u > 0) blit(u, dx, dy);
  }
  fs.writeFileSync(path.join(OUT, `${scene.name}.png`), PNG.sync.write(png));
  console.log("rendered", scene.name, `${scene.w}x${scene.h}`);
}

for (const s of scenes) render(s, 6);
console.log("done ->", OUT);
