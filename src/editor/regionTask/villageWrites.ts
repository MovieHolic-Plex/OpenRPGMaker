// editor/regionTask/villageWrites.ts
// village 오퍼레이터 — 시드 결정적 마을 생성기.
//
// 왜(2026-09-02): 집 모양이 뻔한 것은 카탈로그가 없어서가 아니다. houseTemplateCatalog 에
// 직사각·ㄱ자·T자·ㄷ자·본채+헛간 등 **34종이 이미 좌표 데이터로 있다.** 그런데 "어떤 템플릿을
// 쓸지" 를 LLM 이 고르게 했더니 한 종에 수렴했고, 그걸 고치려고 맵을 되읽어 다양성을 리포트하고
// 프롬프트로 되먹이는 관찰 고리(houseVariety.ts)가 생겼다. 확률 모델에게 "골고루 뽑아라" 라고
// 부탁하는 구조다. 여기서는 **비복원 추출 세 줄**로 코드가 보장한다.
//
// 시공은 새로 짜지 않는다. 스크래치 맵에 기존 stampFootprintHouseKit 을 그대로 찍고 원본과
// diff 해서 쓰기 목록을 뽑는다 — 그래서 지붕·벽·문·창 문법과 킷 규칙이 통째로 재사용된다.
//
// ⚠ 알려진 한계: 집 **킷**은 아직 combined_town 전용이다(킷은 타일 목록이 아니라 지붕·벽·문·창
// 구조체라 슬롯 모양이 다르다). 지면·길·울타리는 슬롯을 타므로 칩셋을 따라가지만, 킷은 아니다.
// 다음 단계에서 킷 슬롯을 정의한다.

import {
  MIXABLE_HOUSE_KIT_IDS,
  stampFootprintHouseKit,
  type HouseKitId,
} from "@/editor/houseKit";
import {
  HOUSE_TEMPLATE_DEFS,
  houseTemplateWingsAt,
  type HouseTemplateDef,
} from "@/project/defaults/houseTemplateCatalog";
import type { ResolvedMaterialSlots } from "@/editor/operators/materialSlots";
import type { GameMap } from "@/project/types";
import type { RegionRect } from "./clipToRegion";
import type { OperatorWrite } from "@/editor/operators/operatorTypes";

export type VillageLayout = "spine" | "plaza" | "scatter";

export interface VillageParams {
  /** 지으려는 집 수. 자리가 모자라면 들어가는 만큼만 짓는다. */
  readonly houses?: number;
  readonly layout?: VillageLayout;
  /** 참이면 한 가지 모양으로 줄지어 짓는다(연립·막사). 기본은 꺼짐 = 34종에서 비복원 추출. */
  readonly uniform?: boolean;
}

const DEFAULTS: Required<VillageParams> = {
  houses: 5,
  layout: "spine",
  uniform: false,
};

/** village 가 아는 재료의 전부. 슬롯에서 유도하며, 없으면 combined_town 기본값. */
export interface VillagePalette {
  readonly ground: number;
  readonly path: number;
  readonly plaza: number;
  readonly fence: number | null;
  /** 문 타일 상·하. 문 이벤트를 만들지 않는 시공은 이걸 직접 깔아야 한다(village/houses.ts 규약). */
  readonly doorTop: number;
  readonly doorBottom: number;
  readonly paintable: ReadonlySet<number>;
}

const GRASS = 240;
const DIRT_PATH = 421;
const STONE_PLAZA = 342;
const FENCE = 378;
/** 이 위에만 마을을 짓는다. 물·집·벽 등 기성 구조물은 건드리지 않는다. */
const PAINTABLE: ReadonlySet<number> = new Set<number>([
  GRASS, 241, 242, 243, 244, 245,
  270, 271, 272, 273, 274, 275,
  300, 301, 302, 303, 304, 305,
  330, 331, 332, 333, 334, 335,
  360, 390, 391, 392, 420, DIRT_PATH, 422,
]);

const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;

export const COMBINED_TOWN_VILLAGE_PALETTE: VillagePalette = {
  ground: GRASS,
  path: DIRT_PATH,
  plaza: STONE_PLAZA,
  fence: FENCE,
  doorTop: DOOR_TOP,
  doorBottom: DOOR_BOTTOM,
  paintable: PAINTABLE,
};

