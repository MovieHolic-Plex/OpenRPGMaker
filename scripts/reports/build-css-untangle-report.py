#!/usr/bin/env python3
"""CSS 얽힘 해소 작업 보고서 — 이미지를 base64 로 박은 단일 HTML 을 만든다.

사용:
    python3 scripts/reports/build-css-untangle-report.py <출력.html> [에셋디렉터리]

에셋 디렉터리에는 `.playwright-mcp/sweep.mjs` · `shoot-detail.mjs` 로 찍어
JPEG 로 리사이즈한 그림들이 있어야 한다. 파일명은 아래 img() 호출을 보라.
없는 그림은 자리표시자로 대체되고 빌드는 계속된다.
"""
import base64, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "report.html"
ASSETS = sys.argv[2] if len(sys.argv) > 2 else os.environ.get(
    "CSS_REPORT_ASSETS", "/home/main/css-report-assets/web"
)


def img(name, alt="", cls=""):
    p = os.path.join(ASSETS, name)
    if not os.path.exists(p):
        return f'<p class="missing">이미지 없음: {name}</p>'
    b = base64.b64encode(open(p, "rb").read()).decode()
    c = f' class="{cls}"' if cls else ""
    return f'<img{c} loading="lazy" alt="{alt}" src="data:image/jpeg;base64,{b}">'


def fig(name, cap, cls=""):
    return f'<figure{" class=" + chr(34) + cls + chr(34) if cls else ""}>{img(name, cap)}<figcaption>{cap}</figcaption></figure>'


def ba(before, after, cap_b, cap_a, note=""):
    """before/after 2단 비교."""
    n = f'<p class="ba-note">{note}</p>' if note else ""
    return f"""<div class="ba">
  <figure><span class="tag tag-b">전</span>{img(before, cap_b)}<figcaption>{cap_b}</figcaption></figure>
  <figure><span class="tag tag-a">후</span>{img(after, cap_a)}<figcaption>{cap_a}</figcaption></figure>
</div>{n}"""


