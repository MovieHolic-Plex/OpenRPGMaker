import type {
  ActorId,
  AssetRef,
  BattleAnimationId,
  CharacterFootprint,
  Dir,
  EquipmentId,
  FlagName,
  ItemId,
  MapId,
  MonsterInstanceId,
  MonsterSpeciesId,
  SkillId,
  TroopId,
} from "./base";
import type { Season, TimePhase } from "../gameTime";
import type { FieldSpawnDef } from "./project";
import type { RoguelikeRunCondition } from "../roguelikeRun";
import type { RelationshipCondition, RelationshipState } from "../relationshipState";
import type { EmoteKind } from "@/project/emotes";


/**
 * 오디오 명령이 겨누는 채널. `project/session` 의 `AudioChannel` 과 같은 집합이며
 * 그쪽이 이 타입을 재수출한다(선언은 여기 하나뿐).
 */
export type AudioCommandChannel = "bgm" | "bgs" | "me" | "se";

export type Trigger =
  | { kind: "action" }
  | { kind: "touch" }
  | { kind: "playerTouch" }
  | { kind: "eventTouch" }
  | { kind: "auto" }
  | { kind: "parallel" }
  /**
   * 주인공이 같은 맵의 명명 로케이션에 **들어오거나 나갈 때** 한 번 실행한다.
   * 사각형을 여기 복사하지 않는다 — `GameMap.locations` 의 기하를 가리키므로 구역을 옮기면
   * 발동 범위도 따라온다(`insideLocation` 조건과 같은 규칙, 같은 해석자).
   * 판정은 `project/locationTransitions.ts` 하나가 갖고, 세션의 점유 기록
   * (`PlaySession.occupiedLocationIds`) 이 «직전에 안에 있었나» 를 세이브 너머로 기억한다.
   */
  | { kind: "locationTransition"; locationId: string; transition: "enter" | "leave" };

/**
 * 매개변수가 없는 트리거 종류. `{ kind }` 만으로 트리거를 지을 수 있는 곳
 * (콘텐자 마만로 생산기, 허스트 콜러서, 트리거 마묵이 보)은 이 집합을 쓴다 —
 * `locationTransition` 은 로케이션 ID 와 방향이 있어야 성립하므로 그 생산기로 만들 수 없다.
 */
export type SimpleTriggerKind = Exclude<Trigger, { kind: "locationTransition" }>["kind"];

export type StorageChestTemplate = "farm" | "warehouse" | "vault";
export type StorageChestLayout = "center" | "bottom" | "wide";

export type SelfSwitchKey = "A" | "B" | "C" | "D";

// 조건 분기(fork)에서 사용하는 조건. 페이지 출현 조건(EventPageCondition)의 상위 집합.
// all/any/not 은 복합 조건 그룹(모던 확장). 리프 조건은 RM 계열 + 호감/시간 등.
export type Condition =
  | { kind: "switch"; switchId: string; value: boolean }
  | {
      kind: "variable";
      variableId: string;
      op: "==" | ">=" | "<=" | ">" | "<" | "!=";
      value: number;
    }
  | { kind: "selfSwitch"; key: SelfSwitchKey; value: boolean }
  | { kind: "actor"; actorId: ActorId; present: boolean }
  | { kind: "monsterSpecies"; speciesId: MonsterSpeciesId; present: boolean }
  | { kind: "item"; itemId: ItemId; present: boolean }
  | { kind: "gold"; op: ">=" | "<=" | ">" | "<" | "==" | "!="; amount: number }
  | { kind: "timer"; timerId: "timer1" | "timer2"; seconds: number }
  | { kind: "timePhase"; phase: TimePhase }
  | { kind: "season"; season: Season }
  | { kind: "npcActivity"; activity: string }
  /**
   * 주인공이 같은 맵의 명명 로케이션 안(또는 밖)에 있는가.
   * `inside: true` = 안에 있을 때 참, `false` = 밖에 있을 때 참.
   * 로케이션 기하는 `GameMap.locations` 가 소유하므로 좌표를 여기에 복사하지 않는다 —
   * 로케이션을 옮기거나 넓히면 이 조건도 함께 따라온다.
   * 평가에는 로케이션 해석자가 필요하다(`evalCondition` 의 `context.locations`).
   */
  | { kind: "insideLocation"; locationId: string; inside: boolean }
  | { kind: "friendshipAtLeast"; npcKey?: string; value: number }
  | RelationshipCondition
  | { kind: "battleResult"; result: "victory" | "defeat" | "escape" }
  | ActorQueryCondition
  | RoguelikeRunCondition
  /** 현재 난이도(system.difficulties 의 id)가 이것일 때 참. 난이도 목록이 없는 프로젝트에서는 항상 거짓. */
  | { kind: "difficulty"; difficultyId: string }
  /**
   * 메뉴에서 아이템을 «바라보는 이벤트에 사용»해 이 페이지가 발동됐고 그 아이템이 itemId 일 때 참.
   * 평소 조사·접촉 발동에서는 거짓이다 — 아이템 사용 전용 페이지를 만든다.
   */
  | { kind: "itemUsed"; itemId: ItemId }
  | { kind: "all"; conditions: Condition[] }
  | { kind: "any"; conditions: Condition[] }
  | { kind: "not"; condition: Condition };

