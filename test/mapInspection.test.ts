import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  collectMapInspection,
  isFolderNode,
  reachableMapIdsFromStart,
} from "@/project/mapInspection";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";

/** 시작 맵을 틀로 써서 같은 규격의 빈 맵을 추가한다 (실제 프로젝트의 "집 내부 10장" 모양). */
function addMap(project: Project, id: MapId, name: string): GameMap {
  const template = project.maps[project.startMapId];
  if (!template) throw new Error("blank project has no start map");
  const map: GameMap = { ...template, id, name, events: [] };
  project.maps[id] = map;
  project.mapTree.children.push({ mapId: id, children: [] });
  return map;
}

function event(id: string, commands: GameEvent["commands"]): GameEvent {
  return { commands, id, trigger: { kind: "action" }, x: 1, y: 1 };
}

describe("collectMapInspection", () => {
  it("맵이 아니면(폴더 노드·지운 id) null 을 준다", () => {
    const project = createBlankProject();
    project.mapTree.children.push({ children: [], kind: "folder", mapId: "folder_town", name: "마을" });
    expect(collectMapInspection(project, "folder_town")).toBeNull();
    expect(collectMapInspection(project, "map_gone")).toBeNull();
    expect(isFolderNode(project, "folder_town")).toBe(true);
    expect(isFolderNode(project, project.startMapId)).toBe(false);
  });

  it("이벤트를 역할별로 한 칸씩만 세고 합이 total 과 맞는다", () => {
    const project = createBlankProject();
    const start = project.maps[project.startMapId];
    if (!start) throw new Error("no start map");
    addMap(project, "map_inside", "안");
    start.events = [
      event("ev_door", [{ kind: "transfer", mapId: "map_inside", x: 2, y: 2 }]),
      // 문이 달린 상점은 문으로 센다 — classifyEvent 의 우선순위 계약.
      event("ev_shop_door", [
        { kind: "shop", itemIds: [] } as never,
        { kind: "transfer", mapId: "map_inside", x: 3, y: 3 },
      ]),
      event("ev_shop", [{ kind: "shop", itemIds: [] } as never]),
      event("ev_chest", [{ itemId: "it_potion", kind: "openChest" } as never]),
      event("ev_npc", [{ kind: "text", text: "안녕" } as never]),
      event("ev_switch", [{ kind: "setSwitch", switchId: "sw_a", value: true } as never]),
    ];

    const inspection = collectMapInspection(project, project.startMapId);
    expect(inspection).not.toBeNull();
    const events = inspection?.events;
    expect(events?.total).toBe(6);
    expect(events?.door).toBe(2);
    expect(events?.shop).toBe(1);
    expect(events?.chest).toBe(1);
    expect(events?.npc).toBe(1);
    expect(events?.other).toBe(1);
    const sum = (events?.door ?? 0) + (events?.shop ?? 0) + (events?.chest ?? 0) + (events?.npc ?? 0) + (events?.other ?? 0);
    expect(sum).toBe(events?.total);
  });

  it("분기 안에 숨은 transfer 도 문으로 센다", () => {
    const project = createBlankProject();
    const start = project.maps[project.startMapId];
    if (!start) throw new Error("no start map");
    addMap(project, "map_inside", "안");
    start.events = [
      event("ev_choice", [{
        kind: "choices",
        options: [{ branch: [{ kind: "transfer", mapId: "map_inside", x: 1, y: 1 }], label: "들어간다" }],
        prompt: "들어갈까?",
      } as never]),
    ];
    expect(collectMapInspection(project, project.startMapId)?.events.door).toBe(1);
  });

  it("크기·계층·시작 여부를 낸다", () => {
    const project = createBlankProject();
    const child = addMap(project, "map_child", "집 내부");
    child.width = 13;
    child.height = 10;
    // 손자를 달아 childCount 가 직속 자식만 세는지 본다.
    project.mapTree.children = project.mapTree.children.map((node) =>
      node.mapId === "map_child" ? { ...node, children: [{ children: [], mapId: "map_grand" }] } : node,
    );
    project.maps["map_grand"] = { ...child, events: [], id: "map_grand", name: "지하" };

    const inspection = collectMapInspection(project, "map_child");
    expect(inspection?.width).toBe(13);
    expect(inspection?.height).toBe(10);
    expect(inspection?.tileCount).toBe(130);
    expect(inspection?.childCount).toBe(1);
    expect(inspection?.isStart).toBe(false);
    // 루트 맵의 자식이므로 상위 맵 이름은 루트 맵 이름이다.
    expect(inspection?.parentName).toBe(project.maps[project.startMapId]?.name);
    expect(collectMapInspection(project, project.startMapId)?.isStart).toBe(true);
    // 루트는 상위가 없다 — "루트" 라는 글자는 렌더러가 붙인다.
    expect(collectMapInspection(project, project.startMapId)?.parentName).toBeNull();
  });

  it("조우율이 0 이면 인카운터는 꺼진 것으로 본다", () => {
    const project = createBlankProject();
    const map = addMap(project, "map_field", "들판");
    map.encounterRate = 0;
    map.troopIds = ["tr_slime"];
    expect(collectMapInspection(project, "map_field")?.encounter.enabled).toBe(false);

    map.encounterRate = 30;
    const on = collectMapInspection(project, "map_field")?.encounter;
    expect(on?.enabled).toBe(true);
    expect(on?.rate).toBe(30);
    expect(on?.troopCount).toBe(1);
  });

  it("조우율만 있고 적이 없으면 경고한다", () => {
    const project = createBlankProject();
    const map = addMap(project, "map_field", "들판");
    map.encounterRate = 30;
    map.troopIds = [];
    map.encounterTable = [];
    const ids = collectMapInspection(project, "map_field")?.diagnostics.map((d) => d.id) ?? [];
    expect(ids).toContain("encounter-empty");
  });

  it("이동이 하나도 없으면 고립으로 경고하고, 도달 불가와 겹쳐 말하지 않는다", () => {
    const project = createBlankProject();
    addMap(project, "map_island", "외딴 섬");
    const diagnostics = collectMapInspection(project, "map_island")?.diagnostics ?? [];
    const ids = diagnostics.map((d) => d.id);
    expect(ids).toContain("unlinked");
    expect(ids).not.toContain("unreachable");
    expect(diagnostics.find((d) => d.id === "unlinked")?.severity).toBe("warning");
  });

  it("나가는 문만 있고 들어오는 문이 없으면 도달 불가로 경고한다", () => {
    const project = createBlankProject();
    const start = project.maps[project.startMapId];
    if (!start) throw new Error("no start map");
    const far = addMap(project, "map_far", "먼 곳");
    // 먼 곳 → 시작 맵 (한 방향). 시작 맵에서 먼 곳으로 갈 길이 없다.
    far.events = [event("ev_back", [{ kind: "transfer", mapId: project.startMapId, x: 1, y: 1 }])];

    const ids = collectMapInspection(project, "map_far")?.diagnostics.map((d) => d.id) ?? [];
    expect(ids).toContain("unreachable");
    expect(ids).not.toContain("unlinked");

    // 시작 맵에서 문을 놓아 주면 경고가 사라진다.
    start.events = [event("ev_go", [{ kind: "transfer", mapId: "map_far", x: 1, y: 1 }])];
    const after = collectMapInspection(project, "map_far")?.diagnostics.map((d) => d.id) ?? [];
    expect(after).not.toContain("unreachable");
  });

  it("타일셋이 없으면 그려지지 않는다고 경고한다", () => {
    const project = createBlankProject();
    const map = addMap(project, "map_broken", "깨진 맵");
    map.tilesetId = "ts_gone";
    const inspection = collectMapInspection(project, "map_broken");
    expect(inspection?.tilesetName).toBeNull();
    expect(inspection?.diagnostics.map((d) => d.id)).toContain("tileset-missing");
  });

  it("켜진 맵 옵션만 목록에 넣는다", () => {
    const project = createBlankProject();
    const map = addMap(project, "map_dungeon", "던전");
    expect(collectMapInspection(project, "map_dungeon")?.options).toEqual([]);

    map.disableSave = true;
    map.disableTeleport = true;
    const ids = collectMapInspection(project, "map_dungeon")?.options.map((flag) => flag.id) ?? [];
    expect(ids).toEqual(["no-save", "no-teleport"]);
  });

  it("BGM 은 맵 설정과 같은 어휘로 말한다", () => {
    const project = createBlankProject();
    const map = addMap(project, "map_bgm", "곡 있는 맵");
    expect(collectMapInspection(project, "map_bgm")?.bgmLabel).toBe("상위 맵/기본");

    map.bgm = { mode: "none" };
    expect(collectMapInspection(project, "map_bgm")?.bgmLabel).toBe("무음");

    map.bgm = { mode: "resource", resourceId: "bgm_town" };
    expect(collectMapInspection(project, "map_bgm")?.bgmLabel).toBe("bgm_town");

    map.bgm = { mode: "resource" };
    expect(collectMapInspection(project, "map_bgm")?.bgmLabel).toBe("지정 안 됨");
  });
});

