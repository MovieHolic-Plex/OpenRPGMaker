// 좌측 사이드바 도구 적대적 리뷰 — 이미지 내장(base64) HTML 보고서 생성기.
// 사용: node scripts/build-left-sidebar-review-report.mjs
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SHOTS = join(ROOT, "output", "evidence", "left-sidebar-review", "shots");
const OUT = join(ROOT, "reports", "left-sidebar-tools-adversarial-review.html");

let embedded = 0;
let embeddedBytes = 0;
function img(file, alt) {
  const path = join(SHOTS, file);
  const bytes = readFileSync(path);
  embedded += 1;
  embeddedBytes += statSync(path).size;
  return `<img class="shot" alt="${alt}" src="data:image/png;base64,${bytes.toString("base64")}"/>`;
}
function fig(file, alt, cap) {
  return `<figure class="figure">${img(file, alt)}<figcaption>${cap}</figcaption></figure>`;
}
// 초보 레일은 72px 세로 띠다 — 그리드 폭에 맞춰 늘리면 뭉개지므로 원비율로 가운데 정렬한다.
function figRail(file, alt, cap) {
  const tag = img(file, alt).replace('class="shot"', 'class="shot rail"');
  return `<figure class="figure"><div class="rail-hold">${tag}</div><figcaption>${cap}</figcaption></figure>`;
}

const CSS = `
:root{--bg:#0b1020;--text:#eaf0ff;--muted:#9fb0d4;--dim:#6f80a6;--accent:#5b7cfa;--accent2:#7ee7d0;
--bad:#ff5d73;--warn:#ffb84d;--good:#3dd68c;--line:rgba(255,255,255,.1);--shadow:0 18px 48px rgba(0,0,0,.45)}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:radial-gradient(1100px 520px at 15% -10%,#1b2a5a 0,transparent 60%),radial-gradient(900px 460px at 95% 0,#163a52 0,transparent 55%),var(--bg);
color:var(--text);font-family:Pretendard,"Noto Sans KR",system-ui,-apple-system,sans-serif;line-height:1.7;font-size:15px}
.wrap{max-width:1140px;margin:0 auto;padding:26px 20px 70px}
.top{position:sticky;top:0;z-index:30;backdrop-filter:blur(14px) saturate(160%);background:linear-gradient(180deg,rgba(11,16,32,.97),rgba(11,16,32,.7));border-bottom:1px solid var(--line)}
.top-in{max-width:1140px;margin:0 auto;padding:11px 20px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.brand{display:flex;gap:11px;align-items:center}.logo{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:900;
background:conic-gradient(from 210deg,var(--accent),#8b7cff,var(--accent2),var(--accent));box-shadow:0 8px 22px rgba(91,124,250,.35)}
.brand h1{margin:0;font-size:14px;letter-spacing:-.2px}.brand p{margin:0;font-size:11.5px;color:var(--muted)}
.nav{display:flex;gap:6px;flex-wrap:wrap}.nav a{font-size:11.5px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);
background:rgba(255,255,255,.04);color:var(--text);text-decoration:none}.nav a:hover{background:rgba(91,124,250,.18)}
h2{font-size:21px;margin:0;letter-spacing:-.3px}h3{font-size:15.5px;margin:22px 0 8px}
section{margin-top:18px;border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:var(--shadow);
background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02))}
.sec-head{padding:17px 20px 0;display:flex;gap:12px;align-items:flex-start}
.sec-num{flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-weight:900;color:#fff;
background:linear-gradient(135deg,var(--accent),#8b7cff);box-shadow:0 8px 20px rgba(91,124,250,.35)}
.sec-head p{margin:4px 0 0;color:var(--muted);font-size:13px}.sec-body{padding:14px 20px 22px}
.hero{display:grid;grid-template-columns:1.35fr .85fr;gap:14px;margin-top:16px;align-items:start}@media(max-width:960px){.hero{grid-template-columns:1fr}}
.card{background:rgba(0,0,0,.22);border:1px solid var(--line);border-radius:16px;padding:14px}
.hero-card{border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:var(--shadow);position:relative;overflow:hidden;
background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))}
.kicker{font-size:11px;letter-spacing:.13em;color:var(--accent2);font-weight:800}
.h-title{font-size:27px;line-height:1.2;margin:8px 0;font-weight:900;letter-spacing:-.6px}
.h-sub{color:var(--muted);font-size:13.5px;margin:0}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:14px}@media(max-width:700px){.metrics{grid-template-columns:repeat(2,1fr)}}
.metric{background:rgba(0,0,0,.25);border:1px solid var(--line);border-radius:13px;padding:10px}
.metric .n{font-size:19px;font-weight:900}.metric .l{font-size:11px;color:var(--muted)}
.toc{border:1px solid var(--line);border-radius:18px;overflow:hidden;background:rgba(255,255,255,.03)}
.toc h3{margin:0;padding:13px 15px;font-size:12.5px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.05)}
.toc a{display:flex;gap:10px;align-items:center;padding:9px 14px;text-decoration:none;color:var(--muted);border-bottom:1px solid rgba(255,255,255,.05);font-size:12.5px}
.toc a:hover{color:var(--text);background:rgba(91,124,250,.1)}
.num{flex:0 0 auto;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:rgba(91,124,250,.16);color:#a9c4ff;font-weight:900;font-size:11.5px}
table{width:100%;border-collapse:collapse;font-size:12.8px;margin:10px 0}
th{text-align:left;color:var(--muted);font-size:11px;font-weight:700;padding:8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:8px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.8px;background:rgba(126,231,208,.1);color:#9df0dd;padding:1px 5px;border-radius:5px}
.sev{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:800;border:1px solid var(--line);white-space:nowrap}
.sev.p0{background:rgba(255,93,115,.16);color:#ff97a6;border-color:rgba(255,93,115,.4)}
.sev.p1{background:rgba(255,184,77,.14);color:#ffd08a;border-color:rgba(255,184,77,.36)}
.sev.p2{background:rgba(91,124,250,.14);color:#aec6ff;border-color:rgba(91,124,250,.32)}
.sev.ok{background:rgba(61,214,140,.14);color:#8af0bf;border-color:rgba(61,214,140,.32)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:900px){.grid2{grid-template-columns:1fr}}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}@media(max-width:900px){.grid3{grid-template-columns:1fr}}
.figure{margin:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:rgba(6,10,20,.6)}
.shot{display:block;width:100%;height:auto;background:#0e1426}
.rail-hold{display:flex;justify-content:center;padding:12px 0;background:#0e1426}
.shot.rail{width:auto;max-width:86px;max-height:560px;border-radius:8px}
figcaption{font-size:11.5px;color:var(--muted);padding:9px 11px;border-top:1px solid var(--line);line-height:1.55}
.callout{border-left:3px solid var(--accent);background:rgba(91,124,250,.09);padding:11px 13px;border-radius:10px;font-size:13px;color:#cfdcff;margin:12px 0}
.callout.bad{border-color:var(--bad);background:rgba(255,93,115,.09)}
.callout.good{border-color:var(--good);background:rgba(61,214,140,.09)}
.callout.warn{border-color:var(--warn);background:rgba(255,184,77,.09)}
.callout b{color:#fff}
pre{background:rgba(0,0,0,.4);border:1px solid var(--line);border-radius:12px;padding:12px 13px;overflow-x:auto;font-size:11.8px;line-height:1.6;color:#cfe3ff}
ul{padding-left:20px}li{margin:5px 0}
.kbd{font-family:ui-monospace,monospace;font-size:11px;padding:2px 6px;border-radius:6px;border:1px solid var(--line);background:rgba(255,255,255,.08)}
.eyebrow{font-size:10.5px;letter-spacing:.13em;color:var(--accent2);font-weight:800;margin-bottom:6px}
footer{color:var(--dim);font-size:11.5px;text-align:center;margin-top:20px;line-height:1.8}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
.chip{font-size:11px;padding:5px 9px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--muted)}
.chip b{color:var(--text)}
`;

