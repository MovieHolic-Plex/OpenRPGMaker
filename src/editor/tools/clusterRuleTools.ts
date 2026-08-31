import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import {
  asPlacementFacing,
  asPlacementZone,
  PLACEMENT_FACINGS,
  PLACEMENT_ZONES,
} from "@/project/placementSurface";
import type { ClusterRule, ClusterRuleStrength, TilesetDef } from "@/project/types";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const CLUSTER_RULE_KINDS: readonly ClusterRule["kind"][] = ["adjacency", "spacing", "count", "surface"];
const CLUSTER_RULE_STRENGTHS: readonly ClusterRuleStrength[] = ["hard", "medium", "soft"];
const ADJACENCY_RELATIONS = ["aAboveB", "aBelowB", "aLeftOfB", "aRightOfB"] as const;

type AdjacencyRelation = (typeof ADJACENCY_RELATIONS)[number];

export const CLUSTER_RULE_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", description: "규칙 id. 같은 id는 갱신" },
    kind: {
      type: "string",
      enum: CLUSTER_RULE_KINDS,
      description:
        "adjacency=타일 짝의 상하좌우 / spacing=최소 간격 / count=개수 / "
        + "surface=배치 면(어떤 자리에 놓이는가). surface 는 params {zone, facing} 를 받는다.",
    },
    strength: { type: "string", enum: CLUSTER_RULE_STRENGTHS, description: "hard=error, medium=warning, soft=info" },
    params: { type: "object", additionalProperties: true, description: "kind별 파라미터" },
    message: { type: "string", description: "lint에 표시할 한국어 메시지" },
  },
  required: ["id", "kind", "strength", "params"],
  additionalProperties: true,
} satisfies JsonSchema;

