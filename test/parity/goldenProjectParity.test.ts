// test/parity/goldenProjectParity.test.ts
// Invariant: one canonical authored project plays end-to-end headlessly — valid references,
// every DB collection populated, a battle resolves, and authored events fire in the scene.
import { describe, expect, it } from "vitest";
import { DEFAULT_TROOP_ID } from "@/project/defaults";
import { battle, firstMapId, referenceIssues, scene } from "./parityRig";
import { createGoldenParityProject, GOLDEN_SWITCH, GOLDEN_SWITCH_EVENT, GOLDEN_TITLE_EFFECTS, GOLDEN_TRANSFER_DEST, GOLDEN_TRANSFER_EVENT } from "./goldenProject";

describe("golden project headless playthrough", () => {
  it("is reference-valid and exercises every database collection", () => {
    const project = createGoldenParityProject();
    expect(referenceIssues(project)).toEqual([]);
    expect(project.database.actors.length).toBeGreaterThan(0);
    expect(project.database.classes.length).toBeGreaterThan(0);
    expect(project.database.skills.length).toBeGreaterThan(0);
    expect(project.database.items.length).toBeGreaterThan(0);
    expect(project.database.equipment.length).toBeGreaterThan(0);
    expect(project.database.enemies.length).toBeGreaterThan(0);
    expect(project.database.troops.length).toBeGreaterThan(0);
    expect(project.database.states.length).toBeGreaterThan(0);
    expect(project.database.battleAnimations.length).toBeGreaterThan(0);
    expect((project.database.monsterSpecies ?? []).length).toBeGreaterThan(0);
    expect((project.database.crops ?? []).length).toBeGreaterThan(0);
  });

  it("preserves authored titleScreen effect fields through the editor round-trip", () => {
    // editorProject 는 serialize→deserialize 라운드트립을 포함한다 — 확장 필드가 그대로 남아야 한다.
    const project = createGoldenParityProject();
    expect(project.system.titleScreen?.backgroundLayers).toEqual(GOLDEN_TITLE_EFFECTS.backgroundLayers);
    expect(project.system.titleScreen?.particles).toEqual(GOLDEN_TITLE_EFFECTS.particles);
    expect(project.system.titleScreen?.intro).toEqual(GOLDEN_TITLE_EFFECTS.intro);
  });

  it("plays a scripted battle to a deterministic result", () => {
    const project = createGoldenParityProject();
    const script = [[{ actorId: "actor_hero", command: "attack", target: "enemy-1" }]];
    const result = battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 10, n: 3, seed: 7, battleFlow: "strict", strictScript: script as never });
    expect(result.samples).toBe(3);
    expect(result.avgTurns).toBeGreaterThan(0);
  });

  it("fires the authored switch event in the scene", () => {
    const project = createGoldenParityProject();
    const result = scene(project, {
      mapId: firstMapId(project),
      start: { x: GOLDEN_SWITCH_EVENT.x, y: GOLDEN_SWITCH_EVENT.y - 1 },
      steps: [{ kind: "interact" }, { kind: "expect", switchOn: GOLDEN_SWITCH }],
    });
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("runs the authored transfer event in the scene", () => {
    const project = createGoldenParityProject();
    const result = scene(project, {
      mapId: firstMapId(project),
      start: { x: GOLDEN_TRANSFER_EVENT.x, y: GOLDEN_TRANSFER_EVENT.y - 1 },
      steps: [{ kind: "interact" }, { kind: "expect", playerAt: { x: GOLDEN_TRANSFER_DEST.x, y: GOLDEN_TRANSFER_DEST.y } }],
    });
    expect(result.ok, result.failureReason).toBe(true);
  });
});