export type EventPageCondition = Condition;

/** 비교 연산자(조건 공통). */
export type ConditionCompareOp = "==" | ">=" | "<=" | ">" | "<" | "!=";

/**
 * 명작 공백 G1(2026-09-27): 이벤트가 액터·파티·시점·회차·요일·문자열을 직접 읽는 조건.
 * `actorId: "leader"` 는 파티 선두다. 해석할 수 없는 대상(파티에 없는 배우·빈 파티)은 거짓.
 */
export type ActorQueryCondition =
  | { kind: "actorStat"; actorId: ActorId | "leader"; stat: "level" | "hp" | "mp" | "hpPercent" | "mpPercent"; op: ConditionCompareOp; value: number }
  | { kind: "actorState"; actorId: ActorId | "leader" | "anyone"; stateId: string; present: boolean }
  | { kind: "partyLeader"; actorId: ActorId }
  | { kind: "partySize"; op: ConditionCompareOp; value: number }
  /** subject=player: 주인공이 dir 을 본다. subject=event: 이 이벤트가 dir 을 본다. */
  | { kind: "facing"; subject: "player" | "event"; dir: Dir }
  /**
   * 주인공과 이 이벤트의 상대 자세.
   * playerBehindEvent = 주인공이 이벤트 등 뒤에 있다(몰래 다가가기),
   * eventBehindPlayer = 이벤트가 주인공 등 뒤에 있다,
   * playerFacingEvent = 주인공이 이 이벤트 쪽을 보고 있다(안 볼 때만 움직이는 조각상은 not 으로 감싼다).
   */
  | { kind: "relativeFacing"; relation: "playerBehindEvent" | "eventBehindPlayer" | "playerFacingEvent" }
  | { kind: "hiding"; value: boolean }
  /** 추격자 추격 중 여부. eventId 생략 = 누구든. */
  | { kind: "pursuitActive"; eventId?: string; value: boolean }
  /** 이 기기에서 엔딩을 본 횟수(서로 다른 엔딩 수가 아니라 클리어 횟수). */
  | { kind: "clearCount"; op: ConditionCompareOp; value: number }
  | { kind: "endingSeen"; endingId: string; value: boolean }
  | { kind: "newGamePlus"; value: boolean }
  /** 게임 달력 요일. 0=일 … 6=토. 시계가 없으면 거짓. */
  | { kind: "weekday"; weekdays: number[] }
  | { kind: "stringVariable"; stringVariableId: string; op: "==" | "!=" | "contains" | "empty"; value: string };

export interface ConditionV1 {
  kind: "flag";
  flag: FlagName;
  value: boolean;
}

export interface MoveRoute {
  moves: MoveCommand[];
  repeat: boolean;
  // 완료까지 인터프리터를 블로킹할지(기본 false: fire-and-forget).
  wait?: boolean;
  // 이동 불가 시 경로를 건너뛸지.
  skippable?: boolean;
}

export type MoveCommand =
  | { kind: "move"; dir: Dir }
  | { kind: "moveDiagonal"; horizontal: "left" | "right"; vertical: "up" | "down" }
  | { kind: "moveRandom" }
  | { kind: "moveTowardPlayer" }
  | { kind: "moveAwayFromPlayer" }
  | { kind: "stepForward" }
  /** 포물선 점프. dx/dy 가 0 이면 바라보는 방향으로 2 칸. heightPx 는 최고점(기본 12px). */
  | { kind: "jump"; dx: number; dy: number; heightPx?: number; durationMs?: number; se?: string }
  /** 화면 위에서 떨어지는 등장(보스 강림). 타일 이동 없이 heightPx 에서 접지까지 낙하한다. */
  | { kind: "dropIn"; heightPx?: number; durationMs?: number; se?: string; impact?: boolean }
  | { kind: "land" }
  | { kind: "turn"; dir: Dir }
  | { kind: "turnRelative"; turn: "right90" | "left90" | "turn180" | "leftOrRight90" }
  | { kind: "turnRandom" }
  | { kind: "turnTowardPlayer" }
  | { kind: "turnAwayFromPlayer" }
  | { kind: "setDirectionFix"; enabled: boolean }
  | { kind: "setThrough"; enabled: boolean }
  | { kind: "setAnimation"; enabled: boolean }
  | { kind: "changeOpacity"; delta: number }
  | { kind: "setSwitch"; switchId: string; value: boolean }
  | { kind: "changeSpeed"; delta: number }
  | { kind: "changeFrequency"; delta: number }
  | { kind: "changeGraphic"; spriteId: string }
  | { kind: "npcTransfer"; mapId: MapId; x: number; y: number; direction?: Dir }
  | { kind: "playSe"; resourceId: string }
  | { kind: "wait" };

export type VariableOperand = number | { kind: "var"; id: string };
/** 스위치 조작 값. true/false 고정, toggle, 또는 변수(0=OFF / 비0=ON). */
export type SwitchValue =
  | boolean
  | "toggle"
  | { kind: "var"; id: string };
