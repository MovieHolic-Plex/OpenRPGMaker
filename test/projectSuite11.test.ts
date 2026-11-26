import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { collectMapInspection, isFolderNode, reachableMapIdsFromStart } from "@/project/mapInspection";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { collectMapLinkGraph, collectMapLinkStats } from "@/project/mapLinkStats";
import { loopStepTarget, wrapLoopPosition } from "@/project/mapLoop";
import { runTool, type ToolContext } from "@/editor/tools";
import { deserialize, serialize } from "@/project/io";
import { activePlanningItems, describePlanningReuse, formatPlanningReuseBlock, makeMapPlanningItemId, MAP_PLANNING_ITEM_TEXT_MAX, normalizeMapPlanningItems, normalizePlanningItemText, planningTextFromSpecAsset, resolvePlanningReuse, type MapPlanningItem } from "@/project/mapPlanningItems";
import { maxTemplateOverlap, templateOverlap, type OverlapGrid } from "@/project/mapTemplateOverlap";
import { isMediaSeparationOnly } from "@/project/mediaSeparationEquality";
import { sha256HexBytes } from "@/util/sha256";
import { isolateTimers } from "./mergedTeardown";

describe("mapInspection", () => {
  isolateTimers();
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
});

describe("mapLinkStats", () => {
  isolateTimers();
  describe("collectMapLinkStats", () => {
    it("counts outgoing transfers, incoming transfers, and mapConnections", () => {
      const project = createBlankProject();
      const a = project.startMapId;
      const b = "map_b";
      project.maps[b] = { ...project.maps[a]!, id: b, name: "안", events: [] };
      project.maps[a]!.events = [{
        id: "ev_door",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [{ kind: "transfer", mapId: b, x: 2, y: 2 }],
      }];
      project.maps[b]!.events = [];
      project.mapConnections = [{
        id: "c1",
        from: { mapId: a, x: 0, y: 0 },
        to: { mapId: b, x: 1, y: 1 },
        playerEnabled: true,
        npcEnabled: false,
      }];

      const fromA = collectMapLinkStats(project, a);
      const fromB = collectMapLinkStats(project, b);
      expect(fromA.outgoingTransfers).toBe(1);
      expect(fromA.incomingTransfers).toBe(0);
      expect(fromA.connections).toBe(1);
      expect(fromA.playLinkCount).toBe(2);
      expect(fromB.outgoingTransfers).toBe(0);
      expect(fromB.incomingTransfers).toBe(1);
      expect(fromB.playLinkCount).toBe(2);
    });
  });
  describe("collectMapLinkGraph", () => {
    it("marks maps unreachable from the start and keeps the transfer's event and position", () => {
      const project = createBlankProject();
      const start = project.startMapId;
      const base = project.maps[start]!;
      for (const id of ["map_house", "map_cellar", "map_island"]) project.maps[id] = { ...base, id, name: id, events: [] };
      project.maps[start]!.events = [{ id: "door", x: 3, y: 4, trigger: { kind: "action" }, commands: [{ kind: "transfer", mapId: "map_house", x: 1, y: 1 }] }];
      // 지하실은 집으로 나가는 문만 있다 — 들어오는 길이 없으니 시작에서 못 닿는다. 섬은 문이 하나도 없다.
      project.maps.map_cellar!.events = [{ id: "up", x: 0, y: 0, trigger: { kind: "action" }, commands: [{ kind: "transfer", mapId: "map_house", x: 2, y: 2 }] }];

      const byId = Object.fromEntries(collectMapLinkGraph(project).map((node) => [node.mapId, node]));
      expect(byId[start]!.isStart).toBe(true);
      expect(byId[start]!.outgoing).toEqual([{ from: start, to: "map_house", kind: "transfer", eventId: "door", x: 3, y: 4 }]);
      expect(byId.map_house!.reachableFromStart).toBe(true);
      expect(byId.map_house!.incoming.map((edge) => edge.from).sort()).toEqual(["map_cellar", start].sort());
      expect(byId.map_cellar!.reachableFromStart).toBe(false);
      expect(byId.map_island!.reachableFromStart).toBe(false);
      expect(byId.map_island!.outgoing.length + byId.map_island!.incoming.length).toBe(0);
    });

    it("treats a map connection as a two-way link", () => {
      const project = createBlankProject();
      const start = project.startMapId;
      project.maps.map_field = { ...project.maps[start]!, id: "map_field", name: "들판", events: [] };
      project.mapConnections = [{ id: "edge", from: { mapId: "map_field", x: 0, y: 0 }, to: { mapId: start, x: 0, y: 0 }, playerEnabled: true, npcEnabled: false }];
      const field = collectMapLinkGraph(project).find((node) => node.mapId === "map_field")!;
      expect(field.reachableFromStart).toBe(true);
      expect(field.outgoing.map((edge) => edge.kind)).toEqual(["connection"]);
      expect(field.incoming.map((edge) => edge.kind)).toEqual(["connection"]);
    });
  });
  it("reuses link inputs across tile edits and invalidates event positions, start and map membership", () => {
    const p = createBlankProject();
    const a = p.startMapId;
    p.maps.b = { ...p.maps[a]!, id: "b", events: [] };
    p.maps[a]!.events = [{ id: "door", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "transfer", mapId: "b", x: 0, y: 0 }] }];
    const graph = collectMapLinkGraph(p);
    const painted = { ...p, maps: { ...p.maps, [a]: { ...p.maps[a]!, lowerTiles: [...p.maps[a]!.lowerTiles] } } };
    expect(collectMapLinkGraph(painted)).toBe(graph);
    const moved = { ...painted, maps: { ...painted.maps, [a]: { ...painted.maps[a]!, events: [{ ...p.maps[a]!.events[0]!, x: 7 }] } } };
    expect(collectMapLinkGraph(moved).find(n => n.mapId === a)!.outgoing[0]!.x).toBe(7);
    const restarted = { ...moved, startMapId: "b" };
    expect(collectMapLinkGraph(restarted).find(n => n.mapId === a)!.reachableFromStart).toBe(false);
    const removed = { ...restarted, maps: { [a]: restarted.maps[a]! } };
    expect(collectMapLinkGraph(removed)[0]!.outgoing).toEqual([]);
    expect(collectMapLinkStats(removed, a).outgoingTransfers).toBe(1); // dangling transfers still counted
    const connected = { ...p, mapConnections: [{ id: "edge", from: { mapId: a, x: 0, y: 0 }, to: { mapId: "b", x: 0, y: 0 }, playerEnabled: true, npcEnabled: false }] };
    expect(collectMapLinkGraph(connected).find(n => n.mapId === "b")!.outgoing[0]!.kind).toBe("connection");
    expect(collectMapLinkStats(connected, a).connections).toBe(1);
  });
});

