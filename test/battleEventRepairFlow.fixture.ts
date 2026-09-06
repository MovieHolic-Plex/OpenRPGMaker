import assert from "node:assert/strict";
import { expect } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import type { ActorCommand, BattleFlow, BattleRuntime, BattleSnapshot } from "@/battle/types";
import { deserialize } from "@/project/io";
import type { Command } from "@/project/types";
import type { BattleEventPageRecord } from "@/project/types/database";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";

export const ACTOR = "actor_warrior";
export const ALLY = "actor_mage";
export const ENEMY = "enemy_training_slime";
export const TROOP = "troop_strict_training";
export const ROUTES = ["direct", "native", "m2", "page", "mixed"] as const;
type Route = (typeof ROUTES)[number];
type ChoiceCommand = Extract<Command, { kind: "choices" }>;
type PendingChoice = {
  readonly id: number;
  readonly pageId: string;
  readonly round: number;
  readonly options: readonly { readonly text: string }[];
  readonly cancelBehavior?: ChoiceCommand["cancelBehavior"];
};
// Prospective API, not a mock or implementation. Optional fields compile against
// pre-repair source; every test proves wrong runtime behavior before using them.
export type RepairRuntime = BattleRuntime & {
  resumeEventChoice?: (requestId: number, index: number) => boolean;
  cancel?: () => void;
};

export function mark(variableId: string): Command {
  return { kind: "setVariable", variableId, op: "+=", value: 1 };
}
export function choice(overrides: Partial<ChoiceCommand> = {}): ChoiceCommand {
  return {
    kind: "choices", prompt: "Choose a branch",
    options: [
      { text: "First", branch: [mark("first")] },
      { text: "Second", branch: [mark("second")] },
    ],
    ...overrides,
  };
}
export function m2(commandId: string, fields: Extract<Command, { kind: "m2Command" }>["fields"] = {}): Command {
  return { kind: "m2Command", commandId, fields };
}
export function variables(runtime: BattleRuntime): Readonly<Record<string, number>> {
  // Production eventState currently aliases live maps; assertions need a value
  // captured at this boundary, not a reference that later resumption can mutate.
  return { ...runtime.snapshot().eventState.variables };
}
export function pending(runtime: RepairRuntime): PendingChoice {
  const snapshot: BattleSnapshot & { readonly eventChoice?: PendingChoice } = runtime.snapshot();
  expect(snapshot.phase, "event execution must suspend before choosing a branch").toBe("eventChoice");
  expect(snapshot.result).toBeUndefined();
  assert.ok(snapshot.eventChoice, "a suspended battle exposes its choice request");
  return snapshot.eventChoice;
}
export function resume(runtime: RepairRuntime, request: PendingChoice, index: number): boolean {
  assert.ok(runtime.resumeEventChoice, "resumeEventChoice is required after suspension works");
  return runtime.resumeEventChoice(request.id, index);
}
export function cancel(runtime: RepairRuntime): void {
  assert.ok(runtime.cancel, "cancel is required after suspension works");
  runtime.cancel();
}

export function battleCase(input: {
  readonly flow: BattleFlow;
  readonly commands: readonly Command[];
  readonly route?: Route;
  readonly party?: readonly string[];
  readonly commandKind?: ActorCommand["kind"];
}) {
  const project = deserialize(JSON.stringify(strictFixture));
  project.system.battleModel = "rm2k3";
  const actor = project.database.actors.find(record => record.id === ACTOR);
  const ally = project.database.actors.find(record => record.id === ALLY);
  const enemy = project.database.enemies.find(record => record.id === ENEMY);
  const troop = project.database.troops.find(record => record.id === TROOP);
  const skill = project.database.skills.find(record => record.id === "skill_fire");
  assert.ok(actor && ally && enemy && troop && skill);
  actor.parameterCurves.agility = Array.from({ length: 99 }, () => 99);
  ally.parameterCurves.agility = Array.from({ length: 99 }, () => 10);
  actor.parameterCurves.maxMp = Array.from({ length: 99 }, () => 50);
  enemy.stats = { ...enemy.stats, maxHp: 5000, attack: 1, agility: 20 };
  enemy.skillIds = [];
  enemy.actions = [];
  skill.mpCost = { flat: 5, percentMax: 0 };
  const calls = input.route === "mixed" ? ["native", "m2", "page"]
    : input.route && input.route !== "direct" ? [input.route] : [];
  const calledPages: BattleEventPageRecord[] = [];
  let commands = [...input.commands];
  const tails = ["after", "later"];
  const entries = ["before"];
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const id = `call_${index}`;
    entries.push(`entry_${index}`);
    tails.push(`tail_${index}`);
    const body = [mark(`entry_${index}`), ...commands, mark(`tail_${index}`)];
    if (calls[index] === "page") {
      calledPages.push({ id, name: id, span: "battle", conditions: [{ kind: "switch", switchId: "never", value: true }], commands: body });
      commands = [m2("m2-104-battle-events", { target: id })];
    } else {
      project.commonEvents.push({ id, name: id, trigger: "none", commands: body });
      commands = [calls[index] === "native"
        ? { kind: "callCommonEvent", commonEventId: id }
        : m2("m2-106-call-common-event", { commonEventId: id })];
    }
  }
  const conditions = [{ kind: "actorCommand", actorId: ACTOR, commandId: input.commandKind ?? "defend" }] as const;
  troop.battleEventPages = [
    { id: "main", name: "Main", span: "battle", conditions: [...conditions], commands: [mark("before"), ...commands, mark("after")] },
    ...calledPages,
    { id: "later", name: "Later", span: "battle", conditions: [...conditions], commands: [mark("later")] },
  ];
  const partyActorIds = [...(input.party ?? [ACTOR])];
  const played: string[] = [];
  let rngCalls = 0;
  const runtime: RepairRuntime = createBattleRuntime({
    project, troopId: TROOP, battleFlow: input.flow, canEscape: false, canLose: true,
    party: {
      partyActorIds, levels: Object.fromEntries(partyActorIds.map(id => [id, 1])), experience: {},
      skillIds: { [ACTOR]: ["skill_fire"] },
    },
    sessionState: {
      switches: {}, inventory: {},
      variables: Object.fromEntries([...entries, ...tails, "first", "second", "cancelled"].map(id => [id, 0])),
    },
    rng: () => { rngCalls += 1; return 0.5; },
    playAudio: resourceId => played.push(resourceId),
  });
  // An explicit simulation step, not a timer or a polling-until-ready loop.
  if (input.flow === "gauge") runtime.tick(1_000_000);
  expect(runtime.snapshot().phase).toBe("actorCommand");
  expect(runtime.snapshot().activeActorId).toBe(ACTOR);
  return { project, runtime, played, tails, entries, rngCalls: () => rngCalls };
}
