import type { Point } from "@/project/lint/reachability";

export type AcceptanceStatus = "pending" | "working" | "verifying" | "verified" | "blocked";
export interface AcceptanceSnapshot {
  readonly id: string;
  readonly goal: string;
  readonly status: AcceptanceStatus;
  readonly items: readonly AcceptanceItemSnapshot[];
}
export interface AcceptanceItemSnapshot {
  readonly id: string;
  readonly title: string;
  readonly status: AcceptanceStatus;
  readonly reason?: string;
  readonly issues?: readonly AcceptanceIssue[];
  readonly evidence: readonly { readonly expected: string; readonly observed: string; readonly passed: boolean; readonly issues?: readonly AcceptanceIssue[] }[];
  readonly mapId?: string;
  readonly region?: AcceptanceRegion;
}
export interface AcceptanceRegion { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export type AcceptanceTarget = { readonly mapId: string } | { readonly newMapName: string };
type ScopedTarget = { readonly target: AcceptanceTarget; readonly region?: AcceptanceRegion };
export type AcceptanceCriterion =
  | { readonly kind: "mapDimensions"; readonly target: AcceptanceTarget; readonly width: number; readonly height: number }
  | { readonly kind: "mapCount"; readonly targets: readonly AcceptanceTarget[]; readonly count: number }
  | (ScopedTarget & { readonly kind: "eventCount"; readonly count: number })
  | (ScopedTarget & { readonly kind: "targetChange" | "preserve" | "imageReviewed" })
  | { readonly kind: "actionCombat"; readonly target: AcceptanceTarget }
  | { readonly kind: "reachability"; readonly target: AcceptanceTarget; readonly from: Point; readonly to: readonly Point[] };
export interface AcceptancePromise {
  readonly id: string;
  readonly title: string;
  /** null means the entire criterion array failed parsing; repair is required. */
  readonly criteria: readonly AcceptanceCriterion[] | null;
  readonly issues?: readonly AcceptanceIssue[];
}
export interface AcceptanceIssue {
  readonly criterionIndex?: number;
  readonly field: string;
  readonly code: string;
  readonly expected: string;
  readonly example: AcceptanceCriterion;
  readonly mapId?: string;
  readonly cell?: Point;
  readonly blocker?: { readonly kind: "event" | "tile" | "bounds" | "route"; readonly eventId?: string };
}

const exampleTarget = Object.freeze({ mapId: "map_id" });
const examplePoint = Object.freeze({ x: 0, y: 0 });
export const ACCEPTANCE_EXAMPLES: Readonly<Record<AcceptanceCriterion["kind"], AcceptanceCriterion>> = Object.freeze({
  mapCount: Object.freeze({ kind: "mapCount", targets: Object.freeze([exampleTarget, Object.freeze({ newMapName: "New map" })]), count: 2 }),
  mapDimensions: Object.freeze({ kind: "mapDimensions", target: exampleTarget, width: 20, height: 15 }),
  eventCount: Object.freeze({ kind: "eventCount", target: exampleTarget, count: 1 }),
  targetChange: Object.freeze({ kind: "targetChange", target: exampleTarget }),
  preserve: Object.freeze({ kind: "preserve", target: exampleTarget }),
  imageReviewed: Object.freeze({ kind: "imageReviewed", target: exampleTarget }),
  actionCombat: Object.freeze({ kind: "actionCombat", target: exampleTarget }),
  reachability: Object.freeze({ kind: "reachability", target: exampleTarget, from: examplePoint, to: Object.freeze([Object.freeze({ x: 1, y: 0 })]) }),
});
export interface AcceptanceParseResult {
  readonly criteria: readonly AcceptanceCriterion[] | null;
  readonly issues: readonly AcceptanceIssue[];
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
export function parseActionCombatRequirements(value: unknown): { readonly targets: readonly AcceptanceTarget[] } | null {
  if (!acceptanceRecord(value) || Object.keys(value).some(key => key !== "targets")
    || !Array.isArray(value.targets) || value.targets.length === 0) return null;
  const targets = value.targets.map(target);
  return targets.every((entry): entry is AcceptanceTarget => entry !== null) ? { targets } : null;
}
function point(value: unknown): Point | null {
  return acceptanceRecord(value) && integer(value.x) && integer(value.y) ? { x: value.x, y: value.y } : null;
}
export function parseAcceptanceRegion(value: unknown): AcceptanceRegion | null {
  if (!acceptanceRecord(value) || !integer(value.x) || !integer(value.y) || !integer(value.w) || !integer(value.h)
    || value.w === 0 || value.h === 0) return null;
  return { x: value.x, y: value.y, w: value.w, h: value.h };
}
function criterion(value: unknown, index: number, issues: AcceptanceIssue[]): AcceptanceCriterion | null {
  const example = acceptanceRecord(value) && typeof value.kind === "string"
    ? Object.entries(ACCEPTANCE_EXAMPLES).find(([kind]) => kind === value.kind)?.[1] ?? ACCEPTANCE_EXAMPLES.mapCount
    : ACCEPTANCE_EXAMPLES.mapCount;
  const fail = (field: string, code: string, expected: string): null => {
    issues.push(Object.freeze({ criterionIndex: index, field: `criteria[${index}]${field ? `.${field}` : ""}`, code, expected, example }));
    return null;
  };
  if (!acceptanceRecord(value)) return fail("", "invalid-type", "criterion object");
  const invalid = (field: string, expected: string): null => fail(field,
    value[field] === undefined ? "missing-field" : "invalid-field", expected);
  const parseTarget = (entry: unknown, field: string): AcceptanceTarget | null => {
    const parsed = target(entry);
    return parsed ?? fail(field, entry === undefined ? "missing-field" : "invalid-selector", "object with exactly one nonempty selector: {mapId} OR {newMapName}");
  };
  // Evidence is generated only by the harness. Unknown fields fail closed.
  const keys: Record<string, readonly string[]> = {
    mapDimensions: ["kind", "target", "width", "height"], mapCount: ["kind", "targets", "count"],
    eventCount: ["kind", "target", "region", "count"], targetChange: ["kind", "target", "region"],
    preserve: ["kind", "target", "region"], imageReviewed: ["kind", "target", "region"],
    reachability: ["kind", "target", "from", "to"],
    actionCombat: ["kind", "target"],
  };
  const allowed = typeof value.kind === "string" && Object.hasOwn(keys, value.kind) ? keys[value.kind] : undefined;
  if (!allowed) return invalid("kind", Object.keys(ACCEPTANCE_EXAMPLES).join(" | "));
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra) return fail(extra, "unknown-field", `only ${allowed.join(", ")}`);
  if (value.kind === "mapCount") {
    if (!Array.isArray(value.targets) || value.targets.length === 0) return invalid("targets", "nonempty array of explicit scoped map selectors; never a project total");
    if (!integer(value.count)) return invalid("count", "nonnegative safe integer");
    const targets = value.targets.map((entry, targetIndex) => parseTarget(entry, `targets[${targetIndex}]`));
    if (targets.some(entry => entry === null)) return null;
    return { kind: "mapCount", targets: targets.filter((entry): entry is AcceptanceTarget => entry !== null), count: value.count };
  }
  const parsedTarget = parseTarget(value.target, "target");
  if (!parsedTarget) return null;
  const region = value.region === undefined ? undefined : parseAcceptanceRegion(value.region);
  if (region === null) return invalid("region", "{x,y,w,h}: nonnegative integer origin, positive integer size");
  const scope = { target: parsedTarget, ...(region ? { region } : {}) };
  switch (value.kind) {
    case "actionCombat": return { kind: value.kind, target: parsedTarget };
    case "mapDimensions":
      if (!integer(value.width) || value.width === 0) return invalid("width", "positive safe integer");
      if (!integer(value.height) || value.height === 0) return invalid("height", "positive safe integer");
      return { kind: value.kind, target: parsedTarget, width: value.width, height: value.height };
    case "eventCount": return integer(value.count) ? { kind: value.kind, ...scope, count: value.count } : invalid("count", "nonnegative safe integer");
    case "targetChange": case "preserve": case "imageReviewed": return { kind: value.kind, ...scope };
    case "reachability": {
      const from = point(value.from);
      if (!from) return invalid("from", "{x,y}: nonnegative safe integers; exact walkable origin cell");
      if (!Array.isArray(value.to) || value.to.length === 0) return invalid("to", "nonempty array of exact walkable {x,y} destination cells, not solid event cells");
      const to = value.to.map((entry, pointIndex) => point(entry)
        ?? fail(`to[${pointIndex}]`, "invalid-field", "{x,y}: nonnegative safe integers; exact walkable destination cell"));
      return to.every((entry): entry is Point => entry !== null) ? { kind: value.kind, target: parsedTarget, from, to } : null;
    }
    default: return null;
  }
}
export function parseAcceptanceCriteria(value: unknown): readonly AcceptanceCriterion[] | null {
  return parseAcceptanceCriteriaResult(value).criteria;
}
export function parseAcceptanceCriteriaResult(value: unknown): AcceptanceParseResult {
  if (!Array.isArray(value) || value.length === 0) return { criteria: null, issues: Object.freeze([Object.freeze({
    field: "criteria", code: value === undefined ? "missing-field" : "invalid-field",
    expected: "nonempty array of complete criteria; the entire array must be valid", example: ACCEPTANCE_EXAMPLES.mapCount,
  })]) };
  const issues: AcceptanceIssue[] = [];
  const criteria = value.map((entry, index) => criterion(entry, index, issues));
  return { criteria: criteria.every((entry): entry is AcceptanceCriterion => entry !== null) ? criteria : null, issues: Object.freeze(issues) };
}
export function missingAcceptance(title: string): readonly AcceptancePromise[] {
  return [{ id: "acceptance-contract", title, ...parseAcceptanceCriteriaResult(undefined) }];
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
    const parsed = parseAcceptanceCriteriaResult(entry.criteria);
    promises.push({ id: entry.id, title: entry.title, criteria: parsed.criteria, ...(parsed.issues.length ? { issues: parsed.issues } : {}) });
  }
  if (needsRepair) {
    let id = "acceptance-contract";
    for (let suffix = 1; ids.has(id); suffix += 1) id = `acceptance-contract-${suffix}`;
    promises.push({ id, title: "Acceptance contract repair", criteria: null, issues: Object.freeze([Object.freeze({ field: "acceptance", code: "invalid-promise", expected: "array of promises with unique nonempty id, title, and complete criteria", example: ACCEPTANCE_EXAMPLES.mapCount })]) });
  }
  return promises;
}
