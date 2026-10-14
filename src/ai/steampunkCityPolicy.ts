// 스팀펑크 도시(steampunk_city) 조수 연결 — 스팀펑크·증기·공장 도시·보일러실 요청이 «칩셋이 프로젝트에 있을 때만» 이 칩셋으로 가게 한다.
// campusPolicy.ts·jpCityPolicy.ts 와 같은 모양(대상 판정 + 포인터 줄 + 상세 줄 + 노트)이다. 차이:
//  - 「증기기관 도시 거리」는 jp_city 의 도시 거리 낱말(도시 거리)에도 걸린다 — 그래서 plainTurn 은 이 판정을 jp_city 보다 **먼저** 부르고, 잡히면 jp_city 를 부르지 않는다.
//  - 배치는 모델이 하지 않는다: compose_steampunk_city_map 한 번이 거리·공장·역·운하 또는 실내 한 장을 짠다(steampunkCityComposer.ts). 사용자는 옛 시안의 배치를 싫어했다.
//  - 하늘섬(sky_island)은 다른 칩셋이다 — 「하늘섬·떠 있는 섬」은 여기서 잡지 않는다.
// 주의: 이 파일의 노트·문장은 모델 지시문에 실린다 — requestsModernMap 의 PAW 전용 게이트를 켜는 낱말(현대·모던·modern 한글/영문)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const STEAMPUNK_TILESET_ID = "steampunk_city";
const STEAMPUNK_TEXTURE = "tex_steampunk_city";

export function isSteampunkTilesetDef(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === STEAMPUNK_TEXTURE;
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. */
const NAMES_STEAMPUNK_RE = /steampunk[_-]?city|oprn-steampunk|스팀\s*펑크\s*(?:칩셋|타일셋)/iu;
/** 스팀펑크 풍경 낱말. 「공장」 하나만으로는 잡지 않는다(공장 지대·공장 도시·공장 마당처럼 장소를 말할 때만). */
const STEAMPUNK_RE = /스팀\s*펑크|steam\s*punk|증기\s*(?:기관|도시|공장|열차|기차|전차|거리|선|시대)?|공장\s*(?:지대|도시|거리|마당|단지|구역)|산업\s*(?:도시|혁명)|공업\s*도시|보일러\s*실|기관\s*실|빅토리아\s*(?:풍|시대)|비행선\s*(?:정박|계류|선착)|\b(?:steam\s*(?:city|engine|train)|boiler\s*room|engine\s*room|industrial\s+(?:city|district|town)|victorian\s+(?:city|street))\b/iu;
/** 하늘섬 — 다른 칩셋(sky_island)이 맡는다. */
const SKY_ISLAND_RE = /하늘\s*섬|공중\s*섬|떠\s*있는\s*섬|부유\s*섬|sky\s*island|floating\s+island/iu;

export function namesSteampunkTileset(text: string | undefined): boolean {
  return !!text && NAMES_STEAMPUNK_RE.test(text);
}
/** 스팀펑크 도시 풍경을 말한 문장인가(하늘섬 제외). */
export function describesSteampunk(text: string | undefined): boolean {
  return !!text && STEAMPUNK_RE.test(text) && !SKY_ISLAND_RE.test(text);
}
export function hasSteampunkTileset(project: Pick<Project, "tilesets">): boolean {
  const def = project.tilesets[STEAMPUNK_TILESET_ID];
  return !!def && isSteampunkTilesetDef(def);
}

export type SteampunkRoom = "boiler-room" | "engine-room" | "workshop" | "lab" | "inn" | "tavern";
export interface SteampunkTarget {
  readonly mapId?: string;
  readonly lived?: boolean;
  /** 실내 요청이면 방 종류(구성기 style). */
  readonly room?: SteampunkRoom;
  /** 야외 요청이면 고른 구성(거리·공장역·운하). */
  readonly outdoor?: "street" | "industrial" | "dock";
}

const ROOM_WORDS: readonly [RegExp, SteampunkRoom][] = [
  [/보일러\s*실|boiler\s*room|화부실/iu, "boiler-room"],
  [/기관\s*실|엔진\s*룸|engine\s*room|발전실/iu, "engine-room"],
  [/연구실|실험실|연구소\s*(?:안|내부|실내)|\blab(?:oratory)?\b/iu, "lab"],
  [/공방|작업장|대장간|workshop/iu, "workshop"],
  [/선술집|술집|주점|펍|\b(?:tavern|pub)\b/iu, "tavern"],
  [/여관|숙소|\binn\b/iu, "inn"],
];
const INDOOR_RE = /실내|안\s*(?:쪽|모습)|내부|방\s*안|interior|indoor/iu;
const OUTDOOR_RE = /거리|도시|마을|광장|공장\s*(?:지대|마당|단지)|철도|선로|역|운하|부두|항구|선착장|비행선|street|city|district|station|canal|dock/iu;

/** 문장 → 야외 구성(거리 street · 공장과 역 industrial · 운하 부두 dock). */
export function steampunkOutdoorStyleFor(text: string): "street" | "industrial" | "dock" {
  if (/운하|부두|항구|선착장|비행선|잔교|\b(?:canal|dock|harbou?r|airship)\b/iu.test(text)) return "dock";
  if (/공장|철도|선로|역\b|기차역|역사|화물|측선|기중기|급수탑|\b(?:factory|station|rail|industrial)\b/iu.test(text)) return "industrial";
  return "street";
}
export function steampunkRoomFor(text: string): SteampunkRoom | null {
  for (const [re, room] of ROOM_WORDS) if (re.test(text)) return room;
  return null;
}

/**
 * 이 요청이 스팀펑크 칩셋 작업인가.
 *  - 대상 맵이 이미 steampunk_city 이면 그 맵(생성·수정만).
 *  - 아니면 «생성» 요청이 칩셋 이름을 부르거나 스팀펑크·증기·공장 도시·보일러실을 말했을 때 새 맵 — **프로젝트에 칩셋이 있을 때만**.
 */
export function steampunkTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): SteampunkTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  if (!hasSteampunkTileset(project)) return null;
  const text = requestText ?? "";
  const map = mapId ? project.maps[mapId] : undefined;
  const room = steampunkRoomFor(text);
  const indoorAsk = intent.space === "interior" || (!!room && (INDOOR_RE.test(text) || !OUTDOOR_RE.test(text)));
  if (map && isSteampunkTilesetDef(project.tilesets[map.tilesetId])) {
    return indoorAsk && room ? { mapId: map.id, lived, room } : { mapId: map.id, lived, outdoor: steampunkOutdoorStyleFor(text) };
  }
  if (intent.mode !== "create") return null;
  if (!NAMES_STEAMPUNK_RE.test(text) && !describesSteampunk(text)) return null;
  if (indoorAsk) return { room: room ?? "workshop" };
  return { outdoor: steampunkOutdoorStyleFor(text) };
}

