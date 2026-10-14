// 도쿄풍 도시 칩셋(modern_city, 계열 oprn-modern) 조수 연결 — 사무실·편의점·아파트·병원 병동·빌딩 로비·카페·은행·지하철 대합실·창고 실내와 거리.
// campusPolicy.ts 와 같은 모양(대상 판정 + 포인터 줄 + 상세 줄 + 노트)이다. 차이:
//  - 이 칩셋은 모든 프로젝트에 번들로 붙어 있다(defaultAssets 의 ensureBundledTilesets). 그래서 «낱말 하나로» 잡지 않는다 —
//    «현대 도시·번화가·편의점» 같은 거리 낱말은 jp_city(jpCityPolicy)가 맡고, 학교는 modern_campus, 네온·SF 는 sf_station 이 맡는다.
//    이 길이 잡는 것은 ① 보고 있는(대상) 맵이 이미 modern_city 일 때 ② 사용자가 칩셋을 이름으로 부를 때(modern_city·oprn-modern·「도쿄풍 도시 칩셋」)
//    ③ 실내 요청이고 프로젝트가 modern_city 맵을 쓰면서 jp_city 맵은 안 쓸 때 뿐이다.
//  - plainTurn 의 첫 승자 사슬에서 캠퍼스 뒤·버들항 앞에 선다 — 앞의 어느 테마도 잡지 않았을 때만 본다.
// 주의: 이 파일의 노트·문장은 모델 지시문(task)에 실린다 — 「현대·모던·modern」 낱말을 문장에 쓰지 않는다(칩셋 id `modern_city` 는 식별자라 괜찮다).

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";
import { describesCampus } from "@/ai/campusPolicy";

export const MODERN_CITY_TILESET_ID = "modern_city";
const MODERN_CITY_TEXTURE = "tex_modern_city";
const JP_CITY_TEXTURE = "tex_jp_city";

