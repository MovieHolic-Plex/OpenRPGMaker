/**
 * Interior chipset label review — certain / fuzzy / unknown.
 *
 * CERTAIN = code constants + prior user JSON only (no guessed prop indices).
 * FUZZY   = open wall-frame / dark-wall variants still ambiguous.
 * UNKNOWN = every other non-empty tile for the user to name.
 *
 *   npx tsx scripts/gen-interior-tile-label-simple-html.mts
 * Open: output/docs/interior-tile-labels-simple.html
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { DARK_WALL_TILE } from "../src/project/defaults/darkWallAutotile.ts";
import {
  INTERIOR_WALL_FRAME_TILES,
  INTERIOR_WALL_FRAME_FLOOR_TILE,
} from "../src/project/tilesetHarness/themePacks.ts";

const TILE = 16;
const COLS = 30;
const ROWS = 16;
const COUNT = COLS * ROWS;

const outDir = path.resolve("output/docs");
fs.mkdirSync(outDir, { recursive: true });

const chipSrc = path.resolve("public/assets/easyrpg-chipset-interior-transparent.png");
const chipLocal = path.join(outDir, "Interior-chipset.png");
fs.copyFileSync(chipSrc, chipLocal);

type Bucket = "certain" | "fuzzy" | "unknown";
type Entry = {
  tile: number;
  bucket: Bucket;
  label: string;
  why: string;
  layer?: string;
  from?: string;
};

function chipPos(tile: number) {
  return { col: tile % COLS, row: Math.floor(tile / COLS) };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function spr(tile: number, scale: number): string {
  const { col, row } = chipPos(tile);
  const size = TILE * scale;
  return `<span class="spr" style="width:${size}px;height:${size}px;background-position:${-col * size}px ${-row * size}px;background-size:${COLS * size}px auto"></span>`;
}

const userPath = path.join(outDir, "interior-tile-labels-user.json");
const userJson = fs.existsSync(userPath)
  ? (JSON.parse(fs.readFileSync(userPath, "utf8")) as {
      tiles?: Record<string, { label?: string; bucket?: Bucket; memo?: string; layer?: string }>;
      stillOpen?: number[];
    })
  : { tiles: {}, stillOpen: [] as number[] };
const userTiles = userJson.tiles ?? {};
const stillOpen = new Set(userJson.stillOpen ?? [104, 106, 456, 458, 396, 398, 234]);

const png = PNG.sync.read(fs.readFileSync(chipSrc));
function solidRatio(tile: number): number {
  const { col, row } = chipPos(tile);
  let solid = 0;
  let total = 0;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = ((row * TILE + y) * png.width + (col * TILE + x)) * 4;
      const a = png.data[i + 3]!;
      const r = png.data[i]!;
      const g = png.data[i + 1]!;
      const b = png.data[i + 2]!;
      total += 1;
      if (a < 16) continue;
      // hot-pink key / object background
      if (r > 200 && g < 140 && b > 150) continue;
      solid += 1;
    }
  }
  return solid / total;
}

function isMostlyEmpty(tile: number): boolean {
  return solidRatio(tile) < 0.06;
}

/** CERTAIN — only code + user-confirmed (do not invent prop indices). */
const CERTAIN: Array<Omit<Entry, "bucket">> = [
  { tile: 430, label: "암부/보이드 배경", why: "코드 BACKGROUND + user", layer: "lower", from: "code+user" },
  { tile: 72, label: "실내 바닥 (connect)", why: "FLOOR=72 · 오토타일 connect", layer: "lower", from: "code+user" },
  { tile: 73, label: "바닥에 구멍뚫림 (낡은 집)", why: "user export", layer: "lower", from: "user" },

  { tile: 105, label: "벽프레임 body", why: "INTERIOR_WALL_FRAME_TILES.body", layer: "lower", from: "code" },
  { tile: 457, label: "벽프레임 edgeN", why: "code edgeN", layer: "lower", from: "code" },
  { tile: 397, label: "벽프레임 edgeS", why: "code edgeS", layer: "lower", from: "code" },
  { tile: 428, label: "벽프레임 edgeW", why: "code edgeW · 번호 겹침 주의(다크 cornerSE)", layer: "lower", from: "code" },
  { tile: 426, label: "벽프레임 edgeE", why: "code edgeE · 번호 겹침 주의(다크 cornerSW)", layer: "lower", from: "code" },
  { tile: 368, label: "벽프레임 코너 쿼터 소스 / 다크 cornerNW 겹침", why: "code 양쪽 그룹 공유 번호", layer: "lower", from: "code" },
  { tile: 233, label: "벽프레임 코너 (상단 좌 / NW)", why: "user chat", layer: "lower", from: "user" },
  { tile: 258, label: "벽프레임 코너 (상단 우 / NE)", why: "user chat", layer: "lower", from: "user" },
  { tile: 257, label: "(사용 안 함)", why: "user: 쓰지 않는다", layer: "lower", from: "user" },

  { tile: DARK_WALL_TILE.BODY, label: "어두운 벽 body 브러시", why: "366 — 칠하면 오토타일", layer: "lower", from: "code" },
  { tile: DARK_WALL_TILE.EDGE_NORTH, label: "어두운 벽 edgeN", why: "367", layer: "lower", from: "code" },
  { tile: DARK_WALL_TILE.EDGE_SOUTH, label: "어두운 벽 edgeS", why: "427", layer: "lower", from: "code" },
  { tile: DARK_WALL_TILE.EDGE_WEST, label: "어두운 벽 edgeW", why: "396 · 문 알코브와 번호 혼동 주의", layer: "lower", from: "code" },
  { tile: DARK_WALL_TILE.EDGE_EAST, label: "어두운 벽 edgeE", why: "398", layer: "lower", from: "code" },
  { tile: DARK_WALL_TILE.CORNER_NORTH_EAST, label: "어두운 벽 cornerNE", why: "369", layer: "lower", from: "code" },

  { tile: 18, label: "책장 왼쪽 최상단", why: "user", layer: "lower", from: "user" },
  { tile: 20, label: "책장 오른쪽 최상단", why: "user", layer: "lower", from: "user" },
  { tile: 48, label: "책장 왼쪽 중단", why: "user", layer: "lower", from: "user" },
  { tile: 50, label: "책장 오른쪽 중단", why: "user", layer: "lower", from: "user" },
  { tile: 78, label: "책장 왼쪽 하단", why: "user", layer: "lower", from: "user" },
  { tile: 79, label: "책장 오른쪽 하단", why: "user", layer: "lower", from: "user" },

  { tile: 56, label: "창문", why: "user", layer: "upper", from: "user" },
  { tile: 59, label: "종교 표시", why: "user", layer: "upper", from: "user" },
  { tile: 114, label: "그림의 왼쪽", why: "user", layer: "upper", from: "user" },
  { tile: 115, label: "그림의 오른쪽", why: "user", layer: "upper", from: "user" },
  { tile: 148, label: "수납장 상단", why: "user", layer: "upper", from: "user" },
  { tile: 178, label: "수납장 하단", why: "user", layer: "upper", from: "user" },
  { tile: 232, label: "용암 대지", why: "user", layer: "lower", from: "user" },
  { tile: 260, label: "칼 거치", why: "user", layer: "upper", from: "user" },
  { tile: 289, label: "식물", why: "user", layer: "upper", from: "user" },
  { tile: 264, label: "탁자 상단", why: "user 메모 연관(294=하단)", layer: "upper", from: "user+vision" },
  { tile: 294, label: "탁자 하단", why: "user", layer: "upper", from: "user" },
  { tile: 295, label: "박스", why: "user", layer: "upper", from: "user" },
  { tile: 297, label: "오른쪽을 바라보는 의자", why: "user", layer: "upper", from: "user" },
  { tile: 298, label: "왼쪽을 바라보는 의자", why: "user", layer: "upper", from: "user" },
  { tile: 355, label: "가로 침대 왼쪽", why: "user hard pair", layer: "upper", from: "user" },
  { tile: 356, label: "가로 침대 오른쪽", why: "user hard pair", layer: "upper", from: "user" },
  { tile: 417, label: "깨진 유리", why: "user", layer: "upper", from: "user" },
  { tile: 471, label: "곡식 포대", why: "user", layer: "upper", from: "user" },
  { tile: 475, label: "아래로 가는 계단", why: "user", layer: "lower", from: "user" },
];

