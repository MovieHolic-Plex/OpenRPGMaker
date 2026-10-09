// 2026-09-24 연애 4회차: 마을을 시작 맵에 짓고 시작을 새 기숙사로 옮긴 뒤 잇지 않아 마을 전체가 플레이에서 빠졌다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

describe("set_start_position 이 내용 있는 이전 시작 맵을 고아로 만든다", () => {
  it("닿지 않으면 경고하고, 이어져 있으면 말하지 않는다", () => {
    const ctx = { project: createBlankProject() };
    const town = ctx.project.startMapId;
    expect(runTool(ctx, "upsert_event", { mapId: town, event: { id: "ev_a", x: 2, y: 2, pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, commands: [{ kind: "text", body: "마을 주민" }] }] } }).ok).toBe(true);
    expect(runTool(ctx, "create_map", { id: "map_dorm", name: "기숙사", width: 12, height: 10 }).ok).toBe(true);
    const moved = runTool(ctx, "set_start_position", { mapId: "map_dorm", x: 5, y: 5 });
    expect(moved.ok, moved.summary).toBe(true);
    expect((moved.diff?.warnings ?? moved.warnings ?? []).join(" ")).toContain("닿지 않습니다");
    expect(runTool(ctx, "upsert_event", { mapId: "map_dorm", event: { id: "ev_door", x: 5, y: 8, pages: [{ trigger: { kind: "playerTouch" }, graphic: { transparent: true }, commands: [{ kind: "transfer", mapId: town, x: 3, y: 3 }] }] } }).ok).toBe(true);
    const again = runTool(ctx, "set_start_position", { mapId: "map_dorm", x: 5, y: 4 });
    expect((again.diff?.warnings ?? again.warnings ?? []).join(" ")).not.toContain("닿지 않습니다");
  });
});
