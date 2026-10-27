// editor/tools/mapVariantLook.ts
// derive_map_variant 의 「시대 겉모습」 — 같은 지리의 변형 맵이 눈으로 구별되게 한다.
//
// 왜: jrpg-real-1 J03 에서 과거·미래·붕괴 후 세계 맵이 현재 맵과 타일 한 칸도 다르지 않았다(복제만 하고 지형 편집을 안 함,
// 날씨만 바뀌었는데 안개도 거의 안 보였다). 이제 변형 한 칸마다 시대별 프리셋을 자동으로 건다 — 새 그림 없이 기존 칩셋 조각만 쓴다.
//  ① 분위기: 맵 조명(색조·어둡기)과 안개 — 칩셋과 무관하게 항상 먹는다.
//  ② 건물 철거: 마을을 지을 때 기록된 건물 배치(structurePlacements)의 일부를 원래 땅으로 되돌리고(찍기 전 타일 복원),
//     그 자리에 칩셋에 이미 있는 폐허·야영·유물 킷 조각을 흩뿌린다. 킷이 없는 칩셋이면 ①만 한다.
// `look` 은 "ruin"(붕괴·폐허) | "past"(과거) | "future"(미래) | "burned"(불탄 마을) | "none"(끔). 생략하면 era·name·id 낱말로 고른다.
// burned 는 집 자리·길을 그대로 두고 집마다 잿빛 바닥·숯 기둥·무너진 서까래·숯더미·불씨로 바꾸며, 둘레만 그을린다
// (ruin 은 신전 폐허 조각을 깔아 「불탄 민가」가 아니라 「고대 유적」으로 읽혔다 — 폴른 스타 2막 B5).
// keepIntact 는 어느 시대든 건물 한 채를 철거에서 뺀다(방위 north|south|east|west|center 또는 "x,y").
// 조수가 준 tileRemap·tileOverrides 는 이 프리셋 뒤에 적용되므로 항상 이긴다.

import { BEODEUL_NATURE } from "@/project/defaults/beodeulNature";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { appendStructurePlacement, captureStructureTiles, removeStructurePlacement, restoreStructurePlacementTiles, structurePlacementsOf } from "@/project/structurePlacements";
import type { GameEvent, GameMap, Project, SectionStructureKitDef } from "@/project/types";
import { applyVariantTerrain, type VariantTerrainReport } from "./mapVariantTerrain";

export const VARIANT_LOOKS = ["ruin", "past", "future", "burned"] as const;
export type VariantLook = (typeof VARIANT_LOOKS)[number];

type LookSpec = {
  readonly label: string;
  /** 철거할 건물 비율(0~1). */
  readonly demolishRatio: number;
  /** 철거한 건물 자리 하나에 흩뿌릴 조각 수 [최소, 최대]. */
  readonly stampsPerSite: readonly [number, number];
  /** 어둡기(0~1, 클수록 어둡다)와 색조. */
  readonly ambient: number;
  readonly color: string;
  /** 안개를 깔 때만. */
  readonly fog?: number;
  /** 대형 건물 철거 자리에 먼저 놓을 시대 랜드마크 킷(칩셋에 있는 것만 쓴다). */
  readonly landmarkIds: readonly string[];
  /** 랜드마크를 놓을 철거 자리 수 상한. 과거는 철거한 집마다 오두막을 세워 「옛 마을」로 읽히게 한다. */
  readonly maxLandmarks: number;
  /** 흩뿌릴 킷(칩셋에 있는 것만 쓴다). */
  readonly kitIds: readonly string[];
  /** "burned" 면 철거 자리를 흩뿌리기 대신 불탄 집터(잿빛 바닥·숯 기둥·서까래·숯더미)로 꾸민다. */
  readonly site?: "burned";
};

