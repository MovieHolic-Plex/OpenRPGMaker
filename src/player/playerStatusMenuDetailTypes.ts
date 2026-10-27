import type { InventoryView } from '@/player/playerInventoryView';
import type { GrowthMenuTab, GrowthMenuMutation } from "@/player/playerGrowthMenu";
import type { AutosaveReadResult, SaveSlotIndex, SaveSlotReadResult } from "@/player/saveSlots";
import type { PlaySession } from "@/project/session";
import type { ActorInitialEquipment, BattleAnimationSheet, ItemScope, Project } from "@/project/types";
import type { StatusMenuCommandId, StatusMenuRailId } from "@/player/playerStatusMenuModel";

export type StatusMenuDetailEntry = {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
  /** Unavailable rows remain navigable so their reason can be read before activation. */
  readonly unavailableReason?: string;
  readonly vitals?: {
    readonly hp: number; readonly maxHp: number; readonly hpAfter: number;
    readonly mp: number; readonly maxMp: number; readonly mpAfter: number;
    /** 지금 걸린 상태 이름과, 이 행동으로 풀리는 상태 이름. 없으면 「정상」. */
    readonly stateNames?: readonly string[];
    readonly curedStateNames?: readonly string[];
  };
  readonly face?: {
    readonly resourceId?: string;
    readonly alt: string;
    readonly testId: string;
  };
  /** 행이 가리키는 데이터베이스 레코드의 아이콘(아이템/장비/스킬). 행의 앞머리 칸에 그린다. */
  readonly icon?: {
    readonly resourceId?: string;
    readonly sheet?: BattleAnimationSheet;
    readonly alt: string;
    readonly testId: string;
    /** 픽셀 아이콘이 아닌 그림(갤러리 CG)은 부드럽게 그린다. */
    readonly smooth?: boolean;
  };
  readonly testId?: string;
  /** 이 후보를 고르면 능력치가 어떻게 변하는가. 커서가 올라간 항목의 값을 사이드바가 그린다.
      설명 문자열에도 증감이 들어 있지만 좁은 행에서 말줄임으로 묻혀 판단에 못 쓴다. */
  readonly statDelta?: readonly StatusMenuStatDelta[];
  /** Inventory showcase facts (type / active effects / use eligibility). Machine values, not row copy. */
  readonly facts?: readonly StatusMenuDetailFact[];
  /** Semantic DOM attributes for state/behavior assertions (not prose). */
  readonly attributes?: Readonly<Record<string, string>>;
  /** 글자 입력 행(별명 짓기). 값은 Enter 로 확정, Esc 로 취소 — 키는 입력창이 받고 게임 키로 새지 않는다. */
  readonly textInput?: { readonly value: string; readonly maxLength: number; readonly label: string; readonly onCommit: (value: string) => void; readonly onCancel: () => void };
  readonly onActivate?: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
};

export type StatusMenuDetailFactId = "type" | "effects" | "eligibility";

export type StatusMenuDetailFact = {
  readonly id: StatusMenuDetailFactId;
  readonly value: string;
  readonly targeting?: { readonly scope: ItemScope | "partyMonster"; readonly deadOnly: boolean };
  readonly consumption?:
    | { readonly consumable: false }
    | { readonly consumable: true; readonly usesPerCopy: number; readonly remainingCopyUses: number; readonly remainingUses: number };
};

export type StatusMenuStatDelta = {
  readonly label: string;
  readonly current: number;
  readonly next: number;
};

export type StatusMenuDetail = {
  readonly title: string;
  readonly entries: readonly StatusMenuDetailEntry[];
  readonly emptyLabel?: string;
  readonly hint?: string;
  /** gallery: 고른 그림을 목록 위에 크게 둔다. */
  readonly layout?: "gallery" | "campaign-dex" | "campaign-map" | "campaign-progress" | "campaign-party" | "campaign-summary" | "campaign-box";
  readonly regionMap?: import("@/player/playerMonsterCampaignMenu").CampaignRegionMap;
  readonly artwork?: { readonly src: string; readonly alt: string; readonly shiny?: boolean };
  /** 도감 목록의 진행 막대(발견·포획·전체). 제목 줄에 겹쳐 그린다. */
  readonly meter?: { readonly seen: number; readonly caught: number; readonly total: number };
  readonly tabs?: readonly {
    readonly id: string;
    readonly label: string;
    readonly selected: boolean;
    readonly testId: string;
    readonly onActivate?: () => void;
    /** 키보드 커서 순서에서는 빼고(좌우 키가 따로 전환한다) 눌러서만 고른다. */
    readonly pointerOnly?: boolean;
  }[];
  /** 몬스터 수집 게임 가방의 포켓 목록 — 에메랄드 가방은 점으로, 그 밖의 스킨은 탭 줄로 그린다. */
  readonly pockets?: readonly {
    readonly id: string;
    readonly label: string;
    /** 이 포켓에 든 아이템 종류 수. */
    readonly count: number;
    readonly selected: boolean;
    readonly testId: string;
    readonly onActivate?: () => void;
  }[];
};

