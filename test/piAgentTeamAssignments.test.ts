import { describe, expect, it } from "vitest";
import {
  claimAssignment,
  createTeamAssignmentLedger,
  recordTeamReview,
  runningAssignments,
  settleAssignment,
  teamAssignmentBudget,
  type TeamAssignmentLedger,
} from "@/ai/piAgent/teamAssignments";

function ledgerFor(builderCount: number): TeamAssignmentLedger {
  return createTeamAssignmentLedger(teamAssignmentBudget(builderCount));
}

/** 성공을 전제로 배정하고 원장을 잇는다. 실패하면 테스트를 세운다. */
function claim(ledger: TeamAssignmentLedger, mapId: string, agentId: string, memberId: string): TeamAssignmentLedger {
  const result = claimAssignment(ledger, { mapId, agentId, memberId });
  if (!result.ok) throw new Error(`배정이 거절됐다: ${result.reason}`);
  return result.ledger;
}

describe("팀 배정 원장 — 업무/수정 예산 분리", () => {
  // 깨질 것: 첫 배정을 수정으로 분류하면(구 fixRounds) phase 가 "fix" 가 되고 수정 예산이 깎인다.
  it("첫 배정은 업무이고 수정 예산을 건드리지 않는다", () => {
    const result = claimAssignment(ledgerFor(1), { mapId: "map_a", agentId: "builder-1", memberId: "builder" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assignment.phase).toBe("work");
    expect(result.assignment.fixOf).toBeNull();
  });

  // 깨질 것: 예산을 하나로 합치면(구 MAX_FIX_ROUNDS_PER_MAP=2, 총 3회) 세 팀원이 한 번씩만 맡아도
  // 검수 지적을 고칠 배정이 남지 않는다 — 사용자가 정원사를 켰을 때 실제로 밟는 경로.
  it("시공 팀원 셋이 한 맵을 한 번씩 맡아도 수정 두 번이 남는다", () => {
    let ledger = ledgerFor(3);
    for (const [index, member] of ["builder", "decorator", "gardener"].entries()) {
      const agentId = `builder-${index + 1}`;
      ledger = claim(ledger, "map_a", agentId, member);
      ledger = settleAssignment(ledger, agentId, true);
    }
    expect(ledger.assignments.every((assignment) => assignment.phase === "work")).toBe(true);

    for (const round of [1, 2]) {
      ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: `reviewer-${round}`, ok: false });
      const fix = claimAssignment(ledger, { mapId: "map_a", agentId: `fix-${round}`, memberId: "builder" });
      expect(fix.ok).toBe(true);
      if (!fix.ok) return;
      expect(fix.assignment.phase).toBe("fix");
      ledger = settleAssignment(fix.ledger, `fix-${round}`, true);
    }
  });

  // 깨질 것: 수정 배정이 원인이 된 검수를 가리키지 않으면 보드가 재배정을 원 작업에 이을 수 없다.
  it("검수 지적 뒤의 배정만 수정으로 분류되고 그 검수 행을 가리킨다", () => {
    let ledger = claim(ledgerFor(1), "map_a", "builder-1", "builder");
    ledger = settleAssignment(ledger, "builder-1", true);
    ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-1", ok: false });

    const result = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "builder" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assignment.phase).toBe("fix");
    expect(result.assignment.fixOf).toBe("reviewer-1");
  });

  // 깨질 것: 검수 통과에도 지적을 기록하면 멀쩡한 다음 업무가 수정으로 분류돼 예산을 깎는다.
  it("검수가 통과하면 다음 배정은 업무로 남는다", () => {
    let ledger = claim(ledgerFor(2), "map_a", "builder-1", "builder");
    ledger = settleAssignment(ledger, "builder-1", true);
    ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-1", ok: true });

    const result = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assignment.phase).toBe("work");
    expect(result.assignment.fixOf).toBeNull();
  });

  // 깨질 것: 배정할 때 지적을 지우지 않으면, 한 번 지적이 난 맵의 이후 배정이 전부 수정으로
  // 분류돼 수정 예산만 갉아먹는다(수정을 이미 보냈는데도).
  it("수정을 한 번 보내면 그 지적은 소진되고 다음 배정은 다시 업무다", () => {
    let ledger = ledgerFor(2);
    ledger = settleAssignment(claim(ledger, "map_a", "builder-1", "builder"), "builder-1", true);
    ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-1", ok: false });
    ledger = settleAssignment(claim(ledger, "map_a", "fix-1", "builder"), "fix-1", true);

    const next = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.assignment.phase).toBe("work");
    expect(next.assignment.fixOf).toBeNull();
  });

  // 깨질 것: 통과한 검수가 앞선 지적을 지우지 않으면, 고쳐서 통과했는데도 다음 배정이 수정으로
  // 분류돼 예산이 깎인다.
  it("지적 뒤 재검수가 통과하면 남은 지적이 지워진다", () => {
    let ledger = ledgerFor(2);
    ledger = settleAssignment(claim(ledger, "map_a", "builder-1", "builder"), "builder-1", true);
    ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-1", ok: false });
    ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-2", ok: true });

    const next = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.assignment.phase).toBe("work");
  });

  // 깨질 것: 수정 상한을 지우면 검수 지적 → 수정 → 재지적이 무한히 돈다.
  it("수정 예산을 다 쓰면 더 배정하지 않는다", () => {
    let ledger = ledgerFor(1);
    ledger = settleAssignment(claim(ledger, "map_a", "builder-1", "builder"), "builder-1", true);
    for (const round of [1, 2]) {
      ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: `reviewer-${round}`, ok: false });
      ledger = settleAssignment(claim(ledger, "map_a", `fix-${round}`, "builder"), `fix-${round}`, true);
    }
    ledger = recordTeamReview(ledger, { mapId: "map_a", agentId: "reviewer-3", ok: false });

    const denied = claimAssignment(ledger, { mapId: "map_a", agentId: "fix-3", memberId: "builder" });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.reason).toContain("map_a");
  });

  // 깨질 것: 업무 상한을 지우면 팀장이 같은 맵에 배정을 무한히 쌓을 수 있다.
  it("업무 예산을 다 쓰면 더 배정하지 않는다", () => {
    let ledger = ledgerFor(1);
    const budget = ledger.budget.work;
    for (let index = 0; index < budget; index += 1) {
      const agentId = `builder-${index + 1}`;
      ledger = settleAssignment(claim(ledger, "map_a", agentId, "builder"), agentId, true);
    }
    const denied = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-over", memberId: "builder" });
    expect(denied.ok).toBe(false);
  });
});

