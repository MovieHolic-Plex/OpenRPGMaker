// test/migration.test.ts
// v1 → v2 마이그레이션 검증.
// 스펙 docs/specs/2026-06-18-rm2k3-overhaul-design.md §9.

import { describe, it, expect } from "vitest";
import {
  serialize,
  deserialize,
  migrateV1toV2,
} from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { SCHEMA_VERSION } from "@/project/types";
import { makeV1 } from "./migrationFixtures";

describe("migrateV1toV2 — 기본 변환", () => {
  const v1 = makeV1();
  const v2 = migrateV1toV2(v1);

  it("version이 2로 승격", () => {
    expect(v2.version).toBe(2);
    expect(SCHEMA_VERSION).toBe(3);
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

  it("mapTree가 존재하지 않는 맵 참조 시 거부", () => {
    const p = createBlankProject();
    const obj = JSON.parse(serialize(p));
    obj.mapTree.mapId = "nope";
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/존재하지 않는 맵/);
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
              { kind: "changeGraphic", spriteId: "npc_villager" },
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
