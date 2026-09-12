/**
 * 집 전 범위 카탈로그 — "이 에디터로 어떤 집을 지을 수 있나"를 정본 코드로 전부 렌더한다.
 *
 * 경로를 속이지 않는다: 외장은 `author_house` 툴(runTool)을, 실내는 `createHouseInteriorMap`
 * 을, 울타리는 마을 파이프라인 정본 `placeHouseLotFences` 를 그대로 탄다. 그림이 곧 시공 결과다.
 *
 * 실행: npx tsx scripts/render-house-full-catalog.mts
 * 산출: output/evidence/house-full-catalog/*.png + catalog.json
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { ALL_HOUSE_KIT_IDS, HOUSE_KITS, MIXABLE_HOUSE_KIT_IDS, type HouseKitId } from "../src/editor/houseKit.ts";
import { HOUSE_TEMPLATE_DEFS } from "../src/project/defaults/houseTemplateCatalog.ts";
import { createEmptyToolProject, runTool } from "../src/editor/tools/index.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import type { GameMap, Project } from "../src/project/types.ts";

const T = 16;
const COLS = 30;
const GRASS = 240;
const OUT = path.resolve("output/evidence/house-full-catalog");
fs.mkdirSync(OUT, { recursive: true });

const chipTown = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));
const chipInterior = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png"));

export type CatalogEntry = {
  readonly file: string;
  readonly section: string;
  readonly title: string;
  readonly desc: string;
  readonly note?: string;
};

const entries: CatalogEntry[] = [];

function renderMap(map: GameMap, scale: number, chip: PNG, bg: readonly [number, number, number], tileset?: unknown): PNG {
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

function save(file: string, png: PNG): void {
  fs.writeFileSync(path.join(OUT, `${file}.png`), PNG.sync.write(png));
}

/** author_house 툴을 실제로 돌린다 — 시공·결과 요약·다양성 리포트까지 그대로 쓴다. */
function toolContext(width: number, height: number): { context: { project: Project }; mapId: string } {
  const project = createEmptyToolProject("집 카탈로그");
  const context = { project };
  const created = runTool(context, "create_map", { name: "카탈로그", width, height });
  if (!created.ok) throw new Error(`create_map 실패: ${created.summary}`);
  const mapId = Object.keys(context.project.maps)[0]!;
  context.project.maps[mapId]!.lowerTiles.fill(GRASS);
  context.project.maps[mapId]!.upperTiles.fill(-1);
  // 시작 좌표가 집에 덮이면 시공 뒤 "시작 위치 복원"이 보호 영역을 건드려 툴이 거부한다.
  // 집은 항상 여백 2칸 안쪽(x,y ≥ 2)에 서므로 (0,0) 잔디에 둔다.
  (context.project as { startPos: { x: number; y: number } }).startPos = { x: 0, y: 0 };
  return { context, mapId };
}

type HouseVariant = {
  readonly file: string;
  readonly section: string;
  readonly title: string;
  readonly desc: string;
  readonly kitId?: HouseKitId;
  readonly templateId?: string;
  readonly wings: readonly { x: number; y: number; w: number; h: number }[];
  readonly stories?: 1 | 2 | 3;
  readonly lowWall?: boolean;
  readonly windows?: { spacing?: number } | false;
  readonly chimney?: boolean;
  readonly roofDeck?: boolean;
  readonly scale?: number;
};

function bboxOf(wings: readonly { x: number; y: number; w: number; h: number }[]): { w: number; h: number } {
  return {
    w: Math.max(...wings.map((g) => g.x + g.w)),
    h: Math.max(...wings.map((g) => g.y + g.h)),
  };
}

function renderHouse(v: HouseVariant): void {
  const margin = 2;
  const { w, h } = bboxOf(v.wings);
  const mapW = w + margin * 2;
  const mapH = h + margin * 2;
  const { context, mapId } = toolContext(mapW, mapH);
  const wings = v.wings.map((g) => ({ x: g.x + margin, y: g.y + margin, w: g.w, h: g.h }));
  const sceneScale = v.scale ?? (Math.max(mapW, mapH) >= 20 ? 3 : 4);
  const result = runTool(context, "author_house", {
    kind: "single",
    mapId,
    ...(v.kitId ? { kitId: v.kitId } : {}),
    ...(v.templateId ? { templateId: v.templateId } : {}),
    ...(v.stories ? { stories: v.stories } : {}),
    ...(v.lowWall ? { lowWall: true } : {}),
    ...(v.windows !== undefined ? { windows: v.windows } : {}),
    ...(v.chimney ? { chimney: true } : {}),
    ...(v.roofDeck ? { roofDeck: true } : {}),
    wings,
    interior: "exterior-only",
    door: true,
    yard: [],
  });
  if (!result.ok) {
    console.error(`SKIP ${v.file}: ${result.summary}`);
    return;
  }
  save(v.file, renderMap(context.project.maps[mapId]!, sceneScale, chipTown, [64, 108, 74]));
  entries.push({ file: v.file, section: v.section, title: v.title, desc: v.desc, note: result.summary });
  console.log("rendered", v.file);
}

