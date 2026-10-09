import { describe, expect, it } from "vitest";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";

/**
 * 2026-09-10 실측 회귀의 **정확한** 원인 고정.
 *
 * 플래너가 successTools 에 검증 툴만 넣고 verificationChecks 를 빼면 세션이 `args: null`
 * pending requirement 를 심는다(assistantSession.adoptVerificationRequirements). 그 상태에서
 * 모델은 run_lint 21회·check_reachability 15회를 같은 인자로 반복 성공시켰지만
 * complete_work_item 은 7/12 거부되고 턴은 예산 소진으로 끝났다.
 *
 * 게이트 자체는 옳다 — 미지정 선언이 형제의 통과로 함께 만족되면 승인 원장이 거짓이 된다.
 * 실제 결함은 **탈출 경로가 어디에도 적혀 있지 않았다**는 것이다: 미지정은 실행으로 해소되지
 * 않고(observe 의 matching 은 args !== null 만 고른다) correct_verification 도 거부한다
 * (correction 의 `if (!stored?.args) return null`). 유일한 해소는 set_work_plan 재선언이다.
 * 그래서 고친 것은 판정이 아니라 차단 문구다.
 */
const OWNER = "verification-owner-1";
const PENDING = `${OWNER}:check_reachability:pending`;
const SPECIFIED = `${OWNER}:check_reachability:specified`;

/** check_reachability 는 from/targets 가 좌표로 유효해야 검증 입력으로 인정된다. */
const ARGS = { mapId: "map_a", from: { x: 1, y: 1 }, targets: [{ x: 2, y: 2 }] };
const reachable = { ok: true as const, summary: "도달성: 전부 도달 가능", data: { reachable: true } };
const unreachable = { ok: true as const, summary: "도달성: 도달 불가", data: { reachable: false } };

function pendingEvidence(): ToolVerificationEvidence {
  const evidence = new ToolVerificationEvidence();
  evidence.adopt({ checkId: PENDING, ownerId: OWNER, name: "check_reachability", args: null });
  return evidence;
}

describe("pending verification specification", () => {
  it("미지정 선언은 실행만으로 만족되지 않는다", () => {
    const evidence = pendingEvidence();
    evidence.observe("check_reachability", ARGS, reachable, "explicit", OWNER, undefined, undefined, [PENDING]);

    // 실행은 스펙을 정의하지 못한다 — 정의했다면 모델이 사후에 계약을 끼워 맞출 수 있다.
    expect(evidence.passed("check_reachability", [PENDING], OWNER)).toBe(false);
  });

  it("차단은 미지정 선언에만 귀속되고 유일한 해소 경로를 문구로 알려준다", () => {
    const evidence = pendingEvidence();
    evidence.adopt({ checkId: SPECIFIED, ownerId: OWNER, name: "check_reachability", args: ARGS });
    evidence.observe("check_reachability", ARGS, reachable, "explicit", OWNER, undefined, undefined, [SPECIFIED]);

    // 지정된 선언은 정상 통과한다. 차단 원인은 미지정 선언 하나로 특정된다.
    expect(evidence.passed("check_reachability", [SPECIFIED], OWNER)).toBe(true);
    expect(evidence.passed("check_reachability", [PENDING], OWNER)).toBe(false);

    // 실행으로는 해소되지 않으므로, 유일한 해소 경로를 반드시 실어 보낸다.
    // 이 문구가 없던 동안 모델은 같은 검증만 반복 성공시키며 같은 거부를 반복했다.
    const blocking = evidence.problems("blocking");
    const pending = blocking.filter(problem => problem.includes(PENDING));
    expect(pending).toHaveLength(1);
    expect(pending[0]).toContain("set_work_plan");
    expect(pending[0]).toContain("실행만으로는 해소되지 않습니다");
    expect(blocking.some(problem => problem.includes(SPECIFIED))).toBe(false);
  });

  it("실제 검증 실패는 여전히 막는다", () => {
    const evidence = new ToolVerificationEvidence();
    evidence.adopt({ checkId: SPECIFIED, ownerId: OWNER, name: "check_reachability", args: ARGS });
    evidence.observe("check_reachability", ARGS, unreachable, "explicit", OWNER, undefined, undefined, [SPECIFIED]);

    expect(evidence.passed("check_reachability", [SPECIFIED], OWNER)).toBe(false);
    expect(evidence.problems("blocking").length).toBeGreaterThan(0);
  });

  it("쓰기 이후에는 재검증을 요구한다 — 통과가 영구 래치되지 않는다", () => {
    const evidence = new ToolVerificationEvidence();
    evidence.adopt({ checkId: SPECIFIED, ownerId: OWNER, name: "check_reachability", args: ARGS });
    evidence.observe("check_reachability", ARGS, reachable, "explicit", OWNER, undefined, undefined, [SPECIFIED]);
    expect(evidence.passed("check_reachability", [SPECIFIED], OWNER)).toBe(true);

    evidence.invalidateAfterWrite();

    expect(evidence.passed("check_reachability", [SPECIFIED], OWNER)).toBe(false);
  });
});
