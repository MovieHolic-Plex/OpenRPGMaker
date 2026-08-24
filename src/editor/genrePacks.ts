import { inBounds, isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import { GENRE_PACK_IDS, type GenrePackId } from "@/project/genrePackId";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { projectLint } from "@/project/lint/projectLint";
import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import type { GameMap, Project } from "@/project/types";

export { GENRE_PACK_IDS } from "@/project/genrePackId";
export type { GenrePackId } from "@/project/genrePackId";

export type GenrePackRequirementKind =
  | "map"
  | "map-event"
  | "farmable-map"
  | "farmable-bounds"
  | "farm-start-route"
  | "database-crops"
  | "database-crop-references"
  | "database-monsters"
  | "database-troops"
  | "farm-start-tools"
  | "farm-start-seeds"
  | "project-lint-errors"
  | "project-reference-integrity"
  | "system-time"
  | "system-gifts"
  | "system-monster-collection";

export type GenrePackRequirement = {
  readonly id: string;
  readonly kind: GenrePackRequirementKind;
  readonly runtimeCapability: string;
};

export type GenreStarterAdapterId =
  | "adventure-village-v1"
  | "monster-journey-v1"
  | "partner-raise-v1"
  | "horror-gallery-v1"
  | "school-horror-v1"
  | "memory-story-v1"
  | "farm-blank-v1";

export type GenrePackNavigationTarget = "canvas" | "database" | "events" | "test";

export type GenrePackRecipe = {
  readonly id: string;
  readonly adapterId: GenreStarterAdapterId;
  readonly title: string;
  readonly starterKind: "project-adapter";
  readonly initialNavigationTarget: GenrePackNavigationTarget;
  readonly enables: readonly string[];
};

export type GenrePackDefinition = {
  readonly id: GenrePackId;
  readonly starter: { readonly defaultRecipeId: string; readonly projectSchema: "Project" };
  readonly navigation: { readonly sections: readonly { readonly id: string; readonly target: GenrePackNavigationTarget }[] };
  readonly vocabulary: Readonly<Record<string, string>>;
  readonly recipes: readonly GenrePackRecipe[];
  readonly lint: readonly { readonly id: string; readonly requirementId: string; readonly severity: "warning" | "error" }[];
  readonly journeys: readonly { readonly id: string; readonly steps: readonly { readonly id: string; readonly requirementIds: readonly string[] }[] }[];
  readonly runtimeRequirements: readonly GenrePackRequirement[];
};

const sharedNavigation = [
  { id: "world", target: "canvas" },
  { id: "records", target: "database" },
  { id: "logic", target: "events" },
  { id: "play", target: "test" },
] as const;

function recipe(options: {
  readonly id: string;
  readonly adapterId: GenreStarterAdapterId;
  readonly title: string;
  readonly initialNavigationTarget: GenrePackNavigationTarget;
  readonly enables: readonly string[];
}): GenrePackRecipe {
  return { ...options, starterKind: "project-adapter" };
}

function definePack(options: {
  id: GenrePackId;
  recipes: readonly GenrePackRecipe[];
  vocabulary: Readonly<Record<string, string>>;
  requirements: readonly GenrePackRequirement[];
}): GenrePackDefinition {
  return {
    id: options.id,
    starter: { defaultRecipeId: options.recipes[0]!.id, projectSchema: "Project" },
    navigation: { sections: sharedNavigation },
    vocabulary: options.vocabulary,
    recipes: options.recipes,
    lint: options.requirements.map((requirement) => ({
      id: `missing-${requirement.id}`,
      requirementId: requirement.id,
      severity: requirement.kind === "project-lint-errors" || requirement.kind === "project-reference-integrity"
        ? "error" as const
        : "warning" as const,
    })),
    journeys: [{
      id: `${options.id}-first-playable`,
      steps: options.requirements.map((requirement) => ({
        id: `verify-${requirement.id}`,
        requirementIds: [requirement.id],
      })),
    }],
    runtimeRequirements: options.requirements,
  };
}

const PACKS: Readonly<Record<GenrePackId, GenrePackDefinition>> = {
  "adventure-jrpg": definePack({
    id: "adventure-jrpg",
    recipes: [recipe({
      id: "adventure-village",
      adapterId: "adventure-village-v1",
      title: "모험 마을",
      initialNavigationTarget: "canvas",
      enables: ["map-runtime", "event-interpreter"],
    })],
    vocabulary: { actor: "hero", event: "quest", enemy: "enemy", map: "area" },
    requirements: [
      { id: "world-map", kind: "map", runtimeCapability: "map-runtime" },
      { id: "quest-event", kind: "map-event", runtimeCapability: "event-interpreter" },
    ],
  }),
  "monster-collect": definePack({
    id: "monster-collect",
    recipes: [
      recipe({
        id: "monster-journey",
        adapterId: "monster-journey-v1",
        title: "몬스터 여정",
        initialNavigationTarget: "canvas",
        enables: ["monster-collection", "monster-battle-party"],
      }),
      recipe({
        id: "partner-raise",
        adapterId: "partner-raise-v1",
        title: "파트너 성장",
        initialNavigationTarget: "database",
        enables: ["monster-collection", "monster-care"],
      }),
    ],
    vocabulary: { actor: "trainer", enemy: "wild monster", party: "partners", item: "care item" },
    requirements: [
      { id: "monster-collection", kind: "system-monster-collection", runtimeCapability: "monster-collection" },
      { id: "monster-species", kind: "database-monsters", runtimeCapability: "monster-battle-party" },
      { id: "monster-troops", kind: "database-troops", runtimeCapability: "battle-runtime" },
    ],
  }),
  "horror-chase": definePack({
    id: "horror-chase",
    recipes: [
      recipe({
        id: "horror-gallery",
        adapterId: "horror-gallery-v1",
        title: "저주받은 갤러리",
        initialNavigationTarget: "events",
        enables: ["map-runtime", "event-interpreter"],
      }),
      recipe({
        id: "school-horror",
        adapterId: "school-horror-v1",
        title: "학교 괴담",
        initialNavigationTarget: "canvas",
        enables: ["map-runtime", "event-interpreter"],
      }),
    ],
    vocabulary: { actor: "survivor", enemy: "pursuer", event: "scare", map: "room" },
    requirements: [
      { id: "horror-space", kind: "map", runtimeCapability: "map-runtime" },
      { id: "horror-loop", kind: "map-event", runtimeCapability: "event-interpreter" },
    ],
  }),
  "story-cutscene": definePack({
    id: "story-cutscene",
    recipes: [recipe({
      id: "memory-story",
      adapterId: "memory-story-v1",
      title: "기억의 장면",
      initialNavigationTarget: "events",
      enables: ["map-runtime", "event-interpreter"],
    })],
    vocabulary: { actor: "character", event: "scene", map: "stage", item: "story prop" },
    requirements: [
      { id: "story-stage", kind: "map", runtimeCapability: "map-runtime" },
      { id: "cutscene-event", kind: "map-event", runtimeCapability: "event-interpreter" },
    ],
  }),
  "farm-life": definePack({
    id: "farm-life",
    recipes: [recipe({
      id: "farm-blank",
      adapterId: "farm-blank-v1",
      title: "농장 생활",
      initialNavigationTarget: "canvas",
      enables: ["game-time", "friendship-gifts", "farming", "crop-growth"],
    })],
    vocabulary: { actor: "resident", enemy: "hazard", event: "daily event", item: "produce", map: "farm" },
    requirements: [
      { id: "time-system", kind: "system-time", runtimeCapability: "game-time" },
      { id: "gift-system", kind: "system-gifts", runtimeCapability: "friendship-gifts" },
      { id: "farmable-map", kind: "farmable-map", runtimeCapability: "farming" },
      { id: "farmable-bounds", kind: "farmable-bounds", runtimeCapability: "farming" },
      { id: "farm-start-route", kind: "farm-start-route", runtimeCapability: "map-runtime" },
      { id: "crop-records", kind: "database-crops", runtimeCapability: "crop-growth" },
      { id: "crop-references", kind: "database-crop-references", runtimeCapability: "crop-growth" },
      { id: "farm-tools", kind: "farm-start-tools", runtimeCapability: "farm-tool-actions" },
      { id: "farm-seeds", kind: "farm-start-seeds", runtimeCapability: "crop-growth" },
      { id: "lint-errors", kind: "project-lint-errors", runtimeCapability: "project-lint" },
      { id: "reference-integrity", kind: "project-reference-integrity", runtimeCapability: "reference-validation" },
    ],
  }),
};

export function genrePackById(id: GenrePackId): GenrePackDefinition {
  return PACKS[id];
}

export function resolveGenreVocabulary(id: GenrePackId, term: string): string {
  return PACKS[id].vocabulary[term] ?? term;
}

export type GenreStarterPlan = {
  readonly packId: GenrePackId;
  readonly recipeId: string;
  readonly adapterId: GenreStarterAdapterId;
  readonly title: string;
  readonly initialNavigationTarget: GenrePackNavigationTarget;
  readonly projectSchema: "Project";
  readonly replaceOpenProject: false;
  readonly aiRequired: false;
};

export type GenreStarterAdapterReceipt = {
  readonly packId: GenrePackId;
  readonly recipeId: string;
  readonly adapterId: GenreStarterAdapterId;
  readonly projectSchema: "Project";
  readonly appliedSystemGenre: GenrePackId;
  readonly authoredContentSeeded: false;
  readonly initialNavigationTarget: GenrePackNavigationTarget;
};

export type GenreStarterAdapterResult = {
  readonly project: Project;
  readonly receipt: GenreStarterAdapterReceipt;
};

function recipeById(packId: GenrePackId, recipeId: string): GenrePackRecipe {
  const found = genrePackById(packId).recipes.find((candidate) => candidate.id === recipeId);
  if (!found) throw new Error(`Unknown starter recipe for ${packId}: ${recipeId}`);
  return found;
}

export function createGenreStarterPlan(packId: GenrePackId, recipeId: string): GenreStarterPlan {
  const selectedRecipe = recipeById(packId, recipeId);
  return {
    packId,
    recipeId,
    adapterId: selectedRecipe.adapterId,
    title: selectedRecipe.title,
    initialNavigationTarget: selectedRecipe.initialNavigationTarget,
    projectSchema: "Project",
    replaceOpenProject: false,
    aiRequired: false,
  };
}

/**
 * Pure recipe adapter. It creates one detached canonical Project and applies only
 * standard system opt-ins plus recipe identity. It never seeds authored maps/events/records.
 */
export function adaptGenreStarterPlan(plan: GenreStarterPlan): GenreStarterAdapterResult {
  const canonical = createGenreStarterPlan(plan.packId, plan.recipeId);
  if (
    plan.adapterId !== canonical.adapterId
    || plan.title !== canonical.title
    || plan.initialNavigationTarget !== canonical.initialNavigationTarget
    || plan.projectSchema !== "Project"
    || plan.replaceOpenProject !== false
    || plan.aiRequired !== false
  ) {
    throw new Error(`Starter plan does not match recipe contract: ${plan.packId}/${plan.recipeId}`);
  }

  const project = createBlankProject();
  project.meta = { ...project.meta, title: canonical.title };
  applyGenrePreset(project, canonical.packId);
  return {
    project,
    receipt: {
      packId: canonical.packId,
      recipeId: canonical.recipeId,
      adapterId: canonical.adapterId,
      projectSchema: "Project",
      appliedSystemGenre: canonical.packId,
      authoredContentSeeded: false,
      initialNavigationTarget: canonical.initialNavigationTarget,
    },
  };
}

/** Compatibility projection for callers that only need the detached Project. */
export function createProjectFromGenreStarterPlan(plan: GenreStarterPlan): Project {
  return adaptGenreStarterPlan(plan).project;
}

export type GenrePackConfiguration = {
  readonly packId: GenrePackId;
  readonly configured: boolean;
  readonly checks: readonly { readonly id: string; readonly configured: boolean; readonly runtimeCapability: string }[];
};

function validFarmableEntries(project: Project): readonly { readonly map: GameMap; readonly x: number; readonly y: number }[] {
  const entries: { map: GameMap; x: number; y: number }[] = [];
  for (const map of Object.values(project.maps)) {
    for (const rect of map.farmableArea ?? []) {
      if (
        !Number.isInteger(rect.x)
        || !Number.isInteger(rect.y)
        || !Number.isInteger(rect.w)
        || !Number.isInteger(rect.h)
        || rect.w <= 0
        || rect.h <= 0
        || rect.x < 0
        || rect.y < 0
        || rect.x + rect.w > map.width
        || rect.y + rect.h > map.height
      ) continue;
      for (let y = rect.y; y < rect.y + rect.h; y += 1) {
        for (let x = rect.x; x < rect.x + rect.w; x += 1) entries.push({ map, x, y });
      }
    }
  }
  return entries;
}

function farmableBoundsConfigured(project: Project): boolean {
  const declared = Object.values(project.maps).flatMap((map) => map.farmableArea ?? []);
  if (declared.length === 0) return false;
  return Object.values(project.maps).every((map) => (map.farmableArea ?? []).every((rect) => (
    Number.isInteger(rect.x)
    && Number.isInteger(rect.y)
    && Number.isInteger(rect.w)
    && Number.isInteger(rect.h)
    && rect.w > 0
    && rect.h > 0
    && rect.x >= 0
    && rect.y >= 0
    && rect.x + rect.w <= map.width
    && rect.y + rect.h <= map.height
  )));
}

function farmStartRouteConfigured(project: Project): boolean {
  const map = project.maps[project.startMapId];
  if (!map || !inBounds(map, project.startPos.x, project.startPos.y) || !isPassable(project, map, project.startPos.x, project.startPos.y)) {
    return false;
  }
  const reachable = computeReachableCells(project, map, project.startPos.x, project.startPos.y);
  return validFarmableEntries(project).some((entry) => (
    entry.map.id === project.startMapId
    && isAdjacentOrOn(reachable, entry.x, entry.y)
  ));
}

function hasFarmToolInStartingInventory(project: Project, farmTool: "hoe" | "wateringCan"): boolean {
  return project.database.items.some((item) => item.farmTool === farmTool && (project.session.inventory[item.id] ?? 0) > 0);
}

function cropReferencesConfigured(project: Project): boolean {
  const crops = project.database.crops ?? [];
  const itemIds = new Set(project.database.items.map((item) => item.id));
  return crops.length > 0 && crops.every((crop) => itemIds.has(crop.seedItemId) && itemIds.has(crop.harvestItemId));
}

function farmSeedsConfigured(project: Project): boolean {
  return (project.database.crops ?? []).some((crop) => (project.session.inventory[crop.seedItemId] ?? 0) > 0);
}

function requirementConfigured(project: Project, kind: GenrePackRequirementKind): boolean {
  switch (kind) {
    case "map": return Object.keys(project.maps).length > 0;
    case "map-event": return Object.values(project.maps).some((map) => map.events.length > 0);
    case "farmable-map": return Object.values(project.maps).some((map) => (map.farmableArea?.length ?? 0) > 0);
    case "farmable-bounds": return farmableBoundsConfigured(project);
    case "farm-start-route": return farmStartRouteConfigured(project);
    case "database-crops": return (project.database.crops?.length ?? 0) > 0;
    case "database-crop-references": return cropReferencesConfigured(project);
    case "database-monsters": return (project.database.monsterSpecies?.length ?? 0) > 0;
    case "database-troops": return project.database.troops.length > 0;
    case "farm-start-tools": return hasFarmToolInStartingInventory(project, "hoe") && hasFarmToolInStartingInventory(project, "wateringCan");
    case "farm-start-seeds": return farmSeedsConfigured(project);
    case "project-lint-errors": return !projectLint(project).some((issue) => issue.severity === "error");
    case "project-reference-integrity": return collectProjectReferenceIssues(project).length === 0;
    case "system-time": return project.system.timeSystem?.enabled === true;
    case "system-gifts": return project.system.giftSystem === true;
    case "system-monster-collection": return project.system.monsterCollection === true;
  }
}

export function evaluateGenrePackConfiguration(project: Project, packId: GenrePackId): GenrePackConfiguration {
  const checks = genrePackById(packId).runtimeRequirements.map((requirement) => ({
    id: requirement.id,
    configured: requirementConfigured(project, requirement.kind),
    runtimeCapability: requirement.runtimeCapability,
  }));
  return { packId, configured: checks.every((check) => check.configured), checks };
}

export type GenrePackRuntimeReceipt = {
  readonly contractVersion: 1;
  readonly packId: GenrePackId;
  readonly projectSignature: string;
  readonly source: "runtime" | "headless";
  readonly booted: boolean;
  readonly completedJourneyIds: readonly string[];
  readonly lintErrorCount: number;
  readonly referenceIssueCount: number;
};

export type GenrePackPlayableReadiness = {
  readonly packId: GenrePackId;
  readonly configured: boolean;
  readonly playable: boolean;
  readonly status: "not-configured" | "runtime-proof-required" | "receipt-rejected" | "playable";
  readonly receiptAccepted: boolean;
  readonly configuration: GenrePackConfiguration;
};

export function genrePackProjectSignature(project: Project): string {
  const input = JSON.stringify(project);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `genre-pack-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** Adapter for a real runtime/headless runner to bind its evidence to one exact project snapshot. */
export function createGenrePackRuntimeReceipt(
  project: Project,
  evidence: Pick<GenrePackRuntimeReceipt, "packId" | "source" | "booted" | "completedJourneyIds">,
): GenrePackRuntimeReceipt {
  return {
    contractVersion: 1,
    ...evidence,
    projectSignature: genrePackProjectSignature(project),
    lintErrorCount: projectLint(project).filter((issue) => issue.severity === "error").length,
    referenceIssueCount: collectProjectReferenceIssues(project).length,
  };
}

function acceptsRuntimeReceipt(project: Project, packId: GenrePackId, receipt: GenrePackRuntimeReceipt): boolean {
  const requiredJourneyId = genrePackById(packId).journeys[0]!.id;
  return receipt.contractVersion === 1
    && receipt.packId === packId
    && (receipt.source === "runtime" || receipt.source === "headless")
    && receipt.booted === true
    && receipt.projectSignature === genrePackProjectSignature(project)
    && receipt.completedJourneyIds.includes(requiredJourneyId)
    && receipt.lintErrorCount === 0
    && receipt.referenceIssueCount === 0;
}

export function evaluateGenrePackPlayableReadiness(
  project: Project,
  packId: GenrePackId,
  receipt?: GenrePackRuntimeReceipt,
): GenrePackPlayableReadiness {
  const configuration = evaluateGenrePackConfiguration(project, packId);
  const receiptAccepted = receipt !== undefined && acceptsRuntimeReceipt(project, packId, receipt);
  const playable = configuration.configured && receiptAccepted;
  const status = !configuration.configured
    ? "not-configured" as const
    : receipt === undefined
      ? "runtime-proof-required" as const
      : receiptAccepted
        ? "playable" as const
        : "receipt-rejected" as const;
  return { packId, configured: configuration.configured, playable, status, receiptAccepted, configuration };
}

// Compile-time exhaustiveness guard: registry and canonical id list must stay aligned.
GENRE_PACK_IDS.forEach((id) => void PACKS[id]);
