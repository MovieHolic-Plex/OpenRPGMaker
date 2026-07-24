/**
 * 집 다양성 전수 카탈로그 — 정본 houseKit(stampFootprintHouseKit)을 직접 실행해
 * 킷×평면×층수×창문×스케일 전 변형을 렌더하고, 내부 자동 생성까지 포함한
 * 이미지 리치 HTML 보고서를 생성한다.
 * 실행: npx tsx scripts/render-house-variety-catalog.mts
 * 산출: output/evidence/house-variety-catalog/*.png + docs/2026-07-20-house-variety-catalog.html
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import {
  HOUSE_KITS,
  stampFootprintHouseKit,
  type FootprintHousePlan,
  type FootprintWing,
  type HouseKitId,
} from "../src/editor/houseKit.ts";
import { createHouseInteriorMap } from "../src/editor/houseInteriors.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import type { GameMap } from "../src/project/types.ts";

const T = 16;
const COLS = 30;
const GRASS = 240;
const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;
const OUT = path.resolve("output/evidence/house-variety-catalog");
fs.mkdirSync(OUT, { recursive: true });

const chipTown = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));
const chipInterior = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png"));

function grassMap(w: number, h: number): GameMap {
  return {
    id: "map_house_catalog",
    name: "집 카탈로그",
    width: w,
    height: h,
    lowerTiles: new Array(w * h).fill(GRASS),
    upperTiles: new Array(w * h).fill(-1),
    events: [],
  } as unknown as GameMap;
}

function renderMap(map: GameMap, scale: number, chip: PNG, bg: [number, number, number], tileset?: unknown): PNG {
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = bg[0]; png.data[i + 1] = bg[1]; png.data[i + 2] = bg[2]; png.data[i + 3] = 255;
  }
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0);
    const sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T;
    const sh = q?.sh ?? T;
    for (let y = 0; y < sh * scale; y += 1) for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x;
    const lower = map.lowerTiles[i]!;
    const upper = map.upperTiles[i]!;
    const dx = x * T * scale;
    const dy = y * T * scale;
    const composition = tileset ? chipsetQuarterComposition(map, tileset as never, x, y) : null;
    if (composition) {
      blit(composition.underlayTile ?? lower, dx, dy);
      for (const src of composition.sources) {
        blit(src.tile, dx + src.offsetX * scale, dy + src.offsetY * scale, { sx: src.offsetX, sy: src.offsetY, sw: 8, sh: 8 });
      }
    } else if (lower >= 0) blit(lower, dx, dy);
    if (upper >= 0) blit(upper, dx, dy);
  }
  return png;
}

interface Variant {
  readonly file: string;
  readonly title: string;
  readonly caption: string;
  readonly kitId: HouseKitId;
  readonly wings: readonly FootprintWing[];
  readonly stories?: 1 | 2 | 3;
  readonly lowWall?: boolean;
  readonly windows?: { spacing?: number } | false;
  readonly door?: boolean; // 기본 true
  readonly margin?: number;
  readonly scale?: number;
  /** 같은 맵에 추가 시공(콤파운드). */
  readonly extra?: { readonly kitId: HouseKitId; readonly wings: readonly FootprintWing[]; readonly lowWall?: boolean };
}

const results: Record<string, { doorAt: string; size: string }> = {};