export type StatusMenuDetailOptions = {
  readonly project: Project;
  readonly session: PlaySession;
  /** 그룹 열기 항목(record-menu/system-menu)도 올 수 있다 — 그때는 그룹 명령 목록을 그린다. */
  readonly selectedCommand: StatusMenuRailId;
  readonly slots: readonly SaveSlotReadResult[];
  /** 인게임 로드 화면 맨 위의 자동 저장. 저장 화면은 덮어쓰지 않으므로 쓰지 않는다. */
  readonly autosave?: AutosaveReadResult;
  readonly onLoadAutosave?: () => void;
  readonly waitModeEnabled: boolean;
  readonly inventoryView?: InventoryView;
  readonly onInventoryViewChange?: (view: InventoryView) => void;
  readonly onOptionsChanged?: (message?: string) => void;
  /** 「전투 대기」 화면의 행을 확정했을 때. 값은 이 콜백이 바꾸고 화면을 다시 그린다. */
  readonly onToggleWait?: () => void;
  readonly targetItemId?: string;
  readonly skillActorId?: string;
  readonly selectedSkillId?: string;
  readonly growthTab?: GrowthMenuTab;
  readonly equipmentActorId?: string;
  readonly equipmentSlotId?: keyof ActorInitialEquipment;
  readonly formationActorId?: string;
  readonly battleReportIndex?: number;
  readonly onSelectBattleReport?: (index: number | undefined) => void;
  readonly campaignSpeciesId?: string;
  readonly onSelectCampaignSpecies?: (speciesId: string | undefined) => void;
  readonly monsterInstanceId?: string;
  readonly onSelectMonster?: (instanceId: string | undefined) => void;
  readonly monsterView?: "party" | "box";
  readonly monsterCollect?: import("@/player/playerMonsterCollectTypes").MonsterCollectUi;
  /** 도감 상세의 쪽(에메랄드 스킨에서만 쓴다). */
  readonly dexPage?: import("@/player/playerMonsterDexTypes").MonsterDexPage;
  readonly onDexPage?: (page: import("@/player/playerMonsterDexTypes").MonsterDexPage) => void;
  readonly confirmSaveSlot?: SaveSlotIndex;
  readonly confirmToTitle?: boolean;
  readonly saveEnabled?: boolean;
  readonly onSaveSlot?: (slot: SaveSlotIndex) => void;
  readonly onLoadSlot?: (slot: SaveSlotIndex) => void;
  readonly onSelectItemTarget?: (itemId: string) => void;
  readonly onUseItem?: (itemId: string, actorId?: string, monsterInstanceId?: string) => void;
  /** 조합·바라보는 대상에 사용 하위 화면을 연 아이템. */
  readonly itemActionId?: string;
  /** 정면(또는 발밑) 이벤트가 이 아이템을 받는가 — 메뉴 행 노출용 판정기. 생략 = 필드 대상 없음. */
  readonly canUseItemOnFacedTarget?: (itemId: string) => boolean;
  readonly onOpenItemActions?: (itemId: string) => void;
  readonly onCombineItems?: (itemA: string, itemB: string) => void;
  readonly onUseItemOnFacedTarget?: (itemId: string) => void;
  readonly onToggleSkillLoadout?: (actorId: string, skillId: string) => void;
  readonly onSelectSkillActor?: (actorId: string) => void;
  readonly onSelectGrowthTab?: (tab: GrowthMenuTab) => void;
  readonly onGrowthMutation?: (action: GrowthMenuMutation) => void;
  readonly onSelectSkill?: (skillId: string) => void;
  readonly onSelectEquipmentActor?: (actorId: string) => void;
  readonly onSelectEquipmentSlot?: (actorId: string, slotId: keyof ActorInitialEquipment) => void;
  readonly onEquipItem?: (actorId: string, slotId: keyof ActorInitialEquipment, equipmentId: string) => void;
  readonly onUnequipItem?: (actorId: string, slotId: keyof ActorInitialEquipment) => void;
  /** 「최강 장비」 — bestEquipmentPlan 의 조합을 한 번에 장착한다. */
  readonly onOptimizeEquipment?: (actorId: string) => void;
  readonly onToggleRow?: (actorId: string) => void;
  readonly onSelectFormationActor?: (actorId: string) => void;
  readonly onMoveFormationActor?: (actorId: string, targetIndex: number) => void;
  readonly onToggleMonsterView?: () => void;
  /** 파티 자리 바꾸기 같은 수집 화면 동작. */
  readonly onMonsterCollect?: (action: import("@/player/playerMonsterCollectTypes").MonsterCollectAction) => void;
  readonly onMoveMonster?: (instanceId: string, to: "party" | "box") => void;
  /** 몬스터가 지닌 도구를 가방으로 되돌린다. */
  readonly onTakeHeldItem?: (instanceId: string) => void;
  /** 몬스터 파티원이 필드 기술(skill.fieldCommonEventId)을 바라보는 앞에 쓴다. */
  readonly onUseMonsterFieldSkill?: (instanceId: string, skillId: string) => void;
  readonly onReplacePendingMonsterSkill?: (instanceId: string, pendingSkillId: string, replacedSkillId: string) => void;
  readonly onRejectPendingMonsterSkill?: (instanceId: string, pendingSkillId: string) => void;
  readonly lifeLedgerTab?: import("@/player/lifeLedger").LifeLedgerTabId;
  readonly onSelectLifeLedgerTab?: (tab: import("@/player/lifeLedger").LifeLedgerTabId) => void;
  readonly onLifeLedgerMutation?: (ok: boolean, message: string) => void;
  readonly readLive?: import("@/project/spatialOccupancy").SpatialLiveContextReader;
  readonly placementDirection?: import("@/project/types").Dir;
  readonly getPlacementDirection?: () => import("@/project/types").Dir | undefined;
  readonly getScene?: () => import("@/player/lifePlacementScene").LifePlacementSceneSource | undefined;
  /** 접힌 그룹 목록에서 실제 명령으로 들어갈 때 쓴다. */
  readonly onCommand?: (commandId: StatusMenuCommandId) => void;
};