export type M2CommandValue = string | number | boolean;
export type M2CommandFields = Record<string, M2CommandValue>;
export type ShopType = "normal" | "buyOnly" | "sellOnly" | "repair" | "appraisal" | "pawn" | "blackMarket" | "consignment";
/** Runtime shop surface selected by the author in the event/database editor. */
export type ShopUiPreset = "classic" | "tabs" | "grid" | "compare" | "split" | "cart" | "stock" | "story" | "baram";
export type ShopMessageType = "welcome" | "business" | "direct" | "festival" | "closingSale" | "vip";
export type ShopServiceKind = "repair" | "appraisal" | "pawn";
export type ShopRestockPolicy = "daily" | "weekly" | "onDemand";
export interface ShopLoyaltyTier { readonly id: string; readonly name: string; readonly minSpend: number; readonly discountRate: number; readonly perks?: readonly string[]; }
export interface ShopHaggleConfig {
  readonly patience?: number;
  readonly insultRatio?: number;
  readonly maxDiscount?: number;
  readonly skillId?: string;
}
export interface ShopEconomyConfig {
  readonly dynamicPricing?: boolean;
  readonly haggleEnabled?: boolean;
  readonly closingSaleEnabled?: boolean;
  readonly inflationFactor?: number;
  readonly tradeRouteMarkup?: Record<string, number>;
  readonly haggle?: ShopHaggleConfig;
  readonly shopkeeperEnabled?: boolean;
}
export interface ShopBuybackEntry { readonly itemId: string; readonly price: number; readonly expiresAtDayKey?: string; }
export interface ShopCartLine { readonly itemId: string; readonly qty: number; readonly unitPrice: number; }
export interface ShopConsignment { readonly id: string; readonly itemId: string; readonly askPrice: number; readonly consignorSwitchId?: string; readonly listedDayKey: string; }
export interface ShopDonationLedger { readonly totalDonated: number; readonly lastDonorSwitchId?: string; }
export type GiftPreferenceRank = "loved" | "liked" | "neutral" | "disliked";
export interface GiftPrefs {
  readonly loved?: readonly ItemId[];
  readonly liked?: readonly ItemId[];
  readonly disliked?: readonly ItemId[];
}
export interface GiftResponses {
  readonly loved?: string;
  readonly liked?: string;
  readonly neutral?: string;
  readonly disliked?: string;
  readonly alreadyGifted?: string;
  readonly noItems?: string;
}
export interface ShopStockEntry {
  readonly itemId: ItemId;
  readonly seasons?: readonly Season[];
  readonly priceOverride?: number;
  readonly displayTileId?: number;
  readonly priceBySeason?: Partial<Record<Season, number>>;
}
export interface SocialCalendar {
  /** Gift friendship Δ multiplies on this season+day when session.gameTime is set. */
  readonly birthday?: { readonly season: Season; readonly day: number };
}
export interface CharacterProfile {
  /** Optional UI label (status menu / future pickers). Not a social key. */
  readonly displayName?: string;
  /** Profile birthday used when event.socialCalendar.birthday is absent. */
  readonly birthday?: { readonly season: Season; readonly day: number };
  /** Default gift prefs; event.giftPrefs fully overrides when present. */
  readonly giftPrefs?: GiftPrefs;
  /** Default gift responses; event.giftResponses fully overrides when present. */
  readonly giftResponses?: GiftResponses;
  /** 이 인물이 말할 때의 대화창 스타일·이름색·목소리·빠르기·글꼴 (project/dialogueStyles.ts). */
  readonly dialogue?: import("@/project/dialogueStyles").SpeakerDialogueProfile;
}

/** Merchant-event shop price bridge. Applied via resolveSocialKey when bond >= minFriendship. */
export interface SocialShop {
  readonly minFriendship: number;
  /** Buy-price scale (e.g. 0.8 = 20% off). Sell prices are unchanged. */
  readonly priceMultiplier: number;
}

export type TransferDirection = "retain" | Dir;
export type TransferFade = "black" | "white" | "none";
// 전환 연출 종류. 기본 페이드 외에 모자이크(픽셀화)/블라인드 지원.
export type TransferTransition = "fade" | "mosaic" | "blinds";
export type ActorAmountOp = "=" | "+=" | "-=";
export type ActorEquipmentSlot = string;
export type MessageWindowFormat = "normal" | "transparent";
export type MessageWindowPosition = "top" | "center" | "bottom";
export type ChoiceCancelBehavior = "disallow" | "choice1" | "choice2" | "choice3" | "choice4" | "choice5" | "branch";
export type MessageWindowSettings = {
  readonly format: MessageWindowFormat;
  readonly position: MessageWindowPosition;
  readonly preventObscuringPlayer: boolean;
  readonly allowEventMovementDuringWait: boolean;
};
export type FaceGraphic = {
  /** 낱장 얼굴 리소스 id. 얼굴 한 칸 = 파일 한 장이라 칸 번호가 없다. */
  readonly resourceId: string;
  readonly presentation?: "face" | "bust";
  readonly position: "left" | "right";
  readonly flipHorizontally: boolean;
};

