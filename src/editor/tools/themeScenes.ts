// editor/tools/themeScenes.ts
// 테마 장면 카탈로그 — 「어느 칩셋 테마가 어느 구성기 도구로 한 장을 통째로 깔리는가」의 한곳 정본(순수 데이터).
//
// 2026-10-15 FF6 감사 #35(막힘 1위): 역할극 2·3회차 필드 맵 7장이 전부 단색 잔디였다. 조수가 create_map 만 부르고 테마 구성기
// (compose_snow_north_map 등 12개)를 못 찾았기 때문이다. 이 표는 세 곳이 같이 쓴다.
//   1. create_map 의 `themeScene` 인자 — 빈 맵을 만들고 곧바로 그 구성기를 불러 한 호출로 채운다.
//   2. create_map 결과·show_map_region 의 「빈 맵」 안내(mapEmptiness.ts) — 다음에 부를 도구를 구체 이름·인자로 말한다.
//   3. check_map_emptiness 도구와 완료 가드.
// 새 테마 구성기를 만들면 여기 한 줄을 더한다. 도구 이름은 레지스트리에 실제로 있어야 한다(없으면 create_map 이 거절한다).

export interface ThemeScene {
  readonly id: string;
  readonly label: string;
  /** 이 장면이 쓰는 칩셋. 프로젝트에 없으면 create_map 이 거절한다. */
  readonly tilesetId: string;
  readonly tool: string;
  /** 구성기에서 스타일을 받는 인자 이름(style·kind·space·place·theme·type). 없으면 스타일이 없다. */
  readonly styleParam?: "style" | "kind" | "space" | "place" | "theme" | "type";
  readonly styles?: readonly string[];
  readonly defaultStyle?: string;
  /** 이 장면의 한 줄 설명(오류·색인에 쓴다). */
  readonly about: string;
  /** 맵 이름·요청 낱말(소문자)에 들면 이 장면을 권한다. */
  readonly keywords: readonly string[];
  /** 구성기에 더 넘길 고정 인자(맵 크기를 받아 쓰는 도구용). */
  readonly extraArgs?: (map: { readonly width: number; readonly height: number }) => Record<string, unknown>;
}

