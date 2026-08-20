import { describe, expect, it } from "vitest";
import { collectMapLinkStats } from "@/project/mapLinkStats";
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
