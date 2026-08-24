import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import {
  collectProjectReferenceIssues,
  repairProjectReferences,
  validateProjectReferences,
} from "@/project/io/references";
import { projectLint } from "@/project/lint/projectLint";
import {
  applyMapDeletion,
  collectMapDeletionImpact,
} from "@/project/mapDeletion";
import type {
  GameEvent,
  GameMap,
  NpcScheduleEntry,
  Project,
} from "@/project/types";

describe("NPC schedule project reference integrity", () => {
  // Break caught: global reference validation ignores missing and invalid schedule destinations.
  it("reports unknown, blank, missing, fractional, and out-of-bounds destinations with their host row", () => {
    const project = scheduleProject();
    const source = project.maps[project.startMapId]!;
    const target = project.maps.map_target!;
    const valid = scheduleRow(target.id, 1, 1, "work");
    source.events.push(eventWithSchedule("ev_schedule", [
      valid,
      scheduleRow("map_missing", 1, 1),
      scheduleRow("", 1, 1),
      { ...scheduleRow(target.id, 1, 1), at: { x: 1, y: 1 } } as unknown as NpcScheduleEntry,
      scheduleRow(target.id, target.width, 0),
      scheduleRow(target.id, 1.5, 1),
      structuredClone(valid),
    ]));

    const issues = collectProjectReferenceIssues(project).filter((issue) => issue.includes("schedule["));
    expect(issues).toHaveLength(5);
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[1\].*map_missing/),
      expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[2\].*blank/i),
      expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[3\].*missing/i),
      expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[4\].*out of bounds/i),
      expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[5\].*out of bounds/i),
    ]));

    const lintIssues = projectLint(project)
      .filter((issue) => issue.code === "reference-validation" && issue.message.includes("schedule["));
    expect(lintIssues).toHaveLength(5);
  });

  // Break caught: load repair leaves dangling schedule rows while repairing other map references.
  it("repairs only invalid rows across attached and map-tree-orphan event hosts", () => {
    const project = scheduleProject();
    const target = project.maps.map_target!;
    const source = project.maps[project.startMapId]!;
    const valid = scheduleRow(target.id, 2, 2, "work");
    const duplicate = structuredClone(valid);
    const sourceEvent = eventWithSchedule("ev_source", [
      valid,
      scheduleRow("map_missing", 1, 1),
      scheduleRow("", 1, 1),
      { ...scheduleRow(target.id, 1, 1), at: { x: 1, y: 1 } } as unknown as NpcScheduleEntry,
      duplicate,
      scheduleRow(target.id, -1, 0),
    ]);
    source.events.push(sourceEvent);
    const orphan = addMap(project, "map_orphan_host", false);
    orphan.events.push(eventWithSchedule("ev_orphan", [
      scheduleRow("map_missing", 0, 0),
      scheduleRow(target.id, 3, 3, "orphan-work"),
    ]));
    const commandsBefore = structuredClone(sourceEvent.commands);
    const pagesBefore = structuredClone(sourceEvent.pages);

    repairProjectReferences(project);

    expect(sourceEvent.schedule).toEqual([valid, duplicate]);
    expect(orphan.events[0]?.schedule).toEqual([scheduleRow(target.id, 3, 3, "orphan-work")]);
    expect(sourceEvent.commands).toEqual(commandsBefore);
    expect(sourceEvent.pages).toEqual(pagesBefore);
  });

  // Break caught: two scheduled map events can share one global runtime session key silently.
  it("hard-fails a scheduled event id collision while preserving legacy unscheduled duplicates", () => {
    const project = scheduleProject();
    const source = project.maps[project.startMapId]!;
    const target = project.maps.map_target!;
    source.events.push(eventWithSchedule("ev_shared", [scheduleRow(source.id, 1, 1)]));
    target.events.push(eventWithSchedule("ev_shared", [scheduleRow(target.id, 2, 2)]));

    expect(collectProjectReferenceIssues(project)).toEqual(expect.arrayContaining([
      expect.stringMatching(/scheduled event id.*ev_shared.*map_blank_start.*map_target/i),
    ]));
    expect(() => validateProjectReferences(project)).toThrow(/scheduled event id.*ev_shared/i);

    target.events[0]!.schedule = undefined;
    expect(collectProjectReferenceIssues(project)).toEqual(expect.arrayContaining([
      expect.stringMatching(/scheduled event id.*ev_shared/i),
    ]));

    source.events[0]!.schedule = undefined;
    expect(collectProjectReferenceIssues(project).some((issue) => /scheduled event id.*ev_shared/i.test(issue))).toBe(false);
  });

  // Break caught: map-deletion impact/cascade does not discover or remove nested schedule rows.
  it("identifies exact incoming rows and removes only those rows from surviving hosts", () => {
    const project = scheduleProject();
    const source = project.maps[project.startMapId]!;
    const target = project.maps.map_target!;
    const keep = addMap(project, "map_keep");
    const keepRow = scheduleRow(keep.id, 1, 1, "keep");
    const sourceEvent = eventWithSchedule("ev_multi", [
      scheduleRow(target.id, 1, 1, "target-a"),
      keepRow,
      scheduleRow(target.id, 1, 1, "target-a"),
    ]);
    const secondEvent = eventWithSchedule("ev_second", [scheduleRow(target.id, 2, 2)]);
    const preservedDuplicateEvent = eventWithSchedule("ev_keep", [keepRow, structuredClone(keepRow)]);
    source.events.push(sourceEvent, secondEvent, preservedDuplicateEvent);
    target.events.push(eventWithSchedule("ev_target_self", [scheduleRow(target.id, 3, 3)]));
    const orphan = addMap(project, "map_orphan_host", false);
    orphan.events.push(eventWithSchedule("ev_orphan", [scheduleRow(target.id, 4, 4)]));
    const commandsBefore = structuredClone(sourceEvent.commands);
    const pagesBefore = structuredClone(sourceEvent.pages);

    const impact = collectMapDeletionImpact(project, target.id);
    expect(impact?.incomingScheduleRows).toEqual([
      { hostMapId: source.id, eventId: "ev_multi", eventIndex: 0, scheduleIndex: 0 },
      { hostMapId: source.id, eventId: "ev_multi", eventIndex: 0, scheduleIndex: 2 },
      { hostMapId: source.id, eventId: "ev_second", eventIndex: 1, scheduleIndex: 0 },
      { hostMapId: orphan.id, eventId: "ev_orphan", eventIndex: 0, scheduleIndex: 0 },
    ]);

    applyMapDeletion(project, target.id);

    expect(project.maps[target.id]).toBeUndefined();
    expect(sourceEvent.schedule).toEqual([keepRow]);
    expect(secondEvent.schedule).toEqual([]);
    expect(preservedDuplicateEvent.schedule).toEqual([keepRow, keepRow]);
    expect(orphan.events[0]?.schedule).toEqual([]);
    expect(sourceEvent.commands).toEqual(commandsBefore);
    expect(sourceEvent.pages).toEqual(pagesBefore);
    for (const map of Object.values(project.maps)) {
      for (const event of map.events) {
        expect(event.schedule?.some((entry) => entry.at.mapId === target.id) ?? false).toBe(false);
      }
    }
  });

  // Characterization: ordered duplicate rows are legal first-match authoring and must round-trip byte-for-data.
  it("round-trips valid ordered schedules without deduplicating them", () => {
    const project = scheduleProject();
    const source = project.maps[project.startMapId]!;
    const row = scheduleRow("map_target", 2, 2, "work");
    source.events.push(eventWithSchedule("ev_valid", [row, structuredClone(row)]));

    const restored = deserialize(serialize(project));

    expect(restored.maps[project.startMapId]?.events[0]?.schedule).toEqual([row, row]);
  });
});

function scheduleProject(): Project {
  const project = createBlankProject();
  addMap(project, "map_target");
  return project;
}

function addMap(project: Project, id: string, attachToTree = true): GameMap {
  const template = project.maps[project.startMapId]!;
  const map = structuredClone(template);
  map.id = id;
  map.name = id;
  map.events = [];
  project.maps[id] = map;
  if (attachToTree) project.mapTree.children.push({ mapId: id, children: [] });
  return map;
}

function scheduleRow(
  mapId: string,
  x: number,
  y: number,
  activity?: string,
): NpcScheduleEntry {
  return {
    when: { hourRange: [6, 18] },
    at: { mapId, x, y },
    ...(activity ? { activity } : {}),
  };
}

function eventWithSchedule(id: string, schedule: NpcScheduleEntry[] | undefined): GameEvent {
  return {
    id,
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [{ kind: "text", body: `${id}:legacy` }],
    pages: [{
      id: `${id}_page`,
      name: id,
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: `${id}:page` }],
    }],
    ...(schedule === undefined ? {} : { schedule }),
  };
}
