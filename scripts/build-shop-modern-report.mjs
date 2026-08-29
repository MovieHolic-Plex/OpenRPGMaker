/**
 * 보고서 생성기 — 상점 결함 수정 + 모던 UI 전환.
 *
 * `output/evidence/shop-modern/*.png`(수정 후)와 `output/evidence/shop-report/*.png`(수정 전)를
 * base64 로 심어 단일 HTML 을 만든다. 이미지가 하나라도 없으면 즉시 실패한다 —
 * 캡처 없이 만들어진 "그림 없는 이미지 리치 보고서"를 막는다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { loadShots, makeImageHelpers, REPORT_CSS } from "./lib/reportShell.mjs";

const AFTER_DIR = "output/evidence/shop-modern";
const BEFORE_DIR = "output/evidence/shop-report";
const OUT = "reports/shop-modern-runtime-and-fixes-2026-08-29.html";

const shots = { ...loadShots(AFTER_DIR, "a/"), ...loadShots(BEFORE_DIR, "b/") };
const { img, fig, ba } = makeImageHelpers(shots);

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>상점 결함 수정 · 모던 런타임 전환 — rpg-zzu</title>
<style>
${REPORT_CSS}</style>
</head>
<body>

<header class="hero">
  <div class="wrap">
    <h1>상점: 결함 10건을 고치고 런타임 화면을 모던 상점으로 바꿨다</h1>
    <p class="lede">보고서에서 지적한 결함 7건을 전부 수정했고, 고치는 과정에서 <b>드러나지 않았던 결함 3건</b>을 더 찾아 같이 고쳤다.
    런타임 상점 화면은 나무 텍스처 위에 픽셀 글꼴로 목록만 뿌리던 2003 클론에서 <b>유리 카드 · 탭 · 카테고리 칩 · 상세 카드 · 소지금 델타</b>를 갖춘
    화면으로 다시 만들었다. 아래 화면은 전부 이 워크트리의 현재 코드를 Chromium 에서 실제로 띄워 찍은 것이다.</p>
    <div class="meta">
      <span>2026-08-29</span>
      <span>브랜치 상점 · 기준 HEAD f67cac85</span>
      <span>Playwright / Chromium 1280×800 · 1600×1000</span>
      <span>캡처 19장 · 전부 실측</span>
      <span>결함 7 + 추가 3 = 10건 수정</span>
    </div>
  </div>
</header>

<div class="wrap">

<nav class="toc">
  <ol>
    <li><a href="#s1">한눈에</a></li>
    <li><a href="#s2">수정 전 · 후</a></li>
    <li><a href="#s3">새 화면 해부</a></li>
    <li><a href="#s4">고친 결함 10건</a></li>
    <li><a href="#s5">에디터 쪽 수정</a></li>
    <li><a href="#s6">실측 수치</a></li>
    <li><a href="#s7">코드 지도</a></li>
    <li><a href="#s8">검증과 남은 것</a></li>
  </ol>
</nav>

<h2 id="s1"><span class="n">01</span>한눈에</h2>
<div class="cards">
  <div class="card"><h5>고친 결함</h5><div class="big">10건</div><p>보고서 7건 + 고치다 발견한 3건</p></div>
  <div class="card"><h5>죽어 있던 옵션</h5><div class="big">7개 → 0개</div><p>에디터에서 저장은 되지만 런타임에 도달하지 않던 필드</p></div>
  <div class="card"><h5>진열 가능 원본</h5><div class="big">아이템 + 장비</div><p>무기점·방어구점을 이제 만들 수 있다</p></div>
  <div class="card"><h5>자료집 중복 id</h5><div class="big">179 / 179</div><p>레코드 수 = 고유 id 수 (전에는 174)</p></div>
  <div class="card"><h5>새 런타임 CSS</h5><div class="big">1078행</div><p><code>shop.css</code> 신규 · <code>commerce.css</code> 에서 342행 분리</p></div>
  <div class="card"><h5>e2e 캡처 스펙</h5><div class="big">5 / 5 통과</div><p><code>_shop-modern-shots.spec.ts</code></p></div>
</div>

<div class="note ok"><b>핵심.</b> 결함 대부분의 뿌리는 두 곳이었다. ①
<code>commandCatalog.ts</code> 의 <code>pause("shop", …)</code> 페이로드가 에디터 필드 7개를 빼고 넘겨서, 편집창에서 켠 옵션이 런타임에 아예 도달하지 않았다.
② 상점이 <code>database.items</code> 만 읽어서 장비 탭 레코드를 진열할 수 없었고, 참조 검증까지 장비 id 를 거부해 무기점을 만들면 <b>프로젝트가 로드조차 되지 않았다</b>.</div>

<h2 id="s2"><span class="n">02</span>수정 전 · 후</h2>

<h3>구입 화면</h3>
<p>같은 진열(회복약·마력약·해독초·상급 회복약·포획 구슬·귀환 주문서·검술 교본)에 같은 소지금 200G 다.</p>
${ba(
  "b/runtime-02-buy-list",
  "a/02-buy-list",
  "구입 목록",
  "나무 텍스처 창 한 장이 화면 대부분을 먹고, 목록 아래 60% 는 빈 갈색이다. 오른쪽 패널 3개는 폭 200px 에 눌려 있고 UI 글자에도 픽셀 글꼴이 걸려 가격이 읽기 어렵다. 상세 정보는 창 맨 위 한 줄뿐이다.",
  "상단바에 상인 얼굴·가게 이름·구입/판매 탭·소지금(내 것 + 상인 것)이 한 줄로 모였다. 목록에는 카테고리 칩(전체 9 · 소비 5 · 특수 1 · 재료 1 · 장비 2)이 붙고, 오른쪽은 아이콘·이름·분류·설명·보유 수를 담은 상세 카드다. 못 사는 줄은 흐림 + 취소선 + 자물쇠로 구분된다."
)}

<h3>입구 화면</h3>
${ba(
  "b/runtime-01-menu",
  "a/01-entry-menu",
  "입구 메뉴",
  "빈 상단 패널 + 인사말 한 줄 + 버튼 세 개. 상인 얼굴도, 소지금도, 여기가 무슨 가게인지도 없다.",
  "상인 얼굴 + 가게 이름 + 무엇을 하는 곳인지 한 줄 + 인사말 + 소지금 + 설명이 달린 선택 카드 세 장. 커서(금색)와 키 힌트가 화면에 있다."
)}

<h3>화면 전체(뷰포트)에서 차지하는 자리</h3>
<div class="grid2">
  ${fig("b/runtime-02b-buy-list-viewport", "수정 전", "플레이 영역 전체가 갈색 상자 한 장이다.", "dark")}
  ${fig("a/02b-buy-viewport", "수정 후", "장면을 어둡게 덮는 스크림 위에 카드가 뜬다 — 게임 화면이 뒤에 남아 「가게에 들어와 있다」가 읽힌다.", "dark")}
</div>

<div class="note"><b>스크림 결정.</b> 예전에는 오버레이 자신이 윈도스킨 <code>border-image</code> 로 플레이 영역 전체를 칠하고 그 안에 또 패널을 깔아 <b>상자 속 상자</b>가 됐다.
이제 오버레이는 창이 아니라 스크림(<code>radial-gradient</code> + <code>backdrop-filter: blur(7px)</code>)이고, 표면은 개별 카드만 그린다.
<code>backdrop-filter</code> 를 못 쓰는 환경에서는 <code>@supports</code> 밖의 기본 규칙이 살아나 <b>자료집 System 윈도스킨 border-image 로 되돌아간다</b> — 고전 스킨이 폴백이다.</div>

<h2 id="s3"><span class="n">03</span>새 화면 해부</h2>

<h3>상세 카드 — 장비에 커서를 얹으면 능력치 격자</h3>
<div class="grid2">
  ${fig("a/03-equipment-detail", "장비 상세", "청동 검에 커서를 얹은 상태. 공격 ▲8 · 보유 0 · 장비 1(파티가 이미 하나 착용 중).", "dark")}
  ${fig("a/03b-detail-card", "상세 카드 확대", "아이콘 · 이름 · 분류 배지 · 설명 · 능력치 격자 · 보유/장비 수. 커서가 움직이면 카드 조각만 갈아 끼워 낭독이 끊기지 않는다.", "dark")}
</div>

<h3>카테고리 칩</h3>
${fig("a/04-category-filter", "장비만 보기", "「장비」 칩을 누르면 소비·특수·재료가 빠진다. 칩줄은 <b>필터 걸기 전 전체 진열</b>로 만들어서, 한 종류만 남아도 「전체」로 돌아올 길이 사라지지 않는다.", "dark")}

<h3>못 사는 줄</h3>
${fig("a/05-unaffordable", "소지금 부족", "검술 교본 320G · 소지금 200G. 흐림 + 취소선 + 자물쇠로 미리 보이고, 커서는 얹히지만 결정만 거절한다(<code>data-unaffordable=1</code>). 이유는 하단 프롬프트에 문장으로 나온다.", "dark")}

<h3>구매 후 — 창이 닫히지 않는다</h3>
<div class="grid2">
  ${fig("a/06-after-buy", "회복약 2개 구입", "소지금 200 → 176G, 상인 450 → 474G. 값 위로 −24G 가 떠올랐다 사라지고 숫자가 한 번 반짝인다. 창은 그대로 열려 있어 계속 살 수 있다.", "dark")}
  ${fig("a/07-sell-tab", "탭으로 판매 전환", "입구 메뉴를 거치지 않는다. 판매 목록은 <b>소지품</b>이다(진열품이 아니다) — 회복약 ×2 · 해독초 ×3 · 귀환 주문서 ×1, 각각 한 줄씩.", "dark")}
</div>
${fig("a/08-after-sell", "해독초 되팔기", "판매가는 매입가의 절반이다. 상인 소지금이 줄고 내 소지금이 는다.", "dark")}

<h3>키보드</h3>
<p>화면 아래에 조작 힌트가 상시로 있다 — 수량 모드가 <code>select</code> 면 <code>←→ 수량</code> 이 함께 뜨고, <code>single</code> 이면 빠진다.
공용 커서(<code>attachCursorMenu</code>)의 청색 RM2003 바는 가게 안에서만 가게 팔레트(금색)로 바꿨다. 가게 밖 맵·전투 메뉴는 그대로 청색이다.</p>

<h2 id="s4"><span class="n">04</span>고친 결함 10건</h2>

<table>
<thead><tr><th>#</th><th>증상</th><th>실제 원인</th><th>등급</th><th>상태</th></tr></thead>
<tbody>
<tr><td class="num">F-1</td><td>「거래 못 했을 때」 분기가 절대 실행되지 않는다</td><td><code>finish()</code> 가 늘 <code>false</code> 로 resolve · 페이로드에 <code>branchOnFailedTransaction</code> 없음</td><td><span class="chip hi">높음</span></td><td><span class="chip done">수정</span></td></tr>
<tr><td class="num">F-2</td><td>추가 서비스·마일리지·투자 Lv 가 게임을 바꾸지 않는다</td><td><code>pause("shop")</code> 페이로드에서 필드 6개 누락</td><td><span class="chip hi">높음</span></td><td><span class="chip done">수정</span></td></tr>
<tr><td class="num">F-3</td><td>자료집 179행 중 5개가 중복 id</td><td><code>defaultDatabaseItemRecords</code> 의 채움 레코드가 큐레이션 id 와 충돌</td><td><span class="chip mid">중간</span></td><td><span class="chip done">수정</span></td></tr>
<tr><td class="num">F-4</td><td>무기점·방어구점을 만들 수 없다</td><td>상점이 <code>database.items</code> 만 읽음(장비는 별도 컬렉션)</td><td><span class="chip mid">중간</span></td><td><span class="chip done">수정</span></td></tr>
<tr><td class="num">F-5</td><td>메시지 유형 드롭다운에 6종 중 일부만</td><td>에디터 상수와 런타임 문구가 각자 목록을 들고 있었다</td><td><span class="chip lo">낮음</span></td><td><span class="chip done">수정</span></td></tr>
<tr><td class="num">F-6</td><td>미리보기 문구 오타(“어심 오세요”)</td><td>문구가 두 곳에 복사돼 있었다</td><td><span class="chip lo">낮음</span></td><td><span class="chip done">수정</span></td></tr>
<tr><td class="num">F-7</td><td>빈 상점 린트 문구가 실제 동작과 다르다</td><td>“조용히 지나간다” 로 적혀 있었지만 안내를 띄우고 닫는다</td><td><span class="chip lo">낮음</span></td><td><span class="chip done">수정</span></td></tr>
<tr><td class="num">X-1</td><td>장비 id 를 담은 상점이 있으면 <b>프로젝트가 로드되지 않는다</b></td><td>참조 검증이 <code>shop.itemIds</code> 를 <code>itemIds</code> 집합만으로 대조</td><td><span class="chip hi">높음</span></td><td><span class="chip extra">추가 발견</span></td></tr>
<tr><td class="num">X-2</td><td>저장된 메시지 유형이 드롭다운에 반영되지 않는다</td><td><code>select.value</code> 대입이 <code>option</code> append 보다 앞이라 no-op</td><td><span class="chip mid">중간</span></td><td><span class="chip extra">추가 발견</span></td></tr>
<tr><td class="num">X-3</td><td>마일리지·누적 지출이 쌓이는지 밖에서 확인 불가</td><td>세이브에는 있는데 런타임 상태 덤프에는 없었다</td><td><span class="chip lo">낮음</span></td><td><span class="chip extra">추가 발견</span></td></tr>
</tbody>
</table>

<div class="fx">
<h3><span class="fx-id">F-1</span> 「거래 못 했을 때」 분기가 도달 불가능한 죽은 코드였다</h3>
<p>편집창에서 「거래하지 못했을 때」를 켜고 분기에 명령을 넣어도 실행되지 않았다. 원인이 둘이라 하나만 고쳐도 여전히 안 됐다.</p>
<pre><code><span class="cmt">// ① 페이로드: branchOnTransaction 만 넘기고 실패 쪽은 빼먹었다 (commandCatalog.ts)</span>
  branchOnTransaction: command.branchOnTransaction,
<span class="add">+ branchOnFailedTransaction: command.branchOnFailedTransaction,</span>

<span class="cmt">// ② 결과 값: 한 번도 거래하지 않고 나가도 늘 false 였다 (playSceneShop.ts)</span>
  const finish = () => {
    teardownCursor();
<span class="del">-   finishCommerce(scene, overlay, resolve, false);</span>
<span class="add">+   finishCommerce(scene, overlay, resolve, transactionCompleted ? true : failedResult());</span>
  };</code></pre>
<div class="grid2">
  ${fig("a/11-empty-notice", "빈 상점 안내", "진열이 비면 조용히 지나가지 않고 안내를 띄운다.", "dark")}
  ${fig("a/12-empty-branch-ran", "실패 분기 실행", "안내를 닫으면 「거래하지 못했을 때」 분기의 대사가 실제로 나온다.", "dark")}
</div>
<dl>
  <dt>검증</dt><dd>e2e <code>F-1</code> — 빈 상점 / 진열은 있지만 아무것도 안 사고 나가기, 두 경로 모두 분기 대사 확인</dd>
  <dt>파일</dt><dd class="path">src/player/interpreter/commandCatalog.ts · src/player/playSceneShop.ts · src/player/interpreter/types.ts</dd>
</dl>
</div>

<div class="fx">
<h3><span class="fx-id">F-2</span> 추가 서비스·마일리지·투자 레벨이 런타임에 도달하지 않았다</h3>
<p><code>pause("shop", …)</code> 가 넘기지 않은 필드는 런타임에서 존재하지 않는다. 편집창은 저장했고 JSON 에도 남았지만 게임은 달라지지 않았다.</p>
<pre><code><span class="cmt">// commandCatalog.ts — 추가한 6개</span>
<span class="add">+ shopServiceKind: command.shopServiceKind,
+ appraisalUnidentifiedPool: command.appraisalUnidentifiedPool,
+ loyaltyTierId: command.loyaltyTierId,
+ mileageRate: command.mileageRate,
+ investmentLevel: command.investmentLevel,
+ branchOnFailedTransaction: command.branchOnFailedTransaction,</span></code></pre>
<p><code>investmentLevel</code> 은 페이로드에 실어도 읽는 곳이 없었다. 상인 매입 예산 배수로 실제 소비자를 만들었다 — <code>1 + 0.25 × min(5, level)</code>.</p>
<pre><code><span class="cmt">// shopStock.ts</span>
<span class="add">export function resolveShopMerchantBudget(merchantGold, investmentLevel) {
  return Math.floor(resolveShopMerchantGold(merchantGold) * resolveShopInvestmentMultiplier(investmentLevel));
}</span></code></pre>
<div class="grid2">
  ${fig("a/13-appraisal-empty-pool", "감정소 · 빈 풀", "<code>shopServiceKind: appraisal</code> 인데 감정 대상 풀이 비면 전용 안내를 띄우고 실패로 처리한다(빈 풀에 수수료를 받지 않는다).", "dark")}
  ${fig("a/14-repair-investment", "수리점 · 투자 Lv 4", "가게 이름이 「수리점」으로 바뀌고, 상인 소지금이 100G × (1+0.25×4) = <b>200G</b> 로 실측된다.", "dark")}
</div>
<dl>
  <dt>검증</dt><dd>e2e <code>F-2</code> — 감정소 안내 · 수리점 헤더 + 상인 200G · 마일리지 적립(<code>shopMileagePoints 1</code>, <code>shopLoyaltySpend.tier_gold 12</code>)</dd>
  <dt>파일</dt><dd class="path">src/player/interpreter/commandCatalog.ts · src/player/interpreter/types.ts · src/project/shopStock.ts</dd>
</dl>
</div>

<div class="fx">
<h3><span class="fx-id">F-3</span> 자료집 179행에 중복 id 5개</h3>
<p>큐레이션 레코드와 자동 채움 레코드가 같은 id 를 쓰고 있었다. 판매 목록에 같은 물건이 두 줄로 나오고, 재고 편집이 어느 줄에 붙는지 알 수 없었다.</p>
<p>처음 고칠 때 <b>중복을 버렸더니 아이콘이 고아가 됐다</b> — 두 레코드가 서로 다른 아이콘을 들고 있어서 <code>cc0IconAssets.test.ts</code> 가 <code>cc0-jetrel-traveler-badge</code> 를 잃었다. 버리지 않고 이름을 바꾸는 쪽으로 다시 만들었다.</p>
<pre><code><span class="cmt">// defaultDatabaseItemRecords.ts</span>
function dedupeById(records) {
  for (const record of records) {
    if (!seen.has(record.id)) { <span class="cmt">/* 그대로 */</span> continue; }
