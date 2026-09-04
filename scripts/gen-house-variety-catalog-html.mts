/**
 * 집 다양성 카탈로그 HTML 생성 — render-house-variety-catalog.mts 산출 PNG를
 * base64 인라인으로 임베드한 이미지 리치 보고서.
 * 실행: npx tsx scripts/gen-house-variety-catalog-html.mts
 * 산출: docs/2026-07-20-house-variety-catalog.html
 */
import fs from "node:fs";
import path from "node:path";

const IN = path.resolve("output/evidence/house-variety-catalog");
const OUT_HTML = path.resolve("docs/2026-07-20-house-variety-catalog.html");
const meta = JSON.parse(fs.readFileSync(path.join(IN, "meta.json"), "utf8")) as {
  results: Record<string, { doorAt: string; size: string }>;
  interiorMeta: Record<string, string>;
};

function img(file: string, alt: string): string {
  const b64 = fs.readFileSync(path.join(IN, `${file}.png`)).toString("base64");
  return `<img src="data:image/png;base64,${b64}" alt="${alt}" loading="lazy">`;
}

interface Fig { file: string; title: string; desc: string; }
function fig(f: Fig): string {
  const r = meta.results[f.file];
  const im = meta.interiorMeta[f.file];
  const dims = r ? `${r.size} · 문 ${r.doorAt}` : im ?? "";
  return `<figure>${img(f.file, f.title)}<figcaption><b>${f.title}</b> — ${f.desc}${dims ? `<br><code>${dims}</code>` : ""}</figcaption></figure>`;
}
function grid(figs: Fig[], cls = "shots"): string {
  return `<div class="${cls}">${figs.map(fig).join("\n")}</div>`;
}

const A: Fig[] = [
  { file: "a-kit-blue-stone", title: "blue-stone · 파랑 지붕+석벽", desc: "몸체 9×8 동일, 재질만 교체" },
  { file: "a-kit-bright-plaster", title: "bright-plaster · 오렌지 지붕+흰 회벽", desc: "용마루·사선 트림·투명 캡 자동" },
  { file: "a-kit-amber-wood", title: "amber-wood · 오렌지 지붕+통나무 벽", desc: "벽 나인슬라이스만 교체" },
  { file: "a-kit-slate-wood", title: "slate-wood · 파랑 지붕+통나무 벽", desc: "지붕·벽 페어 자유 조합 킷" },
  { file: "a-kit-timber-hall", title: "timber-hall · 빨간 널지붕+목조 기둥 홀", desc: "하프팀버 기둥 열(every 3) 자동 삽입, 기둥 열엔 창을 내지 않음" },
  { file: "a-kit-aframe-stone", title: "aframe-stone · 빨간 A자 지붕+석벽", desc: "피라미드 지붕 — 높이가 폭에 종속(단일 직사각 전용)" },
];
const B: Fig[] = [
  { file: "b-plan-long", title: "가로 롱하우스", desc: "날개 1개 15×7" },
  { file: "b-plan-tower", title: "세로 타워", desc: "날개 1개 5×12 — 벽 3행은 고정, 남는 높이는 전부 지붕" },
  { file: "b-plan-l", title: "ㄱ자 (L)", desc: "날개 2개 합집합 — 접합부 지붕 연속 규칙 자동" },
  { file: "b-plan-t", title: "T자", desc: "중앙 몸체+가로 바" },
  { file: "b-plan-u", title: "ㄷ자 (U)", desc: "양 다리+상단 바, 문은 가장 긴 남쪽 외벽 런 중앙" },
  { file: "b-plan-cross", title: "십자 (+)", desc: "직교 날개 2개" },
  { file: "b-plan-o", title: "ㅁ자 (중정)", desc: "링 4날개 — 안뜰에 면한 안쪽 벽·처마까지 국소 규칙으로 완성" },
  { file: "b-plan-z", title: "Z자 (엇갈림)", desc: "대각 오프셋 날개 — 단차 지붕" },
];
const C: Fig[] = [
  { file: "c-story-1", title: "1층", desc: "벽 밴드 3행(상·중·하)" },
  { file: "c-story-2", title: "2층", desc: "벽 밴드 5행 — 창문 행이 층마다 생김" },
  { file: "c-story-3", title: "3층", desc: "벽 밴드 7행" },
  { file: "c-lowwall", title: "낮은 벽 헛간 (lowWall)", desc: "중단 없음 — 창고·헛간용, 창 자동 생략" },
];
const D: Fig[] = [
  { file: "d-win-0", title: "spacing 0", desc: "한 칸 걸러 전부 창" },
  { file: "d-win-2", title: "spacing 2 (기본)", desc: "벽 2칸 간격" },
  { file: "d-win-4", title: "spacing 4", desc: "드문 창" },
  { file: "d-win-off", title: "창문 끔", desc: "windows:false" },
];
const E: Fig[] = [
  { file: "e-min", title: "최소 집 3×5", desc: "허용 최소 폭(좌·중·우 모서리)" },
  { file: "e-wide", title: "대형 19×9", desc: "폭 제한 없음 — 중앙 열 반복" },
  { file: "e-tallroof", title: "높은 지붕 7×12", desc: "지붕 몸통 행수 자유" },
  { file: "e-aframe-5", title: "A자 폭 5", desc: "h=6 강제(벽3+피라미드2+처마1)" },
  { file: "e-aframe-7", title: "A자 폭 7", desc: "h=7 강제" },
  { file: "e-aframe-11", title: "A자 폭 11", desc: "h=9 강제" },
  { file: "e-aframe-13", title: "A자 폭 13", desc: "h=10 강제" },
];
const F: Fig[] = [
  { file: "f-l2-timber", title: "2층 ㄱ자 목조 홀", desc: "timber-hall × L평면 × stories:2 × spacing:3" },
  { file: "f-u2-plaster", title: "2층 ㄷ자 회벽 저택", desc: "bright-plaster × U평면 × stories:2" },
  { file: "f-court-manor", title: "중정 장원", desc: "blue-stone × ㅁ평면 16×16" },
  { file: "f-farm-compound", title: "농가 콤파운드", desc: "본채 amber-wood + 헛간 slate-wood(lowWall) — 한 맵에 킷 혼합" },
];
const G: Fig[] = [
  { file: "g-dwelling", title: "살림집 (dwelling)", desc: "침실·부엌·거실 자동 배치 — 천장 정본 v2(검정+회암 테두리 오토타일 통일·벽/천장 쌍 불변식) 적용" },
  { file: "g-workshop", title: "공방 (workshop)", desc: "작업장 프로그램" },
  { file: "g-shop", title: "상점 (shop)", desc: "집주인 이름에 '상점'이 들어가면 자동 선택" },
  { file: "g-inn", title: "여관 (inn)", desc: "이름 '여관' → inn 프로그램" },
  { file: "g-mansion-1f", title: "대저택 1층 (mansion)", desc: "세로 카펫 복도 정본 — 남단 입구·북단 계단·돌바닥 4실·주방 아궁이(373)" },
  { file: "g-mansion-2f", title: "대저택 2층", desc: "1층과 같은 세로 복도 정본 — 복도 끝 하강 계단(474/475), 카펫 대계단 배제" },
  { file: "g-stamp-10x10", title: "10×10 실내 스탬프", desc: "툴바 스탬프도 같은 천장 정본으로 전개(planInteriorHouseWalls 직접 호출)" },
];

