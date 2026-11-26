// 첫 MVP 생성인지와, 그 요청을 팀으로 돌릴지를 정하는 순수 판정이다.
// 2026-11-24 에 팀 경로가 v2 MVP 규칙(엔딩 없음·끝 지점 mvp_reached·3~5맵)을 비켜 가 단일로 되돌렸다. 2026-11-26 team-mvp-revive-r3 에서
// 팀이 세계 뼈대를 런타임 생성기로 미리 짓고(teamMvpPrebuild.ts) 첫 MVP 관문을 지키게 되어 다시 팀이다 — 몬스터 수집만 단일.
// 장르 프리셋 첫 요청은 원래(#4973 전)부터 팀이다.
import type { Project } from "@/project/types";
import { isGenrePresetBriefRequest } from "@/ai/genrePresetBrief";
import { wantsWholeGame } from "@/ai/v2/request/readers";
import { isFreshProject } from "@/ai/v2/request/scope";
import { isGoalCommand } from "./goalCommand";
import { isMonsterRequestTurn } from "./monsterGameRequest";

export interface FirstMvpRoute {
  /** 빈 프로젝트에서 게임 하나를 만드는 첫 요청이다(작업 카드의 «MVP까지 만들었어요» 문구). */
  readonly firstMvp: boolean;
  readonly team: boolean;
  readonly why: string;
}

/**
 * 빈 프로젝트(이벤트·엔딩 없음)에서 게임 하나를 만들라는 요청은 첫 MVP 다 — 팀으로 돈다(몬스터 수집은 v2 단일).
 * 장르 프리셋 첫 요청도 팀이다. /goal 은 자기 경로(장기 캠페인 팀)가 따로 정한다.
 */
export function firstMvpRoute(project: Pick<Project, "maps" | "endings"> & { readonly system?: Pick<Project["system"], "genre"> }, text: string): FirstMvpRoute {
  if (isGoalCommand(text)) return { firstMvp: false, team: false, why: "goal command routes itself" };
  if (!isFreshProject(project as Project)) return { firstMvp: false, team: false, why: "project already has events or endings" };
  if (isGenrePresetBriefRequest(text)) return { firstMvp: true, team: true, why: "genre preset first build" };
  // 2026-11-26 team-mvp-revive-r3: 팀이 세계 뼈대를 런타임 생성기로 짓고(teamMvpPrebuild.ts) 첫 MVP 관문을 지키며 단일보다 빨랐다 — 몬스터 수집은 자기 캐페인 경로라 단일을 유지한다.
  if (wantsWholeGame(text)) {
    const monster = project.system?.genre === "monster-collect" || isMonsterRequestTurn(text);
    return monster
      ? { firstMvp: true, team: false, why: "monster-collect first build stays on the v2 single campaign path" }
      : { firstMvp: true, team: true, why: "whole game on a fresh project: team prebuilds the world and keeps the first-MVP gates" };
  }
  return { firstMvp: false, team: false, why: "not a whole-game request" };
}
