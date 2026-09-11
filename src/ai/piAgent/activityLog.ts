// Pi 실행을 활동 로그에 남긴다 — 세션 턴과 **같은 관례**다: 시작할 때 pending 행 하나를 쓰고,
// 끝날 때 같은 id 로 upsert 한다. 죽은 실행도 «무슨 지시였고 언제 시작했는지» 는 남는다.
//
// 왜 필요했나 (2026-09-11): Pi 는 2026-09-10 부터 생 입력의 기본 경로인데 감사 기록이 없었다.
// 그래서 `npm run ai:log --failed` 가 기본 경로의 실패를 통째로 못 봤고, 실측 로그에서도
// chat/region/ui/other 만 보이고 pi 행은 0이었다. 경로를 판단하려면 먼저 이 경로가 보여야 한다.
//
// 적용은 두 번 기록될 수 있다: 실행이 끝나 «검토 대기» 에 닿은 시점(아직 applied 아님)과, 사용자가
// 검토 카드에서 적용/버리기를 누른 시점. 같은 id 의 마지막 기록이 그 실행의 결말이다.
//
// 핸들이 Promise 를 들고 있는 이유: 패널은 기다리지 않지만(기록이 실행을 막지 않는다), 테스트는
// 기다려야 한다 — 안 그러면 단언이 쓰기 전에 돌아 «가끔 통과하는» 테스트가 된다.

import { recordAiActivity } from "@/ai/activityLog";
import type { AiActivityToolCall } from "@/ai/activityLogTypes";
import type { AuditEntry } from "@/ai/session/types";
import { randomUuid } from "@/util/id";
import type { TeamBoardState } from "./teamBoardState";

export interface PiRunContext {
  readonly instruction: string;
  /** single = 에이전트 하나(맵마다 병렬일 수 있다), team = 팀장 + 시공·검수. */
  readonly mode: "single" | "team";
  /** 요청이 지정한 맵들. 비면 프로젝트 전체 범위. */
  readonly mapIds: readonly string[];
  /** 로그의 mapId 컬럼 — 첫 번째 범위 맵(없으면 현재 맵). */
  readonly mapId: string | null;
  readonly mapName: string | null;
  readonly provider: string;
  readonly model: string;
}

export interface PiRunFacts {
  readonly board: TeamBoardState;
  /** 게이트를 통과해 프로젝트에 반영됐는가. 검토 대기·버림이면 false. */
  readonly applied: boolean;
  /** 바뀐 프로젝트 키 수(맵·항목). */
  readonly changedCount: number;
  /** 실패했으면 그 문장. 있으면 ok=false 로 기록된다. */
  readonly error?: string;
  /** 실행이 끝난 이유(중단·변경 없음·검토 대기·버림·적용됨). */
  readonly stoppedReason?: string;
}

export interface PiRunLogHandle {
  readonly id: string;
  /** 시작 pending 행의 기록. */
  readonly started: Promise<void>;
  /** 종료(또는 적용·버림) 기록. 같은 id 로 upsert 된다. */
  readonly finish: (facts: PiRunFacts) => Promise<void>;
}

export function startPiRunLog(context: PiRunContext): PiRunLogHandle {
  const id = randomUuid();
  const write = (result: Parameters<typeof recordAiActivity>[0]["result"], extra: Partial<Parameters<typeof recordAiActivity>[0]> = {}): Promise<void> =>
    recordAiActivity({
      id,
      channel: "pi",
      instruction: context.instruction,
      model: context.model,
      ...(context.mapId ? { mapId: context.mapId } : {}),
      ...(context.mapName ? { mapName: context.mapName } : {}),
      result,
      ...extra,
    }).then(() => undefined, () => {
      /* 기록 실패가 실행을 막지 않는다 — 세션 턴과 같은 규칙 */
    });
  return {
    id,
    started: write({ ok: false, pending: true }),
    finish: (facts) => write(
      {
        ok: facts.error === undefined,
        applied: facts.applied,
        ...(facts.error ? { error: facts.error } : {}),
        ...(facts.stoppedReason ? { stoppedReason: facts.stoppedReason } : {}),
        ...(facts.board.report ? { assistantText: facts.board.report } : {}),
      },
      { toolCalls: agentToolCalls(facts.board), audit: runAudit(context, facts) },
    ),
  };
}

/**
 * 하위 에이전트를 «툴 호출» 로 옮긴다. 기존 로그 뷰어(`npm run ai:log --tools`)가 toolCalls 를
 * 순번·상태·요약으로 펼치므로, 팀 실행의 서사가 별도 뷰어 없이 그대로 읽힌다.
 */
function agentToolCalls(board: TeamBoardState): AiActivityToolCall[] {
  return board.agents.map((agent) => {
    const where = agent.mapName ?? "프로젝트 전체";
    const counters = `${agent.turns}턴/${agent.toolCalls}툴콜${agent.toolErrors > 0 ? ` · 오류 ${agent.toolErrors}` : ""}`;
    return {
      name: `pi:${agent.kindLabel}`,
      args: {
        ...(agent.memberId ? { memberId: agent.memberId } : {}),
        ...(agent.mapId ? { mapId: agent.mapId } : {}),
        ...(agent.fixOf ? { fixOf: agent.fixOf } : {}),
      },
      ok: agent.state === "완료",
      summary: `${agent.roleLabel} — ${agent.state} · ${where} · ${counters}${agent.lastLine ? ` — ${agent.lastLine}` : ""}`,
    };
  });
}

function runAudit(context: PiRunContext, facts: PiRunFacts): AuditEntry[] {
  const rows: AuditEntry[] = [{ kind: "user", text: context.instruction }];
  for (const agent of facts.board.agents) {
    const where = agent.mapName ?? "프로젝트 전체";
    rows.push({
      kind: "status",
      text: `${agent.roleLabel}(${where}) ${agent.state} — ${agent.turns}턴/${agent.toolCalls}툴콜${agent.lastLine ? ` — ${agent.lastLine}` : ""}`,
    });
    if (agent.review && !agent.review.ok) {
      rows.push({ kind: "status", text: `검수 지적 (${agent.roleLabel}): ${agent.review.findings.join(" / ")}` });
    }
    if (agent.spills.length > 0) {
      rows.push({ kind: "status", text: `범위 밖 변경 버림 (${agent.roleLabel}): ${agent.spills.join(", ")}` });
    }
    if (agent.conflicts.length > 0) {
      rows.push({ kind: "status", text: `맵 충돌 (${agent.roleLabel}): ${agent.conflicts.join(", ")}` });
    }
  }
  const scope = context.mapIds.length > 0 ? context.mapIds.join(", ") : "프로젝트 전체";
  const ending = facts.error
    ? `실패: ${facts.error}`
    : facts.applied
      ? `적용됨 — 바뀐 맵·항목 ${facts.changedCount}개`
      : `${facts.stoppedReason ?? "끝남"} — 바뀐 맵·항목 ${facts.changedCount}개`;
  rows.push({ kind: "status", text: `Pi ${facts.board.mode === "team" ? "팀" : "에이전트"} · 범위 ${scope} · ${ending}` });
  return rows;
}