export function scopeUsesSteampunk(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isSteampunkTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** 첫 요청부터 스키마가 보여야 하는 도구. */
export const STEAMPUNK_EXPOSED_TOOLS: readonly string[] = [
  "list_tileset_references", "read_tileset_reference", "compose_steampunk_city_map", "link_steampunk_interior",
  "create_map", "resize_map", "list_tileset_objects", "stamp_tileset_object", "check_reachability", "show_map_region", "ask_tileset_change",
];

export const STEAMPUNK_POINTER_LINE =
  "스팀펑크·증기기관·공장 도시·보일러실 풍경은 번들 칩셋 steampunk_city 로 짓는다(하늘섬은 다른 칩셋): "
  + "야외·실내 모두 compose_steampunk_city_map 한 번으로 한 장을 짠다 — style:\"street\"(연립·가게·여관 거리 + 노면 궤도 + 시장 광장 + 철 울타리 쌈지 공원, 44×34 이상) | "
  + "\"industrial\"(공장·보일러실·배관 도랑·석탄 마당 + 기차역·승강장·증기 열차 + 화물 측선·문형 기중기, 48×40 이상) | \"dock\"(부두 창고 + 운하·돌다리·잔교·바지선 + 비행선 정박장·생선 시장, 46×34 이상) | "
  + "실내 \"boiler-room\"|\"engine-room\"|\"workshop\"|\"lab\"|\"inn\"|\"tavern\". 새 맵이 필요하면 newMap:{name} 을 주면 도구가 칩셋·크기를 맞춰 만든다. "
  + "배치(건물 줄·길·소품 자리·문 앞 비움·통행)는 구성기가 정한다 — 낱칸 번호로 다시 칠하거나 소품을 흩뿌리지 않는다. 씨앗(seed)을 바꾸면 다른 배치가 나온다. "
  + "건물 문 ↔ 실내는 link_steampunk_interior 로 잇는다. 사람은 Actor1 캐릭터 이벤트로 놓는다.";

export const STEAMPUNK_DETAIL_LINE =
  "이 작업의 맵은 스팀펑크 칩셋(steampunk_city)이다. ① 다시 짜려면 compose_steampunk_city_map({style, seed, replace:true}) — 이벤트는 남는다. ② 결과 data.buildings[].doors 가 건물 문 칸(막힘)이고 바로 아래 줄이 접근칸이다(이동 이벤트는 접근칸에). "
  + "③ 소품을 더할 때는 list_tileset_objects({tilesetId:\"steampunk_city\"}) → stamp_tileset_object 로 키트째 찍고, 문 접근칸·길·승강장 끝·배관 덮개를 막지 않는다. 석탄·광차는 석탄재 마당, 노점은 광장 포석, 벤치는 공원·승강장, 계선주는 둑 줄에만. "
  + "④ 선로 탈것(기관차·탄수차·객차·화물칸)은 선로 두 줄(rail-n 위·rail-s 아래)에, 맨 아래 칸이 rail-s 에 오게 찍는다. ⑤ check_reachability 로 시작 칸 → 모든 문까지 이어지는지 확인한다.";

export function steampunkPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!hasSteampunkTileset(project)) return [];
  return scopeUsesSteampunk(project, mapIds) ? [STEAMPUNK_POINTER_LINE, STEAMPUNK_DETAIL_LINE] : [STEAMPUNK_POINTER_LINE];
}

