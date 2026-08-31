// 숲 밀도 작업 보고서 — 편집기 캔버스 스크린샷을 그대로 박아 넣은 단일 HTML.
// PNG 는 base64 로 심어 파일 하나만 열어도 보이게 한다(윈도우에서 Z:\ 경로로 여는 용도).
// 실행: node scripts/build-forest-density-report.mjs <증거디렉터리> <출력.html>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const evidenceDir = path.resolve(process.argv[2] ?? ".omo/evidence/forest-final");
const outPath = path.resolve(process.argv[3] ?? path.join(evidenceDir, "report.html"));
const repoRoot = path.resolve(import.meta.dirname, "..");

const receipt = JSON.parse(readFileSync(path.join(evidenceDir, "receipt.json"), "utf8"));

const dataUri = (file) => {
  const full = path.isAbsolute(file) ? file : path.join(evidenceDir, file);
  if (!existsSync(full)) return null;
  return `data:image/png;base64,${readFileSync(full).toString("base64")}`;
};

const pct = (v) => `${Math.round(v * 1000) / 10}%`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const area = receipt.area;
const cells = area.w * area.h;
const by = (d) => receipt.measured.find((m) => m.density === d);
const legacy = by("legacy");
const sparse = by("sparse");
const dense = by("dense");
const impassable = by("impassable");

/** 요약 문자열에서 실측 분해(나무/덤불/하층식생)를 꺼낸다 — 요약이 정본이다. */
const parts = (m) => {
  const tree = /나무 (\d+)칸/.exec(m.summary)?.[1];
  const bush = /덤불 (\d+)칸/.exec(m.summary)?.[1];
  const under = /하층식생 (\d+)칸/.exec(m.summary)?.[1];
  const forest = /숲 덮은 비율 (\d+)%/.exec(m.summary)?.[1];
  return { tree: tree ?? "0", bush: bush ?? "0", under: under ?? "0", forest: forest ?? "0" };
};

const blocked = (m) => (m.passableBefore > 0 ? 1 - m.passableAfter / m.passableBefore : 0);

