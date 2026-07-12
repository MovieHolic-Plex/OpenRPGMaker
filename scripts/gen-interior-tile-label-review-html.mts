/**
 * Draft tile labels for map_interior_blank review HTML.
 * User corrects labels later — all meanings here are AI estimates from code + map usage.
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tileSprite(tile: number, scale = 3): string {
  if (tile < 0) return `<span class="tile empty"></span>`;
  const { col, row } = chipPos(tile);
  const size = TILE * scale;
  return `<span class="tile" style="width:${size}px;height:${size}px;background-position:${-col * size}px ${-row * size}px;background-size:${COLS * size}px auto" title="tile ${tile}"></span>`;
}

/** AI draft labels — confidence: high/medium/low based on code+map structure only (no vision). */
type Draft = {
  label: string;
  role: string;
  note: string;
  confidence: "high" | "medium" | "low";
  source: string;
};

const DRAFTS: Record<number, Draft> = {
  // --- void / floor ---
  430: {
    label: "실외/암부 보이드 배경",
    role: "background",
    note: "방 밖·천장 쪽을 채우는 어두운 배경. wall-frame 멤버 아님. 순수 배경이어야 하며 outer-corner 대각이 비었을 때만 368 쿼터 합성 후보.",
    confidence: "high",
    source: "interiorWallFrameQuarter BACKGROUND + 맵 외곽 전면 사용",
  },
  72: {
    label: "실내 바닥 (벽프레임 connect)",
    role: "floor",
    note: "방 안 통행 바닥. 오토타일 멤버가 아니라 connect-only(이웃 연결만). 하네스 '실내 바닥' 270~ 과는 다른 칩.",
    confidence: "high",
    source: "INTERIOR_WALL_FRAME_FLOOR_TILE=72 + 맵 y7~10 광역",
  },

  // --- wall frame edges/body (code roles) ---
  105: {
    label: "벽 프레임 몸통 (body)",
    role: "wall-frame",
    note: "4방 오토타일 body. 맵에서는 방 안쪽 상단 벽면/프레임 면으로 가로 반복.",
    confidence: "high",
    source: "INTERIOR_WALL_FRAME_TILES.body",
  },
  104: {
    label: "벽 프레임 안쪽 좌 트림 (inner-L)",
    role: "wall-frame",
    note: "105 왼쪽 세로 줄. 상단 벽 블록의 좌측 세로 기둥/트림으로 추정.",
    confidence: "medium",
    source: "기본 멤버 104 + 맵에서 105 서측 열",
  },
  106: {
    label: "벽 프레임 안쪽 우 트림 (inner-R)",
    role: "wall-frame",
    note: "105 오른쪽 세로 줄. 상단 벽 블록의 우측 세로 기둥/트림으로 추정.",
    confidence: "medium",
    source: "기본 멤버 106 + 맵에서 105 동측 열",
  },
  428: {
    label: "벽 프레임 서측 변 (edgeW)",
    role: "wall-frame",
    note: "방 왼쪽 세로 프레임. 맵 x=1 전 높이.",
    confidence: "high",
    source: "INTERIOR_WALL_FRAME_TILES.edgeW",
  },
  426: {
    label: "벽 프레임 동측 변 (edgeE)",
    role: "wall-frame",
    note: "방 오른쪽 세로 프레임. 맵 x=14 및 상부 블록 동측.",
    confidence: "high",
    source: "INTERIOR_WALL_FRAME_TILES.edgeE",
  },
  457: {
    label: "벽 프레임 북측 변/상단 보 (edgeN)",
    role: "wall-frame",
    note: "가로 상단 보·북 엣지. y=4 가로 줄, y=1 캡 줄 중간에도 사용.",
    confidence: "high",
    source: "INTERIOR_WALL_FRAME_TILES.edgeN",
  },
  397: {
    label: "벽 프레임 남측 변 (edgeS)",
    role: "wall-frame",
    note: "방 하단 가로 프레임. y=11 대부분 + 문 앞 y=12 한 칸.",
    confidence: "high",
    source: "INTERIOR_WALL_FRAME_TILES.edgeS",
  },
  368: {
    label: "벽 프레임 코너 그래픽 (corner, 쿼터 소스)",
    role: "wall-frame",
    note: "코드상 4코너 모두 이 ID. 이 맵 lower에는 0칸. 렌더는 outer-corner 430/257 위에 8×8 크롭으로만 씀.",
    confidence: "high",
    source: "INTERIOR_WALL_FRAME_TILES.corner*",
  },
  456: {
    label: "상단 보 서측 연결 코너 (beam NW join)",
    role: "wall-frame",
    note: "y=4 가로 보 왼쪽 끝. 세로 426과 가로 457이 만나는 기역자 연결 타일. (5,3) 대각 멤버.",
    confidence: "medium",
    source: "기본 멤버 456 + 맵 (4,4) 단일",
  },
  458: {
    label: "상단 보 동측 연결 코너 (beam NE join)",
    role: "wall-frame",
    note: "y=4 가로 보 오른쪽 끝. (10,4). (9,3) 대각 멤버.",
    confidence: "medium",
    source: "기본 멤버 458 + 맵 (10,4) 단일",
  },
  396: {
    label: "하단 문 알코브 좌 (door alcove L)",
    role: "wall-frame",
    note: "남측 프레임 문 홈 왼쪽. (8,11) 근처. 출구 알코브 좌 조각 추정.",
    confidence: "medium",
    source: "기본 멤버 396 + 맵 y11 문 주변",
  },
  398: {
    label: "하단 문 알코브 우 (door alcove R)",
    role: "wall-frame",
    note: "남측 프레임 문 홈 오른쪽. (6,11).",
    confidence: "medium",
    source: "기본 멤버 398 + 맵 y11 문 주변",
  },

  // --- extended members (on this project's group) ---
  233: {
    label: "상단 캡 좌 (top cap L)",
    role: "wall-frame",
    note: "y=1 상부 장식 줄 왼쪽 끝. 확장 멤버. variantMap 고립/일부 마스크에도 연결됨.",
    confidence: "medium",
    source: "맵 (1,1)(10,1) + 확장 멤버",
  },
  258: {
    label: "상단 캡 우 (top cap R)",
    role: "wall-frame",
    note: "y=1 상부 장식 줄 오른쪽 끝. 확장 멤버.",
    confidence: "medium",
    source: "맵 (4,1)(14,1) + 확장 멤버",
  },
  232: {
    label: "상단 캡 계열 (확장, 맵 미사용?)",
    role: "wall-frame",
    note: "그룹 멤버이나 이 맵 lower 빈도 0 가능. 상단 캡 변형 추정.",
    confidence: "low",
    source: "확장 멤버 only",
  },
  234: {
    label: "상단 캡/변형 또는 소품 혼동 ID",
    role: "wall-frame?",
    note: "그룹 멤버 + upper에도 234 사용 가능. lower 멤버 의미와 upper 소품이 같은 ID면 레이어로 구분.",
    confidence: "low",
    source: "확장 멤버 + upper 사용 가능",
  },
  257: {
    label: "문턱/보존 바닥 (doorway floor base)",
    role: "floor-special",
    note: "쿼터 합성 시 underlay로 보존되는 베이스. 문 앞 바닥 조각. 이 맵 lower에는 거의 없을 수 있음.",
    confidence: "medium",
    source: "interiorWallFrameQuarter PRESERVED_BASE=257",
  },

  // --- non-member structure in alcove ---
  18: {
    label: "좌측 알코브 장식 상단좌 (창문/벽면 추정)",
    role: "decor-lower",
    note: "오토타일 밖. 좌상 블록 (2,4) 2×3 패치 일부.",
    confidence: "low",
    source: "맵 구조 only",
  },
  20: {
    label: "좌측 알코브 장식 상단우",
    role: "decor-lower",
    note: "18 옆. 창문 쌍 추정.",
    confidence: "low",
    source: "맵 구조 only",
  },
  48: {
    label: "좌측 알코브 장식 중단좌",
    role: "decor-lower",
    note: "18 아래.",
    confidence: "low",
    source: "맵 구조 only",
  },
  50: {
    label: "좌측 알코브 장식 중단우",
    role: "decor-lower",
    note: "20 아래.",
    confidence: "low",
    source: "맵 구조 only",
  },
  78: {
    label: "좌측 알코브 장식 하단좌",
    role: "decor-lower",
    note: "48 아래.",
    confidence: "low",
    source: "맵 구조 only",
  },
  79: {
    label: "좌측 알코브 장식 하단우",
    role: "decor-lower",
    note: "50 아래. 78과 한 쌍 하단.",
    confidence: "low",
    source: "맵 구조 only",
  },

  // --- harness groups not heavily used on this map ---
  1: { label: "실내 벽(하네스) 1", role: "wall", note: "tileGroup 실내 벽. 이 맵 프레임은 주로 104~458 계열.", confidence: "medium", source: "INTERIOR_HARNESS wall" },
  2: { label: "실내 벽(하네스) 2", role: "wall", note: "tileGroup 실내 벽", confidence: "medium", source: "INTERIOR_HARNESS wall" },
  3: { label: "실내 벽(하네스) 3", role: "wall", note: "tileGroup 실내 벽", confidence: "medium", source: "INTERIOR_HARNESS wall" },
  31: { label: "실내 벽(하네스) 31", role: "wall", note: "tileGroup 실내 벽", confidence: "medium", source: "INTERIOR_HARNESS wall" },
  32: { label: "실내 벽(하네스) 32", role: "wall", note: "tileGroup 실내 벽", confidence: "medium", source: "INTERIOR_HARNESS wall" },
  33: { label: "실내 벽(하네스) 33", role: "wall", note: "tileGroup 실내 벽", confidence: "medium", source: "INTERIOR_HARNESS wall" },
  116: { label: "실내 구조/트림 (room-trim)", role: "building", note: "하네스 room-trim 단일 타일", confidence: "medium", source: "INTERIOR_HARNESS room-trim" },
  270: { label: "실내 바닥 A (하네스)", role: "floor", note: "하네스 floor 그룹. 이 맵은 72 사용", confidence: "high", source: "INTERIOR_HARNESS floor" },
  271: { label: "실내 바닥 B (하네스)", role: "floor", note: "하네스 floor", confidence: "high", source: "INTERIOR_HARNESS floor" },
  300: { label: "실내 바닥 C (하네스)", role: "floor", note: "하네스 floor", confidence: "high", source: "INTERIOR_HARNESS floor" },
  301: { label: "실내 바닥 D (하네스)", role: "floor", note: "하네스 floor", confidence: "high", source: "INTERIOR_HARNESS floor" },
};

