// 포켓몬풍 오버월드 큐레이션 팔레트 프리셋 (배치 5, 독립).
//
// combined_town(CC0 JasonPerry / finalbossblues, ATTRIBUTION.md) 위에 이미 존재하는 번들 하네스
// 그룹을 "포켓몬 오버월드 role"별로 한 벌로 묶어 노출한다. AI가 "포켓몬 마을/루트 깔아줘"를 받으면
// 이 프리셋의 role → group id 를 그대로 기존 시공 프리미티브(fill_region / lay_path / place_props /
// build_wall·build_roof·place_door·place_window)에 넣어 바로 배치할 수 있다.
//
// 원칙:
// - 신규 에셋 0. 전부 기존 vendored CC0 타일 재사용(외부 다운로드·GBA 립 금지).
// - 신규 도구 0. 기존 시공 프리미티브가 group id 를 소비한다.
// - 통행성/레이어는 기존 semantics·하네스가 결정한다. 조우(인카운터)는 사냥터/조우표로 별도
//   배선하며 타일 자체엔 로직을 넣지 않는다(키큰 풀도 통행 가능).
// - 참조하는 group id 는 전부 source:"bundled-default" 번들 그룹이라 isTrustedGroupSource 로
//   승인 취급된다(2026-07-11 vocab 개편 관례와 정합).

import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { CHIPSET_TILE_GROUPS } from "./chipsetMapping";
import { COMBINED_TOWN_TILESET_ID, TILE } from "./constants";

/** 이 role 을 소비하는 기존 시공 프리미티브(신규 도구 아님). 첫 항목이 권장 도구. */
export type PokemonPresetTool =
  | "fill_region"
  | "lay_path"
  | "place_props"
  | "build_wall"
  | "build_roof"
  | "place_door"
  | "place_window";

export interface PokemonPresetRole {
  /** 머신 키(안정 식별자). */
  readonly role: string;
  /** 사람이 읽는 한국어 라벨. */
  readonly label: string;
  /** AI 배치 안내(한국어). */
  readonly summary: string;
  /** 이 role 을 소비하는 기존 도구(첫 항목이 권장 도구). */
  readonly tools: readonly PokemonPresetTool[];
  /** 기존 번들 하네스 그룹 id(source:"bundled-default"). 시공 프리미티브의 *VocabId 인자로 그대로 사용. */
  readonly groupIds: readonly string[];
  /** 대표 타일 인덱스(참고·미리보기용). */
  readonly representativeTileIds: readonly number[];
}

export interface PokemonChipsetPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** 이 프리셋이 겨냥하는 번들 타일셋 id. */
  readonly tilesetId: string;
  readonly roles: readonly PokemonPresetRole[];
}

const H = COMBINED_TOWN_HARNESS_PREFIX;