const H: Fig[] = [
  { file: "h-decor-single", title: "단독 집 + 앞마당 울타리·깃발·굴뚝", desc: "울타리 = <code>placeHouseLotFences</code>(마을 파이프라인 정본, 게이트 자동) · 깃발 208/209 = <code>village/decor.ts</code> 문법(문 양옆 최상단 벽) · 굴뚝 326은 어휘로만 등록돼 있어 수동 배치 시연" },
  { file: "h-decor-estate", title: "estate 필지 둘레 울타리", desc: "본채+헛간을 한 필지로 — 둘레 문법이 지붕 위는 건너뛰고 게이트를 뚫는다(<code>placeEstatePerimeterFence</code>)" },
];

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>이 에디터로 지을 수 있는 '집'의 전 범위 — 실렌더 카탈로그 41컷</title>
<style>
:root{
  --bg:#14161c; --surface:#1b1e26; --ink:#e8eaf0; --ink-2:#aeb4c4; --ink-3:#79819a;
  --line:#2c3040; --accent:#7ba3e8; --accent-2:#e8a05c; --good:#6dc493; --warn:#d9b25c; --bad:#e08585; --code-bg:#232734;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:15.5px/1.75 "Pretendard","Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:32px 20px 96px}
h1{font-size:1.8rem;line-height:1.3;margin:.2em 0 .3em}
h2{font-size:1.35rem;margin:0 0 .3em;padding-top:1.2em}
h3{font-size:1.05rem;margin:1.3em 0 .4em}
p{margin:.6em 0}
code{background:var(--code-bg);padding:.08em .35em;border-radius:4px;font-size:.86em;font-family:Consolas,"Cascadia Mono",monospace}
.meta{color:var(--ink-3);font-size:.9rem;margin-bottom:1.2em}
section{border-top:2px solid var(--line);margin-top:2.2em}
.lead{color:var(--ink-2)}
.card{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:14px 18px;margin:14px 0}
.card.warn{border-left-color:var(--warn)}
table{border-collapse:collapse;width:100%;font-size:.88em;margin:.8em 0}
.tablewrap{overflow-x:auto}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--code-bg);white-space:nowrap}
figure{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;overflow:hidden}
figcaption{color:var(--ink-2);font-size:.85rem;margin-top:8px;line-height:1.55}
figcaption b{color:var(--ink)}
figcaption code{font-size:.78em}
figure img{max-width:100%;height:auto;display:block;border-radius:6px;image-rendering:pixelated;margin:0 auto}
.shots{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:1em 0}
.trio{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:1em 0}
@media (max-width:760px){.shots,.trio{grid-template-columns:1fr}}
.axis{display:inline-block;font-size:.78rem;font-weight:700;padding:.1em .6em;border-radius:99px;border:1px solid var(--accent);color:var(--accent);margin-right:.4em;white-space:nowrap}
.axis.engine{border-color:var(--warn);color:var(--warn)}
ul.rules{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 26px;margin:1em 0}
ul.rules li{margin:.5em 0}
footer{margin-top:3em;color:var(--ink-3);font-size:.85rem;border-top:1px solid var(--line);padding-top:1em}
</style>
</head>
<body>
<main>
<h1>이 에디터로 지을 수 있는 '집'의 전 범위</h1>
<p class="meta">2026-07-20 · 정본 <code>src/editor/houseKit.ts</code>(stampFootprintHouseKit) 직접 실행 · 렌더 39컷 전부 실산출(<code>scripts/render-house-variety-catalog.mts</code>) · 내부는 <code>src/editor/houseInteriors.ts</code></p>

