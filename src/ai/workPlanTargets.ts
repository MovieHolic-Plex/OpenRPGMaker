import { getTool } from "@/editor/tools/toolRegistry";
import { affectedRegions, SPATIAL_BUILD_TOOLS, TILE_WRITE_TOOLS } from "./buildSpec";
import { createdMapIdFrom, MAP_CREATING_TOOLS } from "./workItemOutcome";
import type { WorkItem, WorkPlan } from "./workPlan";

export interface WorkToolOutcome {
  readonly name: string;
  readonly mapIds: readonly string[];
  readonly ok: boolean;
}
export interface WorkTargetIssue {
  readonly code: string;
  readonly field: string;
  readonly mapId?: string;
  readonly tool?: string;
  readonly message: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Missing is legacy input; null retains malformed input instead of dropping it. */
export function parseWorkTargetIds(value: unknown): readonly string[] | null | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0
    || !value.every((id): id is string => typeof id === "string" && id.trim().length > 0)) return null;
  const ids = value.map(id => id.trim());
  return new Set(ids).size === ids.length ? ids : null;
}

export function isMapWorkTool(name: string): boolean {
  return name === "create_transfer_pair" || SPATIAL_BUILD_TOOLS.has(name) || TILE_WRITE_TOOLS.has(name)
    || MAP_CREATING_TOOLS.has(name) || getTool(name)?.parameters.properties?.mapId !== undefined;
}

export function workToolOutcome(name: string, args: Record<string, unknown>, ok: boolean, data?: unknown): WorkToolOutcome {
  if (name === "create_transfer_pair") {
    const mapIds = [args.a, args.b].flatMap(endpoint => record(endpoint) && typeof endpoint.mapId === "string" ? [endpoint.mapId] : []);
    return { name, mapIds: [...new Set(mapIds)].sort(), ok };
  }
  const created = createdMapIdFrom(name, args, data);
  return { name, mapIds: created ? [created] : [...new Set(affectedRegions(name, args).map(region => region.mapId))].sort(), ok };
}

/** Each item authors one map; a separate linking item depends on both authoring items. */
export function workTargetContractIssues(item: WorkItem): WorkTargetIssue[] {
  const required = item.successTools ?? [];
  const spatial = required.filter(name => name === "create_transfer_pair" || SPATIAL_BUILD_TOOLS.has(name) || TILE_WRITE_TOOLS.has(name) || MAP_CREATING_TOOLS.has(name));
  const issue = (code: string, field: string, message: string): WorkTargetIssue => ({ code, field, message });
  if (item.mapTargets === null) return [issue("invalid-map-targets", "mapTargets", "mapTargets must be a nonempty array of unique exact map IDs.")];
  if (spatial.length === 0) return [];
  if (!item.mapTargets?.length) return [issue("missing-map-targets", "mapTargets", "Declare mapTargets:[\"map_id\"] for this spatial item. Split authoring by map and put create_transfer_pair in a separate item depending on both map items; use set_work_plan to correct the unfinished plan.")];
  const links = spatial.includes("create_transfer_pair");
  if (links && spatial.length > 1) return [issue("mixed-link-authoring", "successTools", `Separate authoring for ${item.mapTargets.join(", ")} from create_transfer_pair; put the linking item after both authoring items in layer/item order. BuildSpec remains single-map.`)];
  if (!links && item.mapTargets.length !== 1) return [issue("mixed-map-authoring", "mapTargets", `Split ${item.mapTargets.join(", ")} into one authoring item per map, each with its own BuildSpec and successTools. Do not repeat already completed items.`)];
  if (links && item.mapTargets.length !== 2) return [issue("invalid-link-targets", "mapTargets", "Linking requires exactly two mapTargets, after their authoring items in layer/item order.")];
  return [];
}

export function workTargetIssues(item: WorkItem, outcomes: readonly WorkToolOutcome[], plan?: WorkPlan): WorkTargetIssue[] {
  const issues = workTargetContractIssues(item);
  if (item.successTools?.includes("create_transfer_pair")) {
    for (const prerequisite of plan?.layers.flatMap(layer => layer.items) ?? []) {
      if (prerequisite.id === item.id) break;
      if (prerequisite.successTools?.includes("create_transfer_pair")) continue;
      if (prerequisite.mapTargets?.some(id => item.mapTargets?.includes(id)) && prerequisite.status !== "done") {
        issues.push({ code: "unmet-map-dependency", field: "layers.items", message: `Complete map authoring item ${prerequisite.id} before linking ${item.id}; put authoring before linking in layer/item order. Skipping does not satisfy the prerequisite.` });
      }
    }
  }
  if (!item.mapTargets) for (const outcome of outcomes) {
    if (outcome.ok || !item.successTools?.includes(outcome.name)) continue;
    for (const mapId of outcome.mapIds) issues.push({ code: "failed-map-outcome", field: "mapTargets", mapId, tool: outcome.name, message: `${mapId}: ${outcome.name} failed. Preserve this unfinished target when splitting the plan.` });
  }
  for (const tool of item.successTools ?? []) {
    if (!isMapWorkTool(tool)) continue;
    for (const mapId of item.mapTargets ?? []) {
      const outcome = [...outcomes].reverse().find(entry => entry.name === tool && entry.mapIds.includes(mapId));
      if (outcome?.ok && (tool !== "create_transfer_pair" || item.mapTargets?.every(id => outcome.mapIds.includes(id)))) continue;
      issues.push({ code: "missing-map-outcome", field: "mapTargets", mapId, tool, message: `${mapId}: ${tool} has no successful target outcome. Submit this map's own BuildSpec if needed and satisfy this target; success on another map or a transfer is not a substitute.` });
    }
  }
  return issues;
}
