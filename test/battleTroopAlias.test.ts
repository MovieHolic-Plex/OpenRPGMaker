// 2026-09-24 헤드리스 「등대지기의 겨울」: 보스 이벤트의 battleProcessing 이 부대 ID 를 commandId 로 보내
// 「troopId가 문자열이 아닙니다」로 거부됐고, 모델은 보스를 대사 NPC 로 다시 놓아 보스전이 사라졌다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function bossEvent(battle: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "ev_boss", x: 3, y: 3, name: "눈보라 정령",
    pages: [{
      id: "page_battle", trigger: { kind: "action" },
      graphic: { pattern: 0, sprite: { id: "tex_easyrpg_charset_actor1", type: "bundled" }, direction: "down" },
      commands: [{ kind: "text", body: "얼어붙어라!" }, { kind: "battleProcessing", ...battle }],
    }],
  };
}

describe("battleProcessing troop alias", () => {
  it("moves a lone commandId into troopId and warns", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const troopId = ctx.project.database.troops[0]!.id;
    const result = runTool(ctx, "upsert_event", { mapId, event: bossEvent({ commandId: troopId }) });
    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[mapId]!.events.find(e => e.id === "ev_boss")!;
    const battle = event.pages![0]!.commands[1] as Record<string, unknown>;
    expect(battle.troopId).toBe(troopId);
    expect(battle).not.toHaveProperty("commandId");
    expect(battle).toMatchObject({ canEscape: true, canLose: false });
    expect(JSON.stringify(result)).toContain("troopId");
  });

  it("leaves ambiguous aliases alone so validation still rejects them", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const troopId = ctx.project.database.troops[0]!.id;
    const result = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: bossEvent({ commandId: troopId, troop: "troop_other" }) });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("troopId");
  });
});
