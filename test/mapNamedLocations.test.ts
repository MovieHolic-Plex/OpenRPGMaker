import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import { projectLint } from "@/project/lint/projectLint";
import { cloneGameMap } from "@/project/mapClone";
import {
  addMapLocation,
  adoptLayoutRegionsAsLocations,
  clampLocationsToMapSize,
  deleteMapLocation,
  findLocationsByName,
  locationsOverlap,
  mapLocations,
  renameMapLocation,
  resizeMapLocation,
  resolveLocation,
  shiftMapLocations,
  topLocationAtPoint,
} from "@/project/mapNamedLocations";
import {
  collectMapLocationReferenceIssues,
  collectMapLocationReferences,
  countLocationReferences,
  repairMapLocationReferences,
} from "@/project/mapLocationReferences";
import { evalCondition } from "@/project/session";
import { eligibleEncounterEntries } from "@/player/encounters";
import { resolveEventPage } from "@/project/io";
import type { Command, GameMap, MapLayoutPlan, Project } from "@/project/types";

const MAP_ID = "loc_map";

function projectWithMap(width = 20, height = 20, layoutPlan?: MapLayoutPlan): Project {
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
    ...(layoutPlan ? { layoutPlan } : {}),
  };
  project.maps[MAP_ID] = map;
  return project;
}

function seedLocations(map: GameMap): void {
  expect(addMapLocation(map, { name: "정문 광장", x: 2, y: 2, w: 6, h: 6 }).ok).toBe(true);
  expect(addMapLocation(map, { name: "북쪽 숲", x: 10, y: 1, w: 8, h: 8 }).ok).toBe(true);
}

function sessionAt(x: number, y: number): Parameters<typeof evalCondition>[0] {
  const project = createBlankProject();
  return { ...project.session, currentMapId: MAP_ID, x, y } as Parameters<typeof evalCondition>[0];
}

describe("map named locations — CRUD and stable identity", () => {
  it("draws, names, renames and resizes while the stable id never changes", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    const created = addMapLocation(map, { name: "정문 광장", x: 3, y: 4, w: 5, h: 5 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.location.id;

    expect(renameMapLocation(map, id, "중앙 광장").ok).toBe(true);
    expect(mapLocations(map)[0]?.id).toBe(id);
    expect(mapLocations(map)[0]?.name).toBe("중앙 광장");

    expect(resizeMapLocation(map, id, { x: 3, y: 4, w: 9, h: 2 }).ok).toBe(true);
    expect(mapLocations(map)[0]).toMatchObject({ id, x: 3, y: 4, w: 9, h: 2 });

    expect(deleteMapLocation(map, id)).toBe(true);
    expect(map.locations).toBeUndefined();
  });

  it("mints ids that stay unique after deletions and resolves by id or name", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const ids = mapLocations(map).map((entry) => entry.id);
    expect(new Set(ids).size).toBe(2);

    deleteMapLocation(map, ids[0]!);
    const third = addMapLocation(map, { name: "부두", x: 1, y: 15, w: 4, h: 4 });
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(mapLocations(map).map((entry) => entry.id)).toHaveLength(2);
    expect(new Set(mapLocations(map).map((entry) => entry.id)).size).toBe(2);

    expect(resolveLocation(map, third.location.id)?.name).toBe("부두");
    expect(resolveLocation(map, "부두")?.id).toBe(third.location.id);
    // 부분일치도 해석한다 — 조수가 사용자 말을 그대로 넘길 수 있어야 한다.
    expect(resolveLocation(map, "북쪽")?.name).toBe("북쪽 숲");
    expect(resolveLocation(map, "없는 이름")).toBeUndefined();
  });

  it("clamps a rectangle drawn partly outside the map and refuses a fully outside one", () => {
    const project = projectWithMap(10, 10);
    const map = project.maps[MAP_ID];
    const partial = addMapLocation(map, { name: "가장자리", x: 8, y: 8, w: 6, h: 6 });
    expect(partial.ok).toBe(true);
    if (partial.ok) expect(partial.location).toMatchObject({ x: 8, y: 8, w: 2, h: 2 });
    const outside = addMapLocation(map, { name: "밖", x: 40, y: 40, w: 2, h: 2 });
    expect(outside.ok).toBe(false);
  });
});

