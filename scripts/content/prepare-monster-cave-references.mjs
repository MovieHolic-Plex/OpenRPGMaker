// 몬스터 동굴 칩셋의 AI 참고문서를 만든다(번들 소유 — AGENTS 「새 타일·타일 학습은 공용에 추가한다」).
//
// 입력:  src/assets/monsterCaveManifest.json   블록 좌표·47 블롭 마스크 표(scripts/content/build-monster-cave.py 출력)
// 출력:  src/assets/monsterCaveReferences.json          참고문서 카테고리 1개(이미지는 /assets/... 경로)
//        public/assets/monster-cave/references/*.png     실제 타일로 합성한 예제·정상/오류 그림
//
// 완성 예제 동굴은 아래 LAYOUT 글자 배치에서 엔진과 같은 규칙(8방 마스크 → 47 대표 마스크)으로
// 1층·3층 배열을 계산한다. 그림은 그 배열을 시트의 실제 칸으로 nearest 합성한 것이다(AI 가 그린 모형이 아니다,
// scripts/content/render-monster-cave-references.py). 배열은 구조 검사(checkCave)와 도달 검사를 통과해야 저장된다.
// 오류 그림은 정상 배열을 한 곳씩 변조해 같은 검사로 오류 코드·좌표를 뽑는다 — 검출되지 않으면 실패한다.
// 실행: node scripts/content/prepare-monster-cave-references.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const M = JSON.parse(fs.readFileSync("src/assets/monsterCaveManifest.json", "utf8"));
const OUT_JSON = "src/assets/monsterCaveReferences.json";
const IMG_DIR = "public/assets/monster-cave/references";
const TILESET_ID = "scarloxy_chipset_monster_cave";
const COLS = 30;
const FENCE = "\u0060\u0060\u0060";
const B = M.blobMaskBits;
const DIRS = [[B.N, 0, -1], [B.E, 1, 0], [B.S, 0, 1], [B.W, -1, 0], [B.NE, 1, -1], [B.SE, 1, 1], [B.SW, -1, 1], [B.NW, -1, -1]];
const block = Object.fromEntries(M.blocks.map((b) => [b.name, b]));
const tileOf = (name, dx = 0, dy = 0) => (block[name].row + dy) * COLS + block[name].col + dx;
const grid = (name) => Array.from({ length: block[name].h }, (_, dy) => Array.from({ length: block[name].w }, (_, dx) => tileOf(name, dx, dy)));

function reduce(mask) {
  let r = mask & (B.N | B.E | B.S | B.W);
  if (mask & B.NE && mask & B.N && mask & B.E) r |= B.NE;
  if (mask & B.SE && mask & B.S && mask & B.E) r |= B.SE;
  if (mask & B.SW && mask & B.S && mask & B.W) r |= B.SW;
  if (mask & B.NW && mask & B.N && mask & B.W) r |= B.NW;
  return r;
}
const blobTile = (set, mask) => M.blobs[set].masks[String(reduce(mask))];
const blobBody = (set) => M.blobs[set].masks["255"];

// 칸 → 블록·층·통행.
const infoByTile = new Map();
for (const b of M.blocks) {
  const cells = b.kind === "blob" ? 47 : b.w * b.h;
  for (let i = 0; i < cells; i += 1) {
    const dx = i % b.w;
    const dy = Math.floor(i / b.w);
    const open = b.passable === "all" || (Array.isArray(b.passable) && b.passable.some(([px, py]) => px === dx && py === dy));
    infoByTile.set((b.row + dy) * COLS + b.col + dx, { open, layer: b.layer, block: b.name });
  }
}
const setOfTile = new Map();
for (const [s, info] of Object.entries(M.blobs)) for (const t of Object.values(info.masks)) setOfTile.set(t, s);
const FACE_ROW_BLOCKS = ["cliff-face", "ladder-up", "tunnel-dark", "exit-bright", "stairs-up"];
const faceTiles = new Set(FACE_ROW_BLOCKS.flatMap((n) => grid(n).flat()));
// 이어짐(편집기 오토타일 그룹과 같다 — src/project/defaults/monsterCaveAutotiles.ts).
const CONNECTS = {
  wall: (t) => setOfTile.get(t) === "wall" || faceTiles.has(t),
  high: (t) => setOfTile.get(t) === "high" || setOfTile.get(t) === "wall" || faceTiles.has(t),
  water: (t) => setOfTile.get(t) === "water",
  gravel: (t) => setOfTile.get(t) === "gravel",
};

