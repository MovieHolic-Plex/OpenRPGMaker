// 생활(농사·낚시·동물) 시스템이 닫혀 있는 동안(electron/shared/lifeSim.ts LIFE_SIM_ENABLED=false) 조수 도구 목록의 계약.
// 닫을 16개는 레지스트리에서 빠지고, JRPG 상점·가방 「조합」·폴른 스타 공방이 쓰는 제작법·강화·판매가와 공포 장르의 목숨 꽃은 남는다.
// 목록은 소스의 집합을 읽지 않고 여기에 적는다 — 소스가 슬그머니 바뀌어도 이 시험이 잡는다.

import { describe, expect, it } from "vitest";
import { allTools } from "@/editor/tools";

const CLOSED = [
  "upsert_life_skill", "upsert_life_system", "upsert_tool_action", "configure_life_economy",
  "upsert_fish_species", "delete_fish_species", "configure_fishing", "configure_seasonal_forage", "configure_museum", "configure_collections",
  "upsert_farm_building_type", "upsert_home_decoration_type", "upsert_farm_animal_building", "set_session_farm_state",
  "create_farm_plot", "define_crop",
];
const KEPT = ["upsert_craft_recipe", "delete_craft_recipe", "upsert_item_upgrade", "set_sell_prices", "set_life_flower"];

describe("생활 시스템 닫힘 — 도구 레지스트리", () => {
  it("allTools() 이름에 닫을 16개는 0개이고 남길 5개는 모두 있다", () => {
    const names = new Set(allTools().map((tool) => tool.name));
    expect(CLOSED).toHaveLength(16);
    expect(CLOSED.filter((name) => names.has(name))).toEqual([]);
    expect(KEPT.filter((name) => !names.has(name))).toEqual([]);
  });
});
