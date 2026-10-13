// 고딕 저택(gothic_manor) 조수 연결 — 호러·추리·미술관·폐성 요청이 이 번들 칩셋과 장소 빌더(build_gothic_place)로 가게 한다. jpCityPolicy 와 같은 모양이다
// (대상 판정 + 포인터·상세 줄 + 의도 노트). 칩셋이 프로젝트에 «있을 때만» 라우팅한다 — 없으면 기존 경로(판타지 성·버들항)가 그대로 간다.
// 칩셋 정의는 project/defaults/gothicManor.ts — 여기서는 id 문자열만 쓴다. 주의: 노트·문장은 모델 지시문에 실린다 — PAW 게이트 낱말(현대·모던·modern)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const GOTHIC_MANOR_TILESET_ID = "gothic_manor";
const GOTHIC_MANOR_TEXTURE = "tex_gothic_manor";

export function isGothicManorTilesetDef(tileset: Pick<TilesetDef, "image" | "id"> | undefined): boolean {
  return !!tileset && (tileset.id === GOTHIC_MANOR_TILESET_ID || (tileset.image.type === "bundled" && tileset.image.id === GOTHIC_MANOR_TEXTURE));
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. */
const NAMES_GOTHIC_RE = /gothic[_-]?manor|고딕\s*(?:저택\s*)?(?:칩셋|타일셋)/iu;
/** 이 칩셋이 그 일을 하는 낱말(저택·묘지·예배당·납골당·폐성·고딕·호러·미술관·고아원·정신병원·흉가). */
const GOTHIC_WORD_RE = /저택|대저택|묘지|공동묘지|예배당|납골당|폐성|고딕|호러|공포\s*게임|흉가|귀신\s*(?:의\s*)?집|미술관|갤러리|박물관|고아원|정신\s*병원|폐병원|유령\s*(?:의\s*)?(?:집|저택)|haunted|gothic|horror|mansion|asylum|orphanage|cemetery|graveyard/iu;
/** 진짜 판타지 성 요청 — 고딕 낱말이 없으면 이 칩셋으로 끌지 않는다. */
const FANTASY_CASTLE_RE = /(?:판타지|중세|왕국|왕궁|왕성|마왕성|용사|성채|요새|기사단)/u;
/** 판타지 성 요청이어도 이 낱말이 있으면 고딕이다(폐성은 고딕, 마왕성은 아니다). */
const STRONG_GOTHIC_RE = /고딕|호러|공포|흉가|폐성|저택|묘지|haunted|gothic|horror|mansion/iu;

export function namesGothicManorTileset(text: string | undefined): boolean {
  return !!text && NAMES_GOTHIC_RE.test(text);
}

/** 고딕 저택 풍경·장소를 말한 문장인가(칩셋 이름은 안 불렀어도). 판타지 성 요청은 강한 고딕 낱말이 없으면 아니다. */
export function describesGothicPlace(text: string | undefined): boolean {
  if (!text || !GOTHIC_WORD_RE.test(text)) return false;
  return !(FANTASY_CASTLE_RE.test(text) && !STRONG_GOTHIC_RE.test(text));
}

export interface GothicTarget {
  /** 대상 맵이 이미 gothic_manor 면 그 맵 — 아니면 새 맵(또는 칩셋 안내). */
  readonly mapId?: string;
  readonly lived?: boolean;
}

/**
 * 이 요청이 고딕 저택 칩셋 작업인가. 대상 맵이 이미 gothic_manor 면 그 맵(생성·수정), 아니면 프로젝트에 칩셋이 «있고» 요청이 칩셋을 부르거나 고딕 장소를 말한 새 맵 생성.
 * 질문·NPC·단순 수정 요청은 낱말 하나로 끌려오지 않게 의도 선언을 같이 본다. 호출자는 jp_city 대상이 잡힌 요청에서는 부르지 않는다.
 */
export function gothicTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): GothicTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && isGothicManorTilesetDef(project.tilesets[map.tilesetId])) return { mapId: map.id, lived };
  if (intent.mode !== "create") return null;
  if (!Object.values(project.tilesets).some(isGothicManorTilesetDef)) return null;
  const text = requestText ?? "";
  if (NAMES_GOTHIC_RE.test(text) || describesGothicPlace(text)) return {};
  return null;
}