describe("map named locations — overlap contract", () => {
  it("allows overlap and resolves a point to the most specific (smallest) location", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    const outer = addMapLocation(map, { name: "상점가", x: 0, y: 0, w: 12, h: 12 });
    const inner = addMapLocation(map, { name: "좌판", x: 4, y: 4, w: 2, h: 2 });
    expect(outer.ok && inner.ok).toBe(true);
    if (!outer.ok || !inner.ok) return;
    expect(locationsOverlap(outer.location, inner.location)).toBe(true);
    expect(topLocationAtPoint(map, { x: 5, y: 5 })?.id).toBe(inner.location.id);
    expect(topLocationAtPoint(map, { x: 1, y: 1 })?.id).toBe(outer.location.id);
    expect(topLocationAtPoint(map, { x: 19, y: 19 })).toBeUndefined();
  });

  it("breaks equal-area ties by authoring order, not by object identity", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    const first = addMapLocation(map, { name: "A", x: 2, y: 2, w: 4, h: 4 });
    const second = addMapLocation(map, { name: "B", x: 3, y: 3, w: 4, h: 4 });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok) return;
    expect(topLocationAtPoint(map, { x: 4, y: 4 })?.id).toBe(first.location.id);
  });
});

describe("map named locations — map resize, shift and copy", () => {
  it("clamps locations on shrink instead of deleting them, and lint flags the degenerate one", () => {
    const project = projectWithMap(20, 20);
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const outsideId = addMapLocation(map, { name: "먼 구역", x: 16, y: 16, w: 3, h: 3 });
    expect(outsideId.ok).toBe(true);

    const changed = clampLocationsToMapSize(map, 8, 8);
    expect(mapLocations(map)).toHaveLength(3);
    expect(changed.length).toBeGreaterThan(0);
    // 완전히 밖으로 나간 구역도 살아남는다(참조가 조용히 끊기지 않게).
    const far = mapLocations(map).find((entry) => entry.name === "먼 구역");
    expect(far).toMatchObject({ x: 7, y: 7, w: 1, h: 1 });
    // 안쪽 구역은 새 경계로 잘린다.
    expect(mapLocations(map).find((entry) => entry.name === "정문 광장")).toMatchObject({ x: 2, y: 2, w: 6, h: 6 });

    map.width = 8;
    map.height = 8;
    map.lowerTiles = new Array(64).fill(TILE.GRASS);
    map.upperTiles = new Array(64).fill(TILE.EMPTY);
    const codes = projectLint(project).map((issue) => issue.code);
    expect(codes).toContain("map-location-degenerate");
  });

  it("shifts locations with map content and clamps at the border", () => {
    const project = projectWithMap(20, 20);
    const map = project.maps[MAP_ID];
    seedLocations(map);
    shiftMapLocations(map, 3, 2);
    expect(mapLocations(map).find((entry) => entry.name === "정문 광장")).toMatchObject({ x: 5, y: 4, w: 6, h: 6 });
    expect(mapLocations(map).find((entry) => entry.name === "북쪽 숲")).toMatchObject({ x: 13, y: 3, w: 7, h: 8 });
  });

  it("map copy carries locations with identical ids so references inside the copy resolve to the copy", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;
    map.encounterTable = [{ troopId: "t1", weight: 1, conditions: { locationId: plazaId } }];

    const copy = cloneGameMap(map, { newId: "copy", newName: "복사", nextEventId: () => "ev_copy" });
    expect(mapLocations(copy).map((entry) => entry.id)).toEqual(mapLocations(map).map((entry) => entry.id));
    // 복사본의 인카운터는 복사본의 로케이션을 가리킨다 — 조건이 맵 경계를 넘지 않기 때문이다.
    expect(copy.encounterTable?.[0]?.conditions?.locationId).toBe(plazaId);
    renameMapLocation(copy, plazaId, "복사본 광장");
    expect(mapLocations(map)[0]?.name).toBe("정문 광장");
  });
});

