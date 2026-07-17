import type { HouseKitId } from "@/editor/houseKit";
import type { ConstructionOutcome, HouseWing } from "@/editor/construction/contracts";

export type HouseTransferEvidence = {
  readonly doorEventId: string;
  readonly exitEventId: string;
  readonly exteriorMapId: string;
  readonly interiorMapId: string;
};

export type HouseInteriorEvidence = {
  readonly interiorMapId: string;
  readonly floorMapIds: readonly string[];
  readonly doorEventId: string;
  readonly exitEventId: string;
  readonly transfer: HouseTransferEvidence;
};

export type AuthorHouseExecution = {
  readonly index: number;
  readonly kitId: HouseKitId;
  readonly wings: readonly HouseWing[];
  readonly exteriorMapId: string;
  readonly doorAt: { readonly x: number; readonly y: number } | null;
  readonly interior?: HouseInteriorEvidence;
};

export type ConstructionCellChange = {
  readonly mapId: string;
  readonly layer: "lower" | "upper";
  readonly x: number;
  readonly y: number;
};

export type AuthorHouseChanges = {
  readonly changedMapIds: readonly string[];
  readonly addedMapIds: readonly string[];
  readonly changedCells: readonly ConstructionCellChange[];
  readonly addedEventIds: readonly string[];
  readonly changedEventIds: readonly string[];
};

export type AuthorHouseResultData = {
  readonly construction: ConstructionOutcome;
  readonly houses: readonly AuthorHouseExecution[];
  readonly changes: AuthorHouseChanges;
};
