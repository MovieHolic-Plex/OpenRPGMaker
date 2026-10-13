// 현대 학교·캠퍼스(modern_campus) 조수 연결 — 학원·학교·동아리·교실 요청이 «칩셋이 프로젝트에 있을 때만» 이 칩셋으로 가게 한다.
// jpCityPolicy.ts 와 같은 모양(대상 판정 + 포인터 줄 + 상세 줄 + 노트)이다. 차이:
//  - modern_campus 는 아직 번들에 구워지지 않았다(2026-10-13, 야외 조각·실내 조각이 각각 object-gate 를 통과한 단계). 그래서 모든 길이 `프로젝트에 칩셋이 있을 때만` 열린다.
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
const JP_SCHOOL_RE = /일본(?:풍|식)?\s*(?:초등|소|중|고등)?학교|일본\s*학원|소학교|jp[_-]city|oprn-jp|japan(?:ese)?\s+school/iu;
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
}

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
  if (intent.mode !== "create" || (intent.space !== "outdoor" && intent.space !== "both" && intent.space !== "unclear")) return null;
  const text = requestText ?? "";
  if (NAMES_CAMPUS_RE.test(text)) return {};
  return describesCampus(text) ? {} : null;
}

/** 범위 맵 중 하나라도 modern_campus 인가(시스템 프롬프트 상세 줄 조건). */
export function scopeUsesCampus(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isCampusTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** 캠퍼스 작업 첫 요청부터 스키마가 보여야 하는 도구 — 참고문서·땅·실내 조립·이동. */
export const CAMPUS_EXPOSED_TOOLS: readonly string[] = [
  "list_tileset_references", "read_tileset_reference", "create_map", "fill_region", "lay_path", "paint_tiles", "stamp_object", "check_reachability", "show_map_region",
  "ask_tileset_change", "import_region_reference", "list_hand_interior_parts", "build_hand_interior_room", "list_spatial_designs", "create_transfer_pair",
];

/** 학교 실내 방 12종 — 조수가 `rooms:[{kind}]` 에 쓰는 낱말(데이터 정본 src/assets/modernCampusRoomTable.json). */
export const CAMPUS_ROOM_KINDS: readonly string[] = [
  "classroom", "corridor", "stairwell", "toilet", "lockers", "staffroom", "cafeteria", "library", "dorm-room", "club", "lecture", "infirmary",
];

/** 시스템 프롬프트 한 줄 — 칩셋이 **프로젝트에 있을 때만** 붙는다(campusPromptLines). */
export const CAMPUS_POINTER_LINE =
  "학교·학원·캠퍼스·교실·동아리·교정(운동장·교문·기숙사·급식실·강의실) 풍경은 번들 칩셋 modern_campus 로 짓는다(일본풍 학교는 jp_city, 마법 학교는 wizarding_world): "
  + "새 맵 create_map tilesetId:\"modern_campus\"(보는 맵이 다른 계열이면 ask_tileset_change 로 견본을 보이고 묻는다). "
  + "먼저 list_tileset_references({tilesetId:\"modern_campus\"}) 의 교정 배치·교사 조립 예제를 읽는다. "
  + "교실·복도·교무실·급식실·도서관·보건실·화장실·기숙사 방·동아리방·강의실 실내는 build_hand_interior_room({tileset:\"modern_campus\", layout:{rooms:[{kind:\"classroom\"},{kind:\"corridor\"},…]}}) 한 번으로 짓는다 — "
  + "부품은 list_hand_interior_parts({tileset:\"modern_campus\", room:\"교실\"}). 교실 문은 같은 맵 안의 문 그림(접근칸 비움)이고 이동 이벤트는 계단·건물 출입구에만 둔다. 사람(학생·교사)은 Actor1 캐릭터 이벤트로 놓는다.";

/** 캠퍼스 맵이 범위에 있을 때만 붙는 상세 순서. */
export const CAMPUS_DETAIL_LINE =
  "이 작업의 맵은 캠퍼스 칩셋(modern_campus)이다. ① 땅은 교문→본관→운동장 순서의 교정 배치(참고문서 용도 ②)로 깐다 — 교문 안쪽 길, 본관 앞 화단·벤치, 운동장 흙과 흰 선, 자전거 거치대는 본관 옆. "
  + "② 건물은 교사 조립 예제(1층 현관·창 띠·계단실)의 배열을 그대로 쓴다 — 낱칸 번호로 칠하지 않는다. ③ 건물 문 앞 접근칸 한 줄은 비우고, 안은 build_hand_interior_room 으로 짓고 문마다 이동 쌍으로 잇는다(건물 문 그림 ≠ 접근칸 ≠ 이동 이벤트). "
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
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 캠퍼스 칩셋이고 비어 있다 → 이 맵에 짓는다.`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 캠퍼스 칩셋이고 이미 내용이 있다 → get_map_region 으로 빈 땅을 찾아 거기에 더한다(기존 칸을 지우지 않는다).`
      : "캠퍼스 맵이 아직 없다 → create_map({name, width:56, height:40, tilesetId:\"modern_campus\"}) 로 새 맵을 만든다. 지금 보는 맵이 다른 계열이면 실행기가 거부한다 — 그때는 칠하지 말고 ask_tileset_change(toTilesetId:\"modern_campus\", reason) 로 사용자에게 견본을 보이고 이 턴을 끝낸다.";
  return [
    "[학교·캠퍼스 시공 — 캠퍼스 칩셋] 이 요청의 칩셋은 번들 캠퍼스 칩셋(modern_campus)이다. author_beodeul_town 은 버들항 전용이라 쓰지 않는다 — 일본풍 학교 키트(jp_city)나 마법 학교 도구도 섞지 않는다.",
    where,
    "순서: list_tileset_references → read_tileset_reference 로 교정 배치·교사 조립 예제를 읽는다 → 교문·본관·운동장 땅 → 교사 → 건물마다 build_hand_interior_room({tileset:\"modern_campus\"}) 실내 → 계단·출입구 이동 쌍 → check_reachability.",
  ].join("\n");
}

/**
 * 컨셉 카드의 무대 낱말 → 타일셋 id. 활성화 전(BUILDABLE_CONCEPT_TILESETS·seed.tilesetHints 에 아직 없음)에는 코드가 읽지 않고,
 * 활성화 때 같은 줄을 `harness-data/game-concepts/seed.json` tilesetHints 와 `src/concepts/format.ts` BUILDABLE_CONCEPT_TILESETS 에 더한다
 * (test/conceptSource.test.ts 가 둘이 같은 집합이 아니면 막는다). 지금 더하면 그림이 없는 칩셋으로 컨셉이 «지을 수 있음» 처리된다.
 */
export const CAMPUS_CONCEPT_HINT: Readonly<Record<string, string>> = { "현대 학원·캠퍼스": CAMPUS_TILESET_ID };
