import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { blankFillTileFor, createBlankMap } from "@/project/defaults/defaultMaps";
import { SCHEMA_VERSION, type EventPage, type GameMap, type Project, type Trigger, type StructureKitDef } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { projectLint } from "@/project/lint/projectLint";
import { addMapLocation, deleteMapLocation, resizeMapLocation } from "@/project/mapNamedLocations";
import { collectMapLocationReferenceIssues, collectMapLocationReferences, countLocationReferences, repairMapLocationReferences } from "@/project/mapLocationReferences";
import { diffLocationOccupancy, leaveAllLocationsOnMap, occupiedLocationIdsAt, seedLocationOccupancy, transferLocationOccupancy, triggerMatchesTransition, updateLocationOccupancy, type LocationOccupancyHost } from "@/project/locationTransitions";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import { runTool } from "@/editor/tools/toolRunner";
import { isMapWaterTile, waterBoundsInMap } from "@/editor/tools/queryTools";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { applyVariantLook, parseKeepIntact, resolveVariantLook } from "@/editor/tools/mapVariantLook";
import { BEODEUL_NATURE } from "@/project/defaults/beodeulNature";
import { appendStructurePlacement, captureStructureTiles } from "@/project/structurePlacements";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { MODERN_CITY_ID, createModernCityTileset } from "@/project/defaults/modernCity";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import spec from "../tiledata/modern-city/objects/spec.json";
import ask from "../tiledata/modern-city/objects/ask.json";
import { isolateTimers } from "./mergedTeardown";

