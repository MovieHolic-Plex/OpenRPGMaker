import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { editorDefaultsLeft } from "@/ai/v2/judge/shipChecks";
import { applyLookDefaults } from "@/ai/v2/story/shipDefaults";
import type { Project } from "@/project/types";

// 2026-11-05 gpt-only-game round 5 (v1 assistant, Terra alone): all five games played to their ending,
// but four shipped the editor's default battle music, battle backdrop, game-over screen and window look.
describe("applyLookDefaults (v1 whole-game finish)", () => {
  function battleGame(): Project {
    const p = createBlankProject() as Project;
    const map = p.maps[p.startMapId!]!;
    map.name = "어두운 숲";
    map.events.push({ id: "ev_slime", name: "슬라임", x: 3, y: 3, pages: [{ conditions: [], trigger: "action", commands: [{ kind: "battleProcessing", troopId: p.database.troops[0]?.id ?? "troop_1" }] }] } as never);
    return p;
  }
  const ids = (p: Project) => editorDefaultsLeft(p).map((b) => b.id);

  it("fills battle music, backdrop, game over and window look, and is idempotent", () => {
    const p = battleGame();
    expect(ids(p)).toEqual(expect.arrayContaining(["battle-bgm", "battle-background", "game-over", "window-look"]));
    expect(applyLookDefaults(p).length).toBeGreaterThan(0);
    for (const id of ["battle-bgm", "battle-background", "game-over", "window-look", "hero-look", "party-names"]) expect(ids(p)).not.toContain(id);
    expect(applyLookDefaults(p)).toEqual([]);
  });

  it("renames the default hero's dialogue speaker along with the hero", () => {
    const p = battleGame();
    const hero = p.database.actors.find((a) => a.id === p.system.startActorIds?.[0])!;
    const oldName = hero.name;
    const line = { kind: "text", speaker: oldName, body: "가자!" };
    p.maps[p.startMapId!]!.events.push({ id: "ev_talk", name: "독백", x: 4, y: 4, pages: [{ conditions: [], trigger: "action", commands: [line] }] } as never);
    applyLookDefaults(p, "좀비 생존 게임 만들어줘");
    expect(hero.name).not.toBe(oldName);
    expect(line.speaker).toBe(hero.name);
  });

  it("keeps values the author already chose", () => {
    const p = battleGame();
    p.system.menuUiStyle = "journal";
    p.maps[p.startMapId!]!.battleBackground = "battle-scenery-cave";
    applyLookDefaults(p);
    expect(p.system.menuUiStyle).toBe("journal");
    expect(p.maps[p.startMapId!]!.battleBackground).toBe("battle-scenery-cave");
  });
  it("turns the default HUD off when nothing can lower HP, and picks a genre HUD when it can", () => {
    const calm = createBlankProject() as Project;
    calm.maps[calm.startMapId!]!.events.push({ id: "ev_talk", name: "서아", x: 2, y: 2, pages: [{ conditions: [], trigger: "action", commands: [{ kind: "text", body: "안녕" }] }] } as never);
    expect(ids(calm)).toContain("hud");
    applyLookDefaults(calm, "학교 연애 게임 만들어줘");
    expect(calm.system.fieldHud?.vitals).toBe(false);
    expect(calm.system.fieldHud?.objective).toBe(true);
    expect(ids(calm)).not.toContain("hud");
    const fight = battleGame();
    applyLookDefaults(fight, "좀비 생존 게임 만들어줘");
    expect(fight.system.fieldHud?.theme).toBe("horror");
    expect(ids(fight)).not.toContain("hud");
    const action = createBlankProject() as Project;
    action.system.actionCombat = { ...(action.system.actionCombat ?? {}), enabled: true } as never;
    applyLookDefaults(action, "판타지 액션 게임 만들어줘");
    expect(action.system.fieldHud?.theme).toBe("hearts");
  });
  it("never fills the title or ending picture with a bundled still: the ship check keeps flagging it until the model picks or makes one", () => {
    const p = battleGame();
    p.endings = [{ id: "ending_escape", name: "탈출", conditions: [], priority: 0 }, { id: "ending_kept", name: "남은 자", conditions: [], priority: 1, presentation: { backgroundResourceId: "mine" } }] as never;
    const titleBefore = p.system.titleScreen?.backgroundResourceId;
    expect(ids(p)).toContain("ending-screen");
    expect(ids(p)).toContain("title-image");
    applyLookDefaults(p, "좀비 생존 게임 만들어줘");
    expect(p.endings[0]!.presentation).toBeUndefined();
    expect(p.endings[1]!.presentation?.backgroundResourceId).toBe("mine");
    expect(p.system.titleScreen?.backgroundResourceId).toBe(titleBefore);
    expect(ids(p)).toContain("ending-screen");
    expect(ids(p)).toContain("title-image");
  });

  it("keeps a picture the model chose and leaves a blueprint game's ending for the model", () => {
    const p = createBlankProject() as Project;
    p.endings = [{ id: "ending_love", name: "함께 걷는 길", conditions: [], priority: 0, presentation: { backgroundResourceId: "oprn-title-romance-campus", tone: "warm" } }] as never;
    applyLookDefaults(p, "학교 연애 게임 만들어줘");
    expect(p.endings[0]!.presentation).toEqual({ backgroundResourceId: "oprn-title-romance-campus", tone: "warm" });
    const planned = createBlankProject() as Project;
    planned.endings = [{ id: "ending_home", name: "귀향", conditions: [], priority: 0 }] as never;
    planned.gameBlueprint = { request: "마을 모험", title: "귀향", premise: "마을 모험", steps: [], ending: { name: "귀향", how: "돌아온다" } } as never;
    applyLookDefaults(planned);
    expect(planned.endings[0]!.presentation).toBeUndefined();
  });
});
