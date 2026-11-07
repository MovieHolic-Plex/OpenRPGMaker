#!/usr/bin/env node
// 폴른 스타 광범위 QA 보고서 — 한 실행 디렉터리(파이프라인 산출물) + 전투 시뮬 + 램프 기록을 읽어
// 이미지 위주 한국어 HTML 한 장을 만든다. 그림은 보고서 옆 폴더로 복사해 페이지가 어디서든 뜨게 한다.
//
//   node scripts/qa/broad/report.mjs --run <runDir> --sim <sim.json> --health <health.jsonl>
//        --coverage <coverage-plan.json> [--plant <measure.json>] --out ~/claude-viz --name fs-broad-qa
//
// sections: 요약 KPI · 맵 갤러리(맵마다 대표 화면) · 전투 승률표(상태별) · 결함 목록(증거 그림·재현·담당)
// · 못 간 곳 · 심은 결함 포착률 · 시간·토큰 · 수정 큐
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    sim: { type: "string", default: "" },
    health: { type: "string", default: "" },
    coverage: { type: "string", default: "" },
    plant: { type: "string", default: "" },
    out: { type: "string" },
    name: { type: "string", default: "fs-broad-qa" },
    title: { type: "string", default: "폴른 스타 1.39 — 광범위 적대적 QA" },
    /** pull-gallery.mjs output dir (gallery.json + jobs/<id>/shots/). Preferred source for the map/battle images. */
    gallery: { type: "string", default: "" },
  },
});
if (!values.run || !values.out) throw new Error("usage: report.mjs --run <runDir> --out <dir>");

const RUN = path.resolve(values.run);
const OUT = path.resolve(values.out);
const NAME = values.name;
const ASSET = path.join(OUT, `${NAME}-assets`);
fs.mkdirSync(ASSET, { recursive: true });
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const readJsonl = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => (n == null || Number.isNaN(n) ? "-" : Number(n).toLocaleString("ko-KR"));
const sec = (ms) => (ms == null ? "-" : ms > 120000 ? `${Math.round(ms / 60000)}분` : `${Math.round(ms / 1000)}초`);

let assetSeq = 0;
/** Copy one evidence image next to the page; returns the relative URL. */
function asset(file) {
  if (!file || !fs.existsSync(file)) return null;
  assetSeq += 1;
  const name = `${String(assetSeq).padStart(4, "0")}-${path.basename(path.dirname(path.dirname(file)))}-${path.basename(file)}`.replace(/[^a-zA-Z0-9_.-]/g, "-");
  const dest = path.join(ASSET, name);
  if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
  return `${NAME}-assets/${name}`;
}

const jobs = readJson(path.join(RUN, "jobs.json"));
const jobById = new Map(jobs.map((job) => [job.id, job]));
const summary = readJson(path.join(RUN, "summary.json"));
const reviewed = readJson(path.join(RUN, "reviewed.json"));
const final = readJson(path.join(RUN, "final.json"));
const queue = readJson(path.join(RUN, "fix-queue.json"));
const coverage = values.coverage ? readJson(values.coverage) : summary.coverage;
const sim = values.sim ? readJson(values.sim) : null;
const health = values.health ? readJsonl(values.health) : [];
const measure = values.plant ? readJson(values.plant) : summary.measure;

/** Every frame row of one job, read from its trace (needed for the per-map gallery). */
function traceOf(jobId) {
  const file = path.join(RUN, "jobs", jobId, "trace.jsonl");
  return readJsonl(file);
}
function jobSummary(jobId) {
  const file = path.join(RUN, "jobs", jobId, "summary.json");
  return fs.existsSync(file) ? readJson(file) : null;
}
function shotPath(jobId, file) {
  return file ? path.join(RUN, "jobs", jobId, "shots", file) : null;
}

