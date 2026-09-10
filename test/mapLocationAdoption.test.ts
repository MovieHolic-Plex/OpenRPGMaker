/** @vitest-environment happy-dom */
// LOC-ADOPT — 「설계 영역 이관」 도구의 계약 회귀.
//
// 이 파일이 고정하는 것은 도구의 편의가 아니라 **안전**이다:
// 조사는 아무것도 바꾸지 않고, 실행은 고른 맵에만 적용되며, 두 번 돌려도 늘지 않고,
// layoutPlan 은 바이트 동일하고, 되돌림은 한 번이며, 이름 충돌은 보이고, 재시공은 복제하지 않는다.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import { addMapLocation, findLocationById, mapLocations } from "@/project/mapNamedLocations";
import {
  DEFAULT_ADOPTION_ROLES,
  adoptLayoutRegionsForMaps,
  adoptionRoleCaution,
  adoptionRoleLabel,
  describeAdoptionOutcome,
  surveyMapAdoption,
  surveyProjectAdoption,
} from "@/project/mapLocationAdoption";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import {
  currentAdoptionSurvey,
  openAdoptionWorkbench,
  resetAdoptionWorkbench,
  runAdoption,
  setAdoptionCollisionPolicy,
  setAdoptionMapSelection,
  toggleAdoptionRole,
} from "@/editor/mapLocationAdoptionState";
import type { GameMap, MapLayoutPlan, MapLayoutRegion, Project } from "@/project/types";

const VILLAGE = "village_map";
const HAMLET = "hamlet_map";
const PLAIN = "plain_map";

function makeMap(id: string, name: string, layoutPlan?: MapLayoutPlan): GameMap {
  const width = 40;
  const height = 40;
  return {
    id,
    name,
    width,
    height,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(width * height).fill(TILE.GRASS),
    upperTiles: new Array(width * height).fill(TILE.EMPTY),
    events: [],
    ...(layoutPlan ? { layoutPlan } : {}),
  };
}

function villagePlan(): MapLayoutPlan {
  return {
    version: 1,
    kind: "large-river-market-village",
    regions: [
      { id: "plaza_1", role: "plaza", label: "중앙 광장", x: 10, y: 10, w: 6, h: 6, tags: ["commons"] },
      { id: "market_1", role: "market", label: "북쪽 상점가", x: 20, y: 4, w: 8, h: 5, tags: ["shop"] },
      { id: "house_1", role: "house", label: "파랑 지붕 석벽 집 (ㄱ자)", x: 2, y: 2, w: 5, h: 5 },
      { id: "house_2", role: "house", label: "밝은 회벽 집 (사각)", x: 2, y: 12, w: 5, h: 5 },
      { id: "river_1", role: "river", label: "서쪽 강", x: 0, y: 30, w: 40, h: 4, tags: ["water"] },
    ],
  };
}

function hamletPlan(): MapLayoutPlan {
  return {
    version: 1,
    kind: "village-harness-natural-v2",
    regions: [{ id: "village_commons", role: "plaza", label: "중앙 녹지 광장", x: 5, y: 5, w: 8, h: 8 }],
  };
}

function seedProject(): Project {
  const project = createBlankProject();
  project.maps[VILLAGE] = makeMap(VILLAGE, "큰 강 마을", villagePlan());
  project.maps[HAMLET] = makeMap(HAMLET, "작은 마을", hamletPlan());
  // 설계 기록이 없는 맵은 조사에 아예 나오지 않아야 한다.
  project.maps[PLAIN] = makeMap(PLAIN, "빈 들판");
  project.startMapId = VILLAGE;
  return project;
}

function installProject(): Project {
  const project = seedProject();
  store.replace(project);
  editorState.set({ currentMapId: VILLAGE });
  resetMapEditHistory();
  resetAdoptionWorkbench();
  return project;
}

afterEach(() => {
  resetAdoptionWorkbench();
  resetMapEditHistory();
});

// ────────────────────────────────────────────────────── 1. 조사(읽기 전용)

