// new-editor/render-report.mjs
// 증거 스크린을 base64 로 심어 최종 REPORT.html 을 만든다.
// 사용: node new-editor/render-report.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const b64 = (p) =>
  "data:image/png;base64," + readFileSync(path.join(root, p)).toString("base64");

const mockup = b64("new-editor/mockup/event-editor-mockup.png");
const before = (n) => b64(`output/evidence/before/${n}.png`);
const after = (n) => b64(`output/evidence/event-editor-mockup/${n}.png`);

const pairs = [
  ["01", "전체 셸 / 3열 비율", "settings 트랙 540→312px · 인스펙터 348px 고정(실측 312/760/348). 레일 하단이 비던 과폭을 해소하고 캔버스가 숨을 쉰다.", "01-shell"],
  ["02", "블록 캔버스 / 헤드 행", "범례를 툴바와 같은 32px 행에 absolute 정렬하고 \"실행 내용 · N개\"로 실제 명령 수(중첩 포함)를 표시. 거터 다색·분기 마커 22px.", "02-block-canvas"],
  ["03", "좌측 레일", "gfx/trig 겹침을 grid-auto-rows: min-content 로 해소(1280 포함). 썸네일 52×62 + 버튼 26px, 라벨 스택 분리.", "03-rail"],
  ["04", "페이지 탭", "유령 숫자 배지 해제, 비활성 탭 챔퍼 + 조건 요약 t2 대비. 활성 탭은 앰버 상단 바 카드.", "04-page-tabs"],
  ["05", "인라인 인스펙터", "선택 시 섹션 카드(그래픽/위치/표시 효과), 미선택 시 페이지 요약 7행 통계. 한글 라벨 압착 해소.", "05-inspector"],
  ["06", "명령 팔레트 / 검증 스트립", "팔레트 천장 min(52vh,460px), 검증 스트립 104px + 얇은 스크롤바. 카테고리 탭 + 검색 + 하단 범례.", "06-palette"],
  ["07", "빈 이벤트 / 광폭", "빈 캔버스 중앙 정렬, 1950px 광폭에서도 3열 유지. 유휴 인스펙터 요약 카드.", "07-empty-wide"],
];

const matrix = [
  ["07-shell-1280", "1280×800"],
  ["07-shell-1500", "1500×1000 (목업 기준)"],
  ["07-shell-1920", "1920×1080"],
  ["07-shell-2560", "2560×1440"],
];

const scores = [
  ["A", "모달 셸 / 3열 비율", "3", "실측 312/760/348, 리사이저 하한 288. 목업과 동일."],
  ["B", "페이지 탭 / 조건 요약", "3", "활성 탭 앰버 바, 비활성 챔퍼, 요약 t2 대비."],
  ["C", "좌측 레일", "3", "겹침 없음(뷰포트 4종), 스택 분리."],
  ["D", "블록 캔버스 / 헤드 행 / 툴바", "3", "헤드 행 32px 정렬(기계 검증), 범례 N개, 거터 다색, 마커 22px."],
  ["E", "인라인 인스펙터", "3", "선택/미선택 두 상태 모두 목업 위계와 동일."],
  ["F", "팔레트 / 검증 스트립", "3", "천장·스크롤바·범례 배치 동일."],
  ["G", "빈 상태 / 푸터", "3", "푸터 좌 상태 2행·우 액션 6(삭제=위험 고스트), 빈 캔버스 중앙."],
];

const parity = [
  "가로 페이지 탭", "탭 조건 요약", "이벤트 카드", "카드가 레일 최상단", "3열 배치",
  "열 폭 312·348", "블록 캔버스 거터 다색", "인라인 인스펙터", "카테고리 범례",
  "범례가 캔버스 아래", "인스펙터에 읽을 것", "하단 검증 스트립", "황동 확인 버튼",
  "헤드 행 32 정렬", "범례 명령 수",
];

const rounds = [
  ["1", "2026-08-04", "3열 비율·레일·캔버스·인스펙터 1차 정합 + 게임 필 스킨 레이어 신설", "2점대 → 3점 대다수"],
  ["2", "2026-08-04", "그리드 배치 확정 + 검증 스트립 천장 104px", "D·F 3"],
  ["3", "2026-08-04", "카드 겹침 회귀 · 한글 라벨 압착 · 탭 썸네일 스케일", "전 영역 3, parity 13/13"],
  ["4", "2026-08-05", "푸터 목업 동일 재배치 · 1280 레일 겹침 · 매트릭스 invariant 9번째", "전 영역 3 유지, 매트릭스 9/9×4"],
  ["5", "2026-08-05", "헤드 행 32px 정렬 · 범례 \"실행 내용 · N개\" · parity 2항목 추가", "전 영역 3 유지, parity 15/15 — 종료 조건 충족"],
];

