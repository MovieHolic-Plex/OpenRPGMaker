import { describe, expect, it } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { collectProjectReferenceIssues } from "@/project/io/references";

describe("Stardew demo: 여름/가을 작물 확장", () => {
  const project = createFarmingDemoProject();
  const crops = project.database.crops ?? [];
  const items = project.database.items;

  describe("여름 작물", () => {
    it("블루베리 작물이 존재하고 여름 계절이다", () => {
      const blueberry = crops.find((c) => c.id === "crop_blueberry");
      expect(blueberry, "crop_blueberry should exist").toBeTruthy();
      expect(blueberry!.seasons).toContain("summer");
      expect(blueberry!.seedItemId).toBe("item_blueberry_seed");
      expect(blueberry!.harvestItemId).toBe("item_blueberry");
    });

    it("블루베리는 재수확 가능하다", () => {
      const blueberry = crops.find((c) => c.id === "crop_blueberry");
      expect(blueberry?.regrow).toBeDefined();
    });

    it("멜론 작물이 존재하고 여름 계절이다", () => {
      const melon = crops.find((c) => c.id === "crop_melon");
      expect(melon, "crop_melon should exist").toBeTruthy();
      expect(melon!.seasons).toContain("summer");
      expect(melon!.seedItemId).toBe("item_melon_seed");
      expect(melon!.harvestItemId).toBe("item_melon");
    });
  });

  describe("가을 작물", () => {
    it("호박 작물이 존재하고 가을 계절이다", () => {
      const pumpkin = crops.find((c) => c.id === "crop_pumpkin");
      expect(pumpkin, "crop_pumpkin should exist").toBeTruthy();
      expect(pumpkin!.seasons).toContain("fall");
      expect(pumpkin!.seedItemId).toBe("item_pumpkin_seed");
      expect(pumpkin!.harvestItemId).toBe("item_pumpkin");
    });

    it("가지 작물이 존재하고 가을 계절이다", () => {
      const eggplant = crops.find((c) => c.id === "crop_eggplant");
      expect(eggplant, "crop_eggplant should exist").toBeTruthy();
      expect(eggplant!.seasons).toContain("fall");
      expect(eggplant!.seedItemId).toBe("item_eggplant_seed");
      expect(eggplant!.harvestItemId).toBe("item_eggplant");
    });
  });

  describe("씨앗/수확 아이템", () => {
    it("블루베리 씨앗과 수확 아이템이 존재한다", () => {
      expect(items.find((i) => i.id === "item_blueberry_seed")).toBeTruthy();
      expect(items.find((i) => i.id === "item_blueberry")).toBeTruthy();
    });

    it("멜론 씨앗과 수확 아이템이 존재한다", () => {
      expect(items.find((i) => i.id === "item_melon_seed")).toBeTruthy();
      expect(items.find((i) => i.id === "item_melon")).toBeTruthy();
    });

    it("호박 씨앗과 수확 아이템이 존재한다", () => {
      expect(items.find((i) => i.id === "item_pumpkin_seed")).toBeTruthy();
      expect(items.find((i) => i.id === "item_pumpkin")).toBeTruthy();
    });

    it("가지 씨앗과 수확 아이템이 존재한다", () => {
      expect(items.find((i) => i.id === "item_eggplant_seed")).toBeTruthy();
      expect(items.find((i) => i.id === "item_eggplant")).toBeTruthy();
    });
  });
});

