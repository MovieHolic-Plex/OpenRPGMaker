// 하늘섬(sky_island) 조수 연결 — 하늘섬·구름 위·비공정·떠 있는 섬 요청이 이 번들 칩셋과 구성 도구(compose_sky_island_map)로 가게 한다.
// campusPolicy·gothicPolicy 와 같은 모양(대상 판정 + 포인터 줄 + 상세 줄 + 의도 노트)이다. 칩셋이 프로젝트에 «있을 때만» 길이 열린다 — 없으면 아무 줄도 붙지 않는다.
// 주의: 이 파일의 노트·문장은 모델 지시문(task)에 실린다 — PAW 전용 게이트 낱말(현대·모던·modern)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const SKY_ISLAND_TILESET_ID = "sky_island";
const SKY_ISLAND_TEXTURE = "tex_sky_island";

export function isSkyIslandTilesetDef(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === SKY_ISLAND_TEXTURE;
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. */
const NAMES_SKY_RE = /sky[_-]?island|oprn-sky|하늘섬\s*(?:칩셋|타일셋)/iu;
/** 하늘섬 풍경 낱말 — 하늘섬·공중섬·부유섬·떠 있는 섬·구름 위·구름 섬·비공정·비행선. */
const SKY_WORD_RE = /하늘\s*섬|공중\s*(?:섬|도시|정원|마을)|부유\s*(?:섬|대륙|도시)|떠\s*(?:있는|다니는)\s*(?:섬|마을|도시|신전)|구름\s*(?:위|섬|바다|마을|신전|정원)|구름\s*속|천공\s*(?:섬|도시)|비공정|비행선|하늘\s*(?:마을|신전|부두|항구|정원)|floating\s+island|sky\s*island|airship|cloud\s+(?:island|temple|village)/iu;
/** 단독 «구름» — 다른 칩셋 낱말 없이 «구름 …» 장소를 말할 때만(구름다리·먹구름 날씨는 아니다). */
const CLOUD_PLACE_RE = /구름(?!다리|\s*낀|\s*많|\s*효과|\s*그림자)/u;
const NOT_SKY_RE = /날씨|일기|기상|먹구름|비구름|구름\s*(?:효과|파티클|애니메이션)/u;

export function namesSkyIslandTileset(text: string | undefined): boolean {
  return !!text && NAMES_SKY_RE.test(text);
}

/** 하늘섬 풍경·장소를 말한 문장인가. */
export function describesSkyIsland(text: string | undefined): boolean {
  if (!text || NOT_SKY_RE.test(text)) return false;
  return SKY_WORD_RE.test(text) || (CLOUD_PLACE_RE.test(text) && /(?:신전|마을|섬|정원|성|부두|집|만들|지어)/u.test(text));
}

/** 프로젝트가 sky_island 번들 칩셋을 갖고 있는가. */
export function hasSkyIslandTileset(project: Pick<Project, "tilesets">): boolean {
  const def = project.tilesets[SKY_ISLAND_TILESET_ID];
  return !!def && isSkyIslandTilesetDef(def);
}

export type SkyIslandStyleHint = "village" | "shrine" | "dock" | "archipelago" | "room-cottage" | "room-shrine" | "room-cabin" | "room-observatory";

export interface SkyIslandTarget {
  /** 대상 맵이 이미 sky_island 면 그 맵 — 아니면 새 맵을 만든다. */
  readonly mapId?: string;
  readonly lived?: boolean;
  /** 문장에서 읽은 구성 종류(compose_sky_island_map style). */
  readonly style: SkyIslandStyleHint;
}

const INDOOR_RE = /실내|안쪽|내부|선실|객실|조타실|방(?=\s|을|이|$|\.)|interior|cabin|inside/iu;
/** 문장에서 구성 종류를 고른다. 실내 낱말이 있거나 의도 선언이 실내면 방 넷 중 하나. */
export function skyIslandStyleFor(text: string, interior: boolean): SkyIslandStyleHint {
  if (interior || INDOOR_RE.test(text)) {
    if (/비공정|비행선|선실|조타|airship|cabin/iu.test(text)) return "room-cabin";
    if (/천문|별|망원경|observatory/iu.test(text)) return "room-observatory";
    if (/신전|사당|제단|성소|shrine|temple/iu.test(text)) return "room-shrine";
    return "room-cottage";
  }
  if (/비공정|비행선|부두|선착장|정박|항구|잔교|airship|dock|harbor|pier/iu.test(text)) return "dock";
  if (/신전|사당|제단|성소|shrine|temple/iu.test(text)) return "shrine";
  if (/섬\s*(?:들|여러|사슬|군도)|군도|여러\s*섬|섬\s*(?:넷|네\s*개|셋|세\s*개)|다리로\s*(?:잇|이어|연결)|archipelago|chain/iu.test(text)) return "archipelago";
  return "village";
}

/**
 * 이 요청이 하늘섬 칩셋 작업인가.
 *  - 대상 맵이 이미 sky_island 면 그 맵(생성·수정만).
 *  - 아니면 «생성» 요청이 칩셋 이름을 부르거나 하늘섬·구름 위·비공정을 말했을 때 새 맵 — **프로젝트에 칩셋이 있을 때만**.
 * 호출자는 jp_city·고딕이 이미 잡았으면 부르지 않는다.
 */
export function skyIslandTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): SkyIslandTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  if (!hasSkyIslandTileset(project)) return null;
  const text = requestText ?? "";
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && isSkyIslandTilesetDef(project.tilesets[map.tilesetId])) return { mapId: map.id, lived, style: skyIslandStyleFor(text, intent.space === "interior") };
  if (intent.mode !== "create") return null;
  if (!NAMES_SKY_RE.test(text) && !describesSkyIsland(text)) return null;
  return { style: skyIslandStyleFor(text, intent.space === "interior") };
}

