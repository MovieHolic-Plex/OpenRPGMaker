import { sharedRegionReferences, type SharedRegionReference } from './sharedSpatialReferences';
import { JOSEON_PLACE_REFERENCES } from "./joseonPlaceReferences";
import { MODERN_CITY_PLACE_REFERENCES } from "./modernCityPlaceReferences";
import { JP_CITY_PLACE_REFERENCES } from "./jpCityPlaceReferences";
import { WIZARDING_PLACE_REFERENCES } from "./wizardingPlaceReferences";
import { REFERENCE_HOUSE_FORM_DEFS } from "./defaults/referenceHouseFormCatalog";

// 2026-10-07 사용자 결정(저작권): 직접 만든 칩셋(코드·손 도트) 위 장소만 배송한다. EasyRPG·그 재칠(숲마을·기후·던전·배·월드맵)·
// Tibo 실내·OpenGameArt 성채 위 등록 장소와 스냅숏·미리보기는 전부 지웠다. 지역(완성 맵) 사례는 남은 것이 없다.

/** Fixed authored examples, independent of procedural RegionDesign and the active project. */
export const REGION_REFERENCES: readonly SharedRegionReference[] = [];

/** Shipped place examples remain visible even in a new, empty project. */
export const PLACE_REFERENCES = [...MODERN_CITY_PLACE_REFERENCES, ...JP_CITY_PLACE_REFERENCES, ...WIZARDING_PLACE_REFERENCES, ...JOSEON_PLACE_REFERENCES];


export function regionReference(id: string) {
  return [...REGION_REFERENCES, ...PLACE_REFERENCES, ...sharedRegionReferences()].find(entry => entry.id === id);
}

/**
 * 참고 사례에서 저작 카탈로그로 옮겨진 집 형태 안내 — 그림만 보고 끝나지 않게, 모델이 바로 지목할
 * templateId 를 준다(2026-09-17: 정주지 4종·왕궁 도시 23종).
 */
function referenceHouseFormNote(referenceId: string): string {
  const forms = REFERENCE_HOUSE_FORM_DEFS.filter(form => form.reference?.id === referenceId);
  if (forms.length === 0) return "";
  const first = forms[0]!.id, last = forms[forms.length - 1]!.id;
  return `\n집 형태 ${forms.length}종은 저작 카탈로그에 있다(templateId ${first}~${last}) — author_house templateId 와 author_village housePlans[].templateId 로 그대로 짓고, 마을 시공기 기본 후보에도 섞인다. 폭 9 이상(${forms.filter(form => form.w > 8).map(form => form.id).join(", ") || "없음"})은 author_house 전용.`;
}

export function regionReferenceContext(): string {
  return "## 지역·장소 — 완성 맵 참고 사례\n" + [...REGION_REFERENCES, ...PLACE_REFERENCES, ...sharedRegionReferences()].map(r =>
    `- ${r.name} (${r.id}, ${r.width}×${r.height}): ${r.rules.join(" ")}\n실제 배치: read_region_reference({id:'${r.id}',row:0,rows:8}), nextRow로 이어 읽기. 그대로 맵으로 쓰려면 import_region_reference({id:'${r.id}'}) 한 번(타일셋·이식 포함).${referenceHouseFormNote(r.id)}`
  ).join("\n");
}