export type LightSourceAnchor =
  | { readonly x: number; readonly y: number }
  | { readonly eventId: string }
  | "player";

export type LightSource = {
  readonly id: string;
  readonly at: LightSourceAnchor;
  readonly radius: number;
  readonly intensity?: number;
  readonly color?: string;
  readonly flicker?: boolean;
};

export type LightingState = {
  readonly ambient: number;
  readonly color?: string;
  readonly sources: readonly LightSource[];
};

export type WeatherKind = "none" | "rain" | "storm" | "snow" | "fog";

export type EmoteTarget = "player" | { readonly eventId: string };

export type ShowAnimationTarget =
  | "player"
  | { readonly eventId: string }
  | { readonly x: number; readonly y: number };

export type Command =
  | {
      kind: "text";
      speaker?: string;
      body: string;
      /** 고급 대화에서 흡수한 감정 태그 (표시/로그용, 기본 neutral). */
      emotion?: string;
      /** true 면 키 입력 없이 다음 단계로 진행. */
      autoAdvance?: boolean;
      /** 이 한 줄만 쓰는 대화창 스타일(DialogueStyleId). 비우면 화자 프로필 → 프로젝트 기본. */
      style?: string;
      /** 이 줄을 말할 때 재생하는 음성 파일(sound/music 리소스). 합성 삑 소리는 내지 않는다. */
      voiceResourceId?: string;
      /** 대사 종류(DialogueContextId): narration·thought·whisper·shout·radio·sign·letter·system. 비우면 일반 대사. */
      context?: string;
      /** 대사 그릇(DialogueContainerId): box·balloon·bark·corner. 비우면 화자 프로필 → 상자. */
      container?: string;
    }
  | ({ kind: "changeFace"; appearanceId?: string } & FaceGraphic)
  | {
      kind: "choices";
      prompt?: string;
      options: { text: string; branch: Command[] }[];
      cancelBehavior?: ChoiceCancelBehavior;
      cancelBranch?: Command[];
    }
  | {
      /**
       * 아이템 제시(증거 들이밀기·물건 보여주기). 소지품에서 하나를 고르게 하고,
       * 고른 아이템이 options 의 itemId 와 맞으면 그 branch, 아니면 otherwiseBranch,
       * 닫거나 보여줄 것이 없으면 cancelBranch 를 실행한다.
       */
      kind: "presentItem";
      prompt?: string;
      /** 목록에 올릴 후보. 생략하면 소지품 전체. 소지하지 않은 후보는 목록에 뜨지 않는다. */
      itemIds?: ItemId[];
      options: { itemId: ItemId; branch: Command[] }[];
      /** 후보이지만 options 에 없는 아이템을 냈을 때. */
      otherwiseBranch?: Command[];
      /** 아무것도 내지 않고 닫았거나 보여줄 후보가 하나도 없을 때. */
      cancelBranch?: Command[];
      /** true 면 맞는 아이템을 냈을 때 1개 소모한다. */
      consume?: boolean;
    }
  | { kind: "fork"; condition: Condition; then: Command[]; else?: Command[] }
  | { kind: "wait"; ms: number; /** 설정 시 이 변수 값(ms)만큼 대기. */ variableId?: string }
  | { kind: "inputWait"; variableId?: string }
  | {
      kind: "inputNumber";
      variableId: string;
      /** 입력 자릿수 상한 (1~6). */
      digits: number;
      /** 창 상단 안내 문구. 비우면 "숫자 입력". */
      prompt?: string;
      /** true 면 0~9 키패드 UI 를 함께 표시. */
      showPad?: boolean;
    }
  | { kind: "label"; name: string }
  | { kind: "gotoLabel"; name: string }
  | { kind: "loop"; body: Command[] }
  | { kind: "breakLoop" }
  | { kind: "setSwitch"; switchId: string; value: SwitchValue }
  | {
      kind: "setVariable";
      variableId: string;
      op: "=" | "+=" | "-=" | "*=" | "/=";
      value: VariableOperand;
    }
  | { kind: "timer"; action: "set" | "start" | "stop"; seconds?: number; timerId?: "timer1" | "timer2" }
  | { kind: "advanceTime"; minutes?: number; hours?: number; days?: number }
  | { kind: "advanceCropGrowth"; days: number }
  | { kind: "setTime"; hour: number; minute?: number }
  | { kind: "sleepUntilMorning" }
  | { kind: "transfer"; mapId: MapId; x: number; y: number; direction?: TransferDirection; fade?: TransferFade; transition?: TransferTransition }
  | { kind: "moveEvent"; eventId: string; route: MoveRoute }
  | { kind: "setEventGraphicPattern"; eventId: string; pattern: number }
  | {
      kind: "changeTile";
      mapId: MapId;
      layer: "lower" | "upper";
      x: number;
      y: number;
      tile: number;
    }
  | { kind: "callCommonEvent"; commonEventId: string }
  | { kind: "callMapEvent"; eventId: string }
  | {
      kind: "battleProcessing";
      troopId: TroopId;
      canEscape: boolean;
      canLose: boolean;
      battleFlow?: "gauge" | "strict";
      /** fixed(기본)=troopId 사용, variable=세션 변수에서 troop id 문자열 조회 */
      troopSource?: "fixed" | "variable";
      troopVariableId?: string;
      /** true면 전투 결과에 따라 victory/defeat/escape 분기 실행 */
      branchOnResult?: boolean;
      /** 전투 개시 진형을 강제한다. 생략 = 시스템 설정(굴림 또는 보통). */
      formation?: import("@/battle/battleFormation").BattleStartFormation;
      victoryBranch?: Command[];
      defeatBranch?: Command[];
      escapeBranch?: Command[];
    }
  | { kind: "learnSkill"; actorId: ActorId; skillId: SkillId; action?: "learn" | "forget" }
  | { kind: "changeExp"; actorId: ActorId; op: ActorAmountOp; amount: VariableOperand }
  | { kind: "changeLevel"; actorId: ActorId; op: ActorAmountOp; amount: number }
  | { kind: "changeLifeSkillExp"; skillId: string; op: "=" | "+=" | "-="; amount: VariableOperand }
  | { kind: "promoteActor"; actorId: ActorId; toClassId?: string; successBranch?: Command[]; failureBranch?: Command[] }
  | { kind: "changeEquipment"; actorId: ActorId; slot: ActorEquipmentSlot; equipmentId: EquipmentId }
  | { kind: "changeActorHp"; actorId: ActorId; op: ActorAmountOp; amount: number; amountMode?: "flat" | "percent" }
  | { kind: "changeActorMp"; actorId: ActorId; op: ActorAmountOp; amount: number; amountMode?: "flat" | "percent" }
  | { kind: "recoverAll"; actorId?: ActorId }
  | {
      kind: "enterHeroName";
      actorId: ActorId;
      maxLength: number;
      showInitialName: boolean;
      /** 지정하면 배우 이름 대신 이 문자열 변수에 입력을 저장한다(자유 텍스트 입력·암호·기도문). */
      stringVariableId?: string;
      /** 문자열 변수 입력일 때 창 위 안내 문구. */
      prompt?: string;
    }
  | { kind: "changeGold"; op: "=" | "+=" | "-="; amount: VariableOperand }
  | { kind: "changeItem"; itemId: ItemId; op: "=" | "+=" | "-="; amount: VariableOperand }
  | { kind: "craftRecipe"; recipeId: string; resultVariableId?: string }
  | { kind: "applyItemUpgrade"; upgradeId: string; resultVariableId?: string }
  | { kind: "equipTool"; itemId?: ItemId }
  | {
      kind: "openChest";
      chestId?: string;
      displayName?: string;
      template?: StorageChestTemplate;
      layout?: StorageChestLayout;
      showIcons?: boolean;
      capacity?: number;
      allowBulk?: boolean;
      allowSort?: boolean;
      showCategories?: boolean;
      goldVault?: boolean;
      lockSwitchId?: string;
      lockItemId?: string;
      allowedItemTypes?: readonly string[];
    }
  | { kind: "changeFriendship"; npcKey?: string; delta: number }
  | { kind: "setRelationship"; npcKey?: string; state: RelationshipState }
  | { kind: "changeFactionStance"; a: string; b: string; op: "=" | "+=" | "-="; value: number }
  | { kind: "getFriendship"; npcKey?: string; variableId: string }
  | { kind: "changeParty"; actorId: ActorId; action: "add" | "remove" | "lead" }
  | { kind: "giveMonster"; speciesId: MonsterSpeciesId; level: number; nickname?: string }
  | { kind: "moveMonster"; instanceId: MonsterInstanceId; to: "party" | "box" }
  | { kind: "evolveMonster"; instanceId: MonsterInstanceId; toSpeciesId?: MonsterSpeciesId; successBranch?: Command[]; failureBranch?: Command[] }
  | { kind: "addFollower"; actorId?: ActorId; graphic?: EventPageGraphic; name?: string }
  | { kind: "removeFollower"; name?: string; all?: boolean }
  | { kind: "setLighting"; ambient: number; color?: string; transitionMs?: number }
  | { kind: "addLight"; source: LightSource }
  | { kind: "removeLight"; id?: string; all?: boolean }
  | { kind: "setWeather"; weather: WeatherKind; intensity?: number; transitionMs?: number }
  | { kind: "showAnimation"; target: ShowAnimationTarget; animationId: BattleAnimationId; wait?: boolean }
  // 정수리 이모트: 대사창을 열지 않고 감정만 보여준다. emote 어휘는 @/project/emotes 가 소유한다.
  | { kind: "showEmote"; target: EmoteTarget; emote: EmoteKind; durationMs?: number }
  // 동영상 리소스는 아직 ResourceKind 에 없다(다른 레인이 확장 중) — 지금은 리소스 id 문자열만 받는다.
  | { kind: "playMovie"; resourceId: string; wait?: boolean; skippable?: boolean }
  | {
      kind: "showPicture";
      pictureId: string;
      resourceId: string;
      x: number;
      y: number;
      scale?: number;
      opacity?: number;
      rotation?: number;
      durationMs?: number;
      waitForPicture?: boolean;
      /** 시스템이 갤러리를 켜 둔 동안, 이 그림을 한 번 보면 메뉴 목록에 남긴다. */
      recordInGallery?: boolean;
    }
  | { kind: "erasePicture"; pictureId: string }
  | {
      kind: "playAudio";
      resourceId: string;
      loop: boolean;
      /** 재생 채널. 생략하면 loop 로 유도한다(true=bgm, false=se) — 기존 저작물 계약. */
      channel?: AudioCommandChannel;
      /** 이 요청의 페이드인 길이(ms). 생략하면 엔진 기본값. */
      fadeInMs?: number;
      /** Track gain (0..1), multiplied by the user's group volume. */
      volume?: number;
    }
  | {
      kind: "stopAudio";
      /**
       * 정지 대상 채널. 생략하면 **모든 채널**을 정지한다(기존 「소리 정지」 계약).
       * `"bgm"` 은 RM2K3 「BGM 페이드아웃」 — 효과음·환경음은 계속 흐른다.
       */
      channel?: AudioCommandChannel;
    }
  | { kind: "cutsceneControl"; mode: "begin" | "end"; skippable?: boolean }
  | ({ kind: "displayTextSettings" } & MessageWindowSettings)
  | {
      kind: "shop";
      itemIds: ItemId[];
      allowSell?: boolean;
      quantityMode?: "single" | "select";
      shopType?: ShopType;
      /** Visual arrangement for the runtime shop window. */
      shopUiPreset?: ShopUiPreset;
      messageType?: ShopMessageType;
      /** 상인이 플레이어 물품을 살 때 쓸 소지금. 생략 시 런타임 기본 100G. */
      merchantGold?: number;
      stock?: ShopStockEntry[];
      shopServiceKind?: ShopServiceKind;
      restockPolicy?: ShopRestockPolicy;
      loyaltyTierId?: string;
      economy?: ShopEconomyConfig;
      buyback?: readonly ShopBuybackEntry[];
      cartLines?: readonly ShopCartLine[];
      consignments?: readonly ShopConsignment[];
      donation?: ShopDonationLedger;
      pawnTickets?: readonly { readonly id: string; readonly itemId: string; readonly pawnPrice: number; readonly dueDayKey: string }[];
      blackMarketFlag?: string;
      festivalFlag?: string;
      investmentLevel?: number;
      travelingRouteId?: string;
      appraisalUnidentifiedPool?: readonly string[];
      mileageRate?: number;
      branchOnTransaction?: boolean;
      transactionBranch?: Command[];
      branchOnFailedTransaction?: boolean;
      failedTransactionBranch?: Command[];
    }
  | {
      kind: "inn";
      price: VariableOperand;
      /** 여관 인사말. 생략 시 기본 문구. */
      note?: string;
      /** 숙박 여부 질문. 생략 시 요금 기반 기본 문구. */
      question?: string;
      /** false면 HP만 회복(MP 유지). 기본 true. */
      recoverMp?: boolean;
      /** true면 숙박 후 아침으로 시간 이동(시간 시스템 있을 때). */
      advanceToMorning?: boolean;
      /** 휴식 암전 연출 ms. 기본 500. */
      restDurationMs?: number;
      /** 기상 메시지 표시 ms. 기본 750. */
      wakeDurationMs?: number;
      /** true면 골드 부족 시 notEnoughBranch 실행. */
      branchOnNotEnoughGold?: boolean;
      notEnoughBranch?: Command[];
    }
  | { kind: "checkpointSave"; label?: string }
  | { kind: "openSaveMenu" }
  | {
      /**
       * 전술(격자) 전투. 파티와 적 그룹을 작은 격자 양 끝에 세우고 이동력(칸) 안 이동 + 인접 공격을
       * 번갈아 하다 한쪽이 전멸하면 끝난다. 결과는 세션 battleResult 와 victoryBranch/defeatBranch 로 이어진다.
       * canLose=false 인데 지면 게임 오버. player/tacticsBattle.ts.
       */
      kind: "tacticsBattle";
      troopId: TroopId;
      /** 격자 가로 칸 수. 없으면 8. */
      width?: number;
      /** 격자 세로 칸 수. 없으면 6. */
      height?: number;
      canLose?: boolean;
      victoryBranch?: Command[];
      defeatBranch?: Command[];
    }
  | { kind: "spawnFieldEnemy"; spawn: FieldSpawnDef }
  | { kind: "despawnFieldEnemy"; spawnId: string }
  | {
      kind: "runControl";
      action: "start";
      seed?: number;
      runId?: string;
      startFloor?: number;
    }
  | { kind: "runControl"; action: "advance"; amount?: number }
  | { kind: "runControl"; action: "end"; result: "completed" | "failed" | "abandoned" }
  | { kind: "runControl"; action: "setFlag"; flag: string; value: boolean }
  | { kind: "runControl"; action: "resetRoom"; roomId?: string }
  | { kind: "killPlayer"; message?: string; gameOverId?: string }
  | { kind: "triggerEnding"; endingId?: string }
  | { kind: "gameOver"; gameOverId?: string }
  | { kind: "ending"; title: string; message: string; presentation?: import("../cinematicSettings").EndingPresentation }
  | { kind: "returnToTitle" }
  | { kind: "setFlag"; flag: FlagName; value: boolean }
  | { kind: "setSelfSwitch"; key: SelfSwitchKey; value: boolean }
  | { kind: "m2Command"; commandId: string; fields: M2CommandFields }
  /** 난이도 변경(system.difficulties 의 id). 없는 id 는 무시한다. */
  | { kind: "setDifficulty"; difficultyId: string }
  /** 현재 파티(구성원·위치)를 이름 붙은 파티 묶음으로 저장한다. 같은 이름은 덮어쓴다. */
  | { kind: "storeParty"; partySetId: string }
  /**
   * 저장한 파티 묶음으로 조작을 바꾼다. 지금 파티는 activePartySetId 로 자동 저장되고,
   * 불러온 묶음의 위치로 이동한다(맵이 같으면 제자리 교체). 없는 묶음이면 flags.recallPartySuccess=false.
   */
  | { kind: "recallParty"; partySetId: string }
  /** 몬스터 놓아주기. instanceId 를 비우면 보관함의 첫 개체. 결과는 flags.removeMonsterSuccess. */
  | { kind: "removeMonster"; instanceId: string }
  /** NPC 교환: 파티·보관함에서 fromSpeciesId 종 한 마리를 내주고 toSpeciesId 종을 받는다. 결과는 flags.tradeMonsterSuccess. */
  | { kind: "tradeMonster"; fromSpeciesId: MonsterSpeciesId; toSpeciesId: MonsterSpeciesId; level?: number; nickname?: string }
  /**
   * 두 개체를 합성해 system.monsterFusions 표의 결과 종 하나로 만든다. 표에 없는 조합이면 실패.
   * 결과는 flags.fuseMonstersSuccess.
   */
  | { kind: "fuseMonsters"; instanceIdA: string; instanceIdB: string };

