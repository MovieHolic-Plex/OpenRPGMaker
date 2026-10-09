import { describe, expect, it } from "vitest";
import { callMapEventTargetStatus } from "@/editor/eventCallTargetStatus";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import type { EventPage, GameEvent } from "@/project/types";

function page(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "page-1",
    name: "\uac80\uc0ac \ud398\uc774\uc9c0",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
    ...overrides,
  };
}

function gameEvent(id: string, pages: EventPage[]): GameEvent {
  return { id, x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages };
}

function transferCommand(mapId: string) {
  return { kind: "transfer" as const, mapId, x: 5, y: 5, fade: "black" as const };
}

function callCommand(targetId: string) {
  return { kind: "callMapEvent" as const, eventId: targetId };
}

describe("callMapEvent \uc8fd\uc740 \ub300\uc0c1 \uacbd\uace0", () => {
  it("\uacbd\uace0: \ub300\uc0c1 \uc774\ubca4\ud2b8 \ud398\uc774\uc9c0\uac00 \ube44\uc5b4 \uc788\uc73c\uba74 callMapEvent \uba85\ub839\uc5d0 \uacbd\uace0\ub97c \ub0b4\ub09c\ub2e4", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const target = gameEvent("ev_target", [page({ id: "p1", commands: [] })]);
    const caller = gameEvent("ev_caller", [page({ id: "p1", commands: [callCommand("ev_target")] })]);
    project.maps[mapId].events = [caller, target];

    const result = validateEventDraftBody(project, mapId, caller);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: "warning",
      code: "callMapEvent.target-inert",
      commandPath: [0],
    }));
  });

  it("\uacbd\uace0: \ube44\uc5b4 \uc788\ub294 \ud398\uc774\uc9c0\uac00 \uc788\ub294 \ub300\uc0c1 \uc774\ubca4\ud2b8\uc5d0\uc11c \ub3c5 \uacbd\uace0\ub97c \ub0b4\ub0b8\ub2e4", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const target = gameEvent("ev_target", [page({ id: "p1", commands: [] })]);
    const caller = gameEvent("ev_caller", [page({ id: "p1", commands: [callCommand("ev_target")] })]);
    project.maps[mapId].events = [caller, target];

    const result = validateEventDraftBody(project, mapId, target);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: "warning",
      code: "callMapEvent.target-page-empty",
    }));
  });

  it("\uc0dd\uc540 \uc788\ub294 \ub300\uc0c1\uc73c\ub85c \uc798 \ubd80\ub974\uba74 \uacbd\uace0\uac00 \uc5c6\ub2e4", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const target = gameEvent("ev_target", [page({ id: "p1", commands: [
      { kind: "text", body: "\uc548\ub155" },
    ] })]);
    const caller = gameEvent("ev_caller", [page({ id: "p1", commands: [callCommand("ev_target")] })]);
    project.maps[mapId].events = [caller, target];

    const result = validateEventDraftBody(project, mapId, caller);
    expect(result.issues.filter((issue) => issue.code.startsWith("callMapEvent."))).toEqual([]);
  });

  it("\uc804\uc774 \ubaa9\uc801 \ub9f5\uc774 \uc0ac\ub77c\uc84c\uc73c\uba74 transfer-target-missing \uacbd\uace0\ub97c \ub0b4\ub0b8\ub2e4", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const target = gameEvent("ev_target", [page({ id: "p1", commands: [transferCommand("map_ghost")] })]);
    const caller = gameEvent("ev_caller", [page({ id: "p1", commands: [callCommand("ev_target")] })]);
    project.maps[mapId].events = [caller, target];

    const result = validateEventDraftBody(project, mapId, caller);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: "warning",
      code: "callMapEvent.transfer-target-missing",
    }));
  });

  it("\ud310\uc815 \ud568\uc218\uac00 \uc8fd\uc740 \ub300\uc0c1\uacfc \uc0b4\uc544\uc788\ub294 \ub300\uc0c1\uc744 \uad6c\ubd84\ud55c\ub2e4", () => {
    const project = createBlankProject();
    const dead = gameEvent("ev_dead", [page({ id: "p1", commands: [] })]);
    const alive = gameEvent("ev_alive", [page({ id: "p1", commands: [{ kind: "wait", ms: 100 }] })]);
    project.maps[project.startMapId].events = [dead, alive];

    expect(callMapEventTargetStatus(project, dead).callable).toBe(false);
    expect(callMapEventTargetStatus(project, alive).callable).toBe(true);
    expect(callMapEventTargetStatus(project, undefined).callable).toBe(true);
  });
});
