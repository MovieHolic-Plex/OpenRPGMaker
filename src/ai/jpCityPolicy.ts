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
  "compose_jp_city_street", "list_jp_city_building_parts", "build_jp_city_building", "list_tileset_references", "read_tileset_reference",
  "create_map", "fill_region", "lay_path", "paint_tiles", "stamp_object", "check_reachability", "show_map_region", "ask_tileset_change",
  "set_map_transit", "inspect_map_transit", "import_region_reference", "list_hand_interior_parts", "build_hand_interior_room", "link_jp_city_interior",
];

/** 시스템 프롬프트 한 줄(항상) — 칩셋이 있다는 사실과 길을 알린다. */
export const JP_CITY_POINTER_LINE =
  "일본 풍 거리(상가·상점가·번화가·주택가·골목·도심)는 번들 칩셋 jp_city(계열 oprn-jp)로 짓는다(PAW 전용 규칙의 예외): 새 맵 create_map tilesetId:\"jp_city\"(보는 맵이 다른 계열이면 ask_tileset_change 로 견본을 보이고 묻는다). "
  + "거리·마을·동네 한 장은 **compose_jp_city_street 가 기본**이다 — 손으로 fill_region→도로→건물을 하나씩 쌓지 않는다. 인자 style:\"shopping\"(상가·번화가·도심·역 앞)|\"residential\"(주택가), shops:[기획의 가게(konbini·izakaya·ramen·cafe·shop·office·apartment·house·machiya·garage·sento·bento)], seed(다르면 다른 거리). "
  + "맵 크기가 구성을 정한다: 40×28 이상(권장 50×36), 높이 46↑ 이면 큰길 둘+하천·다리 후보, 높이 52↑ 상가면 고층 스카이라인 — 강·고층은 인자가 아니라 크기+seed 로 나오니 원하면 create_map/resize_map 으로 키우고 seed 를 바꿔 replace:true 로 다시 짠다. "
  + "짠 뒤: 건물 하나만 고칠 때만 build_jp_city_building(id 는 list_jp_city_building_parts), 땅·소품 보정은 fill_region·stamp_object(kit:jp_city/…), 탈것은 set_map_transit. author_beodeul_town 은 쓰지 않는다. "
  + "집·가게 실내(현관·LDK·편의점·음식점·목욕탕·의원)는 완성 장소(import_region_reference) 또는 build_hand_interior_room({tileset:\"jp_city\", layout:{program:\"house-1f\" 또는 rooms:[{kind:\"genkan\"},…]}}) — 부품은 list_hand_interior_parts({tileset:\"jp_city\"}). "
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
  + "④ 가게·집 안은 link_jp_city_interior 로 문마다 잇고(import_region_reference 완성 실내 또는 build_hand_interior_room({tileset:\"jp_city\"})), 이벤트는 그 뒤에 둔다. "
  + "⑤ 차·버스·전차가 다니는 거리면 set_map_transit({auto:{}})(정류장 auto.busStops, 노면전차 2층 레일 jp-tram-rail-h + auto.tram:true), 확인은 inspect_map_transit·check_reachability·run_lint. 학교·지하철역은 완성 장소(jp-city-school-68x48 등, import_region_reference). "
  + "처음부터 build_jp_city_building 을 여러 번 부르는 손 시공은 «건물 한두 채 추가·교체» 같은 작은 수정에만 쓴다. 건물·소품을 낱칸 번호로 칠하지 않는다.";

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
      + "거리·마을·동네 한 장은 compose_jp_city_street({seed, style:\"shopping\"|\"residential\", shops}) 가 기본이다(손으로 땅→도로→건물을 쌓지 않는다). 낱칸 번호로 건물을 칠하지 않는다.",
    where,
    "순서: (새 맵이면 40×28 이상, 권장 50×36·큰 도심은 60×56) compose_jp_city_street → show_map_region·list_map_locations 로 확인 → 안 맞는 건물만 build_jp_city_building, 땅·소품은 fill_region·stamp_object(먼저 " + JP_START_READ_LIST + ") → "
      + "문마다 link_jp_city_interior 로 실내 잇기 → check_reachability → 차·버스가 다니는 거리면 set_map_transit({auto:{}}). 건물 한두 채 수정이면 compose 없이 build_jp_city_building 만 쓴다. "
      + "건물을 띠 밖에 손으로 놓지 않는다(문 앞에 보도 줄이 있어야 한다), 옥상 간판 head 는 3층+·폭 6+ 건물에만(비워 두는 게 기본), 대지는 자갈 한 가지로 깔고 잔디는 담·생울타리로 두른 앞마당 줄에만 쓴다.",
  ].join("\n");
}
