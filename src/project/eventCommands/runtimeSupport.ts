import type { Command } from "@/project/types";
import {
  M2_MAP_COMMON_FULL_IDS,
  M2_PERSISTED_BEHAVIOR_IDS,
  M2_SYNTHETIC_EDITOR_ONLY_IDS,
  M2_TROOP_FULL_IDS,
} from "./m2RuntimeClassificationData";
import { M2_PARTIAL_EFFECT_DECLARATIONS } from "./m2PartialEffectDeclarations";

export { M2_PERSISTED_BEHAVIOR_IDS } from "./m2RuntimeClassificationData";
export { M2_PARTIAL_EFFECT_DECLARATIONS } from "./m2PartialEffectDeclarations";

export type CommandRuntimeSupport = "runtime-full" | "runtime-partial" | "editor-only";

export type CommandRuntimeSupportBadge = {
  readonly support: Exclude<CommandRuntimeSupport, "runtime-full">;
  readonly label: string;
  readonly icon: string;
  readonly tooltip: string;
};

export type M2PersistedBehaviorClass = keyof typeof M2_PERSISTED_BEHAVIOR_IDS;
export type M2RuntimeContext = "map" | "common" | "troop";

export type M2RuntimeClassification = {
  readonly commandId: string;
  readonly behaviorClass: M2PersistedBehaviorClass;
  readonly supportByContext: Readonly<Record<M2RuntimeContext, CommandRuntimeSupport>>;
  readonly effectCoverage: M2EffectCoverage;
};

export type M2EffectCoverage = {
  readonly supportedEffects: readonly string[];
  readonly unsupportedEffects: readonly string[];
};

export class M2RuntimeClassificationError extends Error {
  readonly commandId: string;

  constructor(commandId: string) {
    super(`Unclassified M2 command: ${commandId}`);
    this.name = "M2RuntimeClassificationError";
    this.commandId = commandId;
  }
}

class M2PartialEffectDeclarationError extends Error {
  constructor(commandId: string) {
    super(`Missing partial M2 effect declaration: ${commandId}`);
    this.name = "M2PartialEffectDeclarationError";
  }
}

const BATTLE_EVENT_RUNTIME_FULL_KINDS: ReadonlySet<Command["kind"]> = new Set([
  "text",
  "choices",
  "fork",
  "setSwitch",
  "setVariable",
  "changeItem",
  "changeFriendship",
  "getFriendship",
  "callCommonEvent",
  "changeActorHp",
  "changeActorMp",
  "recoverAll",
  "m2Command",
]);

export function commandRuntimeSupport(command: Command, context?: M2RuntimeContext): CommandRuntimeSupport {
  if (command.kind !== "m2Command") return "runtime-full";
  return m2CommandRuntimeSupport(command.commandId, context);
}

export function battleEventCommandRuntimeSupport(command: Command): CommandRuntimeSupport {
  if (command.kind === "m2Command") return m2CommandRuntimeSupport(command.commandId, "troop");
  return BATTLE_EVENT_RUNTIME_FULL_KINDS.has(command.kind) ? "runtime-full" : "runtime-partial";
}

export function m2CommandRuntimeClassification(commandId: string): M2RuntimeClassification {
  const behaviorClass = behaviorClassFor(commandId);
  if (behaviorClass === "editorOnly") {
    return {
      commandId,
      behaviorClass,
      supportByContext: { map: "editor-only", common: "editor-only", troop: "editor-only" },
      effectCoverage: effectCoverageFor(commandId, behaviorClass),
    };
  }
  const mapCommonSupport = includesId(M2_MAP_COMMON_FULL_IDS, commandId) ? "runtime-full" : "runtime-partial";
  return {
    commandId,
    behaviorClass,
    supportByContext: {
      map: mapCommonSupport,
      common: mapCommonSupport,
      troop: includesId(M2_TROOP_FULL_IDS, commandId) ? "runtime-full" : "runtime-partial",
    },
    effectCoverage: effectCoverageFor(commandId, behaviorClass),
  };
}

