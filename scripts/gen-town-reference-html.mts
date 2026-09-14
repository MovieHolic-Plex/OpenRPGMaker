/**
 * 마을 실렌더 보고서 — 참조 그림과 같은 마을을 어떻게 만드는지, 실산출 PNG 와 함께 낸다.
 * 실행: npx tsx scripts/gen-town-reference-html.mts
 * 산출: output/evidence/town-reference/town-reference.html (+ 단일 파일판)
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("output/evidence/town-reference");
const OUT = path.join(DIR, "town-reference.html");

type Row = {
  readonly file: string;
  readonly title: string;
  readonly theme: string;
  readonly size: number;
  readonly houses: number;
  readonly layout?: string;
  readonly forestDensity?: string;
  readonly seed: number;
  readonly ok: boolean;
  readonly summary: string;
  readonly seconds: number;
};

const report = JSON.parse(fs.readFileSync(path.join(DIR, "report.json"), "utf8")) as Row[];
const rows = report.filter((row) => fs.existsSync(path.join(DIR, `${row.file}.png`)));

const fig = (row: Row): string => `
  <figure id="${row.file}">
    <img src="${row.file}.png" alt="${row.title}">
    <figcaption>
      <b>${row.title}</b>
      <code>size ${row.size}×${row.size} · 집 ${row.houses}채 · layout ${row.layout ?? "(기본)"} · forest ${row.forestDensity ?? "normal"} · seed ${row.seed} · ${row.seconds}s</code>
      <span>${row.summary}</span>
    </figcaption>
  </figure>`;

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>이런 식의 마을을 만드는 법 — 실렌더 보고서</title>
<style>
:root{--bg:#101219;--surface:#191c25;--ink:#e9ebf2;--dim:#a8afc2;--faint:#79819a;--line:#282d3c;--accent:#7ba3e8;--good:#6dc493;--warn:#d9b25c}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15.5px/1.75 "Noto Sans KR","NanumSquare",system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:34px 20px 90px}
h1{font-size:1.85rem;line-height:1.28;margin:.2em 0 .3em}
h2{font-size:1.3rem;margin:2.2em 0 .5em;padding-top:1.1em;border-top:2px solid var(--line)}
h3{font-size:1.05rem;margin:1.5em 0 .4em}
p{margin:.7em 0}
code{background:#222634;padding:.1em .42em;border-radius:4px;font:600 .85em/1.5 Consolas,"Cascadia Mono",monospace;color:var(--accent)}
.lead{color:var(--dim);max-width:92ch}
.card{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:11px;padding:15px 19px;margin:15px 0}
.card.warn{border-left-color:var(--warn)}
.card.recipe{border-left-color:var(--good)}
table{border-collapse:collapse;width:100%;font-size:.88em;margin:.9em 0}
th,td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}
th{background:#222634;white-space:nowrap}
figure{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:13px;overflow:hidden}
figure img{width:100%;display:block;border-radius:7px;background:#0c0e13}
figcaption{display:flex;flex-direction:column;gap:5px;margin-top:10px;font-size:.86rem;color:var(--dim)}
figcaption b{color:var(--ink);font-size:.97rem}
figcaption code{font-size:.76em;word-break:break-all}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:1.1em 0}
@media(max-width:800px){.grid{grid-template-columns:1fr}}
ol.steps{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 14px 14px 34px;margin:1em 0}
ol.steps li{margin:.55em 0}
pre{background:#0c0e14;border:1px solid var(--line);border-radius:10px;padding:13px 15px;overflow-x:auto;font:600 .84rem/1.65 Consolas,monospace;color:#cfd6e6}
footer{margin-top:3em;color:var(--faint);font-size:.85rem;border-top:1px solid var(--line);padding-top:1em}
</style></head><body><main>

<h1>이런 식의 마을을 만드는 법 — 실렌더 보고서</h1>
<p class="lead">참조 그림(격자 골목 · 집 20여 채 · 나무 · 연못 · 흙길)은 이 저장소의 <b>마을 시공기</b>로 그대로 만들 수 있다. 아래 그림은 상상이 아니라 <code>author_village</code> 를 실제로 돌린 결과 맵이다. 같은 입력·같은 씨앗이면 같은 마을이 나온다.</p>

<div class="card recipe">
  <b>한 줄 요약</b><br>
  사람은 <b>설계서</b>에서 값만 정하고, 시공은 코드가 한다.<br>
  <code>map 생성 → 설계서(집 수·길·숲·광장) → author_village 1회</code> — 마을 전체(집·길·울타리·나무·물)가 <b>한 호출</b>로 나온다.
</div>

<h2>1. 만드는 순서</h2>
<ol class="steps">
  <li><b>맵을 만든다.</b> <code>create_map</code> 으로 크기를 정한다(참조 그림은 8px 타일 72×72 = 576×576px 상당).</li>
  <li><b>설계서에서 값을 고른다</b>(데이터베이스 → <code>마을</code> 탭, 또는 <code>presetId</code>). 집 수·길 스타일·숲 밀도·광장 모양·마당 성격.</li>
  <li><b><code>author_village</code> 를 한 번 부른다.</b> 집 배치 → 문/지붕/울타리 → 길 연결 → 나무·물 → (선택) 실내·주민까지 코드가 순서대로 시공하고 스스로 감사한다.</li>
  <li><b>눈으로 확인한다.</b> <code>look_at_houses</code> 로 &ldquo;같은 집만 깔렸는지&rdquo;를 되읽는다.</li>
  <li><b>Supabase 에 저장</b>하고 다시 불러 존재를 확인한다.</li>
</ol>

<h2>2. 실렌더 — 참조 그림과 같은 마을</h2>
<div class="grid">
${rows.map(fig).join("\n")}
</div>

<h2>3. 무엇이 값을 정하나</h2>
<div class="card">
  <table>
    <tr><th>보고 싶은 것</th><th>넘기는 값</th><th>참고</th></tr>
    <tr><td>집 수</td><td><code>houseCount</code></td><td>1~32. <code>countPolicy:"exact"</code> 면 미달 시 실패로 알려준다</td></tr>
    <tr><td>길 모양</td><td><code>settlementLayout</code></td><td><code>street-grid</code>(격자 골목) · <code>plaza-ring</code>(광장 중심) · <code>clusters</code>(무리)</td></tr>
    <tr><td>길 재질·폭</td><td>설계서 <code>pathStyle</code> · <code>roadWidth</code>(2~3)</td><td>흙길/모래길/포석</td></tr>
    <tr><td>나무 밀도</td><td><code>forestDensity</code></td><td><code>sparse</code> · <code>normal</code> · <code>dense</code> · <code>impassable</code></td></tr>
    <tr><td>분위기</td><td><code>theme</code> 또는 설계서 <code>presetId</code></td><td>&ldquo;농촌 마을&rdquo;·&ldquo;산골 마을&rdquo; 같은 낱말이 원형 6갈래로 접힌다</td></tr>
    <tr><td>집 생김새</td><td><code>housePlans[].templateId</code> · <code>kitId</code></td><td>모양 34종 × 재질 5종. 생략하면 코드가 섞는다</td></tr>
    <tr><td>물(연못·강)</td><td>테마 낱말(&ldquo;호수&rdquo;·&ldquo;항구&rdquo;·&ldquo;강가&rdquo;)</td><td>물이 필수로 잡히면 <b>물 칸 수를 세어</b> 미달이면 실패로 알린다</td></tr>
  </table>
</div>

<h2>4. 직접 부르는 법</h2>
<pre>author_village({
  target: { kind: "existing", mapId: "map_town" },
  houseCount: 20,
  countPolicy: "best-effort",
  theme: "농촌 마을",
  settlementLayout: "street-grid",
  forestDensity: "normal",
  interior: false,
  npcCount: 0,
  seed: 7,
})</pre>
<p class="lead">화면에서는 같은 일을 <b>데이터베이스 → 마을</b> 탭에서 값으로 하고, AI 어시스턴트에게 &ldquo;농촌 마을 20채 지어줘&rdquo;라고 말해도 같은 경로를 탄다. 세 경로가 <b>같은 설계서 계약</b>을 읽으므로 결과가 갈라지지 않는다.</p>

<h2>5. 이 저장소에서 확인하는 법</h2>
<div class="card warn">
  <b>재현</b>: <code>npx tsx scripts/render-town-reference.mts</code> → <code>output/evidence/town-reference/*.png</code><br>
  큰 맵(72×72·20채)은 <b>6분 안팎</b> 걸린다 — 길 연결 탐색과 집 보호 검증이 매 단계 돈다. 작은 마을(40×40·8채)은 1초다.<br>
  그림은 실제 시공 결과 맵을 그대로 렌더한다(합본 마을 칩셋의 4분면 오토타일 합성까지 태운다).
</div>

<footer>
  RPG ZZU · 실렌더 증거 · 정본 경로 <code>src/editor/tools/authorVillageTool.ts</code> → <code>villageBuilder.buildVillageDomain</code><br>
  값의 정의: <code>src/editor/tools/village/authoringData.ts</code> (원형·범위) · 읽는 순서: <code>openwiki/large-village-generation.md</code>
</footer>
</main></body></html>`;

fs.writeFileSync(OUT, html);

// 단일 파일판 — 그림을 base64 로 인라인해 파일 하나만 있으면 열린다.
let inlined = 0;
const standalone = html.replace(/src="([a-z0-9-]+\.png)"/g, (_m, file: string) => {
  const file2 = path.join(DIR, file);
  if (!fs.existsSync(file2)) return `src="${file}"`;
  inlined += 1;
  return `src="data:image/png;base64,${fs.readFileSync(file2).toString("base64")}"`;
});
const standalonePath = path.join(DIR, "town-reference-standalone.html");
fs.writeFileSync(standalonePath, standalone);
console.log(`wrote ${OUT} (${rows.length} figs) + standalone (${inlined} inlined, ${(standalone.length / 1024 / 1024).toFixed(1)}MB)`);
