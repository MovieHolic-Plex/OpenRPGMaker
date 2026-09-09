import { deserialize } from "@/project/io";
import type { BattleFlow, Command, Project } from "@/project/types";
import strictFixture from "./projects/battle-strict-v3.json";

export const BATTLE_FLOW_QA_CASES = [
  "choice-enter", "choice-z", "cancel-option", "cancel-branch",
  "game-over", "kill-player", "abort", "force-escape", "teardown", "sequential",
] as const;
export type BattleFlowQaCase = (typeof BATTLE_FLOW_QA_CASES)[number];
export const BATTLE_FLOW_QA_SENTINELS = [
  "first", "second", "cancelled", "mainEntry", "outerEntry", "innerEntry", "pageEntry",
  "pageTail", "innerTail", "outerTail", "mainTail", "laterPage", "terminalTail", "mapTail",
] as const;
export const BATTLE_FLOW_QA_ACTOR = "actor_warrior";
export const BATTLE_FLOW_QA_TROOP = "troop_strict_training";

function variable(index: number): string { return `var_${String(index).padStart(4, "0")}`; }
function mark(index: number): Command { return { kind: "setVariable", variableId: variable(index), op: "+=", value: 1 }; }
function m2(commandId: string, fields: Extract<Command, { kind: "m2Command" }>["fields"] = {}): Command {
  return { kind: "m2Command", commandId, fields };
}
function terminal(kind: BattleFlowQaCase): Command | undefined {
  switch (kind) {
    case "game-over": return { kind: "gameOver" };
    case "kill-player": return { kind: "killPlayer" };
    case "abort": return m2("m2-105-abort-battle");
    case "force-escape": return m2("m2-107-force-escape");
    default: return undefined;
  }
}

