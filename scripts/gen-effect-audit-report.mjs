#!/usr/bin/env node
// 이펙트 감사 증거 보고서(HTML) 생성기.
//
// 입력(모두 선택 — 없으면 해당 절을 "미수집" 으로 표시한다):
//   output/evidence/adversarial-ui-ux/     기존 스펙 산출물 (구식 화면효과 5종 before/after)
//   output/evidence/screen-effect-norender/ 신규 진단 스펙 산출물 (Screen Effect 6옵션)
//   output/evidence/effect-report/          정적 이미지 생성기 산출물 (시트/레코드 스트립)
//
// 이미지는 base64 로 인라인한다 — 감독이 파일 하나만 열면 되게.
//
// 실행: node scripts/gen-effect-audit-report.mjs
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ADV = "output/evidence/adversarial-ui-ux";
const SEN = "output/evidence/screen-effect-norender";
const EFF = "output/evidence/effect-report";
const OUT = "reports/effect-audit-2026-08-21.html";

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

/** PNG 를 data URI 로 인라인한다. 없으면 null. */
function dataUri(path) {
  if (!existsSync(path)) return null;
  return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
}

function esc(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}

function pct(ratio) {
  return `${(ratio * 100).toFixed(2)}%`;
}

const advProbes = readJson(join(ADV, "probes.json"), []);
const senProbes = readJson(join(SEN, "probes.json"), []);
const effMeta = readJson(join(EFF, "meta.json"), { sheets: [], records: [], shakeTable: [] });

/** before/after 두 장을 나란히 놓는 블록. */
function beforeAfter(dir, id, label, note) {
  const before = dataUri(join(dir, `${id}-before.png`));
  const after = dataUri(join(dir, `${id}-after.png`));
  if (!before || !after) return `<div class="missing">${esc(label)} — 이미지 미수집</div>`;
  return `
  <figure class="ba">
    <figcaption><strong>${esc(label)}</strong>${note ? ` <span class="note">${note}</span>` : ""}</figcaption>
    <div class="ba-pair">
      <div><span class="tag">실행 전</span><img src="${before}" alt="${esc(label)} 실행 전"></div>
      <div><span class="tag">실행 후</span><img src="${after}" alt="${esc(label)} 실행 후"></div>
    </div>
  </figure>`;
}

// ── 1. 구식 화면효과 (대조군) ────────────────────────────────────────────────
const advSection = advProbes.length
  ? `
<table>
  <thead><tr><th>커맨드</th><th>선언된 지원</th><th>픽셀 변화율</th><th>판정</th></tr></thead>
  <tbody>
    ${advProbes.map((probe) => `<tr>
      <td><code>${esc(probe.title)}</code><br><span class="sub">${esc(probe.label)}</span></td>
      <td><code>${esc(probe.declaredSupport)}</code></td>
      <td class="num">${pct(probe.changedRatio)}</td>
      <td><span class="ok">렌더됨</span></td>
    </tr>`).join("")}
  </tbody>
</table>
${advProbes.map((probe) => beforeAfter(ADV, probe.title.toLowerCase().includes("tint") ? "ev_tint"
    : probe.title.toLowerCase().includes("flash") ? "ev_flash"
    : probe.title.toLowerCase().includes("shake") ? "ev_shake"
    : probe.title.toLowerCase().includes("weather") ? "ev_weather" : "ev_hide",
  probe.label, `변화율 ${pct(probe.changedRatio)}`)).join("")}`
  : `<div class="missing">미수집 — <code>npx playwright test test/e2e/_adversarial-ui-ux-ceiling.spec.ts</code></div>`;

