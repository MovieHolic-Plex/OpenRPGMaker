import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { applyTerrainWalkDamage, scaledEncounterRate } from "@/project/terrainStep";
import { directionalPassageFromPreset, togglePassageDirection } from "@/project/tilesetPassage";
import type { PassFlag, TilesetDef, Project } from "@/project/types";
import { tilesetKind } from "@/project/tilesetKind";
import { compileTilesetKnowledge, repeatKnowledgeBlock, type TilesetKnowledgeTemplate } from "@/project/tilesetKnowledge";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { GENRE_PACK_IDS } from "@/project/genrePackId";
import { padRuns, stickSector, stickSectorKeys } from "@/player/touchPad";
import { normalizeTouchControls, resolveTouchControls } from "@/project/touchControls";
import { createTransitSim, stepTransitSim, transitPose, transitRectCells, type MapTransit } from "@/project/mapTransit";
import { buildWorldDigest, lintWorld, normalizeProjectWorld, normalizeWorld, type ProjectWorld, type WorldEntity } from "@/project/world";
import { isolateTimers } from "./mergedTeardown";

describe("terrainStep", () => {
  isolateTimers();
  function sessionWithParty(project: ReturnType<typeof createBlankProject>): PlaySessionLike {
    const actorId = project.database.actors[0]?.id;
    if (!actorId) throw new Error("missing default actor");
    return {
      flags: {},
      switches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [actorId],
      actorVitals: {},
      currentMapId: project.startMapId,
      x: 0,
      y: 0,
    };
  }
  describe("scaledEncounterRate", () => {
    it("multiplies map rate by terrain percent", () => {
      expect(scaledEncounterRate(1000, 50)).toBe(500);
      expect(scaledEncounterRate(1000, undefined)).toBe(1000);
      expect(scaledEncounterRate(1000, 0)).toBe(0);
      expect(scaledEncounterRate(0, 100)).toBe(0);
    });
  });
  describe("applyTerrainWalkDamage", () => {
    it("reduces party hp by terrain damage", () => {
      const project = createBlankProject();
      const session = sessionWithParty(project);
      const result = applyTerrainWalkDamage(project, session, 5);
      expect(result.applied).toBe(5);
      const actorId = session.partyActorIds[0] as string;
      const vitals = session.actorVitals[actorId];
      expect(vitals).toBeDefined();
      expect(vitals?.hp).toBe((vitals?.maxHp ?? 0) - 5);
      expect(result.defeated).toBe(false);
    });

    it("reports defeat when damage wipes the party", () => {
      const project = createBlankProject();
      const session = sessionWithParty(project);
      const result = applyTerrainWalkDamage(project, session, 99999);
      expect(result.defeated).toBe(true);
      const actorId = session.partyActorIds[0] as string;
      expect(session.actorVitals[actorId]?.hp).toBe(0);
    });

    it("ignores zero damage", () => {
      const project = createBlankProject();
      const session = sessionWithParty(project);
      const result = applyTerrainWalkDamage(project, session, 0);
      expect(result.applied).toBe(0);
      expect(result.defeated).toBe(false);
    });
  });
});

describe("tilesetDirectionalPassage", () => {
  isolateTimers();
  describe("directional tileset passage", () => {
    it("maps O, X, and star without collapsing explicit arrows", () => {
      expect(directionalPassageFromPreset("open")).toEqual({
        passability: { down: true, left: true, right: true, up: true },
        priority: "lower",
      });
      expect(directionalPassageFromPreset("blocked")).toEqual({
        passability: { down: false, left: false, right: false, up: false },
        priority: "lower",
      });
      expect(directionalPassageFromPreset("star")).toEqual({
        passability: { down: true, left: true, right: true, up: true },
        priority: "upper",
      });
    });

    it("toggles exactly one movement direction", () => {
      const passage: PassFlag = { down: false, left: true, right: false, up: true };

      expect(togglePassageDirection(passage, "right")).toEqual({ down: false, left: true, right: true, up: true });
      expect(passage).toEqual({ down: false, left: true, right: false, up: true });
    });
  });
});