// ---------- per-map gallery: one representative settled frame per map ----------
const galleryDir = values.gallery ? path.resolve(values.gallery) : "";
const pulled = galleryDir && fs.existsSync(path.join(galleryDir, "gallery.json")) ? readJson(path.join(galleryDir, "gallery.json")) : null;
const mapJobs = jobs.filter((job) => job.kind === "map");
const gallery = [];
if (pulled) {
  // Pulled manifest: only the frames the VM chose were copied back, so this is the cheap path.
  for (const entry of pulled.maps ?? []) {
    const src = asset(path.join(galleryDir, "jobs", entry.job, "shots", entry.file));
    if (src) gallery.push({ mapId: entry.mapId, label: entry.label, src, row: { seq: entry.seq, state: { screen: entry.screen }, lum: entry.lum }, job: { id: entry.job } });
  }
} else {
  for (const job of mapJobs) {
    const rows = traceOf(job.id);
    const pick = rows.find((row) => /^walk-(up|right|down|left)$/.test(row.label ?? "") && row.file && (row.lum ?? 0) > 12)
      ?? rows.find((row) => row.file && row.label === "enter" && (row.lum ?? 0) > 12)
      ?? rows.find((row) => row.file && (row.lum ?? 0) > 12);
    if (pick) gallery.push({ mapId: job.target.mapId, label: job.label, src: asset(shotPath(job.id, pick.file)), row: pick, job });
  }
}
// Maps without a live frame (boot refused, dark, etc.) — reported explicitly, not silently dropped.
const mapIds = Object.keys(coverageMapIds());
function coverageMapIds() {
  const file = path.join(RUN, "coverage-plan.json");
  const c = fs.existsSync(file) ? readJson(file) : null;
  const ids = {};
  for (const job of mapJobs) ids[job.target.mapId] = true;
  return c ? Object.fromEntries(Object.keys(ids).map((id) => [id, true])) : ids;
}
const missingMaps = [...new Set(mapJobs.map((job) => job.target.mapId))].filter((id) => !gallery.some((g) => g.mapId === id));

// ---------- battle table: simulator rows + browser battle sessions ----------
function simTable() {
  if (!sim) return "";
  const byTroop = new Map();
  for (const row of sim.rows) {
    const entry = byTroop.get(row.troop) ?? { troop: row.troop, name: row.name, act: row.act, map: row.map, kind: row.kind, states: {} };
    entry.states[row.state] = row;
    byTroop.set(row.troop, entry);
  }
  const rows = [...byTroop.values()].sort((a, b) => {
    const la = a.states.expected?.level ?? 0;
    const lb = b.states.expected?.level ?? 0;
    return la - lb || String(a.troop).localeCompare(String(b.troop));
  });
  const cell = (row) => {
    if (!row) return "<td>-</td>";
    const cls = row.unwinnable ? "bad" : row.trivial ? "warn" : row.winRate < 60 ? "warn" : "ok";
    return `<td class="${cls}"><b>${row.winRate}%</b><br><span class="sub">Lv${row.level}·T${row.gearTier} · ${row.avgTurns}턴 · HP ${row.avgHpPct}%</span></td>`;
  };
  return `<table class="battles"><tr><th>막</th><th>부대</th><th>맵</th><th>예상</th><th>−3레벨·장비↓</th><th>+3레벨</th></tr>${rows.map((entry) => `<tr><td>${esc(entry.act ?? "—")}</td><td>${esc(entry.name)}<br><span class="sub">${esc(entry.troop)}</span></td><td><span class="sub">${esc(entry.map ?? "—")}</span></td>${cell(entry.states.expected)}${cell(entry.states.weak)}${cell(entry.states.strong)}</tr>`).join("")}</table>`;
}

// Browser (real play) battle sessions: did the checkpoint reach a battle screen and finish?
const battleJobs = jobs.filter((job) => job.kind === "battle");
const battleShot = new Map((pulled?.battles ?? []).map((entry) => [entry.job, entry]));
const battlePlay = battleJobs.map((job) => {
  const s = jobSummary(job.id);
  const rows = traceOf(job.id);
  const sawGrid = rows.some((row) => row.state?.grid === true || row.label?.includes("-grid"));
  const sawResult = rows.some((row) => row.state?.result);
  const shot = battleShot.get(job.id);
  const src = shot ? asset(path.join(galleryDir, "jobs", job.id, "shots", shot.file)) : null;
  return { job, summary: s, sawGrid, sawResult, src, fatal: s?.fatal ?? null };
});

