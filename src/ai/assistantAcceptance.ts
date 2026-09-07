import type { RequestSourceSpan } from "./assistantRequestContract";
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
export interface RequirementSupersession {
  readonly requestId: string;
  readonly requirementId: string;
  readonly source: RequestSourceSpan;
}
export interface AcceptanceItemSnapshot {
  readonly sourceSpan?: RequestSourceSpan;
  readonly coverage?: "uncovered" | "unsupported" | "declared";
  readonly supersession?: RequirementSupersession;
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
export const ACCEPTANCE_DATABASE_COLLECTIONS = ["actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states", "battleAnimations", "equipmentSlots", "elements", "terrains", "battleCommands", "monsterSpecies", "crops", "lifeSkills", "farmAnimalSpecies", "fishSpecies", "farmBuildingTypes", "homeDecorationTypes"] as const;
export type AcceptanceDatabaseCollection = typeof ACCEPTANCE_DATABASE_COLLECTIONS[number];
export type AcceptanceSubject =
  | { readonly kind: "project" }
  | { readonly kind: "database"; readonly collection: AcceptanceDatabaseCollection; readonly id: string }
  | { readonly kind: "event"; readonly mapId: string; readonly eventId: string }
  | { readonly kind: "asset"; readonly category: "sprites" | "uploaded"; readonly id: string };
export type AcceptanceCollection =
  | { readonly kind: "database"; readonly collection: AcceptanceDatabaseCollection }
  | { readonly kind: "events"; readonly mapId: string }
  | { readonly kind: "assets"; readonly category: "sprites" | "uploaded" };
export type AcceptanceSelector = { readonly ids: readonly string[] } | { readonly names: readonly string[] } | { readonly all: true };
export type AcceptanceJson = null | boolean | number | string | readonly AcceptanceJson[] | { readonly [key: string]: AcceptanceJson };
export type AcceptanceCriterion =
  | { readonly kind: "valueEquals"; readonly subject: AcceptanceSubject; readonly path: readonly string[]; readonly value: AcceptanceJson }
  | { readonly kind: "entityPreserve"; readonly subject: AcceptanceSubject; readonly path?: readonly string[] }
  | { readonly kind: "membershipPreserve"; readonly collection: AcceptanceCollection; readonly selector: AcceptanceSelector }
  | { readonly kind: "entityCount"; readonly collection: AcceptanceCollection; readonly selector: AcceptanceSelector; readonly comparison: "eq" | "gte" | "lte"; readonly count: number; readonly basis: "current" | "requestDelta" }
  | { readonly kind: "toolVerdict"; readonly tool: string; readonly args: Readonly<Record<string, unknown>> }
  | { readonly kind: "mapDimensions"; readonly target: AcceptanceTarget; readonly width: number; readonly height: number }
  | { readonly kind: "mapCount"; readonly targets: readonly AcceptanceTarget[]; readonly count: number }
  | (ScopedTarget & { readonly kind: "eventCount"; readonly count: number })
  | (ScopedTarget & { readonly kind: "targetChange" | "preserve" | "imageReviewed" })
  | { readonly kind: "actionCombat"; readonly target: AcceptanceTarget }
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
const safeKey = (key: string): boolean => !["__proto__", "prototype", "constructor", "toString", "valueOf", "dataUrl"].includes(key);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).every(key => keys.includes(key));
function subject(value: unknown): AcceptanceSubject | null {
  if (!acceptanceRecord(value)) return null;
  if (value.kind === "project" && exactKeys(value, ["kind"])) return { kind: "project" };
  if (value.kind === "database" && exactKeys(value, ["kind", "collection", "id"]) && text(value.id)
    && ACCEPTANCE_DATABASE_COLLECTIONS.some(key => key === value.collection)) return value as AcceptanceSubject;
  if (value.kind === "event" && exactKeys(value, ["kind", "mapId", "eventId"]) && text(value.mapId) && text(value.eventId)) return value as AcceptanceSubject;
  if (value.kind === "asset" && exactKeys(value, ["kind", "category", "id"]) && text(value.id)
    && (value.category === "sprites" || value.category === "uploaded")) return value as AcceptanceSubject;
  return null;
}
function collection(value: unknown): AcceptanceCollection | null {
  if (!acceptanceRecord(value)) return null;
  if (value.kind === "database" && exactKeys(value, ["kind", "collection"])
    && ACCEPTANCE_DATABASE_COLLECTIONS.some(key => key === value.collection)) return value as AcceptanceCollection;
  if (value.kind === "events" && exactKeys(value, ["kind", "mapId"]) && text(value.mapId)) return value as AcceptanceCollection;
  if (value.kind === "assets" && exactKeys(value, ["kind", "category"])
    && (value.category === "sprites" || value.category === "uploaded")) return value as AcceptanceCollection;
  return null;
}
function selector(value: unknown): AcceptanceSelector | null {
  if (!acceptanceRecord(value) || Object.keys(value).length !== 1) return null;
  if (value.all === true) return { all: true };
  for (const key of ["ids", "names"] as const) {
    const entries = value[key];
    if (Array.isArray(entries) && entries.length > 0 && entries.every(text) && new Set(entries).size === entries.length) return key === "ids" ? { ids: entries } : { names: entries };
  }
  return null;
}
function json(value: unknown): value is AcceptanceJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(json);
  return acceptanceRecord(value) && Object.entries(value).every(([key, entry]) => safeKey(key) && json(entry));
}
function criterion(value: unknown): AcceptanceCriterion | null {
  if (!acceptanceRecord(value)) return null;
  // Evidence is generated only by the harness. Unknown fields fail closed.
  const keys: Record<string, readonly string[]> = {
    mapDimensions: ["kind", "target", "width", "height"], mapCount: ["kind", "targets", "count"],
    eventCount: ["kind", "target", "region", "count"], targetChange: ["kind", "target", "region"],
    preserve: ["kind", "target", "region"], imageReviewed: ["kind", "target", "region"],
    reachability: ["kind", "target", "from", "to"], toolVerdict: ["kind", "tool", "args"],
    actionCombat: ["kind", "target"],
    valueEquals: ["kind", "subject", "path", "value"], entityPreserve: ["kind", "subject", "path"],
    entityCount: ["kind", "collection", "selector", "comparison", "count", "basis"],
    membershipPreserve: ["kind", "collection", "selector"],
  };
  const allowed = typeof value.kind === "string" && Object.hasOwn(keys, value.kind) ? keys[value.kind] : undefined;
  if (!allowed || Object.keys(value).some(key => !allowed.includes(key))) return null;
  if (value.kind === "toolVerdict") {
    return text(value.tool) && VERIFICATION_TOOL_NAMES.has(value.tool) && acceptanceRecord(value.args)
      ? { kind: "toolVerdict", tool: value.tool, args: structuredClone(value.args) } : null;
  }
  if (value.kind === "valueEquals" || value.kind === "entityPreserve") {
    const parsed = subject(value.subject);
    if (!parsed) return null;
    if (value.kind === "entityPreserve") {
      if (value.path === undefined) return { kind: value.kind, subject: parsed };
      if (!Array.isArray(value.path) || !value.path.every((key): key is string => text(key) && safeKey(key))
        || (parsed.kind === "project" && !["meta", "system"].includes(value.path[0] ?? ""))) return null;
      return { kind: value.kind, subject: parsed, path: value.path };
    }
    if (!Array.isArray(value.path) || !value.path.every((key): key is string => text(key) && safeKey(key)) || !json(value.value)) return null;
    if (parsed.kind === "project" && !["meta", "system"].includes(value.path[0] ?? "")) return null;
    return { kind: value.kind, subject: parsed, path: value.path, value: value.value };
  }
  if (value.kind === "entityCount" || value.kind === "membershipPreserve") {
    const parsedCollection = collection(value.collection), parsedSelector = selector(value.selector);
    if (!parsedCollection || !parsedSelector) return null;
    const scope = { collection: parsedCollection, selector: parsedSelector };
    if (value.kind === "membershipPreserve") return { kind: value.kind, ...scope };
    return integer(value.count) && (value.comparison === "eq" || value.comparison === "gte" || value.comparison === "lte")
      && (value.basis === "current" || value.basis === "requestDelta")
      ? { kind: value.kind, ...scope, count: value.count, comparison: value.comparison, basis: value.basis } : null;
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
    case "actionCombat": return { kind: value.kind, target: parsedTarget };
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
