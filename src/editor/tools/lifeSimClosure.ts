// 생활(농사·낚시·동물) 시스템이 닫혀 있는 동안(electron/shared/lifeSim.ts LIFE_SIM_ENABLED=false) 조수 경로를 막는 한 곳.
// 순수 모듈 — 도구 레지스트리·v2 도구 묶음·능력 색인·범용 기록 도구의 쓰기 거절이 같은 이름표·같은 깃발을 읽는다.
// 코드는 지우지 않았다: 깃발을 true 로 바꾸면 16개 도구가 레지스트리에 다시 실린다. 남긴 것은 아래 LIFE_SIM_KEPT_TOOL_NAMES.
import { LIFE_SIM_CLOSED_NOTICE, LIFE_SIM_ENABLED } from "../../../electron/shared/lifeSim";
import type { Project } from "@/project/types";

/** 닫을 도구 16개 — 농사·낚시·수집·동물·농장 건물·생활 경제 편집. */
export const LIFE_SIM_CLOSED_TOOL_NAMES: ReadonlySet<string> = new Set([
  "upsert_life_skill", "upsert_life_system", "upsert_tool_action", "configure_life_economy",
  "upsert_fish_species", "delete_fish_species", "configure_fishing", "configure_seasonal_forage", "configure_museum", "configure_collections",
  "upsert_farm_building_type", "upsert_home_decoration_type", "upsert_farm_animal_building", "set_session_farm_state",
  "create_farm_plot", "define_crop",
]);

/** 닫지 않고 남긴 것 — 제작법·강화·판매가(JRPG 상점·가방 「조합」·폴른 스타 공방이 쓴다)와 공포 장르의 목숨 꽃. */
export const LIFE_SIM_KEPT_TOOL_NAMES: readonly string[] = [
  "upsert_craft_recipe", "delete_craft_recipe", "upsert_item_upgrade", "set_sell_prices", "set_life_flower",
];

/** 생활 데이터를 담은 database 컬렉션 — 닫혀 있는 동안 조수의 쓰기는 거절하고 읽기는 허용한다. */
export const LIFE_SIM_RECORD_COLLECTIONS = [
  "crops", "lifeSkills", "farmAnimalSpecies", "fishSpecies", "farmBuildingTypes", "homeDecorationTypes",
] as const satisfies readonly (keyof Project["database"])[];

export function lifeSimToolClosed(name: string): boolean {
  return !LIFE_SIM_ENABLED && LIFE_SIM_CLOSED_TOOL_NAMES.has(name);
}

export function withoutClosedLifeTools<T extends { readonly name: string }>(tools: readonly T[]): readonly T[] {
  return LIFE_SIM_ENABLED ? tools : tools.filter((tool) => !LIFE_SIM_CLOSED_TOOL_NAMES.has(tool.name));
}

export function withoutClosedLifeToolNames(names: readonly string[]): readonly string[] {
  return LIFE_SIM_ENABLED ? names : names.filter((name) => !LIFE_SIM_CLOSED_TOOL_NAMES.has(name));
}

/** 이번 호출이 생활 컬렉션을 바꿨는가(before = 호출 전 프로젝트, after = 도구가 고친 draft). 바뀐 컬렉션 이름을 돌려준다. */
export function lifeRecordCollectionsChanged(before: Project, after: Project): string[] {
  const changed: string[] = [];
  for (const key of LIFE_SIM_RECORD_COLLECTIONS) {
    if (before.database[key] === after.database[key]) continue;
    if (JSON.stringify(before.database[key] ?? null) !== JSON.stringify(after.database[key] ?? null)) changed.push(key);
  }
  return changed;
}

export function lifeSimWriteRefusal(collections: readonly string[]): string {
  return `database.${collections.join(", ")} is life-sim data and the life-sim is closed in this version — the assistant cannot change it (reading is fine). `
    + `Tell the user: ${LIFE_SIM_CLOSED_NOTICE}`;
}

/** 농사·낚시를 말한 요청에만 싣는 한 장 — 닫힌 시스템을 손으로 흉내 내지 않고 한 문장으로 알리게 한다. */
export function lifeSimClosedCard(topics: readonly string[]): readonly string[] {
  if (LIFE_SIM_ENABLED || !topics.some((topic) => topic === "farm" || topic === "fishing")) return [];
  return [
    "[Farming / fishing / animals are closed in this version] Their tools are not offered and writes to crops, fish, farm animals, life skills, farm buildings and home decorations are refused. "
    + "Do not improvise a substitute (no hand-built plots, fake crops or fishing events). Say in one sentence that life-sim (농사·낚시·동물) opens in a later version and that the project's existing life data is untouched and keeps working in play; "
    + "offer crafting recipes (upsert_craft_recipe), item upgrades (upsert_item_upgrade) or sell prices (set_sell_prices) instead.",
  ];
}