describe("adoption survey", () => {
  it("lists only maps that have builder regions, with per-map adoptable counts", () => {
    const project = seedProject();
    const survey = surveyProjectAdoption(project);
    expect(survey.maps.map((map) => map.mapId).sort()).toEqual([HAMLET, VILLAGE]);
    // 기본 역할은 광장·장터뿐이므로 마을은 2개, 작은 마을은 광장 1개.
    expect(survey.maps.find((map) => map.mapId === VILLAGE)?.adoptableCount).toBe(2);
    expect(survey.maps.find((map) => map.mapId === HAMLET)?.adoptableCount).toBe(1);
    expect(survey.totalAdoptable).toBe(3);
  });

  it("surveying does not mutate the project — no locations field appears", () => {
    const project = seedProject();
    const before = JSON.stringify(project);
    surveyProjectAdoption(project);
    surveyProjectAdoption(project, { roles: ["house", "plaza", "market", "river"] });
    surveyMapAdoption(project.maps[VILLAGE]!);
    expect(JSON.stringify(project)).toBe(before);
    expect(project.maps[VILLAGE]!.locations).toBeUndefined();
  });

  it("reports every observed role with total counts so the filter UI can show what is hidden", () => {
    const project = seedProject();
    const survey = surveyProjectAdoption(project);
    expect(survey.roles).toEqual(["house", "market", "plaza", "river"]);
    const village = survey.maps.find((map) => map.mapId === VILLAGE)!;
    expect(village.roleCounts).toEqual([
      { role: "house", total: 2, adoptable: 2 },
      { role: "market", total: 1, adoptable: 1 },
      { role: "plaza", total: 1, adoptable: 1 },
      { role: "river", total: 1, adoptable: 1 },
    ]);
  });

  it("counts already-adopted regions separately from adoptable ones", () => {
    const project = seedProject();
    adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    const village = surveyProjectAdoption(project).maps.find((map) => map.mapId === VILLAGE)!;
    expect(village.adoptableCount).toBe(0);
    expect(village.adoptedCount).toBe(2);
  });

  it("flags name collisions before anything is written", () => {
    const project = seedProject();
    addMapLocation(project.maps[VILLAGE]!, { name: "중앙 광장", x: 30, y: 30, w: 2, h: 2 });
    const village = surveyProjectAdoption(project).maps.find((map) => map.mapId === VILLAGE)!;
    expect(village.collisions).toEqual([{ regionId: "plaza_1", name: "중앙 광장" }]);
  });
});

// ────────────────────────────────────────────────────── 2. 역할 필터

describe("role filtering", () => {
  it("defaults to commons roles only and never silently adopts construction lots", () => {
    expect([...DEFAULT_ADOPTION_ROLES]).toEqual(["plaza", "market"]);
    const project = seedProject();
    const outcome = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    expect(outcome.adopted.map((entry) => entry.name)).toEqual(["중앙 광장", "북쪽 상점가"]);
    // house / river 는 손대지 않았다.
    expect(mapLocations(project.maps[VILLAGE]!).some((entry) => entry.name.includes("집"))).toBe(false);
  });

  it("adopts construction roles only when they are explicitly selected", () => {
    const project = seedProject();
    const outcome = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE], roles: ["house"] });
    expect(outcome.adopted).toHaveLength(2);
    expect(mapLocations(project.maps[VILLAGE]!).map((entry) => entry.name)).toEqual([
      "파랑 지붕 석벽 집 (ㄱ자)",
      "밝은 회벽 집 (사각)",
    ]);
  });

  it("gives a machine-readable reason for every non-default role and none for defaults", () => {
    for (const role of DEFAULT_ADOPTION_ROLES) expect(adoptionRoleCaution(role)).toBeUndefined();
    expect(adoptionRoleCaution("house")).toContain("houseProtection");
    expect(adoptionRoleCaution("river")).toBeTruthy();
    expect(adoptionRoleLabel("plaza")).toBe("광장");
  });

  it("an empty role selection adopts nothing", () => {
    const project = seedProject();
    const outcome = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE], roles: [] });
    expect(outcome.adopted).toHaveLength(0);
    expect(project.maps[VILLAGE]!.locations).toBeUndefined();
  });
});

// ──────────────────────────────────────── 3. 명시적 선택 / 멱등 / layoutPlan 불변