const sections = [];
function section(id, num, title, sub, body) {
  sections.push(`<section id="${id}"><div class="sec-head"><div class="sec-num">${num}</div><div><h2>${title}</h2><p>${sub}</p></div></div><div class="sec-body">${body}</div></section>`);
}

/* ─────────────────────────── 1. 무엇이 있나 ─────────────────────────── */
section("s1", 1, "먼저, 이 사이드바에 뭐가 있나", "모드가 3개다. 같은 도구가 모드마다 다른 얼굴로 나온다.", `
<p>에디터는 UI 모드가 <b>초보 / 표준 / 전문가</b> 3개다(<code>oprn:editor-ui-mode</code>). 좌측 사이드바는 모드에 따라 아예 다른 물건이 된다.</p>
<div class="grid3">
${figRail("beginner-sidebar.png", "초보 모드 좌측 아이콘 레일", "<b>초보</b> — 72px 아이콘 레일. 도구 6개(선택·칠하기·지우기·채우기·장면·집기) → 레이어 3개 → 타일/맵 버튼. 이름이 항상 보인다.")}
${fig("standard-sidebar.png", "표준 모드 좌측 팔레트 컬럼", "<b>표준</b> — 300px 팔레트 컬럼. 아이콘만 있는 도구막대 한 줄 + 레이어 + 검색 + 타일 그림판 + 붓 보조 + 구조물 + 맵 목록.")}
${fig("expert-sidebar.png", "전문가 모드 좌측 팔레트 컬럼", "<b>전문가</b> — 320px. 표준과 도구 구성이 <b>완전히 같다</b>. 다른 점은 상단 클래식 툴바(저장·DB·소재…)인데 거기엔 그리기 도구가 없다.")}
</div>
<h3>도구별 활성 상태 — 초보 레일 6개를 실제로 눌러 봤다</h3>
<p>레일은 켜진 도구를 진한 파란 배경으로 확실히 알려 준다. 아래 캡처는 각 도구를 누른 직후의 레일이고, 괄호 안은 그 순간 <code>body[data-editor-tool]</code> 값이다.</p>
<div class="grid3">
${figRail("beginner-tool-tool-select.png", "선택 도구 활성", "<b>선택</b> (select) — 영역을 잡는 도구. 커서는 <code>crosshair</code>인데 칠하기와 같다(§4).")}
${figRail("beginner-tool-tool-paint.png", "칠하기 도구 활성", "<b>칠하기</b> (paint) — 누르면 타일 플라이아웃이 자동으로 함께 열린다(의도된 동작).")}
${figRail("beginner-tool-tool-erase.png", "지우기 도구 활성", "<b>지우기</b> (erase) — 커서 매핑이 없어 기본 화살표로 떨어지는 유일한 도구.")}
</div>
<div class="grid3" style="margin-top:14px">
${figRail("beginner-tool-tool-fill.png", "채우기 도구 활성", "<b>채우기</b> (fill) — 이어진 영역을 한 번에. 도구막대에서는 이름이 “이어진 영역 채우기”다.")}
${figRail("beginner-tool-tool-event.png", "장면 도구 활성", "<b>장면</b> (event) — 레일에서는 레이어까지 이벤트로 함께 바뀐다. 도구막대는 안 바뀐다(§5).")}
${figRail("beginner-tool-tool-eyedropper.png", "집기 도구 활성", "<b>집기</b> (eyedropper) — 타일을 집으면 말없이 칠하기로 전환된다(§5).")}
</div>
<div class="grid2" style="margin-top:14px">
${fig("beginner-shell.png", "초보 모드 전체 화면", "초보 모드 전체 화면(1440×900). 좌측 72px 레일 + 캔버스. 캔버스가 비어 보이는 건 헤드리스 WebGL 캡처의 한계이고 사이드바 판정에는 영향이 없다.")}
${fig("expert-shell.png", "전문가 모드 전체 화면", "전문가 모드 전체 화면. 상단에 클래식 툴바가 한 줄 더 붙지만 거기엔 그리기 도구가 없다 — 저장·DB·소재·찾기 같은 프로젝트 동작뿐이다.")}
</div>
<h3>도구 목록 — 코드에 있는 것 전부</h3>
<p>내부 도구는 8종이다: <code>paint fill collision event erase select eyedropper pan</code>(<code>src/editor/editorState.ts:16</code>). 여기에 칠하기 모양 <code>pen|rect|round</code>과 붓 크기 1~4가 곱해진다.</p>
<table>
<tr><th>도구</th><th>초보 레일</th><th>표준·전문가 도구막대</th><th>단축키</th><th>한 줄 설명</th></tr>
<tr><td>select</td><td>선택</td><td>영역 선택</td><td><span class="kbd">V</span> / 5</td><td>사각형으로 영역을 잡는다. 복사·붙여넣기·AI 작업의 기준.</td></tr>
<tr><td>paint (pen)</td><td>칠하기</td><td>칠하기</td><td><span class="kbd">B</span> / 1</td><td>고른 타일을 한 칸씩 칠한다.</td></tr>
<tr><td>paint (rect)</td><td style="color:#ff97a6">없음</td><td>사각형 채우기</td><td style="color:#ff97a6">없음</td><td>드래그한 사각형을 통째로 칠한다.</td></tr>
<tr><td>paint (round)</td><td style="color:#ff97a6">없음</td><td>타원 채우기</td><td style="color:#ff97a6">없음</td><td>드래그한 타원을 통째로 칠한다.</td></tr>
<tr><td>erase</td><td>지우기</td><td>지우기</td><td><span class="kbd">E</span></td><td>현재 레이어에서 지운다. <b>숫자키가 없다.</b></td></tr>
<tr><td>fill</td><td>채우기</td><td>이어진 영역 채우기</td><td><span class="kbd">G</span> / 2</td><td>같은 타일로 이어진 영역을 한 번에 바꾼다.</td></tr>
<tr><td>eyedropper</td><td>집기</td><td>타일 집기</td><td><span class="kbd">I</span> / 3</td><td>맵에 놓인 타일을 팔레트 선택으로 가져온다.</td></tr>
<tr><td>event</td><td>장면</td><td>장면 놓기</td><td><span class="kbd">N</span> / 7</td><td>이벤트를 놓거나 고른다.</td></tr>
<tr><td>pan</td><td style="color:#ff97a6">없음</td><td>화면 밀기</td><td>4 · <span class="kbd">Space</span> 홀드</td><td>맵 화면을 드래그로 민다.</td></tr>
<tr><td>collision</td><td style="color:#ff97a6">없음</td><td>통행 표시</td><td>6</td><td>지나갈 수 있는 칸인지 표시·변경.</td></tr>
<tr><td>붓 크기 1~4</td><td style="color:#ff97a6">없음</td><td>⋯ 메뉴 안</td><td style="color:#ff97a6">없음</td><td>한 번에 칠하는 칸 수.</td></tr>
</table>
<div class="callout warn">초보 모드에서 <b>사각형/타원 채우기와 붓 크기는 어떤 방법으로도 쓸 수 없다.</b> 화면 밀기·통행 표시는 숫자키 4·6으로만 닿는데, 그 사실은 도움말 모달의 “1 ~ 7” 한 줄에만 적혀 있다.</div>
<div class="grid2">
${fig("beginner-flyout-tiles.png", "초보 모드 타일 플라이아웃", "초보 레일의 타일 플라이아웃 — 캔버스 위에 떠서 좌패널 폭을 건드리지 않는다(WebGL 리사이즈 회피). 다만 타일은 48칸으로 잘린다.")}
${fig("beginner-flyout-maps.png", "초보 모드 맵 플라이아웃", "맵 플라이아웃 — 초보 모드에는 맵 트리 컬럼이 없어서 맵 전환은 전부 여기로 온다.")}
</div>`);