/** FUZZY — still open / dual-use / sheet companions */
const FUZZY: Array<Omit<Entry, "bucket">> = [
  { tile: 104, label: "벽프레임 안쪽 좌? (105 옆)", why: "still-open", layer: "lower", from: "open" },
  { tile: 106, label: "벽프레임 안쪽 우? (105 옆)", why: "still-open", layer: "lower", from: "open" },
  { tile: 456, label: "상단 보 왼쪽 연결 코너?", why: "still-open · 다크 cornerSW 번호와 혼동 주의", layer: "lower", from: "open" },
  { tile: 458, label: "상단 보 오른쪽 연결 코너?", why: "still-open", layer: "lower", from: "open" },
  { tile: 396, label: "문 알코브 좌? / 다크 edgeW", why: "still-open · 번호 이중 의미", layer: "lower", from: "open" },
  { tile: 398, label: "문 알코브 우? / 다크 edgeE", why: "still-open", layer: "lower", from: "open" },
  { tile: 234, label: "벽프레임 코너 (방향 TBD)", why: "user: corner 계열, 방향 미정", layer: "lower", from: "open" },

  // dark-wall sheet companions (not primary body/edges)
  { tile: 370, label: "어두운 벽 시트 변형?", why: "366 블록 同行", layer: "lower", from: "vision-block" },
  { tile: 371, label: "어두운 벽 시트 변형?", why: "366 블록", layer: "lower", from: "vision-block" },
  { tile: 399, label: "어두운 벽 시트 변형?", why: "396행", layer: "lower", from: "vision-block" },
  { tile: 400, label: "어두운 벽 시트 변형?", why: "396행", layer: "lower", from: "vision-block" },
  { tile: 401, label: "어두운 벽 시트 변형?", why: "396행", layer: "lower", from: "vision-block" },
  { tile: 429, label: "어두운 벽 시트 변형?", why: "426행", layer: "lower", from: "vision-block" },
  { tile: 431, label: "어두운 벽/보이드 인접 변형?", why: "430 옆", layer: "lower", from: "vision-block" },
  { tile: 459, label: "어두운 벽 하단 변형?", why: "456행", layer: "lower", from: "vision-block" },
  { tile: 460, label: "어두운 벽 하단 변형?", why: "456행", layer: "lower", from: "vision-block" },
  { tile: 461, label: "어두운 벽 하단 변형?", why: "456행", layer: "lower", from: "vision-block" },

  // terrain blocks on sheet (representative first cell of block)
  { tile: 0, label: "수관/덤불 블록 (야외) — 대표", why: "row0-1 좌측 · 실내용 아님 추정", layer: "lower", from: "vision-region" },
  { tile: 6, label: "흙·풀 경계 블록 — 대표", why: "row0-1", layer: "lower", from: "vision-region" },
  { tile: 12, label: "보라 벽돌 벽 블록 — 대표", why: "row0-1", layer: "lower", from: "vision-region" },
  { tile: 60, label: "강/물 가로 블록 — 대표", why: "row2-3", layer: "lower", from: "vision-region" },
  { tile: 120, label: "깊은 물/파도 블록 — 대표", why: "row4-5", layer: "lower", from: "vision-region" },
  { tile: 240, label: "잔디 블록 — 대표", why: "row8-9 좌측", layer: "lower", from: "vision-region" },
  { tile: 360, label: "숲 캐노피 블록 — 대표", why: "row12-13 좌측", layer: "lower", from: "vision-region" },
  { tile: 390, label: "빨간 카펫 블록 — 대표", why: "row12-13", layer: "lower", from: "vision-region" },
  { tile: 410, label: "마법진 9분할 — 대표", why: "row13 노란 서클", layer: "lower", from: "vision-region" },
];