describe("tilesetKind", () => {
  isolateTimers();
  function tileset(overrides: Partial<TilesetDef> = {}): TilesetDef {
    const count = overrides.count ?? 480;
    return {
      id: "legacy_tileset",
      name: "Legacy tileset",
      image: { type: "bundled", id: "legacy_sheet" },
      tileSize: 16,
      tilesPerRow: 30,
      count,
      passability: Array.from({ length: count }, () => ({ down: true, left: true, right: true, up: true })),
      priority: Array.from({ length: count }, () => "lower" as const),
      terrain: Array.from({ length: count }, () => 0),
      ...overrides,
    };
  }
  describe("tilesetKind legacy inference", () => {
    it("keeps a kind-less bundled 480-chip sheet RPG2K-compatible", () => {
      expect(tilesetKind(tileset())).toBe("rpg2k");
    });

    it("infers a kind-less uploaded atlas as custom", () => {
      expect(tilesetKind(tileset({ image: { type: "uploaded", id: "upload_legacy" } }))).toBe("custom");
    });

    it("infers a kind-less non-480 bundled atlas as custom", () => {
      expect(tilesetKind(tileset({ count: 256 }))).toBe("custom");
    });
  });
});

describe("tilesetKnowledgeTemplates", () => {
  isolateTimers();
  const open: PassFlag = { down: true, left: true, right: true, up: true };
  describe("tileset knowledge templates", () => {
    it.each([
      ["water-autotile-3x3", 3, 3, "autotile_3x3"],
      ["water-atlas-9x9", 9, 9, "source_rect"],
      ["desk", 2, 1, "source_rect"],
      ["tree", 2, 3, "source_rect"],
      ["one-way-path", 3, 3, "autotile_3x3"],
      ["repeatable-cliff-2x3", 2, 3, "repeatable_block"],
    ] as const)("compiles %s from an exact rectangle", (template, width, height, grammarKind) => {
      const tileIds = rectangleTiles(10, 1, 2, width, height);
      const passage = template === "one-way-path" ? { down: false, left: true, right: false, up: true } : open;
      const result = compileTilesetKnowledge({
        groupId: `group-${template}`,
        name: template,
        passage,
        template: template satisfies TilesetKnowledgeTemplate,
        tileCount: 200,
        tileIds,
        tilesPerRow: 10,
      });

      expect(result.kind).toBe("valid");
      if (result.kind !== "valid") return;
      expect(result.value.group.sourceRect).toEqual({ height, width, x: 1, y: 2 });
      expect(result.value.group.patternGrammar?.kind).toBe(grammarKind);
      expect(result.value.group.tileIds).toEqual(tileIds);
      expect(result.value.rules.every((rule) => rule.passage.down === passage.down)).toBe(true);
    });

    it("splits a 9x9 water atlas into nine ordered 3x3 blocks", () => {
      const tileIds = rectangleTiles(12, 1, 1, 9, 9);
      const result = compileTilesetKnowledge({
        groupId: "water-atlas",
        name: "물 지형",
        passage: open,
        template: "water-atlas-9x9",
        tileCount: 200,
        tileIds,
        tilesPerRow: 12,
      });

      expect(result.kind).toBe("valid");
      if (result.kind !== "valid") return;
      expect(result.value.group.sourceBlocks).toHaveLength(9);
      expect(result.value.group.sourceBlocks?.flatMap((block) => block.tileIds).sort((left, right) => left - right)).toEqual(tileIds);
    });

    it("rejects a holey selection for a structural template", () => {
      const tileIds = rectangleTiles(10, 0, 0, 3, 3).filter((tile) => tile !== 11);
      const result = compileTilesetKnowledge({
        groupId: "holey-water",
        name: "물",
        passage: open,
        template: "water-autotile-3x3",
        tileCount: 100,
        tileIds,
        tilesPerRow: 10,
      });

      expect(result).toEqual({
        kind: "invalid",
        issues: [{ code: "selection-not-rectangular", message: "선택에 빈 칸이 있습니다." }],
      });
    });

    it("repeats a 2x3 block across both axes including clipped edges", () => {
      expect(repeatKnowledgeBlock([1, 2, 3, 4, 5, 6], 2, 3, 5, 7)).toEqual([
        1, 2, 1, 2, 1,
        3, 4, 3, 4, 3,
        5, 6, 5, 6, 5,
        1, 2, 1, 2, 1,
        3, 4, 3, 4, 3,
        5, 6, 5, 6, 5,
        1, 2, 1, 2, 1,
      ]);
    });
  });
  function rectangleTiles(columns: number, x: number, y: number, width: number, height: number): number[] {
    return Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_cell, column) => ((y + row) * columns) + x + column)
    ).flat();
  }
});

