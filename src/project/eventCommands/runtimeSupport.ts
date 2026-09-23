import type { Command } from "@/project/types";
import { COMMAND_GUARANTEES, type CommandSupport } from "@/project/commandGuaranteeRegistry";
import { isSystemBgmCue, isSystemSeCue } from "@/project/systemAudioOverrides";
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

type CommandRuntimeTarget =
  | { readonly kind: Exclude<Command["kind"], "m2Command"> }
  | (Pick<Extract<Command, { kind: "m2Command" }>, "kind" | "commandId"> &
      Partial<Pick<Extract<Command, { kind: "m2Command" }>, "fields">>);

export type CommandRuntimeSupportReason =
  | "editor-only"
  | "context-unspecified"
  | "not-executed-in-context"
  | "battle-message-only"
  | "battle-presentation-metadata-only"
  | "input-not-awaited"
  | "non-sequential-battle-wait"
  | "system-audio-metadata-only"
  | "legacy-alias-not-equivalent"
  | "battle-context-required"
  | "coverage-unverified";

export type CommandRuntimeSupportDescriptor =
  | { readonly support: "runtime-full" }
  | (CommandRuntimeSupportBadge & {
      readonly reasonCode: CommandRuntimeSupportReason;
      readonly alternative?: { readonly kind: "playAudio"; readonly loop: boolean };
    });

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

// 배틀(troop) 네이티브 kind 배지의 SSOT 는 commandGuaranteeRegistry.supportByContext.troop 다.
// (2026-08-20 정직화: 기존 하드코딩 13종 배열이 executor 실측 22종과 어긋나 changeGold/changeExp/
//  changeLevel/learnSkill/changeParty/wait/playAudio/stopAudio 를 "부분 실행"으로 오표시했다.)
const NATIVE_SUPPORT_TO_RUNTIME_SUPPORT: Readonly<Record<CommandSupport, CommandRuntimeSupport>> = {
  full: "runtime-full",
  partial: "runtime-partial",
  editorOnly: "editor-only",
};

export function commandRuntimeSupport(command: CommandRuntimeTarget, context?: M2RuntimeContext): CommandRuntimeSupport {
  if (command.kind !== "m2Command") return nativeCommandRuntimeSupport(command.kind, context);
  if (context === "map" || context === "common") {
    const cue = command.fields?.cue;
    if (
      (command.commandId === "m2-027-change-system-bgm" && isSystemBgmCue(cue)) ||
      (command.commandId === "m2-028-change-system-se" && isSystemSeCue(cue))
    ) return "runtime-full";
  }
  return m2CommandRuntimeSupport(command.commandId, context);
}

export function battleEventCommandRuntimeSupport(command: Command): CommandRuntimeSupport {
  return commandRuntimeSupport(command, "troop");
}

