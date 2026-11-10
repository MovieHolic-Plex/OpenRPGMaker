// 테마 낱말 없는 「마을 만들어 줘」의 칩셋 후보 풀 — 게임마다 다른 칩셋 마을이 나오게 한다.
// 배경(2026-11-10 오너 「'마을' 을 만들라고하면 저 버들항 칩셋만 쓰는 이유가 뭐냐 ?」): 마을 안내·완료 검사가 author_beodeul_town 하나였고,
// 다른 칩셋은 테마 낱말(조선·사막·북방…)이 있어야만 정책이 잡아서, 낱말 없는 마을은 언제나 버들항이었다(쌍둥이 게임의 뿌리).
// 규칙: ① 테마 낱말(정책·마을 종류 표가 잡는 것)이 있으면 풀은 끼지 않는다 ② 사용자가 버들항을 말해도 풀은 끼지 않는다
// ③ 이미 지은(손댄) 야외 맵이 있는 프로젝트는 건드리지 않는다(게임 중간에 칩셋이 바뀌지 않게) ④ 고르기는 프로젝트 열쇠의 해시 — 같은 게임은 늘 같은 칩셋이다.
// 후보는 집 키트와 마을 시공 도구가 이미 있는 번들 칩셋뿐이다(새 그림 없음).

import type { Project } from "@/project/types";
import { isLivedMap } from "@/editor/tools/livedMap";
import { matchVillageType } from "./villageTypeCatalog";
import { withoutIntentNote } from "./piAgent/monsterGameRequest";

export interface VillagePoolEntry {
  readonly tilesetId: string;
  readonly ko: string;
  /** 모델 노트에 적는 시공 순서(맵 이름은 {name}, 씨앗은 {seed}). */
  readonly recipe: string;
  /** 이 후보의 시공 도구 — 첫 요청부터 스키마가 보이게 한다. */
  readonly tools: readonly string[];
    readonly v2Style: string;
}

export const VILLAGE_POOL: readonly VillagePoolEntry[] = [
  { tilesetId: "beodeul_city", ko: "버들항 중세 마을", recipe: "", tools: [], v2Style: "" },
  { tilesetId: "snow_north", ko: "북방 눈마을", v2Style: "pool:snow_north",
    recipe: "compose_snow_north_map({style:\"village\", newMap:{name:\"{name}\"}, seed:{seed}}) 한 번(크기는 주지 않는다)",
    tools: ["compose_snow_north_map", "check_reachability", "show_map_region", "set_start_position"] },
  { tilesetId: "sengoku_edo", ko: "에도 농촌 마을", v2Style: "pool:sengoku_edo",
    recipe: "create_map({name:\"{name}\", tilesetId:\"sengoku_edo\", width:54, height:42}) → compose_sengoku_edo_map({mapId, style:\"village\", seed:{seed}})",
    tools: ["create_map", "compose_sengoku_edo_map", "check_reachability", "show_map_region", "set_start_position"] },
  { tilesetId: "desert_east", ko: "오아시스 마을", v2Style: "pool:desert_east",
    recipe: "create_map({name:\"{name}\", tilesetId:\"desert_east\", width:48, height:36}) → compose_desert_east_map({mapId, kind:\"oasis\", seed:{seed}})",
    tools: ["create_map", "compose_desert_east_map", "check_reachability", "show_map_region", "set_start_position"] },
  { tilesetId: "pirate_isles", ko: "열대 섬 해변 마을", v2Style: "pool:pirate_isles",
    recipe: "create_map({name:\"{name}\", tilesetId:\"pirate_isles\", width:48, height:36}) → compose_pirate_isles_map({mapId, kind:\"beach\", seed:{seed}})",
    tools: ["create_map", "compose_pirate_isles_map", "check_reachability", "show_map_region", "set_start_position"] },
  { tilesetId: "joseon_baram", ko: "조선 마을 20호", v2Style: "pool:joseon_baram",
    recipe: "import_region_reference({id:\"joseon-v20-64x56\", name:\"{name}\"}) 한 번(맵째 가져온다) — 시작 칸은 가져온 맵의 길 위로 set_start_position",
    tools: ["import_region_reference", "list_spatial_designs", "check_reachability", "show_map_region", "set_start_position"] },
];

/** 칩셋·시대·지형·기후 낱말 — 하나라도 있으면 «테마 있는 요청»이라 풀을 끼지 않는다(정책·마을 종류 표·버들항 theme 인자가 맡는다). */
const THEME_WORD_RE = new RegExp([
  "버들\\s*항|beodeul", "조선|한양|사극|한옥|고려|삼국|일본|도쿄|에도|전국\\s*시대|사무라이|닌자|중국|무협|무림|로마|그리스|바이킹|북방|서양|중세|고딕|뱀파이어|드라큘라|해적|마법|호그와트|엘프|드워프|우주|사이버|스팀|SF|좀비|포스트|폐허|선사|원시|공룡|하늘\\s*섬|수중|해저",
  "눈|설원|겨울|얼음|빙|사막|오아시스|열대|늪|습지|화산|용암|정글|초원|숲|산골|산촌|산속|고원|언덕|절벽|계단식|다랑|협곡|섬|항구|포구|해안|바닷가|바다|어촌|강가|강변|하천|호수|호숫가|물가|강을|농촌|농가|시골|광산|포도|성벽|요새|성곽|도시|거리|상점가|캠퍼스|학교|역\\s*앞",
  "몬스터|포켓몬|체육관|연애|로맨스|호러|공포|추리|방탈출|\\b(?:snow|desert|island|harbou?r|port|river|forest|mountain|city|castle|japan|joseon|pirate|viking|medieval|roman|cyber|space)\\b",
].join("|"), "iu");
const VILLAGE_WORD_RE = /마을|촌락|부락|village|hamlet/iu;

