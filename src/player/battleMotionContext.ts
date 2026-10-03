import type { BattleSnapshot } from "@/battle/types";
import { resolveCharacterMotion } from "@/assets/characterMotionCatalog";
import { store } from "@/project/store";
const contexts = new WeakMap<HTMLElement, BattleSnapshot>();
/** Called before sequencer planning. Plans freeze the returned values for an entire action. */
export function setBattleMotionContext(
  field: HTMLElement,
  snapshot: BattleSnapshot,
): void {
  contexts.set(field, snapshot);
}
export function battleCharacterMotion(
  field: HTMLElement,
  recordId: string | undefined,
) {
  const project = store.getCurrent(),
    snapshot = contexts.get(field);
  const actorId =
    snapshot?.actors.find((a) => a.id === recordId)?.recordId ?? recordId;
  const actor = project.database.actors.find((a) => a.id === actorId);
  if (!actor) return undefined;
  const state = contexts.get(field)?.eventState;
  const equipment = state?.actorEquipment?.[actor.id] ?? actor.initialEquipment;
  const weapon = project.database.equipment.find(
    (e) => e.id === equipment.weapon,
  );
  return resolveCharacterMotion(
    actor,
    weapon,
    state?.classOverrides?.[actor.id] ?? actor.classId,
  );
}

export function battleTargetRecoil(
  field: HTMLElement,
  node: HTMLElement,
): number {
  const character = battleCharacterMotion(
    field,
    node.dataset.recordId ?? node.dataset.testid,
  );
  if (character) return character.recoil;
  const enemy = store
    .getCurrent()
    .database.enemies.find((e) => e.id === node.dataset.recordId);
  const cell = Number(node.dataset.pixelEnemyCell) || 48;
  return Math.max(0.3, Math.min(1.25, 48 / cell)) * (enemy?.flying ? 0.75 : 1);
}
