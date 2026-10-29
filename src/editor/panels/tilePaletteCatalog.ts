// 타일 팔레트의 지형·프리팹 카탈로그.
//
// 수천 칸 격자 대신 TilesetDef 에 이미 있는 autotileGroups · terrain 계열 tileGroups ·
// structureKits 를 카드로 꺼낸다. 칠하기는 여기서 다시 구현하지 않는다 — 카드는
// 대표 칸(오토타일은 variantMap["255"])과 킷 참조만 고르고, 기존 오토타일 엔진과
// paletteStampFromKit 이 배치한다.
//
// 메타데이터가 없는 타일셋은 카드가 0장이다. 호출부가 그때 예전 격자만 보여 준다.

import { autotileRepresentativeTile } from "@/editor/panels/tilePaletteGrid";
import { autotileGroupLayer } from "@/project/defaults/autotileEngine";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import type {
  AutotileGroup,
  SectionStructureKitDef,
  TileGroupMetadata,
  TilesetDef,
} from "@/project/types";

export const TERRAIN_CHIPS = [
  { id: "all", label: "전체" },
  { id: "ground", label: "땅" },
  { id: "road", label: "길" },
  { id: "water", label: "물" },
  { id: "wall", label: "벽" },
  { id: "fence", label: "울타리" },
  { id: "roof", label: "지붕" },
] as const;

export type TerrainChipId = (typeof TERRAIN_CHIPS)[number]["id"];

export const PREFAB_ROLE_LABELS: Readonly<Record<string, string>> = {
  building: "건물",
  castle: "성",
  fence: "울타리",
  ground: "땅",
  path: "길",
  prop: "소품",
  roof: "지붕",
  terrain: "지형",
  wall: "벽",
  water: "물",
};

const TERRAIN_ROLES = new Set(["terrain", "water", "wall", "fence", "roof", "ground", "path"]);

export type TerrainCardKind = "autotile" | "group";

export type TerrainCard = {
  readonly id: string;
  readonly kind: TerrainCardKind;
  readonly name: string;
  readonly chip: Exclude<TerrainChipId, "all">;
  readonly paintTile: number;
  readonly layer: "lower" | "upper";
  readonly memberCount: number;
  readonly autotileGroupId?: string;
  readonly tileGroupId?: string;
  readonly searchBlob: string;
};

export type PrefabCard = {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly roleLabel: string;
  readonly themes: readonly string[];
  readonly tags: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly paintTile: number;
  readonly kit: SectionStructureKitDef;
  readonly searchBlob: string;
};

export type GroupSearchCard = {
  readonly id: string;
  readonly name: string;
  readonly paintTile: number;
  readonly role: string;
  readonly searchBlob: string;
};

export type PaletteCatalog = {
  readonly terrain: readonly TerrainCard[];
  readonly prefabs: readonly PrefabCard[];
  /** 지형 탭에 올리지 않는 묶음. 검색에서 프리팹·낱칸보다 앞에 둔다. */
  readonly otherGroups: readonly GroupSearchCard[];
};

export type CatalogSearchHit =
  | { readonly kind: "terrain"; readonly card: TerrainCard; readonly score: number }
  | { readonly kind: "group"; readonly card: GroupSearchCard; readonly score: number }
  | { readonly kind: "prefab"; readonly card: PrefabCard; readonly score: number }
  | { readonly kind: "tile"; readonly index: number; readonly label: string; readonly score: number };

export type CatalogSearchResult = {
  readonly terrain: readonly CatalogSearchHit[];
  readonly groups: readonly CatalogSearchHit[];
  readonly prefabs: readonly CatalogSearchHit[];
  readonly tiles: readonly CatalogSearchHit[];
  readonly terrainTotal: number;
  readonly groupTotal: number;
  readonly prefabTotal: number;
  readonly tileTotal: number;
};

const SEARCH_CAP = 40;

type CacheEntry = { readonly token: string; readonly catalog: PaletteCatalog };
const catalogCache = new WeakMap<TilesetDef, CacheEntry>();
const tileIndexCache = new WeakMap<TilesetDef, readonly TileSearchEntry[]>();

type TileSearchEntry = { readonly index: number; readonly label: string; readonly blob: string };

