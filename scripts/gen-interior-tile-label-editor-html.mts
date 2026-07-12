/**
 * Rich visual tile-label editor HTML for map_interior_blank.
 * Big sprites + form inputs; AI drafts pre-filled for user correction.
 */
import fs from "node:fs";
import path from "node:path";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import {
  INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
  INTERIOR_WALL_FRAME_TILES,
  INTERIOR_WALL_FRAME_FLOOR_TILE,
} from "../src/project/tilesetHarness/themePacks.ts";

const TILE = 16;
const COLS = 30;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function chipPos(tile: number) {
  return { col: tile % COLS, row: Math.floor(tile / COLS) };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** AI draft — user will fix. No vision. */
const DRAFTS: Record<number, { label: string; note: string; category: string }> = {
  430: { label: "실외/암부 보이드 배경", note: "방 밖 어두운 배경. wall-frame 멤버 아님.", category: "배경" },
  72: { label: "실내 바닥 (connect)", note: "통행 바닥. 오토타일 connect-only.", category: "바닥" },
  105: { label: "벽 프레임 몸통 (body)", note: "INTERIOR body.", category: "벽프레임" },
  104: { label: "벽 프레임 안쪽 좌 트림", note: "105 왼쪽 세로.", category: "벽프레임" },
  106: { label: "벽 프레임 안쪽 우 트림", note: "105 오른쪽 세로.", category: "벽프레임" },
  428: { label: "벽 프레임 서측 변 (edgeW)", note: "왼쪽 세로 프레임.", category: "벽프레임" },
  426: { label: "벽 프레임 동측 변 (edgeE)", note: "오른쪽 세로 프레임.", category: "벽프레임" },
  457: { label: "벽 프레임 북측 변/상단 보 (edgeN)", note: "가로 상단 보.", category: "벽프레임" },
  397: { label: "벽 프레임 남측 변 (edgeS)", note: "하단 가로 프레임.", category: "벽프레임" },
  368: { label: "벽 프레임 코너 그래픽 (368)", note: "쿼터 소스. 맵 lower 0칸.", category: "벽프레임" },
  456: { label: "상단 보 서측 연결 코너", note: "보 왼쪽 끝 (4,4).", category: "벽프레임" },
  458: { label: "상단 보 동측 연결 코너", note: "보 오른쪽 끝 (10,4).", category: "벽프레임" },
  396: { label: "하단 문 알코브 좌", note: "문 홈 왼쪽.", category: "벽프레임" },
  398: { label: "하단 문 알코브 우", note: "문 홈 오른쪽.", category: "벽프레임" },
  233: { label: "상단 캡 좌", note: "y=1 캡 왼쪽.", category: "벽프레임" },
  258: { label: "상단 캡 우", note: "y=1 캡 오른쪽.", category: "벽프레임" },
  232: { label: "상단 캡 계열 (미사용?)", note: "확장 멤버.", category: "벽프레임" },
  234: { label: "상단 캡/소품 혼동 가능", note: "멤버+upper 가능.", category: "벽프레임" },
  257: { label: "문턱/보존 바닥", note: "쿼터 underlay 보존 베이스.", category: "바닥" },
  18: { label: "좌측 알코브 장식 1", note: "오토타일 밖 2×3 패치.", category: "장식" },
  20: { label: "좌측 알코브 장식 2", note: "", category: "장식" },
  48: { label: "좌측 알코브 장식 3", note: "", category: "장식" },
  50: { label: "좌측 알코브 장식 4", note: "", category: "장식" },
  78: { label: "좌측 알코브 장식 5", note: "", category: "장식" },
  79: { label: "좌측 알코브 장식 6", note: "", category: "장식" },
  1: { label: "실내 벽(하네스) 1", note: "tileGroup wall", category: "하네스벽" },
  2: { label: "실내 벽(하네스) 2", note: "", category: "하네스벽" },
  3: { label: "실내 벽(하네스) 3", note: "", category: "하네스벽" },
  31: { label: "실내 벽(하네스) 31", note: "", category: "하네스벽" },
  32: { label: "실내 벽(하네스) 32", note: "", category: "하네스벽" },
  33: { label: "실내 벽(하네스) 33", note: "", category: "하네스벽" },
  116: { label: "실내 구조 트림", note: "room-trim", category: "하네스" },
  270: { label: "실내 바닥 하네스 A", note: "이 맵은 72 사용", category: "하네스바닥" },
  271: { label: "실내 바닥 하네스 B", note: "", category: "하네스바닥" },
  300: { label: "실내 바닥 하네스 C", note: "", category: "하네스바닥" },
  301: { label: "실내 바닥 하네스 D", note: "", category: "하네스바닥" },
};

const env = loadEnv();
const project = await loadProjectFromSupabase({
  url: (env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY || "",
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
if (!project) throw new Error("no project");
const map = project.maps.map_interior_blank!;
const ts = project.tilesets[map.tilesetId]!;
const wall = (ts.autotileGroups ?? []).find((g) => g.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
const members = new Set(wall?.memberTileIds ?? []);
const connect = new Set(wall?.connectTileIds ?? []);

const lowerCounts = new Map<number, number>();
for (const t of map.lowerTiles) lowerCounts.set(t, (lowerCounts.get(t) ?? 0) + 1);
const upperCounts = new Map<number, number>();
for (const t of map.upperTiles) {
  if (t >= 0) upperCounts.set(t, (upperCounts.get(t) ?? 0) + 1);
}

const samples = new Map<number, Array<{ x: number; y: number; layer: string }>>();
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const L = map.lowerTiles[y * map.width + x]!;
    const U = map.upperTiles[y * map.width + x]!;
    if (!samples.has(L)) samples.set(L, []);
    if (samples.get(L)!.length < 6) samples.get(L)!.push({ x, y, layer: "L" });
    if (U >= 0) {
      if (!samples.has(U)) samples.set(U, []);
      if (samples.get(U)!.filter((s) => s.layer === "U").length < 4) {
        samples.get(U)!.push({ x, y, layer: "U" });
      }
    }
  }
}

// Neighbor context 3x3 crops for first sample of each on-map lower tile
function contextHtml(cx: number, cy: number, scale = 3): string {
  const cells: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const out = x < 0 || y < 0 || x >= map.width || y >= map.height;
      const L = out ? -1 : map.lowerTiles[y * map.width + x]!;
      const U = out ? -1 : map.upperTiles[y * map.width + x]!;
      const focus = dx === 0 && dy === 0;
      cells.push(
        `<div class="ctx-cell${focus ? " focus" : ""}" title="${out ? "OOB" : `(${x},${y}) L${L}${U >= 0 ? " U" + U : ""}`}">
          ${sprite(L, scale)}${U >= 0 ? `<div class="ctx-u">${sprite(U, scale)}</div>` : ""}
          <span class="ctx-id">${out ? "·" : L}</span>
        </div>`,
      );
    }
  }
  return `<div class="ctx-grid">${cells.join("")}</div>`;
}

function sprite(tile: number, scale: number): string {
  if (tile < 0) {
    return `<span class="spr empty" style="width:${TILE * scale}px;height:${TILE * scale}px"></span>`;
  }
  const { col, row } = chipPos(tile);
  const size = TILE * scale;
  return `<span class="spr" style="width:${size}px;height:${size}px;background-position:${-col * size}px ${-row * size}px;background-size:${COLS * size}px auto"></span>`;
}

type Card = {
  tile: number;
  lowerN: number;
  upperN: number;
  tags: string[];
  draftLabel: string;
  draftNote: string;
  category: string;
  priority: number;
};

const tileSet = new Set<number>([
  ...lowerCounts.keys(),
  ...upperCounts.keys(),
  ...(wall?.memberTileIds ?? []),
  INTERIOR_WALL_FRAME_FLOOR_TILE,
  INTERIOR_WALL_FRAME_TILES.cornerNW,
  INTERIOR_WALL_FRAME_TILES.body,
  INTERIOR_WALL_FRAME_TILES.edgeN,
  INTERIOR_WALL_FRAME_TILES.edgeS,
  INTERIOR_WALL_FRAME_TILES.edgeW,
  INTERIOR_WALL_FRAME_TILES.edgeE,
  104, 106, 396, 398, 456, 458,
  1, 2, 3, 31, 32, 33, 116, 270, 271, 300, 301,
]);

const cards: Card[] = [...tileSet]
  .filter((t) => t >= 0)
  .map((tile) => {
    const lowerN = lowerCounts.get(tile) ?? 0;
    const upperN = upperCounts.get(tile) ?? 0;
    const tags: string[] = [];
    if (members.has(tile)) tags.push("wall-frame-member");
    if (connect.has(tile) && !members.has(tile)) tags.push("connect-only");
    if (lowerN > 0) tags.push("lower");
    if (upperN > 0) tags.push("upper");
    if (lowerN === 0 && upperN === 0) tags.push("not-on-map");
    const d = DRAFTS[tile] ?? {
      label: "",
      note: ts.tileMeta?.[tile]?.label ? `기존 meta: ${ts.tileMeta[tile]!.label}` : "",
      category: upperN > 0 && lowerN === 0 ? "소품" : "기타",
    };
    // sort: on-map wallframe first, then other on-map, then members off, then rest
    let priority = 50;
    if (lowerN + upperN > 0) priority -= 30;
    if (members.has(tile)) priority -= 10;
    if (tile === 430 || tile === 72) priority -= 5;
    return {
      tile,
      lowerN,
      upperN,
      tags,
      draftLabel: d.label,
      draftNote: d.note,
      category: d.category,
      priority,
    };
  })
  .sort((a, b) => a.priority - b.priority || a.tile - b.tile);

// Full chipset interactive grid (only tiles that appear in cards or all 0..count-1 for richness?)
// User wants rich images — show full chipset clickable + card list for used ones
const chipsetCount = ts.count || 480;
const chipRows = Math.ceil(chipsetCount / COLS);

function cardHtml(c: Card): string {
  const pos = chipPos(c.tile);
  const samp = samples.get(c.tile) ?? [];
  const first = samp[0];
  const ctx = first && first.layer === "L" ? contextHtml(first.x, first.y, 3) : "";
  const sampleChips = samp
    .slice(0, 4)
    .map((s) => `<button type="button" class="sample-btn" data-x="${s.x}" data-y="${s.y}" data-layer="${s.layer}">${s.layer}(${s.x},${s.y})</button>`)
    .join("");

  return `
  <article class="card" id="tile-${c.tile}" data-tile="${c.tile}" data-tags="${esc(c.tags.join(" "))}" data-category="${esc(c.category)}">
    <div class="card-visual">
      <div class="mega">${sprite(c.tile, 8)}</div>
      <div class="mega-sm">${sprite(c.tile, 4)} ${sprite(c.tile, 2)}</div>
      <div class="ids">
        <div class="tile-id">#${c.tile}</div>
        <div class="chip">칩셋 (${pos.col}, ${pos.row})</div>
        <div class="counts">L <b>${c.lowerN}</b> · U <b>${c.upperN}</b></div>
        <div class="tags">${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      </div>
    </div>
    <div class="card-form">
      <label class="field">
        <span>카테고리</span>
        <input type="text" name="category" value="${esc(c.category)}" list="cat-list" />
      </label>
      <label class="field">
        <span>라벨 (이름) <em class="ai-hint">AI초안 → 고치세요</em></span>
        <input type="text" name="label" class="input-label" value="${esc(c.draftLabel)}" placeholder="이 타일이 뭔지 한글로…" />
      </label>
      <label class="field">
        <span>설명 / 쓰임</span>
        <textarea name="note" rows="3" placeholder="어디에 어떻게 쓰는지, 이웃 규칙 등">${esc(c.draftNote)}</textarea>
      </label>
      <label class="field row-check">
        <input type="checkbox" name="confirmed" />
        <span>검토 완료 (맞음)</span>
      </label>
      <label class="field">
        <span>내 메모</span>
        <input type="text" name="memo" placeholder="틀린 이유, 대체 이름…" />
      </label>
      ${ctx ? `<div class="ctx-block"><div class="ctx-title">맵 3×3 맥락 ${first ? `(중심 ${first.x},${first.y})` : ""}</div>${ctx}</div>` : ""}
      ${sampleChips ? `<div class="samples"><span class="ctx-title">출현</span> ${sampleChips}</div>` : `<div class="samples muted">이 맵에 없음</div>`}
    </div>
  </article>`;
}

// Map board with large cells
const mapCells: string[] = [];
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const L = map.lowerTiles[y * map.width + x]!;
    const U = map.upperTiles[y * map.width + x]!;
    const cls = [
      "mcell",
      members.has(L) ? "is-m" : "",
      L === 430 ? "is-v" : "",
      connect.has(L) && !members.has(L) ? "is-c" : "",
    ]
      .filter(Boolean)
      .join(" ");
    mapCells.push(`
      <button type="button" class="${cls}" data-x="${x}" data-y="${y}" data-tile="${L}" title="(${x},${y}) L${L}${U >= 0 ? " U" + U : ""}">
        <span class="mstack">
          ${sprite(L, 3)}
          ${U >= 0 ? `<span class="mupper">${sprite(U, 3)}</span>` : ""}
        </span>
        <span class="mmeta">${x},${y}<br/>${L}${U >= 0 ? "/" + U : ""}</span>
      </button>`);
  }
}