/** 범위 맵 중 하나라도 sky_island 인가(시스템 프롬프트 상세 줄 조건). */
export function scopeUsesSkyIsland(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isSkyIslandTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** 하늘섬 작업 첫 요청부터 스키마가 보여야 하는 도구. */
export const SKY_ISLAND_EXPOSED_TOOLS: readonly string[] = [
  "list_tileset_references", "read_tileset_reference", "create_map", "resize_map", "compose_sky_island_map", "link_sky_island_interior",
  "list_tileset_objects", "stamp_tileset_object", "check_reachability", "show_map_region", "ask_tileset_change",
];

/** 시스템 프롬프트 한 줄 — 칩셋이 **프로젝트에 있을 때만** 붙는다. */
export const SKY_ISLAND_POINTER_LINE =
  "하늘섬·공중섬·떠 있는 섬·구름 위 신전·비공정 부두 풍경은 번들 칩셋 sky_island 로 짓는다: 새 맵 create_map tilesetId:\"sky_island\"(보는 맵이 다른 계열이면 ask_tileset_change 로 견본을 보이고 묻는다), "
  + "그다음 compose_sky_island_map({style, seed}) 한 번으로 섬·건물·다리·소품을 함께 깐다 — style: village 마을 · shrine 신전 섬 · dock 비공정 부두 · archipelago 섬 사슬 · room-cottage/room-shrine/room-cabin/room-observatory 실내. "
  + "빈 맵이면 도구가 크기를 맞춘다. 낱칸 번호로 섬을 칠하지 않는다. 건물 실내는 room-… 로 새 맵을 짓고 link_sky_island_interior 로 문과 잇는다. 사람은 Actor1 캐릭터 이벤트로 놓는다.";

/** sky_island 맵이 범위에 있을 때만 붙는 상세 순서. */
export const SKY_ISLAND_DETAIL_LINE =
  "이 작업의 맵은 하늘섬 칩셋(sky_island)이다. ⓪ 땅은 compose_sky_island_map 으로 깐다(손댄 맵은 replace:true, 다른 배치는 seed 를 바꾼다). 결과 data.buildings[].doors 는 실내 이음에, data.zones 는 이벤트 자리 고르기에 쓴다. "
  + "① 하늘·섬 밑면 바위 칸은 막힘이다(섬 테두리 풀 칸은 걷지만 물건은 두지 않는다) — 물건·이벤트는 섬 안쪽 풀·길·광장에만 둔다. 다리·잔교 칸은 걷는다. "
  + "② 소품을 더할 때는 list_tileset_objects({tilesetId:\"sky_island\"}) → stamp_tileset_object 로 키트째 찍고, 문 앞 접근칸·길·다리·잔교를 막지 않는다. "
  + "③ 끝나면 check_reachability 로 시작 칸에서 문·다리 끝까지 닿는지 확인한다. 참고문서 list_tileset_references({tilesetId:\"sky_island\"}) 에 조각 사전·예제 배열·오류 그림이 있다.";

export function skyIslandPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!hasSkyIslandTileset(project)) return [];
  return scopeUsesSkyIsland(project, mapIds) ? [SKY_ISLAND_POINTER_LINE, SKY_ISLAND_DETAIL_LINE] : [SKY_ISLAND_POINTER_LINE];
}

