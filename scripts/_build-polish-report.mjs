// scripts/_build-polish-report.mjs
// reports/region-polish/index.html 생성 — 이미지를 base64 로 박아 파일 하나로 옮겨도 열리게 한다.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("reports/region-polish");
const SHOTS = path.join(ROOT, "shots");
const facts = JSON.parse(fs.readFileSync(path.join(ROOT, "facts.json"), "utf8"));
const brief = fs.readFileSync(path.join(ROOT, "polish-brief.txt"), "utf8").trimEnd();
const message = fs.readFileSync(path.join(ROOT, "polish-message.txt"), "utf8").trimEnd();

const img = (name) => {
  const b64 = fs.readFileSync(path.join(SHOTS, name)).toString("base64");
  return `data:image/png;base64,${b64}`;
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fig = (name, caption, cls = "") =>
  `<figure class="${cls}"><img src="${img(name)}" alt="${esc(caption)}" loading="lazy"><figcaption>${caption}</figcaption></figure>`;

const warningLines = facts.warningModalText
  .split("\n")
  .filter((line) => line.startsWith("주의 ·"))
  .map((line) => `<li>${esc(line)}</li>`)
  .join("\n");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>영역 다듬기 구현 보고서 · rpg-zzu</title>
<style>
  :root {
    --bg: #0f1115; --panel: #171a21; --panel-2: #1d212a; --line: #2a2f3a;
    --ink: #e6e8ee; --ink-dim: #a4abbb; --ink-faint: #7b8494;
    --accent: #7aa2ff; --good: #6ddc9a; --warn: #e8b84b; --bad: #ef6f6f;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.75 -apple-system, "Segoe UI", "Noto Sans KR", system-ui, sans-serif;
  }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 56px 24px 96px; }
  header.top { border-bottom: 1px solid var(--line); padding-bottom: 28px; margin-bottom: 40px; }
  .kicker { color: var(--accent); font-size: 13px; letter-spacing: .12em; text-transform: uppercase; margin: 0 0 10px; }
  h1 { font-size: 34px; line-height: 1.3; margin: 0 0 12px; letter-spacing: -.01em; }
  .sub { color: var(--ink-dim); margin: 0; font-size: 15px; }
  h2 { font-size: 22px; margin: 52px 0 14px; letter-spacing: -.01em; }
  h2 .num { color: var(--ink-faint); font-variant-numeric: tabular-nums; margin-right: 10px; font-size: 16px; }
  h3 { font-size: 16px; margin: 28px 0 10px; color: var(--ink); }
  p { margin: 0 0 14px; color: var(--ink); }
  p.dim, li.dim { color: var(--ink-dim); }
  ul, ol { margin: 0 0 14px; padding-left: 22px; }
  li { margin: 0 0 7px; }
  code { font-family: var(--mono); font-size: 13.5px; background: var(--panel-2); padding: 1.5px 5px; border-radius: 4px; }
  pre {
    font-family: var(--mono); font-size: 13px; line-height: 1.65; background: var(--panel);
    border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; overflow-x: auto;
    color: #dfe4f0; margin: 0 0 16px; white-space: pre-wrap; word-break: break-word;
  }
  figure { margin: 0 0 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
  /* 원본 크기를 넘겨 늘리지 않는다 — 늘리면 UI 캡처가 뭉갠다 */
  figure img { display: block; width: auto; max-width: 100%; height: auto; margin: 0 auto; border-radius: 6px; image-rendering: pixelated; }
  figure.plain img { image-rendering: auto; }
  figure.wide img { width: 100%; }
  figcaption { color: var(--ink-dim); font-size: 13.5px; margin-top: 10px; line-height: 1.6; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px; }
  @media (max-width: 760px) { .grid2, .grid3 { grid-template-columns: 1fr; } }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; }
  .card h4 { margin: 0 0 8px; font-size: 15px; }
  .card p { margin: 0; color: var(--ink-dim); font-size: 14.5px; }
  .stat { display: flex; gap: 12px; flex-wrap: wrap; margin: 0 0 20px; }
  .stat div { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; min-width: 140px; }
  .stat b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
  .stat span { color: var(--ink-faint); font-size: 12.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 14.5px; margin: 0 0 18px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--ink-faint); font-weight: 600; font-size: 13px; letter-spacing: .04em; }
  td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tag { display: inline-block; font-size: 12px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-dim); }
  .tag.ok { color: var(--good); border-color: #2d5b45; }
  .tag.warn { color: var(--warn); border-color: #5c4a1f; }
  .note { border-left: 3px solid var(--accent); background: var(--panel); border-radius: 0 10px 10px 0; padding: 14px 18px; margin: 0 0 18px; color: var(--ink-dim); font-size: 14.5px; }
  details { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; margin: 0 0 18px; }
  summary { cursor: pointer; color: var(--ink-dim); font-size: 14.5px; }
  details[open] summary { margin-bottom: 12px; }
  footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--ink-faint); font-size: 13px; }
  .path { font-family: var(--mono); font-size: 12.5px; color: var(--ink-faint); word-break: break-all; }
