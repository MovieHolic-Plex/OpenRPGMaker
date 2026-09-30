/**
 * EasyRPG RTP Combined Town ChipSet — 구현/AI 사용 방식 이미지 리치 HTML 보고서.
 *
 * 데이터 출처(모두 런타임 import — 손으로 옮겨 적은 수치 없음):
 *   - src/assets/resourceSlicing.ts            시트 기하
 *   - src/project/defaults/defaultAssets.ts    하네스 적용 후의 실제 타일셋(priority/passability/terrain/tileMeta)
 *   - src/project/tilesetHarness/combinedTownGroups.ts  하네스 그룹 계약
 *   - src/project/defaults/tileSemanticsCombinedTown.ts 검색용 시맨틱 테이블
 *   - src/project/defaults/autotileGroups.ts   오토타일 그룹 + 앵커 격자
 *   - src/project/defaults/chipsetAnimation.ts 물 애니메이션 스트립
 *   - src/project/tileVocabulary.ts            AI material 어휘(approvedVocabulary)
 *
 * 실행: node scripts/gen-combined-town-chipset-report.mts (esbuild 번들 경유 — README of task)
 * 산출: combined-town-chipset-report.html
 */
import fs from "node:fs";
import path from "node:path";
import { RESOURCE_SLICING } from "../src/assets/resourceSlicing.ts";
import { combinedTownTileset as combinedTownTileset as defaultTileset } from "../src/project/defaults/defaultAssets.ts";
import {
  COMBINED_TOWN_HARNESS_GROUPS,
  COMBINED_TOWN_ROOF_OVERLAY_TILES,
} from "../src/project/tilesetHarness/combinedTownGroups.ts";
import {
  TREE_CANOPY_TILE_IDS,
  TREE_TRUNK_TILE_IDS,
  isUpperOnlyOverlayTile,
  combinedTownHarnessPrompt,
} from "../src/project/tilesetHarness/combinedTown.ts";
import { COMBINED_TOWN_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsCombinedTown.ts";
import {
  DEFAULT_AUTOTILE_GROUPS,
  TERRAIN_TEMPLATE_ANCHORS,
  templateBlockFromAnchor,
} from "../src/project/defaults/autotileGroups.ts";
import { CHIPSET_ANIMATION_STRIPS } from "../src/project/defaults/chipsetAnimation.ts";
import { isTransparentChipsetTile, TERRAIN_TAG } from "../src/project/defaults/chipsetMapping.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import { approvedVocabulary, resolveMaterialByLabel } from "../src/project/tileVocabulary.ts";

// ── 기하 ────────────────────────────────────────────────────────────────────
const SHEET = RESOURCE_SLICING.chipset;
const COLS = SHEET.columns;
const CELL = SHEET.cellWidth;
const SHEET_W = SHEET.sheetWidth;
const SHEET_H = SHEET.sheetHeight;

const CHIPSET_PNG = path.resolve("public/assets/easyrpg-chipset-combined-town-transparent.png");
const OUT_HTML = path.resolve("combined-town-chipset-report.html");

const tileset = defaultTileset();
const vocab = approvedVocabulary(tileset);
const harnessPrompt = combinedTownHarnessPrompt(tileset) as {
  readonly active: boolean;
  readonly rules?: readonly string[];
  readonly groups?: readonly unknown[];
};

// ── 파생 인덱스 ─────────────────────────────────────────────────────────────
const groupOfTile = new Map<number, (typeof COMBINED_TOWN_HARNESS_GROUPS)[number]>();
for (const group of COMBINED_TOWN_HARNESS_GROUPS) {
  for (const tile of group.tileIds) if (!groupOfTile.has(tile)) groupOfTile.set(tile, group);
}
const semanticOfTile = new Map(COMBINED_TOWN_TILE_SEMANTICS.map((entry) => [entry.index, entry]));
const autotileMemberOf = new Map<number, string>();
for (const group of DEFAULT_AUTOTILE_GROUPS) {
  for (const tile of group.memberTileIds) if (!autotileMemberOf.has(tile)) autotileMemberOf.set(tile, group.name);
}
const animatedTiles = new Set<number>(CHIPSET_ANIMATION_STRIPS.flatMap((strip) => strip.frames));

const isSolid = (tile: number): boolean => {
  const flag = tileset.passability[tile];
  return !flag.up && !flag.down && !flag.left && !flag.right;
};
const isPartial = (tile: number): boolean => {
  const flag = tileset.passability[tile];
  const values = [flag.up, flag.down, flag.left, flag.right];
  return values.some(Boolean) && values.some((value) => !value);
};

const stats = {
  total: tileset.count,
  inHarnessGroup: groupOfTile.size,
  groups: COMBINED_TOWN_HARNESS_GROUPS.length,
  semantics: semanticOfTile.size,
  labelled: tileset.tileMeta!.filter((meta) => meta.label.trim().length > 0).length,
  upper: tileset.priority.filter((p) => p === "upper").length,
  lower: tileset.priority.filter((p) => p === "lower").length,
  solid: Array.from({ length: tileset.count }, (_, tile) => tile).filter(isSolid).length,
  partial: Array.from({ length: tileset.count }, (_, tile) => tile).filter(isPartial).length,
  transparent: Array.from({ length: tileset.count }, (_, tile) => tile).filter(isTransparentChipsetTile).length,
  upperOnlyOverlay: Array.from({ length: tileset.count }, (_, tile) => tile).filter((tile) => isUpperOnlyOverlayTile(tileset, tile)).length,
  autotileGroups: DEFAULT_AUTOTILE_GROUPS.length,
  autotileMembers: autotileMemberOf.size,
  animated: animatedTiles.size,
  animationStrips: CHIPSET_ANIMATION_STRIPS.length,
  vocabGroups: vocab.groups.length,
  vocabTiles: vocab.tiles.length,
  uncovered: 0,
};
stats.uncovered = Array.from({ length: tileset.count }, (_, tile) => tile).filter(
  (tile) => !groupOfTile.has(tile) && !semanticOfTile.has(tile) && !autotileMemberOf.has(tile),
).length;

// ── HTML 도구 ───────────────────────────────────────────────────────────────
const sheetDataUrl = `data:image/png;base64,${fs.readFileSync(CHIPSET_PNG).toString("base64")}`;

function esc(value: unknown): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function label(tile: number): string {
  const meta = tileset.tileMeta?.[tile];
  if (meta?.label.trim()) return meta.label.trim();
  return semanticOfTile.get(tile)?.label ?? `타일 ${tile}`;
}

function passageText(tile: number): string {
  if (isPartial(tile)) {
    const f = tileset.passability[tile];
    const blocked = [!f.up && "↑", !f.down && "↓", !f.left && "←", !f.right && "→"].filter(Boolean).join("");
    return `부분 통행(${blocked} 막힘)`;
  }
  return isSolid(tile) ? "통행 불가 ×" : "통행 가능 ○";
}

function tileTitle(tile: number): string {
  const group = groupOfTile.get(tile);
  const parts = [
    `#${tile} (col ${tile % COLS}, row ${Math.floor(tile / COLS)})`,
    label(tile),
    `레이어 ${tileset.priority[tile]}`,
    passageText(tile),
    `terrain ${tileset.terrain[tile]}`,
  ];
  if (group) parts.push(`그룹 ${group.name} [${group.id}]`);
  if (autotileMemberOf.has(tile)) parts.push(`오토타일 ${autotileMemberOf.get(tile)}`);
  if (animatedTiles.has(tile)) parts.push("애니메이션 프레임");
  return parts.join(" · ");
}

/** 타일 스프라이트 한 칸. scale 배율만큼 확대해 픽셀 아트 그대로 보여준다. */
function chip(tile: number, scale = 3, caption: string | null = String(tile), extraClass = ""): string {
  const col = tile % COLS;
  const row = Math.floor(tile / COLS);
  const size = CELL * scale;
  const style = [
    `width:${size}px`,
    `height:${size}px`,
    `background-size:${SHEET_W * scale}px ${SHEET_H * scale}px`,
    `background-position:-${col * size}px -${row * size}px`,
  ].join(";");
  const cap = caption === null ? "" : `<figcaption>${esc(caption)}</figcaption>`;
  return `<figure class="chip ${extraClass}" title="${esc(tileTitle(tile))}"><span class="t" style="${style}"></span>${cap}</figure>`;
}

function chips(tiles: readonly number[], scale = 3, captioner: (tile: number) => string = String): string {
  return `<div class="chips">${tiles.map((tile) => chip(tile, scale, captioner(tile))).join("")}</div>`;
}

/** 라벨까지 붙는 큰 카드형 칩. */
function namedChip(tile: number, scale = 3): string {
  return `<figure class="chip named" title="${esc(tileTitle(tile))}">
    <span class="t" style="width:${CELL * scale}px;height:${CELL * scale}px;background-size:${SHEET_W * scale}px ${SHEET_H * scale}px;background-position:-${(tile % COLS) * CELL * scale}px -${Math.floor(tile / COLS) * CELL * scale}px"></span>
    <figcaption><b>${tile}</b><span>${esc(label(tile))}</span></figcaption>
  </figure>`;
}

const ROLE_COLOR: Record<string, string> = {
  terrain: "#4ea1ff",
  water: "#2fd0d6",
  wall: "#c89a5b",
  building: "#e0803f",
  roof: "#e05a5a",
  prop: "#9b7fe8",
  fence: "#8a8f98",
  event: "#f0c04a",
};

function roleColor(role: string | undefined): string {
  return (role && ROLE_COLOR[role]) || "#5b6068";
}

// ── 섹션: 커버리지 격자(30×16 전체) ─────────────────────────────────────────
function coverageGrid(): string {
  const scale = 2;
  const size = CELL * scale;
  const cells: string[] = [];
  for (let tile = 0; tile < tileset.count; tile += 1) {
    const group = groupOfTile.get(tile);
    const color = group ? roleColor(group.role) : semanticOfTile.has(tile) ? "#3b4048" : "#23262b";
    const upper = tileset.priority[tile] === "upper";
    const classes = ["cell"];
    if (upper) classes.push("is-upper");
    if (autotileMemberOf.has(tile)) classes.push("is-auto");
    if (animatedTiles.has(tile)) classes.push("is-anim");
    if (!group && !semanticOfTile.has(tile)) classes.push("is-bare");
    cells.push(
      `<span class="${classes.join(" ")}" style="--edge:${color};width:${size}px;height:${size}px;background-size:${SHEET_W * scale}px ${SHEET_H * scale}px;background-position:-${(tile % COLS) * size}px -${Math.floor(tile / COLS) * size}px" title="${esc(tileTitle(tile))}"></span>`,
    );
  }
  return `<div class="cov" style="grid-template-columns:repeat(${COLS},${size}px)">${cells.join("")}</div>`;
}

// ── 섹션: 하네스 그룹 카탈로그 ──────────────────────────────────────────────
function groupCard(group: (typeof COMBINED_TOWN_HARNESS_GROUPS)[number]): string {
  const shortId = group.id.replace("harness-combined-town-", "");
  const grammar = group.patternGrammar?.kind ?? "single";
  const runtimeLayers = new Set(group.tileIds.map((tile) => tileset.priority[tile]));
  const tiles = group.tileIds.slice(0, 24);
  const overflow = group.tileIds.length - tiles.length;
  const rules = (group.rules ?? []).map(
    (rule) => `<li><code>${esc(rule.kind)}</code> <span class="pill sm ${rule.strength === "hard" ? "hard" : "soft"}">${esc(rule.strength)}</span> ${esc(rule.message)}</li>`,
  );
  return `<article class="gcard" style="--role:${roleColor(group.role)}">
    <header>
      <h4>${esc(group.name)}</h4>
      <code class="gid">${esc(shortId)}</code>
    </header>
    <div class="badges">
      <span class="pill role">${esc(group.role)}</span>
      <span class="pill">계약 ${esc(group.defaultLayer)}</span>
      <span class="pill">런타임 ${[...runtimeLayers].join("+")}</span>
      <span class="pill">${group.passage === "solid" ? "통행 ×" : "통행 ○"}</span>
      <span class="pill">${esc(group.repeatability)}</span>
      <span class="pill">${esc(grammar)}</span>
      ${group.stackable ? '<span class="pill">stackable</span>' : ""}
      <span class="pill dim">${group.tileIds.length}칸</span>
    </div>
    <p class="desc">${esc(group.description ?? "")}</p>
    ${group.placementRules && group.placementRules !== group.description ? `<p class="rules">배치: ${esc(group.placementRules)}</p>` : ""}
    ${chips(tiles, 3, (tile) => String(tile))}
    ${overflow > 0 ? `<p class="more">… +${overflow}칸</p>` : ""}
    ${rules.length ? `<ul class="rulelist">${rules.join("")}</ul>` : ""}
  </article>`;
}

// ── 섹션: 3×4 템플릿 블록 ──────────────────────────────────────────────────
function templateBlock(anchor: number, name: string): string {
  const t = templateBlockFromAnchor(anchor);
  const cell = (tile: number, role: string): string =>
    `<div class="tb-cell"><span class="tb-role">${esc(role)}</span>${chip(tile, 3, String(tile))}</div>`;
  return `<div class="tblock">
    <h5>${esc(name)} <code>anchor ${anchor}</code></h5>
    <div class="tb-top">${cell(t.isolated, "외딴")}${cell(t.inner, "오목")}</div>
    <div class="tb-grid">
      ${cell(t.cornerNW, "NW")}${cell(t.edgeN, "N")}${cell(t.cornerNE, "NE")}
      ${cell(t.edgeW, "W")}${cell(t.body, "몸통")}${cell(t.edgeE, "E")}
      ${cell(t.cornerSW, "SW")}${cell(t.edgeS, "S")}${cell(t.cornerSE, "SE")}
    </div>
  </div>`;
}

// ── 조립 ───────────────────────────────────────────────────────────────────
const roleLegend = Object.entries(ROLE_COLOR)
  .filter(([role]) => COMBINED_TOWN_HARNESS_GROUPS.some((group) => group.role === role))
  .map(([role, color]) => `<span class="lg"><i style="background:${color}"></i>${esc(role)}</span>`)
  .join("");

const groupsByRole = new Map<string, (typeof COMBINED_TOWN_HARNESS_GROUPS)[number][]>();
for (const group of COMBINED_TOWN_HARNESS_GROUPS) {
  const list = groupsByRole.get(group.role) ?? [];
  list.push(group);
  groupsByRole.set(group.role, list);
}
const ROLE_ORDER = ["terrain", "water", "wall", "building", "roof", "fence", "prop"];
const roleSections = [...groupsByRole.entries()]
  .sort((a, b) => (ROLE_ORDER.indexOf(a[0]) + 99 * Number(ROLE_ORDER.indexOf(a[0]) < 0)) - (ROLE_ORDER.indexOf(b[0]) + 99 * Number(ROLE_ORDER.indexOf(b[0]) < 0)))
  .map(
    ([role, groups]) => `<h3 class="rolehead" style="--role:${roleColor(role)}">${esc(role)} <span class="dim">${groups.length}그룹</span></h3>
    <div class="gcards">${groups.map(groupCard).join("")}</div>`,
  )
  .join("");

const anchorRows = TERRAIN_TEMPLATE_ANCHORS.map((entry) => {
  const kindText = { group: "내장 오토타일 그룹", water: "별도 물 시스템", strip: "애니 스트립", base: "기본 바닥(승격 금지)" }[entry.kind];
  return `<tr>
    <td class="c">${chip(entry.anchor, 3, String(entry.anchor))}</td>
    <td><b>${esc(entry.label)}</b></td>
    <td>${esc(kindText)}</td>
    <td><code>${esc(entry.groupId ?? "—")}</code></td>
  </tr>`;
}).join("");

const animRows = CHIPSET_ANIMATION_STRIPS.map(
  (strip) => `<tr>
    <td><code>${esc(strip.key)}</code></td>
    <td>${strip.fps} fps</td>
    <td>${chips(strip.frames, 3, String)}</td>
  </tr>`,
).join("");

const trapTiles = [TILE.FLOOR, 343, TILE.STAIRS, 426];
const bannedTiles = [411, 412, 413, 443, 441, 442];
const treeRows = [
  { top: 260, bottom: 290, name: "침엽수" },
  { top: 261, bottom: 291, name: "마른나무(상단 세로 연장 가능)" },
  { top: 262, bottom: 292, name: "활엽수 좌열" },
  { top: 263, bottom: 293, name: "활엽수 우열" },
];

// ── 섹션: material 라벨 해석 실측 ───────────────────────────────────────────
// LLM이 실제로 넣는 문자열을 그대로 resolveMaterialByLabel에 통과시켜 결과를 그림으로 보여준다.
const MATERIAL_PROBES: readonly { readonly query: string; readonly note: string; readonly opts?: Parameters<typeof resolveMaterialByLabel>[2] }[] = [
  { query: "흙길 오토타일", note: "오토타일 그룹 정확 일치 — fill_region/lay_path" , opts: { requireAutotileGroup: true } },
  { query: "물", note: "애니메이션 수면 — 그룹 전개" },
  { query: "침엽수", note: "2칸 세로 원자 — place_props" },
  { query: "나무 상자", note: "낱개 소품" },
  { query: "탁자", note: "모호 질의 → 동의어 확장" },
  { query: "마을 소품", note: "가방(bag) 라벨 → 거절" },
  { query: "harness-combined-town-fence", note: "그룹 id 직접 입력 → 거절" },
];

function materialProbeRow(probe: (typeof MATERIAL_PROBES)[number]): string {
  const result = resolveMaterialByLabel(tileset, probe.query, probe.opts ?? {});
  if (result.status === "missing") {
    const suggestions = result.suggestions.slice(0, 4);
    return `<tr class="reject">
      <td><code>"${esc(probe.query)}"</code><br><span class="faint" style="font-size:11.5px">${esc(probe.note)}</span></td>
      <td><span class="pill hard">거절 missing</span></td>
      <td>
        <p style="margin:0 0 6px;font-size:12.5px;color:#ffcbcb">${esc(result.message)}</p>
        ${suggestions.length ? `<div class="dim" style="font-size:11.5px">대안 제시:</div>${chips(suggestions.map((s) => s.tileId), 2, (tile) => String(tile))}` : ""}
      </td>
    </tr>`;
  }
  const tiles = result.kind === "group" ? result.group.tileIds.slice(0, 12) : [result.tileId];
  return `<tr>
    <td><code>"${esc(probe.query)}"</code><br><span class="faint" style="font-size:11.5px">${esc(probe.note)}</span></td>
    <td>
      <span class="pill ${result.status === "approved" ? "soft" : ""}">${esc(result.status)}</span>
      <span class="pill">${esc(result.kind)}</span>
      ${result.kind === "group" ? `<br><span class="faint" style="font-size:11px">${esc(result.group.name)}</span>` : ""}
    </td>
    <td>${chips(tiles, 2, String)}${result.kind === "group" && result.group.tileIds.length > 12 ? `<span class="faint" style="font-size:11px">+${result.group.tileIds.length - 12}칸</span>` : ""}</td>
  </tr>`;
}

const materialProbeRows = MATERIAL_PROBES.map(materialProbeRow).join("");

const semanticRoleCounts = new Map<string, number>();
for (const entry of COMBINED_TOWN_TILE_SEMANTICS) {
  semanticRoleCounts.set(entry.role, (semanticRoleCounts.get(entry.role) ?? 0) + 1);
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EasyRPG RTP Combined Town ChipSet — 구현 · AI 사용 보고서</title>
<style>
  :root{
    --sheet:url("${sheetDataUrl}");
    --bg:#0e1014; --bg2:#14171d; --card:#191d24; --line:#272c35;
    --ink:#e8ebf0; --dim:#9aa3b0; --faint:#6b7480;
    --accent:#6ea8fe; --warn:#ffb454; --bad:#ff6b6b; --ok:#5ddba0;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.65 -apple-system,"Segoe UI","Malgun Gothic",system-ui,sans-serif;}
  .wrap{max-width:1180px;margin:0 auto;padding:0 24px 96px}
  header.top{padding:56px 0 32px;border-bottom:1px solid var(--line);margin-bottom:36px}
  header.top .kicker{color:var(--accent);font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:700}
  h1{font-size:34px;line-height:1.25;margin:12px 0 10px;letter-spacing:-.02em}
  header.top p{color:var(--dim);max-width:74ch;margin:0}
  h2{font-size:23px;margin:56px 0 6px;letter-spacing:-.01em}
  h2 .num{color:var(--faint);font-variant-numeric:tabular-nums;margin-right:10px;font-size:16px}
  h2+.lede{color:var(--dim);margin:0 0 22px;max-width:80ch}
  h3{font-size:17px;margin:34px 0 12px}
  h4{margin:0;font-size:15px}
  h5{margin:0 0 10px;font-size:13px;color:var(--dim);font-weight:600}
  code{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:.88em;
    background:#0000003d;border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:#cfd6e0}
  a{color:var(--accent)}
  .dim{color:var(--dim)} .faint{color:var(--faint)}

  /* 타일 칩 */
  .t{display:block;background-image:var(--sheet);image-rendering:pixelated;
    background-repeat:no-repeat;border-radius:2px;
    background-color:#0000;box-shadow:inset 0 0 0 1px #ffffff14}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
  .chip{margin:0;display:flex;flex-direction:column;align-items:center;gap:3px}
  .chip figcaption{font:600 10px/1 ui-monospace,monospace;color:var(--faint);font-variant-numeric:tabular-nums}
  .chip.named{background:#0000004d;border:1px solid var(--line);border-radius:8px;padding:8px;min-width:104px}
  .chip.named figcaption{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px}
  .chip.named figcaption b{color:var(--ink);font-size:11px}
  .chip.named figcaption span{color:var(--dim);font:400 11px/1.3 inherit;text-align:center}
  .checker{background-image:linear-gradient(45deg,#20242b 25%,transparent 25%,transparent 75%,#20242b 75%),
    linear-gradient(45deg,#20242b 25%,transparent 25%,transparent 75%,#20242b 75%);
    background-size:12px 12px;background-position:0 0,6px 6px;background-color:#16191f}

  /* 카드/표 */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px;margin:20px 0 8px}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
  .stat b{display:block;font-size:26px;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
  .stat span{font-size:12px;color:var(--dim)}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);font-weight:700}
  td.c{width:1%;white-space:nowrap}
  tbody tr:hover{background:#ffffff06}

  .pill{display:inline-block;font:600 10.5px/1.6 ui-monospace,monospace;padding:0 7px;border-radius:999px;
    background:#ffffff0f;border:1px solid var(--line);color:var(--dim);white-space:nowrap}
  .pill.role{background:color-mix(in srgb,var(--role) 22%,transparent);border-color:color-mix(in srgb,var(--role) 45%,transparent);color:#fff}
  .pill.dim{color:var(--faint)}
  .pill.hard{background:#ff6b6b26;border-color:#ff6b6b55;color:#ffb3b3}
  .pill.soft{background:#5ddba022;border-color:#5ddba055;color:#a6e9c9}

  .gcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;
    justify-content:start;align-items:start}
  .gcard{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--role);
    border-radius:10px;padding:14px 16px 16px;max-width:560px}
  .gcard header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px}
  .gcard .gid{font-size:10.5px;color:var(--faint);background:none;border:0;padding:0}
  .gcard .badges{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
  .gcard .desc{margin:0;font-size:13px;color:var(--dim)}
  .gcard .rules{margin:6px 0 0;font-size:12px;color:var(--faint)}
  .gcard .more{margin:0;font-size:11px;color:var(--faint)}
  .rulelist{margin:10px 0 0;padding-left:16px;font-size:12px;color:var(--dim)}
  .rulelist li{margin:4px 0}
  .rolehead{display:flex;align-items:center;gap:10px;margin:34px 0 12px;font-size:15px;
    text-transform:uppercase;letter-spacing:.1em}
  .rolehead::before{content:"";width:10px;height:10px;border-radius:3px;background:var(--role)}

  /* 커버리지 격자 */
  .cov{display:grid;gap:2px;padding:12px;background:#0a0c10;border:1px solid var(--line);
    border-radius:10px;overflow-x:auto}
  .cov .cell{background-image:var(--sheet);image-rendering:pixelated;background-repeat:no-repeat;
    box-shadow:inset 0 0 0 1.5px var(--edge);border-radius:2px;position:relative}
  .cov .cell.is-bare{opacity:.42;filter:grayscale(.7)}
  .cov .cell.is-upper::after{content:"";position:absolute;top:1px;right:1px;width:4px;height:4px;
    border-radius:50%;background:#ffe066;box-shadow:0 0 0 1px #0008}
  .cov .cell.is-anim{animation:pulse 1.6s ease-in-out infinite}
  @keyframes pulse{50%{box-shadow:inset 0 0 0 1.5px #7ff}}
  .legend{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0 0;font-size:12px;color:var(--dim)}
  .lg{display:inline-flex;align-items:center;gap:6px}
  .lg i{width:10px;height:10px;border-radius:3px;display:inline-block}

  /* 시트 원본 */
  .sheetview{border:1px solid var(--line);border-radius:10px;padding:14px;background:#0a0c10;overflow-x:auto}
  .sheetview img{image-rendering:pixelated;display:block;width:${SHEET_W * 2}px;height:${SHEET_H * 2}px}

  /* 파이프라인 */
  .pipe{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:20px 0}
  .step{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
  .step .n{font:700 11px/1 ui-monospace,monospace;color:var(--accent)}
  .step h5{margin:8px 0 6px;color:var(--ink);font-size:13.5px}
  .step p{margin:0;font-size:12.5px;color:var(--dim)}
  .step code{font-size:11px}

  .tblocks{display:flex;flex-wrap:wrap;gap:18px}
  .tblock{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
  .tblock h5 code{font-size:10.5px}
  .tb-top{display:flex;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--line)}
  .tb-grid{display:grid;grid-template-columns:repeat(3,auto);gap:8px}
  .tb-cell{display:flex;flex-direction:column;align-items:center;gap:2px}
  .tb-role{font:600 9px/1 ui-monospace,monospace;color:var(--faint)}

  .note{border-left:3px solid var(--accent);background:#6ea8fe12;padding:12px 16px;border-radius:0 8px 8px 0;
    margin:18px 0;font-size:13.5px;color:#cfe0ff}
  .note.warn{border-color:var(--warn);background:#ffb45412;color:#ffe2bb}
  .note.bad{border-color:var(--bad);background:#ff6b6b12;color:#ffcbcb}
  .note b{color:#fff}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media(max-width:840px){.two{grid-template-columns:1fr}}
  .stack{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
  .stack h5{color:var(--ink);font-size:13.5px;margin-bottom:8px}
  ul.tight{margin:8px 0 0;padding-left:18px;font-size:13px;color:var(--dim)}
  ul.tight li{margin:5px 0}
  pre{background:#0a0c10;border:1px solid var(--line);border-radius:8px;padding:14px;overflow-x:auto;
    font:12.5px/1.6 ui-monospace,monospace;color:#cfd6e0}
  pre .k{color:#7fb7ff} pre .s{color:#9ce8b0} pre .c{color:var(--faint)}
  footer{margin-top:72px;padding-top:22px;border-top:1px solid var(--line);color:var(--faint);font-size:12.5px}
</style>
</head>
<body>
<div class="wrap">

<header class="top">
  <div class="kicker">OPRN · Tileset Harness Report</div>
  <h1>EasyRPG RTP Combined Town ChipSet<br><span class="dim" style="font-size:22px">— 어떻게 구현했고, AI가 어떻게 쓰는가</span></h1>
  <p>
    이 칩셋은 이 저장소의 <b>기본 타일셋</b>이다. 480칸의 16×16 픽셀 조각에 불과한 시트를
    “번호에 의미가 붙은 재료 카탈로그”로 승격시키는 코드 계층을 <b>하네스(harness)</b>라 부르고,
    AI는 타일 번호가 아니라 그 카탈로그의 <b>라벨</b>로만 시공한다. 아래 모든 수치·그림은
    <code>defaultTileset()</code>에 하네스를 적용한 실제 런타임 객체에서 뽑았다.
  </p>
</header>

<section>
  <h2><span class="num">01</span>정체 — 무엇을 다루는가</h2>
  <p class="lede">
    시트 하나, 480칸. 좌표 인덱스가 곧 타일 id다(<code>id = row × ${COLS} + col</code>).
    같은 번호가 다른 칩셋에서는 전혀 다른 그림이므로, 이 보고서의 번호 의미는
    <b>이 칩셋에만</b> 적용된다.
  </p>
  <div class="stats">
    <div class="stat"><b>${SHEET_W}×${SHEET_H}</b><span>시트 픽셀</span></div>
    <div class="stat"><b>${CELL}px</b><span>타일 한 변</span></div>
    <div class="stat"><b>${COLS}×${SHEET.rows}</b><span>칩 격자</span></div>
    <div class="stat"><b>${stats.total}</b><span>타일 수</span></div>
    <div class="stat"><b>${stats.groups}</b><span>하네스 그룹</span></div>
    <div class="stat"><b>${stats.inHarnessGroup}</b><span>그룹 소속 타일</span></div>
    <div class="stat"><b>${stats.labelled}</b><span>라벨 부여 타일</span></div>
    <div class="stat"><b>${stats.semantics}</b><span>검색 시맨틱 엔트리</span></div>
  </div>
  <table>
    <tbody>
      <tr><th>타일셋 id</th><td><code>${esc(tileset.id)}</code></td></tr>
      <tr><th>표시 이름</th><td>${esc(tileset.name)}</td></tr>
      <tr><th>텍스처 키</th><td><code>${esc(tileset.image.type === "bundled" ? tileset.image.id : "-")}</code></td></tr>
      <tr><th>이미지</th><td><code>public/assets/easyrpg-chipset-combined-town-transparent.png</code> <span class="faint">(컬러키 → 알파 변환본)</span></td></tr>
      <tr><th>하네스 게이트</th><td><code>isCombinedTownTileset()</code> (bundled + 텍스처 키 일치) <b>AND</b> <code>count === 480</code> — 둘 중 하나만 어긋나도 번호 의미를 적용하지 않는다</td></tr>
      <tr><th>사람용 계약서</th><td><code>rpg_maker_skills/tilesets/easyrpg_combined_town/SKILL.md</code> (에이전트 스킬 패키지)</td></tr>
    </tbody>
  </table>

  <h3>원본 시트 (2× 확대)</h3>
  <div class="sheetview checker">
    <img src="${sheetDataUrl}" alt="Combined Town ChipSet 원본 시트" width="${SHEET_W * 2}" height="${SHEET_H * 2}">
  </div>
  <p class="faint" style="font-size:12.5px">
    좌상단 0번부터 행 우선. 왼쪽 12열은 지형 오토타일 앵커 격자, 가운데는 건축·가구,
    오른쪽 아래는 투명 배경 소품 대역이다.
  </p>
</section>

<section>
  <h2><span class="num">02</span>구현 — 픽셀에서 계약까지 5단</h2>
  <p class="lede">
    코드는 다섯 겹이다. 아래로 갈수록 “그림”에서 멀어지고 “규칙”에 가까워진다.
    AI는 4·5단만 만지고, 1~3단은 코드가 소유한다.
  </p>
  <div class="pipe">
    <div class="step"><div class="n">1단 · 기하</div><h5>시트 슬라이싱</h5>
      <p><code>resourceSlicing.ts</code> — ${CELL}px 격자, ${COLS}열, ${stats.total}칸. 인덱스↔좌표 변환의 유일한 근거.</p></div>
    <div class="step"><div class="n">2단 · 번호 의미</div><h5>chipsetMapping</h5>
      <p><code>CHIPSET_TILE_GROUPS</code> · <code>describeChipsetTile()</code> · <code>isTransparentChipsetTile()</code> — “이 번호가 무슨 그림인가”의 원장.</p></div>
    <div class="step"><div class="n">3단 · 계약</div><h5>하네스 그룹</h5>
      <p><code>combinedTownGroups.ts</code> — ${stats.groups}개 그룹. 레이어·통행·반복 문법·인접 규칙을 선언한다.</p></div>
    <div class="step"><div class="n">4단 · 런타임</div><h5>타일셋 배열 시딩</h5>
      <p><code>applyCombinedTownHarness()</code> — <code>tileMeta / priority / passability / terrain</code>를 실제로 채운다.</p></div>
    <div class="step"><div class="n">5단 · AI 표면</div><h5>어휘 · 툴</h5>
      <p><code>tileVocabulary</code> · <code>tile_query</code> · v3 시공 프리미티브 — LLM은 <b>라벨</b>만 본다.</p></div>
  </div>

  <div class="two">
    <div class="stack">
      <h5>하네스가 타일 하나에 하는 일</h5>
      <ul class="tight">
        <li><code>tileMeta[t]</code> ← 라벨·설명·role·repeatability·defaultLayer·terrainTag·passage·confidence, <code>source:"bundled-default"</code></li>
        <li><code>priority[t]</code> ← <code>resolveRuntimeLayer(group)</code> 결과(lower/upper)</li>
        <li><code>passability[t]</code> ← 그룹 <code>passage</code>의 4방향 전개</li>
        <li><code>terrain[t]</code> ← water면 <code>TERRAIN_TAG.WATER</code>, 흙길이면 NORMAL, 그 외 칩셋 기본값</li>
        <li><code>tileGroups</code> ← 그룹 메타 복제(기존 사용자 편집 그룹은 보존, 삭제분은 <code>suppressedHarnessGroupIds</code> 툼스톤으로 유지)</li>
      </ul>
    </div>
    <div class="stack">
      <h5>사용자가 이긴다 — 덮어쓰기 금지선</h5>
      <ul class="tight">
        <li><code>meta.userLocked === true</code> 또는 <code>meta.source === "user"</code>면 메타를 <b>건드리지 않는다</b></li>
        <li>런타임 계약도 사용자 메타의 <code>defaultLayer</code>·<code>passage</code>·<code>terrainTag</code>를 우선 적용</li>
        <li>하네스 재적용 시 기존 그룹은 “저작된 상태”로 보존하고, <code>rules</code>가 없을 때만 기본 규칙을 백필</li>
        <li>사용자가 지운 하네스 그룹은 로드마다 부활하지 않는다(툼스톤)</li>
      </ul>
    </div>
  </div>
</section>

<section>
  <h2><span class="num">03</span>커버리지 지도 — 480칸 전부</h2>
  <p class="lede">
    한 칸도 숨기지 않은 전체 격자. 테두리 색 = 하네스 <b>role</b>, 우상단 노란 점 = 런타임
    <b>upper</b> 레이어, 맥동하는 테두리 = 애니메이션 프레임, 흐릿한 칸 = 그룹·시맨틱 모두
    없는 <b>미분류</b>. 칸에 마우스를 올리면 번호·라벨·레이어·통행·terrain·그룹이 다 나온다.
  </p>
  ${coverageGrid()}
  <div class="legend">
    ${roleLegend}
    <span class="lg"><i style="background:#3b4048"></i>시맨틱만 있음</span>
    <span class="lg"><i style="background:#23262b;box-shadow:inset 0 0 0 1px #444"></i>미분류 ${stats.uncovered}칸</span>
    <span class="lg"><i style="background:#ffe066;border-radius:50%"></i>upper 레이어</span>
  </div>
  <div class="stats" style="margin-top:18px">
    <div class="stat"><b>${stats.lower}</b><span>lower 레이어</span></div>
    <div class="stat"><b>${stats.upper}</b><span>upper 레이어</span></div>
    <div class="stat"><b>${stats.solid}</b><span>통행 불가 ×</span></div>
    <div class="stat"><b>${stats.partial}</b><span>부분 통행(4방향)</span></div>
    <div class="stat"><b>${stats.transparent}</b><span>투명 배경 칩</span></div>
    <div class="stat"><b>${stats.upperOnlyOverlay}</b><span>upper 강제 오버레이</span></div>
    <div class="stat"><b>${stats.autotileMembers}</b><span>오토타일 멤버</span></div>
    <div class="stat"><b>${stats.animated}</b><span>애니 프레임</span></div>
  </div>
</section>

<section>
  <h2><span class="num">04</span>레이어 라우팅 — 검은 구멍을 막는 규칙</h2>
  <p class="lede">
    투명 배경 칩을 하위에 깔면 투명한 부분 아래가 검게 보인다. 그래서 하네스는 그룹 계약이
    lower/mixed라 해도 <b>투명 칩을 상위로 강제 라우팅</b>한다. 저장된 옛 프로젝트도 로드 시 치유된다
    (<code>enforceTransparentOverlayPriority</code>).
  </p>
  <table>
    <thead><tr><th>분기</th><th>조건</th><th>결과 레이어</th></tr></thead>
    <tbody>
      <tr><td>사용자 확정</td><td><code>source:"user"</code>/<code>userLocked</code> + <code>defaultLayer</code></td><td>사용자 값 그대로</td></tr>
      <tr><td>나무 수관</td><td>${[...TREE_CANOPY_TILE_IDS].join(", ")}</td><td><b>upper</b> + 통행 가능 ○ (숲에서 겹쳐 그려짐)</td></tr>
      <tr><td>나무 밑동</td><td>${[...TREE_TRUNK_TILE_IDS].join(", ")}</td><td><b>lower</b> + 통행 불가 × (수관과 같은 칸 공존)</td></tr>
      <tr><td>그룹 <code>upper</code></td><td>사선 지붕 오버레이 등</td><td>upper</td></tr>
      <tr><td>그룹 <code>mixed</code> + stackable</td><td>탁자·벤치·상자 등 가구</td><td>upper (통행 ×여도 상위 유지)</td></tr>
      <tr><td>그룹 <code>mixed</code></td><td>그 외</td><td>passage가 solid면 lower, 아니면 upper</td></tr>
      <tr><td>투명 칩 안전망</td><td><code>isUpperOnlyOverlayTile()</code></td><td>무조건 upper로 승격(밑동 예외)</td></tr>
    </tbody>
  </table>

  <div class="two">
    <div class="stack">
      <h5>나무 = 2칸 원자 (하위 밑동 + 상위 수관)</h5>
      ${treeRows
        .map(
          (row) => `<div style="display:flex;align-items:center;gap:12px;margin:10px 0">
        ${chip(row.top, 3, `${row.top} upper`)}${chip(row.bottom, 3, `${row.bottom} lower`)}
        <span class="dim" style="font-size:12.5px">${esc(row.name)}</span></div>`,
        )
        .join("")}
      <p class="faint" style="font-size:12px;margin:8px 0 0">
        활엽수는 2×2 원자이며 <code>bAlt:[262]</code> 덕분에 대각 (+1,+1) 겹침이 허용된다 —
        숲이 숲처럼 맞물리게. 조각난 나무는 여전히 hard rule 위반이다.
      </p>
    </div>
    <div class="stack">
      <h5>사선 지붕 = 상위 오버레이</h5>
      ${chips([...COMBINED_TOWN_ROOF_OVERLAY_TILES], 3)}
      <p class="dim" style="font-size:12.5px;margin:8px 0 0">
        아래 벽·직선 지붕면을 지우지 않고 겹쳐 실루엣만 만든다. 반대로 <b>직선 지붕면과
        지붕-벽 경계는 lower</b>다 — 불투명 건축 칩이라 지면을 대체해도 구멍이 안 생긴다.
      </p>
      ${chips([404, 405, 406, 407, 434, 435, 436, 437], 3)}
    </div>
  </div>
</section>

<section>
  <h2><span class="num">05</span>하네스 그룹 카탈로그 — ${stats.groups}개 전량</h2>
  <p class="lede">
    각 카드는 실제 <code>COMBINED_TOWN_HARNESS_GROUPS</code> 엔트리다. 계약 레이어와 런타임 레이어를
    나란히 보여주므로 4장의 라우팅이 어디서 개입했는지 눈으로 확인할 수 있다.
    hard 규칙은 배치 검증기가 강제하고, soft/medium은 조언이다.
  </p>
  ${roleSections}
</section>

<section>
  <h2><span class="num">06</span>오토타일 — 한 칸 브러시가 지형을 성형한다</h2>
  <p class="lede">
    RM2003식 3×4 템플릿 블록: 앵커(블록 좌상단) 하나로 11개 역할 좌표가 계산된다
    (<code>templateBlockFromAnchor</code>). 감독은 대표 타일만 칠하고, 엔진이 이웃 연결을 보고
    변·모서리·오목·외딴을 골라 넣는다. 내장 그룹 ${stats.autotileGroups}종 · 멤버 ${stats.autotileMembers}칸.
  </p>
  <div class="tblocks">
    ${templateBlock(360, "흙길")}
    ${templateBlock(129, "포석")}
    ${templateBlock(243, "키큰 풀")}
  </div>
  <h3>지형 앵커 격자 (열 0/3/6/9 × 4행 밴드)</h3>
  <table>
    <thead><tr><th>앵커</th><th>지형</th><th>종류</th><th>그룹 id</th></tr></thead>
    <tbody>${anchorRows}</tbody>
  </table>
  <div class="note warn">
    앵커 <b>240(잔디)</b>은 <code>TILE.GRASS</code> 그 자체 — 성형 그룹으로 승격하지 않는다.
    전 맵이 멤버가 되어 인접 편집마다 기본 잔디를 재도색하는 회귀가 있었다.
    잔디는 문법 그룹 <code>grass-autotile</code>이 전담한다.
  </div>
</section>

<section>
  <h2><span class="num">07</span>애니메이션 물 — 프레임까지 계약이다</h2>
  <p class="lede">
    호수·수로는 가로 3프레임(3fps), 폭포는 세로 4프레임(4fps) 스트립이다.
    맵에는 베이스 타일만 저장하고 렌더러가 <code>animationFrameForTile()</code>로 프레임을 고른다.
    스트립 ${stats.animationStrips}종 · 프레임 ${stats.animated}칸.
  </p>
  <table>
    <thead><tr><th>스트립 키</th><th>속도</th><th>프레임</th></tr></thead>
    <tbody>${animRows}</tbody>
  </table>
</section>

<section>
  <h2><span class="num">08</span>함정과 금지 — 실측이 남긴 흉터</h2>
  <p class="lede">
    이름이 의미처럼 보이는 상수가 가장 위험했다. 아래는 헤드리스 플레이테스트와 감독 교정으로
    확정된 반례들이며, 코드 주석·그룹 이름에 그대로 박아 재발을 막았다.
  </p>
  <div class="note bad">
    <b>TILE.FLOOR(342) / TILE.STAIRS(246)는 바닥·계단이 아니다.</b>
    둘 다 이 칩셋에서 전방향 통행 불가다. 하네스 그룹 이름이 아예
    <code>stone-floor-trap</code>(“겉보기엔 평평해 통행 가능해 보이지만 실측 결과 막히는 돌바닥”)이다.
    그런데도 과거 실내 300칸을 FLOOR로 채워 <b>밟을 수 있는 칸이 2칸</b>이었던 사고가 있었다.
    지면이 필요하면 GRASS·PATH·SAND·421(자갈)·222(나무 마루)를 쓴다.
  </div>
  <h3>통행 함정</h3>
  <div class="chips">${trapTiles.map((tile) => namedChip(tile)).join("")}</div>
  <h3>전역 금지 타일</h3>
  <div class="chips">${bannedTiles.map((tile) => namedChip(tile)).join("")}</div>
  <p class="faint" style="font-size:12.5px">
    411·412·413·443은 용도 미확정으로 밴, 441·442(바위)는 감독 판단으로 전역 밴 —
    대체재는 석상(266/296)·돌기둥(267/297)이다. 밴 타일은 라벨 자체에
    “(사용 금지)”가 박혀 있어 AI가 검색해도 즉시 알아본다.
  </p>
  <div class="note warn">
    <b>성(城)은 자유조립 금지.</b> 성 관련 조립 클러스터 4종은 삭제됐다 —
    자유조립 경로가 오조립만 낳았기 때문이다. 성 시공의 정본은
    <code>castleKit.stampCastle</code>(금본 <code>map_castle_keep</code>)이며,
    이 금지는 하네스 프롬프트 규칙에 문장으로 들어가 AI에게 매 턴 주입된다.
  </div>
</section>

<section>
  <h2><span class="num">09</span>AI는 이 칩셋을 어떻게 쓰는가</h2>
  <p class="lede">
    핵심 설계는 하나다 — <b>LLM에게 타일 번호를 고르게 하지 않는다.</b>
    AI는 라벨로 재료를 요청하고, 번호·레이어·오토타일 성형·인접 규칙은 코드가 결정한다.
    번호는 오직 <b>감독에게 그림과 함께</b> 보여줄 때만 표면에 나온다.
  </p>

  <div class="pipe">
    <div class="step"><div class="n">① 발견</div><h5>tile_query</h5>
      <p><code>ask:"labels"</code>로 시공 가능한 재료 라벨을 조회. <code>vocab</code>(그룹 ${stats.vocabGroups}개 + 낱개 ${stats.vocabTiles}칸) · <code>tile_info</code> · <code>palette</code> · <code>similar</code> · <code>usage</code>.</p></div>
    <div class="step"><div class="n">② 지시</div><h5>v3 시공 프리미티브</h5>
      <p><code>build_wall</code> <code>build_roof</code> <code>place_door</code> <code>place_window</code> <code>lay_path</code> <code>place_props</code> <code>fill_region</code> <code>tile_erase</code> — 인자는 <b>material(라벨 문자열)</b>.</p></div>
    <div class="step"><div class="n">③ 해석</div><h5>resolveMaterialByLabel</h5>
      <p>라벨 → 그룹/타일. 그룹 id·<code>harness-…</code>·가방 라벨은 <b>거절</b>하고 구체 라벨 후보를 되돌려준다.</p></div>
    <div class="step"><div class="n">④ 집행</div><h5>하네스 계약</h5>
      <p>레이어 라우팅, 오토타일 성형, 9슬라이스 확장, 세로/가로 캡 보존 — 전부 코드가 수행.</p></div>
    <div class="step"><div class="n">⑤ 검증</div><h5>규칙 · 린트</h5>
      <p>hard 인접 규칙(<code>clusterRuleValidators</code>), <code>layoutPlacementValidate</code>(물 위 소품·조각난 나무·나무 누락) — 실패면 적용 차단.</p></div>
    <div class="step"><div class="n">⑥ 보고</div><h5>show_tiles / show_tile_grid</h5>
      <p>번호만 말하지 않는다. 타일 스와치(6× 확대 + 번호 캡션)와 영역 합성 이미지를 채팅에 렌더해 감독이 눈으로 검수한다.</p></div>
  </div>

  <h3>실측 — LLM이 넣는 문자열을 실제로 통과시켜 봤다</h3>
  <p class="dim" style="font-size:13px;margin:0 0 6px">
    아래 표는 <code>resolveMaterialByLabel(defaultTileset(), query)</code>를 이 보고서 생성 시점에
    실제로 호출한 결과다 — 손으로 적은 예시가 아니다. 승인되면 어떤 타일들로 전개되는지,
    거절되면 어떤 메시지와 대안이 모델에게 되돌아가는지 그대로 보인다.
  </p>
  <table>
    <thead><tr><th style="width:26%">material 질의</th><th style="width:16%">판정</th><th>해석 결과</th></tr></thead>
    <tbody>${materialProbeRows}</tbody>
  </table>

  <h3>매 턴 주입되는 하네스 규칙 (<code>combinedTownHarnessPrompt()</code>)</h3>
  <p class="dim" style="font-size:13px;margin:0 0 10px">
    타일셋 AI 제안 컨트롤러가 이 객체를 <code>tilesetHarness</code> 키로 프롬프트에 넣는다.
    다른 타일셋이면 <code>active:false</code>와 “번호 의미 하네스가 없습니다”만 들어간다 —
    업로드된 칩셋에 이 번호 의미를 절대 적용하지 않기 위한 장치다.
  </p>
  <ul class="tight" style="font-size:13.5px">
    ${(harnessPrompt.rules ?? []).map((rule) => `<li>${esc(rule)}</li>`).join("")}
  </ul>
  <p class="faint" style="font-size:12.5px">
    그리고 ${stats.groups}개 그룹의 <code>{id, name, role, defaultLayer, tileIds, grammar, stackable}</code>이
    같은 객체에 함께 실려 간다 — 모델이 “어떤 재료가 존재하고 어떤 문법으로 늘어나는가”를 추측하지 않게.
  </p>

  <div class="two">
    <div class="stack">
      <h5>가방(bag) 재료 금지 — 사고에서 배운 규칙</h5>
      <p class="dim" style="font-size:13px;margin:0">
        <code>place_props material:"마을 소품"</code> 한 줄이 랜덤 잡동사니를 산포한 사고가 있었다.
        지금은 <code>materialPolicy.ts</code>가 <code>마을 소품</code>/<code>small-props</code> 계열
        라벨과 id를 <b>시공 인자로 거절</b>하고, 구체 라벨 후보를 되돌려준다.
      </p>
      <pre><span class="c">// 거절 메시지</span>
material "마을 소품" 은(는) 잡소품 가방(bag)입니다.
place_props 에는 구체 라벨을 쓰세요
  (예: <span class="s">"나무 상자"</span>, <span class="s">"침엽수"</span>, <span class="s">"꽃"</span>, <span class="s">"표지판"</span>).
tile_query ask:<span class="s">"labels"</span> 로 후보를 확인하세요.</pre>
      <p class="faint" style="font-size:12px;margin:8px 0 0">
        그룹 자체는 남아 있다(잔여 소품 분류용) — 막은 것은 <b>재료로서의 사용</b>뿐이다.
      </p>
    </div>
    <div class="stack">
      <h5>칩셋 교차 오염 방지</h5>
      <ul class="tight">
        <li><code>tile_query</code>는 <code>tilesetId</code> 생략 시 <code>mapId</code> → <code>startMap</code> 순으로 타일셋을 결정한다. 실내 맵에서 Combined Town 라벨로 <code>place_props</code>하는 사고를 막는 배선.</li>
        <li>검색 시맨틱도 텍스처 키로 분기한다 — interior/dungeon 칩셋에는 각자의 테이블이 붙고, Combined Town 테이블이 새지 않는다.</li>
        <li><code>material</code> 동의어 확장은 <code>탁자</code>처럼 <b>모호한 질의만</b> — 구체 라벨(<code>가로 탁자 중</code>)에 bare 부분매칭으로 번지지 않는다.</li>
        <li>번들이 아닌 업로드 칩셋은 “투명 칩 → upper” 최소 하네스만 받는다.</li>
      </ul>
    </div>
  </div>

  <h3>감독 대면 원칙 — 번호에는 항상 그림</h3>
  <p class="dim" style="font-size:13.5px">
    <code>show_tiles</code>의 툴 설명문에 강제 조항이 박혀 있다:
    “타일에 대해 질문하거나 설명할 때 <b>반드시 먼저 호출하라</b> — 번호만으로는 사용자가
    어떤 타일인지 알 수 없다.” 렌더러는 타일을 6배 확대해 체커보드 배경 위에 그리고
    번호를 흰 테두리 캡션으로 얹는다. 이 보고서의 칩들도 같은 규칙을 따른다.
  </p>
  <div class="chips">${[240, 421, 120, 116, 260, 327].map((tile) => namedChip(tile, 4)).join("")}</div>
</section>

<section>
  <h2><span class="num">10</span>검색 시맨틱 — AI가 재료를 찾는 사전</h2>
  <p class="lede">
    <code>COMBINED_TOWN_TILE_SEMANTICS</code>는 <b>검색 전용</b> 큐레이션 테이블(${stats.semantics}칸)이다.
    라벨·role·통행성·태그를 담고, 프로젝트의 사용자 메타데이터가 그 위에 겹쳐진다 —
    감독이 인터뷰로 가르친 설명이 번들 기본값보다 먼저 검색된다. 하네스 시드 라벨은
    태그로 강등돼 계속 검색되되 큐레이션을 가리지 않는다.
  </p>
  <table>
    <thead><tr><th>role</th><th>엔트리 수</th><th>예시</th></tr></thead>
    <tbody>
      ${[...semanticRoleCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([role, count]) => {
          const samples = COMBINED_TOWN_TILE_SEMANTICS.filter((entry) => entry.role === role).slice(0, 8).map((entry) => entry.index);
          return `<tr><td><code>${esc(role)}</code></td><td>${count}</td><td>${chips(samples, 2, String)}</td></tr>`;
        })
        .join("")}
    </tbody>
  </table>
</section>

<section>
  <h2><span class="num">11</span>벤치마크 — 모델이 이 시트를 읽을 수 있나</h2>
  <p class="lede">
    하네스 테이블은 벤치마크의 <b>정답지</b>로도 쓰인다. <code>src/benchmark/groundTruth.ts</code>가
    시맨틱 테이블·하네스 그룹·오토타일 앵커를 읽어 차원별 정답 집합을 파생하고,
    “파생 함수 == 리터럴 스냅샷” 테스트가 소스 변경 시 스냅샷 갱신을 강제한다.
  </p>
  <div class="note">
    프롬프트에는 <b>정답 타일 id도, 칩셋 이름도, 시트 기하 수치(480/30/16)도 넣지 못한다</b> —
    <code>test/benchmarkPrompts.test.ts</code>가 안티-게이밍 규칙으로 강제한다.
    모델은 오직 시트 <b>이미지</b>를 보고 벽/바닥/지붕/창문을 찾고, 집을 짓고,
    나무를 하위·상위로 쌓고, L자 흙길을 오토타일로 성형해야 한다.
  </div>
  <p class="dim" style="font-size:13.5px;margin-top:14px">
    즉 이 저장소는 같은 테이블을 세 방향으로 쓴다 —
    <b>런타임 계약</b>(에디터·플레이어), <b>AI 재료 사전</b>(툴 표면),
    <b>평가 정답지</b>(벤치마크).
  </p>
</section>

<section>
  <h2><span class="num">12</span>요약 — 설계 판단 5개</h2>
  <div class="two">
    <div class="stack"><h5>1. 번호는 코드가, 라벨은 AI가</h5>
      <p class="dim" style="font-size:13px;margin:0">LLM이 타일 id를 직접 고르면 칩셋이 바뀔 때마다 무너진다. material 라벨 한 겹을 끼워 넣어 모델을 칩셋 기하에서 분리했다.</p></div>
    <div class="stack"><h5>2. 투명 칩은 무조건 상위</h5>
      <p class="dim" style="font-size:13px;margin:0">그룹 계약보다 강한 안전망을 둔 이유는 단순하다 — 하위에 깔린 투명 칩은 검은 구멍으로 보이고, 그건 감독이 즉시 알아채는 결함이다.</p></div>
    <div class="stack"><h5>3. 사용자 잠금은 절대선</h5>
      <p class="dim" style="font-size:13px;margin:0">하네스는 매 로드마다 재적용되는 코드다. <code>userLocked</code>/<code>source:"user"</code> 예외와 툼스톤이 없으면 감독의 교정이 로드마다 지워진다.</p></div>
    <div class="stack"><h5>4. 실측 결과를 이름에 박는다</h5>
      <p class="dim" style="font-size:13px;margin:0"><code>stone-floor-trap</code>, <code>"바위(사용 금지)"</code>, <code>"자갈(사용 금지)"</code> — 주석은 안 읽히지만 라벨·그룹 이름은 검색 결과에 딸려 나온다.</p></div>
    <div class="stack"><h5>5. 자유조립이 실패한 곳은 금본으로</h5>
      <p class="dim" style="font-size:13px;margin:0">성채는 클러스터 자유조립을 폐기하고 스탬프 툴 단일 경로로 바꿨다. 조합 자유도가 품질을 못 내는 영역이 있다는 것을 계약에 반영한 것.</p></div>
    <div class="stack"><h5>6. 그림 없는 번호는 보고가 아니다</h5>
      <p class="dim" style="font-size:13px;margin:0">타일 스와치 렌더러와 <code>show_tiles</code> 강제 조항은 감독의 검수 왕복 비용을 줄이기 위한 장치다.</p></div>
  </div>
</section>

<footer>
  생성: <code>scripts/gen-combined-town-chipset-report.mts</code> ·
  모든 타일 그림은 <code>public/assets/easyrpg-chipset-combined-town-transparent.png</code>를
  base64로 인라인한 단일 스프라이트에서 잘라 썼다(외부 요청 없음) ·
  수치는 <code>defaultTileset()</code>에 하네스를 적용한 런타임 객체에서 계산.
</footer>

</div>
</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html, "utf8");
console.log(`wrote ${OUT_HTML} (${(html.length / 1024).toFixed(0)} KB)`);
console.log(JSON.stringify(stats, null, 2));