describe("팀 배정 원장 — 맵 in-flight 락", () => {
  // 깨질 것: 락을 지우면 같은 턴의 두 배정이 같은 스냅샷에서 출발해 나중 결과가 앞 결과를 통째로 덮는다.
  it("진행 중인 맵에 두 번째 배정은 거절한다", () => {
    const ledger = claim(ledgerFor(3), "map_a", "builder-1", "builder");
    const denied = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.reason).toContain("map_a");
    expect(denied.reason).toContain("builder-1");
  });

  it("다른 맵은 동시에 배정된다", () => {
    let ledger = claim(ledgerFor(2), "map_a", "builder-1", "builder");
    ledger = claim(ledger, "map_b", "builder-2", "builder");
    expect(runningAssignments(ledger).map((assignment) => assignment.mapId)).toEqual(["map_a", "map_b"]);
  });

  // 깨질 것: 완료 시 락을 안 풀면 시공 → 장식 파이프라인의 두 번째 배정이 영영 막힌다.
  it("앞 배정이 끝나면 같은 맵을 다시 배정할 수 있다", () => {
    let ledger = claim(ledgerFor(3), "map_a", "builder-1", "builder");
    ledger = settleAssignment(ledger, "builder-1", true);
    expect(runningAssignments(ledger)).toEqual([]);

    const next = claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "decorator" });
    expect(next.ok).toBe(true);
  });

  // 깨질 것: 실패한 배정이 running 으로 남으면 그 맵은 두 번 다시 못 쓴다.
  it("실패한 배정도 락을 푼다", () => {
    let ledger = claim(ledgerFor(3), "map_a", "builder-1", "builder");
    ledger = settleAssignment(ledger, "builder-1", false);
    expect(ledger.assignments[0]?.state).toBe("failed");
    expect(claimAssignment(ledger, { mapId: "map_a", agentId: "builder-2", memberId: "builder" }).ok).toBe(true);
  });
});
