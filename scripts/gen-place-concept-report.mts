/**
 * place_concept 이미지 리치 보고서 — 개념 꾸러미로 지은 여관, 전/후, 수정 반영, 칩 집행, 실제 조수 턴.
 *
 * 실행: npx tsx scripts/gen-place-concept-report.mts
 * 산출: reports/place-concept-inn/index.html (+ after/*.png)
 *
 * 그림은 에디터와 같은 쿼터 합성 렌더러(scripts/lib/renderInteriorMapPng.mts)로 찍는다.
 * 「전」 그림은 reports/place-concept-inn/before/*.png (레이아웃 개편 전 코드로 같은 렌더러로 찍어 둔 것).
 * 실제 조수 턴 증거는 test/e2e/_place-concept-inn-evidence.spec.ts 가 남긴 reports/place-concept-inn/e2e/ 를 읽는다.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { RESOURCE_SLICING } from "../src/assets/resourceSlicing.ts";
import { layoutConceptFacility, type ConceptRoomLayout } from "../src/editor/conceptBundleResolve.ts";
import { INTERIOR_ROOM_TILESET_ID } from "../src/editor/interiorRoomPipeline.ts";
import { interiorObjectById, type InteriorObjectDef } from "../src/editor/interiorObjectCatalog.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "../src/project/defaults/scratchInnBundle.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import {
  conceptChipLabel,
  CONCEPT_PLACE_ROLE_LABELS,
  CONCEPT_PLACE_SIZE_LABELS,
  type ConceptBundleRecord,
  type ConceptChipId,
} from "../src/project/types/conceptBundle.ts";
import type { Command, GameEvent, GameMap, Project, TilesetDef } from "../src/project/types.ts";
import { pngToDataUrl, renderInteriorMapPng, writePng, type EventMarker } from "./lib/renderInteriorMapPng.mts";

const SHEET = RESOURCE_SLICING.chipset;
const COLS = SHEET.columns ?? 30;
const CELL = SHEET.cellWidth;
const SHEET_W = SHEET.sheetWidth ?? 480;
const SHEET_H = SHEET.sheetHeight ?? 256;
const CHIPSET_PNG = path.resolve("public/assets/easyrpg-chipset-interior-transparent.png");
const OUT_DIR = path.resolve("reports/place-concept-inn");
const BEFORE_DIR = path.join(OUT_DIR, "before");
const AFTER_DIR = path.join(OUT_DIR, "after");
const E2E_DIR = path.join(OUT_DIR, "e2e");
const OUT_HTML = path.join(OUT_DIR, "index.html");
const sheetDataUrl = `data:image/png;base64,${fs.readFileSync(CHIPSET_PNG).toString("base64")}`;
const SCALE = 3;

const MARKER_COLORS = {
  inn: [120, 140, 255] as const,
  transfer: [80, 200, 255] as const,
  loot: [200, 120, 255] as const,
  text: [255, 210, 80] as const,
  entrance: [255, 255, 255] as const,
};

function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function git(command: string): string {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch {
    return "?";
  }
}

// ── 시공 ──────────────────────────────────────────────────────────────────────

type Built = {
  readonly label: string;
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  readonly bundle: ConceptBundleRecord;
  readonly layout: ConceptRoomLayout;
  readonly warnings: readonly string[];
  readonly summary: string;
  readonly connections: readonly { x: number; y: number; name: string; target: { mapId: string; x: number; y: number } | null }[];
};

function editedBundle(): ConceptBundleRecord {
  const edited = cloneConceptBundle(SCRATCH_INN_BUNDLE);
  edited.id = "inn_edited";
  edited.label = "주막";
  edited.facilities[0] = { ...edited.facilities[0]!, label: "주막" };
  edited.things = edited.things.filter((thing) => thing.objectId !== "piano");
  edited.things.push({ id: "bookshelf", label: "책장", objectId: "bookshelf", placeIds: ["bedroom"], chips: ["block"] });
  return edited;
}

function build(label: string, query: string, bundle: ConceptBundleRecord | null): Built {
  const project: Project = createBlankProject();
  if (bundle) project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [bundle];
  const ctx = { project };
  const result = runTool(ctx, "place_concept", { query, mapId: "map_report", seed: 7 }, { dryRun: false });
  if (!result.ok) throw new Error(`${label} build failed: ${result.summary} ${JSON.stringify(result.issues)}`);
  const data = result.data as { connections: Built["connections"] };
  const live = bundle ?? SCRATCH_INN_BUNDLE;
  return {
    label,
    map: ctx.project.maps.map_report!,
    tileset: ctx.project.tilesets[INTERIOR_ROOM_TILESET_ID]!,
    bundle: live,
    layout: layoutConceptFacility(live, live.facilities[0]!),
    warnings: [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])],
    summary: result.summary,
    connections: data.connections,
  };
}

function commandsOf(event: GameEvent): Command[] {
  return [...event.commands, ...(event.pages ?? []).flatMap((page) => page.commands)];
}

function eventKind(event: GameEvent): keyof typeof MARKER_COLORS {
  const kinds = new Set(commandsOf(event).map((command) => command.kind));
  if (event.pages?.[0]?.name === "입구") return "entrance";
  if (kinds.has("inn")) return "inn";
  if (kinds.has("transfer")) return "transfer";
  if (kinds.has("changeGold")) return "loot";
  return "text";
}

function markersFor(map: GameMap): EventMarker[] {
  return map.events.map((event) => ({ x: event.x, y: event.y, color: MARKER_COLORS[eventKind(event)] }));
}

const ROLE_COLORS: Record<string, readonly [number, number, number]> = {
  entrance: [255, 170, 60],
  walkway: [90, 220, 160],
  room: [110, 170, 255],
};

function renderBuilt(built: Built, file: string, options: { markers?: boolean; boxes?: boolean; diffAgainst?: GameMap } = {}): string {
  const boxes = options.boxes
    ? built.layout.rooms.map((room) => ({ x: room.x, y: room.y, w: room.w, h: room.h, color: ROLE_COLORS[room.role] ?? [255, 255, 255] }))
    : [];
  if (options.diffAgainst && options.diffAgainst.width === built.map.width && options.diffAgainst.height === built.map.height) {
    const other = options.diffAgainst;
    for (let y = 0; y < built.map.height; y += 1) {
      for (let x = 0; x < built.map.width; x += 1) {
        const i = y * built.map.width + x;
        if (built.map.lowerTiles[i] !== other.lowerTiles[i] || built.map.upperTiles[i] !== other.upperTiles[i]) {
          boxes.push({ x, y, w: 1, h: 1, color: [255, 80, 200] });
        }
      }
    }
  }
  const png = renderInteriorMapPng(built.map, built.tileset, {
    scale: SCALE,
    markers: options.markers ? markersFor(built.map) : [],
    boxes,
  });
  writePng(png, path.join(AFTER_DIR, file));
  return pngToDataUrl(png);
}

function fileDataUrl(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

// ── 스프라이트(물건 표) ───────────────────────────────────────────────────────

function chipStyle(tile: number, scale: number): string {
  const col = tile % COLS;
  const row = Math.floor(tile / COLS);
  const size = CELL * scale;
  return `width:${size}px;height:${size}px;background-size:${SHEET_W * scale}px ${SHEET_H * scale}px;background-position:-${col * size}px -${row * size}px`;
}

function tileSpan(tile: number, scale: number): string {
  if (tile < 0) return "";
  return `<span class="t" style="${chipStyle(tile, scale)}"></span>`;
}

function objectSprite(object: InteriorObjectDef, scale: number): string {
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
  return `<div class="sprite" style="grid-template-columns:repeat(${object.width},${size}px)">${cells.join("")}</div>`;
}

function objectInRoom(map: GameMap, object: InteriorObjectDef, box: { x: number; y: number; w: number; h: number }): boolean {
  for (let oy = box.y - 2; oy < box.y + box.h; oy += 1) {
    for (let ox = box.x; ox <= box.x + box.w - object.width; ox += 1) {
      const hit = object.cells.every((cell) => {
        const x = ox + cell.dx;
        const y = oy + cell.dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
        const i = y * map.width + x;
        return map.lowerTiles[i] === cell.tile || map.upperTiles[i] === cell.tile;
      });
      if (hit) return true;
    }
  }
  return false;
}

function thingsTable(built: Built): string {
  const rows: string[] = [];
  for (const place of built.bundle.places) {
    const rooms = built.layout.rooms.filter((room) => room.placeId === place.id);
    const things = built.bundle.things.filter((thing) => thing.placeIds.includes(place.id));
    rows.push(`<tr class="place"><th colspan="5">${esc(place.label)} · ${esc(CONCEPT_PLACE_ROLE_LABELS[place.role ?? "room"])} · ${esc(CONCEPT_PLACE_SIZE_LABELS[place.size ?? "m"])}${(place.count ?? 1) > 1 ? ` ×${place.count}` : ""}</th></tr>`);
    for (const thing of things) {
      const object = interiorObjectById(thing.objectId);
      const placedIn = object ? rooms.filter((room) => objectInRoom(built.map, object, room)).length : 0;
      const status = placedIn === rooms.length ? "yes" : placedIn === 0 ? "no" : "part";
      rows.push(`<tr class="${status}">
        <td>${object ? objectSprite(object, 2) : "?"}</td>
        <td>${esc(thing.label)}${thing.required ? ' <span class="pill req">필수</span>' : ""}</td>
        <td>${thing.chips.map((chip) => `<span class="pill ${chip}">${esc(conceptChipLabel(chip))}</span>`).join(" ")}</td>
        <td>${esc(eventLabelFor(built.map, thing.id))}</td>
        <td>${placedIn}/${rooms.length}</td>
      </tr>`);
    }
  }
  return `<table class="things"><thead><tr><th>그림</th><th>물건</th><th>칩</th><th>이벤트</th><th>놓인 방</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function eventLabelFor(map: GameMap, thingId: string): string {
  const events = map.events.filter((event) => event.id.includes(`_${thingId}_`));
  if (events.length === 0) return "—";
  const kind = eventKind(events[0]!);
  const label = kind === "inn" ? "여관(inn)" : kind === "transfer" ? "맵 연결(transfer)" : kind === "loot" ? "1회 노획" : "조사 문장";
  return `${label} ×${events.length}`;
}

function layoutTable(layout: ConceptRoomLayout): string {
  const rows = layout.rooms.map((room) => `<tr><td>${esc(room.id)}</td><td>${esc(room.placeId)}</td><td><span class="role ${room.role}">${esc(CONCEPT_PLACE_ROLE_LABELS[room.role])}</span></td><td>(${room.x},${room.y}) ${room.w}×${room.h}</td></tr>`);
  return `<table class="plan"><thead><tr><th>방</th><th>장소</th><th>역할</th><th>바닥</th></tr></thead><tbody>${rows.join("")}</tbody></table>
  <p class="dim">맵 ${layout.width}×${layout.height} · 정문 (${layout.door.x},${layout.door.y}) · 내부 문 ${layout.innerDoors.map((door) => `(${door.x},${door.y})`).join(" ")}</p>`;
}

function eventsTable(map: GameMap): string {
  const rows = map.events.map((event) => {
    const kind = eventKind(event);
    const commands = commandsOf(event).map((command) => command.kind);
    return `<tr><td><span class="dot" style="background:rgb(${MARKER_COLORS[kind].join(",")})"></span>${esc(event.pages?.[0]?.name ?? event.id)}</td><td>(${event.x},${event.y})</td><td>${esc(kind)}</td><td><code>${esc([...new Set(commands)].join(", "))}</code></td></tr>`;
  });
  return `<table class="events"><thead><tr><th>이벤트</th><th>자리</th><th>종류</th><th>명령</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function check(ok: boolean, text: string): string {
  return `<li class="${ok ? "ok" : "bad"}"><span class="mark">${ok ? "✓" : "✗"}</span>${esc(text)}</li>`;
}

// ── 본문 ──────────────────────────────────────────────────────────────────────

fs.mkdirSync(AFTER_DIR, { recursive: true });
const inn = build("초안 여관", "여관", null);
const tavern = build("고친 주막", "주막", editedBundle());

const innPng = renderBuilt(inn, "default.png", { markers: true });
const innBoxesPng = renderBuilt(inn, "default-plan.png", { boxes: true });
const tavernPng = renderBuilt(tavern, "edited.png", { markers: true });
const tavernDiffPng = renderBuilt(tavern, "edited-diff.png", { diffAgainst: inn.map });
const beforeInn = fileDataUrl(path.join(BEFORE_DIR, "default.png"));
const beforeTavern = fileDataUrl(path.join(BEFORE_DIR, "edited.png"));
const oldVerdict = fileDataUrl(path.join(OUT_DIR, "verdict.png"));

const innUnplaced = inn.warnings.filter((line) => line.includes("자리 없음"));
const tavernUnplaced = tavern.warnings.filter((line) => line.includes("자리 없음"));
const innEvents = inn.map.events.filter((event) => event.id.startsWith("ev_concept_"));
const innKinds = new Set(innEvents.map(eventKind));
const bookshelf = interiorObjectById("bookshelf")!;
const bedroomRooms = tavern.layout.rooms.filter((room) => room.placeId === "bedroom");
const bookshelfRooms = bedroomRooms.filter((room) => objectInRoom(tavern.map, bookshelf, room)).length;
const pianoTiles = new Set(interiorObjectById("piano")!.cells.map((cell) => cell.tile));
const tavernHasPiano = tavern.map.upperTiles.some((tile) => pianoTiles.has(tile));
const roles = new Set(inn.layout.rooms.map((room) => room.role));

type Receipt = {
  provider?: string;
  innTurn?: { elapsedMs: number; tools: { name: string; summary: string }[]; assistantText?: string; newMaps: string[] };
  tavernTurn?: { elapsedMs: number; tools: { name: string; summary: string }[]; assistantText?: string; newMaps: string[] };
  innMap?: { id: string; name: string; size: string; events: string[] };
  tavernMap?: { id: string; name: string; size: string; events: string[] };
  tavernHasPianoEvent?: boolean;
  runtimeInnSceneShown?: boolean;
  finishedAt?: string;
};
const receiptPath = path.join(E2E_DIR, "receipt.json");
const receipt: Receipt | null = fs.existsSync(receiptPath) ? (JSON.parse(fs.readFileSync(receiptPath, "utf8")) as Receipt) : null;
const e2eShots = [
  ["01-db-concept-tab.png", "데이터베이스 「임시 → 개념 꾸러미」 — 조수가 읽는 나무. 여관 초안 그대로."],
  ["02-chat-after-inn.png", "「여관 지어줘」 턴이 끝난 에디터. 조수 로그에 place_concept 호출과 결과가 남는다."],
  ["03-editor-inn-canvas.png", "조수가 만든 여관 맵 — 에디터 캔버스(WebGL) 실제 렌더."],
  ["04-db-edited.png", "사람이 고친 나무 — 시설명 주막, 피아노 삭제, 객실에 책장."],
  ["05-editor-tavern-canvas.png", "「주막을 새 맵으로 지어줘」 — 고친 나무로 지은 맵. 책장이 객실에, 피아노는 없다."],
  ["06-runtime-inn-scene.png", "테스트 플레이 — 침대 앞에서 조사하면 여관 창(inn)이 뜬다. sleep 칩이 작동한다."],
].map(([file, caption]) => ({ file: file!, caption: caption!, url: fileDataUrl(path.join(E2E_DIR, file!)) }));

const checks = [
  check(roles.has("entrance") && roles.has("walkway") && roles.has("room"), "도면이 홀(정문)·복도·방 3단으로 선다"),
  check(inn.layout.rooms.filter((room) => room.placeId === "bedroom").length === 2, "객실이 2개(count) 서고 각각 침대가 있다"),
  check(!inn.warnings.some((line) => line.startsWith("plan:") || line.startsWith("walkability:")), "문에서 모든 방에 닿는다 (plan·walkability 경고 없음)"),
  check(innUnplaced.length === 0, `초안 여관의 물건이 전부 자리를 얻는다 (자리 없음 ${innUnplaced.length}건)`),
  check(innKinds.has("inn") && innKinds.has("transfer") && innKinds.has("loot") && innKinds.has("text"), `칩이 이벤트가 된다 — 여관(inn)·맵 연결·1회 노획·조사 (${innEvents.length}개)`),
  check(!tavernHasPiano && bookshelfRooms === bedroomRooms.length, `수정이 맵에 보인다 — 피아노 ${tavernHasPiano ? "남음" : "없음"}, 책장 ${bookshelfRooms}/${bedroomRooms.length} 객실`),
  check(Boolean(receipt?.innTurn?.tools.some((tool) => tool.name === "place_concept")), receipt ? "실제 조수 턴이 place_concept 를 호출해 여관을 만들었다" : "실제 조수 턴 증거 없음 (e2e 미실행)"),
  check(receipt?.runtimeInnSceneShown === true, receipt ? "테스트 플레이에서 침대 앞 조사에 여관 창이 뜬다" : "런타임 증거 없음 (e2e 미실행)"),
];

const sha = git("git rev-parse --short HEAD");
const branch = git("git rev-parse --abbrev-ref HEAD");
const dirty = git("git status --porcelain").length > 0 ? " + 미커밋 변경" : "";

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>개념 꾸러미로 지은 여관 — 조수가 짓고 사람이 고친다</title>
<style>
  :root {
    --bg: #14110e; --ink: #f4ece0; --dim: #c4b6a4; --faint: #8a7d6d;
    --line: #3a3128; --card: #1d1914; --accent: #e8b86d; --ok: #7dcaa0; --bad: #e07a7a;
    --pass: #7dcaa0; --block: #e07a7a; --event: #e8c35a; --transfer: #7eb6e8;
    --loot: #c59bde; --sleep: #9aa6e8; --floor: #c4a574; --wall: #b9a089;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 16px/1.6 "Iowan Old Style", "Apple SD Gothic Neo", "Noto Serif KR", serif; background: radial-gradient(900px 420px at 10% -10%, #3a2a18 0%, transparent 55%), var(--bg); color: var(--ink); }
  .wrap { width: min(1320px, calc(100% - 40px)); margin: 0 auto; padding: 48px 0 80px; }
  .kicker { font: 700 12px/1 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
  h1 { font-size: 38px; letter-spacing: -0.03em; margin: 10px 0 10px; }
  h2 { font-size: 24px; margin: 44px 0 12px; letter-spacing: -0.01em; }
  h3 { font-size: 17px; margin: 0 0 10px; }
  .meta { color: var(--faint); font: 12px/1.6 ui-monospace, monospace; margin-bottom: 18px; }
  .lede { color: var(--dim); max-width: 78ch; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
  .checks { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin-top: 8px; }
  .checks li { display: flex; gap: 10px; align-items: baseline; }
  .checks .mark { font-weight: 700; width: 1.2em; }
  .checks li.ok .mark { color: var(--ok); } .checks li.bad .mark { color: var(--bad); }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; }
  figure { background: var(--card); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
  figure img { display: block; width: 100%; height: auto; image-rendering: pixelated; image-rendering: crisp-edges; background: #0c0a08; }
  figcaption { padding: 12px 14px; color: var(--dim); font-size: 13.5px; border-top: 1px solid var(--line); }
  figcaption b { color: var(--ink); }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 16px; color: var(--dim); font-size: 13px; margin: 10px 0 0; }
  .dot { display: inline-block; width: 10px; height: 10px; border: 1px solid #fff; margin-right: 6px; vertical-align: -1px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid var(--line); vertical-align: middle; font-size: 13.5px; }
  th { color: var(--faint); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
  tr.place th { color: var(--accent); text-transform: none; letter-spacing: 0; font-size: 14px; padding-top: 14px; }
  tr.no td { color: var(--bad); } tr.part td { color: #e8c35a; } tr.yes td { color: #cfe8d4; }
  .pill { display: inline-block; font: 700 11px/1.6 ui-monospace, monospace; padding: 0 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--dim); }
  .pill.req { background: #e8b86d22; border-color: #e8b86d66; color: var(--accent); }
  .pill.pass { color: var(--pass); } .pill.block { color: var(--block); } .pill.event { color: var(--event); }
  .pill.transfer { color: var(--transfer); } .pill.loot { color: var(--loot); } .pill.sleep { color: var(--sleep); }
  .pill.floor { color: var(--floor); } .pill.wall { color: var(--wall); }
  .role { font: 700 11px/1.6 ui-monospace, monospace; padding: 0 8px; border-radius: 999px; border: 1px solid; }
  .role.entrance { color: rgb(255,170,60); } .role.walkway { color: rgb(90,220,160); } .role.room { color: rgb(110,170,255); }
  .t { display: block; background-image: url("${sheetDataUrl}"); background-repeat: no-repeat; image-rendering: pixelated; position: absolute; inset: 0; }
  .sprite { display: grid; gap: 0; } .cell { position: relative; display: block; }
  .dim { color: var(--faint); font-size: 13px; margin-top: 8px; }
  .warn { color: #e8c35a; font-family: ui-monospace, monospace; font-size: 12.5px; white-space: pre-wrap; }
  .quote { border-left: 3px solid var(--line); padding: 8px 14px; color: var(--dim); font-size: 14px; white-space: pre-wrap; }
  code { font-family: ui-monospace, monospace; font-size: 12.5px; }
  pre { background: #0c0a08; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; overflow: auto; font-size: 12.5px; }
  .note { border-left: 3px solid var(--accent); background: #e8b86d12; padding: 12px 16px; border-radius: 0 10px 10px 0; color: #f0d7a8; margin: 14px 0; }
</style>
</head>
<body>
<div class="wrap">
  <p class="kicker">place_concept · live tileset.scratchConceptBundles · ${esc(branch)}@${esc(sha)}${esc(dirty)}</p>
  <h1>개념 꾸러미로 지은 여관 — 조수가 짓고, 사람이 고친다</h1>
  <p class="meta">생성 ${new Date().toISOString()} · 작성 Claude(에이전트) · 설계 docs/superpowers/specs/2026-09-02-concept-facility-construction-design.md</p>
  <p class="lede">
    에디터 내장 조수에게 「여관 지어줘」라고 치면, 조수는 데이터베이스 「임시 → 개념 꾸러미」의 <b>라이브 나무</b>(시설 → 장소 → 물건 → 칩)를 읽어
    실내 맵을 짓는다. 이 보고서는 그 결과가 <b>여관으로 보이고 여관으로 작동하는지</b>, 그리고 사람이 나무를 고치면 맵이 <b>눈에 띄게 달라지는지</b>를 그림으로 판정한다.
    모든 맵 그림은 에디터와 같은 쿼터 오토타일 합성으로 그렸다.
  </p>

  <section class="card">
    <h3>판정</h3>
    <ul class="checks">${checks.join("")}</ul>
  </section>

  <h2>1. 전과 후 — 같은 나무, 같은 시드</h2>
  <p class="lede">왼쪽은 도면·구성 개편 전(2026-09-02 HEAD a4bd4fd8 + 배관), 오른쪽은 개편 후다. 색 표식은 칩이 만든 이벤트 자리다.</p>
  <div class="grid2">
    <figure>${beforeInn ? `<img src="${beforeInn}" alt="개편 전 여관">` : "<p class='dim'>before/default.png 없음</p>"}<figcaption><b>전 · 초안 여관</b> — 9×5 상자 두 개와 3칸 홀. 카운터가 동쪽 벽을 뚫고, 창문·그림이 바닥 칸에, 계단이 홀 한가운데, 시계가 러그 위에 놓였다. 건물 밖과 천장이 같은 검정이라 「벽 위에 천장이 없다」고 읽혔다.</figcaption></figure>
    <figure><img src="${innPng}" alt="개편 후 여관"><figcaption><b>후 · 초안 여관</b> — 객실 ×2 → 복도 → 홀(정문) 3단. 벽걸이는 벽면에, 계단은 복도 끝 벽에, 물건 사이 간격과 문 앞 통로가 비어 있다. 건물 밖은 공허라 천장 테두리가 윤곽으로 드러난다. ${esc(inn.summary)}</figcaption></figure>
  </div>
  <p class="legend">
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.inn.join(",")})"></span>sleep → 여관(inn)</span>
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.transfer.join(",")})"></span>transfer → 맵 연결</span>
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.loot.join(",")})"></span>loot → 1회 노획</span>
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.text.join(",")})"></span>event → 조사 문장</span>
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.entrance.join(",")})"></span>정문(입구 이벤트)</span>
  </p>

  <h2>2. 수정이 눈에 보이는가</h2>
  <p class="lede">사용자가 나무에서 <b>시설명 여관 → 주막</b>, <b>식당의 피아노 삭제</b>, <b>침실에 책장 추가</b>를 했다. 오른쬭 그림의 자홍 테두리는 초안 여관과 타일이 다른 칸이다.</p>
  <div class="grid3">
    <figure>${beforeTavern ? `<img src="${beforeTavern}" alt="개편 전 주막">` : ""}<figcaption><b>전 · 고친 주막</b> — 초안과 거의 같은 그림. 책장이 침대 옆 바닥에 겨우 들어갔다.</figcaption></figure>
    <figure><img src="${tavernPng}" alt="개편 후 주막"><figcaption><b>후 · 고친 주막</b> — 두 객실 모두 동쪽에 책장, 홀에는 피아노가 없고 카운터가 서쪽으로 옮겨 앉았다. ${esc(tavern.summary)}</figcaption></figure>
    <figure><img src="${tavernDiffPng}" alt="차이 표시"><figcaption><b>차이</b> — 초안 여관 대비 달라진 칸(자홍). 객실 두 곳의 책장·시계·캐비닛 자리, 홀 북벽 전체가 바뀌었다.</figcaption></figure>
  </div>
  ${tavernUnplaced.length > 0 ? `<div class="note">고친 나무에서 자리를 못 얻은 물건(숨기지 않고 경고로 남긴다):<br><span class="warn">${esc(tavernUnplaced.join("\n"))}</span><br>객실(보통 7×4)에 책장 3×3 이 들어가면 북벽에 시계·캐비닛 자리가 모자란다. 사용자가 크기를 「크게」로 바꾸면 들어간다.</div>` : ""}

  <h2>3. 도면 — 장소 역할이 방을 앉힌다</h2>
  <div class="grid2">
    <figure><img src="${innBoxesPng}" alt="도면"><figcaption><b>방 상자</b> — <span class="role entrance">홀(정문)</span> <span class="role walkway">복도</span> <span class="role room">방</span>. 세로 인접은 3행 파티션(트림+벽면 2행), 가로 인접은 1열. 파이프라인 벽 문법의 정본 「여관 1층」 데모와 같다.</figcaption></figure>
    <div class="card">
      <h3>초안 여관 도면</h3>
      ${layoutTable(inn.layout)}
      <p class="dim">장소 레코드에 새로 붙은 필드: <code>role</code>(entrance·walkway·room) · <code>size</code>(s 5×3 · m 7×4 · l 9×5) · <code>count</code>(1..4). 옛 나무는 라벨(복도·통로)로 복도를 알아보고 나머지는 방으로 읽는다.</p>
    </div>
  </div>

  <h2>4. 칩이 하는 일</h2>
  <div class="grid2">
    <div class="card">
      <h3>초안 여관 이벤트 (${inn.map.events.length}개)</h3>
      ${eventsTable(inn.map)}
      <p class="dim">계단의 transfer 대상은 아직 없어 같은 맵 정문으로 두고 <code>data.connections</code> 에 미연결로 보고한다 — 조수가 <code>create_transfer_pair</code> 로 잇는다.</p>
      ${inn.warnings.length > 0 ? `<p class="warn">${esc(inn.warnings.join("\n"))}</p>` : ""}
    </div>
    <div class="card">
      <h3>칩 → 집행</h3>
      <table class="events"><tbody>
        <tr><td><span class="pill sleep">수면</span></td><td>침대 앵커에 action 이벤트 · <code>inn</code> 20G · HP/MP 회복</td></tr>
        <tr><td><span class="pill transfer">맵 연결</span></td><td>계단 앵커에 action 이벤트 · <code>transfer</code> · 대상 없으면 미연결 보고</td></tr>
        <tr><td><span class="pill loot">노획</span></td><td>selfSwitch A 로 1회 금화 · 이후 「비어 있다」</td></tr>
        <tr><td><span class="pill event">이벤트 가능</span></td><td>조사 문장 1줄(물건별)</td></tr>
        <tr><td><span class="pill block">통행 불가</span> <span class="pill pass">통행 가능</span></td><td>타일셋 통행표 + 걷기 BFS(가구=장애물). 계단·러그는 passable</td></tr>
        <tr><td><span class="pill wall">벽</span> <span class="pill floor">바닥</span></td><td>벽걸이는 벽면 윗줄에, 러그는 침대 발치·통로 위에 깔린다</td></tr>
      </tbody></table>
    </div>
  </div>

  <h2>5. 나무 → 시공 대조</h2>
  <div class="grid2">
    <div class="card"><h3>초안 여관</h3>${thingsTable(inn)}</div>
    <div class="card"><h3>고친 주막</h3>${thingsTable(tavern)}</div>
  </div>

  <h2>6. 실제 조수 턴 — 에디터에서</h2>
  ${receipt ? `
  <p class="lede">제공자 ${esc(receipt.provider ?? "?")} · 「${esc(INSTRUCTION_INN_LABEL())}」 ${receipt.innTurn ? `${Math.round(receipt.innTurn.elapsedMs / 1000)}초 · 툴 ${receipt.innTurn.tools.map((tool) => tool.name).join(" → ")}` : ""}
  ${receipt.tavernTurn ? ` · 「주막 만들어줘」 ${Math.round(receipt.tavernTurn.elapsedMs / 1000)}초 · 툴 ${receipt.tavernTurn.tools.map((tool) => tool.name).join(" → ")}` : ""}</p>
  <div class="grid2">
    ${e2eShots.filter((shot) => shot.url).map((shot) => `<figure><img src="${shot.url}" alt="${esc(shot.file)}"><figcaption><b>${esc(shot.file)}</b> — ${esc(shot.caption)}</figcaption></figure>`).join("")}
  </div>
  <div class="grid2" style="margin-top:18px">
    <div class="card"><h3>조수의 마지막 말 — 여관</h3><div class="quote">${esc(receipt.innTurn?.assistantText ?? "")}</div><p class="dim">만든 맵 ${esc(receipt.innMap?.id ?? "")} ${esc(receipt.innMap?.size ?? "")} · 이벤트 ${receipt.innMap?.events.length ?? 0}</p></div>
    <div class="card"><h3>조수의 마지막 말 — 주막</h3><div class="quote">${esc(receipt.tavernTurn?.assistantText ?? "")}</div><p class="dim">만든 맵 ${esc(receipt.tavernMap?.id ?? "")} ${esc(receipt.tavernMap?.size ?? "")} · 피아노 이벤트 ${receipt.tavernHasPianoEvent ? "있음" : "없음"}</p></div>
  </div>` : `<div class="note">실제 조수 턴 증거가 없다. <code>RPG_ZZU_OH_MY_PI_AUTH_PATH=~/.rpg-zzu/oh-my-pi-auth.json DEV_SERVER_PORT=9877 npx playwright test test/e2e/_place-concept-inn-evidence.spec.ts --project=chromium</code> 를 돌리면 이 절이 채워진다.</div>`}

  <h2>7. 남은 것</h2>
  <div class="card">
    <ul style="padding-left:20px; color: var(--dim); line-height: 1.8">
      <li>계단은 <b>맵 연결 지점</b>으로만 선다. 위층 맵이 없으므로 대상은 같은 맵 정문이고 미연결로 보고된다. 2층을 나무에 표현하려면 장소에 층(floor) 필드가 필요하다 — 이번 범위 밖.</li>
      <li>정문의 나가기(exterior) 연결은 기존 실내 파이프라인 관례대로 자리표시자다. 영역 작업·조수의 <code>create_transfer_pair</code> 가 잇는다.</li>
      <li>천장·공허 처리는 개념 시설 경로에만 적용했다(데모 방 패리티 픽스처 불변). 다른 실내 시공에도 적용할지는 별도 결정.</li>
      <li>객실(보통)에 큰 물건을 더 넣으면 자리 없음 경고가 난다 — 크기를 「크게」로 바꾸는 것이 사용자의 조작이다.</li>
      <li><b>실측 1차(수정 전):</b> 「주막 만들어줘」는 이미 여관 맵이 있으면 모델이 「기존 맵을 주막으로 단장」으로 읽어 <code>furnish_interior_space</code> 만 돌렸다. 새 맵을 원하면 문장에 「새 맵으로」를 둔다(이 보고서의 2턴 지시문).</li>
      <li><b>고친 결함:</b> 두 턴 사이에 데이터베이스를 고치면 조수 세션이 옛 나무를 읽었다(<code>place_concept("주막")</code> 「찾지 못했다」). 이제 패널이 새 턴 직전, 승인 대기 제안이 없으면 세션 기준을 저장소로 맞추고 시스템 프롬프트를 다시 짠다(<code>AssistantSession.syncBaselineFromStoreIfClean</code>).</li>
      <li><b>남은 결함(조수 코어):</b> 모델이 만든 WorkPlan 항목의 <code>complete_work_item</code> 이 직전 <code>place_concept</code> 성공을 「기록 없음」으로 거부해 같은 맵을 한 번 더 시공했다(두 실측 모두). 볼륨 계약 기계가 성공 기록을 항목 단위로 비우는 경계 문제로 보인다 — 이번 범위 밖, 감사 로그에 남겼다.</li>
      <li><b>조수의 덤:</b> 「여관 지어줘」 한 문장에 조수는 시작 맵에 흙길·가로수를 깔고 여관 정문을 시작 맵과 잇고(<code>create_transfer_pair</code>) 여관 주인 상점 NPC 를 두었다. 1차 실측에서는 마을(<code>author_village</code>)과 NPC 15명까지 지었다 — 메모리의 「볼륨 계약 폭주」 그 현상이다.</li>
      <li>예전 보고서의 그림(원시 셀 렌더)은 천장·벽을 풀밭으로 잘못 그렸다. ${oldVerdict ? "아래가 그 그림이다." : ""}</li>
    </ul>
    ${oldVerdict ? `<figure style="max-width:480px; margin-top:14px"><img src="${oldVerdict}" alt="예전 verdict"><figcaption>예전 verdict.png — 렌더러 결함으로 벽·천장이 풀밭 조각으로 찍힌 그림. 판정에 쓰면 안 된다.</figcaption></figure>` : ""}
  </div>

  <h2>재현</h2>
  <pre>npm run typecheck:app
npx vitest run test/placeConceptTool.test.ts test/scratchConceptTab.test.ts test/placeConceptRender.test.ts test/placeConceptAssistant.test.ts test/intentClarify.test.ts
npx tsx scripts/gen-place-concept-report.mts
RPG_ZZU_OH_MY_PI_AUTH_PATH=~/.rpg-zzu/oh-my-pi-auth.json DEV_SERVER_PORT=9877 npx playwright test test/e2e/_place-concept-inn-evidence.spec.ts --project=chromium</pre>
</div>
</body>
</html>
`;

function INSTRUCTION_INN_LABEL(): string {
  return "여관 지어줘";
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_HTML, html);
console.log(OUT_HTML);
console.log(`checks: ${checks.filter((line) => line.includes('class="ok"')).length}/${checks.length} ok`);
