/**
 * 개념 꾸러미 「왜 여관이 매번 같은가」 설명서 — 실제 place_concept 파이프라인으로 여관을 여러 번 짓고
 * (1) 지금 결과가 픽셀 단위로 같음을 증명하고, (2) 방안 A·B·C·D 를 같은 파이프라인으로 흉내 내어
 * 각 방안이 결과를 얼마나 바꾸는지 그림으로 보인다.
 *
 * 흉내(mock) 방법 — 코드를 고치지 않고 **입력(꾸러미 구조)만** 바꿔서 그 방안의 효과를 재현한다:
 *   A  배치만 흔들기  → 물건 목록 순서를 시드로 섞는다. compose 가 순서를 다시 정렬하므로 거의 안 변한다(실측) —
 *                       그래서 A 는 도식(SVG 오버레이)으로 보이고, 실측 수치는 그대로 적는다.
 *   B  구성 뽑기      → 필수 아닌 물건을 시드로 70% 뽑는다
 *   C  모델 변주      → 장소 크기·바닥·벽·물건 추가/제외를 문장별로 다르게 준다
 *   D  사용자 저작    → C 와 같은 구조 차이를 사용자가 시설 두 개로 직접 저작한 것으로 본다
 *
 * 실행: npx tsx scripts/gen-concept-variety-explainer.mts
 * 산출: reports/concept-variety/index.html (+ png/*.png, chipset.png)
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { RESOURCE_SLICING } from "../src/assets/resourceSlicing.ts";
import { layoutConceptFacility, type ConceptRoomLayout } from "../src/editor/conceptBundleResolve.ts";
import { INTERIOR_ROOM_TILESET_ID } from "../src/editor/interiorRoomPipeline.ts";
import { interiorObjectById, type InteriorObjectDef } from "../src/editor/interiorObjectCatalog.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "../src/project/defaults/scratchInnBundle.ts";
import {
  conceptChipLabel,
  CONCEPT_FLOOR_MATERIAL_LABELS,
  CONCEPT_PLACE_ROLE_LABELS,
  CONCEPT_PLACE_SIZE_LABELS,
  CONCEPT_WALL_MATERIAL_LABELS,
  type ConceptBundleRecord,
  type ConceptThingRecord,
} from "../src/project/types/conceptBundle.ts";
import type { GameMap, Project, TilesetDef } from "../src/project/types.ts";
import { pngToDataUrl, renderInteriorMapPng, writePng } from "./lib/renderInteriorMapPng.mts";

const SHEET = RESOURCE_SLICING.chipset;
const COLS = SHEET.columns ?? 30;
const CELL = SHEET.cellWidth;
const SHEET_W = SHEET.sheetWidth ?? 480;
const SHEET_H = SHEET.sheetHeight ?? 256;
const CHIPSET_PNG = path.resolve("public/assets/easyrpg-chipset-interior-transparent.png");
const OUT_DIR = path.resolve("reports/concept-variety");
const PNG_DIR = path.join(OUT_DIR, "png");
const OUT_HTML = path.join(OUT_DIR, "index.html");
const SCALE = 3;

function esc(value: unknown): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function git(command: string): string {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch {
    return "?";
  }
}

// ── 결정적 난수(mulberry32) — 흉내용. 여기서는 입력 구조만 섞는다.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// ── 시공 ──────────────────────────────────────────────────────────────────────

type Built = {
  readonly label: string;
  readonly bundle: ConceptBundleRecord;
  readonly seed: number;
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  readonly layout: ConceptRoomLayout;
  readonly png: PNG;
  readonly file: string;
  readonly url: string;
  readonly summary: string;
  readonly warnings: readonly string[];
  /** 칩 이벤트가 붙은 물건의 앵커(thingId → 좌표들). 벽걸이(wall 칩만)는 이벤트가 없어 여기 없다. */
  readonly anchors: readonly { thingId: string; x: number; y: number }[];
};

function build(label: string, file: string, bundle: ConceptBundleRecord, seed: number): Built {
  const project: Project = createBlankProject();
  const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID];
  if (!tileset) throw new Error("실내 칩셋이 없다");
  // 사용자가 DB 「임시 → 개념 꾸러미」에서 고친 것과 같은 자리(scratchConceptBundles)에 넣는다.
  tileset.scratchConceptBundles = [bundle];
  const ctx = { project };
  const mapId = `m${file.replace(/\.png$/, "").replace(/[^a-z0-9]/gi, "")}`;
  const result = runTool(ctx, "place_concept", { query: "여관", mapId, seed }, { dryRun: false });
  if (!result.ok) throw new Error(`${label} 시공 실패: ${result.summary} ${JSON.stringify(result.issues)}`);
  const map = ctx.project.maps[mapId];
  if (!map) throw new Error(`${label}: 맵이 없다`);
  const png = renderInteriorMapPng(map, tileset, { scale: SCALE });
  writePng(png, path.join(PNG_DIR, file));
  const prefix = `ev_concept_${map.id}_`;
  const anchors = map.events
    .filter((event) => event.id.startsWith(prefix))
    .map((event) => ({ thingId: event.id.slice(prefix.length).replace(/_\d+$/, ""), x: event.x, y: event.y }));
  return {
    label,
    bundle,
    seed,
    map,
    tileset,
    layout: layoutConceptFacility(bundle, bundle.facilities[0]!),
    png,
    file,
    url: pngToDataUrl(png),
    summary: result.summary,
    warnings: [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])],
    anchors,
  };
}

/** 두 렌더의 픽셀 차이 비율(0..1). 크기가 다르면 null. */
function pixelDiff(a: PNG, b: PNG): number | null {
  if (a.width !== b.width || a.height !== b.height) return null;
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) diff += 1;
  }
  return diff / (a.width * a.height);
}