export function isModernCityTilesetDef(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === MODERN_CITY_TEXTURE;
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. 「도쿄풍」 하나만으로는 잡지 않는다(일본 거리는 jp_city). */
const NAMES_MODERN_CITY_RE = /modern[_-]?city|oprn-modern|도쿄풍\s*(?:도시\s*)?(?:칩셋|타일셋)|현대\s*도시\s*(?:칩셋|타일셋)/iu;
/** 실내 낱말 — 아홉 방 구성(program)에 대응한다. */
const MC_INDOOR_RE = /사무실|오피스|회의실|업무\s*공간|편의점\s*(?:안|내부|실내|매장)|매장\s*안|아파트\s*(?:안|내부|방|실내)|원룸|거실|침실|병원|병실|병동|입원실|로비|엘리베이터\s*홀|카페|커피숍|찻집|은행|창구|대합실|개찰구|역\s*안|창고|물류|실내|내부|\b(?:office|konbini|apartment|hospital|ward|lobby|cafe|bank|concourse|warehouse|interior)\b/iu;
const MC_OUTDOOR_RE = /거리|길거리|도로|교차로|큰길|골목|블록|시가지|번화가|도심|바깥|야외|\b(?:street|downtown|block|outdoor)\b/iu;

export function namesModernCityTileset(text: string | undefined): boolean {
  return !!text && NAMES_MODERN_CITY_RE.test(text);
}

/** 프로젝트가 modern_city 번들 칩셋을 갖고 있는가. */
export function hasModernCityTileset(project: Pick<Project, "tilesets">): boolean {
  const def = project.tilesets[MODERN_CITY_TILESET_ID];
  return !!def && isModernCityTilesetDef(def);
}

function projectUses(project: Pick<Project, "tilesets" | "maps">, texture: string): boolean {
  return Object.values(project.maps).some((m) => { const t = project.tilesets[m.tilesetId]; return t?.image.type === "bundled" && t.image.id === texture; });
}

export interface ModernCityTarget {
  /** 대상 맵이 이미 modern_city 면 그 맵 — 아니면 새 맵을 만든다. */
  readonly mapId?: string;
  /** 대상 맵에 이미 내용이 있으면 true. */
  readonly lived?: boolean;
  /** 실내 요청 — 새 실내 맵을 build_hand_interior_room(tileset modern_city)으로 짓는다. */
  readonly indoor?: boolean;
  /** 실내 요청이 modern_city 거리 맵에서 왔으면 그 맵(지은 실내를 건물 문과 잇는다). */
  readonly fromMapId?: string;
  /** 요청 문장에서 고른 방 구성(program) — 없으면 노트가 표를 준다. */
  readonly program?: ModernCityProgram;
}

export type ModernCityProgram = "office-floor" | "konbini" | "apartment" | "hospital-ward" | "lobby" | "cafe" | "bank" | "concourse" | "warehouse";
/** 방 구성 · 낱말 · 바닥 · 벽면(예제 평면 tiledata/modern-city/interior/examples 와 같다). */
export const MODERN_CITY_PROGRAMS: readonly { program: ModernCityProgram; words: RegExp; ko: string; floor: string; wall: string }[] = [
  { program: "hospital-ward", words: /병원|병실|병동|입원|hospital|ward/iu, ko: "병원 병동(4인 병실 + 대기 복도)", floor: "mci-vinyl-hospital", wall: "mci-wall-hospital" },
  { program: "konbini", words: /편의점|konbini|convenience/iu, ko: "편의점(매장 + 뒷방)", floor: "mci-vinyl-store", wall: "mci-wall-store" },
  { program: "apartment", words: /아파트|원룸|거실|침실|apartment/iu, ko: "아파트 1LDK(침실 + 거실·부엌)", floor: "mci-wood-oak", wall: "mci-wall-home" },
  { program: "lobby", words: /로비|엘리베이터\s*홀|lobby/iu, ko: "빌딩 로비(엘리베이터·보안 게이트·안내 데스크)", floor: "mci-stone-lobby", wall: "mci-wall-lobby" },
  { program: "cafe", words: /카페|커피숍|찻집|cafe|coffee/iu, ko: "카페(카운터·바 의자·둥근 탁자)", floor: "mci-wood-dark", wall: "mci-wall-brick" },
  { program: "bank", words: /은행|창구|bank/iu, ko: "은행 지점(창구·대기 의자)", floor: "mci-stone-lobby", wall: "mci-wall-lobby" },
  { program: "concourse", words: /대합실|개찰구|지하철|역\s*안|concourse|subway|station/iu, ko: "지하철 대합실(개찰구·노선도·매점)", floor: "mci-tile-concourse", wall: "mci-wall-tile" },
  { program: "warehouse", words: /창고|물류|하역|warehouse/iu, ko: "물류 창고(랙·팔레트)", floor: "mci-concrete", wall: "mci-wall-metal" },
  { program: "office-floor", words: /사무실|오피스|회의실|업무\s*공간|office/iu, ko: "사무실 한 층(열린 사무 공간 + 회의실 + 복도)", floor: "mci-carpet-office", wall: "mci-wall-office" },
];

export function modernCityProgramFor(text: string | undefined): ModernCityProgram | undefined {
  return text ? MODERN_CITY_PROGRAMS.find((p) => p.words.test(text))?.program : undefined;
}

/**
 * 이 요청이 도쿄풍 도시 칩셋(modern_city) 작업인가. 호출자는 앞선 테마(시대 테마·jp_city·고딕·해적·하늘섬·캠퍼스)가 잡았으면 부르지 않는다.
 *  - 대상 맵이 modern_city: 실내 요청이면 새 실내({indoor, fromMapId}), 아니면 그 맵. 학교 낱말이면 캠퍼스에 양보해 null.
 *  - 칩셋 이름을 불렀으면 새 맵(실내 낱말이면 실내).
 *  - 실내 생성 요청이고 프로젝트가 modern_city 맵을 쓰면서 jp_city 맵은 안 쓰면 실내.
 * 질문·NPC 등 생성/수정이 아닌 요청은 잡지 않는다.
 */
export function modernCityTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): ModernCityTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  if (!hasModernCityTileset(project)) return null;
  const text = requestText ?? "";
  if (describesCampus(text)) return null;
  const map = mapId ? project.maps[mapId] : undefined;
  const indoorWords = MC_INDOOR_RE.test(text) && !MC_OUTDOOR_RE.test(text);
  const wantsIndoor = intent.space === "interior" || ((intent.space === "unclear" || intent.space === "both") && indoorWords);
  const program = modernCityProgramFor(text);
  if (map && isModernCityTilesetDef(project.tilesets[map.tilesetId])) {
    // 이미 지은 실내 맵(맨 아래 줄 출입구가 있는 작은 맵)을 고치는 요청은 그 맵 그대로.
    if (intent.mode === "create" && wantsIndoor) return { indoor: true, fromMapId: map.id, ...(program ? { program } : {}) };
    return { mapId: map.id, lived };
  }
  if (intent.mode !== "create") return null;
  if (NAMES_MODERN_CITY_RE.test(text)) return wantsIndoor ? { indoor: true, ...(program ? { program } : {}) } : intent.space === "interior" ? null : {};
  if (wantsIndoor && indoorWords && projectUses(project, MODERN_CITY_TEXTURE) && !projectUses(project, JP_CITY_TEXTURE)) return { indoor: true, ...(program ? { program } : {}) };
  return null;
}

