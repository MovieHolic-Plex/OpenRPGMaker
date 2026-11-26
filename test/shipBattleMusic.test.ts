import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { fillBattleBgm } from "@/ai/v2/story/shipLookDefaults";
import { fillRegionBattleBgm } from "@/ai/v2/story/shipBattleMusic";
import { OPRN_BGM_ASSETS } from "@/assets/oprnBgmAssets";
import { resolveBattleBgmResourceId } from "@/project/mapMusic";
import type { GameEvent, GameMap, Project } from "@/project/types";

// 출하 기본값이 맵(지역)·보스별 전투곡을 나눠 건다(2026-11-26 전투 소리 다양성 분석 제안 2). 런타임은 이미 맵 전투곡·보스 덮어쓰기를 읽는다.
describe("ship defaults: regional and boss battle music", { timeout: 120_000 }, () => {
  const CUE = "m2-027-change-system-bgm";
  const BOSS_IDS = OPRN_BGM_ASSETS.filter((a) => a.scenes.includes("boss")).map((a) => a.id);
  const REGULAR_IDS = OPRN_BGM_ASSETS.filter((a) => !a.scenes.includes("boss")).map((a) => a.id);

  function addMap(project: Project, id: string, name: string, extra: Partial<GameMap> = {}): GameMap {
    const map = { ...structuredClone(project.maps[project.startMapId]!), id, name, events: [], encounterRate: 6, troopIds: ["troop_qa"], ...extra } as GameMap;
    project.maps[id] = map;
    return map;
  }
  function game(): Project {
    const project = createBlankProject();
    const start = project.maps[project.startMapId]!;
    start.name = "시작 마을";
    start.encounterRate = 0;
    return project;
  }

  it("gives each region its own battle track: forest, snow and an unknown place differ, and an authored map is left alone", () => {
    const project = game();
    addMap(project, "m_forest", "속삭이는 숲");
    addMap(project, "m_snow", "북쪽 고개", { climate: { mode: "fixed", weather: "snow" } } as Partial<GameMap>);
    addMap(project, "m_plain", "붉은 협곡");
    addMap(project, "m_own", "내 맵", { battleBgmResourceId: "cc0-bgm-battle" });
    fillRegionBattleBgm(project);
    expect(project.maps.m_forest!.battleBgmResourceId).toBe("oprn-bgm-ct2-battle-v1-1");
    expect(project.maps.m_snow!.battleBgmResourceId).toBe("oprn-bgm-dfk-battlefield-v0-1");
    expect(REGULAR_IDS).toContain(project.maps.m_plain!.battleBgmResourceId);
    expect(project.maps.m_own!.battleBgmResourceId).toBe("cc0-bgm-battle");
    expect(resolveBattleBgmResourceId(project, "m_forest")).toBe("oprn-bgm-ct2-battle-v1-1");
    const before = structuredClone(project.maps);
    expect(fillRegionBattleBgm(project)).toEqual([]);
    expect(project.maps).toEqual(before);
  });

  it("leaves a one-battle-map game on its project battle track", () => {
    const project = game();
    addMap(project, "m_forest", "속삭이는 숲");
    expect(fillRegionBattleBgm(project)).toEqual([]);
    expect(project.maps.m_forest!.battleBgmResourceId).toBeUndefined();
  });

  it("wraps each boss fight with a boss track and the final boss with the final-boss track, then resets", () => {
    const project = game();
    addMap(project, "m_a", "숲 길");
    addMap(project, "m_b", "동굴 입구");
    const fight = (troopId: string): GameEvent => ({ id: "ev_" + troopId, name: troopId, x: 1, y: 1, pages: [{ id: "p1", commands: [{ kind: "battleProcessing", troopId }] }] }) as unknown as GameEvent;
    project.database.troops.push(
      { id: "troop_boss1", name: "동굴 보스", members: [], enemyIds: [] } as never,
      { id: "troop_king", name: "마왕", members: [], enemyIds: [] } as never,
    );
    project.maps.m_a!.events.push(fight("troop_boss1"));
    project.maps.m_b!.events.push(fight("troop_king"));
    fillRegionBattleBgm(project);
    const commands = (id: string) => (project.maps[id]!.events[0] as unknown as { pages: { commands: { kind: string; commandId?: string; fields?: Record<string, string> }[] }[] }).pages[0]!.commands;
    const a = commands("m_a"), b = commands("m_b");
    expect(a.map((c) => c.kind)).toEqual(["m2Command", "battleProcessing", "m2Command"]);
    expect(a[0]).toMatchObject({ commandId: CUE, fields: { cue: "battle", operation: "set" } });
    expect(BOSS_IDS).toContain(a[0]!.fields!.resourceId);
    expect(a[0]!.fields!.resourceId).not.toBe("oprn-bgm-ct2-finalboss-v0-1");
    expect(a[2]).toMatchObject({ commandId: CUE, fields: { cue: "battle", operation: "reset" } });
    expect(b[0]!.fields!.resourceId).toBe("oprn-bgm-ct2-finalboss-v0-1");
  });

  it("recognises a boss whose name has no boss word by its troop id", () => {
    const project = game();
    addMap(project, "m_a", "동굴");
    project.database.troops.push({ id: "troop_dg_cave_boss", name: "동굴의 과부 거미", members: [], enemyIds: [] } as never);
    project.maps.m_a!.events.push({ id: "ev_b", name: "거미", x: 1, y: 1, pages: [{ id: "p1", commands: [{ kind: "battleProcessing", troopId: "troop_dg_cave_boss" }] }] } as unknown as GameEvent);
    expect(fillRegionBattleBgm(project).some((line) => line.startsWith("보스곡"))).toBe(true);
    const commands = (project.maps.m_a!.events[0] as unknown as { pages: { commands: { commandId?: string }[] }[] }).pages[0]!.commands;
    expect(commands.map((c) => c.commandId ?? "battle")).toEqual([CUE, "battle", CUE]);
  });

  it("does not touch boss fights when the author already placed a battle music cue", () => {
    const project = game();
    addMap(project, "m_a", "숲 길");
    addMap(project, "m_b", "동굴 입구");
    project.database.troops.push({ id: "troop_boss1", name: "동굴 보스", members: [], enemyIds: [] } as never);
    project.maps.m_a!.events.push({ id: "ev1", name: "보스", x: 1, y: 1, pages: [{ id: "p1", commands: [
      { kind: "m2Command", commandId: CUE, fields: { cue: "battle", operation: "set", resourceId: "cc0-bgm-battle", volume: "100" } },
      { kind: "battleProcessing", troopId: "troop_boss1" },
    ] }] } as unknown as GameEvent);
    fillRegionBattleBgm(project);
    const commands = (project.maps.m_a!.events[0] as unknown as { pages: { commands: unknown[] }[] }).pages[0]!.commands;
    expect(commands).toHaveLength(2);
  });

  it("picks a regular (non-boss) project battle track and spreads games over several tracks", () => {
    const picks = new Set<string>();
    for (const title of ["별빛 항구", "잿빛 왕관", "유리 숲의 노래", "마지막 기차", "붉은 달", "이끼의 탑", "바람 상점", "겨울 등대", "용사의 귀환", "달빛 여관", "낡은 등대", "검은 숲"]) {
      const project = game();
      project.meta.title = title;
      fillBattleBgm(project, "");
      const id = project.system.battleBgmResourceId!;
      expect(BOSS_IDS).not.toContain(id);
      picks.add(id);
    }
    expect(picks.size).toBeGreaterThanOrEqual(3);
  });
});