<p class="lead big">집은 프리셋 목록에서 고르는 게 아니라 <b>5개 축의 곱</b>으로 생성된다:
<span class="axis">① 재질 킷 6종</span>
<span class="axis">② 평면 = 날개 사각형 합집합(무한)</span>
<span class="axis engine">③ 층수 1–3 + 헛간</span>
<span class="axis">④ 창문 밀도/끔</span>
<span class="axis">⑤ 크기 연속(폭≥3)</span>
— 그리고 문이 있는 집마다 <b>내부 맵(스케일×프로그램 6종×시드)</b>이 자동으로 딸려 나온다.</p>

<div class="card">
<b>조합 수 감각.</b> 이산 축만 곱해도 <code>6킷 × 평면군 8+ × 층수 3 × 창문 4 × 문 2 ≈ 4,600</code>.
여기에 날개 개수·좌표·폭·높이가 연속 변수라 실제 가능한 외장은 <b>사실상 무한</b>이다.
아래 39컷은 각 축을 고립시켜 전 범위를 실증한 대표 단면이다.
</div>
<div class="card warn">
<b>노출 격차.</b> AI 도구 <code>author_house</code>는 ①②④⑤+문+내부를 노출한다.
③ 층수(stories)와 헛간(lowWall)은 엔진(<code>stampFootprintHouseKit</code>)에는 있지만 도구 스키마에 아직 없다 — 아래 C섹션은 엔진 직접 호출 실증.
</div>

<section id="kits">
<h2>A. 재질 킷 6종 — 같은 몸체, 다른 집</h2>
<p>몸체 9×8을 고정하고 킷만 바꿨다. 벽 나인슬라이스·지붕 문법·상위 레이어 마감(투명 캡·트림)이 킷별로 자동 적용된다. 세트 혼합(파랑 지붕+회벽 등)은 킷 정의로만 가능 — 임의 혼합은 금지돼 있다.</p>
${grid(A)}
</section>

<section id="plans">
<h2>B. 평면 문법 — 날개 합집합이 만드는 실루엣</h2>
<p>건물 질량 = 날개 사각형들의 합집합. 열 구간마다 하단 3행이 벽, 나머지가 지붕이 되고, 처마·가장자리·용마루는 <b>국소 규칙</b>(이웃 칸이 지붕인가)만으로 결정된다. 그래서 어떤 평면을 던져도 접합부가 맞는다. 문은 가장 긴 남쪽 외벽 런의 중앙에 자동.</p>
${grid(B)}
</section>

<section id="stories">
<h2>C. 층수·헛간 <span class="axis engine">엔진 전용</span></h2>
<p>벽 밴드 행 수 = <code>2 + (2×층수−1)</code>. 창문 행이 층마다 하나씩 생겨 입면이 달라진다. <code>lowWall</code>은 상단+하단 2행만 — 창 없는 창고 실루엣.</p>
${grid(C)}
</section>

