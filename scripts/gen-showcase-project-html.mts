/**
 * 맵 쇼케이스 프로젝트 보고서 — build-showcase-project.mts 산출 렌더를
 * 카테고리별 이미지 리치 HTML로 묶는다.
 * 실행: npx tsx scripts/gen-showcase-project-html.mts
 * 산출: docs/2026-07-20-showcase-project.html
 */
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("output/evidence/showcase-project");
const DOC = path.resolve("docs/2026-07-20-showcase-project.html");
const PROJECT_ID = "rpg-zzu-showcase";

type Entry = { id: string; name: string; file: string; w: number; h: number; events: number };
const rendered: Entry[] = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "rendered.json"), "utf8"));

const b64 = (file: string): string =>
  `data:image/png;base64,${fs.readFileSync(path.join(OUT_DIR, file)).toString("base64")}`;

type Section = { title: string; desc: string; match: (e: Entry) => boolean };
const SECTIONS: Section[] = [
  {
    title: "1. 마을 — 야외 정착지 3종",
    desc: "강촌 장터(강·호수·시장·낚시꾼 NPC), 숲 사냥꾼(흙길·침엽수 가장자리·목조 킷), 석조 장터(유기 돌마당·청석 킷). 주황 점 = 이벤트(NPC·문).",
    match: (e) => e.id.startsWith("map_sc_village_"),
  },
  {
    title: "2. 성 — 아키타입 5종",
    desc: "커튼월(여장 데크+정면벽)·원형탑·포탈리스·대계단·깃발 문법으로 조립한 관문 요새 / 대탑 본성 / 동심원 성 / 궁정 알현실 / 폐성.",
    match: (e) => e.id.startsWith("map_sc_castle_"),
  },
  {
    title: "3. 던전 — 테마 3종",
    desc: "용암 / 석재 / 얼음 — 던전 칩셋 정본(tileSemanticsDungeon) 기반 수제 레이아웃.",
    match: (e) => e.id.startsWith("map_sc_dungeon_"),
  },
  {
    title: "4. 집 외관 — 킷 6종 카탈로그",
    desc: "청석·회벽·호박 목조·청회 목조·목골 회관·석조 저택 + 데코 조합(굴뚝·앞마당 울타리·깃발 208/209).",
    match: (e) => e.id === "map_sc_house_kits",
  },
  {
    title: "5. 실내 정본 세트 — 외관 킷과 연결되는 자동 실내",
    desc: "대저택(세로 복도+카펫+복도끝 계단, 2층) · L형 민가 · 2층 민가 · 여관 · 상점 · 공방 · 서재. 천장 정본 v2(검정+회암 오토타일) + 벽/천장 쌍 불변식 적용.",
    match: (e) => e.id.startsWith("map_sc_int_"),
  },
  {
    title: "6. 특수 실내 — 대형·재질 변주 7종",
    desc: "도서관 · 연회장(금장 벽) · 만찬장(석벽) · 병영 · 연금술 공방 · 대형 창고 · 40×40 대저택 층(방 13개).",
    match: (e) => e.id.startsWith("map_sc_rp_"),
  },
  {
    title: "7. 강촌 마을의 자동 생성 실내",
    desc: "강촌 장터 마을 집들에 자동 연결된 실내(문 이벤트로 출입 가능).",
    match: (e) => !e.id.startsWith("map_sc_"),
  },
];

const cards = (entries: Entry[]): string =>
  entries
    .map(
      (e) => `
    <figure class="card">
      <img src="${b64(e.file)}" alt="${e.name}" loading="lazy" />
      <figcaption>
        <strong>${e.name}</strong>
        <span class="meta">${e.id} · ${e.w}×${e.h}${e.events > 0 ? ` · 이벤트 ${e.events}` : ""}</span>
      </figcaption>
    </figure>`,
    )
    .join("\n");

const seen = new Set<string>();
const sectionsHtml = SECTIONS.map((s) => {
  const entries = rendered.filter((e) => !seen.has(e.id) && s.match(e));
  for (const e of entries) seen.add(e.id);
  if (entries.length === 0) return "";
  return `
  <section>
    <h2>${s.title} <span class="count">${entries.length}맵</span></h2>
    <p class="desc">${s.desc}</p>
    <div class="grid">${cards(entries)}</div>
  </section>`;
}).join("\n");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>맵 쇼케이스 프로젝트 — ${rendered.length}맵 (2026-07-20)</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 24px 80px; background: #14121a; color: #e8e4f0;
         font-family: "Pretendard", "Malgun Gothic", system-ui, sans-serif; line-height: 1.6; }
  header { max-width: 1280px; margin: 0 auto 8px; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .sub { color: #a89fc0; font-size: 14px; }
  .open { display: inline-block; margin-top: 10px; padding: 8px 14px; background: #2d2542;
          border: 1px solid #5a4a8a; border-radius: 8px; color: #cfc2ff; font-size: 14px; }
  code { background: #241f33; padding: 2px 6px; border-radius: 5px; font-size: 0.92em; }
  section { max-width: 1280px; margin: 36px auto 0; }
  h2 { font-size: 20px; border-left: 4px solid #7a5cff; padding-left: 10px; margin: 0 0 4px; }
  .count { font-size: 13px; color: #a89fc0; font-weight: normal; margin-left: 6px; }
  .desc { color: #b8afd0; font-size: 14px; margin: 4px 0 14px; }
  .grid { display: flex; flex-wrap: wrap; gap: 18px; }
  .card { margin: 0; background: #1d1928; border: 1px solid #322a48; border-radius: 10px;
          padding: 10px; max-width: 100%; }
  .card img { display: block; max-width: 620px; width: 100%; height: auto;
              image-rendering: pixelated; border-radius: 6px; }
  figcaption { margin-top: 8px; font-size: 14px; display: flex; flex-direction: column; gap: 2px; }
  .meta { color: #8d84a8; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>맵 쇼케이스 프로젝트 — 에디터가 만들 수 있는 맵 전 유형</h1>
  <div class="sub">2026-07-20 · 총 ${rendered.length}맵 · 프로젝트 <code>${PROJECT_ID}</code> (LegacyDb 저장 완료)</div>
  <div class="open">에디터에서 열기: URL 뒤에 <code>?project=${PROJECT_ID}</code> 를 붙이면 이 프로젝트가 로드됩니다.
  직접 수정하시면 그 상태를 기준으로 피드백 루프를 돌립니다.</div>
</header>
${sectionsHtml}
</body>
</html>`;

fs.writeFileSync(DOC, html);
console.log(`written ${DOC} (${(fs.statSync(DOC).size / 1024 / 1024).toFixed(1)} MB, ${rendered.length}맵)`);