// Chipset full grid
const chipCells: string[] = [];
for (let i = 0; i < chipsetCount; i++) {
  const used = (lowerCounts.get(i) ?? 0) + (upperCounts.get(i) ?? 0) > 0;
  const mem = members.has(i);
  chipCells.push(`
    <button type="button" class="chip-cell${used ? " used" : ""}${mem ? " mem" : ""}" data-tile="${i}" title="#${i}">
      ${sprite(i, 2)}
      <span class="chip-n">${i}</span>
    </button>`);
}

const cardsJson = JSON.stringify(
  cards.map((c) => ({
    tile: c.tile,
    draftLabel: c.draftLabel,
    draftNote: c.draftNote,
    category: c.category,
    lowerN: c.lowerN,
    upperN: c.upperN,
    tags: c.tags,
  })),
);

const chipsetRel = "../../public/assets/easyrpg-chipset-interior-transparent.png";
// Also embed as absolute-ish path alternatives for file open
const chipsetRel2 = "../assets/../public/assets/easyrpg-chipset-interior-transparent.png";

const outDir = path.resolve("output/docs");
fs.mkdirSync(outDir, { recursive: true });
// copy chipset next to html so file:// always works
const chipLocal = path.join(outDir, "Interior-chipset.png");
const chipSrc = path.resolve("public/assets/easyrpg-chipset-interior-transparent.png");
fs.copyFileSync(chipSrc, chipLocal);

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>실내 타일 라벨 에디터 — 이미지 리치</title>
<style>
  :root {
    --bg: #0b0d12;
    --panel: #141922;
    --panel2: #1a2130;
    --text: #eef2fa;
    --muted: #8b95a8;
    --accent: #5b9dff;
    --accent2: #3dd68c;
    --warn: #ffb020;
    --border: #2a3344;
    --chip: url("Interior-chipset.png");
    --radius: 14px;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font: 15px/1.45 "Segoe UI", "Malgun Gothic", system-ui, sans-serif;
    background: radial-gradient(1200px 600px at 10% -10%, #1a2740 0%, transparent 50%), var(--bg);
    color: var(--text);
    padding-bottom: 120px;
  }
  .topbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    padding: 12px 18px;
    background: rgba(11,13,18,0.92);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
  }
  .topbar h1 { font-size: 1.05rem; margin: 0; margin-right: auto; }
  .topbar button, .topbar label.btn {
    appearance: none; border: 0; border-radius: 10px;
    padding: 9px 14px; font-weight: 700; cursor: pointer; font-size: 13px;
  }
  .btn-primary { background: var(--accent); color: #041018; }
  .btn-ok { background: var(--accent2); color: #041018; }
  .btn-ghost { background: var(--panel2); color: var(--text); border: 1px solid var(--border) !important; }
  .stat { color: var(--muted); font-size: 12px; }
  .wrap { padding: 18px 20px; max-width: 1400px; margin: 0 auto; }
  .hero {
    display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px;
  }
  @media (max-width: 960px) { .hero { grid-template-columns: 1fr; } }
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
  }
  .panel h2 { margin: 0 0 10px; font-size: 1rem; color: var(--accent); }
  .warn {
    background: #2a1f0c; border: 1px solid #6a4a12; border-left: 4px solid var(--warn);
    padding: 12px 14px; border-radius: 10px; margin-bottom: 16px; color: #ffe6b0;
  }
  /* sprites */
  .spr {
    display: inline-block;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    background-image: var(--chip);
    background-repeat: no-repeat;
    border: 1px solid rgba(0,0,0,0.8);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.06);
    vertical-align: middle;
  }
  .spr.empty {
    background: repeating-conic-gradient(#2a2a32 0% 25%, #1a1a20 0% 50%) 50% / 8px 8px;
  }

  /* map */
  .map-scroll { overflow: auto; max-height: 520px; border-radius: 12px; background: #07090e; padding: 8px; border: 1px solid var(--border); }
  .map-grid {
    display: grid;
    grid-template-columns: repeat(${map.width}, 58px);
    gap: 2px;
    width: max-content;
  }
  .mcell {
    appearance: none; border: 1px solid #2c3548; background: #12161f;
    border-radius: 6px; padding: 2px; cursor: pointer; color: inherit;
  }
  .mcell:hover, .mcell:focus { outline: 2px solid var(--accent); outline-offset: 0; z-index: 1; }
  .mcell.is-m { background: #142016; border-color: #2f5a35; }
  .mcell.is-c { background: #101c24; border-color: #2a5570; }
  .mcell.is-v { background: #101014; }
  .mstack { position: relative; display: block; width: 48px; height: 48px; margin: 0 auto; }
  .mstack .spr { width: 48px !important; height: 48px !important; }
  .mupper { position: absolute; inset: 0; pointer-events: none; }
  .mmeta { display: block; font-size: 9px; line-height: 1.15; color: var(--muted); text-align: center; font-family: ui-monospace, Consolas, monospace; margin-top: 2px; }

  /* chipset */
  .chip-scroll { overflow: auto; max-height: 420px; background: #05070b; border-radius: 12px; border: 1px solid var(--border); padding: 6px; }
  .chip-grid { display: grid; grid-template-columns: repeat(30, 40px); gap: 1px; width: max-content; }
  .chip-cell {
    appearance: none; border: 0; background: #0e1218; padding: 0; cursor: pointer;
    position: relative; width: 40px; height: 40px;
  }
  .chip-cell .spr { width: 32px !important; height: 32px !important; margin: 4px; }
  .chip-cell.used { outline: 1px solid #5b9dff; outline-offset: -1px; }
  .chip-cell.mem { background: #142016; }
  .chip-cell:hover { outline: 2px solid var(--warn); outline-offset: -2px; z-index: 1; }
  .chip-n { position: absolute; left: 0; right: 0; bottom: 0; font-size: 8px; text-align: center; color: #9aa; background: rgba(0,0,0,0.55); }

  /* filters */
  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; align-items: center; }
  .filters input[type="search"] {
    flex: 1; min-width: 200px; background: var(--panel); border: 1px solid var(--border);
    color: var(--text); border-radius: 10px; padding: 10px 12px; font-size: 14px;
  }
  .filters select {
    background: var(--panel); border: 1px solid var(--border); color: var(--text);
    border-radius: 10px; padding: 10px 12px;
  }
  .chip-toggle { display: inline-flex; gap: 6px; align-items: center; color: var(--muted); font-size: 13px; }

  /* cards */
  .cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .card {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 0;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    scroll-margin-top: 72px;
  }
  @media (max-width: 800px) { .card { grid-template-columns: 1fr; } }
  .card.confirmed { border-color: #2f8a55; box-shadow: 0 0 0 1px rgba(61,214,140,0.25); }
  .card-visual {
    background: linear-gradient(160deg, #1a2233, #0e121a 60%);
    padding: 16px;
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 12px; align-items: center;
  }
  .mega {
    background: #000;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #333;
    box-shadow: inset 0 0 40px rgba(0,0,0,0.6);
  }
  .mega .spr { width: 128px !important; height: 128px !important; border-width: 2px; }
  .mega-sm { display: flex; gap: 8px; align-items: center; }
  .ids { width: 100%; text-align: center; }
  .tile-id { font-size: 1.6rem; font-weight: 800; font-family: ui-monospace, Consolas, monospace; }
  .chip, .counts { color: var(--muted); font-size: 12px; }
  .tags { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
  .tag {
    font-size: 10px; padding: 2px 7px; border-radius: 999px;
    background: #243044; color: #c5d4ee; border: 1px solid #334;
  }
  .card-form { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field > span { font-size: 12px; color: var(--muted); font-weight: 600; }
  .ai-hint { color: var(--warn); font-weight: 500; font-style: normal; margin-left: 6px; }
  .field input[type="text"], .field textarea, .field select {
    width: 100%;
    background: #0a0d13;
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    padding: 11px 12px;
    font: inherit;
  }
  .field input.input-label { font-size: 17px; font-weight: 650; border-color: #3a4a66; }
  .field input.input-label:focus, .field textarea:focus {
    outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(91,157,255,0.2);
  }
  .row-check { flex-direction: row; align-items: center; gap: 10px; }
  .row-check input { width: 18px; height: 18px; }
  .ctx-block { margin-top: 4px; }
  .ctx-title { font-size: 12px; color: var(--muted); font-weight: 600; margin-bottom: 6px; }
  .ctx-grid {
    display: grid; grid-template-columns: repeat(3, 56px); gap: 3px;
    background: #07090e; padding: 8px; border-radius: 10px; width: max-content;
    border: 1px solid var(--border);
  }
  .ctx-cell {
    position: relative; width: 56px; height: 56px; background: #111;
    border-radius: 4px; overflow: hidden;
  }
  .ctx-cell.focus { outline: 2px solid var(--warn); outline-offset: -2px; }
  .ctx-cell .spr { width: 48px !important; height: 48px !important; margin: 4px; }
  .ctx-u { position: absolute; inset: 4px; }
  .ctx-id {
    position: absolute; left: 0; right: 0; bottom: 0;
    font-size: 9px; text-align: center; background: rgba(0,0,0,0.65); color: #ccc;
    font-family: ui-monospace, Consolas, monospace;
  }
  .samples { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .sample-btn {
    appearance: none; border: 1px solid var(--border); background: var(--panel2);
    color: var(--text); border-radius: 8px; padding: 4px 8px; font-size: 12px; cursor: pointer;
  }
  .sample-btn:hover { border-color: var(--accent); }
  .muted { color: var(--muted); }
  .dock {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
    background: rgba(10,12,18,0.95); border-top: 1px solid var(--border);
    padding: 10px 16px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
  }
  #export-out {
    display: none; position: fixed; inset: 8% 8%; z-index: 80;
    background: #0e121a; border: 1px solid var(--border); border-radius: 14px;
    padding: 16px; box-shadow: 0 20px 80px rgba(0,0,0,0.6);
  }
  #export-out.open { display: flex; flex-direction: column; gap: 10px; }
  #export-out textarea {
    flex: 1; width: 100%; background: #05070b; color: #cde; border: 1px solid var(--border);
    border-radius: 10px; padding: 12px; font-family: ui-monospace, Consolas, monospace; font-size: 12px;
  }
  #export-out .row { display: flex; gap: 8px; justify-content: flex-end; }
  .backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 70; }
  .backdrop.open { display: block; }
  datalist { display: none; }
</style>
</head>
<body>
  <div class="topbar">
    <h1>실내 타일 라벨 에디터 <span class="stat">map_interior_blank · ${map.width}×${map.height}</span></h1>
    <span class="stat" id="progress">—</span>
    <button type="button" class="btn-ghost" id="btn-filter-todo">미검토만</button>
    <button type="button" class="btn-ghost" id="btn-filter-all">전체</button>
    <button type="button" class="btn-ok" id="btn-export">JSON 내보내기</button>
  </div>

  <div class="wrap">
    <div class="warn">
      <strong>사용법:</strong> 왼쪽 큰 그림 보고 → <strong>라벨</strong> 칸을 고치세요. AI 초안이 틀리면 덮어쓰면 됩니다.
      맞으면 <strong>검토 완료</strong> 체크. 맵/칩셋 칸 클릭하면 해당 카드로 점프합니다.
      저장은 브라우저 localStorage + 내보내기 JSON.
    </div>

    <div class="hero">
      <section class="panel">
        <h2>맵 (클릭 → 타일 카드)</h2>
        <div class="map-scroll">
          <div class="map-grid">${mapCells.join("")}</div>
        </div>
      </section>
      <section class="panel">
        <h2>칩셋 전체 (클릭 → 카드 / 강조)</h2>
        <p class="muted" style="margin:0 0 8px;font-size:12px">파란 테두리=맵 사용 · 초록 톤=wall-frame 멤버 · 파일 옆 <code>Interior-chipset.png</code></p>
        <div class="chip-scroll">
          <div class="chip-grid">${chipCells.join("")}</div>
        </div>
        <div style="margin-top:10px">
          <img src="Interior-chipset.png" alt="full chipset" width="480" style="max-width:100%;image-rendering:pixelated;border-radius:8px;border:1px solid var(--border);background:#000" />
        </div>
      </section>
    </div>

    <div class="filters">
      <input type="search" id="q" placeholder="검색: 타일번호, 라벨, 태그…" />
      <select id="filter-tag">
        <option value="">모든 태그</option>
        <option value="lower">lower 사용</option>
        <option value="upper">upper 사용</option>
        <option value="wall-frame-member">wall-frame member</option>
        <option value="connect-only">connect-only</option>
        <option value="not-on-map">맵에 없음</option>
      </select>
      <label class="chip-toggle"><input type="checkbox" id="only-on-map" checked /> 맵에 있는 타일만</label>
    </div>

    <div class="cards" id="cards">
      ${cards.map(cardHtml).join("\n")}
    </div>
  </div>

  <div class="dock">
    <span class="stat" id="dock-stat">수정하면 자동 저장됩니다</span>
    <button type="button" class="btn-primary" id="btn-export2">수정본 JSON 내보내기</button>
    <button type="button" class="btn-ghost" id="btn-copy">복사</button>
    <button type="button" class="btn-ghost" id="btn-download">파일 저장</button>
  </div>

  <div class="backdrop" id="backdrop"></div>
  <div id="export-out">
    <h3 style="margin:0">export JSON</h3>
    <textarea id="export-ta"></textarea>
    <div class="row">
      <button type="button" class="btn-ghost" id="btn-close">닫기</button>
      <button type="button" class="btn-primary" id="btn-copy2">복사</button>
    </div>
  </div>

  <datalist id="cat-list">
    <option value="배경"></option>
    <option value="바닥"></option>
    <option value="벽프레임"></option>
    <option value="장식"></option>
    <option value="소품"></option>
    <option value="하네스벽"></option>
    <option value="하네스바닥"></option>
    <option value="기타"></option>
  </datalist>

  <script>
    const STORAGE = "rpgzzu-interior-tile-editor-v2";
    const DRAFTS = ${cardsJson};
    const mapW = ${map.width};

    function load() {
      try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { return {}; }
    }
    function collect() {
      const out = {};
      document.querySelectorAll(".card").forEach((card) => {
        const tile = card.getAttribute("data-tile");
        const label = card.querySelector('[name="label"]').value.trim();
        const note = card.querySelector('[name="note"]').value.trim();
        const category = card.querySelector('[name="category"]').value.trim();
        const memo = card.querySelector('[name="memo"]').value.trim();
        const confirmed = card.querySelector('[name="confirmed"]').checked;
        const draft = DRAFTS.find((d) => String(d.tile) === tile);
        const changed = !draft || label !== (draft.draftLabel || "") || note !== (draft.draftNote || "") || category !== (draft.category || "");
        if (label || note || memo || confirmed || changed) {
          out[tile] = { label, note, category, memo, confirmed, changed };
        }
        card.classList.toggle("confirmed", confirmed);
      });
      return out;
    }
    function save() {
      const data = collect();
      localStorage.setItem(STORAGE, JSON.stringify(data));
      updateProgress(data);
      document.getElementById("dock-stat").textContent = "저장됨 " + new Date().toLocaleTimeString();
      return data;
    }
    function restore() {
      const data = load();
      for (const [tile, v] of Object.entries(data)) {
        const card = document.getElementById("tile-" + tile);
        if (!card) continue;
        if (v.label != null) card.querySelector('[name="label"]').value = v.label;
        if (v.note != null) card.querySelector('[name="note"]').value = v.note;
        if (v.category != null) card.querySelector('[name="category"]').value = v.category;
        if (v.memo != null) card.querySelector('[name="memo"]').value = v.memo;
        if (v.confirmed) card.querySelector('[name="confirmed"]').checked = true;
        card.classList.toggle("confirmed", !!v.confirmed);
      }
      updateProgress(data);
    }
    function updateProgress(data) {
      const total = document.querySelectorAll(".card:not([hidden])").length;
      const confirmed = [...document.querySelectorAll(".card:not([hidden])")].filter((c) => c.querySelector('[name="confirmed"]').checked).length;
      const edited = Object.values(data || load()).filter((v) => v.changed || v.confirmed).length;
      document.getElementById("progress").textContent = "검토 " + confirmed + " / 표시 " + total + " · 편집기록 " + edited;
    }
    function exportPayload() {
      const corrections = save();
      return {
        mapId: "map_interior_blank",
        tilesetId: ${JSON.stringify(map.tilesetId)},
        exportedAt: new Date().toISOString(),
        corrections,
        // flat list for convenience
        tiles: DRAFTS.map((d) => {
          const c = corrections[d.tile] || corrections[String(d.tile)] || {};
          return {
            tile: d.tile,
            label: c.label != null && c.label !== "" ? c.label : d.draftLabel,
            note: c.note != null && c.note !== "" ? c.note : d.draftNote,
            category: c.category || d.category,
            confirmed: !!c.confirmed,
            userEdited: !!c.changed,
            memo: c.memo || "",
            lowerCount: d.lowerN,
            upperCount: d.upperN,
            tags: d.tags,
          };
        }),
      };
    }
    function showExport() {
      const text = JSON.stringify(exportPayload(), null, 2);
      document.getElementById("export-ta").value = text;
      document.getElementById("export-out").classList.add("open");
      document.getElementById("backdrop").classList.add("open");
      return text;
    }
    function hideExport() {
      document.getElementById("export-out").classList.remove("open");
      document.getElementById("backdrop").classList.remove("open");
    }
    async function copyText(text) {
      try { await navigator.clipboard.writeText(text); alert("복사됨"); }
      catch { document.getElementById("export-ta").select(); document.execCommand("copy"); }
    }
    function download(text) {
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "interior-tile-labels-corrected.json";
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function applyFilters() {
      const q = document.getElementById("q").value.trim().toLowerCase();
      const tag = document.getElementById("filter-tag").value;
      const onlyOnMap = document.getElementById("only-on-map").checked;
      const onlyTodo = document.body.dataset.onlyTodo === "1";
      document.querySelectorAll(".card").forEach((card) => {
        const tile = card.getAttribute("data-tile");
        const tags = card.getAttribute("data-tags") || "";
        const label = card.querySelector('[name="label"]').value.toLowerCase();
        const note = card.querySelector('[name="note"]').value.toLowerCase();
        const confirmed = card.querySelector('[name="confirmed"]').checked;
        let ok = true;
        if (onlyOnMap && tags.includes("not-on-map")) ok = false;
        if (tag && !tags.includes(tag)) ok = false;
        if (onlyTodo && confirmed) ok = false;
        if (q) {
          const hay = tile + " " + tags + " " + label + " " + note + " " + (card.getAttribute("data-category") || "");
          if (!hay.toLowerCase().includes(q)) ok = false;
        }
        card.hidden = !ok;
      });
      updateProgress(load());
    }

    function jumpTile(tile) {
      const card = document.getElementById("tile-" + tile);
      if (!card) return;
      card.hidden = false;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.style.boxShadow = "0 0 0 3px var(--accent)";
      setTimeout(() => { card.style.boxShadow = ""; }, 1200);
      const input = card.querySelector(".input-label");
      if (input) input.focus();
    }

    document.querySelectorAll(".card input, .card textarea").forEach((el) => {
      el.addEventListener("input", () => { save(); applyFilters(); });
      el.addEventListener("change", () => { save(); applyFilters(); });
    });
    document.getElementById("q").addEventListener("input", applyFilters);
    document.getElementById("filter-tag").addEventListener("change", applyFilters);
    document.getElementById("only-on-map").addEventListener("change", applyFilters);
    document.getElementById("btn-filter-todo").onclick = () => { document.body.dataset.onlyTodo = "1"; applyFilters(); };
    document.getElementById("btn-filter-all").onclick = () => { document.body.dataset.onlyTodo = "0"; applyFilters(); };

    document.querySelectorAll(".mcell").forEach((btn) => {
      btn.addEventListener("click", () => jumpTile(btn.getAttribute("data-tile")));
    });
    document.querySelectorAll(".chip-cell").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("only-on-map").checked = false;
        applyFilters();
        jumpTile(btn.getAttribute("data-tile"));
      });
    });
    document.querySelectorAll(".sample-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const x = btn.getAttribute("data-x");
        const y = btn.getAttribute("data-y");
        const cell = document.querySelector('.mcell[data-x="' + x + '"][data-y="' + y + '"]');
        if (cell) {
          cell.scrollIntoView({ behavior: "smooth", block: "center" });
          cell.focus();
        }
      });
    });

    document.getElementById("btn-export").onclick = showExport;
    document.getElementById("btn-export2").onclick = showExport;
    document.getElementById("btn-copy").onclick = () => copyText(JSON.stringify(exportPayload(), null, 2));
    document.getElementById("btn-copy2").onclick = () => copyText(document.getElementById("export-ta").value);
    document.getElementById("btn-download").onclick = () => download(JSON.stringify(exportPayload(), null, 2));
    document.getElementById("btn-close").onclick = hideExport;
    document.getElementById("backdrop").onclick = hideExport;

    restore();
    applyFilters();
  </script>
</body>
</html>
`;

const outPath = path.join(outDir, "interior-tile-label-editor.html");
fs.writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath);
console.log("chipset copy", chipLocal);
console.log("cards", cards.length);
