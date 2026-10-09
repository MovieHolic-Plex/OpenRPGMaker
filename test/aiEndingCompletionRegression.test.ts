import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { parseToolVerdict } from "@/ai/agentVerification";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import { deserialize, resolveEventPage, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import type { Command, GameEvent } from "@/project/types";

// Reduced from the successful define_ending + corrected upsert_event calls in
// output/evidence/ai-adversarial-20260906/ai-audit.json (2026-09-06).
// The saved exit consumes its page-condition item and sets the ending condition,
// but never invokes the ending. Rendering, map art and unrelated NPCs are omitted.
// Sentinels identify runtime steps; none of the original prompt/prose is pinned.
function authorExit(invocation?: Command) {
  const ctx = { project: createBlankProject() };
  const mapId = ctx.project.startMapId;
  const item = ctx.project.database.items[0];
  const clearSwitch = ctx.project.switches[0];
  assert(item);
  assert(clearSwitch);
  const itemId = item.id;
  const switchId = clearSwitch.id;
  const endingId = "ending_regression";
  const definition = runTool(ctx, "define_ending", {
    id: endingId,
    name: "REGRESSION_ENDING",
    conditions: [{ kind: "switch", switchId, value: true }],
    priority: 1,
    epilogue: [{ kind: "say", lines: ["EPILOGUE_SENTINEL"] }],
  });
  expect(definition.ok, definition.summary).toBe(true);
  const event: GameEvent = {
    id: "ev_regression_exit", x: 10, y: 2,
    trigger: { kind: "action" }, commands: [],
    pages: [
      {
        id: "locked", name: "locked", conditions: [],
        trigger: { kind: "action" }, priority: "same",
        graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "LOCKED_SENTINEL" }],
      },
      {
        id: "has_item", name: "has item",
        conditions: [{ kind: "item", itemId, present: true }],
        trigger: { kind: "action" }, priority: "same",
        graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", body: "OPEN_SENTINEL" },
          { kind: "changeItem", itemId, op: "-=", amount: 1 },
          { kind: "setSwitch", switchId, value: true },
          ...(invocation ? [invocation] : []),
        ],
      },
    ],
  };
  const write = runTool(ctx, "upsert_event", { mapId, event });
  expect(write.ok, write.summary).toBe(true);
  const project = deserialize(serialize(ctx.project));
  const authoredMap = ctx.project.maps[mapId];
  const savedMap = project.maps[mapId];
  assert(authoredMap);
  assert(savedMap);
  const authoredEvent = authoredMap.events.find(entry => entry.id === event.id);
  const savedEvent = savedMap.events.find(entry => entry.id === event.id);
  const ending = project.endings?.find(entry => entry.id === endingId);
  assert(authoredEvent);
  assert(savedEvent);
  assert(ending);
  expect(savedEvent.pages).toEqual(authoredEvent.pages);
  expect(project.endings).toEqual(ctx.project.endings);
  return { project, event: savedEvent, itemId, switchId, endingId, ending };
}

function useExit(fixture: ReturnType<typeof authorExit>) {
  const { project, event, itemId } = fixture;
  const session = startSession(project);
  // Match PlayScene's runCommands setup before creating the interpreter.
  session.commonEvents = project.commonEvents;
  expect(resolveEventPage(event, session)?.id).toBe("locked");
  // Grant through the real interpreter, not an injected successful ending state.
  expect(createInterpreter([{ kind: "changeItem", itemId, op: "+=", amount: 1 }], session, project).start()).toEqual({ kind: "done" });
  const page = resolveEventPage(event, session);
  assert(page);
  expect(page.id).toBe("has_item");
  const interpreter = createInterpreter(page.commands, session, project, { currentEventId: event.id });
  expect(interpreter.start()).toMatchObject({ kind: "text", body: "OPEN_SENTINEL" });
  const afterDialogue = interpreter.resume();
  expect(session.inventory[itemId] ?? 0).toBe(0);
  expect(session.switches[fixture.switchId]).toBe(true);
  return { session, interpreter, afterDialogue };
}

