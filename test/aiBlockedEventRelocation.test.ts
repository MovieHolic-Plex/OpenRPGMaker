import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { runTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent } from "@/project/types";
import { completedHouseProject } from "./fixtures/completedHouse";

function fixture() {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  const npc: GameEvent = {
    id: "guard", x: 5, y: 5, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: "guard_page", name: "Guard", conditions: [],
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } },
      trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "Authored dialogue" }],
    }],
  };
  const sign: GameEvent = {
    ...structuredClone(npc), id: "sign", x: 9, y: 5,
    pages: npc.pages?.map(page => ({ ...page, id: "sign_page",
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" } },
    })),
  };
  map.events.push(npc, sign);
  map.lowerTiles[sign.y * map.width + sign.x] = TILE.WALL;
  return { context: { project }, mapId, npc, sign };
}

function call(name: string, args: unknown, id: string): ChatResult {
  return { message: { role: "assistant", content: null,
    tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
  }, finishReason: "tool_calls" };
}

describe("AI blocked entity relocation", () => {
  it("moves a fixed character off a wall without treating an accessible wall object as a character", () => {
    // Given: a character and an authored wall object, both with action pages.
    const { context, mapId, npc, sign } = fixture();
    context.project.maps[mapId].lowerTiles[5 * context.project.maps[mapId].width + 5] = TILE.WALL;
    const before = structuredClone(context.project);
    // When: the real recovery tool is asked to resolve the blocked character's position.
    const result = runTool(context, "move_event", { mapId, eventId: npc.id, x: 5, y: 5 });
    // Then: only its coordinates change; the wall object and terrain survive.
    expect(result.ok, result.summary).toBe(true);
    const after = context.project.maps[mapId];
    const moved = after.events.find(event => event.id === npc.id);
    if (!moved) throw new Error("missing guard");
    expect(isPassable(context.project, after, moved.x, moved.y)).toBe(true);
    expect(moved).toEqual({ ...npc, x: moved.x, y: moved.y });
    expect(after.events.find(event => event.id === sign.id)).toEqual(sign);
    expect(after.lowerTiles).toEqual(before.maps[mapId].lowerTiles);
    expect(after.upperTiles).toEqual(before.maps[mapId].upperTiles);
  });

  it.each([true, false])("delivers relocation after terrain strands an NPC, without forcing the choice (relocate=%s)", async (relocate) => {
    // Given: no entity-edit request and an untouched authored project.
    const { context, mapId, npc, sign } = fixture();
    const before = structuredClone(context.project);
    let round = 0;
    let destination: { x: number; y: number } | undefined;
    let paintedTiles: { lowerTiles: number[]; upperTiles: number[] } | undefined;
    const session = new AssistantSession(context.project, {
      config: { authMode: "apiKey", baseUrl: "x", model: "stub", liteModel: "stub", apiKey: "sk", maxToolCalls: 8, maxTokens: 2048 },
      chat: async (_config, request) => {
        if (round++ === 0) return call("set_build_spec", {
          mapId, title: "Wall", assets: [{ id: "wall", kind: "terrain", x: 5, y: 5, w: 1, h: 1 }],
        }, "spec");
        if (round === 2) return call("paint_tiles", {
          mapId, layer: "lower", mode: "cells", tile: TILE.WALL, cells: [{ x: 5, y: 5 }],
        }, "paint");
        if (round === 3) {
          const response = request.messages.find(message => message.role === "tool" && message.tool_call_id === "paint");
          if (typeof response?.content !== "string") throw new Error("missing JSON tool response");
          const payload = JSON.parse(response.content);
          expect(payload?.ok, JSON.stringify(payload)).toBe(true);
          const issue = payload.issues?.find((entry: { code: string }) => entry.code === "event-character-impassable");
          expect(issue?.relocation).toMatchObject({ eventId: npc.id, searchRadius: 3 });
          const candidate = issue.relocation.candidates[0];
          expect(candidate).toMatchObject({ name: "move_event", args: { mapId, eventId: npc.id } });
          expect(request.tools?.some(tool => tool.function.name === "move_event")).toBe(true);
          if (relocate) destination = candidate.args;
          const painted = session.getProposedProject().maps[mapId];
          paintedTiles = { lowerTiles: [...painted.lowerTiles], upperTiles: [...painted.upperTiles] };
          if (relocate) return call(candidate.name, candidate.args, "relocate");
        }
        return { message: { role: "assistant", content: "Done." }, finishReason: "stop" };
      },
    });
    // When: an assistant terrain edit yields diagnostics and the assistant chooses relocation.
    const result = await session.sendUserMessage("벽 타일을 (5,5)에 칠해줘");
    // Then: recovery is a real proposal, not a silent mutation of terrain or source data.
    expect(result.stoppedReason, result.error).not.toBe("error");
    expect(result.proposedCalls.map(proposal => proposal.name)).toEqual(relocate ? ["paint_tiles", "move_event"] : ["paint_tiles"]);
    const after = session.getProposedProject().maps[mapId];
    expect(after.events.find(event => event.id === npc.id)).toEqual(destination ? { ...npc, x: destination.x, y: destination.y } : npc);
    expect(after.events.find(event => event.id === sign.id)).toEqual(sign);
    expect(isPassable(session.getProposedProject(), after, 5, 5)).toBe(false);
    expect({ lowerTiles: after.lowerTiles, upperTiles: after.upperTiles }).toEqual(paintedTiles);
    expect(context.project).toEqual(before);
  });

  it("keeps an accessible wall sign in place when explicitly moved to its own tile", () => {
    // Given / When: a valid wall-mounted object passes through the actual move tool.
    const { context, mapId, sign } = fixture();
    const result = runTool(context, "move_event", { mapId, eventId: sign.id, x: sign.x, y: sign.y });
    // Then: its sprite is not mistaken for a character, and no repair is suggested.
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps[mapId].events.find(event => event.id === sign.id)).toEqual(sign);
    expect(result.issues?.some(issue => issue.relocation?.eventId === sign.id) ?? false).toBe(false);
  });

  it("offers a real move for a sealed wall object while lint itself leaves authored data untouched", () => {
    // Given: the object's own cell and all approach cells are walls.
    const { context, mapId, sign } = fixture();
    const map = context.project.maps[mapId];
    for (let y = 4; y <= 6; y++) for (let x = 8; x <= 10; x++) map.lowerTiles[y * map.width + x] = TILE.WALL;
    const before = structuredClone(context.project);
    // When: existing result validation is queried.
    const lint = runTool(context, "run_lint", {});
    const issue = lint.issues?.find(entry => entry.code === "event-unreachable" && entry.eventId === sign.id);
    // Then: candidates use the existing entity, not replacement or collision edits.
    expect(issue?.severity).toBe("warning");
    expect(context.project).toEqual(before);
    const candidate = issue?.relocation?.candidates[0];
    if (!candidate) throw new Error("missing object relocation candidate");
    const moved = runTool(context, candidate.name, candidate.args);
    expect(moved.ok, moved.summary).toBe(true);
    expect(context.project.maps[mapId].events.find(event => event.id === sign.id)).toEqual({ ...sign, x: candidate.args.x, y: candidate.args.y });
    expect(context.project.maps[mapId].lowerTiles).toEqual(before.maps[mapId].lowerTiles);
  });

  it("reports no candidate rather than inventing a landing when radius three is sealed", () => {
    // Given: no safe local landing and an unrelated, accessible wall sign.
    const { context, mapId, npc } = fixture();
    const map = context.project.maps[mapId];
    for (let y = 2; y <= 8; y++) for (let x = 2; x <= 8; x++) map.lowerTiles[y * map.width + x] = TILE.WALL;
    const before = structuredClone(context.project);
    // When / Then: read-only diagnostics remain actionable without claiming a solution.
    const result = runTool(context, "run_lint", {});
    expect(result.issues?.find(issue => issue.eventId === npc.id)?.relocation).toEqual({ eventId: npc.id, searchRadius: 3, candidates: [] });
    expect(context.project).toEqual(before);
  });

  it("uses the requested reachability component for a disconnected event's candidates", () => {
    // Given: a wall divides two otherwise walkable areas.
    const { context, mapId, npc } = fixture();
    const map = context.project.maps[mapId];
    for (let y = 0; y < map.height; y++) map.lowerTiles[y * map.width + 4] = TILE.WALL;
    // When: the caller explicitly checks the event from the left component.
    const result = runTool(context, "run_lint", { reachability: [{ mapId, from: { x: 2, y: 5 }, targets: [{ x: npc.x, y: npc.y }] }] });
    // Then: relocation is suggested onto the requested component, not another nearby pocket.
    const issue = result.issues?.find(entry => entry.code === "reachability" && entry.eventId === npc.id);
    expect(issue?.relocation?.candidates.length).toBeGreaterThan(0);
    expect(issue?.relocation?.candidates.every(candidate => candidate.args.x < 4)).toBe(true);
  });

  it("preserves completed-house tiles and metadata when recovering an existing NPC", () => {
    // Given: the NPC is stranded inside existing protected geometry.
    const { npc } = fixture();
    const context = { project: completedHouseProject() };
    const mapId = context.project.startMapId;
    const map = context.project.maps[mapId];
    map.events.push({ ...npc, x: 4, y: 4 });
    const before = structuredClone(map);
    const candidate = runTool(context, "run_lint", {}).issues?.find(issue => issue.eventId === npc.id)?.relocation?.candidates[0];
    if (!candidate) throw new Error("missing house relocation candidate");
    // When: the real write path applies the chosen candidate with house guards active.
    const result = runTool(context, candidate.name, candidate.args);
    // Then: no construction repair or authored event replacement occurred.
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps[mapId]).toEqual({ ...before, events: [{ ...before.events[0], x: candidate.args.x, y: candidate.args.y }] });
  });
});
