// 능력 표(capability.json) + 레시피 캡처 폴더들 → 자체완결 HTML 한 장. 그림은 data URI 로 넣는다.
// 실행: bun scripts/qa/region-directives/page.ts <capability.json> <캡처 상위 폴더> <출력.html> [실측 json]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Status = "완전" | "부분" | "불가";
interface Side { status: Status; reason: string; where: string; steps: { tool: string; ok: boolean; summary: string }[] }
interface Row { id: string; genre: string; text: string; routedToRecipe: string | null; before: Side; after: Side }

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const COLOR: Record<Status, string> = { 완전: "#2f9e44", 부분: "#f08c00", 불가: "#c92a2a" };
const img = (file: string) => existsSync(file) ? `<img src="data:image/png;base64,${readFileSync(file).toString("base64")}" alt="">` : `<div class="miss">그림 없음</div>`;

const [capPath, capturesDir, outPath, livePath] = process.argv.slice(2);
if (!capPath || !capturesDir || !outPath) throw new Error("page.ts <capability.json> <캡처 상위 폴더> <출력.html> [실측 json]");
const cap = JSON.parse(readFileSync(resolve(capPath), "utf8")) as { summary: any; rows: Row[] };
// 옛 판정(첫 호출 거부 = 불가)으로 낸 JSON 도 지금 규칙(도구가 있으면 부분)으로 읽는다.
for (const row of cap.rows) for (const side of [row.before, row.after]) {
  if (side.status === "불가" && side.steps.length > 0 && side.steps[0]!.summary !== "등록되지 않은 도구") side.status = "부분";
}
const genres = [...new Set(cap.rows.map((r) => r.genre))];
const live = livePath && existsSync(livePath) ? JSON.parse(readFileSync(livePath, "utf8")) : null;

const cell = (r: Row, side: "before" | "after") => `<span class="cell" style="background:${COLOR[r[side].status]}" title="${esc(`${r.text}\n${r[side].status}${r[side].reason ? ` — ${r[side].reason}` : ""}`)}"></span>`;
const grid = (side: "before" | "after") => genres.map((g) => {
  const rows = cap.rows.filter((r) => r.genre === g);
  return `<div class="grow"><b>${esc(g)}</b><span class="n">${rows.length}</span><div class="cells">${rows.map((r) => cell(r, side)).join("")}</div></div>`;
}).join("");
const count = (side: "before" | "after", s: Status) => cap.rows.filter((r) => r[side].status === s).length;
const byGenre = genres.map((g) => {
  const rows = cap.rows.filter((r) => r.genre === g);
  const c = (side: "before" | "after", s: Status) => rows.filter((r) => r[side].status === s).length;
  return `<tr><td>${esc(g)}</td><td>${rows.length}</td><td>${c("before", "완전")}/${c("before", "부분")}/${c("before", "불가")}</td><td>${c("after", "완전")}/${c("after", "부분")}/${c("after", "불가")}</td></tr>`;
}).join("");

const recipes = existsSync(capturesDir) ? readdirSync(capturesDir).filter((d) => existsSync(resolve(capturesDir, d, "capture.json"))).sort() : [];
const recipeHtml = recipes.map((d) => {
  const dir = resolve(capturesDir, d);
  const info = JSON.parse(readFileSync(resolve(dir, "capture.json"), "utf8"));
  const pics: [string, string][] = [["1-before", "전: 영역과 지시"], ["2-after-exterior", "후: 외관 + 결과 카드"], ["4-interior", "새 실내 맵"], ["5-play-outside", "테스트 플레이: 문 앞"], ["6-play-inside", "문으로 들어감"], ["7-play-back-outside", "다시 나옴"]];
  return `<section class="recipe"><h3>${esc(info.instruction)} <small>(${esc(info.kind)})</small></h3><p class="card">결과 카드: <b>${esc(info.card)}</b> · ${esc(info.result?.summary ?? "")}</p><div class="pics">${pics.map(([f, t]) => `<figure>${img(resolve(dir, `${f}.png`))}<figcaption>${t}</figcaption></figure>`).join("")}</div></section>`;
}).join("");

const changed = cap.rows.filter((r) => r.before.status !== r.after.status);
const stillOpen = cap.rows.filter((r) => r.after.status !== "완전");
const rowTable = (rows: Row[]) => `<table class="rows"><tr><th>지시</th><th>장르</th><th>전</th><th>후</th><th>막히는 곳(후)</th></tr>${rows.map((r) => `<tr><td>${esc(r.text)}</td><td>${esc(r.genre)}</td><td style="color:${COLOR[r.before.status]}">${r.before.status}</td><td style="color:${COLOR[r.after.status]}">${r.after.status}</td><td>${esc(r.after.reason)}${r.after.where ? `<br><code>${esc(r.after.where)}</code>` : ""}</td></tr>`).join("")}</table>`;

