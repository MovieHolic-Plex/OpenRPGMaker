import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { isMediaSeparationOnly } from "@/project/mediaSeparationEquality";
import { sha256HexBytes } from "@/util/sha256";
import { deserialize, serialize, ProjectFormatError } from "@/project/io";
import { startSession } from "@/project/session";
import { applyTitleVariant, normalizeTitleScreenVariants, resolveTitleVariant } from "@/project/titleVariants";
import { recordEndingClear, readClearRecord } from "@/player/clearRecord";
import { createSaveSnapshot, latestResumableSave, readLatestSave, saveToSlot, writeAutosave } from "@/player/saveSlots";
import type { Project, SaveSnapshot, TitleScreenSettings, MonsterMetadataOverrides } from "@/project/types";
import { normalizeTerrainRecords } from "@/project/databaseUtilityRecordModel";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { applySideViewLanding, planSideViewTick, resolveSideViewSettings, sideViewFallDamage, sideViewGridFor, type SideViewGrid, type SideViewPlan, type SideViewState } from "@/player/sideViewPhysics";
import { applyMonsterMetadataDelta, resetMonsterMetadataOverride, setMonsterMetadataOverride } from "@/project/monsterMetadata";
import { ownsMonsterSpecies, type MonsterOwnershipState } from "../src/project/monsterOwnership";
import { isolateTimers } from "./mergedTeardown";

describe("mediaSeparationEquality", () => {
  isolateTimers();
  async function separated() {
    const before = createBlankProject();
    before.assets.uploaded = { art: { id: 'art', name: 'Opening', kind: 'picture', dataUrl: 'data:image/png;base64,AQID', meta: {} } };
    const after = structuredClone(before);
    delete after.assets.uploaded.art!.dataUrl;
    after.assets.uploaded.art!.ref = { sha256: await sha256HexBytes(new Uint8Array([1, 2, 3])), mime: 'image/png', bytes: 3, extension: 'png' };
    return { before, after };
  }
  describe('storage-only media adoption during an assistant turn', () => {
    it('recognizes identical verified bytes and leaves both input documents intact', async () => {
      const { before, after } = await separated(), source = JSON.stringify(before), target = JSON.stringify(after);
      expect(await isMediaSeparationOnly(before, after)).toBe(true);
      expect(JSON.stringify(before)).toBe(source); expect(JSON.stringify(after)).toBe(target);
    });
    it('keeps real asset and story edits outside this exemption', async () => {
      const { before, after } = await separated();
      after.assets.uploaded.art!.ref = { ...after.assets.uploaded.art!.ref!, sha256: 'a'.repeat(64) };
      expect(await isMediaSeparationOnly(before, after)).toBe(false);
      after.assets.uploaded.art!.ref = { ...after.assets.uploaded.art!.ref!, sha256: await sha256HexBytes(new Uint8Array([1, 2, 3])) };
      after.system.opening = { enabled: false, skippable: true, scenes: [] };
      expect(await isMediaSeparationOnly(before, after)).toBe(false);
    });
  });
});

