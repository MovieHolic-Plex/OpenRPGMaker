import { buildGroupSample, type GroupSample, type GroupSampleInput } from "@/ai/groupSampleBuilder";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const TILE_GROUP_ROLES: readonly TileGroupRole[] = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"];

type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
type PatternPart = PatternGrammar["parts"][number];
type PatternPartRole = PatternPart["role"];
type TileGroupJunctionRule = NonNullable<TileGroupMetadata["junctions"]>[number];
type TileGroupOverlayRule = NonNullable<TileGroupMetadata["overlays"]>[number];
type JunctionSide = TileGroupJunctionRule["side"];
type JunctionAction = TileGroupJunctionRule["action"];
type OverlayWhen = TileGroupOverlayRule["when"];

type RenderGroupSampleData = {
  readonly samples: readonly RenderGroupSample[];
  readonly tilesetId: string;
};

type RenderGroupSample = GroupSample & {
  readonly label: string;
};

type GroupDescriptor = {
  readonly junctions?: readonly TileGroupJunctionRule[];
  readonly overlays?: readonly TileGroupOverlayRule[];
  readonly patternGrammar?: PatternGrammar;
  readonly role: TileGroupRole;
  readonly tileIds: readonly number[];
};

type ProposedDescriptor = {
  readonly junctions?: readonly TileGroupJunctionRule[];
  readonly overlays?: readonly TileGroupOverlayRule[];
  readonly patternGrammar?: PatternGrammar;
  readonly role?: TileGroupRole;
  readonly tileIds?: readonly number[];
};

type StructureRuleSampleInput = GroupSampleInput & Pick<TileGroupMetadata, "junctions" | "overlays">;

const PATTERN_KINDS: readonly PatternGrammar["kind"][] = [
  "animated_terrain",
  "autotile_3x3",
  "event_required_object",
  "horizontal_expandable",
  "nine_slice_expandable",
  "overlay_detail",
  "single",
  "source_rect",
  "vertical_expandable",
];

const PATTERN_PART_ROLES: readonly PatternPartRole[] = [
  "bottom",
  "bottomCap",
  "bottomLeft",
  "bottomRight",
  "center",
  "left",
  "leftCap",
  "repeatBody",
  "right",
  "rightCap",
  "top",
  "topCap",
  "topLeft",
  "topRight",
];

const JUNCTION_SIDES: readonly JunctionSide[] = ["below", "above", "leftOf", "rightOf"];
const JUNCTION_ACTIONS: readonly JunctionAction[] = ["omit", "replace"];
const OVERLAY_WHENS: readonly OverlayWhen[] = ["diagonalCorner", "innerCorner", "ridge", "eaveEnd"];

const renderGroupSample: ToolDefinition = {
  name: "render_group_sample",
  description:
    "타일 그룹/후보를 실제 배치 샘플 이미지로 렌더하기 위한 데이터를 만든다. 클러스터 수정 전에는 현재 샘플을, 수정 제안 전에는 전/후 샘플을 먼저 보여줘라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "대상 타일셋 id" },
      groupId: { type: "string", description: "저장된 타일 그룹 id. 있으면 현재 샘플의 기준" },
      role: { type: "string", enum: ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"], description: "후보 역할" },
      tileIds: { type: "array", items: { type: "integer" }, description: "후보 타일 id 목록" },
      patternGrammar: { type: "object", additionalProperties: true, description: "후보 조립 문법" },
      proposed: { type: "object", additionalProperties: true, description: "수정 후 후보 {role?, tileIds?, patternGrammar?}" },
    },
    required: ["tilesetId"],
  },
  run(project, args): ToolExecResult {
    const tileset = requireTileset(project.tilesets, args.tilesetId);
    const groupId = stringValue(args.groupId);
    const group = groupId ? tileset.tileGroups?.find((candidate) => candidate.id === groupId) : undefined;
    if (groupId && !group) throw new ToolError(`그룹을 찾을 수 없습니다: ${groupId}`, { code: "group-not-found" });

    const current = group ? descriptorFromGroup(group) : descriptorFromArgs(tileset, args);
    const proposed = group ? proposedFromArgs(tileset, current, args) : null;
    const title = group?.name ?? "선택 타일";
    const samples: RenderGroupSample[] = [];

    if (proposed && !sameDescriptor(current, proposed)) {
      samples.push(sampleFor(tileset, "수정 전", current));
      samples.push(sampleFor(tileset, "수정 후", proposed));
    } else {
      samples.push(sampleFor(tileset, group ? "현재" : "샘플", current));
    }

    const data: RenderGroupSampleData = { tilesetId: tileset.id, samples };
    return {
      summary: `샘플 렌더: ${title}${samples.length > 1 ? " (전/후)" : ""}`,
      data,
    };
  },
};

