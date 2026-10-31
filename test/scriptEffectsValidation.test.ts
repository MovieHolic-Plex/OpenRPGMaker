// Validators and graphs read `script` command effects (openwiki/script-sandbox.md 「검증기」).
// Effects are hand-written here — no TypeScript compiler involved.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { projectCommonEventReferenceMessage } from "@/editor/databaseReferences";
import { strandedByRemoval } from "@/editor/tools/strandedSwitches";
import { findUnwrittenSelfSwitchGates } from "@/project/eventPageShadow";
import { projectLint } from "@/project/lint/projectLint";
import {
  dynamicRefKinds,
  expandScriptEffects,
  projectScriptUsage,
  scriptCalls,
  scriptCommandEffects,
  scriptHasDynamic,
  scriptWrites,
} from "@/project/script/effects";
import type { ScriptEffects } from "@/project/script/types";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import { buildMapGraph, checkMapGraph } from "@/qa/gameCheck/mapGraph";
import { checkProgression } from "@/qa/gameCheck/progression";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

function effects(partial: Partial<ScriptEffects>): ScriptEffects {
  return { reads: [], writes: [], calls: [], dynamic: [], ...partial };
}

function script(fx: ScriptEffects | undefined, compiled = "/* compiled */"): Command {
  return { kind: "script", source: "// ts", compiled, ...(fx ? { effects: fx } : {}) } as Command;
}

function page(id: string, commands: Command[], conditions: EventPage["conditions"] = []): EventPage {
  return {
    id, name: id, conditions, graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  } as EventPage;
}

function event(id: string, x: number, pages: EventPage[]): GameEvent {
  return { id, name: id, x, y: 1, trigger: { kind: "action" }, commands: [], pages } as GameEvent;
}

function project(): Project {
  const p = createBlankProject();
  p.switches = [...p.switches, { id: "sw_gate", name: "gate open" }];
  return p;
}

function startMap(p: Project) {
  return p.maps[p.startMapId]!;
}

describe("script effects helpers", () => {
  it("merges @lib effects transitively with a cycle guard", () => {
    const library = [
      { id: "a", source: "", compiled: "x", effects: effects({ writes: [{ kind: "switch", id: "sw_a" }], calls: [{ kind: "library", id: "b" }] }) },
      { id: "b", source: "", compiled: "x", effects: effects({ calls: [{ kind: "commonEvent", id: "ce_b" }, { kind: "library", id: "a" }] }) },
    ];
    const merged = expandScriptEffects(effects({ calls: [{ kind: "library", id: "a" }] }), library);
    expect(merged.writes).toEqual([{ kind: "switch", id: "sw_a" }]);
    expect(merged.calls.map((ref) => `${ref.kind}:${ref.id}`).sort()).toEqual(["commonEvent:ce_b", "library:a", "library:b"]);
  });

  it("treats compiled scripts without effects as fully dynamic, empty ones as inert", () => {
    expect(scriptHasDynamic(script(undefined), "switch", { access: "write" })).toBe(true);
    expect(scriptCommandEffects({ kind: "script", compiled: "  " })).toEqual(effects({}));
  });

  it("maps dynamic api names to ref kinds", () => {
    expect(dynamicRefKinds("setSwitch")).toEqual([{ kind: "switch", access: "write" }]);
    expect(dynamicRefKinds("cmd.transfer.mapId")).toEqual([{ kind: "map", access: "call" }]);
    expect(dynamicRefKinds("cmd").length).toBeGreaterThan(10);
    const fx = script(effects({ dynamic: [{ api: "getSwitch", line: 3 }] }));
    expect(scriptHasDynamic(fx, "switch", { access: "write" })).toBe(false);
    expect(scriptHasDynamic(fx, "switch", { access: "read" })).toBe(true);
  });

  it("resolves switch names to ids", () => {
    const p = project();
    const command = script(effects({ writes: [{ kind: "switch", id: "gate open" }] }));
    expect(scriptWrites(command, "switch", p)).toEqual(["sw_gate"]);
  });
});

