import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets, combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { Project, TilesetDef } from "@/project/types";
import { backgroundlessLowerReviews, DEFAULT_TRUNK_BACKING_TILE, tileBackingTile, tileLayerPolicy } from "@/editor/tileLayerPolicy";
import { setTileBackingOverride, setTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { TILE } from "@/project/defaults/constants";
import { summarizeTileUsage, summarizeTilesetGenerationReadiness } from "@/project/tilesetSemanticChecker";
import { roleCapabilities } from "@/project/tileRoles";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { isolateTimers } from "./mergedTeardown";

// 테마 번들(시트 한 장이 끝에 덧붙으며 자라는 칩셋 14개)의 사본에 프로젝트 이식 칸(stamp_tileset_object 가 다른 칩셋 그림을 끝에 붙인 칸)이 있을 때:
// 번들이 그 자리까지 자라면 꼬리를 새 번들 끝 뒤로 밀고(맵 번호도) 번들 구간만 새 굽기로 채운다 — 전에는 «칸이 번들보다 많은 사본» 이라 건너뛰어
// 그 프로젝트가 새 킷을 못 받고, 번들 킷이 그 사본에서는 이식 그림을 가리켰다(2026-11-12 check-bundle-save-compat: snow_north 976 · steampunk_city 851).
describe("themeBundleLocalTail", () => {
  isolateTimers();
  const THEME_BUNDLES = ["desert_east", "gothic_manor", "jp_city", "modern_campus", "modern_city", "pirate_isles", "prehistoric", "sengoku_edo", "sf_station", "sky_island", "snow_north", "steampunk_city", "wasteland_ruins", "wizarding_world"] as const;
  const CUT = 7;   // 번들이 «자라기 전» 을 흉내 내려고 사본 끝에서 떼는 칸 수

  describe("테마 번들 사본의 프로젝트 이식 꼬리", () => {
    it.each(THEME_BUNDLES)("%s — 번들이 이식 칸 자리까지 자라면 꼬리를 밀고 번들 구간을 채운다", (id) => {
      const made = { project: createBlankProject() as Project, currentMapId: "" };
      expect(runTool(made, "create_map", { id: "old", name: "옛 맵", width: 20, height: 15, tilesetId: id }).ok).toBe(true);
      const project = made.project; // 도구는 프로젝트 객체를 새로 갈아 끼운다
      ensureBundledTilesets(project); // 불러온 프로젝트의 모습(뒤 단계가 일부 칸을 upper 로 올린다 — pirate_isles·sf_station)에서 시작한다
      const ts = project.tilesets[id]!;
      const bundle = structuredClone(ts);
      const first = bundle.count - CUT;
      // 옛 사본: 번들 칸 표는 first 까지, 그 바로 뒤에 다른 칩셋 그림 한 칸(이식). 잘린 칸을 쓰는 번들 킷·묶음·띠는 그때 없었다.
      for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (ts as unknown as Record<string, unknown[]>)[key] = (ts as unknown as Record<string, unknown[]>)[key]!.slice(0, first);
      ts.structureKits = (ts.structureKits ?? []).filter((kit) => !kit.rows.some((row) => [...(row.tiles ?? []), ...(row.upperTiles ?? [])].some((tile) => tile >= first)));
      ts.tileGroups = (ts.tileGroups ?? []).filter((group) => !group.tileIds.some((tile) => tile >= first));
      ts.animationStrips = (ts.animationStrips ?? []).filter((strip) => strip.baseTile < first);
      ts.passability.push({ up: false, down: false, left: false, right: false }); ts.priority.push("upper"); ts.terrain.push(0);
      ts.tileMeta!.push({ label: "빌린 기물", description: "" });
      ts.tileGrafts = [{ targetTile: first, sourceChipset: "tex_beodeul_city", sourceTile: 10 }];
      ts.count = first + 1;
      const map = project.maps.old!;
      const cell = 5 * map.width + 6;
      map.upperTiles[cell] = first;

      expect(ensureBundledTilesets(project)).toBe(true);
      const now = project.tilesets[id]!;
      const start = now.tileGrafts![0]!.targetTile;
      expect(start).toBeGreaterThanOrEqual(bundle.count);
      expect((start - first) % now.tilesPerRow).toBe(0); // 한 줄 폭 배수만큼
      expect(project.maps.old!.upperTiles[cell]).toBe(start);
      expect(now.tileMeta![start]!.label).toBe("빌린 기물");
      expect(isPassable(project, project.maps.old!, 6, 5)).toBe(false);
      expect(now.passability.slice(0, bundle.count)).toEqual(bundle.passability);
      expect(now.priority.slice(0, bundle.count)).toEqual(bundle.priority);
      expect(now.tileMeta!.slice(0, bundle.count)).toEqual(bundle.tileMeta);
      expect((now.structureKits ?? []).map((kit) => kit.id)).toEqual((bundle.structureKits ?? []).map((kit) => kit.id));
      for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) expect((now as unknown as Record<string, unknown[]>)[key]).toHaveLength(now.count);
      const settled = JSON.stringify([project.tilesets[id], project.maps.old!.upperTiles]);
      ensureBundledTilesets(project);
      expect(JSON.stringify([project.tilesets[id], project.maps.old!.upperTiles])).toBe(settled);
    });
  });
});

