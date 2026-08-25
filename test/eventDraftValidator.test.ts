import { describe, expect, it } from "vitest";
import { createDefaultM2Fields, M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import type { Command, Condition, EventPage, GameEvent } from "@/project/types";
import { newCommand } from "@/editor/eventCommandFactory";

function page(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "page-1",
    name: "검사 페이지",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "hello" }],
    ...overrides,
  };
}

function gameEvent(eventPage: EventPage): GameEvent {
  return {
    id: "event-test",
    x: 3,
    y: 3,
    trigger: eventPage.trigger,
    commands: [],
    pages: [eventPage],
  };
}

describe("event draft aggregate validator", () => {
  it("warns for a native command whose map guarantee is partial", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({ commands: [newCommand("giveMonster")] }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);

    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: "warning",
      code: "runtime.partial",
      commandPath: [0],
    }));
  });

  it("treats every recursively nested condition leaf as an auto/parallel gate", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const condition: Condition = {
      kind: "not",
      condition: {
        kind: "any",
        conditions: [{ kind: "selfSwitch", key: "A", value: true }],
      },
    };
    const event = gameEvent(page({ trigger: { kind: "parallel" }, conditions: [condition] }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);

    expect(result.issues.some((issue) => issue.code === "page.auto-parallel-ungated")).toBe(false);
    expect(result.canCommit).toBe(true);
  });

  it("validates labels with the same active-frame scope as the interpreter", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const commands: Command[] = [
      { kind: "label", name: "outer" },
      {
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [
          { kind: "label", name: "inner" },
          { kind: "label", name: "inner" },
          { kind: "gotoLabel", name: "outer" },
          { kind: "gotoLabel", name: "missing" },
        ],
        else: [{ kind: "label", name: "inner" }],
      },
      { kind: "gotoLabel", name: "inner" },
    ];
    const event = gameEvent(page({ commands }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const duplicate = result.issues.filter((issue) => issue.code === "label.duplicate");
    const missing = result.issues.filter((issue) => issue.code === "label.target-missing");

    expect(duplicate).toHaveLength(2);
    expect(duplicate.every((issue) => issue.commandPath !== undefined)).toBe(true);
    expect(missing).toEqual(expect.arrayContaining([
      expect.objectContaining({ commandPath: expect.arrayContaining([3]) }),
      expect.objectContaining({ commandPath: [2] }),
    ]));
    expect(missing.some((issue) => issue.message.includes("outer"))).toBe(false);
    expect(result.canCommit).toBe(false);
  });

  it("aggregates nested missing references and reports runtime-skipped commands as warnings", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      conditions: [{ kind: "any", conditions: [{ kind: "actor", actorId: "missing-actor", present: true }] }],
      commands: [
        { kind: "transfer", mapId: "missing-map", x: 0, y: 0 },
        { kind: "battleProcessing", troopId: "missing-troop", canEscape: true, canLose: false },
        { kind: "m2Command", commandId: "m2-088-comment", fields: { text: "note" } },
      ],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toContain("reference.actor.missing");
    expect(codes).toContain("reference.map.missing");
    expect(codes).toContain("reference.troop.missing");
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "runtime.editor-only",
      severity: "warning",
    }));
    expect(result.errorCount).toBeGreaterThanOrEqual(3);
  });

  it("honors modern M2 current-map, output-ID, optional-reference, and dynamic-ID semantics", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("missing start map");
    const entry = (title: string) => {
      const found = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
      if (!found) throw new Error(`missing ${title} catalog entry`);
      return found;
    };
    const spawnEvent = entry("Spawn Event");
    const removeEvent = entry("Remove Event");
    const regionTrigger = entry("Region Trigger");
    const pathfindMove = entry("Pathfind Move");
    const cameraControl = entry("Camera Control");
    const event = gameEvent(page({
      commands: [
        { kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "author note" } },
        {
          kind: "m2Command",
          commandId: spawnEvent.id,
          fields: { ...createDefaultM2Fields(spawnEvent), prefabId: "event-test", eventId: "runtime-spawn" },
        },
        {
          kind: "m2Command",
          commandId: removeEvent.id,
          fields: { ...createDefaultM2Fields(removeEvent), eventId: "runtime-spawn" },
        },
        {
          kind: "m2Command",
          commandId: regionTrigger.id,
          fields: createDefaultM2Fields(regionTrigger),
        },
        {
          kind: "m2Command",
          commandId: pathfindMove.id,
          fields: createDefaultM2Fields(pathfindMove),
        },
        {
          kind: "m2Command",
          commandId: cameraControl.id,
          fields: createDefaultM2Fields(cameraControl),
        },
      ],
    }));
    project.maps[mapId].events = [event];

    const validResult = validateEventDraftBody(project, mapId, event);

    expect(validResult.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(validResult.issues).toContainEqual(expect.objectContaining({
      code: "runtime.editor-only",
      severity: "warning",
    }));
    expect(validResult.canCommit).toBe(true);

    event.pages![0]!.commands[1] = {
      kind: "m2Command",
      commandId: spawnEvent.id,
      fields: {
        ...createDefaultM2Fields(spawnEvent),
        prefabId: "event-test",
        eventId: "runtime-spawn",
        x: map.width,
      },
    };
    event.pages![0]!.commands[4] = {
      kind: "m2Command",
      commandId: pathfindMove.id,
      fields: { ...createDefaultM2Fields(pathfindMove), y: map.height },
    };
    event.pages![0]!.commands[5] = {
      kind: "m2Command",
      commandId: cameraControl.id,
      fields: {
        ...createDefaultM2Fields(cameraControl),
        target: "position",
        x: map.width,
      },
    };

    const positionResult = validateEventDraftBody(project, mapId, event);
    expect(positionResult.issues.filter((issue) => issue.code === "map.position.out-of-bounds"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ commandPath: [1] }),
        expect.objectContaining({ commandPath: [4] }),
        expect.objectContaining({ commandPath: [5] }),
      ]));

    event.pages![0]!.commands[1] = {
      kind: "m2Command",
      commandId: spawnEvent.id,
      fields: {
        ...createDefaultM2Fields(spawnEvent),
        prefabId: "event-test",
        eventId: "runtime-spawn",
        mapId: "missing-map",
      },
    };
    const missingMapResult = validateEventDraftBody(project, mapId, event);
    expect(missingMapResult.issues).toContainEqual(expect.objectContaining({
      code: "reference.map.missing",
      commandPath: [1],
    }));

    event.pages![0]!.commands[1] = {
      kind: "m2Command",
      commandId: spawnEvent.id,
      fields: {
        ...createDefaultM2Fields(spawnEvent),
        prefabId: "missing-template",
        eventId: "runtime-spawn",
      },
    };
    const missingTemplateResult = validateEventDraftBody(project, mapId, event);
    expect(missingTemplateResult.issues).toContainEqual(expect.objectContaining({
      code: "reference.event.missing",
      commandPath: [1],
      field: { testId: "m2-command-prefabId-input" },
    }));
  });

  it("blocks empty shops and validates record references inside generic M2 fields", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const m2Entry = M2_COMMAND_CATALOG.find((entry) => entry.title === "Set Vehicle Location");
    if (!m2Entry) throw new Error("missing Set Vehicle Location catalog entry");
    const event = gameEvent(page({
      commands: [
        {
          kind: "shop",
          itemIds: [],
          allowSell: true,
          quantityMode: "single",
          shopType: "normal",
          messageType: "welcome",
          branchOnTransaction: false,
          transactionBranch: [],
        },
        {
          kind: "m2Command",
          commandId: m2Entry.id,
          fields: { ...createDefaultM2Fields(m2Entry), mapId: "missing-map" },
        },
      ],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "shop.items.empty", commandPath: [0] }),
      expect.objectContaining({ code: "reference.map.missing", commandPath: [1] }),
    ]));
    expect(result.canCommit).toBe(false);
  });

  it("accepts numeric M2 values and requires a variable reference only in variable mode", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const entries = ["Change Parameters", "Damage Processing"].map((title) => {
      const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
      if (!entry) throw new Error(`missing ${title} catalog entry`);
      return entry;
    });
    const event = gameEvent(page({
      commands: entries.map((entry) => ({
        kind: "m2Command" as const,
        commandId: entry.id,
        fields: createDefaultM2Fields(entry),
      })),
    }));
    project.maps[mapId].events = [event];

    const numericResult = validateEventDraftBody(project, mapId, event);

    expect(numericResult.issues.filter((issue) => issue.code === "reference.variable.missing")).toEqual([]);
    event.pages![0]!.commands[0] = {
      kind: "m2Command",
      commandId: entries[0]!.id,
      fields: {
        ...createDefaultM2Fields(entries[0]!),
        valueSource: "variable",
        valueVariableId: "missing-variable",
      },
    };

    const variableResult = validateEventDraftBody(project, mapId, event);

    expect(variableResult.issues).toContainEqual(expect.objectContaining({
      code: "reference.variable.missing",
      commandPath: [0],
    }));
  });

  it("checks legacy event conditions and authored positions without duplicating page logic", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      commands: [{ kind: "transfer", mapId, x: -1, y: 999 }],
    }));
    event.x = project.maps[mapId].width;
    event.condition = { kind: "switch", switchId: "missing-switch", value: true };
    event.schedule = [{ when: {}, at: { mapId: "missing-schedule-map", x: 0, y: 0 } }];
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toContain("event.position.out-of-bounds");
    expect(codes).toContain("map.position.out-of-bounds");
    expect(codes).toContain("reference.switch.missing");
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "event.position.out-of-bounds",
      field: { testId: "event-position-x" },
    }));
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "reference.map.missing",
      field: { testId: "event-schedule-map-0" },
    }));
    expect(result.canCommit).toBe(false);
  });

  it("validates every authored map position and field-spawn area family", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("missing start map");
    const setVehicle = M2_COMMAND_CATALOG.find((entry) => entry.title === "Set Vehicle Location");
    const getTerrain = M2_COMMAND_CATALOG.find((entry) => entry.title === "Get Terrain ID");
    if (!setVehicle || !getTerrain) throw new Error("missing M2 coordinate commands");
    const event = gameEvent(page({
      movement: {
        type: "living",
        speed: 3,
        frequency: 3,
        route: {
          moves: [{ kind: "npcTransfer", mapId, x: map.width, y: 0 }],
          repeat: false,
        },
        living: {
          destinations: [{ mapId, x: 0, y: map.height }],
          repeat: true,
        },
      },
      commands: [
        {
          kind: "moveEvent",
          eventId: "",
          route: {
            moves: [{ kind: "npcTransfer", mapId, x: -1, y: 0 }],
            repeat: false,
          },
        },
        { kind: "addLight", source: { id: "light-1", at: { x: map.width, y: 0 }, radius: 4 } },
        {
          kind: "showAnimation",
          target: { x: 0, y: map.height },
          animationId: project.database.battleAnimations[0]?.id ?? "",
        },
        {
          kind: "spawnFieldEnemy",
          spawn: {
            id: "spawn-1",
            troopId: project.system.initialTroopId ?? project.database.troops[0]?.id ?? "",
            area: { x: map.width - 1, y: 0, w: 2, h: 1 },
          },
        },
        {
          kind: "m2Command",
          commandId: setVehicle.id,
          fields: { ...createDefaultM2Fields(setVehicle), mapId, x: map.width, y: 0 },
        },
        {
          kind: "m2Command",
          commandId: getTerrain.id,
          fields: { ...createDefaultM2Fields(getTerrain), x: 0, y: map.height },
        },
      ],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const positionIssues = result.issues.filter((issue) => issue.code === "map.position.out-of-bounds");

    expect(positionIssues).toHaveLength(6);
    expect(positionIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ commandPath: [0] }),
      expect.objectContaining({ commandPath: [1] }),
      expect.objectContaining({ commandPath: [2] }),
      expect.objectContaining({ commandPath: [4] }),
      expect.objectContaining({ commandPath: [5] }),
      expect.objectContaining({ field: { testId: "event-page-living-target-x" } }),
    ]));
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "map.area.out-of-bounds",
      commandPath: [3],
    }));
    expect(result.canCommit).toBe(false);
  });

  it("ignores stale custom routes when another autonomous movement type is active", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const eventPage = page({
      movement: {
        type: "fixed",
        speed: 3,
        frequency: 3,
        route: {
          moves: [{ kind: "npcTransfer", mapId: "missing-map", x: 0, y: 0 }],
          repeat: false,
        },
      },
    });
    const event = gameEvent(eventPage);
    project.maps[mapId].events = [event];

    const inactiveResult = validateEventDraftBody(project, mapId, event);
    expect(inactiveResult.issues.some((issue) => issue.code === "reference.map.missing")).toBe(false);

    eventPage.movement.type = "custom";
    const customResult = validateEventDraftBody(project, mapId, event);
    expect(customResult.issues).toContainEqual(expect.objectContaining({
      code: "reference.map.missing",
      field: { testId: "event-page-custom-route" },
    }));
  });

  it("reports invisible collision and empty/no-op pages as nonfatal guidance", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      graphic: { transparent: true },
      priority: "same",
      overlapForbidden: true,
      commands: [],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "page.invisible-collision", severity: "warning" }),
      expect.objectContaining({ code: "page.empty", severity: "info" }),
    ]));
    expect(result.canCommit).toBe(true);
  });
});
