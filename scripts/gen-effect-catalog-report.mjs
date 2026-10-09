#!/usr/bin/env node
// "이 엔진에 이펙트가 뭐가 있냐" 에 답하는 카탈로그 보고서.
//
// 앞선 두 보고서는 **결함**을 다뤘다(effect-audit = 수정 전, effect-p0-fix = 수정 후).
// 이건 다른 질문에 답한다: 감독이 실제로 쓸 수 있는 이펙트가 무엇이고 어떻게 생겼는가.
//
// 정지 컷으로는 답이 안 된다 — 전투 이펙트는 CSS `steps()` 로 **실제 재생**시킨다.
// 재생 속도는 런타임과 같은 120ms/프레임이고, 4배 느리게 보는 토글을 둔다.
//
// 입력:
//   output/evidence/effect-report/          레코드 필름 + 시트 + shake 표
//   output/evidence/screen-effect-renders/  화면효과 before/after
//
// 실행: node scripts/gen-effect-catalog-report.mjs
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const EFF = "output/evidence/effect-report";
const REN = "output/evidence/screen-effect-renders";
const OUT = "reports/effect-catalog-2026-08-21.html";

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback);
const dataUri = (path) => (existsSync(path) ? `data:image/png;base64,${readFileSync(path).toString("base64")}` : null);
const esc = (value) => String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const pct = (ratio) => `${(ratio * 100).toFixed(2)}%`;

const meta = readJson(join(EFF, "meta.json"), { sheets: [], records: [], shakeTable: [] });
const renders = existsSync(REN)
  ? readdirSync(REN).filter((n) => n.endsWith(".json")).map((n) => ({ id: n.replace(/\.json$/, ""), ...readJson(join(REN, n), {}) }))
  : [];

/** 재생되는 필름 한 칸. steps(n) 으로 배경을 넘긴다. */
function filmBox(record, flashed) {
  const src = dataUri(join(EFF, `record-${record.id}-film${flashed ? "-flash" : ""}.png`));
  if (!src) return `<div class="missing">필름 미생성</div>`;
  const n = record.frames;
  const cell = record.filmCellPx;
  const height = record.filmHeightPx;
  return `<div class="film film-${n}" style="
    --film-dur:${record.durationMs}ms; --film-w:${cell * n}px;
    width:${cell}px; height:${height}px;
    background-image:url(${src});
    background-size:${cell * n}px ${height}px;"></div>`;
}

const battleRecords = meta.records ?? [];
const starter = battleRecords.filter((r) => !r.id.startsWith("anim_scarloxy"));
const scarloxy = battleRecords.filter((r) => r.id.startsWith("anim_scarloxy"));

function recordCard(record) {
  const swatch = record.flash
    ? `<span class="swatch" style="background:${esc(record.flash)}"></span><span class="sub">${esc(record.flashLabel)}</span>`
    : `<span class="sub">${esc(record.flashLabel)}</span>`;
  return `
  <div class="rec">
    <div class="rec-head">
      <strong>${esc(record.name)}</strong> <code>${esc(record.id)}</code>
      <span class="sub">${record.frames}프레임 · ${record.durationMs}ms · ${esc(record.sheet)} 패턴 [${record.patterns.join(", ")}]</span>
    </div>
    <div class="film-row">
      <div><span class="tag">이펙트 그림만</span>${filmBox(record, false)}</div>
      ${record.flash ? `<div><span class="tag">화면 플래시까지 (수정 후)</span>${filmBox(record, true)}</div>` : ""}
    </div>
    <div class="rec-flash">flash 색 · ${swatch}</div>
  </div>`;
}

const screenShots = renders.map((entry) => {
  const before = dataUri(join(REN, `${entry.id}-before.png`));
  const after = dataUri(join(REN, `${entry.id}-after.png`));
  if (!before || !after) return "";
  return `
  <figure class="ba">
    <figcaption><strong>${esc(entry.label)}</strong> <code>${esc(entry.effect)}</code>
      <span class="note">픽셀 변화 ${pct(entry.changedRatio)}</span></figcaption>
    <div class="ba-pair">
      <div><span class="tag">실행 전</span><img src="${before}" alt=""></div>
      <div><span class="tag">실행 후</span><img src="${after}" alt=""></div>
    </div>
  </figure>`;
}).join("");