export const GROUP_SAMPLE_TOOLS: readonly ToolDefinition[] = [renderGroupSample];

function requireTileset(tilesets: Record<string, TilesetDef>, idValue: unknown): TilesetDef {
  const id = stringValue(idValue) ?? DEFAULT_TILESET_ID;
  const tileset = tilesets[id];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${id}`, { code: "tileset-not-found" });
  return tileset;
}

function descriptorFromGroup(group: TileGroupMetadata): GroupDescriptor {
  return {
    ...(group.junctions ? { junctions: group.junctions } : {}),
    ...(group.overlays ? { overlays: group.overlays } : {}),
    ...(group.patternGrammar ? { patternGrammar: group.patternGrammar } : {}),
    role: group.role,
    tileIds: group.tileIds,
  };
}

function descriptorFromArgs(tileset: TilesetDef, args: Record<string, unknown>): GroupDescriptor {
  const tileIds = requireTileIds(tileset, args.tileIds);
  const role = roleValue(args.role) ?? "terrain";
  const junctions = structureJunctionsValue(tileset, args.junctions);
  const overlays = structureOverlaysValue(tileset, args.overlays);
  const patternGrammar = patternGrammarValue(args.patternGrammar);
  return {
    ...(junctions ? { junctions } : {}),
    ...(overlays ? { overlays } : {}),
    ...(patternGrammar ? { patternGrammar } : {}),
    role,
    tileIds,
  };
}

function proposedFromArgs(tileset: TilesetDef, current: GroupDescriptor, args: Record<string, unknown>): ProposedDescriptor | null {
  const source = recordValue(args.proposed) ?? args;
  const role = roleValue(source.role);
  const tileIdsChanged = source.tileIds !== undefined;
  const patternGrammarChanged = source.patternGrammar !== undefined;
  const junctionsChanged = source.junctions !== undefined;
  const overlaysChanged = source.overlays !== undefined;
  const tileIds = tileIdsChanged ? requireTileIds(tileset, source.tileIds) : undefined;
  const patternGrammar = patternGrammarChanged ? patternGrammarValue(source.patternGrammar) : undefined;
  const junctions = junctionsChanged ? structureJunctionsValue(tileset, source.junctions) : undefined;
  const overlays = overlaysChanged ? structureOverlaysValue(tileset, source.overlays) : undefined;
  if (!role && !tileIds && !patternGrammar && !junctions && !overlays) return null;
  const nextPatternGrammar = patternGrammarChanged ? patternGrammar : tileIdsChanged ? undefined : current.patternGrammar;
  return {
    ...(junctionsChanged ? { junctions } : current.junctions ? { junctions: current.junctions } : {}),
    ...(overlaysChanged ? { overlays } : current.overlays ? { overlays: current.overlays } : {}),
    ...(nextPatternGrammar ? { patternGrammar: nextPatternGrammar } : {}),
    role: role ?? current.role,
    tileIds: tileIds ?? current.tileIds,
  };
}

function sampleFor(tileset: TilesetDef, label: string, descriptor: GroupDescriptor | ProposedDescriptor): RenderGroupSample {
  const input: StructureRuleSampleInput = {
    ...(descriptor.junctions ? { junctions: [...descriptor.junctions] } : {}),
    ...(descriptor.overlays ? { overlays: [...descriptor.overlays] } : {}),
    ...(descriptor.patternGrammar ? { patternGrammar: descriptor.patternGrammar } : {}),
    role: descriptor.role ?? "terrain",
    tileIds: descriptor.tileIds ?? [],
  };
  return { label, ...buildGroupSample(tileset, input) };
}

function sameDescriptor(current: GroupDescriptor, proposed: ProposedDescriptor): boolean {
  return current.role === proposed.role
    && JSON.stringify(current.tileIds) === JSON.stringify(proposed.tileIds)
    && JSON.stringify(current.patternGrammar ?? null) === JSON.stringify(proposed.patternGrammar ?? null)
    && JSON.stringify(current.junctions ?? null) === JSON.stringify(proposed.junctions ?? null)
    && JSON.stringify(current.overlays ?? null) === JSON.stringify(proposed.overlays ?? null);
}

function requireTileIds(tileset: TilesetDef, value: unknown): readonly number[] {
  if (!Array.isArray(value) || value.length === 0) throw new ToolError("tileIds가 비어 있습니다.", { code: "invalid-args" });
  return value.map((tile) => requireTileIndex(tileset, tile));
}

function requireTileIndex(tileset: TilesetDef, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= tileset.count) {
    throw new ToolError(`타일 인덱스 범위 밖: ${String(value)} (0~${tileset.count - 1})`, { code: "tile-out-of-range" });
  }
  return value;
}

function patternGrammarValue(value: unknown): PatternGrammar | undefined {
  if (value === undefined || value === null) return undefined;
  const record = recordValue(value);
  if (!record) throw new ToolError("patternGrammar 형식이 올바르지 않습니다.", { code: "invalid-args" });
  const kind = record.kind;
  if (!isPatternKind(kind)) throw new ToolError("patternGrammar.kind가 올바르지 않습니다.", { code: "invalid-args" });
  const rawParts = record.parts;
  if (!Array.isArray(rawParts)) throw new ToolError("patternGrammar.parts가 필요합니다.", { code: "invalid-args" });
  const parts = rawParts.map(patternPartValue);
  const axis = axisValue(record.axis);
  const minHeight = integerValue(record.minHeight);
  const minWidth = integerValue(record.minWidth);
  return {
    ...(axis ? { axis } : {}),
    kind,
    ...(minHeight !== undefined ? { minHeight } : {}),
    ...(minWidth !== undefined ? { minWidth } : {}),
    parts,
    preserveCaps: record.preserveCaps === true,
    repeat: repeatValue(record.repeat) ?? "source_order",
  };
}

function patternPartValue(value: unknown): PatternPart {
  const record = recordValue(value);
  const role = record?.role;
  if (!record || !isPatternPartRole(role) || !Array.isArray(record.tileIds)) {
    throw new ToolError("patternGrammar.parts 항목 형식이 올바르지 않습니다.", { code: "invalid-args" });
  }
  const tileIds = record.tileIds.filter((tile): tile is number => typeof tile === "number" && Number.isInteger(tile));
  return { role, tileIds };
}

function structureJunctionsValue(tileset: TilesetDef, value: unknown): readonly TileGroupJunctionRule[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new ToolError("junctions 형식이 올바르지 않습니다.", { code: "invalid-args" });
  return value.map((entry) => structureJunctionValue(tileset, entry));
}

function structureJunctionValue(tileset: TilesetDef, value: unknown): TileGroupJunctionRule {
  const record = recordValue(value);
  if (!record) throw new ToolError("junction 항목 형식이 올바르지 않습니다.", { code: "invalid-args" });
  const withRole = roleValue(record.withRole);
  const side = junctionSideValue(record.side);
  const action = junctionActionValue(record.action);
  if (!withRole || !side || !action) throw new ToolError("junction 항목 형식이 올바르지 않습니다.", { code: "invalid-args" });
  const atRoles = stringArrayValue(record.atRoles, "junction.atRoles");
  const replaceWith = optionalTileIds(tileset, record.replaceWith, "junction.replaceWith");
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

function structureOverlaysValue(tileset: TilesetDef, value: unknown): readonly TileGroupOverlayRule[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new ToolError("overlays 형식이 올바르지 않습니다.", { code: "invalid-args" });
  return value.map((entry) => structureOverlayValue(tileset, entry));
}

function structureOverlayValue(tileset: TilesetDef, value: unknown): TileGroupOverlayRule {
  const record = recordValue(value);
  if (!record) throw new ToolError("overlay 항목 형식이 올바르지 않습니다.", { code: "invalid-args" });
  const when = overlayWhenValue(record.when);
  const tileIds = optionalTileIds(tileset, record.tileIds, "overlay.tileIds");
  if (!when || !tileIds || tileIds.length === 0) throw new ToolError("overlay 항목 형식이 올바르지 않습니다.", { code: "invalid-args" });
  return { tileIds, when };
}

function recordValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function integerValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function axisValue(value: unknown): PatternGrammar["axis"] | undefined {
  if (value === "both" || value === "horizontal" || value === "vertical") return value;
  return undefined;
}

function repeatValue(value: unknown): PatternGrammar["repeat"] | undefined {
  if (value === "body" || value === "center" || value === "source_order") return value;
  return undefined;
}

function isPatternKind(value: unknown): value is PatternGrammar["kind"] {
  return PATTERN_KINDS.some((kind) => kind === value);
}

function isPatternPartRole(value: unknown): value is PatternPartRole {
  return PATTERN_PART_ROLES.some((role) => role === value);
}

function stringArrayValue(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ToolError(`${label} 형식이 올바르지 않습니다.`, { code: "invalid-args" });
  }
  return [...value];
}

function optionalTileIds(tileset: TilesetDef, value: unknown, label: string): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ToolError(`${label} 형식이 올바르지 않습니다.`, { code: "invalid-args" });
  return value.map((tile) => requireTileIndex(tileset, tile));
}