function applyUser(list: Array<Omit<Entry, "bucket">>, bucket: Bucket): Entry[] {
  return list.map((item) => {
    const u = userTiles[String(item.tile)];
    if (!u?.label) return { ...item, bucket };
    return {
      ...item,
      bucket: (u.bucket as Bucket) || bucket,
      label: u.label,
      why: u.memo ? `${item.why} · user: ${u.memo}` : item.why,
      from: "user-json",
    };
  });
}

const certain = applyUser(CERTAIN, "certain");
const fuzzy = applyUser(FUZZY, "fuzzy");
const classified = new Set<number>([...certain.map((e) => e.tile), ...fuzzy.map((e) => e.tile)]);

// user-json tiles not already in certain/fuzzy
for (const [key, u] of Object.entries(userTiles)) {
  const tile = Number(key);
  if (!Number.isFinite(tile) || classified.has(tile) || !u.label) continue;
  if (stillOpen.has(tile)) {
    fuzzy.push({
      tile,
      bucket: "fuzzy",
      label: u.label,
      why: "user still-open",
      layer: u.layer,
      from: "user-json",
    });
  } else {
    certain.push({
      tile,
      bucket: (u.bucket as Bucket) || "certain",
      label: u.label,
      why: u.memo || "user-json",
      layer: u.layer,
      from: "user-json",
    });
  }
  classified.add(tile);
}

