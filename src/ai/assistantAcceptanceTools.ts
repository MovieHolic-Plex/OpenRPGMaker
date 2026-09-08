import type { OpenAiToolSchema } from "./llmClient";
const target = {
  type: "object", description: "Exactly one nonempty mapId (existing map) or newMapName (unique newly authored map); never both.",
  properties: { mapId: { type: "string" }, newMapName: { type: "string" } }, additionalProperties: false,
};
const point = { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"] };
const region = { type: "object", properties: { ...point.properties, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } }, required: ["x", "y", "w", "h"] };
const count = { type: "integer", minimum: 0 };
const eventTarget = { type: "object", properties: { eventId: { type: "string" }, eventName: { type: "string" } }, additionalProperties: false };
const itemTarget = { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, additionalProperties: false };
const npcReward = { type: "object", properties: {
  target: { type: "object", properties: { ...eventTarget.properties, mapId: { type: "string" } }, additionalProperties: false },
  grants: { type: "array", minItems: 1, items: { type: "object", properties: { ...itemTarget.properties,
    kind: { type: "string", enum: ["item", "monster"] }, count: { type: "integer", minimum: 1 } }, required: ["kind"], additionalProperties: false } },
  oneTime: { type: "boolean" }, choices: { type: "array", items: count }, repeatChoices: { type: "array", items: count },
}, required: ["target", "grants"], additionalProperties: false };
// Strict providers cannot expose unions. parseAcceptanceCriteria enforces each kind's
// required/allowed keys and exclusive target shape; only the provider shape is flattened.
export const ACCEPTANCE_CRITERIA_SCHEMA = { type: "array", minItems: 1, items: {
  type: "object",
  description: "Send only fields for the chosen kind. Required: toolVerdict: tool,args; mapDimensions: target,width,height; mapCount: targets,count; eventCount: target,count; targetChange/preserve/imageReviewed/actionCombat: target; reachability: target,from,to. Optional region only for eventCount/targetChange/preserve/imageReviewed. Functional kinds: shopPurchase: target,start,seller,item,count,unitPrice; mapRoundTrip: target,start,destination,outgoing,returning; npcReward: requirement; functionalUnresolved: reason, optional expectations containing known functional fields. Missing or mixed-kind fields fail closed.",
  properties: {
    kind: { type: "string", enum: ["toolVerdict", "mapDimensions", "mapCount", "eventCount", "targetChange", "preserve", "imageReviewed", "reachability", "actionCombat", "shopPurchase", "mapRoundTrip", "npcReward", "functionalUnresolved"] },
    tool: { type: "string" },
    args: { type: "object", additionalProperties: true, description: "Full exact verification-tool arguments, with original keys and nested JSON values; use {} for no arguments. Not evidence or a verdict." },
    target, targets: { type: "array", minItems: 1, items: target },
    width: { type: "integer", minimum: 1 }, height: { type: "integer", minimum: 1 },
    count, region, from: point, to: { type: "array", minItems: 1, items: point },
    start: point, seller: eventTarget, item: itemTarget, unitPrice: count,
    destination: target, outgoing: eventTarget, returning: eventTarget,
    requirement: npcReward, reason: { type: "string" },
    expectations: { type: "object", description: "Known fields of a functionalUnresolved request. Missing fields remain unresolved; only a later genuine user clarification can refine them.",
      properties: { kind: { type: "string", enum: ["shopPurchase", "mapRoundTrip", "npcReward"] }, target, start: point,
        seller: eventTarget, item: itemTarget, count, unitPrice: count, destination: target, outgoing: eventTarget, returning: eventTarget, requirement: npcReward },
      required: ["kind"], additionalProperties: false },
  },
  required: ["kind"], additionalProperties: false,
} };
export const ACCEPTANCE_SCHEMA = { type: "array", minItems: 1, items: {
  type: "object", properties: { id: { type: "string" }, title: { type: "string" }, required: { type: "boolean", default: true }, criteria: ACCEPTANCE_CRITERIA_SCHEMA }, required: ["id", "title", "criteria"], additionalProperties: false,
} };
export const ACCEPTANCE_TOOLS: readonly OpenAiToolSchema[] = [
  { type: "function", function: { name: "repair_acceptance", description: "Fill a missing/malformed acceptance item's criteria. Valid original promises and their baselines cannot be replaced or weakened. Return values include the authoritative ledger.", parameters: { type: "object", properties: { itemId: { type: "string" }, criteria: ACCEPTANCE_CRITERIA_SCHEMA }, required: ["itemId", "criteria"], additionalProperties: false } } },
  { type: "function", function: { name: "review_acceptance", description: "Record an explicit pass/fail verdict and observations for delivered show_map_region images in a subsequent model response. All promised coverage must be current and delivered. A fail withdraws any previous pass. Coverage or a note alone is not a passing review. Never send fingerprints/evidence IDs.", parameters: { type: "object", properties: { itemId: { type: "string" }, verdict: { type: "string", enum: ["pass", "fail"] }, note: { type: "string" } }, required: ["itemId", "verdict", "note"], additionalProperties: false } } },
];
export const ACCEPTANCE_PLANNER_GUIDE = `
Requirements are a separate immutable goal contract, NOT the replaceable WorkPlan. Author requirements:[{id,title,required?,criteria}] and item requirementIds; required defaults to true. Optional work is excluded from the required denominator but is never verified by skipping. The legacy acceptance field remains supported. toolVerdict uses a registered verification tool and its FULL exact args; only a current explicit tool response counts, not a tool name, advisory check, or model-provided evidence. Source and withdrawal belong exclusively to host user actions. Skip, replan, source claims and resetsContext cannot withdraw requirements.
For map/event spatial deliverables author top-level acceptance:[{id,title,criteria:[...]}]. Every requested promise, exact size/count, target change, preservation constraint and image review must be represented. Do not invent genre quotas. Nonspatial/read-only requests omit acceptance.
Requested working purchases require shopPurchase (exact seller, stock, count, unitPrice, actual project start). Requested round-trip travel requires mapRoundTrip (actual origin/start, distinct destination, both exact authored transfers). Requested NPC rewards require npcReward with original grants/oneTime. These run the real interpreter and production transaction rules on applied/latest content; paired events, shop opening, tool success and images do not prove them. The live intent captures mandatory obligations independently of your plan; never replace them with static checks. Only represent requested behaviors. Missing/ambiguous/unsupported targets stay functionalUnresolved with actionable diagnostics and typed known expectations, never omitted or weakened. A later genuine user declaration can refine that exact placeholder with original request context; worker repair and set_work_plan cannot perform this host action or replace concrete contracts. The current traversal harness starts at the actual project entry and supports action/touch events; it cannot fabricate prerequisites, teleport into an interior shop, or prove shopkeeper/haggle/service modes. Do not author arbitrary executable verification scripts.
Criteria schema: ${JSON.stringify(ACCEPTANCE_CRITERIA_SCHEMA)}
A declared imageReviewed crop cannot exclude tiles or event positions this request changed. The effective required region is reported in evidence.expected; new/resized maps require the full map. Unchanged local inspections can remain local. Do not narrow the crop to bypass review.
Requested field-action combat requires actionCombat criteria for every target and run_action_combat_test. Wait/spawn scene tests, static checks, turn-based simulations and model-authored evidence never prove field-action behavior. Intent-owned action obligations survive replanning and repair. Ordinary guide NPCs may use one page unless stateful behavior or a multipage volume obligation was explicitly declared.
Use actual mapId for existing maps; newMapName is an exact authored name and binds only a unique newly created map. Counts are EXACT and scoped to the listed targets/region, never project totals. Preserve without region includes metadata; with region compares tiles/stacks/events. targetChange compares original baseline, never the latest plan. Reachability is conservative static tile/event passage, not a runtime playthrough. Whole-map image review requires actual delivered coverage (request show_map_region with x:0,y:0,w:map width,h:map height -- complete coverage is not clipped and arrives as one render) then review_acceptance({itemId,verdict:"pass"|"fail",note}) in a subsequent response. Report defects with verdict:"fail"; it revokes a previous pass. No model-provided evidence IDs/fingerprints. Missing/malformed arrays fail closed and require repair_acceptance; replan/complete/skip cannot remove accepted promises.
`;