describe("Stardew demo: 에너지 변수 시스템", () => {
  const project = createFarmingDemoProject();

  it("var_stamina 변수 정의가 존재한다", () => {
    expect(project.variables.find((v) => v.id === "var_stamina")).toBeTruthy();
  });

  it("시작 세션의 var_stamina는 100이다", () => {
    expect(project.session.variables.var_stamina).toBe(100);
  });

  it("stamina_decrease 공통 이벤트가 존재한다", () => {
    const ce = project.commonEvents.find((e) => e.id === "ce_stamina_decrease");
    expect(ce, "ce_stamina_decrease should exist").toBeTruthy();
    expect(ce!.commands.length).toBeGreaterThan(0);
  });

  it("stamina_recover 공통 이벤트가 존재한다", () => {
    const ce = project.commonEvents.find((e) => e.id === "ce_stamina_recover");
    expect(ce, "ce_stamina_recover should exist").toBeTruthy();
    expect(ce!.commands.length).toBeGreaterThan(0);
  });
});

describe("Stardew demo: 농장 이벤트 (상인 + 침대)", () => {
  const project = createFarmingDemoProject();
  const map = project.maps[project.startMapId];

  it("씨앗 상인 NPC 이벤트가 존재한다", () => {
    const shopEvent = map?.events.find((e) => e.id === "ev_seed_shop");
    expect(shopEvent, "ev_seed_shop should exist").toBeTruthy();
    const commands = shopEvent!.pages?.[0]?.commands ?? shopEvent!.commands;
    const hasShop = commands.some((c) => c.kind === "shop");
    expect(hasShop, "seed shop event should contain a shop command").toBe(true);
  });

  it("침대/수면 이벤트가 존재한다", () => {
    const bedEvent = map?.events.find((e) => e.id === "ev_bed");
    expect(bedEvent, "ev_bed should exist").toBeTruthy();
    const commands = bedEvent!.pages?.[0]?.commands ?? bedEvent!.commands;
    const hasSleep = commands.some((c) => c.kind === "sleepUntilMorning");
    expect(hasSleep, "bed event should contain sleepUntilMorning").toBe(true);
    const hasStaminaReset = commands.some(
      (c) => c.kind === "setVariable" && c.variableId === "var_stamina" && c.op === "="
    );
    expect(hasStaminaReset, "bed event should reset var_stamina to 100").toBe(true);
  });
});

describe("Stardew demo: 광산 맵", () => {
  const project = createFarmingDemoProject();
  const mineMap = project.maps["map_mine_1f"];

  it("광산 맵이 존재한다", () => {
    expect(mineMap, "map_mine_1f should exist").toBeTruthy();
  });

  it("광산 맵에 actionCombat이 활성화되어 있다", () => {
    expect(mineMap?.actionCombat).toBe(true);
  });

  it("광산 맵에 fieldSpawns가 있다", () => {
    expect(mineMap?.fieldSpawns?.length ?? 0).toBeGreaterThan(0);
    const spawn = mineMap!.fieldSpawns![0];
    expect(spawn.troopId).toBeTruthy();
    expect(spawn.area).toBeTruthy();
  });

  it("농장 맵에 광산 입구 transfer 이벤트가 있다", () => {
    const farmMap = project.maps[project.startMapId];
    const entrance = farmMap?.events.find((e) => e.id === "ev_mine_entrance");
    expect(entrance, "ev_mine_entrance should exist").toBeTruthy();
    const commands = entrance!.pages?.[0]?.commands ?? entrance!.commands;
    const hasTransfer = commands.some((c) => c.kind === "transfer" && c.mapId === "map_mine_1f");
    expect(hasTransfer, "mine entrance should transfer to map_mine_1f").toBe(true);
  });

  it("광산 맵에 농장으로 돌아가는 transfer 이벤트가 있다", () => {
    const exit = mineMap?.events.find((e) => e.id === "ev_mine_exit");
    expect(exit, "ev_mine_exit should exist").toBeTruthy();
    const commands = exit!.pages?.[0]?.commands ?? exit!.commands;
    const hasTransfer = commands.some((c) => c.kind === "transfer" && c.mapId === "map_farming_demo");
    expect(hasTransfer, "mine exit should transfer back to map_farming_demo").toBe(true);
  });

  it("시작 세션에 돌 placeable이 있다", () => {
    const placeables = Object.entries(project.session.placeables ?? {});
    const rocks = placeables.filter(([, p]) => p.kind === "rock");
    expect(rocks.length, "should have at least 2 rock placeables").toBeGreaterThanOrEqual(2);
  });

  it("곡괭이 아이템이 있다", () => {
    expect(project.database.items.find((i) => i.id === "item_pickaxe")).toBeTruthy();
    expect(project.session.inventory.item_pickaxe).toBe(1);
  });

  /**
   * 마을 칩셋(combined_town)의 흙길 421 은 렌더 시점 쿼터 합성이 경계마다 **잔디 프린지**를
   * 깐다 — 실측으로 갱도 테두리에 풀이 돋았다. 광산은 던전 칩셋이어야 한다.
   */
  it("광산은 던전 칩셋을 쓴다(마을 흙길 잔디 프린지 방지)", () => {
    expect(mineMap?.tilesetId).toBe("easyrpg_chipset_dungeon");
  });

  it("광산 암벽 타일이 solid 로 저작되어 있다", () => {
    const tileset = project.tilesets[mineMap!.tilesetId];
    expect(tileset, "mine tileset should exist in project").toBeTruthy();
    const wallTile = mineMap!.lowerTiles[0];
    expect(tileset!.passability[wallTile]).toEqual({ up: false, down: false, left: false, right: false });
  });

  it("광산 박쥐 스폰은 붉은 머리 하피(monster3#0)를 쓰지 않는다", () => {
    const spawn = mineMap!.fieldSpawns![0];
    const sprite = spawn.graphic?.sprite;
    expect(sprite?.id).not.toBe("tex_easyrpg_charset_monster3");
  });
});

