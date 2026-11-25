import { describe, expect, it, afterEach, vi } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSkillRecord, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { normalizeActionSkillProfile, isActionCombatMap } from "@/project/actionCombat";
import { normalizeMapClimate } from "@/project/mapClimate";
import { serialize, deserialize } from "@/project/io";
import { composeGothicPlace, GOTHIC_PLACE_KINDS } from "@/editor/gothic/composer";
import { BUILD_GOTHIC_PLACE_TOOL, GOTHIC_ROOM_KEYS } from "@/editor/tools/gothicPlaceTools";
import { createGothicManorTileset, ensureGothicManorTileset, GOTHIC_MANOR_FAMILY, GOTHIC_MANOR_ID } from "@/project/defaults/gothicManor";
import { passabilityOf } from "@/project/collision";
import { isOpeningStillAvailable, setInstalledStillPackFiles } from "@/assets/installedStillPack";
import { listOpeningStillMoods, unsuitableOpeningStillMessage } from "@/assets/openingStillMoods";
import { rejectUnavailablePackStills } from "@/editor/tools/stillPackGuard";
import { guessMapRole } from "@/ai/mapPlacementContext";
import { isMapRoleKind } from "@/project/mapRole";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { TILE } from "@/project/defaults/constants";
import { isBlankStartProject, isUntouchedMap } from "@/project/projectBlankness";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { PIXEL_ENEMY_PORTRAIT_URLS } from "@/assets/pixelEnemyPortraits";
import { DEFAULT_BATTLE_SKIN_ID, isRetiredBattleSkinId, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import { parseGeneratedRecord } from "@/editor/aiDatabaseGeneration";
import { isolateTimers } from "./mergedTeardown";

describe("feature16WorldSchema", () => {
  isolateTimers();
  describe("feature16 world persistence", () => {
    it("keeps unset legacy climate absent through save/load", () => {
      const project = createBlankProject();
      const loaded = deserialize(serialize(project));
      expect(loaded.maps[loaded.startMapId]).not.toHaveProperty("climate");
      expect(isActionCombatMap(loaded, loaded.maps[loaded.startMapId])).toBe(false);
    });
    it.each(["inherit", "indoor", "fixed"] as const)("round trips %s climate and every skill profile", (mode) => {
      const project = createBlankProject();
      project.maps[project.startMapId]!.climate = mode === "fixed" ? { mode, weather: "snow", intensity: 0.8 } : { mode };
      const skills = (["projectile", "melee", "dash", "trap"] as const).map((kind) => normalizeSkillRecord({
        id: `feature16_${kind}`, name: kind,
        actionSkill: { kind, damage: 23, range: 3, cooldownMs: 650, durationMs: 4000, fieldStatus: { kind: "poison", durationMs: 2000 } },
      }));
      project.database.skills.push(...skills);
      const loaded = deserialize(serialize(project));
      expect(loaded.maps[loaded.startMapId]!.climate).toEqual(project.maps[project.startMapId]!.climate);
      for (const skill of skills) expect(loaded.database.skills.find((s) => s.id === skill.id)?.actionSkill).toEqual(skill.actionSkill);
    });
    it("bounds malformed optional authoring without enabling unknown profiles", () => {
      expect(normalizeMapClimate({ mode: "fixed", weather: "snow", intensity: Infinity })).toEqual({ mode: "fixed", weather: "snow", intensity: 0.5 });
      expect(normalizeMapClimate({ mode: "indoor", weather: "rain" })).toEqual({ mode: "indoor" });
      expect(normalizeMapClimate({ mode: "typo" })).toBeUndefined();
      expect(normalizeActionSkillProfile({ kind: "trap", range: 99, damage: -1, durationMs: Infinity,
        fieldStatus: { kind: "slow", durationMs: 90000 } })).toMatchObject({ range: 20, damage: 1, durationMs: 5000, fieldStatus: { durationMs: 30000 } });
    });
  });
});

// gothic_manor 장소 빌더 — 야외 구성기 3종과 실내 8종이 오류 없이 한 덩이 통행으로 지어지고, 번들 정의가 새 프로젝트에 들어온다.
// 이 파일은 작성 시 실행하지 않았다(not run) — 감독자 게이트에서 돈다.
describe("gothicPlace", () => {
  isolateTimers();
  describe("gothic_manor 번들", () => {
    it("새 프로젝트가 칩셋과 참고문서를 들고 태어난다", () => {
      const p = createBlankProject();
      const ts = p.tilesets[GOTHIC_MANOR_ID];
      expect(ts?.family).toBe(GOTHIC_MANOR_FAMILY);
      expect(ts?.roomKit).toEqual({ builtin: GOTHIC_MANOR_ID });
      expect((ts?.referenceDocuments ?? []).some((c) => c.id === "gm-start")).toBe(true);
      for (const c of ts?.referenceDocuments ?? []) for (const im of c.images) expect(im.dataUrl.startsWith("/assets/gothic-manor-references/")).toBe(true);
    });
    it("옛 굽기 사본의 칸 표를 맞춘다", () => {
      const ts = createGothicManorTileset();
      ts.tileGroups = []; ts.family = undefined;
      expect(ensureGothicManorTileset(ts)).toBe(true);
      expect(ts.family).toBe(GOTHIC_MANOR_FAMILY);
      expect(ts.tileGroups?.length).toBeGreaterThan(0);
    });
  });
  describe("야외 구성기", () => {
    const ts = createGothicManorTileset();
    it.each(GOTHIC_PLACE_KINDS.flatMap((place) => [1, 2, 3].map((seed) => [place, seed] as const)))("%s seed %d", (place, seed) => {
      const r = composeGothicPlace({ place, seed }, ts);
      expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(r.entrances.length).toBeGreaterThan(0);
      // 문 앞 접근칸·정문은 통행이다
      for (const c of [...r.entrances.map((e) => e.access), ...r.exits, r.spawn]) {
        const i = c.y * r.width + c.x;
        const pf = passabilityOf(ts, r.lowerTiles[i]!, r.lowerOverlayTiles[i]!, r.upperTiles[i]!, r.upperOverlayTiles[i]!);
        expect(pf.up || pf.down || pf.left || pf.right).toBe(true);
      }
    });
    it("크기 범위 밖은 오류", () => {
      expect(composeGothicPlace({ place: "graveyard", width: 10, height: 10 }, ts).issues[0]?.code).toBe("SIZE_OUT_OF_RANGE");
    });
  });
  describe("build_gothic_place", () => {
    it.each([...GOTHIC_PLACE_KINDS, ...GOTHIC_ROOM_KEYS])("%s 를 새 맵에 짓는다", (place) => {
      const draft = createBlankProject();
      const res = BUILD_GOTHIC_PLACE_TOOL.run!(draft, { place, seed: 1 }) as { data: { mapId: string } };
      const map = draft.maps[res.data.mapId]!;
      expect(map.tilesetId).toBe(GOTHIC_MANOR_ID);
      expect(map.lowerTiles.length).toBe(map.width * map.height);
    });
  });
});

describe("installedStillPack", () => {
  isolateTimers();
  afterEach(() => { setInstalledStillPackFiles(null); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  describe("opening still pack availability", () => {
    it("hides and rejects pack stills that are not installed", () => {
      setInstalledStillPackFiles([]);
      expect(isOpeningStillAvailable("oprn-pack-still-sky-01")).toBe(false);
      expect(isOpeningStillAvailable("oprn-still-harbor")).toBe(true);
      expect(listOpeningStillMoods().some((mood) => mood.id.startsWith("oprn-pack-still-"))).toBe(false);
      expect(unsuitableOpeningStillMessage("oprn-pack-still-sky-01", "bg")).toContain("stills:install");
    });

    it("offers installed pack stills", () => {
      setInstalledStillPackFiles(["sky-01.jpg"]);
      expect(isOpeningStillAvailable("oprn-pack-still-sky-01")).toBe(true);
      expect(isOpeningStillAvailable("oprn-pack-still-sky-02")).toBe(false);
      expect(listOpeningStillMoods().map((mood) => mood.id)).toContain("oprn-pack-still-sky-01");
    });

    it("treats a configured CDN as available", () => {
      setInstalledStillPackFiles([]);
      vi.stubEnv("VITE_STILL_CDN_BASE", "https://cdn.example.test");
      expect(isOpeningStillAvailable("oprn-pack-still-sky-01")).toBe(true);
    });

    it("rejects only newly added unavailable references", () => {
      setInstalledStillPackFiles([]);
      const before = createBlankProject();
      const draft = structuredClone(before);
      draft.endings = [{ id: "e", name: "e", presentation: { backgroundResourceId: "oprn-pack-still-winter-02" } } as never];
      expect(() => rejectUnavailablePackStills(before, draft)).toThrow(/stills:install/);
      expect(() => rejectUnavailablePackStills(draft, structuredClone(draft))).not.toThrow();
    });
  });
});

describe("mapRole", () => {
  isolateTimers();
  describe("map role", () => {
    it("accepts only known kinds", () => {
      expect(isMapRoleKind("town")).toBe(true);
      expect(isMapRoleKind("castle")).toBe(false);
      expect(isMapRoleKind(undefined)).toBe(false);
    });

    it("prefers the author's choice over encounter signals", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.encounterRate = 25;
      map.encounterTable = [{ troopId: project.database.troops[0]!.id, weight: 1 }];
      map.mapRole = "town";
      expect(guessMapRole(project, map)).toMatchObject({ role: "town", explicit: true });
    });

    it("set_map_properties sets, rejects unknown, and clears with auto", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      expect(runTool(ctx as never, "set_map_properties", { mapId, mapRole: "dungeon" }).ok).toBe(true);
      expect(ctx.project.maps[mapId]!.mapRole).toBe("dungeon");
      expect(runTool(ctx as never, "set_map_properties", { mapId, mapRole: "castle" }).ok).toBe(false);
      expect(runTool(ctx as never, "set_map_properties", { mapId, mapRole: "auto" }).ok).toBe(true);
      expect(ctx.project.maps[mapId]!.mapRole).toBeUndefined();
    });
  });
});

describe("projectBlankness", () => {
  isolateTimers();
  // 첫 방문 브리핑(「빈 맵으로 시작」)은 이 판정이 true 일 때만 뜬다(src/app/mode.ts finishEditorBoot).
  describe("isBlankStartProject", () => {
    it("treats a freshly created project as blank", () => {
      expect(isBlankStartProject(createBlankProject())).toBe(true);
    });

    it("is not blank once the only map has an event", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.events.push({ id: "ev_1", name: "NPC", x: 1, y: 1, pages: [] } as unknown as (typeof map.events)[number]);
      expect(isBlankStartProject(project)).toBe(false);
    });

    it("is not blank once any tile layer is painted", () => {
      type Map = ReturnType<typeof createBlankMap>;
      const edits: ((map: Map) => void)[] = [
        (map) => { map.lowerTiles[3] = TILE.WATER; },
        (map) => { map.upperTiles[3] = TILE.TREE; },
        (map) => { map.lowerOverlayTiles = map.lowerTiles.map(() => TILE.EMPTY); map.lowerOverlayTiles[0] = 7; },
        (map) => { map.shadowBits = map.lowerTiles.map(() => 0); map.shadowBits[0] = 1; },
        (map) => { map.relief = { width: map.width, height: map.height, levels: map.lowerTiles.map(() => 0) }; map.relief.levels[0] = 2; },
      ];
      for (const edit of edits) {
        const map = createBlankMap("m", 4, 4);
        expect(isUntouchedMap(map)).toBe(true);
        edit(map);
        expect(isUntouchedMap(map)).toBe(false);
      }
    });

    it("keeps empty optional layers blank", () => {
      const map = createBlankMap("m", 3, 3);
      map.lowerOverlayTiles = map.lowerTiles.map(() => TILE.EMPTY);
      map.shadowBits = map.lowerTiles.map(() => 0);
      expect(isUntouchedMap(map)).toBe(true);
    });

    it("is not blank with a second map or a common event", () => {
      const twoMaps = createBlankProject();
      const extra = createBlankMap("second", 4, 4);
      twoMaps.maps[extra.id] = extra;
      expect(isBlankStartProject(twoMaps)).toBe(false);

      const withCommon = createBlankProject();
      withCommon.commonEvents.push({ id: "ce_1" } as unknown as (typeof withCommon.commonEvents)[number]);
      expect(isBlankStartProject(withCommon)).toBe(false);
    });
  });
});

