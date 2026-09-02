/**
 * 개념 꾸러미 시설 갤러리 보고서 — 초안 아홉 종(여관·민가·상점·술집·서재·대장간·교회·창고·길드)을 place_concept 으로 짓고
 * 에디터와 같은 쿼터 합성 렌더러로 찍어 한 장에 늘어놓는다. 도면·재질·물건 착석·칩 이벤트를 시설마다 표로 붙인다.
 *
 * 실행: npx tsx scripts/gen-concept-facility-gallery.mts
 * 산출: reports/concept-facilities/index.html (+ png/*.png)
 *
 * 여관 단독 보고서(scripts/gen-place-concept-report.mts)와 별개다 — 그쪽은 전/후·실제 조수 턴 증거를 다룬다.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { RESOURCE_SLICING } from "../src/assets/resourceSlicing.ts";
import {
  ensureConceptBundles,
  conceptFacilityLevels,
  CONCEPT_FLOOR_TILES,
  conceptFacilityWall,
  conceptPlaceFloor,
  layoutConceptFacility,
  type ConceptRoomLayout,
} from "../src/editor/conceptBundleResolve.ts";
import { INTERIOR_ROOM_TILESET_ID } from "../src/editor/interiorRoomPipeline.ts";
import { interiorObjectById, type InteriorObjectDef } from "../src/editor/interiorObjectCatalog.ts";
import { PLACE_CONCEPT_TOOL } from "../src/editor/tools/placeConceptTool.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { capabilityEscalatedToolNames } from "../src/ai/capabilityEscalation.ts";
import { buildSystemPrompt } from "../src/ai/contextBuilder.ts";
import { CONCEPT_FACILITY_TEMPLATES } from "../src/project/defaults/conceptFacilityTemplates.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "../src/project/defaults/scratchInnBundle.ts";
import {
  CONCEPT_CHIP_LABELS,
  CONCEPT_FLOOR_MATERIAL_LABELS,
  CONCEPT_PLACE_ROLE_LABELS,
  CONCEPT_PLACE_SIZE_LABELS,
  CONCEPT_WALL_MATERIAL_LABELS,
  type ConceptBundleRecord,
} from "../src/project/types/conceptBundle.ts";
import type { Command, GameEvent, GameMap, Project, TilesetDef } from "../src/project/types.ts";
import { pngToDataUrl, renderInteriorMapPng, writePng, type EventMarker } from "./lib/renderInteriorMapPng.mts";

const SHEET = RESOURCE_SLICING.chipset;
const COLS = SHEET.columns ?? 30;
const CELL = SHEET.cellWidth;
const SHEET_W = SHEET.sheetWidth ?? 480;
const SHEET_H = SHEET.sheetHeight ?? 256;
const CHIPSET_PNG = path.resolve("public/assets/easyrpg-chipset-interior-transparent.png");
const OUT_DIR = path.resolve("reports/concept-facilities");
const PNG_DIR = path.join(OUT_DIR, "png");
const OUT_HTML = path.join(OUT_DIR, "index.html");
/** 실제 에디터 증거 — test/e2e/_concept-facility-gallery.spec.ts 가 남긴 사진과 영수증(SHOT_DIR 에서 옮겨 둔다). */
const E2E_DIR = path.join(OUT_DIR, "e2e");
const SCALE = 3;

const MARKER_COLORS = {
  inn: [90, 140, 255],
  transfer: [80, 220, 255],
  loot: [200, 120, 255],
  text: [255, 220, 90],
  entrance: [255, 120, 60],
} as const satisfies Record<string, readonly [number, number, number]>;

