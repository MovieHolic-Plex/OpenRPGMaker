import { describe, expect, it } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { loadProjectFromSupabase, saveProjectToSupabase, type SupabaseProjectConfig } from "@/project/supabaseProjectSync";

declare const process: { readonly env: Record<string, string | undefined> };

function envConfig(): SupabaseProjectConfig {
  const url = process.env.VITE_SUPABASE_URL;
  const projectId = process.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !projectId || !anonKey) throw new Error("Supabase env is missing");
  return { anonKey, projectId, url };
}

const describeLive = process.env.RPG_ZZU_LIVE_SUPABASE_ROUNDTRIP === "1" ? describe : describe.skip;

describeLive("Stardew demo: Supabase 저장 + 재로드 검증", () => {
  it("파밍 데모(작물 8종 + 에너지 변수 + 상인/침대 이벤트)를 저장하고 재로드한다", async () => {
    const config = envConfig();

    // 1. 파밍 데모 프로젝트 생성
    const project = createFarmingDemoProject();

    // 2. Supabase에 저장
    const result = await saveProjectToSupabase(project, config);
    expect(result.kind).toBe("saved");
    console.log("[Supabase] saved project:", config.projectId, "sha256:", (result as { sha256?: string }).sha256);

    // 3. 재로드
    const restored = await loadProjectFromSupabase(config);
    expect(restored, "reloaded project should exist").toBeTruthy();

    // 4. 작물 검증 (8종: 봄 4 + 여름 2 + 가을 2)
    const crops = restored!.database.crops ?? [];
    expect(crops.length).toBe(8);
    expect(crops.find((c) => c.id === "crop_blueberry")).toBeTruthy();
    expect(crops.find((c) => c.id === "crop_melon")).toBeTruthy();
    expect(crops.find((c) => c.id === "crop_pumpkin")).toBeTruthy();
    expect(crops.find((c) => c.id === "crop_eggplant")).toBeTruthy();

    // 5. 에너지 변수 검증
    expect(restored!.variables.find((v) => v.id === "var_stamina")).toBeTruthy();
    expect(restored!.session.variables.var_stamina).toBe(100);

    // 6. 공통 이벤트 검증
    expect(restored!.commonEvents.find((e) => e.id === "ce_stamina_decrease")).toBeTruthy();
    expect(restored!.commonEvents.find((e) => e.id === "ce_stamina_recover")).toBeTruthy();

    // 7. 맵 이벤트 검증 (씨앗 상인 + 침대)
    const map = restored!.maps[restored!.startMapId];
    expect(map).toBeTruthy();
    const events = map?.events ?? [];
    expect(events.find((e) => e.id === "ev_seed_shop")).toBeTruthy();
    expect(events.find((e) => e.id === "ev_bed")).toBeTruthy();

    console.log("[Supabase] reload verified: 8 crops, var_stamina, 2 common events, 2 map events");
  });

  it("Phase 2: 광산 맵 + NPC 하트 + 축제 이벤트가 저장·재로드된다", async () => {
    const config = envConfig();
    const project = createFarmingDemoProject();
    const result = await saveProjectToSupabase(project, config);
    expect(result.kind).toBe("saved");

    const restored = await loadProjectFromSupabase(config);
    expect(restored).toBeTruthy();

    // 광산 맵
    const mineMap = restored!.maps["map_mine_1f"];
    expect(mineMap, "map_mine_1f should survive roundtrip").toBeTruthy();
    expect(mineMap?.actionCombat).toBe(true);
    expect(mineMap?.fieldSpawns?.length ?? 0).toBeGreaterThan(0);

    // 광산 출구 이벤트
    const mineExit = mineMap?.events.find((e) => e.id === "ev_mine_exit");
    expect(mineExit, "ev_mine_exit should survive roundtrip").toBeTruthy();

    // 농장 맵의 광산 입구 + NPC + 축제
    const farmMap = restored!.maps[restored!.startMapId];
    expect(farmMap?.events.find((e) => e.id === "ev_mine_entrance")).toBeTruthy();
    expect(farmMap?.events.find((e) => e.id === "ev_npc_mayor")).toBeTruthy();
    expect(farmMap?.events.find((e) => e.id === "ev_festival_spring")).toBeTruthy();

    // 돌 placeable
    const rocks = Object.entries(restored!.session.placeables ?? {}).filter(([, p]) => p.kind === "rock");
    expect(rocks.length).toBeGreaterThanOrEqual(2);

    // 곡괭이
    expect(restored!.database.items.find((i) => i.id === "item_pickaxe")).toBeTruthy();

    // 축제 스위치
    expect(restored!.switches.find((s) => s.id === "sw_festival_spring_done")).toBeTruthy();

    console.log("[Supabase] Phase 2 verified: mine map, NPC heart, festival, placeables, pickaxe");
  });
});
