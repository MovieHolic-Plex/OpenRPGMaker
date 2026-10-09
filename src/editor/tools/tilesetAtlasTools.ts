// editor/tools/tilesetAtlasTools.ts
// 타일셋 아틀라스 저작(생성/속성/오토타일 그룹/애니메이션 스트립/그래프트).
// 기하 축소 정책: 저작된 메타·그룹·스트립·그래프트가 잘릴 때는 충돌을 이름 붙여 거부한다.
// 빈 슬롯만 잘릴 때는 UI resizeTilesetSlotArrays 와 같이 배열을 자르고 경고한다.
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import { DEFAULT_TILE_COUNT, DEFAULT_TILE_SIZE, DEFAULT_TILES_PER_ROW } from "@/project/defaults/constants";
import type {
  AssetRef,
  AutotileGroup,
  AutotileNeighborhood,
  PassFlag,
  Project,
  TileGraft,
  TileAiMetadata,
  TilesetAnimationStrip,
  TilesetDef,
  TilesetKind,
} from "@/project/types";
import { genId } from "@/util/id";
import {
  ANIMATION_STRIP_SCHEMA,
  AUTOTILE_GROUP_SCHEMA,
  TILE_GRAFT_SCHEMA,
  TILESET_PROPERTY_SCHEMAS,
} from "./tilesetAtlasSchemas";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const MAX_SAMPLE = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ToolError(`${label}는 객체여야 합니다.`, { code: "invalid-args" });
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ToolError(`${label}는 비어 있지 않은 문자열이어야 합니다.`, { code: "invalid-args" });
  }
  return value.trim();
}

function requirePositiveInteger(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ToolError(`${label}는 1 이상의 정수여야 합니다: ${String(value)}`, { code: "invalid-args" });
  }
  return parsed;
}

function sharedPrefixLength(left: string, right: string): number {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) index += 1;
  return index;
}

// 12개 샘플은 "모델이 다음 호출에 쓸 값"이어야 한다. 기본 번들 타일셋이 20개를 넘으므로 단순
// slice 는 방금 만든 타일셋을 잘라내 거부가 행동 불가능해진다 — 요청한 id 와 가까운 것부터 싣는다.
// 점수가 같으면 호출자가 넘긴 원래 순서를 지킨다(sort 안정성) — 그 자리에서 진짜 쓰는 값이 앞에 온다.
function availableMessage(values: readonly string[], requested = ""): string {
  const ranked = [...values].sort((left, right) =>
    sharedPrefixLength(right, requested) - sharedPrefixLength(left, requested));
  const sample = ranked.slice(0, MAX_SAMPLE);
  return sample.length > 0 ? `사용 가능: ${sample.join(", ")}${values.length > sample.length ? " …" : ""}` : "사용 가능한 값 없음";
}

function requireTileset(project: Project, value: unknown): TilesetDef {
  const id = requireString(value, "tilesetId");
  const tileset = project.tilesets[id];
  if (!tileset) {
    throw new ToolError(`타일셋을 찾을 수 없습니다: ${id} (${availableMessage(Object.keys(project.tilesets), id)})`, {
      code: "tileset-not-found",
    });
  }
  return tileset;
}

function requireTileIndex(tileset: TilesetDef, value: unknown, label: string): number {
  const tile = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) {
    throw new ToolError(`${label} 범위 밖: ${String(value)} (유효 범위 0~${tileset.count - 1})`, {
      code: "tile-out-of-range",
    });
  }
  return tile;
}

function tileArray(tileset: TilesetDef, value: unknown, label: string, required: boolean): number[] | undefined {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value)) throw new ToolError(`${label}는 타일 id 배열이어야 합니다.`, { code: "invalid-args" });
  const result = value.map((entry) => requireTileIndex(tileset, entry, label));
  if (required && result.length === 0) throw new ToolError(`${label}가 비어 있습니다.`, { code: "invalid-args" });
  return [...new Set(result)];
}

function bundledImageIds(project: Project): string[] {
  return [...new Set(Object.values(project.tilesets)
    .filter((tileset) => tileset.image.type === "bundled")
    .map((tileset) => tileset.image.id))];
}

