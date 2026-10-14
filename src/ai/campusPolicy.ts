// 현대 학교·캠퍼스(modern_campus) 조수 연결 — 학원·학교·동아리·교실 요청이 «칩셋이 프로젝트에 있을 때만» 이 칩셋으로 가게 한다.
// jpCityPolicy.ts 와 같은 모양(대상 판정 + 포인터 줄 + 상세 줄 + 노트)이다. 차이:
//  - modern_campus 는 번들에 구워졌다(2026-10-14, 야외·실내 조각 한 시트, defaultAssets 의 ensureBundledTilesets 가 모든 프로젝트에 붙인다). 그래도 길은 `프로젝트에 칩셋이 있을 때만` 열린다.
//    칩셋이 없으면 포인터 줄도 안 붙고(없는 칩셋을 «있다»고 말하지 않는다) 대상도 null 이다 — 활성화 절차는 openwiki/modern-campus-interior.md 「활성화」.
//  - 일본 학교(일본풍 학교·소학교)는 jp_city 가 이긴다. 사용자가 칩셋을 이름으로 부르면(modern_campus·oprn-campus) 낱말 없이도 간다.
// 주의: 이 파일의 노트·문장은 모델 지시문(task)에 실린다 — requestsModernMap 의 PAW 전용 게이트를 켜는 낱말(현대·모던·modern 한글/영문)을 쓰지 않는다.
//       (칩셋 id `modern_campus` 자체는 식별자라 낱말 판정 대상이 아니다 — 문장 속에서는 「캠퍼스 칩셋」이라고만 쓴다.)

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const CAMPUS_TILESET_ID = "modern_campus";
const CAMPUS_TEXTURE = "tex_modern_campus";

export function isCampusTilesetDef(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === CAMPUS_TEXTURE;
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. */
const NAMES_CAMPUS_RE = /modern[_-]?campus|oprn-campus|캠퍼스\s*(?:칩셋|타일셋)/iu;
/** 학교 풍경 낱말 — 학교·학원·캠퍼스·교실·동아리·교정(운동장·교문·기숙사·급식실·강의실·도서관 포함). 일본풍 학교는 아래 JP_SCHOOL_RE 가 먼저 뺀다. */
const CAMPUS_RE = /학교|학원|캠퍼스|교실|동아리|교정|교문|운동장|기숙사|급식실|강의실|교무실|보건실|대학(?:교)?|고등학교|중학교|\b(?:campus|school|classroom|dormitory|dorm|high\s*school|college|university)\b/iu;
/** 일본 학교 — jp_city 의 소학교·학교 키트가 맡는다(jpCityPolicy JP_STREET_RE 와 겹치는 «일본풍 학교»). */
/** + 신발장·昇降口·下駄箱·上履き(우와바키) — 일본 학교에만 있는 현관(2026-10-14, jpCityPolicy.jpFacilityOf 와 같은 표지). */
const JP_SCHOOL_RE = /일본(?:풍|식)?\s*(?:초등|소|중|고등)?학교|일본\s*학원|소학교|jp[_-]city|oprn-jp|japan(?:ese)?\s+school|일본[^.。!?]{0,12}(?:교실|복도|교무실|보건실)|신발장|昇降口|下駄箱|上履き|우와바키|日本/iu;
/** 판타지 학교(마법 학교)는 wizarding_world 가 맡는다. */
const WIZARD_SCHOOL_RE = /마법\s*(?:학교|학원)|wizarding|마법사\s*학교|호그|witch\s+school/iu;

export function namesCampusTileset(text: string | undefined): boolean {
  return !!text && NAMES_CAMPUS_RE.test(text);
}

/** 학교·캠퍼스 풍경을 말한 문장인가(일본풍·마법 학교 제외). */
export function describesCampus(text: string | undefined): boolean {
  return !!text && CAMPUS_RE.test(text) && !JP_SCHOOL_RE.test(text) && !WIZARD_SCHOOL_RE.test(text);
}

/** 프로젝트가 modern_campus 번들 칩셋을 갖고 있는가. */
export function hasCampusTileset(project: Pick<Project, "tilesets">): boolean {
  const def = project.tilesets[CAMPUS_TILESET_ID];
  return !!def && isCampusTilesetDef(def);
}

export interface CampusTarget {
  /** 대상 맵이 이미 modern_campus 면 그 맵 — 아니면 새 맵을 만든다. */
  readonly mapId?: string;
  /** 대상 맵에 이미 내용이 있으면 true. */
  readonly lived?: boolean;
  /** 실내(교실·복도·기숙사 방…) 요청 — 새 실내 맵을 build_hand_interior_room(tileset modern_campus) 으로 짓는다. */
  readonly indoor?: boolean;
}

/** 학교 실내 낱말 — 의도 선언이 실내이거나, 문장이 실내만 말하고(아래 OUTDOOR 없음) 공간이 불분명할 때 실내 길로 보낸다. */
const CAMPUS_INDOOR_RE = /교실|복도|기숙사\s*방|호실|강의실|교무실|보건실|급식실|화장실|동아리\s*방|도서실|열람실|실내|classroom|hallway|corridor|dorm\s*room/iu;
const CAMPUS_OUTDOOR_RE = /캠퍼스|교정|운동장|교문|정문|쿼드|마당|건물\s*(?:여러|들)|campus|schoolyard|quad/iu;

/**
 * 이 요청이 캠퍼스 칩셋 작업인가.
 *  - 대상 맵이 이미 modern_campus 이면 그 맵(생성·수정만).
 *  - 아니면 «야외 시공 생성» 요청이 칩셋 이름을 부르거나 학교·학원·캠퍼스·교실·동아리·교정을 말했을 때 새 맵 — **프로젝트에 칩셋이 있을 때만**.
 *  - 칩셋이 없으면 (사용자가 이름으로 불러도) null — 없는 칩셋으로 create_map 을 부르게 하지 않는다.
 * 실내(교실·기숙사 방 등 build_hand_interior_room 경로)·NPC·질문은 낱말 하나로 끌려오지 않게 의도 선언을 같이 본다 — 실내는 CAMPUS_INTERIOR_LINE 이 맡는다.
 * 호출자는 jp_city 가 이미 잡았으면(jpCity 대상) 부르지 않는다.
 */
export function campusTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): CampusTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  if (!hasCampusTileset(project)) return null;
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && isCampusTilesetDef(project.tilesets[map.tilesetId])) return { mapId: map.id, lived };
  if (intent.mode !== "create") return null;
  const text = requestText ?? "";
  if (!NAMES_CAMPUS_RE.test(text) && !describesCampus(text)) return null;
  // 실내 — 실측(2026-10-14 gemini-3.8-flash): 「기숙사 방」이 이 길을 못 타 판타지 손 도트 실내(atlas_biome_interior)로 깔렸다.
  if (intent.space === "interior" || ((intent.space === "unclear" || intent.space === "both") && CAMPUS_INDOOR_RE.test(text) && !CAMPUS_OUTDOOR_RE.test(text))) return { indoor: true };
  if (intent.space !== "outdoor" && intent.space !== "both" && intent.space !== "unclear") return null;
  return {};
}