// ---------- defects ----------
const VERDICT_KO = { real: "실제 결함", misread: "오독", transition: "전환 프레임", by_design: "의도된 설계", not_visible: "보이지 않음", environment: "QA 환경", null: "판정 없음" };
const SEV_KO = { blocker: "진행 막힘", "save-data": "저장 데이터", function: "기능", visual: "시각", text: "글자" };
const OWNER_KO = { "game-data": "게임 데이터", engine: "엔진", editor: "에디터", assistant: "AI 조수" };
const KIND_KO = { title: "타이틀", menu: "메뉴", map: "맵", event: "이벤트", shop: "상점·여관", ending: "엔딩", battle: "전투", adversarial: "적대적 입력" };

function defectCard(c) {
  const r = c.review ?? {};
  const imgs = (c.frames ?? []).map((f) => {
    const file = f.file ?? shotPath(f.job, f.rel?.split("/").pop());
    const src = asset(file);
    return src ? `<figure><a href="${esc(src)}" target="_blank"><img loading="lazy" src="${esc(src)}" alt="${esc(f.role)}"></a><figcaption>${esc(f.role)}</figcaption></figure>` : "";
  }).join("");
  return `<article class="card v-${esc(r.verdict ?? "null")}">
  <header><span class="vid">${esc(c.id)}</span> <b>${esc(r.title_ko || c.title)}</b>
   <span class="tag">${esc(VERDICT_KO[r.verdict] ?? r.verdict ?? "?")}</span>
   ${r.severity ? `<span class="tag sev">${esc(SEV_KO[r.severity] ?? r.severity)}</span>` : ""}
   ${r.owner ? `<span class="tag own">${esc(OWNER_KO[r.owner] ?? r.owner)}</span>` : ""}
   <span class="tag src">${esc(c.source)} · ${esc(c.check)}</span>
   ${r.floor === "measured" ? `<span class="tag floor">측정값 유지 (검토: ${esc(VERDICT_KO[r.reviewerVerdict] ?? r.reviewerVerdict)})</span>` : ""}
   ${r.confidence ? `<span class="tag">신뢰도 ${Number(r.confidence).toFixed(2)}</span>` : ""}</header>
  ${imgs ? `<div class="imgs">${imgs}</div>` : ""}
  <dl><dt>주장</dt><dd>${esc(c.claim)}</dd>
  ${c.where ? `<dt>어디서</dt><dd>${esc(c.where)}</dd>` : ""}
  ${r.evidence_ko ? `<dt>근거</dt><dd>${esc(r.evidence_ko)}</dd>` : ""}
  ${r.repro_ko ? `<dt>재현</dt><dd>${esc(r.repro_ko)}</dd>` : ""}
  ${r.fix_hint_ko ? `<dt>고칠 곳</dt><dd>${esc(r.fix_hint_ko)}</dd>` : ""}
  ${c.count ? `<dt>빈도</dt><dd>${fmt(c.count)}회 · ${fmt(c.sessions)}세션</dd>` : ""}</dl></article>`;
}

const kept = reviewed.filter((c) => c.review?.verdict === "real");
const rejected = reviewed.filter((c) => c.review?.verdict && c.review.verdict !== "real" && c.review.verdict !== null);
const groupsSorted = [...(final.groups ?? [])];