function buildVariant(v: Variant): void {
  const margin = v.margin ?? 2;
  const allWings = [...v.wings, ...(v.extra?.wings ?? [])];
  const w = Math.max(...allWings.map((g) => g.x + g.w)) + margin * 2;
  const h = Math.max(...allWings.map((g) => g.y + g.h)) + margin * 2;
  const map = grassMap(w, h);
  const shift = (wings: readonly FootprintWing[]): FootprintWing[] =>
    wings.map((g) => ({ x: g.x + margin, y: g.y + margin, w: g.w, h: g.h }));
  const plan: FootprintHousePlan = {
    wings: shift(v.wings),
    kitId: v.kitId,
    ...(v.stories ? { stories: v.stories } : {}),
    ...(v.lowWall ? { lowWall: true } : {}),
    ...(v.windows !== undefined ? { windows: v.windows } : {}),
  };
  const res = stampFootprintHouseKit(map, plan);
  if (!res.ok) throw new Error(`${v.file}: ${res.reason}`);
  if (v.door !== false && res.doorAt) {
    map.lowerTiles[(res.doorAt.y - 1) * map.width + res.doorAt.x] = DOOR_TOP;
    map.lowerTiles[res.doorAt.y * map.width + res.doorAt.x] = DOOR_BOTTOM;
  }
  if (v.extra) {
    const res2 = stampFootprintHouseKit(map, {
      wings: shift(v.extra.wings),
      kitId: v.extra.kitId,
      ...(v.extra.lowWall ? { lowWall: true } : {}),
    });
    if (!res2.ok) throw new Error(`${v.file} extra: ${res2.reason}`);
    if (res2.doorAt) {
      map.lowerTiles[(res2.doorAt.y - 1) * map.width + res2.doorAt.x] = DOOR_TOP;
      map.lowerTiles[res2.doorAt.y * map.width + res2.doorAt.x] = DOOR_BOTTOM;
    }
  }
  const scale = v.scale ?? (w >= 22 ? 3 : 4);
  const png = renderMap(map, scale, chipTown, [64, 108, 74]);
  fs.writeFileSync(path.join(OUT, `${v.file}.png`), PNG.sync.write(png));
  results[v.file] = { doorAt: res.doorAt ? `(${res.doorAt.x},${res.doorAt.y})` : "없음", size: `${w - margin * 2}×${h - margin * 2}` };
  console.log("rendered", v.file);
}

// ── A. 킷 6종 — 같은 몸체(9×8), 재질만 교체 ──────────────────────────────────
const KIT_ORDER: HouseKitId[] = ["blue-stone", "bright-plaster", "amber-wood", "slate-wood", "timber-hall", "aframe-stone"];
const variants: Variant[] = KIT_ORDER.map((kitId) => ({
  file: `a-kit-${kitId}`,
  title: HOUSE_KITS[kitId].name,
  caption: "",
  kitId,
  wings: [{ x: 0, y: 0, w: 9, h: 8 }],
}));

// ── B. 평면 문법 — 날개 합집합이 만드는 8가지 평면 (킷 고정 blue-stone) ─────
variants.push(
  { file: "b-plan-long", title: "가로 롱하우스", caption: "단일 날개 15×7", kitId: "blue-stone", wings: [{ x: 0, y: 0, w: 15, h: 7 }] },
  { file: "b-plan-tower", title: "세로 타워", caption: "단일 날개 5×12 — 남는 높이가 전부 지붕", kitId: "blue-stone", wings: [{ x: 0, y: 0, w: 5, h: 12 }] },
  { file: "b-plan-l", title: "ㄱ자 (L)", caption: "날개 2개 합집합", kitId: "blue-stone", wings: [{ x: 0, y: 0, w: 6, h: 12 }, { x: 0, y: 5, w: 14, h: 7 }] },
  { file: "b-plan-t", title: "T자", caption: "날개 2개 — 중앙 몸체+가로 바", kitId: "blue-stone", wings: [{ x: 4, y: 0, w: 6, h: 12 }, { x: 0, y: 5, w: 14, h: 7 }] },
  { file: "b-plan-u", title: "ㄷ자 (U)", caption: "날개 3개 — 양 다리+상단 바", kitId: "blue-stone", wings: [{ x: 0, y: 0, w: 5, h: 12 }, { x: 9, y: 0, w: 5, h: 12 }, { x: 0, y: 0, w: 14, h: 7 }] },
  { file: "b-plan-cross", title: "십자 (+)", caption: "날개 2개 직교", kitId: "blue-stone", wings: [{ x: 4, y: 0, w: 6, h: 14 }, { x: 0, y: 4, w: 14, h: 6 }] },
  { file: "b-plan-o", title: "ㅁ자 (중정)", caption: "날개 4개 링 — 안뜰을 둘러싼 회랑", kitId: "blue-stone", wings: [{ x: 0, y: 0, w: 16, h: 6 }, { x: 0, y: 0, w: 5, h: 16 }, { x: 11, y: 0, w: 5, h: 16 }, { x: 0, y: 10, w: 16, h: 6 }] },
  { file: "b-plan-z", title: "Z자 (엇갈림)", caption: "날개 2개 대각 오프셋", kitId: "blue-stone", wings: [{ x: 0, y: 0, w: 9, h: 6 }, { x: 4, y: 3, w: 9, h: 9 }] },
);

