#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE_DIR = resolve(process.cwd(), ".omo/evidence/faction-npc-combat");
const VIDEO_PATH = resolve(EVIDENCE_DIR, "faction-war.webm");
const GIF_PATH = resolve(EVIDENCE_DIR, "faction-war.gif");
const REPORT_PATH = resolve(EVIDENCE_DIR, "report.html");

const GIF_FPS = 25;
const GIF_SECONDS = 12;
const GIF_COLORS = 128;
/* 난전 + 좌하단 HP/ST 헤드업만 남긴다. 상단은 야수 리스폰 지점이라 살려둔다. */
const CROP = "crop=800:568:120:150";
/* lossy webm 은 정적인 풀밭에도 프레임마다 노이즈를 심어서 GIF 의 프레임 간 최적화를 전부 깨뜨린다
 * (배경만 잘라 비교해도 연속 프레임이 4천 픽셀 이상 달랐고, 결과가 10MB 였다).
 * 그래서 논리 해상도(320x240 기준 크롭 = 234x166)로 area 평균해 노이즈를 지운 뒤
 * neighbor 로 정수배 확대한다. 정적 영역이 진짜로 픽셀 동일해져 3.8MB 로 떨어지고 픽셀아트도 선명해진다. */
const NATIVE = "scale=234:166:flags=area";
const UPSCALE = "scale=iw*3:ih*3:flags=neighbor";
const FILTER_CHAIN = `${CROP},${NATIVE},${UPSCALE},fps=${GIF_FPS}`;
const STANCE_BAR_COLORS = [
  { stance: "적대 (-1 이하)", color: "#e0564a" },
  { stance: "중립 (0)", color: "#e8b53c" },
  { stance: "우호 (1 이상)", color: "#54c9a0" },
];
const PLAYER_ID = "__player__";
const PLAYER_COLOR = "#7ec8f0";
const STANCE_LABEL = { "-2": "최악의 적", "-1": "적", 0: "중립", 1: "우호", 2: "동맹" };

