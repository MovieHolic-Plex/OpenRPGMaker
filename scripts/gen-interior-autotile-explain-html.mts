/**
 * Generate HTML doc: map_interior_blank autotile usage + tile sprites from Interior chipset.
 * Usage: npx tsx scripts/gen-interior-autotile-explain-html.mts
 */
import fs from "node:fs";
import path from "node:path";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import {
  INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
  INTERIOR_WALL_FRAME_TILES,
  INTERIOR_WALL_FRAME_FLOOR_TILE,
} from "../src/project/tilesetHarness/themePacks.ts";

const TILE = 16;
const COLS = 30;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const p = path.resolve(".env.local");
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function chipPos(tile: number) {
  return { col: tile % COLS, row: Math.floor(tile / COLS) };
}

function tileSpriteHtml(tile: number, scale = 3, titleExtra = ""): string {
  if (tile < 0) {
    return `<span class="tile empty" title="empty (-1)"></span>`;
  }
  const { col, row } = chipPos(tile);
  const size = TILE * scale;
  const title = `tile ${tile} · chipset (${col},${row})${titleExtra ? " · " + titleExtra : ""}`;
  return `<span class="tile" title="${escapeHtml(title)}" style="width:${size}px;height:${size}px;background-position:${-col * size}px ${-row * size}px;background-size:${COLS * size}px auto"></span>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const env = loadEnv();
const project = await loadProjectFromSupabase({
  url: (env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY || "",
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
if (!project) throw new Error("failed to load project from Supabase");

const map = project.maps.map_interior_blank;
if (!map) throw new Error("map_interior_blank missing");
const ts = project.tilesets[map.tilesetId];
if (!ts) throw new Error(`tileset ${map.tilesetId} missing`);

const wallGroup = (ts.autotileGroups ?? []).find((g) => g.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID)
  ?? (ts.autotileGroups ?? [])[0];

const members = new Set(wallGroup?.memberTileIds ?? []);
const connect = new Set(wallGroup?.connectTileIds ?? []);
const defaultMembers = new Set([
  INTERIOR_WALL_FRAME_TILES.body,
  INTERIOR_WALL_FRAME_TILES.edgeN,
  INTERIOR_WALL_FRAME_TILES.edgeS,
  INTERIOR_WALL_FRAME_TILES.edgeW,
  INTERIOR_WALL_FRAME_TILES.edgeE,
  INTERIOR_WALL_FRAME_TILES.cornerNW,
  104, 106, 396, 398, 456, 458,
]);

const lowerCounts = new Map<number, number>();
for (const t of map.lowerTiles) lowerCounts.set(t, (lowerCounts.get(t) ?? 0) + 1);
const upperCounts = new Map<number, number>();
for (const t of map.upperTiles) {
  if (t >= 0) upperCounts.set(t, (upperCounts.get(t) ?? 0) + 1);
}

function roleOf(tile: number): "member" | "connect" | "void" | "other" {
  if (tile === 430) return "void";
  if (members.has(tile)) return "member";
  if (connect.has(tile)) return "connect";
  return "other";
}

const compositionHits: Array<{
  x: number;
  y: number;
  center: number;
  underlay?: number;
  sources: string;
}> = [];
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const c = chipsetQuarterComposition(map, ts, x, y);
    if (!c) continue;
    compositionHits.push({
      x,
      y,
      center: map.lowerTiles[y * map.width + x]!,
      underlay: c.underlayTile,
      sources: c.sources.map((s) => `${s.quarter}@${s.tile}`).join(", "),
    });
  }
}

const usedLower = [...lowerCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
const usedUpper = [...upperCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);

// relative paths for opening HTML from repo root or from output/
const chipsetRelFromOutput = "../../public/assets/easyrpg-chipset-interior-transparent.png";
const outDir = path.resolve("output/docs");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "interior-blank-autotile-explain.html");

const variantEntries = wallGroup
  ? Object.entries(wallGroup.variantMap).map(([k, v]) => ({ mask: Number(k), tile: v as number }))
  : [];

function maskLabel(mask: number): string {
  const dirs: string[] = [];
  if (mask & 1) dirs.push("N");
  if (mask & 2) dirs.push("E");
  if (mask & 4) dirs.push("S");
  if (mask & 8) dirs.push("W");
  return dirs.length ? dirs.join("+") : "none";
}

// map grid cells
const mapCells: string[] = [];
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    const L = map.lowerTiles[i]!;
    const U = map.upperTiles[i]!;
    const role = roleOf(L);
    const hit = compositionHits.find((h) => h.x === x && h.y === y);
    const classes = ["cell", `role-${role}`, hit ? "has-comp" : ""].filter(Boolean).join(" ");
    mapCells.push(`
      <div class="${classes}" data-x="${x}" data-y="${y}" title="(${x},${y}) L=${L} U=${U}${hit ? " COMP: " + hit.sources : ""}">
        <div class="stack">
          ${tileSpriteHtml(L, 2)}
          ${U >= 0 ? `<div class="upper-overlay">${tileSpriteHtml(U, 2)}</div>` : ""}
          ${hit ? `<div class="comp-badge">+368 ${escapeHtml(hit.sources.split("@")[0] || "")}</div>` : ""}
        </div>
        <div class="coord">${x},${y}</div>
        <div class="ids">L${L}${U >= 0 ? ` U${U}` : ""}</div>
      </div>`);
  }
}

const memberRows = (wallGroup?.memberTileIds ?? []).map((t) => {
  const onMap = lowerCounts.get(t) ?? 0;
  const inDefault = defaultMembers.has(t);
  return `<tr class="${onMap ? "used" : "unused"} ${inDefault ? "" : "extra"}">
    <td>${tileSpriteHtml(t, 3)}</td>
    <td class="num">${t}</td>
    <td>(${chipPos(t).col}, ${chipPos(t).row})</td>
    <td>${onMap}</td>
    <td>${inDefault ? "기본 멤버" : "<strong class='warn'>확장 멤버</strong>"}</td>
  </tr>`;
}).join("\n");

const connectOnly = [...connect].filter((t) => !members.has(t));
const connectRows = connectOnly.map((t) => {
  const onMap = lowerCounts.get(t) ?? 0;
  return `<tr class="${onMap ? "used" : "unused"}">
    <td>${tileSpriteHtml(t, 3)}</td>
    <td class="num">${t}</td>
    <td>${onMap}</td>
    <td>connect-only (멤버 아님, 이웃 연결만)</td>
  </tr>`;
}).join("\n");

const defaultRoleTable = [
  ["body", INTERIOR_WALL_FRAME_TILES.body],
  ["edgeN", INTERIOR_WALL_FRAME_TILES.edgeN],
  ["edgeS", INTERIOR_WALL_FRAME_TILES.edgeS],
  ["edgeW", INTERIOR_WALL_FRAME_TILES.edgeW],
  ["edgeE", INTERIOR_WALL_FRAME_TILES.edgeE],
  ["corner*", INTERIOR_WALL_FRAME_TILES.cornerNW],
  ["floor connect", INTERIOR_WALL_FRAME_FLOOR_TILE],
].map(([role, t]) => {
  const id = t as number;
  return `<tr>
    <td>${escapeHtml(String(role))}</td>
    <td>${tileSpriteHtml(id, 3)}</td>
    <td class="num">${id}</td>
    <td>${lowerCounts.get(id) ?? 0}칸 on map</td>
  </tr>`;
}).join("\n");

const variantRows = variantEntries
  .sort((a, b) => a.mask - b.mask)
  .map(({ mask, tile }) => `<tr>
    <td class="num">${mask}</td>
    <td>${escapeHtml(maskLabel(mask))}</td>
    <td>${tileSpriteHtml(tile, 3)}</td>
    <td class="num">${tile}</td>
  </tr>`)
  .join("\n");

const usedLowerRows = usedLower.map(([t, c]) => {
  const role = roleOf(t);
  return `<tr class="role-${role}">
    <td>${tileSpriteHtml(t, 3)}</td>
    <td class="num">${t}</td>
    <td>${c}</td>
    <td>${role}</td>
  </tr>`;
}).join("\n");

const usedUpperRows = usedUpper.map(([t, c]) => `<tr>
  <td>${tileSpriteHtml(t, 3)}</td>
  <td class="num">${t}</td>
  <td>${c}</td>
</tr>`).join("\n");

const compRows = compositionHits.map((h) => `<tr>
  <td>(${h.x}, ${h.y})</td>
  <td>${tileSpriteHtml(h.center, 3)} <span class="num">${h.center}</span></td>
  <td>${h.underlay != null ? tileSpriteHtml(h.underlay, 3) + ` ${h.underlay}` : "—"}</td>
  <td>${escapeHtml(h.sources)} → 항상 tile <strong>368</strong> ${tileSpriteHtml(368, 3)}</td>
</tr>`).join("\n");

const tileGroupsHtml = (ts.tileGroups ?? []).map((g) => {
  const ids = g.tileIds ?? [];
  const sample = ids.slice(0, 24).map((t) => tileSpriteHtml(t, 2)).join("");
  const onMap = ids.filter((t) => (lowerCounts.get(t) ?? 0) + (upperCounts.get(t) ?? 0) > 0).length;
  return `<div class="card">
    <h4>${escapeHtml(g.name || g.id)} <code>${escapeHtml(g.id)}</code></h4>
    <p class="muted">${ids.length} tiles · 맵에서 쓰인 id ${onMap}개 · <em>오토타일 아님 (분류/AI용 tileGroup)</em></p>
    <div class="tile-row">${sample}${ids.length > 24 ? `<span class="muted">+${ids.length - 24}</span>` : ""}</div>
  </div>`;
}).join("\n");

const generatedAt = new Date().toISOString();
const projectId = env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery";

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>실내 공터 — 현재 쓰이는 타일셋 / 오토타일 설명</title>
<style>
  :root {
    --bg: #0f1218;
    --panel: #171b24;
    --panel2: #1e2430;
    --text: #e8ecf4;
    --muted: #9aa3b5;
    --accent: #7cb7ff;
    --warn: #ffb020;
    --danger: #ff6b6b;
    --member: #3d6b3d;
    --connect: #3d5a6b;
    --void: #2a2a32;
    --other: #6b4a3d;
    --comp: #c45cff;
    --border: #2c3344;
    --chip: url("${chipsetRelFromOutput}");
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 14px/1.55 "Segoe UI", "Malgun Gothic", system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 24px 28px 64px;
  }
  h1 { font-size: 1.45rem; margin: 0 0 8px; }
  h2 { font-size: 1.15rem; margin: 32px 0 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px; color: var(--accent); }
  h3 { font-size: 1rem; margin: 20px 0 8px; }
  h4 { margin: 0 0 6px; font-size: 0.95rem; }
  p { margin: 0 0 10px; max-width: 72rem; }
  code, .num { font-family: ui-monospace, Consolas, monospace; }
  .muted { color: var(--muted); }
  .warn { color: var(--warn); }
  .danger { color: var(--danger); }
  .lead { font-size: 0.98rem; color: #c5cee0; }
  .meta { display: flex; flex-wrap: wrap; gap: 10px 18px; margin: 12px 0 20px; color: var(--muted); font-size: 0.9rem; }
  .meta strong { color: var(--text); font-weight: 600; }
  .callout {
    background: #241c10;
    border: 1px solid #5a3d12;
    border-left: 4px solid var(--warn);
    padding: 12px 14px;
    border-radius: 8px;
    margin: 14px 0 22px;
    max-width: 72rem;
  }
  .callout.bad {
    background: #241418;
    border-color: #5a2030;
    border-left-color: var(--danger);
  }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 960px) { .grid-2 { grid-template-columns: 1fr; } }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 12px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    max-width: 56rem;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  th, td {
    border-bottom: 1px solid var(--border);
    padding: 6px 10px;
    text-align: left;
    vertical-align: middle;
  }
  th { background: var(--panel2); color: var(--muted); font-weight: 600; font-size: 0.85rem; }
  tr.unused { opacity: 0.45; }
  tr.extra td { background: rgba(255,176,32,0.06); }
  tr.role-member { background: rgba(61,107,61,0.15); }
  tr.role-connect { background: rgba(61,90,107,0.18); }
  tr.role-void { background: rgba(40,40,50,0.5); }
  tr.role-other { background: rgba(107,74,61,0.18); }
  .tile {
    display: inline-block;
    width: 48px;
    height: 48px;
    image-rendering: pixelated;
    background-image: var(--chip);
    background-repeat: no-repeat;
    border: 1px solid #000;
    vertical-align: middle;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
  }
  .tile.empty {
    background: repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 8px 8px;
  }
  .tile-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .legend { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0 14px; }
  .legend span {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 8px; border-radius: 6px; background: var(--panel); border: 1px solid var(--border);
    font-size: 0.85rem;
  }
  .swatch { width: 12px; height: 12px; border-radius: 3px; }
  .swatch.member { background: var(--member); }
  .swatch.connect { background: var(--connect); }
  .swatch.void { background: var(--void); border: 1px solid #555; }
  .swatch.other { background: var(--other); }
  .swatch.comp { background: var(--comp); }
  .map-wrap {
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #0a0c10;
    padding: 8px;
    max-width: 100%;
  }
  .map-grid {
    display: grid;
    grid-template-columns: repeat(${map.width}, 72px);
    gap: 2px;
    width: max-content;
  }
  .cell {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px;
    min-height: 70px;
  }
  .cell.role-member { background: #1a2a1a; border-color: #3d6b3d; }
  .cell.role-connect { background: #15222a; border-color: #3d5a6b; }
  .cell.role-void { background: #121218; border-color: #333; }
  .cell.role-other { background: #2a1c16; border-color: #6b4a3d; }
  .cell.has-comp { outline: 2px solid var(--comp); outline-offset: -1px; }
  .stack { position: relative; width: 32px; height: 32px; margin: 0 auto; }
  .stack .tile { width: 32px !important; height: 32px !important; }
  .upper-overlay { position: absolute; inset: 0; pointer-events: none; }
  .comp-badge {
    position: absolute; left: -4px; right: -4px; bottom: -2px;
    font-size: 8px; line-height: 1.1; text-align: center;
    color: #f0d0ff; background: rgba(120,40,160,0.85); border-radius: 2px;
  }
  .coord { font-size: 9px; color: var(--muted); text-align: center; margin-top: 2px; }
  .ids { font-size: 9px; color: #b8c0d0; text-align: center; font-family: ui-monospace, Consolas, monospace; }
  .flow {
    display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 8px; align-items: stretch;
    max-width: 72rem; margin: 12px 0;
  }
  @media (max-width: 800px) { .flow { grid-template-columns: 1fr; } .flow .arrow { transform: rotate(90deg); text-align: center; } }
  .flow .box {
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
  }
  .flow .arrow { color: var(--muted); align-self: center; font-size: 1.4rem; }
  ul.tight { margin: 6px 0 10px 1.2rem; padding: 0; }
  ul.tight li { margin: 4px 0; }
  .chipset-preview {
    max-width: min(100%, 720px);
    image-rendering: pixelated;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #000;
  }
</style>
</head>
<body>
  <h1>실내 공터 — 지금 쓰이고 있는 타일셋 / 오토타일</h1>
  <p class="lead">
    Supabase 프로젝트 데이터 + Interior 칩셋 스프라이트로 생성.
    비전/스크린샷 분석 없음. 맵 배열 · <code>autotileGroups</code> · 렌더 쿼터 합성 결과만 반영.
  </p>
  <div class="meta">
    <span>생성: <strong>${escapeHtml(generatedAt)}</strong></span>
    <span>project: <strong>${escapeHtml(projectId)}</strong></span>
    <span>map: <strong>map_interior_blank</strong> (${map.width}×${map.height})</span>
    <span>tileset: <strong>${escapeHtml(map.tilesetId)}</strong></span>
    <span>title: <strong>${escapeHtml(project.meta?.title ?? "")}</strong></span>
  </div>

  <div class="callout">
    <strong>한 줄 요약:</strong>
    이 맵 타일셋에 등록된 <em>오토타일 그룹은 사실상 1개</em>
    (<code>실내 벽 프레임</code>).
    맵 lower는 그 멤버 타일들로 <em>수작업 집 단면</em>을 깔았고,
    화면 일부 430 칸에는 <em>렌더 전용 368 쿼터</em>가 추가로 붙습니다.
    모래/흙길 terrain 오토타일은 이 타일셋에 없습니다.
  </div>

  <h2>1. 타일셋 칩셋 시트</h2>
  <p class="muted">
    번들: <code>public/assets/easyrpg-chipset-interior-transparent.png</code>
    · 타일 16×16 · 행당 30칸 · id = row×30 + col
  </p>
  <img class="chipset-preview" src="${chipsetRelFromOutput}" alt="Interior chipset" width="480" />

  <h2>2. 엔진 경로 두 갈래 (이름만 같은 “오토타일”)</h2>
  <div class="flow">
    <div class="box">
      <strong>A. 쓰기 (auto-connect)</strong>
      <ul class="tight">
        <li>member 칸만 이웃 마스크 계산</li>
        <li><code>variantMap[mask]</code> → lower 타일 ID 교체</li>
        <li>에디터 기본 Manual이면 맵 ID 유지</li>
      </ul>
    </div>
    <div class="arrow">→</div>
    <div class="box">
      <strong>맵 lower 배열</strong>
      <ul class="tight">
        <li>지금: 수작업 페인팅</li>
        <li>368 코너 타일: 맵에 <strong>0칸</strong></li>
        <li>430 = 보이드 배경</li>
      </ul>
    </div>
    <div class="arrow">→</div>
    <div class="box">
      <strong>B. 그리기 (quarter composition)</strong>
      <ul class="tight">
        <li>중심 430/257/368 + 직교 이웃 둘 다 member</li>
        <li>항상 <strong>tile 368</strong> 8×8 오버레이</li>
        <li><code>variantMap</code> 무시</li>
      </ul>
    </div>
  </div>
  <div class="callout bad">
    <strong>어긋남:</strong>
    코드 기본 corner는 368인데, 이 프로젝트 variantMap은 233/234/257/258 쪽으로 변형되어 있고,
    맵은 456/458·104/106 등 수작업 문법을 씁니다.
    그런데 렌더는 여전히 430 위에 368 조각을 붙입니다 → “저장 430 ≠ 보이는 것”.
  </div>

  <h2>3. 코드 기본 역할 타일 (참고)</h2>
  <p class="muted">themePacks 기본 INTERIOR_WALL_FRAME — 실제 Supabase 그룹은 멤버/variant가 더 확장됨.</p>
  <table>
    <thead><tr><th>역할</th><th>그래픽</th><th>ID</th><th>이 맵 사용</th></tr></thead>
    <tbody>${defaultRoleTable}</tbody>
  </table>

  <h2>4. 지금 타일셋에 있는 오토타일 그룹 (실사용 1개)</h2>
  <div class="card">
    <h3>${escapeHtml(wallGroup?.name ?? "(none)")}</h3>
    <p>
      <code>${escapeHtml(wallGroup?.id ?? "")}</code><br/>
      neighborhood: <strong>${wallGroup?.neighborhood ?? "—"}</strong> (4 = N/E/S/W only)
    </p>
  </div>

  <h3>4-1. memberTileIds (성형·쿼터 이웃 판정)</h3>
  <p class="muted">노란 배경 = 기본 하네스에 없던 <strong>확장 멤버</strong>. 흐림 = 맵 lower에 0칸.</p>
  <table>
    <thead><tr><th>그래픽</th><th>ID</th><th>칩셋 좌표</th><th>맵 칸 수</th><th>비고</th></tr></thead>
    <tbody>${memberRows}</tbody>
  </table>

  <h3>4-2. connect-only</h3>
  <table>
    <thead><tr><th>그래픽</th><th>ID</th><th>맵 칸 수</th><th>비고</th></tr></thead>
    <tbody>${connectRows || "<tr><td colspan=4 class=muted>없음</td></tr>"}</tbody>
  </table>

  <h3>4-3. variantMap (쓰기 경로 A용, mask → tile)</h3>
  <p class="muted">마스크 비트: N=1, E=2, S=4, W=8. 연결되지 않은 방향이 “결손”.</p>
  <table>
    <thead><tr><th>mask</th><th>연결</th><th>그래픽</th><th>tile</th></tr></thead>
    <tbody>${variantRows}</tbody>
  </table>

  <h2>5. tileGroups (오토타일 아님)</h2>
  <p class="muted">분류·AI·팔레트용. 이웃 성형에 사용하지 않음.</p>
  ${tileGroupsHtml}

  <h2>6. 이 맵 lower 전개 (저장 값 + 역할 색)</h2>
  <div class="legend">
    <span><i class="swatch member"></i> member (벽 프레임 오토타일 멤버)</span>
    <span><i class="swatch connect"></i> connect-only (72 바닥)</span>
    <span><i class="swatch void"></i> 430 보이드</span>
    <span><i class="swatch other"></i> 기타 (오토타일 밖)</span>
    <span><i class="swatch comp"></i> 보라 테두리 = 렌더가 368 쿼터 합성</span>
  </div>
  <div class="map-wrap">
    <div class="map-grid">
      ${mapCells.join("\n")}
    </div>
  </div>
  <p class="muted" style="margin-top:8px">
    셀 안 타일 그래픽 = 저장 lower (및 upper가 있으면 겹침). 보라 테두리 칸은 저장은 430이어도 화면에 368 조각이 붙음.
  </p>

  <h2>7. 렌더 쿼터 합성 hit (이 맵 6곳, 전부 center=430)</h2>
  <table>
    <thead><tr><th>좌표</th><th>저장 center</th><th>underlay</th><th>합성 source</th></tr></thead>
    <tbody>${compRows}</tbody>
  </table>
  <p>
    예: <strong>(5,3)</strong> 저장 L=430, 이웃 W=426·S=457 (둘 다 member) → SW 쿼터에 368.
    <strong>(9,3)</strong> E=428·S=457 → SE@368.
    이미 (4,4)=456 / (10,4)=458 모서리가 맵에 있는데 대각 보이드에 또 368이 붙는 구조.
  </p>

  <h2>8. 맵에서 쓰인 lower / upper 빈도</h2>
  <div class="grid-2">
    <div>
      <h3>Lower</h3>
      <table>
        <thead><tr><th>그래픽</th><th>ID</th><th>개수</th><th>역할</th></tr></thead>
        <tbody>${usedLowerRows}</tbody>
      </table>
    </div>
    <div>
      <h3>Upper (소품 — 벽 프레임 오토타일과 무관)</h3>
      <table>
        <thead><tr><th>그래픽</th><th>ID</th><th>개수</th></tr></thead>
        <tbody>${usedUpperRows || "<tr><td colspan=3 class=muted>없음</td></tr>"}</tbody>
      </table>
    </div>
  </div>

  <h2>9. 결론 — “지금 쓰이고 있는 것”</h2>
  <ul class="tight">
    <li><strong>타일셋 1개:</strong> <code>easyrpg_chipset_interior</code> (Interior 칩셋)</li>
    <li><strong>오토타일 그룹 1개:</strong> 실내 벽 프레임 (멤버 확장 + variantMap 변형됨)</li>
    <li><strong>맵 페인팅:</strong> 멤버 타일로 집 단면 수작업 + 72 바닥 + 430 보이드 + 소수 other(18,20…)</li>
    <li><strong>렌더 추가:</strong> 430 6칸에 368 쿼터 오버레이 (맵 ID 불변)</li>
    <li><strong>안 쓰임:</strong> Combined Town 모래/흙길 quarter 오토타일 · 이 맵에 lower 368</li>
  </ul>
  <p class="muted">재생성: <code>npx tsx scripts/gen-interior-autotile-explain-html.mts</code></p>
</body>
</html>
`;

fs.writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath);
console.log("composition hits", compositionHits.length);
console.log("members", wallGroup?.memberTileIds?.length);