<section id="windows">
<h2>D. 창문 축 — 같은 벽, 다른 표정</h2>
<p>창은 상위 레이어에 자동 배치(벽 중단 행, 1칸 인셋, 문 ±1 회피, 하프팀버 기둥 열 회피). <code>spacing</code>으로 밀도를 바꾸거나 끌 수 있다.</p>
${grid(D)}
</section>

<section id="scale">
<h2>E. 크기·지붕 지오메트리</h2>
<p>폭 3(최소)부터 제한 없이. 직사각 킷은 지붕 몸통 행수가 자유라 같은 폭에서도 낮은 집/높은 집이 갈린다. A자 킷만 예외 — 피라미드 기하가 높이를 폭에 종속시킨다(<code>h = 벽3 + ⌊(w−1)/2⌋ + 1</code>).</p>
${grid(E)}
</section>

<section id="combo">
<h2>F. 축의 곱 — 조합 실증</h2>
<p>축들은 독립이라 자유롭게 곱해진다. 킷 × 평면 × 층수 × 창문, 그리고 한 맵에 여러 채(킷 혼합)도 가능하다.</p>
${grid(F)}
</section>

<section id="interior">
<h2>G. 내부 자동 생성 — 문 하나에 집 한 채가 딸려온다</h2>
<p><code>author_house</code>는 기본으로 문 이벤트+내부 맵을 함께 만든다. 내부는 외장 힌트(층수·킷·면적·집주인 이름)와 시드로 <b>스케일</b>(cottage~mansion)과 <b>프로그램</b>(dwelling·shop·workshop·study·inn·manor)을 골라 가구까지 배치한다. 킷 재질이 내부 벽 재질로 이어지고(석벽 킷→돌벽돌), mansion은 금벽. 2층 이상이면 위층 맵+계단 연결까지 자동.</p>
${grid(G)}
</section>

<section id="decor">
<h2>H. 장식은 어디 있나 — 울타리·깃발·굴뚝 <span class="axis engine">별도 데코 패스</span></h2>
<p>울타리와 깃발은 집 스탬프의 속성이 아니라 <b>마을 시공(<code>build_village</code>)의 후처리 데코 패스</b>다:
울타리는 <code>village/fences.ts</code>의 둘레 정본 문법(앞줄+게이트, estate는 둘레 전체)으로 필지마다 쳐지고,
깃발 208/209는 <code>village/decor.ts</code>가 "가장 중요한 다층 집 한 채"의 최상단 벽에만 건다.
그래서 집을 단독으로 지으면(위 A–F 전부) 맨몸으로 나온다. 아래 두 컷은 같은 정본 함수를 직접 호출해 합성한 실증.
굴뚝 326은 타일 어휘(<code>tileSemanticsCombinedTown.ts</code> "지붕 장식/굴뚝·우측 사선 지붕용")로만 등록돼 있고
<b>어떤 시공 코드도 아직 놓지 않는다</b> — 사용자 손맵에만 존재하는 미채택 어휘다.</p>
${grid(H)}
</section>

<section id="limits">
<h2>한계 — 지금 사양으로 안 되는 것</h2>
<ul class="rules">
<li><b>재질은 6킷이 전부.</b> 초가·벽돌 등 목록 밖 재질을 요청하면 도구가 지어내지 않고 '아직 학습되지 않은 재질'로 거부하도록 설계돼 있다.</li>
<li><b>문은 남쪽 자동 1개.</b> 측면·후면 문, 복수 문은 스키마에 없다.</li>
<li><b>A자 킷 제약.</b> 단일 직사각 날개 전용, 높이 강제 — 랜덤 킷 믹스에서도 제외(<code>MIXABLE_HOUSE_KIT_IDS</code>).</li>
<li><b>stories·lowWall 미노출.</b> 엔진엔 있으나 <code>author_house</code> 스키마엔 없다(위 C섹션). 도구로는 날개 높이를 키워도 벽은 1층 밴드, 나머지는 지붕이 된다 — 내부 층수만 날개 높이(h≥9→2층, h≥11→3층)로 올라간다.</li>
<li><b>창문 위치 개별 지정 불가.</b> 밀도(spacing)와 on/off만.</li>
<li><b>최소 제약.</b> 날개 폭 ≥3 · 각 열 구간 높이 ≥5(벽3+지붕2, lowWall은 ≥4).</li>
</ul>
</section>

<footer>
렌더: <code>npx tsx scripts/render-house-variety-catalog.mts</code> → <code>output/evidence/house-variety-catalog/</code> 39 PNG → 본 문서에 base64 인라인.
전 컷이 정본 시공 코드의 실산출이며 목업 없음.
</footer>
</main>
</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html);
console.log("wrote", OUT_HTML, `${Math.round(fs.statSync(OUT_HTML).size / 1024)}KB`);
