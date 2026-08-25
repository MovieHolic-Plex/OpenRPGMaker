import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";

export function p2LifeProject() {
  const project = createBlankProject();
  const add = (id: string, price: number) => project.database.items.push(normalizeItemRecord({ id, name: id, scope: "none", price }));
  add("item_trout", 80);
  add("item_berry", 20);
  add("item_reward", 5);
  project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
  project.system.energy = { max: 20, initial: 10, restorePerDay: 5 };
  project.system.skillSystem = { enabled: true };
  project.database.lifeSkills = [
    { id: "life_fishing", name: "Fishing", skillType: "fishing", maxLevel: 10, levelUpRewards: [] },
    { id: "life_foraging", name: "Foraging", skillType: "foraging", maxLevel: 10, levelUpRewards: [] },
  ];
  project.database.fishSpecies = [{ id: "fish_trout", name: "Trout", itemId: "item_trout", skillXp: 12 }];
  project.system.fishing = {
    enabled: true,
    energyCost: 3,
    spots: [{
      id: "spot_pond",
      mapId: project.startMapId,
      area: { x: 0, y: 0, w: 4, h: 4 },
      catches: [{ fishId: "fish_trout", weight: 1, seasons: ["spring"], timePhases: ["morning"], weatherKinds: ["none"] }],
    }],
  };
  project.system.seasonalForage = {
    enabled: true,
    areas: [{
      id: "area_farm",
      mapId: project.startMapId,
      area: { x: 0, y: 0, w: 4, h: 4 },
      dailySpawnCount: 2,
      maxActive: 3,
      despawnAfterDays: 2,
      entries: [{ id: "berry", weight: 1, seasonalDrops: { spring: "item_berry", summer: "item_berry" } }],
    }],
  };
  project.system.collections = { enabled: true, trackedItemIds: ["item_trout", "item_berry", "item_reward"] };
  project.system.shipping = { enabled: true, allowedItemIds: ["item_trout", "item_berry"] };
  project.system.sellPrices = [{ itemId: "item_trout", price: 80 }, { itemId: "item_berry", price: 20 }];
  project.system.museum = {
    enabled: true,
    eligibleItemIds: ["item_trout"],
    rewards: [{
      id: "museum_first",
      minDonations: 1,
      reward: { gold: 50, itemRewards: [{ itemId: "item_reward", count: 2 }] },
    }],
  };
  return project;
}
