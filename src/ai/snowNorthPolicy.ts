// 북방 설원(snow_north) 조수 연결 — 북방·설원 마을·얼어붙은 호수·얼음 동굴 입구 요청이 «칩셋이 프로젝트에 있을 때만» 이 칩셋으로 가게 한다.
// prehistoricPolicy·gothicPolicy 와 같은 모양(대상 판정 + 포인터 줄 + 상세 줄 + 노트)이다.
//
// 버들항 눈 기후(author_beodeul_town theme:"snow")와의 경계 — 결정(2026-10-14):
//  - 북방 낱말(북방·북쪽 마을·바이킹·노르딕·시베리아·툰드라·오로라·통나무 오두막 마을 …)은 언제나 snow_north.
//  - 일반 눈 낱말(설원·눈 마을·눈 덮인·겨울 마을·얼어붙은 호수·얼음 낚시·얼음 동굴 입구)은 snow_north 로 가되,
//    ① 문장이 버들항(beodeul)을 말하거나 ② 지금 보는 맵이 버들항 칩셋이고 «마을»을 말하면 가로채지 않는다 — 그 요청은 버들항 마을 문법의 눈 기후(theme:"snow") 몫이다.
//    (버들항 맵 위라도 «얼어붙은 호수 낚시터»·«얼음 동굴 입구»처럼 마을이 아닌 설원 풍경은 새 snow_north 맵으로 짓는다 — 버들항 마을 도구가 짓지 못하는 장소다.)
//    즉 «눈 오는 버들항»·버들항 프로젝트 안의 «눈 마을» 은 그대로 버들항이 짓는다(칩셋 계열을 섞지 않는다).
//  - 「얼음 동굴」 은 던전·미궁·광산 낱말이 같이 있으면 잡지 않는다(그 요청은 던전 칩셋 몫). 「동굴 입구」·「얼음 동굴 앞」 처럼 바깥 풍경이면 cave style.
//  - 배치는 모델이 하지 않는다: compose_snow_north_map 한 번이 마을·호수·동굴 입구·장터 또는 실내 한 장을 짠다(snowNorthComposer.ts).
// 주의: 이 파일의 노트·문장은 모델 지시문에 실린다 — requestsModernMap 의 PAW 전용 게이트를 켜는 낱말(현대·모던·modern 한글/영문)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const SNOW_NORTH_TILESET_ID = "snow_north";
const SNOW_NORTH_TEXTURE = "tex_snow_north";

