import { describe, expect, it } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";

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
