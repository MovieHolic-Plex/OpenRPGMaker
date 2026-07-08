// 모래길 오토타일 하네싱 설계 이미지 생성 — '길' 맵(fable-village) 실데이터 진단 + 오목 코너(365) 처방
const { readFileSync, writeFileSync } = require("node:fs");
const { chromium } = require("/home/main/z-project/rpg-zzu-wt-6a/node_modules/playwright");

const SHEET = "file:///home/main/z-project/rpg-zzu-wt-6a/public/assets/easyrpg-chipset-combined-town-transparent.png";
const TMP = "/home/main/.claude2-home/.claude/jobs/6dc730ab/tmp";
const roadMap = JSON.parse(readFileSync(`${TMP}/road-map.json`, "utf8"));

const D = 44; // 표시 타일 크기(px)
const GRASS = 240;
const SAND = { DOT: 363, INNER: 365, NW: 393, N: 394, NE: 395, W: 423, BODY: 424, E: 425, SW: 453, S: 454, SE: 455 };

function tileCss(id, d = D) {
  const col = id % 30, row = Math.floor(id / 30);
  return `background-image:url('${SHEET}');background-size:${30 * d}px ${(256 / 16) * d}px;background-position:${-col * d}px ${-row * d}px;image-rendering:pixelated;width:${d}px;height:${d}px;`;
}

// 격자 조립도: tiles 2차원 배열 + 표식(bad=빨강 ✕ / good=초록 ★)
function gridFigure(tiles, marks = {}) {
  const h = tiles.length, w = tiles[0].length;
  let cells = "";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = tiles[y][x];
      const mark = marks[`${x},${y}`];
      const cls = mark === "bad" ? " bad" : mark === "good" ? " good" : "";
      const icon = mark === "bad" ? `<span class="mk mbad">✕</span>` : mark === "good" ? `<span class="mk mgood">★</span>` : "";
      cells += `<div class="cell${cls}" style="left:${x * D}px;top:${y * D}px"><div class="ly" style="${tileCss(id)}"></div><span class="idl">${id}</span>${icon}</div>`;
    }
  }
  return `<div class="fig" style="width:${w * D}px;height:${h * D}px">${cells}</div>`;
}

// 실맵 crop → 2차원 배열
function cropMap(map, x0, y0, w, h) {
  const out = [];
  for (let dy = 0; dy < h; dy++) {
    const row = [];
    for (let dx = 0; dx < w; dx++) row.push(map.lowerTiles[(y0 + dy) * map.width + (x0 + dx)]);
    out.push(row);
  }
  return out;
}

// 하네싱 규칙 구현: 모래 여부 격자 → 타일 격자 (2차 오목 판정 포함). 오목 셀 좌표도 반환.
function shapeSand(sandGrid) {
  const h = sandGrid.length, w = sandGrid[0].length;
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && sandGrid[y][x];
  const tiles = [], inner = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      if (!sandGrid[y][x]) { row.push(GRASS); continue; }
      const n = at(x, y - 1), e = at(x + 1, y), s = at(x, y + 1), west = at(x - 1, y);
      if (!n && !e && !s && !west) { row.push(SAND.DOT); continue; }
      if (!n && !west) { row.push(SAND.NW); continue; }
      if (!n && !e) { row.push(SAND.NE); continue; }
      if (!s && !west) { row.push(SAND.SW); continue; }
      if (!s && !e) { row.push(SAND.SE); continue; }
      if (!n) { row.push(SAND.N); continue; }
      if (!s) { row.push(SAND.S); continue; }
      if (!west) { row.push(SAND.W); continue; }
      if (!e) { row.push(SAND.E); continue; }
      // 2차 판정: 4방 모두 모래 + 대각 결손 → 오목 코너
      if (!at(x - 1, y - 1) || !at(x + 1, y - 1) || !at(x - 1, y + 1) || !at(x + 1, y + 1)) {
        row.push(SAND.INNER); inner.push(`${x},${y}`); continue;
      }
      row.push(SAND.BODY);
    }
    tiles.push(row);
  }
  return { tiles, inner };
}