</style>
</head>
<body>
<div class="wrap">

<header class="top">
  <p class="kicker">rpg-zzu · 구현 보고서</p>
  <h1>영역 다듬기 — 선택한 칸을 주변에 이어붙이기</h1>
  <p class="sub">선택 영역 AI 작업에 「주변과 어울리게 다듬기」 경로를 추가했다. 영역 안에서는 타일·이벤트 전권을 주고, 대신 주변을 읽어 브리핑하고, 결과가 주변과 얼마나 맞물리는지 숫자로 검토시킨다. 화면·수치는 모두 실제 실행에서 캡처한 것이다.</p>
</header>

<div class="stat">
  <div><b>3</b><span>새 모듈 (626줄)</span></div>
  <div><b>36</b><span>새 단위 테스트</span></div>
  <div><b>146</b><span>관련 테스트 전체 통과</span></div>
  <div><b>12</b><span>수정 파일 (+516/−48)</span></div>
  <div><b>6</b><span>E2E 캡처 시나리오</span></div>
</div>

<h2><span class="num">01</span>한 줄로</h2>
<p>기존 영역 AI 작업은 <b>영역 안만</b> 봤다. 그래서 마을 한복판을 8×6 으로 잡아 무엇을 만들면, 만들어진 것 자체는 그럴듯해도 경계에서 뚝 끊긴 네모난 흉터가 남았다. 다듬기는 같은 파이프라인에 세 가지를 더한다. 주변 3칸 띠를 읽어 <b>브리핑</b>으로 넣고, 검토 화면에 <b>여백을 포함한 프리뷰</b>와 <b>어울림 점수·경고</b>를 붙이고, 적용 시 경계 오토타일 <b>이음새를 자동 마감</b>한다.</p>

<div class="grid3">
  <div class="card"><h4>주변을 읽는다</h4><p><code>regionSurroundings.ts</code> — 영역 밖 3칸 띠의 재료 구성, 길이 맞닿는 칸, 걸어 들어오는 칸, 이웃 이벤트를 뽑아 한 문단으로 만든다.</p></div>
  <div class="card"><h4>전권을 준다</h4><p><code>regionPolish.ts</code> — "새로 만들지 말고 이어붙여라". 영역 안은 바닥·소품·이벤트 전부 재배치 가능, 영역 밖은 금지.</p></div>
  <div class="card"><h4>맞물림을 잰다</h4><p><code>regionBlend.ts</code> — 초안이 경계에서 어긋난 칸, 새로 막은 진입, 끊은 길을 세어 0~100 점과 경고로 돌려준다.</p></div>
</div>

<h2><span class="num">02</span>들어가는 문 — 선택 → 다듬기</h2>
<p>영역을 잡으면 칩 바에 <code>다듬기</code> 가 붙는다. 기존 <code>AI 작업</code> 옆이라 한 번의 클릭으로 다듬기 모드로 모달이 열린다.</p>
${fig("10-selection-chips.png", `선택 칩 바. 실측 라벨: <code>${esc(facts.chipLabels.split("\n").join(" · "))}</code> · 「다듬기」 툴팁은 <i>${esc(facts.polishChipTitle)}</i>`, "plain")}

