import type { Point } from "@/project/lint/reachability";
import { VERIFICATION_TOOL_NAMES } from "./agentVerification";

export type AcceptanceStatus = "pending" | "working" | "verifying" | "verified" | "blocked";
export interface AcceptanceSnapshot {
  readonly id: string;
  readonly goal: string;
  readonly status: AcceptanceStatus;
  readonly items: readonly AcceptanceItemSnapshot[];
}
export interface AcceptanceSource {
  readonly requestId: string;
  readonly text: string;
  readonly scope: {
    readonly mapId: string;
    readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  } | null;
}
export interface RequirementWithdrawalAction {
  readonly acceptanceId: string;
  readonly requirementId: string;
  readonly reason: string;
}
export interface AcceptanceItemSnapshot {
  readonly required?: boolean;
  readonly source?: AcceptanceSource;
  readonly withdrawal?: RequirementWithdrawalAction & { readonly source: "user" };
  readonly id: string;
  readonly title: string;
  readonly status: AcceptanceStatus;
  readonly reason?: string;
  readonly evidence: readonly { readonly expected: string; readonly observed: string; readonly passed: boolean }[];
  readonly mapId?: string;
  readonly region?: AcceptanceRegion;
}
export interface AcceptanceRegion { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export type AcceptanceTarget = { readonly mapId: string } | { readonly newMapName: string };
type ScopedTarget = { readonly target: AcceptanceTarget; readonly region?: AcceptanceRegion };
export type AcceptanceCriterion =
  | { readonly kind: "toolVerdict"; readonly tool: string; readonly args: Readonly<Record<string, unknown>> }
  | { readonly kind: "mapDimensions"; readonly target: AcceptanceTarget; readonly width: number; readonly height: number }
  | { readonly kind: "mapCount"; readonly targets: readonly AcceptanceTarget[]; readonly count: number }
  | (ScopedTarget & { readonly kind: "eventCount"; readonly count: number })
  | (ScopedTarget & { readonly kind: "targetChange" | "preserve" | "imageReviewed" })
  | { readonly kind: "reachability"; readonly target: AcceptanceTarget; readonly from: Point; readonly to: readonly Point[] };
export interface AcceptancePromise {
  readonly required?: boolean;
  readonly id: string;
  readonly title: string;
  /** null means the entire criterion array failed parsing; repair is required. */
  readonly criteria: readonly AcceptanceCriterion[] | null;
}

export function acceptanceRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function target(value: unknown): AcceptanceTarget | null {
  if (!acceptanceRecord(value)) return null;
  if (text(value.mapId) && Object.keys(value).length === 1) return { mapId: value.mapId };
  if (text(value.newMapName) && Object.keys(value).length === 1) return { newMapName: value.newMapName };
  return null;
}
function point(value: unknown): Point | null {
  return acceptanceRecord(value) && integer(value.x) && integer(value.y) ? { x: value.x, y: value.y } : null;
}
export function parseAcceptanceRegion(value: unknown): AcceptanceRegion | null {
  if (!acceptanceRecord(value) || !integer(value.x) || !integer(value.y) || !integer(value.w) || !integer(value.h)
    || value.w === 0 || value.h === 0) return null;
  return { x: value.x, y: value.y, w: value.w, h: value.h };
}
function criterion(value: unknown): AcceptanceCriterion | null {
  if (!acceptanceRecord(value)) return null;
  // Evidence is generated only by the harness. Unknown fields fail closed.
  const keys: Record<string, readonly string[]> = {
    mapDimensions: ["kind", "target", "width", "height"], mapCount: ["kind", "targets", "count"],
    eventCount: ["kind", "target", "region", "count"], targetChange: ["kind", "target", "region"],
    preserve: ["kind", "target", "region"], imageReviewed: ["kind", "target", "region"],
    reachability: ["kind", "target", "from", "to"], toolVerdict: ["kind", "tool", "args"],
  };
  const allowed = typeof value.kind === "string" && Object.hasOwn(keys, value.kind) ? keys[value.kind] : undefined;
  if (!allowed || Object.keys(value).some(key => !allowed.includes(key))) return null;
  if (value.kind === "toolVerdict") {
    return text(value.tool) && VERIFICATION_TOOL_NAMES.has(value.tool) && acceptanceRecord(value.args)
      ? { kind: "toolVerdict", tool: value.tool, args: structuredClone(value.args) } : null;
  }
  if (value.kind === "mapCount") {
    if (!Array.isArray(value.targets) || value.targets.length === 0 || !integer(value.count)) return null;
    const targets = value.targets.map(target);
    if (targets.some(entry => entry === null)) return null;
    return { kind: "mapCount", targets: targets.filter((entry): entry is AcceptanceTarget => entry !== null), count: value.count };
  }
  const parsedTarget = target(value.target);
  if (!parsedTarget) return null;
  const region = value.region === undefined ? undefined : parseAcceptanceRegion(value.region);
  if (region === null) return null;
  const scope = { target: parsedTarget, ...(region ? { region } : {}) };
  switch (value.kind) {
    case "mapDimensions":
      return integer(value.width) && integer(value.height) && value.width > 0 && value.height > 0
        ? { kind: value.kind, target: parsedTarget, width: value.width, height: value.height } : null;
    case "eventCount": return integer(value.count) ? { kind: value.kind, ...scope, count: value.count } : null;
    case "targetChange": case "preserve": case "imageReviewed": return { kind: value.kind, ...scope };
    case "reachability": {
      const from = point(value.from);
      if (!from || !Array.isArray(value.to) || value.to.length === 0) return null;
      const to = value.to.map(point);
      return to.every((entry): entry is Point => entry !== null) ? { kind: value.kind, target: parsedTarget, from, to } : null;
    }
    default: return null;
  }
}
export function parseAcceptanceCriteria(value: unknown): readonly AcceptanceCriterion[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const criteria = value.map(criterion);
  return criteria.every((entry): entry is AcceptanceCriterion => entry !== null) ? criteria : null;
}
export function missingAcceptance(title: string): readonly AcceptancePromise[] {
  return [{ id: "acceptance-contract", title, criteria: null }];
}
export function parseAcceptance(value: unknown): readonly AcceptancePromise[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) return missingAcceptance("Acceptance contract repair");
  const ids = new Set<string>();
  const promises: AcceptancePromise[] = [];
  let needsRepair = false;
  for (const entry of value) {
    if (!acceptanceRecord(entry) || !text(entry.id) || !text(entry.title) || ids.has(entry.id)) {
      needsRepair = true;
      continue;
    }
    ids.add(entry.id);
    const validRequired = entry.required === undefined || typeof entry.required === "boolean";
    const criteria = validRequired ? parseAcceptanceCriteria(entry.criteria) : null;
    promises.push({ id: entry.id, title: entry.title, required: criteria === null || entry.required !== false, criteria });
  }
  if (needsRepair) {
    let id = "acceptance-contract";
    for (let suffix = 1; ids.has(id); suffix += 1) id = `acceptance-contract-${suffix}`;
    promises.push({ id, title: "Acceptance contract repair", criteria: null });
  }
  return promises;
}
