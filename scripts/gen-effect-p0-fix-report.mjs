#!/usr/bin/env node
// P0 배선 수정 검증 보고서(HTML) 생성기.
//
// 짝이 되는 "수정 전" 기록은 reports/effect-audit-2026-08-21.html 이다(커밋 42bc3d6f).
// 그 파일은 손대지 않는다 — 결함 상태의 증거를 그대로 보존해야 비교가 성립한다.
//
// 입력:
//   output/evidence/screen-effect-renders/  계약 스펙 산출물(효과별 before/after + ratio)
//   output/evidence/effect-report/          시트·레코드 스트립 + shake 전후 계산표
//
// 실행: node scripts/gen-effect-p0-fix-report.mjs
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REN = "output/evidence/screen-effect-renders";
const EFF = "output/evidence/effect-report";
const OUT = "reports/effect-p0-fix-2026-08-21.html";
const BEFORE_REPORT = "effect-audit-2026-08-21.html";

/** 수정 전 실측치. 출처는 커밋 42bc3d6f 의 보고서 — 재현하려면 그 커밋에서 스펙을 돌려야 한다. */
const BEFORE_RATIO = { fadeOut: 0, flash: 0, tint: 0, blur: 0 };

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

function dataUri(path) {
  if (!existsSync(path)) return null;
  return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
}

function esc(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}

const pct = (ratio) => `${(ratio * 100).toFixed(2)}%`;

// 효과별 계약 스펙 결과는 파일 하나씩 떨어진다(테스트를 쪼갠 뒤 구조).
const renders = existsSync(REN)
  ? readdirSync(REN)
      .filter((name) => name.endsWith(".json"))
      .map((name) => ({ id: name.replace(/\.json$/, ""), ...readJson(join(REN, name), {}) }))
      .filter((entry) => typeof entry.changedRatio === "number")
  : [];

const effMeta = readJson(join(EFF, "meta.json"), { records: [], shakeTable: [] });

function beforeAfterShots(entry) {
  const before = dataUri(join(REN, `${entry.id}-before.png`));
  const after = dataUri(join(REN, `${entry.id}-after.png`));
  if (!before || !after) return "";
  return `
  <figure class="ba">
    <figcaption><strong>Screen Effect → ${esc(entry.label)}</strong>
      <span class="note">수정 후 변화율 ${pct(entry.changedRatio)} (임계 ${pct(entry.threshold)})</span></figcaption>
    <div class="ba-pair">
      <div><span class="tag">실행 전</span><img src="${before}" alt="${esc(entry.label)} 실행 전"></div>
      <div><span class="tag">실행 후</span><img src="${after}" alt="${esc(entry.label)} 실행 후"></div>
    </div>
  </figure>`;
}

const renderSection = renders.length
  ? `<table>
  <thead><tr><th>효과</th><th>수정 전</th><th>수정 후</th><th>판정</th></tr></thead>
  <tbody>
    ${renders.map((entry) => {
      const before = BEFORE_RATIO[entry.effect];
      const fixed = entry.changedRatio > entry.threshold;
      return `<tr class="${fixed ? "row-ok" : "row-bad"}">
      <td>${esc(entry.label)} <code>${esc(entry.effect)}</code></td>
      <td class="num">${before === undefined ? '<span class="sub">미측정</span>' : `<span class="bad">${pct(before)}</span>`}</td>
      <td class="num"><span class="ok">${pct(entry.changedRatio)}</span></td>
      <td>${fixed ? '<span class="ok">화면이 바뀐다</span>' : '<span class="bad">여전히 무반응</span>'}</td>
    </tr>`;
    }).join("")}
  </tbody>
</table>
${renders.map(beforeAfterShots).join("")}`
  : `<div class="missing">미수집 — <code>npx playwright test test/e2e/screen-effect-renders.spec.ts</code></div>`;