function requireImage(project: Project, value: unknown): AssetRef {
  const record = requireRecord(value, "image");
  const type = record.type;
  const id = requireString(record.id, "image.id");
  if (type === "bundled") {
    const valid = bundledImageIds(project);
    if (!valid.includes(id)) {
      throw new ToolError(`알 수 없는 bundled 이미지: ${id} (${availableMessage(valid, id)})`, { code: "invalid-args" });
    }
    return { type, id };
  }
  if (type === "uploaded") {
    const valid = Object.keys(project.assets.uploaded);
    if (!project.assets.uploaded[id]) {
      throw new ToolError(`업로드 이미지를 찾을 수 없습니다: ${id} (${availableMessage(valid, id)})`, { code: "invalid-args" });
    }
    return { type, id };
  }
  throw new ToolError(`image.type은 bundled/uploaded 중 하나여야 합니다: ${String(type)}`, { code: "invalid-args" });
}

function openPassability(): PassFlag {
  return { up: true, down: true, left: true, right: true };
}

function resizeSlotArrays(tileset: TilesetDef, count: number): void {
  while (tileset.passability.length < count) tileset.passability.push(openPassability());
  while (tileset.priority.length < count) tileset.priority.push("lower");
  while (tileset.terrain.length < count) tileset.terrain.push(0);
  if (tileset.tileMeta) {
    while (tileset.tileMeta.length < count) {
      tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
    }
  }
  tileset.passability.length = count;
  tileset.priority.length = count;
  tileset.terrain.length = count;
  if (tileset.tileMeta) tileset.tileMeta.length = Math.min(tileset.tileMeta.length, count);
  tileset.count = count;
}

function authoredMeta(meta: TileAiMetadata | undefined): boolean {
  if (!meta) return false;
  return Boolean(
    meta.label.trim() || meta.description.trim() || meta.tags?.length || meta.role || meta.defaultLayer ||
    meta.terrainTag !== undefined || meta.passage || meta.origin || meta.locked || meta.userLocked,
  );
}

function truncationConflicts(tileset: TilesetDef, count: number): string[] {
  const conflicts: string[] = [];
  for (let tile = count; tile < (tileset.tileMeta?.length ?? 0); tile += 1) {
    if (authoredMeta(tileset.tileMeta?.[tile])) conflicts.push(`tileMeta 타일 ${tile}`);
  }
  for (const group of tileset.tileGroups ?? []) {
    const ids = group.tileIds.filter((tile) => tile >= count);
    if (ids.length > 0) conflicts.push(`tileGroups.${group.id} 타일 ${ids.join(",")}`);
  }
  for (const preset of tileset.palettePresets ?? []) {
    const ids = preset.slots.flatMap((slot) => slot.tileIds).filter((tile) => tile >= count);
    if (ids.length > 0) conflicts.push(`palettePresets.${preset.id} 타일 ${ids.join(",")}`);
  }
  for (const group of tileset.autotileGroups ?? []) {
    const ids = [
      ...group.memberTileIds,
      ...(group.connectTileIds ?? []),
      ...(group.triggerTileIds ?? []),
      ...Object.values(group.variantMap),
    ].filter((tile) => tile >= count);
    if (ids.length > 0) conflicts.push(`autotileGroups.${group.id} 타일 ${[...new Set(ids)].join(",")}`);
  }
  for (const strip of tileset.animationStrips ?? []) {
    const end = strip.baseTile + strip.frames - 1;
    if (end >= count) conflicts.push(`animationStrips ${strip.baseTile}~${end}`);
  }
  for (const graft of tileset.tileGrafts ?? []) {
    if (graft.targetTile >= count) conflicts.push(`tileGrafts 타일 ${graft.targetTile}`);
  }
  return conflicts;
}

function uniqueTilesetId(project: Project): string {
  let id = genId("ts");
  while (project.tilesets[id]) id = genId("ts");
  return id;
}

const createTileset: ToolDefinition = {
  name: "create_tileset",
  description: "새 타일셋 정의와 통행/우선순위/지형 슬롯 배열을 생성해 타일 메타데이터·그룹을 즉시 저작할 수 있게 한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { id: { type: "string" }, ...TILESET_PROPERTY_SCHEMAS },
    required: ["name", "image"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const id = typeof args.id === "string" && args.id.trim() ? args.id.trim() : uniqueTilesetId(draft);
    if (draft.tilesets[id]) {
      throw new ToolError(`이미 존재하는 tileset id: ${id} (${availableMessage(Object.keys(draft.tilesets), id)})`, { code: "duplicate-id" });
    }
    const name = requireString(args.name, "name");
    const image = requireImage(draft, args.image);
    const kind = args.kind === undefined ? undefined : args.kind as TilesetKind;
    const tileSize = args.tileSize === undefined ? DEFAULT_TILE_SIZE : requirePositiveInteger(args.tileSize, "tileSize");
    const tilesPerRow = args.tilesPerRow === undefined ? DEFAULT_TILES_PER_ROW : requirePositiveInteger(args.tilesPerRow, "tilesPerRow");
    const count = args.count === undefined ? DEFAULT_TILE_COUNT : requirePositiveInteger(args.count, "count");
    const transparentColor = args.transparentColor === undefined ? undefined : normalizeRgbHexColor(requireString(args.transparentColor, "transparentColor"));
    if (args.transparentColor !== undefined && !transparentColor) {
      throw new ToolError(`transparentColor는 #rrggbb 형식이어야 합니다: ${String(args.transparentColor)}`, { code: "invalid-args" });
    }
    const tileset: TilesetDef = {
      id,
      name,
      image,
      ...(kind ? { kind } : {}),
      tileSize,
      tilesPerRow,
      count,
      passability: Array.from({ length: count }, openPassability),
      priority: Array.from({ length: count }, () => "lower" as const),
      terrain: Array.from({ length: count }, () => 0),
      ...(transparentColor ? { transparentColor } : {}),
    };
    draft.tilesets[id] = tileset;
    return { summary: `타일셋 '${name}' 생성(${id}, ${count}칸)`, data: { tilesetId: id } };
  },
};