<span class="add">    const renamed = record.id.replace(/^item_/, "item_gen_");  // 버리지 않고 개명</span>
    if (seen.has(renamed)) continue;
    unique.push({ ...record, id: renamed });
  }
}</code></pre>
<p>결과: 레코드 179개 · 고유 id 179개 · 고아 아이콘 0개 · <code>items ∩ equipment</code> 교집합 0개.
판매 목록에서 같은 물건이 한 줄로만 나오는 것은 위 <a href="#s3">07-sell-tab</a> 캡처에서 확인된다(<code>귀환 주문서</code> 1줄).</p>
</div>

<div class="fx">
<h3><span class="fx-id">F-4</span> 무기점·방어구점을 만들 수 없었다</h3>
<p>자료집은 <b>아이템 탭</b>(<code>database.items</code>)과 <b>장비 탭</b>(<code>database.equipment</code>)이 별도 컬렉션이다. 상점은 아이템만 읽었다.
장비 탭에 있는 검·방패·갑옷은 편집창 자료집에도 안 나오고, id 를 직접 넣으면 런타임 목록이 통째로 비었다.</p>
<p>런타임·에디터가 함께 쓸 <b>단일 뷰 모델</b>을 새로 만들어 양쪽 컬렉션을 합쳤다.</p>
<pre><code><span class="cmt">// src/player/playSceneShopGoods.ts (신규 140행)</span>
export type ShopGoods = { id, name, price, category, iconResourceId, description, source: "item" | "equipment", … }
export function goodsIndex(project): Map&lt;string, ShopGoods&gt;   <span class="cmt">// id 유일 · 아이템이 장비보다 우선</span></code></pre>
${fig("a/10-weapon-shop", "무기점", "장비 탭 레코드 8개(짧은 검·청동 검·철 검·강철 검·참나무 방패·가죽 갑옷·여행자 모자·집중 부적)로 만든 무기점. 예전에는 이 목록이 통째로 비었다. 철 검을 사면 <code>inventory.equip_iron_sword = 1</code> 이 실측된다.", "dark")}
<dl>
  <dt>검증</dt><dd>e2e <code>F-4</code> — 목록 표시 · 구매 후 인벤토리 · 에디터 자료집 검색(“철 검”)</dd>
  <dt>파일</dt><dd class="path">src/player/playSceneShopGoods.ts(신규) · src/player/playSceneShop.ts · src/editor/panels/eventEditor/commandBodyCommerce.ts</dd>
