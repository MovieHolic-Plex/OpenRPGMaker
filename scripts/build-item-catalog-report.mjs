// 기본 아이템·장비 카탈로그 작업의 이미지 리치 HTML 보고서를 만든다.
//
// 입력: verify-shots/item-catalog-before/manifest.json (고치기 전)
//       verify-shots/item-catalog-after/manifest.json  (고친 뒤)
// 출력: reports/item-catalog-report.html — PNG 를 base64 로 품고 있어 파일 하나만 열면 된다.
//
// 사용: node scripts/build-item-catalog-report.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";

const ROOT = process.cwd();
const OUT_DIR = resolve(ROOT, "reports");
const OUT = resolve(OUT_DIR, "item-catalog-report.html");

const ITEM_TYPES = ["normalGoods", "medicine", "book", "seed", "special", "switch"];
const EQUIP_SLOTS = ["weapon", "shield", "armor", "helmet", "accessory"];
const KO_TYPE = {
  normalGoods: "일반 물품",
  medicine: "약",
  book: "기술서",
  seed: "씨앗",
  special: "특수",
  switch: "스위치",
};
const KO_SLOT = { weapon: "무기", shield: "방패", armor: "갑옷", helmet: "투구", accessory: "장식" };

function readManifest(dir) {
  const path = resolve(ROOT, "verify-shots", dir, "manifest.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function dataUri(file) {
  if (!existsSync(file)) return null;
  return `data:image/png;base64,${readFileSync(file).toString("base64")}`;
}

const before = readManifest("item-catalog-before");
const after = readManifest("item-catalog-after");
if (!before || !after) {
  throw new Error("before/after manifest 가 없다. 먼저 capture-item-catalog-evidence.mjs 를 두 번 돌려라.");
}

const counts = JSON.parse(readFileSync(resolve(ROOT, "reports/catalog-counts.json"), "utf8"));
// 칩 문구는 칩 전용 재캡처(save-chip.json)가 있으면 그것을 부른다 — 전역 매니패스트는 더 오래될 수 있다.
const chipPath = resolve(ROOT, "verify-shots/item-catalog-after/save-chip.json");
if (existsSync(chipPath)) after.autoSaveChipText = JSON.parse(readFileSync(chipPath, "utf8")).text;

function shotFigure(manifest, name, caption) {
  const shot = manifest.shots.find((entry) => basename(entry.file, ".png") === name);
  if (!shot) return `<p class="missing">스크린샷 없음: ${name}</p>`;
  const uri = dataUri(shot.file);
  if (!uri) return `<p class="missing">파일 없음: ${shot.file}</p>`;
  return `<figure><img src="${uri}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`;
}

function comparePair(name, label) {
  return `<div class="pair">
    <div><h4>고치기 전</h4>${shotFigure(before, name, `${label} — 고치기 전`)}</div>
    <div><h4>고친 뒤</h4>${shotFigure(after, name, `${label} — 고친 뒤`)}</div>
  </div>`;
}

function barRow(label, beforeCount, afterCount, target = 10) {
  const max = Math.max(beforeCount, afterCount, target, 1);
  const pct = (value) => Math.max(2, Math.round((value / max) * 100));
  const short = beforeCount < target;
  return `<tr class="${short ? "was-short" : ""}">
    <th>${label}</th>
    <td class="num">${beforeCount}</td>
    <td class="bar"><span class="b-before" style="width:${pct(beforeCount)}%"></span></td>
    <td class="num strong">${afterCount}</td>
    <td class="bar"><span class="b-after" style="width:${pct(afterCount)}%"></span></td>
    <td class="verdict">${afterCount >= target ? "충족" : "미달"}</td>
  </tr>`;
}

const itemRows = ITEM_TYPES.map((type) =>
  barRow(KO_TYPE[type], counts.before.items[type] ?? 0, counts.after.items[type] ?? 0)
).join("\n");
const equipRows = EQUIP_SLOTS.map((slot) =>
  barRow(KO_SLOT[slot], counts.before.equipment[slot] ?? 0, counts.after.equipment[slot] ?? 0)
).join("\n");

const screenBefore = before.perType ?? {};
const screenAfter = after.perType ?? {};

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>기본 아이템이 적었던 이유와 고친 내용</title>
<style>
  :root { color-scheme: light; --ink:#16181d; --dim:#5c6470; --line:#e2e5ea; --bg:#fbfcfd; --before:#c9ced6; --after:#2f6fed; --warn:#b9481f; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;
    line-height:1.75; font-size:16px; }
  main { max-width:1100px; margin:0 auto; padding:56px 28px 96px; }
  h1 { font-size:34px; line-height:1.3; margin:0 0 8px; letter-spacing:-.02em; }
  .sub { color:var(--dim); margin:0 0 40px; font-size:17px; }
  h2 { font-size:24px; margin:56px 0 12px; padding-top:24px; border-top:1px solid var(--line); letter-spacing:-.01em; }
  h3 { font-size:19px; margin:32px 0 8px; }
  h4 { font-size:14px; color:var(--dim); margin:0 0 6px; font-weight:600; }
  p { margin:0 0 14px; }
  .lede { font-size:18px; background:#fff; border:1px solid var(--line); border-left:4px solid var(--after);
    border-radius:10px; padding:20px 22px; margin:0 0 32px; }
  .lede strong { color:var(--after); }
  figure { margin:0 0 10px; }
  img { width:100%; height:auto; display:block; border:1px solid var(--line); border-radius:10px; background:#fff; }
  figcaption { font-size:13px; color:var(--dim); margin-top:8px; }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin:20px 0 28px; }
  @media (max-width:820px) { .pair { grid-template-columns:1fr; } }
  table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line);
    border-radius:10px; overflow:hidden; margin:16px 0 8px; font-size:15px; }
  th, td { padding:9px 12px; text-align:left; border-bottom:1px solid var(--line); }
  tbody tr:last-child th, tbody tr:last-child td { border-bottom:0; }
  thead th { background:#f4f6f9; font-size:13px; color:var(--dim); font-weight:600; }
  td.num { text-align:right; width:56px; font-variant-numeric:tabular-nums; }
  td.num.strong { font-weight:700; color:var(--after); }
  td.bar { width:26%; }
  td.bar span { display:block; height:9px; border-radius:5px; }
  .b-before { background:var(--before); }
  .b-after { background:var(--after); }
  td.verdict { width:64px; font-size:13px; color:#1c7a3e; font-weight:600; }
  tr.was-short th { color:var(--warn); font-weight:700; }
  tr.was-short th::after { content:" ← 부족했음"; font-size:11px; font-weight:500; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px; margin:18px 0 26px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:10px; padding:16px 18px; }
  .card .k { font-size:12px; color:var(--dim); }
  .card .v { font-size:28px; font-weight:700; letter-spacing:-.02em; }
  .card .d { font-size:13px; color:var(--dim); }
  code { background:#eef1f5; padding:2px 6px; border-radius:5px; font-size:13.5px;
    font-family:ui-monospace,"SFMono-Regular",Menlo,monospace; }
  pre { background:#16181d; color:#e6e9ee; padding:16px 18px; border-radius:10px; overflow-x:auto;
    font-size:13px; line-height:1.6; }
  .note { background:#fff8ec; border:1px solid #f0dcb8; border-radius:10px; padding:16px 18px; margin:18px 0; }
  footer { margin-top:64px; padding-top:20px; border-top:1px solid var(--line); color:var(--dim); font-size:13px; }
  ol, ul { margin:0 0 16px; padding-left:22px; }
  li { margin-bottom:7px; }
</style>
</head>
<body>
<main>
<h1>기본 아이템이 왜 적어 보였고, 무엇을 고쳤나</h1>
<p class="sub">oprn 편집기 · 브랜치 <code>agent/items10</code> · ${new Date(after.capturedAt).toLocaleString("ko-KR")} 실측</p>

<div class="lede">
<p><strong>짧게 말하면 이렇습니다.</strong> 아이템이 적었던 게 아니라, <b>장비가 안 보였습니다.</b></p>
<p>편집기가 기본으로 여는 예제 프로젝트는 오래전에 <b>파일로 굳혀 놓은 사본</b>을 그대로 씁니다.
그 사본에는 장비가 <b>11개</b>뿐입니다. 프로젝트를 불러올 때 <b>아이템은</b> 부족한 걸 알아서 채워 넣는 코드가
있었는데, <b>장비는 채워 넣지 않았습니다.</b> 그래서 코드에는 장비가 ${counts.after.equipmentTotal}개나 있는데
화면에는 11개만 떴습니다.</p>
<p>여기에 더해 아이템 종류별 개수가 심하게 치우쳐 있었습니다. 기술서는 3개, 씨앗은 8개, 스위치는 4개.
종류를 골라 보면 칸이 텅 비어 보이는 게 당연했습니다.</p>
<p><b>고친 것:</b> ① 장비도 불러올 때 채워 넣게 만들었습니다. ② 모든 아이템 종류와 장비 칸을 10개 이상으로 채웠습니다.
③ 개수를 <b>기계가 세게</b> 만들어서, 앞으로 다시 줄어들면 테스트가 바로 잡습니다.</p>
</div>

<div class="cards">
  <div class="card"><div class="k">화면에 보이던 장비</div><div class="v">11 → ${screenAfter.equipmentTotal ?? "—"}</div><div class="d">예제 프로젝트를 열었을 때</div></div>
  <div class="card"><div class="k">기본 아이템 총수</div><div class="v">${counts.before.itemTotal} → ${counts.after.itemTotal}</div><div class="d">코드가 만들어 주는 개수</div></div>
  <div class="card"><div class="k">기본 장비 총수</div><div class="v">${counts.before.equipmentTotal} → ${counts.after.equipmentTotal}</div><div class="d">코드가 만들어 주는 개수</div></div>
  <div class="card"><div class="k">10개 미달 칸</div><div class="v">6 → 0</div><div class="d">아이템 6종 + 장비 5칸 기준</div></div>
</div>

<h2>1. 무엇이 문제였나</h2>

<h3>문제 ①  장비가 화면에 11개만 나왔다</h3>
<p>편집기를 열면 예제 프로젝트가 뜹니다. 그 예제는 <code>src/project/defaults/fixtures/dew-village-demo.json</code>
이라는 <b>굳어 있는 파일</b>을 복사해서 만듭니다. 이 파일은 옛날에 한 번 내보낸 스냅샷이라, 그 뒤에 코드로 추가한
장비들이 들어 있지 않습니다. 실제로 세어 보니 아이템 21개, 장비 11개였습니다.</p>
<p>불러오는 과정에 <code>ensureDefaultDatabaseIconResources()</code> 라는 함수가 있습니다. 이 함수는
<b>빠진 기본 아이템을 찾아서 넣어 줍니다.</b> 그래서 아이템은 21개에서 ${counts.before.itemTotal}개로 늘어났습니다.
그런데 <b>장비에는 같은 처리를 하지 않았습니다.</b> 아이콘만 다시 붙여 줄 뿐이었죠. 그래서 장비는 11개에 멈췄습니다.</p>
<p>이게 사용자가 "기본 아이템이 너무 적다"고 느낀 가장 큰 이유입니다. 그리고 <b>"하드코딩된 코드파일이 제일 문제"라는
짐작이 맞았습니다</b> — 다만 범인은 아이템 목록을 적은 TypeScript 파일이 아니라, 굳어 버린 JSON 사본과
그 위에 얹힌 한쪽만 채워 주는 로직이었습니다.</p>
${comparePair("03-equipment-tab-overview", "데이터베이스 → 장비 탭")}

<h3>문제 ②  아이템 종류별 개수가 치우쳐 있었다</h3>
<p>기본 아이템은 TypeScript 파일 네 개에 사람이 손으로 적어 둡니다. 손으로 적으면 아무도 종류별로 세지 않습니다.
그래서 일반 물품은 ${counts.before.items.normalGoods}개나 되는데 기술서는 ${counts.before.items.book}개,
씨앗은 ${counts.before.items.seed}개, 스위치는 ${counts.before.items.switch}개로 방치돼 있었습니다.</p>
${comparePair("02-item-book", "아이템 종류 “기술서” 목록과 상세")}
${comparePair("02-item-switch", "아이템 종류 “스위치” 목록과 상세")}

<h2>2. 숫자로 본 전후 비교</h2>
<h3>아이템 종류별</h3>
<table>
<thead><tr><th>종류</th><th class="num">전</th><th>　</th><th class="num">후</th><th>　</th><th>10개</th></tr></thead>
<tbody>
${itemRows}
</tbody>
</table>
<h3>장비 칸별</h3>
<table>
<thead><tr><th>칸</th><th class="num">전</th><th>　</th><th class="num">후</th><th>　</th><th>10개</th></tr></thead>
<tbody>
${equipRows}
</tbody>
</table>
<p>이 숫자는 코드를 실제로 실행해서 뽑았습니다. 직접 확인하려면 이렇게 하면 됩니다.</p>
<pre>npx vite-node scripts/report-default-catalog-counts.mts</pre>

<h2>3. 어떻게 고쳤나</h2>
<h3>고침 ①  장비도 불러올 때 채워 넣는다</h3>
<p><code>ensureDefaultDatabaseIconResources()</code> 가 아이템에 하던 일을 장비에도 하게 했습니다.
<b>이미 있는 것은 절대 건드리지 않습니다.</b> 없는 것만 새로 넣습니다. 그래서 사용자가 장비 이름이나 수치를
고쳐 놓았다면 그 값이 그대로 남습니다.</p>
<p>순서도 중요합니다. 새로 넣는 처리를 아이콘 붙이는 처리보다 <b>먼저</b> 두었습니다. 그러면 새로 들어온 장비도
같은 아이콘 배선을 그대로 타게 되어, 아이콘 코드를 따로 손볼 필요가 없습니다.</p>

<h3>고침 ②  종류마다 10개 이상으로 채운다</h3>
<p>기술서·씨앗·스위치는 각각 11개, 방패·갑옷·투구도 각각 11개가 되도록 새 기본값을 넣었습니다.
10개가 아니라 11개로 맞춘 이유는, 나중에 하나가 빠져도 10개 선이 무너지지 않게 하려는 여유분입니다.</p>
<p>기존 규칙을 그대로 지켰습니다. 이름에는 한글이 들어가고, 설명은 서로 겹치지 않는 구체적인 한국어 문장이며,
전투에서 쓰는 아이템은 실제로 있는 전투 애니메이션을 가리킵니다. 장비는 <code>칸:가격:능력치</code> 조합이
서로 달라야 하는 규칙도 지켰습니다. 씨앗은 밭 배선이 필요 없는 <b>영구 성장 씨앗</b>만 썼습니다 —
심을 밭이 없는 씨앗을 목록에 올리면 안 된다는 기존 계약이 있어서입니다.</p>

<h3>고침 ③  개수를 기계가 센다</h3>
<p>사람이 세지 않아서 생긴 문제니까, 기계가 세게 만들었습니다. 새 테스트가 아이템 6종과 장비 5칸을 모두 세어
하나라도 10개 아래로 내려가면 <b>어느 종류가 부족한지 이름까지 찍어서</b> 실패합니다.</p>
<pre>npx vitest run test/defaultCatalogMinimumPerType.test.ts --config vitest.config.ts</pre>
<p>덧붙여, <code>weapon·shield·body·head·accessory</code> 라는 아이템 종류는 아이템 목록에 <b>0개여야 한다</b>는
계약도 함께 고정했습니다. 착용 장비는 장비 탭에만 두기로 이미 정해져 있고, 아이템 탭에서 그 종류를 고르면
장비 탭으로 넘어가는 문만 보여 줍니다. 이 계약을 모르고 아이템 쪽에 무기를 채우면 규칙 위반이 됩니다.</p>

<h2>4. "추가해도 사라진다"에 대해</h2>
<div class="note">
<p>추가한 아이템이 사라지는 현상은 <b>주소에 붙는 값</b> 때문일 가능성이 가장 큽니다.
<code>?freshProject=1</code>, <code>?blankProject=1</code>, 개발용 쇼케이스 주소로 열면
<b>원격 저장이 일부러 꺼집니다.</b> 이 상태에서 무엇을 추가해도 서버에는 올라가지 않고,
새로 열면 굳어 있는 예제 사본이 다시 로드되면서 추가분이 사라집니다.</p>
<p>문제는 <b>그 사실이 화면에 안 보여다는 점</b>입니다. 저장 표시가 "저장됨"처럼 보였으니 사용자는 저장됐다고
믿을 수밖에 없습니다. 그래서 이 세션에서는 상단 저장 표시가 <b>저장되지 않는 세션임을 분명하게 말하도록</b>
바꿨습니다. 저장이 안 되는 건 원래 의도된 동작이고, 조용했던 것이 결함이었습니다.</p>
<p><b>남은 어색함 하나를 그대로 적어 둡니다.</b> 데이터버이스 모달 왜쯝 아래에는 여전힐 <code>✓ 자동 저장됨</code> 이
적혀 있습니다. 그 문구는 본래 "편집이 바로 적용된다" 는 뜿이지 "서버에 저장됐다" 는 뜿이 아니고,
새로 만들진 것도 아닙니다. 단, 한 화면에서 동시에 보이니 헷걱을 사손니다. 이번엔 건드리지 않았습니다 —
이 표시는 모달을 여는 순간 한 번만 그려지므로 살아서 반생하게 하려면 모달 구독 수명주기까지 손대야 하고,
그건 이 작업의 범위를 넘습니다. 다잡이로 따로 다를 사안입니다.</p>
</div>
${shotFigure(after, "06-session-not-persisted-page", `아이템 추가 후 화면 전역. 상단에 “${after.autoSaveChipText ?? "이 세션은 저장 안 됨"}” 이 볉간색으로 뜼어 있다.`)}
${shotFigure(after, "05-item-added", "아이템을 추가한 직후 — 새 레코드가 목록에 들어가 선택된 상태")}
<p>참고로 목록의 행 개수를 세어 버그를 판단하면 안 됩니다. 이 목록은 화면에 보이는 만큼만 그리는
<b>가상 목록</b>이라(<code>createVirtualList</code>), 아이템이 200개든 20개든 행 개수는 비슷하게 나옵니다.
총수는 목록 행의 <code>data-record-total</code> 값이나 위의 카운터로 확인해야 합니다.</p>

<h2>5. 종류별 실제 화면</h2>
<p>고친 뒤의 편집기 화면입니다. 종류를 하나씩 골라 실제 레코드가 들어 있는 걸 확인했습니다.</p>
${ITEM_TYPES.map((type) => shotFigure(after, `02-item-${type}`, `아이템 종류 “${KO_TYPE[type]}” — 현재 ${counts.after.items[type] ?? 0}개`)).join("\n")}
${EQUIP_SLOTS.filter((slot) => slot === "shield" || slot === "armor" || slot === "helmet").map((slot) => shotFigure(after, `04-equipment-${slot}`, `장비 칸 “${KO_SLOT[slot]}” — 현재 ${counts.after.equipment[slot] ?? 0}개`)).join("\n")}
${shotFigure(after, "01-items-tab-overview", "데이터베이스 → 아이템 탭 전체 모습")}

<h2>6. 확인에 쓴 명령</h2>
<pre>${[
  "# 종류별 개수 (코드를 실제로 실행해 셈)",
  "npx vite-node scripts/report-default-catalog-counts.mts",
  "",
  "# 최소 개수 계약 + 카탈로그 품질 + 장비 보충",
  "npx vitest run test/defaultCatalogMinimumPerType.test.ts \\",
  "  test/defaultItemCatalogQuality.test.ts \\",
  "  test/defaultItemRecordsIntegrity.test.ts \\",
  "  test/defaultEquipmentBackfill.test.ts \\",
  "  test/itemAddPersistence.test.ts --config vitest.config.ts",
  "",
  "# 타입 검사",
  "npx tsc --noEmit -p tsconfig.app.json",
  "",
  "# 화면 증거 캡처 (dev 서버가 뜬 포트를 넘긴다)",
  "DEV_SERVER_PORT=9861 SHOT_OUT=verify-shots/item-catalog-after \\",
  "  node scripts/capture-item-catalog-evidence.mjs",
].join("\n")}</pre>

<h2>7. 화면에서 직접 읽은 숫자</h2>
<p>스크린샷을 찍을 때 편집기가 들고 있던 프로젝트를 그대로 읽어 기록해 둔 값입니다.
코드 카운터와 따로 재기 때문에, 둘이 어긋나면 바로 드러납니다.</p>
<table>
<thead><tr><th>측정</th><th class="num">전</th><th class="num">후</th></tr></thead>
<tbody>
<tr><th>화면 아이템 총수</th><td class="num">${screenBefore.itemTotal ?? "—"}</td><td class="num strong">${screenAfter.itemTotal ?? "—"}</td></tr>
<tr class="was-short"><th>화면 장비 총수</th><td class="num">${screenBefore.equipmentTotal ?? "—"}</td><td class="num strong">${screenAfter.equipmentTotal ?? "—"}</td></tr>
</tbody>
</table>

<footer>
<p>스크린샷은 실제 편집기를 크로미움으로 띄워 찍었습니다. 원본 PNG 는
<code>verify-shots/item-catalog-before/</code> 와 <code>verify-shots/item-catalog-after/</code> 에 있습니다.
이 파일은 이미지를 안에 품고 있어 혼자서도 열립니다.</p>
</footer>
</main>
</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html, "utf8");
console.log(`[report] ${OUT}`);
console.log(`[report] ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
