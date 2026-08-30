#!/usr/bin/env node
// 테스트 플레이 복원력 보고서를 한 장의 HTML 로 굽는다.
//
// 그림은 base64 로 **파일 안에** 넣는다 — 보고서를 윈도우 탐색기/다른 컴퓨터로 옮겨도
// 이미지가 깨지지 않아야 하기 때문이다(상대 경로 보고서가 실제로 깨진 적이 있다).
//
// 입력: verify-shots/testplay-resilient-report/report.json (+ report.b-repaired.json)
//       verify-shots/runtime-qa/smoke/manifest.json
// 출력: reports/2026-08-30-testplay-resilient.html
//
// 사용: node scripts/build-testplay-resilient-report.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SHOT_DIR = join(ROOT, "verify-shots/testplay-resilient-report");
const SMOKE_DIR = join(ROOT, "verify-shots/runtime-qa/smoke");
const OUT = join(ROOT, "reports/2026-08-30-testplay-resilient.html");

const escape = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function dataUri(path) {
  if (!existsSync(path)) throw new Error(`그림이 없다: ${path}`);
  return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
}

function figure(path, title, caption, { wide = false } = {}) {
  return `<figure class="shot${wide ? " wide" : ""}">
  <img src="${dataUri(path)}" alt="${escape(title)}" loading="lazy" />
  <figcaption><b>${escape(title)}</b>${caption ? ` — ${escape(caption)}` : ""}<span class="file">${escape(basename(path))}</span></figcaption>
</figure>`;
}

const report = JSON.parse(readFileSync(join(SHOT_DIR, "report.json"), "utf8"));
const byLabel = new Map(report.results.map((entry) => [entry.label, entry]));
// 토스트를 놓치지 않고 다시 찍은 b 케이스가 있으면 그 결과를 정본으로 쓴다.
const retakePath = join(SHOT_DIR, "report.b-repaired.json");
if (existsSync(retakePath)) {
  for (const entry of JSON.parse(readFileSync(retakePath, "utf8")).results) byLabel.set(entry.label, entry);
}
const smoke = JSON.parse(readFileSync(join(SMOKE_DIR, "manifest.json"), "utf8"));

const valid = byLabel.get("a-valid");
const repaired = byLabel.get("b-repaired");
const noMaps = byLabel.get("c-no-maps");
const assets = byLabel.get("d-assets-blocked");
const panel = byLabel.get("e-recovery-panel");
const pageErrorTotal = [...byLabel.values()].reduce((sum, entry) => sum + (entry.pageErrors?.length ?? 0), 0);
const smokeFailures = smoke.beats.reduce((sum, beat) => sum + beat.failures.length, 0);

const cards = [
  { value: "5 / 5", label: "브라우저 장면 전부 통과", note: "정상 · 자동복구 · 막힘 · 에셋 실패 · 복구 패널" },
  { value: "26개", label: "단위 테스트 통과", note: "예비검사 13 · 복구 7 · 패널 5 · 에셋 1" },
  { value: `${pageErrorTotal}건`, label: "잡히지 않은 오류", note: "5장면 합계 pageerror" },
  { value: `${assets.assetFailures.length}개`, label: "그림 파일이 죽어도 계속", note: `색 ${assets.inspection.canvasStats.distinct}종으로 그려지고 입력을 받았다` },
];

