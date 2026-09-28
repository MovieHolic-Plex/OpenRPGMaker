// 몬스터 실내 칩셋의 AI 참고문서를 만든다(번들 소유 — AGENTS 「새 타일·타일 학습은 공용에 추가한다」).
//
// 입력:  src/assets/monsterInteriorManifest.json  (scripts/content/build-monster-interior.py 출력)
// 출력:  src/assets/monsterInteriorReferences.json            참고문서 카테고리 1개(이미지는 /assets/... 경로)
//        public/assets/monster-interior/references/*.png      실제 타일로 합성한 방 그림·정상/오류 그림
//
// 방 네 개(회복 센터·도구 상점·주인공 집·연구소)를 여기서 조립해 전체 1층/3층 배열을 문서에 싣고,
// 같은 배열을 시트의 실제 칸으로 그린다(AI 가 그린 모형이 아니다). 조립 뒤 구조 검사를 돌려
// 정답 방은 오류 0 이어야 하고, 일부러 망가뜨린 방은 정해진 오류 코드를 내야 한다. 어긋나면 실패로 끝난다.
// 실행: node scripts/content/prepare-monster-interior-references.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const KIT = JSON.parse(fs.readFileSync("src/assets/monsterInteriorManifest.json", "utf8"));
const OUT_JSON = "src/assets/monsterInteriorReferences.json";
const IMG_DIR = "public/assets/monster-interior/references";
const SHEET = "public/assets/monster-interior/monster-interior.png";
const TILESET_ID = "scarloxy_chipset_monster_interior";
const COLS = 30;
const T = KIT.tiles;
const B = Object.fromEntries(KIT.blocks.map((b) => [b.name, b]));
const tileOf = (b, dx = 0, dy = 0) => (b.row + dy) * COLS + b.col + dx;
const grid = (b) => Array.from({ length: b.h }, (_, dy) => Array.from({ length: b.w }, (_, dx) => tileOf(b, dx, dy)));

// 종류 → [층, 통행]. 빌드 스크립트의 kind 와 scarloxyPack.ts MONSTER_INTERIOR_LABELS 가 같은 규칙을 쓴다.
const KIND_RULE = {
  floor: ["1층", "○"], rug: ["1층", "○"], mat: ["1층", "○"], stairs: ["1층", "○"],
  frame: ["1층", "×"], wall: ["1층", "×"], "wall-decor": ["3층", "×"], furniture: ["3층", "×"],
};
const NAMES = {
  "floor-wood": "나무 마루", "floor-tile": "흰 타일", "floor-carpet-red": "빨간 카펫", "floor-carpet-teal": "청록 카펫",
  "rug-red": "빨간 깔개 3×3", "rug-teal": "청록 깔개 3×3", "wall-frame": "벽 틀(바깥)", "wall-frame-inner": "벽 틀 안쪽 모서리",
  "wall-mint": "민트 벽", "wall-lavender": "라벤더 벽", "wall-cream": "크림 벽",
  "door-mat-wood": "문 매트(마루)", "door-mat-wide-wood": "넓은 문 매트(마루)", "door-mat-tile": "문 매트(타일)", "door-mat-wide-tile": "넓은 문 매트(타일)",
  "stairs-up": "올라가는 계단", "stairs-down": "내려가는 계단", "wall-window": "창문", "wall-clock": "벽시계", "wall-poster": "몬스터 포스터", whiteboard: "화이트보드",
  "reception-counter": "접수 카운터", "healing-machine": "회복 기계", "pc-terminal": "PC 단말", "lobby-bench": "로비 의자", "potted-plant": "화분",
  "shelf-wall": "벽 진열대", "shelf-island": "가운데 진열대", "shop-counter": "계산대", "drink-cooler": "음료 냉장고",
  bed: "침대", "tv-set": "TV", "dining-table": "식탁", "chair-down": "의자(아래 보기)", "chair-up": "의자(위 보기)", "kitchen-counter": "부엌 조리대",
  bookshelf: "책장", "lab-bench": "실험대", "starter-stand": "스타터 볼 받침대", "lab-computer": "연구 컴퓨터",
};

