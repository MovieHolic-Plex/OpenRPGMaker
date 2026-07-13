/**
 * 실내 칩셋 라벨 아틀라스 — 타일 480개의 모든 라벨 소스를 한 표로 대조.
 * 소스: ① tileSemanticsInterior(검색용 정본) ② 신규 시드 tileMeta(블랭크 프로젝트)
 *       ③ 라이브 Supabase 프로젝트의 tileMeta(에디터 DB가 실제로 보여주는 값)
 *       ④ 하네스 타일 그룹/오토타일 그룹 소속
 * 출력: output/docs/interior-label-atlas.html
 * 실행: npx tsx scripts/gen-interior-label-atlas.mts
 */
import fs from "node:fs";
import path from "node:path";
import { INTERIOR_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsInterior.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import type { TileAiMetadata, TilesetDef } from "../src/project/types";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const liveProjectId = env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery";
const liveProject = await loadProjectFromSupabase({
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: liveProjectId,
});

const fresh: TilesetDef = createBlankProject().tilesets.easyrpg_chipset_interior!;
const live: TilesetDef | undefined = liveProject?.tilesets?.easyrpg_chipset_interior;

const semantics = new Map<number, { label: string; role: string; passage: string }>();
for (const e of INTERIOR_TILE_SEMANTICS) semantics.set(e.index, { label: e.label, role: e.role, passage: e.passage });

const groupOf = (tileset: TilesetDef | undefined, id: number): string[] => {
  if (!tileset) return [];
  const out: string[] = [];
  for (const g of tileset.tileGroups ?? []) {
    if (g.tileIds.includes(id)) out.push(`${g.label ?? g.id}${g.defaultLayer ? `·${g.defaultLayer}` : ""}`);
  }
  return out;
};
const autoOf = (tileset: TilesetDef | undefined, id: number): string[] => {
  if (!tileset) return [];
  const out: string[] = [];
  for (const g of tileset.autotileGroups ?? []) {
    if (g.memberTileIds.includes(id)) out.push(g.name ?? g.id);
  }
  return out;
};

const S = 40;
const SHEET_W = 30 * S;
const pos = (id: number) =>
  `background-position:-${(id % 30) * S}px -${Math.floor(id / 30) * S}px;background-size:${SHEET_W}px auto`;

type Row = {
  id: number;
  sem?: { label: string; role: string; passage: string };
  freshMeta?: TileAiMetadata;
  liveMeta?: TileAiMetadata;
  groups: string[];
  autos: string[];
  stale: boolean;
  dual: boolean;
};

const rows: Row[] = [];
let staleCount = 0;
let dualCount = 0;
let liveMissing = 0;
for (let id = 0; id < 480; id += 1) {
  const freshMeta = fresh.tileMeta?.[id];
  const liveMeta = live?.tileMeta?.[id];
  const sem = semantics.get(id);
  const stale = Boolean(live && (liveMeta?.label ?? "") !== (freshMeta?.label ?? ""));
  const dual = Boolean(sem && freshMeta?.label && sem.label !== freshMeta.label);
  if (stale) staleCount += 1;
  if (dual) dualCount += 1;
  if (live && !liveMeta?.label && freshMeta?.label) liveMissing += 1;
  rows.push({ id, sem, freshMeta, liveMeta, groups: groupOf(fresh, id), autos: autoOf(fresh, id), stale, dual });
}

const esc = (s: string | undefined) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const metaCell = (m?: TileAiMetadata) =>
  m?.label
    ? `${esc(m.label)}${m.passage ? ` <span class="muted num">${m.passage === "solid" ? "×" : m.passage === "star" ? "★" : "○"}</span>` : ""}${m.source ? ` <span class="src">${m.source}</span>` : ""}`
    : `<span class="muted">—</span>`;

const bands: string[] = [];
for (let band = 0; band < 16; band += 1) {
  const trs = rows.slice(band * 30, band * 30 + 30).map((r) => `
<tr class="${r.stale ? "stale" : ""}">
  <td class="num">${r.id}</td>
  <td><span class="tile" style="${pos(r.id)}"></span></td>
  <td>${r.sem ? `${esc(r.sem.label)} <span class="muted num">${r.sem.role}·${r.sem.passage === "solid" ? "×" : "○"}</span>` : `<span class="danger">미분류</span>`}</td>
  <td class="${r.dual ? "dual" : ""}">${metaCell(r.freshMeta)}</td>
  <td>${live ? metaCell(r.liveMeta) : `<span class="muted">로드 실패</span>`}${r.stale ? ` <span class="badge-stale">낡음</span>` : ""}</td>
  <td class="small">${r.groups.map(esc).join("<br/>") || `<span class="muted">—</span>`}</td>
  <td class="small">${r.autos.map(esc).join("<br/>") || ""}</td>
</tr>`).join("");
  bands.push(`<h3 id="row${band}">시트 ${band}행 (타일 ${band * 30}–${band * 30 + 29})</h3>
<div class="tblwrap"><table>
<tr><th>ID</th><th>타일</th><th>① 정본(검색 테이블)</th><th>② 신규 시드 tileMeta</th><th>③ 라이브 프로젝트 tileMeta</th><th>하네스 그룹</th><th>오토타일</th></tr>
${trs}
</table></div>`);
}

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>실내 칩셋 라벨 아틀라스 — 소스 3종 전수 대조</title>
<style>
  :root {
    --bg: #0f1218; --panel: #171b24; --panel2: #1e2430;
    --text: #e8ecf4; --muted: #9aa3b5; --accent: #7cb7ff;
    --warn: #ffb020; --danger: #ff6b6b; --ok: #6fd98a; --border: #2c3344;
    --chip: url("../../public/assets/easyrpg-chipset-interior-transparent.png");
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 13px/1.5 "Segoe UI", "Malgun Gothic", system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 24px 28px 64px; }
  h1 { font-size: 1.4rem; margin: 0 0 8px; }
  h2 { font-size: 1.1rem; margin: 30px 0 10px; border-bottom: 1px solid var(--border); padding-bottom: 6px; color: var(--accent); }
  h3 { font-size: 0.95rem; margin: 22px 0 8px; color: #c5cee0; }
  p { margin: 0 0 10px; max-width: 76rem; }
  .muted { color: var(--muted); }
  .danger { color: var(--danger); font-weight: 600; }
  code, .num { font-family: ui-monospace, Consolas, monospace; font-size: 0.85em; }
  .lead { font-size: 0.95rem; color: #c5cee0; max-width: 76rem; }
  .stats { display: flex; gap: 12px; flex-wrap: wrap; margin: 14px 0 20px; }
  .stat { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px; }
  .stat b { display: block; font-size: 1.3rem; }
  .stat.bad b { color: var(--danger); }
  .stat.warn b { color: var(--warn); }
  .stat.ok b { color: var(--ok); }
  .callout { background: #14202b; border: 1px solid #23485f; border-left: 4px solid var(--accent); padding: 12px 14px; border-radius: 8px; margin: 12px 0 20px; max-width: 76rem; }
  .tile { display: inline-block; width: ${S}px; height: ${S}px; image-rendering: pixelated; background-image: var(--chip); background-repeat: no-repeat; vertical-align: middle; background-color: #223; }
  .tblwrap { overflow-x: auto; max-width: 100%; }
  table { border-collapse: collapse; min-width: 900px; background: var(--panel); border: 1px solid var(--border); }
  th, td { border-bottom: 1px solid var(--border); padding: 4px 8px; text-align: left; vertical-align: middle; }
  th { background: var(--panel2); color: var(--muted); font-weight: 600; font-size: 0.8rem; position: sticky; top: 0; }
  td.small { font-size: 0.78rem; color: #b8c0d0; }
  tr.stale td { background: rgba(255, 107, 107, 0.07); }
  td.dual { color: var(--warn); }
  .badge-stale { display: inline-block; font-size: 0.7rem; padding: 0 6px; border-radius: 999px; background: rgba(255,107,107,0.15); color: var(--danger); border: 1px solid rgba(255,107,107,0.4); }
  .src { display: inline-block; font-size: 0.68rem; padding: 0 5px; border-radius: 999px; background: rgba(154,163,181,0.12); color: var(--muted); border: 1px solid rgba(154,163,181,0.3); }
  .toc { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 6px; }
  .toc a { color: var(--accent); text-decoration: none; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; font-size: 0.8rem; }
</style>
</head>
<body>

<h1>실내 칩셋 라벨 아틀라스 <span class="muted">— 타일 480개 × 라벨 소스 3종 전수 대조</span></h1>
<p class="lead">에디터 "데이터베이스 → 타일셋"에서 보이는 라벨이 정정본과 다른 문제의 전수 조사표.
<b>① 정본</b> = <code>tileSemanticsInterior.ts</code>(검색용 큐레이션 — 이번 감사로 정정한 곳) ·
<b>② 신규 시드</b> = 블랭크 프로젝트 생성 시 하네스가 심는 <code>tileMeta</code>(새 프로젝트가 보게 될 값) ·
<b>③ 라이브</b> = Supabase 프로젝트 <code>${liveProjectId}</code>에 영속된 <code>tileMeta</code>(에디터 DB가 지금 실제로 보여주는 값).
○=통행 가능 ×=불가 ★=스타.</p>

<div class="stats">
  <div class="stat ${staleCount > 0 ? "bad" : "ok"}"><b>${staleCount}</b>라이브 ≠ 신규 시드 (낡은 라벨)</div>
  <div class="stat ${dualCount > 0 ? "warn" : "ok"}"><b>${dualCount}</b>정본 ≠ 신규 시드 (이중 소스 불일치)</div>
  <div class="stat"><b>${liveMissing}</b>라이브에 라벨 자체가 없음</div>
  <div class="stat"><b>${rows.filter((r) => r.sem).length}/480</b>정본 분류 완료</div>
</div>

<div class="callout" id="analysis">
<b>라벨 데이터 흐름 분석(fable 서브에이전트, 2026-07-12) — 원인 확정</b>
<ul style="margin:8px 0 4px 1.2rem; padding:0">
<li><b>에디터 "DB → 타일셋" 화면은 100% <code>tileset.tileMeta</code>만 읽는다</b>(metadataForTile → tileset.tileMeta?.[tile]; 툴팁·지식 탭·편집 필드 전부). 정본 큐레이션 테이블은 이 경로에 전혀 등장하지 않는다.</li>
<li><b>tileMeta 라벨의 원천은 하네스 그룹명 조립</b> — <code>themePacks.ts</code> applyTileContract가 <code>label = \`\${group.name} \${tile}\`</code>로 시드한다. "실내 나무 바닥 72", "연못/물 0" 같은 라벨의 정체.</li>
<li><b>큐레이션 정본(<code>tileSemanticsInterior.ts</code>)의 소비처는 검색 2곳뿐</b>(resourceSearch, tileMetadataTools) — 시드에 쓰이지 않는다. 게다가 검색에서도 하네스 시드 라벨이 비어있지 않아 큐레이션 라벨을 가린다.</li>
<li><b>낡음이 아니다</b> — 시드는 모든 로드 경로(normalizeCurrentProject)에서 매번 재적용·재영속된다(위 통계 stale=0과 일치). 문제는 재적용의 라벨 원천이 그룹명이라는 것.</li>
<li><b>근본 비대칭</b>: combined_town 칩셋은 labelForTile로 타일별 정밀 라벨을 tileMeta에 시드하는데, 실내 팩에는 그 대응물이 없다.</li>
<li>부차 발견: 그룹 미커버 타일의 옛 라벨이 프로젝트 JSON에 잔존(청소 없음) · tilePalette "빠른 타일 찾기" 탭이 실내 칩셋에서도 타운 칩셋 라벨을 표시(오답).</li>
</ul>
<b>통일 — 구현 완료(2026-07-12)</b>: ① applyTileContract(실내 팩)가 라벨·태그를 큐레이션 테이블에서 조회(그룹 계약은 유지) ② 전 타일 후처리 패스(seedInteriorUngroupedTileMeta)로 그룹 밖 타일 시드+잔존 청소 ③ 검색(resourceSearch)·knownTileLabel을 source-aware로(사용자 수기만 큐레이션을 이김) ④ 팔레트 빠른 탭이 비기본 칩셋에서 tileMeta 라벨 사용(타운 라벨 오표시 수정). 라이브 프로젝트 2개 재시드 저장 완료 — 아래 통계 dual=0·stale=0이 그 결과. 사용자 수기 라벨(source="user"/userLocked)은 가드가 지켜 덮이지 않는다.
</div>

<h2>타일별 대조표</h2>
<div class="toc">${Array.from({ length: 16 }, (_, i) => `<a href="#row${i}">${i}행</a>`).join("")}</div>
${bands.join("\n")}

<p class="muted" style="margin-top:28px">2026-07-12 · 생성: scripts/gen-interior-label-atlas.mts · 빨간 행 = 라이브 프로젝트의 tileMeta가 신규 시드와 다름(낡음/수정됨) · 주황 라벨 = 정본과 시드가 다른 이중 소스</p>

</body>
</html>
`;

const out = path.resolve("output/docs/interior-label-atlas.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, "utf8");
console.log(`written: ${out}`);
console.log(`stats: stale=${staleCount} dual=${dualCount} liveMissing=${liveMissing} live=${live ? "loaded" : "MISSING"}`);
