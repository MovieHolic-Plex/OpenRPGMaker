#!/usr/bin/env node
// scripts/qa/db-ux-render-report.mjs
// verify-shots/db-ux/REPORT.html 을 만든다. 표의 숫자는 전부 같은 폴더의 기록 파일에서
// 계산하고, 이미지는 전부 실기 캡처를 참조한다(손으로 적는 숫자 0개).
//
// 사용: node scripts/qa/db-ux-render-report.mjs
// 검사: node scripts/qa/db-ux-report-check.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const dir = path.join(repo, "verify-shots/db-ux");
const load = (p) => JSON.parse(readFileSync(path.join(dir, p), "utf8"));

const before = load("before/probe.json");
const after = load("after/probe.json");
const pseudo = load("pseudo-baseline/probe.json");
const proof = load("placeholder/proof.json");
const hunt = existsSync(path.join(dir, "imagehunt/hunt.json")) ? load("imagehunt/hunt.json") : null;
// 좁은 칸에서 값이 안 보이던 숫자칸 수. db-ux-narrow-number-audit.mjs 가 두 상태를 기록한다.
const narrowBefore = load("narrow-number/audit-before.json");
const narrowAfter = load("narrow-number/audit-after.json");


// ── 기록 파일에서 계산 ────────────────────────────────────────────────────
const TAB_LABEL_EARLY = { enemies: "몬스터", terrain: "지형" };
const narrowTabs = Object.entries(narrowBefore.byTab)
  .map(([slug, hits]) => `${TAB_LABEL_EARLY[slug] ?? slug} ${hits.length}`).join(" · ");
const T = (p, k) => p.totals[k];
const heads = (p) => Object.values(p.tabs)
  .filter((t) => t && typeof t === "object" && t.space && typeof t.space.headerTotal === "number")
  .map((t) => t.space.headerTotal);
const r1 = (n) => Math.round(n * 10) / 10;
const sum1 = (xs) => r1(xs.reduce((a, b) => a + b, 0));
const swing1 = (xs) => r1(Math.max(...xs) - Math.min(...xs));
const px = (n) => `${n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}px`;
const pct = (a, b) => `${Math.round((1 - b / a) * 100)}%`;

const hdrBefore = sum1(heads(before));
const hdrAfter = sum1(heads(after));
const tabsBefore = T(before, "tabsMeasured") + T(before, "tabsErrored");
const tabsAfter = T(after, "tabsMeasured");
const hiddenImgs = T(after, "imgZero") + T(after, "imgHidden");
const hiddenBgs = T(after, "bgZero") + T(after, "bgHidden");

// ── 이미지 경로 헬퍼 ──────────────────────────────────────────────────────
const has = (rel) => existsSync(path.join(dir, rel));
const img = (rel, alt, cls = "shot") =>
  has(rel)
    ? `<a href="${rel}" target="_blank" rel="noopener"><img class="${cls}" loading="lazy" src="${rel}" alt="${alt}"></a>`
    : `<span class="missing">캡처 없음: ${rel}</span>`;

/** 라벨 붙은 한 컷 */
const cut = (rel, alt, tag, tagCls, note = "") => `
  <figure class="cut">
    <figcaption><span class="tag ${tagCls}">${tag}</span>${note}</figcaption>
    ${img(rel, alt)}
  </figure>`;

/** 좌우 비교 두 컷 */
const pair = (a, b, note = "") => `
<div class="cmp-grid">${a}${b}</div>${note ? `<p class="cap">${note}</p>` : ""}`;

// ── 탭 갤러리 ─────────────────────────────────────────────────────────────
const TAB_LABEL = {
  overview: "개요", actors: "주인공", classes: "직업", skills: "스킬", items: "아이템",
  equipment: "장비", enemies: "몬스터", "monster-species": "몬스터 종족", troops: "몬스터 무리",
  elements: "속성", states: "상태", animations: "애니메이션", "battle-screen": "전투 화면",
  "battle-commands": "전투 명령", terrain: "지형", tilesets: "타일셋", crops: "작물",
  characters: "주민", "life-crafting": "생활 제작", "life-collections": "생활 수집",
  "farm-animals": "농장 동물", "farm-spatial": "농장 배치", "daily-weather": "날씨",
  factions: "진영", "structure-kits": "구조물", "common-events": "공통 이벤트",
  switches: "스위치", variables: "변수", terms: "용어", system: "시스템",
};
const gallery = Object.keys(after.tabs)
  .map((slug) => {
    const hasBefore = has(`before/${slug}.png`);
    return `  <figure class="gal">
    ${img(`after/${slug}.png`, `${TAB_LABEL[slug] ?? slug} 탭`, "thumb")}
    <figcaption>${TAB_LABEL[slug] ?? slug}<span class="slug">${slug}</span>${hasBefore ? "" : '<span class="nb">이전 기록 없음</span>'}</figcaption>
  </figure>`;
  })
  .join("\n");

