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

export function defaultTerms(): Required<Terms> {
  return {
    attack: "공격",
    skill: "스킬",
    item: "아이템",
    capture: "포획",
    back: "뒤로",
    target: "대상",
    shopGreeting: "어서 오세요.",
    shopBuy: "구입",
    shopSell: "판매",
    shopCancel: "취소",
    shopSellPrompt: "무엇을 판매하시겠습니까?",
    innTitle: "여관",
    yes: "예",
    no: "아니오",
    notEnoughGold: "소지금이 부족합니다.",
    gold: "G",
    goldPrefix: "돈 ",
    level: "레벨",
    hp: "HP",
    mp: "MP",
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
    monsterSpecies: battle.monsterSpecies,
    crops: [],
  };
}

export function defaultSystem(): SystemRecords {
  return {
    startActorIds: defaultStarterActorIds(),
    titleResourceId: "easyrpg-title-title1",
    systemResourceId: "easyrpg-system-system",
    battleSystemResourceId: "easyrpg-system2-system2-c",
    initialTroopId: DEFAULT_TROOP_ID,
    battleFlow: "gauge",
    typeChart: {
      types: ["fire", "water", "grass"],
      multipliers: {
        fire: { fire: 0.5, water: 0.5, grass: 2 },
        water: { fire: 2, water: 0.5, grass: 0.5 },
        grass: { fire: 0.5, water: 2, grass: 0.5 },
      },
    },
    titleScreen: defaultTitleScreenSettings(),
  };
}

export function defaultTitleScreenSettings(): TitleScreenSettings {
  return {
    title: "새 프로젝트",
    backgroundResourceId: "easyrpg-title-title1",
    layout: {
      titleX: 160,
      titleY: 70,
      menuX: 160,
      menuY: 118,
    },
    menuLabels: {
      newGame: "새 게임",
      continueGame: "계속",
      quit: "게임 종료",
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
