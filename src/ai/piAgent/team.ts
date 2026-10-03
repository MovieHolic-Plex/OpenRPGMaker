import { teamWorkflowPrompt } from "./teamWorkflows";
import { USER_FACING_REPORT_RULE } from "./userFacingCopy";
// Pi 팀 역할 정의. 하네스처럼 역할마다 프롬프트·툴 범위·모델을 선언하고, 팀장(orchestrator)이
// 그 역할로 하위 에이전트를 띄운다. 순수 모듈 — 실행은 scripts/lib/piTeamRuntime.ts 가 한다.

import type { Project } from "@/project/types";
import { buildPiAgentSystemPrompt, describeScopedMaps } from "./systemPrompt";
import { gameDesignBriefContext } from "@/project/gameDesignBrief";
import type { PiTeamRoleId } from "./protocol";
import { describeTeamMembers, type PiTeamSpec } from "./teamSpec";
import { isGenrePresetBriefRequest } from "@/ai/genrePresetBrief";
import { hasPlayableSegmentSkeleton, playableSegmentContract } from "@/project/playableSegmentContract";

/**
 * 프리셋 첫 생성의 범위. 2026-09-27 실측: 첫 생성에서 시공 팀원 하나가 170턴·입력 3,500만 토큰을 쓰고도 마을 검사를
 * 통과하지 못했고, 다음 실행은 41분이 지나도 끝나지 않았다(맵 17장·이벤트 175개). 사용자가 기다리는 것은
 * 「첫 제작 범위를 플레이해 볼 수 있는 구간」이다 — 넓히는 것은 다음 요청이 한다.
 */
export const PRESET_FIRST_BUILD_RULES = [
  "[첫 생성 범위] 이 요청은 새 프로젝트의 첫 생성이다. 확정 기획의 「첫 제작 범위」를 플레이해 볼 수 있는 가장 작은 구간만 만든다.",
  "- 맵은 그 구간에 꼭 필요한 것만(보통 3~5장: 시작 마을 1, 필드 1, 목표 지점 1, 꼭 필요한 실내). 주민 집 실내를 채우려고 맵을 늘리지 않는다.",
  "- 순서: ① 첫 장면에 필요한 공통 DB·월드 연결 뼈대만 project 작업으로 준비하고 wait_agents ② 사용자가 보는 시작 맵을 먼저 시공 배정하고 나머지 필요한 맵을 배정 ③ 시공이 끝난 뒤 타이틀·오프닝 등 나머지 공통 작업 ④ 검수 한 번 ⑤ finish. 긴 기획·타이틀 이미지 생성·오프닝 연출을 먼저 기다려 시작 맵을 비워 두지 않는다. project 쓰기와 map 쓰기를 동시에 배정하지 않는다.",
  "- 시작 맵 담당에게 첫 화면의 실제 바닥·길·첫 상호작용을 작은 도구 작업부터 반영하도록 구체적으로 지시한다. 임의 타일 번호나 원치 않는 주인공으로 화면을 채우지 않는다. 각 성공한 쓰기가 실시간 체크포인트로 전달되는 실행 경로를 사용하고 가짜 완료를 보고하지 않는다.",
  "- 검수 지적 수정은 플레이를 막는 문제(길이 막힘·문 없음·필수 이벤트 누락)만 맡긴다. 장식·밀도 개선은 finish 보고의 「다음에 할 일」로 넘긴다.",
  "- finish 보고에는 만든 것, 바로 플레이해 볼 순서, 다음에 늘릴 것 세 가지를 적는다.",
] as const;
/** 프리셋 첫 생성에서 팀원 한 명이 쓰는 턴 상한. 기본(200~300)의 절반 아래 — 구간이 작으니 한 배정이 길 이유가 없다. */
export const PRESET_FIRST_BUILD_MEMBER_TURNS = 120;

export interface PiTeamRole {
  readonly id: PiTeamRoleId;
  readonly label: string;
  /** 비우면 레지스트리 전부. */
  readonly toolDomains?: readonly string[];
  readonly readOnly?: boolean;
  /** 팀장처럼 소수 툴만 집어 쓸 때. */
  readonly toolNames?: readonly string[];
  readonly maxTurns: number;
  systemPrompt(project: Project, mapIds: readonly string[], task: string, team?: PiTeamSpec, currentMapId?: string | null): string[];
}

export const ORCHESTRATOR_TOOL_NAMES = ["get_map_region", "get_database_records", "run_lint"] as const;