CSS = """
:root{
  --bg:#F7F8F8; --surface:#FFFFFF; --inset:#EEF1F4;
  --text-1:#0F172A; --text-2:#475569; --text-3:#626E89;
  --accent:#4A57D6; --accent-muted:rgba(74,87,214,.10); --accent-border:rgba(74,87,214,.45);
  --line:rgba(15,23,42,.08); --line-2:rgba(15,23,42,.14);
  --ok:#18764F; --ok-bg:rgba(24,118,79,.10);
  --bad:#C6403D; --bad-bg:rgba(198,64,61,.10);
  --warn:#8A5E00; --warn-bg:rgba(138,94,0,.10);
  --mono:"Cascadia Mono","JetBrains Mono","SFMono-Regular",Consolas,monospace;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0; background:var(--bg); color:var(--text-1);
  font:15px/1.7 system-ui,"Pretendard","Apple SD Gothic Neo","Malgun Gothic",-apple-system,"Segoe UI",sans-serif;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:1180px;margin:0 auto;padding:0 28px 120px}

/* ── 헤더 ───────────────────────────────── */
header.top{
  background:linear-gradient(160deg,#101a3d 0%,#1d2557 42%,#2f3aae 100%);
  color:#fff; padding:64px 0 52px; margin-bottom:56px;
  border-bottom:1px solid var(--line);
}
header.top .wrap{padding-bottom:0}
.eyebrow{
  font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase;
  color:#aeb8ff; margin:0 0 14px;
}
header.top h1{
  margin:0 0 18px; font-size:40px; line-height:1.2; font-weight:800; letter-spacing:-.02em;
}
header.top .lede{margin:0;max-width:74ch;font-size:17px;line-height:1.65;color:#dfe3ff}
.meta{
  display:flex; flex-wrap:wrap; gap:8px 10px; margin-top:26px;
  font:12px/1 var(--mono); color:#c3caff;
}
.meta span{
  background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.18);
  padding:7px 11px; border-radius:999px;
}

/* ── 섹션 ───────────────────────────────── */
section{margin:0 0 72px; scroll-margin-top:24px}
h2{
  font-size:13px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
  color:var(--accent); margin:0 0 6px;
}
h2+.h2sub{margin:0 0 28px;font-size:27px;font-weight:700;letter-spacing:-.015em;line-height:1.3}
h3{font-size:19px;font-weight:700;margin:40px 0 12px;letter-spacing:-.01em}
h4{font-size:15px;font-weight:700;margin:26px 0 8px}
p{margin:0 0 14px;color:var(--text-2);max-width:82ch}
p.lead{color:var(--text-1);font-size:16px}
strong{color:var(--text-1);font-weight:700}
a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-border)}
code{
  font:.88em/1.5 var(--mono); background:var(--inset);
  padding:.14em .42em; border-radius:4px; color:var(--text-1);
  overflow-wrap:anywhere;
}
hr{border:0;border-top:1px solid var(--line);margin:44px 0}

/* ── 지표 카드 ──────────────────────────── */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px;margin:0 0 34px}
.stat{
  background:var(--surface); border:1px solid var(--line); border-radius:12px;
  padding:16px 18px; box-shadow:0 1px 3px rgba(15,23,42,.05);
}
.stat .k{font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--text-3);text-transform:uppercase}
.stat .v{font-size:27px;font-weight:800;letter-spacing:-.025em;margin:6px 0 2px;font-variant-numeric:tabular-nums}
.stat .s{font-size:12px;color:var(--text-3);line-height:1.45}
.stat.ok .v{color:var(--ok)}
.stat.accent .v{color:var(--accent)}
.stat.bad .v{color:var(--bad)}

/* ── 콜아웃 ─────────────────────────────── */
.note{
  border-left:3px solid var(--accent); background:var(--accent-muted);
  padding:16px 20px; border-radius:0 10px 10px 0; margin:24px 0;
}
.note.good{border-color:var(--ok);background:var(--ok-bg)}
.note.bad{border-color:var(--bad);background:var(--bad-bg)}
.note.warn{border-color:var(--warn);background:var(--warn-bg)}
.note p:last-child{margin-bottom:0}
.note .label{
  display:block;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  margin-bottom:7px;color:var(--accent);
}
.note.good .label{color:var(--ok)} .note.bad .label{color:var(--bad)} .note.warn .label{color:var(--warn)}

/* ── 표 ─────────────────────────────────── */
table{
  width:100%;border-collapse:separate;border-spacing:0;margin:20px 0;
  background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;
  font-size:13.5px;
}
th,td{padding:10px 14px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{
  background:var(--inset);font-size:11px;font-weight:800;letter-spacing:.07em;
  text-transform:uppercase;color:var(--text-2);white-space:nowrap;
}
tbody tr:last-child td{border-bottom:0}
td.num{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
td.mono,th.mono{font-family:var(--mono);font-size:12px}
.pill{
  display:inline-block;padding:2px 9px;border-radius:999px;
  font:700 11px/1.7 system-ui;white-space:nowrap;
}
.pill.ok{background:var(--ok-bg);color:var(--ok)}
.pill.bad{background:var(--bad-bg);color:var(--bad)}
.pill.warn{background:var(--warn-bg);color:var(--warn)}
.pill.mute{background:var(--inset);color:var(--text-3)}

/* ── 코드 블록 ──────────────────────────── */
pre{
  background:#121a2e;color:#dbe3f5;border-radius:12px;padding:18px 20px;
  overflow-x:auto;font:12.5px/1.65 var(--mono);margin:18px 0;
  border:1px solid rgba(15,23,42,.35);
}
pre code{background:none;padding:0;color:inherit;font-size:inherit}
pre .c{color:#7f8db3}       /* 주석 */
pre .g{color:#6ee7a8}       /* 좋음 */
pre .r{color:#ff9a94}       /* 나쁨 */
pre .y{color:#ffd479}       /* 강조 */
pre .b{color:#9bb4ff}       /* 선택자 */

/* ── 그림 ───────────────────────────────── */
figure{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:12px;
       overflow:hidden;position:relative;box-shadow:0 1px 3px rgba(15,23,42,.05)}
figure img{display:block;width:100%;height:auto}
figcaption{padding:10px 14px;font-size:12.5px;color:var(--text-3);border-top:1px solid var(--line);
           background:var(--surface);line-height:1.5}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:22px 0}
.ba.narrow{grid-template-columns:repeat(2,minmax(0,260px));justify-content:start}
.ba.tall{grid-template-columns:repeat(2,minmax(0,300px));justify-content:start}
.ba-note{font-size:13px;color:var(--text-3);margin:-8px 0 0}
.stack{display:grid;gap:14px;margin:22px 0}
.tag{
  position:absolute;top:10px;right:10px;z-index:2;
  font:800 10px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;
  padding:5px 9px;border-radius:5px;color:#fff;
  box-shadow:0 1px 4px rgba(15,23,42,.25);
}
.tag-b{background:rgba(198,64,61,.92)}
.tag-a{background:rgba(24,118,79,.92)}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin:22px 0}
.missing{color:var(--bad);font:12px var(--mono)}

/* ── 목록 ───────────────────────────────── */
ul,ol{margin:0 0 16px;padding-left:22px;color:var(--text-2);max-width:82ch}
li{margin:0 0 7px}
li>strong{color:var(--text-1)}
ul.clean{list-style:none;padding-left:0}
ul.clean li{padding-left:24px;position:relative}
ul.clean li::before{position:absolute;left:0;top:0;font-weight:800}
ul.clean li.y::before{content:"✓";color:var(--ok)}
ul.clean li.n::before{content:"✕";color:var(--bad)}
ul.clean li.q::before{content:"—";color:var(--text-3)}

/* ── 목차 ───────────────────────────────── */
nav.toc{
  background:var(--surface);border:1px solid var(--line);border-radius:12px;
  padding:18px 22px;margin:0 0 56px;
}
nav.toc ol{margin:0;padding-left:20px;columns:2;column-gap:36px;font-size:13.5px}
nav.toc li{margin:0 0 6px;break-inside:avoid}
nav.toc a{border:0;color:var(--text-2)}
nav.toc a:hover{color:var(--accent)}

footer{border-top:1px solid var(--line);padding-top:24px;color:var(--text-3);font-size:12.5px}

@media (max-width:820px){
  .wrap{padding:0 18px 80px}
  header.top h1{font-size:30px}
  .ba,.ba.narrow,.ba.tall{grid-template-columns:1fr}
  nav.toc ol{columns:1}
}
"""

HTML = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CSS 얽힘 해소 — 적대적 리뷰부터 회귀 두 건까지 (2026-09-17)</title>
<style>{CSS}</style>
</head>
<body>

<header class="top">
  <div class="wrap">
    <p class="eyebrow">OPRN Studio · 스타일시트 감사 보고서</p>
    <h1>CSS 얽힘 해소</h1>
    <p class="lede">
      적대적 리뷰 5축으로 시작해 승자 래칫 게이트를 만들고, 유령 디렉터리를 해체하고,
      죽은 규칙 1,241줄을 지웠다. 그 과정에서 <strong>실제 결함 3건을 고쳤고</strong>,
      <strong>내가 낸 회귀 2건을 만들었다가 잡았다</strong>. 이 보고서의 절반은 후자에 대한 것이다 —
      여섯 게이트가 전부 초록인 채로 화면이 깨졌기 때문이다.
    </p>
    <p class="meta">
      <span>2026-09-17</span>
      <span>branch css-adversarial-review-plan</span>
      <span>커밋 20</span>
      <span>기준점 9e5c890c9</span>
      <span>HEAD 081cd5e37</span>
    </p>
  </div>
</header>

<div class="wrap">

