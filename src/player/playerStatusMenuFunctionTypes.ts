import type { PlaySession } from "@/project/session";
import type { ActorInitialEquipment, EquipmentStatBonuses, Project } from "@/project/types";
import type { SaveSlotReadResult } from "@/player/saveSlots";
import type { StatusMenuCommandId } from "@/player/playerStatusMenuModel";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";

export type StatusMenuFunctionSceneOptions = {
  readonly project: Project;
  readonly session: PlaySession;
  readonly commandId: StatusMenuCommandId;
  readonly slots: readonly SaveSlotReadResult[];
  readonly selectedActionIndex?: number;
  readonly targetItemId?: string;
  readonly skillActorId?: string;
  readonly selectedSkillId?: string;
  readonly equipmentActorId?: string;
  readonly equipmentSlotId?: keyof ActorInitialEquipment;
  readonly formationActorId?: string;
  readonly actions: PlayerStatusMenuActions;
};

export const EQUIPMENT_SLOTS = [
  ["weapon", "무기"],
  ["shield", "방패"],
  ["armor", "갑옷"],
  ["helmet", "투구"],
  ["accessory", "장신구"],
] as const satisfies readonly (readonly [keyof ActorInitialEquipment, string])[];

export const STAT_LABELS = [
  ["attack", "ATK"],
  ["defense", "DEF"],
  ["mind", "INT"],
  ["agility", "AGI"],
] as const satisfies readonly (readonly [keyof EquipmentStatBonuses, string])[];
