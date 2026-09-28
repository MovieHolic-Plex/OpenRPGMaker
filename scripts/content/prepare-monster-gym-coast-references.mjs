// 체육관 내부 + 해변·항구 칩셋의 AI 참고문서를 만든다(번들 소유 — AGENTS 「새 타일·타일 학습은 공용에 추가한다」).
//
// 입력:
//   src/assets/monsterGymCoastManifest.json   부품 블록 좌표·층·통행(scripts/content/build-monster-gym-coast.py 출력)
//   src/assets/scarloxyPackManifest.json      위 반쪽(사막/설원 시트) 블록 좌표
// 출력:
//   src/assets/monsterGymCoastReferences.json          참고문서 카테고리 1개(이미지는 /assets/... 경로)
//   public/assets/monster-gym-coast/references/*.png   실제 타일로 합성한 예제·정상/오류 그림
//                                                      (scripts/content/render-monster-gym-coast-references.py)
//
// 예제 두 장(풀 체육관 14×15, 해변·항구 24×16)은 이 스크립트가 코드로 조립한다. 조립 직후 구조 검사
// (블록 통째·층·빈 1층·모서리 재료·도달성)를 돌려 오류가 하나라도 있으면 문서를 쓰지 않고 멈춘다.
// 정상/오류 그림의 오류 쪽은 예제를 실제로 변조해 만들고, 같은 검사가 낸 오류 코드와 좌표를 문서에 적는다.
// 실행: node scripts/content/prepare-monster-gym-coast-references.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const KIT = JSON.parse(fs.readFileSync("src/assets/monsterGymCoastManifest.json", "utf8"));
const PACK = JSON.parse(fs.readFileSync("src/assets/scarloxyPackManifest.json", "utf8"));
const OUT_JSON = "src/assets/monsterGymCoastReferences.json";
const IMG_DIR = "public/assets/monster-gym-coast/references";
const SHEET = "public/assets/monster-gym-coast/monster-gym-coast.png";
const TILESET_ID = "scarloxy_chipset_monster_gym_coast";
const COLS = 30;

const kit = Object.fromEntries(KIT.blocks.map((b) => [b.name, b]));
const base = Object.fromEntries(PACK.chipsets.find((c) => c.file === KIT.baseSheet).blocks.map((b) => [b.name, b]));
const id = (b, dx = 0, dy = 0) => (b.row + dy) * COLS + b.col + dx;
const K = (name, dx = 0, dy = 0) => id(kit[name], dx, dy);
const B = (name, dx = 0, dy = 0) => id(base[name], dx, dy);
const grid = (b) => Array.from({ length: b.h }, (_, dy) => Array.from({ length: b.w }, (_, dx) => id(b, dx, dy)));

// 위 반쪽에서 예제가 쓰는 칸
const SAND = 34; // 사막 모래 몸통(0 은 풀 조각 가장자리가 섞인 칸)
const SEA = 204; // 정지 바다(water-still-0)

// 칸 성질표: 칸 번호 → {block, dx, dy, layer, pass, stamp}. stamp=true 면 통째로 찍어야 하는 고정 조각.
const SET_KINDS = new Set(["floor", "pier", "sand", "ceiling", "shore", "sand-edge"]); // 칸마다 골라 쓰는 조각 모음
const info = new Map();
for (const b of KIT.blocks) {
  const open = new Set((b.openCells ?? []).map(([dx, dy]) => dx + "," + dy));
  for (let dy = 0; dy < b.h; dy += 1) for (let dx = 0; dx < b.w; dx += 1) {
    const pass = dy < (b.overRows ?? 0) || open.has(dx + "," + dy) ? "passable" : b.passage;
    info.set(id(b, dx, dy), { block: b.name, dx, dy, layer: b.layer, pass, stamp: !SET_KINDS.has(b.kind) && (b.w > 1 || b.h > 1) });
  }
}
for (const b of Object.values(base)) {
  for (let dy = 0; dy < b.h; dy += 1) for (let dx = 0; dx < b.w; dx += 1) {
    const t = id(b, dx, dy);
    if (info.has(t)) continue;
    const layer = b.kind === "terrain" || b.kind === "water" ? "lower" : "upper";
    const pass = b.kind === "terrain" || b.kind === "deco" ? "passable" : b.kind === "tree" ? (dy < b.h - 1 ? "passable" : "solid") : "solid";
    info.set(t, { block: b.name, dx, dy, layer, pass, stamp: (b.kind === "tree" || b.kind === "structure") && (b.w > 1 || b.h > 1) });
  }
}

