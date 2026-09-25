// transfer 의 도착 방향을 facing/dir 로 쓴 명령 — 런타임이 direction 만 읽어 조용히 버리던 것(2026-09-24 JRPG ember-4).
import { describe, expect, it } from "vitest";
import { canonicalizeCommandFieldAlias } from "@/project/eventCommands/commandFieldAliases";
import { deserialize, serialize } from "@/project/io";
import { createBlankProject } from "@/project/defaults";

describe("transfer 도착 방향 별칭", () => {
  it("facing/dir 을 direction 으로 옮긴다", () => {
    const command: Record<string, unknown> = { kind: "transfer", mapId: "map_a", x: 3, y: 4, facing: "down" };
    expect(canonicalizeCommandFieldAlias(command)).toContain("transfer.facing 를 direction");
    expect(command).toEqual({ kind: "transfer", mapId: "map_a", x: 3, y: 4, direction: "down" });
  });

  it("방향이 아닌 값이거나 direction 이 이미 있으면 그대로 둔다", () => {
    const odd: Record<string, unknown> = { kind: "transfer", mapId: "m", x: 1, y: 1, facing: "north" };
    expect(canonicalizeCommandFieldAlias(odd)).toBeUndefined();
    expect(odd.facing).toBe("north");
    const kept: Record<string, unknown> = { kind: "transfer", mapId: "m", x: 1, y: 1, direction: "up", facing: "down" };
    canonicalizeCommandFieldAlias(kept);
    expect(kept.direction).toBe("up");
  });

  it("저장본을 읽을 때도 옮긴다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events.push({
      id: "ev_exit", name: "출구", x: 2, y: 2, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "p", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "transfer", mapId: map.id, x: 5, y: 5, facing: "left" } as never] }],
    });
    const loaded = deserialize(serialize(project));
    expect(loaded.maps[map.id]!.events.find((event) => event.id === "ev_exit")!.pages[0]!.commands[0]).toMatchObject({ kind: "transfer", direction: "left" });
  });
});
