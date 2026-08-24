import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import {
  GENRE_PACK_IDS,
  type GenrePackId,
} from "@/project/genrePackId";
import type { Project } from "@/project/types";

export { GENRE_PACK_IDS } from "@/project/genrePackId";
export type { GenrePackId } from "@/project/genrePackId";

export type GenrePackRequirementKind =
  | "map"
  | "map-event"
  | "farmable-map"
  | "database-crops"
  | "database-monsters"
  | "database-troops"
  | "farm-tools"
  | "system-time"
  | "system-gifts"
  | "system-monster-collection";

export type GenrePackRequirement = {
  readonly id: string;
  readonly kind: GenrePackRequirementKind;
  readonly runtimeCapability: string;
};

export type GenrePackRecipe = {
  readonly id: string;
  readonly starterKind: "blank-project";
  readonly enables: readonly string[];
};

export type GenrePackDefinition = {
  readonly id: GenrePackId;
  readonly starter: { readonly defaultRecipeId: string; readonly projectSchema: "Project" };
  readonly navigation: { readonly sections: readonly { readonly id: string; readonly target: "canvas" | "database" | "events" | "test" }[] };
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

function definePack(options: {
  id: GenrePackId;
  recipeIds: readonly string[];
  vocabulary: Readonly<Record<string, string>>;
  requirements: readonly GenrePackRequirement[];
}): GenrePackDefinition {
  const recipes = options.recipeIds.map((id) => ({
    id,
    starterKind: "blank-project" as const,
    enables: [options.id],
  }));
  return {
    id: options.id,
    starter: { defaultRecipeId: recipes[0]!.id, projectSchema: "Project" },
    navigation: { sections: sharedNavigation },
    vocabulary: options.vocabulary,
    recipes,
    lint: options.requirements.map((requirement) => ({
      id: `missing-${requirement.id}`,
      requirementId: requirement.id,
      severity: "warning" as const,
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
    recipeIds: ["adventure-village"],
    vocabulary: { actor: "hero", event: "quest", enemy: "enemy", map: "area" },
    requirements: [
      { id: "world-map", kind: "map", runtimeCapability: "map-runtime" },
      { id: "quest-event", kind: "map-event", runtimeCapability: "event-interpreter" },
    ],
  }),
  "monster-collect": definePack({
    id: "monster-collect",
    recipeIds: ["monster-journey", "partner-raise"],
    vocabulary: { actor: "trainer", enemy: "wild monster", party: "partners", item: "care item" },
    requirements: [
      { id: "monster-collection", kind: "system-monster-collection", runtimeCapability: "monster-collection" },
      { id: "monster-species", kind: "database-monsters", runtimeCapability: "monster-battle-party" },
      { id: "monster-troops", kind: "database-troops", runtimeCapability: "battle-runtime" },
    ],
  }),
  "horror-chase": definePack({
    id: "horror-chase",
    recipeIds: ["horror-gallery", "school-horror"],
    vocabulary: { actor: "survivor", enemy: "pursuer", event: "scare", map: "room" },
    requirements: [
      { id: "horror-space", kind: "map", runtimeCapability: "map-runtime" },
      { id: "horror-loop", kind: "map-event", runtimeCapability: "event-interpreter" },
    ],
  }),
  "story-cutscene": definePack({
    id: "story-cutscene",
    recipeIds: ["memory-story"],
    vocabulary: { actor: "character", event: "scene", map: "stage", item: "story prop" },
    requirements: [
      { id: "story-stage", kind: "map", runtimeCapability: "map-runtime" },
      { id: "cutscene-event", kind: "map-event", runtimeCapability: "event-interpreter" },
    ],
  }),
  "farm-life": definePack({
    id: "farm-life",
    recipeIds: ["farm-blank"],
    vocabulary: { actor: "resident", enemy: "hazard", event: "daily event", item: "produce", map: "farm" },
    requirements: [
      { id: "time-system", kind: "system-time", runtimeCapability: "game-time" },
      { id: "gift-system", kind: "system-gifts", runtimeCapability: "friendship-gifts" },
      { id: "farmable-map", kind: "farmable-map", runtimeCapability: "farming" },
      { id: "crop-records", kind: "database-crops", runtimeCapability: "crop-growth" },
      { id: "farm-tools", kind: "farm-tools", runtimeCapability: "farm-tool-actions" },
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
  readonly projectSchema: "Project";
  readonly replaceOpenProject: false;
  readonly aiRequired: false;
};

export function createGenreStarterPlan(packId: GenrePackId, recipeId: string): GenreStarterPlan {
  const pack = genrePackById(packId);
  if (!pack.recipes.some((recipe) => recipe.id === recipeId)) {
    throw new Error(`Unknown starter recipe for ${packId}: ${recipeId}`);
  }
  return { packId, recipeId, projectSchema: "Project", replaceOpenProject: false, aiRequired: false };
}

/** Explicit manual action: always creates a detached standard Project; it never accepts or mutates the open project. */
export function createProjectFromGenreStarterPlan(plan: GenreStarterPlan): Project {
  createGenreStarterPlan(plan.packId, plan.recipeId);
  const project = createBlankProject();
  applyGenrePreset(project, plan.packId);
  return project;
}

export type GenrePackReadiness = {
  readonly packId: GenrePackId;
  readonly ready: boolean;
  readonly checks: readonly { readonly id: string; readonly ready: boolean; readonly runtimeCapability: string }[];
};

function requirementReady(project: Project, kind: GenrePackRequirementKind): boolean {
  switch (kind) {
    case "map": return Object.keys(project.maps).length > 0;
    case "map-event": return Object.values(project.maps).some((map) => map.events.length > 0);
    case "farmable-map": return Object.values(project.maps).some((map) => (map.farmableArea?.length ?? 0) > 0);
    case "database-crops": return (project.database.crops?.length ?? 0) > 0;
    case "database-monsters": return (project.database.monsterSpecies?.length ?? 0) > 0;
    case "database-troops": return project.database.troops.length > 0;
    case "farm-tools": return project.database.items.some((item) => item.farmTool !== undefined);
    case "system-time": return project.system.timeSystem?.enabled === true;
    case "system-gifts": return project.system.giftSystem === true;
    case "system-monster-collection": return project.system.monsterCollection === true;
  }
}

export function evaluateGenrePackReadiness(project: Project, packId: GenrePackId): GenrePackReadiness {
  const checks = genrePackById(packId).runtimeRequirements.map((requirement) => ({
    id: requirement.id,
    ready: requirementReady(project, requirement.kind),
    runtimeCapability: requirement.runtimeCapability,
  }));
  return { packId, ready: checks.every((check) => check.ready), checks };
}

// Compile-time exhaustiveness guard: registry and canonical id list must stay aligned.
GENRE_PACK_IDS.forEach((id) => void PACKS[id]);
