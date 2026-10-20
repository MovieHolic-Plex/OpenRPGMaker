// 일본 도시(jp_city, 계열 oprn-jp) 조수 연결 — 조수가 이 번들 칩셋과 건물 조립 도구를 «존재하는 것»으로 알고 고르게 한다.
// 배경(2026-10-04 조사): build_jp_city_building 은 jp_city 맵에서만 동작하는데, 시스템 프롬프트·의도 노트·초기 도구 노출 어디에도
// jp_city 가 없었다. 그래서 ① 일본 상가 거리 요청이 author_village(숲마을) 마을 계약에 걸리고 ② 조수가 칩셋 id 를 모르며
// ③ 건물 도구가 자연어 점수 승격에만 기대 노출됐다(이자카야 빌딩·일본풍 상점가 문장은 승격 0건).
// packTownRoute·beodeulTownRoute 와 같은 모양이다 — 대상 판정 + 노트 + 계약 건너뛰기. defaults/jpCity.ts 는 2MB JSON 을 끌어오므로
// 텍스처 키 문자열만 쓴다.
// 주의: 이 파일의 노트·문장은 모델 지시문(task)에 실린다 — requestsModernMap 의 PAW 전용 게이트를 켜는 낱말(현대·모던·modern)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const JP_CITY_TILESET_ID = "jp_city";
const JP_CITY_TEXTURE = "tex_jp_city";