// ── C. 층수·헛간 — 엔진 계층(stories·lowWall) ───────────────────────────────
variants.push(
  { file: "c-story-1", title: "1층 (벽 3행)", caption: "", kitId: "amber-wood", wings: [{ x: 0, y: 0, w: 9, h: 7 }], stories: 1 },
  { file: "c-story-2", title: "2층 (벽 5행)", caption: "", kitId: "amber-wood", wings: [{ x: 0, y: 0, w: 9, h: 9 }], stories: 2 },
  { file: "c-story-3", title: "3층 (벽 7행)", caption: "", kitId: "amber-wood", wings: [{ x: 0, y: 0, w: 9, h: 11 }], stories: 3 },
  { file: "c-lowwall", title: "낮은 벽 헛간", caption: "lowWall — 중단 없음·창 없음", kitId: "amber-wood", wings: [{ x: 0, y: 0, w: 8, h: 5 }], lowWall: true },
);

// ── D. 창문 옵션 ─────────────────────────────────────────────────────────────
variants.push(
  { file: "d-win-0", title: "spacing 0 — 전면 유리", caption: "", kitId: "bright-plaster", wings: [{ x: 0, y: 0, w: 13, h: 7 }], windows: { spacing: 0 } },
  { file: "d-win-2", title: "spacing 2 — 기본", caption: "", kitId: "bright-plaster", wings: [{ x: 0, y: 0, w: 13, h: 7 }] },
  { file: "d-win-4", title: "spacing 4 — 드문 창", caption: "", kitId: "bright-plaster", wings: [{ x: 0, y: 0, w: 13, h: 7 }], windows: { spacing: 4 } },
  { file: "d-win-off", title: "창문 끔", caption: "", kitId: "bright-plaster", wings: [{ x: 0, y: 0, w: 13, h: 7 }], windows: false },
);

// ── E. 스케일·지붕 지오메트리 ────────────────────────────────────────────────
variants.push(
  { file: "e-min", title: "최소 집 3×5", caption: "폭 3 = 좌·중·우 모서리만", kitId: "blue-stone", wings: [{ x: 0, y: 0, w: 3, h: 5 }], scale: 6 },
  { file: "e-wide", title: "대형 19×9", caption: "", kitId: "slate-wood", wings: [{ x: 0, y: 0, w: 19, h: 9 }] },
  { file: "e-tallroof", title: "높은 지붕 7×12", caption: "벽 3행 고정 — 나머지 9행이 전부 지붕", kitId: "blue-stone", wings: [{ x: 0, y: 0, w: 7, h: 12 }] },
  { file: "e-aframe-5", title: "A자 폭 5", caption: "h=6 강제", kitId: "aframe-stone", wings: [{ x: 0, y: 0, w: 5, h: 6 }], scale: 6 },
  { file: "e-aframe-7", title: "A자 폭 7", caption: "h=7 강제", kitId: "aframe-stone", wings: [{ x: 0, y: 0, w: 7, h: 7 }], scale: 5 },
  { file: "e-aframe-11", title: "A자 폭 11", caption: "h=9 강제", kitId: "aframe-stone", wings: [{ x: 0, y: 0, w: 11, h: 9 }] },
  { file: "e-aframe-13", title: "A자 폭 13", caption: "h=10 강제", kitId: "aframe-stone", wings: [{ x: 0, y: 0, w: 13, h: 10 }] },
);

// ── F. 조합 실증 — 축들을 곱하면 ────────────────────────────────────────────
variants.push(
  { file: "f-l2-timber", title: "2층 ㄱ자 목조 홀", caption: "timber-hall × L평면 × stories 2 × spacing 3", kitId: "timber-hall", wings: [{ x: 0, y: 0, w: 6, h: 14 }, { x: 0, y: 7, w: 14, h: 7 }], stories: 2, windows: { spacing: 3 } },
  { file: "f-u2-plaster", title: "2층 ㄷ자 회벽 저택", caption: "bright-plaster × U평면 × stories 2", kitId: "bright-plaster", wings: [{ x: 0, y: 0, w: 5, h: 14 }, { x: 10, y: 0, w: 5, h: 14 }, { x: 0, y: 0, w: 15, h: 8 }], stories: 2 },
  { file: "f-court-manor", title: "중정 장원", caption: "blue-stone × ㅁ평면 16×16", kitId: "blue-stone", wings: [{ x: 0, y: 0, w: 16, h: 6 }, { x: 0, y: 0, w: 5, h: 16 }, { x: 11, y: 0, w: 5, h: 16 }, { x: 0, y: 10, w: 16, h: 6 }] },
  {
    file: "f-farm-compound", title: "농가 콤파운드", caption: "본채 amber-wood + 헛간 slate-wood lowWall — 한 맵에 킷 혼합",
    kitId: "amber-wood", wings: [{ x: 0, y: 0, w: 10, h: 8 }],
    extra: { kitId: "slate-wood", wings: [{ x: 12, y: 3, w: 6, h: 5 }], lowWall: true },
  },
);