const liveHtml = live ? `<h2>실제 조수 실측 (Sonnet 5.5 high)</h2><p>${esc(live.note ?? "")}</p><table class="rows"><tr><th>지시</th><th>부른 도구</th><th>결과</th><th>시간</th></tr>${(live.runs ?? []).map((r: any) => `<tr><td>${esc(r.text)}</td><td>${esc((r.tools ?? []).join(", "))}</td><td>${esc(r.verdict)}</td><td>${esc(r.seconds)}s</td></tr>`).join("")}</table>` : `<h2>실제 조수 실측</h2><p>실측 필요 — 아직 돌리지 않았다.</p>`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>영역 지시 — 능력 표와 장소 레시피</title><style>
body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px;background:#f8f9fa;color:#212529;max-width:1400px}
h1{margin:0 0 4px}h2{margin-top:32px}.lead{font-size:16px;background:#fff;border-left:4px solid #2f9e44;padding:12px 16px}
.legend span{display:inline-block;width:12px;height:12px;margin:0 4px 0 12px;vertical-align:middle}
.grids{display:grid;grid-template-columns:1fr 1fr;gap:16px}.panel{background:#fff;padding:12px;border-radius:8px}
.grow{display:flex;align-items:flex-start;gap:8px;margin:4px 0}.grow b{width:72px;flex:none}.grow .n{width:28px;color:#868e96;flex:none}
.cells{display:flex;flex-wrap:wrap;gap:2px}.cell{width:12px;height:12px;border-radius:2px;display:inline-block}
table{border-collapse:collapse;background:#fff}td,th{border:1px solid #dee2e6;padding:4px 8px;vertical-align:top}code{font-size:12px}
.recipe{background:#fff;padding:12px;border-radius:8px;margin:12px 0}.pics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
figure{margin:0}figure img{width:100%;border:1px solid #dee2e6}figcaption{font-size:12px;color:#495057}.miss{padding:40px;text-align:center;background:#f1f3f5}
details{margin:12px 0}summary{cursor:pointer;font-weight:600}
@media (max-width:800px){.grids,.pics{grid-template-columns:1fr}body{padding:12px}}
</style></head><body>
<h1>영역 지시 — 능력 표와 장소 레시피</h1>
<p class="lead">영역을 잡고 「여기 상점 만들어 줘」 한 번이면 이제 <b>외관 + 실내 맵 + 문 왕복 + 주인(상점/숙박)</b>이 함께 선다. 지시 ${cap.rows.length}개 중 완전 <b>${count("before", "완전")} → ${count("after", "완전")}</b>, 부분 ${count("before", "부분")} → ${count("after", "부분")}, 불가 ${count("before", "불가")} → ${count("after", "불가")}. 바뀐 지시 ${changed.length}개.</p>
<h2>바뀐 것 (전 → 후)</h2>
<p class="legend">색: <span style="background:${COLOR.완전}"></span>완전 <span style="background:${COLOR.부분}"></span>부분 <span style="background:${COLOR.불가}"></span>불가 · 칸에 마우스를 올리면 지시와 이유</p>
<div class="grids"><div class="panel"><h3>전</h3>${grid("before")}</div><div class="panel"><h3>후</h3>${grid("after")}</div></div>
<table><tr><th>장르</th><th>지시 수</th><th>전 완전/부분/불가</th><th>후 완전/부분/불가</th></tr>${byGenre}</table>
<h2>레시피별 실제 앱 캡처</h2><p>편집기에서 영역을 잡고 지시 → 결과 카드 → 새 실내 맵 → 테스트 플레이로 문을 드나든다. 조수 응답은 대본(결정적 도구 리플레이)이다.</p>
${recipeHtml || "<p>캡처 없음</p>"}
${liveHtml}
<details><summary>전 → 후가 바뀐 지시 ${changed.length}개</summary>${rowTable(changed)}</details>
<details><summary>아직 완전이 아닌 지시 ${stillOpen.length}개 (막히는 도구·위치)</summary>${rowTable(stillOpen)}</details>
<details><summary>전체 ${cap.rows.length}개</summary>${rowTable(cap.rows)}</details>
<h2>에이전트용</h2><details><summary>판정 규칙·요약 JSON</summary><pre>${esc(JSON.stringify(cap.summary, null, 1))}</pre><p>완전 = 호출 모두 성공 · 영역 밖 칸·이벤트 변화 0 · 영역 턴 병합이 버린 것 0 · 지시별 확인 통과. 부분 = 도구는 있는데 거부(재료 낱말·인자 — 다시 불러야 함)되거나 결과 일부가 깨짐. 불가 = 도구·레시피 없음. 전 = 장소 짓기는 외관·실내·문·주인을 따로 부르는 사슬 + 기준 커밋 병합기, 후 = build_region_place + 지금 병합기. 재현: <code>bash scripts/qa/region-directives/run.sh &lt;폴더&gt;</code></p></details>
</body></html>`;
writeFileSync(resolve(outPath), html);
process.stdout.write(`PAGE ${outPath} ${html.length}\n`);