// OPRN-OUT-026 — 타일 레이어·배경 정책. 투명하다는 사실과 홈 레이어 결정, 그리고
// 하위 배치 시 받침 전략이 서로 다른 축임을 고정한다.
describe("tileLayerPolicy", () => {
  isolateTimers();
  const BENCH = 357;
  const CONIFER_TRUNK = 290;
  const BROADLEAF_TRUNK = 292;
  const CONIFER_CANOPY = 260;
  const STRAIGHT_ROOF = 404;
  describe("tileLayerPolicy — 다섯 부류", () => {
    it("불투명 바닥은 opaqueFloor이고 받침이 없다", () => {
      const tileset = defaultTileset();
      for (const tile of [TILE.GRASS, TILE.WATER, STRAIGHT_ROOF]) {
        const policy = tileLayerPolicy(tileset, tile);
        expect(policy.kind, `타일 ${tile}`).toBe("opaqueFloor");
        expect(policy.home).toBe("lower");
        expect(policy.backingTile).toBeNull();
      }
    });

    it("투명 소품(벤치)은 상위 오버레이이고 받침을 쓰지 않는다", () => {
      const policy = tileLayerPolicy(defaultTileset(), BENCH);
      expect(policy.kind).toBe("transparentOverlay");
      expect(policy.home).toBe("upper");
      expect(policy.transparent).toBe(true);
      expect(policy.backingTile).toBeNull();
    });

    it("나무 밑동 290~293은 받침 있는 하위이고 잔디를 받침으로 쓴다", () => {
      const tileset = defaultTileset();
      for (const tile of [290, 291, 292, 293]) {
        const policy = tileLayerPolicy(tileset, tile);
        expect(policy.kind, `타일 ${tile}`).toBe("backedLower");
        expect(policy.home).toBe("lower");
        expect(policy.backingTile).toBe(DEFAULT_TRUNK_BACKING_TILE);
        expect(policy.multiPart?.partnerTiles).toContain(CONIFER_CANOPY);
      }
    });

    it("수관은 다중 조각 제약으로 표시되고 밑동을 짝으로 가리킨다", () => {
      const policy = tileLayerPolicy(defaultTileset(), CONIFER_CANOPY);
      expect(policy.kind).toBe("multiPart");
      expect(policy.home).toBe("upper");
      expect(policy.multiPart?.partnerTiles).toContain(CONIFER_TRUNK);
    });

    it("사용자가 받침을 없음으로 두면 의도적 투명 하위가 된다", () => {
      const tileset = defaultTileset();
      setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
      const policy = tileLayerPolicy(tileset, CONIFER_TRUNK);
      expect(policy.kind).toBe("transparentLower");
      expect(policy.backingTile).toBeNull();
      expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBeNull();
    });

    // 브라우저 실측(2026-09-10, verify-shots/oprn-026/03-backing-none-warning.png): 규칙 탭이
    // 「투명 하위(받침 없음)」 부류와 함께 "받침 타일로 투명 픽셀을 채웁니다" 근거를 같이 띄워
    // 바로 위 경고와 모순됐다. 근거는 실제 받침 결과를 말해야 한다.
    it("받침을 없음으로 확정한 밑동의 근거는 받침이 채운다고 말하지 않는다", () => {
      const tileset = defaultTileset();
      setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
      const policy = tileLayerPolicy(tileset, CONIFER_TRUNK);
      expect(policy.reason).not.toContain("받침 타일로 투명 픽셀을 채웁니다");
      expect(policy.reason).toContain("비어 보일 수 있습니다");
    });

    it("받침이 살아 있는 밑동의 근거는 여전히 받침 합성을 설명한다", () => {
      const policy = tileLayerPolicy(defaultTileset(), CONIFER_TRUNK);
      expect(policy.reason).toContain("받침 타일로 투명 픽셀을 채웁니다");
    });

    it("사용자가 받침 타일을 지정하면 그 타일이 받침이 된다", () => {
      const tileset = defaultTileset();
      setTileBackingOverride(tileset, CONIFER_TRUNK, TILE.PATH);
      expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBe(TILE.PATH);
    });

    it("사용자가 밑동을 상위로 확정하면 받침이 사라진다 — 상위는 하위 지면을 덮지 않는다", () => {
      const tileset = defaultTileset();
      setTileLayerOverride(tileset, BROADLEAF_TRUNK, "upper");
      const policy = tileLayerPolicy(tileset, BROADLEAF_TRUNK);
      expect(policy.home).toBe("upper");
      expect(policy.backingTile).toBeNull();
      expect(policy.source).toBe("user");
    });

    it("자동으로 되돌리면 하네스 기본값(받침 있는 하위)으로 복귀한다", () => {
      const tileset = defaultTileset();
      setTileLayerOverride(tileset, CONIFER_TRUNK, "upper");
      setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
      setTileLayerOverride(tileset, CONIFER_TRUNK, "auto");
      setTileBackingOverride(tileset, CONIFER_TRUNK, "auto");
      const policy = tileLayerPolicy(tileset, CONIFER_TRUNK);
      expect(policy.home).toBe("lower");
      expect(policy.backingTile).toBe(DEFAULT_TRUNK_BACKING_TILE);
    });
  });
  describe("backgroundlessLowerReviews — 검토 신호는 변형하지 않는다", () => {
    it("기본 칩셋에서 받침 있는 밑동은 검토 목록에 들어가지 않는다", () => {
      const reviews = backgroundlessLowerReviews(defaultTileset());
      for (const tile of [290, 291, 292, 293]) {
        expect(reviews.some((review) => review.tile === tile), `타일 ${tile}`).toBe(false);
      }
    });

    it("받침 없는 투명 하위 타일은 네 가지 선택지와 함께 검토 목록에 오른다", () => {
      const tileset = defaultTileset();
      setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
      const review = backgroundlessLowerReviews(tileset).find((item) => item.tile === CONIFER_TRUNK);
      expect(review).toBeDefined();
      expect(review?.kind).toBe("transparentLower");
      expect(review?.choices).toEqual(["overlay", "lowerWithBacking", "transparentLower", "auto"]);
    });

    it("목록을 만드는 것만으로는 타일셋이 바뀌지 않는다 — 가져오기 자동 재분류 금지", () => {
      const tileset = defaultTileset();
      const before = JSON.stringify({ priority: tileset.priority, tileMeta: tileset.tileMeta });
      backgroundlessLowerReviews(tileset);
      expect(JSON.stringify({ priority: tileset.priority, tileMeta: tileset.tileMeta })).toBe(before);
    });
  });
});

