// 보스 그림은 게임 안에서 하나씩(2026-11-15 버들항 던전).
// 현행 그림이 있는 종이 서른여덟뿐이라 주제 보스가 대역으로 접히면 한 그림에 몰렸다 — 지하묘(리치)·마법탑(리치)·마계(마왕)가 모두 어둠 망령.
// planTroops 의 «쓴 그림» 은 한 번 부를 때만 살아 던전 둘을 지은 게임에서 두 보스가 같은 그림이었다. 이제 게임의 다른 보스가 쓰는 그림은 피한다.
import { beforeAll, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import { preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { planTroops, type DungeonPlan } from "@/ai/v2/place/builders/dungeonFoes";
import { bossArtInUse, distinctBossFoe, hasCurrentArt } from "@/ai/v2/story/currentFoes";
import { themedTroops } from "@/editor/tools/dungeonTools";
import type { DungeonType } from "@/editor/dungeonKit/types";
import type { ToolContext } from "@/editor/tools/types";
import type { GameEvent, GameMap, Project } from "@/project/types";

beforeAll(async () => { await preloadCurrentMonsterArt(); });

const artOfTroop = (project: Project, troopId: string | undefined): string => {
  const troop = project.database.troops.find((t) => t.id === troopId);
  const lead = troop?.members?.[0]?.enemyId ?? troop?.enemyIds?.[0];
  return String(project.database.enemies.find((e) => e.id === lead)?.monsterResourceId ?? "");
};

function game(key: string): ToolContext {
  const project = createBlankProject() as Project;
  applyGenrePreset(project, "adventure-jrpg");
  return { project, currentMapId: project.startMapId, assistantRun: true, lookKey: JSON.stringify(["project", key]) } as ToolContext;
}

/** 던전 하나의 적 그룹을 정하고(빌더와 같은 길: planTroops → 도구 themedTroops) 그 보스를 그 던전 맵에 세운다. 보스 그림을 돌려준다. */
function raiseDungeon(ctx: ToolContext, name: string, type: DungeonType, boss?: readonly [string, string]): string {
  const run = createBuildRun(ctx);
  const plan: DungeonPlan = { args: { name }, type, foes: [], ...(boss ? { boss } : {}), missing: [], warnings: [] };
  const toolArgs = { name, type };
  const given = planTroops(run, plan, toolArgs, []);
  const project = ctx.project;
  const troops = themedTroops(project, { ...toolArgs, ...(given ? { troops: given } : {}) });
  const id = `map_${type}_${Object.keys(project.maps).length}`;
  const old = Object.values(project.maps).find((m) => m.name === name);
  const mapId = old?.id ?? id;
  const src = project.maps[project.startMapId]!;
  const ev = { id: `ev_${mapId}_boss`, name: "보스", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [
    { id: "p1", name: "보스", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "battleProcessing", troopId: troops.boss }] },
  ] } as unknown as GameEvent;
  project.maps[mapId] = { ...src, id: mapId, name, events: [ev] } as GameMap;
  return artOfTroop(project, troops.boss);
}