// ---------------------------------------------------------------------------
// 완성 예제 동굴 (24×20). 글자: W 바위 벽(높이 2), h 고지대(높이 1), ~ 물, g 자갈, . 흙(높이 0).
// 절벽 앞면은 자동: 높이가 떨어지는 칸 바로 아래 두 줄이 앞면이다(바위 벽 → 고지대 위에도 생긴다).
const LAYOUT = [
  "WWWWWWWWWWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWWWWWWWWWW",
  "WWWhhhhhhhhWWWWWWWWWWWWW",
  "WWWhhhhhhhhWWWW.....WWWW",
  "WWWhhhhhhhhWWWW.....WWWW",
  "WWWhhhhhhhhWWWW.....WWWW",
  "WWWhhhhhhhhWWWW.....WWWW",
  "WWW........WWWW.....WWWW",
  "WWW........WWWW.....WWWW",
  "WWW...................WW",
  "WWW...................WW",
  "WWW..~~~~~~..ggg......WW",
  "WWW..~~~~~~.gggg......WW",
  "WWW..~~~~~~..gg..WWWW.WW",
  "WWW..............WWWW.WW",
  "WWW...................WW",
  "WWW...................WW",
  "WWW...................WW",
  "WWWWWWWWWWW..WWWWWWWWWWW",
  "WWWWWWWWWWW..WWWWWWWWWWW",
];
const H = LAYOUT.length;
const Wd = LAYOUT[0].length;
// 앞면 줄에 끼우는 칸 (블록, x, y) — y 는 앞면 윗줄.
const FIXTURES = [
  ["stairs-up", 5, 7],
  ["tunnel-dark", 16, 3],
  ["ladder-up", 18, 15],
];
// 1층 바닥 장식 (블록, x, y) — 흙 칸 위에만.
const DECALS = [
  ["sparkle-a", 16, 7],
  ["ladder-hole", 20, 17],
  ["puddle", 10, 15],
  ["glow-moss", 21, 16],
  ["floor-crack", 14, 16],
  ["floor-scatter", 7, 16],
];
// 3층 소품 (블록, x, y) — 1×2 는 윗칸 좌표.
const PROPS = [
  ["ore-rock", 9, 4],
  ["stalagmite-tall", 19, 5],
  ["push-boulder", 9, 10],
  ["crystal", 21, 12],
  ["stalagmite-small", 4, 15],
  ["cracked-rock", 12, 17],
  ["rubble", 3, 17],
];
const ENTRY = [11, 19];
const TARGETS = {
  "고지대(계단 위)": [5, 5],
  "어두운 굴 아랫줄": [16, 4],
  "사다리 아랫칸": [18, 16],
  "사다리 구멍": [20, 17],
  "반짝이": [16, 7],
};

const LEVEL = { W: 2, h: 1 };
const level = (x, y) => (x < 0 || y < 0 || x >= Wd || y >= H ? 2 : LEVEL[LAYOUT[y][x]] ?? 0);

function buildExample() {
  const face = Array.from({ length: H }, () => Array(Wd).fill(-1));
  for (let y = 0; y < H - 1; y += 1) for (let x = 0; x < Wd; x += 1) {
    if (level(x, y) > level(x, y + 1) && face[y][x] < 0) {
      face[y + 1][x] = 0;
      if (y + 2 < H) face[y + 2][x] = 1;
    }
  }
  const lower = Array.from({ length: H }, () => Array(Wd).fill(-1));
  const upper = Array.from({ length: H }, () => Array(Wd).fill(-1));
  const SETS = { W: "wall", h: "high", "~": "water", g: "gravel" };
  // 먼저 앞면·블롭 종류만 정하고(칸 번호 전), 모양은 이웃 종류로 고른다.
  const kind = (x, y) => (x < 0 || y < 0 || x >= Wd || y >= H ? "W" : face[y][x] >= 0 ? "F" : LAYOUT[y][x]);
  const kindConnects = {
    wall: (k) => k === "W" || k === "F",
    high: (k) => k === "h" || k === "W" || k === "F",
    water: (k) => k === "~",
    gravel: (k) => k === "g",
  };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < Wd; x += 1) {
    const k = kind(x, y);
    if (k === "F") {
      // 옆이 앞면이거나 솟은 칸이면 이어진다. 바닥이면 그쪽 끝 조각.
      const cont = (xx) => "FWh".includes(kind(xx, y));
      const dx = !cont(x - 1) ? 0 : !cont(x + 1) ? 3 : 1 + (x % 2);
      lower[y][x] = tileOf("cliff-face", dx, face[y][x]);
    } else if (SETS[k]) {
      const s = SETS[k];
      let mask = 0;
      for (const [bit, dx, dy] of DIRS) if (kindConnects[s](kind(x + dx, y + dy))) mask |= bit;
      lower[y][x] = blobTile(s, mask);
    } else {
      lower[y][x] = (x * 7 + y * 3) % 11 === 0 ? tileOf("floor-pebbles") : tileOf("floor-dirt");
    }
  }
  for (const [name, x, y] of FIXTURES) {
    for (let dy = 0; dy < block[name].h; dy += 1) for (let dx = 0; dx < block[name].w; dx += 1) lower[y + dy][x + dx] = tileOf(name, dx, dy);
  }
  for (const [name, x, y] of DECALS) lower[y][x] = tileOf(name);
  for (const [name, x, y] of PROPS) {
    for (let dy = 0; dy < block[name].h; dy += 1) for (let dx = 0; dx < block[name].w; dx += 1) upper[y + dy][x + dx] = tileOf(name, dx, dy);
  }
  return { lower, upper };
}

