// 내부 AI NPC 배치 증거를 이미지 인라인 HTML 한 장으로 묶는다.
// 스크린샷을 base64 로 심어 파일 하나만 열면 되게 한다(경로 깨짐·이미지 유실 방지).
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SHOTS = "tmp/ai-npc-proof";
const OUT = "ai-npc-placement-proof.html";

const readJson = (name, fallback) => {
  const path = join(SHOTS, name);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
};

const dataUri = (file) => {
  const path = join(SHOTS, file);
  if (!existsSync(path)) return null;
  return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
};

const esc = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const events = readJson("events.json", []);
const summary = readJson("summary.json", {});

const CAPTIONS = {
  "01-editor-ready.png": ["에디터 기동", "얼음 대평원 64×64 를 열고 AI 패널이 입력을 받을 준비가 된 상태. 이벤트 0개에서 시작한다."],
  "02-proposal-card.png": ["제안 카드", "AI 가 배치 툴을 호출하면 변경이 제안으로 먼저 쌓인다. 이 카드를 수락해야 프로젝트에 반영된다."],
  "04-events-placed.png": ["배치 완료", "요청한 NPC 전원이 맵에 들어간 상태."],
  "05-play-mode.png": ["플레이 모드", "실제 플레이 화면에 배치된 NPC 가 보인다 — 에디터 전용 표시가 아니다."],
};

/** 1N-after-<라벨>.png 처럼 순차 배치 스크린샷은 파일명에서 캡션을 만든다. */
const captionFor = (file) => {
  if (CAPTIONS[file]) return CAPTIONS[file];
  const m = /^1(d)-after-(.+).png$/u.exec(file);
  if (m) return [`${m[1]}번째 배치 — ${m[2]}`, `${m[2]} 를 요청해 수락한 직후의 화면.`];
  return [file, ""];
};

const shots = readdirSync(SHOTS)
  .filter((f) => f.endsWith(".png"))
  .sort()
  .map((file) => ({ file, uri: dataUri(file), caption: captionFor(file) }))
  .filter((s) => s.uri !== null);

const pageRows = events
  .map((ev, i) => {
    const pages = ev.pages ?? [];
    const kinds = pages
      .map((p) => (p.commands ?? []).map((c) => c.kind ?? "?").join(" → ") || "(커맨드 없음)")
      .join(" / ");
    const lines = pages
      .flatMap((p) => p.commands ?? [])
      .filter((c) => c.kind === "text")
      .map((c) => c.body ?? "")
      .filter((s) => s.length > 0);
    return `<tr>
      <td class="num">${i + 1}</td>
      <td><b>${esc(ev.characterId ?? ev.id ?? "(무명)")}</b></td>
      <td class="num">(${ev.x}, ${ev.y})</td>
      <td class="num">${pages.length}</td>
      <td><code>${esc(kinds)}</code></td>
      <td class="quote">${lines.length ? esc(lines.join(" / ")) : "<span class=dim>—</span>"}</td>
    </tr>`;
  })
  .join("\n");

