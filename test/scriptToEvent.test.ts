// test/scriptToEvent.test.ts — script → event commands ("명령으로 풀기", src/editor/script/scriptToEvent.ts)
// and the assistant tool write_script_as_commands (src/editor/tools/scriptUnwrapTool.ts).
// (a) round trip: commandsToScript → scriptToCommands gives the same commands (normalizations listed below);
// (b) behavior: the original script and its converted commands produce the same dry-run transcript and changes;
// (c) refusals: non-convertible scripts return the right codes and lines and change nothing.
import { beforeAll, describe, expect, it } from "vitest";
import { prepareScriptCompiler } from "@/editor/script/compile";
import { commandsToScript } from "@/editor/script/eventToScript";
import { SCRIPT_UNWRAP_PROBLEM_CODES, scriptToCommands, scriptUnwrapProblemText } from "@/editor/script/scriptToEvent";
import { runTool } from "@/editor/tools";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { preloadScriptEngine } from "@/player/script/engine";
import { createBlankProject, DEFAULT_ITEM_ID } from "@/project/defaults";
import type { Command, Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

beforeAll(async () => {
  await Promise.all([prepareScriptCompiler(), preloadScriptEngine()]);
}, 60_000);

const c = (command: Record<string, unknown>): Command => command as unknown as Command;

function converted(source: string, project?: Project): Command[] {
  const result = scriptToCommands(source, project ? { project } : {});
  if (!result.ok) throw new Error(result.problems.map((problem) => `L${problem.line} ${problem.code}: ${problem.snippet}`).join("\n"));
  return result.commands;
}

function codesOf(source: string): { line: number; code: string }[] {
  const result = scriptToCommands(source);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.problems.map(({ line, code }) => ({ line, code }));
}

// ── (a) round trip ───────────────────────────────────────────────────────────
// Normalizations (forms the forward printer collapses, so the fixtures use the canonical side):
// - choices: every option carries `branch` ([] when empty); no cancelBehavior = "disallow";
// - fork: `else` only when non-empty; all/any with one child = the child;
// - setVariable `+=` with a negative literal comes back as `-=` with the positive value;
// - battleProcessing: branchOnResult only with at least one non-empty branch; canEscape/canLose explicit;
// - an inlined `script` command comes back as its own commands (separate test).

const ROUND_TRIP: Record<string, Command[]> = {
  "dialogue, choices with cancel, waits, passthrough": [
    c({ kind: "text", speaker: "Guard", body: "Halt!" }),
    c({
      kind: "choices",
      prompt: "Pay the toll?",
      options: [
        { text: "Pay 10", branch: [c({ kind: "fork", condition: { kind: "gold", op: ">=", amount: 10 }, then: [c({ kind: "changeGold", op: "-=", amount: 10 }), c({ kind: "setSwitch", switchId: "sw_paid", value: true })], else: [c({ kind: "text", body: "Broke." })] })] },
        { text: "Leave", branch: [] },
        { text: "Argue", branch: [c({ kind: "text", body: "No." })] },
      ],
      cancelBehavior: "branch",
      cancelBranch: [c({ kind: "text", body: "Cancelled." })],
    }),
    c({ kind: "choices", options: [{ text: "A", branch: [] }, { text: "B", branch: [] }], cancelBehavior: "choice2" }),
    c({ kind: "wait", ms: 500 }),
    c({ kind: "wait", ms: 1000 }),
    c({ kind: "recoverAll" }),
    c({ kind: "shop", itemIds: [DEFAULT_ITEM_ID], allowSell: true }),
    c({ kind: "text", body: "hi", emotion: "happy" }),
  ],
  "conditions, else-if, loops": [
    c({
      kind: "fork",
      condition: { kind: "all", conditions: [{ kind: "switch", switchId: "sw_a", value: false }, { kind: "not", condition: { kind: "variable", variableId: "v", op: ">=", value: 3 } }] },
      then: [c({ kind: "setSelfSwitch", key: "A", value: true })],
      else: [c({
        kind: "fork",
        condition: { kind: "any", conditions: [{ kind: "item", itemId: DEFAULT_ITEM_ID, present: false }, { kind: "actor", actorId: "hero", present: true }, { kind: "timePhase", phase: "night" }] },
        then: [c({ kind: "text", body: "else-if" })],
        else: [c({ kind: "text", body: "else" })],
      })],
    }),
    c({ kind: "fork", condition: { kind: "selfSwitch", key: "B", value: true }, then: [c({ kind: "text", body: "B on" })] }),
    c({ kind: "fork", condition: { kind: "not", condition: { kind: "switch", switchId: "sw_b", value: true } }, then: [] }),
    c({ kind: "fork", condition: { kind: "variable", variableId: "v", op: "!=", value: -2 }, then: [c({ kind: "text", body: "not -2" })] }),
    c({
      kind: "loop",
      body: [
        c({ kind: "setVariable", variableId: "v", op: "+=", value: 1 }),
        c({ kind: "fork", condition: { kind: "variable", variableId: "v", op: ">", value: 5 }, then: [c({ kind: "breakLoop" })] }),
      ],
    }),
  ],
  "state writes, transfer, battle, common event": [
    c({ kind: "setSwitch", switchId: "sw_a", value: "toggle" }),
    c({ kind: "setSwitch", switchId: "sw_b", value: false }),
    c({ kind: "setVariable", variableId: "v", op: "=", value: 7 }),
    c({ kind: "setVariable", variableId: "v", op: "=", value: { kind: "var", id: "w" } }),
    c({ kind: "setVariable", variableId: "v", op: "-=", value: 2 }),
    c({ kind: "setVariable", variableId: "v", op: "-=", value: { kind: "var", id: "w" } }),
    c({ kind: "setVariable", variableId: "v", op: "*=", value: 3 }),
    c({ kind: "setVariable", variableId: "v", op: "*=", value: { kind: "var", id: "w" } }),
    c({ kind: "changeGold", op: "+=", amount: 25 }),
    c({ kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 2 }),
    c({ kind: "callCommonEvent", commonEventId: "ce_x" }),
    c({ kind: "battleProcessing", troopId: "t1", canEscape: false, canLose: false }),
    c({ kind: "battleProcessing", troopId: "t1", canEscape: true, canLose: true, branchOnResult: true, victoryBranch: [c({ kind: "text", body: "won" })], escapeBranch: [c({ kind: "text", body: "ran" })] }),
    c({ kind: "transfer", mapId: "m2", x: 3, y: 4, direction: "up", fade: "white" }),
  ],
};

describe("scriptToCommands round trip", () => {
  for (const [label, commands] of Object.entries(ROUND_TRIP)) {
    it(label, () => {
      const printed = commandsToScript(commands);
      expect(printed.translated).toBeGreaterThan(0);
      expect(converted(printed.source)).toEqual(commands);
    });
  }

  it("flattens an inlined script block into its commands", () => {
    const script = c({ kind: "script", source: 'game.setSwitch("sw_in", true);\nawait game.showMessage("inside");\n', compiled: "x" });
    const printed = commandsToScript([c({ kind: "text", body: "before" }), script]);
    expect(converted(printed.source)).toEqual([
      c({ kind: "text", body: "before" }),
      c({ kind: "setSwitch", switchId: "sw_in", value: true }),
      c({ kind: "text", body: "inside" }),
    ]);
  });

  it("folds const literals, reads either-side literals and turns addVar(x, -n) into -=", () => {
    const source = [
      "// header comment",
      "const PRICE = 50;",
      "const NAME = `Potion`;",
      "if (PRICE <= game.gold() && 3 > game.getVar(\"v\")) {",
      "  game.addGold(-PRICE);",
      "  game.addVar(\"v\", -4);",
      "  await game.showMessage(NAME);",
      "}",
    ].join("\n");
    expect(converted(source)).toEqual([
      c({
        kind: "fork",
        condition: { kind: "all", conditions: [{ kind: "gold", op: ">=", amount: 50 }, { kind: "variable", variableId: "v", op: "<", value: 3 }] },
        then: [c({ kind: "changeGold", op: "-=", amount: 50 }), c({ kind: "setVariable", variableId: "v", op: "-=", value: 4 }), c({ kind: "text", body: "Potion" })],
      }),
    ]);
  });

  it("uses the runtime's own plans for other literal game calls", () => {
    const commands = converted([
      "game.addToParty(\"hero\");",
      "game.learnSkill(\"hero\", \"fire\");",
      "await game.playSe(\"se_bell\", { volume: 80 });",
      "await game.moveEvent(\"this\", [\"up\", \"face-left\"]);",
      "await game.setTile(2, 3, 7, { mapId: \"m1\" });",
      "await game.shake(5, 30);",
    ].join("\n"));
    expect(commands.slice(0, 3)).toEqual([
      c({ kind: "changeParty", actorId: "hero", action: "add" }),
      c({ kind: "learnSkill", actorId: "hero", skillId: "fire" }),
      c({ kind: "playAudio", resourceId: "se_bell", loop: false, channel: "se", volume: 80 }),
    ]);
    expect(commands[3]).toEqual(c({ kind: "moveEvent", eventId: "", route: { moves: [{ kind: "move", dir: "up" }, { kind: "turn", dir: "left" }], repeat: false, wait: true } }));
    expect(commands[4]).toEqual(c({ kind: "changeTile", mapId: "m1", layer: "lower", x: 2, y: 3, tile: 7 }));
    expect(commands[5]).toMatchObject({ kind: "m2Command", commandId: "m2-048-shake-screen" });
  });

  it("resolves switch and variable names to ids when the project is given", () => {
    const project = createBlankProject();
    project.switches.push({ id: "sw_gate", name: "Gate open" });
    const commands = converted(`if (game.getSwitch("Gate open")) game.setSwitch("Gate open", false);`, project);
    expect(commands).toEqual([c({ kind: "fork", condition: { kind: "switch", switchId: "sw_gate", value: true }, then: [c({ kind: "setSwitch", switchId: "sw_gate", value: false })] })]);
  });
});

// ── (b) behavior: script vs converted commands, headless ────────────────────

function panelContext(commands: Command[]): { ctx: ToolContext; mapId: string } {
  const project: Project = createBlankProject();
  // Commands must name defined switches/variables (the commit gate checks references; scripts are type-checked instead).
  for (const id of ["sw_door", "sw_bonus"]) project.switches.push({ id, name: id });
  for (const id of ["var_visits", "v"]) project.variables.push({ id, name: id });
  const mapId = project.startMapId;
  const ctx: ToolContext = { project };
  const made = runTool(ctx, "upsert_event", {
    mapId,
    event: { id: "ev_panel", x: 3, y: 3, name: "panel", trigger: { kind: "action" }, pages: [{ id: "p0", name: "", conditions: [], commands }] },
  });
  if (!made.ok) throw new Error(made.summary);
  return { ctx, mapId };
}

function pageCommands(ctx: ToolContext, mapId: string): Command[] {
  return ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_panel")!.pages![0]!.commands;
}

const SWITCH_NPC = `if (game.getSwitch("sw_door")) {
  await game.showMessage("The door is already open.", { speaker: "Keeper" });
} else {
  await game.showMessage("Let me open it for you.", { speaker: "Keeper" });
  game.setSwitch("sw_door", true);
  game.setSelfSwitch("A", true);
}`;

const SHOP = `const POTION = 50;
const ETHER = 120;
const pick = await game.showChoices(["Potion (50G)", "Ether (120G)", "Nothing"], { prompt: "What'll it be?", cancel: "cancel" });
if (pick === 0) {
  if (game.gold() >= POTION) {
    game.addGold(-POTION);
    game.addItem("${DEFAULT_ITEM_ID}", 1);
    await game.showMessage("Thanks!");
  } else {
    await game.showMessage("Not enough gold.");
  }
} else if (pick === 1) {
  if (game.gold() >= ETHER) {
    game.addGold(-ETHER);
    game.addItem("${DEFAULT_ITEM_ID}", 3);
    await game.showMessage("A fine choice.");
  } else {
    await game.showMessage("Not enough gold.");
  }
} else if (pick === -1) {
  await game.showMessage("Come again.");
}
game.addVar("var_visits", 1);`;

const COUNTER = `while (true) {
  game.addVar("v", 2);
  if (game.getVar("v") >= 7) {
    break;
  }
  await game.wait(6);
}
game.setVar("v", game.getVar("v") * 3);
if (!game.hasItem("${DEFAULT_ITEM_ID}") || game.getSwitch("sw_bonus")) game.addItem("${DEFAULT_ITEM_ID}");`;

interface Scenario {
  readonly choices?: number[];
  readonly gold?: number;
  readonly switches?: { id: string; value: boolean }[];
  readonly items?: { id: string; count: number }[];
}

const BEHAVIOR: { label: string; source: string; scenarios: Scenario[] }[] = [
  { label: "switch-flip NPC", source: SWITCH_NPC, scenarios: [{}, { switches: [{ id: "sw_door", value: true }] }] },
  { label: "choice shop with fixed prices", source: SHOP, scenarios: [{ choices: [0], gold: 80 }, { choices: [0], gold: 10 }, { choices: [1], gold: 500 }, { choices: [2], gold: 500 }, { choices: [-1] }] },
  { label: "counter loop, multiply, item condition", source: COUNTER, scenarios: [{}, { items: [{ id: DEFAULT_ITEM_ID, count: 2 }] }, { items: [{ id: DEFAULT_ITEM_ID, count: 2 }], switches: [{ id: "sw_bonus", value: true }] }] },
];

describe("converted commands behave like the script (dry run)", () => {
  for (const { label, source, scenarios } of BEHAVIOR) {
    it(label, async () => {
      const scripted = panelContext([]);
      const authored = await runToolAsync(scripted.ctx, "author_script", { mapId: scripted.mapId, eventId: "ev_panel", source, name: label });
      expect(authored.ok, authored.summary).toBe(true);

      const unwrapped = panelContext([]);
      await runToolAsync(unwrapped.ctx, "author_script", { mapId: unwrapped.mapId, eventId: "ev_panel", source, name: label });
      const written = await runToolAsync(unwrapped.ctx, "write_script_as_commands", { mapId: unwrapped.mapId, eventId: "ev_panel", name: label, confirm: true });
      expect(written.ok, written.summary).toBe(true);
      expect(pageCommands(unwrapped.ctx, unwrapped.mapId).some((command) => command.kind === "script")).toBe(false);

      for (const scenario of scenarios) {
        const run = async (ctx: ToolContext, mapId: string) => {
          const result = await runToolAsync(ctx, "dry_run_script", { mapId, eventId: "ev_panel", ...scenario });
          expect(result.ok, result.summary).toBe(true);
          const data = result.data as { transcript: string[]; changes: unknown; errors: string[]; endedBy: string };
          return { transcript: data.transcript, changes: data.changes, errors: data.errors, endedBy: data.endedBy };
        };
        const before = await run(scripted.ctx, scripted.mapId);
        const after = await run(unwrapped.ctx, unwrapped.mapId);
        expect(before.errors, JSON.stringify(scenario)).toEqual([]);
        expect(before.transcript.length, JSON.stringify(scenario)).toBeGreaterThan(0);
        expect(after, JSON.stringify(scenario)).toEqual(before);
      }
    }, 60_000);
  }
});

// ── (c) refusals ─────────────────────────────────────────────────────────────

const LEVERS = `const ORDER = [2, 0, 3, 1];
const LEVERS = ["Lever 1", "Lever 2", "Lever 3", "Lever 4"];
if (game.getSwitch("sw_vault_open")) {
  await game.showMessage("The levers are locked in place.");
} else {
  const pulled: number[] = [];
  while (pulled.length < ORDER.length) {
    const pick = await game.showChoices([...LEVERS, "Step away"], { prompt: \`Pulled \${pulled.length}/4\`, cancel: 4 });
    if (pick === 4) break;
    pulled.push(pick);
  }
}`;

describe("scriptToCommands refusals", () => {
  it("refuses the lever puzzle (ORDER array, array loop) with lines", () => {
    const problems = codesOf(LEVERS);
    expect(problems).toEqual(expect.arrayContaining([
      { line: 1, code: "array" },
      { line: 2, code: "array" },
      { line: 6, code: "array" },
      { line: 7, code: "loop-form" },
    ]));
  });

  it("names each non-convertible construct", () => {
    const source = [
      "import { price } from \"@lib/shop\";", // 1
      "let count = 0;", // 2
      "function helper() {}", // 3
      "await game.showMessage(`You have ${game.gold()} gold`);", // 4
      "game.setVar(\"v\", game.getVar(\"v\") + 1);", // 5
      "if (game.random(2) === 0) game.setSwitch(\"a\", true);", // 6
      "for (let i = 0; i < 3; i += 1) {}", // 7
      "game.setSelfSwitch(\"A\", true, \"ev_other\");", // 8
      "const id = \"sw_\" + \"x\";", // 9
      "game.setSwitch(game.getText(\"t\"), true);", // 10
      "game.showMessage(\"no await\");", // 11
      "const gold = game.gold();", // 12
      "const pick = await game.showChoices([\"a\", \"b\"]);", // 13
      "game.setVar(\"v\", pick);", // 14
      "switch (1) { default: break; }", // 15
      "return;", // 16
      "await game.cmd({ kind: \"script\", source: \"\" });", // 17
      "await game.showEmote(\"this\", \"heart\");", // 18
      "await game.setTile(1, 1, 3);", // 19
      "game.removeItem(\"potion\");", // 20
      "const half = Math.floor(3 / 2);", // 21
      "game.addItem(\"potion\", -1);", // 22
    ].join("\n");
    expect(codesOf(source)).toEqual([
      { line: 1, code: "import" },
      { line: 2, code: "local-variable" },
      { line: 3, code: "function" },
      { line: 4, code: "template-substitution" },
      { line: 5, code: "formula" },
      { line: 6, code: "random" },
      { line: 7, code: "loop-form" },
      { line: 8, code: "other-event-self-switch" },
      { line: 9, code: "formula" },
      { line: 10, code: "state-read" },
      { line: 11, code: "missing-await" },
      { line: 12, code: "state-read" },
      { line: 14, code: "choice-use" },
      { line: 15, code: "control-flow" },
      { line: 16, code: "return" },
      { line: 17, code: "invalid-command" },
      { line: 18, code: "this-target" },
      { line: 19, code: "implicit-map" },
      { line: 20, code: "unsupported-call" },
      { line: 21, code: "unsupported-call" },
      { line: 22, code: "invalid-argument" },
    ]);
  });

  it("refuses syntax errors and the day phase without a time system", () => {
    expect(codesOf("if (game.getSwitch(\"a\") {\n}")[0]?.code).toBe("syntax");
    expect(codesOf("if (game.time().phase === \"day\") game.setSwitch(\"a\", true);")).toEqual([{ line: 1, code: "condition" }]);
    expect(codesOf("if (game.hasItem(\"potion\", 3)) game.setSwitch(\"a\", true);")).toEqual([{ line: 1, code: "condition" }]);
  });

  it("has a Korean and English reason for every code", () => {
    for (const code of SCRIPT_UNWRAP_PROBLEM_CODES) {
      expect(scriptUnwrapProblemText({ line: 1, code, snippet: "" }, "ko")).toMatch(/\S/u);
      expect(scriptUnwrapProblemText({ line: 1, code, snippet: "" }, "en")).toMatch(/^[\x20-\x7e…]+$/u);
    }
  });

  it("write_script_as_commands refuses without confirm and on non-convertible scripts, changing nothing", async () => {
    const { ctx, mapId } = panelContext([]);
    await runToolAsync(ctx, "author_script", { mapId, eventId: "ev_panel", source: LEVERS, name: "levers" });
    const before = JSON.stringify(ctx.project);
    const unconfirmed = await runToolAsync(ctx, "write_script_as_commands", { mapId, eventId: "ev_panel", name: "levers", confirm: false });
    expect(unconfirmed.ok).toBe(false);
    const refused = await runToolAsync(ctx, "write_script_as_commands", { mapId, eventId: "ev_panel", name: "levers", confirm: true });
    expect(refused.ok).toBe(false);
    expect(refused.summary).toMatch(/L1: Uses an array/u);
    expect(JSON.stringify(ctx.project)).toBe(before);
  }, 30_000);
});
