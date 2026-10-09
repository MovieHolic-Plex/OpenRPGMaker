import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import { gotoLabel } from "@/player/interpreter/stack";
import { advanceFieldSpawns, createFieldSpawnRuntime, resolveFieldSpawnVictory, removeFieldSpawnEntry } from "@/player/fieldSpawns";
import { interactWithFarmPlot } from "@/player/farming";
import { runtimeEventView } from "@/project/runtimeEventState";
import { invalidateTilePassabilityComponents } from "@/project/tilePassabilityComponents";
import * as collision from "@/project/collision";
import * as footprint from "@/project/footprint";
import { TILE } from "@/project/defaults/constants";
import type { Command, GameEvent } from "@/project/types";
import type { Frame } from "@/player/interpreter/types";
import { syncWeatherLayer } from "@/player/playSceneWeather";
import { stormFlashOpacity } from "@/player/weather/weatherModel";
import { legacyPrecipitation } from "./fixtures/runtimeLag8Legacy";
import { graphicsRecorder } from "./fixtures/runtimeLag8Graphics";
vi.mock("@/player/audio", () => ({ getAudioEngine: () => ({ weather: { update() {} }, isUnlocked: () => false }) }));
vi.mock("@/player/playSceneAtmosphere", () => ({ syncAtmosphere() {} }));
afterEach(() => vi.restoreAllMocks());
function world() { const project = createBlankProject(); return { project, map: project.maps[project.startMapId]!, session: startSession(project) }; }
function linear(stack: Frame[], name: string): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    for (let j = 0; j < stack[i]!.commands.length; j++) {
      const c = stack[i]!.commands[j];
      if (c?.kind === "label" && c.name === name) { stack.length = i + 1; stack[i]!.pc = j; return true; }
    }
  }
  return false;
}
describe("8차 lvB label", () => {
  it("seeded arbitrary in-place edits preserve first label and inner-frame precedence (20000 steps)", () => {
    let seed = 0x8b202609;
    const random = (n: number) => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % n; };
    const make = (): Command => random(2) ? { kind: "label", name: `L${random(4)}` } : { kind: "gotoLabel", name: `L${random(4)}` };
    const lists: Command[][] = [Array.from({ length: 30 }, make), Array.from({ length: 20 }, make)];
    for (let step = 0; step < 20000; step++) {
      const listIndex = random(2), list = lists[listIndex]!, i = random(Math.max(1, list.length));
      switch (random(8)) {
        case 0: list[i] = make(); break;
        case 1: if (list[i]) (list[i] as any).name = `L${random(4)}`; break;
        case 2: if (list[i]) (list[i] as any).kind = random(2) ? "label" : "gotoLabel"; break;
        case 3: list.splice(i, random(3), make()); break;
        case 4: list.reverse(); break;
        case 5: list.length = random(35); break;
        case 6: lists[listIndex] = list.slice(); break;
        case 7: delete list[i]; break;
      }
      const name = `L${random(5)}`;
      const actual = lists.map(commands => ({ commands, pc: 7 }));
      const expected = lists.map(commands => ({ commands, pc: 7 }));
      expect(gotoLabel(actual, name), `seed step ${step}`).toBe(linear(expected, name));
      expect(actual.map(f => f.pc)).toEqual(expected.map(f => f.pc));
    }
  });
  it("a callback-free no-wait label loop does not scan the command prefix for each jump", () => {
    const { session } = world();
    const values: Command[] = [{ kind: "gotoLabel", name: "end" }, ...Array.from({ length: 2000 }, () => ({ kind: "label", name: "unused" }) as Command)];
    // Non-label prefix is what sparse label indexing accelerates.
    for (let i = 1; i < values.length; i++) values[i] = { kind: "gotoLabel", name: "unused" };
    values.push({ kind: "label", name: "end" }, { kind: "gotoLabel", name: "end" });
    let reads = 0;
    const commands = new Proxy(values, { get(target, key, receiver) { if (typeof key === "string" && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver); } });
    createInterpreter(commands, session, undefined, { maxInstructions: 1000 }).start();
    expect(reads).toBeLessThan(10000);
  });
  it("beforeCommand can insert an earlier duplicate without changing length", () => {
    const { session } = world();
    const commands: Command[] = [{ kind: "gotoLabel", name: "x" }, { kind: "label", name: "other" }, { kind: "label", name: "x" }, { kind: "gotoLabel", name: "x" }];
    const seen: Command[] = [];
    createInterpreter(commands, session, undefined, { maxInstructions: 8, beforeCommand(c) {
      seen.push(c); if (seen.length === 4) commands[1] = { kind: "label", name: "x" };
    } }).start();
    expect(seen[5]).toBe(commands[1]);
  });
});
describe("8차 lvB full spawn areas", () => {
  it("does not repeat terrain scans until terrain revision changes", () => {
    const { project, map } = world(); map.events = []; map.lowerTiles.fill(TILE.WALL);
    map.fieldSpawns = [{ id: "s", troopId: project.database.troops[0]!.id, area: { x: 0, y: 0, w: 10, h: 10 }, maxAlive: 2 }];
    const player = { x: 15, y: 15 }, state = createFieldSpawnRuntime(project, map, player);
    const scan = vi.spyOn(collision, "isPassable");
    for (let i = 0; i < 60; i++) advanceFieldSpawns(state, project, map, player, 1000);
    expect(scan.mock.calls.length).toBe(0);
    map.lowerTiles[0] = TILE.GRASS; invalidateTilePassabilityComponents(map);
    expect(advanceFieldSpawns(state, project, map, player, 1000)).toBe(true);
    expect(state.entries[0]!.alive[0]).toMatchObject({ x: 0, y: 0 });
  });
  it("retries when runtime event/player occupancy changes and observes moved spawn bodies", () => {
    const { project, map } = world();
    map.events = [{ id: "blocker", x: 0, y: 0, commands: [], trigger: { kind: "action" } }];
    map.fieldSpawns = [{ id: "s", troopId: project.database.troops[0]!.id, area: { x: 0, y: 0, w: 1, h: 1 }, maxAlive: 2, respawnSec: 1 }];
    const player = { x: 10, y: 10 }, state = createFieldSpawnRuntime(project, map, player);
    expect(state.entries[0]!.alive).toHaveLength(0);
    const positions: any = { blocker: { x: 2, y: 0 } };
    expect(advanceFieldSpawns(state, project, map, player, 1000, positions)).toBe(true);
    const id = state.entries[0]!.alive[0]!.eventId;
    positions[id] = { x: 3, y: 0 };
    expect(advanceFieldSpawns(state, project, map, player, 1000, positions)).toBe(true);
    resolveFieldSpawnVictory(state, id);
    expect(advanceFieldSpawns(state, project, map, { x: 0, y: 0 }, 1000, positions)).toBe(false);
    removeFieldSpawnEntry(state, "s");
    expect(state.entries).toHaveLength(0);
  });
});
describe("8차 lvB blank investigation", () => {
  it("reads without cloning a large unrelated session and leaves it untouched", () => {
    const { project, map, session } = world(); map.farmableArea = [];
    session.variables.payload = 42;
    const before = structuredClone(session), clone = vi.spyOn(globalThis, "structuredClone");
    expect(interactWithFarmPlot(project, session, map, 0, 0)).toMatchObject({ kind: "ignored", reason: "not-farmable" });
    expect(clone.mock.calls.length).toBe(0); expect(session).toEqual(before);
  });
});
describe("8차 lvB allocations", () => {
  it("event rectangles are independent snapshots without recomputing body geometry for passRect", () => {
    const { project, session } = world();
    const event: GameEvent = { id: "e", x: 3, y: 4, commands: [], trigger: { kind: "action" } };
    const pass = vi.spyOn(footprint, "passageBounds");
    const a = runtimeEventView(event, session, {}, project);
    expect(pass.mock.calls.length).toBe(0);
    event.x = 7;
    const b = runtimeEventView(event, session, {}, project);
    expect(a.x).toBe(3); expect(a.bodyRect.left).toBe(3); expect(b.bodyRect.left).toBe(7);
    expect(a.bodyRect).not.toBe(a.passRect); expect(a.bodyRect).not.toBe(b.bodyRect);
  });
  it("storm/rain use one buffer, with byte-identical Phaser commands across size, intensity and flash changes", () => {
    const graphics = graphicsRecorder(), layer = { setVisible() {}, setPosition() {}, setScale() {} };
    const scene: any = { weatherGraphics: graphics, weatherLayer: layer, session: { m2Runtime: { screen: {} } }, map: {}, cameras: { main: { width: 640, height: 480, zoom: 1 } } };
    let buffer: number[] | undefined;
    for (const kind of ["rain", "storm"] as const) for (const intensity of [0.01, 0.5, 1, 0.2, 1]) for (const time of [0, 16, 120, 290, 4032, 8128, 123456]) {
      const params = { kind, intensity };
      scene.session.m2Runtime.screen.weather = `${kind},${intensity}`; scene.weatherClockMs = time;
      scene.cameras.main.width = time % 3 ? 800 : 640;
      syncWeatherLayer(scene);
      const oracle = graphicsRecorder(); legacyPrecipitation(oracle as any, params, scene.cameras.main.width, 480, time);
      const flash = stormFlashOpacity(params, time); if (flash > 0) { oracle.fillStyle(0xffffff, flash); oracle.fillRect(0, 0, scene.cameras.main.width, 480); }
      expect(graphics.commandBuffer).toEqual(oracle.commandBuffer);
      if (buffer) expect(graphics.commandBuffer).toBe(buffer); buffer = graphics.commandBuffer;
    }
    expect(graphics.lines).toBe(0); expect(graphics.clears).toBe(0);
  });
});
