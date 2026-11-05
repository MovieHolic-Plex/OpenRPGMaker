#!/usr/bin/env node
// Korean, image-rich report page for one or more pipeline runs. Self-contained except for evidence images,
// which are copied next to the page (<name>/<file>.jpg) so the page works from any static server.
//
// usage: node scripts/qa/pipeline/report.mjs --out ~/claude-viz --name qa-pipeline <runDir> [<runDir> ...]
//        [--bench <benchA dir with reviewed.json>]
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const VERDICT_KO = { real: "실제 결함", misread: "오독", transition: "전환 프레임", by_design: "의도된 설계", not_visible: "보이지 않음", environment: "QA 환경", null: "판정 없음" };
const SEV_KO = { blocker: "진행 막힘", "save-data": "저장 데이터", function: "기능", visual: "시각", text: "글자" };
const OWNER_KO = { "game-data": "게임 데이터", engine: "엔진", editor: "에디터", assistant: "AI 조수" };
const fmt = (n) => (n == null ? "-" : Number(n).toLocaleString("ko-KR"));
const sec = (ms) => (ms == null ? "-" : `${Math.round(ms / 1000)}초`);

function copyImage(file, assetDir, assetRel) {
  if (!file || !fs.existsSync(file)) return null;
  const name = path.basename(path.dirname(path.dirname(file))) + "__" + path.basename(file);
  const dest = path.join(assetDir, name);
  if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
  return `${assetRel}/${name}`;
}

function usageRows(usage) {
  return Object.values(usage ?? {}).map((u) => `<tr><td>${esc(u.stage)}</td><td><code>${esc(u.model)}</code></td><td>${fmt(u.calls)}</td><td>${fmt(u.failed)}</td><td>${fmt(u.in)}</td><td>${fmt(u.cacheRead)}</td><td>${fmt(u.out)}</td><td>${sec(u.ms)}</td></tr>`).join("");
}

function candidateCard(c, assetDir, assetRel) {
  const imgs = (c.frames ?? []).map((f) => ({ role: f.role, src: copyImage(f.file, assetDir, assetRel) })).filter((x) => x.src);
  const r = c.review ?? {};
  return `<article class="card v-${esc(r.verdict)}">
  <header><span class="vid">${esc(c.id)}</span> <b>${esc(r.title_ko || c.title)}</b>
   <span class="tag">${esc(VERDICT_KO[r.verdict] ?? r.verdict)}</span>${r.severity ? `<span class="tag sev">${esc(SEV_KO[r.severity] ?? r.severity)}</span>` : ""}${r.owner ? `<span class="tag own">${esc(OWNER_KO[r.owner] ?? r.owner)}</span>` : ""}
   <span class="tag src">${esc(c.source)} · ${esc(c.check)}</span>${r.confidence ? `<span class="tag">신뢰도 ${Number(r.confidence).toFixed(2)}</span>` : ""}</header>
  ${imgs.length ? `<div class="imgs">${imgs.map((i) => `<figure><a href="${esc(i.src)}" target="_blank"><img loading="lazy" src="${esc(i.src)}" alt="${esc(i.role)}"></a><figcaption>${esc(i.role)}</figcaption></figure>`).join("")}</div>` : ""}
  <dl><dt>주장</dt><dd>${esc(c.claim)}</dd>
  ${c.where ? `<dt>어디서</dt><dd>${esc(c.where)}</dd>` : ""}
  ${r.evidence_ko ? `<dt>검토 근거</dt><dd>${esc(r.evidence_ko)}</dd>` : ""}
  ${r.repro_ko ? `<dt>재현</dt><dd>${esc(r.repro_ko)}</dd>` : ""}
  ${r.fix_hint_ko ? `<dt>고칠 곳</dt><dd>${esc(r.fix_hint_ko)}</dd>` : ""}
  ${c.count ? `<dt>빈도</dt><dd>${fmt(c.count)}회 · ${fmt(c.sessions)}세션</dd>` : ""}</dl></article>`;
}