export function isSnowNorthTilesetDef(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === SNOW_NORTH_TEXTURE;
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. */
const NAMES_SNOW_NORTH_RE = /\bsnow_north\b|oprn-snow|북방\s*설원\s*(?:칩셋|타일셋)?/iu;
/** 북방 낱말(이것만으로 잡는다 — 버들항 맵 위에서도). */
const NORTH_RE = /북방|북쪽\s*(?:끝\s*)?(?:마을|땅|나라|부족|요새)|북녘|북국|극지|바이킹|노르딕|노르드|스칸디나비아|시베리아|툰드라|오로라|통널\s*교회|벌꿀술\s*회관|\b(?:nordic|norse|viking|siberia\w*|tundra|aurora|arctic|boreal|frozen\s+north|far\s+north)\b/iu;
/** 일반 눈 낱말(버들항 문맥이 아닐 때만 잡는다). */
const SNOW_RE = /설원|눈\s*(?:덮인|쌓인|내린|오는)?\s*(?:마을|촌|부락|들판|땅|숲|호수|요새)|눈마을|겨울\s*(?:마을|장터|시장|호수)|얼어붙은\s*(?:호수|강|폭포|마을)|언\s*호수|빙판\s*호수|얼음\s*(?:낚시|구멍|호수|동굴\s*(?:입구|앞)|집|성채)|\b(?:snow(?:y|bound|field)?\s+(?:village|town|lake)|frozen\s+lake|ice\s*fishing|winter\s+village)\b/iu;
const ICE_CAVE_RE = /얼음\s*동굴|빙굴|ice\s*cave/iu;
const DUNGEON_RE = /던전|미궁|광산|지하\s*감옥|dungeon|labyrinth|mine\b/iu;
const BEODEUL_RE = /버들항|버들\s*항|beodeul/iu;
const SETTLEMENT_RE = /마을|촌|읍|부락|고을|town|village/iu;

export function namesSnowNorthTileset(text: string | undefined): boolean {
  return !!text && NAMES_SNOW_NORTH_RE.test(text);
}
/** 북방 설원 풍경을 말한 문장인가. onBeodeul = 지금 맵이 버들항 칩셋이다. */
export function describesSnowNorth(text: string | undefined, onBeodeul = false): boolean {
  if (!text) return false;
  // «얼어붙은 호수를 건너는 빙굴 던전» 같은 던전 요청은 author_dungeon(type ice) 몫 — 설원 한 장 맵으로 가로채지 않는다(dt r2 ice-b).
  if (DUNGEON_RE.test(text)) return false;
  if (NORTH_RE.test(text)) return true;
  if (BEODEUL_RE.test(text)) return false;
  // 버들항 맵 위의 «눈 마을»은 버들항 마을 문법(theme:"snow") 몫 — 호수 낚시터·동굴 입구·장터처럼 마을이 아닌 설원 풍경은 여기서 짓는다.
  if (onBeodeul && SETTLEMENT_RE.test(text)) return false;
  if (SNOW_RE.test(text)) return true;
  return ICE_CAVE_RE.test(text);
}
export function hasSnowNorthTileset(project: Pick<Project, "tilesets">): boolean {
  const def = project.tilesets[SNOW_NORTH_TILESET_ID];
  return !!def && isSnowNorthTilesetDef(def);
}

export type SnowNorthRoom = "cabin" | "longhall" | "tavern" | "sauna" | "ice-cave";
export type SnowNorthOutdoor = "village" | "lake" | "cave" | "market";
export interface SnowNorthTarget {
  readonly mapId?: string;
  readonly lived?: boolean;
  readonly room?: SnowNorthRoom;
  readonly outdoor?: SnowNorthOutdoor;
}

const INDOOR_RE = /실내|안\s*(?:쪽|모습)|내부|방\s*안|interior|indoor|inside/iu;
const OUTDOOR_RE = /마을|호수|낚시터|입구|앞|장터|시장|들판|숲|강가|부락|야영지|village|lake|market|entrance/iu;

/** 문장 → 야외 구성(마을 · 얼어붙은 호수 · 얼음 동굴 입구 · 겨울 장터). */
export function snowNorthOutdoorStyleFor(text: string): SnowNorthOutdoor {
  if (/동굴|빙굴|폭포|cave|waterfall/iu.test(text)) return "cave";
  if (/장터|시장|노점|교역|market|bazaar|fair/iu.test(text)) return "market";
  if (/호수|낚시|빙판|얼음\s*구멍|lake|fishing/iu.test(text) && !/마을|village/iu.test(text)) return "lake";
  return "village";
}
/** 문장 → 실내 종류. */
export function snowNorthRoomFor(text: string): SnowNorthRoom | null {
  if (/사우나|한증|sauna/iu.test(text)) return "sauna";
  if (/선술집|주점|여관|술집|tavern|inn/iu.test(text)) return "tavern";
  if (/회관|긴\s*집|롱하우스|족장|대전당|longhall|longhouse|mead\s*hall/iu.test(text)) return "longhall";
  if (/얼음\s*동굴\s*(?:안|속|내부)|빙굴\s*(?:안|속)|ice\s*cave\s*(?:interior|inside)/iu.test(text)) return "ice-cave";
  if (/오두막|통나무\s*집|cabin|hut/iu.test(text)) return "cabin";
  return null;
}

/**
 * 이 요청이 북방 설원 칩셋 작업인가.
 *  - 대상 맵이 이미 snow_north 이면 그 맵(생성·수정만).
 *  - 아니면 «생성» 요청이 칩셋 이름·북방·설원 낱말을 말했을 때 새 맵 — **프로젝트에 칩셋이 있을 때만**, 버들항 문맥이면 북방 낱말만.
 */
export function snowNorthTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): SnowNorthTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  if (!hasSnowNorthTileset(project)) return null;
  const text = requestText ?? "";
  const map = mapId ? project.maps[mapId] : undefined;
  const room = snowNorthRoomFor(text);
  const indoorAsk = intent.space === "interior" || (!!room && (INDOOR_RE.test(text) || !OUTDOOR_RE.test(text)));
  if (map && isSnowNorthTilesetDef(project.tilesets[map.tilesetId])) {
    return indoorAsk && room ? { mapId: map.id, lived, room } : { mapId: map.id, lived, outdoor: snowNorthOutdoorStyleFor(text) };
  }
  if (intent.mode !== "create") return null;
  const onBeodeul = !!map && /^beodeul_/u.test(map.tilesetId);
  if (!NAMES_SNOW_NORTH_RE.test(text) && !describesSnowNorth(text, onBeodeul)) return null;
  if (indoorAsk) return { room: room ?? "cabin" };
  return { outdoor: snowNorthOutdoorStyleFor(text) };
}

