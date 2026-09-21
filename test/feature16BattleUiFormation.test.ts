import { describe, expect, it } from "vitest";
import { actorBattlers, battlerSnapshot, refreshActorBattlerDerivedStats } from "@/battle/battleBattlers";
import { formationDamage } from "@/battle/battleFormation";
import { applySkillLike } from "@/battle/battleDamage";
import { predictSkillDamage } from "@/battle/battlePredict";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import { formationDetail } from "@/player/playerFormationDetail";
import fixture from "./fixtures/projects/battle-v3.json";

const setup = () => deserialize(JSON.stringify(fixture));
describe("feature16 physical formation", () => {
  it("reduces outgoing/incoming physical damage with legacy fronts and magic unchanged", () => {
    expect(formationDamage(100, "back", "front", "attack", "damage")).toBe(75);
    expect(formationDamage(100, "front", "back", "attack", "damage")).toBe(75);
    expect(formationDamage(100, "back", "back", "attack", "damage")).toBe(56);
    expect(formationDamage(100, undefined, undefined, "attack", "damage")).toBe(100);
    expect(formationDamage(100, "back", "back", "mind", "damage")).toBe(100);
    expect(formationDamage(100, "back", "back", "attack", "healing")).toBe(100);
    expect(formationDamage(-10, "back", "back", "attack", "damage")).toBe(-10);
    expect(formationDamage(0, "back", "back", "attack", "damage")).toBe(0);
    expect(formationDamage(1, "back", "back", "attack", "damage")).toBe(1);
  });
  it("retains raw stats and row through equipment refresh and snapshot", () => {
    const project = setup();
    const front = actorBattlers(project)[0]!;
    const back = actorBattlers(project, { rows: { [front.recordId]: "back" } })[0]!;
    expect(back.attackPower).toBe(front.attackPower);
    expect(back.defense).toBe(front.defense);
    refreshActorBattlerDerivedStats(project, back, {});
    expect(back.row).toBe("back");
    expect(battlerSnapshot(back).row).toBe("back");
    expect(back.defense).toBe(front.defense);
  });
  // Parent combat integration: runtime forwards party.rows; shared damage and prediction apply formationDamage once.
  it("wires saved rows into runtime, damage and prediction without affecting mind skills", () => {
    const project = setup();
    const session = startSession(project);
    const id = session.partyActorIds[0]!;
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true,
      party: { levels: session.actorLevels, experience: {}, rows: { [id]: "back" } } });
    expect(runtime.snapshot().actors.find(a => a.recordId === id)?.row).toBe("back");
    const front = actorBattlers(project)[0]!;
    const back = actorBattlers(project, { rows: { [id]: "back" } })[0]!;
    for (const statistic of ["attack", "mind"] as const) {
      const spec = { power: 100, statistic, effect: "damage" as const, hitRate: 100, variance: 0, criticalRate: 0, rng: () => 0.5 };
      const target = structuredClone(front);
      const base = applySkillLike(structuredClone(front), target, spec).amount;
      const actual = applySkillLike(structuredClone(back), structuredClone(front), spec).amount;
      expect(actual).toBe(statistic === "attack" ? Math.max(1, Math.floor(base * 0.75)) : base);
      const incoming = applySkillLike(structuredClone(front), structuredClone(back), spec).amount;
      expect(incoming).toBe(statistic === "attack" ? Math.max(1, Math.floor(base * 0.75)) : base);
      const prediction = predictSkillDamage(project, battlerSnapshot(back), spec, battlerSnapshot(front));
      expect(prediction.amount).toBe(actual);
    }
  });
  it("offers active/reserve ordering and row actions via real detail callbacks", () => {
    const project = setup();
    project.system.activeSlots = 1;
    project.database.actors.push({ ...structuredClone(project.database.actors[0]!), id: "feature16_reserve", name: "대기 동료" });
    const session = startSession(project);
    session.partyActorIds = [session.partyActorIds[0]!, "feature16_reserve"];
    let picked = "";
    let toggled = "";
    let move: unknown;
    const options = { project, session, slots: [], waitModeEnabled: true, selectedCommand: "formation" as const,
      onSelectFormationActor: (id: string) => { picked = id; }, onToggleRow: (id: string) => { toggled = id; },
      onMoveFormationActor: (id: string, index: number) => { move = [id, index]; } };
    const list = formationDetail(options);
    expect(list.entries[0]!.value).toContain("참전");
    list.entries[0]!.onActivate!();
    expect(picked).toBe(session.partyActorIds[0]);
    const selected = formationDetail({ ...options, formationActorId: picked });
    selected.entries.find(e => e.testId === "status-menu-formation-toggle-row")!.onActivate!();
    expect(toggled).toBe(picked);
    expect(selected.entries[1]!.value).toContain("대기");
    selected.entries[1]!.onActivate!();
    expect(move).toEqual([picked, 1]);
  });
});