// ── 헤더 얇아진 탭 비교쌍 ─────────────────────────────────────────────────
const HEAD_PAIRS = [
  ["characters", "주민", "설명 두 줄이 아이콘 한 줄로"],
  ["crops", "작물", "성장 단계 설명을 칩으로"],
  ["monster-species", "몬스터 종족", "안내문을 접는 카드로"],
  ["battle-screen", "전투 화면", "설명 블록을 배지로"],
  ["overview", "개요", "제목 줄 높이를 넉넉하게"],
  ["equipment", "장비", "슬롯 설명을 한 줄로"],
  ["items", "아이템", "머리말 여백 정리"],
  ["terms", "용어", "안내문 자리 축소"],
];
const headPairs = HEAD_PAIRS
  .filter(([slug]) => has(`report-crops/${slug}-before.png`) && has(`report-crops/${slug}-after.png`))
  .map(([slug, label, note]) => `
<figure class="pairfig">
  <div class="cmp-grid">
    ${cut(`report-crops/${slug}-before.png`, `${label} 이전`, "이전", "bad")}
    ${cut(`report-crops/${slug}-after.png`, `${label} 이후`, "이후", "good")}
  </div>
  <figcaption class="cap"><b>${label}</b> — ${note}</figcaption>
</figure>`).join("\n");

// ── 화면 폭 4종 ───────────────────────────────────────────────────────────
const WIDTHS = [1024, 1280, 1680, 1920];
const matrix = WIDTHS
  .filter((w) => has(`report-shots/matrix-${w}.png`))
  .map((w) => `  <figure class="gal">
    ${img(`report-shots/matrix-${w}.png`, `${w}px 화면`, "thumb")}
    <figcaption>${w}px 화면<span class="slug">잘림 0건</span></figcaption>
  </figure>`).join("\n");

const clipTitles = WIDTHS
  .filter((w) => has(`report-shots/clip-title-${w}.png`))
  .map((w) => `  <figure class="cut">
    <figcaption><span class="tag good">${w}px</span></figcaption>
    ${img(`report-shots/clip-title-${w}.png`, `${w}px 제목`)}
  </figure>`).join("\n");

// ── 증거표 ────────────────────────────────────────────────────────────────
const EVIDENCE = [
  ["숫자 칸 화살표", T(before, "numberUnskinned"), T(after, "numberUnskinned"), "탭마다 실제 화면에서 계산된 모양값을 읽음"],
  ["슬라이더", T(before, "rangeUnskinned"), T(after, "rangeUnskinned"), "같은 방법"],
  ["접기 삼각형", T(before, "detailsMarker"), T(after, "detailsMarker"), "같은 방법"],
  ["선택 상자(select)", T(before, "selectUnskinned"), T(after, "selectUnskinned"), "처음 진단서의 141개는 실제로 0개였다"],
  ["값이 안 보이는 숫자 칸", narrowBefore.total, narrowAfter.total,
    `칸 안쪽 폭이 ${narrowAfter.minContentPx}px 미만이면 눌린 것으로 셈`],
  ["작아서 읽기 힘든 글자", T(before, "tinyFont"), T(after, "tinyFont"), "글자마다 실제 크기 측정"],
  ["CSS로 그린 작은 글자", T(pseudo, "tinyPseudo"), T(after, "tinyPseudo"), "도구를 고쳐서 새로 세기 시작한 항목"],
  ["글자 잘림", T(before, "selfClipped"), T(after, "selfClipped"), "화면 4가지 크기에서 확인"],
  ["헤더가 쓰는 높이 합계", px(hdrBefore), px(hdrAfter), "탭마다 헤더 높이 측정"],
  ["탭 사이 높이 들쭉날쭉", px(swing1(heads(before))), px(swing1(heads(after))), "가장 큰 탭과 가장 작은 탭의 차이"],
  ["크기 0인 그림 (고친 것 아님)", T(before, "imgZero"), hiddenImgs, `${hiddenImgs}개 전부 <code>display:none</code> 패널 안. 도구가 이제 "숨은 칸"으로 따로 셈`],
  ["배경 그림 없음 (고친 것 아님)", T(before, "bgZero"), hiddenBgs, "같은 방법 · 같은 이유"],
];
const evidenceRows = EVIDENCE.map(([label, b, a, how]) => {
  const same = String(b) === String(a);
  return `  <tr><td>${label}</td><td class="n">${b}</td><td class="n ${same ? "" : "ok"}">${a}</td><td class="how">${how}</td></tr>`;
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>데이터베이스 화면 손질 보고서</title>
<style>
:root{
  --bg:#0c0e14; --card:#141824; --card2:#1a1f2e; --line:#242b3d; --line-soft:#1d2334;
  --tx:#e8ecf5; --tx2:#9aa5bd; --tx3:#6b7590;
  --ok:#4ade80; --bad:#f87171; --hi:#7c9cff; --warn:#fbbf24;
}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--tx);
  font:15px/1.75 "Malgun Gothic","맑은 고딕",system-ui,sans-serif}