describe("explicit, idempotent adoption", () => {
  it("touches only the selected maps", () => {
    const project = seedProject();
    adoptLayoutRegionsForMaps(project, { mapIds: [HAMLET] });
    expect(mapLocations(project.maps[HAMLET]!)).toHaveLength(1);
    expect(project.maps[VILLAGE]!.locations).toBeUndefined();
  });

  it("an empty map selection is a no-op — there is no project-wide sweep", () => {
    const project = seedProject();
    const before = JSON.stringify(project);
    const outcome = adoptLayoutRegionsForMaps(project, { mapIds: [] });
    expect(outcome.adopted).toHaveLength(0);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("running twice adds nothing and reports the skips", () => {
    const project = seedProject();
    const first = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE, HAMLET] });
    expect(first.adopted).toHaveLength(3);
    const afterFirst = JSON.stringify(project);

    const second = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE, HAMLET] });
    expect(second.adopted).toHaveLength(0);
    expect(second.rebound).toHaveLength(0);
    expect(second.skippedAlreadyAdopted).toHaveLength(3);
    expect(JSON.stringify(project)).toBe(afterFirst);
    expect(describeAdoptionOutcome(second)).toContain("두 번 돌려도 늘지 않습니다");
  });

  it("leaves layoutPlan byte-identical across both runs", () => {
    const project = seedProject();
    const before = JSON.stringify(project.maps[VILLAGE]!.layoutPlan);
    adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE], roles: ["plaza", "market", "house", "river"] });
    expect(JSON.stringify(project.maps[VILLAGE]!.layoutPlan)).toBe(before);
    adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE], roles: ["plaza", "market", "house", "river"] });
    expect(JSON.stringify(project.maps[VILLAGE]!.layoutPlan)).toBe(before);
  });

  it("adopted locations carry stable ids and a layoutRegion origin snapshot", () => {
    const project = seedProject();
    const outcome = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    const plaza = outcome.adopted[0]!;
    expect(plaza.locationId).toMatch(/^loc\d+$/);
    const location = findLocationById(project.maps[VILLAGE]!, plaza.locationId)!;
    expect(location.origin).toEqual({ kind: "layoutRegion", regionId: "plaza_1", planKind: "large-river-market-village" });
    // 이름을 바꿔도 ID 는 그대로 — 기존 참조 계약.
    location.name = "사람이 고친 이름";
    expect(findLocationById(project.maps[VILLAGE]!, plaza.locationId)?.id).toBe(plaza.locationId);
    const again = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    expect(again.adopted).toHaveLength(0);
    expect(findLocationById(project.maps[VILLAGE]!, plaza.locationId)?.name).toBe("사람이 고친 이름");
  });

  it("regionIds narrows adoption inside a selected map", () => {
    const project = seedProject();
    const outcome = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE], regionIds: ["market_1"] });
    expect(outcome.adopted.map((entry) => entry.regionId)).toEqual(["market_1"]);
  });
});

// ──────────────────────────────────────────────────── 4. 이름 충돌

describe("name collisions are visible, never silent", () => {
  it("suffix policy reports the original name it had to move away from", () => {
    const project = seedProject();
    addMapLocation(project.maps[VILLAGE]!, { name: "중앙 광장", x: 30, y: 30, w: 2, h: 2 });
    const outcome = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE], collisionPolicy: "suffix" });
    const plaza = outcome.adopted.find((entry) => entry.regionId === "plaza_1")!;
    expect(plaza.name).toBe("중앙 광장 2");
    expect(plaza.renamedFrom).toBe("중앙 광장");
    expect(describeAdoptionOutcome(outcome)).toContain("이름 충돌");
  });

  it("skip policy leaves the colliding region unadopted and names it in the receipt", () => {
    const project = seedProject();
    addMapLocation(project.maps[VILLAGE]!, { name: "중앙 광장", x: 30, y: 30, w: 2, h: 2 });
    const outcome = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE], collisionPolicy: "skip" });
    expect(outcome.adopted.map((entry) => entry.regionId)).toEqual(["market_1"]);
    expect(outcome.skippedNameCollision).toEqual([{ mapId: VILLAGE, regionId: "plaza_1", name: "중앙 광장" }]);
  });

  it("never renames or re-ids an existing human location", () => {
    const project = seedProject();
    const existing = addMapLocation(project.maps[VILLAGE]!, { name: "중앙 광장", x: 30, y: 30, w: 2, h: 2 });
    expect(existing.ok).toBe(true);
    const existingId = existing.ok ? existing.location.id : "";
    adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    const survivor = findLocationById(project.maps[VILLAGE]!, existingId)!;
    expect(survivor.name).toBe("중앙 광장");
    expect(survivor.origin).toBeUndefined();
  });

  it("two regions with the same label inside one run get distinct names", () => {
    const project = seedProject();
    const plan = project.maps[VILLAGE]!.layoutPlan!;
    plan.regions.push({ id: "plaza_2", role: "plaza", label: "중앙 광장", x: 25, y: 25, w: 3, h: 3 } as MapLayoutRegion);
    const outcome = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    const names = outcome.adopted.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("중앙 광장 2");
  });
});

