import { describe, expect, it } from "vitest";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { clipMapCellsToRegion } from "@/editor/regionTask/clipToRegion";
import {
  advanceRoomDraft,
  listRoomDrafts,
  rerollRoomDraft,
  setRoomDraftLock,
  startInteriorRoomDraft,
} from "@/editor/roomHarness/facade";
import { reviewRegionDraft } from "@/editor/regionTask/harnessReview";
import { createBlankProject } from "@/project/defaults";
import { INTERIOR_ROOM_SESSION_TOOLS } from "@/editor/tools/interiorRoomSession";
import { runToolDefinition } from "@/editor/tools/toolRunner";
import { parseInteriorPlan } from "@/editor/roomHarness/interiorKit";
import { INTERIOR_ROOM_THEME_CATALOG, INTERIOR_SEMANTIC_TILE_CATALOG } from "@/editor/interiorRoomPipeline";
import type { Project } from "@/project/types";

const REGION = { x: 0, y: 0, width: 4, height: 4 } as const;


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


// 승인 게이트(setPendingRegionApply)는 정책상 없어졌다 — approvalPolicy 는 "즉시 적용,
// 복구는 되돌리기" 다. 남은 계약은 하네스가 **무엇을 문제로 보고하는가** 이고, 그 보고는
// 조수 적용 경로에서 ⚠ 버블이 된다(막지 않는다 — test/scopedAssistantTurn.test.ts).
describe("hard review reporting without an approval gate", () => {
  it("reports a scheduled NPC as an error issue when the time system is off", () => {
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

    const review = reviewRegionDraft({ base, draft: candidate, mapId: base.startMapId, region: REGION });

    expect(review.report.issues.some((issue) => issue.code === "npc-schedule-time-disabled" && issue.severity === "error")).toBe(true);
    expect(review.report.blockers.some((blocker) => blocker.includes("시간 시스템"))).toBe(true);
    // 리뷰는 순수하다 — base 를 건드리지 않는다.
    expect(base.maps[base.startMapId]!.events.some((event) => event.id === "new-scheduled-npc")).toBe(false);
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
    expect(reviewed.report.blockers.length).toBeGreaterThan(0);
  });

  it("blocks a new gameplay map that has no reachable incoming transfer", () => {
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
