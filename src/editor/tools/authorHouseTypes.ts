import type { HouseKitId } from "@/editor/houseKit";
import type { ConstructionOutcome, HouseWing } from "@/editor/construction/contracts";
import type { HouseVarietyReport } from "./houseVariety";

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
  /**
   * 시공 직후 그 자리를 되읽은 모양·킷 분포. 모델이 "같은 집만 깔았는지"를 다음 턴에
   * 바로 알 수 있게 결과에 싣는다(정밀 관찰은 look_at_houses).
   */
  readonly variety?: HouseVarietyReport;
};