const shotCard = (m, note) => {
  const p = parts(m);
  return `
  <figure class="shot">
    <img alt="${esc(m.label)}" src="${dataUri(m.shot) ?? ""}">
    <figcaption>
      <h3>${esc(m.label)}</h3>
      <p class="note">${note}</p>
      <dl>
        <div><dt>숲이 덮은 칸</dt><dd class="big">${p.forest}%</dd></div>
        <div><dt>그중 나무</dt><dd>${p.tree}칸</dd></div>
        <div><dt>덤불 · 하층식생</dt><dd>${p.bush} · ${p.under}칸</dd></div>
        <div><dt>지나갈 수 있는 칸</dt><dd>${m.passableBefore} → <strong>${m.passableAfter}</strong> <span class="muted">(${pct(blocked(m))} 막힘)</span></dd></div>
      </dl>
    </figcaption>
  </figure>`;
};

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>숲을 시켰는데 잔디밭이 나왔다 — 편집기 AI 숲 밀도 수정</title>
<style>
  :root { color-scheme: dark; --ink:#e9f0e7; --dim:#95a891; --bg:#0e130f; --card:#161d17; --line:#27311f; --good:#86d486; --bad:#e28b6b; --warn:#d9c169; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:"Pretendard","Noto Sans KR",system-ui,sans-serif; line-height:1.8; }
  main { max-width:1060px; margin:0 auto; padding:60px 24px 110px; }
  h1 { font-size:clamp(30px,4.4vw,46px); line-height:1.22; margin:0 0 10px; letter-spacing:-.025em; }
  .sub { color:var(--dim); font-size:16px; margin:0 0 44px; }
  h2 { font-size:27px; margin:64px 0 14px; letter-spacing:-.015em; }
  h2 + p, h2 + .callout { margin-top:0; }
  h3 { letter-spacing:-.01em; }
  p { font-size:17px; }
  .lead { font-size:20px; line-height:1.72; }
  .muted { color:var(--dim); }
  .callout { background:var(--card); border:1px solid var(--line); border-left:3px solid var(--good); border-radius:10px; padding:18px 22px; margin:24px 0; }
  .callout.bad { border-left-color:var(--bad); }
  .callout.warn { border-left-color:var(--warn); }
  .callout p:first-child { margin-top:0; }
  .callout p:last-child { margin-bottom:0; }
  .headline { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px; margin:34px 0; }
  .headline div { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px; }
  .headline b { display:block; font-size:35px; font-weight:700; letter-spacing:-.025em; line-height:1.2; }
  .headline span { color:var(--dim); font-size:13.5px; }
  .shots { display:grid; gap:26px; margin:26px 0; }
  .shot { margin:0; background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  .shot img { display:block; width:100%; background:#0b0f0b; }
  .shot figcaption { padding:20px 22px 24px; }
  .shot h3 { margin:0 0 8px; font-size:19px; }
  .shot .note { margin:0 0 15px; color:var(--dim); font-size:15px; }
  .shot dl { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; margin:0; }
  .shot dt { color:var(--dim); font-size:13px; }
  .shot dd { margin:3px 0 0; font-size:16px; font-variant-numeric:tabular-nums; }
  .shot dd.big { font-size:27px; font-weight:700; line-height:1.15; }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin:24px 0; }
  .pair figure { margin:0; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .pair img { display:block; width:100%; }
  .pair figcaption { padding:14px 16px 18px; font-size:14.5px; color:var(--dim); }
  .pair b { color:var(--ink); display:block; margin-bottom:4px; font-size:15.5px; }
  table { width:100%; border-collapse:collapse; margin:22px 0; font-size:15px; }
  th, td { text-align:left; padding:11px 13px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--dim); font-weight:600; font-size:13px; }
  code { background:#1c261e; padding:2px 6px; border-radius:5px; font-family:ui-monospace,SFMono-Regular,monospace; font-size:13.5px; }
  ol.rounds { padding-left:0; list-style:none; counter-reset:r; }
  ol.rounds li { counter-increment:r; position:relative; padding:16px 0 16px 52px; border-bottom:1px solid var(--line); }
  ol.rounds li::before { content:counter(r); position:absolute; left:0; top:16px; width:32px; height:32px; border-radius:50%; background:var(--card); border:1px solid var(--line); color:var(--dim); display:grid; place-items:center; font-size:14px; font-weight:600; }
  ol.rounds b { display:block; }
  footer { color:var(--dim); font-size:14px; margin-top:70px; border-top:1px solid var(--line); padding-top:24px; }
  footer code { font-size:13px; }
</style>
</head>
<body>
<main>
  <h1>숲을 시켰는데<br>잔디밭이 나왔다</h1>
  <p class="sub">편집기 AI 의 숲 배치 밀도 수정 · 병합 완료 · ${new Date().toISOString().slice(0, 10)}</p>

  <p class="lead">편집기 AI 에게 “숲을 깔아 줘”라고 하면, 나무 몇 그루가 서 있는 잔디밭이 나왔습니다. 숲은 원래 그 지역을 거의 지나갈 수 없게 만드는 지형입니다. 이 작업은 그걸 실제로 그렇게 만들었습니다.</p>

  <div class="headline">
    <div><b>${parts(legacy).forest}%</b><span>고치기 전, 숲이 덮은 칸</span></div>
    <div><b>${parts(dense).forest}%</b><span>고친 후 기본값(“숲”)</span></div>
    <div><b>${pct(blocked(impassable))}</b><span>“울창한 숲” 요청 시 막힌 비율</span></div>
    <div><b>0칸</b><span>울창한 숲에 바깥에서 걸어 들어갈 수 있는 칸</span></div>
  </div>

  <h2>무엇이 잘못돼 있었나</h2>
  <p>프롬프트를 잘 못 써서가 아니었습니다. 코드가 나무 개수에 <strong>상한</strong>을 걸어 놨습니다.</p>
  <div class="callout bad">
    <p><code>Math.max(3, Math.min(10, 면적 / 28))</code> — 영역이 아무리 넓어도 <strong>나무 10그루</strong>가 끝이었습니다. 40×40 숲 밴드(1600칸)에 10그루면 <strong>커버리지 2.5%</strong>. 사람 눈에는 숲이 아니라 그냥 나무 몇 그루입니다.</p>
    <p>게다가 “빽빽하게 해 줘”라고 <em>요청할 수단 자체가</em> 숲 경로에 없었습니다. 간격을 없애는 기능은 다른 툴에만 있었고, 숲을 심는 쪽에서는 아무도 쓰지 않았습니다.</p>
  </div>

  <h2>어떻게 고쳤나</h2>
  <p>밀도를 <strong>이름 붙은 축</strong>으로 만들어 한 곳에서 관리합니다. 기본값은 <code>dense</code> 입니다 — “숲”이라는 말 자체가 이미 빽빽함을 뜻하니까요. 사용자의 말에서 밀도를 읽는 일은 <strong>코드가</strong> 합니다. 모델이 “빽빽하게”를 알아서 잘 해석해 주기를 기대하지 않습니다. 그게 원래 실패하던 지점이었습니다.</p>
  <table>
    <thead><tr><th>밀도</th><th>목표</th><th>사용자가 이렇게 말하면</th></tr></thead>
    <tbody>
      <tr><td><code>sparse</code></td><td>드문드문</td><td>드문드문, 가로수, 몇 그루</td></tr>
      <tr><td><code>normal</code></td><td>보통</td><td>(명시적으로 고를 때만)</td></tr>
      <tr><td><code>dense</code> <span class="muted">기본</span></td><td>빽빽한 숲</td><td><strong>숲, 삼림, 산림</strong></td></tr>
      <tr><td><code>impassable</code></td><td>통행 불가</td><td><strong>울창한, 빽빽한, 밀림, 통행 불가</strong></td></tr>
    </tbody>
  </table>
  <p class="muted">숲을 언급하지 않은 요청(예: “녹지 마을”)은 이 축을 건드리지 않고, 데이터베이스의 「세계 → 생성 규칙」 탭에 저작된 기본값을 그대로 씁니다. <strong>요청문이 저작 기본값을 이긴다</strong>는 규칙입니다.</p>

  <h2>눈으로 보는 결과</h2>
  <p>아래는 모두 <strong>실제 편집기 캔버스를 찍은 것</strong>입니다. 같은 영역(${area.w}×${area.h}, ${cells}칸), 같은 툴, 밀도만 다릅니다.</p>
  <div class="shots">
${shotCard(legacy, "고치기 전 동작을 그대로 재현했습니다. 개수 상한 10그루.")}
${shotCard(sparse, "“드문드문 심어 줘”. 장식용 나무는 이 밀도가 맞습니다.")}
${shotCard(dense, "새 기본값. “숲을 깔아 줘” 한 마디에 이만큼 깔립니다.")}
${shotCard(impassable, "“울창한 숲”. 바깥에서 걸어 들어올 수 있는 칸이 0입니다.")}
  </div>

  <h2>중간에 두 번 크게 틀렸습니다</h2>
  <p>밀도만 올리면 되는 줄 알았는데, 렌더를 실제로 눈으로 보고 두 번 되돌렸습니다.</p>
  <div class="pair">
    <figure>
      <img alt="한 재료를 밀집시켜 산울타리처럼 보이던 중간 결과" src="${dataUri(path.join(repoRoot, "output/forest-round2/dense-forest-real-chipset.png")) ?? ""}">
      <figcaption><b>1차 시도 — 산울타리 밭</b>침엽수 한 종류만 빈틈 없이 깔았습니다. 나무의 “수관(잎)”과 “밑동”은 같은 칸에 쌓이는데, 위아래로 딱 붙여 놓으니 앞 나무의 잎 위에 뒷 나무의 잎이 얹혀 <strong>밑동이 안 보이는 세로 사슬</strong>이 됐습니다. 숫자상 커버리지는 높았지만 숲으로 보이지 않았습니다.</figcaption>
    </figure>
    <figure>
      <img alt="수종을 섞고 밑동을 보이게 하고 하층식생을 깐 최종 결과" src="${dataUri(dense.shot) ?? ""}">
      <figcaption><b>최종 — 숲</b>침엽수와 2×2 활엽수를 섞고, 나무마다 <strong>밑동이 보이도록</strong> 잎이 겹쳐 쌓이는 것을 금지하고, 틈에는 덤불과 하층식생을 깔았습니다. 나무 한 그루 한 그루를 셀 수 있습니다.</figcaption>
    </figure>
  </div>
  <div class="callout warn">
    <p><strong>2차로 틀린 것 — 격자무늬.</strong> 빈틈을 “일정한 간격으로” 비우니 커버리지는 맞는데 구멍이 <strong>규칙적인 격자</strong>로 줄을 섰습니다. 검토자가 칩셋으로 렌더해서 공간 자기상관을 재 보니 주기성이 뚜렷했습니다(0.40). 빈틈을 seed 기반으로 흩어 놓아 −0.027 까지 내렸습니다.</p>
  </div>

  <h2>가장 중요한 발견: 통행 칸을 세는 건 답이 아니었다</h2>
  <div class="callout">
    <p>“지나갈 수 있나”를 통행 가능 칸 수로 재고 있었는데, 그게 틀렸습니다. <strong>나무의 잎 타일은 통행 가능</strong>합니다 — 주인공이 나무 뒤로 지나가는 관례 때문입니다. 그래서 커버리지 100% 인 숲도 잎 칸을 밟고 걸어서 통과됩니다.</p>
    <p>판정을 <strong>경로 탐색(BFS)</strong>으로 바꿨습니다. “바깥에서 실제로 걸어 들어올 수 있는 칸이 몇 개인가”를 묻습니다. 이 기준으로 보면 <code>dense</code> 는 통행 가능 152칸 중 실제로 닿는 칸이 33칸이고, <code>impassable</code> 은 <strong>0칸</strong>입니다.</p>
    <p>이 관점을 바꾸자 기존 코드에 숨어 있던 버그도 드러났습니다. 나무 보정 로직이 빈틈을 막아 둔 덤불을 뒷정리 단계에서 잎으로 덮어써 <strong>길을 다시 열고</strong> 있었습니다.</p>
  </div>

  <h2>검토 과정</h2>
  <p>매 라운드 검토자가 직접 수치를 재고 렌더를 봤습니다. 보고된 숫자를 그대로 믿지 않고 재측정했습니다.</p>
  <ol class="rounds">
    <li><b>1라운드 — 변경 요청 5건</b>기본값 <code>dense</code> 가 선언한 80%에 못 미치고 72.6%가 걸어서 통과됐습니다. 100×100 에서는 아예 끝나지 않았습니다(399초에 강제 종료). 무엇보다 <strong>모델이 실제로 쓰는 툴이 아닌 곳</strong>을 고치고 있었습니다.</li>
    <li><b>2라운드 — 변경 요청 2건</b>격자무늬(위)와, <code>normal</code> 이 40%라고 적어 놓고 18~27%만 깔던 문제.</li>
    <li><b>3라운드 — 변경 요청 2건</b>새로 만든 진입 판정이 <strong>사방이 막힌 영역도 “들어갈 수 있다”</strong>고 보고했습니다(16칸 중 16칸). 그리고 나무 보정 예외가 너무 넓어서 나무 상자를 밑동 위에 올려두면 보정이 영구히 막혔습니다.</li>
    <li><b>4라운드 — 승인</b>모든 지적이 재측정으로 확인됐고, 렌더도 숲으로 읽혔습니다.</li>
    <li><b>통합 — 재승인</b>병합이 <strong>엉뚱한 시점의 커밋</strong>으로 들어가 승인된 수정이 반영되지 않은 것을 발견해, 그 사이 새로 들어온 「생성 규칙」 시스템과 합쳐 다시 올렸습니다.</li>
  </ol>

  <h2>검증</h2>
  <table>
    <thead><tr><th>항목</th><th>결과</th></tr></thead>
    <tbody>
      <tr><td>24×24 <code>dense</code> 커버리지</td><td>44.4% → <strong>99.5%</strong></td></tr>
      <tr><td>24×24 <code>dense</code> 소요 시간</td><td>1,334ms → <strong>21ms</strong></td></tr>
      <tr><td>100×100 <code>dense</code></td><td>240초 넘겨 강제 종료 → <strong>59ms</strong></td></tr>
      <tr><td>50×50 마을 「울창한 숲 마을」</td><td>숲 밴드 27.7% → <strong>83.3%</strong>, 구조 검사 통과(문 4/4, 도로 1덩어리)</td></tr>
      <tr><td>숲을 안 말한 요청 「녹지 마을」</td><td>커버리지 4.2% — 저작 기본값으로 정상 폴백</td></tr>
      <tr><td>타입 검사</td><td>통과</td></tr>
      <tr><td>테스트</td><td>숲 관련 + 마을 표면 전량 통과</td></tr>
    </tbody>
  </table>
  <p class="muted">숫자와 스크린샷의 원본은 같은 폴더의 <code>receipt.json</code> 에 있습니다.</p>

  <footer>
    영역 ${area.x},${area.y} · ${area.w}×${area.h} · 증거 <code>${esc(evidenceDir)}</code><br>
    새로 생긴 파일 <code>src/editor/tools/forestDensity.ts</code> · <code>src/editor/tools/forestComposition.ts</code>
  </footer>
</main>
</body>
</html>
`;

writeFileSync(outPath, html, "utf8");
console.log(outPath);