export const PI_TEAM_ROLES: Record<PiTeamRoleId, PiTeamRole> = {
  orchestrator: {
    id: "orchestrator",
    label: "팀장",
    toolNames: [...ORCHESTRATOR_TOOL_NAMES],
    // 배정과 수령이 갈리면서 턴이 늘었다(assign → check/wait → review → 수정 → finish).
    maxTurns: 100,
    systemPrompt(project, mapIds, task, team, currentMapId) {
      const candidates = mapIds.length > 0
        ? ["이번 작업에 쓸 수 있는 맵:", ...describeScopedMaps(project, mapIds)]
        : ["프로젝트의 맵:", ...describeScopedMaps(project, Object.keys(project.maps))];
      // 사용자가 보고 있는 맵이 기본 대상이다. 후보를 제한한 사용자(`/pi team a,b`)의 뜻이 우선이라 후보 밖이면 말하지 않는다.
      const here = currentMapId && project.maps[currentMapId] && (mapIds.length === 0 || mapIds.includes(currentMapId))
        ? [
          "사용자가 지금 보고 있는 맵(기본 대상):",
          ...describeScopedMaps(project, [currentMapId]),
          "지시가 다른 맵을 지목하지 않으면 이 맵에서 일한다. 「여기」「이 맵」「현재 맵」은 이 맵을 뜻한다.",
        ]
        : [];
      return [
        "너는 웹 JRPG 메이커 시공 팀의 팀장이다. 직접 시공하지 않는다. 지시를 설계·맵·이벤트·DB·텍스트 작업으로 쪼개 팀원에게 맡기고, 결과를 검수 팀원으로 확인한다.",
        USER_FACING_REPORT_RULE,
        ...(project.gameDesignBrief ? [gameDesignBriefContext(project.gameDesignBrief)] : []),
        ...here,
        ...candidates,
        ...(team ? describeTeamMembers(team) : []),
        "팀원은 소개에 맞는 일만 맡긴다(예: 장식 팀원에게 집을 짓게 하지 않는다). member 를 비우면 첫 시공 팀원이 맡는다.",
        ...(team?.orchestratorNotes.trim() ? [`사용자의 팀 운영 지침: ${team.orchestratorNotes.trim()}`] : []),
        ...teamWorkflowPrompt(),
        ...(isGenrePresetBriefRequest(task) ? PRESET_FIRST_BUILD_RULES : []),
        ...(hasPlayableSegmentSkeleton(project) ? [playableSegmentContract(project)] : []),
        "절차:",
        "1. 필요하면 get_map_region 으로 현황을 짧게 본다(맵당 한 번, 넓은 영역 한 번).",
        "2. assign_map_agent 를 **한 턴에 여러 개** 호출해 맵마다 시공 팀원을 띄운다. 이 툴은 배정만 하고 곧바로 돌아온다 — 팀원은 뒤에서 계속 일한다. 각 호출의 task 는 그 맵에서 할 일을 구체적으로 적는다(위치·크기·재료 기본값을 네가 정한다).",
        "3. **같은 맵에는 한 번에 한 명만** 붙는다. 시공 → 장식처럼 한 맵을 이어서 맡겨야 하면 wait_agents 로 앞 팀원이 끝난 것을 확인한 뒤 다음을 배정한다. 진행 중인 맵에 또 배정하면 거절당한다.",
        "4. 도는 동안 check_agents 로 중간을 본다(기다리지 않는다). 팀원이 헤매거나 협의가 필요하면 send_team_message로 실행 중인 담당자에게 직접 지시·답변한다. 결과가 필요하면 wait_agents로 받되, 메시지 때문에 일찍 돌아오면 read_team_messages로 읽고 답한다.",
        "5. 맵의 시공이 끝났으면 review_map 으로 검수를 시킨다(한 턴에 여러 맵 가능). 아직 작업 중인 맵은 검수가 거절된다 — wait_agents 를 먼저 부른다. 검수 팀원이 없으면 건너뛴다.",
        "6. 검수에서 문제가 나오면 assign_map_agent 로 수정 작업을 지시한다. 수정은 맵당 최대 2회이며, 업무 배정과는 예산이 따로다.",
        "7. 끝나면 finish 에 사람이 읽을 한 문단 보고를 적는다. 진행 중인 배정이 있으면 finish 가 거절하니 wait_agents 를 먼저 부른다. 사용자에게 되묻지 않는다.",
        `사용자 지시: ${task}`,
      ];
    },
  },
  builder: {
    id: "builder",
    label: "시공",
    maxTurns: 200,
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
    maxTurns: 50,
    systemPrompt(project, mapIds) {
      return [
        "너는 팀의 검수 에이전트다. 읽기 도구만 있다. 아무것도 고치지 않는다.",
        USER_FACING_REPORT_RULE,
        ...(project.gameDesignBrief ? [gameDesignBriefContext(project.gameDesignBrief)] : []),
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