export type EventPriority = "below" | "same" | "above";
export type AutonomousMovement = "fixed" | "random" | "approach" | "custom" | "living" | "chase";
/** 페이지 애니메이션 유형의 단일 진실 소스 — 툴 스키마 enum 과 로더 정규화도 여기서 가져간다.
 * 2026-09-24 갤러리 도그푸딩: 유니온에 없는 "none" 이 32페이지에 저장돼 런타임 canActionTurn 의
 * exhaustiveness 트립와이어가 첫 조작에서 씬을 통째로 죽였다(브라우저 완주 막힘). */
export const EVENT_ANIMATION_TYPES = [
  "normal",
  "step",
  "fixedDirection",
  "fixedDirectionStep",
  "fixedGraphic",
  "fourFrame",
] as const;
export type EventAnimationType = (typeof EVENT_ANIMATION_TYPES)[number];

export interface EventPageGraphic {
  appearanceId?: string;
  sprite?: AssetRef;
  direction?: Dir;
  pattern?: number;
  transparent?: boolean;
  /**
   * 스프라이트 렌더 배율. 충돌 발자국과 **독립**이다 —
   * "그림은 3배인데 발자국은 2x2" 같은 연출을 허용한다.
   * 기존 명시 값은 절대 배율. scaleMode:auto에서는 자동 맞춤에 곱할 몸 배율이다.
   */
  scale?: number;
  /** 생략 시 scale이 없으면 자동, 기존 scale이 있으면 수동(호환). */
  scaleMode?: "auto" | "manual";
}

