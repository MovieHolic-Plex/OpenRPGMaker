import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { validateProjectReferences, collectProjectReferenceIssues } from "@/project/io/references";
import { MAP_BACKGROUND_CAMERA_FOLLOW_LIMIT, MAP_BACKGROUND_SCROLL_LIMIT, decodeMapBackgroundFlow, defaultLayerCameraFollow, encodeMapBackgroundFlow, normalizeMapBackground, normalizeMapBackgroundCameraFollow, normalizeMapBackgroundScroll } from "@/project/mapBackground";
import { cropReferenceMessage } from "@/editor/databaseReferences";
import { normalizeCropRecord } from "@/project/farmModel";
import { store } from "@/project/store";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createLegacyLifeProject } from "./fixtures/life-full/legacyProject";
import { isolateTimers } from "./mergedTeardown";

describe("mapBackgroundRules", () => {
  isolateTimers();
  /**
   * 맵 배경(파노라마)의 **저작 경계** 계약.
   *
   * 렌더가 붙기 전에는 이 필드를 아무도 읽지 않아 아무 값이나 통과했다. 이제는 없는 그림 id 가
   * 플레이에서 조용히 아무것도 안 그리므로, 로드가 그 사실을 소리 내야 한다. 여기서 잠그는 것은
   * 셋이다: (1) 범위 밖 스크롤은 클램프, (2) 타입이 틀리면 로드 거절, (3) 없는 리소스는 참조 검증
   * 실패 — 단 **빈 imageId 는 참조가 아니다**(「맵 배경 사용」 을 켜고 아직 안 고른 상태).
   */

  /** 배경 저작만 얹은 원시 프로젝트 JSON. 로드 게이트를 재려면 타입이 아니라 JSON 이 필요하다. */
  function projectJsonWithBackground(background: unknown): string {
    // 한 번 읽은 모양에서 시작한다 — 새 프로젝트의 기본값(battleUiStyle="retro2003")은 로드가 생략해 바이트 비교가 표현 차이로 빗나간다.
    const raw = JSON.parse(serialize(deserialize(serialize(createBlankProject())))) as { maps: Record<string, Record<string, unknown>> };
    const mapId = Object.keys(raw.maps)[0]!;
    raw.maps[mapId]!.background = background;
    return JSON.stringify(raw);
  }
  function backgroundOf(json: string) {
    const project = deserialize(json);
    return project.maps[project.startMapId]?.background;
  }
  describe("맵 배경 저작 규칙", () => {
    it("스크롤 속도는 상한으로 클램프하고, 수가 아니면 키를 지운다", () => {
      expect(normalizeMapBackgroundScroll(999)).toBe(MAP_BACKGROUND_SCROLL_LIMIT);
      expect(normalizeMapBackgroundScroll(-999)).toBe(-MAP_BACKGROUND_SCROLL_LIMIT);
      expect(normalizeMapBackgroundScroll(2.5)).toBe(2.5);
      // 0 은 저작값(정지)이다 — 지우면 옛 JSON 이 바이트 그대로 유지되지 않는다.
      expect(normalizeMapBackgroundScroll(0)).toBe(0);
      expect(normalizeMapBackgroundScroll(Number.POSITIVE_INFINITY)).toBeUndefined();
      expect(normalizeMapBackgroundScroll(Number.NaN)).toBeUndefined();
      expect(normalizeMapBackgroundScroll("2")).toBeUndefined();
      expect(normalizeMapBackgroundScroll(undefined)).toBeUndefined();
    });

    it("빈 imageId 는 «켜 두고 아직 안 고른» 저작 상태다 — 지우지 않는다", () => {
      expect(normalizeMapBackground({ imageId: "  ", scrollX: 0, scrollY: 0 })).toEqual({
        imageId: "",
        scrollX: 0,
        scrollY: 0,
      });
      // 반대로 imageId 자체가 없거나 타입이 틀리면 저작이 아니다.
      expect(normalizeMapBackground({ scrollX: 1 })).toBeUndefined();
      expect(normalizeMapBackground({ imageId: 5 })).toBeUndefined();
      expect(normalizeMapBackground(null)).toBeUndefined();
      expect(normalizeMapBackground([{ imageId: "x" }])).toBeUndefined();
    });

    it("모르는 키는 버리고 아는 키만 남긴다", () => {
      expect(normalizeMapBackground({ imageId: "bg", scrollX: 4, scrollY: -1, opacity: 0.5 })).toEqual({
        imageId: "bg",
        scrollX: 4,
        scrollY: -1,
      });
    });

    it("반복은 기본값이라 «끈 것» 만 저장한다", () => {
      // 켜 둔 것을 true 로 적으면 옛 JSON 과 바이트가 어긋난다.
      expect(normalizeMapBackground({ imageId: "bg", loopX: true, loopY: true })).toEqual({ imageId: "bg" });
      expect(normalizeMapBackground({ imageId: "bg", loopX: false })).toEqual({ imageId: "bg", loopX: false });
      expect(normalizeMapBackground({ imageId: "bg", loopY: false, scrollY: 2 })).toEqual({
        imageId: "bg",
        scrollY: 2,
        loopY: false,
      });
    });
  });
  describe("맵 배경 로드 게이트", () => {
    it("범위 밖 스크롤은 로드에서 잘린다", () => {
      expect(backgroundOf(projectJsonWithBackground({ imageId: "easyrpg-backdrop-sky1", scrollX: 999, scrollY: -0.5 })))
        .toEqual({ imageId: "easyrpg-backdrop-sky1", scrollX: MAP_BACKGROUND_SCROLL_LIMIT, scrollY: -0.5 });
    });

    it("imageId 가 문자열이 아니면 로드를 거절한다", () => {
      expect(() => deserialize(projectJsonWithBackground({ imageId: 5 }))).toThrow();
    });

    it("스크롤 속도가 수가 아니면 로드를 거절한다", () => {
      expect(() => deserialize(projectJsonWithBackground({ imageId: "easyrpg-backdrop-sky1", scrollX: "2" }))).toThrow();
    });

    it("빈 상태의 바이트는 그대로 유지된다(스키마 버전 상승 없이 자란다)", () => {
      const raw = projectJsonWithBackground({ imageId: "", scrollX: 0, scrollY: 0 });
      expect(serialize(deserialize(raw))).toBe(raw);
    });
  });
  describe("맵 배경 참조 검증", () => {
    it("없는 배경 리소스는 로드에서 걸린다", () => {
      // 참조 검증은 `deserialize` 안에서 돈다(validateProjectV4 → validateProjectReferences).
      expect(() => deserialize(projectJsonWithBackground({ imageId: "no-such-backdrop" })))
        .toThrow(/background\.imageId/);
    });

    it("빈 imageId 는 참조가 아니라서 통과한다", () => {
      expect(() => deserialize(projectJsonWithBackground({ imageId: "", scrollX: 0, scrollY: 0 }))).not.toThrow();
    });

    it("실재하는 배경 id 는 통과한다", () => {
      const project = deserialize(projectJsonWithBackground({ imageId: "easyrpg-backdrop-sky1" }));
      expect(() => validateProjectReferences(project)).not.toThrow();
    });
  });
  describe("맵 배경 깊이(카메라 따라가기)와 흐름 배율", () => {
    it("깊이는 0..상한으로 클램프하고, 0 은 기본값이라 생략한다", () => {
      expect(normalizeMapBackgroundCameraFollow(0.4)).toBe(0.4);
      expect(normalizeMapBackgroundCameraFollow(99)).toBe(MAP_BACKGROUND_CAMERA_FOLLOW_LIMIT);
      expect(normalizeMapBackgroundCameraFollow(-1)).toBeUndefined();
      expect(normalizeMapBackgroundCameraFollow(0)).toBeUndefined();
      expect(normalizeMapBackgroundCameraFollow("0.5")).toBeUndefined();
    });

    it("층마다의 깊이가 저장·로드를 거쳐 그대로 남는다", () => {
      const background = backgroundOf(projectJsonWithBackground({
        imageId: "",
        cameraFollow: 0.1,
        layers: [{ imageId: "easyrpg-backdrop-sky1", cameraFollow: 0.6 }, { imageId: "easyrpg-backdrop-sky1" }],
      }));
      expect(background?.cameraFollow).toBe(0.1);
      expect(background?.layers?.[0]?.cameraFollow).toBe(0.6);
      expect(background?.layers?.[1]).not.toHaveProperty("cameraFollow");
    });

    it("레이어 세트 기본 깊이는 하늘 0 에서 맨 앞 0.7 까지 커진다", () => {
      expect([0, 1, 2].map((index) => defaultLayerCameraFollow(index, 3))).toEqual([0, 0.35, 0.7]);
      expect(defaultLayerCameraFollow(0, 1)).toBe(0);
    });

    it("흐름 배율 기록은 왕복하고, 깨진 값은 무시한다", () => {
      expect(decodeMapBackgroundFlow(encodeMapBackgroundFlow(25, 1500))).toEqual({ percent: 25, durationMs: 1500 });
      expect(decodeMapBackgroundFlow(encodeMapBackgroundFlow(9999, -5))).toEqual({ percent: 400, durationMs: 0 });
      expect(decodeMapBackgroundFlow("abc|10")).toBeUndefined();
      expect(decodeMapBackgroundFlow("")).toBeUndefined();
    });
  });
});

