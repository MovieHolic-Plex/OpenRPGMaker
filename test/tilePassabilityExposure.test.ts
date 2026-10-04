import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { LlmError, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { injectToolReasonSchema } from "@/ai/toolReason";
import { allTools, getTool, runTool, toOpenAiTools, validateArgs } from "@/editor/tools";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { applyCombinedTownHarness } from "@/project/tilesetHarness";
import type { Project, TilesetDef } from "@/project/types";

const SETTER = "set_tile_passability";
const TILESET = "passage_fixture";
const CONFIG = {
  authMode: "apiKey" as const, agentMode: "chat" as const,
  baseUrl: "x", model: "fixture", liteModel: "fixture", apiKey: "sk",
  maxToolCalls: 4, maxTokens: 512,
};
const SEMANTIC_TOOLS = [
  "set_tile_metadata", "upsert_tile_group", "delete_tile_group",
  "set_group_junction", "set_group_overlay", "set_cluster_rule", "upsert_palette_preset",
  "set_group_layout", "suggest_group_from_range", "propose_tile_vocabulary",
];
const LEGACY_PAINT_TOOLS = ["clear_region", "scatter_object", "stamp_structure"];

function passage(passable: boolean) {
  return { up: passable, down: passable, left: passable, right: passable };
}

// Three cells/three chips; no authored project, store, browser, or remote persistence.
function fixture(initialPassable = false): Project {
  const project = createBlankProject();
  const tileset: TilesetDef = {
    id: TILESET, name: "Passage fixture", image: project.tilesets[COMBINED_TOWN_TILESET_ID].image,
    tileSize: 16, tilesPerRow: 3, count: 3,
    passability: [passage(true), passage(initialPassable), passage(true)],
    priority: ["lower", "lower", "lower"], terrain: [0, 0, 0],
    tileMeta: [
      { label: "ground", description: "", source: "user", userLocked: true },
      { label: "existing label", description: "existing description", source: "ai", origin: "ai", defaultLayer: "lower", tags: ["existing-tag"] },
      { label: "untouched", description: "neighbor", source: "ai", origin: "ai", confidence: 0.5 },
    ],
    tileGroups: [], palettePresets: [],
  };
  project.tilesets = { [TILESET]: tileset };
  const map = project.maps[project.startMapId];
  Object.assign(map, { width: 3, height: 1, tilesetId: TILESET, lowerTiles: [0, 1, 2], upperTiles: [-1, -1, -1], events: [] });
  project.startPos = { x: 0, y: 0 };
  return project;
}

function call(name: string, args: Record<string, unknown>): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [
      { id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify({ ...args, reason: "fixture passage operation" }) } },
    ] }, finishReason: "tool_calls",
  } as ChatResult;
}
function final(): ChatResult {
  return { message: { role: "assistant", content: "Done." }, finishReason: "stop" } as ChatResult;
}

function expectOnlyPassageChanged(before: Project, after: Project, passable: boolean) {
  const expected = structuredClone(before);
  const tileset = expected.tilesets[TILESET];
  tileset.passability[1] = passage(passable);
  const { defaultLayer: _inheritedLayer, ...meta } = tileset.tileMeta![1];
  tileset.tileMeta![1] = {
    ...meta, passage: passable ? "passable" : "solid",
    confidence: 1, locked: true, origin: "user", source: "user", userLocked: true,
  };
  // Full equality protects all other chips, labels, groups, maps and project metadata.
  expect(after).toEqual(expected);
  expect(isPassable(after, after.maps[after.startMapId], 1, 0)).toBe(passable);
}

