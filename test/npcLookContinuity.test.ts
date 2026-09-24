// 2026-09-24 연애 도그푸딩: 공략 인물 셋(girl/woman/boy)이 대사를 고치는 upsert_event 한 번씩에 전부
// 같은 기본 주민이 됐고, 축제 맵에 다시 세운 같은 인물은 query 가 달라 다른 얼굴이 됐다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

function lookOf(project: ReturnType<typeof createBlankProject>, mapId: string, eventId: string) {
  const graphic = project.maps[mapId]!.events.find((event) => event.id === eventId)!.pages![0]!.graphic;
  return `${graphic?.sprite?.id}#${graphic?.pattern}`;
}

describe("NPC 외형 연속성", () => {
  it("upsert_event 가 graphic 없는 pages 로 바꿔도 기존 외형을 유지한다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const placed = runTool(ctx, "place_npc", { mapId, id: "npc_summer", name: "한여름", x: 3, y: 3, graphic: { query: "girl" }, pages: [{ lines: ["안녕!"] }] });
    expect(placed.ok, placed.summary).toBe(true);
    const before = lookOf(ctx.project, mapId, "npc_summer");
    const updated = runTool(ctx, "upsert_event", {
      mapId,
      event: { id: "npc_summer", pages: [{ trigger: { kind: "action" }, commands: [{ kind: "text", body: "다시 안녕!" }] }] },
    });
    expect(updated.ok, updated.summary).toBe(true);
    expect(lookOf(ctx.project, mapId, "npc_summer")).toBe(before);
  });

  it("다른 맵에 같은 이름의 인물을 query 로 세우면 이미 있는 외형을 쓴다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    expect(runTool(ctx, "create_map", { id: "map_fest", name: "축제", width: 20, height: 15 }).ok).toBe(true);
    expect(runTool(ctx, "place_npc", { mapId, id: "npc_summer", name: "한여름", x: 3, y: 3, graphic: { query: "girl" }, pages: [{ lines: ["안녕!"] }] }).ok).toBe(true);
    const again = runTool(ctx, "place_npc", { mapId: "map_fest", id: "npc_fest_summer", name: "한여름", x: 5, y: 5, graphic: { query: "woman" }, pages: [{ lines: ["축제다!"] }] });
    expect(again.ok, again.summary).toBe(true);
    expect(lookOf(ctx.project, "map_fest", "npc_fest_summer")).toBe(lookOf(ctx.project, mapId, "npc_summer"));
    expect((again.diff?.warnings ?? []).join(" ")).toContain("같은 인물");
  });
});