// ---------------------------------------------------------------------------
// 구조 검사 — 칸 번호·층·블롭 모양·앞면 순서·잘린 소품만 본다(미적 품질·이벤트 실행은 보지 않는다).

const isFaceTop = (t) => {
  const fb = block["cliff-face"];
  return Math.floor(t / COLS) === fb.row && t % COLS >= fb.col && t % COLS < fb.col + fb.w;
};

function checkCave(lower, upper) {
  const errors = [];
  const h = lower.length;
  const w = lower[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : lower[y][x]);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const t = lower[y][x];
    const info = infoByTile.get(t);
    if (!info) { errors.push({ code: "unknown-tile", x, y, tile: t }); continue; }
    if (info.layer !== "lower") errors.push({ code: "prop-on-lower", x, y, tile: t });
    const u = upper[y][x];
    if (u >= 0 && infoByTile.get(u)?.layer !== "upper") errors.push({ code: "floor-on-upper", x, y, tile: u });
    if (u >= 0 && infoByTile.get(u)?.layer === "upper" && !info.open) errors.push({ code: "prop-on-solid", x, y, tile: u, block: infoByTile.get(u)?.block });
    const s = setOfTile.get(t);
    if (s) {
      let mask = 0;
      for (const [bit, dx, dy] of DIRS) {
        const n = at(x + dx, y + dy);
        if (n === null ? s === "wall" : CONNECTS[s](n)) mask |= bit;
      }
      if (blobTile(s, mask) !== t) errors.push({ code: "wrong-edge-shape", x, y, tile: t, expected: blobTile(s, mask) });
      // 솟은 면의 높이가 바로 아래 칸보다 높으면 그 아래가 앞면이어야 한다(벽 2 > 고지대 1 > 나머지 0).
      const below = at(x, y + 1);
      const height = (tile) => (setOfTile.get(tile) === "wall" ? 2 : setOfTile.get(tile) === "high" ? 1 : 0);
      if ((s === "wall" || s === "high") && below !== null && !faceTiles.has(below) && height(t) > height(below)) {
        errors.push({ code: "missing-cliff-face", x, y: y + 1, tile: below });
      }
    }
    if (isFaceTop(t)) {
      const below = at(x, y + 1);
      if (below !== t + COLS) errors.push({ code: "face-row-order", x, y: y + 1, tile: below, expected: t + COLS });
    }
  }
  // 여러 칸 소품이 잘리지 않았는가(3층).
  for (const b of M.blocks.filter((bb) => bb.layer === "upper" && bb.w * bb.h > 1)) {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const u = upper[y][x];
      if (u < 0 || infoByTile.get(u)?.block !== b.name) continue;
      const dx = (u % COLS) - b.col;
      const dy = Math.floor(u / COLS) - b.row;
      for (let yy = 0; yy < b.h; yy += 1) for (let xx = 0; xx < b.w; xx += 1) {
        const ax = x - dx + xx;
        const ay = y - dy + yy;
        if (ay < 0 || ax < 0 || ay >= h || ax >= w || upper[ay][ax] !== tileOf(b.name, xx, yy)) errors.push({ code: "cut-prop", x: ax, y: ay, block: b.name });
      }
    }
  }
  return [...new Map(errors.map((e) => [JSON.stringify(e), e])).values()];
}

function walkable(lower, upper, x, y) {
  if (!infoByTile.get(lower[y][x])?.open) return false;
  const u = upper[y][x];
  return u < 0 || infoByTile.get(u)?.open === true;
}

function unreachable(lower, upper) {
  const h = lower.length;
  const w = lower[0].length;
  const seen = new Set([ENTRY.join(",")]);
  const queue = [ENTRY];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(nx + "," + ny) || !walkable(lower, upper, nx, ny)) continue;
      seen.add(nx + "," + ny);
      queue.push([nx, ny]);
    }
  }
  return Object.entries(TARGETS).filter(([, [x, y]]) => !seen.has(x + "," + y)).map(([label, [x, y]]) => ({ code: "unreachable", x, y, label }));
}