<nav class="toc">
  <ol>
    <li><a href="#s1">한눈에</a></li>
    <li><a href="#s2">무엇이 꼬여 있었나</a></li>
    <li><a href="#s3">승자 래칫 게이트</a></li>
    <li><a href="#s4">고친 결함 — 개요 탭 카드</a></li>
    <li><a href="#s5">내가 낸 회귀 ① — 문서 순서</a></li>
    <li><a href="#s6">내가 낸 회귀 ② — :not() 특정도</a></li>
    <li><a href="#s7">픽셀로 증명하기</a></li>
    <li><a href="#s8">지운 것 · 옮긴 것</a></li>
    <li><a href="#s9">기각한 계획 전제</a></li>
    <li><a href="#s10">남긴 것과 이유</a></li>
    <li><a href="#s11">재현 방법</a></li>
  </ol>
</nav>

<!-- ══════════════════════════════════════ -->
<section id="s1">
  <h2>Summary</h2>
  <p class="h2sub">한눈에</p>

  <div class="stats">
    <div class="stat ok"><div class="k">CSS 게이트</div><div class="v">6 / 6</div>
      <div class="s">budget · graph · live · surfaces · winners · dead</div></div>
    <div class="stat accent"><div class="k">삭제한 CSS</div><div class="v">−1,012</div>
      <div class="s">줄 (743 추가 / 1,755 삭제)</div></div>
    <div class="stat accent"><div class="k">토큰 치환</div><div class="v">221</div>
      <div class="s">리터럴 → var(), 135건은 죽은 폴백</div></div>
    <div class="stat ok"><div class="k">고친 결함</div><div class="v">3</div>
      <div class="s">브라우저 실측으로 확인</div></div>
    <div class="stat bad"><div class="k">내가 낸 회귀</div><div class="v">2</div>
      <div class="s">둘 다 게이트 초록인 채로 발생</div></div>
    <div class="stat"><div class="k">유령 디렉터리</div><div class="v">해체</div>
      <div class="s">editor/ 26파일 → map/ · shell/dialogs/</div></div>
  </div>

  <table>
    <thead><tr><th>지표</th><th class="num">작업 전</th><th class="num">작업 후</th><th class="num">증감</th><th>뜻</th></tr></thead>
    <tbody>
      <tr><td class="mono">hexLiterals</td><td class="num">1,588</td><td class="num">1,340</td>
          <td class="num"><span class="pill ok">−248</span></td><td>하드코딩 hex 리터럴</td></tr>
      <tr><td class="mono">important</td><td class="num">714</td><td class="num">673</td>
          <td class="num"><span class="pill ok">−41</span></td><td><code>!important</code> 선언</td></tr>
      <tr><td class="mono">undefinedVars</td><td class="num">58</td><td class="num">37</td>
          <td class="num"><span class="pill ok">−21</span></td><td>정의 없는 커스텀 프로퍼티</td></tr>
      <tr><td class="mono">cssFileCount</td><td class="num">281</td><td class="num">288</td>
          <td class="num"><span class="pill mute">+7</span></td><td>분할·신규 시트 포함</td></tr>
      <tr><td class="mono">globalRootFiles</td><td class="num">9</td><td class="num">10</td>
          <td class="num"><span class="pill mute">+1</span></td><td>다크 런타임 토큰 시트 신설</td></tr>
    </tbody>
  </table>

  <div class="ba">
    <figure>{img("sweep-editor-after.jpg","맵 에디터 최종 상태")}<figcaption>맵 에디터 — 작업 후</figcaption></figure>
    <figure>{img("sweep-db-overview-after.jpg","데이터베이스 개요 탭 최종 상태")}<figcaption>데이터베이스 · 개요 탭 — 작업 후</figcaption></figure>
  </div>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s2">
  <h2>Diagnosis</h2>
  <p class="h2sub">무엇이 꼬여 있었나</p>

  <p class="lead">
    서브에이전트 5개로 적대적 리뷰를 돌렸다. 다섯 축이 각자 다른 이야기를 했지만
    뿌리는 하나였다 — <strong>레이어 순서가 의미에서 도출된 게 아니라, 이미 존재하던 승자 관계에
    사후적으로 끼워 맞춘 근사치</strong>라는 것.
  </p>

  <table>
    <thead><tr><th>축</th><th>주장</th><th>실측 결과</th></tr></thead>
    <tbody>
      <tr><td><strong>A</strong> 레이어</td><td>선형 10단 순서가 승자를 정한다</td>
          <td><span class="pill bad">거짓</span> 맞지 않는 곳은 규칙을 다른 파일로 <em>옮겨서</em> 때웠다 —
              그 영수증이 <code>from-*.css</code> 39개 · 5,870줄 · <code>[레이어 보존]</code> 마커 135개</td></tr>
      <tr><td><strong>B</strong> 서브레이어</td><td><code>layer(X)</code> 로 들여온 시트가 내부에서 또 <code>@layer X</code></td>
          <td><span class="pill warn">10장</span> 실효 경로가 <code>X.X</code> 가 되어 부모 직속보다 약해진다</td></tr>
      <tr><td><strong>C</strong> 중복</td><td>같은 클래스를 여러 시트가 다툰다</td>
          <td><span class="pill warn">확인</span> map ↔ database 사이에서 규칙이 <strong>양방향</strong>으로 오간다</td></tr>
      <tr><td><strong>D</strong> 무성 실패</td><td>게이트가 못 잡는 조용한 시나리오 4종</td>
          <td><span class="pill ok">3종 차단</span> 승자 게이트로 막았고, 나머지 1종은 이미 닫혀 있었다</td></tr>
      <tr><td><strong>E</strong> 죽은 코드</td><td>삭제 여력 50,212줄</td>
          <td><span class="pill bad">허위</span> 허브·사각지대가 허위 초록이었다. 실제 판정 통과는 0</td></tr>
    </tbody>
  </table>

  <div class="note">
    <span class="label">근본 원인</span>
    <p><strong>두 표면 사이에 단일한 우선순위 관계가 없다.</strong> map 은 어떤 규칙에서 database 를 이기고
    어떤 규칙에서는 진다. 선형 10단으로 표현할 수 없는 관계를 선형 10단으로 표현하려니
    <code>from-*.css</code> 5,870줄이 나왔다. 이건 청소로 해결되는 문제가 아니라 설계 과제다
    (역할 기반 레이어 / 중첩 레이어 — 별도 스펙으로 남겼다).</p>
  </div>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s3">
  <h2>Instrument</h2>
  <p class="h2sub">승자 래칫 게이트를 만들었다</p>

  <p class="lead">
    기존 게이트는 전부 <em>무엇이 존재하는가</em>를 셌다. 파일 수, <code>!important</code> 수,
    hex 리터럴 수. 아무도 <strong>어느 선언이 이기는가</strong>를 묻지 않았다.
    <code>scripts/check-css-winners.mjs</code> 가 그걸 묻는다.
  </p>

  <pre><code><span class="c">// (선택자, 속성, @조건) 마다 승자를 스펙 순서대로 계산한다</span>
