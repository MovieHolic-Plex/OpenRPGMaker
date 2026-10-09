// 팀 배정 원장. 팀장이 맵에 팀원을 붙일 때의 정책만 담는다 — 순수 모듈이고, 실행은
// scripts/lib/piTeamRuntime.ts 가 한다.
//
// 두 가지를 판정한다.
//
// 1. **업무 예산과 수정 예산의 분리.** 구 런타임은 배정 횟수 하나로 맵당 3회를 셌다. 그래서
//    사용자가 장식·정원사를 켜면 시공·장식·정원사 세 배정만으로 예산이 바닥나고, 검수가 지적을
//    해도 고칠 배정이 남지 않았다(에러 문구는 "이미 수정 2회를 썼습니다"였지만 수정은 0회였다).
//    같은 맵의 업무 분할은 파이프라인이라 팀원 수만큼 늘어나는 게 정상이므로, 업무는 팀원 수에
//    따라 늘고 수정만 고정 상한을 갖는다.
//
// 2. **맵 in-flight 락.** 코어는 같은 턴의 툴 호출을 병렬로 돌린다(concurrency 기본값 "shared").
//    같은 맵에 두 배정이 겹치면 둘 다 병합 전의 같은 사본에서 출발해, 나중에 끝난 쪽이 맵을
//    통째로 덮어쓰고 앞 결과가 조용히 사라진다. 전에는 팀장 프롬프트의 문장 하나가 유일한
//    방어였다. 여기서 계약으로 만든다 — 진행 중인 맵의 두 번째 배정은 거절한다.

/** 수정 배정의 맵당 상한. 검수 지적 → 수정 → 재지적의 무한 루프를 끊는다. */
const MAX_FIX_ASSIGNMENTS_PER_MAP = 2;
/** 업무 배정에 팀원 수 위로 얹는 여유. 한 팀원이 두 번 나눠 맡는 흔한 경우를 막지 않는다. */
const WORK_ASSIGNMENT_SLACK = 2;

export type TeamAssignmentPhase = "work" | "fix";
export type TeamAssignmentState = "running" | "done" | "failed";

export interface TeamAssignment {
  readonly agentId: string;
  readonly mapId: string;
  readonly memberId: string;
  /** 검수 지적을 고치러 간 배정인지. 예산이 갈린다. */
  readonly phase: TeamAssignmentPhase;
  /** 수정 배정일 때 원인이 된 검수 에이전트 id. 보드가 두 행을 잇는다. */
  readonly fixOf: string | null;
  readonly state: TeamAssignmentState;
}

export interface TeamAssignmentBudget {
  readonly work: number;
  readonly fix: number;
}

export interface TeamAssignmentLedger {
  readonly budget: TeamAssignmentBudget;
  readonly assignments: readonly TeamAssignment[];
  /** 맵 → 아직 고치지 않은 검수 지적을 낸 검수 에이전트 id. 다음 배정이 수정이 된다. */
  readonly pendingFindings: Readonly<Record<string, string>>;
}

export type ClaimAssignmentResult =
  | { readonly ok: true; readonly ledger: TeamAssignmentLedger; readonly assignment: TeamAssignment }
  | { readonly ok: false; readonly reason: string };

export function teamAssignmentBudget(builderCount: number): TeamAssignmentBudget {
  return { work: Math.max(1, builderCount) + WORK_ASSIGNMENT_SLACK, fix: MAX_FIX_ASSIGNMENTS_PER_MAP };
}

export function createTeamAssignmentLedger(budget: TeamAssignmentBudget): TeamAssignmentLedger {
  return { budget, assignments: [], pendingFindings: {} };
}

export function runningAssignments(ledger: TeamAssignmentLedger): readonly TeamAssignment[] {
  return ledger.assignments.filter((assignment) => assignment.state === "running");
}

function countFor(ledger: TeamAssignmentLedger, mapId: string, phase: TeamAssignmentPhase): number {
  return ledger.assignments.filter((assignment) => assignment.mapId === mapId && assignment.phase === phase).length;
}

export function claimAssignment(
  ledger: TeamAssignmentLedger,
  input: { readonly mapId: string; readonly agentId: string; readonly memberId: string },
): ClaimAssignmentResult {
  const { mapId, agentId, memberId } = input;
  const busy = runningAssignments(ledger).find((assignment) => assignment.mapId === mapId);
  if (busy) {
    return {
      ok: false,
      reason: `맵 '${mapId}' 에는 이미 ${busy.memberId}(${busy.agentId})가 붙어 있습니다. 같은 맵은 한 번에 한 명입니다 — check_agents 로 끝났는지 확인한 뒤 다시 배정하세요.`,
    };
  }
  const fixOf = ledger.pendingFindings[mapId] ?? null;
  const phase: TeamAssignmentPhase = fixOf ? "fix" : "work";
  const used = countFor(ledger, mapId, phase);
  const limit = phase === "fix" ? ledger.budget.fix : ledger.budget.work;
  if (used >= limit) {
    return {
      ok: false,
      reason: phase === "fix"
        ? `맵 '${mapId}' 은 수정 ${limit}회를 이미 썼습니다. finish 로 현재 상태와 남은 지적을 보고하세요.`
        : `맵 '${mapId}' 은 업무 배정 ${limit}회를 이미 썼습니다. 검수로 넘기거나 finish 로 보고하세요.`,
    };
  }
  const assignment: TeamAssignment = { agentId, mapId, memberId, phase, fixOf, state: "running" };
  const pendingFindings = { ...ledger.pendingFindings };
  delete pendingFindings[mapId];
  return { ok: true, assignment, ledger: { ...ledger, assignments: [...ledger.assignments, assignment], pendingFindings } };
}

export function settleAssignment(ledger: TeamAssignmentLedger, agentId: string, ok: boolean): TeamAssignmentLedger {
  return {
    ...ledger,
    assignments: ledger.assignments.map((assignment) =>
      assignment.agentId === agentId ? { ...assignment, state: ok ? "done" : "failed" } : assignment,
    ),
  };
}

/** 검수 결과를 원장에 남긴다. 지적이 있으면 그 맵의 다음 배정이 수정으로 분류된다. */
export function recordTeamReview(
  ledger: TeamAssignmentLedger,
  input: { readonly mapId: string; readonly agentId: string; readonly ok: boolean },
): TeamAssignmentLedger {
  const pendingFindings = { ...ledger.pendingFindings };
  if (input.ok) delete pendingFindings[input.mapId];
  else pendingFindings[input.mapId] = input.agentId;
  return { ...ledger, pendingFindings };
}
