import { describe, expect, it } from "vitest";
import {
  getMapEditHistoryDebugEntries,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { getAgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { clipMapCellsToRegion } from "@/editor/regionTask/clipToRegion";
import { composePartialProject } from "@/editor/regionTask/partialApplyCompose";
import { groupRegionChanges } from "@/editor/regionTask/regionChangeGroups";
import {
  advanceRoomDraft,
  listRoomDrafts,
  rerollRoomDraft,
  setRoomDraftLock,
  startInteriorRoomDraft,
} from "@/editor/roomHarness/facade";
import { setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { runDirectInteriorRoomDraft } from "@/editor/regionTask/runDirectRoomDraft";
import { reviewRegionDraft, type HarnessReviewReport } from "@/editor/regionTask/harnessReview";
import { createBlankProject } from "@/project/defaults";
import { INTERIOR_ROOM_SESSION_TOOLS } from "@/editor/tools/interiorRoomSession";
import { runToolDefinition } from "@/editor/tools/toolRunner";
import { parseInteriorPlan } from "@/editor/roomHarness/interiorKit";
import { INTERIOR_ROOM_THEME_CATALOG, INTERIOR_SEMANTIC_TILE_CATALOG } from "@/editor/interiorRoomPipeline";
import type { Command, Project } from "@/project/types";

const REGION = { x: 0, y: 0, width: 4, height: 4 } as const;

function clearReport(): HarnessReviewReport {
  return {
    issues: [],
    metrics: {
      changedCells: 0,
      changedEvents: 0,
      passableChangedCells: 0,
      isolatedChangedCells: 0,
      scheduledNpcs: 0,
      scheduleEntries: 0,
      timeSystemEnabled: false,
      roomSessions: 0,
      roomScoreAverage: null,
    },
  };
}

describe("detached room harness facade", () => {
  it("keeps sessions out of Project JSON while transferring them across draft clones", () => {
    const project = createBlankProject();
    const session = startInteriorRoomDraft(project, {
      mapId: "room_detached",
      name: "Detached",
      width: 16,
      height: 12,
      rooms: [
        { id: "living", x: 2, y: 3, w: 7, h: 5, theme: "dining" },
        { id: "bedroom", x: 10, y: 3, w: 4, h: 5, theme: "bedroom" },
      ],
      innerDoors: [{ x: 9, y: 5 }],
      door: { x: 5, y: 7 },
      theme: "dining",
      seed: 88,
    });

    expect(JSON.stringify(project)).not.toContain("roomHarnessSessions");
    expect(listRoomDrafts(project)[0]?.sessionId).toBe(session.id);
    const clone = cloneDetachedDraft(project);
    expect(listRoomDrafts(clone)[0]?.sessionId).toBe(session.id);
  });

  it("records explicit checkpoints and rerolls only the selected unlocked room", () => {
    const project = createBlankProject();
    const session = startInteriorRoomDraft(project, {
      mapId: "room_reroll",
      name: "Reroll",
      width: 16,
      height: 12,
      rooms: [
        { id: "living", x: 2, y: 3, w: 7, h: 5, theme: "dining" },
        { id: "bedroom", x: 10, y: 3, w: 4, h: 5, theme: "bedroom" },
      ],
      innerDoors: [{ x: 9, y: 5 }],
      door: { x: 5, y: 7 },
      theme: "dining",
      seed: 88,
    });
    for (let guard = 0; guard < 8; guard += 1) {
      const next = advanceRoomDraft(project, session.id);
      if (Object.values(next.checklist).every((state) => state !== "open")) break;
    }
    const before = structuredClone(project.maps.room_reroll);
    const outcome = rerollRoomDraft(project, session.id, "bedroom", 101);
    expect(outcome.seed).toBe(101);
    const after = project.maps.room_reroll;
    for (let y = 0; y < after.height; y += 1) {
      for (let x = 0; x < after.width; x += 1) {
        const inBedroom = x >= 10 && x < 14 && y >= 3 && y < 8;
        if (inBedroom) continue;
        const index = y * after.width + x;
        expect(after.lowerTiles[index], `lower ${x},${y}`).toBe(before.lowerTiles[index]);
        expect(after.upperTiles[index], `upper ${x},${y}`).toBe(before.upperTiles[index]);
      }
    }
    expect(listRoomDrafts(project)[0]!.checkpoints.some((checkpoint) => checkpoint.layer === "room:bedroom")).toBe(true);

    setRoomDraftLock(project, session.id, "bedroom", true);
    expect(() => rerollRoomDraft(project, session.id, "bedroom", 102)).toThrow(/잠긴 방/);
    setRoomDraftLock(project, session.id, "bedroom", false);
    expect(() => rerollRoomDraft(project, session.id, "bedroom", 102)).not.toThrow();
  });
});

describe("quota-independent connected room draft", () => {
  it("creates a reviewed bidirectional room proposal without mutating the authored project", () => {
    const base = createBlankProject();
    const before = JSON.stringify(base);
    let applies = 0;
    const result = runDirectInteriorRoomDraft({
      mapId: base.startMapId,
      region: REGION,
      preset: "inn",
      modifier: "rustic",
      seed: 314,
    }, {
      getProject: () => base,
      applyProject: () => { applies += 1; },
    });

    expect(result.ok).toBe(true);
    expect(result.proposedCalls).toBe(0);
    expect(result.mapsAdded).toBe(1);
    expect(result.pending).toBeDefined();
    expect(JSON.stringify(base)).toBe(before);
    expect(applies).toBe(0);

    const candidate = result.pending!.clippedProject;
    const interiorMapId = Object.keys(candidate.maps).find((mapId) => !base.maps[mapId]);
    expect(interiorMapId).toBeDefined();
    const source = candidate.maps[base.startMapId]!;
    const addedDoor = source.events.find((event) => !base.maps[base.startMapId]!.events.some((beforeEvent) => beforeEvent.id === event.id));
    expect(addedDoor).toBeDefined();
    expect(addedDoor!.x).toBeGreaterThanOrEqual(REGION.x);
    expect(addedDoor!.x).toBeLessThan(REGION.x + REGION.width);
    expect(addedDoor!.y).toBeGreaterThanOrEqual(REGION.y);
    expect(addedDoor!.y).toBeLessThan(REGION.y + REGION.height);
    expect(firstTransfer(addedDoor!)?.mapId).toBe(interiorMapId);

    const interior = candidate.maps[interiorMapId!]!;
    const exit = interior.events.find((event) => event.id === `ev_entrance_${interiorMapId}`);
    expect(exit).toBeDefined();
    expect(firstTransfer(exit!)?.mapId).toBe(base.startMapId);
    // Concept composition reserves access before attaching interactions, so this
    // room no longer produces the legacy unreachable prop-inspection event.
    expect(result.review?.issues.some((issue) => issue.code === "gameplay-event-unreachable")).toBe(false);
    expect(result.pending!.roomDrafts[0]?.rooms.some((room) => room.modifiers.includes("rustic"))).toBe(true);
    result.pending!.discard();
  });

  it("applies through one full-project history entry and one undo removes both sides", () => {
    const base = createBlankProject();
    store.replace(base);
    resetMapEditHistory();
    try {
      const result = runDirectInteriorRoomDraft({
        mapId: base.startMapId,
        region: REGION,
        preset: "home",
        seed: 91,
      });
      expect(result.pending).toBeDefined();
      const candidate = result.pending!.clippedProject;
      const interiorMapId = Object.keys(candidate.maps).find((mapId) => !base.maps[mapId])!;
      const doorId = candidate.maps[base.startMapId]!.events
        .find((event) => !base.maps[base.startMapId]!.events.some((previous) => previous.id === event.id))!.id;

      expect(result.pending!.apply()).toMatchObject({ ok: true, applied: true });
      expect(store.getCurrent().maps[interiorMapId]).toBeDefined();
      expect(store.getCurrent().maps[base.startMapId]!.events.some((event) => event.id === doorId)).toBe(true);
      expect(getMapEditHistoryDebugEntries()).toEqual([
        expect.objectContaining({ kind: "project", mapId: base.startMapId }),
      ]);

      result.pending!.apply();
      expect(getMapEditHistoryDebugEntries()).toHaveLength(1);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[interiorMapId]).toBeUndefined();
      expect(store.getCurrent().maps[base.startMapId]!.events.some((event) => event.id === doorId)).toBe(false);
    } finally {
      resetMapEditHistory();
      store.replace(createBlankProject());
    }
  });

  it("fails safely when the selected region has no empty reachable doorway cell", () => {
    const base = createBlankProject();
    const map = base.maps[base.startMapId]!;
    map.events.push({
      id: "occupied-door-cell",
      x: base.startPos.x,
      y: base.startPos.y,
      trigger: "action",
      commands: [{ kind: "text", body: "occupied" }],
    } as unknown as Project["maps"][string]["events"][number]);
    const before = JSON.stringify(base);
    let applies = 0;
    const result = runDirectInteriorRoomDraft({
      mapId: base.startMapId,
      region: { x: base.startPos.x, y: base.startPos.y, width: 1, height: 1 },
      seed: 1,
    }, {
      getProject: () => base,
      applyProject: () => { applies += 1; },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("문·복귀 칸");
    expect(result.pending).toBeUndefined();
    expect(JSON.stringify(base)).toBe(before);
    expect(applies).toBe(0);
  });
});

function firstTransfer(
  event: Project["maps"][string]["events"][number],
): Extract<Command, { kind: "transfer" }> | undefined {
  return [...event.commands, ...(event.pages ?? []).flatMap((page) => page.commands)]
    .find((command): command is Extract<Command, { kind: "transfer" }> => command.kind === "transfer");
}

describe("single guarded approval entry", () => {
  it("rejects stale base without settling or applying", () => {
    const base = createBlankProject();
    const candidate = structuredClone(base);
    const live = structuredClone(base);
    live.meta.title = `${live.meta.title} changed`;
    let applies = 0;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: candidate,
      mapId: base.startMapId,
      region: REGION,
      changedCells: 1,
      changedEvents: 0,
      instruction: "test",
      report: clearReport(),
      getCurrentProject: () => live,
      onApply: () => { applies += 1; },
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });

    const outcome = pending.apply();
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("기준 프로젝트");
    expect(pending.settled).toBe(false);
    expect(applies).toBe(0);
    pending.discard();
  });

  it("routes a partial candidate through the same gate and applies exactly once", () => {
    const base = createBlankProject();
    const candidate = structuredClone(base);
    let applies = 0;
    let appliedTitle: string | null = null;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: candidate,
      mapId: base.startMapId,
      region: REGION,
      changedCells: 1,
      changedEvents: 0,
      instruction: "test",
      report: clearReport(),
      getCurrentProject: () => base,
      reviewProject: (project) => ({ project, report: clearReport() }),
      onApply: (project) => { applies += 1; appliedTitle = project.meta.title; },
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });
    const partial = structuredClone(candidate);
    partial.meta.title = "partial";

    expect(pending.applyProject(partial)).toMatchObject({ ok: true, applied: true });
    expect(applies).toBe(1);
    expect(appliedTitle).toBe("partial");
    pending.apply();
    expect(applies).toBe(1);
  });
  it("re-runs diagnostics for a different candidate but still applies it (검증게이트 배제)", () => {
    const base = createBlankProject();
    const candidate = structuredClone(base);
    let applies = 0;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: candidate,
      mapId: base.startMapId,
      region: REGION,
      changedCells: 0,
      changedEvents: 0,
      instruction: "fresh review",
      report: clearReport(),
      getCurrentProject: () => base,
      onApply: () => { applies += 1; },
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });
    const unsafe = structuredClone(candidate);
    unsafe.maps.orphan_direct_apply = {
      ...structuredClone(unsafe.maps[unsafe.startMapId]!),
      id: "orphan_direct_apply",
      name: "Orphan",
      events: [{
        id: "unreachable-objective",
        x: unsafe.startPos.x,
        y: unsafe.startPos.y,
        trigger: "action",
        commands: [{ kind: "text", body: "unreachable" }],
      } as unknown as Project["maps"][string]["events"][number]],
    };

    const outcome = pending.applyProject(unsafe);
    // 예전에는 이 소견이 적용을 반려했다. 이제는 소견만 남고 적용은 사용자 결정대로 진행된다.
    expect(outcome).toMatchObject({ ok: true, applied: true });
    expect(pending.report?.issues.some((issue) => issue.message.includes("unreachable-objective"))).toBe(true);
    expect(applies).toBe(1);
    expect(pending.settled).toBe(true);
  });
});