function beats(a, b) {{
  if (a.imp !== b.imp) return a.imp;                       <span class="c">// ① !important</span>
  const cmp = compareVectors(a.layerVec, b.layerVec);      <span class="c">// ② 레이어 벡터</span>
  if (cmp !== 0) return cmp &gt; 0;
  if (a.spec !== b.spec) return a.spec &gt; b.spec;           <span class="c">// ③ 특정도</span>
  return a.seq &gt; b.seq;                                    <span class="c">// ④ 문서 순서</span>
}}</code></pre>

  <h4>설계 결정 세 가지</h4>
  <ul>
    <li><strong>레이어 순서를 읽는다.</strong> <code>@layer a, b, c;</code> 선언문에서 읽으므로
        <code>index.css:3</code> 을 뒤집으면 게이트가 즉시 안다. 하드코딩했다면 못 잡는다.</li>
    <li><strong>실효 레이어 «경로»를 계산한다.</strong> <code>runtime</code> 과 <code>runtime.runtime</code> 을 구분하므로
        서브레이어 함정(B축)이 자동으로 탐지된다.</li>
    <li><strong>줄 번호는 래칫 값에서 뺐다.</strong> 넣었더니 <code>states.css</code> 맨 위에 주석 한 줄 넣는 것만으로
        「승자 121건 변경」이 떴다. 전부 줄 밀림, 픽셀 변화 0. 보고할 때만 현재 줄을 쓴다.</li>
  </ul>

  <div class="note good">
    <span class="label">기준선 압축</span>
    <p>78,668키의 기준선이 처음엔 <strong>10.9 MB</strong> 였다(기존 최대 기준선은 0.72 MB).
    파일·레이어·값 색인 테이블 + sha1 앞 12자리 키 해시로 <strong>2.86 MB</strong> 로 줄였다 —
    값은 78,668건인데 <strong>고유값이 6,223개</strong>뿐이었다. 경쟁이 성립하는 545키(1%)만 평문으로 남긴다.</p>
  </div>

  <h4>게이트 6개 전부 집행 경로에</h4>
  <pre><code>$ node scripts/verify-gates.mjs --only css
<span class="g">css   exit=0  budget=0  graph=0  live=0  surfaces=0  winners=0  dead=0</span>

