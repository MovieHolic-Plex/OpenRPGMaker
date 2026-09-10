// 검증 계획 원자성 매트릭스 3/3 — 재사용·장면 상호작용 계열.
// 자매 파일: ...Atomicity.test.ts(1/3), ...Ownership.test.ts(2/3).
import { describe, expect, it } from "vitest";
import { fixture, paths, rejected } from "./helpers/verificationPlanAtomicityFixture";

describe.each(paths)("atomic verification adoption via %s", path => {
  it("a resolved new sibling cannot conceal an unresolved declaration", async () => {
    const f = fixture();
    await f.setup();
    const turn = await f.replace(path, f.plan([f.check(f.changed), { tool: f.name, criterion: { promiseId: "missing", criterionIndex: 0 } }]));
    if (turn.result?.ok === false) rejected(turn);
    else {
      expect(f.session.getVerificationSnapshot().requirements.filter(check => check.args === null)).toHaveLength(1);
      expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    }
  });

  it("compatible repeated pending resolution preserves ID, owner and targets but needs fresh execution", async () => {
    const f = fixture();
    const pending = await f.setup("unverified", null);
    await f.send([f.probe()]);
    const turn = await f.replace(path, f.plan([f.check(f.args, pending.checkId), f.check(f.args, pending.checkId)]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([expect.objectContaining({ checkId: pending.checkId,
      ownerId: pending.ownerId, mapTargets: pending.mapTargets, args: f.args, status: "unverified" })]);
    await f.send([f.probe(), { name: "complete_work_item", args: {} }]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it.each(["omitted", "changed"])("specified retained targets cannot be %s at any proof status", async variant => {
    for (const name of ["check_reachability", "run_lint"]) for (const status of ["passed", "unverified", "stale"] as const) {
      const f = fixture(name);
      const original = await f.setup(status);
      const candidate = f.candidate([f.check(f.args, original.checkId)]);
      const item = candidate.layers[0]!.items[0]!;
      if (variant === "omitted") Reflect.deleteProperty(item, "mapTargets");
      else item.mapTargets = [f.foreign];
      rejected(await f.replace(path, candidate), original.checkId);
    }
  }, 30000);

  it.each(["reference", "exact-args"])("exact %s reuses an accepted criterion without losing independent declarations", async variant => {
    const f = fixture();
    const plan = f.plan();
    plan.acceptance.push({ id: "route", title: "Route", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.route.from, to: f.route.targets }] });
    await f.send([{ name: "set_work_plan", args: plan }, f.probe()]);
    const original = f.session.getVerificationSnapshot().requirements[0]!;
    expect(original).toMatchObject({ status: "passed", criterion: { promiseId: "route", criterionIndex: 0 } });
    const declaration = variant === "reference" ? { tool: f.name, criterion: original.criterion } : f.check();
    const turn = await f.replace(path, f.plan([declaration]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot()).toEqual(turn.before.verification);
    await f.replace(path, f.plan([declaration, f.check(f.changed)]));
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original, expect.objectContaining({ args: f.changed, status: "unverified" })]);
  });

  it("rejection preserves an existing negative finding and its exact proof history", async () => {
    const f = fixture();
    const original = await f.setup("passed");
    await f.send([{ name: "run_scene_test", args: { mapId: f.mapId, start: { x: 1, y: 1 }, steps: [{ kind: "expect", mapId: f.foreign }] } }]);
    expect(f.session.getVerificationSnapshot().findings).toHaveLength(1);
    rejected(await f.replace(path, f.candidate([f.check(f.changed), f.check(f.changed, original.checkId)])), original.checkId);
  });

  it("exact stale scene reuse retains its original initial-state ownership", async () => {
    const f = fixture("run_scene_test");
    const original = await f.setup("stale");
    expect(original.initialState).toBeDefined();
    const turn = await f.replace(path, f.plan([f.check(f.args, original.checkId)]));
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot()).toEqual(turn.before.verification);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original]);
  });

  it("pending criterion-reference resolution retains owner and needs new exact execution", async () => {
    const f = fixture();
    const pending = await f.setup("unverified", null);
    await f.send([f.probe()]);
    const candidate = f.plan([{ tool: f.name, checkId: pending.checkId, criterion: { promiseId: "new-route", criterionIndex: 0 } }]);
    candidate.acceptance.push({ id: "new-route", title: "New", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.route.from, to: f.route.targets }] });
    const turn = await f.replace(path, candidate);
    if (path === "tool") expect(turn.result?.ok).toBe(true);
    expect(f.session.getVerificationSnapshot().requirements.find(check => check.checkId === pending.checkId)).toMatchObject({
      ownerId: pending.ownerId, mapTargets: pending.mapTargets, args: f.args, status: "unverified", criterion: { promiseId: "new-route", criterionIndex: 0 },
    });
    await f.send([f.probe(), { name: "complete_work_item", args: {} }]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it.each(["invalid-id", "discarded-item", "alias-array"])("raw declaration preflight survives %s normalization", async variant => {
    const f = fixture();
    const original = await f.setup();
    const candidate = f.candidate([f.check(f.changed, original.checkId)]);
    if (variant === "invalid-id") candidate.layers[0]!.items[0]!.verificationChecks = [{ ...f.check(f.changed), checkId: 123 }];
    if (variant === "discarded-item") {
      candidate.layers[0]!.items[0]!.instruction = "";
      candidate.layers[0]!.items.push({ ...f.item([f.check()]), id: "valid-item" });
    }
    if (variant === "alias-array") {
      const layer = candidate.layers[0]!;
      Reflect.set(layer, "steps", layer.items);
      Reflect.deleteProperty(layer, "items");
    }
    rejected(await f.replace(path, candidate), variant === "invalid-id" ? undefined : original.checkId);
  });

  it("a malformed new scope cannot silently reuse an unrelated accepted criterion", async () => {
    const f = fixture();
    const plan = f.plan();
    plan.acceptance.push({ id: "route", title: "Route", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.route.from, to: f.route.targets }] });
    await f.send([{ name: "set_work_plan", args: plan }, f.probe()]);
    const turn = await f.replace(path, f.plan([{ tool: f.name, args: { mapId: f.mapId } }]));
    if (turn.result?.ok === false) rejected(turn);
    else {
      expect(f.session.getVerificationSnapshot().requirements.filter(check => check.args === null)).toHaveLength(1);
      expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    }
  });

  it("scene interaction ownership is immutable even with identical executable args", async () => {
    const f = fixture("run_scene_test");
    const args = { mapId: f.mapId, start: { x: 5, y: 4 }, steps: [{ kind: "interact", eventId: "atomic_npc" }] };
    const check = { tool: f.name, args, interactionTargets: [{ stepIndex: 0, mapId: f.mapId, eventId: "atomic_npc" }] };
    await f.send([{ name: "set_work_plan", args: f.plan([check]) }, f.probe(args)]);
    const original = f.session.getVerificationSnapshot().requirements[0]!;
    expect(original.status).toBe("passed");
    rejected(await f.replace(path, f.candidate([{ ...check, checkId: original.checkId,
      interactionTargets: [{ stepIndex: 0, mapId: f.foreign, eventId: "atomic_npc" }] }])), original.checkId);
  });
});
