// SF 정거장·네온 거리(sf_station, 계열 oprn-scifi) 조수 연결 — 우주 정거장·우주선·연구 기지·달/행성 기지·사이버펑크 네온 거리 요청이
// 이 번들 칩셋과 맵 구성기(compose_sf_station_map)로 가게 한다. gothicPolicy·jpCityPolicy 와 같은 모양(대상 판정 + 포인터·상세 줄 + 의도 노트).
// 칩셋이 프로젝트에 «있을 때만» 라우팅한다(번들이라 새 프로젝트·옛 프로젝트 모두 ensureBundledTilesets 로 갖는다).
// 칩셋 정의는 이 파일 밖이다 — 여기서는 id 문자열만 쓴다(정의 JSON 이 크다).
// 주의: 노트·문장은 모델 지시문에 실린다 — PAW 게이트 낱말(현·대·모·던 이어 쓴 말, 영어 m-o-d-e-r-n)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const SF_STATION_TILESET_ID = "sf_station";
const SF_STATION_TEXTURE = "tex_sf_station";

export function isSfStationTilesetDef(tileset: Pick<TilesetDef, "image" | "id"> | undefined): boolean {
  return !!tileset && (tileset.id === SF_STATION_TILESET_ID || (tileset.image.type === "bundled" && tileset.image.id === SF_STATION_TEXTURE));
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. */
const NAMES_SF_RE = /sf[_-]station|oprn-scifi|SF\s*(?:정거장\s*)?(?:칩셋|타일셋)/iu;
/** 이 칩셋이 그 일을 하는 낱말: 우주 정거장·우주선 내부·콜로니·달/화성 기지·연구 기지·사이버펑크·네온 거리·SF. */
const SF_WORD_RE = /우주\s*정거장|정거장\s*(?:로비|거주구|내부|복도)|우주\s*(?:기지|선(?:\s*내부)?|함선|콜로니|식민지|도시)|우주선|함교|콜로니|달\s*기지|월면\s*기지|화성\s*기지|행성\s*기지|궤도\s*기지|연구\s*기지|사이버\s*펑크|사이버펑크|네온\s*(?:거리|도시|골목|번화가|시티)|미래\s*(?:도시|거리)|\bSF\b|에스에프|공상\s*과학|space\s*station|spaceship|starship|moon\s*base|lunar\s*base|mars\s*base|cyber\s*punk|cyberpunk|neon\s*(?:street|city)|sci-?fi/iu;
/** 연구소·실험실만 말한 문장은 SF 낱말이 함께 있을 때만 이 칩셋이다(평범한 학교 실험실·병원은 아니다). */

export function namesSfStationTileset(text: string | undefined): boolean {
  return !!text && NAMES_SF_RE.test(text);
}

export function describesSfPlace(text: string | undefined): boolean {
  return !!text && SF_WORD_RE.test(text);
}

export interface SfStationTarget {
  /** 대상 맵이 이미 sf_station 이면 그 맵 — 아니면 새 맵. */
  readonly mapId?: string;
  readonly lived?: boolean;
}

/**
 * 이 요청이 SF 칩셋 작업인가. 대상 맵이 이미 sf_station 이면 그 맵(생성·수정), 아니면 프로젝트에 칩셋이 «있고» 요청이 칩셋을 부르거나 SF 장소를 말한 새 맵 생성.
 * 질문·단순 수정 요청은 낱말 하나로 끌려오지 않게 의도 선언을 같이 본다. jp_city·고딕보다 먼저 본다(«사이버펑크 거리»가 일본 도시로 가지 않게).
 */
export function sfStationTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): SfStationTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && isSfStationTilesetDef(project.tilesets[map.tilesetId])) return { mapId: map.id, lived };
  if (intent.mode !== "create") return null;
  if (!Object.values(project.tilesets).some(isSfStationTilesetDef)) return null;
  const text = requestText ?? "";
  return NAMES_SF_RE.test(text) || describesSfPlace(text) ? {} : null;
}