describe("orphanFkAuthority", () => {
  isolateTimers();
  describe("Orphan-FK single authority (G003)", () => {
    function issuesWith(project: ReturnType<typeof createBlankProject>): string[] {
      store.replace(structuredClone(project));
      return collectProjectReferenceIssues(store.getCurrent());
    }

    it("C001: reports an orphan for every FK type when dangling", () => {
      const project = createBlankProject();

      project.database.actors[0].classId = "class_missing";
      project.database.skills[0].animationId = "anim_missing";
      project.database.skills[0].elementId = "element_missing";
      project.database.skills[0].stateEffects = [{ stateId: "state_missing", chance: 100, operation: "add" }];
      project.database.items[0].skillId = "skill_missing";
      project.database.equipment[0].skillId = "skill_missing";
      project.database.enemies[0].speciesId = "species_missing";
      project.database.troops[0].enemyIds = [...project.database.troops[0].enemyIds, "enemy_missing"];
      project.database.monsterSpecies = [
        { id: "species_probe", name: "프로브", graphic: {}, baseStats: {}, captureRate: 1, skillsByLevel: [{ level: 1, skillId: "skill_missing" }] } as any,
      ];
      project.database.crops = [
        normalizeCropRecord({ id: "crop_probe", name: "프로브작물", seedItemId: "item_missing", harvestItemId: "item_missing2", harvestCount: 1, stages: [{ days: 1 }], seasons: [] as any }),
      ];

      const issues = issuesWith(project).join("\n");

      expect(issues).toContain("classId does not exist");
      expect(issues).toContain("animationId does not exist");
      expect(issues).toContain("elementId does not exist");
      expect(issues).toContain("stateId does not exist");
      expect(issues).toContain("skillId does not exist");
      expect(issues).toContain("speciesId does not exist");
      expect(issues).toContain("enemy does not exist: enemy_missing");
      expect(issues).toContain("skill does not exist: skill_missing");
      expect(issues).toContain("seedItemId does not exist");
      expect(issues).toContain("harvestItemId does not exist");
    });

    it("C001: clean project reports zero reference issues", () => {
      expect(issuesWith(createBlankProject())).toHaveLength(0);
    });

    it("C002: crop delete-gate does not false-block; lint owns crop FK integrity", () => {
      const project = createBlankProject();
      project.database.crops = [
        normalizeCropRecord({ id: "crop_probe", name: "프로브작물", seedItemId: "item_missing", harvestItemId: "item_missing2", harvestCount: 1, stages: [{ days: 1 }], seasons: [] as any }),
      ];
      store.replace(structuredClone(project));

      // crop 참조는 런타임(FarmPlotState, PlaySession) 전용이라 정적 delete-gate는 차단하지 않는다.
      expect(cropReferenceMessage("crop_probe")).toBeNull();

      // orphan-FK 단일 권위자는 collectProjectReferenceIssues(validateCropRecords)이다.
      const issues = collectProjectReferenceIssues(store.getCurrent()).join("\n");
      expect(issues).toContain("seedItemId does not exist");
      expect(issues).toContain("harvestItemId does not exist");
    });
  });
});