// 모서리 재료. 칸마다 [왼위, 오른위, 왼아래, 오른아래]. 3×3 테두리 칸 (dx,dy)의 모서리 (gx,gy)(0~3)는
// gx,gy 가 둘 다 1~2 면 안쪽 재료. 안모서리 2×2 는 반대(구멍) 캔버스의 네 모서리 칸이다(빌드 스크립트와 같은 규칙).
const corners = new Map();
corners.set(SEA, ["sea", "sea", "sea", "sea"]);
corners.set(SAND, ["dry", "dry", "dry", "dry"]);
corners.set(K("wet-sand"), ["wet", "wet", "wet", "wet"]);
function ringCorners(ring, inner, outerMat, innerMat) {
  const inside = (gx, gy) => gx >= 1 && gx <= 2 && gy >= 1 && gy <= 2;
  const four = (dx, dy, f) => [[dx, dy], [dx + 1, dy], [dx, dy + 1], [dx + 1, dy + 1]].map(([gx, gy]) => f(gx, gy));
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) {
    corners.set(K(ring, dx, dy), four(dx, dy, (gx, gy) => (inside(gx, gy) ? innerMat : outerMat)));
  }
  [[0, 0], [2, 0], [0, 2], [2, 2]].forEach(([dx, dy], i) => {
    corners.set(K(inner, i % 2, Math.floor(i / 2)), four(dx, dy, (gx, gy) => (inside(gx, gy) ? outerMat : innerMat)));
  });
}
ringCorners("shore-sea", "shore-sea-inner", "sea", "wet");
ringCorners("sand-wet-edge", "sand-wet-edge-inner", "wet", "dry");
// 같은 조합이 여럿이면 먼저 넣은 칸(바다 204·모래 34·젖은 모래)을 쓴다 — 테두리 가운데 칸은 같은 재료라도 그림이 다르다.
const byCorners = new Map();
for (const [t, c] of corners) if (!byCorners.has(c.join(","))) byCorners.set(c.join(","), t);

const newMap = (w, h, fill) => ({ w, h, lower: Array(w * h).fill(fill), upper: Array(w * h).fill(-1) });
const at = (m, x, y) => y * m.w + x;
function stamp(m, name, x, y, layer = "upper", lookup = K) {
  const b = lookup === K ? kit[name] : base[name];
  for (let dy = 0; dy < b.h; dy += 1) for (let dx = 0; dx < b.w; dx += 1) m[layer][at(m, x + dx, y + dy)] = id(b, dx, dy);
}
const clone = (m) => ({ ...m, lower: [...m.lower], upper: [...m.upper] });

// 구조 검사. 확인 범위: 블록 통째, 층, 빈 1층, 모서리 재료 이음, 4방향 도달성(칸 통행표 기준).
function validate(m, { starts = [], targets = [], unreachable = [] } = {}) {
  const errors = [];
  const err = (code, x, y, detail) => errors.push({ code, x, y, detail });
  for (let y = 0; y < m.h; y += 1) for (let x = 0; x < m.w; x += 1) {
    const lo = m.lower[at(m, x, y)];
    if (lo < 0) err("E_LOWER_EMPTY", x, y, "1층이 비어 투명 부분이 검게 보인다");
    for (const layer of ["lower", "upper"]) {
      const t = m[layer][at(m, x, y)];
      if (t < 0) continue;
      const i = info.get(t);
      if (!i) { err("E_UNKNOWN_TILE", x, y, layer + " " + t); continue; }
      if (i.layer !== layer) err("E_WRONG_LAYER", x, y, i.block + " 는 " + (i.layer === "lower" ? "1층" : "3층") + " 부품인데 " + (layer === "lower" ? "1층" : "3층") + "에 있다");
      if (!i.stamp) continue;
      const b = kit[i.block] ?? base[i.block];
      for (let dy = 0; dy < b.h; dy += 1) for (let dx = 0; dx < b.w; dx += 1) {
        const xx = x - i.dx + dx, yy = y - i.dy + dy;
        const ok = xx >= 0 && yy >= 0 && xx < m.w && yy < m.h && m[layer][at(m, xx, yy)] === id(b, dx, dy);
        if (!ok) err("E_BLOCK_CUT", xx, yy, i.block + " 의 (" + dx + "," + dy + ") 칸이 없다");
      }
    }
    const c = corners.get(lo);
    if (!c) continue;
    const right = x + 1 < m.w ? corners.get(m.lower[at(m, x + 1, y)]) : null;
    const down = y + 1 < m.h ? corners.get(m.lower[at(m, x, y + 1)]) : null;
    if (right && (c[1] !== right[0] || c[3] !== right[2])) err("E_EDGE_MISMATCH", x + 1, y, "왼쪽 칸과 모서리 재료가 다르다(" + c[1] + "/" + c[3] + " ≠ " + right[0] + "/" + right[2] + ")");
    if (down && (c[2] !== down[0] || c[3] !== down[1])) err("E_EDGE_MISMATCH", x, y + 1, "위 칸과 모서리 재료가 다르다(" + c[2] + "/" + c[3] + " ≠ " + down[0] + "/" + down[1] + ")");
  }
  const seen = new Set();
  const out = errors.filter((e) => { const k = e.code + e.x + "," + e.y; if (seen.has(k)) return false; seen.add(k); return true; });
  const pass = (x, y) => {
    const up = m.upper[at(m, x, y)];
    return info.get(m.lower[at(m, x, y)])?.pass === "passable" && (up < 0 || info.get(up)?.pass === "passable");
  };
  const reached = new Set();
  const queue = [];
  for (const [x, y] of starts) {
    if (!pass(x, y)) { out.push({ code: "E_UNREACHABLE", x, y, detail: "출발 칸이 막혔다" }); continue; }
    reached.add(x + "," + y); queue.push([x, y]);
  }
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || reached.has(nx + "," + ny) || !pass(nx, ny)) continue;
      reached.add(nx + "," + ny); queue.push([nx, ny]);
    }
  }
  for (const [x, y, what] of targets) if (!reached.has(x + "," + y)) out.push({ code: "E_UNREACHABLE", x, y, detail: what + " 에 닿지 못한다" });
  for (const [x, y, what] of unreachable) if (reached.has(x + "," + y)) out.push({ code: "E_PUZZLE_BYPASS", x, y, detail: what + " 에 퍼즐 없이 닿는다" });
  return out;
}