/* ─────────────────────────── 2. P0 오버플로 ─────────────────────────── */
section("s2", 2, "P0 — ⋯ 메뉴는 열려도 화면에 안 나온다", "복사·붙여넣기·붓 크기·인스펙터·규칙 감사·작업 기록. 9개 기능이 사실상 없다.", `
<p>표준·전문가 도구막대는 아이콘 12개를 <b>한 줄</b>에 넣는다. 좌패널 폭은 표준 300px, 전문가 320px로 코드가 상한을 걸어 둔다(<code>src/editor/editorUiMode.ts:74,93</code>). 12개가 들어가지 않는다.</p>
<div class="grid2">
${fig("standard-toolbar-row.png", "표준 모드 도구막대 한 줄", "<b>표준(300px)</b> 도구막대. 눈에 보이는 아이콘은 9개. 통행 표시·장면 놓기·⋯ 는 오른쪽으로 밀려 사라졌다.")}
${fig("expert-toolbar-row.png", "전문가 모드 도구막대 한 줄", "<b>전문가(320px)</b>. 20px 더 넓어서 통행 표시 하나가 더 들어왔다. 장면 놓기와 ⋯ 는 여전히 밖.")}
</div>
<h3>실측 — 브라우저에서 직접 재 봤다</h3>
<p>도구막대는 <code>overflow-x: auto</code>인 30px 스트립이고, 내용 폭이 항상 344px다.</p>
<table>
<tr><th>모드</th><th>보이는 폭(clientWidth)</th><th>내용 폭(scrollWidth)</th><th>잘려 나간 버튼</th></tr>
<tr><td>표준(300px)</td><td>261px</td><td>344px</td><td><code>tool-collision</code>, <code>tool-event</code>, <code>oprn-tool-overflow</code> — <span class="sev p0">3개</span></td></tr>
<tr><td>전문가(320px)</td><td>281px</td><td>344px</td><td><code>tool-event</code>, <code>oprn-tool-overflow</code> — <span class="sev p0">2개</span></td></tr>
</table>
<div class="callout bad"><b>가장 나쁜 부분:</b> 좁을 때를 대비해 만든 <b>⋯ “더 보기” 버튼 자신이 잘려 나간다.</b> 넘침을 해결하려고 둔 장치가 넘침에 같이 휩쓸렸다.</div>
<div class="grid2">
${fig("measure-toolbar-clip.png", "측정 대상 도구막대", "측정에 쓴 도구막대 그대로. 오른쪽 끝에서 아이콘이 잘려 나가는 지점이 보인다.")}
${fig("expert-overflow.png", "전문가 모드에서 ⋯ 를 누른 직후", "전문가 모드에서 ⋯ 를 눌렀을 때. 통행 표시가 켜진 것처럼 보이지만 실제로 눌린 건 화면 밖의 ⋯ 이고, 메뉴는 어디에도 없다.")}
</div>
<h3>스트립을 억지로 스크롤해서 ⋯ 를 눌러 봤다 — 그래도 안 보인다</h3>
<div class="grid3">
${fig("standard-toolbar-scroll-0.png", "스크롤 전 도구막대", "① 처음 상태. ⋯ 는 화면에 없다.")}
${fig("standard-toolbar-scroll-end.png", "가로 스크롤 끝까지 밀은 도구막대", "② <code>scrollLeft = scrollWidth</code>로 끝까지 밀면 통행 표시·장면 놓기·⋯ 가 나타난다. 30px 높이 스트립에 마우스로 이걸 하라는 뜻이다.")}
${fig("standard-overflow-open.png", "⋯ 클릭 후 좌패널", "③ 그 상태에서 ⋯ 를 눌렀다. DOM에는 메뉴가 열려 있는데 <b>화면에는 아무것도 안 뜬다.</b>")}
</div>
${fig("measure-overflow-open-fullpage.png", "⋯ 메뉴가 열린 상태의 전체 화면", "④ 전체 화면. <code>[data-testid=\"toolbar-overflow-dropdown\"]</code> 가 열려 있고 항목 9개를 갖고 있지만, 그 자리에는 타일 그림판이 그대로 보인다.")}
<h3>왜 안 보이나</h3>
<pre>드롭다운 박스   x=101 y=115  174x320   (position: absolute, z-index: 40, visibility: visible)
도구막대 박스   x=13  y=80   263x30    (overflow-x: auto, overflow-y: hidden)
드롭다운은 도구막대의 <b>자손</b>이다 → 30px 스트립이 세로로 잘라 버린다.
그 자리를 히트 테스트하면 잡히는 것: BUTTON.chipset-tile (타일 그림판 셀)  ← 메뉴가 아니다</pre>
<p>즉 메뉴를 클릭할 수도 없다. 그 안에 갇힌 기능은 이렇다 — <b>복사(선택 영역), 붙여넣기, 인스펙터, 규칙 감사(위반 13건 표시 중), 작업 기록, 붓 크기 1×1~4×4</b>. 9개다.</p>
<div class="callout">복사·붙여넣기는 <span class="kbd">Ctrl+C</span>/<span class="kbd">Ctrl+V</span>로 우회된다. 붓 크기·인스펙터·규칙 감사·작업 기록은 <b>우회로가 없다.</b> 특히 규칙 감사는 위반 개수를 빨간 배지로 알려 주면서 그 배지를 누를 수 없다.</div>`);