// 시스템 옵트인 파사드(configure_game_systems / set_project_genre)의 저작 필드 쓰기 계약.
// 2026-08-27 커버리지 감사: 에디터 DB 시스템 탭은 이 필드를 쓰는데 어떤 툴도 못 써서
// 어시스턴트가 "그 기능이 없습니다"로 답하던 표면이다.
describe("toolsGameSystemToggles", () => {
  isolateTimers();
  function context(): ToolContext {
    return { project: createBlankProject() };
  }
  function errorText(result: ToolResult): string {
    return (result.issues ?? []).map((issue) => issue.message).join(" | ");
  }
  describe("configure_game_systems", () => {
    it("battleModel gen1 을 system.battleModel 에 쓴다", () => {
      const ctx = context();
      const result = runTool(ctx, "configure_game_systems", { battleModel: "gen1" });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.battleModel).toBe("gen1");
      // 규칙과 화면은 한 쌍이다(전투 방식, 2026-10-02) — gen1 은 몬스터 대치 화면까지 맞춘다.
      expect(ctx.project.system.battleUiStyle).toBe("pokemon");
    });

    it("battleModel rm2k3 은 기본값이므로 필드를 지운다(UI 계약과 동일)", () => {
      const ctx = context();
      ctx.project.system.battleModel = "gen1";
      ctx.project.system.battleUiStyle = "pokemon";
      const result = runTool(ctx, "configure_game_systems", { battleModel: "rm2k3" });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.battleModel).toBeUndefined();
      expect(ctx.project.system.battleUiStyle).toBeUndefined();
    });

    it("giftSystem·rewardPolicy·skillSystem 을 각 필드에 쓴다", () => {
      const ctx = context();
      const result = runTool(ctx, "configure_game_systems", {
        giftSystem: true,
        rewardPolicy: { participationOnly: true, levelGapPenalty: true },
        skillSystem: { enabled: true },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.giftSystem).toBe(true);
      expect(ctx.project.system.rewardPolicy).toEqual({ participationOnly: true, levelGapPenalty: true });
      expect(ctx.project.system.skillSystem).toEqual({ enabled: true });
    });

    it("giftSystem false 와 rewardPolicy 전부 false 는 필드를 지운다", () => {
      const ctx = context();
      ctx.project.system.giftSystem = true;
      ctx.project.system.rewardPolicy = { participationOnly: true };
      const result = runTool(ctx, "configure_game_systems", {
        giftSystem: false,
        rewardPolicy: { participationOnly: false },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.giftSystem).toBeUndefined();
      expect(ctx.project.system.rewardPolicy).toBeUndefined();
    });

    it("rewardPolicy 는 부분 패치다(주지 않은 축은 유지)", () => {
      const ctx = context();
      ctx.project.system.rewardPolicy = { participationOnly: true };
      const result = runTool(ctx, "configure_game_systems", { rewardPolicy: { levelGapPenalty: true } });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.rewardPolicy).toEqual({ participationOnly: true, levelGapPenalty: true });
    });

    it("monsterCare 를 켜면 기본값이 채워지고, 준 값만 덮어쓴다", () => {
      const ctx = context();
      const result = runTool(ctx, "configure_game_systems", {
        monsterCare: { enabled: true, stepsPerTick: 80 },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.monsterCare).toEqual({
        stepsPerTick: 80,
        walkFriendship: 1,
        walkExp: 1,
        dailyCareCap: 30,
      });

      const second = runTool(ctx, "configure_game_systems", { monsterCare: { dailyCareCap: 60 } });
      expect(second.ok, second.summary).toBe(true);
      expect(ctx.project.system.monsterCare).toEqual({
        stepsPerTick: 80,
        walkFriendship: 1,
        walkExp: 1,
        dailyCareCap: 60,
      });
    });

    it("monsterCare enabled false 는 필드를 지운다", () => {
      const ctx = context();
      ctx.project.system.monsterCare = { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 };
      const result = runTool(ctx, "configure_game_systems", { monsterCare: { enabled: false } });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.monsterCare).toBeUndefined();
    });

    it("한 섹션만 준 호출은 다른 섹션을 그대로 둔다", () => {
      const ctx = context();
      const first = runTool(ctx, "configure_game_systems", {
        battleModel: "gen1",
        giftSystem: true,
        rewardPolicy: { participationOnly: true },
        monsterCare: { enabled: true, walkExp: 5 },
        skillSystem: { enabled: true },
      });
      expect(first.ok, first.summary).toBe(true);

      const second = runTool(ctx, "configure_game_systems", { skillSystem: { enabled: false } });
      expect(second.ok, second.summary).toBe(true);
      expect(ctx.project.system.skillSystem).toEqual({ enabled: false });
      expect(ctx.project.system.battleModel).toBe("gen1");
      expect(ctx.project.system.giftSystem).toBe(true);
      expect(ctx.project.system.rewardPolicy).toEqual({ participationOnly: true });
      expect(ctx.project.system.monsterCare?.walkExp).toBe(5);
    });

    it("섹션을 하나도 주지 않으면 유효한 섹션 이름을 알려주며 거부한다", () => {
      const ctx = context();
      const result = runTool(ctx, "configure_game_systems", {});
      expect(result.ok).toBe(false);
      const message = errorText(result);
      for (const section of ["battleModel", "giftSystem", "rewardPolicy", "monsterCare", "skillSystem"]) {
        expect(message).toContain(section);
      }
    });

    it("battleModel 이 허용 값이 아니면 허용 값을 알려주며 거부한다", () => {
      const ctx = context();
      ctx.project.system.giftSystem = true;
      const result = runTool(ctx, "configure_game_systems", { battleModel: "gen2" });
      expect(result.ok).toBe(false);
      const message = errorText(result);
      expect(message).toContain("rm2k3");
      expect(message).toContain("gen1");
      expect(ctx.project.system.giftSystem).toBe(true);
    });

    it("monsterCare 수치는 유효 범위로 클램프한다", () => {
      const ctx = context();
      const result = runTool(ctx, "configure_game_systems", {
        monsterCare: { enabled: true, stepsPerTick: 0, walkFriendship: -5, walkExp: -1, dailyCareCap: -2 },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.monsterCare).toEqual({
        stepsPerTick: 50,
        walkFriendship: 0,
        walkExp: 0,
        dailyCareCap: 0,
      });
    });
  });
  describe("set_project_genre", () => {
    it("기존 프로젝트의 system.genre 만 바꾼다", () => {
      const ctx = context();
      const result = runTool(ctx, "set_project_genre", { genre: "farm-life" });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.genre).toBe("farm-life");
    });

    it("reset_project 덫: 맵·이벤트·데이터베이스를 지우지 않는다", () => {
      const ctx = context();
      const before = {
        mapIds: Object.keys(ctx.project.maps).sort(),
        startMapId: ctx.project.startMapId,
        mapEventCounts: Object.fromEntries(
          Object.entries(ctx.project.maps).map(([id, map]) => [id, map.events.length]),
        ),
        commonEvents: ctx.project.commonEvents.length,
        actors: ctx.project.database.actors.length,
        items: ctx.project.database.items.length,
        skills: ctx.project.database.skills.length,
        title: ctx.project.meta.title,
      };
      expect(before.mapIds.length).toBeGreaterThan(0);
      expect(before.commonEvents + before.actors + before.items).toBeGreaterThan(0);

      const result = runTool(ctx, "set_project_genre", { genre: "monster-collect" });
      expect(result.ok, result.summary).toBe(true);

      expect(ctx.project.system.genre).toBe("monster-collect");
      expect(Object.keys(ctx.project.maps).sort()).toEqual(before.mapIds);
      expect(ctx.project.startMapId).toBe(before.startMapId);
      expect(
        Object.fromEntries(Object.entries(ctx.project.maps).map(([id, map]) => [id, map.events.length])),
      ).toEqual(before.mapEventCounts);
      expect(ctx.project.commonEvents.length).toBe(before.commonEvents);
      expect(ctx.project.database.actors.length).toBe(before.actors);
      expect(ctx.project.database.items.length).toBe(before.items);
      expect(ctx.project.database.skills.length).toBe(before.skills);
      expect(ctx.project.meta.title).toBe(before.title);
    });

    it("장르를 바꿔도 다른 옵트인 설정은 건드리지 않는다", () => {
      const ctx = context();
      ctx.project.system.giftSystem = true;
      ctx.project.system.skillSystem = { enabled: true };
      const result = runTool(ctx, "set_project_genre", { genre: "story-cutscene" });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.giftSystem).toBe(true);
      expect(ctx.project.system.skillSystem).toEqual({ enabled: true });
    });

    it("모든 GenrePackId 를 받는다", () => {
      for (const genre of GENRE_PACK_IDS) {
        const ctx = context();
        const result = runTool(ctx, "set_project_genre", { genre });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.system.genre).toBe(genre);
      }
    });

    it("알 수 없는 장르는 유효 장르 목록을 알려주며 거부한다", () => {
      const ctx = context();
      const result = runTool(ctx, "set_project_genre", { genre: "roguelike" });
      expect(result.ok).toBe(false);
      const message = errorText(result);
      for (const genre of GENRE_PACK_IDS) expect(message).toContain(genre);
      expect(ctx.project.system.genre).toBeUndefined();
    });
  });
});