export function villagePaletteFromSlots(slots: ResolvedMaterialSlots | undefined): VillagePalette {
  const base = COMBINED_TOWN_VILLAGE_PALETTE;
  if (!slots) return base;
  const paintable = new Set<number>(base.paintable);
  for (const tile of slots.ground?.tiles ?? []) paintable.add(tile);
  for (const tile of slots.path?.tiles ?? []) paintable.add(tile);
  for (const tile of slots.plaza?.tiles ?? []) paintable.add(tile);
  return {
    ground: slots.ground?.body ?? slots.ground?.tiles[0] ?? base.ground,
    path: slots.path?.body ?? slots.path?.tiles[0] ?? base.path,
    plaza: slots.plaza?.body ?? slots.plaza?.tiles[0] ?? base.plaza,
    fence: slots.fence?.body ?? slots.fence?.tiles[0] ?? base.fence,
    // 문은 킷과 한 몸이라 아직 슬롯을 타지 않는다(파일 머리말의 알려진 한계).
    doorTop: base.doorTop,
    doorBottom: base.doorBottom,
    paintable,
  };
}

export interface VillageBuildResult {
  readonly writes: readonly OperatorWrite[];
  readonly note: string;
  /** 실제로 선 집 수. 자리가 모자라면 요청보다 적다. */
  readonly houses: number;
  /** 쓰인 서로 다른 템플릿 수 — 다양성이 보장됐다는 증거. */
  readonly distinctTemplates: number;
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

type Lot = { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly facing: "north" | "south" };

/**
 * 필지 목록. 도로 스파인을 먼저 긋고 그 위·아래로 줄을 세운다.
 * 집은 도로를 향해 서야 하므로 facing 을 함께 준다(북쪽 줄은 아래를 향한다).
 */
function planLots(region: RegionRect, spineY: number, layout: VillageLayout, rng: () => number): Lot[] {
  const lots: Lot[] = [];
  const left = region.x + 1;
  const right = region.x + region.width - 2;
  const northH = spineY - 1 - (region.y + 1);
  const southH = (region.y + region.height - 2) - (spineY + 1);
  const rows: { top: number; h: number; facing: "north" | "south" }[] = [];
  if (northH >= 5) rows.push({ top: region.y + 1, h: northH, facing: "north" });
  if (southH >= 5) rows.push({ top: spineY + 2, h: southH, facing: "south" });

  for (const row of rows) {
    let x = left + (layout === "scatter" ? Math.floor(rng() * 2) : 0);
    while (x + 4 <= right) {
      // 필지 폭은 4~8. scatter 는 간격을 흔들어 줄이 덜 보이게 한다.
      const width = clamp(4 + Math.floor(rng() * 5), 4, right - x + 1);
      lots.push({ x, y: row.top, w: width, h: row.h, facing: row.facing });
      const gap = layout === "scatter" ? 2 + Math.floor(rng() * 3) : 2;
      x += width + gap;
    }
  }
  return lots;
}

function fits(def: HouseTemplateDef, lot: Lot): boolean {
  return def.w <= lot.w && def.h <= lot.h;
}

/** 스크래치 맵의 한 칸을 안전하게 쓴다. */
function put(map: GameMap, x: number, y: number, tile: number, layer: "lower" | "upper" = "lower"): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  const index = y * map.width + x;
  if (layer === "upper") map.upperTiles[index] = tile;
  else map.lowerTiles[index] = tile;
}

/**
 * 마을 writes 를 계산한다. 순수 함수 — 넘어온 map 을 변형하지 않는다(내부 스크래치 사본에만 쓴다).
 */