describe("read-only NPC/time preflight", () => {
  it("reports scheduled NPC metrics without enabling or mutating the time system", () => {
    const base = createBlankProject();
    const map = base.maps[base.startMapId]!;
    map.events.push({
      id: "scheduled",
      x: 1,
      y: 1,
      trigger: "action",
      commands: [],
      schedule: [{ activity: "work", mapId: map.id, x: 2, y: 2 }],
    } as unknown as Project["maps"][string]["events"][number]);
    const before = JSON.stringify(base.system.timeSystem);

    const result = reviewRegionDraft({ base, draft: base, mapId: map.id, region: REGION });

    expect(result.report.metrics.scheduledNpcs).toBe(1);
    expect(result.report.metrics.scheduleEntries).toBe(1);
    expect(result.report.metrics.timeSystemEnabled).toBe(false);
    expect(result.report.issues.some((issue) => issue.code === "npc-schedule-time-disabled")).toBe(true);
    expect(JSON.stringify(base.system.timeSystem)).toBe(before);
  });
});



describe("cross-tool detached session continuity", () => {
  it("preserves room sessions through the write-tool draft clone and records real layer snapshots", () => {
    const project = createBlankProject();
    const context = { project };
    const startTool = INTERIOR_ROOM_SESSION_TOOLS.find((tool) => tool.name === "start_interior_room_session")!;
    const advanceTool = INTERIOR_ROOM_SESSION_TOOLS.find((tool) => tool.name === "advance_interior_room_build")!;
    const started = runToolDefinition(context, startTool, {
      mapId: "room_tool_chain",
      name: "Tool chain",
      width: 14,
      height: 11,
      rooms: [{ id: "main", x: 2, y: 3, w: 10, h: 5, theme: "bedroom" }],
      door: { x: 7, y: 7 },
      theme: "bedroom",
      seed: 17,
    });
    expect(started.ok).toBe(true);
    const sessionId = (started.data as { sessionId: string }).sessionId;

    const advanced = runToolDefinition(context, advanceTool, { sessionId });
    expect(advanced.ok).toBe(true);
    const draft = listRoomDrafts(context.project)[0]!;
    expect(draft.sessionId).toBe(sessionId);
    expect(draft.checkpoints.some((checkpoint) => checkpoint.layer === "floor" && checkpoint.mapSnapshot)).toBe(true);
    expect(JSON.stringify(context.project)).not.toContain("roomHarnessSessions");
  });
});

