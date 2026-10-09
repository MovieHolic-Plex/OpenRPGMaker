// 상인 NPC 배치가 「무기 상인의 집 문」 발판을 상인으로 재사용해 덮어쓰던 것(2026-09-24 JRPG 도그푸딩 ember-3).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent } from "@/project/types";

const page = (name: string, trigger: "playerTouch" | "action", commands: unknown[]) => ({
  id: `${name}_p`, name, conditions: [], trigger: { kind: trigger }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 }, graphic: {}, commands,
});

describe("근접 유사 NPC 재사용은 문·발판을 건드리지 않는다", () => {
  it("상인 이름이 든 문 발판 옆에 상인을 놓으면 새 NPC 를 만든다", () => {
    const ctx = { project: createBlankProject() };
    const map = ctx.project.maps[ctx.project.startMapId]!;
    map.events.push(
      { id: "ev_door", x: 5, y: 4, trigger: { kind: "playerTouch" }, commands: [], pages: [page("무기 상인의 집 문", "playerTouch", [{ kind: "transfer", mapId: map.id, x: 1, y: 1 }])] } as unknown as GameEvent,
      { id: "ev_door_step", x: 5, y: 5, trigger: { kind: "playerTouch" }, commands: [], pages: [page("무기 상인의 집 문", "playerTouch", [{ kind: "callMapEvent", eventId: "ev_door" }])] } as unknown as GameEvent,
    );
    const result = runTool(ctx, "place_npc", { mapId: map.id, name: "무기 상인", x: 6, y: 5, pages: [{ name: "무기점", lines: ["어서 오게"] }] }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(JSON.stringify(result.diff?.warnings ?? [])).not.toContain("근접 유사 NPC 재사용");
    const step = ctx.project.maps[map.id]!.events.find((event) => event.id === "ev_door_step")!;
    expect(step.pages![0]!.commands).toEqual([{ kind: "callMapEvent", eventId: "ev_door" }]);
    expect(ctx.project.maps[map.id]!.events.filter((event) => event.name === "무기 상인" || event.pages?.[0]?.name === "무기점")).toHaveLength(1);
  });

  it("진짜 상인 NPC 는 여전히 재사용한다", () => {
    const ctx = { project: createBlankProject() };
    const map = ctx.project.maps[ctx.project.startMapId]!;
    expect(runTool(ctx, "place_npc", { mapId: map.id, name: "상인", x: 6, y: 5, pages: [{ name: "상점", lines: ["어서 와"] }] }, { dryRun: false }).ok).toBe(true);
    const second = runTool(ctx, "place_npc", { mapId: map.id, name: "잡화 상인", x: 6, y: 6, pages: [{ name: "상점", lines: ["또 왔네"] }] }, { dryRun: false });
    expect(JSON.stringify(second.diff?.warnings ?? [])).toContain("근접 유사 NPC 재사용");
  });
});