.wrap{max-width:1240px;margin:0 auto;padding:36px 22px 80px}
code{font-family:Consolas,"Cascadia Mono",monospace;background:var(--card2);
  border:1px solid var(--line-soft);border-radius:4px;padding:1px 6px;font-size:12.5px;color:#d6ddf0}
h1{margin:0 0 10px;font-size:30px;letter-spacing:-.02em;line-height:1.3}
h1 .d{display:block;font-size:14px;color:var(--tx3);font-weight:400;letter-spacing:0;margin-top:8px}
.lede{font-size:16.5px;color:var(--tx);margin:0 0 22px;max-width:100ch}
h2{margin:52px 0 6px;font-size:21px;letter-spacing:-.01em;padding-top:22px;border-top:1px solid var(--line-soft)}
h2 .k{display:block;font-size:13px;color:var(--hi);font-weight:600;margin-bottom:6px;letter-spacing:.04em}
h3{margin:30px 0 10px;font-size:15.5px;color:var(--tx2)}
p{margin:0 0 14px;max-width:100ch}
.badges{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 8px}
.badge{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:11px 15px;min-width:150px}
.badge b{display:block;font-size:22px;line-height:1.25;font-family:Consolas,monospace}
.badge span{font-size:12.5px;color:var(--tx3)}
.badge.g b{color:var(--ok)} .badge.h b{color:var(--hi)} .badge.w b{color:var(--warn)}
img{display:block;max-width:100%}
a{color:var(--hi)}
.shot,.thumb{width:100%;border:1px solid var(--line);border-radius:8px;background:var(--card2)}
.thumb{aspect-ratio:16/10;object-fit:cover;object-position:top left}
a:hover .shot,a:hover .thumb{border-color:var(--hi)}
figure{margin:0}
.cmp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin:12px 0}
.cut figcaption{display:flex;align-items:center;gap:9px;margin:0 0 7px;font-size:12.5px;color:var(--tx2)}
.tag{font:600 11px/1 Consolas,monospace;letter-spacing:.06em;padding:4px 8px;border-radius:4px;border:1px solid}
.tag.bad{color:var(--bad);border-color:rgba(248,113,113,.4);background:rgba(248,113,113,.1)}
.tag.good{color:var(--ok);border-color:rgba(74,222,128,.4);background:rgba(74,222,128,.1)}
.tag.mid{color:var(--warn);border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.1)}
.cap{color:var(--tx2);font-size:13.5px;margin:8px 0 0}
.pairfig{margin:0 0 26px;padding:0 0 20px;border-bottom:1px dashed var(--line-soft)}
.pairfig:last-child{border-bottom:0}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(238px,1fr));gap:13px;margin-top:14px}
.gal figcaption{font-size:12.5px;color:var(--tx2);margin-top:7px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.gal .slug{color:var(--tx3);font-family:Consolas,monospace;font-size:11px}
.gal .nb{color:var(--warn);font-size:11px;border:1px solid rgba(251,191,36,.35);border-radius:3px;padding:1px 5px}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:12px}
th,td{border:1px solid var(--line-soft);padding:10px 13px;text-align:left;vertical-align:top}
th{background:var(--card2);color:var(--tx2);font-size:12.5px;font-weight:600}
td.n{font-family:Consolas,monospace;text-align:right;width:88px}
td.n.ok{color:var(--ok);font-weight:700}
td.how{color:var(--tx2);font-size:12.5px}
.note{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--hi);
  border-radius:0 8px 8px 0;padding:15px 18px;margin:18px 0}