describe("hard region scope and world reachability", () => {
  it("clips command-only edits to events outside the selected region", () => {
    const base = createBlankProject();
    const map = base.maps[base.startMapId]!;
    const event = {
      id: "outside-event",
      x: map.width - 1,
      y: map.height - 1,
      trigger: "action",
      commands: [{ kind: "text", body: "before" }],
    } as unknown as Project["maps"][string]["events"][number];
    map.events.push(event);
    const draft = structuredClone(base);
    draft.maps[base.startMapId]!.events.find((candidate) => candidate.id === event.id)!.commands = [
      { kind: "text", body: "after" },
    ];

    const clipped = clipMapCellsToRegion(base, draft, base.startMapId, { x: 0, y: 0, width: 1, height: 1 }).project;
    expect(clipped.maps[base.startMapId]!.events.find((candidate) => candidate.id === event.id)!.commands)
      .toEqual(event.commands);
  });

  it("blocks direct review of target-map changes outside the selected region", () => {
    const base = createBlankProject();
    const map = base.maps[base.startMapId]!;
    map.events.push({
      id: "scope-event",
      x: map.width - 1,
      y: map.height - 1,
      trigger: "action",
      commands: [{ kind: "text", body: "before" }],
    } as unknown as Project["maps"][string]["events"][number]);
    const draft = structuredClone(base);
    draft.maps[base.startMapId]!.events.at(-1)!.commands = [{ kind: "text", body: "after" }];

    const reviewed = reviewRegionDraft({
      base,
      draft,
      mapId: base.startMapId,
      region: { x: 0, y: 0, width: 1, height: 1 },
    });
    expect(reviewed.report.issues.some((issue) => issue.code === "region-scope-violation")).toBe(true);
    expect(reviewed.report.issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  it("reports a new gameplay map that has no reachable incoming transfer", () => {
    const base = createBlankProject();
    const draft = structuredClone(base);
    const source = draft.maps[draft.startMapId]!;
    draft.maps.orphan_room = {
      ...structuredClone(source),
      id: "orphan_room",
      name: "Orphan room",
      events: [{
        id: "required-objective",
        x: draft.startPos.x,
        y: draft.startPos.y,
        trigger: "action",
        commands: [{ kind: "text", body: "You found me" }],
      } as unknown as Project["maps"][string]["events"][number]],
    };

    const reviewed = reviewRegionDraft({ base, draft, mapId: base.startMapId, region: REGION });
    expect(reviewed.report.issues.some((issue) => issue.code === "gameplay-event-unreachable")).toBe(true);
    expect(reviewed.report.metrics.unreachableObjectives).toBeGreaterThan(0);
  });
});

describe("NPC schedule decision gate", () => {
  function scheduledCandidate(): { base: Project; candidate: Project } {
    const base = createBlankProject();
    const candidate = structuredClone(base);
    candidate.maps[candidate.startMapId]!.events.push({
      id: "new-scheduled-npc",
      x: candidate.startPos.x,
      y: candidate.startPos.y,
      trigger: "action",
      commands: [],
      schedule: [{ when: {}, at: { mapId: candidate.startMapId, x: candidate.startPos.x, y: candidate.startPos.y } }],
    } as unknown as Project["maps"][string]["events"][number]);
    return { base, candidate };
  }

  it("requires a choice, then can keep the new NPC fixed without mutating the base", () => {
    const { base, candidate } = scheduledCandidate();
    const review = (project: Project) => reviewRegionDraft({ base, draft: project, mapId: base.startMapId, region: REGION });
    const first = review(candidate);
    expect(first.report.issues.some((issue) => issue.code === "npc-schedule-time-disabled" && issue.severity === "error")).toBe(true);
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: first.project,
      mapId: base.startMapId,
      region: REGION,
      changedCells: 0,
      changedEvents: 1,
      instruction: "schedule",
      report: first.report,
      getCurrentProject: () => base,
      reviewProject: review,
      onApply: () => undefined,
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });

    pending.resolveNpcSchedules("keep-fixed");
    expect(pending.clippedProject.maps[base.startMapId]!.events.find((event) => event.id === "new-scheduled-npc")?.schedule)
      .toBeUndefined();
    expect(pending.report?.issues.some((issue) => issue.message.includes("시간 시스템"))).toBe(false);
    expect(base.maps[base.startMapId]!.events.some((event) => event.id === "new-scheduled-npc")).toBe(false);
    pending.discard();
  });

  it("can explicitly enable time and re-run the same safety review", () => {
    const { base, candidate } = scheduledCandidate();
    const review = (project: Project) => reviewRegionDraft({ base, draft: project, mapId: base.startMapId, region: REGION });
    const first = review(candidate);
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: first.project,
      mapId: base.startMapId,
      region: REGION,
      changedCells: 0,
      changedEvents: 1,
      instruction: "schedule",
      report: first.report,
      getCurrentProject: () => base,
      reviewProject: review,
      onApply: () => undefined,
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });

    pending.resolveNpcSchedules("enable-time");
    expect(pending.clippedProject.system.timeSystem?.enabled).toBe(true);
    expect(pending.report?.issues.some((issue) => issue.message.includes("시간 시스템"))).toBe(false);
    pending.discard();
  });
});

