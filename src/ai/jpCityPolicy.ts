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
  if (map && isJpCityTilesetDef(project.tilesets[map.tilesetId])) return { mapId: map.id, lived };
  if (intent.mode !== "create" || (intent.space !== "outdoor" && intent.space !== "both" && intent.space !== "unclear")) return null;
  if (!project.tilesets[JP_CITY_TILESET_ID]) return null;
  const text = requestText ?? "";
  return NAMES_JP_CITY_RE.test(text) || JP_STREET_RE.test(text) ? {} : null;
}

/** 범위 맵 중 하나라도 jp_city 인가(시스템 프롬프트 상세 줄 조건). */
export function scopeUsesJpCity(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isJpCityTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** jp_city 작업 첫 요청부터 스키마가 보여야 하는 도구 — 조립 도구 둘과, 그 앞뒤 순서(참고문서 → 땅 → 도로 → 검사)에 쓰는 것. */
export const JP_CITY_EXPOSED_TOOLS: readonly string[] = [
  "list_jp_city_building_parts", "build_jp_city_building", "list_tileset_references", "read_tileset_reference",
  "create_map", "fill_region", "lay_path", "paint_tiles", "stamp_object", "check_reachability", "show_map_region", "ask_tileset_change",
  "set_map_transit", "inspect_map_transit", "import_region_reference", "list_hand_interior_parts", "build_hand_interior_room",
];

/** 시스템 프롬프트 한 줄(항상) — 칩셋이 있다는 사실과 길을 알린다. */
export const JP_CITY_POINTER_LINE =
  "일본 상가·상점가·골목 거리 풍경은 번들 칩셋 jp_city(계열 oprn-jp)로 짓는다(PAW 전용 규칙의 예외): 새 맵 create_map tilesetId:\"jp_city\"(보는 맵이 다른 계열이면 ask_tileset_change 로 견본을 보이고 묻는다), "
  + "건물은 build_jp_city_building(id 는 list_jp_city_building_parts), 길은 fill_region·lay_path·stamp_object(kit:jp_city/jp-road-…). author_beodeul_town 은 쓰지 않는다. "
  + "일본 집 실내(현관·화실·LDK·욕실·원룸)는 build_hand_interior_room({tileset:\"jp_city\", plan, …}) — 부품은 list_hand_interior_parts({tileset:\"jp_city\"}).";

/**
 * 칠하기 도구(fill_region·lay_path·paint_tiles)의 참고문서 게이트를 «한 번에» 통과하는 읽기 목록. 실측(2026-10-04 헤드리스 시험): 조수가 입구 용도(jp-start)를
 * 문서 하나·그림만 읽고 fill_region 을 부르다 거부되고, 76건짜리 jp-autotile 로 옮겨 다시 거부돼 땅을 끝내 못 깔았다(맵이 검게 남음).
 */
export const JP_START_READ_LIST =
  "list_tileset_references({tilesetId:\"jp_city\", categoryId:\"jp-start\"}) 의 문서 3개(jp-order·jp-sheet-map·jp-dict-groups — 각 문서는 nextOffset 이 null 일 때까지 쪽마다)와 그림 3장을 "
  + "read_tileset_reference 로 **전부** 읽고, 그 읽기와 같은 응답에서는 칠하지 말고 다음 응답에서 referencePurpose:\"jp-start\" 를 준다(용도 하나를 통째로 읽어야 통과한다 — jp-autotile 은 수십 건이라 고르지 않는다)";

/** jp_city 맵이 범위에 있을 때만 붙는 상세 순서. */
export const JP_CITY_DETAIL_LINE =
  "이 작업의 맵은 일본 도시 칩셋(jp_city)이다. 순서: "
  + "① 땅 — 새 jp_city 맵은 비어 있다(검게 보임). 건물 자리 밑까지 fill_region/lay_path 로 잔디·보도 연석·생활도로를 먼저 깐다(오토타일은 몸통만 칠하면 가장자리를 도구가 맞춘다). "
  + "칠하기 전 입구 용도를 읽는다 — " + JP_START_READ_LIST + ". "
  + "② 도로 교차로·T자·건널목은 stamp_object({objectId:\"kit:jp_city/jp-road-lane-x\", x, y}) — x,y 는 키트 왼쪽 위 칸. 키트 id: jp-road-lane-h|v(직선 6×4, 간격 두고 반복)·-t-s|w|n|e·-x·-bend-es|sw|wn|ne·-end-w|n|e|s, jp-road-trunk-h|v|x(간선), jp-fumikiri-v|h(건널목). 없는 이름을 지어내지 않는다. "
  + "③ 건물 — 문 앞 바닥(보도)을 먼저 깔고, 뒷줄(맵 위쪽) 건물부터 build_jp_city_building({x,y=건물 발(왼쪽 아래),w,floors,ground,roof,…}). 건물 사각형(위로 높이만큼)이 겹치지 않게 발 y 를 높이+1 이상 띄운다(도구는 겹침을 거부하지 않는다). 오류가 나면 맵은 안 바뀐다 — 코드·좌표대로 고쳐 다시 부른다. "
  + "완성 예제 25개는 list_jp_city_building_parts({example}) 로 받아 x,y 만 더한다. "
  + "④ 투명 덧그림(중앙선·차선 점선·횡단보도·점자블록)은 paint_tiles layer \"2\" 로만 칠한다(1·3 층 요청은 3층으로 돌려져 모양이 안 맞는다). "
  + "⑤ 탈것 — 길을 다 깐 뒤 set_map_transit({auto:{}}) 가 맵 끝에서 끝까지 이어진 생활도로에 좌측통행 차 흐름을 깐다(게임에서 실제로 달리고 주인공 앞에서 선다). "
  + "버스 정류장은 auto.busStops:[{x,y=버스 머리가 서는 차선 칸,name,board}], 노면전차는 2층 레일 jp-tram-rail-h 를 맵 끝까지 깔고 auto.tram:true(복선이면 양방향), 굽은 길·순환선·지하철은 routes 로 칸 경로. "
  + "탈것 그림을 타일로 찍지 않는다. 쓰는 법·칸 규칙은 참고문서 용도 jp-transit(jp-transit-rules), 깐 뒤 inspect_map_transit 로 확인. "
  + "학교·지하철역은 완성 장소(jp-city-school-68x48 등, import_region_reference)와 jp-school·jp-transit 문서의 예제 배열을 본뜬다. "
  + "확인은 check_reachability·show_map_region·run_lint. 건물·소품을 낱칸 번호로 칠하지 않는다.";

/** 시스템 프롬프트에 붙일 줄들. */
export function jpCityPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  return scopeUsesJpCity(project, mapIds) ? [JP_CITY_POINTER_LINE, JP_CITY_DETAIL_LINE] : [JP_CITY_POINTER_LINE];
}

