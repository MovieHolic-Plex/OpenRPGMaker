import type { InventoryView } from '@/player/playerInventoryView';
import type { GrowthMenuTab, GrowthMenuMutation } from "@/player/playerGrowthMenu";
import type { SaveSlotIndex, SaveSlotReadResult } from "@/player/saveSlots";
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
  };
  readonly testId?: string;
  /** 이 후보를 고르면 능력치가 어떻게 변하는가. 커서가 올라간 항목의 값을 사이드바가 그린다.
      설명 문자열에도 증감이 들어 있지만 좁은 행에서 말줄임으로 묻혀 판단에 못 쓴다. */
  readonly statDelta?: readonly StatusMenuStatDelta[];
  /** Inventory showcase facts (type / active effects / use eligibility). Machine values, not row copy. */
  readonly facts?: readonly StatusMenuDetailFact[];
  /** Semantic DOM attributes for state/behavior assertions (not prose). */
  readonly attributes?: Readonly<Record<string, string>>;
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
  readonly artwork?: { readonly src: string; readonly alt: string };
  readonly tabs?: readonly {
    readonly id: string;
    readonly label: string;
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
  readonly waitModeEnabled: boolean;
  readonly inventoryView?: InventoryView;
  readonly onInventoryViewChange?: (view: InventoryView) => void;
  readonly onOptionsChanged?: (message?: string) => void;
  readonly targetItemId?: string;
  readonly skillActorId?: string;
  readonly selectedSkillId?: string;
  readonly growthTab?: GrowthMenuTab;
  readonly equipmentActorId?: string;
  readonly equipmentSlotId?: keyof ActorInitialEquipment;
  readonly formationActorId?: string;
  readonly battleReportIndex?: number;
  readonly onSelectBattleReport?: (index: number | undefined) => void;
  readonly monsterView?: "party" | "box";
  readonly confirmSaveSlot?: SaveSlotIndex;
  readonly confirmToTitle?: boolean;
  readonly saveEnabled?: boolean;
  readonly onSaveSlot?: (slot: SaveSlotIndex) => void;
  readonly onLoadSlot?: (slot: SaveSlotIndex) => void;
  readonly onSelectItemTarget?: (itemId: string) => void;
  readonly onUseItem?: (itemId: string, actorId?: string, monsterInstanceId?: string) => void;
  readonly onSelectSkillActor?: (actorId: string) => void;
  readonly onSelectGrowthTab?: (tab: GrowthMenuTab) => void;
  readonly onGrowthMutation?: (action: GrowthMenuMutation) => void;
  readonly onSelectSkill?: (skillId: string) => void;
  readonly onSelectEquipmentActor?: (actorId: string) => void;
  readonly onSelectEquipmentSlot?: (actorId: string, slotId: keyof ActorInitialEquipment) => void;
  readonly onEquipItem?: (actorId: string, slotId: keyof ActorInitialEquipment, equipmentId: string) => void;
  readonly onUnequipItem?: (actorId: string, slotId: keyof ActorInitialEquipment) => void;
  readonly onToggleRow?: (actorId: string) => void;
  readonly onSelectFormationActor?: (actorId: string) => void;
  readonly onMoveFormationActor?: (actorId: string, targetIndex: number) => void;
  readonly onToggleMonsterView?: () => void;
  readonly onMoveMonster?: (instanceId: string, to: "party" | "box") => void;
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