/** 차이 하이라이트 — 같은 칸은 어둡게, 다른 칸은 주황. 크기가 다르면 null. */
function diffOverlay(base: PNG, other: PNG, file: string): string | null {
  if (base.width !== other.width || base.height !== other.height) return null;
  const out = new PNG({ width: base.width, height: base.height });
  for (let i = 0; i < base.data.length; i += 4) {
    const same = base.data[i] === other.data[i] && base.data[i + 1] === other.data[i + 1] && base.data[i + 2] === other.data[i + 2];
    if (same) {
      const g = Math.round((((other.data[i] ?? 0) + (other.data[i + 1] ?? 0) + (other.data[i + 2] ?? 0)) / 3) * 0.3);
      out.data[i] = g; out.data[i + 1] = g; out.data[i + 2] = g;
    } else {
      out.data[i] = 255; out.data[i + 1] = 140; out.data[i + 2] = 40;
    }
    out.data[i + 3] = 255;
  }
  writePng(out, path.join(PNG_DIR, file));
  return pngToDataUrl(out);
}

// ── 흉내용 꾸러미 변형 ─────────────────────────────────────────────────────────

const INN = cloneConceptBundle(SCRATCH_INN_BUNDLE);

/** A — 물건 순서만 시드로 섞는다. 같은 물건 세트, 같은 도면. */
function mockA(seed: number): ConceptBundleRecord {
  const bundle = cloneConceptBundle(INN);
  bundle.things = shuffled(bundle.things, mulberry32(seed * 7919 + 13));
  return bundle;
}

/** B — 필수 아닌 물건을 시드로 70% 뽑는다. 필수는 항상. */
function mockB(seed: number): ConceptBundleRecord {
  const rng = mulberry32(seed * 104729 + 29);
  const bundle = cloneConceptBundle(INN);
  bundle.things = bundle.things.filter((thing) => thing.required || rng() < 0.7);
  return bundle;
}

/** C — 「허름한 여관」: 작은 객실, 널 바닥, 단층(계단 없음), 피아노·진열대·시계·갑옷 제외, 술통·잡화 상자 추가. */
function mockCShabby(): ConceptBundleRecord {
  const bundle = cloneConceptBundle(INN);
  for (const place of bundle.places) {
    if (place.id === "bedroom") { place.size = "s"; place.floor = "plank"; }
    if (place.id === "dining") { place.floor = "plank"; }
  }
  bundle.things = bundle.things
    .filter((thing) => !["piano", "display", "clock", "armor", "stairs", "counter"].includes(thing.id))
    .map((thing) => (thing.id === "table_long" ? { ...thing, required: false } : thing))
    .map((thing) => (thing.id === "table_chairs" ? { ...thing, required: true } : thing));
  bundle.things.push({ id: "barrel", label: "술통", objectId: "barrel", placeIds: ["dining", "corridor"], chips: ["block"] });
  bundle.things.push({ id: "box", label: "잡화 상자", objectId: "box", placeIds: ["bedroom", "corridor"], chips: ["block", "loot"] });
  return bundle;
}

/** C — 「고급 여관」: 큰 객실, 돌 바닥, 금빛 벽돌, 붉은 카펫·그림·책장 추가. */
function mockCGrand(): ConceptBundleRecord {
  const bundle = cloneConceptBundle(INN);
  for (const facility of bundle.facilities) facility.wall = "gold-brick";
  for (const place of bundle.places) {
    if (place.id === "bedroom") { place.size = "l"; place.floor = "stone"; }
    if (place.id === "dining") { place.floor = "stone"; }
  }
  bundle.things.push({ id: "rug_red", label: "붉은 카펫", objectId: "rug_red", placeIds: ["dining"], chips: ["pass", "floor"] });
  bundle.things.push({ id: "picture_hall", label: "그림", objectId: "picture", placeIds: ["dining"], chips: ["wall"] });
  bundle.things.push({ id: "bookshelf", label: "책장", objectId: "bookshelf", placeIds: ["bedroom"], chips: ["block", "event"] });
  return bundle;
}

// ── 실행 ──────────────────────────────────────────────────────────────────────

fs.mkdirSync(PNG_DIR, { recursive: true });
fs.copyFileSync(CHIPSET_PNG, path.join(OUT_DIR, "chipset.png"));

const baseline = [7, 1, 99].map((seed) => build(`지금 · seed ${seed}`, `00-now-seed${seed}.png`, cloneConceptBundle(INN), seed));
const base = baseline[0]!;
const optionA = [11, 22, 33].map((seed, index) => build(`A 실험 #${index + 1}`, `10-A-${index + 1}.png`, mockA(seed), seed));
const optionB = [41, 52, 63].map((seed, index) => build(`B · 구성 뽑기 #${index + 1}`, `20-B-${index + 1}.png`, mockB(seed), seed));
const shabby = build("C · 「허름한 여관 지어줘」", "30-C-shabby.png", mockCShabby(), 7);
const grand = build("C · 「귀족이 묵는 고급 여관」", "31-C-grand.png", mockCGrand(), 7);

const all = [...baseline, ...optionA, ...optionB, shabby, grand];
for (const built of all) {
  const ratio = pixelDiff(base.png, built.png);
  console.log(`${built.file.padEnd(20)} ${built.map.width}×${built.map.height}  diff=${ratio === null ? "크기 다름" : `${(ratio * 100).toFixed(1)}%`}  warn=${built.warnings.length}  ${built.summary}`);
  for (const line of built.warnings) console.log(`    ! ${line}`);
}

const baselineDiffs = baseline.map((built) => pixelDiff(base.png, built.png) ?? 1);
const aDiffs = optionA.map((built) => pixelDiff(base.png, built.png) ?? 1);
const bDiffs = optionB.map((built) => pixelDiff(base.png, built.png) ?? 1);
const baselineOverlay = diffOverlay(base.png, baseline[2]!.png, "01-now-diff.png");
const bOverlays = optionB.map((built, index) => diffOverlay(base.png, built.png, `21-B-${index + 1}-diff.png`));