// 「구역에 들어오면/나가면」 트리거 — 순수 판정 모델과 스키마 왕복.
// 런타임 배선(실제 걸음·순간이동으로 이벤트가 도는지)은 test/locationTransitionRuntime.test.ts.
//
// 이 파일이 지키는 계약:
//   1. 판정은 «점유 집합의 차이» 뿐이다 — 새 내부/외부 규칙을 만들지 않았다.
//   2. optional 필드 두 개(트리거의 매개변수, 세션의 점유 기록)를 더했을 뿐이므로
//      옛 프로젝트/세이브는 byte-stable 이고 SCHEMA_VERSION 이 오르지 않는다.
describe("locationTransitions", () => {
  isolateTimers();
  // 로케이션 계약은 칩셋과 무관하다 — 현재 기본 칩셋(버들항)의 빈 풀밭 위에서 잰다. 합본 마을은 2026-10-07 정리로 새 프로젝트에서 빠졌다.
  const GROUND = blankFillTileFor(DEFAULT_TILESET_ID);
  /** 세이브 왕복용 최소 Storage. 다른 세이브 테스트(customSeasonSave)와 같은 꼴이다. */
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();
    get length(): number { return this.values.size; }
    clear(): void { this.values.clear(); }
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
    removeItem(key: string): void { this.values.delete(key); }
    setItem(key: string, value: string): void { this.values.set(key, value); }
  }
  const MAP_ID = "loc_map";
  function projectWithMap(width = 20, height = 20): Project {
    const project = createBlankProject();
    const map: GameMap = {
      id: MAP_ID,
      name: "로케이션 맵",
      width,
      height,
      tilesetId: DEFAULT_TILESET_ID,
      tileSize: 16,
      lowerTiles: new Array(width * height).fill(GROUND),
      upperTiles: new Array(width * height).fill(TILE.EMPTY),
      events: [],
    };
    project.maps[MAP_ID] = map;
    return project;
  }
  /** 광장(2,2 6×6) 안에 좌판(4,4 2×2) 이 겹쳐 있는 맵. 겹침 계약을 그대로 쓴다. */
  function seedOverlappingLocations(map: GameMap): { plazaId: string; stallId: string } {
    const plaza = addMapLocation(map, { name: "정문 광장", x: 2, y: 2, w: 6, h: 6 });
    const stall = addMapLocation(map, { name: "좌판", x: 4, y: 4, w: 2, h: 2 });
    if (!plaza.ok || !stall.ok) throw new Error("fixture");
    return { plazaId: plaza.location.id, stallId: stall.location.id };
  }
  function transitionPage(trigger: Trigger, commands: EventPage["commands"] = []): EventPage {
    return {
      id: "p1",
      name: "구역 반응",
      conditions: [],
      graphic: {},
      trigger,
      priority: "same",
      overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands,
    };
  }
  describe("location transitions — 점유 집합 차이가 유일한 규칙", () => {
    it("같은 칸에 다시 서면 아무 사건도 나지 않는다 (재진입 중복 발동 방지)", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      const host: LocationOccupancyHost = {};

      // 첫 판정은 기준선만 심는다.
      const first = updateLocationOccupancy(host, map, { x: 3, y: 3 });
      expect(first.seeded).toBe(true);
      expect(first.transitions).toEqual([]);

      // 같은 칸 재판정 — 차집합이 비어 있다.
      expect(updateLocationOccupancy(host, map, { x: 3, y: 3 }).transitions).toEqual([]);
      // 구역 안 다른 칸으로 걸어도 «다시 들어옴» 이 아니다.
      expect(updateLocationOccupancy(host, map, { x: 3, y: 4 }).transitions).toEqual([]);
      expect(host.occupiedLocationIds?.[MAP_ID]).toEqual([plazaId]);
    });

    it("밖 → 안 → 밖 이 각각 enter 한 번, leave 한 번이다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      const host: LocationOccupancyHost = {};
      seedLocationOccupancy(host, map, { x: 0, y: 0 });

      expect(updateLocationOccupancy(host, map, { x: 2, y: 2 }).transitions)
        .toEqual([{ kind: "enter", locationId: plazaId }]);
      expect(updateLocationOccupancy(host, map, { x: 1, y: 2 }).transitions)
        .toEqual([{ kind: "leave", locationId: plazaId }]);
    });

    it("겹친 구역: 광장 안에서 좌판에 들어가면 좌판 enter 만 나고 광장은 유지된다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId, stallId } = seedOverlappingLocations(map);
      const host: LocationOccupancyHost = {};
      seedLocationOccupancy(host, map, { x: 3, y: 3 });

      expect(updateLocationOccupancy(host, map, { x: 4, y: 4 }).transitions)
        .toEqual([{ kind: "enter", locationId: stallId }]);
      expect(host.occupiedLocationIds?.[MAP_ID]).toEqual([plazaId, stallId]);

      // 좌판만 빠져나오면 좌판 leave 만 난다.
      expect(updateLocationOccupancy(host, map, { x: 3, y: 4 }).transitions)
        .toEqual([{ kind: "leave", locationId: stallId }]);
    });

    it("한 걸음에 leave 와 enter 가 함께 날 수 있고 leave 가 먼저다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const west = addMapLocation(map, { name: "서쪽", x: 0, y: 0, w: 5, h: 20 });
      const east = addMapLocation(map, { name: "동쪽", x: 5, y: 0, w: 5, h: 20 });
      if (!west.ok || !east.ok) throw new Error("fixture");
      const host: LocationOccupancyHost = {};
      seedLocationOccupancy(host, map, { x: 4, y: 3 });

      expect(updateLocationOccupancy(host, map, { x: 5, y: 3 }).transitions).toEqual([
        { kind: "leave", locationId: west.location.id },
        { kind: "enter", locationId: east.location.id },
      ]);
    });

    it("diffLocationOccupancy 는 순서가 달라도 같은 집합을 사건 없음으로 본다", () => {
      expect(diffLocationOccupancy(["loc1", "loc2"], ["loc2", "loc1"])).toEqual([]);
    });

    it("구역이 삭제되면 그 안에 서 있던 점유는 다음 판정에서 leave 로 정리된다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId, stallId } = seedOverlappingLocations(map);
      const host: LocationOccupancyHost = {};
      seedLocationOccupancy(host, map, { x: 4, y: 4 });
      expect(host.occupiedLocationIds?.[MAP_ID]).toEqual([plazaId, stallId]);

      expect(deleteMapLocation(map, stallId)).toBe(true);
      // 제자리 재판정만으로 정리된다 — 좌표는 그대로다.
      expect(updateLocationOccupancy(host, map, { x: 4, y: 4 }).transitions)
        .toEqual([{ kind: "leave", locationId: stallId }]);
      expect(host.occupiedLocationIds?.[MAP_ID]).toEqual([plazaId]);
    });

    it("구역이 축소되어 발밑을 벗어나면 leave 가 나고, 다시 넓히면 enter 가 난다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      const host: LocationOccupancyHost = {};
      seedLocationOccupancy(host, map, { x: 7, y: 7 });

      expect(resizeMapLocation(map, plazaId, { x: 2, y: 2, w: 2, h: 2 }).ok).toBe(true);
      expect(updateLocationOccupancy(host, map, { x: 7, y: 7 }).transitions)
        .toEqual([{ kind: "leave", locationId: plazaId }]);

      expect(resizeMapLocation(map, plazaId, { x: 2, y: 2, w: 6, h: 6 }).ok).toBe(true);
      expect(updateLocationOccupancy(host, map, { x: 7, y: 7 }).transitions)
        .toEqual([{ kind: "enter", locationId: plazaId }]);
    });

    it("맵을 떠나면 그 맵의 점유가 통째로 leave 이고 기준선은 «비어 있음» 으로 남는다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId, stallId } = seedOverlappingLocations(map);
      const host: LocationOccupancyHost = {};
      seedLocationOccupancy(host, map, { x: 4, y: 4 });

      expect(leaveAllLocationsOnMap(host, MAP_ID)).toEqual([
        { kind: "leave", locationId: plazaId },
        { kind: "leave", locationId: stallId },
      ]);
      // 기록을 **지우지 않는다**: 지우면 되돌아온 첫 판정이 seed 로 떨어져 enter 가 씹힌다.
      expect(host.occupiedLocationIds?.[MAP_ID]).toEqual([]);
      // 두 번 떠나도 사건이 겹쳐 나지 않는다.
      expect(leaveAllLocationsOnMap(host, MAP_ID)).toEqual([]);
    });

    it("순간이동은 출발 맵 leave 와 도착 지점 enter 를 한 번에 낸다 (중간 걸음 없음)", () => {
      const project = projectWithMap();
      const outside = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(outside);
      const hall: GameMap = { ...outside, id: "map_hall", name: "회관", locations: undefined, events: [] };
      const hallLocation = addMapLocation(hall, { name: "회관 안", x: 1, y: 1, w: 5, h: 5 });
      if (!hallLocation.ok) throw new Error("fixture");

      const host: LocationOccupancyHost = {};
      seedLocationOccupancy(host, outside, { x: 3, y: 3 });
      expect(transferLocationOccupancy(host, outside.id, hall, { x: 2, y: 2 })).toEqual([
        { kind: "leave", locationId: plazaId },
        { kind: "enter", locationId: hallLocation.location.id },
      ]);
      expect(host.occupiedLocationIds?.[outside.id]).toEqual([]);
      expect(host.occupiedLocationIds?.[hall.id]).toEqual([hallLocation.location.id]);
    });

    it("같은 맵 안 순간이동으로 같은 구역 안에 떨어지면 leave 와 enter 가 둘 다 난다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      const host: LocationOccupancyHost = {};
      seedLocationOccupancy(host, map, { x: 3, y: 3 });

      // 구역을 벗어났다 돌아온 것이다 — 재진입 연출이 다시 돌아야 맞다.
      expect(transferLocationOccupancy(host, map.id, map, { x: 6, y: 6 })).toEqual([
        { kind: "leave", locationId: plazaId },
        { kind: "enter", locationId: plazaId },
      ]);
    });

    it("구역 밖에서도 기준선을 남긴다 — 빈 배열이 «판정 기준이 있다» 는 사실이다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      const host: LocationOccupancyHost = {};
      seedLocationOccupancy(host, map, { x: 15, y: 15 });
      expect(host.occupiedLocationIds?.[MAP_ID]).toEqual([]);
      // 기준선이 없으면 이 진입이 seed 로 삼켜진다. 있으므로 enter 가 난다.
      expect(updateLocationOccupancy(host, map, { x: 3, y: 3 }).transitions)
        .toEqual([{ kind: "enter", locationId: plazaId }]);
    });

    it("occupiedLocationIdsAt 은 insideLocation 과 같은 기하 규칙을 쓴다 (경계 포함/배타)", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      // 광장은 (2,2) 6×6 = x 2..7, y 2..7.
      expect(occupiedLocationIdsAt(map, { x: 2, y: 2 })).toEqual([plazaId]);
      expect(occupiedLocationIdsAt(map, { x: 7, y: 7 })).toEqual([plazaId]);
      expect(occupiedLocationIdsAt(map, { x: 8, y: 7 })).toEqual([]);
      expect(occupiedLocationIdsAt(map, { x: 1, y: 2 })).toEqual([]);
    });

    it("triggerMatchesTransition 은 구역과 방향이 모두 같을 때만 참이다", () => {
      const enter = { kind: "locationTransition", locationId: "loc1", transition: "enter" } as const;
      expect(triggerMatchesTransition(enter, { kind: "enter", locationId: "loc1" })).toBe(true);
      expect(triggerMatchesTransition(enter, { kind: "leave", locationId: "loc1" })).toBe(false);
      expect(triggerMatchesTransition(enter, { kind: "enter", locationId: "loc2" })).toBe(false);
      expect(triggerMatchesTransition({ kind: "action" }, { kind: "enter", locationId: "loc1" })).toBe(false);
    });
  });
  describe("location transitions — schema load / migrate / save", () => {
    it("트리거가 왕복하고 스키마 버전이 오르지 않는다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      map.events = [{
        id: "ev_enter",
        x: 3,
        y: 3,
        trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" },
        commands: [],
        pages: [transitionPage({ kind: "locationTransition", locationId: plazaId, transition: "leave" })],
      }];

      const loaded = deserialize(serialize(project));
      const event = loaded.maps[MAP_ID]!.events[0]!;
      expect(event.trigger).toEqual({ kind: "locationTransition", locationId: plazaId, transition: "enter" });
      expect(event.pages?.[0]?.trigger).toEqual({ kind: "locationTransition", locationId: plazaId, transition: "leave" });
      expect(JSON.parse(serialize(loaded)).version).toBe(SCHEMA_VERSION);
    });

    it("트리거 데이터가 없는 옛 프로젝트는 로드/저장으로 한 바이트도 바뀌지 않는다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      map.events = [{ id: "ev_talk", x: 1, y: 1, trigger: { kind: "action" }, commands: [] }];
      // 디스크에 있는 옛 프로젝트는 이미 한 번 로드 정규화를 거친 모양이다. 갓 만든 createBlankProject 는 첫 로드에서
      // 기본 DB·system 이 정규화된다(배우 characterIndex 0 생략·직업 기술 순서) — 트리거와 무관하므로 그 모양에서 잰다.
      const before = serialize(deserialize(serialize(project)));
      expect(serialize(deserialize(before))).toBe(before);
      // 점유 기록도 생기지 않는다 — 세션 필드는 런타임에서만 만들어진다.
      expect(JSON.parse(before).session.occupiedLocationIds).toBeUndefined();
    });

    it("잘못된 transition 값과 빠진 locationId 는 로드에서 거부된다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      map.events = [{
        id: "ev",
        x: 3,
        y: 3,
        trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" },
        commands: [],
      }];
      const wire = JSON.parse(serialize(project));

      wire.maps[MAP_ID].events[0].trigger.transition = "arrive";
      expect(() => deserialize(JSON.stringify(wire))).toThrow(/transition/);

      wire.maps[MAP_ID].events[0].trigger = { kind: "locationTransition", transition: "enter" };
      expect(() => deserialize(JSON.stringify(wire))).toThrow(/locationId/);
    });

    it("삭제된 구역을 가리키는 트리거도 로드는 통과한다 — 고치려면 열려야 한다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      map.events = [{
        id: "ev",
        x: 3,
        y: 3,
        trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" },
        commands: [],
      }];
      deleteMapLocation(map, plazaId);
      const loaded = deserialize(serialize(project));
      expect(loaded.maps[MAP_ID]!.events[0]!.trigger).toMatchObject({ locationId: plazaId });
    });
  });
  describe("location transitions — 안에 서 있는 채로 저장하고 불러오기", () => {
    it("점유 기록이 세이브에 실려 복원되므로 불러오기가 enter 를 다시 내지 않는다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId, stallId } = seedOverlappingLocations(map);
      project.startMapId = MAP_ID;
      const session = startSession(project);
      session.currentMapId = MAP_ID;
      session.x = 4;
      session.y = 4;
      seedLocationOccupancy(session, map, { x: session.x, y: session.y });
      expect(session.occupiedLocationIds?.[MAP_ID]).toEqual([plazaId, stallId]);

      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;
      expect(read.snapshot.session.occupiedLocationIds?.[MAP_ID]).toEqual([plazaId, stallId]);

      const restored = applySaveSnapshot(project, read.snapshot);
      expect(restored.occupiedLocationIds?.[MAP_ID]).toEqual([plazaId, stallId]);
      // 복원 직후 제자리 판정 → 사건 없음. «불러오면 다시 들어온 것» 이 아니다.
      expect(updateLocationOccupancy(restored, map, { x: restored.x, y: restored.y }).transitions).toEqual([]);
    });

    it("점유 기록이 없는 옛 세이브는 불러온 뒤 기준선만 심고 아무것도 발동하지 않는다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId, stallId } = seedOverlappingLocations(map);
      project.startMapId = MAP_ID;
      const session = startSession(project);
      session.currentMapId = MAP_ID;
      session.x = 4;
      session.y = 4;
      // 옛 세이브를 흉내낸다: 필드가 아예 없다.
      delete session.occupiedLocationIds;

      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const read = readSaveSlot(storage, 1);
      if (read.kind !== "present") throw new Error("fixture");
      expect(read.snapshot.session.occupiedLocationIds).toBeUndefined();

      const restored = applySaveSnapshot(project, read.snapshot);
      expect(restored.occupiedLocationIds).toBeUndefined();
      // 첫 판정은 seed — 구역 안에 서 있어도 enter 가 나지 않는다.
      const first = updateLocationOccupancy(restored, map, { x: restored.x, y: restored.y });
      expect(first.seeded).toBe(true);
      expect(first.transitions).toEqual([]);
      // (4,4) 는 광장과 좌판이 겹친 칸이다 — 기준선에 둘 다 실린다.
      expect(restored.occupiedLocationIds?.[MAP_ID]).toEqual([plazaId, stallId]);
    });

    it("저장한 뒤 구역이 삭제된 프로젝트로 불러오면 다음 판정에서 leave 로 정리된다", () => {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId, stallId } = seedOverlappingLocations(map);
      project.startMapId = MAP_ID;
      const session = startSession(project);
      session.currentMapId = MAP_ID;
      session.x = 4;
      session.y = 4;
      seedLocationOccupancy(session, map, { x: 4, y: 4 });

      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      // 저작자가 그 사이 좌판을 지웠다.
      expect(deleteMapLocation(map, stallId)).toBe(true);

      const read = readSaveSlot(storage, 1);
      if (read.kind !== "present") throw new Error("fixture");
      const restored = applySaveSnapshot(project, read.snapshot);
      expect(updateLocationOccupancy(restored, map, { x: 4, y: 4 }).transitions)
        .toEqual([{ kind: "leave", locationId: stallId }]);
      expect(restored.occupiedLocationIds?.[MAP_ID]).toEqual([plazaId]);
    });
  });
  describe("location transitions — 끊긴 참조는 조건과 같은 진단·복구 경로를 쓴다", () => {
    function projectWithBrokenTrigger(): { project: Project; plazaId: string; otherId: string } {
      const project = projectWithMap();
      const map = project.maps[MAP_ID]!;
      const { plazaId } = seedOverlappingLocations(map);
      const other = addMapLocation(map, { name: "부두", x: 12, y: 12, w: 4, h: 4 });
      if (!other.ok) throw new Error("fixture");
      map.events = [{
        id: "ev_enter",
        x: 3,
        y: 3,
        trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" },
        commands: [{ kind: "text", body: "광장이다" }],
        pages: [transitionPage(
          { kind: "locationTransition", locationId: plazaId, transition: "leave" },
          [{ kind: "text", body: "광장을 나선다" }],
        )],
      }];
      return { project, plazaId, otherId: other.location.id };
    }

    it("트리거도 참조로 수집되고 삭제 전 영향 수에 잡힌다", () => {
      const { project, plazaId } = projectWithBrokenTrigger();
      const refs = collectMapLocationReferences(project).filter((ref) => ref.locationId === plazaId);
      expect(refs.map((ref) => ref.site.kind).sort()).toEqual(["trigger", "trigger"]);
      expect(countLocationReferences(project, plazaId)).toBe(2);
    });

    it("삭제하면 projectLint 가 map-location-missing-ref 를 올린다", () => {
      const { project, plazaId } = projectWithBrokenTrigger();
      deleteMapLocation(project.maps[MAP_ID]!, plazaId);

      const issues = collectMapLocationReferenceIssues(project)
        .filter((issue) => issue.code === "map-location-missing-ref");
      expect(issues).toHaveLength(2);
      expect(issues[0]?.severity).toBe("error");
      // 문장이 결과를 말해야 한다: 저작은 됐지만 절대 실행되지 않는다.
      expect(issues[0]?.message).toContain("절대 실행되지 않습니다");

      const lint = projectLint(project).filter((issue) => issue.code === "map-location-missing-ref");
      expect(lint.length).toBeGreaterThanOrEqual(2);
    });

    it("remap 복구는 트리거의 구역만 갈아끼우고 방향과 명령을 보존한다", () => {
      const { project, plazaId, otherId } = projectWithBrokenTrigger();
      deleteMapLocation(project.maps[MAP_ID]!, plazaId);

      const result = repairMapLocationReferences(project, plazaId, { kind: "remap", locationId: otherId });
      expect(result.repaired).toBe(2);

      const event = project.maps[MAP_ID]!.events[0]!;
      expect(event.trigger).toEqual({ kind: "locationTransition", locationId: otherId, transition: "enter" });
      expect(event.pages?.[0]?.trigger).toEqual({ kind: "locationTransition", locationId: otherId, transition: "leave" });
      expect(event.pages?.[0]?.commands).toEqual([{ kind: "text", body: "광장을 나선다" }]);
      expect(collectMapLocationReferenceIssues(project).filter((issue) => issue.code === "map-location-missing-ref")).toEqual([]);
    });

    it("detach 복구는 시작 방식을 「말을 걸면」으로 강등하고 명령을 잃지 않는다", () => {
      const { project, plazaId } = projectWithBrokenTrigger();
      deleteMapLocation(project.maps[MAP_ID]!, plazaId);

      const result = repairMapLocationReferences(project, plazaId, { kind: "detach" });
      expect(result.repaired).toBe(2);

      const event = project.maps[MAP_ID]!.events[0]!;
      // auto 로 강등하면 맵에 들어가는 순간 멋대로 돌아버린다 — action 이어야 한다.
      expect(event.trigger).toEqual({ kind: "action" });
      expect(event.pages?.[0]?.trigger).toEqual({ kind: "action" });
      expect(event.commands).toEqual([{ kind: "text", body: "광장이다" }]);
      expect(event.pages?.[0]?.commands).toEqual([{ kind: "text", body: "광장을 나선다" }]);
      // 복구 노트가 어디를 고쳤는지 사람 말로 남긴다.
      expect(result.notes.some((note) => note.includes("시작 방식"))).toBe(true);
    });

    it("다른 구역을 가리키는 트리거는 복구가 건드리지 않는다", () => {
      const { project, plazaId, otherId } = projectWithBrokenTrigger();
      const map = project.maps[MAP_ID]!;
      map.events.push({
        id: "ev_dock",
        x: 13,
        y: 13,
        trigger: { kind: "locationTransition", locationId: otherId, transition: "enter" },
        commands: [],
      });
      deleteMapLocation(map, plazaId);
      repairMapLocationReferences(project, plazaId, { kind: "detach" });
      expect(map.events[1]?.trigger).toEqual({ kind: "locationTransition", locationId: otherId, transition: "enter" });
    });
  });
});

