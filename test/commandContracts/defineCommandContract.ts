import type { CommandKind } from "@/project/commandKindRegistry";
import type { CommandContractDefinition } from "./specTypes";

const definedKinds = new Set<CommandKind>();

export function defineCommandContract<K extends CommandKind>(
  definition: CommandContractDefinition<K>
): CommandContractDefinition<K> {
  definedKinds.add(definition.kind);
  return definition;
}

export function definedCommandContractKinds(): readonly CommandKind[] {
  return [...definedKinds].sort();
}
