// One-shot legacy stamp: social events without characterId get characterId = event.id.
// docs/specs/2026-07-14-character-id-relationship-gate.md §3
import type { Command, Condition, GameEvent, Project } from "./types";

/** Mutates events in place. Idempotent: never overwrites non-empty characterId. */
export function stampCharacterIdsForSocialEvents(project: Project): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      stampEventIfNeeded(event);
    }
  }
}

export function stampEventIfNeeded(event: GameEvent): boolean {
  if (event.characterId?.trim()) return false;
  if (!eventHasSocialSurface(event)) return false;
  event.characterId = event.id;
  return true;
}

export function eventHasSocialSurface(event: GameEvent): boolean {
  if (event.giftPrefs !== undefined || event.giftResponses !== undefined) return true;
  if (event.talkFriendship !== undefined && event.talkFriendship !== false) return true;
  if (event.condition && conditionIsSocial(event.condition)) return true;
  if (commandsHaveSocial(event.commands)) return true;
  for (const page of event.pages ?? []) {
    if (page.conditions.some(conditionIsSocial)) return true;
    if (commandsHaveSocial(page.commands)) return true;
  }
  return false;
}

function conditionIsSocial(condition: Condition): boolean {
  return condition.kind === "friendshipAtLeast" || condition.kind === "relationshipAtLeast";
}

function commandsHaveSocial(commands: readonly Command[] | undefined): boolean {
  if (!commands) return false;
  for (const command of commands) {
    if (commandIsSocial(command)) return true;
  }
  return false;
}

function commandIsSocial(command: Command): boolean {
  switch (command.kind) {
    case "setRelationship":
    case "changeFriendship":
    case "getFriendship":
      return true;
    case "fork":
      if (conditionIsSocial(command.condition)) return true;
      return commandsHaveSocial(command.then) || commandsHaveSocial(command.else);
    case "choices":
      return command.options.some((option) => commandsHaveSocial(option.branch))
        || commandsHaveSocial(command.cancelBranch);
    case "loop":
      return commandsHaveSocial(command.body);
    case "shop":
      return commandsHaveSocial(command.transactionBranch);
    case "inn":
      return commandsHaveSocial(command.notEnoughBranch);
    case "promoteActor":
      return commandsHaveSocial(command.successBranch) || commandsHaveSocial(command.failureBranch);
    case "evolveMonster":
      return commandsHaveSocial(command.successBranch) || commandsHaveSocial(command.failureBranch);
    default:
      return false;
  }
}
