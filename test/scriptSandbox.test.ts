// test/scriptSandbox.test.ts — runtime contract of the script sandbox (src/player/script/*).
// Hand-written JS (no compiler) so this file only exercises the QuickJS runtime and the interpreter bridge.
import { beforeAll, describe, expect, it } from "vitest";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { preloadScriptEngine, projectUsesScripts } from "@/player/script/engine";
import { readScriptLog } from "@/player/script/scriptLog";
import { SCRIPT_API } from "@/project/script/apiSpec";
import { HOST_API } from "@/player/script/hostApi";
import { createBlankProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { createRngState } from "@/util/rng";

beforeAll(async () => {
  await preloadScriptEngine();
});

function session(project: Project): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorExperience: {},
    actorLevels: {},
    actorEquipment: {},
    actorVitals: {},
    currentMapId: project.startMapId,
    x: 2,
    y: 3,
    audio: {},
    pictures: {},
  };
}

function run(compiled: string, options: { project?: Project; answers?: unknown[]; tail?: Command[]; seed?: (s: PlaySessionLike) => void } = {}) {
  const project = options.project ?? createBlankProject();
  const live = session(project);
  options.seed?.(live);
  const commands: Command[] = [{ kind: "script", source: "", compiled }, ...(options.tail ?? [{ kind: "setFlag", flag: "end", value: true }])];
  const interpreter = createInterpreter(commands, live, project);
  const answers = [...(options.answers ?? [])];
  const steps: StepResult[] = [];
  let step = interpreter.start();
  for (let guard = 0; step.kind !== "done" && guard < 500; guard++) {
    steps.push(step);
    step = interpreter.resume(answers.shift() as never);
  }
  const errors = steps.filter((entry) => entry.kind === "text" && entry.body.startsWith("[Script error")).map((entry) => (entry as { body: string }).body);
  return { session: live, steps, errors };
}

describe("script sandbox API table", () => {
  it("implements every SCRIPT_API row exactly once", () => {
    expect(Object.keys(HOST_API).sort()).toEqual(SCRIPT_API.map((entry) => entry.name).sort());
  });
});

describe("script sandbox isolation", () => {
  it("exposes no DOM, network, storage, timers or Node", () => {
    const { session: live, errors } = run(
      `game.setText("globals", [typeof window, typeof document, typeof fetch, typeof XMLHttpRequest, typeof localStorage, typeof setTimeout, typeof process, typeof require, typeof __host, typeof WebAssembly].join(","));`
    );
    expect(errors).toEqual([]);
    // `require` is the wrapper parameter for @lib imports; everything else is absent.
    expect(live.stringVariables?.globals).toBe("undefined,undefined,undefined,undefined,undefined,undefined,undefined,function,undefined,undefined");
  });

  it("game is frozen and cannot be replaced", () => {
    const { errors } = run(`"use strict"; game.setSwitch = () => {};`);
    expect(errors[0]).toMatch(/read-only|not writable|TypeError/u);
  });

  it("stops an infinite loop and continues the event", () => {
    const started = performance.now();
    const { session: live, errors } = run(`for (;;) {}`);
    expect(errors[0]).toContain("infinite loop");
    expect(live.flags.end).toBe(true);
    expect(performance.now() - started).toBeLessThan(5000);
  });

  it("stops runaway memory use", () => {
    const { session: live, errors } = run(`const parts = []; for (;;) parts.push({ x: parts.length, y: "s" + parts.length });`);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/memory|stopped/u);
    expect(live.flags.end).toBe(true);
  });

  it("reports an awaited promise that can never settle", () => {
    const { errors } = run(`await new Promise(() => {});`);
    expect(errors[0]).toContain("never finishes");
  });

  it("validates arguments with the API name in the message", () => {
    const { errors } = run(`game.setVar(42, 1);`);
    expect(errors[0]).toContain("game.setVar: id must be a non-empty string");
  });
});

describe("script determinism", () => {
  it("Math.random and game.random follow the saved game RNG", () => {
    const seeded = { seed: (s: PlaySessionLike) => { s.rng = createRngState(12345); } };
    const first = run(`game.setText("r", [Math.random(), game.random(100)].join("|"));`, seeded).session.stringVariables?.r;
    const second = run(`game.setText("r", [Math.random(), game.random(100)].join("|"));`, seeded).session.stringVariables?.r;
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });

  it("Date is the play clock, not the wall clock", () => {
    const { session: live } = run(`game.setVar("year", new Date().getUTCFullYear()); game.setVar("now", Date.now() - Date.UTC(2000, 0, 1));`, {
      seed: (s) => { s.playTimeSeconds = 90; },
    });
    expect(live.variables.year).toBe(2000);
    expect(live.variables.now).toBe(90_000);
  });
});