// ---------- couldn't reach ----------
const notReached = [];
for (const battle of battlePlay) {
  if (battle.fatal) notReached.push({ what: `전투 ${battle.job.target.troopId} (${battle.job.target.state})`, why: battle.fatal, job: battle.job });
  else if (!battle.sawGrid) notReached.push({ what: `전투 ${battle.job.target.troopId} (${battle.job.target.state})`, why: "전투 화면(명령 격자)이 뜨지 않음", job: battle.job });
}
const endingJob = jobs.find((job) => job.kind === "ending");
if (endingJob) {
  const s = jobSummary(endingJob.id);
  const rows = traceOf(endingJob.id);
  const sawEnding = rows.some((row) => row.state?.screen === "ending");
  if (!sawEnding) notReached.push({ what: "엔딩 화면", why: s?.fatal ?? `도달하지 못함 (마지막 화면: ${rows.at(-1)?.state?.screen ?? "?"})`, job: endingJob });
}
const shopJobs = jobs.filter((job) => job.kind === "shop");
const shopMissed = shopJobs.filter((job) => !traceOf(job.id).some((row) => row.state?.screen === "shop"));
for (const job of shopMissed) notReached.push({ what: `상점·여관 ${job.label}`, why: "상점 화면이 뜨지 않음", job });
// Observed "teleport" coverage: story fights on maps never walked (a checkpoint just points at the map, so this is
// the honest statement of what was NOT exercised as a normal player would).
const walkedMaps = new Set(mapJobs.filter((job) => !jobSummary(job.id)?.fatal).map((job) => job.target.mapId));
const troopMaps = new Set(battleJobs.map((job) => job.target.mapId));
const unwalked = [...troopMaps].filter((id) => !walkedMaps.has(id));

// ---------- health track ----------
function healthTrack() {
  if (!health.length) return "";
  const base = health[0]?.health?.ok_pct ?? null;
  const worst = health.reduce((acc, row) => (row.health?.ok_pct != null && (acc == null || row.health.ok_pct < acc) ? row.health.ok_pct : acc), null);
  const peakMem = health.reduce((acc, row) => Math.max(acc, row.memGB ?? 0), 0);
  const peakActive = health.reduce((acc, row) => Math.max(acc, row.health?.active ?? 0), 0);
  const rows = health.filter((_, index) => index % Math.max(1, Math.floor(health.length / 40)) === 0);
  const maxMem = Math.max(...health.map((row) => row.memGB ?? 0), 1);
  return `<div class="kpis">
    <div><b>${peakMem.toFixed(1)} GB</b><span>cgroup 메모리 최고 (상한 ${health[0]?.memMaxGB ?? "-"} GB)</span></div>
    <div><b>${base == null ? "-" : base.toFixed(2)}%</b><span>게이트웨이 ok_pct 시작</span></div>
    <div><b>${worst == null ? "-" : worst.toFixed(2)}%</b><span>게이트웨이 ok_pct 최저 (하락 ${base == null || worst == null ? "-" : (base - worst).toFixed(2)}p)</span></div>
    <div><b>${fmt(peakActive)}</b><span>게이트웨이 동시 사용자 최고</span></div>
  </div>
  <div class="spark">${rows.map((row) => `<i style="height:${Math.round(((row.memGB ?? 0) / maxMem) * 100)}%" title="${esc(row.at)} ${row.memGB}GB ok_pct ${row.health?.ok_pct ?? "?"}"></i>`).join("")}</div>
  <p class="sub">막대 = 15초 간격 cgroup 메모리(${health[0]?.memGB ?? "-"}–${peakMem.toFixed(1)} GB). 게이트웨이 손님 ok_pct 하락 폭이 5p 를 넘으면 동시 세션을 줄이기로 한 규칙 대비 실제 하락은 ${base == null || worst == null ? "-" : (base - worst).toFixed(2)}p 다.</p>`;
}

