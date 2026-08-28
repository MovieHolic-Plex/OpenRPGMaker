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

export type Trigger =
  | { kind: "action" }
  | { kind: "touch" }
  | { kind: "playerTouch" }
  | { kind: "eventTouch" }
  | { kind: "auto" }
  | { kind: "parallel" };

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
  | { kind: "item"; itemId: ItemId; present: boolean }
  | { kind: "gold"; op: ">=" | "<=" | ">" | "<" | "==" | "!="; amount: number }
  | { kind: "timer"; timerId: "timer1" | "timer2"; seconds: number }
  | { kind: "timePhase"; phase: TimePhase }
  | { kind: "season"; season: Season }
  | { kind: "npcActivity"; activity: string }
  | { kind: "friendshipAtLeast"; npcKey?: string; value: number }
  | { kind: "battleResult"; result: "victory" | "defeat" | "escape" }
  | RoguelikeRunCondition
  | { kind: "all"; conditions: Condition[] }
  | { kind: "any"; conditions: Condition[] }
  | { kind: "not"; condition: Condition };

export type EventPageCondition = Condition;

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
  | { kind: "jump"; dx: number; dy: number }
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
export type ShopMessageType = "welcome" | "business" | "direct" | "festival" | "closingSale" | "vip";
export type ShopServiceKind = "repair" | "appraisal" | "pawn";
export type ShopRestockPolicy = "daily" | "weekly" | "onDemand";
export interface ShopLoyaltyTier { readonly id: string; readonly name: string; readonly minSpend: number; readonly discountRate: number; readonly perks?: readonly string[]; }
export interface ShopEconomyConfig { readonly dynamicPricing?: boolean; readonly haggleEnabled?: boolean; readonly closingSaleEnabled?: boolean; readonly inflationFactor?: number; readonly tradeRouteMarkup?: Record<string, number>; }
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
export type ActorEquipmentSlot = "weapon" | "shield" | "armor" | "helmet" | "accessory";
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
    }
  | ({ kind: "changeFace" } & FaceGraphic)
  | {
      kind: "choices";
      prompt?: string;
      options: { text: string; branch: Command[] }[];
      cancelBehavior?: ChoiceCancelBehavior;
      cancelBranch?: Command[];
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
  | { kind: "enterHeroName"; actorId: ActorId; maxLength: number; showInitialName: boolean }
  | { kind: "changeGold"; op: "=" | "+=" | "-="; amount: VariableOperand }
  | { kind: "changeItem"; itemId: ItemId; op: "=" | "+=" | "-="; amount: VariableOperand }
  | { kind: "craftRecipe"; recipeId: string }
  | { kind: "applyItemUpgrade"; upgradeId: string }
  | { kind: "equipTool"; itemId?: ItemId }
  | { kind: "openChest"; chestId?: string }
  | { kind: "changeFriendship"; npcKey?: string; delta: number }
  | { kind: "getFriendship"; npcKey?: string; variableId: string }
  | { kind: "changeParty"; actorId: ActorId; action: "add" | "remove" }
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
    }
  | { kind: "erasePicture"; pictureId: string }
  | { kind: "playAudio"; resourceId: string; loop: boolean }
  | { kind: "stopAudio" }
  | { kind: "cutsceneControl"; mode: "begin" | "end"; skippable?: boolean }
  | ({ kind: "displayTextSettings" } & MessageWindowSettings)
  | {
      kind: "shop";
      itemIds: ItemId[];
      allowSell?: boolean;
      quantityMode?: "single" | "select";
      shopType?: ShopType;
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
  | { kind: "killPlayer"; message?: string }
  | { kind: "triggerEnding"; endingId?: string }
  | { kind: "gameOver" }
  | { kind: "ending"; title: string; message: string }
  | { kind: "returnToTitle" }
  | { kind: "setFlag"; flag: FlagName; value: boolean }
  | { kind: "setSelfSwitch"; key: SelfSwitchKey; value: boolean }
  | { kind: "m2Command"; commandId: string; fields: M2CommandFields };

export type EventPriority = "below" | "same" | "above";
export type AutonomousMovement = "fixed" | "random" | "approach" | "custom" | "living" | "chase";
export type EventAnimationType =
  | "normal"
  | "step"
  | "fixedDirection"
  | "fixedDirectionStep"
  | "fixedGraphic"
  | "fourFrame";

export interface EventPageGraphic {
  sprite?: AssetRef;
  direction?: Dir;
  pattern?: number;
  transparent?: boolean;
  /**
   * 스프라이트 렌더 배율. 충돌 발자국과 **독립**이다 —
   * "그림은 3배인데 발자국은 2x2" 같은 연출을 허용한다. 생략 시 1.
   */
  scale?: number;
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

export interface EventPageMovement {
  type: AutonomousMovement;
  speed: number;
  frequency: number;
  route?: MoveRoute;
  living?: NpcLivingMovement;
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
   * 충돌 발자국(타일). (x,y) 는 발자국 **하단 행**의 칸이고 짝수 폭은 왼쪽 치우침.
   * 생략 시 1x1 — 기존 이벤트는 좌표가 그대로다.
   * 페이지 단위인 이유: 알 → 드래곤처럼 페이지 전환으로 크기가 바뀌는 연출을 허용한다.
   */
  footprint?: CharacterFootprint;
  movement: EventPageMovement;
  commands: Command[];
}

export interface EventDraftMeta {
  kind: "new" | "edit";
  /** edit: 열기 전 원본(취소 시 복원). new: 생성 직후 스냅샷(사용자 편집 여부 판정 기준). */
  original?: PersistedGameEvent;
}

export interface GameEvent {
  id: string;
  /** Opt-in relationship identity for friendship/gifts (shared across multi-map copies). Empty/omit = no social self-key. */
  characterId?: string;
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
