import type { OpenAiToolSchema } from "./llmClient";
import { ACCEPTANCE_EXAMPLES } from "./assistantAcceptance";
// Provider normalization flattens unions and drops branch-required fields. Expose
// the field superset directly, with canonical kind-specific shapes on the wire.
const target = { type: "object", properties: {
  mapId: { type: "string", description: "Existing map ID. Supply exactly one selector, never both." },
  newMapName: { type: "string", description: "Exact name of a uniquely new map, bound once. Omit mapId." },
}, description: 'Exactly one nonempty selector: {"mapId":"map_id"} OR {"newMapName":"New map"}. No other fields.', additionalProperties: false };
const point = { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"] };
const region = { type: "object", properties: { ...point.properties, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } }, required: ["x", "y", "w", "h"] };
const count = { type: "integer", minimum: 0, description: "Required for mapCount and eventCount. EXACT count in the explicit scope only." };
const eventTarget = { type: "object", properties: { eventId: { type: "string" }, eventName: { type: "string" } }, additionalProperties: false };
const itemTarget = { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, additionalProperties: false };
const npcReward = { type: "object", properties: {
  target: { type: "object", properties: { ...eventTarget.properties, mapId: { type: "string" } }, additionalProperties: false },
  grants: { type: "array", minItems: 1, items: { type: "object", properties: { ...itemTarget.properties,
    kind: { type: "string", enum: ["item", "monster", "gold"] }, count: { type: "integer", minimum: 1 } }, required: ["kind"], additionalProperties: false } },
  oneTime: { type: "boolean" }, choices: { type: "array", items: count }, repeatChoices: { type: "array", items: count },
}, required: ["target", "grants"], additionalProperties: false };
export const ACCEPTANCE_CRITERIA_SCHEMA = { type: "array", minItems: 1, items: {
  type: "object", required: ["kind"], additionalProperties: false,
  description: `Use only the fields for the chosen kind. Canonical scoped shapes: ${JSON.stringify(ACCEPTANCE_EXAMPLES)}`,
  properties: {
    kind: { type: "string", enum: Object.keys(ACCEPTANCE_EXAMPLES) },
    title: { type: "string", minLength: 1, pattern: "\\S", description: "Required only for gameTitle: exact literal Unicode title displayed by the title screen. Uses title-screen settings (or their runtime default), not meta.title. Graphic-only logos cannot prove literal text. No trimming or Unicode normalization of the expected title." },
    tool: { type: "string" },
    args: { type: "object", additionalProperties: true, description: "Full exact valid native verification-tool input; {} is valid only for tools with no required arguments. Scene interact steps require explicit eventId. Not evidence or a verdict." },
    interactionTargets: { type: "array", description: "For toolVerdict/run_scene_test, declare every interact step's map-qualified ownership before execution. Missing entries remain pending; repair_acceptance can fill only missing ownership, never change fixed args or known targets.",
      items: { type: "object", properties: { stepIndex: { type: "integer", minimum: 0 }, mapId: { type: "string" }, eventId: { type: "string" } },
        required: ["stepIndex", "mapId", "eventId"], additionalProperties: false } },
    target: { ...target, description: `Required for mapDimensions/eventCount/targetChange/preserve/imageReviewed/reachability/actionCombat/shopPurchase/mapRoundTrip. ${target.description}` },
    targets: { type: "array", minItems: 1, items: target, description: `REQUIRED for mapCount (along with count); omit target. Canonical: ${JSON.stringify(ACCEPTANCE_EXAMPLES.mapCount)}` },
    width: { type: "integer", minimum: 1, description: "Required for mapDimensions." },
    height: { type: "integer", minimum: 1, description: "Required for mapDimensions." },
    count,
    region: { ...region, description: "Optional scope only for eventCount, targetChange, preserve, imageReviewed." },
    from: { ...point, description: "Required for reachability: exact walkable origin cell." },
    to: { type: "array", minItems: 1, items: point, description: "Required for reachability: exact walkable destination cells, NOT solid NPC/sign/chest cells. Author approach-cell coordinates for interactions. Unlike check_reachability, adjacency is not success." },
    start: point, seller: eventTarget, item: itemTarget, unitPrice: count,
    destination: target, outgoing: eventTarget, returning: eventTarget,
    requirement: npcReward, reason: { type: "string" },
    expectations: { type: "object", description: "Known fields of a functionalUnresolved request. Missing fields remain unresolved; only a later genuine user clarification can refine them.",
      properties: { kind: { type: "string", enum: ["shopPurchase", "mapRoundTrip", "npcReward"] }, target, start: point,
        seller: eventTarget, item: itemTarget, count, unitPrice: count, destination: target, outgoing: eventTarget, returning: eventTarget, requirement: npcReward },
      required: ["kind"], additionalProperties: false },
  },
} };
export const ACCEPTANCE_SCHEMA = { type: "array", minItems: 1, items: {
  type: "object", properties: { id: { type: "string" }, title: { type: "string" }, required: { type: "boolean", default: true }, criteria: ACCEPTANCE_CRITERIA_SCHEMA }, required: ["id", "title", "criteria"], additionalProperties: false,
} };
export const ACCEPTANCE_TOOLS: readonly OpenAiToolSchema[] = [
  { type: "function", function: { name: "repair_acceptance", description: "Fill missing/malformed criteria or complete a canonical scene's missing interactionTargets. Fixed valid args, known targets, sibling criteria, owners and baselines cannot be replaced; fresh execution is required after resolution. Return values include the authoritative ledger.", parameters: { type: "object", properties: { itemId: { type: "string" }, criteria: ACCEPTANCE_CRITERIA_SCHEMA }, required: ["itemId", "criteria"], additionalProperties: false } } },
  { type: "function", function: { name: "review_acceptance", description: "Record an explicit pass/fail verdict and observations for delivered show_map_region images in a subsequent model response. All promised coverage must be current and delivered. A fail withdraws any previous pass. Coverage or a note alone is not a passing review. Never send fingerprints/evidence IDs.", parameters: { type: "object", properties: { itemId: { type: "string" }, verdict: { type: "string", enum: ["pass", "fail"] }, note: { type: "string" } }, required: ["itemId", "verdict", "note"], additionalProperties: false } } },
];
export const ACCEPTANCE_PLANNER_GUIDE = `
Requirements are a separate immutable goal contract, NOT the replaceable WorkPlan. Author requirements:[{id,title,required?,criteria}] and item requirementIds; required defaults to true. Optional work is excluded from the required denominator but is never verified by skipping. The legacy acceptance field remains supported. toolVerdict uses a registered verification tool and its FULL exact args; only a current explicit tool response counts, not a tool name, advisory check, or model-provided evidence. Source and withdrawal belong exclusively to host user actions. Skip, replan, source claims and resetsContext cannot withdraw requirements.
A toolVerdict scene also needs interactionTargets:[{stepIndex,mapId,eventId}] for every explicit interact step. Native args are validated before acceptance. Valid args with missing ownership remain pending and immutable except for filling missing ownership through repair_acceptance; host initial state is captured before any probe. Neither first-pass results nor a same-ID NPC on another map can declare or replace ownership. Malformed tool args remain mandatory repair obligations, including optional declarations. Never send initialState or host proof metadata.
For map/event spatial deliverables author top-level acceptance:[{id,title,criteria:[...]}]. Every requested promise, exact size/count, target change, preservation constraint and image review must be represented. Do not invent genre quotas. Read-only requests omit acceptance. A requested literal displayed game title uses {kind:"gameTitle",title:"<exact requested title>"}; set_title_screen authors it. This criterion checks the effective title-screen text including its settings fallback, not meta.title, tool success, counts or image-review claims; graphic-only logos do not prove literal text. It is rechecked on canonical reload.
Requested working purchases require shopPurchase (exact seller, stock, count, unitPrice, actual project start). Requested round-trip travel requires mapRoundTrip (actual origin/start, distinct destination, both exact authored transfers). Requested NPC rewards require npcReward with original grants/oneTime. These run the real interpreter and production transaction rules on applied/latest content; paired events, shop opening, tool success and images do not prove them. The live intent captures mandatory obligations independently of your plan; never replace them with static checks. Only represent requested behaviors. Missing/ambiguous/unsupported targets stay functionalUnresolved with actionable diagnostics and typed known expectations, never omitted or weakened. A later genuine user declaration can refine that exact placeholder with original request context; worker repair and set_work_plan cannot perform this host action or replace concrete contracts. The current traversal harness starts at the actual project entry and supports action/touch events; it cannot fabricate prerequisites, teleport into an interior shop, or prove shopkeeper/haggle/service modes. Do not author arbitrary executable verification scripts.
Criteria schema: ${JSON.stringify(ACCEPTANCE_CRITERIA_SCHEMA)}
A declared imageReviewed crop cannot exclude tiles or event positions this request changed. The effective required region is reported in evidence.expected; new/resized maps require the full map. Unchanged local inspections can remain local. Do not narrow the crop to bypass review.
Requested field-action combat requires actionCombat criteria for every target and run_action_combat_test. Wait/spawn scene tests, static checks, turn-based simulations and model-authored evidence never prove field-action behavior. Intent-owned action obligations survive replanning and repair. Ordinary guide NPCs may use one page unless stateful behavior or a multipage volume obligation was explicitly declared.
Use actual mapId for existing maps; newMapName is an exact authored name and binds only a unique newly created map. Counts are EXACT and scoped to the listed targets/region, never project totals. Preserve without region includes metadata; with region compares tiles/stacks/events. targetChange compares original baseline, never the latest plan; with explicit newMapName it also accepts creation of the uniquely bound applied map from original absence. preserve requires original content, never a newly created target. A missing original mapId for preserve/targetChange requires repair: use an existing baseline mapId, or newMapName for creation. Reachability tests exact walkable cells with conservative static tile/event passage, not adjacency to interaction targets or a runtime playthrough. Use approach-cell coordinates for NPC/sign/chest interactions; do not move solid game objects to satisfy this check. Whole-map image review requires actual delivered coverage (request show_map_region with x:0,y:0,w:map width,h:map height -- complete coverage is not clipped and arrives as one render) then review_acceptance({itemId,verdict:"pass"|"fail",note}) in a subsequent response. Report defects with verdict:"fail"; it revokes a previous pass. No model-provided evidence IDs/fingerprints. Missing/malformed arrays fail closed and require repair_acceptance; replan/complete/skip cannot remove accepted promises.
`;