/* ─────────────────────────── 3. P0 포커스 ─────────────────────────── */
section("s3", 3, "P0 — 키보드로 도구를 고르면 포커스가 사라진다", "도구는 바뀐다. 그런데 다음 Tab 은 문서 맨 앞부터 시작한다.", `
<p>도구를 고르면 <code>editorState.set</code>이 구독자에게 알리고, 좌패널은 <code>clearChildren</code>으로 <b>통째로 다시 그려진다</b>(<code>src/editor/panels/tilePalette.ts:70</code>, <code>src/editor/panels/basicLeftRail.ts:105</code>). 방금 누른 버튼 노드는 버려지고 새 노드가 만들어진다. 사이드바 어디에도 포커스를 되돌려 주는 코드가 없다.</p>
<h3>실측</h3>
<pre>① 채우기 버튼에 포커스 → Space
   before: tool=paint  focus=BUTTON[tool-fill]
   after : tool=fill   focus=<b>BODY</b>          ← 도구는 바뀌었고 포커스는 사라졌다

② 지우기 버튼에 포커스 → Enter
   before: tool=fill   focus=BUTTON[tool-erase]
   after : tool=erase  focus=<b>BODY</b>

③ 영역 선택 버튼에 포커스 → ArrowRight
   before: BUTTON[tool-select]
   after : BUTTON[tool-select]                    ← 화살표로 다음 도구로 못 간다</pre>
<div class="callout bad">키보드만 쓰는 사람은 도구 두 개를 연달아 고를 수 없다. 하나 고를 때마다 문서 처음부터 <span class="kbd">Tab</span> 을 다시 밟아야 한다. 스크린리더도 새 상태(<code>aria-pressed=true</code>)를 읽어 줄 대상을 잃는다.</div>
<h3>덤 — <code>role="toolbar"</code> 는 지키지 않는 약속이다</h3>
<p>도구막대는 <code>role="toolbar"</code>를 선언한다(<code>src/editor/panels/tileToolbar.ts:64</code>). 이 역할은 “탭 스톱은 하나, 내부 이동은 화살표”라는 계약이다. 그런데 <code>tileToolbar.ts</code>·<code>tileToolbarMenus.ts</code>·<code>leftLayerSwitcher.ts</code> 어디에도 <code>keydown</code> 처리나 <code>tabindex</code> 관리가 없다. 결과: 도구막대 한 줄이 탭 스톱 12개를 먹고, 화살표는 도구가 아니라 <b>맵을 움직인다</b>(<code>src/editor/EditScene.ts:820-841</code>).</p>
<div class="callout">같은 저장소가 다른 화면(<code>src/editor/panels/aiAuthSettings.ts:410-425</code>)에서는 roving tabindex 를 제대로 구현해 뒀다. 몰라서 빠진 게 아니라 이 표면만 빠졌다.</div>
<h3>닫는 방법이 화면마다 다르다</h3>
<table>
<tr><th>표면</th><th>Escape</th><th>바깥 클릭</th><th>근거</th></tr>
<tr><td>초보 레일 플라이아웃</td><td><span class="sev ok">된다</span></td><td><span class="sev ok">된다</span></td><td><code>basicLeftRail.ts:80-99</code></td></tr>
<tr><td>도구막대 ⋯ 드롭다운</td><td><span class="sev p1">안 된다</span></td><td><span class="sev p1">안 된다</span></td><td><code>tileToolbarMenus.ts</code> 전체에 document 리스너 0건</td></tr>
</table>
<p>⋯ 를 열면 “⋯ 버튼을 다시 정확히 찾아 누르는 것”이 유일한 닫는 길이다. 그런데 그 버튼은 §2에서 봤듯 잘려 있다.</p>`);