for (const v of variants) buildVariant(v);

// ── H. 장식 실증 — 마을 파이프라인의 울타리/깃발 문법 + 굴뚝(어휘만) ─────────
{
  const { placeHouseLotFences } = await import("../src/editor/tools/village/fences.ts");
  // H1: 단독 집 + 앞마당 울타리(게이트) + 깃발 208/209 + 굴뚝 326(수동 — 시공 코드 미채택)
  const m1 = grassMap(15, 14);
  const wing = { x: 3, y: 3, w: 9, h: 8 };
  const r1 = stampFootprintHouseKit(m1, { wings: [wing], kitId: "blue-stone" });
  if (!r1.ok || !r1.doorAt) throw new Error("h-decor-single 시공 실패");
  m1.lowerTiles[(r1.doorAt.y - 1) * m1.width + r1.doorAt.x] = DOOR_TOP;
  m1.lowerTiles[r1.doorAt.y * m1.width + r1.doorAt.x] = DOOR_BOTTOM;
  // 깃발: 지붕 바로 아래 최상단 벽 행, 문 양옆 (village/decor.ts:393 문법)
  const wallTopY = wing.y + wing.h - 3;
  m1.upperTiles[wallTopY * m1.width + (r1.doorAt.x - 1)] = 208;
  m1.upperTiles[wallTopY * m1.width + (r1.doorAt.x + 1)] = 209;
  // 굴뚝 326: 지붕 우측 사선 위(어휘 정의 그대로) — 시공 코드는 아직 안 놓는다
  m1.upperTiles[(wing.y + 1) * m1.width + (wing.x + wing.w - 1)] = 326;
  placeHouseLotFences(m1, [{
    bbox: { x: wing.x, y: wing.y, w: wing.w, h: wing.h },
    doorAt: r1.doorAt,
    front: { x: r1.doorAt.x, y: r1.doorAt.y + 1 },
    kitId: "blue-stone",
    stories: 1,
    templateId: "single",
  }], 7);
  fs.writeFileSync(path.join(OUT, "h-decor-single.png"), PNG.sync.write(renderMap(m1, 4, chipTown, [64, 108, 74])));
  results["h-decor-single"] = { doorAt: `(${r1.doorAt.x},${r1.doorAt.y})`, size: "9×8+장식" };
  console.log("rendered h-decor-single");

  // H2: 농가 콤파운드 + estate 둘레 울타리(본채+헛간을 한 필지로)
  const m2 = grassMap(22, 13);
  const main = { x: 2, y: 2, w: 10, h: 8 };
  const barn = { x: 14, y: 5, w: 6, h: 5 };
  const r2 = stampFootprintHouseKit(m2, { wings: [main], kitId: "amber-wood" });
  if (!r2.ok || !r2.doorAt) throw new Error("h-decor-estate 본채 실패");
  m2.lowerTiles[(r2.doorAt.y - 1) * m2.width + r2.doorAt.x] = DOOR_TOP;
  m2.lowerTiles[r2.doorAt.y * m2.width + r2.doorAt.x] = DOOR_BOTTOM;
  const r2b = stampFootprintHouseKit(m2, { wings: [barn], kitId: "slate-wood", lowWall: true });
  if (!r2b.ok) throw new Error("h-decor-estate 헛간 실패");
  placeHouseLotFences(m2, [{
    bbox: { x: main.x, y: main.y, w: barn.x + barn.w - main.x, h: Math.max(main.y + main.h, barn.y + barn.h) - main.y },
    doorAt: r2.doorAt,
    front: { x: r2.doorAt.x, y: r2.doorAt.y + 1 },
    kitId: "amber-wood",
    stories: 1,
    templateId: "estate-farm",
  }], 11);
  fs.writeFileSync(path.join(OUT, "h-decor-estate.png"), PNG.sync.write(renderMap(m2, 4, chipTown, [64, 108, 74])));
  results["h-decor-estate"] = { doorAt: `(${r2.doorAt.x},${r2.doorAt.y})`, size: "본채+헛간 estate 필지" };
  console.log("rendered h-decor-estate");
}