/** 범위 맵 중 하나라도 gothic_manor 인가(시스템 프롬프트 상세 줄 조건). */
export function scopeUsesGothic(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isGothicManorTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** gothic_manor 작업 첫 요청부터 스키마가 보여야 하는 도구 — 장소 빌더 → 참고문서 → 이벤트 → 접근칸 검사. */
export const GOTHIC_EXPOSED_TOOLS: readonly string[] = [
  "list_gothic_places", "build_gothic_place", "list_tileset_references", "read_tileset_reference", "stamp_object",
  "check_reachability", "show_map_region", "ask_tileset_change",
];

/** 시스템 프롬프트 한 줄(항상) — 칩셋이 있다는 사실과 길을 알린다. 칩셋이 프로젝트에 없으면 붙이지 않는다(gothicPromptLines). */
export const GOTHIC_POINTER_LINE =
  "호러·흉가·저택·공동묘지·예배당·납골당·미술관 분위기의 어두운 고딕 장소는 번들 칩셋 gothic_manor 로 짓는다(진짜 판타지 성·왕궁·마왕성 요청은 이 칩셋이 아니다): "
  + "장소 한 장은 build_gothic_place 한 번 — 야외 place:\"manor-grounds\"(흉가 저택과 정원)·\"graveyard\"(공동묘지와 예배당)·\"gallery-plaza\"(미술관 앞마당), "
  + "실내 place:\"hall\"·\"library\"·\"bedroom\"·\"kitchen\"·\"cellar\"·\"chapel\"·\"crypt\"·\"gallery\"(전시실). 목록은 list_gothic_places. 이 칩셋 맵을 낱칸 칠하기로 처음부터 그리지 않는다.";

/** gothic_manor 맵이 범위에 있을 때만 붙는 상세 순서. */
export const GOTHIC_DETAIL_LINE =
  "이 작업의 맵은 고딕 저택 칩셋(gothic_manor)이다. ① 새 장소는 build_gothic_place({place, name, seed}) 로 짓는다 — 둘레 철책·정문·건물·길·소품이 한 번에 들어가고 모든 문까지 길이 이어진다. "
  + "② 결과의 entrances(건물 문 칸)·exits(정문)·doorCells(실내 문)에 이동 이벤트(transfer)를 달아 맵을 잇는다. 문 아래 접근 칸에는 NPC·물건을 세우지 않는다. "
  + "③ 저택 한 채는 바깥(manor-grounds) + 안(hall·library·bedroom…)을 따로 지어 문으로 잇는다. 은신처(옷장·침대)는 기물 앞 칸에 상호작용 이벤트를 건다. "
  + "④ 소품을 더할 때만 list_tileset_references({tilesetId:\"gothic_manor\"}) 의 gm-kits-… 사전 id 로 stamp_object 하고, 끝나면 check_reachability 로 정문에서 모든 문에 닿는지 본다.";

/** 시스템 프롬프트에 붙일 줄들. 칩셋이 프로젝트에 없으면 아무것도 붙이지 않는다. */
export function gothicPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!Object.values(project.tilesets).some(isGothicManorTilesetDef)) return [];
  return scopeUsesGothic(project, mapIds) ? [GOTHIC_POINTER_LINE, GOTHIC_DETAIL_LINE] : [GOTHIC_POINTER_LINE];
}

/** 의도 노트(모델 지시문 뒤에 붙는다). */
export function formatGothicNote(target: GothicTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 gothic_manor 이고 비어 있다 → 이 맵에 짓는다.`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 gothic_manor 이고 이미 내용이 있다 → get_map_region 으로 빈 곳을 찾아 더한다(기존 칸을 지우지 않는다).`
      : "gothic_manor 맵이 아직 없다 → build_gothic_place({place, name}) 가 새 맵을 만들어 짓는다(mapId 생략). 지금 보는 맵이 다른 계열이어도 새 맵이라 괜찮다.";
  return [
    "[고딕 저택 시공 — gothic_manor] 이 요청의 칩셋은 번들 고딕 저택(gothic_manor)이다. 판타지 성 칩셋·버들항 도구는 쓰지 않는다.",
    where,
    "순서: build_gothic_place({place, name, seed}) 로 장소 한 장(야외 manor-grounds·graveyard·gallery-plaza, 실내 hall·library·bedroom·kitchen·cellar·chapel·crypt·gallery) → 결과 entrances·exits·doorCells 에 transfer → check_reachability. 낱칸으로 처음부터 칠하지 않는다.",
  ].join("\n");
}
