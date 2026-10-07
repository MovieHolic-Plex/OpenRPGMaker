// src/project/workshopTiles.ts
/**
 * 공방 2단계(2026-10-07): 공방에서 그려 고른 기물을 손 도트 실내 칩셋(atlas_biome_interior)에 굽는다.
 * 위키: openwiki/editor-workshop.md 「칩셋에 굽기」.
 *
 * - 그림 = 프로젝트 업로드 자산(kind "tileset", id `workshop_<해시>`, 16px 칸을 30칸 폭으로 늘어놓은 시트).
 * - 칩셋 = tileGrafts 로 그 칸을 번들 칸 뒤(행 맞춤)에 덧붙인다. 번들 칸 번호는 하나도 안 바뀐다.
 * - 물체 = 구조 킷(learnedFrom "workshop", id `workshop:<이름>`). stamp_tileset_object 와 build_hand_interior_room 이 같은 id 로 쓴다.
 *
 * 번호 이주: 번들 시트를 새로 구우면 칸이 끝에 덧붙어(pin_ids.py) 공방 칸 번호와 겹칠 수 있다.
 * ensureAtlasBiomeInteriorCurrent 가 정의를 새로 고치기 전에 공방 칸을 떼어 두고(detach) 새 번들 끝 뒤에 다시 붙인다(attach).
 * 번호가 바뀌면 그 칩셋을 쓰는 맵의 네 층을 함께 고쳐 쓴다.
 */
import type { PassFlag, SectionStructureKitDef, StructureKitLearnedFrom, TileAiMetadata, TileGraft, TilesetDef } from "./types";

export const WORKSHOP_ASSET_PREFIX = "workshop_";
export const WORKSHOP_OBJECT_PREFIX = "workshop:";
export const WORKSHOP_LEARNED_FROM: StructureKitLearnedFrom = "workshop";
/** 공방 칸을 행에 맞추려고 끼운 빈 칸. 떼어 낼 때 이 이름표로 알아본다. */
const PAD_LABEL = "공방 칸 자리(빈 칸)";
const rowAlignedTileCount = (count: number, perRow: number): number => Math.ceil(Math.max(0, count) / Math.max(1, perRow)) * Math.max(1, perRow);
const PASS: PassFlag = { up: true, down: true, left: true, right: true };
const BLOCK: PassFlag = { up: false, down: false, left: false, right: false };

/** 손 도트 실내의 기물 종류: floor 바닥 · wall 북쪽 벽 앞 · hang 벽면 걸이 · flat 밟는 바닥 무늬 */
export type WorkshopHandKind = "floor" | "wall" | "hang" | "flat";
const HAND_KINDS: readonly WorkshopHandKind[] = ["floor", "wall", "hang", "flat"];

export interface WorkshopObjectInput {
  /** `workshop:` 로 시작 */
  readonly objectId: string;
  readonly title: string;
  readonly description: string;
  readonly kind: WorkshopHandKind;
  /** 그림 칸 수 */
  readonly columns: number;
  readonly rows: number;
  /** 발밑(막히는) 줄 수. floor·wall 만 쓴다 — 그 위 줄은 솟은 칸(★, 밟고 지나가며 위에 그려짐). */
  readonly footRows: number;
  /** 발밑 위로 솟은 px(손 도트 사양의 up) */
  readonly risePx: number;
  readonly use: readonly string[];
  /** 같은 그림을 두 번 굽지 않으려고 남기는 격자 해시 */
  readonly gridHash: string;
  readonly asset: { readonly id: string; readonly dataUrl: string; readonly width: number; readonly height: number };
  /** 빈 칸이 아닌 그림 칸. sourceTile = 시트 칸 번호, (dx, dy) = 그림 안 칸 좌표(왼쪽 위 0,0). */
  readonly cells: readonly { readonly sourceTile: number; readonly dx: number; readonly dy: number }[];
}

type ProjectLike = {
  tilesets: Record<string, TilesetDef>;
  assets?: { uploaded: Record<string, unknown> };
  maps?: Readonly<Record<string, MapLayersLike>>;
};
type MapLayersLike = { tilesetId?: string; lowerTiles?: number[]; upperTiles?: number[]; lowerOverlayTiles?: number[]; upperOverlayTiles?: number[] };
const MAP_LAYER_KEYS = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const;

export function isWorkshopGraft(graft: TileGraft): boolean {
  return graft.sourceChipset.startsWith(WORKSHOP_ASSET_PREFIX);
}

export function isWorkshopKit(kit: { learnedFrom: string }): boolean {
  return kit.learnedFrom === WORKSHOP_LEARNED_FROM;
}

