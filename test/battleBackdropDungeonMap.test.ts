import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { resolveBattleBackdrop } from "@/battle/battleBackdrop";
import type { Project } from "@/project/types";

// jrpg-real-1 J08: 지하묘지 박쥐 전투가 숲 배경이었다(적 그룹이 숲 값을 들고 있고, 맵 battleBackground 는 런타임이 읽지 않았다).
function withMap(patch: Record<string, unknown>, troopBg = "battle-scenery-forest"): Project {
  const project = createBlankProject();
  const mapId = project.startMapId;
  Object.assign(project.maps[mapId]!, patch);
  project.database.troops.push({ id: "troop_t", name: "t", enemyIds: [project.database.enemies[0]!.id], battleEventPages: [], previewBackgroundResourceId: troopBg } as never);
  return project;
}
const at = (project: Project) => ({ project, troopId: "troop_t", location: { mapId: project.startMapId, x: 1, y: 1 } });

describe("resolveBattleBackdrop map-aware fallbacks (J08)", () => {
  it("a dungeon-named map beats the troop's default forest value", () => {
    expect(resolveBattleBackdrop(at(withMap({ name: "고대 지하묘지" })))).toBe("battle-scenery-cave");
  });
  it("an authored map battleBackground is honoured", () => {
    expect(resolveBattleBackdrop(at(withMap({ name: "마을", battleBackground: "battle-scenery-desert" })))).toBe("battle-scenery-desert");
  });
  it("a non-forest troop background still wins", () => {
    expect(resolveBattleBackdrop(at(withMap({ name: "고대 지하묘지" }, "battle-scenery-snow")))).toBe("battle-scenery-snow");
  });
  it("a plain forest map keeps the forest", () => {
    expect(resolveBattleBackdrop(at(withMap({ name: "숲길" })))).toBe("battle-scenery-forest");
  });
});