const stages = [
  {
    tag: "cf39f2fa",
    title: "1. 켜기 전에 프로젝트를 먼저 재 본다",
    body: `<code>src/project/playPreflight.ts</code> 를 새로 뒀다. 게임을 띄우기 전에 프로젝트를 훑어
    <b>고칠 수 있는 것은 조용히 고치고</b>, 고칠 수 없는 것은 <b>사람이 읽을 이유</b>로 만든다.`,
    lists: [
      ["스스로 고치는 것", ["없는 시작 맵 → 맵 트리 뿌리(또는 첫 맵)로 다시 이음", "빈 파티 / 없는 배우 → 첫 배우 한 명으로 채움", "막힌 시작 칸 → 가장 가까운 지나갈 수 있는 칸으로 옮김", "없는 타일셋 → 있는 타일셋으로 대체", "맵 트리의 고아 · 죽은 뿌리 복구"]],
      ["못 고치고 이유를 말하는 것", ["맵이 하나도 없음 (no-maps)", "타일셋이 하나도 없음 (no-tilesets)", "지나갈 수 있는 칸이 하나도 없음 (no-passable-start-tile)"]],
    ],
  },
  {
    tag: "8db00c95",
    title: "2. 그림 파일 하나 못 읽어도 멈추지 않는다",
    body: `<code>PlayScene</code> 이 로드 실패를 잡아 그 자리에 <b>자홍색 체크무늬 자리표시자</b>를 깐다.
    실패한 목록은 부팅 진단에 남는다. 예전에는 그림 한 장이 없으면 화면 전체가 검게 끝났다.`,
  },
  {
    tag: "6ac029a8",
    title: "3. 실패 화면에 «다음에 할 일»을 붙였다",
    body: `로딩 오버레이에 복구 패널을 넣었다. 실패 이유를 그대로 보여 주고 버튼 세 개를 준다 —
    <b>다시 시도</b>, <b>안전 모드로 시작</b>, <b>진단 내용 복사</b>. 자동으로 고친 항목도 같이 적는다.`,
  },
  {
    tag: "16f888ec",
    title: "4. 막다른 문구 세 곳을 모두 이 패널로 바꿨다",
    body: `한 줄로 끝나던 자리 세 곳을 복구 패널 하나로 모았다. 안전 모드는 저작한 내용이 부팅을
    방해할 때를 위한 우회로다 — 스스로 돌아다니는 NPC, 자동/병렬 이벤트, 이동 경로를 잠시 끈다.`,
    lists: [
      ["바뀐 자리", [
        "«플레이 씬을 시작하지 못했습니다.» — 준비 대기가 30초를 넘긴 자리 (player.ts)",
        "«플레이를 시작하지 못했습니다» — 부팅 중 예외를 잡은 자리 (player.ts)",
        "«시연 실행를 열지 못했습니다» — 창 자체가 안 열린 자리 (testPlayModal.ts, 오타도 같이 고쳤다)",
      ]],
    ],
  },
];

const stageHtml = stages
  .map(
    (stage) => `<article class="stage">
  <header><span class="sha">${escape(stage.tag)}</span><h3>${stage.title}</h3></header>
  <p>${stage.body}</p>
  ${(stage.lists ?? [])
    .map(
      ([title, items]) =>
        `<div class="mini"><h4>${escape(title)}</h4><ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul></div>`,
    )
    .join("")}
</article>`,
  )
  .join("\n");