// ---------------------------------------------------------------------------
// 예제 1: 풀 체육관 14×15. 방 안쪽 x 1..12, y 3..13. 입구 틈 (6,14)(7,14).
// ---------------------------------------------------------------------------
const CEIL = { plain: K("gym-ceiling", 0), r: K("gym-ceiling", 1), l: K("gym-ceiling", 2), t: K("gym-ceiling", 3), tr: K("gym-ceiling", 4), tl: K("gym-ceiling", 5), endL: K("gym-ceiling", 6), endR: K("gym-ceiling", 7) };
function buildGym(type) {
  const W = 14, H = 15;
  const m = newMap(W, H, CEIL.plain);
  const floor = kit["gym-floor-" + type];
  for (let y = 1; y < H - 1; y += 1) { m.lower[at(m, 0, y)] = CEIL.r; m.lower[at(m, W - 1, y)] = CEIL.l; }
  for (let x = 1; x <= 12; x += 1) {
    if (x === 6 || x === 7) continue;
    m.lower[at(m, x, 1)] = K("gym-wall-" + type, 0, 0);
    m.lower[at(m, x, 2)] = K("gym-wall-" + type, 0, 1);
  }
  stamp(m, "gym-wall-" + type + "-emblem", 6, 1, "lower");
  for (let y = 3; y <= 13; y += 1) for (let x = 1; x <= 12; x += 1) m.lower[at(m, x, y)] = id(floor, x % 4 === 2 && y % 4 === 0 ? 1 : 0, 0);
  for (let x = 1; x <= 12; x += 1) m.lower[at(m, x, H - 1)] = CEIL.t;
  m.lower[at(m, 0, H - 1)] = CEIL.tr;
  m.lower[at(m, W - 1, H - 1)] = CEIL.tl;
  m.lower[at(m, 5, H - 1)] = CEIL.endL;
  m.lower[at(m, 8, H - 1)] = CEIL.endR;
  m.lower[at(m, 6, H - 1)] = id(floor, 0, 0);
  m.lower[at(m, 7, H - 1)] = id(floor, 0, 0);
  stamp(m, "leader-podium-" + type, 5, 3);
  const deco = { grass: "gym-fern-pot", fire: "gym-brazier", water: "gym-fern-pot" }[type];
  stamp(m, deco, 1, 3); stamp(m, deco, 12, 3);
  for (let x = 1; x <= 12; x += 1) m.upper[at(m, x, 8)] = K("barrier-closed");
  stamp(m, "floor-switch-off", 2, 11);
  stamp(m, "trainer-marker", 9, 5);
  stamp(m, "trainer-marker", 10, 11);
  stamp(m, "badge-statue-" + type, 4, 12);
  stamp(m, "badge-statue-" + type, 9, 12);
  stamp(m, "gym-doormat", 6, 14);
  return m;
}
const GYM_SWITCH = [[2, 11, K("floor-switch-on")], [6, 8, K("barrier-open")], [7, 8, K("barrier-open")]];
function afterSwitch(m) {
  const n = clone(m);
  for (const [x, y, t] of GYM_SWITCH) n.upper[at(n, x, y)] = t;
  return n;
}
const gym = buildGym("grass");
const GYM_ROUTE = { starts: [[6, 14]], targets: [[2, 11, "바닥 스위치"]], unreachable: [[6, 4, "단상 계단"]] };
const GYM_ROUTE_OPEN = { starts: [[6, 14]], targets: [[6, 13, "입구 문앞(왼)"], [7, 13, "입구 문앞(오른)"], [6, 4, "단상 계단"], [9, 6, "트레이너 A 앞"], [10, 12, "트레이너 B 앞"]] };

// ---------------------------------------------------------------------------
// 예제 2: 해변·항구 24×16. 1층은 모서리 재료 격자에서 칸을 고른다.
// ---------------------------------------------------------------------------
const SHORE_X = [16, 16, 16, 15, 15, 15, 14, 14, 14, 15, 16, 17, 17, 17, 16, 16, 16]; // 모서리 줄마다 바다가 시작하는 x
function buildBeach() {
  const W = 24, H = 16;
  const m = newMap(W, H, SEA);
  const mat = (cx, cy) => { const s = SHORE_X[cy]; return cx >= s ? "sea" : cx >= s - 3 ? "wet" : "dry"; };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const key = [mat(x, y), mat(x + 1, y), mat(x, y + 1), mat(x + 1, y + 1)].join(",");
    const t = byCorners.get(key);
    if (t === undefined) throw new Error("모서리 조합에 맞는 칸이 없다: " + key + " @" + x + "," + y);
    m.lower[at(m, x, y)] = t;
  }
  for (let y = 6; y <= 7; y += 1) for (let x = 11; x <= 21; x += 1) m.lower[at(m, x, y)] = K("pier-deck-h");
  for (let x = 11; x <= 21; x += 1) if (m.lower[at(m, x, 8)] === SEA) m.lower[at(m, x, 8)] = K("pier-front");
  stamp(m, "mooring-bollard", 15, 6); stamp(m, "mooring-bollard", 19, 6);
  stamp(m, "rope-coil", 21, 7);
  stamp(m, "rowboat", 18, 10);
  stamp(m, "buoy", 22, 13);
  stamp(m, "sea-rock", 21, 2);
  stamp(m, "lighthouse", 1, 0);
  stamp(m, "palm", 6, 1, "upper", B);
  stamp(m, "palm-small", 9, 3, "upper", B);
  stamp(m, "coconut-pile", 8, 4);
  stamp(m, "beach-umbrella", 7, 10);
  stamp(m, "driftwood", 3, 12);
  stamp(m, "palm-shrub", 5, 14);
  stamp(m, "sand-rock-1", 10, 13, "upper", B);
  const wet = K("wet-sand");
  const place = (name, y) => { const x = m.lower.slice(y * W, y * W + W).indexOf(wet); if (x < 0) throw new Error("젖은 모래 없음 y=" + y); stamp(m, name, x, y); return [x, y]; };
  const shells = [place("starfish", 1), place("spiral-shell", 11), place("scallop-shell", 14)];
  return { m, shells };
}
const { m: beach, shells: SHELLS } = buildBeach();
const BEACH_ROUTE = { starts: [[0, 9]], targets: [[2, 6, "등대 문앞"], [21, 7, "부두 끝"], [8, 12, "파라솔 아래 모래"], ...SHELLS.map(([x, y]) => [x, y, "조개 칸"])] };

