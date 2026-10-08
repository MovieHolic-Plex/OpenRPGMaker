import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { getTool } from "@/editor/tools/toolRegistry";
import { COMMAND_SCHEMA } from "@/editor/tools/schemaShapes";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import { deserialize, resolveEventPage, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import type { GameEvent } from "@/project/types";
import recorded from "./fixtures/ai-native-page-round2.json";

// Exact successful exit call and ending from round2/first-audit.json and
// first-project.json. Only the surrounding map/database fixture is reduced.
function fixture() {
  const ctx = { project: createBlankProject() };
  const item = ctx.project.database.items[0];
  assert(item);
  ctx.project.database.items.push({ ...item, id: "item_brass_key" });
  const definition = runTool(ctx, "define_ending", recorded.ending);
  assert(definition.ok, definition.summary);
  const mapId = ctx.project.startMapId;
  const map = ctx.project.maps[mapId];
  assert(map);
  const existing: GameEvent = {
    id: recorded.exitCall.event.id, x: 10, y: 0,
    characterId: "gate_identity", trigger: { kind: "action" },
    commands: [{ kind: "text", body: "EXISTING_ROOT" }],
    pages: [{
      id: "existing", name: "Existing", conditions: [], graphic: {},
      trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "EXISTING_PAGE" }],
    }],
  };
  map.events.push(existing);
  return { ctx, mapId, existing };
}