const setTilesetProperties: ToolDefinition = {
  name: "set_tileset_properties",
  description: "타일셋 이름·그림·종류·타일 크기·행 폭·개수·투명색을 패치한다. 저작 데이터가 잘리는 count 축소는 거부한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string" },
      ...TILESET_PROPERTY_SCHEMAS,
      clearTransparentColor: { type: "boolean", description: "true면 transparentColor 필드를 명시적으로 삭제" },
    },
    required: ["tilesetId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const changes: string[] = [];
    const warnings: string[] = [];
    if (args.name !== undefined) {
      tileset.name = requireString(args.name, "name");
      changes.push("name");
    }
    if (args.image !== undefined) {
      tileset.image = requireImage(draft, args.image);
      changes.push("image");
    }
    if (args.kind !== undefined) {
      tileset.kind = args.kind as TilesetKind;
      changes.push("kind");
    }
    if (args.tileSize !== undefined) {
      tileset.tileSize = requirePositiveInteger(args.tileSize, "tileSize");
      for (const map of Object.values(draft.maps)) {
        if (map.tilesetId === tileset.id) map.tileSize = tileset.tileSize;
      }
      changes.push("tileSize");
    }
    if (args.tilesPerRow !== undefined) {
      tileset.tilesPerRow = requirePositiveInteger(args.tilesPerRow, "tilesPerRow");
      changes.push("tilesPerRow");
    }
    if (args.count !== undefined) {
      const count = requirePositiveInteger(args.count, "count");
      if (count < tileset.count) {
        const conflicts = truncationConflicts(tileset, count);
        if (conflicts.length > 0) {
          throw new ToolError(
            `count ${count} 축소가 저작 데이터를 자릅니다: ${conflicts.slice(0, MAX_SAMPLE).join("; ")}${conflicts.length > MAX_SAMPLE ? " …" : ""}`,
            { code: "tileset-count-conflict" },
          );
        }
        warnings.push(`빈 타일 슬롯을 ${tileset.count}칸에서 ${count}칸으로 잘랐습니다.`);
      }
      resizeSlotArrays(tileset, count);
      changes.push("count");
    }
    if (args.transparentColor !== undefined) {
      const color = normalizeRgbHexColor(requireString(args.transparentColor, "transparentColor"));
      if (!color) throw new ToolError(`transparentColor는 #rrggbb 형식이어야 합니다: ${String(args.transparentColor)}`, { code: "invalid-args" });
      tileset.transparentColor = color;
      changes.push("transparentColor");
    }
    if (args.clearTransparentColor === true) {
      delete tileset.transparentColor;
      changes.push("transparentColor 삭제");
    }
    if (changes.length === 0) throw new ToolError("바꿀 타일셋 속성이 없습니다.", { code: "invalid-args" });
    return { summary: `타일셋 '${tileset.name}' 속성 변경: ${changes.join(", ")}`, warnings };
  },
};

function nextAutotileId(groups: readonly AutotileGroup[]): string {
  let index = 1;
  while (groups.some((group) => group.id === `autotile_${index}`)) index += 1;
  return `autotile_${index}`;
}

function requireVariantMap(tileset: TilesetDef, value: unknown): Record<string, number> {
  const record = requireRecord(value, "group.variantMap");
  const result: Record<string, number> = {};
  for (const [mask, rawTile] of Object.entries(record)) {
    if (!/^\d+$/.test(mask)) {
      throw new ToolError(`variantMap 키는 10진수 비트마스크여야 합니다: ${mask}`, { code: "invalid-args" });
    }
    result[mask] = requireTileIndex(tileset, rawTile, `variantMap.${mask}`);
  }
  return result;
}