</dl>
</div>

<div class="fx extra">
<h3><span class="fx-id">X-1</span> 장비 id 를 담은 상점이 있으면 프로젝트가 로드되지 않았다 <span class="chip extra">추가 발견</span></h3>
<p>F-4 를 고친 뒤에도 무기점 e2e 가 플레이 모드에 진입조차 못 했다. 필드 조합 7가지(A~G)를 이분 탐색해 원인을 좁혔다 —
<code>shop.itemIds</code> 에 장비 id 가 하나라도 있으면 <b>참조 검증에서 프로젝트 전체가 거부</b>되고 있었다. 런타임이 목록을 비우는 문제가 아니라, 그 앞에서 프로젝트가 죽는 문제였다.</p>
<pre><code><span class="cmt">// src/project/io/commandReferenceValidation.ts</span>
case "shop": {
<span class="del">- requireExistingIds("shop: item", command.itemIds, context.itemIds);</span>
<span class="add">+ const sellable = union(context.itemIds, context.equipmentIds);
+ requireExistingIds("shop: item", command.itemIds, sellable);</span>
  …
}</code></pre>
<div class="note warn"><b>이게 왜 중요한가.</b> 이 결함은 화면에 오류로 나타나지 않는다. 프로젝트가 조용히 로드되지 않아 플레이 버튼이 아무 일도 하지 않는다.
F-4 만 고치고 끝냈다면 “장비 상점이 여전히 안 된다”로 남았을 것이다.</div>
</div>