// 패턴 카드용 모래 격자
function makeGrid(w, h, rects) {
  const g = Array.from({ length: h }, () => Array(w).fill(false));
  for (const [x0, y0, rw, rh] of rects) for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) g[y][x] = true;
  return g;
}
function patternCard(title, note, grid) {
  const { tiles, inner } = shapeSand(grid);
  const marks = Object.fromEntries(inner.map((k) => [k, "good"]));
  return `<div class="card"><div class="cardtitle">${title}</div>${gridFigure(tiles, marks)}<div class="legend">${note}</div></div>`;
}

function roleRows(rows) {
  return rows.map(([id, role, repeat]) => `
    <tr>
      <td><div class="thumb" style="${tileCss(id, 38)}"></div></td>
      <td class="tid">${id}</td>
      <td class="role">${role}</td>
      <td class="rep">${repeat}</td>
    </tr>`).join("");
}

const sandRows = roleRows([
  [393, "볼록 모서리 <b>북서</b> — 북·서가 잔디", "고정 1칸"],
  [394, "<b>북쪽 변</b> — 북만 잔디", "가로 →"],
  [395, "볼록 모서리 <b>북동</b>", "고정 1칸"],
  [423, "<b>서쪽 변</b> — 서만 잔디", "세로 ↓"],
  [424, "<b>몸통</b> — 4방·대각 전부 모래일 때만", "가로+세로"],
  [425, "<b>동쪽 변</b>", "세로 ↓"],
  [453, "볼록 모서리 <b>남서</b>", "고정 1칸"],
  [454, "<b>남쪽 변</b>", "가로 →"],
  [455, "볼록 모서리 <b>남동</b>", "고정 1칸"],
  [363, "<b>외딴 점</b> — 상하좌우 전부 잔디인 1칸 웅덩이", "고정 1칸"],
  [365, "★<b>오목 코너(합성)</b> — 4방은 모래인데 <b>대각선에 잔디</b>가 있는 칸. 네 귀퉁이의 잔디 바이트 중 필요한 귀퉁이가 이웃 변 타일의 잔디 프린지와 이어짐", "교차·굽이 안쪽"],
  [364, "잔디 채움(블록의 기초면) — 길 시공에는 사용 안 함", "—"],
]);