const certainD = [...new Map(certain.map((e) => [e.tile, e])).values()].sort((a, b) => a.tile - b.tile);
const certainSet = new Set(certainD.map((e) => e.tile));
const fuzzyD = [...new Map(fuzzy.map((e) => [e.tile, e])).values()]
  .filter((e) => !certainSet.has(e.tile))
  .sort((a, b) => a.tile - b.tile);
const fuzzySet = new Set(fuzzyD.map((e) => e.tile));

const unknownD: Entry[] = [];
for (let tile = 0; tile < COUNT; tile++) {
  if (certainSet.has(tile) || fuzzySet.has(tile)) continue;
  if (isMostlyEmpty(tile)) continue;
  const u = userTiles[String(tile)];
  const pos = chipPos(tile);
  const region =
    pos.col >= 18
      ? "우열 소품(분홍 배경)"
      : pos.row <= 1
        ? "상단 야외/벽"
        : pos.row <= 5
          ? "중상 지형/벽"
          : pos.row <= 9
            ? "중단 지형/소품"
            : pos.row <= 13
              ? "하단 지형/장식"
              : "최하단";
  unknownD.push({
    tile,
    bucket: "unknown",
    label: u?.label ?? "",
    why: u?.label ? "user partial" : `미라벨 · ${region} · solid ${(solidRatio(tile) * 100).toFixed(0)}%`,
    layer: pos.col >= 18 ? "upper?" : "lower?",
    from: "backlog",
  });
}
unknownD.sort((a, b) => a.tile - b.tile);

function section(title: string, cls: string, blurb: string, items: Entry[]): string {
  const cards = items
    .map((e) => {
      const pos = chipPos(e.tile);
      return `<div class="card" data-bucket="${e.bucket}" data-tile="${e.tile}">
      <div class="pic">${spr(e.tile, 6)}</div>
      <div class="body">
        <div class="id">#${e.tile} <span class="chip">(${pos.col},${pos.row})</span>
          ${e.layer ? `<span class="tag">${esc(e.layer)}</span>` : ""}
          ${e.from ? `<span class="tag dim">${esc(e.from)}</span>` : ""}
        </div>
        <label>라벨 <input type="text" data-tile="${e.tile}" data-field="label" value="${esc(e.label)}" placeholder="이름을 새기세요" /></label>
        <label>메모 <input type="text" data-tile="${e.tile}" data-field="memo" placeholder="방향·레이어·페어 등" /></label>
        <div class="meta">${esc(e.why)}</div>
      </div>
    </div>`;
    })
    .join("\n");
  return `<section class="bucket ${cls}">
    <h2>${esc(title)} <span class="n">${items.length}</span></h2>
    <p class="blurb">${esc(blurb)}</p>
    <div class="grid">${cards}</div>
  </section>`;
}

const draftJson = {
  generatedAt: new Date().toISOString(),
  note: "CERTAIN=code+user only. FUZZY=open/ambiguous. UNKNOWN=non-empty unlabeled for human engraving.",
  visionNotes: {
    sheet: "30 cols × 16 rows, tile = row*30+col",
    regions: [
      "cols 0-17: lower terrain/walls (trees, water, brick, floors, carpets, magic circle)",
      "cols 18-29: upper-ish props on pink key (bookshelves, furniture, weapons, food, thrones)",
      "dark wall block ~366-371 / 396-401 / 426-431 / 456-461",
      "user already locked many furniture ids — see certain",
    ],
  },
  certain: certainD,
  fuzzy: fuzzyD,
  unknown: unknownD.map((e) => ({ tile: e.tile, label: e.label, why: e.why })),
  wallFrame: INTERIOR_WALL_FRAME_TILES,
  darkWall: DARK_WALL_TILE,
  floor: INTERIOR_WALL_FRAME_FLOOR_TILE,
};

