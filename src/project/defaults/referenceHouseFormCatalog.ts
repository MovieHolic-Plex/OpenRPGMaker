// project/defaults/referenceHouseFormCatalog.ts
// 완성 맵 참고 사례의 집을 저작 형태로 — 「성벽으로 둘러싸인 정주지」 4종, 「왕궁이 있는 이중 성벽 도시」 23종.
//
// 데이터 정본은 regionReferences/*.json 스냅샷이다. 여기서는 스냅샷을 그대로 잘라 쓰므로
// 참고 맵을 고치면 형태도 따라 바뀐다. 개수·치수·문 위치는 test/referenceHouseForms.test.ts 가
// 기준선으로 잡아 뜻밖의 변화를 알린다.

import castleSnapshot from "../regionReferences/castle-town.json";
import walledSnapshot from "../regionReferences/walled-settlement.json";
import type { AuthoredHouseFormDef } from "./authoredHouseFormCatalog";
import { extractReferenceHouseForms } from "./referenceHouseFormExtract";

export const WALLED_SETTLEMENT_REFERENCE_ID = "walled-settlement-43x45";
export const CASTLE_TOWN_REFERENCE_ID = "castle-town-100x100";

export const WALLED_SETTLEMENT_HOUSE_FORMS: readonly AuthoredHouseFormDef[] = extractReferenceHouseForms(walledSnapshot.map, {
  referenceId: WALLED_SETTLEMENT_REFERENCE_ID,
  idPrefix: "ref-walled",
  label: "정주지",
});

export const CASTLE_TOWN_HOUSE_FORMS: readonly AuthoredHouseFormDef[] = extractReferenceHouseForms(castleSnapshot.map, {
  referenceId: CASTLE_TOWN_REFERENCE_ID,
  idPrefix: "ref-castle",
  label: "왕궁 도시",
});

export const REFERENCE_HOUSE_FORM_DEFS: readonly AuthoredHouseFormDef[] = [
  ...WALLED_SETTLEMENT_HOUSE_FORMS,
  ...CASTLE_TOWN_HOUSE_FORMS,
];
