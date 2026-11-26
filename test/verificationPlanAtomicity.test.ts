// 검증 계획 원자성 매트릭스 1/3 — 거절·사전검사 계열.
// 같은 매트릭스를 세 파일로 가른다(자매: ...Ownership.test.ts = 2/3, ...Reuse.test.ts = 3/3). 나눈 근거는 아래 실측.
import { describe, expect, it } from "vitest";
import { fixture, paths, rejected, scopes } from "./helpers/verificationPlanAtomicityFixture";

// Heavy under CI load (15s default is too tight): runs real verification tools over full fixtures.
describe.each(paths)("atomic verification adoption via %s", { timeout: 120_000 }, path => {
// 왜 가르나(2026-09-11 실측): 케이스가 워커 하나에서 누적될수록 힙이 자란다(2케이스 0.52GB → 54케이스 3.55GB → 108케이스 4.34GB).
// 108케이스를 한 파일에 두면 Node 기본 힙 상한(4.29GB)을 넘어 워커가 OOM 으로 죽고, 그 워커가 맡은 파일은 결과를 못 낸다.
// 픽스처는 helpers/verificationPlanAtomicityFixture.ts 로 옮겼다.
  // 2026-11-25 test-diet: 바뀐 인자 거절은 preflightWorkPlan(src/ai/assistantSession.ts 1436-1463)이 요구의 args·도구만 비교해
  // 정한다 — 요구 상태(passed/unverified/stale)는 읽지 않는다. 그래서 도구마다 인자 모양은 unverified 행으로 다 지키고, 상태 셋은
  // check_reachability 한 도구로 지킨다(passed·stale 행은 진짜 검증 도구를 돌려 케이스당 26~30 s 였다).
  it.each(scopes.flatMap(name => ((name === "check_reachability" ? ["passed", "unverified", "stale"] : ["unverified"]) as ("passed" | "unverified" | "stale")[]).map(status => ({ name, status }))))(
    "$name rejects changed specified args while $status", async ({ name, status }) => {
      const f = fixture(name);
      const original = await f.setup(status);
      rejected(await f.replace(path, f.candidate([f.check(f.changed, original.checkId)])), original.checkId);
    });

  // 2026-11-26 test-diet r3: 위와 같은 까닭으로 criterion 참조 교체 거절도 상태를 읽지 않는다(preflightWorkPlan 1440-1464) — unverified 한 행으로 지킨다.
  it("rejects criterion-reference replacement while unverified", async () => {
    const f = fixture();
    const initial = f.plan([f.check()]);
    const routePromise = { id: "other-route", title: "Other", criteria: [{ kind: "reachability", target: { mapId: f.mapId }, from: f.other.from, to: f.other.targets }] };
    await f.send([{ name: "set_work_plan", args: { ...initial, acceptance: [...initial.acceptance, routePromise] } }]);
    const original = f.session.getVerificationSnapshot().requirements.find(check => !check.criterion)!;
    expect(original.status).toBe("unverified");
    rejected(await f.replace(path, f.candidate([{ tool: f.name, checkId: original.checkId, criterion: { promiseId: "other-route", criterionIndex: 0 } }])), original.checkId);
  });

});