describe("mapRegionWaterAndCompact", () => {
  isolateTimers();
  // toolResultForModel is private — exercise via compact behavior through session isn't easy;
  // water detection and get_map_region data.water are the public contract.

  describe("isMapWaterTile / waterBoundsInMap", () => {
    it("treats lake autotile and TILE.WATER as water", () => {
      expect(isMapWaterTile(TILE.WATER)).toBe(true);
      // body tile from lake set if exported
      const body = (LAKE_AUTOTILE_TILE as { BODY?: number }).BODY ?? (LAKE_AUTOTILE_TILE as unknown as number);
      if (typeof body === "number") {
        expect(isMapWaterTile(body)).toBe(true);
      }
    });

    it("get_map_region returns water.bounds for lake tiles", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      // paint a small water blob using TILE.WATER
      for (let y = 5; y < 9; y += 1) {
        for (let x = 6; x < 11; x += 1) {
          map.lowerTiles[y * map.width + x] = TILE.WATER;
        }
      }
      const result = runTool({ project }, "get_map_region", {
        mapId,
        x: 0,
        y: 0,
        w: map.width,
        h: map.height,
      });
      expect(result.ok).toBe(true);
      const data = result.data as {
        water: { cellCount: number; bounds: { x: number; y: number; w: number; h: number } | null };
        grid: string[];
      };
      expect(data.water.cellCount).toBe(4 * 5);
      expect(data.water.bounds).toEqual({ x: 6, y: 5, w: 5, h: 4 });
      // grid uses ~
      expect(data.grid[5]!.slice(6, 11)).toBe("~~~~~");
      expect(result.summary).toContain("물");
    });

    it("uses the active tileset rather than foreign water/tree numbers", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const tileset = structuredClone(project.tilesets[map.tilesetId]);
      tileset.id = "custom-interior";
      tileset.image = { type: "uploaded", id: "custom-atlas" };
      tileset.tileMeta = [];
      tileset.tileGroups = [];
      tileset.palettePresets = [];
      project.tilesets[tileset.id] = tileset;
      map.tilesetId = tileset.id;
      map.lowerTiles.fill(TILE.WATER);
      map.upperTiles.fill(TILE.EMPTY);
      map.upperTiles[0] = TILE.TREE;
      const query = () => runTool({ project }, "get_map_region", { mapId: map.id, x: 0, y: 0, w: 2, h: 1 });
      const unrelated = query().data as { water: { cellCount: number }; grid: string[] };
      expect(unrelated.water.cellCount).toBe(0);
      expect(unrelated.grid[0]).not.toMatch(/[~T]/);
      tileset.tileMeta[TILE.WATER] = { label: "water", description: "", role: "water", source: "user" };
      const explicit = query().data as { water: { cellCount: number }; grid: string[] };
      expect(explicit.water.cellCount).toBe(2);
      expect(explicit.grid[0]).toBe("~~");
    });

    it("waterBoundsInMap matches painted water rectangle", () => {
      // TILE.WATER is a combined-town chip id; without a tileset argument only a combined-town map reads it as water.
      const project = startOnRetiredCombinedTown(createBlankProject());
      const map = project.maps[project.startMapId]!;
      map.lowerTiles[3 * map.width + 4] = TILE.WATER;
      map.lowerTiles[3 * map.width + 5] = TILE.WATER;
      const b = waterBoundsInMap(map, 0, 0, map.width, map.height);
      expect(b).toEqual({ cellCount: 2, x: 4, y: 3, w: 2, h: 1 });
    });
  });
  describe("show_map_region size cap", () => {
    // Complete coverage is exempt (see wholeMapCoverageRender.test.ts); the cap still
    // stops the roaming it was added for, which is oversized *partial* slices.
    it("clamps huge partial requests to 24×24 on a large map", () => {
      const project = createBlankProject();
      const big = createBlankMap("big", 60, 60);
      big.id = "map_big";
      project.maps[big.id] = big;
      const result = runTool({ project }, "show_map_region", {
        mapId: big.id,
        x: 4,
        y: 4,
        w: 80,
        h: 80,
      });
      expect(result.ok).toBe(true);
      const data = result.data as { w: number; h: number };
      expect(data.w).toBe(24);
      expect(data.h).toBe(24);
      expect((result.warnings ?? []).some((w: string) => w.includes("잘랐"))).toBe(true);
    });
  });
  describe("custom atlas semantics", () => {
    it("uses authored water metadata rather than colliding default atlas numbers", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const tileset = structuredClone(project.tilesets[map.tilesetId]!);
      tileset.id = "custom-semantic-atlas";
      tileset.image = { type: "uploaded", id: "custom-semantic-image" };
      tileset.tileMeta = [];
      tileset.palettePresets = [];
      tileset.tileGroups = [];
      tileset.tileMeta[0] = { label: "grass", description: "", tags: ["grass"] };
      tileset.tileMeta[425] = { label: "water", description: "", tags: ["water"] };
      project.tilesets[tileset.id] = tileset;
      map.tilesetId = tileset.id;
      map.events = [];
      map.lowerTiles.fill(0);
      map.upperTiles.fill(TILE.EMPTY);
      map.lowerTiles[map.width + 1] = 425;
      const result = runTool({ project }, "get_map_region", { mapId: map.id, x: 0, y: 0, w: 3, h: 3 });
      expect(result.ok).toBe(true);
      const data = result.data as { grid: string[]; water: { cellCount: number; bounds: unknown } };
      expect(data.water).toMatchObject({ cellCount: 1, bounds: { x: 1, y: 1, w: 1, h: 1 } });
      expect(data.grid[1][1]).toBe("~");
      expect(data.grid[0]).not.toContain("~");
      expect(waterBoundsInMap(map, 0, 0, 3, 3)).toBeNull();
      expect(waterBoundsInMap(map, 0, 0, 3, 3, tileset)?.cellCount).toBe(1);
    });
  });
});