describe("Stardew demo: NPC 하트 이벤트", () => {
  const project = createFarmingDemoProject();
  const farmMap = project.maps[project.startMapId];

  it("촌장 NPC 이벤트가 있다", () => {
    const mayor = farmMap?.events.find((e) => e.id === "ev_npc_mayor");
    expect(mayor, "ev_npc_mayor should exist").toBeTruthy();
  });

  it("촌장 NPC에 friendshipAtLeast 조건 페이지가 있다", () => {
    const mayor = farmMap?.events.find((e) => e.id === "ev_npc_mayor");
    const pages = mayor?.pages ?? [];
    const heartPage = pages.find((p) =>
      p.conditions.some((c) => c.kind === "friendshipAtLeast")
    );
    expect(heartPage, "should have a page with friendshipAtLeast condition").toBeTruthy();
  });

  it("촌장 기본 페이지에 changeFriendship 명령이 있다", () => {
    const mayor = farmMap?.events.find((e) => e.id === "ev_npc_mayor");
    const defaultPage = mayor?.pages?.[0];
    const commands = defaultPage?.commands ?? [];
    const hasFriendship = commands.some((c) => c.kind === "changeFriendship");
    expect(hasFriendship, "default page should changeFriendship").toBe(true);
  });
});

describe("Stardew demo: 봄 축제 이벤트", () => {
  const project = createFarmingDemoProject();
  const farmMap = project.maps[project.startMapId];

  it("봄 축제 이벤트가 있다", () => {
    const festival = farmMap?.events.find((e) => e.id === "ev_festival_spring");
    expect(festival, "ev_festival_spring should exist").toBeTruthy();
  });

  it("봄 축제에 season 조건이 있다", () => {
    const festival = farmMap?.events.find((e) => e.id === "ev_festival_spring");
    const page = festival?.pages?.[0] ?? festival;
    const hasSeason = (page?.conditions ?? []).some((c) => c.kind === "season");
    expect(hasSeason, "festival should have season condition").toBe(true);
  });

  it("봄 축제 스위치 정의가 있다", () => {
    expect(project.switches.find((s) => s.id === "sw_festival_spring_done")).toBeTruthy();
  });
});