/** 범위 맵 중 하나라도 modern_city 인가(시스템 프롬프트 상세 줄 조건). */
export function scopeUsesModernCity(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isModernCityTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** 이 칩셋 작업 첫 요청부터 스키마가 보여야 하는 도구. */
export const MODERN_CITY_EXPOSED_TOOLS: readonly string[] = [
  "list_tileset_references", "read_tileset_reference", "create_map", "resize_map", "fill_region", "lay_path", "paint_tiles", "check_reachability", "show_map_region",
  "ask_tileset_change", "import_region_reference", "list_hand_interior_parts", "build_hand_interior_room", "list_tileset_objects", "stamp_tileset_object",
  "compose_modern_city_street", "link_modern_city_interior", "list_map_locations",
];

const PROGRAM_LIST = MODERN_CITY_PROGRAMS.map((p) => `${p.program}(${p.ko.split("(")[0]})`).join("·");

/** 시스템 프롬프트 한 줄 — 범위에 modern_city 맵이 있을 때만 붙는다(모든 프로젝트에 번들로 있으므로 늘 붙이면 거리 요청을 jp_city 에서 빼앗는다). */
export const MODERN_CITY_POINTER_LINE =
  "도쿄풍 도시 칩셋 modern_city(계열 oprn-modern): 거리는 compose_modern_city_street({mapId, seed}) 한 번으로 도로·교차로·보도·건물 키트·소품을 깔고(결과 data.buildings 의 문 칸), "
  + "건물 안은 build_hand_interior_room({tileset:\"modern_city\", name, floor, wall, layout:{program}}) 로 짓고(program = " + PROGRAM_LIST + ") link_modern_city_interior 로 문과 잇는다. "
  + "참고문서 list_tileset_references({tilesetId:\"modern_city\"}) 의 「실내」 용도에 가구 사전·예제 9장이 있다. 낱칸 번호로 칠하지 않는다 — 소품은 list_tileset_objects → stamp_tileset_object.";

export const MODERN_CITY_DETAIL_LINE =
  "이 작업의 맵은 modern_city 다. ① 거리는 compose_modern_city_street 로 깔고(손댄 맵은 replace:true, 씨앗마다 도로 배치·건물·소품이 달라진다) 건물은 키트(mc-bld-*)째 — 몸통 칸은 막힘, 문 앞 접근칸 한 줄은 보도로 비운다. "
  + "② 실내는 방 구성 하나로: 사무실 office-floor, 편의점 konbini, 아파트 apartment, 병원 hospital-ward, 로비 lobby, 카페 cafe, 은행 bank, 지하철 concourse, 창고 warehouse. 도구가 칸막이·문·출구를 짜고 예제 방의 가구 한 벌을 심는다 — plan·objects 를 손으로 쓰는 것은 크기·가구를 바꿀 때만. "
  + "③ 방 사이 문 그림은 같은 맵이라 이벤트가 없다. 이동 이벤트는 건물 출입구(link_modern_city_interior)와 계단에만. ④ check_reachability 로 시작 칸 → 건물 문 → 실내 안까지 이어지는지 본다.";

export const MODERN_CITY_INTERIOR_LINE =
  "modern_city 실내 배치 규칙: 사무 책상은 남향 의자 + 화면이 북쪽인 책상 한 쌍씩 줄마다 뒤로 2칸 통로, 편의점은 북쪽 벽 냉장 진열장 줄 + 진열대 섬 두 줄(섬 사이 2칸) + 출입구 옆 계산대, 병실은 북쪽 벽 침대 넷(침대마다 링거대·협탁) + 대기 복도 의자, "
  + "로비는 북쪽 벽 엘리베이터 셋 + 보안 게이트 한 줄 + 안내 데스크·대기 소파, 실내 60칸 넘는 한 방은 기둥·알코브로 꺾는다(ㅁ자 금지).";

export function modernCityPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!hasModernCityTileset(project) || !scopeUsesModernCity(project, mapIds)) return [];
  return [MODERN_CITY_POINTER_LINE, MODERN_CITY_DETAIL_LINE, MODERN_CITY_INTERIOR_LINE];
}

