// 전국·에도 일본(sengoku_edo) 조수 연결 — 전국시대·에도·사무라이·성하마을·일본 전통 마을 요청이 «칩셋이 프로젝트에 있을 때만» 이 칩셋으로 가게 한다.
// campusPolicy.ts·jpCityPolicy.ts 와 같은 모양(대상 판정 + 포인터 줄 + 상세 줄 + 노트).
//  - 시대 낱말이 분명할 때만 잡는다. 현대 일본 거리(편의점·지하철·이자카야·주택가)는 jp_city, 조선·한옥·바람의나라는 joseon_baram 이 맡는다 — 그런 낱말이 섞이면 잡지 않는다.
//  - 「에도」는 조사(「여기에도」)와 겹치므로 뒤에 시대·막부·거리 같은 낱말이 붙을 때만, 「무사」는 「무사히」와 겹치므로 저택·마을이 붙을 때만, 「신사」는 일본·경내·참배가 붙을 때만 본다.
//  - plainTurn 에서 jp_city 보다 먼저 본다(「일본 전통 마을」이 jp_city 거리로 새지 않게). 잡히면 jp_city·고딕·버들항 노트는 붙지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";
import { SENGOKU_DEFAULT_SIZE, SENGOKU_STYLE_KO, type SengokuStyle } from "@/project/sengokuEdoComposer";

export const SENGOKU_TILESET_ID = "sengoku_edo";
const SENGOKU_TEXTURE = "tex_sengoku_edo";

export function isSengokuTilesetDef(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === SENGOKU_TEXTURE;
}

const NAMES_SENGOKU_RE = /sengoku[_-]?edo|oprn-sengoku|전국\s*·?\s*에도\s*(?:칩셋|타일셋)/iu;
/** 시대 낱말(분명한 것만). */
const SENGOKU_RE = new RegExp([
  "전국\\s*시대", "센고쿠", "(?<![가-힣])에도\\s*(?:시대|막부|시절|풍|성|거리|마을|시가지|의)", "사무라이", "무사\\s*(?:저택|마을|거리|집|屋敷)", "무가\\s*(?:저택|거리|屋敷|마을)",
  "성하\\s*마을", "성하마치", "조카마치", "다이묘", "쇼군", "막부", "천수각", "닌자", "로닌", "낭인\\s*(?:무사|마을)",
  "일본\\s*(?:전통|옛|옛날|고전|중세|봉건|성|시골|농촌|신사|절|사찰|사원|정원|여관|다실|무사)", "료칸", "하타고", "역참\\s*마을", "숙장\\s*마을", "도카이도", "나카센도",
  "다실", "다도", "도리이", "일본\\s*신사", "신사\\s*(?:경내|참배|참배길)", "오층탑", "\\b(?:sengoku|samurai|shogun|daimyo|ninja|ronin|castle\\s*town|ryokan|feudal\\s+japan|edo\\s+(?:period|era|town|street))\\b",
].join("|"), "iu");
/** 다른 칩셋이 맡는 낱말 — 섞이면 잡지 않는다. */
const OTHER_RE = /조선|한옥|바람의\s*나라|고려|삼국|무림|무협|중국|객잔|편의점|지하철|전철|이자카야|라멘|주택가|현대|아파트|버스|자동차|마법\s*학교|호그|\b(?:joseon|jp[_-]city|modern)\b/iu;

export function namesSengokuTileset(text: string | undefined): boolean { return !!text && NAMES_SENGOKU_RE.test(text); }
/** 전국·에도 풍경을 말한 문장인가. */
export function describesSengoku(text: string | undefined): boolean {
  return !!text && SENGOKU_RE.test(text) && !OTHER_RE.test(text);
}

export function hasSengokuTileset(project: Pick<Project, "tilesets">): boolean {
  const def = project.tilesets[SENGOKU_TILESET_ID];
  return !!def && isSengokuTilesetDef(def);
}

export interface SengokuTarget {
  readonly mapId?: string;
  readonly lived?: boolean;
  /** 실내(다다미 방·다실·알현실·여관 방) 요청. */
  readonly indoor?: boolean;
  /** 문장에서 고른 구성 용도(compose_sengoku_edo_map style). */
  readonly style?: SengokuStyle;
  /** 문장이 실내도 함께 말했으면 그 방 종류(다실·여관 방 …). */
  readonly alsoRooms?: readonly string[];
}

const INDOOR_RE = /다다미|실내|방\s*안|객실|여관\s*방|다실\s*(?:안|내부)|알현실|대광간|도장\s*안|가게\s*안|부엌|목욕간|이로리|\b(?:tatami|interior|indoors?)\b/iu;
const OUTDOOR_RE = /마을|거리|성하|저택|경내|성\b|천수각|논|강|다리|역참|가도|\b(?:town|street|village|castle|shrine|temple)\b/iu;