// 반복 맵(map.loop) — 2026-09-24 꿈 세계 도그푸딩: 「가장자리가 반대편으로 이어지는 숲」을 만들 속성이 없었다.
describe("mapLoop", () => {
  isolateTimers();
  const map = { width: 10, height: 8, loop: "horizontal" as const };
  describe("map.loop", () => {
    it("루프 축 가장자리를 넘는 걸음만 반대편으로 접는다", () => {
      expect(loopStepTarget(map, 9, 3, 1, 0)).toEqual({ x: 0, y: 3 });
      expect(loopStepTarget(map, 0, 3, -1, 0)).toEqual({ x: 9, y: 3 });
      expect(loopStepTarget(map, 4, 0, 0, -1)).toBeNull();
      expect(loopStepTarget(map, 4, 3, 1, 0)).toBeNull();
      expect(loopStepTarget({ ...map, loop: "both" }, 4, 0, 0, -1)).toEqual({ x: 4, y: 7 });
      expect(wrapLoopPosition(map, 10, 3)).toEqual({ x: 0, y: 3 });
      expect(wrapLoopPosition(map, 3, -1)).toEqual({ x: 3, y: -1 });
    });

    it("set_map_properties 로 켜고 끄며, 가장자리가 막혀 있으면 경고한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const on = runTool(ctx, "set_map_properties", { mapId, loop: "both" });
      expect(on.ok, on.summary).toBe(true);
      expect(ctx.project.maps[mapId]!.loop).toBe("both");
      expect(on.summary).toContain("사방 반복");
      const off = runTool(ctx, "set_map_properties", { mapId, loop: "none" });
      expect(off.ok, off.summary).toBe(true);
      expect(ctx.project.maps[mapId]!.loop).toBeUndefined();
    });
  });
});