/** 의도 노트(모델 지시문 뒤에 붙는다). */
export function formatModernCityNote(target: ModernCityTarget, targetMap: { id: string; width: number; height: number } | null): string {
  if (target.indoor) {
    const p = target.program ? MODERN_CITY_PROGRAMS.find((x) => x.program === target.program)! : null;
    const table = MODERN_CITY_PROGRAMS.map((x) => `${x.ko} → program:"${x.program}", floor:"${x.floor}", wall:"${x.wall}"`).join("; ");
    return [
      "[도쿄풍 도시 실내 — modern_city 칩셋] 이 요청은 도쿄풍 도시 건물의 실내다. 칩셋은 modern_city 다 — 판타지 손 도트 실내(atlas_biome_interior)·일본 집 실내(jp_city)·캠퍼스 실내는 쓰지 않는다.",
      p
        ? `짓는 법: build_hand_interior_room({tileset:"modern_city", mapId:새 id, name, floor:"${p.floor}", wall:"${p.wall}", layout:{program:"${p.program}"}}) 한 번 — ${p.ko}.`
        : `짓는 법: build_hand_interior_room({tileset:"modern_city", mapId:새 id, name, floor, wall, layout:{program}}) 한 번. 표: ${table}.`,
      "도구가 방 크기·칸막이·문·출구를 짜고 방마다 제작자 예제 방의 가구 한 벌을 심는다 — plan·objects 를 손으로 쓰지 않는다. 다른 배치가 필요하면 layout.variant 1·2 또는 layout.seed 를 바꾼다. 방 종류를 직접 고르려면 layout:{rooms:[{kind:\"open-office\"},{kind:\"meeting\"},{kind:\"hall\"}]}(list_hand_interior_parts({tileset:\"modern_city\"}) 로 종류 확인).",
      "만든 뒤 결과 data.layout.picture 와 경고를 한 번 보고 출입구에서 닿지 못한 바닥이 0인지 확인한다. 같은 요청에서 방을 손으로 다시 칠하지 않는다.",
      target.fromMapId
        ? `거리 맵 '${target.fromMapId}' 에서 온 요청이다 — 지은 뒤 그 맵 건물 문(list_map_locations 의 건물 이름표, 또는 compose_modern_city_street 결과 data.buildings[].doors)에 link_modern_city_interior({mapId:"${target.fromMapId}", door, interiorMapId}) 로 잇는다.`
        : "거리 맵이 있으면 지은 실내를 link_modern_city_interior 로 건물 문과 잇는다(없으면 잇지 않는다).",
      "사람(직원·손님)은 Actor1 캐릭터 이벤트로 놓는다.",
    ].join("\n");
  }
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 modern_city 이고 비어 있다 → 이 맵에 짓는다.`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 modern_city 이고 이미 내용이 있다 → 건물 몇 채·소품만 고칠 때는 get_map_region 으로 빈 땅을 찾아 더한다(기존 칸을 지우지 않는다). 거리를 통째로 다시 짜라는 요청이면 compose_modern_city_street({replace:true}).`
      : "modern_city 맵이 아직 없다 → create_map({name, width:60, height:48, tilesetId:\"modern_city\"}) 로 새 맵을 만든다. 지금 보는 맵이 다른 계열이면 실행기가 거부한다 — 그때는 칠하지 말고 ask_tileset_change(toTilesetId:\"modern_city\", reason) 로 견본을 보이고 이 턴을 끝낸다.";
  return [
    "[도쿄풍 도시 거리 — modern_city 칩셋] 이 요청의 칩셋은 번들 modern_city(계열 oprn-modern)다. jp_city 의 compose_jp_city_street·build_jp_city_building 과 버들항 author_beodeul_town 은 칸 번호 체계가 달라 쓰지 않는다.",
    where,
    "순서: compose_modern_city_street({mapId, seed}) 한 번으로 도로(6칸 폭, 노란 중앙선)·교차로(횡단보도·정지선)·보도·건물 키트(문 앞 접근칸)·가로수·가로등·차량을 깐다 → 결과 data.buildings 이름표(가게·사무실·병원·아파트…)를 보고 → 기획에 필요한 건물만 build_hand_interior_room({tileset:\"modern_city\", layout:{program}}) 실내 → link_modern_city_interior 로 문과 잇기 → check_reachability. "
      + "건물·소품을 더할 때는 list_tileset_objects({tilesetId:\"modern_city\"}) → stamp_tileset_object 로 키트째 찍는다(낱칸 번호로 칠하지 않는다).",
  ].join("\n");
}