/** 「마을 하나 만들어 줘」처럼 마을만 말하고 테마가 없는 요청인가. */
export function isBareVillageRequest(text: string | undefined): boolean {
  return !!text && VILLAGE_WORD_RE.test(text) && !THEME_WORD_RE.test(text);
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash >>> 0;
}

export interface VillagePoolPick {
  readonly entry: VillagePoolEntry;
  /** 프로젝트 열쇠에서 나온 시공 씨앗(1~9000) — 같은 게임은 같은 씨앗. */
  readonly seed: number;
}

/**
 * 테마 없는 마을 새로 짓기 요청이면 이 프로젝트의 칩셋 후보 하나를 고른다. 풀을 끼지 않을 때(열쇠 없음·테마 낱말·마을 종류 표가 잡는 요청·버들항 지목·풀 밖 칩셋으로 이미 손댄 맵·고른 것이 버들항)는 null —
 * 이미 풀 칩셋으로 손댄 맵이 있으면 그 칩셋을 이어 쓴다(한 게임 안에서 칩셋이 섞이지 않게).
 * 호출자는 종전 버들항 마을 경로를 그대로 쓴다. 후보는 프로젝트에 번들이 실제로 있는 것만 센다.
 */
export function pickVillageChipset(
  project: Pick<Project, "tilesets" | "maps">,
  projectKey: string | undefined,
  requestText: string | undefined,
): VillagePoolPick | null {
  if (!projectKey?.trim() || !isBareVillageRequest(requestText) || matchVillageType(requestText)) return null;
  const available = VILLAGE_POOL.filter((entry) => project.tilesets[entry.tilesetId]);
  if (available.length < 2) return null;
  const lived = Object.values(project.maps).filter((map) => isLivedMap(map));
  const hash = fnv1a(projectKey);
  if (lived.length) {
    const kept = available.find((entry) => entry.tilesetId !== "beodeul_city" && lived.some((map) => map.tilesetId === entry.tilesetId));
    return kept ? { entry: kept, seed: (hash >>> 8) % 9000 + 1 + lived.length } : null;
  }
  const entry = available[hash % available.length]!;
  if (entry.tilesetId === "beodeul_city") return null;
  return { entry, seed: (hash >>> 8) % 9000 + 1 };
}

export const VILLAGE_POOL_STYLE_PREFIX = "pool:";

export function villagePoolEntryByStyle(style: string | undefined): VillagePoolEntry | undefined {
  return style?.startsWith(VILLAGE_POOL_STYLE_PREFIX) ? VILLAGE_POOL.find((entry) => entry.v2Style === style) : undefined;
}

/**
 * v2 make_place 명세: 요청 문장이 테마 없는 마을이면 풀이 고른 칩셋을 style 로 박는다(씨앗은 hints.poolSeed).
 * 판정은 사용자 요청 문장만 본다 — 모델이 make_place 에 채운 style·theme(fantasy·river 같은 기본값)은 사용자 낱말이 아니라서 무시하고 덮는다
 * (2026-11-10 측정: 모델 3판이 모두 style:fantasy·theme:river 를 넣어 불러 풀이 0번 발동했다). 요청에 테마 낱말·버들항이 있으면 pickVillageChipset 이 null 이라 명세는 그대로다.
 * task 는 모델에 가는 문자열일 수 있어 의도 메모(시스템 지침 — author_beodeul_town 같은 낱말이 들어 있다)는 떼고 본다.
 */
export function localizeVillagePoolSpec<T extends { readonly type: string; readonly style?: string; readonly theme?: string; readonly hints?: Readonly<Record<string, unknown>> }>(
  spec: T,
  project: Pick<Project, "tilesets" | "maps">,
  projectKey: string | undefined,
  task: string | undefined,
): T {
  if (spec.type !== "village") return spec;
  const pick = pickVillageChipset(project, projectKey, task === undefined ? undefined : withoutIntentNote(task));
  if (!pick) return spec;
  return { ...spec, style: pick.entry.v2Style, hints: { ...(spec.hints ?? {}), poolSeed: pick.seed } };
}

/** 의도 노트 — 버들항 마을 노트 자리를 대신한다. */
export function formatVillagePoolNote(pick: VillagePoolPick, mapName = "마을"): string {
  const recipe = pick.entry.recipe.replace(/\{name\}/g, mapName).replace(/\{seed\}/g, String(pick.seed));
  return [
    `[마을 시공 — ${pick.entry.ko}] 테마를 말하지 않은 마을 요청이라 이 게임의 마을 칩셋은 ${pick.entry.tilesetId} 로 정해졌다(프로젝트마다 다르게 고른다). author_beodeul_town·author_village 는 이 요청에 쓰지 않는다.`,
    `시공: ${recipe}. 집·길·소품은 도구가 놓으니 손으로 다시 깔지 않는다. 지은 뒤 결과의 시작 칸을 set_start_position 으로 시작 위치에 쓰고(이미 지정했다고 나오면 생략), 빈 시작 맵은 도구가 정리한다.`,
    "사용자가 칩셋·테마를 따로 말했다면 그 말이 우선이다 — 이 노트는 낱말 없는 마을 요청에만 붙는다.",
  ].join("\n");
}
