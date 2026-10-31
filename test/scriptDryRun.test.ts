// test/scriptDryRun.test.ts — shared headless runner (src/editor/script/dryRun.ts) and the stored explanation shape.
import { beforeAll, describe, expect, it } from "vitest";
import { compileScript, prepareScriptCompiler, scriptCommandFields } from "@/editor/script/compile";
import { dryRunCommands, dryRunTranscript } from "@/editor/script/dryRun";
import { preloadScriptEngine } from "@/player/script/engine";
import { createBlankProject } from "@/project/defaults";
import { normalizeScriptExplanation, scriptSourceHash } from "@/project/script/types";
import type { Project } from "@/project/types";

beforeAll(async () => {
  await Promise.all([prepareScriptCompiler(), preloadScriptEngine()]);
});

const SOURCE = [
  "const t = game.time();",
  'if (t.hour >= 20 || t.hour < 6) await game.showMessage("night");',
  'else await game.showMessage("day");',
  'const pick = await game.showChoices(["a", "b"]);',
  "if (pick === 1) game.addGold(5);",
].join("\n");

function clockProject(): Project {
  const project = createBlankProject();
  project.system = { ...(project.system ?? {}), timeSystem: { enabled: true } } as Project["system"];
  return project;
}

describe("dryRunCommands", () => {
  it("answers prompts from the setup and reports changes", () => {
    const project = createBlankProject();
    const command = scriptCommandFields(SOURCE, compileScript(SOURCE, { project }));
    const result = dryRunCommands(structuredClone(project), [command], { setup: { choices: [1] } });
    expect(result.ok).toBe(true);
    expect(dryRunTranscript(result.steps)).toEqual(["message: day", "choices: [a | b] → 1 (b)"]);
    expect(result.changes.gold).toEqual({ from: 0, to: 5 });
  });

  it("presets the clock when the project has a time system", () => {
    const project = clockProject();
    const command = scriptCommandFields(SOURCE, compileScript(SOURCE, { project }));
    const night = dryRunCommands(structuredClone(project), [command], { setup: { hour: 22 } });
    const day = dryRunCommands(structuredClone(project), [command], { setup: { hour: 8 } });
    expect(night.steps[0]).toEqual({ kind: "message", body: "night" });
    expect(day.steps[0]).toEqual({ kind: "message", body: "day" });
  });
});

describe("script explanation", () => {
  it("normalizes model output and drops junk", () => {
    const hash = scriptSourceHash(SOURCE);
    const explanation = normalizeScriptExplanation({
      sourceHash: hash,
      lines: ["밤에는 막는다.", "", 3],
      examples: [{ label: "밤", hour: 30, choices: [1, "x"] }, { label: "" }, { nope: true }],
    });
    expect(explanation).toEqual({ sourceHash: hash, lines: ["밤에는 막는다."], examples: [{ label: "밤", hour: 23, choices: [1] }] });
    expect(normalizeScriptExplanation({ sourceHash: hash, lines: [] })).toBeUndefined();
  });

  it("survives a recompile as stale data", () => {
    const project = createBlankProject();
    const explanation = { sourceHash: scriptSourceHash(SOURCE), lines: ["old"] };
    const next = "game.addGold(1);";
    const command = scriptCommandFields(next, compileScript(next, { project }), undefined, explanation);
    expect(command.explanation).toEqual(explanation);
    expect(command.explanation?.sourceHash).not.toBe(command.sourceHash);
  });
});