// ---------------------------------------------------------------------------
// 방 조립기. 모든 예제와 오류 변조가 이 함수들만 쓴다.
// ---------------------------------------------------------------------------
function shell({ w, h, floor, wall }) {
  const lower = new Array(w * h).fill(T[floor]);
  const upper = new Array(w * h).fill(-1);
  const at = (x, y) => y * w + x;
  for (let x = 0; x < w; x += 1) {
    lower[at(x, 0)] = x === 0 ? T["frame-corner-nw"] : x === w - 1 ? T["frame-corner-ne"] : T["frame-top"];
    lower[at(x, h - 1)] = x === 0 ? T["frame-corner-sw"] : x === w - 1 ? T["frame-corner-se"] : T["frame-bottom"];
  }
  for (let y = 1; y < h - 1; y += 1) {
    lower[at(0, y)] = T["frame-left"];
    lower[at(w - 1, y)] = T["frame-right"];
  }
  for (let x = 1; x < w - 1; x += 1) {
    lower[at(x, 1)] = T[wall + "-upper"];
    lower[at(x, 2)] = T[wall + "-lower"];
  }
  return { w, h, lower, upper, events: [], interact: [] };
}
function stamp(room, name, x, y, layer) {
  const b = B[name];
  const target = layer ?? (KIND_RULE[b.kind][0] === "1층" ? "lower" : "upper");
  for (let dy = 0; dy < b.h; dy += 1) for (let dx = 0; dx < b.w; dx += 1) room[target][(y + dy) * room.w + x + dx] = tileOf(b, dx, dy);
  room.placed = [...(room.placed ?? []), { name, x, y, layer: target }];
}
function event(room, id, x, y, trigger, what, front) {
  room.events.push({ id, x, y, trigger, what });
  if (front) room.interact.push({ id, x: front[0], y: front[1] });
}

function center() {
  const r = shell({ w: 15, h: 11, floor: "floor-tile", wall: "wall-mint" });
  stamp(r, "wall-window", 3, 1); stamp(r, "wall-window", 10, 1); stamp(r, "wall-clock", 7, 1); stamp(r, "wall-poster", 13, 1);
  stamp(r, "rug-teal", 6, 6);
  stamp(r, "reception-counter", 5, 4);
  stamp(r, "healing-machine", 10, 3);
  stamp(r, "pc-terminal", 13, 3);
  stamp(r, "potted-plant", 1, 3);
  stamp(r, "lobby-bench", 2, 7); stamp(r, "potted-plant", 1, 7);
  stamp(r, "lobby-bench", 10, 7); stamp(r, "potted-plant", 13, 7);
  stamp(r, "door-mat-tile", 7, 9);
  event(r, "접수원(그림)", 7, 3, "없음", "접수원 캐릭터 그림만. 말은 카운터 칸 이벤트가 받는다.");
  event(r, "회복", 7, 5, "조사", "카운터 앞줄 가운데 칸. recoverAll + 회복 연출.", [7, 6]);
  event(r, "PC", 13, 4, "조사", "PC 단말 아래 칸. 몬스터 보관함 열기.", [13, 5]);
  event(r, "출구", 7, 9, "밟기", "문 매트. 마을의 센터 문 앞으로 이동. 들어올 때 도착 칸은 (7,8).", null);
  return r;
}
function shop() {
  const r = shell({ w: 11, h: 9, floor: "floor-tile", wall: "wall-cream" });
  stamp(r, "wall-poster", 5, 1); stamp(r, "wall-clock", 7, 1);
  stamp(r, "shop-counter", 1, 4);
  stamp(r, "shelf-wall", 4, 3);
  stamp(r, "drink-cooler", 8, 3);
  stamp(r, "shelf-island", 7, 5);
  stamp(r, "potted-plant", 9, 5);
  stamp(r, "door-mat-tile", 5, 7);
  event(r, "점원(그림)", 2, 3, "없음", "점원 캐릭터 그림만.");
  event(r, "상점", 2, 5, "조사", "계산대 앞줄 가운데 칸. shop 명령(물건 목록).", [2, 6]);
  event(r, "출구", 5, 7, "밟기", "문 매트. 도착 칸은 (5,6).", null);
  return r;
}
function home() {
  const r = shell({ w: 11, h: 9, floor: "floor-wood", wall: "wall-cream" });
  stamp(r, "wall-window", 5, 1); stamp(r, "wall-clock", 3, 1);
  stamp(r, "kitchen-counter", 1, 3);
  stamp(r, "tv-set", 5, 3);
  stamp(r, "stairs-up", 8, 3);
  stamp(r, "bed", 1, 5);
  stamp(r, "chair-down", 7, 4);
  stamp(r, "dining-table", 6, 5);
  stamp(r, "chair-up", 7, 7);
  stamp(r, "door-mat-wood", 4, 7);
  event(r, "TV", 5, 4, "조사", "TV 아래 줄. 글 한 줄.", [5, 5]);
  event(r, "침대", 1, 7, "조사", "침대 아래 줄 왼칸. 잠자기 = recoverAll.", [3, 7]);
  event(r, "2층", 8, 3, "밟기", "계단 윗줄. 2층 방으로 이동(2층 맵은 따로 만든다).", null);
  event(r, "출구", 4, 7, "밟기", "문 매트. 도착 칸은 (4,6).", null);
  return r;
}
function lab() {
  const r = shell({ w: 13, h: 11, floor: "floor-tile", wall: "wall-mint" });
  stamp(r, "wall-window", 2, 1); stamp(r, "whiteboard", 6, 1); stamp(r, "wall-window", 9, 1);
  stamp(r, "bookshelf", 1, 3); stamp(r, "bookshelf", 3, 3);
  stamp(r, "lab-computer", 10, 3);
  stamp(r, "starter-stand", 5, 5);
  stamp(r, "potted-plant", 11, 5);
  stamp(r, "lab-bench", 1, 7); stamp(r, "lab-bench", 9, 7);
  stamp(r, "door-mat-tile", 6, 9);
  event(r, "박사(그림)", 6, 4, "조사", "박사 캐릭터. 스타터 설명.", [6, 3]);
  for (const [x, c] of [[5, "풀"], [6, "불"], [7, "물"]]) event(r, "스타터 " + c, x, 6, "조사", "받침대 앞줄. 이 볼의 몬스터를 준다.", [x, 7]);
  event(r, "책장", 2, 4, "조사", "책장 아래 줄. 연구 자료 글.", [2, 5]);
  event(r, "출구", 6, 9, "밟기", "문 매트. 도착 칸은 (6,8).", null);
  return r;
}