const LOOKS: Readonly<Record<VariantLook, LookSpec>> = {
  ruin: {
    label: "붕괴·폐허",
    demolishRatio: 1,
    stampsPerSite: [5, 8],
    ambient: 0.52,
    color: "#3a2016",
    fog: 0.35,
    maxLandmarks: 3,
    landmarkIds: [
      "bd-pick-temple-ruins-naiskos-pediment", "bd-pick-temple-ruins-ruined-wall-2",
      "bd-pick-temple-ruins-fallen-column-temple", "bd-pick-castle-catacombs-rubble",
    ],
    kitIds: [
      "bd-pick-temple-ruins-rubble-temple", "bd-pick-aqueduct-sewer-rubble", "bd-pick-castle-catacombs-rubble",
      "bd-pick-temple-ruins-fallen-column-temple", "bd-pick-temple-ruins-column-temple-broken", "bd-pick-shipwreck-reef-plank-pile",
      "bd-pick-temple-ruins-ruined-wall-2", "bd-pick-aqueduct-sewer-column-sewer-broken", "bd-pick-shipwreck-reef-broken-barrel",
    ],
  },
  past: {
    label: "과거",
    demolishRatio: 1,
    stampsPerSite: [2, 4],
    ambient: 0.3,
    color: "#c0701a",
    fog: 0.25,
    maxLandmarks: 12,
    landmarkIds: [
      "bd-out-cabin", "bd-out-cabin-small", "bd-out-woodshed", "bd-pick-deep-forest-path-campfire",
    ],
    kitIds: [
      "bd-pick-deep-forest-path-campfire", "bd-pick-deep-forest-path-cairn", "bd-pick-deep-forest-path-cairn-s",
      "bd-pick-desert-oasis-rock", "bd-pick-coast-cliff-road-heath-a", "bd-pick-coast-cliff-road-heath-b", "bd-pick-deep-forest-path-stones-a",
    ],
  },
  future: {
    label: "미래",
    demolishRatio: 0.65,
    stampsPerSite: [2, 4],
    ambient: 0.56,
    color: "#0c2c70",
    maxLandmarks: 3,
    landmarkIds: [
      "bd-pick-wizard-tower-glass-dome", "bd-pick-wizard-tower-moon-obelisk", "bd-pick-wizard-tower-armillary",
    ],
    kitIds: [
      "bd-pick-volcano-cave-fire-crystal", "bd-pick-wizard-tower-moon-obelisk", "bd-pick-snowfield-lamp",
      "bd-pick-wizard-tower-armillary", "bd-pick-aqueduct-sewer-lantern-post",
    ],
  },
  burned: {
    label: "불탄 마을",
    demolishRatio: 1,
    stampsPerSite: [0, 0],
    ambient: 0.4,
    color: "#2e2219",
    maxLandmarks: 0,
    landmarkIds: [],
    kitIds: [],
    site: "burned",
  },
};

/** 불탄 집터 꾸밈 조각 — 모두 버들항 칩셋에 이미 있는 조각(새 그림 없음). */
const BURNED_SITE = {
  /** 집터 안 — 어두운 광재(숯·재). 둘레(그을린 흙)와 색이 달라 집 자리 모양이 읽힌다. */
  floor: "bd-pick-mining-valley-ground-slagg",
  floorPatches: ["bd-pick-mining-valley-ground-yard"],
  /** 집터 테두리 — 무너진 주춧돌·기단 자국. */
  rim: "bd-pick-mining-valley-ground-rock",
  /** 숯 기둥 그루터기(1×2) — 집터 네 귀퉁이와 앞면 가운데. */
  posts: ["bd-pick-volcano-cave-pillar-broken-a", "bd-pick-volcano-cave-pillar-broken-b"],
  /** 내려앉은 지붕 서까래(선 채 남은 들보 한 쌍). */
  frames: ["bd-pick-shipwreck-reef-rib-small"],
  /** 무너진 지붕 더미 — 숯더미·탄 판자·쓰러진 탄 들보. */
  heaps: ["bd-pick-volcano-cave-coal-pile", "bd-pick-shipwreck-reef-plank-pile", "bd-pick-volcano-cave-pillar-fallen"],
  /** 재·불씨·부스러기(통행 가능한 1칸). */
  bits: ["bd-pick-volcano-cave-ember-a", "bd-pick-mountain-pass-scree-a", "bd-pick-mountain-pass-scree-b", "bd-pick-aqueduct-sewer-rubble", "bd-pick-shipwreck-reef-broken-barrel"],
} as const;

/** 집터 둘레 그을림 폭(칸). 1칸은 늘, 2·3칸은 얼룩으로. */
const SCORCH_RADIUS = 3;
const SCORCH_CHANCE = [100, 100, 45, 15] as const;

export const KEEP_INTACT_SIDES = ["north", "south", "east", "west", "center"] as const;
export type KeepIntact = (typeof KEEP_INTACT_SIDES)[number] | { readonly x: number; readonly y: number };

