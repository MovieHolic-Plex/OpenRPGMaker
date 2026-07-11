/**
 * 마켓 맵 타일 → 하네스 설계 설득용 한글 주석 이미지 생성 (Playwright HTML 캡처).
 * 출력: output/evidence/market-harness/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "output", "evidence", "market-harness");
const chipsetRel = "public/assets/easyrpg-chipset-combined-town-transparent.png";
const chipsetAbs = path.join(root, chipsetRel);

const COLS = 30;
const TILE = 16;
const SCALE = 3; // 표시 배율

// 마켓 맵에서 실제 쓰인 타일 + 관련 형제
const MARKET_TILES = {
  // 이미 하네스 있음
  grass: { ids: [240], group: "잔디(기본 지형)", status: "ok", layer: "하위", note: "공터 베이스. 별도 하네스 불필요(기본 지면)." },
  woodFloor: { ids: [192, 222, 228, 229, 230], group: "나무 바닥", status: "gap", layer: "하위", note: "장터 데크. woodFloorBody는 chipset 그룹만 있고 하네스 id 없음 → 추가 후보." },
  tableH: { ids: [234, 235, 236], group: "탁자(가로)", status: "ok", layer: "상위", note: "이미 harness-combined-town-table-horizontal. 좌|중*|우." },
  tableV: { ids: [144, 174, 204], group: "탁자(세로)", status: "ok", layer: "상위", note: "이미 table-vertical. 상|중*|하." },
  woodBox: { ids: [237], group: "나무 상자", status: "ok", layer: "상위", note: "이미 wood-box. 노점 재고 소품." },
  yard: { ids: [349, 350, 351, 352], group: "집앞 마당", status: "ok", layer: "상위", note: "349 장작 등. house-yard 그룹." },
  timber: { ids: [193, 194, 195, 196, 197, 223, 224, 225, 226, 227], group: "목조 기둥/구조", status: "gap", layer: "하위 solid", note: "맵 y=7 난간·기둥. timberPost 칩셋은 있으나 패턴 하네스 없음." },
  // 맵에 나왔지만 의미 미분류
  unmapped168: { ids: [168, 169, 170], group: "우측 데크 캡(?)", status: "unknown", layer: "하위", note: "맵 (6–8,1). 시맨틱 unmapped. 비전으로 확인 후 데크/난간 하네스." },
  unmapped173: { ids: [173], group: "데크 가장자리(?)", status: "unknown", layer: "하위", note: "맵 x=8 세로 줄. 통행 가능. 가장자리 타일 후보." },
  obj268: { ids: [268], group: "장식 오브젝트", status: "weak", layer: "상위", note: "Generic object. small-props 가방에 흡수 가능." },
  rail468: { ids: [468, 469, 470], group: "하단 난간/레일(?)", status: "unknown", layer: "상위 solid", note: "맵 y=8 가로 줄. 통행 불가. 울타리/난간 문법 후보." },
};

const COLORS = {
  ok: "#22c55e",
  gap: "#f59e0b",
  unknown: "#ef4444",
  weak: "#a78bfa",
};

function tileXY(id) {
  return { col: id % COLS, row: Math.floor(id / COLS) };
}

function chipsetDataUrl() {
  const buf = fs.readFileSync(chipsetAbs);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function legendItems() {
  return Object.entries(MARKET_TILES).map(([key, g]) => ({
    key,
    ...g,
    color: COLORS[g.status],
  }));
}

function buildHtml() {
  const legend = legendItems();
  const highlights = legend.flatMap((g) =>
    g.ids.map((id) => {
      const { col, row } = tileXY(id);
      return { id, col, row, color: g.color, group: g.group, status: g.status };
    }),
  );

  // 맵 그리드 (inspect 결과 고정 — 저장본과 동기)
  const lower = [
    [240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
    [240, 240, 240, 240, 240, 240, 168, 169, 170, 240],
    [240, 240, 240, 240, 240, 240, 222, 222, 173, 240],
    [240, 240, 240, 240, 240, 240, 222, 222, 173, 240],
    [240, 222, 222, 222, 222, 222, 222, 222, 173, 240],
    [240, 222, 222, 222, 222, 222, 222, 222, 173, 240],
    [240, 222, 193, 222, 222, 222, 222, 222, 173, 240],
    [240, 223, 223, 223, 223, 223, 223, 223, 223, 240],
    [240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
    [240, 240, 240, 240, 240, 240, 240, 240, 240, 240],
  ];
  const upper = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, 268, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, 144, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, 204, 237, -1],
    [268, -1, -1, 237, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, 234, 235, 236, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [268, -1, -1, -1, -1, -1, -1, -1, 349, -1],
    [-1, 468, 469, 469, 469, 469, 469, 469, 470, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  ];

  const css = `
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px;
      font-family: "Malgun Gothic", "Noto Sans KR", sans-serif;
      background: #0f1419; color: #e7ecf3;
    }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 28px 0 10px; color: #9ecbff; border-bottom: 1px solid #2a3544; padding-bottom: 6px; }
    p, li { font-size: 13px; line-height: 1.55; color: #c5d0dc; }
    .sub { color: #8b9aab; font-size: 12px; margin-bottom: 18px; }
    .panel {
      background: #1a222d; border: 1px solid #2c3a4d; border-radius: 12px;
      padding: 16px 18px; margin-bottom: 18px;
    }
    .row { display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-start; }
    .chip-wrap {
      position: relative;
      width: ${480 * SCALE}px; height: ${256 * SCALE}px;
      image-rendering: pixelated;
      border: 2px solid #3d4f66; border-radius: 4px;
      background: #111;
    }
    .chip-wrap img {
      width: 100%; height: 100%; image-rendering: pixelated; display: block;
    }
    .hl {
      position: absolute; border: 2px solid; pointer-events: none;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.5) inset;
    }
    .hl .tag {
      position: absolute; left: 0; top: -16px; font-size: 10px; font-weight: 700;
      white-space: nowrap; padding: 0 3px; border-radius: 2px; color: #0b0f14;
    }
    .legend { flex: 1; min-width: 280px; max-width: 420px; }
    .lg {
      display: grid; grid-template-columns: 14px 1fr; gap: 6px 10px;
      margin: 6px 0; padding: 8px; background: #121820; border-radius: 8px;
    }
    .dot { width: 12px; height: 12px; border-radius: 3px; margin-top: 3px; }
    .lg b { color: #fff; font-size: 13px; }
    .badge {
      display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 99px;
      margin-left: 6px; vertical-align: middle; font-weight: 700;
    }
    .badge.ok { background: #14532d; color: #86efac; }
    .badge.gap { background: #78350f; color: #fcd34d; }
    .badge.unknown { background: #7f1d1d; color: #fca5a5; }
    .badge.weak { background: #4c1d95; color: #ddd6fe; }
    table.map {
      border-collapse: collapse; font-size: 10px; font-family: Consolas, monospace;
    }
    table.map th, table.map td {
      width: 52px; height: 42px; border: 1px solid #334155; text-align: center;
      vertical-align: middle; position: relative;
    }
    table.map th { background: #0b1220; color: #94a3b8; height: 22px; }
    .cell-l { color: #93c5fd; display: block; }
    .cell-u { color: #f9a8d4; display: block; font-size: 9px; }
    .npc {
      outline: 2px solid #fbbf24; background: rgba(251, 191, 36, 0.25) !important;
    }
    .npc::after {
      content: "상인"; position: absolute; left: 2px; top: 1px;
      font-size: 9px; color: #fde68a; font-weight: 700; font-family: "Malgun Gothic", sans-serif;
    }
    .player {
      outline: 2px solid #38bdf8; background: rgba(56, 189, 248, 0.18) !important;
    }
    .counter { background: rgba(244, 114, 182, 0.2) !important; }
    .steps { counter-reset: s; }
    .steps li { margin: 8px 0; }
    .box {
      border-left: 3px solid #38bdf8; padding: 8px 12px; margin: 10px 0;
      background: #121a24; border-radius: 0 8px 8px 0;
    }
    code { font-family: Consolas, monospace; font-size: 11px; color: #7dd3fc; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
    .recipe {
      background: #0d1b12; border: 1px solid #166534; border-radius: 10px;
      padding: 12px 14px; margin-top: 8px;
    }
    .recipe h3 { margin: 0 0 8px; color: #86efac; font-size: 14px; }
  `;

  const highlightDivs = highlights
    .map((h) => {
      const left = h.col * TILE * SCALE;
      const top = h.row * TILE * SCALE;
      const size = TILE * SCALE;
      // only label first id of each group to reduce clutter — handled client-side by group
      return `<div class="hl" style="left:${left}px;top:${top}px;width:${size}px;height:${size}px;border-color:${h.color}" data-group="${h.group}" data-id="${h.id}" title="#${h.id} ${h.group}"></div>`;
    })
    .join("\n");

  // one label per group at first tile
  const labels = [];
  const seen = new Set();
  for (const h of highlights) {
    if (seen.has(h.group)) continue;
    seen.add(h.group);
    const left = h.col * TILE * SCALE;
    const top = h.row * TILE * SCALE;
    labels.push(
      `<div class="hl" style="left:${left}px;top:${top}px;width:${TILE * SCALE}px;height:${TILE * SCALE}px;border-color:transparent">
        <span class="tag" style="background:${h.color}">${h.group}</span>
      </div>`,
    );
  }

  const legendHtml = legend
    .map(
      (g) => `
      <div class="lg">
        <div class="dot" style="background:${g.color}"></div>
        <div>
          <b>${g.group}</b>
          <span class="badge ${g.status}">${
            g.status === "ok" ? "하네스 있음" : g.status === "gap" ? "칩셋만/하네스 구멍" : g.status === "weak" ? "약함" : "미분류"
          }</span>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px">
            타일 ${g.ids.join(", ")} · ${g.layer}
          </div>
          <div style="font-size:12px;margin-top:4px">${g.note}</div>
        </div>
      </div>`,
    )
    .join("");

  let mapRows = "";
  for (let y = 0; y < 10; y++) {
    mapRows += `<tr><th>${y}</th>`;
    for (let x = 0; x < 10; x++) {
      const L = lower[y][x];
      const U = upper[y][x];
      let cls = "";
      if (x === 4 && y === 4) cls = "npc";
      else if (x === 4 && y === 6) cls = "player";
      else if (y === 5 && x >= 3 && x <= 5) cls = "counter";
      const uText = U >= 0 ? `U${U}` : "";
      mapRows += `<td class="${cls}"><span class="cell-l">L${L}</span><span class="cell-u">${uText}</span></td>`;
    }
    mapRows += `</tr>`;
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>마켓 타일 하네스 설득 가이드</title>
<style>${css}</style>
</head>
<body>
  <div class="panel" id="cover">
    <h1>마켓 공터 타일 → 하네스, 이렇게 잡자</h1>
    <p class="sub">맵 <code>map_market_reference</code> 10×10 실측 + Combined Town 칩셋. 초록=이미 하네스 · 주황=구멍 · 빨강=미분류 · 보라=약함</p>
    <div class="box">
      <b>한 줄 결론</b><br/>
      장터 카운터(탁자)·상자·장작은 <b>이미 하네스가 있다</b>. 지금 필요한 건
      (1) 나무 바닥 데크 하네스, (2) 목조 난간/기둥 패턴, (3) 168–170·173·468–470 비전 확정 후 그룹,
      (4) 그걸 묶는 <b>장터 부스 레시피</b>(place_props / 시공 프리미티브)다.
      상인 NPC는 (4,4)에 배치 완료 — 하네스는 지형 자동화용이다.
    </div>
  </div>

  <div class="panel" id="chipset">
    <h2>1) 칩셋에 한글 라벨 — 마켓이 쓰는 칸</h2>
    <p>배경은 실제 칩셋 이미지. 색 테두리가 마켓 관련 타일. 라벨은 그룹 대표 칸 위.</p>
    <div class="row">
      <div class="chip-wrap">
        <img src="${chipsetDataUrl()}" width="${480 * SCALE}" height="${256 * SCALE}" alt="chipset"/>
        ${highlightDivs}
        ${labels.join("\n")}
      </div>
      <div class="legend">
        <h3 style="margin-top:0;font-size:14px;color:#e2e8f0">범례 · 상태</h3>
        ${legendHtml}
      </div>
    </div>
  </div>

  <div class="panel" id="map">
    <h2>2) 맵 실측 — 상인 (4,4) · 손님 시작 (4,6)</h2>
    <p>분홍=카운터(가로 탁자 234–236) · 노랑=장터 상인 · 파랑=플레이 시작(카운터 앞)</p>
    <table class="map">
      <tr><th></th>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => `<th>${x}</th>`).join("")}</tr>
      ${mapRows}
    </table>
    <div class="recipe">
      <h3>이미 맵에 있는 “장터 부스” 조합 (레시피 초안)</h3>
      <ol>
        <li><b>바닥</b> 하위 222 나무 바닥 면적 (데크)</li>
        <li><b>카운터</b> 상위 234|235|236 가로 탁자 — 하네스 <code>table-horizontal</code></li>
        <li><b>재고</b> 상위 237 나무 상자 — <code>wood-box</code></li>
        <li><b>측면 부스</b> 상위 144…204 세로 탁자 — <code>table-vertical</code></li>
        <li><b>마감</b> 하위 223 목조 한 줄 + 상위 468–470 난간(?)</li>
        <li><b>상인</b> 이벤트 (4,4) shop 커맨드 — 타일 하네스와 분리</li>
      </ol>
    </div>
  </div>

  <div class="panel" id="howto">
    <h2>3) 하네스를 어떻게 만들 것인가 (설득용 절차)</h2>
    <div class="grid-2">
      <div>
        <h3 style="color:#fcd34d;font-size:14px;margin-top:0">A. 이미 있는 것 — 건드리지 말고 소비</h3>
        <ul class="steps">
          <li><code>harness-combined-town-table-horizontal</code><br/>234 좌 · 235 몸(반복) · 236 우 · 상위 · passable</li>
          <li><code>…-table-vertical</code> 144/174/204</li>
          <li><code>…-wood-box</code> 237 · <code>…-house-yard</code> 349…</li>
          <li>배치: <code>place_props</code> / 영역 AI가 그룹 id로 산포</li>
        </ul>
        <h3 style="color:#fca5a5;font-size:14px">B. 지금 구멍 — 새로 넣을 그룹 초안</h3>
        <ul>
          <li><b>wood-deck / wood-floor</b><br/>tileIds: 192,222,228–230 · role terrain · lower · passable · fill 면적</li>
          <li><b>timber-rail</b><br/>193–197, 223–227 · 패턴(가로 반복 몸) · solid · 장터 난간</li>
          <li><b>deck-edge</b> (비전 후)<br/>168–170, 173 — 지금 unmapped → 칩셋 확대해서 이름 붙인 뒤 그룹</li>
          <li><b>market-rail-upper</b> (비전 후)<br/>468–470 · 상위 solid · 가로 cap-body-cap</li>
        </ul>
      </div>
      <div>
        <h3 style="color:#86efac;font-size:14px;margin-top:0">C. 코드에 넣는 순서 (이 레포 규칙)</h3>
        <ol class="steps">
          <li><b>칩셋 의미</b> <code>chipsetMapping.ts</code><br/>그룹 배열 + <code>tileSemanticForIndex</code> 한글 라벨</li>
          <li><b>하네스 그룹</b> <code>combinedTownGroups.ts</code><br/><code>mixedStackGroup</code> / <code>lowerSolidGroup</code> + patternGrammar</li>
          <li><b>규칙</b> 페어/캡 보존 hardPairRule (과일박스·벤치 패턴 복제)</li>
          <li><b>레이어</b> 투명 소품 → 상위 홈, 데크 → 하위 (tileLayerHome과 일치)</li>
          <li><b>소비</b> place_props / fill_region / 마을 레시피가 id로 호출</li>
          <li><b>검증</b> 통행성 실측 + 맵 금본 셀 + 유닛 테스트</li>
        </ol>
        <div class="box">
          <b>장터 전용 “슈퍼 하네스”는 그룹이 아니라 레시피</b><br/>
          단일 tileGroup에 상인+탁자+바닥을 다 넣지 않는다.
          바닥 그룹 + 탁자 그룹 + 상자 그룹 + NPC 툴을
          <code>market stall recipe</code>로 묶는 편이 기존 architecture와 맞다.
        </div>
      </div>
    </div>
  </div>

  <div class="panel" id="proposal">
    <h2>4) 제안: 최소 3개만 먼저 넣자</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#0b1220;color:#94a3b8;text-align:left">
        <th style="padding:8px;border:1px solid #334155">우선순위</th>
        <th style="padding:8px;border:1px solid #334155">id (초안)</th>
        <th style="padding:8px;border:1px solid #334155">타일</th>
        <th style="padding:8px;border:1px solid #334155">이유</th>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #334155">P0</td>
        <td style="padding:8px;border:1px solid #334155"><code>wood-floor-deck</code></td>
        <td style="padding:8px;border:1px solid #334155">192,222,228–230</td>
        <td style="padding:8px;border:1px solid #334155">장터 면적의 80% — fill_region 대상</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #334155">P1</td>
        <td style="padding:8px;border:1px solid #334155"><code>timber-post-rail</code></td>
        <td style="padding:8px;border:1px solid #334155">193–197,223–227</td>
        <td style="padding:8px;border:1px solid #334155">맵 하단 난간이 이미 223 한 줄 — solid 경계</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #334155">P2</td>
        <td style="padding:8px;border:1px solid #334155">비전 확정 후 edge/rail</td>
        <td style="padding:8px;border:1px solid #334155">168–170,173,468–470</td>
        <td style="padding:8px;border:1px solid #334155">이름 없는 타일은 하네스 금지 — 라벨 먼저</td>
      </tr>
    </table>
    <p style="margin-top:14px">이 이미지가 설득하는 바: <b>탁자 하네스는 끝났고, 데크·난간·미분류 3단이 남았다.</b>
    상인 shop은 이벤트 레이어라 하네스와 분리해 이미 (4,4)에 넣었다.</p>
  </div>
</body>
</html>`;
}

fs.mkdirSync(outDir, { recursive: true });
const htmlPath = path.join(outDir, "market-harness-guide.html");
fs.writeFileSync(htmlPath, buildHtml(), "utf8");
console.log("[html]", htmlPath);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1200 },
  deviceScaleFactor: 1,
});
await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });

async function shot(id, file) {
  const el = page.locator(`#${id}`);
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: path.join(outDir, file) });
  console.log("[shot]", file);
}

// full page
await page.screenshot({
  path: path.join(outDir, "00-full-guide.png"),
  fullPage: true,
});
console.log("[shot] 00-full-guide.png");

await shot("cover", "01-cover-summary.png");
await shot("chipset", "02-chipset-korean-labels.png");
await shot("map", "03-map-merchant-recipe.png");
await shot("howto", "04-how-to-harness.png");
await shot("proposal", "05-priority-proposal.png");

await browser.close();
console.log("[done]", outDir);
