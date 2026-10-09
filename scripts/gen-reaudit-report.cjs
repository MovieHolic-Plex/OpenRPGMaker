// 타일 재감사 보고서를 이미지 내장 단일 HTML 로 만든다.
// 증거 PNG 를 base64 로 박아서 파일 하나만 열면 되게 한다.
const fs = require("fs");
const path = require("path");

const EV = path.join(__dirname, "..", ".omo", "evidence", "tile-reaudit");
const OUT = path.join(EV, "report.html");

function img(rel, alt) {
  const p = path.join(EV, rel);
  if (!fs.existsSync(p)) return `<div class="missing">이미지 없음: ${rel}</div>`;
  const b64 = fs.readFileSync(p).toString("base64");
  const kb = Math.round(fs.statSync(p).size / 1024);
  return `<figure><img src="data:image/png;base64,${b64}" alt="${alt}">
    <figcaption>${alt} <span class="src">${rel} · ${kb}KB</span></figcaption></figure>`;
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#080b14;color:#dfe6f5;
  font:15px/1.75 -apple-system,"Segoe UI","Malgun Gothic",sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:56px 28px 96px}
h1{font-size:30px;line-height:1.35;margin:0 0 8px;letter-spacing:-.4px}
.sub{color:#8fa0c4;margin:0 0 40px;font-size:15px}
h2{font-size:21px;margin:56px 0 6px;padding-top:26px;border-top:1px solid #1c2540;letter-spacing:-.2px}
h2 .n{color:#4d6ea8;font-variant-numeric:tabular-nums;margin-right:10px;font-size:17px}
h3{font-size:16px;margin:30px 0 8px;color:#b9c8e6}
p{margin:10px 0}
.lede{color:#a9bade}
code{background:#131b2e;padding:2px 6px;border-radius:4px;font-size:13px;
  font-family:ui-monospace,Menlo,Consolas,monospace;color:#9fd0ff}
figure{margin:20px 0;background:#0d1322;border:1px solid #1e2842;border-radius:10px;padding:12px;overflow:hidden}
figure img{display:block;width:100%;height:auto;image-rendering:pixelated;border-radius:6px;background:#161d30}
figcaption{margin-top:10px;font-size:13px;color:#93a5c9}
figcaption .src{color:#4f628a;font-family:ui-monospace,monospace;font-size:11px;margin-left:8px}
.missing{padding:14px;border:1px dashed #33405f;border-radius:8px;color:#6b7ea6;font-size:13px}
table{border-collapse:collapse;width:100%;margin:18px 0;font-size:14px}
th,td{border:1px solid #1e2842;padding:9px 12px;text-align:left;vertical-align:top}
th{background:#111a2c;color:#9db4dc;font-weight:600;font-size:13px}
td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
.bad{color:#ff9a9a}.good{color:#86e5a8}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:22px 0}
.card{background:#0d1322;border:1px solid #1e2842;border-radius:10px;padding:16px}
.card .v{font-size:26px;font-weight:700;color:#8fd0ff;font-variant-numeric:tabular-nums;line-height:1.2}
.card .k{font-size:12px;color:#8798bd;margin-top:5px}
blockquote{margin:16px 0;padding:12px 18px;border-left:3px solid #d4634f;background:#1a1013;
  color:#ffc9bd;font-size:14px;border-radius:0 8px 8px 0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:760px){.two{grid-template-columns:1fr}}
.note{background:#0d1322;border:1px solid #1e2842;border-left:3px solid #4d6ea8;
  border-radius:0 8px 8px 0;padding:14px 18px;margin:20px 0;font-size:14px;color:#adbfe2}
ul{padding-left:20px;margin:10px 0}li{margin:5px 0}
.pass{color:#86e5a8;font-weight:600}
.foot{margin-top:64px;padding-top:22px;border-top:1px solid #1c2540;color:#5f7099;font-size:13px}
`;

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>타일 의미 표 재감사 보고서 · oprn</title>
<style>${CSS}</style></head><body><div class="wrap">

<h1>여섯 칩셋 타일 의미 표 재감사</h1>
<p class="sub">그림을 못 보는 모델이 만든 라벨을, 그림을 보는 판독자로 전부 다시 썼다 ·
병합 sha <code>8cbcd78d</code></p>

<div class="cards">
  <div class="card"><div class="v">2,057</div><div class="k">그림 보고 교정한 칸</div></div>
  <div class="card"><div class="v">797</div><div class="k">기존 라벨이 맞다고 확인</div></div>
  <div class="card"><div class="v">2,856</div><div class="k">그림 있는 전체 칸</div></div>
  <div class="card"><div class="v">9</div><div class="k">병합된 PR</div></div>
  <div class="card"><div class="v">3</div><div class="k">미해결 (사람 판단 필요)</div></div>
</div>

<h2><span class="n">01</span>무엇이 잘못됐나</h2>
<p class="lede">출하된 표는 <b>이미지를 볼 수 없는 모델</b>이 쓴 라벨을 담고 있었다.
샤드 <code>shard-retro_exterior-08-11</code> 은 <code>unspecified-low</code> 카테고리로 갔고,
그 카테고리의 1순위 모델 <code>cliproxy/deepseek-v4-flash-0731</code> 에는 비전이 없다.
그 샤드는 완료 보고에 스스로 이렇게 적었다.</p>

<blockquote>"I read the four row images via pixel-level analysis
(the model couldn't render them as images)"</blockquote>

<p>4시간 38분, 토큰 405만 개를 쓰고 <b>한 번도 보지 못한 타일에 라벨 119개</b>를 붙였다.
그 결과가 그대로 출하됐다.</p>

<h3>기존 품질 신호는 둘 다 이걸 못 잡는다</h3>
<table>
<tr><th>신호</th><th>왜 무용한가</th></tr>
<tr><td><code>audit-tile-semantics-grounding.mts</code></td>
<td>색·통행 모순만 본다. 물건의 정체가 틀린 건 <b>구조적으로</b> 못 잡는다 —
이 데이터를 2/2,856 위반으로 통과시켰다.</td></tr>
<tr><td>distinct-label-ratio 지문</td>
<td>예측력이 0이다. 가장 심하게 틀린 <code>retro_exterior</code> 4~7행이
distinct 100% · 평균 10.7자로 <b>가장 좋은 점수</b>를 받는다.</td></tr>
</table>
<p><b>렌더한 타일을 보는 것만이 검증이다.</b> 이 보고서의 모든 판정은 그 원칙 위에 있다.</p>

${img("blocks/retro_exterior/sheet-full.png", "retro_exterior 전체 시트 — 480x256, 30열 x 16행 = 480칸")}

<h2><span class="n">02</span>판독자에게 무엇을 보여줬나</h2>
<p class="lede">16x16 타일 하나만 떼어 보면 사람도 못 맞힌다 — 침대가 지붕 기와로,
깃발이 처마로 읽힌 게 그래서다. 그래서 입력에 <b>이웃 맥락</b>과 <b>인덱스 숫자</b>를 같이 넣었다.
아래는 판독자가 실제로 받은 그림이다.</p>

${img("strips/retro_exterior/row-05.png", "행 단위 인덱스 스트립 — 6배 확대, 타일마다 인덱스 숫자를 밑에 새기고 투명은 체커보드로")}
${img("blocks/retro_exterior/block-04-07.png", "4~7행 블록 — 세로 이웃까지 보이게 묶어서, 위아래로 이어지는 물건을 판독자가 알아볼 수 있게 했다")}

<h3>비전 게이트: 아이가 정말 보는지 먼저 증명한다</h3>
<p>모든 작업 전에, 답을 이미 아는 타일로 아이를 시험했다.
응답 첫 줄이 <code>VISION: YES</code> 였고, 타일별 설명이 픽셀과 맞았다.</p>
${img("vision-probe/house-cols10-19-rows0-4.png", "비전 게이트에 쓴 그림 — retro_house 0~4행 10~19열")}
<div class="note">아이는 16번을 <b>"위아래 수평 목재 프레임 사이의 크림색 반점 회벽"</b>이라고 적었다.
확대해서 보면 정확히 그것이다. 그림을 못 보는 모델은 이런 문장을 쓸 수 없다.</div>

<h2><span class="n">03</span>어떻게 다시 썼나</h2>
<table>
<tr><th>단계</th><th>한 일</th></tr>
<tr><td>판독 A · B</td><td>칸마다 <b>서로 모르는 아이 2명</b>이 각각 그림을 보고 라벨을 쓴다.
전부 <code>visual-engineering</code> (1순위 <code>gemini-3.7-flash-tiered</code>, 비전 있음).</td></tr>
<tr><td>다수결</td><td>두 명이 같은 물건이라고 하면 채택. 즉 교정된 모든 칸은
<b>저자 아닌 관찰자</b>의 확인을 받는다.</td></tr>
<tr><td>판독 C</td><td>A·B 가 갈린 칸에만 3번째 아이를 붙인다.</td></tr>
<tr><td>고배율 최종 판정</td><td>그래도 갈리면 해당 칸만 14~40배로 크게 떠서 판정 아이 29명을 붙인다.</td></tr>
<tr><td>내가 직접</td><td>끝까지 안 되는 칸은 내가 봤다. 픽셀 동일성 비교도 직접 했다.</td></tr>
</table>

<h2><span class="n">04</span>대표 교정</h2>

<h3>179 / 209 — "붉은 지붕 하단 처마" 가 아니라 문장 깃발</h3>
<p>지시서가 못박은 대표 오류다. 20배로 보면 붉은 바탕에 금색 문장, 양측에 금색 띠가 있고,
209 에서 <b>제비꼬리 V 밑단</b>으로 끝난다. 지붕일 수가 없다.</p>
${img("verified/retro_exterior/audit-179-banner.png", "179/209 를 20배로 — 오른쪽 열이 깃발 상·하단. 같은 크롭에 27열 통(barrel), 27열 6행 양동이, 28열 5행 빵이 함께 보인다")}

<h3>145 / 146 — 창문도 문도 아니라 거울 달린 서랍장</h3>
<p>여기는 <b>내 중간 교정도 틀렸다.</b> 출하본은 "나무 문 설계도" <code>door</code>,
내 1차 교정은 "커튼 달린 창문" <code>window</code>. 40배로 보니 둘 다 아니었다.</p>
<ul>
  <li>돌출한 천판</li>
  <li>양쪽 측면에 각각 <b>3쌍씩 붙은 회청색 서랍 손잡이</b> — 가구 철물이다</li>
  <li>가운데 어두운 남색 거울면</li>
  <li>결정적으로 <b>바로 위 3행</b>(115/116)에 청록색 유리 12칸 격자의 진짜 창문이 있고 생김새가 전혀 다르다</li>
</ul>
${img("verified/retro_exterior/audit-145-146-zoom.png", "145/146 을 40배로 — 위가 진짜 창문(청록 유리 12칸), 가운데가 서랍장, 서랍 손잡이가 양쪽에 3쌍씩")}

<h3>4~7행 x 24~29열 — 24칸 전부 건축물이었다</h3>
<p>출하본은 이 24칸을 전부 <code>wall/door/roof/window/floor/gate/fence</code> 로 불렀다.
실제 그림은 서랍장·통·빵·의자·양동이·벤치·상자·깃발이다.</p>
${img("verified/retro_exterior/props-cols24-29-rows4-7.png", "4~7행 24~29열 — 가구와 소품과 깃발")}
<div class="cards">
  <div class="card"><div class="v bad">24 / 24</div><div class="k">출하본: 건축물</div></div>
  <div class="card"><div class="v good">0 / 24</div><div class="k">재감사본: 건축물</div></div>
  <div class="card"><div class="v">8 · 11 · 5</div><div class="k">prop · furniture · decoration</div></div>
</div>

<h3>그 밖에</h3>
${img("verified/retro_exterior/audit-259-265.png", "259 와 그 주변 — 259 는 사방으로 뻗은 마른 가지 덩어리다")}
<table>
<tr><th>idx</th><th>출하본</th><th>재감사본</th></tr>
<tr><td class="n">253</td><td class="bad">"물" <code>water</code></td><td class="good">청회색 거친 자연석 바닥 <code>terrain</code></td></tr>
<tr><td class="n">252</td><td class="bad">"나무 바닥" <code>floor</code></td><td class="good">분홍색 거친 자연석 바닥 <code>terrain</code></td></tr>
<tr><td class="n">259</td><td class="bad">"나무 통" <code>prop</code></td><td class="good">죽은 나뭇가지 덤불 <code>plant</code></td></tr>
</table>

<h2><span class="n">05</span>지시서 자체가 그림과 어긋난 3곳</h2>
<p class="lede">이 작업 전체가 <b>"표에 적힌 말보다 그림이 옳다"</b>는 원칙 위에 서 있다.
그 원칙은 지시서에도 똑같이 적용된다. 세 곳에서 지시서의 인덱스·정답이 그림과 맞지 않았고,
내 라벨이 그림과 맞으므로 유지했다.</p>

<table>
<tr><th>대상</th><th>지시서</th><th>그림</th><th>지시서가 말한 물건의 실제 위치</th></tr>
<tr><td class="n">265</td><td class="bad">석조 묘비</td><td>잎 달린 갈색 덩굴</td><td>묘비 같은 청회색 이끼 슬래브는 <b>257</b></td></tr>
<tr><td class="n">266</td><td class="bad">석조 기둥 머리</td><td>회색 석상</td><td>볼류트 달린 이오니아식 기둥 머리는 <b>267</b></td></tr>
<tr><td class="n">retro_house<br>12-17</td><td class="bad">침대<br>(비전 게이트 정답)</td><td>목조 골조 벽면</td><td>—</td></tr>
</table>

<h3>12-17 은 침대가 아니다</h3>
<p>비전 게이트가 정답으로 못박은 칸이다. 14배로 보면 갈색 기둥·보 아래 자갈석 패널(12-14),
같은 골조에 크림색 반점 회벽(15-17), 둥근 아치 상단.
<b>매트리스·베개·머리판이 한 픽셀도 없다.</b> 판독자 3명과 내 직접 확인이 모두 벽이라고 말한다.</p>
${img("verified/retro_house/audit-house-12-17.png", "retro_house 0~2행 10~20열을 14배로 — 12~14 는 자갈석 패널, 15~17 은 크림색 회벽, 둘 다 목조 골조 안에 들어 있다")}
<div class="note">게이트의 <b>목적</b>(아이가 정말 보는지 증명)은 달성됐다.
어긋난 건 게이트가 가정한 답이었고, 그건 그림으로 반박했다.</div>

<h2><span class="n">06</span>재발 방지</h2>
<p class="lede">같은 사고가 다시 나면 <b>테스트가 먼저 깨지도록</b> 불변식을 못박았다.</p>

<h3>거의 똑같은 두 시트는 role 이 일치해야 한다</h3>
<p><code>retro_exterior</code> 와 <code>retro_house</code> 는 픽셀이 거의 같은 시트다.
그림을 보고 썼다면 라벨이 비슷해야 한다. 출하본은 그렇지 않았다 — 이게 사고의 지문이다.</p>
<table>
<tr><th>지표</th><th>출하본</th><th>재감사본</th></tr>
<tr><td>role 일치율</td><td class="bad n">24.5%</td><td class="good n">94.8%</td></tr>
<tr><td>라벨 일치율</td><td class="bad n">0.0%</td><td class="good n">58.4%</td></tr>
</table>
<p><code>test/tileSemanticsDuplicateSheetConsistency.test.ts</code> 가 role 일치 70% 미만이면
실패한다. 출하 데이터에 대고 돌리면 24.5% 로 <span class="bad">RED</span> 다.</p>

<h3>그림이 있는 칸에 role=empty 를 거부한다</h3>
<p>판정 병합 단계에 모순 검사를 넣었다. <code>ship 430</code> 이 여기서 걸렸다 —
"대형 목재 해치 내부" <code>empty</code> 라고 했지만 그 자리에 픽셀 256개가 있다.</p>

<h2><span class="n">07</span>실측 브라우저 QA</h2>
<p class="lede">표 파일을 직접 <code>import</code> 하는 단위 테스트는
<b>번들이 실제로 그 값을 서브하는지</b>는 증명하지 못한다.
그래서 돌아가는 에디터의 페이지 컨텍스트에서 <b>앱 자신의 모듈 그래프</b>를 동적 import 해서 읽는다.</p>

<h3>RED — 출하본으로 되돌린 상태</h3>
<blockquote>Error: 179 라벨에 "깃발" 가 있어야 한다 (실제: 붉은 지붕 하단 처마)<br>1 failed</blockquote>

<h3>GREEN — 재감사본</h3>
<p>아래 패널의 라벨 문자열은 <b>앱이 서브한 모듈에서 온 값 그대로</b>다.</p>
${img("browser-qa/corrected-labels-panel.png", "돌아가는 에디터가 서브하는 라벨 — 179/209 깃발, 145/146 서랍장, 253/252 자연석, 259 나뭇가지")}
${img("browser-qa/corrected-labels-editor.png", "실행 중인 에디터 전체 화면 — 타일 팔레트가 정상 렌더되고 오른쪽 위에 검증 패널")}

<h2><span class="n">08</span>검증 결과</h2>
<table>
<tr><th>시트</th><th>커버리지</th><th>서로 다른 라벨</th><th>판정</th></tr>
<tr><td>retro_dungeon</td><td class="n">478 / 478</td><td class="n">410</td><td class="pass">PASS</td></tr>
<tr><td>retro_exterior</td><td class="n">478 / 478</td><td class="n">423</td><td class="pass">PASS</td></tr>
<tr><td>retro_house</td><td class="n">478 / 478</td><td class="n">431</td><td class="pass">PASS</td></tr>
<tr><td>retro_world</td><td class="n">480 / 480</td><td class="n">422</td><td class="pass">PASS</td></tr>
<tr><td>ship</td><td class="n">464 / 464</td><td class="n">387</td><td class="pass">PASS</td></tr>
<tr><td>world</td><td class="n">478 / 478</td><td class="n">415</td><td class="pass">PASS</td></tr>
</table>
<ul>
  <li><code>npm run typecheck:app</code> → <span class="pass">exit 0</span></li>
  <li>타일 의미 테스트 범위 <span class="pass">90 / 90</span></li>
  <li><code>apply-tile-verdicts</code> 집계에 <b>MISSING 0</b> — 출하 엔트리 집합과 판정 집합이 정확히 일치</li>
  <li>PR 9개 병합 · 열린 PR 0개 · <code>origin/main</code> 은 건드리지 않았다</li>
</ul>

<h2><span class="n">09</span>일부러 남긴 것</h2>
<p class="lede">숨기지 않고 적는다. 아래는 그림만으로 결정이 안 되는 칸이다.</p>
<table>
<tr><th>대상</th><th>상태</th></tr>
<tr><td><b>3칸</b> — <code>retro_world 296</code>, <code>ship 294</code>, <code>ship 430</code></td>
<td>물건은 판독자들이 합의했지만 role 이 갈린다. 그림만으로는 결정이 안 되고
제품 판단이 필요하다. <code>splits.txt</code></td></tr>
<tr><td><b>10칸</b></td><td>저신뢰라 승격 보류. <code>needs-human.txt</code></td></tr>
<tr><td>dev server (0.0.0.0:9999)</td>
<td>내가 띄운 게 아니다. playwright 가 <code>reuseExistingServer</code> 로 재사용했고
이 저장소엔 <code>dev:keep:detached</code> 상주 supervisor 가 따로 있다.
사용자 작업을 끊게 되므로 끄지 않았다.</td></tr>
</table>

<h2><span class="n">10</span>원인이 된 라우팅 규칙</h2>
<p><code>openwiki/agent-worktrees.md</code> 에 비전 능력 표를 넣고,
사고를 만든 모델을 이름으로 지목해 적었다.</p>
<table>
<tr><th>카테고리</th><th>1순위 모델</th><th>비전</th></tr>
<tr><td><code>visual-engineering</code> <code>artistry</code> <code>writing</code></td>
<td><code>cliproxy/gemini-3.7-flash-tiered</code></td><td class="good">있음</td></tr>
<tr><td><code>unspecified-low</code></td>
<td><code>cliproxy/deepseek-v4-flash-0731</code></td><td class="bad">없음</td></tr>
</table>
<p><b>규칙: 시각 판단 작업은 비전 있는 카테고리로 보낸다.</b></p>

<div class="foot">
증거 원본 · <code>.omo/evidence/tile-reaudit/</code> (PNG 524장, 16MB) ·
칸별 이력 <code>corrections.md</code> · 기준 대조표 <code>criteria.md</code> ·
판독 원문 <code>read/</code> · 고배율 크롭 <code>verified/</code><br>
브랜치 <code>agent/tile-reaudit</code> → <code>base/tile-reaudit</code> ·
최종 병합 <code>8cbcd78d984d028253f61e4f675662ecfbb201d2</code>
</div>

</div></body></html>`;

fs.writeFileSync(OUT, html, "utf8");
const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`${OUT}\n${mb} MB`);
