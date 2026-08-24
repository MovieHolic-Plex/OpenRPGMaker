// project/genrePresets.ts
// 장르 프리셋 — system.* 토글만 설정한다. 맵·이벤트·DB 레코드는 만들지 않는다.

import {
  DEFAULT_DAY_END_HOUR,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
} from "@/project/gameTime";
import type { Project } from "@/project/types";
import type { GenrePackId } from "@/project/genrePackId";

export type GenrePresetId = GenrePackId;

/**
 * 각 프리셋이 설정하는 값:
 * - monster-collect: genre, monsterCollection, monsterBattleParty, battleUiStyle, battleModel, monsterCare
 * - farm-life: genre, timeSystem, giftSystem, skillSystem
 * - horror-chase: genre 만 설정 (공포 장르는 system.* 토글이 필요 없다)
 */
export function applyGenrePreset(project: Project, id: GenrePresetId): void {
  const { system } = project;
  system.genre = id;
  switch (id) {
    case "monster-collect":
      system.monsterCollection = true;
      system.monsterBattleParty = true;
      system.battleUiStyle = "pokemon";
      system.battleModel = "gen1";
      system.monsterCare = { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 };
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
    case "story-cutscene":
      break;
  }
}

const WELCOME_TO_GENRE: Readonly<Record<string, GenrePresetId>> = {
  "monster-collect": "monster-collect",
  "farm-life": "farm-life",
  "horror-gallery": "horror-chase",
  "school-horror": "horror-chase",
  "partner-raise": "monster-collect",
  "adventure-jrpg": "adventure-jrpg",
  "story-cutscene": "story-cutscene",
};

/**
 * 환영 화면의 presetId 를 GenrePresetId 로 매핑한다.
 * 매핑이 없는 presetId (partner-raise, adventure-jrpg, story-cutscene 등)는 undefined.
 */
export function welcomePresetToGenrePreset(presetId: string | undefined): GenrePresetId | undefined {
  return presetId ? WELCOME_TO_GENRE[presetId] : undefined;
}
