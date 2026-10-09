/**
 * 보고서 생성기 — RM2003 System SE 배선 + 수량 상한.
 *
 * `output/evidence/shop-feedback/*.png` 를 base64 로 심어 단일 HTML 을 만든다.
 * 이미지가 하나라도 없으면 즉시 실패한다(makeImageHelpers).
 *
 * 소리는 스크린샷에 안 찍힌다. 그래서 이 보고서의 근거 절반은 `window.__oprnJuiceLog()`
 * 를 읽어 남긴 수치이고, 화면은 모션(흔들림·붉은 테두리)을 보여준다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { loadShots, makeImageHelpers, REPORT_CSS } from "./lib/reportShell.mjs";

const DIR = "output/evidence/shop-feedback";
const OUT = "reports/shop-rm2003-feedback-2026-08-29.html";

const shots = loadShots(DIR);
const { fig } = makeImageHelpers(shots);

/** e2e 콘솔에서 그대로 옮긴 실측 juice 로그. */
const JUICE = [
  ["거절 — 검술 교본 320G, 소지금 200G", "menu-invalid", "easyrpg-sound-buzzer1", "juice-menu-invalid", "140ms"],
  ["성립 — 회복약 12G 구입", "menu-confirm", "easyrpg-sound-decision1", "juice-menu-confirm", "180ms"],
  ["수량 상한 16에서 → 한 번 더", "menu-invalid", "easyrpg-sound-buzzer1", "juice-menu-invalid", "140ms"],
  ["커서 이동 — ↓", "menu-select", "easyrpg-sound-cursor1", "juice-menu-select", "120ms"],
  ["취소 — Esc", "menu-back", "easyrpg-sound-cancel1", "juice-menu-back", "160ms"],
];

