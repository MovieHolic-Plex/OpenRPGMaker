import { removedDatabaseReference, withOpenEventDrafts, type SmallTaskDraftSource } from "@/ai/smallTaskReferences";
import { resolveClassBattleCommand } from "@/battle/battleCommands";
import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import { referenceIndex } from "@/editor/tools/dbReferenceIndex";
import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import type { BattleEventCondition, Command, Project, TroopMemberRecord, TroopRecord } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { SmallTaskError, type SmallTaskTarget } from "../../../target";
import { PrimitiveError } from "../../errors";

export function battleCommandSlotIds(project: Project, live?: SmallTaskDraftSource): ReadonlySet<string> {
  const ids = new Set<string>();
  const collect = (snapshot: Project) => visitProjectCommands(snapshot, ({ command }) => {
    if (command.kind !== "m2Command" || command.commandId !== "m2-092-change-battle-commands"
      || command.fields.operation !== "set" || typeof command.fields.slots !== "string") return;
    for (const id of command.fields.slots.split(",")) {
      if (id.trim()) ids.add(id.trim());
    }
  });
  const working = withOpenEventDrafts(project, live);
  collect(working);
  const saved = projectViewWithoutEventDrafts(working);
  if (saved !== working) collect(saved);
  return ids;
}

export function troopHasEncounter(project: Project, id: string, live?: SmallTaskDraftSource): boolean {
  const sites = referenceIndex(withOpenEventDrafts(project, live), new Set([id])).get(id);
  return sites?.some(({ asKey, path }) => !asKey
    && (path.at(-1) === "troopId" || path.at(-1) === "initialTroopId" || path.at(-2) === "troopIds")) ?? false;
}

export function assertUnit20DraftReferences(before: Project, after: Project, live: Project, target: Extract<SmallTaskTarget, { kind: "dbEntry" }>): void {
  const { collection, id } = target;
  if (collection !== "enemies" && collection !== "troops" && collection !== "battleCommands") return;
  if (collection === "battleCommands" && after.database.battleCommands !== before.database.battleCommands) {
    const existing = new Set(before.database.battleCommands?.map(row => row.id));
    const added = after.database.battleCommands?.filter(row => !existing.has(row.id));
    if (added?.length) {
      const slots = battleCommandSlotIds(before, live);
      const references = referenceIndex(live, new Set(added.map(row => row.id)));
      if (added.some(row => slots.has(row.id) || references.has(row.id))) {
        throw new SmallTaskError("열린 이벤트가 새 전투 명령의 식별자를 사용 중이에요. 연결을 먼저 확인해 주세요.");
      }
    }
  }
  if (collection === "troops") {
    const previous = before.database.troops.find(row => row.id === id);
    const next = after.database.troops.find(row => row.id === id);
    if ((previous?.members?.length || previous?.enemyIds.length)
      && next && !next.members?.length && !next.enemyIds.length && troopHasEncounter(after, id, live)) {
      throw new SmallTaskError("열린 이벤트에서 사용 중인 무리에는 적을 한 마리 이상 남겨 주세요.");
    }
  }
  if (!before.database[collection]?.some(row => row.id === id) || after.database[collection]?.some(row => row.id === id)) return;
  if (removedDatabaseReference(before, after, [target], live)
    || (collection === "battleCommands" && battleCommandSlotIds(after, live).has(id))) {
    throw new SmallTaskError("다른 설정이나 열린 이벤트에서 사용 중이에요. 연결을 먼저 해제해 주세요.");
  }
}

