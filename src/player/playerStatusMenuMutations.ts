import { setAudioState } from "@/project/session";
import { store } from "@/project/store";
import type { PlayScene } from "@/player/PlayScene";
import { transitionActorEquipment } from "@/project/equipmentRules";
import { useItemFromMenu } from "@/player/playerItemUse";
import { bestEquipmentPlan } from "@/player/playerStatusMenuDetails";
import type { ActorInitialEquipment } from "@/project/types";

export type StatusMenuMutationResult =
  | { readonly kind: "used"; readonly message: string }
  | { readonly kind: "unusable"; readonly message: string };

export function useStatusMenuItem(scene: PlayScene, itemId: string, actorId?: string, monsterInstanceId?: string): StatusMenuMutationResult {
  const session = scene.getSession();
  const result = useItemFromMenu(store.getCurrent(), session, itemId, actorId, monsterInstanceId);
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

/**
 * 「최강 장비」 — 계획(bestEquipmentPlan)의 부위를 하나씩 transitionActorEquipment 로 바꾼다.
 * 한 부위라도 거부되면 세션을 건드리지 않는다(원자적). 계획은 이미 저주·고정 부위를 뺐다.
 */
export function optimizeStatusMenuEquipment(scene: PlayScene, actorId: string): StatusMenuMutationResult {
  const project = store.getCurrent();
  const session = scene.getSession();
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!actor) return { kind: "unusable", message: "장비할 수 없습니다" };
  const plan = bestEquipmentPlan({ project, session }, actor);
  if (!plan) return { kind: "unusable", message: "장비가 고정되어 있습니다" };
  if (plan.changes.length === 0) return { kind: "unusable", message: "이미 최강 장비입니다" };
  let equipment = session.actorEquipment[actorId];
  let inventory: Record<string, number> = { ...session.inventory };
  for (const change of plan.changes) {
    const transition = transitionActorEquipment({
      project, actorId, classId: session.classOverrides[actorId], equipment, inventory,
      slot: change.slotId as keyof ActorInitialEquipment,
      ...(change.equipmentId ? { equipmentId: change.equipmentId } : {}),
    });
    if (transition.kind === "rejected") return { kind: "unusable", message: "장비할 수 없습니다" };
    equipment = transition.equipment;
    inventory = transition.inventory;
  }
  if (equipment) session.actorEquipment[actorId] = equipment;
  session.inventory = inventory;
  scene.syncRuntimeState();
  return { kind: "used", message: `최강 장비 — 합계 ${plan.gain >= 0 ? "+" : ""}${plan.gain}` };
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
