// test/scriptCompile.test.ts — TS compile, type check, static effects and the generated game .d.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { compileScript, prepareScriptCompiler, scriptCommandFields } from "@/editor/script/compile";
import { SCRIPT_TS_LIB_ENTRY, SCRIPT_TS_LIB_SOURCES, SCRIPT_TS_VERSION } from "@/editor/script/tsLibSources.generated";
import { createInterpreter } from "@/player/interpreter";
import { preloadScriptEngine } from "@/player/script/engine";
import { SCRIPT_API } from "@/project/script/apiSpec";
import { buildGameApiDts, scriptDtsIds } from "@/project/script/dts";
import { normalizeScriptLibrary } from "@/project/script/library";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

beforeAll(async () => {
  await Promise.all([prepareScriptCompiler(), preloadScriptEngine()]);
}, 60_000);

function project(): Project {
  const value = createBlankProject();
  value.switches.push({ id: "sw_door", name: "Door open" }, { id: "lever_1", name: "Lever 1" });
  value.variables.push({ id: "rep", name: "Reputation" });
  return value;
}

describe("compileScript", () => {
  it("compiles a clean script, keeps top-level await and extracts effects", () => {
    const result = compileScript(`if (game.getSwitch("lever_1")) {\n  game.setSwitch("sw_door", true);\n  await game.showMessage("Click!");\n}\n`, { project: project() });
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.compiled).toContain("await game.showMessage");
    expect(result.effects.reads).toEqual([{ kind: "switch", id: "lever_1" }]);
    expect(result.effects.writes).toEqual([{ kind: "switch", id: "sw_door" }]);
    expect(result.summary).toContain("스위치 sw_door");
    expect(result.sourceHash).toMatch(/^[0-9a-f]{16}$/u);
  });

  it("reports type errors with 1-based lines", () => {
    const result = compileScript(`const ok = 1;\nconst name: string = game.gold();\n`, { project: project() });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ line: 2, severity: "error", source: "type" }));
  });

  it("rejects DOM, network and timers at type-check time", () => {
    const result = compileScript(`document.title = "x";\nfetch("https://example.com");\nsetTimeout(() => {}, 10);\n`, { project: project() });
    const messages = result.diagnostics.map((entry) => entry.message).join("\n");
    expect(messages).toContain("document");
    expect(messages).toContain("fetch");
    expect(messages).toContain("setTimeout");
  });

  it("syntax errors leave compiled empty", () => {
    const result = compileScript(`await game.showMessage("hi"`, { project: project() });
    expect(result.ok).toBe(false);
    expect(result.compiled).toBe("");
    expect(result.diagnostics[0]).toMatchObject({ source: "syntax", severity: "error" });
  });

  it("warns about unknown ids with a suggestion and about un-awaited calls", () => {
    const result = compileScript(`game.setSwitch("sw_dor", true);\ngame.showMessage("hi");\n`, { project: project() });
    expect(result.ok).toBe(true);
    const messages = result.diagnostics.map((entry) => entry.message);
    expect(messages.some((message) => message.includes('Unknown switch "sw_dor"') && message.includes('"sw_door"'))).toBe(true);
    expect(messages.some((message) => message.includes("is not awaited"))).toBe(true);
  });

  it("records computed ids as dynamic", () => {
    const result = compileScript(`const ids = ["lever_1", "lever_2"];\nfor (const id of ids) game.getSwitch(id);\n`, { project: project() });
    expect(result.effects.dynamic).toEqual([{ api: "getSwitch", line: 2 }]);
  });

  it("extracts ids from game.cmd objects", () => {
    const result = compileScript(`await game.cmd({ kind: "changeItem", itemId: "potion", op: "+=", amount: 1 });\n`, { project: project() });
    expect(result.effects.writes).toContainEqual({ kind: "item", id: "potion" });
  });

  it("type-checks and links @lib modules; non-library imports are errors", () => {
    const value = project();
    const lib = compileScript(`export function price(base: number, rep: number): number {\n  return Math.round(base * (1 - Math.min(rep, 50) / 100));\n}\n`, { project: value, libraryId: "shop" });
    expect(lib.ok).toBe(true);
    value.scriptLibrary = [{ id: "shop", source: `export function price(base: number, rep: number): number {\n  return Math.round(base * (1 - Math.min(rep, 50) / 100));\n}\n`, compiled: lib.compiled }];
    const good = compileScript(`import { price } from "@lib/shop";\ngame.setVar("cost", price(200, game.getVar("rep")));\n`, { project: value });
    expect(good.ok).toBe(true);
    expect(good.effects.calls).toContainEqual({ kind: "library", id: "shop" });
    const wrongType = compileScript(`import { price } from "@lib/shop";\nprice("200", 1);\n`, { project: value });
    expect(wrongType.ok).toBe(false);
    const bad = compileScript(`import fs from "fs";\n`, { project: value });
    expect(bad.ok).toBe(false);
  });

  it("compiled output runs in the sandbox", () => {
    const value = project();
    const result = compileScript(`const pick = await game.showChoices(["no", "yes"]);\nif (pick === 1) game.addGold(50);\n`, { project: value });
    const command = scriptCommandFields(`…`, result, "gift");
    const session: PlaySessionLike = {
      flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: {}, partyActorIds: [],
      actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {}, currentMapId: value.startMapId, x: 0, y: 0, audio: {}, pictures: {},
    };
    const interpreter = createInterpreter([command], session, value);
    let step = interpreter.start();
    expect(step.kind).toBe("choices");
    step = interpreter.resume(1);
    expect(step.kind).toBe("done");
    expect(session.gold).toBe(50);
  });
});

