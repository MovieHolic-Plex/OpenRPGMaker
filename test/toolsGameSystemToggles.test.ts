// 시스템 옵트인 파사드(configure_game_systems / set_project_genre)의 저작 필드 쓰기 계약.
// 2026-08-27 커버리지 감사: 에디터 DB 시스템 탭은 이 필드를 쓰는데 어떤 툴도 못 써서
// 어시스턴트가 "그 기능이 없습니다"로 답하던 표면이다.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { GENRE_PACK_IDS } from "@/project/genrePackId";

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
