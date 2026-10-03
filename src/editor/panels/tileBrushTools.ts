import { editorState } from "@/editor/editorState";
import { tileStackAt } from "@/project/mapOverlayTiles";
import type { GameMap, MapId, TileGroupMetadata, TilesetDef } from "@/project/types";
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";

export type UsedTileLocation = {
  readonly layer: "lower" | "upper";
  readonly x: number;
  readonly y: number;
};

type UsedLocationInput = {
  readonly map: GameMap;
  readonly tile: number;
  readonly limit: number;
};

type SimilarTilesInput = {
  readonly tileset: TilesetDef;
  readonly tile: number;
  readonly limit: number;
};

type SelectUsedLocationInput = UsedTileLocation & {
  readonly mapId: MapId;
};

const FAVORITE_LIMIT = 12;
const favoriteTiles: number[] = [];
/** 즐겨찾기·최근 타일이 바뀔 때 왓쪽 활동 막대의 「즐겨찾기」 패널이 다시 그린다. */
export const TILE_SHORTCUTS_CHANGED_EVENT = "oprn:tile-shortcuts-changed";
function notifyTileShortcutsChanged(): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new Event(TILE_SHORTCUTS_CHANGED_EVENT));
}

export function toggleFavoriteTile(tile: number): void {
  const existingIndex = favoriteTiles.indexOf(tile);
  if (existingIndex >= 0) {
    favoriteTiles.splice(existingIndex, 1);
    notifyTileShortcutsChanged();
    return;
  }
  favoriteTiles.unshift(tile);
  if (favoriteTiles.length > FAVORITE_LIMIT) favoriteTiles.length = FAVORITE_LIMIT;
  notifyTileShortcutsChanged();
}

export function favoriteTilesSnapshot(): readonly number[] {
  return [...favoriteTiles];
}

const RECENT_LIMIT = 18;
const recentTiles: number[] = [];

/** 팔레트에서 고른 타일을 맨 앞에 둔다(중복은 앞으로). 팔레트 「최근」 분류와 즐겨찾기 패널이 같은 목록을 본다. */
export function recordRecentTile(tile: number): void {
  const existingIndex = recentTiles.indexOf(tile);
  if (existingIndex === 0) return;
  if (existingIndex > 0) recentTiles.splice(existingIndex, 1);
  recentTiles.unshift(tile);
  if (recentTiles.length > RECENT_LIMIT) recentTiles.length = RECENT_LIMIT;
  notifyTileShortcutsChanged();
}

/** 살아 있는 배열이다 — 팔레트 필터가 매 렌더 복사하지 않고 읽는다. 쓰기는 recordRecentTile 로만. */
export function recentTilesView(): readonly number[] {
  return recentTiles;
}

export function clearFavoriteTilesForTest(): void {
  favoriteTiles.length = 0;
  recentTiles.length = 0;
}

export function isFavoriteTile(tile: number): boolean {
  return favoriteTiles.includes(tile);
}

export function usedLocationsForTile(input: UsedLocationInput): readonly UsedTileLocation[] {
  const locations: UsedTileLocation[] = [];
  for (let index = 0; index < input.map.width * input.map.height; index += 1) {
    appendLayerLocation(locations, input, index, "lower");
    if (locations.length >= input.limit) return locations;
    appendLayerLocation(locations, input, index, "upper");
    if (locations.length >= input.limit) return locations;
  }
  return locations;
}

export function selectUsedLocation(input: SelectUsedLocationInput): void {
  editorState.set({
    layer: input.layer,
    selection: { mapId: input.mapId, x: input.x, y: input.y, width: 1, height: 1 },
  });
}

// 같은 타일셋 객체·같은 칸이면 답이 같다. 팔레트 보조 패널은 스토어가 바뀔 때마다(조수 체크포인트 적용마다) 다시 그려져
// 버들항 27,648칸을 매번 다 훑었다(2026-10-03 프로필: 마을 적용 한 번에 tileVocabulary 점수 계산 ~1.5s). 타일셋이 바뀌면 객체가 바뀐다.
const similarCache = new WeakMap<TilesetDef, Map<string, readonly number[]>>();