// ---------------------------------------------------------------------------
// 구조 검사. 확인 범위: 블록 완결성(잘린 가구)·레이어(가구가 1층, 바닥이 3층)·틀 방향(모서리·변)·
// 벽 장식 위치(벽 칸 위)·통행(문 매트에서 조사 앞칸까지 걸어 닿는가). 이벤트 실행·미적 품질은 확인하지 않는다.
// ---------------------------------------------------------------------------
const kindOf = new Map();
const blockOf = new Map();
for (const b of KIT.blocks) for (let dy = 0; dy < b.h; dy += 1) for (let dx = 0; dx < b.w; dx += 1) {
  kindOf.set(tileOf(b, dx, dy), b.kind); blockOf.set(tileOf(b, dx, dy), [b, dx, dy]);
}
const solidLower = (t) => ["frame", "wall"].includes(kindOf.get(t));
function frameExpected(room, x, y) {
  const inside = (xx, yy) => xx >= 1 && yy >= 1 && xx <= room.w - 2 && yy <= room.h - 2;
  if (inside(x, y)) return null;
  const n = inside(x, y - 1), s = inside(x, y + 1), w = inside(x - 1, y), e = inside(x + 1, y);
  if (s) return "frame-top"; if (n) return "frame-bottom"; if (e) return "frame-left"; if (w) return "frame-right";
  if (inside(x + 1, y + 1)) return "frame-corner-nw"; if (inside(x - 1, y + 1)) return "frame-corner-ne";
  if (inside(x + 1, y - 1)) return "frame-corner-sw"; if (inside(x - 1, y - 1)) return "frame-corner-se";
  return "frame-ceiling";
}
function validate(room) {
  const errors = [];
  const { w, h } = room;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const i = y * w + x;
    const lo = room.lower[i], up = room.upper[i];
    const exp = frameExpected(room, x, y);
    if (exp && lo !== T[exp]) errors.push({ code: "FRAME_DIRECTION", x, y, detail: exp + " 자리에 " + lo });
    if (["furniture", "wall-decor"].includes(kindOf.get(lo))) errors.push({ code: "FURNITURE_ON_LOWER", x, y, detail: String(lo) });
    if (up >= 0 && ["floor", "rug", "mat", "stairs", "frame", "wall"].includes(kindOf.get(up))) errors.push({ code: "FLOOR_ON_UPPER", x, y, detail: String(up) });
    if (up >= 0 && kindOf.get(up) === "wall-decor" && kindOf.get(lo) !== "wall") errors.push({ code: "WALL_DECOR_OFF_WALL", x, y, detail: String(up) });
  }
  // 블록 완결성: 3층 가구 칸마다 같은 블록의 이웃 칸이 제자리에 있어야 한다.
  for (const layer of ["lower", "upper"]) for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const t = room[layer][y * w + x];
    const hit = blockOf.get(t);
    if (!hit) continue;
    const [b, dx, dy] = hit;
    if (!["furniture", "wall-decor", "stairs", "rug", "mat"].includes(b.kind)) continue;
    const ox = x - dx, oy = y - dy;
    let whole = ox >= 0 && oy >= 0 && ox + b.w <= w && oy + b.h <= h;
    for (let yy = 0; whole && yy < b.h; yy += 1) for (let xx = 0; xx < b.w; xx += 1) if (room[layer][(oy + yy) * w + ox + xx] !== tileOf(b, xx, yy)) whole = false;
    if (!whole) errors.push({ code: "BLOCK_CUT", x, y, detail: b.name });
  }
  // 통행: 문 매트에서 걸어서 조사 앞칸마다 닿는가.
  const blocked = (x, y) => solidLower(room.lower[y * w + x]) || (room.upper[y * w + x] >= 0);
  const mat = room.events.find((e) => e.id === "출구");
  const seen = new Set([mat.y * w + mat.x]);
  const queue = [[mat.x, mat.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(ny * w + nx) || blocked(nx, ny)) continue;
      seen.add(ny * w + nx); queue.push([nx, ny]);
    }
  }
  if (!["floor", "rug", "mat"].includes(kindOf.get(room.lower[mat.y * w + mat.x])) || room.upper[mat.y * w + mat.x] >= 0) errors.push({ code: "EXIT_BLOCKED", x: mat.x, y: mat.y, detail: "출구 칸이 막혔다" });
  for (const f of room.interact) if (!seen.has(f.y * w + f.x)) errors.push({ code: "UNREACHABLE", x: f.x, y: f.y, detail: f.id + " 앞칸에 걸어갈 수 없다" });
  return errors;
}

