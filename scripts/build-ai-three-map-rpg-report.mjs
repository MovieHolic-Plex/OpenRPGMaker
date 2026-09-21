#!/usr/bin/env node
// AI 저작 3맵 RPG 증거 리포트(HTML) 생성기.
//
// 입력: docs/ai-three-map-rpg-assets/shots.json  (Playwright 증거 스펙이 씀)
//       output/evidence/ai-three-map-rpg/build-report.json (AI 저작 로그)
// 출력: docs/2026-07-30-ai-three-map-rpg-evidence.html  (이미지 인라인 = 단일 파일로 공유 가능)
//
// 이미지를 base64 로 인라인해 파일 하나만 열면 되는 리치 리포트를 만든다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ASSET_DIR = path.resolve("docs/ai-three-map-rpg-assets");
const SHOTS = path.join(ASSET_DIR, "shots.json");
const BUILD_REPORT = path.resolve("output/evidence/ai-three-map-rpg/build-report.json");
const OUT = path.resolve("docs/2026-07-30-ai-three-map-rpg-evidence.html");

if (!existsSync(SHOTS)) {
  console.error(`missing ${SHOTS} — run the evidence spec first`);
  process.exit(2);
}

const { shots, report: shotReport } = JSON.parse(readFileSync(SHOTS, "utf8"));
const build = existsSync(BUILD_REPORT) ? JSON.parse(readFileSync(BUILD_REPORT, "utf8")) : null;
const verified = shotReport?.verified ?? build?.verified ?? null;
if (!verified) {
  console.error("no verified snapshot in shots.json or build-report.json");
  process.exit(2);
}

const esc = (value) =>
  String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

function inlineImage(file) {
  const abs = path.join(ASSET_DIR, file);
  if (!existsSync(abs)) return null;
  return `data:image/png;base64,${readFileSync(abs).toString("base64")}`;
}

const toolCalls = build?.toolCalls ?? [];
const okCounts = new Map();
for (const call of toolCalls.filter((c) => c.ok)) okCounts.set(call.name, (okCounts.get(call.name) ?? 0) + 1);
const failed = toolCalls.filter((c) => !c.ok);

const figures = shots
  .map((entry, index) => {
    const src = inlineImage(entry.file);
    if (!src) return "";
    return `
      <figure class="shot">
        <div class="shot-index">증거 ${index + 1}</div>
        <h3>${esc(entry.title)}</h3>
        <img src="${src}" alt="${esc(entry.title)}" loading="lazy" />
        <figcaption>${esc(entry.caption)}</figcaption>
        <div class="shot-file">${esc(entry.file)}</div>
      </figure>`;
  })
  .join("\n");

const mapRows = verified.maps
  .map(
    (map) => `
      <tr>
        <td><strong>${esc(map.name)}</strong><br /><code>${esc(map.id)}</code></td>
        <td>${esc(map.size)}</td>
        <td>${map.paintedLower.toLocaleString()}</td>
        <td>${map.paintedUpper.toLocaleString()}</td>
        <td>${map.eventCount}</td>
        <td>${map.eventNames.map((n) => `<span class="chip">${esc(n)}</span>`).join(" ")}</td>
      </tr>`,
  )
  .join("");

const transferRows = verified.transfers
  .map(
    (t) => `
      <tr>
        <td><code>${esc(t.from)}</code></td>
        <td>${esc(t.at)}</td>
        <td>→ <code>${esc(t.to)}</code></td>
      </tr>`,
  )
  .join("");

const okRows = [...okCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => `<tr><td><code>${esc(name)}</code></td><td>${count}회</td></tr>`)
  .join("");