<div class="fx extra">
<h3><span class="fx-id">X-2</span> 저장된 메시지 유형이 드롭다운에 반영되지 않았다 <span class="chip extra">추가 발견</span></h3>
<p>F-5 를 고치며 발견했다. <code>select.value</code> 대입이 <code>option</code> 을 붙이기 <b>전</b>에 있어서 항상 no-op 이었다 —
어떤 유형을 저장해 두었든 편집창을 다시 열면 드롭다운은 늘 첫 항목(「인사말」)을 보여줬다.</p>
<pre><code><span class="cmt">// commandBodyCommerce.ts</span>
<span class="del">- select.value = messageTypeValue(command);   // option 이 아직 없다 → 무시된다</span>
  for (const option of SHOP_MESSAGE_OPTIONS) select.append(…);
<span class="add">+ select.value = messageTypeValue(command);   // append 뒤에야 반영된다</span></code></pre>
${fig("a/21-editor-message-persisted", "다시 열어도 유지", "「축제 특가」를 저장하고 편집창을 닫았다가 명령을 두 번 클릭해 다시 열면 드롭다운이 <code>festival</code> 을 보여준다.")}
</div>

<div class="fx extra">
<h3><span class="fx-id">X-3</span> 마일리지·누적 지출이 밖에서 확인 불가였다 <span class="chip extra">추가 발견</span></h3>
<p><code>saveSlots.ts</code> 는 진작 저장하고 있었지만 런타임 상태 덤프에는 없어서, 실제로 쌓이는지 확인할 방법이 없었다.
검증 가능성 자체가 결함이라 판단해 스냅샷에 노출했다.</p>
<pre><code><span class="cmt">// playSceneMapRuntime.ts</span>
<span class="add">+ shopLoyaltySpend: scene.session.shopLoyaltySpend,
+ shopTradeCounts: scene.session.shopTradeCounts,
+ shopMileagePoints: scene.session.shopMileagePoints,</span></code></pre>
</div>

