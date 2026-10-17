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
  // jrpg-loop-1 ct1: 안개 낀 「멸망한 폐허 크로노폴리스(미래)」 보스전이 울창한 숲에서 벌어졌다 — 맵 이름이 장소의 성격이다.
  it("a ruined-city or town name gets the open plains, not the forest default", () => {
    expect(resolveBattleBackdrop(at(withMap({ name: "멸망한 폐허 크로노폴리스(미래 A.D. 2300)" })))).toBe("battle-scenery-plains");
    expect(resolveBattleBackdrop(at(withMap({ name: "시간의 마을 크로노폴리스(현재)" })))).toBe("battle-scenery-plains");
  });
  it("a desert name gets the desert; a name that also says forest keeps the forest", () => {
    expect(resolveBattleBackdrop(at(withMap({ name: "모래바람 사막 도시" })))).toBe("battle-scenery-desert");
    expect(resolveBattleBackdrop(at(withMap({ name: "고대의 숲 마을" })))).toBe("battle-scenery-forest");
  });
});