const example = buildExample();
const exampleErrors = [...checkCave(example.lower, example.upper), ...unreachable(example.lower, example.upper)];
if (exampleErrors.length) {
  console.error(JSON.stringify(exampleErrors.slice(0, 20)));
  throw new Error("완성 예제가 검사에 실패했습니다");
}

const clone = (a) => a.map((r) => [...r]);
const variants = [];
{
  const lower = clone(example.lower);
  for (const x of [17, 19, 20]) { lower[15][x] = tileOf("floor-dirt"); lower[16][x] = tileOf("floor-dirt"); }
  variants.push({ id: "face-missing", lower, upper: example.upper, crop: [14, 11, 9, 8], caption: "앞면 빠짐 — 바위 기둥 아래 두 줄을 흙으로 둬서 윗면이 바닥에 떠 있다" });
}
{
  const lower = clone(example.lower);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < Wd; x += 1) if (setOfTile.get(lower[y][x]) === "water") lower[y][x] = blobBody("water");
  variants.push({ id: "water-no-edge", lower, upper: example.upper, crop: [2, 10, 10, 5], caption: "물 가장자리 없음 — 몸통 칸 하나로만 칠해 물이 네모로 잘렸다" });
}
{
  const lower = clone(example.lower);
  const upper = clone(example.upper);
  upper[5][19] = -1;
  upper[15][4] = -1;
  lower[15][4] = tileOf("stalagmite-small");
  variants.push({ id: "prop-cut-layer", lower, upper, crop: [2, 3, 20, 14], caption: "큰 석순 윗칸 빠짐(잘린 소품) · 작은 석순을 1층에 둠(투명 부분이 검다)" });
}
{
  const lower = clone(example.lower);
  for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) lower[7 + dy][5 + dx] = tileOf("cliff-face", 1 + ((5 + dx) % 2), dy);
  variants.push({ id: "stairs-blocked", lower, upper: example.upper, crop: [2, 1, 10, 10], caption: "계단 없음 — 앞면이 끊기지 않아 고지대로 오를 길이 막혔다" });
}
for (const v of variants) {
  v.errors = [...checkCave(v.lower, v.upper), ...unreachable(v.lower, v.upper)];
  if (v.errors.length === 0) throw new Error("변조 " + v.id + " 가 검출되지 않았습니다");
}

// ---------------------------------------------------------------------------
// 문서

const rowsJson = (rows) => "[\n" + rows.map((r) => "  " + JSON.stringify(r)).join(",\n") + "\n]";
const passText = (b) => (b.passable === "all" ? "○" : b.passable === "none" ? "×" : b.name === "high-blob" ? "몸통·오목 모서리 ○ / 테두리 ×" : "○ " + b.passable.map(([x, y]) => "(" + x + "," + y + ")").join(" ") + " / 나머지 ×");
const KO = {
  "wall-blob": "동굴 바위 벽 47칸", "high-blob": "고지대 47칸", "water-blob": "동굴 물 47칸", "gravel-blob": "자갈 47칸",
  "floor-dirt": "흙바닥", "floor-pebbles": "잔돌 흙바닥", "floor-scatter": "자갈 조각", puddle: "작은 물웅덩이", "floor-crack": "바닥 균열",
  "glow-moss": "빛 이끼", "sparkle-a": "반짝이 1", "sparkle-b": "반짝이 2", "ladder-hole": "사다리 구멍(내려가기)", void: "어둠",
  "stairs-down": "내려가는 계단", "cliff-face": "절벽 앞면", "ladder-up": "사다리(올라가기)", "tunnel-dark": "어두운 굴", "exit-bright": "밝은 출구",
  "stairs-up": "오르는 돌계단", "stalagmite-small": "작은 석순", "stalagmite-tall": "큰 석순", "push-boulder": "밀 수 있는 바위",
  "cracked-rock": "깨는 바위", "ore-rock": "광석 바위", crystal: "수정 무더기", rubble: "돌무더기",
};

function blobTable(set) {
  const lines = ["| 대표 마스크 | N E S W | 이어진 대각 | 칸 번호 |", "|---|---|---|---|"];
  for (const [mask, tile] of Object.entries(M.blobs[set].masks).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const m = Number(mask);
    const o = ["N", "E", "S", "W"].map((k) => (m & B[k] ? k : "·")).join(" ");
    const d = ["NE", "SE", "SW", "NW"].filter((k) => m & B[k]).join(" ") || "—";
    lines.push("| " + mask + " | " + o + " | " + d + " | " + tile + " |");
  }
  return lines.join("\n");
}