export function paletteCatalogFor(tileset: TilesetDef): PaletteCatalog {
  const token = catalogToken(tileset);
  const cached = catalogCache.get(tileset);
  if (cached && cached.token === token) return cached.catalog;
  const catalog = buildPaletteCatalog(tileset);
  catalogCache.set(tileset, { token, catalog });
  return catalog;
}

export function paletteHasSmartCatalog(tileset: TilesetDef): boolean {
  const catalog = paletteCatalogFor(tileset);
  return catalog.terrain.length > 0 || catalog.prefabs.length > 0;
}

export function defaultPaletteView(tileset: TilesetDef): "terrain" | "prefab" | "tiles" {
  const catalog = paletteCatalogFor(tileset);
  if (catalog.terrain.length > 0) return "terrain";
  if (catalog.prefabs.length > 0) return "prefab";
  return "tiles";
}

/** 오토타일 대표 칸. 꽉 찬 이웃(mask 255)이 지면의 속 그림이라 카드·붓이 그 칸을 쓴다. */
export function autotilePaintTile(group: AutotileGroup): number {
  const full = group.variantMap["255"];
  if (typeof full === "number") return full;
  return autotileRepresentativeTile(group);
}

export function terrainChipCounts(cards: readonly TerrainCard[]): ReadonlyMap<TerrainChipId, number> {
  const counts = new Map<TerrainChipId, number>(TERRAIN_CHIPS.map((chip) => [chip.id, 0]));
  counts.set("all", cards.length);
  for (const card of cards) counts.set(card.chip, (counts.get(card.chip) ?? 0) + 1);
  return counts;
}

export type PrefabChip = { readonly id: string; readonly label: string };

/** 프리팹 테마 태그(영문 원시 값)의 화면 이름. 이름이 없는 영문 태그는 칩으로 내놓지 않는다(검색으로는 찾힌다). */
const PREFAB_THEME_LABELS: Readonly<Record<string, string>> = {
  floor: "바닥", structure: "구조물", wall: "벽", roof: "지붕", house: "집", home: "집", building: "건물", interior: "실내",
  exterior: "야외", outdoor: "야외", indoor: "실내", nature: "자연", tree: "나무", trees: "나무", plant: "식물", water: "물",
  road: "길", path: "길", street: "거리", fence: "울타리", decor: "장식", decoration: "장식", furniture: "가구", market: "시장",
  harbor: "항구", harbour: "항구", port: "항구", dock: "부두", pier: "부두", ship: "배", boat: "배", church: "교회", temple: "신전",
  castle: "성", fort: "요새", town: "마을", village: "마을", city: "도시", garden: "정원", farm: "농장", field: "들판", forest: "숲",
  stone: "돌", rock: "바위", wood: "나무", wooden: "나무", bridge: "다리", door: "문", gate: "문", window: "창문", stairs: "계단",
  plaza: "광장", square: "광장", shop: "가게", store: "가게", inn: "여관", tavern: "주점", flower: "꽃", flowers: "꽃", lamp: "등",
  light: "조명", sign: "간판", crate: "상자", barrel: "통", cart: "수레", well: "우물", statue: "조각상", fountain: "분수", tower: "탑",
  bench: "벤치", table: "탁자", chair: "의자", bed: "침대", roman: "로마풍", medieval: "중세", ruin: "폐허", ruins: "폐허", cave: "동굴",
  dungeon: "던전", prop: "소품", props: "소품", ground: "땅", grass: "풀밭", sand: "모래", snow: "눈", dirt: "흙",
};

function prefabThemeLabel(theme: string): string | null {
  if (/[가-힣]/.test(theme)) return theme;
  return PREFAB_THEME_LABELS[theme.trim().toLowerCase()] ?? null;
}