export function protectTroopTargets(
  project: Project, troop: TroopRecord, previous: readonly TroopMemberRecord[], replacement: readonly TroopMemberRecord[],
): void {
  const before = previous.map(member => member.enemyId);
  const after = replacement.map(member => member.enemyId);
  // Battle runtime resolves both slot and record IDs to the first matching battler.
  const firstMatch = (members: readonly string[], id: string) =>
    members.findIndex((recordId, index) => recordId === id || `enemy-${index + 1}` === id);
  const changed = (id: string | undefined) => {
    if (!id) return false;
    const oldIndex = firstMatch(before, id);
    const newIndex = firstMatch(after, id);
    return oldIndex !== newIndex || before[oldIndex] !== after[newIndex];
  };
  const remainingIds = new Set(after);
  const removedIds = new Set(before.filter(id => !remainingIds.has(id)));
  const revealChanged = (target: string): boolean => {
    const slot = previous.findIndex((_, index) => `enemy-${index + 1}` === target);
    const nextSlot = replacement.findIndex((_, index) => `enemy-${index + 1}` === target);
    if (slot >= 0 || nextSlot >= 0) return slot !== nextSlot || before[slot] !== after[nextSlot];
    const hiddenSeats = (members: readonly TroopMemberRecord[]) => members.flatMap((member, index) =>
      member.hidden && (target === "all" || member.enemyId === target) ? [{ index, enemyId: member.enemyId }] : []);
    return !jsonEqual(hiddenSeats(previous), hiddenSeats(replacement));
  };
  const conditionChanged = (condition: BattleEventCondition): boolean => {
    switch (condition.kind) {
      case "all":
      case "any":
        return condition.conditions.some(conditionChanged);
      case "not":
        return conditionChanged(condition.condition);
      case "enemyTurn":
      case "enemyState":
      case "enemiesAlive":
        return condition.enemyId !== undefined && removedIds.has(condition.enemyId);
      default:
        return "enemyId" in condition && changed(condition.enemyId);
    }
  };
  if (troop.battleEventPages.some(page => page.conditions.some(conditionChanged))
    || troop.battleGuests?.some(guest => guest.conditions.some(conditionChanged))) {
    throw new PrimitiveError("전투 조건이 가리키는 적이 바뀌거나 사라져요. 조건에서 적을 먼저 다시 골라 주세요.");
  }

  const visited = new Set<string>();
  const commonEventChanged = (id: string): boolean => {
    if (visited.has(id)) return false;
    visited.add(id);
    return project.commonEvents.find(event => event.id === id)?.commands.some(commandChanged) ?? false;
  };
  const commandChanged = (command: Command): boolean => {
    if (command.kind === "callCommonEvent" && commonEventChanged(command.commonEventId)) return true;
    if (command.kind === "showAnimation" && typeof command.target === "object"
      && "eventId" in command.target && changed(command.target.eventId)) return true;
    if (command.kind === "m2Command") {
      const parsed = parseM2BattleCommand(command);
      switch (parsed?.kind) {
        case "callCommonEvent":
          if (commonEventChanged(parsed.commonEventId.trim())) return true;
          break;
        case "enemyEncounter":
          if (revealChanged(parsed.target)) return true;
          break;
        case "changeEnemyHp":
        case "changeEnemyMp":
        case "changeEnemyState":
        case "moveEnemy":
        case "showAnimation":
          if (changed(parsed.target)) return true;
      }
    }
    return eventCommandBranches(command).some(branch => branch.commands.some(commandChanged));
  };
  // Catalog, class and equipment commands can also call an event during battle.
  const menuCommands = [
    ...(project.database.battleCommands ?? []),
    ...project.database.classes.flatMap(klass => klass.battleCommands),
    ...project.database.equipment.map(equipment => equipment.grantsCommand),
  ];
  if (troop.battleEventPages.some(page => page.commands.some(commandChanged))
    || menuCommands.some(command => {
      const commonEventId = command && resolveClassBattleCommand(project, command)?.commonEventId;
      return commonEventId ? commonEventChanged(commonEventId) : false;
    })) {
    throw new PrimitiveError("전투 명령이나 공통 이벤트가 가리키는 적이 바뀌거나 사라져요. 연결을 먼저 확인해 주세요.");
  }
}
