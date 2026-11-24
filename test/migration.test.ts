import { describe, it, expect } from "vitest";
import { serialize, deserialize, migrateV1toV2, createProjectBackup, migrateV1toV3, migrateV2toV3, ProjectFormatError, resolveEventPage, restoreProjectBackup } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { SCHEMA_VERSION, type ProjectV1 } from "@/project/types";
import { makeV1, cloneJson } from "./migrationFixtures";
import eventPagesFixture from "./fixtures/projects/event-pages-v3.json";
import { isolateTimers } from "./mergedTeardown";

// test/migration.test.ts
// v1 → v2 마이그레이션 검증.
// 스펙 docs/specs/2026-06-18-oprn-overhaul-design.md §9.
describe("migration", () => {
  isolateTimers();
  describe("migrateV1toV2 — 기본 변환", () => {
    const v1 = makeV1();
    const v2 = migrateV1toV2(v1);

    it("version이 2로 승격", () => {
      expect(v2.version).toBe(2);
      expect(SCHEMA_VERSION).toBe(4);
    });

    it("meta.terms가 추가", () => {
      expect(v2.meta.terms).toBeDefined();
      expect(typeof v2.meta.terms.gold).toBe("string");
    });

    it("Database 구조가 생성됨", () => {
      expect(Array.isArray(v2.switches)).toBe(true);
      expect(Array.isArray(v2.variables)).toBe(true);
      expect(Array.isArray(v2.commonEvents)).toBe(true);
      expect(v2.tilesets).toBeDefined();
    });

    it("타일셋이 분리됨(passability/priority/terrain)", () => {
      const ts = v2.tilesets["tiles_default"];
      expect(ts).toBeDefined();
      expect(ts.passability.length).toBe(ts.count);
      expect(ts.priority.length).toBe(ts.count);
      expect(ts.terrain.length).toBe(ts.count);
    });
  });
  describe("migrateV1toV2 — 맵 변환", () => {
    const v1 = makeV1();
    const v2 = migrateV1toV2(v1);
    const map = v2.maps["map_a"];

    it("tiles → lowerTiles 로 복사", () => {
      expect(map.lowerTiles).toEqual([0, 1, 2, 3]);
    });

    it("upperTiles는 전부 빈 칸(-1)", () => {
      expect(map.upperTiles).toEqual([-1, -1, -1, -1]);
    });

    it("tilesetId가 설정됨", () => {
      expect(map.tilesetId).toBe("tiles_default");
    });

    it("lowerTiles/upperTiles 길이 유지", () => {
      expect(map.lowerTiles.length).toBe(4);
      expect(map.upperTiles.length).toBe(4);
    });
  });
  describe("migrateV1toV2 — flags → switches", () => {
    const v1 = makeV1();
    const v2 = migrateV1toV2(v1);

    it("flags 개수만큼 switch 생성", () => {
      expect(v2.switches.length).toBe(Object.keys(v1.flags).length);
    });

    it("각 switch에 id/name 있다", () => {
      for (const s of v2.switches) {
        expect(typeof s.id).toBe("string");
        expect(typeof s.name).toBe("string");
      }
    });

    it("flag 이름이 switch 이름으로 보존", () => {
      const names = v2.switches.map((s) => s.name).sort();
      expect(names).toEqual(["done", "met_king"]);
    });
  });
  describe("migrateV1toV2 — 이벤트/명령 변환", () => {
    const v1 = makeV1();
    const v2 = migrateV1toV2(v1);
    const ev = v2.maps["map_a"].events[0];

    it("condition.flag → condition.switch", () => {
      expect(ev.condition).toBeDefined();
      if (ev.condition && ev.condition.kind === "switch") {
        expect(ev.condition.value).toBe(true);
        // switchId는 met_king에 매핑된 id.
        const sw = v2.switches.find((s) => s.name === "met_king");
        expect(sw).toBeDefined();
        if (!sw) throw new Error("met_king switch missing");
        expect(ev.condition.switchId).toBe(sw.id);
      } else {
        throw new Error("condition이 switch가 아님");
      }
    });

    it("setFlag → setSwitch (루트 명령)", () => {
      // commands: text, choices(setFlag 중첩), setFlag, transfer, wait
      // 최상위 commands만 filter하면 루트 setFlag 1개.
      const setSwitchCmds = ev.commands.filter((c) => c.kind === "setSwitch");
      expect(setSwitchCmds.length).toBe(1);
    });

    it("text/transfer/wait는 그대로", () => {
      expect(ev.commands.some((c) => c.kind === "text")).toBe(true);
      expect(ev.commands.some((c) => c.kind === "transfer")).toBe(true);
      expect(ev.commands.some((c) => c.kind === "wait")).toBe(true);
    });

    it("choices의 branch도 setFlag → setSwitch 변환", () => {
      const choices = ev.commands.find((c) => c.kind === "choices");
      expect(choices).toBeDefined();
      if (choices && choices.kind === "choices") {
        expect(choices.options[0].branch[0].kind).toBe("setSwitch");
      }
    });
  });
  describe("migrateV1toV2 — Map Tree", () => {
    const v1 = makeV1();
    // map 2개짜리로 확장.
    v1.maps["map_b"] = {
      id: "map_b",
      name: "숲",
      width: 2,
      height: 2,
      tileset: { type: "bundled", id: "tex_tiles_default" },
      tileSize: 32,
      tiles: [0, 0, 0, 0],
      collisions: [false, false, false, false],
      events: [],
    };
    const v2 = migrateV1toV2(v1);

    it("루트가 startMapId", () => {
      expect(v2.mapTree.mapId).toBe("map_a");
    });

    it("나머지 맵이 루트 자식", () => {
      const childIds = v2.mapTree.children.map((c) => c.mapId);
      expect(childIds).toContain("map_b");
    });
  });
  describe("deserialize — v1 입력 자동 마이그레이션", () => {
    it("v1 JSON을 넣으면 v2 Project 반환", () => {
      const v1 = makeV1();
      const raw = JSON.stringify(v1);
      const loaded = deserialize(raw);
      expect(loaded.version).toBe(SCHEMA_VERSION);
      expect(loaded.tilesets).toBeDefined();
      expect(loaded.switches.length).toBeGreaterThan(0);
    });

    it("왕복: v2 → serialize → deserialize 동일", () => {
      const p = createBlankProject();
      const restored = deserialize(serialize(p));
      expect(restored.version).toBe(p.version);
      expect(restored.tilesets).toBeDefined();
      expect(restored.switches).toEqual(p.switches);
      expect(restored.mapTree.mapId).toBe(p.mapTree.mapId);
    });

    it("알 수 없는 버전은 거부", () => {
      const v1 = makeV1();
      const obj = JSON.parse(JSON.stringify(v1));
      obj.version = 99;
      expect(() => deserialize(JSON.stringify(obj))).toThrow(/스키마 버전/);
    });
  });
  describe("deserialize — v2/v3 검증", () => {
    it("잘못된 lowerTiles 길이 거부", () => {
      const p = createBlankProject();
      const obj = JSON.parse(serialize(p));
      const mapId = obj.startMapId;
      obj.maps[mapId].lowerTiles = [0, 0]; // 잘못된 길이
      expect(() => deserialize(JSON.stringify(obj))).toThrow(/lowerTiles 길이/);
    });

    it("mapTree가 존재하지 않는 맵 참조 시 안전 복구", () => {
      const p = createBlankProject();
      const obj = JSON.parse(serialize(p));
      obj.mapTree.mapId = "nope";
      const restored = deserialize(JSON.stringify(obj));
      expect(restored.mapTree.mapId).toBe(p.startMapId);
    });

    it("확장 이동 경로 명령 payload를 검증한다", () => {
      const p = createBlankProject();
      const obj = JSON.parse(serialize(p));
      const map = obj.maps[obj.startMapId];
      map.events.push({
        id: "ev_route_shape",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "moveEvent",
            eventId: "ev_route_shape",
            route: {
              repeat: false,
              moves: [
                { kind: "moveDiagonal", horizontal: "right", vertical: "up" },
                { kind: "turnRelative", turn: "leftOrRight90" },
                { kind: "jump", dx: 2, dy: -1 },
                { kind: "setSwitch", switchId: "sw_route", value: true },
                { kind: "changeGraphic", spriteId: "tex_easyrpg_charset_people1" },
                { kind: "playSe", resourceId: "se_route_chime" },
              ],
            },
          },
        ],
      });

      expect(deserialize(JSON.stringify(obj)).maps[obj.startMapId].events.at(-1)?.commands[0]?.kind).toBe("moveEvent");

      obj.maps[obj.startMapId].events.at(-1).commands[0].route.moves[0].horizontal = "north";
      expect(() => deserialize(JSON.stringify(obj))).toThrow(/horizontal/);
    });
  });
});

