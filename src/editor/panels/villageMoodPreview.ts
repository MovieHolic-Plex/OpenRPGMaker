// 배치 프리셋 분위기 필드 → 실제 타일 그림.
//
// 길·광장·마당·나무·킷은 값이 아니라 **시공 결과**로 고른다. 화면이 상상해 그린
// 아이콘은 본시공과 어긋나므로, 스크래치 맵에 본시공 함수를 그대로 돌린다.
// 칩셋을 못 구하면 캔버스는 `previewState=none` 으로 남고 카드는 글자로 클릭한다.

import { HOUSE_KITS, MIXABLE_HOUSE_KIT_IDS, stampFootprintHouseKit, isHouseKitId, type HouseKitId } from "@/editor/houseKit";
import {
  createHousePreview,
  createScratchPreview,
  houseKitTileset,
} from "@/editor/panels/villageHousePreview";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import type { GameMap, Project, TilesetDef, VillageHouseTemplateRecord } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { placePreviewConifers, placeVillageDecor } from "@/editor/tools/village/decor";
import { paintMarketDeck, paintFlowerField, paintPlazaFence, villagePlaza } from "@/editor/tools/village/plaza";
import { paintRoadStrip } from "@/editor/tools/village/roads";
import type { BuiltHouse, Plaza, VillageIntent } from "@/editor/tools/village/constants";
import type { PlazaLayout, RoadStyle, YardStyle } from "@/editor/tools/villagePlan";

export type MoodPreviewField =
  | "pathStyle"
  | "plazaStyle"
  | "plazaLayout"
  | "yardStyle"
  | "edgeTrees"
  | "kitMix";

const PREVIEW_SEED = 7;
const FLOWER_SEED = 0x2545f491;
const KIT_W = 6;
const KIT_H = 6;
const KIT_GAP = 1;

const PATH_SIZE = { w: 12, h: 4 } as const;
const PLAZA_STYLE_SIZE = { w: 14, h: 10 } as const;
const PLAZA_LAYOUT_AREA = { x: 0, y: 0, w: 40, h: 36 } as const;
const YARD_SIZE = { w: 16, h: 12 } as const;
const TREE_SIZE = { w: 18, h: 8 } as const;

const PLAZA_STYLES = new Set<string>(["market", "garden", "empty"]);
const PLAZA_LAYOUTS = new Set<string>(["center", "north", "south", "west", "east"]);
const PATH_STYLES = new Set<string>(["sand", "dirt", "stone"]);
const YARD_STYLES = new Set<string>(["mixed", "garden", "workshop", "market", "minimal"]);
const EDGE_TREES = new Set<string>(["conifer", "dense", "none"]);

export function createMoodPreview(
  project: Project,
  args: {
    readonly field: MoodPreviewField;
    readonly id: string | undefined;
    readonly testid: string;
    readonly label: string;
  },
): HTMLElement {
  const shotId = args.id === undefined ? `${args.testid}-unset-shot` : `${args.testid}-${args.id}-shot`;
  if (args.field === "kitMix" && args.id && args.id !== "mixed" && isHouseKitId(args.id)) {
    return createHousePreview(kitCardRecord(args.id), project, "card", {
      testid: shotId,
      label: `${args.label} 집 그림`,
    });
  }
  const tilesetId = houseKitTileset(project)?.id ?? "none";
  return createScratchPreview({
    cacheKey: `mood|${args.field}|${args.id ?? "unset"}|${tilesetId}|card`,
    label: `${args.label} 그림`,
    testid: shotId,
    size: "card",
    build: () => moodPreviewMap(project, args.field, args.id),
  });
}

/** 순수 시공 — 캔버스가 없는 환경에서도 타일이 들어갔는지 볼 수 있다. */
export function moodPreviewMap(
  project: Project,
  field: MoodPreviewField,
  id: string | undefined,
): { readonly map: GameMap; readonly tileset: TilesetDef } | undefined {
  const scratch = townScratch(project, `mood-${field}-${id ?? "unset"}`, sizeFor(field, id));
  if (!scratch) return undefined;
  const { map, tileset } = scratch;
  if (id === undefined) return scratch;
  if (field === "pathStyle") {
    if (!PATH_STYLES.has(id)) return scratch;
    const cells: { x: number; y: number }[] = [];
    for (let x = 1; x <= map.width - 2; x += 1) {
      cells.push({ x, y: 1 }, { x, y: 2 });
    }
    paintRoadStrip(map, id as RoadStyle, cells);
    return scratch;
  }
  if (field === "plazaStyle") {
    paintPlazaStyle(map, id);
    return scratch;
  }
  if (field === "plazaLayout") {
    if (!PLAZA_LAYOUTS.has(id)) return scratch;
    const plaza = villagePlaza(PLAZA_LAYOUT_AREA, id as PlazaLayout, "plaza-ring");
    paintMarketDeck(map, plaza.rect);
    return scratch;
  }
  if (field === "yardStyle") {
    if (!YARD_STYLES.has(id)) return scratch;
    return paintYard(project, map, tileset, id as YardStyle);
  }
  if (field === "edgeTrees") {
    if (!EDGE_TREES.has(id) || id === "none") return scratch;
    const count = id === "dense" ? 12 : 4;
    placePreviewConifers(withScratchMap(project, map), map, count, PREVIEW_SEED);
    return scratch;
  }
  if (field === "kitMix" && id === "mixed") {
    return paintKitMixCollage(map, tileset);
  }
  return scratch;
}