const upsertAutotileGroup: ToolDefinition = {
  name: "upsert_autotile_group",
  description: "타일셋의 오토타일 그룹(이웃 범위·멤버·연결·트리거·비트마스크 변형표)을 생성하거나 같은 id로 교체한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { tilesetId: { type: "string" }, group: AUTOTILE_GROUP_SCHEMA },
    required: ["tilesetId", "group"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const record = requireRecord(args.group, "group");
    const groups = tileset.autotileGroups ?? [];
    const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : nextAutotileId(groups);
    const name = requireString(record.name, "group.name");
    const neighborhood = (record.neighborhood ?? 4) as AutotileNeighborhood;
    if (neighborhood !== 4 && neighborhood !== 8) {
      throw new ToolError(`group.neighborhood는 4/8 중 하나여야 합니다: ${String(record.neighborhood)}`, { code: "invalid-args" });
    }
    const memberTileIds = tileArray(tileset, record.memberTileIds, "group.memberTileIds", true) ?? [];
    const connectTileIds = tileArray(tileset, record.connectTileIds, "group.connectTileIds", false);
    const triggerTileIds = tileArray(tileset, record.triggerTileIds, "group.triggerTileIds", false);
    const variantMap = requireVariantMap(tileset, record.variantMap);
    const group: AutotileGroup = {
      id,
      name,
      neighborhood,
      memberTileIds,
      ...(connectTileIds ? { connectTileIds } : {}),
      ...(triggerTileIds ? { triggerTileIds } : {}),
      variantMap,
    };
    const index = groups.findIndex((candidate) => candidate.id === id);
    tileset.autotileGroups = index < 0
      ? [...groups, group]
      : groups.map((candidate, candidateIndex) => candidateIndex === index ? group : candidate);
    return { summary: `오토타일 그룹 '${name}' ${index < 0 ? "생성" : "갱신"}(${id})`, data: { groupId: id } };
  },
};

const deleteAutotileGroup: ToolDefinition = {
  name: "delete_autotile_group",
  description: "타일셋의 오토타일 그룹을 id로 삭제한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { tilesetId: { type: "string" }, groupId: { type: "string" } },
    required: ["tilesetId", "groupId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const groupId = requireString(args.groupId, "groupId");
    const groups = tileset.autotileGroups ?? [];
    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group) {
      throw new ToolError(`오토타일 그룹을 찾을 수 없습니다: ${groupId} (${availableMessage(groups.map((candidate) => candidate.id), groupId)})`, {
        code: "group-not-found",
      });
    }
    const next = groups.filter((candidate) => candidate.id !== groupId);
    if (next.length > 0) tileset.autotileGroups = next;
    else delete tileset.autotileGroups;
    return { summary: `오토타일 그룹 '${group.name}' 삭제(${groupId})` };
  },
};

function requireAnimationStrip(tileset: TilesetDef, value: unknown): TilesetAnimationStrip {
  const record = requireRecord(value, "strip");
  const baseTile = requireTileIndex(tileset, record.baseTile, "strip.baseTile");
  const frames = requirePositiveInteger(record.frames, "strip.frames");
  const fps = typeof record.fps === "number" ? record.fps : Number(record.fps);
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new ToolError(`strip.fps는 0보다 커야 합니다: ${String(record.fps)}`, { code: "invalid-args" });
  }
  const endTile = baseTile + frames - 1;
  if (endTile >= tileset.count || baseTile % tileset.tilesPerRow + frames > tileset.tilesPerRow) {
    throw new ToolError(
      `애니메이션 스트립 ${baseTile}~${endTile}은 같은 행의 유효 타일이어야 합니다 (전체 유효 범위 0~${tileset.count - 1}, 행 폭 ${tileset.tilesPerRow})`,
      { code: "tile-out-of-range" },
    );
  }
  return { baseTile, frames, fps };
}

