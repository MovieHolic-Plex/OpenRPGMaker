import { setAudioState } from "@/project/session";
import { store } from "@/project/store";
import type { PlayScene } from "@/player/PlayScene";
import { transitionActorEquipment } from "@/project/equipmentRules";
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

export function equipStatusMenuItem(scene: PlayScene, actorId: string, slotId: keyof ActorInitialEquipment, equipmentId: string): StatusMenuMutationResult {
  const project = store.getCurrent();
  const session = scene.getSession();
  const equipment = project.database.equipment.find((record) => record.id === equipmentId);
  if (!equipment) return { kind: "unusable", message: "장비할 수 없습니다" };
  const transition = transitionActorEquipment({
    project,
    actorId,
    classId: session.classOverrides[actorId],
    equipment: session.actorEquipment[actorId],
    inventory: session.inventory,
    slot: slotId,
    equipmentId,
  });
  if (transition.kind === "rejected") return { kind: "unusable", message: "장비할 수 없습니다" };
  session.actorEquipment[actorId] = transition.equipment;
  session.inventory = transition.inventory;
  scene.syncRuntimeState();
  return { kind: "used", message: `${equipment.name}을 장비했습니다` };
}

export function unequipStatusMenuItem(scene: PlayScene, actorId: string, slotId: keyof ActorInitialEquipment): StatusMenuMutationResult {
  const project = store.getCurrent();
  const session = scene.getSession();
  const transition = transitionActorEquipment({
    project,
    actorId,
    classId: session.classOverrides[actorId],
    equipment: session.actorEquipment[actorId],
    inventory: session.inventory,
    slot: slotId,
  });
  if (transition.kind === "rejected") return { kind: "unusable", message: "장비를 해제할 수 없습니다" };
  session.actorEquipment[actorId] = transition.equipment;
  session.inventory = transition.inventory;
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