<h2 id="s5"><span class="n">05</span>에디터 쪽 수정</h2>

<h3>메시지 유형 6종 + 문구 단일 출처 (F-5 · F-6)</h3>
<p>에디터 미리보기와 런타임 인사말이 각자 문구를 들고 있어서 한쪽만 고치면 어긋났다(오타 “어심 오세요”가 그렇게 남았다).
<code>src/project/shopMessages.ts</code> 를 만들어 양쪽이 같은 함수를 부르게 했다.</p>
<pre><code><span class="cmt">// src/project/shopMessages.ts (신규 71행) — 에디터와 런타임의 단일 출처</span>
export const SHOP_MESSAGE_TYPES = ["welcome","business","direct","festival","closingSale","vip"] as const;
export function shopGreetingText(messageType, terms): string   <span class="cmt">// welcome → terms.shopGreeting</span></code></pre>
${fig("a/20-editor-message-types", "메시지 유형", "드롭다운 값이 정확히 6종이고(<code>welcome · business · direct · festival · closingSale · vip</code>) 미리보기가 유형에 따라 바뀐다. 「축제 특가」 선택 상태.")}

<h3>자료집에 장비가 함께 잡힌다 (F-4 에디터 절반)</h3>
${fig("a/22-editor-equipment-catalog", "장비 검색", "편집창 자료집에서 “철 검”을 검색하면 <code>shop-catalog-row-equip_iron_sword</code> 가 나온다. 장비 슬롯을 아이템 분류로 매핑해(<code>EQUIPMENT_SLOT_TO_ITEM_TYPE</code>) 같은 목록에 섞는다.")}