export function runSection(dir, { assetDir, assetRel, title }) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, "summary.json"), "utf8"));
  const reviewed = JSON.parse(fs.readFileSync(path.join(dir, "reviewed.json"), "utf8"));
  const queue = JSON.parse(fs.readFileSync(path.join(dir, "fix-queue.json"), "utf8"));
  const byId = new Map(reviewed.map((c) => [c.id, c]));
  const vc = s.final.verdictCounts;
  const m = s.measure;
  const totalMs = Object.values(s.timings ?? {}).reduce((a, b) => a + b, 0);
  const kept = reviewed.filter((c) => c.review?.verdict === "real");
  const rejected = reviewed.filter((c) => c.review?.verdict && c.review.verdict !== "real");
  return `<section id="${esc(s.tag)}"><h2>${esc(title ?? `${s.game} ${s.version}${s.plant ? " · 결함 심음 " + s.plant : ""}`)}</h2>
<div class="kpis">
 <div><b>${fmt(s.play.ran)}</b><span>플레이 세션</span></div>
 <div><b>${fmt(s.detect.frames)}</b><span>정착 프레임</span></div>
 <div><b>${fmt(s.detect.observeSelected)}</b><span>관찰 모델에 보낸 프레임</span></div>
 <div><b>${fmt(s.final.candidates)}</b><span>후보 결함</span></div>
 <div><b>${fmt(vc.real)}</b><span>Opus 검토 후 실제</span></div>
 <div><b>${fmt(queue.length)}</b><span>수정 큐(병합 후)</span></div>
 ${m ? `<div><b>${m.caughtAfter}/${m.planted}</b><span>심은 결함 포착(검토 후)</span></div>` : ""}
 <div><b>${sec(totalMs)}</b><span>전체 시간</span></div>
</div>
<h3>커버리지 계획</h3>
<p>맵 ${fmt(s.coverage.plannedMaps)}/${fmt(s.coverage.maps)} · 전투 ${fmt(s.coverage.plannedBattles)}/${fmt(s.coverage.troops)}부대 · 종류 ${esc(JSON.stringify(s.coverage.byKind))} · 입력 ${esc(JSON.stringify(s.coverage.byInput))} · 해상도 ${esc(JSON.stringify(s.coverage.byViewport))}</p>
<p>동시 세션 최고 ${fmt(s.play.peakSessions)} · cgroup 메모리 최고 ${s.play.peakMemGB} GB · 실패 세션 ${fmt(s.detect.fatal)} · 외부 요청(차단) ${fmt(s.detect.blockedRequests)}</p>
<h3>단계별 시간 · 모델 토큰</h3>
<table><tr><th>단계</th><th>시간</th></tr>${Object.entries(s.timings ?? {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${sec(v)}</td></tr>`).join("")}</table>
<table><tr><th>단계</th><th>모델</th><th>호출</th><th>실패</th><th>입력 토큰</th><th>캐시 읽기</th><th>출력 토큰</th><th>누적 호출 시간</th></tr>${usageRows(s.usage)}</table>
<h3>후보 → 검토 결과</h3>
<p>후보 ${fmt(s.final.candidates)}건 = 결정적 검사 ${fmt(s.cluster.bySource.deterministic)} · 정적 검사 ${fmt(s.cluster.bySource.static)} · 관찰 모델 군집 ${fmt(s.cluster.bySource.observer)} (관찰 이슈 ${fmt(s.cluster.observerIssues)}건). Opus 판정: ${Object.entries(vc).filter(([, n]) => n).map(([k, n]) => `${esc(VERDICT_KO[k] ?? k)} ${n}`).join(" · ")}.</p>
${m ? `<h3>심은 결함 포착</h3><table><tr><th>결함</th><th>위치</th><th>보이는 모습</th><th>검토 전</th><th>검토 후</th><th>잡은 후보</th></tr>${m.plants.map((p) => `<tr><td>${esc(p.type)}</td><td>${esc(p.mapName ?? p.mapId)} ${esc(p.eventId ?? "")}</td><td>${esc(p.visible)}</td><td>${p.caughtBefore ? "✅" : "❌"}</td><td>${p.caughtAfter ? "✅" : "❌"}</td><td>${p.candidates.map((c) => `${esc(c.id)}(${esc(c.check)}→${esc(VERDICT_KO[c.verdict] ?? c.verdict)})`).join(" ")}</td></tr>`).join("")}</table>
<p>심은 결함과 무관한 후보 ${fmt(m.nonPlantCandidates)}건 중 Opus가 실제로 남긴 것 ${fmt(m.nonPlantKept)}건 (${esc(m.nonPlantKeptIds.join(", "))}) — 아래 수정 큐에서 확인.</p>` : ""}
<h3>수정 큐 (Opus 병합·순위)</h3>
<table><tr><th>순위</th><th>제목</th><th>심각도</th><th>트랙</th><th>신뢰도</th><th>후보</th></tr>${queue.map((q) => `<tr><td>${q.rank}</td><td>${esc(q.title_ko)}</td><td>${esc(SEV_KO[q.severity] ?? q.severity)}</td><td>${esc(q.track)} · ${esc(OWNER_KO[q.owner] ?? q.owner)}</td><td>${q.confidence ?? "-"}</td><td>${esc(q.candidates.join(", "))}</td></tr>`).join("")}</table>
<h3>남긴 결함 (증거)</h3>${kept.map((c) => candidateCard(byId.get(c.id), assetDir, assetRel)).join("")}
<details><summary>기각한 후보 ${rejected.length}건 (사유별)</summary>${rejected.slice(0, 60).map((c) => candidateCard(c, assetDir, assetRel)).join("")}</details>
</section>`;
}

/** Labelled re-review: candidates carry a human `label` (ok|fp|tr|na); shows label x verdict and the cards. */
export function benchSection(dir, { assetDir, assetRel, title }) {
  const reviewed = JSON.parse(fs.readFileSync(path.join(dir, "reviewed.json"), "utf8"));
  const final = JSON.parse(fs.readFileSync(path.join(dir, "final.json"), "utf8"));
  const usage = Object.values(JSON.parse(JSON.stringify(readUsageSync(path.join(dir, "usage.jsonl")))));
  const LABEL_KO = { ok: "실제 결함", fp: "오독", tr: "전환 프레임", na: "재현 불가" };
  const verdicts = ["real", "misread", "transition", "by_design", "not_visible", "environment"];
  const labels = Object.keys(LABEL_KO).filter((l) => reviewed.some((c) => c.label === l));
  const cell = (l, v) => reviewed.filter((c) => c.label === l && c.review?.verdict === v).length;
  const keptReal = reviewed.filter((c) => c.review?.verdict === "real");
  const truePos = keptReal.filter((c) => c.label === "ok").length;
  const realLabelled = reviewed.filter((c) => c.label === "ok").length;
  return `<section id="bench"><h2>${esc(title)}</h2>
