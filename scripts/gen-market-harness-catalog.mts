/**
 * 장터 하네스 타일 카탈로그 HTML 생성.
 * 칩셋 PNG를 base64로 임베드해서 file:// 에서도 이미지가 반드시 보이게 한다.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHIPSET = path.join(ROOT, "public/assets/easyrpg-chipset-combined-town-transparent.png");
const OUT_EVIDENCE = path.join(ROOT, "output/evidence/market-harness-tiles.html");
const OUT_PUBLIC = path.join(ROOT, "public/market-harness-tiles.html");

const COLS = 30;
const TILE = 16;
const ZOOM = 4; // 미리보기 배율
const SHEET_W = 480;
const SHEET_H = 256;

type TileEntry = {
  id: number;
  name: string;
  role: string;
  layer: "lower" | "upper";
  status: string;
};

const TILES: TileEntry[] = [
  { id: 222, name: "목재 바닥 (입구 발판)", role: "WOOD_FLOOR", layer: "lower", status: "입구 3×2만" },
  { id: 468, name: "난간 좌", role: "RAIL_L", layer: "upper", status: "입구 옆" },
  { id: 470, name: "난간 우", role: "RAIL_R", layer: "upper", status: "입구 옆" },
  { id: 469, name: "난간 중 (현재 미사용)", role: "RAIL_M", layer: "upper", status: "예비" },
  // 천막 411–443 배제
  { id: 234, name: "테이블 좌", role: "TABLE_L", layer: "upper", status: "카운터" },
  { id: 235, name: "테이블 중", role: "TABLE_M", layer: "upper", status: "카운터" },
  { id: 236, name: "테이블 우", role: "TABLE_R", layer: "upper", status: "카운터" },
  { id: 237, name: "나무 상자", role: "WOOD_BOX", layer: "upper", status: "소품" },
  { id: 202, name: "과일 상자 좌", role: "FRUIT_L", layer: "upper", status: "소품" },
  { id: 203, name: "과일 상자 우", role: "FRUIT_R", layer: "upper", status: "소품" },
  { id: 288, name: "꽃", role: "FLOWER", layer: "upper", status: "소품" },
  { id: 223, name: "팀버 레일 (구버전/미사용)", role: "TIMBER_RAIL", layer: "lower", status: "예비" },
  { id: 193, name: "팀버 포스트 (구버전/미사용)", role: "TIMBER_POST", layer: "lower", status: "예비" },
];

if (!fs.existsSync(CHIPSET)) {
  console.error("chipset missing:", CHIPSET);
  process.exit(1);
}

const b64 = fs.readFileSync(CHIPSET).toString("base64");
const dataUrl = `data:image/png;base64,${b64}`;
const bgW = SHEET_W * ZOOM;
const bgH = SHEET_H * ZOOM;
const cell = TILE * ZOOM;

function pos(id: number): { x: number; y: number } {
  const col = id % COLS;
  const row = Math.floor(id / COLS);
  return { x: -col * cell, y: -row * cell };
}

function tileDiv(id: number, size = cell): string {
  const { x, y } = pos(id);
  // background-image 는 CSS .tile 에 1회만 — 인라인은 position/size 만
  return `<div class="tile" title="tile ${id}" style="width:${size}px;height:${size}px;background-size:${(size / TILE) * SHEET_W}px ${(size / TILE) * SHEET_H}px;background-position:${(x / cell) * size}px ${(y / cell) * size}px;"></div>`;
}

function compose(ids: number[], cols: number): string {
  const size = cell;
  return `<div class="compose" style="display:grid;grid-template-columns:repeat(${cols},${size}px);gap:2px;">${ids
    .map((id) => tileDiv(id, size))
    .join("")}</div>`;
}

const cards = TILES.map((t) => {
  return `<article class="card">
  <div class="preview">${tileDiv(t.id)}</div>
  <div class="meta">
    <div class="name">${t.name}</div>
    <div class="desc">${t.role}</div>
    <div class="tags">
      <span class="tag">#${t.id}</span>
      <span class="tag layer-${t.layer}">${t.layer}</span>
      <span class="tag">${t.status}</span>
    </div>
  </div>
</article>`;
}).join("\n");

const rows = TILES.map((t) => {
  const mini = tileDiv(t.id, TILE * 2.5);
  return `<tr>
  <td><span class="mini">${mini}</span></td>
  <td>${t.name}</td>
  <td class="ids">${t.id}</td>
  <td>${t.layer}</td>
  <td>${t.role}<br><span class="sub">${t.status}</span></td>
</tr>`;
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>장터(Market) 하네스 타일 카탈로그</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a222c;
      --panel2: #232d3a;
      --text: #e7eef7;
      --muted: #9aabbc;
      --accent: #5ec8ff;
      --ok: #6ddf9a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Malgun Gothic", system-ui, sans-serif;
      background: radial-gradient(1200px 600px at 10% -10%, #1c2a3a, var(--bg));
      color: var(--text);
      line-height: 1.5;
    }
    header {
      padding: 28px 32px 12px;
      border-bottom: 1px solid #2a3644;
    }
    header h1 { margin: 0 0 8px; font-size: 1.55rem; }
    header p { margin: 0; color: var(--muted); max-width: 960px; }
    main { padding: 20px 32px 64px; max-width: 1200px; }
    .banner {
      margin: 16px 0 24px;
      padding: 14px 16px;
      border-radius: 12px;
      background: #152433;
      border: 1px solid #2d4054;
      color: var(--muted);
    }
    .banner strong { color: var(--ok); }
    .banner code { color: var(--accent); }
    h2 {
      margin: 32px 0 12px;
      font-size: 1.2rem;
      border-left: 4px solid var(--accent);
      padding-left: 10px;
    }
    h3 { margin: 18px 0 10px; color: #cfe3f5; font-size: 1.02rem; }
    .flow {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
    }
    .flow .step {
      background: var(--panel);
      border: 1px solid #2f3d4d;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 0.88rem;
    }
    .flow .step.hot {
      border-color: #3d7ea8;
      box-shadow: 0 0 0 1px rgba(94,200,255,0.15) inset;
    }
    .flow .step b { display: block; color: var(--accent); margin-bottom: 4px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 14px;
    }
    .card {
      background: var(--panel);
      border: 1px solid #2f3d4d;
      border-radius: 14px;
      overflow: hidden;
    }
    .preview {
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 16px;
      background-color: #1b2330;
      background-image:
        linear-gradient(45deg, #2a3340 25%, transparent 25%),
        linear-gradient(-45deg, #2a3340 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #2a3340 75%),
        linear-gradient(-45deg, transparent 75%, #2a3340 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0;
    }
    .tile {
      background-image: url("${dataUrl}");
      background-repeat: no-repeat;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 8px 18px rgba(0,0,0,0.4);
      border-radius: 4px;
      flex-shrink: 0;
    }
    .meta { padding: 12px 14px 14px; }
    .name { font-weight: 700; margin-bottom: 4px; }
    .desc { color: var(--muted); font-size: 0.86rem; margin-bottom: 8px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--panel2);
      border: 1px solid #36485c;
      color: #c5d5e6;
    }
    .tag.layer-lower { border-color: #4a6a3a; color: #b7e0a0; }
    .tag.layer-upper { border-color: #6a5a3a; color: #f0d090; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #2f3d4d;
      font-size: 0.9rem;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid #2a3644;
      text-align: left;
      vertical-align: middle;
    }
    th { background: #15202b; color: #b9c9d9; }
    tr:last-child td { border-bottom: 0; }
    td.ids { font-family: ui-monospace, Consolas, monospace; color: var(--ok); }
    .mini { display: inline-flex; vertical-align: middle; margin-right: 8px; }
    .sub { color: var(--muted); font-size: 0.85em; }
    .layout-ascii {
      font-family: ui-monospace, Consolas, monospace;
      white-space: pre;
      background: #0c1117;
      border: 1px solid #2a3644;
      border-radius: 12px;
      padding: 14px 16px;
      color: #c8d8e8;
      overflow-x: auto;
      font-size: 0.82rem;
      line-height: 1.35;
    }
    footer { padding: 8px 32px 40px; color: #6f8092; font-size: 0.85rem; }
  </style>
</head>
<body>
  <header>
    <h1>장터(Market) 하네스 타일 카탈로그</h1>
    <p>
      소스: <code>stampMarketHarness</code> · 칩셋 base64 임베드 (경로 의존 없음) ·
      Combined Town 30열 × 16px · 미리보기 ×${ZOOM}
    </p>
  </header>
  <main>
    <div class="banner">
      <strong>✓ 칩셋 PNG base64 내장</strong> — file:// 더블클릭으로 열어도 타일 이미지가 보여야 합니다.<br>
      시공 시점: 플랜에서 market bbox 예약 → 물 → <b>집</b> → <b>길</b> → <code>stampMarketHarness</code> (집·길 이후).<br>
      목재 데크 전체(222 body + edges + 223 base). 천막(411–443) 배제. 카운터/소품 + shop 이벤트.
    </div>

    <h2>1. 시공 순서</h2>
    <div class="flow">
      <div class="step"><b>0 플랜</b>market bbox만</div>
      <div class="step"><b>1 물</b>강·호수</div>
      <div class="step"><b>2 집</b>장터 밖</div>
      <div class="step"><b>3 길</b>내부 차단</div>
      <div class="step hot"><b>4 장터 ★</b>stampMarketHarness</div>
      <div class="step"><b>5+</b>울타리·숲·NPC</div>
    </div>

    <h2>2. 합성 패턴</h2>
    <div class="grid">
      <div class="card">
        <div class="preview">${compose([234, 235, 235, 236], 4)}</div>
        <div class="meta">
          <div class="name">카운터 테이블</div>
          <div class="desc">L–M–M–R · 234/235/236 · shop 이벤트 (천막 배제)</div>
        </div>
      </div>
      <div class="card">
        <div class="preview">${compose([222, 222, 222, 222, 222, 222], 3)}</div>
        <div class="meta">
          <div class="name">입구 발판 3×2</div>
          <div class="desc">lower WOOD_FLOOR=222 · bbox 전체 채우기 안 함</div>
        </div>
      </div>
      <div class="card">
        <div class="preview">${compose([237, 202, 203, 288], 4)}</div>
        <div class="meta">
          <div class="name">소품</div>
          <div class="desc">상자·과일·꽃</div>
        </div>
      </div>
    </div>

    <h2>3. 타일 카드</h2>
    <div class="grid">
${cards}
    </div>

    <h2>4. 표</h2>
    <table>
      <thead>
        <tr><th>미리보기</th><th>이름</th><th>ID</th><th>레이어</th><th>역할</th></tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>

    <h2>5. 레이아웃 개념</h2>
    <div class="layout-ascii">market bbox (천막 배제)
┌──────────────────────────────────────┐
│  상자·과일·꽃                         │  upper 237,202,203,288
│  [카운터 LMMM R]     [카운터]         │  upper 234-236 + shop
│   (상인 NPC 뒤)                       │  charset event
│         ▓▓▓ 입구 발판 3×2 ▓▓▓        │  lower 222
│        | 난간 좌     난간 우 |       │  upper 468/470
└──────────────────────────────────────┘
남쪽 = market-front 길 연결
    </div>
  </main>
  <footer>
    gen: scripts/gen-market-harness-catalog.mts · chipset ${SHEET_W}×${SHEET_H} embedded (${Math.round(b64.length / 1024)} KB base64)
  </footer>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT_EVIDENCE), { recursive: true });
fs.writeFileSync(OUT_EVIDENCE, html, "utf8");
fs.writeFileSync(OUT_PUBLIC, html, "utf8");
console.log("wrote", OUT_EVIDENCE);
console.log("wrote", OUT_PUBLIC);
console.log("embedded chipset bytes", fs.statSync(CHIPSET).size, "base64 KB", Math.round(b64.length / 1024));