export function prefabChips(cards: readonly PrefabCard[]): readonly PrefabChip[] {
  const roles = new Map<string, number>();
  const themes = new Map<string, number>();
  for (const card of cards) {
    if (card.role) roles.set(card.role, (roles.get(card.role) ?? 0) + 1);
    for (const theme of card.themes) themes.set(theme, (themes.get(theme) ?? 0) + 1);
  }
  const chips: PrefabChip[] = [{ id: "all", label: "전체" }];
  const used = new Set<string>(["전체"]);
  for (const [role] of [...roles.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))) {
    const label = PREFAB_ROLE_LABELS[role] ?? prefabThemeLabel(role);
    if (!label || used.has(label)) continue;
    used.add(label);
    chips.push({ id: `role:${role}`, label });
  }
  const hangul = [...themes.entries()].filter(([theme]) => /[가-힣]/.test(theme));
  const themeSource = hangul.length > 0 ? hangul : [...themes.entries()];
  themeSource.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  for (const [theme] of themeSource) {
    if (chips.length >= 13) break;
    const label = prefabThemeLabel(theme);
    // 화면 이름이 없거나 이미 같은 이름의 칩이 있으면 내놓지 않는다 — 「floor」 같은 원시 태그가 칩에 보이지 않게.
    if (!label || used.has(label)) continue;
    used.add(label);
    chips.push({ id: `theme:${theme}`, label });
  }
  return chips;
}

export function prefabMatchesChip(card: PrefabCard, chip: string): boolean {
  if (!chip || chip === "all") return true;
  if (chip.startsWith("role:")) return card.role === chip.slice(5);
  if (chip.startsWith("theme:")) return card.themes.includes(chip.slice(6));
  return true;
}

/**
 * 검색은 지형 카드 → 그 밖의 묶음 → 프리팹 → 낱칸 순이다.
 * 낱칸 색인은 첫 검색에서만 만들고, 라벨·태그가 있는 칸만 담는다.
 */
export function searchPaletteCatalog(tileset: TilesetDef, query: string): CatalogSearchResult {
  const tokens = query.trim().toLowerCase().split(/\s+/u).filter((token) => token.length > 0);
  const empty: CatalogSearchResult = {
    terrain: [], groups: [], prefabs: [], tiles: [],
    terrainTotal: 0, groupTotal: 0, prefabTotal: 0, tileTotal: 0,
  };
  if (tokens.length === 0) return empty;
  const catalog = paletteCatalogFor(tileset);
  const terrain = rank(catalog.terrain.map((card) => ({
    kind: "terrain" as const, card, score: scoreBlob(card.searchBlob, card.name, tokens),
  })));
  const groups = rank(catalog.otherGroups.map((card) => ({
    kind: "group" as const, card, score: scoreBlob(card.searchBlob, card.name, tokens),
  })));
  const prefabs = rank(catalog.prefabs.map((card) => ({
    kind: "prefab" as const, card, score: scoreBlob(card.searchBlob, card.name, tokens),
  })));
  const tiles = rank(tileSearchEntries(tileset).map((entry) => ({
    kind: "tile" as const, index: entry.index, label: entry.label, score: scoreBlob(entry.blob, entry.label, tokens),
  })));
  return {
    terrain: terrain.slice(0, SEARCH_CAP),
    groups: groups.slice(0, SEARCH_CAP),
    prefabs: prefabs.slice(0, SEARCH_CAP),
    tiles: tiles.slice(0, SEARCH_CAP),
    terrainTotal: terrain.length,
    groupTotal: groups.length,
    prefabTotal: prefabs.length,
    tileTotal: tiles.length,
  };
}

/** 프리팹 썸네일. 큰 킷은 가운데 쪽으로 최대 5×4칸만 뽑는다. 윗칸이 있으면 그 칸을 보여 준다. */
export function prefabThumbTiles(kit: SectionStructureKitDef, tileCount: number): { readonly columns: number; readonly tiles: readonly number[] } {
  const width = Math.max(1, kit.width || kit.rows[0]?.tiles.length || 1);
  const height = Math.max(1, kit.height || kit.rows.length || 1);
  const cols = Math.min(5, width);
  const rows = Math.min(4, height);
  const tiles: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    const srcY = Math.min(height - 1, Math.floor(((row + 0.5) * height) / rows));
    const rowDef = kit.rows[srcY];
    for (let col = 0; col < cols; col += 1) {
      const srcX = Math.min(width - 1, Math.floor(((col + 0.5) * width) / cols));
      const upper = rowDef?.upperTiles?.[srcX];
      const lower = rowDef?.tiles[srcX];
      const picked = inRange(upper, tileCount) ? upper! : lower;
      tiles.push(inRange(picked, tileCount) ? picked! : -1);
    }
  }
  return { columns: cols, tiles };
}

