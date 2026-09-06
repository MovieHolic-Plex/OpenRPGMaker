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
export const ACCEPTANCE_CRITERIA_SCHEMA = { type: "array", minItems: 1, items: {
  type: "object", required: ["kind"], additionalProperties: false,
  description: `Use only the fields for the chosen kind. Canonical scoped shapes: ${JSON.stringify(ACCEPTANCE_EXAMPLES)}`,
  properties: {
    kind: { type: "string", enum: Object.keys(ACCEPTANCE_EXAMPLES) },
    target: { ...target, description: `Required for every kind EXCEPT mapCount. ${target.description}` },
    targets: { type: "array", minItems: 1, items: target, description: `REQUIRED for mapCount (along with count); omit target. Canonical: ${JSON.stringify(ACCEPTANCE_EXAMPLES.mapCount)}` },
    width: { type: "integer", minimum: 1, description: "Required for mapDimensions." },
    height: { type: "integer", minimum: 1, description: "Required for mapDimensions." },
    count,
    region: { ...region, description: "Optional scope only for eventCount, targetChange, preserve, imageReviewed." },
    from: { ...point, description: "Required for reachability: exact walkable origin cell." },
    to: { type: "array", minItems: 1, items: point, description: "Required for reachability: exact walkable destination cells, NOT solid NPC/sign/chest cells. Author approach-cell coordinates for interactions. Unlike check_reachability, adjacency is not success." },
  },
} };
export const ACCEPTANCE_SCHEMA = { type: "array", minItems: 1, items: {
  type: "object", properties: { id: { type: "string" }, title: { type: "string" }, criteria: ACCEPTANCE_CRITERIA_SCHEMA }, required: ["id", "title", "criteria"], additionalProperties: false,
} };
export const ACCEPTANCE_TOOLS: readonly OpenAiToolSchema[] = [
  { type: "function", function: { name: "repair_acceptance", description: "Fill a missing/malformed acceptance item's criteria. Valid original promises and their baselines cannot be replaced or weakened. Return values include the authoritative ledger.", parameters: { type: "object", properties: { itemId: { type: "string" }, criteria: ACCEPTANCE_CRITERIA_SCHEMA }, required: ["itemId", "criteria"], additionalProperties: false } } },
  { type: "function", function: { name: "review_acceptance", description: "Record an explicit pass/fail verdict and observations for delivered show_map_region images in a subsequent model response. All promised coverage must be current and delivered. A fail withdraws any previous pass. Coverage or a note alone is not a passing review. Never send fingerprints/evidence IDs.", parameters: { type: "object", properties: { itemId: { type: "string" }, verdict: { type: "string", enum: ["pass", "fail"] }, note: { type: "string" } }, required: ["itemId", "verdict", "note"], additionalProperties: false } } },
];
export const ACCEPTANCE_PLANNER_GUIDE = `
World-map acceptance is a separate immutable goal contract, NOT the replaceable WorkPlan.
For map/event spatial deliverables author top-level acceptance:[{id,title,criteria:[...]}]. Every requested promise, exact size/count, target change, preservation constraint and image review must be represented. Do not invent genre quotas. Nonspatial/read-only requests omit acceptance.
Criteria schema: ${JSON.stringify(ACCEPTANCE_CRITERIA_SCHEMA)}
Use actual mapId for existing maps; newMapName is an exact authored name and binds only a unique newly created map. Counts are EXACT and scoped to the listed targets/region, never project totals. Preserve without region includes metadata; with region compares tiles/stacks/events. targetChange compares original baseline, never the latest plan. Reachability tests exact walkable cells with conservative static tile/event passage, not adjacency to interaction targets or a runtime playthrough. Use approach-cell coordinates for NPC/sign/chest interactions; do not move solid game objects to satisfy this check. Whole-map image review requires actual delivered coverage (show_map_region clips to 24x24, so tile larger maps) then review_acceptance({itemId,verdict:"pass"|"fail",note}) in a subsequent response. Report defects with verdict:"fail"; it revokes a previous pass. No model-provided evidence IDs/fingerprints. Missing/malformed arrays fail closed and require repair_acceptance; replan/complete/skip cannot remove accepted promises.
`;