const POKEMON_OVERWORLD_ROLES: readonly PokemonPresetRole[] = [
  {
    role: "grass_field",
    label: "잔디 벌판",
    summary: "오버월드 기본 바닥. fill_region 으로 넓게 깔고 그 위에 흙길·키큰 풀·소품을 얹는다.",
    tools: ["fill_region"],
    groupIds: [`${H}grass-autotile`],
    representativeTileIds: [TILE.GRASS],
  },
  {
    role: "tall_grass",
    label: "키큰 풀(인카운터 풀숲)",
    summary:
      "포켓몬풍 조우 풀밭. 잔디 위에 fill_region 으로 짙은 풀 구역을 깐다(원형/타원은 shape=circle/ellipse). " +
      "통행 가능 — 실제 조우는 make_hunting_ground/set_encounter_table 로 별도 배선하며 타일 자체엔 로직이 없다. " +
      "듬성듬성 클럼프가 필요하면 place_props 로 흩뿌린다.",
    tools: ["fill_region", "place_props"],
    groupIds: [`${H}tall-grass-autotile`],
    representativeTileIds: [TILE.DARK_GRASS],
  },
  {
    role: "dirt_route",
    label: "흙길 루트",
    summary:
      "마을과 마을을 잇는 루트. lay_path 로 경유점을 이으면 외곽·모서리가 오토타일로 자동 정리된다. " +
      "너른 광장/공터는 fill_region 으로 면 채움.",
    tools: ["lay_path", "fill_region"],
    groupIds: [`${H}dirt-road-autotile`],
    representativeTileIds: [...CHIPSET_TILE_GROUPS.dirtRoadBody],
  },
  {
    role: "water",
    label: "물(호수·강·연못)",
    summary: "fill_region 으로 수역을 채운다. 둥근 연못/호수는 shape=circle, 타원 호수는 shape=ellipse. 통행 불가.",
    tools: ["fill_region"],
    groupIds: [`${H}lake-water-autotile`],
    representativeTileIds: [TILE.WATER],
  },
  {
    role: "trees",
    label: "나무(숲)",
    summary:
      "루트 경계와 숲을 만드는 나무. place_props 로 area 에 자연 산포한다(침엽수·마른나무는 세로 2칸, 활엽수는 2x2). " +
      "덤불은 낮은 관목 채움용.",
    tools: ["place_props"],
    groupIds: [`${H}conifer-tree`, `${H}dry-tree`, `${H}broadleaf-tree-2x2`, `${H}bush-props`],
    representativeTileIds: [TILE.TREE],
  },
  {
    role: "flowers",
    label: "꽃",
    summary: "통행 가능한 투명 자연 소품. place_props 로 흩뿌려 지면을 보존한 채 색을 더한다.",
    tools: ["place_props"],
    groupIds: [`${H}flower-props`],
    representativeTileIds: [...CHIPSET_TILE_GROUPS.flowerObjects],
  },
  {
    role: "village_buildings",
    label: "마을 건물",
    summary:
      "포켓몬 마을 집. build_wall 로 벽(회벽/통나무/목골석벽)을 세우고 → place_door/place_window 로 문·창을 → " +
      "build_roof 로 사선 지붕을 얹는다. 나무 문(1×2)은 wood-door 그룹.",
    tools: ["build_wall", "build_roof", "place_door", "place_window"],
    groupIds: [
      `${H}plaster-wall-9slice`,
      `${H}wood-wall-9slice`,
      `${H}timber-stone-wall-9slice`,
      `${H}roof-body`,
      `${H}roof-overlays`,
      `${H}doors`,
      `${H}wood-door`,
      `${H}windows`,
    ],
    representativeTileIds: [15, 102, 374],
  },
];

/** 포켓몬풍 오버월드+루트 저작용 큐레이션 프리셋(신규 에셋 0). */
export const POKEMON_OVERWORLD_PRESET: PokemonChipsetPreset = {
  id: "pkmn_overworld",
  name: "포켓몬풍 오버월드",
  description:
    "combined_town(CC0) 타일을 포켓몬 오버월드 role별로 묶은 큐레이션 프리셋. 잔디·키큰 풀·흙길 루트·물·" +
    "나무·꽃·마을 건물을 기존 시공 프리미티브에 바로 넣을 group id 로 노출한다.",
  tilesetId: COMBINED_TOWN_TILESET_ID,
  roles: POKEMON_OVERWORLD_ROLES,
};

/** role 키로 프리셋 항목을 조회한다. */
export function pokemonPresetRole(role: string): PokemonPresetRole | undefined {
  return POKEMON_OVERWORLD_PRESET.roles.find((entry) => entry.role === role);
}

/** 프리셋이 참조하는 모든 번들 그룹 id(중복 제거). 무결성 검증·발견성에 쓴다. */
export function pokemonPresetGroupIds(): readonly string[] {
  return [...new Set(POKEMON_OVERWORLD_PRESET.roles.flatMap((entry) => entry.groupIds))];
}

/** 사람이 읽는 role 목록(role→라벨). UI/프롬프트 노출용. */
export function pokemonPresetRoleLabels(): readonly { readonly role: string; readonly label: string }[] {
  return POKEMON_OVERWORLD_PRESET.roles.map((entry) => ({ role: entry.role, label: entry.label }));
}