// common upper props seen on map — generic drafts
const UPPER_DRAFTS: Record<number, Draft> = {
  59: { label: "투명 소품 (upper)", role: "prop", note: "transparent-props 그룹 추정", confidence: "low", source: "upper 사용" },
  114: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
  115: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
  148: { label: "투명 소품 (upper)", role: "prop", note: "의자/가구 추정", confidence: "low", source: "upper 사용" },
  178: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
  234: { label: "투명 소품 또는 캡 (upper 234)", role: "prop", note: "lower 멤버 234와 동일 ID 가능 — 레이어 확인 필요", confidence: "low", source: "upper 사용" },
  294: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
  295: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
  297: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
  298: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
  355: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
  356: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
  471: { label: "투명 소품 (upper)", role: "prop", note: "가구/장식 추정", confidence: "low", source: "upper 사용" },
};

const env = loadEnv();
const project = await loadProjectFromSupabase({
  url: (env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY || "",
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
if (!project) throw new Error("no project");
const map = project.maps.map_interior_blank;
if (!map) throw new Error("no map");
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

// sample cells per tile
const samples = new Map<number, Array<{ x: number; y: number; layer: "L" | "U" }>>();
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const L = map.lowerTiles[y * map.width + x]!;
    const U = map.upperTiles[y * map.width + x]!;
    if (!samples.has(L)) samples.set(L, []);
    if ((samples.get(L)!.length < 4)) samples.get(L)!.push({ x, y, layer: "L" });
    if (U >= 0) {
      if (!samples.has(U)) samples.set(U, []);
      const arr = samples.get(U)!;
      if (arr.filter((s) => s.layer === "U").length < 3) arr.push({ x, y, layer: "U" });
    }
  }
}

function draftFor(tile: number, layerHint: "L" | "U" | "both"): Draft {
  if (layerHint === "U" && UPPER_DRAFTS[tile]) return UPPER_DRAFTS[tile]!;
  if (DRAFTS[tile]) return DRAFTS[tile]!;
  if (UPPER_DRAFTS[tile]) return UPPER_DRAFTS[tile]!;
  const meta = ts.tileMeta?.[tile];
  if (meta?.label) {
    return {
      label: meta.label,
      role: meta.role ?? "?",
      note: meta.description || "tileMeta 기존 값",
      confidence: "low",
      source: `tileMeta source=${meta.source ?? "?"}`,
    };
  }
  return {
    label: `(미정) tile ${tile}`,
    role: "?",
    note: "맵/코드에서 의미 단서 부족 — 수정 필요",
    confidence: "low",
    source: "fallback",
  };
}

function confBadge(c: Draft["confidence"]): string {
  return `<span class="conf conf-${c}">${c}</span>`;
}

type Row = {
  tile: number;
  lowerN: number;
  upperN: number;
  flags: string[];
  draft: Draft;
  metaLabel: string;
};

const allTiles = new Set<number>([
  ...lowerCounts.keys(),
  ...upperCounts.keys(),
  ...(wall?.memberTileIds ?? []),
  INTERIOR_WALL_FRAME_FLOOR_TILE,
  INTERIOR_WALL_FRAME_TILES.cornerNW,
  1, 2, 3, 31, 32, 33, 116, 270, 271, 300, 301,
]);

const rows: Row[] = [...allTiles]
  .filter((t) => t >= 0)
  .sort((a, b) => a - b)
  .map((tile) => {
    const lowerN = lowerCounts.get(tile) ?? 0;
    const upperN = upperCounts.get(tile) ?? 0;
    const flags: string[] = [];
    if (members.has(tile)) flags.push("WF-member");
    if (connect.has(tile) && !members.has(tile)) flags.push("WF-connect");
    if (lowerN > 0) flags.push("on-lower");
    if (upperN > 0) flags.push("on-upper");
    if (lowerN === 0 && upperN === 0) flags.push("not-on-map");
    const layerHint: "L" | "U" | "both" =
      upperN > 0 && lowerN === 0 ? "U" : lowerN > 0 && upperN === 0 ? "L" : "both";
    const draft = draftFor(tile, layerHint);
    const meta = ts.tileMeta?.[tile];
    return {
      tile,
      lowerN,
      upperN,
      flags,
      draft,
      metaLabel: meta?.label?.trim() || "",
    };
  });

// prioritize map-used tiles first in sections
const onMap = rows.filter((r) => r.lowerN > 0 || r.upperN > 0);
const offMapMembers = rows.filter((r) => r.lowerN === 0 && r.upperN === 0 && r.flags.includes("WF-member"));
const offMapOther = rows.filter((r) => r.lowerN === 0 && r.upperN === 0 && !r.flags.includes("WF-member"));

function renderTable(list: Row[], id: string): string {
  const body = list
    .map((r) => {
      const pos = chipPos(r.tile);
      const samp = (samples.get(r.tile) ?? [])
        .map((s) => `${s.layer}(${s.x},${s.y})`)
        .join(" ");
      return `<tr data-tile="${r.tile}" class="conf-row-${r.draft.confidence}">
      <td class="sticky">${tileSprite(r.tile, 4)}</td>
      <td class="num">${r.tile}</td>
      <td class="num">(${pos.col},${pos.row})</td>
      <td>${r.lowerN}</td>
      <td>${r.upperN}</td>
      <td>${r.flags.map((f) => `<code class="flag">${escapeHtml(f)}</code>`).join(" ")}</td>
      <td class="label-cell">
        <div class="ai-label">${escapeHtml(r.draft.label)}</div>
        <div class="role">${escapeHtml(r.draft.role)} ${confBadge(r.draft.confidence)}</div>
      </td>
      <td class="note">${escapeHtml(r.draft.note)}<div class="src muted">근거: ${escapeHtml(r.draft.source)}</div>
        ${r.metaLabel ? `<div class="meta-existing muted">기존 tileMeta: ${escapeHtml(r.metaLabel)}</div>` : ""}
        ${samp ? `<div class="samp muted">샘플: ${escapeHtml(samp)}</div>` : ""}
      </td>
      <td class="user-edit">
        <input type="text" class="user-label" data-tile="${r.tile}" placeholder="여기에 수정 라벨…" />
        <textarea class="user-note" data-tile="${r.tile}" rows="2" placeholder="수정 설명(선택)"></textarea>
      </td>
    </tr>`;
    })
    .join("\n");

  return `<table id="${id}">
    <thead>
      <tr>
        <th>그래픽</th>
        <th>ID</th>
        <th>칩셋</th>
        <th>L×</th>
        <th>U×</th>
        <th>플래그</th>
        <th>AI 라벨 (초안)</th>
        <th>설명 / 근거</th>
        <th>사용자 수정</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

// map overview with labels on hover
const mapCells: string[] = [];
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const L = map.lowerTiles[y * map.width + x]!;
    const U = map.upperTiles[y * map.width + x]!;
    const d = draftFor(L, "L");
    const flags: string[] = [];
    if (members.has(L)) flags.push("m");
    if (L === 430) flags.push("v");
    if (connect.has(L) && !members.has(L)) flags.push("c");
    mapCells.push(`<div class="mcell ${flags.map((f) => "f-" + f).join(" ")}" title="(${x},${y}) L${L}=${d.label}${U >= 0 ? ` U${U}` : ""}">
      <div class="ms">${tileSprite(L, 2)}${U >= 0 ? `<span class="uo">${tileSprite(U, 2)}</span>` : ""}</div>
      <div class="mi">${L}</div>
    </div>`);
  }
}

const chipsetRel = "../../public/assets/easyrpg-chipset-interior-transparent.png";
const outDir = path.resolve("output/docs");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "interior-tile-label-review.html");
const generatedAt = new Date().toISOString();

// also dump JSON of drafts for easy patch-back later
const jsonPath = path.join(outDir, "interior-tile-label-draft.json");
const jsonPayload = {
  generatedAt,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
  mapId: "map_interior_blank",
  tilesetId: map.tilesetId,
  note: "AI draft labels — user will correct. No vision analysis.",
  tiles: rows.map((r) => ({
    tile: r.tile,
    chipset: chipPos(r.tile),
    lowerCount: r.lowerN,
    upperCount: r.upperN,
    flags: r.flags,
    draftLabel: r.draft.label,
    draftRole: r.draft.role,
    draftNote: r.draft.note,
    confidence: r.draft.confidence,
    source: r.draft.source,
    existingMetaLabel: r.metaLabel || null,
    userLabel: null as string | null,
    userNote: null as string | null,
  })),
};
fs.writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2), "utf8");

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>실내 타일 라벨 리뷰 (AI 초안 → 사용자 수정)</title>
<style>
  :root {
    --bg: #0e1117; --panel: #171b24; --text: #e8ecf4; --muted: #95a0b5;
    --accent: #7cb7ff; --border: #2c3344; --high: #3d9a5f; --med: #c9a227; --low: #c45c5c;
    --chip: url("${chipsetRel}");
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 22px 24px 80px; font: 14px/1.5 "Segoe UI","Malgun Gothic",system-ui,sans-serif; background: var(--bg); color: var(--text); }
  h1 { font-size: 1.35rem; margin: 0 0 8px; }
  h2 { font-size: 1.1rem; margin: 28px 0 10px; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  p, li { max-width: 70rem; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  .callout { background: #1a2230; border: 1px solid var(--border); border-left: 4px solid var(--accent); padding: 12px 14px; border-radius: 8px; margin: 12px 0 18px; max-width: 70rem; }
  .callout.warn { border-left-color: var(--med); background: #221c10; }
  .tile { display: inline-block; image-rendering: pixelated; background-image: var(--chip); background-repeat: no-repeat; border: 1px solid #000; vertical-align: middle; }
  .tile.empty { background: #333; }
  table { border-collapse: collapse; width: 100%; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; font-size: 13px; }
  th, td { border-bottom: 1px solid var(--border); padding: 7px 8px; vertical-align: top; text-align: left; }
  th { background: #1e2430; color: var(--muted); position: sticky; top: 0; z-index: 2; }
  td.sticky { position: sticky; left: 0; background: var(--panel); z-index: 1; }
  .num { font-family: ui-monospace, Consolas, monospace; }
  .ai-label { font-weight: 650; color: #f0f4ff; }
  .role { margin-top: 3px; font-size: 0.85rem; color: var(--muted); }
  .conf { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .conf-high { background: rgba(61,154,95,0.25); color: #8de0ad; }
  .conf-medium { background: rgba(201,162,39,0.22); color: #f0d878; }
  .conf-low { background: rgba(196,92,92,0.22); color: #ffb0b0; }
  .flag { display: inline-block; margin: 1px 2px; padding: 1px 5px; background: #243044; border-radius: 4px; font-size: 11px; }
  .user-label, .user-note { width: 100%; min-width: 140px; background: #0c0f14; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font: inherit; }
  .user-note { margin-top: 4px; resize: vertical; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 16px; align-items: center; }
  button { background: #2a6fdb; color: white; border: 0; border-radius: 8px; padding: 8px 12px; font-weight: 600; cursor: pointer; }
  button.secondary { background: #2c3344; }
  #export-box { width: 100%; min-height: 120px; background: #0c0f14; color: #cde; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
  .map-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 10px; padding: 6px; background: #0a0c10; }
  .map { display: grid; grid-template-columns: repeat(${map.width}, 44px); gap: 1px; width: max-content; }
  .mcell { background: #151922; border: 1px solid #2a3140; border-radius: 3px; padding: 1px; text-align: center; }
  .mcell.f-m { background: #152315; }
  .mcell.f-c { background: #132028; }
  .mcell.f-v { background: #121218; }
  .ms { position: relative; width: 32px; height: 32px; margin: 0 auto; }
  .ms .tile { width: 32px !important; height: 32px !important; }
  .uo { position: absolute; inset: 0; }
  .mi { font-size: 9px; font-family: ui-monospace, Consolas, monospace; color: var(--muted); }
  .legend span { margin-right: 12px; }
  code { font-family: ui-monospace, Consolas, monospace; }
</style>
</head>
<body>
  <h1>실내 타일 라벨 리뷰 — AI 초안</h1>
  <p class="muted">생성: ${escapeHtml(generatedAt)} · map <code>map_interior_blank</code> · tileset <code>${escapeHtml(map.tilesetId)}</code></p>
  <div class="callout warn">
    <strong>이 라벨은 전부 AI 추정입니다.</strong> 이미지 비전 분석 없이 코드 상수·오토타일 역할·맵 배치 패턴만 사용했습니다.
    틀린 칸은 오른쪽 <em>사용자 수정</em>에 올바른 이름을 적어 주세요. 아래 「수정 JSON 내보내기」로 모아서 주시면 반영하겠습니다.
  </div>
  <div class="callout">
    <strong>초안 근거 요약</strong>
    <ul>
      <li>벽프레임 기본 역할: body <code>105</code>, N/S/W/E <code>457/397/428/426</code>, corner <code>368</code>, floor connect <code>72</code></li>
      <li>맵 구조: 좌우 세로 프레임 + 상단 보 + 하단 문 홈 + 72 바닥 + 430 보이드</li>
      <li>확장 멤버(233/258/257…)·좌측 장식(18/20/48…)·upper 소품은 confidence low</li>
    </ul>
  </div>

  <div class="toolbar">
    <button type="button" id="btn-export">수정 JSON 내보내기</button>
    <button type="button" id="btn-copy" class="secondary">클립보드 복사</button>
    <span class="muted">localStorage에도 자동 저장됩니다.</span>
  </div>
  <textarea id="export-box" readonly placeholder="수정 후 내보내기 결과가 여기 표시됩니다."></textarea>

  <h2>1. 맵 개요 (lower 저장값 + upper 겹침)</h2>
  <p class="legend muted">
    <span>초록 톤 = wall-frame member</span>
    <span>청록 = connect(72)</span>
    <span>회색 = 430 void</span>
  </p>
  <div class="map-wrap"><div class="map">${mapCells.join("")}</div></div>

  <h2>2. 이 맵에서 쓰인 타일 (수정 우선)</h2>
  ${renderTable(onMap, "table-on-map")}

  <h2>3. 맵에 없지만 wall-frame 멤버인 타일</h2>
  ${renderTable(offMapMembers, "table-members-off")}

  <h2>4. 참고: 하네스 그룹 타일 (이 맵 미사용 가능)</h2>
  ${renderTable(offMapOther, "table-other")}

  <h2>5. 칩셋 전체</h2>
  <img src="${chipsetRel}" alt="Interior chipset" style="max-width:min(100%,720px);image-rendering:pixelated;border:1px solid var(--border);border-radius:8px;background:#000" width="480" />

  <script>
    const STORAGE_KEY = "rpgzzu-interior-tile-label-review-v1";
    function loadSaved() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
    }
    function saveAll() {
      const data = {};
      document.querySelectorAll(".user-label").forEach((el) => {
        const tile = el.getAttribute("data-tile");
        const note = document.querySelector('textarea.user-note[data-tile="' + tile + '"]');
        const label = el.value.trim();
        const n = (note && note.value.trim()) || "";
        if (label || n) data[tile] = { label, note: n };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
    function restore() {
      const data = loadSaved();
      for (const [tile, v] of Object.entries(data)) {
        const input = document.querySelector('input.user-label[data-tile="' + tile + '"]');
        const note = document.querySelector('textarea.user-note[data-tile="' + tile + '"]');
        if (input && v.label) input.value = v.label;
        if (note && v.note) note.value = v.note;
      }
    }
    function exportJson() {
      const corrections = saveAll();
      const payload = {
        mapId: "map_interior_blank",
        tilesetId: ${JSON.stringify(map.tilesetId)},
        correctedAt: new Date().toISOString(),
        corrections: Object.fromEntries(
          Object.entries(corrections).map(([tile, v]) => [tile, v])
        ),
      };
      const text = JSON.stringify(payload, null, 2);
      document.getElementById("export-box").value = text;
      return text;
    }
    document.getElementById("btn-export").onclick = exportJson;
    document.getElementById("btn-copy").onclick = async () => {
      const text = exportJson();
      try { await navigator.clipboard.writeText(text); alert("복사됨"); } catch { /* ignore */ }
    };
    document.querySelectorAll(".user-label, .user-note").forEach((el) => {
      el.addEventListener("change", saveAll);
      el.addEventListener("blur", saveAll);
    });
    restore();
  </script>
</body>
</html>
`;

fs.writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath);
console.log("wrote", jsonPath);
console.log("on-map tiles", onMap.length, "rows total", rows.length);
