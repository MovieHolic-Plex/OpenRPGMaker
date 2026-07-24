/**
 * 실내 천장 정본 수정 보고 HTML — 전(before)/후(after) 실렌더 비교.
 * 실행: npx tsx scripts/gen-interior-ceiling-report-html.mts
 * 산출: docs/2026-07-20-interior-ceiling-canon-report.html
 */
import fs from "node:fs";
import path from "node:path";

const AFTER = path.resolve("output/evidence/house-variety-catalog");
const BEFORE = path.resolve("output/evidence/interior-before");
const ATTEMPT = path.resolve("output/evidence/interior-366-attempt");
const OUT_HTML = path.resolve("docs/2026-07-20-interior-ceiling-canon-report.html");

function img(dir: string, file: string, alt: string): string {
  const b64 = fs.readFileSync(path.join(dir, `${file}.png`)).toString("base64");
  return `<img src="data:image/png;base64,${b64}" alt="${alt}" loading="lazy">`;
}
function pair(file: string, title: string, notes: string): string {
  return `<h3>${title}</h3>
<div class="trio">
<figure>${img(BEFORE, file, `${title} 수정 전`)}<figcaption><b>수정 전</b> — 낱장 트림 프레임 + 공허 혼용, (1,1) 고정 상자, 벽 위 천장 없음</figcaption></figure>
<figure>${img(ATTEMPT, file, `${title} 1차 시도`)}<figcaption><b>1차 시도(반려)</b> — (0,0) 체커+비드 블록(366)으로 통일했으나 사용자 교정: 이 블록은 천장이 아니다</figcaption></figure>
<figure>${img(AFTER, file, `${title} 최종`)}<figcaption><b>최종</b> — ${notes}</figcaption></figure>
</div>`;
}
function fig(dir: string, file: string, title: string, desc: string): string {
  return `<figure>${img(dir, file, title)}<figcaption><b>${title}</b> — ${desc}</figcaption></figure>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>실내 천장 정본 v2 — 검정+회암 테두리 오토타일 통일·벽/천장 쌍 불변식 (전후 비교)</title>
<style>
:root{
  --bg:#14161c; --surface:#1b1e26; --ink:#e8eaf0; --ink-2:#aeb4c4; --ink-3:#79819a;
  --line:#2c3040; --accent:#7ba3e8; --good:#6dc493; --warn:#d9b25c; --bad:#e08585; --code-bg:#232734;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15.5px/1.75 "Pretendard","Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:32px 20px 96px}
h1{font-size:1.8rem;line-height:1.3;margin:.2em 0 .3em}
h2{font-size:1.35rem;margin:0 0 .3em;padding-top:1.2em}
h3{font-size:1.05rem;margin:1.3em 0 .4em}
p{margin:.6em 0}
code{background:var(--code-bg);padding:.08em .35em;border-radius:4px;font-size:.86em;font-family:Consolas,"Cascadia Mono",monospace}
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:10px;padding:12px 16px;overflow-x:auto;font-size:.82em;line-height:1.55}
.meta{color:var(--ink-3);font-size:.9rem;margin-bottom:1.2em}
section{border-top:2px solid var(--line);margin-top:2.2em}
.lead{color:var(--ink-2)}
.card{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--good);border-radius:10px;padding:14px 18px;margin:14px 0}
.card.warn{border-left-color:var(--warn)}
table{border-collapse:collapse;width:100%;font-size:.88em;margin:.8em 0}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--code-bg);white-space:nowrap}
figure{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;overflow:hidden}
figcaption{color:var(--ink-2);font-size:.85rem;margin-top:8px;line-height:1.55}
figcaption b{color:var(--ink)}
figure img{max-width:100%;height:auto;display:block;border-radius:6px;image-rendering:pixelated;margin:0 auto}
.shots{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:1em 0}
.trio{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:1em 0}
@media (max-width:760px){.shots,.trio{grid-template-columns:1fr}}
ul.rules{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 26px;margin:1em 0}
ul.rules li{margin:.5em 0}
footer{margin-top:3em;color:var(--ink-3);font-size:.85rem;border-top:1px solid var(--line);padding-top:1em}
</style>
</head>
<body>
<main>
<h1>실내 천장 정본 v2 — 모든 천장 블록을 (0,1) 회암 테두리 오토타일로 통일</h1>
<p class="meta">2026-07-20 · 정본 <code>interiorHouseWallGrammar.ts</code> 재작성 v2 · 하네싱 키트·10×10 스탬프 동일 문법 · 영향권 테스트 121건 통과(계약 갱신 포함)</p>

<div class="card">
<b>지적 → 수정 매핑.</b>
<table>
<tr><th>지적</th><th>원인</th><th>수정</th></tr>
<tr><td>(1,1) 상자는 왜 있나</td><td><code>ensurePinnedChipsetBox(map,1,1)</code> — 모든 내부맵에 "데모용 상자"를 천장 링 위에 강제 배치하던 잔재</td><td>삭제(이벤트 포함). 되살리기 금지 주석</td></tr>
<tr><td>모든 천장 블록을 (0,1) 오토타일로 통일 — (0,0)은 쓰지 말 것</td><td>Option B가 천장 자리를 낱장 트림+공허로 손조립했고, 1차 수정은 (0,0) 체커+비드 블록(366)으로 잘못 통일</td><td>천장(구조 질량 + 바깥 어둠 전체) = <b>(0,1) 검정+회암 테두리 오토타일</b>(앵커 369, 몸통 430 — builtin_darkness_deep 블록). 테두리를 <b>저장 시점에 성형</b>(shapeInteriorCeiling, 맵 밖은 이어진 것으로 취급). 체커 블록(366 계열)·낱장 전부 배제(테스트로 밴)</td></tr>
<tr><td>천장 아래에는 반드시 벽</td><td rowspan="2">① 북벽이 맵 최상단(y=0)에서 시작해 천장 행이 없었고, ② <b>상하로 붙은 방 사이 수평 벽</b>이 cottage-l에선 1행(천장만·벽 없음), mansion에선 2행 갭(벽면만·위에 천장 없음)이었다</td><td rowspan="2">쌍 불변식을 그램마에 내장(남향 모서리 → 크림 면 2행 필수, 모든 벽면 위 → 천장 필수) + 플랜 천장 여백 시프트(+1행) + <b>수평 벽을 전부 3행(천장 1 + 벽면 2)으로 재배치</b>(cottage-l·mansion 방 간격 확장 — 내부맵 20×20 / 24×25)</td></tr>
<tr><td>벽 위에는 반드시 천장 (2·3차 지적)</td></tr>
<tr><td>통행도 되어야 한다</td><td>문 앞 트림·상자가 통로 점유 가능</td><td>문(외부·내부)은 천장 띠를 뚫는 <b>바닥 통로</b>만 — 플랭크/스텝 없음. 기존 <code>enforceWalkability</code>(문 기준 BFS 통행 강제)·critique 유지</td></tr>
<tr><td>'카페트 계단' 배제</td><td>465–467 붉은 카펫 대계단(정본상 귀족 전용)을 모든 민가 층계에 남발</td><td>층계는 444 대각 오르막·474/475 하강으로 교체, 착지 3칸 정리. 문 앞 397 스텝(카페트 계단 모양 트림)도 제거</td></tr>
</table>
</div>

<section>
<h2>1. 전 → 후 비교 (같은 시드·같은 파라미터)</h2>
${pair("g-shop", "상점 (cottage-l · shop)", "검정+회암 테두리 천장 통일(바깥 질량 포함), (1,1) 상자 없음, 벽/천장 쌍 완비, 문은 바닥 통로")}
${pair("g-dwelling", "살림집 (cottage-l · dwelling)", "내부 문 위 1칸 크림 면 쌍(77/107)까지 불변식 적용")}
${pair("g-mansion-1f", "대저택 1층 (mansion · manor)", "금벽 리틴트가 새 벽면 위에서 그대로 동작, 복도 회랑 천장 연속")}
</section>

<section>
<h2>2. 나머지 프로그램 + 스탬프 (수정 후)</h2>
<div class="shots">
${fig(AFTER, "g-workshop", "공방", "천장 정본 적용")}
${fig(AFTER, "g-inn", "여관", "천장 정본 적용")}
${fig(AFTER, "g-mansion-2f", "대저택 2층", "층계 444/474·475 — 카펫 대계단 배제")}
${fig(AFTER, "g-stamp-10x10", "10×10 실내 스탬프", "툴바 스탬프도 같은 정본 그램마(planInteriorHouseWalls)로 전개 — 손조립 행렬 폐기")}
</div>
</section>

<section>
<h2>3. 새 정본 규칙 (하네싱 키트에 반영)</h2>
<ul class="rules">
<li><b>천장</b> = 검정+회암 테두리 오토타일 하나(앵커 369, 몸통 430). 저장 시점 성형 — 맵 밖은 이어진 것으로 취급해 경계 테두리를 그리지 않는다. 팔레트에는 '천장(회암 테두리)' 그룹으로 등록(<code>harness-interior-house-v1-ceiling</code>). (0,0) 체커 블록(366)은 집 셸에서 전면 배제.</li>
<li><b>쌍 불변식</b>: 천장 칸의 남쪽이 바닥이면 그 사이에 크림 벽면 2행(1칸 폭은 77/107). 모든 벽면의 북쪽은 반드시 천장.</li>
<li><b>문</b> = 바닥 통로. 외부 문은 남측 천장 띠를 1칸 뚫고, 내부 문 위에는 불변식대로 1칸 면 쌍이 선다.</li>
<li><b>배제 목록</b>(테스트로 밴): (0,0) 체커 블록 전체 366–368/396–398/426–428/456–458 · 카펫 대계단 465–467(귀족 전용 유지) · 핑크 플레이스홀더 233/257/258.</li>
<li>하네스 그룹 <code>house-shell</code> 멤버 = 천장 블록 11타일 + 크림 면, <code>HOUSE_SHELL_MEMBER_TILES</code>에 천장 블록 편입(가구 벽걸이/질량 판정), 10×10 스탬프는 정본 그램마 직접 호출 + 저장 성형으로 전환.</li>
</ul>
</section>

<section>
<h2>4. 대저택 정본 — 세로 복도·복도 끝 계단·아궁이 (2026-07-20 추가 교정)</h2>
<ul class="rules">
<li><b>세로 중앙 복도 + 남단 입구</b> — 대저택은 세로 복도(3열)가 척추, 입구는 복도 최남단. 좌우 4실(침실·서재·식당·주방)은 1열 천장 기둥 너머 측면 문으로 연결.</li>
<li><b>복도 = 붉은 카펫 러너</b>(375–377/405–407/435–437 테두리 세트) + <b>가구 금지</b> — 남측 필러가 복도에도 탁자·상자를 놓던 버그(<code>placeSouthFiller</code> 복도 가드 누락)를 수정. 벽 장식·흉상만 허용.</li>
<li><b>계단은 복도 끝</b> — 그 층 착지(문)에서 먼 쪽 복도 끝 중앙(<code>corridorStairCell</code>): 1층은 북단 오르막(444), 2층은 북단 하강(474/475). 2층도 같은 세로 복도 정본(manor 전용 2층 플랜 신설).</li>
<li><b>"모든 방마다 탁자" 강제 해제</b> — 침실은 탁자 세트 금지(침대·협탁·거울·러그·수납), 남측 필러도 침실은 적재물로 대체. 탁자는 식당·주방 작업대·서재 책상·선술집만.</li>
<li><b>바닥 재질</b> — 나무(72)만이 아니다: 보랏빛 돌바닥(12)·청회색 자갈(42)·나무 널(102/103)·카펫 3종이 어휘에 있고, 대저택은 <b>보랏빛 돌바닥 + 복도 카펫</b>으로 교체.</li>
<li><b>아궁이 채택</b> — 373 '벽난로 아궁이'(어휘에 있었으나 미사용)를 주방 정본으로: 화덕(21/51) 옆 벽면에 매립. 실내 바닥 모닥불(124) 배제.</li>
</ul>
<div class="shots">
${fig(AFTER, "g-mansion-1f", "대저택 1층 (정본)", "세로 카펫 복도·남단 입구·북단 계단(444)+흉상·돌바닥 4실·주방 아궁이(373)")}
${fig(AFTER, "g-mansion-2f", "대저택 2층 (정본)", "같은 복도 구조 — 북단 하강 계단(474/475), 침실엔 탁자 없음")}
</div>
</section>

<section>
<h2>5. 검증 · 잔여</h2>
<ul class="rules">
<li>테스트: interiorRoomPipeline 15 · legacyInteriorWallContract · interiorTerrainAutotiles · structureStampTools · houseKit · houseKitDomainSeam(내부 해시 재고정) · villageBuilder 27 — <b>전부 통과</b>. 계약 갱신(캡/플랭크 → 430 계열 천장, 내부맵 높이 +1행, 해시 재고정 등).</li>
<li class="warn-item">잔여: 대저택 1층 계단(444)이 식탁·러그 인접 칸에 놓여 시각적으로 붐빈다 — 계단 위치 선정을 가구 배치 전에 예약하는 후속 과제. 2층 연결·전이 이벤트는 정상.</li>
<li>1행 수평 파티션(방이 상하로 딱 붙은 경우)은 기하상 벽면 2행을 세울 수 없어 천장 띠로 남는다 — 현행 플랜은 전부 3행 갭이라 실경로엔 없음.</li>
</ul>
</section>

<footer>
렌더: <code>npx tsx scripts/render-house-variety-catalog.mts</code> · 전(before) 이미지는 수정 직전 카탈로그에서 추출 보존 ·
카탈로그 최신판: <a href="2026-07-20-house-variety-catalog.html" style="color:var(--accent)">집 다양성 카탈로그(실내 갱신판)</a>
</footer>
</main>
</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html);
console.log("wrote", OUT_HTML, `${Math.round(fs.statSync(OUT_HTML).size / 1024)}KB`);