function buildPaletteCatalog(tileset: TilesetDef): PaletteCatalog {
  const autotiles = autotileGroupsForTileset(tileset);
  const memberIds = new Set<number>();
  for (const group of autotiles) for (const id of group.memberTileIds) memberIds.add(id);
  const terrain: TerrainCard[] = [];
  const seenTiles = new Set<number>();
  for (const group of autotiles) {
    const paintTile = autotilePaintTile(group);
    if (!inRange(paintTile, tileset.count)) continue;
    const card = terrainCardFromAutotile(tileset, group, paintTile);
    terrain.push(card);
    seenTiles.add(paintTile);
  }
  const otherGroups: GroupSearchCard[] = [];
  for (const group of tileset.tileGroups ?? []) {
    const paintTile = firstInRange(group.tileIds, tileset.count);
    if (paintTile === undefined) continue;
    if (isTerrainLikeGroup(group)) {
      if (overlapsAutotile(group.tileIds, memberIds)) continue;
      terrain.push(terrainCardFromGroup(tileset, group, paintTile));
      seenTiles.add(paintTile);
      continue;
    }
    otherGroups.push({
      id: group.id,
      name: group.name?.trim() || group.id,
      paintTile,
      role: String(group.role),
      searchBlob: groupBlob(tileset, group, paintTile),
    });
  }
  const prefabs: PrefabCard[] = [];
  for (const kit of tileset.structureKits ?? []) {
    if (kit.kind !== "section") continue;
    const paintTile = firstKitTile(kit, tileset.count);
    if (paintTile === undefined) continue;
    prefabs.push(prefabCard(kit, paintTile));
  }
  return { terrain, prefabs, otherGroups };
}

function terrainCardFromAutotile(tileset: TilesetDef, group: AutotileGroup, paintTile: number): TerrainCard {
  const name = group.name?.trim() || group.id;
  const chip = classifyTerrainChip(name, group.id, "", sampleTags(tileset, group.memberTileIds));
  return {
    id: `auto:${group.id}`,
    kind: "autotile",
    name,
    chip,
    paintTile,
    layer: autotileGroupLayer(group),
    memberCount: group.memberTileIds.length,
    autotileGroupId: group.id,
    searchBlob: `${name} ${group.id} ${chip} autotile 오토타일 ${sampleTags(tileset, group.memberTileIds).join(" ")}`.toLowerCase(),
  };
}

function terrainCardFromGroup(tileset: TilesetDef, group: TileGroupMetadata, paintTile: number): TerrainCard {
  const name = group.name?.trim() || group.id;
  const role = String(group.role);
  const chip = classifyTerrainChip(name, group.id, role, sampleTags(tileset, group.tileIds));
  return {
    id: `group:${group.id}`,
    kind: "group",
    name,
    chip,
    paintTile,
    layer: group.defaultLayer === "upper" ? "upper" : "lower",
    memberCount: group.tileIds.length,
    tileGroupId: group.id,
    searchBlob: groupBlob(tileset, group, paintTile),
  };
}

function prefabCard(kit: SectionStructureKitDef, paintTile: number): PrefabCard {
  const name = kit.name?.trim() || kit.ai?.description?.trim() || kit.id;
  const role = kit.ai?.role ? String(kit.ai.role) : "";
  const themes = kit.ai?.themes ?? [];
  const tags = kit.ai?.tags ?? [];
  return {
    id: kit.id,
    name,
    role,
    roleLabel: role ? (PREFAB_ROLE_LABELS[role] ?? role) : "프리팹",
    themes,
    tags,
    width: kit.width,
    height: kit.height,
    paintTile,
    kit,
    searchBlob: [name, kit.id, role, kit.ai?.description ?? "", kit.ai?.interiorRole ?? "", ...themes, ...tags].join(" ").toLowerCase(),
  };
}

function groupBlob(tileset: TilesetDef, group: TileGroupMetadata, paintTile: number): string {
  return [
    group.name, group.id, String(group.role), group.description, String(paintTile),
    ...sampleTags(tileset, group.tileIds),
  ].join(" ").toLowerCase();
}