function dictionary() {
  const rows = M.blocks.map((b) => {
    const first = tileOf(b.name);
    const last = b.kind === "blob" ? first + 5 * COLS + 6 : tileOf(b.name, b.w - 1, b.h - 1);
    return "| " + b.name + " | " + KO[b.name] + " | " + b.col + "," + b.row + " | " + b.w + "×" + b.h + (b.kind === "blob" ? " (47칸)" : "") + " | " + first + "~" + last + " | " + (b.layer === "lower" ? "1층" : "3층") + " | " + passText(b) + " |";
  });
  const partJson = Object.fromEntries(M.blocks.filter((b) => b.kind !== "blob").map((b) => [b.name, grid(b.name)]));
  const face = grid("cliff-face");
  return [
    "# 몬스터 동굴 · 칸 사전",
    "",
    "tilesetId=" + TILESET_ID + ". 이미지 tex_scarloxy_chipset_monster_cave (public/assets/monster-cave/monster-cave.png, 480×256).",
    "16px 칸, 30열, 480칸. 좌표·번호는 0기준, 번호 = 행×30 + 열. 다른 칩셋(초원 마을·몬스터 마을 부품·던전)의 번호를 섞지 않는다.",
    "그림은 이미지 생성 모델로 Scarloxy 화풍에 맞춰 그린 생성 자산이다(팩 원본 아님). 빈 칸(블롭 블록의 마지막 한 칸, 표에 없는 칸)은 투명이라 쓰지 않는다.",
    "",
    "## 층 규칙 (엔진 판정과 같다)",
    "- **1층**: 바닥·바위 벽 윗면·고지대·물·자갈·절벽 앞면·사다리·계단·굴, 그리고 흙 위에 구워 넣은 바닥 장식(물웅덩이·반짝이·균열·이끼·사다리 구멍). 전부 불투명하다.",
    "- **3층**: 가장자리가 투명한 소품(석순·바위·광석·수정·돌무더기). 1층에 두면 투명 픽셀 아래가 검게 보인다. 모두 × 이고 큰 석순 윗칸만 ★(캐릭터가 뒤로 지나감).",
    "- 투명 여부·층·통행·그리기 순서는 별개다. 바닥 장식을 투명한 채 3층 ○ 로 두면 ★ 이 되어 캐릭터 발을 덮으므로 흙에 구웠다.",
    "",
    "## 블록 표 (○ 통행, × 막힘, 좌표는 블록 안 (dx,dy))",
    "| 블록 | 이름 | 원점 열,행 | 크기 | 칸 번호 | 층 | 통행 |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "## 부품 전체 배열 (블롭 제외, 행 우선)",
    FENCE + "json",
    JSON.stringify(partJson),
    FENCE,
    "",
    "## 절벽 앞면 조각 (cliff-face 4×2)",
    "- 윗줄 " + face[0].join(", ") + " = 왼 끝 · 반복 A · 반복 B · 오른 끝. 아랫줄 " + face[1].join(", ") + " 는 같은 순서(윗줄 번호 + 30).",
    "- 윗줄 조각 바로 아래에는 반드시 같은 열의 아랫줄 조각(+30)이 온다.",
    "- 블롭 네 세트의 몸통: 바위 벽 " + blobBody("wall") + " · 고지대 " + blobBody("high") + " · 물 " + blobBody("water") + " · 자갈 " + blobBody("gravel") + ". 흙 " + tileOf("floor-dirt") + ".",
  ].join("\n");
}

function edgeSets() {
  return [
    "# 몬스터 동굴 · 가장자리 47칸 블롭 네 세트",
    "",
    "바위 벽·고지대·물·자갈은 47칸 블롭이다(3×3 아님). 칸마다 8방 이웃 마스크를 계산하고, 대각 비트는 그 양옆 두 직교가 모두 이어졌을 때만 남겨",
    "256 → 47 대표 마스크로 줄인 뒤 표에서 칸을 고른다. 비트: N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128. 맵 밖은 바위 벽에게만 이어진 이웃이다.",
    "",
    "## 이어짐",
    "- 바위 벽: 바위 벽과 절벽 앞면 줄 칸(앞면·사다리·굴·출구·오르는 계단)을 이웃으로 본다. 고지대는 이웃이 아니다(벽이 더 높아 경계선이 선다).",
    "- 고지대: 고지대·바위 벽·앞면 줄 칸을 이웃으로 본다(벽 옆 고지대는 테두리 없이 걷는다).",
    "- 물은 물만, 자갈은 자갈만. 이어지지 않은 쪽에는 흙바닥(24)이 드러난다 — 모든 세트의 바깥 바탕이 흙이다.",
    "",
    "## 편집기에서는",
    "타일셋에 오토타일 그룹 4개(harness-scarloxy-monster_cave-v1-blob-wall · -high · -water · -gravel)가 있다. 몸통 칸 하나로 칠하면 도구가 이웃에 맞춰 가장자리를 고른다.",
    "stamp_layer_block 은 기본 reshape:true 라 같은 결과다. 절벽 앞면은 오토타일이 아니다 — 「조립 순서」 3단계대로 직접 찍는다(앞면을 찍으면 그 위 윗면이 다시 모양을 잡는다).",
    "",
    "## 고지대 통행",
    "고지대는 네 직교가 모두 이어진 칸(몸통·오목 모서리)만 ○ 이고 테두리 칸은 × 다 — 가장자리에서 떨어지지 않는다. 오르내림은 오르는 돌계단으로만.",
    "",
    ...["wall", "high", "water", "gravel"].flatMap((s) => ["## " + KO[s + "-blob"] + " (원점 열 " + M.blobs[s].col + ", 행 " + M.blobs[s].row + ", 8열×6행 — 마지막 칸 비움)", blobTable(s), ""]),
  ].join("\n");
}

