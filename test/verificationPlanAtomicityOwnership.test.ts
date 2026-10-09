// 검증 계획 원자성 매트릭스 2/3 — 소유권·사전검사 정규화 계열.
// 자매 파일: ...Atomicity.test.ts(1/3), ...Reuse.test.ts(3/3).
import { describe, expect, it } from "vitest";
import { fixture, paths, rejected } from "./helpers/verificationPlanAtomicityFixture";

describe.each(paths)("atomic verification adoption via %s", path => {
  it.each(["check_reachability", "run_lint", "run_scene_test", "run_action_combat_test"])("%s exact reuse preserves ownership and proof", async name => {
    const f = fixture(name);
    const original = await f.setup(name === "run_action_combat_test" ? "unverified" : "passed");
    const turn = await f.replace(path, f.plan([f.check(f.args, original.checkId)]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot()).toEqual(turn.before.verification);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original]);
  });

  it.each(["check_reachability", "run_lint"])("%s distinct scope needs fresh proof and invalid mixed candidates add nothing", async name => {
    const f = fixture(name);
    const original = await f.setup("passed");
    await f.send([f.probe(f.changed)]);
    rejected(await f.replace(path, f.candidate([f.check(f.changed), f.check(f.changed, original.checkId)])), original.checkId);
    const turn = await f.replace(path, f.plan([f.check(f.changed)]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original, expect.objectContaining({ args: f.changed, status: "unverified" })]);
    await f.send([f.probe(f.changed), { name: "complete_work_item", args: {} }]);
    // 2026-09-17 수용 원장 해체: 완료 판정은 계획 항목이 직접 선언한 verificationChecks 만 본다.
    expect(f.session.getVerificationSnapshot().requirements.map(requirement => requirement.status)).toEqual(["passed", "passed"]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
  });

  it.each(["same-item", "later-layer", "criterion"])("rejects contradictory pending resolutions across %s before either applies", async variant => {
    const f = fixture();
    const pending = await f.setup("unverified", null);
    const checks: unknown[] = [f.check(f.args, pending.checkId), f.check(f.changed, pending.checkId)];
    const candidate = f.candidate(checks);
    if (variant === "later-layer") {
      candidate.layers[0]!.items[0]!.verificationChecks = [checks[0]];
      candidate.layers.push({ title: "Later", items: [{ ...f.item([checks[1]]), id: "later-item" }] });
    }
    if (variant === "criterion") {
      checks[1] = { tool: f.name, checkId: pending.checkId, criterion: { promiseId: "new-route", criterionIndex: 0 } };
      candidate.acceptance.push({ id: "new-route", title: "New", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.other.from, to: f.other.targets }] });
    }
    rejected(await f.replace(path, candidate), pending.checkId);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([pending]);
  });

  it.each(["omitted", "changed", "wrong-tool", "malformed-args", "malformed-sibling", "unknown-id", "not-required"])("raw retained ID cannot bypass preflight via %s", async variant => {
    const f = fixture("run_lint");
    const pending = await f.setup("unverified", null);
    const candidate = f.candidate([f.check(f.args, pending.checkId)]);
    const item = candidate.layers[0]!.items[0]!;
    if (variant === "omitted") Reflect.deleteProperty(item, "mapTargets");
    if (variant === "changed") item.mapTargets = [f.foreign];
    if (variant === "wrong-tool") { item.verificationChecks = [{ tool: "check_reachability", args: f.route, checkId: pending.checkId }]; item.successTools = ["check_reachability"]; }
    if (variant === "malformed-args") item.verificationChecks = [{ tool: f.name, args: { reachability: "invalid" }, checkId: pending.checkId }];
    if (variant === "malformed-sibling") item.verificationChecks = [f.check(f.args, pending.checkId), { tool: f.name, args: { reachability: "invalid" } }];
    if (variant === "unknown-id") item.verificationChecks = [f.check(f.args, "unknown-retained-id")];
    if (variant === "not-required") item.successTools = ["get_project_summary"];
    rejected(await f.replace(path, candidate), variant === "unknown-id" ? "unknown-retained-id" : variant === "malformed-sibling" ? undefined : pending.checkId);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([pending]);
  });

});
