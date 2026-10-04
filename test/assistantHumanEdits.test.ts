import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, GameMap } from "@/project/types";
import type { ProjectChangeDescriptor } from "@/project/store";
import { createAssistantHumanEdits } from "@/editor/assistantHumanEdits";
import fixture from "./fixtures/projects/event-pages-v3.json";

const state = vi.hoisted(() => ({ project: null as unknown as Project, lineage: 1, listeners: new Set<(p: Project, c: ProjectChangeDescriptor) => void>() }));
vi.mock("@/project/store", () => ({ store: {
  getCurrent: () => state.project, getVersionToken: () => ({ lineage: state.lineage }), getProjectIdentity: () => ({ id: "fixture" }),
  subscribe(listener: (p: Project, c: ProjectChangeDescriptor) => void) { state.listeners.add(listener); return () => state.listeners.delete(listener); },
} }));
const mapId = "map_page";
function publish(project: Project, change: ProjectChangeDescriptor) { state.project = project; for (const listener of state.listeners) listener(project, change); }
function edit(mutator: (map: GameMap) => void, change: ProjectChangeDescriptor) { const next = structuredClone(state.project); mutator(next.maps[mapId]); publish(next, change); }
beforeEach(() => { state.project = structuredClone(fixture) as unknown as Project; state.lineage = 1; state.listeners.clear(); });

describe("human cell intent lasts for one AI request", () => {
  it("survives adopted ACK baselines and protects all layers while neighbors advance", () => {
    const guard = createAssistantHumanEdits();
    edit(map => { map.lowerTiles[0] = 2; map.upperOverlayTiles = [4, -1, -1, -1]; map.shadowBits = [3, 0, 0, 0]; },
      { scope: "map", mapId, cells: [{ x: 0, y: 0, layer: "lower" }] });
    for (const tile of [1, 3, 5]) {
      const proposal = structuredClone(state.project); // ACK has already adopted the human edit.
      proposal.maps[mapId].lowerTiles[0] = tile;
      proposal.maps[mapId].upperOverlayTiles![0] = 8;
      proposal.maps[mapId].shadowBits![0] = 0;
      proposal.maps[mapId].lowerTiles[1] = tile;
      const result = guard.protect(proposal, state.project);
      expect(result.preservedCells).toBe(1);
      expect(result.project.maps[mapId]).toMatchObject({ lowerTiles: [2, tile, expect.anything(), expect.anything()], upperOverlayTiles: [4, -1, -1, -1], shadowBits: [3, 0, 0, 0] });
      expect(proposal.maps[mapId].lowerTiles[0]).toBe(tile); // candidate was not mutated.
      publish(result.project, { scope: "project", origin: "ai" });
    }
    guard.dispose();
    const nextRequest = createAssistantHumanEdits();
    const proposal = structuredClone(state.project); proposal.maps[mapId].lowerTiles[0] = 9;
    expect(nextRequest.protect(proposal, state.project).project).toBe(proposal);
    nextRequest.dispose(); expect(state.listeners.size).toBe(0);
  });
  it("same-value strokes retain intent; undo without cell descriptors is tracked", () => {
    const guard = createAssistantHumanEdits();
    publish(state.project, { scope: "map", mapId, cells: [{ x: 0, y: 0, layer: "lower" }] });
    edit(map => { map.lowerTiles[1] = 6; }, { scope: "project", label: "되돌리기" });
    const proposal = structuredClone(state.project); proposal.maps[mapId].lowerTiles[0] = 8; proposal.maps[mapId].lowerTiles[1] = 8;
    expect(guard.protect(proposal, state.project).preservedCells).toBe(2);
    guard.dispose();
  });
  it("retains height, ramp and wall decoration without freezing other cells", () => {
    const guard = createAssistantHumanEdits();
    edit(map => { map.relief = { width: 2, height: 2, levels: [2, 0, 0, 0], ramps: [1, 0, 0, 0], wallDecor: [{ x: 0, y: 0, row: 1, tile: 2 }] }; }, { scope: "map", mapId, relief: true });
    const proposal = structuredClone(state.project); proposal.maps[mapId].relief = { width: 2, height: 2, levels: [0, 3, 0, 0] };
    const result = guard.protect(proposal, state.project);
    expect(result.project.maps[mapId].relief).toMatchObject({ levels: [2, 3, 0, 0], ramps: [1, 0, 0, 0], wallDecor: [{ x: 0, y: 0, row: 1, tile: 2 }] });
    guard.dispose();
  });
  it("refuses deletion/resize of protected cells and retires on project switch", () => {
    const guard = createAssistantHumanEdits();
    edit(map => { map.lowerTiles[0] = 2; }, { scope: "map", mapId, cells: [{ x: 0, y: 0, layer: "lower" }] });
    const proposal = structuredClone(state.project); delete proposal.maps[mapId];
    expect(guard.protect(proposal, state.project).issue).toBeTruthy();
    state.lineage++;
    publish(structuredClone(state.project), { scope: "project", origin: "system", projectSwitch: true });
    expect(guard.protect(proposal, state.project).issue).toContain("프로젝트");
    guard.dispose();
  });
});
