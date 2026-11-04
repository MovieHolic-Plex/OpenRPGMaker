// 2026-11-05 gpt-only-game (ChatGPT subscription, Terra alone, 「좀비 생존 게임」 round 4): after the story was built and a scene
// test passed 11/11, a feature-review repair called author_dungeon{rebuild:true} on the same map. Rebuild clears every event, so the
// exit that triggers the ending and the key chest vanished and the game could no longer end.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "@/editor/tools/dungeonTools";
import { ToolError } from "@/editor/tools/types";

function builtDungeon() {
  const project = createBlankProject();
  const mapId = project.startMapId!;
  AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId, type: "catacomb", seed: 3, populate: false });
  return { project, mapId };
}

describe("author_dungeon rebuild keeps a game that can end", () => {
  it("refuses to rebuild a dungeon whose events trigger an ending", () => {
    const { project, mapId } = builtDungeon();
    const map = project.maps[mapId]!;
    map.events.push({ id: "ev_exit", name: "구조 지점으로 가는 계단", x: 2, y: 2, pages: [{ id: "p", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "triggerEnding", endingId: "ending_rescue" }] }] } as never);
    let error: unknown;
    try { AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId, type: "catacomb", seed: 5, rebuild: true, populate: false }); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(ToolError);
    expect((error as ToolError).code).toBe("rebuild-would-erase-ending");
    expect(map.events.some((e) => e.id === "ev_exit")).toBe(true);
  });

  it("refuses when an event calls a common event that ends the game", () => {
    const { project, mapId } = builtDungeon();
    project.commonEvents = [...(project.commonEvents ?? []), { id: "ce_finale", name: "피날레", trigger: "none", commands: [{ kind: "ending" }] } as never];
    project.maps[mapId]!.events.push({ id: "ev_gate", name: "문", x: 2, y: 2, pages: [{ id: "p", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "callCommonEvent", commonEventId: "ce_finale" }] }] } as never);
    expect(() => AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId, type: "catacomb", seed: 5, rebuild: true, populate: false })).toThrow(ToolError);
  });

  it("still rebuilds a dungeon without an ending event", () => {
    const { project, mapId } = builtDungeon();
    const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId, type: "catacomb", seed: 5, rebuild: true, populate: false });
    expect(res.summary).toContain("rebuild");
  });
});
