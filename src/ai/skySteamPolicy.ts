// 하늘섬·증기 도시(sky_steam) 조수 연결 — 스팀펑크·증기 도시·하늘섬·비공정 요청이 이 번들 칩셋과 구성기(compose_sky_steam)로 가게 한다.
// gothicPolicy·jpCityPolicy 와 같은 모양(대상 판정 + 포인터·상세 줄 + 의도 노트 + 첫 요청 노출 도구). 칩셋이 프로젝트에 «있을 때만» 라우팅한다.
// 순서: 스팀펑크 낱말은 jp_city 의 약한 「도시 거리」 낱말보다 앞선다(「증기기관 도시 거리」는 일본 거리가 아니다). jp_city 맵을 보고 있으면 jp_city 가 이긴다.
// 주의: 노트·문장은 모델 지시문에 실린다 — PAW 게이트 낱말(현대·모던·modern)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { SkySteamKind } from "@/project/skySteamComposer";
import type { Project, TilesetDef } from "@/project/types";

export const SKY_STEAM_TILESET_ID = "sky_steam";
const SKY_STEAM_TEXTURE = "tex_sky_steam";

export function isSkySteamTilesetDef(tileset: Pick<TilesetDef, "image" | "id"> | undefined): boolean {
  return !!tileset && (tileset.id === SKY_STEAM_TILESET_ID || (tileset.image.type === "bundled" && tileset.image.id === SKY_STEAM_TEXTURE));
}

const NAMES_SKY_STEAM_RE = /sky[_-]?steam|oprn-sky-steam|(?:스팀펑크|하늘섬)\s*(?:칩셋|타일셋)/iu;
/** 이 칩셋이 그 일을 하는 낱말(스팀펑크·증기 기관/도시/공장·하늘섬·공중/부유 섬·비공정/비행선·톱니 도시). */
const SKY_STEAM_WORD_RE = /스팀\s*펑크|증기\s*(?:기관|도시|기계|공장|펑크|열차|기차|선|동력|마을|거리)|하늘\s*(?:섬|도시|항구|마을)|공중\s*(?:섬|도시|정원|마을)|떠\s*있는\s*(?:섬|도시)|부유\s*(?:섬|도시|대륙)|비공정|비행선|비공선|비행정|톱니\s*(?:도시|탑|바퀴\s*도시)|태엽\s*(?:도시|장치)|steam\s*punk|airship|sky\s*(?:island|city|port)|floating\s*(?:island|city)|clockwork\s*city/iu;

export function namesSkySteamTileset(text: string | undefined): boolean {
  return !!text && NAMES_SKY_STEAM_RE.test(text);
}
export function describesSkySteamPlace(text: string | undefined): boolean {
  return !!text && SKY_STEAM_WORD_RE.test(text);
}

/** 문장에서 맵 종류를 고른다(첫 번째가 주 종류). */
export function skySteamKindsFromText(text: string | undefined): SkySteamKind[] {
  const t = text ?? "";
  const out: SkySteamKind[] = [];
  const add = (k: SkySteamKind, re: RegExp): void => { if (re.test(t) && !out.includes(k)) out.push(k); };
  add("dock", /부두|항구|선착장|계류|격납고|정박|dock|harbou?r|port|hangar/iu);
  add("yard", /공장|마당|제철|주물|용광로|조차장|화물\s*선로|factory|foundry|yard|rail\s*yard/iu);
  add("boiler", /보일러|기관실|엔진\s*룸|engine\s*room|boiler/iu);
  add("workshop", /공방|작업장|대장간|발명가|연구실|workshop|smithy|lab\b/iu);
  add("inn", /여관|주점|선술집|술집|숙소|inn\b|tavern|pub\b/iu);
  add("street", /거리|도시|시내|광장|번화|큰길|street|city|town/iu);
  add("island", /섬|마을|island|village/iu);
  return out.length ? out : ["street"];
}

export interface SkySteamTarget {
  /** 대상 맵이 이미 sky_steam 이면 그 맵. */
  readonly mapId?: string;
  readonly lived?: boolean;
  readonly kinds: readonly SkySteamKind[];
}

/**
 * 이 요청이 sky_steam 작업인가. 대상 맵이 sky_steam 이면 그 맵(생성·수정), 아니면 프로젝트에 칩셋이 «있고» 생성 요청이 칩셋·스팀펑크 장소를 말했을 때.
 * 호출자는 보는 맵이 jp_city 인 요청에서는 jp_city 를 먼저 쓴다.
 */
export function skySteamTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): SkySteamTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  const kinds = skySteamKindsFromText(requestText);
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && isSkySteamTilesetDef(project.tilesets[map.tilesetId])) return { mapId: map.id, lived, kinds };
  if (intent.mode !== "create") return null;
  if (!Object.values(project.tilesets).some(isSkySteamTilesetDef)) return null;
  const text = requestText ?? "";
  return NAMES_SKY_STEAM_RE.test(text) || SKY_STEAM_WORD_RE.test(text) ? { kinds } : null;
}