// ── A. 재질(킷) 6종 — 같은 9×8 몸체, 재료만 교체 ─────────────────────────────
for (const kitId of ALL_HOUSE_KIT_IDS) {
  renderHouse({
    file: `a-kit-${kitId}`,
    section: "kits",
    title: HOUSE_KITS[kitId].name,
    desc: `kitId: ${kitId} — 같은 몸체(9×8)에서 벽 재질과 지붕 페어만 바뀐다`,
    kitId,
    wings: [{ x: 0, y: 0, w: 9, h: 8 }],
  });
}

// ── B. 내장 형태 카탈로그 전종 — 한 채씩 실제 시공 ──────────────────────────
// 킷을 고정하지 않은 형태는 섞어 쓴다 — 같은 실루엣도 재료가 갈리는 걸 보여준다.
let kitCursor = 0;
for (const def of HOUSE_TEMPLATE_DEFS) {
  const kitForDef: HouseKitId = def.kitId ?? MIXABLE_HOUSE_KIT_IDS[kitCursor++ % MIXABLE_HOUSE_KIT_IDS.length]!;
  const marks: string[] = [`${def.w}×${def.h}`];
  if (def.stories && def.stories > 1) marks.push(`${def.stories}층`);
  if (def.lowWall) marks.push("낮은 벽");
  if (def.roofDeck) marks.push("옥상 데크");
  if (def.kitId) marks.push(`킷 고정 ${def.kitId}`);
  renderHouse({
    file: `b-shape-${def.id}`,
    section: "shapes",
    title: `${def.name} (${def.id})`,
    desc: `templateId: ${def.id} · ${marks.join(" · ")}`,
    kitId: kitForDef,
    templateId: def.id,
    wings: [{ x: 0, y: 0, w: def.w, h: def.h }],
    ...(def.stories ? { stories: def.stories } : {}),
    ...(def.lowWall ? { lowWall: true } : {}),
    ...(def.roofDeck ? { roofDeck: true } : {}),
  });
}

// ── C. 층수 · 낮은 벽 · 창문 · 굴뚝 · 옥상 데크 ─────────────────────────────
for (const [file, title, desc, extra] of [
  ["c-story-1", "1층 (벽 3행)", "stories: 1 — 벽 밴드 상·중·하 3행", { stories: 1 }],
  ["c-story-2", "2층 (벽 5행)", "stories: 2 — 창문 행이 층마다 하나씩", { stories: 2 }],
  ["c-story-3", "3층 (벽 7행)", "stories: 3 — 실내도 3층으로 따라간다", { stories: 3 }],
  ["c-lowwall", "낮은 벽 헛간", "lowWall: true — 중단 행 없음, 창문 자동 생략", { lowWall: true }],
  ["c-chimney", "굴뚝", "chimney: true — 우측 사선 지붕 위에 326", { chimney: true }],
  ["c-roofdeck", "옥상 데크", "roofDeck: true — 판자 데크 + 벽면 사다리(파랑 평지붕 전용)", { roofDeck: true }],
] as const) {
  renderHouse({
    file, section: "options", title, desc,
    kitId: (extra as { roofDeck?: boolean; lowWall?: boolean }).roofDeck ? "blue-stone" : "amber-wood",
    wings: [{ x: 0, y: 0, w: 9, h: (extra as { stories?: number }).stories === 3 ? 11 : (extra as { stories?: number }).stories === 2 ? 9 : 7 }],
    ...extra,
  });
}

for (const [file, title, desc, windows] of [
  ["c-win-0", "창문 spacing 0", "한 칸 걸러 전부 창", { spacing: 0 }],
  ["c-win-2", "창문 spacing 2 (기본)", "벽 2칸 간격", undefined],
  ["c-win-4", "창문 spacing 4", "드문 창", { spacing: 4 }],
  ["c-win-off", "창문 끔", "windows: false", false],
] as const) {
  renderHouse({
    file, section: "options", title, desc,
    kitId: "bright-plaster",
    wings: [{ x: 0, y: 0, w: 13, h: 7 }],
    ...(windows === undefined ? {} : { windows }),
  });
}