describe("stack-safe partial apply", () => {
  it("groups and copies a stack-only layer change", () => {
    const base = createBlankProject();
    const clipped = structuredClone(base);
    const mapId = base.startMapId;
    clipped.maps[mapId]!.lowerTileStacks = { 0: [17, 23] };
    const region = { x: 0, y: 0, width: 1, height: 1 } as const;
    const groups = groupRegionChanges(base, clipped, mapId, region);
    expect(groups.lower).toHaveLength(1);
    const merged = composePartialProject({
      base,
      clipped,
      mapId,
      region,
      selectedChunkIds: [groups.lower[0]!.id],
      groups,
    });
    expect(merged.maps[mapId]!.lowerTileStacks?.[0]).toEqual([17, 23]);
  });
});

describe("composable theme and semantic tile catalogs", () => {
  it("parses role + modifier combinations and exposes semantic evaluation roles", () => {
    const plan = parseInteriorPlan({
      mapId: "composed_room",
      width: 14,
      height: 11,
      rooms: [{ id: "chapel", x: 2, y: 3, w: 10, h: 5, theme: "dining", modifiers: ["sacred", "luxury"] }],
      door: { x: 7, y: 7 },
      theme: "dining",
      themeModifiers: ["sacred"],
      seed: 9,
    });
    expect(plan.themeModifiers).toEqual(["sacred"]);
    expect(plan.rooms?.[0]?.modifiers).toEqual(["sacred", "luxury"]);
    expect(INTERIOR_ROOM_THEME_CATALOG.dining.requiredRoles).toContain("table");
    expect(INTERIOR_SEMANTIC_TILE_CATALOG.table.tileIds.length).toBeGreaterThan(1);
  });
});