// ── 진단/처방: 실데이터 십자 교차로 ──
const X0 = 4, Y0 = 7, CW = 9, CH = 7; // crop 영역(맵 좌표)
const before = cropMap(roadMap, X0, Y0, CW, CH);
const CONCAVE = [[7, 9], [9, 9], [7, 11], [9, 11]]; // 맵 좌표
const badMarks = Object.fromEntries(CONCAVE.map(([x, y]) => [`${x - X0},${y - Y0}`, "bad"]));
const after = before.map((r) => [...r]);
const goodMarks = {};
for (const [x, y] of CONCAVE) { after[y - Y0][x - X0] = SAND.INNER; goodMarks[`${x - X0},${y - Y0}`] = "good"; }

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { background:#12141c; color:#e9ecf3; font-family:'Pretendard','Noto Sans KR',system-ui,sans-serif; width:1560px; margin:0; padding:28px; }
  h1 { font-size:26px; margin:0 0 6px; } h2 { font-size:19px; margin:26px 0 10px; color:#9db2ff; }
  .sub { color:#9aa3b5; font-size:13px; margin-bottom:14px; }
  .row2 { display:flex; gap:28px; align-items:flex-start; flex-wrap:wrap; }
  .fig { position:relative; border:2px solid #444c66; background:#000; }
  .cell { position:absolute; width:${D}px; height:${D}px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); }
  .cell.bad { box-shadow: inset 0 0 0 3px #ff4d5e; z-index:2; }
  .cell.good { box-shadow: inset 0 0 0 3px #35e08a; z-index:2; }
  .ly { position:absolute; inset:0; }
  .idl { position:absolute; left:1px; bottom:1px; font-size:10px; font-weight:700; line-height:1; padding:0 2px; border-radius:2px; background:rgba(0,0,0,.72); color:#ffe28a; }
  .mk { position:absolute; top:1px; right:2px; font-size:14px; font-weight:900; text-shadow:0 0 3px #000; }
  .mbad { color:#ff4d5e; } .mgood { color:#35e08a; }
  table { border-collapse:collapse; font-size:13px; }
  td { border-bottom:1px solid #2a3046; padding:4px 10px 4px 0; vertical-align:middle; }
  .thumb { border:1px solid #444c66; background-color:#3f7f3f; }
  .tid { font-weight:800; font-size:15px; color:#ffe28a; width:38px; }
  .role { max-width:480px; } .rep { color:#8fb7ff; font-weight:700; white-space:nowrap; }
  .legend { font-size:12.5px; color:#9aa3b5; margin-top:8px; max-width:440px; line-height:1.55; }
  .card { background:#171b28; border:1px solid #2a3046; border-radius:10px; padding:14px; }
  .cardtitle { font-size:14px; font-weight:800; margin-bottom:8px; color:#cfe0ff; }
  .rules { background:#1a1f2e; border:1px solid #2a3046; border-radius:10px; padding:16px 20px; margin-top:26px; font-size:14px; line-height:1.75; }
  .rules b { color:#9db2ff; }
  ol { margin:6px 0 0 18px; padding:0; }
  .diagbig { display:flex; gap:14px; align-items:center; background:#171b28; border:1px solid #2a3046; border-radius:10px; padding:14px; }
</style>
<h1>🛣️ 모래길 오토타일 하네싱 — 오목 코너까지 완성하기</h1>
<div class="sub">근거: '길' 맵(fable-village, 24×18) 실데이터 진단 (2026-07-08). 타일셋의 모래 블록은 4×3 = 12타일:
9-슬라이스(볼록) + 외딴 점(363) + 오목 코너 합성(365). 2026-07-08 엔진을 8방향으로 확장해 아래 규칙 전부가 <b>자동 성형</b>된다(수동 배치 불필요).</div>

<h2>① 재료 — 모래 오토타일 어휘 (타일셋 12·13~15행, 3~5열)</h2>
<div class="row2">
  <table>${sandRows}</table>
  <div class="diagbig">
    <div style="${tileCss(365, 128)};border:1px solid #444c66"></div>
    <div class="legend" style="max-width:300px"><b style="color:#cfe0ff">365 확대</b> — 모래 바탕에 <b>네 귀퉁이 잔디 바이트</b>.
    RM2003 원본 오토타일의 '안쪽 모서리' 성분을 한 장에 합성한 타일이라, 어느 방향의 오목이든 이 한 장으로 처리한다.
    불필요한 귀퉁이의 바이트는 3~4px라 몸통 사이에서 자갈처럼 읽힌다.<br><br>
    흙길도 같은 문법: 점 <b>360</b> / 오목 <b>362</b> / 몸통 <b>421</b> / 9-슬라이스 <b>390~392·420~422·450~452</b>.</div>
  </div>
</div>

<h2>② 판정 규칙 — 셀 하나마다 이 순서로</h2>
<div class="rules" style="margin-top:0">
  <ol>
    <li><b>상하좌우가 전부 잔디</b> → 외딴 점 <b>363</b>. <i>(엔진 자동)</i></li>
    <li><b>볼록 판정(4방향)</b>: 북·서 잔디→393, 북·동→395, 남·서→453, 남·동→455, 북만→394, 남만→454, 서만→423, 동만→425. <i>(엔진 자동)</i></li>
    <li>★<b>오목 판정(대각선)</b>: 4방향 모두 모래인데 <b>대각 4곳 중 잔디가 하나라도 있으면</b> 몸통 대신 <b>365</b>. 대각까지 전부 모래일 때만 몸통 <b>424</b>. <i>(엔진 자동 — 8방향 확장 완료)</i></li>
  </ol>
</div>

<h2>③ 진단 → 처방 — '길' 맵 십자 교차로 실데이터</h2>
<div class="row2">
  <div class="card">
    <div class="cardtitle">BEFORE — 현재 상태 (✕ 4곳이 몸통 424)</div>
    ${gridFigure(before, badMarks)}
    <div class="legend">교차로 안쪽 모서리 4칸: 상하좌우가 모두 모래라 4방향 판정으로는 몸통이 되지만,
    대각선이 잔디다. 몸통(424)이 놓이면서 이웃 변 타일(394·423…)의 잔디 프린지가 <b>뚝 끊긴다</b> — 이게 "오토타일 미적용"으로 보이는 원인.</div>
  </div>
  <div class="card">
    <div class="cardtitle">AFTER — 오목 코너 365 투입 (★ 4곳)</div>
    ${gridFigure(after, goodMarks)}
    <div class="legend">같은 자리에 <b>365</b>를 놓으면 필요한 귀퉁이의 잔디 바이트가 변 타일의 프린지와 이어져
    모서리가 둥글게 말린다. 우상단의 낱개 모래(363)는 이미 올바른 외딴 점 용법.</div>
  </div>
</div>

<h2>④ 패턴 카드 — 3칸 폭 길의 오목 코너 발생 위치 (★)</h2>
<div class="row2">
  ${patternCard("십자 교차 — 오목 4곳", "두 3칸 폭 길이 십자로 만나면 안쪽 모서리 4칸 전부 365.", makeGrid(9, 9, [[0, 3, 9, 3], [3, 0, 3, 9]]))}
  ${patternCard("T자 교차 — 오목 2곳", "지선이 붙는 쪽 안쪽 모서리 2칸만 365. 반대변은 그냥 변 타일.", makeGrid(9, 7, [[0, 1, 9, 3], [3, 4, 3, 3]]))}
  ${patternCard("ㄱ자 굽이 — 오목 1곳", "굽이 안쪽 1칸만 365. 바깥쪽은 볼록 모서리 9-슬라이스가 처리.", makeGrid(8, 8, [[0, 1, 6, 3], [3, 1, 3, 7]]))}
</div>

<div class="rules">
  <b>하네싱 불변식 (길 빌더가 지켜야 할 것)</b>
  <ol>
    <li><b>길 폭은 최소 2칸, 권장 3칸.</b> 이 타일셋에는 '양쪽 변 동시' 타일이 없어 1칸 폭 길은 표현 불가(한쪽 프린지 소실).</li>
    <li>볼록 경계(변·바깥 모서리)는 9-슬라이스 — 몸통만 칠해도 엔진이 자동 성형한다.</li>
    <li><b>오목 코너 = 365.</b> "4방 모래 + 대각 잔디" 칸에 몸통(424)을 두지 마라. 십자 4곳·T자 2곳·ㄱ자 굽이 1곳.</li>
    <li>낱개 모래 1칸은 <b>363</b>. 몸통(424) 낱개 금지.</li>
    <li>모래는 물과 연결된 것으로 간주(해변 접합). 모래↔흙길 직접 접합 문법은 아직 미학습 — 사이에 잔디 1칸을 두거나 한 재질로 통일.</li>
    <li>흙길에도 동일 규칙 적용: 오목은 <b>362</b>, 외딴 점은 <b>360</b>.</li>
  </ol>
</div>`;

(async () => {
  writeFileSync(`${TMP}/road-autotile-design.html`, html);
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1616, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(`file://${TMP}/road-autotile-design.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${TMP}/road-autotile-design.png`, fullPage: true });
  await browser.close();
  console.log("saved:", `${TMP}/road-autotile-design.png`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