// ── HTML 조각 ─────────────────────────────────────────────────────────────────

function chipStyle(tile: number, scale: number): string {
  const col = tile % COLS;
  const row = Math.floor(tile / COLS);
  const size = CELL * scale;
  return `width:${size}px;height:${size}px;background-size:${SHEET_W * scale}px ${SHEET_H * scale}px;background-position:-${col * size}px -${row * size}px`;
}

function tileSpan(tile: number, scale: number): string {
  return tile < 0 ? "" : `<span class="t" style="${chipStyle(tile, scale)}"></span>`;
}

function objectSprite(object: InteriorObjectDef, scale = 2): string {
  const size = CELL * scale;
  const cells: string[] = [];
  for (let dy = 0; dy < object.height; dy += 1) {
    for (let dx = 0; dx < object.width; dx += 1) {
      const here = object.cells.filter((cell) => cell.dx === dx && cell.dy === dy);
      const lower = here.find((cell) => cell.layer === "lower");
      const upper = here.find((cell) => cell.layer === "upper");
      cells.push(`<span class="cell" style="width:${size}px;height:${size}px">${lower ? tileSpan(lower.tile, scale) : ""}${upper ? tileSpan(upper.tile, scale) : ""}</span>`);
    }
  }
  return `<span class="sprite" style="grid-template-columns:repeat(${object.width},${size}px)">${cells.join("")}</span>`;
}

function thingChip(thing: ConceptThingRecord, state: "on" | "off" | "new" = "on"): string {
  const object = interiorObjectById(thing.objectId);
  const chips = thing.chips.map((chip) => `<i class="chip ${chip}">${esc(conceptChipLabel(chip))}</i>`).join("");
  return `<span class="thing ${state}" title="${esc(thing.objectId)}">${object ? objectSprite(object) : ""}<span class="tl">${esc(thing.label)}${thing.required ? '<b class="req">필수</b>' : ""}</span><span class="chips">${chips}</span></span>`;
}

function placeCard(bundle: ConceptBundleRecord, placeId: string, changed: ReadonlySet<string> = new Set(), removed: readonly ConceptThingRecord[] = [], added: ReadonlySet<string> = new Set()): string {
  const place = bundle.places.find((entry) => entry.id === placeId);
  if (!place) return "";
  const things = bundle.things.filter((thing) => thing.placeIds.includes(placeId));
  const gone = removed.filter((thing) => thing.placeIds.includes(placeId));
  const role = CONCEPT_PLACE_ROLE_LABELS[place.role ?? "room"];
  const size = CONCEPT_PLACE_SIZE_LABELS[place.size ?? "m"];
  const count = place.count ?? 1;
  const floor = CONCEPT_FLOOR_MATERIAL_LABELS[place.floor ?? "wood"];
  const mark = (key: string, text: string): string => (changed.has(`${placeId}.${key}`) ? `<mark>${esc(text)}</mark>` : esc(text));
  return `<div class="place">
    <div class="ph"><b>${esc(place.label)}</b><span class="pm">${mark("role", role)} · ${mark("size", size)}${count > 1 ? ` · ${mark("count", `×${count}`)}` : ""} · ${mark("floor", floor)}</span></div>
    <div class="things">${things.map((thing) => thingChip(thing, added.has(thing.id) ? "new" : "on")).join("")}${gone.map((thing) => thingChip(thing, "off")).join("")}</div>
  </div>`;
}

function bundleTree(bundle: ConceptBundleRecord, options: { changed?: ReadonlySet<string>; removed?: readonly ConceptThingRecord[]; added?: ReadonlySet<string>; title?: string } = {}): string {
  const facility = bundle.facilities[0]!;
  const wall = CONCEPT_WALL_MATERIAL_LABELS[facility.wall ?? "cream"];
  const changed = options.changed ?? new Set<string>();
  return `<div class="tree">
    <div class="root"><span class="k">시설</span><b>${esc(options.title ?? facility.label)}</b><span class="pm">벽 ${changed.has("wall") ? `<mark>${esc(wall)}</mark>` : esc(wall)}</span></div>
    <div class="branches">${facility.placeIds.map((placeId) => placeCard(bundle, placeId, changed, options.removed ?? [], options.added ?? new Set())).join("")}</div>
  </div>`;
}

