// 검증 계획 원자성 매트릭스 3/3 — 재사용·장면 상호작용 계열.
// 자매 파일: ...Atomicity.test.ts(1/3), ...Ownership.test.ts(2/3).
// 2026-09-17 수용 원장 해체: 수용 기준(acceptance reachability)에서 파생되던 검증 소유권 재사용 테스트
// ("exact … reuses an accepted criterion", "pending criterion-reference resolution", "a malformed new scope …")는 삭제했다.
// 남은 것은 작업 계획 항목이 직접 선언한 verificationChecks 의 원자성 계약이다. acceptance 스냅샷 단언은 뺐다(항상 null).
import { describe, expect, it } from "vitest";
import { fixture, paths, rejected } from "./helpers/verificationPlanAtomicityFixture";

describe.each(paths)("atomic verification adoption via %s", path => {
  it("a resolved new sibling cannot conceal an unresolved declaration", async () => {
    const f = fixture();
    await f.setup();
    const turn = await f.replace(path, f.plan([f.check(f.changed), { tool: f.name, criterion: { promiseId: "missing", criterionIndex: 0 } }]));
    if (turn.result?.ok === false) rejected(turn);
    else expect(f.session.getVerificationSnapshot().requirements.filter(check => check.args === null)).toHaveLength(1);
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
    expect(f.session.getVerificationSnapshot().requirements).toEqual([expect.objectContaining({ checkId: pending.checkId, status: "passed" })]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
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