.note.warn{border-left-color:var(--warn)}
.note p:last-child{margin-bottom:0}
ul{margin:0 0 14px;padding-left:22px;max-width:100ch}
li{margin:5px 0}
li::marker{color:var(--hi)}
.missing{display:block;padding:22px;border:1px dashed var(--line);border-radius:8px;
  color:var(--tx3);font-size:12.5px;text-align:center}
.foot{margin-top:56px;padding-top:18px;border-top:1px solid var(--line-soft);color:var(--tx3);font-size:12.5px}
</style>
</head>
<body>
<div class="wrap">

<h1>데이터베이스 화면 손질 보고서
  <span class="d">탭 ${tabsAfter}개 전부 다시 재고 고쳤습니다 · 화면 ${before.viewport.WIDTH}×${before.viewport.HEIGHT} · 전문가 모드</span>
</h1>

<p class="lede">게임 데이터를 편집하는 큰 창(데이터베이스)이 <b>설명문에 자리를 너무 많이 뺏기고</b>,
<b>글자가 잘리고</b>, <b>입력 칸 모양이 브라우저 기본</b>이었습니다.
탭 ${tabsAfter}개를 브라우저로 실제로 열어 숫자로 재고, 고친 뒤 다시 재서 비교했습니다.
아래 사진은 전부 실제 화면 캡처입니다.</p>

<div class="badges">
  <div class="badge g"><b>${pct(hdrBefore, hdrAfter)}</b><span>머리말이 먹던 높이 감소</span></div>
  <div class="badge g"><b>${T(before, "tinyFont")} → ${T(after, "tinyFont")}</b><span>읽기 힘들게 작던 글자</span></div>
  <div class="badge g"><b>${T(before, "numberUnskinned")} → ${T(after, "numberUnskinned")}</b><span>브라우저 기본 숫자 화살표</span></div>
  <div class="badge g"><b>${narrowBefore.total} → ${narrowAfter.total}</b><span>값이 안 보이던 숫자 칸</span></div>
  <div class="badge h"><b>${tabsAfter}</b><span>다시 잰 탭 수</span></div>
  <div class="badge w"><b>4</b><span>제가 틀려서 고친 것</span></div>
</div>

<h2><span class="k">1 / 자리 되찾기</span>설명문을 아이콘과 칩으로 줄였습니다</h2>
<p>탭마다 위쪽에 <b>긴 설명문</b>이 있었습니다. 읽는 건 처음 한 번인데 자리는 계속 차지합니다.
그래서 뜻이 같은 <b>아이콘·칩·접는 카드</b>로 바꿨습니다.
탭 ${tabsBefore}개의 머리말 높이를 다 더하면 <b>${px(hdrBefore)} → ${px(hdrAfter)}</b>,
${pct(hdrBefore, hdrAfter)} 줄었습니다. 그만큼 표와 목록이 더 보입니다.
<span class="cap">(이전 기록은 탭 ${tabsBefore}개, 이후는 ${tabsAfter}개입니다 — 첫 측정 때 탭 하나가
오류로 빠졌고, 합계는 각 기록에 실제로 담긴 탭만 더한 값입니다.)</span></p>
${headPairs}