const okChecks = [
  ["체육관(스위치 전)", validate(gym, GYM_ROUTE)],
  ["체육관(스위치 후)", validate(afterSwitch(gym), GYM_ROUTE_OPEN)],
  ["해변", validate(beach, BEACH_ROUTE)],
];
for (const [name, errors] of okChecks) if (errors.length) throw new Error(name + " 예제 오류: " + JSON.stringify(errors));

// 변조 오류 4종 — 실제 배열을 바꿔 검사가 잡는지 본다.
const bad = [];
{
  const m = clone(gym); m.upper[at(m, 4, 12)] = -1;
  bad.push({ id: "statue-head", title: "조각상 머리 빠짐", ok: gym, m, crop: [2, 10, 5, 5], errors: validate(m) });
}
{
  const m = clone(gym);
  for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 3; dx += 1) { m.lower[at(m, 5 + dx, 3 + dy)] = m.upper[at(m, 5 + dx, 3 + dy)]; m.upper[at(m, 5 + dx, 3 + dy)] = -1; }
  bad.push({ id: "podium-layer", title: "단상을 1층에 찍음", ok: gym, m, crop: [3, 2, 7, 4], errors: validate(m) });
}
{
  const m = clone(beach);
  // 해안선이 곧은 줄(y 12: s=17→17)의 동쪽 변 조각을 서쪽 변 조각으로 바꾼다.
  const x = beach.lower.slice(12 * 24, 13 * 24).indexOf(K("shore-sea", 2, 1));
  if (x < 0) throw new Error("y 12 에 해안 동쪽 변 조각이 없다");
  m.lower[at(m, x, 12)] = K("shore-sea", 0, 1);
  bad.push({ id: "shore-flip", title: "해안 조각 방향 반대", ok: beach, m, crop: [x - 3, 10, 6, 5], errors: validate(m) });
}
{
  const m = clone(gym); stamp(m, "badge-statue-grass", 6, 12); stamp(m, "badge-statue-grass", 7, 12);
  bad.push({ id: "entrance-blocked", title: "입구 문앞 칸을 막음", ok: gym, m, crop: [3, 10, 8, 5], errors: validate(afterSwitch(m), GYM_ROUTE_OPEN) });
}
for (const b of bad) if (b.errors.length === 0) throw new Error(b.id + " 변조가 검출되지 않았다");

function renderImages() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const spec = { out: IMG_DIR, sheet: SHEET, gym, gymOpen: afterSwitch(gym), beach, bad: bad.map((b) => ({ id: b.id, ok: b.ok, m: b.m, crop: b.crop, marks: b.errors.map((e) => [e.x, e.y]) })) };
  execFileSync("python3", ["scripts/content/render-monster-gym-coast-references.py"], { input: JSON.stringify(spec), stdio: ["pipe", "inherit", "inherit"] });
}

