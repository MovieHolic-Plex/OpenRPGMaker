// 캡처한 스크린샷을 이미지 리치 HTML 보고서로 묶는다.
// 이미지는 base64 로 인라인한다 — 보고서 파일 하나만 열면 되고, 경로가 깨져 빈 칸이 뜨는 일이 없다.
//
// 사용: node scripts/build-showcase-report.mjs --shots .omo/evidence/showcase/shots.json --out .omo/evidence/showcase/report.html

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const shotsPath = val("--shots", ".omo/evidence/showcase/shots.json");
const outPath = val("--out", ".omo/evidence/showcase/report.html");

const shots = JSON.parse(fs.readFileSync(shotsPath, "utf8"));
const picks = JSON.parse(fs.readFileSync(".omo/evidence/scene-picks.json", "utf8"));

const SHEET_KO = {
  retro_dungeon: "레트로 던전", retro_exterior: "레트로 외부", retro_house: "레트로 주택",
  retro_world: "레트로 월드맵", ship: "배", world: "월드맵",
};
const COUNTS = { retro_dungeon: 478, retro_exterior: 478, retro_house: 478, retro_world: 480, ship: 464, world: 478 };
const DISTINCT = { retro_dungeon: 341, retro_exterior: 383, retro_house: 425, retro_world: 452, ship: 366, world: 381 };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function dataUri(file) {
  try { return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`; }
  catch { return null; }
}

function figure(s) {
  const uri = dataUri(s.file);
  if (!uri) return `<figure class="miss"><figcaption>이미지 없음: ${esc(s.name)}</figcaption></figure>`;
  return `<figure>
  <a href="${esc("file:///" + s.file.replace(/\\/g, "/"))}" target="_blank"><img src="${uri}" alt="${esc(s.caption)}"></a>
  <figcaption><b>${esc(s.caption)}</b><br><code>${esc(s.file)}</code></figcaption>
</figure>`;
}

const bySheet = {};
for (const s of shots) { (bySheet[s.sheet] = bySheet[s.sheet] || []).push(s); }

let body = "";
const overview = (bySheet["-"] || []);
if (overview.length) {
  body += `<section><h2>에디터와 런타임</h2><div class="grid">${overview.map(figure).join("\n")}</div></section>`;
}

for (const key of Object.keys(SHEET_KO)) {
  const list = bySheet[key] || [];
  if (!list.length) continue;
  const p = picks[key] || {};
  const roleRows = ["ground", "water", "wall", "roof", "door", "prop"]
    .filter((k) => (p[k] || []).length)
    .map((k) => {
      const names = { ground: "바탕 지형", water: "물", wall: "벽", roof: "지붕", door: "문·계단", prop: "소품" };
      const cells = p[k].slice(0, 8).map((e) => `<span class="tile"><i>${e.i}</i>${esc(e.l)}<em>${esc(e.role)}/${esc(e.p)}</em></span>`).join("");
      return `<tr><th>${names[k]}</th><td>${cells}</td></tr>`;
    }).join("\n");

  body += `<section>
<h2>${SHEET_KO[key]} <small>${key}</small></h2>
<p class="stat">도화 가능 <b>${COUNTS[key]}</b>칸 전수 저작 · 고유 라벨 <b>${DISTINCT[key]}</b>종 · role <b>${(p.roles || []).length}</b>종</p>
<p class="note">아래 장면에 쓴 타일은 무작위가 아니다. 내가 저작한 <code>role</code>로 골랐다 — <code>water</code>로 못을 파고, <code>wall</code>로 벽을 세우고, <code>roof</code>를 얹고, 소품을 늘어놓았다. 장면은 칩셋 PNG 에서 직접 합성했다 — 에디터가 개입하지 않으므로 보이는 것이 곧 칩셋 픽셀이다. 라벨이 맞으면 그림이 자연스럽게 맞물리고, 틀리면 어그러져 눈에 띈다.</p>
<table class="picks">${roleRows}</table>
<div class="grid">${list.map(figure).join("\n")}</div>
</section>`;
}

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>EasyRPG 번들 칩셋 6종 — 타일 시맨틱 저작 결과 육안 검사</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px 40px 80px; background:#12141a; color:#e6e8ee;
         font:15px/1.7 "Malgun Gothic","Segoe UI",system-ui,sans-serif; }
  h1 { font-size:28px; margin:0 0 6px; letter-spacing:-.4px; }
  .lede { color:#9aa2b4; margin:0 0 28px; max-width:80ch; }
  h2 { font-size:21px; margin:44px 0 4px; padding-bottom:8px; border-bottom:1px solid #262a35; }
  h2 small { font-weight:400; font-size:13px; color:#7d8698; margin-left:8px; font-family:ui-monospace,monospace; }
  .stat { margin:8px 0 4px; color:#c3cad8; }
  .stat b { color:#7dd3a0; }
  .note { margin:6px 0 16px; color:#98a1b3; max-width:88ch; font-size:14px; }
  code { font-family:ui-monospace,"Cascadia Mono",monospace; font-size:12.5px; color:#9fb4d8; word-break:break-all; }
  table.picks { border-collapse:collapse; margin:0 0 22px; width:100%; }
  table.picks th { text-align:left; vertical-align:top; padding:7px 14px 7px 0; color:#8e97a9;
                   font-weight:600; white-space:nowrap; width:88px; font-size:13.5px; }
  table.picks td { padding:7px 0; }
  .tile { display:inline-block; margin:0 7px 7px 0; padding:5px 10px; background:#1c202b;
          border:1px solid #2b3140; border-radius:7px; font-size:13px; }
  .tile i { display:inline-block; min-width:34px; color:#6f7a90; font-style:normal;
            font-family:ui-monospace,monospace; font-size:11.5px; }
  .tile em { display:block; color:#68melon; font-style:normal; font-size:11px; color:#6b7488; margin-top:1px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(440px,1fr)); gap:22px; }
  figure { margin:0; background:#171a22; border:1px solid #262a35; border-radius:11px; overflow:hidden; }
  figure img { display:block; width:100%; height:auto; background:#0c0e13; }
  figure a { display:block; }
  figcaption { padding:11px 13px; font-size:13px; color:#aab2c4; border-top:1px solid #262a35; }
  figcaption b { color:#e6e8ee; }
  figure.miss { padding:26px; color:#d98b8b; }
  .found { margin-top:52px; padding:20px 24px; background:#141c22; border:1px solid #24404d; border-radius:11px; }
  .found h2 { border:0; margin:0 0 10px; }
  .found li { margin:11px 0; color:#c6d6de; max-width:96ch; }
  .found b { color:#8fd8f0; }
  .limits { margin-top:52px; padding:20px 24px; background:#1a1520; border:1px solid #3a2a3a; border-radius:11px; }
  .limits h2 { border:0; margin:0 0 10px; }
  .limits li { margin:7px 0; color:#cfc0d4; max-width:92ch; }
  .paths { margin-top:34px; padding:18px 22px; background:#151b18; border:1px solid #24352b; border-radius:11px; }
  .paths h2 { border:0; margin:0 0 10px; }
  .paths li { margin:5px 0; }
</style></head><body>
<h1>EasyRPG 번들 칩셋 6종 — 타일 시맨틱 저작 결과</h1>
<p class="lede">칩셋 6종의 도화 가능한 <b>2,856칸</b> 전부에 한국어 라벨·role·passage·tags를 붙이고, 칩셋별로 배선했다(PR #81 머지됨). 이 보고서는 그 데이터로 실제 맵을 만들어 본 결과다. 스크린샷 ${shots.length}장.</p>
${body}
<div class="found">
<h2>이 장면들을 만들면서 실제로 찾아낸 것</h2>
<ol>
<li><b>retro_house 12-17 을 침대인데 지붕 기와로 적어 놨었다.</b> "건축" 장면이 지붕 자리에 침대를 얹는 걸 보고 알아챘다. 스트립을 다시 보니 나무 머리판·베개·매트리스가 뚜렷한 침대다. <code>role: roof</code> → <code>furniture</code>, 라벨 6개를 "나무 침대 머리/발치 좌·중앙·우"로 고쳤다. <b>기존 게이트 전부가 이걸 통과시켰다</b> — 색상어도 없고 통행성도 <code>solid</code>로 맞았으니 반증할 픽셀 근거가 없었다. 교정 후 이 시트의 지붕 자리에는 실제 기와(42-44 자줏빛 무늬 기와)가 들어갔다.</li>

<li><b>게이트에 "회색" 사각지대가 있었고, 그게 6칸을 놓치고 있었다.</b> retro_exterior 179 "<b>회색</b> 지붕 하단 처마"가 장면에서 새빨갛게 나왔다. 픽셀을 재 보니 <b>고채도 100%, 회색 0%</b>였다. 원인은 내가 저작 중에 <code>audit-tile-semantics-grounding.mts</code>의 색상어 목록에서 회색을 <b>일부러 빼 놓은 것</b>이었다 — 저채도 팔레트에서 오탐이 심해서였고, 그 절충이 역효과를 냈다.</li>

<li><b>그래서 반대 방향 규칙을 새로 넣었다.</b> "회색이 있어야 한다"가 아니라 <b>"타일 대부분이 뚜렷하게 채도 높은 색이면 무채색 주장을 반증한다"</b>. 저채도 타일은 구조적으로 걸릴 수 없어 예전 오탐이 재발하지 않는다. 1차 시도(임계 55%)는 26건을 뱉었는데 대부분 오탐이었다 — "붉<b>은색</b> 무늬 기와"가 부분문자열로 걸리고, "보라 바닥 북서 회색틀"처럼 <b>라벨이 이미 유채색을 명시한</b> 경우까지 걸렸다. 그래서 "은색"을 빼고, 유채색어가 함께 있으면 건너뛰고, 임계를 90%로 올렸다. 결과 6건만 남았고 전부 실제 오류였다.</li>

<li><b>그 6칸을 픽셀에서 측정한 실제 색으로 고쳤다.</b> retro_exterior 179 → "붉은 지붕 하단 처마"(hue 10, 221·41·18), 370 → "짙은 남청 바닥"(35·33·72 균일), retro_dungeon 165 → "갈흙빛 돌 바닥"(hue 27), 435·437 → "왼편/오른편 그늘 남청 돌벽"(hue 242), retro_world 237 → "자홍빛 세로형 받침 장치"(224·103·191). 최종 근거 감사는 2,856칸 중 <b>위반 2건(0.07%)</b>, 검증기 ALL PASS, typecheck exit 0, 테스트 174 passed.</li>

<li><b>배 칩셋의 투명 배경이 에디터에서 분홍 사각형으로 찍힌다.</b> 소품 하나가 단색 분홍으로 렌더되는 걸 보고 추적했다. 원인은 내 데이터가 아니라 <code>tilesetMetadataEditor.ts:235</code>의 <code>isCombinedTownTileset(tileset) &amp;&amp; isTransparentChipsetTile(...)</code> — <b>투명 배경 판정이 합본 마을 칩셋에만 걸려 있다.</b> 이번에 저작한 6종에는 투명 배경 소품이 많은데 그 경로를 타지 못한다. 머지된 PR 범위(시맨틱 데이터 + 배선) 밖의 기존 결함이고, 이번 작업이 그것을 눈에 보이게 만들었다.</li>

<li><b>커밋된 감사 스크립트에 내가 낸 흔적이 남아 있었다.</b> rule C 의 세 줄이 <code>const roleRule</code> 대신 <code>globalThis.roleRule</code>로 바뀐 채 커밋돼 있었다 — 작업 중 JS 평가 커널이 템플릿 문자열의 <code>const</code>를 재작성한 사고의 잔재다. 우연히 동작해서 검증을 통과했지만 전역을 오염시킨다. 이번에 정상 지역 변수로 되돌렸다.</li>
</ol>
<p class="note" style="margin-top:14px">1·2·5 는 <b>픽셀 게이트로는 잡히지 않고 그림을 그려 봐야 드러나는</b> 종류다. 30장을 찍자는 요청이 실제로 데이터와 게이트를 함께 개선했다.</p>
</div>
<div class="limits">
<h2>이 그림들을 볼 때 감안할 것</h2>
<ul>
<li>검증 게이트는 <b>통행성·색·재질 주장</b>을 픽셀로 반증한다. 그러나 <b>주제 오류는 잡지 못한다</b> — 게이트를 통과한 파일에서 내가 눈으로 17칸을 더 찾아 고쳤다(목재 판벽이 "용암 표면", 바위 무리가 "묘비", 2×3 황금 왕좌가 "노란 불꽃"과 "붉은 벽돌 벽면"으로 분해돼 있었다).</li>
<li>표본 주제 오답률은 시트마다 갈린다: retro_world 0행은 30칸 중 0칸, retro_dungeon 1행은 약 10칸, ship 0행은 약 8칸. <b>정확도는 양호하지만 균일하지 않고 전수 검증되지 않았다.</b></li>
<li>애매한 타일은 단정하지 않고 형태를 서술하고 <code>판독보류</code> 태그를 달았다.</li>
<li>장면이 어색해 보이는 곳이 있다면 그게 곧 라벨 오류 후보다. 이 보고서의 용도가 그것이다.</li>
</ul>
</div>
<div class="paths">
<h2>절대 경로</h2>
<ul>
<li>보고서: <code>${esc(path.resolve(outPath))}</code></li>
<li>스크린샷 디렉터리: <code>${esc(path.resolve(path.dirname(shotsPath)))}</code></li>
<li>캡처 스크립트: <code>${esc(path.resolve("scripts/capture-chipset-showcase.mjs"))}</code></li>
<li>보고서 생성기: <code>${esc(path.resolve("scripts/build-showcase-report.mjs"))}</code></li>
<li>액션 로그: <code>${esc(path.resolve(path.join(path.dirname(shotsPath), "action-log.txt")))}</code></li>
</ul>
</div>
</body></html>`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, "utf8");
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`report -> ${path.resolve(outPath)} (${kb} KB, ${shots.length} shots)`);
