// 공간 규모별 표준 크기 규격(VENUE_SCALE_CONTRACT) - 2026-10-18 사용자 「대형마트는 시발 너무 작다… 미리미리 정리해줘야하나. 가령 대형마트는 50x50 정도로」.
// modern_city 실내 program 이 지어야 하는 맵 크기(벽 포함 전체 칸). 견본(dailyVenues.ts)은 이 크기로 짜여 seed 1 이 정확히 이 크기로 서고,
// 변주 seed 는 큰 방을 몇 칸 넓힐 뿐 작아지지 않는다. 백화점 청사진(blueprintComposers.ts)도 이 크기를 바탕으로 짓는다.
// 조수 도구 설명(build_hand_interior_room)에 그대로 실려 rooms 를 직접 짜는 조수도 이 규모를 따른다.

export type VenueTier = "XL" | "L" | "M" | "S";

export interface VenueScale {
  readonly tier: VenueTier;
  readonly w: number;
  readonly h: number;
  readonly ko: string;
}

/** XL 48~52 × 38~48 대형 상업·체육 · L 40~46 × 26~34 다동 시설·교통 · M 30~38 × 20~28 가게·식당 · 20~26 × 16~20 집·작은 가게 · S 탈것(엘리베이터 24×16).
 *  전동차 차내는 modern_city 로 따로 짓지 않는다 - jp_city 의 손 도트 견본(jp_station program 의 train-car, 21×8)을 그대로 쓴다(2026-10-19 사용자 「전철은 기존에 만들던 게 있는데 그걸 그대로 쓰면 되는데」).
 *  2026-10-18 사용자 「공간을 너무 넓게햇다. 특히, 집이나 이런거. 너무 큼」 - 가정집 34×26·오피스텔 32×24 는 바닥 절반이 비었다. 집·원룸·편의점·베이커리를 줄였다. */
export const VENUE_SCALE_CONTRACT: Readonly<Record<string, VenueScale>> = {
  mc_hospital: { tier: "XL", w: 50, h: 50, ko: "3층 다층 종합병원(3F 수술실 둘·중환자실·CT/X선실 + 2F 가로·세로 다인실 병동·간호사 스테이션·특실 + 1F 대형 대기실·원내 약국·응급실·구급차 하차장, 비사각형 계단식 외곽)" },
  mc_supermarket: { tier: "XL", w: 50, h: 46, ko: "대형마트·하이퍼마켓(청과·정육·수산·곤돌라 12열·계산대 8레인·푸드코트·물류창고)" },
  mc_department_store: { tier: "XL", w: 48, h: 38, ko: "백화점(아트리움 에스컬레이터 쌍·분수·화장품·명품·주얼리·패션관·VIP 라운지)" },
  mc_gym: { tier: "XL", w: 46, h: 34, ko: "실내 종합 체육관(양쪽 골대 풀코트·관람석·본부석·남녀 라커룸·기구 창고)" },
  mc_school_building: { tier: "L", w: 46, h: 34, ko: "학교 교사동(계단실·교실 둘·교무실·복도·현관 신발장·보건실·매점)" },
  mc_station: { tier: "L", w: 46, h: 32, ko: "지하철역(승강장 스크린도어·선로 + 개찰구 차단선 대합실·역무실·역내 편의점)" },
  mc_office: { tier: "L", w: 46, h: 32, ko: "대형 오피스 층(리셉션·마주 보는 책상 업무홀·대회의실·임원실·탕비 라운지)" },
  mc_lecture_hall: { tier: "L", w: 42, h: 30, ko: "대학 강의동(계단식 대강의실·과학 실험실·준비실·로비)" },
  mc_sento: { tier: "L", w: 40, h: 30, ko: "센토·스파(카운터·탈의실·씻는 자리 열·탕 셋·사우나·노천탕)" },
  mc_sento_machi: { tier: "M", w: 40, h: 20, ko: "동네 센토(번대 로비·남녀 탈의실·남녀 목욕 홀 — 사우나·노천탕 없음)" },
  mc_game_center: { tier: "L", w: 40, h: 28, ko: "게임센터·노래방·만화카페(인형뽑기·리듬·대전 캐비닛·노래방 둘·만화 서가)" },
  mc_restaurant: { tier: "M", w: 38, h: 28, ko: "레스토랑·다이닝 바(오픈 키친·바 라운지·피아노 무대·4방향 식탁·부스석)" },
  mc_izakaya: { tier: "M", w: 36, h: 26, ko: "이자카야·라멘(주방 다찌 카운터·다다미 룸 둘·홀)" },
  mc_council_room: { tier: "M", w: 36, h: 26, ko: "학생회실·밴드 동아리방(ㄷ자 회의 탁자 4방향 의자·비품실·밴드실·녹음 부스)" },
  mc_rooftop: { tier: "M", w: 36, h: 24, ko: "학교 옥상(탑옥·안전 펜스·급수탑·벤치·자판기)" },
  mc_house: { tier: "M", w: 26, h: 20, ko: "2층 가정집 1층(침실·아이 방·욕실·계단·거실 코타츠·부엌 식탁·현관 - 방마다 꽉 찬 살림)" },
  mc_officetel: { tier: "M", w: 26, h: 16, ko: "원룸·오피스텔(엘리베이터 현관·욕실·원룸 침실·키친 식탁)" },
  mc_bakery_cafe: { tier: "M", w: 30, h: 18, ko: "베이커리 카페(제빵실·케이크·도넛 진열 에스프레소 바·4방향 카페 좌석 홀)" },
  mc_konbini_jp: { tier: "M", w: 22, h: 16, ko: "편의점(음료·유제품·주류 냉장 벽·도시락·잡지·색깔별 곤돌라·오뎅·핫스낵 계산대·창고)" },
  mc_elevator: { tier: "S", w: 24, h: 16, ko: "엘리베이터 내부 & 다층 승강장 홀(1·2호기 카 내부 거울·목재 벽판·층 버튼 조작반·카 문 + 3연장 엘리베이터 홀·비상계단)" },
};

/** 조수 도구 설명에 싣는 한 줄 요약. */
export function venueScaleBrief(): string {
  return Object.entries(VENUE_SCALE_CONTRACT).map(([k, v]) => `${k} ${v.w}×${v.h}`).join(" · ");
}