/** 범위 맵 중 하나라도 sf_station 인가(시스템 프롬프트 상세 줄 조건). */
export function scopeUsesSfStation(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isSfStationTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** sf_station 작업 첫 요청부터 스키마가 보여야 하는 도구 — 구성기 → 확인 → 보정 → 접근칸 검사. */
export const SF_STATION_EXPOSED_TOOLS: readonly string[] = [
  "compose_sf_station_map", "create_map", "resize_map", "show_map_region", "list_map_locations", "list_tileset_references", "read_tileset_reference",
  "stamp_object", "fill_region", "paint_tiles", "check_reachability", "ask_tileset_change", "create_transfer_pair", "link_maps",
];

/** 맵 종류 고르기 — 요청 낱말 → compose_sf_station_map 의 kind. */
const KIND_GUIDE =
  "kind 고르기: 우주 정거장·우주선 안·로비·거주구·선실 → station(44×32) / 연구소·실험실·의무실·연구 기지 안 → lab(40×30) / 사이버펑크·네온 거리·미래 도시 번화가 → street(48×30) / 달·화성·행성 기지 바깥·착륙장 → moonbase(48×32). "
  + "«달 기지 연구소»처럼 바깥과 안을 함께 말하면 맵 두 장: moonbase(바깥) + lab(안)을 짓고, 바깥 맵의 «연구 모듈» 문과 안 맵 복도를 create_transfer_pair 로 잇는다.";

/** 시스템 프롬프트 한 줄(항상) — 칩셋이 있다는 사실과 길을 알린다. 칩셋이 프로젝트에 없으면 붙이지 않는다. */
export const SF_STATION_POINTER_LINE =
  "우주 정거장·우주선·연구 기지·달/화성 기지·사이버펑크 네온 거리 같은 SF 장소는 번들 칩셋 sf_station(계열 oprn-scifi)으로 짓는다: 새 맵 create_map({name, width, height, tilesetId:\"sf_station\"}) → "
  + "**compose_sf_station_map({kind, seed}) 가 기본**이다 — 손으로 벽·바닥·기물을 하나씩 깔지 않는다(벽 천장·앞면 두 줄·문 통로·통행 검사를 구성기가 한다). " + KIND_GUIDE
  + " 다시 짜려면 seed 를 바꿔 replace:true. 낱칸 번호로 칠하거나 다른 칩셋의 가구를 섞지 않는다.";

/** sf_station 맵이 범위에 있을 때만 붙는 상세 순서. */
export const SF_STATION_DETAIL_LINE =
  "이 작업의 맵은 SF 칩셋(sf_station)이다. ① 맵이 비어 있으면 땅부터 칠하지 말고 compose_sf_station_map({kind, seed}) 를 먼저 부른다(손댄 맵은 replace:true). 맵이 작다고 거절되면 resize_map 으로 권장 크기로 키운다. "
  + "② show_map_region 으로 결과를 보고 list_map_locations 의 구역·건물 이름표(문 좌표·문 앞 접근칸)를 읽어 기획과 맞춘다 — 안 맞으면 seed 를 바꿔 다시 짠다. "
  + "③ 문 앞 접근칸에 이동 이벤트·NPC·단서를 둔다(문 그림 칸이 아니라 그 아래 바닥 칸). 기물 하나를 더할 때만 stamp_object({objectId:\"kit:sf_station/sf-<id>\", x, y}) — id 는 list_tileset_references({tilesetId:\"sf_station\"}) 의 사전에서 고른다. "
  + "④ 끝나면 check_reachability 로 출발 칸에서 문 앞 접근칸들에 닿는지 확인한다. "
  + "⑤ 구성기 결과는 완성된 배치다 — 「비어 보인다」고 기물을 흩뿌리지 않는다. 도로·차선·횡단보도·보도 가장자리·착륙장·복도·문 통로(노란 줄무늬) 위에는 아무것도 찍지 않고, 같은 장비(흄 후드·프린터·서버 랙)를 겹으로 늘리지 않는다. "
  + "방이 너무 비면 기물을 더하지 말고 seed 를 바꿔 다시 짠다. 사용자 기획에 필요한 것(인물·단서·이동 이벤트)을 더하는 것이 다음 일이다.";

/** 시스템 프롬프트에 붙일 줄들. 칩셋이 프로젝트에 없으면 아무것도 붙이지 않는다. */
export function sfStationPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!Object.values(project.tilesets).some(isSfStationTilesetDef)) return [];
  return scopeUsesSfStation(project, mapIds) ? [SF_STATION_POINTER_LINE, SF_STATION_DETAIL_LINE] : [SF_STATION_POINTER_LINE];
}

/** 의도 노트(모델 지시문 뒤에 붙는다). */
export function formatSfStationNote(target: SfStationTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 sf_station 이고 비어 있다 → 이 맵에 compose_sf_station_map 으로 짓는다(작으면 resize_map 먼저).`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 sf_station 이고 이미 내용이 있다 → 다시 짜는 요청이면 compose_sf_station_map({kind, seed:다른 값, replace:true}), 더하는 요청이면 show_map_region 으로 빈 곳을 찾아 stamp_object 로 더한다.`
      : "sf_station 맵이 아직 없다 → 묻지 말고 create_map({name, width, height, tilesetId:\"sf_station\"}) 로 권장 크기의 새 맵을 만든다(새 맵은 계열 확인이 필요 없다 — 지금 보는 맵이 버들항이어도 그 맵은 건드리지 않는다). "
        + "ask_tileset_change 는 사용자가 «지금 이 맵»을 SF 로 바꿔 칠하라고 했을 때만 쓴다.";
  return [
    "[SF 장소 시공 — sf_station] 이 요청의 칩셋은 번들 SF 정거장·네온 거리(sf_station, 계열 oprn-scifi)다. 버들항·일본 도시·고딕 도구는 쓰지 않는다. 맵 한 장은 compose_sf_station_map({kind, seed}) 한 번이 기본이다(벽·바닥·기물을 손으로 쌓지 않는다).",
    where,
    KIND_GUIDE,
    "순서: create_map(권장 크기) → compose_sf_station_map → show_map_region·list_map_locations 로 확인 → 문 앞 접근칸에 이벤트 → check_reachability. 기획과 안 맞으면 seed 만 바꿔 replace:true 로 다시 짠다.",
    "구성기 결과에 기물을 흩뿌려 채우지 않는다 — 도로·횡단보도·착륙장·복도·문 통로 위에는 찍지 않고, 같은 장비를 겹으로 늘리지 않는다. 더할 것은 기획의 인물·단서·이동 이벤트다.",
  ].join("\n");
}
