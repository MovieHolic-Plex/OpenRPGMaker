import type { HouseKitId } from "@/editor/houseKit";
import type { ConstructionOutcome, HouseWing } from "@/editor/construction/contracts";
import type { HouseVarietyReport } from "./houseVariety";
import type { InteriorDesignSource, InteriorVarietyReport } from "./interiorVariety";

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
  /** 실내 도면의 출처 — planned/template/seed. 다양성 리포트의 원인 축이다. */
  readonly designSource: InteriorDesignSource;
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
  /**
   * 연결 실내를 지었을 때 그 층 맵들을 되읽은 도면·물건 분포. 외장 variety 와 같은 관찰 고리 —
   * "모든 집 실내가 같은 도면"은 여기서 잡힌다.
   */
  readonly interiorVariety?: InteriorVarietyReport;
};