describe("mgL7sysTitleVariants", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();
    get length(): number { return this.values.size; }
    clear(): void { this.values.clear(); }
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
    removeItem(key: string): void { this.values.delete(key); }
    setItem(key: string, value: string): void { this.values.set(key, value); }
  }
  function titleProject(): Project {
    const project = createBlankProject();
    const title = project.system.titleScreen!;
    title.backgroundResourceId = "bg_default";
    title.musicResourceId = "bgm_default";
    title.variants = [
      { when: { kind: "endingSeen", endingId: "ending_true" }, backgroundResourceId: "bg_true", musicResourceId: "bgm_true" },
      { when: { kind: "clearCount", atLeast: 2 }, backgroundResourceId: "bg_two" },
      { when: { kind: "saveMapId", mapId: "map_castle" }, musicResourceId: "bgm_castle" },
    ];
    return project;
  }
  function snapshotAt(project: Project, mapId: string, savedAt: string): SaveSnapshot {
    const session = startSession(project, 1);
    session.currentMapId = mapId;
    return { ...createSaveSnapshot(project, session), savedAt };
  }
  describe("title variants and resume on launch (#17)", () => {
    it("picks the first matching variant by ending, clear count and last save map", () => {
      const title = titleProject().system.titleScreen!;
      expect(resolveTitleVariant(title, {})).toBeUndefined();
      expect(applyTitleVariant(title, { endingIds: ["ending_true"] }).backgroundResourceId).toBe("bg_true");
      const two = applyTitleVariant(title, { endingIds: ["ending_a", "ending_b"] });
      expect(two.backgroundResourceId).toBe("bg_two");
      // 변형이 음악을 비워 두면 기본 음악 그대로.
      expect(two.musicResourceId).toBe("bgm_default");
      const castle = applyTitleVariant(title, { lastSaveMapId: "map_castle" });
      expect(castle.backgroundResourceId).toBe("bg_default");
      expect(castle.musicResourceId).toBe("bgm_castle");
      // 순서가 우선순위다 — 참 엔딩이 성 저장보다 앞선다.
      expect(applyTitleVariant(title, { endingIds: ["ending_true"], lastSaveMapId: "map_castle" }).musicResourceId).toBe("bgm_true");
    });

    it("reads the ending ids that recordEndingClear writes", () => {
      const project = titleProject();
      const storage = new MemoryStorage();
      recordEndingClear(storage, project, startSession(project, 1), "ending_true");
      const endingIds = readClearRecord(storage)?.endingIds ?? [];
      expect(applyTitleVariant(project.system.titleScreen!, { endingIds }).backgroundResourceId).toBe("bg_true");
    });

    it("readLatestSave returns the newest of the manual slots and the autosave", () => {
      const project = titleProject();
      const storage = new MemoryStorage();
      expect(readLatestSave(storage)).toBeUndefined();
      saveToSlot(storage, 1, snapshotAt(project, project.startMapId, "2026-01-01T00:00:00.000Z"));
      writeAutosave(storage, snapshotAt(project, project.startMapId, "2026-03-01T00:00:00.000Z"));
      saveToSlot(storage, 2, snapshotAt(project, project.startMapId, "2026-02-01T00:00:00.000Z"));
      expect(readLatestSave(storage)?.source).toBe("autosave");
      saveToSlot(storage, 3, snapshotAt(project, project.startMapId, "2026-04-01T00:00:00.000Z"));
      const latest = readLatestSave(storage);
      expect(latest?.source === "slot" ? latest.slot : undefined).toBe(3);
    });

    it("resume on launch targets the newest save only when the option is on", () => {
      const project = titleProject();
      const storage = new MemoryStorage();
      saveToSlot(storage, 2, snapshotAt(project, project.startMapId, "2026-02-01T00:00:00.000Z"));
      expect(latestResumableSave(project, storage)).toBeUndefined();
      project.system.titleScreen!.resumeOnLaunch = true;
      const latest = latestResumableSave(project, storage);
      expect(latest?.source === "slot" ? latest.slot : undefined).toBe(2);
      expect(latestResumableSave(project, new MemoryStorage())).toBeUndefined();
    });

    it("keeps variants and resumeOnLaunch through serialize/deserialize and drops invalid rows", () => {
      // 로드 검증은 리소스 id 가 실재하는지 본다 — 기본 프로젝트가 가진 타이틀 배경·음악 id 를 변형에 쓴다.
      const project = createBlankProject();
      const title = project.system.titleScreen!;
      const background = title.backgroundResourceId ?? project.system.titleResourceId;
      const music = title.musicResourceId;
      title.variants = [
        { when: { kind: "clearCount", atLeast: 1 }, ...(background ? { backgroundResourceId: background } : {}), ...(music ? { musicResourceId: music } : {}) },
        { when: { kind: "saveMapId", mapId: project.startMapId } },
      ];
      title.resumeOnLaunch = true;
      const reloaded = deserialize(serialize(project)).system.titleScreen as TitleScreenSettings;
      expect(reloaded.variants).toEqual(project.system.titleScreen!.variants);
      expect(reloaded.resumeOnLaunch).toBe(true);
      const legacy = deserialize(serialize(createBlankProject())).system.titleScreen!;
      expect(legacy.variants).toBeUndefined();
      expect(legacy.resumeOnLaunch).toBeUndefined();
      const broken = createBlankProject();
      broken.system.titleScreen!.variants = [{ when: { kind: "clearCount", atLeast: 1 }, backgroundResourceId: "missing_bg" }];
      expect(() => deserialize(serialize(broken))).toThrow(/variants\[0\]\.backgroundResourceId/);
      expect(normalizeTitleScreenVariants([
        { when: { kind: "endingSeen", endingId: " " } },
        { when: { kind: "nope" } },
        { when: { kind: "clearCount", atLeast: 0 }, backgroundResourceId: " bg " },
      ])).toEqual([{ when: { kind: "clearCount", atLeast: 1 }, backgroundResourceId: "bg" }]);
    });
  });
});

