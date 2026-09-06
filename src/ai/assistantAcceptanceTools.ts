import type { OpenAiToolSchema } from "./llmClient";
const target = { oneOf: [
  { type: "object", properties: { mapId: { type: "string" } }, required: ["mapId"], additionalProperties: false },
  { type: "object", properties: { newMapName: { type: "string" } }, required: ["newMapName"], additionalProperties: false },
] };
const point = { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"] };
const region = { type: "object", properties: { ...point.properties, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } }, required: ["x", "y", "w", "h"] };
const count = { type: "integer", minimum: 0 };
export const ACCEPTANCE_CRITERIA_SCHEMA = { type: "array", minItems: 1, items: { oneOf: [
  { type: "object", properties: { kind: { const: "mapDimensions" }, target, width: { type: "integer", minimum: 1 }, height: { type: "integer", minimum: 1 } }, required: ["kind", "target", "width", "height"], additionalProperties: false },
  { type: "object", properties: { kind: { const: "mapCount" }, targets: { type: "array", minItems: 1, items: target }, count }, required: ["kind", "targets", "count"], additionalProperties: false },
  { type: "object", properties: { kind: { const: "eventCount" }, target, region, count }, required: ["kind", "target", "count"], additionalProperties: false },
  { type: "object", properties: { kind: { enum: ["targetChange", "preserve", "imageReviewed"] }, target, region }, required: ["kind", "target"], additionalProperties: false },
  { type: "object", properties: { kind: { const: "reachability" }, target, from: point, to: { type: "array", minItems: 1, items: point } }, required: ["kind", "target", "from", "to"], additionalProperties: false },
] } };
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
A declared imageReviewed crop cannot exclude tiles or event positions this request changed. The effective required region is reported in evidence.expected; new/resized maps require the full map. Unchanged local inspections can remain local. Do not narrow the crop to bypass review.
Use actual mapId for existing maps; newMapName is an exact authored name and binds only a unique newly created map. Counts are EXACT and scoped to the listed targets/region, never project totals. Preserve without region includes metadata; with region compares tiles/stacks/events. targetChange compares original baseline, never the latest plan. Reachability is conservative static tile/event passage, not a runtime playthrough. Whole-map image review requires actual delivered coverage (show_map_region clips to 24x24, so tile larger maps) then review_acceptance({itemId,verdict:"pass"|"fail",note}) in a subsequent response. Report defects with verdict:"fail"; it revokes a previous pass. No model-provided evidence IDs/fingerprints. Missing/malformed arrays fail closed and require repair_acceptance; replan/complete/skip cannot remove accepted promises.
`;