export function isJpCityTilesetDef(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === JP_CITY_TEXTURE;
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. */
const NAMES_JP_CITY_RE = /jp[_-]city|oprn-jp|일본\s*도시\s*(?:칩셋|타일셋|\(도트\))/iu;
/** 일본 거리 풍경 요청 — jp_city 가 이 저장소에서 그 일을 하는 유일한 번들이다(상가·주택가·학교·지하철역·노면전차 거리). */
const JP_STREET_RE = /일본(?:풍|식)?\s*(?:상가|상점가|상점\s*거리|쇼핑\s*거리|편의점|이자카야|골목|동네\s*거리|거리|주택가|(?:초등)?학교|소학교|지하철(?:역)?|전철역|역\s*앞|노면\s*전차|버스\s*정류장)/u;

/**
 * 도시 거리 풍경을 일본이라는 말 없이 부른 요청(번화가·상점가·도심·시가지·주택가·거리 등, 영어 포함).
 * 이 낱말만으로는 jp_city 라고 단정할 수 없어서 jpCityTargetFor 가 «프로젝트에 jp_city 맵이 이미 있을 때만» 쓴다.
 */
const CITY_STREET_RE = /번화가|(?:현대|모던)(?:식|적|풍)?\s*(?:도시|거리|동네|상가|마을)|거리(?:를|가)?\s*(?:만들|짓|지어|꾸며|짜)|상점가|상가\s*거리|쇼핑\s*거리|쇼핑가|도심|시가지|도시\s*거리|도시\s*풍경|주택가|동네\s*거리|골목길?|(?:도시|상가|시내|큰|거리)\s*(?:거리|맵|지도)|거리\s*(?:맵|지도|풍경)|\b(?:downtown|city\s+street|shopping\s+(?:street|arcade|district)|residential\s+(?:area|street)|street\s+scene|urban)\b/iu;
/** 미국풍·다른 도시 칩셋(modern_city)을 부른 문장 — 위 낱말이 있어도 jp_city 로 끌지 않는다. */
const OTHER_CITY_RE = /미국|아메리칸|뉴욕|할리우드|modern[_\s-]?city|oprn-modern|american|new\s*york/iu;

/** 현대 도시를 분명히 말하는 낱말 — jp_city 맵이 아직 없는 프로젝트에서도 이것만으로 jp_city 로 보낸다(골목·거리 같은 약한 낱말은 이미 jp_city 를 쓰는 프로젝트에서만). */
const STRONG_MODERN_CITY_RE = /번화가|현대(?:식|적)?\s*(?:도시|거리|상점가|상가|동네)|모던\s*(?:도시|거리)|도심|시가지|상점가|상가\s*거리|쇼핑\s*(?:거리|가)|편의점|이자카야|\b(?:downtown|shopping\s+(?:street|arcade|district)|modern\s+(?:city|street|town)|urban\s+street)\b/iu;

export function describesStrongModernCity(text: string | undefined): boolean {
  return !!text && STRONG_MODERN_CITY_RE.test(text) && !OTHER_CITY_RE.test(text);
}

export function describesCityStreet(text: string | undefined): boolean {
  return !!text && CITY_STREET_RE.test(text) && !OTHER_CITY_RE.test(text);
}

export function namesJpCityTileset(text: string | undefined): boolean {
  return !!text && NAMES_JP_CITY_RE.test(text);
}

/** 일본 거리 풍경을 말한 문장인가(칩셋 이름은 안 불렀어도). */
export function describesJapaneseStreet(text: string | undefined): boolean {
  return !!text && JP_STREET_RE.test(text);
}

export interface JpCityTarget {
  /** 대상 맵이 이미 jp_city 면 그 맵 — 아니면 새 맵을 만든다. */
  readonly mapId?: string;
  /** 대상 맵에 이미 내용이 있으면 true. */
  readonly lived?: boolean;
  /** 시설 실내(일본 학교·사무실·병원) 요청 — 새 실내 맵을 build_hand_interior_room({tileset:"jp_city", layout:{program}}) 으로 짓는다. */
  readonly facility?: JpFacility;
}

/** jp_city 시설 실내 종류(2026-10-14). */
export type JpFacility = "school" | "office" | "hospital";

/**
 * 시설 실내 낱말 — 갈림 규칙(2026-10-14, openwiki/jp-city.md 「시설 실내」):
 *  - 사무실·회사·회의실·급탕실·병원·진료실·대기실·병실·약국 같은 현대 시설 실내는 jp_city 가 맡는다(이 저장소에서 그 실내를 가진 번들은 jp_city 하나 — 캠퍼스 칩셋은 학교·기숙사만).
 *  - 학교 실내는 «일본» 표지(일본·日本·신발장·昇降口·下駄箱·上履き·우와바키·한자 교실 이름)가 있을 때만 jp_city, 표지 없는 교실·교무실·대학 강의실은 캠퍼스 칩셋(campusPolicy)에 남긴다.
 *  - 시대·세계 낱말(우주·SF·마법·저택·고딕·해적·판타지·중세·던전·폐병원·폐교·좀비·스팀펑크·원시·에도)이 있으면 잡지 않는다 — 그 테마·현대 던전 장소가 맡는다.
 */
const JP_OFFICE_RE = /사무실|오피스|회사|사옥|회의실|탕비실|급탕실|엘리베이터\s*홀|자유석|업무\s*층|\b(?:office|meeting\s*room)\b|事務所|オフィス|会議室|給湯室/iu;
const JP_HOSPITAL_RE = /병원|진료실|진찰실|외래|대기실|병실|병동|간호사|간호\s*스테이션|의원|클리닉|약국|조제실|\b(?:hospital|clinic|ward|waiting\s*room|pharmacy)\b|病院|診察室|待合室|病室|病棟|薬局|ナースステーション/iu;
const JP_SCHOOL_MARK_RE = /일본|日本|japan|신발장|昇降口|下駄箱|上履き|우와바키|教室|職員室|保健室|音楽室|理科室|図書室|中学校|高校|小学校|소학교/iu;
const JP_SCHOOL_WORD_RE = /학교|교실|복도|교무실|보건실|음악실|과학실|이과실|도서실|체육관|옥상|신발장|昇降口|下駄箱|教室|職員室|保健室|school|classroom/iu;
const JP_FACILITY_OTHER_RE = /우주|\bSF\b|정거장|함선|사이버|네온|마법|호그|저택|고딕|해적|판타지|중세|던전|폐병원|폐교|폐건물|좀비|스팀펑크|증기|선사|원시|에도|전국|사무라이|미국|아메리칸|wizard|gothic|pirate|fantasy|space\s*station/iu;

/** 문장이 jp_city 시설 실내(일본 학교·사무실·병원)를 말하는가 — 종류 또는 null. */
export function jpFacilityOf(text: string | undefined): JpFacility | null {
  if (!text || JP_FACILITY_OTHER_RE.test(text)) return null;
  if (JP_HOSPITAL_RE.test(text)) return "hospital";
  if (JP_SCHOOL_WORD_RE.test(text) && JP_SCHOOL_MARK_RE.test(text)) return "school";
  if (JP_OFFICE_RE.test(text)) return "office";
  return null;
}

/**
 * 이 요청이 일본 도시 칩셋 작업인가. 대상 맵이 이미 jp_city 이면 그 맵(생성·수정만), 아니면 «야외 시공 생성» 요청이 칩셋을 부르거나 일본 거리를 말했을 때 새 맵.
 * 실내(jp_city 실내는 build_hand_interior_room tileset:"jp_city" 경로 — 여기서 받지 않는다)·NPC·질문·수정 요청이 «일본 편의점» 낱말 하나로 끌려오지 않게 의도 선언을 같이 본다.
 * 호출자는 PAW 전용 게이트가 켜진 요청(requestsModernMap)에서는 부르지 않는다 — 게이트가 이긴다.
 */
export function jpCityTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): JpCityTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  const map = mapId ? project.maps[mapId] : undefined;
  const text = requestText ?? "";
  // 시설 실내(일본 학교·사무실·병원) — 실내 의도이거나 공간이 불분명할 때. 대상 맵이 이미 jp_city 실내여도 종류를 실어 보낸다.
  const facility = intent.mode === "create" && (intent.space === "interior" || intent.space === "unclear" || intent.space === "both") ? jpFacilityOf(text) : null;
  if (map && isJpCityTilesetDef(project.tilesets[map.tilesetId])) return facility ? { mapId: map.id, lived, facility } : { mapId: map.id, lived };
  if (facility && project.tilesets[JP_CITY_TILESET_ID]) return { facility };
  if (intent.mode !== "create" || (intent.space !== "outdoor" && intent.space !== "both" && intent.space !== "unclear")) return null;
  if (!project.tilesets[JP_CITY_TILESET_ID]) return null;
  if (NAMES_JP_CITY_RE.test(text) || JP_STREET_RE.test(text)) return {};
  // 일본이라고 안 했어도 이 프로젝트가 이미 jp_city 맵을 쓰고 있으면 도시 거리 요청은 jp_city 로 간다(보는 맵이 modern_city 계열이면 제외).
  const viewedTileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (viewedTileset && (viewedTileset.id === "modern_city" || (viewedTileset.image.type === "bundled" && viewedTileset.image.id === "tex_modern_city"))) return null;
  const projectUsesJpCity = scopeUsesJpCity(project, Object.keys(project.maps));
  if (projectUsesJpCity && describesCityStreet(text)) return {};
  // 2026-10-13 실시험: 빈 프로젝트(버들항 기본)에서 「현대 도시 상점가 거리를 하천이 흐르게」가 jp_city 로 안 가고 칩셋 변경 질문에서 멈췄다(0/10). 분명한 현대 도시 낱말은 프로젝트가 jp_city 를 아직 안 써도 보낸다.
  return describesStrongModernCity(text) ? {} : null;
}