<div class="kpis"><div><b>${reviewed.length}</b><span>이전 판정기 「확정」</span></div><div><b>${Math.round((realLabelled / reviewed.length) * 100)}%</b><span>검토 전 정밀도</span></div><div><b>${keptReal.length ? Math.round((truePos / keptReal.length) * 100) : 0}%</b><span>Opus 검토 후 정밀도 (${truePos}/${keptReal.length})</span></div><div><b>${truePos}/${realLabelled}</b><span>실제 결함 유지(재현율)</span></div><div><b>${sec(final.ms)}</b><span>검토 시간</span></div></div>
<table><tr><th>사람 라벨 \\ Opus 판정</th>${verdicts.map((v) => `<th>${esc(VERDICT_KO[v])}</th>`).join("")}</tr>${labels.map((l) => `<tr><td>${esc(LABEL_KO[l])} (${reviewed.filter((c) => c.label === l).length})</td>${verdicts.map((v) => `<td>${cell(l, v) || ""}</td>`).join("")}</tr>`).join("")}</table>
<table><tr><th>단계</th><th>모델</th><th>호출</th><th>입력 토큰</th><th>출력 토큰</th></tr>${usage.map((u) => `<tr><td>${esc(u.stage)}</td><td><code>${esc(u.model)}</code></td><td>${fmt(u.calls)}</td><td>${fmt(u.in)}</td><td>${fmt(u.out)}</td></tr>`).join("")}</table>
<details><summary>29건 카드 (라벨 · Opus 판정 · 근거)</summary>${reviewed.map((c) => candidateCard({ ...c, title: `[라벨: ${LABEL_KO[c.label]}] ${c.title}` }, assetDir, assetRel)).join("")}</details></section>`;
}

function readUsageSync(file) {
  const by = {};
  if (!fs.existsSync(file)) return by;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    const a = (by[`${r.stage}|${r.model}`] ??= { stage: r.stage, model: r.model, calls: 0, in: 0, out: 0 });
    a.calls += 1; a.in += r.in ?? 0; a.out += r.out ?? 0;
  }
  return by;
}

export const STYLE = `body{font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif;margin:0;background:#0f1216;color:#e6e9ee;line-height:1.55}
main{max-width:1180px;margin:0 auto;padding:24px 18px 80px}h1{font-size:26px;margin:8px 0}h2{font-size:21px;margin-top:40px;border-bottom:1px solid #2a3240;padding-bottom:6px}h3{font-size:16px;margin-top:24px;color:#b9c4d6}
.sub{color:#93a0b4}.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:14px 0}.kpis div{background:#171c24;border:1px solid #263041;border-radius:10px;padding:10px 12px}.kpis b{display:block;font-size:22px}.kpis span{color:#93a0b4;font-size:13px}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:14px;display:block;overflow-x:auto}td,th{border:1px solid #263041;padding:6px 8px;text-align:left;vertical-align:top}th{background:#171c24}
.card{background:#151a21;border:1px solid #263041;border-left:4px solid #556;border-radius:8px;padding:10px 12px;margin:12px 0}.card.v-real{border-left-color:#3fb950}.card.v-misread{border-left-color:#f85149}.card.v-transition{border-left-color:#d29922}.card.v-by_design{border-left-color:#8b949e}
.tag{display:inline-block;font-size:12px;background:#222b38;border-radius:6px;padding:1px 7px;margin:2px 3px}.tag.sev{background:#3a2430}.tag.own{background:#1f3326}.vid{color:#93a0b4;font-family:monospace}
.imgs{display:flex;gap:8px;overflow-x:auto;margin:8px 0}.imgs figure{margin:0;flex:0 0 auto}.imgs img{height:190px;max-width:340px;object-fit:contain;background:#000;border-radius:4px}figcaption{font-size:12px;color:#93a0b4}
a{color:#79c0ff}
pre{background:#171c24;border:1px solid #263041;border-radius:8px;padding:10px;white-space:pre-wrap;word-break:break-all}
dl{display:grid;grid-template-columns:90px 1fr;gap:4px 10px;margin:6px 0;font-size:14px}dt{color:#93a0b4}dd{margin:0}code{font-size:12px}details summary{cursor:pointer;color:#9ecbff;margin:12px 0}
.flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0}.flow span{background:#1d2633;border:1px solid #2f3b4f;border-radius:8px;padding:6px 10px;font-size:14px}.flow i{color:#93a0b4;font-style:normal}
@media (max-width:600px){main{padding:14px 10px}h1{font-size:21px}.imgs img{height:140px;max-width:250px}dl{grid-template-columns:70px 1fr}}`;

export function renderReport(dirs, { outDir, name, intro = "", extra = "", bench = "" }) {
  const assetDir = path.join(outDir, name);
  fs.mkdirSync(assetDir, { recursive: true });
  const sections = (bench ? benchSection(bench, { assetDir, assetRel: name, title: "검토 단계 단독 측정: 지난 3데모 VQA 「확정」 재판정" }) : "") + dirs.map((d) => runSection(d, { assetDir, assetRel: name })).join("\n");
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>게임 QA 파이프라인 보고서</title><style>${STYLE}</style></head><body><main>${intro}${extra}${sections}</main></body></html>`;
  fs.writeFileSync(path.join(outDir, `${name}.html`), html);
  return path.join(outDir, `${name}.html`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: "string" }, name: { type: "string", default: "qa-pipeline" }, bench: { type: "string", default: "" }, intro: { type: "string", default: "" } } });
  const intro = values.intro ? fs.readFileSync(values.intro, "utf8") : "";
  console.log(renderReport(positionals, { outDir: values.out, name: values.name, bench: values.bench, intro }));
}