describe("mapVariantLook", () => {
  isolateTimers();
  describe("derive_map_variant 시대 겉모습(J03)", () => {
    it("era·name·id 낱말로 프리셋을 고르고, look 이 있으면 그것이 이긴다", () => {
      expect(resolveVariantLook({ era: "ruin" })).toBe("ruin");
      expect(resolveVariantLook({ name: "붕괴된 노르드 잔해 (붕괴의 세계)" })).toBe("ruin");
      expect(resolveVariantLook({ era: "past" })).toBe("past");
      expect(resolveVariantLook({ era: "고대" })).toBe("past");
      expect(resolveVariantLook({ era: "future", id: "map_x" })).toBe("future");
      expect(resolveVariantLook({ era: "황폐한 미래" })).toBe("ruin");
      expect(resolveVariantLook({ era: "평행세계 B", id: "map_alt" })).toBeNull();
      expect(resolveVariantLook({ era: "past", look: "none" })).toBeNull();
      expect(resolveVariantLook({ era: "past", look: "future" })).toBe("future");
      expect(resolveVariantLook({ look: "nope" })).toEqual({ error: expect.stringContaining("look 은") });
    });

    function townDraft(): { draft: Project; map: GameMap } {
      const width = 20;
      const height = 12;
      const cells = width * height;
      const map = {
        id: "m", name: "마을", width, height, tilesetId: "ts", tileSize: 16, events: [],
        lowerTiles: new Array(cells).fill(7), upperTiles: new Array(cells).fill(-1), structurePlacements: [],
      } as unknown as GameMap;
      // 건물 두 채(5×5) — 찍기 전 땅(7)을 before 로 기록하고 지붕 타일(900)을 덮는다.
      for (const x of [2, 12]) {
        const rect = { x, y: 3, w: 5, h: 5 };
        const before = captureStructureTiles(map, rect);
        for (let row = 0; row < 5; row += 1) for (let col = 0; col < 5; col += 1) map.upperTiles[(3 + row) * width + x + col] = 900;
        appendStructurePlacement(map, { kitId: `bd-house-${x}`, rect, before });
      }
      const draft = {
        maps: { m: map },
        tilesets: { ts: { id: "ts", structureKits: [{ id: "bd-pick-temple-ruins-rubble-temple", kind: "section", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [555] }], learnedFrom: "db-authored" }] } },
      } as unknown as Project;
      return { draft, map };
    }

    it("ruin 은 조명·안개를 걸고 건물을 철거해 땅으로 되돌리며 폐허 조각을 놓는다", () => {
      const { draft, map } = townDraft();
      const warnings: string[] = [];
      const report = applyVariantLook(draft, map, "ruin", warnings, "variants[x]");
      expect(map.defaultLighting?.ambient).toBeGreaterThan(0);
      expect(map.climate).toMatchObject({ mode: "fixed", weather: "fog" });
      expect(report.demolishedBuildings).toBeGreaterThanOrEqual(1);
      const roofsLeft = map.upperTiles.filter((tile) => tile === 900).length;
      expect(roofsLeft).toBeLessThan(50);
      expect(map.upperTiles.filter((tile) => tile === 555).length).toBe(report.stampedPieces);
      expect(report.stampedPieces).toBeGreaterThan(0);
    });

    it("물 칸 위에는 폐허 조각을 놓지 않는다(받침 없는 물체로 커밋이 거절되던 결함)", () => {
      const { draft, map } = townDraft();
      (draft.tilesets.ts as unknown as { tileMeta: Record<number, { tags: string[] }> }).tileMeta = { 7: { tags: ["water"] } };
      const report = applyVariantLook(draft, map, "ruin", [], "variants[w]");
      expect(report.demolishedBuildings).toBeGreaterThanOrEqual(1);
      expect(report.stampedPieces).toBe(0);
      expect(map.upperTiles.filter((tile) => tile === 555).length).toBe(0);
    });

    it("철거한 건물 자리의 2·4층 덧그림 지붕 조각도 지운다(허공에 남던 지붕)", () => {
      const { draft, map } = townDraft();
      const cells = map.width * map.height;
      map.lowerOverlayTiles = new Array(cells).fill(-1);
      map.upperOverlayTiles = new Array(cells).fill(-1);
      for (const x of [2, 12]) for (let row = 0; row < 5; row += 1) for (let col = 0; col < 6; col += 1) map.upperOverlayTiles[(3 + row) * map.width + x + col] = 901;
      map.upperOverlayTiles[0] = 902; // 건물 밖 덧그림은 그대로
      const report = applyVariantLook(draft, map, "ruin", [], "variants[o]");
      expect(report.demolishedBuildings).toBeGreaterThanOrEqual(1);
      expect(map.upperOverlayTiles.filter((tile) => tile === 901).length).toBeLessThan(60);
      expect(map.upperOverlayTiles[0]).toBe(902);
    });

    it("철거한 건물의 그림자 띠(2층 덧그림, 오른쪽·아랫줄)도 지운다", () => {
      const { draft, map } = townDraft();
      const cells = map.width * map.height;
      map.lowerOverlayTiles = new Array(cells).fill(-1);
      const shadow = BEODEUL_NATURE.shadows["bd-house-2"] ?? Object.values(BEODEUL_NATURE.shadows)[0]!;
      const kitIds = Object.keys(BEODEUL_NATURE.shadows);
      // 건물 두 채의 kitId 를 그림자 사전에 있는 이름으로 바꿔 두고 그 그림자 칸에 덧그림을 깐다.
      map.structurePlacements = map.structurePlacements!.map((placement, n) => ({ ...placement, kitId: kitIds[n]! }));
      const shadowCellsOf = (placement: { x: number; y: number; kitId: string }) => {
        const sh = BEODEUL_NATURE.shadows[placement.kitId]!;
        const out: number[] = [];
        sh.rows.forEach((row, j) => row.forEach((tile, i) => { if (tile >= 0) out.push((placement.y + sh.dy + j) * map.width + placement.x + sh.dx + i); }));
        return out.filter((index) => index >= 0 && index < cells);
      };
      const all = map.structurePlacements!.flatMap((placement) => shadowCellsOf(placement));
      for (const index of all) map.lowerOverlayTiles[index] = 30286;
      map.lowerOverlayTiles[0] = 30999; // 건물 밖 덧그림은 그대로
      const report = applyVariantLook(draft, map, "ruin", [], "variants[s]");
      expect(report.demolishedBuildings).toBeGreaterThanOrEqual(1);
      expect(map.lowerOverlayTiles.filter((tile) => tile === 30286).length).toBeLessThan(all.length);
      expect(map.lowerOverlayTiles[0]).toBe(30999);
      expect(shadow).toBeDefined();
    });

    it("같은 변형 id 는 언제나 같은 철거·배치가 나온다", () => {
      const first = townDraft();
      const second = townDraft();
      applyVariantLook(first.draft, first.map, "past", [], "a");
      applyVariantLook(second.draft, second.map, "past", [], "a");
      expect(first.map.upperTiles).toEqual(second.map.upperTiles);
    });

    it("건물 배치 기록이 없으면 조명·안개만 걸고 경고한다", () => {
      const { draft, map } = townDraft();
      map.structurePlacements = [];
      const warnings: string[] = [];
      const report = applyVariantLook(draft, map, "future", warnings, "variants[y]");
      expect(report.demolishedBuildings).toBe(0);
      expect(map.defaultLighting).toBeDefined();
      expect(warnings.join(" ")).toContain("structurePlacements");
    });

    it("burned 는 집 자리를 잿빛 집터·숯 기둥으로 바꾸고 keepIntact 건물 하나는 그대로 둔다(폴른 스타 2막 B5)", () => {
      expect(resolveVariantLook({ name: "새벽샘 (서른 해 전 불탄 마을)" })).toBe("burned");
      expect(resolveVariantLook({ era: "ruin", look: "burned" })).toBe("burned");
      expect(parseKeepIntact("north")).toBe("north");
      expect(parseKeepIntact("3,4")).toEqual({ x: 3, y: 4 });
      expect(parseKeepIntact("top")).toEqual({ error: expect.stringContaining("keepIntact") });
      const { draft, map } = townDraft();
      const kit = (id: string, rows: { tiles: number[]; upperTiles: number[] }[]) => ({ id, kind: "section", width: rows[0]!.tiles.length, height: rows.length, rows, learnedFrom: "db-authored" });
      const ground = (tile: number) => [0, 1, 2].map(() => ({ tiles: [tile, tile, tile], upperTiles: [-1, -1, -1] }));
      (draft.tilesets.ts as unknown as { structureKits: unknown[] }).structureKits.push(
        kit("bd-pick-mining-valley-ground-slagg", ground(40)),
        kit("bd-pick-mining-valley-ground-rock", ground(41)),
        kit("bd-pick-volcano-cave-pillar-broken-a", [{ tiles: [-1], upperTiles: [60] }, { tiles: [-1], upperTiles: [61] }]),
        kit("bd-pick-volcano-cave-coal-pile", [{ tiles: [-1, -1], upperTiles: [70, 71] }]),
      );
      const report = applyVariantLook(draft, map, "burned", [], "variants[b]", { keepIntact: "west" });
      expect(report.keptIntact).toMatchObject({ x: 2, y: 3, w: 5, h: 5 });
      expect(report.demolishedBuildings).toBe(1);
      const rect = (x0: number) => Array.from({ length: 25 }, (_, n) => (3 + Math.floor(n / 5)) * map.width + x0 + (n % 5));
      expect(rect(2).every((index) => map.upperTiles[index] === 900)).toBe(true);
      expect(rect(12).some((index) => map.upperTiles[index] === 900)).toBe(false);
      expect(rect(12).every((index) => map.lowerTiles[index] === 40 || map.lowerTiles[index] === 41)).toBe(true);
      expect(rect(12).filter((index) => map.upperTiles[index] === 61).length).toBeGreaterThanOrEqual(2);
      expect(map.climate).toBeUndefined();
    });
  });
});