function requireTileset(project: { readonly tilesets: Record<string, TilesetDef> }, tilesetId: unknown): TilesetDef {
  const id = typeof tilesetId === "string" && tilesetId.trim() ? tilesetId.trim() : DEFAULT_TILESET_ID;
  const tileset = project.tilesets[id];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${id}`, { code: "tileset-not-found" });
  return tileset;
}

function requireGroup(tileset: TilesetDef, groupIdValue: unknown): NonNullable<TilesetDef["tileGroups"]>[number] {
  const groupId = typeof groupIdValue === "string" ? groupIdValue.trim() : "";
  if (!groupId) throw new ToolError("groupId가 비어 있습니다.", { code: "invalid-args" });
  const group = tileset.tileGroups?.find((candidate) => candidate.id === groupId);
  if (!group) throw new ToolError(`그룹을 찾을 수 없습니다: ${groupId}`, { code: "group-not-found" });
  return group;
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(`${label} 형식이 올바르지 않습니다.`, { code: "invalid-args" });
  }
  return value as Record<string, unknown>;
}

function textValue(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new ToolError(`${label}가 비어 있습니다.`, { code: "invalid-args" });
  return text;
}

function kindValue(value: unknown): ClusterRule["kind"] | undefined {
  return CLUSTER_RULE_KINDS.find((kind) => kind === value);
}

function strengthValue(value: unknown): ClusterRuleStrength | undefined {
  return CLUSTER_RULE_STRENGTHS.find((strength) => strength === value);
}

function relationValue(value: unknown): AdjacencyRelation | undefined {
  return ADJACENCY_RELATIONS.find((relation) => relation === value);
}

function requireInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ToolError(`${label}는 정수여야 합니다.`, { code: "invalid-args" });
  }
  return value;
}

function requireTileIndex(tileset: TilesetDef, value: unknown, label: string): number {
  const tile = requireInteger(value, label);
  if (tile < 0 || tile >= tileset.count) {
    throw new ToolError(`${label} 범위 밖: ${tile} (0~${tileset.count - 1})`, { code: "tile-out-of-range" });
  }
  return tile;
}

function optionalNonNegativeInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = requireInteger(value, label);
  if (parsed < 0) throw new ToolError(`${label}는 0 이상이어야 합니다.`, { code: "invalid-args" });
  return parsed;
}

function requirePositiveInteger(value: unknown, label: string): number {
  const parsed = requireInteger(value, label);
  if (parsed < 1) throw new ToolError(`${label}는 1 이상이어야 합니다.`, { code: "invalid-args" });
  return parsed;
}

function adjacencyParams(tileset: TilesetDef, params: Record<string, unknown>): Record<string, unknown> {
  const relation = relationValue(params.relation);
  if (!relation) throw new ToolError(`알 수 없는 adjacency relation: ${String(params.relation)}`, { code: "invalid-args" });
  return {
    a: requireTileIndex(tileset, params.a, "params.a"),
    b: requireTileIndex(tileset, params.b, "params.b"),
    relation,
  };
}

function spacingParams(params: Record<string, unknown>): Record<string, unknown> {
  return { minGap: requirePositiveInteger(params.minGap, "params.minGap") };
}

/**
 * 배치 면 파라미터. zone 은 필수, facing 은 `againstWall` 에서만 뜻이 있다.
 * 이 규칙이 있어야 「화덕은 북쪽 벽에 붙는다」가 산문이 아니라 검사 가능한 조건이 된다.
 */
function surfaceParams(params: Record<string, unknown>): Record<string, unknown> {
  const zone = asPlacementZone(params.zone);
  if (!zone) {
    throw new ToolError(
      `알 수 없는 params.zone: ${String(params.zone)} — ${PLACEMENT_ZONES.join("/")} 중 하나여야 합니다.`,
      { code: "invalid-args" },
    );
  }
  if (params.facing === undefined) return { zone };
  const facing = asPlacementFacing(params.facing);
  if (!facing) {
    throw new ToolError(
      `알 수 없는 params.facing: ${String(params.facing)} — ${PLACEMENT_FACINGS.join("/")} 중 하나여야 합니다.`,
      { code: "invalid-args" },
    );
  }
  return { facing, zone };
}

function countParams(params: Record<string, unknown>): Record<string, unknown> {
  const min = optionalNonNegativeInteger(params.min, "params.min");
  const max = optionalNonNegativeInteger(params.max, "params.max");
  if (min === undefined && max === undefined) {
    throw new ToolError("count 규칙에는 params.min 또는 params.max가 필요합니다.", { code: "invalid-args" });
  }
  if (min !== undefined && max !== undefined && min > max) {
    throw new ToolError("count 규칙의 min은 max보다 클 수 없습니다.", { code: "invalid-args" });
  }
  if (params.perMap !== undefined && typeof params.perMap !== "boolean") {
    throw new ToolError("params.perMap은 boolean이어야 합니다.", { code: "invalid-args" });
  }
  const parsed: Record<string, unknown> = {};
  if (min !== undefined) parsed.min = min;
  if (max !== undefined) parsed.max = max;
  if (params.perMap !== undefined) parsed.perMap = params.perMap;
  return parsed;
}

function paramsForRule(tileset: TilesetDef, kind: ClusterRule["kind"], rawParams: unknown): Record<string, unknown> {
  const params = recordValue(rawParams, "rule.params");
  switch (kind) {
    case "adjacency":
      return adjacencyParams(tileset, params);
    case "spacing":
      return spacingParams(params);
    case "count":
      return countParams(params);
    case "surface":
      return surfaceParams(params);
  }
}

export function requireClusterRule(tileset: TilesetDef, value: unknown): ClusterRule {
  const record = recordValue(value, "rule");
  const kind = kindValue(record.kind);
  const strength = strengthValue(record.strength);
  if (!kind) throw new ToolError(`알 수 없는 rule.kind: ${String(record.kind)}`, { code: "invalid-args" });
  if (!strength) throw new ToolError(`알 수 없는 rule.strength: ${String(record.strength)}`, { code: "invalid-args" });
  const id = textValue(record.id, "rule.id");
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim() : undefined;
  return {
    id,
    kind,
    params: paramsForRule(tileset, kind, record.params),
    strength,
    ...(message ? { message } : {}),
  };
}

export function requireClusterRules(tileset: TilesetDef, value: unknown): ClusterRule[] {
  if (!Array.isArray(value)) throw new ToolError("rules 형식이 올바르지 않습니다.", { code: "invalid-args" });
  return value.map((entry) => requireClusterRule(tileset, entry));
}

const setClusterRule: ToolDefinition = {
  name: "set_cluster_rule",
  description:
    "타일 그룹의 클러스터 규칙을 추가하거나 갱신한다. hard는 projectLint error로 커밋 게이트에서 차단되고, medium/soft는 warning/info로 보고된다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "대상 타일셋 id" },
      groupId: { type: "string", description: "대상 타일 그룹 id" },
      rule: CLUSTER_RULE_SCHEMA,
    },
    required: ["tilesetId", "groupId", "rule"],
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const group = requireGroup(tileset, args.groupId);
    const rule = requireClusterRule(tileset, args.rule);
    const rules = [...(group.rules ?? [])];
    const index = rules.findIndex((entry) => entry.id === rule.id);
    if (index >= 0) rules[index] = rule;
    else rules.push(rule);
    group.rules = rules;
    return {
      summary: `클러스터 규칙 저장: ${group.name} / ${rule.kind} / ${rule.strength}`,
      data: { groupId: group.id, ruleId: rule.id, tilesetId: tileset.id, updated: index >= 0 },
    };
  },
};

export const CLUSTER_RULE_TOOLS: readonly ToolDefinition[] = [setClusterRule];