function loadTimeline() {
  const path = resolve(EVIDENCE_DIR, "timeline.json");
  if (!existsSync(path)) throw new Error(`timeline.json missing — run the capture spec first: ${EVIDENCE_DIR}`);
  if (!existsSync(VIDEO_PATH)) throw new Error(`video missing: ${VIDEO_PATH}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function videoDurationSec() {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", VIDEO_PATH,
  ], { encoding: "utf8" });
  return Number(out.trim());
}

/* 2-pass palette. dither 를 켜면 타일 격자에 노이즈가 깔려 프레임 간 최적화가 다시 무너진다. */
function buildGif(startSec) {
  const palette = resolve(EVIDENCE_DIR, "palette.png");
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-ss", String(startSec), "-t", String(GIF_SECONDS), "-i", VIDEO_PATH,
    "-vf", `${FILTER_CHAIN},palettegen=max_colors=${GIF_COLORS}:stats_mode=full`, palette,
  ], { stdio: "pipe" });
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-ss", String(startSec), "-t", String(GIF_SECONDS), "-i", VIDEO_PATH, "-i", palette,
    "-lavfi", `${FILTER_CHAIN}[s];[s][1:v]paletteuse=dither=none`,
    "-loop", "0", GIF_PATH,
  ], { stdio: "pipe" });
}

function extractFrame(atSec, index) {
  const out = resolve(EVIDENCE_DIR, `key-${String(index).padStart(2, "0")}.png`);
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-ss", String(atSec), "-i", VIDEO_PATH, "-frames:v", "1",
    "-vf", `${CROP},${NATIVE},${UPSCALE}`, out,
  ], { stdio: "pipe" });
  return out;
}

function dataUri(path, mime) {
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

function colorOf(data, factionId) {
  if (factionId === "player") return PLAYER_COLOR;
  return data.sides.find((side) => side.id === factionId)?.color ?? "#c9c2b4";
}

function nameOf(data, factionId) {
  if (factionId === "player") return "플레이어";
  return data.sides.find((side) => side.id === factionId)?.name ?? factionId;
}

function stanceBetween(data, a, b) {
  if (a === b) return 2;
  const hit = data.relations.find((relation) => (
    (relation.a === a && relation.b === b) || (relation.a === b && relation.b === a)
  ));
  return hit ? hit.stance : 0;
}

function relationMatrix(data) {
  const ids = ["player", ...data.sides.map((side) => side.id)];
  const head = ids.map((id) => `<th><span class="chip" style="--c:${colorOf(data, id)}">${nameOf(data, id)}</span></th>`).join("");
  const rows = ids.map((rowId) => {
    const cells = ids.map((colId) => {
      const stance = stanceBetween(data, rowId, colId);
      const cls = stance <= -1 ? "st-hostile" : stance === 0 ? "st-neutral" : "st-ally";
      return `<td class="${cls}"><b>${stance}</b><span>${STANCE_LABEL[String(stance)]}</span></td>`;
    }).join("");
    return `<tr><th class="rowh"><span class="chip" style="--c:${colorOf(data, rowId)}">${nameOf(data, rowId)}</span></th>${cells}</tr>`;
  }).join("\n");
  return `<table class="matrix"><thead><tr><th></th>${head}</tr></thead><tbody>\n${rows}\n</tbody></table>`;
}

function hpChart(data) {
  const timeline = data.timeline;
  const ids = [...new Set(timeline.flatMap((tick) => tick.enemies.map((enemy) => enemy.eventId)))];
  const w = 940;
  const h = 300;
  const padL = 46;
  const padB = 30;
  const maxSample = Math.max(1, timeline.length - 1);
  const xOf = (sample) => padL + ((w - padL - 14) * sample) / maxSample;
  const yOf = (ratio) => (h - padB) - (h - padB - 14) * ratio;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = yOf(ratio);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - 14}" y2="${y.toFixed(1)}" class="grid"/>`
      + `<text x="${padL - 8}" y="${(y + 4).toFixed(1)}" class="axis" text-anchor="end">${Math.round(ratio * 100)}%</text>`;
  }).join("");

  const enemyPaths = ids.map((id) => {
    const faction = timeline.flatMap((tick) => tick.enemies).find((enemy) => enemy.eventId === id)?.factionId;
    const color = colorOf(data, faction);
    const points = timeline.map((tick) => {
      const enemy = tick.enemies.find((entry) => entry.eventId === id);
      return enemy ? { x: xOf(tick.sample), y: yOf(enemy.hp / Math.max(1, enemy.maxHp)) } : null;
    });
    const segments = [];
    let run = [];
    for (const point of points) {
      if (point === null) { if (run.length > 1) segments.push(run); run = []; continue; }
      run.push(point);
    }
    if (run.length > 1) segments.push(run);
    const lines = segments.map((segment) => (
      `<polyline points="${segment.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" opacity="0.95"/>`
    )).join("");
    const deaths = segments
      .filter((segment) => {
        const lastIndex = points.findIndex((p) => p === segment.at(-1));
        return lastIndex >= 0 && lastIndex < points.length - 1 && points[lastIndex + 1] === null;
      })
      .map((segment) => `<circle cx="${segment.at(-1).x.toFixed(1)}" cy="${(h - padB - 1).toFixed(1)}" r="3.5" fill="${color}"/>`)
      .join("");
    return lines + deaths;
  }).join("");

  const playerPoints = timeline.map((tick) => `${xOf(tick.sample).toFixed(1)},${yOf(tick.playerHp / Math.max(1, data.initialHp)).toFixed(1)}`).join(" ");

  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="전투원별 HP 추이">
    ${grid}
    <line x1="${padL}" y1="${h - padB}" x2="${w - 14}" y2="${h - padB}" class="axis-line"/>
    ${enemyPaths}
    <polyline points="${playerPoints}" fill="none" stroke="${PLAYER_COLOR}" stroke-width="3" stroke-dasharray="6 3"/>
    <text x="${padL}" y="${h - 9}" class="axis">t = 0s</text>
    <text x="${w - 14}" y="${h - 9}" class="axis" text-anchor="end">t = ${((timeline.length * data.sampleIntervalMs) / 1000).toFixed(1)}s</text>
  </svg>`;
}

function pairEngagementRows(data) {
  const factionOf = new Map();
  for (const tick of data.timeline) for (const enemy of tick.enemies) factionOf.set(enemy.eventId, enemy.factionId);
  const tally = new Map();
  for (const tick of data.timeline) {
    for (const enemy of tick.enemies) {
      if (enemy.targetId === null) continue;
      const targetFaction = enemy.targetId === PLAYER_ID ? "player" : factionOf.get(enemy.targetId);
      if (targetFaction === undefined || targetFaction === enemy.factionId) continue;
      const key = `${enemy.factionId}\u0000${targetFaction}`;
      const entry = tally.get(key) ?? { from: enemy.factionId, to: targetFaction, samples: 0, firstMs: tick.atMs };
      entry.samples += 1;
      tally.set(key, entry);
    }
  }
  return [...tally.values()].sort((a, b) => b.samples - a.samples);
}

function render(data, gifUri, keyFrames, gifWindow) {
  const aliveCounts = data.timeline.map((tick) => tick.enemies.length);
  const totalSeconds = (data.timeline.length * data.sampleIntervalMs) / 1000;
  const verdicts = [
    {
      ok: data.hostilePairs.length === 3,
      label: "3자 상호 적대가 모두 성립",
      detail: `실제 교전한 적대 쌍: ${data.hostilePairs.map((pair) => pair.split("|").map((id) => nameOf(data, id)).join(" ↔ ")).join(", ")}`,
    },
    { ok: data.deaths > 0, label: "NPC 손에 의한 사망", detail: `캡처 중 전투원 ${data.deaths}명이 다른 NPC 에게 죽었다 (동시 생존 ${data.maxAlive} → ${data.minAlive})` },
    { ok: data.beastTargetedPlayer && data.finalHp < data.initialHp, label: "야수만 플레이어를 공격", detail: `플레이어 HP ${data.initialHp} → ${data.finalHp}. 야수는 플레이어를 targetId 로 잡았다` },
    { ok: data.wrongTargeting.length === 0, label: "산적·경비병은 플레이어를 무시", detail: `${data.timeline.length}개 샘플 전체에서 플레이어를 노린 산적·경비병 0건 — 태도 행렬이 대상을 고른다` },
  ];

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>3자 진영 전쟁 실측 증거 — OPRN</title>
<style>
  :root {
    --bg:#12141a; --panel:#191c23; --panel2:#20242d; --line:#2c313b;
    --ink:#e9e7e2; --muted:#989ea9; --ok:#62c98d; --bad:#e0564a;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font:15px/1.65 ui-sans-serif, system-ui, "Pretendard", "Noto Sans KR", sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:1040px; margin:0 auto; padding:56px 24px 96px; }
  header { border-bottom:1px solid var(--line); padding-bottom:26px; margin-bottom:36px; }
  h1 { font-size:31px; line-height:1.22; margin:0 0 10px; letter-spacing:-0.022em; }
  .sub { color:var(--muted); margin:0; font-size:13.5px; }
  h2 { font-size:19px; margin:46px 0 12px; letter-spacing:-0.01em; }
  p { margin:0 0 14px; }
  .lede { font-size:16px; color:#d4d1cb; }
  .verdicts { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(232px,1fr)); margin:22px 0 6px; }
  .verdict { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .verdict .top { display:flex; align-items:center; gap:8px; font-weight:650; font-size:14px; }
  .dot { width:9px; height:9px; border-radius:50%; flex:none; }
  .pass .dot { background:var(--ok); box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 22%,transparent); }
  .fail .dot { background:var(--bad); box-shadow:0 0 0 3px color-mix(in srgb,var(--bad) 22%,transparent); }
  .verdict .detail { color:var(--muted); font-size:12.5px; margin-top:6px; }
  figure { margin:0 0 8px; }
  .gif { width:100%; border-radius:12px; border:1px solid var(--line); display:block; background:#000; }
  figcaption { color:var(--muted); font-size:13px; margin-top:10px; }
  .frames { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(290px,1fr)); margin-top:16px; }
  .frame { background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .frame img { width:100%; display:block; background:#000; }
  .frame .meta { padding:11px 13px 13px; }
  .frame .label { font-weight:650; font-size:13.5px; }
  .chart { width:100%; height:auto; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px; }
  .grid { stroke:#282d35; stroke-width:1; }
  .axis-line { stroke:#3a4048; stroke-width:1; }
  .axis { fill:#7d838e; font:11px ui-monospace, monospace; }
  table { width:100%; border-collapse:collapse; font:12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; margin-top:12px; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
  .matrix { text-align:center; }
  .matrix th, .matrix td { text-align:center; border:1px solid var(--line); }
  .matrix .rowh { text-align:right; }
  .matrix td b { display:block; font-size:15px; }
  .matrix td span { display:block; font-size:10.5px; color:var(--muted); margin-top:1px; }
  .st-hostile { background:color-mix(in srgb,var(--bad) 16%,transparent); }
  .st-neutral { background:color-mix(in srgb,#e8b53c 10%,transparent); }
  .st-ally { background:color-mix(in srgb,var(--ok) 12%,transparent); }
  .chip { display:inline-block; padding:1px 8px; border-radius:999px; font-size:11px; white-space:nowrap;
    color:var(--c); border:1px solid color-mix(in srgb,var(--c) 45%,transparent);
    background:color-mix(in srgb,var(--c) 13%,transparent); }
  .stats { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(146px,1fr)); margin:18px 0; }
  .stat { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:13px 15px; }
  .stat .n { font:650 21px/1.2 ui-monospace, monospace; letter-spacing:-0.01em; }
  .stat .k { color:var(--muted); font-size:12px; margin-top:3px; }
  .legend { display:flex; gap:16px; flex-wrap:wrap; color:var(--muted); font-size:13px; margin-top:12px; }
  .swatch { display:inline-block; width:11px; height:11px; border-radius:3px; margin-right:6px; vertical-align:-1px; }
  .dash { display:inline-block; width:16px; height:0; border-top:3px dashed ${PLAYER_COLOR}; margin-right:6px; vertical-align:3px; }
  code { background:var(--panel2); border:1px solid var(--line); border-radius:4px; padding:1px 5px; font:12.5px ui-monospace, monospace; }
  .note-box { background:var(--panel); border:1px solid var(--line); border-left:3px solid ${PLAYER_COLOR};
    border-radius:8px; padding:14px 16px; color:#cfccc6; font-size:14px; }
  .note-box ul { margin:10px 0 0; padding-left:20px; }
  .note-box li { margin-bottom:4px; }
  footer { margin-top:54px; padding-top:22px; border-top:1px solid var(--line); color:var(--muted); font-size:12.5px; }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>세 진영이 동시에 서로를 죽인다</h1>
  <p class="sub">실시간 액션 전투 · 브라우저 플레이어 녹화 · ${new Date(data.capturedAt).toLocaleString("ko-KR")}</p>
</header>

<p class="lede">
  산적 · 경비병 · 야수 세 진영을 <strong>서로 전부 적대</strong>로 두고, 그중 <strong>야수만</strong> 플레이어에게도 적대로 두었다.
  이건 팀 태그 두 개로는 만들 수 없는 상태다 — 3자 상호 적대는 관계 행렬이 있어야 표현된다.
  진영별 3명씩 총 9명이 한 맵에서 붙는 동안, 플레이어는 가만히 서 있는다.
</p>

<div class="verdicts">
${verdicts.map((verdict) => `  <div class="verdict ${verdict.ok ? "pass" : "fail"}">
    <div class="top"><span class="dot"></span>${verdict.label}</div>
    <div class="detail">${verdict.detail}</div>
  </div>`).join("\n")}
</div>

<h2>태도 행렬 (저작한 그대로)</h2>
<p>
  <code>project.factions.relations</code> 에 적은 4개의 쌍이 런타임에서 이 행렬로 펼쳐진다.
  적지 않은 쌍은 자동으로 <strong>중립</strong>, 자기 진영은 자동으로 <strong>동맹</strong>이다.
</p>
${relationMatrix(data)}

<h2>난전 (실녹화 GIF · ${GIF_FPS}fps)</h2>
<figure>
  <img class="gif" src="${gifUri}" alt="세 진영 NPC 가 동시에 서로 싸우는 실제 게임 화면">
  <figcaption>
    녹화 ${gifWindow.start.toFixed(1)}s ~ ${(gifWindow.start + GIF_SECONDS).toFixed(1)}s 구간을 ${GIF_FPS}fps 로 뽑았다.
    왼쪽 산적(슬라임), 오른쪽 경비병(사람), 위쪽 야수(여우)가 가운데로 몰려 3자 난전이 된다.
    머리 위 <strong>HP 바 채움 색이 플레이어 기준 태도</strong>다 (<code>stanceBarColor()</code>) —
    산적·경비병은 호박색(중립), 야수는 빨강(적대). 즉 행렬이 화면에 그대로 나와 있고,
    가운데 서 있는 플레이어는 빨간 바를 가진 야수에게만 맞는다.
  </figcaption>
</figure>
<div class="legend">
${data.sides.map((side) => `  <span><span class="swatch" style="background:${side.color}"></span>${side.name} (${side.id})</span>`).join("\n")}
  <span><span class="dash"></span>플레이어 HP (차트)</span>
</div>
<div class="legend">
  <span style="color:#cfccc6">화면 속 HP 바 색 = 플레이어 기준 태도:</span>
${STANCE_BAR_COLORS.map((entry) => `  <span><span class="swatch" style="background:${entry.color}"></span>${entry.stance}</span>`).join("\n")}
</div>

<h2>수치</h2>
<div class="stats">
  <div class="stat"><div class="n">${data.hostilePairs.length}</div><div class="k">교전한 적대 쌍</div></div>
  <div class="stat"><div class="n">${data.maxAlive} → ${data.minAlive}</div><div class="k">동시 생존 전투원</div></div>
  <div class="stat"><div class="n">${data.deaths}</div><div class="k">NPC 손에 의한 사망</div></div>
  <div class="stat"><div class="n">${data.initialHp} → ${data.finalHp}</div><div class="k">플레이어 HP (야수 피해)</div></div>
  <div class="stat"><div class="n">${data.wrongTargeting.length}</div><div class="k">중립 진영의 플레이어 공격</div></div>
</div>

<h2>진영별 HP 추이 (${totalSeconds.toFixed(1)}초, ${data.sampleIntervalMs}ms 샘플)</h2>
<p>실선 하나가 스폰 인스턴스 하나다. 색은 진영, 끊기는 지점이 사망, 리스폰은 새 선으로 다시 나타난다. 점선은 플레이어다.</p>
${hpChart(data)}

<h2>결정적 프레임</h2>
<div class="frames">
${keyFrames.map((frame) => `  <figure class="frame">
    <img src="${frame.uri}" alt="난전 ${frame.atSec.toFixed(1)}초">
    <div class="meta"><div class="label">t + ${frame.atSec.toFixed(1)}s</div></div>
  </figure>`).join("\n")}
</div>

<h2>누가 누구를 노렸나</h2>
<p>
  <code>__oprnActionCombat()</code> 훅에서 ${data.sampleIntervalMs}ms 마다 읽은 <code>targetId</code> 를 진영 쌍으로 집계했다.
  <strong>산적→플레이어 / 경비병→플레이어 행이 아예 없다</strong>는 게 이 시스템이 팀 태그가 아니라 관계 행렬이라는 증거다.
</p>
<table>
  <thead><tr><th>노린 쪽</th><th>노려진 쪽</th><th>태도</th><th>관측 샘플</th><th>첫 관측</th></tr></thead>
  <tbody>
${pairEngagementRows(data).map((row) => `    <tr>
      <td><span class="chip" style="--c:${colorOf(data, row.from)}">${nameOf(data, row.from)}</span></td>
      <td><span class="chip" style="--c:${colorOf(data, row.to)}">${nameOf(data, row.to)}</span></td>
      <td>${stanceBetween(data, row.from, row.to)} (${STANCE_LABEL[String(stanceBetween(data, row.from, row.to))]})</td>
      <td>${row.samples}</td><td>${(row.firstMs / 1000).toFixed(1)}s</td>
    </tr>`).join("\n")}
  </tbody>
</table>

<h2>이 캡처가 연출이 아닌 이유</h2>
<div class="note-box">
  캡처 스펙에 네 가지가 실패 조건으로 걸려 있다. 태도 행렬을 되돌리거나 타깃 해석을 되돌리면
  스펙이 통과하지 못해 녹화·GIF 가 아예 생성되지 않는다.
  <ul>
    <li>실제 교전한 적대 쌍 집합이 정확히 <code>{산적↔경비병, 경비병↔야수, 야수↔산적}</code></li>
    <li>다른 NPC 에게 죽은 전투원이 1명 이상</li>
    <li>야수가 <code>__player__</code> 를 <code>targetId</code> 로 잡았고 플레이어 HP 가 실제로 감소</li>
    <li>산적·경비병이 <code>__player__</code> 를 노린 샘플이 <strong>0건</strong></li>
  </ul>
</div>

<footer>
  캡처: <code>test/e2e/_faction-npc-combat-evidence.spec.ts</code> (Chromium 1280×900, 비디오 녹화) ·
  리포트: <code>scripts/build-faction-evidence-report.mjs</code> ·
  원본 녹화 <code>faction-war.webm</code>, 샘플 ${data.timeline.length}개 <code>timeline.json</code> 동봉.
</footer>
</div>
</body>
</html>`;
}

const data = loadTimeline();
const duration = videoDurationSec();
const gifStart = Math.max(0, duration - GIF_SECONDS - 0.4);
buildGif(gifStart);
const keyFrames = [0.12, 0.34, 0.58, 0.82].map((fraction, index) => {
  const atSec = gifStart + GIF_SECONDS * fraction;
  return { atSec: GIF_SECONDS * fraction, uri: dataUri(extractFrame(atSec, index), "image/png") };
});
writeFileSync(REPORT_PATH, render(data, "faction-war.gif", keyFrames, { start: gifStart }));
process.stdout.write(`${REPORT_PATH}\n`);
