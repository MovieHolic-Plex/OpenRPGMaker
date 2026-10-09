// 집 하네싱 설계 이미지 생성 — 연습04(파랑)/연습08(밝은오렌지) 실데이터 + 타일 역할 주석
const { readFileSync, writeFileSync } = require("node:fs");
const { chromium } = require("/home/main/z-project/rpg-zzu-wt-6a/node_modules/playwright");

const SHEET = "file:///home/main/z-project/rpg-zzu-wt-6a/public/assets/easyrpg-chipset-combined-town-transparent.png";
const TMP = "/home/main/.claude2-home/.claude/jobs/6dc730ab/tmp";
const map04 = JSON.parse(readFileSync(`${TMP}/training2-연습04.json`, "utf8"));
const map08 = JSON.parse(readFileSync(`${TMP}/training2-연습08.json`, "utf8"));

const D = 40; // 표시 타일 크기(px)
function tileCss(id, d = D) {
  const col = id % 30, row = Math.floor(id / 30);
  return `background-image:url('${SHEET}');background-size:${30 * d}px ${(256 / 16) * d}px;background-position:${-col * d}px ${-row * d}px;image-rendering:pixelated;width:${d}px;height:${d}px;`;
}

// 맵 조립도: crop 영역의 하위+상위 합성 + 셀별 타일 ID 라벨
function houseFigure(map, x0, y0, w, h) {
  let cells = "";
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const i = (y0 + dy) * map.width + (x0 + dx);
      const lo = map.lowerTiles[i], up = map.upperTiles[i];
      const layers = [];
      if (lo >= 0 && lo !== 270) layers.push(`<div class="ly" style="${tileCss(lo)}"></div>`);
      else layers.push(`<div class="ly grass"></div>`);
      if (up >= 0) layers.push(`<div class="ly" style="${tileCss(up)}"></div>`);
      const labels = [];
      if (lo >= 0 && lo !== 270) labels.push(`<span class="idl lower">${lo}</span>`);
      if (up >= 0) labels.push(`<span class="idl upper">${up}</span>`);
      cells += `<div class="cell" style="left:${dx * D}px;top:${dy * D}px">${layers.join("")}${labels.join("")}</div>`;
    }
  }
  return `<div class="fig" style="width:${w * D}px;height:${h * D}px">${cells}</div>`;
}

function roleRows(rows) {
  return rows.map(([id, layer, role, repeat]) => `
    <tr>
      <td><div class="thumb" style="${tileCss(id, 36)}"></div></td>
      <td class="tid">${id}</td>
      <td><span class="badge ${layer === "상위" ? "up" : "low"}">${layer}</span></td>
      <td class="role">${role}</td>
      <td class="rep">${repeat}</td>
    </tr>`).join("");
}

const blueRows = roleRows([
  [15, "하위", "벽 <b>상단-좌</b> 모서리", "고정 1칸"],
  [16, "하위", "벽 <b>상단-중</b> — 벽 폭에 맞춰 늘리는 연속 타일", "가로 →"],
  [17, "하위", "벽 <b>상단-우</b> 모서리", "고정 1칸"],
  [45, "하위", "벽 <b>중단-좌</b> — 층이 높아지면 이 행을 반복", "세로 ↓"],
  [46, "하위", "벽 <b>중단-중</b> — 벽면 채움", "가로+세로"],
  [47, "하위", "벽 <b>중단-우</b>", "세로 ↓"],
  [75, "하위", "벽 <b>하단-좌</b> 모서리(지면 접합)", "고정 1칸"],
  [76, "하위", "벽 <b>하단-중</b>", "가로 →"],
  [77, "하위", "벽 <b>하단-우</b> 모서리", "고정 1칸"],
  [467, "하위", "지붕 <b>처마</b> — 지붕 최하행, 벽과 같은 폭", "가로 →"],
  [406, "하위", "지붕 <b>몸통</b> — 몸통행·최상행(좌우 1칸 인셋) 채움", "가로+세로"],
  [407, "하위", "지붕 <b>우측 사면 마감</b> — 몸통행의 오른쪽 끝 1칸", "세로 ↓"],
  [356, "상위", "지붕 꼭대기 <b>좌측 대각</b> — 최상행 인셋으로 빈 좌상 모서리에", "고정 1칸"],
  [357, "상위", "지붕 꼭대기 <b>우측 대각</b>", "고정 1칸"],
  [386, "상위", "처마 <b>좌측 끝 대각</b> — 처마(467) 위에 겹쳐 얹음", "고정 1칸"],
  [387, "상위", "처마 <b>우측 끝 대각</b>", "고정 1칸"],
]);

