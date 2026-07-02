import { changeItem, setAudioState } from "@/project/session";
import { store } from "@/project/store";
import type { PlayScene } from "@/player/PlayScene";
import { canEquip } from "@/player/playerEquipmentRules";
import { useItemFromMenu } from "@/player/playerItemUse";

export function useStatusMenuItem(scene: PlayScene, itemId: string, actorId?: string): string {
  const session = scene.getSession();
  const result = useItemFromMenu(store.getCurrent(), session, itemId, actorId);
  if (result.kind === "used") setAudioState(session, { channel: "se", resourceId: "easyrpg-sound-item1", loop: false });
  scene.syncRuntimeState();
  return result.message;
}

export function equipStatusMenuItem(scene: PlayScene, actorId: string, equipmentId: string): string | undefined {
  const project = store.getCurrent();
  const session = scene.getSession();
  const equipment = project.database.equipment.find((record) => record.id === equipmentId);
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!equipment || !actor || (session.inventory[equipmentId] ?? 0) <= 0 || !canEquip(project, actor, equipment)) return undefined;
  const previous = session.actorEquipment[actorId]?.[equipment.slot];
  session.actorEquipment[actorId] = { ...(session.actorEquipment[actorId] ?? {}), [equipment.slot]: equipment.id };
  changeItem(session, equipment.id, "-=", 1);
  if (previous) changeItem(session, previous, "+=", 1);
  scene.syncRuntimeState();
  return `${equipment.name}을 장비했습니다`;
}

export function toggleStatusMenuActorRow(scene: PlayScene, actorId: string): string {
  const session = scene.getSession();
  session.actorRows[actorId] = (session.actorRows[actorId] ?? "front") === "front" ? "back" : "front";
  scene.syncRuntimeState();
  return `${session.actorRows[actorId] === "front" ? "전열" : "후열"}로 변경했습니다`;
}

export function moveStatusMenuFormationActor(scene: PlayScene, actorId: string, targetIndex: number): string {
  const session = scene.getSession();
  const index = session.partyActorIds.indexOf(actorId);
  if (index < 0 || targetIndex < 0 || targetIndex >= session.partyActorIds.length) return "더 이상 이동할 수 없습니다";
  const nextParty = [...session.partyActorIds];
  const [actor] = nextParty.splice(index, 1);
  if (!actor) return "더 이상 이동할 수 없습니다";
  nextParty.splice(targetIndex, 0, actor);
  session.partyActorIds = nextParty;
  scene.syncRuntimeState();
  return "진형을 변경했습니다";
}