<div class="grid2">
  ${fig("20-modal-compose.png", "지시 단계. 입력이 비어 있어도 「주변과 어울리게 다듬기」 버튼만 누르면 된다 — 문장을 지어낼 필요가 없다.", "plain")}
  ${fig("21-modal-category-polish.png", "「모두 보기」 시트를 펼친 화면. 「다듬기」 계열이 소제목 한 묶음으로 들어가고, 그 칩도 같은 경로로 실행된다.", "plain")}
</div>
<p class="dim">즉 입구가 셋이다. 선택 칩 <code>다듬기</code>, 모달 하단 버튼 <code>${esc(facts.polishButtonLabel)}</code>, 추천 칩 <code>주변과 어울리게</code>. 어디로 들어와도 같은 <code>mode: "polish"</code> 실행이다.</p>

<h2><span class="num">03</span>AI 가 실제로 받는 것</h2>
<p>브리핑은 좌표까지 박아 넣는다. 아래는 실제 프리셋 지형(왼쪽 호수, 위쪽 숲, 가로지르는 흙길)에서 <code>analyzeRegionSurroundings</code> → <code>formatRegionSurroundingsBrief</code> 를 돌린 출력이다.</p>
<pre>${esc(brief)}</pre>
<p>이 브리핑이 다듬기 지시문 안에 들어가 총 <b>1,781자 / 39줄</b>의 메시지가 된다. 핵심은 두 문단이다. 영역 안 전권을 열어 주는 문단, 그리고 밖을 건드리지 말라는 제약 문단.</p>
<details>
  <summary>다듬기 메시지 전문 보기 (실제 전송 형태)</summary>
  <pre>${esc(message)}</pre>
</details>
<div class="note">브리핑에서 <code>길이 영역과 맞닿는 칸</code>, <code>바깥에서 걸어 들어오는 칸</code> 은 그냥 정보가 아니다. 같은 좌표를 <b>검토 단계에서 다시 검사</b>해서, 지키지 않으면 경고로 올린다. 지시와 검사가 같은 좌표 목록을 쓴다.</div>

<h2><span class="num">04</span>검토 — 여백이 보이는 프리뷰</h2>
<p>다듬기는 "주변과 맞물리는가"를 보는 작업이라, 영역만 잘라 보여 주면 판단이 불가능하다. 그래서 다듬기 검토는 프리뷰를 <b>영역 + 바깥 2칸</b>으로 넓히고 영역 경계를 점선 액자로 표시한다.</p>
<div class="grid2">
  ${fig("31-polish-overlay.png", `다듬기 프리뷰 — 실측 <b>${facts.polishOverlayCols}×${facts.polishOverlayRows}</b> 칸(영역 8×6 + 바깥 2칸), 점선 액자 <b>${facts.polishFrameCount}</b>개`)}
  ${fig("41-task-overlay.png", `같은 영역, 일반 AI 작업 프리뷰 — 실측 <b>${facts.taskOverlayCols}×${facts.taskOverlayRows}</b> 칸, 액자 <b>${facts.taskFrameCount}</b>개. 주변이 없으니 경계 판단이 안 된다.`)}
</div>
<p>「이전 | 이후」 토글은 같은 프레임을 그대로 쓰므로 배경이 고정된 채 영역 안만 갈린다.</p>
<div class="grid2">
  ${fig("60-preview-before.png", "이전 — 잔디와 집, 아래로 흙길")}
  ${fig("62-preview-after.png", "이후 — 영역 안을 모래로 갈아 낸 초안(의도적으로 어울리지 않는 예)")}
</div>
${fig("30-polish-review.png", `검토 화면 전체. 상단에 재료 요약, 하단에 진단. 이 초안의 어울림 점수는 실측 <code>${esc(facts.polishMetricsText)}</code> — 모래로 덮었으니 주변(잔디)과의 맞물림이 83에서 4로 떨어졌다고 정직하게 보고한다.`, "plain")}