export interface NpcLivingDestination {
  mapId: MapId;
  x: number;
  y: number;
  direction?: Dir;
  switchId?: string;
}

export interface NpcLivingMovement {
  destinations: NpcLivingDestination[];
  repeat: boolean;
}

export interface NpcScheduleWhen {
  readonly timePhase?: TimePhase;
  readonly hourRange?: readonly [number, number];
  readonly season?: Season;
  readonly dayRange?: readonly [number, number];
}

export interface NpcScheduleAt {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
}

export interface NpcScheduleEntry {
  // GameTime에는 요일 개념이 없으므로 요일 조건은 도입하지 않고 dayRange로 대체한다.
  readonly when: NpcScheduleWhen;
  readonly at: NpcScheduleAt;
  readonly facing?: Dir;
  readonly activity?: string;
}

export interface NpcSight {
  range: number;
  lineOfSight: boolean;
  /** Forward is a same-row/column ray, not a cone. */
  facing: "any" | "forward";
}
export interface DetectionEncounter {
  sight: NpcSight;
  emote: EmoteKind | null;
  emoteMs: number;
  approachSpeed: number;
}

export interface ChaseAcrossMaps {
  /** Omitted preserves finite last-seen search; persistent still respects hiding and safe zones. */
  tracking?: "lastSeen" | "persistent";
  scope: "map" | "connected";
  doorDelayMs: number;
  searchMs: number;
  onLost: "wait" | "return";
  /** 명작 공백 #28(2026-09-27): 추격자가 수색 끝에 포기하면 켜는 스위치(따돌림 연출·BGM 복귀 이벤트용). 다시 발견하면 끈다. */
  lostSwitchId?: string;
  /** 추격자가 문을 따라 다른 맵으로 넘어오기 시작하면 켜는 스위치(「문이 열린다」 연출용). */
  followSwitchId?: string;
}