// ---------- tokens / time ----------
const usage = summary.usage ?? {};
const totalMs = Object.values(summary.timings ?? {}).reduce((a, b) => a + b, 0);
const tokenRows = (() => {
  const byModel = new Map();
  for (const row of readJsonl(path.join(RUN, "usage.jsonl"))) {
    const key = `${row.stage}|${row.model}`;
    const acc = byModel.get(key) ?? { stage: row.stage, model: row.model, calls: 0, failed: 0, in: 0, out: 0 };
    acc.calls += 1; acc.failed += row.ok ? 0 : 1; acc.in += row.in ?? 0; acc.out += row.out ?? 0;
    byModel.set(key, acc);
  }
  for (const row of readJsonl(path.join(RUN, "review-usage.jsonl"))) {
    const key = `${row.stage}|${row.model}`;
    const acc = byModel.get(key) ?? { stage: row.stage, model: row.model, calls: 0, failed: 0, in: 0, out: 0 };
    acc.calls += 1; acc.failed += row.ok ? 0 : 1; acc.in += row.in ?? 0; acc.out += row.out ?? 0;
    byModel.set(key, acc);
  }
  return [...byModel.values()];
})();
const totalTokens = tokenRows.reduce((a, row) => a + row.in + row.out, 0);

// ---------- fix queue ----------
const queueRows = queue.map((entry) => `<tr><td>${entry.rank}</td><td>${esc(SEV_KO[entry.severity] ?? entry.severity ?? "-")}</td><td>${esc(entry.title_ko)}</td><td>${esc(entry.track === "game-data" ? "게임 데이터" : "엔진·에디터·조수")}</td><td><span class="sub">${esc(entry.repro_ko ?? "")}</span></td><td><span class="sub">${esc(entry.fix_hint_ko ?? "")}</span></td></tr>`).join("");

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(values.title)}</title><style>
body{font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif;margin:0;background:#0e1116;color:#e8ecf3;line-height:1.55}
main{max-width:1220px;margin:0 auto;padding:26px 18px 90px}
h1{font-size:27px;margin:6px 0 2px}h2{font-size:20px;margin:44px 0 10px;border-bottom:1px solid #26303f;padding-bottom:6px}h3{font-size:15px;color:#aeb9cb;margin:22px 0 8px}
.sub{color:#8e9bb0;font-size:12.5px}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:10px;margin:16px 0}
.kpis div{background:#161c25;border:1px solid #26303f;border-radius:10px;padding:10px 12px}
.kpis b{display:block;font-size:21px}.kpis span{color:#8e9bb0;font-size:12.5px}
table{border-collapse:collapse;width:100%;margin:10px 0;font-size:13.5px;display:block;overflow-x:auto}
td,th{border:1px solid #26303f;padding:6px 8px;text-align:left;vertical-align:top}th{background:#161c25;position:sticky;top:0}
td.ok b{color:#4ec97a}td.warn b{color:#e0b341}td.bad b{color:#f0605a}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.gallery figure{margin:0;background:#141a22;border:1px solid #26303f;border-radius:10px;overflow:hidden}
.gallery img{width:100%;height:126px;object-fit:cover;display:block;background:#000}
.gallery figcaption{padding:6px 8px;font-size:12px;color:#c3cddd}
.card{background:#151b23;border:1px solid #26303f;border-left:4px solid #556;border-radius:10px;padding:10px 13px;margin:13px 0;min-width:0;overflow-wrap:anywhere}
.card.v-real{border-left-color:#4ec97a}.card.v-misread{border-left-color:#f0605a}.card.v-transition{border-left-color:#e0b341}.card.v-by_design{border-left-color:#8e9bb0}
.card header{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:6px}
.tag{display:inline-block;font-size:11.5px;background:#222b38;border-radius:6px;padding:1px 7px}
.tag.sev{background:#3a2430}.tag.own{background:#1f3326}.tag.floor{background:#4a3a12}.vid{color:#8e9bb0;font-family:ui-monospace,monospace}
.imgs{display:flex;gap:8px;overflow-x:auto;margin:8px 0}.imgs figure{margin:0;flex:0 0 auto}
.imgs img{height:210px;max-width:380px;object-fit:contain;background:#000;border-radius:6px}
figcaption{font-size:11.5px;color:#8e9bb0}
dl{display:grid;grid-template-columns:98px minmax(0,1fr);gap:5px 10px;margin:6px 0;font-size:13.5px}dt{color:#8e9bb0}dd{margin:0;min-width:0;overflow-wrap:anywhere}
.spark{display:flex;gap:1px;align-items:flex-end;height:90px;background:#11161d;border:1px solid #26303f;border-radius:8px;padding:6px;margin:10px 0}
.spark i{flex:1;background:linear-gradient(#4a7fd4,#25406b);min-width:2px;border-radius:1px 1px 0 0}
.flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:12px 0}.flow span{background:#1b2430;border:1px solid #2d3a4c;border-radius:8px;padding:5px 10px;font-size:13px}.flow i{color:#8e9bb0;font-style:normal}
a{color:#7fb6ff}code{font-size:12px;background:#1b2430;padding:1px 5px;border-radius:4px}
details summary{cursor:pointer;color:#9ecbff;margin:10px 0}
@media (max-width:640px){main{padding:14px 10px}h1{font-size:21px}.imgs img{height:150px;max-width:260px}dl{grid-template-columns:74px minmax(0,1fr)}td,th{padding:4px 5px;font-size:12px}.gallery{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}.gallery img{height:96px}}
</style></head><body><main>
<h1>${esc(values.title)}</h1>
<p class="sub">출하본 ${esc(summary.version)} · 게임 ${esc(summary.game)} · QA:VQA 5:5 · 적대적 플레이 · 스크린샷 ${fmt(summary.detect?.frames)}장 · 세션 ${fmt(summary.play?.ran)}</p>

<div class="flow"><span>계획</span><i>→</i><span>플레이(VM 미러)</span><i>→</i><span>결정적 검사</span><i>→</i><span>관찰 모델</span><i>→</i><span>군집</span><i>→</i><span>검토(${esc((final.reviewerChain ?? []).join(" → "))}${final.reviewerAnsweredBy ? ` · 실제 응답: ${esc(final.reviewerAnsweredBy)}` : ""})</span><i>→</i><span>이 보고서</span></div>

<div class="kpis">
 <div><b>${fmt(summary.play?.ran)}</b><span>플레이 세션</span></div>
 <div><b>${fmt(summary.detect?.frames)}</b><span>정착 프레임</span></div>
 <div><b>${fmt(summary.coverage?.plannedMaps)}/${fmt(summary.coverage?.maps)}</b><span>맵 커버리지</span></div>
 <div><b>${fmt(summary.coverage?.plannedBattleTroops ?? 0)}/${fmt(summary.coverage?.troops)}</b><span>부대 커버리지(×3상태)</span></div>
 <div><b>${fmt(summary.final?.candidates)}</b><span>후보 결함</span></div>
 <div><b>${fmt(kept.length)}</b><span>검토 후 실제</span></div>
 <div><b>${fmt(queue.length)}</b><span>수정 큐</span></div>
 ${measure ? `<div><b>${measure.caughtAfter}/${measure.planted}</b><span>심은 결함 포착(검토 후)</span></div>` : ""}
 <div><b>${sec(totalMs)}</b><span>파이프라인 시간</span></div>
 <div><b>${fmt(totalTokens)}</b><span>모델 토큰(입력+출력)</span></div>
</div>

<h2>1. 맵 — 실제 화면 ${fmt(gallery.length)}장</h2>
<p class="sub">맵마다 정착 프레임 한 장(걷기 세션). 어두운 전환 프레임은 고르지 않았다. 클릭하면 원본 크기.</p>
<div class="gallery">${gallery.map((g) => `<figure><a href="${esc(g.src)}" target="_blank"><img loading="lazy" src="${esc(g.src)}" alt="${esc(g.mapId)}"></a><figcaption><b>${esc(g.label)}</b><br><span class="sub">${esc(g.mapId)} · ${esc(g.row.state?.screen ?? "")} · #${g.row.seq}</span></figcaption></figure>`).join("")}</div>
${missingMaps.length ? `<p class="sub">그림 없음: ${missingMaps.map(esc).join(", ")}</p>` : ""}

<h2>2. 전투 — 상태별 승률</h2>
<p class="sub">왼쪽 표는 화면 없이 전투 런타임을 ${fmt(sim?.samplesPerCell)}판씩 돌린 결과(공격만, 아이템 없음), 레벨·장비는 이야기 순서 누적 표(<code>story-levels.json</code>)에서 왔다. 오른쪽 숫자는 브라우저 체크포인트 세션 수.</p>
${simTable()}
<p class="sub">브라우저 전투 세션 ${fmt(battlePlay.length)} · 명령 격자 확인 ${fmt(battlePlay.filter((b) => b.sawGrid).length)} · 결과 화면 확인 ${fmt(battlePlay.filter((b) => b.sawResult).length)}</p>
${sim ? `<p class="sub">이길 수 없음(&lt;5%) ${fmt(sim.unwinnable.length)}건 · 너무 쉬움(100%·2.5턴 미만) ${fmt(sim.trivial.length)}건 · 이야기 표에 없는 부대 ${fmt(sim.missingStory.length)}개</p>` : ""}
<details><summary>브라우저 체크포인트 전투 세션 전체 보기</summary><table><tr><th>부대</th><th>상태</th><th>레벨</th><th>격자</th><th>결과</th><th>화면</th><th>실패</th></tr>${battlePlay.map((b) => `<tr><td>${esc(b.job.target.troopId)}</td><td>${esc(b.job.target.state ?? "-")}</td><td>Lv${b.job.target.level ?? "-"}</td><td>${b.sawGrid ? "✅" : "❌"}</td><td>${b.sawResult ? "✅" : "—"}</td><td>${b.src ? `<a href="${esc(b.src)}" target="_blank"><img loading="lazy" src="${esc(b.src)}" alt="battle" style="height:72px;border-radius:4px"></a>` : "—"}</td><td><span class="sub">${esc((b.fatal ?? "").slice(0, 90))}</span></td></tr>`).join("")}</table></details>

<h2>3. 결함 — 검토가 남긴 ${fmt(kept.length)}건</h2>
<p class="sub">후보 ${fmt(summary.final?.candidates)}건 → 검토 판정 ${Object.entries(final.verdictCounts ?? {}).filter(([, n]) => n).map(([k, n]) => `${esc(VERDICT_KO[k] ?? k)} ${n}`).join(" · ")}. 측정된 결함(DOM 잘림·404·페이지 오류·멈춤·대사 글자·정적 데이터)은 검토가 그림만 보고 버릴 수 없다.</p>
${kept.length ? kept.map(defectCard).join("") : "<p>검토가 실제 결함으로 남긴 후보가 없다.</p>"}
${rejected.length ? `<details><summary>검토가 기각한 ${fmt(rejected.length)}건 (오독·전환·의도된 설계·환경)</summary>${rejected.map(defectCard).join("")}</details>` : ""}

<h2>4. 못 간 곳</h2>
${notReached.length ? `<table><tr><th>무엇</th><th>왜</th></tr>${notReached.map((row) => `<tr><td>${esc(row.what)}</td><td><span class="sub">${esc(String(row.why).slice(0, 240))}</span></td></tr>`).join("")}</table>` : "<p>없음 — 계획한 모든 체크포인트가 목표 화면에 도달했다.</p>"}
${unwalked.length ? `<p class="sub">전투는 있으나 걷기 세션이 없는 맵(체크포인트로만 들어감): ${unwalked.map(esc).join(", ")}</p>` : ""}

<h2>5. 적대적 입력 · 심은 결함</h2>
<p class="sub">대사 몰아치기(키보드·터치), 전투 중 메뉴·취소 연타, 돈 없이 상점, 맵 가장자리 밀기, 세이브 반복, 키보드+마우스+터치 혼용 — ${fmt(jobs.filter((job) => job.kind === "adversarial").length)}개 시나리오.</p>
${(pulled?.adversarial ?? []).length ? `<div class="gallery">${pulled.adversarial.map((entry) => {
  const frame = entry.frames[entry.frames.length - 1];
  const src = frame ? asset(path.join(galleryDir, "jobs", entry.job, "shots", frame.file)) : null;
  return src ? `<figure><a href="${esc(src)}" target="_blank"><img loading="lazy" src="${esc(src)}" alt="${esc(entry.kind)}"></a><figcaption><b>${esc(entry.kind)}</b><br><span class="sub">${esc(entry.label ?? "")} · ${esc(entry.input ?? "")} · ${esc(entry.viewport ?? "")}</span></figcaption></figure>` : "";
}).join("")}</div>` : ""}
${measure ? `<table><tr><th>심은 결함</th><th>위치</th><th>보이는 모습</th><th>검토 전</th><th>검토 후</th></tr>${measure.plants.map((plant) => `<tr><td>${esc(plant.type)}</td><td>${esc(plant.mapName ?? plant.mapId)} ${esc(plant.eventId ?? "")}</td><td><span class="sub">${esc(plant.visible ?? "")}</span></td><td>${plant.caughtBefore ? "✅" : "❌"}</td><td>${plant.caughtAfter ? "✅" : "❌"}</td></tr>`).join("")}</table>
<p class="sub">포착 ${measure.caughtBefore}/${measure.planted} (검토 전) → ${measure.caughtAfter}/${measure.planted} (검토 후) · 심지 않은 후보 ${fmt(measure.nonPlantCandidates)}건 중 검토가 남긴 것 ${fmt(measure.nonPlantKept)}건</p>` : "<p>이 실행은 결함을 심지 않았다(plant 없음).</p>"}

<h2>6. 비용·시간</h2>
${healthTrack()}
<table><tr><th>단계</th><th>모델</th><th>호출</th><th>실패</th><th>입력 토큰</th><th>출력 토큰</th></tr>${tokenRows.map((row) => `<tr><td>${esc(row.stage)}</td><td><code>${esc(row.model)}</code></td><td>${fmt(row.calls)}</td><td>${fmt(row.failed)}</td><td>${fmt(row.in)}</td><td>${fmt(row.out)}</td></tr>`).join("")}</table>
<table><tr><th>단계</th><th>시간</th></tr>${Object.entries(summary.timings ?? {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${sec(v)}</td></tr>`).join("")}</table>
<p class="sub">동시 세션 최고 ${fmt(summary.play?.peakSessions)} · 실패 세션 ${fmt(summary.detect?.fatal)} · 차단된 외부 요청 ${fmt(summary.detect?.blockedRequests)}</p>

<h2>7. 수정 큐 (적용하지 않음)</h2>
<p class="sub">(a) 게임 데이터 수정과 (b) 엔진·에디터·조수 개선으로 나눈다. 두 갈래 모두 적용 전에 ultrabrain 동의를 받는다 — 이 레인은 큐만 넘긴다.</p>
${queueRows ? `<table><tr><th>#</th><th>심각도</th><th>결함</th><th>트랙</th><th>재현</th><th>고칠 곳</th></tr>${queueRows}</table>` : "<p>수정 큐가 비었다.</p>"}

<h2>8. 커버리지 계획</h2>
<p class="sub">작업 종류 ${Object.entries(coverage.byKind ?? {}).map(([k, n]) => `${esc(KIND_KO[k] ?? k)} ${fmt(n)}`).join(" · ")}</p>
<p class="sub">입력 ${Object.entries(coverage.byInput ?? {}).map(([k, n]) => `${esc(k)} ${fmt(n)}`).join(" · ")} · 화면 ${Object.entries(coverage.byViewport ?? {}).map(([k, n]) => `${esc(k)} ${fmt(n)}`).join(" · ")}</p>
<p class="sub">체크포인트 레벨 ${(coverage.checkpointLevels ?? []).join(", ")} · 전투 상태 ${Object.entries(coverage.battleStates ?? {}).map(([k, n]) => `${esc(k)} ${n}`).join(" · ")}</p>
</main></body></html>`;

const file = path.join(OUT, `${NAME}.html`);
fs.writeFileSync(file, html);
console.log(JSON.stringify({ file, images: assetSeq, maps: gallery.length, defects: kept.length, rejected: rejected.length, queue: queue.length, notReached: notReached.length }));