/** Pure test-only authoring: no store, runtime, DOM, Vitest, RNG or filesystem. */
export function buildBattleEventRepairFlowProject(flow: BattleFlow, scenario: BattleFlowQaCase): Project {
  const project = deserialize(JSON.stringify(strictFixture));
  const actor = project.database.actors.find(record => record.id === BATTLE_FLOW_QA_ACTOR);
  const actorClass = project.database.classes.find(record => record.id === actor?.classId);
  const enemy = project.database.enemies.find(record => record.id === "enemy_training_slime");
  const troop = project.database.troops.find(record => record.id === BATTLE_FLOW_QA_TROOP);
  if (!actor || !actorClass || !enemy || !troop) throw new Error("Battle QA base fixture is incomplete");
  project.meta.title = `Battle flow QA: ${flow}/${scenario}`;
  project.system.battleFlow = flow;
  project.system.battleModel = "rm2k3";
  project.system.battleUiStyle = "rm2000";
  project.system.startActorIds = [actor.id];
  project.session.partyActorIds = [actor.id];
  project.session.inventory = {};
  project.variables = [...BATTLE_FLOW_QA_SENTINELS, "waitOne", "waitTwo", "key", "right", "wrong"].map((name, index) => ({ id: variable(index + 1), name }));
  project.session.variables = Object.fromEntries(project.variables.map(record => [record.id, 0]));
  project.switches = [{ id: "qa_never", name: "Explicit-call-only page" }];
  project.session.switches = { qa_never: false };
  actor.parameterCurves.agility = Array.from({ length: 99 }, () => 99);
  actor.parameterCurves.maxHp = Array.from({ length: 99 }, () => 1000);
  enemy.stats = { ...enemy.stats, maxHp: 5000, attack: 1, agility: 1 };
  enemy.actions = []; enemy.skillIds = [];
  actorClass.battleCommands = [
    { id: "qa_guard", name: "Guard", kind: "guard" },
    { id: "qa_attack", name: "Attack", kind: "attack" },
  ];
  const conditions = [{ kind: "actorCommand", actorId: actor.id, commandId: "defend" }] as const;
  const end = terminal(scenario);
  const pick: Command = {
    kind: "choices", prompt: "BF_PICK f=\\v[1] s=\\v[2] c=\\v[3] e=\\v[7] t=\\v[8]",
    options: [{ text: "First", branch: [mark(1)] }, { text: "Second", branch: [mark(2)] }],
    cancelBehavior: scenario === "cancel-option" ? "choice2" : scenario === "cancel-branch" ? "branch" : "disallow",
    cancelBranch: [mark(3)],
  };
  const sequential: Command[] = scenario === "sequential" ? [
    { kind: "changeFace", resourceId: "easyrpg-faceset-actor1-02", position: "right", flipHorizontally: true },
    { kind: "displayTextSettings", format: "transparent", position: "top", preventObscuringPlayer: false, allowEventMovementDuringWait: true },
    { kind: "text", speaker: "Guard", emotion: "angry", body: "\\>BF_TEXT e=\\v[7] t=\\v[8]\nSecond line\nThird line\nFourth line\nBF_PAGE2 w=\\v[15]" },
    { kind: "wait", ms: 500 }, mark(15),
    { kind: "text", body: "\\>BF_WAIT1 w=\\v[15] x=\\v[16]", autoAdvance: true },
    { kind: "wait", ms: 700 }, mark(16),
    { kind: "inputWait", variableId: variable(17) },
    { kind: "fork", condition: { kind: "variable", variableId: variable(17), op: "==", value: 3 }, then: [mark(18)], else: [mark(19)] },
    { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false },
    { kind: "text", body: "\\>BF_KEY k=\\v[17] r=\\v[18] f=\\v[19] w=\\v[15] x=\\v[16]" },
  ] : [];
  project.commonEvents = [
    { id: "qa_outer", name: "Native outer call", trigger: "none", commands: [
      mark(5), m2("m2-106-call-common-event", { commonEventId: "qa_inner" }), mark(10),
    ] },
    { id: "qa_inner", name: "M2 inner call", trigger: "none", commands: [
      mark(6), m2("m2-104-battle-events", { target: "qa_called" }), mark(9),
    ] },
  ];
  troop.battleFlow = flow;
  troop.battleEventPages = [
    { id: "qa_main", name: "Main", span: "battle", conditions: [...conditions], commands: [
      mark(4), { kind: "callCommonEvent", commonEventId: "qa_outer" }, mark(11),
    ] },
    { id: "qa_called", name: "Explicit nested page", span: "battle",
      conditions: [{ kind: "switch", switchId: "qa_never", value: true }],
      commands: [mark(7), ...sequential, ...(end ? [end, mark(13)] : [pick]), mark(8)],
    },
    { id: "qa_later", name: "Later automatic page", span: "battle", conditions: [...conditions], commands: [
      mark(12), { kind: "choices",
        prompt: "BF_DONE f=\\v[1] s=\\v[2] c=\\v[3] p=\\v[8] i=\\v[9] o=\\v[10] m=\\v[11] n=\\v[12]",
        cancelBehavior: "disallow", options: [{ text: "Finish battle", branch: [m2("m2-107-force-escape")] }],
      }, mark(13),
    ] },
  ];
  const map = project.maps[project.startMapId];
  map.width = 20; map.height = 15;
  map.lowerTiles = Array.from({ length: 300 }, () => 0);
  map.upperTiles = Array.from({ length: 300 }, () => -1);
  map.encounterRate = 0; map.troopIds = [];
  project.startPos = { x: 8, y: 8 };
  const commands: Command[] = [
    { kind: "battleProcessing", troopId: troop.id, battleFlow: flow, canEscape: false, canLose: true },
    mark(14), { kind: "text", body: "\\>BF_MAP f=\\v[1] s=\\v[2] c=\\v[3] p=\\v[8] i=\\v[9] o=\\v[10] m=\\v[11] n=\\v[12] t=\\v[13] a=\\v[14]" },
  ];
  map.events = [{ id: "qa_battle", name: "Battle flow contract", x: 8, y: 9,
    trigger: { kind: "action" }, commands, pages: [{ id: "qa_battle_page", name: "Battle",
      conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
    }],
  }];
  return project;
}