const CHIP_RULES: readonly { readonly id: Exclude<TerrainChipId, "all">; readonly roles: readonly string[]; readonly pattern: RegExp }[] = [
  { id: "fence", roles: ["fence"], pattern: /fence|울타리|난간|울짱/i },
  { id: "roof", roles: ["roof"], pattern: /roof|기와|지붕/i },
  { id: "water", roles: ["water"], pattern: /water|river|lake|sea|canal|lava|pond|물|강|호수|바다|운하|연못|해자|용암/i },
  { id: "wall", roles: ["wall"], pattern: /wall|cliff|성벽|담장|돌담|벽|축대|절벽/i },
  { id: "road", roles: ["path"], pattern: /road|path|street|길|가로|골목|포석|판석/i },
  { id: "ground", roles: ["terrain", "ground"], pattern: /grass|ground|dirt|sand|snow|soil|floor|plaza|yard|terrain|땅|잔디|흙|모래|눈|마당|바닥|광장|밭|논/i },
];

export function classifyTerrainChip(name: string, id: string, role: string, tags: readonly string[]): Exclude<TerrainChipId, "all"> {
  const haystack = `${name} ${id} ${tags.join(" ")}`;
  for (const rule of CHIP_RULES) {
    if (rule.roles.includes(role) || rule.pattern.test(haystack)) return rule.id;
  }
  return "ground";
}

function isTerrainLikeGroup(group: TileGroupMetadata): boolean {
  if (TERRAIN_ROLES.has(String(group.role))) return true;
  const kind = group.patternGrammar?.kind;
  return kind === "autotile_3x3" || kind === "animated_terrain";
}

function overlapsAutotile(tileIds: readonly number[], members: ReadonlySet<number>): boolean {
  let seen = 0;
  let inside = 0;
  for (const id of tileIds) {
    if (id < 0) continue;
    seen += 1;
    if (members.has(id)) inside += 1;
  }
  return seen > 0 && inside * 2 >= seen;
}

function sampleTags(tileset: TilesetDef, tileIds: readonly number[]): string[] {
  const tags: string[] = [];
  for (const id of tileIds) {
    if (tags.length >= 8) break;
    const meta = tileset.tileMeta?.[id];
    if (!meta) continue;
    if (meta.role) tags.push(meta.role);
    for (const tag of meta.tags ?? []) {
      tags.push(tag);
      if (tags.length >= 8) break;
    }
  }
  return tags;
}

function firstKitTile(kit: SectionStructureKitDef, tileCount: number): number | undefined {
  for (const row of kit.rows) {
    for (const tile of row.upperTiles ?? []) if (inRange(tile, tileCount)) return tile;
    for (const tile of row.tiles) if (inRange(tile, tileCount)) return tile;
  }
  return undefined;
}

function firstInRange(tileIds: readonly number[], tileCount: number): number | undefined {
  for (const id of tileIds) if (inRange(id, tileCount)) return id;
  return undefined;
}

function inRange(tile: number | undefined, tileCount: number): tile is number {
  return typeof tile === "number" && tile >= 0 && tile < tileCount;
}

function catalogToken(tileset: TilesetDef): string {
  return [
    tileset.count,
    tileset.autotileGroups?.length ?? 0,
    tileset.tileGroups?.length ?? 0,
    tileset.structureKits?.length ?? 0,
  ].join("|");
}

function scoreBlob(blob: string, label: string, tokens: readonly string[]): number | null {
  const name = label.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (!blob.includes(token) && !name.includes(token)) return null;
    if (name === token) score += 100;
    else if (name.startsWith(token)) score += 70;
    else if (name.includes(token)) score += 50;
    else score += 20;
  }
  return score;
}

function rank<T extends { readonly score: number | null }>(items: readonly T[]): (T & { readonly score: number })[] {
  return items.filter((item): item is T & { readonly score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score);
}

function tileSearchEntries(tileset: TilesetDef): readonly TileSearchEntry[] {
  const cached = tileIndexCache.get(tileset);
  if (cached) return cached;
  const entries: TileSearchEntry[] = [];
  const meta = tileset.tileMeta;
  if (Array.isArray(meta)) {
    const limit = Math.min(meta.length, tileset.count);
    for (let index = 0; index < limit; index += 1) {
      const item = meta[index];
      if (!item) continue;
      const label = item.label?.trim() ?? "";
      const tags = item.tags?.join(" ") ?? "";
      const role = item.role ?? "";
      if (!label && !tags && !role) continue;
      entries.push({
        index,
        label: label || `타일 ${index}`,
        blob: `${index} ${label} ${tags} ${role} ${item.description ?? ""}`.toLowerCase(),
      });
    }
  }
  tileIndexCache.set(tileset, entries);
  return entries;
}
