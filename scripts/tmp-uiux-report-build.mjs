/**
 * 적대적 UI/UX 리뷰 보고서(HTML) 빌더.
 *
 * 입력: verify-shots/uiux-adversarial/audit.json + 같은 폴더의 PNG
 * 출력: reports/uiux-adversarial-review.html (이미지 base64 인라인 = 단일 파일 배포 가능)
 *
 * 소견 본문은 findings.json 에 손으로 적은 것을 읽는다. 계측 수치는 audit.json 에서
 * 직접 끌어와 본문과 표가 갈라지지 않게 한다.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const SHOT_DIR = "verify-shots/uiux-adversarial";
const OUT = "reports/uiux-adversarial-review.html";
mkdirSync("reports", { recursive: true });

const audit = JSON.parse(readFileSync(`${SHOT_DIR}/audit.json`, "utf8"));
const findings = JSON.parse(readFileSync(`${SHOT_DIR}/findings.json`, "utf8"));

/** PNG 를 data URI 로 인라인한다. 없으면 null. */
function dataUri(file) {
  const p = `${SHOT_DIR}/${file}`;
  if (!existsSync(p)) return null;
  return `data:image/png;base64,${readFileSync(p).toString("base64")}`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SEV = {
  P0: { label: "P0 · 작업 차단", color: "#ff4d4f" },
  P1: { label: "P1 · 심각", color: "#ff9f43" },
  P2: { label: "P2 · 개선", color: "#ffd166" },
  P3: { label: "P3 · 다듬기", color: "#7fd1ae" },
};

const shotById = new Map(audit.shots.map((s) => [s.id, s]));

/** 증거 이미지 블록. crop 지정 시 CSS 로 확대·이동해 관심 영역만 보여준다. */
function figure(ref) {
  const id = typeof ref === "string" ? ref : ref.id;
  const shot = shotById.get(id);
  const uri = dataUri(shot?.file ?? `${id}.png`);
  if (!uri) return `<div class="miss">증거 이미지 없음: ${esc(id)}</div>`;
  const cap = (typeof ref === "object" && ref.caption) || shot?.caption || id;
  const zoom = typeof ref === "object" && ref.zoom ? ref.zoom : null;
  const inner = zoom
    ? `<div class="zoomwrap" style="aspect-ratio:${zoom.w}/${zoom.h}"><img src="${uri}" style="transform:scale(${zoom.scale}) translate(${-zoom.x}px,${-zoom.y}px);transform-origin:0 0" alt="${esc(cap)}"></div>`
    : `<img src="${uri}" alt="${esc(cap)}" loading="lazy">`;
  return `<figure class="shot">${inner}<figcaption><span class="fid">${esc(id)}</span>${esc(cap)}</figcaption></figure>`;
}

function metricTable(rows, cols) {
  if (!rows || rows.length === 0) return `<p class="none">해당 없음</p>`;
  const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${cols.map((c) => `<td>${esc(c.get(r) ?? "")}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
for (const f of findings.findings) counts[f.severity] += 1;

const findingHtml = findings.findings
  .map((f, i) => `
<article class="finding" id="f${i + 1}">
  <header>
    <span class="sev" style="--sev:${SEV[f.severity].color}">${SEV[f.severity].label}</span>
    <h3>${esc(f.title)}</h3>
  </header>
  <div class="body">
    <div class="prose">
      <p class="what"><b>관측</b> ${esc(f.observed)}</p>
      ${f.measured ? `<p class="meas"><b>실측</b> ${esc(f.measured)}</p>` : ""}
      <p class="why"><b>왜 문제인가</b> ${esc(f.why)}</p>
      <p class="fix"><b>수정 방향</b> ${esc(f.fix)}</p>
      ${f.where ? `<p class="where"><b>지점</b> <code>${esc(f.where)}</code></p>` : ""}
    </div>
    <div class="evi">${(f.evidence ?? []).map(figure).join("")}</div>
  </div>
</article>`)
  .join("");

const galleryHtml = audit.shots.map((s) => figure(s.id)).join("");

const beginner = audit.audits.beginner ?? {};
const contrastRows = (beginner.lowContrast ?? []).slice(0, 14);
const targetRows = (beginner.smallTargets ?? []).slice(0, 14);
const focusRows = audit.audits.focusTrail ?? [];

const viewportRows = Object.entries(audit.audits)
  .filter(([k]) => k.includes("viewport"))
  .map(([k, v]) => ({
    id: k,
    vp: `${v.viewport?.w}×${v.viewport?.h}`,
    ctrl: v.controlCount,
    small: v.smallTargetCount,
    contrast: v.lowContrastCount,
    off: (v.offViewport ?? []).length,
    clipped: (v.clipped ?? []).length,
  }));

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(findings.title)}</title>
<style>
  :root{
    --bg:#0b0d12; --bg2:#12151d; --card:#161a24; --line:#232936;
    --ink:#e8ecf4; --dim:#9aa4b8; --accent:#7aa2ff; --accent2:#c58cff;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.7 -apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo","Noto Sans KR",Segoe UI,sans-serif}
  a{color:var(--accent)}
  .wrap{max-width:1180px;margin:0 auto;padding:0 24px 96px}
  header.top{padding:64px 0 36px;border-bottom:1px solid var(--line);margin-bottom:36px}
  .kicker{color:var(--accent2);letter-spacing:.18em;font-size:12px;text-transform:uppercase;margin:0 0 14px}
  h1{font-size:clamp(30px,4.6vw,50px);line-height:1.15;margin:0 0 16px;letter-spacing:-.02em}
  .lede{color:var(--dim);font-size:17px;max-width:74ch;margin:0 0 28px}
  .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
  .meta div{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
  .meta dt{color:var(--dim);font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 4px}
  .meta dd{margin:0;font-size:14px;word-break:break-all}
  .scoreboard{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:34px 0 10px}
  .score{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--c);border-radius:10px;padding:14px 16px}
  .score b{display:block;font-size:30px;line-height:1.1}
  .score span{color:var(--dim);font-size:12px}
  h2{font-size:26px;margin:56px 0 8px;letter-spacing:-.01em}
  h2 .num{color:var(--accent);font-size:14px;display:block;letter-spacing:.16em;margin-bottom:6px}
  h3{font-size:19px;margin:0;letter-spacing:-.01em}
  .verdict{background:linear-gradient(135deg,#171b26,#1d1730);border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin-top:18px}
  .verdict p{margin:0 0 12px}
  .verdict p:last-child{margin:0}
  .finding{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin:18px 0}
  .finding header{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:14px}
  .sev{background:color-mix(in srgb,var(--sev) 18%,transparent);color:var(--sev);
    border:1px solid color-mix(in srgb,var(--sev) 45%,transparent);border-radius:999px;
    padding:3px 11px;font-size:11.5px;font-weight:700;white-space:nowrap}
  .body{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
  @media(min-width:920px){.body{grid-template-columns:minmax(0,1fr) minmax(0,1.15fr)}}
  .prose p{margin:0 0 10px}
  .prose b{color:var(--accent);font-weight:700;margin-right:6px}
  .prose .meas b{color:#ffd166}
  .prose .fix b{color:#7fd1ae}
  .prose .where b{color:var(--dim)}
  code{background:#0f1219;border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:12.5px}
  .evi{display:grid;gap:12px}
  figure.shot{margin:0;background:#0f1219;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  figure.shot img{display:block;width:100%;height:auto}
  .zoomwrap{position:relative;overflow:hidden;width:100%}
  .zoomwrap img{position:absolute;top:0;left:0;width:1600px;max-width:none;height:auto}
  figcaption{padding:9px 12px;color:var(--dim);font-size:12.5px;border-top:1px solid var(--line)}
  .fid{display:inline-block;background:#1b2030;color:var(--accent);border-radius:4px;
    padding:1px 6px;margin-right:8px;font-size:11px;font-variant-numeric:tabular-nums}
  .gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:18px}
  table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
  th{color:var(--dim);font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:600}
  td{font-variant-numeric:tabular-nums}
  tbody tr:hover{background:#1a1f2b}
  .none{color:var(--dim)}
  .miss{color:#ff9f43;font-size:13px;padding:10px;border:1px dashed #3a2f22;border-radius:8px}
  .toc{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
  .toc a{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:7px 11px;
    font-size:13px;text-decoration:none;color:var(--ink)}
  .toc a:hover{border-color:var(--accent)}
  .toc a i{font-style:normal;color:var(--dim);margin-right:6px}
  footer{margin-top:70px;padding-top:22px;border-top:1px solid var(--line);color:var(--dim);font-size:13px}
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <p class="kicker">Adversarial UI/UX Review</p>
  <h1>${esc(findings.title)}</h1>
  <p class="lede">${esc(findings.lede)}</p>
  <div class="meta">
    ${Object.entries(findings.env).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}
  </div>
  <div class="scoreboard">
    ${Object.entries(counts).map(([k, n]) => `<div class="score" style="--c:${SEV[k].color}"><b>${n}</b><span>${esc(SEV[k].label)}</span></div>`).join("")}
    <div class="score" style="--c:var(--accent)"><b>${audit.shots.length}</b><span>실브라우저 스크린샷</span></div>
  </div>
</header>

<section>
  <h2><span class="num">01</span>총평</h2>
  <div class="verdict">${findings.verdict.map((p) => `<p>${p}</p>`).join("")}</div>
  <div class="toc">
    ${findings.findings.map((f, i) => `<a href="#f${i + 1}"><i>${f.severity}</i>${esc(f.title)}</a>`).join("")}
  </div>
</section>

<section>
  <h2><span class="num">02</span>결함 상세</h2>
  ${findingHtml}
</section>

<section>
  <h2><span class="num">03</span>계측표</h2>
  <h3>대비 미달 텍스트 (초보 모드 기본 화면 · WCAG AA 기준)</h3>
  ${metricTable(contrastRows, [
    { label: "텍스트", get: (r) => r.text },
    { label: "클래스", get: (r) => r.cls },
    { label: "글자색", get: (r) => r.color },
    { label: "배경", get: (r) => r.bg },
    { label: "크기", get: (r) => `${r.size}px` },
    { label: "대비", get: (r) => `${r.ratio}:1` },
    { label: "요구", get: (r) => `${r.need}:1` },
  ])}
  <h3>32px 미달 히트영역</h3>
  ${metricTable(targetRows, [
    { label: "라벨", get: (r) => r.label || "(없음)" },
    { label: "클래스", get: (r) => r.cls },
    { label: "너비", get: (r) => `${r.w}px` },
    { label: "높이", get: (r) => `${r.h}px` },
    { label: "위치", get: (r) => `${r.x},${r.y}` },
  ])}
  <h3>Tab 순회 12스텝 · 포커스 링</h3>
  ${metricTable(focusRows.filter(Boolean), [
    { label: "요소", get: (r) => r.tag },
    { label: "라벨", get: (r) => r.label || "(없음)" },
    { label: "outline", get: (r) => r.outline },
    { label: "box-shadow", get: (r) => r.boxShadow },
    { label: "화면밖", get: (r) => (r.offscreen ? "예" : "-") },
  ])}
  <h3>뷰포트별 요약</h3>
  ${metricTable(viewportRows, [
    { label: "뷰포트", get: (r) => r.vp },
    { label: "조작요소", get: (r) => r.ctrl },
    { label: "작은 히트영역", get: (r) => r.small },
    { label: "대비 미달", get: (r) => r.contrast },
    { label: "뷰포트 이탈", get: (r) => r.off },
    { label: "텍스트 절단", get: (r) => r.clipped },
  ])}
</section>

<section>
  <h2><span class="num">04</span>증거 전체</h2>
  <div class="gallery">${galleryHtml}</div>
</section>

<footer>
  ${esc(findings.footer)}
</footer>
</div>
</body>
</html>`;

writeFileSync(OUT, html);
console.log(`${OUT} · ${(html.length / 1024 / 1024).toFixed(2)} MB · findings=${findings.findings.length} · shots=${audit.shots.length}`);