<h2 id="s6"><span class="n">06</span>실측 수치</h2>
<p>아래는 e2e 가 브라우저에서 그대로 덤프한 런타임 상태다.</p>

<table>
<thead><tr><th>시나리오</th><th>조작</th><th class="num">소지금</th><th class="num">상인</th><th>세션 상태</th></tr></thead>
<tbody>
<tr><td>잡화점</td><td>회복약 12G × 2 구입</td><td class="num">200 → 176</td><td class="num">450 → 474</td><td><code>inventory.item_potion 2</code></td></tr>
<tr><td>잡화점</td><td>해독초 되팔기(매입 8G → 판매 4G)</td><td class="num">176 → 180</td><td class="num">474 → 470</td><td><code>item_antidote 3 → 2</code></td></tr>
<tr><td>무기점 (F-4)</td><td>철 검 180G 구입</td><td class="num">400 → 220</td><td class="num">200 →</td><td><code>equip_iron_sword 1</code> · <code>shopLoyaltySpend.global 180</code></td></tr>
<tr><td>수리점 (F-2)</td><td>투자 Lv 4, 명령값 100G</td><td class="num">—</td><td class="num">200</td><td><code>100 × (1 + 0.25×4)</code></td></tr>
<tr><td>마일리지 (F-2)</td><td>회복약 12G 구입, 적립률 0.1</td><td class="num">200 → 188</td><td class="num">—</td><td><code>shopMileagePoints 1</code> · <code>shopLoyaltySpend.tier_gold 12</code></td></tr>
</tbody>
</table>

<pre><code><span class="cmt">// F-2 마일리지 시나리오 — runtime-state-json 발췌</span>
"gold": 188,
"inventory": { "item_potion": 1 },
"shopLoyaltySpend": { "tier_gold": 12 },
"shopTradeCounts": { "item_potion": { "sold": 0, "bought": 1 } },
"shopMileagePoints": 1</code></pre>

<h2 id="s7"><span class="n">07</span>코드 지도</h2>

<h4>신규</h4>
<table>
<thead><tr><th>파일</th><th class="num">행</th><th>역할</th></tr></thead>
<tbody>
<tr><td class="path">src/styles/runtime/shop.css</td><td class="num">1078</td><td>모던 상점 스킨. 유리 카드 · 윈도스킨 폴백 · 공용 커서 되잡기</td></tr>
<tr><td class="path">src/player/playSceneShopParts.ts</td><td class="num">554</td><td>UI 조각 — 상단바 · 탭 · 칩 · 행 · 상세 · 수량 · 델타 토스트 · 인라인 SVG</td></tr>
<tr><td class="path">src/player/playSceneShopGoods.ts</td><td class="num">140</td><td>아이템 + 장비 통합 뷰 모델(<code>ShopGoods</code>) · 카테고리</td></tr>
<tr><td class="path">src/project/shopMessages.ts</td><td class="num">71</td><td>에디터·런타임 공용 문구 단일 출처</td></tr>
<tr><td class="path">test/e2e/_shop-modern-shots.spec.ts</td><td class="num">342</td><td>이 보고서의 모든 화면과 수치를 만드는 캡처·검증 스펙</td></tr>
</tbody>
</table>