const rooms = { center: ["몬스터 회복 센터", center()], shop: ["도구 상점", shop()], home: ["주인공 집", home()], lab: ["연구소", lab()] };
for (const [key, [, room]] of Object.entries(rooms)) {
  const errors = validate(room);
  if (errors.length) throw new Error(key + " 정답 방에 오류: " + JSON.stringify(errors));
}

// 오류 변조 — 각각 정해진 코드가 나와야 한다.
const bad = [];
function mutate(id, base, fn, code, caption) {
  const room = structuredClone(base);
  fn(room);
  const errors = validate(room);
  const hit = errors.filter((e) => e.code === code);
  if (!hit.length) throw new Error(id + ": 기대 오류 " + code + " 가 안 나왔다 " + JSON.stringify(errors));
  bad.push({ id, code, caption, room, ok: base, errors: hit });
}
const c0 = rooms.center[1], s0 = rooms.shop[1], h0 = rooms.home[1], l0 = rooms.lab[1];
mutate("furniture-lower", s0, (r) => { const b = B["shelf-island"]; for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) { const i = (5 + dy) * r.w + 7 + dx; r.upper[i] = -1; r.lower[i] = tileOf(b, dx, dy); } }, "FURNITURE_ON_LOWER", "가운데 진열대를 1층에 칠해 바닥이 지워졌다(투명 칸이 검게 보인다)");
mutate("frame-direction", c0, (r) => { r.lower[0] = T["frame-corner-ne"]; r.lower[r.w - 1] = T["frame-corner-nw"]; }, "FRAME_DIRECTION", "윗줄 양 끝 모서리를 좌우 반대로 놓아 흰 띠가 끊겼다");
mutate("block-cut", h0, (r) => { for (let x = 1; x <= 2; x += 1) r.upper[5 * r.w + x] = -1; }, "BLOCK_CUT", "침대 머리 줄을 빠뜨려 베개가 잘렸다");
mutate("exit-blocked", l0, (r) => { stamp(r, "lab-bench", 5, 8); }, "UNREACHABLE", "실험대를 문 매트 앞에 놓아 스타터 받침대까지 걸어갈 수 없다");
mutate("decor-off-wall", h0, (r) => { const b = B["wall-clock"]; r.upper[1 * r.w + 3] = -1; r.upper[4 * r.w + 4] = tileOf(b); }, "WALL_DECOR_OFF_WALL", "벽시계를 벽이 아닌 바닥에 걸었다");