/** 범위 맵 중 하나라도 jp_city 인가(시스템 프롬프트 상세 줄 조건). */
export function scopeUsesJpCity(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isJpCityTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** jp_city 작업 첫 요청부터 스키마가 보여야 하는 도구 — 조립 도구 둘과, 그 앞뒤 순서(참고문서 → 땅 → 도로 → 검사)에 쓰는 것. */
export const JP_CITY_EXPOSED_TOOLS: readonly string[] = [
  "compose_jp_city_street", "list_jp_regions", "compose_jp_region", "paint_jp_forest", "list_jp_city_building_parts", "build_jp_city_building", "list_tileset_references", "read_tileset_reference",
  "create_map", "fill_region", "lay_path", "paint_tiles", "stamp_object", "check_reachability", "show_map_region", "ask_tileset_change",
  "set_street_traffic", "set_map_transit", "inspect_map_transit", "import_region_reference", "list_hand_interior_parts", "build_hand_interior_room", "link_jp_city_interior",
];

/** 시스템 프롬프트 한 줄(항상) — 칩셋이 있다는 사실과 길을 알린다. */
export const JP_CITY_POINTER_LINE =
  "일본 풍 거리(상가·상점가·번화가·주택가·골목·도심)는 번들 칩셋 jp_city(계열 oprn-jp)로 짓는다(PAW 전용 규칙의 예외): 새 맵 create_map tilesetId:\"jp_city\"(보는 맵이 다른 계열이면 ask_tileset_change 로 견본을 보이고 묻는다). "
  + "거리·마을·동네 한 장은 **compose_jp_city_street 가 기본**이다 — 손으로 fill_region→도로→건물을 하나씩 쌓지 않는다. 인자 style:\"shopping\"(상가·번화가·도심·역 앞)|\"residential\"(주택가), shops:[기획의 가게(konbini·izakaya·ramen·cafe·shop·office·apartment·house·machiya·garage·sento·bento)], seed(다르면 다른 거리). "
  + "맵 크기가 구성을 정한다: 40×28 이상(권장 50×36), 높이 46↑ 이면 큰길 둘+하천·다리 후보, 높이 52↑ 상가면 고층 스카이라인 — 강·고층은 인자가 아니라 크기+seed 로 나오니 원하면 create_map/resize_map 으로 키우고 seed 를 바꿔 replace:true 로 다시 짠다. "
  + "compose 는 끝에 남은 빈 대지를 쓰임(보도에 닿는 코인 주차·골목 자판기/자전거·생울타리 놀이터·텃밭·공사장·광장 분수/시계탑·화단·매점)으로 스스로 채운다 — 건물을 손으로 더하거나 옮긴 뒤에는 compose_jp_city_street({lotsOnly:true, style}) 를 한 번 더 불러 새로 생긴 빈터만 채운다(빈 땅에 소품을 하나씩 흩뿌리지 않는다). "
  + "결과 요약의 「빈터 쓰임 N곳」과 show_map_region 으로 확인한다: 쓰임이 0~1곳인데 맨 자갈이 넓게 남았으면 seed 를 바꿔 replace:true 로 다시 짠다. 사용자가 놀이터·코인 주차·텃밭·광장 분수를 콕 집어 원했는데 안 나왔으면 맵을 키우거나(50×36 이상) seed 를 바꾼다 — 빈터 쓰임은 남은 땅의 크기·위치로 고르므로 손으로 한 칸씩 찍어 맞추지 않는다. 건물 지붕 너머 1~2칸 틈에 남은 자갈은 숨 쉴 자리로 둔다. "
  + "상가 거리가 아닌 일본 장소(역 앞 로터리·운하·요코초·단치·건널목·언덕 계단 마을·마치야·고교·대학·공원·박물관 광장·마츠리·도리이 신사·오중탑 사찰·성 해자·석조 유적·지장 고개·대숲 등산로·로프웨이·계곡 폭포·습원 데크·폐선 터널·온천 마을·다랑논·어항·해변·무인역)는 list_jp_regions({query}) 로 30종 중 지역 id 를 고르고 compose_jp_region({region, seed}) 한 번으로 짓는다(맵은 region.size 권장, 40×28 이상). "
  + "숲(신사 옆 진수의 숲·공원 숲·산자락·집 뒤 숲)은 paint_jp_forest({rect 또는 beside:{x,y,w,h,side,depth} 또는 besideLocation, forestType:\"dense\"|\"grove\", grounding}) 한 번으로 — 나무 키트를 여러 번 stamp 하거나 수관 칸을 번호로 칠하지 않는다(잔디 칸만 숲이 되고 길·물·건물은 비켜 간다, 4×4 칸 이상). 자리는 숲을 원하는 잔디 구역만 — 맵 전체를 주지 않는다. 신사 옆이면 dense, 공원 안이면 grove. compose_jp_region·compose_jp_city_street 가 이미 숲을 깔았으면 show_map_region 으로 보고 모자랄 때만 더한다. "
  + "짠 뒤: 건물 하나만 고칠 때만 build_jp_city_building(id 는 list_jp_city_building_parts), 땅·소품 보정은 fill_region·stamp_object(kit:jp_city/…), 탈것은 set_map_transit. author_beodeul_town 은 쓰지 않는다. "
  + "집·가게 실내(현관·LDK·편의점·음식점·목욕탕·의원)는 완성 장소(import_region_reference) 또는 build_hand_interior_room({tileset:\"jp_city\", layout:{program:\"house-1f\" 또는 rooms:[{kind:\"genkan\"},…]}}) — 부품은 list_hand_interior_parts({tileset:\"jp_city\"}). "
  + "사무실·회의실·급탕실·병원(대기실·진찰실·병실·약국)과 일본 학교(교실·신발장 복도·교무실·보건실·특별교실) 실내도 jp_city 다 — layout:{program:\"office-floor\"|\"office-1f\"|\"hospital-1f\"|\"hospital-2f\"|\"school-1f\"|\"school-2f\"|\"school-3f\"} (일본 표지 없는 교실·대학 강의실은 캠퍼스 칩셋). "
  + "건물 문과 잇기는 link_jp_city_interior({door:{x,y}, place:<실내 장소 id> 또는 interiorMapId}) 하나로 한다(문 좌표·이름표는 list_map_locations).";

/**
 * 칠하기 도구(fill_region·lay_path·paint_tiles)의 참고문서 게이트를 «한 번에» 통과하는 읽기 목록. 실측(2026-10-04 헤드리스 시험): 조수가 입구 용도(jp-start)를
 * 문서 하나·그림만 읽고 fill_region 을 부르다 거부되고, 76건짜리 jp-autotile 로 옮겨 다시 거부돼 땅을 끝내 못 깔았다(맵이 검게 남음).
 */
export const JP_START_READ_LIST =
  "list_tileset_references({tilesetId:\"jp_city\", categoryId:\"jp-start\"}) 의 문서 3개(jp-order·jp-sheet-map·jp-dict-groups — 각 문서는 nextOffset 이 null 일 때까지 쪽마다)와 그림 3장을 "
  + "read_tileset_reference 로 **전부** 읽고, 그 읽기와 같은 응답에서는 칠하지 말고 다음 응답에서 referencePurpose:\"jp-start\" 를 준다(용도 하나를 통째로 읽어야 통과한다 — jp-autotile 은 수십 건이라 고르지 않는다)";

/** jp_city 맵이 범위에 있을 때만 붙는 상세 순서. */
export const JP_CITY_DETAIL_LINE =
  "이 작업의 맵은 일본 도시 칩셋(jp_city)이다. 거리·마을·동네를 짓거나 새로 짜는 요청이면 ① 맵이 비어 있어도 땅부터 깔지 말고 compose_jp_city_street({seed, style, shops}) 를 먼저 한 번 부른다 — 땅·도로·횡단보도·차·건물·가로등·자판기가 한 번에 나온다(칠한 맵은 replace:true, 이벤트는 남는다). "
  + "② 짠 뒤 show_map_region 으로 보고 list_map_locations 의 건물 이름표로 기획과 맞추며 고친다: 가게가 안 맞으면 shops·seed 를 바꿔 다시 짜거나 build_jp_city_building({x,y=발,w,floors,…}) 로 그 건물만 교체(문 앞 접근칸 유지, 사각형 겹침 주의). "
  + "③ 세부 보정만 손으로: fill_region/lay_path(땅 — 칠하기 전 " + JP_START_READ_LIST + "), stamp_object({objectId:\"kit:jp_city/jp-road-lane-x\", x, y}) 도로 키트(jp-road-lane-h|v·-t-s|w|n|e·-x·-bend-*·-end-*, jp-road-trunk-*, jp-fumikiri-*; 없는 이름 금지), 투명 덧그림(중앙선·점선·횡단보도)은 paint_tiles layer \"2\" 만. "
  + "빈 대지는 낱개 stamp 로 메우지 말고 compose_jp_city_street({lotsOnly:true}) 로 채운다. 손으로 꼭 놓을 땐 쓰임 짜임 그대로: 코인 주차(보도에 닿는 자리만 — 생활도로 + 칸 선 jp-lot-bay + 차 + 요금 기둥 jp-lot-board), 놀이터(jp-lot-slide·jp-lot-sandbox·jp-lot-spring + 벤치, 생울타리 입구는 보도 쪽), 텃밭(jp-lot-veg 두둑 + 빨래 장대 jp-monohoshi), 공사장(현장 사무소 jp-lot-cabin + 철망 + jp-keijiban·콘), 광장(jp-lot-fountain 또는 jp-lot-clock + jp-lot-planter·벤치 + 매점 jp-lot-kiosk). 지붕 바로 위·건물 뒤 길 없는 자리에 주차장·놀이터를 두지 않는다. "
  + "④ 가게·집 안은 link_jp_city_interior 로 문마다 잇고(import_region_reference 완성 실내 또는 build_hand_interior_room({tileset:\"jp_city\"})), 이벤트는 그 뒤에 둔다. "
  + "⑤ 차·버스·전차가 다니는 거리면 set_map_transit({auto:{}})(정류장 auto.busStops, 노면전차 2층 레일 jp-tram-rail-h + auto.tram:true), 확인은 inspect_map_transit·check_reachability·run_lint. 학교·지하철역은 완성 장소(jp-city-school-68x48 등, import_region_reference). "
  + "처음부터 build_jp_city_building 을 여러 번 부르는 손 시공은 «건물 한두 채 추가·교체» 같은 작은 수정에만 쓴다. 건물·소품을 낱칸 번호로 칠하지 않는다.";

/** 시스템 프롬프트에 붙일 줄들. */
export function jpCityPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  return scopeUsesJpCity(project, mapIds) ? [JP_CITY_POINTER_LINE, JP_CITY_DETAIL_LINE] : [JP_CITY_POINTER_LINE];
}

