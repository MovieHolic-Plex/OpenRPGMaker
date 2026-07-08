import { changeItem, setAudioState } from "@/project/session";
import { store } from "@/project/store";
import type { PlayScene } from "@/player/PlayScene";
import { canEquip } from "@/player/playerEquipmentRules";
import { useItemFromMenu } from "@/player/playerItemUse";
import type { ActorInitialEquipment } from "@/project/types";

export type StatusMenuMutationResult =
  | { readonly kind: "used"; readonly message: string }
  | { readonly kind: "unusable"; readonly message: string };

export function useStatusMenuItem(scene: PlayScene, itemId: string, actorId?: string): StatusMenuMutationResult {
  const session = scene.getSession();
  const result = useItemFromMenu(store.getCurrent(), session, itemId, actorId);
  if (result.kind === "used") setAudioState(session, { channel: "se", resourceId: "easyrpg-sound-item1", loop: false });
  scene.syncRuntimeState();
  return result;
}

export function equipStatusMenuItem(scene: PlayScene, actorId: string, equipmentId: string): StatusMenuMutationResult {
  const project = store.getCurrent();
  const session = scene.getSession();
  const equipment = project.database.equipment.find((record) => record.id === equipmentId);
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!equipment || !actor || (session.inventory[equipmentId] ?? 0) <= 0 || !canEquip(project, actor, equipment)) {
    return { kind: "unusable", message: "장비할 수 없습니다" };
  }
  const previous = session.actorEquipment[actorId]?.[equipment.slot];
  session.actorEquipment[actorId] = { ...(session.actorEquipment[actorId] ?? {}), [equipment.slot]: equipment.id };
  changeItem(session, equipment.id, "-=", 1);
  if (previous) changeItem(session, previous, "+=", 1);
  scene.syncRuntimeState();
  return { kind: "used", message: `${equipment.name}을 장비했습니다` };
}

export function unequipStatusMenuItem(scene: PlayScene, actorId: string, slotId: keyof ActorInitialEquipment): StatusMenuMutationResult {
  const session = scene.getSession();
  const previous = session.actorEquipment[actorId]?.[slotId];
  if (!previous) return { kind: "unusable", message: "해제할 장비가 없습니다" };
  const nextEquipment = { ...(session.actorEquipment[actorId] ?? {}) };
  delete nextEquipment[slotId];
  session.actorEquipment[actorId] = nextEquipment;
  changeItem(session, previous, "+=", 1);
  scene.syncRuntimeState();
  return { kind: "used", message: "장비를 해제했습니다" };
}

export function toggleStatusMenuActorRow(scene: PlayScene, actorId: string): StatusMenuMutationResult {
  const session = scene.getSession();
  session.actorRows[actorId] = (session.actorRows[actorId] ?? "front") === "front" ? "back" : "front";
  scene.syncRuntimeState();
  return { kind: "used", message: `${session.actorRows[actorId] === "front" ? "전열" : "후열"}로 변경했습니다` };
}

export function moveStatusMenuFormationActor(scene: PlayScene, actorId: string, targetIndex: number): StatusMenuMutationResult {
  const session = scene.getSession();
  const index = session.partyActorIds.indexOf(actorId);
  if (index < 0 || targetIndex < 0 || targetIndex >= session.partyActorIds.length || index === targetIndex) {
    return { kind: "unusable", message: "더 이상 이동할 수 없습니다" };
  }
  const nextParty = [...session.partyActorIds];
  const [actor] = nextParty.splice(index, 1);
  if (!actor) return { kind: "unusable", message: "더 이상 이동할 수 없습니다" };
  nextParty.splice(targetIndex, 0, actor);
  session.partyActorIds = nextParty;
  scene.syncRuntimeState();
  return { kind: "used", message: "진형을 변경했습니다" };
}
