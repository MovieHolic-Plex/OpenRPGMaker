// Pi 팀 역할 정의. 하네스처럼 역할마다 프롬프트·툴 범위·모델을 선언하고, 팀장(orchestrator)이
// 그 역할로 하위 에이전트를 띄운다. 순수 모듈 — 실행은 scripts/lib/piTeamRuntime.ts 가 한다.

import type { Project } from "@/project/types";
import { buildPiAgentSystemPrompt, describeScopedMaps } from "./systemPrompt";
import type { PiTeamRoleId } from "./protocol";

export interface PiTeamRole {
  readonly id: PiTeamRoleId;
  readonly label: string;
  /** 비우면 레지스트리 전부. */
  readonly toolDomains?: readonly string[];
  readonly readOnly?: boolean;
  /** 팀장처럼 소수 툴만 집어 쓸 때. */
  readonly toolNames?: readonly string[];
  readonly maxTurns: number;
  systemPrompt(project: Project, mapIds: readonly string[], task: string): string[];
}

export const ORCHESTRATOR_TOOL_NAMES = ["get_map_region", "get_database_records", "run_lint"] as const;

export const PI_TEAM_ROLES: Record<PiTeamRoleId, PiTeamRole> = {
  orchestrator: {
    id: "orchestrator",
    label: "팀장",
    toolNames: [...ORCHESTRATOR_TOOL_NAMES],
    maxTurns: 14,
    systemPrompt(project, mapIds, task) {
      const candidates = mapIds.length > 0
        ? ["이번 작업에 쓸 수 있는 맵:", ...describeScopedMaps(project, mapIds)]
        : ["프로젝트의 맵:", ...describeScopedMaps(project, Object.keys(project.maps))];
      return [
        "너는 웹 JRPG 메이커 시공 팀의 팀장이다. 직접 시공하지 않는다. 지시를 맵 단위 작업으로 쪼개 시공 에이전트에게 맡기고, 결과를 검수 에이전트로 확인한다.",
        ...candidates,
        "절차:",
        "1. 필요하면 get_map_region 으로 현황을 짧게 본다(맵당 한 번, 넓은 영역 한 번).",
        "2. assign_map_agent 를 **한 턴에 여러 개** 호출해 맵마다 시공 에이전트를 병렬로 띄운다. 각 호출의 task 는 그 맵에서 할 일을 구체적으로 적는다(위치·크기·재료 기본값을 네가 정한다).",
        "3. 시공 결과가 돌아오면 review_map 으로 맵마다 검수를 시킨다(역시 한 턴에 병렬).",
        "4. 검수에서 문제가 나오면 assign_map_agent 에 수정 작업을 지시한다. 수정은 맵당 최대 2회.",
        "5. 끝나면 finish 에 사람이 읽을 한 문단 보고를 적는다. 사용자에게 되묻지 않는다.",
        `사용자 지시: ${task}`,
      ];
    },
  },
  builder: {
    id: "builder",
    label: "시공",
    maxTurns: 40,
    systemPrompt(project, mapIds) {
      return [
        ...buildPiAgentSystemPrompt(project, mapIds),
        "너는 팀의 시공 에이전트다. 팀장이 준 작업만 하고, 끝나면 무엇을 어디에 만들었는지 좌표와 함께 한두 문장으로 보고한다.",
      ];
    },
  },
  reviewer: {
    id: "reviewer",
    label: "검수",
    readOnly: true,
    maxTurns: 10,
    systemPrompt(project, mapIds) {
      return [
        "너는 팀의 검수 에이전트다. 읽기 도구만 있다. 아무것도 고치지 않는다.",
        ...describeScopedMaps(project, mapIds),
        "get_map_region 과 run_lint(reachability 포함)로 작업 결과를 확인한다: 요청한 구조물이 실제로 있는가, 길이 이어지는가, 집과 길이 겹치지 않는가, lint error 가 없는가.",
        "확인이 끝나면 반드시 report_review 를 한 번 호출한다. ok 는 문제가 없을 때만 true. findings 에는 고쳐야 할 점을 좌표와 함께 짧게 적는다(없으면 빈 배열).",
      ];
    },
  },
};

export function teamRoleSummaries(): { id: PiTeamRoleId; label: string }[] {
  return (Object.keys(PI_TEAM_ROLES) as PiTeamRoleId[]).map((id) => ({ id, label: PI_TEAM_ROLES[id].label }));
}