/* ─────────────────────────── 4. 이름·아이콘·커서 ─────────────────────────── */
section("s4", 4, "P1 — 같은 도구가 화면마다 다른 이름, 다른 그림, 같은 커서", "단일 원천이라고 적어 둔 표를 정작 화면이 안 쓴다.", `
<p><code>src/editor/uiCopy.ts:44-62</code>의 <code>TOOL_LABEL</code>에는 “도구 이름 단일 원천”이라고 적혀 있다. 실제로 이 표를 쓰는 <b>눈에 보이는 화면은 커맨드 팔레트 하나뿐</b>이다. 레일·도구막대·도움말은 각자 문자열을 적는다.</p>
<table>
<tr><th>도구</th><th>단일 원천</th><th>초보 레일</th><th>도구막대</th><th>도움말</th></tr>
<tr><td>select</td><td>영역 선택</td><td>선택</td><td>영역 선택</td><td>선택 도구 / 선택(V)</td></tr>
<tr><td>event</td><td>장면 놓기</td><td>장면</td><td>장면 놓기</td><td>이벤트 도구 / 장면 놓기(N)</td></tr>
<tr><td>fill</td><td>채우기</td><td>채우기</td><td>이어진 영역 채우기</td><td>채우기</td></tr>
<tr><td>eyedropper</td><td>타일 집기</td><td>집기</td><td>타일 집기</td><td>타일 집기</td></tr>
</table>
<p>도움말은 <span class="kbd">G</span>를 “채우기”라고 가르치는데, 도구막대에는 “…채우기”로 끝나는 버튼이 <b>세 개</b>(사각형/타원/이어진 영역)이고 G는 세 번째에만 걸린다. 레일에서 “장면”이라고 배운 이름은 도움말 단축키 표에 아예 없다.</p>
<h3>아이콘도 갈라져 있다</h3>
<ul>
<li>같은 “칠하기”가 레일에서는 <code>brush</code>(붓), 도구막대에서는 <code>pen</code>(펜) — <b>완전히 다른 그림</b>이다(<code>basicLeftRail.ts:43</code> vs <code>tileToolbar.ts:35</code>).</li>
<li>레이어 버튼 3개(바닥·덧그림·이벤트)가 두 표면 모두 <b>같은 글리프</b> <code>layers</code>를 쓴다. 아이콘이 전달하는 정보는 0비트고, 구별은 옆의 글자에만 달려 있다.</li>
</ul>
${fig("standard-layer-switcher.png", "표준 모드 레이어 전환 3버튼", "레이어 버튼 3개 — 아이콘이 셋 다 똑같다. 열이 좁아져 글자가 <code>ellipsis</code>로 잘리면 구별 정보가 완전히 사라진다.")}
<h3>커서 — 8개 도구, 구별되는 커서는 6개</h3>
<p>캔버스 커서는 <code>body[data-editor-tool]</code>로 갈린다(<code>src/editor/toolCursor.ts</code>). 매핑은 <code>src/styles/editor/core.part-1.css:204-210</code>에 7줄뿐이다.</p>
<table>
<tr><th>도구</th><th>커서</th><th>문제</th></tr>
<tr><td>paint</td><td><code>crosshair</code></td><td rowspan="2"><span class="sev p1">select 와 똑같다</span> — 클릭 한 번이 “칠해짐”과 “선택만 됨”으로 갈리는데 예고 신호가 없다</td></tr>
<tr><td>select</td><td><code>crosshair</code></td></tr>
<tr><td>erase</td><td><code>default</code>(매핑 없음)</td><td><span class="sev p1">지우기는 아무 도구도 안 고른 상태와 커서가 같다</span></td></tr>
<tr><td>collision</td><td><code>not-allowed</code></td><td><span class="sev p2">정상 동작하는 도구인데 “여기선 안 됨” 관용구를 쓴다</span></td></tr>
<tr><td>fill / eyedropper / pan / event</td><td>cell / copy / grab / pointer</td><td>—</td></tr>
</table>
<div class="callout warn"><b>테스트가 이걸 못 잡는다.</b> <code>test/toolCursor.test.ts:13</code>의 검사 목록은 <code>erase</code>가 빠진 7종이고, 비교하는 값은 CSS 커서가 아니라 <code>body.dataset.editorTool</code>(=도구 이름)이다. “7종이 전부 서로 다른 값”이라는 단정은 항상 참이라서 초록불이 커서 커버리지를 보증한다고 오해된다.</div>
<h3>선택된 도구와 마우스만 올린 도구가 똑같이 보인다</h3>
<p><code>src/styles/shell/figma-editor/08-rm-palette-tools.css:81-86</code>에서 <code>:hover:not(:disabled)</code>와 <code>.active</code>가 <b>같은 블록의 같은 선언 3줄</b>을 공유한다. 도구막대를 마우스로 훑는 동안 지금 켜진 도구가 무엇인지 알 수 없다. 초보 레일은 반대로 진한 파란 배경으로 확실히 구분한다.</p>`);

/* ─────────────────────────── 5. 상태 패치 ─────────────────────────── */
section("s5", 5, "P1 — 도구를 고르는 길이 4개고, 4개가 서로 다르게 동작한다", "같은 “칠하기”인데 무엇을 정리하고 무엇을 남기는지가 다르다.", `
<p>도구를 바꾸는 코드가 네 곳에 있다. 네 곳이 같은 상태를 다르게 쓴다.</p>
<table>
<tr><th>경로</th><th>파일</th><th>activePaletteStamp 정리</th><th>selection 정리</th><th>이벤트 레이어 탈출</th><th>event 도구가 레이어도 바꿈</th></tr>
<tr><td>초보 레일 클릭</td><td><code>basicLeftRail.ts:149-161</code></td><td><span class="sev p1">안 함</span></td><td><span class="sev p1">안 함</span></td><td>함</td><td>함</td></tr>
<tr><td>도구막대 그리기 그룹</td><td><code>tileToolbarActions.ts:18-26</code></td><td>함</td><td>select 외에는 함</td><td>함</td><td>—</td></tr>
<tr><td>도구막대 맵 모드 그룹</td><td><code>tileToolbar.ts:132-135</code></td><td><span class="sev p1">안 함</span></td><td><span class="sev p1">안 함</span></td><td><span class="sev p1">안 함</span></td><td><span class="sev p1">안 함</span></td></tr>
<tr><td>단축키</td><td><code>hotkeys.ts:246-262</code></td><td><span class="sev p1">안 함</span></td><td><span class="sev p1">안 함</span></td><td>함</td><td>함</td></tr>
</table>
<p>눈에 보이는 결과:</p>
<ul>
<li><b>표준·전문가에서 「장면 놓기」를 누르면 레이어가 안 바뀐다.</b> 실측: 도구는 <code>event</code>가 되는데 레이어는 <code>lower</code>로 남고 좌패널은 계속 타일 그림판을 보여 준다. 초보 레일과 단축키 <span class="kbd">N</span>은 레이어까지 함께 바꾼다. 같은 버튼 이름, 다른 결과.</li>
<li><span class="kbd">B</span>로 칠하기를 고르면 예전 팔레트 스탬프가 그대로 무장된 채 남고, 도구막대 붓을 누르면 지워진다. 스탬프가 <code>selectedTile</code>을 이기므로(<code>TilePaintEngine.ts:90-91</code>) <b>사이드바가 보여 주는 타일과 실제로 찍히는 것이 달라진다.</b></li>
<li>그 스탬프의 유일한 표시·해제 UI는 좌패널에서 <code>display: none</code>이다(<code>08-rm-palette-tools.css:26-28</code>). 켜져 있는지 알 수도, 사이드바에서 끌 수도 없다.</li>
</ul>
<div class="grid2">
${fig("standard-tool-tool-event.png", "장면 놓기를 누른 뒤의 표준 좌패널", "「장면 놓기」를 누른 직후. 도구는 event 인데 레이어는 바닥이고 좌패널은 타일 그림판 그대로다.")}
${fig("standard-layer-event-panel.png", "이벤트 레이어로 바꾼 뒤의 좌패널", "레이어를 「이벤트」로 바꿔야 비로소 좌패널이 이벤트 목록이 된다. 사용자가 원한 건 둘 중 어느 쪽이었을까.")}
</div>
<h3>집기(스포이드)는 결과가 두 갈래인데 둘 다 무음이다</h3>
<ul>
<li>타일이 있는 칸을 집으면 도구가 <b>말없이 「칠하기」로 바뀐다</b>(<code>TilePaintEngine.ts:169-172</code>). 어떤 툴팁에도 이 자동 전환이 적혀 있지 않다.</li>
<li>빈 칸을 집으면 아무 일도 일어나지 않는다(토스트도, 커서 변화도 없음). “클릭이 씹혔다”로 읽힌다.</li>
<li>좌클릭 집기 경로는 <code>activePaletteStamp</code>를 지우지 않는데 우클릭 경로는 지운다(<code>:166-173</code> vs <code>:144-151</code>). 그래서 <b>집어 온 타일이 아니라 예전 스탬프가 칠해진다.</b></li>
</ul>
<div class="callout warn">칠하기·채우기 경로에는 <code>selectedTile</code> 범위 검사가 없다. 기본값은 360이라 타일 수가 360 이하인 커스텀 타일셋에서는 부팅 직후부터 범위 밖이다. 사이드바는 “없음”이라고 표시하면서 캔버스 클릭은 조용히 범위 밖 인덱스를 맵에 기록한다.</div>`);