// ── D. 특수 지오메트리 · 복합 평면 · 농가 ───────────────────────────────────
renderHouse({
  file: "d-l-plan", section: "combos", title: "ㄱ자 2층 목조 홀",
  desc: "templateId: l + stories: 2 + timber-hall — 날개 합집합이 만드는 실루엣",
  kitId: "timber-hall", templateId: "l", stories: 2,
  wings: [{ x: 0, y: 0, w: 6, h: 8 }],
});
renderHouse({
  file: "d-u-mansion", section: "combos", title: "ㄷ자 2층 회벽 저택",
  desc: "templateId: u + stories: 2 + bright-plaster",
  kitId: "bright-plaster", templateId: "u", stories: 2,
  wings: [{ x: 0, y: 0, w: 8, h: 8 }],
});
renderHouse({
  file: "d-courtyard", section: "combos", title: "ㅁ자 중정 장원",
  desc: "templateId: courtyard — 안뜰을 둘러싼 회랑이 국소 규칙으로 완성된다",
  kitId: "blue-stone", templateId: "courtyard",
  wings: [{ x: 0, y: 0, w: 8, h: 12 }],
});

// ── E. 한 마을에 여러 채 — author_house kind=lots (다양성 실증) ─────────────
// 보호 영역이 겹치면 툴이 거부하므로 여백을 넉넉히(bbox+1 규칙) 잡는다.
{
  const { context, mapId } = toolContext(42, 30);
  const result = runTool(context, "author_house", {
    kind: "lots",
    mapId,
    seed: 7,
    houses: [
      { kitId: "blue-stone", templateId: "rect-2f", wings: [{ x: 1, y: 1, w: 7, h: 9 }], interior: "exterior-only", door: true, windows: {}, chimney: true, yard: [] },
      { kitId: "bright-plaster", templateId: "l", wings: [{ x: 11, y: 1, w: 6, h: 8 }], interior: "exterior-only", door: true, windows: {}, yard: [] },
      { kitId: "amber-wood", templateId: "t-porch", wings: [{ x: 20, y: 1, w: 8, h: 9 }], interior: "exterior-only", door: true, windows: {}, yard: [] },
      { kitId: "slate-wood", templateId: "barn-low", wings: [{ x: 31, y: 1, w: 6, h: 5 }], interior: "exterior-only", door: true, windows: {}, yard: [] },
      { kitId: "timber-hall", templateId: "u", wings: [{ x: 1, y: 14, w: 8, h: 8 }], interior: "exterior-only", door: true, windows: {}, yard: [] },
      { kitId: "amber-wood", templateId: "tier-front", wings: [{ x: 12, y: 14, w: 7, h: 12 }], interior: "exterior-only", door: true, windows: {}, yard: [] },
      { kitId: "blue-stone", templateId: "courtyard", wings: [{ x: 22, y: 13, w: 8, h: 12 }], interior: "exterior-only", door: true, windows: {}, yard: [] },
    ],
  });
  if (!result.ok) throw new Error(`village lots 실패: ${result.summary}`);
  save("e-village-lots", renderMap(context.project.maps[mapId]!, 3, chipTown, [64, 108, 74]));
  entries.push({
    file: "e-village-lots", section: "village", title: "한 마을에 7채 — 서로 다른 형태·재질",
    desc: "author_house kind=lots 한 번으로 7채 시공(2층·ㄱ자·T자 현관·헛간·ㄷ자·계단식 2층·ㅁ자 중정)", note: result.summary,
  });
  console.log("rendered e-village-lots");
}

