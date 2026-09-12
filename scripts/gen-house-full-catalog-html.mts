// 카탈로그 HTML 생성 — 한국어 제목·설명이 붙은 이미지 보고서.
// 사용: npx tsx scripts/_house-catalog-html.mts
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("output/evidence/house-full-catalog");
const OUT = path.join(DIR, "catalog.html");
const catalog = JSON.parse(fs.readFileSync(path.join(DIR, "catalog.json"), "utf8")) as {
  file: string; section: string; title: string; desc: string; note?: string;
}[];

const SECTIONS: readonly { key: string; label: string; intro: string }[] = [
  { key: "kits", label: "1. 재질(킷) 5종", intro: "같은 9×8 몸체에 벽 재질·지붕 페어만 바꿔 끼운다. 파랑 지붕(석벽·통나무), 오렌지 지붕(회벽·통나무), 빨간 지붕(목조 홀)." },
  { key: "shapes", label: "2. 집 모양 카탈로그 34종", intro: "내장 형태 전종. 사각 계열·낮은 헛간·ㄱ/ㄴ자·T자·곁채·ㄷ자·ㅁ자 중정·엇갈린 날개·헛간 딸린 필지·A자 지붕·옥상 데크." },
  { key: "options", label: "3. 층수·헛간·창문·굴뚝·옥상", intro: "형태 위에 얹는 축. stories(벽 행 수), lowWall(창고), 창문 간격, 굴뚝, 옥상 데크." },
  { key: "combos", label: "4. 조합 실증", intro: "형태 × 층수 × 재질을 곱한 예. 2층 ㄱ자 목조 홀, 2층 ㄷ자 회벽 저택, ㅁ자 중정 장원." },
  { key: "village", label: "5. 마을·마당", intro: "한 맵에 여러 채(author_house kind=lots)와 앞마당 울타리(마을 파이프라인 정본)." },
  { key: "interiors", label: "6. 들어가서 걷는 집 — 실내 자동 생성", intro: "주인 이름·용도에 따라 프로그램이 정해지고, 방·가구·계단이 자동 배치된다. 2층 이상은 층이 자동으로 이어진다." },
];

const blocks = SECTIONS.map((section) => {
  const files = catalog.filter((entry) => entry.section === section.key);
  if (files.length === 0) return "";
  const cards = files.map((entry) => `
    <figure id="${entry.file}">
      <img src="${entry.file}.png" alt="${entry.title}" loading="lazy">
      <figcaption><b>${entry.title}</b><span>${entry.desc}</span>${entry.note ? `<code>${entry.note}</code>` : ""}</figcaption>
    </figure>`).join("");
  return `
  <section data-sheet="${section.label}">
    <h2>${section.label} <small>${files.length}컷</small></h2>
    <p class="intro">${section.intro}</p>
    <div class="grid">${cards}</div>
  </section>`;
}).join("\n");

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>이 에디터로 지을 수 있는 집 — 실렌더 카탈로그 ${catalog.length}컷</title>
<style>
:root{--bg:#12141b;--surface:#1b1e27;--ink:#e9ebf2;--dim:#aab0c2;--faint:#7b8296;--line:#2b3040;--accent:#7ba3e8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 "Noto Sans KR","NanumSquare",system-ui,sans-serif}
main{max-width:1500px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:1.7rem;margin:.2em 0 .1em}
h2{font-size:1.25rem;margin:2.2em 0 .2em;padding-top:1em;border-top:1px solid var(--line)}
h2 small{color:var(--faint);font-size:.7em;font-weight:400;margin-left:.5em}
.meta,.intro{color:var(--dim);font-size:.92rem;margin:.4em 0 1em;max-width:95ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
figure{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
img{width:100%;display:block;background:#0d0f14;image-rendering:pixelated}
figcaption{padding:10px 12px;font-size:.86rem;color:var(--dim);display:flex;flex-direction:column;gap:4px}
figcaption b{color:var(--ink);font-size:.95rem}
figcaption code{color:var(--accent);font-size:.74rem;word-break:break-all}
</style></head><body><main>
<h1>이 에디터로 지을 수 있는 집 — 실렌더 카탈로그 ${catalog.length}컷</h1>
<p class="meta">정본 코드 직행: 외장 <code>author_house</code>(runTool) · 실내 <code>createHouseInteriorMap</code> · 울타리 <code>placeHouseLotFences</code>. 그림은 상상이 아니라 시공 결과다. 재생성: <code>npx tsx scripts/render-house-full-catalog.mts</code></p>
${blocks}
</main></body></html>`;

fs.writeFileSync(OUT, html);
console.log("wrote", OUT, `${(html.length / 1024).toFixed(0)}KB`);