describe("map named locations — layoutPlan relationship", () => {
  const plan: MapLayoutPlan = {
    version: 1,
    kind: "village-harness-natural-v2",
    regions: [
      { id: "house-a", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 4, h: 4, tags: ["centerish"] },
      { id: "market-a", role: "market", label: "중앙 시장", x: 8, y: 8, w: 5, h: 5 },
    ],
  };

  it("adopts builder regions as locations without touching layoutPlan, and is idempotent", () => {
    const project = projectWithMap(20, 20, structuredClone(plan));
    const map = project.maps[MAP_ID];
    const before = structuredClone(map.layoutPlan);

    const first = adoptLayoutRegionsAsLocations(map);
    expect(first.adopted).toHaveLength(2);
    expect(map.layoutPlan).toEqual(before);
    expect(mapLocations(map).map((entry) => entry.name)).toEqual(["파랑 지붕 집", "중앙 시장"]);
    expect(mapLocations(map)[0]?.origin).toMatchObject({ kind: "layoutRegion", regionId: "house-a", planKind: plan.kind });

    const second = adoptLayoutRegionsAsLocations(map);
    expect(second.adopted).toHaveLength(0);
    expect(second.skipped).toEqual(["house-a", "market-a"]);
    expect(mapLocations(map)).toHaveLength(2);
    expect(map.layoutPlan).toEqual(before);
  });

  it("adopting a subset by role leaves the other regions untouched and unadopted", () => {
    const project = projectWithMap(20, 20, structuredClone(plan));
    const map = project.maps[MAP_ID];
    const result = adoptLayoutRegionsAsLocations(map, { roles: ["market"] });
    expect(result.adopted.map((entry) => entry.name)).toEqual(["중앙 시장"]);
    expect(mapLocations(map)).toHaveLength(1);
    expect(map.layoutPlan?.regions).toHaveLength(2);
  });

  it("a legacy builder map with no locations layer is unchanged by load/save", () => {
    const project = projectWithMap(20, 20, structuredClone(plan));
    expect(project.maps[MAP_ID].locations).toBeUndefined();
    const roundTripped = deserialize(serialize(project));
    expect(roundTripped.maps[MAP_ID].locations).toBeUndefined();
    expect(roundTripped.maps[MAP_ID].layoutPlan).toEqual(plan);
  });

  it("adopted names de-duplicate against an existing human location", () => {
    const project = projectWithMap(20, 20, structuredClone(plan));
    const map = project.maps[MAP_ID];
    addMapLocation(map, { name: "중앙 시장", x: 15, y: 15, w: 2, h: 2 });
    adoptLayoutRegionsAsLocations(map, { roles: ["market"] });
    expect(mapLocations(map).map((entry) => entry.name)).toEqual(["중앙 시장", "중앙 시장 2"]);
    expect(findLocationsByName(map, "중앙 시장 2")).toHaveLength(1);
  });
});