describe("touchStickFeel", () => {
  isolateTimers();
  const at = (deg: number, r = 40): [number, number] => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
  describe("touch stick sectors (2026-10-24 mobile feel)", () => {
    it("cardinals are wide, diagonals narrow (28..62 degrees only)", () => {
      expect(stickSectorKeys(stickSector(...at(25), null))).toEqual(["ArrowRight"]);
      expect(stickSectorKeys(stickSector(...at(30), null))).toEqual(["ArrowRight", "ArrowDown"]);
      expect(stickSectorKeys(stickSector(...at(60), null))).toEqual(["ArrowRight", "ArrowDown"]);
      expect(stickSectorKeys(stickSector(...at(65), null))).toEqual(["ArrowDown"]);
      expect(stickSectorKeys(stickSector(...at(-90), null))).toEqual(["ArrowUp"]);
      expect(stickSectorKeys(stickSector(...at(180), null))).toEqual(["ArrowLeft"]);
    });
    it("keeps the held sector across a small wobble (hysteresis)", () => {
      expect(stickSectorKeys(stickSector(...at(32), 0))).toEqual(["ArrowRight"]);
      expect(stickSectorKeys(stickSector(...at(40), 0))).toEqual(["ArrowRight", "ArrowDown"]);
    });
    it("dead zone: 12px to start, 8px to release", () => {
      expect(stickSector(10, 0, null)).toBeNull();
      expect(stickSector(10, 0, 0)).toBe(0);
      expect(stickSector(7, 0, 0)).toBeNull();
    });
    it("dead zone scales with the pad radius: 12% to start, 8% to release (2026-10-30)", () => {
      // 세로 판 반지름 65px: 7.8px 를 넘으면 출발(예전 고정 12px = 18%), 5.2px 밑이면 멈춤.
      expect(stickSector(7, 0, null, 65)).toBeNull();
      expect(stickSector(9, 0, null, 65)).toBe(0);
      expect(stickSector(6, 0, 0, 65)).toBe(0);
      expect(stickSector(5, 0, 0, 65)).toBeNull();
      // 아주 작은 판도 6px 밑으로는 내리지 않는다(엄지를 얹기만 해서 걷지 않게).
      expect(stickSector(5.5, 0, null, 30)).toBeNull();
    });
  });
  describe("running on touch = holding A (2026-11-11, replaces «push the stick past 70%»)", () => {
    it("runs while A is held, and never sends the dash key under always-run (Shift would invert to walking)", () => {
      expect(padRuns(false, false)).toBe(false);
      expect(padRuns(true, false)).toBe(true);
      expect(padRuns(true, true)).toBe(false);
      expect(padRuns(false, true)).toBe(false);
    });
  });
  describe("system.touchControls", () => {
    it("stores only non-default fields", () => {
      expect(normalizeTouchControls({ tapToMove: true, stick: "auto", haptics: true, runButton: false })).toBeUndefined();
      expect(normalizeTouchControls({ runButton: true })).toEqual({ runButton: true });
      expect(normalizeTouchControls({ tapToMove: false, stick: "fixed", bogus: 1 })).toEqual({ tapToMove: false, stick: "fixed" });
    });
    it("device preference beats authored value beats default", () => {
      expect(resolveTouchControls(undefined)).toEqual({ tapToMove: true, stick: "auto", haptics: true, runButton: false });
      expect(resolveTouchControls({ tapToMove: false }).tapToMove).toBe(false);
      expect(resolveTouchControls({ tapToMove: false }, { tapToMove: true }).tapToMove).toBe(true);
    });
  });
});