const sheetSection = (meta.sheets ?? []).map((sheet) => {
  const image = dataUri(join(EFF, `sheet-${sheet.id}-full.png`));
  return `<div class="sheet">
    <div class="rec-head"><strong>${esc(sheet.id)}</strong>
      <span class="sub">${sheet.width}×${sheet.height} · ${sheet.patterns}칸</span></div>
    ${image ? `<img class="sheetimg" src="${image}" alt="">` : ""}
  </div>`;
}).join("");

const html = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<title>oprn 이펙트 카탈로그 — 실제로 뭐가 있나</title>
<style>
  :root { --bg:#14141a; --panel:#1d1d26; --panel2:#24242f; --line:#33333f;
    --fg:#e8e8ef; --dim:#9a9aab; --ok:#51cf66; --bad:#ff6b6b; --warn:#ffd43b; --accent:#3bc9db; --speed:1; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
    font:15px/1.65 "Pretendard","Segoe UI",system-ui,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; padding:48px 28px 96px; }
  h1 { font-size:30px; margin:0 0 6px; letter-spacing:-.02em; }
  h2 { font-size:21px; margin:56px 0 14px; padding-bottom:9px; border-bottom:2px solid var(--line); }
  h3 { font-size:16px; margin:28px 0 10px; color:var(--accent); }
  .lede { color:var(--dim); margin:0 0 30px; }
  code { background:#0e0e14; padding:1px 6px; border-radius:4px; font-size:.88em;
    font-family:"Cascadia Code",Consolas,monospace; color:#c9d7e4; }
  table { width:100%; border-collapse:collapse; margin:14px 0 24px; font-size:14px; }
  th,td { padding:9px 12px; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--dim); font-weight:600; font-size:12.5px; text-transform:uppercase; letter-spacing:.04em; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; }
  .ok { color:var(--ok); font-weight:600; } .bad { color:var(--bad); font-weight:600; }
  .sub { color:var(--dim); font-size:12.5px; }
  .note { color:var(--dim); font-weight:400; font-size:13px; }
  .missing { color:var(--warn); background:rgba(255,212,59,.08); border:1px dashed rgba(255,212,59,.35);
    padding:12px 14px; border-radius:8px; margin:12px 0; font-size:14px; }
  .callout { background:var(--panel); border-left:4px solid var(--accent);
    padding:16px 20px; border-radius:0 10px 10px 0; margin:18px 0; }
  .callout.warn { border-left-color:var(--warn); }
  .callout p { margin:6px 0; }

  /* 재생 — 런타임과 같은 120ms/프레임. steps() 라 보간 없이 딱딱 넘어간다. */
  .film { image-rendering:pixelated; border-radius:8px; border:1px solid var(--line);
    background-repeat:no-repeat; animation-iteration-count:infinite; animation-timing-function:steps(1); }
  .film-3 { animation-name:film3; animation-timing-function:steps(3);
    animation-duration:calc(var(--film-dur) * var(--speed)); }
  .film-4 { animation-name:film4; animation-timing-function:steps(4);
    animation-duration:calc(var(--film-dur) * var(--speed)); }
  /* background-position 의 % 는 요소 폭이 아니라 (컨테이너 - 이미지) 기준이라
     칸 수만큼 정확히 밀어낼 수 없다. 총 필름 폭을 px 변수로 받아 그만큼 민다. */
  @keyframes film3 { to { background-position-x:calc(-1 * var(--film-w)); } }
  @keyframes film4 { to { background-position-x:calc(-1 * var(--film-w)); } }
  @media (prefers-reduced-motion: reduce) { .film { animation:none; } }

  .controls { position:sticky; top:0; z-index:5; background:rgba(20,20,26,.94);
    backdrop-filter:blur(6px); border:1px solid var(--line); border-radius:10px;
    padding:10px 16px; margin:0 0 22px; display:flex; gap:18px; align-items:center; flex-wrap:wrap; }
  .controls label { display:flex; gap:7px; align-items:center; font-size:14px; cursor:pointer; }
  body:has(#slow:checked) { --speed:4; }
  body:has(#pause:checked) .film { animation-play-state:paused; }

  .rec { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; margin:14px 0; }
  .rec-head { margin-bottom:12px; display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; }
  .film-row { display:flex; gap:20px; flex-wrap:wrap; }
  .tag { display:block; font-size:11.5px; color:var(--dim); margin-bottom:6px;
    text-transform:uppercase; letter-spacing:.05em; }
  .rec-flash { margin-top:12px; font-size:13.5px; color:var(--dim); display:flex; align-items:center; gap:8px; }
  .swatch { display:inline-block; width:22px; height:14px; border-radius:3px; border:1px solid rgba(255,255,255,.35); }
  .sheet { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; margin:14px 0; }
  img.sheetimg { display:block; max-width:100%; image-rendering:pixelated; border-radius:8px; border:1px solid var(--line); }
  figure.ba { margin:20px 0; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; }
  figure.ba figcaption { margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:baseline; }
  .ba-pair { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .ba-pair img { width:100%; border-radius:8px; border:1px solid var(--line); display:block; background:#000; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin:22px 0 8px; }
  .kpi { background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .kpi b { display:block; font-size:26px; line-height:1.2; }
  .kpi span { color:var(--dim); font-size:12.5px; }
  ul,ol { padding-left:22px; } li { margin:5px 0; }
  .footer { margin-top:64px; padding-top:18px; border-top:1px solid var(--line); color:var(--dim); font-size:13px; }
</style>
<div class="wrap">

<h1>이펙트 카탈로그 — 실제로 뭐가 있나</h1>
<p class="lede">2026-08-21 · 아래 전투 이펙트는 <b>정지 이미지가 아니라 실제로 재생된다</b>.
속도는 런타임과 같은 120ms/프레임이다.</p>

<div class="callout warn">
  <p><strong>먼저 분명히 — 나는 새 이펙트를 하나도 만들지 않았다.</strong></p>
  <p class="sub">이번 작업은 <b>끊긴 배선을 이은 것</b>이다. 감독이 에디터에서 넣은 값이 화면에
  도달하지 않던 문제를 고쳤을 뿐, 그림·시트·연출을 새로 그리지는 않았다.
  아래는 <b>원래부터 이 엔진에 있던</b> 이펙트 전부다.</p>
</div>

<div class="controls">
  <label><input type="checkbox" id="slow"> 4배 느리게 (프레임 확인용)</label>
  <label><input type="checkbox" id="pause"> 정지</label>
  <span class="sub">기본 재생 속도 = 런타임과 동일(120ms/프레임)</span>
</div>

<div class="kpis">
  <div class="kpi"><b>${battleRecords.length}</b><span>전투 이펙트 레코드</span></div>
  <div class="kpi"><b>${(meta.sheets ?? []).length}</b><span>이펙트 시트(그림 원본)</span></div>
  <div class="kpi"><b>${renders.length}</b><span>화면효과 종류</span></div>
  <div class="kpi"><b class="bad">0</b><span>이번에 새로 만든 이펙트</span></div>
</div>

<h2>1. "이펙트" 의 정체 — 종이 넘기기다</h2>
<p>파티클 시스템도 셰이더도 아니다. PNG 한 장을 96×96 칸으로 자르고, 칸을 순서대로 넘긴다.</p>
<pre style="background:#0e0e14;border:1px solid var(--line);border-radius:8px;padding:14px;overflow:auto;font-size:13px;line-height:1.7"><code>시트 PNG  →  96×96 칸으로 자름  →  칸 하나 = 셀
셀에 위치·크기·투명도 지정  →  프레임 하나
프레임을 120ms 간격으로 넘김  →  "이펙트"
＋ 프레임별로 화면 번쩍임 / 흔들림 / 효과음을 얹을 수 있다</code></pre>
<p>마지막 줄(번쩍임·흔들림)이 <b>이번에 고친 부분</b>이다. 저작은 되는데 화면에 도달하지 않았다.</p>

<h2>2. 스타터 프로젝트가 쓰는 이펙트 ${starter.length}종</h2>
<p>새 프로젝트를 만들면 이게 전부다. 왼쪽은 그림만, 오른쪽은 화면 플래시까지 얹힌 모습이다.</p>
${starter.map(recordCard).join("")}

<h2>3. Scarloxy 팩 이펙트 ${scarloxy.length}종</h2>
<p>유일한 4프레임짜리다. <b>스타터 프로젝트에서는 참조되지 않고</b>,
<code>scarloxyDemoGame</code> · <code>scarloxyPokemonDemoGame</code> 두 데모에서만 쓰인다(총 13건).</p>
${scarloxy.map(recordCard).join("")}

<h2>4. 그림 원본 — 시트 ${(meta.sheets ?? []).length}장</h2>
<p>위 이펙트들이 잘라 쓰는 원본이다. Blow / Sword1 은 15칸짜리인데 앞의 3칸만 쓴다 —
새 그림 없이도 변형을 뽑을 여지가 남아 있다.</p>
${sheetSection}

<h2>5. 화면 전체에 거는 효과 ${renders.length}종</h2>
<p>이건 애니메이션 레코드가 아니라 <b>이벤트 커맨드</b>다. 맵에서든 전투에서든 화면 전체에 건다.</p>
${screenShots || '<div class="missing">미수집</div>'}

<h2>6. 없는 것 — 정직하게</h2>
<table>
  <thead><tr><th>기대할 만한 것</th><th>상태</th></tr></thead>
  <tbody>
    <tr><td>파티클 시스템(불꽃·연기 시뮬레이션)</td><td><span class="bad">없음</span> — 미리 그린 시트뿐</td></tr>
    <tr><td>셰이더 / 블러 / 왜곡</td><td><span class="bad">없음</span> — blur 옵션은 렌더러가 없어 피커에서 내렸다</td></tr>
    <tr><td>프레임별 가변 길이</td><td><span class="bad">없음</span> — 전 프레임 120ms 고정</td></tr>
    <tr><td>이펙트 회전</td><td><span class="bad">없음</span> — 셀은 위치·크기·투명도·색조만</td></tr>
    <tr><td>셀 색조(tone)</td><td><span class="bad">저작만 됨</span> — 렌더러가 아직 안 읽는다</td></tr>
    <tr><td>flash 대상 분리</td><td><span class="bad">미구현</span> — "대상만 번쩍" 도 화면 전체가 번쩍인다</td></tr>
    <tr><td>동시 재생(전체공격)</td><td><span class="bad">없음</span> — 타깃마다 순차라 3마리면 약 4.3초</td></tr>
    <tr><td>이펙트 제작 파이프라인</td><td><span class="bad">없음</span> — 칩셋·몬스터·작물 생성기는 있는데 애니메이션만 없다</td></tr>
  </tbody>
</table>

<h2>7. 그래서 내가 한 것</h2>
<table>
  <thead><tr><th>고친 것</th><th>전</th><th>후</th></tr></thead>
  <tbody>
    <tr><td>Screen Effect 5옵션이 화면을 바꾸는가</td><td class="num"><span class="bad">0.00%</span></td><td class="num"><span class="ok">75.27%</span></td></tr>
    <tr><td>shake 다이얼 구분되는 단계</td><td class="num"><span class="bad">3 / 4</span></td><td class="num"><span class="ok">4 / 4</span></td></tr>
    <tr><td>타격·마법충격·회복빛 구분</td><td><span class="bad">셋 다 동일</span></td><td><span class="ok">흰색·파랑·초록</span></td></tr>
    <tr><td>Ctrl+Z 피드백</td><td><span class="bad">침묵</span></td><td><span class="ok">토스트 + 라벨</span></td></tr>
  </tbody>
</table>
<p class="sub">자세한 근거는 <code>reports/effect-audit-2026-08-21.html</code>(수정 전) ·
<code>reports/effect-p0-fix-2026-08-21.html</code>(수정 후).</p>

<div class="footer">
  생성: <code>node scripts/gen-effect-catalog-report.mjs</code> · 증거: <code>${EFF}</code> · <code>${REN}</code>
</div>
</div>
</html>`;

mkdirSync("reports", { recursive: true });
writeFileSync(OUT, html, "utf8");
console.log(`보고서: ${OUT} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  재생되는 이펙트 ${battleRecords.length}종 · 시트 ${(meta.sheets ?? []).length}장 · 화면효과 ${renders.length}종`);