/** 문장 → 구성 용도. 여러 낱말이 있으면 더 구체적인 것을 먼저 본다. */
export function sengokuStyleFor(text: string | undefined): SengokuStyle {
  const s = text ?? "";
  if (/성하\s*마을|성하마치|조카마치|castle\s*town/iu.test(s)) return "castle_town";
  if (/여관|료칸|하타고|역참|숙장|가도|도카이도|나카센도|ryokan|post\s*town/iu.test(s)) return "inn_street";
  if (/사무라이\s*저택|무사\s*(?:저택|집)|무가|다실|다도|samurai\s*(?:house|residence)/iu.test(s)) return "samurai";
  if (/신사|절|사찰|사원|도리이|오층탑|shrine|temple|pagoda/iu.test(s)) return "temple";
  if (/농촌|시골|논|농가|초가|어촌|farm|village|paddy/iu.test(s)) return "village";
  if (/천수각|성곽|성벽|해자|성\s*(?:안|밖|문)|castle/iu.test(s)) return "castle";
  if (/사무라이|samurai/iu.test(s)) return "samurai";
  return "castle_town";
}

/** 함께 지을 실내 방(문장에 나온 것). */
function roomsMentioned(text: string): string[] {
  const out: string[] = [];
  if (/다실|다도/u.test(text)) out.push("tea");
  if (/여관|료칸|하타고/u.test(text)) out.push("guest");
  if (/알현실|대광간/u.test(text)) out.push("audience");
  if (/도장/u.test(text)) out.push("dojo");
  return out;
}

/**
 * 이 요청이 전국·에도 칩셋 작업인가.
 *  - 대상 맵이 이미 sengoku_edo 이면 그 맵(생성·수정).
 *  - 아니면 «생성» 요청이 칩셋 이름을 부르거나 시대 낱말을 말했을 때 — **프로젝트에 칩셋이 있을 때만**.
 */
export function sengokuTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): SengokuTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  if (!hasSengokuTileset(project)) return null;
  const text = requestText ?? "";
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && isSengokuTilesetDef(project.tilesets[map.tilesetId])) return { mapId: map.id, lived, style: sengokuStyleFor(text) };
  if (intent.mode !== "create") return null;
  if (!NAMES_SENGOKU_RE.test(text) && !describesSengoku(text)) return null;
  const rooms = roomsMentioned(text);
  if (intent.space === "interior" || ((intent.space === "unclear" || intent.space === "both") && INDOOR_RE.test(text) && !OUTDOOR_RE.test(text))) return { indoor: true, alsoRooms: rooms };
  if (intent.space !== "outdoor" && intent.space !== "both" && intent.space !== "unclear") return null;
  return { style: sengokuStyleFor(text), alsoRooms: rooms };
}

export function scopeUsesSengoku(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isSengokuTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

export const SENGOKU_EXPOSED_TOOLS: readonly string[] = [
  "list_tileset_references", "read_tileset_reference", "create_map", "resize_map", "show_map_region", "check_reachability", "ask_tileset_change",
  "compose_sengoku_edo_map", "link_sengoku_edo_interior", "list_hand_interior_parts", "build_hand_interior_room", "list_tileset_objects", "stamp_tileset_object", "create_transfer_pair",
];

export const SENGOKU_ROOM_KINDS: readonly string[] = ["washitsu", "guest", "tea", "audience", "shop", "kitchen", "farm", "dojo", "bath", "bedroom", "study"];
export const SENGOKU_PROGRAMS: readonly string[] = ["samurai-house", "ryokan-1f", "ryokan-2f", "castle-hall", "machiya", "minka", "dojo"];

const STYLE_LIST = (Object.keys(SENGOKU_STYLE_KO) as SengokuStyle[]).map((s) => `${s}=${SENGOKU_STYLE_KO[s]}`).join(" · ");

export const SENGOKU_POINTER_LINE =
  "전국시대·에도·사무라이·성하마을·일본 전통 마을·신사·절·여관 거리·다실 풍경은 번들 칩셋 sengoku_edo 로 짓는다(현대 일본 거리는 jp_city, 조선은 joseon_baram): "
  + "새 맵 create_map tilesetId:\"sengoku_edo\"(보는 맵이 다른 계열이면 ask_tileset_change). 야외는 compose_sengoku_edo_map({style, seed}) 한 번으로 깐다 — style: " + STYLE_LIST + ". "
  + "도구가 건물·길·물·논·소품 배치와 문 접근칸·통행을 맞추고, 맵이 비었는데 작으면 알맞게 키운다. 낱칸 번호로 건물·나무를 칠하지 않는다. "
  + "건물 안(다다미 방·다실·여관 손님방·성 알현실·가게·농가·도장)은 build_hand_interior_room({tileset:\"sengoku_edo\", layout:{program:\"samurai-house\"} 또는 {rooms:[{kind:\"tea\"}]}}) 로 짓고 link_sengoku_edo_interior 로 문과 잇는다. 사람은 Actor1 캐릭터 이벤트.";

export const SENGOKU_DETAIL_LINE =
  "이 작업의 맵은 전국·에도 칩셋(sengoku_edo)이다. ⓪ 야외는 compose_sengoku_edo_map 으로 한 번에 깔고(손댄 맵은 replace:true, 다른 배치는 seed 를 바꾼다) 결과 data.buildings 의 문 칸을 실내 이음에 쓴다. "
  + "① 건물은 모두 남향이고 문 칸은 막힘, 바로 아래 접근칸은 길이다 — 소품을 더할 때 문 앞 두 칸과 길을 막지 않는다. ② 물(해자·강)·논은 걸을 수 없고 다리(se-bridge-*) 상판만 건넌다. "
  + "③ 소품은 list_tileset_objects({tilesetId:\"sengoku_edo\"}) → stamp_tileset_object 로 키트째, 맞는 바닥 위에만(석등·고마이누는 참배길 옆 풀밭, 노점·길등은 길가, 볏단·우물은 마당). "
  + "④ 실내 방 종류 " + SENGOKU_ROOM_KINDS.join("·") + " · 방 구성 " + SENGOKU_PROGRAMS.join("·") + ". ⑤ check_reachability 로 시작 칸 → 문까지 확인한다.";

export function sengokuPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!hasSengokuTileset(project)) return [];
  return scopeUsesSengoku(project, mapIds) ? [SENGOKU_POINTER_LINE, SENGOKU_DETAIL_LINE] : [SENGOKU_POINTER_LINE];
}