describe("transitYieldLaneShift", () => {
  isolateTimers();
  // 폭 6 도로(laneShift 0.5)에서 차 몸이 덮는 셋째 줄에 선 사람 앞에서도 1칸 넘게 띄우고 서는지(첫사랑 r7: 0.07칸 앞에서 섰다).
  function run(shift: number, personRow: number) {
    const transit = { routes: [{ id: "r", kind: "road", path: [{ x: 0, y: 10 }, { x: 40, y: 10 }], vehicles: ["mc-veh-truck-a"], headwaySec: 1, ...(shift ? { laneShift: { ew: shift } } : {}) }] } as unknown as MapTransit;
    const sim = createTransitSim(transit, { width: 50, height: 30 }, 0);
    const person = { x: 20, y: personRow };
    for (let i = 0; i < 600; i += 1) stepTransitSim(sim, 1 / 30, (x, y) => x === person.x && y === person.y);
    const v = sim.vehicles[0];
    expect(v, "차가 나와 움직였다").toBeDefined();
    const pose = transitPose(sim, v!);
    return { pose, person, front: pose.rect.x + pose.rect.w };
  }
  describe("사람 앞 양보는 차선 맞춤이 들어간 몸으로 본다", () => {
    for (const row of [10, 11, 12]) {
      it(`laneShift 0.5 · 사람 줄 ${row}`, () => {
        const { pose, person, front } = run(0.5, row);
        expect(pose.rect.x, "출발 칸에서 움직였다").toBeGreaterThan(0);
        expect(front).toBeLessThanOrEqual(person.x - 1);
        expect(transitRectCells(pose.rect).some((c) => c.x === person.x && c.y === person.y)).toBe(false);
      });
    }
    it("laneShift 0 · 사람 줄 11", () => {
      const { front, person } = run(0, 11);
      expect(front).toBeLessThanOrEqual(person.x - 1);
    });
  });
});