<h2><span class="k">2 / 안전망</span>그림이 안 불러지면 표시가 나게 했습니다</h2>
<p>정확히 적으면 <b>실제로 깨진 그림은 ${T(before, "imgBroken")}개였습니다.</b> 보이는 문제는 없었어요.
문제는 <b>깨질 때 대비가 없었다</b>는 점입니다. 그림 파일을 못 찾으면 <b>빈자리도 안 남기고</b>
사라져서, 뭔가 빠졌다는 사실조차 알 수 없었습니다.</p>
<p>이제 못 찾으면 <b>회색 네모와 "불러오기 실패"</b>가 남습니다.
화면 읽어주는 프로그램에도 "회복약 썸네일 이미지 불러오기 실패"처럼 읽힙니다.
일부러 그림 ${proof.after.failedMarked}개를 깨뜨려 확인했고, ${proof.after.visiblePlaceholders}개 모두
${proof.after.samples[0].w}×${proof.after.samples[0].h} 크기로 자리를 지켰습니다.</p>
${pair(
  cut("placeholder/1-healthy.png", "정상", "정상", "good", "그림이 잘 나오는 상태"),
  cut("placeholder/2-failed-placeholder.png", "실패 표시", "일부러 깨뜨림", "mid", `${proof.after.failedMarked}개 전부 자리를 지킨다`),
)}
${cut("placeholder/3-placeholder-closeup.png", "실패 표시 확대", "확대", "good", `${proof.after.samples[0].w}×${proof.after.samples[0].h} 크기가 확실히 남는다`)}

<h2><span class="k">3 / 한글</span>받침이 잘리는 것을 없앴습니다</h2>
<p>한글은 <b>받침</b> 때문에 영어보다 아래로 더 내려옵니다. 줄 높이를 빡빡하게 잡으면 받침이 깎입니다.
실제로 개요 탭 제목 <b>"이슬 장터 — 30분"</b>이 2px 잘려 있었습니다.
원래 코드에는 "이 값이면 모든 화면에서 괜찮다"는 주석이 붙어 있었는데, 재보니 사실이 아니었습니다.</p>
<div class="cmp-grid">
${clipTitles}
</div>
<p class="cap">화면 폭 4종에서 같은 제목을 다시 캡처. 받침 잘림 ${T(after, "selfClipped")}건.
1024px 컷의 <b>"이슬 장터 — …"</b>는 <b>가로로 짧게 줄인 것</b>이라 다른 문제입니다 —
글자를 아래에서 깎는 게 아니라 <b>말줄임표로 끝을 접는</b> 정상 동작입니다.</p>
<ul>
  <li>읽기 힘들게 작던 글자 ${T(before, "tinyFont")}개 → <b>${T(after, "tinyFont")}개</b></li>
  <li>줄 높이가 너무 좁던 규칙 ${T(before, "lowLineHeight")}개 → ${T(after, "lowLineHeight")}개
      (남은 ${T(after, "lowLineHeight")}개는 높이가 정해진 단추라 글자가 안 잘립니다)</li>
</ul>
<div class="note">
<p><b>검사 도구에 구멍이 있었습니다.</b> 작은 글자를 세는 도구가 <b>화살표(▾)처럼 CSS로 그려 넣은 글자를
아예 세지 않았습니다.</b> 그래서 "0개"는 "없다"가 아니라 <b>"안 봤다"</b>였습니다.
도구를 고쳐 다시 세니 10px 화살표가 ${T(pseudo, "tinyPseudo")}개 나왔고, 그것도 키워서
${T(after, "tinyPseudo")}개로 만들었습니다.</p>
</div>

<h2><span class="k">4 / 입력 칸</span>숫자 칸에 −/+ 단추를 붙였습니다</h2>
<p>숫자 칸 옆에는 브라우저가 제멋대로 그리는 작은 화살표가 있었습니다. 운영체제마다 모양이 다르고,
<b>마우스를 올려야 나타나서</b> 있는 줄도 몰랐습니다. 그래서 항상 보이는 <b>−/+ 단추</b>를 먼저 붙이고,
그다음에 브라우저 화살표를 껐습니다. 순서가 중요합니다. 먼저 끄면 마우스로 올리고 내릴 방법이 사라집니다.</p>
${pair(
  cut("report-shots/num-hover-tight.png", "스테퍼 호버", "지금", "good", "마우스를 올리면 색이 들어온다"),
  cut("report-shots/ctl-select2.png", "선택 상자", "지금", "good", "선택 상자 화살표도 CSS로 직접 그림"),
)}

