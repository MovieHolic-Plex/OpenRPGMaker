// 첫 MVP 생성인지와, 그 요청을 팀으로 돌릴지를 정하는 순수 판정이다.
// 첫 MVP 는 팀 실행이다(오너 2026-11-24, #4973). #5054 가 팀 경로가 v2 MVP 규칙(엔딩 없음·끝 지점 mvp_reached·3~5맵)을 비켜 간다는 실측으로 단일로 되돌렸고,
// 팀장 지시문·팀 finish 관문(teamMvp.ts, #5047)이 그 규칙을 지키게 된 뒤 실제 조수 팀 실행 start-jrpg·start-monster 합격으로 다시 켠다.
import type { Project } from "@/project/types";
import { isGenrePresetBriefRequest } from "@/ai/genrePresetBrief";
import { wantsWholeGame } from "@/ai/v2/request/readers";
import { isFreshProject } from "@/ai/v2/request/scope";
import { isGoalCommand } from "./goalCommand";

export interface FirstMvpRoute {
  /** 빈 프로젝트에서 게임 하나를 만드는 첫 요청이다(작업 카드의 «MVP까지 만들었어요» 문구). */
  readonly firstMvp: boolean;
  readonly team: boolean;
  readonly why: string;
}

/**
 * 빈 프로젝트(이벤트·엔딩 없음)에서 게임 하나를 만들라는 요청은 첫 MVP 다 — 팀으로 돈다(팀 finish 가 첫 판 관문을 건다).
 * 장르 프리셋 첫 요청도 팀이다. /goal 은 자기 경로(장기 캠페인 팀)가 따로 정한다.
 */
export function firstMvpRoute(project: Pick<Project, "maps" | "endings">, text: string): FirstMvpRoute {
  if (isGoalCommand(text)) return { firstMvp: false, team: false, why: "goal command routes itself" };
  if (!isFreshProject(project as Project)) return { firstMvp: false, team: false, why: "project already has events or endings" };
  if (isGenrePresetBriefRequest(text)) return { firstMvp: true, team: true, why: "genre preset first build" };
  if (wantsWholeGame(text)) return { firstMvp: true, team: true, why: "whole game on a fresh project: team run with the first-MVP gates (teamMvp.ts)" };
  return { firstMvp: false, team: false, why: "not a whole-game request" };
}