export function scopeUsesSnowNorth(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isSnowNorthTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** 첫 요청부터 스키마가 보여야 하는 도구. */
export const SNOW_NORTH_EXPOSED_TOOLS: readonly string[] = [
  "list_tileset_references", "read_tileset_reference", "compose_snow_north_map", "link_snow_north_interior",
  "create_map", "resize_map", "list_tileset_objects", "stamp_tileset_object", "check_reachability", "show_map_region", "ask_tileset_change",
];

export const SNOW_NORTH_POINTER_LINE =
  "북방 설원·눈 덮인 북쪽 마을·바이킹풍 겨울 마을·얼어붙은 호수 낚시터·얼음 동굴 입구·겨울 장터는 번들 칩셋 snow_north 로 짓는다(«눈 오는 버들항»·버들항 맵 위의 눈 마을은 author_beodeul_town theme:\"snow\" 몫이다): "
  + "야외·실내 모두 compose_snow_north_map 한 번으로 한 장을 짠다 — style:\"village\"(목책 고리 + 문루 + 다진 눈 광장 + 회관·통널 교회·오두막·대장간·사우나·훈제막 + 굴뚝 연기 + 얼음 못, 44×34 이상) | "
  + "\"lake\"(얼어붙은 호수 + 얼음 낚시 구멍·낚시 오두막 + 호숫가 건조대·뒤집힌 배 + 숲, 40×30 이상) | \"cave\"(바위 능선 + 얼음 동굴 입구 + 얼어붙은 폭포·여울 + 야영지, 36×28 이상) | "
  + "\"market\"(장터 마당 + 노점·상자·통 + 회관·오두막 + 화로, 40×30 이상) | 실내 \"cabin\"|\"longhall\"|\"tavern\"|\"sauna\"|\"ice-cave\". "
  + "첫 도구 호출로 바로 부른다(참고문서는 결과를 손볼 때만 읽는다). 새 맵이 필요하면 newMap:{name} 만 주면(크기는 주지 않는다 — 기본 크기가 가장 알차다) 도구가 칩셋·크기를 맞춰 만든다. 덩이 가장자리(오토타일)·집·소품 자리·문 앞 비움·통행은 구성기가 정한다 — 낱칸 번호로 다시 칠하거나 소품을 흩뿌리지 않는다. "
  + "씨앗(seed)을 바꾸면 다른 배치가 나온다. 집 문 ↔ 실내는 link_snow_north_interior 로 잇는다. 사람은 Actor1 캐릭터 이벤트로 놓는다. 눈사람은 칩셋에 없다.";

export const SNOW_NORTH_DETAIL_LINE =
  "이 작업의 맵은 북방 설원 칩셋(snow_north)이다. ① 다시 짜려면 compose_snow_north_map({style, seed, replace:true}) — 이벤트는 남는다. ② 결과 data.buildings[].doors 가 집 문 칸(막힘)이고 바로 아래 줄이 접근칸이다(이동 이벤트는 접근칸에). "
  + "③ 다진 눈길·얼음·툰드라·서리 풀·진창·열린 물은 오토타일 덩이라 낱칸으로 가장자리를 칠하지 않는다. 소품을 더할 때는 list_tileset_objects({tilesetId:\"snow_north\"}) → stamp_tileset_object 로 키트째 찍고, 자기 바닥에만 둔다(낚시 자리는 얼음, 노점은 장터, 장작·썰매는 집 마당, 오로라 깃발은 벽). 문 접근칸·길을 막지 않는다. "
  + "④ check_reachability 로 시작 칸 → 모든 문까지 이어지는지 확인한다.";

export function snowNorthPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!hasSnowNorthTileset(project)) return [];
  return scopeUsesSnowNorth(project, mapIds) ? [SNOW_NORTH_POINTER_LINE, SNOW_NORTH_DETAIL_LINE] : [SNOW_NORTH_POINTER_LINE];
}

