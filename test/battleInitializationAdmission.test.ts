/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { playBattle } from "@/player/playSceneBattle";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { giveMonster } from "@/project/monsterCollection";
import { createSkinBattleTransition } from "@/player/battleTransition";

// Only the visual transition adapter is injected. Runtime construction/audio remain real.
vi.mock("@/player/battleTransition", async importOriginal => ({
  ...await importOriginal<typeof import("@/player/battleTransition")>(),
  createSkinBattleTransition: vi.fn(),
}));
const previous = store.getCurrent();
afterEach(() => { store.replaceProject(previous); document.body.replaceChildren(); vi.resetAllMocks(); });
function setup() {
  const project = createBlankProject();
  const troop = project.database.troops[0];
  if (!troop) throw new Error("Missing fixture troop");
  store.replaceProject(project);
  const session = startSession(project);
  const host = document.createElement("div"); document.body.append(host);
  const scene = { session, map: { height: 20 }, tileY: 0, showGameOverScreen: vi.fn(),
    game: { registry: { get: (key: string) => key === "dialogueHost" ? host : undefined } } };
  const step = { kind: "battleProcessing", troopId: troop.id, canEscape: false, canLose: false } as const;
  return { project, troop, session, host, scene, step };
}

describe("battle initialization admission", () => {
  it.each(["empty", "missing-legacy"])("rejects %s effective enemy composition before opening battle", kind => {
    const f = setup(); f.troop.members = []; f.troop.enemyIds = [];
    if (kind === "missing-legacy") Reflect.deleteProperty(f.troop, "enemyIds");
    expect(() => createBattleRuntime({ project: f.project, troopId: f.troop.id, canEscape: false, canLose: false, rng: () => 0.5 }))
      .toThrow(expect.objectContaining({ code: "BATTLE_TROOP_EMPTY" }));
    expect(createSkinBattleTransition).not.toHaveBeenCalled();
    expect(f.host.children).toHaveLength(0);
  });
  it.each(["hidden", "legacy"])("retains legitimate %s enemies", kind => {
    const f = setup();
    if (kind === "hidden") f.troop.members = f.troop.enemyIds.map(enemyId => ({ enemyId, hidden: true, x: 20, y: 20 }));
    else f.troop.members = [];
    const runtime = createBattleRuntime({ project: f.project, troopId: f.troop.id, canEscape: false, canLose: false, rng: () => 0.5 });
    expect(runtime.snapshot().phase).toBe("charging");
    if (kind === "legacy") expect(runtime.snapshot().enemies.length).toBeGreaterThan(0);
    runtime.cancel();
  });
  it("restores field audio when real runtime construction throws", async () => {
    const f = setup();
    f.troop.members = [{ enemyId: "removed-enemy", x: 20, y: 20 }];
    const before = structuredClone(f.session.audio);
    await expect(Promise.resolve().then(() => playBattle(f.scene, f.step, 0))).rejects.toBeInstanceOf(Error);
    expect(f.session.audio).toEqual(before);
    expect(createSkinBattleTransition).not.toHaveBeenCalled();
  });
  it("restores field audio when transition initialization throws", async () => {
    const f = setup(); const before = structuredClone(f.session.audio);
    const error = new Error("transition-init-sentinel");
    vi.mocked(createSkinBattleTransition).mockImplementation(() => { throw error; });
    await expect(Promise.resolve().then(() => playBattle(f.scene, f.step, 0))).rejects.toBe(error);
    expect(f.session.audio).toEqual(before);
    expect(f.session.battleResult).toBeUndefined();
  });
  it("admits the same battle after a missing starter is corrected", async () => {
    const f = setup(); f.project.system.battleParty = "monsters"; f.session.monsterParty = [];
    await expect(playBattle(f.scene, f.step, 0)).rejects.toMatchObject({ code: "BATTLE_MONSTER_PARTY_EMPTY" });
    giveMonster(f.project, f.session, { speciesId: "species_wild_slime", level: 5 });
    expect(f.session.monsterParty).toHaveLength(1);
    const controller = new AbortController();
    const destroy = vi.fn();
    vi.mocked(createSkinBattleTransition).mockReturnValue({
      cover: async () => undefined, reveal: async () => undefined, exit: async () => undefined, destroy,
    });
    const pending = playBattle({ ...f.scene, battleAbortController: controller }, f.step, 0);
    expect(createSkinBattleTransition).toHaveBeenCalledTimes(1);
    controller.abort();
    expect(await pending).toBeNull();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(f.session.battleResult).toBeUndefined();
  });

  it.each(["canonical", "legacy"])("rejects empty %s monster party without fabricating escape or defeat", async kind => {
    const f = setup();
    if (kind === "canonical") f.project.system.battleParty = "monsters";
    else f.project.system.monsterBattleParty = true;
    f.session.monsterParty = [];
    const before = structuredClone(f.session);
    await expect(Promise.resolve().then(() => playBattle(f.scene, f.step, 0)))
      .rejects.toMatchObject({ code: "BATTLE_MONSTER_PARTY_EMPTY" });
    expect(f.session).toEqual(before);
    expect(createSkinBattleTransition).not.toHaveBeenCalled();
  });
});
