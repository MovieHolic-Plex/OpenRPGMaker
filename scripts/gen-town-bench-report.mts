/**
 * combined_town 9문항 타일 배치 벤치마크 — 이미지 리치 HTML 보고서.
 *
 * 앞선 보고서(combined-town-chipset-report.html, 생성기
 * scripts/gen-combined-town-chipset-report.mts)와 같은 시각 언어를 쓰고 같은 규약을
 * 따른다: 타일 그림은 칩셋 PNG 하나를 base64 로 인라인해 background-position 으로
 * 잘라 쓰고(외부 요청 0), 번호를 말할 때는 반드시 그림을 함께 낸다.
 *
 * 데이터 출처(모두 런타임 import — 손으로 옮겨 적은 수치 없음):
 *   - src/benchmark/town/*                    태스크·팔레트·정답표·채점기
 *   - src/project/defaults/tileSemanticsCombinedTown.ts  라벨·밴 태그
 *   - src/project/defaults/autotileGroups.ts  템플릿 블록 공식
 *
 * 실행: npx tsx scripts/gen-town-bench-report.mts
 * 산출: town-bench-report.html (앞 보고서와 같이 저장소 루트, git 미추적 산출물)
 */
import fs from "node:fs";
import path from "node:path";
import { RESOURCE_SLICING } from "../src/assets/resourceSlicing.ts";
import { buildTownGroundTruth } from "../src/benchmark/town/groundTruth.ts";
import { renderTileGridPng, renderTownImagePng } from "../src/benchmark/town/inputImages.ts";
import {
  COBBLE_PALETTE,
  DOOR_PALETTE,
  FENCE_PALETTE,
  ROAD_PALETTE,
  TREE_PALETTE,
  VILLAGE_PALETTE,
  paletteFor,
} from "../src/benchmark/town/palettes.ts";
import { TOWN_TASKS } from "../src/benchmark/town/tasks.ts";
import { parseSubmission } from "../src/benchmark/agent/spec.ts";
import { TOWN_PROMPT_VERSION } from "../src/benchmark/town/prompts.ts";
import { TOWN_SCORING_VERSION } from "../src/benchmark/town/manifest.ts";
import {
  EMPTY_CELL,
  TOWN_AXIS_ORDER,
  TOWN_AXIS_TITLE,
  TOWN_DETERMINISTIC_PARAMS,
  type TownAxisId,
  type TownImageKey,
  type TownTaskDef,
} from "../src/benchmark/town/types.ts";
import { templateBlockFromAnchor } from "../src/project/defaults/autotileGroups.ts";
import { COMBINED_TOWN_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsCombinedTown.ts";

const SHEET = RESOURCE_SLICING.chipset;
const COLS = SHEET.columns;
const CELL = SHEET.cellWidth;
const SHEET_W = SHEET.sheetWidth;
const SHEET_H = SHEET.sheetHeight;

const CHIPSET_PNG = path.resolve("public/assets/easyrpg-chipset-combined-town-transparent.png");
const OUT_HTML = path.resolve("town-bench-report.html");
const HARNESS_REPORT = "combined-town-chipset-report.html";

const groundTruth = buildTownGroundTruth();
const sheetDataUrl = `data:image/png;base64,${fs.readFileSync(CHIPSET_PNG).toString("base64")}`;

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── 타일 라벨 ───────────────────────────────────────────────────────────────

const labelByTile = new Map<number, string>();
for (const entry of COMBINED_TOWN_TILE_SEMANTICS) {
  if (!labelByTile.has(entry.index)) labelByTile.set(entry.index, entry.label);
}
function labelOf(tile: number): string {
  return labelByTile.get(tile) ?? "라벨 없음";
}

// ── 타일 칩 (시트 하나에서 잘라 쓴다) ───────────────────────────────────────

function tileSwatch(tile: number, scale = 3): string {
  const size = CELL * scale;
  const col = tile % COLS;
  const row = Math.floor(tile / COLS);
  return (
    `<span class="t" title="${esc(`${tile} · ${labelOf(tile)}`)}" style="width:${size}px;height:${size}px;` +
    `background-size:${SHEET_W * scale}px ${SHEET_H * scale}px;` +
    `background-position:-${col * size}px -${row * size}px"></span>`
  );
}

/** 문장 안에 끼워 넣는 타일 — 번호 뒤에 그림을 붙여 읽는 흐름을 끊지 않는다. */
function inlineTile(tile: number): string {
  const size = CELL * 2;
  const col = tile % COLS;
  const row = Math.floor(tile / COLS);
  return (
    `<span class="t inline" title="${esc(`${tile} · ${labelOf(tile)}`)}" style="width:${size}px;height:${size}px;` +
    `background-size:${SHEET_W * 2}px ${SHEET_H * 2}px;` +
    `background-position:-${col * size}px -${row * size}px"></span>`
  );
}

/** "번호 + 그림" 한 덩어리 — 문장 안에서 쓴다. */
function inlineRef(tile: number): string {
  return `<b class="tref">${tile}${inlineTile(tile)}</b>`;
}

/** 번호 캡션이 붙은 칩 — 이 저장소의 "번호에는 항상 그림" 규약. */
function chip(tile: number, scale = 3, caption: string | null = String(tile)): string {
  return (
    `<figure class="chip">${tileSwatch(tile, scale)}` +
    (caption === null ? "" : `<figcaption>${esc(caption)}</figcaption>`) +
    `</figure>`
  );
}

function chips(tiles: readonly number[], scale = 3): string {
  return `<div class="chips">${tiles.map((tile) => chip(tile, scale)).join("")}</div>`;
}

function namedChip(tile: number): string {
  return (
    `<figure class="chip named">${tileSwatch(tile, 3)}` +
    `<figcaption><b>${tile}</b><span>${esc(labelOf(tile))}</span></figcaption></figure>`
  );
}

function namedChips(tiles: readonly number[]): string {
  return `<div class="chips">${tiles.map(namedChip).join("")}</div>`;
}

// ── 렌더 이미지 인라인 ──────────────────────────────────────────────────────

/**
 * 렌더 PNG 를 원래 크기로 싣는다. 폭을 지정해 축소하면 픽셀 아트가 비정수 배율로
 * 뭉개져 감독이 타일 경계를 못 본다 — 이 보고서의 그림은 검수 대상이다.
 */
function pngTag(png: Uint8Array, caption: string): string {
  const url = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  return `<figure class="shot"><img src="${url}" alt=""><figcaption>${esc(caption)}</figcaption></figure>`;
}

/** 정본 배치를 실제 칩셋으로 합성한다(바탕이 있으면 그 위에). */
async function referenceShot(task: TownTaskDef): Promise<{ png: Uint8Array; width: number }> {
  if (!task.placement) {
    const reference = groundTruth.autotile;
    const lower = new Array<number>(reference.width * reference.height).fill(EMPTY_CELL);
    for (const cell of reference.cells) lower[cell.y * reference.width + cell.x] = cell.tile;
    return {
      png: await renderTileGridPng({
        width: reference.width,
        height: reference.height,
        lower,
        upper: new Array<number>(lower.length).fill(EMPTY_CELL),
      }),
      width: reference.width * CELL * 2,
    };
  }
  const reference = groundTruth.placements[task.placement];
  const merge = (base: readonly number[], top: readonly number[]): number[] =>
    base.map((tile, index) => {
      const above = top[index] ?? EMPTY_CELL;
      return above === EMPTY_CELL ? tile : above;
    });
  return {
    png: await renderTileGridPng({
      width: reference.width,
      height: reference.height,
      lower: merge(reference.baseLower, reference.lower),
      upper: merge(reference.baseUpper, reference.upper),
    }),
    width: reference.width * CELL * 2,
  };
}

// ── 문항 해설 데이터 ────────────────────────────────────────────────────────

interface AxisNote {
  readonly axis: TownAxisId;
  /** 제품에서 이 일을 누가 하는가 — 하네스 보고서 §09 파이프라인 기준. */
  readonly whoDoesItInProduct: string;
  readonly harnessCode: string;
  /** 이 축이 실제로 재는 것. */
  readonly measures: string;
  /** 채점 항목(코드의 detail 키와 같은 이름). */
  readonly items: readonly string[];
}

const AXIS_NOTES: readonly AxisNote[] = [
  {
    axis: "autotile",
    whoDoesItInProduct: "코드",
    harnessCode: "autotileEngine.shapeAutotileGroupAround · DEFAULT_AUTOTILE_GROUPS",
    measures: "대표 타일만 칠하면 엔진이 변·모서리·오목·외딴을 골라 준다. 그 엔진을 걷어내고 모델이 21칸을 직접 고르게 했을 때 몇 칸이 맞는가.",
    items: ["cellAccuracy (21칸)", "innerCorner (오목 4칸만 별도)", "paintedOutsideShape", "offPalette"],
  },
  {
    axis: "reproducibility",
    whoDoesItInProduct: "아무도 대신 못 한다",
    harnessCode: "—",
    measures: "같은 요청 3회에 같은 답을 내는가. 나머지 8축을 믿을 수 있는지의 전제다. temperature 0 에서도 흔들리는 폭이 그대로 숫자가 된다.",
    items: ["반복 답변 쌍별 일치율", "(별도 게이트) 보관본 재채점 바이트 일치"],
  },
  {
    axis: "layer",
    whoDoesItInProduct: "코드 (안전망까지)",
    harnessCode: "combinedTown.enforceTransparentOverlayPriority · isUpperOnlyOverlayTile",
    measures: "투명 칩을 하위에 깔면 검은 구멍이 된다. 하네스는 그룹 계약이 lower 라 해도 투명 칩을 상위로 강제 승격한다. 그 안전망 없이 모델이 나무 줄기/캐노피를 옳게 나누는가.",
    items: ["프로브 균형 정확도", "pairedCorrect (같은 나무의 위아래)", "trunkOnLower", "canopyOnUpper", "layerDiscipline"],
  },
  {
    axis: "road",
    whoDoesItInProduct: "코드",
    harnessCode: "roadAutotile.shapeRoadAround · village/roads.ts ensureSingleRoadComponent",
    measures: "제품에서는 lay_path 가 경로만 받고 성형·성분 정리를 코드가 한다. 모델 단독으로 세 지점을 하나의 망으로 잇고 칸마다 옳은 변형 타일을 놓는가.",
    items: ["anchorsPaved", "connectivity", "autotileLegality", "×buildingsClear", "×walkable", "×paletteClean"],
  },
  {
    axis: "wallOutline",
    whoDoesItInProduct: "코드",
    harnessCode: "houseKit.stampRectHouseKit (나인슬라이스 확장) · v3 build_wall",
    measures: "벽은 좌·중앙 반복·우 + 상/중/하단의 나인슬라이스다. 모델이 그 문법으로 외곽을 마감하는가, 아니면 한 타일로 사각형을 채우는가.",
    items: ["identity", "footprintFilled", "wallBandIsWall", "wallBandSolid", "roofBandIsRoof", "nineSlice", "×outsideClean", "×layerDiscipline", "×paletteClean"],
  },
  {
    axis: "roofDiagonal",
    whoDoesItInProduct: "코드",
    harnessCode: "houseKit.stampRectHouseKit (aframe 분기)",
    measures: "A자 지붕은 행마다 좌우 1칸씩 좁아지는 피라미드이고, 사선 캡은 투명이라 상위·꼭짓점은 불투명이라 하위다. 이 계단과 레이어 분담을 모델이 재현하는가.",
    items: ["identity", "stepInward", "diagonalCapsOnUpper", "apexOnLower", "eavesFullWidth", "nineSlice", "×outsideClean"],
  },
  {
    axis: "door",
    whoDoesItInProduct: "코드",
    harnessCode: "village/houses.ts 문 규약 · v3 place_door",
    measures: "문은 세로 두 칸 한 벌이고 두 벌(나무·석재)이 섞이면 안 된다. 문 앞은 걸을 수 있어야 하고 벽의 다른 곳은 뚫려선 안 된다. 어느 벌을 골랐는지는 묻지 않는다.",
    items: ["pairAtSlot", "sameFamily", "×onlyDoorCells", "×frontWalkable", "×paletteClean", "(참고) identity"],
  },
  {
    axis: "fenceEnd",
    whoDoesItInProduct: "코드 (강등 로직까지)",
    harnessCode: "village/fences.ts placeHouseLotFences · demoteCornerToEnd",
    measures: "울타리는 이어지거나 끝 조각으로 끝나야 한다. 모서리는 세로 변이 실제로 이어질 때만 쓴다. 코드에는 못 이은 모서리를 끝 조각으로 강등하는 로직까지 있다 — 모델은 그걸 스스로 하는가.",
    items: ["runEndsFinished", "endPiecesOriented", "cornersLinked", "noOrphans", "sideRailsLinked", "gateOpen", "noOverwrite", "paletteClean"],
  },
  {
    axis: "village",
    whoDoesItInProduct: "코드 (파이프라인 전체)",
    harnessCode: "village/builder.ts build_village · audit.ts auditVillage · critiqueBuiltVillage",
    measures: "제품의 build_village 는 집·길·울타리·NPC를 순서대로 시공하고 감사까지 돌린다. 모델이 20×12 두 레이어를 직접 채워 같은 감사를 통과하는가.",
    items: ["doorsPresent", "doorsConnected", "roadOneNetwork", "housesBuilt", "fencedHouses", "plazaPaved", "doorsReachable", "×housesNotPaved", "×layerDiscipline", "×noBanned"],
  },
];

const noteByAxis = new Map<TownAxisId, AxisNote>(AXIS_NOTES.map((note) => [note.axis, note]));

const TASK_PALETTE_NOTE: Readonly<Partial<Record<TownImageKey, string>>> = {
  autotileShape: "흙길 템플릿 블록 11역할 (360 은 외딴/대체 몸통 두 역할을 겸해 중복 제거됨)",
  treeGrid: "나무 4종의 캐노피 + 줄기 — 수종 선택은 모델 자유",
  roadGrid: "흙길 11역할",
  wallGrid: "밝은 오렌지 지붕 + 흰 회벽 키트 한 벌",
  aframeGrid: "빨간 A자 지붕 + 석벽 키트 한 벌",
  doorGrid: "문 두 벌 — 짝을 섞으면 안 된다",
  fenceGrid: "울타리 둘레 세트 8종",
  villageGrid: "세 키트 + 문 + 흙길 + 포석 + 울타리 + 나무",
};

// ── 본문 ────────────────────────────────────────────────────────────────────

const axisIndex = new Map<TownAxisId, number>(TOWN_AXIS_ORDER.map((axis, index) => [axis, index + 1]));
const imageTasks = TOWN_TASKS.filter((task) => task.kind !== "tileSet");
const probeTasks = TOWN_TASKS.filter((task) => task.kind === "tileSet");

async function sectionPerQuestion(): Promise<string> {
  const blocks: string[] = [];
  for (const task of imageTasks) {
    const note = noteByAxis.get(task.axis)!;
    const input = await renderTownImagePng(task.input);
    const reference = await referenceShot(task);
    const palette = paletteFor(task.input);
    const paired = probeTasks.find((candidate) => candidate.axis === task.axis);
    blocks.push(`
    <article class="qcard">
      <header>
        <h3><span class="qn">${axisIndex.get(task.axis)}</span> ${esc(TOWN_AXIS_TITLE[task.axis])}
          <code>${esc(task.id)}</code></h3>
        <div class="badges">
          <span class="pill">${esc(task.kind)}</span>
          <span class="pill dim">제품에서는 ${esc(note.whoDoesItInProduct)}</span>
          ${paired ? `<span class="pill soft">선행 프로브 ${esc(paired.id)}</span>` : ""}
        </div>
      </header>
      <p class="desc">${esc(note.measures)}</p>
      <div class="shots">
        ${pngTag(input, "모델이 보는 입력 — 팔레트 스트립 + 마킹된 그리드")}
        ${pngTag(reference.png, "정본 — 엔진이 만든 정답을 실제 칩셋으로 합성")}
      </div>
      <h5>팔레트로 준 어휘 — ${esc(TASK_PALETTE_NOTE[task.input] ?? "")}</h5>
      ${chips(palette, 2)}
      <h5>채점 항목 <span class="faint">(× = 감점 배수)</span></h5>
      <ul class="items">${note.items.map((item) => `<li><code>${esc(item)}</code></li>`).join("")}</ul>
      <p class="rules">하네스 대응 코드 · <code>${esc(note.harnessCode)}</code></p>
    </article>`);
  }
  return blocks.join("");
}

function templateBlockCard(): string {
  const block = templateBlockFromAnchor(360);
  const roles: readonly (readonly [string, number])[] = [
    ["외딴", block.isolated],
    ["오목", block.inner],
    ["NW", block.cornerNW],
    ["N", block.edgeN],
    ["NE", block.cornerNE],
    ["W", block.edgeW],
    ["몸통", block.body],
    ["E", block.edgeE],
    ["SW", block.cornerSW],
    ["S", block.edgeS],
    ["SE", block.cornerSE],
  ];
  const counts: Record<string, number> = {};
  for (const cell of groundTruth.autotile.cells) counts[cell.role] = (counts[cell.role] ?? 0) + 1;
  const roleKey: Record<string, string> = {
    외딴: "isolated", 오목: "inner", NW: "cornerNW", N: "edgeN", NE: "cornerNE",
    W: "edgeW", 몸통: "body", E: "edgeE", SW: "cornerSW", S: "edgeS", SE: "cornerSE",
  };
  return `<div class="tblock">
    <h5>흙길 템플릿 블록 <code>anchor 360</code> — 도형이 만드는 역할 횟수</h5>
    <div class="tb-grid11">
      ${roles
        .map(
          ([role, tile]) =>
            `<div class="tb-cell">${tileSwatch(tile, 3)}<span class="tb-role">${esc(role)}</span>` +
            `<span class="tb-id">${tile}</span>` +
            `<span class="tb-n">×${counts[roleKey[role]!] ?? 0}</span></div>`,
        )
        .join("")}
    </div>
  </div>`;
}

// ── agent 트랙 실측 결과(있으면 싣는다) ────────────────────────────────────

interface AgentRunFile {
  readonly model: string;
  readonly run: number;
  readonly process: { readonly turns: number | null; readonly costUsd: number | null; readonly durationMs: number | null };
  readonly score: { readonly quality: number; readonly scale: number; readonly detail: Record<string, number> } | null;
}

let agentShot: string | null = null;
let agentRow = "";
{
  const dir = path.resolve("output/agent-bench");
  const records: AgentRunFile[] = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(".json") && !name.endsWith(".submission.json"))
        .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as AgentRunFile)
    : [];
  agentRow = records
    .map((record) => {
      const detail = record.score?.detail ?? {};
      const cells = [
        record.score ? record.score.quality.toFixed(3) : "제출X",
        record.score ? record.score.scale.toFixed(2) : "—",
        String(detail.houses ?? "—"),
        String(detail.doors ?? "—"),
        String(record.process.turns ?? "—"),
        record.process.costUsd === null ? "—" : `$${record.process.costUsd.toFixed(2)}`,
        record.process.durationMs === null ? "—" : (record.process.durationMs / 60000).toFixed(1),
      ];
      const weak = (record.score?.quality ?? 0) < 0.7 ? ' style="color:#ff8f7a"' : "";
      return `<tr><td class="c">${esc(record.model)}-${record.run}</td>${cells
        .map((cell, index) => `<td class="n"${index === 0 ? weak : ""}>${esc(cell)}</td>`)
        .join("")}</tr>`;
    })
    .join("");

  const submissions = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".submission.json")) : [];
  const first = submissions[0];
  if (first) {
    const parsed = parseSubmission(fs.readFileSync(path.join(dir, first), "utf8"));
    if (parsed.ok) {
      const label = first.replace(".submission.json", "");
      const record = records.find((entry) => `${entry.model}-${entry.run}` === label);
      agentShot = pngTag(
        await renderTileGridPng(parsed.map),
        `${label} — 생짜 지시로 만든 것 (quality ${record?.score?.quality.toFixed(3) ?? "?"} / scale ${record?.score?.scale.toFixed(2) ?? "?"})`,
      );
    }
  }
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>combined_town 9문항 타일 배치 벤치마크 — 설계 · 채점 보고서</title>
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
  header.top p{color:var(--dim);max-width:78ch;margin:0 0 8px}
  h2{font-size:23px;margin:56px 0 6px;letter-spacing:-.01em}
  h2 .num{color:var(--faint);font-variant-numeric:tabular-nums;margin-right:10px;font-size:16px}
  h2+.lede{color:var(--dim);margin:0 0 22px;max-width:82ch}
  h3{font-size:17px;margin:34px 0 12px}
  h5{margin:16px 0 8px;font-size:13px;color:var(--dim);font-weight:600}
  code{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:.88em;
    background:#0000003d;border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:#cfd6e0}
  a{color:var(--accent)}
  .dim{color:var(--dim)} .faint{color:var(--faint)}

  .t{display:block;background-image:var(--sheet);image-rendering:pixelated;
    background-repeat:no-repeat;border-radius:2px;background-color:#0000;box-shadow:inset 0 0 0 1px #ffffff14}
  .t.inline{display:inline-block;vertical-align:-9px;margin:0 2px}
  .tref{white-space:nowrap;font-variant-numeric:tabular-nums}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
  .chip{margin:0;display:flex;flex-direction:column;align-items:center;gap:3px}
  .chip figcaption{font:600 10px/1 ui-monospace,monospace;color:var(--faint);font-variant-numeric:tabular-nums}
  .chip.named{background:#0000004d;border:1px solid var(--line);border-radius:8px;padding:8px;min-width:104px}
  .chip.named figcaption{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px}
  .chip.named figcaption b{color:var(--ink);font-size:11px}
  .chip.named figcaption span{color:var(--dim);font:400 11px/1.3 inherit;text-align:center}

  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px;margin:20px 0 8px}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
  .stat b{display:block;font-size:26px;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
  .stat span{font-size:12px;color:var(--dim)}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);font-weight:700}
  td.c{width:1%;white-space:nowrap}
  td.n{font-variant-numeric:tabular-nums;text-align:right;width:1%;white-space:nowrap}
  tbody tr:hover{background:#ffffff06}

  .pill{display:inline-block;font:600 10.5px/1.6 ui-monospace,monospace;padding:0 7px;border-radius:999px;
    background:#ffffff0f;border:1px solid var(--line);color:var(--dim);white-space:nowrap}
  .pill.dim{color:var(--faint)}
  .pill.hard{background:#ff6b6b26;border-color:#ff6b6b55;color:#ffb3b3}
  .pill.soft{background:#5ddba022;border-color:#5ddba055;color:#a6e9c9}
  .pill.warn{background:#ffb45422;border-color:#ffb45455;color:#ffdca8}

  .note{border-left:3px solid var(--accent);background:#6ea8fe12;padding:12px 16px;border-radius:0 8px 8px 0;
    margin:18px 0;font-size:13.5px;color:#cfe0ff}
  .note.warn{border-color:var(--warn);background:#ffb45412;color:#ffe2bb}
  .note.bad{border-color:var(--bad);background:#ff6b6b12;color:#ffcbcb}
  .note.ok{border-color:var(--ok);background:#5ddba012;color:#c6f0dc}
  .note b{color:#fff}

  .qcard{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px 20px;margin:18px 0}
  .qcard header{margin-bottom:10px}
  .qcard h3{margin:0 0 8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:18px}
  .qcard h3 .qn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
    border-radius:8px;background:#6ea8fe22;border:1px solid #6ea8fe55;color:#bcd7ff;
    font:700 13px/1 ui-monospace,monospace}
  .qcard h3 code{font-size:11px;color:var(--faint)}
  .qcard .badges{display:flex;flex-wrap:wrap;gap:5px}
  .qcard .desc{margin:0;color:var(--dim);font-size:13.5px;max-width:84ch}
  .qcard .rules{margin:14px 0 0;font-size:12px;color:var(--faint)}
  .qcard ul.items{margin:0;padding-left:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px}
  .qcard ul.items code{font-size:11px}

  .shots{display:flex;flex-wrap:wrap;gap:16px;margin:14px 0 0;align-items:flex-start}
  .shot{margin:0}
  .shot img{display:block;image-rendering:pixelated;border:1px solid var(--line);border-radius:6px;
    background:#0a0c10;max-width:100%;height:auto}
  .shot figcaption{color:var(--faint);font-size:11.5px;margin-top:5px;max-width:56ch}

  .tblock{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:16px 0}
  .tb-grid11{display:flex;flex-wrap:wrap;gap:10px}
  .tb-cell{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:56px}
  .tb-role{font:600 9.5px/1 ui-monospace,monospace;color:var(--dim)}
  .tb-id{font:600 9.5px/1 ui-monospace,monospace;color:var(--faint)}
  .tb-n{font:700 10px/1 ui-monospace,monospace;color:var(--accent)}

  .pipe{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:20px 0}
  .step{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
  .step .n{font:700 11px/1 ui-monospace,monospace;color:var(--accent)}
  .step h5{margin:8px 0 6px;color:var(--ink);font-size:13.5px}
  .step p{margin:0;font-size:12.5px;color:var(--dim)}

  footer.end{margin-top:64px;padding-top:20px;border-top:1px solid var(--line);color:var(--faint);font-size:12.5px}
</style>
</head>
<body><div class="wrap">

<header class="top">
  <div class="kicker">RPG Zzu · Tile-Placement Benchmark Report</div>
  <h1>combined_town 9문항 벤치마크 — 하네스를 걷어내면 모델은 무엇을 할 수 있나</h1>
  <p>앞선 보고서 <a href="${HARNESS_REPORT}">EasyRPG RTP Combined Town ChipSet — 구현 · AI 사용 보고서</a>는
  480칸짜리 시트를 "번호에 의미가 붙은 재료 카탈로그"로 승격시킨 <b>코드 계층</b>을 설명한다.
  이 보고서는 그 위에 올라간다 — <b>그 계층을 모델에게서 걷어냈을 때 무엇이 남는가</b>를
  9개 숫자로 재는 벤치마크의 설계와 채점 규칙이다.</p>
  <p>모든 그림·수치는 <code>buildTownGroundTruth()</code> 와 <code>renderTownImagePng()</code> 를
  이 보고서 생성 시점에 실제로 호출해 얻었다. 타일 그림은 칩셋 PNG 하나를 base64 로
  인라인해 잘라 썼다(외부 요청 없음).</p>
</header>

<div class="stats">
  <div class="stat"><b>9</b><span>문항 = 축 = 숫자</span></div>
  <div class="stat"><b>${TOWN_TASKS.length}</b><span>태스크(모델 호출 단위)</span></div>
  <div class="stat"><b>${imageTasks.length}</b><span>배치 태스크</span></div>
  <div class="stat"><b>${probeTasks.length}</b><span>선행 프로브</span></div>
  <div class="stat"><b>${groundTruth.autotile.cells.length}</b><span>오토타일 채점 칸</span></div>
  <div class="stat"><b>${groundTruth.banned.size}</b><span>전역 금지 타일</span></div>
  <div class="stat"><b>${TOWN_TASKS.length * 3}</b><span>모델당 호출(반복 3회)</span></div>
  <div class="stat"><b>0</b><span>손으로 쓴 정답</span></div>
</div>

<h2><span class="num">01</span>핵심 긴장 — 제품은 모델에게 번호를 고르게 하지 않는다</h2>
<p class="lede">앞 보고서의 §09·§12-1 은 이 저장소의 제1원칙을 못 박는다:
<b>"LLM에게 타일 번호를 고르게 하지 않는다."</b> AI는 라벨로 재료를 요청하고,
번호·레이어·오토타일 성형·인접 규칙은 코드가 결정한다. 그렇다면 "모델이 번호를 옳게
고르는가"를 재는 이 벤치마크는 무엇을 위한 것인가?</p>

<div class="note"><b>이 벤치마크는 모델 품질을 재는 것이 아니라, 하네스가 대신 지고 있는 짐의 무게를 잰다.</b>
축 점수가 낮다 = 그 능력은 코드가 대신하고 있으며 하네스를 걷어내면 즉시 무너진다.
축 점수가 높다 = 그 영역은 모델에게 직접 통제를 더 줘도 되는 후보다.
그래서 이 표의 "제품에서는 누가" 열이 점수보다 먼저 읽혀야 한다.</div>

<table>
  <thead><tr><th>#</th><th>문항</th><th>제품에서는 누가</th><th>하네스 대응 코드</th><th>이 축이 재는 것</th></tr></thead>
  <tbody>
  ${TOWN_AXIS_ORDER.map((axis) => {
    const note = noteByAxis.get(axis)!;
    const who = note.whoDoesItInProduct === "아무도 대신 못 한다"
      ? `<span class="pill warn">${esc(note.whoDoesItInProduct)}</span>`
      : `<span class="pill hard">${esc(note.whoDoesItInProduct)}</span>`;
    return `<tr><td class="n">${axisIndex.get(axis)}</td>
      <td class="c"><b>${esc(TOWN_AXIS_TITLE[axis])}</b><br><span class="faint">${esc(axis)}</span></td>
      <td class="c">${who}</td>
      <td><code>${esc(note.harnessCode)}</code></td>
      <td class="dim">${esc(note.measures)}</td></tr>`;
  }).join("")}
  </tbody>
</table>

<h2><span class="num">02</span>팔레트는 주고 배치를 측정한다 — 앞 세대 규칙에서 바꾼 것</h2>
<p class="lede">앞 보고서 §11 은 1세대 벤치마크의 안티게이밍 규칙을 이렇게 적었다:
"프롬프트에는 정답 타일 id도, 칩셋 이름도, 시트 기하 수치(480/30/16)도 넣지 못한다 …
모델은 오직 시트 이미지를 보고" 답해야 한다. 이 트랙은 그 규칙을 <b>의도적으로 한 겹 완화</b>했다.</p>

<table>
  <thead><tr><th></th><th>1세대 · interior 트랙</th><th>이 트랙</th></tr></thead>
  <tbody>
    <tr><td class="c">타일 어휘</td><td class="dim">주지 않는다</td><td><b>준다</b> — 오름차순·중복 없는 후보 id 집합 + 그 그림</td></tr>
    <tr><td class="c">측정되는 것</td><td class="dim">30열 시트에서 눈으로 480까지 세기 + 배치</td><td><b>배치 문법만</b></td></tr>
    <tr><td class="c">여전히 금지</td><td colspan="2">역할→id 매핑 · 좌표→id 매핑 · 프로브의 정답 부분집합 · 칩셋 이름 · 시트 기하 수치</td></tr>
    <tr><td class="c">강제 방법</td><td colspan="2"><code>test/townBench.test.ts</code> 가 프롬프트에서 정수를 전부 뽑아
      해당 태스크의 팔레트/프로브 집합과 <b>정확히 같은 집합인지</b> 대조한다(<code>-1</code> 은 빈 칸 표기라 예외)</td></tr>
  </tbody>
</table>

<div class="note">왜 완화했는가 — <b>제품이 그렇게 동작하기 때문이다.</b> 앞 보고서 §09 파이프라인의
①발견 <code>tile_query ask:"labels"</code> 단계가 모델에게 재료 목록을 넘긴다. 어휘를 주지 않고 재는
점수는 "시트를 외웠는가"에 지배되고, 그건 칩셋이 바뀌면 무의미해지는 능력이다. 우리가 알고 싶은 것은
<b>재료를 손에 쥔 모델이 문법대로 쌓는가</b>다.</div>

<h5>이미지에는 글자를 일절 그리지 않는다</h5>
<p class="dim">팔레트 스트립은 오름차순 읽기 순서로만 id 와 대응한다. 타일 번호도, 라벨도, 범례도
그리지 않으며 <code>test/townBench.test.ts</code> 가 <code>inputImages.ts</code> 소스에 jimp 의
글자 API 호출이 없음을 검사한다. 대신 <b>이 보고서</b>는 감독 대면 문서이므로 앞 보고서의 규약대로
번호마다 그림을 붙인다.</p>

<h2><span class="num">03</span>문항별 — 입력, 정본, 채점 항목</h2>
<p class="lede">각 카드의 왼쪽이 모델이 실제로 받는 이미지, 오른쪽이 엔진이 만든 정답을 실제 칩셋으로
합성한 그림이다. 정본 답변을 그대로 채점기에 넣으면 9축 전부 1.000 이 나온다 —
그것이 이 채점기의 첫 번째 불변식이다.</p>
${await sectionPerQuestion()}

<h3>선행 프로브 ${probeTasks.length}개</h3>
<p class="dim">배치 문항과 같은 축을 쓰지만 질문이 다르다: "보여 준 이 타일들 중 어느 것이 X 인가".
유계 이지선다이므로 균형 정확도((민감도+특이도)/2)로 채점한다 — 정답이 적은 쪽으로 쏠린 프로브에서
"전부 예"나 "전부 아니오"가 만점을 받지 않게.</p>
<table>
  <thead><tr><th>태스크</th><th>축</th><th class="n">프로브</th><th class="n">정답</th><th>정답 출처</th></tr></thead>
  <tbody>
  ${probeTasks.map((task) => {
    const probe = groundTruth[task.probe!];
    return `<tr><td class="c"><code>${esc(task.id)}</code></td>
      <td class="c">${axisIndex.get(task.axis)}. ${esc(TOWN_AXIS_TITLE[task.axis])}</td>
      <td class="n">${probe.probes.length}칸</td><td class="n">${probe.positives.size}칸</td>
      <td class="dim">${esc(probe.source)}</td></tr>`;
  }).join("")}
  </tbody>
</table>
<div class="shots">
${(await Promise.all(probeTasks.map(async (task) =>
  pngTag(await renderTownImagePng(task.input), `${task.id} — ${TOWN_AXIS_TITLE[task.axis]} 프로브 스트립`),
))).join("")}
</div>

<h2><span class="num">04</span>정답을 손으로 쓰지 않는다</h2>
<p class="lede">정답표는 <b>실제로 도는 엔진을 호출해서</b> 만든다. 엔진 문법이 바뀌면 정답이 같이
바뀌고, 매니페스트 해시가 달라져 옛 점수가 자동으로 비교 대상에서 빠진다. 픽스처 기하가 엔진 제약을
어기면(예: A자 지붕의 폭이 짝수) 정답표 생성이 즉시 throw 한다.</p>

<table>
  <thead><tr><th>문항</th><th>정답을 만드는 엔진</th></tr></thead>
  <tbody>
    <tr><td class="c">1 · 4</td><td><code>autotileEngine.autotileVariantForMask</code> × <code>DEFAULT_ROAD_AUTOTILE_GROUP</code></td></tr>
    <tr><td class="c">5 · 6 · 9</td><td><code>houseKit.stampRectHouseKit</code> — 나인슬라이스 / A자 피라미드 문법</td></tr>
    <tr><td class="c">7</td><td><code>village/houses.ts</code> 문 규약 — 하위 레이어 상단 ${inlineRef(116)} / 하단 ${inlineRef(146)}</td></tr>
    <tr><td class="c">8</td><td><code>village/fences.ts placeHouseLotFences</code> — 모서리 강등 로직 포함</td></tr>
    <tr><td class="c">3</td><td><code>benchmark/groundTruth.deriveTreePairs()</code></td></tr>
    <tr><td class="c">통행성 · 레이어</td><td><code>defaultTilesets()[easyrpg_chipset_combined_town]</code> 의 시드된 배열</td></tr>
  </tbody>
</table>

${templateBlockCard()}

<div class="note ok"><b>도형은 임의로 고르지 않았다.</b> 10×7 도형은 11역할이 <b>전부</b> 나오는 것을 찾아
고정했고, 정답표 생성이 매번 그 분포를 실측해 어긋나면 throw 한다. 특히 3×3 덩어리 안의 구멍이
<b>오목 코너 4개</b>를 만들고 오른쪽 외딴 점이 <b>isolated</b> 를 만든다 — 둘이 없으면
"변과 모서리만 아는 모델"과 "이웃을 실제로 읽는 모델"이 구분되지 않는다.</div>

<h2><span class="num">05</span>채점기가 지키는 두 불변식</h2>

<h3>① 정본은 만점이다</h3>
<p class="dim">참조 배치를 답으로 넣으면 9축 전부 1.000 이어야 한다. 테스트가 태스크별로 이것을
강제한다 — 정답이 만점을 못 받는 기준은 기준이 아니다. API 없이 확인하는 경로도 있다:
<code>npx tsx scripts/town-bench.mts demo</code>.</p>

<h3>② 아무것도 안 한 답은 0점이다</h3>
<p class="dim">"건물을 침범하지 않았다", "금지 타일을 안 썼다" 같은 항목은 <b>빈 답에서 자동으로 만점</b>이다.
그런 항목을 평균에 같이 넣으면 아무것도 하지 않은 답이 높은 점수를 받는다. 아래는 구현 중 실측된 값이다.</p>
<table>
  <thead><tr><th>문항</th><th class="n">빈 답 (수정 전)</th><th class="n">빈 답 (수정 후)</th><th>원인이 된 항목</th></tr></thead>
  <tbody>
    <tr><td class="c">4 길</td><td class="n" style="color:#ff8f7a">0.667</td><td class="n" style="color:#5ddba0">0.000</td><td class="dim">autotileLegality·walkable·paletteClean 이 분모 0 에서 1 이었다</td></tr>
    <tr><td class="c">9 마을</td><td class="n" style="color:#ff8f7a">0.300</td><td class="n" style="color:#5ddba0">0.000</td><td class="dim">housesNotPaved·layerDiscipline·noBanned</td></tr>
    <tr><td class="c">7 문</td><td class="n" style="color:#ff8f7a">0.300</td><td class="n" style="color:#5ddba0">0.000</td><td class="dim">onlyDoorCells·frontWalkable</td></tr>
  </tbody>
</table>
<div class="note bad">수정: 채점을 <code>combine(일한 항목 평균, 감점 항목 배수)</code> 로 바꾸고,
한 칸도 놓지 않은 답은 채점 전에 0점으로 못 박았다. 위 표의 문항 카드에서 <b>×</b> 로 표시된 항목이
감점 배수다.</div>

<h3>③ 정답이 여럿인 문항에서는 정본 일치를 점수에 넣지 않는다</h3>
<p class="dim">"정본에 가까울수록 고득점"이라면 이 벤치마크는 <b>하네스 출력을 외웠는가</b>를 재는 것이 된다.
그건 우리가 알고 싶은 것이 아니다. 그래서 문항마다 정본 일치(<code>identity</code>)의 비중을 달리 잡았다 —
정답이 하나인 문항에서만 점수로 쓰고, 나머지는 <code>detail</code> 에만 남겨 진단용으로 본다.</p>
<table>
  <thead><tr><th>#</th><th>문항</th><th>정본 일치가 점수에</th><th>이유</th></tr></thead>
  <tbody>
    <tr><td class="n">1</td><td class="c">오토타일</td><td class="c"><span class="pill hard">전부</span></td>
      <td class="dim">엔진 <code>variantMap</code> 이 마스크당 타일 <b>하나</b>를 준다 — 정답이 물리적으로 하나뿐이다</td></tr>
    <tr><td class="n">5 · 6</td><td class="c">벽 외곽 · 지붕 대각</td><td class="c"><span class="pill warn">절반</span></td>
      <td class="dim">나인슬라이스·피라미드는 그 키트의 <b>문법 자체</b>이고 키트 혼합은 규약상 금지다. 나머지 절반은 구조로 준다</td></tr>
    <tr><td class="n">3</td><td class="c">레이어(나무)</td><td class="c"><span class="pill soft">안 넣음</span></td>
      <td class="dim">수종은 자유 — "줄기=하위 / 같은 나무 캐노피=상위" 쌍 규칙만 본다</td></tr>
    <tr><td class="n">4</td><td class="c">길</td><td class="c"><span class="pill soft">안 넣음</span></td>
      <td class="dim">경로가 여럿이다. <code>autotileLegality</code> 는 "정본 경로와 같은가"가 아니라
      <b>제 이웃 관계에 맞는 변형 타일인가</b> — 전혀 다른 길도 자기 자신과 일관되면 만점이다</td></tr>
    <tr><td class="n">7</td><td class="c">문</td><td class="c"><span class="pill soft">안 넣음</span></td>
      <td class="dim">팔레트가 문 두 벌을 주고 프롬프트는 어느 쪽인지 말하지 않으므로 정답이 둘이다.
      짝을 섞었는지는 <code>sameFamily</code> 가 본다</td></tr>
    <tr><td class="n">8</td><td class="c">울타리 끝</td><td class="c"><span class="pill soft">안 넣음</span></td>
      <td class="dim">규칙 8개 통과율. 정본과 다른 배치라도 규칙을 지키면 만점</td></tr>
    <tr><td class="n">9</td><td class="c">마을</td><td class="c"><span class="pill soft">안 넣음</span></td>
      <td class="dim">감사 항목만. 집·길·광장이 다르게 놓여도 감사를 통과하면 만점</td></tr>
  </tbody>
</table>
<div class="note warn"><b>이 원칙을 어기고 있던 곳을 하나 고쳤다.</b> 7번 문은 팔레트로 두 벌
(나무 ${inlineRef(116)}${inlineRef(146)} · 석재 ${inlineRef(329)}${inlineRef(359)})을 주면서
정본 일치를 점수 절반으로 쓰고 있었다 — 석재 문을 <b>올바르게 짝지어</b> 설치한 답이 0.500 을 받았다.
팔레트가 허용한 선택을 벌하는 것은 측정이 아니라 함정이다. 지금은 구조만 점수로 쓴다:
정본 나무 문 <b>1.000</b> · 석재 문 <b>1.000</b> · 짝 섞음 <b>0.500</b> · 자리 틀림 <b>0.000</b>.</div>

<div class="note"><b>그래서 "AI + 하네스가 만들면 고득점"은 참이지만 자명하게 참이다.</b>
정본을 만든 것이 바로 그 하네스이므로 <code>demo</code> 명령은 9축 만점을 낸다 — 그건 채점기가
제대로 배선됐다는 점검일 뿐 성과가 아니다. 의미 있는 숫자는 절대값이 아니라 <b>차이</b>다:
하네스 1.000 − 모델 단독 X = 하네스가 지고 있는 짐의 무게.</div>

<h2><span class="num">06</span>함정과 금지 — 앞 보고서 §08 을 그대로 상속한다</h2>
<p class="lede">앞 보고서가 "실측이 남긴 흉터"로 기록한 반례들이 이 벤치마크의 <b>함정 프로브</b>가 됐다.
겉보기와 실제가 어긋나는 타일을 섞지 않으면 "잔디는 밟을 수 있다" 수준의 상식만으로 만점이 나온다.</p>

<h5>통행 함정 — 평평해 보이는데 전방향 통행 불가</h5>
${namedChips([342, 343, 246, 426])}
<p class="dim">이 중 아래 ${groundTruth.passability.traps.size}칸은 4번 축의 통행성 프로브에 함정으로 들어가 있다 —
평평해 보이는 바닥을 "걸을 수 있다"고 답하면 특이도가 깎인다.</p>
${namedChips([...groundTruth.passability.traps].sort((a, b) => a - b))}

<h5>전역 금지 타일 ${groundTruth.banned.size}칸 — 쓰면 9번 축이 0 이 된다</h5>
${namedChips([...groundTruth.banned].sort((a, b) => a - b))}

<div class="note warn"><b>이 보고서를 쓰다 찾은 결함.</b> 처음 구현은 금지 타일을
<code>BANNED_STONE_TILES</code>(411/412/413/443)만 봤다. 그런데 앞 보고서 §08 은
바위 <b>441 · 442</b> 도 감독 판단으로 전역 밴이라고 적어 두었고, 그 밴은 상수가 아니라
시맨틱 테이블의 라벨 <code>"바위(사용 금지)"</code> 와 <code>banned</code> 태그로만 표현돼 있었다.
지금은 태그에서 파생해 ${groundTruth.banned.size}칸 전부를 본다.
대체재는 석상 ${inlineRef(266)} ${inlineRef(296)} · 돌기둥 ${inlineRef(267)} ${inlineRef(297)} 이다.</div>

<h2><span class="num">07</span>재현성 — 모델에서 물려받지 않고 제조한다</h2>
<p class="lede">LLM API 는 비트 단위로 재현되지 않는다. 그래서 3층으로 만든다.
2번 축은 <b>모델 실력이 아니다</b> — "같은 질문에 같은 답을 내는가"이며, 나머지 8축을 믿을 수 있는지의 전제다.</p>
<div class="pipe">
  <div class="step"><div class="n">L1</div><h5>실험 고정</h5>
    <p>프롬프트 버전 · 정답 digest · 입력 PNG 바이트 sha256 · 태스크 스위트 digest · 채점 버전 ·
    샘플링 파라미터를 한 해시로 묶는다. <code>manifestHash</code> 가 같아야만 두 점수를 비교할 수 있다.</p></div>
  <div class="step"><div class="n">L2</div><h5>보관 후 재생</h5>
    <p>원문을 전량 보관하고 네트워크 없이 다시 채점해 <b>직렬화 바이트가 원본과 같은지</b> 검사한다.
    다르면 <code>replay</code> 가 exit 1 — 그 런은 무효다.</p></div>
  <div class="step"><div class="n">L3</div><h5>분산 측정</h5>
    <p>반복 3회의 평균·표준편차를 보고하고, 답변끼리의 쌍별 일치율을 2번 축으로 낸다.
    파싱된 답이 둘 미만이면 0 이 아니라 <b>null</b>(측정 불가)이다.</p></div>
</div>
<table>
  <thead><tr><th>매니페스트에 박히는 값</th><th>현재</th></tr></thead>
  <tbody>
    <tr><td class="c">정답표 digest</td><td><code>${groundTruth.digest.slice(0, 32)}…</code></td></tr>
    <tr><td class="c">프롬프트 버전</td><td><code>${TOWN_PROMPT_VERSION}</code></td></tr>
    <tr><td class="c">채점 코드 버전</td><td><code>${TOWN_SCORING_VERSION}</code></td></tr>
    <tr><td class="c">샘플링</td><td><code>temperature ${TOWN_DETERMINISTIC_PARAMS.temperature} · top_p ${TOWN_DETERMINISTIC_PARAMS.topP} · max_tokens ${TOWN_DETERMINISTIC_PARAMS.maxTokens} · seed ${TOWN_DETERMINISTIC_PARAMS.seed}</code></td></tr>
  </tbody>
</table>

<h2><span class="num">08</span>실행 · 비용</h2>
<div class="pipe">
  <div class="step"><div class="n">demo</div><h5>API 없이 점검</h5><p><code>npx tsx scripts/town-bench.mts demo</code><br>정본 답변으로 9축 만점이 나와야 한다.</p></div>
  <div class="step"><div class="n">run</div><h5>실제 모델</h5><p><code>run --models a,b,c --repeats 3</code><br>키는 <code>.env.local</code> 의 <code>CPENROUTER_API_KEY</code> — 출력·보관하지 않는다.</p></div>
  <div class="step"><div class="n">replay</div><h5>재현성 게이트</h5><p><code>replay --in output/town-bench</code><br>바이트가 다르면 exit 1.</p></div>
  <div class="step"><div class="n">report</div><h5>9축 리더보드</h5><p><code>report --in output/town-bench</code></p></div>
  <div class="step"><div class="n">evidence</div><h5>증거 시트</h5><p><code>evidence --in output/town-bench</code><br>모델 답을 실제 칩셋으로 합성한 PNG + HTML.</p></div>
</div>
<p class="dim">${TOWN_TASKS.length} 태스크 × 3 반복 = 모델당 ${TOWN_TASKS.length * 3} 회 호출.
마을 태스크(20×12 두 레이어 = 480개 정수)가 출력 토큰의 대부분이다. 그리드를 더 키우면
<code>max_tokens ${TOWN_DETERMINISTIC_PARAMS.maxTokens}</code> 에 닿아 <b>절단이 실력이 아닌 이유로</b>
점수를 갈라 버린다 — 절단은 계약 오류로 기록되고 0점과 구분된다.</p>

<h2><span class="num">09</span>두 번째 트랙 — 코딩 에이전트에게 리포를 던진다</h2>
<p class="lede">위 8개 섹션은 <b>하네스를 뗀 모델 단독</b>을 단발 호출로 잰다. 그런데 실제로 알고 싶은 것이
"코딩 에이전트에게 이 저장소와 칩셋을 던져 주면 <b>얼마나·어떻게</b> 만들어지는가"라면, 재는 단위가 달라진다 —
한 번의 JSON 답변이 아니라, 저장소를 뒤지고 도구를 찾아 쓰고 고쳐 가는 <b>에이전트 실행</b>이다.
그래서 트랙을 하나 더 뒀다(<code>src/benchmark/agent/</code> · <code>scripts/agent-bench.mts</code>).</p>

<table>
  <thead><tr><th></th><th>town 트랙 (§01~§08)</th><th>agent 트랙</th></tr></thead>
  <tbody>
    <tr><td class="c">재는 단위</td><td class="dim">단발 API 호출 1회</td><td><b>코딩 에이전트 실행</b>(<code>claude -p</code>, 도구·반복 허용)</td></tr>
    <tr><td class="c">지시</td><td class="dim">문항별 고정 프롬프트 + 팔레트</td><td><b>생짜</b> — "이 칩셋으로 마을을 만들어라". 크기·집 수·도구 이름을 말하지 않는다</td></tr>
    <tr><td class="c">하네스를 쓰면</td><td class="dim">불가능(도구가 없다)</td><td><b>그게 실력이다</b> — 찾아 쓰면 만점, 타일을 손으로 하드코딩하면 문법 항목에서 갈린다</td></tr>
    <tr><td class="c">채점</td><td class="dim">9축</td><td><b>quality</b>(감사 통과율) + <b>scale</b>(얼마나 만들었나) — 합치지 않는다</td></tr>
    <tr><td class="c">1.000 의 뜻</td><td class="dim">하네스를 재현했다</td><td><b>하네스 수준</b> — 정본 마을을 실제로 탐지해 기준선을 뽑는다</td></tr>
  </tbody>
</table>

<div class="note"><b>채점이 픽스처에서 독립해야 한다.</b> 생짜 지시는 맵 크기도 집 위치도 정하지 않으므로,
채점 전에 <b>탐지</b>가 온다(<code>agent/detect.ts</code>): 벽·지붕 계열의 8방향 성분으로 건물을 찾고,
그 벽에 난 문 두 칸으로 집을 판별하고, 길 성분·울타리 런·조각난 나무를 센다.
문 타일은 벽 계열이 아니어서 "문 칸이 건물에 속하는가"로 물으면 어느 집도 자기 문을 못 찾는다 —
문은 벽을 뚫고 난 구멍이므로 <b>주위 8칸에 그 건물의 벽이 있는가</b>로 묶는다(2026-08-21 실측 버그).</div>

<h3>첫 실측 — haiku, 생짜 지시, 20턴</h3>
<div class="shots">
  ${pngTag(
    await renderTileGridPng({
      width: groundTruth.placements.villageGrid.width,
      height: groundTruth.placements.villageGrid.height,
      lower: groundTruth.placements.villageGrid.lower,
      upper: groundTruth.placements.villageGrid.upper,
    }),
    "기준선 — 하네스가 만든 마을 (quality 1.000 / scale 1.000)",
  )}
  ${agentShot ?? ""}
</div>
<table>
  <thead><tr><th>실행</th><th class="n">quality</th><th class="n">scale</th><th class="n">집</th><th class="n">문</th><th class="n">턴</th><th class="n">비용</th><th class="n">분</th></tr></thead>
  <tbody>
    <tr><td class="c">하네스 정본</td><td class="n">1.000</td><td class="n">1.00</td><td class="n">3</td><td class="n">3</td><td class="n">—</td><td class="n">—</td><td class="n">—</td></tr>
    ${agentRow}
  </tbody>
</table>
<p class="dim">haiku 는 잔디를 깔고 십자 길을 내고 나무를 심었지만 <b>길을 몸통 타일로만</b> 깔았고
(오토타일 성형 없음), 벽 조각 3개에 <b>지붕도 문도 울타리도 없다</b> — 들어갈 수 있는 집이 0채다.
숫자가 아니라 이 그림이 그 사실을 즉시 보여 준다.</p>

<h2><span class="num">10</span>요약 — 설계 판단 5개</h2>
<table>
  <tbody>
    <tr><td class="c"><b>1</b></td><td><b>점수보다 "누가 하는가"가 먼저다.</b> 제품은 모델에게 번호를 고르게 하지 않는다.
      그래서 이 9숫자는 모델 등급표가 아니라 <b>하네스를 어디서 절대 걷어내면 안 되는가</b>의 지도다.</td></tr>
    <tr><td class="c"><b>2</b></td><td><b>팔레트는 주고 배치를 측정한다.</b> 어휘를 주지 않으면 측정되는 것이
      "시트 외우기"가 된다. 제품의 <code>tile_query</code> 도 어휘를 넘긴다.</td></tr>
    <tr><td class="c"><b>3</b></td><td><b>정답은 엔진이 만든다.</b> 손으로 쓴 정답은 엔진이 바뀌는 순간 거짓이 된다.
      픽스처 기하가 엔진 제약을 어기면 생성 자체가 실패한다.</td></tr>
    <tr><td class="c"><b>4</b></td><td><b>감점 항목은 평균이 아니라 배수다.</b> 아무것도 안 해서 얻는 점수는
      측정이 아니라 허점이다.</td></tr>
    <tr><td class="c"><b>5</b></td><td><b>그림 없는 숫자는 보고가 아니다.</b> 6·8·9번은 점수가 높아도 그림이 엉망일 수 있어
      <code>evidence</code> 가 모델 답을 실제 칩셋으로 합성해 정본과 나란히 굽는다.</td></tr>
  </tbody>
</table>

<footer class="end">
생성: <code>scripts/gen-town-bench-report.mts</code> ·
벤치마크 코드 <code>src/benchmark/town/</code> · CLI <code>scripts/town-bench.mts</code> ·
테스트 <code>test/townBench.test.ts</code> · 문서 <code>openwiki/town-tile-benchmark.md</code><br>
모든 타일 그림은 <code>public/assets/easyrpg-chipset-combined-town-transparent.png</code> 를 base64 로
인라인한 단일 스프라이트에서 잘라 썼고, 입력·정본 렌더는 벤치마크의 실제 렌더러
<code>renderTownImagePng()</code> · <code>renderTileGridPng()</code> 가 생성 시점에 만든 바이트다 —
채점기가 본 것과 감독이 보는 것이 어긋날 수 없다. 앞 보고서: <a href="${HARNESS_REPORT}">${HARNESS_REPORT}</a>
</footer>

</div></body></html>
`;

fs.writeFileSync(OUT_HTML, html, "utf8");
console.log(`wrote ${OUT_HTML} (${(html.length / 1024).toFixed(0)} KB)`);
