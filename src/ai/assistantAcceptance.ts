import type { Project, ItemRecord } from "@/project/types";
import { WIKI_COMBAT_MODES, type WikiCombatMode } from "@/project/world/types";
import type { Point } from "@/project/lint/reachability";
import { isFunctionalCriterionKind, parseFunctionalCriterion, type FunctionalCriterion } from "./functionalAcceptance";
import { VERIFICATION_TOOL_NAMES } from "./agentVerification";
import { verificationInput, parseSceneInteractionTargets } from "./toolVerificationEvidence";
import { isSceneTestInput, type SceneInteractionReceipt } from "@/testing/sceneTestRunner";
import { DB_COLLECTIONS, type DbCollection } from "@/editor/tools/queryTools";

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
  readonly refinements?: readonly AcceptanceSource[];
  readonly withdrawal?: RequirementWithdrawalAction & { readonly source: "user" };
  readonly id: string;
  readonly title: string;
  readonly status: AcceptanceStatus;
  readonly reason?: string;
  readonly issues?: readonly AcceptanceIssue[];
  readonly evidence: readonly { readonly expected: string; readonly observed: string; readonly passed: boolean; readonly issues?: readonly AcceptanceIssue[]; readonly approachCheckId?: string }[];
  readonly mapId?: string;
  readonly region?: AcceptanceRegion;
}
export interface AcceptanceRegion { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export type AcceptanceTarget = { readonly mapId: string } | { readonly newMapName: string };
type ScopedTarget = { readonly target: AcceptanceTarget; readonly region?: AcceptanceRegion };
/** Finite authored changes, not arbitrary paths or executable checks. */
export type ProjectPreservationChange =
  | { readonly kind: "projectTitle" }
  | { readonly kind: "itemName" | "itemPrice" | "itemAddition"; readonly itemId: ItemRecord["id"] }
  // DB 레코드 필드 허용 — "다른 건 건드리지 마" 를 DB 편집에도 증명 가능하게 한다.
  // 실측(2026-09-16): 허용 목록에 DB 가 없어 보존 항목을 닫을 수 없었고, 모델이 repair_acceptance
  // 를 반복하다 라운드 예산을 소진해 초안이 검토에 닿지 못했다.
  | { readonly kind: "dbRecordValues"; readonly collection: DbCollection; readonly recordId: string;
      readonly fields: Readonly<Record<string, string | number | boolean>> };
export type ProjectAcceptanceCriterion =
  | { readonly kind: "wikiDeclaration"; readonly documentId: string; readonly combatMode: WikiCombatMode; readonly sourceQuote: string }
  | { readonly kind: "projectTitle"; readonly title: Project["meta"]["title"] }
  | { readonly kind: "itemValues"; readonly itemId: ItemRecord["id"]; readonly name?: ItemRecord["name"]; readonly price?: ItemRecord["price"] }
  // DB 레코드의 저장된 필드값 — 적 stats 같은 속성 변경에는 정확한 평가자가 없어 항목을 닫을 수 없었다.
  // 실측(2026-09-16 라이브): 그 미닫힘 항목을 repair_acceptance 로 닫으려다 라운드 예산을 다 쓰고 초안이 검토에 닿지 못했다.
  | { readonly kind: "dbRecordValues"; readonly collection: DbCollection; readonly recordId: string;
      readonly fields: Readonly<Record<string, string | number | boolean>> }
  | { readonly kind: "projectPreserve"; readonly scope: "project" | "authored"; readonly allowedChanges: readonly ProjectPreservationChange[] };
export function isProjectAcceptanceKind(kind: string): boolean {
  return kind === "projectTitle" || kind === "itemValues" || kind === "projectPreserve" || kind === "wikiDeclaration" || kind === "dbRecordValues";
}
export type AcceptanceCriterion =
  | ProjectAcceptanceCriterion
  | FunctionalCriterion
  | { readonly kind: "gameTitle"; readonly title: string }
  | { readonly kind: "toolVerdict"; readonly tool: string; readonly args: Readonly<Record<string, unknown>>;
      readonly interactionTargets?: readonly SceneInteractionReceipt[] }
  | { readonly kind: "mapDimensions"; readonly target: AcceptanceTarget; readonly width: number; readonly height: number }
  | { readonly kind: "mapCount"; readonly targets: readonly AcceptanceTarget[]; readonly count: number }
  | (ScopedTarget & { readonly kind: "eventCount"; readonly count: number })
  | (ScopedTarget & { readonly kind: "targetChange" | "preserve" | "imageReviewed" })
  | { readonly kind: "actionCombat"; readonly target: AcceptanceTarget }
  | { readonly kind: "reachability"; readonly target: AcceptanceTarget; readonly from: Point; readonly to: readonly Point[] };
/** Valid native arguments with incomplete scene ownership remain fixed, pending scope. */
export function pendingCanonicalScene(criterion: AcceptanceCriterion): boolean {
  return criterion.kind === "toolVerdict" && criterion.tool === "run_scene_test" && isSceneTestInput(criterion.args)
    && parseSceneInteractionTargets(criterion.args, criterion.interactionTargets ?? []) === null;
}

export interface AcceptancePromise {
  readonly required?: boolean;
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
  toolVerdict: Object.freeze({ kind: "toolVerdict", tool: "run_lint", args: Object.freeze({}) }),
  shopPurchase: Object.freeze({ kind: "shopPurchase", target: exampleTarget, start: examplePoint,
    seller: Object.freeze({ eventId: "seller_id" }), item: Object.freeze({ id: "item_id" }), count: 1, unitPrice: 10 }),
  mapRoundTrip: Object.freeze({ kind: "mapRoundTrip", target: exampleTarget, start: examplePoint,
    destination: Object.freeze({ newMapName: "Destination" }), outgoing: Object.freeze({ eventId: "outgoing_id" }), returning: Object.freeze({ eventId: "returning_id" }) }),
  npcReward: Object.freeze({ kind: "npcReward", requirement: Object.freeze({ target: Object.freeze({ eventId: "npc_id" }),
    grants: Object.freeze([{ kind: "gold" as const, count: 20 }]), oneTime: true }) }),
  functionalUnresolved: Object.freeze({ kind: "functionalUnresolved", reason: "Identify missing request expectations" }),
  reachability: Object.freeze({ kind: "reachability", target: exampleTarget, from: examplePoint, to: Object.freeze([Object.freeze({ x: 1, y: 0 })]) }),
  gameTitle: Object.freeze({ kind: "gameTitle", title: "작은 열쇠" }),
  projectTitle: Object.freeze({ kind: "projectTitle", title: "Exact title" }),
  itemValues: Object.freeze({ kind: "itemValues", itemId: "item_id", name: "Potion", price: 37.5 }),
  dbRecordValues: Object.freeze({ kind: "dbRecordValues", collection: "enemies" as const, recordId: "enemy_id",
    fields: Object.freeze({ "stats.maxHp": 300 }) }),
  projectPreserve: Object.freeze({ kind: "projectPreserve", scope: "project", allowedChanges: Object.freeze([Object.freeze({ kind: "projectTitle" as const })]) }),
  wikiDeclaration: Object.freeze({ kind: "wikiDeclaration", documentId: "w_combat_preference", combatMode: "contact", sourceQuote: "Record my contact battle preference." }),
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
function dbFields(value: unknown): Record<string, string | number | boolean> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields: Record<string, string | number | boolean> = {};
  for (const [path, expected] of Object.entries(value as Record<string, unknown>)) {
    if (path.trim().length === 0) return null;
    if (typeof expected !== "string" && typeof expected !== "number" && typeof expected !== "boolean") return null;
    fields[path] = expected;
  }
  return Object.keys(fields).length > 0 ? fields : null;
}
function preservationChange(value: unknown): ProjectPreservationChange | null {
  if (!acceptanceRecord(value)) return null;
  if (value.kind === "projectTitle") return Object.keys(value).length === 1 ? { kind: value.kind } : null;
  if ((value.kind === "itemName" || value.kind === "itemPrice" || value.kind === "itemAddition")
    && text(value.itemId) && Object.keys(value).every(key => key === "kind" || key === "itemId")) {
    return { kind: value.kind, itemId: value.itemId };
  }
  if (value.kind === "dbRecordValues" && text(value.recordId)
    && Object.keys(value).every(key => key === "kind" || key === "collection" || key === "recordId" || key === "fields")) {
    const collection = DB_COLLECTIONS.find(entry => entry === value.collection);
    const fields = dbFields(value.fields);
    if (collection && fields) return { kind: value.kind, collection, recordId: value.recordId, fields };
  }
  return null;
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
  if (typeof value.kind === "string" && isFunctionalCriterionKind(value.kind)) return parseFunctionalCriterion(value) ?? fail("", "invalid-field", "complete functional criterion");
  // Evidence is generated only by the harness. Unknown fields fail closed.
  const keys: Record<string, readonly string[]> = {
    mapDimensions: ["kind", "target", "width", "height"], mapCount: ["kind", "targets", "count"],
    eventCount: ["kind", "target", "region", "count"], targetChange: ["kind", "target", "region"],
    preserve: ["kind", "target", "region"], imageReviewed: ["kind", "target", "region"],
    reachability: ["kind", "target", "from", "to"], toolVerdict: ["kind", "tool", "args", "interactionTargets"],
    actionCombat: ["kind", "target"], gameTitle: ["kind", "title"],
    projectTitle: ["kind", "title"], itemValues: ["kind", "itemId", "name", "price"],
    dbRecordValues: ["kind", "collection", "recordId", "fields"],
    projectPreserve: ["kind", "scope", "allowedChanges"],
    wikiDeclaration: ["kind", "documentId", "combatMode", "sourceQuote"],
  };
  const allowed = typeof value.kind === "string" && Object.hasOwn(keys, value.kind) ? keys[value.kind] : undefined;
  if (!allowed) return invalid("kind", Object.keys(ACCEPTANCE_EXAMPLES).join(" | "));
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra) return fail(extra, "unknown-field", `only ${allowed.join(", ")}`);
  if (value.kind === "wikiDeclaration") {
    if (!text(value.documentId)) return invalid("documentId", "nonempty exact declaration document ID");
    const combatMode = WIKI_COMBAT_MODES.find(mode => mode === value.combatMode);
    if (!combatMode) return invalid("combatMode", WIKI_COMBAT_MODES.join(" | "));
    if (!text(value.sourceQuote)) return invalid("sourceQuote", "nonempty unique exact quote from the original host request");
    return { kind: value.kind, documentId: value.documentId, combatMode, sourceQuote: value.sourceQuote };
  }
  if (value.kind === "projectTitle") {
    return typeof value.title === "string" ? { kind: value.kind, title: value.title }
      : invalid("title", "exact string for both meta.title and system.titleScreen.title; empty strings are allowed");
  }
  if (value.kind === "itemValues") {
    if (!text(value.itemId)) return invalid("itemId", "nonempty exact unique item ID");
    if (value.name === undefined && value.price === undefined) return invalid("name", "at least one requested item value: name or price");
    if (value.name !== undefined && typeof value.name !== "string") return invalid("name", "exact item name string");
    if (value.price !== undefined && (typeof value.price !== "number" || !Number.isFinite(value.price) || value.price < 0)) {
      return invalid("price", "finite nonnegative number; fractional prices are allowed");
    }
    return { kind: value.kind, itemId: value.itemId,
      ...(typeof value.name === "string" ? { name: value.name } : {}),
      ...(typeof value.price === "number" ? { price: value.price } : {}) };
  }
  if (value.kind === "dbRecordValues") {
    const collection = DB_COLLECTIONS.find(entry => entry === value.collection);
    if (!collection) return invalid("collection", DB_COLLECTIONS.join(" | "));
    if (!text(value.recordId)) return invalid("recordId", "nonempty exact record ID in that collection");
    const raw = value.fields;
    const fields = dbFields(raw);
    if (!fields) return invalid("fields", "object of dotted field path → exact stored value (at least one string, number or boolean)");
    return { kind: value.kind, collection, recordId: value.recordId, fields };
  }
  if (value.kind === "projectPreserve") {
    if (value.scope !== "project" && value.scope !== "authored") return invalid("scope", "project | authored");
    if (!Array.isArray(value.allowedChanges)) return invalid("allowedChanges", "array of finite allowed title/item changes; empty array is allowed");
    const changes = value.allowedChanges.map((entry, changeIndex) => preservationChange(entry)
      ?? fail(`allowedChanges[${changeIndex}]`, "invalid-field", "projectTitle with only kind, or itemName/itemPrice/itemAddition with only kind and a nonempty itemId"));
    return changes.every((change): change is ProjectPreservationChange => change !== null)
      ? { kind: value.kind, scope: value.scope, allowedChanges: changes } : null;
  }
  if (value.kind === "gameTitle") {
    return text(value.title) ? { kind: "gameTitle", title: value.title }
      : invalid("title", "nonempty literal displayed game title; exact Unicode string, not project metadata or a verdict");
  }
  if (value.kind === "toolVerdict") {
    if (!text(value.tool) || !VERIFICATION_TOOL_NAMES.has(value.tool)) return invalid("tool", "registered verification tool");
    const args = verificationInput(value.tool, value.args);
    if (!args) return invalid("args", `complete valid native ${value.tool} input, including its runtime scenario/coordinate rules`);
    if (value.tool === "run_scene_test" && isSceneTestInput(args)
      && args.steps.some(step => step.kind === "interact" && typeof step.eventId !== "string")) {
      return invalid("args", "canonical scene interact steps require explicit eventId before their ownership can be fixed");
    }
    const interactionTargets = value.interactionTargets === undefined ? undefined
      : value.tool === "run_scene_test" && isSceneTestInput(args) ? parseSceneInteractionTargets(args, value.interactionTargets, false) : null;
    if (interactionTargets === null) return invalid("interactionTargets", "ordered unique {stepIndex,mapId,eventId} entries matching declared scene interact steps");
    const parsed: AcceptanceCriterion = { kind: "toolVerdict", tool: value.tool, args, ...(interactionTargets ? { interactionTargets } : {}) };
    if (pendingCanonicalScene(parsed)) fail("interactionTargets", "pending-verification-scope",
      "repair_acceptance must fill every scene interact step's map-qualified ownership; preserve fixed arguments and already declared targets. A probe cannot supply this scope");
    return parsed;
  }
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
    const validRequired = entry.required === undefined || typeof entry.required === "boolean";
    const parsed = parseAcceptanceCriteriaResult(validRequired ? entry.criteria : undefined);
    promises.push({ id: entry.id, title: entry.title, required: parsed.criteria === null || parsed.criteria.some(pendingCanonicalScene) || entry.required !== false, criteria: parsed.criteria, ...(parsed.issues.length ? { issues: parsed.issues } : {}) });
  }
  if (needsRepair) {
    let id = "acceptance-contract";
    for (let suffix = 1; ids.has(id); suffix += 1) id = `acceptance-contract-${suffix}`;
    promises.push({ id, title: "Acceptance contract repair", criteria: null, issues: Object.freeze([Object.freeze({ field: "acceptance", code: "invalid-promise", expected: "array of promises with unique nonempty id, title, and complete criteria", example: ACCEPTANCE_EXAMPLES.mapCount })]) });
  }
  return promises;
}