/** keepIntact 인자 해석 — 잘못된 값은 오류 문자열. */
export function parseKeepIntact(raw: unknown): KeepIntact | undefined | { readonly error: string } {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw === "string" && (KEEP_INTACT_SIDES as readonly string[]).includes(raw)) return raw as KeepIntact;
  const point = typeof raw === "string" ? /^\s*(\d+)\s*,\s*(\d+)\s*$/u.exec(raw) : null;
  if (point) return { x: Number(point[1]), y: Number(point[2]) };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const { x, y, ...rest } = raw as Record<string, unknown>;
    if (Object.keys(rest).length === 0 && Number.isInteger(x) && Number.isInteger(y)) return { x: x as number, y: y as number };
  }
  return { error: `keepIntact 는 ${KEEP_INTACT_SIDES.join("|")} 또는 "x,y"(그 칸을 덮거나 가장 가까운 건물)여야 합니다(받은 값: ${JSON.stringify(raw)}).` };
}

const BURNED_WORDS = /burn|scorch|charred|ashes|불탄|불타|불에 탄|화재|잿더미|소실|전소|그을린/iu;
const RUIN_WORDS = /ruin|collaps|devast|wreck|destroy|apocal|폐허|붕괴|잔해|황폐|파멸|멸망|몰락|파괴/iu;
const PAST_WORDS = /past|ancient|medieval|prehistor|primitive|과거|고대|옛날|옛 |선사|원시|중세|태고/iu;
const FUTURE_WORDS = /future|futur|미래|근미래|서기 ?\d{4}/iu;

/** `look` 인자 해석. undefined 면 era·name·id 낱말로 고른다(해당 없으면 null = 프리셋 없음). 잘못된 값은 오류 문자열. */
export function resolveVariantLook(raw: { readonly look?: unknown; readonly era?: unknown; readonly name?: unknown; readonly id?: unknown }): VariantLook | null | { readonly error: string } {
  if (raw.look !== undefined && raw.look !== null && raw.look !== "") {
    if (raw.look === "none") return null;
    if ((VARIANT_LOOKS as readonly unknown[]).includes(raw.look)) return raw.look as VariantLook;
    return { error: `look 은 ${[...VARIANT_LOOKS, "none"].join("|")} 중 하나여야 합니다(받은 값: ${String(raw.look)}).` };
  }
  const text = [raw.era, raw.name, raw.id].filter((part): part is string => typeof part === "string").join(" ");
  if (BURNED_WORDS.test(text)) return "burned";
  if (RUIN_WORDS.test(text)) return "ruin";
  if (FUTURE_WORDS.test(text)) return "future";
  if (PAST_WORDS.test(text)) return "past";
  return null;
}

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 시드 고정 난수(mulberry32) — 같은 변형 id 는 언제나 같은 철거·배치가 나온다. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOT_A_BUILDING = /bonfire|bench|lamp|tree|well|fountain|bridge|gate|fence|stair|rock|stone|shrine-path|campfire/iu;

function isTransferDoor(event: GameEvent): boolean {
  const visit = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(visit);
    if (!node || typeof node !== "object") return false;
    const record = node as Record<string, unknown>;
    if (record.kind === "transfer") return true;
    return Object.values(record).some(visit);
  };
  return visit(event.pages ?? []) || visit(event.commands ?? []);
}

function isWaterCell(map: GameMap, tileset: { readonly tileMeta?: Readonly<Record<number, { readonly tags?: readonly string[] } | undefined>> } | undefined, index: number): boolean {
  const tile = map.lowerTiles[index];
  return tile !== undefined && tile >= 0 && (tileset?.tileMeta?.[tile]?.tags ?? []).includes("water");
}

function eventAt(map: GameMap, x: number, y: number): GameEvent | undefined {
  return map.events.find((event) => event.x === x && event.y === y);
}

export type VariantLookReport = {
  look: VariantLook;
  label: string;
  lighting: { ambient: number; color: string };
  fog?: number;
  demolishedBuildings: number;
  /** burned: 집보다 작은 구조물(노점·헛간 등) 철거 수. */
  demolishedStructures?: number;
  stampedPieces: number;
  removedDoorEvents: string[];
  note?: string;
  /** 맵 전체 바닥·길·숲 시대 팔레트(버들항 칩셋에서만). burned 는 집터 둘레만. */
  terrain?: VariantTerrainReport;
  /** keepIntact 로 철거에서 뺀 건물. */
  keptIntact?: { kitId: string; x: number; y: number; w: number; h: number };
};

type Placement = ReturnType<typeof structurePlacementsOf>[number];