// 보존 기획 항목(OPRN-019) — 스키마·정규화·재사용 선택의 순수 계약.
//
// 여기서 잠그는 것:
//  1. 프로젝트 JSON 왕복(= 내보내기/가져오기 경로)에서 항목이 살아남는다.
//  2. 빈 목록은 필드를 지운다 — 옛 저장본의 바이트 안정성.
//  3. 잘못된 wire 데이터는 fail-closed 다(조용히 버리지 않는다).
//  4. 재사용 선택(none/all/selected)이 실제로 실릴 항목과 지침 블록을 정한다.
//  5. 은퇴·삭제된 항목은 선택에 남아 있어도 부활하지 않는다.
describe("mapPlanningItems", () => {
  isolateTimers();
  function withItems(items: MapPlanningItem[]): Project {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    map.planningItems = items;
    return project;
  }
  const item = (id: string, text: string, over: Partial<MapPlanningItem> = {}): MapPlanningItem => ({
    id,
    text,
    status: "active",
    origin: "user",
    ...over,
  });
  describe("보존 기획 항목 스키마", () => {
    it("프로젝트 JSON 왕복에서 항목이 그대로 살아남는다 (내보내기 → 가져오기)", () => {
      // Break: serialize 가 map 필드를 화이트리스트로 걸러 새 필드를 떨어뜨린다.
      const project = withItems([
        item("pi_1", "북쪽 광장은 남긴다", { createdAt: "2026-09-10T00:00:00.000Z" }),
        item("pi_2", "동쪽 부두는 밑그림에서 담았다", { origin: "spec", specAssetId: "map_1:dock", status: "retired" }),
      ]);
      const restored = deserialize(serialize(project));
      expect(restored.maps[restored.startMapId]?.planningItems).toEqual([
        item("pi_1", "북쪽 광장은 남긴다", { createdAt: "2026-09-10T00:00:00.000Z" }),
        item("pi_2", "동쪽 부두는 밑그림에서 담았다", { origin: "spec", specAssetId: "map_1:dock", status: "retired" }),
      ]);
    });

    it("항목이 없는 맵은 필드 자체가 없다 — 스키마 버전을 올리지 않는다", () => {
      // Break: 정규화가 빈 배열을 남겨 옛 프로젝트 JSON 의 바이트가 달라진다.
      const blank = deserialize(serialize(createBlankProject()));
      expect(blank.maps[blank.startMapId]?.planningItems).toBeUndefined();
      expect(blank.version).toBe(createBlankProject().version);
      const emptied = deserialize(serialize(withItems([])));
      expect(emptied.maps[emptied.startMapId]?.planningItems).toBeUndefined();
    });

    it("잘못된 wire 데이터는 load 를 실패시킨다 (조용한 삭제 금지)", () => {
      // Break: 셰이프 검사가 빠져 사용자가 보존한 문장이 이유 없이 사라진다.
      const cases: [string, unknown][] = [
        ["빈 본문", [{ id: "pi_1", text: "   ", status: "active", origin: "user" }]],
        ["없는 status", [{ id: "pi_1", text: "a", origin: "user" }]],
        ["알 수 없는 status", [{ id: "pi_1", text: "a", status: "archived", origin: "user" }]],
        ["알 수 없는 origin", [{ id: "pi_1", text: "a", status: "active", origin: "robot" }]],
        ["중복 id", [
          { id: "pi_1", text: "a", status: "active", origin: "user" },
          { id: "pi_1", text: "b", status: "active", origin: "user" },
        ]],
        ["배열이 아님", { id: "pi_1" }],
      ];
      for (const [label, value] of cases) {
        const project = createBlankProject();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("start map missing");
        (map as unknown as Record<string, unknown>).planningItems = value;
        expect(() => deserialize(serialize(project)), label).toThrow();
      }
    });

    it("정규화는 공백을 접고 상한을 지키며 알 수 없는 값을 기본값으로 되돌린다", () => {
      // Break: 본문 길이·중복·빈 목록 처리가 저장 경로와 도구 경로에서 갈라진다.
      expect(normalizePlanningItemText("  두   칸  ")).toBe("두 칸");
      expect(normalizePlanningItemText("가".repeat(MAP_PLANNING_ITEM_TEXT_MAX + 50)))
        .toHaveLength(MAP_PLANNING_ITEM_TEXT_MAX);
      expect(normalizeMapPlanningItems([])).toBeUndefined();
      expect(normalizeMapPlanningItems("nope")).toBeUndefined();
      expect(normalizeMapPlanningItems([{ id: "pi_1", text: "a", status: "weird", origin: "weird" }]))
        .toEqual([item("pi_1", "a")]);
      expect(makeMapPlanningItemId([item("pi_1", "a"), item("pi_2", "b")])).toBe("pi_3");
    });
  });
  describe("보존 기획 재사용 선택", () => {
    const items = [
      item("pi_1", "북쪽 광장은 남긴다"),
      item("pi_2", "동쪽 부두 유지"),
      item("pi_3", "옛 다리는 철거", { status: "retired" }),
    ];

    it("사용 안 함은 아무 항목도 아무 문장도 만들지 않는다", () => {
      // Break: 목록이 있다는 사실만으로 프롬프트에 문장이 실린다(숨은 강제 기억).
      const chosen = resolvePlanningReuse(items, { mode: "none", selectedIds: ["pi_1"] });
      expect(chosen).toEqual([]);
      expect(formatPlanningReuseBlock(chosen)).toBe("");
      expect(describePlanningReuse(0, "none")).toBe("보존 기획 사용 안 함");
    });

    it("전체는 은퇴 항목을 빼고 활성만 담는다", () => {
      // Break: 은퇴가 재사용 후보에서 빠지지 않아 「은퇴」와 「삭제」가 같은 뜻이 된다.
      const chosen = resolvePlanningReuse(items, { mode: "all", selectedIds: [] });
      expect(chosen.map((row) => row.id)).toEqual(["pi_1", "pi_2"]);
      expect(activePlanningItems(items)).toHaveLength(2);
    });

    it("선택은 고른 id 만 담고, 은퇴·없는 id 는 조용히 부활하지 않는다", () => {
      // Break: 삭제된 항목의 남은 선택이 다음 턴 지침으로 되살아난다.
      const chosen = resolvePlanningReuse(items, { mode: "selected", selectedIds: ["pi_2", "pi_3", "pi_없음"] });
      expect(chosen.map((row) => row.id)).toEqual(["pi_2"]);
    });

    it("지침 블록은 지침임을 본문에서 밝히고 항목을 번호로 싣는다", () => {
      // Break: 블록이 차단 규칙처럼 쓰여 조수가 새 요청을 거절하는 근거로 쓴다.
      const block = formatPlanningReuseBlock(resolvePlanningReuse(items, { mode: "all", selectedIds: [] }));
      expect(block).toContain("[보존 기획]");
      expect(block).toContain("지침이며 차단 규칙이 아니다");
      expect(block).toContain("1. 북쪽 광장은 남긴다");
      expect(block).toContain("2. 동쪽 부두 유지");
      expect(block).not.toContain("옛 다리는 철거");
    });

    it("밑그림 에셋은 좌표를 남긴 한 줄로 바뀐다", () => {
      // Break: 담은 항목이 좌표를 잃어 나중에 「원래 그 자리」를 판단할 수 없다.
      expect(planningTextFromSpecAsset({ id: "plaza", kind: "terrain", x: 4, y: 6, w: 8, h: 5, style: "석재 광장" }))
        .toBe("석재 광장 — terrain (4,6) 8×5");
      expect(planningTextFromSpecAsset({ id: "dock", kind: "road", x: 0, y: 0, w: 3, h: 2 }))
        .toBe("road — road (0,0) 3×2");
    });
  });
});