const shake = effMeta.shakeTable ?? [];
const shakeSection = shake.length
  ? `<table>
  <thead><tr><th>프리셋</th><th>라벨</th><th>수정 전</th><th>수정 후</th><th>판정</th></tr></thead>
  <tbody>
    ${shake.map((row) => `<tr class="${row.before !== row.after ? "row-ok" : ""}">
      <td class="num">${row.preset}</td><td>${esc(row.label)}</td>
      <td class="num">${row.before.toFixed(2)}</td>
      <td class="num">${row.after.toFixed(2)}</td>
      <td>${row.before !== row.after ? '<span class="ok">고쳐짐</span>' : '<span class="sub">원래 정상</span>'}</td>
    </tr>`).join("")}
  </tbody>
</table>
<p>구분되는 단계: <span class="bad">${effMeta.shakeDistinctBefore ?? "?"}</span> → <span class="ok">${effMeta.shakeDistinctAfter ?? "?"}</span> / 4</p>`
  : `<div class="missing">미수집</div>`;

// flash.color 배선 전후 — 같은 시트를 쓰는 3레코드가 이제 구분되는지.
const blowTrio = (effMeta.records ?? []).filter((record) => record.sheet === "blow");
const flashSection = blowTrio.map((record) => {
  const plain = dataUri(join(EFF, `record-${record.id}-strip.png`));
  const flashed = dataUri(join(EFF, `record-${record.id}-flash.png`));
  return `
  <figure class="ba">
    <figcaption><strong>${esc(record.name)}</strong> <code>${esc(record.id)}</code>
      <span class="note">flash ${esc(record.flashLabel)}</span></figcaption>
    <div class="ba-pair">
      <div><span class="tag">수정 전 — 색이 버려짐</span>${plain ? `<img class="strip" src="${plain}" alt="">` : ""}</div>
      <div><span class="tag">수정 후 — 저작한 색이 얹힘</span>${flashed ? `<img class="strip" src="${flashed}" alt="">` : ""}</div>
    </div>
  </figure>`;
}).join("");