const ROOM_KO: Readonly<Record<SteampunkRoom, string>> = { "boiler-room": "보일러실", "engine-room": "기관실", workshop: "기계 공방", lab: "연구실", inn: "여관 응접실", tavern: "선술집" };
const OUT_KO = { street: "증기 도시 거리", industrial: "공장 지대 + 기차역", dock: "운하 부두 + 비행선 정박장" } as const;

export function formatSteampunkNote(target: SteampunkTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const head = "[스팀펑크 도시 — steampunk_city 칩셋] 이 요청의 칩셋은 번들 스팀펑크 칩셋(steampunk_city)이다. author_beodeul_town(버들항)·jp_city·손 도트 판타지 실내(build_hand_interior_room)는 쓰지 않는다(시대·칩셋이 다르다).";
  if (target.room) {
    const where = target.mapId && !target.lived
      ? `지금 맵 '${target.mapId}' 은 스팀펑크 칩셋이고 비어 있다 → compose_steampunk_city_map({mapId:"${target.mapId}", style:"${target.room}"}) (맵이 작으면 resize_map 먼저).`
      : `새 실내 맵: compose_steampunk_city_map({style:"${target.room}", newMap:{name:"${ROOM_KO[target.room]}"}}) — 도구가 칩셋·크기를 맞춰 맵을 만들고 방을 짓는다.`;
    return [head, `요청은 실내(${ROOM_KO[target.room]})다. ${where}`,
      "방은 천장 테두리·북쪽 벽면 두 줄·바닥·남쪽 출입구 틈(2칸)으로 지어지고, 가구는 방 종류의 규칙(보일러는 북쪽 벽 앞·화실 문 앞 2칸 비움, 바는 벽에서 한 칸 띄움 …)대로 놓인다. 결과를 확인한 뒤 건물 문과 잇는다면 link_steampunk_interior."].join("\n");
  }
  const style = target.outdoor ?? "street";
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"}) 은 스팀펑크 칩셋이고 비어 있다 → 이 맵에 짓는다(작으면 resize_map 먼저).`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 스팀펑크 칩셋이고 이미 내용이 있다 → 다시 짜려면 replace:true(이벤트는 남는다), 더하기만 하려면 stamp_tileset_object.`
      : `스팀펑크 맵이 아직 없다 → compose_steampunk_city_map({style:"${style}", newMap:{name:"${OUT_KO[style]}"}}) 가 칩셋·크기를 맞춰 새 맵을 만들고 짓는다. 지금 보는 맵이 다른 계열이어도 새 맵이라 괜찮다.`;
  return [head, `요청은 야외(${OUT_KO[style]})다 → style:"${style}". ${where}`,
    "순서: (원하면 list_tileset_references → read_tileset_reference 로 배치 규칙·예제를 읽는다) → compose_steampunk_city_map 한 번 → 결과 data.buildings 의 문마다 실내가 필요하면 같은 도구 style:\"boiler-room\"|\"workshop\"|\"tavern\"… 의 newMap 으로 실내를 짓고 link_steampunk_interior 로 잇는다 → check_reachability."].join("\n");
}

/** 컨셉 카드의 무대 낱말 → 타일셋 id. 같은 줄이 harness-data/game-concepts/seed.json tilesetHints 와 src/concepts/format.ts BUILDABLE_CONCEPT_TILESETS 에 있다. */
export const STEAMPUNK_CONCEPT_HINT: Readonly<Record<string, string>> = { "스팀펑크·증기기관 공업 도시": STEAMPUNK_TILESET_ID };
