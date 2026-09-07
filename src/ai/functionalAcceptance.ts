import type { Point } from "@/project/lint/reachability";
import type { AcceptanceSource, AcceptanceTarget } from "./assistantAcceptance";
import { parseNpcRewardRequirements, type NpcRewardRequirement } from "./intentDeclaration";

export type FunctionalEventTarget = { readonly eventId: string } | { readonly eventName: string };
export type FunctionalItemTarget = { readonly id: string } | { readonly name: string };
export type ConcreteFunctionalCriterion =
  | { readonly kind: "shopPurchase"; readonly target: AcceptanceTarget; readonly start: Point;
      readonly seller: FunctionalEventTarget; readonly item: FunctionalItemTarget; readonly count: number; readonly unitPrice: number }
  | { readonly kind: "mapRoundTrip"; readonly target: AcceptanceTarget; readonly start: Point;
      readonly destination: AcceptanceTarget; readonly outgoing: FunctionalEventTarget; readonly returning: FunctionalEventTarget }
  | { readonly kind: "npcReward"; readonly requirement: NpcRewardRequirement };
export type FunctionalExpectations = {
  [Kind in ConcreteFunctionalCriterion["kind"]]: Partial<Extract<ConcreteFunctionalCriterion, { kind: Kind }>> & { readonly kind: Kind }
}[ConcreteFunctionalCriterion["kind"]];
export type FunctionalCriterion = ConcreteFunctionalCriterion
  | { readonly kind: "functionalUnresolved"; readonly reason: string; readonly expectations?: FunctionalExpectations };
export interface FunctionalRefinement {
  readonly requirementId: string;
  readonly criterion: FunctionalCriterion;
  readonly corrections?: readonly string[];
}
export interface UnresolvedFunctionalRequirement {
  readonly requirementId: string;
  readonly source: AcceptanceSource;
  readonly refinements?: readonly AcceptanceSource[];
  readonly criterion: Extract<FunctionalCriterion, { kind: "functionalUnresolved" }>;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function exclusive(value: unknown, first: string, second: string): boolean {
  return record(value) && Object.keys(value).length === 1 && (text(value[first]) || text(value[second]));
}
function map(value: unknown): value is AcceptanceTarget { return exclusive(value, "mapId", "newMapName"); }
function event(value: unknown): value is FunctionalEventTarget { return exclusive(value, "eventId", "eventName"); }
function item(value: unknown): value is FunctionalItemTarget { return exclusive(value, "id", "name"); }
function point(value: unknown): value is Point {
  return record(value) && Object.keys(value).length === 2 && count(value.x) && count(value.y);
}
export function isFunctionalCriterionKind(kind: string): boolean {
  return ["shopPurchase", "mapRoundTrip", "npcReward", "functionalUnresolved"].includes(kind);
}
/** Model-facing boundary: expectations only, never scripts, state injection or pass flags. */
export function parseFunctionalCriterion(value: unknown): FunctionalCriterion | null {
  if (!record(value)) return null;
  const fields: Record<string, readonly string[]> = {
    shopPurchase: ["kind", "target", "start", "seller", "item", "count", "unitPrice"],
    mapRoundTrip: ["kind", "target", "start", "destination", "outgoing", "returning"],
    npcReward: ["kind", "requirement"], functionalUnresolved: ["kind", "reason", "expectations"],
  };
  if (typeof value.kind !== "string" || !Object.hasOwn(fields, value.kind)
    || Object.keys(value).some(key => !fields[value.kind as string].includes(key))) return null;
  if (value.kind === "functionalUnresolved") {
    if (!text(value.reason) || (value.expectations !== undefined && !isFunctionalExpectations(value.expectations))) return null;
    return { kind: value.kind, reason: value.reason,
      ...(isFunctionalExpectations(value.expectations) ? { expectations: structuredClone(value.expectations) } : {}) };
  }
  if (value.kind === "npcReward") {
    const requirements = parseNpcRewardRequirements([value.requirement]);
    return "invalidReason" in requirements || !requirements[0] ? null : { kind: value.kind, requirement: requirements[0] };
  }
  if (!map(value.target) || !point(value.start)) return null;
  if (value.kind === "shopPurchase" && event(value.seller) && item(value.item)
    && count(value.count) && value.count > 0 && value.count <= 99 && count(value.unitPrice)) {
    return { kind: value.kind, target: structuredClone(value.target), start: { ...value.start }, seller: structuredClone(value.seller),
      item: structuredClone(value.item), count: value.count, unitPrice: value.unitPrice };
  }
  if (value.kind === "mapRoundTrip" && map(value.destination) && event(value.outgoing) && event(value.returning)) {
    return { kind: value.kind, target: structuredClone(value.target), start: { ...value.start }, destination: structuredClone(value.destination),
      outgoing: structuredClone(value.outgoing), returning: structuredClone(value.returning) };
  }
  return null;
}

function isFunctionalExpectations(value: unknown): value is FunctionalExpectations {
  if (!record(value)) return false;
  const checks: Record<string, (entry: unknown) => boolean> = {
    target: map, start: point, seller: event, item, count: entry => count(entry) && entry > 0 && entry <= 99,
    unitPrice: count, destination: map, outgoing: event, returning: event,
    requirement: entry => !("invalidReason" in parseNpcRewardRequirements([entry])),
  };
  const fields = value.kind === "shopPurchase" ? ["target", "start", "seller", "item", "count", "unitPrice"]
    : value.kind === "mapRoundTrip" ? ["target", "start", "destination", "outgoing", "returning"]
    : value.kind === "npcReward" ? ["requirement"] : null;
  return fields !== null && Object.entries(value).every(([key, entry]) => key === "kind" || (fields.includes(key) && checks[key](entry)));
}

/** Refinements are interpreted only at the genuine user-declaration boundary, never as worker tools. */
export function parseFunctionalRefinements(value: unknown): readonly FunctionalRefinement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (!record(entry) || !text(entry.requirementId)
      || Object.keys(entry).some(key => !["requirementId", "criterion", "corrections"].includes(key))
      || (entry.corrections !== undefined && (!Array.isArray(entry.corrections) || !entry.corrections.every(text)))) return [];
    const criterion = parseFunctionalRequirements([entry.criterion])[0];
    return criterion ? [{ requirementId: entry.requirementId, criterion,
      ...(Array.isArray(entry.corrections) ? { corrections: entry.corrections.filter(text) } : {}) }] : [];
  });
}

export function parseFunctionalRequirements(value: unknown): readonly FunctionalCriterion[] {
  if (!Array.isArray(value) || value.length === 0) return [{ kind: "functionalUnresolved", reason: "functionalAcceptance requires nonempty request-derived criteria" }];
  return value.map(entry => parseFunctionalCriterion(entry) ?? {
    kind: "functionalUnresolved", reason: `Missing or unsupported functional target/expectations: ${JSON.stringify(entry)}. Identify exact targets, actual start and requested quantities/prices; do not replace with static or image checks.`,
    ...(isFunctionalExpectations(entry) ? { expectations: structuredClone(entry) } : {}),
  });
}
