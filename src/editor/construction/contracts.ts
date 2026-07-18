import type { HouseKitId } from "@/editor/houseKit";

export const CONSTRUCTION_COUNT_POLICIES = ["exact", "best-effort"] as const;
export type ConstructionCountPolicy = (typeof CONSTRUCTION_COUNT_POLICIES)[number];

export const HOUSE_INTERIOR_MODES = ["exterior-only", "linked-interior"] as const;
export type HouseInteriorMode = (typeof HOUSE_INTERIOR_MODES)[number];

export type ConstructionRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type HouseWing = ConstructionRect;

export type HouseWindowOptions = false | {
  readonly spacing?: number;
};

export type HouseYardIntent = string | {
  readonly kind: string;
  readonly count: number;
};

export type AuthorHousePlan = {
  readonly kitId: HouseKitId;
  readonly wings: readonly HouseWing[];
  readonly interior: HouseInteriorMode;
  readonly door: boolean;
  readonly ownerName?: string;
  readonly windows?: HouseWindowOptions;
  readonly yard: readonly HouseYardIntent[];
};

export type AuthorHouseSingleRequest = Omit<AuthorHousePlan, "yard"> & {
  readonly kind: "single";
  readonly mapId: string;
};

export type AuthorHouseLotsRequest = {
  readonly kind: "lots";
  readonly mapId: string;
  readonly houses: readonly AuthorHousePlan[];
  readonly seed?: number;
};

export type AuthorHouseRequest = AuthorHouseSingleRequest | AuthorHouseLotsRequest;

export type PlannedMapDescriptor = {
  readonly mapId: string;
  readonly width: number;
  readonly height: number;
};

export type ExistingVillageTarget = {
  readonly kind: "existing";
  readonly mapId: string;
  readonly bounds?: ConstructionRect;
};

export type NewVillageTarget = {
  readonly kind: "new";
  readonly mapId: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly plannedMap: PlannedMapDescriptor;
};

export type AuthorVillageTarget = ExistingVillageTarget | NewVillageTarget;

export type VillageHousePlan = {
  readonly kitId?: HouseKitId;
  readonly yard: readonly string[];
  readonly ownerName?: string;
  readonly templateId?: string;
  readonly program?: "dwelling" | "shop" | "inn" | "workshop" | "study" | "manor";
};

export type AuthorVillageRequest = {
  readonly target: AuthorVillageTarget;
  readonly houseCount: number;
  readonly housePlans?: readonly VillageHousePlan[];
  readonly countPolicy: ConstructionCountPolicy;
  readonly theme?: string;
  readonly seed?: number;
  readonly interior?: boolean;
};

export type CanonicalConstructionRoute = "author_house" | "author_village";

export type ConstructionWriteEntrypoint =
  | CanonicalConstructionRoute
  | "build_house"
  | "build_house_kit"
  | "build_house_lots"
  | "plan_village"
  | "materialize_village_spec"
  | "revise_village_plan"
  | "run_village_pipeline"
  | "build_village"
  | "start_village_session"
  | "plant_tree_clusters"
  | "advance_village_build"
  | "run_village_session";

export type ConstructionRouteChange = {
  readonly kind: "compatibility-alias";
  readonly from: ConstructionWriteEntrypoint;
  readonly to: CanonicalConstructionRoute;
};

export type ConstructionTarget = {
  readonly kind: "existing" | "new";
  readonly mapId: string;
};

export type ConstructionCounts = {
  readonly requested: number;
  readonly actual: number;
};

export type ConstructionDiffTotals = {
  readonly tilesChanged: number;
  readonly eventsAdded: number;
  readonly eventsModified: number;
  readonly eventsRemoved: number;
  readonly mapsAdded: number;
  readonly mapsRemoved: number;
  readonly dbRecordsChanged: number;
  readonly tilesetsChanged: number;
  readonly switchesAdded: number;
  readonly variablesAdded: number;
  readonly worldEntitiesAdded: number;
  readonly worldEntitiesModified: number;
  readonly palettePresetsAdded: number;
  readonly palettePresetsModified: number;
  readonly endingsChanged: number;
  readonly sessionChanged: boolean;
  readonly systemChanged: boolean;
};

export type ActivityPersistence = "not-recorded" | "local" | "supabase" | "both" | "failed-remote";
export type ProjectPersistence = "not-requested" | "pending" | "local" | "supabase" | "both" | "failed";

type ConstructionOutcomeCommon = {
  readonly requestedEntrypoint: ConstructionWriteEntrypoint;
  readonly canonicalRoute: CanonicalConstructionRoute;
  readonly selectedImplementation: string;
  readonly routeChanges: readonly ConstructionRouteChange[];
  readonly activityPersistence: ActivityPersistence;
  readonly projectPersistence: ProjectPersistence;
  readonly target: ConstructionTarget;
  readonly counts: ConstructionCounts;
  readonly diff: ConstructionDiffTotals;
  readonly warnings: readonly string[];
};

export type ConstructionOutcome = ConstructionOutcomeCommon & (
  | { readonly executionOk: true; readonly applied: true; readonly outcome: "applied" | "partial" }
  | { readonly executionOk: false; readonly applied: false; readonly outcome: "blocked" | "failed" | "pending-approval" }
);
