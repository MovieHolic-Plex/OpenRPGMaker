import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { gameOverOutcome, resolveGameOverSettings } from "@/project/cinematicSettings";
import { gameOverReferenceCounts } from "@/project/gameOverLibrary";
import { startSession } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import { createDefeatRecovery } from "@/player/defeatRecovery";

function fixture() {
  const p = deserialize(readFileSync(new URL("./fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"));
  p.system.gameOver = { title: "Legacy" };
  p.system.gameOvers = [
    { id: "caught", name: "Caught", settings: { presentation: "horror", outcome: "menu", title: "Caught", timing: { silenceMs: 1200 }, sequence: { enabled: false, skippable: false, scenes: [{ id: "last", kind: "text", narration: "Last light", durationMs: 0 }] } } },
    { id: "recover", name: "Defeated", settings: { presentation: "horror", outcome: "recover", recovery: { mapId: p.startMapId, x: 14, y: 20 } } },
    { id: "timeout", name: "Time is up", settings: { presentation: "blackout", outcome: "title", message: "Too late" } },
  ];
  p.system.defaultGameOverId = "caught";
  return p;
}

describe("authored game-over library", () => {
  it("round-trips all definitions and selects explicit IDs independently of the default", () => {
    const p = fixture(), restored = deserialize(serialize(p));
    expect(restored.system.gameOvers).toEqual(p.system.gameOvers);
    expect(resolveGameOverSettings(restored.system)?.title).toBe("Caught");
    expect(gameOverOutcome(resolveGameOverSettings(restored.system, "recover"))).toBe("recover");
    expect(gameOverOutcome(resolveGameOverSettings(restored.system, "timeout"))).toBe("title");
    expect(resolveGameOverSettings(restored.system, "missing")).toBeUndefined();
    delete restored.system.defaultGameOverId;
    expect(resolveGameOverSettings(restored.system)?.title).toBe("Legacy");
    expect(gameOverOutcome({ presentation: "blackout" })).toBe("recover");
  });
  it.each(["gameOver", "killPlayer"] as const)("hands %s's ID to the terminal and stops later commands", kind => {
    const p = fixture(), s = startSession(p);
    const interpreter = createInterpreter([{ kind, gameOverId: "recover" }, { kind: "setVariable", variableId: "var_lantern_shards", op: "=", value: 777 }], s, p);
    expect(interpreter.start()).toMatchObject({ kind: "gameOver", gameOverId: "recover" });
    expect(interpreter.resume(undefined)).toEqual({ kind: "done" });
    expect(s.variables.var_lantern_shards).not.toBe(777);
    const recovered = createDefeatRecovery(p, s, resolveGameOverSettings(p.system, "recover"));
    expect(recovered).toMatchObject({ x: 14, y: 20 });
  });
  it("counts nested event references and rejects dangling IDs on load", () => {
    const p = fixture(), event = p.maps[p.startMapId].events[0];
    event.pages[0].commands = [{ kind: "gameOver", gameOverId: "caught" }];
    expect(gameOverReferenceCounts(p).get("caught")).toBeGreaterThan(0);
    p.system.gameOvers = p.system.gameOvers!.filter(row => row.id !== "caught");
    delete p.system.defaultGameOverId;
    expect(() => deserialize(serialize(p))).toThrow();
  });
  it.each([
    { defaultGameOverId: "missing" },
    { gameOvers: [{ id: "x", name: "X", settings: {} }, { id: "x", name: "Y", settings: {} }] },
    { gameOvers: [{ id: "x", name: "", settings: {} }] },
    { gameOvers: [{ id: "x", name: "X", settings: { timing: { fadeOutMs: -1 } } }] },
    { gameOvers: [{ id: "x", name: "X", settings: { musicResourceId: "missing" } }] },
  ])("rejects invalid library data %j", patch => {
    const p = fixture(); Object.assign(p.system, patch);
    expect(() => deserialize(JSON.stringify(p))).toThrow();
  });
});