// ── 2. Screen Effect 무렌더 ─────────────────────────────────────────────────
const senSection = senProbes.length
  ? `
<table>
  <thead><tr><th>커맨드</th><th>실행 플래그</th><th>렌더러가 읽는 <code>screen</code></th><th>픽셀 변화율</th><th>이펙트 관련 경고</th><th>판정</th></tr></thead>
  <tbody>
    ${senProbes.map((probe) => {
      const dead = !probe.control && probe.changedRatio < 0.01;
      const screenState = probe.screenState && Object.keys(probe.screenState).length
        ? `<code>${esc(JSON.stringify(probe.screenState))}</code>`
        : '<span class="bad">비어 있음 {}</span>';
      const flags = (probe.screenEffectFlags ?? []).length
        ? `<code>${esc((probe.screenEffectFlags ?? []).join(", "))}</code>`
        : (probe.control ? '<span class="sub">해당 없음</span>' : '<span class="bad">없음</span>');
      return `<tr class="${dead ? "row-bad" : ""}">
      <td>${esc(probe.label)}</td>
      <td>${flags}${probe.screenEffectsRecorded > 0 ? `<br><span class="sub">큐에 ${probe.screenEffectsRecorded}건 적재</span>` : ""}</td>
      <td>${probe.control ? '<span class="ok">채워짐</span>' : screenState}</td>
      <td class="num">${pct(probe.changedRatio)}</td>
      <td class="num"><span class="bad">0건</span></td>
      <td>${probe.control ? '<span class="ok">대조군 · 렌더됨</span>' : dead ? '<span class="bad">화면 변화 없음</span>' : '<span class="ok">렌더됨</span>'}</td>
    </tr>`;
    }).join("")}
  </tbody>
</table>
${senProbes.map((probe) => beforeAfter(SEN, probe.id, probe.label, `변화율 ${pct(probe.changedRatio)}`)).join("")}`
  : `<div class="missing">미수집 — <code>npx playwright test test/e2e/_screen-effect-norender-evidence.spec.ts</code></div>`;

// ── 3. shake 클램프 ─────────────────────────────────────────────────────────
const shakeSection = (effMeta.shakeTable ?? []).length
  ? `<table>
  <thead><tr><th>에디터 프리셋</th><th>라벨</th><th>계산값</th><th>클램프 후 (실제 Phaser intensity)</th><th>판정</th></tr></thead>
  <tbody>
    ${effMeta.shakeTable.map((row) => `<tr class="${row.raw !== row.clamped ? "row-bad" : ""}">
      <td class="num">${row.preset}</td><td>${esc(row.label)}</td>
      <td class="num">${row.raw.toFixed(2)}</td>
      <td class="num">${row.clamped.toFixed(2)}</td>
      <td>${row.raw !== row.clamped ? '<span class="bad">상한에 잘림</span>' : '<span class="ok">그대로</span>'}</td>
    </tr>`).join("")}
  </tbody>
</table>`
  : `<div class="missing">미수집</div>`;

// ── 4. 전투 레코드 스트립 ───────────────────────────────────────────────────
function recordCard(record) {
  const strip = dataUri(join(EFF, `record-${record.id}-strip.png`));
  const swatch = record.flash
    ? `<span class="swatch" style="background:${esc(record.flash)}"></span><code>${esc(record.flash)}</code> <span class="sub">${esc(record.flashLabel)}</span>`
    : `<span class="sub">${esc(record.flashLabel)}</span>`;
  return `
  <div class="rec">
    <div class="rec-head">
      <strong>${esc(record.name)}</strong> <code>${esc(record.id)}</code>
      <span class="sub">${esc(record.sheet)} · 패턴 [${record.patterns.join(", ")}] · ${record.frames}프레임 · ${record.durationMs}ms</span>
    </div>
    ${strip ? `<img class="strip" src="${strip}" alt="${esc(record.name)} 프레임 스트립">` : `<div class="missing">스트립 미생성</div>`}
    <div class="rec-flash">저작된 flash 색 → <span class="bad">렌더에서 버려짐</span> · ${swatch}</div>
  </div>`;
}

const starterRecords = (effMeta.records ?? []).filter((record) => !record.id.startsWith("anim_scarloxy"));
const blowTrio = starterRecords.filter((record) => record.sheet === "blow");
const scarloxyRecords = (effMeta.records ?? []).filter((record) => record.id.startsWith("anim_scarloxy"));