function steps() {
  const face = grid("cliff-face");
  const g = (name) => grid(name).map((r) => r.join(",")).join(" / ");
  return [
    "# 몬스터 동굴 · 조립 순서",
    "",
    "tilesetId=" + TILESET_ID + ". 번호는 「칸 사전」과 같다. 순서대로 — 뒤 단계가 앞 단계 칸을 덮는다.",
    "",
    "## 1. 바탕",
    "1층 전체를 흙 " + tileOf("floor-dirt") + " 으로 채운다. 잔돌 흙 " + tileOf("floor-pebbles") + " 을 드문드문(예: (x·7 + y·3) % 11 == 0 인 칸) 섞어 반복을 숨긴다.",
    "",
    "## 2. 높이 정하기와 블롭 (1층)",
    "높이: 바위 벽 2 > 고지대 1 > 흙·물·자갈 0.",
    "- 바위 벽 몸통 " + blobBody("wall") + " 으로 벽 칸을 칠한다. 맵 외곽 두 줄 이상은 벽.",
    "- 고지대 몸통 " + blobBody("high") + " 으로 한 단 높은 바닥. 폭 4칸·높이 5줄 이상(위 두 줄은 벽 앞면에 덮이고, 계단 좌우로 걸을 칸이 있어야 한다).",
    "- 물 " + blobBody("water") + " (최소 2×2)과 자갈 " + blobBody("gravel") + " 도 같은 방식.",
    "- 모양은 「가장자리 47칸」 표 또는 도구 재성형이 정한다. 몸통 번호만 남기면 네모로 잘린다(wrong-edge-shape).",
    "",
    "## 3. 절벽 앞면 (반드시)",
    "칸 (x,y) 의 높이가 바로 아래 칸 (x,y+1) 보다 높으면, 아래 두 줄 (x,y+1)·(x,y+2) 가 절벽 앞면이다. 바위 벽 아래 고지대에도 생긴다.",
    "- 윗줄: 왼쪽 이웃이 앞면도 솟은 칸도 아니면(바닥이면) 왼 끝 " + face[0][0] + ", 오른쪽 이웃이 그렇다면 오른 끝 " + face[0][3] + ", 그 밖은 x 짝수 " + face[0][1] + " · 홀수 " + face[0][2] + ".",
    "- 아랫줄: 바로 위 칸 번호 + 30. 앞면은 ×.",
    "- 앞면이 두 줄을 먹으므로 솟은 면 남쪽 바닥은 최소 세 줄이어야 방이 남는다.",
    "- 솟은 면 동·서·북이 바닥이면 앞면이 없다 — 윗면 블롭 외곽선이 경계다.",
    "",
    "## 4. 앞면 자리에 끼우는 칸 (1층, 앞면 두 줄을 덮는다)",
    "- 오르는 돌계단 " + g("stairs-up") + " (2×2): 고지대 남쪽 앞면에. 네 칸 ○. 계단 바로 위 두 칸은 고지대 몸통(○)이어야 한다 — 계단을 고지대 좌우 끝에서 1칸 이상 안쪽에 둔다.",
    "- 사다리 " + g("ladder-up") + " (1×2): 앞면 한 열에. 아랫칸만 ○ — 그 칸에 playerTouch 장소 이동(윗층). 아랫칸 바로 아래는 흙이어야 다가간다.",
    "- 어두운 굴 " + g("tunnel-dark") + " · 밝은 출구 " + g("exit-bright") + " (2×2): 앞면 두 열에. 아랫줄 두 칸만 ○ — 두 칸 모두 장소 이동(굴 = 다른 동굴 맵, 출구 = 바깥 맵).",
    "",
    "## 5. 바닥 장식 (1층, 흙 칸을 바꾼다)",
    "- 사다리 구멍 " + tileOf("ladder-hole") + ": 같은 칸에 아래층으로 가는 playerTouch 장소 이동.",
    "- 내려가는 계단 " + grid("stairs-down")[0].join(",") + " (2×1): 두 칸 모두 장소 이동.",
    "- 반짝이 " + tileOf("sparkle-a") + " / " + tileOf("sparkle-b") + ": 숨은 도구. 같은 칸에 조사 이벤트(도구 획득 뒤 changeTile 1층 → " + tileOf("floor-dirt") + ").",
    "- 물웅덩이 " + tileOf("puddle") + " · 균열 " + tileOf("floor-crack") + " · 빛 이끼 " + tileOf("glow-moss") + " · 자갈 조각 " + tileOf("floor-scatter") + ": 흙 칸에만(고지대·블롭 가장자리 위 금지 — 바탕이 흙색이다). 모두 ○.",
    "- 어둠 " + tileOf("void") + ": 맵 여백·구덩이, ×.",
    "",
    "## 6. 소품 (3층, 흙·고지대 몸통 위)",
    "- 작은 석순·밀 바위·깨는 바위·광석·수정 1×1, 돌무더기 2×1, 큰 석순 1×2(윗칸 ★, 아랫칸 ×). 블록을 잘라 쓰지 않는다(cut-prop).",
    "- 밀 바위 퍼즐: 바위 칸 조사 이벤트 → changeTile 로 3층 바위를 민 칸에 쓰고 원래 칸을 -1 로 비운다.",
    "- 깨는 바위: 조사 이벤트 → 조건(기술·도구) 확인 뒤 changeTile 3층 -1.",
    "- 두 칸 폭 통로에는 한쪽에만 둔다. 계단·사다리·굴 앞 칸에는 두지 않는다(unreachable).",
    "",
    "## 7. 조우·연결",
    "- 야생 조우는 맵 encounterTable 항목에 conditions.region(자갈 사각형이나 방)을 건다. 타일에는 조우가 없다.",
    "- 바깥 입구: 몬스터 마을 부품 시트(scarloxy_chipset_monster_town_kit)의 cave-entrance(5×4) 구멍 이벤트 → 이 동굴의 입구 칸(예제 (11,19)).",
    "",
    "## 금지 (검사 오류 코드)",
    "- missing-cliff-face: 솟은 면 남쪽이 바로 바닥.",
    "- face-row-order: 앞면 윗줄 아래에 아랫줄(+30)이 아닌 칸.",
    "- wrong-edge-shape: 블롭 칸이 이웃과 맞지 않음(몸통만 칠함, 반대 모서리).",
    "- prop-on-lower / floor-on-upper: 층 뒤바뀜. prop-on-solid: 소품을 벽·앞면·물 위에 둠. cut-prop: 여러 칸 소품이 잘림. unreachable: 입구에서 계단·사다리·굴·구멍에 못 감.",
    "- 없는 소재: 나무 다리·난간, 동굴 안 건물, 얼음·용암 동굴, 비밀 문, 폭포. 어둠 연출은 화면 색조(tint) 명령으로 낸다.",
  ].join("\n");
}