describe("reachableMapIdsFromStart", () => {
  it("문을 여러 칸 타고 간 곳까지 모은다", () => {
    const project = createBlankProject();
    const start = project.maps[project.startMapId];
    if (!start) throw new Error("no start map");
    const mid = addMap(project, "map_mid", "가운데");
    addMap(project, "map_end", "끝");
    addMap(project, "map_orphan", "고아");
    start.events = [event("ev_1", [{ kind: "transfer", mapId: "map_mid", x: 1, y: 1 }])];
    mid.events = [event("ev_2", [{ kind: "transfer", mapId: "map_end", x: 1, y: 1 }])];

    const reachable = reachableMapIdsFromStart(project);
    expect(reachable.has(project.startMapId)).toBe(true);
    expect(reachable.has("map_mid")).toBe(true);
    expect(reachable.has("map_end")).toBe(true);
    expect(reachable.has("map_orphan")).toBe(false);
  });

  it("맵 연결은 양방향으로 본다", () => {
    const project = createBlankProject();
    addMap(project, "map_next", "옆");
    project.mapConnections = [{
      from: { mapId: "map_next", x: 0, y: 0 },
      id: "c1",
      npcEnabled: false,
      playerEnabled: true,
      to: { mapId: project.startMapId, x: 0, y: 0 },
    }];
    expect(reachableMapIdsFromStart(project).has("map_next")).toBe(true);
  });

  it("트리 계층만으로는 도달했다고 보지 않는다", () => {
    const project = createBlankProject();
    addMap(project, "map_child", "자식");
    expect(reachableMapIdsFromStart(project).has("map_child")).toBe(false);
  });
});