/* ─────────────────────────── 6. 방어 ─────────────────────────── */
section("s6", 6, "방어 측 반론 — 이건 버그가 아니라 결정이다", "고치면 오히려 되돌아가는 것들. 근거는 코드 주석과 실측 노트에 남아 있다.", `
<p>적대적 리뷰의 절반은 “이미 고쳐 둔 것을 다시 망가뜨리지 않기”다. 아래는 주석·스펙·감사 노트에 <b>왜</b>가 적혀 있는 항목이다.</p>
<table>
<tr><th>겉보기 문제</th><th>실제로는</th><th>근거</th></tr>
<tr><td>레일 이름이 짧다(선택·집기)</td><td>레일 폭이 72px다. 긴 이름은 안 들어가고, 초보 모드는 이름을 hover 가 아니라 <b>항상</b> 보여 준다</td><td><code>basicLeftRail.ts:38-39</code></td></tr>
<tr><td>초보에 도구가 6개뿐이다</td><td>예전 좌측 도구 열이 텍스트 버튼 6개로 ~300px를 먹었다. 아이콘 레일로 캔버스 폭 +370px를 되찾은 결과다</td><td>스펙 <code>2026-07-10-basic-mode-ai-ux-design.md:13,47</code></td></tr>
<tr><td>상위 레이어를 “장식”이라 안 부른다</td><td>“장식”은 이미 <b>타일 분류</b> 이름이다(팔레트 필터 칩). 같은 화면에서 두 뜻이 겹치면 안 된다 → “덧그림”</td><td><code>uiCopy.ts:23-25</code>, 잠금 <code>test/uiCopy.test.ts:40</code></td></tr>
<tr><td>레이어 전환이 상단 메뉴에 없다</td><td>레이어는 도구 다음으로 잦은 조작이다. 매번 상단 메뉴를 열게 하는 건 빈도와 거리가 뒤집힌 배치라 사이드바로 옮겼다</td><td><code>leftLayerSwitcher.ts:4-9</code>, 잠금 <code>test/editorMenuSidebarIa.test.ts:133-164</code></td></tr>
<tr><td>플라이아웃 상태가 모듈 전역이다</td><td>팔레트는 붓질마다 다시 그려진다. 상태를 DOM 에 맡기면 매 렌더마다 닫힌다 — 이건 버그 수정이다</td><td><code>basicLeftRail.ts:7,68</code>, <code>tilePalette.ts:56</code></td></tr>
<tr><td>도형 채우기 이름이 바뀌었다</td><td>기능은 그대로 두고 이름만 바꿨다. 쓸 수 있는 기능을 지우는 건 상표 회피 수단이 아니라는 판단</td><td><code>tileToolbar.ts:27-30</code></td></tr>
</table>
<div class="callout good">이 동작을 붙잡고 있는 유닛 테스트는 11개 파일 78개다(방어 측이 1회 실행해 전부 통과 확인). “라벨을 하나로 통일”, “레이어를 상단 메뉴로 복귀”, “모듈 전역 상태 제거”는 <b>즉시 빨간불</b>이 된다.</div>
<h3>다만 방어 측도 방어하지 않은 것</h3>
<ul>
<li>초보 레일에서 <b>화면 밀기·통행 표시를 뺀 근거</b>는 감사 노트의 “rare” 한 단어가 전부다. 측정치가 없다.</li>
<li>레일 클릭이 <code>selectTileTool()</code>을 <b>우회하는 이유</b>는 어디에도 적혀 있지 않다(§5의 상태 패치 갈라짐).</li>
<li>레일 폭이 주석에는 48px, 코드에는 72px로 <b>서로 다르게</b> 적혀 있다.</li>
<li>⋯ 메뉴의 닫기 규칙이 플라이아웃과 다른 것은 트레이드오프가 아니라 결함이라고 방어 측이 직접 인정했다.</li>
</ul>`);

