// src/editor/workshop/workshopEvents.ts
/** 공방이 window 에 내는 알림. 조수 패널이 공방 모듈을 끌어오지 않고 들을 수 있게 따로 둔다. */

/** 고른 기물을 칩셋에 구웠다(workshopBake.ts). 조수의 「없는 타일」 카드(aiStoreCard.ts)가 듣는다. */
export const WORKSHOP_BAKED_EVENT = "oprn:workshop-baked";
export interface WorkshopBakedDetail {
  readonly objectId: string;
  readonly title: string;
  readonly tilesetId: string;
  readonly kind: string;
  readonly columns: number;
  readonly rows: number;
}