// ── G. 내부 자동 생성 ────────────────────────────────────────────────────────
const project = createBlankProject();
const interiorTileset = (project as { tilesets: Record<string, unknown> }).tilesets.easyrpg_chipset_interior;
if (!interiorTileset) throw new Error("interior tileset missing");

interface InteriorVariant {
  readonly file: string;
  readonly title: string;
  readonly seed: number;
  readonly ownerName: string;
  readonly kitId: HouseKitId;
  readonly stories: 1 | 2 | 3;
  readonly footprintArea: number;
  readonly renderFloor?: number; // floors 인덱스(기본 0)
}
const interiors: InteriorVariant[] = [
  { file: "g-dwelling", title: "살림집", seed: 10, ownerName: "밀라", kitId: "blue-stone", stories: 1, footprintArea: 20 },
  { file: "g-workshop", title: "공방", seed: 12, ownerName: "한스 공방", kitId: "slate-wood", stories: 1, footprintArea: 40 },
  { file: "g-shop", title: "상점 (cottage3)", seed: 23, ownerName: "리코 상점", kitId: "bright-plaster", stories: 1, footprintArea: 50 },
  { file: "g-inn", title: "여관 (cottage3)", seed: 37, ownerName: "떡갈나무 여관", kitId: "amber-wood", stories: 1, footprintArea: 52 },
  { file: "g-mansion-1f", title: "대저택 1층 (mansion·금벽)", seed: 41, ownerName: "촌장 로안", kitId: "blue-stone", stories: 2, footprintArea: 72 },
  { file: "g-mansion-2f", title: "대저택 2층 (자동 계단 연결)", seed: 41, ownerName: "촌장 로안", kitId: "blue-stone", stories: 2, footprintArea: 72, renderFloor: 1 },
];
const interiorMeta: Record<string, string> = {};
for (const iv of interiors) {
  const interior = createHouseInteriorMap({
    id: `map_cat_${iv.file}` as never,
    name: `${iv.ownerName}의 집 내부`,
    returnMapId: "map_house_catalog" as never,
    returnX: 5,
    returnY: 5,
    exitEventId: `ev_cat_exit_${iv.file}`,
    seed: iv.seed,
    exterior: { stories: iv.stories, kitId: iv.kitId, footprintArea: iv.footprintArea, ownerName: iv.ownerName },
  });
  const floor = interior.floors[iv.renderFloor ?? 0];
  if (!floor) throw new Error(`${iv.file}: floor missing`);
  const map = floor.map;
  const scale = map.width >= 26 ? 2 : 3;
  const png = renderMap(map, scale, chipInterior, [20, 18, 24], interiorTileset);
  fs.writeFileSync(path.join(OUT, `${iv.file}.png`), PNG.sync.write(png));
  interiorMeta[iv.file] = `${map.width}×${map.height} · scale=${interior.scale} · program=${interior.program} · ${interior.stories}층`;
  console.log("rendered", iv.file, interiorMeta[iv.file]);
}

// ── 10×10 실내 스탬프(천장 정본 전개) ────────────────────────────────────────
{
  const { stampInteriorHouse10x10 } = await import("../src/editor/interiorStructureStamp.ts");
  const map = {
    id: "map_stamp_demo",
    name: "스탬프",
    width: 14,
    height: 14,
    tilesetId: "easyrpg_chipset_interior",
    lowerTiles: new Array(14 * 14).fill(430),
    upperTiles: new Array(14 * 14).fill(-1),
    events: [],
  } as unknown as GameMap;
  stampInteriorHouse10x10(map, { x: 2, y: 2 });
  const png = renderMap(map, 4, chipInterior, [20, 18, 24], interiorTileset);
  fs.writeFileSync(path.join(OUT, "g-stamp-10x10.png"), PNG.sync.write(png));
  interiorMeta["g-stamp-10x10"] = "10×10 실내 스탬프 — 천장 정본 전개(planInteriorHouseWalls 직접 호출)";
  console.log("rendered g-stamp-10x10");
}

fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ results, interiorMeta }, null, 2));
console.log("done ->", OUT);
