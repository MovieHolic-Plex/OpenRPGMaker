import fs from "node:fs";
import path from "node:path";
import { innDesignVariants } from "../src/editor/conceptInnVariants.ts";
import { scoreConceptFacility, type ConceptFacilityReview } from "../src/editor/conceptFacilityScore.ts";
import { INTERIOR_ROOM_TILESET_ID } from "../src/editor/interiorRoomPipeline.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { GameMap, TilesetDef } from "../src/project/types.ts";
import { pngToDataUrl, renderInteriorMapPng, writePng } from "./lib/renderInteriorMapPng.mts";

const OUT_DIR = path.resolve("reports/inn-freeform");
const PNG_DIR = path.join(OUT_DIR, "png");
const E2E_DIR = path.join(OUT_DIR, "e2e");
const SCALE = 3;

const DOUBLE_PLAN = {
  layout: "double-row" as const,
  places: [
    { id: "bedroom", label: "객실", role: "room", size: "s", count: 2, zone: "north" },
    { id: "kitchen", label: "주방", role: "room", size: "s", zone: "south" },
    { id: "storage", label: "창고", role: "room", size: "s", zone: "south" },
    { id: "corridor", label: "복도", role: "walkway" },
    { id: "hall", label: "홀", role: "entrance", size: "l" },
  ],
  things: [
    { objectId: "bed_h", placeIds: ["bedroom"], chips: ["block", "event", "sleep"], required: true },
    { objectId: "stove", placeIds: ["kitchen"], chips: ["block", "event"], required: true },
    { objectId: "barrel", placeIds: ["storage"], chips: ["block"] },
    { objectId: "counter", placeIds: ["hall"], chips: ["block", "event"], required: true },
    { objectId: "table_chairs", placeIds: ["hall"], chips: ["block"] },
    { objectId: "window", placeIds: ["bedroom", "hall"], chips: ["wall"] },
  ],
};

type Built = {
  label: string;
  mapId: string;
  map: GameMap;
  tileset: TilesetDef;
  summary: string;
  warnings: string[];
  review?: ConceptFacilityReview;
  designNote?: string;
  rooms: { roomId: string; placeId: string; role: string; x: number; y: number; w: number; h: number }[];
  pngFile: string;
};

function build(label: string, mapId: string, args: Record<string, unknown>): Built {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "place_concept", { query: "여관", mapId, seed: 7, ...args }, { dryRun: false });
  if (!result.ok) throw new Error(`${label}: ${result.summary} ${JSON.stringify(result.issues)}`);
  const data = result.data as Built;
  const map = ctx.project.maps[mapId];
  if (!map) throw new Error(`${label}: map missing`);
  return {
    label,
    mapId,
    map,
    tileset: ctx.project.tilesets[INTERIOR_ROOM_TILESET_ID]!,
    summary: result.summary,
    warnings: [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])],
    review: data.review,
    designNote: data.designNote,
    rooms: data.rooms,
    pngFile: `${mapId}.png`,
  };
}

function render(built: Built, boxes: boolean): string {
  const png = renderInteriorMapPng(built.map, built.tileset, {
    scale: SCALE,
    boxes: boxes
      ? built.rooms.map((room) => ({
          x: room.x, y: room.y, w: room.w, h: room.h,
          color: room.role === "entrance" ? [255, 170, 60] as const
            : room.role === "walkway" ? [90, 220, 160] as const
            : [110, 170, 255] as const,
        }))
      : [],
  });
  const file = path.join(PNG_DIR, boxes ? built.pngFile.replace(".png", "-boxes.png") : built.pngFile);
  writePng(png, file);
  return pngToDataUrl(png);
}

function esc(value: unknown): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function reviewTable(review: ConceptFacilityReview | undefined): string {
  if (!review) return "<p class='dim'>review 없음</p>";
  const rows = review.checks.map((check) =>
    `<tr class="${check.pass ? "yes" : "no"}"><td><code>${esc(check.id)}</code></td><td>${check.pass ? "통과" : "실패"}</td><td>${esc(check.detail)}</td></tr>`,
  ).join("");
  return `<p>점수 <b>${review.score.toFixed(2)}</b> · 템플릿 복사 ${review.copiedTemplate ? "예" : "아니오"}</p>
    <table><thead><tr><th>검사</th><th>결과</th><th>내용</th></tr></thead><tbody>${rows}</tbody></table>`;
}