describe("map named locations — schema load / migrate / save", () => {
  it("round-trips a locations layer through serialize/deserialize", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    map.locations![0]!.note = "성문 앞 광장";
    map.locations![0]!.tags = ["quest", "safe"];

    const roundTripped = deserialize(serialize(project));
    expect(roundTripped.maps[MAP_ID].locations).toEqual(map.locations);
  });

  it("rejects a duplicate location id at load", () => {
    const project = projectWithMap();
    project.maps[MAP_ID].locations = [
      { id: "loc1", name: "A", x: 0, y: 0, w: 2, h: 2 },
      { id: "loc1", name: "B", x: 3, y: 3, w: 2, h: 2 },
    ];
    expect(() => deserialize(serialize(project))).toThrow(/중복/);
  });

  it("keeps an out-of-bounds saved rectangle loadable so the user can repair it", () => {
    const project = projectWithMap(10, 10);
    project.maps[MAP_ID].locations = [{ id: "loc1", name: "밖으로 나간 구역", x: 30, y: 30, w: 4, h: 4 }];
    const roundTripped = deserialize(serialize(project));
    expect(roundTripped.maps[MAP_ID].locations?.[0]).toMatchObject({ x: 30, y: 30 });
  });

  it("round-trips an insideLocation event condition and an encounter location reference", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;
    map.encounterTable = [{ troopId: "troop_slime", weight: 2, conditions: { locationId: plazaId } }];
    const fork: Command = {
      kind: "fork",
      condition: { kind: "insideLocation", locationId: plazaId, inside: true },
      then: [{ kind: "text", body: "광장이다" }],
    };
    map.events.push({
      id: "ev1",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [fork],
    } as GameMap["events"][number]);

    const roundTripped = deserialize(serialize(project));
    const loadedFork = roundTripped.maps[MAP_ID].events[0]!.commands[0];
    expect(loadedFork).toMatchObject({ kind: "fork", condition: { kind: "insideLocation", locationId: plazaId, inside: true } });
    expect(roundTripped.maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(plazaId);
  });
});

describe("map named locations — event condition semantics", () => {
  it("evaluates inside/outside against the resolved location", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;

    const inside = { kind: "insideLocation", locationId: plazaId, inside: true } as const;
    const outside = { kind: "insideLocation", locationId: plazaId, inside: false } as const;
    expect(evalCondition(sessionAt(3, 3), inside, undefined, { map })).toBe(true);
    expect(evalCondition(sessionAt(3, 3), outside, undefined, { map })).toBe(false);
    expect(evalCondition(sessionAt(15, 15), inside, undefined, { map })).toBe(false);
    expect(evalCondition(sessionAt(15, 15), outside, undefined, { map })).toBe(true);
    // 경계는 반열림 구간이다: x=2..7 이 안, x=8 은 밖.
    expect(evalCondition(sessionAt(7, 7), inside, undefined, { map })).toBe(true);
    expect(evalCondition(sessionAt(8, 8), inside, undefined, { map })).toBe(false);
  });

  it("a deleted location makes both inside and outside false, never a silent true", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;
    deleteMapLocation(map, plazaId);
    expect(evalCondition(sessionAt(3, 3), { kind: "insideLocation", locationId: plazaId, inside: true }, undefined, { map })).toBe(false);
    expect(evalCondition(sessionAt(3, 3), { kind: "insideLocation", locationId: plazaId, inside: false }, undefined, { map })).toBe(false);
  });

  it("renaming the location does not change condition evaluation (references survive labels)", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;
    const condition = { kind: "insideLocation", locationId: plazaId, inside: true } as const;
    expect(evalCondition(sessionAt(3, 3), condition, undefined, { map })).toBe(true);
    renameMapLocation(map, plazaId, "완전히 다른 이름");
    expect(evalCondition(sessionAt(3, 3), condition, undefined, { map })).toBe(true);
  });

  it("page appearance conditions resolve through the same location context", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;
    const event = {
      id: "ev1",
      x: 1,
      y: 1,
      trigger: { kind: "action" as const },
      commands: [],
      pages: [
        {
          id: "p1",
          conditions: [{ kind: "insideLocation" as const, locationId: plazaId, inside: true }],
          trigger: { kind: "action" as const },
          graphic: {},
          commands: [{ kind: "text" as const, body: "안" }],
        },
      ],
    } as unknown as GameMap["events"][number];

    expect(resolveEventPage(event, sessionAt(3, 3), { locations: map.locations })?.id).toBe("p1");
    expect(resolveEventPage(event, sessionAt(15, 15), { locations: map.locations })).toBeUndefined();
    // 컨텍스트를 주지 않으면 해석 불가 = 거짓. 조용히 참으로 통과시키지 않는다.
    expect(resolveEventPage(event, sessionAt(3, 3))).toBeUndefined();
  });
});

