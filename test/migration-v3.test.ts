import { describe, expect, it } from "vitest";
import {
  createProjectBackup,
  deserialize,
  migrateV1toV2,
  migrateV1toV3,
  migrateV2toV3,
  ProjectFormatError,
  resolveEventPage,
  restoreProjectBackup,
  serialize,
} from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { SCHEMA_VERSION } from "@/project/types";
import eventPagesFixture from "./fixtures/projects/event-pages-v3.json";
import { cloneJson, makeV1 } from "./migrationFixtures";

describe("schema v3 migration contract", () => {
  it("migrates v1 projects directly to schema v3 with one-page legacy events", () => {
    const v3 = migrateV1toV3(makeV1());
    const event = v3.maps.map_a.events[0];
    const pages = event.pages ?? [];

    // v1·v2 사슬은 얼굴 낱장 분할(v3→v4) 단계까지 통과해 항상 현재 스키마로 나온다.
    expect(v3.version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(4);
    expect(pages).toHaveLength(1);
    expect(pages[0].commands.some((command) => command.kind === "setSwitch")).toBe(true);
    expect(v3.database.actors.length).toBeGreaterThan(0);
    expect(v3.system.startActorIds).toContain(v3.database.actors[0].id);
  });

  it("migrates v2 projects to schema v3 and preserves legacy top-level event fields", () => {
    const v2 = migrateV1toV2(makeV1());
    const v3 = migrateV2toV3(v2);
    const event = v3.maps.map_a.events[0];
    const pages = event.pages ?? [];

    expect(v3.version).toBe(SCHEMA_VERSION);
    expect(event.trigger.kind).toBe("action");
    expect(event.commands.length).toBeGreaterThan(0);
    expect(pages[0].trigger.kind).toBe("action");
    expect(v3.resourceProfiles.some((profile) => profile.kind === "chipset")).toBe(true);
  });

  it("validates the event page fixture and resolves the highest matching page", () => {
    const project = deserialize(JSON.stringify(eventPagesFixture));
    const event = project.maps.map_page.events[0];

    expect(event.pages).toHaveLength(2);
    expect(resolveEventPage(event, { switches: {}, variables: {}, inventory: {}, partyActorIds: [] })?.id).toBe(
      "page_1"
    );
    expect(
      resolveEventPage(event, {
        switches: { sw_page: true },
        variables: {},
        inventory: {},
        partyActorIds: [],
      })?.id
    ).toBe("page_2");
  });

  it("rejects invalid actor, skill, enemy, troop, resource, common-event, and map references", () => {
    const invalid = cloneJson(eventPagesFixture);
    if (typeof invalid !== "object" || invalid === null || !("database" in invalid)) {
      throw new Error("fixture clone failed");
    }
    const record = invalid as {
      database: {
        actors: [{ learnedSkills: { level: number; skillId: string }[] }];
        enemies: [{ id: string; skillIds: string[]; monsterResourceId: string }];
        troops: [{ enemyIds: string[] }];
      };
      system: { startActorIds: string[]; initialTroopId: string };
      commonEvents: [{ conditionSwitchId?: string }];
      maps: {
        map_page: {
          events: [
            {
              pages: [
                unknown,
                {
                  commands: [
                    { kind: "battleProcessing"; troopId: string; canEscape: boolean; canLose: boolean },
                    { kind: "callCommonEvent"; commonEventId: string },
                    { kind: "transfer"; mapId: string; x: number; y: number },
                  ];
                },
              ];
            },
          ];
        };
      };
    };
    record.database.actors[0].learnedSkills = [{ level: 1, skillId: "missing_skill" }];
    record.database.enemies[0].skillIds = ["missing_skill"];
    record.database.enemies[0].monsterResourceId = "missing_resource";
    record.database.troops[0].enemyIds = ["missing_enemy"];
    record.system.startActorIds = ["missing_actor"];
    record.system.initialTroopId = "missing_troop";
    record.commonEvents[0].conditionSwitchId = "missing_switch";
    record.maps.map_page.events[0].pages[1].commands = [
      { kind: "battleProcessing", troopId: "missing_troop", canEscape: false, canLose: false },
      { kind: "callCommonEvent", commonEventId: "missing_common" },
      { kind: "transfer", mapId: "missing_map", x: 0, y: 0 },
    ];

    expect(() => deserialize(JSON.stringify(record))).toThrow(ProjectFormatError);
  });

  it("restores a backup snapshot after a failed import validation", () => {
    const current = deserialize(serialize(createBlankProject()));
    const backup = createProjectBackup(current);
    const invalid = cloneJson(eventPagesFixture);
    if (typeof invalid !== "object" || invalid === null || !("system" in invalid)) {
      throw new Error("fixture clone failed");
    }
    const record = invalid as { system: { startActorIds: string[] } };
    record.system.startActorIds = ["missing_actor"];

    expect(() => deserialize(JSON.stringify(record))).toThrow(ProjectFormatError);
    expect(restoreProjectBackup(backup)).toEqual(current);
  }, 15_000);
});
