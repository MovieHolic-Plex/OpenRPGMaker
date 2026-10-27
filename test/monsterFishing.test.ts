import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { attemptFishingCatch } from "@/project/fishing";
import { interactWithLifeField } from "@/player/lifeFieldInteraction";
import { wildTroopIdForSpecies } from "@/project/wildTroops";
import { deserialize, serialize } from "@/project/io";
import type { ToolContext } from "@/editor/tools";

// 깊이 감사 #9: 낚시 catches 에 speciesId(+level) 를 쓰면 낚인 몬스터가 야생 전투가 된다. (작성만 — 이 세션에서는 실행하지 않았다.)
function monsterFixture() {
  const project = createBlankProject();
  const mapId = project.startMapId;
  // Add to the shipped roster — replacing it orphans the default enemies' speciesId references and every commit fails validation.
  project.database.monsterSpecies.push({ id: "sp_carp", name: "잉어킹류" } as never);
  project.database.enemies.push({ id: "enemy_wild_sp_carp", name: "잉어", speciesId: "sp_carp" } as never);
  project.database.troops.push({ id: "troop_wild_sp_carp", name: "야생 잉어", enemyIds: ["enemy_wild_sp_carp"] } as never);
  const ctx = { project, currentMapId: mapId } as ToolContext;
  return { project, mapId, ctx };
}

describe("몬스터 낚시", () => {
  it("wildTroopIdForSpecies 는 그 종만 든 비트레이너 무리를 찾는다", () => {
    const { project } = monsterFixture();
    expect(wildTroopIdForSpecies(project, "sp_carp")).toBe("troop_wild_sp_carp");
    expect(wildTroopIdForSpecies(project, "sp_none")).toBeUndefined();
  });

  it("configure_fishing 은 speciesId 항을 monsterCatches 로 저장하고 야생 무리 없는 종·모르는 종은 거절한다", () => {
    const { ctx, mapId } = monsterFixture();
    const area = { x: 0, y: 0, w: 2, h: 2 };
    expect(runTool(ctx, "configure_fishing", { enabled: true, spots: [{ id: "s", mapId, area, catches: [{ speciesId: "nope" }] }] }).ok).toBe(false);
    const ok = runTool(ctx, "configure_fishing", { enabled: true, energyCost: 0, spots: [{ id: "s", mapId, area, catches: [{ speciesId: "sp_carp", levelMin: 4, levelMax: 6 }] }] });
    expect(ok.ok).toBe(true);
    const spot = deserialize(serialize(ctx.project)).system.fishing?.spots[0];
    expect(spot?.catches).toEqual([]);
    expect(spot?.monsterCatches).toEqual([{ speciesId: "sp_carp", weight: 1, levelMin: 4, levelMax: 6 }]);
  });

  it("낚으면 encounter 결과(troopId·레벨 범위)가 오고 interactWithLifeField 가 그대로 전달한다", () => {
    const { ctx, mapId } = monsterFixture();
    expect(runTool(ctx, "configure_fishing", { enabled: true, energyCost: 0, spots: [{ id: "s", mapId, area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ speciesId: "sp_carp", levelMin: 4, levelMax: 6 }] }] }).ok).toBe(true);
    // runTool commits a new project object onto the context — read the configured project from there.
    const project = ctx.project;
    const session = startSession(project, 1);
    const direct = attemptFishingCatch(project, session, { mapId, x: 0, y: 0 });
    expect(direct).toMatchObject({ ok: true, kind: "encounter", speciesId: "sp_carp", troopId: "troop_wild_sp_carp" });
    if (direct.ok && "level" in direct && direct.level !== undefined) expect(direct.level).toBeGreaterThanOrEqual(4);
    expect(interactWithLifeField(project, session, { mapId, x: 1, y: 1 })).toMatchObject({ kind: "encounter", troopId: "troop_wild_sp_carp" });
  });
});