describe("migration-v3", () => {
  isolateTimers();
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
});

// test/migrationRoundTrip.m1.test.ts
// M1: 마이그레이션 결과물이 저장 시스템과 호환되는지 검증.
// migration.test.ts / migration-v3.test.ts가 변환 자체를 다루므로,
// 여기서는 '마이그레이션 → serialize → deserialize' 전체 체인의 안전성에 집중한다.
describe("migrationRoundTrip.m1", () => {
  isolateTimers();
  // cloneJson이 unknown을 반환하므로 ProjectV1으로 명시적 단언.
  function cloneV1(): ProjectV1 {
    return cloneJson(makeV1()) as ProjectV1;
  }
  function assertPersistable(project: ReturnType<typeof migrateV1toV3>): void {
    const restored = deserialize(serialize(project));
    expect(restored.version).toBe(SCHEMA_VERSION);
    expect(restored.startMapId).toBe(project.startMapId);
  }
  describe("마이그레이션 → 저장 체인 안전성", () => {
    it("v1 → v3 마이그레이션 결과가 serialize/deserialize 왕복에 살아남는다", () => {
      const v3 = migrateV1toV3(makeV1());
      expect(() => assertPersistable(v3)).not.toThrow();
    });

    it("v2 → v3 마이그레이션 결과가 serialize/deserialize 왕복에 살아남는다", () => {
      const v2 = migrateV1toV2(makeV1());
      const v3 = migrateV2toV3(v2);
      expect(() => assertPersistable(v3)).not.toThrow();
    });

    it("마이그레이션 후 맵 타일 데이터가 보존된다 (왕복 후에도)", () => {
      const v3 = migrateV1toV3(makeV1());
      const mapId = v3.startMapId;
      const tilesBefore = [...v3.maps[mapId].lowerTiles];

      const restored = deserialize(serialize(v3));
      expect(restored.maps[mapId].lowerTiles).toEqual(tilesBefore);
    });

    it("마이그레이션 후 이벤트 명령이 보존된다 (왕복 후에도)", () => {
      const v3 = migrateV1toV3(makeV1());
      const mapId = v3.startMapId;
      const cmdKindsBefore = v3.maps[mapId].events.flatMap((e) =>
        (e.pages ?? []).flatMap((p) => p.commands.map((c) => c.kind))
      );

      const restored = deserialize(serialize(v3));
      const cmdKindsAfter = restored.maps[mapId].events.flatMap((e) =>
        (e.pages ?? []).flatMap((p) => p.commands.map((c) => c.kind))
      );
      expect(cmdKindsAfter).toEqual(cmdKindsBefore);
    });
  });
  describe("마이그레이션 엣지 케이스", () => {
    it("이벤트가 없는 맵도 안전하게 마이그레이션된다", () => {
      const base = cloneV1();
      const mapId = Object.keys(base.maps)[0];
      base.maps[mapId].events = [];

      const v3 = migrateV1toV3(base);
      expect(v3.maps[mapId].events).toEqual([]);
      expect(() => assertPersistable(v3)).not.toThrow();
    });

    it("database 구조가 마이그레이션 후에도 유효하다", () => {
      const v3 = migrateV1toV3(makeV1());
      expect(v3.database.actors.length).toBeGreaterThan(0);
      expect(v3.system.startActorIds.length).toBeGreaterThan(0);
      // 시작 액터가 database에 존재해야 함
      for (const actorId of v3.system.startActorIds) {
        expect(v3.database.actors.some((a) => a.id === actorId)).toBe(true);
      }
    });

    it("마이그레이션 후 resourceProfiles가 채워진다", () => {
      const v3 = migrateV1toV3(makeV1());
      expect(v3.resourceProfiles.length).toBeGreaterThan(0);
    });

    it("마이그레이션 후 스위치가 flags에서 유도되어 보존된다", () => {
      const base = cloneV1();
      const flagNames = Object.keys(base.flags);
      expect(flagNames.length).toBeGreaterThan(0);

      const v3 = migrateV1toV3(base);
      // v1 flags의 각 키가 v3 switches에 대응 항목으로 존재해야 함
      expect(v3.switches.length).toBeGreaterThanOrEqual(flagNames.length);
    });
  });
});