기준선 대비 회귀 없음</code></pre>
  <p>이 중 <code>dead</code>(죽은 클래스)와 <code>winners</code>(승자)는 이번에 처음 집행 경로에 들어갔다.
     <code>dead</code> 는 넣자마자 실제 결함 3개를 가리켰다 — 다음 절이 그 이야기다.</p>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s4">
  <h2>Defect · Fixed</h2>
  <p class="h2sub">개요 탭 카드 7장 중 2장만 달랐다</p>

  <p class="lead">
    「게임 개요」 카드 줄은 <code>&lt;article&gt;</code> 5장과 <code>&lt;button&gt;</code> 2장이 섞여 있다.
    브라우저 기본 스타일시트가 버튼에 주는 <code>font: 400 13.3333px Arial</code> 과
    <code>text-align: center</code> 는 <strong>폼 컨트롤로 상속되지 않는다</strong>. 아무도 끊어 주지 않아
    그 2장만 같은 줄에서 혼자 튀고 있었다.
  </p>

  <div class="stack">
    <figure><span class="tag tag-b">전</span>{img("pulse-cards-before.jpg","카드 7장 — 수정 전")}
      <figcaption>전 — 왼쪽 2장(「세계관」「설정집」)만 가운데 정렬, Arial, 각진 모서리. 나머지 5장과 따로 논다.</figcaption></figure>
    <figure><span class="tag tag-a">후</span>{img("pulse-cards-after.jpg","카드 7장 — 수정 후")}
      <figcaption>후 — 7장이 같은 글꼴·정렬·모서리</figcaption></figure>
  </div>

  {ba("crop-pulse-before.jpg","crop-pulse-after.jpg",
      "근접: 가운데 정렬 + Arial 13.33px + 모서리 0px",
      "근접: 좌측 정렬 + system-ui 14px + 모서리 8px")}

  <h4>브라우저에서 잰 값</h4>
  <table>
    <thead><tr><th>속성</th><th>&lt;article&gt; 5장</th><th>&lt;button&gt; 2장 — 전</th><th>&lt;button&gt; 2장 — 후</th></tr></thead>
    <tbody>
      <tr><td class="mono">border-radius</td><td class="mono">8px</td>
          <td class="mono"><span class="pill bad">0px</span></td><td class="mono"><span class="pill ok">8px</span></td></tr>
      <tr><td class="mono">font</td><td class="mono">system-ui 14px</td>
          <td class="mono"><span class="pill bad">Arial 13.3333px</span></td><td class="mono"><span class="pill ok">system-ui 14px</span></td></tr>
      <tr><td class="mono">text-align</td><td class="mono">start</td>
          <td class="mono"><span class="pill bad">center</span></td><td class="mono"><span class="pill ok">start</span></td></tr>
      <tr><td class="mono">cursor</td><td class="mono">auto</td>
          <td class="mono"><span class="pill bad">default</span></td><td class="mono"><span class="pill ok">pointer</span></td></tr>
      <tr><td class="mono">border-color</td><td class="mono">…08 균일</td>
          <td class="mono"><span class="pill bad">…08 …1 …1 …08 (베벨)</span></td><td class="mono"><span class="pill ok">…08 균일</span></td></tr>
    </tbody>
  </table>

  <h4>세 번째 결함: 누를 수 있다는 단서가 하나도 없었다</h4>
  <p>이 2장은 클릭하면 탭이 바뀐다. 그런데 커서도 호버도 없어서, 나머지 5장과 생김새가 같은 채로
     「눌러도 되는지」 알 방법이 없었다.</p>

  {ba("canon-hover-before.jpg","canon-hover-after.jpg",
      "전 — hover 시 배경 rgb(255,255,255), cursor: default",
      "후 — hover 시 배경 rgba(15,23,42,.03), 테두리 강조, cursor: pointer",
      "포인터를 올린 상태에서 찍은 것이다. 전에는 아무 일도 일어나지 않는다.")}

  <div class="note good">
    <span class="label">고침</span>
    <pre style="margin:10px 0 0"><code><span class="b">.database-modal-backdrop .db-overview-pulse-card</span> {{
  <span class="y">font: inherit;</span>        <span class="c">/* UA 버튼 글꼴은 상속되지 않는다 */</span>
  <span class="y">text-align: inherit;</span>  <span class="c">/* UA 버튼은 가운데 정렬한다 */</span>
}}
<span class="b">.database-modal-backdrop :is(.db-overview-canon, .db-overview-codex)</span> {{
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}}</code></pre>
  </div>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s5">
  <h2>Regression · Mine</h2>
  <p class="h2sub">회귀 ① — 게이트가 0건이라고 했지만 표가 무너졌다</p>

  <div class="note bad">
    <span class="label">내가 낸 회귀</span>
    <p><code>13-actor-studio.css</code> 를 <code>index.css:83 → :68</code> 로 올렸다.
    「번호가 곧 캐스케이드 순서」 계약을 되살리려던 것이고,
    <strong>승자 게이트가 0건 변경이라고 해서 안전하다고 판단했다.</strong> 틀렸다.</p>
  </div>

  <div class="ba tall">
    <figure><span class="tag tag-b">깨짐</span>{img("actor-table-regression.jpg","배우 목록 열 정렬이 무너진 상태")}
      <figcaption>셀이 헤더와 어긋난다 — 「직업 1 514 보임」이 한 덩어리로 흐른다</figcaption></figure>
    <figure><span class="tag tag-a">고침</span>{img("actor-table-after.jpg","배우 목록 열 정렬 복구")}
      <figcaption>5열이 헤더와 맞는다</figcaption></figure>
  </div>

  <p>CDP 로 잰 셀 x 좌표(헤더 / 첫 행):</p>
  <pre><code><span class="r">깨진 상태   265 442 536 586 650  /  265 384 416 432 462</span>
<span class="g">고친 뒤     265 442 536 586 650  /  265 442 536 586 650</span></code></pre>

  <h4>왜 게이트가 못 잡았나</h4>
  <p>같은 요소의 <code>display</code> 를 두 규칙이 다툰다. <strong>선택자가 다르다.</strong></p>
  <pre><code><span class="c">record-list-modern.css:14</span>
  <span class="b">.database-modal-backdrop .database-modal-window .database-modal-body .db-list-row</span>
  → display: <span class="r">flex</span>            (0,4,0) · layer(database)

<span class="c">15-actor-studio.css:90</span>
  <span class="b">.database-modal-body .db-actor-studio-workspace .db-actor-studio-table .db-actor-table-row</span>
  → display: <span class="g">grid</span>            (0,4,0) · layer(database)</code></pre>
  <p>특정도도 레이어도 같으니 승자는 <strong>문서 순서</strong>다. 13- 을 :68 로 올리면
     <code>record-list-modern</code>(:74)이 뒤로 가서 flex 가 이긴다.</p>

  <div class="note warn">
    <span class="label">설계상의 사각지대</span>
    <p>승자 게이트의 키는 <strong>(정확한 선택자, 속성, @조건)</strong> 이라 이 둘을 애초에 경쟁으로 보지 않는다.
    「겹치지만 다른 선택자끼리의 경쟁」은 못 잡는 축이고, 전체 78,668키 중 경쟁이 성립하는 게
    1%뿐이라 이대로 두기로 했던 부분이다. <strong>그 1%에 걸렸다.</strong></p>
  </div>

  <h4>고침 — 위치가 아니라 이름을 실제 순서에 맞춘다</h4>
  <p>계획이 적어 둔 대비책이 「옮겨서 승자가 뒤집히면 15- 로 개명하라」였다. 그대로 했다:
     <code>13-actor-studio.css → 15-actor-studio.css</code>, 위치는 원래의 :83.
     이제 <code>desktop-record-shell</code> 번호가 적재 순서에서 단조 증가한다(01–12 → 14 → 15).</p>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s6">
  <h2>Regression · Mine</h2>
  <p class="h2sub">회귀 ② — 제외를 하나 적었더니 특정도가 올라갔다</p>

  <p class="lead">
    개요 탭 카드를 고치려고 구형 베벨 리셋에 제외를 하나 붙였다. 그것만으로
    <strong>이 리셋이 원래 지고 있던 규칙들을 새로 이겼다.</strong>
  </p>

  <pre><code>  button:not(.db-tab):not(.event-custom-select-trigger)                        <span class="g">(0,3,1)</span>