describe("script awaitables", () => {
  it("cancelled choices resolve -1 when settings.cancel is 'cancel'", () => {
    const { session: live, steps } = run(`game.setVar("pick", await game.showChoices(["a", "b"], { cancel: "cancel" }));`, { answers: [-1] });
    expect(steps[0]).toMatchObject({ kind: "choices", cancelBehavior: "branch" });
    expect(live.variables.pick).toBe(-1);
  });

  it("inputNumber returns the number and leaves no reserved variable", () => {
    const { session: live } = run(`game.setVar("code", await game.inputNumber({ digits: 4 }));`, { answers: [1234] });
    expect(live.variables.code).toBe(1234);
    expect(live.variables.__script_result).toBeUndefined();
  });

  it("battle resolves with the session battle result", () => {
    const { session: live, steps } = run(`game.setText("result", await game.battle("troop_x", { canLose: true }));`, {
      answers: ["escape"],
      seed: (s) => { s.battleResult = "escape"; },
    });
    expect(steps[0]).toMatchObject({ kind: "battleProcessing", troopId: "troop_x", canLose: true });
    expect(live.stringVariables?.result).toBe("escape");
  });

  it("transfer ends the event like the Transfer command", () => {
    const project = createBlankProject();
    const { session: live, steps } = run(`await game.transfer("${project.startMapId}", 1, 1); game.setSwitch("after", true);`, { project });
    expect(steps.map((step) => step.kind)).toEqual(["transfer"]);
    expect(live.switches.after).toBeUndefined();
    expect(live.flags.end).toBeUndefined();
  });

  it("un-awaited calls still run in call order", () => {
    const { steps } = run(`game.showMessage("one"); game.showMessage("two");`);
    expect(steps.map((step) => (step as { body?: string }).body)).toEqual(["one", "two"]);
  });

  it("game.cmd runs any event command and rejects invalid ones", () => {
    const ok = run(`await game.cmd({ kind: "changeGold", op: "+=", amount: 7 });`);
    expect(ok.session.gold).toBe(7);
    const bad = run(`await game.cmd({ kind: "nope" });`);
    expect(bad.errors[0]).toContain("game.cmd");
  });

  it("callCommonEvent runs the common event before the script continues", () => {
    const project = createBlankProject();
    project.commonEvents.push({ id: "ce_bonus", name: "bonus", trigger: "none", commands: [{ kind: "changeGold", op: "+=", amount: 5 }] } as never);
    const { session: live } = run(`await game.callCommonEvent("ce_bonus"); game.setVar("gold", game.gold());`, { project });
    expect(live.variables.gold).toBe(5);
  });
});

describe("script library modules", () => {
  it("require('@lib/<id>') loads the compiled library", () => {
    const project = createBlankProject();
    project.scriptLibrary = [{ id: "shop", source: "export const price = …", compiled: `"use strict"; exports.price = (base, rep) => Math.round(base * (1 - rep / 100));` }];
    const { session: live, errors } = run(`const shop = require("@lib/shop"); game.setVar("price", shop.price(200, 25));`, { project });
    expect(errors).toEqual([]);
    expect(live.variables.price).toBe(150);
  });

  it("unknown or non-library imports fail visibly", () => {
    expect(run(`require("@lib/missing");`).errors[0]).toContain("does not exist");
    expect(run(`require("fs");`).errors[0]).toContain("Only project library modules");
  });
});

describe("script logging and detection", () => {
  it("game.log and console.log reach the script log", () => {
    run(`game.log("hello", { a: 1 }); console.log("world");`);
    const messages = readScriptLog().map((entry) => entry.message);
    expect(messages).toContain('hello {"a":1}');
    expect(messages).toContain("world");
  });

  it("projectUsesScripts finds scripts in pages, branches and common events", () => {
    const project = createBlankProject();
    expect(projectUsesScripts(project)).toBe(false);
    project.commonEvents.push({ id: "ce", name: "ce", trigger: "none", commands: [{ kind: "choices", options: [{ text: "a", branch: [{ kind: "script", source: "", compiled: "1" }] }] }] } as never);
    expect(projectUsesScripts(project)).toBe(true);
  });
});