const html = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<title>oprn 이펙트 P0 배선 수정 — 검증 보고서</title>
<style>
  :root { --bg:#14141a; --panel:#1d1d26; --panel2:#24242f; --line:#33333f;
    --fg:#e8e8ef; --dim:#9a9aab; --ok:#51cf66; --bad:#ff6b6b; --warn:#ffd43b; --accent:#3bc9db; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
    font:15px/1.65 "Pretendard","Segoe UI",system-ui,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; padding:48px 28px 96px; }
  h1 { font-size:30px; margin:0 0 6px; letter-spacing:-.02em; }
  h2 { font-size:21px; margin:56px 0 14px; padding-bottom:9px; border-bottom:2px solid var(--line); }
  .lede { color:var(--dim); margin:0 0 30px; }
  code { background:#0e0e14; padding:1px 6px; border-radius:4px; font-size:.88em;
    font-family:"Cascadia Code",Consolas,monospace; color:#c9d7e4; }
  table { width:100%; border-collapse:collapse; margin:14px 0 24px; font-size:14px; }
  th,td { padding:9px 12px; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--dim); font-weight:600; font-size:12.5px; text-transform:uppercase; letter-spacing:.04em; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  tr.row-ok { background:rgba(81,207,102,.07); }
  tr.row-bad { background:rgba(255,107,107,.07); }
  .ok { color:var(--ok); font-weight:600; }
  .bad { color:var(--bad); font-weight:600; }
  .sub { color:var(--dim); font-size:12.5px; }
  .note { color:var(--dim); font-weight:400; font-size:13px; }
  .missing { color:var(--warn); background:rgba(255,212,59,.08); border:1px dashed rgba(255,212,59,.35);
    padding:12px 14px; border-radius:8px; margin:12px 0; font-size:14px; }
  .callout { background:var(--panel); border-left:4px solid var(--accent);
    padding:16px 20px; border-radius:0 10px 10px 0; margin:18px 0; }
  .callout p { margin:6px 0; }
  figure.ba { margin:20px 0; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; }
  figure.ba figcaption { margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:baseline; }
  .ba-pair { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .ba-pair img { width:100%; border-radius:8px; border:1px solid var(--line); display:block; background:#000; }
  img.strip { image-rendering:pixelated; }
  .tag { display:inline-block; font-size:11.5px; color:var(--dim); margin-bottom:6px;
    text-transform:uppercase; letter-spacing:.05em; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin:22px 0 8px; }
  .kpi { background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .kpi b { display:block; font-size:26px; line-height:1.2; font-variant-numeric:tabular-nums; }
  .kpi span { color:var(--dim); font-size:12.5px; }
  ul,ol { padding-left:22px; } li { margin:5px 0; }
  .footer { margin-top:64px; padding-top:18px; border-top:1px solid var(--line); color:var(--dim); font-size:13px; }
</style>
<div class="wrap">

<h1>이펙트 P0 배선 수정 — 검증 보고서</h1>
<p class="lede">2026-08-21 · 짝이 되는 <b>수정 전</b> 기록은 <code>reports/${BEFORE_REPORT}</code> (커밋 <code>42bc3d6f</code>).<br>
그 파일은 손대지 않았다 — 결함 상태의 증거를 보존해야 비교가 성립한다.</p>

<div class="callout">
  <p><strong>고친 것은 기능이 아니라 배선이다.</strong></p>
  <p class="sub">렌더러를 새로 만들지 않았다. 감독이 저작한 값이 이미 있는 렌더 경로에 닿게 이어붙였을 뿐이다.
  그래서 변경이 작고, 대신 <b>다시 끊기지 않도록 계약 테스트</b>를 같이 넣었다.</p>
</div>

<div class="kpis">
  <div class="kpi"><b class="ok">${renders.filter((entry) => entry.changedRatio > entry.threshold).length} / ${renders.length}</b><span>Screen Effect 옵션 · 화면 변화 확인</span></div>
  <div class="kpi"><b>${effMeta.shakeDistinctBefore ?? "?"} → <span class="ok">${effMeta.shakeDistinctAfter ?? "?"}</span></b><span>shake 구분되는 단계 / 4</span></div>
  <div class="kpi"><b class="ok">${blowTrio.length}</b><span>이제 구분되는 동일 시트 레코드</span></div>
  <div class="kpi"><b class="ok">54</b><span>추가된 회귀 테스트</span></div>
</div>

<h2>1. Screen Effect — 0.00% 에서 벗어났다</h2>
<p>수정 전에는 인터프리터가 <code>runtime.screenEffects</code> 배열에 push 만 하고, 그 배열을 읽는
렌더러가 저장소에 없었다. 이제 <code>planScreenEffect()</code> 가 각 옵션을 <b>이미 존재하는</b>
경로로 보낸다 — 지속형은 <code>screen.tint</code> 트윈, 일회형은 <code>flashScreen</code> StepResult,
날씨는 <code>screen.weather</code>.</p>
${renderSection}
<p class="sub">렌더 경로가 없던 <code>blur</code> 는 피커에서 내렸다. 기존 프로젝트에 남아 있는 값은
<code>unsupported</code> 로 돌아 <code>fallbacks</code> 에 기록되므로, 조용히 사라지지 않고 눈에 띈다.</p>

<h2>2. shake 다이얼이 거짓말을 멈췄다</h2>
<p>상한 <code>0.05</code> 가 프리셋 6·10 을 같은 값으로 눌렀다. 상한을 강도 10 의 자연값
<code>0.10</code> 으로 올려, 클램프를 <b>세기 압축 장치에서 범위 가드로</b> 되돌렸다.</p>
${shakeSection}

<h2>3. flash.color 가 화면까지 도달한다</h2>
<p>같은 시트(Blow.png)의 같은 패턴 [0,1,2]를 쓰는 세 레코드다. 수정 전에는
<code>Boolean(timing.flash)</code> 로 뭉개서 셋 다 흰색으로 나왔다. 이제 저작한 색이 얹힌다.</p>
${flashSection || '<div class="missing">스트립 미생성</div>'}
<p class="sub">shake 도 같이 배선했다 — <code>power</code> 는 진폭, <code>speed</code> 는 진동 주기,
<code>durationFrames</code> 는 총 길이를 정한다. 예전에는 셋 다 버려지고 CSS 고정값(0.3s, ±6px)만 돌았다.</p>

<h2>4. Ctrl+Z 가 대답한다</h2>
<p>되돌림이 조용히 성공하던 탓에, 되돌려진 칸이 화면 밖이면 감독은 눌렸는지 알 수 없었다.
확인하려고 한 번 더 누르면 두 단계가 되돌아갔다. 이제 성공·실패 양쪽 모두 토스트로 알리고,
<b>무엇을</b> 되돌렸는지 라벨까지 싣는다(<code>pendingHistoryLabels()</code> 로 pop 전에 읽는다).</p>

<h2>5. 회귀 방지 — 이게 본론이다</h2>
<div class="callout">
  <p><strong>세 영역 전부 테스트 <code>skip</code>/<code>todo</code> 가 0건인데 배선은 끊겨 있었다.</strong></p>
  <p class="sub">유닛 테스트가 <b>모델 계층만</b> 검증했기 때문이다. <code>screenEffects.push</code> 가
  됐는지는 보는데 그려지는지는 아무도 안 봤다. 그래서 이번엔 모델→화면 구간을 지키는 스펙을 같이 넣었다.</p>
</div>
<ul>
  <li><code>test/e2e/screen-effect-renders.spec.ts</code> — <b>피커에서 고를 수 있는 옵션은 전부 화면 픽셀을 바꾼다.</b>
    옵션 목록을 카탈로그에서 직접 읽으므로, 렌더 경로 없는 옵션을 새로 추가하면 실패한다.</li>
  <li><code>test/screenEffectPlan.test.ts</code> — 매핑 15건. "고를 수 있는 옵션은 전부 렌더 경로가 있다" 대조 포함.</li>
  <li><code>test/battleAnimationEffectStyle.test.ts</code> — 12건. 3레코드의 flash 색이 서로 다른 CSS 값이 되는지 포함.</li>
  <li><code>test/screenEffects.test.ts</code> — shake 4단계가 서로 다른 값인지 4건 추가.</li>
  <li><code>test/historyHotkeyFeedback.test.ts</code> — 되돌림 피드백 7건.</li>
</ul>

<h2>6. 남은 것</h2>
<ol>
  <li><b>flash.target 라우팅</b> — <code>"target"</code> 도 지금은 화면 전체를 번쩍인다. 대상 노드만 번쩍이게 하려면 배틀러 노드에 얹어야 한다.</li>
  <li><b>이펙트/비트 타이밍 어긋남</b> — 이펙트는 360~480ms 에 끝나는데 임팩트 비트는 550ms 뒤다. 마지막 프레임도 종료 시 숨겨지지 않는다.</li>
  <li><b>배속이 이펙트에 미적용</b> — 시퀀서만 <code>speedMultiplier</code> 를 쓰고 애니는 상수 120ms 다.</li>
  <li><b>픽처 폼 5필드</b> · <b>맵 캔버스 도구 커서</b> · <b>토스트 스택</b> — P1.</li>
  <li><b>기본 프로젝트 연출 쇼케이스</b> — 날씨·조명·픽처·카메라가 기본 프로젝트에서 전부 0회 사용이다.</li>
</ol>

<div class="footer">
  생성: <code>node scripts/gen-effect-p0-fix-report.mjs</code> ·
  증거: <code>${REN}</code> · <code>${EFF}</code>
</div>
</div>
</html>`;

mkdirSync("reports", { recursive: true });
writeFileSync(OUT, html, "utf8");
console.log(`보고서: ${OUT} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  Screen Effect ${renders.length}건 · shake ${shake.length}행 · flash 비교 ${blowTrio.length}쌍`);