describe("native upsert page contract", () => {
  it.each(["existing", "new"])("rejects the recorded successful-but-inert exit atomically for a %s event", mode => {
    const { ctx, mapId } = fixture();
    const map = ctx.project.maps[mapId];
    assert(map);
    if (mode === "new") map.events = [];
    const before = serialize(ctx.project);
    const result = runTool(ctx, "upsert_event", { ...recorded.exitCall, mapId });
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid-args" }));
    expect(serialize(ctx.project)).toBe(before);
  });

  it.each([
    { lines: ["LOST"] }, { showText: ["LOST"] }, { messages: ["LOST"] },
    { text: "LOST" }, { face: { resourceId: "LOST" } }, { choices: [] },
    { graphic: { query: "villager" } },
    { graphic: { textureKey: "LOST", characterIndex: 1 } },
  ])("rejects uncompiled page input %j without applying valid siblings", unsupported => {
    const { ctx, mapId, existing } = fixture();
    const before = serialize(ctx.project);
    const result = runTool(ctx, "upsert_event", {
      mapId, event: { id: existing.id, x: 4, pages: [
        { commands: [{ kind: "text", body: "VALID" }] },
        { ...unsupported, commands: [] },
      ] },
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid-args" }));
    expect(serialize(ctx.project)).toBe(before);
  });

  it("does not normalize omitted pages during a coordinate-only patch", () => {
    const { ctx, mapId, existing } = fixture();
    const page = existing.pages?.[0];
    assert(page);
    Object.assign(page, { choices: [{ text: "LEGACY", commands: [] }] });
    const before = structuredClone(existing);
    const result = runTool(ctx, "upsert_event", { mapId, event: { id: existing.id, x: 4 } });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[mapId]?.events.find(event => event.id === existing.id))
      .toEqual({ ...before, x: 4 });
  });

  // 2026-09-23 추리 도그푸딩: 증거 핫스팟(페이지 1장)에 최상위 commands 만 보냈고 도구는 OK 를
  // 돌려줬지만, 런타임은 page.commands 를 실행해 가구 자리표시 문구만 나왔다.
  it("moves top-level commands and trigger into the only page instead of storing them inert", () => {
    const { ctx, mapId, existing } = fixture();
    const result = runTool(ctx, "upsert_event", { mapId, event: {
      id: existing.id, trigger: { kind: "playerTouch" },
      commands: [{ kind: "text", body: "EVIDENCE" }, { kind: "setSwitch", switchId: "sw_0001", value: true }],
    } });
    assert(result.ok, result.summary);
    expect(result.diff?.warnings.join("\n")).toMatch(/pages\[0\]/);
    const project = deserialize(serialize(ctx.project));
    const event = project.maps[mapId]?.events.find(entry => entry.id === existing.id);
    assert(event);
    expect(event.commands).toEqual(existing.commands);
    expect(event.pages).toHaveLength(1);
    expect(event.pages?.[0]?.trigger).toEqual({ kind: "playerTouch" });
    const session = startSession(project);
    const page = resolveEventPage(event, session);
    assert(page);
    const interpreter = createInterpreter(page.commands, session, project, { currentEventId: event.id });
    expect(interpreter.start()).toMatchObject({ kind: "text", body: "EVIDENCE" });
    interpreter.resume();
    expect(session.switches.sw_0001).toBe(true);
  });

  it("keeps page commands when a rename patch carries an empty top-level commands list", () => {
    const { ctx, mapId, existing } = fixture();
    const result = runTool(ctx, "upsert_event", { mapId, event: { id: existing.id, name: "RENAMED", commands: [] } });
    assert(result.ok, result.summary);
    const event = ctx.project.maps[mapId]?.events.find(entry => entry.id === existing.id);
    expect(event?.pages?.[0]?.commands).toEqual(existing.pages?.[0]?.commands);
  });

  it("rejects top-level commands atomically when the event has several pages", () => {
    const { ctx, mapId, existing } = fixture();
    const page = existing.pages?.[0];
    assert(page);
    existing.pages = [page, { ...structuredClone(page), id: "second", conditions: [{ kind: "switch", switchId: "sw_0001", value: true }] }];
    const before = serialize(ctx.project);
    const result = runTool(ctx, "upsert_event", { mapId, event: { id: existing.id, commands: [{ kind: "text", body: "LOST" }] } });
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid-args" }));
    expect(result.summary).toMatch(/pages/);
    expect(serialize(ctx.project)).toBe(before);
  });

  it("advertises native graphics, triggers and executable option branches", () => {
    const pages = getTool("upsert_event")?.parameters.properties?.event?.properties?.pages?.items;
    expect(pages?.properties?.choices).toBeUndefined();
    expect(pages?.properties?.lines).toBeUndefined();
    expect(pages?.properties?.graphic?.properties?.sprite?.properties?.id?.type).toBe("string");
    expect(pages?.properties?.trigger?.properties?.kind?.enum).toContain("action");
    // options 는 choices({text,branch})와 presentItem({itemId,branch})이 함께 쓴다 — 공통 필수는 branch.
    expect(COMMAND_SCHEMA.properties?.options?.items?.required).toEqual(["branch"]);
    expect(COMMAND_SCHEMA.properties?.options?.items?.properties?.text?.type).toBe("string");
    expect(COMMAND_SCHEMA.properties?.options?.items?.properties?.itemId?.type).toBe("string");
    // 분기 안 kind 는 목록을 반복하지 않는다(바깥 Command 와 같은 값, 실행기가 모든 깊이를 검사) — 바깥 목록에 있으면 된다.
    expect(COMMAND_SCHEMA.properties?.kind?.enum).toContain("triggerEnding");
    expect(COMMAND_SCHEMA.properties?.options?.items?.properties?.branch?.items?.properties?.kind?.type).toBe("string");
    expect(() => JSON.stringify(getTool("upsert_event")?.parameters)).not.toThrow();
  });

  it.each([1, 2])("persists the repaired exit, presents choices, removes exactly one of %i keys and runs the recorded epilogue", keyCount => {
    const { ctx, mapId, existing } = fixture();
    const pages = recorded.exitCall.event.pages.map(page => {
      const { choices, ...native } = page;
      return { ...native, commands: [
        ...page.commands,
        ...(choices ? [{ kind: "choices", options: choices.map(choice => ({
          text: choice.text, branch: choice.commands,
        })) }] : []),
      ] };
    });
    const result = runTool(ctx, "upsert_event", { mapId, event: { id: existing.id, pages } });
    assert(result.ok, result.summary);
    const project = deserialize(serialize(ctx.project));
    const event = project.maps[mapId]?.events.find(entry => entry.id === existing.id);
    assert(event);
    expect(event.commands).toEqual(existing.commands);
    expect(event.characterId).toBe(existing.characterId);
    const session = startSession(project);
    session.commonEvents = project.commonEvents;
    expect(resolveEventPage(event, session)?.id).toBe("pages[0]");
    createInterpreter([{ kind: "changeItem", itemId: "item_brass_key", op: "+=", amount: keyCount }], session, project).start();
    const page = resolveEventPage(event, session);
    assert(page);
    expect(page.id).toBe("pages[1]");
    const interpreter = createInterpreter(page.commands, session, project, { currentEventId: event.id });
    expect(interpreter.start().kind).toBe("text");
    expect(interpreter.resume().kind).toBe("choices");
    expect(session.inventory.item_brass_key).toBe(keyCount);
    expect(interpreter.resume(0).kind).toBe("text");
    expect(session.inventory.item_brass_key ?? 0).toBe(keyCount - 1);
    for (const beat of recorded.ending.epilogue) {
      expect(interpreter.resume()).toMatchObject({ kind: "text", body: beat.text });
    }
    expect(session.flags[`ending:${recorded.ending.id}`]).toBe(true);
    expect(interpreter.resume()).toMatchObject({ kind: "returnToTitle", title: recorded.ending.name });
  });

  it("returns an executable canonical repair example, including a no-effect cancel option", () => {
    const { ctx, mapId, existing } = fixture();
    const rejection = runTool(ctx, "upsert_event", { ...recorded.exitCall, mapId });
    const issue = rejection.issues?.find(entry => entry.code === "invalid-args");
    assert(issue);
    // Parse the JSON example, not the surrounding explanation or its wording.
    const jsonStart = issue.message.indexOf('{"mapId":');
    assert(jsonStart >= 0);
    const example: unknown = JSON.parse(issue.message.slice(jsonStart)
      .replaceAll("existing_map_id", mapId).replaceAll("existing_event_id", existing.id)
      .replaceAll("existing_item_id", "item_brass_key").replaceAll("defined_ending_id", recorded.ending.id));
    assert(example && typeof example === "object" && !Array.isArray(example));
    const result = runTool(ctx, "upsert_event", { ...example });
    assert(result.ok, result.summary);
    const project = deserialize(serialize(ctx.project));
    const event = project.maps[mapId]?.events.find(entry => entry.id === existing.id);
    assert(event);
    for (const option of [0, 1]) {
      const session = startSession(project);
      session.commonEvents = project.commonEvents;
      createInterpreter([{ kind: "changeItem", itemId: "item_brass_key", op: "+=", amount: 1 }], session, project).start();
      const page = resolveEventPage(event, session);
      assert(page);
      const interpreter = createInterpreter(page.commands, session, project);
      expect(interpreter.start().kind).toBe("choices");
      const afterChoice = interpreter.resume(option);
      if (option === 1) {
        expect(afterChoice.kind).toBe("done");
        expect(session.inventory.item_brass_key).toBe(1);
        expect(session.flags[`ending:${recorded.ending.id}`]).toBeUndefined();
      } else {
        expect(afterChoice).toMatchObject({ kind: "text", body: recorded.ending.epilogue[0]?.text });
        for (const beat of recorded.ending.epilogue.slice(1)) {
          expect(interpreter.resume()).toMatchObject({ kind: "text", body: beat.text });
        }
        expect(session.inventory.item_brass_key ?? 0).toBe(0);
        expect(interpreter.resume()).toMatchObject({ kind: "returnToTitle", title: recorded.ending.name });
      }
    }
  });

  it.each([
    { kind: "removeItem", itemId: "item_brass_key", amount: 1 },
    { kind: "switch", switchId: "sw_0001", value: true },
    { kind: "setSwitch", switchId: "sw_0001", value: 1 },
  ])("rejects invalid nested command $kind atomically", invalid => {
    const { ctx, mapId, existing } = fixture();
    const before = serialize(ctx.project);
    const result = runTool(ctx, "upsert_event", { mapId, event: { id: existing.id, pages: [{
      commands: [{ kind: "choices", options: [{ text: "OPTION", branch: [invalid] }] }],
    }] } });
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid-args" }));
    expect(serialize(ctx.project)).toBe(before);
  });

  it.each(["place_npc", "make_villager"])("keeps SimplePage choice compilation in %s", name => {
    const { ctx, mapId } = fixture();
    const result = runTool(ctx, name, { mapId, id: "high_level", name: "NPC", x: 3, y: 3,
      pages: [{ lines: ["PROMPT"], choices: [{ text: "OPTION", commands: [{ kind: "text", body: "BRANCH" }] }] }],
    });
    assert(result.ok, result.summary);
    const event = ctx.project.maps[mapId]?.events.find(entry => entry.id === "high_level");
    expect(event?.pages?.[0]?.commands).toContainEqual(expect.objectContaining({
      kind: "choices", options: [{ text: "OPTION", branch: [{ kind: "text", body: "BRANCH" }] }],
    }));
  });
});