const STYLE_KO: Readonly<Record<SkyIslandStyleHint, string>> = {
  village: "하늘섬 마을", shrine: "구름 위 신전 섬", dock: "비공정 부두", archipelago: "섬 사슬",
  "room-cottage": "오두막 실내", "room-shrine": "신전 실내", "room-cabin": "비공정 선실", "room-observatory": "천문대 실내",
};

/** 의도 노트(모델 지시문 뒤에 붙는다). */
export function formatSkyIslandNote(target: SkyIslandTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 하늘섬 칩셋이고 비어 있다 → 이 맵에 compose_sky_island_map({mapId:"${target.mapId}", style:"${target.style}", seed}) 를 부른다(작으면 도구가 늘린다).`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 하늘섬 칩셋이고 이미 내용이 있다 → 다시 짜려면 compose_sky_island_map({replace:true}) 를, 더하기만 하려면 list_tileset_objects → stamp_tileset_object 로 빈 풀에 더한다(기존 칸을 지우지 않는다).`
      : `하늘섬 맵이 아직 없다 → create_map({name, width:50, height:34, tilesetId:"sky_island"}) 로 새 맵을 만들고 compose_sky_island_map({style:"${target.style}", seed}) 를 부른다. 먼저 묻지 않는다 — create_map 이 «계열이 다르다»로 거부됐을 때만 칠하지 말고 ask_tileset_change(toTilesetId:"sky_island", reason) 로 견본을 보이고 이 턴을 끝낸다(빈 시작 맵에서는 거부되지 않는다).`;
  return [
    `[하늘섬 시공 — 하늘섬 칩셋] 이 요청의 칩셋은 번들 하늘섬 칩셋(sky_island)이다. 문장에서 읽은 구성은 ${STYLE_KO[target.style]}(style "${target.style}")이다 — 요청이 다른 것을 말하면 그쪽을 고른다. author_beodeul_town·다른 칩셋 도구는 쓰지 않는다.`,
    where,
    "키트 id 는 list_tileset_objects 결과에 있는 것만 쓴다(없는 id 를 지어 부르지 않는다). 구성 결과는 이미 채워져 있다 — 더할 때는 빈 풀 덩이에 한두 개, 건물 둘레 1칸·길 옆 칸은 비운다.",
    "순서: compose_sky_island_map 한 번 → 결과를 읽고(건물·다리·쓰임 구역) → 필요하면 건물 실내를 새 맵에 compose_sky_island_map(style:\"room-…\") 로 짓고 link_sky_island_interior 로 문과 잇는다 → 사람·이벤트는 섬 안쪽 길·광장에 → check_reachability. 낱칸 번호로 섬·하늘을 칠하지 않는다.",
  ].join("\n");
}

/** 컨셉 카드의 무대 낱말 → 타일셋 id(harness-data/game-concepts/seed.json tilesetHints 와 같은 줄). */
export const SKY_ISLAND_CONCEPT_HINT: Readonly<Record<string, string>> = { "하늘섬·비공정": SKY_ISLAND_TILESET_ID };