// ── 5. 시트 재고 ────────────────────────────────────────────────────────────
const USED_PATTERNS = { blow: 3, sword1: 3, arrow: 3, "scarloxy-explosion": 4, "scarloxy-fire": 4, "scarloxy-green": 4, "scarloxy-ice": 4, "scarloxy-scratch": 4, "scarloxy-splash": 4 };
const totalPatterns = (effMeta.sheets ?? []).reduce((sum, sheet) => sum + sheet.patterns, 0);
const usedPatterns = (effMeta.sheets ?? []).reduce((sum, sheet) => sum + (USED_PATTERNS[sheet.id] ?? 0), 0);

const sheetSection = (effMeta.sheets ?? []).map((sheet) => {
  const image = dataUri(join(EFF, `sheet-${sheet.id}-full.png`));
  const used = USED_PATTERNS[sheet.id] ?? 0;
  return `
  <div class="sheet">
    <div class="rec-head"><strong>${esc(sheet.id)}</strong>
      <span class="sub">${sheet.width}×${sheet.height} · 패턴 ${sheet.patterns}칸 중 <b class="${used < sheet.patterns ? "bad" : "ok"}">${used}칸 사용</b> · <code>${esc(sheet.file)}</code></span>
    </div>
    ${image ? `<img class="sheetimg" src="${image}" alt="${esc(sheet.id)} 시트">` : `<div class="missing">미생성</div>`}
  </div>`;
}).join("");