describe("Stardew demo: 생활 콘텐츠 완성", () => {
  const project = createFarmingDemoProject();
  const residentIds = [
    "char_mayor",
    "char_seed_merchant",
    "char_miner",
    "char_carpenter",
    "char_herbalist",
  ] as const;

  // Break caught: the demo advertises resident relationships but only authors one mayor profile.
  it("선물 시스템과 맵 이벤트에 연결된 주민 프로필 5명을 제공한다", () => {
    expect(project.system.giftSystem).toBe(true);
    expect(Object.keys(project.characters ?? {})).toEqual(expect.arrayContaining(residentIds));

    const events = Object.values(project.maps).flatMap((map) => map.events);
    for (const characterId of residentIds) {
      const profile = project.characters?.[characterId];
      expect(profile?.birthday, `${characterId} birthday`).toBeTruthy();
      expect(profile?.giftPrefs?.loved?.length ?? 0, `${characterId} loved gifts`).toBeGreaterThan(0);
      expect(profile?.giftPrefs?.liked?.length ?? 0, `${characterId} liked gifts`).toBeGreaterThan(0);
      expect(profile?.giftPrefs?.disliked?.length ?? 0, `${characterId} disliked gifts`).toBeGreaterThan(0);
      expect(profile?.giftResponses?.loved, `${characterId} loved response`).toBeTruthy();

      const host = events.find((event) => event.characterId === characterId);
      expect(host, `${characterId} map host`).toBeTruthy();
      expect(host?.pages?.some((page) => page.conditions.some((condition) => condition.kind === "friendshipAtLeast"))).toBe(true);
      expect(host?.pages?.some((page) => page.commands.some((command) => command.kind === "changeFriendship"))).toBe(true);
    }
  });

  // Break caught: the mine has one anonymous spawn lane and no authored drop/species pipeline.
  it("광산의 두 출현군이 유효한 전투 그룹·종족·드롭 아이템으로 이어진다", () => {
    const mine = project.maps.map_mine_1f;
    expect(mine.fieldSpawns?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(new Set((mine.fieldSpawns ?? []).map((spawn) => spawn.troopId)).size).toBeGreaterThanOrEqual(2);

    const speciesIds = new Set((project.database.monsterSpecies ?? []).map((species) => species.id));
    const itemIds = new Set(project.database.items.map((item) => item.id));
    const troopIds = new Set(project.database.troops.map((troop) => troop.id));
    const spawnedEnemies = (mine.fieldSpawns ?? []).flatMap((spawn) => {
      expect(troopIds.has(spawn.troopId), `missing troop ${spawn.troopId}`).toBe(true);
      const troop = project.database.troops.find((entry) => entry.id === spawn.troopId);
      return (troop?.enemyIds ?? []).map((enemyId) => project.database.enemies.find((enemy) => enemy.id === enemyId));
    });

    expect(spawnedEnemies.length).toBeGreaterThan(0);
    for (const enemy of spawnedEnemies) {
      expect(enemy, "spawned enemy record").toBeTruthy();
      expect(speciesIds.has(enemy?.speciesId ?? ""), `${enemy?.id} species`).toBe(true);
      expect(itemIds.has(enemy?.rewards.dropItemId ?? ""), `${enemy?.id} drop`).toBe(true);
      expect(enemy?.rewards.dropRatePercent ?? 0, `${enemy?.id} drop rate`).toBeGreaterThan(0);
    }
  });
});

describe("Stardew demo: P0 생활 경제 루프", () => {
  const project = createFarmingDemoProject();

  it("에너지·배송·번들·제작기·5개 생활 기술을 실제 저작한다", () => {
    expect(project.system.energy).toEqual({ max: 100, initial: 100, restorePerDay: 100 });
    expect(project.system.shipping?.enabled).toBe(true);
    expect(project.system.shipping?.allowedItemIds?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(project.system.bundles?.map((bundle) => bundle.id)).toEqual([
      "bundle_spring_harvest",
      "bundle_mine_starter",
    ]);
    expect(project.system.worldUnlocks?.map((unlock) => unlock.id)).toContain("unlock_quarry_path");
    expect(project.system.makers?.map((maker) => maker.id)).toEqual([
      "maker_preserves_jar",
      "maker_furnace",
    ]);
    expect(project.database.lifeSkills?.map((skill) => skill.skillType).sort()).toEqual([
      "combat", "farming", "fishing", "foraging", "mining",
    ]);
  });

  it("번들·스킬·제작기·강화 도구의 모든 참조가 실재한다", () => {
    const itemIds = new Set(project.database.items.map((item) => item.id));
    const switchIds = new Set(project.switches.map((entry) => entry.id));
    const recipeIds = new Set((project.system.craftRecipes ?? []).map((entry) => entry.id));
    const unlockIds = new Set((project.system.worldUnlocks ?? []).map((entry) => entry.id));

    for (const bundle of project.system.bundles ?? []) {
      for (const row of bundle.requirements) expect(itemIds.has(row.itemId), row.itemId).toBe(true);
      for (const row of bundle.reward?.itemRewards ?? []) expect(itemIds.has(row.itemId), row.itemId).toBe(true);
      if (bundle.reward?.switchId) expect(switchIds.has(bundle.reward.switchId)).toBe(true);
      for (const id of bundle.reward?.recipeIds ?? []) expect(recipeIds.has(id), id).toBe(true);
      for (const id of bundle.reward?.worldUnlockIds ?? []) expect(unlockIds.has(id), id).toBe(true);
    }
    for (const maker of project.system.makers ?? []) {
      for (const row of [...maker.inputs, ...maker.outputs]) expect(itemIds.has(row.itemId), row.itemId).toBe(true);
    }
    expect(project.system.itemUpgrades?.some((upgrade) =>
      upgrade.toItemId === "item_copper_hoe"
      && upgrade.capability?.areaWidth === 3
      && upgrade.capability.energyMultiplier > 1
    )).toBe(true);
    expect(project.system.craftRecipes?.some((recipe) =>
      recipe.id === "recipe_preserves_jar" && recipe.requiresUnlock === true
    )).toBe(true);
    expect(collectProjectReferenceIssues(project)).toEqual([]);
  });
});

describe("Stardew demo: P1 살아 있는 농장", () => {
  const project = createFarmingDemoProject();

  it("4계절 날씨, 3일 예보, 비·폭풍·눈 규칙을 저작한다", () => {
    expect(project.system.dailyWeather?.enabled).toBe(true);
    expect(project.system.dailyWeather?.forecastDays).toBe(3);
    expect(Object.keys(project.system.dailyWeather?.seasons ?? {})).toEqual(["spring", "summer", "fall", "winter"]);
    expect(project.system.dailyWeather?.seasons.spring?.map((rule) => rule.kind)).toEqual(["none", "rain", "storm"]);
    expect(project.system.dailyWeather?.seasons.winter?.map((rule) => rule.kind)).toEqual(["none", "snow", "fog"]);
  });

  it("먹이·달걀·우유와 닭·소, 축사, 시작 개체를 완전히 연결한다", () => {
    const itemIds = new Set(project.database.items.map((item) => item.id));
    expect(itemIds.has("item_hay")).toBe(true);
    expect(itemIds.has("item_egg")).toBe(true);
    expect(itemIds.has("item_milk")).toBe(true);
    expect(project.session.inventory.item_hay).toBeGreaterThanOrEqual(6);
    expect(project.database.farmAnimalSpecies?.map((entry) => entry.id)).toEqual(["animal_chicken", "animal_cow"]);
    expect(project.system.farmAnimalBuildings?.map((entry) => entry.id)).toEqual(["building_sunrise_barn"]);
    expect(project.session.farmAnimals?.map((entry) => entry.instanceId)).toEqual(["farm_animal_bori", "farm_animal_dubu"]);
    expect(project.session.farmAnimals?.every((entry) => entry.buildingId === "building_sunrise_barn")).toBe(true);
  });

  it("동물 개체의 표시 이벤트와 주민의 시간대 일정이 실제 맵에 존재한다", () => {
    const farm = project.maps[project.startMapId];
    const eventIds = new Set(farm?.events.map((event) => event.id));
    for (const animal of project.session.farmAnimals ?? []) {
      expect(eventIds.has(animal.eventId ?? ""), `${animal.instanceId} visual event`).toBe(true);
    }
    const scheduledResidents = farm?.events.filter((event) => event.characterId && (event.schedule?.length ?? 0) >= 2) ?? [];
    expect(scheduledResidents.length).toBeGreaterThanOrEqual(3);
    expect(scheduledResidents.flatMap((event) => event.schedule ?? []).every((row) => row.at.mapId === project.startMapId)).toBe(true);
  });
});

describe("Stardew demo: P2 탐색과 공간 확장", () => {
  const project = createFarmingDemoProject();

  it("계절·시간·날씨가 다른 물고기와 실제 농장 낚시터를 저작한다", () => {
    expect(project.database.fishSpecies?.map((fish) => fish.id)).toEqual([
      "fish_river_carp",
      "fish_moon_trout",
    ]);
    expect(project.system.fishing?.enabled).toBe(true);
    expect(project.system.fishing?.energyCost).toBeGreaterThan(0);
    expect(project.system.fishing?.spots).toHaveLength(1);
    const catches = project.system.fishing?.spots[0]?.catches ?? [];
    expect(catches.some((rule) => rule.seasons?.includes("spring"))).toBe(true);
    expect(catches.some((rule) => rule.timePhases?.includes("night"))).toBe(true);
    expect(catches.some((rule) => rule.weatherKinds?.includes("rain"))).toBe(true);
  });

  it("농장과 광산에 계절 채집 구역을 제공하고 도감·박물관 보상을 연결한다", () => {
    expect(project.system.seasonalForage?.enabled).toBe(true);
    expect(project.system.seasonalForage?.areas.map((area) => area.id)).toEqual([
      "forage_farm_meadow",
      "forage_mine_cavern",
    ]);
    expect(project.system.seasonalForage?.areas.some((area) =>
      area.entries.some((entry) => Object.keys(entry.seasonalDrops ?? {}).length >= 3)
    )).toBe(true);
    expect(project.system.collections?.trackedItemIds?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(project.system.museum?.eligibleItemIds.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(project.system.museum?.rewards.map((reward) => reward.id)).toEqual([
      "museum_reward_first_find",
      "museum_reward_field_scholar",
    ]);
  });

  it("2단계 범용 건물과 회전 가능한 집 장식을 시작 배치까지 제공한다", () => {
    expect(project.database.farmBuildingTypes?.map((type) => type.id)).toEqual(["farm_building_workshop"]);
    expect(project.database.farmBuildingTypes?.[0]?.levels.map((level) => level.level)).toEqual([1, 2]);
    expect(project.database.homeDecorationTypes?.map((type) => type.id)).toEqual([
      "home_decor_sun_rug",
      "home_decor_wood_table",
    ]);
    expect(project.database.homeDecorationTypes?.every((type) => type.allowedOrientations.length >= 2)).toBe(true);
    expect(project.session.farmBuildingPlacements?.map((placement) => placement.instanceId)).toEqual(["farm_building_workshop_1"]);
    expect(project.session.homeDecorationPlacements?.map((placement) => placement.instanceId)).toEqual([
      "home_decor_sun_rug_1",
      "home_decor_wood_table_1",
    ]);
  });

  it("P2 콘텐츠를 포함한 전체 프로젝트 참조가 재로드 가능한 상태다", () => {
    expect(collectProjectReferenceIssues(project)).toEqual([]);
  });
});