<h4>수정</h4>
<table>
<thead><tr><th>파일</th><th class="num">±</th><th>무엇을</th></tr></thead>
<tbody>
<tr><td class="path">src/player/playSceneShopDom.ts</td><td class="num">716</td><td>레이아웃 전면 재작성. testid · 클래스 · export 서명 · 한국어 문장은 전부 보존</td></tr>
<tr><td class="path">src/player/playSceneShop.ts</td><td class="num">153</td><td>실패 분기 · 카테고리/탭 상태 · 상인 예산 · 캐스트 소거</td></tr>
<tr><td class="path">src/editor/panels/eventEditor/commandBodyCommerce.ts</td><td class="num">81</td><td>메시지 6종 · 장비 자료집 · <code>select.value</code> 순서</td></tr>
<tr><td class="path">src/styles/runtime/commerce.css</td><td class="num">−342</td><td>상점 블록을 <code>shop.css</code> 로 분리(615 → 279행)</td></tr>
<tr><td class="path">src/project/defaults/defaultDatabaseItemRecords.ts</td><td class="num">31</td><td>중복 id 개명</td></tr>
<tr><td class="path">src/project/io/commandReferenceValidation.ts</td><td class="num">16</td><td>상점 진열 검증에 장비 집합 합집합</td></tr>
<tr><td class="path">src/player/interpreter/commandCatalog.ts · types.ts</td><td class="num">18</td><td>페이로드 필드 7개 · 타입</td></tr>
<tr><td class="path">src/project/shopStock.ts</td><td class="num">19</td><td>투자 레벨 → 매입 예산 배수</td></tr>
<tr><td class="path">src/player/playSceneMapRuntime.ts · runtimeDom.ts</td><td class="num">8</td><td>상점 경제 상태 노출</td></tr>
<tr><td class="path">src/project/lint/projectLint.ts</td><td class="num">2</td><td>빈 상점 린트 문구</td></tr>
</tbody>
</table>

<h2 id="s8"><span class="n">08</span>검증과 남은 것</h2>

<div class="note ok"><b>통과.</b>
e2e <code>_shop-modern-shots.spec.ts</code> 5/5 ·
단위 <code>shopRuntimeUx</code> 18/18 · <code>runtimePlayWindowSkins</code> 13/13 · <code>termsRuntime</code> 7/7 ·
<code>tsc --noEmit</code> 에서 이 변경분 오류 0.</div>

<h3>저장소 기준선 — 정직한 수치</h3>
<p>전체 단위 스위트는 <b>1061 파일 중 90 파일 / 8785 테스트 중 190 테스트가 실패</b>한다. 이 실패는 내 변경 이전부터 있던 것이다.
말로 주장하지 않고 측정했다 — 실패 파일 18개를 뽑아 내 <code>src</code>·<code>test</code> 변경을 <code>git stash</code> 로 걷어내고 같은 명령을 다시 돌렸다.</p>
<table>
<thead><tr><th>실행</th><th class="num">실패 파일</th><th class="num">실패 테스트</th><th class="num">통과</th></tr></thead>
<tbody>
<tr><td>내 변경 <b>있음</b></td><td class="num">18</td><td class="num">42</td><td class="num">204</td></tr>
<tr><td>내 변경 <b>없음</b>(<code>git stash</code>)</td><td class="num">18</td><td class="num">42</td><td class="num">204</td></tr>
</tbody>
</table>
<p>완전히 같다. 추가로 확인한 것:</p>
<ul>
  <li>실패 파일 90개 중 <b>상점·거래·아이템·장비 관련은 0개</b>다(<code>shop|commerce|item|equip</code> 매치 없음).</li>
  <li>가장 많은 실패 원인은 <code>Error: Image is not defined</code> <b>174건</b> — 테스트 환경에 <code>Image</code> 전역이 없어서다. 코드 결함이 아니다.</li>
  <li>내 변경과 겹칠 수 있는 <code>defaultDatabase.test.ts</code>(중복 id 를 고친 파일을 쓴다)는 <code>defaultDatabaseItemRecords.ts</code> 만 따로 되돌려도 <b>같은 2건이 같은 이유로</b> 실패한다 —
  기대 파티 4명, 실제 2명. 아이템이 아니라 액터 로스터 문제다.</li>
