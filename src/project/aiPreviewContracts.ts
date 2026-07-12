import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { type CharsetDirection, type EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import type { TileAiMetadata, TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";

export type AiPreviewConfidence = "high" | "low" | "medium";
export type AiPreviewMissingEvidenceCode =
  | "charset_not_high_confidence"
  | "chipset_not_renderable"
  | "incomplete_runtime_arrays"
  | "missing_semantic_groups"
  | "missing_theme_capability"
  | "tile_metadata_not_high_confidence"
  | "tile_out_of_range"
  | "unsupported_theme";

export type AiPreviewMissingEvidence = {
  readonly code: AiPreviewMissingEvidenceCode;
  readonly detail: string;
  readonly tileIds?: readonly number[];
};

export type AiPreviewThemeId = "combined-town" | "dungeon" | "interior-house";
export type AiPreviewThemeCapability =
  | "buildingShell"
  | "decorProp"
  | "doorOrEntrance"
  | "roomTrim"
  | "solidBoundary"
  | "walkableFloor"
  | "wallFace"
  | "waterOrHazard";

export type AiPreviewMetadataPackEvidence = {
  readonly metadataPackId: string;
  readonly metadataPackVersion: string;
  readonly bundledTextureIds: readonly string[];
};

export type AiPreviewThemeRoleRequirement = {
  readonly capability: AiPreviewThemeCapability;
  readonly allowedRoles: readonly TileGroupRole[];
  readonly required: boolean;
  readonly allowedDefaultLayers?: readonly TileGroupMetadata["defaultLayer"][];
  readonly requiresPatternGrammar?: boolean;
  readonly requiredPassage?: NonNullable<TileAiMetadata["passage"]>;
};

export type AiPreviewThemeEligibilityEvidence = {
  readonly themeId: AiPreviewThemeId;
  readonly metadataPack: AiPreviewMetadataPackEvidence;
  readonly satisfiedCapabilities: readonly AiPreviewThemeCapability[];
  readonly missingCapabilities: readonly AiPreviewThemeCapability[];
  readonly semanticGroups: readonly TileGroupMetadata[];
};

export type AiPreviewGrammarEvidence = {
  readonly themeId: AiPreviewThemeId;
  readonly grammarId: string;
  readonly grammarVersion: string;
  readonly deterministic: true;
  readonly selectedCapabilities: readonly AiPreviewThemeCapability[];
};

export type AiPreviewDeferredCommandContract = {
  readonly status: "deferred";
  readonly reason: "event-dialogue-generation-not-in-v2";
  readonly allowedFutureScopes: readonly ("dialogue" | "eventCommands")[];
};

export type AiPreviewClarification = {
  readonly question: string;
  readonly missingEvidence: readonly AiPreviewMissingEvidence[];
};

export type AiChipsetCandidate = {
  readonly tilesetId: string;
  readonly textureKey: string;
  readonly confidence: "high";
  readonly semanticGroups: readonly TileGroupMetadata[];
};

export type AiCharsetCandidate = {
  readonly assetId: string;
  readonly textureKey: string;
  readonly characterIndex: number;
  readonly direction: CharsetDirection;
  readonly pattern: number;
  readonly confidence: "high";
  readonly reason: string;
};

export type AiPreviewNpcEvidence = {
  readonly eventId: string;
  readonly displayName: string;
  readonly role: string;
  readonly charsetAssetId: string;
  readonly charsetFrame: {
    readonly characterIndex: number;
    readonly direction: CharsetDirection;
    readonly pattern: number;
  };
  readonly sourceGoal: string;
  readonly confidence: "high";
  readonly placementReason: string;
};

export type AiPreviewValidationEvidence = {
  readonly validTilesetId: boolean;
  readonly validLayerLengths: boolean;
  readonly inRangeTileIds: boolean;
  readonly passabilityCovered: boolean;
  readonly priorityCovered: boolean;
  readonly terrainCovered: boolean;
  readonly validStartPosition: boolean;
  readonly boundaryCollisionChecked: boolean;
  readonly reachableNpcEvents: boolean;
};

export type AiPreviewEvidence = {
  readonly sourceGoal: string;
  readonly chipsetCandidate: AiChipsetCandidate;
  readonly charsetCandidates: readonly AiCharsetCandidate[];
  readonly tileGroups: readonly TileGroupMetadata[];
  readonly themeEligibility?: AiPreviewThemeEligibilityEvidence;
  readonly grammarEvidence?: AiPreviewGrammarEvidence;
  readonly deferredCommandContract?: AiPreviewDeferredCommandContract;
  readonly npcMetadata: readonly AiPreviewNpcEvidence[];
  readonly validation: AiPreviewValidationEvidence;
  readonly missingEvidence: readonly AiPreviewMissingEvidence[];
  readonly clarificationQuestion: string | null;
};

export type ChipsetEligibilityOptions = {
  readonly requiredRoles?: readonly TileGroupRole[];
};

export type ThemeEligibilityResult =
  | {
      readonly eligible: true;
      readonly evidence: AiPreviewThemeEligibilityEvidence;
      readonly missingEvidence: readonly [];
      readonly clarificationQuestion: null;
    }
  | {
      readonly eligible: false;
      readonly evidence: AiPreviewThemeEligibilityEvidence;
      readonly missingEvidence: readonly AiPreviewMissingEvidence[];
      readonly clarificationQuestion: string;
    };

export const AI_PREVIEW_DEFERRED_COMMAND_CONTRACT: AiPreviewDeferredCommandContract = {
  status: "deferred",
  reason: "event-dialogue-generation-not-in-v2",
  allowedFutureScopes: ["dialogue", "eventCommands"],
};

export const AI_PREVIEW_THEME_REQUIREMENTS: Record<AiPreviewThemeId, readonly AiPreviewThemeRoleRequirement[]> = {
  "combined-town": [
    { capability: "walkableFloor", allowedRoles: ["terrain"], required: true, allowedDefaultLayers: ["lower"], requiresPatternGrammar: true, requiredPassage: "passable" },
    { capability: "waterOrHazard", allowedRoles: ["water"], required: true, allowedDefaultLayers: ["lower"], requiresPatternGrammar: true, requiredPassage: "solid" },
    { capability: "wallFace", allowedRoles: ["wall"], required: true, allowedDefaultLayers: ["lower"], requiresPatternGrammar: true, requiredPassage: "solid" },
    { capability: "buildingShell", allowedRoles: ["building"], required: true, allowedDefaultLayers: ["lower"], requiredPassage: "solid" },
    { capability: "decorProp", allowedRoles: ["prop", "fence", "roof"], required: false },
  ],
  dungeon: [
    { capability: "walkableFloor", allowedRoles: ["terrain"], required: true, allowedDefaultLayers: ["lower"], requiredPassage: "passable" },
    { capability: "solidBoundary", allowedRoles: ["wall"], required: true, allowedDefaultLayers: ["lower"], requiredPassage: "solid" },
    { capability: "roomTrim", allowedRoles: ["building", "prop"], required: false },
    { capability: "doorOrEntrance", allowedRoles: ["building", "prop"], required: false },
    { capability: "decorProp", allowedRoles: ["prop"], required: false },
  ],
  "interior-house": [
    { capability: "walkableFloor", allowedRoles: ["terrain"], required: true, allowedDefaultLayers: ["lower"], requiredPassage: "passable" },
    { capability: "wallFace", allowedRoles: ["wall"], required: true, allowedDefaultLayers: ["lower"], requiredPassage: "solid" },
    { capability: "roomTrim", allowedRoles: ["building", "prop"], required: true, requiredPassage: "solid" },
    { capability: "doorOrEntrance", allowedRoles: ["building", "prop"], required: false },
    { capability: "decorProp", allowedRoles: ["prop"], required: false },
  ],
};

export const AI_PREVIEW_THEME_METADATA_PACKS: Record<AiPreviewThemeId, AiPreviewMetadataPackEvidence> = {
  "combined-town": {
    metadataPackId: "combined-town-default-v1",
    metadataPackVersion: "1",
    bundledTextureIds: ["tex_easyrpg_chipset_combined_town"],
  },
  dungeon: {
    metadataPackId: "dungeon-v1",
    metadataPackVersion: "1",
    bundledTextureIds: ["tex_easyrpg_chipset_dungeon"],
  },
  "interior-house": {
    metadataPackId: "interior-house-v1",
    metadataPackVersion: "1",
    bundledTextureIds: ["tex_easyrpg_chipset_interior"],
  },
};

export type ChipsetEligibilityResult =
  | {
      readonly eligible: true;
      readonly candidate: AiChipsetCandidate;
      readonly missingEvidence: readonly [];
      readonly clarificationQuestion: null;
    }
  | {
      readonly eligible: false;
      readonly candidate: null;
      readonly missingEvidence: readonly AiPreviewMissingEvidence[];
      readonly clarificationQuestion: string;
    };

const DEFAULT_REQUIRED_ROLES = ["terrain", "water", "wall", "building"] as const satisfies readonly TileGroupRole[];
const HIGH_CONFIDENCE_SOURCES = new Set<TileAiMetadata["source"]>(["bundled-default", "user"]);

export function evaluateChipsetEligibility(
  tileset: TilesetDef,
  options: ChipsetEligibilityOptions = {}
): ChipsetEligibilityResult {
  const requiredRoles = options.requiredRoles ?? DEFAULT_REQUIRED_ROLES;
  const missingEvidence: AiPreviewMissingEvidence[] = [];
  const textureKey = renderableTilesetTextureKey(tileset);
  if (!textureKey) {
    missingEvidence.push({
      code: "chipset_not_renderable",
      detail: `Tileset ${tileset.id} does not reference a renderable bundled or uploaded image.`,
    });
  }

  if (!hasCompleteRuntimeArrays(tileset)) {
    missingEvidence.push({
      code: "incomplete_runtime_arrays",
      detail: `Tileset ${tileset.id} does not have passability, priority, and terrain arrays covering ${tileset.count} tiles.`,
    });
  }

  const invalidTileIds = (tileset.tileGroups ?? [])
    .filter((group) => requiredRoles.includes(group.role))
    .flatMap((group) => group.tileIds)
    .filter((tile) => !Number.isInteger(tile) || tile < 0 || tile >= tileset.count);
  if (invalidTileIds.length > 0) {
    missingEvidence.push({
      code: "tile_out_of_range",
      detail: `Tileset ${tileset.id} has semantic groups with out-of-range tile ids.`,
      tileIds: [...new Set(invalidTileIds)],
    });
  }

  const semanticGroups = highConfidenceSemanticGroups(tileset, requiredRoles, missingEvidence);
  const missingRoles = requiredRoles.filter((role) => !semanticGroups.some((group) => group.role === role));
  if (missingRoles.length > 0) {
    missingEvidence.push({
      code: "missing_semantic_groups",
      detail: `Tileset ${tileset.id} is missing high-confidence semantic groups for: ${missingRoles.join(", ")}.`,
    });
  }


  if (missingEvidence.length > 0 || !textureKey) {
    return {
      eligible: false,
      candidate: null,
      missingEvidence,
      clarificationQuestion: clarificationQuestionForMissingEvidence(missingEvidence),
    };
  }

  return {
    eligible: true,
    candidate: {
      tilesetId: tileset.id,
      textureKey,
      confidence: "high",
      semanticGroups: cloneTileGroups(semanticGroups),
    },
    missingEvidence: [],
    clarificationQuestion: null,
  };
}

export function evaluateThemeEligibility(
  tileset: TilesetDef,
  themeId: AiPreviewThemeId
): ThemeEligibilityResult {
  const metadataPack = AI_PREVIEW_THEME_METADATA_PACKS[themeId];
  const missingEvidence: AiPreviewMissingEvidence[] = [];
  const textureKey = bundledTilesetTextureKey(tileset);
  if (!textureKey || !metadataPack.bundledTextureIds.includes(textureKey)) {
    missingEvidence.push({
      code: "unsupported_theme",
      detail: `Theme ${themeId} requires an exact bundled texture match from metadata pack ${metadataPack.metadataPackId}.`,
    });
  }

  if (!hasCompleteRuntimeArrays(tileset)) {
    missingEvidence.push({
      code: "incomplete_runtime_arrays",
      detail: `Tileset ${tileset.id} does not have passability, priority, and terrain arrays covering ${tileset.count} tiles.`,
    });
  }

  const requirements = AI_PREVIEW_THEME_REQUIREMENTS[themeId];
  const capabilityMatches = requirements.map((requirement) => ({
    requirement,
    groups: highConfidenceGroupsForRequirement(tileset, requirement, requirement.required ? missingEvidence : null),
  }));
  const satisfiedCapabilities = capabilityMatches
    .filter((match) => match.groups.length > 0)
    .map((match) => match.requirement.capability);
  const missingCapabilities = capabilityMatches
    .filter((match) => match.requirement.required && match.groups.length === 0)
    .map((match) => match.requirement.capability);

  if (missingCapabilities.length > 0) {
    missingEvidence.push({
      code: "missing_theme_capability",
      detail: `Theme ${themeId} is missing required typed capabilities: ${missingCapabilities.join(", ")}.`,
    });
  }

  const evidence: AiPreviewThemeEligibilityEvidence = {
    themeId,
    metadataPack,
    satisfiedCapabilities,
    missingCapabilities,
    semanticGroups: cloneTileGroups(uniqueGroups(capabilityMatches.flatMap((match) => match.groups))),
  };

  if (missingEvidence.length > 0) {
    return {
      eligible: false,
      evidence,
      missingEvidence,
      clarificationQuestion: clarificationQuestionForMissingEvidence(missingEvidence),
    };
  }

  return {
    eligible: true,
    evidence,
    missingEvidence: [],
    clarificationQuestion: null,
  };
}

export function selectHighConfidenceCharsetCandidate(
  goal: string,
  preferredGroup?: string
): AiCharsetCandidate | null {
  const group = preferredGroup ?? charsetGroupForGoal(goal);
  if (!group) return null;
  const asset = CHARSET_ASSETS.find((candidate) => candidate.group === group);
  return asset ? charsetCandidate(asset, goal) : null;
}

export function missingPreviewClarification(missingEvidence: readonly AiPreviewMissingEvidence[]): AiPreviewClarification {
  return {
    question: clarificationQuestionForMissingEvidence(missingEvidence),
    missingEvidence,
  };
}

function charsetGroupForGoal(goal: string): string | null {
  const normalizedGoal = goal.toLowerCase();
  if (normalizedGoal.includes("people") || normalizedGoal.includes("npc") || normalizedGoal.includes("villager")) return "People";
  if (normalizedGoal.includes("마을") || normalizedGoal.includes("항구") || normalizedGoal.includes("사람") || normalizedGoal.includes("주민") || normalizedGoal.includes("npc")) return "People";
  if (normalizedGoal.includes("animal") || normalizedGoal.includes("동물")) return "Animal";
  if (normalizedGoal.includes("monster") || normalizedGoal.includes("몬스터")) return "Monster";
  if (normalizedGoal.includes("actor") || normalizedGoal.includes("영웅") || normalizedGoal.includes("주인공")) return "Actor";
  if (normalizedGoal.includes("object") || normalizedGoal.includes("오브젝트") || normalizedGoal.includes("소품")) return "Object";
  return null;
}

function renderableTilesetTextureKey(tileset: TilesetDef): string | null {
  if (tileset.image.type === "bundled" || tileset.image.type === "uploaded") return tileset.image.id;
  return null;
}

function bundledTilesetTextureKey(tileset: TilesetDef): string | null {
  if (tileset.image.type === "bundled") return tileset.image.id;
  return null;
}

export function hasCompleteRuntimeArrays(tileset: TilesetDef): boolean {
  for (let tile = 0; tile < tileset.count; tile += 1) {
    if (!isPassFlag(tileset.passability[tile])) return false;
    if (tileset.priority[tile] !== "lower" && tileset.priority[tile] !== "upper") return false;
    if (!Number.isFinite(tileset.terrain[tile])) return false;
  }
  return true;
}

function isPassFlag(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const flag = value as Partial<Record<"up" | "down" | "left" | "right", unknown>>;
  return typeof flag.up === "boolean" &&
    typeof flag.down === "boolean" &&
    typeof flag.left === "boolean" &&
    typeof flag.right === "boolean";
}

function highConfidenceSemanticGroups(
  tileset: TilesetDef,
  requiredRoles: readonly TileGroupRole[],
  missingEvidence: AiPreviewMissingEvidence[]
): readonly TileGroupMetadata[] {
  const groups = tileset.tileGroups ?? [];
  return groups.filter((group) => {
    if (!requiredRoles.includes(group.role)) return false;
    if (group.confidence !== "high") return false;
    if (!isHighConfidenceSource(group.source)) return false;
    if (group.defaultLayer === "event") return false;
    if (group.tileIds.length === 0) return false;
    if (needsPatternGrammar(group) && group.patternGrammar === undefined) return false;
    const lowEvidenceTiles = group.tileIds.filter((tile) => !hasHighConfidenceTileMetadata(tileset, tile));
    if (lowEvidenceTiles.length > 0) {
      missingEvidence.push({
        code: "tile_metadata_not_high_confidence",
        detail: `Group ${group.id} references tiles without high-confidence bundled-default or user metadata.`,
        tileIds: lowEvidenceTiles,
      });
      return false;
    }
    return true;
  });
}

function isHighConfidenceSource(source: TileAiMetadata["source"]): boolean {
  return HIGH_CONFIDENCE_SOURCES.has(source);
}
function needsPatternGrammar(group: TileGroupMetadata): boolean {
  return group.role === "terrain" || group.role === "water" || group.role === "wall";
}

function uniqueGroups(groups: readonly TileGroupMetadata[]): readonly TileGroupMetadata[] {
  const seen = new Set<string>();
  return groups.filter((group) => {
    if (seen.has(group.id)) return false;
    seen.add(group.id);
    return true;
  });
}

function highConfidenceGroupsForRequirement(
  tileset: TilesetDef,
  requirement: AiPreviewThemeRoleRequirement,
  missingEvidence: AiPreviewMissingEvidence[] | null
): readonly TileGroupMetadata[] {
  return (tileset.tileGroups ?? []).filter((group) => {
    if (!requirement.allowedRoles.includes(group.role)) return false;
    if (requirement.allowedDefaultLayers && !requirement.allowedDefaultLayers.includes(group.defaultLayer)) return false;
    if (requirement.requiresPatternGrammar && group.patternGrammar === undefined) return false;
    if (group.confidence !== "high") return false;
    if (!isHighConfidenceSource(group.source)) return false;
    if (group.defaultLayer === "event") return false;
    if (group.tileIds.length === 0) return false;
    const invalidTileIds = group.tileIds.filter((tile) => !Number.isInteger(tile) || tile < 0 || tile >= tileset.count);
    if (invalidTileIds.length > 0) {
      missingEvidence?.push({
        code: "tile_out_of_range",
        detail: `Group ${group.id} references out-of-range tile ids.`,
        tileIds: invalidTileIds,
      });
      return false;
    }
    const lowEvidenceTiles = group.tileIds.filter((tile) => !hasHighConfidenceTileMetadata(tileset, tile));
    if (lowEvidenceTiles.length > 0) {
      missingEvidence?.push({
        code: "tile_metadata_not_high_confidence",
        detail: `Group ${group.id} references tiles without high-confidence bundled-default or user metadata.`,
        tileIds: lowEvidenceTiles,
      });
      return false;
    }
    if (requirement.requiredPassage && group.tileIds.some((tile) => tileset.tileMeta?.[tile]?.passage !== requirement.requiredPassage)) return false;
    return true;
  });
}

function hasHighConfidenceTileMetadata(tileset: TilesetDef, tile: number): boolean {
  if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) return false;
  const meta = tileset.tileMeta?.[tile];
  if (!meta) return false;
  if (meta.confidence !== "high") return false;
  if (!isHighConfidenceSource(meta.source)) return false;
  if (meta.defaultLayer === "event") return false;
  return Boolean(meta.label.trim() || meta.description.trim() || meta.role);
}

function clarificationQuestionForMissingEvidence(missingEvidence: readonly AiPreviewMissingEvidence[]): string {
  if (missingEvidence.some((evidence) => evidence.code === "missing_semantic_groups" || evidence.code === "tile_metadata_not_high_confidence")) {
    return "이 제작 목표에 사용할 타일셋 의미 태그를 먼저 확인해 주세요: terrain/water/wall/building 중 어떤 타일 그룹을 사용할까요?";
  }
  if (missingEvidence.some((evidence) => evidence.code === "charset_not_high_confidence")) {
    return "이 제작 목표에 사용할 NPC CharSet 후보를 먼저 선택해 주세요.";
  }
  return "미리보기를 만들기 전에 부족한 에셋/타일셋 근거를 먼저 보완해 주세요.";
}

function cloneTileGroups(groups: readonly TileGroupMetadata[]): readonly TileGroupMetadata[] {
  return structuredClone(groups) as readonly TileGroupMetadata[];
}
function charsetCandidate(asset: EasyRpgCharsetAsset, goal: string): AiCharsetCandidate {
  return {
    assetId: asset.id,
    textureKey: asset.textureKey,
    characterIndex: 0,
    direction: "down",
    pattern: 1,
    confidence: "high",
    reason: `${asset.name} is a renderable EasyRPG CharSet candidate for ${goal}.`,
  };
}