→ button:not(.db-tab):not(.event-custom-select-trigger):not(.db-overview-pulse-card)
                                                                              <span class="r">(0,4,1)</span></code></pre>
  <p><code>:not()</code> 의 특정도는 <strong>인자 중 가장 센 것</strong>이다. 제외를 하나 더 적는 것만으로
     클래스가 하나 늘었고, <code>(0,4,0)</code> 규칙들이 전부 밀렸다.</p>

  <div class="stack">
    <figure><span class="tag tag-b">깨짐</span>{img("stat-chips-regression.jpg","카운트 칩이 각진 모서리")}
      <figcaption>개요 탭 카운트 칩 9개 — <code>.db-overview-stat {{ border-radius: 10px }}</code> (0,4,0) 이 지고 계산값 <strong>0px</strong></figcaption></figure>
    <figure><span class="tag tag-a">고침</span>{img("stat-chips-after.jpg","카운트 칩 모서리 복구")}
      <figcaption>둥근 모서리 10px 복구 — 작업 시작점과 <strong>픽셀 단위로 동일</strong> (0.000%)</figcaption></figure>
  </div>

  <h4>CDP 로 본 선언자 순서 (뒤가 승자)</h4>
  <pre><code><span class="r">깨진 상태  .db-overview-stat … 10px  →  button:not(…):not(…):not(.pulse-card) … 0    ← 승</span>
<span class="g">고친 뒤    button:not(…):not(…):not(:where(.pulse-card)) … 0  →  .db-overview-stat … 10px ← 승</span></code></pre>

  <div class="note good">
    <span class="label">고침</span>
    <p>제외를 <code>:not(:where(.db-overview-pulse-card))</code> 로 감쌌다.
    <code>:where()</code> 의 특정도는 0 이므로 <strong>목록만 늘고 특정도는 (0,3,1) 그대로다.</strong></p>
  </div>

  <div class="note bad">
    <span class="label">여섯 게이트가 전부 초록이었다</span>
    <p>승자 게이트는 키가 정확한 선택자 문자열이라 <code>:not(X) → :not(:where(X))</code> 를
    「옛 키 사라짐 3건 + 새 키 생김 3건」으로만 본다. <strong>어느 규칙이 어느 규칙을 새로 이겼는지는
    설계상 표현할 수 없다.</strong> 잡은 것은 게이트가 아니라 다음 절의 히트맵이다.</p>
  </div>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s7">
  <h2>Evidence</h2>
  <p class="h2sub">픽셀로 증명하기</p>

  <p class="lead">
    작업 시작점(<code>9e5c890c9</code>)을 별도 워크트리에 체크아웃하고 두 번째 dev 서버를 띄웠다.
    같은 하네스로 양쪽을 찍고, <strong>달라진 픽셀만 빨갛게 칠했다.</strong>
    이것이 이번 작업에서 실제로 회귀를 잡은 유일한 도구다.
  </p>

  {fig("heat-db-overview.jpg","개요 탭 — 작업 전체 구간(9e5c890c9 → HEAD) 변경 히트맵. 빨간 곳만 픽셀이 달라졌다.")}

  <div class="note good">
    <span class="label">읽는 법</span>
    <p>빨간 영역이 <strong>의도한 카드 2장에만 갇혀 있다</strong>(bbox x[253,707] y[171,286]).
    카운트 칩 9개 · 나머지 카드 5장 · 차트 2개 · 사이드바 · 푸터는 <strong>단 한 픽셀도 안 움직였다.</strong>
    회귀 ②가 살아 있을 때는 이 그림에서 칩 9줄이 같이 빨갛게 나왔고, 그게 단서였다.</p>
  </div>

  <table>
    <thead><tr><th>표면</th><th class="num">픽셀 차이</th><th>해석</th></tr></thead>
    <tbody>
      <tr><td>db-actors</td><td class="num"><span class="pill ok">0.008%</span></td><td>104px — 커서·안티에일리어싱</td></tr>
      <tr><td>db-places</td><td class="num"><span class="pill ok">0.008%</span></td><td>102px — 같음</td></tr>
      <tr><td>db-tiles</td><td class="num"><span class="pill ok">0.008%</span></td><td>104px — 같음</td></tr>
      <tr><td>db-system</td><td class="num"><span class="pill ok">0.008%</span></td><td>104px — 같음</td></tr>
      <tr><td>db-overview</td><td class="num"><span class="pill warn">0.856%</span></td><td><strong>의도한 카드 2장</strong>에만 갇힘</td></tr>
      <tr><td>editor</td><td class="num"><span class="pill mute">2.721%</span></td><td>맵 캔버스 내용 — 아래 그림 참조</td></tr>
    </tbody>
  </table>

  <h4>에디터의 2.7% 는 CSS 가 아니다</h4>
  {fig("heat-editor.jpg","맵 에디터 히트맵 — 빨간 영역은 전부 Phaser 캔버스가 그린 내용이다. 툴바·좌측 패널·타일 팔레트·조수 덱은 한 픽셀도 안 움직였다.")}
  <p>맵 캔버스는 실행마다 다른 내용을 그린다(카메라·전환 베일·시간대). 그래서 에디터 표면의
     생 픽셀 비교는 그 자체로는 판정에 못 쓴다 — <strong>크롬이 안 움직였다는 것</strong>이 판정이다.</p>

  <h4>대규모 이동의 캐스케이드 동일성</h4>
  <p><code>editor/</code> 26파일을 옮길 때는 픽셀만으로 부족했다. 승자 게이트에
     <code>--ignore-file</code>(경로를 뺀 비교)을 붙여 <strong>순수 이동이면 0건</strong>이 나오는 것을 증명했다.</p>
  <pre><code>$ node scripts/check-css-winners.mjs --ignore-file