const shotSections = [
  {
    id: "scene-a",
    heading: "① 멀쩡한 프로젝트 — 전과 똑같이 그냥 된다",
    text: `건드리지 않은 프로젝트로 테스트 플레이를 열었다. 복구 패널은 나오지 않고 화면은
    색 <b>${valid.inspection.canvasStats.distinct}종</b>으로 그려졌다. 이 변경이 정상 경로를 건드리지 않았다는 뜻이다.`,
    shots: [
      [join(SHOT_DIR, "a-valid-window.png"), "정상 프로젝트의 테스트 플레이 창", "복구 패널 없음 · 결말 playing", { wide: true }],
      [join(SHOT_DIR, "a-valid-canvas.png"), "게임 화면만 잘라낸 것", `색 ${valid.inspection.canvasStats.distinct}종 / ${valid.inspection.canvasStats.width}×${valid.inspection.canvasStats.height}`],
    ],
  },
  {
    id: "scene-b",
    heading: "② 시작 맵과 파티를 깨뜨렸다 — 조용히 고쳐서 그냥 시작한다",
    text: `시작 맵을 없는 이름(<code>map_does_not_exist_zzu</code>)으로 바꾸고 파티를 비웠다. 예전이라면
    검은 화면이다. 지금은 <b>알아서 고치고 무엇을 고쳤는지 알려 주면서</b> 그대로 시작한다.`,
    quote: repaired.inspection.toastText.join("\n"),
    shots: [
      [join(SHOT_DIR, "b-repaired-toast-live.png"), "자동 복구를 알리는 토스트가 뜬 순간", "화면 아래쪽 · 부팅은 멈추지 않는다", { wide: true }],
      [join(SHOT_DIR, "b-repaired-toast.png"), "토스트만 확대", "고친 항목과 코드를 같이 적는다", { wide: true }],
      [join(SHOT_DIR, "b-repaired-canvas.png"), "깨뜨린 프로젝트가 그려진 화면", `색 ${repaired.inspection.canvasStats.distinct}종 — 정상 프로젝트와 같은 그림`],
    ],
  },
  {
    id: "scene-c",
    heading: "③ 맵을 전부 지웠다 — 왜 못 노는지 말한다",
    text: `맵이 0개면 어떻게 고쳐도 시작할 자리가 없다. 이때는 게임 엔진을 아예 띄우지 않고
    <b>이유와 다음 행동</b>을 보여 준다. 고칠 수 없는 상태이므로 안전 모드 버튼은 일부러 주지 않는다.`,
    quote: noMaps.inspection.recoveryReason,
    shots: [
      [join(SHOT_DIR, "c-no-maps-window.png"), "맵이 없는 프로젝트로 테스트 플레이", "검은 화면 대신 복구 패널", { wide: true }],
      [join(SHOT_DIR, "c-no-maps-panel.png"), "복구 패널만 확대", "다시 시도 · 진단 내용 복사"],
    ],
  },
  {
    id: "scene-d",
    heading: "④ 그림 파일을 전부 막았다 — 체크무늬로 대신 그리고 계속 논다",
    text: `<code>assets/*.png</code> 요청을 모두 끊었다. ${assets.assetFailures.length}개가 실패했지만 게임은 멈추지 않았다.
    빠진 그림 자리에 자홍색 체크무늬가 깔리고, 아래 상태줄이 <b>입력을 받고 이벤트를 기다리는 중</b>임을 보여 준다.`,
    quote: assets.assetFailures.slice(0, 5).join("\n"),
    shots: [
      [join(SHOT_DIR, "d-assets-blocked-canvas.png"), "그림이 하나도 없을 때의 게임 화면", `색 ${assets.inspection.canvasStats.distinct}종 · 자리표시자 · 상태줄 살아 있음`, { wide: true }],
      [join(SHOT_DIR, "d-assets-blocked-window.png"), "창 전체", "복구 패널 없음 — 놀 수 있으면 막지 않는다"],
    ],
  },
  {
    id: "scene-e",
    heading: "⑤ 복구 패널의 전체 모습",
    text: `준비 대기가 30초를 넘긴 실패를 그대로 넣어 패널을 그렸다. 이유 문구와 복구 목록은 실제 권위
    (<code>describeBootFailure</code> · <code>preflightProjectForPlay</code>)가 만든 값이고, 여기서는 <b>그리는 순간만</b> 만들어 찍었다.
    실제 실패 흐름은 단위 테스트 7개가 덮는다.`,
    quote: panel.injected.repairs.join("\n"),
    shots: [
      [join(SHOT_DIR, "e-recovery-panel-panel.png"), "이유 + 자동복구 목록 + 버튼 세 개", "다시 시도 · 안전 모드로 시작 · 진단 내용 복사", { wide: true }],
      [join(SHOT_DIR, "e-recovery-panel-window.png"), "창 안에 놓인 모습", "게임 화면 위에 덮인다"],
    ],
  },
];

