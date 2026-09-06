import assert from "node:assert/strict";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

const outcomes = [];
for (const name of ["run_village_pipeline", "build_village"]) {
  const ctx = { project: createBlankProject() };
  const original = ctx.project;
  const before = structuredClone(original);
  const result = runTool(ctx, name, {});
  assert.equal(result.ok, false);
  assert.equal(result.issues?.[0]?.code, "protected-house-write");
  assert.doesNotMatch(result.summary, /Cannot read propert|undefined is not|is not a function|후처리 실패/);
  assert.equal(ctx.project, original);
  assert.deepEqual(ctx.project, before);
  outcomes.push({ name, args: {}, result, unchanged: true });
}
console.log(JSON.stringify(outcomes, null, 2));