export interface EventObjectInteraction {
  kind: "pushable" | "hiding";
  /** A push always moves one tile. Omitted directions allow all four directions. */
  directions?: Dir[];
}

export interface EventPageMovement {
  type: AutonomousMovement;
  speed: number;
  frequency: number;
  route?: MoveRoute;
  living?: NpcLivingMovement;
  pursuit?: ChaseAcrossMaps;
  sight?: NpcSight;
  sightRange?: number;
  giveUpRange?: number;
  pathfind?: boolean;
  /** 추적 결정 간격(ms) 명시 오버라이드. 생략 시 frequency 랭크로 결정. */
  moveIntervalMs?: number;
}

export interface EventPage {
  id: string;
  name: string;
  conditions: EventPageCondition[];
  graphic: EventPageGraphic;
  trigger: Trigger;
  priority: EventPriority;
  overlapForbidden?: boolean;
  animationType?: EventAnimationType;
  /**
   * **몸 사각**(타일). (x,y) 는 사각 **하단 행**의 칸이고 짝수 폭은 왼쪽 치우침.
   * 생략 시 1x1 — 기존 이벤트는 좌표가 그대로다.
   * 조사·접촉 발동, 전투 히트, 점유, 렌더 중앙, 편집 클릭을 지배한다.
   * 페이지 단위인 이유: 알 → 드래곤처럼 페이지 전환으로 크기가 바뀌는 연출을 허용한다.
   */
  footprint?: CharacterFootprint;
  /**
   * 통행을 차단하는 행 수 — 몸 사각의 **하단 N행**만 막는다.
   * 3x3 몸에 1 이면 발밑 한 줄만 막히고 상체 두 줄은 뒤로 지나갈 수 있다.
   * 그래도 조사·전투는 몸 전체가 받는다(상체를 보고 말을 걸 수 있다).
   *
   * 생략 시 `footprint.height` = 몸 전체 = **1차와 동일한 동작**. 비정규 값도 전체로
   * 올린다(fail-closed — 적은 행 수가 벽을 여는 것보다 다 막는 쪽이 안전하다).
   */
  passRows?: number;
  interaction?: EventObjectInteraction;
  detectionEncounter?: DetectionEncounter;
  movement: EventPageMovement;
  commands: Command[];
}

