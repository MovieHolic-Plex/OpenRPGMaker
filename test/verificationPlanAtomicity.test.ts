// 검증 계획 원자성 매트릭스 1/3 — 거절·사전검사 계열.
// 같은 매트릭스를 세 파일로 가른다(자매: ...Ownership.test.ts = 2/3, ...Reuse.test.ts = 3/3). 나눈 근거는 아래 실측.
import { describe, expect, it } from "vitest";
import { fixture, paths, rejected, scopes } from "./helpers/verificationPlanAtomicityFixture";

describe.each(paths)("atomic verification adoption via %s", path => {
// 왜 가르나(2026-09-11 실측): 케이스가 워커 하나에서 누적될수록 힙이 자란다(2케이스 0.52GB → 54케이스 3.55GB → 108케이스 4.34GB).
// 108케이스를 한 파일에 두면 Node 기본 힙 상한(4.29GB)을 넘어 워커가 OOM 으로 죽고, 그 워커가 맡은 파일은 결과를 못 낸다.
// 픽스처는 helpers/verificationPlanAtomicityFixture.ts 로 옮겼다.
  it.each(scopes.flatMap(name => (["passed", "unverified", "stale"] as const).map(status => ({ name, status }))))(
    "$name rejects changed specified args while $status", async ({ name, status }) => {
      const f = fixture(name);
      const original = await f.setup(status);
      rejected(await f.replace(path, f.candidate([f.check(f.changed, original.checkId)])), original.checkId);
    });

  it.each(["passed", "unverified", "stale"] as const)("rejects criterion-reference replacement while %s", async status => {
    const f = fixture();
    const initial = f.plan([f.check()]);
    const routePromise = { id: "other-route", title: "Other", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.other.from, to: f.other.targets }] };
    await f.send([{ name: "set_work_plan", args: { ...initial, acceptance: [...initial.acceptance, routePromise] } },
      ...(status === "unverified" ? [] : [f.probe(), f.probe(f.other)])]);
    if (status === "stale") { const edited = f.session.getProposedProject(); edited.session.gold = (edited.session.gold ?? 0) + 1; f.session.syncBaselineFromStoreIfClean(edited); }
    const original = f.session.getVerificationSnapshot().requirements.find(check => !check.criterion)!;
    expect(original.status).toBe(status);
    rejected(await f.replace(path, f.candidate([{ tool: f.name, checkId: original.checkId, criterion: { promiseId: "other-route", criterionIndex: 0 } }])), original.checkId);
  });

});