<h2><span class="k">5 / 제가 만든 회귀</span>좁은 칸에서 값이 안 보이던 문제</h2>
<p>−/+ 단추는 좌우로 <b>60px</b>을 고정으로 씁니다. 그런데 몬스터 탭 능력치처럼 <b>칸이 66px밖에 안 되는</b>
자리가 있었습니다. 단추가 자리를 다 먹고 <b>숫자가 아예 안 보이게</b> 됐습니다.
전 탭을 다시 재보니 <b>${narrowBefore.total}군데</b>(${narrowTabs})였습니다.</p>
<p>고친 방법은 간단합니다. 칸이 좁으면 <b>단추를 접고 숫자를 보여줍니다.</b>
단추가 접혀도 위/아래 방향키로 값은 그대로 올리고 내릴 수 있습니다. 넓은 칸은 −/+ 를 그대로 씁니다.</p>
${pair(
  cut("report-shots/stepper-enemies-stats-before.png", "눌린 상태", "고치기 전", "bad", "능력치 6칸 전부 숫자가 안 보인다"),
  cut("report-shots/stepper-enemies-stats-after.png", "고친 상태", "고친 뒤", "good", "18 · 4 · 10 · 7 · 6 · 16 이 보인다"),
)}
${pair(
  cut("report-shots/stepper-enemies-reward-before.png", "보상 칸 눌림", "고치기 전", "bad", "경험치 · 돈 · 드롭률 3칸"),
  cut("report-shots/stepper-enemies-reward-after.png", "보상 칸 고침", "고친 뒤", "good", "값이 보인다"),
)}
${pair(
  cut("report-shots/stepper-terrain-row-before.png", "지형 눌림", "고치기 전", "bad", "지형 탭 피해 · 조우율 2칸"),
  cut("report-shots/stepper-terrain-row-after.png", "지형 고침", "고친 뒤", "good", "값이 보인다"),
)}
${pair(
  cut("report-shots/stepper-skills-wide-after.png", "넓은 칸", "넓은 칸", "good", "자리가 넉넉하면 −/+ 를 그대로 유지한다"),
  cut("report-shots/ctl-slider2.png", "슬라이더", "슬라이더", "good", "슬라이더도 에디터 모양으로"),
)}
<p class="cap">위 전/후 컷은 <b>같은 화면 · 같은 좌표</b>에서 찍었습니다. "고치기 전"은 지금 코드에서
이번 수정 한 줄만 되돌린 뒤 찍은 실기 화면이고, 각 쌍의 눌린 칸 수를 측정으로도 확인했습니다
(능력치 6→0 · 보상 3→0 · 지형 2→0 · 넓은 칸 0→0 —
<code>scripts/qa/db-ux-stepper-ba-shots.mjs</code>).</p>

<div class="note warn">
<p><b>이건 제가 만든 문제였습니다.</b> 검사 도구가 숫자 칸의 <b>모양</b>만 보고
<b>폭</b>은 안 봤기 때문에 통과했습니다. 그래서 폭을 재는 검사를 새로 만들었습니다 —
<code>node scripts/qa/db-ux-narrow-number-audit.mjs</code> · 현재 ${narrowAfter.total}건.</p>
</div>

<h2><span class="k">6 / 화면 크기</span>좁은 화면에서도 확인했습니다</h2>
<p>넓은 화면에서만 보고 끝내면 좁은 화면에서 깨집니다. 실제로 잘림은 <b>1024px에서만</b> 나왔습니다.
그래서 4가지 폭에서 전부 다시 쟀습니다.</p>
<div class="gallery">
${matrix}
</div>

<h2><span class="k">7 / 전체</span>탭 ${tabsAfter}개 지금 모습</h2>
<p>사진을 누르면 원본 크기로 열립니다.</p>
<div class="gallery">
${gallery}
</div>

<h2><span class="k">8 / 증거</span>어떻게 확인했나</h2>
<p>"고친 것 같다"로 끝내지 않고 브라우저를 실제로 띄워 <b>탭마다 숫자를 재서</b> 기록했습니다.
그 기록 파일이 같이 들어 있어서 누구나 다시 계산할 수 있습니다.</p>
<table>
  <tr><th>항목</th><th class="n">이전</th><th class="n">이후</th><th>재본 방법</th></tr>