/** Serializable field-level writes owned by an event editor transaction. null means absent. */
export interface EventDraftAuthoredWrite {
  readonly kind: "characterName" | "switch";
  readonly id: string;
  readonly before: string | null;
  readonly after: string | null;
}

export interface EventDraftMeta {
  kind: "new" | "edit";
  /** edit: 열기 전 원본(취소 시 복원). new: 생성 직후 스냅샷(사용자 편집 여부 판정 기준). */
  original?: PersistedGameEvent;
  authoredWrites?: EventDraftAuthoredWrite[];
  /** Local recovery kept its work after a different project snapshot changed this event. */
  conflict?: {
    kind: "remote-change" | "remote-delete";
    detectedAt: number;
  };
}

export interface GameEvent {
  id: string;
  /** Stable authored display identity, independent of state page titles. */
  name?: string;
  /** Opt-in relationship identity for friendship/gifts (shared across multi-map copies). Empty/omit = no social self-key. */
  characterId?: string;
  /** Authored placement semantics, independent of graphics and opt-in social identity. */
  placementRole?: "npc";
  x: number;
  y: number;
  sprite?: AssetRef;
  trigger: Trigger;
  condition?: Condition;
  moveRoute?: MoveRoute;
  commands: Command[];
  pages?: EventPage[];
  schedule?: NpcScheduleEntry[];
  giftPrefs?: GiftPrefs;
  giftResponses?: GiftResponses;
  /** Opt-in: action talk grants friendship once per day per social key. true = +10, or { delta }. */
  talkFriendship?: boolean | { delta?: number };
  /** Opt-in calendar tags (birthday gift multiplier). Event-local; no character profile package required. */
  socialCalendar?: SocialCalendar;
  /** Opt-in shop buy-price discount when buyer friendship with this merchant meets minFriendship. */
  socialShop?: SocialShop;
  draft?: EventDraftMeta;
}

export type PersistedGameEvent = Omit<GameEvent, "draft">;

export interface CommonEvent {
  id: string;
  name: string;
  trigger: "none" | "auto" | "parallel";
  conditionSwitchId?: string;
  commands: Command[];
}

export type CommandV1 =
  | { kind: "text"; speaker?: string; body: string }
  | {
      kind: "choices";
      prompt?: string;
      options: { text: string; branch: CommandV1[] }[];
    }
  | { kind: "setFlag"; flag: FlagName; value: boolean }
  | { kind: "transfer"; mapId: MapId; x: number; y: number }
  | { kind: "wait"; ms: number };
