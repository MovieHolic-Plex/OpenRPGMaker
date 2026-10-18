// 시설 84곳(11 분류) 카탈로그 - 2026-10-18 21:17 사용자 「왜 방을 사각형으로만 만드냐 ... 이것들 다 만들어」.
// 새 견본 61곳은 facilityVenuesA(교육·의료·상점·음식점)·facilityVenuesB(나머지)에 있고, 23곳은 기존 program(dailyVenues.ts·modernVenues.ts·modernPresets.ts)을 그대로 쓴다.
// build_hand_interior_room 은 program id 와 한국어 이름(견본 aliases)으로 모두 찾는다.
import { facilityExports, type Category } from "./facilityKit";
import { FACILITIES_A } from "./facilityVenuesA";
import { FACILITIES_B } from "./facilityVenuesB";

const NEW_FACILITIES = [...FACILITIES_A, ...FACILITIES_B];

export interface FacilityEntry {
  readonly cat: Category;
  readonly ko: string;
  readonly program: string;
  readonly map: string;
  readonly shape: string;
}

/** 기존 program 을 쓰는 23곳 - 외곽 태그는 그 견본의 줄 배치(dailyVenues·modernVenues)가 만드는 모양. */
const EXISTING: readonly FacilityEntry[] = [
  { cat: "교육시설", ko: "도서관", program: "mc_library", map: "central-library", shape: "L자형" },
  { cat: "의료시설", ko: "종합병원", program: "mc_hospital", map: "hospital-ward", shape: "계단형(3층)" },
  { cat: "상점", ko: "편의점", program: "mc_konbini_jp", map: "konbini-24h", shape: "L자형" },
  { cat: "상점", ko: "슈퍼마켓", program: "mc_supermarket", map: "supermarket-mart", shape: "계단형" },
  { cat: "상점", ko: "서점", program: "mc_bookstore", map: "bookstore-manga", shape: "L자형" },
  { cat: "음식점", ko: "패밀리 레스토랑", program: "mc_restaurant", map: "restaurant-bar", shape: "계단형" },
  { cat: "음식점", ko: "이자카야", program: "mc_izakaya", map: "izakaya", shape: "L자형" },
  { cat: "음식점", ko: "빵집", program: "mc_bakery_cafe", map: "bakery-cafe", shape: "L자형" },
  { cat: "오락시설", ko: "오락실", program: "mc_game_center", map: "game-center", shape: "계단형" },
  { cat: "오락시설", ko: "노래방", program: "mc_karaoke", map: "karaoke-box", shape: "L자형" },
  { cat: "오락시설", ko: "영화관", program: "mc_auditorium", map: "auditorium", shape: "L자형" },
  { cat: "주거시설", ko: "일반 주택", program: "mc_house", map: "family-house", shape: "계단형" },
  { cat: "주거시설", ko: "원룸 아파트", program: "mc_officetel", map: "officetel", shape: "L자형" },
  { cat: "공공시설", ko: "파출소(交番)", program: "mc_koban", map: "koban", shape: "L자형" },
  { cat: "공공시설", ko: "법원", program: "mc_courtroom", map: "courtroom", shape: "L자형" },
  { cat: "교통시설", ko: "지하철역", program: "mc_station", map: "subway-station", shape: "계단형" },
  { cat: "교통시설", ko: "주차장", program: "mc_parking", map: "parking-garage", shape: "L자형" },
  { cat: "숙박시설", ko: "비즈니스호텔", program: "mc_hotel", map: "hotel", shape: "L자형" },
  { cat: "일본 전통시설", ko: "신사", program: "mc_shrine", map: "shrine-haiden", shape: "L자형" },
  { cat: "일본 전통시설", ko: "센토(대중목욕탕)", program: "mc_sento", map: "sento", shape: "L자형" },
  { cat: "기타 시설", ko: "회사 사무실", program: "mc_office", map: "office-floor", shape: "계단형" },
  { cat: "기타 시설", ko: "방송국", program: "mc_tv_studio", map: "tv-studio", shape: "L자형" },
  { cat: "기타 시설", ko: "미술관", program: "mc_museum", map: "museum-gallery", shape: "L자형" },
];

/** 84곳 전체(분류 11 · 이름 · program · 맵 · 외곽 모양). */
export const FACILITY_CATALOG: readonly FacilityEntry[] = [
  ...NEW_FACILITIES.map((v) => ({ cat: v.cat, ko: v.ko, program: v.program, map: v.map, shape: v.shape })),
  ...EXISTING,
];

const NEW = facilityExports(NEW_FACILITIES);
export const FACILITY_TEMPLATES = NEW.templates;
export const FACILITY_PROGRAMS = NEW.programs;
export const FACILITY_VARIATION = NEW.variation;
export const FACILITY_OPEN_FLOOR = NEW.openFloorRooms;