// ---------------------------------------------------------------------------
// 그림
// ---------------------------------------------------------------------------
fs.mkdirSync(IMG_DIR, { recursive: true });
const spec = {
  sheet: SHEET, out: IMG_DIR,
  renders: [
    ...Object.entries(rooms).map(([key, [, r]]) => ({ name: key + "-example.png", rooms: [r], scale: 3 })),
    ...bad.map((b) => ({ name: b.id + "-ok-bad.png", rooms: [b.ok, b.room], marks: [[], b.errors.map((e) => [e.x, e.y])], scale: 2 })),
  ],
  overview: KIT.blocks.map((b) => [b.col, b.row, b.w, b.h]),
};
const py = String.raw`
import json, sys
from PIL import Image, ImageDraw
spec = json.loads(sys.stdin.read())
sheet = Image.open(spec["sheet"]).convert("RGBA")
T = 16
def tile(i): return sheet.crop(((i % 30) * T, (i // 30) * T, (i % 30) * T + T, (i // 30) * T + T))
def draw(r, marks):
    im = Image.new("RGBA", (r["w"] * T, r["h"] * T), (0, 0, 0, 255))
    for layer in ("lower", "upper"):
        for i, t in enumerate(r[layer]):
            if t >= 0: im.alpha_composite(tile(t), ((i % r["w"]) * T, (i // r["w"]) * T))
    d = ImageDraw.Draw(im)
    for x, y in marks: d.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(255, 40, 40, 255), width=2)
    return im
for job in spec["renders"]:
    ims = [draw(r, (job.get("marks") or [[]] * len(job["rooms"]))[k]) for k, r in enumerate(job["rooms"])]
    W = sum(i.width for i in ims) + 8 * (len(ims) - 1); H = max(i.height for i in ims)
    out = Image.new("RGBA", (W, H), (255, 255, 255, 255)); x = 0
    for i in ims: out.paste(i, (x, 0)); x += i.width + 8
    s = job["scale"]
    out.resize((out.width * s, out.height * s), Image.NEAREST).convert("RGB").save(spec["out"] + "/" + job["name"], optimize=True)
# 부품 한눈에: 체크 무늬 바탕 + 블록 테두리
im = Image.new("RGBA", sheet.size, (0, 0, 0, 0))
for y in range(0, sheet.height, 8):
    for x in range(0, sheet.width, 8):
        im.paste((236, 236, 236, 255) if (x // 8 + y // 8) % 2 else (212, 212, 212, 255), (x, y, x + 8, y + 8))
im.alpha_composite(sheet)
im = im.crop((0, 0, 480, 160)).resize((960, 320), Image.NEAREST)
d = ImageDraw.Draw(im)
for c, r, w, h in spec["overview"]:
    d.rectangle([c * 32, r * 32, (c + w) * 32 - 1, (r + h) * 32 - 1], outline=(230, 60, 60, 255), width=1)
im.convert("RGB").save(spec["out"] + "/kit-overview.png", optimize=True)
print("images ok")
`;
execFileSync("python3", ["-c", py], { input: JSON.stringify(spec), stdio: ["pipe", "inherit", "inherit"] });

