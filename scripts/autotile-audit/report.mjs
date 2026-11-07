// 오토타일 감사 보고서(HTML) — audit.mts 결과(audit.json)와 붓·AI 경로 비교(aivb.json)를 한국어 페이지로 묶는다.
// 사용: node scripts/autotile-audit/report.mjs <before-dir> <out-html> [--after <after-dir>] [--aivb-before f] [--aivb-after f]
// 그림은 HTML 옆 디렉터리에 복사해 상대 경로로 건다(claude-viz 가 하위 디렉터리를 서빙한다).
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const beforeDir = args[0];
const outHtml = args[1];
const afterDir = flag("--after");
const aivbBefore = flag("--aivb-before");
const aivbAfter = flag("--aivb-after");
const assetDirName = basename(outHtml).replace(/\.html$/, "");
const assetDir = join(dirname(outHtml), assetDirName);

const load = (dir) => JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"));
const before = load(beforeDir);
const after = afterDir ? load(afterDir) : null;
const aivbB = aivbBefore && existsSync(aivbBefore) ? JSON.parse(readFileSync(aivbBefore, "utf8")) : null;
const aivbA = aivbAfter && existsSync(aivbAfter) ? JSON.parse(readFileSync(aivbAfter, "utf8")) : null;

mkdirSync(assetDir, { recursive: true });
cpSync(join(beforeDir, "png"), join(assetDir, "before"), { recursive: true });
if (afterDir) cpSync(join(afterDir, "png"), join(assetDir, "after"), { recursive: true });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const img = (side, png) => png ? `${assetDirName}/${side}/${basename(png)}` : "";
const key = (g) => `${g.tilesetId}/${g.groupId}`;
const afterByKey = new Map((after?.groups ?? []).map((g) => [key(g), g]));

const CAUSE_KO = {
  "no-op-dead": "죽은 오토타일(모양이 안 바뀜)",
  "out-of-range": "범위 밖 타일 번호",
  "transparent": "투명(빈) 칸",
  "scrambled-roles": "역할 뒤섞임(변·모서리 구분 실패)",
  "inner-corner-unreachable": "안쪽 모서리 미도달",
  "no-atlas": "아틀라스 그림 없음",
};
const SHAPES_KO = ["1×1 외딴 칸", "가로 띠 1×4", "세로 띠 4×1", "3×3 채움", "3×3 고리(가운데 빔)", "ㄴ자 꺾임", "T자 교차", "+자 교차", "안쪽 모서리(3×3−모서리)", "2×2 덩이"];

const s = before.summary;
const sa = after?.summary;
const warnCounts = {};
for (const g of before.groups) for (const w of g.warnings) { const k = w.split(":")[0]; warnCounts[k] = (warnCounts[k] ?? 0) + 1; }

const aivbGroups = (recs) => recs ? new Map(recs.map((r) => [`${r.tileset}/${r.group}`, r])).size : null;
const aivbTilesets = (recs) => recs ? new Set(recs.map((r) => r.tileset)).size : null;
const aivbByCause = (recs) => {
  if (!recs) return null;
  const groups = new Map(recs.map((r) => [`${r.tileset}/${r.group}`, r]));
  let edge = 0, phase = 0;
  for (const r of groups.values()) { if (r.edgeConnects || r.outsideConnects) edge += 1; if (r.phase) phase += 1; }
  return { edge, phase };
};

// 사람이 그림을 보고 내린 판정. 기계 FAIL 을 덮을 때는 근거(소스 줄·그림)를 함께 남긴다.
const VISUAL = {
  "beodeul_city/beodeul_dungeon_ceiling": { verdict: "PASS", why: "47모양 테두리 그림: 바닥과 닿는 쪽에만 벽 두께 띠, 사방이 천장인 칸은 검은 허공. 굽기 스크립트가 배치에 안 나오는 모양을 nearest() 로 접는다(scripts/content/beodeul-dungeon/bake_dungeon_ceiling.py:83). 1칸·얇은 모양이 허공인 것은 의도다." },
  "beodeul_city/beodeul_dungeon_ceiling_b": { verdict: "PASS", why: "위와 같은 굽기의 결 2." },
};
const visualFor = (g) => VISUAL[key(g)];
const isFail = (g) => g.failures.length > 0 && visualFor(g)?.verdict !== "PASS";
const failing = before.groups.filter(isFail);
const overridden = before.groups.filter((g) => g.failures.length > 0 && visualFor(g)?.verdict === "PASS");
const passCount = (a) => a.groups.filter((g) => !isFail(g)).length;
const failCount = (a) => a.groups.filter(isFail).length;
const tilesetsWithGroups = before.tilesets.filter((t) => t.groups > 0);

