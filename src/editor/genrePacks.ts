import { configureEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import { defaultOpeningSequence } from "@/project/defaults/defaultOpeningSequence";
import { inBounds, isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import { GENRE_PACK_IDS, type GenrePackId } from "@/project/genrePackId";
import { isActionCombatMap } from "@/project/actionCombat";
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
  | "system-action-combat"
  | "action-map"
  | "action-spawn"
  | "system-monster-collection";

export type GenrePackRequirement = {
  readonly id: string;
  readonly kind: GenrePackRequirementKind;
  readonly runtimeCapability: string;
};

export type GenrePackNavigationTarget = "canvas" | "database" | "events" | "test";

export type GenrePackSystemPresetRecipe = {
  readonly id: string;
  readonly title: string;
  readonly starterKind: "blank-project-system-preset";
  readonly appliesSystemFields: readonly string[];
};

export type GenrePackDefinition = {
  readonly id: GenrePackId;
  readonly starter: { readonly defaultRecipeId: string; readonly projectSchema: "Project" };
  readonly navigation: { readonly sections: readonly { readonly id: string; readonly target: GenrePackNavigationTarget }[] };
  readonly vocabulary: Readonly<Record<string, string>>;
  readonly recipes: readonly GenrePackSystemPresetRecipe[];
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
  readonly title: string;
  readonly appliesSystemFields: readonly string[];
}): GenrePackSystemPresetRecipe {
  return { ...options, starterKind: "blank-project-system-preset" };
}

function definePack(options: {
  id: GenrePackId;
  recipes: readonly GenrePackSystemPresetRecipe[];
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
  "action-rpg": definePack({
    id: "action-rpg",
    recipes: [recipe({
      id: "action-system",
      title: "2D 액션 RPG 시스템 프리셋",
      appliesSystemFields: ["system.genre", "system.actionCombat"],
    })],
    vocabulary: { actor: "fighter", enemy: "field enemy", map: "arena", event: "interaction" },
    requirements: [
      { id: "action-system", kind: "system-action-combat", runtimeCapability: "action-combat" },
      { id: "action-map", kind: "action-map", runtimeCapability: "action-combat" },
      { id: "action-spawn", kind: "action-spawn", runtimeCapability: "field-spawns" },
      { id: "lint-errors", kind: "project-lint-errors", runtimeCapability: "project-lint" },
      { id: "reference-integrity", kind: "project-reference-integrity", runtimeCapability: "reference-validation" },
    ],
  }),
  "adventure-jrpg": definePack({
    id: "adventure-jrpg",
    recipes: [recipe({
      id: "adventure-system",
      title: "기본 JRPG 시스템 프리셋",
      appliesSystemFields: ["system.genre", "system.battleParty", "system.menuUiStyle", "system.companions"],
    })],
    vocabulary: { actor: "hero", event: "quest", enemy: "enemy", map: "area" },
    requirements: [
      { id: "world-map", kind: "map", runtimeCapability: "map-runtime" },
      { id: "quest-event", kind: "map-event", runtimeCapability: "event-interpreter" },
      { id: "battle-troops", kind: "database-troops", runtimeCapability: "battle-runtime" },
      { id: "lint-errors", kind: "project-lint-errors", runtimeCapability: "project-lint" },
      { id: "reference-integrity", kind: "project-reference-integrity", runtimeCapability: "reference-validation" },
    ],
  }),
  "monster-collect": definePack({
    id: "monster-collect",
    recipes: [recipe({
      id: "monster-system",
      title: "몬스터 수집 시스템 프리셋",
      appliesSystemFields: [
        "system.genre",
        "system.monsterCollection",
        "system.monsterBattleParty",
        "system.battleUiStyle",
        "system.battleModel",
        "system.monsterCare",
      ],
    })],
    vocabulary: { actor: "trainer", enemy: "wild monster", party: "partners", item: "care item" },
    requirements: [
      { id: "monster-collection", kind: "system-monster-collection", runtimeCapability: "monster-collection" },
      { id: "monster-species", kind: "database-monsters", runtimeCapability: "monster-battle-party" },
      { id: "monster-troops", kind: "database-troops", runtimeCapability: "battle-runtime" },
    ],
  }),
  "horror-chase": definePack({
    id: "horror-chase",
    recipes: [recipe({
      id: "horror-system",
      title: "공포 추격 시스템 프리셋",
      appliesSystemFields: ["system.genre"],
    })],
    vocabulary: { actor: "survivor", enemy: "pursuer", event: "scare", map: "room" },
    requirements: [
      { id: "horror-space", kind: "map", runtimeCapability: "map-runtime" },
      { id: "horror-loop", kind: "map-event", runtimeCapability: "event-interpreter" },
    ],
  }),
  "story-cutscene": definePack({
    id: "story-cutscene",
    recipes: [recipe({
      id: "story-system",
      title: "스토리 컷신 시스템 프리셋",
      appliesSystemFields: ["system.genre"],
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
      id: "farm-system",
      title: "농장 생활 시스템 프리셋",
      appliesSystemFields: ["system.genre", "system.timeSystem", "system.giftSystem", "system.skillSystem"],
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

export type GenreBlankProjectSystemPresetPlan = {
  readonly kind: "blank-project-system-preset";
  readonly packId: GenrePackId;
  readonly recipeId: string;
  readonly title: string;
  readonly projectSchema: "Project";
  readonly preservesOpenProjectUntilRemoteVerified: true;
  readonly aiRequired: false;
};

export type GenreBlankProjectSystemPresetReceipt = {
  readonly kind: "blank-project-system-preset";
  readonly packId: GenrePackId;
  readonly recipeId: string;
  readonly projectSchema: "Project";
  readonly appliedSystemGenre: GenrePackId;
  readonly authoredContentSeeded: false;
};

export type GenreBlankProjectSystemPresetResult = {
  readonly project: Project;
  readonly receipt: GenreBlankProjectSystemPresetReceipt;
};

function recipeById(packId: GenrePackId, recipeId: string): GenrePackSystemPresetRecipe {
  const found = genrePackById(packId).recipes.find((candidate) => candidate.id === recipeId);
  if (!found) throw new Error(`Unknown starter recipe for ${packId}: ${recipeId}`);
  return found;
}

export function createGenreBlankProjectSystemPresetPlan(
  packId: GenrePackId,
  recipeId: string,
): GenreBlankProjectSystemPresetPlan {
  const selectedRecipe = recipeById(packId, recipeId);
  return {
    kind: "blank-project-system-preset",
    packId,
    recipeId,
    title: selectedRecipe.title,
    projectSchema: "Project",
    preservesOpenProjectUntilRemoteVerified: true,
    aiRequired: false,
  };
}

/**
 * Pure blank-project system preset. It creates one detached canonical Project
 * and applies only shared system fields. It never authors genre maps/events/records.
 */
export function materializeGenreBlankProjectSystemPreset(
  plan: GenreBlankProjectSystemPresetPlan,
): GenreBlankProjectSystemPresetResult {
  const canonical = createGenreBlankProjectSystemPresetPlan(plan.packId, plan.recipeId);
  if (
    plan.kind !== "blank-project-system-preset"
    || plan.title !== canonical.title
    || plan.projectSchema !== "Project"
    || plan.preservesOpenProjectUntilRemoteVerified !== true
    || plan.aiRequired !== false
  ) {
    throw new Error(`System preset plan does not match registry contract: ${plan.packId}/${plan.recipeId}`);
  }

  const project = createBlankProject();
  project.meta = { ...project.meta, title: canonical.title };
  project.system.opening = defaultOpeningSequence(canonical.title);
  applyGenrePreset(project, canonical.packId);
  if (canonical.packId === "monster-collect") configureEmeraldMonsterStyle(project);
  return {
    project,
    receipt: {
      kind: "blank-project-system-preset",
      packId: canonical.packId,
      recipeId: canonical.recipeId,
      projectSchema: "Project",
      appliedSystemGenre: canonical.packId,
      authoredContentSeeded: false,
    },
  };
}

export function createProjectFromGenreBlankProjectSystemPreset(
  plan: GenreBlankProjectSystemPresetPlan,
): Project {
  return materializeGenreBlankProjectSystemPreset(plan).project;
}

/**
 * 「새 프로젝트」 메뉴의 씨앗. packId 가 null 이면 빈 프로젝트를 그대로 돌려주고,
 * 팩이 있으면 그 팩의 기본 레시피로 시스템 프리셋을 적용한다.
 * 맵·이벤트·DB 레코드는 만들지 않는다 — 바뀌는 건 system.* 토글뿐이다.
 */
export function createNewProjectSeed(packId: GenrePackId | null, title?: string): Project {
  const project = packId === null ? createBlankProject() : createProjectFromGenreBlankProjectSystemPreset(
    createGenreBlankProjectSystemPresetPlan(packId, genrePackById(packId).starter.defaultRecipeId),
  );
  if (title !== undefined) {
    project.meta.title = title;
    project.system.opening = defaultOpeningSequence(title);
    // 게임 타이틀 화면 제목도 같이 옮긴다 — 안 하면 기본값 「새 프로젝트」가 그대로 떠서
    // 마법사에서 이름을 지은 게임의 타이틀이 「새 프로젝트」였다(2026-09-23 도그푸딩).
    if (project.system.titleScreen) project.system.titleScreen.title = title;
  }
  return project;
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
    case "system-action-combat": return project.system.actionCombat?.enabled === true;
    case "action-map": return Object.values(project.maps).some((map) => isActionCombatMap(project, map));
    case "action-spawn": return Object.values(project.maps).some((map) => isActionCombatMap(project, map)
      && (map.fieldSpawns ?? []).some((spawn) => {
        const troop = project.database.troops.find((entry) => entry.id === spawn.troopId);
        const enemyId = troop?.members?.[0]?.enemyId ?? troop?.enemyIds[0];
        return project.database.enemies.some((enemy) => enemy.id === enemyId && enemy.actionProfile !== undefined);
      }));
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

export type GenrePackPlayableReadiness = {
  readonly packId: GenrePackId;
  readonly configured: boolean;
  readonly playable: false;
  readonly status: "not-configured" | "unverified";
  readonly receiptAccepted: false;
  readonly configuration: GenrePackConfiguration;
};

export function evaluateGenrePackPlayableReadiness(
  project: Project,
  packId: GenrePackId,
): GenrePackPlayableReadiness {
  const configuration = evaluateGenrePackConfiguration(project, packId);
  return {
    packId,
    configured: configuration.configured,
    playable: false,
    status: configuration.configured ? "unverified" : "not-configured",
    receiptAccepted: false,
    configuration,
  };
}

// Compile-time exhaustiveness guard: registry and canonical id list must stay aligned.
GENRE_PACK_IDS.forEach((id) => void PACKS[id]);