// ---------------------------------------------------------------------------
// 문서
// ---------------------------------------------------------------------------
function dictionary() {
  const rows = KIT.blocks.map((b) => {
    const [layer, pass] = KIND_RULE[b.kind];
    return "| " + b.name + " | " + (NAMES[b.name] ?? b.name) + " | " + b.col + "," + b.row + " | " + b.w + "×" + b.h + " | " + tileOf(b) + "~" + tileOf(b, b.w - 1, b.h - 1) + " | " + layer + " | " + pass + " |";
  });
  const named = Object.entries(T).map(([k, v]) => "| " + k + " | " + v + " |");
  return [
    "# 몬스터 실내 · 칸 사전",
    "",
    "tilesetId=" + TILESET_ID + ". 이미지 tex_scarloxy_chipset_monster_interior (public/assets/monster-interior/monster-interior.png, 480×256).",
    "16px 칸, 30열, 480칸. 좌표·번호는 0기준, 번호 = 행×30 + 열. 다른 칩셋(scarloxy_chipset_indoor·easyrpg_chipset_interior)의 번호를 섞지 않는다.",
    "",
    "## 출처",
    "- **바닥 나무 마루·흰 타일, 민트·라벤더 벽 색, 틀(검은 바깥 + 회색 선 + 흰 띠 3px)** = Scarloxy 실내 원본(vendor/scarloxy-mpwsp01/graphics/tilesets/indoor.png)을 원래 해상도로 되돌려 뜬 것.",
    "- **카펫·깔개·문 매트·크림 벽** = 같은 팔레트로 찍은 손 도트.",
    "- **가구·벽 장식·계단** = 이미지 생성 모델로 Scarloxy 화풍에 맞춰 그린 생성 자산(팩 원본 아님).",
    "",
    "## 층 규칙",
    "- 1층(lowerTiles): 바닥·깔개·문 매트·계단·벽·틀. 전부 칸을 꽉 채운 불투명 칸이다.",
    "- 3층(upperTiles): 가구·벽 장식. 가장자리가 투명하므로 1층에 두면 투명 픽셀 아래가 검게 보인다.",
    "- 문 매트와 계단은 밟는 칸이라 1층이다. 3층 통행 가능(★) 칸은 캐릭터 위에 그려져 주인공을 가린다(src/player/characterDepth.ts). 그래서 매트는 바닥별로 미리 합성한 칸(마루용·타일용)이 따로 있다.",
    "",
    "## 블록 표 (○ 통행 가능, × 막힘)",
    "| 블록 | 이름 | 원점 열,행 | 크기 | 칸 번호 | 층 | 통행 |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "## 이름 붙은 한 칸 (바닥·벽·틀·매트)",
    "| 이름 | 칸 |",
    "|---|---|",
    ...named,
    "",
    "- frame-top 은 **방이 남쪽에 있는** 틀(흰 띠가 칸 아래쪽). frame-bottom 은 방이 북쪽, frame-left 는 방이 동쪽, frame-right 는 방이 서쪽.",
    "- frame-corner-nw 는 맵 왼쪽 위 바깥 모서리(방이 남동 대각선). 나머지 corner 도 같은 규칙.",
    "- frame-inner-XY 는 안쪽 모서리 — 이름의 두 글자가 방이 붙은 두 변이다(inner-se = 남·동에 방). ㄱ자 방·칸막이 끝에 쓴다.",
    "- frame-ceiling 은 사방이 틀인 검은 칸(두 방 사이 두꺼운 벽 속).",
    "- wall-*-upper / wall-*-lower 는 벽 앞면 두 줄(윗줄·아랫줄). 가로로 반복한다.",
    "",
    "## 블록 전체 배열 (행 우선)",
    "```json",
    JSON.stringify(Object.fromEntries(KIT.blocks.map((b) => [b.name, grid(b)]))),
    "```",
  ].join("\n");
}