function pickKeptBuilding(buildings: readonly Placement[], keep: KeepIntact, map: GameMap): Placement | undefined {
  if (buildings.length === 0) return undefined;
  const cx = (p: Placement) => p.x + p.w / 2;
  const cy = (p: Placement) => p.y + p.h / 2;
  const best = (score: (p: Placement) => number) => [...buildings].sort((a, b) => score(a) - score(b) || a.y - b.y || a.x - b.x)[0];
  if (typeof keep === "object") {
    const covering = buildings.find((p) => keep.x >= p.x && keep.y >= p.y && keep.x < p.x + p.w && keep.y < p.y + p.h);
    return covering ?? best((p) => (cx(p) - keep.x - 0.5) ** 2 + (cy(p) - keep.y - 0.5) ** 2);
  }
  switch (keep) {
    case "north": return best((p) => p.y);
    case "south": return best((p) => -(p.y + p.h));
    case "west": return best((p) => p.x);
    case "east": return best((p) => -(p.x + p.w));
    default: return best((p) => (cx(p) - map.width / 2) ** 2 + (cy(p) - map.height / 2) ** 2);
  }
}

/**
 * 철거한 건물 자리의 2층·4층 덧그림과 건물 그림자 띠를 지운다. restoreStructurePlacementTiles 는 1·3층만 되돌려서,
 * 지붕·처마가 덧그림(4층)으로 올라간 건물은 철거 뒤에도 지붕 조각이 허공에 남았다(jrpg-loop-1 ct1 미래 맵).
 * 4층은 처마가 건물 폭 밖으로 나오므로 오른쪽 한 칸을 더 지운다. 길 가장자리 덧그림은 건드리지 않는다(위 영역 밖).
 */
function clearDemolishedOverlays(copy: GameMap, placement: { kitId: string; x: number; y: number; w: number; h: number }): void {
  for (let row = 0; row < placement.h; row += 1) {
    for (let column = 0; column <= placement.w; column += 1) {
      const x = placement.x + column;
      const y = placement.y + row;
      if (x < 0 || y < 0 || x >= copy.width || y >= copy.height) continue;
      const index = y * copy.width + x;
      if (column < placement.w && copy.lowerOverlayTiles && copy.lowerOverlayTiles[index] !== undefined) copy.lowerOverlayTiles[index] = -1;
      if (copy.upperOverlayTiles && copy.upperOverlayTiles[index] !== undefined) copy.upperOverlayTiles[index] = -1;
    }
  }
  // 마을 시공기가 건물마다 2층에 얹은 그림자 덧그림(BEODEUL_NATURE.shadows — 오른쪽·아래로 비낀 띠)도 같은 칸을 지운다.
  // 안 지우면 빈 땅 위에 어두운 세로·가로 줄이 남는다(원해상도 렌더로 확인: 길 가장자리 덧그림은 이 칸 밖이라 그대로다).
  const shadow = BEODEUL_NATURE.shadows[placement.kitId];
  if (shadow && copy.lowerOverlayTiles) {
    shadow.rows.forEach((row, j) => row.forEach((tile, i) => {
      if (tile < 0) return;
      const x = placement.x + shadow.dx + i;
      const y = placement.y + shadow.dy + j;
      if (x < 0 || y < 0 || x >= copy.width || y >= copy.height) return;
      copy.lowerOverlayTiles![y * copy.width + x] = -1;
    }));
  }
}
/**
 * 시대별 길·경작지 변환 — structurePlacements 바깥에 칠해진 포장도로(beodeul_road_autotile)와
 * 현대 밀밭·허수아비·울타리를 시대에 맞게 바꾼다. 오토타일 비트마스크(0..15)를 그대로 유지하므로 통행성은 변하지 않는다.
 */