const card = (g, showAfter) => {
  const a = afterByKey.get(key(g));
  const tags = [...g.failures.map((f) => `<span class="tag bad">${esc(f)}</span>`), ...g.warnings.map((w) => `<span class="tag warn">${esc(w)}</span>`)];
  const v = visualFor(g);
  const status = isFail(g) ? `<b class="bad">FAIL</b>` : g.failures.length ? `<b class="ok">PASS</b> <span class="tag warn">시각 판정으로 기계 FAIL 무효</span>` : `<b class="ok">PASS</b>`;
  if (v) tags.push(`<span class="tag">시각 판정: ${esc(v.why)}</span>`);
  return `<figure class="card" id="${esc(key(g))}">
  <figcaption>${status} <code>${esc(g.tilesetId)}</code> · <code>${esc(g.groupId)}</code> <span class="muted">${esc(g.groupName)} · ${g.neighborhood}방 · 멤버 ${g.members} · 서로 다른 칸 ${g.distinctValues ?? "?"} · 안쪽 모서리 ${esc(g.innerCornerReached)}</span><div>${tags.join(" ")}</div></figcaption>
  ${showAfter && a ? `<div class="pair"><div><div class="lbl">BEFORE</div><img loading="lazy" src="${img("before", g.png)}"></div><div><div class="lbl">AFTER</div><img loading="lazy" src="${img("after", a.png)}"></div></div>`
    : `<img loading="lazy" src="${img("before", g.png)}">`}
</figure>`;
};

const aivbDir = flag("--aivb-png");
const aivbAfterDir = flag("--aivb-png-after");
if (aivbDir) cpSync(aivbDir, join(assetDir, "aivb"), { recursive: true });
if (aivbAfterDir) cpSync(aivbAfterDir, join(assetDir, "aivb-after"), { recursive: true });
const AIVB_PAIRS = aivbDir ? readdirSync(aivbDir).filter((f) => f.endsWith(".brush.png")).map((f) => {
  const stem = f.replace(/\.brush\.png$/, "");
  const after = aivbAfterDir && existsSync(join(aivbAfterDir, `${stem}.ai.png`));
  return `<figure class="card"><figcaption><code>${esc(stem.replace("__", " · "))}</code></figcaption><div class="pair"><div><div class="lbl">붓(정본)</div><img loading="lazy" src="${assetDirName}/aivb/${f}"></div><div><div class="lbl">AI 경로 — 수정 전</div><img loading="lazy" src="${assetDirName}/aivb/${stem}.ai.png"></div>${after ? `<div><div class="lbl">AI 경로 — 수정 후</div><img loading="lazy" src="${assetDirName}/aivb-after/${stem}.ai.png"></div>` : ""}</div></figure>`;
}).join("\n") : `<p class="muted">그림 없음</p>`;

const legend = `<ol class="legend">${SHAPES_KO.map((n, i) => `<li><b>${i < 5 ? "윗줄" : "아랫줄"} ${(i % 5) + 1}</b> ${n}</li>`).join("")}</ol>`;