/** 의도 노트(모델 지시문 뒤에 붙는다) — buildPiIntentNote 가 숲마을 노트 대신 쓴다. */
/** 시설 실내 노트 — 방 구성(program)과 방 종류(rooms)를 한 줄로. */
const FACILITY_NOTE: Record<JpFacility, { ko: string; programs: string; rooms: string; floor: string }> = {
  school: { ko: "일본 학교(中学校・高校) 실내",
    programs: "교실 둘 + 복도 → {program:\"school-2f\"}; 昇降口(신발장)·복도·교무실·보건실·화장실 → {program:\"school-1f\"}; 음악실·도서실·이과실 → {program:\"school-3f\"}; 취주악부실·인쇄실·트로피장 복도(특별교실동) → {program:\"school-annex\"}; 옥상 → {program:\"school-roof\"}; 체육관 → {program:\"gym\"}",
    rooms: "classroom·corridor·shoegenkan·staffroom·infirmary·musicroom·library·sciencelab·schooltoilet·rooftop·bandroom·printroom·annexcorridor",
    floor: "교실 sc-classroom-wood, 복도 sc-corridor, 현관 sc-genkan-tile, 벽 sc-wall" },
  office: { ko: "일본 사무 빌딩 실내",
    programs: "사무층(자유석·책상 섬·회의실·급탕실·엘리베이터 홀) → {program:\"office-floor\"}; 1층 로비·접수·엘리베이터 홀 → {program:\"office-1f\"}; IT 회사·스타트업 자유석 층(긴 책상 섬·스탠딩 회의·라운지) → {program:\"office-free\"}, 그 1층(경비 데스크·방문자 접수) → {program:\"office-tower-1f\"}",
    rooms: "openoffice·freeoffice·meetingroom·pantry·elevatorhall·lobby·towerlobby·stairwell",
    floor: "사무 of-carpet-tile, 로비 of-lobby-stone, 급탕실 of-pantry-tile, 벽 of-wall" },
  hospital: { ko: "일본 병원 실내",
    programs: "외래 대기실·종합 접수·진찰실·처치실·원내 약국 → {program:\"hospital-1f\"}; 병동 복도·2인 병실·간호사 대기소 → {program:\"hospital-2f\"}; 작은 동네 의원 하나면 {program:\"clinic\"}",
    rooms: "hosp-lobby·hosp-exam·hosp-treat·hosp-pharmacy·hosp-corridor·hosp-ward·hosp-nurse",
    floor: "대기실·복도 hs-floor-sheet, 병실·진찰실 hs-floor-ward, 벽 hs-wall·hs-wall-room" },
};