// modern_city 이야기 기물 5종(mc-prop-storage-cabinet · -rubble · -note · -device · -ledger, 시트 13831~13838): 새 사본이 킷·참고문서를 갖고
// 칸 표가 선언(막힘·★·바닥 그림)과 같은지, 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 조수가 게임이 바란 낱말로 그 킷에 닿는지
// (낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지. 이식 칸이 있는 옛 사본은 test/themeBundleLocalTail.test.ts 가 본다.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/modern-city-street/bake_story.py, 목록 tiledata/modern-city/objects/spec.json).
describe("modernCityStoryObjects", () => {
  isolateTimers();
  type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][]; words: string[] };
  const ITEMS = spec.items as Item[];
  const kitId = (id: string) => `mc-prop-${id}`;
  const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
  const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
  const FIRST = 13831;   // 이 묶음이 덧붙기 전 시트 끝

  describe("modern_city 이야기 기물", () => {
    it("새 사본은 5종 킷과 참고문서를 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸·바닥 그림)", () => {
      const ts = createModernCityTileset();
      const kits = own(ts.structureKits);
      expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => kitId(item.id)));
      let next = FIRST;
      for (const item of ITEMS) {
        const kit = kits.find((k) => k.id === kitId(item.id))!;
        expect([kit.width, kit.height]).toEqual([item.w, item.h]);
        expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
        expect(kit.ai?.tags).toEqual(expect.arrayContaining([...item.words, item.place]));
        kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
          expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 13831 부터
          const blocked = item.block.some(([bx, by]) => bx === x && by === y);
          expect(ts.passability[tile]!.up).toBe(!blocked);
          expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
        }));
      }
      expect(next).toBe(ts.count);
      expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "mc-story-objects"))).toBe(true);
    });

    it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
      const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
      const sheet = read("public/assets/modern-city/modern-city-chipset.png");
      const ts = createModernCityTileset();
      for (const item of ITEMS) {
        const piece = read(`tiledata/modern-city/objects/pieces/${item.src}`);
        expect([piece.width, piece.height]).toEqual([item.w * 16, item.h * 16]);
        const kit = own(ts.structureKits).find((k) => k.id === kitId(item.id))!;
        kit.rows.forEach((row, cy) => (row.upperTiles ?? []).forEach((tile, cx) => {
          const sx = (tile % ts.tilesPerRow) * 16, sy = Math.floor(tile / ts.tilesPerRow) * 16;
          for (let y = 0; y < 16; y += 1) {
            const a = ((sy + y) * sheet.width + sx) * 4, b = ((cy * 16 + y) * piece.width + cx * 16) * 4;
            expect(Buffer.compare(sheet.data.subarray(a, a + 64), piece.data.subarray(b, b + 64))).toBe(0);
          }
        }));
      }
    });

    it("게임이 바란 낱말이 그 킷을 첫째로 짚는다", () => {
      const project = createBlankProject() as Project;
      const ts = project.tilesets[MODERN_CITY_ID]!;
      for (const [id, words] of Object.entries(ask.items)) for (const word of words) expect([word, existingMatches(project, ts, word)[0]?.id]).toEqual([word, kitId(id)]);
    });

    it("실제 놓기 도구로 놓으면 막힌 칸만 막힌다", () => {
      const ctx = { project: createBlankProject() as Project, currentMapId: "walk", assistantRun: true };
      expect(runTool(ctx, "create_map", { id: "walk", name: "보도", width: 20, height: 15, tilesetId: MODERN_CITY_ID }).ok).toBe(true);
      const stamp = (id: string, x: number, y: number) => runTool(ctx, "stamp_tileset_object", { mapId: "walk", objectId: kitId(id), base: { x, y } }).ok;
      expect([stamp("storage-cabinet", 3, 6), stamp("device", 5, 6), stamp("rubble", 8, 6), stamp("note", 12, 6), stamp("ledger", 14, 6)]).toEqual([true, true, true, true, true]);
      const walk = (x: number, y: number) => isPassable(ctx.project, ctx.project.maps.walk!, x, y);
      // 보관함·기계 장치 1×2 는 발밑만 막히고 윗칸은 사람 위에 그려지는 걸음 칸, 잔해 2×1 은 두 칸 모두 막힘, 쪽지·장부는 밟고 지나간다
      expect([walk(3, 6), walk(3, 5), walk(5, 6), walk(5, 5)]).toEqual([false, true, false, true]);
      expect([walk(8, 6), walk(9, 6)]).toEqual([false, false]);
      expect([walk(12, 6), walk(14, 6)]).toEqual([true, true]);
    });
  });
});