type TurnDump = {
  prompt: string;
  elapsedMs: number;
  provider?: string;
  ok?: boolean;
  lastAssistantText?: string;
  tools?: string[];
  maps?: Record<string, {
    name: string; width: number; height: number; tileHash: string; seed?: number;
    rooms?: { id: string; x?: number; y?: number; w: number; h: number }[];
    things?: Record<string, string>;
    facility?: string;
    lowerTiles?: number[];
    upperTiles?: number[];
  }>;
};

function loadTurns(): TurnDump[] {
  if (!fs.existsSync(E2E_DIR)) return [];
  return fs.readdirSync(E2E_DIR).filter((name) => name.endsWith(".json")).sort().map((name) =>
    JSON.parse(fs.readFileSync(path.join(E2E_DIR, name), "utf8")) as TurnDump,
  );
}

function renderDump(tileset: TilesetDef, dump: NonNullable<TurnDump["maps"]>[string], file: string): string | null {
  if (!dump.lowerTiles || !dump.upperTiles) return null;
  const map: GameMap = {
    id: "dump",
    name: dump.name,
    width: dump.width,
    height: dump.height,
    tilesetId: INTERIOR_ROOM_TILESET_ID,
    tileSize: 16,
    lowerTiles: dump.lowerTiles,
    upperTiles: dump.upperTiles,
    events: [],
  };
  const png = renderInteriorMapPng(map, tileset, { scale: SCALE });
  writePng(png, file);
  return pngToDataUrl(png);
}

fs.mkdirSync(PNG_DIR, { recursive: true });
fs.mkdirSync(E2E_DIR, { recursive: true });

const templateInn = build("템플릿 여관 (plan 생략)", "map_template", {});
const rowSame = build("같은 장소 · row", "map_row", { plan: { ...DOUBLE_PLAN, layout: "row" } });
const double = build("같은 장소 · double-row", "map_double", { plan: DOUBLE_PLAN });
const rural = build("시골 단층 variant", "map_rural", { plan: innDesignVariants()[0]!.plan });
const twoFloor = build("2층 객실 variant", "map_2f", { plan: innDesignVariants()[1]!.plan });

const templatePng = render(templateInn, false);
const rowPng = render(rowSame, true);
const doublePng = render(double, true);
const ruralPng = render(rural, false);
const twoFloorPng = render(twoFloor, false);
const twoFloorUpper = twoFloor.mapId;
const upperMap = twoFloor.map; // 1F; 2F is map_2f_2f on a different project — rebuild
const twoFloorCtx = { project: createBlankProject() };
runTool(twoFloorCtx, "place_concept", { query: "여관", mapId: "map_2f", seed: 7, plan: innDesignVariants()[1]!.plan }, { dryRun: false });
const upper = twoFloorCtx.project.maps.map_2f_2f;
let twoFloorUpperPng = "";
if (upper) {
  const png = renderInteriorMapPng(upper, twoFloorCtx.project.tilesets[INTERIOR_ROOM_TILESET_ID]!, { scale: SCALE });
  writePng(png, path.join(PNG_DIR, "map_2f_2f.png"));
  twoFloorUpperPng = pngToDataUrl(png);
}

const tileset = templateInn.tileset;
const turns = loadTurns();
const turnFigs = turns.map((turn, index) => {
  const maps = Object.entries(turn.maps ?? {});
  const imgs = maps.map(([id, dump]) => {
    const url = renderDump(tileset, dump, path.join(PNG_DIR, `turn${index + 1}-${id}.png`));
    const rooms = (dump.rooms ?? []).map((room) => `${room.id} ${room.w}×${room.h}`).join(" · ");
    return url
      ? `<figure><img src="${url}" alt="${esc(dump.name)}"><figcaption><b>${esc(dump.name)}</b> ${dump.width}×${dump.height} hash=${esc(dump.tileHash)}<br>${esc(rooms)}</figcaption></figure>`
      : `<p class="dim">${esc(id)} 타일 덤프 없음 (${dump.width}×${dump.height} hash=${esc(dump.tileHash)})</p>`;
  }).join("");
  const things = maps.map(([, dump]) => Object.entries(dump.things ?? {}).map(([k, v]) => `${k}: ${v}`).join(" / ")).join(" | ");
  return `<section class="card">
    <h3>턴 ${index + 1} · 「${esc(turn.prompt)}」 · ${turn.elapsedMs}ms · ${esc(turn.provider ?? "")}</h3>
    <p class="dim">툴: ${esc((turn.tools ?? []).join(" → "))}</p>
    <div class="grid2">${imgs || "<p class='dim'>맵 없음</p>"}</div>
    <p class="dim">${esc(things)}</p>
    <blockquote class="quote">${esc((turn.lastAssistantText ?? "").slice(0, 600))}</blockquote>
  </section>`;
}).join("\n");

