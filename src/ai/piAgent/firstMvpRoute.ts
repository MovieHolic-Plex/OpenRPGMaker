// 첫 MVP 생성은 팀 실행이 기본이다(오너 결정 2026-11-24, 레인 fix1124-ai-gen): 맵마다 시공 일꾼이 붙고 맵 잠금이 겹침을 막는다.
// 일반 대화·작은 수정은 지금처럼 단일 실행이다. 이 파일은 「이 요청이 첫 MVP 생성인가」 만 정하는 순수 판정이다.
import type { Project } from "@/project/types";
import { isGenrePresetBriefRequest } from "@/ai/genrePresetBrief";
import { wantsWholeGame } from "@/ai/v2/request/readers";
import { isFreshProject } from "@/ai/v2/request/scope";
import { isGoalCommand } from "./goalCommand";

export interface FirstMvpRoute {
  readonly team: boolean;
  readonly why: string;
}

/**
 * 빈 프로젝트(이벤트·엔딩 없음)에서 게임 하나를 만들라는 요청이면 팀으로 돈다.
 * 장르 프리셋 첫 요청은 원래부터 팀이다. /goal 은 자기 경로(장기 캠페인 팀)가 따로 정한다.
 * 몬스터 수집 요청은 classifyPlainPiTurn 의 몬스터 갈래가 단일 제작자로 되돌린다(공유 세계·DB 를 한 명이 쥔다).
 */
export function firstMvpRoute(project: Pick<Project, "maps" | "endings">, text: string): FirstMvpRoute {
  if (isGoalCommand(text)) return { team: false, why: "goal command routes itself" };
  if (!isFreshProject(project as Project)) return { team: false, why: "project already has events or endings" };
  if (isGenrePresetBriefRequest(text)) return { team: true, why: "genre preset first build" };
  if (wantsWholeGame(text)) return { team: true, why: "whole game on a fresh project" };
  return { team: false, why: "not a whole-game request" };
}