describe("setStartOrphanWarning", () => {
  isolateTimers();
  function withSecondMap() {
    const ctx = { project: createBlankProject() };
    const created = runTool(ctx, "create_map", { name: "저택 1층", width: 20, height: 15 });
    expect(created.ok, JSON.stringify(created)).toBe(true);
    const oldStart = ctx.project.startMapId;
    const mapId = Object.keys(ctx.project.maps).find((id) => id !== oldStart)!;
    return { ctx, oldStart, mapId };
  }
  describe("set_start_position 이 빈 옛 시작 맵을 알린다", () => {
    it("이벤트·문 없는 옛 시작 맵이면 remove_map 을 안내한다", () => {
      const { ctx, oldStart, mapId } = withSecondMap();
      ctx.project.maps[oldStart].events = [];
      const result = runTool(ctx, "set_start_position", { mapId, x: 5, y: 5 });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(ctx.project.startMapId).toBe(mapId);
      expect(JSON.stringify(result)).toContain(`remove_map { mapId: \\"${oldStart}\\" }`);
    });

    it("옛 시작 맵에 이벤트가 있으면 조용하다", () => {
      const { ctx, oldStart, mapId } = withSecondMap();
      ctx.project.maps[oldStart].events = [{ id: "ev", name: "npc", x: 1, y: 1, trigger: { kind: "action" }, commands: [] } as never];
      const result = runTool(ctx, "set_start_position", { mapId, x: 5, y: 5 });
      expect(result.ok).toBe(true);
      expect(JSON.stringify(result)).not.toContain("remove_map");
    });
  });
});