fs.writeFileSync(path.join(outDir, "interior-tile-labels-buckets.json"), JSON.stringify(draftJson, null, 2));
fs.writeFileSync(
  path.join(outDir, "interior-tile-vision-notes.md"),
  `# Interior chipset vision notes (2026-07-12)

Sheet: \`easyrpg-chipset-interior\` · 30×16 · tile = row×30 + col

## 확실한 것 (코드 / 이전 사용자 확정)

| 계열 | 타일 | 의미 |
|------|------|------|
| 바닥 | 72 | 실내 바닥 (connect) |
| 구멍 | 73 | 낡은 집 바닥 구멍 |
| 보이드 | 430 | 암부 배경 |
| 벽프레임 | 105 body, 457 N, 397 S, 428 W, 426 E, 368 코너소스 | cream wall-frame |
| 코너(user) | 233 NW, 258 NE, 234 TBD | 상단 코너 |
| 다크월 | 366 body, 367 N, 427 S, 396 W, 398 E, 369 NE | 오토타일 브러시 |
| 책장 | 18/20, 48/50, 78/79 | L/R 3단 |
| 가구(user) | 56 창문, 59 종교, 114\|115 그림, 148/178 수납, 260 칼거치, 289 식물, 264/294 탁자, 295 박스, 297/298 의자, 355\|356 침대, 417 유리, 471 곡식, 475 계단, 232 용암 | |

## 애매한 것

- **still-open:** 104/106 안쪽 트림, 456/458 보 연결, 396/398 문 알코브 vs 다크 edge, 234 코너 방향
- **번호 겹침:** 368/426/428 이 벽프레임·다크월 양쪽에 쓰임 — 데이터 그룹이 다르면 같은 번호 다른 의미
- **다크 시트 변형:** 370-371, 399-401, 429, 431, 459-461 역할 미정
- **야외 지형 블록:** 시트 좌측에 물·잔디·벽돌·카펫 등 — 실내 키트에 안 쓸 수도

## 잘 모르겠는 것 / 네가 새길 것

- 분홍 열(col 18–29) 소품 대부분 중 **user 확정 제외분**
- 지형 9분할 안쪽 타일 전부
- UI성 화살표·작은 아이콘

스트립: \`output/docs/interior-chipset-rows/\`
HTML: \`output/docs/interior-tile-labels-simple.html\`
`,
  "utf8",
);

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>실내 타일 — 확실 / 애매 / 모름</title>
<style>
  :root { --chip: url("Interior-chipset.png"); --bg:#111; --text:#eee; --muted:#999; }
  * { box-sizing: border-box; }
  body { margin:0; padding:16px 18px 90px; font:15px/1.4 "Malgun Gothic","Segoe UI",sans-serif; background:var(--bg); color:var(--text); }
  h1 { font-size:1.2rem; margin:0 0 6px; }
  .sub { color:var(--muted); margin:0 0 12px; font-size:13px; }
  .legend { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; font-size:12px; }
  .legend span { padding:4px 8px; border-radius:6px; }
  .legend .c { background:#1a3a24; border:1px solid #2d6b3f; }
  .legend .f { background:#3a3010; border:1px solid #8a7020; }
  .legend .u { background:#3a1418; border:1px solid #8a3040; }
  .spr { display:block; image-rendering:pixelated; background-image:var(--chip); background-repeat:no-repeat; border:2px solid #000; }
  section { margin-bottom:28px; border-radius:12px; padding:14px; }
  section h2 { margin:0 0 4px; font-size:1.1rem; }
  section .n { opacity:.7; font-weight:600; }
  .blurb { margin:0 0 12px; color:#ccc; font-size:13px; }
  .bucket.certain { background:#14261a; border:1px solid #2d6b3f; }
  .bucket.fuzzy { background:#2a2410; border:1px solid #8a7020; }
  .bucket.unknown { background:#2a1418; border:1px solid #8a3040; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:10px; }
  .card { display:grid; grid-template-columns:104px 1fr; gap:10px; background:rgba(0,0,0,.35); border-radius:10px; padding:10px; }
  .pic { background:#000; padding:4px; border-radius:8px; display:flex; justify-content:center; }
  .pic .spr { width:96px!important; height:96px!important; }
  .id { font-weight:800; font-family:Consolas,monospace; margin-bottom:6px; display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
  .chip { font-weight:500; color:var(--muted); font-size:12px; }
  .tag { font-size:10px; font-weight:600; background:#333; padding:2px 5px; border-radius:4px; }
  .tag.dim { opacity:.7; }
  label { display:block; font-size:11px; color:var(--muted); margin-bottom:6px; }
  input[type=text] { display:block; width:100%; margin-top:3px; background:#0a0a0a; border:1px solid #444; color:#fff; border-radius:6px; padding:7px 8px; font-size:14px; }
  .meta { font-size:11px; color:#888; margin-top:4px; }
  .bar { position:fixed; bottom:0; left:0; right:0; background:#1a1a1a; border-top:1px solid #333; padding:10px 14px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; z-index:5; }
  .bar button { border:0; border-radius:8px; padding:8px 12px; font-weight:700; cursor:pointer; background:#3d7eff; color:#fff; }
  .bar button.g { background:#333; }
  .bar input.filter { background:#0a0a0a; border:1px solid #444; color:#fff; border-radius:8px; padding:7px 10px; min-width:160px; }
  #out { display:none; position:fixed; inset:8%; z-index:9; background:#1a1a1a; border:1px solid #444; border-radius:12px; padding:12px; }
  #out.open { display:flex; flex-direction:column; }
  #out textarea { flex:1; background:#0a0a0a; color:#cde; border:1px solid #333; border-radius:8px; padding:10px; font-family:Consolas,monospace; font-size:12px; }
  .toc a { color:#8ab4ff; margin-right:10px; font-size:13px; }
  .notes { background:#1a1a22; border:1px solid #333; border-radius:10px; padding:12px 14px; margin-bottom:18px; font-size:13px; color:#ccc; }
  .notes code { color:#cde; }
</style>
</head>
<body>
  <h1>실내 칩셋 라벨 — 확실 / 애매 / 모름</h1>
  <p class="sub">easyrpg_chipset_interior · certain은 코드+이전 user만. 모름 칸에 이름을 새기면 됨. 분홍 빈 칸 제외.</p>
  <div class="legend">
    <span class="c">확실 ${certainD.length}</span>
    <span class="f">애매 ${fuzzyD.length}</span>
    <span class="u">모름 ${unknownD.length}</span>
  </div>
  <div class="notes">
    <strong>비전 요약</strong> — 시트 좌(col 0–17)=지형/벽, 우(col 18–29)=분홍 키 소품.
    다크월 블록 ≈ 366행. 번호 겹침: 368/426/428.
    상세: <code>interior-tile-vision-notes.md</code> · 행 스트립: <code>interior-chipset-rows/</code>
  </div>
  <p class="toc"><a href="#certain">↓ 확실</a> <a href="#fuzzy">↓ 애매</a> <a href="#unknown">↓ 모름</a></p>

  <div id="certain">${section("1. 확실한 거", "certain", "코드 상수 + 이전 사용자 확정. 틀리면 고쳐 주세요.", certainD)}</div>
  <div id="fuzzy">${section("2. 애매한 거", "fuzzy", "still-open 벽프레임, 다크 시트 변형, 지형 블록 대표 칸.", fuzzyD)}</div>
  <div id="unknown">${section("3. 잘 모르겠는 거 (새길 곳)", "unknown", "비어 있지 않은데 라벨 없음. 라벨 input에 이름을 적으세요.", unknownD)}</div>

  <div class="bar">
    <input class="filter" id="filter" type="search" placeholder="번호/라벨 필터…" />
    <button type="button" id="save">JSON 내보내기</button>
    <button type="button" class="g" id="copy">복사</button>
    <button type="button" class="g" id="onlyUnknown">모름만</button>
    <button type="button" class="g" id="onlyEmptyLabel">빈 라벨만</button>
    <button type="button" class="g" id="showAll">전부</button>
    <span class="sub" id="hint">localStorage 자동 저장</span>
  </div>
  <div id="out">
    <textarea id="ta"></textarea>
    <div style="margin-top:8px;text-align:right"><button type="button" class="g" id="close">닫기</button></div>
  </div>
  <script>
    const DRAFT = ${JSON.stringify({
      certain: certainD,
      fuzzy: fuzzyD,
      unknown: unknownD.map((e) => ({ tile: e.tile, label: e.label, why: e.why, layer: e.layer, from: e.from })),
    })};
    const STORAGE = "rpgzzu-tile-simple-v3";
    function load(){ try { return JSON.parse(localStorage.getItem(STORAGE)||"{}"); } catch { return {}; } }
    function collect(){
      const o = load();
      document.querySelectorAll("input[data-tile]").forEach((el) => {
        const t = el.getAttribute("data-tile");
        const f = el.getAttribute("data-field");
        o[t] = o[t] || {};
        o[t][f] = el.value;
      });
      localStorage.setItem(STORAGE, JSON.stringify(o));
      return o;
    }
    function restore(){
      const o = load();
      document.querySelectorAll("input[data-tile]").forEach((el) => {
        const t = el.getAttribute("data-tile");
        const f = el.getAttribute("data-field");
        if (o[t] && o[t][f] != null) el.value = o[t][f];
      });
    }
    function mapList(list, bucket){
      const o = collect();
      return list.map((e) => {
        const u = o[e.tile] || o[String(e.tile)] || {};
        return {
          tile: e.tile, bucket,
          label: u.label != null ? u.label : (e.label || ""),
          memo: u.memo || "",
          draftLabel: e.label || "",
          why: e.why,
        };
      });
    }
    function payload(){
      return {
        mapId: "map_interior_blank",
        tilesetId: "easyrpg_chipset_interior",
        exportedAt: new Date().toISOString(),
        certain: mapList(DRAFT.certain, "certain"),
        fuzzy: mapList(DRAFT.fuzzy, "fuzzy"),
        unknown: mapList(DRAFT.unknown, "unknown"),
      };
    }
    function show(){
      const text = JSON.stringify(payload(), null, 2);
      document.getElementById("ta").value = text;
      document.getElementById("out").classList.add("open");
      return text;
    }
    document.querySelectorAll("input[data-tile]").forEach((el) => {
      el.addEventListener("change", collect);
      el.addEventListener("blur", collect);
    });
    document.getElementById("save").onclick = show;
    document.getElementById("copy").onclick = async () => { const t = show(); try { await navigator.clipboard.writeText(t); } catch {} };
    document.getElementById("close").onclick = () => document.getElementById("out").classList.remove("open");
    document.getElementById("filter").oninput = (ev) => {
      const q = (ev.target.value || "").toLowerCase().trim();
      document.querySelectorAll(".card").forEach((card) => {
        const t = card.getAttribute("data-tile") || "";
        const text = card.textContent.toLowerCase();
        card.style.display = !q || t === q || text.includes(q) ? "" : "none";
      });
    };
    document.getElementById("onlyUnknown").onclick = () => {
      document.querySelectorAll(".card").forEach((c) => {
        c.style.display = c.getAttribute("data-bucket") === "unknown" ? "" : "none";
      });
    };
    document.getElementById("onlyEmptyLabel").onclick = () => {
      document.querySelectorAll(".card").forEach((c) => {
        const inp = c.querySelector('input[data-field="label"]');
        c.style.display = inp && !inp.value.trim() ? "" : "none";
      });
    };
    document.getElementById("showAll").onclick = () => {
      document.querySelectorAll(".card").forEach((c) => { c.style.display = ""; });
    };
    restore();
  </script>
</body>
</html>
`;

const outPath = path.join(outDir, "interior-tile-labels-simple.html");
fs.writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath);
console.log({
  certain: certainD.length,
  fuzzy: fuzzyD.length,
  unknown: unknownD.length,
  emptySkipped: COUNT - certainD.length - fuzzyD.length - unknownD.length,
});
