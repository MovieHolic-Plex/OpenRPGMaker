// editor/tools/tileMetadataTools.ts
// 타일 의미 학습 툴 5종 — "맵 인터뷰"(소크라테스식 산파법)의 실행 기반.
// - get_tile_info: 타일의 의미/그룹/배치 규칙/통행성 조회(깔기 전 확인용).
// - set_tile_metadata: 타일 라벨/설명/태그 기록. 사용자 확정(confirmedByUser)이면 userLocked.
// - upsert_tile_group: 시맨틱 그룹 + placementRules 기록(여러 타일이 하나의 구조를 이룰 때).
// - analyze_map_tile_usage: 사람이 깐 맵에서 사용된 타일·설명 커버리지·인접 통계를 추출.
// - highlight_map_region: 질문 대상 영역을 에디터 화면에 강조(패널이 selection으로 반영).

import { markUserTileRuntimeMetadata, setTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { COMBINED_TOWN_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsCombinedTown";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX, INTERIOR_TEXTURE_KEY } from "@/project/tilesetHarness";
import { tileMetaLocked } from "@/project/tilesetPalette";
import { isBlockedPassage } from "@/project/tilesetPassage";
import { summarizeTileUsage } from "@/project/tilesetSemanticChecker";
import type { GameMap, Project, TileAiMetadata, TileGroupLayer, TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";
import { CLUSTER_RULE_SCHEMA, requireClusterRules } from "./clusterRuleTools";
import { requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const TILE_GROUP_ROLES: readonly TileGroupRole[] = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"];
const TILE_GROUP_LAYERS: readonly TileGroupLayer[] = ["lower", "upper", "event", "mixed"];
const JUNCTION_SIDES = ["below", "above", "leftOf", "rightOf"] as const;
const JUNCTION_ACTIONS = ["omit", "replace"] as const;
const OVERLAY_WHENS = ["diagonalCorner", "innerCorner", "ridge", "eaveEnd"] as const;

type TileGroupJunctionRule = NonNullable<TileGroupMetadata["junctions"]>[number];
type TileGroupOverlayRule = NonNullable<TileGroupMetadata["overlays"]>[number];
type JunctionSide = TileGroupJunctionRule["side"];
type JunctionAction = TileGroupJunctionRule["action"];
type OverlayWhen = TileGroupOverlayRule["when"];

const JUNCTION_SCHEMA = {
  type: "object",
  properties: {
    withRole: { type: "string", enum: TILE_GROUP_ROLES, description: "맞닿는 상대 그룹 역할" },
    side: { type: "string", enum: JUNCTION_SIDES, description: "상대 그룹이 맞닿는 방향" },
    action: { type: "string", enum: JUNCTION_ACTIONS, description: "영향 타일 처리 방식" },
    atRoles: { type: "array", items: { type: "string" }, description: "patternGrammar.parts[].role 중 영향 줄 위치" },
    replaceWith: { type: "array", items: { type: "integer" }, description: "replace일 때 대체 타일" },
  },
  required: ["withRole", "side", "action"],
  additionalProperties: true,
} satisfies JsonSchema;

const OVERLAY_SCHEMA = {
  type: "object",
  properties: {
    when: { type: "string", enum: OVERLAY_WHENS, description: "오버레이 조건" },
    tileIds: { type: "array", items: { type: "integer" }, description: "상위 레이어에 더할 타일" },
  },
  required: ["when", "tileIds"],
  additionalProperties: true,
} satisfies JsonSchema;

function requireTileset(project: Project, tilesetId: unknown): TilesetDef {
  const id = (tilesetId as string | undefined) ?? DEFAULT_TILESET_ID;
  const tileset = project.tilesets[id];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${id}`, { code: "tileset-not-found" });
  return tileset;
}

function requireGroup(tileset: TilesetDef, groupIdValue: unknown): TileGroupMetadata {
  const groupId = typeof groupIdValue === "string" ? groupIdValue.trim() : "";
  if (!groupId) throw new ToolError("groupId가 비어 있습니다.", { code: "invalid-args" });
  const group = tileset.tileGroups?.find((candidate) => candidate.id === groupId);
  if (!group) throw new ToolError(`그룹을 찾을 수 없습니다: ${groupId}`, { code: "group-not-found" });
  return group;
}

function requireTileIndex(tileset: TilesetDef, value: unknown): number {
  const tile = Number(value);
  if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) {
    throw new ToolError(`타일 인덱스 범위 밖: ${String(value)} (0~${tileset.count - 1})`, { code: "tile-out-of-range" });
  }
  return tile;
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(`${label} 형식이 올바르지 않습니다.`, { code: "invalid-args" });
  }
  return value as Record<string, unknown>;
}

function stringArrayValue(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ToolError(`${label} 형식이 올바르지 않습니다.`, { code: "invalid-args" });
  }
  return [...value];
}

function tileIdArrayValue(tileset: TilesetDef, value: unknown, label: string): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ToolError(`${label} 형식이 올바르지 않습니다.`, { code: "invalid-args" });
  return value.map((tile) => requireTileIndex(tileset, tile));
}

function roleValue(value: unknown): TileGroupRole | undefined {
  return TILE_GROUP_ROLES.find((role) => role === value);
}

function junctionSideValue(value: unknown): JunctionSide | undefined {
  return JUNCTION_SIDES.find((side) => side === value);
}

function junctionActionValue(value: unknown): JunctionAction | undefined {
  return JUNCTION_ACTIONS.find((action) => action === value);
}

function overlayWhenValue(value: unknown): OverlayWhen | undefined {
  return OVERLAY_WHENS.find((when) => when === value);
}

function requireJunctionRule(tileset: TilesetDef, value: unknown): TileGroupJunctionRule {
  const record = recordValue(value, "junction");
  const withRole = roleValue(record.withRole);
  const side = junctionSideValue(record.side);
  const action = junctionActionValue(record.action);
  if (!withRole) throw new ToolError(`알 수 없는 withRole: ${String(record.withRole)}`, { code: "invalid-args" });
  if (!side) throw new ToolError(`알 수 없는 side: ${String(record.side)}`, { code: "invalid-args" });
  if (!action) throw new ToolError(`알 수 없는 action: ${String(record.action)}`, { code: "invalid-args" });
  const atRoles = stringArrayValue(record.atRoles, "junction.atRoles");
  const replaceWith = tileIdArrayValue(tileset, record.replaceWith, "junction.replaceWith");
  if (action === "replace" && (!replaceWith || replaceWith.length === 0)) {
    throw new ToolError("action=replace에는 replaceWith가 필요합니다.", { code: "invalid-args" });
  }
  return {
    action,
    ...(atRoles ? { atRoles } : {}),
    ...(replaceWith ? { replaceWith } : {}),
    side,
    withRole,
  };
}

function requireJunctionRules(tileset: TilesetDef, value: unknown): TileGroupJunctionRule[] {
  if (!Array.isArray(value)) throw new ToolError("junctions 형식이 올바르지 않습니다.", { code: "invalid-args" });
  return value.map((entry) => requireJunctionRule(tileset, entry));
}

function requireOverlayRule(tileset: TilesetDef, value: unknown): TileGroupOverlayRule {
  const record = recordValue(value, "overlay");
  const when = overlayWhenValue(record.when);
  if (!when) throw new ToolError(`알 수 없는 overlay.when: ${String(record.when)}`, { code: "invalid-args" });
  const tileIds = tileIdArrayValue(tileset, record.tileIds, "overlay.tileIds");
  if (!tileIds || tileIds.length === 0) throw new ToolError("overlay.tileIds가 비어 있습니다.", { code: "invalid-args" });
  return { tileIds, when };
}

function requireOverlayRules(tileset: TilesetDef, value: unknown): TileGroupOverlayRule[] {
  if (!Array.isArray(value)) throw new ToolError("overlays 형식이 올바르지 않습니다.", { code: "invalid-args" });
  return value.map((entry) => requireOverlayRule(tileset, entry));
}

function ensureTileMetaSlot(tileset: TilesetDef, tile: number): TileAiMetadata {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) {
    tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
  }
  return tileset.tileMeta[tile];
}

const COMBINED_TOWN_TILE_LABELS = new Map<number, string>(
  COMBINED_TOWN_TILE_SEMANTICS.map((entry) => [entry.index, entry.label])
);

const INTERIOR_TILE_LABELS = new Map<number, string>(
  INTERIOR_TILE_SEMANTICS.map((entry) => [entry.index, entry.label])
);

// 타일셋 텍스처에 맞는 번들 라벨 테이블 — 칩셋마다 같은 인덱스의 의미가 다르다.
// (던전 칩셋은 아직 전용 테이블이 없어 기존 동작대로 combined_town을 쓴다.)
function bundledTileLabels(tileset: TilesetDef): ReadonlyMap<number, string> {
  if (tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY) return INTERIOR_TILE_LABELS;
  return COMBINED_TOWN_TILE_LABELS;
}

// 타일의 "알려진 라벨"(사용자 수기 메타 > 번들 시맨틱 > 하네스 시드). 지형 템플릿 조회의 라벨 조인 등에 쓴다.
export function knownTileLabel(tileset: TilesetDef, tile: number): string | undefined {
  const meta = tileset.tileMeta?.[tile];
  const metaLabel = meta?.label.trim();
  // 사용자 수기 라벨만 큐레이션을 이긴다 — 하네스 시드 라벨은 큐레이션과 같거나(실내) 그룹 조립 라벨이다.
  if (metaLabel && (meta?.source === "user" || meta?.origin === "user")) return metaLabel;
  return bundledTileLabels(tileset).get(tile) ?? (metaLabel || undefined);
}

// ── get_tile_info ────────────────────────────────────────────────
const getTileInfo: ToolDefinition = {
  name: "get_tile_info",
  description:
    "타일들의 의미(라벨/설명/태그)·시맨틱 그룹·배치 규칙(placementRules)·통행성·레이어를 조회한다. 타일을 깔기 전에 확인하는 용도.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      tileIds: { type: "array", items: { type: "integer" }, description: "조회할 타일 인덱스 목록(최대 30)" },
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
    },
    required: ["tileIds"],
  },
  run(project, args): ToolExecResult {
    const tileset = requireTileset(project, args.tilesetId);
    const ids = (args.tileIds as unknown[]).slice(0, 30).map((value) => requireTileIndex(tileset, value));
    const tiles = ids.map((tile) => {
      const usage = summarizeTileUsage(tileset, tile);
      const meta = tileset.tileMeta?.[tile];
      return {
        tile,
        label: usage.label,
        description: usage.description,
        tags: [...usage.tags, ...(meta?.tags ?? [])],
        source: meta?.source ?? "unknown",
        userLocked: meta?.userLocked === true,
        passable: !isBlockedPassage(tileset.passability[tile]),
        layer: tileset.priority[tile] === "upper" ? "upper" : "lower",
        terrainTag: tileset.terrain[tile] ?? 0,
        groups: usage.groups.map((group) => ({
          name: group.name,
          role: group.role,
          defaultLayer: group.defaultLayer,
          placementRules: group.placementRules,
        })),
      };
    });
    return { summary: `타일 ${tiles.length}개 정보 조회(${tileset.id})`, data: { tilesetId: tileset.id, tiles } };
  },
};

const listUnclassifiedTiles: ToolDefinition = {
  name: "list_unclassified_tiles",
  description:
    "타일셋에서 라벨이 없고 어떤 타일 그룹에도 속하지 않은 미분류 타일 인덱스를 페이지로 조회한다. 미분류 분석을 다음 배치로 이어갈 때 사용.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      limit: { type: "integer", description: "가져올 개수. 기본 24, 최대 100" },
      offset: { type: "integer", description: "건너뛸 미분류 타일 개수. 기본 0" },
    },
    required: ["tilesetId"],
  },
  run(project, args): ToolExecResult {
    const tileset = requireTileset(project, args.tilesetId);
    const grouped = new Set<number>();
    for (const group of tileset.tileGroups ?? []) {
      for (const tile of group.tileIds) grouped.add(tile);
    }
    const unclassified: number[] = [];
    for (let tile = 0; tile < tileset.count; tile += 1) {
      if (tileset.tileMeta?.[tile]?.label.trim()) continue;
      if (grouped.has(tile)) continue;
      unclassified.push(tile);
    }
    const rawLimit = Number(args.limit ?? 24);
    const rawOffset = Number(args.offset ?? 0);
    const limit = Number.isInteger(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 24;
    const offset = Number.isInteger(rawOffset) ? Math.max(0, rawOffset) : 0;
    const tiles = unclassified.slice(offset, offset + limit);
    return {
      summary: `미분류 타일 ${tiles.length}/${unclassified.length}개 조회(${tileset.id})`,
      data: { tilesetId: tileset.id, tiles, total: unclassified.length, limit, offset },
    };
  },
};

// ── set_tile_metadata ────────────────────────────────────────────
const setTileMetadata: ToolDefinition = {
  name: "set_tile_metadata",
  description:
    "타일의 라벨/설명/태그/역할을 기록한다. 사용자가 답으로 확정한 내용이면 confirmedByUser=true(잠금·최우선). 잠긴 타일은 confirmedByUser=true로만 수정 가능.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      entries: {
        type: "array",
        description: "[{tile, label?, description?, role?, tags?}] — 같은 의미의 타일 여러 개를 한 번에 기록",
        items: { type: "object", additionalProperties: true },
      },
      confirmedByUser: { type: "boolean", description: "사용자가 직접 답해 확정한 내용이면 true(userLocked 저장)" },
    },
    required: ["entries"],
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const confirmed = args.confirmedByUser === true;
    const rawEntries = args.entries as unknown[];
    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      throw new ToolError("entries가 비어 있습니다.", { code: "invalid-args" });
    }
    const written: number[] = [];
    const skipped: number[] = [];
    const warnings: string[] = [];
    for (const raw of rawEntries) {
      const entry = raw as Record<string, unknown>;
      // LLM이 자주 쓰는 키 별칭 수용(tile/tileId/index) — 라이브 스모크에서 tile 누락으로
      // 조용히 실패하던 패턴 방지(place_npc 대사 별칭과 같은 처방).
      const tile = requireTileIndex(tileset, entry.tile ?? entry.tileId ?? entry.index);
      const meta = ensureTileMetaSlot(tileset, tile);
      if (tileMetaLocked(meta) && !confirmed) {
        skipped.push(tile);
        continue;
      }
      const label = typeof entry.label === "string" ? entry.label : typeof entry.name === "string" ? entry.name : undefined;
      if (label !== undefined) meta.label = label;
      if (typeof entry.description === "string") meta.description = entry.description;
      if (typeof entry.role === "string") meta.role = entry.role;
      if (Array.isArray(entry.tags)) meta.tags = entry.tags.filter((tag): tag is string => typeof tag === "string");
      meta.source = confirmed ? "user" : "ai";
      meta.origin = confirmed ? "user" : "ai";
      if (confirmed) {
        meta.confidence = 1;
        meta.locked = true;
        meta.userLocked = true;
      }
      written.push(tile);
    }
    if (skipped.length > 0) {
      warnings.push(`잠긴 항목 ${skipped.length}개 보존됨`);
      warnings.push(`사용자 확정(잠금) 메타데이터라 건너뜀: 타일 ${skipped.join(", ")} — confirmedByUser=true로만 수정 가능`);
    }
    return {
      summary: `타일 메타데이터 ${written.length}건 기록${confirmed ? "(사용자 확정)" : ""}${skipped.length > 0 ? `, ${skipped.length}건 잠금 건너뜀` : ""}`,
      warnings,
      data: { tilesetId: tileset.id, written, skipped },
    };
  },
};

// ── set_tile_rules ───────────────────────────────────────────────
// DB 타일셋의 "타일 규칙" 탭(레이어/통행/지형 태그)을 챗봇에서도 설정한다.
// 레이어 확정은 하네스·투명 칩 자동 판정보다 우선하므로 사용자 확인을 요구한다.
const setTileRules: ToolDefinition = {
  name: "set_tile_rules",
  description:
    "타일의 규칙을 설정한다: layer(auto/lower/upper — 홈 레이어 확정), passable(통행 가능 여부), terrainTag(지형 태그). 레이어 변경은 사용자가 요청/확인한 경우에만 confirmedByUser=true로 호출하라. 여러 타일은 entries로 한 번에.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      entries: {
        type: "array",
        description: "[{tile, layer?: auto|lower|upper, passable?: boolean, terrainTag?: integer}]",
        items: { type: "object", additionalProperties: true },
      },
      confirmedByUser: { type: "boolean", description: "사용자가 직접 요청/확정한 변경이면 true — layer 변경에 필수" },
    },
    required: ["entries"],
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const confirmed = args.confirmedByUser === true;
    const rawEntries = args.entries as unknown[];
    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      throw new ToolError("entries가 비어 있습니다.", { code: "invalid-args" });
    }
    const changes: string[] = [];
    const skipped: number[] = [];
    const warnings: string[] = [];
    for (const raw of rawEntries) {
      const entry = raw as Record<string, unknown>;
      const tile = requireTileIndex(tileset, entry.tile ?? entry.tileId ?? entry.index);
      if (tileMetaLocked(tileset.tileMeta?.[tile]) && !confirmed) {
        skipped.push(tile);
        continue;
      }
      const layer = entry.layer as string | undefined;
      if (layer !== undefined) {
        if (layer !== "auto" && layer !== "lower" && layer !== "upper") {
          throw new ToolError(`알 수 없는 layer: ${String(layer)} (auto/lower/upper)`, { code: "invalid-args" });
        }
        if (!confirmed) {
          throw new ToolError(
            "레이어 확정은 사용자 확인이 필요합니다 — 사용자가 명시적으로 요청했으면 confirmedByUser=true로 다시 호출하세요.",
            { code: "needs-user-confirmation" }
          );
        }
        setTileLayerOverride(tileset, tile, layer);
        changes.push(`타일 ${tile} 레이어→${layer === "auto" ? "자동" : layer}`);
      }
      if (typeof entry.passable === "boolean") {
        const passable = entry.passable;
        tileset.passability[tile] = { up: passable, down: passable, left: passable, right: passable };
        markUserTileRuntimeMetadata(tileset, tile, { passage: passable ? "passable" : "solid" });
        changes.push(`타일 ${tile} 통행→${passable ? "가능" : "차단"}`);
      }
      if (typeof entry.terrainTag === "number" && Number.isInteger(entry.terrainTag)) {
        tileset.terrain[tile] = entry.terrainTag;
        markUserTileRuntimeMetadata(tileset, tile, { terrainTag: entry.terrainTag });
        changes.push(`타일 ${tile} 지형 태그→${entry.terrainTag}`);
      }
    }
    if (skipped.length > 0) {
      warnings.push(`잠긴 항목 ${skipped.length}개 보존됨`);
      warnings.push(`사용자 확정(잠금) 메타데이터라 건너뜀: 타일 ${skipped.join(", ")} — confirmedByUser=true로만 수정 가능`);
    }
    if (changes.length === 0 && skipped.length === 0) {
      throw new ToolError("entries에 적용할 규칙(layer/passable/terrainTag)이 없습니다.", { code: "invalid-args" });
    }
    return {
      summary: `타일 규칙 ${changes.length}건 설정${skipped.length > 0 ? `, ${skipped.length}건 잠금 건너뜀` : ""}${changes.length > 0 ? ` — ${changes.slice(0, 4).join(", ")}${changes.length > 4 ? " 외" : ""}` : ""}`,
      warnings,
      data: { tilesetId: tileset.id, changes, skipped },
    };
  },
};

// ── upsert_tile_group ────────────────────────────────────────────
function slugFromName(name: string, existing: readonly TileGroupMetadata[]): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "group";
  let slug = base;
  let counter = 2;
  while (existing.some((group) => group.id === slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

function inferDefaultLayer(tileset: TilesetDef, tileIds: readonly number[]): TileGroupLayer {
  const layers = new Set(tileIds.map((tile) => (tileset.priority[tile] === "upper" ? "upper" : "lower")));
  if (layers.size === 1) return layers.has("upper") ? "upper" : "lower";
  return "mixed";
}

const upsertTileGroup: ToolDefinition = {
  name: "upsert_tile_group",
  description:
    "여러 타일이 하나의 구조(지붕/울타리/길 등)를 이룰 때 시맨틱 그룹과 배치 규칙(placementRules)을 기록한다. id가 기존 그룹이면 갱신.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      id: { type: "string", description: "기존 그룹 갱신 시 지정. 생략하면 이름에서 생성" },
      name: { type: "string" },
      role: { type: "string", enum: TILE_GROUP_ROLES as unknown as string[] },
      tileIds: { type: "array", items: { type: "integer" } },
      defaultLayer: { type: "string", enum: TILE_GROUP_LAYERS as unknown as string[], description: "생략 시 타일 priority에서 추론" },
      description: { type: "string" },
      placementRules: { type: "string", description: "배치 규칙 — 예: '2단 벽 타일(306) 위에 가로로 반복 배치'" },
      junctions: { type: "array", items: JUNCTION_SCHEMA, description: "경계 규칙 목록" },
      overlays: { type: "array", items: OVERLAY_SCHEMA, description: "조건부 오버레이 목록" },
      rules: { type: "array", items: CLUSTER_RULE_SCHEMA, description: "클러스터 규칙 목록(hard/medium/soft)" },
    },
    required: ["name", "role", "tileIds"],
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const name = (args.name as string).trim();
    if (!name) throw new ToolError("그룹 이름이 비어 있습니다.", { code: "invalid-args" });
    const role = args.role as TileGroupRole;
    if (!TILE_GROUP_ROLES.includes(role)) {
      throw new ToolError(`알 수 없는 role: ${String(args.role)} (${TILE_GROUP_ROLES.join("/")})`, { code: "invalid-args" });
    }
    const tileIds = (args.tileIds as unknown[]).map((value) => requireTileIndex(tileset, value));
    if (tileIds.length === 0) throw new ToolError("tileIds가 비어 있습니다.", { code: "invalid-args" });
    const defaultLayer = (args.defaultLayer as TileGroupLayer | undefined) ?? inferDefaultLayer(tileset, tileIds);
    if (!TILE_GROUP_LAYERS.includes(defaultLayer)) {
      throw new ToolError(`알 수 없는 defaultLayer: ${String(args.defaultLayer)}`, { code: "invalid-args" });
    }
    const junctions = args.junctions !== undefined ? requireJunctionRules(tileset, args.junctions) : undefined;
    const overlays = args.overlays !== undefined ? requireOverlayRules(tileset, args.overlays) : undefined;
    const rules = args.rules !== undefined ? requireClusterRules(tileset, args.rules) : undefined;

    tileset.tileGroups ??= [];
    const requestedId = (args.id as string | undefined)?.trim();
    const existing = requestedId ? tileset.tileGroups.find((group) => group.id === requestedId) : undefined;
    if (requestedId && !existing) {
      // 잘못된 id 추측으로 의도치 않은 새 그룹이 생기는 것을 막는다 — 새 그룹은 id 생략.
      throw new ToolError(`그룹을 찾을 수 없습니다: ${requestedId} (새 그룹이면 id를 생략하세요)`, { code: "group-not-found" });
    }
    const target: TileGroupMetadata = existing ?? {
      id: slugFromName(name, tileset.tileGroups),
      name,
      role,
      defaultLayer,
      tileIds: [],
      description: "",
      placementRules: "",
      source: "user",
    };
    target.name = name;
    target.role = role;
    target.defaultLayer = defaultLayer;
    target.tileIds = [...new Set(tileIds)];
    if (typeof args.description === "string") target.description = args.description;
    if (typeof args.placementRules === "string") target.placementRules = args.placementRules;
    if (junctions) target.junctions = junctions;
    if (overlays) target.overlays = overlays;
    if (rules !== undefined) target.rules = rules;
    if (!existing) tileset.tileGroups.push(target);
    return {
      summary: `타일 그룹 '${name}' ${existing ? "갱신" : "생성"}(${role}, 타일 ${target.tileIds.length}개)${target.placementRules ? " — 배치 규칙 기록됨" : ""}`,
      data: { tilesetId: tileset.id, groupId: target.id, created: !existing },
    };
  },
};

const setGroupJunction: ToolDefinition = {
  name: "set_group_junction",
  description: "타일 그룹에 경계 규칙을 추가하거나 갱신한다. 예: 지붕 아래 벽이 맞닿으면 하단 처마 역할 타일을 생략/대체.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      groupId: { type: "string" },
      junction: JUNCTION_SCHEMA,
    },
    required: ["tilesetId", "groupId", "junction"],
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const group = requireGroup(tileset, args.groupId);
    const junction = requireJunctionRule(tileset, args.junction);
    const junctions = [...(group.junctions ?? [])];
    const index = junctions.findIndex((entry) => entry.withRole === junction.withRole && entry.side === junction.side);
    if (index >= 0) junctions[index] = junction;
    else junctions.push(junction);
    group.junctions = junctions;
    return {
      summary: `경계 규칙 저장: ${group.name} ↔ ${junction.withRole} (${junction.side}, ${junction.action})`,
      data: { groupId: group.id, tilesetId: tileset.id, updated: index >= 0 },
    };
  },
};

const setGroupOverlay: ToolDefinition = {
  name: "set_group_overlay",
  description: "타일 그룹에 조건부 오버레이 규칙을 추가하거나 갱신한다. 예: 사선 모서리나 처마 끝 조건에서 상위 레이어 타일을 더한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      groupId: { type: "string" },
      overlay: OVERLAY_SCHEMA,
    },
    required: ["tilesetId", "groupId", "overlay"],
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const group = requireGroup(tileset, args.groupId);
    const overlay = requireOverlayRule(tileset, args.overlay);
    const overlays = [...(group.overlays ?? [])];
    const index = overlays.findIndex((entry) => entry.when === overlay.when);
    if (index >= 0) overlays[index] = overlay;
    else overlays.push(overlay);
    group.overlays = overlays;
    return {
      summary: `오버레이 규칙 저장: ${group.name} (${overlay.when}, 타일 ${overlay.tileIds.length}개)`,
      data: { groupId: group.id, tilesetId: tileset.id, updated: index >= 0 },
    };
  },
};

const deleteTileGroup: ToolDefinition = {
  name: "delete_tile_group",
  description: "타일셋의 시맨틱 타일 그룹을 삭제한다. 클러스터 해체처럼 사용자가 명시적으로 확인한 경우에만 호출.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string" },
      groupId: { type: "string" },
    },
    required: ["tilesetId", "groupId"],
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const groupId = (args.groupId as string).trim();
    if (!groupId) throw new ToolError("groupId가 비어 있습니다.", { code: "invalid-args" });
    const groups = tileset.tileGroups ?? [];
    const index = groups.findIndex((group) => group.id === groupId);
    if (index < 0) throw new ToolError(`그룹을 찾을 수 없습니다: ${groupId}`, { code: "group-not-found" });
    const [removed] = groups.splice(index, 1);
    tileset.tileGroups = groups;
    if (groupId.startsWith(COMBINED_TOWN_HARNESS_PREFIX)) {
      tileset.suppressedHarnessGroupIds = [...new Set([...(tileset.suppressedHarnessGroupIds ?? []), groupId])];
    }
    return {
      summary: `타일 그룹 '${removed.name}' 삭제(${removed.tileIds.length}개 타일)`,
      data: { tilesetId: tileset.id, groupId },
    };
  },
};

// ── analyze_map_tile_usage ───────────────────────────────────────
interface TileUsageStat {
  tile: number;
  layers: string[];
  count: number;
  described: boolean;
  knownVia: "user" | "ai" | "bundled" | "group" | null;
  label?: string;
  sampleRegion: { x: number; y: number; w: number; h: number };
  mostCommonBelow: number | null;
  mostCommonAbove: number | null;
}

// 합성 뷰(상위가 있으면 상위, 없으면 하위) — 인접 통계용.
function compositeTile(map: GameMap, x: number, y: number): number {
  const i = y * map.width + x;
  const upper = map.upperTiles[i];
  return upper !== TILE.EMPTY && upper !== undefined ? upper : map.lowerTiles[i];
}

function modeOf(counts: Map<number, number>): number | null {
  let best: number | null = null;
  let bestCount = 0;
  for (const [tile, count] of counts) {
    if (count > bestCount) {
      best = tile;
      bestCount = count;
    }
  }
  return best;
}

// 해당 타일이 놓인 칸 중 가장 큰 연결 덩어리의 bbox(4방향). 질문 시 하이라이트할 대표 영역.
function largestClusterBbox(map: GameMap, cells: readonly number[]): { x: number; y: number; w: number; h: number } {
  const cellSet = new Set(cells);
  const visited = new Set<number>();
  let best = { x: 0, y: 0, w: 1, h: 1 };
  let bestSize = 0;
  for (const start of cells) {
    if (visited.has(start)) continue;
    const queue = [start];
    visited.add(start);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, size = 0;
    while (queue.length > 0) {
      const cell = queue.pop() as number;
      const x = cell % map.width;
      const y = Math.floor(cell / map.width);
      size += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const next of [cell - 1, cell + 1, cell - map.width, cell + map.width]) {
        if (visited.has(next) || !cellSet.has(next)) continue;
        // 좌우 이동이 행을 넘지 않는지 확인.
        if ((next === cell - 1 || next === cell + 1) && Math.floor(next / map.width) !== y) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  }
  return best;
}

const analyzeMapTileUsage: ToolDefinition = {
  name: "analyze_map_tile_usage",
  description:
    "사람이 깐 맵에서 사용된 타일 종류·사용량·설명 유무·대표 영역(sampleRegion)·인접 통계(mostCommonBelow/Above)를 추출한다. 맵 인터뷰의 시작점 — 설명 없는(described=false) 타일부터 질문하라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      includeDescribed: { type: "boolean", description: "true면 이미 설명된 타일도 목록에 포함. 기본 false — 인터뷰 재질문 방지를 위해 설명 없는 타일만 반환한다. coverage 통계(설명됨 n/전체 m)는 항상 전체 기준." },
    },
    required: ["mapId"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const tileset = project.tilesets[map.tilesetId] ?? requireTileset(project, undefined);
    // 기본 false: 인터뷰가 이미 설명한 타일을 계속 재질문하던 버그(#7)의 핵심 — 설명 없는 타일만 반환한다.
    const includeDescribed = args.includeDescribed === true;

    // 레이어별 타일 → 등장 칸 목록.
    const cellsByTile = new Map<number, { layers: Set<string>; cells: number[] }>();
    const record = (tile: number, layer: string, cell: number): void => {
      if (tile === TILE.EMPTY || tile === undefined) return;
      const entry = cellsByTile.get(tile) ?? { layers: new Set<string>(), cells: [] };
      entry.layers.add(layer);
      entry.cells.push(cell);
      cellsByTile.set(tile, entry);
    };
    for (let i = 0; i < map.width * map.height; i += 1) {
      record(map.lowerTiles[i], "lower", i);
      record(map.upperTiles[i], "upper", i);
    }

    const groupedTiles = new Set<number>();
    for (const group of tileset.tileGroups ?? []) {
      for (const tile of group.tileIds) groupedTiles.add(tile);
    }

    const stats: TileUsageStat[] = [];
    for (const [tile, entry] of cellsByTile) {
      const meta = tileset.tileMeta?.[tile];
      const hasUserMeta = Boolean(meta && (meta.label.trim() || meta.description.trim()));
      const knownVia: TileUsageStat["knownVia"] = hasUserMeta
        ? meta?.source === "user" ? "user" : "ai"
        : bundledTileLabels(tileset).has(tile) ? "bundled"
        : groupedTiles.has(tile) ? "group"
        : null;
      // 인접 통계: 이 타일 칸들의 바로 아래/위 칸 합성 타일 최빈값.
      // 자기 자신(클러스터 내부)은 제외 — "이 구조물이 무엇 위에 놓이는가"를 보기 위함이다.
      const belowCounts = new Map<number, number>();
      const aboveCounts = new Map<number, number>();
      for (const cell of entry.cells) {
        const x = cell % map.width;
        const y = Math.floor(cell / map.width);
        if (y + 1 < map.height) {
          const below = compositeTile(map, x, y + 1);
          if (below !== tile) belowCounts.set(below, (belowCounts.get(below) ?? 0) + 1);
        }
        if (y - 1 >= 0) {
          const above = compositeTile(map, x, y - 1);
          if (above !== tile) aboveCounts.set(above, (aboveCounts.get(above) ?? 0) + 1);
        }
      }
      stats.push({
        tile,
        layers: [...entry.layers].sort(),
        count: entry.cells.length,
        described: knownVia !== null,
        knownVia,
        label: hasUserMeta ? (meta?.label || undefined) : bundledTileLabels(tileset).get(tile),
        sampleRegion: largestClusterBbox(map, entry.cells),
        mostCommonBelow: modeOf(belowCounts),
        mostCommonAbove: modeOf(aboveCounts),
      });
    }

    // 설명 없는 타일 먼저, 그 안에서 많이 쓰인 순.
    stats.sort((a, b) => Number(a.described) - Number(b.described) || b.count - a.count);
    const described = stats.filter((stat) => stat.described).length;
    const listed = (includeDescribed ? stats : stats.filter((stat) => !stat.described)).slice(0, 40);
    return {
      summary: `맵 '${map.name}' 타일 ${stats.length}종 사용 — 설명됨 ${described}/${stats.length}`,
      data: {
        mapId: map.id,
        tilesetId: tileset.id,
        coverage: { used: stats.length, described },
        truncated: listed.length < (includeDescribed ? stats.length : stats.length - described),
        tiles: listed,
      },
    };
  },
};

// ── highlight_map_region ─────────────────────────────────────────
// 순수 read 툴 — 실제 화면 강조는 챗 패널이 tool_call 이벤트를 받아 editorState.selection으로 반영한다.
const highlightMapRegion: ToolDefinition = {
  name: "highlight_map_region",
  description: "에디터 화면에서 맵 영역을 강조 표시한다. 사용자에게 타일 질문을 하기 직전에 호출해 어느 부분을 묻는지 보여줘라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
    },
    required: ["mapId", "x", "y", "w", "h"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const x = Math.max(0, Math.min(map.width - 1, args.x as number));
    const y = Math.max(0, Math.min(map.height - 1, args.y as number));
    const w = Math.max(1, Math.min(map.width - x, args.w as number));
    const h = Math.max(1, Math.min(map.height - y, args.h as number));
    return {
      summary: `영역 강조: (${x},${y}) ${w}×${h} (${map.name})`,
      data: { mapId: map.id, x, y, w, h },
    };
  },
};

// ── show_tiles ───────────────────────────────────────────────────
// 순수 read 툴 — 챗 패널이 tool_call 이벤트를 받아 타일 이미지를 채팅 버블로 렌더한다.
// "타일 사진을 보여줘야지" 피드백의 해법: 어떤 타일을 말하는지 번호가 아니라 그림으로 보여준다.
const showTiles: ToolDefinition = {
  name: "show_tiles",
  description:
    "타일 이미지를 채팅에 표시해 사용자가 눈으로 확인하게 한다. 타일에 대해 질문하거나 설명할 때 반드시 먼저 호출하라(번호만으로는 사용자가 어떤 타일인지 알 수 없다).",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      tileIds: { type: "array", items: { type: "integer" }, description: "보여줄 타일 인덱스(최대 12)" },
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
    },
    required: ["tileIds"],
  },
  run(project, args): ToolExecResult {
    const tileset = requireTileset(project, args.tilesetId);
    const ids = (args.tileIds as unknown[]).slice(0, 12).map((value) => requireTileIndex(tileset, value));
    if (ids.length === 0) throw new ToolError("tileIds가 비어 있습니다.", { code: "invalid-args" });
    return {
      summary: `타일 ${ids.join(", ")} 이미지를 사용자에게 표시`,
      data: { tilesetId: tileset.id, tiles: ids },
    };
  },
};

// ── show_tile_grid ───────────────────────────────────────────────
// 맵 영역을 하위+상위 합성 타일 그리드 이미지로 채팅에 표시한다(패널이 렌더).
// 구조물 학습 인터뷰의 "이미지 리치" 요구 — 영역 전체를 그림으로 보여주고 나서 질문한다.
const showTileGrid: ToolDefinition = {
  name: "show_tile_grid",
  description:
    "맵 영역(최대 20×20)을 타일 그리드 이미지로 채팅에 표시한다. 구조물에 대해 질문/설명하기 전에 호출해 사용자가 영역 전체를 그림으로 보게 하라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
    },
    required: ["mapId", "x", "y", "w", "h"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const x = Math.max(0, Math.min(map.width - 1, args.x as number));
    const y = Math.max(0, Math.min(map.height - 1, args.y as number));
    const w = Math.min(20, Math.max(1, Math.min(map.width - x, args.w as number)));
    const h = Math.min(20, Math.max(1, Math.min(map.height - y, args.h as number)));
    const lower: number[][] = [];
    const upper: number[][] = [];
    for (let row = 0; row < h; row += 1) {
      const lowerRow: number[] = [];
      const upperRow: number[] = [];
      for (let col = 0; col < w; col += 1) {
        const index = (y + row) * map.width + (x + col);
        lowerRow.push(map.lowerTiles[index] ?? TILE.EMPTY);
        upperRow.push(map.upperTiles[index] ?? TILE.EMPTY);
      }
      lower.push(lowerRow);
      upper.push(upperRow);
    }
    return {
      summary: `타일 그리드 표시: (${x},${y}) ${w}×${h} (${map.name})`,
      data: { mapId: map.id, tilesetId: map.tilesetId, x, y, w, h, lower, upper },
    };
  },
};

export const TILE_METADATA_TOOLS: readonly ToolDefinition[] = [
  getTileInfo,
  listUnclassifiedTiles,
  setTileMetadata,
  setTileRules,
  upsertTileGroup,
  setGroupJunction,
  setGroupOverlay,
  deleteTileGroup,
  analyzeMapTileUsage,
  highlightMapRegion,
  showTiles,
  showTileGrid,
];