describe("tilesetSemanticChecker", () => {
  isolateTimers();
  describe("tileset semantic checker", () => {
    it("reports the default combined-town metadata as ready for every generation role", () => {
      // Given: the bundled default tileset has semantic groups and high-confidence tile metadata.
      const tileset = defaultTileset();

      // When: the tileset checker evaluates generation readiness.
      const summary = summarizeTilesetGenerationReadiness(tileset);

      // Then: city, house, road, water, and decor generation are all covered.
      expect(summary.ready).toBe(true);
      expect(summary.checks.map((check) => check.id)).toEqual(["city", "house", "road", "water", "decor"]);
      expect(summary.checks.every((check) => check.ready)).toBe(true);
      expect(summary.checks.find((check) => check.id === "city")?.coveredRoles).toEqual(
        expect.arrayContaining(["building", "terrain", "wall", "water"])
      );
    });

    it("names missing role slots when semantic groups are incomplete", () => {
      // Given: a tileset that lost all water groups.
      const tileset = defaultTileset();
      tileset.tileGroups = tileset.tileGroups?.filter((group) => group.role !== "water");

      // When: the tileset checker evaluates generation readiness.
      const summary = summarizeTilesetGenerationReadiness(tileset);

      // Then: city and water generation identify the missing water slot.
      expect(summary.ready).toBe(false);
      expect(summary.checks.find((check) => check.id === "city")?.missingRoleSlots).toContain("water");
      expect(summary.checks.find((check) => check.id === "water")?.missingRoleSlots).toContain("water");
    });

    it("summarizes selected tile tags and placement rules from metadata groups", () => {
      // Given: a selected tile that belongs to a semantic road group.
      const tileset = defaultTileset();
      const roadGroup = tileset.tileGroups?.find((group) => group.role === "terrain");
      if (!roadGroup) throw new Error("expected terrain road group");
      const tile = roadGroup.tileIds[0];

      // When: the selected tile usage summary is built.
      const usage = summarizeTileUsage(tileset, tile);

      // Then: inspector data includes visible meaning tags and rule text.
      expect(usage.tags).toEqual(expect.arrayContaining(["terrain", "lower", "passable"]));
      expect(usage.groups[0]).toEqual(
        expect.objectContaining({
          name: roadGroup.name,
          role: "terrain",
          defaultLayer: "lower",
        })
      );
      expect(usage.ruleText).toContain(roadGroup.placementRules);
    });

    it("marks groups with invalid structure rules as invalid", () => {
      // Given: a semantic group whose structural rules reference missing roles and out-of-range tiles.
      const tileset = defaultTileset();
      const invalidGroup = tileset.tileGroups?.find((group) => group.role === "roof");
      if (!invalidGroup) throw new Error("expected roof group");
      Object.assign(invalidGroup, {
        junctions: [
          { action: "omit", atRoles: ["missingPart"], side: "below", withRole: "wall" },
          { action: "omit", side: "above", withRole: "sky" },
        ],
        overlays: [{ tileIds: [tileset.count + 1], when: "ridge" }],
      });

      // When: the tileset checker evaluates generation readiness.
      const summary = summarizeTilesetGenerationReadiness(tileset);

      // Then: the malformed structural rule excludes that group from valid generation coverage.
      expect(summary.invalidGroups.map((group) => group.id)).toContain(invalidGroup.id);
    });
  });
});

