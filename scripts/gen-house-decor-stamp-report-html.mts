/**
 * 착수 보고 HTML — 장식 배선(굴뚝·깃발·울타리) + 파라메트릭 스탬프 통합 1단계.
 * 실행: npx tsx scripts/gen-house-decor-stamp-report-html.mts
 * 산출: docs/2026-07-20-house-decor-stamp-report.html
 */
import fs from "node:fs";
import path from "node:path";

const RENDER_DIR = path.resolve("output/evidence/house-decor-report");
const EDITOR_DIR = path.resolve("output/evidence/house-stamp-editor");
const OUT_HTML = path.resolve("docs/2026-07-20-house-decor-stamp-report.html");
const meta = JSON.parse(fs.readFileSync(path.join(RENDER_DIR, "meta.json"), "utf8")) as Record<string, string>;

function img(dir: string, file: string, alt: string): string {
  const b64 = fs.readFileSync(path.join(dir, `${file}.png`)).toString("base64");
  return `<img src="data:image/png;base64,${b64}" alt="${alt}" loading="lazy">`;
}
function fig(dir: string, file: string, title: string, desc: string): string {
  return `<figure>${img(dir, file, title)}<figcaption><b>${title}</b> — ${desc}</figcaption></figure>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>착수 보고 — 집 장식 배선 + 파라메트릭 스탬프 통합 1단계</title>
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
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:10px;padding:12px 16px;overflow-x:auto;font-size:.82em;line-height:1.55}
pre code{background:none;padding:0;font-size:1em}
.meta{color:var(--ink-3);font-size:.9rem;margin-bottom:1.2em}
section{border-top:2px solid var(--line);margin-top:2.2em}
.lead{color:var(--ink-2)}
.card{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:14px 18px;margin:14px 0}
.card.good{border-left-color:var(--good)}
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
.tag{display:inline-block;font-size:.75rem;font-weight:700;padding:.1em .6em;border-radius:99px;border:1px solid var(--good);color:var(--good);margin-right:.4em;white-space:nowrap}
ul.rules{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 26px;margin:1em 0}
ul.rules li{margin:.5em 0}
footer{margin-top:3em;color:var(--ink-3);font-size:.85rem;border-top:1px solid var(--line);padding-top:1em}
</style>
</head>
<body>
<main>
<h1>착수 보고 — 집 장식 배선 + 파라메트릭 스탬프 통합 1단계</h1>
<p class="meta">2026-07-20 · 전 이미지 실산출(목업 없음): <code>build_house_kit</code>·<code>stamp_structure_kit</code> 실호출 렌더 + Playwright 실에디터 스크린샷 · 신규 테스트 14건 통과 · 회귀 0(기준선 stash 왕복 대조)</p>

<p class="lead">전 턴에서 확인한 두 격차를 배선했다:
① 굴뚝 326을 <b>지붕 문법에 채택</b>하고 울타리·깃발과 함께 <code>build_house_kit</code> 옵션으로 노출,
② <code>StructureKitDef</code>를 유니언으로 확장해 <b>파라메트릭 집 킷이 팔레트 스탬프 선반에 올라갔다</b> —
이제 사용자가 채팅 없이 팔레트에서 집을 골라 캔버스에 찍는다.</p>

<div class="card good">
<b>변경 요약.</b>
<code>houseKit.ts</code>(굴뚝 문법) ·
<code>houseKitDomain.ts</code>+<code>houseKitTools.ts</code>(fence/banner/chimney 옵션) ·
<code>types/base.ts</code>(kind:"house" 유니언 + learnedFrom 유니언) ·
<code>structureKitModel.ts</code>(정본 전개 계층) ·
<code>structureKitShelf.ts</code>(내장 '집 킷' 그룹) ·
<code>structureKitTools.ts</code>(셀 기반 시공 + 내장 킷 해석) ·
<code>builtinHouseStructureKits.ts</code>(신규) ·
<code>structureKitDbTab.ts</code>·<code>kitRender.ts</code>·<code>contextBuilder.ts</code>(유니언 대응).
테스트: <code>test/houseKitDecor.test.ts</code>·<code>test/houseStructureKit.test.ts</code> 신규, <code>test/structureKitTools.test.ts</code> 계약 갱신.
</div>

<section>
<h2>1. 굴뚝이 지붕 문법이 됐다 <span class="tag">채택 완료</span></h2>
<p>326은 어휘("지붕 장식 — 굴뚝, 우측 사선 지붕용")로만 존재했다. 이제 <code>stampFootprintHouseKit</code>의
<code>chimney</code> 옵션이 상위 소품 규약(빈 칸에만) 그대로 <b>우측 사선 지붕 열의 상단 바로 아래</b>에 놓는다.
직사각 지붕은 가장 오른쪽 지붕 열, A자 피라미드는 사선 캡 안쪽 몸통 위 — 킷 3계열 전부.</p>
<div class="shots">
${fig(RENDER_DIR, "1-before", "옵션 없음(기존과 동일)", `기본은 전부 꺼짐 — 기존 시공 결과가 바뀌지 않는다(회귀 테스트로 고정). <code>${meta["1-before"]}</code>`)}
${fig(RENDER_DIR, "1-after", "fence+banner+chimney", `같은 호출에 옵션 3개만 추가. <code>${meta["1-after"]}</code>`)}
</div>
</section>

<section>
<h2>2. build_house_kit 장식 옵션 — 마을 데코 문법을 집 단독 시공에서 <span class="tag">배선 완료</span></h2>
<p>울타리는 마을 파이프라인 정본 <code>placeHouseLotFences</code>를 그대로 재사용(게이트 3칸·모서리 강등 규칙 포함),
깃발은 <code>village/decor.ts</code> 문법(문 양옆 최상단 벽 행 208/209)을 도메인에 이식했다.
스펙 게이트는 경계 슬랙 2칸이라 울타리(+1칸 확장)가 그대로 통과한다. 아래 6컷 전부 <code>runTool("build_house_kit", …)</code> 실호출.</p>
<div class="trio">
${fig(RENDER_DIR, "2-kit-blue-stone", "blue-stone", meta["2-kit-blue-stone"] ?? "")}
${fig(RENDER_DIR, "2-kit-bright-plaster", "bright-plaster", meta["2-kit-bright-plaster"] ?? "")}
${fig(RENDER_DIR, "2-kit-amber-wood", "amber-wood", meta["2-kit-amber-wood"] ?? "")}
${fig(RENDER_DIR, "2-kit-slate-wood", "slate-wood", meta["2-kit-slate-wood"] ?? "")}
${fig(RENDER_DIR, "2-kit-timber-hall", "timber-hall", meta["2-kit-timber-hall"] ?? "")}
${fig(RENDER_DIR, "2-kit-aframe-stone", "aframe-stone", meta["2-kit-aframe-stone"] ?? "")}
</div>
${fig(RENDER_DIR, "3-lplan-decor", "ㄱ자 평면 × 풀장식", `평면 문법과 독립 — 임의 날개 합집합에도 그대로 작동. <code>${meta["3-lplan-decor"]}</code>`)}
<pre><code>// 도구 스키마(houseKitTools.ts) — 신규 3옵션, 기본 꺼짐
fence:   { type: "boolean", description: "앞마당 울타리+문 게이트(기본 false) — 마을 울타리 정본 문법 재사용" },
banner:  { type: "boolean", description: "문 위 최상단 벽에 깃발 208/209 페어(기본 false)" },
chimney: { type: "boolean", description: "우측 사선 지붕에 굴뚝 326(기본 false)" }</code></pre>
</section>

<section>
<h2>3. 파라메트릭 스탬프 — kind:"house"가 스키마에 들어갔다 <span class="tag">1단계 완료</span></h2>
<p>3부작이 선행과제로 남긴 두 가지를 구현했다: <code>StructureKitDef</code>가
<b>유니언</b>(<code>section</code> 행렬 | <code>house</code> 파라메트릭)이 됐고, <code>learnedFrom</code>도
유니언(<code>user-paint | builtin-parametric</code>)으로 확장됐다. house 킷은 행렬이 아니라
<b>시공 파라미터</b>(houseKitId·wings·stories·windows·chimney)를 저장하고, 찍는 순간
정본 <code>stampFootprintHouseKit</code>이 전개한다 — 팔레트·AI(<code>stamp_structure_kit</code>)·DB 탭이 같은 전개 계층을 쓴다.</p>
<pre><code>// types/base.ts
export type StructureKitLearnedFrom = "user-paint" | "builtin-parametric";
export interface HouseStructureKitDef {
  id: string; kind: "house"; name?: string;
  houseKitId: string;                       // blue-stone | bright-plaster | …
  wings: { x; y; w; h }[];                  // (0,0) 기준 상대 좌표 — origin에 평행이동
  stories?: 1|2|3; lowWall?: boolean; windows?: { spacing? } | false;
  door?: boolean; chimney?: boolean;
  learnedFrom: StructureKitLearnedFrom; createdAt?: string;
}
export type StructureKitDef = SectionStructureKitDef | HouseStructureKitDef;</code></pre>

<h3>실에디터 — 팔레트 '집 킷' 선반에서 골라 찍는다</h3>
<p>내장 킷 6종(<code>builtinHouseStructureKits.ts</code>, 굴뚝 포함)이 combined_town 타일셋 팔레트에
가상 노출된다 — 등록 절차 없이 바로. 아래는 Playwright가 실제 에디터를 구동해 찍은 화면.</p>
<div class="shots">
${fig(EDITOR_DIR, "1-shelf", "팔레트 '집 킷' 선반", "6킷 전부 실타일 조립 아이콘 — 생김새가 주인공(§④ 규약)")}
${fig(EDITOR_DIR, "2-stamped", "클릭 한 번 = 집 한 채", "bright-plaster 킷 선택 후 캔버스 클릭 — 벽·지붕·창·문·굴뚝 전개")}
</div>
${fig(EDITOR_DIR, "3-two-kits", "킷 바꿔 연속 시공", "blue-stone 추가 — 맵 데이터 검증: 회벽 43·문 146·굴뚝 326 실재 확인(스펙 단언)")}

<h3>AI 쪽 절반 — stamp_structure_kit이 같은 킷을 쓴다</h3>
<div class="shots">
${fig(RENDER_DIR, "4-stamped-kits", "stamp_structure_kit ×2", `repeat=5를 넘겨도 집 킷은 1채(완결 단위 규약). <code>${(meta["4-stamped-kits"] ?? "").slice(0, 160)}…</code>`)}
${fig(RENDER_DIR, "5-palette-stamp-aframe", "paletteStampFromKit 전개", meta["5-palette-stamp-aframe"] ?? "")}
</div>
</section>

<section>
<h2>4. 검증 상태</h2>
<ul class="rules">
<li><b>신규 테스트 14건 통과</b> — 굴뚝 좌표(직사각/A자)·기본 꺼짐 회귀·깃발 좌표·울타리 게이트·도메인 계약·내장 킷 노출 범위·전개 셀(문/굴뚝 포함)·서명 결정성·repeat 무시.</li>
<li><b>영향권 기존 테스트</b>: houseKit·houseKitDomainSeam(외장 해시 고정)·structureKitDbActions·harnessPatternDetect·toolSchemaProviderCompat 전부 통과. <code>structureKitTools.test.ts</code>는 "내장 킷이 목록에 함께 실린다"로 계약을 갱신.</li>
<li><b>회귀 0</b> — aiSpecGate 18·proposalCompleteness 1·aiSkills 2 실패는 stash 왕복으로 클린 HEAD에서도 동일 21건임을 확인(기존 부채).</li>
<li>무결성 게이트 부작용 발견: 시공이 <b>시작 위치를 덮으면 커밋 거부</b>(start-position) — 데코 코드가 아니라 기존 게이트의 정상 동작. 테스트·렌더 하네스는 시작 위치를 피해 짓는다.</li>
</ul>
</section>

<section>
<h2>5. 다음 단계(미착수)</h2>
<ul class="rules">
<li><b>파라미터 편집 UI</b> — 선반에서 킷을 고른 뒤 크기(wings)·재질·창문을 조절하는 표면. 지금은 내장 6종 고정 몸체(9×8).</li>
<li><b>사용자 파생 저장</b> — 내장 킷을 복제해 <code>tileset.structureKits</code>에 등록(이름·파라미터 수정) → DB 탭 관리 편입. 스키마는 준비됨.</li>
<li><b>마을 파이프라인 굴뚝 채택</b> — <code>build_village</code> 집들에 chimney 확률 적용.</li>
<li><b>stories·lowWall 도구 노출</b> — 엔진엔 있고 <code>build_house_kit</code> 스키마엔 아직 없다(전 보고서 C섹션).</li>
</ul>
</section>

<footer>
렌더: <code>npx tsx scripts/render-house-decor-report.mts</code> · 에디터 증거: Playwright 임시 스펙(검증 후 삭제, output/evidence/house-stamp-editor) ·
관련 보고서: <a href="2026-07-20-house-variety-catalog.html" style="color:var(--accent)">집 다양성 카탈로그 41컷</a>
</footer>
</main>
</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html);
console.log("wrote", OUT_HTML, `${Math.round(fs.statSync(OUT_HTML).size / 1024)}KB`);
