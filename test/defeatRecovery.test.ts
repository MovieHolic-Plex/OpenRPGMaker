import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { createDefeatRecovery } from "@/player/defeatRecovery";
import { saveSessionCheckpoint } from "@/player/checkpoints";
import { createInterpreter } from "@/player/interpreter";

function projectFixture() {
  return deserialize(readFileSync(new URL("./fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"));
}

describe("blackout recovery and ending persistence", () => {
  it("heals the current run without rolling progress back to a checkpoint", () => {
    const project = projectFixture();
    project.system.gameOver = { presentation: "blackout", recovery: { mapId: project.startMapId, x: 14, y: 20 } };
    const session = startSession(project);
    saveSessionCheckpoint(project, session);
    session.variables.var_lantern_shards = 37;
    session.gold = 123;
    const actor = session.partyActorIds[0];
    session.actorVitals[actor].hp = 0;
    session.actorStateIds = { [actor]: ["state_death"] };
    const before = structuredClone(session);
    const recovered = createDefeatRecovery(project, session)!;
    expect(recovered).not.toBeNull();
    expect(recovered).toMatchObject({ x: 14, y: 20, gold: 123, variables: { var_lantern_shards: 37 }, audio: {} });
    expect(recovered.actorVitals[actor].hp).toBe(recovered.actorVitals[actor].maxHp);
    expect(recovered.actorStateIds?.[actor]).toEqual([]);
    expect(recovered.inventory).toEqual(before.inventory);
    expect(session).toEqual(before);
  });
  it("uses checkpoint coordinates without loading checkpoint state, and rejects a blocked destination", () => {
    const project = projectFixture();
    project.system.gameOver = { presentation: "blackout" };
    const session = startSession(project);
    saveSessionCheckpoint(project, session);
    session.x = 14; session.y = 20;
    session.variables.var_lantern_shards = 37;
    const recovered = createDefeatRecovery(project, session)!;
    expect(recovered.x).toBe(project.startPos.x);
    expect(recovered.y).toBe(project.startPos.y);
    expect(recovered.variables.var_lantern_shards).toBe(37);
    project.system.gameOver.recovery = { mapId: project.startMapId, x: 0, y: 0 };
    project.maps[project.startMapId].lowerTiles[0] = -1;
    project.maps[project.startMapId].upperTiles[0] = -1;
    expect(createDefeatRecovery(project, session)).toBeNull();
  });
  it("round-trips authored flows and passes each ending's presentation through its epilogue", () => {
    const project = projectFixture();
    project.system.gameOver = { presentation: "blackout", recovery: { mapId: project.startMapId, x: 14, y: 20 } };
    const presentation = { tone: "dark" as const, credits: "Story\nTravellers", backgroundResourceId: "oprn-title-field", musicResourceId: "cc0-bgm-field" };
    project.endings = [{ id: "finish", name: "Dawn", conditions: [], priority: 1, presentation }];
    const restored = deserialize(serialize(project));
    expect(restored.system.gameOver).toEqual(project.system.gameOver);
    expect(restored.endings?.[0].presentation).toEqual(presentation);
    const session = startSession(restored);
    const interpreter = createInterpreter([{ kind: "triggerEnding", endingId: "finish" }, { kind: "setVariable", variableId: "var_lantern_shards", op: "=", value: 777 }], session, restored);
    expect(interpreter.start()).toEqual({ kind: "returnToTitle", title: "Dawn", message: "", presentation });
    expect(interpreter.resume(undefined)).toEqual({ kind: "done" });
    expect(session.variables.var_lantern_shards).not.toBe(777);
    expect(session.flags['ending:finish']).toBe(true);
  });
  it.each([
    { presentation: "unknown" },
    { presentation: "blackout", recovery: { mapId: "missing", x: 0, y: 0 } },
    { recovery: { mapId: "map", x: 0.5, y: -1 } },
  ])("rejects malformed defeat settings on load", settings => {
    const project = projectFixture();
    (project.system as unknown as Record<string, unknown>).gameOver = settings;
    expect(() => deserialize(JSON.stringify(project))).toThrow();
  });
});