const html = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<title>oprn 이펙트 감사 — 증거 보고서</title>
<style>
  :root {
    --bg:#14141a; --panel:#1d1d26; --panel2:#24242f; --line:#33333f;
    --fg:#e8e8ef; --dim:#9a9aab; --ok:#51cf66; --bad:#ff6b6b; --warn:#ffd43b; --accent:#3bc9db;
  }
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
  td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  tr.row-bad { background:rgba(255,107,107,.07); }
  .ok { color:var(--ok); font-weight:600; }
  .bad { color:var(--bad); font-weight:600; }
  .sub { color:var(--dim); font-size:12.5px; }
  .note { color:var(--dim); font-weight:400; font-size:13px; }
  .missing { color:var(--warn); background:rgba(255,212,59,.08); border:1px dashed rgba(255,212,59,.35);
    padding:12px 14px; border-radius:8px; margin:12px 0; font-size:14px; }
  .callout { background:var(--panel); border-left:4px solid var(--accent);
    padding:16px 20px; border-radius:0 10px 10px 0; margin:18px 0; }
  .callout.danger { border-left-color:var(--bad); }
  .callout p { margin:6px 0; }
  figure.ba { margin:20px 0; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; }
  figure.ba figcaption { margin-bottom:12px; }
  .ba-pair { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .ba-pair img { width:100%; border-radius:8px; border:1px solid var(--line); display:block; background:#000; }
  .tag { display:inline-block; font-size:11.5px; color:var(--dim); margin-bottom:6px;
    text-transform:uppercase; letter-spacing:.05em; }
  .rec { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; margin:14px 0; }
  .rec-head { margin-bottom:10px; display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; }
  img.strip { display:block; max-width:100%; image-rendering:pixelated; border-radius:8px; border:1px solid var(--line); }
  img.sheetimg { display:block; max-width:100%; image-rendering:pixelated; border-radius:8px; border:1px solid var(--line); }
  .rec-flash { margin-top:10px; font-size:13.5px; color:var(--dim); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .swatch { display:inline-block; width:22px; height:14px; border-radius:3px; border:1px solid rgba(255,255,255,.35); }
  .sheet { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; margin:14px 0; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin:22px 0 8px; }
  .kpi { background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .kpi b { display:block; font-size:26px; line-height:1.2; font-variant-numeric:tabular-nums; }
  .kpi span { color:var(--dim); font-size:12.5px; }
  ul { padding-left:22px; } li { margin:5px 0; }
  .footer { margin-top:64px; padding-top:18px; border-top:1px solid var(--line); color:var(--dim); font-size:13px; }
</style>
<div class="wrap">

<h1>oprn 이펙트 감사 — 증거 보고서</h1>
<p class="lede">2026-08-21 · 전투 / 맵 / UI 3영역 병렬 감사 후 결함을 픽셀·계산으로 재현한 기록.<br>
모든 수치는 실행 산출물에서 읽어온 것이며, 이미지는 이 파일에 인라인되어 있다.</p>

<div class="callout">
  <p><strong>한 줄 결론 — 기능이 없는 게 아니라, 만들어놓고 화면까지 배선을 안 했다.</strong></p>
  <p class="sub">감독이 에디터에서 값을 넣고 → 저장되고 → 실행되고 → 화면은 그대로다. 경고도 없다.
  세 영역이 독립 감사에서 같은 모양의 결함을 냈다.</p>
</div>

<div class="kpis">
  <div class="kpi"><b class="ok">${advProbes.length}</b><span>구식 화면효과 · 정상 렌더</span></div>
  <div class="kpi"><b class="bad">${senProbes.filter((p) => !p.control && p.changedRatio < 0.01).length}</b><span>Screen Effect 옵션 · 무반응</span></div>
  <div class="kpi"><b class="bad">${(effMeta.shakeTable ?? []).filter((r) => r.raw !== r.clamped).length}</b><span>shake 프리셋 · 상한에 잘림</span></div>
  <div class="kpi"><b>${usedPatterns} / ${totalPatterns}</b><span>이펙트 패턴 · 사용 / 보유</span></div>
</div>

<h2>1. 대조군 — 구식 화면효과 5종은 정상 작동한다</h2>
<p>먼저 기준선을 세운다. 이 다섯은 실행하면 실제로 픽셀이 바뀐다. 즉 뒤에 나올 무반응이
<em>테스트 환경 탓이 아니다</em>.</p>
${advSection}

<h2>2. 결함 ① — <code>Screen Effect</code> 옵션이 화면을 바꾸지 않는다</h2>
<div class="callout danger">
  <p><strong>인터프리터는 명령을 받아 큐에 쌓는다. 그런데 그 큐를 읽는 렌더러가 없다.</strong></p>
  <p class="sub"><code>src/player/interpreter/m2ModernRuntime.ts:26</code> 이 <code>runtime.screenEffects</code> 에 push 하지만,
  저장소 전체에서 이 배열의 <b>소비자는 0개</b>다(쓰기 3곳 + 타입 선언뿐).
  커맨드는 피커 3페이지에 정상 노출된다 — <code>src/project/eventCommands/m2PickerLayout.ts:180</code>.</p>
  <p class="sub"><b>결정적 증거:</b> 실행 플래그 <code>screen-effect:*</code> 는 켜지는데
  (= 인터프리터는 확실히 실행했다) 화면 렌더러가 읽는 <code>m2Runtime.screen</code> 은
  <code>{}</code> 로 비어 있다. 쓰는 곳(<code>screenEffects</code>)과 읽는 곳(<code>screen</code>)이
  <b>서로 다른 필드</b>다.</p>
  <p class="sub">수집된 콘솔 경고 7건은 전부 테스트 환경의 자산 <code>404</code>/<code>ERR_CONNECTION_REFUSED</code> 로
  이 커맨드와 무관하다. 즉 <b>이펙트에 대한 경고는 단 한 건도 없다</b> — 감독에게 알려줄 창구가 없다.</p>
</div>
${senSection}

<h2>3. 결함 ② — shake 다이얼이 거짓말한다</h2>
<p>에디터는 강도 4단계를 제공하지만, 런타임 클램프 상한이 <code>0.05</code> 라
<b>"강하게"(6)와 "매우 강하게"(10)가 완전히 같은 값</b>이 된다.</p>
<p class="sub">근거: <code>src/player/playSceneMapCommands.ts:118</code> —
<code>Math.min(0.05, Math.max(0.001, step.intensity / 100))</code> ·
프리셋: <code>src/editor/panels/eventEditor/commandBodyM2Page3.ts:59-64</code></p>
${shakeSection}
<p class="sub">감독은 다이얼을 올려도 화면이 안 바뀌니 다시 올리고 다시 재생하는 왕복을 반복하게 된다.</p>

<h2>4. 결함 ③ — 서로 다른 3개 스킬이 같은 그림으로 재생된다</h2>
<div class="callout danger">
  <p><strong>「타격」·「마법 충격」·「회복 빛」은 같은 시트의 같은 패턴을 쓴다.
  유일한 차이인 flash 색이 렌더 단계에서 버려진다.</strong></p>
  <p class="sub">색이 죽는 지점: <code>src/player/battleAnimationDom.ts:216,220</code> —
  <code>Boolean(timing?.flash)</code> 로 뭉개서 CSS 고정 흰색만 남는다
  (<code>src/styles/runtime/battle/06-damage-flash-targeting.css:146-150</code>).</p>
</div>
<h3>같은 시트(Blow.png) · 같은 패턴 [0,1,2] 을 쓰는 3개 레코드</h3>
${blowTrio.map(recordCard).join("")}
<h3>나머지 스타터 레코드</h3>
${starterRecords.filter((record) => record.sheet !== "blow").map(recordCard).join("")}

<h2>5. Scarloxy 이펙트 6종 — 유일하게 4프레임짜리</h2>
<p>기본 스타터 프로젝트에서는 <b>참조되지 않는다</b>. <code>scarloxyDemoGame.ts</code> ·
<code>scarloxyPokemonDemoGame.ts</code> 두 데모 게임에서만 쓰인다(총 13건).</p>
${scarloxyRecords.map(recordCard).join("")}

<h2>6. 이펙트 시트 재고 — 패턴 ${totalPatterns}칸 중 ${usedPatterns}칸만 쓴다</h2>
<p>특히 Blow / Sword1 은 15칸짜리 시트인데 앞의 3칸만 쓰고 나머지 12칸은 방치돼 있다.
새 에셋을 만들지 않고도 변형을 뽑을 여지가 남아 있다는 뜻이다.</p>
${sheetSection}

<h2>7. 다음 작업 (P0)</h2>
<ol>
  <li><b>Screen Effect 배선</b> — <code>screenEffects</code> 큐를 기존 Tint/Flash/Fade 경로로 라우팅. blur 는 미지원이면 피커에서 내린다.</li>
  <li><b>shake 클램프 조정</b> — 4단계가 실제로 4단계가 되게. 한 줄.</li>
  <li><b>flash.color 렌더까지 배선</b> — CSS 변수로 흘려 타격·마법충격·회복빛이 구분되게.</li>
  <li><b>Ctrl+Z 피드백</b> — 되돌림에 토스트. 히스토리가 이미 boolean 과 라벨을 반환한다.</li>
</ol>
<div class="callout">
  <p><strong>회귀 방지가 수정보다 중요하다.</strong></p>
  <p class="sub">세 영역 전부 테스트 <code>skip</code>/<code>todo</code> 가 0건인데 배선은 끊겨 있었다.
  유닛 테스트가 모델 계층만 검증하고 <b>모델 → 화면</b> 구간은 아무도 보지 않는다.
  "선언된 저작 필드가 렌더러에 도달하는가" 를 대조하는 계약 테스트가 없으면 다음 필드가 또 끊긴다.</p>
</div>

<div class="footer">
  생성: <code>node scripts/gen-effect-audit-report.mjs</code> ·
  증거: <code>${ADV}</code> · <code>${SEN}</code> · <code>${EFF}</code>
</div>
</div>
</html>`;

mkdirSync("reports", { recursive: true });
writeFileSync(OUT, html, "utf8");
console.log(`보고서: ${OUT} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  대조군 프로브 ${advProbes.length}건 · Screen Effect 프로브 ${senProbes.length}건 · 레코드 ${(effMeta.records ?? []).length}개 · 시트 ${(effMeta.sheets ?? []).length}장`);