describe("map named locations — encounter references", () => {
  function encounterSession(x: number, y: number) {
    const project = createBlankProject();
    return { ...project.session, currentMapId: MAP_ID, x, y, partyActorIds: [], actorLevels: {} } as never;
  }

  it("an encounter entry follows the referenced location instead of a copied rectangle", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const forestId = mapLocations(map)[1]!.id;
    map.encounterTable = [{ troopId: "t_forest", weight: 3, conditions: { locationId: forestId } }];

    expect(eligibleEncounterEntries(map, encounterSession(12, 3), { x: 12, y: 3 })).toHaveLength(1);
    expect(eligibleEncounterEntries(map, encounterSession(3, 3), { x: 3, y: 3 })).toHaveLength(0);

    // 로케이션을 옮기면 인카운터도 함께 움직인다 — 사각형 사본이 없기 때문이다.
    resizeMapLocation(map, forestId, { x: 0, y: 0, w: 4, h: 4 });
    expect(eligibleEncounterEntries(map, encounterSession(12, 3), { x: 12, y: 3 })).toHaveLength(0);
    expect(eligibleEncounterEntries(map, encounterSession(1, 1), { x: 1, y: 1 })).toHaveLength(1);
  });

  it("legacy raw-rectangle encounters keep working untouched", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    map.encounterTable = [{ troopId: "t_legacy", weight: 1, conditions: { region: { x: 10, y: 10, w: 4, h: 4 } } }];
    expect(eligibleEncounterEntries(map, encounterSession(11, 11), { x: 11, y: 11 })).toHaveLength(1);
    expect(eligibleEncounterEntries(map, encounterSession(1, 1), { x: 1, y: 1 })).toHaveLength(0);
  });

  it("a location reference wins over a coexisting legacy rectangle", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;
    map.encounterTable = [
      { troopId: "t", weight: 1, conditions: { locationId: plazaId, region: { x: 15, y: 15, w: 3, h: 3 } } },
    ];
    expect(eligibleEncounterEntries(map, encounterSession(3, 3), { x: 3, y: 3 })).toHaveLength(1);
    expect(eligibleEncounterEntries(map, encounterSession(16, 16), { x: 16, y: 16 })).toHaveLength(0);
  });

  it("a deleted location suppresses the encounter rather than widening it to the whole map", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;
    map.encounterTable = [{ troopId: "t", weight: 1, conditions: { locationId: plazaId } }];
    deleteMapLocation(map, plazaId);
    expect(eligibleEncounterEntries(map, encounterSession(3, 3), { x: 3, y: 3 })).toHaveLength(0);
  });
});