// ---------------------------------------------------------------------------
// 문서
// ---------------------------------------------------------------------------
const FENCE = String.fromCharCode(96).repeat(3);
const rows2d = (m, layer) => Array.from({ length: m.h }, (_, y) => m[layer].slice(y * m.w, (y + 1) * m.w));
const layerName = (l) => (l === "lower" ? "1층(하위)" : "3층(상위)");
const passName = (b) => (b.passage === "passable" ? "○" : b.openPart === "stairs" ? "× (계단 칸 ○)" : b.openPart === "center" ? "× (가운데 ○)" : b.overRows ? "× (윗줄 ○)" : "×");
const RULES = {
  "gym-floor-neutral": "2칸 = A·B. A 를 깔고 드문드문 B.",
  "gym-floor-grass": "2칸 = A(무늬)·B(잎 문양).",
  "gym-floor-fire": "2칸 = A·B(불꽃 문양).",
  "gym-floor-water": "2칸 = A·B(물방울 문양).",
  "pier-deck-h": "1칸 반복.",
  "pier-deck-v": "1칸 반복.",
  "pier-front": "부두 바로 아래, 원래 바다인 칸에만 가로 반복.",
  "wet-sand": "1칸 반복. 모서리 재료 wet.",
  "gym-wall-grass": "1×2 기둥(위·아래)을 가로 반복.",
  "gym-wall-fire": "1×2 기둥을 가로 반복.",
  "gym-wall-water": "1×2 기둥을 가로 반복.",
  "gym-ceiling": "8칸을 자리마다 골라 쓴다(아래 천장 표).",
  "shore-sea": "3×3 테두리(모서리 재료 sea/wet).",
  "shore-sea-inner": "2×2 안모서리.",
  "sand-wet-edge": "3×3 테두리(모서리 재료 wet/dry).",
  "sand-wet-edge-inner": "2×2 안모서리.",
};
function dictionary() {
  const rows = KIT.blocks.map((b) => "| " + b.name + " | " + b.col + "," + b.row + " | " + b.w + "×" + b.h + " | " + id(b) + "~" + id(b, b.w - 1, b.h - 1) + " | " + layerName(b.layer) + " | " + passName(b) + " | " + (RULES[b.name] ?? (b.w * b.h > 1 ? "고정 블록, 통째로 찍는다." : "1칸.")) + " |");
  const kitJson = Object.fromEntries(KIT.blocks.map((b) => [b.name, grid(b)]));
  const baseUse = ["sand-terrain", "water-still-0", "palm", "palm-alt", "palm-small", "sand-rock-1", "sand-rock-2", "arena-plant", "arena-fire", "arena-water"];
  const baseJson = Object.fromEntries(baseUse.filter((n) => base[n]).map((n) => [n, grid(base[n])]));
  const cornerRows = [...corners].filter(([t]) => t >= 480 && t !== K("wet-sand")).map(([t, c]) => "| " + t + " | " + info.get(t).block + " (" + info.get(t).dx + "," + info.get(t).dy + ") | " + c.join(" · ") + " |");
  return [
    "# 체육관·해변 부품 · 칸 사전",
    "",
    "tilesetId=" + TILESET_ID + ". 이미지 tex_scarloxy_chipset_monster_gym_coast (public/assets/monster-gym-coast/monster-gym-coast.png, 480×512).",
    "16px 칸, 30열, 960칸. 좌표·번호는 0기준, 번호 = 행×30 + 열.",
    "",
    "## 두 반쪽",
    "- **0~479 = Scarloxy 사막/설원 시트 그대로.** scarloxy_chipset_wilds 와 번호가 같다(모래 34, 정지 바다 204~207, 야자 palm 2×3, 사막 바위, 풀·불·물 아레나 외관 7×7).",
    "- **480~959 = 새 부품(생성 자산).** 1층 부품은 칸을 꽉 채운 불투명 지형(바닥·벽·천장·부두·모래·해안), 3층 부품은 가장자리가 투명한 물체다.",
    "- 3층 부품을 1층에 두면 투명 픽셀 아래가 검게 보인다. 1층 부품을 3층에 두면 캐릭터 머리 위를 덮는다.",
    "- 다른 Scarloxy 시트(초원·실내)나 몬스터 마을 부품(scarloxy_chipset_monster_town_kit)의 번호를 섞지 않는다. 같은 번호라도 그림이 다르다.",
    "",
    "## 부품 표 (○ 통행 가능, × 막힘)",
    "| 블록 | 원점 열,행 | 크기 | 칸 번호 | 층 | 통행 | 규칙 |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "- 조각상·화분·화로·파라솔의 **윗줄**은 통행 가능(캐릭터가 뒤로 지나가며 머리 위에 그려진다), 아랫줄만 막힌다.",
    "- 관장 단상 3×2 는 **아래 가운데 계단 칸 (dx 1, dy 1)만 통행 가능**이다. 관장 이벤트는 윗줄 가운데 (dx 1, dy 0)에 둔다.",
    "- 해안 3×3 의 가운데 칸 (1,1)은 젖은 모래라 통행 가능, 둘레 8칸과 안모서리는 막힌다(바다가 섞였다).",
    "",
    "## 체육관 천장 8칸 (gym-ceiling, " + K("gym-ceiling") + "~" + K("gym-ceiling", 7) + ")",
    "| 칸 | 쓰는 자리 |",
    "|---|---|",
    "| " + CEIL.plain + " | 평면. 윗벽 위 줄, 방 바깥 |",
    "| " + CEIL.r + " | 방 **왼쪽** 벽줄(바닥이 오른쪽) |",
    "| " + CEIL.l + " | 방 **오른쪽** 벽줄(바닥이 왼쪽) |",
    "| " + CEIL.t + " | 방 **아래** 줄(바닥이 위) |",
    "| " + CEIL.tr + " | 왼아래 모서리(바닥이 오른위 대각) |",
    "| " + CEIL.tl + " | 오른아래 모서리(바닥이 왼위 대각) |",
    "| " + CEIL.endL + " | 입구 틈의 왼쪽 끝(바닥이 위·오른쪽) |",
    "| " + CEIL.endR + " | 입구 틈의 오른쪽 끝(바닥이 위·왼쪽) |",
    "",
    "## 모서리 재료 (이어 깔리는 지형)",
    "칸마다 네 모서리 [왼위 · 오른위 · 왼아래 · 오른아래]의 재료가 정해져 있다. 옆 칸과 **맞닿은 두 모서리 재료가 같아야** 이음새가 맞는다.",
    "재료: sea = 바다(204), wet = 젖은 모래(" + K("wet-sand") + "), dry = 마른 모래(34). sea 와 dry 는 한 칸에서 만나지 못한다 — 사이에 wet 을 한 줄 이상 둔다.",
    "| 칸 | 조각 | 모서리 재료 |",
    "|---|---|---|",
    "| 204 | 바다 | sea · sea · sea · sea |",
    "| 34 | 마른 모래 | dry · dry · dry · dry |",
    "| " + K("wet-sand") + " | 젖은 모래 | wet · wet · wet · wet |",
    ...cornerRows,
    "대각선 두 모서리만 같은 조합(예: sea · wet · wet · sea)은 칸이 없다. 해안선을 한 칸씩 계단으로 옮긴다.",
    "",
    "## 부품 전체 배열 (행 우선)",
    FENCE + "json",
    JSON.stringify(kitJson),
    FENCE,
    "",
    "## 위 반쪽에서 함께 쓰는 블록",
    FENCE + "json",
    JSON.stringify(baseJson),
    FENCE,
    "- palm·palm-alt 2×3, palm-small 1×2 는 3층. 마지막 줄(밑동)만 막히고 위 줄은 통행 가능.",
    "- 아레나 7×7(arena-plant/fire/water)은 체육관 **외관**이다. 외관 맨 아래 줄 가운데(dx 3)가 문이고, 그 문 칸의 transfer 가 이 칩셋의 체육관 내부 맵으로 간다.",
  ].join("\n");
}

