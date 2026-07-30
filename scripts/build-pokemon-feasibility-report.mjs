import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/USER/Downloads/rpg-zzu";
const read = (rel) => fs.readFileSync(path.join(root, rel));
const png = (b) => "data:image/png;base64," + b.toString("base64");
const jpg = (b) => "data:image/jpeg;base64," + b.toString("base64");

const I = {
  village:  png(read("little-tree-village-full.png")),
  village2: png(read("little-tree-village.png")),
  leafling: png(read("public/assets/generated/rm2k3/monster-leafling-01.png")),
  sparkit:  png(read("public/assets/generated/rm2k3/monster-sparkit-01.png")),
  aqualing: png(read("public/assets/generated/rm2k3/monster-aqualing-01.png")),
  slime:    png(read("public/assets/generated/rm2k3/monster-king-slime-01.png")),
  dragon:   png(read("public/assets/generated/rm2k3/monster-dragon-01.png")),
  bat:      png(read("public/assets/generated/rm2k3/monster-bat-01.png")),
  ghost:    png(read("public/assets/generated/rm2k3/monster-ghost-01.png")),
  golem:    png(read("public/assets/generated/rm2k3/monster-golem-01.png")),
  m1:       png(read("report-assets/Monster1-alpha.png")),
  m2:       png(read("report-assets/Monster2-alpha.png")),
  m3:       png(read("report-assets/Monster3-alpha.png")),
  animal:   png(read("report-assets/Animal-alpha.png")),
};

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RPG ZZU로 '포켓몬 레드' 수준? — 5에이전트 적대적 감사 (정정 v3)</title>
<style>
  :root{
    --bg:#0d0b10; --panel:#17131c; --panel2:#211a28; --line:#322a3d;
    --text:#f0eaf5; --muted:#a99fb5; --faint:#6a6178;
    --red:#ee5253; --amber:#ffb24a; --green:#5fd068; --accent:#9b59ff;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:"Pretendard","Malgun Gothic",sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1120px;margin:0 auto;padding:0 24px 140px}

  .hero{position:relative;height:360px;margin:0 -24px 0;overflow:hidden;border-bottom:4px solid var(--red)}
  .hero img.bg{width:100%;height:100%;object-fit:cover;image-rendering:pixelated;filter:brightness(.38) saturate(.8) hue-rotate(-15deg) grayscale(.3)}
  .hero .hero-text{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 24px;background:radial-gradient(ellipse at center,rgba(13,11,16,.2),rgba(13,11,16,.85))}
  .hero .warn{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--red);font-weight:800;margin-bottom:14px;border:1px solid var(--red);padding:4px 14px;border-radius:999px}
  .hero h1{font-size:42px;font-weight:900;letter-spacing:-1px;text-shadow:0 4px 28px rgba(0,0,0,.95)}
  .hero h1 em{font-style:normal;color:var(--red)}
  .hero p.sub{margin-top:14px;color:#e0d8ec;font-size:15.5px;max-width:680px;text-shadow:0 2px 10px rgba(0,0,0,.95)}
  .hero .meta{margin-top:18px;font-size:11.5px;color:var(--faint);letter-spacing:1px}

  .correction{background:linear-gradient(135deg,rgba(238,82,83,.12),rgba(255,178,74,.06));border:1px solid rgba(238,82,83,.4);border-left:5px solid var(--red);border-radius:12px;padding:24px 28px;margin:36px 0}
  .correction .h{font-weight:800;color:var(--red);font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px}
  .correction p{font-size:15px;margin-top:8px}
  .correction .strike{text-decoration:line-through;color:var(--faint)}

  .verdict{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:40px 0 8px}
  .v-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px 14px;text-align:center}
  .v-card .lane{font-size:11px;color:var(--faint);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
  .v-card .pct{font-size:38px;font-weight:900;line-height:1}
  .v-card .desc{margin-top:6px;color:var(--muted);font-size:11px}
  .p-low{color:var(--red)} .p-mid{color:var(--amber)} .p-ok{color:var(--green)}
  .v-card.cr{border-color:rgba(238,82,83,.5)}

  .summary-line{text-align:center;color:var(--muted);font-size:15px;margin:18px auto 8px;max-width:880px}
  .summary-line strong{color:var(--text)}

  .blurb{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:12px;padding:22px 26px;margin:40px 0;font-size:15px}
  .blurb .h{font-weight:800;color:var(--accent);font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px}

  section{margin-top:64px;scroll-margin-top:20px}
  .sec-head{display:flex;align-items:center;gap:14px;margin-bottom:8px}
  .sec-head .badge{font-size:22px;width:46px;height:46px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .b-red{background:rgba(238,82,83,.14);border:1px solid rgba(238,82,83,.4)}
  .b-amb{background:rgba(255,178,74,.12);border:1px solid rgba(255,178,74,.4)}
  .b-grn{background:rgba(95,208,104,.12);border:1px solid rgba(95,208,104,.4)}
  .sec-head h2{font-size:27px;font-weight:900;letter-spacing:-.5px}
  .sec-head .kicker{font-size:11px;color:var(--faint);font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .sec-desc{color:var(--muted);margin:0 0 24px 60px;font-size:14.5px;max-width:860px}

  .audit-box{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:24px;margin-bottom:18px}
  .audit-box .ab-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .audit-box .ab-head .agent{font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:var(--panel2);color:var(--accent);letter-spacing:.5px}
  .audit-box .ab-head .pct-badge{font-size:20px;font-weight:900;margin-left:auto}
  .audit-box h3{font-size:18px;font-weight:800}
  .audit-box .finding{margin:14px 0;padding:14px 16px;background:#120f17;border-left:3px solid var(--red);border-radius:0 8px 8px 0}
  .audit-box .finding.minor{border-left-color:var(--amber)}
  .audit-box .finding .f-h{font-weight:700;font-size:13.5px;margin-bottom:4px}
  .audit-box .finding .f-h .sev{font-size:10px;font-weight:800;padding:2px 7px;border-radius:4px;margin-left:8px;vertical-align:middle}
  .s-crit{background:rgba(238,82,83,.2);color:var(--red)} .s-maj{background:rgba(255,178,74,.18);color:var(--amber)} .s-min{background:rgba(95,208,104,.15);color:var(--green)}
  .audit-box .finding p{font-size:13px;color:#c8bed4;margin-top:4px}
  .audit-box .finding .ev{margin-top:8px;padding:9px 12px;background:#0c0a10;border-radius:6px;font-family:"Consolas",monospace;font-size:11.5px;color:#9ec77e;overflow-x:auto;white-space:pre}
  .audit-box .finding .ev .c{color:var(--faint)} .ev .k{color:#c792ea} .ev .s{color:#ffce3a}
  .audit-box .one-liner{margin-top:14px;padding:12px 16px;background:var(--panel2);border-radius:8px;font-size:13.5px;font-weight:600;color:var(--text)}
  .audit-box .one-liner .pct{font-weight:900}

  table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12.5px}
  th,td{padding:9px 11px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
  th{color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;font-weight:700}
  td .yes{color:var(--green);font-weight:700} td .no{color:var(--red);font-weight:700} td .part{color:var(--amber);font-weight:700}
  td .ev{font-family:"Consolas",monospace;font-size:10.5px;color:#9ec77e}

  .scoreboard{background:linear-gradient(135deg,#1a1422,#241a30);border:1px solid var(--line);border-radius:18px;padding:34px;margin:36px 0}
  .scoreboard .score-lbl{color:var(--muted);font-size:14px}
  .scoreboard .score{font-size:78px;font-weight:900;line-height:1;background:linear-gradient(90deg,var(--red),var(--amber));-webkit-background-clip:text;background-clip:text;color:transparent}
  .scoreboard .verdict-txt{font-size:16px;margin-top:16px;font-weight:600;line-height:1.6}
  .scoreboard .breakdown{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:22px}
  .scoreboard .bd{text-align:center;padding:12px 6px;background:var(--panel);border-radius:10px;border:1px solid var(--line)}
  .scoreboard .bd .b-n{font-size:22px;font-weight:800}
  .scoreboard .bd .b-l{font-size:10.5px;color:var(--faint);margin-top:3px}

  .fig{margin:14px 0 4px;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .fig img{width:100%;display:block;image-rendering:pixelated}
  .fig .cap{padding:10px 14px;font-size:12px;color:var(--faint);background:var(--panel)}

  .foot{margin-top:60px;padding-top:24px;border-top:1px solid var(--line);color:var(--faint);font-size:12px;line-height:1.7}

  @media(max-width:760px){
    .verdict{grid-template-columns:repeat(2,1fr)} .scoreboard .breakdown{grid-template-columns:repeat(3,1fr)}
    .hero h1{font-size:30px}
  }
</style>
</head>
<body>
<div class="hero">
  <img class="bg" src="${I.village}" alt="">
  <div class="hero-text">
    <div class="warn">⚠ 정정 리포트 v3 · 적대적 감사</div>
    <h1>RPG ZZU로 <em>'포켓몬 레드'</em> 수준?</h1>
    <p class="sub">5개 적대적 서브에이전트가 코드를 라인 단위로 뜯어본 결과 — 이전 리뷰(9.0/10)는 표면 읽기였다. 진실은: <b>RM2k3 엔진에 포켓몬 스킨을 씌운 것</b>이지, Gen 1 엔진이 아니다.</p>
    <div class="meta">5 에이전트 · 5레인 병렬 감사 · 코드 49K줄 · 2026-07-24</div>
  </div>
</div>

<div class="wrap">

  <div class="correction">
    <div class="h">정정 — 이전 리뷰가 틀렸다</div>
    <p><b>v1 (7.2/10):</b> 현대 포켓몬 기준으로 잡아 갭을 과대평가. <span class="strike">틀림</span></p>
    <p><b>v2 (9.0/10):</b> "레드 기준이면 거의 다 된다" — 이것이 <b>더 심하게 틀림</b>. 데미지 공식 자체가 RM2k3지 Gen1이 아닌데 "IV 0-15라 정확"이라며 표면 필드만 보고 "정확 재현"이라 결론내렸다. 5개 에이전트가 코드 라인 단위로 검증한 결과, 실제 Gen1 재현도는 <b>~20%</b>에 불과하다.</p>
    <p>무엇을 놓쳤는가: "필드가 존재한다"(captureRate, state_poison, statistic)를 "기능이 작동한다"로 착각. 실제로는 화상 공격반감·마비 속도1/4·빙결·혼란·반동·OHKO·다중히트·4회 흔들림·상태보너스·스탯단계·1/256미스 — <b>전부 코드에 없다</b>. 스킨 CSS가 포켓몬 색을 칠한다고 UX가 포켓몬이 되지 않는다.</p>
  </div>

  <!-- 5-lane verdict -->
  <div class="verdict">
    <div class="v-card cr">
      <div class="lane">배틀 수학</div>
      <div class="pct p-low">18%</div>
      <div class="desc">데미지 공식 RM2k3 · 급소 ×3 고정% · 스탯단계 없음</div>
    </div>
    <div class="v-card cr">
      <div class="lane">상태/기술</div>
      <div class="pct p-low">25%</div>
      <div class="desc">화상/마비/빙결/혼란/반동/OHKO 전부 부재</div>
    </div>
    <div class="v-card cr">
      <div class="lane">포획/종족</div>
      <div class="pct p-low">25%</div>
      <div class="desc">단발 확률, 흔들림 0, 상태보너스 無, 93/120 종족 클론</div>
    </div>
    <div class="v-card">
      <div class="lane">타입/세계</div>
      <div class="pct p-low">23%</div>
      <div class="desc">기본 3속성, PC 단일배열, HM필드기술/E4/체관 無</div>
    </div>
    <div class="v-card cr">
      <div class="lane">UX/연출</div>
      <div class="pct p-low">15%</div>
      <div class="desc">도감/요약/PC/센터 UI 無, 스킨은 색칠만</div>
    </div>
  </div>

  <p class="summary-line"><strong>종합 Gen 1 재현도: ~20%</strong> — 에디터는 "몬스터 잡는 RM2k3 JRPG 메이커"이지, "포켓몬 레드 엔진"이 아니다. 포획·진화·6파티+박스·타입상성 엔진은 있지만, <b>데미지 공식·상태효과·포획 정밀도·필드기술·UX가 전부 Gen1이 아닌 RM2k3</b>다. 스킨으로 포켓몬 색을 칠해도 인터랙션 모델은 RM2k3 그대로다.</p>

  <div class="blurb">
    <div class="h">왜 5개 에이전트인가</div>
    단일 리뷰어(나)는 "필드가 있다"→"된다"로 도약하는 확인편향에 빠졌다. 그래서 각 레인을 독립 에이전트에 맡겨 <b>코드 라인 인용까지 강제</b>했다. 5개 에이전트 전원이 같은 결론에 도달: <b>"이름/필드는 있으나 효과/정밀도는 RM2k3 또는 부재"</b>. 아래는 각 에이전트의 핵심 증거를 그대로 옮긴 것이다.
  </div>

  <!-- ===== LANE 1: BATTLE MATH ===== -->
  <section id="lane1">
    <div class="sec-head">
      <div class="badge b-red">①</div>
      <div><div class="kicker">Agent 1 · st_019f94e6</div><h2>배틀 수학 — 데미지 공식이 RM2k3다</h2></div>
    </div>
    <p class="sec-desc">가장 치명적인 발견. Gen1의 핵심 공식 <code>((2L/5+2)·Power·A/D)/50 + 2</code>가 <b>코드에 없다</b>. 대신 RM2k3 공식 <code>power + atk/2 - def/2</code>가 들어있다. "IV 0-15라 정확"이라던 v2 리뷰의 주장은 — IV가 맞다고 해서 공식이 Gen1이라는 뜻이 아니다.</p>
    <div class="fig"><img src="${I.dragon}" alt="" style="max-height:120px;width:auto;display:block;margin:0 auto;background:#15111c"><div class="cap">▲ 배틀 수학: 이 드래곤의 불꽃술 데미지가 Gen1 공식이 아니라 RM2k3 공식으로 계산된다.</div></div>

    <div class="audit-box">
      <div class="ab-head">
        <h3>CRITICAL · 데미지 공식 = RM2k3, NOT Gen1</h3>
        <span class="agent">battle-math</span>
        <span class="pct-badge p-low">15-20%</span>
      </div>
      <div class="finding">
        <div class="f-h">데미지 공식이 RM2k3다<span class="sev s-crit">CRITICAL</span></div>
        <p>Gen1: <code>Damage = (((2×Level/5 + 2) × Power × A/D) / 50) + 2</code>. 코드는:</p>
        <div class="ev"><span class="c">// src/battle/battleDamage.ts:64,82-83</span>
let magnitude = power + Math.floor(sourceStat / 2);   <span class="c">// L64</span>
magnitude -= Math.floor(effectiveDefense / 2);         <span class="c">// L82-83</span>
<span class="c">// = Power + Atk/2 - Def/2  ← 전형적 RM2k3 공식</span>
<span class="c">// Level 항이 아예 없다. ×Power×A/D도, /50도, +2도 없다.</span></div>
      </div>
      <div class="finding">
        <div class="f-h">급소: 속도비례 ×2가 아니라 고정% ×3<span class="sev s-crit">CRITICAL</span></div>
        <p>Gen1: crit율 = <code>⌊baseSpeed/2⌋/512</code> (속도 비례), 배율 ×2. 코드는 <code>criticalRate</code> 고정 % + 배율 기본값 <code>?? 3</code> (주석 "기본 3(RM2K3)"). 속도 항 無, ×2가 아니라 ×3.</p>
        <div class="ev"><span class="c">// battleDamage.ts:76-79</span>
<span class="k">const</span> critical = criticalRate > 0 && rng()*100 &lt; criticalRate;
<span class="k">if</span> (critical) magnitude = Math.round(magnitude * (spec.criticalMultiplier ?? <span class="s">3</span>));
<span class="c">// runtime.ts criticalRateFor: 100/denominator — baseSpeed 無, /512 無</span></div>
      </div>
      <div class="finding">
        <div class="f-h">스탯 단계(-6..+6) 시스템 자체가 없다<span class="sev s-crit">CRITICAL</span></div>
        <p>Gen1: Atk/Def/Spd/Special에 -6~+6 단계, +1=×1.5, -1=×0.66. grep <code>statStage|stage|raiseStat</code> → <b>0건</b>. 대신 flat 상태효과 <code>state_attack_up → ×2</code> (누적 안 됨, set 의미론). "검의춤 +2"에 해당하는 것이 없다.</p>
        <div class="ev"><span class="c">// battleStates.ts:73,80 — 유일한 스탯 수정</span>
<span class="k">if</span> (stateId === <span class="s">"state_attack_up"</span>) <span class="k">return</span> 2;    <span class="c">// flat ×2, 누적 불가</span>
<span class="k">if</span> (stateId === <span class="s">"state_defense_down"</span>) <span class="k">return</span> 0.5; <span class="c">// flat ×0.5</span>
<span class="c">// 단계 카운터 無, ±6 clamp 無, ×1.5/×0.66 테이블 無</span></div>
      </div>
      <div class="finding">
        <div class="f-h">특수(Special) 스탯이 잘못 연결됨<span class="sev s-crit">CRITICAL</span></div>
        <p>Gen1: 단일 "Special"이 특수공격+특수방어 겸용. 코드는 <code>mind</code>가 특수공격에만 쓰이고, 특수기술 방어는 <b>물리 Defense로</b> 들어간다. 어느 쪽 reference보다도 잘못됨.</p>
        <div class="ev"><span class="c">// battleDamage.ts:30,82</span>
baseStat = spec.statistic === <span class="s">"mind"</span> ? user.mind : user.attackPower; <span class="c">// mind=특공 only</span>
effectiveDefense = target.defense * (...);  <span class="c">// 특수기도 물리 방어로 감산 — 잘못 연결</span></div>
      </div>
      <div class="finding minor">
        <div class="f-h">1/256 미스 버그 無 · 분산이 대칭형<span class="sev s-maj">MAJOR</span></div>
        <p>Gen1: 100% 명중도 1/256 확률 미스. 코드는 <code>hitRate=100</code>이면 절대 빗나가지 않음. 분산은 Gen1의 비대칭 0.85~1.00이 아니라 대칭 ±% (기본 0=고정).</p>
      </div>
      <div class="finding minor">
        <div class="f-h">STAB 1.5× — 유일한 정확 매치<span class="sev s-min">MATCH</span></div>
        <p><code>typeChart.ts:21</code> <code>attackerTypes.includes(attackType) ? 1.5 : 1</code>. 정확. 하지만 이것만 맞다고 배틀이 Gen1이 되지 않는다.</p>
      </div>
      <div class="one-liner">Gen1 배틀 수학 실제 구현도: <span class="pct p-low">~18%</span> — STAB 1.5× 정확 + 턴순서 부분 매치. 나머지 4개 핵심(공식·급소·스탯단계·명중)은 RM2k3 또는 부재.</div>
    </div>
  </section>

  <!-- ===== LANE 2: STATUS/MOVES ===== -->
  <section id="lane2">
    <div class="sec-head">
      <div class="badge b-red">②</div>
      <div><div class="kicker">Agent 2 · st_019f94e7</div><h2>상태이상 & 기술효과 — 5종 중 2종만, 효과도 다르다</h2></div>
    </div>
    <p class="sec-desc">"state_poison이 있다"고 해서 "독이 Gen1처럼 작동한다"가 아니다. 실제로: 화상·마비·빙결·혼란·반동·OHKO·다중히트·고정데미지 — <b>전부 스키마에도 코드에도 없다</b>. 독은 1/16이 아니라 ~6%이고, 수면은 1-7 카운터가 아니라 35% 확률 롤이다.</p>

    <div class="audit-box">
      <div class="ab-head">
        <h3>Gen1 상태 5종 + 기술효과 8카테고리 감사</h3>
        <span class="agent">status-moves</span>
        <span class="pct-badge p-low">25%</span>
      </div>
      <table>
        <thead><tr><th>Gen1 요소</th><th>상태</th><th>증거</th></tr></thead>
        <tbody>
          <tr><td>독 (1/16 HP/턴 + 필드 유지)</td><td><span class="part">효과 있으나 다름</span></td><td><span class="ev">battleStates.ts:176 — 6% floor, 1/16(6.25%) 아님. 필드 유지는 ✓</span></td></tr>
          <tr><td>화상 (1/16 HP + <b>공격 절반</b>)</td><td><span class="no">MISSING</span></td><td><span class="ev">state_burn 레코드 無, 공격 반감 로직 無</span></td></tr>
          <tr><td>마비 (<b>속도 ×1/4</b> + 25% 행동불가)</td><td><span class="no">MISSING</span></td><td><span class="ev">StateRuntimeEffects에 speedMultiplier 無; canBattlerAct 이진값</span></td></tr>
          <tr><td>빙결 (행동불가 + 10% 해빙, 불로만)</td><td><span class="no">MISSING</span></td><td><span class="ev">state_freeze 無, 해빙 확률 無, 속성 해빙 無</span></td></tr>
          <tr><td>수면 (1-7 턴 카운터)</td><td><span class="part">다름</span></td><td><span class="ev">35% 확률 롤 (turn 2부터), 1-7 카운터 아님</span></td></tr>
          <tr><td>혼란 (50% 자신피해, 1-4턴)</td><td><span class="no">MISSING</span></td><td><span class="ev">아이콘 클래스만, 자신피해/턴카운터 無</span></td></tr>
          <tr><td>스탯 단계 -6..+6</td><td><span class="no">MISSING</span></td><td><span class="ev">flat ×2/×0.5 비누적. ±6 clamp 無</span></td></tr>
          <tr><td>반동 (Take Down)</td><td><span class="no">MISSING</span></td><td><span class="ev">SkillRecord에 recoil 필드 無</span></td></tr>
          <tr><td>다중히트 (Twineedle)</td><td><span class="no">MISSING</span></td><td><span class="ev">hits/strikeCount 필드 無</span></td></tr>
          <tr><td>OHKO (Fissure/Horn Drill)</td><td><span class="no">MISSING</span></td><td><span class="ev">ohko 필드 無, 속도 비교 無</span></td></tr>
          <tr><td>고정데미지 (Seismic Toss)</td><td><span class="no">MISSING</span></td><td><span class="ev">fixedDamage 필드 無</span></td></tr>
          <tr><td>회복 (Recover)</td><td><span class="yes">구현</span></td><td><span class="ev">skill_heal 존재</span></td></tr>
        </tbody>
      </table>
      <div class="one-liner">Gen1 상태/기술효과 실제 기능율: <span class="pct p-low">~25%</span> (16개 중 4개). 그 4개 중 3개(독 6%·수면 확률·버프 flat)는 Gen1 의미론에서 벗어남. 스펙 충실도는 사실상 0%에 가깝다.</div>
    </div>
  </section>

  <!-- ===== LANE 3: CAPTURE/SPECIES ===== -->
  <section id="lane3">
    <div class="sec-head">
      <div class="badge b-red">③</div>
      <div><div class="kicker">Agent 3 · st_019f94e8</div><h2>포획 & 종족 — 단발 확률, 흔들림 無, 종족은 클론</h2></div>
    </div>
    <p class="sec-desc">"포획이 완전 구현됐다"던 v1/v2 리뷰의 주장이 가장 심하게 틀린 부분. 실제 포획 공식은 Gen1의 <code>(3M-2H)·catchRate·ball·status / 3M</code>가 아니라 <code>catchRate×(1-hp/maxHp×0.7)×itemMult</code> — 단발 Bernoulli, 흔들림 0회, 상태보너스 無. "수면으로 잡기"라는 Gen1 핵심 전략이 구조적으로 불가능하다.</p>
    <div class="fig"><div style="display:flex;gap:16px;justify-content:center;padding:16px;background:#15111c"><img src="${I.leafling}" style="height:90px;image-rendering:pixelated"><img src="${I.sparkit}" style="height:90px;image-rendering:pixelated"><img src="${I.aqualing}" style="height:90px;image-rendering:pixelated"></div><div class="cap">▲ 기본 3종 스타터. 잡을 순 있지만 — 잡는 공식이 Gen1이 아니다 (흔들림 無, 수면 보너스 無).</div></div>

    <div class="audit-box">
      <div class="ab-head">
        <h3>포획 공식 & 종족 데이터 깊이</h3>
        <span class="agent">capture-species</span>
        <span class="pct-badge p-low">25%</span>
      </div>
      <div class="finding">
        <div class="f-h">포획 공식이 단순화됨 — 흔들림 0, 상태보너스 無<span class="sev s-crit">CRITICAL</span></div>
        <div class="ev"><span class="c">// monsterCollection.ts:135-144</span>
<span class="k">return</span> clamp(captureRate * (1 - hpRatio*0.7) * itemMultiplier, 0, 1);
<span class="c">// runtime.ts:943 — 단일 if (roll >= rate) 실패. 흔들림 0회, 상태 매개변수 無</span>
<span class="c">// Gen1: ((3M-2H)·catchRate·ball·status)/3M + 4회 흔들림 검사</span>
<span class="c">// 수면×2 배율(=Gen1 핵심 전략)이 구조적으로 불가능</span></div>
      </div>
      <div class="finding">
        <div class="f-h">catchRate 0-1 (Gen1은 0-255)<span class="sev s-crit">CRITICAL</span></div>
        <p><code>clampNumber(record.captureRate ?? 0.3, 0, 1)</code>. Gen1은 전설 3~일반 190 (0-255 스케일). 뮤츠(3)와 구구(190)를 이 스케일로 표현 불가.</p>
      </div>
      <div class="finding">
        <div class="f-h">120종이 "제공됨"이나 ~93종은 절차적 클론<span class="sev s-maj">MAJOR</span></div>
        <p><code>defaultDatabaseBattleRecords.ts:1105</code>가 ~120종 반환하지만, <code>species_extra_010~066</code>은 <b>전부 types:["grass"]</b>, 동일 2-기술 배움셋, <code>maxHp=30+rank×10</code> 공식. "151종" 카운트는 외형; 종별 깊이는 스텁.</p>
      </div>
      <div class="finding">
        <div class="f-h">4-기술 슬롯 하드리밋 無<span class="sev s-maj">MAJOR</span></div>
        <p><code>MonsterInstance.skillIds</code>가 무한 배열. <code>mergeSkillIds</code>는 중복 제거만, 절단 無. 레벨업으로 배운 기술이 무한히 누적 — "5번째 배울 때 하나 잊기"가 없다. Gen1의 하드 룰 위반.</p>
      </div>
      <div class="finding">
        <div class="f-h">교환 진화 無 · TM/HM 호환 無 · 성장그룹 無<span class="sev s-maj">MAJOR</span></div>
        <p><code>MonsterEvolutionRequirement = {level?, itemId?, friendshipAtLeast?}</code> — <code>trade</code> 트리거 無 (repo 전체 grep 0건). Haunter→Gengar 등 교환진화 불가. <code>tmCompat</code>/<code>hmCompat</code> 필드 無. 5개 성장그룹(Fast/MedFast/MedSlow/Slow/Fluctuating) 대신 다항식 <code>expCurve</code>.</p>
      </div>
      <div class="one-liner">Gen1 포획+종족 실제 구현도: <span class="pct p-low">~25%</span> — 형태(필드 존재)는 맞으나 의미론(공식·스케일·깊이)이 전부 Gen1이 아님.</div>
    </div>
  </section>

  <!-- ===== LANE 4: TYPECHART/WORLD ===== -->
  <section id="lane4">
    <div class="sec-head">
      <div class="badge b-red">④</div>
      <div><div class="kicker">Agent 4 · st_019f94e9</div><h2>타입 차트 & 세계 규모 — 엔진은 제너릭, 데이터는 3속성</h2></div>
    </div>
    <p class="sec-desc">타입 차트 <b>엔진</b>은 이중타입 곱·STAB·명시적 0× 면역을 올바르게 처리한다. 그러나 <b>제공되는 차트는 3속성(fire/water/grass) 3×3</b>이고 Gen1 값이 0개. 15속성 225엔트리를 저자가 손으로 채워야 한다. 세계 층은 더 심각: PC가 단일 배열(12박스 無), HM 필드기술 無, 사왕+챔피언 연전 無, 체관 無가 전부 <b>스키마 수준에서 부재</b>다.</p>
    <div class="fig"><img src="${I.village2}" alt=""><div class="cap">▲ 마을 저작은 에디터 강점. 그러나 체관 구조·HM 필드기술·다중박스 PC를 표현할 코드 구조가 없다.</div></div>

    <div class="audit-box">
      <div class="ab-head">
        <h3>타입 차트 충실도 + 세계 규모</h3>
        <span class="agent">typechart-world</span>
        <span class="pct-badge p-low">23%</span>
      </div>
      <div class="finding">
        <div class="f-h">기본 타입 차트 = 3속성, Gen1 값 0개<span class="sev s-crit">CRITICAL</span></div>
        <p>엔진은 임의 N×N 지원. 그러나 <code>defaultDatabase.ts:79</code> 기본 = <code>types:["fire","water","grass"]</code> 3×3, 면역(0) 엔트리 0개. 15속성 + 225 매트릭스(고스트/에스퍼 0× 버그 포함)를 <b>저자가 전부 손작업</b>해야 함. 프리셋/생성기 無.</p>
      </div>
      <div class="finding">
        <div class="f-h">PC = 단일 배열, 12박스 無<span class="sev s-crit">CRITICAL (구조적)</span></div>
        <div class="ev"><span class="c">// session.ts:138</span>
monsterBox: MonsterInstanceId[]  <span class="c">// 단일 flat 배열</span>
<span class="c">// moveMonster: "party" ↔ "box"(1개)만. boxIndex/boxes[]/currentBox 無</span>
<span class="c">// Gen1: 12박스 × 20 = 240 보관. 여기는 1배열.</span></div>
      </div>
      <div class="finding">
        <div class="f-h">HM 필드기술 無 — Surf/Cut/Strength/Flash 불가<span class="sev s-crit">CRITICAL</span></div>
        <p><code>SkillRecord</code>에 <code>fieldUse</code>/<code>hmMove</code> 필드 無. <code>partyHasSkill</code> 이벤트 조건 無. 물 타일 통행·나무 베기·바위 밀기·동굴 조명 — <b>필드 인터랙션 코드가 전혀 없다</b>. 배틀 기술로만 존재.</p>
      </div>
      <div class="finding">
        <div class="f-h">사왕+챔피언 연전 구조 無 · 체관 無 · 라이벌 無<span class="sev s-crit">CRITICAL</span></div>
        <p><code>TroopRecord</code>는 단일 전투. <code>chainBattle</code>/<code>preserveHp</code>/<code>noHealBetween</code> 無. <code>gymLeader</code>/<code>badge</code> 구조 無. <code>rival</code> 無. <code>eliteFour</code> 無. — 이것들은 "미저작 데이터"가 아니라 <b>표현할 코드 구조 자체가 없다</b>.</p>
      </div>
      <div class="finding minor">
        <div class="f-h">이중타입 곱·STAB·명시적 0× — 엔진은 정확<span class="sev s-min">MATCH (엔진만)</span></div>
        <p><code>typeChart.ts:20-27</code> — 방어 타입별 reduce 곱, STAB 1.5, 명시적 0은 <code>product × 0</code>으로 처리. 단 누락 엔트리는 1×로 묵시 처리(0× 아님). 엔진 능력은 ~85%, 제공 데이터는 ~20%.</p>
      </div>
      <div class="one-liner">타입 차트 충실도 <span class="pct p-mid">~35%</span> · 세계 규모 <span class="pct p-low">~12%</span> — 엔진은 제너릭이나 제공 데이터는 3속성; 세계 구조(다중박스/HM/E4/체관)는 스키마 수준 부재.</div>
    </div>
  </section>

  <!-- ===== LANE 5: UX ===== -->
  <section id="lane5">
    <div class="sec-head">
      <div class="badge b-red">⑤</div>
      <div><div class="kicker">Agent 5 · st_019f94ea</div><h2>UX/연출 — RM2k3에 포켓몬 색 칠한 것</h2></div>
    </div>
    <p class="sec-desc">"battleUiStyle:'pokemon' 스킨이 있다"고 해서 UX가 포켓몬이 되지 않는다. 스킨은 색을 칠하고 패널을 재배치할 뿐, <b>MP 바·ATB 게이지를 숨기지도, EXP 바를 추가하지도, 명령 그리드를 FIGHT/ITEM/PKMN/RUN으로 재매핑하지도 않는다</b>. 도감·요약·PC·센터 UI는 전부 없다.</p>
    <div class="fig"><div style="display:flex;gap:12px;justify-content:center;padding:16px;background:#15111c;flex-wrap:wrap"><img src="${I.ghost}" style="height:72px;image-rendering:pixelated"><img src="${I.golem}" style="height:72px;image-rendering:pixelated"><img src="${I.bat}" style="height:72px;image-rendering:pixelated"><img src="${I.slime}" style="height:72px;image-rendering:pixelated"><img src="${I.m1}" style="height:72px;image-rendering:pixelated"><img src="${I.m2}" style="height:72px;image-rendering:pixelated"></div><div class="cap">▲ 스프라이트는 있으나 — 도감으로 볼 화면·요약 페이지·PC 박스 UI가 전부 없다. 스킨은 색칠만.</div></div>

    <div class="audit-box">
      <div class="ab-head">
        <h3>Gen1 UX 감정 delivered</h3>
        <span class="agent">ux-metagame</span>
        <span class="pct-badge p-low">15%</span>
      </div>
      <table>
        <thead><tr><th>Gen1 UX 요소</th><th>상태</th><th>증거</th></tr></thead>
        <tbody>
          <tr><td>포켓몬스터 도감 UI</td><td><span class="no">MISSING</span></td><td><span class="ev">pokedex/dex grep 0건. 데이터만 있고 화면 無</span></td></tr>
          <tr><td>몬스터 요약 페이지</td><td><span class="no">MISSING</span></td><td><span class="ev">playerStatusMenuDetails.ts:258 — 리스트만, 드릴다운 無, PP/EXP 바 無</span></td></tr>
          <tr><td>PC 박스 UI (Bill's PC)</td><td><span class="no">MISSING</span></td><td><span class="ev">단일 배열, 박스 그리드 無, release 기능 無</span></td></tr>
          <tr><td>포켓몬 센터</td><td><span class="no">MISSING</span></td><td><span class="ev">여관NPC만 있음, 간호사/PC/교환클럽 無</span></td></tr>
          <tr><td>데이케어</td><td><span class="no">MISSING</span></td><td><span class="ev">daycare grep 0건</span></td></tr>
          <tr><td>자전거/달리기</td><td><span class="no">MISSING</span></td><td><span class="ev">bike/runningShoes grep 0건</span></td></tr>
          <tr><td>포획 시 별명 입력</td><td><span class="no">MISSING</span></td><td><span class="ev">giveMonster는 nickname param 있으나 런타임 포획에서 호출 無</span></td></tr>
          <tr><td>교환/링크케이블</td><td><span class="no">MISSING</span></td><td><span class="ev">trade grep 0건</span></td></tr>
          <tr><td>배틀 UI (FIGHT/ITEM/PKMN/RUN)</td><td><span class="part">RM2k3 스킨</span></td><td><span class="ev">_pokemon.css는 색칠만; MP/ATB 바 숨김 無, EXP 바 無, PP 無</span></td></tr>
          <tr><td>HP 바 색 변화</td><td><span class="yes">정확</span></td><td><span class="ev">battleFieldDom.ts:527 — green>50%/yellow 21-50%/red≤20%</span></td></tr>
          <tr><td>"야생의 X 나타났다!"</td><td><span class="yes">있음</span></td><td><span class="ev">battleDirectorDom.ts:37</span></td></tr>
          <tr><td>"가라 X!" / "X 기절!" / "레벨업!"</td><td><span class="no">MISSING</span></td><td><span class="ev">전부 grep 0건. 기절은 아이콘만, 몬스터 레벨업은 조용히</span></td></tr>
        </tbody>
      </table>
      <div class="one-liner">Gen1 UX 체감 전달도: <span class="pct p-low">~15%</span> — HP 바 색 + 포획 연출 + "야생의 X" + 6파티 + Red 레이아웃(데이터 뒷받침 無). 나머지 85%는 RM2k3 메커닉에 포켓몬 색 칠한 것.</div>
    </div>
  </section>

  <!-- ===== SCOREBOARD ===== -->
  <div class="scoreboard">
    <div class="score-lbl">최종 평점 (포켓몬 레드 Gen1 재현도) — 5에이전트 검증 기준</div>
    <div class="score">2.5 / 10</div>
    <div class="verdict-txt">RPG ZZU는 "포켓몬 레드 엔진"이 아니다. <b>"몬스터 잡는 RM2k3 JRPG 메이커"</b>다. 포획·진화·6파티·타입상성 엔진은 있으나 — 데미지 공식·상태효과·포획 정밀도·필드기술·UX가 <b>전부 Gen1이 아니라 RM2k3</b>다. 스킨 CSS로 포켓몬 색을 칠해도 인터랙션 모델은 RM2k3 그대로.<br><br>v1(7.2점)·v2(9.0점) 리뷰 모두 표면 읽기였다 — "필드가 존재한다"를 "기능이 작동한다"로 착각했다.</div>
    <div class="breakdown">
      <div class="bd"><div class="b-n p-low">18%</div><div class="b-l">배틀 수학</div></div>
      <div class="bd"><div class="b-n p-low">25%</div><div class="b-l">상태/기술</div></div>
      <div class="bd"><div class="b-n p-low">25%</div><div class="b-l">포획/종족</div></div>
      <div class="bd"><div class="b-n p-low">23%</div><div class="b-l">타입/세계</div></div>
      <div class="bd"><div class="b-n p-low">15%</div><div class="b-l">UX/연출</div></div>
    </div>
  </div>

  <div class="foot">
    <b>검증 방법:</b> 5개 적대적 서브에이전트(ultrabrain 카테고리) 병렬 실행, 각각 코드 라인 인용 강제. 대상 파일: <code>src/battle/battleDamage.ts</code>·<code>runtime.ts</code>·<code>typeChart.ts</code>·<code>battleBattlers.ts</code>·<code>battleStates.ts</code>·<code>monsterCollection.ts</code>·<code>types/database.ts</code>·<code>session.ts</code>·<code>defaultDatabaseBattleRecords.ts</code>·<code>player/battleFieldDom.ts</code>·<code>_pokemon.css</code> 등.<br>
    <b>이전 리뷰 정정:</b> v1(7.2)은 현대 포켓몬 기준 오류, v2(9.0)는 "필드 존재"를 "기능 작동"으로 착각한 확인편향. v3(2.5)는 라인 단위 코드 검증 기준.<br>
    <b>결론 한 줄:</b> "포켓몬 레드 비슷한 무언가"는 만들 수 있다. <b>"포켓몬 레드 수준"은 아니다.</b> 데미지 공식·상태효과·포획 정밀도·HM필드기술·PC 다중박스·도감 UI를 엔진 코드부터 고쳐야 Gen1에 근접한다 — 에디터 저작만으로는 불가능하다.
  </div>

</div>
</body>
</html>`;

const out = path.join(root, "pokemon-feasibility-review.html");
fs.writeFileSync(out, html, "utf8");
const sizeKB = Math.round(Buffer.byteLength(html) / 1024);
console.log("WROTE", out);
console.log("Size:", sizeKB, "KB");