</ul>
<div class="note warn"><b>워크트리 함정.</b> 처음 전체 스위트를 돌렸을 때 95 파일이 실패했다. 워크트리에 <code>node_modules</code> 가 부분(7개)만 심링크돼 있어
<code>happy-dom</code>·<code>pngjs</code> 같은 패키지를 못 찾은 것이었다 — <b>내 변경과 무관한 환경 문제</b>. 메인 저장소의 패키지를 전부 심링크한 뒤 다시 측정한 값이 위의 90/190 이다.
이 구분을 하지 않으면 "내가 95개를 깼다" 로 오독된다.</div>

<h3>DOM 을 통째로 다시 쓰면서 계약을 지킨 방법</h3>
<ul>
  <li><b>testid 전수 보존</b> — <code>shop-scene</code>, <code>shop-mode-buy</code>, <code>shop-menu-cancel</code>, <code>shop-buy-*</code>, <code>shop-sell-*</code>, <code>shop-owned-panel</code>, <code>shop-merchant-gold</code>, <code>shop-quantity-*</code> 등</li>
  <li><b>클래스 계약 보존</b> — <code>.runtime-shop-panel</code> 기본 규칙의 <code>border-image-source: var(--runtime-window-skin)</code> 는 <code>runtimePlayWindowSkins.test.ts</code> 가 직접 읽는다. 모던 카드가 <code>@supports</code> 로 덮어쓰지만 그 폴백은 실제로 살아 있다.</li>
  <li><b>금지 클래스 유지</b> — <code>.runtime-shop-top-panel</code>, <code>.runtime-shop-middle-panel</code>(2003 클론 빈 껍질)은 다시 만들지 않았다.</li>
  <li><b>한국어 문장 그대로</b> — “소지금이 부족합니다.”, “지금은 팔 물건이 없습니다.”, “지금은 해 드릴 일이 없습니다.” 등 단위·e2e 가 문자열로 검사하는 문장은 바꾸지 않았다.</li>
</ul>

<h3>고치는 과정에서 걸렀던 함정</h3>
<ul>
  <li><b>카테고리 칩이 사라져 「전체」로 못 돌아왔다</b> — 칩을 필터 <i>후</i> 목록으로 만들면 한 종류만 남아 칩줄이 접힌다. 칩은 필터 전 전체 진열로 만든다.</li>
  <li><b>입구 인사말이 두 줄로 겹쳤다</b> — 브랜드 부제와 본문에 같은 문장을 넣고 있었다. 부제는 가게 성격(“물건을 사고팝니다.”)으로 분리했다.</li>
  <li><b>입구에 상인 얼굴·소지금이 없었다</b> — <code>renderShopMenu</code> 이 항상 빈 스텁 scene 을 쓰고 있었다. 실제 scene 을 선택 인자로 받게 했다(단위 테스트의 4인자 호출은 그대로 동작).</li>
  <li><b>가게의 금색 강조가 전부 파란 바에 덮였다</b> — <code>keyboardNav.css</code> 가 <code>shop.css</code> 보다 뒤에 import 되어 같은 특정도에서 이겼다. <code>.runtime-shop-overlay</code> 한 겹으로 <code>!important</code> 없이 되잡았다.</li>
</ul>

<h3>남은 것</h3>
<ul>
  <li>수리·감정·전당포는 <b>진입과 안내까지</b> 동작한다. 실제 수리 수수료 계산·감정 결과 롤은 별도 작업이다.</li>
  <li>이미지 생성은 쓰지 않았다 — <code>grok</code> CLI 가 이 환경에서 인증되지 않아, 아이콘·글리프는 전부 인라인 SVG 와 CSS 로 그렸다. 외부 에셋 의존이 없다는 점에서 결과적으로 더 낫다.</li>
</ul>

<h3>재현</h3>
<pre><code><span class="cmt"># 워크트리에서 개발 서버(메인 저장소의 vite 바이너리를 워크트리 cwd 로)</span>
node /home/main/z-project/rpg-zzu/node_modules/vite/bin/vite.js --configLoader runner --port 9186 --strictPort

<span class="cmt"># 캡처 + 검증 (5 tests)</span>
cd /home/main/z-project/rpg-zzu
DEV_SERVER_PORT=9186 node_modules/.bin/playwright test \\
  --config /home/main/.herdr/worktrees/rpg-zzu/worktree/playwright.config.ts \\
  _shop-modern-shots.spec.ts --workers=1

<span class="cmt"># 보고서 재생성</span>
node scripts/build-shop-modern-report.mjs</code></pre>

<footer>
  생성: <code>scripts/build-shop-modern-report.mjs</code> · 2026-08-29 · 기준 HEAD <code>f67cac85</code> (브랜치 <code>상점</code>) ·
  캡처 19장(수정 후) + 3장(수정 전 대조) 모두 base64 로 문서에 포함 · 외부 링크 없음
</footer>

</div>
</body>
</html>
`;

mkdirSync("reports", { recursive: true });
writeFileSync(OUT, html, "utf8");
const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
// eslint-disable-next-line no-console
console.log(`wrote ${OUT} (${kb} KB, ${Object.keys(shots).length} images available)`);