export function m2CommandRuntimeSupport(
  commandId: string,
  context?: M2RuntimeContext
): CommandRuntimeSupport {
  const classification = m2CommandRuntimeClassification(commandId);
  if (context) return classification.supportByContext[context];
  // 컨텍스트를 모르면 세 컨텍스트(map/common/troop) 중 최저 지원으로 보수 판정한다.
  // behaviorClass "full" 이라도 M2_MAP_COMMON_FULL_IDS / M2_TROOP_FULL_IDS 밖이면
  // 해당 컨텍스트에서는 partial 이므로, 무컨텍스트 판정이 runtime-full 을 주장하면 거짓이 된다.
  return conservativeM2CommandRuntimeSupport(classification);
}

const RUNTIME_SUPPORT_RANK: Readonly<Record<CommandRuntimeSupport, number>> = {
  "runtime-full": 2,
  "runtime-partial": 1,
  "editor-only": 0,
};

function conservativeM2CommandRuntimeSupport(classification: M2RuntimeClassification): CommandRuntimeSupport {
  const { map, common, troop } = classification.supportByContext;
  return [common, troop].reduce(
    (worst, candidate) => (RUNTIME_SUPPORT_RANK[candidate] < RUNTIME_SUPPORT_RANK[worst] ? candidate : worst),
    map
  );
}

export function catalogRowRuntimeSupport(
  commandId: string,
  existingKind: Command["kind"] | undefined,
  context?: M2RuntimeContext
): CommandRuntimeSupport {
  // 네이티브 kind 로 변환되어 삽입되는 행은 실제 실행이 네이티브 인터프리터 경로다.
  if (existingKind) return "runtime-full";
  return m2CommandRuntimeSupport(commandId, context);
}

function behaviorClassFor(commandId: string): M2PersistedBehaviorClass {
  if (includesId(M2_PERSISTED_BEHAVIOR_IDS.nativeAlias, commandId)) return "nativeAlias";
  if (includesId(M2_PERSISTED_BEHAVIOR_IDS.full, commandId)) return "full";
  if (includesId(M2_PERSISTED_BEHAVIOR_IDS.partial, commandId)) return "partial";
  if (includesId(M2_PERSISTED_BEHAVIOR_IDS.editorOnly, commandId)) return "editorOnly";
  if (includesId(M2_SYNTHETIC_EDITOR_ONLY_IDS, commandId)) return "editorOnly";
  throw new M2RuntimeClassificationError(commandId);
}

function includesId(ids: readonly string[], commandId: string): boolean {
  return ids.some((id) => id === commandId);
}

function effectCoverageFor(commandId: string, behaviorClass: M2PersistedBehaviorClass): M2EffectCoverage {
  switch (behaviorClass) {
    case "nativeAlias":
      return {
        supportedEffects: ["picker conversion to native command"],
        unsupportedEffects: ["implicit persisted native-equivalent effect"],
      };
    case "full":
      return { supportedEffects: ["declared context runtime effect"], unsupportedEffects: [] };
    case "partial": {
      const declaration = M2_PARTIAL_EFFECT_DECLARATIONS.find((candidate) => includesId(candidate.ids, commandId));
      if (!declaration) throw new M2PartialEffectDeclarationError(commandId);
      return {
        supportedEffects: declaration.supportedEffects,
        unsupportedEffects: declaration.unsupportedEffects,
      };
    }
    case "editorOnly":
      return {
        supportedEffects: ["editor authoring and persistence"],
        unsupportedEffects: ["runtime effect"],
      };
  }
}

export function runtimeSupportBadge(support: CommandRuntimeSupport): CommandRuntimeSupportBadge | null {
  if (support === "runtime-full") return null;
  if (support === "runtime-partial") {
    return {
      support,
      label: "부분 실행",
      icon: "△",
      tooltip: "이 명령은 런타임에서 기록되거나 일부 효과만 실행됩니다.",
    };
  }
  return {
    support,
    label: "에디터 전용",
    icon: "!",
    tooltip: "이 명령은 아직 런타임에서 실행되지 않습니다.",
  };
}