function transformVariantRoadsAndFarms(copy: GameMap, tileset: Project["tilesets"][string] | undefined, look: VariantLook, seed: number): void {
  const groups = tileset?.autotileGroups ?? [];
  const roadGroup = groups.find((group) => group.id === "beodeul_road_autotile");
  const sandGroup = groups.find((group) => group.id === "beodeul_sand_autotile");
  const roadToSand = new Map<number, number>();
  if (roadGroup?.variantMap && sandGroup?.variantMap) {
    for (const [mask, roadTile] of Object.entries(roadGroup.variantMap)) {
      const sandTile = sandGroup.variantMap[mask];
      if (typeof roadTile === "number" && typeof sandTile === "number") roadToSand.set(roadTile, sandTile);
    }
  }
  const farmUpperTiles = new Set<number>();
  for (const kit of tileset?.structureKits ?? []) {
    if (kit.kind !== "section" || !/wheat|scarecrow|haystack|fence/iu.test(kit.id) || /wild|trough/iu.test(kit.id)) continue;
    for (const row of kit.rows) {
      for (const tile of row.upperTiles ?? []) if (tile >= 0) farmUpperTiles.add(tile);
    }
  }
  const fenceSourceTiles = new Set<number>(Object.values(BEODEUL_NATURE.fence ?? {}));
  for (const graft of tileset?.tileGrafts ?? []) {
    if (graft.sourceChipset === "tex_beodeul_nature" && fenceSourceTiles.has(graft.sourceTile)) {
      farmUpperTiles.add(graft.targetTile);
    }
  }
  const grassTile = 737;
  const canUseGrass = Boolean(tileset?.tileMeta?.[grassTile]?.tags?.includes("grass"));
  for (let y = 0; y < copy.height; y += 1) {
    for (let x = 0; x < copy.width; x += 1) {
      const index = y * copy.width + x;
      const lower = copy.lowerTiles[index];
      if (lower !== undefined && roadToSand.has(lower)) {
        const replaceRoad = look === "past"
          || (look === "ruin" && ((hash32(`${seed}:${Math.floor(x / 3)}:${Math.floor(y / 3)}`) % 100) < 58));
        if (replaceRoad) copy.lowerTiles[index] = roadToSand.get(lower)!;
      }
      const upper = copy.upperTiles[index];
      if (upper !== undefined && upper >= 0 && farmUpperTiles.has(upper) && !eventAt(copy, x, y)) {
        clearTileStack(copy, "upper", index);
        copy.upperTiles[index] = -1;
        if (copy.lowerOverlayTiles && copy.lowerOverlayTiles[index] !== undefined) copy.lowerOverlayTiles[index] = -1;
        if (copy.upperOverlayTiles && copy.upperOverlayTiles[index] !== undefined) copy.upperOverlayTiles[index] = -1;
        if (x + 1 < copy.width && (copy.upperTiles[index + 1] ?? -1) < 0 && !farmUpperTiles.has(copy.upperTiles[index + 1] ?? -1) && copy.lowerOverlayTiles && copy.lowerOverlayTiles[index + 1] !== undefined) {
          copy.lowerOverlayTiles[index + 1] = -1;
        }
        if (canUseGrass && lower !== undefined && !roadToSand.has(lower) && !isWaterCell(copy, tileset, index)) {
          copy.lowerTiles[index] = grassTile;
        }
      }
    }
  }
}

/**
 * 변형 맵 `copy` 에 시대 프리셋을 건다. `copy` 는 cloneMapIntoProject 로 방금 복제한 맵이고,
 * 건물 철거는 복제본이 가진 structurePlacements 의 `before` 로 한다.
 */