function sizeFor(field: MoodPreviewField, id: string | undefined): { readonly w: number; readonly h: number } {
  if (field === "pathStyle") return PATH_SIZE;
  if (field === "plazaStyle") return PLAZA_STYLE_SIZE;
  if (field === "plazaLayout") return { w: PLAZA_LAYOUT_AREA.w, h: PLAZA_LAYOUT_AREA.h };
  if (field === "yardStyle") return YARD_SIZE;
  if (field === "edgeTrees") return TREE_SIZE;
  if (field === "kitMix" && id === "mixed") {
    const n = MIXABLE_HOUSE_KIT_IDS.length;
    return { w: KIT_GAP + n * (KIT_W + KIT_GAP), h: KIT_GAP + KIT_H + KIT_GAP };
  }
  return { w: KIT_W + KIT_GAP * 2, h: KIT_H + KIT_GAP * 2 };
}

function paintPlazaStyle(map: GameMap, id: string): void {
  if (!PLAZA_STYLES.has(id) || id === "empty") return;
  const rect = { x: 3, y: 2, w: 8, h: 6 };
  if (id === "market") {
    paintMarketDeck(map, rect);
    return;
  }
  paintPlazaFence(map, rect);
  paintFlowerField(map, {
    x: rect.x + 1,
    y: rect.y + 1,
    w: Math.max(1, rect.w - 2),
    h: Math.max(1, rect.h - 2),
  }, mulberry32(FLOWER_SEED >>> 0));
}

function paintYard(
  project: Project,
  map: GameMap,
  tileset: TilesetDef,
  yardStyle: YardStyle,
): { readonly map: GameMap; readonly tileset: TilesetDef } | undefined {
  const origin = { x: 5, y: 2 };
  const wings = [{ x: origin.x, y: origin.y, w: KIT_W, h: KIT_H }];
  const stamped = stampFootprintHouseKit(map, {
    wings,
    kitId: "timber-hall",
    stories: 1,
    doorEvent: false,
  });
  if (!stamped.ok || !stamped.doorAt) return undefined;
  const house = builtFromStamp(origin, stamped.doorAt, "timber-hall");
  const plaza: Plaza = { rect: { x: 1, y: 1, w: 3, h: 2 }, centerRow: 2, centerX: 2 };
  const area = { x: 0, y: 0, w: map.width, h: map.height };
  placeVillageDecor(
    withScratchMap(project, map),
    map,
    area,
    plaza,
    [house],
    PREVIEW_SEED,
    previewIntent(yardStyle),
    [],
  );
  return { map, tileset };
}

function paintKitMixCollage(
  map: GameMap,
  tileset: TilesetDef,
): { readonly map: GameMap; readonly tileset: TilesetDef } | undefined {
  for (let i = 0; i < MIXABLE_HOUSE_KIT_IDS.length; i += 1) {
    const kitId = MIXABLE_HOUSE_KIT_IDS[i]!;
    const x = KIT_GAP + i * (KIT_W + KIT_GAP);
    const stamped = stampFootprintHouseKit(map, {
      wings: [{ x, y: KIT_GAP, w: KIT_W, h: KIT_H }],
      kitId,
      stories: 1,
      doorEvent: false,
    });
    if (!stamped.ok) return undefined;
  }
  return { map, tileset };
}

function kitCardRecord(kitId: HouseKitId): VillageHouseTemplateRecord {
  return {
    id: `mood-kit-${kitId}`,
    name: HOUSE_KITS[kitId].name,
    w: KIT_W,
    h: KIT_H,
    stories: 1,
    kitId,
    wings: [{ x: 0, y: 0, w: KIT_W, h: KIT_H }],
  };
}

function builtFromStamp(
  origin: { readonly x: number; readonly y: number },
  doorAt: { readonly x: number; readonly y: number },
  kitId: HouseKitId,
): BuiltHouse {
  return {
    bbox: { x: origin.x, y: origin.y, w: KIT_W, h: KIT_H },
    doorAt,
    front: { x: doorAt.x, y: doorAt.y + 1 },
    kitId,
    stories: 1,
    templateId: "rect-small",
  };
}

function previewIntent(yardStyle: YardStyle): VillageIntent {
  return {
    theme: "preview",
    templateCatalog: [],
    pathStyle: "sand",
    kitMix: "mixed",
    yardStyle,
    plazaStyle: "empty",
    edgeTrees: "none",
    plazaLayout: "center",
    roadWidth: 2,
    roadNaturalness: 0.5,
    settlementLayout: "plaza-ring",
    houseYards: [],
    houseKits: [],
    houseTemplates: [],
    houseOwners: [],
    housePrograms: [],
  };
}

function townScratch(
  project: Project,
  name: string,
  size: { readonly w: number; readonly h: number },
): { readonly map: GameMap; readonly tileset: TilesetDef } | undefined {
  const tileset = houseKitTileset(project);
  if (!tileset) return undefined;
  const map = createBlankMap(name, size.w, size.h, tileset.id, tileset.tileSize);
  return { map, tileset };
}

function withScratchMap(project: Project, map: GameMap): Project {
  return { ...project, maps: { ...project.maps, [map.id]: map } };
}