// ── F. 앞마당 울타리 · 깃발 (마을 파이프라인 정본) ─────────────────────────
{
  const { placeHouseLotFences } = await import("../src/editor/tools/village/fences.ts");
  const { context, mapId } = toolContext(15, 14);
  const result = runTool(context, "author_house", {
    kind: "single", mapId, kitId: "blue-stone", wings: [{ x: 3, y: 3, w: 9, h: 8 }],
    interior: "exterior-only", door: true, yard: [], chimney: true,
  });
  if (!result.ok) throw new Error(result.summary);
  const map = context.project.maps[mapId]!;
  const doorAt = (result.data as { houses: readonly { doorAt: { x: number; y: number } | null }[] }).houses[0]!.doorAt!;
  placeHouseLotFences(map, [{
    bbox: { x: 3, y: 3, w: 9, h: 8 },
    doorAt,
    front: { x: doorAt.x, y: doorAt.y + 1 },
    kitId: "blue-stone",
    stories: 1,
    templateId: "rect-large",
  }], 7);
  save("f-yard-fence", renderMap(map, 4, chipTown, [64, 108, 74]));
  entries.push({
    file: "f-yard-fence", section: "village", title: "앞마당 울타리 + 굴뚝",
    desc: "placeHouseLotFences(마을 파이프라인 정본) — 둘레를 치고 문 앞에 게이트를 뚫는다",
  });
  console.log("rendered f-yard-fence");
}

// ── G. 안이 있는 집 — 실내 자동 생성(프로그램별) ────────────────────────────
const project = createBlankProject();
const interiorTileset = (project as { tilesets: Record<string, unknown> }).tilesets.easyrpg_chipset_interior;
if (!interiorTileset) throw new Error("interior tileset missing");

type InteriorVariant = {
  readonly file: string;
  readonly title: string;
  readonly desc: string;
  readonly seed: number;
  readonly ownerName: string;
  readonly kitId: HouseKitId;
  readonly stories: 1 | 2 | 3;
  readonly footprintArea: number;
  readonly renderFloor?: number;
};

const interiors: readonly InteriorVariant[] = [
  { file: "g-dwelling", title: "살림집 (dwelling)", desc: "침실·부엌·거실 자동 배치", seed: 10, ownerName: "밀라", kitId: "blue-stone", stories: 1, footprintArea: 20 },
  { file: "g-workshop", title: "공방 (workshop)", desc: "주인 이름에 '공방'이 들어가면 자동 선택", seed: 12, ownerName: "한스 공방", kitId: "slate-wood", stories: 1, footprintArea: 40 },
  { file: "g-shop", title: "상점 (shop)", desc: "'상점' → shop 프로그램", seed: 23, ownerName: "리코 상점", kitId: "bright-plaster", stories: 1, footprintArea: 50 },
  { file: "g-inn", title: "여관 (inn)", desc: "'여관' → inn 프로그램", seed: 37, ownerName: "떡갈나무 여관", kitId: "amber-wood", stories: 1, footprintArea: 52 },
  { file: "g-study", title: "서재 (study)", desc: "'학자' → study 프로그램", seed: 44, ownerName: "학자 세라", kitId: "timber-hall", stories: 1, footprintArea: 46 },
  { file: "g-manor-1f", title: "대저택 1층", desc: "'촌장' → manor, 2층 이상은 mansion 스케일(금벽)", seed: 41, ownerName: "촌장 로안", kitId: "blue-stone", stories: 2, footprintArea: 72 },
  { file: "g-manor-2f", title: "대저택 2층", desc: "1층과 같은 세로 복도 정본, 계단이 자동으로 이어진다", seed: 41, ownerName: "촌장 로안", kitId: "blue-stone", stories: 2, footprintArea: 72, renderFloor: 1 },
];

{
  const { createHouseInteriorMap } = await import("../src/editor/houseInteriors.ts");
  for (const iv of interiors) {
    const interior = createHouseInteriorMap({
      id: `map_cat_${iv.file}` as never,
      name: `${iv.ownerName}의 집 내부`,
      returnMapId: "map_catalog" as never,
      returnX: 5,
      returnY: 5,
      exitEventId: `ev_cat_exit_${iv.file}`,
      seed: iv.seed,
      exterior: { stories: iv.stories, kitId: iv.kitId, footprintArea: iv.footprintArea, ownerName: iv.ownerName },
    });
    const floor = interior.floors[iv.renderFloor ?? 0];
    if (!floor) throw new Error(`${iv.file}: floor missing`);
    const map = floor.map;
    save(iv.file, renderMap(map, map.width >= 26 ? 2 : 3, chipInterior, [20, 18, 24], interiorTileset));
    entries.push({
      file: iv.file, section: "interiors", title: iv.title, desc: iv.desc,
      note: `${map.width}×${map.height} · scale=${interior.scale} · program=${interior.program} · ${interior.stories}층`,
    });
    console.log("rendered", iv.file, map.width, map.height, interior.program);
  }
}

fs.writeFileSync(path.join(OUT, "catalog.json"), JSON.stringify(entries, null, 2));
console.log(`done — ${entries.length} cuts ->`, OUT);