/** Shared picker/list explanation. Grades remain owned by the existing guarantees. */
export function commandRuntimeSupportDescriptor(
  command: CommandRuntimeTarget,
  context?: M2RuntimeContext
): CommandRuntimeSupportDescriptor {
  const support = commandRuntimeSupport(command, context);
  if (support === "runtime-full") return { support };
  const limited = (
    reasonCode: CommandRuntimeSupportReason,
    label: string,
    tooltip: string
  ): CommandRuntimeSupportDescriptor => ({ support, reasonCode, label, tooltip, icon: support === "editor-only" ? "!" : "△" });
  if (support === "editor-only") {
    return limited("editor-only", "에디터 전용", "이 명령은 런타임에서 실행되지 않습니다. 편집용 기록으로 보관됩니다.");
  }
  if (!context) {
    return limited("context-unspecified", "실행 맥락 확인 필요", "맵·공통 이벤트·전투 중 어느 곳에서 실행할지 지정되지 않았습니다. 실행 맥락별 지원을 확인하세요.");
  }
  if (context === "troop") {
    switch (command.kind) {
      // Audited unsupported branches in battleEvents.ts. This is explanation
      // coverage, not an additional support/eligibility registry.
      case "m2Command":
      case "transfer": case "moveEvent": case "setEventGraphicPattern": case "changeTile":
      case "changeFactionStance": case "battleProcessing": case "showPicture": case "erasePicture":
      case "shop": case "inn": case "ending": case "returnToTitle": case "inputNumber": case "presentItem":
      case "enterHeroName": case "callMapEvent": case "cutsceneControl": case "checkpointSave":
      case "triggerEnding": case "setLighting": case "addLight": case "removeLight":
      case "showEmote": case "setWeather": case "addFollower": case "removeFollower":
      case "giveMonster": case "evolveMonster": case "openChest": case "advanceTime":
      case "setTime": case "sleepUntilMorning": case "craftRecipe": case "applyItemUpgrade":
      case "equipTool": case "changeLifeSkillExp": case "moveMonster": case "openSaveMenu":
      case "spawnFieldEnemy": case "despawnFieldEnemy": case "advanceCropGrowth": case "runControl":
      case "playMovie":
        return limited("not-executed-in-context", "전투에서 실행 안 됨", "이 명령의 효과는 전투 이벤트에서 실행되지 않습니다. 맵·공통 이벤트에서 사용할 때의 지원 범위를 확인하세요.");
    }
  }
  if (command.kind === "m2Command") {
    if (command.commandId === "m2-027-change-system-bgm" || command.commandId === "m2-028-change-system-se") {
      const loop = command.commandId === "m2-027-change-system-bgm";
      return {
        support,
        reasonCode: "system-audio-metadata-only",
        icon: "△",
        label: "시스템 소리 대상 필요",
        tooltip: `올바른 시스템 소리 대상이 지정되지 않아 시스템 재생 큐에 적용되지 않습니다. 명령 설정에서 대상을 선택하세요. 즉시 소리를 재생하려면 ${loop ? "BGM 재생(반복)" : "SE 재생(한 번)"}을 사용하세요. 채널·볼륨·페이드는 사운드 레이어에서 지정할 수 있습니다.`,
        alternative: { kind: "playAudio", loop },
      };
    }
    if (includesId(M2_TROOP_FULL_IDS, command.commandId)) {
      return limited("battle-context-required", "전투 실행 맥락 필요", "전투 상태를 다루는 명령입니다. 맵·공통 이벤트에는 실행 중인 전투가 없어 해당 전투 효과가 적용되지 않습니다.");
    }
    if (behaviorClassFor(command.commandId) === "nativeAlias") {
      return limited("legacy-alias-not-equivalent", "레거시 명령 확인 필요", "저장된 M2 레거시 형식은 명령 선택창이 만드는 기본 명령과 실행 경로가 다릅니다. 같은 효과를 보장하지 않으므로, 선택창에서 해당 명령을 다시 추가하고 설정을 확인하세요.");
    }
  }
  return limited("coverage-unverified", "지원 범위 미검증", "이 실행 맥락에서 모든 설정과 실제 효과까지 검증되지는 않았습니다. 특정 효과가 없다는 뜻은 아니며, 테스트 플레이로 필요한 동작을 확인하세요.");
}

export function nativeCommandRuntimeSupport(
  kind: Exclude<Command["kind"], "m2Command">,
  context?: M2RuntimeContext
): CommandRuntimeSupport {
  const supportByContext = COMMAND_GUARANTEES[kind].supportByContext;
  if (context) return NATIVE_SUPPORT_TO_RUNTIME_SUPPORT[supportByContext[context]];
  return conservativeRuntimeSupport(
    NATIVE_SUPPORT_TO_RUNTIME_SUPPORT[supportByContext.map],
    NATIVE_SUPPORT_TO_RUNTIME_SUPPORT[supportByContext.common],
    NATIVE_SUPPORT_TO_RUNTIME_SUPPORT[supportByContext.troop]
  );
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
  return conservativeRuntimeSupport(map, common, troop);
}

function conservativeRuntimeSupport(
  map: CommandRuntimeSupport,
  common: CommandRuntimeSupport,
  troop: CommandRuntimeSupport
): CommandRuntimeSupport {
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
  if (existingKind && existingKind !== "m2Command") return nativeCommandRuntimeSupport(existingKind, context);
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
