import { ACCEPTANCE_DATABASE_COLLECTIONS } from "./assistantAcceptance";
import type { OpenAiToolSchema } from "./llmClient";
const target = {
  type: "object", description: "Exactly one nonempty mapId (existing map) or newMapName (unique newly authored map); never both.",
  properties: { mapId: { type: "string" }, newMapName: { type: "string" } }, additionalProperties: false,
};
const point = { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"] };
const region = { type: "object", properties: { ...point.properties, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } }, required: ["x", "y", "w", "h"] };
const count = { type: "integer", minimum: 0 };
const databaseCollection = { type: "string", enum: ACCEPTANCE_DATABASE_COLLECTIONS };
const category = { type: "string", enum: ["sprites", "uploaded"] };
const subject = { type: "object", properties: {
  kind: { type: "string", enum: ["project", "database", "event", "asset"] },
  collection: databaseCollection, id: { type: "string" }, mapId: { type: "string" }, eventId: { type: "string" }, category,
}, required: ["kind"], additionalProperties: false,
  description: "Exact fields by kind: project: kind; database: kind,collection,id; event: kind,mapId,eventId; asset: kind,category,id. Own authored identities only." };
const collection = { type: "object", properties: {
  kind: { type: "string", enum: ["database", "events", "assets"] }, collection: databaseCollection, mapId: { type: "string" }, category,
}, required: ["kind"], additionalProperties: false,
  description: "Exact fields by kind: database: kind,collection; events: kind,mapId; assets: kind,category." };
const identities = { type: "array", minItems: 1, uniqueItems: true, items: { type: "string" } };
const selector = { type: "object", properties: { ids: identities, names: identities, all: { type: "boolean", enum: [true] } },
  additionalProperties: false, description: "Exactly one of ids, names, or all:true. Names must resolve unambiguously; no executable predicates." };