// 견본 복사 측정(mapTemplateOverlap): 평행이동·좌우반전을 해도 같은 판을 찾아내고, 다른 타일셋 견본은 재지 않는다.
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
describe("mapTemplateOverlap", () => {
  isolateTimers();
  const grid = (width: number, height: number, cell: (x: number, y: number) => number, tilesetId = "t"): OverlapGrid =>
    ({ width, height, tilesetId, lower: Array.from({ length: width * height }, (_, i) => cell(i % width, Math.floor(i / width))) });
  const noise = (x: number, y: number) => (Math.imul(x + 3, 2654435761) ^ Math.imul(y + 7, 40503)) >>> 0;
  describe("templateOverlap", () => {
    it("is 1 for an identical map", () => {
      const t = grid(12, 10, (x, y) => noise(x, y) % 9);
      expect(templateOverlap(t, t).overlap).toBe(1);
    });

    it("finds a copy moved by a few tiles", () => {
      const t = grid(12, 10, (x, y) => noise(x, y) % 9);
      const moved = grid(12, 10, (x, y) => (x >= 3 ? noise(x - 3, y) % 9 : 100));
      const hit = templateOverlap(moved, t);
      expect(hit.dx).toBe(3);
      expect(hit.overlap).toBeCloseTo((9 * 10) / (12 * 10), 5);
    });

    it("finds a mirrored copy", () => {
      const t = grid(12, 10, (x, y) => noise(x, y) % 9);
      const mirrored = grid(12, 10, (x, y) => noise(11 - x, y) % 9);
      const hit = templateOverlap(mirrored, t);
      expect(hit.flip).toBe(true);
      expect(hit.overlap).toBe(1);
    });

    it("stays low for an unrelated layout", () => {
      const t = grid(12, 10, (x, y) => noise(x, y) % 9);
      const other = grid(12, 10, (x, y) => noise(y + 50, x + 50) % 9);
      expect(templateOverlap(other, t).overlap).toBeLessThan(0.4);
    });
  });
  describe("maxTemplateOverlap", () => {
    it("compares only templates on the same tileset", () => {
      const map = grid(8, 8, () => 1);
      const hit = maxTemplateOverlap(map, { a: grid(8, 8, () => 1, "other"), b: grid(8, 8, (x) => (x < 4 ? 1 : 2)) });
      expect(hit?.key).toBe("b");
      expect(hit?.overlap).toBe(0.5);
    });

    it("skips templates whose tile counts cannot reach the floor", () => {
      const map = grid(8, 8, () => 1);
      expect(maxTemplateOverlap(map, { b: grid(8, 8, (x) => (x < 2 ? 1 : 2)) }, { floor: 0.4 })).toBeUndefined();
      expect(maxTemplateOverlap(map, { b: grid(8, 8, (x) => (x < 4 ? 1 : 2)) }, { floor: 0.4 })?.overlap).toBe(0.5);
    });
  });
});