describe("p2ProjectSchema", () => {
  isolateTimers();
  type Mutable = Record<string, any>;
  function configuredProject() {
    const project = createBlankProject() as unknown as Mutable;
    project.database.items.push(normalizeItemRecord({ id: "item_trout", name: "Trout", scope: "none", price: 80 }));
    project.database.items.push(normalizeItemRecord({ id: "item_berry", name: "Berry", scope: "none", price: 20 }));
    project.database.fishSpecies = [{ id: "fish_trout", name: "Trout", itemId: "item_trout", skillXp: 12 }];
    project.system.fishing = {
      enabled: true,
      energyCost: 3,
      spots: [{
        id: "spot_pond",
        name: "Pond",
        mapId: project.startMapId,
        area: { x: 0, y: 0, w: 4, h: 4 },
        catches: [{ fishId: "fish_trout", weight: 2, seasons: ["spring"], timePhases: ["morning"], weatherKinds: ["none"] }],
      }],
    };
    project.system.seasonalForage = {
      enabled: true,
      areas: [{
        id: "forage_farm",
        name: "Farm forage",
        mapId: project.startMapId,
        area: { x: 0, y: 0, w: 4, h: 4 },
        dailySpawnCount: 2,
        maxActive: 4,
        spawnEveryDays: 1,
        despawnAfterDays: 3,
        entries: [{ id: "berry", weight: 1, seasonalDrops: { spring: "item_berry" } }],
      }],
    };
    project.system.collections = { enabled: true, trackedItemIds: ["item_trout", "item_berry"] };
    project.system.museum = {
      enabled: true,
      eligibleItemIds: ["item_trout"],
      rewards: [{ id: "reward_first", minDonations: 1, reward: { gold: 50, itemRewards: [{ itemId: "item_berry", count: 1 }] } }],
    };
    return project;
  }
  describe("P2 authored foundation schema", () => {
    it("round-trips fishing, forage, collection, museum, and fish definitions", () => {
      // Break caught: the schema normalizer drops every P2 optional authoring package.
      const project = configuredProject();
      const loaded = deserialize(serialize(project as never)) as unknown as Mutable;

      expect(loaded.database.fishSpecies).toEqual(project.database.fishSpecies);
      expect(loaded.system.fishing).toEqual(project.system.fishing);
      expect(loaded.system.seasonalForage).toEqual(project.system.seasonalForage);
      expect(loaded.system.collections).toEqual(project.system.collections);
      expect(loaded.system.museum).toEqual(project.system.museum);
    });

    it("keeps legacy projects byte-stable without P2 fields", () => {
      // Break caught: P2 normalization invents empty packages in an old project.
      // 비교 기준은 한 번 읽은(정규화한) 모양이다 — 새 프로젝트의 기본값(system.battleUiStyle="retro2003")은 로드가 생략하므로
      // 첫 저장 글과 재저장 글은 표현만 다르다(내용 같음, #3774 이전부터). 이 시험이 잡는 것은 «로드가 필드를 지어내지 않는다»이다.
      const before = serialize(deserialize(serialize(createLegacyLifeProject())));
      const loaded = deserialize(before) as unknown as Mutable;
      expect(loaded.database.fishSpecies).toBeUndefined();
      expect(loaded.system.fishing).toBeUndefined();
      expect(loaded.system.seasonalForage).toBeUndefined();
      expect(loaded.system.collections).toBeUndefined();
      expect(loaded.system.museum).toBeUndefined();
      expect(serialize(loaded as never)).toBe(before);
      expect(serialize(deserialize(serialize(loaded as never)))).toBe(before);
    });

    it("rejects duplicate ids and unsafe authored geometry at the wire boundary", () => {
      // Break caught: ambiguous catch/forage authority and unsafe rectangles reach runtime.
      const duplicate = JSON.parse(serialize(configuredProject() as never)) as Mutable;
      duplicate.database.fishSpecies.push({ ...duplicate.database.fishSpecies[0] });
      expect(() => deserialize(JSON.stringify(duplicate))).toThrow(/fishSpecies.*duplicat/i);

      const unsafe = JSON.parse(serialize(configuredProject() as never)) as Mutable;
      unsafe.system.seasonalForage.areas[0].area.w = 0;
      expect(() => deserialize(JSON.stringify(unsafe))).toThrow(/seasonalForage.*area\.w/i);
    });

    it("reports dangling fish, map, item, and museum reward references", () => {
      // Break caught: deleting referenced P2 records leaves silent runtime dead paths.
      const project = configuredProject();
      project.database.fishSpecies[0].itemId = "item_missing_fish";
      project.system.fishing.spots[0].mapId = "map_missing";
      project.system.fishing.spots[0].catches[0].fishId = "fish_missing";
      project.system.seasonalForage.areas[0].entries[0].seasonalDrops.spring = "item_missing_forage";
      project.system.collections.trackedItemIds = ["item_missing_collection"];
      project.system.museum.eligibleItemIds = ["item_missing_museum"];
      project.system.museum.rewards[0].reward.recipeIds = ["recipe_missing"];

      const issues = collectProjectReferenceIssues(project as never).join("\n");
      for (const id of [
        "item_missing_fish",
        "map_missing",
        "fish_missing",
        "item_missing_forage",
        "item_missing_collection",
        "item_missing_museum",
        "recipe_missing",
      ]) expect(issues).toContain(id);
    });
  });
});