describe("map named locations — broken references, diagnostics and repair", () => {
  function projectWithReferences(): { project: Project; map: GameMap; plazaId: string; forestId: string } {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;
    const forestId = mapLocations(map)[1]!.id;
    map.encounterTable = [{ troopId: "t", weight: 1, conditions: { locationId: plazaId, timePhase: "night" } }];
    map.events.push({
      id: "ev1",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [
        {
          kind: "fork",
          condition: {
            kind: "all",
            conditions: [
              { kind: "insideLocation", locationId: plazaId, inside: true },
              { kind: "gold", op: ">=", amount: 10 },
            ],
          },
          then: [{ kind: "text", body: "광장" }],
        },
      ],
    } as unknown as GameMap["events"][number]);
    return { project, map, plazaId, forestId };
  }

  it("collects every reference site and counts them", () => {
    const { project, plazaId } = projectWithReferences();
    const refs = collectMapLocationReferences(project);
    expect(refs.filter((ref) => ref.locationId === plazaId)).toHaveLength(2);
    expect(refs.some((ref) => ref.site.kind === "encounter")).toBe(true);
    expect(refs.some((ref) => ref.site.kind === "condition")).toBe(true);
    expect(countLocationReferences(project, plazaId)).toBe(2);
  });

  it("deletion leaves references intact and surfaces a visible lint diagnostic", () => {
    const { project, map, plazaId } = projectWithReferences();
    deleteMapLocation(map, plazaId);
    const issues = collectMapLocationReferenceIssues(project).filter((issue) => issue.code === "map-location-missing-ref");
    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.severity === "error")).toBe(true);
    const lint = projectLint(project).filter((issue) => issue.code === "map-location-missing-ref");
    expect(lint).toHaveLength(2);
    expect(lint[0]?.message).toContain(plazaId);
    // 참조 자체는 데이터에 남아 있다 — 조용히 지우지 않는다.
    expect(map.encounterTable?.[0]?.conditions?.locationId).toBe(plazaId);
  });

  it("repairs by remapping every site to another location", () => {
    const { project, map, plazaId, forestId } = projectWithReferences();
    deleteMapLocation(map, plazaId);
    const result = repairMapLocationReferences(project, plazaId, { kind: "remap", locationId: forestId });
    expect(result.repaired).toBe(2);
    expect(map.encounterTable?.[0]?.conditions?.locationId).toBe(forestId);
    expect(collectMapLocationReferenceIssues(project).filter((issue) => issue.code === "map-location-missing-ref")).toHaveLength(0);
    const fork = map.events[0]!.commands[0] as Extract<Command, { kind: "fork" }>;
    expect(fork.condition).toMatchObject({
      kind: "all",
      conditions: [{ kind: "insideLocation", locationId: forestId, inside: true }, { kind: "gold" }],
    });
  });

  it("repairs by detaching: the encounter keeps other conditions and the condition group drops one leaf", () => {
    const { project, map, plazaId } = projectWithReferences();
    deleteMapLocation(map, plazaId);
    const result = repairMapLocationReferences(project, plazaId, { kind: "detach" });
    expect(result.repaired).toBe(2);
    expect(map.encounterTable?.[0]?.conditions).toEqual({ timePhase: "night" });
    const fork = map.events[0]!.commands[0] as Extract<Command, { kind: "fork" }>;
    expect(fork.condition).toMatchObject({ kind: "all", conditions: [{ kind: "gold", op: ">=", amount: 10 }] });
    expect(fork.then).toHaveLength(1);
  });

  it("repairs an encounter by freezing the old rectangle back into a legacy raw region", () => {
    const { project, map, plazaId } = projectWithReferences();
    const rect = { x: 2, y: 2, w: 6, h: 6 };
    deleteMapLocation(map, plazaId);
    const result = repairMapLocationReferences(project, plazaId, { kind: "freezeRect", rect });
    expect(result.repaired).toBe(2);
    expect(map.encounterTable?.[0]?.conditions).toEqual({ timePhase: "night", region: rect });
  });

  it("a fork whose whole condition was the missing location becomes always-true instead of vanishing", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    seedLocations(map);
    const plazaId = mapLocations(map)[0]!.id;
    map.events.push({
      id: "ev1",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [
        { kind: "fork", condition: { kind: "insideLocation", locationId: plazaId, inside: true }, then: [{ kind: "text", body: "지켜야 함" }] },
      ],
    } as unknown as GameMap["events"][number]);
    deleteMapLocation(map, plazaId);
    repairMapLocationReferences(project, plazaId, { kind: "detach" });
    const fork = map.events[0]!.commands[0] as Extract<Command, { kind: "fork" }>;
    expect(fork.condition).toEqual({ kind: "all", conditions: [] });
    expect(fork.then).toHaveLength(1);
    expect(evalCondition(sessionAt(0, 0), fork.condition, undefined, { map })).toBe(true);
  });

  it("warns about duplicate display names without blocking them", () => {
    const project = projectWithMap();
    const map = project.maps[MAP_ID];
    addMapLocation(map, { name: "광장", x: 0, y: 0, w: 2, h: 2 });
    addMapLocation(map, { name: "광장", x: 5, y: 5, w: 2, h: 2 });
    expect(mapLocations(map)).toHaveLength(2);
    const codes = collectMapLocationReferenceIssues(project).map((issue) => issue.code);
    expect(codes).toContain("map-location-duplicate-name");
  });
});