function steps() {
  const pod = kit["leader-podium-grass"];
  return [
    "# 체육관·해변 조립 순서",
    "",
    "tilesetId=" + TILESET_ID + ". 번호는 「칸 사전」과 같다. 1층 = lowerTiles, 3층 = upperTiles.",
    "",
    "## A. 체육관 내부 (속성 T ∈ grass·fire·water, 방 안쪽 x0..x1, y0..y1)",
    "1. **천장 테두리(1층)**: 맨 윗줄 y0−3 전체와 방 바깥 칸은 천장 평면 " + CEIL.plain + ". 왼쪽 벽줄 x0−1 은 " + CEIL.r + ", 오른쪽 x1+1 은 " + CEIL.l + ".",
    "2. **윗벽(1층, 2줄)**: y0−2, y0−1 줄의 x0..x1 에 gym-wall-T 기둥 1×2(위 칸·아래 칸)를 가로로 반복. 가운데 두 칸에 gym-wall-T-emblem 2×2 를 통째로 한 번.",
    "3. **바닥(1층)**: y0..y1 × x0..x1 에 gym-floor-T 의 A. 문양 B 는 (x%4==2 && y%4==0) 칸에만. 전부 B 로 깔면 문양이 빽빽해 시끄럽다.",
    "4. **아래 천장 줄(1층, y1+1)**: " + CEIL.t + " 를 깔고 왼끝 모서리 " + CEIL.tr + ", 오른끝 모서리 " + CEIL.tl + ". 입구 틈(2칸)은 바닥 A 로 두고 틈 왼쪽 칸 " + CEIL.endL + ", 오른쪽 칸 " + CEIL.endR + ".",
    "5. **관장 단상(3층)**: leader-podium-T " + pod.w + "×" + pod.h + " 를 방 윗줄 y0 에 통째로. 관장 이벤트는 단상 (dx1, dy0), 도전자는 계단 칸 (dx1, dy1)에서 위를 보고 말을 건다.",
    "6. **장식(3층)**: 단상 양옆 끝에 화분·화로(1×2), 입구 안쪽 양옆에 badge-statue-T(1×2). 1×2 는 윗칸·아랫칸을 같이 찍는다.",
    "7. **트레이너 위치**: trainer-marker(3층)를 트레이너 이벤트 칸에 깐다. 트레이너 시선 방향으로 3~4칸 비워 둔다.",
    "8. **퍼즐(선택)**: 방을 가로지르는 차단기 줄(barrier-closed, 3층, ×)을 벽에서 벽까지 빈틈없이 두고, 줄 앞쪽 구역에 floor-switch-off(○). 스위치 칸의 playerTouch 이벤트가 changeTile 로 스위치 → floor-switch-on, 가운데 차단기 2칸 → barrier-open 으로 바꾼다.",
    "9. **입구**: 입구 틈 두 칸에 gym-doormat 2×1(3층). 그 칸의 playerTouch 이벤트가 바깥 맵(아레나 외관 문 아래 칸)으로 transfer. 들어올 때 도착 칸은 매트 바로 위 바닥.",
    "- 최소 크기: 방 안쪽 8×8(단상 줄 + 트레이너 + 입구 통로). 입구 문앞 칸(매트 위 바닥 2칸)은 비운다.",
    "",
    "## B. 해변·항구",
    "1. **재료 격자**: 맵 (W+1)×(H+1) 모서리 점마다 재료 sea/wet/dry 를 정한다. 해안선 x=s(y)에서 cx ≥ s → sea, s−3 ≤ cx < s → wet, 그 밖 → dry.",
    "   s 는 모서리 줄마다 **최대 ±1** 만 바꾼다(2 이상 바꾸면 대각 조합이 생겨 맞는 칸이 없다).",
    "2. **1층 칸 고르기**: 칸 (x,y)의 네 모서리 [(x,y),(x+1,y),(x,y+1),(x+1,y+1)] 재료 조합을 「칸 사전 · 모서리 재료」 표에서 찾아 그 칸을 쓴다. 전부 sea → 204, 전부 wet → " + K("wet-sand") + ", 전부 dry → 34.",
    "3. **부두(1층)**: 부두 사각형을 pier-deck-h(가로 부두) 또는 pier-deck-v(세로 잔교)로 덮는다. 모래에서 시작해 바다로 뻗게 하고, 부두 바로 아래 줄 중 원래 바다(204)였던 칸만 pier-front(×)로 바꾼다.",
    "4. **항구 소품(3층)**: 계류 기둥은 부두 가장자리 칸, 한 줄은 비워 걸어갈 길을 남긴다. 나룻배 3×2·부표·바다 바위는 바다(204) 칸 위에만.",
    "5. **등대 3×6(3층)**: 마른 모래 위에 통째로. 문 = (X+1, Y+5), 문앞 접근칸 (X+1, Y+6)은 비우고 문 칸에 조사 이벤트(transfer 등대 안)를 둔다.",
    "6. **해변 소품(3층)**: 야자(위 반쪽 palm 2×3), 야자 덤불, 야자열매, 파라솔 2×2, 유목 2×1 은 마른 모래 위. 조개·불가사리는 젖은 모래 칸(" + K("wet-sand") + ") 위에만 흩뿌린다.",
    "",
    "## 금지",
    "- 고정 블록 잘라 쓰기(단상 윗줄만, 조각상 아랫칸만, 등대 반쪽) → E_BLOCK_CUT.",
    "- 3층 부품을 1층에, 1층 지형을 3층에 두기 → E_WRONG_LAYER.",
    "- 해안·모래 경계 조각을 모서리 재료가 안 맞는 자리에 두기(반대 외곽) → E_EDGE_MISMATCH.",
    "- 입구 문앞·등대 문앞·부두 입구를 소품으로 막기 → E_UNREACHABLE.",
    "- 차단기 줄 끝에 빈칸을 남겨 스위치 없이 지나가게 두기 → E_PUZZLE_BYPASS.",
    "- 없는 소재: 파도 애니메이션(해안 조각은 정지 그림), 체육관 외벽·지붕(외관은 아레나 7×7), 실내 계단·층 이동, 얼음·바위 체육관 바닥, 배 갑판.",
  ].join("\n");
}