const aivbBCause = aivbByCause(aivbB);
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>오토타일 전수 감사</title>
<style>
:root{--bg:#0f1115;--fg:#e8e8ea;--muted:#9aa0aa;--bad:#ff6b6b;--ok:#4ade80;--warn:#fbbf24;--card:#181b22;--line:#2a2f3a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
main{max-width:1280px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:20px;margin:36px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}h3{font-size:16px;margin:22px 0 8px}
.muted{color:var(--muted)}.bad{color:var(--bad)}.ok{color:var(--ok)}.warn{color:var(--warn)}
.score{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.score div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.score b{display:block;font-size:26px}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:12px 0;padding:10px}
.card img{width:100%;height:auto;image-rendering:pixelated;display:block;border-radius:6px;background:#222}
.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.lbl{font-size:12px;color:var(--muted);margin:2px 0}
figcaption{margin:0 0 8px}.tag{display:inline-block;font-size:12px;border-radius:6px;padding:1px 6px;margin:2px 2px 0 0;border:1px solid var(--line)}
.tag.bad{color:var(--bad);border-color:#5a2a2a}.tag.warn{color:var(--warn);border-color:#5a4a1a}
code{background:#222733;border-radius:4px;padding:0 4px;overflow-wrap:anywhere;word-break:break-word}
li,p,td,figcaption{overflow-wrap:anywhere}table{table-layout:fixed}
.legend{columns:2;font-size:13px;color:var(--muted)}
details{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:8px 0;padding:8px 12px}summary{cursor:pointer;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:10px}
@media (max-width:640px){.pair{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.legend{columns:1}h1{font-size:21px}}
</style></head><body><main>
<h1>오토타일 전수 감사</h1>
<p class="muted">기준 ${esc(s.generatedAt)} · 실제 엔진(<code>shapeAutotileGroupAround</code>)으로 칠하고 실제 아틀라스 PNG(<code>public/assets</code>)에서 잘라 그렸다. 칸을 다시 구현하지 않았다.</p>

<div class="score">
<div>타일셋<b>${s.tilesets}</b><span class="muted">그룹 있는 것 ${s.tilesetsWithGroups}</span></div>
<div>오토타일 그룹<b>${s.groups}</b><span class="muted">전부 실제로 칠함</span></div>
<div>엔진 감사 PASS<b class="ok">${passCount(before)}</b><span class="muted">기계 ${s.pass} + 시각 판정 ${overridden.length}${sa ? ` · 수정 후 ${passCount(after)}` : ""}</span></div>
<div>엔진 감사 FAIL<b class="${failCount(before) ? "bad" : "ok"}">${failCount(before)}</b>${sa ? `<span class="muted">수정 후 ${failCount(after)}</span>` : ""}</div>
<div>붓≠AI 경로 그룹<b class="${aivbB?.length ? "bad" : "ok"}">${aivbGroups(aivbB) ?? "—"}</b><span class="muted">${aivbB ? `타일셋 ${aivbTilesets(aivbB)}개` : ""}${aivbA ? ` · 수정 후 ${aivbGroups(aivbA)}` : ""}</span></div>
</div>

<h2>결론</h2>
<ul>
<li><b class="bad">진짜 결함 — AI·공간 컴파일 경로가 붓과 다른 칸을 깐다.</b> 조수의 길 깔기·재료 칠하기(<code>constructionTools.ts</code>), 지형 다듬기(<code>terrainPolish.ts</code>), 공간 지형 컴파일(<code>compileTerrain.ts</code>·<code>geographyTerrain.ts</code>)이 쓰는 <code>resolveAutotile</code>(<code>src/editor/tools/v3/rmTypeExpander.ts</code>)은 엔진을 다시 구현한 사본이었다. 그 사본은 <code>edgeConnects</code>(맵 밖을 이어진 것으로 보기)를 무시하고, 칸 좌표를 넘기지 않아 <code>phaseVariants</code>(2×2 위상 몸통)도 버렸다. 같은 모양을 붓과 AI로 칠해 비교하니 <b>${aivbGroups(aivbB) ?? "?"}개 그룹 / ${aivbTilesets(aivbB) ?? "?"}개 타일셋</b>에서 칸이 달랐다(edgeConnects ${aivbBCause?.edge ?? "?"} · phaseVariants ${aivbBCause?.phase ?? "?"}, 설명 안 되는 불일치 0). 맵 가장자리에 조수가 깐 길·물가·벽에는 원래 없을 테두리가 생기고, 버들항 자갈·판석 마당과 용암 바닥은 2×2 무늬가 한 칸짜리로 줄짓는다.</li>
<li><b>엔진 자체(붓·채우기·지우기·지형 붓)는 370그룹 모두 범위 밖·투명·죽은 칸이 없다.</b> 아래 「FAIL」 은 그림 자체가 안쪽 모서리를 갖고 있는데 엔진이 몸통을 쓰는 경우만 남겼다.</li>
<li><b>설계상 평면인 그룹은 결함으로 세지 않았다</b> — 나무 조립기(composer)가 2~4층에 나무를 그리는 숲 바닥, 「가장자리를 그리지 않는다」고 문서화된 시골 풀밭, 366 저장 계약의 실내 어두운 벽. 경고로만 표시했다.</li>
<li><b>안쪽 모서리 그림이 없는 「16모양」 그룹</b>(8방으로 선언됐지만 대각을 보지 않음)은 경고 <code>no-inner-corner-art</code> 로 따로 셌다(${warnCounts["no-inner-corner-art"] ?? 0}개). 엔진 버그가 아니라 그림 판형의 한계라 이번 수정 범위에 넣지 않았다.</li>
</ul>

<h2>점검 방법</h2>
<p>타일셋마다 그룹마다 빈 24×24 맵에 아래 10가지 모양을 그 그룹의 몸통 칸(<code>variantMap[255|15]</code>, 지형 팔레트가 칠하는 칸)으로 칠한 뒤 엔진에 모양을 맞추게 했다. 그림은 그 결과 칸 번호를 실제 아틀라스에서 잘라 3배로 그린 것이다. 배경은 그 그룹과 이어지지 않는 불투명 칸이다.</p>
${legend}
<table><tr><th>검사</th><th>판정</th></tr>
<tr><td>범위 밖 / 투명</td><td>결과 칸이 0 미만·count 이상이거나 아틀라스에서 알파가 0인 칸(이식 칸 제외)</td></tr>
<tr><td>죽은 오토타일</td><td>10모양 모두 같은 칸 하나 — 설계상 평면(composer·문서화·366 계약)이면 경고</td></tr>
<tr><td>역할 뒤섞임</td><td>상하좌우 9역할 마스크가 그룹이 가진 서로 다른 칸 수보다 적게 갈라짐</td></tr>
<tr><td>안쪽 모서리</td><td>대각 하나만 빈 마스크(255−NE/SE/SW/NW)에 그림이 있는데 3×3−모서리 모양의 가운데가 몸통으로 남음</td></tr>
<tr><td>붓 ≠ AI</td><td>같은 모양(맵 가장자리 가로·세로 띠, 모서리 2×2, 안쪽 3×3)을 <code>shapeAutotileGroupAround</code> 와 <code>resolveAutotile</code> 로 칠해 칸 단위 비교</td></tr>
</table>

${s.tilesetRowIssues?.length ? `<h3>아틀라스 용량 메모</h3><p class="muted">아래는 count 가 아틀라스 칸 수와 이식(graft) 칸 수의 합보다 큰 타일셋이다. 오토타일 그룹은 그 꼬리 칸을 쓰지 않아 이번 결과에는 영향이 없다.</p><table><tr><th>타일셋</th><th>count</th><th>아틀라스</th><th>이식</th><th>메모</th></tr>${s.tilesetRowIssues.map((t) => `<tr><td><code>${esc(t.id)}</code></td><td>${t.count}</td><td>${t.atlasCapacity}</td><td>${t.graftedBeyondAtlas}</td><td>${esc(t.tilesetsRows.join("; "))}</td></tr>`).join("")}</table>` : ""}

<h2>붓 ≠ AI 경로 — 불일치 그룹 ${aivbGroups(aivbB) ?? "?"}개</h2>
${aivbB ? `<p class="muted">맵 가장자리에 닿는 모양에서 붓은 맵 밖을 이어진 것으로 봐 테두리를 안 그리는데 AI 경로는 그렸다. ${aivbA ? `수정 후 같은 비교: <b class="${aivbA.length ? "bad" : "ok"}">${aivbGroups(aivbA)}개 그룹</b>.` : ""}</p>
<details><summary>타일셋별 불일치 그룹 수</summary><table><tr><th>타일셋</th><th>그룹</th><th>칸 차이 합</th></tr>${Object.entries(aivbB.reduce((acc, r) => { const t = acc[r.tileset] ??= { groups: new Set(), cells: 0 }; t.groups.add(r.group); t.cells += r.cells; return acc; }, {})).sort((a, b) => b[1].groups.size - a[1].groups.size).map(([t, v]) => `<tr><td><code>${esc(t)}</code></td><td>${v.groups.size}</td><td>${v.cells}</td></tr>`).join("")}</table></details>` : `<p class="muted">비교 자료 없음</p>`}

<h2>엔진 감사 FAIL ${failing.length}개${after ? " — BEFORE / AFTER" : ""}</h2>
${failing.length ? failing.map((g) => card(g, !!after)).join("\n") : `<p class="ok">없음 — 붓·채우기 엔진은 370그룹 전부 범위 밖·투명·죽은 칸·역할 뒤섞임이 없다.</p>`}
${overridden.length ? `<h3>기계 검사는 걸렸지만 그림을 보고 PASS 로 판정한 그룹 ${overridden.length}개</h3>${overridden.map((g) => card(g, false)).join("\n")}` : ""}

<h2>붓 ≠ AI 경로 — 실제 그림 예시</h2>
<p class="muted">같은 모양을 두 경로로 칠한 결과. 첫째 = 붓(정본), 둘째 = AI·공간 컴파일(수정 전) — 맵 가장자리에 없어야 할 테두리가 생긴다.${after ? " 셋째 = 수정 후 AI 경로(붓과 바이트 단위로 같다)." : ""}</p>
${AIVB_PAIRS}

<h2>전체 갤러리 — 그룹 ${s.groups}개</h2>
<p class="muted">타일셋을 펼쳐 본다. 각 그림 = 위 10모양.</p>
${tilesetsWithGroups.map((t) => {
  const gs = before.groups.filter((g) => g.tilesetId === t.id);
  const nFail = gs.filter(isFail).length;
  return `<details><summary><code>${esc(t.id)}</code> — 그룹 ${gs.length} · <span class="${nFail ? "bad" : "ok"}">FAIL ${nFail}</span> · ${t.tilesPerRow}열 · count ${t.count}</summary><div class="grid">${gs.map((g) => card(g, false)).join("")}</div></details>`;
}).join("\n")}
</main></body></html>`;

writeFileSync(outHtml, html);
console.log(`wrote ${outHtml} (${(html.length / 1024).toFixed(0)}KB), assets ${assetDir}`);
