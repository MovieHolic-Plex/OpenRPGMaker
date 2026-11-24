// 첫 MVP 생성인지와, 그 요청을 팀으로 돌릴지를 정하는 순수 판정이다.
// 2026-11-24 오너 결정(fix1124-ai-gen)으로 첫 MVP 를 팀 실행으로 돌렸으나, 팀 경로는 v1 Pi 팀이라 v2 MVP 규칙(엔딩 없음·끝 지점 mvp_reached·3~5맵 관문)을
// 비켜 갔다(assistant-measure 실측: start-jrpg 단일 16분 합격 → 팀 40분 시간 초과·엔딩 2·끝 지점 없음). 리드 결정(2026-11-24): 팀장이 MVP 규칙을 지킬 때까지
// 첫 MVP 는 v2 단일로 되돌린다. 장르 프리셋 첫 요청은 원래(#4973 전)부터 팀이라 그대로 둔다.
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
 * 빈 프로젝트(이벤트·엔딩 없음)에서 게임 하나를 만들라는 요청은 첫 MVP 다 — v2 단일로 돈다(v2 의 MVP 관문을 지나야 한다).
 * 장르 프리셋 첫 요청만 팀이다. /goal 은 자기 경로(장기 캠페인 팀)가 따로 정한다.
 */
export function firstMvpRoute(project: Pick<Project, "maps" | "endings">, text: string): FirstMvpRoute {
  if (isGoalCommand(text)) return { firstMvp: false, team: false, why: "goal command routes itself" };
  if (!isFreshProject(project as Project)) return { firstMvp: false, team: false, why: "project already has events or endings" };
  if (isGenrePresetBriefRequest(text)) return { firstMvp: true, team: true, why: "genre preset first build" };
  if (wantsWholeGame(text)) return { firstMvp: true, team: false, why: "whole game on a fresh project: v2 single keeps the MVP gates (team path bypasses them)" };
  return { firstMvp: false, team: false, why: "not a whole-game request" };
}