function exampleGym() {
  return [
    "# 완성 예제 · 풀 체육관 14×15",
    "",
    "A 절 순서대로 조립한 배열이다. gym-example.png(스위치 전)·gym-example-open.png(스위치 후)가 이 배열을 실제 타일로 그린 것이다.",
    "방 안쪽 x 1..12, y 3..13. 입구 틈 (6,14)(7,14). 차단기 줄 y 8.",
    "",
    "## 이벤트",
    "| 칸 | 이벤트 | 발동 | 내용 |",
    "|---|---|---|---|",
    "| (6,3) | 관장 | 조사 | 대화 → battleProcessing. 도전자는 (6,4) 계단에서 말을 건다. |",
    "| (9,5) | 트레이너 A | 조사·시선 | trainer-marker 위. 아래를 본다. |",
    "| (10,11) | 트레이너 B | 조사·시선 | trainer-marker 위. 왼쪽을 본다. |",
    "| (2,11) | 바닥 스위치 | playerTouch | " + GYM_SWITCH.map(([x, y, t]) => "changeTile upper (" + x + "," + y + ")→" + t).join(", ") + ", 셀프 스위치 A 켬(한 번만). |",
    "| (6,14)(7,14) | 출구 | playerTouch | transfer → 바깥 아레나 외관 문 아래 칸. 들어올 때 도착 (6,13), 위 방향. |",
    "",
    "changeTile 명령 모양: " + JSON.stringify({ kind: "changeTile", mapId: "<이 맵 id>", layer: "upper", x: 6, y: 8, tile: K("barrier-open") }),
    "",
    "## 1층",
    FENCE + "json",
    JSON.stringify(rows2d(gym, "lower")),
    FENCE,
    "## 3층 (-1 = 비움)",
    FENCE + "json",
    JSON.stringify(rows2d(gym, "upper")),
    FENCE,
    "",
    "## 속성 바꾸기",
    "fire 체육관: 바닥 " + K("gym-floor-fire") + "/" + K("gym-floor-fire", 1) + ", 벽 " + K("gym-wall-fire") + "/" + K("gym-wall-fire", 0, 1) + ", 문장 gym-wall-fire-emblem, 단상 leader-podium-fire, 조각상 badge-statue-fire, 장식 gym-brazier.",
    "water 체육관: 바닥 " + K("gym-floor-water") + "/" + K("gym-floor-water", 1) + ", 벽 " + K("gym-wall-water") + "/" + K("gym-wall-water", 0, 1) + ", leader-podium-water, badge-statue-water, 장식 자리에 분수대 gym-fountain 2×2(가로 2칸 필요).",
    "배열의 같은 자리 번호만 바꾸면 된다(천장·차단기·스위치·매트·표시는 공통).",
  ].join("\n");
}

