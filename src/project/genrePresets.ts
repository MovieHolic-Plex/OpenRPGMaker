// project/genrePresets.ts
// 장르 프리셋 — system.* 토글만 설정한다. 맵·이벤트·DB 레코드는 만들지 않는다.

import {
  DEFAULT_DAY_END_HOUR,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
} from "@/project/gameTime";
import { applyBattleMethod } from "@/project/battleMethod";
import type { Project } from "@/project/types";
import type { GenrePackId } from "@/project/genrePackId";
import { configureMonsterPresentation } from "@/project/monsterPresentation";

export type GenrePresetId = GenrePackId;

/**
 * 각 프리셋이 설정하는 값:
 * - monster-collect: genre, monsterCollection, monsterBattleParty, battleParty, battleFlow, 전투 방식 몬스터 대치(battleUiStyle·battleModel), monsterCare
 * - monster-collect: genre, monsterCollection, monsterBattleParty, battleParty, battleFlow, battleUiStyle, battleModel, monsterCare, menuUiStyle, fieldHud, opening (수정되지 않은 기본 오프닝만 비활성)
 * - farm-life: genre, timeSystem, giftSystem, skillSystem
 * - horror-chase: genre 만 설정 (공포 장르는 system.* 토글이 필요 없다)
 * - adventure-jrpg: genre, battleParty, menuUiStyle, companions (비어 있을 때만). 전투 방식은 기본 도트 측면이라 건드리지 않는다.
 */
export function applyGenrePreset(project: Project, id: GenrePresetId): void {
  const { system } = project;
  system.genre = id;
  switch (id) {
    case "action-rpg":
      system.actionCombat = { ...system.actionCombat, enabled: true };
      break;
    case "monster-collect":
      system.monsterCollection = true;
      system.monsterBattleParty = true;
      system.battleParty = "monsters";
      system.battleFlow = "strict";
      // 화면과 규칙을 따로 쓰지 않고 전투 방식 하나로 맞춘다(battleMethod.ts).
      applyBattleMethod(project, "monster");
      system.monsterCare = { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 };
      configureMonsterPresentation(project);
      break;
    case "farm-life":
      system.timeSystem = {
        enabled: true,
        minutesPerRealSecond: DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
        dayStartHour: DEFAULT_DAY_START_HOUR,
        dayEndHour: DEFAULT_DAY_END_HOUR,
        daysPerSeason: 28,
      };
      system.giftSystem = true;
      system.skillSystem = { enabled: true };
      break;
    case "horror-chase":
      // 공포 장르는 구분되는 엔진 기능(조명·추격·세이브 제한)이 맵/이벤트 수준 저작이므로
      // system.* 토글이 필요 없다. 없는 토글을 발명하지 않는다.
      break;
    case "adventure-jrpg":
      // 파티 모험 JRPG 의 결정론 기본값(2026-09-26). 예전엔 장르 라벨만 박혀 ⚙(AI 없이) 결과가
      // 빈 프로젝트와 같았다. 열린 프로젝트에 적용될 때 저작자가 고른 값은 덮지 않는다(??=).
      system.battleParty ??= "actors";
      // 전투 화면은 기본 도트 측면(retro2003, 저장하지 않음) — 2026-10-02 측면 스킨을 하나로 줄였다.
      system.menuUiStyle ??= "party-first";
      system.companions ??= { maxCompanions: 3, formation: "line" };
      break;
    case "story-cutscene":
      break;
  }
}
