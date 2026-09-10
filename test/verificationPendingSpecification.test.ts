import { describe, expect, it } from "vitest";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";

/**
 * 2026-09-10 실측 회귀: 플래너가 successTools 에 검증 툴만 넣고 verificationChecks 를 빼면
 * 세션이 `args: null` pending requirement 를 심는다(assistantSession.adoptVerificationRequirements).
 * 이전 구현의 passed() 는 pending 이 하나라도 있으면 무조건 false 를 냈고, 그 결과
 * 실제로 통과한 검증 툴의 성공 기록이 지워져 complete_work_item 이 영구 거부됐다.
 * 해소 경로(correct_verification·set_work_plan)도 모두 막혀 있어 예산 소진만이 탈출구였다.
 */
const OWNER = "verification-owner-1";
const PENDING = `${OWNER}:check_reachability:pending`;

function pendingEvidence(): ToolVerificationEvidence {
  const evidence = new ToolVerificationEvidence();
  evidence.adopt({ checkId: PENDING, ownerId: OWNER, name: "check_reachability", args: null });
  return evidence;
}

/** check_reachability 는 from/targets 가 좌표로 유효해야 검증 입력으로 인정된다. */
const ARGS = { mapId: "map_a", from: { x: 1, y: 1 }, targets: [{ x: 2, y: 2 }] };
const reachable = { ok: true as const, summary: "도달성: 전부 도달 가능", data: { reachable: true } };
const unreachable = { ok: true as const, summary: "도달성: 도달 불가", data: { reachable: false } };

describe("pending verification specification", () => {
  it("스펙 미지정은 통과한 검증을 미통과로 만들지 않는다", () => {
    const evidence = pendingEvidence();
    expect(evidence.passed("check_reachability", [PENDING], OWNER)).toBe(false);

    evidence.observe("check_reachability", ARGS, reachable, "explicit", OWNER, undefined, undefined, [PENDING]);

    expect(evidence.passed("check_reachability", [PENDING], OWNER)).toBe(true);
  });

  it("스펙 미지정은 턴을 막지 않고 진단으로만 노출된다", () => {
    const evidence = pendingEvidence();
    evidence.observe("check_reachability", ARGS, reachable, "explicit", OWNER, undefined, undefined, [PENDING]);

    expect(evidence.problems("blocking")).toEqual([]);
    const all = evidence.problems("all");
    expect(all.some(problem => problem.includes(PENDING))).toBe(true);
    expect(all.some(problem => problem.includes("set_work_plan"))).toBe(true);
  });

  it("실제 검증 실패는 여전히 막는다", () => {
    const evidence = pendingEvidence();
    evidence.observe("check_reachability", ARGS, unreachable, "explicit", OWNER, undefined, undefined, [PENDING]);

    expect(evidence.passed("check_reachability", [PENDING], OWNER)).toBe(false);
    expect(evidence.problems("blocking").length).toBeGreaterThan(0);
  });

  it("쓰기 이후에는 재검증을 요구한다 — 통과가 영구 래치되지 않는다", () => {
    const evidence = pendingEvidence();
    evidence.observe("check_reachability", ARGS, reachable, "explicit", OWNER, undefined, undefined, [PENDING]);
    expect(evidence.passed("check_reachability", [PENDING], OWNER)).toBe(true);

    evidence.invalidateAfterWrite();

    expect(evidence.passed("check_reachability", [PENDING], OWNER)).toBe(false);
  });
});