function exampleBeach() {
  return [
    "# 완성 예제 · 해변과 부두 24×16",
    "",
    "B 절 순서대로 조립한 배열이다. beach-example.png 가 이 배열을 실제 타일로 그린 것이다.",
    "해안선 s(모서리 줄 0..16) = " + JSON.stringify(SHORE_X) + ". 젖은 모래 띠 폭 3. 부두 y 6..7, x 11..21.",
    "",
    "## 이벤트",
    "| 칸 | 이벤트 | 발동 | 내용 |",
    "|---|---|---|---|",
    "| (0,9) | 서쪽 출구 | playerTouch | transfer → 이웃 길. |",
    "| (2,5) | 등대 문 | 조사 | 문 칸(3층 등대 dx1,dy5). 주인공은 (2,6)에서 위를 보고 조사 → transfer 등대 안. |",
    "| (21,7) | 부두 끝 뱃사람 | 조사 | 배 타기 대화. |",
    "| " + SHELLS.map(([x, y]) => "(" + x + "," + y + ")").join(" ") + " | 조개·불가사리 | 조사(선택) | 아이템 줍기. |",
    "",
    "## 1층",
    FENCE + "json",
    JSON.stringify(rows2d(beach, "lower")),
    FENCE,
    "## 3층 (-1 = 비움)",
    FENCE + "json",
    JSON.stringify(rows2d(beach, "upper")),
    FENCE,
  ].join("\n");
}

function checks() {
  const list = (errors) => errors.map((e) => "- " + e.code + " (" + e.x + "," + e.y + ") " + e.detail).join("\n");
  return [
    "# 자동 구조 검사 · 오류 코드와 변조 예",
    "",
    "prepare-monster-gym-coast-references.mjs 의 validate()가 확인하는 것:",
    "- **E_BLOCK_CUT** 고정 블록(단상·조각상·등대·문장 벽·파라솔·배·야자 등)의 칸이 제자리에 다 있는가.",
    "- **E_WRONG_LAYER** 칸이 제 층(1층 지형 / 3층 물체)에 있는가.",
    "- **E_LOWER_EMPTY** 1층이 빈 칸이 없는가.",
    "- **E_EDGE_MISMATCH** 모서리 재료가 있는 1층 칸(바다·모래·해안·모래 경계)끼리 맞닿은 모서리 재료가 같은가.",
    "- **E_UNREACHABLE / E_PUZZLE_BYPASS** 칸 통행표(1층 ○ 이고 3층이 비었거나 ○)로 4방향 걸어서 목표 칸에 닿는가, 퍼즐 뒤 칸에 스위치 없이 닿지는 않는가.",
    "",
    "확인하지 않는 것: 이벤트 실행 결과(스위치가 실제로 changeTile 을 부르는지), 트레이너 시선, 미적 품질, 저가 모델의 성공률. 통행표는 이 칩셋 그룹의 통행값(칸 사전 표)에서 만든 것이며 편집기 엔진 판정을 대신 돌린 것은 아니다.",
    "예제 두 장은 조립 직후 이 검사를 통과해야 문서가 만들어진다. 결과: " + okChecks.map(([n, e]) => n + " 오류 " + e.length + "개").join(", ") + ".",
    "",
    ...bad.flatMap((b) => ["## " + b.title + " (" + b.id + "-ok-bad.png)", "왼쪽 정상 / 오른쪽 변조. 빨간 칸 = 검사가 보고한 좌표(맵 좌표, 그림은 잘라 낸 부분).", list(b.errors), ""]),
  ].join("\n");
}

renderImages();
const img = (iid, name, caption) => ({ id: iid, name, caption, dataUrl: "/" + IMG_DIR.replace(/^public\//, "") + "/" + name });
const documents = [
  { id: "gym-coast-dictionary", name: "칸 사전 · 두 반쪽·부품 표·천장·모서리 재료·전체 배열", markdown: dictionary() },
  { id: "gym-coast-steps", name: "조립 순서 · 체육관 내부·해변·부두·금지", markdown: steps() },
  { id: "gym-coast-example-gym", name: "완성 예제 · 풀 체육관 14×15 전체 배열·이벤트", markdown: exampleGym() },
  { id: "gym-coast-example-beach", name: "완성 예제 · 해변과 부두 24×16 전체 배열·이벤트", markdown: exampleBeach() },
  { id: "gym-coast-checks", name: "자동 구조 검사 · 오류 코드·변조 예", markdown: checks() },
];
const images = [
  img("kit-overview", "kit-overview.png", "부품 480~ 전체(왼쪽 20열) · 실제 타일 2배, 투명은 회색 체크"),
  img("gym-example", "gym-example.png", "완성 예제 · 풀 체육관(스위치 전, 실제 배열 렌더)"),
  img("gym-example-open", "gym-example-open.png", "완성 예제 · 풀 체육관(스위치 후 차단기 두 칸 열림)"),
  img("beach-example", "beach-example.png", "완성 예제 · 해변과 부두(실제 배열 렌더)"),
  ...bad.map((b) => img(b.id + "-ok-bad", b.id + "-ok-bad.png", "왼쪽 정상 / 오른쪽 오류: " + b.title + " — " + [...new Set(b.errors.map((e) => e.code))].join(", "))),
];
const category = {
  id: "monster-gym-coast-v1",
  name: "체육관 내부·해변·항구 · 속성 바닥·벽·단상·퍼즐·해안·부두·등대",
  description: "Scarloxy 사막/해안(0~479) + 생성 부품(480~959) 한 장으로 몬스터 수집 게임의 체육관 내부와 해변·항구를 까는 법. 칸 사전, 모서리 재료, 조립 순서, 완성 예제 전체 배열 2장, 자동 구조 검사와 정상/오류 그림.",
  documents,
  images,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(category, null, 1) + "\n");
console.log(OUT_JSON + ": " + documents.length + " docs, " + images.length + " images, markdown " + documents.map((d) => d.markdown.length).join("/"));
for (const b of bad) console.log(b.id, JSON.stringify(b.errors));