// Strict providers cannot expose unions. parseAcceptanceCriteria enforces each kind's
// required/allowed keys and exclusive target shape; only the provider shape is flattened.
export const ACCEPTANCE_CRITERIA_SCHEMA = { type: "array", minItems: 1, items: {
  type: "object",
  description: "Send only fields for the chosen kind. Required: toolVerdict: tool,args; mapDimensions: target,width,height; mapCount: targets,count; eventCount: target,count; targetChange/preserve/imageReviewed/actionCombat: target; reachability: target,from,to. Optional region only for eventCount/targetChange/preserve/imageReviewed. Required authored fields: valueEquals: subject,path,value; entityPreserve: subject (optional path); membershipPreserve: collection,selector; entityCount: collection,selector,comparison,count,basis. Missing or mixed-kind fields fail closed.",
  properties: {
    kind: { type: "string", enum: ["toolVerdict", "mapDimensions", "mapCount", "eventCount", "targetChange", "preserve", "imageReviewed", "reachability", "actionCombat", "valueEquals", "entityPreserve", "membershipPreserve", "entityCount"] },
    subject, collection, selector, path: { type: "array", items: { type: "string" } },
    value: { description: "Exact JSON value, including null, boolean, number, string, array or object. Runtime paths exclude transport blobs and prototype keys." },
    comparison: { type: "string", enum: ["eq", "gte", "lte"] }, basis: { type: "string", enum: ["current", "requestDelta"] },
    tool: { type: "string" },
    args: { type: "object", additionalProperties: true, description: "Full exact verification-tool arguments, with original keys and nested JSON values; use {} for no arguments. Not evidence or a verdict." },
    target, targets: { type: "array", minItems: 1, items: target },
    width: { type: "integer", minimum: 1 }, height: { type: "integer", minimum: 1 },
    count, region, from: point, to: { type: "array", minItems: 1, items: point },
  },
  required: ["kind"], additionalProperties: false,
} };
export const ACCEPTANCE_SCHEMA = { type: "array", minItems: 1, items: {
  type: "object", properties: { id: { type: "string" }, title: { type: "string" }, required: { type: "boolean", default: true }, criteria: ACCEPTANCE_CRITERIA_SCHEMA }, required: ["id", "title", "criteria"], additionalProperties: false,
} };
/** Dormant until the session dispatcher adopts the source ledger API. */
export const REQUEST_CONTRACT_TOOL: OpenAiToolSchema = {
  type: "function", function: { name: "get_request_contract", description: "Read exact raw request coverage. Omit requestId to list request identities; offsets page UTF-16 text without summarizing.",
    parameters: { type: "object", properties: { requestId: { type: "string" }, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 8192 } }, additionalProperties: false } },
};
export const ACCEPTANCE_TOOLS: readonly OpenAiToolSchema[] = [
  { type: "function", function: { name: "repair_acceptance", description: "Fill a missing/malformed acceptance item's criteria. Valid original promises and their baselines cannot be replaced or weakened. Return values include the authoritative ledger.", parameters: { type: "object", properties: { itemId: { type: "string" }, criteria: ACCEPTANCE_CRITERIA_SCHEMA }, required: ["itemId", "criteria"], additionalProperties: false } } },
  { type: "function", function: { name: "review_acceptance", description: "Record an explicit pass/fail verdict and observations for delivered show_map_region images in a subsequent model response. All promised coverage must be current and delivered. A fail withdraws any previous pass. Coverage or a note alone is not a passing review. Never send fingerprints/evidence IDs.", parameters: { type: "object", properties: { itemId: { type: "string" }, verdict: { type: "string", enum: ["pass", "fail"] }, note: { type: "string" } }, required: ["itemId", "verdict", "note"], additionalProperties: false } } },
];
export const ACCEPTANCE_PLANNER_GUIDE = `
Requirements are a separate immutable goal contract, NOT the replaceable WorkPlan. Author requirements:[{id,title,required?,criteria}] and item requirementIds; required defaults to true. Optional work is excluded from the required denominator but is never verified by skipping. The legacy acceptance field remains supported. toolVerdict uses a registered verification tool and its FULL exact args; only a current explicit tool response counts, not a tool name, advisory check, or model-provided evidence. Source and withdrawal belong exclusively to host user actions. Skip, replan, source claims and resetsContext cannot withdraw requirements.
For map/event spatial deliverables author top-level acceptance:[{id,title,criteria:[...]}]. Every requested promise, exact size/count, target change, preservation constraint and image review must be represented. Do not invent genre quotas. For authored nonspatial facts use valueEquals/entityPreserve/membershipPreserve/entityCount. Read-only requests need no authored predicates. Raw request coverage remains required independently of supplemental planner optionality.
Criteria schema: ${JSON.stringify(ACCEPTANCE_CRITERIA_SCHEMA)}
A declared imageReviewed crop cannot exclude tiles or event positions this request changed. The effective required region is reported in evidence.expected; new/resized maps require the full map. Unchanged local inspections can remain local. Do not narrow the crop to bypass review.
Requested field-action combat requires actionCombat criteria for every target and run_action_combat_test. Wait/spawn scene tests, static checks, turn-based simulations and model-authored evidence never prove field-action behavior. Intent-owned action obligations survive replanning and repair. Ordinary guide NPCs may use one page unless stateful behavior or a multipage volume obligation was explicitly declared.
Use actual mapId for existing maps; newMapName is an exact authored name and binds only a unique newly created map. Counts are EXACT and scoped to the listed targets/region, never project totals. Preserve without region includes metadata; with region compares tiles/stacks/events. targetChange compares original baseline, never the latest plan. Reachability is conservative static tile/event passage, not a runtime playthrough. Whole-map image review requires actual delivered coverage (show_map_region clips to 24x24, so tile larger maps) then review_acceptance({itemId,verdict:"pass"|"fail",note}) in a subsequent response. Report defects with verdict:"fail"; it revokes a previous pass. No model-provided evidence IDs/fingerprints. Missing/malformed arrays fail closed and require repair_acceptance; replan/complete/skip cannot remove accepted promises.
`;