// ──────────────────────────────────── 5. 빌더 재시공 후 재실행 (복제 금지)

describe("adoption after a builder rebuild", () => {
  /** 재시공: 배열을 통째로 갈아치우고, 같은 장소가 새 region id 를 받는다(uniqueHouseRegionId 의 실제 성질). */
  function rebuild(map: GameMap): void {
    map.layoutPlan = {
      version: 1,
      kind: "large-river-market-village",
      regions: [
        { id: "plaza_7", role: "plaza", label: "중앙 광장", x: 10, y: 10, w: 6, h: 6, tags: ["commons"] },
        { id: "market_7", role: "market", label: "북쪽 상점가", x: 20, y: 4, w: 8, h: 5, tags: ["shop"] },
      ],
    };
  }

  it("re-running after a rebuild rebinds instead of duplicating the same place", () => {
    const project = seedProject();
    const first = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    expect(first.adopted).toHaveLength(2);
    const idsAfterFirst = mapLocations(project.maps[VILLAGE]!).map((entry) => entry.id);

    rebuild(project.maps[VILLAGE]!);
    const second = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    expect(second.adopted).toHaveLength(0);
    expect(second.rebound).toHaveLength(2);
    // 로케이션 수도, 로케이션 ID 도 그대로 — 기존 참조가 살아 있다는 뜻이다.
    expect(mapLocations(project.maps[VILLAGE]!)).toHaveLength(2);
    expect(mapLocations(project.maps[VILLAGE]!).map((entry) => entry.id)).toEqual(idsAfterFirst);
    // 출처만 새 region id 로 갱신됐다.
    expect(mapLocations(project.maps[VILLAGE]!)[0]?.origin).toMatchObject({ regionId: "plaza_7" });
  });

  it("a third run after the rebuild is a plain no-op", () => {
    const project = seedProject();
    adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    rebuild(project.maps[VILLAGE]!);
    adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    const snapshot = JSON.stringify(project.maps[VILLAGE]);
    const third = adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    expect(third.adopted).toHaveLength(0);
    expect(third.rebound).toHaveLength(0);
    expect(third.skippedAlreadyAdopted).toHaveLength(2);
    expect(JSON.stringify(project.maps[VILLAGE])).toBe(snapshot);
  });

  it("a rebuild that truly drops a region reports the leftover as orphaned instead of deleting it", () => {
    const project = seedProject();
    adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    project.maps[VILLAGE]!.layoutPlan = {
      version: 1,
      kind: "large-river-market-village",
      regions: [{ id: "plaza_9", role: "plaza", label: "중앙 광장", x: 10, y: 10, w: 6, h: 6 }],
    };
    const village = surveyProjectAdoption(project).maps.find((map) => map.mapId === VILLAGE)!;
    expect(village.orphanedLocations.map((entry) => entry.name)).toEqual(["북쪽 상점가"]);
    // 조사는 고아를 지우지 않는다.
    expect(mapLocations(project.maps[VILLAGE]!)).toHaveLength(2);
  });
});

// ────────────────────────────────────────────── 6. 되돌림 한 덩어리 (편집기 경로)

