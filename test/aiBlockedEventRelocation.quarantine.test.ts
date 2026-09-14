import { describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import { getTool, runTool } from "@/editor/tools";
import { canMoveFootprint, isPassable } from "@/project/collision";
import { EventPlacementAnalysis, eventRelocationCandidates } from "@/project/eventPlacementRecovery";
import * as footprintQuery from "@/project/eventFootprintQuery";
import * as reachability from "@/project/lint/reachability";
import { projectLint } from "@/project/lint/projectLint";
import { rectsOverlap } from "@/project/footprint";
import { playerBodyRect, resolvePlayerBody } from "@/project/playerFootprint";
import { deserialize, serialize } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent } from "@/project/types";
import { completedHouseProject } from "./fixtures/completedHouse";
import { approvedReviewResponse, independentReviewPayload } from "./independentReviewFixture";

// Renderer endpoint double: exercises capture/delivery/currentness, not pixel quality.
const reviewImage = { label: "Relocation map render", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==" };

function relocationReviewResponse(request: ChatRequest): ChatResult | null {
  const input = independentReviewPayload(request);
  if (!input) return null;
  expect(request.tools).toEqual([]);
  expect(input.requiredProblems, JSON.stringify(input.requiredProblems)).toEqual([]);
  const parts = request.messages.flatMap(message => Array.isArray(message.content) ? message.content : []);
  expect(parts.filter(part => part.type === "image_url")).toEqual([
    { type: "image_url", image_url: { url: reviewImage.dataUrl } },
  ]);
  return approvedReviewResponse(request);
}

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
  it.each(["below", "overlap-allowed", "overhang", "solid"])("uses traversal blockers, not body reservations, for a wall sign's sole approach (%s)", kind => {
    const { context, mapId, sign } = fixture();
    const project = context.project, map = project.maps[mapId];
    project.startPos = { x: 5, y: 7 };
    sign.x = 5; sign.y = 5;
    sign.pages![0].commands = [{ kind: "setSwitch", switchId: "sw_0001", value: true }];
    const approach = structuredClone(sign);
    approach.id = "approach"; approach.y = 6;
    approach.pages![0].id = "approach_page";
    approach.pages![0].commands = [];
    approach.pages![0].priority = kind === "below" ? "below" : "same";
    approach.pages![0].overlapForbidden = kind !== "overlap-allowed";
    if (kind === "overhang") {
      approach.y = 7;
      approach.pages![0].footprint = { width: 1, height: 2 };
      approach.pages![0].passRows = 1;
      project.startPos = { x: 4, y: 7 };
    }
    map.events = [sign, approach];
    for (const [x, y] of [[5, 5], [5, 4], [4, 5], [6, 5]]) map.lowerTiles[y * map.width + x] = TILE.WALL;
    const scene = runTool(context, "run_scene_test", { mapId, start: project.startPos,
      steps: [{ kind: "walk", to: { x: 5, y: 5 }, adjacent: true }, { kind: "interact", eventId: sign.id }, { kind: "expect", switchOn: "sw_0001" }] });
    expect(scene.ok, scene.summary).toBe(true);
    expect(scene.data).toMatchObject({ ok: kind !== "solid" });
    if (kind !== "solid") expect(scene.data).toMatchObject({ finalState: { x: 5, y: 6, switchesOn: ["sw_0001"] } });
    const lint = runTool(context, "run_lint", {});
    expect(lint.issues?.some(i => i.eventId === sign.id && i.code === "event-unreachable") ?? false).toBe(kind === "solid");
    const moved = runTool(context, "move_event", { mapId, eventId: sign.id, x: 5, y: 5 });
    expect(moved.ok, moved.summary).toBe(true);
    const after = context.project.maps[mapId].events.find(event => event.id === sign.id)!;
    if (kind === "solid") expect(after.x !== 5 || after.y !== 5).toBe(true);
    else expect(after).toEqual(sign);
  });

  it.each(["below", "overlap-allowed", "overhang", "solid"])("uses passage-only traversal blockers for an NPC step while retaining full destination reservations (%s)", kind => {
    const { context, mapId, npc, sign } = fixture();
    const project = context.project, map = project.maps[mapId];
    project.startPos = { x: 3, y: 7 };
    sign.x = 5; sign.y = 6;
    sign.pages![0].priority = kind === "below" ? "below" : "same";
    sign.pages![0].overlapForbidden = kind !== "overlap-allowed";
    if (kind === "overhang") {
      sign.y = 7; sign.pages![0].footprint = { width: 1, height: 2 }; sign.pages![0].passRows = 1;
    }
    for (const [x, y] of [[5, 4], [4, 5], [6, 5]]) map.lowerTiles[y * map.width + x] = TILE.WALL;
    const analysis = new EventPlacementAnalysis(project, map);
    expect(analysis.hasMovementStep(npc)).toBe(kind !== "solid");
    expect(analysis.canOccupy({ ...npc, x: 5, y: 6 })).toBe(false);
  });

  it.each(["touch", "playerTouch"] as const)("recovers a steppable %s through the public API without recommending an unreachable directional tile", trigger => {
    const { context, mapId, sign } = fixture();
    const project = context.project, map = project.maps[mapId];
    project.startPos = { x: 5, y: 7 };
    sign.x = 6; sign.y = 6; sign.trigger = { kind: trigger };
    sign.pages![0].trigger = { kind: trigger }; sign.pages![0].priority = "below";
    sign.pages![0].commands = [{ kind: "setSwitch", switchId: "sw_0001", value: true }];
    map.events = [sign];
    const directional = project.tilesets[map.tilesetId].passability.length;
    project.tilesets[map.tilesetId].passability.push({ up: true, down: false, left: false, right: false });
    map.lowerTiles[5 * map.width + 5] = directional;
    map.lowerTiles[4 * map.width + 5] = TILE.WALL;
    const paint = runTool(context, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.WALL, cells: [{ x: 6, y: 6 }] });
    expect(paint.ok, paint.summary).toBe(true);
    const lint = runTool(context, "run_lint", {});
    const candidates = lint.issues?.find(i => i.eventId === sign.id)?.relocation?.candidates;
    expect(candidates?.length).toBeGreaterThan(0);
    expect(candidates?.some(c => c.args.x === 5 && c.args.y === 5)).toBe(false);
    const candidate = candidates![0];
    const move = runTool(context, candidate.name, candidate.args);
    expect(move.ok, move.summary).toBe(true);
    expect(move.data).toMatchObject({ x: candidate.args.x, y: candidate.args.y, adjusted: false });
    const scene = runTool(context, "run_scene_test", { mapId, start: project.startPos,
      steps: [{ kind: "walk", to: { x: candidate.args.x, y: candidate.args.y } }, { kind: "expect", switchOn: "sw_0001" }] });
    expect(scene.ok, scene.summary).toBe(true);
    expect(scene.data).toMatchObject({ ok: true, finalState: { switchesOn: ["sw_0001"] } });
    // Reintroduce the directional trap directly: own-tile passability must not
    // hide it from ordinary lint, and explicit move execution must reject it too.
    const moved = context.project.maps[mapId].events.find(e => e.id === sign.id)!;
    moved.x = 5; moved.y = 5;
    const trappedScene = runTool(context, "run_scene_test", { mapId, start: project.startPos, steps: [{ kind: "walk", to: { x: 5, y: 5 } }] });
    expect(trappedScene.data).toMatchObject({ ok: false });
    expect(runTool(context, "run_lint", {}).issues?.some(i => i.eventId === sign.id && i.code === "event-unreachable")).toBe(true);
    const retry = runTool(context, "move_event", { mapId, eventId: sign.id, x: 5, y: 5 });
    expect(retry.ok, retry.summary).toBe(true);
    expect(retry.data).toMatchObject({ adjusted: true });
  });

  it.each(["touch", "playerTouch"] as const)("keeps a reachable directional steppable %s in place and executes it", trigger => {
    const { context, mapId, sign } = fixture();
    const project = context.project, map = project.maps[mapId];
    project.startPos = { x: 5, y: 7 };
    sign.x = 5; sign.y = 5; sign.trigger = { kind: trigger };
    sign.pages![0].trigger = { kind: trigger }; sign.pages![0].priority = "below";
    sign.pages![0].commands = [{ kind: "setSwitch", switchId: "sw_0001", value: true }];
    map.events = [sign];
    const directional = project.tilesets[map.tilesetId].passability.length;
    project.tilesets[map.tilesetId].passability.push({ up: true, down: false, left: false, right: false });
    map.lowerTiles[5 * map.width + 5] = directional;
    const move = runTool(context, "move_event", { mapId, eventId: sign.id, x: 5, y: 5 });
    expect(move.ok, move.summary).toBe(true);
    expect(move.data).toMatchObject({ adjusted: false });
    expect(move.issues?.some(i => i.eventId === sign.id) ?? false).toBe(false);
    const scene = runTool(context, "run_scene_test", { mapId, start: project.startPos,
      steps: [{ kind: "walk", to: { x: 5, y: 5 } }, { kind: "expect", switchOn: "sw_0001" }] });
    expect(scene.data).toMatchObject({ ok: true, finalState: { x: 5, y: 5, switchesOn: ["sw_0001"] } });
  });

  it.each(["npc", "floor-object", "disconnected"])("reports %s enclosed without painting its own tile through AssistantSession", async kind => {
    const { context, mapId, npc, sign } = fixture();
    const map = context.project.maps[mapId];
    context.project.startPos = { x: 2, y: 5 };
    if (kind === "floor-object") npc.pages![0].graphic = structuredClone(sign.pages![0].graphic);
    else npc.pages![0].movement = { ...npc.pages![0].movement, type: "random" };
    const cells = kind === "disconnected"
      ? Array.from({ length: map.height }, (_, y) => ({ x: 4, y }))
      : [{ x: 4, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 6 }];
    sign.x = 1; sign.y = 3;
    map.lowerTiles[3 * map.width + 1] = TILE.WALL;
    const before = structuredClone(context.project);
    let round = 0, observed = false;
    const session = new AssistantSession(context.project, {
      config: { authMode: "apiKey", baseUrl: "x", model: "stub", liteModel: "stub", apiKey: "sk", maxToolCalls: 8, maxTokens: 2048 },
      renderImages: async () => [reviewImage],
      chat: async (_config, request): Promise<ChatResult> => {
        const review = relocationReviewResponse(request);
        if (review) return review;
        if (round++ === 0) return call("set_build_spec", { mapId, title: "Enclosure", assets: [{ id: "walls", kind: "terrain", x: 0, y: 0, w: map.width, h: map.height }] }, "spec");
        if (round === 2) return call("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.WALL, cells }, "paint");
        const response = request.messages.find(message => message.role === "tool" && message.tool_call_id === "paint");
        if (typeof response?.content !== "string") throw new Error("missing paint response");
        const payload = JSON.parse(response.content);
        expect(payload.ok).toBe(true);
        const issue = payload.issues?.find((entry: { eventId?: string }) => entry.eventId === npc.id);
        expect(issue?.severity).toBe("warning");
        expect(issue?.relocation.candidates.length).toBeGreaterThan(0);
        expect(payload.issues?.some((entry: { eventId?: string }) => entry.eventId === sign.id)).toBe(false);
        expect(request.tools?.some(tool => tool.function.name === "move_event")).toBe(true);
        observed = true;
        if (round === 3) return call("repair_acceptance", {
          itemId: session.getAcceptanceSnapshot()!.items[0].id,
          criteria: [{ kind: "targetChange", target: { mapId } }, { kind: "imageReviewed", target: { mapId } }],
        }, "criteria");
        if (round === 4) return call("show_map_region", { mapId, x: 0, y: 0, w: map.width, h: map.height }, "image");
        return { message: { role: "assistant", content: "Done." }, finishReason: "stop" };
      },
    });
    const result = await session.sendUserMessage("벽 타일을 지정한 영역에 칠해줘");
    expect(result.stoppedReason, result.error).not.toBe("error");
    expect(result.review?.status).toBe("approved");
    expect(observed).toBe(true);
    expect(result.proposedCalls.map(proposal => proposal.name)).toEqual(["paint_tiles"]);
    const after = session.getProposedProject().maps[mapId];
    expect(after.events).toEqual(before.maps[mapId].events);
    expect(isPassable(session.getProposedProject(), after, 5, 5)).toBe(true);
    expect(context.project).toEqual(before);
  });

  it.each([false, true])("requires a real 2x2 movement step separately from a player approach (passRows=%s)", overhang => {
    const { context, mapId, npc } = fixture();
    const project = context.project, map = project.maps[mapId];
    project.startPos = { x: 1, y: 4 };
    map.events = [npc]; map.lowerTiles.fill(TILE.WALL);
    for (let x = 0; x < map.width; x++) map.lowerTiles[4 * map.width + x] = TILE.GRASS;
    map.lowerTiles[3 * map.width + 4] = TILE.GRASS;
    map.lowerTiles[3 * map.width + 5] = TILE.GRASS;
    npc.pages![0].footprint = { width: 2, height: 2 };
    npc.pages![0].movement.type = "random";
    if (overhang) npc.pages![0].passRows = 1;
    const candidates = eventRelocationCandidates(project, map, npc).candidates;
    expect(candidates.some(c => c.args.x === 4 && c.args.y === 4)).toBe(overhang);
    if (!overhang) expect(candidates).toHaveLength(0);
    else for (const { args } of candidates) expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
      canMoveFootprint(project, map, args.x, args.y, { width: 2, height: 2 }, args.x + dx, args.y + dy, 1))).toBe(true);
  });

  it("rejects a directional dead end with open OR-passability and player approach", () => {
    const { context, mapId, npc } = fixture();
    const project = context.project, map = project.maps[mapId];
    const other = structuredClone(map); other.id = "no_entry"; project.maps[other.id] = other;
    const directional = project.tilesets[map.tilesetId].passability.length;
    project.tilesets[map.tilesetId].passability.push({ up: true, down: false, left: false, right: false });
    other.lowerTiles[4 * map.width + 4] = directional;
    other.lowerTiles[3 * map.width + 4] = TILE.WALL;
    expect(isPassable(project, other, 4, 4)).toBe(true);
    expect(eventRelocationCandidates(project, other, npc).candidates.some(c => c.args.x === 4 && c.args.y === 4)).toBe(false);
  });

  it.each([1, 3])("protects the resolved player-start body of size %s", size => {
    const { context, mapId, npc } = fixture();
    const project = context.project, map = project.maps[mapId];
    project.startPos = { x: 5, y: 5 };
    project.system.playerFootprint = { width: size, height: size };
    npc.x = 7; npc.y = 5;
    const player = playerBodyRect(resolvePlayerBody(project), 5, 5);
    const candidates = eventRelocationCandidates(project, map, npc).candidates;
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) expect(rectsOverlap(player, footprintQuery.eventBodyRect({ ...npc, ...candidate.args }))).toBe(false);
    const moved = runTool(context, "move_event", { mapId, eventId: npc.id, x: 5 + Math.floor(size / 2), y: size === 1 ? 5 : 4 });
    expect(moved.ok, moved.summary).toBe(true);
    expect(rectsOverlap(player, footprintQuery.eventBodyRect(context.project.maps[mapId].events.find(e => e.id === npc.id)!))).toBe(false);
  });

  it("revalidates recommendations consumed in one assistant batch against current occupancy", async () => {
    const { context, mapId, npc } = fixture();
    const map = context.project.maps[mapId];
    const second = { ...structuredClone(npc), id: "second", x: 6 };
    map.events = [npc, second];
    map.lowerTiles[5 * map.width + 5] = TILE.WALL;
    map.lowerTiles[5 * map.width + 6] = TILE.WALL;
    const before = structuredClone(context.project);
    let round = 0;
    const session = new AssistantSession(context.project, {
      config: { authMode: "apiKey", baseUrl: "x", model: "stub", liteModel: "stub", apiKey: "sk", maxToolCalls: 8, maxTokens: 2048 },
      renderImages: async () => [reviewImage],
      chat: async (_config, request) => {
        const review = relocationReviewResponse(request);
        if (review) return review;
        if (round++ === 0) return call("run_lint", {}, "lint");
        if (round === 2) {
          const response = request.messages.find(m => m.role === "tool" && m.tool_call_id === "lint");
          if (typeof response?.content !== "string") throw new Error("missing lint response");
          const payload = JSON.parse(response.content);
          const candidates = payload.issues.find((i: { eventId?: string }) => i.eventId === second.id).relocation.candidates;
          const first = payload.issues.find((i: { eventId?: string }) => i.eventId === npc.id).relocation.candidates.find((a: { args: { x: number; y: number } }) => candidates.some((b: { args: { x: number; y: number } }) => a.args.x === b.args.x && a.args.y === b.args.y));
          const shared = candidates.find((c: { args: { x: number; y: number } }) => c.args.x === first.args.x && c.args.y === first.args.y);
          expect(shared).toBeDefined();
          return { message: { role: "assistant", content: null, tool_calls: [first, shared].map((c, i) => ({ id: `move${i}`, type: "function" as const, function: { name: c.name, arguments: JSON.stringify(c.args) } })) }, finishReason: "tool_calls" };
        }
        // The explicit pre-move lint check is stale after either relocation.
        if (round === 3) return call("run_lint", {}, "relint");
        if (round === 4) return call("show_map_region", { mapId, x: 0, y: 0, w: map.width, h: map.height }, "image");
        return { message: { role: "assistant", content: "Done." }, finishReason: "stop" };
      },
    });
    const result = await session.sendUserMessage("막힌 NPC 둘의 위치를 이동해줘");
    expect(result.stoppedReason, result.error).not.toBe("error");
    expect(result.review?.status).toBe("approved");
    expect(result.proposedCalls.filter(c => c.name === "move_event")).toHaveLength(2);
    const [a, b] = session.getProposedProject().maps[mapId].events;
    expect(rectsOverlap(footprintQuery.eventBodyRect(a), footprintQuery.eventBodyRect(b))).toBe(false);
    expect(a).toEqual({ ...npc, x: a.x, y: a.y });
    expect(b).toEqual({ ...second, x: b.x, y: b.y });
    expect(context.project).toEqual(before);
  });

  it("retains fixed NPC semantics after uploaded graphics and a serialized reload", () => {
    const { context, mapId, sign } = fixture();
    context.project.maps[mapId].events = [sign];
    const placed = runTool(context, "place_npc", { mapId, id: "custom", x: 5, y: 5, name: "Custom", pages: [{ lines: ["Authored dialogue"] }] });
    expect(placed.ok, placed.summary).toBe(true);
    const custom = context.project.maps[mapId].events.find(e => e.id === "custom")!;
    custom.pages![0].graphic = { sprite: { type: "uploaded", id: "uploaded-charset" } };
    context.project.assets.uploaded["uploaded-charset"] = { id: "uploaded-charset", name: "Uploaded", kind: "charset", dataUrl: "data:image/png;base64,AA==", meta: {} };
    context.project.resourceProfiles.push({ kind: "charset", name: "Uploaded", assetId: "uploaded-charset" });
    context.project.maps[mapId].events.find(e => e.id === sign.id)!.pages![0].graphic = structuredClone(custom.pages![0].graphic);
    context.project = deserialize(serialize(context.project));
    const loaded = context.project.maps[mapId].events.find(e => e.id === "custom")!;
    expect(loaded.characterId).toBeUndefined();
    expect(loaded.pages![0].movement.type).toBe("fixed");
    const map = context.project.maps[mapId];
    map.lowerTiles[5 * map.width + 5] = TILE.WALL;
    const lint = runTool(context, "run_lint", {});
    expect(lint.issues?.some(i => i.eventId === "custom" && i.code === "event-character-impassable")).toBe(true);
    expect(lint.issues?.some(i => i.eventId === sign.id)).toBe(false);
    const moved = runTool(context, "move_event", { mapId, eventId: "custom", x: 5, y: 5 });
    expect(moved.ok, moved.summary).toBe(true);
    const after = context.project.maps[mapId].events.find(e => e.id === "custom")!;
    expect(isPassable(context.project, context.project.maps[mapId], after.x, after.y)).toBe(true);
    expect(after).toEqual({ ...loaded, x: after.x, y: after.y });
    expect(deserialize(serialize(context.project)).maps[mapId].events.find(e => e.id === "custom")).toEqual(after);
  });

  it.each(["occupied", "terrain", "bounds"])("revalidates the non-anchor cells of a moved body (%s)", obstacle => {
    const { context, mapId, npc, sign } = fixture();
    const map = context.project.maps[mapId];
    npc.pages![0].footprint = { width: 2, height: 2 };
    sign.x = 7; sign.y = 4;
    if (obstacle !== "occupied") map.events = [npc];
    if (obstacle === "terrain") map.lowerTiles[4 * map.width + 7] = TILE.WALL;
    const x = obstacle === "bounds" ? map.width - 1 : 6, y = 5;
    const result = runTool(context, "move_event", { mapId, eventId: npc.id, x, y });
    expect(result.ok, result.summary).toBe(true);
    const moved = context.project.maps[mapId].events.find(e => e.id === npc.id)!;
    expect(moved.x !== x || moved.y !== y).toBe(true);
    expect(moved).toEqual({ ...npc, x: moved.x, y: moved.y });
    const body = footprintQuery.eventBodyRect(moved);
    expect(body.right).toBeLessThan(map.width);
    if (obstacle === "occupied") expect(rectsOverlap(body, footprintQuery.eventBodyRect(sign))).toBe(false);
  });

  it("diagnoses a movable wide NPC's local immobility even with a reachable player approach", () => {
    const { context, mapId, npc } = fixture();
    const project = context.project, map = project.maps[mapId];
    project.startPos = { x: 1, y: 4 }; map.events = [npc];
    npc.x = 4; npc.y = 4;
    npc.pages![0].footprint = { width: 2, height: 2 };
    npc.pages![0].movement = { ...npc.pages![0].movement, type: "random" };
    map.lowerTiles.fill(TILE.WALL);
    for (let x = 0; x < map.width; x++) map.lowerTiles[4 * map.width + x] = TILE.GRASS;
    map.lowerTiles[3 * map.width + 4] = TILE.GRASS;
    map.lowerTiles[3 * map.width + 5] = TILE.GRASS;
    const issues = projectLint(project);
    expect(issues.find(i => i.eventId === npc.id)).toMatchObject({ code: "event-immobile", severity: "warning", relocation: { candidates: [] } });
    const before = structuredClone(project);
    const result = runTool(context, "move_event", { mapId, eventId: npc.id, x: 4, y: 4 });
    expect(result.ok).toBe(false);
    expect(result.issues?.some(i => i.code === "move-event-impassable")).toBe(true);
    expect(context.project).toEqual(before);
  });

  it("validates the optional placement role at the persistence boundary without inferring legacy custom sprites", () => {
    const { context, npc } = fixture();
    npc.pages![0].graphic = { transparent: true };
    expect(deserialize(serialize(context.project)).maps[context.project.startMapId].events[0].placementRole).toBeUndefined();
    const wire = JSON.parse(serialize(context.project));
    wire.maps[context.project.startMapId].events[0].placementRole = "invalid";
    expect(() => deserialize(JSON.stringify(wire))).toThrow();
  });

  it("shares event candidates between duplicate diagnostics and reuses an explicit entry flood", () => {
    const { context, mapId, npc } = fixture();
    const project = context.project, map = project.maps[mapId];
    npc.pages![0].footprint = { width: 2, height: 2 };
    for (let y = 3; y <= 6; y++) for (let x = 4; x <= 7; x++) map.lowerTiles[y * map.width + x] = TILE.WALL;
    const flood = vi.spyOn(reachability, "computeReachableCells");
    try {
      const issues = projectLint(project, { reachability: [{ mapId, from: project.startPos, targets: [{ x: npc.x, y: npc.y }] }] }).filter(i => i.eventId === npc.id);
      expect(issues.map(i => i.code)).toEqual(["event-character-impassable", "event-footprint-impassable", "reachability"]);
      expect(flood).toHaveBeenCalledTimes(1);
      expect(issues[0].relocation).toBe(issues[1].relocation);
      expect(issues[0].relocation).toBe(issues[2].relocation);
    } finally { flood.mockRestore(); }
  });

  it("shares lazy flood and body scans within lint, but refreshes after mutations", () => {
    const { context, mapId, npc } = fixture();
    const project = context.project, map = project.maps[mapId];
    map.width = 40; map.height = 40;
    map.lowerTiles = Array(1600).fill(TILE.GRASS); map.upperTiles = Array(1600).fill(TILE.EMPTY);
    project.startPos = { x: 1, y: 1 };
    map.events = Array.from({ length: 20 }, (_, i) => ({ ...structuredClone(npc), id: `npc${i}`, x: 5 + i % 5 * 5, y: 5 + Math.floor(i / 5) * 5 }));
    for (const event of map.events) map.lowerTiles[event.y * map.width + event.x] = TILE.WALL;
    const flood = vi.spyOn(reachability, "computeReachableCells");
    const bodies = vi.spyOn(footprintQuery, "eventBodyRect");
    try {
      const issues = projectLint(project);
      expect(issues.filter(i => i.code === "event-character-impassable")).toHaveLength(20);
      expect(flood).toHaveBeenCalledTimes(1);
      expect(bodies.mock.calls.length).toBeLessThan(20 * 15);
      const first = issues.find(i => i.eventId === "npc0")!.relocation!.candidates[0];
      map.lowerTiles[first.args.y * map.width + first.args.x] = TILE.WALL;
      const refreshed = projectLint(project).find(i => i.eventId === "npc0")!.relocation!;
      expect(flood).toHaveBeenCalledTimes(2);
      expect(refreshed.candidates.some(c => c.args.x === first.args.x && c.args.y === first.args.y)).toBe(false);
      map.events = [];
      projectLint(project);
      expect(flood).toHaveBeenCalledTimes(2);
    } finally { flood.mockRestore(); bodies.mockRestore(); }
  });

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
      renderImages: async () => [reviewImage],
      chat: async (_config, request): Promise<ChatResult> => {
        const review = relocationReviewResponse(request);
        if (review) return review;
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
        if (round === (relocate ? 4 : 3)) return call("repair_acceptance", {
          itemId: session.getAcceptanceSnapshot()!.items[0].id,
          criteria: [{ kind: "targetChange", target: { mapId } }, { kind: "imageReviewed", target: { mapId } }],
        }, "criteria");
        if (round === (relocate ? 5 : 4)) {
          const map = session.getProposedProject().maps[mapId];
          return call("show_map_region", { mapId, x: 0, y: 0, w: map.width, h: map.height }, "image");
        }
        return { message: { role: "assistant", content: "Done." }, finishReason: "stop" };
      },
    });
    // When: an assistant terrain edit yields diagnostics and the assistant chooses relocation.
    const result = await session.sendUserMessage("벽 타일을 (5,5)에 칠해줘");
    // Then: recovery is a real proposal, not a silent mutation of terrain or source data.
    expect(result.stoppedReason, result.error).not.toBe("error");
    expect(result.review?.status).toBe("approved");
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

  it("preserves an explicit reachability origin through the real move and scene interaction", () => {
    // Given: a wall divides two otherwise walkable areas.
    const { context, mapId, npc } = fixture();
    const map = context.project.maps[mapId];
    context.project.startPos = { x: 2, y: 5 };
    npc.x = 3; npc.y = 5;
    npc.pages![0].commands = [{ kind: "setSwitch", switchId: "sw_0001", value: true }];
    const before = structuredClone(npc);
    const from = { x: 6, y: 5 };
    for (let y = 0; y < map.height; y++) map.lowerTiles[y * map.width + 4] = TILE.WALL;
    const result = runTool(context, "run_lint", { reachability: [{ mapId, from, targets: [{ x: npc.x, y: npc.y }] }] });
    const issue = result.issues?.find(entry => entry.code === "reachability" && entry.eventId === npc.id);
    expect(issue?.relocation?.candidates.length).toBeGreaterThan(0);
    const candidate = issue!.relocation!.candidates[0];
    const move = runTool(context, candidate.name, candidate.args);
    expect(move.ok, move.summary).toBe(true);
    expect(move.data).toMatchObject({ x: candidate.args.x, y: candidate.args.y, adjusted: false });
    expect(candidate.args).toMatchObject({ x: 5, y: 3, from });
    expect(context.project.maps[mapId].events.find(e => e.id === npc.id)).toEqual({ ...before, x: 5, y: 3 });
    const relint = runTool(context, "run_lint", { reachability: [{ mapId, from, targets: [{ x: 5, y: 3 }] }] });
    expect(relint.issues?.some(i => i.code === "reachability" && i.eventId === npc.id) ?? false).toBe(false);
    const scene = runTool(context, "run_scene_test", { mapId, start: from,
      steps: [{ kind: "walk", to: { x: 5, y: 3 }, adjacent: true }, { kind: "interact", eventId: npc.id }, { kind: "expect", switchOn: "sw_0001" }] });
    expect(scene.ok, scene.summary).toBe(true);
    expect(scene.data).toMatchObject({ ok: true, finalState: { switchesOn: ["sw_0001"] } });
  });

  it.each([null, {}, { x: 6 }, { x: "invalid", y: 5 }, { x: 6.5, y: 5 }, { x: NaN, y: 5 }, { x: Infinity, y: 5 }, { x: -1, y: 5 }, { x: 999, y: 5 }, { x: 4, y: 5 }])("rejects an invalid explicit move origin without modifying the project (%j)", from => {
    const { context, mapId, npc } = fixture();
    const map = context.project.maps[mapId];
    map.lowerTiles[5 * map.width + 4] = TILE.WALL;
    const before = structuredClone(context.project);
    const result = runTool(context, "move_event", { mapId, eventId: npc.id, x: 7, y: 3, from });
    expect(result.ok).toBe(false);
    expect(result.issues?.some(i => i.code === "invalid-args" || i.code === "move-event-origin-invalid")).toBe(true);
    expect(context.project).toEqual(before);
  });

  it("exposes the optional origin schema and retains the omitted-origin start component", () => {
    expect(getTool("move_event")?.parameters.properties?.from).toMatchObject({ type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] });
    expect(getTool("move_event")?.parameters.required).not.toContain("from");
    const { context, mapId, npc } = fixture();
    const map = context.project.maps[mapId];
    context.project.startPos = { x: 2, y: 5 };
    npc.x = 3;
    for (let y = 0; y < map.height; y++) map.lowerTiles[y * map.width + 4] = TILE.WALL;
    const result = runTool(context, "move_event", { mapId, eventId: npc.id, x: 5, y: 3 });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ x: 3, y: 1, adjusted: true });
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
