import type { PlaySession } from "@/project/session";
import type { ActorInitialEquipment, Project } from "@/project/types";
import type { SaveSlotIndex, SaveSlotReadResult } from "@/player/saveSlots";
import type { StatusMenuCommandId } from "@/player/playerStatusMenuModel";

export type PlayerStatusMenuActions = {
  readonly onCommand: (commandId: StatusMenuCommandId) => void;
  readonly onSaveSlot: (slot: SaveSlotIndex) => void;
  readonly onLoadSlot: (slot: SaveSlotIndex) => void;
  readonly onSelectItemTarget: (itemId: string) => void;
  readonly onUseItem: (itemId: string, actorId?: string) => void;
  readonly onSelectSkillActor: (actorId: string) => void;
  readonly onSelectSkill: (skillId: string) => void;
  readonly onSelectEquipmentActor: (actorId: string) => void;
  readonly onSelectEquipmentSlot: (actorId: string, slotId: keyof ActorInitialEquipment) => void;
  readonly onEquipItem: (actorId: string, slotId: keyof ActorInitialEquipment, equipmentId: string) => void;
  readonly onUnequipItem: (actorId: string, slotId: keyof ActorInitialEquipment) => void;
  readonly onToggleRow: (actorId: string) => void;
  readonly onSelectFormationActor: (actorId: string) => void;
  readonly onMoveFormationActor: (actorId: string, targetIndex: number) => void;
  readonly onToggleMonsterView: () => void;
  readonly onMoveMonster: (instanceId: string, to: "party" | "box") => void;
  readonly onToggleWait: () => void;
  readonly onToTitle: () => void;
};

export type PlayerStatusMenuOptions = {
  readonly project: Project;
  readonly session: PlaySession;
  readonly slots: readonly SaveSlotReadResult[];
  readonly message?: string;
  readonly elapsedMs?: number;
  readonly selectedCommand?: StatusMenuCommandId;
  readonly mode?: "main" | "function";
  readonly selectedDetailActionIndex?: number;
  readonly targetItemId?: string;
  readonly skillActorId?: string;
  readonly selectedSkillId?: string;
  readonly equipmentActorId?: string;
  readonly equipmentSlotId?: keyof ActorInitialEquipment;
  readonly formationActorId?: string;
  readonly monsterView?: "party" | "box";
  readonly confirmSaveSlot?: SaveSlotIndex;
  readonly saveEnabled?: boolean;
  readonly waitModeEnabled?: boolean;
  readonly actions: PlayerStatusMenuActions;
};