function exampleDoc() {
  return [
    "# 완성 예제 · 반짝 동굴 1층 (" + Wd + "×" + H + ")",
    "",
    "아래 배열은 스크립트가 글자 배치에서 엔진 규칙으로 계산했고 구조 검사 0건·도달 검사를 통과했다. 그림 cave-example.png 가 이 배열의 실제 타일 렌더다.",
    "stamp_layer_block 로 옮기며 번호를 그대로 두려면 reshape:false.",
    "",
    "## 글자 배치 (입력)",
    "W 바위 벽 · h 고지대 · ~ 물 · g 자갈 · . 흙. 절벽 앞면은 높이가 떨어지는 칸 아래 두 줄에 자동.",
    FENCE,
    ...LAYOUT,
    FENCE,
    "",
    "## 특수 칸 (x,y)",
    "- 입구: 남쪽 두 칸 통로 (11..12, 18..19). (11,19)·(12,19) 에 바깥 맵으로 나가는 playerTouch 장소 이동, 바깥에서 오면 (11,19) 에 도착.",
    "- 고지대 (3..10, 4..6) — 위 두 줄 (2..3) 은 바위 벽 앞면. 오르는 돌계단 (5,7)~(6,8).",
    "- 어두운 굴 (16,3)~(17,4): 북동쪽 방 북쪽 벽 앞면. 아랫줄 (16,4)·(17,4) 에 다른 동굴 맵으로 가는 장소 이동.",
    "- 사다리(윗층) (18,15)~(18,16): 아랫칸 (18,16) 에 장소 이동.",
    "- 사다리 구멍(아래층) (20,17). 반짝이 (16,7): 숨은 도구 조사 이벤트.",
    "- 3층: 광석 (9,4) · 큰 석순 (19,5)~(19,6) · 밀 바위 (9,10) · 수정 (21,12) · 작은 석순 (4,15) · 깨는 바위 (12,17) · 돌무더기 (3,17)~(4,17).",
    "- 조우 region 예: 자갈 (12,11,4,3).",
    "",
    "## 1층",
    FENCE + "json",
    rowsJson(example.lower),
    FENCE,
    "",
    "## 3층 (-1 = 비움)",
    FENCE + "json",
    rowsJson(example.upper),
    FENCE,
  ].join("\n");
}