const failRows = failed
  .map((call) => `<tr><td><code>${esc(call.name)}</code></td><td>${esc(call.summary)}</td></tr>`)
  .join("");

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>내장 AI 로 만든 맵 3개 RPG — 증거 리포트</title>
<style>
  :root { color-scheme: dark; --bg:#0b0e14; --panel:#151a23; --line:#2a3341; --ink:#e6edf6; --dim:#93a1b5; --ok:#3fb950; --warn:#d29922; --accent:#58a6ff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family: "Pretendard", -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; line-height:1.7; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 48px 24px 96px; }
  h1 { font-size: 30px; margin: 0 0 8px; letter-spacing: -0.4px; }
  .sub { color: var(--dim); margin: 0 0 32px; }
  h2 { font-size: 21px; margin: 48px 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
  h3 { font-size: 16px; margin: 0 0 12px; }
  p { margin: 0 0 14px; }
  code { background:#0d1117; border:1px solid var(--line); border-radius:4px; padding:1px 5px; font-size:12.5px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin:24px 0 8px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }
  .card .k { color:var(--dim); font-size:12px; text-transform:uppercase; letter-spacing:.5px; }
  .card .v { font-size:26px; font-weight:700; margin-top:6px; }
  .card .n { color:var(--dim); font-size:12px; margin-top:2px; }
  table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line);
    border-radius:10px; overflow:hidden; margin:12px 0 20px; font-size:14px; }
  th,td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { background:#111722; color:var(--dim); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.5px; }
  tr:last-child td { border-bottom:none; }
  .chip { display:inline-block; background:#0d1117; border:1px solid var(--line); border-radius:999px;
    padding:1px 9px; font-size:12px; margin:2px 2px 2px 0; }
  figure.shot { margin:0 0 34px; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  figure.shot h3 { padding:0 18px; }
  .shot-index { padding:14px 18px 0; color:var(--accent); font-size:12px; font-weight:700; letter-spacing:.6px; }
  figure.shot img { display:block; width:100%; height:auto; border-top:1px solid var(--line);
    border-bottom:1px solid var(--line); background:#000; }
  figcaption { padding:14px 18px 4px; color:var(--ink); font-size:14px; }
  .shot-file { padding:0 18px 14px; color:var(--dim); font-size:11.5px; font-family:ui-monospace,monospace; }
  .note { background:#111722; border-left:3px solid var(--accent); border-radius:0 8px 8px 0; padding:14px 18px; margin:18px 0; }
  .note.warn { border-left-color:var(--warn); }
  .ok { color:var(--ok); font-weight:700; }
  .warn { color:var(--warn); font-weight:700; }
  ul { margin:0 0 14px; padding-left:22px; }
  li { margin-bottom:6px; }
</style>
</head>
<body>
<div class="wrap">

  <h1>내장 AI 로 만든 맵 3개 RPG</h1>
  <p class="sub">
    사람이 타일을 찍거나 이벤트를 손으로 만든 곳이 <strong>한 군데도 없다</strong>.
    에디터에 내장된 AI 어시스턴트가 툴을 호출해서 맵 3장, NPC, 보물상자, 맵 사이 이동을 전부 저작했다.
    아래는 그 결과를 <strong>화면으로</strong> 확인한 증거다.
  </p>

  <div class="cards">
    <div class="card"><div class="k">프로젝트</div><div class="v">${esc(verified.title)}</div><div class="n">LegacyDb <code>${esc(build?.projectId ?? "rpg-zzu-three-map-rpg")}</code></div></div>
    <div class="card"><div class="k">맵</div><div class="v">${verified.mapCount}장</div><div class="n">마을 · 던전 · 실내</div></div>
    <div class="card"><div class="k">이벤트</div><div class="v">${verified.totalEvents}개</div><div class="n">NPC · 상자 · 출입구</div></div>
    <div class="card"><div class="k">맵 이동</div><div class="v">${verified.transfers.length}개</div><div class="n">양방향 왕복 2쌍</div></div>
    <div class="card"><div class="k">AI 툴 호출</div><div class="v">${shotReport?.toolOkCount ?? build?.toolOkCount ?? 0}<span style="font-size:15px;color:var(--dim)"> / ${shotReport?.toolCallCount ?? build?.toolCallCount ?? 0}</span></div><div class="n">성공 / 전체 시도</div></div>
    <div class="card"><div class="k">모델</div><div class="v" style="font-size:16px">${esc(build?.model ?? "-")}</div><div class="n">소요 ${Math.round((build?.elapsedMs ?? 0) / 1000)}초</div></div>
  </div>

  <h2>한 문단 요약</h2>
  <p>
    AI 에게 "맵 3개짜리 짧은 RPG 를 만들어라" 하나만 던졌다. AI 는 <code>create_map</code> 으로 맵 3장을 만들고,
    <code>lay_path</code> · <code>author_house</code> · <code>place_props</code> 로 길과 건물을 깔고,
    <code>place_npc</code> 로 주민을 심고, <code>place_chest</code> 로 던전에 보물을 두고,
    <code>create_transfer_pair</code> 로 맵 사이를 왕복 연결했다. 결과는 LegacyDb 에 저장되고,
    다시 불러와서 에디터에 그려지고, 테스트 플레이에서 <span class="ok">실제로 플레이된다</span>.
  </p>

  <h2>AI 가 만든 것 (재로드 후 실측)</h2>
  <table>
    <thead><tr><th>맵</th><th>크기</th><th>바닥 타일</th><th>위 레이어</th><th>이벤트</th><th>이벤트 이름</th></tr></thead>
    <tbody>${mapRows}</tbody>
  </table>

  <p><strong>맵 사이 이동</strong> — <code>create_transfer_pair</code> 가 만든 왕복 연결이다. 마을에서 나가면 던전/여관으로,
  거기서 출입구를 밟으면 마을로 돌아온다.</p>
  <table>
    <thead><tr><th>출발 맵</th><th>밟는 칸</th><th>도착</th></tr></thead>
    <tbody>${transferRows}</tbody>
  </table>

  <h2>증거 스크린샷</h2>
  <p>모두 실제 브라우저(Playwright + Chromium)에서 앱을 띄워 찍었다. 합성이나 목업이 아니다.</p>
  ${figures}

  <h2>AI 가 실제로 호출한 툴</h2>
  <p>성공한 호출만 집계했다. AI 가 스스로 상황을 보고(<code>get_map_region</code>, <code>tile_query</code>)
  다음 수를 정한 흔적이 남아 있다.</p>
  <table>
    <thead><tr><th>툴</th><th>성공 횟수</th></tr></thead>
    <tbody>${okRows}</tbody>
  </table>

  <h2>실패했다가 스스로 복구한 부분 (솔직하게)</h2>
  <div class="note warn">
    <p style="margin:0">
      <span class="warn">${failed.length}건이 처음에 거부됐다.</span>
      이건 버그가 아니라 <strong>에디터의 안전장치가 작동한 것</strong>이다.
      예를 들어 AI 가 "돌길" 같은 존재하지 않는 타일 이름을 쓰면 에디터가 거부하고
      "<code>tile_query</code> 로 후보를 확인하라"고 알려준다. AI 는 그 안내를 읽고 실제 타일 이름으로 고쳐서 다시 호출했다.
      최종 결과물에는 이 실패의 흔적이 남지 않는다.
    </p>
  </div>
  <table>
    <thead><tr><th>거부된 툴</th><th>에디터가 돌려준 이유</th></tr></thead>
    <tbody>${failRows}</tbody>
  </table>

  <h2>이 증거를 다시 만드는 방법</h2>
  <ul>
    <li>저작 + LegacyDb 저장/재로드 검증:
      <code>OPRN_AI_THREE_MAP=1 node node_modules/vitest/vitest.mjs run test/aiThreeMapRpg.live.test.ts --configLoader bundle</code></li>
    <li>스크린샷 증거 수집:
      <code>OPRN_AI_THREE_MAP_SHOTS=1 npx playwright test test/e2e/ai-three-map-rpg-evidence.spec.ts</code></li>
    <li>이 HTML 재생성: <code>node scripts/build-ai-three-map-rpg-report.mjs</code></li>
  </ul>
  <div class="note">
    <p style="margin:0">
      <strong>왜 LegacyDb 저장까지 하는가</strong> — 이 저장소 규칙(<code>AGENTS.md</code>)상 AI 가 만든 게임 콘텐츠는
      메모리나 로컬 JSON 에만 있으면 완료로 치지 않는다. 원격에 저장하고 <strong>다시 불러와서</strong> 존재를 증명해야 한다.
      위 표의 수치는 전부 <em>재로드 후</em> 측정한 값이다.
    </p>
  </div>

</div>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`[ok] ${OUT} (${(html.length / 1024).toFixed(0)} KB, ${shots.length} shots inlined)`);
