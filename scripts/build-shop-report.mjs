/** 보고서 생성기 — output/evidence/shop-report/*.png 를 base64 로 심어 단일 HTML 을 만든다. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SHOT_DIR = "output/evidence/shop-report";
const OUT = "reports/shop-authoring-and-runtime-2026-08-29.html";

const shots = Object.fromEntries(
  readdirSync(SHOT_DIR)
    .filter((f) => f.endsWith(".png"))
    .map((f) => [f.replace(/\.png$/, ""), readFileSync(join(SHOT_DIR, f)).toString("base64")])
);

const img = (name, alt) => {
  const data = shots[name];
  if (!data) throw new Error(`missing shot: ${name}`);
  return `<img src="data:image/png;base64,${data}" alt="${alt}" loading="lazy">`;
};

const fig = (name, title, caption, cls = "") =>
  `<figure class="shot ${cls}">${img(name, title)}<figcaption><b>${title}</b>${caption ? ` — ${caption}` : ""}</figcaption></figure>`;

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>상점 저작 · 런타임 해부 — rpg-zzu</title>
<style>
  :root{
    --ink:#171412; --ink-2:#4a423c; --ink-3:#7c7169;
    --paper:#faf8f5; --card:#fff; --line:#e6e0d8;
    --brand:#8a5a2b; --brand-soft:#f4ece2; --brand-line:#dcc6a8;
    --code-bg:#1e1b18; --code-ink:#e8e2d8;
    --hi:#b4451f; --mid:#a4761b; --lo:#6b7a52;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR","Malgun Gothic",sans-serif;}
  .wrap{max-width:1180px;margin:0 auto;padding:0 28px 96px}
  header.hero{background:linear-gradient(160deg,#2b2018 0%,#513a24 45%,#7d5731 100%);color:#f6efe6;padding:52px 0 44px;margin-bottom:40px}
  header.hero .wrap{padding-bottom:0}
  header.hero h1{margin:0 0 10px;font-size:34px;letter-spacing:-.4px;line-height:1.3}
  header.hero p{margin:0;color:#e2d3c0;max-width:74ch}
  .meta{margin-top:22px;display:flex;flex-wrap:wrap;gap:8px}
  .meta span{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
    border-radius:999px;padding:4px 12px;font-size:12.5px;color:#f0e5d8}
  h2{margin:56px 0 6px;font-size:24px;letter-spacing:-.3px;padding-bottom:10px;border-bottom:2px solid var(--brand-line)}
  h2 .n{color:var(--brand);font-variant-numeric:tabular-nums;margin-right:10px;font-size:20px}
  h3{margin:34px 0 10px;font-size:17.5px;color:var(--ink)}
  h4{margin:22px 0 6px;font-size:15px;color:var(--ink-2);text-transform:none}
  p{margin:10px 0}
  .lede{font-size:17px;color:var(--ink-2)}
  ul,ol{margin:10px 0;padding-left:22px}
  li{margin:5px 0}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;
    background:var(--brand-soft);border:1px solid var(--brand-line);border-radius:4px;padding:1px 5px}
  pre{background:var(--code-bg);color:var(--code-ink);border-radius:10px;padding:16px 18px;overflow-x:auto;
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.6;margin:14px 0}
  pre code{background:none;border:0;padding:0;color:inherit;font-size:13px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px;margin:18px 0}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
  .card h5{margin:0 0 6px;font-size:14px;color:var(--brand);letter-spacing:.2px}
  .card p{margin:0;font-size:14px;color:var(--ink-2)}
  .card .big{font-size:26px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1.2}
  figure.shot{margin:22px 0;background:var(--card);border:1px solid var(--line);border-radius:12px;
    padding:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  figure.shot img{display:block;width:100%;height:auto;border-radius:7px;border:1px solid var(--line);background:#f3f0eb}
  figure.shot.dark img{background:#0a0a0a}
  figcaption{margin-top:10px;font-size:13.5px;color:var(--ink-3);line-height:1.6}
  figcaption b{color:var(--ink)}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .grid2 figure.shot{margin:0}
  @media (max-width:860px){.grid2{grid-template-columns:1fr}}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;background:var(--card);
    border:1px solid var(--line);border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:10px 13px;border-bottom:1px solid var(--line);vertical-align:top}
  th{background:#f3eee7;font-size:12.5px;letter-spacing:.3px;color:var(--ink-2);font-weight:700}
  tr:last-child td{border-bottom:0}
  td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
  .chip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:700;color:#fff;white-space:nowrap}
  .chip.hi{background:var(--hi)} .chip.mid{background:var(--mid)} .chip.lo{background:var(--lo)}
  .note{background:var(--brand-soft);border:1px solid var(--brand-line);border-left:4px solid var(--brand);
    border-radius:8px;padding:13px 16px;margin:16px 0;font-size:14.5px}
  .note b{color:var(--brand)}
  .ok{border-left-color:var(--lo);background:#f3f6ee;border-color:#d7e0c6}
  .ok b{color:#4c5c34}
  .path{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:var(--ink-3)}
  .flow{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin:18px 0;overflow-x:auto}
  .toc{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 22px;margin:8px 0 0}
  .toc ol{margin:0;padding-left:20px;columns:2;column-gap:34px}
  @media (max-width:700px){.toc ol{columns:1}}
  .toc a{color:var(--ink-2);text-decoration:none;border-bottom:1px solid transparent}
  .toc a:hover{color:var(--brand);border-bottom-color:var(--brand-line)}
  footer{margin-top:64px;padding-top:22px;border-top:1px solid var(--line);color:var(--ink-3);font-size:13px}
</style>
</head>
<body>

<header class="hero">
  <div class="wrap">
    <h1>이 에디터로 상점을 만들면 무엇이 만들어지고, 런타임에서 어떻게 보이나</h1>
    <p class="lede">상점은 별도 화면이 아니라 <b>이벤트 명령 한 줄</b>이다. 에디터는 전체화면 편집창 하나로 진열·재고·옵션을 받고,
    런타임은 그 명령을 만나면 인터프리터를 멈추고 창 6개짜리 오버레이를 띄운다. 아래 화면은 모두 이 워크트리의 현재 코드를
    실제로 띄워서 찍은 것이다.</p>
    <div class="meta">
      <span>2026-08-29</span>
      <span>HEAD f67cac85</span>
      <span>Playwright / Chromium 1280×800 · 1600×1000</span>
      <span>본문 캡처 13장 · 전부 실측</span>
    </div>
  </div>
</header>

<div class="wrap">

<nav class="toc">
  <ol>
    <li><a href="#s1">한눈에</a></li>
    <li><a href="#s2">데이터 모델 — 명령 한 줄</a></li>
    <li><a href="#s3">에디터: 만드는 순서</a></li>
    <li><a href="#s4">저장되는 JSON</a></li>
    <li><a href="#s5">런타임 파이프라인</a></li>
    <li><a href="#s6">런타임 화면 해부</a></li>
    <li><a href="#s7">거래 규칙과 실측 수치</a></li>
    <li><a href="#s8">확인된 문제 7건</a></li>
    <li><a href="#s9">재현 방법</a></li>
  </ol>
</nav>

<h2 id="s1"><span class="n">01</span>한눈에</h2>
<div class="cards">
  <div class="card"><h5>저작 단위</h5><div class="big">명령 1개</div><p><code>kind:&nbsp;"shop"</code> — 맵 이벤트·공용 이벤트 어디든 들어간다</p></div>
  <div class="card"><h5>편집창</h5><div class="big">전체화면</div><p>상점만 예외. 일반 명령은 wide 창</p></div>
  <div class="card"><h5>진열 원본</h5><div class="big">자료집 179개</div><p><code>database.items</code> 만. 장비 탭은 못 담는다</p></div>
  <div class="card"><h5>런타임 창</h5><div class="big">6장</div><p>도움말·목록·파티·보유·소지금·프롬프트</p></div>
  <div class="card"><h5>동작하는 옵션</h5><div class="big">7 / 22</div><p>필드 22개 중 런타임이 실제로 읽는 것</p></div>
  <div class="card"><h5>확인된 결함</h5><div class="big">7건</div><p>높음 2 · 중간 2 · 낮음 3</p></div>
</div>

<div class="note ok"><b>핵심 결론</b> — 기본 상점(구매·판매·수량·상인 소지금·거래 후 분기)은 RPG 만들기 감각대로 제대로 돈다.
구매해도 창이 닫히지 않고, 판매 목록은 소지품 목록이며, 살 수 없는 줄은 흐리게 표시되고 커서는 계속 얹힌다.
반면 편집창 오른쪽 <b>「추가 서비스」 카드(서비스·투자 Lv·마일리지)와 「빈 상점/거래 없음일 때 분기」는 런타임에 전달되지 않는다</b> — 눌러도 게임이 달라지지 않는다.</div>

<h2 id="s2"><span class="n">02</span>데이터 모델 — 명령 한 줄</h2>
<p>상점은 <code>Command</code> 유니온의 한 항목이다. <span class="path">src/project/types/events.ts:330</span></p>
<pre><code>{
  kind: "shop";
  itemIds: ItemId[];            // 진열 목록. 순서까지 이게 정본이다
  stock?: ShopStockEntry[];     // 계절/가격 오버라이드가 있을 때만 생긴다
  shopType?: "normal" | "buyOnly" | "sellOnly";
  messageType?: "welcome" | "business" | "direct" | "festival" | "closingSale" | "vip";
  quantityMode?: "single" | "select";
  merchantGold?: number;        // 생략 시 100G
  branchOnTransaction?: boolean;        transactionBranch?: Command[];
  branchOnFailedTransaction?: boolean;  failedTransactionBranch?: Command[];
  // ↓ 아래 12개는 타입에만 있고 런타임 소비자가 없다
  shopServiceKind?; restockPolicy?; loyaltyTierId?; economy?; buyback?; cartLines?;
  consignments?; donation?; pawnTickets?; blackMarketFlag?; festivalFlag?;
  investmentLevel?; travelingRouteId?; appraisalUnidentifiedPool?; mileageRate?;
}</code></pre>

<p><b>이중기록을 피하는 규약이 하나 있다.</b> 진열은 <code>itemIds</code> 가 유일한 진실원이고, <code>stock</code> 은
계절 한정이나 가격 오버라이드를 넣은 아이템에만 붙는다. 편집창은 담기/빼기/순서변경 때마다
<code>stock</code> 을 <code>itemIds</code> 순서로 다시 정렬하고, 남는 항목이 없으면 <code>stock</code> 을 지운다.
<span class="path">commandBodyCommerce.ts:854-866</span></p>

<h2 id="s3"><span class="n">03</span>에디터: 만드는 순서</h2>
<p>맵에 이벤트를 놓고 → 명령 선택기에서 「상점」 → 편집창이 <b>전체화면</b>으로 열린다.
진열·재고·옵션이 한 화면에 다 있어야 하는 명령이라 이것만 예외 처리돼 있다
(<span class="path">test/e2e/shop-command-fullscreen.spec.ts</span> 가 이 계약을 지킨다).</p>

${fig("editor-01-shop-dialog-default", "명령을 추가한 직후", "빈 상점으로 시작하지 않는다. 잡화점 프리셋(회복약·마력약·해독초)이 이미 깔려 있고 왼쪽 위 배지가 「3개」로 상태를 알린다. 「시즌 씨앗」 프리셋은 이 프로젝트 DB에 씨앗 아이템이 없어 비활성이다")}

<h3>세 열의 역할</h3>
<ul>
  <li><b>왼쪽 · 판매 목록</b> — 지금 진열된 것. 아이콘 · 이름 · 가격 · 종류 · 설명이 한 줄에 다 나온다. 더블클릭으로 뺀다.</li>
  <li><b>가운데 · 자료집에서 더 담기</b> — <code>database.items</code> 179행 전체. 체크박스로 토글, 행 클릭으로 「담기」 대상 지정, 더블클릭으로 즉시 토글.</li>
  <li><b>오른쪽 · 상점 설정</b> — 종류·수량·메시지·상인 소지금·분기.</li>
</ul>

<div class="note"><b>구현 메모</b> — 자료집 접이식은 <code>&lt;details&gt;</code> 를 쓰지 않는다. Chromium 이 <code>::details-content</code>
익명 블록을 끼워 넣어 자식의 <code>flex:1 / overflow:auto</code> 가 죽고, 실측에서 접이식은 279px 인데 내용이 10110px 로 자라
179행이 잘리고 휠이 전혀 안 먹었다. 지금은 <code>div + aria-expanded</code> 로 같은 접이식을 만든다.
<span class="path">commandBodyCommerce.ts:1044-1063</span></div>

<div class="grid2">
${fig("editor-02-catalog-search", "종류 필터 + 이름·설명 검색", "「검」 한 글자로 179행을 좁힌다. 이름·설명·id·종류 라벨을 모두 훑는다")}
${fig("editor-03-sale-list", "담기 · 빼기 · 순서 이동", "자료집 행을 고르고 「담기」를 누르면 왼쪽 판매 목록으로 들어온다. ▲▼ 는 런타임 진열 순서를 바꾼다")}
</div>

${fig("editor-04-item-detail", "선택한 아이템 상세 · 계절 재고", "접어서 시작하는 부차 패널. 봄·여름·가을·겨울 중 고른 계절에만 진열되고, 가격 오버라이드를 비우면 DB 가격을 쓴다. 오버라이드 하한은 floor(DB가격/2) — 되팔기 값보다 싸지면 돈 복사가 되기 때문이다")}

<div class="grid2">
${fig("editor-05-options-rail", "상점 설정 레일", "종류 · 구매 수량 · 메시지 유형(+미리보기) · 상인 소지금 · 거래 후 분기 · 재고 요약 · 추가 서비스")}
${fig("editor-08-empty-warning", "빈 상점 경고와 분기 줄", "진열을 다 빼면 배지가 「빈 상점」으로 바뀌고 장바구니 배너가 뜬다. 분기 체크를 켜면 아래에 명령 추가 줄이 생긴다")}
</div>

<h3>설정 항목이 실제로 하는 일</h3>
<table>
<tr><th style="width:130px">항목</th><th style="width:180px">저장 필드</th><th>런타임 효과</th></tr>
<tr><td>상점 종류</td><td><code>shopType</code></td><td>입구 메뉴 구성. <code>normal</code>=구입·판매·취소, <code>buyOnly</code>=구입·취소, <code>sellOnly</code>=판매·취소. 낡은 <code>allowSell</code> 은 고르는 순간 떼어 낸다(둘이 남으면 lint 경고)</td></tr>
<tr><td>구매 수량</td><td><code>quantityMode</code></td><td><code>select</code> 면 프롬프트 줄에 수량 입력칸과 합계가 붙고 ←/→ 로 1~99 조절</td></tr>
<tr><td>메시지 유형</td><td><code>messageType</code></td><td>입구 인사말과 목록 머리글 문구를 고른다</td></tr>
<tr><td>상인 소지금</td><td><code>merchantGold</code></td><td>상인이 플레이어 물품을 살 때 쓰는 예산. 비우면 100G. 방문마다 초기화되고 플레이어 구매금만큼 늘어난다</td></tr>
<tr><td>거래 후 분기</td><td><code>branchOnTransaction</code></td><td>한 번이라도 사고팔았으면 창을 닫은 뒤 분기 명령을 실행</td></tr>
<tr><td>빈 상점/거래 없음 분기</td><td><code>branchOnFailedTransaction</code></td><td><span class="chip hi">동작 안 함</span> 8절 F-1 참조</td></tr>
<tr><td>추가 서비스 · 투자 Lv · 마일리지</td><td><code>shopServiceKind</code> 등</td><td><span class="chip hi">동작 안 함</span> 8절 F-2 참조</td></tr>
</table>

<h3>저작 중 걸리는 검사</h3>
<p><code>projectLint</code> 가 상점만 7가지를 본다. <span class="path">src/project/lint/projectLint.ts:671-701</span></p>
<ul>
  <li><code>shop.empty</code> — 진열이 비었다</li>
  <li><code>shop.stock-orphan</code> — <code>stock</code> 에는 있는데 <code>itemIds</code> 에 없다 (편집창 배지도 「유령 재고 N」으로 경고한다)</li>
  <li><code>shop.stock-duplicate</code> · <code>shop.allowSell-mismatch</code> · <code>shop.failed-branch-empty</code></li>
  <li><code>shop.cart.overflow</code> · <code>shop.buyback.overflow</code> · <code>shop.consignment.overflow</code> · <code>shop.investment.range</code></li>
</ul>

<h2 id="s4"><span class="n">04</span>저장되는 JSON</h2>
<p>위 화면에서 잡화점 프리셋 + 상급 회복약을 담고, 구매/판매 · 수량 선택 · 상인 300G · 분기 둘을 켠 결과는 이 한 덩어리다.
프로젝트 파일에 이벤트 명령 배열의 한 원소로 들어간다.</p>
<pre><code>{
  "kind": "shop",
  "itemIds": ["item_potion", "item_ether", "item_antidote", "item_hi_potion"],
  "shopType": "normal",
  "messageType": "welcome",
  "quantityMode": "select",
  "merchantGold": 300,
  "branchOnTransaction": true,
  "transactionBranch": [ { "kind": "text", "body": "…" } ],
  "branchOnFailedTransaction": true,
  "failedTransactionBranch": [ { "kind": "text", "body": "…" } ]
}</code></pre>
<p>명령 목록에서는 <code>상점: 4개 · 300G</code> 로 한 줄 요약되고
(<span class="path">commandSummary.ts:322</span>), 「미리보기」를 누르면
<code>상점 · 4개 · 구매/판매</code> 짜리 축소 창이 뜬다 (<span class="path">commandPreview.ts:753</span>).</p>

<h2 id="s5"><span class="n">05</span>런타임 파이프라인</h2>
<div class="flow">
<svg viewBox="0 0 1080 232" width="1080" style="max-width:100%;height:auto" role="img" aria-label="상점 명령 실행 흐름">
  <defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0 0 L10 5 L0 10 z" fill="#8a5a2b"/>
    </marker>
    <style>
      .bx{fill:#fff;stroke:#dcc6a8;stroke-width:1.5;rx:9}
      .bxs{fill:#f4ece2;stroke:#dcc6a8;stroke-width:1.5}
      .t{font:600 13px -apple-system,"Noto Sans KR",sans-serif;fill:#171412}
      .s{font:11.5px ui-monospace,Menlo,monospace;fill:#7c7169}
      .ln{stroke:#8a5a2b;stroke-width:1.6;fill:none;marker-end:url(#a)}
      .lb{font:11.5px -apple-system,"Noto Sans KR",sans-serif;fill:#8a5a2b}
    </style>
  </defs>
  <rect class="bx" x="4" y="26" width="176" height="62" rx="9"/>
  <text class="t" x="20" y="52">이벤트 트리거</text><text class="s" x="20" y="72">action / 말 걸기</text>
  <line class="ln" x1="184" y1="57" x2="228" y2="57"/>
  <rect class="bx" x="232" y="14" width="216" height="86" rx="9"/>
  <text class="t" x="248" y="40">인터프리터가 멈춘다</text>
  <text class="s" x="248" y="60">pause("shop", step)</text>
  <text class="s" x="248" y="78">+ resolveShopStock()</text>
  <line class="ln" x1="452" y1="57" x2="496" y2="57"/>
  <rect class="bx" x="500" y="14" width="216" height="86" rx="9"/>
  <text class="t" x="516" y="40">playShop()</text>
  <text class="s" x="516" y="60">view: menu | items</text>
  <text class="s" x="516" y="78">mode: buy | sell</text>
  <line class="ln" x1="720" y1="57" x2="764" y2="57"/>
  <rect class="bx" x="768" y="14" width="212" height="86" rx="9"/>
  <text class="t" x="784" y="40">오버레이 6창</text>
  <text class="s" x="784" y="60">.play-viewport 에 마운트</text>
  <text class="s" x="784" y="78">attachCursorMenu</text>
  <path class="ln" d="M874 104 L874 140 L608 140"/>
  <text class="lb" x="892" y="126">거래 · 커서 이동은 제자리 갱신</text>
  <path class="ln" d="M608 104 L608 172 L392 172"/>
  <text class="lb" x="620" y="192">닫으면 resolve(true | false | "failed")</text>
  <rect class="bxs" x="4" y="146" width="380" height="54" rx="9"/>
  <text class="t" x="20" y="168">advanceResume() 가 분기를 고른다</text>
  <text class="s" x="20" y="188">true → transactionBranch · "failed" → failedTransactionBranch</text>
</svg>
</div>

<ol>
  <li><b>가격 확정은 명령을 만나는 순간</b> — <code>resolveShopStock()</code> 이 계절 재고를 걸러내고, 상인 이벤트에
  <code>socialShop</code> 이 있고 친밀도가 기준 이상이면 구매가에 배수를 적용한다. 이때도 <code>sellPrice</code> 아래로는
  안 내려간다(할인 하한 0.5, 그리고 <code>floor(정가/2)</code> 하한). <span class="path">src/project/shopStock.ts:46-96</span></li>
  <li><b>오버레이는 <code>.play-viewport</code> 에 붙는다</b> — <code>.play-stage</code> 는 <code>transform: scale</code> 이라
  절대배치 자식이 보이는 영역 밖으로 튄다. 스케일 밖 레이어에 올려 게임 화면 기준으로 배치한다.
  <span class="path">playSceneShop.ts:338-346</span></li>
  <li><b>재렌더는 뷰 전환에서만</b> — 거래 결과·커서 이동·소지금 변화는 해당 노드만 제자리 갱신한다.
  전체 재렌더는 커서와 포커스를 날리고 <code>aria-live</code> 영역이 새로 생겨 낭독이 끊긴다.</li>
</ol>

<h2 id="s6"><span class="n">06</span>런타임 화면 해부</h2>
<p>입구는 인사말 + 선택 세 개다. 2003 클론 시절의 빈 상단/중단 패널 두 장은 덜어냈다.</p>

${fig("runtime-01b-menu-viewport", "입구 메뉴", "「어서 오세요.」 + 구입 / 판매 / 취소. ▶ 가 커서다. 창 표면은 자료집 System 윈도스킨 변수로 그린다 — 예전처럼 파랑 고정이 아니다. (맵이 2×2 픽스처라 주변이 검다. 왼쪽 아래 「빈 손」은 농사 HUD로 상점과 무관하다)", "dark")}

${fig("runtime-02-buy-list", "구입 목록 — 6창 배치", "위=도움말 창(커서가 얹힌 물건의 설명), 왼쪽=진열 목록, 오른쪽 위부터 파티 얼굴·보유 패널·소지금 패널, 아래=프롬프트 줄(상태 문구 + 수량 + 합계 + 취소). 각 줄은 아이콘 · 이름 · x보유수 · 가격+단위", "dark")}

<h3>줄 하나가 담는 정보</h3>
<div class="cards">
  <div class="card"><h5>아이콘</h5><p>자료집이 이미 저작해 둔 <code>iconResourceId</code> → <code>imageResourceId</code> 순. 없으면 이름 첫 글자 칩</p></div>
  <div class="card"><h5>x보유수</h5><p>파티가 지금 몇 개 가졌는지. 거래 후 그 줄만 갱신</p></div>
  <div class="card"><h5>가격 + 단위</h5><p>용어집의 통화 단위를 붙인다. 숫자만 있으면 단위를 알 수 없다</p></div>
  <div class="card"><h5>살 수 있는지</h5><p>못 사면 흐리게 + 취소선 + <code>aria-label</code> 에 이유. 커서는 그래도 얹힌다</p></div>
</div>

${fig("runtime-03-unaffordable", "소지금이 부족할 때", "검술 교본(320G)에 커서를 얹으면 도움말 창이 그 설명으로 바뀌고 보유 패널도 따라온다. 결정을 누르면 창이 닫히는 대신 프롬프트 줄만 「소지금이 부족합니다.」로 바뀐다 — 이 줄은 aria-live 영역이라 낭독된다. 귀환 주문서·검술 교본은 흐리게 + 취소선", "dark")}

<div class="note"><b>왜 못 사는 줄을 <code>disabled</code> 로 막지 않나</b> — 커서가 못 얹히면 비싼 물건의 설명조차 볼 수 없다.
RPG 만들기도 커서는 얹히게 두고 결정만 거절한다. <span class="path">playSceneShopDom.ts:276-296</span></div>

${fig("runtime-04-after-buy", "회복약 2개를 산 직후", "① 창이 닫히지 않는다 — 확인 문구 「회복약 구매 — -24G」를 읽고 계속 살 수 있다. ② 소지금 200→176G, 상인 300→324G(플레이어 구매금이 상인 예산으로 들어간다). ③ 보유가 x2 로, 오른쪽 보유 패널도 2 로. ④ 상급 회복약(180G)이 새로 흐려졌다 — 176G로는 못 산다", "dark")}

<div class="grid2">
${fig("runtime-05-sell-list", "판매 목록 = 소지품 목록", "진열품을 그대로 보여주면 보유 0인 줄을 눌러 실패만 한다. 그래서 판매는 「지금 가진 것」을 나열하고, 진열품이면 상점이 매긴 가격으로 되팔기 값을 낸다(회복약 12G → 6G). 귀환 주문서가 두 줄인 것은 결함이다 — 8절 F-3", "dark")}
${fig("runtime-06-after-sell", "해독초 1개를 되판 직후", "「해독초 판매 — +4G」. 다 팔아 0개가 된 줄은 목록에서 빠지고 커서를 다시 잡는다", "dark")}
</div>

${fig("runtime-07-empty-notice", "빈 상점", "진열이 비어도 조용히 지나가지 않는다. 「지금은 팔 물건이 없습니다.」 안내와 취소 하나를 띄우고, 읽고 닫는 것까지가 한 흐름이다", "dark")}

<h3>조작</h3>
<table>
<tr><th style="width:170px">키</th><th>입구 메뉴</th><th>아이템 목록</th></tr>
<tr><td class="num">↑ ↓ / ← →</td><td>선택 이동 (1D)</td><td>↑↓ 줄 이동</td></tr>
<tr><td class="num">← →</td><td>—</td><td>수량 선택 모드일 때 수량 ±1 (1~99)</td></tr>
<tr><td class="num">Z / Enter</td><td>결정</td><td>결정 — 거래 시도</td></tr>
<tr><td class="num">X / Esc</td><td>취소 → 상점 종료</td><td>취소 → 입구 메뉴로</td></tr>
</table>
<p>보조기술 쪽도 챙겨져 있다. 오버레이는 <code>role="dialog" aria-modal="true"</code>, 프롬프트 줄은
<code>role="status" aria-live="polite"</code>, 각 줄은 <code>aria-label</code> 에 「이름 · 가격 · 보유 N개 (· 부족 이유)」를 싣는다.</p>

<h2 id="s7"><span class="n">07</span>거래 규칙과 실측 수치</h2>
<h3>규칙</h3>
<ul>
  <li><b>되팔기 값</b> = <code>floor(정가 / 2)</code>, 최소 1G. 정가 0이면 0 유지(에디터에서 막는 게 정답).</li>
  <li><b>상인 소지금</b> — 방문마다 명령값(기본 100G)으로 초기화. 플레이어 구매금만큼 늘고, 매입할 때 줄어든다. 부족하면 「상인의 돈이 부족합니다.」</li>
  <li><b>원자성</b> — 아이템 증감이 실패하면 골드를 건드리지 않는다. 가방이 꽉 차면 「가방이 꽉 찼습니다.」</li>
  <li><b>상한 방어</b> — 골드·거래횟수·마일리지가 <code>GOLD_MAX</code> 를 넘거나 값이 오염됐으면 거래를 거절한다. 세이브 오염으로 경제가 터지는 걸 막는 경로다.</li>
</ul>

<h3>실측 (상인 300G, 회복약 12G, 해독초 8G, 수량 선택 모드)</h3>
<table>
<tr><th>단계</th><th class="num">소지금</th><th class="num">상인</th><th>인벤토리</th><th>화면</th></tr>
<tr><td>진입</td><td class="num">200G</td><td class="num">300G</td><td>해독초 3, 귀환 주문서 1</td><td>「무엇을 구매하시겠습니까?」</td></tr>
<tr><td>검술 교본 320G 시도</td><td class="num">200G</td><td class="num">300G</td><td>변화 없음</td><td>「소지금이 부족합니다.」 · 창 유지</td></tr>
<tr><td>회복약 ×2 구매</td><td class="num">176G</td><td class="num">324G</td><td>+ 회복약 2</td><td>「회복약 구매 — -24G」 · 창 유지</td></tr>
<tr><td>해독초 ×1 되팔기</td><td class="num">180G</td><td class="num">320G</td><td>해독초 3 → 2</td><td>「해독초 판매 — +4G」</td></tr>
</table>
<p class="path">런타임 상태 JSON 으로 검증: gold 180, inventory { item_antidote: 2, item_potion: 2, item_warp_scroll: 1 }</p>

<h2 id="s8"><span class="n">08</span>확인된 문제 7건</h2>

<h3><span class="chip hi">높음</span> F-1 · 「빈 상점/거래 없음일 때 분기」가 실행되지 않는다</h3>
<p>편집창에서 체크하고 분기에 명령을 넣어도 런타임은 그 분기를 타지 않는다. 실측으로 확인했다 —
빈 상점 + <code>branchOnFailedTransaction: true</code> + 분기에 마커 문장을 넣고 돌렸더니 안내창을 닫은 뒤 마커가 나오지 않았다.</p>
<p><b>원인</b>: <span class="path">interpreter/commandCatalog.ts:529</span> 의 <code>pause("shop", …)</code> 페이로드가
<code>branchOnFailedTransaction</code> 을 넘기지 않는다 → <span class="path">playSceneShop.ts:41</span> 의
<code>failedResult()</code> 가 항상 <code>false</code> 를 돌려준다 → <span class="path">interpreter/resume.ts:36-42</span> 의
실패 분기 코드는 도달 불가능한 죽은 코드다. <code>StepResult</code> 타입에는 필드가 선언돼 있어서 타입 검사로는 안 잡힌다.</p>

<h3><span class="chip hi">높음</span> F-2 · 「추가 서비스」 카드 전체가 무동작</h3>
<p>서비스(수리·감정·전당포) · 투자 Lv · 마일리지 — 세 컨트롤 다 저장은 되지만 게임이 달라지지 않는다.</p>
<table>
<tr><th style="width:190px">필드</th><th>상태</th></tr>
<tr><td><code>shopServiceKind</code></td><td>런타임이 <code>step</code> 에서 읽지만 <code>pause</code> 가 안 넘긴다. 실측: <code>appraisal</code> + 빈 감정 풀 → 「해 드릴 일이 없습니다」 대신 평범한 상점 메뉴가 떴다</td></tr>
<tr><td><code>mileageRate</code></td><td>같은 이유로 미전달. 실측: 0.1 로 두고 12G 구매 → <code>shopMileagePoints</code> 가 <code>null</code>(적립 0)</td></tr>
<tr><td><code>loyaltyTierId</code></td><td>미전달 → 누적 지출이 항상 <code>global</code> 키로만 쌓여 티어 구분이 안 된다</td></tr>
<tr><td><code>investmentLevel</code></td><td>런타임 소비자가 아예 없다. lint 범위 검사(0~5)만 존재</td></tr>
</table>
<p><code>restockPolicy</code> · <code>economy</code> · <code>buyback</code> · <code>cartLines</code> · <code>consignments</code> ·
<code>donation</code> · <code>pawnTickets</code> · <code>blackMarketFlag</code> · <code>festivalFlag</code> ·
<code>travelingRouteId</code> 도 같다 — 타입과 <code>shopStock.ts</code> 의 순수 함수(<code>applyHaggleDiscount</code>,
<code>applyDynamicMarkup</code>, <code>shouldRestock</code> …)는 있는데 이들을 호출하는 런타임 경로가 없다.</p>

<h3><span class="chip mid">중간</span> F-3 · 판매 목록에 같은 아이템이 두 줄</h3>
<p>위 <b>판매 목록</b> 캡처에서 「귀환 주문서 ×1 125G」가 두 번 나온다. 상점 코드 문제가 아니라 기본 자료집의 중복 id 다.</p>
<pre><code>items total: 179  unique: 177
item_warp_scroll     [{"name":"귀환 주문서","price":250}, {"name":"warp scroll","price":20}]
item_traveler_badge  [{"name":"여행자 표식","price":0},   {"name":"traveler badge","price":20}]</code></pre>
<p><span class="path">src/project/defaults/defaultDatabaseItemRecords.ts</span> 에 큐레이션된 레코드와
아이콘에서 자동 생성된 채움 레코드(<code>"…-… 기본 아이템입니다."</code>, <code>occasion:"never"</code>, 20G)가 같은 id 로 둘 다 들어 있다.
구매 경로는 <code>find()</code> 라 첫 레코드만 쓰지만, 판매 목록은 <code>database.items</code> 전체를 훑어
(<span class="path">playSceneShop.ts:199-205</span>) 두 레코드가 각각 한 줄이 된다. 두 줄의
<code>data-testid</code> 도 같아서 e2e strict 모드에서 터질 수 있고, 다 팔았을 때 줄 제거도 첫 줄만 지운다.</p>

<h3><span class="chip mid">중간</span> F-4 · 장비 탭 레코드를 상점에 담을 수 없다</h3>
<p>상점은 <code>database.items</code> 만 읽는다. 청동검·오크 방패 같은 기본 장비는 <code>database.equipment</code> 에 있고,
기본 프로젝트의 <code>items</code> 179개 중 무기/방패/갑옷/머리/장신구 타입은 <b>0개</b>다(normalGoods 119 · medicine 8 · special 5 · book 2).
그래서 기본 자료집으로는 무기점을 만들 수 없다.</p>
<p>아이템 탭에서 종류를 「무기」로 지정한 레코드는 만들 수 있고 상점에도 담긴다. 하지만 장비 메뉴는
<code>database.equipment</code> 를 소지품으로 걸러 보여주므로(<span class="path">playerStatusMenuDetails.ts:230-233</span>)
그렇게 판 무기는 <b>장착이 안 된다</b>. 지금 무기점을 만드는 유일한 길은 선택지 + <code>changeGold</code> + <code>changeItem</code>(장비 id) 을 손으로 짜는 것이다.</p>

<h3><span class="chip lo">낮음</span> F-5 · 메시지 유형 미리보기가 오타이고 런타임과 다르다</h3>
<p>편집창 미리보기는 <code>"어심 오세요! 무엇이 필요하신가요?"</code>
(<span class="path">commandBodyCommerce.ts:754</span>) — 「어심」 오타이고, 런타임은
<code>terms.shopGreeting</code> = <code>"어서 오세요."</code> 를 쓴다
(<span class="path">defaults/defaultDatabase.ts:26</span>). 미리보기가 용어집을 읽지 않아
용어를 바꿔도 편집창 문구는 그대로다.</p>

<h3><span class="chip lo">낮음</span> F-6 · 메시지 유형 6종 중 3종은 저작 경로가 없다</h3>
<p><code>ShopMessageType</code> 은 <code>festival</code> · <code>closingSale</code> · <code>vip</code> 를 포함하고 런타임에
전용 문구도 구현돼 있는데(<span class="path">playSceneShopDom.ts:501-537</span>), 편집창 드롭다운에는 인사말·둘러보기·고르기 3개만 있다.
JSON 을 직접 손대야만 닿는다.</p>

<h3><span class="chip lo">낮음</span> F-7 · lint 문구가 낡았다</h3>
<p><code>shop.empty</code> 경고가 「진입 시 바로 닫힌다」고 말하지만, 지금 런타임은 안내창을 띄우고 닫히기를 기다린다.
저작자가 실제 동작을 오해한다.</p>

<h2 id="s9"><span class="n">09</span>재현 방법</h2>
<p>이 보고서의 캡처 19장과 실측 수치는 모두 아래 스펙 하나가 만든다. <code>_</code> 접두사라 기본 스위트에서는 제외된다.</p>
<pre><code># 워크트리 전용 dev 서버를 새 포트로 띄워서 돈다 (9173 서버는 다른 세션 것일 수 있다)
DEV_SERVER_PORT=9184 E2E_RETRIES=0 \\
  node_modules/.bin/playwright test test/e2e/_shop-report-shots.spec.ts

# 산출물
output/evidence/shop-report/*.png          # 캡처 17장
# 콘솔 로그: [shop-report] state / [failed-branch] / [extra-services]</code></pre>
<div class="note"><b>주의</b> — 이미 떠 있는 dev 서버를 재사용할 때(<code>reuseExistingServer</code>) 그 서버가
<code>E2E_FREEZE_DEV_SERVER=1</code> 로 시작됐다면 파일 감시가 꺼져 있어 <b>낡은 번들을 서빙한다</b>.
이번에도 처음에 :9173 서버(8/28 20:22 기동, 상점 커밋 두 개보다 이전)를 물어 「구매하면 창이 닫힌다」는
이미 고쳐진 회귀가 재현됐다. 상점 e2e 를 돌릴 때는 서버 기동 시각을 먼저 확인하는 게 안전하다.</div>

<footer>
  rpg-zzu 상점 저작·런타임 해부 · 2026-08-29 · HEAD <code>f67cac85</code><br>
  캡처 스펙 <span class="path">test/e2e/_shop-report-shots.spec.ts</span> ·
  이미지는 이 HTML 안에 base64 로 들어 있어 파일 하나만 옮겨도 그대로 보인다.
</footer>

</div>
</body>
</html>
`;

writeFileSync(OUT, html, "utf8");
console.log(`wrote ${OUT} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, ${Object.keys(shots).length} images)`);
