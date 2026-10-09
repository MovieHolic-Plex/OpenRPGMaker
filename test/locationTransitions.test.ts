// 「구역에 들어오면/나가면」 트리거 — 순수 판정 모델과 스키마 왕복.
// 런타임 배선(실제 걸음·순간이동으로 이벤트가 도는지)은 test/locationTransitionRuntime.test.ts.
//
// 이 파일이 지키는 계약:
//   1. 판정은 «점유 집합의 차이» 뿐이다 — 새 내부/외부 규칙을 만들지 않았다.
//   2. optional 필드 두 개(트리거의 매개변수, 세션의 점유 기록)를 더했을 뿐이므로
//      옛 프로젝트/세이브는 byte-stable 이고 SCHEMA_VERSION 이 오르지 않는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { SCHEMA_VERSION } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { projectLint } from "@/project/lint/projectLint";
import { addMapLocation, deleteMapLocation, resizeMapLocation } from "@/project/mapNamedLocations";
import {
  collectMapLocationReferenceIssues,
  collectMapLocationReferences,
  countLocationReferences,
  repairMapLocationReferences,
} from "@/project/mapLocationReferences";
import {
  diffLocationOccupancy,
  leaveAllLocationsOnMap,
  occupiedLocationIdsAt,
  seedLocationOccupancy,
  transferLocationOccupancy,
  triggerMatchesTransition,
  updateLocationOccupancy,
  type LocationOccupancyHost,
} from "@/project/locationTransitions";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import type { EventPage, GameMap, Project, Trigger } from "@/project/types";

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
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(width * height).fill(TILE.GRASS),
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
    const before = serialize(project);
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