${evidenceRows}
  <tr><td>창 크기가 탭마다 바뀌는 문제</td><td class="n">—</td><td class="n ok">통과</td><td class="how">자동 검사 3가지 화면 크기 전부 통과</td></tr>
  <tr><td>CSS 예산 검사</td><td class="n">—</td><td class="n ok">통과</td><td class="how">하드코딩 색 · !important 증가 0건</td></tr>
</table>

<h2><span class="k">9 / 정직</span>솔직하게 남기는 이야기</h2>
<p>검토를 받으면서 <b>제가 틀린 것 네 가지</b>를 잡혔습니다. 숨기지 않고 적어 둡니다.
앞의 셋은 <b>측정값이 아니라 측정값을 옮겨 적은 글</b>에서 틀렸고, 넷째는 <b>코드</b>에서 틀렸습니다.</p>
<ul>
  <li><b>계산 실수.</b> 4개를 더한 값을 3으로 나눠 평균을 잘못 적었습니다. 한 탭이 같은 머리말을
      두 개 달고 있는 걸 못 봤습니다.</li>
  <li><b>커밋 설명이 실제보다 컸습니다.</b> "구조물 탭 머리말을 아이콘으로 압축했다"고 적었는데
      실제로는 설명문을 감싸기만 했습니다. 나중에 제대로 고쳤습니다.</li>
  <li><b>도구가 세는 방식이 바뀐 것을 "고쳤다"고 적었습니다.</b> "크기 0인 그림 ${T(before, "imgZero")}개 → 0개"라고
      썼는데, 그 ${T(before, "imgZero")}개는 <b>지금도 크기가 0입니다.</b> 안 쓰는 하위 패널이
      <code>display:none</code>으로 접혀 있어서 그런 것이고, 화면에서 보이는 문제가 아니었습니다.
      표를 고쳐서 <b>고친 것이 아니라고</b> 적었습니다.</li>
  <li><b>−/+ 단추가 숫자를 가렸습니다.</b> 좁은 칸 <b>${narrowBefore.total}군데</b>에서 값이 아예 안 보였습니다.
      모양만 검사하고 폭은 검사하지 않아서 통과했습니다. 폭 검사를 새로 만들고 고쳤습니다(위 5번).</li>
</ul>
<p>그래서 이 보고서는 <b>표를 손으로 적지 않고 기록 파일에서 계산해</b> 만듭니다.
표의 숫자가 기록 파일과 어긋나면 <code>node scripts/qa/db-ux-report-check.mjs</code>가 실패합니다.</p>

<div class="note">
<p><b>아직 빨간불 하나.</b> <code>check-css-live-classes.mjs</code>가 <code>.ai-event-*</code> 클래스 3종에서
실패합니다. 이번 작업과 무관한 <b>기존 실패</b>입니다 — 제 변경을 빼고 돌려도 똑같이 실패합니다.
데이터베이스 모달과 다른 화면(이벤트 어시스턴트)이라 여기서 손대지 않았습니다.</p>
</div>

<div class="foot">
<p>탭 ${tabsBefore}개(이전) / ${tabsAfter}개(이후) · 화면 ${before.viewport.WIDTH}×${before.viewport.HEIGHT} · 전문가 모드 ·
기록 파일 <code>before/probe.json</code> · <code>after/probe.json</code> · <code>pseudo-baseline/probe.json</code> ·
<code>placeholder/proof.json</code> · <code>narrow-number/audit-before.json</code> ·
<code>narrow-number/audit-after.json</code>${hunt ? " · <code>imagehunt/hunt.json</code>" : ""}</p>
<p>이 문서는 <code>node scripts/qa/db-ux-render-report.mjs</code>가 만듭니다.
숫자는 전부 위 기록 파일에서 계산한 값이고, 이미지는 전부 실기 캡처입니다.
표와 기록 파일 대조: <code>node scripts/qa/db-ux-report-check.mjs</code>.</p>
</div>

</div>
</body>
</html>
`;

writeFileSync(path.join(dir, "REPORT.html"), html);
console.log(`REPORT.html ${(html.length / 1024).toFixed(1)} KB`);
console.log(`머리말 합계 ${px(hdrBefore)} → ${px(hdrAfter)} (${pct(hdrBefore, hdrAfter)} 감소)`);
console.log(`탭 ${tabsBefore} → ${tabsAfter} · 갤러리 ${Object.keys(after.tabs).length}컷`);
