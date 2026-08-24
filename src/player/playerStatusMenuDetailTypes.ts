import type { SaveSlotIndex, SaveSlotReadResult } from "@/player/saveSlots";
import type { PlaySession } from "@/project/session";
import type { ActorInitialEquipment, Project } from "@/project/types";
import type { StatusMenuCommandId, StatusMenuRailId } from "@/player/playerStatusMenuModel";

export type StatusMenuDetailEntry = {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
  readonly face?: {
    readonly resourceId?: string;
    readonly alt: string;
    readonly testId: string;
  };
  readonly testId?: string;
  /** 이 후보를 고르면 능력치가 어떻게 변하는가. 커서가 올라간 항목의 값을 사이드바가 그린다.
      설명 문자열에도 증감이 들어 있지만 좁은 행에서 말줄임으로 묻혀 판단에 못 쓴다. */
  readonly statDelta?: readonly StatusMenuStatDelta[];
  readonly onActivate?: () => void;
  readonly disabled?: boolean;
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
  readonly targetItemId?: string;
  readonly skillActorId?: string;
  readonly selectedSkillId?: string;
  readonly equipmentActorId?: string;
  readonly equipmentSlotId?: keyof ActorInitialEquipment;
  readonly formationActorId?: string;
  readonly monsterView?: "party" | "box";
  readonly confirmSaveSlot?: SaveSlotIndex;
  readonly saveEnabled?: boolean;
  readonly onSaveSlot?: (slot: SaveSlotIndex) => void;
  readonly onLoadSlot?: (slot: SaveSlotIndex) => void;
  readonly onSelectItemTarget?: (itemId: string) => void;
  readonly onUseItem?: (itemId: string, actorId?: string) => void;
  readonly onSelectSkillActor?: (actorId: string) => void;
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
  readonly lifeLedgerTab?: import("@/player/lifeLedger").LifeLedgerTabId;
  readonly onSelectLifeLedgerTab?: (tab: import("@/player/lifeLedger").LifeLedgerTabId) => void;
  readonly onLifeLedgerMutation?: (ok: boolean, message: string) => void;
  /** 접힌 그룹 목록에서 실제 명령으로 들어갈 때 쓴다. */
  readonly onCommand?: (commandId: StatusMenuCommandId) => void;
};