export function applyVariantLook(draft: Project, copy: GameMap, look: VariantLook, warnings: string[], label: string, options: { readonly keepIntact?: KeepIntact } = {}): VariantLookReport {
  const spec = LOOKS[look];
  copy.defaultLighting = { ambient: spec.ambient, color: spec.color, sources: [] };
  if (spec.fog !== undefined) copy.climate = { mode: "fixed", weather: "fog", intensity: spec.fog };
  const report: VariantLookReport = {
    look, label: spec.label, lighting: { ambient: spec.ambient, color: spec.color },
    ...(spec.fog !== undefined ? { fog: spec.fog } : {}),
    demolishedBuildings: 0, stampedPieces: 0, removedDoorEvents: [],
  };

  const tileset = draft.tilesets[copy.tilesetId];
  const seed = hash32(`${copy.id}:${look}`);
  transformVariantRoadsAndFarms(copy, tileset, look, seed);

  const kitsById = new Map<string, SectionStructureKitDef>((tileset?.structureKits ?? []).filter((kit) => kit.kind === "section").map((kit) => [kit.id, kit]));
  const kits = spec.kitIds.map((id) => kitsById.get(id)).filter((kit): kit is SectionStructureKitDef => kit !== undefined);
  const landmarks = spec.landmarkIds.map((id) => kitsById.get(id)).filter((kit): kit is SectionStructureKitDef => kit !== undefined);
  const original = [...structurePlacementsOf(copy)];
  const buildings = original
    .filter((placement) => placement.w * placement.h >= 12 && Math.min(placement.w, placement.h) >= 3 && !NOT_A_BUILDING.test(placement.kitId))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (buildings.length === 0) {
    if (options.keepIntact !== undefined) warnings.push(`${label}: keepIntact 를 줬지만 건물 배치 기록이 없어 남길 건물을 고를 수 없습니다.`);
    if (spec.site === "burned") {
      report.note = "건물 배치 기록(structurePlacements)이 없어 조명만 적용했습니다 — 불탄 집터는 author_beodeul_town 등 시공기로 지은 마을 맵에서만 꾸밉니다.";
      warnings.push(`${label}: ${report.note}`);
      return report;
    }
    const terrain = applyVariantTerrain(copy, tileset, look === "past" ? "primeval" : "wasteland", seed);
    if (terrain) report.terrain = terrain;
    report.note = "건물 배치 기록(structurePlacements)이 없어 조명·안개만 적용했습니다 — 지형 변화를 더하려면 tileRemap·tileOverrides 로 건물·나무를 바꾸세요.";
    warnings.push(`${label}: ${report.note}`);
    return report;
  }

  const random = rng(seed);
  const kept = options.keepIntact === undefined ? undefined : pickKeptBuilding(buildings, options.keepIntact, copy);
  if (kept) report.keptIntact = { kitId: kept.kitId, x: kept.x, y: kept.y, w: kept.w, h: kept.h };
  const wanted = Math.max(1, Math.min(buildings.length - (kept ? 1 : 0), Math.round(buildings.length * spec.demolishRatio)));
  const burnedSites: Placement[] = [];
  // 대형 현대 건물(길드홀·대성당·시청 등 w*h>=48)은 과거·폐허·미래에서 그대로 남으면 같은 시대로 읽히므로 우선 철거 대상으로 올린다.
  const order = buildings
    .map((placement, index) => ({
      placement,
      isLarge: placement.w * placement.h >= 48,
      key: random() + index * 1e-9,
    }))
    .sort((a, b) => (a.isLarge === b.isLarge ? a.key - b.key : a.isLarge ? -1 : 1))
    .map((entry) => entry.placement);
  const taken = new Set<number>();
  let landmarkPlaced = 0;
  for (const placement of order) {
    if (report.demolishedBuildings >= wanted) break;
    if (placement === kept) continue;
    const inside = copy.events.filter((event) => event.x >= placement.x && event.y >= placement.y && event.x < placement.x + placement.w && event.y < placement.y + placement.h);
    // 건물 안에 문이 아닌 이벤트(NPC·상자·세이브)가 있으면 그 건물은 남긴다.
    if (inside.some((event) => !isTransferDoor(event))) continue;
    for (const door of inside) report.removedDoorEvents.push(door.id);
    const doorIds = new Set(inside.map((event) => event.id));
    copy.events = copy.events.filter((event) => !doorIds.has(event.id));
    restoreStructurePlacementTiles(copy, placement);
    clearDemolishedOverlays(copy, placement);
    removeStructurePlacement(copy, placement.id);
    report.demolishedBuildings += 1;

    const placeKitAt = (kit: SectionStructureKitDef, x: number, y: number): boolean => {
      if (x < placement.x || y < placement.y || x + kit.width > placement.x + placement.w || y + kit.height > placement.y + placement.h) return false;
      for (let row = 0; row < kit.height; row += 1) {
        for (let col = 0; col < kit.width; col += 1) {
          // 물 칸 위에는 폐허 조각을 놓지 않는다 — 받침 없는 물체로 커밋이 거절돼 변형 도구가 통째로 실패했다(jrpg-loop-2: 해안 건물 자리).
          if (taken.has((y + row) * copy.width + x + col) || eventAt(copy, x + col, y + row) || isWaterCell(copy, tileset, (y + row) * copy.width + x + col)) return false;
        }
      }
      const rect = { x, y, w: kit.width, h: kit.height };
      const before = captureStructureTiles(copy, rect);
      for (let row = 0; row < kit.height; row += 1) {
        for (let col = 0; col < kit.width; col += 1) {
          const index = (y + row) * copy.width + x + col;
          taken.add(index);
          const lower = kit.rows[row]?.tiles[col];
          const upper = kit.rows[row]?.upperTiles?.[col];
          if (lower !== undefined && lower >= 0) { clearTileStack(copy, "lower", index); copy.lowerTiles[index] = lower; }
          if (upper !== undefined && upper >= 0) { clearTileStack(copy, "upper", index); copy.upperTiles[index] = upper; }
        }
      }
      appendStructurePlacement(copy, { kitId: kit.id, rect, before });
      report.stampedPieces += 1;
      return true;
    };
    const placeKitInSite = (kit: SectionStructureKitDef, centered = false): boolean => {
      if (kit.width > placement.w || kit.height > placement.h) return false;
      const x = centered
        ? placement.x + Math.floor((placement.w - kit.width) / 2)
        : placement.x + Math.floor(random() * (placement.w - kit.width + 1));
      const y = centered
        ? placement.y + Math.floor((placement.h - kit.height) / 2)
        : placement.y + Math.floor(random() * (placement.h - kit.height + 1));
      return placeKitAt(kit, x, y);
    };

    if (spec.site === "burned") {
      burnedSites.push(placement);
      dressBurnedSite(copy, tileset, kitsById, placement, random, placeKitAt, placeKitInSite);
      continue;
    }

    if (landmarks.length > 0 && placement.w >= 4 && placement.h >= 4 && landmarkPlaced < spec.maxLandmarks) {
      const landmark = landmarks[(landmarkPlaced + Math.floor(random() * landmarks.length)) % landmarks.length]!;
      if (placeKitInSite(landmark, true)) landmarkPlaced += 1;
    }

    if (kits.length === 0) continue;
    const [minStamps, maxStamps] = spec.stampsPerSite;
    const count = minStamps + Math.floor(random() * (maxStamps - minStamps + 1));
    for (let n = 0; n < count; n += 1) {
      const kit = kits[Math.min(kits.length - 1, Math.floor(random() * kits.length))]!;
      placeKitInSite(kit, false);
    }
  }
  if (spec.site === "burned") {
    // 집보다 작은 나무 구조물(노점·헛간·장작 더미 …)도 불에 탄다 — 철거만 하고 자리는 그을림 둘레로 둔다. 문·인물 있는 것은 남긴다.
    const big = new Set(buildings);
    for (const placement of original) {
      if (big.has(placement) || placement.w * placement.h < 2 || NOT_A_BUILDING.test(placement.kitId)) continue;
      if (copy.events.some((event) => event.x >= placement.x && event.y >= placement.y && event.x < placement.x + placement.w && event.y < placement.y + placement.h)) continue;
      if (!structurePlacementsOf(copy).some((candidate) => candidate.id === placement.id)) continue;
      restoreStructurePlacementTiles(copy, placement);
      clearDemolishedOverlays(copy, placement);
      removeStructurePlacement(copy, placement.id);
      burnedSites.push(placement);
      report.demolishedStructures = (report.demolishedStructures ?? 0) + 1;
    }
    if (!kitsById.has(BURNED_SITE.floor)) {
      report.note = "이 타일셋에는 불탄 집터 조각(버들항 잿빛 바닥·숯 기둥)이 없어 건물 철거와 조명만 적용했습니다.";
      warnings.push(`${label}: ${report.note}`);
      return report;
    }
    const terrain = applyVariantTerrain(copy, tileset, "scorched", seed, scorchMask(copy, burnedSites, kept, seed));
    if (terrain) report.terrain = terrain;
    return report;
  }
  if (kits.length === 0) {
    report.note = "이 타일셋에는 시대 소품 킷이 없어 건물 철거와 조명·안개만 적용했습니다.";
    warnings.push(`${label}: ${report.note}`);
  }
  // 철거로 되돌린 풀까지 시대 땅으로 바꾸도록 맨 마지막에 맵 전체를 칠한다.
  const terrain = applyVariantTerrain(copy, tileset, look === "past" ? "primeval" : "wasteland", seed);
  if (terrain) report.terrain = terrain;
  return report;
}