describe("mediaSeparationEquality", () => {
  isolateTimers();
  async function separated() {
    const before = createBlankProject();
    before.assets.uploaded = { art: { id: 'art', name: 'Opening', kind: 'picture', dataUrl: 'data:image/png;base64,AQID', meta: {} } };
    const after = structuredClone(before);
    delete after.assets.uploaded.art!.dataUrl;
    after.assets.uploaded.art!.ref = { sha256: await sha256HexBytes(new Uint8Array([1, 2, 3])), mime: 'image/png', bytes: 3, extension: 'png' };
    return { before, after };
  }
  describe('storage-only media adoption during an assistant turn', () => {
    it('recognizes identical verified bytes and leaves both input documents intact', async () => {
      const { before, after } = await separated(), source = JSON.stringify(before), target = JSON.stringify(after);
      expect(await isMediaSeparationOnly(before, after)).toBe(true);
      expect(JSON.stringify(before)).toBe(source); expect(JSON.stringify(after)).toBe(target);
    });
    it('keeps real asset and story edits outside this exemption', async () => {
      const { before, after } = await separated();
      after.assets.uploaded.art!.ref = { ...after.assets.uploaded.art!.ref!, sha256: 'a'.repeat(64) };
      expect(await isMediaSeparationOnly(before, after)).toBe(false);
      after.assets.uploaded.art!.ref = { ...after.assets.uploaded.art!.ref!, sha256: await sha256HexBytes(new Uint8Array([1, 2, 3])) };
      after.system.opening = { enabled: false, skippable: true, scenes: [] };
      expect(await isMediaSeparationOnly(before, after)).toBe(false);
    });
  });
});
