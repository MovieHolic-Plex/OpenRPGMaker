import { isDefaultTilesetTexture } from "@/editor/chipsetComposition";
import { comboBrushStampFromCatalog, curatedComboBrushesForTileset } from "@/editor/comboBrushCatalog";
import { paletteStampFromCells, paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import { albumEntries } from "@/editor/panels/structureKitDbSources";
import { defaultPaintLayerForTile } from "@/editor/tileLayerClassification";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import type { GameMap, TilesetDef } from "@/project/types";

/** Browsing categories use authored object names, ids and tags, never translated DOM text. */
export const PROP_CATEGORIES = [
  { id: "seating", label: "의자·좌석", pattern: /의자|좌석|소파|걸상|스툴|벤치|왕좌|chair|seat|sofa|\bbench|stool|throne/i },
  { id: "tables", label: "탁자·책상", pattern: /탁자|식탁|책상|테이블|찻상|제단|작업대|조리대|진열대|카운터|계산대|접수대|table|desk|counter|altar|workbench/i },
  { id: "beds", label: "침대", pattern: /침대|침상|bed/i },
  { id: "storage", label: "수납·상자", pattern: /책장|장롱|장식장|진열장|수납|찬장|서랍|궤짝|상자|금고|선반|보관함|걸이|통(?:$|\s)|chest|crate|cabinet|shelf|rack|bookcase|wardrobe|barrel/i },
  { id: "lighting", label: "조명", pattern: /촛|등불|가로등|램프|샹들리에|횃불|candle|lamp|torch|light|lantern/i },
  { id: "plants", label: "나무·식물", pattern: /나무|화분|꽃|수풀|식물|묘목|tree|plant|flower|bush|hedge/i },
  { id: "kitchen", label: "부엌·먹거리", pattern: /화덕|레인지|요리|식기|냄비|그릇|주전자|식빵|양배추|과일|음식|채소|빵|생선|고기|맥주|부엌|stove|food|bread|fish|kitchen|cooking/i },
  { id: "devices", label: "장치", pattern: /장치|기관|마법진|저장점|포탈|룰렛|슬롯|기계|수정|전송|teleport|device|crystal|portal|mechanism|machine/i },
  { id: "decor", label: "장식·소품", pattern: /장식|깃발|그림|초상|석상|조각|흉상|태피스트리|카펫|러그|액자|시계|커튼|분수|statue|painting|rug|tapestry|banner|flag|fountain|decoration/i },
  { id: "structures", label: "건물·시설", pattern: /건물|벽|지붕|문|계단|탑|울타리|담장|다리|부두|선착장|building|structure|fence|wall|roof|stairs|tower|bridge|ship|door/i },
  { id: "other", label: "기타", pattern: null },
] as const;
export type PropCategoryId = (typeof PROP_CATEGORIES)[number]["id"];

function propCategory(name: string, id: string, tags: readonly string[], role?: string, fallback: PropCategoryId = "other"): PropCategoryId {
  if (role && ["building", "castle", "fence", "roof", "terrain", "water", "wall"].includes(role)) return "structures";
  // Names identify the object; a shop/theme tag must not turn its chair into food or a building.
  return PROP_CATEGORIES.find(category => category.pattern?.test(`${name} ${id}`))?.id
    ?? PROP_CATEGORIES.find(category => category.pattern?.test(tags.join(" ")))?.id ?? fallback;
}

export interface PropChoice {
  readonly id: string;
  readonly name: string;
  readonly stamp: PaletteStamp;
  readonly description: string;
  readonly terms: readonly string[];
  readonly preference: number;
  readonly family: string;
  readonly category: PropCategoryId;
}

export interface PropRecommendation {
  readonly choice: PropChoice;
  readonly matchesPlace: boolean;
}

// Catalogs belong to a tileset. Painting a cell retains that definition, so it must not
// rebuild hundreds of furniture stamps or thumbnails on each store notification.
const catalogs = new WeakMap<TilesetDef, readonly PropChoice[]>();

function validStamp(stamp: PaletteStamp, tileset: TilesetDef): boolean {
  return Number.isInteger(stamp.width) && stamp.width > 0
    && Number.isInteger(stamp.height) && stamp.height > 0
    && stamp.cells.length > 0 && stamp.cells.every(cell =>
      Number.isInteger(cell.tile) && cell.tile >= 0 && cell.tile < tileset.count
      && Number.isInteger(cell.dx) && cell.dx >= 0 && cell.dx < stamp.width
      && Number.isInteger(cell.dy) && cell.dy >= 0 && cell.dy < stamp.height);
}

export function propsForTileset(tileset: TilesetDef): readonly PropChoice[] {
  const cached = catalogs.get(tileset);
  if (cached) return cached;
  const choices: PropChoice[] = [];
  const kitsById = new Map((tileset.structureKits ?? []).map(kit => [kit.id, kit]));
  for (const entry of curatedComboBrushesForTileset({
    isDefaultChipset: isDefaultTilesetTexture(tileset), tileCount: tileset.count,
  })) {
    const base = comboBrushStampFromCatalog(entry);
    choices.push({
      id: entry.id, name: entry.name, description: entry.note,
      terms: [entry.name, entry.category], preference: entry.category === "structure" ? 0 : 3,
      family: entry.sourceGroups.join("|"),
      category: propCategory(entry.name, entry.id, [], entry.category === "structure" ? "building" : undefined,
        entry.category === "nature" ? "plants" : "decor"),
      stamp: { ...base, cells: base.cells.map(cell => ({ ...cell, layer: defaultPaintLayerForTile(tileset, cell.tile) })) },
    });
  }
  for (const entry of albumEntries(tileset)) {
    if (entry.kind === "object") {
      const object = entry.object;
      const kit = kitsById.get(object.id);
      if (kit?.kind === "section" && kit.tileSize !== undefined && kit.tileSize !== tileset.tileSize) continue;
      choices.push({
        id: object.id, name: object.label, description: object.description ?? "",
        terms: [object.label, object.description ?? "", ...object.themes, ...(kit?.ai?.tags ?? []), object.role ?? ""], preference: 3,
        family: object.role || kit?.ai?.tags?.join("|") || object.id,
        category: propCategory(object.label, object.id, kit?.ai?.tags ?? [], kit?.ai?.role),
        stamp: paletteStampFromCells({ cells: object.cells, width: object.width, height: object.height, kitId: object.id }),
      });
    } else if (entry.kit.kind === "section") {
      const kit = entry.kit;
      if (kit.tileSize !== undefined && kit.tileSize !== tileset.tileSize) continue;
      choices.push({
        id: kit.id, name: kit.name ?? kit.id,
        description: kit.ai?.placementRules || kit.ai?.description || "",
        terms: [kit.name ?? "", kit.ai?.description ?? "", ...(kit.ai?.themes ?? []), ...(kit.ai?.tags ?? [])],
        preference: kit.ai?.role === "prop" || kit.ai?.repeatability === "fixed" ? 2 : 0,
        family: kit.ai?.tags?.join("|") || kit.id,
        category: propCategory(kit.name ?? "", kit.id, kit.ai?.tags ?? [], kit.ai?.role),
        stamp: paletteStampFromKit(kit),
      });
    }
  }
  const seen = new Set<string>();
  const valid = choices.filter(choice => {
    if (seen.has(choice.id) || !validStamp(choice.stamp, tileset)) return false;
    seen.add(choice.id);
    return true;
  }).map(choice => ({
    ...choice,
    terms: [...choice.terms, choice.category, PROP_CATEGORIES.find(category => category.id === choice.category)!.label],
    stamp: { ...choice.stamp, label: choice.name, source: { ...choice.stamp.source, tilesetId: tileset.id, tileSize: tileset.tileSize } },
  }));
  catalogs.set(tileset, valid);
  return valid;
}

/** Only authored map/place names and catalog metadata influence the order; never UI text. */
export function propRecommendationContext(map: GameMap): string {
  return [map.name, ...(map.locations ?? []).map(location => location.name)].join(" ");
}

/** Filter the full compatible catalog before pagination, so unopened cards remain searchable. */
export function filterProps(entries: readonly PropRecommendation[], category: PropCategoryId | undefined, query: string): readonly PropRecommendation[] {
  const tokens = query.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return entries.filter(({ choice }) => {
    if (category && choice.category !== category) return false;
    const text = [choice.name, choice.id, ...choice.terms].join(" ").normalize("NFKC").toLocaleLowerCase();
    return tokens.every(token => text.includes(token));
  });
}

export function recommendProps(map: GameMap, tileset: TilesetDef): readonly PropRecommendation[] {
  if (map.tilesetId !== tileset.id || map.tileSize !== tileset.tileSize) return [];
  const tokens = [...new Set(propRecommendationContext(map).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(token => token.length > 1))];
  const ranked = propsForTileset(tileset)
    .filter(choice => choice.stamp.width <= map.width && choice.stamp.height <= map.height)
    .map((choice, index) => {
      const text = choice.terms.join(" ").toLocaleLowerCase();
      const matches = tokens.filter(token => text.includes(token)).length;
      // Place matches come first, then complete small props before large structural sections.
      const score = matches * 100 + choice.preference * 10 - Math.log2(choice.stamp.width * choice.stamp.height);
      return { choice, matchesPlace: matches > 0, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  // Several color/contents variants must not take all six recommendations. Present one
  // of each authored family first, retaining the place-match tier and original order.
  const families = new Map<string, number>();
  return ranked.map(entry => {
    const family = `${entry.matchesPlace}:${entry.choice.family}`;
    const round = families.get(family) ?? 0;
    families.set(family, round + 1);
    return { ...entry, round };
  }).sort((a, b) => Number(b.matchesPlace) - Number(a.matchesPlace) || a.round - b.round || b.score - a.score || a.index - b.index)
    .map(({ choice, matchesPlace }) => ({ choice, matchesPlace }));
}