/* ─────────────────────────── 7. 반증 ─────────────────────────── */
section("s7", 7, "리뷰가 틀렸던 것 — 실측으로 반증된 주장", "적대적 리뷰는 과장도 잡아야 리뷰다.", `
<table>
<tr><th>제기된 주장</th><th>판정</th><th>실측 결과</th></tr>
<tr><td><b>P0</b>: Space 기본 동작이 전역에서 취소되어 사이드바 버튼을 Space 로 누를 수 없다</td><td><span class="sev ok">반증</span></td><td>채우기 버튼에 포커스를 두고 Space → <code>tool</code>이 <code>paint</code>→<code>fill</code>로 <b>바뀌었다</b>. 카메라 팬의 <code>preventDefault</code>는 버튼 활성화를 막지 않는다</td></tr>
<tr><td>「화면 밀기」를 고르면 좌패널이 사라진다</td><td><span class="sev ok">반증</span></td><td>4개 도구 전환 후 <code>.left-panel</code>은 계속 300×851로 살아 있었다. 캡처가 실패한 원인은 다른 작업이 편집 중이던 파일 때문에 개발 서버 HMR 이 깨진 것</td></tr>
<tr><td>아이콘 전용 버튼에 접근성 이름이 없다</td><td><span class="sev ok">대부분 반증</span></td><td>도구막대·레일·레이어 버튼 전부 <code>aria-label</code>과 <code>aria-pressed</code>를 갖고 있고 SVG 는 <code>aria-hidden</code>으로 감춰진다. 이름이 없는 건 플라이아웃 핀 버튼 하나(이름이 “📌” 이모지)</td></tr>
<tr><td>비활성 버튼에 <code>aria-disabled</code>가 빠졌다</td><td><span class="sev ok">반증</span></td><td>되돌리기는 설정하고, 레일 타일 토글은 네이티브 <code>disabled</code>만 쓰는데 접근성상 동등하다. 남는 문제는 “왜 비활성인지”가 <code>title</code>에만 있어 키보드로 못 읽는 것</td></tr>
<tr><td>AI 브리핑이 도구 이름을 따로 적는다</td><td><span class="sev ok">반증</span></td><td><code>aiAgentBrief.ts:48</code>은 단일 원천에 위임한다. 문제는 이름이 틀린 게 아니라 그 값이 <b>화면에 렌더되지 않는</b> 것</td></tr>
<tr><td>커맨드 팔레트가 자체 문자열을 쓴다</td><td><span class="sev ok">반증</span></td><td><code>commandRegistry.ts:77</code>이 <code>toolLabel()</code>을 쓴다. 구 용어를 keywords 에 남긴 것도 의도된 설계</td></tr>
</table>
<div class="callout">리뷰 과정에서 하나 배운 것: 개발 서버 하나를 여러 작업이 공유하면 HMR 이 깨져 <b>없는 버그가 보인다.</b> 이번엔 격리된 서버를 따로 띄워서 재측정한 뒤에야 진짜와 가짜가 갈렸다.</div>`);

/* ─────────────────────────── 8. 순서 ─────────────────────────── */
section("s8", 8, "무엇부터 고칠까", "값싸고 효과 큰 것부터. 각 항목은 위 절의 근거에 붙어 있다.", `
<table>
<tr><th>#</th><th>고칠 것</th><th>왜 먼저</th><th>손댈 곳</th></tr>
<tr><td>1</td><td><b>⋯ 버튼을 스크롤 영역 밖으로 빼서 오른쪽에 고정하고, 드롭다운을 도구막대 밖으로 옮긴다</b></td><td>9개 기능이 지금 도달 불가다. 넘침 대비 장치가 넘침에 휩쓸린 상태</td><td><code>tileToolbar.ts:102-104</code>, <code>08-rm-palette-tools.css</code></td></tr>
<tr><td>2</td><td><b>도구 선택 후 포커스를 새 버튼으로 되돌린다</b></td><td>키보드로는 도구를 연달아 고를 수 없다. 재렌더 자체를 고치지 않고 포커스 키 복원만으로도 막을 수 있다</td><td><code>tilePalette.ts:70</code>, <code>basicLeftRail.ts:105</code></td></tr>
<tr><td>3</td><td><b>맵 모드 그룹도 <code>selectTileTool</code> 계열을 쓰게 한다</b> — 특히 「장면 놓기」가 레이어까지 바꾸도록</td><td>같은 이름의 버튼이 경로에 따라 다르게 동작한다. 3줄짜리 수정</td><td><code>tileToolbar.ts:132-135</code></td></tr>
<tr><td>4</td><td><b>⋯ 드롭다운에 Escape·바깥 클릭을 붙인다</b></td><td>같은 앱에 닫는 규칙이 두 개 있다. 레일 쪽 구현을 그대로 재사용</td><td><code>tileToolbarMenus.ts</code>, 참고 <code>basicLeftRail.ts:80-99</code></td></tr>
<tr><td>5</td><td><b><code>erase</code> 커서 추가 + <code>select</code> 커서를 paint 와 다르게</b></td><td>CSS 두 줄. 클릭 결과를 미리 알려 주는 유일한 신호</td><td><code>core.part-1.css:204-210</code></td></tr>
<tr><td>6</td><td><b>도구막대 <code>.active</code>를 hover 와 다르게 스타일링</b></td><td>지금 켜진 도구를 눈으로 확인할 방법이 없다. CSS 한 블록 분리</td><td><code>08-rm-palette-tools.css:81-86</code></td></tr>
<tr><td>7</td><td><b>도구막대 툴팁에 단축키를 넣는다</b></td><td>키는 전부 바인딩돼 있는데 표준·전문가 사용자는 도움말 모달 없이 알 방법이 없다</td><td><code>tileToolbar.ts:82,139</code></td></tr>
<tr><td>8</td><td><b>「칠하기」 아이콘을 한쪽으로 통일(<code>pen</code> 또는 <code>brush</code>)</b></td><td>모드를 바꾸면 같은 도구 그림이 바뀐다. 라벨은 폭 때문에 다르게 두더라도 그림은 같아야 한다</td><td><code>basicLeftRail.ts:43</code> 또는 <code>tileToolbar.ts:35</code></td></tr>
<tr><td>9</td><td><b>커서 테스트를 CSS 값 기준으로 바꾸고 <code>erase</code>를 목록에 넣는다</b></td><td>지금 테스트는 항상 통과하는 구조라 5번을 다시 잃어도 못 잡는다</td><td><code>test/toolCursor.test.ts:13,36</code></td></tr>
<tr><td>10</td><td><b>초보 모드에 붓 크기·도형 채우기 경로를 하나 만든다</b></td><td>지금은 <b>어떤 방법으로도</b> 못 쓴다. 레일에 얹으면 세로 공간 계약이 깨지므로 플라이아웃 쪽이 맞다</td><td><code>basicLeftRail.ts</code> 패널 토글</td></tr>
</table>
<div class="callout good">1·3·5·6은 각각 수십 줄 이하다. 이 넷만으로도 “도달 불가한 기능 9개”와 “지금 켜진 도구를 모른다”가 함께 사라진다.</div>`);

