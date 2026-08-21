import type { ProjectDatabaseRecords, ProjectSession, SystemRecords, Terms, TitleScreenSettings } from "../types";
import { STARTER_BATTLE_BGM_ID, STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { defaultBattleRecords } from "./defaultDatabaseBattleRecords";
import { defaultPartyRecords, defaultStarterActorIds } from "./defaultDatabasePartyRecords";
import {
  defaultBattleAnimationRecords,
  defaultSkillRecords,
  defaultStateRecords,
} from "./defaultDatabaseStarterRecords";
import { defaultItemRecords } from "./defaultDatabaseItemRecords";
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
    monsterSpecies: battle.monsterSpecies,
    crops: [],
    lifeSkills: [],
  };
}

export function defaultSystem(): SystemRecords {
  return {
    startActorIds: defaultStarterActorIds(),
    titleResourceId: "oprn-title-field",
    // CSS-ready 9-slice windowskin. EasyRPG System/*.png is a chrome sheet (orange key + icons), not a windowskin.
    systemResourceId: "windowskin-rm2003",
    // System2 stays as gauge/number chrome only — never used as border-image fill.
    battleSystemResourceId: "easyrpg-system2-system2-c",
    // EasyRPG RTP 음악 30곡은 전부 .mid 다 — 브라우저 HTMLAudioElement 는 MIDI 를 재생하지 못한다.
    // 그래서 easyrpg-music-* 을 기본값으로 두면 게임이 무음으로 돌아간다(실측). CC0 mp3/ogg 를 쓴다.
    //
    // 기본 BGM 세트는 281곡 CC0 카탈로그(bgmCatalog.ts)에서 고른다. 이 두 슬롯이 쓰는 곡은
    // CDN 미설정 환경에서도 들려야 하므로 레포에 함께 커밋된 스타터 곡이다(bgmStarterTracks.ts).
    battleBgmResourceId: STARTER_BATTLE_BGM_ID,
    defaultBgmResourceId: STARTER_DEFAULT_BGM_ID,
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
    backgroundResourceId: "oprn-title-field",
    // 타이틀 BGM 은 의도적으로 비워 둔다("silent title" — test/titleScreenMusic.test.ts 가 계약으로 못박음).
    // 카탈로그에 타이틀·메뉴 곡이 있으므로 저작자는 피커에서 한 번에 고르면 된다.
    // 후보: cc0-bgm-rtp-ttl-001(새벽의 의뢰서), cc0-bgm-rtp-uix-001..005(UI · 첫 조작).
    layout: {
      titleX: 160,
      titleY: 92,
      menuX: 160,
      menuY: 148,
    },
    menuLabels: {
      newGame: "새 게임",
      continueGame: "계속",
      quit: "게임 종료",
    },
    menuVisibility: {
      newGame: true,
      continueGame: true,
      quit: true,
    },
    // Crest logo over night-field title art (scripts/generate-system-title-art.mts when available).
    titleGraphic: {
      mode: "both",
      resourceId: "oprn-title-logo-crest",
      x: 160,
      y: 42,
    },
    showInputHint: true,
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
