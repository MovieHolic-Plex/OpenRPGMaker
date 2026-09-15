import { describe, expect, it } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { loadProjectFromSupabase, saveProjectToSupabase, type SupabaseProjectConfig } from "@/project/supabaseProjectSync";

declare const process: { readonly env: Record<string, string | undefined> };

const RESIDENT_IDS = ["char_mayor", "char_seed_merchant", "char_miner", "char_carpenter", "char_herbalist"] as const;

function envConfig(): SupabaseProjectConfig {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase env is missing");
  return {
    anonKey,
    projectId: process.env.OPRN_STARDEW_PROJECT_ID ?? "rpg-zzu-stardew-demo",
    url,
  };
}

const describeLive = process.env.OPRN_LIVE_SUPABASE_ROUNDTRIP === "1" ? describe : describe.skip;

describeLive("Stardew demo: Supabase 저장·재로드", () => {
  it("생활 콘텐츠의 전체 계약을 원격 왕복 뒤에도 보존한다", async () => {
    const config = envConfig();
    const saved = await saveProjectToSupabase(createFarmingDemoProject(), config);
    expect(saved.kind).toBe("saved");

    const restored = await loadProjectFromSupabase(config);
    expect(restored, "reloaded project should exist").toBeTruthy();
    expect(restored!.database.crops).toHaveLength(8);
    expect(restored!.system.giftSystem).toBe(true);
    expect(restored!.session.variables.var_stamina).toBe(100);
    expect(restored!.system.energy?.max).toBe(100);
    expect(restored!.system.shipping?.allowedItemIds?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(restored!.system.bundles?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(restored!.system.makers?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(restored!.database.lifeSkills).toHaveLength(5);

    const events = Object.values(restored!.maps).flatMap((map) => map.events);
    for (const residentId of RESIDENT_IDS) {
      const profile = restored!.characters?.[residentId];
      expect(profile?.birthday, `${residentId} birthday`).toBeTruthy();
      expect(profile?.giftPrefs?.loved?.length ?? 0, `${residentId} gift preferences`).toBeGreaterThan(0);
      expect(events.some((event) => event.characterId === residentId), `${residentId} map event`).toBe(true);
    }

    const mine = restored!.maps.map_mine_1f;
    expect(mine?.actionCombat).toBe(true);
    expect(mine?.fieldSpawns?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(new Set((mine?.fieldSpawns ?? []).map((spawn) => spawn.troopId)).size).toBeGreaterThanOrEqual(2);

    const itemIds = new Set(restored!.database.items.map((item) => item.id));
    const speciesIds = new Set((restored!.database.monsterSpecies ?? []).map((species) => species.id));
    for (const spawn of mine?.fieldSpawns ?? []) {
      const troop = restored!.database.troops.find((entry) => entry.id === spawn.troopId);
      expect(troop, `troop ${spawn.troopId}`).toBeTruthy();
      for (const enemyId of troop?.enemyIds ?? []) {
        const enemy = restored!.database.enemies.find((entry) => entry.id === enemyId);
        expect(speciesIds.has(enemy?.speciesId ?? ""), `${enemyId} species`).toBe(true);
        expect(itemIds.has(enemy?.rewards.dropItemId ?? ""), `${enemyId} drop item`).toBe(true);
        expect(enemy?.rewards.dropRatePercent ?? 0, `${enemyId} drop rate`).toBeGreaterThan(0);
      }
    }
  });
});