/* ─────────────────────────── 9. 증거 ─────────────────────────── */
section("s9", 9, "증거와 재현 방법", "숫자는 모두 브라우저에서 나왔다. 다시 돌려 볼 수 있다.", `
<h3>이 보고서가 쓴 실측</h3>
<ul>
<li>화면 캡처 63장(그중 IMGCOUNT장을 이 문서에 내장) — 3개 UI 모드 × 도구별 활성 상태, 플라이아웃, ⋯ 메뉴, 레이어 전환. 스크립트: <code>scripts/capture-left-sidebar-tools.mts</code></li>
<li>도구막대 넘침 측정(버튼 12개 좌표) — <code>scripts/probe-toolbar-clipping.mts</code> → <code>output/evidence/left-sidebar-review/toolbar-clipping-measure.md</code></li>
<li>⋯ 드롭다운 클리핑·히트테스트 — <code>scripts/probe-overflow-dropdown-clip.mts</code></li>
<li>키보드 활성화·포커스 추적 — <code>scripts/probe-sidebar-keyboard.mts</code></li>
<li>도구막대 가로 스크롤 전/후 비교 — <code>scripts/capture-overflow-after-scroll.mts</code></li>
</ul>
<h3>리뷰 원문(팀별)</h3>
<ul>
<li><code>output/evidence/left-sidebar-review/red-b-discoverability.md</code> — 이름·아이콘·커서·피드백 26건</li>
<li><code>output/evidence/left-sidebar-review/red-c-a11y.md</code> — 접근성·키보드 14건</li>
<li><code>output/evidence/left-sidebar-review/blue-defense.md</code> — 의도된 트레이드오프 18건 + 회귀 위험 5건</li>
<li><code>output/evidence/left-sidebar-review/INVENTORY.md</code> — 코드에서 뽑은 도구 인벤토리</li>
</ul>
<h3>재현</h3>
<pre># 격리된 개발 서버(공유 서버는 HMR 이 깨져 가짜 결함을 만든다)
npx vite --configLoader runner --host 127.0.0.1 --port 9977 --strictPort

RPG_ZZU_URL=http://127.0.0.1:9977 npx tsx scripts/capture-left-sidebar-tools.mts beginner
RPG_ZZU_URL=http://127.0.0.1:9977 npx tsx scripts/probe-toolbar-clipping.mts
RPG_ZZU_URL=http://127.0.0.1:9977 npx tsx scripts/probe-sidebar-keyboard.mts</pre>
<div class="callout"><b>이 리뷰는 코드를 고치지 않았다.</b> 소스는 한 줄도 건드리지 않고 읽기와 측정만 했다. 위 §8의 순서는 제안이고, 착수 여부는 감독 판단이다.</div>`);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>OPRN · 좌측 사이드바 도구 적대적 리뷰</title>
<style>${CSS}</style></head><body>
<div class="top"><div class="top-in">
<div class="brand"><div class="logo">✦</div><div><h1>좌측 사이드바 도구 — 적대적 리뷰</h1><p>선택 · 칠하기 · 지우기 · 채우기 · 장면 · 집기 · 화면 밀기 · 통행 표시 · 2026-08-27</p></div></div>
<nav class="nav"><a href="#s1">1 구성</a><a href="#s2">2 P0 ⋯메뉴</a><a href="#s3">3 P0 포커스</a><a href="#s4">4 이름·커서</a><a href="#s5">5 상태</a><a href="#s6">6 방어</a><a href="#s7">7 반증</a><a href="#s8">8 순서</a><a href="#s9">9 증거</a></nav>
</div></div>
<div class="wrap">
<div class="hero">
<div class="hero-card">
<div class="kicker">4개 팀 · 코드 근거 · 브라우저 실측</div>
<div class="h-title">도구는 잘 만들었다. 도달할 수 없는 게 문제다.</div>
<p class="h-sub">좌측 사이드바 도구 8종을 공격팀 3개와 방어팀 1개로 갈라 리뷰했다. 가장 큰 결함은 도구 자체가 아니라 <b style="color:#fff">좁은 좌패널에서 도구막대가 잘려 나가고, 그걸 구하러 만든 ⋯ 메뉴가 같이 잘려 나가는 것</b>이다. 그 안에 갇힌 기능이 9개다. 두 번째는 키보드로 도구를 고르면 포커스가 사라지는 것. 반대로 “모드마다 도구 수가 다르다” 같은 지적은 대부분 이미 근거가 기록된 결정이었고, 제기된 P0 주장 하나는 실측으로 반증했다.</p>
<div class="metrics">
<div class="metric"><div class="n" style="color:#ff97a6">2</div><div class="l">확인된 P0</div></div>
<div class="metric"><div class="n" style="color:#ffd08a">9</div><div class="l">도달 불가 기능</div></div>
<div class="metric"><div class="n" style="color:#8af0bf">6</div><div class="l">반증한 주장</div></div>
<div class="metric"><div class="n">IMGCOUNT</div><div class="l">내장 실화면</div></div>
</div>
<div class="chips"><span class="chip"><b>공격</b> 상태머신 · 발견성 · 접근성</span><span class="chip"><b>방어</b> 의도된 트레이드오프 18건</span><span class="chip"><b>소스 수정</b> 0줄</span></div>
</div>
<div class="toc"><h3>차례 — 쉬운 말로</h3>
<a href="#s1"><span class="num">1</span><div><b>먼저, 뭐가 있나</b><br>모드 3개 · 도구 8종 실화면</div></a>
<a href="#s2"><span class="num">2</span><div><b>P0 ⋯ 메뉴가 안 보인다</b><br>복사·붓 크기·기록 9개 갇힘</div></a>
<a href="#s3"><span class="num">3</span><div><b>P0 포커스가 사라진다</b><br>키보드로 도구를 못 고른다</div></a>
<a href="#s4"><span class="num">4</span><div><b>이름·그림·커서가 갈라졌다</b><br>지우기는 커서가 없다</div></a>
<a href="#s5"><span class="num">5</span><div><b>도구 고르는 길이 4개</b><br>네 곳이 다르게 동작한다</div></a>
<a href="#s6"><span class="num">6</span><div><b>방어 측 반론</b><br>고치면 되돌아가는 것들</div></a>
<a href="#s7"><span class="num">7</span><div><b>리뷰가 틀린 것</b><br>실측으로 반증 6건</div></a>
<a href="#s8"><span class="num">8</span><div><b>무엇부터 고칠까</b><br>10개, 싼 것부터</div></a>
<a href="#s9"><span class="num">9</span><div><b>증거와 재현</b><br>스크립트 5개</div></a>
</div>
</div>
${sections.join("\n")}
<footer>OPRN · 좌측 사이드바 도구 적대적 리뷰 · 2026-08-27<br/>
실화면 ${"IMGCOUNT"}장 base64 내장 · 측정은 127.0.0.1:9977 격리 개발 서버 · 소스 수정 없음</footer>
</div></body></html>`;

const final = html.replaceAll("IMGCOUNT", String(embedded));
writeFileSync(OUT, final);
console.log("wrote", OUT);
console.log("images", embedded, "bytes", (embeddedBytes / 1024 / 1024).toFixed(2), "MB");
console.log("html", (Buffer.byteLength(final) / 1024 / 1024).toFixed(2), "MB");
