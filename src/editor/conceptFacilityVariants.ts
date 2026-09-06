import { facilityAsPlan } from "@/editor/conceptPlan";
import { conceptFacilityTemplateById } from "@/project/defaults/conceptFacilityTemplates";

const DESIGN_NOTES: Readonly<Record<string, string>> = {
  house: "식탁과 러그를 생활 중심으로, 침실·조리 공간은 분리한다.",
  shop: "상품 진열과 계산대, 후방 재고를 구분하고 입구 통로를 비운다.",
  tavern: "좌석군을 두고 술 카운터와 조리 공간을 연결한다.",
  library: "책장과 열람 좌석을 묶고 서재의 업무 공간을 따로 둔다.",
  smithy: "화덕·도구·작업대를 묶고 자재를 작업장 가까이 둔다.",
  church: "예배 좌석과 제단을 구분하고 사제실을 따로 둔다.",
  warehouse: "종류별 재고를 묶고 가운데 반출 통로를 비운다.",
  guild: "접수·대기와 회의·문서 보관을 구분한다.",
};

/** Reference only: never replaces the live authored bundle or its omissions. */
export function facilityDesignVariants(facilityId: string) {
  const bundle = conceptFacilityTemplateById(facilityId);
  const why = DESIGN_NOTES[facilityId] ?? "장소별 가구 구성과 출입 통로를 참고해 설계한다.";
  const facility = bundle?.facilities[0];
  if (!bundle || !facility) return [];
  return [{
    id: `${facilityId}-furnished`,
    label: `${facility.label} 공간 구성 참고`,
    why,
    plan: facilityAsPlan(bundle, facility),
  }];
}
