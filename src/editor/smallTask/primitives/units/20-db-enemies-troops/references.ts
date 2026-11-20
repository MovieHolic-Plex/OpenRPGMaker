import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import type { BattleEventCondition, Command, Project, TroopRecord } from "@/project/types";
import { PrimitiveError } from "../../errors";

export function battleCommandSlotIds(project: Project): ReadonlySet<string> {
  const ids = new Set<string>();
  const collect = (snapshot: Project) => visitProjectCommands(snapshot, ({ command }) => {
    if (command.kind !== "m2Command" || command.commandId !== "m2-092-change-battle-commands"
      || command.fields.operation !== "set" || typeof command.fields.slots !== "string") return;
    for (const id of command.fields.slots.split(",")) {
      if (id.trim()) ids.add(id.trim());
    }
  });
  collect(project);
  const saved = projectViewWithoutEventDrafts(project);
  if (saved !== project) collect(saved);
  return ids;
}

export function protectTroopTargets(
  project: Project, troop: TroopRecord, before: readonly string[], after: readonly string[],
): void {
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
        case "changeEnemyHp":
        case "changeEnemyMp":
        case "changeEnemyState":
        case "enemyEncounter":
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
    || menuCommands.some(command => command?.kind === "commonEvent" && command.commonEventId && commonEventChanged(command.commonEventId))) {
    throw new PrimitiveError("전투 명령이나 공통 이벤트가 가리키는 적이 바뀌거나 사라져요. 연결을 먼저 확인해 주세요.");
  }
}