/** 의도 노트(모델 지시문 뒤에 붙는다) — buildPiIntentNote 가 숲마을 노트 대신 쓴다. */
export function formatJpCityNote(target: JpCityTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 jp_city 이고 비어 있다 → 이 맵에 짓는다.`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 jp_city 이고 이미 내용이 있다 → get_map_region 으로 빈 땅을 찾아 거기에 건물을 더한다(기존 칸을 지우지 않는다).`
      : "jp_city 맵이 아직 없다 → create_map({name, width:50, height:36, tilesetId:\"jp_city\"}) 로 새 맵을 만든다. 지금 보는 맵이 다른 계열이면 실행기가 거부한다 — 그때는 칠하지 말고 ask_tileset_change(toTilesetId:\"jp_city\", reason) 로 사용자에게 견본을 보이고 이 턴을 끝낸다.";
  return [
    "[일본 거리 시공 — jp_city] 이 요청의 칩셋은 번들 일본 도시(jp_city, 계열 oprn-jp)다. author_beodeul_town 은 버들항 전용이라 쓰지 않는다 — "
      + "길과 땅은 fill_region/lay_path·stamp_object(kit:jp_city/jp-road-…), 건물은 build_jp_city_building 이 짓는다. 낱칸 번호로 건물을 칠하지 않는다.",
    where,
    "순서: 땅(보도 연석·생활도로·잔디; 먼저 " + JP_START_READ_LIST + ") → 도로 교차로 키트 stamp_object → 문 앞 보도 → 뒷줄 건물부터 build_jp_city_building(list_jp_city_building_parts 로 id·완성 예제, 사각형이 겹치지 않게 발 y 를 높이+1 이상 띄운다) → "
      + "투명 덧그림은 paint_tiles layer \"2\" → check_reachability 로 문 앞 도달, show_map_region 으로 눈 확인 → 차·버스가 다니는 거리면 set_map_transit({auto:{}})(정류장은 auto.busStops).",
  ].join("\n");
}
