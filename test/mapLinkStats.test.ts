import { describe, expect, it } from "vitest";
import { collectMapLinkGraph, collectMapLinkStats } from "@/project/mapLinkStats";
import { createBlankProject } from "@/project/defaults";

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
