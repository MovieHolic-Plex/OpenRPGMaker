#!/usr/bin/env node
// Control-room video built only from a factory run's events.jsonl and the real smoke frames of each game.
//   node scripts/game-factory/render-dashboard.mjs --runs <runs dir>[,<runs dir>...] --out <file.mp4> [--seconds 75] [--fps 12]
// One tile per game (owner lane id), coloured by its state at that moment of the log; counters, builder gauge and
// checker/smoke tallies are read from the same rows. Real time is compressed linearly to --seconds (shown on screen).
// A finished tile shows that game's own smoke frame (first-map.png); nothing on screen is invented.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { firefox } from "playwright";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const RUNS = opt("runs", "").split(",").filter(Boolean).map((p) => resolve(p));
const OUT = resolve(opt("out", "dashboard.mp4"));
const SECONDS = Number(opt("seconds", 75));
const FPS = Number(opt("fps", 12));
if (!RUNS.length) { console.error("--runs required"); process.exit(2); }

// Several batches (pilot, rest) are laid end to end on one clock: each batch's mono is shifted by the wall-clock gap.
const rows = [];
// One events.jsonl may hold several dispatcher runs (an --adopt restart); each run has its own mono origin.
const all = RUNS.flatMap((dir) => readFileSync(resolve(dir, "events.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => ({ ...JSON.parse(l), dir })));
const firstWall = Math.min(...all.map((r) => Date.parse(r.at)));
const origin = new Map();
for (const r of all) if (!origin.has(r.run)) origin.set(r.run, (Date.parse(r.at) - firstWall) / 1000 - r.mono / 1000);
for (const r of all) rows.push({ ...r, t: r.mono / 1000 + origin.get(r.run) });
rows.sort((a, b) => a.t - b.t);
const T_END = rows.at(-1).t;
const games = [...new Set(rows.filter((r) => r.id).map((r) => r.id))].sort();
const specOf = (id) => { for (const d of RUNS) { const f = resolve(d, id, "spec.json"); if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")); } return {}; };
const shotOf = (id) => { for (const d of RUNS) { const f = resolve(d, id, "smoke", "frames"); if (existsSync(f)) { const p = readdirSync(f).find((n) => n.includes("first-map")) ?? readdirSync(f).find((n) => n.endsWith(".png")); if (p) return `data:image/png;base64,${readFileSync(resolve(f, p)).toString("base64")}`; } } return null; };
const meta = Object.fromEntries(games.map((id) => [id, { spec: specOf(id), shot: shotOf(id) }]));

function stateAt(t) {
  const g = Object.fromEntries(games.map((id) => [id, { state: "queued", attempt: 0, hostCalls: 0, phase: null, code: null, checker: null, smoke: null }]));
  let retries = 0;
  // Several dispatchers (batches, restarts) run at once: the live builder count is the sum of each run's latest gauge.
  const lastGauge = new Map();
  const series = [];
  for (const r of rows) {
    if (r.t > t) break;
    const s = r.id ? g[r.id] : null;
    if (r.type === "gauge" && r.builders != null) {
      lastGauge.set(r.run, r);
      const live = [...lastGauge.values()].filter((x) => r.t - x.t < 30);
      series.push([r.t, live.reduce((n, x) => n + x.builders, 0)]);
    }
    if (r.type === "end") lastGauge.delete(r.run);
    if (!s) continue;
    if (r.type === "spawn") { if (s.code) retries += 1; s.state = "building"; s.attempt = r.attempt; s.code = null; s.checker = null; s.smoke = null; }
    if (r.type === "ack") s.state = "building";
    if (r.type === "progress") { if (r.hostCalls != null) s.hostCalls = r.hostCalls; if (r.phase === "check") s.state = "checking"; if (r.phase === "smoke") { s.state = "smoking"; s.checker = r.checker; } }
    if (r.type === "retry") { retries += 1; s.state = "retry"; }
    if (r.type === "done") {
      // An --adopt re-check writes a second done row for the same build; the latest row is the game's state.
      s.code = r.code; s.checker = r.checker; s.smoke = r.smoke;
      s.state = r.code === "finished" ? (r.smoke === "PASS" ? "pass" : "smokefail") : r.code;
    }
  }
  const c = { retries, done: 0, finished: 0, capped: 0, failed: 0, checkerPass: 0, checkerFail: 0, smokePass: 0, smokeFail: 0 };
  for (const s of Object.values(g)) {
    if (!s.code) continue;
    c.done += 1;
    if (s.code === "finished") c.finished += 1; else if (s.code === "capped") c.capped += 1; else c.failed += 1;
    if (s.checker) { const [p, n] = s.checker.split("/").map(Number); c.checkerPass += p; c.checkerFail += n - p; }
    if (s.smoke === "PASS") c.smokePass += 1; else if (s.smoke) c.smokeFail += 1;
  }
  const live = [...lastGauge.values()].filter((x) => t - x.t < 30);
  const gauge = { builders: live.reduce((n, x) => n + x.builders, 0), queued: live.reduce((n, x) => n + (x.queued ?? 0), 0), globalAgents: Math.max(0, ...live.map((x) => x.globalAgents ?? 0)) };
  return { g, c, gauge, series };
}

const COLORS = { queued: "#3a3f4b", building: "#2f6fd6", retry: "#d68a2f", checking: "#7b4fd6", smoking: "#14a3a3", pass: "#2fa84f", smokefail: "#c9a227", capped: "#7a7a7a", failed: "#c43c3c" };
const LABEL = { queued: "대기", building: "빌드 중", retry: "재시도", checking: "검사 중", smoking: "스모크", pass: "완료·스모크 통과", smokefail: "완료·스모크 실패", capped: "90분 상한(미완)", failed: "실패" };
const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function html(t) {
  const { g, c, gauge, series } = stateAt(t);
  const cols = games.length > 16 ? 6 : 4;
  const tiles = games.map((id) => {
    const s = g[id]; const m = meta[id];
    const img = (s.state === "pass" || s.state === "smokefail") && m.shot ? `<img src="${m.shot}">` : "";
    const bar = s.state === "building" ? `<div class="bar"><i style="width:${Math.min(100, s.hostCalls / 2)}%"></i></div><div class="sub">도구 호출 ${s.hostCalls}</div>` : "";
    const res = s.checker ? `<div class="sub">검사 ${s.checker}${s.smoke ? ` · 스모크 ${s.smoke}` : ""}</div>` : "";
    return `<div class="tile" style="border-color:${COLORS[s.state]}"><div class="head" style="background:${COLORS[s.state]}"><b>${id}</b><span>${LABEL[s.state]}${s.attempt > 1 ? ` (${s.attempt}차)` : ""}</span></div>${img}<div class="body"><div class="genre">${m.spec.genre ?? ""}</div><div class="theme">${m.spec.theme ?? ""}</div>${bar}${res}</div></div>`;
  }).join("");
  const maxB = 8; const W = 380; const H = 90;
  const pts = series.map(([x, y]) => `${(x / Math.max(T_END, 1)) * W},${H - (y / maxB) * H}`).join(" ");
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;width:1920px;height:1080px;background:#11141a;color:#e8ecf3;font-family:'NanumSquare','Noto Sans CJK KR',sans-serif;overflow:hidden}
  header{display:flex;justify-content:space-between;align-items:flex-end;padding:22px 32px 10px}
  h1{margin:0;font-size:34px} .clock{font-size:30px;font-variant-numeric:tabular-nums}
  .wrap{display:flex;gap:24px;padding:0 32px}
  .grid{flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;align-content:start}
  .tile{border:3px solid;border-radius:10px;overflow:hidden;background:#1b1f28;height:${games.length > 16 ? 150 : 210}px;position:relative}
  .head{display:flex;justify-content:space-between;padding:4px 8px;font-size:15px;color:#fff} .head b{font-size:17px}
  .tile img{position:absolute;inset:28px 0 0 0;width:100%;height:calc(100% - 28px);object-fit:cover;opacity:.92;image-rendering:pixelated}
  .body{position:relative;padding:6px 8px;font-size:14px;text-shadow:0 1px 3px #000;background:linear-gradient(#000c,#0006 80%,#0000)}
  .genre{font-size:16px;font-weight:700} .theme{opacity:.8}
  .bar{height:7px;background:#333;border-radius:4px;margin-top:6px} .bar i{display:block;height:100%;background:#7fb2ff;border-radius:4px}
  .sub{font-size:13px;margin-top:3px}
  aside{width:420px} .card{background:#1b1f28;border-radius:10px;padding:14px 16px;margin-bottom:12px}
  .big{font-size:44px;font-weight:800;font-variant-numeric:tabular-nums} .k{opacity:.75;font-size:15px}
  .row{display:flex;justify-content:space-between;font-size:19px;margin:5px 0;font-variant-numeric:tabular-nums}
  .legend span{display:inline-block;margin:2px 8px 2px 0;font-size:13px} .legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:4px;vertical-align:-1px}
  footer{position:absolute;bottom:10px;left:32px;right:32px;font-size:14px;opacity:.7}
  </style><header><h1>게임 공장 관제실 — 게임 ${games.length}개, 게임마다 레인 1개(Terra high)</h1><div class="clock">실제 경과 ${fmt(t)} / ${fmt(T_END)}</div></header>
  <div class="wrap"><div class="grid">${tiles}</div><aside>
  <div class="card"><div class="k">지금 동시에 빌드 중인 레인 (상한 8)</div><div class="big">${gauge.builders ?? 0}</div><svg width="${W}" height="${H}" style="background:#141821;border-radius:6px"><line x1="0" x2="${W}" y1="0" y2="0" stroke="#c43c3c" stroke-dasharray="4 4"/><polyline fill="none" stroke="#7fb2ff" stroke-width="2.5" points="${pts}"/></svg><div class="k">대기열 ${gauge.queued ?? 0} · 박스 전체 omp ${gauge.globalAgents ?? 0}</div></div>
  <div class="card"><div class="row"><span>끝난 게임</span><b>${c.done}/${games.length}</b></div><div class="row"><span>완료</span><b style="color:#2fa84f">${c.finished}</b></div><div class="row"><span>90분 상한(미완)</span><b style="color:#9a9a9a">${c.capped}</b></div><div class="row"><span>실패</span><b style="color:#c43c3c">${c.failed}</b></div><div class="row"><span>재시도·재빌드</span><b style="color:#d68a2f">${c.retries}</b></div></div>
  <div class="card"><div class="k">기계 검사(check.py v2, 7항목) · 스모크(60초 입력)</div><div class="row"><span>검사 PASS 항목</span><b>${c.checkerPass}</b></div><div class="row"><span>검사 FAIL 항목 = 찾은 결함</span><b style="color:#d68a2f">${c.checkerFail}</b></div><div class="row"><span>스모크 통과 / 실패</span><b>${c.smokePass} / ${c.smokeFail}</b></div></div>
  <div class="card legend">${Object.entries(LABEL).map(([k, v]) => `<span><i style="background:${COLORS[k]}"></i>${v}</span>`).join("")}</div>
  </aside></div><footer>모든 숫자·색은 events.jsonl 실측 행에서 계산. 시간은 선형 압축(실제 ${fmt(T_END)} → 영상 ${SECONDS}초). 타일 그림 = 그 게임 스모크 실측 프레임. 빌드 중 막대 = 에이전트 호스트 도구 호출 수(실측, 100칸 = 200회로 맞춘 표시 척도).</footer>`;
}

const frames = resolve(tmpdir(), `gf-dash-${process.pid}`);
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const browser = await firefox.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const N = SECONDS * FPS;
  for (let i = 0; i < N; i += 1) {
    const t = T_END * Math.min(1, i / (N - FPS * 4));
    await page.setContent(html(t));
    await page.screenshot({ path: resolve(frames, `${String(i).padStart(5, "0")}.png`) });
  }
} finally { await browser.close(); }
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", resolve(frames, "%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", OUT]);
rmSync(frames, { recursive: true, force: true });
console.log(JSON.stringify({ out: OUT, games: games.length, realSec: Math.round(T_END), videoSec: SECONDS }));