/** 범위 맵 중 하나라도 modern_campus 인가(시스템 프롬프트 상세 줄 조건). */
export function scopeUsesCampus(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isCampusTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** 캠퍼스 작업 첫 요청부터 스키마가 보여야 하는 도구 — 참고문서·땅·실내 조립·이동. */
export const CAMPUS_EXPOSED_TOOLS: readonly string[] = [
  "list_tileset_references", "read_tileset_reference", "create_map", "fill_region", "lay_path", "paint_tiles", "stamp_object", "check_reachability", "show_map_region",
  "ask_tileset_change", "import_region_reference", "list_hand_interior_parts", "build_hand_interior_room", "list_spatial_designs", "create_transfer_pair",
  "compose_campus_grounds", "link_campus_interior", "list_tileset_objects", "stamp_tileset_object", "resize_map",
];

/** 학교 실내 방 12종 — 조수가 `rooms:[{kind}]` 에 쓰는 낱말(데이터 정본 src/assets/modernCampusRoomTable.json). */
export const CAMPUS_ROOM_KINDS: readonly string[] = [
  "classroom", "corridor", "stairwell", "toilet", "lockers", "staffroom", "cafeteria", "library", "dorm-room", "club", "lecture", "infirmary",
];

/** 방 구성(build_hand_interior_room layout.program) — 예제 평면 5장(interiorRoomTemplates.json modern_campus). */
export const CAMPUS_PROGRAMS: readonly string[] = ["school-class-wing", "school-special-wing", "school-cafeteria-club-wing", "dorm-1f", "dorm-2f"];

/** 시스템 프롬프트 한 줄 — 칩셋이 **프로젝트에 있을 때만** 붙는다(campusPromptLines). */
export const CAMPUS_POINTER_LINE =
  "학교·학원·캠퍼스·교실·동아리·교정(운동장·교문·기숙사·급식실·강의실) 풍경은 번들 칩셋 modern_campus 로 짓는다(일본풍 학교는 jp_city, 마법 학교는 wizarding_world): "
  + "새 맵 create_map tilesetId:\"modern_campus\"(보는 맵이 다른 계열이면 ask_tileset_change 로 견본을 보이고 묻는다). "
  + "먼저 list_tileset_references({tilesetId:\"modern_campus\"}) 의 교정 배치·교사 조립 예제를 읽고, 야외는 compose_campus_grounds({style:\"school\"|\"university\", seed}) 한 번으로 깐다(학교 교정 48×36 이상·대학 캠퍼스 52×40 이상, 건물은 buildings 로 고른다 — 씨앗마다 운동장 방향·나무·소품 자리가 달라진다). "
  + "실내는 build_hand_interior_room 으로 먼저 짓고, 들어갈 건물만 compose_campus_grounds 의 entrances:[{building,interiorMapId}] 로 지정한다 — 거기에만 문이 그려지고 이음까지 한 번에 난다(나머지 건물은 문 없는 벽면, 장식 문 금지). 나중에 건물을 더 열 때는 link_campus_interior({building,interiorMapId}). 소품을 더 놓을 때는 list_tileset_objects → stamp_tileset_object 로 키트째 찍는다(낱칸 번호로 칠하지 않는다). "
  + "교실·복도·교무실·급식실·도서관·보건실·화장실·기숙사 방·동아리방·강의실 실내는 build_hand_interior_room({tileset:\"modern_campus\", floor, wall, layout:{program:\"school-class-wing\"} 또는 layout:{rooms:[{kind:\"classroom\"},{kind:\"classroom\"},{kind:\"corridor\"}]}}) 한 번으로 짓는다(방 구성 " + CAMPUS_PROGRAMS.join("·") + ") — "
  + "부품은 list_hand_interior_parts({tileset:\"modern_campus\", room:\"교실\"}). 교실 문은 같은 맵 안의 문 그림(접근칸 비움)이고 이동 이벤트는 계단·건물 출입구에만 둔다. 사람(학생·교사)은 Actor1 캐릭터 이벤트로 놓는다.";

/** 캠퍼스 맵이 범위에 있을 때만 붙는 상세 순서. */
export const CAMPUS_DETAIL_LINE =
  "이 작업의 맵은 캠퍼스 칩셋(modern_campus)이다. ⓪ 야외는 compose_campus_grounds 로 한 번에 깔고(손댄 맵은 replace:true) 결과 data.buildings 의 건물 이름을 entrances 에 쓴다(실내가 있는 건물만 문이 생긴다) — 아래 ①~③ 은 그 규칙이고, 직접 칠해야 할 때만 따른다. ① 학교는 남쪽 교문→주 통로→북쪽 건물 줄 앞 광장, 운동장(흙·흰 선·골대·스탠드)은 통로 옆, 정원은 반대쪽이다. 대학은 쿼드 잔디 + 십자 길 + 분수 광장, 북쪽 세 동·남쪽 두 동이다(참고문서 「배치 예제」). 깔고 나서 소품을 더하면 문 접근칸·길을 막지 않는다. "
  + "② 건물은 키트(mc-bld-*)째 찍는다 — 낱칸 번호로 칠하지 않는다. 깃대·소화전·자판기·철봉·허들·철망 울타리·미닫이 교문은 이 칩셋에 없다(3/4 관문 미통과로 뺐다). ③ 건물 문 앞 접근칸 한 줄은 비우고, 안은 build_hand_interior_room 으로 짓고 건물마다 entrances 또는 link_campus_interior({building}) 로 잇는다. 그려진 문은 접근칸이 걸을 수 있고 실내 이동 이벤트가 있어야 하며, 어기면 projectLint 가 campus-dead-door error 로 막는다. "
  + "④ 교실 동은 교실 둘 + 복도, 특별교실 동은 도서관·보건실·교무실 + 계단, 급식·동아리 동은 급식실·화장실·동아리방, 기숙사는 1층 라운지·방 + 2층 방·공용 욕실을 계단 쌍으로 잇는다(예제 평면 5장). ⑤ check_reachability 로 교문→현관→교실까지 이어지는지 확인한다.";

/** 캠퍼스 실내 줄 — 실내 요청에 칩셋이 있으면 붙는다. */
export const CAMPUS_INTERIOR_LINE =
  "캠퍼스 칩셋(modern_campus)의 학교·기숙사 실내는 방 종류 " + CAMPUS_ROOM_KINDS.join("·") + " 중에서 고른다: 교실 책상은 2인 한 쌍 3열 격자(열 사이 1칸), 복도는 폭 4줄(통로 2줄 유지), 급식실 탁자는 줄 사이 2칸, 기숙사는 침대·책상·옷장 한 벌과 방 앞 복도. "
  + "계단은 복도 북쪽 벽 앞 2칸(위)·2×2 바닥(아래)이고 이동 칸은 계단 그림 칸·계단통 아래 줄이다.";

/** 시스템 프롬프트에 붙일 줄들 — 칩셋이 프로젝트에 없으면 아무것도 붙지 않는다(없는 칩셋을 있다고 말하지 않는다). */
export function campusPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!hasCampusTileset(project)) return [];
  return scopeUsesCampus(project, mapIds) ? [CAMPUS_POINTER_LINE, CAMPUS_DETAIL_LINE, CAMPUS_INTERIOR_LINE] : [CAMPUS_POINTER_LINE];
}