<span class="c">  (--ignore-file: 파일 경로를 뺀 비교 — 순수 이동 증명용)</span>
<span class="g">css-winners: 승자 변경 없음</span>          <span class="c">← 경로 포함 비교로는 7,247건</span></code></pre>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s8">
  <h2>Cleanup</h2>
  <p class="h2sub">지운 것 · 옮긴 것</p>

  <table>
    <thead><tr><th>작업</th><th class="num">규모</th><th>증명</th></tr></thead>
    <tbody>
      <tr><td><strong>editor/ 유령 디렉터리 해체</strong><br><span style="color:var(--text-3);font-size:12.5px">
              11,714줄이 모든 표면 규칙에서 면제돼 있었다. 21장 → <code>map/</code>, 5장 → <code>shell/dialogs/</code></span></td>
          <td class="num">26 파일</td>
          <td><code>--ignore-file</code> 0건 + 픽셀 0.000%</td></tr>
      <tr><td><strong>map · shell 죽은 규칙 제거</strong></td><td class="num">785 줄</td>
          <td>승자 변경이 전부 «사라짐», 이동 0</td></tr>
      <tr><td><strong>database 죽은 규칙 제거</strong></td><td class="num">456 줄</td>
          <td>승자 501건 전부 «사라짐», 이동 0</td></tr>
      <tr><td><strong>액센트 리터럴 → 토큰</strong><br><span style="color:var(--text-3);font-size:12.5px">
              <code>#4a57d6</code> → <code>var(--accent)</code>. 그중 135건은 <code>var(--x, #4a57d6)</code> 형태의 <strong>죽은 폴백</strong>이었다</span></td>
          <td class="num">181 건</td>
          <td>값 보존 증명 후 치환</td></tr>
      <tr><td><strong>나머지 토큰 리터럴</strong><br><span style="color:var(--text-3);font-size:12.5px">
              <code>--warning</code> 7 · <code>--gold</code> 4 · <code>--text-1</code> 16 · <code>--text-2</code> 13</span></td>
          <td class="num">40 건</td>
          <td>선택자 스코프 확인 후 치환</td></tr>
      <tr><td><strong>쓸 수 없는 토큰 삭제</strong><br><span style="color:var(--text-3);font-size:12.5px">
              <code>--bp-sm/md/lg/xl</code> — 커스텀 프로퍼티는 <code>@media</code> 조건절에서 평가되지 않는다</span></td>
          <td class="num">4 개</td>
          <td>참조 0, 그리고 <em>쓸 수 없음</em></td></tr>
    </tbody>
  </table>

  <div class="note warn">
    <span class="label">주의 — 번들로 추론하면 틀린다</span>
    <p>토큰 치환의 안전 판정은 <strong>선택자 스코프</strong>로 해야 한다.
    <code>database/studio-theme.css</code> 의 재정의는 <code>.database-modal-backdrop</code> 스코프라,
    <code>components/</code> 같은 공용 시트의 규칙이라도 DB 모달 안 요소에 매치되면 덮인 값을 본다.
    값이 실제로 다른 토큰(<code>--danger</code> #C6403D→#B91C1C, <code>--success</code>,
    <code>--accent-muted</code> α.12→.08)은 그래서 손대지 않았다.</p>
  </div>

  <div class="gallery">
    {fig("sweep-db-actors-after.jpg","등장인물 탭")}
    {fig("sweep-db-places-after.jpg","장소 탭")}
    {fig("sweep-db-tiles-after.jpg","타일 탭")}
    {fig("sweep-db-system-after.jpg","시스템 탭")}
  </div>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s9">
  <h2>Refuted</h2>
  <p class="h2sub">기각한 계획 전제</p>

  <p class="lead">계획서에 적혀 있었지만 실측해 보니 틀린 것들이다. 전부 계획 문서와 커밋에 기록했다.</p>

  <table>
    <thead><tr><th>계획이 말한 것</th><th>실측</th></tr></thead>
    <tbody>
      <tr><td>「<code>!important</code> 38개를 해체한다」</td>
          <td><span class="pill bad">2개뿐</span> 42개를 요소별로 재 보니 증명 가능하게 안전한 건 2개.
              나머지는 선언자 2~5개와 실제 경쟁 중이거나 <strong>JS 인라인 스타일을 이기는 중</strong>이다 —
              Phaser 가 캔버스에 <code>width/height</code> 를 인라인으로 박고,
              <code>width: 100% !important</code> 는 바로 그걸 이기려고 있는 것이다.</td></tr>
      <tr><td>「기계적 토큰 치환 463건」</td>
          <td><span class="pill bad">221건</span> 대부분의 후보가 표면마다 재정의된다. 번들 단위 추론은 틀린다.</td></tr>
      <tr><td>「주석을 지우면 11종이 새로 빨개진다」</td>
          <td><span class="pill ok">0종</span> 실측 0. TS 에 있던 2개 이름은 클래스가 아니라 testid 였다.</td></tr>
      <tr><td>「릴리스 절차에 번들 재생성을 넣는다」</td>
          <td><span class="pill mute">이미 있음</span> <code>verify:player</code> 가 이미 exit 1 로 막는다.
              없던 것은 집행이 아니라 <em>진단</em>이라 진단 도구만 새로 만들었다.</td></tr>
      <tr><td>「삭제 여력 50,212줄」(E축)</td>
          <td><span class="pill bad">허위</span> 허브·사각지대가 허위 초록. 실제 판정 통과는 0.</td></tr>
    </tbody>
  </table>

  <div class="note">
    <span class="label">도구의 사각지대도 기록했다</span>
    <p>승자 게이트는 <code>!important</code> 의 <em>필요 여부</em>를 판정할 수 없다. 키가 정확-선택자라
    「같은 선택자」끼리만 경쟁으로 보는데, <code>!important</code> 는 <strong>다른 선택자</strong>가
    같은 요소의 같은 속성을 다툴 때만 의미가 있기 때문이다. 플래그를 다 떼도
    「같은 선언이 접미사만 잃음」으로만 보고된다. 판정하려면 CDP 로 요소별 선언자를 세야 하고,
    <strong>인라인 스타일은 CDP <code>matchedCSSRules</code> 에도 안 나오므로</strong> 따로 봐야 한다.</p>
  </div>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s10">
  <h2>Deferred</h2>
  <p class="h2sub">남긴 것과 이유</p>

  <ul class="clean">
    <li class="q"><strong>database <code>!important</code> 263개</strong> —
        map·shell 42개를 재 봤더니 안전한 게 2개였다. database 는 그보다 6배 크다.
        요소별 캐스케이드 측정 없이 건드리면 안 된다.</li>
    <li class="q"><strong><code>.db-ws-btn-ghost</code> (버튼 42개)</strong> —
        죽은 클래스가 아니라 <em>구현되지 않은 변형</em>이다. 지울지 만들지는 제품 판단이다.</li>
    <li class="q"><strong>파일 병합</strong> (<code>studio-v2</code> 가 <code>light-theme</code>·<code>studio-theme</code> 흡수) —
        청소가 아니라 설계 변경이다. 「studio 가 light 를 전부 덮지는 않는다」(값 6개)를 먼저 결정해야 한다.</li>
    <li class="q"><strong>R2 / R3 / R5 를 실패로 승격</strong> —
        map 의 R2 부채가 11,029건이다. 승격하면 아무 일도 못 한다. 래칫으로 묶어 둔다.</li>
    <li class="q"><strong>역할 기반 레이어 / 중첩 레이어</strong> —
        근본 원인(두 표면 사이에 단일 우선순위가 없다)을 고치는 유일한 길이지만 별도 스펙 과제다.</li>
  </ul>

  <div class="note">
    <span class="label">다음 사람에게</span>
    <p><code>src/styles/index.css</code> 의 선형 레이어 순서만 읽고 「승자는 레이어 순서가 정한다」고
    결론 내리면 <strong>틀린다</strong>. 실제 승자는 <code>node scripts/check-css-winners.mjs</code> 가 답한다.
    그리고 그 게이트가 초록이어도 <strong>다른 선택자끼리의 경쟁은 안 본다</strong> —
    레이어 순서나 파일 위치를 바꾸기 전에 반드시 픽셀도 함께 재라.</p>
  </div>