function steps() {
  return [
    "# 몬스터 실내 · 조립 순서",
    "",
    "tilesetId=" + TILESET_ID + ". 번호는 「칸 사전」과 같다. 맵 크기 W×H, 좌표 (x,y).",
    "",
    "## 1. 틀과 벽 (1층)",
    "- y=0: x=0 frame-corner-nw(" + T["frame-corner-nw"] + "), x=1..W-2 frame-top(" + T["frame-top"] + "), x=W-1 frame-corner-ne(" + T["frame-corner-ne"] + ").",
    "- y=H-1: x=0 frame-corner-sw(" + T["frame-corner-sw"] + "), 가운데 frame-bottom(" + T["frame-bottom"] + "), x=W-1 frame-corner-se(" + T["frame-corner-se"] + ").",
    "- y=1..H-2: x=0 frame-left(" + T["frame-left"] + "), x=W-1 frame-right(" + T["frame-right"] + ").",
    "- y=1: x=1..W-2 벽 윗줄, y=2: 벽 아랫줄. 민트 " + T["wall-mint-upper"] + "/" + T["wall-mint-lower"] + " · 라벤더 " + T["wall-lavender-upper"] + "/" + T["wall-lavender-lower"] + " · 크림 " + T["wall-cream-upper"] + "/" + T["wall-cream-lower"] + ". 방 하나에 한 색.",
    "- 최소 크기 7×6(바닥 5×3). 틀 방향을 뒤집으면 흰 띠가 끊긴다 — 방이 있는 쪽으로 띠가 오게 한다.",
    "",
    "## 2. 바닥 (1층)",
    "- y=3..H-2, x=1..W-2 를 한 가지 바닥으로 채운다: 나무 마루 " + T["floor-wood"] + " · 흰 타일 " + T["floor-tile"] + " · 빨간 카펫 " + T["floor-carpet-red"] + " · 청록 카펫 " + T["floor-carpet-teal"] + ". 1칸이 16px 주기라 어떤 크기로도 이어진다.",
    "- 깔개 3×3(rug-red·rug-teal)은 바닥 위를 **덮어쓴다**(1층). 3×3 보다 크게 하려면 가운데 칸(" + tileOf(B["rug-red"], 1, 1) + "/" + tileOf(B["rug-teal"], 1, 1) + ")을 반복하고 테두리 칸을 변마다 이어 붙인다.",
    "",
    "## 3. 출입구",
    "- 맨 아래 바닥 줄(y=H-2)의 가운데 x 에 문 매트를 1층으로 놓는다. 바닥이 마루면 door-mat-wood(" + T["door-mat-wood"] + "), 타일이면 door-mat-tile(" + T["door-mat-tile"] + "). 두 칸짜리 문은 door-mat-wide-*.",
    "- 매트 칸에 **밟기(playerTouch)** 장소 이동 이벤트 → 마을의 건물 문 앞 칸. 마을 쪽 문 이벤트의 도착 칸은 매트 **한 칸 위**(y=H-3)로 한다 — 매트 위에 도착하면 다음 걸음에 바로 튕겨 나간다.",
    "- 틀 맨 아랫줄은 뚫지 않는다. 매트 위아래 한 칸과 매트에서 방 안으로 이어지는 길은 비운다.",
    "",
    "## 4. 벽 장식 (3층, 벽 칸 위에만)",
    "- 창문·화이트보드 2×2 는 원점을 y=1 에 둔다(벽 두 줄을 덮는다). 벽시계·포스터 1×1 은 y=1.",
    "- 바닥 줄에 걸면 오류(WALL_DECOR_OFF_WALL).",
    "",
    "## 5. 가구 (3층, 블록 통째로)",
    "- 원점 (X,Y) 에 블록 배열을 그대로 찍는다. 벽에 붙이는 가구(카운터 뒤 기계·책장·진열대·냉장고·조리대·PC·TV)는 Y=3.",
    "- 바닥 1층은 가구 밑에도 그대로 둔다(가구 투명 가장자리로 바닥이 보여야 한다).",
    "- 가구끼리 붙여도 되지만, 문 매트에서 모든 조사 앞칸까지 걸어서 닿아야 한다(UNREACHABLE).",
    "",
    "## 6. 방 종류별 필수 부품과 이벤트",
    "- **회복 센터**: 접수 카운터 5×2(Y=4 권장) — 뒤 줄 가운데(카운터 윗변 한 칸 위)에 접수원 캐릭터, **카운터 아랫줄 가운데 칸에 조사 이벤트**(recoverAll). 엔진에 카운터 너머 말 걸기가 없으므로 이벤트는 카운터 칸 자체에 둔다. 회복 기계는 카운터 뒤, PC 단말은 구석에 놓고 그 아랫칸에 조사 이벤트. 로비 의자·화분은 양옆.",
    "- **도구 상점**: 계산대 3×2 + 뒤에 점원, 계산대 아랫줄 가운데 칸에 shop 이벤트. 벽 진열대·냉장고는 Y=3, 가운데 진열대는 통로 사이.",
    "- **주인공 집**: 침대 2×3(조사 = 잠자기 회복), TV 2×2, 식탁 3×2 + 위 의자(chair-down, 식탁 윗줄 바로 위) + 아래 의자(chair-up, 식탁 아랫줄 바로 아래), 부엌 조리대 3×2. 계단 2×2 는 1층, 윗줄 칸에 밟기 이동 이벤트.",
    "- **연구소**: 스타터 볼 받침대 3×2 — 볼은 왼쪽부터 풀(초록)·불(빨강)·물(파랑). 받침대 아랫줄 x 칸마다 조사 이벤트 하나씩(각 볼의 몬스터). 박사는 받침대 윗변 바로 위. 책장·연구 컴퓨터는 Y=3, 실험대는 아래쪽 양옆.",
    "",
    "## 금지",
    "- 가구를 1층에 두기(FURNITURE_ON_LOWER). 바닥·벽·매트를 3층에 두기(FLOOR_ON_UPPER).",
    "- 블록 잘라 쓰기(BLOCK_CUT) — 침대 머리만, 카운터 반쪽만.",
    "- 틀 방향 뒤집기(FRAME_DIRECTION). 출구 칸에 가구(EXIT_BLOCKED).",
    "- 없는 소재: 2층 계단 난간, 체육관 내부, 동굴 내부, 창밖 풍경, 문 그림(실내 쪽 문짝). 동굴은 easyrpg_chipset_dungeon, 마을 바깥은 scarloxy_chipset_monster_town_kit.",
  ].join("\n");
}