export function scopeUsesSkySteam(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isSkySteamTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** sky_steam 작업 첫 요청부터 스키마가 보여야 하는 도구 — 구성기 → 확인 → 실내 잇기 → 덧붙이기. */
export const SKY_STEAM_EXPOSED_TOOLS: readonly string[] = [
  "compose_sky_steam", "list_tileset_references", "read_tileset_reference", "show_map_region", "get_map_region", "list_map_locations",
  "check_reachability", "create_transfer_pair", "stamp_object", "fill_region", "ask_tileset_change",
];

export const SKY_STEAM_POINTER_LINE =
  "스팀펑크·증기 도시·공장·하늘섬·공중 도시·비공정 부두 장소는 번들 칩셋 sky_steam 으로 짓는다: compose_sky_steam({kind, seed}) 한 호출이 땅·차도·선로·관·갑판·건물·가스등·소품 무리를 규칙으로 짜고 구조 검사(문 앞·밑땅·층·이어짐)를 통과한 배치만 쓴다 "
  + "(kind: street 거리 · yard 공장 마당 · dock 비공정 부두 · island 하늘섬 마을 · workshop 공방 · boiler 보일러실 · inn 여관). 낱칸 번호로 칠하거나 새 그림을 지어내지 않는다. 지금 보는 맵이 다른 계열이고 이미 칠했으면 실행기가 거부한다 — 그때는 ask_tileset_change(toTilesetId:\"sky_steam\") 로 묻는다.";

export const SKY_STEAM_DETAIL_LINE =
  "이 작업의 맵은 하늘섬·증기 도시 칩셋(sky_steam)이다. ① 다른 장면을 원하면 seed 만 바꿔 compose_sky_steam(replace:true) 을 다시 부른다 — 손으로 땅을 덮어 칠하지 않는다. "
  + "② 덧붙일 때는 참고문서 sky-kits-b-out·sky-kits-b-in 의 키트를 stamp_object(kit:\"sky_steam/<id>\") 로 찍되, 건물 바로 아래 줄(문 앞 접근칸)·차도·선로 위에는 놓지 않고, 줄 A(sky-a-*) 건물은 섬 풀 위에만 둔다. "
  + "③ 실내는 compose_sky_steam({kind:\"inn\"|\"workshop\"|\"boiler\", newMap:true}) 로 따로 만들고, 바깥 맵 list_map_locations 의 문 앞 접근칸과 실내 맵의 남쪽 문 칸을 create_transfer_pair 로 잇는다. ④ 끝나면 show_map_region 으로 그림을 보고 check_reachability 로 문끼리 닿는지 본다.";

export function skySteamPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!Object.values(project.tilesets).some(isSkySteamTilesetDef)) return [];
  return scopeUsesSkySteam(project, mapIds) ? [SKY_STEAM_POINTER_LINE, SKY_STEAM_DETAIL_LINE] : [SKY_STEAM_POINTER_LINE];
}

const KIND_KO: Readonly<Record<SkySteamKind, string>> = { street: "증기 도시 거리", yard: "공장 마당", dock: "비공정 부두", island: "하늘섬 마을", workshop: "공방", boiler: "보일러실", inn: "여관" };

/** 의도 노트(모델 지시문 뒤에 붙는다). */
export function formatSkySteamNote(target: SkySteamTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const kind = target.kinds[0] ?? "street";
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 sky_steam 이고 비어 있다 → compose_sky_steam({kind:"${kind}", seed}) 로 이 맵에 짠다(작으면 도구가 알맞은 크기로 다시 잡는다).`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 sky_steam 이고 이미 내용이 있다 → 다시 짜 달라는 요청이면 compose_sky_steam({kind:"${kind}", seed:<새 값>, replace:true}), 더하라는 요청이면 빈 곳을 get_map_region 으로 찾아 stamp_object 로 키트를 더한다.`
      : `sky_steam 맵이 아직 없다 → compose_sky_steam({kind:"${kind}", seed}) 를 mapId 없이 부른다 — 지금 맵이 손대지 않은 빈 맵이면 그 맵을 sky_steam 으로 바꿔 쓰고, 아니면 새 맵을 만든다. 보는 맵이 다른 계열이고 칠한 맵이면 실행기가 거부한다 — 그때는 ask_tileset_change 로 묻고 턴을 끝낸다.`;
  const more = target.kinds.slice(1).filter((k) => k !== "street" && k !== "island").map((k) => KIND_KO[k]);
  return [
    `[하늘섬·증기 도시 시공 — sky_steam] 이 요청의 칩셋은 번들 sky_steam(스팀펑크 손 도트)이다. 주 맵 종류는 ${KIND_KO[kind]}(kind:"${kind}"). 버들항·고딕·일본 도시 도구는 쓰지 않는다.`,
    where,
    "순서: compose_sky_steam 한 번 → show_map_region 으로 결과 그림 확인 → (필요하면) 다른 seed 로 replace:true → 사용자에게 무엇을 지었는지 알린다. "
      + "차도·선로·갑판 통로·구름 바다·문 앞 줄은 일부러 비운 동선·배경이다 — 빈 바닥 비율 경고가 나와도 그 칸을 채우지 않는다. 더할 소품은 stamp_object(kit:\"sky_steam/<id>\")로 키트 통째로만, paint_tiles 로 키트 칸 번호를 칠하지 않는다."
      + (more.length ? ` 요청에 ${more.join("·")}도 있으면 compose_sky_steam(kind, newMap:true)로 그 맵을 따로 만들고 문 앞 접근칸끼리 create_transfer_pair 로 잇는다.` : ""),
  ].join("\n");
}