const pairFig = ([num, title, note, file]) => `
<figure class="pairfig">
  <div class="pair">
    <div class="shot"><span class="tag before">BEFORE</span><a href="${before(file)}"><img src="${before(file)}" alt="before ${num}"></a></div>
    <div class="shot"><span class="tag after">AFTER</span><a href="${after(file)}"><img src="${after(file)}" alt="after ${num}"></a></div>
  </div>
  <figcaption><span class="num">${num}</span> ${title} — ${note}</figcaption>
</figure>`;

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>이벤트 에디터 목업 대조 · 최종 보고서</title>
<style>
:root{
  --bg:#0f1117; --surface:#151823; --raised:#1c202d;
  --text:#e9ecf3; --muted:#9aa3b5; --brass:#d9a441;
  --line:#262b3a; --line-soft:#1f2432;
}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0; background:var(--bg); color:var(--text);
  font:14px/1.65 "Malgun Gothic","맑은 고딕",system-ui,sans-serif}
.wrap{max-width:1180px; margin:0 auto; padding:32px 24px 64px}
code{font-family:Consolas,"Cascadia Mono",monospace; background:var(--raised);
  border:1px solid var(--line-soft); border-radius:3px; padding:0 5px; font-size:12px; color:#dfe4ee}
img{display:block; max-width:100%}
header{padding:8px 0 4px}
h1{margin:0 0 6px; font-size:26px; letter-spacing:-.01em}
h1 .date{color:var(--muted); font-weight:400; font-size:16px; margin-left:10px}
.summary{margin:0 0 16px; font-size:14.5px}
.badges{display:flex; flex-wrap:wrap; gap:8px; margin:0 0 8px}
.badge{border:1px solid var(--line); background:var(--surface); border-radius:3px;
  padding:5px 10px; font-size:12.5px; color:var(--muted)}
.badge b{color:var(--text); font-weight:600}
.badge b.ok{color:var(--brass)}
h2{margin:34px 0 14px; font-size:17px; display:flex; align-items:center; gap:9px;
  border-bottom:1px solid var(--line-soft); padding-bottom:10px}
h2::before{content:""; width:9px; height:9px; background:var(--brass); border-radius:1px; flex:none}
h2 .sub{color:var(--muted); font-size:12px; font-weight:400; margin-left:auto}
figure{margin:0}
figcaption{color:var(--muted); font-size:12.5px; margin-top:8px; line-height:1.55}
figcaption .num{color:var(--brass); margin-right:6px; font-family:Consolas,monospace}
.mockwrap img,.solo img,.shot img{width:100%; border:1px solid var(--line); border-radius:3px; background:var(--raised)}
.pair{display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:14px 0 4px}
.pairfig{border-bottom:1px dashed var(--line-soft); padding-bottom:16px; margin-bottom:6px}
.pairfig:last-of-type{border-bottom:0}
.shot{position:relative; min-width:0}
.shot a,.solo a,.mockwrap a{display:block; cursor:zoom-in}
.shot a:hover img,.solo a:hover img,.mockwrap a:hover img{border-color:var(--brass)}
.tag{position:absolute; top:8px; left:8px; z-index:2; font-size:10.5px; letter-spacing:.08em;
  padding:2px 7px; border-radius:2px; border:1px solid var(--line);
  font-family:Consolas,monospace}
.tag.before{background:rgba(28,32,45,.92); color:var(--muted)}
.tag.after{background:rgba(217,164,65,.14); color:var(--brass); border-color:rgba(217,164,65,.45)}
.solo-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px}
table{width:100%; border-collapse:collapse; font-size:13px}
th,td{border:1px solid var(--line-soft); padding:9px 12px; text-align:left; vertical-align:top}
th{background:var(--raised); color:var(--muted); font-size:12px}
td .s3{color:var(--brass); font-weight:700; font-family:Consolas,monospace}
ul.parity{columns:2; column-gap:28px; font-size:13px; margin:10px 0 0; padding-left:18px}
ul.parity li{margin:2px 0}
ul.parity li::marker{color:var(--brass)}
footer{margin-top:40px; color:var(--muted); font-size:12px; border-top:1px solid var(--line-soft); padding-top:14px}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>이벤트 에디터 목업 대조 · 최종 보고서<span class="date">2026-08-05</span></h1>
  <p class="summary">5라운드 목업 대조 루프 종료. 채점 A~G <b>전부 3점</b>, 기계 parity <b>15/15</b>,
  2라운드 연속 강등 없음으로 <code>new-editor/README.md</code> 의 종료 조건을 충족했다.
  아래 모든 AFTER 스크린샷은 최종 커밋 상태의 실기 캡처이며, BEFORE 는 루프 진입 전 캡처다.</p>
  <div class="badges">
    <span class="badge">typecheck <b class="ok">통과</b> · 에러 <b>0</b></span>
    <span class="badge">playwright parity <b class="ok">15/15</b> · <b>8 passed</b> · 매트릭스 <b class="ok">9/9×4 뷰포트</b></span>
    <span class="badge">vitest <b>4 failed · 98 passed</b> = origin/main 기준선(신규 실패 0)</span>
    <span class="badge">build <b class="ok">통과</b></span>
  </div>