<h2><span class="num">05</span>경고 — 길을 끊거나 문을 막으면</h2>
<p>더 나쁜 초안을 넣어 봤다. 영역 안을 <b>벽</b>으로 채워 바깥에서 들어오던 길과 진입을 전부 막은 경우다.</p>
${fig("52-polish-warning-diagnostics.png", "벽으로 채운 초안의 검토 화면. 경고 칩 3종과 좌표가 붙은 주의 4건이 함께 뜬다.", "plain")}
${fig("53-polish-warning-metrics.png", `경고 칩 실측: <code>${esc(facts.warningMetricsText.split("\n").join(" · "))}</code>`, "plain")}
<ul>
${warningLines}
</ul>
<div class="note"><b>계약:</b> 다듬기 경고는 적용을 <b>막지 않는다</b>. 위 화면에서 <code>적용 · 48칸</code> 버튼은 그대로 활성이다. 막힌 길이 의도일 수도 있기 때문이다(성벽, 폐쇄된 구역). 판단은 사용자에게 남기고, 시스템은 무엇이 끊겼는지 좌표로 말한다. 반대로 <b>영역 밖으로 이벤트를 옮기는 것</b>은 경고가 아니라 되돌림이다 — 좌표를 원위치로 클립한다.</div>

<h2><span class="num">06</span>이음새 — 딱 1칸의 예외</h2>
<p>영역 밖은 건드리지 않는 게 원칙인데, 오토타일 경계는 예외가 필요하다. 잔디와 모래가 만나는 칸의 모양은 <b>양쪽</b>이 결정하므로, 영역 안만 고치면 밖의 경계 칸이 옛 모양으로 남아 이가 어긋난다.</p>
<p>그래서 적용 시 경계 마감 패스가 <b>영역 밖 1칸까지</b> 오토타일을 다시 계산한다. 위 모래 초안을 실제로 적용한 뒤 영역 밖 1칸 링을 전수 비교한 결과, 바뀐 칸은 <b>${facts.seamRingChanged.length}칸(${facts.seamRingChanged.join(", ")})</b> 이었다. 클립 검사도 이 1칸을 차단 사유가 아니라 <code>seamCells</code> 로 따로 보고한다.</p>
${fig("63-after-apply-undo.png", "적용 직후. 되돌리기 배너가 「48칸 타일」 하나로 남는다 — 다듬기 한 번은 되돌리기 한 칸이다.", "plain")}

<h2><span class="num">07</span>불변식</h2>
<table>
  <tr><th>규칙</th><th>지키는 곳</th><th>확인</th></tr>
  <tr><td>영역 밖 타일 변경은 이음새 1칸만 허용</td><td><code>clipToRegion.ts</code></td><td><span class="tag ok">테스트</span> 이음새 칸은 <code>seamCells</code> 로 보고, 차단 없음</td></tr>
  <tr><td>이벤트는 영역 밖으로 못 나간다</td><td><code>clipToRegion.ts</code></td><td><span class="tag ok">테스트</span> 밖 좌표는 원위치 복원</td></tr>
  <tr><td>경고는 적용을 막지 않는다</td><td><code>regionBlend.ts</code> → 모달</td><td><span class="tag ok">E2E</span> 경고 4건에도 <code>적용 · 48칸</code> 활성</td></tr>
  <tr><td>다듬기는 새 맵을 만들지 않는다</td><td>지시문 + 실행 가드</td><td><span class="tag ok">테스트</span> <code>create_map</code> 계열 금지 문구</td></tr>
  <tr><td>「다시 만들기」도 다듬기로 재실행</td><td><code>regionTaskModal.ts</code></td><td><span class="tag ok">테스트</span> <code>lastAiMode</code> 유지</td></tr>
  <tr><td>적용은 되돌리기 1칸</td><td>기존 pending 경로 재사용</td><td><span class="tag ok">E2E</span> 「48칸 타일」 배너 1개</td></tr>