export function formatJpCityNote(target: JpCityTarget, targetMap: { id: string; width: number; height: number } | null): string {
  if (target.facility) {
    const f = FACILITY_NOTE[target.facility];
    return [
      `[${f.ko} — jp_city] 이 요청은 ${f.ko}다. 칩셋은 번들 일본 도시(jp_city)의 손 도트 실내다 — 판타지 손 도트 실내(atlas_biome_interior)·캠퍼스 칩셋·폐병원/폐교 던전 장소는 쓰지 않는다.`,
      "짓는 법: build_hand_interior_room({tileset:\"jp_city\", name, exitWidth:2, layout:{…}}) 한 번 — 방 배치·칸막이·문·출구는 도구가 짜고 방마다 예제 가구 한 벌을 심는다. plan·objects 를 손으로 쓰지 않는다. "
        + `layout: ${f.programs}. 방 종류만 고를 때는 layout:{rooms:[{kind:"…"}]} (종류: ${f.rooms}).`,
      `floor·wall 은 꼭 준다(건물 기본 — 방마다 바닥·벽은 견본이 덮는다): ${f.floor}. 부품 확인은 list_hand_interior_parts({tileset:\"jp_city\", room:"<방 종류>"}).`,
      "만든 뒤 결과 data.layout.picture 로 배치를 보고 출입구에서 닿지 못한 바닥이 0인지 확인한다. 거리 건물 문과 이을 때는 link_jp_city_interior. 사람(교사·직원·의사·환자)은 Actor1 캐릭터 이벤트로 놓는다.",
      // 2026-10-14 gemini-4-argon 실조수 4건: 넷 다 첫 호출에 program 으로 잘 지었는데, 둘은 그 뒤 같은 맵을 variant·rooms·손 objects 로 4~5번 다시 지어
      // 견본 배치를 버리고 손 평면(22×16)·w/h 를 준 rooms 로 좁혀 가구가 겹쳤다.
      "결과가 「닿지 못한 빈 바닥 0, 경고 0」이면 그 배치를 그대로 둔다 — 같은 맵을 rooms·plan·objects 로 다시 짓지 않는다(견본 방이 가장 잘 맞춘 배치다; 복도·현관·대기실의 빈 바닥은 동선이다). "
        + "배치만 달리 보고 싶을 때는 layout.variant 하나만 바꾼다. rooms 로 지을 때 w·h 는 주지 않는다(방 크기는 견본이 정한다 — 작게 주면 가구가 겹친다).",
    ].join("\n");
  }
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 jp_city 이고 비어 있다 → 이 맵에 짓는다.`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 jp_city 이고 이미 내용이 있다 → get_map_region 으로 빈 땅을 찾아 거기에 건물을 더하고(기존 칸을 지우지 않는다), 끝에 compose_jp_city_street({lotsOnly:true}) 로 남은 빈터만 쓰임으로 채운다.`
      : "jp_city 맵이 아직 없다 → create_map({name, width:50, height:36, tilesetId:\"jp_city\"}) 로 새 맵을 만든다. 지금 보는 맵이 다른 계열이면 실행기가 거부한다 — 그때는 칠하지 말고 ask_tileset_change(toTilesetId:\"jp_city\", reason) 로 사용자에게 견본을 보이고 이 턴을 끝낸다.";
  return [
    "[일본 거리 시공 — jp_city] 이 요청의 칩셋은 번들 일본 도시(jp_city, 계열 oprn-jp)다. author_beodeul_town 은 버들항 전용이라 쓰지 않는다 — "
      + "거리·마을·동네 한 장은 compose_jp_city_street({seed, style:\"shopping\"|\"residential\", shops}) 가 기본이다(손으로 땅→도로→건물을 쌓지 않는다). 낱칸 번호로 건물을 칠하지 않는다.",
    where,
    "순서: (새 맵이면 40×28 이상, 권장 50×36·큰 도심은 60×56) compose_jp_city_street → show_map_region·list_map_locations 로 확인 → 안 맞는 건물만 build_jp_city_building(손으로 건물을 더했으면 이어서 compose_jp_city_street({lotsOnly:true}) 로 빈터만 채운다 — 소품을 흩뿌리지 않는다), 땅·소품은 fill_region·stamp_object(먼저 " + JP_START_READ_LIST + ") → "
      + "문마다 link_jp_city_interior 로 실내 잇기 → check_reachability → 차·버스가 다니는 거리면 set_map_transit({auto:{}}). 건물 한두 채 수정이면 compose 없이 build_jp_city_building 만 쓴다. "
      + "건물을 띠 밖에 손으로 놓지 않는다(문 앞에 보도 줄이 있어야 한다), 옥상 간판 head 는 3층+·폭 6+ 건물에만(비워 두는 게 기본), 대지는 자갈 한 가지로 깔고 잔디는 담·생울타리로 두른 앞마당 줄에만 쓴다.",
  ].join("\n");
}