function centerTileOf(kit: SectionStructureKitDef | undefined): number | undefined {
  if (!kit) return undefined;
  const tile = kit.rows[Math.floor(kit.height / 2)]?.tiles[Math.floor(kit.width / 2)];
  return tile !== undefined && tile >= 0 ? tile : undefined;
}

/**
 * 철거한 집 자리를 불탄 집터로 꾸민다: 발자국 전체를 잿빛 바닥(광재·재·흙 얼룩)으로 칠하고, 네 귀퉁이(폭 6 이상이면 앞면 가운데도)에
 * 숯 기둥 그루터기, 가운데쯤 내려앉은 서까래, 숯더미·탄 판자·탄 들보 더미 1~3개, 재·불씨 부스러기 2~4개를 놓는다.
 * 집터 모양(발자국)은 잿빛 바닥으로 그대로 읽힌다 — 길은 건드리지 않는다.
 */
function dressBurnedSite(
  copy: GameMap,
  tileset: Project["tilesets"][string] | undefined,
  kitsById: ReadonlyMap<string, SectionStructureKitDef>,
  placement: Placement,
  random: () => number,
  placeKitAt: (kit: SectionStructureKitDef, x: number, y: number) => boolean,
  placeKitInSite: (kit: SectionStructureKitDef, centered?: boolean) => boolean,
): void {
  const floor = centerTileOf(kitsById.get(BURNED_SITE.floor));
  if (floor === undefined) return;
  const patches = BURNED_SITE.floorPatches.map((id) => centerTileOf(kitsById.get(id))).filter((tile): tile is number => tile !== undefined);
  const rim = centerTileOf(kitsById.get(BURNED_SITE.rim));
  const seed = hash32(`${copy.id}:burned:${placement.x}:${placement.y}`);
  for (let row = 0; row < placement.h; row += 1) {
    for (let column = 0; column < placement.w; column += 1) {
      const x = placement.x + column;
      const y = placement.y + row;
      if (x < 0 || y < 0 || x >= copy.width || y >= copy.height) continue;
      const index = y * copy.width + x;
      if (isWaterCell(copy, tileset, index) || eventAt(copy, x, y)) continue;
      const blob = hash32(`${seed}:${Math.floor(x / 2)}:${Math.floor(y / 2)}`) % 100;
      const edge = row === 0 || column === 0 || row === placement.h - 1 || column === placement.w - 1;
      clearTileStack(copy, "lower", index);
      copy.lowerTiles[index] = edge && rim !== undefined && blob % 4 !== 0 ? rim : patches.length > 0 && blob < 18 ? patches[blob % patches.length]! : floor;
    }
  }
  const pick = (ids: readonly string[]) => ids.map((id) => kitsById.get(id)).filter((kit): kit is SectionStructureKitDef => kit !== undefined);
  const posts = pick(BURNED_SITE.posts);
  const frames = pick(BURNED_SITE.frames);
  const heaps = pick(BURNED_SITE.heaps);
  const bits = pick(BURNED_SITE.bits);
  if (posts.length > 0 && placement.w >= 3 && placement.h >= 4) {
    const left = placement.x;
    const right = placement.x + placement.w - 1;
    const top = placement.y;
    const bottom = placement.y + placement.h - 2;
    // 앞면 두 귀퉁이는 늘, 뒤 귀퉁이는 깊은 집(세로 7 이상)에서 한쪽만 — 기둥이 많으면 묘지처럼 읽힌다.
    const spots: [number, number][] = [[left, bottom], [right, bottom]];
    if (placement.h >= 7) spots.push(random() < 0.5 ? [left, top] : [right, top]);
    spots.forEach(([x, y], n) => { placeKitAt(posts[(n + Math.floor(random() * posts.length)) % posts.length]!, x, y); });
  }
  if (frames.length > 0 && placement.w >= 4) placeKitInSite(frames[Math.floor(random() * frames.length)]!, true);
  const heapCount = Math.max(1, Math.min(2, Math.floor((placement.w * placement.h) / 18)));
  for (let n = 0; n < heapCount && heaps.length > 0; n += 1) {
    for (let attempt = 0; attempt < 4; attempt += 1) if (placeKitInSite(heaps[Math.floor(random() * heaps.length)]!)) break;
  }
  const bitCount = 1 + Math.floor(random() * 3);
  for (let n = 0; n < bitCount && bits.length > 0; n += 1) placeKitInSite(bits[Math.floor(random() * bits.length)]!);
}

