// project/genrePresets.ts
// 장르 프리셋 — system.* 토글만 설정한다. 맵·이벤트·DB 레코드는 만들지 않는다.
// 예외 하나: 몬스터 수집은 손대지 않은 빈 시작 맵을 몬스터 칩셋으로 바꿔 연다(칩셋 계열이 첫 맵에서 정해진다).

import {
  DEFAULT_DAY_END_HOUR,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
} from "@/project/gameTime";
import { applyBattleMethod } from "@/project/battleMethod";
import type { Project } from "@/project/types";
import type { GenrePackId } from "@/project/genrePackId";
import { configureMonsterPresentation } from "@/project/monsterPresentation";
import { markMonsterGenre } from "@/project/genreLock";
import { enableGenreLockSettled } from "@/project/genreLockCharsets";

export type GenrePresetId = GenrePackId;

/**
 * 각 프리셋이 설정하는 값:
 * - monster-collect: genre, monsterCollection, monsterBattleParty, battleParty, battleFlow, 전투 방식 몬스터 대치(battleUiStyle·battleModel), monsterCare
 * - monster-collect: genre, monsterCollection, monsterBattleParty, battleParty, battleFlow, battleUiStyle, battleModel, monsterCare, menuUiStyle, fieldHud, opening (수정되지 않은 기본 오프닝만 비활성)
 * - farm-life: genre, timeSystem, giftSystem, skillSystem
 * - horror-chase: genre 만 설정 (공포 장르는 system.* 토글이 필요 없다)
 * - adventure-jrpg: genre, battleParty, menuUiStyle, companions (비어 있을 때만). 전투 방식은 기본 도트 측면이라 건드리지 않는다.
 */
const MONSTER_START_TILESET_ID = "monster_overworld";

/**
 * 조수와 편집기는 보고 있는 맵의 칩셋 계열을 따른다. 빈 시작 맵이 버들항이면 포켓몬풍 게임의 길·마을이
 * 전부 버들항으로 깔린다(2026-10-06 실측). 그래서 손대지 않은 빈 시작 맵만 몬스터 칩셋 풀밭으로 옮긴다.
 * 사람이 칠했거나 이벤트가 있는 맵, 맵이 여럿인 프로젝트는 그대로 둔다.
 */
/** 손대지 않은 빈 시작 맵 하나뿐이고 몬스터 키트가 있으면 그 맵(옮길 대상), 아니면 undefined. */
function blankStartMapForMonsterKit(project: Project): { map: Project["maps"][string]; kit: Project["tilesets"][string] } | undefined {
  const maps = Object.values(project.maps);
  const map = maps[0];
  const kit = project.tilesets[MONSTER_START_TILESET_ID];
  if (maps.length !== 1 || !map || !kit || map.tilesetId === kit.id || map.events.length) return undefined;
  if (!map.lowerTiles.every(tile => tile === map.lowerTiles[0]) || map.upperTiles.some(tile => tile !== -1)) return undefined;
  if (map.lowerOverlayTiles?.some(tile => tile !== -1) || map.upperOverlayTiles?.some(tile => tile !== -1) || map.shadowBits?.some(Boolean) || map.relief) return undefined;
  return { map, kit };
}

/** 빈 시작 맵을 몬스터 키트로 옮겨야 하는가(이미 옮겼거나 손댄 맵이면 false). */
export function needsMonsterKitStart(project: Project): boolean { return blankStartMapForMonsterKit(project) !== undefined; }

export function openBlankStartOnMonsterKit(project: Project): void {
  const found = blankStartMapForMonsterKit(project);
  if (!found) return;
  found.map.tilesetId = found.kit.id;
  found.map.tileSize = found.kit.tileSize;
  found.map.lowerTiles.fill(0);
}

/**
 * 몬스터 수집 의도(채팅 한 줄·헤드리스 첫 요청)가 들어온 **새 프로젝트**의 기본값: 몬스터 키트로 열고 장르 잠금(monster-collect)을 건다.
 * 손대지 않은 빈 시작 맵 하나뿐인 프로젝트(needsMonsterKitStart)에서만 동작한다 — 맵을 몬스터 키트로 옮긴 뒤 잠금을 걸어 그 맵이 「이전부터 있던 맵」으로 안 잡힌다.
 * 이미 게임이 있는 프로젝트는 건드리지 않는다: 다른 계열 맵이 있으면 사용자가 의도적으로 다른 장르 도구를 쓰는 것이고,
 * 몬스터 맵뿐인데 잠금이 없으면 풀어 둔 것일 수 있다(다음 메시지가 되살리면 해제 경로가 무의미해진다).
 * 다른 장르를 고른 새 프로젝트(system.genre 가 몬스터 수집이 아님)와 이미 다른 잠금(연애 등)이 있는 프로젝트는 키트만 열고 잠그지 않는다.
 * 해제: configure_monster_system(enabled:false) 또는 자료집 시스템 탭의 「장르 칩셋 잠금」(결과·편집 기록에 「장르 잠금 해제됨」이 남는다).
 * 잠금은 캐릭터 칩도 묶는다(2026-10-16): 손대지 않은 기본 주인공이 몬스터 테이밍 트레이너 칩으로 바뀐다(enableGenreLock).
 */
export function applyMonsterIntentStart(project: Project): { readonly opened: boolean; readonly locked: boolean } {
  if (!needsMonsterKitStart(project)) return { opened: false, locked: false };
  openBlankStartOnMonsterKit(project);
  const { genre, genreLock } = project.system;
  const locked = !genreLock && (genre === undefined || genre === "monster-collect") && enableGenreLockSettled(project, "monster-collect");
  // 잠금이 걸린 프로젝트는 선언 장르도 같이 남긴다(프리셋 경로와 같다) — 잠금이 풀려도 「몬스터 수집 게임」이라는 기록은 system.genre 에 있다.
  if (locked) markMonsterGenre(project);
  return { opened: true, locked };
}

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
      openBlankStartOnMonsterKit(project);
      // 장르 잠금(옵트인): 이 프로젝트의 조수·도구가 새 맵에 쓰는 칩셋을 몬스터 계열로 묶는다. 빈 시작 맵을 옮긴 뒤에 켜야 그 맵이 「이전부터 있던 맵」으로 안 잡힌다.
      enableGenreLockSettled(project, "monster-collect");
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