describe("보스 그림은 게임 안에서 겹치지 않는다", () => {
  it("대역이 한 그림에 몰리는 주제 여섯(지하묘·마법탑·마계·성·얼음굴·화산)을 한 게임에 지어도 보스 그림이 모두 다르다", () => {
    const ctx = game("boss-art-a");
    const types: DungeonType[] = ["catacomb", "tower", "otherworld", "castle", "ice", "volcano"];
    const arts = types.map((type) => raiseDungeon(ctx, `${type} 던전`, type));
    for (const art of arts) expect(art, "보스 그림이 비었다").not.toBe("");
    expect(new Set(arts).size, arts.join(" · ")).toBe(types.length);
    // 게임이 기억하는 «쓴 그림» = 지은 보스들의 그림
    expect([...bossArtInUse(ctx.project)].sort()).toEqual([...new Set(arts)].sort());
    // 같은 종류를 한 번 더(둘째 동굴)도 다른 그림이다.
    const cave1 = raiseDungeon(ctx, "첫째 동굴", "cave"), cave2 = raiseDungeon(ctx, "둘째 동굴", "cave");
    expect(cave2).not.toBe(cave1);
    expect(arts).not.toContain(cave2);
  });

  it("같은 열쇠의 게임은 같은 그림을 고르고(결정적), 던전을 다시 지어도 그 보스 그림 그대로다", () => {
    const order: DungeonType[] = ["catacomb", "tower", "otherworld"];
    const a = game("boss-art-b"), b = game("boss-art-b");
    const artsA = order.map((type) => raiseDungeon(a, `${type} 던전`, type));
    const artsB = order.map((type) => raiseDungeon(b, `${type} 던전`, type));
    expect(artsB).toEqual(artsA);
    // 둘째·셋째 던전을 다시 짓는다 — 제 옛 보스는 «쓴 그림» 에서 빠지고 같은 그림으로 돌아온다.
    expect(raiseDungeon(a, "tower 던전", "tower")).toBe(artsA[1]);
    expect(raiseDungeon(a, "otherworld 던전", "otherworld")).toBe(artsA[2]);
    expect(raiseDungeon(a, "catacomb 던전", "catacomb")).toBe(artsA[0]);
  });

  it("옛 게임(두 던전의 보스가 이미 같은 그림)은 다시 지어도 그 그림 그대로다", () => {
    const ctx = game("boss-art-old");
    const first = raiseDungeon(ctx, "ice 던전", "ice");
    // 옛 빌더가 지은 둘째 던전(화산): 얼음굴과 같은 그림의 보스가 이미 서 있다 — 화산의 기본 보스(붉은 용)도 같은 대역 그림(푸른 용)이다.
    const project = ctx.project;
    const ice = Object.values(project.maps).find((m) => m.name === "ice 던전")!;
    const old = structuredClone(ice.events[0]!) as GameEvent;
    project.maps.map_old_volcano = { ...ice, id: "map_old_volcano", name: "volcano 던전", events: [{ ...old, id: "ev_map_old_volcano_boss" }] } as GameMap;
    expect(raiseDungeon(ctx, "volcano 던전", "volcano")).toBe(first);
    // 새로 짓는 셋째 던전(둘째 얼음굴 — 같은 기본 보스)은 다른 그림이다.
    expect(raiseDungeon(ctx, "둘째 빙굴", "ice")).not.toBe(first);
  });

  it("사용자가 짚은 보스는 겹쳐도 그대로다", () => {
    const ctx = game("boss-art-named");
    const first = raiseDungeon(ctx, "얼음 굴", "ice", ["enemy_dragon_blue", "빙굴의 얼음 용"]);
    const second = raiseDungeon(ctx, "화산 굴", "volcano", ["enemy_dragon_blue", "푸른 용"]);
    expect(second).toBe(first);
  });

  it("distinctBossFoe: 안 쓴 그림이면 그대로, 쓴 그림이면 현행 그림의 다른 종, 금지한 종은 건너뛴다", () => {
    const project = game("boss-art-unit").project;
    const artOf = (id: string) => String(project.database.enemies.find((e) => e.id === id)?.monsterResourceId ?? "");
    expect(distinctBossFoe(project, "enemy_wraith_dark", new Set(), () => false, "k")).toBe("enemy_wraith_dark");
    const used = new Set([artOf("enemy_wraith_dark")]);
    const pick = distinctBossFoe(project, "enemy_wraith_dark", used, () => false, "k");
    expect(pick).not.toBe("enemy_wraith_dark");
    expect(hasCurrentArt(project, pick)).toBe(true);
    expect(used.has(artOf(pick))).toBe(false);
    const other = distinctBossFoe(project, "enemy_wraith_dark", used, (id) => id === pick, "k");
    expect(other).not.toBe(pick);
    expect(distinctBossFoe(project, "enemy_wraith_dark", used, () => false, "k")).toBe(pick);
  });
});