</section>

<!-- ══════════════════════════════════════ -->
<section id="s11">
  <h2>Reproduce</h2>
  <p class="h2sub">재현 방법</p>

  <h4>게이트</h4>
  <pre><code><span class="c"># CSS 게이트 6개 (전체 gates 는 28분, 이건 몇 분)</span>
node scripts/verify-gates.mjs --only css

<span class="c"># 승자만 — 무엇이 어떻게 바뀌었는지 사람이 읽는 형식으로</span>
node scripts/check-css-winners.mjs
node scripts/check-css-winners.mjs --ignore-file   <span class="c"># 순수 이동 증명</span>
node scripts/check-css-winners.mjs --json --limit 40

<span class="c"># 의도한 변경이면 기준선 갱신 후 diff 를 리뷰에 올린다</span>
node scripts/check-css-winners.mjs --save-baseline</code></pre>

  <h4>픽셀 비교 (이번에 회귀를 잡은 방법)</h4>
  <pre><code><span class="c"># 1. 비교 기준점을 별도 워크트리로 체크아웃하고 두 번째 dev 서버를 띄운다</span>
git worktree add --detach /home/main/css-before-wt &lt;기준 커밋&gt;
ln -s &lt;repo&gt;/node_modules /home/main/css-before-wt/node_modules
cp &lt;repo&gt;/.env.local /home/main/css-before-wt/
cd /home/main/css-before-wt &amp;&amp; npx vite --port 9892 --strictPort

<span class="c"># 2. 같은 하네스로 양쪽을 찍는다</span>
OPRN_PORT=9892 node .playwright-mcp/sweep.mjs before
OPRN_PORT=9891 node .playwright-mcp/sweep.mjs after

<span class="c"># 3. 달라진 픽셀을 빨갛게 칠한다 — 이게 판정이다</span>
m = (before != after).any(axis=2)
overlay[m] = [255, 0, 0]</code></pre>

  <div class="note warn">
    <span class="label">하네스 함정 두 가지</span>
    <p><strong>①</strong> 크로미움에 <code>--disable-features=NetworkChangeNotifier</code> 등 플래그 5개가 없으면
    vite dev 모듈이 전부 <code>ERR_NETWORK_CHANGED</code> 로 끊겨 백지가 된다. 서버 문제로 오진하기 쉽다.<br>
    <strong>②</strong> <code>r.style.borderColor</code> 는 값에 <code>var()</code> 가 들어 있으면 <code>""</code> 를 반환한다.
    「누가 이기나」를 CSSOM 으로 물으면 아무것도 못 찾는다. CDP <code>CSS.getMatchedStylesForNode</code> 를 써라.</p>
  </div>

  <h4>핵심 파일</h4>
  <table>
    <thead><tr><th class="mono">경로</th><th>역할</th></tr></thead>
    <tbody>
      <tr><td class="mono">scripts/check-css-winners.mjs</td><td>(선택자, 속성, @조건) → 승자 래칫</td></tr>
      <tr><td class="mono">scripts/lib/css-entries.mjs</td><td>번들 진입점 탐색 — graph · winners 가 공유</td></tr>
      <tr><td class="mono">scripts/lib/baseline-age.mjs</td><td>기준선 노후 경고 (경고만, 실패 아님)</td></tr>
      <tr><td class="mono">scripts/check-player-bundle-tokens.mjs</td><td>커밋된 플레이어 번들 토큰 드리프트 진단</td></tr>
      <tr><td class="mono">docs/superpowers/plans/2026-09-17-css-untangle.md</td><td>계획 + 기각된 전제 기록</td></tr>
      <tr><td class="mono">src/styles/TOKENS.md</td><td>서브레이어 함정 10장 표</td></tr>
    </tbody>
  </table>
</section>

<footer>
  <p><strong>OPRN Studio</strong> · CSS 얽힘 해소 보고서 · 2026-09-17 ·
     branch <code>css-adversarial-review-plan</code> · 커밋 20개 (9e5c890c9 … 081cd5e37)</p>
  <p>모든 수치는 브라우저 실측이다. 「같다」는 주장은 전부 픽셀 비교나 CDP 계산값으로 뒷받침된다.</p>
</footer>

</div>
</body>
</html>
"""

os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
open(OUT, "w", encoding="utf-8").write(HTML)
print(f"{OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB")
