import { describe, expect, it } from "vitest";
import { createBattleRuntime, type ActorCommand, type BattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { createBattleSequencer } from "@/player/battleSequencer";
import { actorCommandDirectorState } from "@/player/battleDirectorDom";
import { createBlankProject } from "@/project/defaults";
import { ACTOR_MAGE_ID } from "@/project/defaults/defaultDatabaseRecordIds";
import { DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID, DEFAULT_STATE_ID } from "@/project/defaults/constants";

function readyBattle(options: {
  inventory: Record<string, number>;
  stateIds?: Record<string, readonly string[]>;
  vitals?: Record<string, { hp: number; mp: number }>;
  partyActorIds?: readonly string[];
}) {
  const project = createBlankProject();
  const troopId = project.database.troops[0]?.id;
  if (!troopId) throw new Error("missing troop");
  const partyActorIds = options.partyActorIds ?? [DEFAULT_ACTOR_ID];
  const runtime = createBattleRuntime({
    project,
    troopId,
    canEscape: true,
    canLose: true,
    battleFlow: "gauge",
    rng: () => 0.5,
    party: {
      partyActorIds: [...partyActorIds],
      levels: Object.fromEntries(partyActorIds.map((id) => [id, 1])),
      experience: Object.fromEntries(partyActorIds.map((id) => [id, 0])),
      ...(options.vitals ? { vitals: options.vitals } : {}),
      ...(options.stateIds ? { stateIds: options.stateIds } : {}),
    },
    sessionState: { switches: {}, variables: {}, inventory: options.inventory },
  });
  for (let i = 0; i < 40 && runtime.snapshot().phase !== "actorCommand"; i += 1) runtime.tick(1_000);
  expect(runtime.snapshot().phase).toBe("actorCommand");
  return runtime;
}

function useItem(runtime: BattleRuntime, itemId: string, targetActorId?: string) {
  const command: ActorCommand = { kind: "item", itemId, targetEnemyId: "", ...(targetActorId ? { targetActorId } : {}) };
  const before = runtime.snapshot();
  runtime.performActorCommand(command);
  const after = runtime.snapshot();
  return { command, before, after, delta: after.timeline.slice(before.timeline.length) };
}

/** 명령 직후 메시지 창에 올라오는 줄. 적 턴까지 가지 않도록 몇 비트만 뺀다. */
function spokenLines(runtime: BattleRuntime, command: ActorCommand, before: BattleSnapshot, after: BattleSnapshot): string[] {
  const lines: string[] = [];
  const queue: Array<() => void> = [];
  const sequencer = createBattleSequencer(
    runtime,
    {
      onDirectorState: (state) => lines.push(...state.lines),
      onSyncView: () => {},
      onDamageFeedback: () => {},
      onResultStage: () => {},
      onSequenceBusy: () => {},
    },
    (callback) => {
      queue.push(callback);
      return queue.length;
    },
    () => {},
  );
  sequencer.runAfterActorCommand(command, before, after);
  for (let i = 0; i < 16 && queue.length > 0; i += 1) queue.shift()?.();
  sequencer.cancel();
  return lines;
}

describe("status-only battle medicine messages", () => {
  it("cures poison without a zero heal or an insufficient-effect line", () => {
    const runtime = readyBattle({
      inventory: { item_antidote: 1 },
      stateIds: { [DEFAULT_ACTOR_ID]: [DEFAULT_STATE_ID] },
    });
    const { command, before, after, delta } = useItem(runtime, "item_antidote", DEFAULT_ACTOR_ID);
    const own = delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);

    expect(after.actors[0]?.stateIds ?? []).not.toContain(DEFAULT_STATE_ID);
    expect(after.eventState.inventory.item_antidote ?? 0).toBe(0);
    expect(own.some((entry) => entry.kind === "stateRemoved" && entry.stateId === DEFAULT_STATE_ID)).toBe(true);
    expect(own.some((entry) => entry.kind === "healing")).toBe(false);
    expect(own.some((entry) => entry.kind === "action" && (entry.amount ?? 0) === 0)).toBe(false);

    const director = actorCommandDirectorState(command, before, after).lines.join(" ");
    expect(director).toContain("해독초");
    expect(director).toContain("사용했다");
    expect(director).not.toContain("효과가 충분하지 않았다");

    const spoken = spokenLines(runtime, command, before, after).join(" ");
    expect(spoken).toContain("해독초");
    expect(spoken).toContain("독이 풀렸다");
    expect(spoken).not.toContain("효과가 충분하지 않았다");
    expect(spoken).not.toContain("합계 0");
  });

  it("still says the effect was insufficient when the antidote cures nothing", () => {
    const runtime = readyBattle({ inventory: { item_antidote: 1 } });
    const { command, before, after, delta } = useItem(runtime, "item_antidote", DEFAULT_ACTOR_ID);
    const own = delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);

    expect(after.eventState.inventory.item_antidote ?? 0).toBe(0);
    expect(own.some((entry) => entry.kind === "stateRemoved")).toBe(false);
    expect(own.some((entry) => entry.kind === "healing")).toBe(false);
    expect(own.some((entry) => entry.kind === "action" && (entry.amount ?? 0) === 0)).toBe(true);
    expect(actorCommandDirectorState(command, before, after).lines.join(" ")).toContain("효과가 충분하지 않았다");
  });

  it("still heals a wounded ally and still reports a full-HP potion as insufficient", () => {
    const wounded = readyBattle({
      inventory: { [DEFAULT_ITEM_ID]: 1 },
      vitals: { [DEFAULT_ACTOR_ID]: { hp: 20, mp: 5 } },
    });
    const healed = useItem(wounded, DEFAULT_ITEM_ID, DEFAULT_ACTOR_ID);
    expect(healed.after.actors[0]?.hp).toBe(70);
    expect(healed.delta.some((entry) => entry.kind === "healing" && entry.resource === "hp" && (entry.amount ?? 0) > 0)).toBe(true);
    expect(actorCommandDirectorState(healed.command, healed.before, healed.after).lines.join(" ")).toMatch(/회복했다/);

    const full = readyBattle({
      inventory: { [DEFAULT_ITEM_ID]: 1 },
      vitals: { [DEFAULT_ACTOR_ID]: { hp: 9999, mp: 9999 } },
    });
    const wasted = useItem(full, DEFAULT_ITEM_ID, DEFAULT_ACTOR_ID);
    const own = wasted.delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);
    expect(wasted.after.actors[0]?.hp).toBe(wasted.after.actors[0]?.maxHp);
    expect(own.some((entry) => entry.kind === "healing")).toBe(false);
    expect(own.some((entry) => entry.kind === "action" && (entry.amount ?? 0) === 0)).toBe(true);
    expect(actorCommandDirectorState(wasted.command, wasted.before, wasted.after).lines.join(" ")).toContain("효과가 충분하지 않았다");
  });

  it("does not summarize a party cleanse as zero recovery", () => {
    const runtime = readyBattle({
      inventory: { item_gen2_party_cleanse: 1 },
      partyActorIds: [DEFAULT_ACTOR_ID, ACTOR_MAGE_ID],
      stateIds: {
        [DEFAULT_ACTOR_ID]: ["state_attack_down"],
        [ACTOR_MAGE_ID]: ["state_attack_down"],
      },
    });
    const { command, before, after, delta } = useItem(runtime, "item_gen2_party_cleanse");
    const own = delta.filter((entry) => entry.userRecordId === DEFAULT_ACTOR_ID);
    const cured = own.filter((entry) => entry.kind === "stateRemoved" && entry.stateId === "state_attack_down");

    expect(cured).toHaveLength(2);
    expect(own.some((entry) => entry.kind === "healing")).toBe(false);
    expect(after.actors.every((actor) => !actor.stateIds.includes("state_attack_down"))).toBe(true);
    expect(after.eventState.inventory.item_gen2_party_cleanse ?? 0).toBe(0);

    const spoken = spokenLines(runtime, command, before, after).join(" ");
    expect(spoken).toContain("맑은 종");
    expect(spoken).toContain("주인공의 공격 하락이 풀렸다");
    expect(spoken).toContain("마도사의 공격 하락이 풀렸다");
    expect(spoken).not.toContain("효과가 충분하지 않았다");
    expect(spoken).not.toContain("합계 0");
    expect(spoken).not.toMatch(/의 공격!/);
  });
});