describe("villageAuthoredValidation", () => {
  isolateTimers();
  /**
   * PR #298 병합 시 고친 차단 결함 2건의 계약.
   *
   * 1) `validateProjectV4` 가 사용자 저작 마을 배열을 전혀 검증하지 않았다. 잘못된 값이 조용히
   *    로드된 뒤 「마을」탭을 열거나 시공기가 읽는 순간 TypeError 로 죽는다 — 사용자는 "저장은
   *    됐는데 열면 죽는 프로젝트" 를 갖게 되고 어디가 문제인지 알 수 없다.
   * 2) 프리셋 + 명시 templateId 조합이 하드 실패였다. 문서는 "명시 인자 > 프리셋" 이라 적어 두고
   *    코드는 반대로 굴었다.
   */

  function withVillage(patch: Record<string, unknown>): string {
    const project = createBlankProject() as unknown as Record<string, unknown>;
    Object.assign(project, patch);
    return JSON.stringify(JSON.parse(serialize(project as never)));
  }
  const OK_TEMPLATE = {
    id: "vt_cottage",
    name: "오두막",
    w: 6,
    h: 5,
    wings: [{ x: 0, y: 0, w: 6, h: 5 }],
  };
  describe("저작된 마을 형태는 로드 경계에서 검사된다", () => {
    it("정상 형태와 프리셋은 통과한다", () => {
      const raw = withVillage({
        villageTemplates: [OK_TEMPLATE],
        villagePresets: [{ id: "vp_a", name: "강변", houseCount: 8, templateIds: ["vt_cottage"] }],
      });
      expect(() => deserialize(raw)).not.toThrow();
    });

    // w/h 가 0 이거나 음수면 후보 슬롯 필터가 영원히 못 찾거나 음수 폭으로 맵 밖을 쓴다.
    it("폭이 0 인 형태를 막는다", () => {
      expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, w: 0 }] }))).toThrow(
        /villageTemplates\[0\]\.w/,
      );
    });

    it("정수가 아닌 높이를 막는다", () => {
      expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, h: 3.5 }] }))).toThrow(
        /villageTemplates\[0\]\.h/,
      );
    });

    // 날개가 비면 집이 아니다 — 전개 함수가 빈 사각형 목록으로 문 판정을 하다 죽는다.
    it("날개가 빈 형태를 막는다", () => {
      expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, wings: [] }] }))).toThrow(
        /villageTemplates\[0\]\.wings/,
      );
    });

    it("날개 사각형의 폭이 0 이면 막는다", () => {
      const bad = { ...OK_TEMPLATE, wings: [{ x: 0, y: 0, w: 0, h: 5 }] };
      expect(() => deserialize(withVillage({ villageTemplates: [bad] }))).toThrow(/wings\[0\]\.w/);
    });

    it("층수가 유니온 밖이면 막는다", () => {
      expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, stories: 7 }] }))).toThrow(
        /stories/,
      );
    });

    it("이름이 문자열이 아니면 막는다", () => {
      expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, name: 42 }] }))).toThrow(
        /villageTemplates\[0\]\.name/,
      );
    });

    it("형태 자체가 객체가 아니면 막는다", () => {
      expect(() => deserialize(withVillage({ villageTemplates: ["cottage"] }))).toThrow(/villageTemplates\[0\]/);
    });
  });
  describe("저작된 마을 프리셋은 로드 경계에서 검사된다", () => {
    it("집 수가 범위를 벗어나면 막는다", () => {
      const raw = withVillage({ villagePresets: [{ id: "vp_a", name: "강변", houseCount: 0 }] });
      expect(() => deserialize(raw)).toThrow(/houseCount/);
    });

    it("도로 폭이 범위를 벗어나면 막는다", () => {
      const raw = withVillage({ villagePresets: [{ id: "vp_a", name: "강변", roadWidth: 9 }] });
      expect(() => deserialize(raw)).toThrow(/roadWidth/);
    });

    // 없는 형태를 가리키면 카탈로그가 통째로 걸러져 후보가 0 이 되고 시공기가 이유 없이 중단한다.
    it("없는 형태 id 를 가리키면 막는다", () => {
      const raw = withVillage({
        villageTemplates: [OK_TEMPLATE],
        villagePresets: [{ id: "vp_a", name: "강변", templateIds: ["vt_missing"] }],
      });
      expect(() => deserialize(raw)).toThrow(/vt_missing/);
    });

    it("문자열 자리에 숫자가 오면 막는다", () => {
      const raw = withVillage({ villagePresets: [{ id: "vp_a", name: "강변", pathStyle: 3 }] });
      expect(() => deserialize(raw)).toThrow(/pathStyle/);
    });
  });
});