describe("reroll preview refresh", () => {
  it("publishes a fresh ghost project diff after a room-only reroll", () => {
    const base = createBlankProject();
    const candidate = cloneDetachedDraft(base);
    const session = startInteriorRoomDraft(candidate, {
      mapId: "room_preview_refresh",
      name: "Preview refresh",
      width: 16,
      height: 12,
      rooms: [
        { id: "living", x: 2, y: 3, w: 7, h: 5, theme: "dining" },
        { id: "bedroom", x: 10, y: 3, w: 4, h: 5, theme: "bedroom" },
      ],
      innerDoors: [{ x: 9, y: 5 }],
      door: { x: 5, y: 7 },
      theme: "dining",
      seed: 88,
    });
    for (let guard = 0; guard < 8; guard += 1) {
      const next = advanceRoomDraft(candidate, session.id);
      if (Object.values(next.checklist).every((state) => state !== "open")) break;
    }
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: candidate,
      mapId: base.startMapId,
      region: REGION,
      changedCells: 0,
      changedEvents: 0,
      instruction: "reroll",
      report: clearReport(),
      getCurrentProject: () => base,
      onApply: () => undefined,
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });
    const revision = getAgentGhostPreviewState().revision;
    pending.rerollRoom(session.id, "bedroom", 501);
    expect(getAgentGhostPreviewState().revision).toBeGreaterThan(revision);
    pending.discard();
  });
});