export function formatSengokuNote(target: SengokuTarget, targetMap: { id: string; width: number; height: number } | null): string {
  if (target.indoor) return [
    "[전국·에도 실내 — sengoku_edo 칩셋] 이 요청은 일본 옛 실내다. 판타지 실내(atlas_biome_interior)·현대 일본 집(jp_city)은 쓰지 않는다.",
    "짓는 법: build_hand_interior_room({tileset:\"sengoku_edo\", name, floor:\"se-floor-tatami\", wall:\"se-wall-fusuma\", layout:{…}}) 한 번 — "
      + "무가 저택(다다미 방·다실·침방·서재) {program:\"samurai-house\"}; 여관 {program:\"ryokan-1f\"}·{program:\"ryokan-2f\"}; 성 알현실 {program:\"castle-hall\"}(floor se-floor-tatami-gold, wall se-wall-fusuma-gold); "
      + "가게 {program:\"machiya\"}(floor se-floor-wood, wall se-wall-board); 농가 {program:\"minka\"}; 도장 {program:\"dojo\"}; 방 하나면 {rooms:[{kind:\"tea\"}]} 처럼 kind 하나. "
      + "floor 는 se-floor-tatami·se-floor-tatami-gold·se-floor-wood·se-floor-doma, wall 은 se-wall-shoji·se-wall-fusuma·se-wall-fusuma-gold·se-wall-plaster·se-wall-board 중에서.",
    "만든 뒤 data.layout.picture 로 배치를 보고, 출입구에서 닿지 못한 바닥이 0인지 확인한다.",
  ].join("\n");
  const style = target.style ?? "castle_town";
  const size = SENGOKU_DEFAULT_SIZE[style];
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 sengoku_edo 이고 비어 있다 → 이 맵에 compose_sengoku_edo_map 을 부른다(작으면 도구가 ${size.w}×${size.h} 로 키운다).`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 sengoku_edo 이고 이미 내용이 있다 → 다시 깔려면 replace:true(사용자가 갈아엎기를 원할 때만), 아니면 stamp_tileset_object 로 빈 땅에 더한다.`
      : `sengoku_edo 맵이 아직 없다 → create_map({name, width:${size.w}, height:${size.h}, tilesetId:"sengoku_edo"}) 로 새 맵을 만든다. 지금 보는 맵이 다른 계열이면 ask_tileset_change(toTilesetId:"sengoku_edo") 로 묻고 턴을 끝낸다.`;
  const rooms = target.alsoRooms?.length
    ? ` 문장이 실내(${target.alsoRooms.join("·")})도 말했다 — 야외를 깐 뒤 그 건물 문에 build_hand_interior_room({tileset:"sengoku_edo", layout:{rooms:[${target.alsoRooms.map((k) => `{kind:"${k}"}`).join(",")}]}}) 로 짓고 link_sengoku_edo_interior 로 잇는다.`
    : "";
  return [
    "[전국·에도 시공 — sengoku_edo 칩셋] 이 요청의 칩셋은 번들 sengoku_edo(전국·에도 일본 손 도트)다. author_beodeul_town·jp_city 조립 도구·조선 장소는 쓰지 않는다.",
    where,
    `순서: create_map(필요하면) → compose_sengoku_edo_map({mapId, style:"${style}", seed}) — 이 요청에 맞는 용도는 ${style}(${SENGOKU_STYLE_KO[style]}). 다른 용도: ${STYLE_LIST}. `
      + "결과 summary 의 건물·문 목록을 사용자에게 알리고, 손으로 다시 칠하지 않는다." + rooms,
  ].join("\n");
}

export const SENGOKU_CONCEPT_HINT: Readonly<Record<string, string>> = { "전국·에도 일본·사무라이": SENGOKU_TILESET_ID };
