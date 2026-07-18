import type { CanonicalConstructionRoute, ConstructionWriteEntrypoint } from "./contracts";

export type CurrentConstructionRegistryState = {
  readonly registered: boolean;
  readonly deprecated: boolean;
  readonly supersededBy: string | null;
};

export type ConstructionWriteRouteManifestEntry = {
  readonly name: ConstructionWriteEntrypoint;
  readonly currentRegistry: CurrentConstructionRegistryState;
  readonly llmExposed: boolean;
  readonly defaultToolBrowserExposed: boolean;
  readonly directExecution: boolean;
  readonly supersededBy: CanonicalConstructionRoute | null;
  readonly implementation: string;
};

export const CONSTRUCTION_ROUTE_MANIFEST_PHASE = "canonical-migration-target" as const;

const CURRENTLY_UNREGISTERED = {
  registered: false,
  deprecated: false,
  supersededBy: null,
} as const;

const CURRENTLY_ACTIVE = {
  registered: true,
  deprecated: false,
  supersededBy: null,
} as const;

const CURRENT_LEGACY_HOUSE_COMPATIBILITY = {
  registered: true,
  deprecated: true,
  supersededBy: "build_house_kit",
} as const;

export const CONSTRUCTION_WRITE_ROUTE_MANIFEST = [
  {
    name: "author_house",
    currentRegistry: CURRENTLY_UNREGISTERED,
    llmExposed: true,
    defaultToolBrowserExposed: true,
    directExecution: true,
    supersededBy: null,
    implementation: "author-house-facade",
  },
  {
    name: "author_village",
    currentRegistry: CURRENTLY_UNREGISTERED,
    llmExposed: true,
    defaultToolBrowserExposed: true,
    directExecution: true,
    supersededBy: null,
    implementation: "author-village-facade",
  },
  {
    name: "build_house",
    currentRegistry: CURRENT_LEGACY_HOUSE_COMPATIBILITY,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_house",
    implementation: "map-tool-rect-house-stamper",
  },
  {
    name: "build_house_kit",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_house",
    implementation: "house-kit-tool",
  },
  {
    name: "build_house_lots",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_house",
    implementation: "house-lot-tool",
  },
  {
    name: "plan_village",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_village",
    implementation: "village-plan-store",
  },
  {
    name: "materialize_village_spec",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_village",
    implementation: "village-spec-materializer",
  },
  {
    name: "revise_village_plan",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_village",
    implementation: "village-plan-reviser",
  },
  {
    name: "run_village_pipeline",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_village",
    implementation: "village-pipeline",
  },
  {
    name: "build_village",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_village",
    implementation: "natural-village-builder",
  },
  {
    name: "start_village_session",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_village",
    implementation: "village-session-starter",
  },
  {
    name: "plant_tree_clusters",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_village",
    implementation: "village-session-tree-layer",
  },
  {
    name: "advance_village_build",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_village",
    implementation: "village-session-advance",
  },
  {
    name: "run_village_session",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: false,
    defaultToolBrowserExposed: false,
    directExecution: true,
    supersededBy: "author_village",
    implementation: "village-session-runner",
  },
] as const satisfies readonly ConstructionWriteRouteManifestEntry[];

export const PUBLIC_CONSTRUCTION_READ_DIAGNOSTICS = [
  {
    name: "preview_house",
    currentRegistry: CURRENT_LEGACY_HOUSE_COMPATIBILITY,
    llmExposed: true,
    defaultToolBrowserExposed: true,
    directExecution: true,
    implementation: "map-tool-house-preview",
  },
  {
    name: "evaluate_village_look",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: true,
    defaultToolBrowserExposed: true,
    directExecution: true,
    implementation: "village-look-evaluator",
  },
  {
    name: "critique_village",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: true,
    defaultToolBrowserExposed: true,
    directExecution: true,
    implementation: "village-structure-critic",
  },
  {
    name: "list_village_tree_assets",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: true,
    defaultToolBrowserExposed: true,
    directExecution: true,
    implementation: "village-tree-catalog",
  },
  {
    name: "get_village_session",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: true,
    defaultToolBrowserExposed: true,
    directExecution: true,
    implementation: "village-session-status",
  },
  {
    name: "evaluate_village_layer",
    currentRegistry: CURRENTLY_ACTIVE,
    llmExposed: true,
    defaultToolBrowserExposed: true,
    directExecution: true,
    implementation: "village-layer-evaluator",
  },
] as const;

export function constructionRouteEntry(name: string): ConstructionWriteRouteManifestEntry | undefined {
  return CONSTRUCTION_WRITE_ROUTE_MANIFEST.find((entry) => entry.name === name);
}

export function canonicalRouteFor(name: string): CanonicalConstructionRoute | undefined {
  const entry = constructionRouteEntry(name);
  if (entry === undefined) return undefined;
  if (entry.supersededBy !== null) return entry.supersededBy;
  if (entry.name === "author_house" || entry.name === "author_village") return entry.name;
  return undefined;
}