export function similarTilesForTile(input: SimilarTilesInput): readonly number[] {
  let cache = similarCache.get(input.tileset);
  if (!cache) { cache = new Map(); similarCache.set(input.tileset, cache); }
  const key = `${input.tile}:${input.limit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const result = computeSimilarTiles(input);
  cache.set(key, result);
  return result;
}

function computeSimilarTiles(input: SimilarTilesInput): readonly number[] {
  // 칸마다 tileGroups 를 훑으면(group.tileIds.includes) 버들항 23,936칸에서 제곱이 된다 — 칸→그룹 표를 한 번만 만든다.
  const groupsByTile = new Map<number, TileGroupMetadata[]>();
  for (const group of input.tileset.tileGroups ?? []) {
    for (const id of group.tileIds) {
      const list = groupsByTile.get(id);
      if (list) list.push(group);
      else groupsByTile.set(id, [group]);
    }
  }
  const current = tileSimilarityContext(input.tileset, input.tile, groupsByTile);
  const currentTags = new Set(current.tags);
  const scored = Array.from({ length: input.tileset.count }, (_, tile) => {
    const candidate = tileSimilarityContext(input.tileset, tile, groupsByTile);
    const sharedTags = candidate.tags.filter((tag) => currentTags.has(tag)).length * 3;
    const sameUsage = candidate.usage === current.usage ? 2 : 0;
    const sameRepeatRole = candidate.repeatRole === current.repeatRole ? 1 : 0;
    const sameGroup = candidate.groupIds.filter((id) => current.groupIds.includes(id)).length * 10;
    const sameAutoFamily = isAutoFamily(currentTags) && isAutoFamily(new Set(candidate.tags)) ? 8 : 0;
    const roadSideEdge = currentTags.has("road") && candidate.tags.includes("edge") && !candidate.tags.includes("corner") ? 2 : 0;
    return { tile, score: sameGroup + sharedTags + sameUsage + sameRepeatRole + sameAutoFamily + roadSideEdge };
  })
    .filter((item) => item.tile !== input.tile && item.score > 0)
    .sort((left, right) => right.score - left.score || Math.abs(left.tile - input.tile) - Math.abs(right.tile - input.tile));
  return scored.slice(0, input.limit).map((item) => item.tile);
}

type TileSimilarityContext = {
  readonly groupIds: readonly string[];
  readonly repeatRole: string;
  readonly tags: readonly string[];
  readonly usage: string;
};

function tileSimilarityContext(tileset: TilesetDef, tile: number, groupsByTile: ReadonlyMap<number, readonly TileGroupMetadata[]>): TileSimilarityContext {
  const groups = groupsByTile.get(tile) ?? [];
  const meta = tileset.tileMeta?.[tile];
  if (meta || groups.length > 0) {
    const tags = new Set<string>();
    addMeaning(tags, meta?.label);
    addMeaning(tags, meta?.description);
    addMeaning(tags, meta?.role);
    addMeaning(tags, meta?.repeatability);
    addMeaning(tags, meta?.defaultLayer);
    for (const group of groups) {
      addMeaning(tags, group.id);
      addMeaning(tags, group.name);
      addMeaning(tags, group.role);
      addMeaning(tags, group.defaultLayer);
      addMeaning(tags, group.description);
      addMeaning(tags, group.placementRules);
      addMeaning(tags, group.patternGrammar?.kind);
    }
    return {
      groupIds: groups.map((group) => group.id),
      repeatRole: meta?.repeatability ?? groups[0]?.patternGrammar?.repeat ?? "single",
      tags: [...tags],
      usage: groups[0]?.role ?? meta?.role ?? "unknown",
    };
  }
  const descriptor = describeChipsetTile(tile);
  return {
    groupIds: [],
    repeatRole: descriptor.repeatRole,
    tags: descriptor.tags,
    usage: descriptor.usage,
  };
}

function addMeaning(target: Set<string>, value: string | undefined): void {
  if (!value) return;
  const normalized = value.toLowerCase();
  for (const token of normalized.split(/[^a-z0-9가-힣]+/u)) {
    if (token) target.add(token);
  }
  if (normalized.includes("road")) target.add("road");
  if (normalized.includes("dirt")) target.add("dirt");
  if (normalized.includes("sand")) target.add("sand");
  if (normalized.includes("desert")) target.add("desert");
  if (normalized.includes("auto")) target.add("autotile");
  if (normalized.includes("edge")) target.add("edge");
  if (normalized.includes("corner")) target.add("corner");
  if (normalized.includes("흙길")) {
    target.add("road");
    target.add("dirt");
  }
  if (normalized.includes("모래") || normalized.includes("사막")) target.add("sand");
}

function isAutoFamily(tags: ReadonlySet<string>): boolean {
  return tags.has("road") || tags.has("dirt") || tags.has("autotile");
}

/** 이 타일이 자동 연결(오토타일) 대상인가 — 연결 모드 힌트("Auto"/"Manual" 안내)에 쓰인다.
 * 옛 tileStampBrushes.ts(제거됨)에 있던 판정 로직을 그대로 옮겼다 — 스탬프 기능과는
 * 무관하게 "이 타일이 이웃과 성형되는 오토타일인가"만 본다. */
export function isAutoConnectCandidate(tile: number, tileset?: TilesetDef): boolean {
  if (tileset?.autotileGroups?.some((group) => group.memberTileIds.includes(tile) || group.connectTileIds?.includes(tile))) {
    return true;
  }
  const meaning = tileAutoConnectMeaning(tile, tileset);
  return (
    meaning.has("autotile")
    || meaning.has("road")
    || meaning.has("dirt")
    || meaning.has("wall")
    || meaning.has("floor")
    || meaning.has("sand")
  );
}

function tileAutoConnectMeaning(tile: number, tileset?: TilesetDef): ReadonlySet<string> {
  const words = new Set<string>();
  const meta = tileset?.tileMeta?.[tile];
  addMeaning(words, meta?.label);
  addMeaning(words, meta?.description);
  addMeaning(words, meta?.role);
  addMeaning(words, meta?.repeatability);
  if (meta?.repeatability === "auto") words.add("autotile");

  for (const group of tileset?.tileGroups ?? []) {
    if (!group.tileIds.includes(tile)) continue;
    addMeaning(words, group.id);
    addMeaning(words, group.name);
    addMeaning(words, group.role);
    addMeaning(words, group.description);
    addMeaning(words, group.placementRules);
    addMeaning(words, group.patternGrammar?.kind);
    if (group.patternGrammar?.kind === "autotile_3x3") words.add("autotile");
  }

  if (words.size === 0) {
    const descriptor = describeChipsetTile(tile);
    descriptor.tags.forEach((tag) => words.add(tag));
    addMeaning(words, descriptor.key);
    addMeaning(words, descriptor.label);
    addMeaning(words, descriptor.description);
    addMeaning(words, descriptor.aiLabel);
  }
  return words;
}

function appendLayerLocation(
  locations: UsedTileLocation[],
  input: UsedLocationInput,
  index: number,
  layer: "lower" | "upper"
): void {
  const tiles = layer === "lower" ? input.map.lowerTiles : input.map.upperTiles;
  if (tiles[index] !== input.tile && !tileStackAt(input.map, layer, index).includes(input.tile)) return;
  locations.push({
    layer,
    x: index % input.map.width,
    y: Math.floor(index / input.map.width),
  });
}