/** A 도식 — 지금 렌더 위에 「같은 가구가 방 안에서 좌우로 옮겨 앉는다」를 SVG 화살표로 얹는다. */
function optionAOverlay(built: Built): string {
  const W = built.map.width;
  const H = built.map.height;
  const rooms = built.layout.rooms;
  const roomOf = (x: number, y: number) => rooms.find((room) => x >= room.x && x < room.x + room.w && y >= room.y - 2 && y < room.y + room.h);
  const arrows: string[] = [];
  const seen = new Set<string>();
  for (const anchor of built.anchors) {
    if (anchor.thingId === "stairs") continue; // 복도 끝 고정 — 도식에서 제외
    const room = roomOf(anchor.x, anchor.y);
    if (!room) continue;
    const key = `${anchor.thingId}@${room.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const mirrored = room.x + (room.x + room.w - 1 - anchor.x);
    if (Math.abs(mirrored - anchor.x) < 1) continue;
    const y = anchor.y + 0.5;
    arrows.push(`<line x1="${anchor.x + 0.5}" y1="${y}" x2="${mirrored + 0.5}" y2="${y}" class="mv"/>`
      + `<circle cx="${anchor.x + 0.5}" cy="${y}" r="0.42" class="from"/>`
      + `<circle cx="${mirrored + 0.5}" cy="${y}" r="0.42" class="to"/>`);
  }
  const boxes = rooms.map((room) => `<rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" class="rm"/>`).join("");
  return `<div class="overlay"><img src="${built.url}" alt="지금 여관"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${boxes}${arrows.join("")}</svg></div>`;
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function callBlock(text: string): string {
  return `<pre class="call">${esc(text)}</pre>`;
}

const removedB = optionB.map((built) => INN.things.filter((thing) => !built.bundle.things.some((kept) => kept.id === thing.id)));
const shabbyRemoved = INN.things.filter((thing) => !shabby.bundle.things.some((kept) => kept.id === thing.id));
const shabbyAdded = new Set(shabby.bundle.things.filter((thing) => !INN.things.some((orig) => orig.id === thing.id)).map((thing) => thing.id));
const grandAdded = new Set(grand.bundle.things.filter((thing) => !INN.things.some((orig) => orig.id === thing.id)).map((thing) => thing.id));

const sha = git("git rev-parse --short HEAD");
const branch = git("git rev-parse --abbrev-ref HEAD");
const now = new Date().toISOString().slice(0, 16).replace("T", " ");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>여관이 왜 매번 같은가 — place_concept 의 결정성과 네 가지 방안</title>
<style>
  :root {
    --bg:#14110e; --ink:#f4ece0; --dim:#c4b6a4; --faint:#8a7d6d; --line:#3a3128; --card:#1d1914;
    --accent:#e8b86d; --ok:#7dcaa0; --bad:#e07a7a; --warn:#f0a35a; --blue:#7eb6e8;
    --pass:#7dcaa0; --block:#e07a7a; --event:#e8c35a; --transfer:#7eb6e8; --loot:#c59bde; --sleep:#9aa6e8; --floor:#c4a574; --wall:#b9a089;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font:16px/1.65 "Apple SD Gothic Neo","Noto Sans KR","Pretendard",system-ui,sans-serif;background:radial-gradient(900px 420px at 10% -10%,#3a2a18 0%,transparent 55%),var(--bg);color:var(--ink)}
  .wrap{width:min(1320px,calc(100% - 40px));margin:0 auto;padding:48px 0 90px}
  .kicker{font:700 12px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
  h1{font-size:40px;letter-spacing:-.03em;margin:10px 0 8px;line-height:1.15}
  h2{font-size:26px;margin:56px 0 14px;letter-spacing:-.01em;padding-top:18px;border-top:1px solid var(--line)}
  h2 .tag{display:inline-block;font:700 12px/1 ui-monospace,monospace;letter-spacing:.1em;padding:6px 9px;border-radius:8px;background:#2a2219;color:var(--accent);vertical-align:middle;margin-right:10px}
  h3{font-size:18px;margin:22px 0 10px}
  .meta{color:var(--faint);font:12px/1.6 ui-monospace,monospace;margin-bottom:22px}
  .lede{color:var(--dim);max-width:80ch;font-size:17px}
  .tldr{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:22px}
  .tldr .card b{display:block;font-size:15px;color:var(--accent);margin-bottom:6px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  figure{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden}
  figure img{display:block;width:100%;height:auto;image-rendering:pixelated;image-rendering:crisp-edges;background:#0c0a08}
  figcaption{padding:12px 14px;color:var(--dim);font-size:13.5px;border-top:1px solid var(--line)}
  figcaption b{color:var(--ink)}
  .badge{display:inline-block;font:700 12px/1 ui-monospace,monospace;padding:5px 8px;border-radius:999px;margin-right:6px;vertical-align:middle}
  .badge.zero{background:#27362d;color:var(--ok)} .badge.some{background:#3a2d1c;color:var(--warn)} .badge.big{background:#3a2020;color:var(--bad)} .badge.info{background:#1f2a36;color:var(--blue)}
  /* 파이프라인 */
  .pipe{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:stretch;margin-top:14px}
  .stage{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;position:relative}
  .stage .n{font:700 11px/1 ui-monospace,monospace;color:var(--faint);letter-spacing:.1em}
  .stage h4{font-size:16px;margin:6px 0 6px}
  .stage p{font-size:13px;color:var(--dim)}
  .stage .rnd{margin-top:10px;font:700 12px/1 ui-monospace,monospace;padding:6px 8px;border-radius:8px;display:inline-block}
  .stage .rnd.no{background:#3a2020;color:var(--bad)} .stage .rnd.yes{background:#27362d;color:var(--ok)} .stage .rnd.dead{background:#332a1c;color:var(--warn)}
  .stage .src{font:12px/1.5 ui-monospace,monospace;color:var(--faint);margin-top:8px;word-break:break-all}
  .stage:not(:last-child)::after{content:"→";position:absolute;right:-13px;top:44%;color:var(--faint);font-size:18px}
  /* 구조 트리 */
  .tree{margin-top:12px}
  .root{display:flex;gap:12px;align-items:baseline;padding:10px 14px;border:1px solid var(--accent);border-radius:12px;background:#231b12;width:max-content}
  .root .k,.place .k{font:700 11px/1 ui-monospace,monospace;color:var(--accent);letter-spacing:.1em}
  .pm{color:var(--dim);font-size:13px}
  .branches{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0 0 26px;position:relative}
  .branches::before{content:"";position:absolute;left:-14px;top:-12px;bottom:40%;border-left:2px solid var(--line)}
  .place{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
  .ph{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:8px;flex-wrap:wrap}
  .things{display:flex;flex-wrap:wrap;gap:8px}
  .thing{display:inline-flex;flex-direction:column;align-items:center;gap:4px;padding:8px 8px 6px;border-radius:10px;background:#0f0d0b;border:1px solid var(--line);min-width:76px}
  .thing.off{opacity:.32;filter:grayscale(1);border-style:dashed}
  .thing.new{border-color:var(--ok);box-shadow:0 0 0 1px #27362d inset}
  .thing .tl{font-size:12px;color:var(--ink);text-align:center;line-height:1.3}
  .thing .req{display:inline-block;font:700 10px/1 ui-monospace,monospace;color:var(--accent);margin-left:4px}
  .chips{display:flex;gap:3px;flex-wrap:wrap;justify-content:center}
  .chip{font:600 10px/1 ui-monospace,monospace;font-style:normal;padding:3px 5px;border-radius:5px;background:#1a1613;color:var(--dim);border:1px solid var(--line)}
  .chip.pass{color:var(--pass)} .chip.block{color:var(--block)} .chip.event{color:var(--event)} .chip.transfer{color:var(--transfer)} .chip.loot{color:var(--loot)} .chip.sleep{color:var(--sleep)} .chip.floor{color:var(--floor)} .chip.wall{color:var(--wall)}
  .sprite{display:grid;gap:0;background:#2b2520;padding:2px;border-radius:4px}
  .cell{position:relative;display:inline-block}
  .t{position:absolute;left:0;top:0;display:block;background-image:url(chipset.png);background-repeat:no-repeat;image-rendering:pixelated}
  mark{background:#4a3a1a;color:#ffd98a;padding:0 4px;border-radius:4px}
  /* A 도식 */
  .overlay{position:relative;background:#0c0a08}
  .overlay img{display:block;width:100%;height:auto;image-rendering:pixelated;opacity:.55}
  .overlay svg{position:absolute;inset:0;width:100%;height:100%}
  .overlay .rm{fill:none;stroke:#7eb6e8;stroke-width:.12;stroke-dasharray:.3 .2;opacity:.8}
  .overlay .mv{stroke:#ffb347;stroke-width:.14;stroke-dasharray:.35 .25}
  .overlay .from{fill:#ffb347;opacity:.95} .overlay .to{fill:none;stroke:#ffb347;stroke-width:.14}
  pre.call{font:13px/1.55 ui-monospace,monospace;background:#0f0d0b;border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:#e6d9c4;overflow:auto;white-space:pre-wrap}
  .say{font-size:15px;color:var(--ink);margin:0 0 8px}
  .say b{color:var(--accent)}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  th{color:var(--faint);font:700 12px/1.3 ui-monospace,monospace;letter-spacing:.06em}
  td.y{color:var(--ok)} td.n{color:var(--bad)} td.p{color:var(--warn)}
  .note{color:var(--dim);font-size:14px;margin-top:10px}
  .verdict{border:1px solid var(--accent);background:#231b12;border-radius:16px;padding:20px 22px;margin-top:18px}
  .verdict h3{margin-top:0;color:var(--accent)}
  .db{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0 14px}
  .db .fac{padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:#0f0d0b;font-size:14px}
  .db .fac.on{border-color:var(--accent);color:var(--accent)} .db .plus{color:var(--faint)}
  ul.plain{margin:8px 0 0 18px;color:var(--dim)} ul.plain li{margin:4px 0}
  @media (max-width:980px){.pipe,.grid3,.grid4,.branches,.tldr{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}.stage:not(:last-child)::after{display:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="kicker">OPRN · 편집기 조수 · 개념 꾸러미</div>
  <h1>「여관 지어줘」가 왜 매번 같은 여관을 내놓는가</h1>
  <div class="meta">${esc(branch)} @ ${esc(sha)} · ${esc(now)} · 아래 그림은 전부 이 저장소의 <code>place_concept</code> 파이프라인과 실내 칩셋으로 실제 렌더한 것. 방안 A·B·C 그림은 <b>코드를 고치지 않고 입력(꾸러미 구조)만 바꿔</b> 그 방안의 결과를 흉내 낸 것이다.</div>
  <p class="lede">짧게 말하면 — AI 가 여관을 「꾸미는」 게 아니다. AI 는 시설명 한 단어(<code>query:"여관"</code>)를 넣고, 그 뒤는 <b>난수가 전혀 없는 결정적 생성기</b>가 사용자 DB 의 「여관」 구조를 그대로 맵으로 편다. 같은 입력 → 같은 출력. 아래에서 (1) 왜 같은지, (2) 그 증거, (3) 다르게 만들 네 가지 길을 그림으로 본다.</p>
  <div class="tldr">
    <div class="card"><b>왜 같은가</b>도면(방 배치)·구성(가구 자리)·그림(물건 1개 = 타일 1묶음)·재질 네 단계 어디에도 난수가 없고, 모델은 시설명 외에 넣을 손잡이가 없다.</div>
    <div class="card"><b>증거</b>seed 7 · 1 · 99 로 세 번 지은 여관의 픽셀 차이 = ${esc(pct(Math.max(...baselineDiffs)))}. <code>seed</code> 인자는 이 경로에서 소비되지 않는다.</div>
    <div class="card"><b>추천</b>A(배치 흔들기)+B(구성 뽑기)를 한 번에. 사용자 구조가 정본이라는 원칙을 지키면서 여관 열 채가 서로 달라진다. C(모델 변주)는 그 뒤에 따로 결정.</div>
  </div>

  <h2><span class="tag">1</span>지금 무슨 일이 일어나나 — 다섯 단계, 난수 0</h2>
  <p class="lede">사용자 문장이 맵이 되기까지의 실제 경로다. 빨간 표식은 「이 단계는 같은 입력에 항상 같은 출력」이라는 뜻이다.</p>
  <div class="pipe">
    <div class="stage"><div class="n">01 · LLM</div><h4>「여관 지어줘」→ 툴 호출</h4><p>모델은 <code>place_concept({query:"여관", mapId})</code> 만 만든다. 크기·분위기·재질을 넣을 인자가 없다.</p><span class="rnd dead">손잡이 없음</span><div class="src">src/editor/tools/placeConceptTool.ts:44-58</div></div>
    <div class="stage"><div class="n">02 · 구조 조회</div><h4>DB 「임시 → 개념 꾸러미」</h4><p>시설 → 장소 → 물건 → 칩. 사용자가 고친 것이 정본. 여관 초안은 장소 3 · 물건 15.</p><span class="rnd no">난수 없음</span><div class="src">src/editor/conceptBundleResolve.ts:129</div></div>
    <div class="stage"><div class="n">03 · 도면</div><h4>장소 역할·크기·개수 → 방 배치</h4><p>남→북으로 홀(정문) → 복도 → 방 줄. 발자국은 상수(s 5×3 · m 7×4 · l 9×5).</p><span class="rnd no">난수 없음</span><div class="src">conceptBundleResolve.ts:229 layoutConceptFacility</div></div>
    <div class="stage"><div class="n">04 · 구성</div><h4>물건을 슬롯에 앉힌다</h4><p>벽→러그→바닥 순, 필수 먼저, 「서쪽 첫 자리 / 가운데 / 앵커에서 가장 먼 칸」. 파일 전체에 seed·RNG 참조 0건.</p><span class="rnd no">난수 없음</span><div class="src">src/editor/interiorConceptCompose.ts:222-256</div></div>
    <div class="stage"><div class="n">05 · 그림</div><h4>물건 id → 고정 타일 묶음</h4><p><code>bed_h</code> 는 항상 같은 두 타일. 스킨·변형 풀이 없다. 벽은 <code>wall ?? cream</code>, 바닥은 <code>floor ?? wood</code>.</p><span class="rnd no">난수 없음</span><div class="src">src/editor/interiorObjectCatalog.ts:107-</div></div>
  </div>
  <p class="note"><b>seed 는 왜 죽어 있나.</b> <code>placeConceptTool.ts:104</code> 가 기본값 7 을 파이프라인에 넘기지만, 파이프라인에서 <code>RNG()</code> 를 쓰는 4곳(장식 로테이션 <code>:1728</code> · 뽑기 <code>:1938</code> · 지터 <code>:2258</code>)은 전부 <b>테마 가구 경로</b>다. 개념 꾸러미가 있으면 그 경로가 꺼지고(<code>interiorRoomPipeline.ts:1103</code>, <code>:1145</code>) 구성은 <code>composeConceptRoom</code> 만 부른다. 그래서 모델이 seed 를 바꿔 넣어도 결과가 그대로다.</p>

  <h3>여관의 「구조」 — 시설 → 장소 → 물건 → 칩</h3>
  <p class="note">앞 대화에서 「나무」라고 부른 것이 이것이다(자료구조 tree). 이 구조가 04·05 단계의 유일한 입력이다. 물건 그림은 실제 칩셋 타일이다.</p>
  ${bundleTree(INN)}

  <h2><span class="tag">2</span>증거 — 세 번 지어도 픽셀 하나 안 다르다</h2>
  <p class="lede">같은 초안 구조로 <code>seed</code> 를 7 · 1 · 99 로 바꿔 세 번 지었다. 네 번째 그림은 1번과 3번의 픽셀 차이를 주황으로 칠한 것 — 주황이 하나도 없다.</p>
  <div class="grid4">
    ${baseline.map((built, index) => `<figure><img src="${built.url}" alt="${esc(built.label)}"><figcaption><span class="badge ${baselineDiffs[index] === 0 ? "zero" : "some"}">diff ${esc(pct(baselineDiffs[index]!))}</span><b>${esc(built.label)}</b> · ${built.map.width}×${built.map.height}</figcaption></figure>`).join("")}
    <figure><img src="${baselineOverlay ?? ""}" alt="차이 하이라이트"><figcaption><span class="badge zero">주황 픽셀 0</span><b>seed 7 vs seed 99 차이</b> — 다른 픽셀이 있으면 주황으로 칠해진다.</figcaption></figure>
  </div>

  <h2><span class="tag">A</span>배치만 흔든다 — 같은 가구, 다른 자리</h2>
  <div class="grid2">
    <div>
      <p class="say"><b>무엇을 바꾸나.</b> <code>composeConceptRoom</code> 에 seed 를 넘겨 동률 후보 사이의 선택(<code>spreadPick</code> 의 서/중/동, 앵커 거리 동률)을 시드로 고르고, 모델이 seed 를 안 주면 mapId 해시로 자동 파생한다. 코드는 <code>placeConceptTool.ts</code> · <code>interiorConceptCompose.ts</code> 두 파일.</p>
      <p class="say"><b>결과.</b> 침대·시계·캐비닛이 방 안에서 좌우로 옮겨 앉고, 홀의 피아노·카운터·진열대 순서가 바뀐다. 오른쪽 도식의 주황 점(지금 자리) → 고리(옮겨 갈 자리).</p>
      <p class="say"><b>안 바뀌는 것.</b> 방 개수·크기·문 위치, 가구 종류, 벽·바닥 색. 한 발 떨어져 보면 「같은 여관」이다.</p>
      <p class="note"><b>실측 주의.</b> 코드를 안 고치고 흉내 내려고 물건 목록 순서만 시드로 섞어 세 번 지어 봤다 — 픽셀 차이 ${optionA.map((_, index) => esc(pct(aDiffs[index]!))).join(" · ")}. compose 가 목록을 다시 정렬하기 때문에 입력 순서는 거의 힘이 없다. 즉 A 는 <b>compose 내부</b>에 시드를 넣어야 하고, 넣어도 효과는 위 도식 수준(가구 위치)에 그친다.</p>
    </div>
    <figure>${optionAOverlay(base)}<figcaption><span class="badge info">도식</span><b>지금 여관 위에 A 의 효과를 얹은 그림</b> — 파란 점선은 방 bbox, 주황 점→고리는 「이 가구가 이런 식으로 옮겨 앉을 수 있다」. 실제 알고리즘 출력이 아닌 설명용 도식이다.</figcaption></figure>
  </div>

  <h2><span class="tag">B</span>구성을 뽑는다 — 필수는 항상, 나머지는 시드로 70%</h2>
  <p class="lede">필수(<b>필수</b> 표식: 침대·계단·긴 탁자·피아노)는 항상 놓고, 필수가 아닌 물건은 시드로 골라 넣는다. 아래 세 장은 <b>실제 파이프라인 출력</b>이다 — 초안 구조에서 물건만 빼고 지었다. 회색 점선 물건이 그 회차에 빠진 것.</p>
  <div class="grid3">
    ${optionB.map((built, index) => `<figure><img src="${built.url}" alt="${esc(built.label)}"><figcaption><span class="badge some">diff ${esc(pct(bDiffs[index]!))}</span><b>${esc(built.label)}</b> — 빠진 물건: ${removedB[index]!.length > 0 ? esc(removedB[index]!.map((thing) => thing.label).join(" · ")) : "없음"}</figcaption></figure>`).join("")}
  </div>
  <div class="grid3" style="margin-top:14px">
    ${bOverlays.map((url, index) => `<figure><img src="${url ?? ""}" alt="B #${index + 1} 차이"><figcaption><b>#${index + 1} vs 지금</b> — 주황 = 달라진 픽셀</figcaption></figure>`).join("")}
  </div>
  <h3>회차별 구조 — 무엇이 빠졌나</h3>
  ${optionB.map((built, index) => `<div class="card" style="margin-top:10px"><div class="pm" style="margin-bottom:6px"><b style="color:var(--ink)">${esc(built.label)}</b> · seed ${built.seed}</div>${bundleTree(built.bundle, { removed: removedB[index]!, title: "여관" })}</div>`).join("")}
  <p class="note"><b>주의할 부작용.</b> 지금은 필수가 아니어도 자리가 있으면 다 놓인다. B 이후에는 「안 나올 수도」 있게 되므로, DB 에서 물건을 넣어 둔 사용자가 「왜 없어?」 할 수 있다. 그래서 시설마다 <code>구성: 고정 | 뽑기</code> 토글 하나를 DB 탭에 달아야 한다(기본은 뽑기). A 를 포함하면 위치까지 같이 바뀐다.</p>

  <h2><span class="tag">C</span>모델이 변주를 얹는다 — 사용자 문장이 결과에 닿게</h2>
  <p class="lede"><code>place_concept</code> 에 <code>scale · wall · floor · extras · omit</code> 인자를 열고, 프롬프트가 「허름한/고급/작은/단층」 같은 낱말을 그 인자로 옮기게 한다. 아래 두 장은 그 인자가 구조에 반영됐다고 치고 지은 <b>실제 파이프라인 출력</b>이다.</p>
  <div class="grid2">
    <div>
      <p class="say">사용자: <b>「허름한 여관 지어줘」</b></p>
      ${callBlock(`place_concept({
  query: "여관", mapId: "inn_cheap",
  scale: "s",            // 객실 5×3
  floor: "plank",        // 널 바닥
  omit: ["피아노", "진열대", "괘종시계", "갑옷 전시대", "가로 계단", "카운터 런"],
  extras: ["술통", "잡화 상자"]
})`)}
      <figure style="margin-top:12px"><img src="${shabby.url}" alt="허름한 여관"><figcaption><span class="badge big">${shabby.map.width}×${shabby.map.height} · 크기 자체가 다름</span><b>허름한 여관</b> — 작은 객실, 널 바닥, 단층, 홀엔 탁자와 술통.</figcaption></figure>
      ${bundleTree(shabby.bundle, { changed: new Set(["bedroom.size", "bedroom.floor", "dining.floor"]), removed: shabbyRemoved, added: shabbyAdded, title: "여관 (허름)" })}
    </div>
    <div>
      <p class="say">사용자: <b>「귀족들이 묵는 고급 여관」</b></p>
      ${callBlock(`place_concept({
  query: "여관", mapId: "inn_grand",
  scale: "l",            // 객실 9×5
  wall: "gold-brick",    // 금빛 벽돌
  floor: "stone",        // 돌 바닥
  extras: ["붉은 카펫", "그림", "책장"]
})`)}
      <figure style="margin-top:12px"><img src="${grand.url}" alt="고급 여관"><figcaption><span class="badge big">${grand.map.width}×${grand.map.height} · 크기 자체가 다름</span><b>고급 여관</b> — 큰 객실, 돌 바닥, 금빛 벽돌, 홀에 붉은 카펫과 그림.</figcaption></figure>
      ${bundleTree(grand.bundle, { changed: new Set(["wall", "bedroom.size", "bedroom.floor", "dining.floor"]), added: grandAdded, title: "여관 (고급)" })}
    </div>
  </div>
  <p class="note"><b>충돌.</b> 「사용자가 DB 에서 고친 구조가 정본」 원칙과 정면으로 부딪힌다. 사용자가 벽을 석재 벽돌로 정해 놨는데 모델이 금빛 벽돌로 덮어쓰면 버그인지 기능인지 애매해진다. 규칙 하나가 필요하다 — 예: <b>사용자가 비워 둔 필드만 모델이 채운다</b>(벽·바닥을 DB 에서 명시했으면 모델 인자는 무시하고 경고). 프롬프트 절(<code>contextBuilder.ts:394</code>)과 의도 선언(<code>intentDeclaration.ts</code>)도 같이 바뀐다. 이틀 이상.</p>

  <h2><span class="tag">D</span>코드 변경 없음 — 사용자가 시설을 여러 개 저작한다</h2>
  <p class="lede">지금 당장 되는 유일한 길. DB 「임시 → 개념 꾸러미」의 시설 띠에서 <code>+ 시설</code> 로 「여관(허름)」「여관(고급)」을 만들고 각각 장소 크기·바닥·벽·물건을 다르게 저작한다. 모델은 시설명으로 골라 부른다. 결과 그림은 C 와 같다 — 차이는 <b>누가 변주를 만드나</b>(사람 vs 모델)뿐이다.</p>
  <div class="card">
    <div class="pm">데이터베이스 → 임시 → 개념 꾸러미 → 시설 띠</div>
    <div class="db"><span class="fac on">여관</span><span class="fac">여관(허름)</span><span class="fac">여관(고급)</span><span class="fac">민가</span><span class="fac">상점</span><span class="plus">+ 시설 · 초안 넣기…</span></div>
    <div class="grid3">
      <figure><img src="${base.url}" alt="여관"><figcaption><b>「여관 지어줘」</b> → 시설 「여관」</figcaption></figure>
      <figure><img src="${shabby.url}" alt="여관(허름)"><figcaption><b>「허름한 여관 지어줘」</b> → 시설 「여관(허름)」 (시설명 매칭에 의존)</figcaption></figure>
      <figure><img src="${grand.url}" alt="여관(고급)"><figcaption><b>「고급 여관 지어줘」</b> → 시설 「여관(고급)」</figcaption></figure>
    </div>
    <p class="note">한계: 다양성을 전부 사람이 손으로 만든다. 그리고 「여관(허름)」 같은 라벨을 모델이 문장에서 정확히 골라 부르는지는 <code>resolveConceptFacility</code> 의 라벨 매칭에 달려 있어 별도 확인이 필요하다.</p>
  </div>

  <h2><span class="tag">비교</span>무엇이 바뀌고, 무엇이 안 바뀌나</h2>
  <table>
    <thead><tr><th>방안</th><th>가구 위치</th><th>가구 세트</th><th>방 크기·개수</th><th>벽·바닥 색</th><th>사용자 문장 반영</th><th>「정본은 사용자 구조」와 충돌</th><th>비용</th></tr></thead>
    <tbody>
      <tr><td><b>지금</b></td><td class="n">고정</td><td class="n">고정</td><td class="n">고정</td><td class="n">고정</td><td class="n">시설명만</td><td class="y">없음</td><td>—</td></tr>
      <tr><td><b>A</b> 배치 흔들기</td><td class="y">바뀜</td><td class="n">고정</td><td class="n">고정</td><td class="n">고정</td><td class="n">시설명만</td><td class="y">없음</td><td>2파일 · 반나절</td></tr>
      <tr><td><b>B</b> 구성 뽑기 (+A)</td><td class="y">바뀜</td><td class="y">바뀜 (사용자 물건 안에서)</td><td class="n">고정</td><td class="n">고정</td><td class="n">시설명만</td><td class="p">토글 필요 (고정|뽑기)</td><td>3파일 + DB 토글 · 하루</td></tr>
      <tr><td><b>C</b> 모델 변주</td><td class="y">바뀜</td><td class="y">바뀜</td><td class="y">바뀜</td><td class="y">바뀜</td><td class="y">허름/고급/작은/단층…</td><td class="n">있음 — 우선순위 규칙 필요</td><td>툴 인자+프롬프트+의도 선언 · 이틀+</td></tr>
      <tr><td><b>D</b> 사용자 저작</td><td class="n">시설별 고정</td><td class="y">시설별</td><td class="y">시설별</td><td class="y">시설별</td><td class="p">시설명 매칭에 의존</td><td class="y">없음</td><td>코드 0 · 사람 손</td></tr>
    </tbody>
  </table>

  <div class="verdict">
    <h3>추천 — A + B 를 한 번에, C 는 따로 결정</h3>
    <ul class="plain">
      <li><b>A+B</b> 는 코드가 <code>placeConceptTool.ts</code> · <code>interiorConceptCompose.ts</code> · DB 탭 토글 하나로 닫히고, 뭘 놓을지 후보가 여전히 <b>사용자가 정한 물건 안</b>이라 정본 원칙을 안 건드린다. 여관 열 채가 서로 다른 가구 세트·배치로 나온다(위 B 그림 수준 + 위치 변화).</li>
      <li><b>C</b> 는 눈에 띄는 차이가 가장 크지만 「모델이 사용자 구조를 덮어써도 되는가」를 먼저 정해야 한다. A+B 를 쓰면서 그 답을 정하고 나서 얹는 게 순서다.</li>
      <li><b>D</b> 는 지금 바로 쓸 수 있으니, 코드 작업 전이라도 「여관(허름)」「여관(고급)」을 DB 에 만들어 두면 당장 결과가 갈린다.</li>
    </ul>
    <p class="note" style="margin-top:12px">결정할 것 한 가지: <b>A+B 로 갈까, C 까지 한 번에 열까.</b></p>
  </div>

  <h2 style="font-size:18px">부록 — 이 페이지를 만든 방법</h2>
  <p class="note">스크립트 <code>scripts/gen-concept-variety-explainer.mts</code> 가 <code>createBlankProject()</code> 에 여관 구조를 <code>tileset.scratchConceptBundles</code> 로 심고 <code>runTool("place_concept", {query:"여관", …})</code> 을 실제로 호출해 맵을 만든 뒤, 편집기와 같은 쿼터 합성 렌더러(<code>scripts/lib/renderInteriorMapPng.mts</code>)로 PNG 를 찍었다. A 만 알고리즘 출력이 아닌 도식이다(이유는 A 절). 원본 PNG 는 <code>reports/concept-variety/png/</code>.</p>
</div>
</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html, "utf8");
console.log(`\nwrote ${OUT_HTML} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