describe("editor workbench — one undoable author action", () => {
  beforeEach(() => {
    installProject();
  });

  it("opening the workbench mutates nothing", () => {
    const before = JSON.stringify(store.getCurrent());
    openAdoptionWorkbench();
    const survey = currentAdoptionSurvey();
    expect(survey.maps).toHaveLength(2);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("refuses to run with no map selected", () => {
    openAdoptionWorkbench();
    const result = runAdoption();
    expect(result.ok).toBe(false);
    expect(store.getCurrent().maps[VILLAGE]!.locations).toBeUndefined();
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("undoes a multi-map adoption with a single undo", () => {
    openAdoptionWorkbench();
    setAdoptionMapSelection([VILLAGE, HAMLET]);
    const result = runAdoption();
    expect(result.ok).toBe(true);
    expect(mapLocations(store.getCurrent().maps[VILLAGE]!)).toHaveLength(2);
    expect(mapLocations(store.getCurrent().maps[HAMLET]!)).toHaveLength(1);

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[VILLAGE]!.locations).toBeUndefined();
    expect(store.getCurrent().maps[HAMLET]!.locations).toBeUndefined();
    // 한 번이면 충분했다 — 남은 되돌림이 없다.
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("undo restores the pre-adoption layoutPlan byte-for-byte", () => {
    const planBefore = JSON.stringify(store.getCurrent().maps[VILLAGE]!.layoutPlan);
    openAdoptionWorkbench();
    setAdoptionMapSelection([VILLAGE]);
    runAdoption();
    undoMapEdit();
    expect(JSON.stringify(store.getCurrent().maps[VILLAGE]!.layoutPlan)).toBe(planBefore);
  });

  it("the second run through the workbench is idempotent and says so", () => {
    openAdoptionWorkbench();
    setAdoptionMapSelection([VILLAGE]);
    const first = runAdoption();
    expect(first.ok && first.outcome.adopted).toHaveLength(2);
    const second = runAdoption();
    expect(second.ok).toBe(true);
    expect(second.ok && second.outcome.adopted).toHaveLength(0);
    expect(second.ok && second.message).toContain("이미 전부 승격돼 있습니다");
    expect(mapLocations(store.getCurrent().maps[VILLAGE]!)).toHaveLength(2);
  });

  it("role toggles change what the survey and the run produce", () => {
    openAdoptionWorkbench();
    toggleAdoptionRole("house", true);
    expect(currentAdoptionSurvey().maps.find((map) => map.mapId === VILLAGE)?.adoptableCount).toBe(4);
    setAdoptionMapSelection([VILLAGE]);
    runAdoption();
    expect(mapLocations(store.getCurrent().maps[VILLAGE]!)).toHaveLength(4);
  });

  it("the collision policy chosen in the workbench reaches the run", () => {
    store.update((project) => {
      addMapLocation(project.maps[VILLAGE]!, { name: "중앙 광장", x: 30, y: 30, w: 2, h: 2 });
    });
    openAdoptionWorkbench();
    setAdoptionCollisionPolicy("skip");
    setAdoptionMapSelection([VILLAGE]);
    const result = runAdoption();
    expect(result.ok && result.outcome.skippedNameCollision).toHaveLength(1);
    expect(result.ok && result.outcome.adopted.map((entry) => entry.regionId)).toEqual(["market_1"]);
  });
});

// ─────────────────────────────────────────────── 7. 저장/불러오기 왕복

describe("project save / load round-trip", () => {
  it("adopted locations survive serialize → deserialize with ids, origins and layoutPlan intact", () => {
    const project = seedProject();
    adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE, HAMLET], roles: ["plaza", "market", "house"] });
    const planBefore = JSON.stringify(project.maps[VILLAGE]!.layoutPlan);
    const locationsBefore = JSON.stringify(project.maps[VILLAGE]!.locations);

    const roundTripped = deserialize(serialize(project));
    expect(JSON.stringify(roundTripped.maps[VILLAGE]!.layoutPlan)).toBe(planBefore);
    expect(JSON.stringify(roundTripped.maps[VILLAGE]!.locations)).toBe(locationsBefore);
    expect(roundTripped.maps[PLAIN]!.locations).toBeUndefined();
  });

  it("re-running adoption after a reload is still idempotent", () => {
    const project = seedProject();
    adoptLayoutRegionsForMaps(project, { mapIds: [VILLAGE] });
    const reloaded = deserialize(serialize(project));
    const again = adoptLayoutRegionsForMaps(reloaded, { mapIds: [VILLAGE] });
    expect(again.adopted).toHaveLength(0);
    expect(again.skippedAlreadyAdopted).toHaveLength(2);
    expect(mapLocations(reloaded.maps[VILLAGE]!)).toHaveLength(2);
  });

  it("a legacy builder map that was never adopted is unchanged by load/save", () => {
    const project = seedProject();
    const before = JSON.stringify(project.maps[VILLAGE]);
    surveyProjectAdoption(project);
    const roundTripped = deserialize(serialize(project));
    expect(JSON.stringify(roundTripped.maps[VILLAGE])).toBe(before);
  });
});