/** 의도 노트(모델 지시문 뒤에 붙는다). */
export function formatCampusNote(target: CampusTarget, targetMap: { id: string; width: number; height: number } | null): string {
  if (target.indoor) return [
    "[학교·캠퍼스 실내 — 캠퍼스 칩셋] 이 요청은 학교·기숙사 실내다. 칩셋은 캠퍼스 칩셋(modern_campus)이다 — 판타지 손 도트 실내(atlas_biome_interior)·일본 집 실내(jp_city)·마법 학교 실내는 쓰지 않는다(시대가 다르다).",
    "짓는 법: build_hand_interior_room({tileset:\"modern_campus\", name, floor, wall, exitWidth:2, layout:{…}}) 한 번. layout 은 방 구성 하나를 준다 — "
      + "교실과 복도 → {program:\"school-class-wing\"} 또는 {rooms:[{kind:\"classroom\"},{kind:\"classroom\"},{kind:\"corridor\"}]}; "
      + "기숙사 방 → {rooms:[{kind:\"dorm-room\"},{kind:\"dorm-room\"},{kind:\"corridor\"}]}(방 하나만이면 {rooms:[{kind:\"dorm-room\"}]}) 또는 {program:\"dorm-2f\"}; "
      + "도서관·보건실·교무실 → {program:\"school-special-wing\"}; 급식실·화장실·동아리방 → {program:\"school-cafeteria-club-wing\"}. 도구가 방 배치·칸막이·문·출구를 짜고 방마다 예제 가구 한 벌을 심는다 — plan·objects 를 손으로 쓰지 않는다. "
      + "floor 는 mc-floor-lino(교실)·mc-floor-corridor(복도)·mc-floor-dorm(기숙사)·mc-floor-parquet(도서관·강당)·mc-floor-cafe(급식실)·mc-floor-tile-wc(화장실·욕실), wall 은 mc-wall-class·mc-wall-corridor·mc-wall-dorm·mc-wall-cafe·mc-wall-tile 중에서 고른다(list_hand_interior_parts({tileset:\"modern_campus\"}) 로 확인).",
    "만든 뒤 결과 data.layout.picture 로 배치를 한 번 보고, 출입구에서 닿지 못한 바닥이 0인지 확인한다. 학생·교사는 Actor1 캐릭터 이벤트로 놓는다.",
  ].join("\n");
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 캠퍼스 칩셋이고 비어 있다 → 이 맵에 짓는다.`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 캠퍼스 칩셋이고 이미 내용이 있다 → get_map_region 으로 빈 땅을 찾아 거기에 더한다(기존 칸을 지우지 않는다).`
      : "캠퍼스 맵이 아직 없다 → create_map({name, width:56, height:40, tilesetId:\"modern_campus\"}) 로 새 맵을 만든다. 지금 보는 맵이 다른 계열이면 실행기가 거부한다 — 그때는 칠하지 말고 ask_tileset_change(toTilesetId:\"modern_campus\", reason) 로 사용자에게 견본을 보이고 이 턴을 끝낸다.";
  return [
    "[학교·캠퍼스 시공 — 캠퍼스 칩셋] 이 요청의 칩셋은 번들 캠퍼스 칩셋(modern_campus)이다. author_beodeul_town 은 버들항 전용이라 쓰지 않는다 — 일본풍 학교 키트(jp_city)나 마법 학교 도구도 섞지 않는다.",
    where,
    "순서: list_tileset_references → read_tileset_reference 로 교정 배치·교사 조립 예제를 읽는다 → resize_map(학교 48×36·대학 52×40 이상) → 들어갈 건물마다 build_hand_interior_room({tileset:\"modern_campus\", exitWidth:2}) 실내를 먼저 짓고 → compose_campus_grounds({..., entrances:[{building,interiorMapId}]}) 로 교문·건물·길·운동장·문·이음을 한 번에 → 소품은 stamp_tileset_object → check_reachability.",
  ].join("\n");
}

/**
 * 컨셉 카드의 무대 낱말 → 타일셋 id. 활성화됨(2026-10-14): 같은 줄이 `harness-data/game-concepts/seed.json` tilesetHints 와
 * `src/concepts/format.ts` BUILDABLE_CONCEPT_TILESETS 에 있다(test/conceptSource.test.ts 가 둘이 같은 집합이 아니면 막는다).
 */
export const CAMPUS_CONCEPT_HINT: Readonly<Record<string, string>> = { "현대 학원·캠퍼스": CAMPUS_TILESET_ID };