</header>

<h2>목표 목업 <span class="sub">new-editor/mockup/event-editor-mockup.png</span></h2>
<figure class="mockwrap">
  <a href="${mockup}"><img src="${mockup}" alt="목표 목업"></a>
  <figcaption>정본 목업(v2 목표안) — 모든 채점의 기준. 1500×1000 자체 완결 HTML 의 렌더.</figcaption>
</figure>

<h2>최종 셸 <span class="sub">output/evidence/event-editor-mockup/01-shell.png</span></h2>
<figure class="mockwrap">
  <a href="${after("01-shell")}"><img src="${after("01-shell")}" alt="최종 셸"></a>
  <figcaption>루프 종료 시점의 전체 셸. 헤드 행(범례 좌 · 툴바 우, 32px 정렬) · 3열 312/760/348 ·
  검증 스트립 · 푸터(좌 상태 2행 · 우 액션 6)까지 목업과 동일 위계.</figcaption>
</figure>

<h2>영역별 전후 비교 <span class="sub">BEFORE = 루프 진입 전</span></h2>
${pairs.map(pairFig).join("\n")}

<h2>뷰포트 매트릭스 <span class="sub">invariant 9항목 × 4뷰포트, 9/9</span></h2>
<div class="solo-grid">
${matrix.map(([f, label]) => `  <figure class="solo"><a href="${after(f)}"><img src="${after(f)}" alt="${label}"></a><figcaption>${label}</figcaption></figure>`).join("\n")}
</div>

<h2>근접 캡처</h2>
<div class="solo-grid">
  <figure class="solo"><a href="${after("08-card")}"><img src="${after("08-card")}" alt="이벤트 카드"></a><figcaption>이벤트 카드 — 겹침 없음.</figcaption></figure>
  <figure class="solo"><a href="${after("09-inspector-idle")}"><img src="${after("09-inspector-idle")}" alt="유휴 인스펙터"></a><figcaption>미선택 인스펙터 — 페이지 요약 카드.</figcaption></figure>
</div>

<h2>채점표 <span class="sub">CHECKLIST.md 와 동일</span></h2>
<table>
  <tr><th>영역</th><th>점수</th><th>근거</th></tr>
${scores.map(([a, t, s, why]) => `  <tr><td><b>${a}.</b> ${t}</td><td><span class="s3">${s}</span></td><td>${why}</td></tr>`).join("\n")}
</table>

<h2>기계 parity 15/15</h2>
<ul class="parity">
${parity.map((p) => `  <li>${p}</li>`).join("\n")}
</ul>

<h2>라운드 로그</h2>
<table>
  <tr><th>라운드</th><th>날짜</th><th>고친 것</th><th>결과</th></tr>
${rounds.map(([r, d, w, o]) => `  <tr><td>${r}</td><td>${d}</td><td>${w}</td><td>${o}</td></tr>`).join("\n")}
</table>

<footer>
  생성: <code>node new-editor/render-report.mjs</code> · 이미지는 base64 내장(자체 완결) ·
  원본 캡처: <code>output/evidence/event-editor-mockup/</code>, 루프 전 캡처: <code>output/evidence/before/</code>
</footer>
</div>
</body>
</html>
`;

writeFileSync(path.join(here, "REPORT.html"), html);
console.log("REPORT.html", (html.length / 1024 / 1024).toFixed(2), "MB");