const templatePlaces = new Set(["bedroom", "corridor", "dining"]);
function differsFromTemplate(turn: TurnDump): boolean {
  const maps = Object.values(turn.maps ?? {});
  if (maps.length === 0) return false;
  return maps.some((dump) => {
    const ids = (dump.rooms ?? []).map((room) => room.id.replace(/_\d+$/, ""));
    const unique = new Set(ids);
    if (unique.size !== templatePlaces.size) return true;
    if (dump.width !== templateInn.map.width || dump.height !== templateInn.map.height) return true;
    return [...unique].some((id) => !templatePlaces.has(id));
  });
}
const plainTurns = turns.filter((turn) => turn.prompt === "여관 지어줘");
const plainDesigned = plainTurns.filter(differsFromTemplate).length;
const doubleTurn = turns.find((turn) => turn.prompt.includes("복도 양쪽"));
const doubleHasSouth = Boolean(doubleTurn && Object.values(doubleTurn.maps ?? {}).some((dump) => {
  const corridor = (dump.rooms ?? []).find((room) => /corridor|복도|walkway/i.test(room.id));
  if (!corridor || corridor.y === undefined) return (dump.rooms ?? []).length > 4;
  return (dump.rooms ?? []).some((room) => (room.y ?? 0) >= (corridor.y ?? 0) + (corridor.h ?? 0) && !/hall|dining|corridor/i.test(room.id));
}));