describe("AI-authored ending completion at the tool/save/runtime seam", () => {
  it("reproduces the saved correction: item consumed, switch retained, no ending, exit relocked", () => {
    const fixture = authorExit();
    const { session, afterDialogue } = useExit(fixture);
    expect(afterDialogue).toEqual({ kind: "done" });
    expect(session.flags[`ending:${fixture.endingId}`]).toBeUndefined();
    const repeatedPage = resolveEventPage(fixture.event, session);
    assert(repeatedPage);
    expect(repeatedPage.id).toBe("locked");
    expect(createInterpreter(repeatedPage.commands, session, fixture.project).start())
      .toMatchObject({ kind: "text", body: "LOCKED_SENTINEL" });
  });

  it.each([
    { kind: "triggerEnding" } as const,
    { kind: "triggerEnding", endingId: "ending_regression" } as const,
  ])("control: an explicit invocation $endingId executes the persisted epilogue and ending", invocation => {
    const fixture = authorExit(invocation);
    const { session, interpreter, afterDialogue } = useExit(fixture);
    expect(afterDialogue).toMatchObject({ kind: "text", body: "EPILOGUE_SENTINEL" });
    expect(session.flags[`ending:${fixture.endingId}`]).toBe(true);
    expect(interpreter.resume()).toMatchObject({ kind: "returnToTitle", title: fixture.ending.name });
    const quality = runTool({ project: fixture.project }, "evaluate_game_quality", {});
    expect(quality.ok, quality.summary).toBe(true);
    expect(quality.data).toMatchObject({ verdict: { blocked: false }, coverage: { endings: { defined: 1, triggers: 1 } } });
  });

  it("does not certify completion when the sole defined ending has no invocation anywhere", () => {
    const fixture = authorExit();
    const { session, afterDialogue } = useExit(fixture);
    expect(afterDialogue).toEqual({ kind: "done" });
    expect(session.flags[`ending:${fixture.endingId}`]).toBeUndefined();
    const before = serialize(fixture.project);
    const quality = runTool({ project: fixture.project }, "evaluate_game_quality", {});
    expect(quality.ok, quality.summary).toBe(true);
    expect(serialize(fixture.project)).toBe(before);
    expect(quality.data).toMatchObject({ coverage: { endings: { defined: 1, triggers: 0 } } });
    // This belongs at completion assessment, not an automatic setSwitch hook:
    // defining an ending before wiring its event must remain a valid edit.
    expect(quality.data).toMatchObject({
      verdict: { blocked: true, objectiveErrorCount: 1 },
      coverage: { endings: { uninvokedIds: [fixture.endingId] } },
    });
    expect(quality.issues).toContainEqual(expect.objectContaining({ code: "ending-uninvoked", severity: "error" }));
    expect(parseToolVerdict("evaluate_game_quality", quality).pass).toBe(false);
  });

  it("permits defining an ending before authoring its invocation", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "define_ending", { id: "ending_later", name: "Later", conditions: [] });
    expect(result.ok, result.summary).toBe(true);
    expect(result.issues?.filter(issue => issue.severity === "error") ?? []).toEqual([]);
    expect(Object.values(ctx.project.maps).flatMap(map => map.events)).toEqual([]);
    expect(deserialize(serialize(ctx.project)).endings).toEqual(ctx.project.endings);
    const quality = runTool(ctx, "evaluate_game_quality", {});
    expect(quality.data).toMatchObject({ verdict: { blocked: true }, coverage: { endings: { uninvokedIds: ["ending_later"] } } });
  });

  it.each(["open-ended", "legacy-no-registry", "native-ending"] as const)("does not impose an ending on a %s game", mode => {
    const project = createBlankProject();
    if (mode === "legacy-no-registry") delete project.endings;
    else project.endings = [];
    if (mode === "native-ending") {
      const map = project.maps[project.startMapId];
      assert(map);
      map.events.push({ id: "ev_native", x: 2, y: 2, trigger: { kind: "action" }, commands: [{ kind: "ending", title: "NATIVE_SENTINEL", message: "" }] });
    }
    const quality = runTool({ project: deserialize(serialize(project)) }, "evaluate_game_quality", {});
    expect(quality.ok, quality.summary).toBe(true);
    expect(quality.data).toMatchObject({ verdict: { blocked: false }, coverage: { endings: { uninvokedIds: [] } } });
    expect(parseToolVerdict("evaluate_game_quality", quality).pass).toBe(true);
  });

  it.each(["named", "condition-selected"] as const)("matches each defined ending against %s invocations", mode => {
    const invocation: Command = mode === "named"
      ? { kind: "triggerEnding", endingId: "ending_regression" }
      : { kind: "triggerEnding" };
    const fixture = authorExit(invocation);
    const ctx = { project: fixture.project };
    const second = runTool(ctx, "define_ending", {
      id: "ending_other", name: "Other", priority: 2,
      conditions: [{ kind: "switch", switchId: fixture.switchId, value: true }],
    });
    expect(second.ok, second.summary).toBe(true);
    const quality = runTool(ctx, "evaluate_game_quality", {});
    expect(quality.data).toMatchObject({
      verdict: { blocked: mode === "named" },
      coverage: { endings: { defined: 2, triggers: 1, uninvokedIds: mode === "named" ? ["ending_other"] : [] } },
    });
  });

  it("does not mistake obsolete root commands for invocations when pages own execution", () => {
    const fixture = authorExit();
    fixture.event.commands = [{ kind: "triggerEnding", endingId: fixture.endingId }];
    const quality = runTool({ project: deserialize(serialize(fixture.project)) }, "evaluate_game_quality", {});
    expect(quality.data).toMatchObject({ verdict: { blocked: true }, coverage: { endings: { uninvokedIds: [fixture.endingId] } } });
    expect(useExit(fixture).afterDialogue).toEqual({ kind: "done" });
  });

  it("accepts a nested common-event invocation and executes it through the exit", () => {
    const fixture = authorExit();
    const ctx = { project: fixture.project };
    const commonEventId = "ce_regression_ending";
    const common = runTool(ctx, "upsert_common_event", {
      id: commonEventId, name: "Ending branch", trigger: "none",
      commands: [{ kind: "fork", condition: { kind: "switch", switchId: fixture.switchId, value: true }, then: [{ kind: "triggerEnding", endingId: fixture.endingId }] }],
    });
    expect(common.ok, common.summary).toBe(true);
    const pages = structuredClone(fixture.event.pages);
    assert(pages);
    const itemPage = pages.find(page => page.id === "has_item");
    assert(itemPage);
    itemPage.commands.push({ kind: "callCommonEvent", commonEventId });
    const write = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: fixture.event.id, pages } });
    expect(write.ok, write.summary).toBe(true);
    const project = deserialize(serialize(ctx.project));
    const map = project.maps[project.startMapId];
    assert(map);
    const event = map.events.find(entry => entry.id === fixture.event.id);
    assert(event);
    const played = useExit({ ...fixture, project, event });
    expect(played.afterDialogue).toMatchObject({ kind: "text", body: "EPILOGUE_SENTINEL" });
    expect(played.interpreter.resume()).toMatchObject({ kind: "returnToTitle", title: fixture.ending.name });
    const quality = runTool({ project }, "evaluate_game_quality", {});
    expect(quality.data).toMatchObject({ verdict: { blocked: false }, coverage: { endings: { uninvokedIds: [] } } });
  });

  it("accepts legacy root invocations when no pages replace them", () => {
    const fixture = authorExit();
    fixture.event.pages = [];
    fixture.event.commands = [{ kind: "triggerEnding", endingId: fixture.endingId }];
    const quality = runTool({ project: deserialize(serialize(fixture.project)) }, "evaluate_game_quality", {});
    expect(quality.data).toMatchObject({ verdict: { blocked: false }, coverage: { endings: { uninvokedIds: [] } } });
  });
});