describe("tileVocabAutotileCapability", () => {
  isolateTimers();
  /**
   * requireAutotileGroup 경로가 고른 그룹 id — isAutotileGroup 의 유일한 공개 관측창이다.
   * 오토타일이 아니라고 판정되면 "missing" 이 돌아온다.
   */
  function autotileGroupIdFor(tileset: TilesetDef, query: string): string {
    const result = resolveMaterialByLabel(tileset, query, { requireAutotileGroup: true });
    if (result.status === "missing") return "missing";
    return result.kind === "group" ? result.group.id : "tile";
  }
  /** 기본 타일셋의 water 그룹은 문법도 갖고 있다 — 역할 분기를 보려면 문법을 떼야 한다. */
  function tilesetWithoutWaterGrammar(): TilesetDef {
    const tileset = defaultTileset();
    tileset.tileGroups = (tileset.tileGroups ?? []).map((group) =>
      group.role === "water" ? { ...group, patternGrammar: undefined } : group
    );
    return tileset;
  }
  describe("오토타일 역할 (특성화)", () => {
    it("water 만 문법 없이도 오토타일로 취급된다", () => {
      const tileset = defaultTileset();
      expect(roleCapabilities(tileset, "water").autotile).toBe(true);
      for (const role of ["terrain", "wall", "roof", "prop", "fence", "building", "castle"]) {
        expect(roleCapabilities(tileset, role).autotile, role).toBe(false);
      }
    });

    // 위 테스트는 능력 표만 본다 — isAutotileGroup 을 한 번도 부르지 않는다.
    // 아래가 실제 판정을 두 분기로 갈라 통과시킨다.
    it("문법이 역할을 이긴다 — 문법 있는 terrain 은 오토타일, 문법 없는 fence 는 아니다", () => {
      const tileset = defaultTileset();
      // 잔디: role=terrain(autotile=false) 이지만 autotile_3x3 문법이 있어 오토타일이다.
      expect(autotileGroupIdFor(tileset, "잔디")).toBe("harness-combined-town-grass-autotile");
      // 울타리: role=fence + 문법 없음 → 오토타일이 아니다.
      expect(autotileGroupIdFor(tileset, "울타리")).toBe("missing");
    });

    it("문법을 잃은 water 그룹은 역할 능력만으로 오토타일을 유지한다", () => {
      expect(autotileGroupIdFor(tilesetWithoutWaterGrammar(), "애니메이션 물 오토타일")).toBe(
        "harness-combined-town-lake-water-autotile"
      );
    });
  });
});
