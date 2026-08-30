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

/** 집 외장 층수 — 벽 밴드 행 수 = 2 + (2*stories-1). lowWall 이면 무시된다. */
export type HouseStories = 1 | 2 | 3;

export type AuthorHousePlan = {
  readonly kitId: HouseKitId;
  readonly wings: readonly HouseWing[];
  readonly interior: HouseInteriorMode;
  readonly door: boolean;
  readonly ownerName?: string;
  readonly windows?: HouseWindowOptions;
  readonly yard: readonly HouseYardIntent[];
  /**
   * 형태 카탈로그(houseTemplateCatalog, 34종) id. 주면 wings 는 **앵커**로만 쓰이고
   * (wings[0].x, wings[0].y 를 원점으로) 카탈로그 날개가 전개된다 — ㄱ자·ㄷ자·중정·
   * 현관 돌출 같은 비사각 형태를 여기로만 얻을 수 있다.
   */
  readonly templateId?: string;
  readonly stories?: HouseStories;
  /** 낮은 벽(상단+하단 2행) — 헛간·창고·오두막. stories 를 무시한다. */
  readonly lowWall?: boolean;
  readonly chimney?: boolean;
  /** 옥상 판자 데크 + 벽면 사다리 — 파랑 평지붕(blue-stone/slate-wood) 전용. */
  readonly roofDeck?: boolean;
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

export const VILLAGE_GROUND_THEMES = ["grass", "snow"] as const;
export type VillageGroundTheme = (typeof VILLAGE_GROUND_THEMES)[number];

export const VILLAGE_SETTLEMENT_LAYOUTS = ["plaza-ring", "street-grid", "clusters"] as const;
export type VillageSettlementLayout = (typeof VILLAGE_SETTLEMENT_LAYOUTS)[number];

export type AuthorVillageRequest = {
  readonly target: AuthorVillageTarget;
  readonly houseCount: number;
  readonly housePlans?: readonly VillageHousePlan[];
  readonly countPolicy: ConstructionCountPolicy;
  readonly groundTheme?: VillageGroundTheme;
  readonly settlementLayout?: VillageSettlementLayout;
  readonly npcCount?: number;
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
  readonly mapPropertiesChanged?: number;
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