function rows2d(room, layer) { return Array.from({ length: room.h }, (_, y) => room[layer].slice(y * room.w, (y + 1) * room.w)); }
function examples() {
  const out = ["# 완성 예제 · 회복 센터·도구 상점·주인공 집·연구소", "",
    "아래 배열은 prepare-monster-interior-references.mjs 가 조립하고 구조 검사(오류 0)를 통과한 것이다. 그림 *-example.png 가 이 배열을 실제 타일로 그린 것이다.", ""];
  for (const [key, [label, r]] of Object.entries(rooms)) {
    out.push("## " + label + " " + r.w + "×" + r.h + " (" + key + "-example.png)", "");
    out.push("배치(원점 x,y · 층):", ...r.placed.map((p) => "- " + p.name + " (" + (NAMES[p.name] ?? p.name) + ") @ " + p.x + "," + p.y + " · " + (p.layer === "lower" ? "1층" : "3층")), "");
    out.push("이벤트:", ...r.events.map((e) => "- " + e.id + " @ " + e.x + "," + e.y + " · " + e.trigger + " · " + e.what), "");
    out.push("1층:", "```json", JSON.stringify(rows2d(r, "lower")), "```", "3층(-1 = 비움):", "```json", JSON.stringify(rows2d(r, "upper")), "```", "");
  }
  return out.join("\n");
}

function errorsDoc() {
  return ["# 정상/오류 비교 · 구조 검사 코드", "",
    "각 그림은 왼쪽이 정답 방, 오른쪽이 일부러 망가뜨린 방이다. 빨간 칸이 검사가 보고한 좌표다.",
    "검사 범위: 틀 방향, 가구·바닥의 층, 블록 완결성, 벽 장식 위치, 문 매트에서 조사 앞칸까지의 도보 연결. 이벤트 실행과 미적 품질은 검사하지 않는다.", "",
    "| 그림 | 오류 코드 | 무엇이 틀렸나 | 보고 좌표 |", "|---|---|---|---|",
    ...bad.map((b) => "| " + b.id + "-ok-bad.png | " + b.code + " | " + b.caption + " | " + b.errors.slice(0, 4).map((e) => "(" + e.x + "," + e.y + ")").join(" ") + " |"),
  ].join("\n");
}

const img = (id, name, caption) => ({ id, name, caption, dataUrl: "/" + IMG_DIR.replace(/^public\//, "") + "/" + name });
const category = {
  id: "monster-interior-v1",
  name: "몬스터 실내 · 회복 센터·도구 상점·주인공 집·연구소",
  description: "Scarloxy 화풍 실내 칩셋 한 장으로 몬스터 수집 게임의 건물 안을 까는 법. 칸 사전, 조립 순서, 방 네 개의 전체 배열, 구조 검사 코드와 정상/오류 그림.",
  documents: [
    { id: "monster-interior-dictionary", name: "칸 사전 · 층 규칙·블록 표·이름 붙은 칸·전체 배열", markdown: dictionary() },
    { id: "monster-interior-steps", name: "조립 순서 · 틀·벽·바닥·출입구·벽 장식·가구·방 종류별 이벤트", markdown: steps() },
    { id: "monster-interior-examples", name: "완성 예제 · 방 네 개 전체 배열", markdown: examples() },
    { id: "monster-interior-errors", name: "정상/오류 비교 · 구조 검사 코드", markdown: errorsDoc() },
  ],
  images: [
    img("kit-overview", "kit-overview.png", "시트 위 10줄 · 실제 타일(2배), 빨간 테두리 = 블록"),
    img("center-example", "center-example.png", "완성 예제 · 몬스터 회복 센터 15×11"),
    img("shop-example", "shop-example.png", "완성 예제 · 도구 상점 11×9"),
    img("home-example", "home-example.png", "완성 예제 · 주인공 집 11×9"),
    img("lab-example", "lab-example.png", "완성 예제 · 연구소 13×11"),
    ...bad.map((b) => img(b.id + "-ok-bad", b.id + "-ok-bad.png", "왼쪽 정상 / 오른쪽 오류 " + b.code + ": " + b.caption)),
  ],
};
fs.writeFileSync(OUT_JSON, JSON.stringify(category, null, 1) + "\n");
console.log(OUT_JSON + ": " + category.documents.length + " docs, " + category.images.length + " images, " + bad.length + " error cases");