export function workshopObjectId(itemKey: string): string {
  const slug = itemKey.replace(/^new:/, "").trim().replace(/\s+/g, "-") || "item";
  return `${WORKSHOP_OBJECT_PREFIX}${slug}`;
}

export function workshopAssetId(dataUrl: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < dataUrl.length; i++) { h ^= dataUrl.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${WORKSHOP_ASSET_PREFIX}${(h >>> 0).toString(16).padStart(8, "0")}_${dataUrl.length.toString(36)}`;
}

function tagValue(kit: SectionStructureKitDef, prefix: string): string | undefined {
  return kit.ai?.tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
}

/** 이 격자 해시로 이미 구운 물체가 있으면 그 킷. */
export function bakedWorkshopKit(tileset: TilesetDef | undefined, objectId: string, gridHash?: string): SectionStructureKitDef | undefined {
  const kit = (tileset?.structureKits ?? []).find((k) => k.id === objectId && isWorkshopKit(k));
  if (!kit) return undefined;
  return gridHash === undefined || tagValue(kit, "grid:") === gridHash ? kit : undefined;
}

function padTo(tileset: TilesetDef, length: number): void {
  while (tileset.passability.length < length) tileset.passability.push({ ...PASS });
  while (tileset.priority.length < length) tileset.priority.push("lower");
  while (tileset.terrain.length < length) tileset.terrain.push(0);
  if (tileset.tileMeta) while (tileset.tileMeta.length < length) tileset.tileMeta.push({ label: PAD_LABEL, description: "", source: "user" } as TileAiMetadata);
}

function truncateTo(tileset: TilesetDef, length: number): void {
  tileset.passability.length = Math.min(tileset.passability.length, length);
  tileset.priority.length = Math.min(tileset.priority.length, length);
  tileset.terrain.length = Math.min(tileset.terrain.length, length);
  if (tileset.tileMeta) tileset.tileMeta.length = Math.min(tileset.tileMeta.length, length);
  tileset.count = length;
}

/**
 * 공방 칸이 들어갈 첫 번호. 첫 공방 칸은 번들 끝·다른 이식 끝 뒤 새 줄에서 시작하고(번들과 섞이지 않게),
 * 그다음 공방 칸은 앞 공방 칸 바로 뒤에 잇는다 — 굽기마다 줄을 맞추면 4칸 기물 하나에 빈 칸이 44개 생긴다.
 */
function appendBase(tileset: TilesetDef): number {
  const others = (tileset.tileGrafts ?? []).filter((g) => !isWorkshopGraft(g)).reduce((max, g) => Math.max(max, g.targetTile + 1), 0);
  const workshop = (tileset.tileGrafts ?? []).filter(isWorkshopGraft).reduce((max, g) => Math.max(max, g.targetTile + 1), 0);
  const start = rowAlignedTileCount(Math.max(others, workshop > 0 ? 0 : tileset.count), tileset.tilesPerRow);
  return Math.max(start, workshop);
}

/**
 * 고른 기물 하나를 칩셋에 굽는다(project 를 제자리에서 고친다 — 호출자는 store.update 초안에 대고 부른다).
 * 같은 id 가 있으면 킷만 새 그림으로 바꾼다. 옛 칸은 지우지 않는다 — 이미 그 칸을 쓴 맵은 옛 그림 그대로 남는다.
 */
export function bakeWorkshopObject(project: ProjectLike, tilesetId: string, input: WorkshopObjectInput): SectionStructureKitDef {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) throw new Error(`칩셋이 없습니다: ${tilesetId}`);
  if (!input.objectId.startsWith(WORKSHOP_OBJECT_PREFIX)) throw new Error(`공방 물체 id 는 ${WORKSHOP_OBJECT_PREFIX} 로 시작해야 합니다: ${input.objectId}`);
  if (!HAND_KINDS.includes(input.kind)) throw new Error(`기물 종류를 모릅니다: ${input.kind}`);
  if (!input.cells.length) throw new Error("그림이 비어 있습니다.");
  const same = bakedWorkshopKit(tileset, input.objectId, input.gridHash);
  if (same) return same;

  if (project.assets && !project.assets.uploaded[input.asset.id]) {
    project.assets.uploaded[input.asset.id] = {
      id: input.asset.id,
      name: `공방 · ${input.title}`,
      kind: "tileset",
      dataUrl: input.asset.dataUrl,
      meta: { tileSize: tileset.tileSize, width: input.asset.width, height: input.asset.height },
    };
  }
  const base = appendBase(tileset);
  padTo(tileset, base);
  tileset.tileGrafts ??= [];
  const foot = input.kind === "floor" || input.kind === "wall" ? Math.max(1, Math.min(input.rows, input.footRows)) : 0;
  const matrix: number[][] = Array.from({ length: input.rows }, () => new Array<number>(input.columns).fill(-1));
  input.cells.forEach((cell, k) => {
    const id = base + k;
    const solid = foot > 0 && cell.dy >= input.rows - foot;
    tileset.tileGrafts!.push({ sourceChipset: input.asset.id, sourceTile: cell.sourceTile, targetTile: id });
    tileset.passability[id] = solid ? { ...BLOCK } : { ...PASS };
    tileset.priority[id] = input.kind === "flat" ? "lower" : "upper";
    tileset.terrain[id] = 0;
    if (tileset.tileMeta) {
      tileset.tileMeta[id] = {
        label: `${input.title} (${cell.dx},${cell.dy - (input.rows - foot)}) · 공방`,
        description: input.description,
        source: "user",
        role: input.kind === "flat" ? "decor" : "furniture",
        defaultLayer: "upper",
        passage: solid ? "solid" : "passable",
        tags: [input.objectId],
        userLocked: true,
      } as TileAiMetadata;
    }
    matrix[cell.dy]![cell.dx] = id;
  });
  tileset.count = base + input.cells.length;

  const stampKind = input.kind === "hang" ? "wallmount" : input.kind === "flat" ? "decal" : input.rows > foot ? "tall" : "prop";
  const kit: SectionStructureKitDef = {
    id: input.objectId,
    kind: "section",
    name: input.title,
    width: input.columns,
    height: input.rows,
    tileSize: tileset.tileSize,
    rows: matrix.map((row) => ({ tiles: row.map(() => -1), upperTiles: row })),
    ai: {
      description: input.description,
      placementRules: input.kind === "hang" ? "벽면 윗줄에 건다." : input.kind === "wall" ? "북쪽 벽면 바로 아래 첫 바닥 줄에 붙인다." : input.kind === "flat" ? "바닥에 깐다(밟고 지나감)." : "바닥에 둔다. 발밑 줄은 막힌다.",
      tags: [stampKind, "workshop", `hand:${input.kind}`, `foot:${foot}`, `rise:${input.risePx}`, `grid:${input.gridHash}`, ...input.use.map((u) => `use:${u}`)],
      role: "prop",
      layerHome: "upper",
      repeatability: "fixed",
    },
    learnedFrom: WORKSHOP_LEARNED_FROM,
    createdAt: new Date().toISOString(),
  };
  tileset.structureKits = [...(tileset.structureKits ?? []).filter((k) => k.id !== input.objectId), kit];
  return kit;
}

/** 칩셋에서 떼어 둔 공방 칸·킷(번들 정의를 새로 고치는 동안 보관). */
export interface ParkedWorkshopTiles {
  readonly tiles: readonly { readonly oldId: number; readonly graft: TileGraft; readonly pass: PassFlag; readonly priority: "lower" | "upper"; readonly terrain: number; readonly meta: TileAiMetadata | undefined }[];
  readonly kits: readonly SectionStructureKitDef[];
}

/**
 * 공방 칸과 킷을 칩셋에서 떼어 낸다. 칸 배열은 번들 끝(공방이 끼운 빈 칸까지 빼고)으로 줄인다.
 * 공방 칸 뒤에 다른 이식이 있으면(공방이 만들지 않은 배치) 건드리지 않고 null.
 */
export function detachWorkshopTiles(tileset: TilesetDef): ParkedWorkshopTiles | null {
  const grafts = (tileset.tileGrafts ?? []).filter(isWorkshopGraft).sort((a, b) => a.targetTile - b.targetTile);
  const kits = (tileset.structureKits ?? []).filter(isWorkshopKit);
  if (!grafts.length && !kits.length) return null;
  const base = grafts.length ? grafts[0]!.targetTile : tileset.count;
  if ((tileset.tileGrafts ?? []).some((g) => !isWorkshopGraft(g) && g.targetTile >= base)) return null;
  const tiles = grafts.map((graft) => ({
    oldId: graft.targetTile,
    graft: { ...graft },
    pass: { ...(tileset.passability[graft.targetTile] ?? PASS) },
    priority: tileset.priority[graft.targetTile] ?? "lower",
    terrain: tileset.terrain[graft.targetTile] ?? 0,
    meta: tileset.tileMeta?.[graft.targetTile] ? structuredClone(tileset.tileMeta[graft.targetTile]) : undefined,
  }));
  const rest = (tileset.tileGrafts ?? []).filter((g) => !isWorkshopGraft(g));
  if (rest.length) tileset.tileGrafts = rest;
  else delete tileset.tileGrafts;
  tileset.structureKits = (tileset.structureKits ?? []).filter((k) => !isWorkshopKit(k));
  let end = Math.min(base, tileset.count);
  while (end > 0 && tileset.tileMeta?.[end - 1]?.label === PAD_LABEL) end -= 1;
  truncateTo(tileset, end);
  return { tiles, kits };
}

/**
 * 떼어 둔 공방 칸을 지금 칩셋 끝 뒤에 다시 붙인다. 번호가 바뀌면 킷과 그 칩셋을 쓰는 맵의 네 층을 고쳐 쓴다.
 * 돌려주는 값 = 번호가 바뀌었는가.
 */
export function attachWorkshopTiles(project: ProjectLike, tilesetId: string, parked: ParkedWorkshopTiles): boolean {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return false;
  const remap = new Map<number, number>();
  if (parked.tiles.length) {
    const base = appendBase(tileset);
    padTo(tileset, base);
    tileset.tileGrafts ??= [];
    parked.tiles.forEach((tile, k) => {
      const id = base + k;
      remap.set(tile.oldId, id);
      tileset.tileGrafts!.push({ ...tile.graft, targetTile: id });
      tileset.passability[id] = { ...tile.pass };
      tileset.priority[id] = tile.priority;
      tileset.terrain[id] = tile.terrain;
      if (tileset.tileMeta) tileset.tileMeta[id] = tile.meta ? structuredClone(tile.meta) : { label: "공방 칸", description: "", source: "user" } as TileAiMetadata;
    });
    tileset.count = base + parked.tiles.length;
  }
  const moved = [...remap].some(([from, to]) => from !== to);
  const re = (tile: number): number => (tile >= 0 ? remap.get(tile) ?? tile : tile);
  const kits = parked.kits.map((kit) => (moved
    ? { ...kit, rows: kit.rows.map((row) => ({ tiles: row.tiles.map(re), ...(row.upperTiles ? { upperTiles: row.upperTiles.map(re) } : {}) })) }
    : kit));
  tileset.structureKits = [...(tileset.structureKits ?? []), ...kits];
  if (moved) {
    for (const map of Object.values(project.maps ?? {})) {
      if (map.tilesetId !== tilesetId) continue;
      for (const key of MAP_LAYER_KEYS) {
        const layer = map[key];
        if (!layer) continue;
        for (let i = 0; i < layer.length; i++) layer[i] = re(layer[i]!);
      }
    }
  }
  return moved;
}

/** 손 도트 실내 사양(handInteriorSpec.json objects)과 같은 모양 — build_hand_interior_room·list_hand_interior_parts 가 섞어 쓴다. */
export interface WorkshopHandObject {
  readonly ko: string; readonly category: string; readonly category_ko: string; readonly kind: WorkshopHandKind;
  readonly w: number; readonly h: number; readonly up: number; readonly cells: readonly (readonly [number, number, number, number])[];
  readonly desc: string; readonly tags: readonly string[]; readonly place: string; readonly pair: readonly string[]; readonly use: readonly string[];
}

/** 칩셋에 구운 공방 물체를 손 도트 실내 사양 꼴로. 키 = 물체 id(workshop:…). */
export function workshopHandObjects(tileset: TilesetDef | undefined): Record<string, WorkshopHandObject> {
  const out: Record<string, WorkshopHandObject> = {};
  for (const kit of tileset?.structureKits ?? []) {
    if (!isWorkshopKit(kit)) continue;
    const kind = (tagValue(kit, "hand:") ?? "floor") as WorkshopHandKind;
    if (!HAND_KINDS.includes(kind)) continue;
    const foot = Number(tagValue(kit, "foot:") ?? 0);
    // 손 도트 사양의 칸 좌표: floor·wall 은 발밑 첫 줄이 dy 0(솟은 칸은 음수), hang·flat 은 맨 윗줄이 dy 0
    const top = kind === "floor" || kind === "wall" ? kit.height - foot : 0;
    const cells: [number, number, number, number][] = [];
    kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
      if (tile >= 0) cells.push([x, y - top, tile, kind === "flat" ? 2 : 3]);
    }));
    out[kit.id] = {
      ko: kit.name ?? kit.id, category: "workshop", category_ko: "공방", kind,
      w: kit.width, h: kind === "hang" ? 0 : kind === "flat" ? kit.height : foot, up: Number(tagValue(kit, "rise:") ?? 0),
      cells, desc: kit.ai?.description ?? "", tags: ["공방"], place: kit.ai?.placementRules ?? "", pair: [],
      use: (kit.ai?.tags ?? []).filter((tag) => tag.startsWith("use:")).map((tag) => tag.slice(4)),
    };
  }
  return out;
}