const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>여관 자유 설계 — 개념 꾸러미</title>
<style>
  :root { --bg:#14110e; --ink:#f4ead8; --dim:#cbbba0; --faint:#8a7a64; --line:#3a3228; --accent:#e8b86d; --bad:#e07a7a; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.55 "Iowan Old Style", Georgia, serif; }
  .wrap { max-width:1180px; margin:0 auto; padding:32px 24px 80px; }
  h1 { font-size:32px; margin:8px 0 12px; } h2 { margin:36px 0 12px; font-size:22px; }
  .lede, .meta, .dim { color:var(--dim); } .kicker { color:var(--accent); letter-spacing:.08em; text-transform:uppercase; font-size:12px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; } .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
  figure { margin:0; background:#0c0a08; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  figure img { width:100%; image-rendering:pixelated; display:block; background:#1a1612; }
  figcaption { padding:10px 12px 14px; font-size:13.5px; color:var(--dim); }
  figcaption b { color:var(--ink); }
  .card { background:#1b1713; border:1px solid var(--line); border-radius:12px; padding:16px 18px; margin:12px 0; }
  table { width:100%; border-collapse:collapse; } th,td { text-align:left; padding:6px; border-bottom:1px solid var(--line); font-size:13.5px; }
  tr.no td { color:var(--bad); } tr.yes td { color:#cfe8d4; }
  .quote { border-left:3px solid var(--line); padding:8px 14px; color:var(--dim); white-space:pre-wrap; }
  code { font-family:ui-monospace,monospace; font-size:12.5px; }
  .note { border-left:3px solid var(--accent); background:#e8b86d12; padding:12px 16px; color:#f0d7a8; }
</style></head><body><div class="wrap">
<p class="kicker">place_concept · layout row|double-row · scoreConceptFacility</p>
<h1>개념 꾸러미로 여관을 자유롭게 짓기</h1>
<p class="meta">생성 ${new Date().toISOString()} · 워크트리 lucky-stone-53b4 · 포트 9841</p>
<p class="lede">모델은 장소·물건·layout 을 설계하고, 코드가 좌표·벽·문·이벤트를 시공한다. 이 보고서는 두 번째 도면 문법(double-row), 채점기, 여관 variants, 실 모델 턴을 그림으로 판정한다.</p>

<section class="card">
<h2 style="margin-top:0">판정</h2>
<ul>
<li>double-row 폭 ${double.map.width} &lt; row 폭 ${rowSame.map.width} (${double.map.width < rowSame.map.width ? "통과" : "실패"})</li>
<li>템플릿 여관 점수 ${templateInn.review?.score.toFixed(2)} · 복사 ${templateInn.review?.copiedTemplate ? "예(기대)" : "아니오"}</li>
<li>double-row 자리 없음 ${double.warnings.filter((line) => line.includes("자리 없음")).length}건</li>
<li>실 모델 「여관 지어줘」 ${plainTurns.length}턴 중 템플릿과 다른 설계 ${plainDesigned}턴 (목표 ≥2/${Math.max(3, plainTurns.length) || 3})</li>
<li>「복도 양쪽」 턴 남쪽 방 ${doubleHasSouth ? "있음" : turns.length ? "없음/미실행" : "아직 없음"}</li>
</ul>
</section>

<h2>1. 템플릿 vs 설계</h2>
<p class="lede">왼쪽은 plan 생략(템플릿 그대로). 오른쪽은 시골 단층 variant — 객실 1, 복도 없음, 피아노 없음.</p>
<div class="grid2">
<figure><img src="${templatePng}" alt="템플릿 여관"><figcaption><b>템플릿 여관</b> ${esc(templateInn.summary)}<br>${esc(templateInn.designNote ?? "")}</figcaption></figure>
<figure><img src="${ruralPng}" alt="시골 단층"><figcaption><b>시골 단층 variant</b> ${esc(rural.summary)}</figcaption></figure>
</div>
<div class="grid2">
<div class="card"><h3>템플릿 채점</h3>${reviewTable(templateInn.review)}</div>
<div class="card"><h3>시골 단층 채점</h3>${reviewTable(rural.review)}</div>
</div>

<h2>2. 도면 문법 row vs double-row</h2>
<p class="lede">같은 장소(객실×2 · 주방 · 창고 · 복도 · 홀). 색 상자: 홀 주황 · 복도 초록 · 방 파랑. double-row 는 객실이 복도 북쪽, 주방·창고가 홀 옆(남쪽).</p>
<div class="grid2">
<figure><img src="${rowPng}" alt="row"><figcaption><b>row</b> ${rowSame.map.width}×${rowSame.map.height} · ${esc(rowSame.summary)}</figcaption></figure>
<figure><img src="${doublePng}" alt="double-row"><figcaption><b>double-row</b> ${double.map.width}×${double.map.height} · ${esc(double.summary)}</figcaption></figure>
</div>
<div class="card">${reviewTable(double.review)}</div>

<h2>3. 2층 객실 variant</h2>
<div class="grid2">
<figure><img src="${twoFloorPng}" alt="2층 1층"><figcaption><b>1층</b> 홀·주방·복도</figcaption></figure>
<figure>${twoFloorUpperPng ? `<img src="${twoFloorUpperPng}" alt="2층">` : "<p class='dim'>2층 맵 없음</p>"}<figcaption><b>2층</b> 객실 ×3</figcaption></figure>
</div>
<div class="card">${reviewTable(twoFloor.review)}</div>

<h2>4. 실 모델 턴</h2>
${turnFigs || "<div class='note'>아직 e2e 턴 덤프가 없다. <code>reports/inn-freeform/e2e/*.json</code> 이 생기면 이 절이 채워진다.</div>"}

<p class="dim">절대경로 ${esc(path.join(OUT_DIR, "index.html"))}</p>
</div></body></html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
console.log(`wrote ${path.join(OUT_DIR, "index.html")}`);
console.log(`template ${templateInn.map.width}x${templateInn.map.height} score=${templateInn.review?.score}`);
console.log(`row ${rowSame.map.width} double ${double.map.width}`);
console.log(`turns ${turns.length}`);
void twoFloorUpper;
void upperMap;
