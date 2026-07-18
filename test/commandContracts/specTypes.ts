import type { CommandKind } from "@/project/commandKindRegistry";
import type { Command } from "@/project/types";

export const COMMAND_CONTRACT_CASE_NAMES = [
  "happy",
  "edge",
  "roundtrip",
  "pauseOrTermination",
] as const;

export type CommandContractCaseName = (typeof COMMAND_CONTRACT_CASE_NAMES)[number];

export type CommandContractCase = {
  readonly name: string;
  readonly run: () => void;
};

export type CommandContractDefinition<K extends CommandKind = CommandKind> = {
  readonly kind: K;
  readonly happy: CommandContractCase;
  readonly edge: CommandContractCase;
  readonly roundtrip: CommandContractCase;
  readonly pauseOrTermination: CommandContractCase;
};

export type NativeSpecFamily =
  | "dialogue"
  | "controlFlow"
  | "state"
  | "scene"
  | "system";

type CommandFor<K extends CommandKind> = Extract<Command, { kind: K }>;

export type NativeFoundationSetup = {
  readonly runtimeContext: "map";
  readonly projectReferences: {
    readonly mapIds: readonly ["map_contract"];
    readonly eventIds: readonly ["event_contract"];
    readonly commonEventIds: readonly ["common_contract"];
    readonly troopIds: readonly ["troop_contract"];
    readonly actorIds: readonly ["actor_contract"];
    readonly classIds: readonly ["class_contract"];
    readonly skillIds: readonly ["skill_contract"];
    readonly itemIds: readonly ["item_contract"];
    readonly recipeIds: readonly ["recipe_contract"];
    readonly upgradeIds: readonly ["upgrade_contract"];
    readonly resourceIds: readonly ["resource_contract"];
  };
  readonly sessionSeed: {
    readonly switches: readonly [readonly ["switch_contract", false]];
    readonly variables: readonly [readonly ["variable_contract", 0]];
    readonly inventory: readonly [readonly ["item_contract", 0]];
    readonly flags: readonly [];
  };
};

export type NativeFoundationCase<K extends CommandKind> = {
  readonly fixture: {
    readonly ownership: "test-owned";
    readonly caseName: CommandContractCaseName;
    readonly eventId: "event_contract";
  };
  readonly setup: NativeFoundationSetup;
  readonly command: CommandFor<K>;
  readonly expected: {
    readonly commandAfterRoundtrip: CommandFor<K>;
    readonly allowedCompletions: readonly ["finished", "owner-handoff"];
    readonly forbiddenWarningCodes: readonly ["unknown-command-kind"];
  };
};

export type NativeManifestEntry<K extends CommandKind = CommandKind> = {
  readonly kind: K;
  readonly family: NativeSpecFamily;
  readonly requiredCases: readonly CommandContractCaseName[];
  readonly cases: Readonly<Record<CommandContractCaseName, NativeFoundationCase<K>>>;
};

export type NativeManifest = {
  readonly [K in CommandKind]: NativeManifestEntry<K>;
};

const FOUNDATION_SETUP: NativeFoundationSetup = {
  runtimeContext: "map",
  projectReferences: {
    mapIds: ["map_contract"],
    eventIds: ["event_contract"],
    commonEventIds: ["common_contract"],
    troopIds: ["troop_contract"],
    actorIds: ["actor_contract"],
    classIds: ["class_contract"],
    skillIds: ["skill_contract"],
    itemIds: ["item_contract"],
    recipeIds: ["recipe_contract"],
    upgradeIds: ["upgrade_contract"],
    resourceIds: ["resource_contract"],
  },
  sessionSeed: {
    switches: [["switch_contract", false]],
    variables: [["variable_contract", 0]],
    inventory: [["item_contract", 0]],
    flags: [],
  },
};

export function nativeManifestEntry<K extends CommandKind>(
  family: NativeSpecFamily,
  command: CommandFor<K>
): NativeManifestEntry<K> {
  return {
    kind: command.kind,
    family,
    requiredCases: COMMAND_CONTRACT_CASE_NAMES,
    cases: {
      happy: foundationCase("happy", command),
      edge: foundationCase("edge", command),
      roundtrip: foundationCase("roundtrip", command),
      pauseOrTermination: foundationCase("pauseOrTermination", command),
    },
  };
}

function foundationCase<K extends CommandKind>(
  caseName: CommandContractCaseName,
  command: CommandFor<K>
): NativeFoundationCase<K> {
  return {
    fixture: { ownership: "test-owned", caseName, eventId: "event_contract" },
    setup: FOUNDATION_SETUP,
    command,
    expected: {
      commandAfterRoundtrip: command,
      allowedCompletions: ["finished", "owner-handoff"],
      forbiddenWarningCodes: ["unknown-command-kind"],
    },
  };
}
