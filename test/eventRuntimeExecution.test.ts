import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { serializePretty, deserialize } from "@/project/io";
import type { Command, M2CommandFields } from "@/project/types";

const m2 = (id: string, fields: M2CommandFields = {}): Command => {
  expect(m2CommandById(id)).toBeTruthy();
  return { kind: "m2Command", commandId: id, fields };
};
const after: Command = { kind: "text", body: "after" };

describe("persisted event commands execute their requested behavior", () => {
  it("preserves M2 fields through load/save/migration and emits the same movie request", () => {
    const p = createBlankProject();
    p.maps[p.startMapId]!.events = [{ id: "probe", x: 1, y: 1, trigger: { kind: "action" }, commands: [
      m2("m2-066-play-movie", { value: "intro.webm", wait: true }),
    ] }];
    for (const version of [3, p.version]) {
      const loaded = deserialize(serializePretty({ ...p, version }));
      const reloaded = deserialize(serializePretty(loaded));
      const commands = reloaded.maps[reloaded.startMapId]!.events[0]!.commands;
      expect(createInterpreter(commands, startSession(reloaded), reloaded).start()).toMatchObject({ kind: "playMovie", resourceId: "intro.webm", wait: true });
    }
  });
  it("polls indefinitely with timeout zero until a switch changes; does not burn instruction budget", () => {
    const s = startSession(createBlankProject());
    const i = createInterpreter([m2("m2-206-wait-until", { target: "ready", timeoutMs: 0 }), after], s, undefined, { maxInstructions: 3 });
    expect(i.start()).toMatchObject({ kind: "wait", ms: 50, allowParallelEvents: true });
    for (let n = 0; n < 150; n++) expect(i.resume()).toMatchObject({ kind: "wait" });
    expect(s.m2Runtime?.waits).toHaveLength(1);
    s.switches.ready = true;
    expect(i.resume()).toMatchObject({ kind: "text", body: "after" });
  });

  it("ends a finite wait at the authored timeout, including a partial polling interval", () => {
    const s = startSession(createBlankProject());
    const i = createInterpreter([m2("m2-206-wait-until", { target: "ready", timeoutMs: 75 }), after], s);
    expect(i.start()).toMatchObject({ kind: "wait", ms: 50 });
    expect(i.resume()).toMatchObject({ kind: "wait", ms: 25 });
    expect(i.resume()).toMatchObject({ kind: "text" });
    expect(s.flags["m2-wait:switchOn:ready"]).toBe(false);
  });

  it.each(["switchOff", "variable"])("rechecks %s after resuming", condition => {
    const s = startSession(createBlankProject());
    s.switches.ready = true;
    const i = createInterpreter([m2("m2-206-wait-until", { condition, target: "ready", value: "7" }), after], s);
    expect(i.start().kind).toBe("wait");
    s.switches.ready = false;
    s.variables.ready = 7;
    expect(i.resume().kind).toBe("text");
  });

  it("checks authored regions and live route completion on every poll", () => {
    const p = createBlankProject();
    const map = p.maps[p.startMapId]!;
    map.layoutPlan = { version: 1, kind: "test", regions: [{ id: "arrival", label: "arrival", role: "custom", x: 1, y: 1, w: 2, h: 2 }] };
    const s = startSession(p); s.x = 5; s.y = 5;
    let idle = false;
    const i = createInterpreter([
      m2("m2-206-wait-until", { condition: "region", target: "arrival" }),
      m2("m2-206-wait-until", { condition: "eventIdle", target: "this-event" }), after,
    ], s, p, { currentEventId: "walker", isEventIdle: target => target === "walker" && idle });
    expect(i.start().kind).toBe("wait");
    s.x = 1; s.y = 2;
    expect(i.resume().kind).toBe("wait");
    idle = true;
    expect(i.resume().kind).toBe("text");
  });

  it("skipping one wait does not carry its elapsed time to a later wait", () => {
    const s = startSession(createBlankProject());
    const cmd = m2("m2-206-wait-until", { target: "ready", timeoutMs: 100 });
    const i = createInterpreter([cmd, cmd, after], s);
    i.start(); i.resume();
    expect(i.skip().kind).toBe("wait");
    expect(i.resume().kind).toBe("wait");
    expect(i.resume().kind).toBe("text");
  });

  it.each([["m2-078-open-menu-screen", "openMenuScreen"], ["m2-093-open-load-menu", "openLoadMenu"]])("%s requests its own screen", (id, kind) => {
    const s = startSession(createBlankProject());
    expect(createInterpreter([m2(id)], s).start()).toEqual({ kind });
  });

  it("pathfinding emits a movement request and leaves coordinates unchanged until scene playback", () => {
    const s = startSession(createBlankProject());
    const before = { x: s.x, y: s.y, events: structuredClone(s.eventLocations) };
    expect(createInterpreter([m2("m2-205-pathfind-move", { target: "player", x: 6, y: 6, wait: true })], s).start())
      .toEqual({ kind: "pathfindMove", target: "player", x: 6, y: 6, speed: 4, wait: true });
    expect({ x: s.x, y: s.y, events: s.eventLocations }).toEqual(before);
  });

  it("legacy movie value and canonical resourceId use the video playback step", () => {
    const s = startSession(createBlankProject());
    expect(createInterpreter([m2("m2-066-play-movie", { value: "intro.webm" })], s).start())
      .toEqual({ kind: "playMovie", resourceId: "intro.webm", wait: true, skippable: true });
    expect(createInterpreter([m2("m2-066-play-movie", { resourceId: "finale.webm", value: "old", wait: false, skippable: false })], s).start())
      .toEqual({ kind: "playMovie", resourceId: "finale.webm", wait: false, skippable: false });
  });

  it("reads replacement runtime position maps after a wait", () => {
    const p = createBlankProject(), s = startSession(p);
    p.maps[p.startMapId]!.events = [{ id: "walker", x: 1, y: 1, trigger: { kind: "action" }, commands: [] }];
    let positions = { walker: { x: 1, y: 1 } };
    const i = createInterpreter([
      { kind: "wait", ms: 10 },
      m2("m2-043-get-event-id", { mapId: p.startMapId, x: 3, y: 2, variableId: "result" }),
    ], s, p, { getEventPositions: () => positions });
    i.start();
    positions = { walker: { x: 3, y: 2 } };
    i.resume();
    expect(s.variables.result).toBe(1);
  });

  it("queries actual terrain and stable one-based event slots, including moved and erased events", () => {
    const p = createBlankProject();
    const map = p.maps[p.startMapId]!;
    map.events = [
      { id: "first", x: 1, y: 1, trigger: { kind: "action" }, commands: [] },
      { id: "second", x: 2, y: 2, trigger: { kind: "action" }, commands: [] },
    ];
    const tile = map.lowerTiles[2 * map.width + 2]!;
    p.tilesets[map.tilesetId]!.terrain[tile] = 9;
    p.tilesets[map.tilesetId]!.tileMeta ??= {};
    p.tilesets[map.tilesetId]!.tileMeta![tile] = { label: "probe", description: "", terrainTag: 9 };
    const s = startSession(p);
    const positions = { second: { x: 3, y: 2 } };
    const query = (id: string, x: number, y: number) => {
      createInterpreter([m2(id, { x, y, variableId: "result" })], s, p, { eventPositions: positions }).start();
      return s.variables.result;
    };
    expect(query("m2-042-get-terrain-id", 2, 2)).toBe(9);
    expect(query("m2-043-get-event-id", 2, 2)).toBe(0);
    expect(query("m2-043-get-event-id", 3, 2)).toBe(2);
    s.erasedEventIds = ["first"];
    expect(query("m2-043-get-event-id", 3, 2)).toBe(2);
    s.erasedEventIds.push("second");
    expect(query("m2-043-get-event-id", 3, 2)).toBe(0);
    expect(query("m2-042-get-terrain-id", -1, 2)).toBe(0);
    s.mapOverrides[map.id] = { lower: { [2 * map.width + 2]: -1 }, upper: {} };
    expect(query("m2-042-get-terrain-id", 2, 2)).toBe(0);
  });
});