const ROOM_KO: Readonly<Record<SnowNorthRoom, string>> = { cabin: "통나무 오두막 안", longhall: "씨족 회관 안", tavern: "선술집 안", sauna: "사우나 안", "ice-cave": "얼음 동굴 안" };
const OUT_KO: Readonly<Record<SnowNorthOutdoor, string>> = { village: "눈 덮인 북방 마을", lake: "얼어붙은 호수 낚시터", cave: "얼음 동굴 입구", market: "겨울 장터" };

export function formatSnowNorthNote(target: SnowNorthTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const head = "[북방 설원 — snow_north 칩셋] 이 요청의 칩셋은 번들 북방 설원 칩셋(snow_north)이다. author_beodeul_town(버들항 눈 기후)·던전 칩셋·손 도트 판타지 실내(build_hand_interior_room)는 쓰지 않는다(칩셋 계열이 다르다).";
  if (target.room) {
    const where = target.mapId && !target.lived
      ? `지금 맵 '${target.mapId}' 은 북방 설원 칩셋이고 비어 있다 → compose_snow_north_map({mapId:"${target.mapId}", style:"${target.room}"}) (맵이 작으면 resize_map 먼저).`
      : `새 실내 맵: 첫 도구 호출로 compose_snow_north_map({style:"${target.room}", newMap:{name:"${ROOM_KO[target.room]}"}}) — 도구가 칩셋·크기를 맞춰 맵을 만들고 방을 짓는다(참고문서를 먼저 읽지 않는다).`;
    return [head, `요청은 실내(${ROOM_KO[target.room]})다. ${where}`,
      "방은 천장 테두리·북쪽 벽면 두 줄·바닥·남쪽 출입구(2칸)로 지어지고, 벽걸이(선반·사슴뿔·약초·등·무기 걸이·오로라 깃발)는 벽면에, 가구는 방 종류 규칙(벽난로·침대·술통 받침은 북쪽 벽 앞, 회관 화덕은 가운데, 출입구 앞 비움)대로 놓인다. "
      + "야외 집과 잇는다면 그 다음 link_snow_north_interior."].join("\n");
  }
  const style = target.outdoor ?? "village";
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"}) 은 북방 설원 칩셋이고 비어 있다 → 이 맵에 짓는다(작으면 resize_map 먼저).`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 북방 설원 칩셋이고 이미 내용이 있다 → 다시 짜려면 replace:true(이벤트는 남는다), 더하기만 하려면 stamp_tileset_object.`
      : `북방 설원 맵이 아직 없다 → compose_snow_north_map({style:"${style}", newMap:{name:"${OUT_KO[style]}"}}) 가 칩셋·크기를 맞춰 새 맵을 만들고 짓는다. 지금 보는 맵이 다른 계열이어도 새 맵이라 괜찮다.`;
  return [head, `요청은 야외(${OUT_KO[style]})다 → style:"${style}". ${where}`,
    "순서: **첫 도구 호출이 compose_snow_north_map 이다** — 참고문서·플레이 프리셋을 먼저 읽지 않는다(구성기가 규칙을 이미 지킨다. 실측: 참고문서를 네 번 나눠 읽느라 턴이 끝나기 전에 공급자 과부하로 끊겼다). "
    + "newMap 에 width·height 를 주지 않는다(기본 크기가 가장 알차다 — 64×40 처럼 키우면 빈 눈밭만 넓어졌다). compose_snow_north_map 한 번 → 결과 data.buildings 의 집 문마다 실내가 필요하면 같은 도구 style:\"cabin\"|\"longhall\"|\"tavern\"|\"sauna\"|\"ice-cave\" 의 newMap 으로 실내를 짓고 link_snow_north_interior 로 잇는다 → check_reachability. "
    + "야외 맵은 set_map_properties climate:{mode:\"fixed\",weather:\"snow\",intensity:0.5} 로 눈 기후를 맞춰도 좋다."].join("\n");
}

/** 컨셉 카드의 무대 낱말 → 타일셋 id. 같은 줄이 harness-data/game-concepts/seed.json tilesetHints 와 src/concepts/format.ts BUILDABLE_CONCEPT_TILESETS 에 있다. */
export const SNOW_NORTH_CONCEPT_HINT: Readonly<Record<string, string>> = { "북방 설원·눈 덮인 북쪽 마을": SNOW_NORTH_TILESET_ID };