import { flavorFromText } from "@/project/jpShitamachiStreet";
import type { Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const BEODEUL_TILESET_ID = "beodeul_city";

export const THEME_SCENES: readonly ThemeScene[] = [
  { id: "snow_north", label: "북방 설원", tilesetId: "snow_north", tool: "compose_snow_north_map", styleParam: "style", styles: ["village", "lake", "cave", "market"], defaultStyle: "village",
    about: "눈 덮인 마을·얼음 호수·얼음 동굴 입구·겨울 장터", keywords: ["눈", "설원", "북방", "설산", "겨울", "snow", "north", "frozen", "ice", "얼음"] },
  { id: "desert_east", label: "사막·동방", tilesetId: "desert_east", tool: "compose_desert_east_map", styleParam: "kind", styles: ["oasis", "bazaar", "palace", "pyramid", "caravanserai"], defaultStyle: "oasis",
    about: "오아시스·바자르·궁전·피라미드·대상 숙소", keywords: ["사막", "오아시스", "바자르", "피라미드", "desert", "oasis", "bazaar", "실크로드"] },
  { id: "steampunk_city", label: "증기 도시", tilesetId: "steampunk_city", tool: "compose_steampunk_city_map", styleParam: "style", styles: ["street", "industrial", "dock"], defaultStyle: "street",
    about: "증기 기관 도시 거리·공업 지구·부두", keywords: ["증기", "스팀펑크", "기계 도시", "제국", "공업", "steampunk", "industrial", "마기텍", "철도"] },
  { id: "sky_island", label: "천공섬", tilesetId: "sky_island", tool: "compose_sky_island_map", styleParam: "style", styles: ["village", "shrine", "dock", "archipelago"], defaultStyle: "village",
    about: "공중 마을·신전·비행선 부두·군도", keywords: ["천공", "하늘", "공중", "비공정", "sky", "floating"] },
  { id: "prehistoric", label: "선사 시대", tilesetId: "prehistoric", tool: "compose_prehistoric_map", styleParam: "style", styles: ["village", "swamp", "volcano", "fossil"], defaultStyle: "village",
    about: "원시 마을·늪·화산·화석 지대", keywords: ["선사", "원시", "공룡", "석기", "prehistoric", "stone age"] },
  { id: "pirate_isles", label: "해적 섬", tilesetId: "pirate_isles", tool: "compose_pirate_isles_map", styleParam: "kind", styles: ["harbor", "beach", "fort", "wreck"], defaultStyle: "harbor",
    about: "해적 항구·해변·요새·난파선", keywords: ["해적", "항구", "선원", "pirate", "harbor", "난파"] },
  { id: "sengoku_edo", label: "센고쿠·에도", tilesetId: "sengoku_edo", tool: "compose_sengoku_edo_map", styleParam: "style", styles: ["castle_town", "inn_street", "samurai", "castle", "temple", "village"], defaultStyle: "castle_town",
    about: "성하 마을·여관 거리·무사 저택·성·절·마을", keywords: ["센고쿠", "에도", "사무라이", "무사", "닌자", "sengoku", "edo", "samurai"] },
  { id: "sf_station", label: "SF 정거장", tilesetId: "sf_station", tool: "compose_sf_station_map", styleParam: "kind", styles: ["station", "street", "lab", "moonbase"], defaultStyle: "station",
    about: "우주 정거장·거리·연구소·달 기지", keywords: ["우주", "정거장", "sf", "sci-fi", "station", "moonbase", "달 기지"] },
  { id: "modern_city", label: "현대 도시 거리", tilesetId: "modern_city", tool: "compose_modern_city_street",
    about: "현대 도시 상점 거리", keywords: ["현대", "도심", "modern", "city street", "빌딩"] },
  { id: "campus", label: "캠퍼스", tilesetId: "modern_campus", tool: "compose_campus_grounds", styleParam: "style", styles: ["school", "university"], defaultStyle: "school",
    about: "학교·대학 캠퍼스 부지", keywords: ["캠퍼스", "학교", "대학", "campus", "school", "university"] },
  { id: "jp_city", label: "일본 상점가", tilesetId: "jp_city", tool: "compose_jp_city_street", styleParam: "style", styles: ["shopping", "residential", "shitamachi", "shotengai"], defaultStyle: "shopping",
    about: "일본 상점가·주택가 거리 · shitamachi = 시타마치 상점가 골목 · shotengai = 쇼텐가이 아케이드 상가", keywords: ["일본", "상점가", "주택가", "골목", "시장", "아케이드", "시타마치", "jp", "japan", "shotengai", "shitamachi"] },
  { id: "wizarding", label: "마법 학교", tilesetId: "wizarding_world", tool: "build_wizarding_space", styleParam: "space",
    styles: ["shared", "owlery", "potions", "clocktower", "postoffice", "wandshop", "library", "greenhouse", "infirmary", "honeydukes", "carriage", "quidditch", "boathouse"], defaultStyle: "shared",
    about: "마법 학교 공간(13종)", keywords: ["마법학교", "마법 학교", "호그와트", "wizarding", "hogwarts"] },
  { id: "gothic", label: "고딕 저택", tilesetId: "gothic_manor", tool: "build_gothic_place", styleParam: "place",
    styles: ["manor-grounds", "graveyard", "gallery-plaza", "hall", "library", "bedroom", "kitchen", "cellar", "chapel", "crypt", "gallery"], defaultStyle: "manor-grounds",
    about: "고딕 저택 마당·묘지·실내", keywords: ["고딕", "저택", "묘지", "유령", "gothic", "manor", "graveyard"] },
  { id: "beodeul_town", label: "버들항 마을·도시", tilesetId: BEODEUL_TILESET_ID, tool: "author_beodeul_town", styleParam: "theme", styles: ["river", "coast", "desert", "snow", "swamp", "city"], defaultStyle: "river",
    about: "버들항 칩셋의 마을(강가·포구·사막·설원·늪)·로마풍 도시", keywords: ["마을", "촌", "도시", "항구", "village", "town", "hamlet", "city"] },
  { id: "beodeul_dungeon", label: "버들항 던전", tilesetId: BEODEUL_TILESET_ID, tool: "author_dungeon", styleParam: "type", styles: ["catacomb", "castle", "labyrinth", "sewer", "cave", "temple", "mine", "volcano", "ice"], defaultStyle: "cave",
    about: "버들항 칩셋의 던전(동굴·광산·미궁·지하묘지·하수도…)", keywords: ["던전", "동굴", "광산", "미궁", "지하", "탑", "dungeon", "cave", "mine", "labyrinth"] },
  { id: "beodeul_field", label: "버들항 필드(길·숲)", tilesetId: BEODEUL_TILESET_ID, tool: "author_wild_route",
    about: "버들항 칩셋의 야외 필드 — 출구에서 출구로 이어지는 흙길·양옆 숲(나무 밑 짙은 풀), 몬스터 수집 게임이면 조우 풀숲(남쪽→북쪽 기본)", keywords: ["필드", "들판", "평원", "길", "도로", "숲", "진군", "field", "route", "road", "plain"],
    extraArgs: (map) => ({ exits: [{ x: Math.floor(map.width / 2), y: map.height - 1 }, { x: Math.floor(map.width / 2), y: 0 }] }) },
];

// toolRegistry 가 이 파일을 불러오는 도구들을 모으므로 레지스트리를 직접 import 하면 순환이다 — 레지스트리가 만들어진 뒤 조회 함수를 꽂는다.
let lookup: (name: string) => ToolDefinition | undefined = () => undefined;
export function bindThemeToolLookup(fn: (name: string) => ToolDefinition | undefined): void { lookup = fn; }
export function themeSceneTool(scene: ThemeScene): ToolDefinition | undefined { return lookup(scene.tool); }

/** 구성기가 맵을 스스로 만드는 장면(마법 학교·고딕·버들항 마을·던전) — 칩셋·맵 트리·BGM 은 구성기가 create_map 으로 처리하므로 미리 맵을 만들지 않는다. */
export function sceneBuildsOwnMap(scene: ThemeScene): boolean {
  return scene.tool === "build_wizarding_space" || scene.tool === "build_gothic_place" || scene.tool === "author_beodeul_town" || scene.tool === "author_dungeon";
}

const SIZES: Readonly<Record<string, Readonly<Record<string, readonly [number, number]>>>> = {
  snow_north: { village: [46, 36], lake: [42, 32], cave: [38, 30], market: [42, 32] },
  desert_east: { oasis: [44, 36], bazaar: [46, 34], palace: [48, 40], pyramid: [48, 38], caravanserai: [40, 34] },
  steampunk_city: { street: [48, 34], industrial: [52, 40], dock: [48, 34] },
  sky_island: { village: [50, 34], shrine: [46, 40], dock: [52, 30], archipelago: [54, 42] },
  prehistoric: { village: [48, 36], swamp: [44, 34], volcano: [44, 34], fossil: [46, 34] },
  pirate_isles: { harbor: [56, 40], beach: [52, 40], fort: [48, 40], wreck: [46, 36] },
  sengoku_edo: { castle_town: [56, 48], inn_street: [56, 40], samurai: [52, 36], castle: [44, 38], temple: [54, 38], village: [54, 42] },
  sf_station: { station: [44, 32], street: [48, 30], lab: [40, 30], moonbase: [48, 32] },
  campus: { school: [52, 40], university: [56, 44] },
  jp_city: { shopping: [48, 32], residential: [48, 32], shitamachi: [52, 34], shotengai: [52, 34] },
  beodeul_town: { river: [56, 44], coast: [56, 44], desert: [56, 44], snow: [56, 44], swamp: [56, 44], city: [60, 60] },
};

/** themeScene 으로 맵을 만들 때 width·height 를 생략하면 쓰는 크기(구성기의 기본·권장 크기). */
export function themeSceneDefaultSize(scene: ThemeScene, style: string | undefined): { width: number; height: number } {
  const hit = SIZES[scene.id]?.[style ?? scene.defaultStyle ?? ""];
  if (hit) return { width: hit[0], height: hit[1] };
  if (scene.id === "modern_city") return { width: 60, height: 48 };
  if (scene.id === "beodeul_field") return { width: 30, height: 40 };
  return { width: 24, height: 24 };   // 던전·마법 학교·고딕 — 구성기가 맵을 방 배치 크기로 늘린다
}

export function themeSceneById(id: string): ThemeScene | undefined {
  return THEME_SCENES.find((scene) => scene.id === id);
}

/** 「scene」 또는 「scene:style」 을 풀어 장면과 스타일을 돌려준다. 모르는 장면·스타일이면 사유 문자열. */
export function parseThemeScene(value: string): { readonly scene: ThemeScene; readonly style: string | undefined } | { readonly error: string } {
  const [sceneId, ...rest] = value.trim().split(":");
  const style = rest.join(":").trim() || undefined;
  const scene = themeSceneById((sceneId ?? "").trim().replace(/-/gu, "_"));
  if (!scene) {
    return { error: `알 수 없는 themeScene '${value}'. 쓸 수 있는 장면: ${THEME_SCENES.map((entry) => `${entry.id}${entry.styles ? `(${entry.styles.slice(0, 6).join("|")}${entry.styles.length > 6 ? "|…" : ""})` : ""}`).join(", ")}` };
  }
  if (style !== undefined && scene.styles && !scene.styles.includes(style)) {
    return { error: `themeScene '${scene.id}' 의 스타일은 ${scene.styles.join("|")} 중 하나입니다(받은 값: ${style}). 예: "${scene.id}:${scene.defaultStyle ?? scene.styles[0]}"` };
  }
  if (style !== undefined && !scene.styles) {
    return { error: `themeScene '${scene.id}' 는 스타일이 없습니다 — "${scene.id}" 만 쓰세요.` };
  }
  return { scene, style: style ?? scene.defaultStyle };
}

/** 구성기 도구에 넘길 인자(맵 id·스타일·씨앗 + 장면 고정 인자). */
export function themeSceneToolArgs(scene: ThemeScene, style: string | undefined, mapId: string, map: { readonly width: number; readonly height: number }, seed: number | undefined): Record<string, unknown> {
  const args: Record<string, unknown> = { mapId };
  if (scene.styleParam && style !== undefined) args[scene.styleParam] = style;
  if (seed !== undefined && scene.tool !== "build_wizarding_space" && scene.tool !== "compose_modern_city_street") args.seed = seed;
  Object.assign(args, scene.extraArgs?.(map) ?? {});
  return args;
}

export interface ThemedMapRequest {
  readonly name: string;
  readonly id?: string;
  readonly width?: number;
  readonly height?: number;
  readonly seed?: number;
  readonly style?: string;
}

type CreateMapRun = (draft: Project, args: Record<string, unknown>) => ToolExecResult;

/**
 * create_map({themeScene}) 의 본체 — 맵을 만들고(구성기가 스스로 만드는 장면은 구성기에 맡기고) 그 칩셋의 구성기를 한 번에 부른다.
 * 어느 단계든 던지면 호출 전체가 버려진다(러너가 draft 를 버린다) — 반쯤 칠한 맵이 남지 않는다.
 */
export function runThemedMap(draft: Project, scene: ThemeScene, request: ThemedMapRequest, createMapRun: CreateMapRun): ToolExecResult {
  const tool = themeSceneTool(scene);
  if (!tool) throw new ToolError(`themeScene '${scene.id}' 의 구성기 ${scene.tool} 를 레지스트리에서 찾지 못했습니다 — create_map 만 쓰고 find_tools({query:"${scene.tool}"}) 로 직접 찾으세요.`, { code: "theme-tool-missing" });
  if (!draft.tilesets[scene.tilesetId] && !sceneBuildsOwnMap(scene)) {
    throw new ToolError(`themeScene '${scene.id}' 는 칩셋 '${scene.tilesetId}' 이 필요한데 이 프로젝트에 없습니다 — 프로젝트의 타일셋(get_project_summary)에서 쓸 수 있는 장면을 고르거나, themeScene 없이 create_map 으로 만든 뒤 다른 칩셋 구성기를 쓰세요.`, { code: "tileset-not-found" });
  }
  // 일본 거리: 스타일을 안 주면 맵 이름의 낱말(골목·상점가·시장·아케이드·일본 거리)로 시타마치·쇼텐가이 변형을 고른다.
  const style = request.style ?? (scene.id === "jp_city" ? flavorFromText(request.name) : undefined) ?? scene.defaultStyle;
  const size = themeSceneDefaultSize(scene, style);
  const width = request.width ?? size.width;
  const height = request.height ?? size.height;
  let mapId = request.id ?? "";
  let createdSummary = "";
  let composerArgs: Record<string, unknown>;
  if (sceneBuildsOwnMap(scene)) {
    composerArgs = { name: request.name };
    if (scene.styleParam && style !== undefined) composerArgs[scene.styleParam] = style;
    if (request.seed !== undefined) composerArgs.seed = request.seed;
    if (request.width !== undefined) composerArgs.width = request.width;
    if (request.height !== undefined) composerArgs.height = request.height;
    if (request.id) composerArgs[scene.tool === "build_wizarding_space" || scene.tool === "build_gothic_place" ? "mapId" : "id"] = request.id;
  } else {
    const created = createMapRun(draft, { name: request.name, width, height, tilesetId: scene.tilesetId, ...(request.id ? { id: request.id } : {}), ...(request.seed !== undefined ? { seed: request.seed } : {}) });
    mapId = (created.data as { mapId?: string } | undefined)?.mapId ?? mapId;
    if (!mapId || !draft.maps[mapId]) throw new ToolError("themeScene 맵 생성에 실패했습니다.", { code: "create-map-failed" });
    createdSummary = created.summary;
    composerArgs = themeSceneToolArgs(scene, style, mapId, { width, height }, request.seed);
  }
  const result = tool.run(draft, composerArgs);
  const composerData = (result.data ?? {}) as { mapId?: string };
  mapId = composerData.mapId ?? mapId;
  // 맵 성격을 명시한다 — 이름으로 추정하면 「방어전」의 「방」이 실내로 읽혀 필드 적을 거절했다(2026-10-15 역할극). 저작자가 이미 고른 값은 그대로 둔다.
  const built = draft.maps[mapId];
  const role = themeSceneMapRole(scene, style);
  if (built && role && built.mapRole === undefined) built.mapRole = role;
  const warnings = [...(result.warnings ?? [])];
  return {
    summary: `${createdSummary ? `${createdSummary} → ` : ""}themeScene '${scene.id}${style && scene.styles ? `:${style}` : ""}'(${scene.label}) 로 ${scene.tool} 까지 한 번에 지었다 — ${result.summary}`,
    data: { mapId, themeScene: scene.id, ...(style !== undefined ? { style } : {}), composer: scene.tool, result: result.data },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

const DUNGEON_STYLES: ReadonlySet<string> = new Set(["cave", "mine", "labyrinth", "catacomb", "sewer", "crypt", "cellar", "volcano_cave"]);
const TOWN_STYLES: ReadonlySet<string> = new Set(["village", "market", "shopping", "residential", "shitamachi", "shotengai", "castle_town", "inn_street", "bazaar", "harbor", "street", "city"]);

/** 장면 종류에서 분명한 맵 성격만 돌려준다(애매하면 undefined — 이름 추정에 맡긴다). */
export function themeSceneMapRole(scene: ThemeScene, style: string | undefined): "town" | "dungeon" | undefined {
  if (scene.id === "beodeul_dungeon" || (style !== undefined && DUNGEON_STYLES.has(style))) return "dungeon";
  if (scene.id === "beodeul_town" && style === "city") return "town";
  if (style !== undefined && TOWN_STYLES.has(style)) return "town";
  return undefined;
}

/** 한눈에 보는 목록 한 줄씩 — create_map 도구 설명·오류·색인에 쓴다. */
export function themeSceneCatalogLines(): string[] {
  return THEME_SCENES.map((scene) => `${scene.id}${scene.styles ? `:{${scene.styles.slice(0, 5).join("|")}${scene.styles.length > 5 ? "|…" : ""}}` : ""} = ${scene.label} → ${scene.tool}`);
}