const ROLE_COLORS: Record<string, readonly [number, number, number]> = {
  entrance: [255, 170, 60],
  walkway: [90, 220, 160],
  room: [110, 170, 255],
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

type Built = {
  readonly bundle: ConceptBundleRecord;
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  readonly layout: ConceptRoomLayout;
  readonly warnings: readonly string[];
  readonly summary: string;
  readonly rooms: readonly { roomId: string; placeId: string; role: string; x: number; y: number; w: number; h: number; floorTile?: number }[];
  readonly wallMaterial: string;
  readonly connections: readonly { thingId: string; label: string; linked: boolean }[];
};

function build(bundle: ConceptBundleRecord): Built {
  const project: Project = createBlankProject();
  const ctx = { project };
  const mapId = `map_${bundle.id}`;
  const result = runTool(ctx, "place_concept", { query: bundle.facilities[0]!.label, mapId, seed: 7 }, { dryRun: false });
  if (!result.ok) throw new Error(`${bundle.label} build failed: ${result.summary} ${JSON.stringify(result.issues)}`);
  const data = result.data as Pick<Built, "rooms" | "wallMaterial" | "connections">;
  return {
    bundle,
    map: ctx.project.maps[mapId]!,
    tileset: ctx.project.tilesets[INTERIOR_ROOM_TILESET_ID]!,
    layout: layoutConceptFacility(bundle, bundle.facilities[0]!),
    warnings: [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])],
    summary: result.summary,
    rooms: data.rooms,
    wallMaterial: data.wallMaterial,
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

function renderBuilt(built: Built, file: string, options: { markers?: boolean; boxes?: boolean } = {}): string {
  const boxes = options.boxes
    ? built.layout.rooms.map((room) => ({ x: room.x, y: room.y, w: room.w, h: room.h, color: ROLE_COLORS[room.role] ?? [255, 255, 255] }))
    : [];
  const png = renderInteriorMapPng(built.map, built.tileset, {
    scale: SCALE,
    markers: options.markers ? markersFor(built.map) : [],
    boxes,
  });
  writePng(png, path.join(PNG_DIR, file));
  return pngToDataUrl(png);
}

// ── 스프라이트 ────────────────────────────────────────────────────────────────

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

function eventLabelFor(map: GameMap, thingId: string): string {
  const events = map.events.filter((event) => event.id.includes(`_${thingId}_`));
  if (events.length === 0) return "—";
  const kind = eventKind(events[0]!);
  const label = kind === "inn" ? "여관(inn)" : kind === "transfer" ? "맵 연결" : kind === "loot" ? "1회 노획" : "조사 문장";
  return `${label} ×${events.length}`;
}

function thingsTable(built: Built): string {
  const rows: string[] = [];
  const facility = built.bundle.facilities[0]!;
  for (const placeId of facility.placeIds) {
    const place = built.bundle.places.find((entry) => entry.id === placeId);
    if (!place) continue;
    const rooms = built.layout.rooms.filter((room) => room.placeId === place.id);
    const things = built.bundle.things.filter((thing) => thing.placeIds.includes(place.id));
    const floor = conceptPlaceFloor(place);
    rows.push(`<tr class="place"><th colspan="5">${esc(place.label)} · ${esc(CONCEPT_PLACE_ROLE_LABELS[place.role ?? "room"])} · ${esc(CONCEPT_PLACE_SIZE_LABELS[place.size ?? "m"])}${(place.count ?? 1) > 1 ? ` ×${place.count}` : ""} · ${esc(CONCEPT_FLOOR_MATERIAL_LABELS[floor])}</th></tr>`);
    for (const thing of things) {
      const object = interiorObjectById(thing.objectId);
      const placedIn = object ? rooms.filter((room) => objectInRoom(built.map, object, room)).length : 0;
      const status = placedIn === rooms.length ? "yes" : placedIn === 0 ? "no" : "part";
      rows.push(`<tr class="${status}">
        <td>${object ? objectSprite(object, 2) : "?"}</td>
        <td>${esc(thing.label)}${thing.required ? ' <span class="pill req">필수</span>' : ""}</td>
        <td>${thing.chips.map((chip) => `<span class="pill ${chip}">${esc(CONCEPT_CHIP_LABELS[chip])}</span>`).join(" ")}</td>
        <td>${esc(eventLabelFor(built.map, thing.id))}</td>
        <td>${placedIn}/${rooms.length}</td>
      </tr>`);
    }
  }
  return `<table class="things"><thead><tr><th>그림</th><th>물건</th><th>칩</th><th>이벤트</th><th>놓인 방</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function layoutTable(built: Built): string {
  const rows = built.layout.rooms.map((room) => {
    const material = Object.entries(CONCEPT_FLOOR_TILES).find(([, tile]) => tile === room.floorTile)?.[0] ?? "wood";
    return `<tr><td>${esc(room.id)}</td><td><span class="role ${room.role}">${esc(CONCEPT_PLACE_ROLE_LABELS[room.role])}</span></td><td>(${room.x},${room.y}) ${room.w}×${room.h}</td><td>${esc(CONCEPT_FLOOR_MATERIAL_LABELS[material as keyof typeof CONCEPT_FLOOR_MATERIAL_LABELS] ?? material)}</td></tr>`;
  });
  return `<table class="plan"><thead><tr><th>방</th><th>역할</th><th>바닥 상자</th><th>바닥 재질</th></tr></thead><tbody>${rows.join("")}</tbody></table>
  <p class="dim">맵 ${built.layout.width}×${built.layout.height} · 정문 (${built.layout.door.x},${built.layout.door.y}) · 내부 문 ${built.layout.innerDoors.length}개 · 벽 ${esc(CONCEPT_WALL_MATERIAL_LABELS[conceptFacilityWall(built.bundle.facilities[0]!)])}</p>`;
}

function check(ok: boolean, text: string): string {
  return `<li class="${ok ? "ok" : "bad"}"><span class="mark">${ok ? "✓" : "✗"}</span>${esc(text)}</li>`;
}

function fileDataUrl(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

type E2eReceipt = {
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly built?: readonly { id: string; query: string; mapId: string; name: string; size: string; events: number; rooms?: number; wallMaterial?: string; summary: string }[];
};

// ── 본문 ──────────────────────────────────────────────────────────────────────

fs.mkdirSync(PNG_DIR, { recursive: true });
const sheetDataUrl = `data:image/png;base64,${fs.readFileSync(CHIPSET_PNG).toString("base64")}`;

const builts = CONCEPT_FACILITY_TEMPLATES.map((bundle) => build(bundle));
const pictures = builts.map((built) => ({
  built,
  png: renderBuilt(built, `${built.bundle.id}.png`, { markers: true }),
  plan: renderBuilt(built, `${built.bundle.id}-plan.png`, { boxes: true }),
}));

const unplacedTotal = builts.reduce((sum, built) => sum + built.warnings.filter((line) => line.includes("자리 없음")).length, 0);
const planWarnings = builts.reduce((sum, built) => sum + built.warnings.filter((line) => line.startsWith("plan:") || line.startsWith("walkability:")).length, 0);
const requiredMissing = builts.flatMap((built) => built.bundle.things
  .filter((thing) => thing.required)
  .filter((thing) => {
    const object = interiorObjectById(thing.objectId);
    if (!object) return true;
    return !built.layout.rooms.some((room) => thing.placeIds.includes(room.placeId) && objectInRoom(built.map, object, room));
  })
  .map((thing) => `${built.bundle.label}/${thing.label}`));
const shapes = new Set(builts.map((built) => `${built.layout.rooms.length}:${built.layout.width}x${built.layout.height}`));
const walls = new Set(builts.map((built) => built.wallMaterial));
const floors = new Set(builts.flatMap((built) => built.rooms.map((room) => room.floorTile ?? 72)));
const escalation = CONCEPT_FACILITY_TEMPLATES.map((bundle) => bundle.facilities[0]!.label)
  .map((label) => ({ label, ok: capabilityEscalatedToolNames(`${label} 지어줘`, new Set()).includes("place_concept") }));
// 프롬프트 절은 두 단계다(2026-09-03): 초안 그대로면 시설명 한 줄, 사용자가 고친 나무(칩셋에 배열이 있음)면 시설별 줄.
const blankProject = createBlankProject();
const blankPrompt = buildSystemPrompt(blankProject, { currentMapId: blankProject.startMapId, budgetChars: 50_000 });
const compactSection = blankPrompt.slice(blankPrompt.indexOf("## 개념 꾸러미"), blankPrompt.indexOf("## 타일셋 실내 문법"));
const editedProject = createBlankProject();
ensureConceptBundles(editedProject, INTERIOR_ROOM_TILESET_ID);
const prompt = buildSystemPrompt(editedProject, { currentMapId: editedProject.startMapId, budgetChars: 50_000 });
const promptLists = CONCEPT_FACILITY_TEMPLATES.every((bundle) => prompt.includes(`query="${bundle.facilities[0]!.label}"`))
  && CONCEPT_FACILITY_TEMPLATES.every((bundle) => compactSection.includes(bundle.facilities[0]!.label))
  && compactSection.length < 600;
const conceptSection = prompt.slice(prompt.indexOf("## 개념 꾸러미"), prompt.indexOf("## 타일셋 실내 문법"));

// 층 — 여관을 두 층으로 갈라 짓는 변형. 홀은 1층, 복도·침실은 2층. 계단은 홀과 복도 양쪽.
function twoStoryInn(): ConceptBundleRecord {
  const bundle = cloneConceptBundle(SCRATCH_INN_BUNDLE);
  bundle.id = "inn2f";
  bundle.label = "여관(2층)";
  bundle.facilities[0]!.id = "inn2f";
  bundle.facilities[0]!.label = "여관(2층)";
  for (const place of bundle.places) if (place.id === "corridor" || place.id === "bedroom") place.level = 2;
  bundle.things.find((thing) => thing.id === "stairs")!.placeIds = ["dining", "corridor"];
  return bundle;
}
const twoStory = (() => {
  const bundle = twoStoryInn();
  const project: Project = createBlankProject();
  project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [bundle];
  const ctx = { project };
  const result = runTool(ctx, "place_concept", { query: bundle.facilities[0]!.label, mapId: "map_inn2f", seed: 7 }, { dryRun: false });
  if (!result.ok) throw new Error(`2층 여관 build failed: ${result.summary}`);
  const data = result.data as { floors: { level: number; mapId: string; name: string }[]; connections: { mapId: string; level: number; name: string; target: { mapId: string; x: number; y: number } | null }[] };
  const tileset = ctx.project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
  const pngs = data.floors.map((floor) => {
    const map = ctx.project.maps[floor.mapId]!;
    const png = renderInteriorMapPng(map, tileset, { scale: SCALE, markers: markersFor(map) });
    writePng(png, path.join(PNG_DIR, `${floor.mapId}.png`));
    return { ...floor, map, url: pngToDataUrl(png) };
  });
  const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])];
  return { bundle, levels: conceptFacilityLevels(bundle, bundle.facilities[0]!), floors: pngs, connections: data.connections, warnings, summary: result.summary };
})();
const twoStoryLinked = twoStory.floors.length === 2
  && twoStory.connections.length >= 2
  && twoStory.connections.filter((entry) => entry.level === 1).every((entry) => entry.target?.mapId === "map_inn2f_2f")
  && twoStory.connections.filter((entry) => entry.level === 2).every((entry) => entry.target?.mapId === "map_inn2f")
  && twoStory.floors[1]!.map.events.some((event) => event.pages?.[0]?.name === "계단(아래)")
  && !twoStory.warnings.some((line) => line.includes("연결 대상이 없다") || line.includes("자리 없음"));

const receiptPath = path.join(E2E_DIR, "receipt.json");
const receipt: E2eReceipt | null = fs.existsSync(receiptPath) ? (JSON.parse(fs.readFileSync(receiptPath, "utf8")) as E2eReceipt) : null;
const e2eShots = [
  ["01-db-facility-strip.png", "데이터베이스 「임시 → 개념 꾸러미」 — 시설 띠에 초안 아홉 종. 첫 시설(여관)이 열려 있다."],
  ["02-db-smithy.png", "대장간 칩을 누른 화면 — 벽 재질 석재 벽돌, 작업장 바닥 돌 바닥, 자재 창고·작업장 장소 카드."],
  ["03-db-warehouse.png", "창고 — 방 하나짜리 시설. 상자·술통·자루·선반이 한 장소에."],
  ["04-db-after-remove.png", "창고를 지운 뒤 — 띠에서 빠지고 「초안 넣기…」 셀렉트가 나타난다(빠진 초안만 보인다)."],
  ["11-canvas-smithy.png", "에디터 캔버스(WebGL) — __oprnEditorTool(place_concept, 대장간). 석재 벽돌 벽·돌 바닥."],
  ["12-canvas-tavern.png", "캔버스 — 술집. 주방·객실 위에 넓힌 홀, 카운터·피아노·긴 탁자."],
  ["13-canvas-guild.png", "캔버스 — 길드. 회의실 → 복도 → 접수홀, 금빛 벽돌."],
  ["14-canvas-church.png", "캔버스 — 교회. 사제실 위 예배당, 돌 바닥에 붉은 카펫과 흉상 둘."],
].map(([file, caption]) => ({ file: file!, caption: caption!, url: fileDataUrl(path.join(E2E_DIR, file!)) }));

const checks = [
  check(builts.length === CONCEPT_FACILITY_TEMPLATES.length, `초안 ${CONCEPT_FACILITY_TEMPLATES.length}종이 모두 place_concept 으로 선다`),
  check(planWarnings === 0, `문에서 모든 방에 닿는다 (plan·walkability 경고 ${planWarnings}건)`),
  check(unplacedTotal === 0, `물건이 전부 자리를 얻는다 (자리 없음 ${unplacedTotal}건)`),
  check(requiredMissing.length === 0, `필수 물건이 맵에 있다${requiredMissing.length > 0 ? ` — 빠짐: ${requiredMissing.join(", ")}` : ""}`),
  check(shapes.size >= 5, `도면이 시설마다 다르다 (방 수·크기 조합 ${shapes.size}가지)`),
  check(walls.size === 3 && floors.size >= 3, `재질이 달라진다 — 벽 ${[...walls].join("·")} · 바닥 타일 ${[...floors].join("·")}`),
  check(escalation.every((entry) => entry.ok), `「시설명 지어줘」마다 place_concept 이 승격된다 (${escalation.filter((entry) => entry.ok).length}/${escalation.length})`),
  check(promptLists, "시스템 프롬프트 개념 꾸러미 절 — 초안이면 시설명 한 줄(600자 미만), 고친 나무면 아홉 시설이 query 와 함께 실린다"),
  check(twoStoryLinked, `층: 여관을 1층 홀 + 2층 복도·침실로 가르면 맵 두 장이 서고 계단이 양방향으로 이어진다 (${twoStory.summary})`),
  check(Boolean(receipt?.built && receipt.built.length >= 4 && e2eShots.every((shot) => shot.url)), receipt ? `실제 에디터에서 시설 띠가 그려지고 place_concept 이 ${receipt.built?.length ?? 0}개 시설을 캔버스에 세웠다(e2e)` : "실제 에디터 증거 없음 (e2e 미실행)"),
];

const sha = git("git rev-parse --short HEAD");
const branch = git("git rev-parse --abbrev-ref HEAD");
const dirty = git("git status --porcelain").length > 0 ? " + 미커밋 변경" : "";

const sections = pictures.map(({ built, png, plan }, index) => {
  const facility = built.bundle.facilities[0]!;
  const unplaced = built.warnings.filter((line) => line.includes("자리 없음"));
  const conceptEvents = built.map.events.filter((event) => event.id.startsWith("ev_concept_"));
  const kinds = [...new Set(conceptEvents.map(eventKind))];
  return `
  <h2 id="${esc(built.bundle.id)}">${index + 1}. ${esc(facility.label)} <span class="dim">query="${esc(facility.label)}" · ${esc(built.summary)}</span></h2>
  <div class="grid2">
    <figure><img src="${png}" alt="${esc(facility.label)}"><figcaption><b>${esc(facility.label)}</b> — 색 표식은 칩 이벤트(${kinds.map((kind) => esc(kind)).join(" · ") || "없음"}) ${conceptEvents.length}개.${built.connections.some((c) => !c.linked) ? " 계단·문의 맵 연결은 미연결 지점으로 보고된다." : ""}</figcaption></figure>
    <figure><img src="${plan}" alt="${esc(facility.label)} 도면"><figcaption><b>도면</b> — <span class="role entrance">홀(정문)</span> <span class="role walkway">복도</span> <span class="role room">방</span>. ${esc(layoutSummary(built))}</figcaption></figure>
  </div>
  <div class="grid2" style="margin-top:14px">
    <div class="card"><h3>도면·재질</h3>${layoutTable(built)}</div>
    <div class="card"><h3>나무 → 시공 대조</h3>${thingsTable(built)}${unplaced.length > 0 ? `<p class="warn">${esc(unplaced.join("\n"))}</p>` : ""}</div>
  </div>`;
});

function layoutSummary(built: Built): string {
  const facility = built.bundle.facilities[0]!;
  const parts = facility.placeIds.map((placeId) => {
    const place = built.bundle.places.find((entry) => entry.id === placeId)!;
    const count = place.count ?? 1;
    return `${place.label}(${CONCEPT_PLACE_ROLE_LABELS[place.role ?? "room"]}·${CONCEPT_PLACE_SIZE_LABELS[place.size ?? "m"]}${count > 1 ? ` ×${count}` : ""})`;
  });
  return parts.join(" → ");
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>개념 꾸러미 시설 갤러리 — 아홉 시설, 한 도구</title>
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
  h2 .dim { font-size: 13px; font-weight: 400; margin-left: 8px; font-family: ui-monospace, monospace; }
  h3 { font-size: 17px; margin: 0 0 10px; }
  .meta { color: var(--faint); font: 12px/1.6 ui-monospace, monospace; margin-bottom: 18px; }
  .lede { color: var(--dim); max-width: 78ch; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
  .checks { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin-top: 8px; }
  .checks li { display: flex; gap: 10px; align-items: baseline; }
  .checks .mark { font-weight: 700; width: 1.2em; }
  .checks li.ok .mark { color: var(--ok); } .checks li.bad .mark { color: var(--bad); }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 14px; }
  .gallery figure img { max-height: 320px; object-fit: contain; }
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
  code { font-family: ui-monospace, monospace; font-size: 12.5px; }
  pre { background: #0c0a08; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; overflow: auto; font-size: 12.5px; white-space: pre-wrap; }
  .toc { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; }
  .toc a { color: var(--accent); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 2px 12px; font-size: 13px; }
  .note { border-left: 3px solid var(--accent); background: #e8b86d12; padding: 12px 16px; border-radius: 0 10px 10px 0; color: #f0d7a8; margin: 14px 0; }
</style>
</head>
<body>
<div class="wrap">
  <p class="kicker">place_concept · CONCEPT_FACILITY_TEMPLATES · ${esc(branch)}@${esc(sha)}${esc(dirty)}</p>
  <h1>개념 꾸러미 시설 갤러리 — 아홉 시설, 한 도구</h1>
  <p class="meta">생성 ${new Date().toISOString()} · 작성 Claude(에이전트) · 시드 7 · 렌더 scripts/lib/renderInteriorMapPng.mts(에디터와 같은 쿼터 합성)</p>
  <p class="lede">
    「개념 꾸러미」는 시설 → 장소 → 물건 → 칩 나무다. 이제 실내 칩셋에는 여관 하나가 아니라 <b>초안 아홉 종</b>이 시드되고,
    조수는 「상점 지어줘」「대장간 만들어줘」처럼 시설명을 부르면 같은 <code>place_concept</code> 으로 짓는다.
    장소에는 <b>바닥 재질</b>(나무·돌·널·돗자리), 시설에는 <b>벽 재질</b>(크림·금빛 벽돌·석재 벽돌)이 붙어 같은 도면 규칙으로도 다른 실내가 나온다.
    데이터베이스 「임시 → 개념 꾸러미」의 시설 띠에서 초안을 오가고, 지우고, 다시 넣고, 빈 시설을 새로 만든다.
  </p>

  <section class="card">
    <h3>판정</h3>
    <ul class="checks">${checks.join("")}</ul>
  </section>

  <h2>한눈에</h2>
  <div class="gallery">
    ${pictures.map(({ built, png }) => `<figure><a href="#${esc(built.bundle.id)}"><img src="${png}" alt="${esc(built.bundle.label)}"></a><figcaption><b>${esc(built.bundle.label)}</b> — ${esc(layoutSummary(built))} · 벽 ${esc(CONCEPT_WALL_MATERIAL_LABELS[conceptFacilityWall(built.bundle.facilities[0]!)])}</figcaption></figure>`).join("")}
  </div>
  <p class="legend">
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.inn.join(",")})"></span>sleep → 여관(inn)</span>
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.transfer.join(",")})"></span>transfer → 맵 연결</span>
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.loot.join(",")})"></span>loot → 1회 노획</span>
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.text.join(",")})"></span>event → 조사 문장</span>
    <span><span class="dot" style="background:rgb(${MARKER_COLORS.entrance.join(",")})"></span>정문(입구 이벤트)</span>
  </p>
  <div class="toc">${pictures.map(({ built }) => `<a href="#${esc(built.bundle.id)}">${esc(built.bundle.label)}</a>`).join("")}</div>

  <h2>조수가 보는 것 — 시스템 프롬프트 개념 꾸러미 절</h2>
  <p class="lede">두 단계다. 초안 그대로(칩셋에 <code>scratchConceptBundles</code> 없음)면 시설명 한 줄 — 빈 프로젝트 프롬프트가 20,000자 예산 중 약 19,250자를 이미 써서 시설별 줄을 싣으면 뒤의 스타일 문서 발췌가 밀려난다. 사용자가 고친 나무면 시설마다 한 줄: 물건은 라벨과 표식(*필수 · ⌂수면 · $노획 · ↔맵 연결)만, 바닥·벽·층은 기본값이 아닐 때만. 승격: ${escalation.map((entry) => `${esc(entry.label)} ${entry.ok ? "✓" : "✗"}`).join(" · ")}</p>
  <pre>${esc(compactSection.trim())}</pre>
  <pre>${esc(conceptSection.trim())}</pre>
  <div class="note">툴 설명(<code>PLACE_CONCEPT_TOOL.description</code>)의 시설 단어가 자연어 승격의 열쇠다 — 「${esc(PLACE_CONCEPT_TOOL.description.slice(0, 120))}…」</div>

  ${sections.join("\n")}

  <h2 id="levels">층 — 여관을 두 층으로 <span class="dim">장소 level · ${esc(twoStory.summary)}</span></h2>
  <p class="lede">장소에 <b>층</b>(1~3)을 주면 2층 이상 장소는 <code>&lt;mapId&gt;_2f</code> 별도 맵으로 선다. 아래층 계단(맵 연결 칩) → 위층 착지(위층 문 자리 바로 북쪽), 위층 문 자리 → 「계단 내려가기」 → 아래층 계단 앞. 층마다 건물 외곽(밴드 폭)을 가장 넓은 층에 맞춘다 — 홀만 남은 1층이 좁아지면 계단·카운터·피아노가 북벽에 나눠 설 자리가 없다. 여기서는 여관의 복도·침실을 2층으로 올리고 계단을 홀과 복도 양쪽에 두었다.</p>
  <div class="grid2">
    ${twoStory.floors.map((floor) => `<figure><img src="${floor.url}" alt="${esc(floor.name)}"><figcaption><b>${esc(floor.name)}</b> <code>${esc(floor.mapId)}</code> — ${floor.map.width}×${floor.map.height} · 이벤트 ${floor.map.events.length}개. ${esc(twoStory.connections.filter((entry) => entry.mapId === floor.mapId).map((entry) => `${entry.name} → ${entry.target?.mapId ?? "미연결"} (${entry.target?.x},${entry.target?.y})`).join(" · "))}</figcaption></figure>`).join("")}
  </div>

  <h2>실제 에디터에서 — 데이터베이스 시설 띠와 캔버스</h2>
  ${receipt ? `
  <p class="lede">진단 스펙 <code>test/e2e/_concept-facility-gallery.spec.ts</code>(모델 호출 없음, dev 서버 9877)이 남긴 사진. 데이터베이스 탭은 실제 DOM, 맵은 에디터 WebGL 캔버스다 — 위 갤러리 PNG 와 같은 그림이면 보고서 렌더러가 에디터와 같다는 뜻이다.</p>
  <div class="grid2">
    ${e2eShots.filter((shot) => shot.url).map((shot) => `<figure><img src="${shot.url}" alt="${esc(shot.file)}"><figcaption><b>${esc(shot.file)}</b> — ${esc(shot.caption)}</figcaption></figure>`).join("")}
  </div>
  <div class="card" style="margin-top:14px">
    <h3>영수증</h3>
    <table class="events"><thead><tr><th>시설</th><th>맵</th><th>크기</th><th>방</th><th>벽</th><th>이벤트</th><th>요약</th></tr></thead><tbody>
      ${(receipt.built ?? []).map((entry) => `<tr><td>${esc(entry.query)}</td><td><code>${esc(entry.mapId)}</code></td><td>${esc(entry.size)}</td><td>${entry.rooms ?? "?"}</td><td>${esc(entry.wallMaterial ?? "?")}</td><td>${entry.events}</td><td>${esc(entry.summary)}</td></tr>`).join("")}
    </tbody></table>
    <p class="dim">${esc(receipt.startedAt ?? "")} → ${esc(receipt.finishedAt ?? "")}</p>
  </div>` : `<div class="note">실제 에디터 증거가 없다. <code>DEV_SERVER_PORT=9877 E2E_RETRIES=0 npx playwright test test/e2e/_concept-facility-gallery.spec.ts --project=chromium --workers=1</code> 을 돌리고 SHOT_DIR 의 사진을 <code>reports/concept-facilities/e2e/</code> 로 옮기면 이 절이 채워진다.</div>`}

  <h2>설계 메모</h2>
  <div class="card">
    <ul style="padding-left:20px; color: var(--dim); line-height: 1.8">
      <li><b>정본은 프로젝트.</b> 초안은 <code>tileset.scratchConceptBundles</code> 가 <code>undefined</code> 일 때 한 번 시드된다. 사용자가 지운 시설은 돌아오지 않고(빈 배열도 재시드 금지), 시설 띠의 「초안 넣기」가 빠진 초안만 골라 넣는다.</li>
      <li><b>도면 규칙 하나.</b> 방 줄 → 복도 → 홀. 복도 없이 방 둘 이상이 홀 바로 위에 서면 홀을 좌우 1열씩 넓힌다 — 방문 착지 열이 홀 북벽을 2칸 조각으로 쪼개 카운터·피아노가 설 자리가 없었다(술집·민가 실측).</li>
      <li><b>구성 순서.</b> 벽 가구(필수 먼저) → 러그 → 바닥·구석 소품(필수 먼저). 러그는 상위 레이어 가구 밑으로 들어가고, 1×1 소품은 네 구석 → 둘레 → 안쪽 순으로 앉는다(창고의 상자·술통 7개).</li>
      <li><b>재질은 리틴트.</b> 바닥은 방별 <code>floorTile</code>(돌 12·널 102·돗자리 139), 벽은 시설 <code>wallMaterial</code> — 파이프라인이 가구 배치 뒤 크림 벽면·나무 바닥을 통타일로 갈아 끼운다. 벽걸이는 상위 레이어라 벽 재질이 바뀌어도 남는다.</li>
      <li><b>카탈로그 10종 추가.</b> 성상·과일 선반·항아리 선반·곡물 자루·잡화 상자·물통·주전자·스툴·붉은 카펫·짚 돗자리 — 파이프라인 어휘에 있던 소품을 오브젝트로 올렸다(역할 null, 테마 가구 선택에 영향 없음). 옛 프로젝트의 킷에 없어도 피커·시공이 카탈로그로 푼다.</li>
      <li><b>층(2026-09-03).</b> 장소 <code>level</code>(1~3). 층마다 <code>layoutConceptFacility({level, minBandWidth})</code> 로 도면을 내고 <code>place_concept</code> 이 맵을 층 수만큼 짓는다. 1층 계단은 위층 착지로, 위층 정문 이벤트는 「계단(아래)」로 바뀌어 1층 계단 앞에 내린다. 초안 아홉 종은 그대로 한 층이다 — 2층은 데이터베이스 장소 카드의 「층」에서 켠다.</li>
      <li><b>조수 코어(2026-09-03).</b> 이미 완료된 항목의 complete_work_item 은 idempotent(같은 맵 두 번 시공 방지). 패널 「도구 규칙」 가이드 문구가 의도 스캔에 섞여 볼륨 계약을 무장시키던 폭주는 <code>stripContextFooter</code> 가 가이드 블록을 떼어 막았다 — 실제 모델 「여관 지어줘」가 66초·툴 19회·시작 맵 오염에서 10초·툴 3회·시작 맵 무변경이 됐다(<code>test/e2e/_concept-inn-audit.spec.ts</code>).</li>
      <li><b>바꾸지 않은 것.</b> 의도 라우터·되묻기의 실내 표지에 여관 외 시설명을 넣지 않았다. 「대장간 지어줘」는 야외 건물일 수도 있어 기존대로 실내/야외를 되묻고, 실내로 답하면 place_concept 이 짓는다.</li>
    </ul>
  </div>

  <h2>재현</h2>
  <pre>npm run typecheck:app
npx vitest run test/conceptFacilityTemplates.test.ts test/conceptFacilityLevels.test.ts test/placeConceptTool.test.ts test/scratchConceptTab.test.ts test/placeConceptAssistant.test.ts test/interiorObjectCatalog.test.ts
npx tsx scripts/gen-concept-facility-gallery.mts
DEV_SERVER_PORT=9877 E2E_RETRIES=0 npx playwright test test/e2e/_concept-facility-gallery.spec.ts --project=chromium --workers=1   # 사진은 /tmp/concept-facility-shots → reports/concept-facilities/e2e/</pre>
</div>
</body>
</html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_HTML, html);
console.log(OUT_HTML);
console.log(`checks: ${checks.filter((line) => line.includes('class="ok"')).length}/${checks.length} ok`);
for (const built of builts) {
  const unplaced = built.warnings.filter((line) => line.includes("자리 없음"));
  console.log(`${built.bundle.label}: ${built.layout.width}x${built.layout.height} rooms=${built.layout.rooms.length} wall=${built.wallMaterial} events=${built.map.events.length} unplaced=${unplaced.length}`);
}