/** 불탄 집터 둘레 그을림 칸 — 발자국과 그 둘레 1칸은 늘, 2·3칸은 덩어리 얼룩으로 줄어들게. 남긴 건물 발자국은 뺀다. */
function scorchMask(copy: GameMap, sites: readonly Placement[], kept: Placement | undefined, seed: number): Uint8Array {
  const mask = new Uint8Array(copy.width * copy.height);
  for (const site of sites) {
    for (let y = Math.max(0, site.y - SCORCH_RADIUS); y < Math.min(copy.height, site.y + site.h + SCORCH_RADIUS); y += 1) {
      for (let x = Math.max(0, site.x - SCORCH_RADIUS); x < Math.min(copy.width, site.x + site.w + SCORCH_RADIUS); x += 1) {
        const dx = x < site.x ? site.x - x : x >= site.x + site.w ? x - (site.x + site.w - 1) : 0;
        const dy = y < site.y ? site.y - y : y >= site.y + site.h ? y - (site.y + site.h - 1) : 0;
        const distance = Math.max(dx, dy);
        const keep = (hash32(`${seed}:scorch:${Math.floor(x / 2)}:${Math.floor(y / 2)}`) % 100) < SCORCH_CHANCE[Math.min(distance, SCORCH_RADIUS)]!;
        if (keep) mask[y * copy.width + x] = 1;
      }
    }
  }
  if (kept) {
    for (let y = kept.y; y < kept.y + kept.h; y += 1) for (let x = kept.x; x < kept.x + kept.w; x += 1) {
      if (x >= 0 && y >= 0 && x < copy.width && y < copy.height) mask[y * copy.width + x] = 0;
    }
  }
  return mask;
}
