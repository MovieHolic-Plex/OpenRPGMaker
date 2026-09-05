import fs from "node:fs";
import assert from "node:assert/strict";
import { PNG } from "pngjs";

const out = "output/evidence/inn-exploration-v4";
const build = JSON.parse(fs.readFileSync(`${out}/build.json`, "utf8"));
const project = JSON.parse(fs.readFileSync(`${out}/reloaded-project.json`, "utf8"));
const proof = JSON.parse(fs.readFileSync(`${out}/supabase-proof.json`, "utf8"));
const runtime = JSON.parse(fs.readFileSync(`${out}/runtime-proof.json`, "utf8"));
const validation = JSON.parse(fs.readFileSync(`${out}/validation.json`, "utf8"));
assert.ok(proof.saved && proof.appReload && runtime.passed);
assert.equal(runtime.projectFile, "reloaded-project.json", "Report must show QA of the saved project");
const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const asset = file => {
  const bytes = fs.readFileSync(file);
  const png = PNG.sync.read(bytes);
  return { url: `data:image/png;base64,${bytes.toString("base64")}`, width: png.width, height: png.height };
};
const image = (file, alt, className = "", eager = false) => {
  const source = asset(file);
  return `<a class="image-link ${className}" href="${source.url}" aria-label="${escape(alt)} 확대"><img src="${source.url}" width="${source.width}" height="${source.height}" alt="${escape(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}></a>`;
};
const floors = [1, 2, 3].map(level => {
  const file = `${out}/floor-${level}.png`;
  const mapId = level === 1 ? "map_inn_wander" : `map_inn_wander_${level}f`;
  return { level, file, map: project.maps[mapId], rooms: build.rooms.filter(room => room.level === level), source: PNG.sync.read(fs.readFileSync(file)) };
});
function crop(placeId) {
  const floor = floors.find(floor => floor.rooms.some(room => room.placeId === placeId));
  const room = floor.rooms.find(room => room.placeId === placeId);
  const x = Math.max(0, room.x - 1) * 48;
  const y = Math.max(0, room.y - 3) * 48;
  const width = Math.min(floor.source.width - x, (room.w + 2) * 48);
  const height = Math.min(floor.source.height - y, (room.h + 4) * 48);
  const target = new PNG({ width, height });
  PNG.bitblt(floor.source, target, x, y, width, height, 0, 0);
  const file = `${out}/detail-${placeId}.png`;
  fs.writeFileSync(file, PNG.sync.write(target));
  return file;
}
const captions = {
  kitchen: "식당 뒤 주방", pantry: "맡긴 짐 보관방", dining: "알코브 식당", reception: "접수와 난로",
  dorm: "길손의 다인실", merchant: "상인의 모퉁이방", single: "작은 독실",
  landing: "창가 계단참", suite: "햇살 드는 객실", attic: "작은 다락", corridor: "다락 계단이 있는 복도",
};
function annotated(floor) {
  const labels = floor.rooms.filter(room => room.placeId !== "_walkway").map(room =>
    `<span class="map-label" style="left:${(room.x + room.w / 2) / floor.map.width * 100}%;top:${(room.y + room.h - 1) / floor.map.height * 100}%">${escape(captions[room.placeId] ?? room.placeId)}</span>`).join("");
  return `<figure class="map-figure"><div class="annotated">${image(floor.file, `${floor.level}층 전체 시공도`)}${labels}</div><figcaption>${floor.map.width} × ${floor.map.height} 타일 · 실제 시공 데이터의 하위·상위 레이어 합성 · 이미지를 누르면 확대</figcaption></figure>`;
}
const roomStories = [
  ["dorm", "01", "같은 방, 다른 길손", "침대 두 개와 공용 짐자리. 돗자리 바닥은 싼 숙박 공간의 분위기를 만듭니다. 아직 돌아오지 않은 손님의 침대와 젖은 여행 가방에 서로 다른 조사 내용을 넣었습니다."],
  ["merchant", "02", "방이 꺾이는 데는 이유가 있다", "침대를 둔 자리와 장부를 펼친 자리를 L자 공간에 나눴습니다. 운송 상자는 장식만이 아니라, 이 사람이 어디로 향하는지 알려 주는 단서입니다."],
  ["single", "03", "작지만 외롭지 않은 방", "좁은 독실에는 세로 침대와 머리맡 상자만 남겼습니다. 많은 가구 대신, 계단의 발소리를 좋아했던 손님의 편지 한 장으로 기억에 남게 합니다."],
  ["suite", "04", "서둘러 나갈 필요 없는 방", "넓은 알코브, 가로 침대, 옷장, 마주 보는 차탁을 둡니다. 창가에 머물 이유를 만들되, 다른 객실을 통과해야 들어오는 구조는 피했습니다."],
];
const roomHtml = roomStories.map(([id, number, title, body]) => `<article class="room-story"><div class="crop">${image(crop(id), captions[id])}</div><div class="room-copy"><span class="eyebrow">${number} / ${escape(captions[id])}</span><h3>${title}</h3><p>${body}</p></div></article>`).join("");
const visitCount = runtime.visits.length;
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="여행자의 등불 여관: 비대칭 객실, 실제 층간 이동, 작은 다락을 갖춘 3층 여관의 시공·플레이·저장 검증 보고서">
<title>여행자의 등불 — 여관 탐험 보고서</title><style>
:root{--paper:#f8f5ec;--raised:#fffdf7;--ink:#26362e;--forest:#293e35;--muted:#5c5b57;--brass:#7c5e22;--rule:#b8b4aa;--unit:4px}
*{box-sizing:border-box}html{scroll-padding-top:80px}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.75 system-ui,-apple-system,sans-serif}
a{color:inherit;text-underline-offset:4px}a:hover{text-decoration-thickness:2px}a:focus-visible,button:focus-visible{outline:3px solid var(--brass);outline-offset:4px}
img{display:block;width:100%;height:auto;image-rendering:pixelated}figure{margin:0}p{margin:12px 0 0;max-width:64ch}h1,h2,h3{font-family:Georgia,"Noto Serif KR","Batang",serif;word-break:keep-all;line-height:1.3;margin:0}h1{font-size:56px;letter-spacing:-.05em}h2{font-size:32px;letter-spacing:-.035em}h3{font-size:22px;letter-spacing:-.02em}
nav{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--rule)}.nav-inner{max-width:1320px;margin:auto;padding:16px 24px;display:flex;gap:24px;align-items:center}.brand{font-weight:700;margin-right:auto}.nav-inner a{font-size:14px;white-space:nowrap}
main,header{max-width:1320px;margin:auto;padding:0 24px}.hero{padding-top:64px;padding-bottom:48px;display:grid;grid-template-columns:1fr 1.1fr;align-items:center;gap:48px}.eyebrow{display:block;color:var(--brass);font:12px/1.6 ui-monospace,monospace;letter-spacing:.12em;margin-bottom:16px}.hero p{font-size:18px}.hero-image{background:var(--forest);padding:24px}.hero-image img{max-height:480px;object-fit:contain}.hero-image figcaption{color:var(--paper)}
.lede{border-left:3px solid var(--brass);padding-left:20px;margin-top:24px}.facts{display:flex;gap:32px;border-top:1px solid var(--rule);margin-top:32px;padding-top:20px}.facts strong{font:32px/1.2 Georgia,serif;display:block}.facts span{font-size:14px;color:var(--muted)}section{padding:64px 0;border-top:1px solid var(--rule)}.section-head{display:grid;grid-template-columns:96px 1fr;gap:16px;margin-bottom:32px}.floor-no{font:48px/1 Georgia,serif;color:var(--brass)}.section-head p{color:var(--muted)}
.floor-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:32px;align-items:start}.map-figure{min-width:0}.annotated{position:relative;background:var(--forest)}.map-label{position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:700;background:var(--raised);border:1px solid var(--rule);padding:0 4px;white-space:nowrap;pointer-events:none;max-width:95%}figcaption{font-size:14px;color:var(--muted);padding-top:12px}.image-link{display:block;cursor:zoom-in}.side-notes article{padding:20px 0;border-bottom:1px solid var(--rule)}.side-notes article:first-child{padding-top:0}.side-notes h3{font-size:22px}.side-notes p{font-size:15px}.side-notes .detail{margin-top:24px}
.room-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px 32px;margin-top:48px}.room-story{background:var(--raised);border:1px solid var(--rule)}.crop{background:var(--forest);padding:16px;display:flex;align-items:center;min-height:280px}.crop img{height:320px;object-fit:contain}.room-copy{padding:24px}.room-copy .eyebrow{margin-bottom:8px}.room-copy p{font-size:15px}
.attic-layout{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}.quote{font-family:Georgia,"Batang",serif;font-size:24px;line-height:1.7;border-left:3px solid var(--brass);padding-left:24px;margin:32px 0}.walk{background:var(--forest);color:var(--paper);padding:32px;margin-top:32px}.walk h3{margin-bottom:16px}.route{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:20px}.route small{font-size:14px}
.comparison,.play-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.comparison img{height:360px;object-fit:contain;background:var(--forest)}.comparison h3{margin-bottom:16px}.play-grid{margin-top:32px}.play-grid figure{background:var(--raised);padding:12px;border:1px solid var(--rule)}.play-grid img{aspect-ratio:3/2;object-fit:contain;background:var(--forest)}
.evidence{width:100%;border-collapse:collapse;margin-top:24px;font-size:14px}.evidence td,.evidence th{text-align:left;padding:16px 12px;border-bottom:1px solid var(--rule);vertical-align:top}.evidence th{width:180px}.code{font-family:ui-monospace,monospace;overflow-wrap:anywhere}.footnote{font-size:14px;color:var(--muted)}footer{padding:32px 0 64px;border-top:1px solid var(--rule);font-size:14px;color:var(--muted)}
dialog{max-width:96vw;max-height:96vh;border:0;background:var(--paper);padding:16px;color:var(--ink)}dialog::backdrop{background:rgba(0,0,0,.8)}dialog img{width:auto;max-width:90vw;max-height:80vh;object-fit:contain}dialog button{display:block;margin:0 0 12px auto;background:var(--forest);color:var(--paper);border:0;padding:8px 16px;font:inherit;cursor:pointer}.zoom-caption{font-size:14px}
@media(max-width:900px){.hero{grid-template-columns:1fr;gap:32px;padding-top:40px}h1{font-size:44px}.hero-image img{max-height:400px}.floor-layout,.attic-layout{grid-template-columns:1fr}.side-notes{display:grid;grid-template-columns:1fr 1fr;gap:24px}.side-notes article:first-child{padding-top:20px}.side-notes .detail{grid-column:1/-1;max-width:600px}.nav-inner{gap:16px}.brand{font-size:14px}}
@media(max-width:600px){main,header{padding:0 16px}.nav-inner{padding:12px 16px;gap:16px;flex-wrap:wrap}.brand{width:100%;margin:0;line-height:1.2}.nav-inner a{font-size:13px}h1{font-size:36px}h2{font-size:28px}.hero{padding:32px 0}.hero p{font-size:16px}.facts{gap:24px}.facts strong{font-size:28px}.section-head{grid-template-columns:56px 1fr;gap:12px}.floor-no{font-size:36px}section{padding:40px 0}.room-grid,.comparison,.play-grid,.side-notes{grid-template-columns:1fr}.crop img{height:280px}.comparison img{height:auto}.map-label{font-size:9px;line-height:1.4;padding:1px 2px}.route{font-size:16px;justify-content:flex-start;gap:12px}.walk{padding:24px}.evidence th{width:100px}.evidence td,.evidence th{padding:12px 4px}.quote{font-size:20px}}
</style></head><body>
<nav aria-label="보고서 목차"><div class="nav-inner"><span class="brand">여행자의 등불 / 여관 시공 기록</span><a href="#ground">1층</a><a href="#upper">2층</a><a href="#attic">다락</a><a href="#play">실제 플레이</a><a href="#proof">검증</a></div></nav>
<header><div class="hero"><div><span class="eyebrow">INN EXPLORATION / 타일 정정본</span><h1>하룻밤 묵는 곳에서,<br>한 번 더 둘러볼 곳으로.</h1><p class="lede">계단은 완성된 1×1 타일 한 개만 쓰고, 하단 입구에는 176번 표식을 두었습니다. 잘못 분류했던 408·409·410은 검색과 자동 배치에서 빼고, 209·239는 난로 연통으로 정리했습니다.</p><div class="facts"><div><strong>3</strong><span>연결된 층</span></div><div><strong>4</strong><span>다른 객실</span></div><div><strong>5</strong><span>잠자리</span></div></div></div><figure class="hero-image">${image(floors[1].file, "서로 다른 네 객실이 있는 2층 전체 시공도", "", true)}<figcaption>이 보고서의 그림은 컨셉 이미지가 아니라 실제 만들어진 맵입니다.</figcaption></figure></div></header>
<main><section id="ground"><div class="section-head"><span class="floor-no">01</span><div><span class="eyebrow">GROUND FLOOR / 생활과 영업</span><h2>문을 열면, 난로와 다음 계단.</h2><p>접수와 숙박 결제는 한 곳에. 식당과 주방은 객실에서 분리하고, 홀에서 위층으로 가는 계단을 발견하게 했습니다.</p></div></div><div class="floor-layout">${annotated(floors[0])}<aside class="side-notes"><article><h3>접수·난로·대기</h3><p>장부가 놓인 접수대, 작은 탁자와 대기 의자, 젖은 장갑을 말리는 난로를 모았습니다. 객실에서는 다시 요금을 받지 않습니다.</p></article><article><h3>식사와 준비</h3><p>알코브 식당의 식탁과 별도 주방. 화덕·손질대·식재료·물통이 각자의 용도를 갖습니다. 짐 보관방에도 맡긴 사람의 흔적을 남겼습니다.</p></article><figure class="detail">${image(crop("reception"), "접수대와 난로, 올라가는 계단 확대")}<figcaption>돌계단은 벽면 두 행과 바닥 한 행에 걸쳐 이어집니다. 바닥의 가로 한 줄로 끝나지 않습니다.</figcaption></figure></aside></div></section>
<section id="upper"><div class="section-head"><span class="floor-no">02</span><div><span class="eyebrow">GUEST FLOOR / 서로 다른 머무름</span><h2>문 네 개, 같은 방은 없습니다.</h2><p>침대와 상자만 있는 독실은 5×8칸에서 5×3칸으로 줄였습니다. 다인실은 7×4, 상인방은 7×6, 알코브 객실은 9×7칸입니다. 이웃 방이 크다고 다른 방까지 같은 깊이로 늘리지 않습니다.</p></div></div>${annotated(floors[1])}<div class="room-grid">${roomHtml}</div></section>
<section id="attic"><div class="section-head"><span class="floor-no">03</span><div><span class="eyebrow">ATTIC / 계단 끝의 발견</span><h2>여기까지 올라올 수 있네.</h2><p>객실 복도 끝의 좁은 계단이 작은 L자 다락으로 이어집니다. 큰 층의 폭을 그대로 복사하지 않고, 다락에 필요한 공간만 남겼습니다.</p></div></div><div class="attic-layout">${annotated(floors[2])}<div><span class="eyebrow">발견할 것 세 가지</span><h3>침구, 옛 간판, 주인의 여행 기록.</h3><p>보물 상자를 늘리는 대신 이 여관이 어떤 곳인지 알게 되는 물건을 넣었습니다. 손님의 짐을 뒤져 돈을 얻는 동작도 없습니다.</p><blockquote class="quote">“길이 막힌 날에는<br>방값을 받지 말 것.”</blockquote><p class="footnote">여분 침구에 남아 있는 표찰의 내용. 실제 조사 이벤트에 실려 있습니다.</p></div></div><div class="walk"><h3>한 번의 탐험, 네 번의 층간 이동</h3><div class="route"><span>1층 접수 홀</span><small>→</small><span>2층 객실</span><small>→</small><span>작은 다락</span><small>→</small><span>2층 계단참</span><small>→</small><span>1층</span></div><p>입구의 한 칸 계단을 없애고 계단참·다락 안쪽의 한 칸 계단로 연결을 옮겼습니다. 도착 위치도 실제 계단실 앞이며, 불필요한 남쪽 출입구는 닫았습니다.</p></div></section>
<section><div class="section-head"><span class="floor-no">↔</span><div><span class="eyebrow">BEFORE / AFTER</span><h2>가구의 수보다, 공간의 차이.</h2><p>기존 결과를 버리지 않고 비교 자료로 남겼습니다.</p></div></div><div class="comparison"><figure><h3>수정 전 · 두 개를 붙여 놓은 계단</h3>${image(`${out}/before-architecture-floor-2.png`, "구조 수정 전 2층 여관 시공도")}<figcaption>474와 475를 좌우 조각처럼 함께 놓았던 이전 결과입니다. 두 타일은 각각 완성된 계단이므로 붙여 쓰지 않습니다.</figcaption></figure><figure><h3>수정 후 · 단일 계단과 명확한 입구</h3>${image(floors[1].file, "새 여관의 비대칭 객실층 비교")}<figcaption>작은 방과 상단 창문은 유지했습니다. 계단은 한 개만 놓고, 1층의 하단 출입구는 176번 표식으로 구분합니다.</figcaption></figure></div></section>
<section id="play"><div class="section-head"><span class="floor-no">▶</span><div><span class="eyebrow">EXPORTED PLAYER / 실제 플레이 증거</span><h2>도면에서 끝내지 않았습니다.</h2><p>저장 후 다시 불러온 프로젝트를 전용 플레이어로 열었습니다. 순간이동 없이 걸어서 네 객실을 조사하고, 다락에 올라갔다가 1층으로 돌아왔습니다.</p></div></div><div class="play-grid">${[
["play-ground","입구에서 시작한 1층"],["play-upper","계단으로 올라온 2층"],["play-dorm","돌아오지 않은 길손의 침대"],["play-merchant","상인의 장부 조사"],["play-single","작은 독실에 남은 편지"],["play-suite","창가 차탁 조사"],["play-attic","실제로 도착한 작은 다락"],["play-old-sign","옛 여관 간판의 이야기"]
].map(([file,title])=>`<figure>${image(`${out}/${file}.png`,title)}<figcaption>${title}</figcaption></figure>`).join("")}</div></section>
<section id="proof"><div class="section-head"><span class="floor-no">✓</span><div><span class="eyebrow">PERSISTENCE / 검증 기록</span><h2>만든 것과 저장된 것이 같습니다.</h2><p>개념 꾸러미는 앞으로 AI가 재사용할 정의로, 이번에 시공한 세 층은 편집 가능한 실제 맵으로 저장했습니다.</p></div></div><table class="evidence"><tbody>
<tr><th scope="row">저장 프로젝트</th><td class="code">${escape(proof.projectId)}</td></tr>
<tr><th scope="row">추가된 맵</th><td>${floors.map(floor=>`${floor.level}층 · ${escape(floor.map.name)} <span class="code">(${escape(floor.map.id)})</span>`).join("<br>")}</td></tr>
<tr><th scope="row">분리 저장</th><td>기존 마을 프로젝트의 자동 저장과 충돌하지 않도록 여관 전용 프로젝트로 저장했습니다. 프로젝트 목록에서 <strong>여행자의 등불 여관</strong>을 열면 1층부터 바로 플레이할 수 있습니다. 원본 <span class="code">${escape(proof.sourceProjectId)}</span>의 마을과 시작 위치는 유지합니다.</td></tr>
<tr><th scope="row">시공 검사</th><td>관련 테스트 ${validation.focusedTests}개 통과. 층·가구·방별 침대·계단 그림·저장/로드·편집 UI 계약을 검사했습니다. 앱 타입 검사와 빌드도 통과했습니다.</td></tr>
<tr><th scope="row">검증 한계</th><td>전체 저장소 게이트는 통과하지 못했습니다. ${escape(validation.followUp)}<br>${escape(validation.visualReviewLimit)}</td></tr>
<tr><th scope="row">타일 정정</th><td>474: 독립 계단 한 개 · 176: 하단 입구 표식 · 408/409/410: 오분류 제외 · 209/239: 난로 연통의 상·하단. 접수용 탁자는 325/326/327을 사용합니다.</td></tr>
<tr><th scope="row">통행과 동작</th><td>전체 ${build.access.reduce((sum,item)=>sum+item.events,0)}개 이벤트 접근 가능. 실제 플레이 ${visitCount}개 상호작용, 계단 왕복 4회, 순간이동 0회, 페이지 오류 0개.</td></tr>
<tr><th scope="row">원격 재로드</th><td>원본 프로젝트 JSON과 앱 로더에서 세 층 및 꾸러미 일치 확인.<br><span class="code">${escape(proof.verifiedAt)}</span></td></tr>
</tbody></table><p class="footnote">이번 시공은 공간·가구·조사 이야기·숙박·층간 이동에 집중했습니다. 객실 예약·열쇠·시간표 NPC 시스템과 외부 발코니는 포함하지 않습니다. 큰 객실의 창가 알코브는 실내 공간입니다.</p><p><a href="reloaded-project.json" download>저장본 QA 프로젝트 JSON</a> · <a href="runtime-proof.json">플레이 검증 기록</a> · <a href="supabase-proof.json">원격 저장 기록</a></p></section>
<footer>RPG ZZU · 여행자의 등불 여관 · 시공 seed 7<br>전체 시공도·객실 확대·게임 화면을 포함한 이미지 내장 HTML. 파일 하나만 옮겨도 그림을 볼 수 있습니다.</footer></main>
<dialog id="zoom" aria-label="시공 이미지 확대"><button type="button" id="close">닫기 · Esc</button><img id="zoom-image" alt=""><p class="zoom-caption" id="zoom-caption"></p></dialog>
<script>const dialog=document.querySelector('#zoom');let opener;document.querySelectorAll('.image-link').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();opener=link;const source=link.querySelector('img');document.querySelector('#zoom-image').src=source.src;document.querySelector('#zoom-image').alt=source.alt;document.querySelector('#zoom-caption').textContent=source.alt;dialog.showModal()}));document.querySelector('#close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});dialog.addEventListener('close',()=>opener?.focus());</script></body></html>`;
fs.writeFileSync(`${out}/index.html`, html);
console.log(JSON.stringify({ report: `${out}/index.html`, embeddedImages: (html.match(/<img /g) ?? []).length - 1, bytes: Buffer.byteLength(html) }));
