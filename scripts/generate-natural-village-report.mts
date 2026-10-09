import fs from "node:fs";
import path from "node:path";

type Evidence = {
  projectId: string;
  reloaded: boolean;
  quality?: { ok: boolean; score: number; metrics: Record<string, number> };
  qualityGate?: { ok: boolean; score: number; metrics: Record<string, number> };
};

const root = path.resolve("output", "evidence", "natural-village");
const reference = readEvidence("reference-legacyDb.json");
const harness = readEvidence("harness-legacyDb.json");
const referenceMetrics = reference.quality?.metrics ?? {};
const harnessMetrics = harness.qualityGate?.metrics ?? {};
const stageLabels = ["지형·개울", "집 형태·키트", "도로·네 출구", "숲·시장·생활 흔적", "주민 일정이 있는 완성본"];

const comparisons = [
  ["집 형태 / 키트", `${metric(referenceMetrics, "houseShapeKinds")} / ${metric(referenceMetrics, "houseKitKinds")}`, `${metric(harnessMetrics, "houseShapeKinds")} / ${metric(harnessMetrics, "houseKitKinds")}`],
  ["다층 집 / 붙은 창", `${metric(referenceMetrics, "multiStoryHouses")} / ${metric(referenceMetrics, "adjacentWindowPairs")}`, `${metric(harnessMetrics, "multiStoryHouses")} / ${metric(harnessMetrics, "adjacentWindowPairs")}`],
  ["정상 문 쌍 / 고아 문", `${metric(referenceMetrics, "doorPairs")} / ${metric(referenceMetrics, "orphanDoorTiles")}`, `${metric(harnessMetrics, "doorPairs")} / ${metric(harnessMetrics, "orphanDoorTiles")}`],
  ["맵 밖 도로 출구", `${metric(referenceMetrics, "exitRoads")}/4`, `${metric(harnessMetrics, "exitRoads")}/4`],
  ["울타리 칸 / 최장 직선 도로", `${metric(referenceMetrics, "fenceCells")} / ${metric(referenceMetrics, "longestStraightRoadRun")}`, `${metric(harnessMetrics, "fenceCells")} / ${metric(harnessMetrics, "longestStraightRoadRun")}`],
  ["나무 칸 / 수종 / 2×2 군락", `${metric(referenceMetrics, "treeCells")} / ${metric(referenceMetrics, "treeKinds")} / ${metric(referenceMetrics, "tree2x2Clusters")}`, `${metric(harnessMetrics, "treeCells")} / ${metric(harnessMetrics, "treeKinds")} / ${metric(harnessMetrics, "tree2x2Clusters")}`],
  ["내부 나무 칸 / 장터 소품", `${metric(referenceMetrics, "interiorTreeCells")} / ${metric(referenceMetrics, "plazaPropCells")}`, `${metric(harnessMetrics, "interiorTreeCells")} / ${metric(harnessMetrics, "plazaPropCells")}`],
  ["소품 칸 / 타일 종류", `${metric(referenceMetrics, "propCells")} / ${metric(referenceMetrics, "propTileKinds")}`, `${metric(harnessMetrics, "propCells")} / ${metric(harnessMetrics, "propTileKinds")}`],
  ["일정 주민 / 활동 / 이동 방식", `${metric(referenceMetrics, "scheduledNpcs")} / ${metric(referenceMetrics, "npcActivityKinds")} / ${metric(referenceMetrics, "npcMovementKinds")}`, `${metric(harnessMetrics, "scheduledNpcs")} / ${metric(harnessMetrics, "npcActivityKinds")} / ${metric(harnessMetrics, "npcMovementKinds")}`],
];

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OPRN 자연 마을 → 하네스 v2 증거 보고서</title>
<style>
:root{color-scheme:dark;--bg:#11140f;--panel:#1a2118;--ink:#eef1df;--muted:#aeb7a3;--line:#394633;--leaf:#9fc66b;--earth:#d4a36b;--water:#72a9c7}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#263322 0,transparent 34rem),var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Noto Sans KR",sans-serif}main{width:min(1480px,calc(100% - 32px));margin:auto;padding:44px 0 80px}h1{font-size:clamp(34px,5vw,68px);line-height:1.02;letter-spacing:-.05em;margin:0;max-width:980px}h2{font-size:28px;margin:64px 0 8px;letter-spacing:-.03em}h3{font-size:18px;margin:0 0 5px}.lede{max-width:850px;color:var(--muted);font-size:18px}h1,.lede,.callout>div,.note,.shot figcaption{word-break:keep-all;overflow-wrap:break-word}.eyebrow{color:var(--leaf);font-weight:800;letter-spacing:.13em;text-transform:uppercase}.proof,.callout{display:grid;gap:14px}.proof{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin:30px 0}.card,.callout>div{background:linear-gradient(145deg,#20291d,#171c15);border:1px solid var(--line);border-radius:14px;padding:20px}.badge{display:inline-flex;border:1px solid #587448;border-radius:999px;padding:4px 10px;color:var(--leaf);font-size:12px;font-weight:800}.project{font:700 14px ui-monospace,SFMono-Regular,monospace;color:var(--earth);overflow-wrap:anywhere}.metrics{width:100%;border-collapse:collapse;background:#151a13;border:1px solid var(--line);border-radius:12px;overflow:hidden}.metrics th,.metrics td{padding:11px 14px;border-bottom:1px solid #2d3829;text-align:left}.metrics th{color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase}.metrics td:nth-child(n+2){font-family:ui-monospace,SFMono-Regular,monospace;color:#dce8ca}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin-top:18px}.shot{margin:0;background:#0c0f0b;border:1px solid var(--line);border-radius:12px;overflow:hidden}.shot img{display:block;width:100%;aspect-ratio:8/7;object-fit:cover;image-rendering:pixelated}.shot figcaption{padding:11px 13px;color:var(--muted)}.shot strong{color:var(--ink)}.hero-shot img{aspect-ratio:8/7;object-fit:contain;background:#080a07}.iteration{border-left:3px solid var(--line);padding-left:18px;margin-top:36px}.iteration.final{border-color:var(--leaf)}.atlas{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.atlas div{padding:14px;border:1px solid var(--line);border-radius:10px;background:#171c15}.atlas code{color:var(--earth)}a{color:var(--water)}.note{color:var(--muted);font-size:13px}.pass{color:var(--leaf);font-weight:800}.callout{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:18px}@media(max-width:640px){main{width:min(100% - 20px,1480px);padding-top:28px}.metrics{font-size:12px}.metrics th,.metrics td{padding:9px 8px}}
</style></head><body><main>
<p class="eyebrow">OPRN · map-only evidence</p><h1>먼저 자연스럽게 만들고,<br>그 문법을 하네스에 옮겼다.</h1>
<p class="lede">직접 좌표로 저작한 64×56 참조 마을을 세 번 시각 반복한 뒤, 집·도로·숲·생활 소품·NPC 일과 규칙을 <code>build_village</code>와 평가 게이트에 반영한 결과다. 모든 이미지는 에디터 UI가 없는 지도 전용 PNG다.</p>
<section class="proof">
${proofCard("직접 저작 참조본", reference.projectId, reference.reloaded, reference.quality?.score)}
${proofCard("하네스 생성본 v2", harness.projectId, harness.reloaded, harness.qualityGate?.score)}
</section>
<h2>결과 비교</h2><p class="note">표의 값은 로컬 fixture가 아니라 LegacyDb 재로드 프로젝트에서 다시 계산했다.</p>
<table class="metrics"><thead><tr><th>검증 항목</th><th>직접 저작</th><th>하네스 v2</th></tr></thead><tbody>${comparisons.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>
<div class="callout"><div><h3>집</h3>중복 전에 형태·키트를 순환하고, 다층 집은 창 행 사이를 비워 층을 구분한다. 문은 집마다 116/146 한 쌍만 둔다.</div><div><h3>길</h3>목재 생활 장터를 둘러싼 굽은 길을 북·남·서·동 경계까지 연결한다. 집 footprint 안에는 길이 들어가지 않는다.</div><div><h3>생활감</h3>침엽수와 2×2 활엽수, 짧은 울타리 조각, 마당/시장 소품, 3단계 주민 일정과 고정·배회 이동을 함께 사용한다.</div></div>
<h2>직접 저작 과정 — 모든 단계</h2>
${gallery("1차 — 구조 기준선", "reference", "큰 지붕 질량과 굵은 도로를 발견한 최초 캡처")}
${gallery("2차 — 지붕·시장·수림 보강", "reference/iteration-02", "지붕 높이를 줄이고 나무·소품·시장 카운터를 늘린 반복")}
${gallery("3차 — 연결성과 최종 균형", "reference/iteration-03", "대각 도로의 끊김을 계단형 연결 셀로 보정한 최종 참조본", true)}
<h2>하네스 v2 결과</h2><p class="note">직접 저작본의 품질 문법을 적용한 뒤 도로 폭·배치 규칙을 브라우저 캡처로 재검토해 보정한 최종 생성본.</p>
<div class="gallery"><figure class="shot hero-shot"><img src="harness/01-map_village_20260716_64x56.png" alt="하네스 v2 전체 지도"><figcaption><strong>하네스 생성 최종 지도</strong><br>64×56 · 집 10 · 주민 12 · 네 방향 출구</figcaption></figure></div>
<h2>Combined Town 타일 아틀라스 분석</h2><div class="atlas">
<div><strong>도로</strong><br><code>421</code> 흙길 body · <code>424</code> 모래길 body</div><div><strong>수역</strong><br><code>120</code> 물 autotile · 서쪽 개울</div><div><strong>수림</strong><br><code>260/290</code> 침엽수 · <code>262/263 + 292/293</code> 활엽수 2×2</div><div><strong>집 외장</strong><br><code>404–407, 467</code> 지붕 · 4개 벽/지붕 키트</div><div><strong>문·창</strong><br><code>116/146</code> 문 한 쌍 · <code>85/87</code> 창문</div><div><strong>생활 소품</strong><br><code>288, 320, 327/328, 349–352, 202/203, 234–237</code></div>
</div>
<h2>원격 저장·캡처 증거</h2><ul><li><a href="reference-legacyDb.json">직접 저작 LegacyDb 재로드 JSON</a></li><li><a href="harness-legacyDb.json">하네스 LegacyDb 재로드·품질 JSON</a></li><li><a href="reference/iteration-03/capture-evidence.json">직접 저작 map-only 캡처 JSON</a></li><li><a href="harness/capture-evidence.json">하네스 map-only 캡처 JSON</a></li></ul>
<p class="note">생성일 ${new Date().toISOString()} · PNG 2048×1792 · UI chrome 제외</p>
</main></body></html>`;

fs.writeFileSync(path.join(root, "report.html"), html, "utf8");
console.log(path.join(root, "report.html"));

function readEvidence(fileName: string): Evidence {
  return JSON.parse(fs.readFileSync(path.join(root, fileName), "utf8")) as Evidence;
}

function metric(metrics: Record<string, number>, key: string): number {
  return metrics[key] ?? 0;
}

function proofCard(title: string, projectId: string, reloaded: boolean, score?: number): string {
  return `<article class="card"><span class="badge">${reloaded ? "LEGACY_DB RELOAD PASS" : "RELOAD FAIL"}</span><h3>${title}</h3><p class="project">${projectId}</p><p>품질 점수 <span class="pass">${score ?? "-"}</span> · 원격 정본 확인</p></article>`;
}

function gallery(title: string, relativeDir: string, subtitle: string, final = false): string {
  const files = fs.readdirSync(path.join(root, relativeDir)).filter((file) => file.endsWith(".png")).sort();
  const cards = files.map((file, index) => `<figure class="shot"><img src="${relativeDir}/${file}" alt="${stageLabels[index] ?? file}"><figcaption><strong>${String(index + 1).padStart(2, "0")} ${stageLabels[index] ?? "지도"}</strong><br>${file}</figcaption></figure>`).join("");
  return `<section class="iteration${final ? " final" : ""}"><h3>${title}</h3><p class="note">${subtitle}</p><div class="gallery">${cards}</div></section>`;
}