function checksDoc() {
  const lines = [
    "# 정상/오류 그림 · 구조 검사",
    "",
    "오류 그림은 완성 예제 배열을 한 곳만 변조한 것이고, 아래 오류 코드·맵 좌표는 prepare-monster-cave-references.mjs 의 checkCave·도달 검사가 실제로 뽑았다.",
    "검사 범위: 칸 번호·층·블롭 모양·앞면 순서·잘린 소품·입구 (11,19) 에서 고지대·굴·사다리·구멍·반짝이까지 4방 도달.",
    "이벤트 실행·미적 품질·저가 모델 성공률은 이 검사로 대신하지 않는다.",
    "",
  ];
  for (const v of variants) {
    lines.push("## " + v.id + " — " + v.caption);
    for (const e of v.errors.slice(0, 10)) {
      lines.push("- " + e.code + " @ (" + e.x + "," + e.y + ")" + (e.expected !== undefined ? " 기대 칸 " + e.expected : "") + (e.label ? " " + e.label : "") + (e.block ? " " + e.block : ""));
    }
    if (v.errors.length > 10) lines.push("- … 외 " + (v.errors.length - 10) + "건");
    lines.push("");
  }
  return lines.join("\n");
}

fs.mkdirSync(IMG_DIR, { recursive: true });
execFileSync("python3", ["scripts/content/render-monster-cave-references.py"], {
  input: JSON.stringify({ out: IMG_DIR, example, variants: variants.map(({ id, lower, upper, crop }) => ({ id, lower, upper, crop })) }),
  stdio: ["pipe", "inherit", "inherit"],
});
const img = (id, name, caption) => ({ id, name, caption, dataUrl: "/" + IMG_DIR.replace(/^public\//, "") + "/" + name });
const category = {
  id: "monster-cave-v1",
  name: "몬스터 동굴 · 바위 벽·고지대·절벽 앞면·사다리·계단·석순",
  description: "Scarloxy 화풍 생성 동굴 칩셋 한 장으로 몬스터 수집 게임의 동굴을 까는 법. 칸 사전, 47칸 블롭 마스크 표 네 세트, 조립 순서, 완성 예제 전체 배열, 정상/오류 그림과 검사 오류 코드.",
  documents: [
    { id: "monster-cave-dictionary", name: "칸 사전 · 블록 표·층·통행·부품 배열", markdown: dictionary() },
    { id: "monster-cave-edges", name: "가장자리 47칸 · 바위 벽·고지대·물·자갈 마스크 표", markdown: edgeSets() },
    { id: "monster-cave-steps", name: "조립 순서 · 바탕→블롭→절벽 앞면→계단·사다리·굴→장식→소품", markdown: steps() },
    { id: "monster-cave-example", name: "완성 예제 · 반짝 동굴 1층 전체 배열", markdown: exampleDoc() },
    { id: "monster-cave-checks", name: "정상/오류 · 변조와 검사 오류 코드", markdown: checksDoc() },
  ],
  images: [
    img("sheet-overview", "sheet-overview.png", "시트 전체 · 실제 타일(2배)"),
    img("cave-example", "cave-example.png", "완성 예제 · 반짝 동굴 1층(실제 배열 렌더, 2배)"),
    ...variants.map((v) => img(v.id + "-ok-bad", v.id + "-ok-bad.png", "왼쪽 정상 / 오른쪽 오류: " + v.caption)),
  ],
};
fs.writeFileSync(OUT_JSON, JSON.stringify(category, null, 1) + "\n");
console.log(OUT_JSON + ": " + category.documents.length + " docs, " + category.images.length + " images");
for (const v of variants) console.log(v.id, v.errors.length, JSON.stringify(v.errors.slice(0, 3)));

