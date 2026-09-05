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

  it("treats an unknown faction as an error and blocks the draft", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "guard", name: "경비대" }], relations: [] };
    const mapId = project.startMapId;
    const event = gameEvent(page({ commands: [
      { kind: "changeFactionStance", a: "gaurd", b: "player", op: "-=", value: 0.25 },
    ] }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);

    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: "error",
      code: "reference.faction.missing",
      message: expect.stringContaining("gaurd"),
      commandPath: [0],
      field: { testId: "event-command-faction-a" },
    }));
    expect(result.issues.some((issue) => issue.message.includes("player"))).toBe(false);
    expect(result.canCommit).toBe(false);
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
      // 좌표 입력물은 죽은 identity 카드와 함께 사라졌다 — 앵커는 헤더의 보이는 좌표 표시다.
      field: { testId: "event-editor-coords" },
    }));
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "reference.map.missing",
      field: { testId: "event-schedule-map-0" },
    }));
    expect(result.canCommit).toBe(false);
  });

  it("showEmote 대상은 없는 이벤트만 거부하고 현재 이벤트와 주인공은 허용한다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      commands: [
        { kind: "showEmote", target: { eventId: "does-not-exist" }, emote: "heart" },
        { kind: "showEmote", target: { eventId: "" }, emote: "smile" },
        { kind: "showEmote", target: "player", emote: "question" },
      ],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const missing = result.issues.filter((issue) => issue.code === "reference.event.missing");

    expect(missing).toEqual([
      expect.objectContaining({ commandPath: [0], message: expect.stringContaining("이모트 대상 이벤트") }),
    ]);
    expect(missing.some((issue) => issue.commandPath?.[0] === 1)).toBe(false);
    expect(missing.some((issue) => issue.commandPath?.[0] === 2)).toBe(false);
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

function issueOf(result: ReturnType<typeof validateEventDraftBody>, code: string) {
  const issue = result.issues.find((entry) => entry.code === code);
  expect(issue, `expected issue ${code}`).toBeDefined();
  return issue!;
}

describe("always-true / always-false condition traps", () => {
  it("warns when a timer threshold of 0 is always true while no timer is running", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      conditions: [{ kind: "timer", timerId: "timer1", seconds: 0 }],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const issue = issueOf(result, "condition.timer.always-true");

    expect(issue.severity).toBe("warning");
    expect(issue.pageId).toBe("page-1");
    expect(issue.field).toEqual({ testId: "event-page-timer1-condition-seconds" });
    expect(result.canCommit).toBe(true);
  });

  it("warns when an npc activity name is empty and can never match", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      conditions: [{ kind: "npcActivity", activity: "" }],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const issue = issueOf(result, "condition.npcActivity.empty");

    expect(issue.severity).toBe("warning");
    expect(issue.pageId).toBe("page-1");
    expect(issue.field).toEqual({ testId: "event-page-npc-activity-condition-input" });
    expect(result.canCommit).toBe(true);
  });

  // 페이지 조건의 battleResult 는 지속되는 세션 상태를 읽는다 — 랜덤 인카운터·필드 스폰은
  // battleProcessing 없이도 전투를 열고, 다른 이벤트·공통 이벤트가 남긴 결과도 살아남는다.
  // 명령 순서나 프로젝트 스캔으로 "항상 거짓"을 증명할 수 없어 이 추론 자체를 걷어냈다.
  it("does not warn for persistent battle results without a battleProcessing command", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      conditions: [{ kind: "battleResult", result: "victory" }],
      commands: [{
        kind: "fork",
        condition: { kind: "battleResult", result: "defeat" },
        then: [{ kind: "text", body: "recover" }],
      }],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);

    expect(result.issues.filter((issue) => issue.code === "condition.battleResult.no-preceding-battle")).toEqual([]);
  });

  it("warns when a gold comparison can never hold for the 0..GOLD_MAX range", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      conditions: [{ kind: "gold", op: "<", amount: -1 }],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const issue = issueOf(result, "condition.gold.impossible");

    expect(issue.severity).toBe("warning");
    expect(issue.pageId).toBe("page-1");
    expect(issue.field).toEqual({ testId: "event-condition-gold-amount" });
    expect(result.canCommit).toBe(true);
  });

  it("warns when a time-phase condition is authored without a time system", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      conditions: [{ kind: "timePhase", phase: "night" }],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const issue = issueOf(result, "condition.timePhase.no-time-system");

    expect(issue.severity).toBe("warning");
    expect(issue.pageId).toBe("page-1");
    expect(issue.field).toEqual({ testId: "event-page-time-phase-condition-input" });
    expect(result.canCommit).toBe(true);
  });

  it("warns when a season condition is authored without a time system", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent(page({
      conditions: [{ kind: "season", season: "winter" }],
    }));
    project.maps[mapId].events = [event];

    const result = validateEventDraftBody(project, mapId, event);
    const issue = issueOf(result, "condition.season.no-time-system");

    expect(issue.severity).toBe("warning");
    expect(issue.pageId).toBe("page-1");
    expect(issue.field).toEqual({ testId: "event-page-season-condition-input" });
    expect(result.canCommit).toBe(true);
  });

  it("does not throw when a page is missing graphic, movement, trigger, or commands", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = gameEvent({ id: "page-1", name: "첫 방문" } as EventPage);
    project.maps[mapId].events = [event];

    expect(() => validateEventDraftBody(project, mapId, event)).not.toThrow();
    const result = validateEventDraftBody(project, mapId, event);
    expect(result.issues.some((issue) => issue.code === "page.empty")).toBe(true);
    expect(result.canCommit).toBe(true);
  });
});