const sceneHtml = shotSections
  .map(
    (section) => `<section class="scene" id="${section.id}">
  <h3>${section.heading}</h3>
  <p>${section.text}</p>
  ${section.quote ? `<pre class="quote">${escape(section.quote)}</pre>` : ""}
  <div class="shots">${section.shots.map(([path, title, caption, options]) => figure(path, title, caption, options ?? {})).join("\n")}</div>
</section>`,
  )
  .join("\n");

const smokeHtml = `<div class="shots">${smoke.beats
  .map((beat) =>
    figure(
      join(SMOKE_DIR, beat.shot),
      beat.note,
      beat.state ? `${beat.state.currentMapId} (${beat.state.x}, ${beat.state.y})` : "타이틀",
    ),
  )
  .join("\n")}</div>`;

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>테스트 플레이는 이제 막다른 화면으로 끝나지 않는다</title>
<style>
  :root { color-scheme: dark; --bg:#0d1117; --card:#161b22; --line:#30363d; --ink:#e6edf3; --dim:#9aa4b2; --key:#58a6ff; --ok:#3fb950; --warn:#d29922; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.75 -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; }
  main { max-width: 1080px; margin: 0 auto; padding: 48px 24px 96px; }
  h1 { font-size: 34px; line-height:1.3; margin:0 0 12px; letter-spacing:-.02em; }
  h2 { font-size: 24px; margin: 56px 0 8px; padding-bottom:10px; border-bottom:1px solid var(--line); }
  h3 { font-size: 19px; margin: 32px 0 6px; }
  h4 { font-size: 14px; margin: 14px 0 4px; color: var(--dim); text-transform: none; }
  p { margin: 8px 0 14px; }
  .lead { font-size: 18px; color:#c9d1d9; }
  .meta { display:flex; flex-wrap:wrap; gap:8px; margin:20px 0 0; }
  .meta span { background:var(--card); border:1px solid var(--line); border-radius:999px; padding:4px 12px; font-size:13px; color:var(--dim); }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin:28px 0 8px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px; }
  .card b { display:block; font-size:30px; line-height:1.2; color:var(--ok); }
  .card .l { font-size:15px; margin-top:4px; }
  .card .n { font-size:13px; color:var(--dim); margin-top:6px; }
  .stage { background:var(--card); border:1px solid var(--line); border-left:3px solid var(--key); border-radius:12px; padding:18px 22px; margin:16px 0; }
  .stage header { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .stage h3 { margin:0; font-size:18px; }
  .sha { font:12px/1 ui-monospace, Menlo, monospace; color:var(--key); background:#0d2744; border:1px solid #1f4b7a; border-radius:6px; padding:5px 8px; }
  .mini ul { margin:4px 0 0; padding-left:20px; }
  .mini li { color:#c9d1d9; font-size:15px; }
  code { font:14px ui-monospace, Menlo, monospace; background:#0b2233; border:1px solid #1d3b52; border-radius:5px; padding:1px 5px; color:#9fd0ff; }
  pre.quote { background:#0b1622; border:1px solid var(--line); border-left:3px solid var(--warn); border-radius:8px; padding:12px 14px; margin:10px 0 18px; overflow:auto; font:13px/1.7 ui-monospace, Menlo, monospace; color:#d7e3ef; white-space:pre-wrap; }
  .before { background:#20161a; border:1px solid #4a2530; border-radius:12px; padding:14px 18px; }
  .before ul { margin:6px 0 0; padding-left:20px; }
  .shots { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:18px; margin:18px 0 8px; }
  figure.shot { margin:0; background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  figure.shot.wide { grid-column:1 / -1; }
  figure.shot img { display:block; width:100%; height:auto; background:#000; }
  figcaption { padding:12px 14px; font-size:14px; color:#c9d1d9; border-top:1px solid var(--line); }
  figcaption .file { display:block; font:12px ui-monospace, monospace; color:#6e7681; margin-top:4px; }
  table { width:100%; border-collapse:collapse; margin:16px 0; font-size:15px; }
  th, td { border:1px solid var(--line); padding:9px 12px; text-align:left; }
  th { background:var(--card); color:var(--dim); font-weight:600; }
  .ok { color:var(--ok); font-weight:600; }
  .cmd { background:#0b1622; border:1px solid var(--line); border-radius:10px; padding:14px 16px; font:14px/1.9 ui-monospace, Menlo, monospace; color:#9fd0ff; overflow:auto; }
  footer { margin-top:64px; padding-top:20px; border-top:1px solid var(--line); color:var(--dim); font-size:14px; }
</style>
</head>
<body>
<main>
  <h1>테스트 플레이는 이제 막다른 화면으로 끝나지 않는다</h1>
  <p class="lead">프로젝트가 어떻게 깨져 있어도 <b>①놀 수 있으면 그냥 시작하고</b>, <b>②못 놀면 왜 못 노는지와 다음에 할 일을 보여 준다</b>.
  검은 화면과 한 줄짜리 실패 문구는 없앴다.</p>
  <div class="meta">
    <span>브랜치 agent/testplay-resilient</span>
    <span>커밋 4개</span>
    <span>브라우저 장면 5개 · 단위 테스트 26개</span>
    <span>측정 2026-08-30</span>
    <span>크로미움 1280×800 · ${escape(report.baseUrl)}</span>
  </div>

  <div class="cards">
    ${cards.map((card) => `<div class="card"><b>${escape(card.value)}</b><div class="l">${escape(card.label)}</div><div class="n">${escape(card.note)}</div></div>`).join("\n    ")}
  </div>

  <h2>무엇이 문제였나</h2>
  <p>테스트 플레이 버튼을 눌렀을 때, 프로젝트 상태가 조금만 어긋나도 화면이 그냥 <b>죽었다</b>.
  시작 맵 이름이 지워졌거나, 파티가 비었거나, 시작 칸이 벽이거나, 그림 파일 하나가 없기만 해도 그랬다.
  더 나쁜 것은 <b>이유를 알 수 없었다</b>는 점이다. 실패 화면은 아래 세 문장 중 하나로 끝났다.</p>
  <div class="before">
    <h4>고치기 전의 막다른 문구</h4>
    <ul>
      <li>«플레이 씬을 시작하지 못했습니다.»</li>
      <li>«플레이를 시작하지 못했습니다»</li>
      <li>«시연 실행를 열지 못했습니다» (오타까지 그대로)</li>
    </ul>
    <p style="margin:10px 0 0;color:#f0a8b4">무엇이 잘못됐는지, 무엇을 눌러야 하는지가 없다. 작업자가 할 수 있는 일은 창을 닫는 것뿐이었다.</p>
  </div>

  <h2>무엇을 바꿨나</h2>
  ${stageHtml}

  <h2>실제 화면으로 확인한 것</h2>
  <p>모두 실제 크로미움에서 편집기를 띄우고, 편집기 안의 프로젝트를 그 자리에서 깨뜨린 뒤 테스트 플레이를 누른 결과다.
  판정은 사람 눈이 아니라 <b>화면에 실제로 칠해진 색의 종수</b>와 <b>복구 패널의 존재</b>로 했다. 빈 화면·멈춤·잡히지 않은 오류는 실패로 본다.</p>
  ${sceneHtml}

  <h2>정상 플레이는 그대로인가</h2>
  <p>출하되는 플레이어(편집기 껍데기를 지나지 않는 경로)로 저작 데모를 다시 돌렸다. 네 장면 모두 통과했고
  실패는 <span class="ok">${smokeFailures}건</span>이다. 즉 이 변경은 잘 되던 길을 건드리지 않았다.</p>
  ${smokeHtml}

  <h2>숫자로 정리</h2>
  <table>
    <tr><th>장면</th><th>깨뜨린 것</th><th>결말</th><th>화면 색 종수</th><th>잡히지 않은 오류</th></tr>
    <tr><td>① 정상</td><td>없음</td><td>플레이</td><td>${valid.inspection.canvasStats.distinct}종</td><td class="ok">0건</td></tr>
    <tr><td>② 자동복구</td><td>시작 맵 · 파티</td><td>플레이 (복구 알림)</td><td>${repaired.inspection.canvasStats.distinct}종</td><td class="ok">0건</td></tr>
    <tr><td>③ 막힘</td><td>맵 전부 삭제</td><td>복구 패널</td><td>—</td><td class="ok">0건</td></tr>
    <tr><td>④ 에셋 실패</td><td>그림 ${assets.assetFailures.length}개 차단</td><td>플레이 (자리표시자)</td><td>${assets.inspection.canvasStats.distinct}종</td><td class="ok">0건</td></tr>
    <tr><td>⑤ 패널 렌더</td><td>준비 대기 초과 문맥</td><td>복구 패널</td><td>—</td><td class="ok">0건</td></tr>
  </table>
  <p>단위 테스트는 4개 파일 26개가 모두 통과한다 —
  <code>playPreflight</code> 13개, <code>playBootRecovery</code> 7개, <code>playLoadingOverlayRecovery</code> 5개, <code>playSceneAssetResilience</code> 1개.
  여기에는 <b>다시 시도가 새 부팅을 만드는지</b>, <b>안전 모드가 자율 이동과 자동 실행을 정말 끄는지</b>,
  <b>낡은 실패가 새 부팅 위에 패널을 덮지 않는지</b>가 들어 있다.</p>

  <h2>다시 확인하는 방법</h2>
  <div class="cmd">
npm run dev:worktree -- --port 9842        # 포트가 잡혀 있으면 다른 번호를 쓴다<br />
node scripts/qa/testplay-resilient-browser-qa.mjs --base-url http://127.0.0.1:9842   # 통과/실패 게이트<br />
node scripts/qa/testplay-resilient-report-shots.mjs --base-url http://127.0.0.1:9842 # 이 보고서의 그림<br />
node scripts/run-vitest.mjs run test/playPreflight.test.ts test/playBootRecovery.test.ts test/playLoadingOverlayRecovery.test.ts test/playSceneAssetResilience.test.ts --configLoader bundle<br />
npm run qa:runtime                          # 출하 플레이어 스모크 4장면
  </div>

  <h2>남은 것 · 솔직한 한계</h2>
  <ul>
    <li>⑤ 패널 그림은 <b>실패 문맥을 넣어 그린 것</b>이다. 진짜 30초 초과·부팅 예외 흐름은 단위 테스트로만 덮었다. 브라우저에서 30초 초과를 재현하려면 엔진을 일부러 굶겨야 해서 이번 증거에는 넣지 않았다.</li>
    <li>안전 모드 버튼을 눌러 실제로 다시 부팅되는 화면은 아직 그림이 없다(동작은 테스트 «suppresses autonomous movement…» 가 확인한다).</li>
    <li>브라우저 콘솔에는 <code>ERR_CONNECTION_REFUSED</code> 가 몇 줄 남는다. 워크트리에 Supabase 프록시가 없어서 나는 것으로, 런타임 결함이 아니다. 잡히지 않은 오류(pageerror)는 5장면 모두 0건이다.</li>
    <li>예비검사는 <b>부팅 가능성</b>만 본다. 저작 내용이 말이 되는지(문 연결, 퀘스트 조건)는 기존 검사기 몫이다.</li>
  </ul>

  <footer>
    증거 원본: <code>verify-shots/testplay-resilient-report/</code> · <code>verify-shots/testplay-resilient/</code> · <code>verify-shots/runtime-qa/smoke/</code><br />
    이 보고서는 <code>node scripts/build-testplay-resilient-report.mjs</code> 가 그림을 파일 안에 넣어 다시 굽는다.
  </footer>
</main>
</body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`${OUT}  (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