describe("public technical tile passage capability", () => {
  it("exposes the existing native setter with only its typed passage fields", () => {
    const registered = getTool(SETTER)!;
    expect(registered.run).toBe(MAP_TOOLS.find(tool => tool.name === SETTER)!.run);
    expect(allTools().filter(tool => tool.name === SETTER)).toEqual([registered]);
    const exposed = toOpenAiTools().find(tool => tool.function.name === SETTER);
    expect(exposed).toBeDefined();
    expect(registered.deprecated).not.toBe(true);
    expect(registered.supersededBy).toBeUndefined();
    expect(registered.mode).toBe("write");
    expect(exposed!.function.parameters).toEqual(injectToolReasonSchema(registered.parameters));
    expect(Object.keys(exposed!.function.parameters.properties!).sort()).toEqual(["passable", "reason", "tile", "tilesetId"]);
    expect(registered.parameters).toMatchObject({
      type: "object", required: ["tile", "passable"], properties: {
        tilesetId: { type: "string" }, tile: { type: "integer" }, passable: { type: "boolean" },
      },
    });
  });

  it.each([SETTER, "특정 타일 통행"])("find_tools discovers the same registered schema via %s", query => {
    const result = runTool({ project: fixture() }, "find_tools", { query });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ matches: expect.arrayContaining([
      expect.objectContaining({ name: SETTER, mode: "write", parameters: getTool(SETTER)!.parameters }),
    ]) });
  });

  it("exposes runtime layer rules without substituting a vocabulary proposal", () => {
    const name = "set_tile_rules";
    expect(toOpenAiTools().some(tool => tool.function.name === name)).toBe(true);
    const context = { project: fixture() };
    const discovery = runTool(context, "find_tools", { query: name });
    expect(discovery.data).toMatchObject({ matches: expect.arrayContaining([
      expect.objectContaining({ name, parameters: getTool(name)!.parameters }),
    ]) });
    const args = { tilesetId: TILESET, entries: [{ tile: 1, layer: "upper" }] };
    const before = structuredClone(context.project);
    expect(runTool(context, name, args).ok).toBe(false);
    expect(context.project).toEqual(before);
    expect(runTool(context, name, { ...args, confirmedByUser: true }).ok).toBe(true);
    expect(context.project.tilesets[TILESET].priority[1]).toBe("upper");
    expect(context.project.maps).toEqual(before.maps);
  });

  it("keeps semantic teaching and superseded painting hidden", () => {
    const names = toOpenAiTools().map(tool => tool.function.name);
    for (const name of [...SEMANTIC_TOOLS, ...LEGACY_PAINT_TOOLS]) {
      expect(getTool(name)?.deprecated, name).toBe(true);
      expect(names, name).not.toContain(name);
      const result = runTool({ project: fixture() }, "find_tools", { query: name });
      const matches = (result.data as { matches: { name: string }[] }).matches;
      expect(matches.map(match => match.name), name).not.toContain(name);
    }
  });

  it.each([true, false])("dispatches discovered passage=%s through an ordinary detached session", async passable => {
    const project = fixture(!passable);
    const before = structuredClone(project);
    const requests: ChatRequest[] = [];
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: async (_config, request) => {
        requests.push(request);
        if (requests.length === 1) return call("find_tools", { query: SETTER, limit: 1 });
        if (requests.length === 2) {
          const discovery = request.messages.findLast(message => message.role === "tool" && message.name === "find_tools");
          expect(JSON.parse(discovery!.content as string)).toMatchObject({ ok: true, data: { matches: [
            expect.objectContaining({ name: SETTER, parameters: getTool(SETTER)!.parameters }),
          ] } });
          // Do not inject an unexposed operation: require the actual working schema first.
          expect(request.tools?.find(tool => tool.function.name === SETTER)).toEqual(toOpenAiTools().find(tool => tool.function.name === SETTER));
          return call(SETTER, { tilesetId: TILESET, tile: 1, passable });
        }
        // End at the post-dispatch request, not a fabricated final acceptance/apply.
        if (requests.length === 3) throw new LlmError("fixture-dispatch-observed", 422);
        throw new Error("Unexpected extra model request");
      },
    });
    const result = await session.sendUserMessage(`Set chip 1 physical passage to ${passable}. Keep its semantic vocabulary.`, event => events.push(event));
    expect(result.stoppedReason).toBe("error");
    expect(result.error).toBe("fixture-dispatch-observed");
    expect(requests).toHaveLength(3);
    expect(requests[0].tools?.some(tool => tool.function.name === SETTER)).toBe(true);
    expect(events.filter(event => event.type === "tool_call")).toMatchObject([
      { name: "find_tools", result: { ok: true } },
      { name: SETTER, result: { ok: true, data: { tilesetId: TILESET, tile: 1, passable } } },
    ]);
    expect(result.proposedCalls).toHaveLength(1);
    expect(result.proposedCalls[0]).toMatchObject({ name: SETTER, destructive: false, requiresApproval: false });
    expectOnlyPassageChanged(before, session.getProposedProject(), passable);
    expectOnlyPassageChanged(before, JSON.parse(JSON.stringify(session.getProposedProject())) as Project, passable);
    expect(project).toEqual(before);
  });

  it("retains ask-mode exposure and execution refusal for this write", async () => {
    const project = fixture();
    const events: SessionEvent[] = [];
    const requests: ChatRequest[] = [];
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: async (_config, request) => {
        requests.push(request);
        return requests.length === 1 ? call(SETTER, { tilesetId: TILESET, tile: 1, passable: true }) : final();
      },
    });
    const result = await session.sendUserMessage("Is chip 1 passable?", event => events.push(event), undefined, { composerMode: "ask" });
    expect(requests[0].tools?.some(tool => tool.function.name === SETTER)).toBe(false);
    expect(events.filter(event => event.type === "tool_call")).toMatchObject([
      { name: SETTER, result: { ok: false, issues: [expect.objectContaining({ code: "composer-mode-ask" })] } },
    ]);
    expect(result.proposedCalls).toEqual([]);
    expect(session.getProposedProject()).toEqual(project);
  });

  it.each([
    [{ tile: 1 }, "invalid-args"],
    [{ tile: 1.5, passable: true }, "invalid-args"],
    [{ tile: 1, passable: {} }, "invalid-args"],
    [{ tile: -1, passable: true }, "tile-out-of-range"],
    [{ tile: 3, passable: true }, "tile-out-of-range"],
    [{ tilesetId: "missing", tile: 1, passable: true }, "tileset-not-found"],
  ] as const)("preserves native validation and atomic refusal: %j", (args, code) => {
    const project = fixture();
    const context = { project };
    const result = runTool(context, SETTER, { tilesetId: TILESET, ...args });
    expect(result).toMatchObject({ ok: false, issues: [expect.objectContaining({ code })] });
    expect(context.project).toBe(project);
  });

  it("keeps the native passage metadata through JSON reload and bundled harness reapplication", () => {
    const context = { project: createBlankProject() };
    const schema = toOpenAiTools().find(tool => tool.function.name === SETTER);
    expect(schema).toBeDefined();
    const args = { tile: 342, passable: true, reason: "repair physical passage" };
    expect(validateArgs(schema!.function.parameters, args)).toEqual([]);
    const before = structuredClone(context.project.tilesets[COMBINED_TOWN_TILESET_ID]);
    expect(runTool(context, SETTER, { tile: 342, passable: true }).ok).toBe(true);
    const reloaded = JSON.parse(JSON.stringify(context.project)) as Project;
    const tileset = reloaded.tilesets[COMBINED_TOWN_TILESET_ID];
    const target = structuredClone(tileset.tileMeta![342]);
    expect(target).toMatchObject({ passage: "passable", origin: "user", source: "user", locked: true, userLocked: true });
    applyCombinedTownHarness(tileset);
    expect(tileset.passability[342]).toEqual(passage(true));
    expect(tileset.tileMeta![342]).toEqual(target);
    expect(tileset.passability[343]).toEqual(before.passability[343]);
    expect(tileset.tileMeta![343]).toEqual(before.tileMeta![343]);
    expect(tileset.tileGroups).toEqual(before.tileGroups);
  });
});
