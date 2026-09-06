import assert from "node:assert/strict";
import { WORK_PLAN_TOOLS } from "../../../../../src/ai/assistantSession";
import { ACCEPTANCE_CRITERIA_SCHEMA, ACCEPTANCE_TOOLS } from "../../../../../src/ai/assistantAcceptanceTools";
import { acceptanceRecord, parseAcceptanceCriteria } from "../../../../../src/ai/assistantAcceptance";
import { workPlanFromSetToolArgs } from "../../../../../src/ai/workPlan";
import { AssistantAcceptanceLedger } from "../../../../../src/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence } from "../../../../../src/ai/toolVerificationEvidence";
import { createBlankProject } from "../../../../../src/project/defaults";
import { runTool } from "../../../../../src/editor/tools";

function record(value: unknown): Record<string, unknown> {
  assert.ok(acceptanceRecord(value));
  return value;
}
const setPlan = WORK_PLAN_TOOLS.find(tool => tool.function.name === "set_work_plan");
const repair = ACCEPTANCE_TOOLS.find(tool => tool.function.name === "repair_acceptance");
assert.ok(setPlan && repair);
const properties = record(record(setPlan.function.parameters).properties);
for (const field of ["acceptance", "requirements"]) {
  assert.equal(record(record(record(properties[field]).items).properties).criteria, ACCEPTANCE_CRITERIA_SCHEMA);
}
assert.equal(record(record(repair.function.parameters).properties).criteria, ACCEPTANCE_CRITERIA_SCHEMA);
assert.equal(ACCEPTANCE_CRITERIA_SCHEMA.items.properties.args.additionalProperties, true);
assert.equal(ACCEPTANCE_CRITERIA_SCHEMA.items.type, "object");
assert.equal(JSON.stringify(setPlan).includes('"oneOf"'), false);
assert.equal(JSON.stringify(setPlan).includes('"anyOf"'), false);

const project = createBlankProject();
const args = { mapId: project.startMapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] };
const criteria = [{ kind: "toolVerdict", tool: "check_reachability", args }];
const wire = JSON.stringify({ goal: "Exact route", requirements: [{ id: "route", title: "Route", criteria }],
  layers: [{ title: "Verify", items: [{ title: "Route", instruction: "Check the exact route", requirementIds: ["route"] }] }] });
const parsedWire: unknown = JSON.parse(wire);
const plan = workPlanFromSetToolArgs(record(parsedWire));
assert.ok(plan?.requirements);
assert.deepEqual(plan.requirements, [{ id: "route", title: "Route", required: true, criteria }]);
assert.deepEqual(parseAcceptanceCriteria(JSON.parse(JSON.stringify(criteria))), criteria);
assert.equal(parseAcceptanceCriteria([{ ...criteria[0], passed: true }]), null);
assert.equal(parseAcceptanceCriteria([{ kind: "preserve", target: { mapId: project.startMapId, newMapName: "Ambiguous" } }]), null);

const ledger = new AssistantAcceptanceLedger("schema-probe", "Exact route", project);
ledger.adopt(plan.requirements);
const evidence = new ToolVerificationEvidence();
assert.notEqual(ledger.evaluate(project, project, evidence).status, "verified");
const result = runTool({ project }, "check_reachability", args);
assert.equal(result.ok, true);
assert.equal(record(result.data).reachable, true);
evidence.observe("check_reachability", args, result);
assert.equal(ledger.evaluate(project, project, evidence).status, "verified");
assert.equal(evidence.passedScope("check_reachability", { ...args, targets: [{ x: 2, y: 0 }] }), false);
evidence.invalidateAfterWrite();
assert.notEqual(ledger.evaluate(project, project, evidence).status, "verified");
console.log(JSON.stringify({ publicSurfaces: ["set_work_plan.acceptance", "set_work_plan.requirements", "repair_acceptance.criteria"],
  roundtrip: "exact nested args preserved", actualTool: "check_reachability", result: "pass",
  authority: "only fresh exact real tool evidence verifies; changed args and stale evidence do not", remoteWrites: 0 }, null, 2));
