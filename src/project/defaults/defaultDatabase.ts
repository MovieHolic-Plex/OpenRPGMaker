import type { ProjectDatabaseRecords, ProjectSession, SystemRecords, Terms, TitleScreenSettings } from "../types";
import { defaultBattleRecords } from "./defaultDatabaseBattleRecords";
import { defaultPartyRecords, defaultStarterActorIds } from "./defaultDatabasePartyRecords";
import {
  defaultBattleAnimationRecords,
  defaultBattlerAnimationRecords,
  defaultItemRecords,
  defaultSkillRecords,
  defaultStateRecords,
} from "./defaultDatabaseStarterRecords";
import {
  defaultBattleCommandRecords,
  defaultElementRecords,
  defaultTerrainRecords,
} from "./defaultDatabaseUtilityRecords";
import { DEFAULT_TROOP_ID } from "./constants";

export function defaultTerms(): Terms {
  return {
    gold: "G",
    level: "레벨",
    hp: "HP",
    mp: "MP",
    attack: "공격",
    skill: "스킬",
    item: "아이템",
  };
}

export function defaultDatabase(): ProjectDatabaseRecords {
  const party = defaultPartyRecords();
  const battle = defaultBattleRecords();

  return {
    actors: party.actors,
    classes: party.classes,
    skills: defaultSkillRecords(),
    items: defaultItemRecords(),
    equipment: party.equipment,
    enemies: battle.enemies,
    troops: battle.troops,
    states: defaultStateRecords(),
    battleAnimations: defaultBattleAnimationRecords(),
    elements: defaultElementRecords(),
    terrains: defaultTerrainRecords(),
    battleCommands: defaultBattleCommandRecords(),
    battlerAnimations: defaultBattlerAnimationRecords(),
  };
}

export function defaultSystem(): SystemRecords {
  return {
    startActorIds: defaultStarterActorIds(),
    titleResourceId: "rpg-zzu-title-blue",
    systemResourceId: "easyrpg-system-system",
    battleSystemResourceId: "easyrpg-system2-system2-c",
    initialTroopId: DEFAULT_TROOP_ID,
    titleScreen: defaultTitleScreenSettings(),
  };
}

export function defaultTitleScreenSettings(): TitleScreenSettings {
  return {
    title: "새 프로젝트",
    backgroundResourceId: "rpg-zzu-title-blue",
    layout: {
      titleX: 160,
      titleY: 70,
      menuX: 122,
      menuY: 118,
    },
    menuLabels: {
      newGame: "새 게임",
      continueGame: "계속",
      quit: "게임 중지",
    },
  };
}

export function defaultSession(): ProjectSession {
  return {
    switches: {},
    variables: {},
    inventory: {},
    partyActorIds: defaultStarterActorIds(),
  };
}