describe("worldSystem", () => {
  isolateTimers();
  function world(entities: readonly WorldEntity[], relations: ProjectWorld["relations"] = []): ProjectWorld {
    return { entities, relations };
  }
  function entity(patch: Partial<WorldEntity> = {}): WorldEntity {
    return {
      id: "w_entity",
      type: "character",
      name: "아린",
      summary: "마을의 수호자",
      origin: "user",
      ...patch,
    };
  }
  function smallProject(): Project {
    return {
      startMapId: "map_1",
      maps: {
        map_1: {
          id: "map_1",
          name: "테스트 맵",
          width: 10,
          height: 10,
          tilesetId: "tileset_1",
          tileSize: 16,
          lowerTiles: [],
          upperTiles: [],
          events: [],
        },
      },
      database: {
        items: [],
        skills: [],
        actors: [],
      },
    } as unknown as Project;
  }
  function addNamedNpc(project: Project, id = "ev_sera"): void {
    project.maps[project.startMapId].events.push({
      id,
      x: 4,
      y: 5,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_page`,
          name: "세라",
          conditions: [],
          graphic: { sprite: { type: "bundled", id: "charset_sera" } },
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "text", body: "안녕하세요." }],
        },
      ],
    });
  }
  describe("world guards", () => {
    it("project.world가 없으면 빈 world로 정규화한다", () => {
      expect(normalizeProjectWorld({ title: "legacy" })).toEqual({ entities: [], relations: [] });
    });

    it("알 수 없는 필드를 제거하고 world id prefix와 relation id를 정규화한다", () => {
      const normalized = normalizeWorld({
        extra: "drop",
        entities: [
          {
            id: "hero",
            type: "character",
            name: "아린",
            summary: "수호자",
            origin: "user",
            tags: ["hero"],
            refs: [{ kind: "map", id: "map_1", extra: "drop" }],
            extra: "drop",
          },
          { id: "guild", type: "faction", name: "상단", summary: "상인 조직", origin: "ai" },
        ],
        relations: [{ a: "hero", b: "guild", kind: "memberOf", extra: "drop" }],
      });

      expect(normalized).toEqual({
        entities: [
          {
            id: "w_hero",
            type: "character",
            name: "아린",
            summary: "수호자",
            origin: "user",
            tags: ["hero"],
            refs: [{ kind: "map", id: "map_1" }],
          },
          { id: "w_guild", type: "faction", name: "상단", summary: "상인 조직", origin: "ai" },
        ],
        relations: [{ a: "w_hero", b: "w_guild", kind: "memberOf" }],
      });
    });

    it("잘못된 entity type을 거부한다", () => {
      expect(() =>
        normalizeWorld({ entities: [{ ...entity(), type: "monster" }], relations: [] })
      ).toThrow(/type/);
    });

    it("잘못된 ref kind를 거부한다", () => {
      expect(() =>
        normalizeWorld({ entities: [{ ...entity({ refs: [{ kind: "monster", id: "m1" } as never] }) }], relations: [] })
      ).toThrow(/refs\[0\]\.kind/);
    });

    it("중복 id를 거부한다", () => {
      expect(() =>
        normalizeWorld({ entities: [entity({ id: "hero" }), entity({ id: "w_hero", name: "복제" })], relations: [] })
      ).toThrow(/중복/);
    });

    it("relation이 없는 entity를 가리키면 거부한다", () => {
      expect(() =>
        normalizeWorld({ entities: [entity({ id: "hero" })], relations: [{ a: "hero", b: "ghost", kind: "knows" }] })
      ).toThrow(/entities에 없습니다/);
    });
  });
  describe("world digest", () => {
    it("빈 world를 짧은 문장으로 반환한다", () => {
      expect(buildWorldDigest(world([]), { maxTokens: 20 })).toBe("세계관 없음");
    });

    it("이름, 타입, summary만 압축해서 출력한다", () => {
      const digest = buildWorldDigest(world([entity({ name: "  아린  ", summary: "  마을을   지킨다  ", body: "긴 본문" })]), {
        maxTokens: 50,
      });
      expect(digest).toBe("[character] 아린: 마을을 지킨다");
      expect(digest).not.toContain("긴 본문");
    });

    it("상한 초과 시 타입 우선순위로 자르고 생략 수를 표시한다", () => {
      const digest = buildWorldDigest(
        world([
          entity({ id: "w_concept", type: "concept", name: "마력", summary: "세계의 힘" }),
          entity({ id: "w_rule", type: "guideline", name: "톤", summary: "차분하게" }),
          entity({ id: "w_faction", type: "faction", name: "상단", summary: "도시를 움직인다" }),
          entity({ id: "w_character", type: "character", name: "세라", summary: "길잡이" }),
        ]),
        { maxTokens: 14 }
      );

      expect(digest).toContain("[guideline] 톤");
      expect(digest).toContain("[faction] 상단");
      expect(digest).not.toContain("[concept] 마력");
      expect(digest).toContain("…외 2개");
    });
  });
  describe("world lint", () => {
    it.each([
      ["map", "missing_map"],
      ["event", "missing_event"],
      ["item", "missing_item"],
      ["skill", "missing_skill"],
      ["actor", "missing_actor"],
    ] as const)("없는 %s ref를 error로 보고한다", (kind, id) => {
      const project = smallProject();
      const issues = lintWorld(world([entity({ refs: [{ kind, id }] })]), project);

      expect(issues).toContainEqual(
        expect.objectContaining({
          severity: "error",
          code: "world-ref-missing",
          message: expect.stringContaining(`${kind}:${id}`),
        })
      );
      expect(issues.find((issue) => issue.code === "world-ref-missing")).not.toHaveProperty("x");
    });

    it("refs 없는 lore 개체를 warning으로 보고한다", () => {
      const project = smallProject();
      const issues = lintWorld(world([entity({ type: "place", refs: [] })]), project);

      expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "world-lore-unlinked" }));
    });

    it("world에 등록되지 않은 명명 NPC 이벤트를 warning으로 보고한다", () => {
      const project = smallProject();
      addNamedNpc(project);
      const issues = lintWorld(world([]), project);

      expect(issues).toContainEqual(
        expect.objectContaining({ severity: "warning", code: "world-npc-unregistered", mapId: project.startMapId, x: 4, y: 5 })
      );
    });

    it("event ref가 있는 명명 NPC 이벤트는 미등록 warning을 내지 않는다", () => {
      const project = smallProject();
      addNamedNpc(project);
      const issues = lintWorld(world([entity({ refs: [{ kind: "event", id: "ev_sera" }] })]), project);

      expect(issues.some((issue) => issue.code === "world-npc-unregistered")).toBe(false);
    });

    it("world에 등록되지 않은 명명 아이템을 warning으로 보고한다", () => {
      const project = smallProject();
      const item = { id: "item_potion", name: "회복약" };
      project.database.items = [item as never];

      const issues = lintWorld(world([]), project);

      expect(issues).toContainEqual(
        expect.objectContaining({ severity: "warning", code: "world-item-unregistered", message: expect.stringContaining(item.id) })
      );
    });

    it("item ref가 있는 명명 아이템은 미등록 warning을 내지 않는다", () => {
      const project = smallProject();
      const item = { id: "item_potion", name: "회복약" };
      project.database.items = [item as never];

      const issues = lintWorld(world([entity({ refs: [{ kind: "item", id: item.id }] })]), project);

      expect(issues.some((issue) => issue.code === "world-item-unregistered")).toBe(false);
    });

    it("body 없는 guideline을 info로 보고한다", () => {
      const project = smallProject();
      const issues = lintWorld(world([entity({ type: "guideline", body: " " })]), project);

      expect(issues).toContainEqual(expect.objectContaining({ severity: "info", code: "world-guideline-body-missing" }));
    });

    it("body가 있는 guideline은 info를 내지 않는다", () => {
      const project = smallProject();
      const issues = lintWorld(world([entity({ type: "guideline", body: "문체는 간결하게." })]), project);

      expect(issues.some((issue) => issue.code === "world-guideline-body-missing")).toBe(false);
    });
  });
});
