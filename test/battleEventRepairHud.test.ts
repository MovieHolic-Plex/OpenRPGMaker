/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createBattleRuntime } from "@/battle/runtime";
import { battlePartyStatus, syncBattleParty } from "@/player/battleFieldDom";

describe("battle event level changes reach the existing party HUD", () => {
  it("updates level and maximum HP without rebuilding the actor row", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const troop = project.database.troops[0];
    if (!actor || !troop) throw new Error("Missing HUD fixture records");
    const runtime = createBattleRuntime({
      project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5,
      party: { partyActorIds: [actor.id], levels: { [actor.id]: 7 }, experience: {} },
    });
    const before = runtime.snapshot();
    const party = battlePartyStatus(before);
    const row = party.querySelector(".battle-actor-status");
    expect(row?.querySelector(".battle-actor-level .battle-vital-value")?.textContent?.trim()).toBe("7");
    const after = {
      ...before,
      actors: before.actors.map(entry => ({ ...entry, level: 11, maxHp: 1100, hp: 300 })),
    };
    syncBattleParty(party, after);
    expect(party.querySelector(".battle-actor-status")).toBe(row);
    expect(row?.querySelector(".battle-actor-level .battle-vital-value")?.textContent?.trim()).toBe("11");
    expect(row?.querySelector(".battle-actor-hp .battle-vital-max")?.textContent).toBe("/1100");
  });
});