// 전투는 전부 도트 측면이다(2026-10-02) — 정면 전투 스킨 다섯(rm2000·dragonquest·mother·mv·vxace)과
// 몬스터 그림 생성을 지웠고, 같은 날 창 색만 다르던 측면 스킨 여섯(rm2003·octopath·chrono·bravely·ff·goldensun)도 지웠다. 이 파일은 그 전환의 경계 계약만 한곳에 못 박는다:
//   - 저장된 옛 스킨 id 는 기본 도트 측면(retro2003)으로 풀리고 저장에서 지워진다.
//   - 스킨 공용 정면 적 그림(bskin-enemy-*)은 지웠고, 옛 id 는 도트 슬라임 초상으로 풀린다.
//   - 조수·자료집 AI 는 몬스터 그림을 새로 만들 수 없고 도트 몬스터(140종) 중에서 고른다.
// 몬스터 그림 자체의 폐기·140종 도트 계약은 openwiki/native-enemy-retirement.md 쪽 시험이 맡는다.
describe("sideOnlyBattle", () => {
  isolateTimers();
  const RETIRED_SKINS = ["classic", "rm2000", "dragonquest", "mother", "mv", "vxace", "rm2003", "octopath", "chrono", "bravely", "ff", "goldensun"] as const;
  describe("지운 전투 스킨 id", () => {
    it.each(RETIRED_SKINS)("%s 는 기본 도트 측면(retro2003)으로 풀린다", (id) => {
      expect(resolveSkinId(id)).toBe("retro2003");
      expect(isRetiredBattleSkinId(id)).toBe(true);
      expect(listBattleSkinIds() as string[]).not.toContain(id);
    });

    it("미설정·모르는 값도 retro2003 이고, 남은 스킨은 그대로다", () => {
      expect(DEFAULT_BATTLE_SKIN_ID).toBe("retro2003");
      expect(resolveSkinId(undefined)).toBe("retro2003");
      expect(resolveSkinId("bogus")).toBe("retro2003");
      for (const id of ["retro2003", "pokemon"]) {
        expect(resolveSkinId(id)).toBe(id);
        expect(isRetiredBattleSkinId(id)).toBe(false);
      }
    });

    it.each(["rm2000", "vxace", "octopath"])("normalizeSystemRecords 는 저장된 %s 를 지운다(기본 retro2003 으로 열린다)", (id) => {
      const project = createBlankProject();
      (project.system as { battleUiStyle?: string }).battleUiStyle = id;
      expect("battleUiStyle" in normalizeSystemRecords(project.system)).toBe(false);
    });

    it("normalizeSystemRecords 는 명시한 포켓몬 스킨을 보존한다", () => {
      const project = createBlankProject();
      project.system.battleUiStyle = "pokemon";
      expect(normalizeSystemRecords(project.system).battleUiStyle).toBe("pokemon");
    });
  });
  describe("스킨 공용 정면 적 그림", () => {
    it.each(["rm2003", "rm2000", "dragonquest", "mother", "octopath", "chrono", "bravely", "ff", "goldensun"])("bskin-enemy-%s 는 도트 슬라임 초상으로 풀린다", (id) => {
      expect(resolveAssetResourceUrl(`bskin-enemy-${id}`)).toBe(PIXEL_ENEMY_PORTRAIT_URLS["generated-enemy-slime-01"]);
    });
  });
  describe("자료집 AI 적 생성", () => {
    it("목록 안 id 는 그대로, 목록 밖 id 는 이름 조각으로, 그래도 없으면 슬라임으로", () => {
      expect(parseGeneratedRecord("enemy", '{"name":"서슬 늑대","monsterResourceId":"generated-enemy-wolf-grey"}').monsterResourceId)
        .toBe("generated-enemy-wolf-grey");
      expect(parseGeneratedRecord("enemy", '{"name":"동굴 박쥐","monsterResourceId":"bat"}').monsterResourceId)
        .toMatch(/^generated-enemy-bat/);
      expect(parseGeneratedRecord("enemy", '{"name":"이름없는 것","monsterResourceId":"quux"}').monsterResourceId)
        .toBe("generated-enemy-slime-01");
    });
  });
  describe("몬스터 그림 생성 금지", () => {
    it("generate_image_asset 는 kind monster 를 거절한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "generate_image_asset", { kind: "monster", prompt: "눈 덮인 산에서 포효하는 얼음 늑대", tags: ["늑대"] });
      expect(result.ok).toBe(false);
      expect(result.issues?.map((issue) => issue.code)).toContain("invalid-args");
      // 유효한 kind 는 kind 거절이 아니다. 이 실행 경로엔 생성기가 없어 하드 오류(image-generation-unavailable)로 끝난다(b3e9e1d206) — 성공으로 읽히지 않는다.
      const backdrop = runTool(ctx, "generate_image_asset", { kind: "backdrop", prompt: "불타는 화산 동굴" });
      expect(backdrop.issues?.map((issue) => issue.code)).not.toContain("invalid-args");
      expect(backdrop.issues?.map((issue) => issue.code)).toContain("image-generation-unavailable");
    });
  });
});