// 옆보기 필드(GameMap.sideView): 중력·점프·사다리·낙하 피해 — player/sideViewPhysics.ts.
describe("mgL8SideView", () => {
  isolateTimers();
  /** '#' 벽, 'H' 사다리, '.' 빈칸. */
  function gridOf(rows: string[]): SideViewGrid {
    const at = (x: number, y: number): string => rows[y]?.[x] ?? "#";
    return { solid: (x, y) => at(x, y) === "#", climbable: (x, y) => at(x, y) === "H" };
  }
  const SETTINGS = resolveSideViewSettings({});
  /** 입력을 주며 걸음을 즉시 적용해 틱을 돌린다(씬은 걸음 한 칸이 끝날 때마다 다음 틱을 부른다). */
  function run(grid: SideViewGrid, start: { x: number; y: number }, inputs: { x: number; y: number }[]) {
    const state: SideViewState = { fallTiles: 0, jumpRemaining: 0 };
    const pos = { ...start };
    const plans: SideViewPlan[] = [];
    for (const input of inputs) {
      const plan = planSideViewTick(grid, pos.x, pos.y, state, input, SETTINGS);
      plans.push(plan);
      pos.x += plan.dx;
      pos.y += plan.dy;
    }
    return { pos, plans, state };
  }
  const IDLE = { x: 0, y: 0 };
  describe("옆보기 중력", () => {
    it("발밑이 비면 입력 없이도 바닥까지 한 칸씩 떨어진다", () => {
      const grid = gridOf([
        "#####",
        "#...#",
        "#...#",
        "#...#",
        "#####",
      ]);
      const { pos, plans } = run(grid, { x: 2, y: 1 }, [IDLE, IDLE, IDLE, IDLE]);
      expect(plans.map((p) => p.kind)).toEqual(["fall", "fall", "none", "none"]);
      expect(pos).toEqual({ x: 2, y: 3 });
      expect(plans[2].landedFallTiles).toBe(2);
    });

    it("바닥에 서 있으면 떨어지지 않고 좌우로 걷는다", () => {
      const grid = gridOf(["#####", "#...#", "#####"]);
      const { pos, plans } = run(grid, { x: 1, y: 1 }, [{ x: 1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }]);
      expect(plans.map((p) => p.kind)).toEqual(["walk", "walk", "none"]);
      expect(pos).toEqual({ x: 3, y: 1 });
    });

    it("아래 방향키로는 땅을 파고 내려가지 않는다(탑다운 이동이 아니다)", () => {
      const grid = gridOf(["#####", "#...#", "#####"]);
      const { pos } = run(grid, { x: 2, y: 1 }, [{ x: 0, y: 1 }]);
      expect(pos).toEqual({ x: 2, y: 1 });
    });
  });
  describe("옆보기 점프", () => {
    it("위 키는 점프 높이만큼 오른 뒤 다시 떨어져 착지한다", () => {
      const grid = gridOf([
        "#####",
        "#...#",
        "#...#",
        "#...#",
        "#####",
      ]);
      const up = { x: 0, y: -1 };
      const { plans, pos } = run(grid, { x: 2, y: 3 }, [up, IDLE, IDLE, IDLE, IDLE]);
      expect(plans.map((p) => p.kind)).toEqual(["jump", "jump", "fall", "fall", "none"]);
      expect(pos).toEqual({ x: 2, y: 3 });
    });

    it("점프하며 옆으로 가면 턱 위에 올라선다", () => {
      const grid = gridOf([
        "######",
        "#....#",
        "#....#",
        "#..###",
        "######",
      ]);
      // (2,3) 에서 오른쪽 턱(x 3..4) 위로: 위+오른쪽으로 뛰고 계속 오른쪽을 누르면 턱 위 (4,2) 에 선다.
      const { pos, plans } = run(grid, { x: 2, y: 3 }, [{ x: 1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, IDLE]);
      expect(plans.map((p) => p.kind)).toEqual(["jump", "jump", "fall", "none"]);
      expect(pos).toEqual({ x: 4, y: 2 });
    });

    it("천장에 머리가 닿으면 상승을 멈춘다", () => {
      const grid = gridOf(["#####", "#...#", "#####"]);
      const { plans } = run(grid, { x: 2, y: 1 }, [{ x: 0, y: -1 }]);
      expect(plans[0].kind).toBe("none");
    });

    it("점프 높이 0 인 맵은 뛰지 않는다", () => {
      const grid = gridOf(["#####", "#...#", "#...#", "#####"]);
      const settings = resolveSideViewSettings({ sideViewJumpTiles: 0 });
      const state: SideViewState = { fallTiles: 0, jumpRemaining: 0 };
      expect(planSideViewTick(grid, 2, 2, state, { x: 0, y: -1 }, settings).kind).toBe("none");
    });
  });
  describe("옆보기 사다리", () => {
    it("사다리 칸에서는 떨어지지 않고 위아래로 오른다", () => {
      const grid = gridOf([
        "#####",
        "#.H.#",
        "#.H.#",
        "#.H.#",
        "#####",
      ]);
      const up = { x: 0, y: -1 };
      const climbed = run(grid, { x: 2, y: 3 }, [up, up, IDLE, IDLE]);
      expect(climbed.plans.map((p) => p.kind)).toEqual(["climb", "climb", "none", "none"]);
      expect(climbed.pos).toEqual({ x: 2, y: 1 });
      const down = run(grid, { x: 2, y: 1 }, [{ x: 0, y: 1 }]);
      expect(down.plans[0].kind).toBe("climb");
      expect(down.pos).toEqual({ x: 2, y: 2 });
    });

    it("사다리 꼭대기 위 칸에 서 있으면 사다리를 발판으로 딛는다", () => {
      const grid = gridOf(["#####", "#...#", "#.H.#", "#####"]);
      const { plans } = run(grid, { x: 2, y: 1 }, [IDLE]);
      expect(plans[0].kind).toBe("none");
    });
  });
  describe("옆보기 낙하 피해", () => {
    it("기준 칸 수를 넘은 만큼만 칸당 피해", () => {
      expect(sideViewFallDamage(4, SETTINGS)).toBe(0);
      expect(sideViewFallDamage(6, SETTINGS)).toBe(20);
      expect(sideViewFallDamage(3, resolveSideViewSettings({ sideViewFallTiles: 1, sideViewFallDamage: 5 }))).toBe(10);
    });

    it("긴 낙하 끝 착지가 파티 HP 를 깎는다", () => {
      const rows = ["#####", ...Array.from({ length: 8 }, () => "#...#"), "#####"];
      const { plans } = run(gridOf(rows), { x: 2, y: 1 }, Array.from({ length: 9 }, () => IDLE));
      const landing = plans.find((p) => p.landedFallTiles !== undefined);
      expect(landing?.landedFallTiles).toBe(7);

      const project = createBlankProject();
      const actorId = project.database.actors[0].id;
      const session = { partyActorIds: [actorId], actorVitals: {} as Record<string, { hp: number; mp: number }> };
      const result = applySideViewLanding(project, session as never, 7, SETTINGS);
      expect(result.damage).toBe(30);
      const vitals = session.actorVitals[actorId];
      expect(vitals).toBeDefined();
      expect(result.defeated).toBe(vitals.hp <= 0);
    });
  });
  describe("옆보기 프로젝트 격자", () => {
    it("타일 통행과 지형 climbable 을 읽고, climbable 은 불러오기 정규화에서 살아남는다", () => {
      // TILE.* are combined-town chip ids (water solid, grass open); the start map is beodeul_city since the 2026-10-07 purge.
      const project = startOnRetiredCombinedTown(createBlankProject());
      const map = project.maps[project.startMapId];
      const tileset = project.tilesets[map.tilesetId];
      map.lowerTiles.fill(TILE.GRASS);
      map.lowerTiles[0] = TILE.WATER;
      tileset.tileMeta ??= {};
      tileset.tileMeta[TILE.PATH] = { ...(tileset.tileMeta[TILE.PATH] ?? {}), terrainTag: 1 };
      map.lowerTiles[map.width + 1] = TILE.PATH;
      const terrains = normalizeTerrainRecords([{ id: "ladder", name: "사다리", climbable: true }]);
      expect(terrains[0].climbable).toBe(true);
      expect(normalizeTerrainRecords([{ id: "ground", name: "땅" }])[0]).not.toHaveProperty("climbable");
      project.database.terrains = terrains;
      const grid = sideViewGridFor(project, map);
      expect(grid.solid(0, 0)).toBe(true);
      expect(grid.solid(-1, 0)).toBe(true);
      expect(grid.solid(2, 2)).toBe(false);
      expect(grid.climbable(1, 1)).toBe(true);
      expect(grid.climbable(2, 2)).toBe(false);
    });
  });
});

describe("monsterMetadata", () => {
  isolateTimers();
  const scenarios: readonly { readonly name: string; readonly base?: MonsterMetadataOverrides; readonly local?: MonsterMetadataOverrides; readonly latest?: MonsterMetadataOverrides; readonly expected?: MonsterMetadataOverrides }[] = [
    { name: "different fields", base: { raw: { name: "B", tags: ["B"] } }, local: { raw: { name: "L", tags: ["B"] } }, latest: { raw: { name: "B", tags: ["R"], description: "R" } }, expected: { raw: { name: "L", tags: ["R"], description: "R" } } },
    { name: "same-field local wins", base: { raw: { description: "B" } }, local: { raw: { description: "L" } }, latest: { raw: { description: "R" } }, expected: { raw: { description: "L" } } },
    { name: "explicit clears", base: { raw: { description: "B", tags: ["B"] } }, local: { raw: { description: "", tags: [] } }, latest: { raw: { description: "R", tags: ["R"] } }, expected: { raw: { description: "", tags: [] } } },
    { name: "local reset preserves remote-only fields", base: { raw: { name: "B" } }, latest: { raw: { name: "R", tags: ["R"] } }, expected: { raw: { tags: ["R"] } } },
    { name: "last field reset prunes containers", base: { raw: { name: "B" } }, latest: { raw: { name: "R" } } },
    { name: "remote reset", base: { raw: { name: "B" } }, local: { raw: { name: "B" } } },
    { name: "remote addition", latest: { remote: { description: "R" } }, expected: { remote: { description: "R" } } },
    { name: "different resources", local: { local: { name: "L" } }, latest: { remote: { name: "R" } }, expected: { local: { name: "L" }, remote: { name: "R" } } },
    { name: "own raw IDs and stored whitespace", local: { ["__proto__"]: { description: " \nL " } }, latest: { constructor: { name: "R" } }, expected: { ["__proto__"]: { description: " \nL " }, constructor: { name: "R" } } },
  ];
  describe("monster metadata writes", () => {
    it("trims and deduplicates new fields when patching one resource", () => {
      // Given
      const before = { raw: { name: "Original", description: " unchanged " }, orphan: { tags: ["legacy"] } };
      const snapshot = structuredClone(before);
      // When
      const result = setMonsterMetadataOverride(before, "raw", { name: " New ", tags: [" bat ", "bat", " ", "wing"], description: " \nnew\ntext \n" });
      // Then
      expect(result).toEqual({ raw: { name: "New", tags: ["bat", "wing"], description: "new\ntext" }, orphan: { tags: ["legacy"] } });
      expect(before).toEqual(snapshot);
    });

    it("preserves sibling fields and raw key identity when writing a partial patch", () => {
      // Given
      const before = { ["__proto__"]: { name: "Original", tags: ["old"] } };
      // When
      const result = setMonsterMetadataOverride(before, "__proto__", { description: "" });
      // Then
      expect(result).toEqual({ ["__proto__"]: { name: "Original", tags: ["old"], description: "" } });
      expect(Object.hasOwn(result, "__proto__")).toBe(true);
    });

    it.each([{ name: " " }, { name: "x".repeat(121) }, { description: "x".repeat(4001) }, { tags: ["x".repeat(65)] }, { tags: Array.from({ length: 33 }, (_, index) => String(index)) }, { tags: [7] }])("rejects invalid new fields when patch is %j", (patch) => {
      // Given / When / Then
      expect(() => setMonsterMetadataOverride(undefined, "raw", patch)).toThrow(ProjectFormatError);
    });

    it("prunes the final override when resetting a resource", () => {
      // Given
      const before = { raw: { description: "" } };
      // When
      const result = resetMonsterMetadataOverride(before, "raw");
      // Then
      expect(result).toBeUndefined();
      expect(before).toEqual({ raw: { description: "" } });
    });

    it("ignores inherited keys when resetting an unknown resource", () => {
      // Given
      const before = { other: { name: "Other" } };
      // When
      const result = resetMonsterMetadataOverride(before, "constructor");
      // Then
      expect(result).toBe(before);
    });
  });
  describe("monster metadata three-way delta", () => {
    it.each(scenarios)("merges per-field state when $name", ({ base, local, latest, expected }) => {
      // Given
      const snapshot = structuredClone({ base, local, latest });
      // When
      const result = applyMonsterMetadataDelta(base, local, latest);
      // Then
      expect(result).toEqual(expected);
      expect({ base, local, latest }).toEqual(snapshot);
    });
  });
});

describe("monsterOwnership", () => {
  isolateTimers();
  describe("live monster species ownership", () => {
    const instances = {
      starter: { speciesId: "burrlock", hp: 0 },
      captured: { speciesId: "merin" },
      released: { speciesId: "howler" },
    };
    const state: MonsterOwnershipState = {
      monsterInstances: instances,
      monsterParty: ["starter"],
      monsterBox: ["captured", "missing"],
    };

    it("counts party members even when fainted and counts boxed captures", () => {
      expect(ownsMonsterSpecies(state, "burrlock")).toBe(true);
      expect(ownsMonsterSpecies(state, "merin")).toBe(true);
    });

    it("does not mistake an orphan instance for an owned monster", () => {
      expect(ownsMonsterSpecies(state, "howler")).toBe(false);
      expect(ownsMonsterSpecies(state, "missing")).toBe(false);
    });

    it("preserves ownership through party-to-box transfer and loses it on release", () => {
      const boxed = { ...state, monsterParty: [], monsterBox: ["starter", "captured"] };
      expect(ownsMonsterSpecies(boxed, "burrlock")).toBe(true);
      expect(ownsMonsterSpecies({ ...boxed, monsterBox: ["captured"] }, "burrlock")).toBe(false);
    });

    it("handles old saves and compares exact species IDs rather than instance IDs", () => {
      expect(ownsMonsterSpecies({}, "burrlock")).toBe(false);
      expect(ownsMonsterSpecies(state, "starter")).toBe(false);
      expect(ownsMonsterSpecies(state, "BURRLOCK")).toBe(false);
      expect(ownsMonsterSpecies(state, "")).toBe(false);
    });

    it("ignores inherited records even if a damaged membership list references them", () => {
      const inherited = Object.create({ ghost: { speciesId: "howler" } });
      expect(ownsMonsterSpecies({ monsterInstances: inherited, monsterParty: ["ghost"] }, "howler")).toBe(false);
    });
  });
});