const SLOTS = [
  ["cursor_se", "커서 이동", "menu-select", "easyrpg-sound-cursor1", true],
  ["decision_se", "결정", "menu-confirm", "easyrpg-sound-decision1", true],
  ["cancel_se", "취소", "menu-back", "easyrpg-sound-cancel1", true],
  ["buzzer_se", "무효", "menu-invalid", "easyrpg-sound-buzzer1", true],
  ["battle_se", "전투 시작", "—", "—", false],
  ["escape_se", "도주", "—", "—", false],
  ["enemy_attack_se", "적 공격", "—", "—", false],
  ["enemy_damaged_se", "적 피해", "—", "—", false],
  ["actor_damaged_se", "아군 피해", "—", "—", false],
  ["dodge_se", "회피", "—", "—", false],
  ["enemy_death_se", "적 소멸", "—", "—", false],
  ["item_se", "아이템 사용", "—", "—", false],
];

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>상점 피드백: RM2003 System SE 배선 + 수량 상한 — oprn</title>
<style>
${REPORT_CSS}
  .se-on{color:#2b6b45;font-weight:700}
  .se-off{color:var(--ink-3)}
  .kbd{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;background:#eef1f6;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:1px 6px}
</style>
</head>
<body>

<header class="hero">
  <div class="wrap">
    <h1>못 사는 걸 눌렀을 때 아무 일도 안 일어나던 문제를 고쳤다</h1>
    <p class="lede">RM2003 은 무효한 거래에 <b>버저</b>를 울린다. 이 저장소의 상점은 상태 줄 글자만 바꿨다 —
    성공에는 소지금 델타 토스트가 떴으니 <b>거절이 성공보다 덜 눈에 띄는</b> 상태였다.
    RM2003 System SE 4종을 배선하고, 애초에 못 살 수량을 고를 수 없게 <b>수량 상한</b>을 가져왔다.
    아래 화면과 수치는 전부 이 워크트리의 코드를 Chromium 에서 실제로 띄워 얻은 것이다.</p>
    <div class="meta">
      <span>2026-08-29</span>
      <span>브랜치 상점-피드백-se</span>
      <span>Playwright / Chromium 1280×800</span>
      <span>캡처 7장 · 전부 실측</span>
      <span>e2e 4/4 · 단위 18/18</span>
    </div>
  </div>
</header>

<div class="wrap">

<nav class="toc">
  <ol>
    <li><a href="#s1">한눈에</a></li>
    <li><a href="#s2">근거: RM2003 은 실제로 어떻게 하나</a></li>
    <li><a href="#s3">버저와 결정음</a></li>
    <li><a href="#s4">수량 상한</a></li>
    <li><a href="#s5">커서음과 취소음</a></li>
    <li><a href="#s6">고친 함정 두 개</a></li>
    <li><a href="#s7">베끼지 않은 것</a></li>
    <li><a href="#s8">코드 지도와 검증</a></li>
  </ol>
</nav>

<h2 id="s1"><span class="n">01</span>한눈에</h2>
<div class="cards">
  <div class="card"><h5>배선한 SE</h5><div class="big">4종</div><p>커서 · 결정 · 취소 · 버저. 전부 RM2003 System 슬롯 대응</p></div>
  <div class="card"><h5>새로 만든 것</h5><div class="big">0개</div><p>SE 표와 에셋은 이미 있었다. 상점이 부르지 않았을 뿐</p></div>
  <div class="card"><h5>죽어 있던 모션</h5><div class="big">9개 → 0개</div><p><code>.juice-*</code> 클래스에 CSS 규칙이 하나도 없었다</p></div>
  <div class="card"><h5>수량 상한</h5><div class="big">99 → 16</div><p>소지금 200G · 회복약 12G 기준. 예전엔 99까지 올라간 뒤 거절</p></div>
  <div class="card"><h5>테스트</h5><div class="big">22개</div><p>단위 18 + e2e 4. 전부 신규</p></div>
  <div class="card"><h5>회귀</h5><div class="big">0건</div><p>커서 메뉴·상점 관련 기존 109개 통과</p></div>
</div>

<div class="note ok"><b>핵심.</b> 만들 게 아니라 <b>배선</b>이었다. <code>src/player/runtimeJuice.ts</code> 에 RM2003 4종이 정확한 EasyRPG 에셋 id 로
이미 정의돼 있었고 <code>.wav</code> 도 <code>public/assets/easyrpg/sound/</code> 에 있었다. 주석에도 <code>RM2k3-ish UI SFX</code> 라고 적혀 있다.
상점과 공용 커서 메뉴가 이 함수를 한 번도 부르지 않았을 뿐이다. 실제로 <code>menu-invalid</code> 는 저장소 전체에서 단 한 곳
(상태 메뉴의 Tab 키)에만 연결돼 있어 버저 경로가 검증되지 않은 상태였다.</div>

<h2 id="s2"><span class="n">02</span>근거: RM2003 은 실제로 어떻게 하나</h2>
<p>기억에 의존하지 않고 정본에서 확인했다. <b>liblcf</b> 는 RM2000/2003 데이터 포맷 라이브러리이고,
<b>EasyRPG Player</b> 는 그 인터프리터다. 이 저장소는 이미 EasyRPG RTP 칩셋과 사운드를 쓰고 있으니 같은 계보다.</p>

<h3>System SE 슬롯은 12개다</h3>
<p>각 슬롯은 <code>Sound</code> 구조체이고 필드가 <code>name</code>(기본 <code>"(OFF)"</code>) · <code>volume</code>(100) ·
<code>tempo</code>(100) · <code>balance</code>(50) 다. <code>tempo</code> 가 피치 시프트라서 파일 하나로 변주를 만들 수 있는 게 RM 방식이다.</p>
<table>
<thead><tr><th>liblcf 필드</th><th>역할</th><th>이번에 배선한 이벤트</th><th>에셋 id</th></tr></thead>
<tbody>
${SLOTS.map(([slot, role, event, asset, on]) => `<tr>
  <td><code>${slot}</code></td><td>${role}</td>
  <td class="${on ? "se-on" : "se-off"}">${on ? `<code>${event}</code>` : "이번 범위 아님"}</td>
  <td class="se-${on ? "on" : "off"}">${on ? `<code>${asset}</code>` : "—"}</td>
</tr>`).join("\n")}
</tbody>
</table>

<h3>상점에서 언제 울리나</h3>
<p><code>scene_shop.cpp</code> 기준으로 확정에 <code>SFX_Decision</code>, 취소·나가기에 <code>SFX_Cancel</code>,
<b>무효한 거래에 <code>SFX_Buzzer</code></b> 다. 커서 이동음은 상점 코드에 없다 — 창/커서 레이어가 전역으로 울린다.
그래서 이번 배선도 <b>버저·결정음은 상점에, 커서음·취소음은 공용 커서 메뉴에</b> 붙였다. 원본과 같은 구조다.</p>

<div class="note"><b>결정음을 커서 메뉴에 두지 않은 이유.</b> 결정은 성공일 수도 거절일 수도 있다.
커서 메뉴가 결정키에 무조건 결정음을 울리면 거절당한 구매에서 <b>결정음과 버저가 같이</b> 난다.
RM2003 은 무효한 거래에 버저만 울린다. 그래서 결정/버저 판단은 도메인 핸들러 몫으로 남겼고,
커서 메뉴는 결정키에 소리를 내지 않는다(이 계약을 테스트로 고정했다).</div>

<h2 id="s3"><span class="n">03</span>버저와 결정음</h2>
${fig("01-buzzer-refused", "거절 — 검술 교본 320G, 소지금 200G", "버저가 울리고 행이 좌우로 튕긴다. 붉은 테두리가 남고 상태 줄이 「소지금이 부족합니다.」로 바뀐다. 커서는 그대로 얹혀 있다 — RM2003 도 목록에서 못 고르게 막지 않는다.", "dark")}

<p>거절 순간의 juice 로그는 이렇게 나왔다. 결정음이 섞이지 않는 것까지 계약으로 고정했다.</p>
<pre><code>[SE-1] refused juice [{"event":"menu-invalid","soundResourceId":"easyrpg-sound-buzzer1",
                       "motionClass":"juice-menu-invalid","durationMs":140}]
[SE-1] bought  juice [{"event":"menu-confirm","soundResourceId":"easyrpg-sound-decision1",
                       "motionClass":"juice-menu-confirm","durationMs":180}]</code></pre>

${fig("02-decision-success", "성립 — 회복약 12G 구입", "결정음이 울리고 소지금 델타 토스트가 뜬다. 소지금 200G → 188G. 창은 닫히지 않는다.", "dark")}

<h3>흔들림을 증명하는 방법</h3>
<p>클릭 뒤에 클래스를 읽으면 <b>이미 사라져 있다</b>. 애니메이션이 140ms 만 살기 때문이다(실측: <code>false</code>).
그래서 클릭 전에 <code>MutationObserver</code> 를 걸어 «한 번이라도 붙었는가»를 기록했다. 결정적으로 증명된다.</p>
<pre><code><span class="cmt">// 붙는 순간을 놓치지 않는다</span>
new MutationObserver(() =&gt; {
  if (row.classList.contains("juice-menu-invalid")) host.__shakeSeen = true;
}).observe(row, { attributes: true, attributeFilter: ["class"] });</code></pre>
<pre><code>[SE-1] shake class observed: true
[SE-1] invalid motion computed {"name":"juice-menu-invalid-shake","duration":"0.14s",
                                "outline":"oklab(0.546853 0.173646 0.0679534 / 0.78)"}</code></pre>
${fig("01b-buzzer-motion", "거절 모션 — 붉은 테두리", "흔들림은 140ms 라 정지 화면에 잡히지 않는다. 대신 prefers-reduced-motion 환경에서도 남는 붉은 테두리를 고정해 촬영했다.", "dark")}

<h2 id="s4"><span class="n">04</span>수량 상한</h2>
<p>RM2003 은 수량 자체를 못 올리게 한다 — <code>std::min(max, gold / price)</code>. 이 저장소는 <code>1..99</code> 하드코딩이라
99까지 올린 뒤 결정 시점에 거절당하는 <b>막다른 길</b>이 있었다. 소리보다 이게 먼저다.</p>

<div class="grid2">
${fig("03-quantity-max", "커서를 얹으면 상한이 정해진다", "소지금 200G ÷ 회복약 12G = 16. input 의 max 와 안내 문구가 함께 16으로 바뀐다.", "dark")}
${fig("04-quantity-at-max", "→ 를 15번 눌러 상한", "수량 16 · 합계 192G. 소지금 200G 안이다. 한 번 더 누르면 값은 그대로고 버저가 울린다.", "dark")}
</div>

<table>
<thead><tr><th>상황</th><th class="num">소지금</th><th class="num">단가</th><th class="num">예전 상한</th><th class="num">새 상한</th><th>근거</th></tr></thead>
<tbody>
<tr><td>회복약</td><td class="num">200G</td><td class="num">12G</td><td class="num">99</td><td class="num">16</td><td><code>floor(200/12)</code></td></tr>
<tr><td>검술 교본</td><td class="num">200G</td><td class="num">320G</td><td class="num">99</td><td class="num">0 → 표시 1</td><td>한 개도 못 산다. 거절은 결정 시점의 버저가 담당</td></tr>
<tr><td>공짜 물건</td><td class="num">0G</td><td class="num">0G</td><td class="num">99</td><td class="num">99</td><td>소지금이 상한을 만들지 못한다</td></tr>
<tr><td>부자</td><td class="num">9,999,999G</td><td class="num">12G</td><td class="num">99</td><td class="num">99</td><td>절대 상한은 RM2003 과 같이 99</td></tr>
<tr><td>해독초 되팔기</td><td class="num">상인 300G</td><td class="num">4G</td><td class="num">99</td><td class="num">3</td><td>가진 개수가 먼저 상한</td></tr>
</tbody>
</table>

${fig("06-sell-max-owned", "판매 상한은 가진 개수다", "해독초 3개 보유 → 상한 3. 상인 지갑이 얕으면 그쪽이 상한이 된다(min(보유, 상인지갑 ÷ 판매가)).", "dark")}

<div class="note"><b>상한에 부딪히면 조용하지 않다.</b> 값이 안 움직이는 것만으로는 «키가 안 먹었나»와 «상한인가»를
구분할 수 없다. 그래서 상한과 하한(1)에서 버저를 울린다. 실측 로그:
<code>[SE-2] capped juice [{"event":"menu-invalid","soundResourceId":"easyrpg-sound-buzzer1"...}]</code></div>

<h2 id="s5"><span class="n">05</span>커서음과 취소음</h2>
${fig("05-entry", "입구 메뉴", "여기서 ↓ 를 누르면 menu-select(cursor1), Esc 를 누르면 menu-back(cancel1) 이 울린다.", "dark")}

<pre><code>[SE-3] cursor juice [{"event":"menu-select","soundResourceId":"easyrpg-sound-cursor1",...}]
[SE-3] cancel juice [{"event":"menu-back","soundResourceId":"easyrpg-sound-cancel1",...}]</code></pre>

<h3>마우스에는 울리지 않는다</h3>
<p><code>attachCursorMenu</code> 의 <code>setIndex</code> 는 키보드뿐 아니라 <code>mouseenter</code> 와 <code>focusin</code> 에서도 불린다.
그냥 소리를 달면 <b>마우스를 스칠 때마다 삑삑거린다</b>. 원인을 인자로 넘겨 키보드 이동에만 울리게 했다.</p>
<pre><code><span class="cmt">// 커서음은 키보드 이동에만</span>
type SelectCause = "key" | "pointer" | "focus" | "init";

const setIndex = (next: number, cause: SelectCause = "key"): void =&gt; {
  ...
<span class="add">+ if (opts.sound &amp;&amp; cause === "key") emitRuntimeJuice({ event: "menu-select" });</span>
  opts.onSelect?.(index);
};</code></pre>

<div class="note warn"><b>기본은 꺼짐이다.</b> <code>attachCursorMenu</code> 는 맵·전투·상태 메뉴가 함께 쓴다.
무조건 울리면 게임 전체 소리가 한꺼번에 바뀐다. 그래서 <code>sound: true</code> 를 넘긴 곳(상점 3개 호출 지점)만 울린다.
«소리를 켜지 않으면 아무 소리도 울리지 않는다»를 테스트로 고정했다.</div>

<h3>빈 약속을 하지 않는다</h3>
<p><code>cancelEl</code> 이 없으면 취소키는 원래 아무 일도 하지 않는다. 이때 취소음만 울리면
«뒤로 갔다»는 거짓 신호가 된다. <code>cancelEl</code> 이 있을 때만 울린다.</p>

<h2 id="s6"><span class="n">06</span>고친 함정 두 개</h2>

<div class="fx">
<h3><span class="fx-id">J-1</span>runtimeJuice 에 헤드리스 가드가 없었다 <span class="chip mid">중간</span></h3>
<dl>
  <dt>증상</dt><dd><code>emitRuntimeJuice</code> 를 부르는 코드는 node 환경 단위 테스트에서 <code>ReferenceError</code> 로 죽는다.</dd>
  <dt>원인</dt><dd><code>playRuntimeJuiceSound</code> 가 맨 <code>new Audio(url)</code> 를, <code>runtimeJuiceState()</code> 가 맨 <code>window</code> 를 만진다.
  <code>vitest.config.ts</code> 는 <code>environment: "node"</code> 가 전역 기본값이고 <code>test/fakeDom.ts</code> 는 <code>document</code> 만 깔고 <code>Audio</code>·<code>window</code> 는 안 깐다.</dd>
  <dt>영향</dt><dd>UI 피드백을 붙일 수 있는 자리가 사실상 브라우저 전용으로 묶여 있었다. 기존 테스트들은
  <code>FakeAudio</code> 를 손으로 깔거나 모듈을 <code>vi.mock</code> 으로 통째로 갈아서 우회하고 있었다.</dd>
  <dt>수정</dt><dd><code>typeof Audio === "undefined"</code> 가드 + <code>window</code> 없을 때 쓰는 대체 로그 저장소.
  모션도 <code>rAF</code> 가 없으면 클래스만 즉시 얹는다.</dd>
</dl>
</div>

<div class="fx extra">
<h3><span class="fx-id">J-2</span>모션 절반이 죽어 있었다 <span class="chip extra">숨어 있던 결함</span></h3>
<dl>
  <dt>증상</dt><dd><code>emitRuntimeJuice</code> 는 소리를 내고 클래스를 얹지만 <b>화면에서 아무 일도 일어나지 않았다.</b></dd>
  <dt>원인</dt><dd><code>.juice-menu-invalid</code>·<code>.juice-menu-select</code> 등 9개 클래스에 CSS 규칙이
  <b>저장소 어디에도 없었다.</b> 문자열은 <code>runtimeJuice.ts</code> 와 e2e 스펙에만 나온다.</dd>
  <dt>왜 안 드러났나</dt><dd>기존 e2e 가 클래스 <b>부착만</b> 검사하고 애니메이션은 확인하지 않았다.
  «테스트가 통과하는 죽은 기능»의 표본이다.</dd>
  <dt>수정</dt><dd><code>src/styles/runtime/juice.css</code> 신규. 거절은 좌우 튕김 + 붉은 테두리,
  결정은 눌림, 커서는 옅은 밝아짐. <code>prefers-reduced-motion</code> 에서는 움직임만 끄고 <b>붉은 테두리는 남긴다</b> —
  거절 신호 자체를 없애면 왜 안 되는지 알 수 없다.</dd>
</dl>
</div>

<div class="note"><b>왜 모션이 필요한가.</b> 소리는 볼륨 0·무음 환경·브라우저 자동재생 차단에서 사라진다.
소리만으로 거절을 알리면 그 환경에서는 <b>아무 일도 안 일어난 것과 같다</b>. 원래 상태로 되돌아가는 셈이다.</div>

<h2 id="s7"><span class="n">07</span>베끼지 않은 것</h2>

<h3>소지 한도 99</h3>
<p>RM2003 의 <code>CheckEnable</code> 은 소지금 <b>그리고</b> 소지 한도를 본다(<code>window_shopbuy.cpp</code>):</p>
<pre><code>return (item-&gt;price &lt;= Main_Data::game_party-&gt;GetGold() &amp;&amp;
    Main_Data::game_party-&gt;GetItemCount(item_id) &lt; Main_Data::game_party-&gt;GetMaxItemCount(item_id));</code></pre>
<p>그런데 이 저장소의 한도는 <code>ITEM_QUANTITY_MAX = 9_999_999</code> 다(<code>src/project/itemQuantities.ts</code>).
99로 낮추면 아이템을 다루는 <b>전 시스템에 걸친 회귀</b>가 된다. 그래서 수량 상한만 가져오고 소지 한도는 그대로 뒀다.
«가방이 꽉 찼습니다» 거절 경로는 이미 있고, 실질적으로 도달하지 않는다.</p>

<h3>못 사는 줄을 글자색만 바꾸는 것</h3>
<p>RM2003 은 <code>Font::ColorDisabled</code> 로 가격 글자색만 바꾼다. 취소선도 자물쇠도 없다.
지금 구현(흐림 + 취소선 + 자물쇠)이 원본보다 명확하므로 유지했다. 모던하게 만드는 게 목적이었다.</p>

<h3>SE 12슬롯 데이터 모델</h3>
<p>RM2003 은 SE 를 프로젝트마다 설정하게 한다. 이 저장소에는 <code>TitleScreenSounds</code>(cursor/confirm/cancel,
<b>버저 없음</b>)만 타이틀 화면용으로 있다. 12슬롯을 지금 만들면 에디터 UI·정규화·참조 검증·AI 툴이 딸려온다.
하드코딩된 기본 SE로 <b>먼저 소리가 나게</b> 하는 것이 순서라고 판단했다. <code>emitRuntimeJuice</code> 는
이미 <code>soundResourceId</code> 덮어쓰기를 받으므로 나중에 슬롯을 붙일 자리는 열려 있다.</p>

<h2 id="s8"><span class="n">08</span>코드 지도와 검증</h2>
<table>
<thead><tr><th>파일</th><th>무엇을</th></tr></thead>
<tbody>
<tr><td><span class="path">src/player/runtimeJuice.ts</span></td><td>헤드리스 가드(<code>Audio</code>·<code>window</code>·<code>rAF</code>) + 대체 로그 저장소</td></tr>
<tr><td><span class="path">src/player/runtimeCursorMenu.ts</span></td><td><code>sound</code> 옵션, <code>SelectCause</code> 로 키보드/포인터 구분, 취소음</td></tr>
<tr><td><span class="path">src/player/playSceneShop.ts</span></td><td>거절에 버저(행을 흔든다) · 성립에 결정음 · 3개 커서 메뉴에 <code>sound: true</code></td></tr>
<tr><td><span class="path">src/player/playSceneShopParts.ts</span></td><td><code>affordableQuantityMax</code>, <code>shopQuantityMaxIn</code>, 행에 <code>data-max-qty</code>, 상한 연동 clamp</td></tr>
<tr><td><span class="path">src/player/playSceneShopDom.ts</span></td><td><code>adjustShopQuantity</code> 상한 적용 + 부딪히면 버저, <code>shopItemRowEl</code></td></tr>
<tr><td><span class="path">src/styles/runtime/juice.css</span></td><td><b>신규</b> — 죽어 있던 모션 9종을 살린다. reduced-motion 분기 포함</td></tr>
<tr><td><span class="path">scripts/lib/reportShell.mjs</span></td><td><b>신규</b> — 두 보고서가 공유하는 CSS·이미지 헬퍼(115행 중복 제거)</td></tr>
<tr><td><span class="path">test/shopFeedbackJuice.test.ts</span></td><td><b>신규</b> 18개 — 상한 계산, 스테퍼 버저, 커서음 조건, 모션 부착</td></tr>
<tr><td><span class="path">test/e2e/_shop-feedback-shots.spec.ts</span></td><td><b>신규</b> 4개 — 실제 런타임에서 SE 4종 + 상한 + 캡처</td></tr>
</tbody>
</table>

<div class="note ok"><b>통과.</b> e2e <code>_shop-feedback-shots.spec.ts</code> 4/4 ·
단위 <code>shopFeedbackJuice</code> 18/18 · 회귀 확인용으로 커서 메뉴·juice·상점을 건드리는 기존 파일 10개 <b>109/109</b> ·
<code>_shop-modern-shots.spec.ts</code> 5/5(이전 작업 회귀 없음) · 변경 표면 <code>tsc --noEmit</code> 오류 0.</div>

<div class="note warn"><b>e2e 에서 걸린 함정.</b> <code>tapKey</code> 로 화살표를 보내면 커서 메뉴에 닿지 않는다.
이 헬퍼는 방향키를 <code>window.__oprnInput.dir()</code> 로 보내 Phaser 입력에만 전달하고 <b>DOM keydown 을 만들지 않는다</b>.
커서 메뉴는 DOM keydown 을 듣는다. 그래서 메뉴 조작은 <code>page.keyboard.press</code> 를 써야 한다 —
처음 실행에서 수량이 <code>1</code> 에 머물고 juice 로그가 <code>[]</code> 로 나온 원인이었다.</div>

<h3>남은 것</h3>
<ul>
  <li>SE 12슬롯을 자료집 System 탭에 노출하는 일(위 07 참조). 지금은 기본 SE 하드코딩이다.</li>
  <li>전투 SE 8종은 이번 범위가 아니다. <code>battleJuice.ts</code>·<code>battleSfx.ts</code> 가 이미 자체 표를 들고 있고,
  신디사이저와 샘플이 <b>동시에</b> 살아 있다 — 정리 대상으로 보이지만 별도 작업이다.</li>
  <li>커서음을 상점 밖(맵·상태 메뉴)으로 넓히는 일. <code>sound: true</code> 를 넘기면 되지만 게임 전체 소리가 바뀌므로 별도 판단이 필요하다.</li>
</ul>

<footer>
  oprn · 상점 피드백(RM2003 System SE + 수량 상한) · 2026-08-29 ·
  캡처 7장은 <span class="path">output/evidence/shop-feedback/</span> 의 실제 실행 결과이며 base64 로 이 파일에 박혀 있다 ·
  근거: liblcf <span class="path">rpg/system.h</span>, <span class="path">rpg/sound.h</span> ·
  EasyRPG Player <span class="path">scene_shop.cpp</span>, <span class="path">window_shopbuy.cpp</span>
</footer>

</div>
</body>
</html>`;

mkdirSync("reports", { recursive: true });
writeFileSync(OUT, html, "utf8");
const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
console.log(`wrote ${OUT} (${kb} KB, ${Object.keys(shots).length} images available)`);