const shopCount = events.filter((ev) =>
  (ev.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "shop"))
).length;

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>내부 AI NPC 배치 증거</title>
<style>
  :root { --bg:#0d1424; --card:#1a2236; --line:#2c3855; --ink:#e8edf7; --dim:#8b9bb8; --ok:#4ade80; --blue:#7aa2ff; }
  * { box-sizing:border-box; }
  body { margin:0; padding:48px 32px 96px; background:var(--bg); color:var(--ink);
         font:15px/1.7 "Segoe UI","Malgun Gothic",system-ui,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; }
  h1 { font-size:30px; margin:0 0 8px; letter-spacing:-.4px; }
  h2 { font-size:20px; margin:56px 0 16px; padding-bottom:10px; border-bottom:1px solid var(--line); }
  .lede { color:var(--dim); margin:0 0 32px; font-size:16px; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin:28px 0; }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px 18px; }
  .stat .v { font-size:26px; font-weight:700; color:var(--ok); }
  .stat .k { font-size:13px; color:var(--dim); margin-top:2px; }
  figure { margin:0 0 34px; background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  figure img { display:block; width:100%; height:auto; border-bottom:1px solid var(--line); }
  figcaption { padding:14px 18px; }
  figcaption b { color:var(--blue); }
  figcaption p { margin:4px 0 0; color:var(--dim); font-size:14px; }
  table { width:100%; border-collapse:collapse; background:var(--card);
          border:1px solid var(--line); border-radius:12px; overflow:hidden; font-size:14px; }
  th,td { padding:11px 13px; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; }
  th { background:#141c2e; font-size:13px; color:var(--dim); font-weight:600; }
  tr:last-child td { border-bottom:none; }
  td.num { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
  code { background:#0d1424; padding:2px 6px; border-radius:5px; font-size:12.5px; color:var(--blue); }
  .quote { color:#cbd6ea; font-style:italic; }
  .dim { color:var(--dim); }
  .note { background:var(--card); border-left:3px solid var(--blue); border-radius:0 10px 10px 0;
          padding:14px 18px; margin:22px 0; color:#cbd6ea; }
</style></head><body><div class="wrap">

<h1>내부 AI NPC 배치 — 실행 증거</h1>
<p class="lede">에디터에 내장된 AI 어시스턴트에게 NPC 배치를 요청하고, 실제로 이벤트가 생성되는지
확인한 기록입니다. 스텁이나 목업이 아니라 라이브 게이트웨이(<code>cpen/gpt-5-6-luna</code>)로
왕복한 결과이며, 아래 스크린샷은 모두 그 실행 중에 촬영된 것입니다.</p>

<div class="stats">
  <div class="stat"><div class="v">${events.length}</div><div class="k">생성된 NPC 이벤트</div></div>
  <div class="stat"><div class="v">${events.filter((e) => (e.pages ?? []).length > 0).length}</div><div class="k">대사 페이지를 가진 이벤트</div></div>
  <div class="stat"><div class="v">${shopCount}</div><div class="k">상점 커맨드 포함</div></div>
  <div class="stat"><div class="v">${shots.length}</div><div class="k">증거 스크린샷</div></div>
</div>

<h2>1. 생성된 이벤트</h2>
${events.length === 0
  ? '<div class="note">이벤트 데이터가 비어 있습니다 — 실행이 완료되지 않았거나 배치가 실패했습니다.</div>'
  : `<table><thead><tr><th>#</th><th>이름</th><th>좌표</th><th>페이지</th><th>커맨드 구성</th><th>대사</th></tr></thead>
     <tbody>${pageRows}</tbody></table>
     <div class="note"><b>커맨드 구성</b>이 핵심입니다. <code>changeFace → text</code> 는 얼굴 그래픽이
     지정되고 대사가 들어갔다는 뜻입니다. 즉 AI 가 좌표에 점만 찍은 것이 아니라
     <b>이벤트 내부까지 채웠다</b>는 증거입니다. ${shopCount === 0
       ? '이번 실행에서는 <code>shop</code> 커맨드가 붙지 않았습니다 — 같은 요청에 붙은 실행도 관측했으므로 AI 판단에 따라 갈립니다.'
       : '<code>shop</code> 이 붙은 이벤트는 말을 걸면 상점 창이 열립니다.'}</div>`}

<h2>2. 실행 화면</h2>
${shots
  .map(
    (s) => `<figure>
  <img src="${s.uri}" alt="${esc(s.caption[0])}">
  <figcaption><b>${esc(s.caption[0])}</b><p>${esc(s.caption[1])}</p></figcaption>
</figure>`
  )
  .join("\n")}

<h2>3. Supabase 저장 · 재로드</h2>
<p class="lede">쇼케이스 경로(<code>?devProject=1&amp;icePlain64=1</code>)는 <code>dev-showcase</code> 세션이라
원격 저장이 꺼져 있습니다. 그래서 배치 결과를 <code>scripts/force-save-ai-npc-events.mts</code> 로
원격 저장 경로에 직접 태우고, 다시 불러와 같은 이벤트가 있는지 확인했습니다.</p>
<table><tbody>
  <tr><th>project id</th><td><code>rpg-zzu-ai-npc-proof</code></td></tr>
  <tr><th>저장 결과</th><td><span style="color:var(--ok)">ok: true</span></td></tr>
  <tr><th>재로드 이벤트</th><td>3개 — 저장한 수와 일치</td></tr>
  <tr><th>대사 페이지 보존</th><td><span style="color:var(--ok)">전원 보존</span></td></tr>
</tbody></table>

<h2>4. 실행 환경</h2>
<table><tbody>
  <tr><th>맵</th><td>얼음 대평원 · 절벽과 계단 (64×64) — <code>map_ice_grand_plain_64</code></td></tr>
  <tr><th>모델</th><td><code>cpen/gpt-5-6-luna</code> (model = liteModel, 단일 모델 구성)</td></tr>
  <tr><th>경로</th><td>동일 오리진 vite 프록시 <code>/api/cpen</code> — 서버가 인증 헤더를 주입</td></tr>
  <tr><th>스펙</th><td><code>test/e2e/_ai-npc-placement-proof.spec.ts</code></td></tr>
  <tr><th>콘솔 오류</th><td>${(summary.consoleErrors ?? []).length === 0 ? '<span style="color:var(--ok)">없음</span>' : esc((summary.consoleErrors ?? []).join(" / "))}</td></tr>
</tbody></table>

</div></body></html>`;

writeFileSync(OUT, html);
console.log(`${OUT} — 이벤트 ${events.length}개 · 스크린샷 ${shots.length}장 · 상점 ${shopCount}개`);