const setAnimationStrips: ToolDefinition = {
  name: "set_animation_strips",
  description: "타일셋의 가로 연속 애니메이션 스트립(baseTile·frames·fps)을 교체하거나 baseTile 기준으로 병합한다. 빈 목록은 모두 제거한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string" },
      strips: { type: "array", items: ANIMATION_STRIP_SCHEMA },
      mode: { type: "string", enum: ["replace", "append"], description: "기본 replace. append는 같은 baseTile 스트립을 새 값으로 교체." },
    },
    required: ["tilesetId", "strips"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    if (!Array.isArray(args.strips)) throw new ToolError("strips는 배열이어야 합니다.", { code: "invalid-args" });
    const strips = args.strips.map((entry) => requireAnimationStrip(tileset, entry));
    const mode = args.mode === "append" ? "append" : "replace";
    const next = mode === "replace" ? strips : [...(tileset.animationStrips ?? [])];
    if (mode === "append") {
      for (const strip of strips) {
        const index = next.findIndex((candidate) => candidate.baseTile === strip.baseTile);
        if (index >= 0) next[index] = strip;
        else next.push(strip);
      }
    }
    if (next.length > 0) tileset.animationStrips = next;
    else delete tileset.animationStrips;
    return { summary: `타일 애니메이션 스트립 ${next.length}개 설정(${mode})` };
  },
};

function sourceIds(project: Project): string[] {
  return [...new Set([
    ...Object.values(project.tilesets).map((tileset) => tileset.image.id),
    ...Object.keys(project.tilesets),
    ...Object.keys(project.assets.uploaded),
    ...Object.keys(project.assets.sprites),
  ])];
}

function sourceTileCount(project: Project, source: string): number {
  const byTilesetId = project.tilesets[source];
  if (byTilesetId) return byTilesetId.count;
  const byImage = Object.values(project.tilesets).find((tileset) => tileset.image.id === source);
  return byImage?.count ?? DEFAULT_TILE_COUNT;
}

function requireTileGraft(project: Project, tileset: TilesetDef, value: unknown): TileGraft {
  const record = requireRecord(value, "graft");
  const targetTile = requireTileIndex(tileset, record.targetTile, "graft.targetTile");
  const sourceChipset = requireString(record.sourceChipset, "graft.sourceChipset");
  const validSources = sourceIds(project);
  if (!validSources.includes(sourceChipset)) {
    throw new ToolError(`sourceChipset을 찾을 수 없습니다: ${sourceChipset} (${availableMessage(validSources, sourceChipset)})`, {
      code: "invalid-args",
    });
  }
  const sourceCount = sourceTileCount(project, sourceChipset);
  const sourceTile = typeof record.sourceTile === "number" ? record.sourceTile : Number(record.sourceTile);
  if (!Number.isInteger(sourceTile) || sourceTile < 0 || sourceTile >= sourceCount) {
    throw new ToolError(`graft.sourceTile 범위 밖: ${String(record.sourceTile)} (유효 범위 0~${sourceCount - 1})`, {
      code: "tile-out-of-range",
    });
  }
  return { targetTile, sourceChipset, sourceTile };
}

const setTileGrafts: ToolDefinition = {
  name: "set_tile_grafts",
  description: "타일셋 슬롯에 다른 칩셋 타일을 이식하고, targetTile 목록으로 기존 이식을 제거한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string" },
      grafts: { type: "array", items: TILE_GRAFT_SCHEMA, description: "targetTile 기준 등록/교체" },
      remove: { type: "array", items: { type: "integer" }, description: "제거할 targetTile 목록" },
    },
    required: ["tilesetId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    if (args.grafts === undefined && args.remove === undefined) {
      throw new ToolError("grafts 또는 remove 중 하나가 필요합니다.", { code: "invalid-args" });
    }
    if (args.grafts !== undefined && !Array.isArray(args.grafts)) {
      throw new ToolError("grafts는 배열이어야 합니다.", { code: "invalid-args" });
    }
    if (args.remove !== undefined && !Array.isArray(args.remove)) {
      throw new ToolError("remove는 targetTile 배열이어야 합니다.", { code: "invalid-args" });
    }
    const grafts = (args.grafts ?? []).map((entry) => requireTileGraft(draft, tileset, entry));
    const remove = (args.remove ?? []).map((entry) => requireTileIndex(tileset, entry, "remove"));
    const replacedTargets = new Set(grafts.map((graft) => graft.targetTile));
    const removedTargets = new Set(remove);
    const next = (tileset.tileGrafts ?? []).filter(
      (graft) => !replacedTargets.has(graft.targetTile) && !removedTargets.has(graft.targetTile),
    );
    next.push(...grafts);
    if (next.length > 0) tileset.tileGrafts = next;
    else delete tileset.tileGrafts;
    return { summary: `타일 이식 ${grafts.length}건 등록, ${remove.length}건 제거` };
  },
};

export const TILESET_ATLAS_TOOLS: readonly ToolDefinition[] = [
  createTileset,
  setTilesetProperties,
  upsertAutotileGroup,
  deleteAutotileGroup,
  setAnimationStrips,
  setTileGrafts,
];