describe("game .d.ts", () => {
  it("declares every API row and the project's ids", () => {
    const value = project();
    const dts = buildGameApiDts(scriptDtsIds(value, value.startMapId));
    for (const entry of SCRIPT_API) expect(dts).toContain(`  ${entry.name}(`);
    expect(dts).toContain('"sw_door"');
    expect(dts).toContain("declare const game: Game;");
  });

  it("inlined lib files match the installed typescript5 (regenerate with scripts/content/generate-script-ts-libs.mjs)", async () => {
    const fsName = "node:fs";
    const fs = (await import(fsName)) as { readFileSync: (path: string, encoding: "utf8") => string };
    const installed = JSON.parse(fs.readFileSync("node_modules/typescript5/package.json", "utf8")) as { version: string };
    expect(SCRIPT_TS_VERSION).toBe(installed.version);
    expect(Object.keys(SCRIPT_TS_LIB_SOURCES)).toContain(SCRIPT_TS_LIB_ENTRY);
    expect(SCRIPT_TS_LIB_SOURCES["lib.es5.d.ts"]).toBe(fs.readFileSync("node_modules/typescript5/lib/lib.es5.d.ts", "utf8"));
  });
});

describe("script persistence", () => {
  it("normalizeScriptLibrary drops bad rows and keeps good ones", () => {
    const library = normalizeScriptLibrary([
      { id: "shop", source: "export {}", compiled: "", name: " Shop " },
      { id: "Bad Id", source: "", compiled: "" },
      { id: "shop", source: "dup", compiled: "" },
      "junk",
    ]);
    expect(library).toEqual([{ id: "shop", source: "export {}", compiled: "", name: "Shop" }]);
    expect(normalizeScriptLibrary([])).toBeUndefined();
  });

  it("project scriptLibrary and script commands survive serialize → deserialize", () => {
    const value = project();
    value.scriptLibrary = [{ id: "shop", source: "export const a = 1;", compiled: "exports.a = 1;", sourceHash: "0123456789abcdef", apiVersion: 1 }];
    const map = value.maps[value.startMapId];
    if (!map) throw new Error("no start map");
    map.events.push({ id: "ev_s", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "script", source: "game.addGold(1)", compiled: "game.addGold(1);", name: "tip" }] });
    const restored = deserialize(serialize(value));
    expect(restored.scriptLibrary).toEqual(value.scriptLibrary);
    expect(restored.maps[value.startMapId]?.events.find((event) => event.id === "ev_s")?.commands).toEqual([
      { kind: "script", source: "game.addGold(1)", compiled: "game.addGold(1);", name: "tip" },
    ]);
  });
});