describe("validators read script effects", () => {
  it("a switch written only by a script is not reported as never set", () => {
    const p = project();
    startMap(p).events.push(
      event("ev_lever", 2, [page("p1", [script(effects({ writes: [{ kind: "switch", id: "sw_gate" }] }))])]),
      event("ev_door", 4, [page("p1", [{ kind: "text", body: "closed" } as Command]), page("p2", [{ kind: "text", body: "open" } as Command], [{ kind: "switch", switchId: "sw_gate", value: true }])]),
    );
    const codes = checkProgression(p).filter((finding) => finding.code === "page-switch-never-set");
    expect(codes).toEqual([]);
    const index = buildStoryFlagUsageIndex(p);
    expect(usageBucketFor(index, "switch", "sw_gate").writes.map((site) => site.detail)).toContain("script");
  });

  it("removing the only setSwitch event is not stranded when a script also writes the switch", () => {
    const p = project();
    startMap(p).events.push(
      event("ev_boss", 2, [page("p1", [{ kind: "setSwitch", switchId: "sw_gate", value: true } as Command])]),
      event("ev_lever", 3, [page("p1", [script(effects({ writes: [{ kind: "switch", id: "sw_gate" }] }))])]),
      event("ev_door", 5, [page("p1", [], [{ kind: "switch", switchId: "sw_gate", value: true }])]),
    );
    expect(strandedByRemoval(p, p.startMapId, "ev_boss")).toEqual([]);
    // Control: without the script the same removal is stranded.
    startMap(p).events = startMap(p).events.filter((entry) => entry.id !== "ev_lever");
    expect(strandedByRemoval(p, p.startMapId, "ev_boss").map((entry) => entry.switchId)).toEqual(["sw_gate"]);
  });

  it("dynamic switch writes downgrade never-set to info with a note", () => {
    const p = project();
    startMap(p).events.push(
      event("ev_lever", 2, [page("p1", [script(effects({ dynamic: [{ api: "setSwitch", line: 1 }] }))])]),
      event("ev_door", 4, [page("p1", [], [{ kind: "switch", switchId: "sw_gate", value: true }])]),
    );
    const hits = checkProgression(p).filter((finding) => finding.code === "page-switch-never-set");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.severity).toBe("info");
    expect(hits[0]!.message).toContain("계산된 id");
  });

  it("a common event called only by a script is referenced (delete guard, usage)", () => {
    const p = project();
    p.commonEvents.push({ id: "ce_reward", name: "reward", trigger: "none", commands: [] });
    expect(projectCommonEventReferenceMessage(p, "ce_reward")).toBeNull();
    startMap(p).events.push(event("ev_chest", 2, [page("p1", [script(effects({ calls: [{ kind: "commonEvent", id: "ce_reward" }] }))])]));
    expect(projectScriptUsage(p).ids("call", "commonEvent").has("ce_reward")).toBe(true);
    expect(projectCommonEventReferenceMessage(p, "ce_reward")).toContain("스크립트");
  });

  it("a script transfer is a map edge in the game-check graph", () => {
    const p = project();
    const start = startMap(p);
    const cave = { ...structuredClone(start), id: "map_cave", name: "cave", events: [] };
    p.maps[cave.id] = cave;
    const before = buildMapGraph(p);
    expect(before.reachable.has("map_cave")).toBe(false);
    start.events.push(event("ev_portal", 2, [page("p1", [script(effects({ calls: [{ kind: "map", id: "map_cave" }] }))])]));
    const graph = buildMapGraph(p);
    expect(graph.edges.some((edge) => edge.via === "script" && edge.from === p.startMapId && edge.to === "map_cave")).toBe(true);
    expect(graph.reachable.has("map_cave")).toBe(true);
    // Script edges have no landing cell — no out-of-bounds finding for them.
    expect(checkMapGraph(p, graph).filter((finding) => finding.code === "transfer-out-of-bounds")).toEqual([]);
    expect(scriptCalls(start.events.at(-1)!.pages![0]!.commands[0], "map", p)).toEqual(["map_cave"]);
  });

  it("library effects count for the command that imports them", () => {
    const p = project();
    p.scriptLibrary = [{ id: "gates", source: "", compiled: "x", effects: effects({ writes: [{ kind: "switch", id: "sw_gate" }] }) }];
    startMap(p).events.push(
      event("ev_lever", 2, [page("p1", [script(effects({ calls: [{ kind: "library", id: "gates" }] }))])]),
      event("ev_door", 4, [page("p1", [], [{ kind: "switch", switchId: "sw_gate", value: true }])]),
    );
    expect(checkProgression(p).filter((finding) => finding.code === "page-switch-never-set")).toEqual([]);
    expect(projectScriptUsage(p).ids("write", "switch").has("sw_gate")).toBe(true);
  });

  it("a script on the event suppresses the self-switch gate judgement", () => {
    const pages = [page("p1", [script(effects({}))]), page("p2", [], [{ kind: "selfSwitch", key: "A", value: true }])];
    expect(findUnwrittenSelfSwitchGates({ pages })).toEqual([]);
  });

  it("projectLint warns (not errors) about literal script refs to missing records", () => {
    const p = project();
    startMap(p).events.push(event("ev_x", 2, [page("p1", [script(effects({ writes: [{ kind: "item", id: "item_nope" }] }))])]));
    const issues = projectLint(p, { skipRoundtrip: true }).filter((issue) => issue.code === "script-reference-missing");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("warning");
  });
});
