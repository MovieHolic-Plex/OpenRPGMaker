// test/scriptTools.test.ts — assistant tools for TypeScript event scripts (src/editor/tools/scriptTools.ts).
// Real compiler (typescript5) and real QuickJS: the tools' prepare loads both, beforeAll warms them once.
import { beforeAll, describe, expect, it } from "vitest";
import { prepareScriptCompiler } from "@/editor/script/compile";
import { commandsToScript } from "@/editor/script/eventToScript";
import { runTool } from "@/editor/tools";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { preloadScriptEngine } from "@/player/script/engine";
import { createBlankProject, DEFAULT_ITEM_ID } from "@/project/defaults";
import type { Command, Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

beforeAll(async () => {
  await Promise.all([prepareScriptCompiler(), preloadScriptEngine()]);
}, 60_000);

const LEVERS = `const ORDER = [2, 0, 3, 1];
const LEVERS = ["Lever 1", "Lever 2", "Lever 3", "Lever 4"];
if (game.getSwitch("sw_vault_open")) {
  await game.showMessage("The levers are locked in place.");
} else {
  const pulled: number[] = [];
  while (pulled.length < ORDER.length) {
    const pick = await game.showChoices([...LEVERS, "Step away"], { prompt: \`Pulled \${pulled.length}/4\`, cancel: 4 });
    if (pick === 4) break;
    if (pulled.includes(pick)) { await game.showMessage("That lever is already down."); continue; }
    pulled.push(pick);
    if (pick !== ORDER[pulled.length - 1]) {
      await game.showMessage("Clunk. Every lever snaps back up.");
      game.addVar("var_lever_fails", 1);
      break;
    }
  }
  if (pulled.length === ORDER.length && pulled.every((lever, i) => lever === ORDER[i])) {
    game.setSwitch("sw_vault_open", true);
    await game.showMessage("A deep rumble. The vault door slides open.");
  }
}`;

function contextWithPanel(commands: Command[] = []): { ctx: ToolContext; mapId: string } {
  const project: Project = createBlankProject();
  const mapId = project.startMapId;
  const ctx: ToolContext = { project };
  // Built through upsert_event so the page has every field the runner's post-checks expect.
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

describe("check_script", () => {
  it("returns English diagnostics with line numbers and changes nothing", async () => {
    const { ctx } = contextWithPanel();
    const before = JSON.stringify(ctx.project);
    const result = await runToolAsync(ctx, "check_script", { source: `game.setVar("v", 1);\nconst n: number = "text";` });
    expect(result.ok).toBe(true);
    const data = result.data as { ok: boolean; diagnostics: string };
    expect(data.ok).toBe(false);
    expect(data.diagnostics).toMatch(/L2:\d+ error: Type 'string' is not assignable to type 'number'/u);
    expect(JSON.stringify(ctx.project)).toBe(before);
  }, 30_000);
});

describe("author_script", () => {
  it("inserts a compiled script command at the requested index", async () => {
    const { ctx, mapId } = contextWithPanel([{ kind: "text", body: "hello" }]);
    const result = await runToolAsync(ctx, "author_script", { mapId, eventId: "ev_panel", source: LEVERS, name: "levers", index: 0 });
    expect(result.ok, result.summary).toBe(true);
    const commands = pageCommands(ctx, mapId);
    expect(commands.map((command) => command.kind)).toEqual(["script", "text"]);
    const script = commands[0] as Extract<Command, { kind: "script" }>;
    expect(script.name).toBe("levers");
    expect(script.compiled.length).toBeGreaterThan(0);
    expect(script.effects?.writes).toEqual(expect.arrayContaining([{ kind: "switch", id: "sw_vault_open" }]));
  }, 30_000);

  it("rejects a script with a type error and leaves the page alone", async () => {
    const { ctx, mapId } = contextWithPanel([{ kind: "text", body: "hello" }]);
    const result = await runToolAsync(ctx, "author_script", { mapId, eventId: "ev_panel", source: `const n: number = "no";` });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.message).toContain("did not compile");
    expect(result.issues?.[0]?.message).toMatch(/L1:\d+ error/u);
    expect(pageCommands(ctx, mapId).map((command) => command.kind)).toEqual(["text"]);
  }, 30_000);
});

describe("dry_run_script", () => {
  it("reports the transcript and the state changes of the right and the wrong lever order", async () => {
    const { ctx, mapId } = contextWithPanel();
    expect((await runToolAsync(ctx, "author_script", { mapId, eventId: "ev_panel", source: LEVERS, name: "levers" })).ok).toBe(true);
    const before = JSON.stringify(ctx.project);

    const right = await runToolAsync(ctx, "dry_run_script", { mapId, eventId: "ev_panel", name: "levers", choices: [2, 0, 3, 1] });
    expect(right.ok, right.summary).toBe(true);
    const rightData = right.data as { ok: boolean; transcript: string[]; changes: Record<string, Record<string, { from: unknown; to: unknown }>>; errors: string[] };
    expect(rightData.errors).toEqual([]);
    expect(rightData.transcript.filter((line) => line.startsWith("choices"))).toHaveLength(4);
    expect(rightData.transcript.at(-1)).toContain("vault door slides open");
    expect(rightData.changes.switches?.sw_vault_open).toEqual({ from: false, to: true });

    const wrong = await runToolAsync(ctx, "dry_run_script", { mapId, eventId: "ev_panel", name: "levers", choices: [2, 1] });
    const wrongData = wrong.data as typeof rightData;
    expect(wrongData.transcript.at(-1)).toContain("snaps back up");
    expect(wrongData.changes.switches).toBeUndefined();
    expect(wrongData.changes.variables?.var_lever_fails).toEqual({ from: 0, to: 1 });

    // Dry runs never touch the project.
    expect(JSON.stringify(ctx.project)).toBe(before);
  }, 30_000);

  it("runs unsaved source with presets, a library module and log lines", async () => {
    const { ctx, mapId } = contextWithPanel();
    const module = await runToolAsync(ctx, "upsert_script_module", {
      id: "pricing",
      source: "export function discounted(base: number, reputation: number): number {\n  return Math.max(1, Math.round(base * (1 - Math.min(30, Math.max(0, reputation)) / 100)));\n}\n",
    });
    expect(module.ok, module.summary).toBe(true);
    const source = `import { discounted } from "@lib/pricing";
const price = discounted(120, game.getVar("var_reputation"));
if (await game.showChoices(["Buy", "No"]) === 0 && game.gold() >= price) {
  game.addGold(-price);
  game.addItem("${DEFAULT_ITEM_ID}");
}
game.log("price", price);`;
    const result = await runToolAsync(ctx, "dry_run_script", { mapId, source, choices: [0], variables: [{ id: "var_reputation", value: 25 }], gold: 100 });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { changes: Record<string, unknown>; log: string[] };
    expect(data.changes.gold).toEqual({ from: 100, to: 10 });
    expect(data.changes.items).toEqual({ [DEFAULT_ITEM_ID]: { from: 0, to: 1 } });
    expect(data.log).toContain("price 90");
  }, 30_000);

  it("collects runtime errors", async () => {
    const { ctx, mapId } = contextWithPanel();
    const result = await runToolAsync(ctx, "dry_run_script", { mapId, source: `game.setVar("v", Number.NaN);` });
    const data = result.data as { ok: boolean; errors: string[] };
    expect(data.ok).toBe(false);
    expect(data.errors.join("\n")).toContain("game.setVar");
  }, 30_000);
});

describe("generic event tools", () => {
  it("refuse a hand-written script command without compiled code", async () => {
    const { ctx, mapId } = contextWithPanel();
    const result = await runToolAsync(ctx, "upsert_event", {
      mapId,
      event: { id: "ev_hand", x: 5, y: 3, trigger: { kind: "action" }, pages: [{ id: "p0", conditions: [], commands: [{ kind: "script", source: "game.setSwitch('a', true);", compiled: "" }] }] },
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("author_script");
  });

  it("refuse compiled code that does not belong to the source, also inside branches", async () => {
    const { ctx, mapId } = contextWithPanel();
    const forged = { kind: "script", source: "game.setSwitch('a', true);", compiled: "game.setSwitch('b', true);", sourceHash: "0000" };
    const result = await runToolAsync(ctx, "upsert_event", {
      mapId,
      event: { id: "ev_hand", x: 5, y: 3, trigger: { kind: "action" }, pages: [{ id: "p0", conditions: [], commands: [{ kind: "choices", options: [{ text: "a", branch: [forged] }] }] }] },
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("options[0].branch[0]");
  });

  it("keep accepting a page that carries a script written by author_script", async () => {
    const { ctx, mapId } = contextWithPanel();
    expect((await runToolAsync(ctx, "author_script", { mapId, eventId: "ev_panel", source: LEVERS, name: "levers" })).ok).toBe(true);
    const result = await runToolAsync(ctx, "patch_event_page", { mapId, eventId: "ev_panel", set: { name: "renamed" } });
    expect(result.ok, result.summary).toBe(true);
    expect(pageCommands(ctx, mapId)[0]?.kind).toBe("script");
  }, 30_000);
});

describe("read_event_as_script / write_event_as_script", () => {
  const page: Command[] = [
    { kind: "text", speaker: "Guard", body: "Halt!" },
    {
      kind: "choices",
      options: [
        { text: "Pay 10", branch: [{ kind: "fork", condition: { kind: "gold", op: ">=", amount: 10 }, then: [{ kind: "changeGold", op: "-=", amount: 10 }, { kind: "setSwitch", switchId: "sw_paid", value: true }], else: [{ kind: "text", body: "Broke." }] }] },
        { text: "Leave", branch: [] },
      ],
    } as Command,
    { kind: "wait", ms: 500 },
    { kind: "setVariable", variableId: "var_talks", op: "+=", value: 1 },
    { kind: "recoverAll" } as Command,
  ];

  it("prints a page as TypeScript that compiles", async () => {
    const { ctx, mapId } = contextWithPanel(structuredClone(page));
    const read = await runToolAsync(ctx, "read_event_as_script", { mapId, eventId: "ev_panel" });
    expect(read.ok, read.summary).toBe(true);
    const source = (read.data as { source: string }).source;
    expect(source).toContain(`await game.showMessage("Halt!", { speaker: "Guard" });`);
    expect(source).toContain(`await game.showChoices(["Pay 10", "Leave"])`);
    expect(source).toContain("if (game.gold() >= 10) {");
    expect(source).toContain("await game.wait(30);");
    expect(source).toContain(`await game.cmd({"kind":"recoverAll"});`);
    const check = await runToolAsync(ctx, "check_script", { source, mapId });
    expect((check.data as { ok: boolean; diagnostics: string }).ok, (check.data as { diagnostics: string }).diagnostics).toBe(true);
  }, 30_000);

  it("keeps commands without an API equivalent as exact game.cmd JSON", () => {
    const shop = { kind: "shop", itemIds: [DEFAULT_ITEM_ID], allowSell: true } as unknown as Command;
    const converted = commandsToScript([shop, { kind: "text", body: "hi", emotion: "happy" }]);
    expect(converted.passthrough).toBe(2);
    expect(converted.source).toContain(`await game.cmd(${JSON.stringify(shop)});`);
  });

  it("replaces the page with one script only with confirm:true, and the rewrite behaves like the page", async () => {
    const { ctx, mapId } = contextWithPanel(structuredClone(page));
    const source = (await runToolAsync(ctx, "read_event_as_script", { mapId, eventId: "ev_panel" })).data as { source: string };
    const refused = await runToolAsync(ctx, "write_event_as_script", { mapId, eventId: "ev_panel", source: source.source, confirm: false });
    expect(refused.ok).toBe(false);
    expect(pageCommands(ctx, mapId)).toHaveLength(page.length);

    const written = await runToolAsync(ctx, "write_event_as_script", { mapId, eventId: "ev_panel", source: source.source, confirm: true });
    expect(written.ok, written.summary).toBe(true);
    expect(pageCommands(ctx, mapId).map((command) => command.kind)).toEqual(["script"]);

    const run = await runToolAsync(ctx, "dry_run_script", { mapId, eventId: "ev_panel", choices: [0], gold: 50 });
    const data = run.data as { transcript: string[]; changes: Record<string, unknown> };
    expect(data.transcript[0]).toBe("message (Guard): Halt!");
    expect(data.changes.gold).toEqual({ from: 50, to: 40 });
    expect(data.changes.switches).toEqual({ sw_paid: { from: false, to: true } });
  }, 30_000);
});

describe("get_script_api / list_script_modules", () => {
  it("returns the project's typed .d.ts", async () => {
    const { ctx, mapId } = contextWithPanel();
    const result = await runToolAsync(ctx, "get_script_api", { mapId });
    const dts = (result.data as { dts: string }).dts;
    expect(dts).toContain("declare const game: Game;");
    expect(dts).toContain(`"ev_panel"`);
    expect(dts).toContain(JSON.stringify(DEFAULT_ITEM_ID));
  });

  it("lists library modules with their exports", async () => {
    const { ctx } = contextWithPanel();
    await runToolAsync(ctx, "upsert_script_module", { id: "dice", source: "export const roll = (sides: number): number => 1 + game.random(sides);\n" });
    const result = await runToolAsync(ctx, "list_script_modules", {});
    expect(result.data).toEqual([expect.objectContaining({ id: "dice", import: "@lib/dice", exports: ["roll"], fresh: true })]);
  }, 30_000);
});