export function buildVillageWrites(
  map: GameMap,
  region: RegionRect,
  params: VillageParams = {},
  seed = 1,
  palette: VillagePalette = COMBINED_TOWN_VILLAGE_PALETTE,
): VillageBuildResult {
  const p = { ...DEFAULTS, ...params };
  const rng = makeRng(seed);
  const x0 = Math.max(0, region.x);
  const y0 = Math.max(0, region.y);
  const x1 = Math.min(map.width - 1, region.x + region.width - 1);
  const y1 = Math.min(map.height - 1, region.y + region.height - 1);
  if (x1 - x0 < 6 || y1 - y0 < 8) {
    return { writes: [], note: "영역이 좁아 마을을 세울 수 없습니다", houses: 0, distinctTemplates: 0 };
  }
  const inRegion = (x: number, y: number): boolean => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const paintable = (x: number, y: number): boolean =>
    inRegion(x, y) && palette.paintable.has(map.lowerTiles[y * map.width + x] ?? -1);

  // 스크래치 사본 — 기존 시공 코드는 GameMap 을 직접 고치도록 되어 있다.
  const scratch: GameMap = {
    ...map,
    lowerTiles: [...map.lowerTiles],
    upperTiles: [...map.upperTiles],
    events: [],
  } as GameMap;

  // ── 1. 도로 스파인 ──
  const spineY = Math.round(y0 + (y1 - y0) * (p.layout === "plaza" ? 0.5 : 0.42 + rng() * 0.16));
  for (let x = x0; x <= x1; x += 1) {
    if (paintable(x, spineY)) put(scratch, x, spineY, palette.path);
  }
  // plaza 배치는 스파인 가운데를 광장으로 넓힌다.
  if (p.layout === "plaza") {
    const cx = Math.round((x0 + x1) / 2);
    const cy = spineY;
    for (let y = cy - 1; y <= cy + 1; y += 1) {
      for (let x = cx - 2; x <= cx + 2; x += 1) {
        if (paintable(x, y)) put(scratch, x, y, palette.plaza);
      }
    }
  }

  // ── 2. 필지 + 3. 템플릿 비복원 추출 ──
  const lots = planLots({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }, spineY, p.layout, rng);
  // 다양성은 여기서 보장된다. 셔플 후 앞에서부터 꺼내 쓰므로 같은 모양이 두 번 나오지 않는다.
  const pool = shuffled(HOUSE_TEMPLATE_DEFS, rng);
  const kits = shuffled(MIXABLE_HOUSE_KIT_IDS, rng);
  const wanted = clamp(Math.round(p.houses), 1, 12);
  const usedTemplates = new Set<string>();
  /** 문과 그 집의 bbox — 골목을 낼 때 집을 관통하지 않으려면 몸통을 알아야 한다. */
  const doors: { x: number; y: number; box: { x: number; y: number; w: number; h: number } }[] = [];
  let poolCursor = 0;
  let kitCursor = 0;
  let built = 0;

  // uniform 이면 **한 모양을 미리 정한다.** 필지마다 "맞는 첫 템플릿" 을 찾게 두면 필지 크기가
  // 달라 서로 다른 모양이 뽑힌다(실측: 5채에 3종). 가장 좁은 필지에도 들어가는 것을 고른다.
  const uniformDef = p.uniform
    ? (() => {
        const narrowest = lots.reduce<Lot | undefined>(
          (best, lot) => (!best || lot.w * 1000 + lot.h < best.w * 1000 + best.h ? lot : best),
          undefined,
        );
        return narrowest ? pool.find((candidate) => fits(candidate, narrowest)) : undefined;
      })()
    : undefined;

  for (const lot of lots) {
    if (built >= wanted) break;
    const def = p.uniform
      ? (uniformDef && fits(uniformDef, lot) ? uniformDef : undefined)
      : (() => {
          for (let i = poolCursor; i < pool.length; i += 1) {
            if (fits(pool[i]!, lot)) {
              poolCursor = i + 1;
              return pool[i]!;
            }
          }
          // 남은 풀에 맞는 것이 없으면 처음부터 다시 훑는다(필지가 많을 때).
          return pool.find((candidate) => fits(candidate, lot));
        })();
    if (!def) continue;

    // 도로를 향해 붙인다 — 북쪽 줄은 아래(도로쪽) 정렬, 남쪽 줄은 위 정렬.
    const px = lot.x + Math.floor((lot.w - def.w) / 2);
    const py = lot.facing === "north" ? (lot.y + lot.h - def.h) : lot.y;
    const wings = houseTemplateWingsAt(def, px, py);
    // 필지가 지면인지 먼저 확인 — 물·기존 건물 위에 짓지 않는다.
    const footprintClear = wings.every((wing) => {
      for (let y = wing.y; y < wing.y + wing.h; y += 1) {
        for (let x = wing.x; x < wing.x + wing.w; x += 1) {
          if (!paintable(x, y)) return false;
        }
      }
      return true;
    });
    if (!footprintClear) continue;

    const kitId: HouseKitId = def.kitId ?? kits[kitCursor % kits.length]!;
    kitCursor += 1;
    const result = stampFootprintHouseKit(scratch, {
      wings,
      kitId,
      ...(def.stories ? { stories: def.stories } : {}),
      ...(def.lowWall ? { lowWall: def.lowWall } : {}),
      chimney: rng() < 0.35,
      doorEvent: false,
    });
    if (!result.ok) continue;
    built += 1;
    usedTemplates.add(def.id);
    if (result.doorAt) {
      // stampFootprintHouseKit 은 문 **위치만** 돌려주고 타일은 찍지 않는다(문 이벤트를 만드는
      // 호출자가 처리하는 규약). 여기는 이벤트를 만들지 않으므로 문 타일을 직접 깐다 —
      // 안 그러면 문 없는 집이 선다. village/houses.ts 의 doorTiles 옵션과 같은 규약이다.
      put(scratch, result.doorAt.x, result.doorAt.y - 1, palette.doorTop);
      put(scratch, result.doorAt.x, result.doorAt.y, palette.doorBottom);
      doors.push({ ...result.doorAt, box: { x: px, y: py, w: def.w, h: def.h } });
    }
  }

  // ── 4. 골목 — 모든 문을 도로에 잇는다 ──
  // 문은 언제나 **남쪽 벽**에 난다(킷 규약). 북쪽 줄 집은 문이 도로를 향하므로 곧장 내려가면 되지만,
  // 남쪽 줄 집은 도로를 등지고 있어서 직선으로 그으면 **집 몸통을 관통한다**(실사에서 확인).
  // 그래서 남쪽 줄은 문 앞으로 한 칸 내려간 뒤 집 옆으로 빠져 ㄱ자로 돌아 도로에 붙인다.
  for (const door of doors) {
    const facesRoad = door.y < spineY;
    if (facesRoad) {
      for (let y = door.y + 1; y <= spineY; y += 1) {
        if (paintable(door.x, y)) put(scratch, door.x, y, palette.path);
      }
      continue;
    }
    const apronY = door.y + 1;
    if (paintable(door.x, apronY)) put(scratch, door.x, apronY, palette.path);
    // 집 왼쪽·오른쪽 중 영역 안에 있고 더 가까운 쪽으로 우회한다.
    const leftX = door.box.x - 1;
    const rightX = door.box.x + door.box.w;
    const candidates = [leftX, rightX].filter((x) => x >= x0 && x <= x1);
    if (candidates.length === 0) continue;
    const detourX = candidates.reduce((best, x) =>
      Math.abs(x - door.x) < Math.abs(best - door.x) ? x : best);
    const stepX = detourX > door.x ? 1 : -1;
    for (let x = door.x; x !== detourX + stepX; x += stepX) {
      if (paintable(x, apronY)) put(scratch, x, apronY, palette.path);
    }
    for (let y = apronY - 1; y >= spineY; y -= 1) {
      if (paintable(detourX, y)) put(scratch, detourX, y, palette.path);
    }
  }

  // ── 5. 원본과 diff → writes ──
  //
  // 울타리는 v1 에서 뺐다. fence 그룹(378·379·380·408…)은 방향별 조각 8개인데 대표 타일 하나를
  // 반복해 두르면 세로 기둥만 늘어서 집을 두르지 못한다(실사에서 확인). 조각 의미를 읽는 것은
  // 오토타일러의 일이라, 어설픈 울타리를 남기느니 다음 단계로 미룬다.
  const writes: OperatorWrite[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const index = y * map.width + x;
      if (scratch.lowerTiles[index] !== map.lowerTiles[index]) {
        writes.push({ layer: "lower", x, y, tile: scratch.lowerTiles[index]! });
      }
      if (scratch.upperTiles[index] !== map.upperTiles[index]) {
        writes.push({ layer: "upper", x, y, tile: scratch.upperTiles[index]! });
      }
    }
  }

  const note = built === 0
    ? "집을 세울 자리를 찾지 못했습니다"
    : `집 ${built}채 · 모양 ${usedTemplates.size}종`;
  return { writes, note, houses: built, distinctTemplates: usedTemplates.size };
}