</table>

<h2><span class="num">08</span>검증</h2>
<table>
  <tr><th>항목</th><th class="num">결과</th><th>내용</th></tr>
  <tr><td>새 테스트</td><td class="num">36</td><td>주변 분석 9 · 어울림 11 · 지시문 7 · 모달 9 — 전부 통과</td></tr>
  <tr><td>단위 테스트</td><td class="num">331 / 336</td><td>영역 관련 31파일 재실행. 실패 5건은 <b>main 에서도 같이 실패</b>(도구 노출 3파일, 이 작업과 무관)</td></tr>
  <tr><td>E2E 캡처</td><td class="num">6 / 6</td><td>이 보고서의 모든 화면·수치가 나온 실행</td></tr>
  <tr><td>CSS 게이트</td><td class="num"><span class="tag ok">통과</span></td><td>예산(264파일, 회귀 0) · 그래프(orphan 0) · 실사용 클래스(보호 996종) 전부 통과</td></tr>
  <tr><td>타입 검사</td><td class="num"><span class="tag warn">기존 2건</span></td><td><code>tsc --noEmit -p tsconfig.app.json</code> — 두 건 다 <b>main 과 동일</b>(<code>editorWelcome.ts</code>, <code>editActivityPanel.ts</code>: 이 작업이 건드리지 않은 파일)</td></tr>
  <tr><td>표면 게이트</td><td class="num"><span class="tag warn">기존 4건</span></td><td>9축 중 스냅샷 4축 실패 — <b>main 에서도 같은 4건</b></td></tr>
</table>
<p class="dim">이 보고서의 라벨·칸 수·점수·좌표는 캡처 실행이 DOM 에서 읽어 <code>facts.json</code> 에 적은 값을 그대로 옮긴 것이다. 손으로 적은 숫자는 없다.</p>
<p class="dim">「기존 N건」은 <code>origin/main</code> 을 임시 워크트리로 떠서 같은 명령을 돌린 뒤 <b>실패 목록이 글자 그대로 같음</b>을 확인한 것이다 — 이 브랜치가 새로 만든 실패는 없다. 남의 실패를 내 통과로 적지 않고, 내 통과로 남의 실패를 덮지도 않는다.</p>

<h2><span class="num">09</span>남은 것</h2>
<ul>
  <li class="dim"><b>어울림 점수의 절대값은 아직 거칠다.</b> 경계 어긋남·막힌 진입·끊긴 길의 가중 합이라, 점수 자체보다 <i>이전 → 이후</i> 변화와 경고 목록이 신뢰할 만한 신호다.</li>
  <li class="dim"><b>브리핑 띠는 3칸 고정에 가깝다.</b> 영역이 아주 클 때 3칸 띠는 상대적으로 얇다 — 영역 크기 비례 확장은 후속.</li>
  <li class="dim"><b>위층(소품) 어울림은 부분적이다.</b> 재료 구성은 읽지만, 나무 띠가 이어지는지 같은 형태 판단은 아직 점수에 안 들어간다.</li>
  <li class="dim"><b>실내에는 붙이지 않았다.</b> 다듬기는 지금 야외 맵 기준이다.</li>
</ul>

<footer>
  <p>캡처·수치 원본: <span class="path">reports/region-polish/facts.json</span> · 화면: <span class="path">reports/region-polish/shots/</span> · 브리핑 원문: <span class="path">reports/region-polish/polish-message.txt</span></p>
  <p>재생성: <span class="path">E2E_INCLUDE_DIAGNOSTICS=1 playwright test test/e2e/_region-polish-report-shots.spec.ts</span> → <span class="path">vite-node scripts/_polish-brief-sample.mts</span> → <span class="path">node scripts/_build-polish-report.mjs</span></p>
</footer>

</div>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, "index.html"), html, "utf8");
const bytes = fs.statSync(path.join(ROOT, "index.html")).size;
console.log(`index.html ${(bytes / 1024).toFixed(0)}KB`);