const brightRows = roleRows([
  [12, "하위", "흰 회벽 <b>상단-좌</b>", "고정 1칸"],
  [13, "하위", "흰 회벽 <b>상단-중</b>", "가로 →"],
  [14, "하위", "흰 회벽 <b>상단-우</b>", "고정 1칸"],
  [42, "하위", "흰 회벽 <b>중단-좌</b> — 2층 이상이면 이 행 반복", "세로 ↓"],
  [43, "하위", "흰 회벽 <b>중단-중</b> — 벽면 채움", "가로+세로"],
  [44, "하위", "흰 회벽 <b>중단-우</b>", "세로 ↓"],
  [72, "하위", "흰 회벽 <b>하단-좌</b>", "고정 1칸"],
  [73, "하위", "흰 회벽 <b>하단-중</b>", "가로 →"],
  [74, "하위", "흰 회벽 <b>하단-우</b>", "고정 1칸"],
  [404, "하위", "지붕 <b>몸통(면)</b> — 날개별 사각형 채움", "가로+세로"],
  [405, "하위", "<b>처마</b> — 각 날개 지붕 최하행, 몸통보다 좌우 +1 오버행", "가로 →"],
  [374, "상위", "<b>용마루 라인</b> — 지붕 사각형 '위 한 줄'에 얹음", "가로 →"],
  [354, "상위", "용마루 <b>좌측 끝 캡</b>(대각)", "고정 1칸"],
  [355, "상위", "용마루 <b>우측 끝 캡</b>", "고정 1칸"],
  [376, "상위", "지붕 <b>좌측 수직 트림</b> — 지붕 바깥 왼쪽 열", "세로 ↓"],
  [377, "상위", "지붕 <b>우측 수직 트림</b> — 지붕 바깥 오른쪽 열", "세로 ↓"],
  [384, "상위", "좌측 트림 <b>하단 캡</b> — 처마 높이에서 마감", "고정 1칸"],
  [385, "상위", "우측 트림 <b>하단 캡</b>", "고정 1칸"],
]);

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { background:#12141c; color:#e9ecf3; font-family:'Pretendard','Noto Sans KR',system-ui,sans-serif; width:1560px; margin:0; padding:28px; }
  h1 { font-size:26px; margin:0 0 6px; } h2 { font-size:19px; margin:26px 0 10px; color:#9db2ff; }
  .sub { color:#9aa3b5; font-size:13px; margin-bottom:14px; }
  .row2 { display:flex; gap:28px; align-items:flex-start; }
  .fig { position:relative; background:#3f7f3f; border:2px solid #444c66; }
  .cell { position:absolute; width:${D}px; height:${D}px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.18); }
  .ly { position:absolute; inset:0; } .grass { background:#59a659; }
  .idl { position:absolute; font-size:10px; font-weight:700; line-height:1; padding:0 2px; border-radius:2px; }
  .idl.lower { left:1px; bottom:1px; background:rgba(0,0,0,.72); color:#ffe28a; }
  .idl.upper { right:1px; top:1px; background:rgba(160,30,30,.85); color:#fff; }
  table { border-collapse:collapse; font-size:13px; }
  td { border-bottom:1px solid #2a3046; padding:4px 10px 4px 0; vertical-align:middle; }
  .thumb { border:1px solid #444c66; background-color:#3f7f3f; }
  .tid { font-weight:800; font-size:15px; color:#ffe28a; width:38px; }
  .badge { font-size:11px; font-weight:700; padding:2px 7px; border-radius:99px; }
  .badge.low { background:#1f3d2a; color:#7fe0a8; } .badge.up { background:#4a2030; color:#ff9db2; }
  .role { max-width:430px; } .rep { color:#8fb7ff; font-weight:700; white-space:nowrap; }
  .legend { font-size:12px; color:#9aa3b5; margin-top:8px; }
  .legend .idl { position:static; display:inline-block; margin:0 4px; }
  .rules { background:#1a1f2e; border:1px solid #2a3046; border-radius:10px; padding:16px 20px; margin-top:26px; font-size:14px; line-height:1.75; }
  .rules b { color:#9db2ff; }
  ol { margin:6px 0 0 18px; padding:0; }
</style>
<h1>🏠 집 하네싱 설계 — 건축 '집' 기능 재구축 기준</h1>
<div class="sub">근거: 학습 예시 프로젝트(fable-village) 연습04·연습08의 사용자 제작 기준 집 실데이터 (2026-07-08).
셀 라벨 — <span class="idl lower" style="position:static">노랑=하위 레이어 타일 ID</span> <span class="idl upper" style="position:static">빨강=상위 레이어 타일 ID</span></div>

<h2>① 파랑 지붕 + 석벽 세트 (연습04 기준 집)</h2>
<div class="row2">
  <div>
    ${houseFigure(map04, 1, 1, 8, 8)}
    <div class="legend">벽 3행(상 15·16·17 / 중 45·46·47 / 하 75·76·77) 위에 지붕 3단:
    처마 467 → 몸통 406(우측 끝만 407) → 최상행 406(좌우 1칸 인셋). 대각 마감 4점은 상위 레이어.</div>
  </div>
  <table>${blueRows}</table>
</div>

<h2>② 밝은 오렌지 ㄱ자 + 흰 회벽 세트 (연습08 기준 집)</h2>
<div class="row2">
  <div>
    ${houseFigure(map08, 1, 1, 14, 13)}
    <div class="legend">ㄱ자 = 날개별로 "벽 3행 먼저, 그 위 지붕". 용마루(374)·트림(376/377)·캡은 전부 상위 레이어로
    지붕 사각형의 '바깥'에 얹는다. 처마(405)는 몸통보다 좌우 +1 오버행.</div>
  </div>
  <table>${brightRows}</table>
</div>

<div class="rules">
  <b>하네싱 규칙 (집 빌더가 지켜야 할 불변식)</b>
  <ol>
    <li><b>벽 기본 높이 = 3행</b>(상단·중단·하단 나인슬라이스). 2층 이상은 <b>중단 행만 세로 반복</b> — 상단/하단은 항상 1행씩.</li>
    <li>가로 확장은 <b>중앙 열만 반복</b>(16/46/76, 13/43/73). 좌/우 모서리 열은 고정 1칸.</li>
    <li>지붕은 벽 위 3단 구성: <b>처마(최하) → 몸통 → 최상행</b>. 높은 지붕은 몸통행을 세로 반복.</li>
    <li><b>지붕 마감은 전부 상위 레이어</b>: 대각 모서리(356/357/386/387), 용마루(374+354/355), 수직 트림(376/377+384/385).
        빈 칸에만 얹어 이웃 오브젝트를 보존하고, 투명부로 배경(풀)이 비치게 한다.</li>
    <li><b>세트 혼합 금지</b> — 파랑(406·407·467)과 오렌지(404·405·374)는 한 건물에 섞지 않는다. 벽 세트도 지붕 세트와 페어로 고정.</li>
    <li>시공 순서: ① 벽 3행 나인슬라이스 → ② 지붕 3단(하위) → ③ 상위 마감 → ④ 문/창(벽 중단+하단 위에 덮어씀).</li>
    <li>처마 폭: 파랑 = 벽과 동일 / 밝은 오렌지 = 몸통보다 좌우 +1 오버행.</li>
  </ol>
</div>`;

(async () => {
  writeFileSync(`${TMP}/harness-design.html`, html);
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1616, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(`file://${TMP}/harness-design.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${TMP}/house-harness-design.png`, fullPage: true });
  await browser.close();
  console.log("saved:", `${TMP}/house-harness-design.png`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
